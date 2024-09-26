"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getForwardableEvent = void 0;
var _polls = require("matrix-js-sdk/src/@types/polls");
var _beacon = require("matrix-js-sdk/src/@types/beacon");
var _getShareableLocation = require("../../utils/beacon/getShareableLocation");
var _types = require("../../voice-broadcast/types");
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
 * Get forwardable event for a given event
 * If an event is not forwardable return null
 */
const getForwardableEvent = (event, cli) => {
  if (_polls.M_POLL_START.matches(event.getType()) || _polls.M_POLL_END.matches(event.getType())) {
    return null;
  }
  if (event.getType() === _types.VoiceBroadcastInfoEventType) return null;

  // Live location beacons should forward their latest location as a static pin location
  // If the beacon is not live, or doesn't have a location forwarding is not allowed
  if (_beacon.M_BEACON_INFO.matches(event.getType())) {
    return (0, _getShareableLocation.getShareableLocationEventForBeacon)(event, cli);
  }
  return event;
};
exports.getForwardableEvent = getForwardableEvent;
//# sourceMappingURL=getForwardableEvent.js.map