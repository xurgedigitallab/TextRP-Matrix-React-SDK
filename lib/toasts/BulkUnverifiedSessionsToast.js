"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.showToast = exports.hideToast = void 0;
var _languageHandler = require("../languageHandler");
var _dispatcher = _interopRequireDefault(require("../dispatcher/dispatcher"));
var _DeviceListener = _interopRequireDefault(require("../DeviceListener"));
var _GenericToast = _interopRequireDefault(require("../components/views/toasts/GenericToast"));
var _ToastStore = _interopRequireDefault(require("../stores/ToastStore"));
var _actions = require("../dispatcher/actions");
var _snoozeBulkUnverifiedDeviceReminder = require("../utils/device/snoozeBulkUnverifiedDeviceReminder");
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

const TOAST_KEY = "reviewsessions";
const showToast = deviceIds => {
  const onAccept = () => {
    _DeviceListener.default.sharedInstance().dismissUnverifiedSessions(deviceIds);
    _dispatcher.default.dispatch({
      action: _actions.Action.ViewUserDeviceSettings
    });
  };
  const onReject = () => {
    _DeviceListener.default.sharedInstance().dismissUnverifiedSessions(deviceIds);
    (0, _snoozeBulkUnverifiedDeviceReminder.snoozeBulkUnverifiedDeviceReminder)();
  };
  _ToastStore.default.sharedInstance().addOrReplaceToast({
    key: TOAST_KEY,
    title: (0, _languageHandler._t)("You have unverified sessions"),
    icon: "verification_warning",
    props: {
      description: (0, _languageHandler._t)("Review to ensure your account is safe"),
      acceptLabel: (0, _languageHandler._t)("Review"),
      onAccept,
      rejectLabel: (0, _languageHandler._t)("Later"),
      onReject
    },
    component: _GenericToast.default,
    priority: 50
  });
};
exports.showToast = showToast;
const hideToast = () => {
  _ToastStore.default.sharedInstance().dismissToast(TOAST_KEY);
};
exports.hideToast = hideToast;
//# sourceMappingURL=BulkUnverifiedSessionsToast.js.map