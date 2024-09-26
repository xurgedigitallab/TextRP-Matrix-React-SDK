"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RightPanelPhases = void 0;
exports.backLabelForPhase = backLabelForPhase;
var _languageHandler = require("../../languageHandler");
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
// These are in their own file because of circular imports being a problem.
let RightPanelPhases = /*#__PURE__*/function (RightPanelPhases) {
  RightPanelPhases["RoomMemberList"] = "RoomMemberList";
  RightPanelPhases["FilePanel"] = "FilePanel";
  RightPanelPhases["NotificationPanel"] = "NotificationPanel";
  RightPanelPhases["RoomMemberInfo"] = "RoomMemberInfo";
  RightPanelPhases["EncryptionPanel"] = "EncryptionPanel";
  RightPanelPhases["RoomSummary"] = "RoomSummary";
  RightPanelPhases["Widget"] = "Widget";
  RightPanelPhases["PinnedMessages"] = "PinnedMessages";
  RightPanelPhases["Timeline"] = "Timeline";
  RightPanelPhases["Room3pidMemberInfo"] = "Room3pidMemberInfo";
  RightPanelPhases["SpaceMemberList"] = "SpaceMemberList";
  RightPanelPhases["SpaceMemberInfo"] = "SpaceMemberInfo";
  RightPanelPhases["Space3pidMemberInfo"] = "Space3pidMemberInfo";
  RightPanelPhases["ThreadView"] = "ThreadView";
  RightPanelPhases["ThreadPanel"] = "ThreadPanel";
  return RightPanelPhases;
}({});
exports.RightPanelPhases = RightPanelPhases;
function backLabelForPhase(phase) {
  switch (phase) {
    case RightPanelPhases.ThreadPanel:
      return (0, _languageHandler._t)("Threads");
    case RightPanelPhases.Timeline:
      return (0, _languageHandler._t)("Back to chat");
    case RightPanelPhases.RoomSummary:
      return (0, _languageHandler._t)("Room information");
    case RightPanelPhases.RoomMemberList:
      return (0, _languageHandler._t)("Room members");
    case RightPanelPhases.ThreadView:
      return (0, _languageHandler._t)("Back to thread");
  }
  return null;
}
//# sourceMappingURL=RightPanelStorePhases.js.map