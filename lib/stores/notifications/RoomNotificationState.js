"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RoomNotificationState = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _event = require("matrix-js-sdk/src/models/event");
var _room = require("matrix-js-sdk/src/models/room");
var _client = require("matrix-js-sdk/src/client");
var _MatrixClientPeg = require("../../MatrixClientPeg");
var _readReceipts = require("../../utils/read-receipts");
var RoomNotifs = _interopRequireWildcard(require("../../RoomNotifs"));
var _NotificationState = require("./NotificationState");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
/*
Copyright 2020, 2023 The Matrix.org Foundation C.I.C.

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

class RoomNotificationState extends _NotificationState.NotificationState {
  constructor(room) {
    super();
    this.room = room;
    (0, _defineProperty2.default)(this, "handleLocalEchoUpdated", () => {
      this.updateNotificationState();
    });
    (0, _defineProperty2.default)(this, "handleReadReceipt", (event, room) => {
      if (!(0, _readReceipts.readReceiptChangeIsFor)(event, _MatrixClientPeg.MatrixClientPeg.get())) return; // not our own - ignore
      if (room.roomId !== this.room.roomId) return; // not for us - ignore
      this.updateNotificationState();
    });
    (0, _defineProperty2.default)(this, "handleMembershipUpdate", () => {
      this.updateNotificationState();
    });
    (0, _defineProperty2.default)(this, "handleNotificationCountUpdate", () => {
      this.updateNotificationState();
    });
    (0, _defineProperty2.default)(this, "onEventDecrypted", event => {
      if (event.getRoomId() !== this.room.roomId) return; // ignore - not for us or notifications timeline

      this.updateNotificationState();
    });
    (0, _defineProperty2.default)(this, "handleRoomEventUpdate", event => {
      if (event?.getRoomId() !== this.room.roomId) return; // ignore - not for us or notifications timeline
      this.updateNotificationState();
    });
    (0, _defineProperty2.default)(this, "handleAccountDataUpdate", ev => {
      if (ev.getType() === "m.push_rules") {
        this.updateNotificationState();
      }
    });
    const cli = this.room.client;
    this.room.on(_room.RoomEvent.Receipt, this.handleReadReceipt);
    this.room.on(_room.RoomEvent.MyMembership, this.handleMembershipUpdate);
    this.room.on(_room.RoomEvent.LocalEchoUpdated, this.handleLocalEchoUpdated);
    this.room.on(_room.RoomEvent.Timeline, this.handleRoomEventUpdate);
    this.room.on(_room.RoomEvent.Redaction, this.handleRoomEventUpdate);
    this.room.on(_room.RoomEvent.UnreadNotifications, this.handleNotificationCountUpdate); // for server-sent counts
    cli.on(_event.MatrixEventEvent.Decrypted, this.onEventDecrypted);
    cli.on(_client.ClientEvent.AccountData, this.handleAccountDataUpdate);
    this.updateNotificationState();
  }
  destroy() {
    super.destroy();
    const cli = this.room.client;
    this.room.removeListener(_room.RoomEvent.Receipt, this.handleReadReceipt);
    this.room.removeListener(_room.RoomEvent.MyMembership, this.handleMembershipUpdate);
    this.room.removeListener(_room.RoomEvent.LocalEchoUpdated, this.handleLocalEchoUpdated);
    this.room.removeListener(_room.RoomEvent.Timeline, this.handleRoomEventUpdate);
    this.room.removeListener(_room.RoomEvent.Redaction, this.handleRoomEventUpdate);
    cli.removeListener(_event.MatrixEventEvent.Decrypted, this.onEventDecrypted);
    cli.removeListener(_client.ClientEvent.AccountData, this.handleAccountDataUpdate);
  }
  updateNotificationState() {
    const snapshot = this.snapshot();
    const {
      color,
      symbol,
      count
    } = RoomNotifs.determineUnreadState(this.room);
    const muted = RoomNotifs.getRoomNotifsState(this.room.client, this.room.roomId) === RoomNotifs.RoomNotifState.Mute;
    this._color = color;
    this._symbol = symbol;
    this._count = count;
    this._muted = muted;

    // finally, publish an update if needed
    this.emitIfUpdated(snapshot);
  }
}
exports.RoomNotificationState = RoomNotificationState;
//# sourceMappingURL=RoomNotificationState.js.map