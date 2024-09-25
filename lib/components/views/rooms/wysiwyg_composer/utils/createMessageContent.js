"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.EMOTE_PREFIX = void 0;
exports.createMessageContent = createMessageContent;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _matrixWysiwyg = require("@matrix-org/matrix-wysiwyg");
var _matrix = require("matrix-js-sdk/src/matrix");
var _SettingsStore = _interopRequireDefault(require("../../../../../settings/SettingsStore"));
var _Reply = require("../../../../../utils/Reply");
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; } /*
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
const EMOTE_PREFIX = "/me ";

// Merges favouring the given relation
exports.EMOTE_PREFIX = EMOTE_PREFIX;
function attachRelation(content, relation) {
  if (relation) {
    content["m.relates_to"] = _objectSpread(_objectSpread({}, content["m.relates_to"] || {}), relation);
  }
}
function getHtmlReplyFallback(mxEvent) {
  const html = mxEvent.getContent().formatted_body;
  if (!html) {
    return "";
  }
  const rootNode = new DOMParser().parseFromString(html, "text/html").body;
  const mxReply = rootNode.querySelector("mx-reply");
  return mxReply && mxReply.outerHTML || "";
}
function getTextReplyFallback(mxEvent) {
  const body = mxEvent.getContent().body;
  if (typeof body !== "string") {
    return "";
  }
  const lines = body.split("\n").map(l => l.trim());
  if (lines.length > 2 && lines[0].startsWith("> ") && lines[1].length === 0) {
    return `${lines[0]}\n\n`;
  }
  return "";
}
const isMatrixEvent = e => e instanceof _matrix.MatrixEvent;
async function createMessageContent(message, isHTML, _ref) {
  let {
    relation,
    replyToEvent,
    permalinkCreator,
    includeReplyLegacyFallback = true,
    editedEvent
  } = _ref;
  const isEditing = isMatrixEvent(editedEvent);
  const isReply = isEditing ? Boolean(editedEvent.replyEventId) : isMatrixEvent(replyToEvent);
  const isReplyAndEditing = isEditing && isReply;
  const isEmote = message.startsWith(EMOTE_PREFIX);
  if (isEmote) {
    // if we are dealing with an emote we want to remove the prefix so that `/me` does not
    // appear after the `* <userName>` text in the timeline
    message = message.slice(EMOTE_PREFIX.length);
  }
  if (message.startsWith("//")) {
    // if user wants to enter a single slash at the start of a message, this
    // is how they have to do it (due to it clashing with commands), so here we
    // remove the first character to make sure //word displays as /word
    message = message.slice(1);
  }

  // if we're editing rich text, the message content is pure html
  // BUT if we're not, the message content will be plain text
  const body = isHTML ? await (0, _matrixWysiwyg.richToPlain)(message) : message;
  const bodyPrefix = isReplyAndEditing && getTextReplyFallback(editedEvent) || "";
  const formattedBodyPrefix = isReplyAndEditing && getHtmlReplyFallback(editedEvent) || "";
  const content = {
    msgtype: isEmote ? _matrix.MsgType.Emote : _matrix.MsgType.Text,
    body: isEditing ? `${bodyPrefix} * ${body}` : body
  };

  // TODO markdown support

  const isMarkdownEnabled = _SettingsStore.default.getValue("MessageComposerInput.useMarkdown");
  const formattedBody = isHTML ? message : isMarkdownEnabled ? await (0, _matrixWysiwyg.plainToRich)(message) : null;
  if (formattedBody) {
    content.format = "org.matrix.custom.html";
    content.formatted_body = isEditing ? `${formattedBodyPrefix} * ${formattedBody}` : formattedBody;
  }
  if (isEditing) {
    content["m.new_content"] = {
      msgtype: content.msgtype,
      body: body
    };
    if (formattedBody) {
      content["m.new_content"].format = "org.matrix.custom.html";
      content["m.new_content"]["formatted_body"] = formattedBody;
    }
  }
  const newRelation = isEditing ? _objectSpread(_objectSpread({}, relation), {}, {
    rel_type: "m.replace",
    event_id: editedEvent.getId()
  }) : relation;

  // TODO Do we need to attach mentions here?
  // TODO Handle editing?
  attachRelation(content, newRelation);
  if (!isEditing && replyToEvent && permalinkCreator) {
    (0, _Reply.addReplyToMessageContent)(content, replyToEvent, {
      permalinkCreator,
      includeLegacyFallback: includeReplyLegacyFallback
    });
  }
  return content;
}
//# sourceMappingURL=createMessageContent.js.map