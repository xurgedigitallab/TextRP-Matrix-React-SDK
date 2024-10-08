"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getShareableLocationEvent = void 0;
var _beacon = require("matrix-js-sdk/src/@types/beacon");
var _getShareableLocation = require("../../utils/beacon/getShareableLocation");
var _EventUtils = require("../../utils/EventUtils");
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
 * Get event that is shareable as a location
 * If an event does not have a shareable location, return null
 */
const getShareableLocationEvent = (event, cli) => {
  if ((0, _EventUtils.isLocationEvent)(event)) {
    return event;
  }
  if (_beacon.M_BEACON_INFO.matches(event.getType())) {
    return (0, _getShareableLocation.getShareableLocationEventForBeacon)(event, cli);
  }
  return null;
};
exports.getShareableLocationEvent = getShareableLocationEvent;
//# sourceMappingURL=getShareableLocationEvent.js.map