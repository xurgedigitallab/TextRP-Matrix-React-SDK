"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getEmojiFromUnicode = exports.EMOTICON_TO_EMOJI = exports.EMOJI = exports.DATA_BY_CATEGORY = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _compact = _interopRequireDefault(require("emojibase-data/en/compact.json"));
var _iamcal = _interopRequireDefault(require("emojibase-data/en/shortcodes/iamcal.json"));
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; } /*
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
// The unicode is stored without the variant selector
const UNICODE_TO_EMOJI = new Map(); // not exported as gets for it are handled by getEmojiFromUnicode
const EMOTICON_TO_EMOJI = new Map();
exports.EMOTICON_TO_EMOJI = EMOTICON_TO_EMOJI;
const getEmojiFromUnicode = unicode => UNICODE_TO_EMOJI.get(stripVariation(unicode));
exports.getEmojiFromUnicode = getEmojiFromUnicode;
const isRegionalIndicator = x => {
  // First verify that the string is a single character. We use Array.from
  // to make sure we count by characters, not UTF-8 code units.
  return Array.from(x).length === 1 &&
  // Next verify that the character is within the code point range for
  // regional indicators.
  // http://unicode.org/charts/PDF/Unicode-6.0/U60-1F100.pdf
  x >= "\u{1f1e6}" && x <= "\u{1f1ff}";
};
const EMOJIBASE_GROUP_ID_TO_CATEGORY = ["people",
// smileys
"people",
// actually people
"control",
// modifiers and such, not displayed in picker
"nature", "foods", "places", "activity", "objects", "symbols", "flags"];
const DATA_BY_CATEGORY = {
  people: [],
  nature: [],
  foods: [],
  places: [],
  activity: [],
  objects: [],
  symbols: [],
  flags: []
};

// Store various mappings from unicode/emoticon/shortcode to the Emoji objects
exports.DATA_BY_CATEGORY = DATA_BY_CATEGORY;
const EMOJI = _compact.default.map(emojiData => {
  // If there's ever a gap in shortcode coverage, we fudge it by
  // filling it in with the emoji's CLDR annotation
  const shortcodeData = _iamcal.default[emojiData.hexcode] ?? [emojiData.label.toLowerCase().replace(/\W+/g, "_")];
  const emoji = _objectSpread(_objectSpread({}, emojiData), {}, {
    // Homogenize shortcodes by ensuring that everything is an array
    shortcodes: typeof shortcodeData === "string" ? [shortcodeData] : shortcodeData
  });

  // We manually include regional indicators in the symbols group, since
  // Emojibase intentionally leaves them uncategorized
  const categoryId = EMOJIBASE_GROUP_ID_TO_CATEGORY[emoji.group] ?? (isRegionalIndicator(emoji.unicode) ? "symbols" : null);
  if (DATA_BY_CATEGORY.hasOwnProperty(categoryId)) {
    DATA_BY_CATEGORY[categoryId].push(emoji);
  }

  // Add mapping from unicode to Emoji object
  // The 'unicode' field that we use in emojibase has either
  // VS15 or VS16 appended to any characters that can take
  // variation selectors. Which one it appends depends
  // on whether emojibase considers their type to be 'text' or
  // 'emoji'. We therefore strip any variation chars from strings
  // both when building the map and when looking up.
  UNICODE_TO_EMOJI.set(stripVariation(emoji.unicode), emoji);
  if (emoji.emoticon) {
    // Add mapping from emoticon to Emoji object
    Array.isArray(emoji.emoticon) ? emoji.emoticon.forEach(x => EMOTICON_TO_EMOJI.set(x, emoji)) : EMOTICON_TO_EMOJI.set(emoji.emoticon, emoji);
  }
  return emoji;
});

/**
 * Strips variation selectors from the end of given string
 * NB. Skin tone modifiers are not variation selectors:
 * this function does not touch them. (Should it?)
 *
 * @param {string} str string to strip
 * @returns {string} stripped string
 */
exports.EMOJI = EMOJI;
function stripVariation(str) {
  return str.replace(/[\uFE00-\uFE0F]$/, "");
}
//# sourceMappingURL=emoji.js.map