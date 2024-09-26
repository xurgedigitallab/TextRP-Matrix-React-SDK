"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SpaceWatcher = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _SpaceFilterCondition = require("./filters/SpaceFilterCondition");
var _SpaceStore = _interopRequireDefault(require("../spaces/SpaceStore"));
var _spaces = require("../spaces");
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
 * Watches for changes in spaces to manage the filter on the provided RoomListStore
 */
class SpaceWatcher {
  constructor(store) {
    var _this = this;
    this.store = store;
    (0, _defineProperty2.default)(this, "filter", new _SpaceFilterCondition.SpaceFilterCondition());
    // we track these separately to the SpaceStore as we need to observe transitions
    (0, _defineProperty2.default)(this, "activeSpace", _SpaceStore.default.instance.activeSpace);
    (0, _defineProperty2.default)(this, "allRoomsInHome", _SpaceStore.default.instance.allRoomsInHome);
    (0, _defineProperty2.default)(this, "onSelectedSpaceUpdated", function (activeSpace) {
      let allRoomsInHome = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : _this.allRoomsInHome;
      if (activeSpace === _this.activeSpace && allRoomsInHome === _this.allRoomsInHome) return; // nop

      const neededFilter = SpaceWatcher.needsFilter(_this.activeSpace, _this.allRoomsInHome);
      const needsFilter = SpaceWatcher.needsFilter(activeSpace, allRoomsInHome);
      _this.activeSpace = activeSpace;
      _this.allRoomsInHome = allRoomsInHome;
      if (needsFilter) {
        _this.updateFilter();
      }
      if (!neededFilter && needsFilter) {
        _this.store.addFilter(_this.filter);
      } else if (neededFilter && !needsFilter) {
        _this.store.removeFilter(_this.filter);
      }
    });
    (0, _defineProperty2.default)(this, "onHomeBehaviourUpdated", allRoomsInHome => {
      this.onSelectedSpaceUpdated(this.activeSpace, allRoomsInHome);
    });
    (0, _defineProperty2.default)(this, "updateFilter", () => {
      this.filter.updateSpace(this.activeSpace);
    });
    if (SpaceWatcher.needsFilter(this.activeSpace, this.allRoomsInHome)) {
      this.updateFilter();
      store.addFilter(this.filter);
    }
    _SpaceStore.default.instance.on(_spaces.UPDATE_SELECTED_SPACE, this.onSelectedSpaceUpdated);
    _SpaceStore.default.instance.on(_spaces.UPDATE_HOME_BEHAVIOUR, this.onHomeBehaviourUpdated);
  }
  static needsFilter(spaceKey, allRoomsInHome) {
    return !(spaceKey === _spaces.MetaSpace.Home && allRoomsInHome);
  }
}
exports.SpaceWatcher = SpaceWatcher;
//# sourceMappingURL=SpaceWatcher.js.map