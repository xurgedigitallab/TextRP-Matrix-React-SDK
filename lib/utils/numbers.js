"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.clamp = clamp;
exports.defaultNumber = defaultNumber;
exports.percentageOf = percentageOf;
exports.percentageWithin = percentageWithin;
exports.sum = sum;
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
 * Returns the default number if the given value, i, is not a number. Otherwise
 * returns the given value.
 * @param {*} i The value to check.
 * @param {number} def The default value.
 * @returns {number} Either the value or the default value, whichever is a number.
 */
function defaultNumber(i, def) {
  return Number.isFinite(i) ? Number(i) : def;
}
function clamp(i, min, max) {
  return Math.min(Math.max(i, min), max);
}
function sum() {
  for (var _len = arguments.length, i = new Array(_len), _key = 0; _key < _len; _key++) {
    i[_key] = arguments[_key];
  }
  return [...i].reduce((p, c) => c + p, 0);
}
function percentageWithin(pct, min, max) {
  return pct * (max - min) + min;
}
function percentageOf(val, min, max) {
  const percentage = (val - min) / (max - min);
  return Number.isNaN(percentage) ? 0 : percentage;
}
//# sourceMappingURL=numbers.js.map