"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.shouldDisplayAsBeaconTile = void 0;
var _beacon = require("matrix-js-sdk/src/@types/beacon");
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
 * beacon_info events without live property set to true
 * should be displayed in the timeline
 */
const shouldDisplayAsBeaconTile = event => _beacon.M_BEACON_INFO.matches(event.getType()) && (event.getContent()?.live ||
// redacted beacons should show 'message deleted' tile
event.isRedacted());
exports.shouldDisplayAsBeaconTile = shouldDisplayAsBeaconTile;
//# sourceMappingURL=timeline.js.map