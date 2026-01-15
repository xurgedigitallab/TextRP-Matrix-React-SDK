"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Type = exports.PlainPart = exports.PillPart = exports.PartCreator = exports.EmojiPart = exports.CommandPartCreator = void 0;
exports.getAutoCompleteCreator = getAutoCompleteCreator;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _emojibaseRegex = _interopRequireDefault(require("emojibase-regex"));
var _graphemer = _interopRequireDefault(require("graphemer"));
var _autocomplete = _interopRequireDefault(require("./autocomplete"));
var _HtmlUtils = require("../HtmlUtils");
var Avatar = _interopRequireWildcard(require("../Avatar"));
var _dispatcher = _interopRequireDefault(require("../dispatcher/dispatcher"));
var _actions = require("../dispatcher/actions");
var _SettingsStore = _interopRequireDefault(require("../settings/SettingsStore"));
var _strings = require("../utils/strings");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
/*
Copyright 2019 New Vector Ltd
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

const REGIONAL_EMOJI_SEPARATOR = String.fromCodePoint(0x200b);
let Type = /*#__PURE__*/function (Type) {
  Type["Plain"] = "plain";
  Type["Newline"] = "newline";
  Type["Emoji"] = "emoji";
  Type["Command"] = "command";
  Type["UserPill"] = "user-pill";
  Type["RoomPill"] = "room-pill";
  Type["AtRoomPill"] = "at-room-pill";
  Type["PillCandidate"] = "pill-candidate";
  return Type;
}({});
exports.Type = Type;
class BasePart {
  constructor() {
    let text = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "";
    (0, _defineProperty2.default)(this, "_text", void 0);
    this._text = text;
  }

  // chr can also be a grapheme cluster
  acceptsInsertion(chr, offset, inputType) {
    return true;
  }
  acceptsRemoval(position, chr) {
    return true;
  }
  merge(part) {
    return false;
  }
  split(offset) {
    const splitText = this.text.slice(offset);
    this._text = this.text.slice(0, offset);
    return new PlainPart(splitText);
  }

  // removes len chars, or returns the plain text this part should be replaced with
  // if the part would become invalid if it removed everything.
  remove(offset, len) {
    // validate
    const strWithRemoval = this.text.slice(0, offset) + this.text.slice(offset + len);
    for (let i = offset; i < len + offset; ++i) {
      const chr = this.text.charAt(i);
      if (!this.acceptsRemoval(i, chr)) {
        return strWithRemoval;
      }
    }
    this._text = strWithRemoval;
  }

  // append str, returns the remaining string if a character was rejected.
  appendUntilRejected(str, inputType) {
    const offset = this.text.length;
    // Take a copy as we will be taking chunks off the start of the string as we process them
    // To only need to grapheme split the bits of the string we're working on.
    let buffer = str;
    while (buffer) {
      const char = (0, _strings.getFirstGrapheme)(buffer);
      if (!this.acceptsInsertion(char, offset + str.length - buffer.length, inputType)) {
        break;
      }
      buffer = buffer.slice(char.length);
    }
    this._text += str.slice(0, str.length - buffer.length);
    return buffer || undefined;
  }

  // inserts str at offset if all the characters in str were accepted, otherwise don't do anything
  // return whether the str was accepted or not.
  validateAndInsert(offset, str, inputType) {
    for (let i = 0; i < str.length; ++i) {
      const chr = str.charAt(i);
      if (!this.acceptsInsertion(chr, offset + i, inputType)) {
        return false;
      }
    }
    const beforeInsert = this._text.slice(0, offset);
    const afterInsert = this._text.slice(offset);
    this._text = beforeInsert + str + afterInsert;
    return true;
  }
  createAutoComplete(updateCallback) {}
  trim(len) {
    const remaining = this._text.slice(len);
    this._text = this._text.slice(0, len);
    return remaining;
  }
  get text() {
    return this._text;
  }
  get canEdit() {
    return true;
  }
  get acceptsCaret() {
    return this.canEdit;
  }
  toString() {
    return `${this.type}(${this.text})`;
  }
  serialize() {
    return {
      type: this.type,
      text: this.text
    };
  }
}
class PlainBasePart extends BasePart {
  acceptsInsertion(chr, offset, inputType) {
    if (chr === "\n" || _emojibaseRegex.default.test(chr)) {
      return false;
    }
    // when not pasting or dropping text, reject characters that should start a pill candidate
    if (inputType !== "insertFromPaste" && inputType !== "insertFromDrop") {
      if (chr !== "@" && chr !== "#" && chr !== ":" && chr !== "+") {
        return true;
      }

      // split if we are at the beginning of the part text
      if (offset === 0) {
        return false;
      }

      // or split if the previous character is a space or regional emoji separator
      // or if it is a + and this is a :
      return this._text[offset - 1] !== " " && this._text[offset - 1] !== REGIONAL_EMOJI_SEPARATOR && (this._text[offset - 1] !== "+" || chr !== ":");
    }
    return true;
  }
  toDOMNode() {
    return document.createTextNode(this.text);
  }
  merge(part) {
    if (part.type === this.type) {
      this._text = this.text + part.text;
      return true;
    }
    return false;
  }
  updateDOMNode(node) {
    if (node.textContent !== this.text) {
      node.textContent = this.text;
    }
  }
  canUpdateDOMNode(node) {
    return node.nodeType === Node.TEXT_NODE;
  }
}

// exported for unit tests, should otherwise only be used through PartCreator
class PlainPart extends PlainBasePart {
  get type() {
    return Type.Plain;
  }
}
exports.PlainPart = PlainPart;
class PillPart extends BasePart {
  constructor(resourceId, label) {
    super(label);
    this.resourceId = resourceId;
    (0, _defineProperty2.default)(this, "onClick", void 0);
  }
  acceptsInsertion(chr) {
    return chr !== " ";
  }
  acceptsRemoval(position, chr) {
    return position !== 0; //if you remove initial # or @, pill should become plain
  }

  toDOMNode() {
    const container = document.createElement("span");
    container.setAttribute("spellcheck", "false");
    container.setAttribute("contentEditable", "false");
    if (this.onClick) container.onclick = this.onClick;
    container.className = this.className;
    container.appendChild(document.createTextNode(this.text));
    this.setAvatar(container);
    return container;
  }
  updateDOMNode(node) {
    const textNode = node.childNodes[0];
    if (textNode.textContent !== this.text) {
      textNode.textContent = this.text;
    }
    if (node.className !== this.className) {
      node.className = this.className;
    }
    if (this.onClick && node.onclick !== this.onClick) {
      node.onclick = this.onClick;
    }
    this.setAvatar(node);
  }
  canUpdateDOMNode(node) {
    return node.nodeType === Node.ELEMENT_NODE && node.nodeName === "SPAN" && node.childNodes.length === 1 && node.childNodes[0].nodeType === Node.TEXT_NODE;
  }

  // helper method for subclasses
  setAvatarVars(node, avatarUrl, initialLetter) {
    const avatarBackground = `url('${avatarUrl}')`;
    const avatarLetter = `'${initialLetter}'`;
    // check if the value is changing,
    // otherwise the avatars flicker on every keystroke while updating.
    if (node.style.getPropertyValue("--avatar-background") !== avatarBackground) {
      node.style.setProperty("--avatar-background", avatarBackground);
    }
    if (node.style.getPropertyValue("--avatar-letter") !== avatarLetter) {
      node.style.setProperty("--avatar-letter", avatarLetter);
    }
  }
  serialize() {
    return {
      type: this.type,
      text: this.text,
      resourceId: this.resourceId
    };
  }
  get canEdit() {
    return false;
  }
}
exports.PillPart = PillPart;
class NewlinePart extends BasePart {
  acceptsInsertion(chr, offset) {
    return offset === 0 && chr === "\n";
  }
  acceptsRemoval(position, chr) {
    return true;
  }
  toDOMNode() {
    return document.createElement("br");
  }
  merge() {
    return false;
  }
  updateDOMNode() {}
  canUpdateDOMNode(node) {
    return node.tagName === "BR";
  }
  get type() {
    return Type.Newline;
  }

  // this makes the cursor skip this part when it is inserted
  // rather than trying to append to it, which is what we want.
  // As a newline can also be only one character, it makes sense
  // as it can only be one character long. This caused #9741.
  get canEdit() {
    return false;
  }
}
class EmojiPart extends BasePart {
  acceptsInsertion(chr, offset) {
    return _emojibaseRegex.default.test(chr);
  }
  acceptsRemoval(position, chr) {
    return false;
  }
  toDOMNode() {
    const span = document.createElement("span");
    span.className = "mx_Emoji";
    span.setAttribute("title", (0, _HtmlUtils.unicodeToShortcode)(this.text));
    span.appendChild(document.createTextNode(this.text));
    return span;
  }
  updateDOMNode(node) {
    const textNode = node.childNodes[0];
    if (textNode.textContent !== this.text) {
      node.setAttribute("title", (0, _HtmlUtils.unicodeToShortcode)(this.text));
      textNode.textContent = this.text;
    }
  }
  canUpdateDOMNode(node) {
    return node.className === "mx_Emoji";
  }
  get type() {
    return Type.Emoji;
  }
  get canEdit() {
    return false;
  }
  get acceptsCaret() {
    return true;
  }
}
exports.EmojiPart = EmojiPart;
class RoomPillPart extends PillPart {
  constructor(resourceId, label, room) {
    super(resourceId, label);
    this.room = room;
  }
  setAvatar(node) {
    let initialLetter = "";
    let avatarUrl = Avatar.avatarUrlForRoom(this.room ?? null, 16, 16, "crop");
    if (!avatarUrl) {
      initialLetter = Avatar.getInitialLetter(this.room?.name || this.resourceId) ?? "";
      avatarUrl = Avatar.defaultAvatarUrlForString(this.room?.roomId ?? this.resourceId);
    }
    this.setAvatarVars(node, avatarUrl, initialLetter);
  }
  get type() {
    return Type.RoomPill;
  }
  get className() {
    return "mx_Pill " + (this.room?.isSpaceRoom() ? "mx_SpacePill" : "mx_RoomPill");
  }
}
class AtRoomPillPart extends RoomPillPart {
  constructor(text, room) {
    super(text, text, room);
  }
  get type() {
    return Type.AtRoomPill;
  }
  serialize() {
    return {
      type: this.type,
      text: this.text
    };
  }
}
class UserPillPart extends PillPart {
  constructor(userId, displayName, member) {
    super(userId, displayName);
    this.member = member;
    (0, _defineProperty2.default)(this, "onClick", () => {
      _dispatcher.default.dispatch({
        action: _actions.Action.ViewUser,
        member: this.member
      });
    });
  }
  get type() {
    return Type.UserPill;
  }
  get className() {
    return "mx_UserPill mx_Pill";
  }
  setAvatar(node) {
    if (!this.member) {
      return;
    }
    const name = this.member.name || this.member.userId;
    const defaultAvatarUrl = Avatar.defaultAvatarUrlForString(this.member.userId);
    const avatarUrl = Avatar.avatarUrlForMember(this.member, 16, 16, "crop");
    let initialLetter = "";
    if (avatarUrl === defaultAvatarUrl) {
      initialLetter = Avatar.getInitialLetter(name) ?? "";
    }
    this.setAvatarVars(node, avatarUrl, initialLetter);
  }
}
class PillCandidatePart extends PlainBasePart {
  constructor(text, autoCompleteCreator) {
    super(text);
    this.autoCompleteCreator = autoCompleteCreator;
  }
  createAutoComplete(updateCallback) {
    return this.autoCompleteCreator.create?.(updateCallback);
  }
  acceptsInsertion(chr, offset, inputType) {
    if (offset === 0) {
      return true;
    } else {
      return super.acceptsInsertion(chr, offset, inputType);
    }
  }
  merge() {
    return false;
  }
  acceptsRemoval(position, chr) {
    return true;
  }
  get type() {
    return Type.PillCandidate;
  }
}
function getAutoCompleteCreator(getAutocompleterComponent, updateQuery) {
  return partCreator => {
    return updateCallback => {
      return new _autocomplete.default(updateCallback, getAutocompleterComponent, updateQuery, partCreator);
    };
  };
}
class PartCreator {
  constructor(room, client) {
    let autoCompleteCreator = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
    this.room = room;
    this.client = client;
    (0, _defineProperty2.default)(this, "autoCompleteCreator", void 0);
    // pre-create the creator as an object even without callback so it can already be passed
    // to PillCandidatePart (e.g. while deserializing) and set later on
    this.autoCompleteCreator = {
      create: autoCompleteCreator?.(this)
    };
  }
  setAutoCompleteCreator(autoCompleteCreator) {
    this.autoCompleteCreator.create = autoCompleteCreator(this);
  }
  createPartForInput(input, partIndex, inputType) {
    switch (input[0]) {
      case "#":
      case "@":
      case ":":
      case "+":
        return this.pillCandidate("");
      case "\n":
        return new NewlinePart();
      default:
        if (_emojibaseRegex.default.test((0, _strings.getFirstGrapheme)(input))) {
          return new EmojiPart();
        }
        return new PlainPart();
    }
  }
  createDefaultPart(text) {
    return this.plain(text);
  }
  deserializePart(part) {
    switch (part.type) {
      case Type.Plain:
        return this.plain(part.text);
      case Type.Newline:
        return this.newline();
      case Type.Emoji:
        return this.emoji(part.text);
      case Type.AtRoomPill:
        return this.atRoomPill(part.text);
      case Type.PillCandidate:
        return this.pillCandidate(part.text);
      case Type.RoomPill:
        return part.resourceId ? this.roomPill(part.resourceId) : undefined;
      case Type.UserPill:
        return part.resourceId ? this.userPill(part.text, part.resourceId) : undefined;
    }
  }
  plain(text) {
    return new PlainPart(text);
  }
  newline() {
    return new NewlinePart("\n");
  }
  emoji(text) {
    return new EmojiPart(text);
  }
  pillCandidate(text) {
    return new PillCandidatePart(text, this.autoCompleteCreator);
  }
  roomPill(alias, roomId) {
    let room;
    if (roomId || alias[0] !== "#") {
      room = this.client.getRoom(roomId || alias) ?? undefined;
    } else {
      room = this.client.getRooms().find(r => {
        return r.getCanonicalAlias() === alias || r.getAltAliases().includes(alias);
      });
    }
    return new RoomPillPart(alias, room ? room.name : alias, room);
  }
  atRoomPill(text) {
    return new AtRoomPillPart(text, this.room);
  }
  userPill(displayName, userId) {
    const member = this.room.getMember(userId);
    return new UserPillPart(userId, displayName, member || undefined);
  }
  static isRegionalIndicator(c) {
    const codePoint = c.codePointAt(0) ?? 0;
    return codePoint != 0 && c.length == 2 && 0x1f1e6 <= codePoint && codePoint <= 0x1f1ff;
  }
  plainWithEmoji(text) {
    const parts = [];
    let plainText = "";
    const splitter = new _graphemer.default();
    for (const char of splitter.iterateGraphemes(text)) {
      if (_emojibaseRegex.default.test(char)) {
        if (plainText) {
          parts.push(this.plain(plainText));
          plainText = "";
        }
        parts.push(this.emoji(char));
        if (PartCreator.isRegionalIndicator(text)) {
          parts.push(this.plain(REGIONAL_EMOJI_SEPARATOR));
        }
      } else {
        plainText += char;
      }
    }
    if (plainText) {
      parts.push(this.plain(plainText));
    }
    return parts;
  }
  createMentionParts(insertTrailingCharacter, displayName, userId) {
    const pill = this.userPill(displayName, userId);
    if (!_SettingsStore.default.getValue("MessageComposerInput.insertTrailingColon")) {
      insertTrailingCharacter = false;
    }
    const postfix = this.plain(insertTrailingCharacter ? ": " : " ");
    return [pill, postfix];
  }
}

// part creator that support auto complete for /commands,
// used in SendMessageComposer
exports.PartCreator = PartCreator;
class CommandPartCreator extends PartCreator {
  createPartForInput(text, partIndex) {
    // at beginning and starts with /? create
    if (partIndex === 0 && text[0] === "/") {
      // text will be inserted by model, so pass empty string
      return this.command("");
    } else {
      return super.createPartForInput(text, partIndex);
    }
  }
  command(text) {
    return new CommandPart(text, this.autoCompleteCreator);
  }
  deserializePart(part) {
    if (part.type === Type.Command) {
      return this.command(part.text);
    } else {
      return super.deserializePart(part);
    }
  }
}
exports.CommandPartCreator = CommandPartCreator;
class CommandPart extends PillCandidatePart {
  get type() {
    return Type.Command;
  }
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfZW1vamliYXNlUmVnZXgiLCJfaW50ZXJvcFJlcXVpcmVEZWZhdWx0IiwicmVxdWlyZSIsIl9ncmFwaGVtZXIiLCJfYXV0b2NvbXBsZXRlIiwiX0h0bWxVdGlscyIsIkF2YXRhciIsIl9pbnRlcm9wUmVxdWlyZVdpbGRjYXJkIiwiX2Rpc3BhdGNoZXIiLCJfYWN0aW9ucyIsIl9TZXR0aW5nc1N0b3JlIiwiX3N0cmluZ3MiLCJfZ2V0UmVxdWlyZVdpbGRjYXJkQ2FjaGUiLCJub2RlSW50ZXJvcCIsIldlYWtNYXAiLCJjYWNoZUJhYmVsSW50ZXJvcCIsImNhY2hlTm9kZUludGVyb3AiLCJvYmoiLCJfX2VzTW9kdWxlIiwiZGVmYXVsdCIsImNhY2hlIiwiaGFzIiwiZ2V0IiwibmV3T2JqIiwiaGFzUHJvcGVydHlEZXNjcmlwdG9yIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IiLCJrZXkiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImNhbGwiLCJkZXNjIiwic2V0IiwiUkVHSU9OQUxfRU1PSklfU0VQQVJBVE9SIiwiU3RyaW5nIiwiZnJvbUNvZGVQb2ludCIsIlR5cGUiLCJleHBvcnRzIiwiQmFzZVBhcnQiLCJjb25zdHJ1Y3RvciIsInRleHQiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJ1bmRlZmluZWQiLCJfZGVmaW5lUHJvcGVydHkyIiwiX3RleHQiLCJhY2NlcHRzSW5zZXJ0aW9uIiwiY2hyIiwib2Zmc2V0IiwiaW5wdXRUeXBlIiwiYWNjZXB0c1JlbW92YWwiLCJwb3NpdGlvbiIsIm1lcmdlIiwicGFydCIsInNwbGl0Iiwic3BsaXRUZXh0Iiwic2xpY2UiLCJQbGFpblBhcnQiLCJyZW1vdmUiLCJsZW4iLCJzdHJXaXRoUmVtb3ZhbCIsImkiLCJjaGFyQXQiLCJhcHBlbmRVbnRpbFJlamVjdGVkIiwic3RyIiwiYnVmZmVyIiwiY2hhciIsImdldEZpcnN0R3JhcGhlbWUiLCJ2YWxpZGF0ZUFuZEluc2VydCIsImJlZm9yZUluc2VydCIsImFmdGVySW5zZXJ0IiwiY3JlYXRlQXV0b0NvbXBsZXRlIiwidXBkYXRlQ2FsbGJhY2siLCJ0cmltIiwicmVtYWluaW5nIiwiY2FuRWRpdCIsImFjY2VwdHNDYXJldCIsInRvU3RyaW5nIiwidHlwZSIsInNlcmlhbGl6ZSIsIlBsYWluQmFzZVBhcnQiLCJFTU9KSUJBU0VfUkVHRVgiLCJ0ZXN0IiwidG9ET01Ob2RlIiwiZG9jdW1lbnQiLCJjcmVhdGVUZXh0Tm9kZSIsInVwZGF0ZURPTU5vZGUiLCJub2RlIiwidGV4dENvbnRlbnQiLCJjYW5VcGRhdGVET01Ob2RlIiwibm9kZVR5cGUiLCJOb2RlIiwiVEVYVF9OT0RFIiwiUGxhaW4iLCJQaWxsUGFydCIsInJlc291cmNlSWQiLCJsYWJlbCIsImNvbnRhaW5lciIsImNyZWF0ZUVsZW1lbnQiLCJzZXRBdHRyaWJ1dGUiLCJvbkNsaWNrIiwib25jbGljayIsImNsYXNzTmFtZSIsImFwcGVuZENoaWxkIiwic2V0QXZhdGFyIiwidGV4dE5vZGUiLCJjaGlsZE5vZGVzIiwiRUxFTUVOVF9OT0RFIiwibm9kZU5hbWUiLCJzZXRBdmF0YXJWYXJzIiwiYXZhdGFyVXJsIiwiaW5pdGlhbExldHRlciIsImF2YXRhckJhY2tncm91bmQiLCJhdmF0YXJMZXR0ZXIiLCJzdHlsZSIsImdldFByb3BlcnR5VmFsdWUiLCJzZXRQcm9wZXJ0eSIsIk5ld2xpbmVQYXJ0IiwidGFnTmFtZSIsIk5ld2xpbmUiLCJFbW9qaVBhcnQiLCJzcGFuIiwidW5pY29kZVRvU2hvcnRjb2RlIiwiRW1vamkiLCJSb29tUGlsbFBhcnQiLCJyb29tIiwiYXZhdGFyVXJsRm9yUm9vbSIsImdldEluaXRpYWxMZXR0ZXIiLCJuYW1lIiwiZGVmYXVsdEF2YXRhclVybEZvclN0cmluZyIsInJvb21JZCIsIlJvb21QaWxsIiwiaXNTcGFjZVJvb20iLCJBdFJvb21QaWxsUGFydCIsIkF0Um9vbVBpbGwiLCJVc2VyUGlsbFBhcnQiLCJ1c2VySWQiLCJkaXNwbGF5TmFtZSIsIm1lbWJlciIsImRlZmF1bHREaXNwYXRjaGVyIiwiZGlzcGF0Y2giLCJhY3Rpb24iLCJBY3Rpb24iLCJWaWV3VXNlciIsIlVzZXJQaWxsIiwiZGVmYXVsdEF2YXRhclVybCIsImF2YXRhclVybEZvck1lbWJlciIsIlBpbGxDYW5kaWRhdGVQYXJ0IiwiYXV0b0NvbXBsZXRlQ3JlYXRvciIsImNyZWF0ZSIsIlBpbGxDYW5kaWRhdGUiLCJnZXRBdXRvQ29tcGxldGVDcmVhdG9yIiwiZ2V0QXV0b2NvbXBsZXRlckNvbXBvbmVudCIsInVwZGF0ZVF1ZXJ5IiwicGFydENyZWF0b3IiLCJBdXRvY29tcGxldGVXcmFwcGVyTW9kZWwiLCJQYXJ0Q3JlYXRvciIsImNsaWVudCIsInNldEF1dG9Db21wbGV0ZUNyZWF0b3IiLCJjcmVhdGVQYXJ0Rm9ySW5wdXQiLCJpbnB1dCIsInBhcnRJbmRleCIsInBpbGxDYW5kaWRhdGUiLCJjcmVhdGVEZWZhdWx0UGFydCIsInBsYWluIiwiZGVzZXJpYWxpemVQYXJ0IiwibmV3bGluZSIsImVtb2ppIiwiYXRSb29tUGlsbCIsInJvb21QaWxsIiwidXNlclBpbGwiLCJhbGlhcyIsImdldFJvb20iLCJnZXRSb29tcyIsImZpbmQiLCJyIiwiZ2V0Q2Fub25pY2FsQWxpYXMiLCJnZXRBbHRBbGlhc2VzIiwiaW5jbHVkZXMiLCJnZXRNZW1iZXIiLCJpc1JlZ2lvbmFsSW5kaWNhdG9yIiwiYyIsImNvZGVQb2ludCIsImNvZGVQb2ludEF0IiwicGxhaW5XaXRoRW1vamkiLCJwYXJ0cyIsInBsYWluVGV4dCIsInNwbGl0dGVyIiwiR3JhcGhlbWVTcGxpdHRlciIsIml0ZXJhdGVHcmFwaGVtZXMiLCJwdXNoIiwiY3JlYXRlTWVudGlvblBhcnRzIiwiaW5zZXJ0VHJhaWxpbmdDaGFyYWN0ZXIiLCJwaWxsIiwiU2V0dGluZ3NTdG9yZSIsImdldFZhbHVlIiwicG9zdGZpeCIsIkNvbW1hbmRQYXJ0Q3JlYXRvciIsImNvbW1hbmQiLCJDb21tYW5kUGFydCIsIkNvbW1hbmQiXSwic291cmNlcyI6WyIuLi8uLi9zcmMvZWRpdG9yL3BhcnRzLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qXG5Db3B5cmlnaHQgMjAxOSBOZXcgVmVjdG9yIEx0ZFxuQ29weXJpZ2h0IDIwMTkgVGhlIE1hdHJpeC5vcmcgRm91bmRhdGlvbiBDLkkuQy5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4qL1xuXG5pbXBvcnQgRU1PSklCQVNFX1JFR0VYIGZyb20gXCJlbW9qaWJhc2UtcmVnZXhcIjtcbmltcG9ydCB7IE1hdHJpeENsaWVudCB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9jbGllbnRcIjtcbmltcG9ydCB7IFJvb21NZW1iZXIgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbW9kZWxzL3Jvb20tbWVtYmVyXCI7XG5pbXBvcnQgeyBSb29tIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL21vZGVscy9yb29tXCI7XG5pbXBvcnQgR3JhcGhlbWVTcGxpdHRlciBmcm9tIFwiZ3JhcGhlbWVyXCI7XG5cbmltcG9ydCBBdXRvY29tcGxldGVXcmFwcGVyTW9kZWwsIHsgR2V0QXV0b2NvbXBsZXRlckNvbXBvbmVudCwgVXBkYXRlQ2FsbGJhY2ssIFVwZGF0ZVF1ZXJ5IH0gZnJvbSBcIi4vYXV0b2NvbXBsZXRlXCI7XG5pbXBvcnQgeyB1bmljb2RlVG9TaG9ydGNvZGUgfSBmcm9tIFwiLi4vSHRtbFV0aWxzXCI7XG5pbXBvcnQgKiBhcyBBdmF0YXIgZnJvbSBcIi4uL0F2YXRhclwiO1xuaW1wb3J0IGRlZmF1bHREaXNwYXRjaGVyIGZyb20gXCIuLi9kaXNwYXRjaGVyL2Rpc3BhdGNoZXJcIjtcbmltcG9ydCB7IEFjdGlvbiB9IGZyb20gXCIuLi9kaXNwYXRjaGVyL2FjdGlvbnNcIjtcbmltcG9ydCBTZXR0aW5nc1N0b3JlIGZyb20gXCIuLi9zZXR0aW5ncy9TZXR0aW5nc1N0b3JlXCI7XG5pbXBvcnQgeyBnZXRGaXJzdEdyYXBoZW1lIH0gZnJvbSBcIi4uL3V0aWxzL3N0cmluZ3NcIjtcblxuY29uc3QgUkVHSU9OQUxfRU1PSklfU0VQQVJBVE9SID0gU3RyaW5nLmZyb21Db2RlUG9pbnQoMHgyMDBiKTtcblxuaW50ZXJmYWNlIElTZXJpYWxpemVkUGFydCB7XG4gICAgdHlwZTogVHlwZS5QbGFpbiB8IFR5cGUuTmV3bGluZSB8IFR5cGUuRW1vamkgfCBUeXBlLkNvbW1hbmQgfCBUeXBlLlBpbGxDYW5kaWRhdGU7XG4gICAgdGV4dDogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgSVNlcmlhbGl6ZWRQaWxsUGFydCB7XG4gICAgdHlwZTogVHlwZS5BdFJvb21QaWxsIHwgVHlwZS5Sb29tUGlsbCB8IFR5cGUuVXNlclBpbGw7XG4gICAgdGV4dDogc3RyaW5nO1xuICAgIHJlc291cmNlSWQ/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCB0eXBlIFNlcmlhbGl6ZWRQYXJ0ID0gSVNlcmlhbGl6ZWRQYXJ0IHwgSVNlcmlhbGl6ZWRQaWxsUGFydDtcblxuZXhwb3J0IGVudW0gVHlwZSB7XG4gICAgUGxhaW4gPSBcInBsYWluXCIsXG4gICAgTmV3bGluZSA9IFwibmV3bGluZVwiLFxuICAgIEVtb2ppID0gXCJlbW9qaVwiLFxuICAgIENvbW1hbmQgPSBcImNvbW1hbmRcIixcbiAgICBVc2VyUGlsbCA9IFwidXNlci1waWxsXCIsXG4gICAgUm9vbVBpbGwgPSBcInJvb20tcGlsbFwiLFxuICAgIEF0Um9vbVBpbGwgPSBcImF0LXJvb20tcGlsbFwiLFxuICAgIFBpbGxDYW5kaWRhdGUgPSBcInBpbGwtY2FuZGlkYXRlXCIsXG59XG5cbmludGVyZmFjZSBJQmFzZVBhcnQge1xuICAgIHRleHQ6IHN0cmluZztcbiAgICB0eXBlOiBUeXBlLlBsYWluIHwgVHlwZS5OZXdsaW5lIHwgVHlwZS5FbW9qaTtcbiAgICBjYW5FZGl0OiBib29sZWFuO1xuICAgIGFjY2VwdHNDYXJldDogYm9vbGVhbjtcblxuICAgIGNyZWF0ZUF1dG9Db21wbGV0ZSh1cGRhdGVDYWxsYmFjazogVXBkYXRlQ2FsbGJhY2spOiB2b2lkO1xuXG4gICAgc2VyaWFsaXplKCk6IFNlcmlhbGl6ZWRQYXJ0O1xuICAgIHJlbW92ZShvZmZzZXQ6IG51bWJlciwgbGVuOiBudW1iZXIpOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgc3BsaXQob2Zmc2V0OiBudW1iZXIpOiBJQmFzZVBhcnQ7XG4gICAgdmFsaWRhdGVBbmRJbnNlcnQob2Zmc2V0OiBudW1iZXIsIHN0cjogc3RyaW5nLCBpbnB1dFR5cGU6IHN0cmluZyB8IHVuZGVmaW5lZCk6IGJvb2xlYW47XG4gICAgYXBwZW5kVW50aWxSZWplY3RlZChzdHI6IHN0cmluZywgaW5wdXRUeXBlOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgdXBkYXRlRE9NTm9kZShub2RlOiBOb2RlKTogdm9pZDtcbiAgICBjYW5VcGRhdGVET01Ob2RlKG5vZGU6IE5vZGUpOiBib29sZWFuO1xuICAgIHRvRE9NTm9kZSgpOiBOb2RlO1xuXG4gICAgbWVyZ2U/KHBhcnQ6IFBhcnQpOiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgSVBpbGxDYW5kaWRhdGVQYXJ0IGV4dGVuZHMgT21pdDxJQmFzZVBhcnQsIFwidHlwZVwiIHwgXCJjcmVhdGVBdXRvQ29tcGxldGVcIj4ge1xuICAgIHR5cGU6IFR5cGUuUGlsbENhbmRpZGF0ZSB8IFR5cGUuQ29tbWFuZDtcbiAgICBjcmVhdGVBdXRvQ29tcGxldGUodXBkYXRlQ2FsbGJhY2s6IFVwZGF0ZUNhbGxiYWNrKTogQXV0b2NvbXBsZXRlV3JhcHBlck1vZGVsIHwgdW5kZWZpbmVkO1xufVxuXG5pbnRlcmZhY2UgSVBpbGxQYXJ0IGV4dGVuZHMgT21pdDxJQmFzZVBhcnQsIFwidHlwZVwiIHwgXCJyZXNvdXJjZUlkXCI+IHtcbiAgICB0eXBlOiBUeXBlLkF0Um9vbVBpbGwgfCBUeXBlLlJvb21QaWxsIHwgVHlwZS5Vc2VyUGlsbDtcbiAgICByZXNvdXJjZUlkOiBzdHJpbmc7XG59XG5cbmV4cG9ydCB0eXBlIFBhcnQgPSBJQmFzZVBhcnQgfCBJUGlsbENhbmRpZGF0ZVBhcnQgfCBJUGlsbFBhcnQ7XG5cbmFic3RyYWN0IGNsYXNzIEJhc2VQYXJ0IHtcbiAgICBwcm90ZWN0ZWQgX3RleHQ6IHN0cmluZztcblxuICAgIHB1YmxpYyBjb25zdHJ1Y3Rvcih0ZXh0ID0gXCJcIikge1xuICAgICAgICB0aGlzLl90ZXh0ID0gdGV4dDtcbiAgICB9XG5cbiAgICAvLyBjaHIgY2FuIGFsc28gYmUgYSBncmFwaGVtZSBjbHVzdGVyXG4gICAgcHJvdGVjdGVkIGFjY2VwdHNJbnNlcnRpb24oY2hyOiBzdHJpbmcsIG9mZnNldDogbnVtYmVyLCBpbnB1dFR5cGU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgYWNjZXB0c1JlbW92YWwocG9zaXRpb246IG51bWJlciwgY2hyOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcHVibGljIG1lcmdlKHBhcnQ6IFBhcnQpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHB1YmxpYyBzcGxpdChvZmZzZXQ6IG51bWJlcik6IElCYXNlUGFydCB7XG4gICAgICAgIGNvbnN0IHNwbGl0VGV4dCA9IHRoaXMudGV4dC5zbGljZShvZmZzZXQpO1xuICAgICAgICB0aGlzLl90ZXh0ID0gdGhpcy50ZXh0LnNsaWNlKDAsIG9mZnNldCk7XG4gICAgICAgIHJldHVybiBuZXcgUGxhaW5QYXJ0KHNwbGl0VGV4dCk7XG4gICAgfVxuXG4gICAgLy8gcmVtb3ZlcyBsZW4gY2hhcnMsIG9yIHJldHVybnMgdGhlIHBsYWluIHRleHQgdGhpcyBwYXJ0IHNob3VsZCBiZSByZXBsYWNlZCB3aXRoXG4gICAgLy8gaWYgdGhlIHBhcnQgd291bGQgYmVjb21lIGludmFsaWQgaWYgaXQgcmVtb3ZlZCBldmVyeXRoaW5nLlxuICAgIHB1YmxpYyByZW1vdmUob2Zmc2V0OiBudW1iZXIsIGxlbjogbnVtYmVyKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgICAgICAgLy8gdmFsaWRhdGVcbiAgICAgICAgY29uc3Qgc3RyV2l0aFJlbW92YWwgPSB0aGlzLnRleHQuc2xpY2UoMCwgb2Zmc2V0KSArIHRoaXMudGV4dC5zbGljZShvZmZzZXQgKyBsZW4pO1xuICAgICAgICBmb3IgKGxldCBpID0gb2Zmc2V0OyBpIDwgbGVuICsgb2Zmc2V0OyArK2kpIHtcbiAgICAgICAgICAgIGNvbnN0IGNociA9IHRoaXMudGV4dC5jaGFyQXQoaSk7XG4gICAgICAgICAgICBpZiAoIXRoaXMuYWNjZXB0c1JlbW92YWwoaSwgY2hyKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzdHJXaXRoUmVtb3ZhbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLl90ZXh0ID0gc3RyV2l0aFJlbW92YWw7XG4gICAgfVxuXG4gICAgLy8gYXBwZW5kIHN0ciwgcmV0dXJucyB0aGUgcmVtYWluaW5nIHN0cmluZyBpZiBhIGNoYXJhY3RlciB3YXMgcmVqZWN0ZWQuXG4gICAgcHVibGljIGFwcGVuZFVudGlsUmVqZWN0ZWQoc3RyOiBzdHJpbmcsIGlucHV0VHlwZTogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgICAgICAgY29uc3Qgb2Zmc2V0ID0gdGhpcy50ZXh0Lmxlbmd0aDtcbiAgICAgICAgLy8gVGFrZSBhIGNvcHkgYXMgd2Ugd2lsbCBiZSB0YWtpbmcgY2h1bmtzIG9mZiB0aGUgc3RhcnQgb2YgdGhlIHN0cmluZyBhcyB3ZSBwcm9jZXNzIHRoZW1cbiAgICAgICAgLy8gVG8gb25seSBuZWVkIHRvIGdyYXBoZW1lIHNwbGl0IHRoZSBiaXRzIG9mIHRoZSBzdHJpbmcgd2UncmUgd29ya2luZyBvbi5cbiAgICAgICAgbGV0IGJ1ZmZlciA9IHN0cjtcbiAgICAgICAgd2hpbGUgKGJ1ZmZlcikge1xuICAgICAgICAgICAgY29uc3QgY2hhciA9IGdldEZpcnN0R3JhcGhlbWUoYnVmZmVyKTtcbiAgICAgICAgICAgIGlmICghdGhpcy5hY2NlcHRzSW5zZXJ0aW9uKGNoYXIsIG9mZnNldCArIHN0ci5sZW5ndGggLSBidWZmZXIubGVuZ3RoLCBpbnB1dFR5cGUpKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBidWZmZXIgPSBidWZmZXIuc2xpY2UoY2hhci5sZW5ndGgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fdGV4dCArPSBzdHIuc2xpY2UoMCwgc3RyLmxlbmd0aCAtIGJ1ZmZlci5sZW5ndGgpO1xuICAgICAgICByZXR1cm4gYnVmZmVyIHx8IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICAvLyBpbnNlcnRzIHN0ciBhdCBvZmZzZXQgaWYgYWxsIHRoZSBjaGFyYWN0ZXJzIGluIHN0ciB3ZXJlIGFjY2VwdGVkLCBvdGhlcndpc2UgZG9uJ3QgZG8gYW55dGhpbmdcbiAgICAvLyByZXR1cm4gd2hldGhlciB0aGUgc3RyIHdhcyBhY2NlcHRlZCBvciBub3QuXG4gICAgcHVibGljIHZhbGlkYXRlQW5kSW5zZXJ0KG9mZnNldDogbnVtYmVyLCBzdHI6IHN0cmluZywgaW5wdXRUeXBlOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGNvbnN0IGNociA9IHN0ci5jaGFyQXQoaSk7XG4gICAgICAgICAgICBpZiAoIXRoaXMuYWNjZXB0c0luc2VydGlvbihjaHIsIG9mZnNldCArIGksIGlucHV0VHlwZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYmVmb3JlSW5zZXJ0ID0gdGhpcy5fdGV4dC5zbGljZSgwLCBvZmZzZXQpO1xuICAgICAgICBjb25zdCBhZnRlckluc2VydCA9IHRoaXMuX3RleHQuc2xpY2Uob2Zmc2V0KTtcbiAgICAgICAgdGhpcy5fdGV4dCA9IGJlZm9yZUluc2VydCArIHN0ciArIGFmdGVySW5zZXJ0O1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBwdWJsaWMgY3JlYXRlQXV0b0NvbXBsZXRlKHVwZGF0ZUNhbGxiYWNrOiBVcGRhdGVDYWxsYmFjayk6IHZvaWQge31cblxuICAgIHByb3RlY3RlZCB0cmltKGxlbjogbnVtYmVyKTogc3RyaW5nIHtcbiAgICAgICAgY29uc3QgcmVtYWluaW5nID0gdGhpcy5fdGV4dC5zbGljZShsZW4pO1xuICAgICAgICB0aGlzLl90ZXh0ID0gdGhpcy5fdGV4dC5zbGljZSgwLCBsZW4pO1xuICAgICAgICByZXR1cm4gcmVtYWluaW5nO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXQgdGV4dCgpOiBzdHJpbmcge1xuICAgICAgICByZXR1cm4gdGhpcy5fdGV4dDtcbiAgICB9XG5cbiAgICBwdWJsaWMgYWJzdHJhY3QgZ2V0IHR5cGUoKTogVHlwZTtcblxuICAgIHB1YmxpYyBnZXQgY2FuRWRpdCgpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcHVibGljIGdldCBhY2NlcHRzQ2FyZXQoKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB0aGlzLmNhbkVkaXQ7XG4gICAgfVxuXG4gICAgcHVibGljIHRvU3RyaW5nKCk6IHN0cmluZyB7XG4gICAgICAgIHJldHVybiBgJHt0aGlzLnR5cGV9KCR7dGhpcy50ZXh0fSlgO1xuICAgIH1cblxuICAgIHB1YmxpYyBzZXJpYWxpemUoKTogU2VyaWFsaXplZFBhcnQge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdHlwZTogdGhpcy50eXBlIGFzIElTZXJpYWxpemVkUGFydFtcInR5cGVcIl0sXG4gICAgICAgICAgICB0ZXh0OiB0aGlzLnRleHQsXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHVibGljIGFic3RyYWN0IHVwZGF0ZURPTU5vZGUobm9kZTogTm9kZSk6IHZvaWQ7XG4gICAgcHVibGljIGFic3RyYWN0IGNhblVwZGF0ZURPTU5vZGUobm9kZTogTm9kZSk6IGJvb2xlYW47XG4gICAgcHVibGljIGFic3RyYWN0IHRvRE9NTm9kZSgpOiBOb2RlO1xufVxuXG5hYnN0cmFjdCBjbGFzcyBQbGFpbkJhc2VQYXJ0IGV4dGVuZHMgQmFzZVBhcnQge1xuICAgIHByb3RlY3RlZCBhY2NlcHRzSW5zZXJ0aW9uKGNocjogc3RyaW5nLCBvZmZzZXQ6IG51bWJlciwgaW5wdXRUeXBlOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKGNociA9PT0gXCJcXG5cIiB8fCBFTU9KSUJBU0VfUkVHRVgudGVzdChjaHIpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgLy8gd2hlbiBub3QgcGFzdGluZyBvciBkcm9wcGluZyB0ZXh0LCByZWplY3QgY2hhcmFjdGVycyB0aGF0IHNob3VsZCBzdGFydCBhIHBpbGwgY2FuZGlkYXRlXG4gICAgICAgIGlmIChpbnB1dFR5cGUgIT09IFwiaW5zZXJ0RnJvbVBhc3RlXCIgJiYgaW5wdXRUeXBlICE9PSBcImluc2VydEZyb21Ecm9wXCIpIHtcbiAgICAgICAgICAgIGlmIChjaHIgIT09IFwiQFwiICYmIGNociAhPT0gXCIjXCIgJiYgY2hyICE9PSBcIjpcIiAmJiBjaHIgIT09IFwiK1wiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNwbGl0IGlmIHdlIGFyZSBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBwYXJ0IHRleHRcbiAgICAgICAgICAgIGlmIChvZmZzZXQgPT09IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIG9yIHNwbGl0IGlmIHRoZSBwcmV2aW91cyBjaGFyYWN0ZXIgaXMgYSBzcGFjZSBvciByZWdpb25hbCBlbW9qaSBzZXBhcmF0b3JcbiAgICAgICAgICAgIC8vIG9yIGlmIGl0IGlzIGEgKyBhbmQgdGhpcyBpcyBhIDpcbiAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgICAgdGhpcy5fdGV4dFtvZmZzZXQgLSAxXSAhPT0gXCIgXCIgJiZcbiAgICAgICAgICAgICAgICB0aGlzLl90ZXh0W29mZnNldCAtIDFdICE9PSBSRUdJT05BTF9FTU9KSV9TRVBBUkFUT1IgJiZcbiAgICAgICAgICAgICAgICAodGhpcy5fdGV4dFtvZmZzZXQgLSAxXSAhPT0gXCIrXCIgfHwgY2hyICE9PSBcIjpcIilcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcHVibGljIHRvRE9NTm9kZSgpOiBOb2RlIHtcbiAgICAgICAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHRoaXMudGV4dCk7XG4gICAgfVxuXG4gICAgcHVibGljIG1lcmdlKHBhcnQ6IFBhcnQpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKHBhcnQudHlwZSA9PT0gdGhpcy50eXBlKSB7XG4gICAgICAgICAgICB0aGlzLl90ZXh0ID0gdGhpcy50ZXh0ICsgcGFydC50ZXh0O1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHB1YmxpYyB1cGRhdGVET01Ob2RlKG5vZGU6IE5vZGUpOiB2b2lkIHtcbiAgICAgICAgaWYgKG5vZGUudGV4dENvbnRlbnQgIT09IHRoaXMudGV4dCkge1xuICAgICAgICAgICAgbm9kZS50ZXh0Q29udGVudCA9IHRoaXMudGV4dDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBjYW5VcGRhdGVET01Ob2RlKG5vZGU6IE5vZGUpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIG5vZGUubm9kZVR5cGUgPT09IE5vZGUuVEVYVF9OT0RFO1xuICAgIH1cbn1cblxuLy8gZXhwb3J0ZWQgZm9yIHVuaXQgdGVzdHMsIHNob3VsZCBvdGhlcndpc2Ugb25seSBiZSB1c2VkIHRocm91Z2ggUGFydENyZWF0b3JcbmV4cG9ydCBjbGFzcyBQbGFpblBhcnQgZXh0ZW5kcyBQbGFpbkJhc2VQYXJ0IGltcGxlbWVudHMgSUJhc2VQYXJ0IHtcbiAgICBwdWJsaWMgZ2V0IHR5cGUoKTogSUJhc2VQYXJ0W1widHlwZVwiXSB7XG4gICAgICAgIHJldHVybiBUeXBlLlBsYWluO1xuICAgIH1cbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFBpbGxQYXJ0IGV4dGVuZHMgQmFzZVBhcnQgaW1wbGVtZW50cyBJUGlsbFBhcnQge1xuICAgIHB1YmxpYyBjb25zdHJ1Y3RvcihwdWJsaWMgcmVzb3VyY2VJZDogc3RyaW5nLCBsYWJlbDogc3RyaW5nKSB7XG4gICAgICAgIHN1cGVyKGxhYmVsKTtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgYWNjZXB0c0luc2VydGlvbihjaHI6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gY2hyICE9PSBcIiBcIjtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgYWNjZXB0c1JlbW92YWwocG9zaXRpb246IG51bWJlciwgY2hyOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIHBvc2l0aW9uICE9PSAwOyAvL2lmIHlvdSByZW1vdmUgaW5pdGlhbCAjIG9yIEAsIHBpbGwgc2hvdWxkIGJlY29tZSBwbGFpblxuICAgIH1cblxuICAgIHB1YmxpYyB0b0RPTU5vZGUoKTogTm9kZSB7XG4gICAgICAgIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICAgICAgICBjb250YWluZXIuc2V0QXR0cmlidXRlKFwic3BlbGxjaGVja1wiLCBcImZhbHNlXCIpO1xuICAgICAgICBjb250YWluZXIuc2V0QXR0cmlidXRlKFwiY29udGVudEVkaXRhYmxlXCIsIFwiZmFsc2VcIik7XG4gICAgICAgIGlmICh0aGlzLm9uQ2xpY2spIGNvbnRhaW5lci5vbmNsaWNrID0gdGhpcy5vbkNsaWNrO1xuICAgICAgICBjb250YWluZXIuY2xhc3NOYW1lID0gdGhpcy5jbGFzc05hbWU7XG4gICAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh0aGlzLnRleHQpKTtcbiAgICAgICAgdGhpcy5zZXRBdmF0YXIoY29udGFpbmVyKTtcbiAgICAgICAgcmV0dXJuIGNvbnRhaW5lcjtcbiAgICB9XG5cbiAgICBwdWJsaWMgdXBkYXRlRE9NTm9kZShub2RlOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgICAgICBjb25zdCB0ZXh0Tm9kZSA9IG5vZGUuY2hpbGROb2Rlc1swXTtcbiAgICAgICAgaWYgKHRleHROb2RlLnRleHRDb250ZW50ICE9PSB0aGlzLnRleHQpIHtcbiAgICAgICAgICAgIHRleHROb2RlLnRleHRDb250ZW50ID0gdGhpcy50ZXh0O1xuICAgICAgICB9XG4gICAgICAgIGlmIChub2RlLmNsYXNzTmFtZSAhPT0gdGhpcy5jbGFzc05hbWUpIHtcbiAgICAgICAgICAgIG5vZGUuY2xhc3NOYW1lID0gdGhpcy5jbGFzc05hbWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMub25DbGljayAmJiBub2RlLm9uY2xpY2sgIT09IHRoaXMub25DbGljaykge1xuICAgICAgICAgICAgbm9kZS5vbmNsaWNrID0gdGhpcy5vbkNsaWNrO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc2V0QXZhdGFyKG5vZGUpO1xuICAgIH1cblxuICAgIHB1YmxpYyBjYW5VcGRhdGVET01Ob2RlKG5vZGU6IEhUTUxFbGVtZW50KTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICBub2RlLm5vZGVUeXBlID09PSBOb2RlLkVMRU1FTlRfTk9ERSAmJlxuICAgICAgICAgICAgbm9kZS5ub2RlTmFtZSA9PT0gXCJTUEFOXCIgJiZcbiAgICAgICAgICAgIG5vZGUuY2hpbGROb2Rlcy5sZW5ndGggPT09IDEgJiZcbiAgICAgICAgICAgIG5vZGUuY2hpbGROb2Rlc1swXS5ub2RlVHlwZSA9PT0gTm9kZS5URVhUX05PREVcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBoZWxwZXIgbWV0aG9kIGZvciBzdWJjbGFzc2VzXG4gICAgcHJvdGVjdGVkIHNldEF2YXRhclZhcnMobm9kZTogSFRNTEVsZW1lbnQsIGF2YXRhclVybDogc3RyaW5nLCBpbml0aWFsTGV0dGVyOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgICAgY29uc3QgYXZhdGFyQmFja2dyb3VuZCA9IGB1cmwoJyR7YXZhdGFyVXJsfScpYDtcbiAgICAgICAgY29uc3QgYXZhdGFyTGV0dGVyID0gYCcke2luaXRpYWxMZXR0ZXJ9J2A7XG4gICAgICAgIC8vIGNoZWNrIGlmIHRoZSB2YWx1ZSBpcyBjaGFuZ2luZyxcbiAgICAgICAgLy8gb3RoZXJ3aXNlIHRoZSBhdmF0YXJzIGZsaWNrZXIgb24gZXZlcnkga2V5c3Ryb2tlIHdoaWxlIHVwZGF0aW5nLlxuICAgICAgICBpZiAobm9kZS5zdHlsZS5nZXRQcm9wZXJ0eVZhbHVlKFwiLS1hdmF0YXItYmFja2dyb3VuZFwiKSAhPT0gYXZhdGFyQmFja2dyb3VuZCkge1xuICAgICAgICAgICAgbm9kZS5zdHlsZS5zZXRQcm9wZXJ0eShcIi0tYXZhdGFyLWJhY2tncm91bmRcIiwgYXZhdGFyQmFja2dyb3VuZCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG5vZGUuc3R5bGUuZ2V0UHJvcGVydHlWYWx1ZShcIi0tYXZhdGFyLWxldHRlclwiKSAhPT0gYXZhdGFyTGV0dGVyKSB7XG4gICAgICAgICAgICBub2RlLnN0eWxlLnNldFByb3BlcnR5KFwiLS1hdmF0YXItbGV0dGVyXCIsIGF2YXRhckxldHRlcik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgc2VyaWFsaXplKCk6IElTZXJpYWxpemVkUGlsbFBhcnQge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdHlwZTogdGhpcy50eXBlLFxuICAgICAgICAgICAgdGV4dDogdGhpcy50ZXh0LFxuICAgICAgICAgICAgcmVzb3VyY2VJZDogdGhpcy5yZXNvdXJjZUlkLFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXQgY2FuRWRpdCgpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHB1YmxpYyBhYnN0cmFjdCBnZXQgdHlwZSgpOiBJUGlsbFBhcnRbXCJ0eXBlXCJdO1xuXG4gICAgcHJvdGVjdGVkIGFic3RyYWN0IGdldCBjbGFzc05hbWUoKTogc3RyaW5nO1xuXG4gICAgcHJvdGVjdGVkIG9uQ2xpY2s/OiAoKSA9PiB2b2lkO1xuXG4gICAgcHJvdGVjdGVkIGFic3RyYWN0IHNldEF2YXRhcihub2RlOiBIVE1MRWxlbWVudCk6IHZvaWQ7XG59XG5cbmNsYXNzIE5ld2xpbmVQYXJ0IGV4dGVuZHMgQmFzZVBhcnQgaW1wbGVtZW50cyBJQmFzZVBhcnQge1xuICAgIHByb3RlY3RlZCBhY2NlcHRzSW5zZXJ0aW9uKGNocjogc3RyaW5nLCBvZmZzZXQ6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gb2Zmc2V0ID09PSAwICYmIGNociA9PT0gXCJcXG5cIjtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgYWNjZXB0c1JlbW92YWwocG9zaXRpb246IG51bWJlciwgY2hyOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcHVibGljIHRvRE9NTm9kZSgpOiBOb2RlIHtcbiAgICAgICAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJiclwiKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgbWVyZ2UoKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBwdWJsaWMgdXBkYXRlRE9NTm9kZSgpOiB2b2lkIHt9XG5cbiAgICBwdWJsaWMgY2FuVXBkYXRlRE9NTm9kZShub2RlOiBIVE1MRWxlbWVudCk6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gbm9kZS50YWdOYW1lID09PSBcIkJSXCI7XG4gICAgfVxuXG4gICAgcHVibGljIGdldCB0eXBlKCk6IElCYXNlUGFydFtcInR5cGVcIl0ge1xuICAgICAgICByZXR1cm4gVHlwZS5OZXdsaW5lO1xuICAgIH1cblxuICAgIC8vIHRoaXMgbWFrZXMgdGhlIGN1cnNvciBza2lwIHRoaXMgcGFydCB3aGVuIGl0IGlzIGluc2VydGVkXG4gICAgLy8gcmF0aGVyIHRoYW4gdHJ5aW5nIHRvIGFwcGVuZCB0byBpdCwgd2hpY2ggaXMgd2hhdCB3ZSB3YW50LlxuICAgIC8vIEFzIGEgbmV3bGluZSBjYW4gYWxzbyBiZSBvbmx5IG9uZSBjaGFyYWN0ZXIsIGl0IG1ha2VzIHNlbnNlXG4gICAgLy8gYXMgaXQgY2FuIG9ubHkgYmUgb25lIGNoYXJhY3RlciBsb25nLiBUaGlzIGNhdXNlZCAjOTc0MS5cbiAgICBwdWJsaWMgZ2V0IGNhbkVkaXQoKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFbW9qaVBhcnQgZXh0ZW5kcyBCYXNlUGFydCBpbXBsZW1lbnRzIElCYXNlUGFydCB7XG4gICAgcHJvdGVjdGVkIGFjY2VwdHNJbnNlcnRpb24oY2hyOiBzdHJpbmcsIG9mZnNldDogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiBFTU9KSUJBU0VfUkVHRVgudGVzdChjaHIpO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBhY2NlcHRzUmVtb3ZhbChwb3NpdGlvbjogbnVtYmVyLCBjaHI6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcHVibGljIHRvRE9NTm9kZSgpOiBOb2RlIHtcbiAgICAgICAgY29uc3Qgc3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICAgICAgICBzcGFuLmNsYXNzTmFtZSA9IFwibXhfRW1vamlcIjtcbiAgICAgICAgc3Bhbi5zZXRBdHRyaWJ1dGUoXCJ0aXRsZVwiLCB1bmljb2RlVG9TaG9ydGNvZGUodGhpcy50ZXh0KSk7XG4gICAgICAgIHNwYW4uYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodGhpcy50ZXh0KSk7XG4gICAgICAgIHJldHVybiBzcGFuO1xuICAgIH1cblxuICAgIHB1YmxpYyB1cGRhdGVET01Ob2RlKG5vZGU6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgICAgIGNvbnN0IHRleHROb2RlID0gbm9kZS5jaGlsZE5vZGVzWzBdO1xuICAgICAgICBpZiAodGV4dE5vZGUudGV4dENvbnRlbnQgIT09IHRoaXMudGV4dCkge1xuICAgICAgICAgICAgbm9kZS5zZXRBdHRyaWJ1dGUoXCJ0aXRsZVwiLCB1bmljb2RlVG9TaG9ydGNvZGUodGhpcy50ZXh0KSk7XG4gICAgICAgICAgICB0ZXh0Tm9kZS50ZXh0Q29udGVudCA9IHRoaXMudGV4dDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBjYW5VcGRhdGVET01Ob2RlKG5vZGU6IEhUTUxFbGVtZW50KTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiBub2RlLmNsYXNzTmFtZSA9PT0gXCJteF9FbW9qaVwiO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXQgdHlwZSgpOiBJQmFzZVBhcnRbXCJ0eXBlXCJdIHtcbiAgICAgICAgcmV0dXJuIFR5cGUuRW1vamk7XG4gICAgfVxuXG4gICAgcHVibGljIGdldCBjYW5FZGl0KCk6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcHVibGljIGdldCBhY2NlcHRzQ2FyZXQoKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbn1cblxuY2xhc3MgUm9vbVBpbGxQYXJ0IGV4dGVuZHMgUGlsbFBhcnQge1xuICAgIHB1YmxpYyBjb25zdHJ1Y3RvcihyZXNvdXJjZUlkOiBzdHJpbmcsIGxhYmVsOiBzdHJpbmcsIHByaXZhdGUgcm9vbT86IFJvb20pIHtcbiAgICAgICAgc3VwZXIocmVzb3VyY2VJZCwgbGFiZWwpO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBzZXRBdmF0YXIobm9kZTogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICAgICAgbGV0IGluaXRpYWxMZXR0ZXIgPSBcIlwiO1xuICAgICAgICBsZXQgYXZhdGFyVXJsID0gQXZhdGFyLmF2YXRhclVybEZvclJvb20odGhpcy5yb29tID8/IG51bGwsIDE2LCAxNiwgXCJjcm9wXCIpO1xuICAgICAgICBpZiAoIWF2YXRhclVybCkge1xuICAgICAgICAgICAgaW5pdGlhbExldHRlciA9IEF2YXRhci5nZXRJbml0aWFsTGV0dGVyKHRoaXMucm9vbT8ubmFtZSB8fCB0aGlzLnJlc291cmNlSWQpID8/IFwiXCI7XG4gICAgICAgICAgICBhdmF0YXJVcmwgPSBBdmF0YXIuZGVmYXVsdEF2YXRhclVybEZvclN0cmluZyh0aGlzLnJvb20/LnJvb21JZCA/PyB0aGlzLnJlc291cmNlSWQpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc2V0QXZhdGFyVmFycyhub2RlLCBhdmF0YXJVcmwsIGluaXRpYWxMZXR0ZXIpO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXQgdHlwZSgpOiBJUGlsbFBhcnRbXCJ0eXBlXCJdIHtcbiAgICAgICAgcmV0dXJuIFR5cGUuUm9vbVBpbGw7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGdldCBjbGFzc05hbWUoKTogc3RyaW5nIHtcbiAgICAgICAgcmV0dXJuIFwibXhfUGlsbCBcIiArICh0aGlzLnJvb20/LmlzU3BhY2VSb29tKCkgPyBcIm14X1NwYWNlUGlsbFwiIDogXCJteF9Sb29tUGlsbFwiKTtcbiAgICB9XG59XG5cbmNsYXNzIEF0Um9vbVBpbGxQYXJ0IGV4dGVuZHMgUm9vbVBpbGxQYXJ0IHtcbiAgICBwdWJsaWMgY29uc3RydWN0b3IodGV4dDogc3RyaW5nLCByb29tOiBSb29tKSB7XG4gICAgICAgIHN1cGVyKHRleHQsIHRleHQsIHJvb20pO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXQgdHlwZSgpOiBJUGlsbFBhcnRbXCJ0eXBlXCJdIHtcbiAgICAgICAgcmV0dXJuIFR5cGUuQXRSb29tUGlsbDtcbiAgICB9XG5cbiAgICBwdWJsaWMgc2VyaWFsaXplKCk6IElTZXJpYWxpemVkUGlsbFBhcnQge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdHlwZTogdGhpcy50eXBlLFxuICAgICAgICAgICAgdGV4dDogdGhpcy50ZXh0LFxuICAgICAgICB9O1xuICAgIH1cbn1cblxuY2xhc3MgVXNlclBpbGxQYXJ0IGV4dGVuZHMgUGlsbFBhcnQge1xuICAgIHB1YmxpYyBjb25zdHJ1Y3Rvcih1c2VySWQ6IHN0cmluZywgZGlzcGxheU5hbWU6IHN0cmluZywgcHJpdmF0ZSBtZW1iZXI/OiBSb29tTWVtYmVyKSB7XG4gICAgICAgIHN1cGVyKHVzZXJJZCwgZGlzcGxheU5hbWUpO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXQgdHlwZSgpOiBJUGlsbFBhcnRbXCJ0eXBlXCJdIHtcbiAgICAgICAgcmV0dXJuIFR5cGUuVXNlclBpbGw7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGdldCBjbGFzc05hbWUoKTogc3RyaW5nIHtcbiAgICAgICAgcmV0dXJuIFwibXhfVXNlclBpbGwgbXhfUGlsbFwiO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBzZXRBdmF0YXIobm9kZTogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICAgICAgaWYgKCF0aGlzLm1lbWJlcikge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG5hbWUgPSB0aGlzLm1lbWJlci5uYW1lIHx8IHRoaXMubWVtYmVyLnVzZXJJZDtcbiAgICAgICAgY29uc3QgZGVmYXVsdEF2YXRhclVybCA9IEF2YXRhci5kZWZhdWx0QXZhdGFyVXJsRm9yU3RyaW5nKHRoaXMubWVtYmVyLnVzZXJJZCk7XG4gICAgICAgIGNvbnN0IGF2YXRhclVybCA9IEF2YXRhci5hdmF0YXJVcmxGb3JNZW1iZXIodGhpcy5tZW1iZXIsIDE2LCAxNiwgXCJjcm9wXCIpO1xuICAgICAgICBsZXQgaW5pdGlhbExldHRlciA9IFwiXCI7XG4gICAgICAgIGlmIChhdmF0YXJVcmwgPT09IGRlZmF1bHRBdmF0YXJVcmwpIHtcbiAgICAgICAgICAgIGluaXRpYWxMZXR0ZXIgPSBBdmF0YXIuZ2V0SW5pdGlhbExldHRlcihuYW1lKSA/PyBcIlwiO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc2V0QXZhdGFyVmFycyhub2RlLCBhdmF0YXJVcmwsIGluaXRpYWxMZXR0ZXIpO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBvbkNsaWNrID0gKCk6IHZvaWQgPT4ge1xuICAgICAgICBkZWZhdWx0RGlzcGF0Y2hlci5kaXNwYXRjaCh7XG4gICAgICAgICAgICBhY3Rpb246IEFjdGlvbi5WaWV3VXNlcixcbiAgICAgICAgICAgIG1lbWJlcjogdGhpcy5tZW1iZXIsXG4gICAgICAgIH0pO1xuICAgIH07XG59XG5cbmNsYXNzIFBpbGxDYW5kaWRhdGVQYXJ0IGV4dGVuZHMgUGxhaW5CYXNlUGFydCBpbXBsZW1lbnRzIElQaWxsQ2FuZGlkYXRlUGFydCB7XG4gICAgcHVibGljIGNvbnN0cnVjdG9yKHRleHQ6IHN0cmluZywgcHJpdmF0ZSBhdXRvQ29tcGxldGVDcmVhdG9yOiBJQXV0b2NvbXBsZXRlQ3JlYXRvcikge1xuICAgICAgICBzdXBlcih0ZXh0KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgY3JlYXRlQXV0b0NvbXBsZXRlKHVwZGF0ZUNhbGxiYWNrOiBVcGRhdGVDYWxsYmFjayk6IEF1dG9jb21wbGV0ZVdyYXBwZXJNb2RlbCB8IHVuZGVmaW5lZCB7XG4gICAgICAgIHJldHVybiB0aGlzLmF1dG9Db21wbGV0ZUNyZWF0b3IuY3JlYXRlPy4odXBkYXRlQ2FsbGJhY2spO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBhY2NlcHRzSW5zZXJ0aW9uKGNocjogc3RyaW5nLCBvZmZzZXQ6IG51bWJlciwgaW5wdXRUeXBlOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKG9mZnNldCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gc3VwZXIuYWNjZXB0c0luc2VydGlvbihjaHIsIG9mZnNldCwgaW5wdXRUeXBlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBtZXJnZSgpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBhY2NlcHRzUmVtb3ZhbChwb3NpdGlvbjogbnVtYmVyLCBjaHI6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0IHR5cGUoKTogSVBpbGxDYW5kaWRhdGVQYXJ0W1widHlwZVwiXSB7XG4gICAgICAgIHJldHVybiBUeXBlLlBpbGxDYW5kaWRhdGU7XG4gICAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0QXV0b0NvbXBsZXRlQ3JlYXRvcihnZXRBdXRvY29tcGxldGVyQ29tcG9uZW50OiBHZXRBdXRvY29tcGxldGVyQ29tcG9uZW50LCB1cGRhdGVRdWVyeTogVXBkYXRlUXVlcnkpIHtcbiAgICByZXR1cm4gKHBhcnRDcmVhdG9yOiBQYXJ0Q3JlYXRvcikgPT4ge1xuICAgICAgICByZXR1cm4gKHVwZGF0ZUNhbGxiYWNrOiBVcGRhdGVDYWxsYmFjaykgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBBdXRvY29tcGxldGVXcmFwcGVyTW9kZWwodXBkYXRlQ2FsbGJhY2ssIGdldEF1dG9jb21wbGV0ZXJDb21wb25lbnQsIHVwZGF0ZVF1ZXJ5LCBwYXJ0Q3JlYXRvcik7XG4gICAgICAgIH07XG4gICAgfTtcbn1cblxudHlwZSBBdXRvQ29tcGxldGVDcmVhdG9yID0gUmV0dXJuVHlwZTx0eXBlb2YgZ2V0QXV0b0NvbXBsZXRlQ3JlYXRvcj47XG5cbmludGVyZmFjZSBJQXV0b2NvbXBsZXRlQ3JlYXRvciB7XG4gICAgY3JlYXRlOiAoKHVwZGF0ZUNhbGxiYWNrOiBVcGRhdGVDYWxsYmFjaykgPT4gQXV0b2NvbXBsZXRlV3JhcHBlck1vZGVsKSB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGNsYXNzIFBhcnRDcmVhdG9yIHtcbiAgICBwcm90ZWN0ZWQgcmVhZG9ubHkgYXV0b0NvbXBsZXRlQ3JlYXRvcjogSUF1dG9jb21wbGV0ZUNyZWF0b3I7XG5cbiAgICBwdWJsaWMgY29uc3RydWN0b3IoXG4gICAgICAgIHByaXZhdGUgcmVhZG9ubHkgcm9vbTogUm9vbSxcbiAgICAgICAgcHJpdmF0ZSByZWFkb25seSBjbGllbnQ6IE1hdHJpeENsaWVudCxcbiAgICAgICAgYXV0b0NvbXBsZXRlQ3JlYXRvcjogQXV0b0NvbXBsZXRlQ3JlYXRvciB8IG51bGwgPSBudWxsLFxuICAgICkge1xuICAgICAgICAvLyBwcmUtY3JlYXRlIHRoZSBjcmVhdG9yIGFzIGFuIG9iamVjdCBldmVuIHdpdGhvdXQgY2FsbGJhY2sgc28gaXQgY2FuIGFscmVhZHkgYmUgcGFzc2VkXG4gICAgICAgIC8vIHRvIFBpbGxDYW5kaWRhdGVQYXJ0IChlLmcuIHdoaWxlIGRlc2VyaWFsaXppbmcpIGFuZCBzZXQgbGF0ZXIgb25cbiAgICAgICAgdGhpcy5hdXRvQ29tcGxldGVDcmVhdG9yID0geyBjcmVhdGU6IGF1dG9Db21wbGV0ZUNyZWF0b3I/Lih0aGlzKSB9O1xuICAgIH1cblxuICAgIHB1YmxpYyBzZXRBdXRvQ29tcGxldGVDcmVhdG9yKGF1dG9Db21wbGV0ZUNyZWF0b3I6IEF1dG9Db21wbGV0ZUNyZWF0b3IpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5hdXRvQ29tcGxldGVDcmVhdG9yLmNyZWF0ZSA9IGF1dG9Db21wbGV0ZUNyZWF0b3IodGhpcyk7XG4gICAgfVxuXG4gICAgcHVibGljIGNyZWF0ZVBhcnRGb3JJbnB1dChpbnB1dDogc3RyaW5nLCBwYXJ0SW5kZXg6IG51bWJlciwgaW5wdXRUeXBlPzogc3RyaW5nKTogUGFydCB7XG4gICAgICAgIHN3aXRjaCAoaW5wdXRbMF0pIHtcbiAgICAgICAgICAgIGNhc2UgXCIjXCI6XG4gICAgICAgICAgICBjYXNlIFwiQFwiOlxuICAgICAgICAgICAgY2FzZSBcIjpcIjpcbiAgICAgICAgICAgIGNhc2UgXCIrXCI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucGlsbENhbmRpZGF0ZShcIlwiKTtcbiAgICAgICAgICAgIGNhc2UgXCJcXG5cIjpcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IE5ld2xpbmVQYXJ0KCk7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGlmIChFTU9KSUJBU0VfUkVHRVgudGVzdChnZXRGaXJzdEdyYXBoZW1lKGlucHV0KSkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBFbW9qaVBhcnQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBQbGFpblBhcnQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBjcmVhdGVEZWZhdWx0UGFydCh0ZXh0OiBzdHJpbmcpOiBQYXJ0IHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGxhaW4odGV4dCk7XG4gICAgfVxuXG4gICAgcHVibGljIGRlc2VyaWFsaXplUGFydChwYXJ0OiBTZXJpYWxpemVkUGFydCk6IFBhcnQgfCB1bmRlZmluZWQge1xuICAgICAgICBzd2l0Y2ggKHBhcnQudHlwZSkge1xuICAgICAgICAgICAgY2FzZSBUeXBlLlBsYWluOlxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnBsYWluKHBhcnQudGV4dCk7XG4gICAgICAgICAgICBjYXNlIFR5cGUuTmV3bGluZTpcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5uZXdsaW5lKCk7XG4gICAgICAgICAgICBjYXNlIFR5cGUuRW1vamk6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZW1vamkocGFydC50ZXh0KTtcbiAgICAgICAgICAgIGNhc2UgVHlwZS5BdFJvb21QaWxsOlxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmF0Um9vbVBpbGwocGFydC50ZXh0KTtcbiAgICAgICAgICAgIGNhc2UgVHlwZS5QaWxsQ2FuZGlkYXRlOlxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnBpbGxDYW5kaWRhdGUocGFydC50ZXh0KTtcbiAgICAgICAgICAgIGNhc2UgVHlwZS5Sb29tUGlsbDpcbiAgICAgICAgICAgICAgICByZXR1cm4gcGFydC5yZXNvdXJjZUlkID8gdGhpcy5yb29tUGlsbChwYXJ0LnJlc291cmNlSWQpIDogdW5kZWZpbmVkO1xuICAgICAgICAgICAgY2FzZSBUeXBlLlVzZXJQaWxsOlxuICAgICAgICAgICAgICAgIHJldHVybiBwYXJ0LnJlc291cmNlSWQgPyB0aGlzLnVzZXJQaWxsKHBhcnQudGV4dCwgcGFydC5yZXNvdXJjZUlkKSA6IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBwbGFpbih0ZXh0OiBzdHJpbmcpOiBQbGFpblBhcnQge1xuICAgICAgICByZXR1cm4gbmV3IFBsYWluUGFydCh0ZXh0KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgbmV3bGluZSgpOiBOZXdsaW5lUGFydCB7XG4gICAgICAgIHJldHVybiBuZXcgTmV3bGluZVBhcnQoXCJcXG5cIik7XG4gICAgfVxuXG4gICAgcHVibGljIGVtb2ppKHRleHQ6IHN0cmluZyk6IEVtb2ppUGFydCB7XG4gICAgICAgIHJldHVybiBuZXcgRW1vamlQYXJ0KHRleHQpO1xuICAgIH1cblxuICAgIHB1YmxpYyBwaWxsQ2FuZGlkYXRlKHRleHQ6IHN0cmluZyk6IFBpbGxDYW5kaWRhdGVQYXJ0IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQaWxsQ2FuZGlkYXRlUGFydCh0ZXh0LCB0aGlzLmF1dG9Db21wbGV0ZUNyZWF0b3IpO1xuICAgIH1cblxuICAgIHB1YmxpYyByb29tUGlsbChhbGlhczogc3RyaW5nLCByb29tSWQ/OiBzdHJpbmcpOiBSb29tUGlsbFBhcnQge1xuICAgICAgICBsZXQgcm9vbTogUm9vbSB8IHVuZGVmaW5lZDtcbiAgICAgICAgaWYgKHJvb21JZCB8fCBhbGlhc1swXSAhPT0gXCIjXCIpIHtcbiAgICAgICAgICAgIHJvb20gPSB0aGlzLmNsaWVudC5nZXRSb29tKHJvb21JZCB8fCBhbGlhcykgPz8gdW5kZWZpbmVkO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcm9vbSA9IHRoaXMuY2xpZW50LmdldFJvb21zKCkuZmluZCgocikgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiByLmdldENhbm9uaWNhbEFsaWFzKCkgPT09IGFsaWFzIHx8IHIuZ2V0QWx0QWxpYXNlcygpLmluY2x1ZGVzKGFsaWFzKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgUm9vbVBpbGxQYXJ0KGFsaWFzLCByb29tID8gcm9vbS5uYW1lIDogYWxpYXMsIHJvb20pO1xuICAgIH1cblxuICAgIHB1YmxpYyBhdFJvb21QaWxsKHRleHQ6IHN0cmluZyk6IEF0Um9vbVBpbGxQYXJ0IHtcbiAgICAgICAgcmV0dXJuIG5ldyBBdFJvb21QaWxsUGFydCh0ZXh0LCB0aGlzLnJvb20pO1xuICAgIH1cblxuICAgIHB1YmxpYyB1c2VyUGlsbChkaXNwbGF5TmFtZTogc3RyaW5nLCB1c2VySWQ6IHN0cmluZyk6IFVzZXJQaWxsUGFydCB7XG4gICAgICAgIGNvbnN0IG1lbWJlciA9IHRoaXMucm9vbS5nZXRNZW1iZXIodXNlcklkKTtcbiAgICAgICAgcmV0dXJuIG5ldyBVc2VyUGlsbFBhcnQodXNlcklkLCBkaXNwbGF5TmFtZSwgbWVtYmVyIHx8IHVuZGVmaW5lZCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzdGF0aWMgaXNSZWdpb25hbEluZGljYXRvcihjOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgY29uc3QgY29kZVBvaW50ID0gYy5jb2RlUG9pbnRBdCgwKSA/PyAwO1xuICAgICAgICByZXR1cm4gY29kZVBvaW50ICE9IDAgJiYgYy5sZW5ndGggPT0gMiAmJiAweDFmMWU2IDw9IGNvZGVQb2ludCAmJiBjb2RlUG9pbnQgPD0gMHgxZjFmZjtcbiAgICB9XG5cbiAgICBwdWJsaWMgcGxhaW5XaXRoRW1vamkodGV4dDogc3RyaW5nKTogKFBsYWluUGFydCB8IEVtb2ppUGFydClbXSB7XG4gICAgICAgIGNvbnN0IHBhcnRzOiAoUGxhaW5QYXJ0IHwgRW1vamlQYXJ0KVtdID0gW107XG4gICAgICAgIGxldCBwbGFpblRleHQgPSBcIlwiO1xuXG4gICAgICAgIGNvbnN0IHNwbGl0dGVyID0gbmV3IEdyYXBoZW1lU3BsaXR0ZXIoKTtcbiAgICAgICAgZm9yIChjb25zdCBjaGFyIG9mIHNwbGl0dGVyLml0ZXJhdGVHcmFwaGVtZXModGV4dCkpIHtcbiAgICAgICAgICAgIGlmIChFTU9KSUJBU0VfUkVHRVgudGVzdChjaGFyKSkge1xuICAgICAgICAgICAgICAgIGlmIChwbGFpblRleHQpIHtcbiAgICAgICAgICAgICAgICAgICAgcGFydHMucHVzaCh0aGlzLnBsYWluKHBsYWluVGV4dCkpO1xuICAgICAgICAgICAgICAgICAgICBwbGFpblRleHQgPSBcIlwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBwYXJ0cy5wdXNoKHRoaXMuZW1vamkoY2hhcikpO1xuICAgICAgICAgICAgICAgIGlmIChQYXJ0Q3JlYXRvci5pc1JlZ2lvbmFsSW5kaWNhdG9yKHRleHQpKSB7XG4gICAgICAgICAgICAgICAgICAgIHBhcnRzLnB1c2godGhpcy5wbGFpbihSRUdJT05BTF9FTU9KSV9TRVBBUkFUT1IpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBsYWluVGV4dCArPSBjaGFyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChwbGFpblRleHQpIHtcbiAgICAgICAgICAgIHBhcnRzLnB1c2godGhpcy5wbGFpbihwbGFpblRleHQpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcGFydHM7XG4gICAgfVxuXG4gICAgcHVibGljIGNyZWF0ZU1lbnRpb25QYXJ0cyhcbiAgICAgICAgaW5zZXJ0VHJhaWxpbmdDaGFyYWN0ZXI6IGJvb2xlYW4sXG4gICAgICAgIGRpc3BsYXlOYW1lOiBzdHJpbmcsXG4gICAgICAgIHVzZXJJZDogc3RyaW5nLFxuICAgICk6IFtVc2VyUGlsbFBhcnQsIFBsYWluUGFydF0ge1xuICAgICAgICBjb25zdCBwaWxsID0gdGhpcy51c2VyUGlsbChkaXNwbGF5TmFtZSwgdXNlcklkKTtcbiAgICAgICAgaWYgKCFTZXR0aW5nc1N0b3JlLmdldFZhbHVlKFwiTWVzc2FnZUNvbXBvc2VySW5wdXQuaW5zZXJ0VHJhaWxpbmdDb2xvblwiKSkge1xuICAgICAgICAgICAgaW5zZXJ0VHJhaWxpbmdDaGFyYWN0ZXIgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwb3N0Zml4ID0gdGhpcy5wbGFpbihpbnNlcnRUcmFpbGluZ0NoYXJhY3RlciA/IFwiOiBcIiA6IFwiIFwiKTtcbiAgICAgICAgcmV0dXJuIFtwaWxsLCBwb3N0Zml4XTtcbiAgICB9XG59XG5cbi8vIHBhcnQgY3JlYXRvciB0aGF0IHN1cHBvcnQgYXV0byBjb21wbGV0ZSBmb3IgL2NvbW1hbmRzLFxuLy8gdXNlZCBpbiBTZW5kTWVzc2FnZUNvbXBvc2VyXG5leHBvcnQgY2xhc3MgQ29tbWFuZFBhcnRDcmVhdG9yIGV4dGVuZHMgUGFydENyZWF0b3Ige1xuICAgIHB1YmxpYyBjcmVhdGVQYXJ0Rm9ySW5wdXQodGV4dDogc3RyaW5nLCBwYXJ0SW5kZXg6IG51bWJlcik6IFBhcnQge1xuICAgICAgICAvLyBhdCBiZWdpbm5pbmcgYW5kIHN0YXJ0cyB3aXRoIC8/IGNyZWF0ZVxuICAgICAgICBpZiAocGFydEluZGV4ID09PSAwICYmIHRleHRbMF0gPT09IFwiL1wiKSB7XG4gICAgICAgICAgICAvLyB0ZXh0IHdpbGwgYmUgaW5zZXJ0ZWQgYnkgbW9kZWwsIHNvIHBhc3MgZW1wdHkgc3RyaW5nXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jb21tYW5kKFwiXCIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHN1cGVyLmNyZWF0ZVBhcnRGb3JJbnB1dCh0ZXh0LCBwYXJ0SW5kZXgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGNvbW1hbmQodGV4dDogc3RyaW5nKTogQ29tbWFuZFBhcnQge1xuICAgICAgICByZXR1cm4gbmV3IENvbW1hbmRQYXJ0KHRleHQsIHRoaXMuYXV0b0NvbXBsZXRlQ3JlYXRvcik7XG4gICAgfVxuXG4gICAgcHVibGljIGRlc2VyaWFsaXplUGFydChwYXJ0OiBTZXJpYWxpemVkUGFydCk6IFBhcnQgfCB1bmRlZmluZWQge1xuICAgICAgICBpZiAocGFydC50eXBlID09PSBUeXBlLkNvbW1hbmQpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbW1hbmQocGFydC50ZXh0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBzdXBlci5kZXNlcmlhbGl6ZVBhcnQocGFydCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmNsYXNzIENvbW1hbmRQYXJ0IGV4dGVuZHMgUGlsbENhbmRpZGF0ZVBhcnQge1xuICAgIHB1YmxpYyBnZXQgdHlwZSgpOiBJUGlsbENhbmRpZGF0ZVBhcnRbXCJ0eXBlXCJdIHtcbiAgICAgICAgcmV0dXJuIFR5cGUuQ29tbWFuZDtcbiAgICB9XG59XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQWlCQSxJQUFBQSxlQUFBLEdBQUFDLHNCQUFBLENBQUFDLE9BQUE7QUFJQSxJQUFBQyxVQUFBLEdBQUFGLHNCQUFBLENBQUFDLE9BQUE7QUFFQSxJQUFBRSxhQUFBLEdBQUFILHNCQUFBLENBQUFDLE9BQUE7QUFDQSxJQUFBRyxVQUFBLEdBQUFILE9BQUE7QUFDQSxJQUFBSSxNQUFBLEdBQUFDLHVCQUFBLENBQUFMLE9BQUE7QUFDQSxJQUFBTSxXQUFBLEdBQUFQLHNCQUFBLENBQUFDLE9BQUE7QUFDQSxJQUFBTyxRQUFBLEdBQUFQLE9BQUE7QUFDQSxJQUFBUSxjQUFBLEdBQUFULHNCQUFBLENBQUFDLE9BQUE7QUFDQSxJQUFBUyxRQUFBLEdBQUFULE9BQUE7QUFBb0QsU0FBQVUseUJBQUFDLFdBQUEsZUFBQUMsT0FBQSxrQ0FBQUMsaUJBQUEsT0FBQUQsT0FBQSxRQUFBRSxnQkFBQSxPQUFBRixPQUFBLFlBQUFGLHdCQUFBLFlBQUFBLENBQUFDLFdBQUEsV0FBQUEsV0FBQSxHQUFBRyxnQkFBQSxHQUFBRCxpQkFBQSxLQUFBRixXQUFBO0FBQUEsU0FBQU4sd0JBQUFVLEdBQUEsRUFBQUosV0FBQSxTQUFBQSxXQUFBLElBQUFJLEdBQUEsSUFBQUEsR0FBQSxDQUFB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