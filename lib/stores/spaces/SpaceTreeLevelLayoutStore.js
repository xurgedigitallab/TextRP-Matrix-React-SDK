"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
/*
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

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

const getSpaceCollapsedKey = (roomId, parents) => {
  const separator = "/";
  let path = "";
  if (parents) {
    for (const entry of parents.entries()) {
      path += entry + separator;
    }
  }
  return `mx_space_collapsed_${path + roomId}`;
};
class SpaceTreeLevelLayoutStore {
  static get instance() {
    if (!SpaceTreeLevelLayoutStore.internalInstance) {
      SpaceTreeLevelLayoutStore.internalInstance = new SpaceTreeLevelLayoutStore();
    }
    return SpaceTreeLevelLayoutStore.internalInstance;
  }
  setSpaceCollapsedState(roomId, parents, collapsed) {
    // XXX: localStorage doesn't allow booleans
    localStorage.setItem(getSpaceCollapsedKey(roomId, parents), collapsed.toString());
  }
  getSpaceCollapsedState(roomId, parents, fallback) {
    const collapsedLocalStorage = localStorage.getItem(getSpaceCollapsedKey(roomId, parents));
    // XXX: localStorage doesn't allow booleans
    return collapsedLocalStorage ? collapsedLocalStorage === "true" : fallback;
  }
}
exports.default = SpaceTreeLevelLayoutStore;
(0, _defineProperty2.default)(SpaceTreeLevelLayoutStore, "internalInstance", void 0);
//# sourceMappingURL=SpaceTreeLevelLayoutStore.js.map