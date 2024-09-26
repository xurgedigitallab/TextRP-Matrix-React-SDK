"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.MessageEventPreview = void 0;
var _event = require("matrix-js-sdk/src/@types/event");
var _languageHandler = require("../../../languageHandler");
var _utils = require("./utils");
var _HtmlUtils = require("../../../HtmlUtils");
var _Reply = require("../../../utils/Reply");
var _types = require("../../../voice-broadcast/types");
/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

class MessageEventPreview {
  getTextFor(event, tagId, isThread) {
    let eventContent = event.getContent();

    // no preview for broadcast chunks
    if (eventContent[_types.VoiceBroadcastChunkEventType]) return null;
    if (event.isRelation(_event.RelationType.Replace)) {
      // It's an edit, generate the preview on the new text
      eventContent = event.getContent()["m.new_content"];
    }
    if (!eventContent?.["body"]) return null; // invalid for our purposes

    let body = eventContent["body"].trim();
    if (!body) return null; // invalid event, no preview
    // A msgtype is actually required in the spec but the app is a bit softer on this requirement
    const msgtype = eventContent["msgtype"] ?? _event.MsgType.Text;
    const hasHtml = eventContent.format === "org.matrix.custom.html" && eventContent.formatted_body;
    if (hasHtml) {
      body = eventContent.formatted_body;
    }

    // XXX: Newer relations have a getRelation() function which is not compatible with replies.
    if (event.getWireContent()["m.relates_to"]?.["m.in_reply_to"]) {
      // If this is a reply, get the real reply and use that
      if (hasHtml) {
        body = ((0, _Reply.stripHTMLReply)(body) || "").trim();
      } else {
        body = ((0, _Reply.stripPlainReply)(body) || "").trim();
      }
      if (!body) return null; // invalid event, no preview
    }

    if (hasHtml) {
      const sanitised = (0, _HtmlUtils.getHtmlText)(body.replace(/<br\/?>/gi, "\n")); // replace line breaks before removing them
      // run it through DOMParser to fixup encoded html entities
      body = new DOMParser().parseFromString(sanitised, "text/html").documentElement.textContent;
    }
    body = (0, _languageHandler.sanitizeForTranslation)(body);
    if (msgtype === _event.MsgType.Emote) {
      return (0, _languageHandler._t)("* %(senderName)s %(emote)s", {
        senderName: (0, _utils.getSenderName)(event),
        emote: body
      });
    }
    const roomId = event.getRoomId();
    if (isThread || (0, _utils.isSelf)(event) || roomId && !(0, _utils.shouldPrefixMessagesIn)(roomId, tagId)) {
      return body;
    } else {
      return (0, _languageHandler._t)("%(senderName)s: %(message)s", {
        senderName: (0, _utils.getSenderName)(event),
        message: body
      });
    }
  }
}
exports.MessageEventPreview = MessageEventPreview;
//# sourceMappingURL=MessageEventPreview.js.map