"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.avatarUrlForMember = avatarUrlForMember;
exports.avatarUrlForRoom = avatarUrlForRoom;
exports.avatarUrlForUser = avatarUrlForUser;
exports.defaultAvatarUrlForString = defaultAvatarUrlForString;
exports.getInitialLetter = getInitialLetter;
var _DMRoomMap = _interopRequireDefault(require("./utils/DMRoomMap"));
var _Media = require("./customisations/Media");
var _isLocalRoom = require("./utils/localRoom/isLocalRoom");
var _strings = require("./utils/strings");
/*
Copyright 2015, 2016 OpenMarket Ltd

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

// Not to be used for BaseAvatar urls as that has similar default avatar fallback already
function avatarUrlForMember(member, width, height, resizeMethod) {
  let url;
  if (member?.getMxcAvatarUrl()) {
    url = (0, _Media.mediaFromMxc)(member.getMxcAvatarUrl()).getThumbnailOfSourceHttp(width, height, resizeMethod);
  }
  if (!url) {
    // member can be null here currently since on invites, the JS SDK
    // does not have enough info to build a RoomMember object for
    // the inviter.
    url = defaultAvatarUrlForString(member ? member.userId : "");
  }
  return url;
}
function avatarUrlForUser(user, width, height, resizeMethod) {
  if (!user.avatarUrl) return null;
  return (0, _Media.mediaFromMxc)(user.avatarUrl).getThumbnailOfSourceHttp(width, height, resizeMethod);
}
function isValidHexColor(color) {
  return typeof color === "string" && (color.length === 7 || color.length === 9) && color.charAt(0) === "#" && !color.slice(1).split("").some(c => isNaN(parseInt(c, 16)));
}
function urlForColor(color) {
  const size = 40;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  // bail out when using jsdom in unit tests
  if (!ctx) {
    return "";
  }
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  return canvas.toDataURL();
}

// XXX: Ideally we'd clear this cache when the theme changes
// but since this function is at global scope, it's a bit
// hard to install a listener here, even if there were a clear event to listen to
const colorToDataURLCache = new Map();
function defaultAvatarUrlForString(s) {
  if (!s) return ""; // XXX: should never happen but empirically does by evidence of a rageshake
  const defaultColors = ["#0DBD8B", "#368bd6", "#ac3ba8"];
  let total = 0;
  for (let i = 0; i < s.length; ++i) {
    total += s.charCodeAt(i);
  }
  const colorIndex = total % defaultColors.length;
  // overwritten color value in custom themes
  const cssVariable = `--avatar-background-colors_${colorIndex}`;
  const cssValue = getComputedStyle(document.body).getPropertyValue(cssVariable);
  const color = cssValue || defaultColors[colorIndex];
  let dataUrl = colorToDataURLCache.get(color);
  if (!dataUrl) {
    // validate color as this can come from account_data
    // with custom theming
    if (isValidHexColor(color)) {
      dataUrl = urlForColor(color);
      colorToDataURLCache.set(color, dataUrl);
    } else {
      dataUrl = "";
    }
  }
  return dataUrl;
}

/**
 * returns the first (non-sigil) character of 'name',
 * converted to uppercase
 * @param {string} name
 * @return {string} the first letter
 */
function getInitialLetter(name) {
  if (!name) {
    // XXX: We should find out what causes the name to sometimes be falsy.
    console.trace("`name` argument to `getInitialLetter` not supplied");
    return undefined;
  }
  if (name.length < 1) {
    return undefined;
  }
  const initial = name[0];
  if ((initial === "@" || initial === "#" || initial === "+") && name[1]) {
    name = name.substring(1);
  }
  return (0, _strings.getFirstGrapheme)(name).toUpperCase();
}
function avatarUrlForRoom(room, width, height, resizeMethod) {
  if (!room) return null; // null-guard

  if (room.getMxcAvatarUrl()) {
    const media = (0, _Media.mediaFromMxc)(room.getMxcAvatarUrl() ?? undefined);
    if (width !== undefined && height !== undefined) {
      return media.getThumbnailOfSourceHttp(width, height, resizeMethod);
    }
    return media.srcHttp;
  }

  // space rooms cannot be DMs so skip the rest
  if (room.isSpaceRoom()) return null;

  // If the room is not a DM don't fallback to a member avatar
  if (!_DMRoomMap.default.shared().getUserIdForRoomId(room.roomId) && !(0, _isLocalRoom.isLocalRoom)(room)) {
    return null;
  }

  // If there are only two members in the DM use the avatar of the other member
  const otherMember = room.getAvatarFallbackMember();
  if (otherMember?.getMxcAvatarUrl()) {
    const media = (0, _Media.mediaFromMxc)(otherMember.getMxcAvatarUrl());
    if (width !== undefined && height !== undefined) {
      return media.getThumbnailOfSourceHttp(width, height, resizeMethod);
    }
    return media.srcHttp;
  }
  return null;
}
//# sourceMappingURL=Avatar.js.map