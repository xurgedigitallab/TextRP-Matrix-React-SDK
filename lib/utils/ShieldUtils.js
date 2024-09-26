"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.E2EStatus = void 0;
exports.shieldStatusForRoom = shieldStatusForRoom;
var _logger = require("matrix-js-sdk/src/logger");
var _DMRoomMap = _interopRequireDefault(require("./DMRoomMap"));
var _arrays = require("./arrays");
/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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
let E2EStatus = /*#__PURE__*/function (E2EStatus) {
  E2EStatus["Warning"] = "warning";
  E2EStatus["Verified"] = "verified";
  E2EStatus["Normal"] = "normal";
  return E2EStatus;
}({});
exports.E2EStatus = E2EStatus;
async function shieldStatusForRoom(client, room) {
  const crypto = client.getCrypto();
  if (!crypto) {
    return E2EStatus.Warning;
  }
  const members = (await room.getEncryptionTargetMembers()).map(_ref => {
    let {
      userId
    } = _ref;
    return userId;
  });
  const inDMMap = !!_DMRoomMap.default.shared().getUserIdForRoomId(room.roomId);
  const verified = [];
  const unverified = [];
  members.filter(userId => userId !== client.getUserId()).forEach(userId => {
    (client.checkUserTrust(userId).isCrossSigningVerified() ? verified : unverified).push(userId);
  });

  /* Alarm if any unverified users were verified before. */
  for (const userId of unverified) {
    if (client.checkUserTrust(userId).wasCrossSigningVerified()) {
      return E2EStatus.Warning;
    }
  }

  /* Check all verified user devices. */
  /* Don't alarm if no other users are verified  */
  const includeUser = verified.length > 0 &&
  // Don't alarm for self in rooms where nobody else is verified
  !inDMMap &&
  // Don't alarm for self in DMs with other users
  members.length !== 2 ||
  // Don't alarm for self in 1:1 chats with other users
  members.length === 1; // Do alarm for self if we're alone in a room
  const targets = includeUser ? [...verified, client.getUserId()] : verified;
  const devicesByUser = await crypto.getUserDeviceInfo(targets);
  for (const userId of targets) {
    const devices = devicesByUser.get(userId);
    if (!devices) {
      // getUserDeviceInfo returned nothing about this user, which means we know nothing about their device list.
      // That seems odd, so treat it as a warning.
      _logger.logger.warn(`No device info for user ${userId}`);
      return E2EStatus.Warning;
    }
    const anyDeviceNotVerified = await (0, _arrays.asyncSome)(devices.keys(), async deviceId => {
      const verificationStatus = await crypto.getDeviceVerificationStatus(userId, deviceId);
      return !verificationStatus?.isVerified();
    });
    if (anyDeviceNotVerified) {
      return E2EStatus.Warning;
    }
  }
  return unverified.length === 0 ? E2EStatus.Verified : E2EStatus.Normal;
}
//# sourceMappingURL=ShieldUtils.js.map