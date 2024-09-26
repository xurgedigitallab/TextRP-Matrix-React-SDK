"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useParticipatingMembers = exports.useParticipants = exports.useParticipantCount = exports.useLayout = exports.useJoinCallButtonDisabledTooltip = exports.useFull = exports.useConnectionState = exports.useCallForWidget = exports.useCall = void 0;
var _react = require("react");
var _Call = require("../models/Call");
var _useEventEmitter = require("./useEventEmitter");
var _CallStore = require("../stores/CallStore");
var _SdkConfig = _interopRequireWildcard(require("../SdkConfig"));
var _languageHandler = require("../languageHandler");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
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

const useCall = roomId => {
  const [call, setCall] = (0, _react.useState)(() => _CallStore.CallStore.instance.getCall(roomId));
  (0, _useEventEmitter.useEventEmitter)(_CallStore.CallStore.instance, _CallStore.CallStoreEvent.Call, (call, forRoomId) => {
    if (forRoomId === roomId) setCall(call);
  });
  return call;
};
exports.useCall = useCall;
const useCallForWidget = (widgetId, roomId) => {
  const call = useCall(roomId);
  return call?.widget.id === widgetId ? call : null;
};
exports.useCallForWidget = useCallForWidget;
const useConnectionState = call => (0, _useEventEmitter.useTypedEventEmitterState)(call, _Call.CallEvent.ConnectionState, (0, _react.useCallback)(state => state ?? call.connectionState, [call]));
exports.useConnectionState = useConnectionState;
const useParticipants = call => (0, _useEventEmitter.useTypedEventEmitterState)(call, _Call.CallEvent.Participants, (0, _react.useCallback)(state => state ?? call.participants, [call]));
exports.useParticipants = useParticipants;
const useParticipantCount = call => {
  const participants = useParticipants(call);
  return (0, _react.useMemo)(() => {
    let count = 0;
    for (const devices of participants.values()) count += devices.size;
    return count;
  }, [participants]);
};
exports.useParticipantCount = useParticipantCount;
const useParticipatingMembers = call => {
  const participants = useParticipants(call);
  return (0, _react.useMemo)(() => {
    const members = [];
    for (const [member, devices] of participants) {
      // Repeat the member for as many devices as they're using
      for (let i = 0; i < devices.size; i++) members.push(member);
    }
    return members;
  }, [participants]);
};
exports.useParticipatingMembers = useParticipatingMembers;
const useFull = call => {
  return useParticipantCount(call) >= (_SdkConfig.default.get("element_call").participant_limit ?? _SdkConfig.DEFAULTS.element_call.participant_limit);
};
exports.useFull = useFull;
const useJoinCallButtonDisabledTooltip = call => {
  const isFull = useFull(call);
  const state = useConnectionState(call);
  if (state === _Call.ConnectionState.Connecting) return (0, _languageHandler._t)("Connecting");
  if (isFull) return (0, _languageHandler._t)("Sorry — this call is currently full");
  return null;
};
exports.useJoinCallButtonDisabledTooltip = useJoinCallButtonDisabledTooltip;
const useLayout = call => (0, _useEventEmitter.useTypedEventEmitterState)(call, _Call.CallEvent.Layout, (0, _react.useCallback)(state => state ?? call.layout, [call]));
exports.useLayout = useLayout;
//# sourceMappingURL=useCall.js.map