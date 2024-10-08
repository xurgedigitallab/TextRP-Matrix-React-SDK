"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.containsEmote = containsEmote;
exports.htmlSerializeFromMdIfNeeded = htmlSerializeFromMdIfNeeded;
exports.htmlSerializeIfNeeded = htmlSerializeIfNeeded;
exports.mdSerialize = mdSerialize;
exports.startsWith = startsWith;
exports.stripEmoteCommand = stripEmoteCommand;
exports.stripPrefix = stripPrefix;
exports.textSerialize = textSerialize;
exports.unescapeMessage = unescapeMessage;
var _htmlEntities = require("html-entities");
var _escapeHtml = _interopRequireDefault(require("escape-html"));
var _Markdown = _interopRequireDefault(require("../Markdown"));
var _Permalinks = require("../utils/permalinks/Permalinks");
var _SettingsStore = _interopRequireDefault(require("../settings/SettingsStore"));
var _SdkConfig = _interopRequireDefault(require("../SdkConfig"));
var _parts = require("./parts");
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

function mdSerialize(model) {
  return model.parts.reduce((html, part) => {
    switch (part.type) {
      case _parts.Type.Newline:
        return html + "\n";
      case _parts.Type.Plain:
      case _parts.Type.Emoji:
      case _parts.Type.Command:
      case _parts.Type.PillCandidate:
      case _parts.Type.AtRoomPill:
        return html + part.text;
      case _parts.Type.RoomPill:
        // Here we use the resourceId for compatibility with non-rich text clients
        // See https://github.com/vector-im/element-web/issues/16660
        return html + `[${part.resourceId.replace(/[[\\\]]/g, c => "\\" + c)}](${(0, _Permalinks.makeGenericPermalink)(part.resourceId)})`;
      case _parts.Type.UserPill:
        return html + `[${part.text.replace(/[[\\\]]/g, c => "\\" + c)}](${(0, _Permalinks.makeGenericPermalink)(part.resourceId)})`;
    }
  }, "");
}
function htmlSerializeIfNeeded(model) {
  let {
    forceHTML = false,
    useMarkdown = true
  } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  if (!useMarkdown) {
    return (0, _escapeHtml.default)(textSerialize(model)).replace(/\n/g, "<br/>");
  }
  const md = mdSerialize(model);
  return htmlSerializeFromMdIfNeeded(md, {
    forceHTML
  });
}
function htmlSerializeFromMdIfNeeded(md) {
  let {
    forceHTML = false
  } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  // copy of raw input to remove unwanted math later
  const orig = md;
  if (_SettingsStore.default.getValue("feature_latex_maths")) {
    const patternNames = ["tex", "latex"];
    const patternTypes = ["display", "inline"];
    const patternDefaults = {
      tex: {
        // detect math with tex delimiters, inline: $...$, display $$...$$
        // preferably use negative lookbehinds, not supported in all major browsers:
        // const displayPattern = "^(?<!\\\\)\\$\\$(?![ \\t])(([^$]|\\\\\\$)+?)\\$\\$$";
        // const inlinePattern = "(?:^|\\s)(?<!\\\\)\\$(?!\\s)(([^$]|\\\\\\$)+?)(?<!\\\\|\\s)\\$";

        // conditions for display math detection $$...$$:
        // - pattern starts and ends on a new line
        // - left delimiter ($$) is not escaped by backslash
        display: "(^)\\$\\$(([^$]|\\\\\\$)+?)\\$\\$$",
        // conditions for inline math detection $...$:
        // - pattern starts at beginning of line, follows whitespace character or punctuation
        // - pattern is on a single line
        // - left and right delimiters ($) are not escaped by backslashes
        // - left delimiter is not followed by whitespace character
        // - right delimiter is not prefixed with whitespace character
        inline: "(^|\\s|[.,!?:;])(?!\\\\)\\$(?!\\s)(([^$\\n]|\\\\\\$)*([^\\\\\\s\\$]|\\\\\\$)(?:\\\\\\$)?)\\$"
      },
      latex: {
        // detect math with latex delimiters, inline: \(...\), display \[...\]

        // conditions for display math detection \[...\]:
        // - pattern starts and ends on a new line
        // - pattern is not empty
        display: "(^)\\\\\\[(?!\\\\\\])(.*?)\\\\\\]$",
        // conditions for inline math detection \(...\):
        // - pattern starts at beginning of line or is not prefixed with backslash
        // - pattern is not empty
        inline: "(^|[^\\\\])\\\\\\((?!\\\\\\))(.*?)\\\\\\)"
      }
    };
    patternNames.forEach(function (patternName) {
      patternTypes.forEach(function (patternType) {
        // get the regex replace pattern from config or use the default
        const pattern = _SdkConfig.default.get("latex_maths_delims")?.[patternType]?.["pattern"]?.[patternName] || patternDefaults[patternName][patternType];
        md = md.replace(RegExp(pattern, "gms"), function (m, p1, p2) {
          const p2e = (0, _htmlEntities.encode)(p2);
          switch (patternType) {
            case "display":
              return `${p1}<div data-mx-maths="${p2e}">\n\n</div>\n\n`;
            case "inline":
              return `${p1}<span data-mx-maths="${p2e}"></span>`;
          }
        });
      });
    });

    // make sure div tags always start on a new line, otherwise it will confuse the markdown parser
    md = md.replace(/(.)<div/g, function (m, p1) {
      return `${p1}\n<div`;
    });
  }
  const parser = new _Markdown.default(md);
  if (!parser.isPlainText() || forceHTML) {
    // feed Markdown output to HTML parser
    const phtml = new DOMParser().parseFromString(parser.toHTML(), "text/html");
    if (_SettingsStore.default.getValue("feature_latex_maths")) {
      // original Markdown without LaTeX replacements
      const parserOrig = new _Markdown.default(orig);
      const phtmlOrig = new DOMParser().parseFromString(parserOrig.toHTML(), "text/html");

      // since maths delimiters are handled before Markdown,
      // code blocks could contain mangled content.
      // replace code blocks with original content
      [...phtmlOrig.getElementsByTagName("code")].forEach((e, i) => {
        phtml.getElementsByTagName("code").item(i).textContent = e.textContent;
      });

      // add fallback output for latex math, which should not be interpreted as markdown
      [...phtml.querySelectorAll("div, span")].forEach((e, i) => {
        const tex = e.getAttribute("data-mx-maths");
        if (tex) {
          e.innerHTML = `<code>${tex}</code>`;
        }
      });
    }
    return phtml.body.innerHTML;
  }
  // ensure removal of escape backslashes in non-Markdown messages
  if (md.indexOf("\\") > -1) {
    return parser.toPlaintext();
  }
}
function textSerialize(model) {
  return model.parts.reduce((text, part) => {
    switch (part.type) {
      case _parts.Type.Newline:
        return text + "\n";
      case _parts.Type.Plain:
      case _parts.Type.Emoji:
      case _parts.Type.Command:
      case _parts.Type.PillCandidate:
      case _parts.Type.AtRoomPill:
        return text + part.text;
      case _parts.Type.RoomPill:
        // Here we use the resourceId for compatibility with non-rich text clients
        // See https://github.com/vector-im/element-web/issues/16660
        return text + `${part.resourceId}`;
      case _parts.Type.UserPill:
        return text + `${part.text}`;
    }
  }, "");
}
function containsEmote(model) {
  const hasCommand = startsWith(model, "/me ", false);
  const hasArgument = model.parts[0]?.text?.length > 4 || model.parts.length > 1;
  return hasCommand && hasArgument;
}
function startsWith(model, prefix) {
  let caseSensitive = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
  const firstPart = model.parts[0];
  // part type will be "plain" while editing,
  // and "command" while composing a message.
  let text = firstPart?.text || "";
  if (!caseSensitive) {
    prefix = prefix.toLowerCase();
    text = text.toLowerCase();
  }
  return firstPart && (firstPart.type === _parts.Type.Plain || firstPart.type === _parts.Type.Command) && text.startsWith(prefix);
}
function stripEmoteCommand(model) {
  // trim "/me "
  return stripPrefix(model, "/me ");
}
function stripPrefix(model, prefix) {
  model = model.clone();
  model.removeText({
    index: 0,
    offset: 0
  }, prefix.length);
  return model;
}
function unescapeMessage(model) {
  const {
    parts
  } = model;
  if (parts.length) {
    const firstPart = parts[0];
    // only unescape \/ to / at start of editor
    if (firstPart.type === _parts.Type.Plain && firstPart.text.startsWith("\\/")) {
      model = model.clone();
      model.removeText({
        index: 0,
        offset: 0
      }, 1);
    }
  }
  return model;
}
//# sourceMappingURL=serialize.js.map