"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _utils = require("matrix-js-sdk/src/utils");
var _SettingsHandler = _interopRequireDefault(require("./SettingsHandler"));
var _SdkConfig = _interopRequireDefault(require("../../SdkConfig"));
var _SnakedObject = require("../../utils/SnakedObject");
/*
Copyright 2017 Travis Ralston
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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
 * Gets and sets settings at the "config" level. This handler does not make use of the
 * roomId parameter.
 */
class ConfigSettingsHandler extends _SettingsHandler.default {
  constructor(featureNames) {
    super();
    this.featureNames = featureNames;
  }
  getValue(settingName, roomId) {
    const config = new _SnakedObject.SnakedObject(_SdkConfig.default.get());
    if (this.featureNames.includes(settingName)) {
      const labsConfig = config.get("features") || {};
      const val = labsConfig[settingName];
      if ((0, _utils.isNullOrUndefined)(val)) return null; // no definition at this level
      if (val === true || val === false) return val; // new style: mapped as a boolean
      if (val === "enable") return true; // backwards compat
      if (val === "disable") return false; // backwards compat
      if (val === "labs") return null; // backwards compat, no override
      return null; // fallback in the case of invalid input
    }

    // Special case themes
    if (settingName === "theme") {
      return config.get("default_theme");
    }
    const settingsConfig = config.get("setting_defaults");
    if (!settingsConfig || (0, _utils.isNullOrUndefined)(settingsConfig[settingName])) return null;
    return settingsConfig[settingName];
  }
  async setValue(settingName, roomId, newValue) {
    throw new Error("Cannot change settings at the config level");
  }
  canSetValue(settingName, roomId) {
    return false;
  }
  isSupported() {
    return true; // SdkConfig is always there
  }
}
exports.default = ConfigSettingsHandler;
//# sourceMappingURL=ConfigSettingsHandler.js.map