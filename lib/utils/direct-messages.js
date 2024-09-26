"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ThreepidMember = exports.Member = exports.DirectoryMember = void 0;
exports.createRoomFromLocalRoom = createRoomFromLocalRoom;
exports.determineCreateRoomEncryptionOption = determineCreateRoomEncryptionOption;
exports.startDmOnFirstMessage = startDmOnFirstMessage;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _client = require("matrix-js-sdk/src/client");
var _logger = require("matrix-js-sdk/src/logger");
var _createRoom = require("../createRoom");
var _actions = require("../dispatcher/actions");
var _dispatcher = _interopRequireDefault(require("../dispatcher/dispatcher"));
var _LocalRoom = require("../models/LocalRoom");
var _localRoom = require("./local-room");
var _findDMRoom = require("./dm/findDMRoom");
var _rooms = require("./rooms");
var _createDmLocalRoom = require("./dm/createDmLocalRoom");
var _startDm = require("./dm/startDm");
var _threepids = require("./threepids");
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

async function startDmOnFirstMessage(client, targets) {
  let resolvedTargets = targets;
  try {
    resolvedTargets = await (0, _threepids.resolveThreePids)(targets, client);
  } catch (e) {
    _logger.logger.warn("Error resolving 3rd-party members", e);
  }
  const existingRoom = (0, _findDMRoom.findDMRoom)(client, resolvedTargets);
  if (existingRoom) {
    _dispatcher.default.dispatch({
      action: _actions.Action.ViewRoom,
      room_id: existingRoom.roomId,
      should_peek: false,
      joining: false,
      metricsTrigger: "MessageUser"
    });
    return existingRoom.roomId;
  }
  if (targets.length === 1 && targets[0] instanceof ThreepidMember && (0, _rooms.privateShouldBeEncrypted)(client)) {
    // Single 3rd-party invite and well-known promotes encryption:
    // Directly create a room and invite the other.
    return await (0, _startDm.startDm)(client, targets);
  }
  const room = await (0, _createDmLocalRoom.createDmLocalRoom)(client, resolvedTargets);
  _dispatcher.default.dispatch({
    action: _actions.Action.ViewRoom,
    room_id: room.roomId,
    joining: false,
    targets: resolvedTargets
  });
  return room.roomId;
}

/**
 * Starts a DM based on a local room.
 *
 * @async
 * @param {MatrixClient} client
 * @param {LocalRoom} localRoom
 * @returns {Promise<string | void>} Resolves to the created room id
 */
async function createRoomFromLocalRoom(client, localRoom) {
  if (!localRoom.isNew) {
    // This action only makes sense for new local rooms.
    return;
  }
  localRoom.state = _LocalRoom.LocalRoomState.CREATING;
  client.emit(_client.ClientEvent.Room, localRoom);
  return (0, _startDm.startDm)(client, localRoom.targets, false).then(roomId => {
    if (!roomId) throw new Error(`startDm for local room ${localRoom.roomId} didn't return a room Id`);
    localRoom.actualRoomId = roomId;
    return (0, _localRoom.waitForRoomReadyAndApplyAfterCreateCallbacks)(client, localRoom, roomId);
  }, () => {
    _logger.logger.warn(`Error creating DM for local room ${localRoom.roomId}`);
    localRoom.state = _LocalRoom.LocalRoomState.ERROR;
    client.emit(_client.ClientEvent.Room, localRoom);
  });
}

// This is the interface that is expected by various components in the Invite Dialog and RoomInvite.
// It is a bit awkward because it also matches the RoomMember class from the js-sdk with some extra support
// for 3PIDs/email addresses.
class Member {}
exports.Member = Member;
class DirectoryMember extends Member {
  // eslint-disable-next-line camelcase
  constructor(userDirResult) {
    super();
    (0, _defineProperty2.default)(this, "_userId", void 0);
    (0, _defineProperty2.default)(this, "displayName", void 0);
    (0, _defineProperty2.default)(this, "avatarUrl", void 0);
    this._userId = userDirResult.user_id;
    this.displayName = userDirResult.display_name;
    this.avatarUrl = userDirResult.avatar_url;
  }

  // These next class members are for the Member interface
  get name() {
    return this.displayName || this._userId;
  }
  get userId() {
    return this._userId;
  }
  getMxcAvatarUrl() {
    return this.avatarUrl;
  }
}
exports.DirectoryMember = DirectoryMember;
class ThreepidMember extends Member {
  constructor(id) {
    super();
    (0, _defineProperty2.default)(this, "id", void 0);
    this.id = id;
  }

  // This is a getter that would be falsy on all other implementations. Until we have
  // better type support in the react-sdk we can use this trick to determine the kind
  // of 3PID we're dealing with, if any.
  get isEmail() {
    return this.id.includes("@");
  }

  // These next class members are for the Member interface
  get name() {
    return this.id;
  }
  get userId() {
    return this.id;
  }
  getMxcAvatarUrl() {
    return undefined;
  }
}
exports.ThreepidMember = ThreepidMember;
/**
 * Detects whether a room should be encrypted.
 *
 * @async
 * @param {MatrixClient} client
 * @param {Member[]} targets The members to which run the check against
 * @returns {Promise<boolean>}
 */
async function determineCreateRoomEncryptionOption(client, targets) {
  if ((0, _rooms.privateShouldBeEncrypted)(client)) {
    // Enable encryption for a single 3rd party invite.
    if (targets.length === 1 && targets[0] instanceof ThreepidMember) return true;

    // Check whether all users have uploaded device keys before.
    // If so, enable encryption in the new room.
    const has3PidMembers = targets.some(t => t instanceof ThreepidMember);
    if (!has3PidMembers) {
      const targetIds = targets.map(t => t.userId);
      const allHaveDeviceKeys = await (0, _createRoom.canEncryptToAllUsers)(client, targetIds);
      if (allHaveDeviceKeys) {
        return true;
      }
    }
  }
  return false;
}
//# sourceMappingURL=direct-messages.js.map