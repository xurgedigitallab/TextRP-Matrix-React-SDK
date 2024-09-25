"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FontWatcher = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _dispatcher = _interopRequireDefault(require("../../dispatcher/dispatcher"));
var _SettingsStore = _interopRequireDefault(require("../SettingsStore"));
var _units = require("../../utils/units");
var _actions = require("../../dispatcher/actions");
var _SettingLevel = require("../SettingLevel");
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

class FontWatcher {
  constructor() {
    (0, _defineProperty2.default)(this, "dispatcherRef", void 0);
    (0, _defineProperty2.default)(this, "onAction", payload => {
      if (payload.action === _actions.Action.UpdateFontSize) {
        this.setRootFontSize(payload.size);
      } else if (payload.action === _actions.Action.UpdateSystemFont) {
        this.setSystemFont(payload);
      } else if (payload.action === _actions.Action.OnLoggedOut) {
        // Clear font overrides when logging out
        this.setRootFontSize(FontWatcher.DEFAULT_SIZE);
        this.setSystemFont({
          useSystemFont: false,
          font: ""
        });
      } else if (payload.action === _actions.Action.OnLoggedIn) {
        // Font size can be saved on the account, so grab value when logging in
        this.updateFont();
      }
    });
    (0, _defineProperty2.default)(this, "setRootFontSize", size => {
      const fontSize = Math.max(Math.min(FontWatcher.MAX_SIZE, size), FontWatcher.MIN_SIZE);
      if (fontSize !== size) {
        _SettingsStore.default.setValue("baseFontSize", null, _SettingLevel.SettingLevel.DEVICE, fontSize);
      }
      document.querySelector(":root").style.fontSize = (0, _units.toPx)(fontSize);
    });
    (0, _defineProperty2.default)(this, "setSystemFont", _ref => {
      let {
        useSystemFont,
        font
      } = _ref;
      if (useSystemFont) {
        // Make sure that fonts with spaces in their names get interpreted properly
        document.body.style.fontFamily = font.split(",").map(font => {
          font = font.trim();
          if (!font.startsWith('"') && !font.endsWith('"')) {
            font = `"${font}"`;
          }
          return font;
        }).join(",");
      } else {
        document.body.style.fontFamily = "";
      }
    });
    this.dispatcherRef = null;
  }
  start() {
    this.updateFont();
    this.dispatcherRef = _dispatcher.default.register(this.onAction);
  }
  stop() {
    if (!this.dispatcherRef) return;
    _dispatcher.default.unregister(this.dispatcherRef);
  }
  updateFont() {
    this.setRootFontSize(_SettingsStore.default.getValue("baseFontSize"));
    this.setSystemFont({
      useSystemFont: _SettingsStore.default.getValue("useSystemFont"),
      font: _SettingsStore.default.getValue("systemFont")
    });
  }
}
exports.FontWatcher = FontWatcher;
(0, _defineProperty2.default)(FontWatcher, "MIN_SIZE", 8);
(0, _defineProperty2.default)(FontWatcher, "DEFAULT_SIZE", 10);
(0, _defineProperty2.default)(FontWatcher, "MAX_SIZE", 15);
// Externally we tell the user the font is size 15. Internally we use 10.
(0, _defineProperty2.default)(FontWatcher, "SIZE_DIFF", 5);
//# sourceMappingURL=FontWatcher.js.map