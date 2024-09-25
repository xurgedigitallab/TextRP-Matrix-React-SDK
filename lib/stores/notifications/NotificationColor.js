"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.NotificationColor = void 0;
exports.humanReadableNotificationColor = humanReadableNotificationColor;
var _languageHandler = require("../../languageHandler");
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
let NotificationColor = /*#__PURE__*/function (NotificationColor) {
  NotificationColor[NotificationColor["Muted"] = 0] = "Muted";
  NotificationColor[NotificationColor["None"] = 1] = "None";
  NotificationColor[NotificationColor["Bold"] = 2] = "Bold";
  NotificationColor[NotificationColor["Grey"] = 3] = "Grey";
  NotificationColor[NotificationColor["Red"] = 4] = "Red";
  NotificationColor[NotificationColor["Unsent"] = 5] = "Unsent";
  return NotificationColor;
}({}); // some messages failed to send
exports.NotificationColor = NotificationColor;
function humanReadableNotificationColor(color) {
  switch (color) {
    case NotificationColor.None:
      return (0, _languageHandler._t)("None");
    case NotificationColor.Bold:
      return (0, _languageHandler._t)("Bold");
    case NotificationColor.Grey:
      return (0, _languageHandler._t)("Grey");
    case NotificationColor.Red:
      return (0, _languageHandler._t)("Red");
    case NotificationColor.Unsent:
      return (0, _languageHandler._t)("Unsent");
    default:
      return (0, _languageHandler._t)("unknown");
  }
}
//# sourceMappingURL=NotificationColor.js.map