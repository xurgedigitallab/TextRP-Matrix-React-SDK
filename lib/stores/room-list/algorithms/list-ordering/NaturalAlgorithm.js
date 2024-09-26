"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.NaturalAlgorithm = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _logger = require("matrix-js-sdk/src/logger");
var _tagSorting = require("../tag-sorting");
var _OrderingAlgorithm = require("./OrderingAlgorithm");
var _models = require("../../models");
var _RoomNotificationStateStore = require("../../../notifications/RoomNotificationStateStore");
/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
 * Uses the natural tag sorting algorithm order to determine tag ordering. No
 * additional behavioural changes are present.
 */
class NaturalAlgorithm extends _OrderingAlgorithm.OrderingAlgorithm {
  constructor(tagId, initialSortingAlgorithm) {
    super(tagId, initialSortingAlgorithm);
    (0, _defineProperty2.default)(this, "cachedCategorizedOrderedRooms", {
      defaultRooms: [],
      mutedRooms: []
    });
  }
  setRooms(rooms) {
    const {
      defaultRooms,
      mutedRooms
    } = this.categorizeRooms(rooms);
    this.cachedCategorizedOrderedRooms = {
      defaultRooms: (0, _tagSorting.sortRoomsWithAlgorithm)(defaultRooms, this.tagId, this.sortingAlgorithm),
      mutedRooms: (0, _tagSorting.sortRoomsWithAlgorithm)(mutedRooms, this.tagId, this.sortingAlgorithm)
    };
    this.buildCachedOrderedRooms();
  }
  handleRoomUpdate(room, cause) {
    const isSplice = cause === _models.RoomUpdateCause.NewRoom || cause === _models.RoomUpdateCause.RoomRemoved;
    const isInPlace = cause === _models.RoomUpdateCause.Timeline || cause === _models.RoomUpdateCause.ReadReceipt || cause === _models.RoomUpdateCause.PossibleMuteChange;
    const isMuted = this.isMutedToBottom && this.getRoomIsMuted(room);
    if (!isSplice && !isInPlace) {
      throw new Error(`Unsupported update cause: ${cause}`);
    }
    if (cause === _models.RoomUpdateCause.NewRoom) {
      if (isMuted) {
        this.cachedCategorizedOrderedRooms.mutedRooms = (0, _tagSorting.sortRoomsWithAlgorithm)([...this.cachedCategorizedOrderedRooms.mutedRooms, room], this.tagId, this.sortingAlgorithm);
      } else {
        this.cachedCategorizedOrderedRooms.defaultRooms = (0, _tagSorting.sortRoomsWithAlgorithm)([...this.cachedCategorizedOrderedRooms.defaultRooms, room], this.tagId, this.sortingAlgorithm);
      }
      this.buildCachedOrderedRooms();
      return true;
    } else if (cause === _models.RoomUpdateCause.RoomRemoved) {
      return this.removeRoom(room);
    } else if (cause === _models.RoomUpdateCause.PossibleMuteChange) {
      if (this.isMutedToBottom) {
        return this.onPossibleMuteChange(room);
      } else {
        return false;
      }
    }

    // TODO: Optimize this to avoid useless operations: https://github.com/vector-im/element-web/issues/14457
    // For example, we can skip updates to alphabetic (sometimes) and manually ordered tags
    if (isMuted) {
      this.cachedCategorizedOrderedRooms.mutedRooms = (0, _tagSorting.sortRoomsWithAlgorithm)(this.cachedCategorizedOrderedRooms.mutedRooms, this.tagId, this.sortingAlgorithm);
    } else {
      this.cachedCategorizedOrderedRooms.defaultRooms = (0, _tagSorting.sortRoomsWithAlgorithm)(this.cachedCategorizedOrderedRooms.defaultRooms, this.tagId, this.sortingAlgorithm);
    }
    this.buildCachedOrderedRooms();
    return true;
  }

  /**
   * Remove a room from the cached room list
   * @param room Room to remove
   * @returns {boolean} true when room list should update as result
   */
  removeRoom(room) {
    const defaultIndex = this.cachedCategorizedOrderedRooms.defaultRooms.findIndex(r => r.roomId === room.roomId);
    if (defaultIndex > -1) {
      this.cachedCategorizedOrderedRooms.defaultRooms.splice(defaultIndex, 1);
      this.buildCachedOrderedRooms();
      return true;
    }
    const mutedIndex = this.cachedCategorizedOrderedRooms.mutedRooms.findIndex(r => r.roomId === room.roomId);
    if (mutedIndex > -1) {
      this.cachedCategorizedOrderedRooms.mutedRooms.splice(mutedIndex, 1);
      this.buildCachedOrderedRooms();
      return true;
    }
    _logger.logger.warn(`Tried to remove unknown room from ${this.tagId}: ${room.roomId}`);
    // room was not in cached lists, no update
    return false;
  }

  /**
   * Sets cachedOrderedRooms from cachedCategorizedOrderedRooms
   */
  buildCachedOrderedRooms() {
    this.cachedOrderedRooms = [...this.cachedCategorizedOrderedRooms.defaultRooms, ...this.cachedCategorizedOrderedRooms.mutedRooms];
  }
  getRoomIsMuted(room) {
    // It's fine for us to call this a lot because it's cached, and we shouldn't be
    // wasting anything by doing so as the store holds single references
    const state = _RoomNotificationStateStore.RoomNotificationStateStore.instance.getRoomState(room);
    return state.muted;
  }
  categorizeRooms(rooms) {
    if (!this.isMutedToBottom) {
      return {
        defaultRooms: rooms,
        mutedRooms: []
      };
    }
    return rooms.reduce((acc, room) => {
      if (this.getRoomIsMuted(room)) {
        acc.mutedRooms.push(room);
      } else {
        acc.defaultRooms.push(room);
      }
      return acc;
    }, {
      defaultRooms: [],
      mutedRooms: []
    });
  }
  onPossibleMuteChange(room) {
    const isMuted = this.getRoomIsMuted(room);
    if (isMuted) {
      const defaultIndex = this.cachedCategorizedOrderedRooms.defaultRooms.findIndex(r => r.roomId === room.roomId);

      // room has been muted
      if (defaultIndex > -1) {
        // remove from the default list
        this.cachedCategorizedOrderedRooms.defaultRooms.splice(defaultIndex, 1);
        // add to muted list and reorder
        this.cachedCategorizedOrderedRooms.mutedRooms = (0, _tagSorting.sortRoomsWithAlgorithm)([...this.cachedCategorizedOrderedRooms.mutedRooms, room], this.tagId, this.sortingAlgorithm);
        // rebuild
        this.buildCachedOrderedRooms();
        return true;
      }
    } else {
      const mutedIndex = this.cachedCategorizedOrderedRooms.mutedRooms.findIndex(r => r.roomId === room.roomId);

      // room has been unmuted
      if (mutedIndex > -1) {
        // remove from the muted list
        this.cachedCategorizedOrderedRooms.mutedRooms.splice(mutedIndex, 1);
        // add to default list and reorder
        this.cachedCategorizedOrderedRooms.defaultRooms = (0, _tagSorting.sortRoomsWithAlgorithm)([...this.cachedCategorizedOrderedRooms.defaultRooms, room], this.tagId, this.sortingAlgorithm);
        // rebuild
        this.buildCachedOrderedRooms();
        return true;
      }
    }
    return false;
  }
}
exports.NaturalAlgorithm = NaturalAlgorithm;
//# sourceMappingURL=NaturalAlgorithm.js.map