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
//# sourceMappingURL=VoiceBroadcastPlayback.js.map