"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.usePermalink = void 0;
var _Pill = require("../components/views/elements/Pill");
var _Permalinks = require("../utils/permalinks/Permalinks");
var _dispatcher = _interopRequireDefault(require("../dispatcher/dispatcher"));
var _actions = require("../dispatcher/actions");
var _languageHandler = require("../languageHandler");
var _usePermalinkTargetRoom = require("./usePermalinkTargetRoom");
var _usePermalinkEvent = require("./usePermalinkEvent");
var _usePermalinkMember = require("./usePermalinkMember");
/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

/**
 * Tries to determine the pill type.
 *
 * If forcedType is present it will be returned.
 * If the parse result contains a room Id or alias and an event Id:
 * - Type is EventInSameRoom if the permalink room Id or alias equals the parsed room Id or alias
 * - Type is EventInOtherRoom if the permalink room Id or alias not equals the parsed room Id or alias
 * If the parse result contains a primary entity Id it will try to detect the type from it.
 * Otherwise returns null.
 *
 * @param forcedType - Forced pill type. Will be used if present and short-circuits all othe conditions.
 * @param parseResult - Permalink parser result
 * @param permalinkRoom - Room in which the permalink is displayed.
 * @returns Pill type or null if unable to determine.
 */
const determineType = (forcedType, parseResult, permalinkRoom) => {
  if (forcedType) return forcedType;
  if (parseResult?.roomIdOrAlias && parseResult?.eventId) {
    if (parseResult.roomIdOrAlias === permalinkRoom?.roomId) {
      return _Pill.PillType.EventInSameRoom;
    }
    return _Pill.PillType.EventInOtherRoom;
  }
  if (parseResult?.primaryEntityId) {
    const prefix = parseResult.primaryEntityId[0] || "";
    return {
      "@": _Pill.PillType.UserMention,
      "#": _Pill.PillType.RoomMention,
      "!": _Pill.PillType.RoomMention
    }[prefix] || null;
  }
  return null;
};

/**
 * Can be used to retrieve all information needed to display a permalink.
 */
const usePermalink = _ref => {
  let {
    room: permalinkRoom,
    type: forcedType,
    url
  } = _ref;
  let resourceId = null;
  let parseResult = null;
  if (url) {
    parseResult = (0, _Permalinks.parsePermalink)(url);
    if (parseResult?.primaryEntityId) {
      resourceId = parseResult.primaryEntityId;
    }
  }
  const type = determineType(forcedType, parseResult, permalinkRoom);
  const targetRoom = (0, _usePermalinkTargetRoom.usePermalinkTargetRoom)(type, parseResult, permalinkRoom);
  const event = (0, _usePermalinkEvent.usePermalinkEvent)(type, parseResult, targetRoom);
  const member = (0, _usePermalinkMember.usePermalinkMember)(type, parseResult, targetRoom, event);
  let onClick = () => {};
  let text = resourceId;
  if (type === _Pill.PillType.AtRoomMention && permalinkRoom) {
    text = "@room";
  } else if (type === _Pill.PillType.UserMention && member) {
    text = member.name || resourceId;
    onClick = e => {
      e.preventDefault();
      e.stopPropagation();
      _dispatcher.default.dispatch({
        action: _actions.Action.ViewUser,
        member: member
      });
    };
  } else if (type === _Pill.PillType.RoomMention) {
    if (targetRoom) {
      text = targetRoom.name || resourceId;
    }
  } else if (type === _Pill.PillType.EventInSameRoom) {
    text = member?.name || (0, _languageHandler._t)("User");
  } else if (type === _Pill.PillType.EventInOtherRoom) {
    text = targetRoom?.name || (0, _languageHandler._t)("Room");
  }
  return {
    event,
    member,
    onClick,
    resourceId,
    targetRoom,
    text,
    type
  };
};
exports.usePermalink = usePermalink;
//# sourceMappingURL=usePermalink.js.map