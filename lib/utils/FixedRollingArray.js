"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FixedRollingArray = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _arrays = require("./arrays");
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
 * An array which is of fixed length and accepts rolling values. Values will
 * be inserted on the left, falling off the right.
 */
class FixedRollingArray {
  /**
   * Creates a new fixed rolling array.
   * @param width The width of the array.
   * @param padValue The value to seed the array with.
   */
  constructor(width, padValue) {
    this.width = width;
    (0, _defineProperty2.default)(this, "samples", []);
    this.samples = (0, _arrays.arraySeed)(padValue, this.width);
  }

  /**
   * The array, as a fixed length.
   */
  get value() {
    return this.samples;
  }

  /**
   * Pushes a value to the array.
   * @param value The value to push.
   */
  pushValue(value) {
    let swap = (0, _arrays.arrayFastClone)(this.samples);
    swap.splice(0, 0, value);
    if (swap.length > this.width) {
      swap = swap.slice(0, this.width);
    }
    this.samples = swap;
  }
}
exports.FixedRollingArray = FixedRollingArray;
//# sourceMappingURL=FixedRollingArray.js.map