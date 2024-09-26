"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _utils = require("matrix-js-sdk/src/utils");
var _SettingLevel = require("../SettingLevel");
var _AbstractLocalStorageSettingsHandler = _interopRequireDefault(require("./AbstractLocalStorageSettingsHandler"));
/*
Copyright 2017 Travis Ralston
Copyright 2019, 2020 - 2022 The Matrix.org Foundation C.I.C.

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
 * Gets and sets settings at the "room-device" level for the current device in a particular
 * room.
 */
class RoomDeviceSettingsHandler extends _AbstractLocalStorageSettingsHandler.default {
  constructor(watchers) {
    super();
    this.watchers = watchers;
  }
  getValue(settingName, roomId) {
    // Special case blacklist setting to use legacy values
    if (settingName === "blacklistUnverifiedDevices") {
      const value = this.read("mx_local_settings");
      if (value?.["blacklistUnverifiedDevicesPerRoom"]) {
        return value["blacklistUnverifiedDevicesPerRoom"][roomId];
      }
    }
    const value = this.read(this.getKey(settingName, roomId));
    if (value) return value.value;
    return null;
  }
  setValue(settingName, roomId, newValue) {
    // Special case blacklist setting for legacy structure
    if (settingName === "blacklistUnverifiedDevices") {
      let value = this.read("mx_local_settings");
      if (!value) value = {};
      if (!value["blacklistUnverifiedDevicesPerRoom"]) value["blacklistUnverifiedDevicesPerRoom"] = {};
      (0, _utils.safeSet)(value["blacklistUnverifiedDevicesPerRoom"], roomId, newValue);
      this.setObject("mx_local_settings", value);
      this.watchers.notifyUpdate(settingName, roomId, _SettingLevel.SettingLevel.ROOM_DEVICE, newValue);
      return Promise.resolve();
    }
    if (newValue === null) {
      this.removeItem(this.getKey(settingName, roomId));
    } else {
      this.setObject(this.getKey(settingName, roomId), {
        value: newValue
      });
    }
    this.watchers.notifyUpdate(settingName, roomId, _SettingLevel.SettingLevel.ROOM_DEVICE, newValue);
    return Promise.resolve();
  }
  canSetValue(settingName, roomId) {
    return true; // It's their device, so they should be able to
  }

  read(key) {
    return this.getObject(key);
  }
  getKey(settingName, roomId) {
    return "mx_setting_" + settingName + "_" + roomId;
  }
}
exports.default = RoomDeviceSettingsHandler;
//# sourceMappingURL=RoomDeviceSettingsHandler.js.map