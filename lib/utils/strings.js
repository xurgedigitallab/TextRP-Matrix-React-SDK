"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.copyNode = copyNode;
exports.copyPlaintext = copyPlaintext;
exports.getFirstGrapheme = getFirstGrapheme;
exports.getSelectedText = getSelectedText;
exports.selectText = selectText;
var _logger = require("matrix-js-sdk/src/logger");
var _graphemer = _interopRequireDefault(require("graphemer"));
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
/**
 * Copy plaintext to user's clipboard
 * It will overwrite user's selection range
 * In certain browsers it may only work if triggered by a user action or may ask user for permissions
 * Tries to use new async clipboard API if available
 * @param text the plaintext to put in the user's clipboard
 */

async function copyPlaintext(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;

      // Avoid scrolling to bottom
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      const selection = document.getSelection();
      const range = document.createRange();
      // range.selectNodeContents(textArea);
      range.selectNode(textArea);
      selection.removeAllRanges();
      selection.addRange(range);
      const successful = document.execCommand("copy");
      selection.removeAllRanges();
      document.body.removeChild(textArea);
      return successful;
    }
  } catch (e) {
    _logger.logger.error("copyPlaintext failed", e);
  }
  return false;
}
function selectText(target) {
  const range = document.createRange();
  range.selectNodeContents(target);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Copy rich text to user's clipboard
 * It will overwrite user's selection range
 * In certain browsers it may only work if triggered by a user action or may ask user for permissions
 * @param ref pointer to the node to copy
 */
function copyNode(ref) {
  if (!ref) return false;
  selectText(ref);
  return document.execCommand("copy");
}

/**
 * Returns text which has been selected by the user
 * @returns the selected text
 */
function getSelectedText() {
  return window.getSelection().toString();
}

/**
 * Returns the first grapheme in the given string,
 * especially useful for strings containing emoji, will not break compound emoji up.
 * @param str string to parse
 * @returns the first grapheme or an empty string if given an empty string
 */
function getFirstGrapheme(str) {
  const splitter = new _graphemer.default();
  const result = splitter.iterateGraphemes(str).next();
  return result.done ? "" : result.value;
}
//# sourceMappingURL=strings.js.map