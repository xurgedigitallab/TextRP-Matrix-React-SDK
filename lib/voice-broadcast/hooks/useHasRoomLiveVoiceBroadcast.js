"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useHasRoomLiveVoiceBroadcast = void 0;
var _react = require("react");
var _matrix = require("matrix-js-sdk/src/matrix");
var _hasRoomLiveVoiceBroadcast = require("../utils/hasRoomLiveVoiceBroadcast");
var _useEventEmitter = require("../../hooks/useEventEmitter");
var _SDKContext = require("../../contexts/SDKContext");
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

const useHasRoomLiveVoiceBroadcast = room => {
  const sdkContext = (0, _react.useContext)(_SDKContext.SDKContext);
  const [hasLiveVoiceBroadcast, setHasLiveVoiceBroadcast] = (0, _react.useState)(false);
  const update = (0, _react.useMemo)(() => {
    return sdkContext?.client ? () => {
      (0, _hasRoomLiveVoiceBroadcast.hasRoomLiveVoiceBroadcast)(sdkContext.client, room).then(_ref => {
        let {
          hasBroadcast
        } = _ref;
        setHasLiveVoiceBroadcast(hasBroadcast);
      }, () => {} // no update on error
      );
    } : () => {}; // noop without client
  }, [room, sdkContext, setHasLiveVoiceBroadcast]);
  (0, _react.useEffect)(() => {
    update();
  }, [update]);
  (0, _useEventEmitter.useTypedEventEmitter)(room.currentState, _matrix.RoomStateEvent.Update, () => update());
  return hasLiveVoiceBroadcast;
};
exports.useHasRoomLiveVoiceBroadcast = useHasRoomLiveVoiceBroadcast;
//# sourceMappingURL=useHasRoomLiveVoiceBroadcast.js.map