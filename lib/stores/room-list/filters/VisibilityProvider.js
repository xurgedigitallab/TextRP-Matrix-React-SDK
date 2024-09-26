"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.VisibilityProvider = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _LegacyCallHandler = _interopRequireDefault(require("../../../LegacyCallHandler"));
var _RoomList = require("../../../customisations/RoomList");
var _isLocalRoom = require("../../../utils/localRoom/isLocalRoom");
var _VoipUserMapper = _interopRequireDefault(require("../../../VoipUserMapper"));
/*
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

class VisibilityProvider {
  constructor() {}
  static get instance() {
    if (!VisibilityProvider.internalInstance) {
      VisibilityProvider.internalInstance = new VisibilityProvider();
    }
    return VisibilityProvider.internalInstance;
  }
  async onNewInvitedRoom(room) {
    await _VoipUserMapper.default.sharedInstance().onNewInvitedRoom(room);
  }
  isRoomVisible(room) {
    if (!room) {
      return false;
    }
    if (_LegacyCallHandler.default.instance.getSupportsVirtualRooms() && _VoipUserMapper.default.sharedInstance().isVirtualRoom(room)) {
      return false;
    }

    // hide space rooms as they'll be shown in the SpacePanel
    if (room.isSpaceRoom()) {
      return false;
    }
    if ((0, _isLocalRoom.isLocalRoom)(room)) {
      // local rooms shouldn't show up anywhere
      return false;
    }
    const isVisibleFn = _RoomList.RoomListCustomisations.isRoomVisible;
    if (isVisibleFn) {
      return isVisibleFn(room);
    }
    return true; // default
  }
}
exports.VisibilityProvider = VisibilityProvider;
(0, _defineProperty2.default)(VisibilityProvider, "internalInstance", void 0);
//# sourceMappingURL=VisibilityProvider.js.map