"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _SettingController = _interopRequireDefault(require("./SettingController"));
var _SettingsStore = _interopRequireDefault(require("../SettingsStore"));
var _dispatcher = _interopRequireDefault(require("../../dispatcher/dispatcher"));
var _actions = require("../../dispatcher/actions");
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

class UseSystemFontController extends _SettingController.default {
  constructor() {
    super();
  }
  onChange(level, roomId, newValue) {
    // Dispatch font size change so that everything open responds to the change.
    _dispatcher.default.dispatch({
      action: _actions.Action.UpdateSystemFont,
      useSystemFont: newValue,
      font: _SettingsStore.default.getValue("systemFont")
    });
  }
}
exports.default = UseSystemFontController;
//# sourceMappingURL=UseSystemFontController.js.map