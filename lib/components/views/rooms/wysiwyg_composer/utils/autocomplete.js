"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.buildQuery = buildQuery;
exports.getMentionAttributes = getMentionAttributes;
exports.getMentionDisplayText = getMentionDisplayText;
exports.getRoomFromCompletion = getRoomFromCompletion;
var Avatar = _interopRequireWildcard(require("../../../../../Avatar"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
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
 * Builds the query for the `<Autocomplete />` component from the rust suggestion. This
 * will change as we implement handling / commands.
 *
 * @param suggestion  - represents if the rust model is tracking a potential mention
 * @returns an empty string if we can not generate a query, otherwise a query beginning
 * with @ for a user query, # for a room or space query
 */
function buildQuery(suggestion) {
  if (!suggestion || !suggestion.keyChar) {
    // if we have an empty key character, we do not build a query
    return "";
  }
  return `${suggestion.keyChar}${suggestion.text}`;
}

/**
 * Find the room from the completion by looking it up using the client from the context
 * we are currently in
 *
 * @param completion - the completion from the autocomplete
 * @param client - the current client we are using
 * @returns a Room if one is found, null otherwise
 */
function getRoomFromCompletion(completion, client) {
  const roomId = completion.completionId;
  const aliasFromCompletion = completion.completion;
  let roomToReturn;

  // Not quite sure if the logic here makes sense - specifically calling .getRoom with an alias
  // that doesn't start with #, but keeping the logic the same as in PartCreator.roomPill for now
  if (roomId) {
    roomToReturn = client.getRoom(roomId);
  } else if (!aliasFromCompletion.startsWith("#")) {
    roomToReturn = client.getRoom(aliasFromCompletion);
  } else {
    roomToReturn = client.getRooms().find(r => {
      return r.getCanonicalAlias() === aliasFromCompletion || r.getAltAliases().includes(aliasFromCompletion);
    });
  }
  return roomToReturn ?? null;
}

/**
 * Given an autocomplete suggestion, determine the text to display in the pill
 *
 * @param completion - the item selected from the autocomplete
 * @param client - the MatrixClient is required for us to look up the correct room mention text
 * @returns the text to display in the mention
 */
function getMentionDisplayText(completion, client) {
  if (completion.type === "user" || completion.type === "at-room") {
    return completion.completion;
  } else if (completion.type === "room") {
    // try and get the room and use it's name, if not available, fall back to
    // completion.completion
    return getRoomFromCompletion(completion, client)?.name || completion.completion;
  }
  return "";
}

/**
 * For a given completion, the attributes will change depending on the completion type
 *
 * @param completion - the item selected from the autocomplete
 * @param client - the MatrixClient is required for us to look up the correct room mention text
 * @returns an object of attributes containing HTMLAnchor attributes or data-* attributes
 */
function getMentionAttributes(completion, client, room) {
  // To ensure that we always have something set in the --avatar-letter CSS variable
  // as otherwise alignment varies depending on whether the content is empty or not.

  // Use a zero width space so that it counts as content, but does not display anything.
  const defaultLetterContent = "\u200b";
  if (completion.type === "user") {
    // logic as used in UserPillPart.setAvatar in parts.ts
    const mentionedMember = room.getMember(completion.completionId || "");
    if (!mentionedMember) return {};
    const name = mentionedMember.name || mentionedMember.userId;
    const defaultAvatarUrl = Avatar.defaultAvatarUrlForString(mentionedMember.userId);
    const avatarUrl = Avatar.avatarUrlForMember(mentionedMember, 16, 16, "crop");
    let initialLetter = defaultLetterContent;
    if (avatarUrl === defaultAvatarUrl) {
      initialLetter = Avatar.getInitialLetter(name) ?? defaultLetterContent;
    }
    return {
      "data-mention-type": completion.type,
      "style": `--avatar-background: url(${avatarUrl}); --avatar-letter: '${initialLetter}'`
    };
  } else if (completion.type === "room") {
    // logic as used in RoomPillPart.setAvatar in parts.ts
    const mentionedRoom = getRoomFromCompletion(completion, client);
    const aliasFromCompletion = completion.completion;
    let initialLetter = defaultLetterContent;
    let avatarUrl = Avatar.avatarUrlForRoom(mentionedRoom ?? null, 16, 16, "crop");
    if (!avatarUrl) {
      initialLetter = Avatar.getInitialLetter(mentionedRoom?.name || aliasFromCompletion) ?? defaultLetterContent;
      avatarUrl = Avatar.defaultAvatarUrlForString(mentionedRoom?.roomId ?? aliasFromCompletion);
    }
    return {
      "data-mention-type": completion.type,
      "style": `--avatar-background: url(${avatarUrl}); --avatar-letter: '${initialLetter}'`
    };
  } else if (completion.type === "at-room") {
    return {
      "data-mention-type": completion.type
    };
  }
  return {};
}
//# sourceMappingURL=autocomplete.js.map