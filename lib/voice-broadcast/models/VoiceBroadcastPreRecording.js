"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.VoiceBroadcastPreRecording = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _typedEventEmitter = require("matrix-js-sdk/src/models/typed-event-emitter");
var _startNewVoiceBroadcastRecording = require("../utils/startNewVoiceBroadcastRecording");
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

class VoiceBroadcastPreRecording extends _typedEventEmitter.TypedEventEmitter {
  constructor(room, sender, client, playbacksStore, recordingsStore) {
    super();
    this.room = room;
    this.sender = sender;
    this.client = client;
    this.playbacksStore = playbacksStore;
    this.recordingsStore = recordingsStore;
    (0, _defineProperty2.default)(this, "start", async () => {
      await (0, _startNewVoiceBroadcastRecording.startNewVoiceBroadcastRecording)(this.room, this.client, this.playbacksStore, this.recordingsStore);
      this.emit("dismiss", this);
    });
    (0, _defineProperty2.default)(this, "cancel", () => {
      this.emit("dismiss", this);
    });
  }
  destroy() {
    this.removeAllListeners();
  }
}
exports.VoiceBroadcastPreRecording = VoiceBroadcastPreRecording;
//# sourceMappingURL=VoiceBroadcastPreRecording.js.map