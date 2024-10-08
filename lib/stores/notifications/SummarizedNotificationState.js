"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SummarizedNotificationState = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _NotificationColor = require("./NotificationColor");
var _NotificationState = require("./NotificationState");
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
 * Summarizes a number of states into a unique snapshot. To populate, call
 * the add() function with the notification states to be included.
 *
 * Useful for community notification counts, global notification counts, etc.
 */
class SummarizedNotificationState extends _NotificationState.NotificationState {
  constructor() {
    super();
    (0, _defineProperty2.default)(this, "totalStatesWithUnread", 0);
    this._symbol = null;
    this._count = 0;
    this._color = _NotificationColor.NotificationColor.None;
  }
  get numUnreadStates() {
    return this.totalStatesWithUnread;
  }

  /**
   * Append a notification state to this snapshot, taking the loudest NotificationColor
   * of the two. By default this will not adopt the symbol of the other notification
   * state to prevent the count from being lost in typical usage.
   * @param other The other notification state to append.
   * @param includeSymbol If true, the notification state's symbol will be taken if one
   * is present.
   */
  add(other) {
    let includeSymbol = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    if (other.symbol && includeSymbol) {
      this._symbol = other.symbol;
    }
    if (other.count) {
      this._count += other.count;
    }
    if (other.color > this.color) {
      this._color = other.color;
    }
    if (other.hasUnreadCount) {
      this.totalStatesWithUnread++;
    }
  }
}
exports.SummarizedNotificationState = SummarizedNotificationState;
//# sourceMappingURL=SummarizedNotificationState.js.map