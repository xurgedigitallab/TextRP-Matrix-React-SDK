"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _logger = require("matrix-js-sdk/src/logger");
var _MatrixClientPeg = require("./MatrixClientPeg");
var _dispatcher = _interopRequireDefault(require("./dispatcher/dispatcher"));
var _Timer = _interopRequireDefault(require("./utils/Timer"));
/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

// Time in ms after that a user is considered as unavailable/away
const UNAVAILABLE_TIME_MS = 3 * 60 * 1000; // 3 mins
var State = /*#__PURE__*/function (State) {
  State["Online"] = "online";
  State["Offline"] = "offline";
  State["Unavailable"] = "unavailable";
  return State;
}(State || {});
class Presence {
  constructor() {
    (0, _defineProperty2.default)(this, "unavailableTimer", null);
    (0, _defineProperty2.default)(this, "dispatcherRef", null);
    (0, _defineProperty2.default)(this, "state", null);
    (0, _defineProperty2.default)(this, "onAction", payload => {
      if (payload.action === "user_activity") {
        this.setState(State.Online);
        this.unavailableTimer?.restart();
      }
    });
  }
  /**
   * Start listening the user activity to evaluate his presence state.
   * Any state change will be sent to the homeserver.
   */
  async start() {
    this.unavailableTimer = new _Timer.default(UNAVAILABLE_TIME_MS);
    // the user_activity_start action starts the timer
    this.dispatcherRef = _dispatcher.default.register(this.onAction);
    while (this.unavailableTimer) {
      try {
        await this.unavailableTimer.finished();
        this.setState(State.Unavailable);
      } catch (e) {
        /* aborted, stop got called */
      }
    }
  }

  /**
   * Stop tracking user activity
   */
  stop() {
    if (this.dispatcherRef) {
      _dispatcher.default.unregister(this.dispatcherRef);
      this.dispatcherRef = null;
    }
    if (this.unavailableTimer) {
      this.unavailableTimer.abort();
      this.unavailableTimer = null;
    }
  }

  /**
   * Get the current presence state.
   * @returns {string} the presence state (see PRESENCE enum)
   */
  getState() {
    return this.state;
  }
  /**
   * Set the presence state.
   * If the state has changed, the homeserver will be notified.
   * @param {string} newState the new presence state (see PRESENCE enum)
   */
  async setState(newState) {
    if (newState === this.state) {
      return;
    }
    const oldState = this.state;
    this.state = newState;
    if (_MatrixClientPeg.MatrixClientPeg.get().isGuest()) {
      return; // don't try to set presence when a guest; it won't work.
    }

    try {
      await _MatrixClientPeg.MatrixClientPeg.get().setPresence({
        presence: this.state
      });
      _logger.logger.info("Presence:", newState);
    } catch (err) {
      _logger.logger.error("Failed to set presence:", err);
      this.state = oldState;
    }
  }
}
var _default = new Presence();
exports.default = _default;
//# sourceMappingURL=Presence.js.map