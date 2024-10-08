"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
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
 * Represents the base class for all level handlers. This class performs no logic
 * and should be overridden.
 */
class SettingsHandler {
  constructor() {
    (0, _defineProperty2.default)(this, "watchers", void 0);
  }
  /**
   * Gets the value for a particular setting at this level for a particular room.
   * If no room is applicable, the roomId may be null. The roomId may not be
   * applicable to this level and may be ignored by the handler.
   * @param {string} settingName The name of the setting.
   * @param {String} roomId The room ID to read from, may be null.
   * @returns {*} The setting value, or null if not found.
   */
  /**
   * Sets the value for a particular setting at this level for a particular room.
   * If no room is applicable, the roomId may be null. The roomId may not be
   * applicable to this level and may be ignored by the handler. Setting a value
   * to null will cause the level to remove the value. The current user should be
   * able to set the value prior to calling this.
   * @param {string} settingName The name of the setting to change.
   * @param {String} roomId The room ID to set the value in, may be null.
   * @param {*} newValue The new value for the setting, may be null.
   * @returns {Promise} Resolves when the setting has been saved.
   */
  /**
   * Determines if the current user is able to set the value of the given setting
   * in the given room at this level.
   * @param {string} settingName The name of the setting to check.
   * @param {String} roomId The room ID to check in, may be null
   * @returns {boolean} True if the setting can be set by the user, false otherwise.
   */
  /**
   * Determines if this level is supported on this device.
   * @returns {boolean} True if this level is supported on the current device.
   */
}
exports.default = SettingsHandler;
//# sourceMappingURL=SettingsHandler.js.map