"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _fixed = _interopRequireDefault(require("./fixed"));
var _item = _interopRequireDefault(require("../item"));
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

class CollapseItem extends _item.default {
  notifyCollapsed(collapsed) {
    this.resizer.config?.onCollapsed?.(collapsed, this.id, this.domNode);
  }
  get isCollapsed() {
    return this.resizer.config?.isItemCollapsed?.(this.domNode) ?? false;
  }
}
class CollapseDistributor extends _fixed.default {
  static createItem(resizeHandle, resizer, sizer, container) {
    return new CollapseItem(resizeHandle, resizer, sizer, container);
  }
  constructor(item) {
    super(item);
    (0, _defineProperty2.default)(this, "toggleSize", void 0);
    (0, _defineProperty2.default)(this, "isCollapsed", void 0);
    this.toggleSize = item.resizer?.config?.toggleSize;
    this.isCollapsed = item.isCollapsed;
  }
  resize(newSize) {
    const isCollapsedSize = !!this.toggleSize && newSize < this.toggleSize;
    if (isCollapsedSize !== this.isCollapsed) {
      this.isCollapsed = isCollapsedSize;
      this.item.notifyCollapsed(isCollapsedSize);
    }
    if (!isCollapsedSize) {
      super.resize(newSize);
    }
  }
}
exports.default = CollapseDistributor;
//# sourceMappingURL=collapse.js.map