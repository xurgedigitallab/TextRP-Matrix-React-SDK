"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SpaceFilterCondition = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _events = require("events");
var _IFilterCondition = require("./IFilterCondition");
var _SpaceStore = _interopRequireDefault(require("../../spaces/SpaceStore"));
var _spaces = require("../../spaces");
var _sets = require("../../../utils/sets");
var _SettingsStore = _interopRequireDefault(require("../../../settings/SettingsStore"));
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
 * A filter condition for the room list which reveals rooms which
 * are a member of a given space or if no space is selected shows:
 *  + Orphaned rooms (ones not in any space you are a part of)
 *  + All DMs
 */
class SpaceFilterCondition extends _events.EventEmitter {
  constructor() {
    var _this;
    super(...arguments);
    _this = this;
    (0, _defineProperty2.default)(this, "roomIds", new Set());
    (0, _defineProperty2.default)(this, "userIds", new Set());
    (0, _defineProperty2.default)(this, "showPeopleInSpace", true);
    (0, _defineProperty2.default)(this, "space", _spaces.MetaSpace.Home);
    (0, _defineProperty2.default)(this, "onStoreUpdate", async function () {
      let forceUpdate = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
      const beforeRoomIds = _this.roomIds;
      // clone the set as it may be mutated by the space store internally
      _this.roomIds = new Set(_SpaceStore.default.instance.getSpaceFilteredRoomIds(_this.space));
      const beforeUserIds = _this.userIds;
      // clone the set as it may be mutated by the space store internally
      _this.userIds = new Set(_SpaceStore.default.instance.getSpaceFilteredUserIds(_this.space));
      const beforeShowPeopleInSpace = _this.showPeopleInSpace;
      _this.showPeopleInSpace = (0, _spaces.isMetaSpace)(_this.space[0]) || _SettingsStore.default.getValue("Spaces.showPeopleInSpace", _this.space);
      if (forceUpdate || beforeShowPeopleInSpace !== _this.showPeopleInSpace || (0, _sets.setHasDiff)(beforeRoomIds, _this.roomIds) || (0, _sets.setHasDiff)(beforeUserIds, _this.userIds)) {
        _this.emit(_IFilterCondition.FILTER_CHANGED);
        // XXX: Room List Store has a bug where updates to the pre-filter during a local echo of a
        // tags transition seem to be ignored, so refire in the next tick to work around it
        setImmediate(() => {
          _this.emit(_IFilterCondition.FILTER_CHANGED);
        });
      }
    });
  }
  isVisible(room) {
    return _SpaceStore.default.instance.isRoomInSpace(this.space, room.roomId);
  }
  updateSpace(space) {
    _SpaceStore.default.instance.off(this.space, this.onStoreUpdate);
    _SpaceStore.default.instance.on(this.space = space, this.onStoreUpdate);
    this.onStoreUpdate(true); // initial update from the change to the space
  }

  destroy() {
    _SpaceStore.default.instance.off(this.space, this.onStoreUpdate);
  }
}
exports.SpaceFilterCondition = SpaceFilterCondition;
//# sourceMappingURL=SpaceFilterCondition.js.map