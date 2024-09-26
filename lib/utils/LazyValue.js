"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.LazyValue = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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
 * Utility class for lazily getting a variable.
 */
class LazyValue {
  constructor(getFn) {
    this.getFn = getFn;
    (0, _defineProperty2.default)(this, "val", void 0);
    (0, _defineProperty2.default)(this, "prom", void 0);
    (0, _defineProperty2.default)(this, "done", false);
  }

  /**
   * Whether or not a cached value is present.
   */
  get present() {
    // we use a tracking variable just in case the final value is falsy
    return this.done;
  }

  /**
   * Gets the value without invoking a get. May be undefined until the
   * value is fetched properly.
   */
  get cachedValue() {
    return this.val;
  }

  /**
   * Gets a promise which resolves to the value, eventually.
   */
  get value() {
    if (this.prom) return this.prom;
    this.prom = this.getFn();
    return this.prom.then(v => {
      this.val = v;
      this.done = true;
      return v;
    });
  }
}
exports.LazyValue = LazyValue;
//# sourceMappingURL=LazyValue.js.map