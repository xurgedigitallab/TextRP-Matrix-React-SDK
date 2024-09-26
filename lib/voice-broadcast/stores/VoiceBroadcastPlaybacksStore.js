"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.VoiceBroadcastPlaybacksStoreEvent = exports.VoiceBroadcastPlaybacksStore = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _typedEventEmitter = require("matrix-js-sdk/src/models/typed-event-emitter");
var _ = require("..");
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
let VoiceBroadcastPlaybacksStoreEvent = /*#__PURE__*/function (VoiceBroadcastPlaybacksStoreEvent) {
  VoiceBroadcastPlaybacksStoreEvent["CurrentChanged"] = "current_changed";
  return VoiceBroadcastPlaybacksStoreEvent;
}({});
exports.VoiceBroadcastPlaybacksStoreEvent = VoiceBroadcastPlaybacksStoreEvent;
/**
 * This store manages VoiceBroadcastPlaybacks:
 * - access the currently playing voice broadcast
 * - ensures that only once broadcast is playing at a time
 */
class VoiceBroadcastPlaybacksStore extends _typedEventEmitter.TypedEventEmitter {
  constructor(recordings) {
    super();
    this.recordings = recordings;
    (0, _defineProperty2.default)(this, "current", null);
    /** Playbacks indexed by their info event id. */
    (0, _defineProperty2.default)(this, "playbacks", new Map());
    (0, _defineProperty2.default)(this, "onPlaybackStateChanged", (state, playback) => {
      switch (state) {
        case _.VoiceBroadcastPlaybackState.Buffering:
        case _.VoiceBroadcastPlaybackState.Playing:
          this.pauseExcept(playback);
          this.setCurrent(playback);
          break;
        case _.VoiceBroadcastPlaybackState.Stopped:
          this.clearCurrent();
          break;
      }
    });
  }
  setCurrent(current) {
    if (this.current === current) return;
    this.current = current;
    this.addPlayback(current);
    this.emit(VoiceBroadcastPlaybacksStoreEvent.CurrentChanged, current);
  }
  clearCurrent() {
    if (this.current === null) return;
    this.current = null;
    this.emit(VoiceBroadcastPlaybacksStoreEvent.CurrentChanged, null);
  }
  getCurrent() {
    return this.current;
  }
  getByInfoEvent(infoEvent, client) {
    const infoEventId = infoEvent.getId();
    if (!this.playbacks.has(infoEventId)) {
      this.addPlayback(new _.VoiceBroadcastPlayback(infoEvent, client, this.recordings));
    }
    return this.playbacks.get(infoEventId);
  }
  addPlayback(playback) {
    const infoEventId = playback.infoEvent.getId();
    if (this.playbacks.has(infoEventId)) return;
    this.playbacks.set(infoEventId, playback);
    playback.on(_.VoiceBroadcastPlaybackEvent.StateChanged, this.onPlaybackStateChanged);
  }
  pauseExcept(playbackNotToPause) {
    for (const playback of this.playbacks.values()) {
      if (playback !== playbackNotToPause) {
        playback.pause();
      }
    }
  }
  destroy() {
    this.removeAllListeners();
    for (const playback of this.playbacks.values()) {
      playback.off(_.VoiceBroadcastPlaybackEvent.StateChanged, this.onPlaybackStateChanged);
    }
    this.playbacks = new Map();
  }
}
exports.VoiceBroadcastPlaybacksStore = VoiceBroadcastPlaybacksStore;
//# sourceMappingURL=VoiceBroadcastPlaybacksStore.js.map