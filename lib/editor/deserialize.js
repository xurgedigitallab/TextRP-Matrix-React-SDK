"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.longestBacktickSequence = longestBacktickSequence;
exports.parseEvent = parseEvent;
exports.parsePlainTextMessage = parsePlainTextMessage;
var _event = require("matrix-js-sdk/src/@types/event");
var _HtmlUtils = require("../HtmlUtils");
var _Permalinks = require("../utils/permalinks/Permalinks");
var _parts = require("./parts");
var _SdkConfig = _interopRequireDefault(require("../SdkConfig"));
var _colour = require("../utils/colour");
var _Reply = require("../utils/Reply");
/*
Copyright 2019 New Vector Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

const LIST_TYPES = ["UL", "OL", "LI"];

// Escapes all markup in the given text
function escape(text) {
  return text.replace(/[\\*_[\]`<]|^>/g, match => `\\${match}`);
}

// Finds the length of the longest backtick sequence in the given text, used for
// escaping backticks in code blocks
function longestBacktickSequence(text) {
  let length = 0;
  let currentLength = 0;
  for (const c of text) {
    if (c === "`") {
      currentLength++;
    } else {
      length = Math.max(length, currentLength);
      currentLength = 0;
    }
  }
  return Math.max(length, currentLength);
}
function isListChild(n) {
  return LIST_TYPES.includes(n.parentNode?.nodeName || "");
}
function parseAtRoomMentions(text, pc, opts) {
  const ATROOM = "@room";
  const parts = [];
  text.split(ATROOM).forEach((textPart, i, arr) => {
    if (textPart.length) {
      parts.push(...pc.plainWithEmoji(opts.shouldEscape ? escape(textPart) : textPart));
    }
    // it's safe to never append @room after the last textPart
    // as split will report an empty string at the end if
    // `text` ended in @room.
    const isLast = i === arr.length - 1;
    if (!isLast) {
      parts.push(pc.atRoomPill(ATROOM));
    }
  });
  return parts;
}
function parseLink(n, pc, opts) {
  const {
    href
  } = n;
  const resourceId = (0, _Permalinks.getPrimaryPermalinkEntity)(href); // The room/user ID

  switch (resourceId?.[0]) {
    case "@":
      return [pc.userPill(n.textContent || "", resourceId)];
    case "#":
      return [pc.roomPill(resourceId)];
  }
  const children = Array.from(n.childNodes);
  if (href === n.textContent && children.every(c => c.nodeType === Node.TEXT_NODE)) {
    return parseAtRoomMentions(n.textContent, pc, opts);
  } else {
    return [pc.plain("["), ...parseChildren(n, pc, opts), pc.plain(`](${href})`)];
  }
}
function parseImage(n, pc, opts) {
  const {
    alt,
    src
  } = n;
  return pc.plainWithEmoji(`![${escape(alt)}](${src})`);
}
function parseCodeBlock(n, pc, opts) {
  if (!n.textContent) return [];
  let language = "";
  if (n.firstChild?.nodeName === "CODE") {
    for (const className of n.firstChild.classList) {
      if (className.startsWith("language-") && !className.startsWith("language-_")) {
        language = className.slice("language-".length);
        break;
      }
    }
  }
  const text = n.textContent.replace(/\n$/, "");
  // Escape backticks by using even more backticks for the fence if necessary
  const fence = "`".repeat(Math.max(3, longestBacktickSequence(text) + 1));
  const parts = [...pc.plainWithEmoji(fence + language), pc.newline()];
  text.split("\n").forEach(line => {
    parts.push(...pc.plainWithEmoji(line));
    parts.push(pc.newline());
  });
  parts.push(pc.plain(fence));
  return parts;
}
function parseHeader(n, pc, opts) {
  const depth = parseInt(n.nodeName.slice(1), 10);
  const prefix = pc.plain("#".repeat(depth) + " ");
  return [prefix, ...parseChildren(n, pc, opts)];
}
function checkIgnored(n) {
  if (n.nodeType === Node.TEXT_NODE) {
    // Element adds \n text nodes in a lot of places,
    // which should be ignored
    return n.nodeValue === "\n";
  } else if (n.nodeType === Node.ELEMENT_NODE) {
    return n.nodeName === "MX-REPLY";
  }
  return true;
}
function prefixLines(parts, prefix, pc) {
  parts.unshift(pc.plain(prefix));
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].type === _parts.Type.Newline) {
      parts.splice(i + 1, 0, pc.plain(prefix));
      i += 1;
    }
  }
}
function parseChildren(n, pc, opts, mkListItem) {
  let prev;
  return Array.from(n.childNodes).flatMap(c => {
    const parsed = parseNode(c, pc, opts, mkListItem);
    if (parsed.length && prev && ((0, _HtmlUtils.checkBlockNode)(prev) || (0, _HtmlUtils.checkBlockNode)(c))) {
      if (isListChild(c)) {
        // Use tighter spacing within lists
        parsed.unshift(pc.newline());
      } else {
        parsed.unshift(pc.newline(), pc.newline());
      }
    }
    if (parsed.length) prev = c;
    return parsed;
  });
}
function parseNode(n, pc, opts, mkListItem) {
  if (checkIgnored(n)) return [];
  switch (n.nodeType) {
    case Node.TEXT_NODE:
      return parseAtRoomMentions(n.nodeValue || "", pc, opts);
    case Node.ELEMENT_NODE:
      switch (n.nodeName) {
        case "H1":
        case "H2":
        case "H3":
        case "H4":
        case "H5":
        case "H6":
          return parseHeader(n, pc, opts);
        case "A":
          return parseLink(n, pc, opts);
        case "IMG":
          return parseImage(n, pc, opts);
        case "BR":
          return [pc.newline()];
        case "HR":
          return [pc.plain("---")];
        case "EM":
          return [pc.plain("_"), ...parseChildren(n, pc, opts), pc.plain("_")];
        case "STRONG":
          return [pc.plain("**"), ...parseChildren(n, pc, opts), pc.plain("**")];
        case "DEL":
          return [pc.plain("<del>"), ...parseChildren(n, pc, opts), pc.plain("</del>")];
        case "SUB":
          return [pc.plain("<sub>"), ...parseChildren(n, pc, opts), pc.plain("</sub>")];
        case "SUP":
          return [pc.plain("<sup>"), ...parseChildren(n, pc, opts), pc.plain("</sup>")];
        case "U":
          return [pc.plain("<u>"), ...parseChildren(n, pc, opts), pc.plain("</u>")];
        case "PRE":
          return parseCodeBlock(n, pc, opts);
        case "CODE":
          {
            // Escape backticks by using multiple backticks for the fence if necessary
            const fence = "`".repeat(longestBacktickSequence(n.textContent || "") + 1);
            return pc.plainWithEmoji(`${fence}${n.textContent}${fence}`);
          }
        case "BLOCKQUOTE":
          {
            const parts = parseChildren(n, pc, opts);
            prefixLines(parts, "> ", pc);
            return parts;
          }
        case "LI":
          return mkListItem?.(n) ?? parseChildren(n, pc, opts);
        case "UL":
          {
            const parts = parseChildren(n, pc, opts, li => [pc.plain("- "), ...parseChildren(li, pc, opts)]);
            if (isListChild(n)) {
              prefixLines(parts, "    ", pc);
            }
            return parts;
          }
        case "OL":
          {
            let counter = n.start ?? 1;
            const parts = parseChildren(n, pc, opts, li => {
              const parts = [pc.plain(`${counter}. `), ...parseChildren(li, pc, opts)];
              counter++;
              return parts;
            });
            if (isListChild(n)) {
              prefixLines(parts, "    ", pc);
            }
            return parts;
          }
        case "DIV":
        case "SPAN":
          // Math nodes are translated back into delimited latex strings
          if (n.hasAttribute("data-mx-maths")) {
            const delims = _SdkConfig.default.get().latex_maths_delims;
            const delimLeft = n.nodeName === "SPAN" ? delims?.inline?.left ?? "\\(" : delims?.display?.left ?? "\\[";
            const delimRight = n.nodeName === "SPAN" ? delims?.inline?.right ?? "\\)" : delims?.display?.right ?? "\\]";
            const tex = n.getAttribute("data-mx-maths");
            return pc.plainWithEmoji(`${delimLeft}${tex}${delimRight}`);
          }
      }
  }
  return parseChildren(n, pc, opts);
}
function parseHtmlMessage(html, pc, opts) {
  // no nodes from parsing here should be inserted in the document,
  // as scripts in event handlers, etc would be executed then.
  // we're only taking text, so that is fine
  const parts = parseNode(new DOMParser().parseFromString(html, "text/html").body, pc, opts);
  if (opts.isQuotedMessage) {
    prefixLines(parts, "> ", pc);
  }
  return parts;
}
function parsePlainTextMessage(body, pc, opts) {
  const lines = body.split(/\r\n|\r|\n/g); // split on any new-line combination not just \n, collapses \r\n
  return lines.reduce((parts, line, i) => {
    if (opts.isQuotedMessage) {
      parts.push(pc.plain("> "));
    }
    parts.push(...parseAtRoomMentions(line, pc, opts));
    const isLast = i === lines.length - 1;
    if (!isLast) {
      parts.push(pc.newline());
    }
    return parts;
  }, []);
}
function parseEvent(event, pc) {
  let opts = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {
    shouldEscape: true
  };
  const content = event.getContent();
  let parts;
  const isEmote = content.msgtype === _event.MsgType.Emote;
  let isRainbow = false;
  if (content.format === "org.matrix.custom.html") {
    parts = parseHtmlMessage(content.formatted_body || "", pc, opts);
    if (content.body && content.formatted_body && (0, _colour.textToHtmlRainbow)(content.body) === content.formatted_body) {
      isRainbow = true;
    }
  } else {
    let body = content.body || "";
    if (event.replyEventId) {
      body = (0, _Reply.stripPlainReply)(body);
    }
    parts = parsePlainTextMessage(body, pc, opts);
  }
  if (isEmote && isRainbow) {
    parts.unshift(pc.plain("/rainbowme "));
  } else if (isRainbow) {
    parts.unshift(pc.plain("/rainbow "));
  } else if (isEmote) {
    parts.unshift(pc.plain("/me "));
  }
  return parts;
}
//# sourceMappingURL=deserialize.js.map