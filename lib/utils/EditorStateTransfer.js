"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
/*
Copyright 2019 - 2021 The Matrix.org Foundation C.I.C.

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

/**
 * Used while editing, to pass the event, and to preserve editor state
 * from one editor instance to another when remounting the editor
 * upon receiving the remote echo for an unsent event.
 */
class EditorStateTransfer {
  constructor(event) {
    this.event = event;
    (0, _defineProperty2.default)(this, "serializedParts", null);
    (0, _defineProperty2.default)(this, "caret", null);
  }
  setEditorState(caret, serializedParts) {
    this.caret = caret;
    this.serializedParts = serializedParts;
  }
  hasEditorState() {
    return !!this.serializedParts;
  }
  getSerializedParts() {
    return this.serializedParts;
  }
  getCaret() {
    return this.caret;
  }
  getEvent() {
    return this.event;
  }
}
exports.default = EditorStateTransfer;
//# sourceMappingURL=EditorStateTransfer.js.map