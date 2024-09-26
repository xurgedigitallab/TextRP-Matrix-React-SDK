"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _SettingsHandler = _interopRequireDefault(require("./SettingsHandler"));
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
 * A wrapper for a SettingsHandler that performs local echo on
 * changes to settings. This wrapper will use the underlying
 * handler as much as possible to ensure values are not stale.
 */
class LocalEchoWrapper extends _SettingsHandler.default {
  /**
   * Creates a new local echo wrapper
   * @param {SettingsHandler} handler The handler to wrap
   * @param {SettingLevel} level The level to notify updates at
   */
  constructor(handler, level) {
    super();
    this.handler = handler;
    this.level = level;
    (0, _defineProperty2.default)(this, "cache", {});
  }
  getValue(settingName, roomId) {
    const cacheRoomId = roomId ?? "UNDEFINED"; // avoid weird keys
    const bySetting = this.cache[settingName];
    if (bySetting?.hasOwnProperty(cacheRoomId)) {
      return bySetting[cacheRoomId];
    }
    return this.handler.getValue(settingName, roomId);
  }
  async setValue(settingName, roomId, newValue) {
    if (!this.cache[settingName]) this.cache[settingName] = {};
    const bySetting = this.cache[settingName];
    const cacheRoomId = roomId ?? "UNDEFINED"; // avoid weird keys
    bySetting[cacheRoomId] = newValue;
    const currentValue = this.handler.getValue(settingName, roomId);
    const handlerPromise = this.handler.setValue(settingName, roomId, newValue);
    this.handler.watchers?.notifyUpdate(settingName, roomId, this.level, newValue);
    try {
      await handlerPromise;
    } catch (e) {
      // notify of a rollback
      this.handler.watchers?.notifyUpdate(settingName, roomId, this.level, currentValue);
    } finally {
      // only expire the cache if our value hasn't been overwritten yet
      if (bySetting[cacheRoomId] === newValue) {
        delete bySetting[cacheRoomId];
      }
    }
  }
  canSetValue(settingName, roomId) {
    return this.handler.canSetValue(settingName, roomId);
  }
  isSupported() {
    return this.handler.isSupported();
  }
}
exports.default = LocalEchoWrapper;
//# sourceMappingURL=LocalEchoWrapper.js.map