"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.showToast = exports.hideToast = void 0;
var _languageHandler = require("../languageHandler");
var _Notifier = _interopRequireDefault(require("../Notifier"));
var _GenericToast = _interopRequireDefault(require("../components/views/toasts/GenericToast"));
var _ToastStore = _interopRequireDefault(require("../stores/ToastStore"));
var _MatrixClientPeg = require("../MatrixClientPeg");
var _notifications = require("../utils/notifications");
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

const onAccept = () => {
  _Notifier.default.setEnabled(true);
  const cli = _MatrixClientPeg.MatrixClientPeg.get();
  const eventType = (0, _notifications.getLocalNotificationAccountDataEventType)(cli.deviceId);
  cli.setAccountData(eventType, {
    is_silenced: false
  });
};
const onReject = () => {
  _Notifier.default.setPromptHidden(true);
};
const TOAST_KEY = "desktopnotifications";
const showToast = fromMessageSend => {
  _ToastStore.default.sharedInstance().addOrReplaceToast({
    key: TOAST_KEY,
    title: fromMessageSend ? (0, _languageHandler._t)("Don't miss a reply") : (0, _languageHandler._t)("Notifications"),
    props: {
      description: (0, _languageHandler._t)("Enable desktop notifications"),
      acceptLabel: (0, _languageHandler._t)("Enable"),
      onAccept,
      rejectLabel: (0, _languageHandler._t)("Dismiss"),
      onReject
    },
    component: _GenericToast.default,
    priority: 30
  });
};
exports.showToast = showToast;
const hideToast = () => {
  _ToastStore.default.sharedInstance().dismissToast(TOAST_KEY);
};
exports.hideToast = hideToast;
//# sourceMappingURL=DesktopNotificationsToast.js.map