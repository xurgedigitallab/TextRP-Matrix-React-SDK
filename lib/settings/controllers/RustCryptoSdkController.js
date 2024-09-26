"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _languageHandler = require("../../languageHandler");
var _SettingController = _interopRequireDefault(require("./SettingController"));
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

class RustCryptoSdkController extends _SettingController.default {
  get settingDisabled() {
    // Currently this can only be changed via config.json. In future, we'll allow the user to *enable* this setting
    // via labs, which will migrate their existing device to the rust-sdk implementation.
    return (0, _languageHandler._t)("Can currently only be enabled via config.json");
  }
}
exports.default = RustCryptoSdkController;
//# sourceMappingURL=RustCryptoSdkController.js.map