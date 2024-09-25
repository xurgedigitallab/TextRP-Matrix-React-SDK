"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.buildActivityScores = buildActivityScores;
exports.buildMemberScores = buildMemberScores;
exports.compareMembers = void 0;
var _lodash = require("lodash");
var _utils = require("matrix-js-sdk/src/utils");
var _DMRoomMap = _interopRequireDefault(require("./DMRoomMap"));
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

const compareMembers = (activityScores, memberScores) => (a, b) => {
  const aActivityScore = activityScores[a.userId]?.score ?? 0;
  const aMemberScore = memberScores[a.userId]?.score ?? 0;
  const aScore = aActivityScore + aMemberScore;
  const aNumRooms = memberScores[a.userId]?.numRooms ?? 0;
  const bActivityScore = activityScores[b.userId]?.score ?? 0;
  const bMemberScore = memberScores[b.userId]?.score ?? 0;
  const bScore = bActivityScore + bMemberScore;
  const bNumRooms = memberScores[b.userId]?.numRooms ?? 0;
  if (aScore === bScore) {
    if (aNumRooms === bNumRooms) {
      return (0, _utils.compare)(a.userId, b.userId);
    }
    return bNumRooms - aNumRooms;
  }
  return bScore - aScore;
};
exports.compareMembers = compareMembers;
function joinedRooms(cli) {
  return cli.getRooms().filter(r => r.getMyMembership() === "join")
  // Skip low priority rooms and DMs
  .filter(r => !_DMRoomMap.default.shared().getUserIdForRoomId(r.roomId)).filter(r => !Object.keys(r.tags).includes("m.lowpriority"));
}
// Score people based on who have sent messages recently, as a way to improve the quality of suggestions.
// We do this by checking every room to see who has sent a message in the last few hours, and giving them
// a score which correlates to the freshness of their message. In theory, this results in suggestions
// which are closer to "continue this conversation" rather than "this person exists".
function buildActivityScores(cli) {
  const now = new Date().getTime();
  const earliestAgeConsidered = now - 60 * 60 * 1000; // 1 hour ago
  const maxMessagesConsidered = 50; // so we don't iterate over a huge amount of traffic
  const events = joinedRooms(cli).flatMap(room => (0, _lodash.takeRight)(room.getLiveTimeline().getEvents(), maxMessagesConsidered)).filter(ev => ev.getTs() > earliestAgeConsidered);
  const senderEvents = (0, _lodash.groupBy)(events, ev => ev.getSender());
  // If the iteratee in mapValues returns undefined that key will be removed from the resultant object
  return (0, _lodash.mapValues)(senderEvents, events => {
    if (!events.length) return;
    const lastEvent = (0, _lodash.maxBy)(events, ev => ev.getTs());
    const distanceFromNow = Math.abs(now - lastEvent.getTs()); // abs to account for slight future messages
    const inverseTime = now - earliestAgeConsidered - distanceFromNow;
    return {
      lastSpoke: lastEvent.getTs(),
      // Scores from being in a room give a 'good' score of about 1.0-1.5, so for our
      // score we'll try and award at least 1.0 for making the list, with 4.0 being
      // an approximate maximum for being selected.
      score: Math.max(1, inverseTime / (15 * 60 * 1000)) // 15min segments to keep scores sane
    };
  });
}

function buildMemberScores(cli) {
  const maxConsideredMembers = 200;
  const consideredRooms = joinedRooms(cli).filter(room => room.getJoinedMemberCount() < maxConsideredMembers);
  const memberPeerEntries = consideredRooms.flatMap(room => room.getJoinedMembers().map(member => ({
    member,
    roomSize: room.getJoinedMemberCount()
  })));
  const userMeta = (0, _lodash.groupBy)(memberPeerEntries, _ref => {
    let {
      member
    } = _ref;
    return member.userId;
  });
  // If the iteratee in mapValues returns undefined that key will be removed from the resultant object
  return (0, _lodash.mapValues)(userMeta, roomMemberships => {
    if (!roomMemberships.length) return;
    const maximumPeers = maxConsideredMembers * roomMemberships.length;
    const totalPeers = (0, _lodash.sumBy)(roomMemberships, entry => entry.roomSize);
    return {
      member: (0, _lodash.minBy)(roomMemberships, entry => entry.roomSize).member,
      numRooms: roomMemberships.length,
      score: Math.max(0, Math.pow(1 - totalPeers / maximumPeers, 5))
    };
  });
}
//# sourceMappingURL=SortMembers.js.map