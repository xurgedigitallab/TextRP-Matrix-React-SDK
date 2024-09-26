"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SpaceNotificationState = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _NotificationColor = require("./NotificationColor");
var _arrays = require("../../utils/arrays");
var _NotificationState = require("./NotificationState");
var _models = require("../room-list/models");
var _RoomListStore = _interopRequireDefault(require("../room-list/RoomListStore"));
/*
Copyright 2021 - 2022 The Matrix.org Foundation C.I.C.

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

class SpaceNotificationState extends _NotificationState.NotificationState {
  constructor(getRoomFn) {
    super();
    this.getRoomFn = getRoomFn;
    (0, _defineProperty2.default)(this, "rooms", []);
    // exposed only for tests
    (0, _defineProperty2.default)(this, "states", {});
    (0, _defineProperty2.default)(this, "onRoomNotificationStateUpdate", () => {
      this.calculateTotalState();
    });
  }
  get symbol() {
    return this._color === _NotificationColor.NotificationColor.Unsent ? "!" : null;
  }
  setRooms(rooms) {
    const oldRooms = this.rooms;
    const diff = (0, _arrays.arrayDiff)(oldRooms, rooms);
    this.rooms = rooms;
    for (const oldRoom of diff.removed) {
      const state = this.states[oldRoom.roomId];
      if (!state) continue; // We likely just didn't have a badge (race condition)
      delete this.states[oldRoom.roomId];
      state.off(_NotificationState.NotificationStateEvents.Update, this.onRoomNotificationStateUpdate);
    }
    for (const newRoom of diff.added) {
      const state = this.getRoomFn(newRoom);
      state.on(_NotificationState.NotificationStateEvents.Update, this.onRoomNotificationStateUpdate);
      this.states[newRoom.roomId] = state;
    }
    this.calculateTotalState();
  }
  getFirstRoomWithNotifications() {
    return Object.values(this.states).find(state => state.color >= this.color)?.room.roomId;
  }
  destroy() {
    super.destroy();
    for (const state of Object.values(this.states)) {
      state.off(_NotificationState.NotificationStateEvents.Update, this.onRoomNotificationStateUpdate);
    }
    this.states = {};
  }
  calculateTotalState() {
    const snapshot = this.snapshot();
    this._count = 0;
    this._color = _NotificationColor.NotificationColor.None;
    for (const [roomId, state] of Object.entries(this.states)) {
      const room = this.rooms.find(r => r.roomId === roomId);
      const roomTags = room ? _RoomListStore.default.instance.getTagsForRoom(room) : [];

      // We ignore unreads in LowPriority rooms, see https://github.com/vector-im/element-web/issues/16836
      if (roomTags.includes(_models.DefaultTagID.LowPriority) && state.color === _NotificationColor.NotificationColor.Bold) continue;
      this._count += state.count;
      this._color = Math.max(this.color, state.color);
    }

    // finally, publish an update if needed
    this.emitIfUpdated(snapshot);
  }
}
exports.SpaceNotificationState = SpaceNotificationState;
//# sourceMappingURL=SpaceNotificationState.js.map