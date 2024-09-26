"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.BreadcrumbsStore = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _room = require("matrix-js-sdk/src/models/room");
var _utils = require("matrix-js-sdk/src/utils");
var _client = require("matrix-js-sdk/src/client");
var _SettingsStore = _interopRequireDefault(require("../settings/SettingsStore"));
var _AsyncStoreWithClient = require("./AsyncStoreWithClient");
var _dispatcher = _interopRequireDefault(require("../dispatcher/dispatcher"));
var _arrays = require("../utils/arrays");
var _SettingLevel = require("../settings/SettingLevel");
var _actions = require("../dispatcher/actions");
/*
Copyright 2020 - 2021 The Matrix.org Foundation C.I.C.

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

const MAX_ROOMS = 20; // arbitrary
const AUTOJOIN_WAIT_THRESHOLD_MS = 90000; // 90s, the time we wait for an autojoined room to show up

class BreadcrumbsStore extends _AsyncStoreWithClient.AsyncStoreWithClient {
  constructor() {
    super(_dispatcher.default);
    (0, _defineProperty2.default)(this, "waitingRooms", []);
    (0, _defineProperty2.default)(this, "onMyMembership", async room => {
      // Only turn on breadcrumbs is the user hasn't explicitly turned it off again.
      const settingValueRaw = _SettingsStore.default.getValue("breadcrumbs", null, /*excludeDefault=*/true);
      if (this.meetsRoomRequirement && (0, _utils.isNullOrUndefined)(settingValueRaw)) {
        await _SettingsStore.default.setValue("breadcrumbs", null, _SettingLevel.SettingLevel.ACCOUNT, true);
      }
    });
    (0, _defineProperty2.default)(this, "onRoom", async room => {
      const waitingRoom = this.waitingRooms.find(r => r.roomId === room.roomId);
      if (!waitingRoom) return;
      this.waitingRooms.splice(this.waitingRooms.indexOf(waitingRoom), 1);
      if (Date.now() - waitingRoom.addedTs > AUTOJOIN_WAIT_THRESHOLD_MS) return; // Too long ago.
      await this.appendRoom(room);
    });
    _SettingsStore.default.monitorSetting("breadcrumb_rooms", null);
    _SettingsStore.default.monitorSetting("breadcrumbs", null);
    _SettingsStore.default.monitorSetting("feature_breadcrumbs_v2", null);
  }
  static get instance() {
    return BreadcrumbsStore.internalInstance;
  }
  get rooms() {
    return this.state.rooms || [];
  }
  get visible() {
    return !!this.state.enabled && this.meetsRoomRequirement;
  }

  /**
   * Do we have enough rooms to justify showing the breadcrumbs?
   * (Or is the labs feature enabled?)
   *
   * @returns true if there are at least 20 visible rooms or
   *          feature_breadcrumbs_v2 is enabled.
   */
  get meetsRoomRequirement() {
    if (_SettingsStore.default.getValue("feature_breadcrumbs_v2")) return true;
    const msc3946ProcessDynamicPredecessor = _SettingsStore.default.getValue("feature_dynamic_room_predecessors");
    return !!this.matrixClient && this.matrixClient.getVisibleRooms(msc3946ProcessDynamicPredecessor).length >= 20;
  }
  async onAction(payload) {
    if (!this.matrixClient) return;
    if (payload.action === _actions.Action.SettingUpdated) {
      if (payload.settingName === "breadcrumb_rooms") {
        await this.updateRooms();
      } else if (payload.settingName === "breadcrumbs" || payload.settingName === "feature_breadcrumbs_v2") {
        await this.updateState({
          enabled: _SettingsStore.default.getValue("breadcrumbs", null)
        });
      }
    } else if (payload.action === _actions.Action.ViewRoom) {
      if (payload.auto_join && payload.room_id && !this.matrixClient.getRoom(payload.room_id)) {
        // Queue the room instead of pushing it immediately. We're probably just
        // waiting for a room join to complete.
        this.waitingRooms.push({
          roomId: payload.room_id,
          addedTs: Date.now()
        });
      } else {
        // The tests might not result in a valid room object.
        const room = this.matrixClient.getRoom(payload.room_id);
        const membership = room?.getMyMembership();
        if (room && membership === "join") await this.appendRoom(room);
      }
    } else if (payload.action === _actions.Action.JoinRoom) {
      const room = this.matrixClient.getRoom(payload.roomId);
      if (room) await this.appendRoom(room);
    }
  }
  async onReady() {
    await this.updateRooms();
    await this.updateState({
      enabled: _SettingsStore.default.getValue("breadcrumbs", null)
    });
    if (this.matrixClient) {
      this.matrixClient.on(_room.RoomEvent.MyMembership, this.onMyMembership);
      this.matrixClient.on(_client.ClientEvent.Room, this.onRoom);
    }
  }
  async onNotReady() {
    if (this.matrixClient) {
      this.matrixClient.removeListener(_room.RoomEvent.MyMembership, this.onMyMembership);
      this.matrixClient.removeListener(_client.ClientEvent.Room, this.onRoom);
    }
  }
  async updateRooms() {
    let roomIds = _SettingsStore.default.getValue("breadcrumb_rooms");
    if (!roomIds || roomIds.length === 0) roomIds = [];
    const rooms = (0, _arrays.filterBoolean)(roomIds.map(r => this.matrixClient?.getRoom(r)));
    const currentRooms = this.state.rooms || [];
    if (!(0, _arrays.arrayHasDiff)(rooms, currentRooms)) return; // no change (probably echo)
    await this.updateState({
      rooms
    });
  }
  async appendRoom(room) {
    let updated = false;
    const rooms = (this.state.rooms || []).slice(); // cheap clone
    const msc3946ProcessDynamicPredecessor = _SettingsStore.default.getValue("feature_dynamic_room_predecessors");

    // If the room is upgraded, use that room instead. We'll also splice out
    // any children of the room.
    const history = this.matrixClient?.getRoomUpgradeHistory(room.roomId, false, msc3946ProcessDynamicPredecessor);
    if (history && history.length > 1) {
      room = history[history.length - 1]; // Last room is most recent in history

      // Take out any room that isn't the most recent room
      for (let i = 0; i < history.length - 1; i++) {
        const idx = rooms.findIndex(r => r.roomId === history[i].roomId);
        if (idx !== -1) {
          rooms.splice(idx, 1);
          updated = true;
        }
      }
    }

    // Remove the existing room, if it is present
    const existingIdx = rooms.findIndex(r => r.roomId === room.roomId);

    // If we're focusing on the first room no-op
    if (existingIdx !== 0) {
      if (existingIdx !== -1) {
        rooms.splice(existingIdx, 1);
      }

      // Splice the room to the start of the list
      rooms.splice(0, 0, room);
      updated = true;
    }
    if (rooms.length > MAX_ROOMS) {
      // This looks weird, but it's saying to start at the MAX_ROOMS point in the
      // list and delete everything after it.
      rooms.splice(MAX_ROOMS, rooms.length - MAX_ROOMS);
      updated = true;
    }
    if (updated) {
      // Update the breadcrumbs
      await this.updateState({
        rooms
      });
      const roomIds = rooms.map(r => r.roomId);
      if (roomIds.length > 0) {
        await _SettingsStore.default.setValue("breadcrumb_rooms", null, _SettingLevel.SettingLevel.ACCOUNT, roomIds);
      }
    }
  }
}
exports.BreadcrumbsStore = BreadcrumbsStore;
(0, _defineProperty2.default)(BreadcrumbsStore, "internalInstance", (() => {
  const instance = new BreadcrumbsStore();
  instance.start();
  return instance;
})());
//# sourceMappingURL=BreadcrumbsStore.js.map