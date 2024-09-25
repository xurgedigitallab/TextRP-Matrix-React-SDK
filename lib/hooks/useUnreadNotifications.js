"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useUnreadNotifications = void 0;
var _room = require("matrix-js-sdk/src/models/room");
var _react = require("react");
var _RoomNotifs = require("../RoomNotifs");
var _NotificationColor = require("../stores/notifications/NotificationColor");
var _useEventEmitter = require("./useEventEmitter");
/*
Copyright 2022 - 2023 The Matrix.org Foundation C.I.C.

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

const useUnreadNotifications = (room, threadId) => {
  const [symbol, setSymbol] = (0, _react.useState)(null);
  const [count, setCount] = (0, _react.useState)(0);
  const [color, setColor] = (0, _react.useState)(_NotificationColor.NotificationColor.None);
  (0, _useEventEmitter.useEventEmitter)(room, _room.RoomEvent.UnreadNotifications, (unreadNotifications, evtThreadId) => {
    // Discarding all events not related to the thread if one has been setup
    if (threadId && threadId !== evtThreadId) return;
    updateNotificationState();
  });
  (0, _useEventEmitter.useEventEmitter)(room, _room.RoomEvent.Receipt, () => updateNotificationState());
  (0, _useEventEmitter.useEventEmitter)(room, _room.RoomEvent.Timeline, () => updateNotificationState());
  (0, _useEventEmitter.useEventEmitter)(room, _room.RoomEvent.Redaction, () => updateNotificationState());
  (0, _useEventEmitter.useEventEmitter)(room, _room.RoomEvent.LocalEchoUpdated, () => updateNotificationState());
  (0, _useEventEmitter.useEventEmitter)(room, _room.RoomEvent.MyMembership, () => updateNotificationState());
  const updateNotificationState = (0, _react.useCallback)(() => {
    const {
      symbol,
      count,
      color
    } = (0, _RoomNotifs.determineUnreadState)(room, threadId);
    setSymbol(symbol);
    setCount(count);
    setColor(color);
  }, [room, threadId]);
  (0, _react.useEffect)(() => {
    updateNotificationState();
  }, [updateNotificationState]);
  return {
    symbol,
    count,
    color
  };
};
exports.useUnreadNotifications = useUnreadNotifications;
//# sourceMappingURL=useUnreadNotifications.js.map