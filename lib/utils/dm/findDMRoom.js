"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.findDMRoom = findDMRoom;
var _DMRoomMap = _interopRequireDefault(require("../DMRoomMap"));
var _findDMForUser = require("./findDMForUser");
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

/**
 * Tries to find a DM room with some other users.
 *
 * @param {MatrixClient} client
 * @param {Member[]} targets The Members to try to find the room for
 * @returns {Room | null} Resolved so the room if found, else null
 */
function findDMRoom(client, targets) {
  const targetIds = targets.map(t => t.userId);
  let existingRoom;
  if (targetIds.length === 1) {
    existingRoom = (0, _findDMForUser.findDMForUser)(client, targetIds[0]) ?? null;
  } else {
    existingRoom = _DMRoomMap.default.shared().getDMRoomForIdentifiers(targetIds);
  }
  return existingRoom;
}
//# sourceMappingURL=findDMRoom.js.map