"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _SettingController = _interopRequireDefault(require("./SettingController"));
var _theme = require("../../theme");
/*
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
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

class ThemeController extends _SettingController.default {
  getValueOverride(level, roomId, calculatedValue, calculatedAtLevel) {
    if (!calculatedValue) return null; // Don't override null themes

    if (ThemeController.isLogin) return "light";
    const themes = (0, _theme.enumerateThemes)();
    // Override in case some no longer supported theme is stored here
    if (!themes[calculatedValue]) {
      return _theme.DEFAULT_THEME;
    }
    return null; // no override
  }
}
exports.default = ThemeController;
(0, _defineProperty2.default)(ThemeController, "isLogin", false);
//# sourceMappingURL=ThemeController.js.map