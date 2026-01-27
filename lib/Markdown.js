"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
require("./@types/commonmark");
var commonmark = _interopRequireWildcard(require("commonmark"));
var _lodash = require("lodash");
var _logger = require("matrix-js-sdk/src/logger");
var _linkifyMatrix = require("./linkify-matrix");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
/*
Copyright 2016 OpenMarket Ltd
Copyright 2021 The Matrix.org Foundation C.I.C.

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

// import better types than @types/commonmark

const ALLOWED_HTML_TAGS = ["sub", "sup", "del", "u"];

// These types of node are definitely text
const TEXT_NODES = ["text", "softbreak", "linebreak", "paragraph", "document"];
function isAllowedHtmlTag(node) {
  if (!node.literal) {
    return false;
  }
  if (node.literal.match('^<((div|span) data-mx-maths="[^"]*"|/(div|span))>$') != null) {
    return true;
  }

  // Regex won't work for tags with attrs, but we only
  // allow <del> anyway.
  const matches = /^<\/?(.*)>$/.exec(node.literal);
  if (matches && matches.length == 2) {
    const tag = matches[1];
    return ALLOWED_HTML_TAGS.indexOf(tag) > -1;
  }
  return false;
}

/*
 * Returns true if the parse output containing the node
 * comprises multiple block level elements (ie. lines),
 * or false if it is only a single line.
 */
function isMultiLine(node) {
  let par = node;
  while (par.parent) {
    par = par.parent;
  }
  return par.firstChild != par.lastChild;
}
function getTextUntilEndOrLinebreak(node) {
  let currentNode = node;
  let text = "";
  while (currentNode && currentNode.type !== "softbreak" && currentNode.type !== "linebreak") {
    const {
      literal,
      type
    } = currentNode;
    if (type === "text" && literal) {
      let n = 0;
      let char = literal[n];
      while (char !== " " && char !== null && n <= literal.length) {
        if (char === " ") {
          break;
        }
        if (char) {
          text += char;
        }
        n += 1;
        char = literal[n];
      }
      if (char === " ") {
        break;
      }
    }
    currentNode = currentNode.next;
  }
  return text;
}
const formattingChangesByNodeType = {
  emph: "_",
  strong: "__"
};

/**
 * Returns the literal of a node an all child nodes.
 */
const innerNodeLiteral = node => {
  let literal = "";
  const walker = node.walker();
  let step;
  while (step = walker.next()) {
    const currentNode = step.node;
    const currentNodeLiteral = currentNode.literal;
    if (step.entering && currentNode.type === "text" && currentNodeLiteral) {
      literal += currentNodeLiteral;
    }
  }
  return literal;
};

/**
 * Class that wraps commonmark, adding the ability to see whether
 * a given message actually uses any markdown syntax or whether
 * it's plain text.
 */
class Markdown {
  constructor(input) {
    (0, _defineProperty2.default)(this, "input", void 0);
    (0, _defineProperty2.default)(this, "parsed", void 0);
    this.input = input;
    const parser = new commonmark.Parser();
    this.parsed = parser.parse(this.input);
    this.parsed = this.repairLinks(this.parsed);
  }

  /**
   * This method is modifying the parsed AST in such a way that links are always
   * properly linkified instead of sometimes being wrongly emphasised in case
   * if you were to write a link like the example below:
   * https://my_weird-link_domain.domain.com
   * ^ this link would be parsed to something like this:
   * <a href="https://my">https://my</a><b>weird-link</b><a href="https://domain.domain.com">domain.domain.com</a>
   * This method makes it so the link gets properly modified to a version where it is
   * not emphasised until it actually ends.
   * See: https://github.com/vector-im/element-web/issues/4674
   * @param parsed
   */
  repairLinks(parsed) {
    const walker = parsed.walker();
    let event = null;
    let text = "";
    let isInPara = false;
    let previousNode = null;
    let shouldUnlinkFormattingNode = false;
    while (event = walker.next()) {
      const {
        node
      } = event;
      if (node.type === "paragraph") {
        if (event.entering) {
          isInPara = true;
        } else {
          isInPara = false;
        }
      }
      if (isInPara) {
        // Clear saved string when line ends
        if (node.type === "softbreak" || node.type === "linebreak" ||
        // Also start calculating the text from the beginning on any spaces
        node.type === "text" && node.literal === " ") {
          text = "";
          continue;
        }

        // Break up text nodes on spaces, so that we don't shoot past them without resetting
        if (node.type === "text" && node.literal) {
          const [thisPart, ...nextParts] = node.literal.split(/( )/);
          node.literal = thisPart;
          text += thisPart;

          // Add the remaining parts as siblings
          nextParts.reverse().forEach(part => {
            if (part) {
              const nextNode = new commonmark.Node("text");
              nextNode.literal = part;
              node.insertAfter(nextNode);
              // Make the iterator aware of the newly inserted node
              walker.resumeAt(nextNode, true);
            }
          });
        }

        // We should not do this if previous node was not a textnode, as we can't combine it then.
        if ((node.type === "emph" || node.type === "strong") && previousNode?.type === "text") {
          if (event.entering) {
            const foundLinks = _linkifyMatrix.linkify.find(text);
            for (const {
              value
            } of foundLinks) {
              if (node?.firstChild?.literal) {
                /**
                 * NOTE: This technically should unlink the emph node and create LINK nodes instead, adding all the next elements as siblings
                 * but this solution seems to work well and is hopefully slightly easier to understand too
                 */
                const format = formattingChangesByNodeType[node.type];
                const nonEmphasizedText = `${format}${innerNodeLiteral(node)}${format}`;
                const f = getTextUntilEndOrLinebreak(node);
                const newText = value + nonEmphasizedText + f;
                const newLinks = _linkifyMatrix.linkify.find(newText);
                // Should always find only one link here, if it finds more it means that the algorithm is broken
                if (newLinks.length === 1) {
                  const emphasisTextNode = new commonmark.Node("text");
                  emphasisTextNode.literal = nonEmphasizedText;
                  previousNode.insertAfter(emphasisTextNode);
                  node.firstChild.literal = "";
                  event = node.walker().next();
                  if (event) {
                    // Remove `em` opening and closing nodes
                    node.unlink();
                    previousNode.insertAfter(event.node);
                    shouldUnlinkFormattingNode = true;
                  }
                } else {
                  _logger.logger.error("Markdown links escaping found too many links for following text: ", text);
                  _logger.logger.error("Markdown links escaping found too many links for modified text: ", newText);
                }
              }
            }
          } else {
            if (shouldUnlinkFormattingNode) {
              node.unlink();
              shouldUnlinkFormattingNode = false;
            }
          }
        }
      }
      previousNode = node;
    }
    return parsed;
  }
  isPlainText() {
    const walker = this.parsed.walker();
    let ev;
    while (ev = walker.next()) {
      const node = ev.node;
      if (TEXT_NODES.indexOf(node.type) > -1) {
        // definitely text
        continue;
      } else if (node.type == "html_inline" || node.type == "html_block") {
        // if it's an allowed html tag, we need to render it and therefore
        // we will need to use HTML. If it's not allowed, it's not HTML since
        // we'll just be treating it as text.
        if (isAllowedHtmlTag(node)) {
          return false;
        }
      } else {
        return false;
      }
    }
    return true;
  }
  toHTML() {
    let {
      externalLinks = false
    } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    const renderer = new commonmark.HtmlRenderer({
      safe: false,
      // Set soft breaks to hard HTML breaks: commonmark
      // puts softbreaks in for multiple lines in a blockquote,
      // so if these are just newline characters then the
      // block quote ends up all on one line
      // (https://github.com/vector-im/element-web/issues/3154)
      softbreak: "<br />"
    });

    // Trying to strip out the wrapping <p/> causes a lot more complication
    // than it's worth, i think.  For instance, this code will go and strip
    // out any <p/> tag (no matter where it is in the tree) which doesn't
    // contain \n's.
    // On the flip side, <p/>s are quite opionated and restricted on where
    // you can nest them.
    //
    // Let's try sending with <p/>s anyway for now, though.
    const realParagraph = renderer.paragraph;
    renderer.paragraph = function (node, entering) {
      // If there is only one top level node, just return the
      // bare text: it's a single line of text and so should be
      // 'inline', rather than unnecessarily wrapped in its own
      // p tag. If, however, we have multiple nodes, each gets
      // its own p tag to keep them as separate paragraphs.
      // However, if it's a blockquote, adds a p tag anyway
      // in order to avoid deviation to commonmark and unexpected
      // results when parsing the formatted HTML.
      if (node.parent?.type === "block_quote" || isMultiLine(node)) {
        realParagraph.call(this, node, entering);
      }
    };
    renderer.link = function (node, entering) {
      const attrs = this.attrs(node);
      if (entering && node.destination) {
        attrs.push(["href", this.esc(node.destination)]);
        if (node.title) {
          attrs.push(["title", this.esc(node.title)]);
        }
        // Modified link behaviour to treat them all as external and
        // thus opening in a new tab.
        if (externalLinks) {
          attrs.push(["target", "_blank"]);
          attrs.push(["rel", "noreferrer noopener"]);
        }
        this.tag("a", attrs);
      } else {
        this.tag("/a");
      }
    };
    renderer.html_inline = function (node) {
      if (node.literal) {
        if (isAllowedHtmlTag(node)) {
          this.lit(node.literal);
        } else {
          this.lit((0, _lodash.escape)(node.literal));
        }
      }
    };
    renderer.html_block = function (node) {
      /*
      // as with `paragraph`, we only insert line breaks
      // if there are multiple lines in the markdown.
      const isMultiLine = is_multi_line(node);
      if (isMultiLine) this.cr();
      */
      renderer.html_inline(node);
      /*
      if (isMultiLine) this.cr();
      */
    };

    return renderer.render(this.parsed);
  }

  /*
   * Render the markdown message to plain text. That is, essentially
   * just remove any backslashes escaping what would otherwise be
   * markdown syntax
   * (to fix https://github.com/vector-im/element-web/issues/2870).
   *
   * N.B. this does **NOT** render arbitrary MD to plain text - only MD
   * which has no formatting.  Otherwise it emits HTML(!).
   */
  toPlaintext() {
    const renderer = new commonmark.HtmlRenderer({
      safe: false
    });
    renderer.paragraph = function (node, entering) {
      // as with toHTML, only append lines to paragraphs if there are
      // multiple paragraphs
      if (isMultiLine(node)) {
        if (!entering && node.next) {
          this.lit("\n\n");
        }
      }
    };
    renderer.html_block = function (node) {
      if (node.literal) this.lit(node.literal);
      if (isMultiLine(node) && node.next) this.lit("\n\n");
    };
    return renderer.render(this.parsed);
  }
}
exports.default = Markdown;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJyZXF1aXJlIiwiY29tbW9ubWFyayIsIl9pbnRlcm9wUmVxdWlyZVdpbGRjYXJkIiwiX2xvZGFzaCIsIl9sb2dnZXIiLCJfbGlua2lmeU1hdHJpeCIsIl9nZXRSZXF1aXJlV2lsZGNhcmRDYWNoZSIsIm5vZGVJbnRlcm9wIiwiV2Vha01hcCIsImNhY2hlQmFiZWxJbnRlcm9wIiwiY2FjaGVOb2RlSW50ZXJvcCIsIm9iaiIsIl9fZXNNb2R1bGUiLCJkZWZhdWx0IiwiY2FjaGUiLCJoYXMiLCJnZXQiLCJuZXdPYmoiLCJoYXNQcm9wZXJ0eURlc2NyaXB0b3IiLCJPYmplY3QiLCJkZWZpbmVQcm9wZXJ0eSIsImdldE93blByb3BlcnR5RGVzY3JpcHRvciIsImtleSIsInByb3RvdHlwZSIsImhhc093blByb3BlcnR5IiwiY2FsbCIsImRlc2MiLCJzZXQiLCJBTExPV0VEX0hUTUxfVEFHUyIsIlRFWFRfTk9ERVMiLCJpc0FsbG93ZWRIdG1sVGFnIiwibm9kZSIsImxpdGVyYWwiLCJtYXRjaCIsIm1hdGNoZXMiLCJleGVjIiwibGVuZ3RoIiwidGFnIiwiaW5kZXhPZiIsImlzTXVsdGlMaW5lIiwicGFyIiwicGFyZW50IiwiZmlyc3RDaGlsZCIsImxhc3RDaGlsZCIsImdldFRleHRVbnRpbEVuZE9yTGluZWJyZWFrIiwiY3VycmVudE5vZGUiLCJ0ZXh0IiwidHlwZSIsIm4iLCJjaGFyIiwibmV4dCIsImZvcm1hdHRpbmdDaGFuZ2VzQnlOb2RlVHlwZSIsImVtcGgiLCJzdHJvbmciLCJpbm5lck5vZGVMaXRlcmFsIiwid2Fsa2VyIiwic3RlcCIsImN1cnJlbnROb2RlTGl0ZXJhbCIsImVudGVyaW5nIiwiTWFya2Rvd24iLCJjb25zdHJ1Y3RvciIsImlucHV0IiwiX2RlZmluZVByb3BlcnR5MiIsInBhcnNlciIsIlBhcnNlciIsInBhcnNlZCIsInBhcnNlIiwicmVwYWlyTGlua3MiLCJldmVudCIsImlzSW5QYXJhIiwicHJldmlvdXNOb2RlIiwic2hvdWxkVW5saW5rRm9ybWF0dGluZ05vZGUiLCJ0aGlzUGFydCIsIm5leHRQYXJ0cyIsInNwbGl0IiwicmV2ZXJzZSIsImZvckVhY2giLCJwYXJ0IiwibmV4dE5vZGUiLCJOb2RlIiwiaW5zZXJ0QWZ0ZXIiLCJyZXN1bWVBdCIsImZvdW5kTGlua3MiLCJsaW5raWZ5IiwiZmluZCIsInZhbHVlIiwiZm9ybWF0Iiwibm9uRW1waGFzaXplZFRleHQiLCJmIiwibmV3VGV4dCIsIm5ld0xpbmtzIiwiZW1waGFzaXNUZXh0Tm9kZSIsInVubGluayIsImxvZ2dlciIsImVycm9yIiwiaXNQbGFpblRleHQiLCJldiIsInRvSFRNTCIsImV4dGVybmFsTGlua3MiLCJhcmd1bWVudHMiLCJ1bmRlZmluZWQiLCJyZW5kZXJlciIsIkh0bWxSZW5kZXJlciIsInNhZmUiLCJzb2Z0YnJlYWsiLCJyZWFsUGFyYWdyYXBoIiwicGFyYWdyYXBoIiwibGluayIsImF0dHJzIiwiZGVzdGluYXRpb24iLCJwdXNoIiwiZXNjIiwidGl0bGUiLCJodG1sX2lubGluZSIsImxpdCIsImVzY2FwZSIsImh0bWxfYmxvY2siLCJyZW5kZXIiLCJ0b1BsYWludGV4dCIsImV4cG9ydHMiXSwic291cmNlcyI6WyIuLi9zcmMvTWFya2Rvd24udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbkNvcHlyaWdodCAyMDE2IE9wZW5NYXJrZXQgTHRkXG5Db3B5cmlnaHQgMjAyMSBUaGUgTWF0cml4Lm9yZyBGb3VuZGF0aW9uIEMuSS5DLlxuXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiovXG5cbmltcG9ydCBcIi4vQHR5cGVzL2NvbW1vbm1hcmtcIjsgLy8gaW1wb3J0IGJldHRlciB0eXBlcyB0aGFuIEB0eXBlcy9jb21tb25tYXJrXG5pbXBvcnQgKiBhcyBjb21tb25tYXJrIGZyb20gXCJjb21tb25tYXJrXCI7XG5pbXBvcnQgeyBlc2NhcGUgfSBmcm9tIFwibG9kYXNoXCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbG9nZ2VyXCI7XG5cbmltcG9ydCB7IGxpbmtpZnkgfSBmcm9tIFwiLi9saW5raWZ5LW1hdHJpeFwiO1xuXG5jb25zdCBBTExPV0VEX0hUTUxfVEFHUyA9IFtcInN1YlwiLCBcInN1cFwiLCBcImRlbFwiLCBcInVcIl07XG5cbi8vIFRoZXNlIHR5cGVzIG9mIG5vZGUgYXJlIGRlZmluaXRlbHkgdGV4dFxuY29uc3QgVEVYVF9OT0RFUyA9IFtcInRleHRcIiwgXCJzb2Z0YnJlYWtcIiwgXCJsaW5lYnJlYWtcIiwgXCJwYXJhZ3JhcGhcIiwgXCJkb2N1bWVudFwiXTtcblxuZnVuY3Rpb24gaXNBbGxvd2VkSHRtbFRhZyhub2RlOiBjb21tb25tYXJrLk5vZGUpOiBib29sZWFuIHtcbiAgICBpZiAoIW5vZGUubGl0ZXJhbCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKG5vZGUubGl0ZXJhbC5tYXRjaCgnXjwoKGRpdnxzcGFuKSBkYXRhLW14LW1hdGhzPVwiW15cIl0qXCJ8LyhkaXZ8c3BhbikpPiQnKSAhPSBudWxsKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8vIFJlZ2V4IHdvbid0IHdvcmsgZm9yIHRhZ3Mgd2l0aCBhdHRycywgYnV0IHdlIG9ubHlcbiAgICAvLyBhbGxvdyA8ZGVsPiBhbnl3YXkuXG4gICAgY29uc3QgbWF0Y2hlcyA9IC9ePFxcLz8oLiopPiQvLmV4ZWMobm9kZS5saXRlcmFsKTtcbiAgICBpZiAobWF0Y2hlcyAmJiBtYXRjaGVzLmxlbmd0aCA9PSAyKSB7XG4gICAgICAgIGNvbnN0IHRhZyA9IG1hdGNoZXNbMV07XG4gICAgICAgIHJldHVybiBBTExPV0VEX0hUTUxfVEFHUy5pbmRleE9mKHRhZykgPiAtMTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59XG5cbi8qXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIHBhcnNlIG91dHB1dCBjb250YWluaW5nIHRoZSBub2RlXG4gKiBjb21wcmlzZXMgbXVsdGlwbGUgYmxvY2sgbGV2ZWwgZWxlbWVudHMgKGllLiBsaW5lcyksXG4gKiBvciBmYWxzZSBpZiBpdCBpcyBvbmx5IGEgc2luZ2xlIGxpbmUuXG4gKi9cbmZ1bmN0aW9uIGlzTXVsdGlMaW5lKG5vZGU6IGNvbW1vbm1hcmsuTm9kZSk6IGJvb2xlYW4ge1xuICAgIGxldCBwYXIgPSBub2RlO1xuICAgIHdoaWxlIChwYXIucGFyZW50KSB7XG4gICAgICAgIHBhciA9IHBhci5wYXJlbnQ7XG4gICAgfVxuICAgIHJldHVybiBwYXIuZmlyc3RDaGlsZCAhPSBwYXIubGFzdENoaWxkO1xufVxuXG5mdW5jdGlvbiBnZXRUZXh0VW50aWxFbmRPckxpbmVicmVhayhub2RlOiBjb21tb25tYXJrLk5vZGUpOiBzdHJpbmcge1xuICAgIGxldCBjdXJyZW50Tm9kZTogY29tbW9ubWFyay5Ob2RlIHwgbnVsbCA9IG5vZGU7XG4gICAgbGV0IHRleHQgPSBcIlwiO1xuICAgIHdoaWxlIChjdXJyZW50Tm9kZSAmJiBjdXJyZW50Tm9kZS50eXBlICE9PSBcInNvZnRicmVha1wiICYmIGN1cnJlbnROb2RlLnR5cGUgIT09IFwibGluZWJyZWFrXCIpIHtcbiAgICAgICAgY29uc3QgeyBsaXRlcmFsLCB0eXBlIH0gPSBjdXJyZW50Tm9kZTtcbiAgICAgICAgaWYgKHR5cGUgPT09IFwidGV4dFwiICYmIGxpdGVyYWwpIHtcbiAgICAgICAgICAgIGxldCBuID0gMDtcbiAgICAgICAgICAgIGxldCBjaGFyID0gbGl0ZXJhbFtuXTtcbiAgICAgICAgICAgIHdoaWxlIChjaGFyICE9PSBcIiBcIiAmJiBjaGFyICE9PSBudWxsICYmIG4gPD0gbGl0ZXJhbC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2hhciA9PT0gXCIgXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChjaGFyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRleHQgKz0gY2hhcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbiArPSAxO1xuICAgICAgICAgICAgICAgIGNoYXIgPSBsaXRlcmFsW25dO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGNoYXIgPT09IFwiIFwiKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY3VycmVudE5vZGUgPSBjdXJyZW50Tm9kZS5uZXh0O1xuICAgIH1cbiAgICByZXR1cm4gdGV4dDtcbn1cblxuY29uc3QgZm9ybWF0dGluZ0NoYW5nZXNCeU5vZGVUeXBlID0ge1xuICAgIGVtcGg6IFwiX1wiLFxuICAgIHN0cm9uZzogXCJfX1wiLFxufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBsaXRlcmFsIG9mIGEgbm9kZSBhbiBhbGwgY2hpbGQgbm9kZXMuXG4gKi9cbmNvbnN0IGlubmVyTm9kZUxpdGVyYWwgPSAobm9kZTogY29tbW9ubWFyay5Ob2RlKTogc3RyaW5nID0+IHtcbiAgICBsZXQgbGl0ZXJhbCA9IFwiXCI7XG5cbiAgICBjb25zdCB3YWxrZXIgPSBub2RlLndhbGtlcigpO1xuICAgIGxldCBzdGVwOiBjb21tb25tYXJrLk5vZGVXYWxraW5nU3RlcCB8IG51bGw7XG5cbiAgICB3aGlsZSAoKHN0ZXAgPSB3YWxrZXIubmV4dCgpKSkge1xuICAgICAgICBjb25zdCBjdXJyZW50Tm9kZSA9IHN0ZXAubm9kZTtcbiAgICAgICAgY29uc3QgY3VycmVudE5vZGVMaXRlcmFsID0gY3VycmVudE5vZGUubGl0ZXJhbDtcbiAgICAgICAgaWYgKHN0ZXAuZW50ZXJpbmcgJiYgY3VycmVudE5vZGUudHlwZSA9PT0gXCJ0ZXh0XCIgJiYgY3VycmVudE5vZGVMaXRlcmFsKSB7XG4gICAgICAgICAgICBsaXRlcmFsICs9IGN1cnJlbnROb2RlTGl0ZXJhbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBsaXRlcmFsO1xufTtcblxuLyoqXG4gKiBDbGFzcyB0aGF0IHdyYXBzIGNvbW1vbm1hcmssIGFkZGluZyB0aGUgYWJpbGl0eSB0byBzZWUgd2hldGhlclxuICogYSBnaXZlbiBtZXNzYWdlIGFjdHVhbGx5IHVzZXMgYW55IG1hcmtkb3duIHN5bnRheCBvciB3aGV0aGVyXG4gKiBpdCdzIHBsYWluIHRleHQuXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1hcmtkb3duIHtcbiAgICBwcml2YXRlIGlucHV0OiBzdHJpbmc7XG4gICAgcHJpdmF0ZSBwYXJzZWQ6IGNvbW1vbm1hcmsuTm9kZTtcblxuICAgIHB1YmxpYyBjb25zdHJ1Y3RvcihpbnB1dDogc3RyaW5nKSB7XG4gICAgICAgIHRoaXMuaW5wdXQgPSBpbnB1dDtcblxuICAgICAgICBjb25zdCBwYXJzZXIgPSBuZXcgY29tbW9ubWFyay5QYXJzZXIoKTtcbiAgICAgICAgdGhpcy5wYXJzZWQgPSBwYXJzZXIucGFyc2UodGhpcy5pbnB1dCk7XG4gICAgICAgIHRoaXMucGFyc2VkID0gdGhpcy5yZXBhaXJMaW5rcyh0aGlzLnBhcnNlZCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhpcyBtZXRob2QgaXMgbW9kaWZ5aW5nIHRoZSBwYXJzZWQgQVNUIGluIHN1Y2ggYSB3YXkgdGhhdCBsaW5rcyBhcmUgYWx3YXlzXG4gICAgICogcHJvcGVybHkgbGlua2lmaWVkIGluc3RlYWQgb2Ygc29tZXRpbWVzIGJlaW5nIHdyb25nbHkgZW1waGFzaXNlZCBpbiBjYXNlXG4gICAgICogaWYgeW91IHdlcmUgdG8gd3JpdGUgYSBsaW5rIGxpa2UgdGhlIGV4YW1wbGUgYmVsb3c6XG4gICAgICogaHR0cHM6Ly9teV93ZWlyZC1saW5rX2RvbWFpbi5kb21haW4uY29tXG4gICAgICogXiB0aGlzIGxpbmsgd291bGQgYmUgcGFyc2VkIHRvIHNvbWV0aGluZyBsaWtlIHRoaXM6XG4gICAgICogPGEgaHJlZj1cImh0dHBzOi8vbXlcIj5odHRwczovL215PC9hPjxiPndlaXJkLWxpbms8L2I+PGEgaHJlZj1cImh0dHBzOi8vZG9tYWluLmRvbWFpbi5jb21cIj5kb21haW4uZG9tYWluLmNvbTwvYT5cbiAgICAgKiBUaGlzIG1ldGhvZCBtYWtlcyBpdCBzbyB0aGUgbGluayBnZXRzIHByb3Blcmx5IG1vZGlmaWVkIHRvIGEgdmVyc2lvbiB3aGVyZSBpdCBpc1xuICAgICAqIG5vdCBlbXBoYXNpc2VkIHVudGlsIGl0IGFjdHVhbGx5IGVuZHMuXG4gICAgICogU2VlOiBodHRwczovL2dpdGh1Yi5jb20vdmVjdG9yLWltL2VsZW1lbnQtd2ViL2lzc3Vlcy80Njc0XG4gICAgICogQHBhcmFtIHBhcnNlZFxuICAgICAqL1xuICAgIHByaXZhdGUgcmVwYWlyTGlua3MocGFyc2VkOiBjb21tb25tYXJrLk5vZGUpOiBjb21tb25tYXJrLk5vZGUge1xuICAgICAgICBjb25zdCB3YWxrZXIgPSBwYXJzZWQud2Fsa2VyKCk7XG4gICAgICAgIGxldCBldmVudDogY29tbW9ubWFyay5Ob2RlV2Fsa2luZ1N0ZXAgfCBudWxsID0gbnVsbDtcbiAgICAgICAgbGV0IHRleHQgPSBcIlwiO1xuICAgICAgICBsZXQgaXNJblBhcmEgPSBmYWxzZTtcbiAgICAgICAgbGV0IHByZXZpb3VzTm9kZTogY29tbW9ubWFyay5Ob2RlIHwgbnVsbCA9IG51bGw7XG4gICAgICAgIGxldCBzaG91bGRVbmxpbmtGb3JtYXR0aW5nTm9kZSA9IGZhbHNlO1xuICAgICAgICB3aGlsZSAoKGV2ZW50ID0gd2Fsa2VyLm5leHQoKSkpIHtcbiAgICAgICAgICAgIGNvbnN0IHsgbm9kZSB9ID0gZXZlbnQ7XG4gICAgICAgICAgICBpZiAobm9kZS50eXBlID09PSBcInBhcmFncmFwaFwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKGV2ZW50LmVudGVyaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIGlzSW5QYXJhID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpc0luUGFyYSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpc0luUGFyYSkge1xuICAgICAgICAgICAgICAgIC8vIENsZWFyIHNhdmVkIHN0cmluZyB3aGVuIGxpbmUgZW5kc1xuICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgbm9kZS50eXBlID09PSBcInNvZnRicmVha1wiIHx8XG4gICAgICAgICAgICAgICAgICAgIG5vZGUudHlwZSA9PT0gXCJsaW5lYnJlYWtcIiB8fFxuICAgICAgICAgICAgICAgICAgICAvLyBBbHNvIHN0YXJ0IGNhbGN1bGF0aW5nIHRoZSB0ZXh0IGZyb20gdGhlIGJlZ2lubmluZyBvbiBhbnkgc3BhY2VzXG4gICAgICAgICAgICAgICAgICAgIChub2RlLnR5cGUgPT09IFwidGV4dFwiICYmIG5vZGUubGl0ZXJhbCA9PT0gXCIgXCIpXG4gICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICAgIHRleHQgPSBcIlwiO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBCcmVhayB1cCB0ZXh0IG5vZGVzIG9uIHNwYWNlcywgc28gdGhhdCB3ZSBkb24ndCBzaG9vdCBwYXN0IHRoZW0gd2l0aG91dCByZXNldHRpbmdcbiAgICAgICAgICAgICAgICBpZiAobm9kZS50eXBlID09PSBcInRleHRcIiAmJiBub2RlLmxpdGVyYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgW3RoaXNQYXJ0LCAuLi5uZXh0UGFydHNdID0gbm9kZS5saXRlcmFsLnNwbGl0KC8oICkvKTtcbiAgICAgICAgICAgICAgICAgICAgbm9kZS5saXRlcmFsID0gdGhpc1BhcnQ7XG4gICAgICAgICAgICAgICAgICAgIHRleHQgKz0gdGhpc1BhcnQ7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gQWRkIHRoZSByZW1haW5pbmcgcGFydHMgYXMgc2libGluZ3NcbiAgICAgICAgICAgICAgICAgICAgbmV4dFBhcnRzLnJldmVyc2UoKS5mb3JFYWNoKChwYXJ0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocGFydCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5leHROb2RlID0gbmV3IGNvbW1vbm1hcmsuTm9kZShcInRleHRcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV4dE5vZGUubGl0ZXJhbCA9IHBhcnQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbm9kZS5pbnNlcnRBZnRlcihuZXh0Tm9kZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gTWFrZSB0aGUgaXRlcmF0b3IgYXdhcmUgb2YgdGhlIG5ld2x5IGluc2VydGVkIG5vZGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3YWxrZXIucmVzdW1lQXQobmV4dE5vZGUsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBXZSBzaG91bGQgbm90IGRvIHRoaXMgaWYgcHJldmlvdXMgbm9kZSB3YXMgbm90IGEgdGV4dG5vZGUsIGFzIHdlIGNhbid0IGNvbWJpbmUgaXQgdGhlbi5cbiAgICAgICAgICAgICAgICBpZiAoKG5vZGUudHlwZSA9PT0gXCJlbXBoXCIgfHwgbm9kZS50eXBlID09PSBcInN0cm9uZ1wiKSAmJiBwcmV2aW91c05vZGU/LnR5cGUgPT09IFwidGV4dFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChldmVudC5lbnRlcmluZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZm91bmRMaW5rcyA9IGxpbmtpZnkuZmluZCh0ZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgeyB2YWx1ZSB9IG9mIGZvdW5kTGlua3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobm9kZT8uZmlyc3RDaGlsZD8ubGl0ZXJhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICogTk9URTogVGhpcyB0ZWNobmljYWxseSBzaG91bGQgdW5saW5rIHRoZSBlbXBoIG5vZGUgYW5kIGNyZWF0ZSBMSU5LIG5vZGVzIGluc3RlYWQsIGFkZGluZyBhbGwgdGhlIG5leHQgZWxlbWVudHMgYXMgc2libGluZ3NcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICogYnV0IHRoaXMgc29sdXRpb24gc2VlbXMgdG8gd29yayB3ZWxsIGFuZCBpcyBob3BlZnVsbHkgc2xpZ2h0bHkgZWFzaWVyIHRvIHVuZGVyc3RhbmQgdG9vXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmb3JtYXQgPSBmb3JtYXR0aW5nQ2hhbmdlc0J5Tm9kZVR5cGVbbm9kZS50eXBlXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgbm9uRW1waGFzaXplZFRleHQgPSBgJHtmb3JtYXR9JHtpbm5lck5vZGVMaXRlcmFsKG5vZGUpfSR7Zm9ybWF0fWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGYgPSBnZXRUZXh0VW50aWxFbmRPckxpbmVicmVhayhub2RlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3VGV4dCA9IHZhbHVlICsgbm9uRW1waGFzaXplZFRleHQgKyBmO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdMaW5rcyA9IGxpbmtpZnkuZmluZChuZXdUZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gU2hvdWxkIGFsd2F5cyBmaW5kIG9ubHkgb25lIGxpbmsgaGVyZSwgaWYgaXQgZmluZHMgbW9yZSBpdCBtZWFucyB0aGF0IHRoZSBhbGdvcml0aG0gaXMgYnJva2VuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChuZXdMaW5rcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGVtcGhhc2lzVGV4dE5vZGUgPSBuZXcgY29tbW9ubWFyay5Ob2RlKFwidGV4dFwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVtcGhhc2lzVGV4dE5vZGUubGl0ZXJhbCA9IG5vbkVtcGhhc2l6ZWRUZXh0O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJldmlvdXNOb2RlLmluc2VydEFmdGVyKGVtcGhhc2lzVGV4dE5vZGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbm9kZS5maXJzdENoaWxkLmxpdGVyYWwgPSBcIlwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQgPSBub2RlLndhbGtlcigpLm5leHQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChldmVudCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBgZW1gIG9wZW5pbmcgYW5kIGNsb3Npbmcgbm9kZXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBub2RlLnVubGluaygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZXZpb3VzTm9kZS5pbnNlcnRBZnRlcihldmVudC5ub2RlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaG91bGRVbmxpbmtGb3JtYXR0aW5nTm9kZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2dnZXIuZXJyb3IoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJNYXJrZG93biBsaW5rcyBlc2NhcGluZyBmb3VuZCB0b28gbWFueSBsaW5rcyBmb3IgZm9sbG93aW5nIHRleHQ6IFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRleHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLmVycm9yKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiTWFya2Rvd24gbGlua3MgZXNjYXBpbmcgZm91bmQgdG9vIG1hbnkgbGlua3MgZm9yIG1vZGlmaWVkIHRleHQ6IFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld1RleHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNob3VsZFVubGlua0Zvcm1hdHRpbmdOb2RlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbm9kZS51bmxpbmsoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaG91bGRVbmxpbmtGb3JtYXR0aW5nTm9kZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcHJldmlvdXNOb2RlID0gbm9kZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcGFyc2VkO1xuICAgIH1cblxuICAgIHB1YmxpYyBpc1BsYWluVGV4dCgpOiBib29sZWFuIHtcbiAgICAgICAgY29uc3Qgd2Fsa2VyID0gdGhpcy5wYXJzZWQud2Fsa2VyKCk7XG5cbiAgICAgICAgbGV0IGV2OiBjb21tb25tYXJrLk5vZGVXYWxraW5nU3RlcCB8IG51bGw7XG4gICAgICAgIHdoaWxlICgoZXYgPSB3YWxrZXIubmV4dCgpKSkge1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGV2Lm5vZGU7XG4gICAgICAgICAgICBpZiAoVEVYVF9OT0RFUy5pbmRleE9mKG5vZGUudHlwZSkgPiAtMSkge1xuICAgICAgICAgICAgICAgIC8vIGRlZmluaXRlbHkgdGV4dFxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChub2RlLnR5cGUgPT0gXCJodG1sX2lubGluZVwiIHx8IG5vZGUudHlwZSA9PSBcImh0bWxfYmxvY2tcIikge1xuICAgICAgICAgICAgICAgIC8vIGlmIGl0J3MgYW4gYWxsb3dlZCBodG1sIHRhZywgd2UgbmVlZCB0byByZW5kZXIgaXQgYW5kIHRoZXJlZm9yZVxuICAgICAgICAgICAgICAgIC8vIHdlIHdpbGwgbmVlZCB0byB1c2UgSFRNTC4gSWYgaXQncyBub3QgYWxsb3dlZCwgaXQncyBub3QgSFRNTCBzaW5jZVxuICAgICAgICAgICAgICAgIC8vIHdlJ2xsIGp1c3QgYmUgdHJlYXRpbmcgaXQgYXMgdGV4dC5cbiAgICAgICAgICAgICAgICBpZiAoaXNBbGxvd2VkSHRtbFRhZyhub2RlKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcHVibGljIHRvSFRNTCh7IGV4dGVybmFsTGlua3MgPSBmYWxzZSB9ID0ge30pOiBzdHJpbmcge1xuICAgICAgICBjb25zdCByZW5kZXJlciA9IG5ldyBjb21tb25tYXJrLkh0bWxSZW5kZXJlcih7XG4gICAgICAgICAgICBzYWZlOiBmYWxzZSxcblxuICAgICAgICAgICAgLy8gU2V0IHNvZnQgYnJlYWtzIHRvIGhhcmQgSFRNTCBicmVha3M6IGNvbW1vbm1hcmtcbiAgICAgICAgICAgIC8vIHB1dHMgc29mdGJyZWFrcyBpbiBmb3IgbXVsdGlwbGUgbGluZXMgaW4gYSBibG9ja3F1b3RlLFxuICAgICAgICAgICAgLy8gc28gaWYgdGhlc2UgYXJlIGp1c3QgbmV3bGluZSBjaGFyYWN0ZXJzIHRoZW4gdGhlXG4gICAgICAgICAgICAvLyBibG9jayBxdW90ZSBlbmRzIHVwIGFsbCBvbiBvbmUgbGluZVxuICAgICAgICAgICAgLy8gKGh0dHBzOi8vZ2l0aHViLmNvbS92ZWN0b3ItaW0vZWxlbWVudC13ZWIvaXNzdWVzLzMxNTQpXG4gICAgICAgICAgICBzb2Z0YnJlYWs6IFwiPGJyIC8+XCIsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFRyeWluZyB0byBzdHJpcCBvdXQgdGhlIHdyYXBwaW5nIDxwLz4gY2F1c2VzIGEgbG90IG1vcmUgY29tcGxpY2F0aW9uXG4gICAgICAgIC8vIHRoYW4gaXQncyB3b3J0aCwgaSB0aGluay4gIEZvciBpbnN0YW5jZSwgdGhpcyBjb2RlIHdpbGwgZ28gYW5kIHN0cmlwXG4gICAgICAgIC8vIG91dCBhbnkgPHAvPiB0YWcgKG5vIG1hdHRlciB3aGVyZSBpdCBpcyBpbiB0aGUgdHJlZSkgd2hpY2ggZG9lc24ndFxuICAgICAgICAvLyBjb250YWluIFxcbidzLlxuICAgICAgICAvLyBPbiB0aGUgZmxpcCBzaWRlLCA8cC8+cyBhcmUgcXVpdGUgb3Bpb25hdGVkIGFuZCByZXN0cmljdGVkIG9uIHdoZXJlXG4gICAgICAgIC8vIHlvdSBjYW4gbmVzdCB0aGVtLlxuICAgICAgICAvL1xuICAgICAgICAvLyBMZXQncyB0cnkgc2VuZGluZyB3aXRoIDxwLz5zIGFueXdheSBmb3Igbm93LCB0aG91Z2guXG4gICAgICAgIGNvbnN0IHJlYWxQYXJhZ3JhcGggPSByZW5kZXJlci5wYXJhZ3JhcGg7XG4gICAgICAgIHJlbmRlcmVyLnBhcmFncmFwaCA9IGZ1bmN0aW9uIChub2RlOiBjb21tb25tYXJrLk5vZGUsIGVudGVyaW5nOiBib29sZWFuKSB7XG4gICAgICAgICAgICAvLyBJZiB0aGVyZSBpcyBvbmx5IG9uZSB0b3AgbGV2ZWwgbm9kZSwganVzdCByZXR1cm4gdGhlXG4gICAgICAgICAgICAvLyBiYXJlIHRleHQ6IGl0J3MgYSBzaW5nbGUgbGluZSBvZiB0ZXh0IGFuZCBzbyBzaG91bGQgYmVcbiAgICAgICAgICAgIC8vICdpbmxpbmUnLCByYXRoZXIgdGhhbiB1bm5lY2Vzc2FyaWx5IHdyYXBwZWQgaW4gaXRzIG93blxuICAgICAgICAgICAgLy8gcCB0YWcuIElmLCBob3dldmVyLCB3ZSBoYXZlIG11bHRpcGxlIG5vZGVzLCBlYWNoIGdldHNcbiAgICAgICAgICAgIC8vIGl0cyBvd24gcCB0YWcgdG8ga2VlcCB0aGVtIGFzIHNlcGFyYXRlIHBhcmFncmFwaHMuXG4gICAgICAgICAgICAvLyBIb3dldmVyLCBpZiBpdCdzIGEgYmxvY2txdW90ZSwgYWRkcyBhIHAgdGFnIGFueXdheVxuICAgICAgICAgICAgLy8gaW4gb3JkZXIgdG8gYXZvaWQgZGV2aWF0aW9uIHRvIGNvbW1vbm1hcmsgYW5kIHVuZXhwZWN0ZWRcbiAgICAgICAgICAgIC8vIHJlc3VsdHMgd2hlbiBwYXJzaW5nIHRoZSBmb3JtYXR0ZWQgSFRNTC5cbiAgICAgICAgICAgIGlmIChub2RlLnBhcmVudD8udHlwZSA9PT0gXCJibG9ja19xdW90ZVwiIHx8IGlzTXVsdGlMaW5lKG5vZGUpKSB7XG4gICAgICAgICAgICAgICAgcmVhbFBhcmFncmFwaC5jYWxsKHRoaXMsIG5vZGUsIGVudGVyaW5nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICByZW5kZXJlci5saW5rID0gZnVuY3Rpb24gKG5vZGUsIGVudGVyaW5nKSB7XG4gICAgICAgICAgICBjb25zdCBhdHRycyA9IHRoaXMuYXR0cnMobm9kZSk7XG4gICAgICAgICAgICBpZiAoZW50ZXJpbmcgJiYgbm9kZS5kZXN0aW5hdGlvbikge1xuICAgICAgICAgICAgICAgIGF0dHJzLnB1c2goW1wiaHJlZlwiLCB0aGlzLmVzYyhub2RlLmRlc3RpbmF0aW9uKV0pO1xuICAgICAgICAgICAgICAgIGlmIChub2RlLnRpdGxlKSB7XG4gICAgICAgICAgICAgICAgICAgIGF0dHJzLnB1c2goW1widGl0bGVcIiwgdGhpcy5lc2Mobm9kZS50aXRsZSldKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gTW9kaWZpZWQgbGluayBiZWhhdmlvdXIgdG8gdHJlYXQgdGhlbSBhbGwgYXMgZXh0ZXJuYWwgYW5kXG4gICAgICAgICAgICAgICAgLy8gdGh1cyBvcGVuaW5nIGluIGEgbmV3IHRhYi5cbiAgICAgICAgICAgICAgICBpZiAoZXh0ZXJuYWxMaW5rcykge1xuICAgICAgICAgICAgICAgICAgICBhdHRycy5wdXNoKFtcInRhcmdldFwiLCBcIl9ibGFua1wiXSk7XG4gICAgICAgICAgICAgICAgICAgIGF0dHJzLnB1c2goW1wicmVsXCIsIFwibm9yZWZlcnJlciBub29wZW5lclwiXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMudGFnKFwiYVwiLCBhdHRycyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMudGFnKFwiL2FcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgcmVuZGVyZXIuaHRtbF9pbmxpbmUgPSBmdW5jdGlvbiAobm9kZTogY29tbW9ubWFyay5Ob2RlKSB7XG4gICAgICAgICAgICBpZiAobm9kZS5saXRlcmFsKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzQWxsb3dlZEh0bWxUYWcobm9kZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5saXQobm9kZS5saXRlcmFsKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmxpdChlc2NhcGUobm9kZS5saXRlcmFsKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHJlbmRlcmVyLmh0bWxfYmxvY2sgPSBmdW5jdGlvbiAobm9kZTogY29tbW9ubWFyay5Ob2RlKSB7XG4gICAgICAgICAgICAvKlxuICAgICAgICAgICAgLy8gYXMgd2l0aCBgcGFyYWdyYXBoYCwgd2Ugb25seSBpbnNlcnQgbGluZSBicmVha3NcbiAgICAgICAgICAgIC8vIGlmIHRoZXJlIGFyZSBtdWx0aXBsZSBsaW5lcyBpbiB0aGUgbWFya2Rvd24uXG4gICAgICAgICAgICBjb25zdCBpc011bHRpTGluZSA9IGlzX211bHRpX2xpbmUobm9kZSk7XG4gICAgICAgICAgICBpZiAoaXNNdWx0aUxpbmUpIHRoaXMuY3IoKTtcbiAgICAgICAgICAgICovXG4gICAgICAgICAgICByZW5kZXJlci5odG1sX2lubGluZShub2RlKTtcbiAgICAgICAgICAgIC8qXG4gICAgICAgICAgICBpZiAoaXNNdWx0aUxpbmUpIHRoaXMuY3IoKTtcbiAgICAgICAgICAgICovXG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHJlbmRlcmVyLnJlbmRlcih0aGlzLnBhcnNlZCk7XG4gICAgfVxuXG4gICAgLypcbiAgICAgKiBSZW5kZXIgdGhlIG1hcmtkb3duIG1lc3NhZ2UgdG8gcGxhaW4gdGV4dC4gVGhhdCBpcywgZXNzZW50aWFsbHlcbiAgICAgKiBqdXN0IHJlbW92ZSBhbnkgYmFja3NsYXNoZXMgZXNjYXBpbmcgd2hhdCB3b3VsZCBvdGhlcndpc2UgYmVcbiAgICAgKiBtYXJrZG93biBzeW50YXhcbiAgICAgKiAodG8gZml4IGh0dHBzOi8vZ2l0aHViLmNvbS92ZWN0b3ItaW0vZWxlbWVudC13ZWIvaXNzdWVzLzI4NzApLlxuICAgICAqXG4gICAgICogTi5CLiB0aGlzIGRvZXMgKipOT1QqKiByZW5kZXIgYXJiaXRyYXJ5IE1EIHRvIHBsYWluIHRleHQgLSBvbmx5IE1EXG4gICAgICogd2hpY2ggaGFzIG5vIGZvcm1hdHRpbmcuICBPdGhlcndpc2UgaXQgZW1pdHMgSFRNTCghKS5cbiAgICAgKi9cbiAgICBwdWJsaWMgdG9QbGFpbnRleHQoKTogc3RyaW5nIHtcbiAgICAgICAgY29uc3QgcmVuZGVyZXIgPSBuZXcgY29tbW9ubWFyay5IdG1sUmVuZGVyZXIoeyBzYWZlOiBmYWxzZSB9KTtcblxuICAgICAgICByZW5kZXJlci5wYXJhZ3JhcGggPSBmdW5jdGlvbiAobm9kZTogY29tbW9ubWFyay5Ob2RlLCBlbnRlcmluZzogYm9vbGVhbikge1xuICAgICAgICAgICAgLy8gYXMgd2l0aCB0b0hUTUwsIG9ubHkgYXBwZW5kIGxpbmVzIHRvIHBhcmFncmFwaHMgaWYgdGhlcmUgYXJlXG4gICAgICAgICAgICAvLyBtdWx0aXBsZSBwYXJhZ3JhcGhzXG4gICAgICAgICAgICBpZiAoaXNNdWx0aUxpbmUobm9kZSkpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWVudGVyaW5nICYmIG5vZGUubmV4dCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmxpdChcIlxcblxcblwiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgcmVuZGVyZXIuaHRtbF9ibG9jayA9IGZ1bmN0aW9uIChub2RlOiBjb21tb25tYXJrLk5vZGUpIHtcbiAgICAgICAgICAgIGlmIChub2RlLmxpdGVyYWwpIHRoaXMubGl0KG5vZGUubGl0ZXJhbCk7XG4gICAgICAgICAgICBpZiAoaXNNdWx0aUxpbmUobm9kZSkgJiYgbm9kZS5uZXh0KSB0aGlzLmxpdChcIlxcblxcblwiKTtcbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gcmVuZGVyZXIucmVuZGVyKHRoaXMucGFyc2VkKTtcbiAgICB9XG59XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBaUJBQSxPQUFBO0FBQ0EsSUFBQUMsVUFBQSxHQUFBQyx1QkFBQSxDQUFBRixPQUFBO0FBQ0EsSUFBQUcsT0FBQSxHQUFBSCxPQUFBO0FBQ0EsSUFBQUksT0FBQSxHQUFBSixPQUFBO0FBRUEsSUFBQUssY0FBQSxHQUFBTCxPQUFBO0FBQTJDLFNBQUFNLHlCQUFBQyxXQUFBLGVBQUFDLE9BQUEsa0NBQUFDLGlCQUFBLE9BQUFELE9BQUEsUUFBQUUsZ0JBQUEsT0FBQUYsT0FBQSxZQUFBRix3QkFBQSxZQUFBQSxDQUFBQyxXQUFBLFdBQUFBLFdBQUEsR0FBQUcsZ0JBQUEsR0FBQUQs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