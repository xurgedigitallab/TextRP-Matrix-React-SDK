"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _roomState = require("matrix-js-sdk/src/models/room-state");
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

const DEFAULT_SETTINGS_EVENT_TYPE = "im.vector.web.settings";

/**
 * Gets and sets settings at the "room" level.
 */
class RoomSettingsHandler extends _MatrixClientBackedSettingsHandler.default {
  constructor(watchers) {
    super();
    this.watchers = watchers;
    (0, _defineProperty2.default)(this, "onEvent", (event, state, prevEvent) => {
      const roomId = event.getRoomId();
      const room = this.client.getRoom(roomId);

      // Note: in tests and during the encryption setup on initial load we might not have
      // rooms in the store, so we just quietly ignore the problem. If we log it then we'll
      // just end up spamming the logs a few thousand times. It is perfectly fine for us
      // to ignore the problem as the app will not have loaded enough to care yet.
      if (!room) return;

      // ignore state updates which are not current
      if (room && state !== room.currentState) return;
      if (event.getType() === "org.matrix.room.preview_urls") {
        let val = event.getContent()["disable"];
        if (typeof val !== "boolean") {
          val = null;
        } else {
          val = !val;
        }
        this.watchers.notifyUpdate("urlPreviewsEnabled", roomId, _SettingLevel.SettingLevel.ROOM, val);
      } else if (event.getType() === DEFAULT_SETTINGS_EVENT_TYPE) {
        // Figure out what changed and fire those updates
        const prevContent = prevEvent?.getContent() ?? {};
        const changedSettings = (0, _objects.objectKeyChanges)(prevContent, event.getContent());
        for (const settingName of changedSettings) {
          this.watchers.notifyUpdate(settingName, roomId, _SettingLevel.SettingLevel.ROOM, event.getContent()[settingName]);
        }
      }
    });
  }
  initMatrixClient(oldClient, newClient) {
    if (oldClient) {
      oldClient.removeListener(_roomState.RoomStateEvent.Events, this.onEvent);
    }
    newClient.on(_roomState.RoomStateEvent.Events, this.onEvent);
  }
  getValue(settingName, roomId) {
    // Special case URL previews
    if (settingName === "urlPreviewsEnabled") {
      const content = this.getSettings(roomId, "org.matrix.room.preview_urls") || {};

      // Check to make sure that we actually got a boolean
      if (typeof content["disable"] !== "boolean") return null;
      return !content["disable"];
    }
    const settings = this.getSettings(roomId) || {};
    return settings[settingName];
  }

  // helper function to send state event then await it being echoed back
  async sendStateEvent(roomId, eventType, field, value) {
    const content = this.getSettings(roomId, eventType) || {};
    content[field] = value;
    const {
      event_id: eventId
    } = await this.client.sendStateEvent(roomId, eventType, content);
    const deferred = (0, _utils.defer)();
    const handler = event => {
      if (event.getId() !== eventId) return;
      this.client.off(_roomState.RoomStateEvent.Events, handler);
      deferred.resolve();
    };
    this.client.on(_roomState.RoomStateEvent.Events, handler);
    await deferred.promise;
  }
  setValue(settingName, roomId, newValue) {
    switch (settingName) {
      // Special case URL previews
      case "urlPreviewsEnabled":
        return this.sendStateEvent(roomId, "org.matrix.room.preview_urls", "disable", !newValue);
      default:
        return this.sendStateEvent(roomId, DEFAULT_SETTINGS_EVENT_TYPE, settingName, newValue);
    }
  }
  canSetValue(settingName, roomId) {
    const room = this.client.getRoom(roomId);
    let eventType = DEFAULT_SETTINGS_EVENT_TYPE;
    if (settingName === "urlPreviewsEnabled") eventType = "org.matrix.room.preview_urls";
    return room?.currentState.maySendStateEvent(eventType, this.client.getUserId()) ?? false;
  }
  isSupported() {
    return !!this.client;
  }
  getSettings(roomId) {
    let eventType = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : DEFAULT_SETTINGS_EVENT_TYPE;
    const event = this.client.getRoom(roomId)?.currentState.getStateEvents(eventType, "");
    if (!event?.getContent()) return null;
    return (0, _objects.objectClone)(event.getContent()); // clone to prevent mutation
  }
}
exports.default = RoomSettingsHandler;
//# sourceMappingURL=RoomSettingsHandler.js.map