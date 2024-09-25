"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getBeaconDisplayStatus = exports.BeaconDisplayStatus = void 0;
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
let BeaconDisplayStatus = /*#__PURE__*/function (BeaconDisplayStatus) {
  BeaconDisplayStatus["Loading"] = "Loading";
  BeaconDisplayStatus["Error"] = "Error";
  BeaconDisplayStatus["Stopped"] = "Stopped";
  BeaconDisplayStatus["Active"] = "Active";
  return BeaconDisplayStatus;
}({});
exports.BeaconDisplayStatus = BeaconDisplayStatus;
const getBeaconDisplayStatus = (isLive, latestLocationState, error, waitingToStart) => {
  if (error) {
    return BeaconDisplayStatus.Error;
  }
  if (waitingToStart) {
    return BeaconDisplayStatus.Loading;
  }
  if (!isLive) {
    return BeaconDisplayStatus.Stopped;
  }
  if (!latestLocationState) {
    return BeaconDisplayStatus.Loading;
  }
  return BeaconDisplayStatus.Active;
};
exports.getBeaconDisplayStatus = getBeaconDisplayStatus;
//# sourceMappingURL=displayStatus.js.map