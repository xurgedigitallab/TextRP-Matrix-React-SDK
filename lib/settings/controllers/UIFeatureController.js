"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _SettingController = _interopRequireDefault(require("./SettingController"));
var _SettingsStore = _interopRequireDefault(require("../SettingsStore"));
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
 * Enforces that a boolean setting cannot be enabled if the corresponding
 * UI feature is disabled. If the UI feature is enabled, the setting value
 * is unchanged.
 *
 * Settings using this controller are assumed to return `false` when disabled.
 */
class UIFeatureController extends _SettingController.default {
  constructor(uiFeatureName) {
    let forcedValue = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    super();
    this.uiFeatureName = uiFeatureName;
    this.forcedValue = forcedValue;
  }
  getValueOverride(level, roomId, calculatedValue, calculatedAtLevel) {
    if (this.settingDisabled) {
      // per the docs: we force a disabled state when the feature isn't active
      return this.forcedValue;
    }
    return null; // no override
  }

  get settingDisabled() {
    return !_SettingsStore.default.getValue(this.uiFeatureName);
  }
}
exports.default = UIFeatureController;
//# sourceMappingURL=UIFeatureController.js.map