"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.awaitRoomDownSync = awaitRoomDownSync;
exports.upgradeRoom = upgradeRoom;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _event = require("matrix-js-sdk/src/@types/event");
var _logger = require("matrix-js-sdk/src/logger");
var _client = require("matrix-js-sdk/src/client");
var _RoomInvite = require("../RoomInvite");
var _Modal = _interopRequireDefault(require("../Modal"));
var _languageHandler = require("../languageHandler");
var _ErrorDialog = _interopRequireDefault(require("../components/views/dialogs/ErrorDialog"));
var _SpaceStore = _interopRequireDefault(require("../stores/spaces/SpaceStore"));
var _Spinner = _interopRequireDefault(require("../components/views/elements/Spinner"));
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         Copyright 2021 The Matrix.org Foundation C.I.C.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         
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
async function awaitRoomDownSync(cli, roomId) {
  const room = cli.getRoom(roomId);
  if (room) return room; // already have the room

  return new Promise(resolve => {
    // We have to wait for the js-sdk to give us the room back so
    // we can more effectively abuse the MultiInviter behaviour
    // which heavily relies on the Room object being available.
    const checkForRoomFn = room => {
      if (room.roomId !== roomId) return;
      resolve(room);
      cli.off(_client.ClientEvent.Room, checkForRoomFn);
    };
    cli.on(_client.ClientEvent.Room, checkForRoomFn);
  });
}
async function upgradeRoom(room, targetVersion) {
  let inviteUsers = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  let handleError = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;
  let updateSpaces = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : true;
  let awaitRoom = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : false;
  let progressCallback = arguments.length > 6 ? arguments[6] : undefined;
  const cli = room.client;
  let spinnerModal;
  if (!progressCallback) {
    spinnerModal = _Modal.default.createDialog(_Spinner.default, undefined, "mx_Dialog_spinner");
  }
  let toInvite = [];
  if (inviteUsers) {
    toInvite = [...room.getMembersWithMembership("join"), ...room.getMembersWithMembership("invite")].map(m => m.userId).filter(m => m !== cli.getUserId());
  }
  let parentsToRelink = [];
  if (updateSpaces) {
    parentsToRelink = Array.from(_SpaceStore.default.instance.getKnownParents(room.roomId)).map(roomId => cli.getRoom(roomId)).filter(parent => parent?.currentState.maySendStateEvent(_event.EventType.SpaceChild, cli.getUserId()));
  }
  const progress = {
    roomUpgraded: false,
    roomSynced: awaitRoom || inviteUsers ? false : undefined,
    inviteUsersProgress: inviteUsers ? 0 : undefined,
    inviteUsersTotal: toInvite.length,
    updateSpacesProgress: updateSpaces ? 0 : undefined,
    updateSpacesTotal: parentsToRelink.length
  };
  progressCallback?.(progress);
  let newRoomId;
  try {
    ({
      replacement_room: newRoomId
    } = await cli.upgradeRoom(room.roomId, targetVersion));
  } catch (e) {
    if (!handleError) throw e;
    _logger.logger.error(e);
    _Modal.default.createDialog(_ErrorDialog.default, {
      title: (0, _languageHandler._t)("Error upgrading room"),
      description: (0, _languageHandler._t)("Double check that your server supports the room version chosen and try again.")
    });
    throw e;
  }
  progress.roomUpgraded = true;
  progressCallback?.(progress);
  if (awaitRoom || inviteUsers) {
    await awaitRoomDownSync(room.client, newRoomId);
    progress.roomSynced = true;
    progressCallback?.(progress);
  }
  if (toInvite.length > 0) {
    // Errors are handled internally to this function
    await (0, _RoomInvite.inviteUsersToRoom)(cli, newRoomId, toInvite, false, () => {
      progress.inviteUsersProgress++;
      progressCallback?.(progress);
    });
  }
  if (parentsToRelink.length > 0) {
    try {
      for (const parent of parentsToRelink) {
        const currentEv = parent.currentState.getStateEvents(_event.EventType.SpaceChild, room.roomId);
        await cli.sendStateEvent(parent.roomId, _event.EventType.SpaceChild, _objectSpread(_objectSpread({}, currentEv?.getContent() || {}), {}, {
          // copy existing attributes like suggested
          via: [cli.getDomain()]
        }), newRoomId);
        await cli.sendStateEvent(parent.roomId, _event.EventType.SpaceChild, {}, room.roomId);
        progress.updateSpacesProgress++;
        progressCallback?.(progress);
      }
    } catch (e) {
      // These errors are not critical to the room upgrade itself
      _logger.logger.warn("Failed to update parent spaces during room upgrade", e);
    }
  }
  spinnerModal?.close();
  return newRoomId;
}
//# sourceMappingURL=RoomUpgrade.js.map