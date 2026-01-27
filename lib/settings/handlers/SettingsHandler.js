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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJTZXR0aW5nc0hhbmRsZXIiLCJjb25zdHJ1Y3RvciIsIl9kZWZpbmVQcm9wZXJ0eTIiLCJkZWZhdWx0IiwiZXhwb3J0cyJdLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9zZXR0aW5ncy9oYW5kbGVycy9TZXR0aW5nc0hhbmRsZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbkNvcHlyaWdodCAyMDE3IFRyYXZpcyBSYWxzdG9uXG5Db3B5cmlnaHQgMjAxOSwgMjAyMCBUaGUgTWF0cml4Lm9yZyBGb3VuZGF0aW9uIEMuSS5DLlxuXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiovXG5cbmltcG9ydCB7IFdhdGNoTWFuYWdlciB9IGZyb20gXCIuLi9XYXRjaE1hbmFnZXJcIjtcblxuLyoqXG4gKiBSZXByZXNlbnRzIHRoZSBiYXNlIGNsYXNzIGZvciBhbGwgbGV2ZWwgaGFuZGxlcnMuIFRoaXMgY2xhc3MgcGVyZm9ybXMgbm8gbG9naWNcbiAqIGFuZCBzaG91bGQgYmUgb3ZlcnJpZGRlbi5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgYWJzdHJhY3QgY2xhc3MgU2V0dGluZ3NIYW5kbGVyIHtcbiAgICBwdWJsaWMgcmVhZG9ubHkgd2F0Y2hlcnM/OiBXYXRjaE1hbmFnZXI7XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB2YWx1ZSBmb3IgYSBwYXJ0aWN1bGFyIHNldHRpbmcgYXQgdGhpcyBsZXZlbCBmb3IgYSBwYXJ0aWN1bGFyIHJvb20uXG4gICAgICogSWYgbm8gcm9vbSBpcyBhcHBsaWNhYmxlLCB0aGUgcm9vbUlkIG1heSBiZSBudWxsLiBUaGUgcm9vbUlkIG1heSBub3QgYmVcbiAgICAgKiBhcHBsaWNhYmxlIHRvIHRoaXMgbGV2ZWwgYW5kIG1heSBiZSBpZ25vcmVkIGJ5IHRoZSBoYW5kbGVyLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzZXR0aW5nTmFtZSBUaGUgbmFtZSBvZiB0aGUgc2V0dGluZy5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gcm9vbUlkIFRoZSByb29tIElEIHRvIHJlYWQgZnJvbSwgbWF5IGJlIG51bGwuXG4gICAgICogQHJldHVybnMgeyp9IFRoZSBzZXR0aW5nIHZhbHVlLCBvciBudWxsIGlmIG5vdCBmb3VuZC5cbiAgICAgKi9cbiAgICBwdWJsaWMgYWJzdHJhY3QgZ2V0VmFsdWUoc2V0dGluZ05hbWU6IHN0cmluZywgcm9vbUlkOiBzdHJpbmcgfCBudWxsKTogYW55O1xuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgdmFsdWUgZm9yIGEgcGFydGljdWxhciBzZXR0aW5nIGF0IHRoaXMgbGV2ZWwgZm9yIGEgcGFydGljdWxhciByb29tLlxuICAgICAqIElmIG5vIHJvb20gaXMgYXBwbGljYWJsZSwgdGhlIHJvb21JZCBtYXkgYmUgbnVsbC4gVGhlIHJvb21JZCBtYXkgbm90IGJlXG4gICAgICogYXBwbGljYWJsZSB0byB0aGlzIGxldmVsIGFuZCBtYXkgYmUgaWdub3JlZCBieSB0aGUgaGFuZGxlci4gU2V0dGluZyBhIHZhbHVlXG4gICAgICogdG8gbnVsbCB3aWxsIGNhdXNlIHRoZSBsZXZlbCB0byByZW1vdmUgdGhlIHZhbHVlLiBUaGUgY3VycmVudCB1c2VyIHNob3VsZCBiZVxuICAgICAqIGFibGUgdG8gc2V0IHRoZSB2YWx1ZSBwcmlvciB0byBjYWxsaW5nIHRoaXMuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNldHRpbmdOYW1lIFRoZSBuYW1lIG9mIHRoZSBzZXR0aW5nIHRvIGNoYW5nZS5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gcm9vbUlkIFRoZSByb29tIElEIHRvIHNldCB0aGUgdmFsdWUgaW4sIG1heSBiZSBudWxsLlxuICAgICAqIEBwYXJhbSB7Kn0gbmV3VmFsdWUgVGhlIG5ldyB2YWx1ZSBmb3IgdGhlIHNldHRpbmcsIG1heSBiZSBudWxsLlxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlfSBSZXNvbHZlcyB3aGVuIHRoZSBzZXR0aW5nIGhhcyBiZWVuIHNhdmVkLlxuICAgICAqL1xuICAgIHB1YmxpYyBhYnN0cmFjdCBzZXRWYWx1ZShzZXR0aW5nTmFtZTogc3RyaW5nLCByb29tSWQ6IHN0cmluZyB8IG51bGwsIG5ld1ZhbHVlOiBhbnkpOiBQcm9taXNlPHZvaWQ+O1xuXG4gICAgLyoqXG4gICAgICogRGV0ZXJtaW5lcyBpZiB0aGUgY3VycmVudCB1c2VyIGlzIGFibGUgdG8gc2V0IHRoZSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gc2V0dGluZ1xuICAgICAqIGluIHRoZSBnaXZlbiByb29tIGF0IHRoaXMgbGV2ZWwuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNldHRpbmdOYW1lIFRoZSBuYW1lIG9mIHRoZSBzZXR0aW5nIHRvIGNoZWNrLlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSByb29tSWQgVGhlIHJvb20gSUQgdG8gY2hlY2sgaW4sIG1heSBiZSBudWxsXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHNldHRpbmcgY2FuIGJlIHNldCBieSB0aGUgdXNlciwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIHB1YmxpYyBhYnN0cmFjdCBjYW5TZXRWYWx1ZShzZXR0aW5nTmFtZTogc3RyaW5nLCByb29tSWQ6IHN0cmluZyB8IG51bGwpOiBib29sZWFuO1xuXG4gICAgLyoqXG4gICAgICogRGV0ZXJtaW5lcyBpZiB0aGlzIGxldmVsIGlzIHN1cHBvcnRlZCBvbiB0aGlzIGRldmljZS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGlzIGxldmVsIGlzIHN1cHBvcnRlZCBvbiB0aGUgY3VycmVudCBkZXZpY2UuXG4gICAgICovXG4gICAgcHVibGljIGFic3RyYWN0IGlzU3VwcG9ydGVkKCk6IGJvb2xlYW47XG59XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBSUE7QUFDQTtBQUNBO0FBQ0E7QUFDZSxNQUFlQSxlQUFlLENBQUM7RUFBQUMsWUFBQTtJQUFBLElBQUFDLGdCQUFBLENBQUFDLE9BQUE7RUFBQTtFQUcxQztBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBR0k7QUFDSjtBQUNBO0FBQ0E7QUFFQTtBQUFDQyxPQUFBLENBQUFELE9BQUEsR0FBQUgsZUFBQSJ9