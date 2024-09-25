"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isDeviceInactive = exports.filterDevicesBySecurityRecommendation = exports.INACTIVE_DEVICE_AGE_MS = exports.INACTIVE_DEVICE_AGE_DAYS = void 0;
var _types = require("./types");
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

const MS_DAY = 24 * 60 * 60 * 1000;
const INACTIVE_DEVICE_AGE_MS = 7.776e9; // 90 days
exports.INACTIVE_DEVICE_AGE_MS = INACTIVE_DEVICE_AGE_MS;
const INACTIVE_DEVICE_AGE_DAYS = INACTIVE_DEVICE_AGE_MS / MS_DAY;
exports.INACTIVE_DEVICE_AGE_DAYS = INACTIVE_DEVICE_AGE_DAYS;
const isDeviceInactive = device => !!device.last_seen_ts && device.last_seen_ts < Date.now() - INACTIVE_DEVICE_AGE_MS;
exports.isDeviceInactive = isDeviceInactive;
const filters = {
  [_types.DeviceSecurityVariation.Verified]: device => !!device.isVerified,
  [_types.DeviceSecurityVariation.Unverified]: device => !device.isVerified,
  [_types.DeviceSecurityVariation.Inactive]: isDeviceInactive
};
const filterDevicesBySecurityRecommendation = (devices, securityVariations) => {
  const activeFilters = securityVariations.map(variation => filters[variation]);
  if (!activeFilters.length) {
    return devices;
  }
  return devices.filter(device => activeFilters.every(filter => filter(device)));
};
exports.filterDevicesBySecurityRecommendation = filterDevicesBySecurityRecommendation;
//# sourceMappingURL=filter.js.map