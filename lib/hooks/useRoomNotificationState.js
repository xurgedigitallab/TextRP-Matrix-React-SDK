"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useNotificationState = void 0;
var _react = require("react");
var _EchoChamber = require("../stores/local-echo/EchoChamber");
var _GenericEchoChamber = require("../stores/local-echo/GenericEchoChamber");
var _RoomEchoChamber = require("../stores/local-echo/RoomEchoChamber");
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

const useNotificationState = room => {
  const echoChamber = (0, _react.useMemo)(() => _EchoChamber.EchoChamber.forRoom(room), [room]);
  const [notificationState, setNotificationState] = (0, _react.useState)(echoChamber.notificationVolume);
  (0, _useEventEmitter.useEventEmitter)(echoChamber, _GenericEchoChamber.PROPERTY_UPDATED, key => {
    if (key === _RoomEchoChamber.CachedRoomKey.NotificationVolume && echoChamber.notificationVolume !== undefined) {
      setNotificationState(echoChamber.notificationVolume);
    }
  });
  const setter = (0, _react.useCallback)(state => echoChamber.notificationVolume = state, [echoChamber]);
  return [notificationState, setter];
};
exports.useNotificationState = useNotificationState;
//# sourceMappingURL=useRoomNotificationState.js.map