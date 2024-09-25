"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SlidingSyncSortToFilter = exports.SlidingRoomListStoreClass = exports.LISTS_UPDATE_EVENT = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _logger = require("matrix-js-sdk/src/logger");
var _slidingSync = require("matrix-js-sdk/src/sliding-sync");
var _models = require("./models");
var _models2 = require("./algorithms/models");
var _AsyncStoreWithClient = require("../AsyncStoreWithClient");
var _Interface = require("./Interface");
var _spaces = require("../spaces");
var _RoomListStore = require("./RoomListStore");
var _AsyncStore = require("../AsyncStore");
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

const SlidingSyncSortToFilter = {
  [_models2.SortAlgorithm.Alphabetic]: ["by_name", "by_recency"],
  [_models2.SortAlgorithm.Recent]: ["by_notification_level", "by_recency"],
  [_models2.SortAlgorithm.Manual]: ["by_recency"]
};
exports.SlidingSyncSortToFilter = SlidingSyncSortToFilter;
const filterConditions = {
  [_models.DefaultTagID.Invite]: {
    is_invite: true
  },
  [_models.DefaultTagID.Favourite]: {
    tags: ["m.favourite"]
  },
  // TODO https://github.com/vector-im/element-web/issues/23207
  // DefaultTagID.SavedItems,
  [_models.DefaultTagID.DM]: {
    is_dm: true,
    is_invite: false,
    // If a DM has a Favourite & Low Prio tag then it'll be shown in those lists instead
    not_tags: ["m.favourite", "m.lowpriority"]
  },
  [_models.DefaultTagID.Untagged]: {
    is_dm: false,
    is_invite: false,
    not_room_types: ["m.space"],
    not_tags: ["m.favourite", "m.lowpriority"]
    // spaces filter added dynamically
  },

  [_models.DefaultTagID.LowPriority]: {
    tags: ["m.lowpriority"],
    // If a room has both Favourite & Low Prio tags then it'll be shown under Favourites
    not_tags: ["m.favourite"]
  }
  // TODO https://github.com/vector-im/element-web/issues/23207
  // DefaultTagID.ServerNotice,
  // DefaultTagID.Suggested,
  // DefaultTagID.Archived,
};

const LISTS_UPDATE_EVENT = _Interface.RoomListStoreEvent.ListsUpdate;
exports.LISTS_UPDATE_EVENT = LISTS_UPDATE_EVENT;
class SlidingRoomListStoreClass extends _AsyncStoreWithClient.AsyncStoreWithClient {
  constructor(dis, context) {
    super(dis);
    this.context = context;
    (0, _defineProperty2.default)(this, "tagIdToSortAlgo", {});
    (0, _defineProperty2.default)(this, "tagMap", {});
    (0, _defineProperty2.default)(this, "counts", {});
    (0, _defineProperty2.default)(this, "stickyRoomId", void 0);
    (0, _defineProperty2.default)(this, "onSelectedSpaceUpdated", (activeSpace, allRoomsInHome) => {
      _logger.logger.info("SlidingRoomListStore.onSelectedSpaceUpdated", activeSpace);
      // update the untagged filter
      const tagId = _models.DefaultTagID.Untagged;
      const filters = filterConditions[tagId];
      const oldSpace = filters.spaces?.[0];
      filters.spaces = activeSpace && activeSpace != _spaces.MetaSpace.Home ? [activeSpace] : undefined;
      if (oldSpace !== activeSpace) {
        // include subspaces in this list
        this.context.spaceStore.traverseSpace(activeSpace, roomId => {
          if (roomId === activeSpace) {
            return;
          }
          if (!filters.spaces) {
            filters.spaces = [];
          }
          filters.spaces.push(roomId); // add subspace
        }, false);
        this.emit(_RoomListStore.LISTS_LOADING_EVENT, tagId, true);
        this.context.slidingSyncManager.ensureListRegistered(tagId, {
          filters: filters
        }).then(() => {
          this.emit(_RoomListStore.LISTS_LOADING_EVENT, tagId, false);
        });
      }
    });
    this.setMaxListeners(20); // RoomList + LeftPanel + 8xRoomSubList + spares
  }

  async setTagSorting(tagId, sort) {
    _logger.logger.info("SlidingRoomListStore.setTagSorting ", tagId, sort);
    this.tagIdToSortAlgo[tagId] = sort;
    switch (sort) {
      case _models2.SortAlgorithm.Alphabetic:
        await this.context.slidingSyncManager.ensureListRegistered(tagId, {
          sort: SlidingSyncSortToFilter[_models2.SortAlgorithm.Alphabetic]
        });
        break;
      case _models2.SortAlgorithm.Recent:
        await this.context.slidingSyncManager.ensureListRegistered(tagId, {
          sort: SlidingSyncSortToFilter[_models2.SortAlgorithm.Recent]
        });
        break;
      case _models2.SortAlgorithm.Manual:
        _logger.logger.error("cannot enable manual sort in sliding sync mode");
        break;
      default:
        _logger.logger.error("unknown sort mode: ", sort);
    }
  }
  getTagSorting(tagId) {
    let algo = this.tagIdToSortAlgo[tagId];
    if (!algo) {
      _logger.logger.warn("SlidingRoomListStore.getTagSorting: no sort algorithm for tag ", tagId);
      algo = _models2.SortAlgorithm.Recent; // why not, we have to do something..
    }

    return algo;
  }
  getCount(tagId) {
    return this.counts[tagId] || 0;
  }
  setListOrder(tagId, order) {
    // TODO: https://github.com/vector-im/element-web/issues/23207
  }
  getListOrder(tagId) {
    // TODO: handle unread msgs first? https://github.com/vector-im/element-web/issues/23207
    return _models2.ListAlgorithm.Natural;
  }

  /**
   * Adds a filter condition to the room list store. Filters may be applied async,
   * and thus might not cause an update to the store immediately.
   * @param {IFilterCondition} filter The filter condition to add.
   */
  async addFilter(filter) {
    // Do nothing, the filters are only used by SpaceWatcher to see if a room should appear
    // in the room list. We do not support arbitrary code for filters in sliding sync.
  }

  /**
   * Removes a filter condition from the room list store. If the filter was
   * not previously added to the room list store, this will no-op. The effects
   * of removing a filter may be applied async and therefore might not cause
   * an update right away.
   * @param {IFilterCondition} filter The filter condition to remove.
   */
  removeFilter(filter) {
    // Do nothing, the filters are only used by SpaceWatcher to see if a room should appear
    // in the room list. We do not support arbitrary code for filters in sliding sync.
  }

  /**
   * Gets the tags for a room identified by the store. The returned set
   * should never be empty, and will contain DefaultTagID.Untagged if
   * the store is not aware of any tags.
   * @param room The room to get the tags for.
   * @returns The tags for the room.
   */
  getTagsForRoom(room) {
    // check all lists for each tag we know about and see if the room is there
    const tags = [];
    for (const tagId in this.tagIdToSortAlgo) {
      const listData = this.context.slidingSyncManager.slidingSync.getListData(tagId);
      if (!listData) {
        continue;
      }
      for (const roomIndex in listData.roomIndexToRoomId) {
        const roomId = listData.roomIndexToRoomId[roomIndex];
        if (roomId === room.roomId) {
          tags.push(tagId);
          break;
        }
      }
    }
    return tags;
  }

  /**
   * Manually update a room with a given cause. This should only be used if the
   * room list store would otherwise be incapable of doing the update itself. Note
   * that this may race with the room list's regular operation.
   * @param {Room} room The room to update.
   * @param {RoomUpdateCause} cause The cause to update for.
   */
  async manualRoomUpdate(room, cause) {
    // TODO: this is only used when you forget a room, not that important for now.
  }
  get orderedLists() {
    return this.tagMap;
  }
  refreshOrderedLists(tagId, roomIndexToRoomId) {
    const tagMap = this.tagMap;

    // this room will not move due to it being viewed: it is sticky. This can be null to indicate
    // no sticky room if you aren't viewing a room.
    this.stickyRoomId = this.context.roomViewStore.getRoomId();
    let stickyRoomNewIndex = -1;
    const stickyRoomOldIndex = (tagMap[tagId] || []).findIndex(room => {
      return room.roomId === this.stickyRoomId;
    });

    // order from low to high
    const orderedRoomIndexes = Object.keys(roomIndexToRoomId).map(numStr => {
      return Number(numStr);
    }).sort((a, b) => {
      return a - b;
    });
    const seenRoomIds = new Set();
    const orderedRoomIds = orderedRoomIndexes.map(i => {
      const rid = roomIndexToRoomId[i];
      if (seenRoomIds.has(rid)) {
        _logger.logger.error("room " + rid + " already has an index position: duplicate room!");
      }
      seenRoomIds.add(rid);
      if (!rid) {
        throw new Error("index " + i + " has no room ID: Map => " + JSON.stringify(roomIndexToRoomId));
      }
      if (rid === this.stickyRoomId) {
        stickyRoomNewIndex = i;
      }
      return rid;
    });
    _logger.logger.debug(`SlidingRoomListStore.refreshOrderedLists ${tagId} sticky: ${this.stickyRoomId}`, `${stickyRoomOldIndex} -> ${stickyRoomNewIndex}`, "rooms:", orderedRoomIds.length < 30 ? orderedRoomIds : orderedRoomIds.length);
    if (this.stickyRoomId && stickyRoomOldIndex >= 0 && stickyRoomNewIndex >= 0) {
      // this update will move this sticky room from old to new, which we do not want.
      // Instead, keep the sticky room ID index position as it is, swap it with
      // whatever was in its place.
      // Some scenarios with sticky room S and bump room B (other letters unimportant):
      // A, S, C, B                                  S, A, B
      // B, A, S, C  <---- without sticky rooms ---> B, S, A
      // B, S, A, C  <- with sticky rooms applied -> S, B, A
      // In other words, we need to swap positions to keep it locked in place.
      const inWayRoomId = orderedRoomIds[stickyRoomOldIndex];
      orderedRoomIds[stickyRoomOldIndex] = this.stickyRoomId;
      orderedRoomIds[stickyRoomNewIndex] = inWayRoomId;
    }

    // now set the rooms
    const rooms = [];
    orderedRoomIds.forEach(roomId => {
      const room = this.matrixClient?.getRoom(roomId);
      if (!room) {
        return;
      }
      rooms.push(room);
    });
    tagMap[tagId] = rooms;
    this.tagMap = tagMap;
  }
  onSlidingSyncListUpdate(tagId, joinCount, roomIndexToRoomId) {
    this.counts[tagId] = joinCount;
    this.refreshOrderedLists(tagId, roomIndexToRoomId);
    // let the UI update
    this.emit(LISTS_UPDATE_EVENT);
  }
  onRoomViewStoreUpdated() {
    // we only care about this to know when the user has clicked on a room to set the stickiness value
    if (this.context.roomViewStore.getRoomId() === this.stickyRoomId) {
      return;
    }
    let hasUpdatedAnyList = false;

    // every list with the OLD sticky room ID needs to be resorted because it now needs to take
    // its proper place as it is no longer sticky. The newly sticky room can remain the same though,
    // as we only actually care about its sticky status when we get list updates.
    const oldStickyRoom = this.stickyRoomId;
    // it's not safe to check the data in slidingSync as it is tracking the server's view of the
    // room list. There's an edge case whereby the sticky room has gone outside the window and so
    // would not be present in the roomIndexToRoomId map anymore, and hence clicking away from it
    // will make it disappear eventually. We need to check orderedLists as that is the actual
    // sorted renderable list of rooms which sticky rooms apply to.
    for (const tagId in this.orderedLists) {
      const list = this.orderedLists[tagId];
      const room = list.find(room => {
        return room.roomId === oldStickyRoom;
      });
      if (room) {
        // resort it based on the slidingSync view of the list. This may cause this old sticky
        // room to cease to exist.
        const listData = this.context.slidingSyncManager.slidingSync.getListData(tagId);
        if (!listData) {
          continue;
        }
        this.refreshOrderedLists(tagId, listData.roomIndexToRoomId);
        hasUpdatedAnyList = true;
      }
    }
    // in the event we didn't call refreshOrderedLists, it helps to still remember the sticky room ID.
    this.stickyRoomId = this.context.roomViewStore.getRoomId();
    if (hasUpdatedAnyList) {
      this.emit(LISTS_UPDATE_EVENT);
    }
  }
  async onReady() {
    _logger.logger.info("SlidingRoomListStore.onReady");
    // permanent listeners: never get destroyed. Could be an issue if we want to test this in isolation.
    this.context.slidingSyncManager.slidingSync.on(_slidingSync.SlidingSyncEvent.List, this.onSlidingSyncListUpdate.bind(this));
    this.context.roomViewStore.addListener(_AsyncStore.UPDATE_EVENT, this.onRoomViewStoreUpdated.bind(this));
    this.context.spaceStore.on(_spaces.UPDATE_SELECTED_SPACE, this.onSelectedSpaceUpdated.bind(this));
    if (this.context.spaceStore.activeSpace) {
      this.onSelectedSpaceUpdated(this.context.spaceStore.activeSpace, false);
    }

    // sliding sync has an initial response for spaces. Now request all the lists.
    // We do the spaces list _first_ to avoid potential flickering on DefaultTagID.Untagged list
    // which would be caused by initially having no `spaces` filter set, and then suddenly setting one.
    _models.OrderedDefaultTagIDs.forEach(tagId => {
      const filter = filterConditions[tagId];
      if (!filter) {
        _logger.logger.info("SlidingRoomListStore.onReady unsupported list ", tagId);
        return; // we do not support this list yet.
      }

      const sort = _models2.SortAlgorithm.Recent; // default to recency sort, TODO: read from config
      this.tagIdToSortAlgo[tagId] = sort;
      this.emit(_RoomListStore.LISTS_LOADING_EVENT, tagId, true);
      this.context.slidingSyncManager.ensureListRegistered(tagId, {
        filters: filter,
        sort: SlidingSyncSortToFilter[sort]
      }).then(() => {
        this.emit(_RoomListStore.LISTS_LOADING_EVENT, tagId, false);
      });
    });
  }
  // Intended for test usage
  async resetStore() {
    // Test function
  }

  /**
   * Regenerates the room whole room list, discarding any previous results.
   *
   * Note: This is only exposed externally for the tests. Do not call this from within
   * the app.
   * @param trigger Set to false to prevent a list update from being sent. Should only
   * be used if the calling code will manually trigger the update.
   */
  regenerateAllLists(_ref) {
    let {
      trigger = true
    } = _ref;
  } // Test function

  async onNotReady() {
    await this.resetStore();
  }
  async onAction(payload) {}
  async onDispatchAsync(payload) {}
}
exports.SlidingRoomListStoreClass = SlidingRoomListStoreClass;
//# sourceMappingURL=SlidingRoomListStore.js.map