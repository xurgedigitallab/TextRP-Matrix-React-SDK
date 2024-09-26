"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RecentAlgorithm = void 0;
exports.shouldCauseReorder = shouldCauseReorder;
exports.sortRooms = void 0;
var _event = require("matrix-js-sdk/src/@types/event");
var _MatrixClientPeg = require("../../../../MatrixClientPeg");
var Unread = _interopRequireWildcard(require("../../../../Unread"));
var _membership = require("../../../../utils/membership");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
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

function shouldCauseReorder(event) {
  const type = event.getType();
  const content = event.getContent();
  const prevContent = event.getPrevContent();

  // Never ignore membership changes
  if (type === _event.EventType.RoomMember && prevContent.membership !== content.membership) return true;

  // Ignore display name changes
  if (type === _event.EventType.RoomMember && prevContent.displayname !== content.displayname) return false;
  // Ignore avatar changes
  if (type === _event.EventType.RoomMember && prevContent.avatar_url !== content.avatar_url) return false;
  return true;
}
const sortRooms = rooms => {
  // We cache the timestamp lookup to avoid iterating forever on the timeline
  // of events. This cache only survives a single sort though.
  // We wouldn't need this if `.sort()` didn't constantly try and compare all
  // of the rooms to each other.

  // TODO: We could probably improve the sorting algorithm here by finding changes.
  // See https://github.com/vector-im/element-web/issues/14459
  // For example, if we spent a little bit of time to determine which elements have
  // actually changed (probably needs to be done higher up?) then we could do an
  // insertion sort or similar on the limited set of changes.

  // TODO: Don't assume we're using the same client as the peg
  // See https://github.com/vector-im/element-web/issues/14458
  let myUserId = "";
  if (_MatrixClientPeg.MatrixClientPeg.get()) {
    myUserId = _MatrixClientPeg.MatrixClientPeg.get().getUserId();
  }
  const tsCache = {};
  return rooms.sort((a, b) => {
    const roomALastTs = tsCache[a.roomId] ?? getLastTs(a, myUserId);
    const roomBLastTs = tsCache[b.roomId] ?? getLastTs(b, myUserId);
    tsCache[a.roomId] = roomALastTs;
    tsCache[b.roomId] = roomBLastTs;
    return roomBLastTs - roomALastTs;
  });
};
exports.sortRooms = sortRooms;
const getLastTs = (r, userId) => {
  const mainTimelineLastTs = (() => {
    // Apparently we can have rooms without timelines, at least under testing
    // environments. Just return MAX_INT when this happens.
    if (!r?.timeline) {
      return Number.MAX_SAFE_INTEGER;
    }

    // If the room hasn't been joined yet, it probably won't have a timeline to
    // parse. We'll still fall back to the timeline if this fails, but chances
    // are we'll at least have our own membership event to go off of.
    const effectiveMembership = (0, _membership.getEffectiveMembership)(r.getMyMembership());
    if (effectiveMembership !== _membership.EffectiveMembership.Join) {
      const membershipEvent = r.currentState.getStateEvents(_event.EventType.RoomMember, userId);
      if (membershipEvent && !Array.isArray(membershipEvent)) {
        return membershipEvent.getTs();
      }
    }
    for (let i = r.timeline.length - 1; i >= 0; --i) {
      const ev = r.timeline[i];
      if (!ev.getTs()) continue; // skip events that don't have timestamps (tests only?)

      if (ev.getSender() === userId && shouldCauseReorder(ev) || Unread.eventTriggersUnreadCount(r.client, ev)) {
        return ev.getTs();
      }
    }

    // we might only have events that don't trigger the unread indicator,
    // in which case use the oldest event even if normally it wouldn't count.
    // This is better than just assuming the last event was forever ago.
    return r.timeline[0]?.getTs() ?? Number.MAX_SAFE_INTEGER;
  })();
  const threadLastEventTimestamps = r.getThreads().map(thread => {
    const event = thread.replyToEvent ?? thread.rootEvent;
    return event?.getTs() ?? 0;
  });
  return Math.max(mainTimelineLastTs, ...threadLastEventTimestamps);
};

/**
 * Sorts rooms according to the last event's timestamp in each room that seems
 * useful to the user.
 */
class RecentAlgorithm {
  sortRooms(rooms, tagId) {
    return sortRooms(rooms);
  }
  getLastTs(room, userId) {
    return getLastTs(room, userId);
  }
}
exports.RecentAlgorithm = RecentAlgorithm;
//# sourceMappingURL=RecentAlgorithm.js.map