"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.viewUserDeviceSettings = void 0;
var _UserTab = require("../../components/views/dialogs/UserTab");
var _actions = require("../../dispatcher/actions");
var _dispatcher = _interopRequireDefault(require("../../dispatcher/dispatcher"));
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

/**
 * Open user device manager settings
 */
const viewUserDeviceSettings = () => {
  _dispatcher.default.dispatch({
    action: _actions.Action.ViewUserSettings,
    initialTabId: _UserTab.UserTab.SessionManager
  });
};
exports.viewUserDeviceSettings = viewUserDeviceSettings;
//# sourceMappingURL=viewUserDeviceSettings.js.map