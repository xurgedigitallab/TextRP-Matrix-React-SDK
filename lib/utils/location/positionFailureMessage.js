"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.positionFailureMessage = void 0;
var _languageHandler = require("../../languageHandler");
var _SdkConfig = _interopRequireDefault(require("../../SdkConfig"));
/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
 * Get a localised error message for GeolocationPositionError error codes
 * @param code - error code from GeolocationPositionError
 * @returns
 */
const positionFailureMessage = code => {
  const brand = _SdkConfig.default.get().brand;
  switch (code) {
    case 1:
      return (0, _languageHandler._t)("%(brand)s was denied permission to fetch your location. " + "Please allow location access in your browser settings.", {
        brand
      });
    case 2:
      return (0, _languageHandler._t)("Failed to fetch your location. Please try again later.");
    case 3:
      return (0, _languageHandler._t)("Timed out trying to fetch your location. Please try again later.");
    case 4:
      return (0, _languageHandler._t)("Unknown error fetching location. Please try again later.");
  }
};
exports.positionFailureMessage = positionFailureMessage;
//# sourceMappingURL=positionFailureMessage.js.map