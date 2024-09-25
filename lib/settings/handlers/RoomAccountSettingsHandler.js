"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _room = require("matrix-js-sdk/src/models/room");
var _utils = require("matrix-js-sdk/src/utils");
var _MatrixClientBackedSettingsHandler = _interopRequireDefault(require("./MatrixClientBackedSettingsHandler"));
var _objects = require("../../utils/objects");
var _SettingLevel = require("../SettingLevel");
/*
Copyright 2017 Travis Ralston
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

const ALLOWED_WIDGETS_EVENT_TYPE = "im.vector.setting.allowed_widgets";
const DEFAULT_SETTINGS_EVENT_TYPE = "im.vector.web.settings";

/**
 * Gets and sets settings at the "room-account" level for the current user.
 */
class RoomAccountSettingsHandler extends _MatrixClientBackedSettingsHandler.default {
  constructor(watchers) {
    super();
    this.watchers = watchers;
    (0, _defineProperty2.default)(this, "onAccountData", (event, room, prevEvent) => {
      const roomId = room.roomId;
      if (event.getType() === "org.matrix.room.preview_urls") {
        let val = event.getContent()["disable"];
        if (typeof val !== "boolean") {
          val = null;
        } else {
          val = !val;
        }
        this.watchers.notifyUpdate("urlPreviewsEnabled", roomId, _SettingLevel.SettingLevel.ROOM_ACCOUNT, val);
      } else if (event.getType() === DEFAULT_SETTINGS_EVENT_TYPE) {
        // Figure out what changed and fire those updates
        const prevContent = prevEvent?.getContent() ?? {};
        const changedSettings = (0, _objects.objectKeyChanges)(prevContent, event.getContent());
        for (const settingName of changedSettings) {
          const val = event.getContent()[settingName];
          this.watchers.notifyUpdate(settingName, roomId, _SettingLevel.SettingLevel.ROOM_ACCOUNT, val);
        }
      } else if (event.getType() === ALLOWED_WIDGETS_EVENT_TYPE) {
        this.watchers.notifyUpdate("allowedWidgets", roomId, _SettingLevel.SettingLevel.ROOM_ACCOUNT, event.getContent());
      }
    });
  }
  initMatrixClient(oldClient, newClient) {
    if (oldClient) {
      oldClient.removeListener(_room.RoomEvent.AccountData, this.onAccountData);
    }
    newClient.on(_room.RoomEvent.AccountData, this.onAccountData);
  }
  getValue(settingName, roomId) {
    // Special case URL previews
    if (settingName === "urlPreviewsEnabled") {
      const content = this.getSettings(roomId, "org.matrix.room.preview_urls") || {};

      // Check to make sure that we actually got a boolean
      if (typeof content["disable"] !== "boolean") return null;
      return !content["disable"];
    }

    // Special case allowed widgets
    if (settingName === "allowedWidgets") {
      return this.getSettings(roomId, ALLOWED_WIDGETS_EVENT_TYPE);
    }
    const settings = this.getSettings(roomId) || {};
    return settings[settingName];
  }

  // helper function to send room account data then await it being echoed back
  async setRoomAccountData(roomId, eventType, field, value) {
    let content;
    if (field === null) {
      content = value;
    } else {
      content = this.getSettings(roomId, eventType) || {};
      content[field] = value;
    }
    await this.client.setRoomAccountData(roomId, eventType, content);
    const deferred = (0, _utils.defer)();
    const handler = (event, room) => {
      if (room.roomId !== roomId || event.getType() !== eventType) return;
      if (field !== null && event.getContent()[field] !== value) return;
      this.client.off(_room.RoomEvent.AccountData, handler);
      deferred.resolve();
    };
    this.client.on(_room.RoomEvent.AccountData, handler);
    await deferred.promise;
  }
  setValue(settingName, roomId, newValue) {
    switch (settingName) {
      // Special case URL previews
      case "urlPreviewsEnabled":
        return this.setRoomAccountData(roomId, "org.matrix.room.preview_urls", "disable", !newValue);

      // Special case allowed widgets
      case "allowedWidgets":
        return this.setRoomAccountData(roomId, ALLOWED_WIDGETS_EVENT_TYPE, null, newValue);
      default:
        return this.setRoomAccountData(roomId, DEFAULT_SETTINGS_EVENT_TYPE, settingName, newValue);
    }
  }
  canSetValue(settingName, roomId) {
    // If they have the room, they can set their own account data
    return !!this.client.getRoom(roomId);
  }
  isSupported() {
    return this.client && !this.client.isGuest();
  }
  getSettings(roomId) {
    let eventType = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : DEFAULT_SETTINGS_EVENT_TYPE;
    // TODO: [TS] Type return
    const event = this.client.getRoom(roomId)?.getAccountData(eventType);
    if (!event || !event.getContent()) return null;
    return (0, _objects.objectClone)(event.getContent()); // clone to prevent mutation
  }
}
exports.default = RoomAccountSettingsHandler;
//# sourceMappingURL=RoomAccountSettingsHandler.js.map