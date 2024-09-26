"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useLiveBeacons = void 0;
var _matrix = require("matrix-js-sdk/src/matrix");
var _useEventEmitter = require("../../hooks/useEventEmitter");
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
 * Returns an array of all live beacon ids for a given room
 *
 * Beacons are removed from array when they become inactive
 */
const useLiveBeacons = (roomId, matrixClient) => {
  const room = matrixClient.getRoom(roomId);
  const liveBeacons = (0, _useEventEmitter.useEventEmitterState)(room?.currentState, _matrix.RoomStateEvent.BeaconLiveness, () => room?.currentState?.liveBeaconIds.map(beaconIdentifier => room.currentState.beacons.get(beaconIdentifier)) || []);
  return liveBeacons;
};
exports.useLiveBeacons = useLiveBeacons;
//# sourceMappingURL=useLiveBeacons.js.map