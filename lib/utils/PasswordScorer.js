"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.scorePassword = scorePassword;
var _zxcvbn = _interopRequireDefault(require("zxcvbn"));
var _languageHandler = require("../languageHandler");
/*
Copyright 2018 New Vector Ltd

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

const ZXCVBN_USER_INPUTS = ["riot", "matrix"];

// Translations for zxcvbn's suggestion strings
(0, _languageHandler._td)("Use a few words, avoid common phrases");
(0, _languageHandler._td)("No need for symbols, digits, or uppercase letters");
(0, _languageHandler._td)("Use a longer keyboard pattern with more turns");
(0, _languageHandler._td)("Avoid repeated words and characters");
(0, _languageHandler._td)("Avoid sequences");
(0, _languageHandler._td)("Avoid recent years");
(0, _languageHandler._td)("Avoid years that are associated with you");
(0, _languageHandler._td)("Avoid dates and years that are associated with you");
(0, _languageHandler._td)("Capitalization doesn't help very much");
(0, _languageHandler._td)("All-uppercase is almost as easy to guess as all-lowercase");
(0, _languageHandler._td)("Reversed words aren't much harder to guess");
(0, _languageHandler._td)("Predictable substitutions like '@' instead of 'a' don't help very much");
(0, _languageHandler._td)("Add another word or two. Uncommon words are better.");

// and warnings
(0, _languageHandler._td)('Repeats like "aaa" are easy to guess');
(0, _languageHandler._td)('Repeats like "abcabcabc" are only slightly harder to guess than "abc"');
(0, _languageHandler._td)("Sequences like abc or 6543 are easy to guess");
(0, _languageHandler._td)("Recent years are easy to guess");
(0, _languageHandler._td)("Dates are often easy to guess");
(0, _languageHandler._td)("This is a top-10 common password");
(0, _languageHandler._td)("This is a top-100 common password");
(0, _languageHandler._td)("This is a very common password");
(0, _languageHandler._td)("This is similar to a commonly used password");
(0, _languageHandler._td)("A word by itself is easy to guess");
(0, _languageHandler._td)("Names and surnames by themselves are easy to guess");
(0, _languageHandler._td)("Common names and surnames are easy to guess");
(0, _languageHandler._td)("Straight rows of keys are easy to guess");
(0, _languageHandler._td)("Short keyboard patterns are easy to guess");

/**
 * Wrapper around zxcvbn password strength estimation
 * Include this only from async components: it pulls in zxcvbn
 * (obviously) which is large.
 *
 * @param {string} password Password to score
 * @param matrixClient the client of the logged in user, if any
 * @returns {object} Score result with `score` and `feedback` properties
 */
function scorePassword(matrixClient, password) {
  if (password.length === 0) return null;
  const userInputs = ZXCVBN_USER_INPUTS.slice();
  if (matrixClient) {
    userInputs.push(matrixClient.getUserIdLocalpart());
  }
  let zxcvbnResult = (0, _zxcvbn.default)(password, userInputs);
  // Work around https://github.com/dropbox/zxcvbn/issues/216
  if (password.includes(" ")) {
    const resultNoSpaces = (0, _zxcvbn.default)(password.replace(/ /g, ""), userInputs);
    if (resultNoSpaces.score < zxcvbnResult.score) zxcvbnResult = resultNoSpaces;
  }
  for (let i = 0; i < zxcvbnResult.feedback.suggestions.length; ++i) {
    // translate suggestions
    zxcvbnResult.feedback.suggestions[i] = (0, _languageHandler._t)(zxcvbnResult.feedback.suggestions[i]);
  }
  // and warning, if any
  if (zxcvbnResult.feedback.warning) {
    zxcvbnResult.feedback.warning = (0, _languageHandler._t)(zxcvbnResult.feedback.warning);
  }
  return zxcvbnResult;
}
//# sourceMappingURL=PasswordScorer.js.map