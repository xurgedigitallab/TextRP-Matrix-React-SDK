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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfaHRtbEVudGl0aWVzIiwicmVxdWlyZSIsIl9lc2NhcGVIdG1sIiwiX2ludGVyb3BSZXF1aXJlRGVmYXVsdCIsIl9NYXJrZG93biIsIl9QZXJtYWxpbmtzIiwiX1NldHRpbmdzU3RvcmUiLCJfU2RrQ29uZmlnIiwiX3BhcnRzIiwibWRTZXJpYWxpemUiLCJtb2RlbCIsInBhcnRzIiwicmVkdWNlIiwiaHRtbCIsInBhcnQiLCJ0eXBlIiwiVHlwZSIsIk5ld2xpbmUiLCJQbGFpbiIsIkVtb2ppIiwiQ29tbWFuZCIsIlBpbGxDYW5kaWRhdGUiLCJBdFJvb21QaWxsIiwidGV4dCIsIlJvb21QaWxsIiwicmVzb3VyY2VJZCIsInJlcGxhY2UiLCJjIiwibWFrZUdlbmVyaWNQZXJtYWxpbmsiLCJVc2VyUGlsbCIsImh0bWxTZXJpYWxpemVJZk5lZWRlZCIsImZvcmNlSFRNTCIsInVzZU1hcmtkb3duIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwidW5kZWZpbmVkIiwiZXNjYXBlSHRtbCIsInRleHRTZXJpYWxpemUiLCJtZCIsImh0bWxTZXJpYWxpemVGcm9tTWRJZk5lZWRlZCIsIm9yaWciLCJTZXR0aW5nc1N0b3JlIiwiZ2V0VmFsdWUiLCJwYXR0ZXJuTmFtZXMiLCJwYXR0ZXJuVHlwZXMiLCJwYXR0ZXJuRGVmYXVsdHMiLCJ0ZXgiLCJkaXNwbGF5IiwiaW5saW5lIiwibGF0ZXgiLCJmb3JFYWNoIiwicGF0dGVybk5hbWUiLCJwYXR0ZXJuVHlwZSIsInBhdHRlcm4iLCJTZGtDb25maWciLCJnZXQiLCJSZWdFeHAiLCJtIiwicDEiLCJwMiIsInAyZSIsImVuY29kZSIsInBhcnNlciIsIk1hcmtkb3duIiwiaXNQbGFpblRleHQiLCJwaHRtbCIsIkRPTVBhcnNlciIsInBhcnNlRnJvbVN0cmluZyIsInRvSFRNTCIsInBhcnNlck9yaWciLCJwaHRtbE9yaWciLCJnZXRFbGVtZW50c0J5VGFnTmFtZSIsImUiLCJpIiwiaXRlbSIsInRleHRDb250ZW50IiwicXVlcnlTZWxlY3RvckFsbCIsImdldEF0dHJpYnV0ZSIsImlubmVySFRNTCIsImJvZHkiLCJpbmRleE9mIiwidG9QbGFpbnRleHQiLCJjb250YWluc0Vtb3RlIiwiaGFzQ29tbWFuZCIsInN0YXJ0c1dpdGgiLCJoYXNBcmd1bWVudCIsInByZWZpeCIsImNhc2VTZW5zaXRpdmUiLCJmaXJzdFBhcnQiLCJ0b0xvd2VyQ2FzZSIsInN0cmlwRW1vdGVDb21tYW5kIiwic3RyaXBQcmVmaXgiLCJjbG9uZSIsInJlbW92ZVRleHQiLCJpbmRleCIsIm9mZnNldCIsInVuZXNjYXBlTWVzc2FnZSJdLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9lZGl0b3Ivc2VyaWFsaXplLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qXG5Db3B5cmlnaHQgMjAxOSBOZXcgVmVjdG9yIEx0ZFxuQ29weXJpZ2h0IDIwMTksIDIwMjAgVGhlIE1hdHJpeC5vcmcgRm91bmRhdGlvbiBDLkkuQy5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4qL1xuXG5pbXBvcnQgeyBlbmNvZGUgfSBmcm9tIFwiaHRtbC1lbnRpdGllc1wiO1xuaW1wb3J0IGVzY2FwZUh0bWwgZnJvbSBcImVzY2FwZS1odG1sXCI7XG5cbmltcG9ydCBNYXJrZG93biBmcm9tIFwiLi4vTWFya2Rvd25cIjtcbmltcG9ydCB7IG1ha2VHZW5lcmljUGVybWFsaW5rIH0gZnJvbSBcIi4uL3V0aWxzL3Blcm1hbGlua3MvUGVybWFsaW5rc1wiO1xuaW1wb3J0IEVkaXRvck1vZGVsIGZyb20gXCIuL21vZGVsXCI7XG5pbXBvcnQgU2V0dGluZ3NTdG9yZSBmcm9tIFwiLi4vc2V0dGluZ3MvU2V0dGluZ3NTdG9yZVwiO1xuaW1wb3J0IFNka0NvbmZpZyBmcm9tIFwiLi4vU2RrQ29uZmlnXCI7XG5pbXBvcnQgeyBUeXBlIH0gZnJvbSBcIi4vcGFydHNcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIG1kU2VyaWFsaXplKG1vZGVsOiBFZGl0b3JNb2RlbCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIG1vZGVsLnBhcnRzLnJlZHVjZSgoaHRtbCwgcGFydCkgPT4ge1xuICAgICAgICBzd2l0Y2ggKHBhcnQudHlwZSkge1xuICAgICAgICAgICAgY2FzZSBUeXBlLk5ld2xpbmU6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGh0bWwgKyBcIlxcblwiO1xuICAgICAgICAgICAgY2FzZSBUeXBlLlBsYWluOlxuICAgICAgICAgICAgY2FzZSBUeXBlLkVtb2ppOlxuICAgICAgICAgICAgY2FzZSBUeXBlLkNvbW1hbmQ6XG4gICAgICAgICAgICBjYXNlIFR5cGUuUGlsbENhbmRpZGF0ZTpcbiAgICAgICAgICAgIGNhc2UgVHlwZS5BdFJvb21QaWxsOlxuICAgICAgICAgICAgICAgIHJldHVybiBodG1sICsgcGFydC50ZXh0O1xuICAgICAgICAgICAgY2FzZSBUeXBlLlJvb21QaWxsOlxuICAgICAgICAgICAgICAgIC8vIEhlcmUgd2UgdXNlIHRoZSByZXNvdXJjZUlkIGZvciBjb21wYXRpYmlsaXR5IHdpdGggbm9uLXJpY2ggdGV4dCBjbGllbnRzXG4gICAgICAgICAgICAgICAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS92ZWN0b3ItaW0vZWxlbWVudC13ZWIvaXNzdWVzLzE2NjYwXG4gICAgICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgICAgICAgaHRtbCArXG4gICAgICAgICAgICAgICAgICAgIGBbJHtwYXJ0LnJlc291cmNlSWQucmVwbGFjZSgvW1tcXFxcXFxdXS9nLCAoYykgPT4gXCJcXFxcXCIgKyBjKX1dKCR7bWFrZUdlbmVyaWNQZXJtYWxpbmsoXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJ0LnJlc291cmNlSWQsXG4gICAgICAgICAgICAgICAgICAgICl9KWBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgY2FzZSBUeXBlLlVzZXJQaWxsOlxuICAgICAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgICAgICAgIGh0bWwgK1xuICAgICAgICAgICAgICAgICAgICBgWyR7cGFydC50ZXh0LnJlcGxhY2UoL1tbXFxcXFxcXV0vZywgKGMpID0+IFwiXFxcXFwiICsgYyl9XSgke21ha2VHZW5lcmljUGVybWFsaW5rKHBhcnQucmVzb3VyY2VJZCl9KWBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgfSwgXCJcIik7XG59XG5cbmludGVyZmFjZSBJU2VyaWFsaXplT3B0cyB7XG4gICAgZm9yY2VIVE1MPzogYm9vbGVhbjtcbiAgICB1c2VNYXJrZG93bj86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBodG1sU2VyaWFsaXplSWZOZWVkZWQoXG4gICAgbW9kZWw6IEVkaXRvck1vZGVsLFxuICAgIHsgZm9yY2VIVE1MID0gZmFsc2UsIHVzZU1hcmtkb3duID0gdHJ1ZSB9OiBJU2VyaWFsaXplT3B0cyA9IHt9LFxuKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgICBpZiAoIXVzZU1hcmtkb3duKSB7XG4gICAgICAgIHJldHVybiBlc2NhcGVIdG1sKHRleHRTZXJpYWxpemUobW9kZWwpKS5yZXBsYWNlKC9cXG4vZywgXCI8YnIvPlwiKTtcbiAgICB9XG5cbiAgICBjb25zdCBtZCA9IG1kU2VyaWFsaXplKG1vZGVsKTtcbiAgICByZXR1cm4gaHRtbFNlcmlhbGl6ZUZyb21NZElmTmVlZGVkKG1kLCB7IGZvcmNlSFRNTCB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGh0bWxTZXJpYWxpemVGcm9tTWRJZk5lZWRlZChtZDogc3RyaW5nLCB7IGZvcmNlSFRNTCA9IGZhbHNlIH0gPSB7fSk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gICAgLy8gY29weSBvZiByYXcgaW5wdXQgdG8gcmVtb3ZlIHVud2FudGVkIG1hdGggbGF0ZXJcbiAgICBjb25zdCBvcmlnID0gbWQ7XG5cbiAgICBpZiAoU2V0dGluZ3NTdG9yZS5nZXRWYWx1ZShcImZlYXR1cmVfbGF0ZXhfbWF0aHNcIikpIHtcbiAgICAgICAgY29uc3QgcGF0dGVybk5hbWVzID0gW1widGV4XCIsIFwibGF0ZXhcIl0gYXMgY29uc3Q7XG4gICAgICAgIGNvbnN0IHBhdHRlcm5UeXBlcyA9IFtcImRpc3BsYXlcIiwgXCJpbmxpbmVcIl0gYXMgY29uc3Q7XG4gICAgICAgIGNvbnN0IHBhdHRlcm5EZWZhdWx0cyA9IHtcbiAgICAgICAgICAgIHRleDoge1xuICAgICAgICAgICAgICAgIC8vIGRldGVjdCBtYXRoIHdpdGggdGV4IGRlbGltaXRlcnMsIGlubGluZTogJC4uLiQsIGRpc3BsYXkgJCQuLi4kJFxuICAgICAgICAgICAgICAgIC8vIHByZWZlcmFibHkgdXNlIG5lZ2F0aXZlIGxvb2tiZWhpbmRzLCBub3Qgc3VwcG9ydGVkIGluIGFsbCBtYWpvciBicm93c2VyczpcbiAgICAgICAgICAgICAgICAvLyBjb25zdCBkaXNwbGF5UGF0dGVybiA9IFwiXig/PCFcXFxcXFxcXClcXFxcJFxcXFwkKD8hWyBcXFxcdF0pKChbXiRdfFxcXFxcXFxcXFxcXCQpKz8pXFxcXCRcXFxcJCRcIjtcbiAgICAgICAgICAgICAgICAvLyBjb25zdCBpbmxpbmVQYXR0ZXJuID0gXCIoPzpefFxcXFxzKSg/PCFcXFxcXFxcXClcXFxcJCg/IVxcXFxzKSgoW14kXXxcXFxcXFxcXFxcXFwkKSs/KSg/PCFcXFxcXFxcXHxcXFxccylcXFxcJFwiO1xuXG4gICAgICAgICAgICAgICAgLy8gY29uZGl0aW9ucyBmb3IgZGlzcGxheSBtYXRoIGRldGVjdGlvbiAkJC4uLiQkOlxuICAgICAgICAgICAgICAgIC8vIC0gcGF0dGVybiBzdGFydHMgYW5kIGVuZHMgb24gYSBuZXcgbGluZVxuICAgICAgICAgICAgICAgIC8vIC0gbGVmdCBkZWxpbWl0ZXIgKCQkKSBpcyBub3QgZXNjYXBlZCBieSBiYWNrc2xhc2hcbiAgICAgICAgICAgICAgICBkaXNwbGF5OiBcIiheKVxcXFwkXFxcXCQoKFteJF18XFxcXFxcXFxcXFxcJCkrPylcXFxcJFxcXFwkJFwiLFxuXG4gICAgICAgICAgICAgICAgLy8gY29uZGl0aW9ucyBmb3IgaW5saW5lIG1hdGggZGV0ZWN0aW9uICQuLi4kOlxuICAgICAgICAgICAgICAgIC8vIC0gcGF0dGVybiBzdGFydHMgYXQgYmVnaW5uaW5nIG9mIGxpbmUsIGZvbGxvd3Mgd2hpdGVzcGFjZSBjaGFyYWN0ZXIgb3IgcHVuY3R1YXRpb25cbiAgICAgICAgICAgICAgICAvLyAtIHBhdHRlcm4gaXMgb24gYSBzaW5nbGUgbGluZVxuICAgICAgICAgICAgICAgIC8vIC0gbGVmdCBhbmQgcmlnaHQgZGVsaW1pdGVycyAoJCkgYXJlIG5vdCBlc2NhcGVkIGJ5IGJhY2tzbGFzaGVzXG4gICAgICAgICAgICAgICAgLy8gLSBsZWZ0IGRlbGltaXRlciBpcyBub3QgZm9sbG93ZWQgYnkgd2hpdGVzcGFjZSBjaGFyYWN0ZXJcbiAgICAgICAgICAgICAgICAvLyAtIHJpZ2h0IGRlbGltaXRlciBpcyBub3QgcHJlZml4ZWQgd2l0aCB3aGl0ZXNwYWNlIGNoYXJhY3RlclxuICAgICAgICAgICAgICAgIGlubGluZTogXCIoXnxcXFxcc3xbLiwhPzo7XSkoPyFcXFxcXFxcXClcXFxcJCg/IVxcXFxzKSgoW14kXFxcXG5dfFxcXFxcXFxcXFxcXCQpKihbXlxcXFxcXFxcXFxcXHNcXFxcJF18XFxcXFxcXFxcXFxcJCkoPzpcXFxcXFxcXFxcXFwkKT8pXFxcXCRcIixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBsYXRleDoge1xuICAgICAgICAgICAgICAgIC8vIGRldGVjdCBtYXRoIHdpdGggbGF0ZXggZGVsaW1pdGVycywgaW5saW5lOiBcXCguLi5cXCksIGRpc3BsYXkgXFxbLi4uXFxdXG5cbiAgICAgICAgICAgICAgICAvLyBjb25kaXRpb25zIGZvciBkaXNwbGF5IG1hdGggZGV0ZWN0aW9uIFxcWy4uLlxcXTpcbiAgICAgICAgICAgICAgICAvLyAtIHBhdHRlcm4gc3RhcnRzIGFuZCBlbmRzIG9uIGEgbmV3IGxpbmVcbiAgICAgICAgICAgICAgICAvLyAtIHBhdHRlcm4gaXMgbm90IGVtcHR5XG4gICAgICAgICAgICAgICAgZGlzcGxheTogXCIoXilcXFxcXFxcXFxcXFxbKD8hXFxcXFxcXFxcXFxcXSkoLio/KVxcXFxcXFxcXFxcXF0kXCIsXG5cbiAgICAgICAgICAgICAgICAvLyBjb25kaXRpb25zIGZvciBpbmxpbmUgbWF0aCBkZXRlY3Rpb24gXFwoLi4uXFwpOlxuICAgICAgICAgICAgICAgIC8vIC0gcGF0dGVybiBzdGFydHMgYXQgYmVnaW5uaW5nIG9mIGxpbmUgb3IgaXMgbm90IHByZWZpeGVkIHdpdGggYmFja3NsYXNoXG4gICAgICAgICAgICAgICAgLy8gLSBwYXR0ZXJuIGlzIG5vdCBlbXB0eVxuICAgICAgICAgICAgICAgIGlubGluZTogXCIoXnxbXlxcXFxcXFxcXSlcXFxcXFxcXFxcXFwoKD8hXFxcXFxcXFxcXFxcKSkoLio/KVxcXFxcXFxcXFxcXClcIixcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH07XG5cbiAgICAgICAgcGF0dGVybk5hbWVzLmZvckVhY2goZnVuY3Rpb24gKHBhdHRlcm5OYW1lKSB7XG4gICAgICAgICAgICBwYXR0ZXJuVHlwZXMuZm9yRWFjaChmdW5jdGlvbiAocGF0dGVyblR5cGUpIHtcbiAgICAgICAgICAgICAgICAvLyBnZXQgdGhlIHJlZ2V4IHJlcGxhY2UgcGF0dGVybiBmcm9tIGNvbmZpZyBvciB1c2UgdGhlIGRlZmF1bHRcbiAgICAgICAgICAgICAgICBjb25zdCBwYXR0ZXJuID1cbiAgICAgICAgICAgICAgICAgICAgU2RrQ29uZmlnLmdldChcImxhdGV4X21hdGhzX2RlbGltc1wiKT8uW3BhdHRlcm5UeXBlXT8uW1wicGF0dGVyblwiXT8uW3BhdHRlcm5OYW1lXSB8fFxuICAgICAgICAgICAgICAgICAgICBwYXR0ZXJuRGVmYXVsdHNbcGF0dGVybk5hbWVdW3BhdHRlcm5UeXBlXTtcblxuICAgICAgICAgICAgICAgIG1kID0gbWQucmVwbGFjZShSZWdFeHAocGF0dGVybiwgXCJnbXNcIiksIGZ1bmN0aW9uIChtLCBwMSwgcDIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcDJlID0gZW5jb2RlKHAyKTtcbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoIChwYXR0ZXJuVHlwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBcImRpc3BsYXlcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYCR7cDF9PGRpdiBkYXRhLW14LW1hdGhzPVwiJHtwMmV9XCI+XFxuXFxuPC9kaXY+XFxuXFxuYDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgXCJpbmxpbmVcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYCR7cDF9PHNwYW4gZGF0YS1teC1tYXRocz1cIiR7cDJlfVwiPjwvc3Bhbj5gO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gbWFrZSBzdXJlIGRpdiB0YWdzIGFsd2F5cyBzdGFydCBvbiBhIG5ldyBsaW5lLCBvdGhlcndpc2UgaXQgd2lsbCBjb25mdXNlIHRoZSBtYXJrZG93biBwYXJzZXJcbiAgICAgICAgbWQgPSBtZC5yZXBsYWNlKC8oLik8ZGl2L2csIGZ1bmN0aW9uIChtLCBwMSkge1xuICAgICAgICAgICAgcmV0dXJuIGAke3AxfVxcbjxkaXZgO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBwYXJzZXIgPSBuZXcgTWFya2Rvd24obWQpO1xuICAgIGlmICghcGFyc2VyLmlzUGxhaW5UZXh0KCkgfHwgZm9yY2VIVE1MKSB7XG4gICAgICAgIC8vIGZlZWQgTWFya2Rvd24gb3V0cHV0IHRvIEhUTUwgcGFyc2VyXG4gICAgICAgIGNvbnN0IHBodG1sID0gbmV3IERPTVBhcnNlcigpLnBhcnNlRnJvbVN0cmluZyhwYXJzZXIudG9IVE1MKCksIFwidGV4dC9odG1sXCIpO1xuXG4gICAgICAgIGlmIChTZXR0aW5nc1N0b3JlLmdldFZhbHVlKFwiZmVhdHVyZV9sYXRleF9tYXRoc1wiKSkge1xuICAgICAgICAgICAgLy8gb3JpZ2luYWwgTWFya2Rvd24gd2l0aG91dCBMYVRlWCByZXBsYWNlbWVudHNcbiAgICAgICAgICAgIGNvbnN0IHBhcnNlck9yaWcgPSBuZXcgTWFya2Rvd24ob3JpZyk7XG4gICAgICAgICAgICBjb25zdCBwaHRtbE9yaWcgPSBuZXcgRE9NUGFyc2VyKCkucGFyc2VGcm9tU3RyaW5nKHBhcnNlck9yaWcudG9IVE1MKCksIFwidGV4dC9odG1sXCIpO1xuXG4gICAgICAgICAgICAvLyBzaW5jZSBtYXRocyBkZWxpbWl0ZXJzIGFyZSBoYW5kbGVkIGJlZm9yZSBNYXJrZG93bixcbiAgICAgICAgICAgIC8vIGNvZGUgYmxvY2tzIGNvdWxkIGNvbnRhaW4gbWFuZ2xlZCBjb250ZW50LlxuICAgICAgICAgICAgLy8gcmVwbGFjZSBjb2RlIGJsb2NrcyB3aXRoIG9yaWdpbmFsIGNvbnRlbnRcbiAgICAgICAgICAgIFsuLi5waHRtbE9yaWcuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJjb2RlXCIpXS5mb3JFYWNoKChlLCBpKSA9PiB7XG4gICAgICAgICAgICAgICAgcGh0bWwuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJjb2RlXCIpLml0ZW0oaSkhLnRleHRDb250ZW50ID0gZS50ZXh0Q29udGVudDtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBhZGQgZmFsbGJhY2sgb3V0cHV0IGZvciBsYXRleCBtYXRoLCB3aGljaCBzaG91bGQgbm90IGJlIGludGVycHJldGVkIGFzIG1hcmtkb3duXG4gICAgICAgICAgICBbLi4ucGh0bWwucXVlcnlTZWxlY3RvckFsbChcImRpdiwgc3BhblwiKV0uZm9yRWFjaCgoZSwgaSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRleCA9IGUuZ2V0QXR0cmlidXRlKFwiZGF0YS1teC1tYXRoc1wiKTtcbiAgICAgICAgICAgICAgICBpZiAodGV4KSB7XG4gICAgICAgICAgICAgICAgICAgIGUuaW5uZXJIVE1MID0gYDxjb2RlPiR7dGV4fTwvY29kZT5gO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwaHRtbC5ib2R5LmlubmVySFRNTDtcbiAgICB9XG4gICAgLy8gZW5zdXJlIHJlbW92YWwgb2YgZXNjYXBlIGJhY2tzbGFzaGVzIGluIG5vbi1NYXJrZG93biBtZXNzYWdlc1xuICAgIGlmIChtZC5pbmRleE9mKFwiXFxcXFwiKSA+IC0xKSB7XG4gICAgICAgIHJldHVybiBwYXJzZXIudG9QbGFpbnRleHQoKTtcbiAgICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0ZXh0U2VyaWFsaXplKG1vZGVsOiBFZGl0b3JNb2RlbCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIG1vZGVsLnBhcnRzLnJlZHVjZSgodGV4dCwgcGFydCkgPT4ge1xuICAgICAgICBzd2l0Y2ggKHBhcnQudHlwZSkge1xuICAgICAgICAgICAgY2FzZSBUeXBlLk5ld2xpbmU6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRleHQgKyBcIlxcblwiO1xuICAgICAgICAgICAgY2FzZSBUeXBlLlBsYWluOlxuICAgICAgICAgICAgY2FzZSBUeXBlLkVtb2ppOlxuICAgICAgICAgICAgY2FzZSBUeXBlLkNvbW1hbmQ6XG4gICAgICAgICAgICBjYXNlIFR5cGUuUGlsbENhbmRpZGF0ZTpcbiAgICAgICAgICAgIGNhc2UgVHlwZS5BdFJvb21QaWxsOlxuICAgICAgICAgICAgICAgIHJldHVybiB0ZXh0ICsgcGFydC50ZXh0O1xuICAgICAgICAgICAgY2FzZSBUeXBlLlJvb21QaWxsOlxuICAgICAgICAgICAgICAgIC8vIEhlcmUgd2UgdXNlIHRoZSByZXNvdXJjZUlkIGZvciBjb21wYXRpYmlsaXR5IHdpdGggbm9uLXJpY2ggdGV4dCBjbGllbnRzXG4gICAgICAgICAgICAgICAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS92ZWN0b3ItaW0vZWxlbWVudC13ZWIvaXNzdWVzLzE2NjYwXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRleHQgKyBgJHtwYXJ0LnJlc291cmNlSWR9YDtcbiAgICAgICAgICAgIGNhc2UgVHlwZS5Vc2VyUGlsbDpcbiAgICAgICAgICAgICAgICByZXR1cm4gdGV4dCArIGAke3BhcnQudGV4dH1gO1xuICAgICAgICB9XG4gICAgfSwgXCJcIik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb250YWluc0Vtb3RlKG1vZGVsOiBFZGl0b3JNb2RlbCk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGhhc0NvbW1hbmQgPSBzdGFydHNXaXRoKG1vZGVsLCBcIi9tZSBcIiwgZmFsc2UpO1xuICAgIGNvbnN0IGhhc0FyZ3VtZW50ID0gbW9kZWwucGFydHNbMF0/LnRleHQ/Lmxlbmd0aCA+IDQgfHwgbW9kZWwucGFydHMubGVuZ3RoID4gMTtcbiAgICByZXR1cm4gaGFzQ29tbWFuZCAmJiBoYXNBcmd1bWVudDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0YXJ0c1dpdGgobW9kZWw6IEVkaXRvck1vZGVsLCBwcmVmaXg6IHN0cmluZywgY2FzZVNlbnNpdGl2ZSA9IHRydWUpOiBib29sZWFuIHtcbiAgICBjb25zdCBmaXJzdFBhcnQgPSBtb2RlbC5wYXJ0c1swXTtcbiAgICAvLyBwYXJ0IHR5cGUgd2lsbCBiZSBcInBsYWluXCIgd2hpbGUgZWRpdGluZyxcbiAgICAvLyBhbmQgXCJjb21tYW5kXCIgd2hpbGUgY29tcG9zaW5nIGEgbWVzc2FnZS5cbiAgICBsZXQgdGV4dCA9IGZpcnN0UGFydD8udGV4dCB8fCBcIlwiO1xuICAgIGlmICghY2FzZVNlbnNpdGl2ZSkge1xuICAgICAgICBwcmVmaXggPSBwcmVmaXgudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgdGV4dCA9IHRleHQudG9Mb3dlckNhc2UoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmlyc3RQYXJ0ICYmIChmaXJzdFBhcnQudHlwZSA9PT0gVHlwZS5QbGFpbiB8fCBmaXJzdFBhcnQudHlwZSA9PT0gVHlwZS5Db21tYW5kKSAmJiB0ZXh0LnN0YXJ0c1dpdGgocHJlZml4KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0cmlwRW1vdGVDb21tYW5kKG1vZGVsOiBFZGl0b3JNb2RlbCk6IEVkaXRvck1vZGVsIHtcbiAgICAvLyB0cmltIFwiL21lIFwiXG4gICAgcmV0dXJuIHN0cmlwUHJlZml4KG1vZGVsLCBcIi9tZSBcIik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHJpcFByZWZpeChtb2RlbDogRWRpdG9yTW9kZWwsIHByZWZpeDogc3RyaW5nKTogRWRpdG9yTW9kZWwge1xuICAgIG1vZGVsID0gbW9kZWwuY2xvbmUoKTtcbiAgICBtb2RlbC5yZW1vdmVUZXh0KHsgaW5kZXg6IDAsIG9mZnNldDogMCB9LCBwcmVmaXgubGVuZ3RoKTtcbiAgICByZXR1cm4gbW9kZWw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1bmVzY2FwZU1lc3NhZ2UobW9kZWw6IEVkaXRvck1vZGVsKTogRWRpdG9yTW9kZWwge1xuICAgIGNvbnN0IHsgcGFydHMgfSA9IG1vZGVsO1xuICAgIGlmIChwYXJ0cy5sZW5ndGgpIHtcbiAgICAgICAgY29uc3QgZmlyc3RQYXJ0ID0gcGFydHNbMF07XG4gICAgICAgIC8vIG9ubHkgdW5lc2NhcGUgXFwvIHRvIC8gYXQgc3RhcnQgb2YgZWRpdG9yXG4gICAgICAgIGlmIChmaXJzdFBhcnQudHlwZSA9PT0gVHlwZS5QbGFpbiAmJiBmaXJzdFBhcnQudGV4dC5zdGFydHNXaXRoKFwiXFxcXC9cIikpIHtcbiAgICAgICAgICAgIG1vZGVsID0gbW9kZWwuY2xvbmUoKTtcbiAgICAgICAgICAgIG1vZGVsLnJlbW92ZVRleHQoeyBpbmRleDogMCwgb2Zmc2V0OiAwIH0sIDEpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBtb2RlbDtcbn1cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7O0FBaUJBLElBQUFBLGFBQUEsR0FBQUMsT0FBQTtBQUNBLElBQUFDLFdBQUEsR0FBQUMsc0JBQUEsQ0FBQUYsT0FBQTtBQUVBLElBQUFHLFNBQUEsR0FBQUQsc0JBQUEsQ0FBQUYsT0FBQTtBQUNBLElBQUFJLFdBQUEsR0FBQUosT0FBQTtBQUVBLElBQUFLLGNBQUEsR0FBQUgsc0JBQUEsQ0FBQUYsT0FBQTtBQUNBLElBQUFNLFVBQUEsR0FBQUosc0JBQUEsQ0FBQUYsT0FBQTtBQUNBLElBQUFPLE1BQUEsR0FBQVAsT0FBQTtBQXpCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFZTyxTQUFTUSxXQUFXQSxDQUFDQyxLQUFrQixFQUFVO0VBQ3BELE9BQU9BLEtBQUssQ0FBQ0MsS0FBSyxDQUFDQyxNQUFNLENBQUMsQ0FBQ0MsSUFBSSxFQUFFQyxJQUFJLEtBQUs7SUFDdEMsUUFBUUEsSUFBSSxDQUFDQyxJQUFJO01BQ2IsS0FBS0Ms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