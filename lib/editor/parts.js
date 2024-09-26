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
//# sourceMappingURL=parts.js.map