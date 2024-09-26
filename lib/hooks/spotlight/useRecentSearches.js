"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useRecentSearches = void 0;
var _react = require("react");
var _MatrixClientPeg = require("../../MatrixClientPeg");
var _SettingLevel = require("../../settings/SettingLevel");
var _SettingsStore = _interopRequireDefault(require("../../settings/SettingsStore"));
var _arrays = require("../../utils/arrays");
/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

const useRecentSearches = () => {
  const [rooms, setRooms] = (0, _react.useState)(() => {
    const cli = _MatrixClientPeg.MatrixClientPeg.get();
    const recents = _SettingsStore.default.getValue("SpotlightSearch.recentSearches", null);
    return (0, _arrays.filterBoolean)(recents.map(r => cli.getRoom(r)));
  });
  return [rooms, () => {
    _SettingsStore.default.setValue("SpotlightSearch.recentSearches", null, _SettingLevel.SettingLevel.ACCOUNT, []);
    setRooms([]);
  }];
};
exports.useRecentSearches = useRecentSearches;
//# sourceMappingURL=useRecentSearches.js.map