"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _event = require("matrix-js-sdk/src/@types/event");
var _polls = require("matrix-js-sdk/src/@types/polls");
/*
Copyright 2017 Travis Ralston

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

class PinningUtils {
  /**
   * Determines if the given event may be pinned.
   * @param {MatrixEvent} event The event to check.
   * @return {boolean} True if the event may be pinned, false otherwise.
   */
  static isPinnable(event) {
    if (!event) return false;
    if (!this.pinnableEventTypes.includes(event.getType())) return false;
    if (event.isRedacted()) return false;
    return true;
  }
}
exports.default = PinningUtils;
/**
 * Event types that may be pinned.
 */
(0, _defineProperty2.default)(PinningUtils, "pinnableEventTypes", [_event.EventType.RoomMessage, _polls.M_POLL_START.name, _polls.M_POLL_START.altName]);
//# sourceMappingURL=PinningUtils.js.map