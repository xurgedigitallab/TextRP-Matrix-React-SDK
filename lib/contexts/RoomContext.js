"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.TimelineRenderingType = void 0;
exports.useRoomContext = useRoomContext;
var _react = require("react");
var _Layout = require("../settings/enums/Layout");
/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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
let TimelineRenderingType = /*#__PURE__*/function (TimelineRenderingType) {
  TimelineRenderingType["Room"] = "Room";
  TimelineRenderingType["Thread"] = "Thread";
  TimelineRenderingType["ThreadsList"] = "ThreadsList";
  TimelineRenderingType["File"] = "File";
  TimelineRenderingType["Notification"] = "Notification";
  TimelineRenderingType["Search"] = "Search";
  TimelineRenderingType["Pinned"] = "Pinned";
  return TimelineRenderingType;
}({});
exports.TimelineRenderingType = TimelineRenderingType;
const RoomContext = /*#__PURE__*/(0, _react.createContext)({
  roomLoading: true,
  peekLoading: false,
  shouldPeek: true,
  membersLoaded: false,
  numUnreadMessages: 0,
  canPeek: false,
  showApps: false,
  isPeeking: false,
  showRightPanel: true,
  joining: false,
  showTopUnreadMessagesBar: false,
  statusBarVisible: false,
  canReact: false,
  canSelfRedact: false,
  canSendMessages: false,
  resizing: false,
  layout: _Layout.Layout.Group,
  lowBandwidth: false,
  alwaysShowTimestamps: false,
  showTwelveHourTimestamps: false,
  readMarkerInViewThresholdMs: 3000,
  readMarkerOutOfViewThresholdMs: 30000,
  showHiddenEvents: false,
  showReadReceipts: true,
  showRedactions: true,
  showJoinLeaves: true,
  showAvatarChanges: true,
  showDisplaynameChanges: true,
  matrixClientIsReady: false,
  showUrlPreview: false,
  timelineRenderingType: TimelineRenderingType.Room,
  threadId: undefined,
  liveTimeline: undefined,
  narrow: false,
  activeCall: null,
  msc3946ProcessDynamicPredecessor: false
});
RoomContext.displayName = "RoomContext";
var _default = RoomContext;
exports.default = _default;
function useRoomContext() {
  return (0, _react.useContext)(RoomContext);
}
//# sourceMappingURL=RoomContext.js.map