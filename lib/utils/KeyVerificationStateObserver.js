"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getNameForEventRoom = getNameForEventRoom;
exports.userLabelForEventRoom = userLabelForEventRoom;
var _languageHandler = require("../languageHandler");
/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

function getNameForEventRoom(matrixClient, userId, roomId) {
  const room = matrixClient.getRoom(roomId);
  const member = room && room.getMember(userId);
  return member ? member.name : userId;
}
function userLabelForEventRoom(matrixClient, userId, roomId) {
  const name = getNameForEventRoom(matrixClient, userId, roomId);
  if (name !== userId) {
    return (0, _languageHandler._t)("%(name)s (%(userId)s)", {
      name,
      userId
    });
  } else {
    return userId;
  }
}
//# sourceMappingURL=KeyVerificationStateObserver.js.map