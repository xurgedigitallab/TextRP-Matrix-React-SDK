"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _SettingController = _interopRequireDefault(require("./SettingController"));
var _PlatformPeg = _interopRequireDefault(require("../../PlatformPeg"));
var _SlidingSyncOptionsDialog = require("../../components/views/dialogs/SlidingSyncOptionsDialog");
var _Modal = _interopRequireDefault(require("../../Modal"));
var _SettingsStore = _interopRequireDefault(require("../SettingsStore"));
var _languageHandler = require("../../languageHandler");
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

class SlidingSyncController extends _SettingController.default {
  async beforeChange(level, roomId, newValue) {
    const {
      finished
    } = _Modal.default.createDialog(_SlidingSyncOptionsDialog.SlidingSyncOptionsDialog);
    const [value] = await finished;
    return newValue === value; // abort the operation if we're already in the state the user chose via modal
  }

  async onChange() {
    _PlatformPeg.default.get()?.reload();
  }
  get settingDisabled() {
    // Cannot be disabled once enabled, user has been warned and must log out and back in.
    if (_SettingsStore.default.getValue("feature_sliding_sync")) {
      return (0, _languageHandler._t)("Log out and back in to disable");
    }
    return false;
  }
}
exports.default = SlidingSyncController;
//# sourceMappingURL=SlidingSyncController.js.map