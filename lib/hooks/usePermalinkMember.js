"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.usePermalinkMember = void 0;
var _matrix = require("matrix-js-sdk/src/matrix");
var _react = require("react");
var _Pill = require("../components/views/elements/Pill");
var _SDKContext = require("../contexts/SDKContext");
/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

const createMemberFromProfile = (userId, profile) => {
  const member = new _matrix.RoomMember("", userId);
  member.name = profile.displayname ?? userId;
  member.rawDisplayName = member.name;
  member.events.member = {
    getContent: () => {
      return {
        avatar_url: profile.avatar_url
      };
    },
    getDirectionalContent: function () {
      // eslint-disable-next-line
      return this.getContent();
    }
  };
  return member;
};

/**
 * Tries to determine the user Id of a permalink.
 * In case of a user permalink it is the user id.
 * In case of an event permalink it is the sender user Id of the event if that event is available.
 * Otherwise returns null.
 *
 * @param type - pill type
 * @param parseResult - permalink parse result
 * @param event - permalink event, if available
 * @returns permalink user Id. null if the Id cannot be determined.
 */
const determineUserId = (type, parseResult, event) => {
  if (type === null) return null;
  if (parseResult?.userId) return parseResult.userId;
  if (event && [_Pill.PillType.EventInSameRoom, _Pill.PillType.EventInOtherRoom].includes(type)) {
    return event.getSender() ?? null;
  }
  return null;
};

/**
 * Tries to determine a RoomMember.
 *
 * @param userId - User Id to get the member for
 * @param targetRoom - permalink target room
 * @returns RoomMember of the target room if it exists.
 *          If sharing at least one room with the user, then the result will be the profile fetched via API.
 *          null in all other cases.
 */
const determineMember = (userId, targetRoom) => {
  const targetRoomMember = targetRoom.getMember(userId);
  if (targetRoomMember) return targetRoomMember;
  const knownProfile = _SDKContext.SdkContextClass.instance.userProfilesStore.getOnlyKnownProfile(userId);
  if (knownProfile) {
    return createMemberFromProfile(userId, knownProfile);
  }
  return null;
};

/**
 * Hook to get the permalink member
 *
 * @param type - Permalink type
 * @param parseResult - Permalink parse result
 * @param targetRoom - Permalink target room {@link ./usePermalinkTargetRoom.ts}
 * @param event - Permalink event
 * @returns The permalink member:
 *          - The room member for a user mention
 *          - The sender for a permalink to an event in the same room
 *          - Null in other cases or the user cannot be loaded.
 */
const usePermalinkMember = (type, parseResult, targetRoom, event) => {
  // User mentions and permalinks to events in the same room require to know the user.
  // If it cannot be initially determined, it will be looked up later by a memo hook.
  const shouldLookUpUser = type && [_Pill.PillType.UserMention, _Pill.PillType.EventInSameRoom].includes(type);
  const userId = determineUserId(type, parseResult, event);
  const userInRoom = shouldLookUpUser && userId && targetRoom ? determineMember(userId, targetRoom) : null;
  const [member, setMember] = (0, _react.useState)(userInRoom);
  (0, _react.useEffect)(() => {
    if (!shouldLookUpUser || !userId || member) {
      // nothing to do here
      return;
    }
    const doProfileLookup = async () => {
      const fetchedProfile = await _SDKContext.SdkContextClass.instance.userProfilesStore.fetchOnlyKnownProfile(userId);
      if (fetchedProfile) {
        const newMember = createMemberFromProfile(userId, fetchedProfile);
        setMember(newMember);
      }
    };
    doProfileLookup();
  }, [member, shouldLookUpUser, targetRoom, userId]);
  return member;
};
exports.usePermalinkMember = usePermalinkMember;
//# sourceMappingURL=usePermalinkMember.js.map