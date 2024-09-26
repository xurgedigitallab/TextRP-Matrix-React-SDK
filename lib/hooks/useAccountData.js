"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useRoomAccountData = exports.useAccountData = void 0;
var _react = require("react");
var _client = require("matrix-js-sdk/src/client");
var _room = require("matrix-js-sdk/src/models/room");
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

const tryGetContent = ev => ev?.getContent();

// Hook to simplify listening to Matrix account data
const useAccountData = (cli, eventType) => {
  const [value, setValue] = (0, _react.useState)(() => tryGetContent(cli.getAccountData(eventType)));
  const handler = (0, _react.useCallback)(event => {
    if (event.getType() !== eventType) return;
    setValue(event.getContent());
  }, [eventType]);
  (0, _useEventEmitter.useTypedEventEmitter)(cli, _client.ClientEvent.AccountData, handler);
  return value || {};
};

// Hook to simplify listening to Matrix room account data
exports.useAccountData = useAccountData;
const useRoomAccountData = (room, eventType) => {
  const [value, setValue] = (0, _react.useState)(() => tryGetContent(room.getAccountData(eventType)));
  const handler = (0, _react.useCallback)(event => {
    if (event.getType() !== eventType) return;
    setValue(event.getContent());
  }, [eventType]);
  (0, _useEventEmitter.useTypedEventEmitter)(room, _room.RoomEvent.AccountData, handler);
  return value || {};
};
exports.useRoomAccountData = useRoomAccountData;
//# sourceMappingURL=useAccountData.js.map