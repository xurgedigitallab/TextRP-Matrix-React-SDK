"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Mjolnir = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _partials = require("matrix-js-sdk/src/@types/partials");
var _logger = require("matrix-js-sdk/src/logger");
var _roomState = require("matrix-js-sdk/src/models/room-state");
var _MatrixClientPeg = require("../MatrixClientPeg");
var _BanList = require("./BanList");
var _SettingsStore = _interopRequireDefault(require("../settings/SettingsStore"));
var _languageHandler = require("../languageHandler");
var _dispatcher = _interopRequireDefault(require("../dispatcher/dispatcher"));
var _SettingLevel = require("../settings/SettingLevel");
var _actions = require("../dispatcher/actions");
/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

// TODO: Move this and related files to the js-sdk or something once finalized.

class Mjolnir {
  constructor() {
    (0, _defineProperty2.default)(this, "_lists", []);
    // eslint-disable-line @typescript-eslint/naming-convention
    (0, _defineProperty2.default)(this, "_roomIds", []);
    // eslint-disable-line @typescript-eslint/naming-convention
    (0, _defineProperty2.default)(this, "mjolnirWatchRef", null);
    (0, _defineProperty2.default)(this, "dispatcherRef", null);
    (0, _defineProperty2.default)(this, "onAction", payload => {
      if (payload["action"] === "setup_mjolnir") {
        _logger.logger.log("Setting up Mjolnir: after sync");
        this.setup();
      }
    });
    (0, _defineProperty2.default)(this, "onEvent", event => {
      if (!_MatrixClientPeg.MatrixClientPeg.get()) return;
      if (!this._roomIds.includes(event.getRoomId())) return;
      if (!_BanList.ALL_RULE_TYPES.includes(event.getType())) return;
      this.updateLists(this._roomIds);
    });
  }
  get roomIds() {
    return this._roomIds;
  }
  get lists() {
    return this._lists;
  }
  start() {
    this.mjolnirWatchRef = _SettingsStore.default.watchSetting("mjolnirRooms", null, this.onListsChanged.bind(this));
    this.dispatcherRef = _dispatcher.default.register(this.onAction);
    _dispatcher.default.dispatch({
      action: _actions.Action.DoAfterSyncPrepared,
      deferred_action: {
        action: "setup_mjolnir"
      }
    });
  }
  setup() {
    if (!_MatrixClientPeg.MatrixClientPeg.get()) return;
    this.updateLists(_SettingsStore.default.getValue("mjolnirRooms"));
    _MatrixClientPeg.MatrixClientPeg.get().on(_roomState.RoomStateEvent.Events, this.onEvent);
  }
  stop() {
    if (this.mjolnirWatchRef) {
      _SettingsStore.default.unwatchSetting(this.mjolnirWatchRef);
      this.mjolnirWatchRef = null;
    }
    if (this.dispatcherRef) {
      _dispatcher.default.unregister(this.dispatcherRef);
      this.dispatcherRef = null;
    }
    if (!_MatrixClientPeg.MatrixClientPeg.get()) return;
    _MatrixClientPeg.MatrixClientPeg.get().removeListener(_roomState.RoomStateEvent.Events, this.onEvent);
  }
  async getOrCreatePersonalList() {
    let personalRoomId = _SettingsStore.default.getValue("mjolnirPersonalRoom");
    if (!personalRoomId) {
      const resp = await _MatrixClientPeg.MatrixClientPeg.get().createRoom({
        name: (0, _languageHandler._t)("My Ban List"),
        topic: (0, _languageHandler._t)("This is your list of users/servers you have blocked - don't leave the room!"),
        preset: _partials.Preset.PrivateChat
      });
      personalRoomId = resp["room_id"];
      await _SettingsStore.default.setValue("mjolnirPersonalRoom", null, _SettingLevel.SettingLevel.ACCOUNT, personalRoomId);
      await _SettingsStore.default.setValue("mjolnirRooms", null, _SettingLevel.SettingLevel.ACCOUNT, [personalRoomId, ...this._roomIds]);
    }
    if (!personalRoomId) {
      throw new Error("Error finding a room ID to use");
    }
    let list = this._lists.find(b => b.roomId === personalRoomId);
    if (!list) list = new _BanList.BanList(personalRoomId);
    // we don't append the list to the tracked rooms because it should already be there.
    // we're just trying to get the caller some utility access to the list

    return list;
  }

  // get without creating the list
  getPersonalList() {
    const personalRoomId = _SettingsStore.default.getValue("mjolnirPersonalRoom");
    if (!personalRoomId) return null;
    let list = this._lists.find(b => b.roomId === personalRoomId);
    if (!list) list = new _BanList.BanList(personalRoomId);
    // we don't append the list to the tracked rooms because it should already be there.
    // we're just trying to get the caller some utility access to the list

    return list;
  }
  async subscribeToList(roomId) {
    const roomIds = [...this._roomIds, roomId];
    await _SettingsStore.default.setValue("mjolnirRooms", null, _SettingLevel.SettingLevel.ACCOUNT, roomIds);
    this._lists.push(new _BanList.BanList(roomId));
  }
  async unsubscribeFromList(roomId) {
    const roomIds = this._roomIds.filter(r => r !== roomId);
    await _SettingsStore.default.setValue("mjolnirRooms", null, _SettingLevel.SettingLevel.ACCOUNT, roomIds);
    this._lists = this._lists.filter(b => b.roomId !== roomId);
  }
  onListsChanged(settingName, roomId, atLevel, newValue) {
    // We know that ban lists are only recorded at one level so we don't need to re-eval them
    this.updateLists(newValue);
  }
  updateLists(listRoomIds) {
    if (!_MatrixClientPeg.MatrixClientPeg.get()) return;
    _logger.logger.log("Updating Mjolnir ban lists to: " + listRoomIds);
    this._lists = [];
    this._roomIds = listRoomIds || [];
    if (!listRoomIds) return;
    for (const roomId of listRoomIds) {
      // Creating the list updates it
      this._lists.push(new _BanList.BanList(roomId));
    }
  }
  isServerBanned(serverName) {
    for (const list of this._lists) {
      for (const rule of list.serverRules) {
        if (rule.isMatch(serverName)) {
          return true;
        }
      }
    }
    return false;
  }
  isUserBanned(userId) {
    for (const list of this._lists) {
      for (const rule of list.userRules) {
        if (rule.isMatch(userId)) {
          return true;
        }
      }
    }
    return false;
  }
  static sharedInstance() {
    if (!Mjolnir.instance) {
      Mjolnir.instance = new Mjolnir();
    }
    return Mjolnir.instance;
  }
}
exports.Mjolnir = Mjolnir;
(0, _defineProperty2.default)(Mjolnir, "instance", null);
//# sourceMappingURL=Mjolnir.js.map