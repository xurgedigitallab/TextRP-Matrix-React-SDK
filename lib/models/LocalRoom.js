"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.LocalRoomState = exports.LocalRoom = exports.LOCAL_ROOM_ID_PREFIX = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _matrix = require("matrix-js-sdk/src/matrix");
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

const LOCAL_ROOM_ID_PREFIX = "local+";
exports.LOCAL_ROOM_ID_PREFIX = LOCAL_ROOM_ID_PREFIX;
let LocalRoomState = /*#__PURE__*/function (LocalRoomState) {
  LocalRoomState[LocalRoomState["NEW"] = 0] = "NEW";
  LocalRoomState[LocalRoomState["CREATING"] = 1] = "CREATING";
  LocalRoomState[LocalRoomState["CREATED"] = 2] = "CREATED";
  LocalRoomState[LocalRoomState["ERROR"] = 3] = "ERROR";
  return LocalRoomState;
}({}); // error during room creation
/**
 * A local room that only exists client side.
 * Its main purpose is to be used for temporary rooms when creating a DM.
 */
exports.LocalRoomState = LocalRoomState;
class LocalRoom extends _matrix.Room {
  constructor(roomId, client, myUserId) {
    super(roomId, client, myUserId, {
      pendingEventOrdering: _matrix.PendingEventOrdering.Detached
    });
    /** Whether the actual room should be encrypted. */
    (0, _defineProperty2.default)(this, "encrypted", false);
    /** If the actual room has been created, this holds its ID. */
    (0, _defineProperty2.default)(this, "actualRoomId", void 0);
    /** DM chat partner */
    (0, _defineProperty2.default)(this, "targets", []);
    /** Callbacks that should be invoked after the actual room has been created. */
    (0, _defineProperty2.default)(this, "afterCreateCallbacks", []);
    (0, _defineProperty2.default)(this, "state", LocalRoomState.NEW);
    this.name = this.getDefaultRoomName(myUserId);
  }
  get isNew() {
    return this.state === LocalRoomState.NEW;
  }
  get isCreated() {
    return this.state === LocalRoomState.CREATED;
  }
  get isError() {
    return this.state === LocalRoomState.ERROR;
  }
}
exports.LocalRoom = LocalRoom;
//# sourceMappingURL=LocalRoom.js.map