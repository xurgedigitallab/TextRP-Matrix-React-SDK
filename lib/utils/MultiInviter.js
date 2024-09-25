"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.UNKNOWN_PROFILE_ERRORS = exports.InviteState = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _httpApi = require("matrix-js-sdk/src/http-api");
var _utils = require("matrix-js-sdk/src/utils");
var _logger = require("matrix-js-sdk/src/logger");
var _event = require("matrix-js-sdk/src/@types/event");
var _partials = require("matrix-js-sdk/src/@types/partials");
var _UserAddress = require("../UserAddress");
var _languageHandler = require("../languageHandler");
var _Modal = _interopRequireDefault(require("../Modal"));
var _SettingsStore = _interopRequireDefault(require("../settings/SettingsStore"));
var _AskInviteAnywayDialog = _interopRequireDefault(require("../components/views/dialogs/AskInviteAnywayDialog"));
/*
Copyright 2016 - 2021 The Matrix.org Foundation C.I.C.

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
let InviteState = /*#__PURE__*/function (InviteState) {
  InviteState["Invited"] = "invited";
  InviteState["Error"] = "error";
  return InviteState;
}({});
exports.InviteState = InviteState;
const UNKNOWN_PROFILE_ERRORS = ["M_NOT_FOUND", "M_USER_NOT_FOUND", "M_PROFILE_UNDISCLOSED", "M_PROFILE_NOT_FOUND"];
exports.UNKNOWN_PROFILE_ERRORS = UNKNOWN_PROFILE_ERRORS;
const USER_ALREADY_JOINED = "IO.ELEMENT.ALREADY_JOINED";
const USER_ALREADY_INVITED = "IO.ELEMENT.ALREADY_INVITED";

/**
 * Invites multiple addresses to a room, handling rate limiting from the server
 */
class MultiInviter {
  /**
   * @param matrixClient the client of the logged in user
   * @param {string} roomId The ID of the room to invite to
   * @param {function} progressCallback optional callback, fired after each invite.
   */
  constructor(matrixClient, roomId, progressCallback) {
    this.matrixClient = matrixClient;
    this.roomId = roomId;
    this.progressCallback = progressCallback;
    (0, _defineProperty2.default)(this, "canceled", false);
    (0, _defineProperty2.default)(this, "addresses", []);
    (0, _defineProperty2.default)(this, "busy", false);
    (0, _defineProperty2.default)(this, "_fatal", false);
    (0, _defineProperty2.default)(this, "completionStates", {});
    // State of each address (invited or error)
    (0, _defineProperty2.default)(this, "errors", {});
    // { address: {errorText, errcode} }
    (0, _defineProperty2.default)(this, "deferred", null);
    (0, _defineProperty2.default)(this, "reason", void 0);
  }
  get fatal() {
    return this._fatal;
  }

  /**
   * Invite users to this room. This may only be called once per
   * instance of the class.
   *
   * @param {array} addresses Array of addresses to invite
   * @param {string} reason Reason for inviting (optional)
   * @param {boolean} sendSharedHistoryKeys whether to share e2ee keys with the invitees if applicable.
   * @returns {Promise} Resolved when all invitations in the queue are complete
   */
  invite(addresses, reason) {
    let sendSharedHistoryKeys = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
    if (this.addresses.length > 0) {
      throw new Error("Already inviting/invited");
    }
    this.addresses.push(...addresses);
    this.reason = reason;
    for (const addr of this.addresses) {
      if ((0, _UserAddress.getAddressType)(addr) === null) {
        this.completionStates[addr] = InviteState.Error;
        this.errors[addr] = {
          errcode: "M_INVALID",
          errorText: (0, _languageHandler._t)("Unrecognised address")
        };
      }
    }
    this.deferred = (0, _utils.defer)();
    this.inviteMore(0);
    if (!sendSharedHistoryKeys || !this.roomId || !this.matrixClient.isRoomEncrypted(this.roomId)) {
      return this.deferred.promise;
    }
    const room = this.matrixClient.getRoom(this.roomId);
    const visibilityEvent = room?.currentState.getStateEvents(_event.EventType.RoomHistoryVisibility, "");
    const visibility = visibilityEvent?.getContent().history_visibility;
    if (visibility !== _partials.HistoryVisibility.WorldReadable && visibility !== _partials.HistoryVisibility.Shared) {
      return this.deferred.promise;
    }
    return this.deferred.promise.then(async states => {
      const invitedUsers = [];
      for (const [addr, state] of Object.entries(states)) {
        if (state === InviteState.Invited && (0, _UserAddress.getAddressType)(addr) === _UserAddress.AddressType.MatrixUserId) {
          invitedUsers.push(addr);
        }
      }
      _logger.logger.log("Sharing history with", invitedUsers);
      this.matrixClient.sendSharedHistoryKeys(this.roomId, invitedUsers); // do this in the background

      return states;
    });
  }

  /**
   * Stops inviting. Causes promises returned by invite() to be rejected.
   */
  cancel() {
    if (!this.busy) return;
    this.canceled = true;
    this.deferred?.reject(new Error("canceled"));
  }
  getCompletionState(addr) {
    return this.completionStates[addr];
  }
  getErrorText(addr) {
    return this.errors[addr]?.errorText ?? null;
  }
  async inviteToRoom(roomId, addr) {
    let ignoreProfile = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
    const addrType = (0, _UserAddress.getAddressType)(addr);
    if (addrType === _UserAddress.AddressType.Email) {
      return this.matrixClient.inviteByEmail(roomId, addr);
    } else if (addrType === _UserAddress.AddressType.MatrixUserId) {
      const room = this.matrixClient.getRoom(roomId);
      if (!room) throw new Error("Room not found");
      const member = room.getMember(addr);
      if (member?.membership === "join") {
        throw new _httpApi.MatrixError({
          errcode: USER_ALREADY_JOINED,
          error: "Member already joined"
        });
      } else if (member?.membership === "invite") {
        throw new _httpApi.MatrixError({
          errcode: USER_ALREADY_INVITED,
          error: "Member already invited"
        });
      }
      if (!ignoreProfile && _SettingsStore.default.getValue("promptBeforeInviteUnknownUsers", this.roomId)) {
        try {
          await this.matrixClient.getProfileInfo(addr);
        } catch (err) {
          // The error handling during the invitation process covers any API.
          // Some errors must to me mapped from profile API errors to more specific ones to avoid collisions.
          switch (err.errcode) {
            case "M_FORBIDDEN":
              throw new _httpApi.MatrixError({
                errcode: "M_PROFILE_UNDISCLOSED"
              });
            case "M_NOT_FOUND":
              throw new _httpApi.MatrixError({
                errcode: "M_USER_NOT_FOUND"
              });
            default:
              throw err;
          }
        }
      }
      return this.matrixClient.invite(roomId, addr, this.reason);
    } else {
      throw new Error("Unsupported address");
    }
  }
  doInvite(address) {
    let ignoreProfile = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    return new Promise((resolve, reject) => {
      _logger.logger.log(`Inviting ${address}`);
      const doInvite = this.inviteToRoom(this.roomId, address, ignoreProfile);
      doInvite.then(() => {
        if (this.canceled) {
          return;
        }
        this.completionStates[address] = InviteState.Invited;
        delete this.errors[address];
        resolve();
        this.progressCallback?.();
      }).catch(err => {
        if (this.canceled) {
          return;
        }
        _logger.logger.error(err);
        const isSpace = this.roomId && this.matrixClient.getRoom(this.roomId)?.isSpaceRoom();
        let errorText;
        let fatal = false;
        switch (err.errcode) {
          case "M_FORBIDDEN":
            if (isSpace) {
              errorText = (0, _languageHandler._t)("You do not have permission to invite people to this space.");
            } else {
              errorText = (0, _languageHandler._t)("You do not have permission to invite people to this room.");
            }
            fatal = true;
            break;
          case USER_ALREADY_INVITED:
            if (isSpace) {
              errorText = (0, _languageHandler._t)("User is already invited to the space");
            } else {
              errorText = (0, _languageHandler._t)("User is already invited to the room");
            }
            break;
          case USER_ALREADY_JOINED:
            if (isSpace) {
              errorText = (0, _languageHandler._t)("User is already in the space");
            } else {
              errorText = (0, _languageHandler._t)("User is already in the room");
            }
            break;
          case "M_LIMIT_EXCEEDED":
            // we're being throttled so wait a bit & try again
            window.setTimeout(() => {
              this.doInvite(address, ignoreProfile).then(resolve, reject);
            }, 5000);
            return;
          case "M_NOT_FOUND":
          case "M_USER_NOT_FOUND":
            errorText = (0, _languageHandler._t)("User does not exist");
            break;
          case "M_PROFILE_UNDISCLOSED":
            errorText = (0, _languageHandler._t)("User may or may not exist");
            break;
          case "M_PROFILE_NOT_FOUND":
            if (!ignoreProfile) {
              // Invite without the profile check
              _logger.logger.warn(`User ${address} does not have a profile - inviting anyways automatically`);
              this.doInvite(address, true).then(resolve, reject);
              return;
            }
            break;
          case "M_BAD_STATE":
            errorText = (0, _languageHandler._t)("The user must be unbanned before they can be invited.");
            break;
          case "M_UNSUPPORTED_ROOM_VERSION":
            if (isSpace) {
              errorText = (0, _languageHandler._t)("The user's homeserver does not support the version of the space.");
            } else {
              errorText = (0, _languageHandler._t)("The user's homeserver does not support the version of the room.");
            }
            break;
          case "ORG.MATRIX.JSSDK_MISSING_PARAM":
            if ((0, _UserAddress.getAddressType)(address) === _UserAddress.AddressType.Email) {
              errorText = (0, _languageHandler._t)("Cannot invite user by email without an identity server. " + 'You can connect to one under "Settings".');
            }
        }
        if (!errorText) {
          errorText = (0, _languageHandler._t)("Unknown server error");
        }
        this.completionStates[address] = InviteState.Error;
        this.errors[address] = {
          errorText,
          errcode: err.errcode
        };
        this.busy = !fatal;
        this._fatal = fatal;
        if (fatal) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
  inviteMore(nextIndex) {
    let ignoreProfile = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    if (this.canceled) {
      return;
    }
    if (nextIndex === this.addresses.length) {
      this.busy = false;
      if (Object.keys(this.errors).length > 0) {
        // There were problems inviting some people - see if we can invite them
        // without caring if they exist or not.
        const unknownProfileUsers = Object.keys(this.errors).filter(a => UNKNOWN_PROFILE_ERRORS.includes(this.errors[a].errcode));
        if (unknownProfileUsers.length > 0) {
          const inviteUnknowns = () => {
            const promises = unknownProfileUsers.map(u => this.doInvite(u, true));
            Promise.all(promises).then(() => this.deferred?.resolve(this.completionStates));
          };
          if (!_SettingsStore.default.getValue("promptBeforeInviteUnknownUsers", this.roomId)) {
            inviteUnknowns();
            return;
          }
          _logger.logger.log("Showing failed to invite dialog...");
          _Modal.default.createDialog(_AskInviteAnywayDialog.default, {
            unknownProfileUsers: unknownProfileUsers.map(u => ({
              userId: u,
              errorText: this.errors[u].errorText
            })),
            onInviteAnyways: () => inviteUnknowns(),
            onGiveUp: () => {
              // Fake all the completion states because we already warned the user
              for (const addr of unknownProfileUsers) {
                this.completionStates[addr] = InviteState.Invited;
              }
              this.deferred?.resolve(this.completionStates);
            }
          });
          return;
        }
      }
      this.deferred?.resolve(this.completionStates);
      return;
    }
    const addr = this.addresses[nextIndex];

    // don't try to invite it if it's an invalid address
    // (it will already be marked as an error though,
    // so no need to do so again)
    if ((0, _UserAddress.getAddressType)(addr) === null) {
      this.inviteMore(nextIndex + 1);
      return;
    }

    // don't re-invite (there's no way in the UI to do this, but
    // for sanity's sake)
    if (this.completionStates[addr] === InviteState.Invited) {
      this.inviteMore(nextIndex + 1);
      return;
    }
    this.doInvite(addr, ignoreProfile).then(() => {
      this.inviteMore(nextIndex + 1, ignoreProfile);
    }).catch(() => this.deferred?.resolve(this.completionStates));
  }
}
exports.default = MultiInviter;
//# sourceMappingURL=MultiInviter.js.map