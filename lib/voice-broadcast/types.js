"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.VoiceBroadcastInfoState = exports.VoiceBroadcastInfoEventType = exports.VoiceBroadcastChunkEventType = void 0;
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

const VoiceBroadcastInfoEventType = "io.element.voice_broadcast_info";
exports.VoiceBroadcastInfoEventType = VoiceBroadcastInfoEventType;
const VoiceBroadcastChunkEventType = "io.element.voice_broadcast_chunk";
exports.VoiceBroadcastChunkEventType = VoiceBroadcastChunkEventType;
let VoiceBroadcastInfoState = /*#__PURE__*/function (VoiceBroadcastInfoState) {
  VoiceBroadcastInfoState["Started"] = "started";
  VoiceBroadcastInfoState["Paused"] = "paused";
  VoiceBroadcastInfoState["Resumed"] = "resumed";
  VoiceBroadcastInfoState["Stopped"] = "stopped";
  return VoiceBroadcastInfoState;
}({});
exports.VoiceBroadcastInfoState = VoiceBroadcastInfoState;
//# sourceMappingURL=types.js.map