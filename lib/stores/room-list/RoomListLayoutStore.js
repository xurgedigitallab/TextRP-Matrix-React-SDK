"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _logger = require("matrix-js-sdk/src/logger");
var _ListLayout = require("./ListLayout");
var _AsyncStoreWithClient = require("../AsyncStoreWithClient");
var _dispatcher = _interopRequireDefault(require("../../dispatcher/dispatcher"));
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

class RoomListLayoutStore extends _AsyncStoreWithClient.AsyncStoreWithClient {
  constructor() {
    super(_dispatcher.default);
    (0, _defineProperty2.default)(this, "layoutMap", new Map());
  }
  static get instance() {
    if (!this.internalInstance) {
      this.internalInstance = new RoomListLayoutStore();
      this.internalInstance.start();
    }
    return RoomListLayoutStore.internalInstance;
  }
  ensureLayoutExists(tagId) {
    if (!this.layoutMap.has(tagId)) {
      this.layoutMap.set(tagId, new _ListLayout.ListLayout(tagId));
    }
  }
  getLayoutFor(tagId) {
    if (!this.layoutMap.has(tagId)) {
      this.layoutMap.set(tagId, new _ListLayout.ListLayout(tagId));
    }
    return this.layoutMap.get(tagId);
  }

  // Note: this primarily exists for debugging, and isn't really intended to be used by anything.
  async resetLayouts() {
    _logger.logger.warn("Resetting layouts for room list");
    for (const layout of this.layoutMap.values()) {
      layout.reset();
    }
  }
  async onNotReady() {
    // On logout, clear the map.
    this.layoutMap.clear();
  }

  // We don't need this function, but our contract says we do
  async onAction(payload) {}
}
exports.default = RoomListLayoutStore;
(0, _defineProperty2.default)(RoomListLayoutStore, "internalInstance", void 0);
window.mxRoomListLayoutStore = RoomListLayoutStore.instance;
//# sourceMappingURL=RoomListLayoutStore.js.map