"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.LegacyCallHangupEvent = void 0;
var _utils = require("./utils");
var _languageHandler = require("../../../languageHandler");
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

class LegacyCallHangupEvent {
  getTextFor(event, tagId) {
    if ((0, _utils.shouldPrefixMessagesIn)(event.getRoomId(), tagId)) {
      if ((0, _utils.isSelf)(event)) {
        return (0, _languageHandler._t)("You ended the call");
      } else {
        return (0, _languageHandler._t)("%(senderName)s ended the call", {
          senderName: (0, _utils.getSenderName)(event)
        });
      }
    } else {
      return (0, _languageHandler._t)("Call ended");
    }
  }
}
exports.LegacyCallHangupEvent = LegacyCallHangupEvent;
//# sourceMappingURL=LegacyCallHangupEvent.js.map