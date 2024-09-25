"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useRoomMembers = exports.useRoomMemberCount = exports.useMyRoomMembership = void 0;
var _react = require("react");
var _room = require("matrix-js-sdk/src/models/room");
var _roomState = require("matrix-js-sdk/src/models/room-state");
var _lodash = require("lodash");
var _useEventEmitter = require("./useEventEmitter");
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

// Hook to simplify watching Matrix Room joined members
const useRoomMembers = function (room) {
  let throttleWait = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 250;
  const [members, setMembers] = (0, _react.useState)(room.getJoinedMembers());
  (0, _useEventEmitter.useTypedEventEmitter)(room.currentState, _roomState.RoomStateEvent.Update, (0, _lodash.throttle)(() => {
    setMembers(room.getJoinedMembers());
  }, throttleWait, {
    leading: true,
    trailing: true
  }));
  return members;
};

// Hook to simplify watching Matrix Room joined member count
exports.useRoomMembers = useRoomMembers;
const useRoomMemberCount = function (room) {
  let throttleWait = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 250;
  const [count, setCount] = (0, _react.useState)(room.getJoinedMemberCount());
  (0, _useEventEmitter.useTypedEventEmitter)(room.currentState, _roomState.RoomStateEvent.Update, (0, _lodash.throttle)(() => {
    setCount(room.getJoinedMemberCount());
  }, throttleWait, {
    leading: true,
    trailing: true
  }));
  return count;
};

// Hook to simplify watching the local user's membership in a room
exports.useRoomMemberCount = useRoomMemberCount;
const useMyRoomMembership = room => {
  const [membership, setMembership] = (0, _react.useState)(room.getMyMembership());
  (0, _useEventEmitter.useTypedEventEmitter)(room, _room.RoomEvent.MyMembership, () => {
    setMembership(room.getMyMembership());
  });
  return membership;
};
exports.useMyRoomMembership = useMyRoomMembership;
//# sourceMappingURL=useRoomMembers.js.map