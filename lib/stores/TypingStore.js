"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _SettingsStore = _interopRequireDefault(require("../settings/SettingsStore"));
var _isLocalRoom = require("../utils/localRoom/isLocalRoom");
var _Timer = _interopRequireDefault(require("../utils/Timer"));
/*
Copyright 2019 - 2023 The Matrix.org Foundation C.I.C.

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

const TYPING_USER_TIMEOUT = 10000;
const TYPING_SERVER_TIMEOUT = 30000;

/**
 * Tracks typing state for users.
 */
class TypingStore {
  constructor(context) {
    this.context = context;
    (0, _defineProperty2.default)(this, "typingStates", {});
    this.reset();
  }

  /**
   * Clears all cached typing states. Intended to be called when the
   * MatrixClientPeg client changes.
   */
  reset() {
    this.typingStates = {
      // "roomId": {
      //     isTyping: bool,     // Whether the user is typing or not
      //     userTimer: Timer,   // Local timeout for "user has stopped typing"
      //     serverTimer: Timer, // Maximum timeout for the typing state
      // },
    };
  }

  /**
   * Changes the typing status for the MatrixClientPeg user.
   * @param {string} roomId The room ID to set the typing state in.
   * @param {boolean} isTyping Whether the user is typing or not.
   */
  setSelfTyping(roomId, threadId, isTyping) {
    // No typing notifications for local rooms
    if ((0, _isLocalRoom.isLocalRoom)(roomId)) return;
    if (!_SettingsStore.default.getValue("sendTypingNotifications")) return;
    if (_SettingsStore.default.getValue("lowBandwidth")) return;
    // Disable typing notification for threads for the initial launch
    // before we figure out a better user experience for them
    if (threadId) return;
    let currentTyping = this.typingStates[roomId];
    if (!isTyping && !currentTyping || currentTyping?.isTyping === isTyping) {
      // No change in state, so don't do anything. We'll let the timer run its course.
      return;
    }
    if (!currentTyping) {
      currentTyping = this.typingStates[roomId] = {
        isTyping: isTyping,
        serverTimer: new _Timer.default(TYPING_SERVER_TIMEOUT),
        userTimer: new _Timer.default(TYPING_USER_TIMEOUT)
      };
    }
    currentTyping.isTyping = isTyping;
    if (isTyping) {
      if (!currentTyping.serverTimer.isRunning()) {
        currentTyping.serverTimer.restart().finished().then(() => {
          const currentTyping = this.typingStates[roomId];
          if (currentTyping) currentTyping.isTyping = false;

          // The server will (should) time us out on typing, so we don't
          // need to advertise a stop of typing.
        });
      } else currentTyping.serverTimer.restart();
      if (!currentTyping.userTimer.isRunning()) {
        currentTyping.userTimer.restart().finished().then(() => {
          this.setSelfTyping(roomId, threadId, false);
        });
      } else currentTyping.userTimer.restart();
    }
    this.context.client?.sendTyping(roomId, isTyping, TYPING_SERVER_TIMEOUT);
  }
}
exports.default = TypingStore;
//# sourceMappingURL=TypingStore.js.map