"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.VoiceBroadcastPlaybackState = exports.VoiceBroadcastPlaybackEvent = exports.VoiceBroadcastPlayback = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _matrix = require("matrix-js-sdk/src/matrix");
var _typedEventEmitter = require("matrix-js-sdk/src/models/typed-event-emitter");
var _matrixWidgetApi = require("matrix-widget-api");
var _logger = require("matrix-js-sdk/src/logger");
var _utils = require("matrix-js-sdk/src/utils");
var _Playback = require("../../audio/Playback");
var _PlaybackManager = require("../../audio/PlaybackManager");
var _AsyncStore = require("../../stores/AsyncStore");
var _MediaEventHelper = require("../../utils/MediaEventHelper");
var _ = require("..");
var _RelationsHelper = require("../../events/RelationsHelper");
var _VoiceBroadcastChunkEvents = require("../utils/VoiceBroadcastChunkEvents");
var _determineVoiceBroadcastLiveness = require("../utils/determineVoiceBroadcastLiveness");
var _languageHandler = require("../../languageHandler");
/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
let VoiceBroadcastPlaybackState = /*#__PURE__*/function (VoiceBroadcastPlaybackState) {
  VoiceBroadcastPlaybackState["Paused"] = "pause";
  VoiceBroadcastPlaybackState["Playing"] = "playing";
  VoiceBroadcastPlaybackState["Stopped"] = "stopped";
  VoiceBroadcastPlaybackState["Buffering"] = "buffering";
  VoiceBroadcastPlaybackState["Error"] = "error";
  return VoiceBroadcastPlaybackState;
}({});
exports.VoiceBroadcastPlaybackState = VoiceBroadcastPlaybackState;
let VoiceBroadcastPlaybackEvent = /*#__PURE__*/function (VoiceBroadcastPlaybackEvent) {
  VoiceBroadcastPlaybackEvent["TimesChanged"] = "times_changed";
  VoiceBroadcastPlaybackEvent["LivenessChanged"] = "liveness_changed";
  VoiceBroadcastPlaybackEvent["StateChanged"] = "state_changed";
  VoiceBroadcastPlaybackEvent["InfoStateChanged"] = "info_state_changed";
  return VoiceBroadcastPlaybackEvent;
}({});
exports.VoiceBroadcastPlaybackEvent = VoiceBroadcastPlaybackEvent;
class VoiceBroadcastPlayback extends _typedEventEmitter.TypedEventEmitter {
  constructor(infoEvent, client, recordings) {
    super();
    this.infoEvent = infoEvent;
    this.client = client;
    this.recordings = recordings;
    (0, _defineProperty2.default)(this, "state", VoiceBroadcastPlaybackState.Stopped);
    (0, _defineProperty2.default)(this, "chunkEvents", new _VoiceBroadcastChunkEvents.VoiceBroadcastChunkEvents());
    /** @var Map: event Id → undecryptable event */
    (0, _defineProperty2.default)(this, "utdChunkEvents", new Map());
    (0, _defineProperty2.default)(this, "playbacks", new Map());
    (0, _defineProperty2.default)(this, "currentlyPlaying", null);
    /** @var total duration of all chunks in milliseconds */
    (0, _defineProperty2.default)(this, "duration", 0);
    /** @var current playback position in milliseconds */
    (0, _defineProperty2.default)(this, "position", 0);
    (0, _defineProperty2.default)(this, "liveData", new _matrixWidgetApi.SimpleObservable());
    (0, _defineProperty2.default)(this, "liveness", "not-live");
    // set via addInfoEvent() in constructor
    (0, _defineProperty2.default)(this, "infoState", void 0);
    (0, _defineProperty2.default)(this, "lastInfoEvent", void 0);
    // set via setUpRelationsHelper() in constructor
    (0, _defineProperty2.default)(this, "chunkRelationHelper", void 0);
    (0, _defineProperty2.default)(this, "infoRelationHelper", void 0);
    (0, _defineProperty2.default)(this, "skipToNext", void 0);
    (0, _defineProperty2.default)(this, "skipToDeferred", void 0);
    (0, _defineProperty2.default)(this, "addChunkEvent", async event => {
      if (!event.getId() && !event.getTxnId()) {
        // skip events without id and txn id
        return false;
      }
      if (event.isDecryptionFailure()) {
        this.onChunkEventDecryptionFailure(event);
        return false;
      }
      if (event.getContent()?.msgtype !== _matrix.MsgType.Audio) {
        // skip non-audio event
        return false;
      }
      this.chunkEvents.addEvent(event);
      this.setDuration(this.chunkEvents.getLength());
      if (this.getState() === VoiceBroadcastPlaybackState.Buffering) {
        await this.startOrPlayNext();
      }
      return true;
    });
    (0, _defineProperty2.default)(this, "onChunkEventDecryptionFailure", event => {
      const eventId = event.getId();
      if (!eventId) {
        // This should not happen, as the existence of the Id is checked before the call.
        // Log anyway and return.
        _logger.logger.warn("Broadcast chunk decryption failure for event without Id", {
          broadcast: this.infoEvent.getId()
        });
        return;
      }
      if (!this.utdChunkEvents.has(eventId)) {
        event.once(_matrix.MatrixEventEvent.Decrypted, this.onChunkEventDecrypted);
      }
      this.utdChunkEvents.set(eventId, event);
      this.setError();
    });
    (0, _defineProperty2.default)(this, "onChunkEventDecrypted", async event => {
      const eventId = event.getId();
      if (!eventId) {
        // This should not happen, as the existence of the Id is checked before the call.
        // Log anyway and return.
        _logger.logger.warn("Broadcast chunk decrypted for event without Id", {
          broadcast: this.infoEvent.getId()
        });
        return;
      }
      this.utdChunkEvents.delete(eventId);
      await this.addChunkEvent(event);
      if (this.utdChunkEvents.size === 0) {
        // no more UTD events, recover from error to paused
        this.setState(VoiceBroadcastPlaybackState.Paused);
      }
    });
    (0, _defineProperty2.default)(this, "startOrPlayNext", async () => {
      if (this.currentlyPlaying) {
        return this.playNext();
      }
      return await this.start();
    });
    (0, _defineProperty2.default)(this, "addInfoEvent", event => {
      if (this.lastInfoEvent && this.lastInfoEvent.getTs() >= event.getTs()) {
        // Only handle newer events
        return;
      }
      const state = event.getContent()?.state;
      if (!Object.values(_.VoiceBroadcastInfoState).includes(state)) {
        // Do not handle unknown voice broadcast states
        return;
      }
      this.lastInfoEvent = event;
      this.setInfoState(state);
    });
    (0, _defineProperty2.default)(this, "onBeforeRedaction", () => {
      if (this.getState() !== VoiceBroadcastPlaybackState.Stopped) {
        this.stop();
        // destroy cleans up everything
        this.destroy();
      }
    });
    (0, _defineProperty2.default)(this, "onPlaybackPositionUpdate", (event, position) => {
      if (event !== this.currentlyPlaying) return;
      const newPosition = this.chunkEvents.getLengthTo(event) + position * 1000; // observable sends seconds

      // do not jump backwards - this can happen when transiting from one to another chunk
      if (newPosition < this.position) return;
      this.setPosition(newPosition);
    });
    (0, _defineProperty2.default)(this, "onPlaybackStateChange", async (event, newState) => {
      if (event !== this.currentlyPlaying) return;
      if (newState !== _Playback.PlaybackState.Stopped) return;
      await this.playNext();
      this.unloadPlayback(event);
    });
    this.addInfoEvent(this.infoEvent);
    this.infoEvent.on(_matrix.MatrixEventEvent.BeforeRedaction, this.onBeforeRedaction);
    this.setUpRelationsHelper();
  }
  async setUpRelationsHelper() {
    this.infoRelationHelper = new _RelationsHelper.RelationsHelper(this.infoEvent, _matrix.RelationType.Reference, _.VoiceBroadcastInfoEventType, this.client);
    this.infoRelationHelper.getCurrent().forEach(this.addInfoEvent);
    if (this.infoState !== _.VoiceBroadcastInfoState.Stopped) {
      // Only required if not stopped. Stopped is the final state.
      this.infoRelationHelper.on(_RelationsHelper.RelationsHelperEvent.Add, this.addInfoEvent);
      try {
        await this.infoRelationHelper.emitFetchCurrent();
      } catch (err) {
        _logger.logger.warn("error fetching server side relation for voice broadcast info", err);
        // fall back to local events
        this.infoRelationHelper.emitCurrent();
      }
    }
    this.chunkRelationHelper = new _RelationsHelper.RelationsHelper(this.infoEvent, _matrix.RelationType.Reference, _matrix.EventType.RoomMessage, this.client);
    this.chunkRelationHelper.on(_RelationsHelper.RelationsHelperEvent.Add, this.addChunkEvent);
    try {
      // TODO Michael W: only fetch events if needed, blocked by PSF-1708
      await this.chunkRelationHelper.emitFetchCurrent();
    } catch (err) {
      _logger.logger.warn("error fetching server side relation for voice broadcast chunks", err);
      // fall back to local events
      this.chunkRelationHelper.emitCurrent();
    }
  }
  async tryLoadPlayback(chunkEvent) {
    try {
      return await this.loadPlayback(chunkEvent);
    } catch (err) {
      _logger.logger.warn("Unable to load broadcast playback", {
        message: err.message,
        broadcastId: this.infoEvent.getId(),
        chunkId: chunkEvent.getId()
      });
      this.setError();
    }
  }
  async loadPlayback(chunkEvent) {
    const eventId = chunkEvent.getId();
    if (!eventId) {
      throw new Error("Broadcast chunk event without Id occurred");
    }
    const helper = new _MediaEventHelper.MediaEventHelper(chunkEvent);
    const blob = await helper.sourceBlob.value;
    const buffer = await blob.arrayBuffer();
    const playback = _PlaybackManager.PlaybackManager.instance.createPlaybackInstance(buffer);
    await playback.prepare();
    playback.clockInfo.populatePlaceholdersFrom(chunkEvent);
    this.playbacks.set(eventId, playback);
    playback.on(_AsyncStore.UPDATE_EVENT, state => this.onPlaybackStateChange(chunkEvent, state));
    playback.clockInfo.liveData.onUpdate(_ref => {
      let [position] = _ref;
      this.onPlaybackPositionUpdate(chunkEvent, position);
    });
  }
  unloadPlayback(event) {
    const playback = this.playbacks.get(event.getId());
    if (!playback) return;
    playback.destroy();
    this.playbacks.delete(event.getId());
  }
  setDuration(duration) {
    if (this.duration === duration) return;
    this.duration = duration;
    this.emitTimesChanged();
    this.liveData.update([this.timeSeconds, this.durationSeconds]);
  }
  setPosition(position) {
    if (this.position === position) return;
    this.position = position;
    this.emitTimesChanged();
    this.liveData.update([this.timeSeconds, this.durationSeconds]);
  }
  emitTimesChanged() {
    this.emit(VoiceBroadcastPlaybackEvent.TimesChanged, {
      duration: this.durationSeconds,
      position: this.timeSeconds,
      timeLeft: this.timeLeftSeconds
    });
  }
  async playNext() {
    if (!this.currentlyPlaying) return;
    const next = this.chunkEvents.getNext(this.currentlyPlaying);
    if (next) {
      return this.playEvent(next);
    }
    if (this.getInfoState() === _.VoiceBroadcastInfoState.Stopped && this.chunkEvents.getSequenceForEvent(this.currentlyPlaying) === this.lastChunkSequence) {
      this.stop();
    } else {
      // No more chunks available, although the broadcast is not finished → enter buffering state.
      this.setState(VoiceBroadcastPlaybackState.Buffering);
    }
  }

  /**
   * @returns {number} The last chunk sequence from the latest info event.
   *                   Falls back to the length of received chunks if the info event does not provide the number.
   */
  get lastChunkSequence() {
    return this.lastInfoEvent.getContent()?.last_chunk_sequence || this.chunkEvents.getNumberOfEvents();
  }
  async playEvent(event) {
    this.setState(VoiceBroadcastPlaybackState.Playing);
    this.currentlyPlaying = event;
    const playback = await this.tryGetOrLoadPlaybackForEvent(event);
    playback?.play();
  }
  async tryGetOrLoadPlaybackForEvent(event) {
    try {
      return await this.getOrLoadPlaybackForEvent(event);
    } catch (err) {
      _logger.logger.warn("Unable to load broadcast playback", {
        message: err.message,
        broadcastId: this.infoEvent.getId(),
        chunkId: event.getId()
      });
      this.setError();
    }
  }
  async getOrLoadPlaybackForEvent(event) {
    const eventId = event.getId();
    if (!eventId) {
      throw new Error("Broadcast chunk event without Id occurred");
    }
    if (!this.playbacks.has(eventId)) {
      // set to buffering while loading the chunk data
      const currentState = this.getState();
      this.setState(VoiceBroadcastPlaybackState.Buffering);
      await this.loadPlayback(event);
      this.setState(currentState);
    }
    const playback = this.playbacks.get(eventId);
    if (!playback) {
      throw new Error(`Unable to find playback for event ${event.getId()}`);
    }

    // try to load the playback for the next event for a smooth(er) playback
    const nextEvent = this.chunkEvents.getNext(event);
    if (nextEvent) this.tryLoadPlayback(nextEvent);
    return playback;
  }
  getCurrentPlayback() {
    if (!this.currentlyPlaying) return;
    return this.playbacks.get(this.currentlyPlaying.getId());
  }
  getLiveness() {
    return this.liveness;
  }
  setLiveness(liveness) {
    if (this.liveness === liveness) return;
    this.liveness = liveness;
    this.emit(VoiceBroadcastPlaybackEvent.LivenessChanged, liveness);
  }
  get currentState() {
    return _Playback.PlaybackState.Playing;
  }
  get timeSeconds() {
    return this.position / 1000;
  }
  get durationSeconds() {
    return this.duration / 1000;
  }
  get timeLeftSeconds() {
    // Sometimes the meta data and the audio files are a little bit out of sync.
    // Be sure it never returns a negative value.
    return Math.max(0, Math.round(this.durationSeconds) - this.timeSeconds);
  }
  async skipTo(timeSeconds) {
    this.skipToNext = timeSeconds;
    if (this.skipToDeferred) {
      // Skip to position is already in progress. Return the promise for that.
      return this.skipToDeferred.promise;
    }
    this.skipToDeferred = (0, _utils.defer)();
    while (this.skipToNext !== undefined) {
      // Skip to position until skipToNext is undefined.
      // skipToNext can be set if skipTo is called while already skipping.
      const skipToNext = this.skipToNext;
      this.skipToNext = undefined;
      await this.doSkipTo(skipToNext);
    }
    this.skipToDeferred.resolve();
    this.skipToDeferred = undefined;
  }
  async doSkipTo(timeSeconds) {
    const time = timeSeconds * 1000;
    const event = this.chunkEvents.findByTime(time);
    if (!event) {
      _logger.logger.warn("voice broadcast chunk event to skip to not found");
      return;
    }
    const currentPlayback = this.getCurrentPlayback();
    const skipToPlayback = await this.tryGetOrLoadPlaybackForEvent(event);
    const currentPlaybackEvent = this.currentlyPlaying;
    if (!skipToPlayback) {
      _logger.logger.warn("voice broadcast chunk to skip to not found", event);
      return;
    }
    this.currentlyPlaying = event;
    if (currentPlayback && currentPlaybackEvent && currentPlayback !== skipToPlayback) {
      // only stop and unload the playback here without triggering other effects, e.g. play next
      currentPlayback.off(_AsyncStore.UPDATE_EVENT, this.onPlaybackStateChange);
      await currentPlayback.stop();
      currentPlayback.on(_AsyncStore.UPDATE_EVENT, this.onPlaybackStateChange);
      this.unloadPlayback(currentPlaybackEvent);
    }
    const offsetInChunk = time - this.chunkEvents.getLengthTo(event);
    await skipToPlayback.skipTo(offsetInChunk / 1000);
    if (this.state === VoiceBroadcastPlaybackState.Playing && !skipToPlayback.isPlaying) {
      await skipToPlayback.play();
    }
    this.setPosition(time);
  }
  async start() {
    if (this.state === VoiceBroadcastPlaybackState.Playing) return;
    const currentRecording = this.recordings.getCurrent();
    if (currentRecording && currentRecording.getState() !== _.VoiceBroadcastInfoState.Stopped) {
      const shouldStopRecording = await (0, _.showConfirmListenBroadcastStopCurrentDialog)();
      if (!shouldStopRecording) {
        // keep recording
        return;
      }
      await this.recordings.getCurrent()?.stop();
    }
    const chunkEvents = this.chunkEvents.getEvents();
    const toPlay = this.getInfoState() === _.VoiceBroadcastInfoState.Stopped ? chunkEvents[0] // start at the beginning for an ended voice broadcast
    : chunkEvents[chunkEvents.length - 1]; // start at the current chunk for an ongoing voice broadcast

    if (toPlay) {
      return this.playEvent(toPlay);
    }
    this.setState(VoiceBroadcastPlaybackState.Buffering);
  }
  stop() {
    // error is a final state
    if (this.getState() === VoiceBroadcastPlaybackState.Error) return;
    this.setState(VoiceBroadcastPlaybackState.Stopped);
    this.getCurrentPlayback()?.stop();
    this.currentlyPlaying = null;
    this.setPosition(0);
  }
  pause() {
    // error is a final state
    if (this.getState() === VoiceBroadcastPlaybackState.Error) return;

    // stopped voice broadcasts cannot be paused
    if (this.getState() === VoiceBroadcastPlaybackState.Stopped) return;
    this.setState(VoiceBroadcastPlaybackState.Paused);
    this.getCurrentPlayback()?.pause();
  }
  resume() {
    // error is a final state
    if (this.getState() === VoiceBroadcastPlaybackState.Error) return;
    if (!this.currentlyPlaying) {
      // no playback to resume, start from the beginning
      this.start();
      return;
    }
    this.setState(VoiceBroadcastPlaybackState.Playing);
    this.getCurrentPlayback()?.play();
  }

  /**
   * Toggles the playback:
   * stopped → playing
   * playing → paused
   * paused → playing
   */
  async toggle() {
    // error is a final state
    if (this.getState() === VoiceBroadcastPlaybackState.Error) return;
    if (this.state === VoiceBroadcastPlaybackState.Stopped) {
      await this.start();
      return;
    }
    if (this.state === VoiceBroadcastPlaybackState.Paused) {
      this.resume();
      return;
    }
    this.pause();
  }
  getState() {
    return this.state;
  }
  setState(state) {
    if (this.state === state) {
      return;
    }
    this.state = state;
    this.emit(VoiceBroadcastPlaybackEvent.StateChanged, state, this);
  }

  /**
   * Set error state. Stop current playback, if any.
   */
  setError() {
    this.setState(VoiceBroadcastPlaybackState.Error);
    this.getCurrentPlayback()?.stop();
    this.currentlyPlaying = null;
    this.setPosition(0);
  }
  getInfoState() {
    return this.infoState;
  }
  setInfoState(state) {
    if (this.infoState === state) {
      return;
    }
    this.infoState = state;
    this.emit(VoiceBroadcastPlaybackEvent.InfoStateChanged, state);
    this.setLiveness((0, _determineVoiceBroadcastLiveness.determineVoiceBroadcastLiveness)(this.infoState));
  }
  get errorMessage() {
    if (this.getState() !== VoiceBroadcastPlaybackState.Error) return "";
    if (this.utdChunkEvents.size) return (0, _languageHandler._t)("Unable to decrypt voice broadcast");
    return (0, _languageHandler._t)("Unable to play this voice broadcast");
  }
  destroy() {
    for (const [, utdEvent] of this.utdChunkEvents) {
      utdEvent.off(_matrix.MatrixEventEvent.Decrypted, this.onChunkEventDecrypted);
    }
    this.utdChunkEvents.clear();
    this.chunkRelationHelper.destroy();
    this.infoRelationHelper.destroy();
    this.removeAllListeners();
    this.chunkEvents = new _VoiceBroadcastChunkEvents.VoiceBroadcastChunkEvents();
    this.playbacks.forEach(p => p.destroy());
    this.playbacks = new Map();
  }
}
exports.VoiceBroadcastPlayback = VoiceBroadcastPlayback;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfbWF0cml4IiwicmVxdWlyZSIsIl90eXBlZEV2ZW50RW1pdHRlciIsIl9tYXRyaXhXaWRnZXRBcGkiLCJfbG9nZ2VyIiwiX3V0aWxzIiwiX1BsYXliYWNrIiwiX1BsYXliYWNrTWFuYWdlciIsIl9Bc3luY1N0b3JlIiwiX01lZGlhRXZlbnRIZWxwZXIiLCJfIiwiX1JlbGF0aW9uc0hlbHBlciIsIl9Wb2ljZUJyb2FkY2FzdENodW5rRXZlbnRzIiwiX2RldGVybWluZVZvaWNlQnJvYWRjYXN0TGl2ZW5lc3MiLCJfbGFuZ3VhZ2VIYW5kbGVyIiwiVm9pY2VCcm9hZGNhc3RQbGF5YmFja1N0YXRlIiwiZXhwb3J0cyIsIlZvaWNlQnJvYWRjYXN0UGxheWJhY2tFdmVudCIsIlZvaWNlQnJvYWRjYXN0UGxheWJhY2siLCJUeXBlZEV2ZW50RW1pdHRlciIsImNvbnN0cnVjdG9yIiwiaW5mb0V2ZW50IiwiY2xpZW50IiwicmVjb3JkaW5ncyIsIl9kZWZpbmVQcm9wZXJ0eTIiLCJkZWZhdWx0IiwiU3RvcHBlZCIsIlZvaWNlQnJvYWRjYXN0Q2h1bmtFdmVudHMiLCJNYXAiLCJTaW1wbGVPYnNlcnZhYmxlIiwiZXZlbnQiLCJnZXRJZCIsImdldFR4bklkIiwiaXNEZWNyeXB0aW9uRmFpbHVyZSIsIm9uQ2h1bmtFdmVudERlY3J5cHRpb25GYWlsdXJlIiwiZ2V0Q29udGVudCIsIm1zZ3R5cGUiLCJNc2dUeXBlIiwiQXVkaW8iLCJjaHVua0V2ZW50cyIsImFkZEV2ZW50Iiwic2V0RHVyYXRpb24iLCJnZXRMZW5ndGgiLCJnZXRTdGF0ZSIsIkJ1ZmZlcmluZyIsInN0YXJ0T3JQbGF5TmV4dCIsImV2ZW50SWQiLCJsb2dnZXIiLCJ3YXJuIiwiYnJvYWRjYXN0IiwidXRkQ2h1bmtFdmVudHMiLCJoYXMiLCJvbmNlIiwiTWF0cml4RXZlbnRFdmVudCIsIkRlY3J5cHRlZCIsIm9uQ2h1bmtFdmVudERlY3J5cHRlZCIsInNldCIsInNldEVycm9yIiwiZGVsZXRlIiwiYWRkQ2h1bmtFdmVudCIsInNpemUiLCJzZXRTdGF0ZSIsIlBhdXNlZCIsImN1cnJlbnRseVBsYXlpbmciLCJwbGF5TmV4dCIsInN0YXJ0IiwibGFzdEluZm9FdmVudCIsImdldFRzIiwic3RhdGUiLCJPYmplY3QiLCJ2YWx1ZXMiLCJWb2ljZUJyb2FkY2FzdEluZm9TdGF0ZSIsImluY2x1ZGVzIiwic2V0SW5mb1N0YXRlIiwic3RvcCIsImRlc3Ryb3kiLCJwb3NpdGlvbiIsIm5ld1Bvc2l0aW9uIiwiZ2V0TGVuZ3RoVG8iLCJzZXRQb3NpdGlvbiIsIm5ld1N0YXRlIiwiUGxheWJhY2tTdGF0ZSIsInVubG9hZFBsYXliYWNrIiwiYWRkSW5mb0V2ZW50Iiwib24iLCJCZWZvcmVSZWRhY3Rpb24iLCJvbkJlZm9yZVJlZGFjdGlvbiIsInNldFVwUmVsYXRpb25zSGVscGVyIiwiaW5mb1JlbGF0aW9uSGVscGVyIiwiUmVsYXRpb25zSGVscGVyIiwiUmVsYXRpb25UeXBlIiwiUmVmZXJlbmNlIiwiVm9pY2VCcm9hZGNhc3RJbmZvRXZlbnRUeXBlIiwiZ2V0Q3VycmVudCIsImZvckVhY2giLCJpbmZvU3RhdGUiLCJSZWxhdGlvbnNIZWxwZXJFdmVudCIsIkFkZCIsImVtaXRGZXRjaEN1cnJlbnQiLCJlcnIiLCJlbWl0Q3VycmVudCIsImNodW5rUmVsYXRpb25IZWxwZXIiLCJFdmVudFR5cGUiLCJSb29tTWVzc2FnZSIsInRyeUxvYWRQbGF5YmFjayIsImNodW5rRXZlbnQiLCJsb2FkUGxheWJhY2siLCJtZXNzYWdlIiwiYnJvYWRjYXN0SWQiLCJjaHVua0lkIiwiRXJyb3IiLCJoZWxwZXIiLCJNZWRpYUV2ZW50SGVscGVyIiwiYmxvYiIsInNvdXJjZUJsb2IiLCJ2YWx1ZSIsImJ1ZmZlciIsImFycmF5QnVmZmVyIiwicGxheWJhY2siLCJQbGF5YmFja01hbmFnZXIiLCJpbnN0YW5jZSIsImNyZWF0ZVBsYXliYWNrSW5zdGFuY2UiLCJwcmVwYXJlIiwiY2xvY2tJbmZvIiwicG9wdWxhdGVQbGFjZWhvbGRlcnNGcm9tIiwicGxheWJhY2tzIiwiVVBEQVRFX0VWRU5UIiwib25QbGF5YmFja1N0YXRlQ2hhbmdlIiwibGl2ZURhdGEiLCJvblVwZGF0ZSIsIl9yZWYiLCJvblBsYXliYWNrUG9zaXRpb25VcGRhdGUiLCJnZXQiLCJkdXJhdGlvbiIsImVtaXRUaW1lc0NoYW5nZWQiLCJ1cGRhdGUiLCJ0aW1lU2Vjb25kcyIsImR1cmF0aW9uU2Vjb25kcyIsImVtaXQiLCJUaW1lc0NoYW5nZWQiLCJ0aW1lTGVmdCIsInRpbWVMZWZ0U2Vjb25kcyIsIm5leHQiLCJnZXROZXh0IiwicGxheUV2ZW50IiwiZ2V0SW5mb1N0YXRlIiwiZ2V0U2VxdWVuY2VGb3JFdmVudCIsImxhc3RDaHVua1NlcXVlbmNlIiwibGFzdF9jaHVua19zZXF1ZW5jZSIsImdldE51bWJlck9mRXZlbnRzIiwiUGxheWluZyIsInRyeUdldE9yTG9hZFBsYXliYWNrRm9yRXZlbnQiLCJwbGF5IiwiZ2V0T3JMb2FkUGxheWJhY2tGb3JFdmVudCIsImN1cnJlbnRTdGF0ZSIsIm5leHRFdmVudCIsImdldEN1cnJlbnRQbGF5YmFjayIsImdldExpdmVuZXNzIiwibGl2ZW5lc3MiLCJzZXRMaXZlbmVzcyIsIkxpdmVuZXNzQ2hhbmdlZCIsIk1hdGgiLCJtYXgiLCJyb3VuZCIsInNraXBUbyIsInNraXBUb05leHQiLCJza2lwVG9EZWZlcnJlZCIsInByb21pc2UiLCJkZWZlciIsInVuZGVmaW5lZCIsImRvU2tpcFRvIiwicmVzb2x2ZSIsInRpbWUiLCJmaW5kQnlUaW1lIiwiY3VycmVudFBsYXliYWNrIiwic2tpcFRvUGxheWJhY2siLCJjdXJyZW50UGxheWJhY2tFdmVudCIsIm9mZiIsIm9mZnNldEluQ2h1bmsiLCJpc1BsYXlpbmciLCJjdXJyZW50UmVjb3JkaW5nIiwic2hvdWxkU3RvcFJlY29yZGluZyIsInNob3dDb25maXJtTGlzdGVuQnJvYWRjYXN0U3RvcEN1cnJlbnREaWFsb2ciLCJnZXRFdmVudHMiLCJ0b1BsYXkiLCJsZW5ndGgiLCJwYXVzZSIsInJlc3VtZSIsInRvZ2dsZSIsIlN0YXRlQ2hhbmdlZCIsIkluZm9TdGF0ZUNoYW5nZWQiLCJkZXRlcm1pbmVWb2ljZUJyb2FkY2FzdExpdmVuZXNzIiwiZXJyb3JNZXNzYWdlIiwiX3QiLCJ1dGRFdmVudCIsImNsZWFyIiwicmVtb3ZlQWxsTGlzdGVuZXJzIiwicCJdLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy92b2ljZS1icm9hZGNhc3QvbW9kZWxzL1ZvaWNlQnJvYWRjYXN0UGxheWJhY2sudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbkNvcHlyaWdodCAyMDIyIFRoZSBNYXRyaXgub3JnIEZvdW5kYXRpb24gQy5JLkMuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuKi9cblxuaW1wb3J0IHtcbiAgICBFdmVudFR5cGUsXG4gICAgTWF0cml4Q2xpZW50LFxuICAgIE1hdHJpeEV2ZW50LFxuICAgIE1hdHJpeEV2ZW50RXZlbnQsXG4gICAgTXNnVHlwZSxcbiAgICBSZWxhdGlvblR5cGUsXG59IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9tYXRyaXhcIjtcbmltcG9ydCB7IFR5cGVkRXZlbnRFbWl0dGVyIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL21vZGVscy90eXBlZC1ldmVudC1lbWl0dGVyXCI7XG5pbXBvcnQgeyBTaW1wbGVPYnNlcnZhYmxlIH0gZnJvbSBcIm1hdHJpeC13aWRnZXQtYXBpXCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbG9nZ2VyXCI7XG5pbXBvcnQgeyBkZWZlciwgSURlZmVycmVkIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL3V0aWxzXCI7XG5cbmltcG9ydCB7IFBsYXliYWNrLCBQbGF5YmFja0ludGVyZmFjZSwgUGxheWJhY2tTdGF0ZSB9IGZyb20gXCIuLi8uLi9hdWRpby9QbGF5YmFja1wiO1xuaW1wb3J0IHsgUGxheWJhY2tNYW5hZ2VyIH0gZnJvbSBcIi4uLy4uL2F1ZGlvL1BsYXliYWNrTWFuYWdlclwiO1xuaW1wb3J0IHsgVVBEQVRFX0VWRU5UIH0gZnJvbSBcIi4uLy4uL3N0b3Jlcy9Bc3luY1N0b3JlXCI7XG5pbXBvcnQgeyBNZWRpYUV2ZW50SGVscGVyIH0gZnJvbSBcIi4uLy4uL3V0aWxzL01lZGlhRXZlbnRIZWxwZXJcIjtcbmltcG9ydCB7IElEZXN0cm95YWJsZSB9IGZyb20gXCIuLi8uLi91dGlscy9JRGVzdHJveWFibGVcIjtcbmltcG9ydCB7XG4gICAgVm9pY2VCcm9hZGNhc3RMaXZlbmVzcyxcbiAgICBWb2ljZUJyb2FkY2FzdEluZm9FdmVudFR5cGUsXG4gICAgVm9pY2VCcm9hZGNhc3RJbmZvU3RhdGUsXG4gICAgVm9pY2VCcm9hZGNhc3RJbmZvRXZlbnRDb250ZW50LFxuICAgIFZvaWNlQnJvYWRjYXN0UmVjb3JkaW5nc1N0b3JlLFxuICAgIHNob3dDb25maXJtTGlzdGVuQnJvYWRjYXN0U3RvcEN1cnJlbnREaWFsb2csXG59IGZyb20gXCIuLlwiO1xuaW1wb3J0IHsgUmVsYXRpb25zSGVscGVyLCBSZWxhdGlvbnNIZWxwZXJFdmVudCB9IGZyb20gXCIuLi8uLi9ldmVudHMvUmVsYXRpb25zSGVscGVyXCI7XG5pbXBvcnQgeyBWb2ljZUJyb2FkY2FzdENodW5rRXZlbnRzIH0gZnJvbSBcIi4uL3V0aWxzL1ZvaWNlQnJvYWRjYXN0Q2h1bmtFdmVudHNcIjtcbmltcG9ydCB7IGRldGVybWluZVZvaWNlQnJvYWRjYXN0TGl2ZW5lc3MgfSBmcm9tIFwiLi4vdXRpbHMvZGV0ZXJtaW5lVm9pY2VCcm9hZGNhc3RMaXZlbmVzc1wiO1xuaW1wb3J0IHsgX3QgfSBmcm9tIFwiLi4vLi4vbGFuZ3VhZ2VIYW5kbGVyXCI7XG5cbmV4cG9ydCBlbnVtIFZvaWNlQnJvYWRjYXN0UGxheWJhY2tTdGF0ZSB7XG4gICAgUGF1c2VkID0gXCJwYXVzZVwiLFxuICAgIFBsYXlpbmcgPSBcInBsYXlpbmdcIixcbiAgICBTdG9wcGVkID0gXCJzdG9wcGVkXCIsXG4gICAgQnVmZmVyaW5nID0gXCJidWZmZXJpbmdcIixcbiAgICBFcnJvciA9IFwiZXJyb3JcIixcbn1cblxuZXhwb3J0IGVudW0gVm9pY2VCcm9hZGNhc3RQbGF5YmFja0V2ZW50IHtcbiAgICBUaW1lc0NoYW5nZWQgPSBcInRpbWVzX2NoYW5nZWRcIixcbiAgICBMaXZlbmVzc0NoYW5nZWQgPSBcImxpdmVuZXNzX2NoYW5nZWRcIixcbiAgICBTdGF0ZUNoYW5nZWQgPSBcInN0YXRlX2NoYW5nZWRcIixcbiAgICBJbmZvU3RhdGVDaGFuZ2VkID0gXCJpbmZvX3N0YXRlX2NoYW5nZWRcIixcbn1cblxuZXhwb3J0IHR5cGUgVm9pY2VCcm9hZGNhc3RQbGF5YmFja1RpbWVzID0ge1xuICAgIGR1cmF0aW9uOiBudW1iZXI7XG4gICAgcG9zaXRpb246IG51bWJlcjtcbiAgICB0aW1lTGVmdDogbnVtYmVyO1xufTtcblxuaW50ZXJmYWNlIEV2ZW50TWFwIHtcbiAgICBbVm9pY2VCcm9hZGNhc3RQbGF5YmFja0V2ZW50LlRpbWVzQ2hhbmdlZF06ICh0aW1lczogVm9pY2VCcm9hZGNhc3RQbGF5YmFja1RpbWVzKSA9PiB2b2lkO1xuICAgIFtWb2ljZUJyb2FkY2FzdFBsYXliYWNrRXZlbnQuTGl2ZW5lc3NDaGFuZ2VkXTogKGxpdmVuZXNzOiBWb2ljZUJyb2FkY2FzdExpdmVuZXNzKSA9PiB2b2lkO1xuICAgIFtWb2ljZUJyb2FkY2FzdFBsYXliYWNrRXZlbnQuU3RhdGVDaGFuZ2VkXTogKFxuICAgICAgICBzdGF0ZTogVm9pY2VCcm9hZGNhc3RQbGF5YmFja1N0YXRlLFxuICAgICAgICBwbGF5YmFjazogVm9pY2VCcm9hZGNhc3RQbGF5YmFjayxcbiAgICApID0+IHZvaWQ7XG4gICAgW1ZvaWNlQnJvYWRjYXN0UGxheWJhY2tFdmVudC5JbmZvU3RhdGVDaGFuZ2VkXTogKHN0YXRlOiBWb2ljZUJyb2FkY2FzdEluZm9TdGF0ZSkgPT4gdm9pZDtcbn1cblxuZXhwb3J0IGNsYXNzIFZvaWNlQnJvYWRjYXN0UGxheWJhY2tcbiAgICBleHRlbmRzIFR5cGVkRXZlbnRFbWl0dGVyPFZvaWNlQnJvYWRjYXN0UGxheWJhY2tFdmVudCwgRXZlbnRNYXA+XG4gICAgaW1wbGVtZW50cyBJRGVzdHJveWFibGUsIFBsYXliYWNrSW50ZXJmYWNlXG57XG4gICAgcHJpdmF0ZSBzdGF0ZSA9IFZvaWNlQnJvYWRjYXN0UGxheWJhY2tTdGF0ZS5TdG9wcGVkO1xuICAgIHByaXZhdGUgY2h1bmtFdmVudHMgPSBuZXcgVm9pY2VCcm9hZGNhc3RDaHVua0V2ZW50cygpO1xuICAgIC8qKiBAdmFyIE1hcDogZXZlbnQgSWQg4oaSIHVuZGVjcnlwdGFibGUgZXZlbnQgKi9cbiAgICBwcml2YXRlIHV0ZENodW5rRXZlbnRzOiBNYXA8c3RyaW5nLCBNYXRyaXhFdmVudD4gPSBuZXcgTWFwKCk7XG4gICAgcHJpdmF0ZSBwbGF5YmFja3MgPSBuZXcgTWFwPHN0cmluZywgUGxheWJhY2s+KCk7XG4gICAgcHJpdmF0ZSBjdXJyZW50bHlQbGF5aW5nOiBNYXRyaXhFdmVudCB8IG51bGwgPSBudWxsO1xuICAgIC8qKiBAdmFyIHRvdGFsIGR1cmF0aW9uIG9mIGFsbCBjaHVua3MgaW4gbWlsbGlzZWNvbmRzICovXG4gICAgcHJpdmF0ZSBkdXJhdGlvbiA9IDA7XG4gICAgLyoqIEB2YXIgY3VycmVudCBwbGF5YmFjayBwb3NpdGlvbiBpbiBtaWxsaXNlY29uZHMgKi9cbiAgICBwcml2YXRlIHBvc2l0aW9uID0gMDtcbiAgICBwdWJsaWMgcmVhZG9ubHkgbGl2ZURhdGEgPSBuZXcgU2ltcGxlT2JzZXJ2YWJsZTxudW1iZXJbXT4oKTtcbiAgICBwcml2YXRlIGxpdmVuZXNzOiBWb2ljZUJyb2FkY2FzdExpdmVuZXNzID0gXCJub3QtbGl2ZVwiO1xuXG4gICAgLy8gc2V0IHZpYSBhZGRJbmZvRXZlbnQoKSBpbiBjb25zdHJ1Y3RvclxuICAgIHByaXZhdGUgaW5mb1N0YXRlITogVm9pY2VCcm9hZGNhc3RJbmZvU3RhdGU7XG4gICAgcHJpdmF0ZSBsYXN0SW5mb0V2ZW50ITogTWF0cml4RXZlbnQ7XG5cbiAgICAvLyBzZXQgdmlhIHNldFVwUmVsYXRpb25zSGVscGVyKCkgaW4gY29uc3RydWN0b3JcbiAgICBwcml2YXRlIGNodW5rUmVsYXRpb25IZWxwZXIhOiBSZWxhdGlvbnNIZWxwZXI7XG4gICAgcHJpdmF0ZSBpbmZvUmVsYXRpb25IZWxwZXIhOiBSZWxhdGlvbnNIZWxwZXI7XG5cbiAgICBwcml2YXRlIHNraXBUb05leHQ/OiBudW1iZXI7XG4gICAgcHJpdmF0ZSBza2lwVG9EZWZlcnJlZD86IElEZWZlcnJlZDx2b2lkPjtcblxuICAgIHB1YmxpYyBjb25zdHJ1Y3RvcihcbiAgICAgICAgcHVibGljIHJlYWRvbmx5IGluZm9FdmVudDogTWF0cml4RXZlbnQsXG4gICAgICAgIHByaXZhdGUgY2xpZW50OiBNYXRyaXhDbGllbnQsXG4gICAgICAgIHByaXZhdGUgcmVjb3JkaW5nczogVm9pY2VCcm9hZGNhc3RSZWNvcmRpbmdzU3RvcmUsXG4gICAgKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuYWRkSW5mb0V2ZW50KHRoaXMuaW5mb0V2ZW50KTtcbiAgICAgICAgdGhpcy5pbmZvRXZlbnQub24oTWF0cml4RXZlbnRFdmVudC5CZWZvcmVSZWRhY3Rpb24sIHRoaXMub25CZWZvcmVSZWRhY3Rpb24pO1xuICAgICAgICB0aGlzLnNldFVwUmVsYXRpb25zSGVscGVyKCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRVcFJlbGF0aW9uc0hlbHBlcigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgdGhpcy5pbmZvUmVsYXRpb25IZWxwZXIgPSBuZXcgUmVsYXRpb25zSGVscGVyKFxuICAgICAgICAgICAgdGhpcy5pbmZvRXZlbnQsXG4gICAgICAgICAgICBSZWxhdGlvblR5cGUuUmVmZXJlbmNlLFxuICAgICAgICAgICAgVm9pY2VCcm9hZGNhc3RJbmZvRXZlbnRUeXBlLFxuICAgICAgICAgICAgdGhpcy5jbGllbnQsXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMuaW5mb1JlbGF0aW9uSGVscGVyLmdldEN1cnJlbnQoKS5mb3JFYWNoKHRoaXMuYWRkSW5mb0V2ZW50KTtcblxuICAgICAgICBpZiAodGhpcy5pbmZvU3RhdGUgIT09IFZvaWNlQnJvYWRjYXN0SW5mb1N0YXRlLlN0b3BwZWQpIHtcbiAgICAgICAgICAgIC8vIE9ubHkgcmVxdWlyZWQgaWYgbm90IHN0b3BwZWQuIFN0b3BwZWQgaXMgdGhlIGZpbmFsIHN0YXRlLlxuICAgICAgICAgICAgdGhpcy5pbmZvUmVsYXRpb25IZWxwZXIub24oUmVsYXRpb25zSGVscGVyRXZlbnQuQWRkLCB0aGlzLmFkZEluZm9FdmVudCk7XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5pbmZvUmVsYXRpb25IZWxwZXIuZW1pdEZldGNoQ3VycmVudCgpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLndhcm4oXCJlcnJvciBmZXRjaGluZyBzZXJ2ZXIgc2lkZSByZWxhdGlvbiBmb3Igdm9pY2UgYnJvYWRjYXN0IGluZm9cIiwgZXJyKTtcbiAgICAgICAgICAgICAgICAvLyBmYWxsIGJhY2sgdG8gbG9jYWwgZXZlbnRzXG4gICAgICAgICAgICAgICAgdGhpcy5pbmZvUmVsYXRpb25IZWxwZXIuZW1pdEN1cnJlbnQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY2h1bmtSZWxhdGlvbkhlbHBlciA9IG5ldyBSZWxhdGlvbnNIZWxwZXIoXG4gICAgICAgICAgICB0aGlzLmluZm9FdmVudCxcbiAgICAgICAgICAgIFJlbGF0aW9uVHlwZS5SZWZlcmVuY2UsXG4gICAgICAgICAgICBFdmVudFR5cGUuUm9vbU1lc3NhZ2UsXG4gICAgICAgICAgICB0aGlzLmNsaWVudCxcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5jaHVua1JlbGF0aW9uSGVscGVyLm9uKFJlbGF0aW9uc0hlbHBlckV2ZW50LkFkZCwgdGhpcy5hZGRDaHVua0V2ZW50KTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gVE9ETyBNaWNoYWVsIFc6IG9ubHkgZmV0Y2ggZXZlbnRzIGlmIG5lZWRlZCwgYmxvY2tlZCBieSBQU0YtMTcwOFxuICAgICAgICAgICAgYXdhaXQgdGhpcy5jaHVua1JlbGF0aW9uSGVscGVyLmVtaXRGZXRjaEN1cnJlbnQoKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBsb2dnZXIud2FybihcImVycm9yIGZldGNoaW5nIHNlcnZlciBzaWRlIHJlbGF0aW9uIGZvciB2b2ljZSBicm9hZGNhc3QgY2h1bmtzXCIsIGVycik7XG4gICAgICAgICAgICAvLyBmYWxsIGJhY2sgdG8gbG9jYWwgZXZlbnRzXG4gICAgICAgICAgICB0aGlzLmNodW5rUmVsYXRpb25IZWxwZXIuZW1pdEN1cnJlbnQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYWRkQ2h1bmtFdmVudCA9IGFzeW5jIChldmVudDogTWF0cml4RXZlbnQpOiBQcm9taXNlPGJvb2xlYW4+ID0+IHtcbiAgICAgICAgaWYgKCFldmVudC5nZXRJZCgpICYmICFldmVudC5nZXRUeG5JZCgpKSB7XG4gICAgICAgICAgICAvLyBza2lwIGV2ZW50cyB3aXRob3V0IGlkIGFuZCB0eG4gaWRcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChldmVudC5pc0RlY3J5cHRpb25GYWlsdXJlKCkpIHtcbiAgICAgICAgICAgIHRoaXMub25DaHVua0V2ZW50RGVjcnlwdGlvbkZhaWx1cmUoZXZlbnQpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGV2ZW50LmdldENvbnRlbnQoKT8ubXNndHlwZSAhPT0gTXNnVHlwZS5BdWRpbykge1xuICAgICAgICAgICAgLy8gc2tpcCBub24tYXVkaW8gZXZlbnRcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY2h1bmtFdmVudHMuYWRkRXZlbnQoZXZlbnQpO1xuICAgICAgICB0aGlzLnNldER1cmF0aW9uKHRoaXMuY2h1bmtFdmVudHMuZ2V0TGVuZ3RoKCkpO1xuXG4gICAgICAgIGlmICh0aGlzLmdldFN0YXRlKCkgPT09IFZvaWNlQnJvYWRjYXN0UGxheWJhY2tTdGF0ZS5CdWZmZXJpbmcpIHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc3RhcnRPclBsYXlOZXh0KCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBvbkNodW5rRXZlbnREZWNyeXB0aW9uRmFpbHVyZSA9IChldmVudDogTWF0cml4RXZlbnQpOiB2b2lkID0+IHtcbiAgICAgICAgY29uc3QgZXZlbnRJZCA9IGV2ZW50LmdldElkKCk7XG5cbiAgICAgICAgaWYgKCFldmVudElkKSB7XG4gICAgICAgICAgICAvLyBUaGlzIHNob3VsZCBub3QgaGFwcGVuLCBhcyB0aGUgZXhpc3RlbmNlIG9mIHRoZSBJZCBpcyBjaGVja2VkIGJlZm9yZSB0aGUgY2FsbC5cbiAgICAgICAgICAgIC8vIExvZyBhbnl3YXkgYW5kIHJldHVybi5cbiAgICAgICAgICAgIGxvZ2dlci53YXJuKFwiQnJvYWRjYXN0IGNodW5rIGRlY3J5cHRpb24gZmFpbHVyZSBmb3IgZXZlbnQgd2l0aG91dCBJZFwiLCB7XG4gICAgICAgICAgICAgICAgYnJvYWRjYXN0OiB0aGlzLmluZm9FdmVudC5nZXRJZCgpLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMudXRkQ2h1bmtFdmVudHMuaGFzKGV2ZW50SWQpKSB7XG4gICAgICAgICAgICBldmVudC5vbmNlKE1hdHJpeEV2ZW50RXZlbnQuRGVjcnlwdGVkLCB0aGlzLm9uQ2h1bmtFdmVudERlY3J5cHRlZCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnV0ZENodW5rRXZlbnRzLnNldChldmVudElkLCBldmVudCk7XG4gICAgICAgIHRoaXMuc2V0RXJyb3IoKTtcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBvbkNodW5rRXZlbnREZWNyeXB0ZWQgPSBhc3luYyAoZXZlbnQ6IE1hdHJpeEV2ZW50KTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICAgIGNvbnN0IGV2ZW50SWQgPSBldmVudC5nZXRJZCgpO1xuXG4gICAgICAgIGlmICghZXZlbnRJZCkge1xuICAgICAgICAgICAgLy8gVGhpcyBzaG91bGQgbm90IGhhcHBlbiwgYXMgdGhlIGV4aXN0ZW5jZSBvZiB0aGUgSWQgaXMgY2hlY2tlZCBiZWZvcmUgdGhlIGNhbGwuXG4gICAgICAgICAgICAvLyBMb2cgYW55d2F5IGFuZCByZXR1cm4uXG4gICAgICAgICAgICBsb2dnZXIud2FybihcIkJyb2FkY2FzdCBjaHVuayBkZWNyeXB0ZWQgZm9yIGV2ZW50IHdpdGhvdXQgSWRcIiwgeyBicm9hZGNhc3Q6IHRoaXMuaW5mb0V2ZW50LmdldElkKCkgfSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnV0ZENodW5rRXZlbnRzLmRlbGV0ZShldmVudElkKTtcbiAgICAgICAgYXdhaXQgdGhpcy5hZGRDaHVua0V2ZW50KGV2ZW50KTtcblxuICAgICAgICBpZiAodGhpcy51dGRDaHVua0V2ZW50cy5zaXplID09PSAwKSB7XG4gICAgICAgICAgICAvLyBubyBtb3JlIFVURCBldmVudHMsIHJlY292ZXIgZnJvbSBlcnJvciB0byBwYXVzZWRcbiAgICAgICAgICAgIHRoaXMuc2V0U3RhdGUoVm9pY2VCcm9hZGNhc3RQbGF5YmFja1N0YXRlLlBhdXNlZCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBzdGFydE9yUGxheU5leHQgPSBhc3luYyAoKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICAgIGlmICh0aGlzLmN1cnJlbnRseVBsYXlpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBsYXlOZXh0KCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5zdGFydCgpO1xuICAgIH07XG5cbiAgICBwcml2YXRlIGFkZEluZm9FdmVudCA9IChldmVudDogTWF0cml4RXZlbnQpOiB2b2lkID0+IHtcbiAgICAgICAgaWYgKHRoaXMubGFzdEluZm9FdmVudCAmJiB0aGlzLmxhc3RJbmZvRXZlbnQuZ2V0VHMoKSA+PSBldmVudC5nZXRUcygpKSB7XG4gICAgICAgICAgICAvLyBPbmx5IGhhbmRsZSBuZXdlciBldmVudHNcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHN0YXRlID0gZXZlbnQuZ2V0Q29udGVudCgpPy5zdGF0ZTtcblxuICAgICAgICBpZiAoIU9iamVjdC52YWx1ZXMoVm9pY2VCcm9hZGNhc3RJbmZvU3RhdGUpLmluY2x1ZGVzKHN0YXRlKSkge1xuICAgICAgICAgICAgLy8gRG8gbm90IGhhbmRsZSB1bmtub3duIHZvaWNlIGJyb2FkY2FzdCBzdGF0ZXNcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubGFzdEluZm9FdmVudCA9IGV2ZW50O1xuICAgICAgICB0aGlzLnNldEluZm9TdGF0ZShzdGF0ZSk7XG4gICAgfTtcblxuICAgIHByaXZhdGUgb25CZWZvcmVSZWRhY3Rpb24gPSAoKTogdm9pZCA9PiB7XG4gICAgICAgIGlmICh0aGlzLmdldFN0YXRlKCkgIT09IFZvaWNlQnJvYWRjYXN0UGxheWJhY2tTdGF0ZS5TdG9wcGVkKSB7XG4gICAgICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICAgICAgICAgIC8vIGRlc3Ryb3kgY2xlYW5zIHVwIGV2ZXJ5dGhpbmdcbiAgICAgICAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHByaXZhdGUgYXN5bmMgdHJ5TG9hZFBsYXliYWNrKGNodW5rRXZlbnQ6IE1hdHJpeEV2ZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5sb2FkUGxheWJhY2soY2h1bmtFdmVudCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICBsb2dnZXIud2FybihcIlVuYWJsZSB0byBsb2FkIGJyb2FkY2FzdCBwbGF5YmFja1wiLCB7XG4gICAgICAgICAgICAgICAgbWVzc2FnZTogZXJyLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgYnJvYWRjYXN0SWQ6IHRoaXMuaW5mb0V2ZW50LmdldElkKCksXG4gICAgICAgICAgICAgICAgY2h1bmtJZDogY2h1bmtFdmVudC5nZXRJZCgpLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aGlzLnNldEVycm9yKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGxvYWRQbGF5YmFjayhjaHVua0V2ZW50OiBNYXRyaXhFdmVudCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCBldmVudElkID0gY2h1bmtFdmVudC5nZXRJZCgpO1xuXG4gICAgICAgIGlmICghZXZlbnRJZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQnJvYWRjYXN0IGNodW5rIGV2ZW50IHdpdGhvdXQgSWQgb2NjdXJyZWRcIik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBoZWxwZXIgPSBuZXcgTWVkaWFFdmVudEhlbHBlcihjaHVua0V2ZW50KTtcbiAgICAgICAgY29uc3QgYmxvYiA9IGF3YWl0IGhlbHBlci5zb3VyY2VCbG9iLnZhbHVlO1xuICAgICAgICBjb25zdCBidWZmZXIgPSBhd2FpdCBibG9iLmFycmF5QnVmZmVyKCk7XG4gICAgICAgIGNvbnN0IHBsYXliYWNrID0gUGxheWJhY2tNYW5hZ2VyLmluc3RhbmNlLmNyZWF0ZVBsYXliYWNrSW5zdGFuY2UoYnVmZmVyKTtcbiAgICAgICAgYXdhaXQgcGxheWJhY2sucHJlcGFyZSgpO1xuICAgICAgICBwbGF5YmFjay5jbG9ja0luZm8ucG9wdWxhdGVQbGFjZWhvbGRlcnNGcm9tKGNodW5rRXZlbnQpO1xuICAgICAgICB0aGlzLnBsYXliYWNrcy5zZXQoZXZlbnRJZCwgcGxheWJhY2spO1xuICAgICAgICBwbGF5YmFjay5vbihVUERBVEVfRVZFTlQsIChzdGF0ZSkgPT4gdGhpcy5vblBsYXliYWNrU3RhdGVDaGFuZ2UoY2h1bmtFdmVudCwgc3RhdGUpKTtcbiAgICAgICAgcGxheWJhY2suY2xvY2tJbmZvLmxpdmVEYXRhLm9uVXBkYXRlKChbcG9zaXRpb25dKSA9PiB7XG4gICAgICAgICAgICB0aGlzLm9uUGxheWJhY2tQb3NpdGlvblVwZGF0ZShjaHVua0V2ZW50LCBwb3NpdGlvbik7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgdW5sb2FkUGxheWJhY2soZXZlbnQ6IE1hdHJpeEV2ZW50KTogdm9pZCB7XG4gICAgICAgIGNvbnN0IHBsYXliYWNrID0gdGhpcy5wbGF5YmFja3MuZ2V0KGV2ZW50LmdldElkKCkhKTtcbiAgICAgICAgaWYgKCFwbGF5YmFjaykgcmV0dXJuO1xuXG4gICAgICAgIHBsYXliYWNrLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5wbGF5YmFja3MuZGVsZXRlKGV2ZW50LmdldElkKCkhKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIG9uUGxheWJhY2tQb3NpdGlvblVwZGF0ZSA9IChldmVudDogTWF0cml4RXZlbnQsIHBvc2l0aW9uOiBudW1iZXIpOiB2b2lkID0+IHtcbiAgICAgICAgaWYgKGV2ZW50ICE9PSB0aGlzLmN1cnJlbnRseVBsYXlpbmcpIHJldHVybjtcblxuICAgICAgICBjb25zdCBuZXdQb3NpdGlvbiA9IHRoaXMuY2h1bmtFdmVudHMuZ2V0TGVuZ3RoVG8oZXZlbnQpICsgcG9zaXRpb24gKiAxMDAwOyAvLyBvYnNlcnZhYmxlIHNlbmRzIHNlY29uZHNcblxuICAgICAgICAvLyBkbyBub3QganVtcCBiYWNrd2FyZHMgLSB0aGlzIGNhbiBoYXBwZW4gd2hlbiB0cmFuc2l0aW5nIGZyb20gb25lIHRvIGFub3RoZXIgY2h1bmtcbiAgICAgICAgaWYgKG5ld1Bvc2l0aW9uIDwgdGhpcy5wb3NpdGlvbikgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuc2V0UG9zaXRpb24obmV3UG9zaXRpb24pO1xuICAgIH07XG5cbiAgICBwcml2YXRlIHNldER1cmF0aW9uKGR1cmF0aW9uOiBudW1iZXIpOiB2b2lkIHtcbiAgICAgICAgaWYgKHRoaXMuZHVyYXRpb24gPT09IGR1cmF0aW9uKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5kdXJhdGlvbiA9IGR1cmF0aW9uO1xuICAgICAgICB0aGlzLmVtaXRUaW1lc0NoYW5nZWQoKTtcbiAgICAgICAgdGhpcy5saXZlRGF0YS51cGRhdGUoW3RoaXMudGltZVNlY29uZHMsIHRoaXMuZHVyYXRpb25TZWNvbmRzXSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzZXRQb3NpdGlvbihwb3NpdGlvbjogbnVtYmVyKTogdm9pZCB7XG4gICAgICAgIGlmICh0aGlzLnBvc2l0aW9uID09PSBwb3NpdGlvbikgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMucG9zaXRpb24gPSBwb3NpdGlvbjtcbiAgICAgICAgdGhpcy5lbWl0VGltZXNDaGFuZ2VkKCk7XG4gICAgICAgIHRoaXMubGl2ZURhdGEudXBkYXRlKFt0aGlzLnRpbWVTZWNvbmRzLCB0aGlzLmR1cmF0aW9uU2Vjb25kc10pO1xuICAgIH1cblxuICAgIHByaXZhdGUgZW1pdFRpbWVzQ2hhbmdlZCgpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5lbWl0KFZvaWNlQnJvYWRjYXN0UGxheWJhY2tFdmVudC5UaW1lc0NoYW5nZWQsIHtcbiAgICAgICAgICAgIGR1cmF0aW9uOiB0aGlzLmR1cmF0aW9uU2Vjb25kcyxcbiAgICAgICAgICAgIHBvc2l0aW9uOiB0aGlzLnRpbWVTZWNvbmRzLFxuICAgICAgICAgICAgdGltZUxlZnQ6IHRoaXMudGltZUxlZnRTZWNvbmRzLFxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIG9uUGxheWJhY2tTdGF0ZUNoYW5nZSA9IGFzeW5jIChldmVudDogTWF0cml4RXZlbnQsIG5ld1N0YXRlOiBQbGF5YmFja1N0YXRlKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICAgIGlmIChldmVudCAhPT0gdGhpcy5jdXJyZW50bHlQbGF5aW5nKSByZXR1cm47XG4gICAgICAgIGlmIChuZXdTdGF0ZSAhPT0gUGxheWJhY2tTdGF0ZS5TdG9wcGVkKSByZXR1cm47XG5cbiAgICAgICAgYXdhaXQgdGhpcy5wbGF5TmV4dCgpO1xuICAgICAgICB0aGlzLnVubG9hZFBsYXliYWNrKGV2ZW50KTtcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBhc3luYyBwbGF5TmV4dCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnRseVBsYXlpbmcpIHJldHVybjtcblxuICAgICAgICBjb25zdCBuZXh0ID0gdGhpcy5jaHVua0V2ZW50cy5nZXROZXh0KHRoaXMuY3VycmVudGx5UGxheWluZyk7XG5cbiAgICAgICAgaWYgKG5leHQpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBsYXlFdmVudChuZXh0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChcbiAgICAgICAgICAgIHRoaXMuZ2V0SW5mb1N0YXRlKCkgPT09IFZvaWNlQnJvYWRjYXN0SW5mb1N0YXRlLlN0b3BwZWQgJiZcbiAgICAgICAgICAgIHRoaXMuY2h1bmtFdmVudHMuZ2V0U2VxdWVuY2VGb3JFdmVudCh0aGlzLmN1cnJlbnRseVBsYXlpbmcpID09PSB0aGlzLmxhc3RDaHVua1NlcXVlbmNlXG4gICAgICAgICkge1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBObyBtb3JlIGNodW5rcyBhdmFpbGFibGUsIGFsdGhvdWdoIHRoZSBicm9hZGNhc3QgaXMgbm90IGZpbmlzaGVkIOKGkiBlbnRlciBidWZmZXJpbmcgc3RhdGUuXG4gICAgICAgICAgICB0aGlzLnNldFN0YXRlKFZvaWNlQnJvYWRjYXN0UGxheWJhY2tTdGF0ZS5CdWZmZXJpbmcpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIGxhc3QgY2h1bmsgc2VxdWVuY2UgZnJvbSB0aGUgbGF0ZXN0IGluZm8gZXZlbnQuXG4gICAgICogICAgICAgICAgICAgICAgICAgRmFsbHMgYmFjayB0byB0aGUgbGVuZ3RoIG9mIHJlY2VpdmVkIGNodW5rcyBpZiB0aGUgaW5mbyBldmVudCBkb2VzIG5vdCBwcm92aWRlIHRoZSBudW1iZXIuXG4gICAgICovXG4gICAgcHJpdmF0ZSBnZXQgbGFzdENodW5rU2VxdWVuY2UoKTogbnVtYmVyIHtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIHRoaXMubGFzdEluZm9FdmVudC5nZXRDb250ZW50PFZvaWNlQnJvYWRjYXN0SW5mb0V2ZW50Q29udGVudD4oKT8ubGFzdF9jaHVua19zZXF1ZW5jZSB8fFxuICAgICAgICAgICAgdGhpcy5jaHVua0V2ZW50cy5nZXROdW1iZXJPZkV2ZW50cygpXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBwbGF5RXZlbnQoZXZlbnQ6IE1hdHJpeEV2ZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIHRoaXMuc2V0U3RhdGUoVm9pY2VCcm9hZGNhc3RQbGF5YmFja1N0YXRlLlBsYXlpbmcpO1xuICAgICAgICB0aGlzLmN1cnJlbnRseVBsYXlpbmcgPSBldmVudDtcbiAgICAgICAgY29uc3QgcGxheWJhY2sgPSBhd2FpdCB0aGlzLnRyeUdldE9yTG9hZFBsYXliYWNrRm9yRXZlbnQoZXZlbnQpO1xuICAgICAgICBwbGF5YmFjaz8ucGxheSgpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgdHJ5R2V0T3JMb2FkUGxheWJhY2tGb3JFdmVudChldmVudDogTWF0cml4RXZlbnQpOiBQcm9taXNlPFBsYXliYWNrIHwgdW5kZWZpbmVkPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5nZXRPckxvYWRQbGF5YmFja0ZvckV2ZW50KGV2ZW50KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIGxvZ2dlci53YXJuKFwiVW5hYmxlIHRvIGxvYWQgYnJvYWRjYXN0IHBsYXliYWNrXCIsIHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBlcnIubWVzc2FnZSxcbiAgICAgICAgICAgICAgICBicm9hZGNhc3RJZDogdGhpcy5pbmZvRXZlbnQuZ2V0SWQoKSxcbiAgICAgICAgICAgICAgICBjaHVua0lkOiBldmVudC5nZXRJZCgpLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aGlzLnNldEVycm9yKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldE9yTG9hZFBsYXliYWNrRm9yRXZlbnQoZXZlbnQ6IE1hdHJpeEV2ZW50KTogUHJvbWlzZTxQbGF5YmFjayB8IHVuZGVmaW5lZD4ge1xuICAgICAgICBjb25zdCBldmVudElkID0gZXZlbnQuZ2V0SWQoKTtcblxuICAgICAgICBpZiAoIWV2ZW50SWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkJyb2FkY2FzdCBjaHVuayBldmVudCB3aXRob3V0IElkIG9jY3VycmVkXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLnBsYXliYWNrcy5oYXMoZXZlbnRJZCkpIHtcbiAgICAgICAgICAgIC8vIHNldCB0byBidWZmZXJpbmcgd2hpbGUgbG9hZGluZyB0aGUgY2h1bmsgZGF0YVxuICAgICAgICAgICAgY29uc3QgY3VycmVudFN0YXRlID0gdGhpcy5nZXRTdGF0ZSgpO1xuICAgICAgICAgICAgdGhpcy5zZXRTdGF0ZShWb2ljZUJyb2FkY2FzdFBsYXliYWNrU3RhdGUuQnVmZmVyaW5nKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMubG9hZFBsYXliYWNrKGV2ZW50KTtcbiAgICAgICAgICAgIHRoaXMuc2V0U3RhdGUoY3VycmVudFN0YXRlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHBsYXliYWNrID0gdGhpcy5wbGF5YmFja3MuZ2V0KGV2ZW50SWQpO1xuXG4gICAgICAgIGlmICghcGxheWJhY2spIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5hYmxlIHRvIGZpbmQgcGxheWJhY2sgZm9yIGV2ZW50ICR7ZXZlbnQuZ2V0SWQoKX1gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRyeSB0byBsb2FkIHRoZSBwbGF5YmFjayBmb3IgdGhlIG5leHQgZXZlbnQgZm9yIGEgc21vb3RoKGVyKSBwbGF5YmFja1xuICAgICAgICBjb25zdCBuZXh0RXZlbnQgPSB0aGlzLmNodW5rRXZlbnRzLmdldE5leHQoZXZlbnQpO1xuICAgICAgICBpZiAobmV4dEV2ZW50KSB0aGlzLnRyeUxvYWRQbGF5YmFjayhuZXh0RXZlbnQpO1xuXG4gICAgICAgIHJldHVybiBwbGF5YmFjaztcbiAgICB9XG5cbiAgICBwcml2YXRlIGdldEN1cnJlbnRQbGF5YmFjaygpOiBQbGF5YmFjayB8IHVuZGVmaW5lZCB7XG4gICAgICAgIGlmICghdGhpcy5jdXJyZW50bHlQbGF5aW5nKSByZXR1cm47XG4gICAgICAgIHJldHVybiB0aGlzLnBsYXliYWNrcy5nZXQodGhpcy5jdXJyZW50bHlQbGF5aW5nLmdldElkKCkhKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0TGl2ZW5lc3MoKTogVm9pY2VCcm9hZGNhc3RMaXZlbmVzcyB7XG4gICAgICAgIHJldHVybiB0aGlzLmxpdmVuZXNzO1xuICAgIH1cblxuICAgIHByaXZhdGUgc2V0TGl2ZW5lc3MobGl2ZW5lc3M6IFZvaWNlQnJvYWRjYXN0TGl2ZW5lc3MpOiB2b2lkIHtcbiAgICAgICAgaWYgKHRoaXMubGl2ZW5lc3MgPT09IGxpdmVuZXNzKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5saXZlbmVzcyA9IGxpdmVuZXNzO1xuICAgICAgICB0aGlzLmVtaXQoVm9pY2VCcm9hZGNhc3RQbGF5YmFja0V2ZW50LkxpdmVuZXNzQ2hhbmdlZCwgbGl2ZW5lc3MpO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXQgY3VycmVudFN0YXRlKCk6IFBsYXliYWNrU3RhdGUge1xuICAgICAgICByZXR1cm4gUGxheWJhY2tTdGF0ZS5QbGF5aW5nO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXQgdGltZVNlY29uZHMoKTogbnVtYmVyIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucG9zaXRpb24gLyAxMDAwO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXQgZHVyYXRpb25TZWNvbmRzKCk6IG51bWJlciB7XG4gICAgICAgIHJldHVybiB0aGlzLmR1cmF0aW9uIC8gMTAwMDtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0IHRpbWVMZWZ0U2Vjb25kcygpOiBudW1iZXIge1xuICAgICAgICAvLyBTb21ldGltZXMgdGhlIG1ldGEgZGF0YSBhbmQgdGhlIGF1ZGlvIGZpbGVzIGFyZSBhIGxpdHRsZSBiaXQgb3V0IG9mIHN5bmMuXG4gICAgICAgIC8vIEJlIHN1cmUgaXQgbmV2ZXIgcmV0dXJucyBhIG5lZ2F0aXZlIHZhbHVlLlxuICAgICAgICByZXR1cm4gTWF0aC5tYXgoMCwgTWF0aC5yb3VuZCh0aGlzLmR1cmF0aW9uU2Vjb25kcykgLSB0aGlzLnRpbWVTZWNvbmRzKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgc2tpcFRvKHRpbWVTZWNvbmRzOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgdGhpcy5za2lwVG9OZXh0ID0gdGltZVNlY29uZHM7XG5cbiAgICAgICAgaWYgKHRoaXMuc2tpcFRvRGVmZXJyZWQpIHtcbiAgICAgICAgICAgIC8vIFNraXAgdG8gcG9zaXRpb24gaXMgYWxyZWFkeSBpbiBwcm9ncmVzcy4gUmV0dXJuIHRoZSBwcm9taXNlIGZvciB0aGF0LlxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuc2tpcFRvRGVmZXJyZWQucHJvbWlzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2tpcFRvRGVmZXJyZWQgPSBkZWZlcigpO1xuXG4gICAgICAgIHdoaWxlICh0aGlzLnNraXBUb05leHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8gU2tpcCB0byBwb3NpdGlvbiB1bnRpbCBza2lwVG9OZXh0IGlzIHVuZGVmaW5lZC5cbiAgICAgICAgICAgIC8vIHNraXBUb05leHQgY2FuIGJlIHNldCBpZiBza2lwVG8gaXMgY2FsbGVkIHdoaWxlIGFscmVhZHkgc2tpcHBpbmcuXG4gICAgICAgICAgICBjb25zdCBza2lwVG9OZXh0ID0gdGhpcy5za2lwVG9OZXh0O1xuICAgICAgICAgICAgdGhpcy5za2lwVG9OZXh0ID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5kb1NraXBUbyhza2lwVG9OZXh0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2tpcFRvRGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgICB0aGlzLnNraXBUb0RlZmVycmVkID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZG9Ta2lwVG8odGltZVNlY29uZHM6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCB0aW1lID0gdGltZVNlY29uZHMgKiAxMDAwO1xuICAgICAgICBjb25zdCBldmVudCA9IHRoaXMuY2h1bmtFdmVudHMuZmluZEJ5VGltZSh0aW1lKTtcblxuICAgICAgICBpZiAoIWV2ZW50KSB7XG4gICAgICAgICAgICBsb2dnZXIud2FybihcInZvaWNlIGJyb2FkY2FzdCBjaHVuayBldmVudCB0byBza2lwIHRvIG5vdCBmb3VuZFwiKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGN1cnJlbnRQbGF5YmFjayA9IHRoaXMuZ2V0Q3VycmVudFBsYXliYWNrKCk7XG4gICAgICAgIGNvbnN0IHNraXBUb1BsYXliYWNrID0gYXdhaXQgdGhpcy50cnlHZXRPckxvYWRQbGF5YmFja0ZvckV2ZW50KGV2ZW50KTtcbiAgICAgICAgY29uc3QgY3VycmVudFBsYXliYWNrRXZlbnQgPSB0aGlzLmN1cnJlbnRseVBsYXlpbmc7XG5cbiAgICAgICAgaWYgKCFza2lwVG9QbGF5YmFjaykge1xuICAgICAgICAgICAgbG9nZ2VyLndhcm4oXCJ2b2ljZSBicm9hZGNhc3QgY2h1bmsgdG8gc2tpcCB0byBub3QgZm91bmRcIiwgZXZlbnQpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jdXJyZW50bHlQbGF5aW5nID0gZXZlbnQ7XG5cbiAgICAgICAgaWYgKGN1cnJlbnRQbGF5YmFjayAmJiBjdXJyZW50UGxheWJhY2tFdmVudCAmJiBjdXJyZW50UGxheWJhY2sgIT09IHNraXBUb1BsYXliYWNrKSB7XG4gICAgICAgICAgICAvLyBvbmx5IHN0b3AgYW5kIHVubG9hZCB0aGUgcGxheWJhY2sgaGVyZSB3aXRob3V0IHRyaWdnZXJpbmcgb3RoZXIgZWZmZWN0cywgZS5nLiBwbGF5IG5leHRcbiAgICAgICAgICAgIGN1cnJlbnRQbGF5YmFjay5vZmYoVVBEQVRFX0VWRU5ULCB0aGlzLm9uUGxheWJhY2tTdGF0ZUNoYW5nZSk7XG4gICAgICAgICAgICBhd2FpdCBjdXJyZW50UGxheWJhY2suc3RvcCgpO1xuICAgICAgICAgICAgY3VycmVudFBsYXliYWNrLm9uKFVQREFURV9FVkVOVCwgdGhpcy5vblBsYXliYWNrU3RhdGVDaGFuZ2UpO1xuICAgICAgICAgICAgdGhpcy51bmxvYWRQbGF5YmFjayhjdXJyZW50UGxheWJhY2tFdmVudCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBvZmZzZXRJbkNodW5rID0gdGltZSAtIHRoaXMuY2h1bmtFdmVudHMuZ2V0TGVuZ3RoVG8oZXZlbnQpO1xuICAgICAgICBhd2FpdCBza2lwVG9QbGF5YmFjay5za2lwVG8ob2Zmc2V0SW5DaHVuayAvIDEwMDApO1xuXG4gICAgICAgIGlmICh0aGlzLnN0YXRlID09PSBWb2ljZUJyb2FkY2FzdFBsYXliYWNrU3RhdGUuUGxheWluZyAmJiAhc2tpcFRvUGxheWJhY2suaXNQbGF5aW5nKSB7XG4gICAgICAgICAgICBhd2FpdCBza2lwVG9QbGF5YmFjay5wbGF5KCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNldFBvc2l0aW9uKHRpbWUpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBzdGFydCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgaWYgKHRoaXMuc3RhdGUgPT09IFZvaWNlQnJvYWRjYXN0UGxheWJhY2tTdGF0ZS5QbGF5aW5nKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgY3VycmVudFJlY29yZGluZyA9IHRoaXMucmVjb3JkaW5ncy5nZXRDdXJyZW50KCk7XG5cbiAgICAgICAgaWYgKGN1cnJlbnRSZWNvcmRpbmcgJiYgY3VycmVudFJlY29yZGluZy5nZXRTdGF0ZSgpICE9PSBWb2ljZUJyb2FkY2FzdEluZm9TdGF0ZS5TdG9wcGVkKSB7XG4gICAgICAgICAgICBjb25zdCBzaG91bGRTdG9wUmVjb3JkaW5nID0gYXdhaXQgc2hvd0NvbmZpcm1MaXN0ZW5Ccm9hZGNhc3RTdG9wQ3VycmVudERpYWxvZygpO1xuXG4gICAgICAgICAgICBpZiAoIXNob3VsZFN0b3BSZWNvcmRpbmcpIHtcbiAgICAgICAgICAgICAgICAvLyBrZWVwIHJlY29yZGluZ1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXdhaXQgdGhpcy5yZWNvcmRpbmdzLmdldEN1cnJlbnQoKT8uc3RvcCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY2h1bmtFdmVudHMgPSB0aGlzLmNodW5rRXZlbnRzLmdldEV2ZW50cygpO1xuXG4gICAgICAgIGNvbnN0IHRvUGxheSA9XG4gICAgICAgICAgICB0aGlzLmdldEluZm9TdGF0ZSgpID09PSBWb2ljZUJyb2FkY2FzdEluZm9TdGF0ZS5TdG9wcGVkXG4gICAgICAgICAgICAgICAgPyBjaHVua0V2ZW50c1swXSAvLyBzdGFydCBhdCB0aGUgYmVnaW5uaW5nIGZvciBhbiBlbmRlZCB2b2ljZSBicm9hZGNhc3RcbiAgICAgICAgICAgICAgICA6IGNodW5rRXZlbnRzW2NodW5rRXZlbnRzLmxlbmd0aCAtIDFdOyAvLyBzdGFydCBhdCB0aGUgY3VycmVudCBjaHVuayBmb3IgYW4gb25nb2luZyB2b2ljZSBicm9hZGNhc3RcblxuICAgICAgICBpZiAodG9QbGF5KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wbGF5RXZlbnQodG9QbGF5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2V0U3RhdGUoVm9pY2VCcm9hZGNhc3RQbGF5YmFja1N0YXRlLkJ1ZmZlcmluZyk7XG4gICAgfVxuXG4gICAgcHVibGljIHN0b3AoKTogdm9pZCB7XG4gICAgICAgIC8vIGVycm9yIGlzIGEgZmluYWwgc3RhdGVcbiAgICAgICAgaWYgKHRoaXMuZ2V0U3RhdGUoKSA9PT0gVm9pY2VCcm9hZGNhc3RQbGF5YmFja1N0YXRlLkVycm9yKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5zZXRTdGF0ZShWb2ljZUJyb2FkY2FzdFBsYXliYWNrU3RhdGUuU3RvcHBlZCk7XG4gICAgICAgIHRoaXMuZ2V0Q3VycmVudFBsYXliYWNrKCk/LnN0b3AoKTtcbiAgICAgICAgdGhpcy5jdXJyZW50bHlQbGF5aW5nID0gbnVsbDtcbiAgICAgICAgdGhpcy5zZXRQb3NpdGlvbigwKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgcGF1c2UoKTogdm9pZCB7XG4gICAgICAgIC8vIGVycm9yIGlzIGEgZmluYWwgc3RhdGVcbiAgICAgICAgaWYgKHRoaXMuZ2V0U3RhdGUoKSA9PT0gVm9pY2VCcm9hZGNhc3RQbGF5YmFja1N0YXRlLkVycm9yKSByZXR1cm47XG5cbiAgICAgICAgLy8gc3RvcHBlZCB2b2ljZSBicm9hZGNhc3RzIGNhbm5vdCBiZSBwYXVzZWRcbiAgICAgICAgaWYgKHRoaXMuZ2V0U3RhdGUoKSA9PT0gVm9pY2VCcm9hZGNhc3RQbGF5YmFja1N0YXRlLlN0b3BwZWQpIHJldHVybjtcblxuICAgICAgICB0aGlzLnNldFN0YXRlKFZvaWNlQnJvYWRjYXN0UGxheWJhY2tTdGF0ZS5QYXVzZWQpO1xuICAgICAgICB0aGlzLmdldEN1cnJlbnRQbGF5YmFjaygpPy5wYXVzZSgpO1xuICAgIH1cblxuICAgIHB1YmxpYyByZXN1bWUoKTogdm9pZCB7XG4gICAgICAgIC8vIGVycm9yIGlzIGEgZmluYWwgc3RhdGVcbiAgICAgICAgaWYgKHRoaXMuZ2V0U3RhdGUoKSA9PT0gVm9pY2VCcm9hZGNhc3RQbGF5YmFja1N0YXRlLkVycm9yKSByZXR1cm47XG5cbiAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnRseVBsYXlpbmcpIHtcbiAgICAgICAgICAgIC8vIG5vIHBsYXliYWNrIHRvIHJlc3VtZSwgc3RhcnQgZnJvbSB0aGUgYmVnaW5uaW5nXG4gICAgICAgICAgICB0aGlzLnN0YXJ0KCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNldFN0YXRlKFZvaWNlQnJvYWRjYXN0UGxheWJhY2tTdGF0ZS5QbGF5aW5nKTtcbiAgICAgICAgdGhpcy5nZXRDdXJyZW50UGxheWJhY2soKT8ucGxheSgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRvZ2dsZXMgdGhlIHBsYXliYWNrOlxuICAgICAqIHN0b3BwZWQg4oaSIHBsYXlpbmdcbiAgICAgKiBwbGF5aW5nIOKGkiBwYXVzZWRcbiAgICAgKiBwYXVzZWQg4oaSIHBsYXlpbmdcbiAgICAgKi9cbiAgICBwdWJsaWMgYXN5bmMgdG9nZ2xlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICAvLyBlcnJvciBpcyBhIGZpbmFsIHN0YXRlXG4gICAgICAgIGlmICh0aGlzLmdldFN0YXRlKCkgPT09IFZvaWNlQnJvYWRjYXN0UGxheWJhY2tTdGF0ZS5FcnJvcikgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLnN0YXRlID09PSBWb2ljZUJyb2FkY2FzdFBsYXliYWNrU3RhdGUuU3RvcHBlZCkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5zdGFydCgpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuc3RhdGUgPT09IFZvaWNlQnJvYWRjYXN0UGxheWJhY2tTdGF0ZS5QYXVzZWQpIHtcbiAgICAgICAgICAgIHRoaXMucmVzdW1lKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnBhdXNlKCk7XG4gICAgfVxuXG4gICAgcHVibGljIGdldFN0YXRlKCk6IFZvaWNlQnJvYWRjYXN0UGxheWJhY2tTdGF0ZSB7XG4gICAgICAgIHJldHVybiB0aGlzLnN0YXRlO1xuICAgIH1cblxuICAgIHByaXZhdGUgc2V0U3RhdGUoc3RhdGU6IFZvaWNlQnJvYWRjYXN0UGxheWJhY2tTdGF0ZSk6IHZvaWQge1xuICAgICAgICBpZiAodGhpcy5zdGF0ZSA9PT0gc3RhdGUpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3RhdGUgPSBzdGF0ZTtcbiAgICAgICAgdGhpcy5lbWl0KFZvaWNlQnJvYWRjYXN0UGxheWJhY2tFdmVudC5TdGF0ZUNoYW5nZWQsIHN0YXRlLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgZXJyb3Igc3RhdGUuIFN0b3AgY3VycmVudCBwbGF5YmFjaywgaWYgYW55LlxuICAgICAqL1xuICAgIHByaXZhdGUgc2V0RXJyb3IoKTogdm9pZCB7XG4gICAgICAgIHRoaXMuc2V0U3RhdGUoVm9pY2VCcm9hZGNhc3RQbGF5YmFja1N0YXRlLkVycm9yKTtcbiAgICAgICAgdGhpcy5nZXRDdXJyZW50UGxheWJhY2soKT8uc3RvcCgpO1xuICAgICAgICB0aGlzLmN1cnJlbnRseVBsYXlpbmcgPSBudWxsO1xuICAgICAgICB0aGlzLnNldFBvc2l0aW9uKDApO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXRJbmZvU3RhdGUoKTogVm9pY2VCcm9hZGNhc3RJbmZvU3RhdGUge1xuICAgICAgICByZXR1cm4gdGhpcy5pbmZvU3RhdGU7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzZXRJbmZvU3RhdGUoc3RhdGU6IFZvaWNlQnJvYWRjYXN0SW5mb1N0YXRlKTogdm9pZCB7XG4gICAgICAgIGlmICh0aGlzLmluZm9TdGF0ZSA9PT0gc3RhdGUpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuaW5mb1N0YXRlID0gc3RhdGU7XG4gICAgICAgIHRoaXMuZW1pdChWb2ljZUJyb2FkY2FzdFBsYXliYWNrRXZlbnQuSW5mb1N0YXRlQ2hhbmdlZCwgc3RhdGUpO1xuICAgICAgICB0aGlzLnNldExpdmVuZXNzKGRldGVybWluZVZvaWNlQnJvYWRjYXN0TGl2ZW5lc3ModGhpcy5pbmZvU3RhdGUpKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0IGVycm9yTWVzc2FnZSgpOiBzdHJpbmcge1xuICAgICAgICBpZiAodGhpcy5nZXRTdGF0ZSgpICE9PSBWb2ljZUJyb2FkY2FzdFBsYXliYWNrU3RhdGUuRXJyb3IpIHJldHVybiBcIlwiO1xuICAgICAgICBpZiAodGhpcy51dGRDaHVua0V2ZW50cy5zaXplKSByZXR1cm4gX3QoXCJVbmFibGUgdG8gZGVjcnlwdCB2b2ljZSBicm9hZGNhc3RcIik7XG4gICAgICAgIHJldHVybiBfdChcIlVuYWJsZSB0byBwbGF5IHRoaXMgdm9pY2UgYnJvYWRjYXN0XCIpO1xuICAgIH1cblxuICAgIHB1YmxpYyBkZXN0cm95KCk6IHZvaWQge1xuICAgICAgICBmb3IgKGNvbnN0IFssIHV0ZEV2ZW50XSBvZiB0aGlzLnV0ZENodW5rRXZlbnRzKSB7XG4gICAgICAgICAgICB1dGRFdmVudC5vZmYoTWF0cml4RXZlbnRFdmVudC5EZWNyeXB0ZWQsIHRoaXMub25DaHVua0V2ZW50RGVjcnlwdGVkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMudXRkQ2h1bmtFdmVudHMuY2xlYXIoKTtcblxuICAgICAgICB0aGlzLmNodW5rUmVsYXRpb25IZWxwZXIuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLmluZm9SZWxhdGlvbkhlbHBlci5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG5cbiAgICAgICAgdGhpcy5jaHVua0V2ZW50cyA9IG5ldyBWb2ljZUJyb2FkY2FzdENodW5rRXZlbnRzKCk7XG4gICAgICAgIHRoaXMucGxheWJhY2tzLmZvckVhY2goKHApID0+IHAuZGVzdHJveSgpKTtcbiAgICAgICAgdGhpcy5wbGF5YmFja3MgPSBuZXcgTWFwPHN0cmluZywgUGxheWJhY2s+KCk7XG4gICAgfVxufVxuIl0sIm1hcHBpbmdz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