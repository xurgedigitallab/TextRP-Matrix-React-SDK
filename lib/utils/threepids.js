"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.resolveThreePids = exports.lookupThreePids = exports.lookupThreePidProfiles = void 0;
var _directMessages = require("./direct-messages");
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

/**
 * Tries to resolve the ThreepidMembers to DirectoryMembers.
 *
 * @param members - List of members to resolve
 * @returns {Promise<Member[]>} Same list with ThreepidMembers replaced by DirectoryMembers if succesfully resolved
 */
const resolveThreePids = async (members, client) => {
  const threePidMembers = members.filter(m => m instanceof _directMessages.ThreepidMember);

  // Nothing to do here
  if (threePidMembers.length === 0) return members;
  const lookedUpProfiles = await lookupThreePidProfiles(threePidMembers, client);
  return members.map(member => {
    if (!(member instanceof _directMessages.ThreepidMember)) return member;
    const lookedUpProfile = lookedUpProfiles.find(r => r.threePidId === member.userId);

    // No profile found for this member; use the ThreepidMember.
    if (!lookedUpProfile) return member;
    return new _directMessages.DirectoryMember({
      user_id: lookedUpProfile.mxid,
      avatar_url: lookedUpProfile?.profile?.avatar_url,
      display_name: lookedUpProfile?.profile?.displayname
    });
  });
};

/**
 * Tries to look up the ThreepidMembers.
 *
 * @param threePids - List of 3rd-party members to look up
 * @returns  List of resolved 3rd-party IDs with their MXIDs
 */
exports.resolveThreePids = resolveThreePids;
const lookupThreePids = async (threePids, client) => {
  // No identity server configured. Unable to resolve any 3rd party member.
  if (!client.identityServer) return [];

  // Nothing we can search, return null
  if (threePids.length === 0) return [];
  const token = await client.identityServer.getAccessToken();
  if (!token) return [];
  const lookedUp = await client.bulkLookupThreePids(threePids.map(t => [t.isEmail ? "email" : "msisdn", t.userId]), token);
  return lookedUp.threepids.map(_ref => {
    let [_threePidType, threePidId, mxid] = _ref;
    return {
      threePidId,
      mxid
    };
  });
};

/**
 * Tries to look up the MXIDs and profiles of the ThreepidMembers.
 *
 * @param threePids - List of 3rd-prty members to look up
 * @returns List of resolved 3rd-party members with their MXIDs and profile (if found)
 */
exports.lookupThreePids = lookupThreePids;
const lookupThreePidProfiles = async (threePids, client) => {
  const lookedUpThreePids = await lookupThreePids(threePids, client);
  const promises = lookedUpThreePids.map(async t => {
    let profile = null;
    try {
      profile = await client.getProfileInfo(t.mxid);
    } catch {
      // ignore any lookup error
    }
    return {
      threePidId: t.threePidId,
      mxid: t.mxid,
      profile
    };
  });
  return Promise.all(promises);
};
exports.lookupThreePidProfiles = lookupThreePidProfiles;
//# sourceMappingURL=threepids.js.map