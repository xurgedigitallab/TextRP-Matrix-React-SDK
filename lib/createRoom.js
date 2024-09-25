"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.canEncryptToAllUsers = canEncryptToAllUsers;
exports.default = createRoom;
exports.ensureDMExists = ensureDMExists;
exports.ensureVirtualRoomExists = ensureVirtualRoomExists;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _client = require("matrix-js-sdk/src/client");
var _event = require("matrix-js-sdk/src/@types/event");
var _partials = require("matrix-js-sdk/src/@types/partials");
var _logger = require("matrix-js-sdk/src/logger");
var _Modal = _interopRequireDefault(require("./Modal"));
var _languageHandler = require("./languageHandler");
var _dispatcher = _interopRequireDefault(require("./dispatcher/dispatcher"));
var Rooms = _interopRequireWildcard(require("./Rooms"));
var _UserAddress = require("./UserAddress");
var _callTypes = require("./call-types");
var _SpaceStore = _interopRequireDefault(require("./stores/spaces/SpaceStore"));
var _space = require("./utils/space");
var _Call = require("./models/Call");
var _actions = require("./dispatcher/actions");
var _ErrorDialog = _interopRequireDefault(require("./components/views/dialogs/ErrorDialog"));
var _Spinner = _interopRequireDefault(require("./components/views/elements/Spinner"));
var _findDMForUser = require("./utils/dm/findDMForUser");
var _rooms = require("./utils/rooms");
var _membership = require("./utils/membership");
var _PreferredRoomVersions = require("./utils/PreferredRoomVersions");
var _SettingsStore = _interopRequireDefault(require("./settings/SettingsStore"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         Copyright 2015, 2016 OpenMarket Ltd
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
// we define a number of interfaces which take their names from the js-sdk
/* eslint-disable camelcase */const DEFAULT_EVENT_POWER_LEVELS = {
  [_event.EventType.RoomName]: 50,
  [_event.EventType.RoomAvatar]: 50,
  [_event.EventType.RoomPowerLevels]: 100,
  [_event.EventType.RoomHistoryVisibility]: 100,
  [_event.EventType.RoomCanonicalAlias]: 50,
  [_event.EventType.RoomTombstone]: 100,
  [_event.EventType.RoomServerAcl]: 100,
  [_event.EventType.RoomEncryption]: 100
};

/**
 * Create a new room, and switch to it.
 *
 * @param client The Matrix Client instance to create the room with
 * @param {object=} opts parameters for creating the room
 * @param {string=} opts.dmUserId If specified, make this a DM room for this user and invite them
 * @param {object=} opts.createOpts set of options to pass to createRoom call.
 * @param {bool=} opts.spinner True to show a modal spinner while the room is created.
 *     Default: True
 * @param {bool=} opts.guestAccess Whether to enable guest access.
 *     Default: True
 * @param {bool=} opts.encryption Whether to enable encryption.
 *     Default: False
 * @param {bool=} opts.inlineErrors True to raise errors off the promise instead of resolving to null.
 *     Default: False
 * @param {bool=} opts.andView True to dispatch an action to view the room once it has been created.
 *
 * @returns {Promise} which resolves to the room id, or null if the
 * action was aborted or failed.
 */
async function createRoom(client, opts) {
  opts = opts || {};
  if (opts.spinner === undefined) opts.spinner = true;
  if (opts.guestAccess === undefined) opts.guestAccess = true;
  if (opts.encryption === undefined) opts.encryption = false;
  if (client.isGuest()) {
    _dispatcher.default.dispatch({
      action: "require_registration"
    });
    return null;
  }
  const defaultPreset = opts.dmUserId ? _partials.Preset.TrustedPrivateChat : _partials.Preset.PrivateChat;

  // set some defaults for the creation
  const createOpts = opts.createOpts || {};
  createOpts.preset = createOpts.preset || defaultPreset;
  createOpts.visibility = createOpts.visibility || _partials.Visibility.Private;
  if (opts.dmUserId && createOpts.invite === undefined) {
    switch ((0, _UserAddress.getAddressType)(opts.dmUserId)) {
      case "mx-user-id":
        createOpts.invite = [opts.dmUserId];
        break;
      case "email":
        {
          const isUrl = client.getIdentityServerUrl(true);
          if (!isUrl) {
            throw new _languageHandler.UserFriendlyError("Cannot invite user by email without an identity server. " + 'You can connect to one under "Settings".');
          }
          createOpts.invite_3pid = [{
            id_server: isUrl,
            medium: "email",
            address: opts.dmUserId
          }];
          break;
        }
    }
  }
  if (opts.dmUserId && createOpts.is_direct === undefined) {
    createOpts.is_direct = true;
  }
  if (opts.roomType) {
    createOpts.creation_content = _objectSpread(_objectSpread({}, createOpts.creation_content), {}, {
      [_event.RoomCreateTypeField]: opts.roomType
    });

    // Video rooms require custom power levels
    if (opts.roomType === _event.RoomType.ElementVideo) {
      createOpts.power_level_content_override = {
        events: _objectSpread(_objectSpread({}, DEFAULT_EVENT_POWER_LEVELS), {}, {
          // Allow all users to send call membership updates
          [_Call.JitsiCall.MEMBER_EVENT_TYPE]: 0,
          // Make widgets immutable, even to admins
          "im.vector.modular.widgets": 200
        }),
        users: {
          // Temporarily give ourselves the power to set up a widget
          [client.getSafeUserId()]: 200
        }
      };
    } else if (opts.roomType === _event.RoomType.UnstableCall) {
      createOpts.power_level_content_override = {
        events: _objectSpread(_objectSpread({}, DEFAULT_EVENT_POWER_LEVELS), {}, {
          // Allow all users to send call membership updates
          [_Call.ElementCall.MEMBER_EVENT_TYPE.name]: 0,
          // Make calls immutable, even to admins
          [_Call.ElementCall.CALL_EVENT_TYPE.name]: 200
        }),
        users: {
          // Temporarily give ourselves the power to set up a call
          [client.getSafeUserId()]: 200
        }
      };
    }
  } else if (_SettingsStore.default.getValue("feature_group_calls")) {
    createOpts.power_level_content_override = {
      events: _objectSpread(_objectSpread({}, DEFAULT_EVENT_POWER_LEVELS), {}, {
        // Element Call should be disabled by default
        [_Call.ElementCall.MEMBER_EVENT_TYPE.name]: 100,
        // Make sure only admins can enable it
        [_Call.ElementCall.CALL_EVENT_TYPE.name]: 100
      })
    };
  }

  // By default, view the room after creating it
  if (opts.andView === undefined) {
    opts.andView = true;
  }
  createOpts.initial_state = createOpts.initial_state || [];

  // Allow guests by default since the room is private and they'd
  // need an invite. This means clicking on a 3pid invite email can
  // actually drop you right in to a chat.
  if (opts.guestAccess) {
    createOpts.initial_state.push({
      type: "m.room.guest_access",
      state_key: "",
      content: {
        guest_access: "can_join"
      }
    });
  }
  if (opts.encryption) {
    createOpts.initial_state.push({
      type: "m.room.encryption",
      state_key: "",
      content: {
        algorithm: "m.megolm.v1.aes-sha2"
      }
    });
  }
  if (opts.parentSpace) {
    createOpts.initial_state.push((0, _space.makeSpaceParentEvent)(opts.parentSpace, true));
    if (!opts.historyVisibility) {
      opts.historyVisibility = createOpts.preset === _partials.Preset.PublicChat ? _partials.HistoryVisibility.WorldReadable : _partials.HistoryVisibility.Invited;
    }
    if (opts.joinRule === _partials.JoinRule.Restricted) {
      createOpts.room_version = _PreferredRoomVersions.PreferredRoomVersions.RestrictedRooms;
      createOpts.initial_state.push({
        type: _event.EventType.RoomJoinRules,
        content: {
          join_rule: _partials.JoinRule.Restricted,
          allow: [{
            type: _partials.RestrictedAllowType.RoomMembership,
            room_id: opts.parentSpace.roomId
          }]
        }
      });
    }
  }

  // we handle the restricted join rule in the parentSpace handling block above
  if (opts.joinRule && opts.joinRule !== _partials.JoinRule.Restricted) {
    createOpts.initial_state.push({
      type: _event.EventType.RoomJoinRules,
      content: {
        join_rule: opts.joinRule
      }
    });
  }
  if (opts.avatar) {
    let url = opts.avatar;
    if (opts.avatar instanceof File) {
      ({
        content_uri: url
      } = await client.uploadContent(opts.avatar));
    }
    createOpts.initial_state.push({
      type: _event.EventType.RoomAvatar,
      content: {
        url
      }
    });
  }
  if (opts.historyVisibility) {
    createOpts.initial_state.push({
      type: _event.EventType.RoomHistoryVisibility,
      content: {
        history_visibility: opts.historyVisibility
      }
    });
  }
  let modal;
  if (opts.spinner) modal = _Modal.default.createDialog(_Spinner.default, undefined, "mx_Dialog_spinner");
  let roomId;
  let room;
  return client.createRoom(createOpts).catch(function (err) {
    // NB This checks for the Synapse-specific error condition of a room creation
    // having been denied because the requesting user wanted to publish the room,
    // but the server denies them that permission (via room_list_publication_rules).
    // The check below responds by retrying without publishing the room.
    if (err.httpStatus === 403 && err.errcode === "M_UNKNOWN" && err.data.error === "Not allowed to publish room") {
      _logger.logger.warn("Failed to publish room, try again without publishing it");
      createOpts.visibility = _partials.Visibility.Private;
      return client.createRoom(createOpts);
    } else {
      return Promise.reject(err);
    }
  }).finally(function () {
    if (modal) modal.close();
  }).then(async res => {
    roomId = res.room_id;
    room = new Promise(resolve => {
      const storedRoom = client.getRoom(roomId);
      if (storedRoom) {
        resolve(storedRoom);
      } else {
        // The room hasn't arrived down sync yet
        const onRoom = emittedRoom => {
          if (emittedRoom.roomId === roomId) {
            resolve(emittedRoom);
            client.off(_client.ClientEvent.Room, onRoom);
          }
        };
        client.on(_client.ClientEvent.Room, onRoom);
      }
    });
    if (opts.dmUserId) await Rooms.setDMRoom(client, roomId, opts.dmUserId);
  }).then(() => {
    if (opts.parentSpace) {
      return _SpaceStore.default.instance.addRoomToSpace(opts.parentSpace, roomId, [client.getDomain()], opts.suggested);
    }
  }).then(async () => {
    if (opts.roomType === _event.RoomType.ElementVideo) {
      // Set up this video room with a Jitsi call
      await _Call.JitsiCall.create(await room);

      // Reset our power level back to admin so that the widget becomes immutable
      const plEvent = (await room).currentState.getStateEvents(_event.EventType.RoomPowerLevels, "");
      await client.setPowerLevel(roomId, client.getUserId(), 100, plEvent);
    } else if (opts.roomType === _event.RoomType.UnstableCall) {
      // Set up this video room with an Element call
      await _Call.ElementCall.create(await room);

      // Reset our power level back to admin so that the call becomes immutable
      const plEvent = (await room).currentState.getStateEvents(_event.EventType.RoomPowerLevels, "");
      await client.setPowerLevel(roomId, client.getUserId(), 100, plEvent);
    }
  }).then(function () {
    // NB we haven't necessarily blocked on the room promise, so we race
    // here with the client knowing that the room exists, causing things
    // like https://github.com/vector-im/vector-web/issues/1813
    // Even if we were to block on the echo, servers tend to split the room
    // state over multiple syncs so we can't atomically know when we have the
    // entire thing.
    if (opts.andView) {
      _dispatcher.default.dispatch({
        action: _actions.Action.ViewRoom,
        room_id: roomId,
        should_peek: false,
        // Creating a room will have joined us to the room,
        // so we are expecting the room to come down the sync
        // stream, if it hasn't already.
        joining: true,
        justCreatedOpts: opts,
        metricsTrigger: "Created"
      });
    }
    return roomId;
  }, function (err) {
    // Raise the error if the caller requested that we do so.
    if (opts.inlineErrors) throw err;

    // We also failed to join the room (this sets joining to false in RoomViewStore)
    _dispatcher.default.dispatch({
      action: _actions.Action.JoinRoomError,
      roomId
    });
    _logger.logger.error("Failed to create room " + roomId + " " + err);
    let description = (0, _languageHandler._t)("Server may be unavailable, overloaded, or you hit a bug.");
    if (err.errcode === "M_UNSUPPORTED_ROOM_VERSION") {
      // Technically not possible with the UI as of April 2019 because there's no
      // options for the user to change this. However, it's not a bad thing to report
      // the error to the user for if/when the UI is available.
      description = (0, _languageHandler._t)("The server does not support the room version specified.");
    }
    _Modal.default.createDialog(_ErrorDialog.default, {
      title: (0, _languageHandler._t)("Failure to create room"),
      description
    });
    return null;
  });
}

/*
 * Ensure that for every user in a room, there is at least one device that we
 * can encrypt to.
 */
async function canEncryptToAllUsers(client, userIds) {
  try {
    const usersDeviceMap = await client.getCrypto()?.getUserDeviceInfo(userIds, true);
    if (!usersDeviceMap) {
      return false;
    }
    for (const devices of usersDeviceMap.values()) {
      if (devices.size === 0) {
        // This user does not have any encryption-capable devices.
        return false;
      }
    }
  } catch (e) {
    _logger.logger.error("Error determining if it's possible to encrypt to all users: ", e);
    return false; // assume not
  }

  return true;
}

// Similar to ensureDMExists but also adds creation content
// without polluting ensureDMExists with unrelated stuff (also
// they're never encrypted).
async function ensureVirtualRoomExists(client, userId, nativeRoomId) {
  const existingDMRoom = (0, _findDMForUser.findDMForUser)(client, userId);
  let roomId;
  if (existingDMRoom) {
    roomId = existingDMRoom.roomId;
  } else {
    roomId = await createRoom(client, {
      dmUserId: userId,
      spinner: false,
      andView: false,
      createOpts: {
        creation_content: {
          // This allows us to recognise that the room is a virtual room
          // when it comes down our sync stream (we also put the ID of the
          // respective native room in there because why not?)
          [_callTypes.VIRTUAL_ROOM_EVENT_TYPE]: nativeRoomId
        }
      }
    });
  }
  return roomId;
}
async function ensureDMExists(client, userId) {
  const existingDMRoom = (0, _findDMForUser.findDMForUser)(client, userId);
  let roomId;
  if (existingDMRoom) {
    roomId = existingDMRoom.roomId;
  } else {
    let encryption;
    if ((0, _rooms.privateShouldBeEncrypted)(client)) {
      encryption = await canEncryptToAllUsers(client, [userId]);
    }
    roomId = await createRoom(client, {
      encryption,
      dmUserId: userId,
      spinner: false,
      andView: false
    });
    if (!roomId) return null;
    await (0, _membership.waitForMember)(client, roomId, userId);
  }
  return roomId;
}
//# sourceMappingURL=createRoom.js.map