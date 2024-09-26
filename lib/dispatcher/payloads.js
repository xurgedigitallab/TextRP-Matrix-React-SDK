"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.AsyncActionPayload = void 0;
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
 * The base dispatch type exposed by our dispatcher.
 */

/**
 * The function the dispatcher calls when ready for an AsyncActionPayload. The
 * single argument is used to start a dispatch. First the dispatcher calls the
 * outer function, then when the called function is ready it calls the cb
 * function to issue the dispatch. It may call the callback repeatedly if needed.
 */

/**
 * An async version of ActionPayload
 */
class AsyncActionPayload {
  /**
   * @deprecated Not used on AsyncActionPayload.
   */
  get action() {
    return "NOT_USED";
  }

  /**
   * Create a new AsyncActionPayload with the given ready function.
   * @param {AsyncActionFn} readyFn The function to be called when the
   * dispatcher is ready.
   */
  constructor(readyFn) {
    /**
     * The function the dispatcher should call.
     */
    (0, _defineProperty2.default)(this, "fn", void 0);
    this.fn = readyFn;
  }
}
exports.AsyncActionPayload = AsyncActionPayload;
//# sourceMappingURL=payloads.js.map