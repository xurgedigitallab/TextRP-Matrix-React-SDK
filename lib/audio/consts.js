"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WORKLET_NAME = exports.PayloadEvent = exports.PLAYBACK_WAVEFORM_SAMPLES = exports.DEFAULT_WAVEFORM = void 0;
var _arrays = require("../utils/arrays");
/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

const WORKLET_NAME = "mx-voice-worklet";
exports.WORKLET_NAME = WORKLET_NAME;
let PayloadEvent = /*#__PURE__*/function (PayloadEvent) {
  PayloadEvent["Timekeep"] = "timekeep";
  PayloadEvent["AmplitudeMark"] = "amplitude_mark";
  return PayloadEvent;
}({});
exports.PayloadEvent = PayloadEvent;
const PLAYBACK_WAVEFORM_SAMPLES = 39;
exports.PLAYBACK_WAVEFORM_SAMPLES = PLAYBACK_WAVEFORM_SAMPLES;
const DEFAULT_WAVEFORM = (0, _arrays.arraySeed)(0, PLAYBACK_WAVEFORM_SAMPLES);
exports.DEFAULT_WAVEFORM = DEFAULT_WAVEFORM;
//# sourceMappingURL=consts.js.map