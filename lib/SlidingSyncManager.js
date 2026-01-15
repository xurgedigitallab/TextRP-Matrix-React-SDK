"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SlidingSyncManager = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _event = require("matrix-js-sdk/src/@types/event");
var _slidingSync = require("matrix-js-sdk/src/sliding-sync");
var _logger = require("matrix-js-sdk/src/logger");
var _utils = require("matrix-js-sdk/src/utils");
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

/*
 * Sliding Sync Architecture - MSC https://github.com/matrix-org/matrix-spec-proposals/pull/3575
 *
 * This is a holistic summary of the changes made to Element-Web / React SDK / JS SDK to enable sliding sync.
 * This summary will hopefully signpost where developers need to look if they want to make changes to this code.
 *
 * At the lowest level, the JS SDK contains an HTTP API wrapper function in client.ts. This is used by
 * a SlidingSync class in JS SDK, which contains code to handle list operations (INSERT/DELETE/SYNC/etc)
 * and contains the main request API bodies, but has no code to control updating JS SDK structures: it just
 * exposes an EventEmitter to listen for updates. When MatrixClient.startClient is called, callers need to
 * provide a SlidingSync instance as this contains the main request API params (timeline limit, required state,
 * how many lists, etc).
 *
 * The SlidingSyncSdk INTERNAL class in JS SDK attaches listeners to SlidingSync to update JS SDK Room objects,
 * and it conveniently exposes an identical public API to SyncApi (to allow it to be a drop-in replacement).
 *
 * At the highest level, SlidingSyncManager contains mechanisms to tell UI lists which rooms to show,
 * and contains the core request API params used in Element-Web. It does this by listening for events
 * emitted by the SlidingSync class and by modifying the request API params on the SlidingSync class.
 *
 *    (entry point)                     (updates JS SDK)
 *  SlidingSyncManager                   SlidingSyncSdk
 *       |                                     |
 *       +------------------.------------------+
 *         listens          |          listens
 *                     SlidingSync
 *                     (sync loop,
 *                      list ops)
 */

// how long to long poll for
const SLIDING_SYNC_TIMEOUT_MS = 20 * 1000;

// the things to fetch when a user clicks on a room
const DEFAULT_ROOM_SUBSCRIPTION_INFO = {
  timeline_limit: 50,
  // missing required_state which will change depending on the kind of room
  include_old_rooms: {
    timeline_limit: 0,
    required_state: [
    // state needed to handle space navigation and tombstone chains
    [_event.EventType.RoomCreate, ""], [_event.EventType.RoomTombstone, ""], [_event.EventType.SpaceChild, _slidingSync.MSC3575_WILDCARD], [_event.EventType.SpaceParent, _slidingSync.MSC3575_WILDCARD], [_event.EventType.RoomMember, _slidingSync.MSC3575_STATE_KEY_ME]]
  }
};
// lazy load room members so rooms like Matrix HQ don't take forever to load
const UNENCRYPTED_SUBSCRIPTION_NAME = "unencrypted";
const UNENCRYPTED_SUBSCRIPTION = Object.assign({
  required_state: [[_slidingSync.MSC3575_WILDCARD, _slidingSync.MSC3575_WILDCARD],
  // all events
  [_event.EventType.RoomMember, _slidingSync.MSC3575_STATE_KEY_ME],
  // except for m.room.members, get our own membership
  [_event.EventType.RoomMember, _slidingSync.MSC3575_STATE_KEY_LAZY] // ...and lazy load the rest.
  ]
}, DEFAULT_ROOM_SUBSCRIPTION_INFO);

// we need all the room members in encrypted rooms because we need to know which users to encrypt
// messages for.
const ENCRYPTED_SUBSCRIPTION = Object.assign({
  required_state: [[_slidingSync.MSC3575_WILDCARD, _slidingSync.MSC3575_WILDCARD] // all events
  ]
}, DEFAULT_ROOM_SUBSCRIPTION_INFO);
/**
 * This class manages the entirety of sliding sync at a high UI/UX level. It controls the placement
 * of placeholders in lists, controls updating sliding window ranges, and controls which events
 * are pulled down when. The intention behind this manager is be the single place to look for sliding
 * sync options and code.
 */
class SlidingSyncManager {
  constructor() {
    (0, _defineProperty2.default)(this, "slidingSync", void 0);
    (0, _defineProperty2.default)(this, "client", void 0);
    (0, _defineProperty2.default)(this, "configureDefer", void 0);
    this.configureDefer = (0, _utils.defer)();
  }
  static get instance() {
    return SlidingSyncManager.internalInstance;
  }
  configure(client, proxyUrl) {
    this.client = client;
    // by default use the encrypted subscription as that gets everything, which is a safer
    // default than potentially missing member events.
    this.slidingSync = new _slidingSync.SlidingSync(proxyUrl, new Map(), ENCRYPTED_SUBSCRIPTION, client, SLIDING_SYNC_TIMEOUT_MS);
    this.slidingSync.addCustomSubscription(UNENCRYPTED_SUBSCRIPTION_NAME, UNENCRYPTED_SUBSCRIPTION);
    // set the space list
    this.slidingSync.setList(SlidingSyncManager.ListSpaces, {
      ranges: [[0, 20]],
      sort: ["by_name"],
      slow_get_all_rooms: true,
      timeline_limit: 0,
      required_state: [[_event.EventType.RoomJoinRules, ""],
      // the public icon on the room list
      [_event.EventType.RoomAvatar, ""],
      // any room avatar
      [_event.EventType.RoomTombstone, ""],
      // lets JS SDK hide rooms which are dead
      [_event.EventType.RoomEncryption, ""],
      // lets rooms be configured for E2EE correctly
      [_event.EventType.RoomCreate, ""],
      // for isSpaceRoom checks
      [_event.EventType.SpaceChild, _slidingSync.MSC3575_WILDCARD],
      // all space children
      [_event.EventType.SpaceParent, _slidingSync.MSC3575_WILDCARD],
      // all space parents
      [_event.EventType.RoomMember, _slidingSync.MSC3575_STATE_KEY_ME] // lets the client calculate that we are in fact in the room
      ],

      include_old_rooms: {
        timeline_limit: 0,
        required_state: [[_event.EventType.RoomCreate, ""], [_event.EventType.RoomTombstone, ""],
        // lets JS SDK hide rooms which are dead
        [_event.EventType.SpaceChild, _slidingSync.MSC3575_WILDCARD],
        // all space children
        [_event.EventType.SpaceParent, _slidingSync.MSC3575_WILDCARD],
        // all space parents
        [_event.EventType.RoomMember, _slidingSync.MSC3575_STATE_KEY_ME] // lets the client calculate that we are in fact in the room
        ]
      },

      filters: {
        room_types: ["m.space"]
      }
    });
    this.configureDefer.resolve();
    return this.slidingSync;
  }

  /**
   * Ensure that this list is registered.
   * @param listKey The list key to register
   * @param updateArgs The fields to update on the list.
   * @returns The complete list request params
   */
  async ensureListRegistered(listKey, updateArgs) {
    _logger.logger.debug("ensureListRegistered:::", listKey, updateArgs);
    await this.configureDefer.promise;
    let list = this.slidingSync.getListParams(listKey);
    if (!list) {
      list = {
        ranges: [[0, 20]],
        sort: ["by_notification_level", "by_recency"],
        timeline_limit: 1,
        // most recent message display: though this seems to only be needed for favourites?
        required_state: [[_event.EventType.RoomJoinRules, ""],
        // the public icon on the room list
        [_event.EventType.RoomAvatar, ""],
        // any room avatar
        [_event.EventType.RoomTombstone, ""],
        // lets JS SDK hide rooms which are dead
        [_event.EventType.RoomEncryption, ""],
        // lets rooms be configured for E2EE correctly
        [_event.EventType.RoomCreate, ""],
        // for isSpaceRoom checks
        [_event.EventType.RoomMember, _slidingSync.MSC3575_STATE_KEY_ME] // lets the client calculate that we are in fact in the room
        ],

        include_old_rooms: {
          timeline_limit: 0,
          required_state: [[_event.EventType.RoomCreate, ""], [_event.EventType.RoomTombstone, ""],
          // lets JS SDK hide rooms which are dead
          [_event.EventType.SpaceChild, _slidingSync.MSC3575_WILDCARD],
          // all space children
          [_event.EventType.SpaceParent, _slidingSync.MSC3575_WILDCARD],
          // all space parents
          [_event.EventType.RoomMember, _slidingSync.MSC3575_STATE_KEY_ME] // lets the client calculate that we are in fact in the room
          ]
        }
      };

      list = Object.assign(list, updateArgs);
    } else {
      const updatedList = Object.assign({}, list, updateArgs);
      // cannot use objectHasDiff as we need to do deep diff checking
      if (JSON.stringify(list) === JSON.stringify(updatedList)) {
        _logger.logger.debug("list matches, not sending, update => ", updateArgs);
        return list;
      }
      list = updatedList;
    }
    try {
      // if we only have range changes then call a different function so we don't nuke the list from before
      if (updateArgs.ranges && Object.keys(updateArgs).length === 1) {
        await this.slidingSync.setListRanges(listKey, updateArgs.ranges);
      } else {
        await this.slidingSync.setList(listKey, list);
      }
    } catch (err) {
      _logger.logger.debug("ensureListRegistered: update failed txn_id=", err);
    }
    return this.slidingSync.getListParams(listKey);
  }
  async setRoomVisible(roomId, visible) {
    await this.configureDefer.promise;
    const subscriptions = this.slidingSync.getRoomSubscriptions();
    if (visible) {
      subscriptions.add(roomId);
    } else {
      subscriptions.delete(roomId);
    }
    const room = this.client?.getRoom(roomId);
    let shouldLazyLoad = !this.client?.isRoomEncrypted(roomId);
    if (!room) {
      // default to safety: request all state if we can't work it out. This can happen if you
      // refresh the app whilst viewing a room: we call setRoomVisible before we know anything
      // about the room.
      shouldLazyLoad = false;
    }
    _logger.logger.log("SlidingSync setRoomVisible:", roomId, visible, "shouldLazyLoad:", shouldLazyLoad);
    if (shouldLazyLoad) {
      // lazy load this room
      this.slidingSync.useCustomSubscription(roomId, UNENCRYPTED_SUBSCRIPTION_NAME);
    }
    const p = this.slidingSync.modifyRoomSubscriptions(subscriptions);
    if (room) {
      return roomId; // we have data already for this room, show immediately e.g it's in a list
    }

    try {
      // wait until the next sync before returning as RoomView may need to know the current state
      await p;
    } catch (err) {
      _logger.logger.warn("SlidingSync setRoomVisible:", roomId, visible, "failed to confirm transaction");
    }
    return roomId;
  }

  /**
   * Retrieve all rooms on the user's account. Used for pre-populating the local search cache.
   * Retrieval is gradual over time.
   * @param batchSize The number of rooms to return in each request.
   * @param gapBetweenRequestsMs The number of milliseconds to wait between requests.
   */
  async startSpidering(batchSize, gapBetweenRequestsMs) {
    await (0, _utils.sleep)(gapBetweenRequestsMs); // wait a bit as this is called on first render so let's let things load
    let startIndex = batchSize;
    let hasMore = true;
    let firstTime = true;
    while (hasMore) {
      const endIndex = startIndex + batchSize - 1;
      try {
        const ranges = [[0, batchSize - 1], [startIndex, endIndex]];
        if (firstTime) {
          await this.slidingSync.setList(SlidingSyncManager.ListSearch, {
            // e.g [0,19] [20,39] then [0,19] [40,59]. We keep [0,20] constantly to ensure
            // any changes to the list whilst spidering are caught.
            ranges: ranges,
            sort: ["by_recency" // this list isn't shown on the UI so just sorting by timestamp is enough
            ],

            timeline_limit: 0,
            // we only care about the room details, not messages in the room
            required_state: [[_event.EventType.RoomJoinRules, ""],
            // the public icon on the room list
            [_event.EventType.RoomAvatar, ""],
            // any room avatar
            [_event.EventType.RoomTombstone, ""],
            // lets JS SDK hide rooms which are dead
            [_event.EventType.RoomEncryption, ""],
            // lets rooms be configured for E2EE correctly
            [_event.EventType.RoomCreate, ""],
            // for isSpaceRoom checks
            [_event.EventType.RoomMember, _slidingSync.MSC3575_STATE_KEY_ME] // lets the client calculate that we are in fact in the room
            ],

            // we don't include_old_rooms here in an effort to reduce the impact of spidering all rooms
            // on the user's account. This means some data in the search dialog results may be inaccurate
            // e.g membership of space, but this will be corrected when the user clicks on the room
            // as the direct room subscription does include old room iterations.
            filters: {
              // we get spaces via a different list, so filter them out
              not_room_types: ["m.space"]
            }
          });
        } else {
          await this.slidingSync.setListRanges(SlidingSyncManager.ListSearch, ranges);
        }
      } catch (err) {
        // do nothing, as we reject only when we get interrupted but that's fine as the next
        // request will include our data
      } finally {
        // gradually request more over time, even on errors.
        await (0, _utils.sleep)(gapBetweenRequestsMs);
      }
      const listData = this.slidingSync.getListData(SlidingSyncManager.ListSearch);
      hasMore = endIndex + 1 < listData.joinedCount;
      startIndex += batchSize;
      firstTime = false;
    }
  }
}
exports.SlidingSyncManager = SlidingSyncManager;
(0, _defineProperty2.default)(SlidingSyncManager, "ListSpaces", "space_list");
(0, _defineProperty2.default)(SlidingSyncManager, "ListSearch", "search_list");
(0, _defineProperty2.default)(SlidingSyncManager, "internalInstance", new SlidingSyncManager());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfZXZlbnQiLCJyZXF1aXJlIiwiX3NsaWRpbmdTeW5jIiwiX2xvZ2dlciIsIl91dGlscyIsIlNMSURJTkdfU1lOQ19USU1FT1VUX01TIiwiREVGQVVMVF9ST09NX1NVQlNDUklQVElPTl9JTkZPIiwidGltZWxpbmVfbGltaXQiLCJpbmNsdWRlX29sZF9yb29tcyIsInJlcXVpcmVkX3N0YXRlIiwiRXZlbnRUeXBlIiwiUm9vbUNyZWF0ZSIsIlJvb21Ub21ic3RvbmUiLCJTcGFjZUNoaWxkIiwiTVNDMzU3NV9XSUxEQ0FSRCIsIlNwYWNlUGFyZW50IiwiUm9vbU1lbWJlciIsIk1TQzM1NzVfU1RBVEVfS0VZX01FIiwiVU5FTkNSWVBURURfU1VCU0NSSVBUSU9OX05BTUUiLCJVTkVOQ1JZUFRFRF9TVUJTQ1JJUFRJT04iLCJPYmplY3QiLCJhc3NpZ24iLCJNU0MzNTc1X1NUQVRFX0tFWV9MQVpZIiwiRU5DUllQVEVEX1NVQlNDUklQVElPTiIsIlNsaWRpbmdTeW5jTWFuYWdlciIsImNvbnN0cnVjdG9yIiwiX2RlZmluZVByb3BlcnR5MiIsImRlZmF1bHQiLCJjb25maWd1cmVEZWZlciIsImRlZmVyIiwiaW5zdGFuY2UiLCJpbnRlcm5hbEluc3RhbmNlIiwiY29uZmlndXJlIiwiY2xpZW50IiwicHJveHlVcmwiLCJzbGlkaW5nU3luYyIsIlNsaWRpbmdTeW5jIiwiTWFwIiwiYWRkQ3VzdG9tU3Vic2NyaXB0aW9uIiwic2V0TGlzdCIsIkxpc3RTcGFjZXMiLCJyYW5nZXMiLCJzb3J0Iiwic2xvd19nZXRfYWxsX3Jvb21zIiwiUm9vbUpvaW5SdWxlcyIsIlJvb21BdmF0YXIiLCJSb29tRW5jcnlwdGlvbiIsImZpbHRlcnMiLCJyb29tX3R5cGVzIiwicmVzb2x2ZSIsImVuc3VyZUxpc3RSZWdpc3RlcmVkIiwibGlzdEtleSIsInVwZGF0ZUFyZ3MiLCJsb2dnZXIiLCJkZWJ1ZyIsInByb21pc2UiLCJsaXN0IiwiZ2V0TGlzdFBhcmFtcyIsInVwZGF0ZWRMaXN0IiwiSlNPTiIsInN0cmluZ2lmeSIsImtleXMiLCJsZW5ndGgiLCJzZXRMaXN0UmFuZ2VzIiwiZXJyIiwic2V0Um9vbVZpc2libGUiLCJyb29tSWQiLCJ2aXNpYmxlIiwic3Vic2NyaXB0aW9ucyIsImdldFJvb21TdWJzY3JpcHRpb25zIiwiYWRkIiwiZGVsZXRlIiwicm9vbSIsImdldFJvb20iLCJzaG91bGRMYXp5TG9hZCIsImlzUm9vbUVuY3J5cHRlZCIsImxvZyIsInVzZUN1c3RvbVN1YnNjcmlwdGlvbiIsInAiLCJtb2RpZnlSb29tU3Vic2NyaXB0aW9ucyIsIndhcm4iLCJzdGFydFNwaWRlcmluZyIsImJhdGNoU2l6ZSIsImdhcEJldHdlZW5SZXF1ZXN0c01zIiwic2xlZXAiLCJzdGFydEluZGV4IiwiaGFzTW9yZSIsImZpcnN0VGltZSIsImVuZEluZGV4IiwiTGlzdFNlYXJjaCIsIm5vdF9yb29tX3R5cGVzIiwibGlzdERhdGEiLCJnZXRMaXN0RGF0YSIsImpvaW5lZENvdW50IiwiZXhwb3J0cyJdLCJzb3VyY2VzIjpbIi4uL3NyYy9TbGlkaW5nU3luY01hbmFnZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbkNvcHlyaWdodCAyMDIyIFRoZSBNYXRyaXgub3JnIEZvdW5kYXRpb24gQy5JLkMuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuKi9cblxuLypcbiAqIFNsaWRpbmcgU3luYyBBcmNoaXRlY3R1cmUgLSBNU0MgaHR0cHM6Ly9naXRodWIuY29tL21hdHJpeC1vcmcvbWF0cml4LXNwZWMtcHJvcG9zYWxzL3B1bGwvMzU3NVxuICpcbiAqIFRoaXMgaXMgYSBob2xpc3RpYyBzdW1tYXJ5IG9mIHRoZSBjaGFuZ2VzIG1hZGUgdG8gRWxlbWVudC1XZWIgLyBSZWFjdCBTREsgLyBKUyBTREsgdG8gZW5hYmxlIHNsaWRpbmcgc3luYy5cbiAqIFRoaXMgc3VtbWFyeSB3aWxsIGhvcGVmdWxseSBzaWducG9zdCB3aGVyZSBkZXZlbG9wZXJzIG5lZWQgdG8gbG9vayBpZiB0aGV5IHdhbnQgdG8gbWFrZSBjaGFuZ2VzIHRvIHRoaXMgY29kZS5cbiAqXG4gKiBBdCB0aGUgbG93ZXN0IGxldmVsLCB0aGUgSlMgU0RLIGNvbnRhaW5zIGFuIEhUVFAgQVBJIHdyYXBwZXIgZnVuY3Rpb24gaW4gY2xpZW50LnRzLiBUaGlzIGlzIHVzZWQgYnlcbiAqIGEgU2xpZGluZ1N5bmMgY2xhc3MgaW4gSlMgU0RLLCB3aGljaCBjb250YWlucyBjb2RlIHRvIGhhbmRsZSBsaXN0IG9wZXJhdGlvbnMgKElOU0VSVC9ERUxFVEUvU1lOQy9ldGMpXG4gKiBhbmQgY29udGFpbnMgdGhlIG1haW4gcmVxdWVzdCBBUEkgYm9kaWVzLCBidXQgaGFzIG5vIGNvZGUgdG8gY29udHJvbCB1cGRhdGluZyBKUyBTREsgc3RydWN0dXJlczogaXQganVzdFxuICogZXhwb3NlcyBhbiBFdmVudEVtaXR0ZXIgdG8gbGlzdGVuIGZvciB1cGRhdGVzLiBXaGVuIE1hdHJpeENsaWVudC5zdGFydENsaWVudCBpcyBjYWxsZWQsIGNhbGxlcnMgbmVlZCB0b1xuICogcHJvdmlkZSBhIFNsaWRpbmdTeW5jIGluc3RhbmNlIGFzIHRoaXMgY29udGFpbnMgdGhlIG1haW4gcmVxdWVzdCBBUEkgcGFyYW1zICh0aW1lbGluZSBsaW1pdCwgcmVxdWlyZWQgc3RhdGUsXG4gKiBob3cgbWFueSBsaXN0cywgZXRjKS5cbiAqXG4gKiBUaGUgU2xpZGluZ1N5bmNTZGsgSU5URVJOQUwgY2xhc3MgaW4gSlMgU0RLIGF0dGFjaGVzIGxpc3RlbmVycyB0byBTbGlkaW5nU3luYyB0byB1cGRhdGUgSlMgU0RLIFJvb20gb2JqZWN0cyxcbiAqIGFuZCBpdCBjb252ZW5pZW50bHkgZXhwb3NlcyBhbiBpZGVudGljYWwgcHVibGljIEFQSSB0byBTeW5jQXBpICh0byBhbGxvdyBpdCB0byBiZSBhIGRyb3AtaW4gcmVwbGFjZW1lbnQpLlxuICpcbiAqIEF0IHRoZSBoaWdoZXN0IGxldmVsLCBTbGlkaW5nU3luY01hbmFnZXIgY29udGFpbnMgbWVjaGFuaXNtcyB0byB0ZWxsIFVJIGxpc3RzIHdoaWNoIHJvb21zIHRvIHNob3csXG4gKiBhbmQgY29udGFpbnMgdGhlIGNvcmUgcmVxdWVzdCBBUEkgcGFyYW1zIHVzZWQgaW4gRWxlbWVudC1XZWIuIEl0IGRvZXMgdGhpcyBieSBsaXN0ZW5pbmcgZm9yIGV2ZW50c1xuICogZW1pdHRlZCBieSB0aGUgU2xpZGluZ1N5bmMgY2xhc3MgYW5kIGJ5IG1vZGlmeWluZyB0aGUgcmVxdWVzdCBBUEkgcGFyYW1zIG9uIHRoZSBTbGlkaW5nU3luYyBjbGFzcy5cbiAqXG4gKiAgICAoZW50cnkgcG9pbnQpICAgICAgICAgICAgICAgICAgICAgKHVwZGF0ZXMgSlMgU0RLKVxuICogIFNsaWRpbmdTeW5jTWFuYWdlciAgICAgICAgICAgICAgICAgICBTbGlkaW5nU3luY1Nka1xuICogICAgICAgfCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8XG4gKiAgICAgICArLS0tLS0tLS0tLS0tLS0tLS0tLi0tLS0tLS0tLS0tLS0tLS0tLStcbiAqICAgICAgICAgbGlzdGVucyAgICAgICAgICB8ICAgICAgICAgIGxpc3RlbnNcbiAqICAgICAgICAgICAgICAgICAgICAgU2xpZGluZ1N5bmNcbiAqICAgICAgICAgICAgICAgICAgICAgKHN5bmMgbG9vcCxcbiAqICAgICAgICAgICAgICAgICAgICAgIGxpc3Qgb3BzKVxuICovXG5cbmltcG9ydCB7IE1hdHJpeENsaWVudCB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9tYXRyaXhcIjtcbmltcG9ydCB7IEV2ZW50VHlwZSB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9AdHlwZXMvZXZlbnRcIjtcbmltcG9ydCB7XG4gICAgTVNDMzU3NUZpbHRlcixcbiAgICBNU0MzNTc1TGlzdCxcbiAgICBNU0MzNTc1X1NUQVRFX0tFWV9MQVpZLFxuICAgIE1TQzM1NzVfU1RBVEVfS0VZX01FLFxuICAgIE1TQzM1NzVfV0lMRENBUkQsXG4gICAgU2xpZGluZ1N5bmMsXG59IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9zbGlkaW5nLXN5bmNcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9sb2dnZXJcIjtcbmltcG9ydCB7IElEZWZlcnJlZCwgZGVmZXIsIHNsZWVwIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL3V0aWxzXCI7XG5cbi8vIGhvdyBsb25nIHRvIGxvbmcgcG9sbCBmb3JcbmNvbnN0IFNMSURJTkdfU1lOQ19USU1FT1VUX01TID0gMjAgKiAxMDAwO1xuXG4vLyB0aGUgdGhpbmdzIHRvIGZldGNoIHdoZW4gYSB1c2VyIGNsaWNrcyBvbiBhIHJvb21cbmNvbnN0IERFRkFVTFRfUk9PTV9TVUJTQ1JJUFRJT05fSU5GTyA9IHtcbiAgICB0aW1lbGluZV9saW1pdDogNTAsXG4gICAgLy8gbWlzc2luZyByZXF1aXJlZF9zdGF0ZSB3aGljaCB3aWxsIGNoYW5nZSBkZXBlbmRpbmcgb24gdGhlIGtpbmQgb2Ygcm9vbVxuICAgIGluY2x1ZGVfb2xkX3Jvb21zOiB7XG4gICAgICAgIHRpbWVsaW5lX2xpbWl0OiAwLFxuICAgICAgICByZXF1aXJlZF9zdGF0ZTogW1xuICAgICAgICAgICAgLy8gc3RhdGUgbmVlZGVkIHRvIGhhbmRsZSBzcGFjZSBuYXZpZ2F0aW9uIGFuZCB0b21ic3RvbmUgY2hhaW5zXG4gICAgICAgICAgICBbRXZlbnRUeXBlLlJvb21DcmVhdGUsIFwiXCJdLFxuICAgICAgICAgICAgW0V2ZW50VHlwZS5Sb29tVG9tYnN0b25lLCBcIlwiXSxcbiAgICAgICAgICAgIFtFdmVudFR5cGUuU3BhY2VDaGlsZCwgTVNDMzU3NV9XSUxEQ0FSRF0sXG4gICAgICAgICAgICBbRXZlbnRUeXBlLlNwYWNlUGFyZW50LCBNU0MzNTc1X1dJTERDQVJEXSxcbiAgICAgICAgICAgIFtFdmVudFR5cGUuUm9vbU1lbWJlciwgTVNDMzU3NV9TVEFURV9LRVlfTUVdLFxuICAgICAgICBdLFxuICAgIH0sXG59O1xuLy8gbGF6eSBsb2FkIHJvb20gbWVtYmVycyBzbyByb29tcyBsaWtlIE1hdHJpeCBIUSBkb24ndCB0YWtlIGZvcmV2ZXIgdG8gbG9hZFxuY29uc3QgVU5FTkNSWVBURURfU1VCU0NSSVBUSU9OX05BTUUgPSBcInVuZW5jcnlwdGVkXCI7XG5jb25zdCBVTkVOQ1JZUFRFRF9TVUJTQ1JJUFRJT04gPSBPYmplY3QuYXNzaWduKFxuICAgIHtcbiAgICAgICAgcmVxdWlyZWRfc3RhdGU6IFtcbiAgICAgICAgICAgIFtNU0MzNTc1X1dJTERDQVJELCBNU0MzNTc1X1dJTERDQVJEXSwgLy8gYWxsIGV2ZW50c1xuICAgICAgICAgICAgW0V2ZW50VHlwZS5Sb29tTWVtYmVyLCBNU0MzNTc1X1NUQVRFX0tFWV9NRV0sIC8vIGV4Y2VwdCBmb3IgbS5yb29tLm1lbWJlcnMsIGdldCBvdXIgb3duIG1lbWJlcnNoaXBcbiAgICAgICAgICAgIFtFdmVudFR5cGUuUm9vbU1lbWJlciwgTVNDMzU3NV9TVEFURV9LRVlfTEFaWV0sIC8vIC4uLmFuZCBsYXp5IGxvYWQgdGhlIHJlc3QuXG4gICAgICAgIF0sXG4gICAgfSxcbiAgICBERUZBVUxUX1JPT01fU1VCU0NSSVBUSU9OX0lORk8sXG4pO1xuXG4vLyB3ZSBuZWVkIGFsbCB0aGUgcm9vbSBtZW1iZXJzIGluIGVuY3J5cHRlZCByb29tcyBiZWNhdXNlIHdlIG5lZWQgdG8ga25vdyB3aGljaCB1c2VycyB0byBlbmNyeXB0XG4vLyBtZXNzYWdlcyBmb3IuXG5jb25zdCBFTkNSWVBURURfU1VCU0NSSVBUSU9OID0gT2JqZWN0LmFzc2lnbihcbiAgICB7XG4gICAgICAgIHJlcXVpcmVkX3N0YXRlOiBbXG4gICAgICAgICAgICBbTVNDMzU3NV9XSUxEQ0FSRCwgTVNDMzU3NV9XSUxEQ0FSRF0sIC8vIGFsbCBldmVudHNcbiAgICAgICAgXSxcbiAgICB9LFxuICAgIERFRkFVTFRfUk9PTV9TVUJTQ1JJUFRJT05fSU5GTyxcbik7XG5cbmV4cG9ydCB0eXBlIFBhcnRpYWxTbGlkaW5nU3luY1JlcXVlc3QgPSB7XG4gICAgZmlsdGVycz86IE1TQzM1NzVGaWx0ZXI7XG4gICAgc29ydD86IHN0cmluZ1tdO1xuICAgIHJhbmdlcz86IFtzdGFydEluZGV4OiBudW1iZXIsIGVuZEluZGV4OiBudW1iZXJdW107XG59O1xuXG4vKipcbiAqIFRoaXMgY2xhc3MgbWFuYWdlcyB0aGUgZW50aXJldHkgb2Ygc2xpZGluZyBzeW5jIGF0IGEgaGlnaCBVSS9VWCBsZXZlbC4gSXQgY29udHJvbHMgdGhlIHBsYWNlbWVudFxuICogb2YgcGxhY2Vob2xkZXJzIGluIGxpc3RzLCBjb250cm9scyB1cGRhdGluZyBzbGlkaW5nIHdpbmRvdyByYW5nZXMsIGFuZCBjb250cm9scyB3aGljaCBldmVudHNcbiAqIGFyZSBwdWxsZWQgZG93biB3aGVuLiBUaGUgaW50ZW50aW9uIGJlaGluZCB0aGlzIG1hbmFnZXIgaXMgYmUgdGhlIHNpbmdsZSBwbGFjZSB0byBsb29rIGZvciBzbGlkaW5nXG4gKiBzeW5jIG9wdGlvbnMgYW5kIGNvZGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBTbGlkaW5nU3luY01hbmFnZXIge1xuICAgIHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgTGlzdFNwYWNlcyA9IFwic3BhY2VfbGlzdFwiO1xuICAgIHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgTGlzdFNlYXJjaCA9IFwic2VhcmNoX2xpc3RcIjtcbiAgICBwcml2YXRlIHN0YXRpYyByZWFkb25seSBpbnRlcm5hbEluc3RhbmNlID0gbmV3IFNsaWRpbmdTeW5jTWFuYWdlcigpO1xuXG4gICAgcHVibGljIHNsaWRpbmdTeW5jOiBTbGlkaW5nU3luYztcbiAgICBwcml2YXRlIGNsaWVudD86IE1hdHJpeENsaWVudDtcblxuICAgIHByaXZhdGUgY29uZmlndXJlRGVmZXI6IElEZWZlcnJlZDx2b2lkPjtcblxuICAgIHB1YmxpYyBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5jb25maWd1cmVEZWZlciA9IGRlZmVyPHZvaWQ+KCk7XG4gICAgfVxuXG4gICAgcHVibGljIHN0YXRpYyBnZXQgaW5zdGFuY2UoKTogU2xpZGluZ1N5bmNNYW5hZ2VyIHtcbiAgICAgICAgcmV0dXJuIFNsaWRpbmdTeW5jTWFuYWdlci5pbnRlcm5hbEluc3RhbmNlO1xuICAgIH1cblxuICAgIHB1YmxpYyBjb25maWd1cmUoY2xpZW50OiBNYXRyaXhDbGllbnQsIHByb3h5VXJsOiBzdHJpbmcpOiBTbGlkaW5nU3luYyB7XG4gICAgICAgIHRoaXMuY2xpZW50ID0gY2xpZW50O1xuICAgICAgICAvLyBieSBkZWZhdWx0IHVzZSB0aGUgZW5jcnlwdGVkIHN1YnNjcmlwdGlvbiBhcyB0aGF0IGdldHMgZXZlcnl0aGluZywgd2hpY2ggaXMgYSBzYWZlclxuICAgICAgICAvLyBkZWZhdWx0IHRoYW4gcG90ZW50aWFsbHkgbWlzc2luZyBtZW1iZXIgZXZlbnRzLlxuICAgICAgICB0aGlzLnNsaWRpbmdTeW5jID0gbmV3IFNsaWRpbmdTeW5jKFxuICAgICAgICAgICAgcHJveHlVcmwsXG4gICAgICAgICAgICBuZXcgTWFwKCksXG4gICAgICAgICAgICBFTkNSWVBURURfU1VCU0NSSVBUSU9OLFxuICAgICAgICAgICAgY2xpZW50LFxuICAgICAgICAgICAgU0xJRElOR19TWU5DX1RJTUVPVVRfTVMsXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMuc2xpZGluZ1N5bmMuYWRkQ3VzdG9tU3Vic2NyaXB0aW9uKFVORU5DUllQVEVEX1NVQlNDUklQVElPTl9OQU1FLCBVTkVOQ1JZUFRFRF9TVUJTQ1JJUFRJT04pO1xuICAgICAgICAvLyBzZXQgdGhlIHNwYWNlIGxpc3RcbiAgICAgICAgdGhpcy5zbGlkaW5nU3luYy5zZXRMaXN0KFNsaWRpbmdTeW5jTWFuYWdlci5MaXN0U3BhY2VzLCB7XG4gICAgICAgICAgICByYW5nZXM6IFtbMCwgMjBdXSxcbiAgICAgICAgICAgIHNvcnQ6IFtcImJ5X25hbWVcIl0sXG4gICAgICAgICAgICBzbG93X2dldF9hbGxfcm9vbXM6IHRydWUsXG4gICAgICAgICAgICB0aW1lbGluZV9saW1pdDogMCxcbiAgICAgICAgICAgIHJlcXVpcmVkX3N0YXRlOiBbXG4gICAgICAgICAgICAgICAgW0V2ZW50VHlwZS5Sb29tSm9pblJ1bGVzLCBcIlwiXSwgLy8gdGhlIHB1YmxpYyBpY29uIG9uIHRoZSByb29tIGxpc3RcbiAgICAgICAgICAgICAgICBbRXZlbnRUeXBlLlJvb21BdmF0YXIsIFwiXCJdLCAvLyBhbnkgcm9vbSBhdmF0YXJcbiAgICAgICAgICAgICAgICBbRXZlbnRUeXBlLlJvb21Ub21ic3RvbmUsIFwiXCJdLCAvLyBsZXRzIEpTIFNESyBoaWRlIHJvb21zIHdoaWNoIGFyZSBkZWFkXG4gICAgICAgICAgICAgICAgW0V2ZW50VHlwZS5Sb29tRW5jcnlwdGlvbiwgXCJcIl0sIC8vIGxldHMgcm9vbXMgYmUgY29uZmlndXJlZCBmb3IgRTJFRSBjb3JyZWN0bHlcbiAgICAgICAgICAgICAgICBbRXZlbnRUeXBlLlJvb21DcmVhdGUsIFwiXCJdLCAvLyBmb3IgaXNTcGFjZVJvb20gY2hlY2tzXG4gICAgICAgICAgICAgICAgW0V2ZW50VHlwZS5TcGFjZUNoaWxkLCBNU0MzNTc1X1dJTERDQVJEXSwgLy8gYWxsIHNwYWNlIGNoaWxkcmVuXG4gICAgICAgICAgICAgICAgW0V2ZW50VHlwZS5TcGFjZVBhcmVudCwgTVNDMzU3NV9XSUxEQ0FSRF0sIC8vIGFsbCBzcGFjZSBwYXJlbnRzXG4gICAgICAgICAgICAgICAgW0V2ZW50VHlwZS5Sb29tTWVtYmVyLCBNU0MzNTc1X1NUQVRFX0tFWV9NRV0sIC8vIGxldHMgdGhlIGNsaWVudCBjYWxjdWxhdGUgdGhhdCB3ZSBhcmUgaW4gZmFjdCBpbiB0aGUgcm9vbVxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIGluY2x1ZGVfb2xkX3Jvb21zOiB7XG4gICAgICAgICAgICAgICAgdGltZWxpbmVfbGltaXQ6IDAsXG4gICAgICAgICAgICAgICAgcmVxdWlyZWRfc3RhdGU6IFtcbiAgICAgICAgICAgICAgICAgICAgW0V2ZW50VHlwZS5Sb29tQ3JlYXRlLCBcIlwiXSxcbiAgICAgICAgICAgICAgICAgICAgW0V2ZW50VHlwZS5Sb29tVG9tYnN0b25lLCBcIlwiXSwgLy8gbGV0cyBKUyBTREsgaGlkZSByb29tcyB3aGljaCBhcmUgZGVhZFxuICAgICAgICAgICAgICAgICAgICBbRXZlbnRUeXBlLlNwYWNlQ2hpbGQsIE1TQzM1NzVfV0lMRENBUkRdLCAvLyBhbGwgc3BhY2UgY2hpbGRyZW5cbiAgICAgICAgICAgICAgICAgICAgW0V2ZW50VHlwZS5TcGFjZVBhcmVudCwgTVNDMzU3NV9XSUxEQ0FSRF0sIC8vIGFsbCBzcGFjZSBwYXJlbnRzXG4gICAgICAgICAgICAgICAgICAgIFtFdmVudFR5cGUuUm9vbU1lbWJlciwgTVNDMzU3NV9TVEFURV9LRVlfTUVdLCAvLyBsZXRzIHRoZSBjbGllbnQgY2FsY3VsYXRlIHRoYXQgd2UgYXJlIGluIGZhY3QgaW4gdGhlIHJvb21cbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZpbHRlcnM6IHtcbiAgICAgICAgICAgICAgICByb29tX3R5cGVzOiBbXCJtLnNwYWNlXCJdLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuY29uZmlndXJlRGVmZXIucmVzb2x2ZSgpO1xuICAgICAgICByZXR1cm4gdGhpcy5zbGlkaW5nU3luYztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbnN1cmUgdGhhdCB0aGlzIGxpc3QgaXMgcmVnaXN0ZXJlZC5cbiAgICAgKiBAcGFyYW0gbGlzdEtleSBUaGUgbGlzdCBrZXkgdG8gcmVnaXN0ZXJcbiAgICAgKiBAcGFyYW0gdXBkYXRlQXJncyBUaGUgZmllbGRzIHRvIHVwZGF0ZSBvbiB0aGUgbGlzdC5cbiAgICAgKiBAcmV0dXJucyBUaGUgY29tcGxldGUgbGlzdCByZXF1ZXN0IHBhcmFtc1xuICAgICAqL1xuICAgIHB1YmxpYyBhc3luYyBlbnN1cmVMaXN0UmVnaXN0ZXJlZChsaXN0S2V5OiBzdHJpbmcsIHVwZGF0ZUFyZ3M6IFBhcnRpYWxTbGlkaW5nU3luY1JlcXVlc3QpOiBQcm9taXNlPE1TQzM1NzVMaXN0PiB7XG4gICAgICAgIGxvZ2dlci5kZWJ1ZyhcImVuc3VyZUxpc3RSZWdpc3RlcmVkOjo6XCIsIGxpc3RLZXksIHVwZGF0ZUFyZ3MpO1xuICAgICAgICBhd2FpdCB0aGlzLmNvbmZpZ3VyZURlZmVyLnByb21pc2U7XG4gICAgICAgIGxldCBsaXN0ID0gdGhpcy5zbGlkaW5nU3luYy5nZXRMaXN0UGFyYW1zKGxpc3RLZXkpO1xuICAgICAgICBpZiAoIWxpc3QpIHtcbiAgICAgICAgICAgIGxpc3QgPSB7XG4gICAgICAgICAgICAgICAgcmFuZ2VzOiBbWzAsIDIwXV0sXG4gICAgICAgICAgICAgICAgc29ydDogW1wiYnlfbm90aWZpY2F0aW9uX2xldmVsXCIsIFwiYnlfcmVjZW5jeVwiXSxcbiAgICAgICAgICAgICAgICB0aW1lbGluZV9saW1pdDogMSwgLy8gbW9zdCByZWNlbnQgbWVzc2FnZSBkaXNwbGF5OiB0aG91Z2ggdGhpcyBzZWVtcyB0byBvbmx5IGJlIG5lZWRlZCBmb3IgZmF2b3VyaXRlcz9cbiAgICAgICAgICAgICAgICByZXF1aXJlZF9zdGF0ZTogW1xuICAgICAgICAgICAgICAgICAgICBbRXZlbnRUeXBlLlJvb21Kb2luUnVsZXMsIFwiXCJdLCAvLyB0aGUgcHVibGljIGljb24gb24gdGhlIHJvb20gbGlzdFxuICAgICAgICAgICAgICAgICAgICBbRXZlbnRUeXBlLlJvb21BdmF0YXIsIFwiXCJdLCAvLyBhbnkgcm9vbSBhdmF0YXJcbiAgICAgICAgICAgICAgICAgICAgW0V2ZW50VHlwZS5Sb29tVG9tYnN0b25lLCBcIlwiXSwgLy8gbGV0cyBKUyBTREsgaGlkZSByb29tcyB3aGljaCBhcmUgZGVhZFxuICAgICAgICAgICAgICAgICAgICBbRXZlbnRUeXBlLlJvb21FbmNyeXB0aW9uLCBcIlwiXSwgLy8gbGV0cyByb29tcyBiZSBjb25maWd1cmVkIGZvciBFMkVFIGNvcnJlY3RseVxuICAgICAgICAgICAgICAgICAgICBbRXZlbnRUeXBlLlJvb21DcmVhdGUsIFwiXCJdLCAvLyBmb3IgaXNTcGFjZVJvb20gY2hlY2tzXG4gICAgICAgICAgICAgICAgICAgIFtFdmVudFR5cGUuUm9vbU1lbWJlciwgTVNDMzU3NV9TVEFURV9LRVlfTUVdLCAvLyBsZXRzIHRoZSBjbGllbnQgY2FsY3VsYXRlIHRoYXQgd2UgYXJlIGluIGZhY3QgaW4gdGhlIHJvb21cbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIGluY2x1ZGVfb2xkX3Jvb21zOiB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVsaW5lX2xpbWl0OiAwLFxuICAgICAgICAgICAgICAgICAgICByZXF1aXJlZF9zdGF0ZTogW1xuICAgICAgICAgICAgICAgICAgICAgICAgW0V2ZW50VHlwZS5Sb29tQ3JlYXRlLCBcIlwiXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIFtFdmVudFR5cGUuUm9vbVRvbWJzdG9uZSwgXCJcIl0sIC8vIGxldHMgSlMgU0RLIGhpZGUgcm9vbXMgd2hpY2ggYXJlIGRlYWRcbiAgICAgICAgICAgICAgICAgICAgICAgIFtFdmVudFR5cGUuU3BhY2VDaGlsZCwgTVNDMzU3NV9XSUxEQ0FSRF0sIC8vIGFsbCBzcGFjZSBjaGlsZHJlblxuICAgICAgICAgICAgICAgICAgICAgICAgW0V2ZW50VHlwZS5TcGFjZVBhcmVudCwgTVNDMzU3NV9XSUxEQ0FSRF0sIC8vIGFsbCBzcGFjZSBwYXJlbnRzXG4gICAgICAgICAgICAgICAgICAgICAgICBbRXZlbnRUeXBlLlJvb21NZW1iZXIsIE1TQzM1NzVfU1RBVEVfS0VZX01FXSwgLy8gbGV0cyB0aGUgY2xpZW50IGNhbGN1bGF0ZSB0aGF0IHdlIGFyZSBpbiBmYWN0IGluIHRoZSByb29tXG4gICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBsaXN0ID0gT2JqZWN0LmFzc2lnbihsaXN0LCB1cGRhdGVBcmdzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHVwZGF0ZWRMaXN0ID0gT2JqZWN0LmFzc2lnbih7fSwgbGlzdCwgdXBkYXRlQXJncyk7XG4gICAgICAgICAgICAvLyBjYW5ub3QgdXNlIG9iamVjdEhhc0RpZmYgYXMgd2UgbmVlZCB0byBkbyBkZWVwIGRpZmYgY2hlY2tpbmdcbiAgICAgICAgICAgIGlmIChKU09OLnN0cmluZ2lmeShsaXN0KSA9PT0gSlNPTi5zdHJpbmdpZnkodXBkYXRlZExpc3QpKSB7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmRlYnVnKFwibGlzdCBtYXRjaGVzLCBub3Qgc2VuZGluZywgdXBkYXRlID0+IFwiLCB1cGRhdGVBcmdzKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbGlzdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxpc3QgPSB1cGRhdGVkTGlzdDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBpZiB3ZSBvbmx5IGhhdmUgcmFuZ2UgY2hhbmdlcyB0aGVuIGNhbGwgYSBkaWZmZXJlbnQgZnVuY3Rpb24gc28gd2UgZG9uJ3QgbnVrZSB0aGUgbGlzdCBmcm9tIGJlZm9yZVxuICAgICAgICAgICAgaWYgKHVwZGF0ZUFyZ3MucmFuZ2VzICYmIE9iamVjdC5rZXlzKHVwZGF0ZUFyZ3MpLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xpZGluZ1N5bmMuc2V0TGlzdFJhbmdlcyhsaXN0S2V5LCB1cGRhdGVBcmdzLnJhbmdlcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2xpZGluZ1N5bmMuc2V0TGlzdChsaXN0S2V5LCBsaXN0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBsb2dnZXIuZGVidWcoXCJlbnN1cmVMaXN0UmVnaXN0ZXJlZDogdXBkYXRlIGZhaWxlZCB0eG5faWQ9XCIsIGVycik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuc2xpZGluZ1N5bmMuZ2V0TGlzdFBhcmFtcyhsaXN0S2V5KSE7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHNldFJvb21WaXNpYmxlKHJvb21JZDogc3RyaW5nLCB2aXNpYmxlOiBib29sZWFuKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICAgICAgYXdhaXQgdGhpcy5jb25maWd1cmVEZWZlci5wcm9taXNlO1xuICAgICAgICBjb25zdCBzdWJzY3JpcHRpb25zID0gdGhpcy5zbGlkaW5nU3luYy5nZXRSb29tU3Vic2NyaXB0aW9ucygpO1xuICAgICAgICBpZiAodmlzaWJsZSkge1xuICAgICAgICAgICAgc3Vic2NyaXB0aW9ucy5hZGQocm9vbUlkKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN1YnNjcmlwdGlvbnMuZGVsZXRlKHJvb21JZCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgcm9vbSA9IHRoaXMuY2xpZW50Py5nZXRSb29tKHJvb21JZCk7XG4gICAgICAgIGxldCBzaG91bGRMYXp5TG9hZCA9ICF0aGlzLmNsaWVudD8uaXNSb29tRW5jcnlwdGVkKHJvb21JZCk7XG4gICAgICAgIGlmICghcm9vbSkge1xuICAgICAgICAgICAgLy8gZGVmYXVsdCB0byBzYWZldHk6IHJlcXVlc3QgYWxsIHN0YXRlIGlmIHdlIGNhbid0IHdvcmsgaXQgb3V0LiBUaGlzIGNhbiBoYXBwZW4gaWYgeW91XG4gICAgICAgICAgICAvLyByZWZyZXNoIHRoZSBhcHAgd2hpbHN0IHZpZXdpbmcgYSByb29tOiB3ZSBjYWxsIHNldFJvb21WaXNpYmxlIGJlZm9yZSB3ZSBrbm93IGFueXRoaW5nXG4gICAgICAgICAgICAvLyBhYm91dCB0aGUgcm9vbS5cbiAgICAgICAgICAgIHNob3VsZExhenlMb2FkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgbG9nZ2VyLmxvZyhcIlNsaWRpbmdTeW5jIHNldFJvb21WaXNpYmxlOlwiLCByb29tSWQsIHZpc2libGUsIFwic2hvdWxkTGF6eUxvYWQ6XCIsIHNob3VsZExhenlMb2FkKTtcbiAgICAgICAgaWYgKHNob3VsZExhenlMb2FkKSB7XG4gICAgICAgICAgICAvLyBsYXp5IGxvYWQgdGhpcyByb29tXG4gICAgICAgICAgICB0aGlzLnNsaWRpbmdTeW5jLnVzZUN1c3RvbVN1YnNjcmlwdGlvbihyb29tSWQsIFVORU5DUllQVEVEX1NVQlNDUklQVElPTl9OQU1FKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwID0gdGhpcy5zbGlkaW5nU3luYy5tb2RpZnlSb29tU3Vic2NyaXB0aW9ucyhzdWJzY3JpcHRpb25zKTtcbiAgICAgICAgaWYgKHJvb20pIHtcbiAgICAgICAgICAgIHJldHVybiByb29tSWQ7IC8vIHdlIGhhdmUgZGF0YSBhbHJlYWR5IGZvciB0aGlzIHJvb20sIHNob3cgaW1tZWRpYXRlbHkgZS5nIGl0J3MgaW4gYSBsaXN0XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIHdhaXQgdW50aWwgdGhlIG5leHQgc3luYyBiZWZvcmUgcmV0dXJuaW5nIGFzIFJvb21WaWV3IG1heSBuZWVkIHRvIGtub3cgdGhlIGN1cnJlbnQgc3RhdGVcbiAgICAgICAgICAgIGF3YWl0IHA7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgbG9nZ2VyLndhcm4oXCJTbGlkaW5nU3luYyBzZXRSb29tVmlzaWJsZTpcIiwgcm9vbUlkLCB2aXNpYmxlLCBcImZhaWxlZCB0byBjb25maXJtIHRyYW5zYWN0aW9uXCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByb29tSWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0cmlldmUgYWxsIHJvb21zIG9uIHRoZSB1c2VyJ3MgYWNjb3VudC4gVXNlZCBmb3IgcHJlLXBvcHVsYXRpbmcgdGhlIGxvY2FsIHNlYXJjaCBjYWNoZS5cbiAgICAgKiBSZXRyaWV2YWwgaXMgZ3JhZHVhbCBvdmVyIHRpbWUuXG4gICAgICogQHBhcmFtIGJhdGNoU2l6ZSBUaGUgbnVtYmVyIG9mIHJvb21zIHRvIHJldHVybiBpbiBlYWNoIHJlcXVlc3QuXG4gICAgICogQHBhcmFtIGdhcEJldHdlZW5SZXF1ZXN0c01zIFRoZSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIHRvIHdhaXQgYmV0d2VlbiByZXF1ZXN0cy5cbiAgICAgKi9cbiAgICBwdWJsaWMgYXN5bmMgc3RhcnRTcGlkZXJpbmcoYmF0Y2hTaXplOiBudW1iZXIsIGdhcEJldHdlZW5SZXF1ZXN0c01zOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgYXdhaXQgc2xlZXAoZ2FwQmV0d2VlblJlcXVlc3RzTXMpOyAvLyB3YWl0IGEgYml0IGFzIHRoaXMgaXMgY2FsbGVkIG9uIGZpcnN0IHJlbmRlciBzbyBsZXQncyBsZXQgdGhpbmdzIGxvYWRcbiAgICAgICAgbGV0IHN0YXJ0SW5kZXggPSBiYXRjaFNpemU7XG4gICAgICAgIGxldCBoYXNNb3JlID0gdHJ1ZTtcbiAgICAgICAgbGV0IGZpcnN0VGltZSA9IHRydWU7XG4gICAgICAgIHdoaWxlIChoYXNNb3JlKSB7XG4gICAgICAgICAgICBjb25zdCBlbmRJbmRleCA9IHN0YXJ0SW5kZXggKyBiYXRjaFNpemUgLSAxO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCByYW5nZXMgPSBbXG4gICAgICAgICAgICAgICAgICAgIFswLCBiYXRjaFNpemUgLSAxXSxcbiAgICAgICAgICAgICAgICAgICAgW3N0YXJ0SW5kZXgsIGVuZEluZGV4XSxcbiAgICAgICAgICAgICAgICBdO1xuICAgICAgICAgICAgICAgIGlmIChmaXJzdFRpbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGlkaW5nU3luYy5zZXRMaXN0KFNsaWRpbmdTeW5jTWFuYWdlci5MaXN0U2VhcmNoLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBlLmcgWzAsMTldIFsyMCwzOV0gdGhlbiBbMCwxOV0gWzQwLDU5XS4gV2Uga2VlcCBbMCwyMF0gY29uc3RhbnRseSB0byBlbnN1cmVcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFueSBjaGFuZ2VzIHRvIHRoZSBsaXN0IHdoaWxzdCBzcGlkZXJpbmcgYXJlIGNhdWdodC5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJhbmdlczogcmFuZ2VzLFxuICAgICAgICAgICAgICAgICAgICAgICAgc29ydDogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiYnlfcmVjZW5jeVwiLCAvLyB0aGlzIGxpc3QgaXNuJ3Qgc2hvd24gb24gdGhlIFVJIHNvIGp1c3Qgc29ydGluZyBieSB0aW1lc3RhbXAgaXMgZW5vdWdoXG4gICAgICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGltZWxpbmVfbGltaXQ6IDAsIC8vIHdlIG9ubHkgY2FyZSBhYm91dCB0aGUgcm9vbSBkZXRhaWxzLCBub3QgbWVzc2FnZXMgaW4gdGhlIHJvb21cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkX3N0YXRlOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgW0V2ZW50VHlwZS5Sb29tSm9pblJ1bGVzLCBcIlwiXSwgLy8gdGhlIHB1YmxpYyBpY29uIG9uIHRoZSByb29tIGxpc3RcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBbRXZlbnRUeXBlLlJvb21BdmF0YXIsIFwiXCJdLCAvLyBhbnkgcm9vbSBhdmF0YXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBbRXZlbnRUeXBlLlJvb21Ub21ic3RvbmUsIFwiXCJdLCAvLyBsZXRzIEpTIFNESyBoaWRlIHJvb21zIHdoaWNoIGFyZSBkZWFkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgW0V2ZW50VHlwZS5Sb29tRW5jcnlwdGlvbiwgXCJcIl0sIC8vIGxldHMgcm9vbXMgYmUgY29uZmlndXJlZCBmb3IgRTJFRSBjb3JyZWN0bHlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBbRXZlbnRUeXBlLlJvb21DcmVhdGUsIFwiXCJdLCAvLyBmb3IgaXNTcGFjZVJvb20gY2hlY2tzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgW0V2ZW50VHlwZS5Sb29tTWVtYmVyLCBNU0MzNTc1X1NUQVRFX0tFWV9NRV0sIC8vIGxldHMgdGhlIGNsaWVudCBjYWxjdWxhdGUgdGhhdCB3ZSBhcmUgaW4gZmFjdCBpbiB0aGUgcm9vbVxuICAgICAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdlIGRvbid0IGluY2x1ZGVfb2xkX3Jvb21zIGhlcmUgaW4gYW4gZWZmb3J0IHRvIHJlZHVjZSB0aGUgaW1wYWN0IG9mIHNwaWRlcmluZyBhbGwgcm9vbXNcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG9uIHRoZSB1c2VyJ3MgYWNjb3VudC4gVGhpcyBtZWFucyBzb21lIGRhdGEgaW4gdGhlIHNlYXJjaCBkaWFsb2cgcmVzdWx0cyBtYXkgYmUgaW5hY2N1cmF0ZVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZS5nIG1lbWJlcnNoaXAgb2Ygc3BhY2UsIGJ1dCB0aGlzIHdpbGwgYmUgY29ycmVjdGVkIHdoZW4gdGhlIHVzZXIgY2xpY2tzIG9uIHRoZSByb29tXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhcyB0aGUgZGlyZWN0IHJvb20gc3Vic2NyaXB0aW9uIGRvZXMgaW5jbHVkZSBvbGQgcm9vbSBpdGVyYXRpb25zLlxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsdGVyczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdlIGdldCBzcGFjZXMgdmlhIGEgZGlmZmVyZW50IGxpc3QsIHNvIGZpbHRlciB0aGVtIG91dFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5vdF9yb29tX3R5cGVzOiBbXCJtLnNwYWNlXCJdLFxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGlkaW5nU3luYy5zZXRMaXN0UmFuZ2VzKFNsaWRpbmdTeW5jTWFuYWdlci5MaXN0U2VhcmNoLCByYW5nZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIC8vIGRvIG5vdGhpbmcsIGFzIHdlIHJlamVjdCBvbmx5IHdoZW4gd2UgZ2V0IGludGVycnVwdGVkIGJ1dCB0aGF0J3MgZmluZSBhcyB0aGUgbmV4dFxuICAgICAgICAgICAgICAgIC8vIHJlcXVlc3Qgd2lsbCBpbmNsdWRlIG91ciBkYXRhXG4gICAgICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgICAgIC8vIGdyYWR1YWxseSByZXF1ZXN0IG1vcmUgb3ZlciB0aW1lLCBldmVuIG9uIGVycm9ycy5cbiAgICAgICAgICAgICAgICBhd2FpdCBzbGVlcChnYXBCZXR3ZWVuUmVxdWVzdHNNcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBsaXN0RGF0YSA9IHRoaXMuc2xpZGluZ1N5bmMuZ2V0TGlzdERhdGEoU2xpZGluZ1N5bmNNYW5hZ2VyLkxpc3RTZWFyY2gpITtcbiAgICAgICAgICAgIGhhc01vcmUgPSBlbmRJbmRleCArIDEgPCBsaXN0RGF0YS5qb2luZWRDb3VudDtcbiAgICAgICAgICAgIHN0YXJ0SW5kZXggKz0gYmF0Y2hTaXplO1xuICAgICAgICAgICAgZmlyc3RUaW1lID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG59XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBK0NBLElBQUFBLE1BQUEsR0FBQUMsT0FBQTtBQUNBLElBQUFDLFlBQUEsR0FBQUQsT0FBQTtBQVFBLElBQUFFLE9BQUEsR0FBQUYsT0FBQTtBQUNBLElBQUFHLE1BQUEsR0FBQUgsT0FBQTtBQXpEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFlQTtBQUNBLE1BQU1JLHVCQUF1QixHQUFHLEVBQUUsR0FBRyxJQUFJOztBQUV6QztBQUNBLE1BQU1DLDhCQUE4QixHQUFHO0VBQ25DQyxjQUFjLEVBQUUsRUFBRTtFQUNsQjtFQUNBQyxpQkFBaUIsRUFBRTtJQUNmRCxjQUFjLEVBQUUsQ0FBQztJQUNqQkUsY0FBYyxFQUFFO0lBQ1o7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