"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ListNotificationState = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _NotificationColor = require("./NotificationColor");
var _arrays = require("../../utils/arrays");
var _NotificationState = require("./NotificationState");
/*
Copyright 2020 - 2022 The Matrix.org Foundation C.I.C.

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

class ListNotificationState extends _NotificationState.NotificationState {
  constructor() {
    let byTileCount = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
    let getRoomFn = arguments.length > 1 ? arguments[1] : undefined;
    super();
    this.byTileCount = byTileCount;
    this.getRoomFn = getRoomFn;
    (0, _defineProperty2.default)(this, "rooms", []);
    (0, _defineProperty2.default)(this, "states", {});
    (0, _defineProperty2.default)(this, "onRoomNotificationStateUpdate", () => {
      this.calculateTotalState();
    });
  }
  get symbol() {
    return this._color === _NotificationColor.NotificationColor.Unsent ? "!" : null;
  }
  setRooms(rooms) {
    // If we're only concerned about the tile count, don't bother setting up listeners.
    if (this.byTileCount) {
      this.rooms = rooms;
      this.calculateTotalState();
      return;
    }
    const oldRooms = this.rooms;
    const diff = (0, _arrays.arrayDiff)(oldRooms, rooms);
    this.rooms = [...rooms];
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
  getForRoom(room) {
    const state = this.states[room.roomId];
    if (!state) throw new Error("Unknown room for notification state");
    return state;
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
    if (this.byTileCount) {
      this._color = _NotificationColor.NotificationColor.Red;
      this._count = this.rooms.length;
    } else {
      this._count = 0;
      this._color = _NotificationColor.NotificationColor.None;
      for (const state of Object.values(this.states)) {
        this._count += state.count;
        this._color = Math.max(this.color, state.color);
      }
    }

    // finally, publish an update if needed
    this.emitIfUpdated(snapshot);
  }
}
exports.ListNotificationState = ListNotificationState;
//# sourceMappingURL=ListNotificationState.js.map