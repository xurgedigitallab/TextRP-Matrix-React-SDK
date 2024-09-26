"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.startDm = startDm;
var _actions = require("../../dispatcher/actions");
var _directMessages = require("../direct-messages");
var _DMRoomMap = _interopRequireDefault(require("../DMRoomMap"));
var _isLocalRoom = require("../localRoom/isLocalRoom");
var _findDMForUser = require("./findDMForUser");
var _dispatcher = _interopRequireDefault(require("../../dispatcher/dispatcher"));
var _UserAddress = require("../../UserAddress");
var _createRoom = _interopRequireDefault(require("../../createRoom"));
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
 * Start a DM.
 *
 * @returns {Promise<string | null} Resolves to the room id.
 */
async function startDm(client, targets) {
  let showSpinner = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
  let createOpts = arguments.length > 3 ? arguments[3] : undefined;
  const targetIds = targets.map(t => t.userId);

  // Check if there is already a DM with these people and reuse it if possible.
  let existingRoom;
  if (targetIds.length === 1) {
    existingRoom = (0, _findDMForUser.findDMForUser)(client, targetIds[0]);
  } else {
    existingRoom = _DMRoomMap.default.shared().getDMRoomForIdentifiers(targetIds) ?? undefined;
  }
  if (existingRoom && !(0, _isLocalRoom.isLocalRoom)(existingRoom)) {
    _dispatcher.default.dispatch({
      action: _actions.Action.ViewRoom,
      room_id: existingRoom.roomId,
      should_peek: false,
      joining: false,
      metricsTrigger: "MessageUser"
    });
    return Promise.resolve(existingRoom.roomId);
  }
  const createRoomOptions = {
    inlineErrors: true
  }; // XXX: Type out `createRoomOptions`

  if (await (0, _directMessages.determineCreateRoomEncryptionOption)(client, targets)) {
    createRoomOptions.encryption = true;
  }

  // Check if it's a traditional DM and create the room if required.
  // TODO: [Canonical DMs] Remove this check and instead just create the multi-person DM
  const isSelf = targetIds.length === 1 && targetIds[0] === client.getUserId();
  if (targetIds.length === 1 && !isSelf) {
    createRoomOptions.dmUserId = targetIds[0];
  }
  if (targetIds.length > 1) {
    createRoomOptions.createOpts = targetIds.reduce((roomOptions, address) => {
      const type = (0, _UserAddress.getAddressType)(address);
      if (type === "email") {
        const invite = {
          id_server: client.getIdentityServerUrl(true),
          medium: "email",
          address
        };
        roomOptions.invite_3pid.push(invite);
      } else if (type === "mx-user-id") {
        roomOptions.invite.push(address);
      }
      return roomOptions;
    }, {
      invite: [],
      invite_3pid: []
    });
  }
  createRoomOptions.spinner = showSpinner;
  if (createOpts && Object.keys(createOpts).includes("andView")) {
    createRoomOptions.andView = createOpts.andView;
  }
  return (0, _createRoom.default)(client, createRoomOptions);
}
//# sourceMappingURL=startDm.js.map