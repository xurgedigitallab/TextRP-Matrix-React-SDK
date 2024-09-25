"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.add = add;
exports.get = get;
var _lodash = require("lodash");
var _SettingsStore = _interopRequireDefault(require("../settings/SettingsStore"));
var _SettingLevel = require("../settings/SettingLevel");
/*
Copyright 2019 Tulir Asokan <tulir@maunium.net>
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

// New format tries to be more space efficient for synchronization. Ordered by Date descending.
// [emoji, count]

const SETTING_NAME = "recent_emoji";

// we store more recents than we typically query but this lets us sort by weighted usage
// even if you haven't used your typically favourite emoji for a little while.
const STORAGE_LIMIT = 100;

// TODO remove this after some time
function migrate() {
  const data = JSON.parse(window.localStorage.mx_reaction_count || "{}");
  const sorted = Object.entries(data).sort((_ref, _ref2) => {
    let [, [count1, date1]] = _ref;
    let [, [count2, date2]] = _ref2;
    return date2 - date1;
  });
  const newFormat = sorted.map(_ref3 => {
    let [emoji, [count, date]] = _ref3;
    return [emoji, count];
  });
  _SettingsStore.default.setValue(SETTING_NAME, null, _SettingLevel.SettingLevel.ACCOUNT, newFormat.slice(0, STORAGE_LIMIT));
}
function getRecentEmoji() {
  return _SettingsStore.default.getValue(SETTING_NAME) || [];
}
function add(emoji) {
  const recents = getRecentEmoji();
  const i = recents.findIndex(_ref4 => {
    let [e] = _ref4;
    return e === emoji;
  });
  let newEntry;
  if (i >= 0) {
    // first remove the existing tuple so that we can increment it and push it to the front
    [newEntry] = recents.splice(i, 1);
    newEntry[1]++; // increment the usage count
  } else {
    newEntry = [emoji, 1];
  }
  _SettingsStore.default.setValue(SETTING_NAME, null, _SettingLevel.SettingLevel.ACCOUNT, [newEntry, ...recents].slice(0, STORAGE_LIMIT));
}
function get() {
  let limit = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 24;
  let recents = getRecentEmoji();
  if (recents.length < 1) {
    migrate();
    recents = getRecentEmoji();
  }

  // perform a stable sort on `count` to keep the recent (date) order as a secondary sort factor
  const sorted = (0, _lodash.orderBy)(recents, "1", "desc");
  return sorted.slice(0, limit).map(_ref5 => {
    let [emoji] = _ref5;
    return emoji;
  });
}
//# sourceMappingURL=recent.js.map