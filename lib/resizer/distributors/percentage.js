"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _sizer = _interopRequireDefault(require("../sizer"));
var _fixed = _interopRequireDefault(require("./fixed"));
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

class PercentageSizer extends _sizer.default {
  start(item) {
    if (this.vertical) {
      item.style.minHeight = "";
    } else {
      item.style.minWidth = "";
    }
  }
  finish(item) {
    const parent = item.offsetParent;
    if (!parent) return;
    if (this.vertical) {
      const p = (item.offsetHeight / parent.offsetHeight * 100).toFixed(2) + "%";
      item.style.minHeight = p;
      item.style.height = p;
    } else {
      const p = (item.offsetWidth / parent.offsetWidth * 100).toFixed(2) + "%";
      item.style.minWidth = p;
      item.style.width = p;
    }
  }
}
class PercentageDistributor extends _fixed.default {
  static createSizer(containerElement, vertical, reverse) {
    return new PercentageSizer(containerElement, vertical, reverse);
  }
}
exports.default = PercentageDistributor;
//# sourceMappingURL=percentage.js.map