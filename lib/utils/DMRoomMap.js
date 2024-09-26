"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _lodash = require("lodash");
var _client = require("matrix-js-sdk/src/client");
var _logger = require("matrix-js-sdk/src/logger");
var _event = require("matrix-js-sdk/src/@types/event");
var _filterValidMDirect = require("./dm/filterValidMDirect");
/*
Copyright 2016, 2019, 2021 The Matrix.org Foundation C.I.C.

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
 * Class that takes a Matrix Client and flips the m.direct map
 * so the operation of mapping a room ID to which user it's a DM
 * with can be performed efficiently.
 *
 * With 'start', this can also keep itself up to date over time.
 */
class DMRoomMap {
  constructor(matrixClient) {
    this.matrixClient = matrixClient;
    // TODO: convert these to maps
    (0, _defineProperty2.default)(this, "roomToUser", null);
    (0, _defineProperty2.default)(this, "userToRooms", null);
    (0, _defineProperty2.default)(this, "hasSentOutPatchDirectAccountDataPatch", void 0);
    (0, _defineProperty2.default)(this, "mDirectEvent", void 0);
    (0, _defineProperty2.default)(this, "onAccountData", ev => {
      if (ev.getType() == _event.EventType.Direct) {
        this.setMDirectFromContent(ev.getContent());
        this.userToRooms = null;
        this.roomToUser = null;
      }
    });
    // see onAccountData
    this.hasSentOutPatchDirectAccountDataPatch = false;
    const mDirectRawContent = matrixClient.getAccountData(_event.EventType.Direct)?.getContent() ?? {};
    this.setMDirectFromContent(mDirectRawContent);
  }

  /**
   * Makes and returns a new shared instance that can then be accessed
   * with shared(). This returned instance is not automatically started.
   */
  static makeShared(matrixClient) {
    DMRoomMap.sharedInstance = new DMRoomMap(matrixClient);
    return DMRoomMap.sharedInstance;
  }

  /**
   * Set the shared instance to the instance supplied
   * Used by tests
   * @param inst the new shared instance
   */
  static setShared(inst) {
    DMRoomMap.sharedInstance = inst;
  }

  /**
   * Returns a shared instance of the class
   * that uses the singleton matrix client
   * The shared instance must be started before use.
   */
  static shared() {
    return DMRoomMap.sharedInstance;
  }
  start() {
    this.populateRoomToUser();
    this.matrixClient.on(_client.ClientEvent.AccountData, this.onAccountData);
  }
  stop() {
    this.matrixClient.removeListener(_client.ClientEvent.AccountData, this.onAccountData);
  }

  /**
   * Filter m.direct content to contain only valid data and then sets it.
   * Logs if invalid m.direct content occurs.
   * {@link filterValidMDirect}
   *
   * @param content - Raw m.direct content
   */
  setMDirectFromContent(content) {
    const {
      valid,
      filteredContent
    } = (0, _filterValidMDirect.filterValidMDirect)(content);
    if (!valid) {
      _logger.logger.warn("Invalid m.direct content occurred", content);
    }
    this.mDirectEvent = filteredContent;
  }
  /**
   * some client bug somewhere is causing some DMs to be marked
   * with ourself, not the other user. Fix it by guessing the other user and
   * modifying userToRooms
   */
  patchUpSelfDMs(userToRooms) {
    const myUserId = this.matrixClient.getUserId();
    const selfRoomIds = userToRooms[myUserId];
    if (selfRoomIds) {
      // any self-chats that should not be self-chats?
      const guessedUserIdsThatChanged = selfRoomIds.map(roomId => {
        const room = this.matrixClient.getRoom(roomId);
        if (room) {
          const userId = room.guessDMUserId();
          if (userId && userId !== myUserId) {
            return {
              userId,
              roomId
            };
          }
        }
      }).filter(ids => !!ids); //filter out
      // these are actually all legit self-chats
      // bail out
      if (!guessedUserIdsThatChanged.length) {
        return false;
      }
      userToRooms[myUserId] = selfRoomIds.filter(roomId => {
        return !guessedUserIdsThatChanged.some(ids => ids.roomId === roomId);
      });
      guessedUserIdsThatChanged.forEach(_ref => {
        let {
          userId,
          roomId
        } = _ref;
        const roomIds = userToRooms[userId];
        if (!roomIds) {
          userToRooms[userId] = [roomId];
        } else {
          roomIds.push(roomId);
          userToRooms[userId] = (0, _lodash.uniq)(roomIds);
        }
      });
      return true;
    }
    return false;
  }
  getDMRoomsForUserId(userId) {
    // Here, we return the empty list if there are no rooms,
    // since the number of conversations you have with this user is zero.
    return this.getUserToRooms()[userId] || [];
  }

  /**
   * Gets the DM room which the given IDs share, if any.
   * @param {string[]} ids The identifiers (user IDs and email addresses) to look for.
   * @returns {Room} The DM room which all IDs given share, or falsy if no common room.
   */
  getDMRoomForIdentifiers(ids) {
    // TODO: [Canonical DMs] Handle lookups for email addresses.
    // For now we'll pretend we only get user IDs and end up returning nothing for email addresses

    let commonRooms = this.getDMRoomsForUserId(ids[0]);
    for (let i = 1; i < ids.length; i++) {
      const userRooms = this.getDMRoomsForUserId(ids[i]);
      commonRooms = commonRooms.filter(r => userRooms.includes(r));
    }
    const joinedRooms = commonRooms.map(r => this.matrixClient.getRoom(r)).filter(r => r && r.getMyMembership() === "join");
    return joinedRooms[0];
  }
  getUserIdForRoomId(roomId) {
    if (this.roomToUser == null) {
      // we lazily populate roomToUser so you can use
      // this class just to call getDMRoomsForUserId
      // which doesn't do very much, but is a fairly
      // convenient wrapper and there's no point
      // iterating through the map if getUserIdForRoomId()
      // is never called.
      this.populateRoomToUser();
    }
    // Here, we return undefined if the room is not in the map:
    // the room ID you gave is not a DM room for any user.
    if (this.roomToUser[roomId] === undefined) {
      // no entry? if the room is an invite, look for the is_direct hint.
      const room = this.matrixClient.getRoom(roomId);
      if (room) {
        return room.getDMInviter();
      }
    }
    return this.roomToUser[roomId];
  }
  getUniqueRoomsWithIndividuals() {
    if (!this.roomToUser) return {}; // No rooms means no map.
    // map roomToUser to valid rooms with two participants
    return Object.keys(this.roomToUser).reduce((acc, roomId) => {
      const userId = this.getUserIdForRoomId(roomId);
      const room = this.matrixClient.getRoom(roomId);
      const hasTwoMembers = room?.getInvitedAndJoinedMemberCount() === 2;
      if (userId && room && hasTwoMembers) {
        acc[userId] = room;
      }
      return acc;
    }, {});
  }

  /**
   * @returns all room Ids from m.direct
   */
  getRoomIds() {
    return Object.values(this.mDirectEvent).reduce((prevRoomIds, roomIds) => {
      roomIds.forEach(roomId => prevRoomIds.add(roomId));
      return prevRoomIds;
    }, new Set());
  }
  getUserToRooms() {
    if (!this.userToRooms) {
      const userToRooms = this.mDirectEvent;
      const myUserId = this.matrixClient.getUserId();
      const selfDMs = userToRooms[myUserId];
      if (selfDMs?.length) {
        const neededPatching = this.patchUpSelfDMs(userToRooms);
        // to avoid multiple devices fighting to correct
        // the account data, only try to send the corrected
        // version once.
        _logger.logger.warn(`Invalid m.direct account data detected (self-chats that shouldn't be), patching it up.`);
        if (neededPatching && !this.hasSentOutPatchDirectAccountDataPatch) {
          this.hasSentOutPatchDirectAccountDataPatch = true;
          this.matrixClient.setAccountData(_event.EventType.Direct, userToRooms);
        }
      }
      this.userToRooms = userToRooms;
    }
    return this.userToRooms;
  }
  populateRoomToUser() {
    this.roomToUser = {};
    for (const user of Object.keys(this.getUserToRooms())) {
      for (const roomId of this.userToRooms[user]) {
        this.roomToUser[roomId] = user;
      }
    }
  }
}
exports.default = DMRoomMap;
(0, _defineProperty2.default)(DMRoomMap, "sharedInstance", void 0);
//# sourceMappingURL=DMRoomMap.js.map