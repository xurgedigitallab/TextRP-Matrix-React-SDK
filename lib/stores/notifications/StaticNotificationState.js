"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.StaticNotificationState = void 0;
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

class StaticNotificationState extends _NotificationState.NotificationState {
  constructor(symbol, count, color) {
    super();
    this._symbol = symbol;
    this._count = count;
    this._color = color;
  }
  static forCount(count, color) {
    return new StaticNotificationState(null, count, color);
  }
  static forSymbol(symbol, color) {
    return new StaticNotificationState(symbol, 0, color);
  }
}
exports.StaticNotificationState = StaticNotificationState;
(0, _defineProperty2.default)(StaticNotificationState, "RED_EXCLAMATION", StaticNotificationState.forSymbol("!", _NotificationColor.NotificationColor.Red));
//# sourceMappingURL=StaticNotificationState.js.map