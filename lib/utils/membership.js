"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.EffectiveMembership = void 0;
exports.getEffectiveMembership = getEffectiveMembership;
exports.isJoinedOrNearlyJoined = isJoinedOrNearlyJoined;
exports.splitRoomsByMembership = splitRoomsByMembership;
exports.waitForMember = waitForMember;
var _roomState = require("matrix-js-sdk/src/models/room-state");
/*
Copyright 2020 - 2022 The Matrix.org Foundation C.I.C.

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
 * Approximation of a membership status for a given room.
 */
let EffectiveMembership = /*#__PURE__*/function (EffectiveMembership) {
  EffectiveMembership["Join"] = "JOIN";
  EffectiveMembership["Invite"] = "INVITE";
  EffectiveMembership["Leave"] = "LEAVE";
  return EffectiveMembership;
}({});
exports.EffectiveMembership = EffectiveMembership;
function splitRoomsByMembership(rooms) {
  const split = {
    [EffectiveMembership.Invite]: [],
    [EffectiveMembership.Join]: [],
    [EffectiveMembership.Leave]: []
  };
  for (const room of rooms) {
    split[getEffectiveMembership(room.getMyMembership())].push(room);
  }
  return split;
}
function getEffectiveMembership(membership) {
  if (membership === "invite") {
    return EffectiveMembership.Invite;
  } else if (membership === "join") {
    // TODO: Include knocks? Update docs as needed in the enum. https://github.com/vector-im/element-web/issues/14237
    return EffectiveMembership.Join;
  } else {
    // Probably a leave, kick, or ban
    return EffectiveMembership.Leave;
  }
}
function isJoinedOrNearlyJoined(membership) {
  const effective = getEffectiveMembership(membership);
  return effective === EffectiveMembership.Join || effective === EffectiveMembership.Invite;
}

/**
 * Try to ensure the user is already in the megolm session before continuing
 * NOTE: this assumes you've just created the room and there's not been an opportunity
 * for other code to run, so we shouldn't miss RoomState.newMember when it comes by.
 */
async function waitForMember(client, roomId, userId) {
  let opts = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {
    timeout: 1500
  };
  const {
    timeout
  } = opts;
  let handler;
  return new Promise(resolve => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    handler = function (_, __, member) {
      if (member.userId !== userId) return;
      if (member.roomId !== roomId) return;
      resolve(true);
    };
    client.on(_roomState.RoomStateEvent.NewMember, handler);

    /* We don't want to hang if this goes wrong, so we proceed and hope the other
       user is already in the megolm session */
    window.setTimeout(resolve, timeout, false);
  }).finally(() => {
    client.removeListener(_roomState.RoomStateEvent.NewMember, handler);
  });
}
//# sourceMappingURL=membership.js.map