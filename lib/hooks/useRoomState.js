"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useRoomState = void 0;
var _react = require("react");
var _roomState = require("matrix-js-sdk/src/models/room-state");
var _useEventEmitter = require("./useEventEmitter");
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

const defaultMapper = roomState => roomState;

// Hook to simplify watching Matrix Room state
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint
const useRoomState = function (room) {
  let mapper = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : defaultMapper;
  const [value, setValue] = (0, _react.useState)(room ? mapper(room.currentState) : undefined);
  const update = (0, _react.useCallback)(() => {
    if (!room) return;
    setValue(mapper(room.currentState));
  }, [room, mapper]);
  (0, _useEventEmitter.useTypedEventEmitter)(room?.currentState, _roomState.RoomStateEvent.Update, update);
  (0, _react.useEffect)(() => {
    update();
    return () => {
      setValue(room ? mapper(room.currentState) : undefined);
    };
  }, [room, mapper, update]);
  return value;
};
exports.useRoomState = useRoomState;
//# sourceMappingURL=useRoomState.js.map