"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.shouldShowFeedback = shouldShowFeedback;
var _SdkConfig = _interopRequireDefault(require("../SdkConfig"));
var _SettingsStore = _interopRequireDefault(require("../settings/SettingsStore"));
var _UIFeature = require("../settings/UIFeature");
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

function shouldShowFeedback() {
  return !!_SdkConfig.default.get().bug_report_endpoint_url && _SettingsStore.default.getValue(_UIFeature.UIFeature.Feedback);
}
//# sourceMappingURL=Feedback.js.map