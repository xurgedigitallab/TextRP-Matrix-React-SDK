"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _SettingsHandler = _interopRequireDefault(require("./SettingsHandler"));
var _PlatformPeg = _interopRequireDefault(require("../../PlatformPeg"));
var _Settings = require("../Settings");
var _SettingLevel = require("../SettingLevel");
var _dispatcher = _interopRequireDefault(require("../../dispatcher/dispatcher"));
var _actions = require("../../dispatcher/actions");
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
 * Gets and sets settings at the "platform" level for the current device.
 * This handler does not make use of the roomId parameter.
 */
class PlatformSettingsHandler extends _SettingsHandler.default {
  constructor() {
    super();
    (0, _defineProperty2.default)(this, "store", {});
    (0, _defineProperty2.default)(this, "onAction", payload => {
      if (payload.action === _actions.Action.PlatformSet) {
        this.store = {};
        // Load setting values as they are async and `getValue` must be synchronous
        Object.entries(_Settings.SETTINGS).forEach(_ref => {
          let [key, setting] = _ref;
          if (setting.supportedLevels?.includes(_SettingLevel.SettingLevel.PLATFORM) && payload.platform.supportsSetting(key)) {
            payload.platform.getSettingValue(key).then(value => {
              this.store[key] = value;
            });
          }
        });
      }
    });
    _dispatcher.default.register(this.onAction);
  }
  canSetValue(settingName, roomId) {
    return _PlatformPeg.default.get()?.supportsSetting(settingName) ?? false;
  }
  getValue(settingName, roomId) {
    return this.store[settingName];
  }
  async setValue(settingName, roomId, newValue) {
    this.store[settingName] = newValue; // keep cache up to date for synchronous access
    await _PlatformPeg.default.get()?.setSettingValue(settingName, newValue);
  }
  isSupported() {
    return _PlatformPeg.default.get()?.supportsSetting() ?? false;
  }
}
exports.default = PlatformSettingsHandler;
//# sourceMappingURL=PlatformSettingsHandler.js.map