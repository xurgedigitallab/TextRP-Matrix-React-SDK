"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getLocationShareErrorMessage = exports.LocationShareError = void 0;
var _languageHandler = require("../../languageHandler");
/*
Copyright 2022 The Matrix.org Foundation C.I.C

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
let LocationShareError = /*#__PURE__*/function (LocationShareError) {
  LocationShareError["MapStyleUrlNotConfigured"] = "MapStyleUrlNotConfigured";
  LocationShareError["MapStyleUrlNotReachable"] = "MapStyleUrlNotReachable";
  LocationShareError["WebGLNotEnabled"] = "WebGLNotEnabled";
  LocationShareError["Default"] = "Default";
  return LocationShareError;
}({});
exports.LocationShareError = LocationShareError;
const getLocationShareErrorMessage = errorType => {
  switch (errorType) {
    case LocationShareError.MapStyleUrlNotConfigured:
      return (0, _languageHandler._t)("This homeserver is not configured to display maps.");
    case LocationShareError.WebGLNotEnabled:
      return (0, _languageHandler._t)("WebGL is required to display maps, please enable it in your browser settings.");
    case LocationShareError.MapStyleUrlNotReachable:
    default:
      return (0, _languageHandler._t)(`This homeserver is not configured correctly to display maps, ` + `or the configured map server may be unreachable.`);
  }
};
exports.getLocationShareErrorMessage = getLocationShareErrorMessage;
//# sourceMappingURL=LocationShareErrors.js.map