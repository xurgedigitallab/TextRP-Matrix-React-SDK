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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfbG9nZ2VyIiwicmVxdWlyZSIsIl9zbGlkaW5nU3luYyIsIl9tb2RlbHMiLCJfbW9kZWxzMiIsIl9Bc3luY1N0b3JlV2l0aENsaWVudCIsIl9JbnRlcmZhY2UiLCJfc3BhY2VzIiwiX1Jvb21MaXN0U3RvcmUiLCJfQXN5bmNTdG9yZSIsIlNsaWRpbmdTeW5jU29ydFRvRmlsdGVyIiwiU29ydEFsZ29yaXRobSIsIkFscGhhYmV0aWMiLCJSZWNlbnQiLCJNYW51YWwiLCJleHBvcnRzIiwiZmlsdGVyQ29uZGl0aW9ucyIsIkRlZmF1bHRUYWdJRCIsIkludml0ZSIsImlzX2ludml0ZSIsIkZhdm91cml0ZSIsInRhZ3MiLCJETSIsImlzX2RtIiwibm90X3RhZ3MiLCJVbnRhZ2dlZCIsIm5vdF9yb29tX3R5cGVzIiwiTG93UHJpb3JpdHkiLCJMSVNUU19VUERBVEVfRVZFTlQiLCJSb29tTGlzdFN0b3JlRXZlbnQiLCJMaXN0c1VwZGF0ZSIsIlNsaWRpbmdSb29tTGlzdFN0b3JlQ2xhc3MiLCJBc3luY1N0b3JlV2l0aENsaWVudCIsImNvbnN0cnVjdG9yIiwiZGlzIiwiY29udGV4dCIsIl9kZWZpbmVQcm9wZXJ0eTIiLCJkZWZhdWx0IiwiYWN0aXZlU3BhY2UiLCJhbGxSb29tc0luSG9tZSIsImxvZ2dlciIsImluZm8iLCJ0YWdJZCIsImZpbHRlcnMiLCJvbGRTcGFjZSIsInNwYWNlcyIsIk1ldGFTcGFjZSIsIkhvbWUiLCJ1bmRlZmluZWQiLCJzcGFjZVN0b3JlIiwidHJhdmVyc2VTcGFjZSIsInJvb21JZCIsInB1c2giLCJlbWl0IiwiTElTVFNfTE9BRElOR19FVkVOVCIsInNsaWRpbmdTeW5jTWFuYWdlciIsImVuc3VyZUxpc3RSZWdpc3RlcmVkIiwidGhlbiIsInNldE1heExpc3RlbmVycyIsInNldFRhZ1NvcnRpbmciLCJzb3J0IiwidGFnSWRUb1NvcnRBbGdvIiwiZXJyb3IiLCJnZXRUYWdTb3J0aW5nIiwiYWxnbyIsIndhcm4iLCJnZXRDb3VudCIsImNvdW50cyIsInNldExpc3RPcmRlciIsIm9yZGVyIiwiZ2V0TGlzdE9yZGVyIiwiTGlzdEFsZ29yaXRobSIsIk5hdHVyYWwiLCJhZGRGaWx0ZXIiLCJmaWx0ZXIiLCJyZW1vdmVGaWx0ZXIiLCJnZXRUYWdzRm9yUm9vbSIsInJvb20iLCJsaXN0RGF0YSIsInNsaWRpbmdTeW5jIiwiZ2V0TGlzdERhdGEiLCJyb29tSW5kZXgiLCJyb29tSW5kZXhUb1Jvb21JZCIsIm1hbnVhbFJvb21VcGRhdGUiLCJjYXVzZSIsIm9yZGVyZWRMaXN0cyIsInRhZ01hcCIsInJlZnJlc2hPcmRlcmVkTGlzdHMiLCJzdGlja3lSb29tSWQiLCJyb29tVmlld1N0b3JlIiwiZ2V0Um9vbUlkIiwic3RpY2t5Um9vbU5ld0luZGV4Iiwic3RpY2t5Um9vbU9sZEluZGV4IiwiZmluZEluZGV4Iiwib3JkZXJlZFJvb21JbmRleGVzIiwiT2JqZWN0Iiwia2V5cyIsIm1hcCIsIm51bVN0ciIsIk51bWJlciIsImEiLCJiIiwic2VlblJvb21JZHMiLCJTZXQiLCJvcmRlcmVkUm9vbUlkcyIsImkiLCJyaWQiLCJoYXMiLCJhZGQiLCJFcnJvciIsIkpTT04iLCJzdHJpbmdpZnkiLCJkZWJ1ZyIsImxlbmd0aCIsImluV2F5Um9vbUlkIiwicm9vbXMiLCJmb3JFYWNoIiwibWF0cml4Q2xpZW50IiwiZ2V0Um9vbSIsIm9uU2xpZGluZ1N5bmNMaXN0VXBkYXRlIiwiam9pbkNvdW50Iiwib25Sb29tVmlld1N0b3JlVXBkYXRlZCIsImhhc1VwZGF0ZWRBbnlMaXN0Iiwib2xkU3RpY2t5Um9vbSIsImxpc3QiLCJmaW5kIiwib25SZWFkeSIsIm9uIiwiU2xpZGluZ1N5bmNFdmVudCIsIkxpc3QiLCJiaW5kIiwiYWRkTGlzdGVuZXIiLCJVUERBVEVfRVZFTlQiLCJVUERBVEVfU0VMRUNURURfU1BBQ0UiLCJvblNlbGVjdGVkU3BhY2VVcGRhdGVkIiwiT3JkZXJlZERlZmF1bHRUYWdJRHMiLCJyZXNldFN0b3JlIiwicmVnZW5lcmF0ZUFsbExpc3RzIiwiX3JlZiIsInRyaWdnZXIiLCJvbk5vdFJlYWR5Iiwib25BY3Rpb24iLCJwYXlsb2FkIiwib25EaXNwYXRjaEFzeW5jIl0sInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3N0b3Jlcy9yb29tLWxpc3QvU2xpZGluZ1Jvb21MaXN0U3RvcmUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbkNvcHlyaWdodCAyMDIyIFRoZSBNYXRyaXgub3JnIEZvdW5kYXRpb24gQy5JLkMuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuKi9cblxuaW1wb3J0IHsgUm9vbSB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9tb2RlbHMvcm9vbVwiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL2xvZ2dlclwiO1xuaW1wb3J0IHsgTVNDMzU3NUZpbHRlciwgU2xpZGluZ1N5bmNFdmVudCB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9zbGlkaW5nLXN5bmNcIjtcbmltcG9ydCB7IE9wdGlvbmFsIH0gZnJvbSBcIm1hdHJpeC1ldmVudHMtc2RrXCI7XG5cbmltcG9ydCB7IFJvb21VcGRhdGVDYXVzZSwgVGFnSUQsIE9yZGVyZWREZWZhdWx0VGFnSURzLCBEZWZhdWx0VGFnSUQgfSBmcm9tIFwiLi9tb2RlbHNcIjtcbmltcG9ydCB7IElUYWdNYXAsIExpc3RBbGdvcml0aG0sIFNvcnRBbGdvcml0aG0gfSBmcm9tIFwiLi9hbGdvcml0aG1zL21vZGVsc1wiO1xuaW1wb3J0IHsgQWN0aW9uUGF5bG9hZCB9IGZyb20gXCIuLi8uLi9kaXNwYXRjaGVyL3BheWxvYWRzXCI7XG5pbXBvcnQgeyBNYXRyaXhEaXNwYXRjaGVyIH0gZnJvbSBcIi4uLy4uL2Rpc3BhdGNoZXIvZGlzcGF0Y2hlclwiO1xuaW1wb3J0IHsgSUZpbHRlckNvbmRpdGlvbiB9IGZyb20gXCIuL2ZpbHRlcnMvSUZpbHRlckNvbmRpdGlvblwiO1xuaW1wb3J0IHsgQXN5bmNTdG9yZVdpdGhDbGllbnQgfSBmcm9tIFwiLi4vQXN5bmNTdG9yZVdpdGhDbGllbnRcIjtcbmltcG9ydCB7IFJvb21MaXN0U3RvcmUgYXMgSW50ZXJmYWNlLCBSb29tTGlzdFN0b3JlRXZlbnQgfSBmcm9tIFwiLi9JbnRlcmZhY2VcIjtcbmltcG9ydCB7IE1ldGFTcGFjZSwgU3BhY2VLZXksIFVQREFURV9TRUxFQ1RFRF9TUEFDRSB9IGZyb20gXCIuLi9zcGFjZXNcIjtcbmltcG9ydCB7IExJU1RTX0xPQURJTkdfRVZFTlQgfSBmcm9tIFwiLi9Sb29tTGlzdFN0b3JlXCI7XG5pbXBvcnQgeyBVUERBVEVfRVZFTlQgfSBmcm9tIFwiLi4vQXN5bmNTdG9yZVwiO1xuaW1wb3J0IHsgU2RrQ29udGV4dENsYXNzIH0gZnJvbSBcIi4uLy4uL2NvbnRleHRzL1NES0NvbnRleHRcIjtcblxuaW50ZXJmYWNlIElTdGF0ZSB7XG4gICAgLy8gc3RhdGUgaXMgdHJhY2tlZCBpbiB1bmRlcmx5aW5nIGNsYXNzZXNcbn1cblxuZXhwb3J0IGNvbnN0IFNsaWRpbmdTeW5jU29ydFRvRmlsdGVyOiBSZWNvcmQ8U29ydEFsZ29yaXRobSwgc3RyaW5nW10+ID0ge1xuICAgIFtTb3J0QWxnb3JpdGhtLkFscGhhYmV0aWNdOiBbXCJieV9uYW1lXCIsIFwiYnlfcmVjZW5jeVwiXSxcbiAgICBbU29ydEFsZ29yaXRobS5SZWNlbnRdOiBbXCJieV9ub3RpZmljYXRpb25fbGV2ZWxcIiwgXCJieV9yZWNlbmN5XCJdLFxuICAgIFtTb3J0QWxnb3JpdGhtLk1hbnVhbF06IFtcImJ5X3JlY2VuY3lcIl0sXG59O1xuXG5jb25zdCBmaWx0ZXJDb25kaXRpb25zOiBSZWNvcmQ8VGFnSUQsIE1TQzM1NzVGaWx0ZXI+ID0ge1xuICAgIFtEZWZhdWx0VGFnSUQuSW52aXRlXToge1xuICAgICAgICBpc19pbnZpdGU6IHRydWUsXG4gICAgfSxcbiAgICBbRGVmYXVsdFRhZ0lELkZhdm91cml0ZV06IHtcbiAgICAgICAgdGFnczogW1wibS5mYXZvdXJpdGVcIl0sXG4gICAgfSxcbiAgICAvLyBUT0RPIGh0dHBzOi8vZ2l0aHViLmNvbS92ZWN0b3ItaW0vZWxlbWVudC13ZWIvaXNzdWVzLzIzMjA3XG4gICAgLy8gRGVmYXVsdFRhZ0lELlNhdmVkSXRlbXMsXG4gICAgW0RlZmF1bHRUYWdJRC5ETV06IHtcbiAgICAgICAgaXNfZG06IHRydWUsXG4gICAgICAgIGlzX2ludml0ZTogZmFsc2UsXG4gICAgICAgIC8vIElmIGEgRE0gaGFzIGEgRmF2b3VyaXRlICYgTG93IFByaW8gdGFnIHRoZW4gaXQnbGwgYmUgc2hvd24gaW4gdGhvc2UgbGlzdHMgaW5zdGVhZFxuICAgICAgICBub3RfdGFnczogW1wibS5mYXZvdXJpdGVcIiwgXCJtLmxvd3ByaW9yaXR5XCJdLFxuICAgIH0sXG4gICAgW0RlZmF1bHRUYWdJRC5VbnRhZ2dlZF06IHtcbiAgICAgICAgaXNfZG06IGZhbHNlLFxuICAgICAgICBpc19pbnZpdGU6IGZhbHNlLFxuICAgICAgICBub3Rfcm9vbV90eXBlczogW1wibS5zcGFjZVwiXSxcbiAgICAgICAgbm90X3RhZ3M6IFtcIm0uZmF2b3VyaXRlXCIsIFwibS5sb3dwcmlvcml0eVwiXSxcbiAgICAgICAgLy8gc3BhY2VzIGZpbHRlciBhZGRlZCBkeW5hbWljYWxseVxuICAgIH0sXG4gICAgW0RlZmF1bHRUYWdJRC5Mb3dQcmlvcml0eV06IHtcbiAgICAgICAgdGFnczogW1wibS5sb3dwcmlvcml0eVwiXSxcbiAgICAgICAgLy8gSWYgYSByb29tIGhhcyBib3RoIEZhdm91cml0ZSAmIExvdyBQcmlvIHRhZ3MgdGhlbiBpdCdsbCBiZSBzaG93biB1bmRlciBGYXZvdXJpdGVzXG4gICAgICAgIG5vdF90YWdzOiBbXCJtLmZhdm91cml0ZVwiXSxcbiAgICB9LFxuICAgIC8vIFRPRE8gaHR0cHM6Ly9naXRodWIuY29tL3ZlY3Rvci1pbS9lbGVtZW50LXdlYi9pc3N1ZXMvMjMyMDdcbiAgICAvLyBEZWZhdWx0VGFnSUQuU2VydmVyTm90aWNlLFxuICAgIC8vIERlZmF1bHRUYWdJRC5TdWdnZXN0ZWQsXG4gICAgLy8gRGVmYXVsdFRhZ0lELkFyY2hpdmVkLFxufTtcblxuZXhwb3J0IGNvbnN0IExJU1RTX1VQREFURV9FVkVOVCA9IFJvb21MaXN0U3RvcmVFdmVudC5MaXN0c1VwZGF0ZTtcblxuZXhwb3J0IGNsYXNzIFNsaWRpbmdSb29tTGlzdFN0b3JlQ2xhc3MgZXh0ZW5kcyBBc3luY1N0b3JlV2l0aENsaWVudDxJU3RhdGU+IGltcGxlbWVudHMgSW50ZXJmYWNlIHtcbiAgICBwcml2YXRlIHRhZ0lkVG9Tb3J0QWxnbzogUmVjb3JkPFRhZ0lELCBTb3J0QWxnb3JpdGhtPiA9IHt9O1xuICAgIHByaXZhdGUgdGFnTWFwOiBJVGFnTWFwID0ge307XG4gICAgcHJpdmF0ZSBjb3VudHM6IFJlY29yZDxUYWdJRCwgbnVtYmVyPiA9IHt9O1xuICAgIHByaXZhdGUgc3RpY2t5Um9vbUlkOiBPcHRpb25hbDxzdHJpbmc+O1xuXG4gICAgcHVibGljIGNvbnN0cnVjdG9yKGRpczogTWF0cml4RGlzcGF0Y2hlciwgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0OiBTZGtDb250ZXh0Q2xhc3MpIHtcbiAgICAgICAgc3VwZXIoZGlzKTtcbiAgICAgICAgdGhpcy5zZXRNYXhMaXN0ZW5lcnMoMjApOyAvLyBSb29tTGlzdCArIExlZnRQYW5lbCArIDh4Um9vbVN1Ykxpc3QgKyBzcGFyZXNcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgc2V0VGFnU29ydGluZyh0YWdJZDogVGFnSUQsIHNvcnQ6IFNvcnRBbGdvcml0aG0pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgbG9nZ2VyLmluZm8oXCJTbGlkaW5nUm9vbUxpc3RTdG9yZS5zZXRUYWdTb3J0aW5nIFwiLCB0YWdJZCwgc29ydCk7XG4gICAgICAgIHRoaXMudGFnSWRUb1NvcnRBbGdvW3RhZ0lkXSA9IHNvcnQ7XG4gICAgICAgIHN3aXRjaCAoc29ydCkge1xuICAgICAgICAgICAgY2FzZSBTb3J0QWxnb3JpdGhtLkFscGhhYmV0aWM6XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5jb250ZXh0LnNsaWRpbmdTeW5jTWFuYWdlci5lbnN1cmVMaXN0UmVnaXN0ZXJlZCh0YWdJZCwge1xuICAgICAgICAgICAgICAgICAgICBzb3J0OiBTbGlkaW5nU3luY1NvcnRUb0ZpbHRlcltTb3J0QWxnb3JpdGhtLkFscGhhYmV0aWNdLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBTb3J0QWxnb3JpdGhtLlJlY2VudDpcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmNvbnRleHQuc2xpZGluZ1N5bmNNYW5hZ2VyLmVuc3VyZUxpc3RSZWdpc3RlcmVkKHRhZ0lkLCB7XG4gICAgICAgICAgICAgICAgICAgIHNvcnQ6IFNsaWRpbmdTeW5jU29ydFRvRmlsdGVyW1NvcnRBbGdvcml0aG0uUmVjZW50XSxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgU29ydEFsZ29yaXRobS5NYW51YWw6XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmVycm9yKFwiY2Fubm90IGVuYWJsZSBtYW51YWwgc29ydCBpbiBzbGlkaW5nIHN5bmMgbW9kZVwiKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmVycm9yKFwidW5rbm93biBzb3J0IG1vZGU6IFwiLCBzb3J0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBnZXRUYWdTb3J0aW5nKHRhZ0lkOiBUYWdJRCk6IFNvcnRBbGdvcml0aG0ge1xuICAgICAgICBsZXQgYWxnbyA9IHRoaXMudGFnSWRUb1NvcnRBbGdvW3RhZ0lkXTtcbiAgICAgICAgaWYgKCFhbGdvKSB7XG4gICAgICAgICAgICBsb2dnZXIud2FybihcIlNsaWRpbmdSb29tTGlzdFN0b3JlLmdldFRhZ1NvcnRpbmc6IG5vIHNvcnQgYWxnb3JpdGhtIGZvciB0YWcgXCIsIHRhZ0lkKTtcbiAgICAgICAgICAgIGFsZ28gPSBTb3J0QWxnb3JpdGhtLlJlY2VudDsgLy8gd2h5IG5vdCwgd2UgaGF2ZSB0byBkbyBzb21ldGhpbmcuLlxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhbGdvO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXRDb3VudCh0YWdJZDogVGFnSUQpOiBudW1iZXIge1xuICAgICAgICByZXR1cm4gdGhpcy5jb3VudHNbdGFnSWRdIHx8IDA7XG4gICAgfVxuXG4gICAgcHVibGljIHNldExpc3RPcmRlcih0YWdJZDogVGFnSUQsIG9yZGVyOiBMaXN0QWxnb3JpdGhtKTogdm9pZCB7XG4gICAgICAgIC8vIFRPRE86IGh0dHBzOi8vZ2l0aHViLmNvbS92ZWN0b3ItaW0vZWxlbWVudC13ZWIvaXNzdWVzLzIzMjA3XG4gICAgfVxuXG4gICAgcHVibGljIGdldExpc3RPcmRlcih0YWdJZDogVGFnSUQpOiBMaXN0QWxnb3JpdGhtIHtcbiAgICAgICAgLy8gVE9ETzogaGFuZGxlIHVucmVhZCBtc2dzIGZpcnN0PyBodHRwczovL2dpdGh1Yi5jb20vdmVjdG9yLWltL2VsZW1lbnQtd2ViL2lzc3Vlcy8yMzIwN1xuICAgICAgICByZXR1cm4gTGlzdEFsZ29yaXRobS5OYXR1cmFsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgYSBmaWx0ZXIgY29uZGl0aW9uIHRvIHRoZSByb29tIGxpc3Qgc3RvcmUuIEZpbHRlcnMgbWF5IGJlIGFwcGxpZWQgYXN5bmMsXG4gICAgICogYW5kIHRodXMgbWlnaHQgbm90IGNhdXNlIGFuIHVwZGF0ZSB0byB0aGUgc3RvcmUgaW1tZWRpYXRlbHkuXG4gICAgICogQHBhcmFtIHtJRmlsdGVyQ29uZGl0aW9ufSBmaWx0ZXIgVGhlIGZpbHRlciBjb25kaXRpb24gdG8gYWRkLlxuICAgICAqL1xuICAgIHB1YmxpYyBhc3luYyBhZGRGaWx0ZXIoZmlsdGVyOiBJRmlsdGVyQ29uZGl0aW9uKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIC8vIERvIG5vdGhpbmcsIHRoZSBmaWx0ZXJzIGFyZSBvbmx5IHVzZWQgYnkgU3BhY2VXYXRjaGVyIHRvIHNlZSBpZiBhIHJvb20gc2hvdWxkIGFwcGVhclxuICAgICAgICAvLyBpbiB0aGUgcm9vbSBsaXN0LiBXZSBkbyBub3Qgc3VwcG9ydCBhcmJpdHJhcnkgY29kZSBmb3IgZmlsdGVycyBpbiBzbGlkaW5nIHN5bmMuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhIGZpbHRlciBjb25kaXRpb24gZnJvbSB0aGUgcm9vbSBsaXN0IHN0b3JlLiBJZiB0aGUgZmlsdGVyIHdhc1xuICAgICAqIG5vdCBwcmV2aW91c2x5IGFkZGVkIHRvIHRoZSByb29tIGxpc3Qgc3RvcmUsIHRoaXMgd2lsbCBuby1vcC4gVGhlIGVmZmVjdHNcbiAgICAgKiBvZiByZW1vdmluZyBhIGZpbHRlciBtYXkgYmUgYXBwbGllZCBhc3luYyBhbmQgdGhlcmVmb3JlIG1pZ2h0IG5vdCBjYXVzZVxuICAgICAqIGFuIHVwZGF0ZSByaWdodCBhd2F5LlxuICAgICAqIEBwYXJhbSB7SUZpbHRlckNvbmRpdGlvbn0gZmlsdGVyIFRoZSBmaWx0ZXIgY29uZGl0aW9uIHRvIHJlbW92ZS5cbiAgICAgKi9cbiAgICBwdWJsaWMgcmVtb3ZlRmlsdGVyKGZpbHRlcjogSUZpbHRlckNvbmRpdGlvbik6IHZvaWQge1xuICAgICAgICAvLyBEbyBub3RoaW5nLCB0aGUgZmlsdGVycyBhcmUgb25seSB1c2VkIGJ5IFNwYWNlV2F0Y2hlciB0byBzZWUgaWYgYSByb29tIHNob3VsZCBhcHBlYXJcbiAgICAgICAgLy8gaW4gdGhlIHJvb20gbGlzdC4gV2UgZG8gbm90IHN1cHBvcnQgYXJiaXRyYXJ5IGNvZGUgZm9yIGZpbHRlcnMgaW4gc2xpZGluZyBzeW5jLlxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHRhZ3MgZm9yIGEgcm9vbSBpZGVudGlmaWVkIGJ5IHRoZSBzdG9yZS4gVGhlIHJldHVybmVkIHNldFxuICAgICAqIHNob3VsZCBuZXZlciBiZSBlbXB0eSwgYW5kIHdpbGwgY29udGFpbiBEZWZhdWx0VGFnSUQuVW50YWdnZWQgaWZcbiAgICAgKiB0aGUgc3RvcmUgaXMgbm90IGF3YXJlIG9mIGFueSB0YWdzLlxuICAgICAqIEBwYXJhbSByb29tIFRoZSByb29tIHRvIGdldCB0aGUgdGFncyBmb3IuXG4gICAgICogQHJldHVybnMgVGhlIHRhZ3MgZm9yIHRoZSByb29tLlxuICAgICAqL1xuICAgIHB1YmxpYyBnZXRUYWdzRm9yUm9vbShyb29tOiBSb29tKTogVGFnSURbXSB7XG4gICAgICAgIC8vIGNoZWNrIGFsbCBsaXN0cyBmb3IgZWFjaCB0YWcgd2Uga25vdyBhYm91dCBhbmQgc2VlIGlmIHRoZSByb29tIGlzIHRoZXJlXG4gICAgICAgIGNvbnN0IHRhZ3M6IFRhZ0lEW10gPSBbXTtcbiAgICAgICAgZm9yIChjb25zdCB0YWdJZCBpbiB0aGlzLnRhZ0lkVG9Tb3J0QWxnbykge1xuICAgICAgICAgICAgY29uc3QgbGlzdERhdGEgPSB0aGlzLmNvbnRleHQuc2xpZGluZ1N5bmNNYW5hZ2VyLnNsaWRpbmdTeW5jLmdldExpc3REYXRhKHRhZ0lkKTtcbiAgICAgICAgICAgIGlmICghbGlzdERhdGEpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAoY29uc3Qgcm9vbUluZGV4IGluIGxpc3REYXRhLnJvb21JbmRleFRvUm9vbUlkKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgcm9vbUlkID0gbGlzdERhdGEucm9vbUluZGV4VG9Sb29tSWRbcm9vbUluZGV4XTtcbiAgICAgICAgICAgICAgICBpZiAocm9vbUlkID09PSByb29tLnJvb21JZCkge1xuICAgICAgICAgICAgICAgICAgICB0YWdzLnB1c2godGFnSWQpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRhZ3M7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTWFudWFsbHkgdXBkYXRlIGEgcm9vbSB3aXRoIGEgZ2l2ZW4gY2F1c2UuIFRoaXMgc2hvdWxkIG9ubHkgYmUgdXNlZCBpZiB0aGVcbiAgICAgKiByb29tIGxpc3Qgc3RvcmUgd291bGQgb3RoZXJ3aXNlIGJlIGluY2FwYWJsZSBvZiBkb2luZyB0aGUgdXBkYXRlIGl0c2VsZi4gTm90ZVxuICAgICAqIHRoYXQgdGhpcyBtYXkgcmFjZSB3aXRoIHRoZSByb29tIGxpc3QncyByZWd1bGFyIG9wZXJhdGlvbi5cbiAgICAgKiBAcGFyYW0ge1Jvb219IHJvb20gVGhlIHJvb20gdG8gdXBkYXRlLlxuICAgICAqIEBwYXJhbSB7Um9vbVVwZGF0ZUNhdXNlfSBjYXVzZSBUaGUgY2F1c2UgdG8gdXBkYXRlIGZvci5cbiAgICAgKi9cbiAgICBwdWJsaWMgYXN5bmMgbWFudWFsUm9vbVVwZGF0ZShyb29tOiBSb29tLCBjYXVzZTogUm9vbVVwZGF0ZUNhdXNlKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIC8vIFRPRE86IHRoaXMgaXMgb25seSB1c2VkIHdoZW4geW91IGZvcmdldCBhIHJvb20sIG5vdCB0aGF0IGltcG9ydGFudCBmb3Igbm93LlxuICAgIH1cblxuICAgIHB1YmxpYyBnZXQgb3JkZXJlZExpc3RzKCk6IElUYWdNYXAge1xuICAgICAgICByZXR1cm4gdGhpcy50YWdNYXA7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSByZWZyZXNoT3JkZXJlZExpc3RzKHRhZ0lkOiBzdHJpbmcsIHJvb21JbmRleFRvUm9vbUlkOiBSZWNvcmQ8bnVtYmVyLCBzdHJpbmc+KTogdm9pZCB7XG4gICAgICAgIGNvbnN0IHRhZ01hcCA9IHRoaXMudGFnTWFwO1xuXG4gICAgICAgIC8vIHRoaXMgcm9vbSB3aWxsIG5vdCBtb3ZlIGR1ZSB0byBpdCBiZWluZyB2aWV3ZWQ6IGl0IGlzIHN0aWNreS4gVGhpcyBjYW4gYmUgbnVsbCB0byBpbmRpY2F0ZVxuICAgICAgICAvLyBubyBzdGlja3kgcm9vbSBpZiB5b3UgYXJlbid0IHZpZXdpbmcgYSByb29tLlxuICAgICAgICB0aGlzLnN0aWNreVJvb21JZCA9IHRoaXMuY29udGV4dC5yb29tVmlld1N0b3JlLmdldFJvb21JZCgpO1xuICAgICAgICBsZXQgc3RpY2t5Um9vbU5ld0luZGV4ID0gLTE7XG4gICAgICAgIGNvbnN0IHN0aWNreVJvb21PbGRJbmRleCA9ICh0YWdNYXBbdGFnSWRdIHx8IFtdKS5maW5kSW5kZXgoKHJvb20pOiBib29sZWFuID0+IHtcbiAgICAgICAgICAgIHJldHVybiByb29tLnJvb21JZCA9PT0gdGhpcy5zdGlja3lSb29tSWQ7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIG9yZGVyIGZyb20gbG93IHRvIGhpZ2hcbiAgICAgICAgY29uc3Qgb3JkZXJlZFJvb21JbmRleGVzID0gT2JqZWN0LmtleXMocm9vbUluZGV4VG9Sb29tSWQpXG4gICAgICAgICAgICAubWFwKChudW1TdHIpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gTnVtYmVyKG51bVN0cik7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYSAtIGI7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgY29uc3Qgc2VlblJvb21JZHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICAgICAgY29uc3Qgb3JkZXJlZFJvb21JZHMgPSBvcmRlcmVkUm9vbUluZGV4ZXMubWFwKChpKSA9PiB7XG4gICAgICAgICAgICBjb25zdCByaWQgPSByb29tSW5kZXhUb1Jvb21JZFtpXTtcbiAgICAgICAgICAgIGlmIChzZWVuUm9vbUlkcy5oYXMocmlkKSkge1xuICAgICAgICAgICAgICAgIGxvZ2dlci5lcnJvcihcInJvb20gXCIgKyByaWQgKyBcIiBhbHJlYWR5IGhhcyBhbiBpbmRleCBwb3NpdGlvbjogZHVwbGljYXRlIHJvb20hXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2VlblJvb21JZHMuYWRkKHJpZCk7XG4gICAgICAgICAgICBpZiAoIXJpZCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImluZGV4IFwiICsgaSArIFwiIGhhcyBubyByb29tIElEOiBNYXAgPT4gXCIgKyBKU09OLnN0cmluZ2lmeShyb29tSW5kZXhUb1Jvb21JZCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHJpZCA9PT0gdGhpcy5zdGlja3lSb29tSWQpIHtcbiAgICAgICAgICAgICAgICBzdGlja3lSb29tTmV3SW5kZXggPSBpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJpZDtcbiAgICAgICAgfSk7XG4gICAgICAgIGxvZ2dlci5kZWJ1ZyhcbiAgICAgICAgICAgIGBTbGlkaW5nUm9vbUxpc3RTdG9yZS5yZWZyZXNoT3JkZXJlZExpc3RzICR7dGFnSWR9IHN0aWNreTogJHt0aGlzLnN0aWNreVJvb21JZH1gLFxuICAgICAgICAgICAgYCR7c3RpY2t5Um9vbU9sZEluZGV4fSAtPiAke3N0aWNreVJvb21OZXdJbmRleH1gLFxuICAgICAgICAgICAgXCJyb29tczpcIixcbiAgICAgICAgICAgIG9yZGVyZWRSb29tSWRzLmxlbmd0aCA8IDMwID8gb3JkZXJlZFJvb21JZHMgOiBvcmRlcmVkUm9vbUlkcy5sZW5ndGgsXG4gICAgICAgICk7XG5cbiAgICAgICAgaWYgKHRoaXMuc3RpY2t5Um9vbUlkICYmIHN0aWNreVJvb21PbGRJbmRleCA+PSAwICYmIHN0aWNreVJvb21OZXdJbmRleCA+PSAwKSB7XG4gICAgICAgICAgICAvLyB0aGlzIHVwZGF0ZSB3aWxsIG1vdmUgdGhpcyBzdGlja3kgcm9vbSBmcm9tIG9sZCB0byBuZXcsIHdoaWNoIHdlIGRvIG5vdCB3YW50LlxuICAgICAgICAgICAgLy8gSW5zdGVhZCwga2VlcCB0aGUgc3RpY2t5IHJvb20gSUQgaW5kZXggcG9zaXRpb24gYXMgaXQgaXMsIHN3YXAgaXQgd2l0aFxuICAgICAgICAgICAgLy8gd2hhdGV2ZXIgd2FzIGluIGl0cyBwbGFjZS5cbiAgICAgICAgICAgIC8vIFNvbWUgc2NlbmFyaW9zIHdpdGggc3RpY2t5IHJvb20gUyBhbmQgYnVtcCByb29tIEIgKG90aGVyIGxldHRlcnMgdW5pbXBvcnRhbnQpOlxuICAgICAgICAgICAgLy8gQSwgUywgQywgQiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBTLCBBLCBCXG4gICAgICAgICAgICAvLyBCLCBBLCBTLCBDICA8LS0tLSB3aXRob3V0IHN0aWNreSByb29tcyAtLS0+IEIsIFMsIEFcbiAgICAgICAgICAgIC8vIEIsIFMsIEEsIEMgIDwtIHdpdGggc3RpY2t5IHJvb21zIGFwcGxpZWQgLT4gUywgQiwgQVxuICAgICAgICAgICAgLy8gSW4gb3RoZXIgd29yZHMsIHdlIG5lZWQgdG8gc3dhcCBwb3NpdGlvbnMgdG8ga2VlcCBpdCBsb2NrZWQgaW4gcGxhY2UuXG4gICAgICAgICAgICBjb25zdCBpbldheVJvb21JZCA9IG9yZGVyZWRSb29tSWRzW3N0aWNreVJvb21PbGRJbmRleF07XG4gICAgICAgICAgICBvcmRlcmVkUm9vbUlkc1tzdGlja3lSb29tT2xkSW5kZXhdID0gdGhpcy5zdGlja3lSb29tSWQ7XG4gICAgICAgICAgICBvcmRlcmVkUm9vbUlkc1tzdGlja3lSb29tTmV3SW5kZXhdID0gaW5XYXlSb29tSWQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBub3cgc2V0IHRoZSByb29tc1xuICAgICAgICBjb25zdCByb29tczogUm9vbVtdID0gW107XG4gICAgICAgIG9yZGVyZWRSb29tSWRzLmZvckVhY2goKHJvb21JZCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgcm9vbSA9IHRoaXMubWF0cml4Q2xpZW50Py5nZXRSb29tKHJvb21JZCk7XG4gICAgICAgICAgICBpZiAoIXJvb20pIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByb29tcy5wdXNoKHJvb20pO1xuICAgICAgICB9KTtcbiAgICAgICAgdGFnTWFwW3RhZ0lkXSA9IHJvb21zO1xuICAgICAgICB0aGlzLnRhZ01hcCA9IHRhZ01hcDtcbiAgICB9XG5cbiAgICBwcml2YXRlIG9uU2xpZGluZ1N5bmNMaXN0VXBkYXRlKHRhZ0lkOiBzdHJpbmcsIGpvaW5Db3VudDogbnVtYmVyLCByb29tSW5kZXhUb1Jvb21JZDogUmVjb3JkPG51bWJlciwgc3RyaW5nPik6IHZvaWQge1xuICAgICAgICB0aGlzLmNvdW50c1t0YWdJZF0gPSBqb2luQ291bnQ7XG4gICAgICAgIHRoaXMucmVmcmVzaE9yZGVyZWRMaXN0cyh0YWdJZCwgcm9vbUluZGV4VG9Sb29tSWQpO1xuICAgICAgICAvLyBsZXQgdGhlIFVJIHVwZGF0ZVxuICAgICAgICB0aGlzLmVtaXQoTElTVFNfVVBEQVRFX0VWRU5UKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIG9uUm9vbVZpZXdTdG9yZVVwZGF0ZWQoKTogdm9pZCB7XG4gICAgICAgIC8vIHdlIG9ubHkgY2FyZSBhYm91dCB0aGlzIHRvIGtub3cgd2hlbiB0aGUgdXNlciBoYXMgY2xpY2tlZCBvbiBhIHJvb20gdG8gc2V0IHRoZSBzdGlja2luZXNzIHZhbHVlXG4gICAgICAgIGlmICh0aGlzLmNvbnRleHQucm9vbVZpZXdTdG9yZS5nZXRSb29tSWQoKSA9PT0gdGhpcy5zdGlja3lSb29tSWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBoYXNVcGRhdGVkQW55TGlzdCA9IGZhbHNlO1xuXG4gICAgICAgIC8vIGV2ZXJ5IGxpc3Qgd2l0aCB0aGUgT0xEIHN0aWNreSByb29tIElEIG5lZWRzIHRvIGJlIHJlc29ydGVkIGJlY2F1c2UgaXQgbm93IG5lZWRzIHRvIHRha2VcbiAgICAgICAgLy8gaXRzIHByb3BlciBwbGFjZSBhcyBpdCBpcyBubyBsb25nZXIgc3RpY2t5LiBUaGUgbmV3bHkgc3RpY2t5IHJvb20gY2FuIHJlbWFpbiB0aGUgc2FtZSB0aG91Z2gsXG4gICAgICAgIC8vIGFzIHdlIG9ubHkgYWN0dWFsbHkgY2FyZSBhYm91dCBpdHMgc3RpY2t5IHN0YXR1cyB3aGVuIHdlIGdldCBsaXN0IHVwZGF0ZXMuXG4gICAgICAgIGNvbnN0IG9sZFN0aWNreVJvb20gPSB0aGlzLnN0aWNreVJvb21JZDtcbiAgICAgICAgLy8gaXQncyBub3Qgc2FmZSB0byBjaGVjayB0aGUgZGF0YSBpbiBzbGlkaW5nU3luYyBhcyBpdCBpcyB0cmFja2luZyB0aGUgc2VydmVyJ3MgdmlldyBvZiB0aGVcbiAgICAgICAgLy8gcm9vbSBsaXN0LiBUaGVyZSdzIGFuIGVkZ2UgY2FzZSB3aGVyZWJ5IHRoZSBzdGlja3kgcm9vbSBoYXMgZ29uZSBvdXRzaWRlIHRoZSB3aW5kb3cgYW5kIHNvXG4gICAgICAgIC8vIHdvdWxkIG5vdCBiZSBwcmVzZW50IGluIHRoZSByb29tSW5kZXhUb1Jvb21JZCBtYXAgYW55bW9yZSwgYW5kIGhlbmNlIGNsaWNraW5nIGF3YXkgZnJvbSBpdFxuICAgICAgICAvLyB3aWxsIG1ha2UgaXQgZGlzYXBwZWFyIGV2ZW50dWFsbHkuIFdlIG5lZWQgdG8gY2hlY2sgb3JkZXJlZExpc3RzIGFzIHRoYXQgaXMgdGhlIGFjdHVhbFxuICAgICAgICAvLyBzb3J0ZWQgcmVuZGVyYWJsZSBsaXN0IG9mIHJvb21zIHdoaWNoIHN0aWNreSByb29tcyBhcHBseSB0by5cbiAgICAgICAgZm9yIChjb25zdCB0YWdJZCBpbiB0aGlzLm9yZGVyZWRMaXN0cykge1xuICAgICAgICAgICAgY29uc3QgbGlzdCA9IHRoaXMub3JkZXJlZExpc3RzW3RhZ0lkXTtcbiAgICAgICAgICAgIGNvbnN0IHJvb20gPSBsaXN0LmZpbmQoKHJvb20pID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcm9vbS5yb29tSWQgPT09IG9sZFN0aWNreVJvb207XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmIChyb29tKSB7XG4gICAgICAgICAgICAgICAgLy8gcmVzb3J0IGl0IGJhc2VkIG9uIHRoZSBzbGlkaW5nU3luYyB2aWV3IG9mIHRoZSBsaXN0LiBUaGlzIG1heSBjYXVzZSB0aGlzIG9sZCBzdGlja3lcbiAgICAgICAgICAgICAgICAvLyByb29tIHRvIGNlYXNlIHRvIGV4aXN0LlxuICAgICAgICAgICAgICAgIGNvbnN0IGxpc3REYXRhID0gdGhpcy5jb250ZXh0LnNsaWRpbmdTeW5jTWFuYWdlci5zbGlkaW5nU3luYy5nZXRMaXN0RGF0YSh0YWdJZCk7XG4gICAgICAgICAgICAgICAgaWYgKCFsaXN0RGF0YSkge1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5yZWZyZXNoT3JkZXJlZExpc3RzKHRhZ0lkLCBsaXN0RGF0YS5yb29tSW5kZXhUb1Jvb21JZCk7XG4gICAgICAgICAgICAgICAgaGFzVXBkYXRlZEFueUxpc3QgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIGluIHRoZSBldmVudCB3ZSBkaWRuJ3QgY2FsbCByZWZyZXNoT3JkZXJlZExpc3RzLCBpdCBoZWxwcyB0byBzdGlsbCByZW1lbWJlciB0aGUgc3RpY2t5IHJvb20gSUQuXG4gICAgICAgIHRoaXMuc3RpY2t5Um9vbUlkID0gdGhpcy5jb250ZXh0LnJvb21WaWV3U3RvcmUuZ2V0Um9vbUlkKCk7XG5cbiAgICAgICAgaWYgKGhhc1VwZGF0ZWRBbnlMaXN0KSB7XG4gICAgICAgICAgICB0aGlzLmVtaXQoTElTVFNfVVBEQVRFX0VWRU5UKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByb3RlY3RlZCBhc3luYyBvblJlYWR5KCk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGxvZ2dlci5pbmZvKFwiU2xpZGluZ1Jvb21MaXN0U3RvcmUub25SZWFkeVwiKTtcbiAgICAgICAgLy8gcGVybWFuZW50IGxpc3RlbmVyczogbmV2ZXIgZ2V0IGRlc3Ryb3llZC4gQ291bGQgYmUgYW4gaXNzdWUgaWYgd2Ugd2FudCB0byB0ZXN0IHRoaXMgaW4gaXNvbGF0aW9uLlxuICAgICAgICB0aGlzLmNvbnRleHQuc2xpZGluZ1N5bmNNYW5hZ2VyLnNsaWRpbmdTeW5jLm9uKFNsaWRpbmdTeW5jRXZlbnQuTGlzdCwgdGhpcy5vblNsaWRpbmdTeW5jTGlzdFVwZGF0ZS5iaW5kKHRoaXMpKTtcbiAgICAgICAgdGhpcy5jb250ZXh0LnJvb21WaWV3U3RvcmUuYWRkTGlzdGVuZXIoVVBEQVRFX0VWRU5ULCB0aGlzLm9uUm9vbVZpZXdTdG9yZVVwZGF0ZWQuYmluZCh0aGlzKSk7XG4gICAgICAgIHRoaXMuY29udGV4dC5zcGFjZVN0b3JlLm9uKFVQREFURV9TRUxFQ1RFRF9TUEFDRSwgdGhpcy5vblNlbGVjdGVkU3BhY2VVcGRhdGVkLmJpbmQodGhpcykpO1xuICAgICAgICBpZiAodGhpcy5jb250ZXh0LnNwYWNlU3RvcmUuYWN0aXZlU3BhY2UpIHtcbiAgICAgICAgICAgIHRoaXMub25TZWxlY3RlZFNwYWNlVXBkYXRlZCh0aGlzLmNvbnRleHQuc3BhY2VTdG9yZS5hY3RpdmVTcGFjZSwgZmFsc2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2xpZGluZyBzeW5jIGhhcyBhbiBpbml0aWFsIHJlc3BvbnNlIGZvciBzcGFjZXMuIE5vdyByZXF1ZXN0IGFsbCB0aGUgbGlzdHMuXG4gICAgICAgIC8vIFdlIGRvIHRoZSBzcGFjZXMgbGlzdCBfZmlyc3RfIHRvIGF2b2lkIHBvdGVudGlhbCBmbGlja2VyaW5nIG9uIERlZmF1bHRUYWdJRC5VbnRhZ2dlZCBsaXN0XG4gICAgICAgIC8vIHdoaWNoIHdvdWxkIGJlIGNhdXNlZCBieSBpbml0aWFsbHkgaGF2aW5nIG5vIGBzcGFjZXNgIGZpbHRlciBzZXQsIGFuZCB0aGVuIHN1ZGRlbmx5IHNldHRpbmcgb25lLlxuICAgICAgICBPcmRlcmVkRGVmYXVsdFRhZ0lEcy5mb3JFYWNoKCh0YWdJZCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZmlsdGVyID0gZmlsdGVyQ29uZGl0aW9uc1t0YWdJZF07XG4gICAgICAgICAgICBpZiAoIWZpbHRlcikge1xuICAgICAgICAgICAgICAgIGxvZ2dlci5pbmZvKFwiU2xpZGluZ1Jvb21MaXN0U3RvcmUub25SZWFkeSB1bnN1cHBvcnRlZCBsaXN0IFwiLCB0YWdJZCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuOyAvLyB3ZSBkbyBub3Qgc3VwcG9ydCB0aGlzIGxpc3QgeWV0LlxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgc29ydCA9IFNvcnRBbGdvcml0aG0uUmVjZW50OyAvLyBkZWZhdWx0IHRvIHJlY2VuY3kgc29ydCwgVE9ETzogcmVhZCBmcm9tIGNvbmZpZ1xuICAgICAgICAgICAgdGhpcy50YWdJZFRvU29ydEFsZ29bdGFnSWRdID0gc29ydDtcbiAgICAgICAgICAgIHRoaXMuZW1pdChMSVNUU19MT0FESU5HX0VWRU5ULCB0YWdJZCwgdHJ1ZSk7XG4gICAgICAgICAgICB0aGlzLmNvbnRleHQuc2xpZGluZ1N5bmNNYW5hZ2VyXG4gICAgICAgICAgICAgICAgLmVuc3VyZUxpc3RSZWdpc3RlcmVkKHRhZ0lkLCB7XG4gICAgICAgICAgICAgICAgICAgIGZpbHRlcnM6IGZpbHRlcixcbiAgICAgICAgICAgICAgICAgICAgc29ydDogU2xpZGluZ1N5bmNTb3J0VG9GaWx0ZXJbc29ydF0sXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdChMSVNUU19MT0FESU5HX0VWRU5ULCB0YWdJZCwgZmFsc2UpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIG9uU2VsZWN0ZWRTcGFjZVVwZGF0ZWQgPSAoYWN0aXZlU3BhY2U6IFNwYWNlS2V5LCBhbGxSb29tc0luSG9tZTogYm9vbGVhbik6IHZvaWQgPT4ge1xuICAgICAgICBsb2dnZXIuaW5mbyhcIlNsaWRpbmdSb29tTGlzdFN0b3JlLm9uU2VsZWN0ZWRTcGFjZVVwZGF0ZWRcIiwgYWN0aXZlU3BhY2UpO1xuICAgICAgICAvLyB1cGRhdGUgdGhlIHVudGFnZ2VkIGZpbHRlclxuICAgICAgICBjb25zdCB0YWdJZCA9IERlZmF1bHRUYWdJRC5VbnRhZ2dlZDtcbiAgICAgICAgY29uc3QgZmlsdGVycyA9IGZpbHRlckNvbmRpdGlvbnNbdGFnSWRdO1xuICAgICAgICBjb25zdCBvbGRTcGFjZSA9IGZpbHRlcnMuc3BhY2VzPy5bMF07XG4gICAgICAgIGZpbHRlcnMuc3BhY2VzID0gYWN0aXZlU3BhY2UgJiYgYWN0aXZlU3BhY2UgIT0gTWV0YVNwYWNlLkhvbWUgPyBbYWN0aXZlU3BhY2VdIDogdW5kZWZpbmVkO1xuICAgICAgICBpZiAob2xkU3BhY2UgIT09IGFjdGl2ZVNwYWNlKSB7XG4gICAgICAgICAgICAvLyBpbmNsdWRlIHN1YnNwYWNlcyBpbiB0aGlzIGxpc3RcbiAgICAgICAgICAgIHRoaXMuY29udGV4dC5zcGFjZVN0b3JlLnRyYXZlcnNlU3BhY2UoXG4gICAgICAgICAgICAgICAgYWN0aXZlU3BhY2UsXG4gICAgICAgICAgICAgICAgKHJvb21JZDogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyb29tSWQgPT09IGFjdGl2ZVNwYWNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmaWx0ZXJzLnNwYWNlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgZmlsdGVycy5zcGFjZXMgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBmaWx0ZXJzLnNwYWNlcy5wdXNoKHJvb21JZCk7IC8vIGFkZCBzdWJzcGFjZVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZmFsc2UsXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICB0aGlzLmVtaXQoTElTVFNfTE9BRElOR19FVkVOVCwgdGFnSWQsIHRydWUpO1xuICAgICAgICAgICAgdGhpcy5jb250ZXh0LnNsaWRpbmdTeW5jTWFuYWdlclxuICAgICAgICAgICAgICAgIC5lbnN1cmVMaXN0UmVnaXN0ZXJlZCh0YWdJZCwge1xuICAgICAgICAgICAgICAgICAgICBmaWx0ZXJzOiBmaWx0ZXJzLFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXQoTElTVFNfTE9BRElOR19FVkVOVCwgdGFnSWQsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBJbnRlbmRlZCBmb3IgdGVzdCB1c2FnZVxuICAgIHB1YmxpYyBhc3luYyByZXNldFN0b3JlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICAvLyBUZXN0IGZ1bmN0aW9uXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVnZW5lcmF0ZXMgdGhlIHJvb20gd2hvbGUgcm9vbSBsaXN0LCBkaXNjYXJkaW5nIGFueSBwcmV2aW91cyByZXN1bHRzLlxuICAgICAqXG4gICAgICogTm90ZTogVGhpcyBpcyBvbmx5IGV4cG9zZWQgZXh0ZXJuYWxseSBmb3IgdGhlIHRlc3RzLiBEbyBub3QgY2FsbCB0aGlzIGZyb20gd2l0aGluXG4gICAgICogdGhlIGFwcC5cbiAgICAgKiBAcGFyYW0gdHJpZ2dlciBTZXQgdG8gZmFsc2UgdG8gcHJldmVudCBhIGxpc3QgdXBkYXRlIGZyb20gYmVpbmcgc2VudC4gU2hvdWxkIG9ubHlcbiAgICAgKiBiZSB1c2VkIGlmIHRoZSBjYWxsaW5nIGNvZGUgd2lsbCBtYW51YWxseSB0cmlnZ2VyIHRoZSB1cGRhdGUuXG4gICAgICovXG4gICAgcHVibGljIHJlZ2VuZXJhdGVBbGxMaXN0cyh7IHRyaWdnZXIgPSB0cnVlIH0pOiB2b2lkIHtcbiAgICAgICAgLy8gVGVzdCBmdW5jdGlvblxuICAgIH1cblxuICAgIHByb3RlY3RlZCBhc3luYyBvbk5vdFJlYWR5KCk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGF3YWl0IHRoaXMucmVzZXRTdG9yZSgpO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBhc3luYyBvbkFjdGlvbihwYXlsb2FkOiBBY3Rpb25QYXlsb2FkKTogUHJvbWlzZTx2b2lkPiB7fVxuXG4gICAgcHJvdGVjdGVkIGFzeW5jIG9uRGlzcGF0Y2hBc3luYyhwYXlsb2FkOiBBY3Rpb25QYXlsb2FkKTogUHJvbWlzZTx2b2lkPiB7fVxufVxuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQWlCQSxJQUFBQSxPQUFBLEdBQUFDLE9BQUE7QUFDQSxJQUFBQyxZQUFBLEdBQUFELE9BQUE7QUFHQSxJQUFBRSxPQUFBLEdBQUFGLE9BQUE7QUFDQSxJ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