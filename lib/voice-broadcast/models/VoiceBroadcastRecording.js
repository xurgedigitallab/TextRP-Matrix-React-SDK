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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfbG9nZ2VyIiwicmVxdWlyZSIsIl9tYXRyaXgiLCJfdHlwZWRFdmVudEVtaXR0ZXIiLCJfIiwiX0NvbnRlbnRNZXNzYWdlcyIsIl9jcmVhdGVWb2ljZU1lc3NhZ2VDb250ZW50IiwiX2Rpc3BhdGNoZXIiLCJfaW50ZXJvcFJlcXVpcmVEZWZhdWx0IiwiX1ZvaWNlQnJvYWRjYXN0Q2h1bmtFdmVudHMiLCJfUmVsYXRpb25zSGVscGVyIiwiX2Nvbm5lY3Rpb24iLCJfbm90aWZpY2F0aW9ucyIsIlZvaWNlQnJvYWRjYXN0UmVjb3JkaW5nRXZlbnQiLCJleHBvcnRzIiwiVm9pY2VCcm9hZGNhc3RSZWNvcmRpbmciLCJUeXBlZEV2ZW50RW1pdHRlciIsImNvbnN0cnVjdG9yIiwiaW5mb0V2ZW50IiwiY2xpZW50IiwiaW5pdGlhbFN0YXRlIiwiX2RlZmluZVByb3BlcnR5MiIsImRlZmF1bHQiLCJWb2ljZUJyb2FkY2FzdENodW5rRXZlbnRzIiwiZXZlbnQiLCJnZXRJZCIsImdldFR4bklkIiwiZ2V0Q29udGVudCIsIm1zZ3R5cGUiLCJNc2dUeXBlIiwiQXVkaW8iLCJjaHVua0V2ZW50cyIsImFkZEV2ZW50Iiwic3RhdGUiLCJ0b1JldHJ5Q29weSIsInRvUmV0cnkiLCJyZXRyeUZuIiwic3BsaWNlIiwiaW5kZXhPZiIsImxlbmd0aCIsInBhdXNlIiwiZ2V0U3RhdGUiLCJWb2ljZUJyb2FkY2FzdEluZm9TdGF0ZSIsIlBhdXNlZCIsInJlc3VtZSIsIlN0YXJ0ZWQiLCJSZXN1bWVkIiwiaW5jbHVkZXMiLCJTdG9wcGVkIiwic2V0U3RhdGUiLCJkZXN0cm95IiwicGF5bG9hZCIsImFjdGlvbiIsImN1cnJlbnRDaHVua0xlbmd0aCIsInNldFRpbWVMZWZ0IiwibWF4TGVuZ3RoIiwiZ2V0TGVuZ3RoU2Vjb25kcyIsImNodW5rIiwidXBsb2FkQW5kU2VuZEZuIiwidXJsIiwiZmlsZSIsInVwbG9hZEZpbGUiLCJzZW5kVm9pY2VNZXNzYWdlIiwiY2FsbFdpdGhSZXRyeSIsImdldE1heEJyb2FkY2FzdExlbmd0aCIsInRpbWVMZWZ0IiwiaW5mb0V2ZW50SWQiLCJkZXRlcm1pbmVFdmVudElkRnJvbUluZm9FdmVudCIsInJvb21JZCIsImRldGVybWluZVJvb21JZEZyb21JbmZvRXZlbnQiLCJkZXRlcm1pbmVJbml0aWFsU3RhdGVGcm9tSW5mb0V2ZW50Iiwib24iLCJNYXRyaXhFdmVudEV2ZW50IiwiQmVmb3JlUmVkYWN0aW9uIiwib25CZWZvcmVSZWRhY3Rpb24iLCJkaXNwYXRjaGVyUmVmIiwiZGlzIiwicmVnaXN0ZXIiLCJvbkFjdGlvbiIsImNodW5rUmVsYXRpb25IZWxwZXIiLCJpbml0aWFsaXNlQ2h1bmtFdmVudFJlbGF0aW9uIiwicmVjb25uZWN0ZWRMaXN0ZW5lciIsImNyZWF0ZVJlY29ubmVjdGVkTGlzdGVuZXIiLCJvblJlY29ubmVjdCIsIkNsaWVudEV2ZW50IiwiU3luYyIsInJlbGF0aW9uc0hlbHBlciIsIlJlbGF0aW9uc0hlbHBlciIsIlJlbGF0aW9uVHlwZSIsIlJlZmVyZW5jZSIsIkV2ZW50VHlwZSIsIlJvb21NZXNzYWdlIiwiUmVsYXRpb25zSGVscGVyRXZlbnQiLCJBZGQiLCJvbkNodW5rRXZlbnQiLCJlbWl0RmV0Y2hDdXJyZW50IiwiY2F0Y2giLCJlcnIiLCJsb2dnZXIiLCJ3YXJuIiwiZW1pdEN1cnJlbnQiLCJFcnJvciIsImdldFJvb21JZCIsInJvb20iLCJnZXRSb29tIiwicmVsYXRpb25zIiwiZ2V0VW5maWx0ZXJlZFRpbWVsaW5lU2V0IiwiZ2V0Q2hpbGRFdmVudHNGb3JFdmVudCIsIlZvaWNlQnJvYWRjYXN0SW5mb0V2ZW50VHlwZSIsInJlbGF0ZWRFdmVudHMiLCJnZXRSZWxhdGlvbnMiLCJmaW5kIiwiZ2V0VGltZUxlZnQiLCJzdG9wIiwiZW1pdCIsIlRpbWVMZWZ0Q2hhbmdlZCIsInN0YXJ0IiwiZ2V0UmVjb3JkZXIiLCJzdG9wUmVjb3JkZXIiLCJzZW5kSW5mb1N0YXRlRXZlbnQiLCJyZWNvcmRlciIsImNyZWF0ZVZvaWNlQnJvYWRjYXN0UmVjb3JkZXIiLCJWb2ljZUJyb2FkY2FzdFJlY29yZGVyRXZlbnQiLCJDaHVua1JlY29yZGVkIiwib25DaHVua1JlY29yZGVkIiwiQ3VycmVudENodW5rTGVuZ3RoVXBkYXRlZCIsIm9uQ3VycmVudENodW5rTGVuZ3RoVXBkYXRlZCIsIm9mZiIsInJlbW92ZUFsbExpc3RlbmVycyIsInVucmVnaXN0ZXIiLCJTdGF0ZUNoYW5nZWQiLCJvbkNvbm5lY3Rpb25FcnJvciIsInBsYXlDb25uZWN0aW9uRXJyb3JBdWRpb05vdGlmaWNhdGlvbiIsImxvY2FsTm90aWZpY2F0aW9uc0FyZVNpbGVuY2VkIiwiYXVkaW9FbGVtZW50IiwiZG9jdW1lbnQiLCJxdWVyeVNlbGVjdG9yIiwicGxheSIsImUiLCJCbG9iIiwiYnVmZmVyIiwidHlwZSIsImNvbnRlbnRUeXBlIiwic2VxdWVuY2UiLCJzZW5kTWVzc2FnZUZuIiwiY29udGVudCIsImNyZWF0ZVZvaWNlTWVzc2FnZUNvbnRlbnQiLCJNYXRoIiwicm91bmQiLCJyZWxfdHlwZSIsImV2ZW50X2lkIiwic2VuZE1lc3NhZ2UiLCJzZW5kRXZlbnRGbiIsInNlbmRTdGF0ZUV2ZW50IiwiZGV2aWNlX2lkIiwiZ2V0RGV2aWNlSWQiLCJsYXN0X2NodW5rX3NlcXVlbmNlIiwiZ2V0U2FmZVVzZXJJZCIsInJldHJ5QWJsZUZuIiwicHVzaCIsImFyZ3VtZW50cyIsInVuZGVmaW5lZCIsImxhc3RDaHVuayJdLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy92b2ljZS1icm9hZGNhc3QvbW9kZWxzL1ZvaWNlQnJvYWRjYXN0UmVjb3JkaW5nLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qXG5Db3B5cmlnaHQgMjAyMiBUaGUgTWF0cml4Lm9yZyBGb3VuZGF0aW9uIEMuSS5DLlxuXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiovXG5cbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9sb2dnZXJcIjtcbmltcG9ydCB7XG4gICAgQ2xpZW50RXZlbnQsXG4gICAgQ2xpZW50RXZlbnRIYW5kbGVyTWFwLFxuICAgIEV2ZW50VHlwZSxcbiAgICBNYXRyaXhDbGllbnQsXG4gICAgTWF0cml4RXZlbnQsXG4gICAgTWF0cml4RXZlbnRFdmVudCxcbiAgICBNc2dUeXBlLFxuICAgIFJlbGF0aW9uVHlwZSxcbn0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL21hdHJpeFwiO1xuaW1wb3J0IHsgVHlwZWRFdmVudEVtaXR0ZXIgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbW9kZWxzL3R5cGVkLWV2ZW50LWVtaXR0ZXJcIjtcblxuaW1wb3J0IHtcbiAgICBDaHVua1JlY29yZGVkUGF5bG9hZCxcbiAgICBjcmVhdGVWb2ljZUJyb2FkY2FzdFJlY29yZGVyLFxuICAgIGdldE1heEJyb2FkY2FzdExlbmd0aCxcbiAgICBWb2ljZUJyb2FkY2FzdEluZm9FdmVudENvbnRlbnQsXG4gICAgVm9pY2VCcm9hZGNhc3RJbmZvRXZlbnRUeXBlLFxuICAgIFZvaWNlQnJvYWRjYXN0SW5mb1N0YXRlLFxuICAgIFZvaWNlQnJvYWRjYXN0UmVjb3JkZXIsXG4gICAgVm9pY2VCcm9hZGNhc3RSZWNvcmRlckV2ZW50LFxufSBmcm9tIFwiLi5cIjtcbmltcG9ydCB7IHVwbG9hZEZpbGUgfSBmcm9tIFwiLi4vLi4vQ29udGVudE1lc3NhZ2VzXCI7XG5pbXBvcnQgeyBJRW5jcnlwdGVkRmlsZSB9IGZyb20gXCIuLi8uLi9jdXN0b21pc2F0aW9ucy9tb2RlbHMvSU1lZGlhRXZlbnRDb250ZW50XCI7XG5pbXBvcnQgeyBjcmVhdGVWb2ljZU1lc3NhZ2VDb250ZW50IH0gZnJvbSBcIi4uLy4uL3V0aWxzL2NyZWF0ZVZvaWNlTWVzc2FnZUNvbnRlbnRcIjtcbmltcG9ydCB7IElEZXN0cm95YWJsZSB9IGZyb20gXCIuLi8uLi91dGlscy9JRGVzdHJveWFibGVcIjtcbmltcG9ydCBkaXMgZnJvbSBcIi4uLy4uL2Rpc3BhdGNoZXIvZGlzcGF0Y2hlclwiO1xuaW1wb3J0IHsgQWN0aW9uUGF5bG9hZCB9IGZyb20gXCIuLi8uLi9kaXNwYXRjaGVyL3BheWxvYWRzXCI7XG5pbXBvcnQgeyBWb2ljZUJyb2FkY2FzdENodW5rRXZlbnRzIH0gZnJvbSBcIi4uL3V0aWxzL1ZvaWNlQnJvYWRjYXN0Q2h1bmtFdmVudHNcIjtcbmltcG9ydCB7IFJlbGF0aW9uc0hlbHBlciwgUmVsYXRpb25zSGVscGVyRXZlbnQgfSBmcm9tIFwiLi4vLi4vZXZlbnRzL1JlbGF0aW9uc0hlbHBlclwiO1xuaW1wb3J0IHsgY3JlYXRlUmVjb25uZWN0ZWRMaXN0ZW5lciB9IGZyb20gXCIuLi8uLi91dGlscy9jb25uZWN0aW9uXCI7XG5pbXBvcnQgeyBsb2NhbE5vdGlmaWNhdGlvbnNBcmVTaWxlbmNlZCB9IGZyb20gXCIuLi8uLi91dGlscy9ub3RpZmljYXRpb25zXCI7XG5cbmV4cG9ydCBlbnVtIFZvaWNlQnJvYWRjYXN0UmVjb3JkaW5nRXZlbnQge1xuICAgIFN0YXRlQ2hhbmdlZCA9IFwibGl2ZW5lc3NfY2hhbmdlZFwiLFxuICAgIFRpbWVMZWZ0Q2hhbmdlZCA9IFwidGltZV9sZWZ0X2NoYW5nZWRcIixcbn1cblxuZXhwb3J0IHR5cGUgVm9pY2VCcm9hZGNhc3RSZWNvcmRpbmdTdGF0ZSA9IFZvaWNlQnJvYWRjYXN0SW5mb1N0YXRlIHwgXCJjb25uZWN0aW9uX2Vycm9yXCI7XG5cbmludGVyZmFjZSBFdmVudE1hcCB7XG4gICAgW1ZvaWNlQnJvYWRjYXN0UmVjb3JkaW5nRXZlbnQuU3RhdGVDaGFuZ2VkXTogKHN0YXRlOiBWb2ljZUJyb2FkY2FzdFJlY29yZGluZ1N0YXRlKSA9PiB2b2lkO1xuICAgIFtWb2ljZUJyb2FkY2FzdFJlY29yZGluZ0V2ZW50LlRpbWVMZWZ0Q2hhbmdlZF06ICh0aW1lTGVmdDogbnVtYmVyKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgY2xhc3MgVm9pY2VCcm9hZGNhc3RSZWNvcmRpbmdcbiAgICBleHRlbmRzIFR5cGVkRXZlbnRFbWl0dGVyPFZvaWNlQnJvYWRjYXN0UmVjb3JkaW5nRXZlbnQsIEV2ZW50TWFwPlxuICAgIGltcGxlbWVudHMgSURlc3Ryb3lhYmxlXG57XG4gICAgcHJpdmF0ZSBzdGF0ZTogVm9pY2VCcm9hZGNhc3RSZWNvcmRpbmdTdGF0ZTtcbiAgICBwcml2YXRlIHJlY29yZGVyOiBWb2ljZUJyb2FkY2FzdFJlY29yZGVyIHwgbnVsbCA9IG51bGw7XG4gICAgcHJpdmF0ZSBkaXNwYXRjaGVyUmVmOiBzdHJpbmc7XG4gICAgcHJpdmF0ZSBjaHVua0V2ZW50cyA9IG5ldyBWb2ljZUJyb2FkY2FzdENodW5rRXZlbnRzKCk7XG4gICAgcHJpdmF0ZSBjaHVua1JlbGF0aW9uSGVscGVyOiBSZWxhdGlvbnNIZWxwZXI7XG4gICAgcHJpdmF0ZSBtYXhMZW5ndGg6IG51bWJlcjtcbiAgICBwcml2YXRlIHRpbWVMZWZ0OiBudW1iZXI7XG4gICAgcHJpdmF0ZSB0b1JldHJ5OiBBcnJheTwoKSA9PiBQcm9taXNlPHZvaWQ+PiA9IFtdO1xuICAgIHByaXZhdGUgcmVjb25uZWN0ZWRMaXN0ZW5lcjogQ2xpZW50RXZlbnRIYW5kbGVyTWFwW0NsaWVudEV2ZW50LlN5bmNdO1xuICAgIHByaXZhdGUgcm9vbUlkOiBzdHJpbmc7XG4gICAgcHJpdmF0ZSBpbmZvRXZlbnRJZDogc3RyaW5nO1xuXG4gICAgLyoqXG4gICAgICogQnJvYWRjYXN0IGNodW5rcyBoYXZlIGEgc2VxdWVuY2UgbnVtYmVyIHRvIGJyaW5nIHRoZW0gaW4gdGhlIGNvcnJlY3Qgb3JkZXIgYW5kIHRvIGtub3cgaWYgYSBtZXNzYWdlIGlzIG1pc3NpbmcuXG4gICAgICogVGhpcyB2YXJpYWJsZSBob2xkcyB0aGUgbGFzdCBzZXF1ZW5jZSBudW1iZXIuXG4gICAgICogU3RhcnRzIHdpdGggMCBiZWNhdXNlIHRoZXJlIGlzIG5vIGNodW5rIGF0IHRoZSBiZWdpbm5pbmcgb2YgYSBicm9hZGNhc3QuXG4gICAgICogV2lsbCBiZSBpbmNyZW1lbnRlZCB3aGVuIGEgY2h1bmsgbWVzc2FnZSBpcyBjcmVhdGVkLlxuICAgICAqL1xuICAgIHByaXZhdGUgc2VxdWVuY2UgPSAwO1xuXG4gICAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgICAgICBwdWJsaWMgcmVhZG9ubHkgaW5mb0V2ZW50OiBNYXRyaXhFdmVudCxcbiAgICAgICAgcHJpdmF0ZSBjbGllbnQ6IE1hdHJpeENsaWVudCxcbiAgICAgICAgaW5pdGlhbFN0YXRlPzogVm9pY2VCcm9hZGNhc3RJbmZvU3RhdGUsXG4gICAgKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMubWF4TGVuZ3RoID0gZ2V0TWF4QnJvYWRjYXN0TGVuZ3RoKCk7XG4gICAgICAgIHRoaXMudGltZUxlZnQgPSB0aGlzLm1heExlbmd0aDtcbiAgICAgICAgdGhpcy5pbmZvRXZlbnRJZCA9IHRoaXMuZGV0ZXJtaW5lRXZlbnRJZEZyb21JbmZvRXZlbnQoKTtcbiAgICAgICAgdGhpcy5yb29tSWQgPSB0aGlzLmRldGVybWluZVJvb21JZEZyb21JbmZvRXZlbnQoKTtcblxuICAgICAgICBpZiAoaW5pdGlhbFN0YXRlKSB7XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gaW5pdGlhbFN0YXRlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IHRoaXMuZGV0ZXJtaW5lSW5pdGlhbFN0YXRlRnJvbUluZm9FdmVudCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVE9ETyBNaWNoYWVsIFc6IGxpc3RlbiBmb3Igc3RhdGUgdXBkYXRlc1xuXG4gICAgICAgIHRoaXMuaW5mb0V2ZW50Lm9uKE1hdHJpeEV2ZW50RXZlbnQuQmVmb3JlUmVkYWN0aW9uLCB0aGlzLm9uQmVmb3JlUmVkYWN0aW9uKTtcbiAgICAgICAgdGhpcy5kaXNwYXRjaGVyUmVmID0gZGlzLnJlZ2lzdGVyKHRoaXMub25BY3Rpb24pO1xuICAgICAgICB0aGlzLmNodW5rUmVsYXRpb25IZWxwZXIgPSB0aGlzLmluaXRpYWxpc2VDaHVua0V2ZW50UmVsYXRpb24oKTtcbiAgICAgICAgdGhpcy5yZWNvbm5lY3RlZExpc3RlbmVyID0gY3JlYXRlUmVjb25uZWN0ZWRMaXN0ZW5lcih0aGlzLm9uUmVjb25uZWN0KTtcbiAgICAgICAgdGhpcy5jbGllbnQub24oQ2xpZW50RXZlbnQuU3luYywgdGhpcy5yZWNvbm5lY3RlZExpc3RlbmVyKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGluaXRpYWxpc2VDaHVua0V2ZW50UmVsYXRpb24oKTogUmVsYXRpb25zSGVscGVyIHtcbiAgICAgICAgY29uc3QgcmVsYXRpb25zSGVscGVyID0gbmV3IFJlbGF0aW9uc0hlbHBlcihcbiAgICAgICAgICAgIHRoaXMuaW5mb0V2ZW50LFxuICAgICAgICAgICAgUmVsYXRpb25UeXBlLlJlZmVyZW5jZSxcbiAgICAgICAgICAgIEV2ZW50VHlwZS5Sb29tTWVzc2FnZSxcbiAgICAgICAgICAgIHRoaXMuY2xpZW50LFxuICAgICAgICApO1xuICAgICAgICByZWxhdGlvbnNIZWxwZXIub24oUmVsYXRpb25zSGVscGVyRXZlbnQuQWRkLCB0aGlzLm9uQ2h1bmtFdmVudCk7XG5cbiAgICAgICAgcmVsYXRpb25zSGVscGVyLmVtaXRGZXRjaEN1cnJlbnQoKS5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgICAgICBsb2dnZXIud2FybihcImVycm9yIGZldGNoaW5nIHNlcnZlciBzaWRlIHJlbGF0aW9uIGZvciB2b2ljZSBicm9hZGNhc3QgY2h1bmtzXCIsIGVycik7XG4gICAgICAgICAgICAvLyBmYWxsIGJhY2sgdG8gbG9jYWwgZXZlbnRzXG4gICAgICAgICAgICByZWxhdGlvbnNIZWxwZXIuZW1pdEN1cnJlbnQoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHJlbGF0aW9uc0hlbHBlcjtcbiAgICB9XG5cbiAgICBwcml2YXRlIG9uQ2h1bmtFdmVudCA9IChldmVudDogTWF0cml4RXZlbnQpOiB2b2lkID0+IHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgKCFldmVudC5nZXRJZCgpICYmICFldmVudC5nZXRUeG5JZCgpKSB8fFxuICAgICAgICAgICAgZXZlbnQuZ2V0Q29udGVudCgpPy5tc2d0eXBlICE9PSBNc2dUeXBlLkF1ZGlvIC8vIGRvbid0IGFkZCBub24tYXVkaW8gZXZlbnRcbiAgICAgICAgKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNodW5rRXZlbnRzLmFkZEV2ZW50KGV2ZW50KTtcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBkZXRlcm1pbmVFdmVudElkRnJvbUluZm9FdmVudCgpOiBzdHJpbmcge1xuICAgICAgICBjb25zdCBpbmZvRXZlbnRJZCA9IHRoaXMuaW5mb0V2ZW50LmdldElkKCk7XG5cbiAgICAgICAgaWYgKCFpbmZvRXZlbnRJZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGNyZWF0ZSBicm9hZGNhc3QgZm9yIGluZm8gZXZlbnQgd2l0aG91dCBJZC5cIik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaW5mb0V2ZW50SWQ7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBkZXRlcm1pbmVSb29tSWRGcm9tSW5mb0V2ZW50KCk6IHN0cmluZyB7XG4gICAgICAgIGNvbnN0IHJvb21JZCA9IHRoaXMuaW5mb0V2ZW50LmdldFJvb21JZCgpO1xuXG4gICAgICAgIGlmICghcm9vbUlkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCBjcmVhdGUgYnJvYWRjYXN0IGZvciB1bmtub3duIHJvb20gKGluZm8gZXZlbnQgJHt0aGlzLmluZm9FdmVudElkfSlgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByb29tSWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGV0ZXJtaW5lcyB0aGUgaW5pdGlhbCBicm9hZGNhc3Qgc3RhdGUuXG4gICAgICogQ2hlY2tzIGFsbCByZWxhdGVkIGV2ZW50cy4gSWYgb25lIGhhcyB0aGUgXCJzdG9wcGVkXCIgc3RhdGUg4oaSIHN0b3BwZWQsIGVsc2Ugc3RhcnRlZC5cbiAgICAgKi9cbiAgICBwcml2YXRlIGRldGVybWluZUluaXRpYWxTdGF0ZUZyb21JbmZvRXZlbnQoKTogVm9pY2VCcm9hZGNhc3RSZWNvcmRpbmdTdGF0ZSB7XG4gICAgICAgIGNvbnN0IHJvb20gPSB0aGlzLmNsaWVudC5nZXRSb29tKHRoaXMucm9vbUlkKTtcbiAgICAgICAgY29uc3QgcmVsYXRpb25zID0gcm9vbVxuICAgICAgICAgICAgPy5nZXRVbmZpbHRlcmVkVGltZWxpbmVTZXQoKVxuICAgICAgICAgICAgPy5yZWxhdGlvbnM/LmdldENoaWxkRXZlbnRzRm9yRXZlbnQodGhpcy5pbmZvRXZlbnRJZCwgUmVsYXRpb25UeXBlLlJlZmVyZW5jZSwgVm9pY2VCcm9hZGNhc3RJbmZvRXZlbnRUeXBlKTtcbiAgICAgICAgY29uc3QgcmVsYXRlZEV2ZW50cyA9IHJlbGF0aW9ucz8uZ2V0UmVsYXRpb25zKCk7XG4gICAgICAgIHJldHVybiAhcmVsYXRlZEV2ZW50cz8uZmluZCgoZXZlbnQ6IE1hdHJpeEV2ZW50KSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gZXZlbnQuZ2V0Q29udGVudCgpPy5zdGF0ZSA9PT0gVm9pY2VCcm9hZGNhc3RJbmZvU3RhdGUuU3RvcHBlZDtcbiAgICAgICAgfSlcbiAgICAgICAgICAgID8gVm9pY2VCcm9hZGNhc3RJbmZvU3RhdGUuU3RhcnRlZFxuICAgICAgICAgICAgOiBWb2ljZUJyb2FkY2FzdEluZm9TdGF0ZS5TdG9wcGVkO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXRUaW1lTGVmdCgpOiBudW1iZXIge1xuICAgICAgICByZXR1cm4gdGhpcy50aW1lTGVmdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXRyaWVzIGZhaWxlZCBhY3Rpb25zIG9uIHJlY29ubmVjdC5cbiAgICAgKi9cbiAgICBwcml2YXRlIG9uUmVjb25uZWN0ID0gYXN5bmMgKCk6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgICAgICAvLyBEbyBub3RoaW5nIGlmIG5vdCBpbiBjb25uZWN0aW9uX2Vycm9yIHN0YXRlLlxuICAgICAgICBpZiAodGhpcy5zdGF0ZSAhPT0gXCJjb25uZWN0aW9uX2Vycm9yXCIpIHJldHVybjtcblxuICAgICAgICAvLyBDb3B5IHRoZSBhcnJheSwgc28gdGhhdCBpdCBpcyBwb3NzaWJsZSB0byByZW1vdmUgZWxlbWVudHMgZnJvbSBpdCB3aGlsZSBpdGVyYXRpbmcgb3ZlciB0aGUgb3JpZ2luYWwuXG4gICAgICAgIGNvbnN0IHRvUmV0cnlDb3B5ID0gWy4uLnRoaXMudG9SZXRyeV07XG5cbiAgICAgICAgZm9yIChjb25zdCByZXRyeUZuIG9mIHRoaXMudG9SZXRyeSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBhd2FpdCByZXRyeUZuKCk7XG4gICAgICAgICAgICAgICAgLy8gU3VjY2Vzc2Z1bGx5IHJldHJpZWQuIFJlbW92ZSBmcm9tIGFycmF5IGNvcHkuXG4gICAgICAgICAgICAgICAgdG9SZXRyeUNvcHkuc3BsaWNlKHRvUmV0cnlDb3B5LmluZGV4T2YocmV0cnlGbiksIDEpO1xuICAgICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAgICAgLy8gVGhlIGN1cnJlbnQgcmV0cnkgY2FsbGJhY2sgZmFpbGVkLiBTdG9wIHRoZSBsb29wLlxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy50b1JldHJ5ID0gdG9SZXRyeUNvcHk7XG5cbiAgICAgICAgaWYgKHRoaXMudG9SZXRyeS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIC8vIEV2ZXJ5dGhpbmcgaGFzIGJlZW4gc3VjY2Vzc2Z1bGx5IHJldHJpZWQuIFJlY292ZXIgZnJvbSBlcnJvciBzdGF0ZSB0byBwYXVzZWQuXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBhdXNlKCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRUaW1lTGVmdCh0aW1lTGVmdDogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGlmICh0aW1lTGVmdCA8PSAwKSB7XG4gICAgICAgICAgICAvLyB0aW1lIGlzIHVwIC0gc3RvcCB0aGUgcmVjb3JkaW5nXG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5zdG9wKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBkbyBuZXZlciBpbmNyZWFzZSB0aW1lIGxlZnQ7IG5vIGFjdGlvbiBpZiBlcXVhbHNcbiAgICAgICAgaWYgKHRpbWVMZWZ0ID49IHRoaXMudGltZUxlZnQpIHJldHVybjtcblxuICAgICAgICB0aGlzLnRpbWVMZWZ0ID0gdGltZUxlZnQ7XG4gICAgICAgIHRoaXMuZW1pdChWb2ljZUJyb2FkY2FzdFJlY29yZGluZ0V2ZW50LlRpbWVMZWZ0Q2hhbmdlZCwgdGltZUxlZnQpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBzdGFydCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0UmVjb3JkZXIoKS5zdGFydCgpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBzdG9wKCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBpZiAodGhpcy5zdGF0ZSA9PT0gVm9pY2VCcm9hZGNhc3RJbmZvU3RhdGUuU3RvcHBlZCkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuc2V0U3RhdGUoVm9pY2VCcm9hZGNhc3RJbmZvU3RhdGUuU3RvcHBlZCk7XG4gICAgICAgIGF3YWl0IHRoaXMuc3RvcFJlY29yZGVyKCk7XG4gICAgICAgIGF3YWl0IHRoaXMuc2VuZEluZm9TdGF0ZUV2ZW50KFZvaWNlQnJvYWRjYXN0SW5mb1N0YXRlLlN0b3BwZWQpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBwYXVzZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgLy8gc3RvcHBlZCBvciBhbHJlYWR5IHBhdXNlZCByZWNvcmRpbmdzIGNhbm5vdCBiZSBwYXVzZWRcbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgIFtWb2ljZUJyb2FkY2FzdEluZm9TdGF0ZS5TdG9wcGVkLCBWb2ljZUJyb2FkY2FzdEluZm9TdGF0ZS5QYXVzZWRdIGFzIFZvaWNlQnJvYWRjYXN0UmVjb3JkaW5nU3RhdGVbXVxuICAgICAgICAgICAgKS5pbmNsdWRlcyh0aGlzLnN0YXRlKVxuICAgICAgICApXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5zZXRTdGF0ZShWb2ljZUJyb2FkY2FzdEluZm9TdGF0ZS5QYXVzZWQpO1xuICAgICAgICBhd2FpdCB0aGlzLnN0b3BSZWNvcmRlcigpO1xuICAgICAgICBhd2FpdCB0aGlzLnNlbmRJbmZvU3RhdGVFdmVudChWb2ljZUJyb2FkY2FzdEluZm9TdGF0ZS5QYXVzZWQpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyByZXN1bWUoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGlmICh0aGlzLnN0YXRlICE9PSBWb2ljZUJyb2FkY2FzdEluZm9TdGF0ZS5QYXVzZWQpIHJldHVybjtcblxuICAgICAgICB0aGlzLnNldFN0YXRlKFZvaWNlQnJvYWRjYXN0SW5mb1N0YXRlLlJlc3VtZWQpO1xuICAgICAgICBhd2FpdCB0aGlzLmdldFJlY29yZGVyKCkuc3RhcnQoKTtcbiAgICAgICAgYXdhaXQgdGhpcy5zZW5kSW5mb1N0YXRlRXZlbnQoVm9pY2VCcm9hZGNhc3RJbmZvU3RhdGUuUmVzdW1lZCk7XG4gICAgfVxuXG4gICAgcHVibGljIHRvZ2dsZSA9IGFzeW5jICgpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgICAgaWYgKHRoaXMuZ2V0U3RhdGUoKSA9PT0gVm9pY2VCcm9hZGNhc3RJbmZvU3RhdGUuUGF1c2VkKSByZXR1cm4gdGhpcy5yZXN1bWUoKTtcblxuICAgICAgICBpZiAoXG4gICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgW1ZvaWNlQnJvYWRjYXN0SW5mb1N0YXRlLlN0YXJ0ZWQsIFZvaWNlQnJvYWRjYXN0SW5mb1N0YXRlLlJlc3VtZWRdIGFzIFZvaWNlQnJvYWRjYXN0UmVjb3JkaW5nU3RhdGVbXVxuICAgICAgICAgICAgKS5pbmNsdWRlcyh0aGlzLmdldFN0YXRlKCkpXG4gICAgICAgICkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGF1c2UoKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBwdWJsaWMgZ2V0U3RhdGUoKTogVm9pY2VCcm9hZGNhc3RSZWNvcmRpbmdTdGF0ZSB7XG4gICAgICAgIHJldHVybiB0aGlzLnN0YXRlO1xuICAgIH1cblxuICAgIHByaXZhdGUgZ2V0UmVjb3JkZXIoKTogVm9pY2VCcm9hZGNhc3RSZWNvcmRlciB7XG4gICAgICAgIGlmICghdGhpcy5yZWNvcmRlcikge1xuICAgICAgICAgICAgdGhpcy5yZWNvcmRlciA9IGNyZWF0ZVZvaWNlQnJvYWRjYXN0UmVjb3JkZXIoKTtcbiAgICAgICAgICAgIHRoaXMucmVjb3JkZXIub24oVm9pY2VCcm9hZGNhc3RSZWNvcmRlckV2ZW50LkNodW5rUmVjb3JkZWQsIHRoaXMub25DaHVua1JlY29yZGVkKTtcbiAgICAgICAgICAgIHRoaXMucmVjb3JkZXIub24oVm9pY2VCcm9hZGNhc3RSZWNvcmRlckV2ZW50LkN1cnJlbnRDaHVua0xlbmd0aFVwZGF0ZWQsIHRoaXMub25DdXJyZW50Q2h1bmtMZW5ndGhVcGRhdGVkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLnJlY29yZGVyO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBkZXN0cm95KCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBpZiAodGhpcy5yZWNvcmRlcikge1xuICAgICAgICAgICAgdGhpcy5yZWNvcmRlci5zdG9wKCk7XG4gICAgICAgICAgICB0aGlzLnJlY29yZGVyLmRlc3Ryb3koKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuaW5mb0V2ZW50Lm9mZihNYXRyaXhFdmVudEV2ZW50LkJlZm9yZVJlZGFjdGlvbiwgdGhpcy5vbkJlZm9yZVJlZGFjdGlvbik7XG4gICAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG4gICAgICAgIGRpcy51bnJlZ2lzdGVyKHRoaXMuZGlzcGF0Y2hlclJlZik7XG4gICAgICAgIHRoaXMuY2h1bmtFdmVudHMgPSBuZXcgVm9pY2VCcm9hZGNhc3RDaHVua0V2ZW50cygpO1xuICAgICAgICB0aGlzLmNodW5rUmVsYXRpb25IZWxwZXIuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLmNsaWVudC5vZmYoQ2xpZW50RXZlbnQuU3luYywgdGhpcy5yZWNvbm5lY3RlZExpc3RlbmVyKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIG9uQmVmb3JlUmVkYWN0aW9uID0gKCk6IHZvaWQgPT4ge1xuICAgICAgICBpZiAodGhpcy5nZXRTdGF0ZSgpICE9PSBWb2ljZUJyb2FkY2FzdEluZm9TdGF0ZS5TdG9wcGVkKSB7XG4gICAgICAgICAgICB0aGlzLnNldFN0YXRlKFZvaWNlQnJvYWRjYXN0SW5mb1N0YXRlLlN0b3BwZWQpO1xuICAgICAgICAgICAgLy8gZGVzdHJveSBjbGVhbnMgdXAgZXZlcnl0aGluZ1xuICAgICAgICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBvbkFjdGlvbiA9IChwYXlsb2FkOiBBY3Rpb25QYXlsb2FkKTogdm9pZCA9PiB7XG4gICAgICAgIGlmIChwYXlsb2FkLmFjdGlvbiAhPT0gXCJjYWxsX3N0YXRlXCIpIHJldHVybjtcblxuICAgICAgICAvLyBwYXVzZSBvbiBhbnkgY2FsbCBhY3Rpb25cbiAgICAgICAgdGhpcy5wYXVzZSgpO1xuICAgIH07XG5cbiAgICBwcml2YXRlIHNldFN0YXRlKHN0YXRlOiBWb2ljZUJyb2FkY2FzdFJlY29yZGluZ1N0YXRlKTogdm9pZCB7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBzdGF0ZTtcbiAgICAgICAgdGhpcy5lbWl0KFZvaWNlQnJvYWRjYXN0UmVjb3JkaW5nRXZlbnQuU3RhdGVDaGFuZ2VkLCB0aGlzLnN0YXRlKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIG9uQ3VycmVudENodW5rTGVuZ3RoVXBkYXRlZCA9IChjdXJyZW50Q2h1bmtMZW5ndGg6IG51bWJlcik6IHZvaWQgPT4ge1xuICAgICAgICB0aGlzLnNldFRpbWVMZWZ0KHRoaXMubWF4TGVuZ3RoIC0gdGhpcy5jaHVua0V2ZW50cy5nZXRMZW5ndGhTZWNvbmRzKCkgLSBjdXJyZW50Q2h1bmtMZW5ndGgpO1xuICAgIH07XG5cbiAgICBwcml2YXRlIG9uQ2h1bmtSZWNvcmRlZCA9IGFzeW5jIChjaHVuazogQ2h1bmtSZWNvcmRlZFBheWxvYWQpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgICAgY29uc3QgdXBsb2FkQW5kU2VuZEZuID0gYXN5bmMgKCk6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgICAgICAgICAgY29uc3QgeyB1cmwsIGZpbGUgfSA9IGF3YWl0IHRoaXMudXBsb2FkRmlsZShjaHVuayk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnNlbmRWb2ljZU1lc3NhZ2UoY2h1bmssIHVybCwgZmlsZSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgYXdhaXQgdGhpcy5jYWxsV2l0aFJldHJ5KHVwbG9hZEFuZFNlbmRGbik7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIG9uIGNvbm5lY3Rpb24gZXJyb3JzLlxuICAgICAqIEl0IHNldHMgdGhlIGNvbm5lY3Rpb24gZXJyb3Igc3RhdGUgYW5kIHN0b3BzIHRoZSByZWNvcmRlci5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIG9uQ29ubmVjdGlvbkVycm9yKCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICB0aGlzLnBsYXlDb25uZWN0aW9uRXJyb3JBdWRpb05vdGlmaWNhdGlvbigpLmNhdGNoKCgpID0+IHtcbiAgICAgICAgICAgIC8vIEVycm9yIGxvZ2dlZCBpbiBwbGF5Q29ubmVjdGlvbkVycm9yQXVkaW9Ob3RpZmljYXRpb24oKS5cbiAgICAgICAgfSk7XG4gICAgICAgIGF3YWl0IHRoaXMuc3RvcFJlY29yZGVyKGZhbHNlKTtcbiAgICAgICAgdGhpcy5zZXRTdGF0ZShcImNvbm5lY3Rpb25fZXJyb3JcIik7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBwbGF5Q29ubmVjdGlvbkVycm9yQXVkaW9Ob3RpZmljYXRpb24oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGlmIChsb2NhbE5vdGlmaWNhdGlvbnNBcmVTaWxlbmNlZCh0aGlzLmNsaWVudCkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEF1ZGlvIGZpbGVzIGFyZSBhZGRlZCB0byB0aGUgZG9jdW1lbnQgaW4gRWxlbWVudCBXZWIuXG4gICAgICAgIC8vIFNlZSA8YXVkaW8+IGVsZW1lbnRzIGluIGh0dHBzOi8vZ2l0aHViLmNvbS92ZWN0b3ItaW0vZWxlbWVudC13ZWIvYmxvYi9kZXZlbG9wL3NyYy92ZWN0b3IvaW5kZXguaHRtbFxuICAgICAgICBjb25zdCBhdWRpb0VsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxBdWRpb0VsZW1lbnQ+KFwiYXVkaW8jZXJyb3JBdWRpb1wiKTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgYXVkaW9FbGVtZW50Py5wbGF5KCk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGxvZ2dlci53YXJuKFwiZXJyb3IgcGxheWluZyAnZXJyb3JBdWRpbydcIiwgZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHVwbG9hZEZpbGUoY2h1bms6IENodW5rUmVjb3JkZWRQYXlsb2FkKTogUmV0dXJuVHlwZTx0eXBlb2YgdXBsb2FkRmlsZT4ge1xuICAgICAgICByZXR1cm4gdXBsb2FkRmlsZShcbiAgICAgICAgICAgIHRoaXMuY2xpZW50LFxuICAgICAgICAgICAgdGhpcy5yb29tSWQsXG4gICAgICAgICAgICBuZXcgQmxvYihbY2h1bmsuYnVmZmVyXSwge1xuICAgICAgICAgICAgICAgIHR5cGU6IHRoaXMuZ2V0UmVjb3JkZXIoKS5jb250ZW50VHlwZSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICApO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2VuZFZvaWNlTWVzc2FnZShjaHVuazogQ2h1bmtSZWNvcmRlZFBheWxvYWQsIHVybD86IHN0cmluZywgZmlsZT86IElFbmNyeXB0ZWRGaWxlKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBJbmNyZW1lbnQgdGhlIGxhc3Qgc2VxdWVuY2UgbnVtYmVyIGFuZCB1c2UgaXQgZm9yIHRoaXMgbWVzc2FnZS5cbiAgICAgICAgICogRG9uZSBvdXRzaWRlIG9mIHRoZSBzZW5kTWVzc2FnZUZuIHRvIGdldCBhIHNjb3BlZCB2YWx1ZS5cbiAgICAgICAgICogQWxzbyBzZWUge0BsaW5rIFZvaWNlQnJvYWRjYXN0UmVjb3JkaW5nLnNlcXVlbmNlfS5cbiAgICAgICAgICovXG4gICAgICAgIGNvbnN0IHNlcXVlbmNlID0gKyt0aGlzLnNlcXVlbmNlO1xuXG4gICAgICAgIGNvbnN0IHNlbmRNZXNzYWdlRm4gPSBhc3luYyAoKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICAgICAgICBjb25zdCBjb250ZW50ID0gY3JlYXRlVm9pY2VNZXNzYWdlQ29udGVudChcbiAgICAgICAgICAgICAgICB1cmwsXG4gICAgICAgICAgICAgICAgdGhpcy5nZXRSZWNvcmRlcigpLmNvbnRlbnRUeXBlLFxuICAgICAgICAgICAgICAgIE1hdGgucm91bmQoY2h1bmsubGVuZ3RoICogMTAwMCksXG4gICAgICAgICAgICAgICAgY2h1bmsuYnVmZmVyLmxlbmd0aCxcbiAgICAgICAgICAgICAgICBmaWxlLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGNvbnRlbnRbXCJtLnJlbGF0ZXNfdG9cIl0gPSB7XG4gICAgICAgICAgICAgICAgcmVsX3R5cGU6IFJlbGF0aW9uVHlwZS5SZWZlcmVuY2UsXG4gICAgICAgICAgICAgICAgZXZlbnRfaWQ6IHRoaXMuaW5mb0V2ZW50SWQsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgY29udGVudFtcImlvLmVsZW1lbnQudm9pY2VfYnJvYWRjYXN0X2NodW5rXCJdID0ge1xuICAgICAgICAgICAgICAgIHNlcXVlbmNlLFxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgYXdhaXQgdGhpcy5jbGllbnQuc2VuZE1lc3NhZ2UodGhpcy5yb29tSWQsIGNvbnRlbnQpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGF3YWl0IHRoaXMuY2FsbFdpdGhSZXRyeShzZW5kTWVzc2FnZUZuKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZW5kcyBhbiBpbmZvIHN0YXRlIGV2ZW50IHdpdGggZ2l2ZW4gc3RhdGUuXG4gICAgICogT24gZXJyb3Igc3RvcmVzIGEgcmVzZW5kIGZ1bmN0aW9uIGFuZCBzZXRTdGF0ZShzdGF0ZSkgaW4ge0BsaW5rIHRvUmV0cnl9IGFuZFxuICAgICAqIHNldHMgdGhlIGJyb2FkY2FzdCBzdGF0ZSB0byBjb25uZWN0aW9uX2Vycm9yLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgc2VuZEluZm9TdGF0ZUV2ZW50KHN0YXRlOiBWb2ljZUJyb2FkY2FzdEluZm9TdGF0ZSk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCBzZW5kRXZlbnRGbiA9IGFzeW5jICgpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuY2xpZW50LnNlbmRTdGF0ZUV2ZW50KFxuICAgICAgICAgICAgICAgIHRoaXMucm9vbUlkLFxuICAgICAgICAgICAgICAgIFZvaWNlQnJvYWRjYXN0SW5mb0V2ZW50VHlwZSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGRldmljZV9pZDogdGhpcy5jbGllbnQuZ2V0RGV2aWNlSWQoKSxcbiAgICAgICAgICAgICAgICAgICAgc3RhdGUsXG4gICAgICAgICAgICAgICAgICAgIGxhc3RfY2h1bmtfc2VxdWVuY2U6IHRoaXMuc2VxdWVuY2UsXG4gICAgICAgICAgICAgICAgICAgIFtcIm0ucmVsYXRlc190b1wiXToge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVsX3R5cGU6IFJlbGF0aW9uVHlwZS5SZWZlcmVuY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudF9pZDogdGhpcy5pbmZvRXZlbnRJZCxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9IGFzIFZvaWNlQnJvYWRjYXN0SW5mb0V2ZW50Q29udGVudCxcbiAgICAgICAgICAgICAgICB0aGlzLmNsaWVudC5nZXRTYWZlVXNlcklkKCksXG4gICAgICAgICAgICApO1xuICAgICAgICB9O1xuXG4gICAgICAgIGF3YWl0IHRoaXMuY2FsbFdpdGhSZXRyeShzZW5kRXZlbnRGbik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbHMgdGhlIGZ1bmN0aW9uLlxuICAgICAqIE9uIGZhaWx1cmUgYWRkcyBpdCB0byB0aGUgcmV0cnkgbGlzdCBhbmQgdHJpZ2dlcnMgY29ubmVjdGlvbiBlcnJvci5cbiAgICAgKiB7QGxpbmsgdG9SZXRyeX1cbiAgICAgKiB7QGxpbmsgb25Db25uZWN0aW9uRXJyb3J9XG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBjYWxsV2l0aFJldHJ5KHJldHJ5QWJsZUZuOiAoKSA9PiBQcm9taXNlPHZvaWQ+KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCByZXRyeUFibGVGbigpO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHRoaXMudG9SZXRyeS5wdXNoKHJldHJ5QWJsZUZuKTtcbiAgICAgICAgICAgIHRoaXMub25Db25uZWN0aW9uRXJyb3IoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc3RvcFJlY29yZGVyKGVtaXQgPSB0cnVlKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGlmICghdGhpcy5yZWNvcmRlcikge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGxhc3RDaHVuayA9IGF3YWl0IHRoaXMucmVjb3JkZXIuc3RvcCgpO1xuICAgICAgICAgICAgaWYgKGxhc3RDaHVuayAmJiBlbWl0KSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5vbkNodW5rUmVjb3JkZWQobGFzdENodW5rKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBsb2dnZXIud2FybihcImVycm9yIHN0b3BwaW5nIHZvaWNlIGJyb2FkY2FzdCByZWNvcmRlclwiLCBlcnIpO1xuICAgICAgICB9XG4gICAgfVxufVxuIl0s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