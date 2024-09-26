"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WatchManager = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
/*
Copyright 2019 New Vector Ltd.

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

const IRRELEVANT_ROOM = null;

/**
 * Generalized management class for dealing with watchers on a per-handler (per-level)
 * basis without duplicating code. Handlers are expected to push updates through this
 * class, which are then proxied outwards to any applicable watchers.
 */
class WatchManager {
  constructor() {
    (0, _defineProperty2.default)(this, "watchers", new Map());
  }
  // settingName -> roomId -> CallbackFn[]
  // Proxy for handlers to delegate changes to this manager
  watchSetting(settingName, roomId, cb) {
    if (!this.watchers.has(settingName)) this.watchers.set(settingName, new Map());
    if (!this.watchers.get(settingName).has(roomId)) this.watchers.get(settingName).set(roomId, []);
    this.watchers.get(settingName).get(roomId).push(cb);
  }

  // Proxy for handlers to delegate changes to this manager
  unwatchSetting(cb) {
    this.watchers.forEach(map => {
      map.forEach(callbacks => {
        let idx;
        while ((idx = callbacks.indexOf(cb)) !== -1) {
          callbacks.splice(idx, 1);
        }
      });
    });
  }
  notifyUpdate(settingName, inRoomId, atLevel, newValueAtLevel) {
    // Dev note: We could avoid raising changes for ultimately inconsequential changes, but
    // we also don't have a reliable way to get the old value of a setting. Instead, we'll just
    // let it fall through regardless and let the receiver dedupe if they want to.

    if (!this.watchers.has(settingName)) return;
    const roomWatchers = this.watchers.get(settingName);
    const callbacks = [];
    if (inRoomId !== null && roomWatchers.has(inRoomId)) {
      callbacks.push(...roomWatchers.get(inRoomId));
    }
    if (!inRoomId) {
      // Fire updates to all the individual room watchers too, as they probably care about the change higher up.
      callbacks.push(...Array.from(roomWatchers.values()).flat(1));
    } else if (roomWatchers.has(IRRELEVANT_ROOM)) {
      callbacks.push(...roomWatchers.get(IRRELEVANT_ROOM));
    }
    for (const callback of callbacks) {
      callback(inRoomId, atLevel, newValueAtLevel);
    }
  }
}
exports.WatchManager = WatchManager;
//# sourceMappingURL=WatchManager.js.map