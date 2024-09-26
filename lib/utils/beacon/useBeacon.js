"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useBeacon = void 0;
var _react = require("react");
var _matrix = require("matrix-js-sdk/src/matrix");
var _MatrixClientContext = _interopRequireDefault(require("../../contexts/MatrixClientContext"));
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

const useBeacon = beaconInfoEvent => {
  const matrixClient = (0, _react.useContext)(_MatrixClientContext.default);
  const [beacon, setBeacon] = (0, _react.useState)();
  (0, _react.useEffect)(() => {
    const roomId = beaconInfoEvent.getRoomId();
    const beaconIdentifier = (0, _matrix.getBeaconInfoIdentifier)(beaconInfoEvent);
    const room = matrixClient?.getRoom(roomId);
    const beaconInstance = room?.currentState.beacons.get(beaconIdentifier);

    // TODO could this be less stupid?

    // Beacons are identified by their `state_key`,
    // where `state_key` is always owner mxid for access control.
    // Thus, only one beacon is allowed per-user per-room.
    // See https://github.com/matrix-org/matrix-spec-proposals/pull/3672
    // When a user creates a new beacon any previous
    // beacon is replaced and should assume a 'stopped' state
    // Here we check that this event is the latest beacon for this user
    // If it is not the beacon instance is set to undefined.
    // Retired beacons don't get a beacon instance.
    if (beaconInstance?.beaconInfoId === beaconInfoEvent.getId()) {
      setBeacon(beaconInstance);
    } else {
      setBeacon(undefined);
    }
  }, [beaconInfoEvent, matrixClient]);

  // beacon update will fire when this beacon is superseded
  // check the updated event id for equality to the matrix event
  const beaconInstanceEventId = (0, _useEventEmitter.useEventEmitterState)(beacon, _matrix.BeaconEvent.Update, () => beacon?.beaconInfoId);
  (0, _react.useEffect)(() => {
    if (beaconInstanceEventId && beaconInstanceEventId !== beaconInfoEvent.getId()) {
      setBeacon(undefined);
    }
  }, [beaconInstanceEventId, beaconInfoEvent]);
  (0, _react.useEffect)(() => {
    if (beacon) {
      beacon.monitorLiveness();
    }
  }, [beacon]);
  return beacon;
};
exports.useBeacon = useBeacon;
//# sourceMappingURL=useBeacon.js.map