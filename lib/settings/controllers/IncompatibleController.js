"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _SettingController = _interopRequireDefault(require("./SettingController"));
var _SettingsStore = _interopRequireDefault(require("../SettingsStore"));
/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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
 * Enforces that a boolean setting cannot be enabled if the incompatible setting
 * is also enabled, to prevent cascading undefined behaviour between conflicting
 * labs flags.
 */
class IncompatibleController extends _SettingController.default {
  constructor(settingName) {
    let forcedValue = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    let incompatibleValue = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
    super();
    this.settingName = settingName;
    this.forcedValue = forcedValue;
    this.incompatibleValue = incompatibleValue;
  }
  getValueOverride(level, roomId, calculatedValue, calculatedAtLevel) {
    if (this.incompatibleSetting) {
      return this.forcedValue;
    }
    return null; // no override
  }

  get settingDisabled() {
    return this.incompatibleSetting;
  }
  get incompatibleSetting() {
    if (typeof this.incompatibleValue === "function") {
      return this.incompatibleValue(_SettingsStore.default.getValue(this.settingName));
    }
    return _SettingsStore.default.getValue(this.settingName) === this.incompatibleValue;
  }
}
exports.default = IncompatibleController;
//# sourceMappingURL=IncompatibleController.js.map