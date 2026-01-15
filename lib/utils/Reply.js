"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.addReplyToMessageContent = addReplyToMessageContent;
exports.getNestedReplyText = getNestedReplyText;
exports.getParentEventId = getParentEventId;
exports.makeReplyMixIn = makeReplyMixIn;
exports.shouldDisplayReply = shouldDisplayReply;
exports.stripHTMLReply = stripHTMLReply;
exports.stripPlainReply = stripPlainReply;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _sanitizeHtml = _interopRequireDefault(require("sanitize-html"));
var _escapeHtml = _interopRequireDefault(require("escape-html"));
var _thread = require("matrix-js-sdk/src/models/thread");
var _event = require("matrix-js-sdk/src/@types/event");
var _beacon = require("matrix-js-sdk/src/@types/beacon");
var _polls = require("matrix-js-sdk/src/@types/polls");
var _HtmlUtils = require("../HtmlUtils");
var _Permalinks = require("./permalinks/Permalinks");
var _location = require("./location");
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          * Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          * Copyright 2023 The Matrix.org Foundation C.I.C.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          * Licensed under the Apache License, Version 2.0 (the "License");
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          * you may not use this file except in compliance with the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          * You may obtain a copy of the License at
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          *         http://www.apache.org/licenses/LICENSE-2.0
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          * Unless required by applicable law or agreed to in writing, software
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          * distributed under the License is distributed on an "AS IS" BASIS,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          * See the License for the specific language governing permissions and
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          * limitations under the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          */
function getParentEventId(ev) {
  if (!ev || ev.isRedacted()) return;
  if (ev.replyEventId) {
    return ev.replyEventId;
  }
}

// Part of Replies fallback support
function stripPlainReply(body) {
  // Removes lines beginning with `> ` until you reach one that doesn't.
  const lines = body.split("\n");
  while (lines.length && lines[0].startsWith("> ")) lines.shift();
  // Reply fallback has a blank line after it, so remove it to prevent leading newline
  if (lines[0] === "") lines.shift();
  return lines.join("\n");
}

// Part of Replies fallback support - MUST NOT BE RENDERED DIRECTLY - UNSAFE HTML
function stripHTMLReply(html) {
  // Sanitize the original HTML for inclusion in <mx-reply>.  We allow
  // any HTML, since the original sender could use special tags that we
  // don't recognize, but want to pass along to any recipients who do
  // recognize them -- recipients should be sanitizing before displaying
  // anyways.  However, we sanitize to 1) remove any mx-reply, so that we
  // don't generate a nested mx-reply, and 2) make sure that the HTML is
  // properly formatted (e.g. tags are closed where necessary)
  return (0, _sanitizeHtml.default)(html, {
    allowedTags: false,
    // false means allow everything
    allowedAttributes: false,
    allowVulnerableTags: true,
    // silence xss warning, we won't be rendering directly this, so it is safe to do
    // we somehow can't allow all schemes, so we allow all that we
    // know of and mxc (for img tags)
    allowedSchemes: [..._HtmlUtils.PERMITTED_URL_SCHEMES, "mxc"],
    exclusiveFilter: frame => frame.tag === "mx-reply"
  });
}

// Part of Replies fallback support
function getNestedReplyText(ev, permalinkCreator) {
  if (!ev) return null;
  let {
    body,
    formatted_body: html,
    msgtype
  } = ev.getContent();
  if (getParentEventId(ev)) {
    if (body) body = stripPlainReply(body);
  }
  if (!body) body = ""; // Always ensure we have a body, for reasons.

  if (html) {
    // sanitize the HTML before we put it in an <mx-reply>
    html = stripHTMLReply(html);
  } else {
    // Escape the body to use as HTML below.
    // We also run a nl2br over the result to fix the fallback representation. We do this
    // after converting the text to safe HTML to avoid user-provided BR's from being converted.
    html = (0, _escapeHtml.default)(body).replace(/\n/g, "<br/>");
  }

  // dev note: do not rely on `body` being safe for HTML usage below.

  const evLink = permalinkCreator?.forEvent(ev.getId());
  const userLink = (0, _Permalinks.makeUserPermalink)(ev.getSender());
  const mxid = ev.getSender();
  if (_beacon.M_BEACON_INFO.matches(ev.getType())) {
    const aTheir = (0, _location.isSelfLocation)(ev.getContent()) ? "their" : "a";
    return {
      html: `<mx-reply><blockquote><a href="${evLink}">In reply to</a> <a href="${userLink}">${mxid}</a>` + `<br>shared ${aTheir} live location.</blockquote></mx-reply>`,
      body: `> <${mxid}> shared ${aTheir} live location.\n\n`
    };
  }
  if (_polls.M_POLL_START.matches(ev.getType())) {
    const extensibleEvent = ev.unstableExtensibleEvent;
    const question = extensibleEvent?.question?.text;
    return {
      html: `<mx-reply><blockquote><a href="${evLink}">In reply to</a> <a href="${userLink}">${mxid}</a>` + `<br>Poll: ${question}</blockquote></mx-reply>`,
      body: `> <${mxid}> started poll: ${question}\n\n`
    };
  }
  if (_polls.M_POLL_END.matches(ev.getType())) {
    return {
      html: `<mx-reply><blockquote><a href="${evLink}">In reply to</a> <a href="${userLink}">${mxid}</a>` + `<br>Ended poll</blockquote></mx-reply>`,
      body: `> <${mxid}>Ended poll\n\n`
    };
  }

  // This fallback contains text that is explicitly EN.
  switch (msgtype) {
    case _event.MsgType.Text:
    case _event.MsgType.Notice:
      {
        html = `<mx-reply><blockquote><a href="${evLink}">In reply to</a> <a href="${userLink}">${mxid}</a>` + `<br>${html}</blockquote></mx-reply>`;
        const lines = body.trim().split("\n");
        if (lines.length > 0) {
          lines[0] = `<${mxid}> ${lines[0]}`;
          body = lines.map(line => `> ${line}`).join("\n") + "\n\n";
        }
        break;
      }
    case _event.MsgType.Image:
      html = `<mx-reply><blockquote><a href="${evLink}">In reply to</a> <a href="${userLink}">${mxid}</a>` + `<br>sent an image.</blockquote></mx-reply>`;
      body = `> <${mxid}> sent an image.\n\n`;
      break;
    case _event.MsgType.Video:
      html = `<mx-reply><blockquote><a href="${evLink}">In reply to</a> <a href="${userLink}">${mxid}</a>` + `<br>sent a video.</blockquote></mx-reply>`;
      body = `> <${mxid}> sent a video.\n\n`;
      break;
    case _event.MsgType.Audio:
      html = `<mx-reply><blockquote><a href="${evLink}">In reply to</a> <a href="${userLink}">${mxid}</a>` + `<br>sent an audio file.</blockquote></mx-reply>`;
      body = `> <${mxid}> sent an audio file.\n\n`;
      break;
    case _event.MsgType.File:
      html = `<mx-reply><blockquote><a href="${evLink}">In reply to</a> <a href="${userLink}">${mxid}</a>` + `<br>sent a file.</blockquote></mx-reply>`;
      body = `> <${mxid}> sent a file.\n\n`;
      break;
    case _event.MsgType.Location:
      {
        const aTheir = (0, _location.isSelfLocation)(ev.getContent()) ? "their" : "a";
        html = `<mx-reply><blockquote><a href="${evLink}">In reply to</a> <a href="${userLink}">${mxid}</a>` + `<br>shared ${aTheir} location.</blockquote></mx-reply>`;
        body = `> <${mxid}> shared ${aTheir} location.\n\n`;
        break;
      }
    case _event.MsgType.Emote:
      {
        html = `<mx-reply><blockquote><a href="${evLink}">In reply to</a> * ` + `<a href="${userLink}">${mxid}</a><br>${html}</blockquote></mx-reply>`;
        const lines = body.trim().split("\n");
        if (lines.length > 0) {
          lines[0] = `* <${mxid}> ${lines[0]}`;
          body = lines.map(line => `> ${line}`).join("\n") + "\n\n";
        }
        break;
      }
    default:
      return null;
  }
  return {
    body,
    html
  };
}
function makeReplyMixIn(ev) {
  if (!ev) return {};
  const mixin = {
    "m.in_reply_to": {
      event_id: ev.getId()
    }
  };
  if (ev.threadRootId) {
    mixin.is_falling_back = false;
  }
  return mixin;
}
function shouldDisplayReply(event) {
  if (event.isRedacted()) {
    return false;
  }
  const inReplyTo = event.getWireContent()?.["m.relates_to"]?.["m.in_reply_to"];
  if (!inReplyTo) {
    return false;
  }
  const relation = event.getRelation();
  if (relation?.rel_type === _thread.THREAD_RELATION_TYPE.name && relation?.is_falling_back) {
    return false;
  }
  return !!inReplyTo.event_id;
}
function addReplyToMessageContent(content, replyToEvent, opts) {
  content["m.relates_to"] = _objectSpread(_objectSpread({}, content["m.relates_to"] || {}), makeReplyMixIn(replyToEvent));
  if (opts.includeLegacyFallback) {
    // Part of Replies fallback support - prepend the text we're sending with the text we're replying to
    const nestedReply = getNestedReplyText(replyToEvent, opts.permalinkCreator);
    if (nestedReply) {
      if (content.formatted_body) {
        content.formatted_body = nestedReply.html + content.formatted_body;
      }
      content.body = nestedReply.body + content.body;
    }
  }
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfc2FuaXRpemVIdG1sIiwiX2ludGVyb3BSZXF1aXJlRGVmYXVsdCIsInJlcXVpcmUiLCJfZXNjYXBlSHRtbCIsIl90aHJlYWQiLCJfZXZlbnQiLCJfYmVhY29uIiwiX3BvbGxzIiwiX0h0bWxVdGlscyIsIl9QZXJtYWxpbmtzIiwiX2xvY2F0aW9uIiwib3duS2V5cyIsIm9iamVjdCIsImVudW1lcmFibGVPbmx5Iiwia2V5cyIsIk9iamVjdCIsImdldE93blByb3BlcnR5U3ltYm9scyIsInN5bWJvbHMiLCJmaWx0ZXIiLCJzeW0iLCJnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IiLCJlbnVtZXJhYmxlIiwicHVzaCIsImFwcGx5IiwiX29iamVjdFNwcmVhZCIsInRhcmdldCIsImkiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJzb3VyY2UiLCJmb3JFYWNoIiwia2V5IiwiX2RlZmluZVByb3BlcnR5MiIsImRlZmF1bHQiLCJnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzIiwiZGVmaW5lUHJvcGVydGllcyIsImRlZmluZVByb3BlcnR5IiwiZ2V0UGFyZW50RXZlbnRJZCIsImV2IiwiaXNSZWRhY3RlZCIsInJlcGx5RXZlbnRJZCIsInN0cmlwUGxhaW5SZXBseSIsImJvZHkiLCJsaW5lcyIsInNwbGl0Iiwic3RhcnRzV2l0aCIsInNoaWZ0Iiwiam9pbiIsInN0cmlwSFRNTFJlcGx5IiwiaHRtbCIsInNhbml0aXplSHRtbCIsImFsbG93ZWRUYWdzIiwiYWxsb3dlZEF0dHJpYnV0ZXMiLCJhbGxvd1Z1bG5lcmFibGVUYWdzIiwiYWxsb3dlZFNjaGVtZXMiLCJQRVJNSVRURURfVVJMX1NDSEVNRVMiLCJleGNsdXNpdmVGaWx0ZXIiLCJmcmFtZSIsInRhZyIsImdldE5lc3RlZFJlcGx5VGV4dCIsInBlcm1hbGlua0NyZWF0b3IiLCJmb3JtYXR0ZWRfYm9keSIsIm1zZ3R5cGUiLCJnZXRDb250ZW50IiwiZXNjYXBlSHRtbCIsInJlcGxhY2UiLCJldkxpbmsiLCJmb3JFdmVudCIsImdldElkIiwidXNlckxpbmsiLCJtYWtlVXNlclBlcm1hbGluayIsImdldFNlbmRlciIsIm14aWQiLCJNX0JFQUNPTl9JTkZPIiwibWF0Y2hlcyIsImdldFR5cGUiLCJhVGhlaXIiLCJpc1NlbGZMb2NhdGlvbiIsIk1fUE9MTF9TVEFSVCIsImV4dGVuc2libGVFdmVudCIsInVuc3RhYmxlRXh0ZW5zaWJsZUV2ZW50IiwicXVlc3Rpb24iLCJ0ZXh0IiwiTV9QT0xMX0VORCIsIk1zZ1R5cGUiLCJUZXh0IiwiTm90aWNlIiwidHJpbSIsIm1hcCIsImxpbmUiLCJJbWFnZSIsIlZpZGVvIiwiQXVkaW8iLCJGaWxlIiwiTG9jYXRpb24iLCJFbW90ZSIsIm1ha2VSZXBseU1peEluIiwibWl4aW4iLCJldmVudF9pZCIsInRocmVhZFJvb3RJZCIsImlzX2ZhbGxpbmdfYmFjayIsInNob3VsZERpc3BsYXlSZXBseSIsImV2ZW50IiwiaW5SZXBseVRvIiwiZ2V0V2lyZUNvbnRlbnQiLCJyZWxhdGlvbiIsImdldFJlbGF0aW9uIiwicmVsX3R5cGUiLCJUSFJFQURfUkVMQVRJT05fVFlQRSIsIm5hbWUiLCJhZGRSZXBseVRvTWVzc2FnZUNvbnRlbnQiLCJjb250ZW50IiwicmVwbHlUb0V2ZW50Iiwib3B0cyIsImluY2x1ZGVMZWdhY3lGYWxsYmFjayIsIm5lc3RlZFJlcGx5Il0sInNvdXJjZXMiOlsiLi4vLi4vc3JjL3V0aWxzL1JlcGx5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qXG4gKiBDb3B5cmlnaHQgMjAyMSDFoGltb24gQnJhbmRuZXIgPHNpbW9uLmJyYS5hZ0BnbWFpbC5jb20+XG4gKiBDb3B5cmlnaHQgMjAyMyBUaGUgTWF0cml4Lm9yZyBGb3VuZGF0aW9uIEMuSS5DLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuaW1wb3J0IHsgSUNvbnRlbnQsIElFdmVudFJlbGF0aW9uLCBNYXRyaXhFdmVudCB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9tb2RlbHMvZXZlbnRcIjtcbmltcG9ydCBzYW5pdGl6ZUh0bWwgZnJvbSBcInNhbml0aXplLWh0bWxcIjtcbmltcG9ydCBlc2NhcGVIdG1sIGZyb20gXCJlc2NhcGUtaHRtbFwiO1xuaW1wb3J0IHsgVEhSRUFEX1JFTEFUSU9OX1RZUEUgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbW9kZWxzL3RocmVhZFwiO1xuaW1wb3J0IHsgTXNnVHlwZSB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9AdHlwZXMvZXZlbnRcIjtcbmltcG9ydCB7IE1fQkVBQ09OX0lORk8gfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvQHR5cGVzL2JlYWNvblwiO1xuaW1wb3J0IHsgTV9QT0xMX0VORCwgTV9QT0xMX1NUQVJUIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL0B0eXBlcy9wb2xsc1wiO1xuaW1wb3J0IHsgUG9sbFN0YXJ0RXZlbnQgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvZXh0ZW5zaWJsZV9ldmVudHNfdjEvUG9sbFN0YXJ0RXZlbnRcIjtcblxuaW1wb3J0IHsgUEVSTUlUVEVEX1VSTF9TQ0hFTUVTIH0gZnJvbSBcIi4uL0h0bWxVdGlsc1wiO1xuaW1wb3J0IHsgbWFrZVVzZXJQZXJtYWxpbmssIFJvb21QZXJtYWxpbmtDcmVhdG9yIH0gZnJvbSBcIi4vcGVybWFsaW5rcy9QZXJtYWxpbmtzXCI7XG5pbXBvcnQgeyBpc1NlbGZMb2NhdGlvbiB9IGZyb20gXCIuL2xvY2F0aW9uXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRQYXJlbnRFdmVudElkKGV2PzogTWF0cml4RXZlbnQpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAgIGlmICghZXYgfHwgZXYuaXNSZWRhY3RlZCgpKSByZXR1cm47XG4gICAgaWYgKGV2LnJlcGx5RXZlbnRJZCkge1xuICAgICAgICByZXR1cm4gZXYucmVwbHlFdmVudElkO1xuICAgIH1cbn1cblxuLy8gUGFydCBvZiBSZXBsaWVzIGZhbGxiYWNrIHN1cHBvcnRcbmV4cG9ydCBmdW5jdGlvbiBzdHJpcFBsYWluUmVwbHkoYm9keTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAvLyBSZW1vdmVzIGxpbmVzIGJlZ2lubmluZyB3aXRoIGA+IGAgdW50aWwgeW91IHJlYWNoIG9uZSB0aGF0IGRvZXNuJ3QuXG4gICAgY29uc3QgbGluZXMgPSBib2R5LnNwbGl0KFwiXFxuXCIpO1xuICAgIHdoaWxlIChsaW5lcy5sZW5ndGggJiYgbGluZXNbMF0uc3RhcnRzV2l0aChcIj4gXCIpKSBsaW5lcy5zaGlmdCgpO1xuICAgIC8vIFJlcGx5IGZhbGxiYWNrIGhhcyBhIGJsYW5rIGxpbmUgYWZ0ZXIgaXQsIHNvIHJlbW92ZSBpdCB0byBwcmV2ZW50IGxlYWRpbmcgbmV3bGluZVxuICAgIGlmIChsaW5lc1swXSA9PT0gXCJcIikgbGluZXMuc2hpZnQoKTtcbiAgICByZXR1cm4gbGluZXMuam9pbihcIlxcblwiKTtcbn1cblxuLy8gUGFydCBvZiBSZXBsaWVzIGZhbGxiYWNrIHN1cHBvcnQgLSBNVVNUIE5PVCBCRSBSRU5ERVJFRCBESVJFQ1RMWSAtIFVOU0FGRSBIVE1MXG5leHBvcnQgZnVuY3Rpb24gc3RyaXBIVE1MUmVwbHkoaHRtbDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAvLyBTYW5pdGl6ZSB0aGUgb3JpZ2luYWwgSFRNTCBmb3IgaW5jbHVzaW9uIGluIDxteC1yZXBseT4uICBXZSBhbGxvd1xuICAgIC8vIGFueSBIVE1MLCBzaW5jZSB0aGUgb3JpZ2luYWwgc2VuZGVyIGNvdWxkIHVzZSBzcGVjaWFsIHRhZ3MgdGhhdCB3ZVxuICAgIC8vIGRvbid0IHJlY29nbml6ZSwgYnV0IHdhbnQgdG8gcGFzcyBhbG9uZyB0byBhbnkgcmVjaXBpZW50cyB3aG8gZG9cbiAgICAvLyByZWNvZ25pemUgdGhlbSAtLSByZWNpcGllbnRzIHNob3VsZCBiZSBzYW5pdGl6aW5nIGJlZm9yZSBkaXNwbGF5aW5nXG4gICAgLy8gYW55d2F5cy4gIEhvd2V2ZXIsIHdlIHNhbml0aXplIHRvIDEpIHJlbW92ZSBhbnkgbXgtcmVwbHksIHNvIHRoYXQgd2VcbiAgICAvLyBkb24ndCBnZW5lcmF0ZSBhIG5lc3RlZCBteC1yZXBseSwgYW5kIDIpIG1ha2Ugc3VyZSB0aGF0IHRoZSBIVE1MIGlzXG4gICAgLy8gcHJvcGVybHkgZm9ybWF0dGVkIChlLmcuIHRhZ3MgYXJlIGNsb3NlZCB3aGVyZSBuZWNlc3NhcnkpXG4gICAgcmV0dXJuIHNhbml0aXplSHRtbChodG1sLCB7XG4gICAgICAgIGFsbG93ZWRUYWdzOiBmYWxzZSwgLy8gZmFsc2UgbWVhbnMgYWxsb3cgZXZlcnl0aGluZ1xuICAgICAgICBhbGxvd2VkQXR0cmlidXRlczogZmFsc2UsXG4gICAgICAgIGFsbG93VnVsbmVyYWJsZVRhZ3M6IHRydWUsIC8vIHNpbGVuY2UgeHNzIHdhcm5pbmcsIHdlIHdvbid0IGJlIHJlbmRlcmluZyBkaXJlY3RseSB0aGlzLCBzbyBpdCBpcyBzYWZlIHRvIGRvXG4gICAgICAgIC8vIHdlIHNvbWVob3cgY2FuJ3QgYWxsb3cgYWxsIHNjaGVtZXMsIHNvIHdlIGFsbG93IGFsbCB0aGF0IHdlXG4gICAgICAgIC8vIGtub3cgb2YgYW5kIG14YyAoZm9yIGltZyB0YWdzKVxuICAgICAgICBhbGxvd2VkU2NoZW1lczogWy4uLlBFUk1JVFRFRF9VUkxfU0NIRU1FUywgXCJteGNcIl0sXG4gICAgICAgIGV4Y2x1c2l2ZUZpbHRlcjogKGZyYW1lKSA9PiBmcmFtZS50YWcgPT09IFwibXgtcmVwbHlcIixcbiAgICB9KTtcbn1cblxuLy8gUGFydCBvZiBSZXBsaWVzIGZhbGxiYWNrIHN1cHBvcnRcbmV4cG9ydCBmdW5jdGlvbiBnZXROZXN0ZWRSZXBseVRleHQoXG4gICAgZXY6IE1hdHJpeEV2ZW50LFxuICAgIHBlcm1hbGlua0NyZWF0b3I/OiBSb29tUGVybWFsaW5rQ3JlYXRvcixcbik6IHsgYm9keTogc3RyaW5nOyBodG1sOiBzdHJpbmcgfSB8IG51bGwge1xuICAgIGlmICghZXYpIHJldHVybiBudWxsO1xuXG4gICAgbGV0IHtcbiAgICAgICAgYm9keSxcbiAgICAgICAgZm9ybWF0dGVkX2JvZHk6IGh0bWwsXG4gICAgICAgIG1zZ3R5cGUsXG4gICAgfSA9IGV2LmdldENvbnRlbnQ8e1xuICAgICAgICBib2R5OiBzdHJpbmc7XG4gICAgICAgIG1zZ3R5cGU/OiBzdHJpbmc7XG4gICAgICAgIGZvcm1hdHRlZF9ib2R5Pzogc3RyaW5nO1xuICAgIH0+KCk7XG4gICAgaWYgKGdldFBhcmVudEV2ZW50SWQoZXYpKSB7XG4gICAgICAgIGlmIChib2R5KSBib2R5ID0gc3RyaXBQbGFpblJlcGx5KGJvZHkpO1xuICAgIH1cblxuICAgIGlmICghYm9keSkgYm9keSA9IFwiXCI7IC8vIEFsd2F5cyBlbnN1cmUgd2UgaGF2ZSBhIGJvZHksIGZvciByZWFzb25zLlxuXG4gICAgaWYgKGh0bWwpIHtcbiAgICAgICAgLy8gc2FuaXRpemUgdGhlIEhUTUwgYmVmb3JlIHdlIHB1dCBpdCBpbiBhbiA8bXgtcmVwbHk+XG4gICAgICAgIGh0bWwgPSBzdHJpcEhUTUxSZXBseShodG1sKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBFc2NhcGUgdGhlIGJvZHkgdG8gdXNlIGFzIEhUTUwgYmVsb3cuXG4gICAgICAgIC8vIFdlIGFsc28gcnVuIGEgbmwyYnIgb3ZlciB0aGUgcmVzdWx0IHRvIGZpeCB0aGUgZmFsbGJhY2sgcmVwcmVzZW50YXRpb24uIFdlIGRvIHRoaXNcbiAgICAgICAgLy8gYWZ0ZXIgY29udmVydGluZyB0aGUgdGV4dCB0byBzYWZlIEhUTUwgdG8gYXZvaWQgdXNlci1wcm92aWRlZCBCUidzIGZyb20gYmVpbmcgY29udmVydGVkLlxuICAgICAgICBodG1sID0gZXNjYXBlSHRtbChib2R5KS5yZXBsYWNlKC9cXG4vZywgXCI8YnIvPlwiKTtcbiAgICB9XG5cbiAgICAvLyBkZXYgbm90ZTogZG8gbm90IHJlbHkgb24gYGJvZHlgIGJlaW5nIHNhZmUgZm9yIEhUTUwgdXNhZ2UgYmVsb3cuXG5cbiAgICBjb25zdCBldkxpbmsgPSBwZXJtYWxpbmtDcmVhdG9yPy5mb3JFdmVudChldi5nZXRJZCgpISk7XG4gICAgY29uc3QgdXNlckxpbmsgPSBtYWtlVXNlclBlcm1hbGluayhldi5nZXRTZW5kZXIoKSEpO1xuICAgIGNvbnN0IG14aWQgPSBldi5nZXRTZW5kZXIoKTtcblxuICAgIGlmIChNX0JFQUNPTl9JTkZPLm1hdGNoZXMoZXYuZ2V0VHlwZSgpKSkge1xuICAgICAgICBjb25zdCBhVGhlaXIgPSBpc1NlbGZMb2NhdGlvbihldi5nZXRDb250ZW50KCkpID8gXCJ0aGVpclwiIDogXCJhXCI7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBodG1sOlxuICAgICAgICAgICAgICAgIGA8bXgtcmVwbHk+PGJsb2NrcXVvdGU+PGEgaHJlZj1cIiR7ZXZMaW5rfVwiPkluIHJlcGx5IHRvPC9hPiA8YSBocmVmPVwiJHt1c2VyTGlua31cIj4ke214aWR9PC9hPmAgK1xuICAgICAgICAgICAgICAgIGA8YnI+c2hhcmVkICR7YVRoZWlyfSBsaXZlIGxvY2F0aW9uLjwvYmxvY2txdW90ZT48L214LXJlcGx5PmAsXG4gICAgICAgICAgICBib2R5OiBgPiA8JHtteGlkfT4gc2hhcmVkICR7YVRoZWlyfSBsaXZlIGxvY2F0aW9uLlxcblxcbmAsXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgaWYgKE1fUE9MTF9TVEFSVC5tYXRjaGVzKGV2LmdldFR5cGUoKSkpIHtcbiAgICAgICAgY29uc3QgZXh0ZW5zaWJsZUV2ZW50ID0gZXYudW5zdGFibGVFeHRlbnNpYmxlRXZlbnQgYXMgUG9sbFN0YXJ0RXZlbnQ7XG4gICAgICAgIGNvbnN0IHF1ZXN0aW9uID0gZXh0ZW5zaWJsZUV2ZW50Py5xdWVzdGlvbj8udGV4dDtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGh0bWw6XG4gICAgICAgICAgICAgICAgYDxteC1yZXBseT48YmxvY2txdW90ZT48YSBocmVmPVwiJHtldkxpbmt9XCI+SW4gcmVwbHkgdG88L2E+IDxhIGhyZWY9XCIke3VzZXJMaW5rfVwiPiR7bXhpZH08L2E+YCArXG4gICAgICAgICAgICAgICAgYDxicj5Qb2xsOiAke3F1ZXN0aW9ufTwvYmxvY2txdW90ZT48L214LXJlcGx5PmAsXG4gICAgICAgICAgICBib2R5OiBgPiA8JHtteGlkfT4gc3RhcnRlZCBwb2xsOiAke3F1ZXN0aW9ufVxcblxcbmAsXG4gICAgICAgIH07XG4gICAgfVxuICAgIGlmIChNX1BPTExfRU5ELm1hdGNoZXMoZXYuZ2V0VHlwZSgpKSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaHRtbDpcbiAgICAgICAgICAgICAgICBgPG14LXJlcGx5PjxibG9ja3F1b3RlPjxhIGhyZWY9XCIke2V2TGlua31cIj5JbiByZXBseSB0bzwvYT4gPGEgaHJlZj1cIiR7dXNlckxpbmt9XCI+JHtteGlkfTwvYT5gICtcbiAgICAgICAgICAgICAgICBgPGJyPkVuZGVkIHBvbGw8L2Jsb2NrcXVvdGU+PC9teC1yZXBseT5gLFxuICAgICAgICAgICAgYm9keTogYD4gPCR7bXhpZH0+RW5kZWQgcG9sbFxcblxcbmAsXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gVGhpcyBmYWxsYmFjayBjb250YWlucyB0ZXh0IHRoYXQgaXMgZXhwbGljaXRseSBFTi5cbiAgICBzd2l0Y2ggKG1zZ3R5cGUpIHtcbiAgICAgICAgY2FzZSBNc2dUeXBlLlRleHQ6XG4gICAgICAgIGNhc2UgTXNnVHlwZS5Ob3RpY2U6IHtcbiAgICAgICAgICAgIGh0bWwgPVxuICAgICAgICAgICAgICAgIGA8bXgtcmVwbHk+PGJsb2NrcXVvdGU+PGEgaHJlZj1cIiR7ZXZMaW5rfVwiPkluIHJlcGx5IHRvPC9hPiA8YSBocmVmPVwiJHt1c2VyTGlua31cIj4ke214aWR9PC9hPmAgK1xuICAgICAgICAgICAgICAgIGA8YnI+JHtodG1sfTwvYmxvY2txdW90ZT48L214LXJlcGx5PmA7XG4gICAgICAgICAgICBjb25zdCBsaW5lcyA9IGJvZHkudHJpbSgpLnNwbGl0KFwiXFxuXCIpO1xuICAgICAgICAgICAgaWYgKGxpbmVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBsaW5lc1swXSA9IGA8JHtteGlkfT4gJHtsaW5lc1swXX1gO1xuICAgICAgICAgICAgICAgIGJvZHkgPSBsaW5lcy5tYXAoKGxpbmUpID0+IGA+ICR7bGluZX1gKS5qb2luKFwiXFxuXCIpICsgXCJcXG5cXG5cIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNhc2UgTXNnVHlwZS5JbWFnZTpcbiAgICAgICAgICAgIGh0bWwgPVxuICAgICAgICAgICAgICAgIGA8bXgtcmVwbHk+PGJsb2NrcXVvdGU+PGEgaHJlZj1cIiR7ZXZMaW5rfVwiPkluIHJlcGx5IHRvPC9hPiA8YSBocmVmPVwiJHt1c2VyTGlua31cIj4ke214aWR9PC9hPmAgK1xuICAgICAgICAgICAgICAgIGA8YnI+c2VudCBhbiBpbWFnZS48L2Jsb2NrcXVvdGU+PC9teC1yZXBseT5gO1xuICAgICAgICAgICAgYm9keSA9IGA+IDwke214aWR9PiBzZW50IGFuIGltYWdlLlxcblxcbmA7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBNc2dUeXBlLlZpZGVvOlxuICAgICAgICAgICAgaHRtbCA9XG4gICAgICAgICAgICAgICAgYDxteC1yZXBseT48YmxvY2txdW90ZT48YSBocmVmPVwiJHtldkxpbmt9XCI+SW4gcmVwbHkgdG88L2E+IDxhIGhyZWY9XCIke3VzZXJMaW5rfVwiPiR7bXhpZH08L2E+YCArXG4gICAgICAgICAgICAgICAgYDxicj5zZW50IGEgdmlkZW8uPC9ibG9ja3F1b3RlPjwvbXgtcmVwbHk+YDtcbiAgICAgICAgICAgIGJvZHkgPSBgPiA8JHtteGlkfT4gc2VudCBhIHZpZGVvLlxcblxcbmA7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBNc2dUeXBlLkF1ZGlvOlxuICAgICAgICAgICAgaHRtbCA9XG4gICAgICAgICAgICAgICAgYDxteC1yZXBseT48YmxvY2txdW90ZT48YSBocmVmPVwiJHtldkxpbmt9XCI+SW4gcmVwbHkgdG88L2E+IDxhIGhyZWY9XCIke3VzZXJMaW5rfVwiPiR7bXhpZH08L2E+YCArXG4gICAgICAgICAgICAgICAgYDxicj5zZW50IGFuIGF1ZGlvIGZpbGUuPC9ibG9ja3F1b3RlPjwvbXgtcmVwbHk+YDtcbiAgICAgICAgICAgIGJvZHkgPSBgPiA8JHtteGlkfT4gc2VudCBhbiBhdWRpbyBmaWxlLlxcblxcbmA7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBNc2dUeXBlLkZpbGU6XG4gICAgICAgICAgICBodG1sID1cbiAgICAgICAgICAgICAgICBgPG14LXJlcGx5PjxibG9ja3F1b3RlPjxhIGhyZWY9XCIke2V2TGlua31cIj5JbiByZXBseSB0bzwvYT4gPGEgaHJlZj1cIiR7dXNlckxpbmt9XCI+JHtteGlkfTwvYT5gICtcbiAgICAgICAgICAgICAgICBgPGJyPnNlbnQgYSBmaWxlLjwvYmxvY2txdW90ZT48L214LXJlcGx5PmA7XG4gICAgICAgICAgICBib2R5ID0gYD4gPCR7bXhpZH0+IHNlbnQgYSBmaWxlLlxcblxcbmA7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBNc2dUeXBlLkxvY2F0aW9uOiB7XG4gICAgICAgICAgICBjb25zdCBhVGhlaXIgPSBpc1NlbGZMb2NhdGlvbihldi5nZXRDb250ZW50KCkpID8gXCJ0aGVpclwiIDogXCJhXCI7XG4gICAgICAgICAgICBodG1sID1cbiAgICAgICAgICAgICAgICBgPG14LXJlcGx5PjxibG9ja3F1b3RlPjxhIGhyZWY9XCIke2V2TGlua31cIj5JbiByZXBseSB0bzwvYT4gPGEgaHJlZj1cIiR7dXNlckxpbmt9XCI+JHtteGlkfTwvYT5gICtcbiAgICAgICAgICAgICAgICBgPGJyPnNoYXJlZCAke2FUaGVpcn0gbG9jYXRpb24uPC9ibG9ja3F1b3RlPjwvbXgtcmVwbHk+YDtcbiAgICAgICAgICAgIGJvZHkgPSBgPiA8JHtteGlkfT4gc2hhcmVkICR7YVRoZWlyfSBsb2NhdGlvbi5cXG5cXG5gO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgY2FzZSBNc2dUeXBlLkVtb3RlOiB7XG4gICAgICAgICAgICBodG1sID1cbiAgICAgICAgICAgICAgICBgPG14LXJlcGx5PjxibG9ja3F1b3RlPjxhIGhyZWY9XCIke2V2TGlua31cIj5JbiByZXBseSB0bzwvYT4gKiBgICtcbiAgICAgICAgICAgICAgICBgPGEgaHJlZj1cIiR7dXNlckxpbmt9XCI+JHtteGlkfTwvYT48YnI+JHtodG1sfTwvYmxvY2txdW90ZT48L214LXJlcGx5PmA7XG4gICAgICAgICAgICBjb25zdCBsaW5lcyA9IGJvZHkudHJpbSgpLnNwbGl0KFwiXFxuXCIpO1xuICAgICAgICAgICAgaWYgKGxpbmVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBsaW5lc1swXSA9IGAqIDwke214aWR9PiAke2xpbmVzWzBdfWA7XG4gICAgICAgICAgICAgICAgYm9keSA9IGxpbmVzLm1hcCgobGluZSkgPT4gYD4gJHtsaW5lfWApLmpvaW4oXCJcXG5cIikgKyBcIlxcblxcblwiO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiB7IGJvZHksIGh0bWwgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1ha2VSZXBseU1peEluKGV2PzogTWF0cml4RXZlbnQpOiBJRXZlbnRSZWxhdGlvbiB7XG4gICAgaWYgKCFldikgcmV0dXJuIHt9O1xuXG4gICAgY29uc3QgbWl4aW46IElFdmVudFJlbGF0aW9uID0ge1xuICAgICAgICBcIm0uaW5fcmVwbHlfdG9cIjoge1xuICAgICAgICAgICAgZXZlbnRfaWQ6IGV2LmdldElkKCksXG4gICAgICAgIH0sXG4gICAgfTtcblxuICAgIGlmIChldi50aHJlYWRSb290SWQpIHtcbiAgICAgICAgbWl4aW4uaXNfZmFsbGluZ19iYWNrID0gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIG1peGluO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2hvdWxkRGlzcGxheVJlcGx5KGV2ZW50OiBNYXRyaXhFdmVudCk6IGJvb2xlYW4ge1xuICAgIGlmIChldmVudC5pc1JlZGFjdGVkKCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGNvbnN0IGluUmVwbHlUbyA9IGV2ZW50LmdldFdpcmVDb250ZW50KCk/LltcIm0ucmVsYXRlc190b1wiXT8uW1wibS5pbl9yZXBseV90b1wiXTtcbiAgICBpZiAoIWluUmVwbHlUbykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgY29uc3QgcmVsYXRpb24gPSBldmVudC5nZXRSZWxhdGlvbigpO1xuICAgIGlmIChyZWxhdGlvbj8ucmVsX3R5cGUgPT09IFRIUkVBRF9SRUxBVElPTl9UWVBFLm5hbWUgJiYgcmVsYXRpb24/LmlzX2ZhbGxpbmdfYmFjaykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuICEhaW5SZXBseVRvLmV2ZW50X2lkO1xufVxuXG5pbnRlcmZhY2UgQWRkUmVwbHlPcHRzIHtcbiAgICBwZXJtYWxpbmtDcmVhdG9yPzogUm9vbVBlcm1hbGlua0NyZWF0b3I7XG4gICAgaW5jbHVkZUxlZ2FjeUZhbGxiYWNrOiBmYWxzZTtcbn1cblxuaW50ZXJmYWNlIEluY2x1ZGVMZWdhY3lGZWVkYmFja09wdHMge1xuICAgIHBlcm1hbGlua0NyZWF0b3I/OiBSb29tUGVybWFsaW5rQ3JlYXRvcjtcbiAgICBpbmNsdWRlTGVnYWN5RmFsbGJhY2s6IHRydWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRSZXBseVRvTWVzc2FnZUNvbnRlbnQoXG4gICAgY29udGVudDogSUNvbnRlbnQsXG4gICAgcmVwbHlUb0V2ZW50OiBNYXRyaXhFdmVudCxcbiAgICBvcHRzOiBBZGRSZXBseU9wdHMgfCBJbmNsdWRlTGVnYWN5RmVlZGJhY2tPcHRzLFxuKTogdm9pZCB7XG4gICAgY29udGVudFtcIm0ucmVsYXRlc190b1wiXSA9IHtcbiAgICAgICAgLi4uKGNvbnRlbnRbXCJtLnJlbGF0ZXNfdG9cIl0gfHwge30pLFxuICAgICAgICAuLi5tYWtlUmVwbHlNaXhJbihyZXBseVRvRXZlbnQpLFxuICAgIH07XG5cbiAgICBpZiAob3B0cy5pbmNsdWRlTGVnYWN5RmFsbGJhY2spIHtcbiAgICAgICAgLy8gUGFydCBvZiBSZXBsaWVzIGZhbGxiYWNrIHN1cHBvcnQgLSBwcmVwZW5kIHRoZSB0ZXh0IHdlJ3JlIHNlbmRpbmcgd2l0aCB0aGUgdGV4dCB3ZSdyZSByZXBseWluZyB0b1xuICAgICAgICBjb25zdCBuZXN0ZWRSZXBseSA9IGdldE5lc3RlZFJlcGx5VGV4dChyZXBseVRvRXZlbnQsIG9wdHMucGVybWFsaW5rQ3JlYXRvcik7XG4gICAgICAgIGlmIChuZXN0ZWRSZXBseSkge1xuICAgICAgICAgICAgaWYgKGNvbnRlbnQuZm9ybWF0dGVkX2JvZHkpIHtcbiAgICAgICAgICAgICAgICBjb250ZW50LmZvcm1hdHRlZF9ib2R5ID0gbmVzdGVkUmVwbHkuaHRtbCArIGNvbnRlbnQuZm9ybWF0dGVkX2JvZHk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb250ZW50LmJvZHkgPSBuZXN0ZWRSZXBseS5ib2R5ICsgY29udGVudC5ib2R5O1xuICAgICAgICB9XG4gICAgfVxufVxuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQWtCQSxJQUFBQSxhQUFBLEdBQUFDLHNCQUFBLENBQUFDLE9BQUE7QUFDQSxJQUFBQyxXQUFBLEdBQUFGLHNCQUFBLENBQUFDLE9BQUE7QUFDQSxJQUFBRSxPQUFBLEdBQUFGLE9BQUE7QUFDQSxJQUFBRyxNQUFBLEdBQUFILE9BQUE7QUFDQSxJQUFBSSxPQUFBLEdBQUFKLE9BQUE7QUFDQSxJQUFBSyxNQUFBLEdBQUFMLE9BQUE7QUFHQSxJQUFBTSxVQUFBLEdBQUFOLE9BQUE7QUFDQSxJQUFBTyxXQUFBLEdBQUFQLE9BQUE7QUFDQSxJQUFBUSxTQUFBLEdBQUFSLE9BQUE7QUFBNEMsU0FBQVMsUUFBQUMsTUFBQSxFQUFBQyxjQUFBLFFBQUFDLElBQUEsR0FBQUMsTUFBQSxDQUFBRCxJQUFBLENBQUFGLE1BQUEsT0FBQUcsTUFBQSxDQUFBQyxxQkFBQSxRQUFBQyxPQUFBLEdBQUFGLE1BQUEsQ0FBQUMscUJBQUEsQ0FBQUosTUFBQSxHQUFBQyxjQUFBLEtBQUFJLE9BQUEsR0FBQUEsT0FBQSxDQUFBQyxNQUFBLFdBQUFDLEdBQUEsV0FBQUosTUFBQSxDQUFBSyx3QkFBQSxDQUFBUixNQUFBLEVBQUFPLEdBQUEsRUFBQUUsVUFBQSxPQUFBUCxJQUFBLENBQUFRLElBQUEsQ0FBQUMsS0FBQSxDQUFBVCxJQUFBLEVBQUFH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