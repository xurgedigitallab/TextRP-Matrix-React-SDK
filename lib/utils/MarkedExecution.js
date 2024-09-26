"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.MarkedExecution = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
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
 * A utility to ensure that a function is only called once triggered with
 * a mark applied. Multiple marks can be applied to the function, however
 * the function will only be called once upon trigger().
 *
 * The function starts unmarked.
 */
class MarkedExecution {
  /**
   * Creates a MarkedExecution for the provided function.
   * @param {Function} fn The function to be called upon trigger if marked.
   * @param {Function} onMarkCallback A function that is called when a new mark is made. Not
   * called if a mark is already flagged.
   */
  constructor(fn, onMarkCallback) {
    this.fn = fn;
    this.onMarkCallback = onMarkCallback;
    (0, _defineProperty2.default)(this, "marked", false);
  }

  /**
   * Resets the mark without calling the function.
   */
  reset() {
    this.marked = false;
  }

  /**
   * Marks the function to be called upon trigger().
   */
  mark() {
    if (!this.marked) this.onMarkCallback?.();
    this.marked = true;
  }

  /**
   * If marked, the function will be called, otherwise this does nothing.
   */
  trigger() {
    if (!this.marked) return;
    this.reset(); // reset first just in case the fn() causes a trigger()
    this.fn();
  }
}
exports.MarkedExecution = MarkedExecution;
//# sourceMappingURL=MarkedExecution.js.map