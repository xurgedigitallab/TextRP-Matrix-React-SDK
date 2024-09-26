"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getSenderName = getSenderName;
exports.isSelf = isSelf;
exports.shouldPrefixMessagesIn = shouldPrefixMessagesIn;
var _MatrixClientPeg = require("../../../MatrixClientPeg");
var _models = require("../models");
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

function isSelf(event) {
  const selfUserId = _MatrixClientPeg.MatrixClientPeg.get().getSafeUserId();
  if (event.getType() === "m.room.member") {
    return event.getStateKey() === selfUserId;
  }
  return event.getSender() === selfUserId;
}
function shouldPrefixMessagesIn(roomId, tagId) {
  if (tagId !== _models.DefaultTagID.DM) return true;

  // We don't prefix anything in 1:1s
  const room = _MatrixClientPeg.MatrixClientPeg.get().getRoom(roomId);
  if (!room) return true;
  return room.currentState.getJoinedMemberCount() !== 2;
}
function getSenderName(event) {
  return event.sender?.name ?? event.getSender() ?? "";
}
//# sourceMappingURL=utils.js.map