"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SettingLevel = void 0;
/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
 * Represents the various setting levels supported by the SettingsStore.
 */
let SettingLevel = /*#__PURE__*/function (SettingLevel) {
  SettingLevel["DEVICE"] = "device";
  SettingLevel["ROOM_DEVICE"] = "room-device";
  SettingLevel["ROOM_ACCOUNT"] = "room-account";
  SettingLevel["ACCOUNT"] = "account";
  SettingLevel["ROOM"] = "room";
  SettingLevel["PLATFORM"] = "platform";
  SettingLevel["CONFIG"] = "config";
  SettingLevel["DEFAULT"] = "default";
  return SettingLevel;
}({});
exports.SettingLevel = SettingLevel;
//# sourceMappingURL=SettingLevel.js.map