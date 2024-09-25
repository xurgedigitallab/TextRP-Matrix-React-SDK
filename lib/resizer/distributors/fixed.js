"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _item = _interopRequireDefault(require("../item"));
var _sizer = _interopRequireDefault(require("../sizer"));
/*
Copyright 2019 - 2020 The Matrix.org Foundation C.I.C.

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
distributors translate a moving cursor into
CSS/DOM changes by calling the sizer

they have two methods:
    `resize` receives then new item size
    `resizeFromContainerOffset` receives resize handle location
        within the container bounding box. For internal use.
        This method usually ends up calling `resize` once the start offset is subtracted.
*/
class FixedDistributor {
  static createItem(resizeHandle, resizer, sizer) {
    return new _item.default(resizeHandle, resizer, sizer);
  }
  static createSizer(containerElement, vertical, reverse) {
    return new _sizer.default(containerElement, vertical, reverse);
  }
  constructor(item) {
    this.item = item;
    (0, _defineProperty2.default)(this, "beforeOffset", void 0);
    this.beforeOffset = item.offset();
  }
  get size() {
    return this.item.getSize();
  }
  set size(size) {
    this.item.setRawSize(size);
  }
  resize(size) {
    this.item.setSize(size);
  }
  resizeFromContainerOffset(offset) {
    this.resize(offset - this.beforeOffset);
  }
  start() {
    this.item.start();
  }
  finish() {
    this.item.finish();
  }
}
exports.default = FixedDistributor;
//# sourceMappingURL=fixed.js.map