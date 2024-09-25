"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useIsEncrypted = useIsEncrypted;
var _react = require("react");
var _roomState = require("matrix-js-sdk/src/models/room-state");
var _event = require("matrix-js-sdk/src/@types/event");
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

// Hook to simplify watching whether a Matrix room is encrypted, returns undefined if room is undefined
function useIsEncrypted(cli, room) {
  const [isEncrypted, setIsEncrypted] = (0, _react.useState)(room ? cli.isRoomEncrypted(room.roomId) : undefined);
  const update = (0, _react.useCallback)(event => {
    if (room && event.getType() === _event.EventType.RoomEncryption) {
      setIsEncrypted(cli.isRoomEncrypted(room.roomId));
    }
  }, [cli, room]);
  (0, _useEventEmitter.useTypedEventEmitter)(room?.currentState, _roomState.RoomStateEvent.Events, update);
  return isEncrypted;
}
//# sourceMappingURL=useIsEncrypted.js.map