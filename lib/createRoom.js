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

    //Inject TokenGate widget after room is created            
    // const userId = client.getUserId();
    // const displayName = 'NFT Gate';
    // const avatarUrl = '';
    // const clientId = client.getDeviceId(); 
    // const language = 'en'; 
    // const baseUrl = client.baseUrl || 'https://matrix.org'; 
    const widgetUrl = 'https://tokengate-dev.textrp.io/#/?theme=$org.matrix.msc2873.client_theme&matrix_user_id=$matrix_user_id&matrix_display_name=$matrix_display_name&matrix_avatar_url=$matrix_avatar_url&matrix_room_id=$matrix_room>';
    //const widgetUrl = `https://3.65.216.69:3000/#/?theme=$org.matrix.msc2873.client_theme&matrix_user_id=$matrix_user_id&matrix_display_name=$matrix_display_name&matrix_avatar_url=$matrix_avatar_url&matrix_room_id=$matrix_room_id&matrix_client_id=$org.matrix.msc2873.client_id&matrix_client_language=$org.matrix.msc2873.client_language&matrix_device_id=$org.matrix.msc3819.matrix_device_id&matrix_base_url=$org.matrix.msc4039.matrix_base_url`

    await client.sendStateEvent(roomId, "im.vector.modular.widgets", {
      id: "tokengate-widget",
      type: "m.custom",
      url: widgetUrl,
      name: "NFT Gate",
      data: {},
      creatorUserId: client.getUserId()
    }, "tokengate-widget");
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfY2xpZW50IiwicmVxdWlyZSIsIl9ldmVudCIsIl9wYXJ0aWFscyIsIl9sb2dnZXIiLCJfTW9kYWwiLCJfaW50ZXJvcFJlcXVpcmVEZWZhdWx0IiwiX2xhbmd1YWdlSGFuZGxlciIsIl9kaXNwYXRjaGVyIiwiUm9vbXMiLCJfaW50ZXJvcFJlcXVpcmVXaWxkY2FyZCIsIl9Vc2VyQWRkcmVzcyIsIl9jYWxsVHlwZXMiLCJfU3BhY2VTdG9yZSIsIl9zcGFjZSIsIl9DYWxsIiwiX2FjdGlvbnMiLCJfRXJyb3JEaWFsb2ciLCJfU3Bpbm5lciIsIl9maW5kRE1Gb3JVc2VyIiwiX3Jvb21zIiwiX21lbWJlcnNoaXAiLCJfUHJlZmVycmVkUm9vbVZlcnNpb25zIiwiX1NldHRpbmdzU3RvcmUiLCJfZ2V0UmVxdWlyZVdpbGRjYXJkQ2FjaGUiLCJub2RlSW50ZXJvcCIsIldlYWtNYXAiLCJjYWNoZUJhYmVsSW50ZXJvcCIsImNhY2hlTm9kZUludGVyb3AiLCJvYmoiLCJfX2VzTW9kdWxlIiwiZGVmYXVsdCIsImNhY2hlIiwiaGFzIiwiZ2V0IiwibmV3T2JqIiwiaGFzUHJvcGVydHlEZXNjcmlwdG9yIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IiLCJrZXkiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImNhbGwiLCJkZXNjIiwic2V0Iiwib3duS2V5cyIsIm9iamVjdCIsImVudW1lcmFibGVPbmx5Iiwia2V5cyIsImdldE93blByb3BlcnR5U3ltYm9scyIsInN5bWJvbHMiLCJmaWx0ZXIiLCJzeW0iLCJlbnVtZXJhYmxlIiwicHVzaCIsImFwcGx5IiwiX29iamVjdFNwcmVhZCIsInRhcmdldCIsImkiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJzb3VyY2UiLCJmb3JFYWNoIiwiX2RlZmluZVByb3BlcnR5MiIsImdldE93blByb3BlcnR5RGVzY3JpcHRvcnMiLCJkZWZpbmVQcm9wZXJ0aWVzIiwiREVGQVVMVF9FVkVOVF9QT1dFUl9MRVZFTFMiLCJFdmVudFR5cGUiLCJSb29tTmFtZSIsIlJvb21BdmF0YXIiLCJSb29tUG93ZXJMZXZlbHMiLCJSb29tSGlzdG9yeVZpc2liaWxpdHkiLCJSb29tQ2Fub25pY2FsQWxpYXMiLCJSb29tVG9tYnN0b25lIiwiUm9vbVNlcnZlckFjbCIsIlJvb21FbmNyeXB0aW9uIiwiY3JlYXRlUm9vbSIsImNsaWVudCIsIm9wdHMiLCJzcGlubmVyIiwidW5kZWZpbmVkIiwiZ3Vlc3RBY2Nlc3MiLCJlbmNyeXB0aW9uIiwiaXNHdWVzdCIsImRpcyIsImRpc3BhdGNoIiwiYWN0aW9uIiwiZGVmYXVsdFByZXNldCIsImRtVXNlcklkIiwiUHJlc2V0IiwiVHJ1c3RlZFByaXZhdGVDaGF0IiwiUHJpdmF0ZUNoYXQiLCJjcmVhdGVPcHRzIiwicHJlc2V0IiwidmlzaWJpbGl0eSIsIlZpc2liaWxpdHkiLCJQcml2YXRlIiwiaW52aXRlIiwiZ2V0QWRkcmVzc1R5cGUiLCJpc1VybCIsImdldElkZW50aXR5U2VydmVyVXJsIiwiVXNlckZyaWVuZGx5RXJyb3IiLCJpbnZpdGVfM3BpZCIsImlkX3NlcnZlciIsIm1lZGl1bSIsImFkZHJlc3MiLCJpc19kaXJlY3QiLCJyb29tVHlwZSIsImNyZWF0aW9uX2NvbnRlbnQiLCJSb29tQ3JlYXRlVHlwZUZpZWxkIiwiUm9vbVR5cGUiLCJFbGVtZW50VmlkZW8iLCJwb3dlcl9sZXZlbF9jb250ZW50X292ZXJyaWRlIiwiZXZlbnRzIiwiSml0c2lDYWxsIiwiTUVNQkVSX0VWRU5UX1RZUEUiLCJ1c2VycyIsImdldFNhZmVVc2VySWQiLCJVbnN0YWJsZUNhbGwiLCJFbGVtZW50Q2FsbCIsIm5hbWUiLCJDQUxMX0VWRU5UX1RZUEUiLCJTZXR0aW5nc1N0b3JlIiwiZ2V0VmFsdWUiLCJhbmRWaWV3IiwiaW5pdGlhbF9zdGF0ZSIsInR5cGUiLCJzdGF0ZV9rZXkiLCJjb250ZW50IiwiZ3Vlc3RfYWNjZXNzIiwiYWxnb3JpdGhtIiwicGFyZW50U3BhY2UiLCJtYWtlU3BhY2VQYXJlbnRFdmVudCIsImhpc3RvcnlWaXNpYmlsaXR5IiwiUHVibGljQ2hhdCIsIkhpc3RvcnlWaXNpYmlsaXR5IiwiV29ybGRSZWFkYWJsZSIsIkludml0ZWQiLCJqb2luUnVsZSIsIkpvaW5SdWxlIiwiUmVzdHJpY3RlZCIsInJvb21fdmVyc2lvbiIsIlByZWZlcnJlZFJvb21WZXJzaW9ucyIsIlJlc3RyaWN0ZWRSb29tcyIsIlJvb21Kb2luUnVsZXMiLCJqb2luX3J1bGUiLCJhbGxvdyIsIlJlc3RyaWN0ZWRBbGxvd1R5cGUiLCJSb29tTWVtYmVyc2hpcCIsInJvb21faWQiLCJyb29tSWQiLCJhdmF0YXIiLCJ1cmwiLCJGaWxlIiwiY29udGVudF91cmkiLCJ1cGxvYWRDb250ZW50IiwiaGlzdG9yeV92aXNpYmlsaXR5IiwibW9kYWwiLCJNb2RhbCIsImNyZWF0ZURpYWxvZyIsIlNwaW5uZXIiLCJyb29tIiwiY2F0Y2giLCJlcnIiLCJodHRwU3RhdHVzIiwiZXJyY29kZSIsImRhdGEiLCJlcnJvciIsImxvZ2dlciIsIndhcm4iLCJQcm9taXNlIiwicmVqZWN0IiwiZmluYWxseSIsImNsb3NlIiwidGhlbiIsInJlcyIsInJlc29sdmUiLCJzdG9yZWRSb29tIiwiZ2V0Um9vbSIsIm9uUm9vbSIsImVtaXR0ZWRSb29tIiwib2ZmIiwiQ2xpZW50RXZlbnQiLCJSb29tIiwib24iLCJzZXRETVJvb20iLCJTcGFjZVN0b3JlIiwiaW5zdGFuY2UiLCJhZGRSb29tVG9TcGFjZSIsImdldERvbWFpbiIsInN1Z2dlc3RlZCIsImNyZWF0ZSIsInBsRXZlbnQiLCJjdXJyZW50U3RhdGUiLCJnZXRTdGF0ZUV2ZW50cyIsInNldFBvd2VyTGV2ZWwiLCJnZXRVc2VySWQiLCJ3aWRnZXRVcmwiLCJzZW5kU3RhdGVFdmVudCIsImlkIiwiY3JlYXRvclVzZXJJZCIsIkFjdGlvbiIsIlZpZXdSb29tIiwic2hvdWxkX3BlZWsiLCJqb2luaW5nIiwianVzdENyZWF0ZWRPcHRzIiwibWV0cmljc1RyaWdnZXIiLCJpbmxpbmVFcnJvcnMiLCJKb2luUm9vbUVycm9yIiwiZGVzY3JpcHRpb24iLCJfdCIsIkVycm9yRGlhbG9nIiwidGl0bGUiLCJjYW5FbmNyeXB0VG9BbGxVc2VycyIsInVzZXJJZHMiLCJ1c2Vyc0RldmljZU1hcCIsImdldENyeXB0byIsImdldFVzZXJEZXZpY2VJbmZvIiwiZGV2aWNlcyIsInZhbHVlcyIsInNpemUiLCJlIiwiZW5zdXJlVmlydHVhbFJvb21FeGlzdHMiLCJ1c2VySWQiLCJuYXRpdmVSb29tSWQiLCJleGlzdGluZ0RNUm9vbSIsImZpbmRETUZvclVzZXIiLCJWSVJUVUFMX1JPT01fRVZFTlRfVFlQRSIsImVuc3VyZURNRXhpc3RzIiwicHJpdmF0ZVNob3VsZEJlRW5jcnlwdGVkIiwid2FpdEZvck1lbWJlciJdLCJzb3VyY2VzIjpbIi4uL3NyYy9jcmVhdGVSb29tLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qXG5Db3B5cmlnaHQgMjAxNSwgMjAxNiBPcGVuTWFya2V0IEx0ZFxuQ29weXJpZ2h0IDIwMTksIDIwMjAgVGhlIE1hdHJpeC5vcmcgRm91bmRhdGlvbiBDLkkuQy5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4qL1xuXG5pbXBvcnQgeyBNYXRyaXhDbGllbnQsIENsaWVudEV2ZW50IH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL2NsaWVudFwiO1xuaW1wb3J0IHsgUm9vbSB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9tb2RlbHMvcm9vbVwiO1xuaW1wb3J0IHsgRXZlbnRUeXBlLCBSb29tQ3JlYXRlVHlwZUZpZWxkLCBSb29tVHlwZSB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9AdHlwZXMvZXZlbnRcIjtcbmltcG9ydCB7IElDcmVhdGVSb29tT3B0cyB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9AdHlwZXMvcmVxdWVzdHNcIjtcbmltcG9ydCB7XG4gICAgSGlzdG9yeVZpc2liaWxpdHksXG4gICAgSm9pblJ1bGUsXG4gICAgUHJlc2V0LFxuICAgIFJlc3RyaWN0ZWRBbGxvd1R5cGUsXG4gICAgVmlzaWJpbGl0eSxcbn0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL0B0eXBlcy9wYXJ0aWFsc1wiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL2xvZ2dlclwiO1xuXG5pbXBvcnQgTW9kYWwsIHsgSUhhbmRsZSB9IGZyb20gXCIuL01vZGFsXCI7XG5pbXBvcnQgeyBfdCwgVXNlckZyaWVuZGx5RXJyb3IgfSBmcm9tIFwiLi9sYW5ndWFnZUhhbmRsZXJcIjtcbmltcG9ydCBkaXMgZnJvbSBcIi4vZGlzcGF0Y2hlci9kaXNwYXRjaGVyXCI7XG5pbXBvcnQgKiBhcyBSb29tcyBmcm9tIFwiLi9Sb29tc1wiO1xuaW1wb3J0IHsgZ2V0QWRkcmVzc1R5cGUgfSBmcm9tIFwiLi9Vc2VyQWRkcmVzc1wiO1xuaW1wb3J0IHsgVklSVFVBTF9ST09NX0VWRU5UX1RZUEUgfSBmcm9tIFwiLi9jYWxsLXR5cGVzXCI7XG5pbXBvcnQgU3BhY2VTdG9yZSBmcm9tIFwiLi9zdG9yZXMvc3BhY2VzL1NwYWNlU3RvcmVcIjtcbmltcG9ydCB7IG1ha2VTcGFjZVBhcmVudEV2ZW50IH0gZnJvbSBcIi4vdXRpbHMvc3BhY2VcIjtcbmltcG9ydCB7IEppdHNpQ2FsbCwgRWxlbWVudENhbGwgfSBmcm9tIFwiLi9tb2RlbHMvQ2FsbFwiO1xuaW1wb3J0IHsgQWN0aW9uIH0gZnJvbSBcIi4vZGlzcGF0Y2hlci9hY3Rpb25zXCI7XG5pbXBvcnQgRXJyb3JEaWFsb2cgZnJvbSBcIi4vY29tcG9uZW50cy92aWV3cy9kaWFsb2dzL0Vycm9yRGlhbG9nXCI7XG5pbXBvcnQgU3Bpbm5lciBmcm9tIFwiLi9jb21wb25lbnRzL3ZpZXdzL2VsZW1lbnRzL1NwaW5uZXJcIjtcbmltcG9ydCB7IFZpZXdSb29tUGF5bG9hZCB9IGZyb20gXCIuL2Rpc3BhdGNoZXIvcGF5bG9hZHMvVmlld1Jvb21QYXlsb2FkXCI7XG5pbXBvcnQgeyBmaW5kRE1Gb3JVc2VyIH0gZnJvbSBcIi4vdXRpbHMvZG0vZmluZERNRm9yVXNlclwiO1xuaW1wb3J0IHsgcHJpdmF0ZVNob3VsZEJlRW5jcnlwdGVkIH0gZnJvbSBcIi4vdXRpbHMvcm9vbXNcIjtcbmltcG9ydCB7IHdhaXRGb3JNZW1iZXIgfSBmcm9tIFwiLi91dGlscy9tZW1iZXJzaGlwXCI7XG5pbXBvcnQgeyBQcmVmZXJyZWRSb29tVmVyc2lvbnMgfSBmcm9tIFwiLi91dGlscy9QcmVmZXJyZWRSb29tVmVyc2lvbnNcIjtcbmltcG9ydCBTZXR0aW5nc1N0b3JlIGZyb20gXCIuL3NldHRpbmdzL1NldHRpbmdzU3RvcmVcIjtcblxuLy8gd2UgZGVmaW5lIGEgbnVtYmVyIG9mIGludGVyZmFjZXMgd2hpY2ggdGFrZSB0aGVpciBuYW1lcyBmcm9tIHRoZSBqcy1zZGtcbi8qIGVzbGludC1kaXNhYmxlIGNhbWVsY2FzZSAqL1xuXG5leHBvcnQgaW50ZXJmYWNlIElPcHRzIHtcbiAgICBkbVVzZXJJZD86IHN0cmluZztcbiAgICBjcmVhdGVPcHRzPzogSUNyZWF0ZVJvb21PcHRzO1xuICAgIHNwaW5uZXI/OiBib29sZWFuO1xuICAgIGd1ZXN0QWNjZXNzPzogYm9vbGVhbjtcbiAgICBlbmNyeXB0aW9uPzogYm9vbGVhbjtcbiAgICBpbmxpbmVFcnJvcnM/OiBib29sZWFuO1xuICAgIGFuZFZpZXc/OiBib29sZWFuO1xuICAgIGF2YXRhcj86IEZpbGUgfCBzdHJpbmc7IC8vIHdpbGwgdXBsb2FkIGlmIGdpdmVuIGZpbGUsIGVsc2UgbXhjVXJsIGlzIG5lZWRlZFxuICAgIHJvb21UeXBlPzogUm9vbVR5cGUgfCBzdHJpbmc7XG4gICAgaGlzdG9yeVZpc2liaWxpdHk/OiBIaXN0b3J5VmlzaWJpbGl0eTtcbiAgICBwYXJlbnRTcGFjZT86IFJvb207XG4gICAgLy8gY29udGV4dHVhbGx5IG9ubHkgbWFrZXMgc2Vuc2UgaWYgcGFyZW50U3BhY2UgaXMgc3BlY2lmaWVkLCBpZiB0cnVlIHRoZW4gd2lsbCBiZSBhZGRlZCB0byBwYXJlbnRTcGFjZSBhcyBzdWdnZXN0ZWRcbiAgICBzdWdnZXN0ZWQ/OiBib29sZWFuO1xuICAgIGpvaW5SdWxlPzogSm9pblJ1bGU7XG59XG5cbmNvbnN0IERFRkFVTFRfRVZFTlRfUE9XRVJfTEVWRUxTID0ge1xuICAgIFtFdmVudFR5cGUuUm9vbU5hbWVdOiA1MCxcbiAgICBbRXZlbnRUeXBlLlJvb21BdmF0YXJdOiA1MCxcbiAgICBbRXZlbnRUeXBlLlJvb21Qb3dlckxldmVsc106IDEwMCxcbiAgICBbRXZlbnRUeXBlLlJvb21IaXN0b3J5VmlzaWJpbGl0eV06IDEwMCxcbiAgICBbRXZlbnRUeXBlLlJvb21DYW5vbmljYWxBbGlhc106IDUwLFxuICAgIFtFdmVudFR5cGUuUm9vbVRvbWJzdG9uZV06IDEwMCxcbiAgICBbRXZlbnRUeXBlLlJvb21TZXJ2ZXJBY2xdOiAxMDAsXG4gICAgW0V2ZW50VHlwZS5Sb29tRW5jcnlwdGlvbl06IDEwMCxcbn07XG5cbi8qKlxuICogQ3JlYXRlIGEgbmV3IHJvb20sIGFuZCBzd2l0Y2ggdG8gaXQuXG4gKlxuICogQHBhcmFtIGNsaWVudCBUaGUgTWF0cml4IENsaWVudCBpbnN0YW5jZSB0byBjcmVhdGUgdGhlIHJvb20gd2l0aFxuICogQHBhcmFtIHtvYmplY3Q9fSBvcHRzIHBhcmFtZXRlcnMgZm9yIGNyZWF0aW5nIHRoZSByb29tXG4gKiBAcGFyYW0ge3N0cmluZz19IG9wdHMuZG1Vc2VySWQgSWYgc3BlY2lmaWVkLCBtYWtlIHRoaXMgYSBETSByb29tIGZvciB0aGlzIHVzZXIgYW5kIGludml0ZSB0aGVtXG4gKiBAcGFyYW0ge29iamVjdD19IG9wdHMuY3JlYXRlT3B0cyBzZXQgb2Ygb3B0aW9ucyB0byBwYXNzIHRvIGNyZWF0ZVJvb20gY2FsbC5cbiAqIEBwYXJhbSB7Ym9vbD19IG9wdHMuc3Bpbm5lciBUcnVlIHRvIHNob3cgYSBtb2RhbCBzcGlubmVyIHdoaWxlIHRoZSByb29tIGlzIGNyZWF0ZWQuXG4gKiAgICAgRGVmYXVsdDogVHJ1ZVxuICogQHBhcmFtIHtib29sPX0gb3B0cy5ndWVzdEFjY2VzcyBXaGV0aGVyIHRvIGVuYWJsZSBndWVzdCBhY2Nlc3MuXG4gKiAgICAgRGVmYXVsdDogVHJ1ZVxuICogQHBhcmFtIHtib29sPX0gb3B0cy5lbmNyeXB0aW9uIFdoZXRoZXIgdG8gZW5hYmxlIGVuY3J5cHRpb24uXG4gKiAgICAgRGVmYXVsdDogRmFsc2VcbiAqIEBwYXJhbSB7Ym9vbD19IG9wdHMuaW5saW5lRXJyb3JzIFRydWUgdG8gcmFpc2UgZXJyb3JzIG9mZiB0aGUgcHJvbWlzZSBpbnN0ZWFkIG9mIHJlc29sdmluZyB0byBudWxsLlxuICogICAgIERlZmF1bHQ6IEZhbHNlXG4gKiBAcGFyYW0ge2Jvb2w9fSBvcHRzLmFuZFZpZXcgVHJ1ZSB0byBkaXNwYXRjaCBhbiBhY3Rpb24gdG8gdmlldyB0aGUgcm9vbSBvbmNlIGl0IGhhcyBiZWVuIGNyZWF0ZWQuXG4gKlxuICogQHJldHVybnMge1Byb21pc2V9IHdoaWNoIHJlc29sdmVzIHRvIHRoZSByb29tIGlkLCBvciBudWxsIGlmIHRoZVxuICogYWN0aW9uIHdhcyBhYm9ydGVkIG9yIGZhaWxlZC5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlUm9vbShjbGllbnQ6IE1hdHJpeENsaWVudCwgb3B0czogSU9wdHMpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICBpZiAob3B0cy5zcGlubmVyID09PSB1bmRlZmluZWQpIG9wdHMuc3Bpbm5lciA9IHRydWU7XG4gICAgaWYgKG9wdHMuZ3Vlc3RBY2Nlc3MgPT09IHVuZGVmaW5lZCkgb3B0cy5ndWVzdEFjY2VzcyA9IHRydWU7XG4gICAgaWYgKG9wdHMuZW5jcnlwdGlvbiA9PT0gdW5kZWZpbmVkKSBvcHRzLmVuY3J5cHRpb24gPSBmYWxzZTtcblxuICAgIGlmIChjbGllbnQuaXNHdWVzdCgpKSB7XG4gICAgICAgIGRpcy5kaXNwYXRjaCh7IGFjdGlvbjogXCJyZXF1aXJlX3JlZ2lzdHJhdGlvblwiIH0pO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBkZWZhdWx0UHJlc2V0ID0gb3B0cy5kbVVzZXJJZCA/IFByZXNldC5UcnVzdGVkUHJpdmF0ZUNoYXQgOiBQcmVzZXQuUHJpdmF0ZUNoYXQ7XG5cbiAgICAvLyBzZXQgc29tZSBkZWZhdWx0cyBmb3IgdGhlIGNyZWF0aW9uXG4gICAgY29uc3QgY3JlYXRlT3B0czogSUNyZWF0ZVJvb21PcHRzID0gb3B0cy5jcmVhdGVPcHRzIHx8IHt9O1xuICAgIGNyZWF0ZU9wdHMucHJlc2V0ID0gY3JlYXRlT3B0cy5wcmVzZXQgfHwgZGVmYXVsdFByZXNldDtcbiAgICBjcmVhdGVPcHRzLnZpc2liaWxpdHkgPSBjcmVhdGVPcHRzLnZpc2liaWxpdHkgfHwgVmlzaWJpbGl0eS5Qcml2YXRlO1xuICAgIGlmIChvcHRzLmRtVXNlcklkICYmIGNyZWF0ZU9wdHMuaW52aXRlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgc3dpdGNoIChnZXRBZGRyZXNzVHlwZShvcHRzLmRtVXNlcklkKSkge1xuICAgICAgICAgICAgY2FzZSBcIm14LXVzZXItaWRcIjpcbiAgICAgICAgICAgICAgICBjcmVhdGVPcHRzLmludml0ZSA9IFtvcHRzLmRtVXNlcklkXTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJlbWFpbFwiOiB7XG4gICAgICAgICAgICAgICAgY29uc3QgaXNVcmwgPSBjbGllbnQuZ2V0SWRlbnRpdHlTZXJ2ZXJVcmwodHJ1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKCFpc1VybCkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVXNlckZyaWVuZGx5RXJyb3IoXG4gICAgICAgICAgICAgICAgICAgICAgICBcIkNhbm5vdCBpbnZpdGUgdXNlciBieSBlbWFpbCB3aXRob3V0IGFuIGlkZW50aXR5IHNlcnZlci4gXCIgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdZb3UgY2FuIGNvbm5lY3QgdG8gb25lIHVuZGVyIFwiU2V0dGluZ3NcIi4nLFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjcmVhdGVPcHRzLmludml0ZV8zcGlkID0gW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZF9zZXJ2ZXI6IGlzVXJsLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVkaXVtOiBcImVtYWlsXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBhZGRyZXNzOiBvcHRzLmRtVXNlcklkLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIF07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKG9wdHMuZG1Vc2VySWQgJiYgY3JlYXRlT3B0cy5pc19kaXJlY3QgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjcmVhdGVPcHRzLmlzX2RpcmVjdCA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKG9wdHMucm9vbVR5cGUpIHtcbiAgICAgICAgY3JlYXRlT3B0cy5jcmVhdGlvbl9jb250ZW50ID0ge1xuICAgICAgICAgICAgLi4uY3JlYXRlT3B0cy5jcmVhdGlvbl9jb250ZW50LFxuICAgICAgICAgICAgW1Jvb21DcmVhdGVUeXBlRmllbGRdOiBvcHRzLnJvb21UeXBlLFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFZpZGVvIHJvb21zIHJlcXVpcmUgY3VzdG9tIHBvd2VyIGxldmVsc1xuICAgICAgICBpZiAob3B0cy5yb29tVHlwZSA9PT0gUm9vbVR5cGUuRWxlbWVudFZpZGVvKSB7XG4gICAgICAgICAgICBjcmVhdGVPcHRzLnBvd2VyX2xldmVsX2NvbnRlbnRfb3ZlcnJpZGUgPSB7XG4gICAgICAgICAgICAgICAgZXZlbnRzOiB7XG4gICAgICAgICAgICAgICAgICAgIC4uLkRFRkFVTFRfRVZFTlRfUE9XRVJfTEVWRUxTLFxuICAgICAgICAgICAgICAgICAgICAvLyBBbGxvdyBhbGwgdXNlcnMgdG8gc2VuZCBjYWxsIG1lbWJlcnNoaXAgdXBkYXRlc1xuICAgICAgICAgICAgICAgICAgICBbSml0c2lDYWxsLk1FTUJFUl9FVkVOVF9UWVBFXTogMCxcbiAgICAgICAgICAgICAgICAgICAgLy8gTWFrZSB3aWRnZXRzIGltbXV0YWJsZSwgZXZlbiB0byBhZG1pbnNcbiAgICAgICAgICAgICAgICAgICAgXCJpbS52ZWN0b3IubW9kdWxhci53aWRnZXRzXCI6IDIwMCxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHVzZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFRlbXBvcmFyaWx5IGdpdmUgb3Vyc2VsdmVzIHRoZSBwb3dlciB0byBzZXQgdXAgYSB3aWRnZXRcbiAgICAgICAgICAgICAgICAgICAgW2NsaWVudC5nZXRTYWZlVXNlcklkKCldOiAyMDAsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gZWxzZSBpZiAob3B0cy5yb29tVHlwZSA9PT0gUm9vbVR5cGUuVW5zdGFibGVDYWxsKSB7XG4gICAgICAgICAgICBjcmVhdGVPcHRzLnBvd2VyX2xldmVsX2NvbnRlbnRfb3ZlcnJpZGUgPSB7XG4gICAgICAgICAgICAgICAgZXZlbnRzOiB7XG4gICAgICAgICAgICAgICAgICAgIC4uLkRFRkFVTFRfRVZFTlRfUE9XRVJfTEVWRUxTLFxuICAgICAgICAgICAgICAgICAgICAvLyBBbGxvdyBhbGwgdXNlcnMgdG8gc2VuZCBjYWxsIG1lbWJlcnNoaXAgdXBkYXRlc1xuICAgICAgICAgICAgICAgICAgICBbRWxlbWVudENhbGwuTUVNQkVSX0VWRU5UX1RZUEUubmFtZV06IDAsXG4gICAgICAgICAgICAgICAgICAgIC8vIE1ha2UgY2FsbHMgaW1tdXRhYmxlLCBldmVuIHRvIGFkbWluc1xuICAgICAgICAgICAgICAgICAgICBbRWxlbWVudENhbGwuQ0FMTF9FVkVOVF9UWVBFLm5hbWVdOiAyMDAsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB1c2Vyczoge1xuICAgICAgICAgICAgICAgICAgICAvLyBUZW1wb3JhcmlseSBnaXZlIG91cnNlbHZlcyB0aGUgcG93ZXIgdG8gc2V0IHVwIGEgY2FsbFxuICAgICAgICAgICAgICAgICAgICBbY2xpZW50LmdldFNhZmVVc2VySWQoKV06IDIwMCxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoU2V0dGluZ3NTdG9yZS5nZXRWYWx1ZShcImZlYXR1cmVfZ3JvdXBfY2FsbHNcIikpIHtcbiAgICAgICAgY3JlYXRlT3B0cy5wb3dlcl9sZXZlbF9jb250ZW50X292ZXJyaWRlID0ge1xuICAgICAgICAgICAgZXZlbnRzOiB7XG4gICAgICAgICAgICAgICAgLi4uREVGQVVMVF9FVkVOVF9QT1dFUl9MRVZFTFMsXG4gICAgICAgICAgICAgICAgLy8gRWxlbWVudCBDYWxsIHNob3VsZCBiZSBkaXNhYmxlZCBieSBkZWZhdWx0XG4gICAgICAgICAgICAgICAgW0VsZW1lbnRDYWxsLk1FTUJFUl9FVkVOVF9UWVBFLm5hbWVdOiAxMDAsXG4gICAgICAgICAgICAgICAgLy8gTWFrZSBzdXJlIG9ubHkgYWRtaW5zIGNhbiBlbmFibGUgaXRcbiAgICAgICAgICAgICAgICBbRWxlbWVudENhbGwuQ0FMTF9FVkVOVF9UWVBFLm5hbWVdOiAxMDAsXG4gICAgICAgICAgICB9LFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vIEJ5IGRlZmF1bHQsIHZpZXcgdGhlIHJvb20gYWZ0ZXIgY3JlYXRpbmcgaXRcbiAgICBpZiAob3B0cy5hbmRWaWV3ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgb3B0cy5hbmRWaWV3ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBjcmVhdGVPcHRzLmluaXRpYWxfc3RhdGUgPSBjcmVhdGVPcHRzLmluaXRpYWxfc3RhdGUgfHwgW107XG5cbiAgICAvLyBBbGxvdyBndWVzdHMgYnkgZGVmYXVsdCBzaW5jZSB0aGUgcm9vbSBpcyBwcml2YXRlIGFuZCB0aGV5J2RcbiAgICAvLyBuZWVkIGFuIGludml0ZS4gVGhpcyBtZWFucyBjbGlja2luZyBvbiBhIDNwaWQgaW52aXRlIGVtYWlsIGNhblxuICAgIC8vIGFjdHVhbGx5IGRyb3AgeW91IHJpZ2h0IGluIHRvIGEgY2hhdC5cbiAgICBpZiAob3B0cy5ndWVzdEFjY2Vzcykge1xuICAgICAgICBjcmVhdGVPcHRzLmluaXRpYWxfc3RhdGUucHVzaCh7XG4gICAgICAgICAgICB0eXBlOiBcIm0ucm9vbS5ndWVzdF9hY2Nlc3NcIixcbiAgICAgICAgICAgIHN0YXRlX2tleTogXCJcIixcbiAgICAgICAgICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgICAgICAgICBndWVzdF9hY2Nlc3M6IFwiY2FuX2pvaW5cIixcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChvcHRzLmVuY3J5cHRpb24pIHtcbiAgICAgICAgY3JlYXRlT3B0cy5pbml0aWFsX3N0YXRlLnB1c2goe1xuICAgICAgICAgICAgdHlwZTogXCJtLnJvb20uZW5jcnlwdGlvblwiLFxuICAgICAgICAgICAgc3RhdGVfa2V5OiBcIlwiLFxuICAgICAgICAgICAgY29udGVudDoge1xuICAgICAgICAgICAgICAgIGFsZ29yaXRobTogXCJtLm1lZ29sbS52MS5hZXMtc2hhMlwiLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKG9wdHMucGFyZW50U3BhY2UpIHtcbiAgICAgICAgY3JlYXRlT3B0cy5pbml0aWFsX3N0YXRlLnB1c2gobWFrZVNwYWNlUGFyZW50RXZlbnQob3B0cy5wYXJlbnRTcGFjZSwgdHJ1ZSkpO1xuICAgICAgICBpZiAoIW9wdHMuaGlzdG9yeVZpc2liaWxpdHkpIHtcbiAgICAgICAgICAgIG9wdHMuaGlzdG9yeVZpc2liaWxpdHkgPVxuICAgICAgICAgICAgICAgIGNyZWF0ZU9wdHMucHJlc2V0ID09PSBQcmVzZXQuUHVibGljQ2hhdCA/IEhpc3RvcnlWaXNpYmlsaXR5LldvcmxkUmVhZGFibGUgOiBIaXN0b3J5VmlzaWJpbGl0eS5JbnZpdGVkO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdHMuam9pblJ1bGUgPT09IEpvaW5SdWxlLlJlc3RyaWN0ZWQpIHtcbiAgICAgICAgICAgIGNyZWF0ZU9wdHMucm9vbV92ZXJzaW9uID0gUHJlZmVycmVkUm9vbVZlcnNpb25zLlJlc3RyaWN0ZWRSb29tcztcblxuICAgICAgICAgICAgY3JlYXRlT3B0cy5pbml0aWFsX3N0YXRlLnB1c2goe1xuICAgICAgICAgICAgICAgIHR5cGU6IEV2ZW50VHlwZS5Sb29tSm9pblJ1bGVzLFxuICAgICAgICAgICAgICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgICAgICAgICAgICAgam9pbl9ydWxlOiBKb2luUnVsZS5SZXN0cmljdGVkLFxuICAgICAgICAgICAgICAgICAgICBhbGxvdzogW1xuICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFJlc3RyaWN0ZWRBbGxvd1R5cGUuUm9vbU1lbWJlcnNoaXAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcm9vbV9pZDogb3B0cy5wYXJlbnRTcGFjZS5yb29tSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHdlIGhhbmRsZSB0aGUgcmVzdHJpY3RlZCBqb2luIHJ1bGUgaW4gdGhlIHBhcmVudFNwYWNlIGhhbmRsaW5nIGJsb2NrIGFib3ZlXG4gICAgaWYgKG9wdHMuam9pblJ1bGUgJiYgb3B0cy5qb2luUnVsZSAhPT0gSm9pblJ1bGUuUmVzdHJpY3RlZCkge1xuICAgICAgICBjcmVhdGVPcHRzLmluaXRpYWxfc3RhdGUucHVzaCh7XG4gICAgICAgICAgICB0eXBlOiBFdmVudFR5cGUuUm9vbUpvaW5SdWxlcyxcbiAgICAgICAgICAgIGNvbnRlbnQ6IHsgam9pbl9ydWxlOiBvcHRzLmpvaW5SdWxlIH0sXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChvcHRzLmF2YXRhcikge1xuICAgICAgICBsZXQgdXJsID0gb3B0cy5hdmF0YXI7XG4gICAgICAgIGlmIChvcHRzLmF2YXRhciBpbnN0YW5jZW9mIEZpbGUpIHtcbiAgICAgICAgICAgICh7IGNvbnRlbnRfdXJpOiB1cmwgfSA9IGF3YWl0IGNsaWVudC51cGxvYWRDb250ZW50KG9wdHMuYXZhdGFyKSk7XG4gICAgICAgIH1cblxuICAgICAgICBjcmVhdGVPcHRzLmluaXRpYWxfc3RhdGUucHVzaCh7XG4gICAgICAgICAgICB0eXBlOiBFdmVudFR5cGUuUm9vbUF2YXRhcixcbiAgICAgICAgICAgIGNvbnRlbnQ6IHsgdXJsIH0sXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChvcHRzLmhpc3RvcnlWaXNpYmlsaXR5KSB7XG4gICAgICAgIGNyZWF0ZU9wdHMuaW5pdGlhbF9zdGF0ZS5wdXNoKHtcbiAgICAgICAgICAgIHR5cGU6IEV2ZW50VHlwZS5Sb29tSGlzdG9yeVZpc2liaWxpdHksXG4gICAgICAgICAgICBjb250ZW50OiB7XG4gICAgICAgICAgICAgICAgaGlzdG9yeV92aXNpYmlsaXR5OiBvcHRzLmhpc3RvcnlWaXNpYmlsaXR5LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgbGV0IG1vZGFsOiBJSGFuZGxlPGFueT4gfCB1bmRlZmluZWQ7XG4gICAgaWYgKG9wdHMuc3Bpbm5lcikgbW9kYWwgPSBNb2RhbC5jcmVhdGVEaWFsb2coU3Bpbm5lciwgdW5kZWZpbmVkLCBcIm14X0RpYWxvZ19zcGlubmVyXCIpO1xuXG4gICAgbGV0IHJvb21JZDogc3RyaW5nO1xuICAgIGxldCByb29tOiBQcm9taXNlPFJvb20+O1xuICAgIHJldHVybiBjbGllbnRcbiAgICAgICAgLmNyZWF0ZVJvb20oY3JlYXRlT3B0cylcbiAgICAgICAgLmNhdGNoKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIC8vIE5CIFRoaXMgY2hlY2tzIGZvciB0aGUgU3luYXBzZS1zcGVjaWZpYyBlcnJvciBjb25kaXRpb24gb2YgYSByb29tIGNyZWF0aW9uXG4gICAgICAgICAgICAvLyBoYXZpbmcgYmVlbiBkZW5pZWQgYmVjYXVzZSB0aGUgcmVxdWVzdGluZyB1c2VyIHdhbnRlZCB0byBwdWJsaXNoIHRoZSByb29tLFxuICAgICAgICAgICAgLy8gYnV0IHRoZSBzZXJ2ZXIgZGVuaWVzIHRoZW0gdGhhdCBwZXJtaXNzaW9uICh2aWEgcm9vbV9saXN0X3B1YmxpY2F0aW9uX3J1bGVzKS5cbiAgICAgICAgICAgIC8vIFRoZSBjaGVjayBiZWxvdyByZXNwb25kcyBieSByZXRyeWluZyB3aXRob3V0IHB1Ymxpc2hpbmcgdGhlIHJvb20uXG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgZXJyLmh0dHBTdGF0dXMgPT09IDQwMyAmJlxuICAgICAgICAgICAgICAgIGVyci5lcnJjb2RlID09PSBcIk1fVU5LTk9XTlwiICYmXG4gICAgICAgICAgICAgICAgZXJyLmRhdGEuZXJyb3IgPT09IFwiTm90IGFsbG93ZWQgdG8gcHVibGlzaCByb29tXCJcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgIGxvZ2dlci53YXJuKFwiRmFpbGVkIHRvIHB1Ymxpc2ggcm9vbSwgdHJ5IGFnYWluIHdpdGhvdXQgcHVibGlzaGluZyBpdFwiKTtcbiAgICAgICAgICAgICAgICBjcmVhdGVPcHRzLnZpc2liaWxpdHkgPSBWaXNpYmlsaXR5LlByaXZhdGU7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNsaWVudC5jcmVhdGVSb29tKGNyZWF0ZU9wdHMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgICAgLmZpbmFsbHkoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKG1vZGFsKSBtb2RhbC5jbG9zZSgpO1xuICAgICAgICB9KVxuICAgICAgICAudGhlbihhc3luYyAocmVzKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICAgICAgICByb29tSWQgPSByZXMucm9vbV9pZDtcblxuICAgICAgICAgICAgcm9vbSA9IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RvcmVkUm9vbSA9IGNsaWVudC5nZXRSb29tKHJvb21JZCk7XG4gICAgICAgICAgICAgICAgaWYgKHN0b3JlZFJvb20pIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShzdG9yZWRSb29tKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBUaGUgcm9vbSBoYXNuJ3QgYXJyaXZlZCBkb3duIHN5bmMgeWV0XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG9uUm9vbSA9IChlbWl0dGVkUm9vbTogUm9vbSk6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVtaXR0ZWRSb29tLnJvb21JZCA9PT0gcm9vbUlkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShlbWl0dGVkUm9vbSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xpZW50Lm9mZihDbGllbnRFdmVudC5Sb29tLCBvblJvb20pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICBjbGllbnQub24oQ2xpZW50RXZlbnQuUm9vbSwgb25Sb29tKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgaWYgKG9wdHMuZG1Vc2VySWQpIGF3YWl0IFJvb21zLnNldERNUm9vbShjbGllbnQsIHJvb21JZCwgb3B0cy5kbVVzZXJJZCk7XG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgIGlmIChvcHRzLnBhcmVudFNwYWNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFNwYWNlU3RvcmUuaW5zdGFuY2UuYWRkUm9vbVRvU3BhY2UoXG4gICAgICAgICAgICAgICAgICAgIG9wdHMucGFyZW50U3BhY2UsXG4gICAgICAgICAgICAgICAgICAgIHJvb21JZCxcbiAgICAgICAgICAgICAgICAgICAgW2NsaWVudC5nZXREb21haW4oKSFdLFxuICAgICAgICAgICAgICAgICAgICBvcHRzLnN1Z2dlc3RlZCxcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICAudGhlbihhc3luYyAoKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICAgICAgICBpZiAob3B0cy5yb29tVHlwZSA9PT0gUm9vbVR5cGUuRWxlbWVudFZpZGVvKSB7XG4gICAgICAgICAgICAgICAgLy8gU2V0IHVwIHRoaXMgdmlkZW8gcm9vbSB3aXRoIGEgSml0c2kgY2FsbFxuICAgICAgICAgICAgICAgIGF3YWl0IEppdHNpQ2FsbC5jcmVhdGUoYXdhaXQgcm9vbSk7XG5cbiAgICAgICAgICAgICAgICAvLyBSZXNldCBvdXIgcG93ZXIgbGV2ZWwgYmFjayB0byBhZG1pbiBzbyB0aGF0IHRoZSB3aWRnZXQgYmVjb21lcyBpbW11dGFibGVcbiAgICAgICAgICAgICAgICBjb25zdCBwbEV2ZW50ID0gKGF3YWl0IHJvb20pLmN1cnJlbnRTdGF0ZS5nZXRTdGF0ZUV2ZW50cyhFdmVudFR5cGUuUm9vbVBvd2VyTGV2ZWxzLCBcIlwiKTtcbiAgICAgICAgICAgICAgICBhd2FpdCBjbGllbnQuc2V0UG93ZXJMZXZlbChyb29tSWQsIGNsaWVudC5nZXRVc2VySWQoKSEsIDEwMCwgcGxFdmVudCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKG9wdHMucm9vbVR5cGUgPT09IFJvb21UeXBlLlVuc3RhYmxlQ2FsbCkge1xuICAgICAgICAgICAgICAgIC8vIFNldCB1cCB0aGlzIHZpZGVvIHJvb20gd2l0aCBhbiBFbGVtZW50IGNhbGxcbiAgICAgICAgICAgICAgICBhd2FpdCBFbGVtZW50Q2FsbC5jcmVhdGUoYXdhaXQgcm9vbSk7XG5cbiAgICAgICAgICAgICAgICAvLyBSZXNldCBvdXIgcG93ZXIgbGV2ZWwgYmFjayB0byBhZG1pbiBzbyB0aGF0IHRoZSBjYWxsIGJlY29tZXMgaW1tdXRhYmxlXG4gICAgICAgICAgICAgICAgY29uc3QgcGxFdmVudCA9IChhd2FpdCByb29tKS5jdXJyZW50U3RhdGUuZ2V0U3RhdGVFdmVudHMoRXZlbnRUeXBlLlJvb21Qb3dlckxldmVscywgXCJcIik7XG4gICAgICAgICAgICAgICAgYXdhaXQgY2xpZW50LnNldFBvd2VyTGV2ZWwocm9vbUlkLCBjbGllbnQuZ2V0VXNlcklkKCkhLCAxMDAsIHBsRXZlbnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvL0luamVjdCBUb2tlbkdhdGUgd2lkZ2V0IGFmdGVyIHJvb20gaXMgY3JlYXRlZCAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gY29uc3QgdXNlcklkID0gY2xpZW50LmdldFVzZXJJZCgpO1xuICAgICAgICAgICAgLy8gY29uc3QgZGlzcGxheU5hbWUgPSAnTkZUIEdhdGUnO1xuICAgICAgICAgICAgLy8gY29uc3QgYXZhdGFyVXJsID0gJyc7XG4gICAgICAgICAgICAvLyBjb25zdCBjbGllbnRJZCA9IGNsaWVudC5nZXREZXZpY2VJZCgpOyBcbiAgICAgICAgICAgIC8vIGNvbnN0IGxhbmd1YWdlID0gJ2VuJzsgXG4gICAgICAgICAgICAvLyBjb25zdCBiYXNlVXJsID0gY2xpZW50LmJhc2VVcmwgfHwgJ2h0dHBzOi8vbWF0cml4Lm9yZyc7IFxuICAgICAgICAgICAgY29uc3Qgd2lkZ2V0VXJsID0gJ2h0dHBzOi8vdG9rZW5nYXRlLWRldi50ZXh0cnAuaW8vIy8/dGhlbWU9JG9yZy5tYXRyaXgubXNjMjg3My5jbGllbnRfdGhlbWUmbWF0cml4X3VzZXJfaWQ9JG1hdHJpeF91c2VyX2lkJm1hdHJpeF9kaXNwbGF5X25hbWU9JG1hdHJpeF9kaXNwbGF5X25hbWUmbWF0cml4X2F2YXRhcl91cmw9JG1hdHJpeF9hdmF0YXJfdXJsJm1hdHJpeF9yb29tX2lkPSRtYXRyaXhfcm9vbT4nO1xuICAgICAgICAgICAgLy9jb25zdCB3aWRnZXRVcmwgPSBgaHR0cHM6Ly8zLjY1LjIxNi42OTozMDAwLyMvP3RoZW1lPSRvcmcubWF0cml4Lm1zYzI4NzMuY2xpZW50X3RoZW1lJm1hdHJpeF91c2VyX2lkPSRtYXRyaXhfdXNlcl9pZCZtYXRyaXhfZGlzcGxheV9uYW1lPSRtYXRyaXhfZGlzcGxheV9uYW1lJm1hdHJpeF9hdmF0YXJfdXJsPSRtYXRyaXhfYXZhdGFyX3VybCZtYXRyaXhfcm9vbV9pZD0kbWF0cml4X3Jvb21faWQmbWF0cml4X2NsaWVudF9pZD0kb3JnLm1hdHJpeC5tc2MyODczLmNsaWVudF9pZCZtYXRyaXhfY2xpZW50X2xhbmd1YWdlPSRvcmcubWF0cml4Lm1zYzI4NzMuY2xpZW50X2xhbmd1YWdlJm1hdHJpeF9kZXZpY2VfaWQ9JG9yZy5tYXRyaXgubXNjMzgxOS5tYXRyaXhfZGV2aWNlX2lkJm1hdHJpeF9iYXNlX3VybD0kb3JnLm1hdHJpeC5tc2M0MDM5Lm1hdHJpeF9iYXNlX3VybGBcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgYXdhaXQgY2xpZW50LnNlbmRTdGF0ZUV2ZW50KFxuICAgICAgICAgICAgICAgIHJvb21JZCxcbiAgICAgICAgICAgICAgICBcImltLnZlY3Rvci5tb2R1bGFyLndpZGdldHNcIixcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGlkOiBcInRva2VuZ2F0ZS13aWRnZXRcIixcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJtLmN1c3RvbVwiLFxuICAgICAgICAgICAgICAgICAgICB1cmw6IHdpZGdldFVybCwgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBuYW1lOiBcIk5GVCBHYXRlXCIsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHt9LFxuICAgICAgICAgICAgICAgICAgICBjcmVhdG9yVXNlcklkOiBjbGllbnQuZ2V0VXNlcklkKCksXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBcInRva2VuZ2F0ZS13aWRnZXRcIixcbiAgICAgICAgICAgICk7XG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKFxuICAgICAgICAgICAgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIC8vIE5CIHdlIGhhdmVuJ3QgbmVjZXNzYXJpbHkgYmxvY2tlZCBvbiB0aGUgcm9vbSBwcm9taXNlLCBzbyB3ZSByYWNlXG4gICAgICAgICAgICAgICAgLy8gaGVyZSB3aXRoIHRoZSBjbGllbnQga25vd2luZyB0aGF0IHRoZSByb29tIGV4aXN0cywgY2F1c2luZyB0aGluZ3NcbiAgICAgICAgICAgICAgICAvLyBsaWtlIGh0dHBzOi8vZ2l0aHViLmNvbS92ZWN0b3ItaW0vdmVjdG9yLXdlYi9pc3N1ZXMvMTgxM1xuICAgICAgICAgICAgICAgIC8vIEV2ZW4gaWYgd2Ugd2VyZSB0byBibG9jayBvbiB0aGUgZWNobywgc2VydmVycyB0ZW5kIHRvIHNwbGl0IHRoZSByb29tXG4gICAgICAgICAgICAgICAgLy8gc3RhdGUgb3ZlciBtdWx0aXBsZSBzeW5jcyBzbyB3ZSBjYW4ndCBhdG9taWNhbGx5IGtub3cgd2hlbiB3ZSBoYXZlIHRoZVxuICAgICAgICAgICAgICAgIC8vIGVudGlyZSB0aGluZy5cbiAgICAgICAgICAgICAgICBpZiAob3B0cy5hbmRWaWV3KSB7XG4gICAgICAgICAgICAgICAgICAgIGRpcy5kaXNwYXRjaDxWaWV3Um9vbVBheWxvYWQ+KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjdGlvbjogQWN0aW9uLlZpZXdSb29tLFxuICAgICAgICAgICAgICAgICAgICAgICAgcm9vbV9pZDogcm9vbUlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2hvdWxkX3BlZWs6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ3JlYXRpbmcgYSByb29tIHdpbGwgaGF2ZSBqb2luZWQgdXMgdG8gdGhlIHJvb20sXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzbyB3ZSBhcmUgZXhwZWN0aW5nIHRoZSByb29tIHRvIGNvbWUgZG93biB0aGUgc3luY1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gc3RyZWFtLCBpZiBpdCBoYXNuJ3QgYWxyZWFkeS5cbiAgICAgICAgICAgICAgICAgICAgICAgIGpvaW5pbmc6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBqdXN0Q3JlYXRlZE9wdHM6IG9wdHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXRyaWNzVHJpZ2dlcjogXCJDcmVhdGVkXCIsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gcm9vbUlkO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAvLyBSYWlzZSB0aGUgZXJyb3IgaWYgdGhlIGNhbGxlciByZXF1ZXN0ZWQgdGhhdCB3ZSBkbyBzby5cbiAgICAgICAgICAgICAgICBpZiAob3B0cy5pbmxpbmVFcnJvcnMpIHRocm93IGVycjtcblxuICAgICAgICAgICAgICAgIC8vIFdlIGFsc28gZmFpbGVkIHRvIGpvaW4gdGhlIHJvb20gKHRoaXMgc2V0cyBqb2luaW5nIHRvIGZhbHNlIGluIFJvb21WaWV3U3RvcmUpXG4gICAgICAgICAgICAgICAgZGlzLmRpc3BhdGNoKHtcbiAgICAgICAgICAgICAgICAgICAgYWN0aW9uOiBBY3Rpb24uSm9pblJvb21FcnJvcixcbiAgICAgICAgICAgICAgICAgICAgcm9vbUlkLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGxvZ2dlci5lcnJvcihcIkZhaWxlZCB0byBjcmVhdGUgcm9vbSBcIiArIHJvb21JZCArIFwiIFwiICsgZXJyKTtcbiAgICAgICAgICAgICAgICBsZXQgZGVzY3JpcHRpb24gPSBfdChcIlNlcnZlciBtYXkgYmUgdW5hdmFpbGFibGUsIG92ZXJsb2FkZWQsIG9yIHlvdSBoaXQgYSBidWcuXCIpO1xuICAgICAgICAgICAgICAgIGlmIChlcnIuZXJyY29kZSA9PT0gXCJNX1VOU1VQUE9SVEVEX1JPT01fVkVSU0lPTlwiKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFRlY2huaWNhbGx5IG5vdCBwb3NzaWJsZSB3aXRoIHRoZSBVSSBhcyBvZiBBcHJpbCAyMDE5IGJlY2F1c2UgdGhlcmUncyBub1xuICAgICAgICAgICAgICAgICAgICAvLyBvcHRpb25zIGZvciB0aGUgdXNlciB0byBjaGFuZ2UgdGhpcy4gSG93ZXZlciwgaXQncyBub3QgYSBiYWQgdGhpbmcgdG8gcmVwb3J0XG4gICAgICAgICAgICAgICAgICAgIC8vIHRoZSBlcnJvciB0byB0aGUgdXNlciBmb3IgaWYvd2hlbiB0aGUgVUkgaXMgYXZhaWxhYmxlLlxuICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbiA9IF90KFwiVGhlIHNlcnZlciBkb2VzIG5vdCBzdXBwb3J0IHRoZSByb29tIHZlcnNpb24gc3BlY2lmaWVkLlwiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgTW9kYWwuY3JlYXRlRGlhbG9nKEVycm9yRGlhbG9nLCB7XG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiBfdChcIkZhaWx1cmUgdG8gY3JlYXRlIHJvb21cIiksXG4gICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgKTtcbn1cblxuLypcbiAqIEVuc3VyZSB0aGF0IGZvciBldmVyeSB1c2VyIGluIGEgcm9vbSwgdGhlcmUgaXMgYXQgbGVhc3Qgb25lIGRldmljZSB0aGF0IHdlXG4gKiBjYW4gZW5jcnlwdCB0by5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNhbkVuY3J5cHRUb0FsbFVzZXJzKGNsaWVudDogTWF0cml4Q2xpZW50LCB1c2VySWRzOiBzdHJpbmdbXSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHVzZXJzRGV2aWNlTWFwID0gYXdhaXQgY2xpZW50LmdldENyeXB0bygpPy5nZXRVc2VyRGV2aWNlSW5mbyh1c2VySWRzLCB0cnVlKTtcbiAgICAgICAgaWYgKCF1c2Vyc0RldmljZU1hcCkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChjb25zdCBkZXZpY2VzIG9mIHVzZXJzRGV2aWNlTWFwLnZhbHVlcygpKSB7XG4gICAgICAgICAgICBpZiAoZGV2aWNlcy5zaXplID09PSAwKSB7XG4gICAgICAgICAgICAgICAgLy8gVGhpcyB1c2VyIGRvZXMgbm90IGhhdmUgYW55IGVuY3J5cHRpb24tY2FwYWJsZSBkZXZpY2VzLlxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKFwiRXJyb3IgZGV0ZXJtaW5pbmcgaWYgaXQncyBwb3NzaWJsZSB0byBlbmNyeXB0IHRvIGFsbCB1c2VyczogXCIsIGUpO1xuICAgICAgICByZXR1cm4gZmFsc2U7IC8vIGFzc3VtZSBub3RcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbn1cblxuLy8gU2ltaWxhciB0byBlbnN1cmVETUV4aXN0cyBidXQgYWxzbyBhZGRzIGNyZWF0aW9uIGNvbnRlbnRcbi8vIHdpdGhvdXQgcG9sbHV0aW5nIGVuc3VyZURNRXhpc3RzIHdpdGggdW5yZWxhdGVkIHN0dWZmIChhbHNvXG4vLyB0aGV5J3JlIG5ldmVyIGVuY3J5cHRlZCkuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZW5zdXJlVmlydHVhbFJvb21FeGlzdHMoXG4gICAgY2xpZW50OiBNYXRyaXhDbGllbnQsXG4gICAgdXNlcklkOiBzdHJpbmcsXG4gICAgbmF0aXZlUm9vbUlkOiBzdHJpbmcsXG4pOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcbiAgICBjb25zdCBleGlzdGluZ0RNUm9vbSA9IGZpbmRETUZvclVzZXIoY2xpZW50LCB1c2VySWQpO1xuICAgIGxldCByb29tSWQ6IHN0cmluZyB8IG51bGw7XG4gICAgaWYgKGV4aXN0aW5nRE1Sb29tKSB7XG4gICAgICAgIHJvb21JZCA9IGV4aXN0aW5nRE1Sb29tLnJvb21JZDtcbiAgICB9IGVsc2Uge1xuICAgICAgICByb29tSWQgPSBhd2FpdCBjcmVhdGVSb29tKGNsaWVudCwge1xuICAgICAgICAgICAgZG1Vc2VySWQ6IHVzZXJJZCxcbiAgICAgICAgICAgIHNwaW5uZXI6IGZhbHNlLFxuICAgICAgICAgICAgYW5kVmlldzogZmFsc2UsXG4gICAgICAgICAgICBjcmVhdGVPcHRzOiB7XG4gICAgICAgICAgICAgICAgY3JlYXRpb25fY29udGVudDoge1xuICAgICAgICAgICAgICAgICAgICAvLyBUaGlzIGFsbG93cyB1cyB0byByZWNvZ25pc2UgdGhhdCB0aGUgcm9vbSBpcyBhIHZpcnR1YWwgcm9vbVxuICAgICAgICAgICAgICAgICAgICAvLyB3aGVuIGl0IGNvbWVzIGRvd24gb3VyIHN5bmMgc3RyZWFtICh3ZSBhbHNvIHB1dCB0aGUgSUQgb2YgdGhlXG4gICAgICAgICAgICAgICAgICAgIC8vIHJlc3BlY3RpdmUgbmF0aXZlIHJvb20gaW4gdGhlcmUgYmVjYXVzZSB3aHkgbm90PylcbiAgICAgICAgICAgICAgICAgICAgW1ZJUlRVQUxfUk9PTV9FVkVOVF9UWVBFXTogbmF0aXZlUm9vbUlkLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHJvb21JZDtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGVuc3VyZURNRXhpc3RzKGNsaWVudDogTWF0cml4Q2xpZW50LCB1c2VySWQ6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICAgIGNvbnN0IGV4aXN0aW5nRE1Sb29tID0gZmluZERNRm9yVXNlcihjbGllbnQsIHVzZXJJZCk7XG4gICAgbGV0IHJvb21JZDogc3RyaW5nIHwgbnVsbDtcbiAgICBpZiAoZXhpc3RpbmdETVJvb20pIHtcbiAgICAgICAgcm9vbUlkID0gZXhpc3RpbmdETVJvb20ucm9vbUlkO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCBlbmNyeXB0aW9uOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuICAgICAgICBpZiAocHJpdmF0ZVNob3VsZEJlRW5jcnlwdGVkKGNsaWVudCkpIHtcbiAgICAgICAgICAgIGVuY3J5cHRpb24gPSBhd2FpdCBjYW5FbmNyeXB0VG9BbGxVc2VycyhjbGllbnQsIFt1c2VySWRdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJvb21JZCA9IGF3YWl0IGNyZWF0ZVJvb20oY2xpZW50LCB7IGVuY3J5cHRpb24sIGRtVXNlcklkOiB1c2VySWQsIHNwaW5uZXI6IGZhbHNlLCBhbmRWaWV3OiBmYWxzZSB9KTtcbiAgICAgICAgaWYgKCFyb29tSWQpIHJldHVybiBudWxsO1xuICAgICAgICBhd2FpdCB3YWl0Rm9yTWVtYmVyKGNsaWVudCwgcm9vbUlkLCB1c2VySWQpO1xuICAgIH1cbiAgICByZXR1cm4gcm9vbUlkO1xufVxuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQWlCQSxJQUFBQSxPQUFBLEdBQUFDLE9BQUE7QUFFQSxJQUFBQyxNQUFBLEdBQUFELE9BQUE7QUFFQSxJQUFBRSxTQUFBLEdBQUFGLE9BQUE7QUFPQSxJQUFBRyxPQUFBLEdBQUFILE9BQUE7QUFFQSxJQUFBSSxNQUFBLEdBQUFDLHNCQUFBLENBQUFMLE9BQUE7QUFDQSxJQUFBTSxnQkFBQSxHQUFBTixPQUFBO0FBQ0EsSUFBQU8sV0FBQSxHQUFBRixzQkFBQSxDQUFBTCxPQUFBO0FBQ0EsSUFBQVEsS0FBQSxHQUFBQyx1QkFBQSxDQUFBVCxPQUFBO0FBQ0EsSUFBQVUsWUFBQSxHQUFBVixPQUFBO0FBQ0EsSUFBQVcsVUFBQSxHQUFBWCxPQUFBO0FBQ0EsSUFBQVksV0FBQSxHQUFBUCxzQkFBQSxDQUFBTCxPQUFBO0FBQ0EsSUFBQWEsTUFBQSxHQUFBYixPQUFBO0FBQ0EsSUFBQWMsS0FBQSxHQUFBZCxPQUFBO0FBQ0EsSUFBQWUsUUFBQSxHQUFBZixPQUFBO0FBQ0EsSUFBQWdCLFlBQUEsR0FBQVgsc0JBQUEsQ0FBQUwsT0FBQTtB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