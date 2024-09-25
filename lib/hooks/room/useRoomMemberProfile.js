"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useRoomMemberProfile = useRoomMemberProfile;
var _react = require("react");
var _RoomContext = _interopRequireWildcard(require("../../contexts/RoomContext"));
var _useSettings = require("../useSettings");
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

function useRoomMemberProfile(_ref) {
  let {
    userId = "",
    member: propMember,
    forceHistorical = false
  } = _ref;
  const context = (0, _react.useContext)(_RoomContext.default);
  const useOnlyCurrentProfiles = (0, _useSettings.useSettingValue)("useOnlyCurrentProfiles");
  const member = (0, _react.useMemo)(() => {
    const threadContexts = [_RoomContext.TimelineRenderingType.ThreadsList, _RoomContext.TimelineRenderingType.Thread];
    if (!forceHistorical && useOnlyCurrentProfiles || threadContexts.includes(context.timelineRenderingType)) {
      const currentMember = context.room?.getMember(userId);
      if (currentMember) return currentMember;
    }
    return propMember;
  }, [forceHistorical, propMember, context.room, context.timelineRenderingType, useOnlyCurrentProfiles, userId]);
  return member;
}
//# sourceMappingURL=useRoomMemberProfile.js.map