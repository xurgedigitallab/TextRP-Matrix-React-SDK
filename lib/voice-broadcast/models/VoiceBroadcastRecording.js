"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.VoiceBroadcastRecordingEvent = exports.VoiceBroadcastRecording = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _logger = require("matrix-js-sdk/src/logger");
var _matrix = require("matrix-js-sdk/src/matrix");
var _typedEventEmitter = require("matrix-js-sdk/src/models/typed-event-emitter");
var _ = require("..");
var _ContentMessages = require("../../ContentMessages");
var _createVoiceMessageContent = require("../../utils/createVoiceMessageContent");
var _dispatcher = _interopRequireDefault(require("../../dispatcher/dispatcher"));
var _VoiceBroadcastChunkEvents = require("../utils/VoiceBroadcastChunkEvents");
var _RelationsHelper = require("../../events/RelationsHelper");
var _connection = require("../../utils/connection");
var _notifications = require("../../utils/notifications");
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
let VoiceBroadcastRecordingEvent = /*#__PURE__*/function (VoiceBroadcastRecordingEvent) {
  VoiceBroadcastRecordingEvent["StateChanged"] = "liveness_changed";
  VoiceBroadcastRecordingEvent["TimeLeftChanged"] = "time_left_changed";
  return VoiceBroadcastRecordingEvent;
}({});
exports.VoiceBroadcastRecordingEvent = VoiceBroadcastRecordingEvent;
class VoiceBroadcastRecording extends _typedEventEmitter.TypedEventEmitter {
  constructor(infoEvent, client, initialState) {
    super();
    this.infoEvent = infoEvent;
    this.client = client;
    (0, _defineProperty2.default)(this, "state", void 0);
    (0, _defineProperty2.default)(this, "recorder", null);
    (0, _defineProperty2.default)(this, "dispatcherRef", void 0);
    (0, _defineProperty2.default)(this, "chunkEvents", new _VoiceBroadcastChunkEvents.VoiceBroadcastChunkEvents());
    (0, _defineProperty2.default)(this, "chunkRelationHelper", void 0);
    (0, _defineProperty2.default)(this, "maxLength", void 0);
    (0, _defineProperty2.default)(this, "timeLeft", void 0);
    (0, _defineProperty2.default)(this, "toRetry", []);
    (0, _defineProperty2.default)(this, "reconnectedListener", void 0);
    (0, _defineProperty2.default)(this, "roomId", void 0);
    (0, _defineProperty2.default)(this, "infoEventId", void 0);
    /**
     * Broadcast chunks have a sequence number to bring them in the correct order and to know if a message is missing.
     * This variable holds the last sequence number.
     * Starts with 0 because there is no chunk at the beginning of a broadcast.
     * Will be incremented when a chunk message is created.
     */
    (0, _defineProperty2.default)(this, "sequence", 0);
    (0, _defineProperty2.default)(this, "onChunkEvent", event => {
      if (!event.getId() && !event.getTxnId() || event.getContent()?.msgtype !== _matrix.MsgType.Audio // don't add non-audio event
      ) {
        return;
      }
      this.chunkEvents.addEvent(event);
    });
    /**
     * Retries failed actions on reconnect.
     */
    (0, _defineProperty2.default)(this, "onReconnect", async () => {
      // Do nothing if not in connection_error state.
      if (this.state !== "connection_error") return;

      // Copy the array, so that it is possible to remove elements from it while iterating over the original.
      const toRetryCopy = [...this.toRetry];
      for (const retryFn of this.toRetry) {
        try {
          await retryFn();
          // Successfully retried. Remove from array copy.
          toRetryCopy.splice(toRetryCopy.indexOf(retryFn), 1);
        } catch {
          // The current retry callback failed. Stop the loop.
          break;
        }
      }
      this.toRetry = toRetryCopy;
      if (this.toRetry.length === 0) {
        // Everything has been successfully retried. Recover from error state to paused.
        await this.pause();
      }
    });
    (0, _defineProperty2.default)(this, "toggle", async () => {
      if (this.getState() === _.VoiceBroadcastInfoState.Paused) return this.resume();
      if ([_.VoiceBroadcastInfoState.Started, _.VoiceBroadcastInfoState.Resumed].includes(this.getState())) {
        return this.pause();
      }
    });
    (0, _defineProperty2.default)(this, "onBeforeRedaction", () => {
      if (this.getState() !== _.VoiceBroadcastInfoState.Stopped) {
        this.setState(_.VoiceBroadcastInfoState.Stopped);
        // destroy cleans up everything
        this.destroy();
      }
    });
    (0, _defineProperty2.default)(this, "onAction", payload => {
      if (payload.action !== "call_state") return;

      // pause on any call action
      this.pause();
    });
    (0, _defineProperty2.default)(this, "onCurrentChunkLengthUpdated", currentChunkLength => {
      this.setTimeLeft(this.maxLength - this.chunkEvents.getLengthSeconds() - currentChunkLength);
    });
    (0, _defineProperty2.default)(this, "onChunkRecorded", async chunk => {
      const uploadAndSendFn = async () => {
        const {
          url,
          file
        } = await this.uploadFile(chunk);
        await this.sendVoiceMessage(chunk, url, file);
      };
      await this.callWithRetry(uploadAndSendFn);
    });
    this.maxLength = (0, _.getMaxBroadcastLength)();
    this.timeLeft = this.maxLength;
    this.infoEventId = this.determineEventIdFromInfoEvent();
    this.roomId = this.determineRoomIdFromInfoEvent();
    if (initialState) {
      this.state = initialState;
    } else {
      this.state = this.determineInitialStateFromInfoEvent();
    }

    // TODO Michael W: listen for state updates

    this.infoEvent.on(_matrix.MatrixEventEvent.BeforeRedaction, this.onBeforeRedaction);
    this.dispatcherRef = _dispatcher.default.register(this.onAction);
    this.chunkRelationHelper = this.initialiseChunkEventRelation();
    this.reconnectedListener = (0, _connection.createReconnectedListener)(this.onReconnect);
    this.client.on(_matrix.ClientEvent.Sync, this.reconnectedListener);
  }
  initialiseChunkEventRelation() {
    const relationsHelper = new _RelationsHelper.RelationsHelper(this.infoEvent, _matrix.RelationType.Reference, _matrix.EventType.RoomMessage, this.client);
    relationsHelper.on(_RelationsHelper.RelationsHelperEvent.Add, this.onChunkEvent);
    relationsHelper.emitFetchCurrent().catch(err => {
      _logger.logger.warn("error fetching server side relation for voice broadcast chunks", err);
      // fall back to local events
      relationsHelper.emitCurrent();
    });
    return relationsHelper;
  }
  determineEventIdFromInfoEvent() {
    const infoEventId = this.infoEvent.getId();
    if (!infoEventId) {
      throw new Error("Cannot create broadcast for info event without Id.");
    }
    return infoEventId;
  }
  determineRoomIdFromInfoEvent() {
    const roomId = this.infoEvent.getRoomId();
    if (!roomId) {
      throw new Error(`Cannot create broadcast for unknown room (info event ${this.infoEventId})`);
    }
    return roomId;
  }

  /**
   * Determines the initial broadcast state.
   * Checks all related events. If one has the "stopped" state → stopped, else started.
   */
  determineInitialStateFromInfoEvent() {
    const room = this.client.getRoom(this.roomId);
    const relations = room?.getUnfilteredTimelineSet()?.relations?.getChildEventsForEvent(this.infoEventId, _matrix.RelationType.Reference, _.VoiceBroadcastInfoEventType);
    const relatedEvents = relations?.getRelations();
    return !relatedEvents?.find(event => {
      return event.getContent()?.state === _.VoiceBroadcastInfoState.Stopped;
    }) ? _.VoiceBroadcastInfoState.Started : _.VoiceBroadcastInfoState.Stopped;
  }
  getTimeLeft() {
    return this.timeLeft;
  }
  async setTimeLeft(timeLeft) {
    if (timeLeft <= 0) {
      // time is up - stop the recording
      return await this.stop();
    }

    // do never increase time left; no action if equals
    if (timeLeft >= this.timeLeft) return;
    this.timeLeft = timeLeft;
    this.emit(VoiceBroadcastRecordingEvent.TimeLeftChanged, timeLeft);
  }
  async start() {
    return this.getRecorder().start();
  }
  async stop() {
    if (this.state === _.VoiceBroadcastInfoState.Stopped) return;
    this.setState(_.VoiceBroadcastInfoState.Stopped);
    await this.stopRecorder();
    await this.sendInfoStateEvent(_.VoiceBroadcastInfoState.Stopped);
  }
  async pause() {
    // stopped or already paused recordings cannot be paused
    if ([_.VoiceBroadcastInfoState.Stopped, _.VoiceBroadcastInfoState.Paused].includes(this.state)) return;
    this.setState(_.VoiceBroadcastInfoState.Paused);
    await this.stopRecorder();
    await this.sendInfoStateEvent(_.VoiceBroadcastInfoState.Paused);
  }
  async resume() {
    if (this.state !== _.VoiceBroadcastInfoState.Paused) return;
    this.setState(_.VoiceBroadcastInfoState.Resumed);
    await this.getRecorder().start();
    await this.sendInfoStateEvent(_.VoiceBroadcastInfoState.Resumed);
  }
  getState() {
    return this.state;
  }
  getRecorder() {
    if (!this.recorder) {
      this.recorder = (0, _.createVoiceBroadcastRecorder)();
      this.recorder.on(_.VoiceBroadcastRecorderEvent.ChunkRecorded, this.onChunkRecorded);
      this.recorder.on(_.VoiceBroadcastRecorderEvent.CurrentChunkLengthUpdated, this.onCurrentChunkLengthUpdated);
    }
    return this.recorder;
  }
  async destroy() {
    if (this.recorder) {
      this.recorder.stop();
      this.recorder.destroy();
    }
    this.infoEvent.off(_matrix.MatrixEventEvent.BeforeRedaction, this.onBeforeRedaction);
    this.removeAllListeners();
    _dispatcher.default.unregister(this.dispatcherRef);
    this.chunkEvents = new _VoiceBroadcastChunkEvents.VoiceBroadcastChunkEvents();
    this.chunkRelationHelper.destroy();
    this.client.off(_matrix.ClientEvent.Sync, this.reconnectedListener);
  }
  setState(state) {
    this.state = state;
    this.emit(VoiceBroadcastRecordingEvent.StateChanged, this.state);
  }
  /**
   * This function is called on connection errors.
   * It sets the connection error state and stops the recorder.
   */
  async onConnectionError() {
    this.playConnectionErrorAudioNotification().catch(() => {
      // Error logged in playConnectionErrorAudioNotification().
    });
    await this.stopRecorder(false);
    this.setState("connection_error");
  }
  async playConnectionErrorAudioNotification() {
    if ((0, _notifications.localNotificationsAreSilenced)(this.client)) {
      return;
    }

    // Audio files are added to the document in Element Web.
    // See <audio> elements in https://github.com/vector-im/element-web/blob/develop/src/vector/index.html
    const audioElement = document.querySelector("audio#errorAudio");
    try {
      await audioElement?.play();
    } catch (e) {
      _logger.logger.warn("error playing 'errorAudio'", e);
    }
  }
  async uploadFile(chunk) {
    return (0, _ContentMessages.uploadFile)(this.client, this.roomId, new Blob([chunk.buffer], {
      type: this.getRecorder().contentType
    }));
  }
  async sendVoiceMessage(chunk, url, file) {
    /**
     * Increment the last sequence number and use it for this message.
     * Done outside of the sendMessageFn to get a scoped value.
     * Also see {@link VoiceBroadcastRecording.sequence}.
     */
    const sequence = ++this.sequence;
    const sendMessageFn = async () => {
      const content = (0, _createVoiceMessageContent.createVoiceMessageContent)(url, this.getRecorder().contentType, Math.round(chunk.length * 1000), chunk.buffer.length, file);
      content["m.relates_to"] = {
        rel_type: _matrix.RelationType.Reference,
        event_id: this.infoEventId
      };
      content["io.element.voice_broadcast_chunk"] = {
        sequence
      };
      await this.client.sendMessage(this.roomId, content);
    };
    await this.callWithRetry(sendMessageFn);
  }

  /**
   * Sends an info state event with given state.
   * On error stores a resend function and setState(state) in {@link toRetry} and
   * sets the broadcast state to connection_error.
   */
  async sendInfoStateEvent(state) {
    const sendEventFn = async () => {
      await this.client.sendStateEvent(this.roomId, _.VoiceBroadcastInfoEventType, {
        device_id: this.client.getDeviceId(),
        state,
        last_chunk_sequence: this.sequence,
        ["m.relates_to"]: {
          rel_type: _matrix.RelationType.Reference,
          event_id: this.infoEventId
        }
      }, this.client.getSafeUserId());
    };
    await this.callWithRetry(sendEventFn);
  }

  /**
   * Calls the function.
   * On failure adds it to the retry list and triggers connection error.
   * {@link toRetry}
   * {@link onConnectionError}
   */
  async callWithRetry(retryAbleFn) {
    try {
      await retryAbleFn();
    } catch {
      this.toRetry.push(retryAbleFn);
      this.onConnectionError();
    }
  }
  async stopRecorder() {
    let emit = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
    if (!this.recorder) {
      return;
    }
    try {
      const lastChunk = await this.recorder.stop();
      if (lastChunk && emit) {
        await this.onChunkRecorded(lastChunk);
      }
    } catch (err) {
      _logger.logger.warn("error stopping voice broadcast recorder", err);
    }
  }
}
exports.VoiceBroadcastRecording = VoiceBroadcastRecording;
//# sourceMappingURL=VoiceBroadcastRecording.js.map