"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getChunkLength = void 0;
var _SdkConfig = _interopRequireWildcard(require("../../SdkConfig"));
var _Settings = require("../../settings/Settings");
var _SettingsStore = _interopRequireDefault(require("../../settings/SettingsStore"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
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

/**
 * Returns the target chunk length for voice broadcasts:
 * - If {@see Features.VoiceBroadcastForceSmallChunks} is enabled uses 15s chunk length
 * - Otherwise to get the value from the voice_broadcast.chunk_length config
 * - If that fails from DEFAULTS
 * - If that fails fall back to 120 (two minutes)
 */
const getChunkLength = () => {
  if (_SettingsStore.default.getValue(_Settings.Features.VoiceBroadcastForceSmallChunks)) return 15;
  return _SdkConfig.default.get("voice_broadcast")?.chunk_length || _SdkConfig.DEFAULTS.voice_broadcast?.chunk_length || 120;
};
exports.getChunkLength = getChunkLength;
//# sourceMappingURL=getChunkLength.js.map