"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.StandardActions = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _NotificationUtils = require("./NotificationUtils");
/*
Copyright 2016 OpenMarket Ltd
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

const encodeActions = _NotificationUtils.NotificationUtils.encodeActions;
class StandardActions {}
exports.StandardActions = StandardActions;
(0, _defineProperty2.default)(StandardActions, "ACTION_NOTIFY", encodeActions({
  notify: true
}));
(0, _defineProperty2.default)(StandardActions, "ACTION_NOTIFY_DEFAULT_SOUND", encodeActions({
  notify: true,
  sound: "default"
}));
(0, _defineProperty2.default)(StandardActions, "ACTION_NOTIFY_RING_SOUND", encodeActions({
  notify: true,
  sound: "ring"
}));
(0, _defineProperty2.default)(StandardActions, "ACTION_HIGHLIGHT", encodeActions({
  notify: true,
  highlight: true
}));
(0, _defineProperty2.default)(StandardActions, "ACTION_HIGHLIGHT_DEFAULT_SOUND", encodeActions({
  notify: true,
  sound: "default",
  highlight: true
}));
(0, _defineProperty2.default)(StandardActions, "ACTION_DONT_NOTIFY", encodeActions({
  notify: false
}));
(0, _defineProperty2.default)(StandardActions, "ACTION_DISABLED", undefined);
//# sourceMappingURL=StandardActions.js.map