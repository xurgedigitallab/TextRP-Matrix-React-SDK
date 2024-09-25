"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
/*
Copyright 2019 New Vector Ltd
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

class AutocompleteWrapperModel {
  constructor(updateCallback, getAutocompleterComponent, updateQuery, partCreator) {
    this.updateCallback = updateCallback;
    this.getAutocompleterComponent = getAutocompleterComponent;
    this.updateQuery = updateQuery;
    this.partCreator = partCreator;
    (0, _defineProperty2.default)(this, "partIndex", void 0);
  }
  onEscape(e) {
    this.getAutocompleterComponent()?.onEscape(e);
  }
  close() {
    this.updateCallback({
      close: true
    });
  }
  hasSelection() {
    return !!this.getAutocompleterComponent()?.hasSelection();
  }
  hasCompletions() {
    const ac = this.getAutocompleterComponent();
    return !!ac && ac.countCompletions() > 0;
  }
  confirmCompletion() {
    this.getAutocompleterComponent()?.onConfirmCompletion();
    this.updateCallback({
      close: true
    });
  }

  /**
   * If there is no current autocompletion, start one and move to the first selection.
   */
  async startSelection() {
    const acComponent = this.getAutocompleterComponent();
    if (acComponent && acComponent.countCompletions() === 0) {
      // Force completions to show for the text currently entered
      await acComponent.forceComplete();
    }
  }
  selectPreviousSelection() {
    this.getAutocompleterComponent()?.moveSelection(-1);
  }
  selectNextSelection() {
    this.getAutocompleterComponent()?.moveSelection(+1);
  }
  onPartUpdate(part, pos) {
    this.partIndex = pos.index;
    return this.updateQuery(part.text);
  }
  onComponentConfirm(completion) {
    this.updateCallback({
      replaceParts: this.partForCompletion(completion),
      close: true
    });
  }
  partForCompletion(completion) {
    const {
      completionId
    } = completion;
    const text = completion.completion;
    switch (completion.type) {
      case "room":
        return [this.partCreator.roomPill(text, completionId), this.partCreator.plain(completion.suffix || "")];
      case "at-room":
        return [this.partCreator.atRoomPill(completionId || ""), this.partCreator.plain(completion.suffix || "")];
      case "user":
        // Insert suffix only if the pill is the part with index 0 - we are at the start of the composer
        return this.partCreator.createMentionParts(this.partIndex === 0, text, completionId || "");
      case "command":
        // command needs special handling for auto complete, but also renders as plain texts
        return [this.partCreator.command(text)];
      default:
        // used for emoji and other plain text completion replacement
        return this.partCreator.plainWithEmoji(text);
    }
  }
}
exports.default = AutocompleteWrapperModel;
//# sourceMappingURL=autocomplete.js.map