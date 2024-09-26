"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.shouldEncryptRoomWithSingle3rdPartyInvite = void 0;
var _DMRoomMap = _interopRequireDefault(require("../DMRoomMap"));
var _rooms = require("../rooms");
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
 * Tests whether a DM room with exactly one third-party invite should be encrypted.
 * If it should be encrypted, the third-party invitation event is also returned.
 */
const shouldEncryptRoomWithSingle3rdPartyInvite = room => {
  // encryption not promoted via .well-known
  if (!(0, _rooms.privateShouldBeEncrypted)(room.client)) return {
    shouldEncrypt: false
  };

  // not a DM room
  if (!_DMRoomMap.default.shared().getRoomIds().has(room.roomId)) return {
    shouldEncrypt: false
  };

  // more than one room member / invite
  if (room.getInvitedAndJoinedMemberCount() !== 1) return {
    shouldEncrypt: false
  };
  const thirdPartyInvites = room.currentState.getStateEvents("m.room.third_party_invite") || [];
  if (thirdPartyInvites.length === 1) {
    return {
      shouldEncrypt: true,
      inviteEvent: thirdPartyInvites[0]
    };
  }
  return {
    shouldEncrypt: false
  };
};
exports.shouldEncryptRoomWithSingle3rdPartyInvite = shouldEncryptRoomWithSingle3rdPartyInvite;
//# sourceMappingURL=shouldEncryptRoomWithSingle3rdPartyInvite.js.map