"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ReactionEventPreview = void 0;
var _utils = require("./utils");
var _languageHandler = require("../../../languageHandler");
var _MatrixClientPeg = require("../../../MatrixClientPeg");
var _MessagePreviewStore = require("../MessagePreviewStore");
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

class ReactionEventPreview {
  getTextFor(event, tagId, isThread) {
    const roomId = event.getRoomId();
    if (!roomId) return null; // not a room event

    const relation = event.getRelation();
    if (!relation) return null; // invalid reaction (probably redacted)

    const reaction = relation.key;
    if (!reaction) return null; // invalid reaction (unknown format)

    const cli = _MatrixClientPeg.MatrixClientPeg.get();
    const room = cli?.getRoom(roomId);
    const relatedEvent = relation.event_id ? room?.findEventById(relation.event_id) : null;
    if (!relatedEvent) return null;
    const message = _MessagePreviewStore.MessagePreviewStore.instance.generatePreviewForEvent(relatedEvent);
    if ((0, _utils.isSelf)(event)) {
      return (0, _languageHandler._t)("You reacted %(reaction)s to %(message)s", {
        reaction,
        message
      });
    }
    return (0, _languageHandler._t)("%(sender)s reacted %(reaction)s to %(message)s", {
      sender: (0, _utils.getSenderName)(event),
      reaction,
      message
    });
  }
}
exports.ReactionEventPreview = ReactionEventPreview;
//# sourceMappingURL=ReactionEventPreview.js.map