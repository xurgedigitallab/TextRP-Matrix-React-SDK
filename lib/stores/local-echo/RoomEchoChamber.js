"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RoomEchoChamber = exports.CachedRoomKey = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _event = require("matrix-js-sdk/src/@types/event");
var _matrix = require("matrix-js-sdk/src/matrix");
var _GenericEchoChamber = require("./GenericEchoChamber");
var _RoomNotifs = require("../../RoomNotifs");
var _languageHandler = require("../../languageHandler");
/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
let CachedRoomKey = /*#__PURE__*/function (CachedRoomKey) {
  CachedRoomKey[CachedRoomKey["NotificationVolume"] = 0] = "NotificationVolume";
  return CachedRoomKey;
}({});
exports.CachedRoomKey = CachedRoomKey;
class RoomEchoChamber extends _GenericEchoChamber.GenericEchoChamber {
  constructor(context) {
    super(context, k => this.properties.get(k));
    (0, _defineProperty2.default)(this, "properties", new Map());
    (0, _defineProperty2.default)(this, "onAccountData", event => {
      if (!this.matrixClient) return;
      if (event.getType() === _event.EventType.PushRules) {
        const currentVolume = this.properties.get(CachedRoomKey.NotificationVolume);
        const newVolume = (0, _RoomNotifs.getRoomNotifsState)(this.matrixClient, this.context.room.roomId);
        if (currentVolume !== newVolume) {
          this.updateNotificationVolume();
        }
      }
    });
  }
  onClientChanged(oldClient, newClient) {
    this.properties.clear();
    oldClient?.removeListener(_matrix.ClientEvent.AccountData, this.onAccountData);
    if (newClient) {
      // Register the listeners first
      newClient.on(_matrix.ClientEvent.AccountData, this.onAccountData);

      // Then populate the properties map
      this.updateNotificationVolume();
    }
  }
  updateNotificationVolume() {
    const state = this.matrixClient ? (0, _RoomNotifs.getRoomNotifsState)(this.matrixClient, this.context.room.roomId) : null;
    if (state) this.properties.set(CachedRoomKey.NotificationVolume, state);else this.properties.delete(CachedRoomKey.NotificationVolume);
    this.markEchoReceived(CachedRoomKey.NotificationVolume);
    this.emit(_GenericEchoChamber.PROPERTY_UPDATED, CachedRoomKey.NotificationVolume);
  }

  // ---- helpers below here ----

  get notificationVolume() {
    return this.getValue(CachedRoomKey.NotificationVolume);
  }
  set notificationVolume(v) {
    if (v === undefined) return;
    this.setValue((0, _languageHandler._t)("Change notification settings"), CachedRoomKey.NotificationVolume, v, async () => {
      return (0, _RoomNotifs.setRoomNotifsState)(this.context.room.client, this.context.room.roomId, v);
    }, _GenericEchoChamber.implicitlyReverted);
  }
}
exports.RoomEchoChamber = RoomEchoChamber;
//# sourceMappingURL=RoomEchoChamber.js.map