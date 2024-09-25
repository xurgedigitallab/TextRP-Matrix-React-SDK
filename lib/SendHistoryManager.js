"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _lodash = require("lodash");
var _logger = require("matrix-js-sdk/src/logger");
/*
Copyright 2017 Aviral Dasgupta

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

class SendHistoryManager {
  // used for indexing the loaded validated history Array

  constructor(roomId, prefix) {
    (0, _defineProperty2.default)(this, "history", []);
    (0, _defineProperty2.default)(this, "prefix", void 0);
    (0, _defineProperty2.default)(this, "lastIndex", 0);
    // used for indexing the storage
    (0, _defineProperty2.default)(this, "currentIndex", 0);
    this.prefix = prefix + roomId;

    // TODO: Performance issues?
    let index = 0;
    let itemJSON;
    while (itemJSON = sessionStorage.getItem(`${this.prefix}[${index}]`)) {
      try {
        this.history.push(JSON.parse(itemJSON));
      } catch (e) {
        _logger.logger.warn("Throwing away unserialisable history", e);
        break;
      }
      ++index;
    }
    this.lastIndex = this.history.length - 1;
    // reset currentIndex to account for any unserialisable history
    this.currentIndex = this.lastIndex + 1;
  }
  static createItem(model, replyEvent) {
    return {
      parts: model.serializeParts(),
      replyEventId: replyEvent ? replyEvent.getId() : undefined
    };
  }
  save(editorModel, replyEvent) {
    const item = SendHistoryManager.createItem(editorModel, replyEvent);
    this.history.push(item);
    this.currentIndex = this.history.length;
    this.lastIndex += 1;
    sessionStorage.setItem(`${this.prefix}[${this.lastIndex}]`, JSON.stringify(item));
  }
  getItem(offset) {
    this.currentIndex = (0, _lodash.clamp)(this.currentIndex + offset, 0, this.history.length - 1);
    return this.history[this.currentIndex];
  }
}
exports.default = SendHistoryManager;
//# sourceMappingURL=SendHistoryManager.js.map