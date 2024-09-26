"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PollStartEventPreview = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _InvalidEventError = require("matrix-js-sdk/src/extensible_events_v1/InvalidEventError");
var _PollStartEvent = require("matrix-js-sdk/src/extensible_events_v1/PollStartEvent");
var _languageHandler = require("../../../languageHandler");
var _utils = require("./utils");
var _MatrixClientContext = _interopRequireDefault(require("../../../contexts/MatrixClientContext"));
/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

class PollStartEventPreview {
  constructor() {
    (0, _defineProperty2.default)(this, "context", void 0);
  }
  getTextFor(event, tagId, isThread) {
    let eventContent = event.getContent();
    if (event.isRelation("m.replace")) {
      // It's an edit, generate the preview on the new text
      eventContent = event.getContent()["m.new_content"];
    }

    // Check we have the information we need, and bail out if not
    if (!eventContent) {
      return null;
    }
    try {
      const poll = new _PollStartEvent.PollStartEvent({
        type: event.getType(),
        content: eventContent
      });
      let question = poll.question.text.trim();
      question = (0, _languageHandler.sanitizeForTranslation)(question);
      if (isThread || (0, _utils.isSelf)(event) || !(0, _utils.shouldPrefixMessagesIn)(event.getRoomId(), tagId)) {
        return question;
      } else {
        return (0, _languageHandler._t)("%(senderName)s: %(message)s", {
          senderName: (0, _utils.getSenderName)(event),
          message: question
        });
      }
    } catch (e) {
      if (e instanceof _InvalidEventError.InvalidEventError) {
        return null;
      }
      throw e; // re-throw unknown errors
    }
  }
}
exports.PollStartEventPreview = PollStartEventPreview;
(0, _defineProperty2.default)(PollStartEventPreview, "contextType", _MatrixClientContext.default);
//# sourceMappingURL=PollStartEventPreview.js.map