"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.RoomScrollStateStore = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
/*
Copyright 2017 New Vector Ltd

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
 * Stores where the user has scrolled to in each room
 */
class RoomScrollStateStore {
  constructor() {
    // A map from room id to scroll state.
    //
    // If there is no special scroll state (ie, we are following the live
    // timeline), the scroll state is null. Otherwise, it is an object with
    // the following properties:
    //
    //    focussedEvent: the ID of the 'focussed' event. Typically this is
    //        the last event fully visible in the viewport, though if we
    //        have done an explicit scroll to an explicit event, it will be
    //        that event.
    //
    //    pixelOffset: the number of pixels the window is scrolled down
    //        from the focussedEvent.
    (0, _defineProperty2.default)(this, "scrollStateMap", new Map());
  }
  getScrollState(roomId) {
    return this.scrollStateMap.get(roomId);
  }
  setScrollState(roomId, scrollState) {
    if (scrollState === null) {
      this.scrollStateMap.delete(roomId);
    } else {
      this.scrollStateMap.set(roomId, scrollState);
    }
  }
}
exports.RoomScrollStateStore = RoomScrollStateStore;
if (window.mxRoomScrollStateStore === undefined) {
  window.mxRoomScrollStateStore = new RoomScrollStateStore();
}
var _default = window.mxRoomScrollStateStore;
exports.default = _default;
//# sourceMappingURL=RoomScrollStateStore.js.map