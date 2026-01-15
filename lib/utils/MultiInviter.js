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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfaHR0cEFwaSIsInJlcXVpcmUiLCJfdXRpbHMiLCJfbG9nZ2VyIiwiX2V2ZW50IiwiX3BhcnRpYWxzIiwiX1VzZXJBZGRyZXNzIiwiX2xhbmd1YWdlSGFuZGxlciIsIl9Nb2RhbCIsIl9pbnRlcm9wUmVxdWlyZURlZmF1bHQiLCJfU2V0dGluZ3NTdG9yZSIsIl9Bc2tJbnZpdGVBbnl3YXlEaWFsb2ciLCJJbnZpdGVTdGF0ZSIsImV4cG9ydHMiLCJVTktOT1dOX1BST0ZJTEVfRVJST1JTIiwiVVNFUl9BTFJFQURZX0pPSU5FRCIsIlVTRVJfQUxSRUFEWV9JTlZJVEVEIiwiTXVsdGlJbnZpdGVyIiwiY29uc3RydWN0b3IiLCJtYXRyaXhDbGllbnQiLCJyb29tSWQiLCJwcm9ncmVzc0NhbGxiYWNrIiwiX2RlZmluZVByb3BlcnR5MiIsImRlZmF1bHQiLCJmYXRhbCIsIl9mYXRhbCIsImludml0ZSIsImFkZHJlc3NlcyIsInJlYXNvbiIsInNlbmRTaGFyZWRIaXN0b3J5S2V5cyIsImFyZ3VtZW50cyIsImxlbmd0aCIsInVuZGVmaW5lZCIsIkVycm9yIiwicHVzaCIsImFkZHIiLCJnZXRBZGRyZXNzVHlwZSIsImNvbXBsZXRpb25TdGF0ZXMiLCJlcnJvcnMiLCJlcnJjb2RlIiwiZXJyb3JUZXh0IiwiX3QiLCJkZWZlcnJlZCIsImRlZmVyIiwiaW52aXRlTW9yZSIsImlzUm9vbUVuY3J5cHRlZCIsInByb21pc2UiLCJyb29tIiwiZ2V0Um9vbSIsInZpc2liaWxpdHlFdmVudCIsImN1cnJlbnRTdGF0ZSIsImdldFN0YXRlRXZlbnRzIiwiRXZlbnRUeXBlIiwiUm9vbUhpc3RvcnlWaXNpYmlsaXR5IiwidmlzaWJpbGl0eSIsImdldENvbnRlbnQiLCJoaXN0b3J5X3Zpc2liaWxpdHkiLCJIaXN0b3J5VmlzaWJpbGl0eSIsIldvcmxkUmVhZGFibGUiLCJTaGFyZWQiLCJ0aGVuIiwic3RhdGVzIiwiaW52aXRlZFVzZXJzIiwic3RhdGUiLCJPYmplY3QiLCJlbnRyaWVzIiwiSW52aXRlZCIsIkFkZHJlc3NUeXBlIiwiTWF0cml4VXNlcklkIiwibG9nZ2VyIiwibG9nIiwiY2FuY2VsIiwiYnVzeSIsImNhbmNlbGVkIiwicmVqZWN0IiwiZ2V0Q29tcGxldGlvblN0YXRlIiwiZ2V0RXJyb3JUZXh0IiwiaW52aXRlVG9Sb29tIiwiaWdub3JlUHJvZmlsZSIsImFkZHJUeXBlIiwiRW1haWwiLCJpbnZpdGVCeUVtYWlsIiwibWVtYmVyIiwiZ2V0TWVtYmVyIiwibWVtYmVyc2hpcCIsIk1hdHJpeEVycm9yIiwiZXJyb3IiLCJTZXR0aW5nc1N0b3JlIiwiZ2V0VmFsdWUiLCJnZXRQcm9maWxlSW5mbyIsImVyciIsImRvSW52aXRlIiwiYWRkcmVzcyIsIlByb21pc2UiLCJyZXNvbHZlIiwiY2F0Y2giLCJpc1NwYWNlIiwiaXNTcGFjZVJvb20iLCJ3aW5kb3ciLCJzZXRUaW1lb3V0Iiwid2FybiIsIm5leHRJbmRleCIsImtleXMiLCJ1bmtub3duUHJvZmlsZVVzZXJzIiwiZmlsdGVyIiwiYSIsImluY2x1ZGVzIiwiaW52aXRlVW5rbm93bnMiLCJwcm9taXNlcyIsIm1hcCIsInUiLCJhbGwiLCJNb2RhbCIsImNyZWF0ZURpYWxvZyIsIkFza0ludml0ZUFueXdheURpYWxvZyIsInVzZXJJZCIsIm9uSW52aXRlQW55d2F5cyIsIm9uR2l2ZVVwIl0sInNvdXJjZXMiOlsiLi4vLi4vc3JjL3V0aWxzL011bHRpSW52aXRlci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuQ29weXJpZ2h0IDIwMTYgLSAyMDIxIFRoZSBNYXRyaXgub3JnIEZvdW5kYXRpb24gQy5JLkMuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuKi9cblxuaW1wb3J0IHsgTWF0cml4RXJyb3IgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvaHR0cC1hcGlcIjtcbmltcG9ydCB7IGRlZmVyLCBJRGVmZXJyZWQgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvdXRpbHNcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9sb2dnZXJcIjtcbmltcG9ydCB7IE1hdHJpeENsaWVudCB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9jbGllbnRcIjtcbmltcG9ydCB7IEV2ZW50VHlwZSB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9AdHlwZXMvZXZlbnRcIjtcbmltcG9ydCB7IEhpc3RvcnlWaXNpYmlsaXR5IH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL0B0eXBlcy9wYXJ0aWFsc1wiO1xuXG5pbXBvcnQgeyBBZGRyZXNzVHlwZSwgZ2V0QWRkcmVzc1R5cGUgfSBmcm9tIFwiLi4vVXNlckFkZHJlc3NcIjtcbmltcG9ydCB7IF90IH0gZnJvbSBcIi4uL2xhbmd1YWdlSGFuZGxlclwiO1xuaW1wb3J0IE1vZGFsIGZyb20gXCIuLi9Nb2RhbFwiO1xuaW1wb3J0IFNldHRpbmdzU3RvcmUgZnJvbSBcIi4uL3NldHRpbmdzL1NldHRpbmdzU3RvcmVcIjtcbmltcG9ydCBBc2tJbnZpdGVBbnl3YXlEaWFsb2cgZnJvbSBcIi4uL2NvbXBvbmVudHMvdmlld3MvZGlhbG9ncy9Bc2tJbnZpdGVBbnl3YXlEaWFsb2dcIjtcblxuZXhwb3J0IGVudW0gSW52aXRlU3RhdGUge1xuICAgIEludml0ZWQgPSBcImludml0ZWRcIixcbiAgICBFcnJvciA9IFwiZXJyb3JcIixcbn1cblxuaW50ZXJmYWNlIElFcnJvciB7XG4gICAgZXJyb3JUZXh0OiBzdHJpbmc7XG4gICAgZXJyY29kZTogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgVU5LTk9XTl9QUk9GSUxFX0VSUk9SUyA9IFtcbiAgICBcIk1fTk9UX0ZPVU5EXCIsXG4gICAgXCJNX1VTRVJfTk9UX0ZPVU5EXCIsXG4gICAgXCJNX1BST0ZJTEVfVU5ESVNDTE9TRURcIixcbiAgICBcIk1fUFJPRklMRV9OT1RfRk9VTkRcIixcbl07XG5cbmV4cG9ydCB0eXBlIENvbXBsZXRpb25TdGF0ZXMgPSBSZWNvcmQ8c3RyaW5nLCBJbnZpdGVTdGF0ZT47XG5cbmNvbnN0IFVTRVJfQUxSRUFEWV9KT0lORUQgPSBcIklPLkVMRU1FTlQuQUxSRUFEWV9KT0lORURcIjtcbmNvbnN0IFVTRVJfQUxSRUFEWV9JTlZJVEVEID0gXCJJTy5FTEVNRU5ULkFMUkVBRFlfSU5WSVRFRFwiO1xuXG4vKipcbiAqIEludml0ZXMgbXVsdGlwbGUgYWRkcmVzc2VzIHRvIGEgcm9vbSwgaGFuZGxpbmcgcmF0ZSBsaW1pdGluZyBmcm9tIHRoZSBzZXJ2ZXJcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTXVsdGlJbnZpdGVyIHtcbiAgICBwcml2YXRlIGNhbmNlbGVkID0gZmFsc2U7XG4gICAgcHJpdmF0ZSBhZGRyZXNzZXM6IHN0cmluZ1tdID0gW107XG4gICAgcHJpdmF0ZSBidXN5ID0gZmFsc2U7XG4gICAgcHJpdmF0ZSBfZmF0YWwgPSBmYWxzZTtcbiAgICBwcml2YXRlIGNvbXBsZXRpb25TdGF0ZXM6IENvbXBsZXRpb25TdGF0ZXMgPSB7fTsgLy8gU3RhdGUgb2YgZWFjaCBhZGRyZXNzIChpbnZpdGVkIG9yIGVycm9yKVxuICAgIHByaXZhdGUgZXJyb3JzOiBSZWNvcmQ8c3RyaW5nLCBJRXJyb3I+ID0ge307IC8vIHsgYWRkcmVzczoge2Vycm9yVGV4dCwgZXJyY29kZX0gfVxuICAgIHByaXZhdGUgZGVmZXJyZWQ6IElEZWZlcnJlZDxDb21wbGV0aW9uU3RhdGVzPiB8IG51bGwgPSBudWxsO1xuICAgIHByaXZhdGUgcmVhc29uOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0gbWF0cml4Q2xpZW50IHRoZSBjbGllbnQgb2YgdGhlIGxvZ2dlZCBpbiB1c2VyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHJvb21JZCBUaGUgSUQgb2YgdGhlIHJvb20gdG8gaW52aXRlIHRvXG4gICAgICogQHBhcmFtIHtmdW5jdGlvbn0gcHJvZ3Jlc3NDYWxsYmFjayBvcHRpb25hbCBjYWxsYmFjaywgZmlyZWQgYWZ0ZXIgZWFjaCBpbnZpdGUuXG4gICAgICovXG4gICAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgICAgICBwcml2YXRlIHJlYWRvbmx5IG1hdHJpeENsaWVudDogTWF0cml4Q2xpZW50LFxuICAgICAgICBwcml2YXRlIHJvb21JZDogc3RyaW5nLFxuICAgICAgICBwcml2YXRlIHJlYWRvbmx5IHByb2dyZXNzQ2FsbGJhY2s/OiAoKSA9PiB2b2lkLFxuICAgICkge31cblxuICAgIHB1YmxpYyBnZXQgZmF0YWwoKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB0aGlzLl9mYXRhbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnZpdGUgdXNlcnMgdG8gdGhpcyByb29tLiBUaGlzIG1heSBvbmx5IGJlIGNhbGxlZCBvbmNlIHBlclxuICAgICAqIGluc3RhbmNlIG9mIHRoZSBjbGFzcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7YXJyYXl9IGFkZHJlc3NlcyBBcnJheSBvZiBhZGRyZXNzZXMgdG8gaW52aXRlXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHJlYXNvbiBSZWFzb24gZm9yIGludml0aW5nIChvcHRpb25hbClcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHNlbmRTaGFyZWRIaXN0b3J5S2V5cyB3aGV0aGVyIHRvIHNoYXJlIGUyZWUga2V5cyB3aXRoIHRoZSBpbnZpdGVlcyBpZiBhcHBsaWNhYmxlLlxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlfSBSZXNvbHZlZCB3aGVuIGFsbCBpbnZpdGF0aW9ucyBpbiB0aGUgcXVldWUgYXJlIGNvbXBsZXRlXG4gICAgICovXG4gICAgcHVibGljIGludml0ZShhZGRyZXNzZXM6IHN0cmluZ1tdLCByZWFzb24/OiBzdHJpbmcsIHNlbmRTaGFyZWRIaXN0b3J5S2V5cyA9IGZhbHNlKTogUHJvbWlzZTxDb21wbGV0aW9uU3RhdGVzPiB7XG4gICAgICAgIGlmICh0aGlzLmFkZHJlc3Nlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJBbHJlYWR5IGludml0aW5nL2ludml0ZWRcIik7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5hZGRyZXNzZXMucHVzaCguLi5hZGRyZXNzZXMpO1xuICAgICAgICB0aGlzLnJlYXNvbiA9IHJlYXNvbjtcblxuICAgICAgICBmb3IgKGNvbnN0IGFkZHIgb2YgdGhpcy5hZGRyZXNzZXMpIHtcbiAgICAgICAgICAgIGlmIChnZXRBZGRyZXNzVHlwZShhZGRyKSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuY29tcGxldGlvblN0YXRlc1thZGRyXSA9IEludml0ZVN0YXRlLkVycm9yO1xuICAgICAgICAgICAgICAgIHRoaXMuZXJyb3JzW2FkZHJdID0ge1xuICAgICAgICAgICAgICAgICAgICBlcnJjb2RlOiBcIk1fSU5WQUxJRFwiLFxuICAgICAgICAgICAgICAgICAgICBlcnJvclRleHQ6IF90KFwiVW5yZWNvZ25pc2VkIGFkZHJlc3NcIiksXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLmRlZmVycmVkID0gZGVmZXI8Q29tcGxldGlvblN0YXRlcz4oKTtcbiAgICAgICAgdGhpcy5pbnZpdGVNb3JlKDApO1xuXG4gICAgICAgIGlmICghc2VuZFNoYXJlZEhpc3RvcnlLZXlzIHx8ICF0aGlzLnJvb21JZCB8fCAhdGhpcy5tYXRyaXhDbGllbnQuaXNSb29tRW5jcnlwdGVkKHRoaXMucm9vbUlkKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVmZXJyZWQucHJvbWlzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJvb20gPSB0aGlzLm1hdHJpeENsaWVudC5nZXRSb29tKHRoaXMucm9vbUlkKTtcbiAgICAgICAgY29uc3QgdmlzaWJpbGl0eUV2ZW50ID0gcm9vbT8uY3VycmVudFN0YXRlLmdldFN0YXRlRXZlbnRzKEV2ZW50VHlwZS5Sb29tSGlzdG9yeVZpc2liaWxpdHksIFwiXCIpO1xuICAgICAgICBjb25zdCB2aXNpYmlsaXR5ID0gdmlzaWJpbGl0eUV2ZW50Py5nZXRDb250ZW50KCkuaGlzdG9yeV92aXNpYmlsaXR5O1xuXG4gICAgICAgIGlmICh2aXNpYmlsaXR5ICE9PSBIaXN0b3J5VmlzaWJpbGl0eS5Xb3JsZFJlYWRhYmxlICYmIHZpc2liaWxpdHkgIT09IEhpc3RvcnlWaXNpYmlsaXR5LlNoYXJlZCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVmZXJyZWQucHJvbWlzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLmRlZmVycmVkLnByb21pc2UudGhlbihhc3luYyAoc3RhdGVzKTogUHJvbWlzZTxDb21wbGV0aW9uU3RhdGVzPiA9PiB7XG4gICAgICAgICAgICBjb25zdCBpbnZpdGVkVXNlcnM6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgICBmb3IgKGNvbnN0IFthZGRyLCBzdGF0ZV0gb2YgT2JqZWN0LmVudHJpZXMoc3RhdGVzKSkge1xuICAgICAgICAgICAgICAgIGlmIChzdGF0ZSA9PT0gSW52aXRlU3RhdGUuSW52aXRlZCAmJiBnZXRBZGRyZXNzVHlwZShhZGRyKSA9PT0gQWRkcmVzc1R5cGUuTWF0cml4VXNlcklkKSB7XG4gICAgICAgICAgICAgICAgICAgIGludml0ZWRVc2Vycy5wdXNoKGFkZHIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbG9nZ2VyLmxvZyhcIlNoYXJpbmcgaGlzdG9yeSB3aXRoXCIsIGludml0ZWRVc2Vycyk7XG4gICAgICAgICAgICB0aGlzLm1hdHJpeENsaWVudC5zZW5kU2hhcmVkSGlzdG9yeUtleXModGhpcy5yb29tSWQsIGludml0ZWRVc2Vycyk7IC8vIGRvIHRoaXMgaW4gdGhlIGJhY2tncm91bmRcblxuICAgICAgICAgICAgcmV0dXJuIHN0YXRlcztcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RvcHMgaW52aXRpbmcuIENhdXNlcyBwcm9taXNlcyByZXR1cm5lZCBieSBpbnZpdGUoKSB0byBiZSByZWplY3RlZC5cbiAgICAgKi9cbiAgICBwdWJsaWMgY2FuY2VsKCk6IHZvaWQge1xuICAgICAgICBpZiAoIXRoaXMuYnVzeSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuY2FuY2VsZWQgPSB0cnVlO1xuICAgICAgICB0aGlzLmRlZmVycmVkPy5yZWplY3QobmV3IEVycm9yKFwiY2FuY2VsZWRcIikpO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXRDb21wbGV0aW9uU3RhdGUoYWRkcjogc3RyaW5nKTogSW52aXRlU3RhdGUge1xuICAgICAgICByZXR1cm4gdGhpcy5jb21wbGV0aW9uU3RhdGVzW2FkZHJdO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXRFcnJvclRleHQoYWRkcjogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgICAgIHJldHVybiB0aGlzLmVycm9yc1thZGRyXT8uZXJyb3JUZXh0ID8/IG51bGw7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBpbnZpdGVUb1Jvb20ocm9vbUlkOiBzdHJpbmcsIGFkZHI6IHN0cmluZywgaWdub3JlUHJvZmlsZSA9IGZhbHNlKTogUHJvbWlzZTx7fT4ge1xuICAgICAgICBjb25zdCBhZGRyVHlwZSA9IGdldEFkZHJlc3NUeXBlKGFkZHIpO1xuXG4gICAgICAgIGlmIChhZGRyVHlwZSA9PT0gQWRkcmVzc1R5cGUuRW1haWwpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm1hdHJpeENsaWVudC5pbnZpdGVCeUVtYWlsKHJvb21JZCwgYWRkcik7XG4gICAgICAgIH0gZWxzZSBpZiAoYWRkclR5cGUgPT09IEFkZHJlc3NUeXBlLk1hdHJpeFVzZXJJZCkge1xuICAgICAgICAgICAgY29uc3Qgcm9vbSA9IHRoaXMubWF0cml4Q2xpZW50LmdldFJvb20ocm9vbUlkKTtcbiAgICAgICAgICAgIGlmICghcm9vbSkgdGhyb3cgbmV3IEVycm9yKFwiUm9vbSBub3QgZm91bmRcIik7XG5cbiAgICAgICAgICAgIGNvbnN0IG1lbWJlciA9IHJvb20uZ2V0TWVtYmVyKGFkZHIpO1xuICAgICAgICAgICAgaWYgKG1lbWJlcj8ubWVtYmVyc2hpcCA9PT0gXCJqb2luXCIpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgTWF0cml4RXJyb3Ioe1xuICAgICAgICAgICAgICAgICAgICBlcnJjb2RlOiBVU0VSX0FMUkVBRFlfSk9JTkVELFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogXCJNZW1iZXIgYWxyZWFkeSBqb2luZWRcIixcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAobWVtYmVyPy5tZW1iZXJzaGlwID09PSBcImludml0ZVwiKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IE1hdHJpeEVycm9yKHtcbiAgICAgICAgICAgICAgICAgICAgZXJyY29kZTogVVNFUl9BTFJFQURZX0lOVklURUQsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBcIk1lbWJlciBhbHJlYWR5IGludml0ZWRcIixcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFpZ25vcmVQcm9maWxlICYmIFNldHRpbmdzU3RvcmUuZ2V0VmFsdWUoXCJwcm9tcHRCZWZvcmVJbnZpdGVVbmtub3duVXNlcnNcIiwgdGhpcy5yb29tSWQpKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5tYXRyaXhDbGllbnQuZ2V0UHJvZmlsZUluZm8oYWRkcik7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFRoZSBlcnJvciBoYW5kbGluZyBkdXJpbmcgdGhlIGludml0YXRpb24gcHJvY2VzcyBjb3ZlcnMgYW55IEFQSS5cbiAgICAgICAgICAgICAgICAgICAgLy8gU29tZSBlcnJvcnMgbXVzdCB0byBtZSBtYXBwZWQgZnJvbSBwcm9maWxlIEFQSSBlcnJvcnMgdG8gbW9yZSBzcGVjaWZpYyBvbmVzIHRvIGF2b2lkIGNvbGxpc2lvbnMuXG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaCAoZXJyLmVycmNvZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgXCJNX0ZPUkJJRERFTlwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBNYXRyaXhFcnJvcih7IGVycmNvZGU6IFwiTV9QUk9GSUxFX1VORElTQ0xPU0VEXCIgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlIFwiTV9OT1RfRk9VTkRcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgTWF0cml4RXJyb3IoeyBlcnJjb2RlOiBcIk1fVVNFUl9OT1RfRk9VTkRcIiB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5tYXRyaXhDbGllbnQuaW52aXRlKHJvb21JZCwgYWRkciwgdGhpcy5yZWFzb24pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5zdXBwb3J0ZWQgYWRkcmVzc1wiKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgZG9JbnZpdGUoYWRkcmVzczogc3RyaW5nLCBpZ25vcmVQcm9maWxlID0gZmFsc2UpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIGxvZ2dlci5sb2coYEludml0aW5nICR7YWRkcmVzc31gKTtcblxuICAgICAgICAgICAgY29uc3QgZG9JbnZpdGUgPSB0aGlzLmludml0ZVRvUm9vbSh0aGlzLnJvb21JZCwgYWRkcmVzcywgaWdub3JlUHJvZmlsZSk7XG4gICAgICAgICAgICBkb0ludml0ZVxuICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuY2FuY2VsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29tcGxldGlvblN0YXRlc1thZGRyZXNzXSA9IEludml0ZVN0YXRlLkludml0ZWQ7XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmVycm9yc1thZGRyZXNzXTtcblxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucHJvZ3Jlc3NDYWxsYmFjaz8uKCk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5jYW5jZWxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLmVycm9yKGVycik7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNTcGFjZSA9IHRoaXMucm9vbUlkICYmIHRoaXMubWF0cml4Q2xpZW50LmdldFJvb20odGhpcy5yb29tSWQpPy5pc1NwYWNlUm9vbSgpO1xuXG4gICAgICAgICAgICAgICAgICAgIGxldCBlcnJvclRleHQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGZhdGFsID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaCAoZXJyLmVycmNvZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgXCJNX0ZPUkJJRERFTlwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc1NwYWNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yVGV4dCA9IF90KFwiWW91IGRvIG5vdCBoYXZlIHBlcm1pc3Npb24gdG8gaW52aXRlIHBlb3BsZSB0byB0aGlzIHNwYWNlLlwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvclRleHQgPSBfdChcIllvdSBkbyBub3QgaGF2ZSBwZXJtaXNzaW9uIHRvIGludml0ZSBwZW9wbGUgdG8gdGhpcyByb29tLlwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmF0YWwgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBVU0VSX0FMUkVBRFlfSU5WSVRFRDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNTcGFjZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvclRleHQgPSBfdChcIlVzZXIgaXMgYWxyZWFkeSBpbnZpdGVkIHRvIHRoZSBzcGFjZVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvclRleHQgPSBfdChcIlVzZXIgaXMgYWxyZWFkeSBpbnZpdGVkIHRvIHRoZSByb29tXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgVVNFUl9BTFJFQURZX0pPSU5FRDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNTcGFjZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvclRleHQgPSBfdChcIlVzZXIgaXMgYWxyZWFkeSBpbiB0aGUgc3BhY2VcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JUZXh0ID0gX3QoXCJVc2VyIGlzIGFscmVhZHkgaW4gdGhlIHJvb21cIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBcIk1fTElNSVRfRVhDRUVERURcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB3ZSdyZSBiZWluZyB0aHJvdHRsZWQgc28gd2FpdCBhIGJpdCAmIHRyeSBhZ2FpblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kb0ludml0ZShhZGRyZXNzLCBpZ25vcmVQcm9maWxlKS50aGVuKHJlc29sdmUsIHJlamVjdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgNTAwMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBcIk1fTk9UX0ZPVU5EXCI6XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlIFwiTV9VU0VSX05PVF9GT1VORFwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yVGV4dCA9IF90KFwiVXNlciBkb2VzIG5vdCBleGlzdFwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgXCJNX1BST0ZJTEVfVU5ESVNDTE9TRURcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvclRleHQgPSBfdChcIlVzZXIgbWF5IG9yIG1heSBub3QgZXhpc3RcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlIFwiTV9QUk9GSUxFX05PVF9GT1VORFwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghaWdub3JlUHJvZmlsZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBJbnZpdGUgd2l0aG91dCB0aGUgcHJvZmlsZSBjaGVja1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2dnZXIud2FybihgVXNlciAke2FkZHJlc3N9IGRvZXMgbm90IGhhdmUgYSBwcm9maWxlIC0gaW52aXRpbmcgYW55d2F5cyBhdXRvbWF0aWNhbGx5YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZG9JbnZpdGUoYWRkcmVzcywgdHJ1ZSkudGhlbihyZXNvbHZlLCByZWplY3QpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBcIk1fQkFEX1NUQVRFXCI6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JUZXh0ID0gX3QoXCJUaGUgdXNlciBtdXN0IGJlIHVuYmFubmVkIGJlZm9yZSB0aGV5IGNhbiBiZSBpbnZpdGVkLlwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgXCJNX1VOU1VQUE9SVEVEX1JPT01fVkVSU0lPTlwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc1NwYWNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yVGV4dCA9IF90KFwiVGhlIHVzZXIncyBob21lc2VydmVyIGRvZXMgbm90IHN1cHBvcnQgdGhlIHZlcnNpb24gb2YgdGhlIHNwYWNlLlwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvclRleHQgPSBfdChcIlRoZSB1c2VyJ3MgaG9tZXNlcnZlciBkb2VzIG5vdCBzdXBwb3J0IHRoZSB2ZXJzaW9uIG9mIHRoZSByb29tLlwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlIFwiT1JHLk1BVFJJWC5KU1NES19NSVNTSU5HX1BBUkFNXCI6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGdldEFkZHJlc3NUeXBlKGFkZHJlc3MpID09PSBBZGRyZXNzVHlwZS5FbWFpbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvclRleHQgPSBfdChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiQ2Fubm90IGludml0ZSB1c2VyIGJ5IGVtYWlsIHdpdGhvdXQgYW4gaWRlbnRpdHkgc2VydmVyLiBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1lvdSBjYW4gY29ubmVjdCB0byBvbmUgdW5kZXIgXCJTZXR0aW5nc1wiLicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnJvclRleHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yVGV4dCA9IF90KFwiVW5rbm93biBzZXJ2ZXIgZXJyb3JcIik7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbXBsZXRpb25TdGF0ZXNbYWRkcmVzc10gPSBJbnZpdGVTdGF0ZS5FcnJvcjtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lcnJvcnNbYWRkcmVzc10gPSB7IGVycm9yVGV4dCwgZXJyY29kZTogZXJyLmVycmNvZGUgfTtcblxuICAgICAgICAgICAgICAgICAgICB0aGlzLmJ1c3kgPSAhZmF0YWw7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2ZhdGFsID0gZmF0YWw7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGZhdGFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGludml0ZU1vcmUobmV4dEluZGV4OiBudW1iZXIsIGlnbm9yZVByb2ZpbGUgPSBmYWxzZSk6IHZvaWQge1xuICAgICAgICBpZiAodGhpcy5jYW5jZWxlZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5leHRJbmRleCA9PT0gdGhpcy5hZGRyZXNzZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aGlzLmJ1c3kgPSBmYWxzZTtcbiAgICAgICAgICAgIGlmIChPYmplY3Qua2V5cyh0aGlzLmVycm9ycykubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIC8vIFRoZXJlIHdlcmUgcHJvYmxlbXMgaW52aXRpbmcgc29tZSBwZW9wbGUgLSBzZWUgaWYgd2UgY2FuIGludml0ZSB0aGVtXG4gICAgICAgICAgICAgICAgLy8gd2l0aG91dCBjYXJpbmcgaWYgdGhleSBleGlzdCBvciBub3QuXG4gICAgICAgICAgICAgICAgY29uc3QgdW5rbm93blByb2ZpbGVVc2VycyA9IE9iamVjdC5rZXlzKHRoaXMuZXJyb3JzKS5maWx0ZXIoKGEpID0+XG4gICAgICAgICAgICAgICAgICAgIFVOS05PV05fUFJPRklMRV9FUlJPUlMuaW5jbHVkZXModGhpcy5lcnJvcnNbYV0uZXJyY29kZSksXG4gICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICAgIGlmICh1bmtub3duUHJvZmlsZVVzZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW52aXRlVW5rbm93bnMgPSAoKTogdm9pZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwcm9taXNlcyA9IHVua25vd25Qcm9maWxlVXNlcnMubWFwKCh1KSA9PiB0aGlzLmRvSW52aXRlKHUsIHRydWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFByb21pc2UuYWxsKHByb21pc2VzKS50aGVuKCgpID0+IHRoaXMuZGVmZXJyZWQ/LnJlc29sdmUodGhpcy5jb21wbGV0aW9uU3RhdGVzKSk7XG4gICAgICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFTZXR0aW5nc1N0b3JlLmdldFZhbHVlKFwicHJvbXB0QmVmb3JlSW52aXRlVW5rbm93blVzZXJzXCIsIHRoaXMucm9vbUlkKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW52aXRlVW5rbm93bnMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coXCJTaG93aW5nIGZhaWxlZCB0byBpbnZpdGUgZGlhbG9nLi4uXCIpO1xuICAgICAgICAgICAgICAgICAgICBNb2RhbC5jcmVhdGVEaWFsb2coQXNrSW52aXRlQW55d2F5RGlhbG9nLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1bmtub3duUHJvZmlsZVVzZXJzOiB1bmtub3duUHJvZmlsZVVzZXJzLm1hcCgodSkgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1c2VySWQ6IHUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JUZXh0OiB0aGlzLmVycm9yc1t1XS5lcnJvclRleHQsXG4gICAgICAgICAgICAgICAgICAgICAgICB9KSksXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkludml0ZUFueXdheXM6ICgpID0+IGludml0ZVVua25vd25zKCksXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkdpdmVVcDogKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZha2UgYWxsIHRoZSBjb21wbGV0aW9uIHN0YXRlcyBiZWNhdXNlIHdlIGFscmVhZHkgd2FybmVkIHRoZSB1c2VyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBhZGRyIG9mIHVua25vd25Qcm9maWxlVXNlcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jb21wbGV0aW9uU3RhdGVzW2FkZHJdID0gSW52aXRlU3RhdGUuSW52aXRlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZlcnJlZD8ucmVzb2x2ZSh0aGlzLmNvbXBsZXRpb25TdGF0ZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmRlZmVycmVkPy5yZXNvbHZlKHRoaXMuY29tcGxldGlvblN0YXRlcyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhZGRyID0gdGhpcy5hZGRyZXNzZXNbbmV4dEluZGV4XTtcblxuICAgICAgICAvLyBkb24ndCB0cnkgdG8gaW52aXRlIGl0IGlmIGl0J3MgYW4gaW52YWxpZCBhZGRyZXNzXG4gICAgICAgIC8vIChpdCB3aWxsIGFscmVhZHkgYmUgbWFya2VkIGFzIGFuIGVycm9yIHRob3VnaCxcbiAgICAgICAgLy8gc28gbm8gbmVlZCB0byBkbyBzbyBhZ2FpbilcbiAgICAgICAgaWYgKGdldEFkZHJlc3NUeXBlKGFkZHIpID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLmludml0ZU1vcmUobmV4dEluZGV4ICsgMSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBkb24ndCByZS1pbnZpdGUgKHRoZXJlJ3Mgbm8gd2F5IGluIHRoZSBVSSB0byBkbyB0aGlzLCBidXRcbiAgICAgICAgLy8gZm9yIHNhbml0eSdzIHNha2UpXG4gICAgICAgIGlmICh0aGlzLmNvbXBsZXRpb25TdGF0ZXNbYWRkcl0gPT09IEludml0ZVN0YXRlLkludml0ZWQpIHtcbiAgICAgICAgICAgIHRoaXMuaW52aXRlTW9yZShuZXh0SW5kZXggKyAxKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZG9JbnZpdGUoYWRkciwgaWdub3JlUHJvZmlsZSlcbiAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmludml0ZU1vcmUobmV4dEluZGV4ICsgMSwgaWdub3JlUHJvZmlsZSk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmNhdGNoKCgpID0+IHRoaXMuZGVmZXJyZWQ/LnJlc29sdmUodGhpcy5jb21wbGV0aW9uU3RhdGVzKSk7XG4gICAgfVxufVxuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQWdCQSxJQUFBQSxRQUFBLEdBQUFDLE9BQUE7QUFDQSxJQUFBQyxNQUFBLEdBQUFELE9BQUE7QUFDQSxJQUFBRSxPQUFBLEdBQUFGLE9BQUE7QUFFQSxJQUFBRyxNQUFBLEdBQUFILE9BQUE7QUFDQSxJQUFBSSxTQUFBLEdBQUFKLE9BQUE7QUFFQSxJQUFBSyxZQUFBLEdBQUFMLE9BQUE7QUFDQSxJQUFBTSxnQkFBQSxHQUFBTixPQUFBO0FBQ0EsSUFBQU8sTUFBQSxHQUFBQyxzQkFBQSxDQUFBUixPQUFBO0FBQ0EsSUFBQVMsY0FBQSxHQUFBRCxzQkFBQSxDQUFBUixPQUFBO0FBQ0EsSUFBQVUsc0JBQUEsR0FBQUYsc0JBQUEsQ0FBQVIsT0FBQTtBQTNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFkQSxJQTZCWVcsV0FBVywwQkFBWEEsV0FBVztFQUFYQSxXQUFXO0VBQVhBLFdBQVc7RUFBQSxPQUFYQSxXQUFXO0FBQUE7QUFBQUMsT0FBQSxDQUFBRCxXQUFBLEdBQUFBLFdBQUE7QUFVaEIsTUFBTUUsc0JBQXNCLEdBQUcsQ0FD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