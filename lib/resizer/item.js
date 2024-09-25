"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
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

class ResizeItem {
  constructor(handle, resizer, sizer, container) {
    this.resizer = resizer;
    this.sizer = sizer;
    this.container = container;
    (0, _defineProperty2.default)(this, "domNode", void 0);
    (0, _defineProperty2.default)(this, "id", void 0);
    (0, _defineProperty2.default)(this, "reverse", void 0);
    this.reverse = resizer.isReverseResizeHandle(handle);
    if (container) {
      this.domNode = container;
    } else {
      this.domNode = this.reverse ? handle.nextElementSibling : handle.previousElementSibling;
    }
    this.id = handle.getAttribute("data-id");
  }
  copyWith(handle, resizer, sizer, container) {
    const Ctor = this.constructor;
    return new Ctor(handle, resizer, sizer, container);
  }
  advance(forwards) {
    // opposite direction from fromResizeHandle to get back to handle
    let handle = this.reverse ? this.domNode.previousElementSibling : this.domNode.nextElementSibling;
    const moveNext = forwards !== this.reverse; // xor
    // iterate at least once to avoid infinite loop
    do {
      if (moveNext) {
        handle = handle?.nextElementSibling;
      } else {
        handle = handle?.previousElementSibling;
      }
    } while (handle && !this.resizer.isResizeHandle(handle));
    if (handle) {
      const nextHandle = this.copyWith(handle, this.resizer, this.sizer);
      nextHandle.reverse = this.reverse;
      return nextHandle;
    }
  }
  next() {
    return this.advance(true);
  }
  previous() {
    return this.advance(false);
  }
  size() {
    return this.sizer.getItemSize(this.domNode);
  }
  offset() {
    return this.sizer.getItemOffset(this.domNode);
  }
  start() {
    this.sizer.start(this.domNode);
  }
  finish() {
    this.sizer.finish(this.domNode);
  }
  getSize() {
    return this.sizer.getDesiredItemSize(this.domNode);
  }
  setRawSize(size) {
    this.sizer.setItemSize(this.domNode, size);
  }
  setSize(size) {
    this.setRawSize(`${Math.round(size)}px`);
    this.resizer.config?.onResized?.(size, this.id, this.domNode);
  }
  clearSize() {
    this.sizer.clearItemSize(this.domNode);
    this.resizer.config?.onResized?.(null, this.id, this.domNode);
  }
  first() {
    if (!this.domNode.parentElement?.children) {
      return;
    }
    const firstHandle = Array.from(this.domNode.parentElement.children).find(el => {
      return this.resizer.isResizeHandle(el);
    });
    if (firstHandle) {
      return this.copyWith(firstHandle, this.resizer, this.sizer);
    }
  }
  last() {
    if (!this.domNode.parentElement?.children) {
      return;
    }
    const lastHandle = Array.from(this.domNode.parentElement.children).reverse().find(el => {
      return this.resizer.isResizeHandle(el);
    });
    if (lastHandle) {
      return this.copyWith(lastHandle, this.resizer, this.sizer);
    }
  }
}
exports.default = ResizeItem;
//# sourceMappingURL=item.js.map