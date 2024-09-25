"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.VoiceBroadcastRecordingsStoreEvent = exports.VoiceBroadcastRecordingsStore = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _typedEventEmitter = require("matrix-js-sdk/src/models/typed-event-emitter");
var _ = require("..");
/*
Copyright 2022-2023 The Matrix.org Foundation C.I.C.

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
let VoiceBroadcastRecordingsStoreEvent = /*#__PURE__*/function (VoiceBroadcastRecordingsStoreEvent) {
  VoiceBroadcastRecordingsStoreEvent["CurrentChanged"] = "current_changed";
  return VoiceBroadcastRecordingsStoreEvent;
}({});
exports.VoiceBroadcastRecordingsStoreEvent = VoiceBroadcastRecordingsStoreEvent;
/**
 * This store provides access to the current and specific Voice Broadcast recordings.
 */
class VoiceBroadcastRecordingsStore extends _typedEventEmitter.TypedEventEmitter {
  constructor() {
    super();
    (0, _defineProperty2.default)(this, "current", null);
    (0, _defineProperty2.default)(this, "recordings", new Map());
    (0, _defineProperty2.default)(this, "onCurrentStateChanged", state => {
      if (state === _.VoiceBroadcastInfoState.Stopped) {
        this.clearCurrent();
      }
    });
  }
  setCurrent(current) {
    if (this.current === current) return;
    const infoEventId = current.infoEvent.getId();
    if (!infoEventId) {
      throw new Error("Got broadcast info event without Id");
    }
    if (this.current) {
      this.current.off(_.VoiceBroadcastRecordingEvent.StateChanged, this.onCurrentStateChanged);
    }
    this.current = current;
    this.current.on(_.VoiceBroadcastRecordingEvent.StateChanged, this.onCurrentStateChanged);
    this.recordings.set(infoEventId, current);
    this.emit(VoiceBroadcastRecordingsStoreEvent.CurrentChanged, current);
  }
  getCurrent() {
    return this.current;
  }
  hasCurrent() {
    return this.current !== null;
  }
  clearCurrent() {
    if (!this.current) return;
    this.current.off(_.VoiceBroadcastRecordingEvent.StateChanged, this.onCurrentStateChanged);
    this.current = null;
    this.emit(VoiceBroadcastRecordingsStoreEvent.CurrentChanged, null);
  }
  getByInfoEvent(infoEvent, client) {
    const infoEventId = infoEvent.getId();
    if (!infoEventId) {
      throw new Error("Got broadcast info event without Id");
    }
    const recording = this.recordings.get(infoEventId) || new _.VoiceBroadcastRecording(infoEvent, client);
    this.recordings.set(infoEventId, recording);
    return recording;
  }
}
exports.VoiceBroadcastRecordingsStore = VoiceBroadcastRecordingsStore;
//# sourceMappingURL=VoiceBroadcastRecordingsStore.js.map