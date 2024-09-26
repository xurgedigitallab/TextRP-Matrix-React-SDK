"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useOwnLiveBeacons = void 0;
var _react = require("react");
var _useEventEmitter = require("../../hooks/useEventEmitter");
var _OwnBeaconStore = require("../../stores/OwnBeaconStore");
var _duration = require("./duration");
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
 * Monitor the current users own beacons
 * While current implementation only allows one live beacon per user per room
 * In future it will be possible to have multiple live beacons in one room
 * Select the latest expiry to display,
 * and kill all beacons on stop sharing
 */
const useOwnLiveBeacons = liveBeaconIds => {
  const [stoppingInProgress, setStoppingInProgress] = (0, _react.useState)(false);
  const hasLocationPublishError = (0, _useEventEmitter.useEventEmitterState)(_OwnBeaconStore.OwnBeaconStore.instance, _OwnBeaconStore.OwnBeaconStoreEvent.LocationPublishError, () => liveBeaconIds.some(_OwnBeaconStore.OwnBeaconStore.instance.beaconHasLocationPublishError));
  const hasStopSharingError = (0, _useEventEmitter.useEventEmitterState)(_OwnBeaconStore.OwnBeaconStore.instance, _OwnBeaconStore.OwnBeaconStoreEvent.BeaconUpdateError, () => liveBeaconIds.some(id => _OwnBeaconStore.OwnBeaconStore.instance.beaconUpdateErrors.has(id)));
  (0, _react.useEffect)(() => {
    if (hasStopSharingError) {
      setStoppingInProgress(false);
    }
  }, [hasStopSharingError]);

  // reset stopping in progress on change in live ids
  (0, _react.useEffect)(() => {
    setStoppingInProgress(false);
  }, [liveBeaconIds]);

  // select the beacon with latest expiry to display expiry time
  const beacon = liveBeaconIds.map(beaconId => _OwnBeaconStore.OwnBeaconStore.instance.getBeaconById(beaconId)).sort(_duration.sortBeaconsByLatestExpiry).shift();
  const onStopSharing = async () => {
    setStoppingInProgress(true);
    try {
      await Promise.all(liveBeaconIds.map(beaconId => _OwnBeaconStore.OwnBeaconStore.instance.stopBeacon(beaconId)));
    } catch (error) {
      setStoppingInProgress(false);
    }
  };
  const onResetLocationPublishError = () => {
    liveBeaconIds.forEach(beaconId => {
      _OwnBeaconStore.OwnBeaconStore.instance.resetLocationPublishError(beaconId);
    });
  };
  return {
    onStopSharing,
    onResetLocationPublishError,
    beacon,
    stoppingInProgress,
    hasLocationPublishError,
    hasStopSharingError
  };
};
exports.useOwnLiveBeacons = useOwnLiveBeacons;
//# sourceMappingURL=useOwnLiveBeacons.js.map