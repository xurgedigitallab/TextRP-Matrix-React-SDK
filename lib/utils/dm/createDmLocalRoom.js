"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createDmLocalRoom = createDmLocalRoom;
var _olmlib = require("matrix-js-sdk/src/crypto/olmlib");
var _matrix = require("matrix-js-sdk/src/matrix");
var _LocalRoom = require("../../../src/models/LocalRoom");
var _directMessages = require("../../../src/utils/direct-messages");
/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
 * Create a DM local room. This room will not be send to the server and only exists inside the client.
 * It sets up the local room with some artificial state events
 * so that can be used in most components instead of a „real“ room.
 *
 * @async
 * @param {MatrixClient} client
 * @param {Member[]} targets DM partners
 * @returns {Promise<LocalRoom>} Resolves to the new local room
 */
async function createDmLocalRoom(client, targets) {
  const userId = client.getUserId();
  const localRoom = new _LocalRoom.LocalRoom(_LocalRoom.LOCAL_ROOM_ID_PREFIX + client.makeTxnId(), client, userId);
  const events = [];
  events.push(new _matrix.MatrixEvent({
    event_id: `~${localRoom.roomId}:${client.makeTxnId()}`,
    type: _matrix.EventType.RoomCreate,
    content: {
      creator: userId,
      room_version: _matrix.KNOWN_SAFE_ROOM_VERSION
    },
    state_key: "",
    user_id: userId,
    sender: userId,
    room_id: localRoom.roomId,
    origin_server_ts: Date.now()
  }));
  if (await (0, _directMessages.determineCreateRoomEncryptionOption)(client, targets)) {
    localRoom.encrypted = true;
    events.push(new _matrix.MatrixEvent({
      event_id: `~${localRoom.roomId}:${client.makeTxnId()}`,
      type: _matrix.EventType.RoomEncryption,
      content: {
        algorithm: _olmlib.MEGOLM_ALGORITHM
      },
      user_id: userId,
      sender: userId,
      state_key: "",
      room_id: localRoom.roomId,
      origin_server_ts: Date.now()
    }));
  }
  events.push(new _matrix.MatrixEvent({
    event_id: `~${localRoom.roomId}:${client.makeTxnId()}`,
    type: _matrix.EventType.RoomMember,
    content: {
      displayname: userId,
      membership: "join"
    },
    state_key: userId,
    user_id: userId,
    sender: userId,
    room_id: localRoom.roomId
  }));
  targets.forEach(target => {
    events.push(new _matrix.MatrixEvent({
      event_id: `~${localRoom.roomId}:${client.makeTxnId()}`,
      type: _matrix.EventType.RoomMember,
      content: {
        displayname: target.name,
        avatar_url: target.getMxcAvatarUrl() ?? undefined,
        membership: "invite",
        isDirect: true
      },
      state_key: target.userId,
      sender: userId,
      room_id: localRoom.roomId
    }));
    events.push(new _matrix.MatrixEvent({
      event_id: `~${localRoom.roomId}:${client.makeTxnId()}`,
      type: _matrix.EventType.RoomMember,
      content: {
        displayname: target.name,
        avatar_url: target.getMxcAvatarUrl() ?? undefined,
        membership: "join"
      },
      state_key: target.userId,
      sender: target.userId,
      room_id: localRoom.roomId
    }));
  });
  localRoom.targets = targets;
  localRoom.updateMyMembership("join");
  localRoom.addLiveEvents(events);
  localRoom.currentState.setStateEvents(events);
  localRoom.name = localRoom.getDefaultRoomName(client.getUserId());
  client.store.storeRoom(localRoom);
  return localRoom;
}
//# sourceMappingURL=createDmLocalRoom.js.map