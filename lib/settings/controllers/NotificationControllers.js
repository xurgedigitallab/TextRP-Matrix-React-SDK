"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.NotificationsEnabledController = exports.NotificationBodyEnabledController = void 0;
exports.isPushNotifyDisabled = isPushNotifyDisabled;
var _logger = require("matrix-js-sdk/src/logger");
var _pushprocessor = require("matrix-js-sdk/src/pushprocessor");
var _PushRules = require("matrix-js-sdk/src/@types/PushRules");
var _SettingController = _interopRequireDefault(require("./SettingController"));
var _MatrixClientPeg = require("../../MatrixClientPeg");
/*
Copyright 2017 Travis Ralston
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

// XXX: This feels wrong.

// .m.rule.master being enabled means all events match that push rule
// default action on this rule is dont_notify, but it could be something else
function isPushNotifyDisabled() {
  // Return the value of the master push rule as a default
  const processor = new _pushprocessor.PushProcessor(_MatrixClientPeg.MatrixClientPeg.get());
  const masterRule = processor.getPushRuleById(".m.rule.master");
  if (!masterRule) {
    _logger.logger.warn("No master push rule! Notifications are disabled for this user.");
    return true;
  }

  // If the rule is enabled then check it does not notify on everything
  return masterRule.enabled && !masterRule.actions.includes(_PushRules.PushRuleActionName.Notify);
}
function getNotifier() {
  // TODO: [TS] Formal type that doesn't cause a cyclical reference.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  let Notifier = require("../../Notifier"); // avoids cyclical references
  if (Notifier.default) Notifier = Notifier.default; // correct for webpack require() weirdness
  return Notifier;
}
class NotificationsEnabledController extends _SettingController.default {
  getValueOverride(level, roomId, calculatedValue, calculatedAtLevel) {
    if (!getNotifier().isPossible()) return false;
    if (calculatedValue === null || calculatedAtLevel === "default") {
      return !isPushNotifyDisabled();
    }
    return calculatedValue;
  }
  onChange(level, roomId, newValue) {
    if (getNotifier().supportsDesktopNotifications()) {
      getNotifier().setEnabled(newValue);
    }
  }
}
exports.NotificationsEnabledController = NotificationsEnabledController;
class NotificationBodyEnabledController extends _SettingController.default {
  getValueOverride(level, roomId, calculatedValue) {
    if (!getNotifier().isPossible()) return false;
    if (calculatedValue === null) {
      return !isPushNotifyDisabled();
    }
    return calculatedValue;
  }
}
exports.NotificationBodyEnabledController = NotificationBodyEnabledController;
//# sourceMappingURL=NotificationControllers.js.map