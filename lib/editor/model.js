"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _diff = require("./diff");
var _position = _interopRequireDefault(require("./position"));
var _range = _interopRequireDefault(require("./range"));
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

/**
 * @callback ModelCallback
 * @param {DocumentPosition?} caretPosition the position where the caret should be position
 * @param {string?} inputType the inputType of the DOM input event
 * @param {object?} diff an object with `removed` and `added` strings
 */

/**
 * @callback TransformCallback
 * @param {DocumentPosition?} caretPosition the position where the caret should be position
 * @param {string?} inputType the inputType of the DOM input event
 * @param {object?} diff an object with `removed` and `added` strings
 * @return {Number?} addedLen how many characters were added/removed (-) before the caret during the transformation step.
 *    This is used to adjust the caret position.
 */
/**
 * @callback ManualTransformCallback
 * @return the caret position
 */
class EditorModel {
  constructor(parts, partCreator) {
    let updateCallback = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
    this.updateCallback = updateCallback;
    (0, _defineProperty2.default)(this, "_parts", void 0);
    (0, _defineProperty2.default)(this, "_partCreator", void 0);
    (0, _defineProperty2.default)(this, "activePartIdx", null);
    (0, _defineProperty2.default)(this, "_autoComplete", null);
    (0, _defineProperty2.default)(this, "autoCompletePartIdx", null);
    (0, _defineProperty2.default)(this, "autoCompletePartCount", 0);
    (0, _defineProperty2.default)(this, "transformCallback", null);
    (0, _defineProperty2.default)(this, "onAutoComplete", _ref => {
      let {
        replaceParts,
        close
      } = _ref;
      let pos;
      if (replaceParts) {
        const autoCompletePartIdx = this.autoCompletePartIdx || 0;
        this._parts.splice(autoCompletePartIdx, this.autoCompletePartCount, ...replaceParts);
        this.autoCompletePartCount = replaceParts.length;
        const lastPart = replaceParts[replaceParts.length - 1];
        const lastPartIndex = autoCompletePartIdx + replaceParts.length - 1;
        pos = new _position.default(lastPartIndex, lastPart.text.length);
      }
      if (close) {
        this._autoComplete = null;
        this.autoCompletePartIdx = null;
        this.autoCompletePartCount = 0;
      }
      // rerender even if editor contents didn't change
      // to make sure the MessageEditor checks
      // model.autoComplete being empty and closes it
      this.updateCallback?.(pos);
    });
    this._parts = parts;
    this._partCreator = partCreator;
    this.transformCallback = null;
  }

  /**
   * Set a callback for the transformation step.
   * While processing an update, right before calling the update callback,
   * a transform callback can be called, which serves to do modifications
   * on the model that can span multiple parts. Also see `startRange()`.
   * @param {TransformCallback} transformCallback
   */
  setTransformCallback(transformCallback) {
    this.transformCallback = transformCallback;
  }

  /**
   * Set a callback for rerendering the model after it has been updated.
   * @param {ModelCallback} updateCallback
   */
  setUpdateCallback(updateCallback) {
    this.updateCallback = updateCallback;
  }
  get partCreator() {
    return this._partCreator;
  }
  get isEmpty() {
    return this._parts.reduce((len, part) => len + part.text.length, 0) === 0;
  }
  clone() {
    const clonedParts = this.parts.map(p => this.partCreator.deserializePart(p.serialize())).filter(p => Boolean(p));
    return new EditorModel(clonedParts, this._partCreator, this.updateCallback);
  }
  insertPart(index, part) {
    this._parts.splice(index, 0, part);
    if (this.activePartIdx !== null && this.activePartIdx >= index) {
      ++this.activePartIdx;
    }
    if (this.autoCompletePartIdx !== null && this.autoCompletePartIdx >= index) {
      ++this.autoCompletePartIdx;
    }
  }
  removePart(index) {
    this._parts.splice(index, 1);
    if (index === this.activePartIdx) {
      this.activePartIdx = null;
    } else if (this.activePartIdx !== null && this.activePartIdx > index) {
      --this.activePartIdx;
    }
    if (index === this.autoCompletePartIdx) {
      this.autoCompletePartIdx = null;
    } else if (this.autoCompletePartIdx !== null && this.autoCompletePartIdx > index) {
      --this.autoCompletePartIdx;
    }
  }
  replacePart(index, part) {
    this._parts.splice(index, 1, part);
  }
  get parts() {
    return this._parts;
  }
  get autoComplete() {
    if (this.activePartIdx === this.autoCompletePartIdx) {
      return this._autoComplete;
    }
    return null;
  }
  getPositionAtEnd() {
    if (this._parts.length) {
      const index = this._parts.length - 1;
      const part = this._parts[index];
      return new _position.default(index, part.text.length);
    } else {
      // part index -1, as there are no parts to point at
      return new _position.default(-1, 0);
    }
  }
  serializeParts() {
    return this._parts.map(p => p.serialize());
  }
  diff(newValue, inputType, caret) {
    const previousValue = this.parts.reduce((text, p) => text + p.text, "");
    // can't use caret position with drag and drop
    if (inputType === "deleteByDrag") {
      return (0, _diff.diffDeletion)(previousValue, newValue);
    } else {
      return (0, _diff.diffAtCaret)(previousValue, newValue, caret.offset);
    }
  }
  reset(serializedParts, caret, inputType) {
    this._parts = serializedParts.map(p => this._partCreator.deserializePart(p)).filter(p => Boolean(p));
    if (!caret) {
      caret = this.getPositionAtEnd();
    }
    // close auto complete if open
    // this would happen when clearing the composer after sending
    // a message with the autocomplete still open
    if (this._autoComplete) {
      this._autoComplete = null;
      this.autoCompletePartIdx = null;
    }
    this.updateCallback?.(caret, inputType);
  }

  /**
   * Inserts the given parts at the given position.
   * Should be run inside a `model.transform()` callback.
   * @param {Part[]} parts the parts to replace the range with
   * @param {DocumentPosition} position the position to start inserting at
   * @return {Number} the amount of characters added
   */
  insert(parts, position) {
    const insertIndex = this.splitAt(position);
    let newTextLength = 0;
    for (let i = 0; i < parts.length; ++i) {
      const part = parts[i];
      newTextLength += part.text.length;
      this.insertPart(insertIndex + i, part);
    }
    return newTextLength;
  }
  update(newValue, inputType, caret) {
    const diff = this.diff(newValue, inputType, caret);
    const position = this.positionForOffset(diff.at || 0, caret.atNodeEnd);
    let removedOffsetDecrease = 0;
    if (diff.removed) {
      removedOffsetDecrease = this.removeText(position, diff.removed.length);
    }
    let addedLen = 0;
    if (diff.added) {
      addedLen = this.addText(position, diff.added, inputType);
    }
    this.mergeAdjacentParts();
    const caretOffset = (diff.at || 0) - removedOffsetDecrease + addedLen;
    let newPosition = this.positionForOffset(caretOffset, true);
    const canOpenAutoComplete = inputType !== "insertFromPaste" && inputType !== "insertFromDrop";
    const acPromise = this.setActivePart(newPosition, canOpenAutoComplete);
    if (this.transformCallback) {
      const transformAddedLen = this.getTransformAddedLen(newPosition, inputType, diff);
      newPosition = this.positionForOffset(caretOffset + transformAddedLen, true);
    }
    this.updateCallback?.(newPosition, inputType, diff);
    return acPromise;
  }
  getTransformAddedLen(newPosition, inputType, diff) {
    const result = this.transformCallback?.(newPosition, inputType, diff);
    return Number.isFinite(result) ? result : 0;
  }
  setActivePart(pos, canOpenAutoComplete) {
    const {
      index
    } = pos;
    const part = this._parts[index];
    if (part) {
      if (index !== this.activePartIdx) {
        this.activePartIdx = index;
        if (canOpenAutoComplete && this.activePartIdx !== this.autoCompletePartIdx) {
          // else try to create one
          const ac = part.createAutoComplete(this.onAutoComplete);
          if (ac) {
            // make sure that react picks up the difference between both acs
            this._autoComplete = ac;
            this.autoCompletePartIdx = index;
            this.autoCompletePartCount = 1;
          }
        }
      }
      // not autoComplete, only there if active part is autocomplete part
      if (this.autoComplete) {
        return this.autoComplete.onPartUpdate(part, pos);
      }
    } else {
      this.activePartIdx = null;
      this._autoComplete = null;
      this.autoCompletePartIdx = null;
      this.autoCompletePartCount = 0;
    }
    return Promise.resolve();
  }
  mergeAdjacentParts() {
    let prevPart;
    for (let i = 0; i < this._parts.length; ++i) {
      let part = this._parts[i];
      const isEmpty = !part.text.length;
      const isMerged = !isEmpty && prevPart && prevPart.merge?.(part);
      if (isEmpty || isMerged) {
        // remove empty or merged part
        part = prevPart;
        this.removePart(i);
        //repeat this index, as it's removed now
        --i;
      }
      prevPart = part;
    }
  }

  /**
   * removes `len` amount of characters at `pos`.
   * @param {Object} pos
   * @param {Number} len
   * @return {Number} how many characters before pos were also removed,
   * usually because of non-editable parts that can only be removed in their entirety.
   */
  removeText(pos, len) {
    let {
      index,
      offset
    } = pos;
    let removedOffsetDecrease = 0;
    while (len > 0) {
      // part might be undefined here
      let part = this._parts[index];
      const amount = Math.min(len, part.text.length - offset);
      // don't allow 0 amount deletions
      if (amount) {
        if (part.canEdit) {
          const replaceWith = part.remove(offset, amount);
          if (typeof replaceWith === "string") {
            this.replacePart(index, this._partCreator.createDefaultPart(replaceWith));
          }
          part = this._parts[index];
          // remove empty part
          if (!part.text.length) {
            this.removePart(index);
          } else {
            index += 1;
          }
        } else {
          removedOffsetDecrease += offset;
          this.removePart(index);
        }
      } else {
        index += 1;
      }
      len -= amount;
      offset = 0;
    }
    return removedOffsetDecrease;
  }

  // return part index where insertion will insert between at offset
  splitAt(pos) {
    if (pos.index === -1) {
      return 0;
    }
    if (pos.offset === 0) {
      return pos.index;
    }
    const part = this._parts[pos.index];
    if (pos.offset >= part.text.length) {
      return pos.index + 1;
    }
    const secondPart = part.split(pos.offset);
    this.insertPart(pos.index + 1, secondPart);
    return pos.index + 1;
  }

  /**
   * inserts `str` into the model at `pos`.
   * @param {Object} pos
   * @param {string} str
   * @param {string} inputType the source of the input, see html InputEvent.inputType
   * @return {Number} how far from position (in characters) the insertion ended.
   * This can be more than the length of `str` when crossing non-editable parts, which are skipped.
   */
  addText(pos, str, inputType) {
    let {
      index
    } = pos;
    const {
      offset
    } = pos;
    let addLen = str.length;
    const part = this._parts[index];
    let it = str;
    if (part) {
      if (part.canEdit) {
        if (part.validateAndInsert(offset, str, inputType)) {
          it = undefined;
        } else {
          const splitPart = part.split(offset);
          index += 1;
          this.insertPart(index, splitPart);
        }
      } else if (offset !== 0) {
        // not-editable part, caret is not at start,
        // so insert str after this part
        addLen += part.text.length - offset;
        index += 1;
      }
    } else if (index < 0) {
      // if position was not found (index: -1, as happens for empty editor)
      // reset it to insert as first part
      index = 0;
    }
    while (it) {
      const newPart = this._partCreator.createPartForInput(it, index, inputType);
      const oldStr = it;
      it = newPart.appendUntilRejected(it, inputType);
      if (it === oldStr) {
        // nothing changed, break out of this infinite loop and log an error
        console.error(`Failed to update model for input (str ${it}) (type ${inputType})`);
        break;
      }
      this.insertPart(index, newPart);
      index += 1;
    }
    return addLen;
  }
  positionForOffset(totalOffset) {
    let atPartEnd = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    let currentOffset = 0;
    const index = this._parts.findIndex(part => {
      const partLen = part.text.length;
      if (atPartEnd && currentOffset + partLen >= totalOffset || !atPartEnd && currentOffset + partLen > totalOffset) {
        return true;
      }
      currentOffset += partLen;
      return false;
    });
    if (index === -1) {
      return this.getPositionAtEnd();
    } else {
      return new _position.default(index, totalOffset - currentOffset);
    }
  }

  /**
   * Starts a range, which can span across multiple parts, to find and replace text.
   * @param {DocumentPosition} positionA a boundary of the range
   * @param {DocumentPosition?} positionB the other boundary of the range, optional
   * @return {Range}
   */
  startRange(positionA) {
    let positionB = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : positionA;
    return new _range.default(this, positionA, positionB);
  }
  replaceRange(startPosition, endPosition, parts) {
    // convert end position to offset, so it is independent of how the document is split into parts
    // which we'll change when splitting up at the start position
    const endOffset = endPosition.asOffset(this);
    const newStartPartIndex = this.splitAt(startPosition);
    // convert it back to position once split at start
    endPosition = endOffset.asPosition(this);
    const newEndPartIndex = this.splitAt(endPosition);
    for (let i = newEndPartIndex - 1; i >= newStartPartIndex; --i) {
      this.removePart(i);
    }
    let insertIdx = newStartPartIndex;
    for (const part of parts) {
      this.insertPart(insertIdx, part);
      insertIdx += 1;
    }
    this.mergeAdjacentParts();
  }

  /**
   * Performs a transformation not part of an update cycle.
   * Modifying the model should only happen inside a transform call if not part of an update call.
   * @param {ManualTransformCallback} callback to run the transformations in
   * @return {Promise} a promise when auto-complete (if applicable) is done updating
   */
  transform(callback) {
    const pos = callback();
    let acPromise = null;
    if (!(pos instanceof _range.default)) {
      acPromise = this.setActivePart(pos, true);
    } else {
      acPromise = Promise.resolve();
    }
    this.updateCallback?.(pos);
    return acPromise;
  }
}
exports.default = EditorModel;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfZGlmZiIsInJlcXVpcmUiLCJfcG9zaXRpb24iLCJfaW50ZXJvcFJlcXVpcmVEZWZhdWx0IiwiX3JhbmdlIiwiRWRpdG9yTW9kZWwiLCJjb25zdHJ1Y3RvciIsInBhcnRzIiwicGFydENyZWF0b3IiLCJ1cGRhdGVDYWxsYmFjayIsImFyZ3VtZW50cyIsImxlbmd0aCIsInVuZGVmaW5lZCIsIl9kZWZpbmVQcm9wZXJ0eTIiLCJkZWZhdWx0IiwiX3JlZiIsInJlcGxhY2VQYXJ0cyIsImNsb3NlIiwicG9zIiwiYXV0b0NvbXBsZXRlUGFydElkeCIsIl9wYXJ0cyIsInNwbGljZSIsImF1dG9Db21wbGV0ZVBhcnRDb3VudCIsImxhc3RQYXJ0IiwibGFzdFBhcnRJbmRleCIsIkRvY3VtZW50UG9zaXRpb24iLCJ0ZXh0IiwiX2F1dG9Db21wbGV0ZSIsIl9wYXJ0Q3JlYXRvciIsInRyYW5zZm9ybUNhbGxiYWNrIiwic2V0VHJhbnNmb3JtQ2FsbGJhY2siLCJzZXRVcGRhdGVDYWxsYmFjayIsImlzRW1wdHkiLCJyZWR1Y2UiLCJsZW4iLCJwYXJ0IiwiY2xvbmUiLCJjbG9uZWRQYXJ0cyIsIm1hcCIsInAiLCJkZXNlcmlhbGl6ZVBhcnQiLCJzZXJpYWxpemUiLCJmaWx0ZXIiLCJCb29sZWFuIiwiaW5zZXJ0UGFydCIsImluZGV4IiwiYWN0aXZlUGFydElkeCIsInJlbW92ZVBhcnQiLCJyZXBsYWNlUGFydCIsImF1dG9Db21wbGV0ZSIsImdldFBvc2l0aW9uQXRFbmQiLCJzZXJpYWxpemVQYXJ0cyIsImRpZmYiLCJuZXdWYWx1ZSIsImlucHV0VHlwZSIsImNhcmV0IiwicHJldmlvdXNWYWx1ZSIsImRpZmZEZWxldGlvbiIsImRpZmZBdENhcmV0Iiwib2Zmc2V0IiwicmVzZXQiLCJzZXJpYWxpemVkUGFydHMiLCJpbnNlcnQiLCJwb3NpdGlvbiIsImluc2VydEluZGV4Iiwic3BsaXRBdCIsIm5ld1RleHRMZW5ndGgiLCJpIiwidXBkYXRlIiwicG9zaXRpb25Gb3JPZmZzZXQiLCJhdCIsImF0Tm9kZUVuZCIsInJlbW92ZWRPZmZzZXREZWNyZWFzZSIsInJlbW92ZWQiLCJyZW1vdmVUZXh0IiwiYWRkZWRMZW4iLCJhZGRlZCIsImFkZFRleHQiLCJtZXJnZUFkamFjZW50UGFydHMiLCJjYXJldE9mZnNldCIsIm5ld1Bvc2l0aW9uIiwiY2FuT3BlbkF1dG9Db21wbGV0ZSIsImFjUHJvbWlzZSIsInNldEFjdGl2ZVBhcnQiLCJ0cmFuc2Zvcm1BZGRlZExlbiIsImdldFRyYW5zZm9ybUFkZGVkTGVuIiwicmVzdWx0IiwiTnVtYmVyIiwiaXNGaW5pdGUiLCJhYyIsImNyZWF0ZUF1dG9Db21wbGV0ZSIsIm9uQXV0b0NvbXBsZXRlIiwib25QYXJ0VXBkYXRlIiwiUHJvbWlzZSIsInJlc29sdmUiLCJwcmV2UGFydCIsImlzTWVyZ2VkIiwibWVyZ2UiLCJhbW91bnQiLCJNYXRoIiwibWluIiwiY2FuRWRpdCIsInJlcGxhY2VXaXRoIiwicmVtb3ZlIiwiY3JlYXRlRGVmYXVsdFBhcnQiLCJzZWNvbmRQYXJ0Iiwic3BsaXQiLCJzdHIiLCJhZGRMZW4iLCJpdCIsInZhbGlkYXRlQW5kSW5zZXJ0Iiwic3BsaXRQYXJ0IiwibmV3UGFydCIsImNyZWF0ZVBhcnRGb3JJbnB1dCIsIm9sZFN0ciIsImFwcGVuZFVudGlsUmVqZWN0ZWQiLCJjb25zb2xlIiwiZXJyb3IiLCJ0b3RhbE9mZnNldCIsImF0UGFydEVuZCIsImN1cnJlbnRPZmZzZXQiLCJmaW5kSW5kZXgiLCJwYXJ0TGVuIiwic3RhcnRSYW5nZSIsInBvc2l0aW9uQSIsInBvc2l0aW9uQiIsIlJhbmdlIiwicmVwbGFjZVJhbmdlIiwic3RhcnRQb3NpdGlvbiIsImVuZFBvc2l0aW9uIiwiZW5kT2Zmc2V0IiwiYXNPZmZzZXQiLCJuZXdTdGFydFBhcnRJbmRleCIsImFzUG9zaXRpb24iLCJuZXdFbmRQYXJ0SW5kZXgiLCJpbnNlcnRJZHgiLCJ0cmFuc2Zvcm0iLCJjYWxsYmFjayIsImV4cG9ydHMiXSwic291cmNlcyI6WyIuLi8uLi9zcmMvZWRpdG9yL21vZGVsLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qXG5Db3B5cmlnaHQgMjAxOSBOZXcgVmVjdG9yIEx0ZFxuQ29weXJpZ2h0IDIwMTkgVGhlIE1hdHJpeC5vcmcgRm91bmRhdGlvbiBDLkkuQy5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4qL1xuXG5pbXBvcnQgeyBkaWZmQXRDYXJldCwgZGlmZkRlbGV0aW9uLCBJRGlmZiB9IGZyb20gXCIuL2RpZmZcIjtcbmltcG9ydCBEb2N1bWVudFBvc2l0aW9uLCB7IElQb3NpdGlvbiB9IGZyb20gXCIuL3Bvc2l0aW9uXCI7XG5pbXBvcnQgUmFuZ2UgZnJvbSBcIi4vcmFuZ2VcIjtcbmltcG9ydCB7IFNlcmlhbGl6ZWRQYXJ0LCBQYXJ0LCBQYXJ0Q3JlYXRvciB9IGZyb20gXCIuL3BhcnRzXCI7XG5pbXBvcnQgQXV0b2NvbXBsZXRlV3JhcHBlck1vZGVsLCB7IElDYWxsYmFjayB9IGZyb20gXCIuL2F1dG9jb21wbGV0ZVwiO1xuaW1wb3J0IERvY3VtZW50T2Zmc2V0IGZyb20gXCIuL29mZnNldFwiO1xuaW1wb3J0IHsgQ2FyZXQgfSBmcm9tIFwiLi9jYXJldFwiO1xuXG4vKipcbiAqIEBjYWxsYmFjayBNb2RlbENhbGxiYWNrXG4gKiBAcGFyYW0ge0RvY3VtZW50UG9zaXRpb24/fSBjYXJldFBvc2l0aW9uIHRoZSBwb3NpdGlvbiB3aGVyZSB0aGUgY2FyZXQgc2hvdWxkIGJlIHBvc2l0aW9uXG4gKiBAcGFyYW0ge3N0cmluZz99IGlucHV0VHlwZSB0aGUgaW5wdXRUeXBlIG9mIHRoZSBET00gaW5wdXQgZXZlbnRcbiAqIEBwYXJhbSB7b2JqZWN0P30gZGlmZiBhbiBvYmplY3Qgd2l0aCBgcmVtb3ZlZGAgYW5kIGBhZGRlZGAgc3RyaW5nc1xuICovXG5cbi8qKlxuICogQGNhbGxiYWNrIFRyYW5zZm9ybUNhbGxiYWNrXG4gKiBAcGFyYW0ge0RvY3VtZW50UG9zaXRpb24/fSBjYXJldFBvc2l0aW9uIHRoZSBwb3NpdGlvbiB3aGVyZSB0aGUgY2FyZXQgc2hvdWxkIGJlIHBvc2l0aW9uXG4gKiBAcGFyYW0ge3N0cmluZz99IGlucHV0VHlwZSB0aGUgaW5wdXRUeXBlIG9mIHRoZSBET00gaW5wdXQgZXZlbnRcbiAqIEBwYXJhbSB7b2JqZWN0P30gZGlmZiBhbiBvYmplY3Qgd2l0aCBgcmVtb3ZlZGAgYW5kIGBhZGRlZGAgc3RyaW5nc1xuICogQHJldHVybiB7TnVtYmVyP30gYWRkZWRMZW4gaG93IG1hbnkgY2hhcmFjdGVycyB3ZXJlIGFkZGVkL3JlbW92ZWQgKC0pIGJlZm9yZSB0aGUgY2FyZXQgZHVyaW5nIHRoZSB0cmFuc2Zvcm1hdGlvbiBzdGVwLlxuICogICAgVGhpcyBpcyB1c2VkIHRvIGFkanVzdCB0aGUgY2FyZXQgcG9zaXRpb24uXG4gKi9cblxuLyoqXG4gKiBAY2FsbGJhY2sgTWFudWFsVHJhbnNmb3JtQ2FsbGJhY2tcbiAqIEByZXR1cm4gdGhlIGNhcmV0IHBvc2l0aW9uXG4gKi9cblxudHlwZSBUcmFuc2Zvcm1DYWxsYmFjayA9IChjYXJldFBvc2l0aW9uOiBEb2N1bWVudFBvc2l0aW9uLCBpbnB1dFR5cGU6IHN0cmluZyB8IHVuZGVmaW5lZCwgZGlmZjogSURpZmYpID0+IG51bWJlciB8IHZvaWQ7XG50eXBlIFVwZGF0ZUNhbGxiYWNrID0gKGNhcmV0PzogQ2FyZXQsIGlucHV0VHlwZT86IHN0cmluZywgZGlmZj86IElEaWZmKSA9PiB2b2lkO1xudHlwZSBNYW51YWxUcmFuc2Zvcm1DYWxsYmFjayA9ICgpID0+IENhcmV0O1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFZGl0b3JNb2RlbCB7XG4gICAgcHJpdmF0ZSBfcGFydHM6IFBhcnRbXTtcbiAgICBwcml2YXRlIHJlYWRvbmx5IF9wYXJ0Q3JlYXRvcjogUGFydENyZWF0b3I7XG4gICAgcHJpdmF0ZSBhY3RpdmVQYXJ0SWR4OiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgICBwcml2YXRlIF9hdXRvQ29tcGxldGU6IEF1dG9jb21wbGV0ZVdyYXBwZXJNb2RlbCB8IG51bGwgPSBudWxsO1xuICAgIHByaXZhdGUgYXV0b0NvbXBsZXRlUGFydElkeDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG4gICAgcHJpdmF0ZSBhdXRvQ29tcGxldGVQYXJ0Q291bnQgPSAwO1xuICAgIHByaXZhdGUgdHJhbnNmb3JtQ2FsbGJhY2s6IFRyYW5zZm9ybUNhbGxiYWNrIHwgbnVsbCA9IG51bGw7XG5cbiAgICBwdWJsaWMgY29uc3RydWN0b3IocGFydHM6IFBhcnRbXSwgcGFydENyZWF0b3I6IFBhcnRDcmVhdG9yLCBwcml2YXRlIHVwZGF0ZUNhbGxiYWNrOiBVcGRhdGVDYWxsYmFjayB8IG51bGwgPSBudWxsKSB7XG4gICAgICAgIHRoaXMuX3BhcnRzID0gcGFydHM7XG4gICAgICAgIHRoaXMuX3BhcnRDcmVhdG9yID0gcGFydENyZWF0b3I7XG4gICAgICAgIHRoaXMudHJhbnNmb3JtQ2FsbGJhY2sgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCBhIGNhbGxiYWNrIGZvciB0aGUgdHJhbnNmb3JtYXRpb24gc3RlcC5cbiAgICAgKiBXaGlsZSBwcm9jZXNzaW5nIGFuIHVwZGF0ZSwgcmlnaHQgYmVmb3JlIGNhbGxpbmcgdGhlIHVwZGF0ZSBjYWxsYmFjayxcbiAgICAgKiBhIHRyYW5zZm9ybSBjYWxsYmFjayBjYW4gYmUgY2FsbGVkLCB3aGljaCBzZXJ2ZXMgdG8gZG8gbW9kaWZpY2F0aW9uc1xuICAgICAqIG9uIHRoZSBtb2RlbCB0aGF0IGNhbiBzcGFuIG11bHRpcGxlIHBhcnRzLiBBbHNvIHNlZSBgc3RhcnRSYW5nZSgpYC5cbiAgICAgKiBAcGFyYW0ge1RyYW5zZm9ybUNhbGxiYWNrfSB0cmFuc2Zvcm1DYWxsYmFja1xuICAgICAqL1xuICAgIHB1YmxpYyBzZXRUcmFuc2Zvcm1DYWxsYmFjayh0cmFuc2Zvcm1DYWxsYmFjazogVHJhbnNmb3JtQ2FsbGJhY2spOiB2b2lkIHtcbiAgICAgICAgdGhpcy50cmFuc2Zvcm1DYWxsYmFjayA9IHRyYW5zZm9ybUNhbGxiYWNrO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCBhIGNhbGxiYWNrIGZvciByZXJlbmRlcmluZyB0aGUgbW9kZWwgYWZ0ZXIgaXQgaGFzIGJlZW4gdXBkYXRlZC5cbiAgICAgKiBAcGFyYW0ge01vZGVsQ2FsbGJhY2t9IHVwZGF0ZUNhbGxiYWNrXG4gICAgICovXG4gICAgcHVibGljIHNldFVwZGF0ZUNhbGxiYWNrKHVwZGF0ZUNhbGxiYWNrOiBVcGRhdGVDYWxsYmFjayk6IHZvaWQge1xuICAgICAgICB0aGlzLnVwZGF0ZUNhbGxiYWNrID0gdXBkYXRlQ2FsbGJhY2s7XG4gICAgfVxuXG4gICAgcHVibGljIGdldCBwYXJ0Q3JlYXRvcigpOiBQYXJ0Q3JlYXRvciB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wYXJ0Q3JlYXRvcjtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0IGlzRW1wdHkoKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wYXJ0cy5yZWR1Y2UoKGxlbiwgcGFydCkgPT4gbGVuICsgcGFydC50ZXh0Lmxlbmd0aCwgMCkgPT09IDA7XG4gICAgfVxuXG4gICAgcHVibGljIGNsb25lKCk6IEVkaXRvck1vZGVsIHtcbiAgICAgICAgY29uc3QgY2xvbmVkUGFydHMgPSB0aGlzLnBhcnRzXG4gICAgICAgICAgICAubWFwKChwKSA9PiB0aGlzLnBhcnRDcmVhdG9yLmRlc2VyaWFsaXplUGFydChwLnNlcmlhbGl6ZSgpKSlcbiAgICAgICAgICAgIC5maWx0ZXIoKHApOiBwIGlzIFBhcnQgPT4gQm9vbGVhbihwKSk7XG4gICAgICAgIHJldHVybiBuZXcgRWRpdG9yTW9kZWwoY2xvbmVkUGFydHMsIHRoaXMuX3BhcnRDcmVhdG9yLCB0aGlzLnVwZGF0ZUNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGluc2VydFBhcnQoaW5kZXg6IG51bWJlciwgcGFydDogUGFydCk6IHZvaWQge1xuICAgICAgICB0aGlzLl9wYXJ0cy5zcGxpY2UoaW5kZXgsIDAsIHBhcnQpO1xuICAgICAgICBpZiAodGhpcy5hY3RpdmVQYXJ0SWR4ICE9PSBudWxsICYmIHRoaXMuYWN0aXZlUGFydElkeCA+PSBpbmRleCkge1xuICAgICAgICAgICAgKyt0aGlzLmFjdGl2ZVBhcnRJZHg7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuYXV0b0NvbXBsZXRlUGFydElkeCAhPT0gbnVsbCAmJiB0aGlzLmF1dG9Db21wbGV0ZVBhcnRJZHggPj0gaW5kZXgpIHtcbiAgICAgICAgICAgICsrdGhpcy5hdXRvQ29tcGxldGVQYXJ0SWR4O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSByZW1vdmVQYXJ0KGluZGV4OiBudW1iZXIpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5fcGFydHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgaWYgKGluZGV4ID09PSB0aGlzLmFjdGl2ZVBhcnRJZHgpIHtcbiAgICAgICAgICAgIHRoaXMuYWN0aXZlUGFydElkeCA9IG51bGw7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5hY3RpdmVQYXJ0SWR4ICE9PSBudWxsICYmIHRoaXMuYWN0aXZlUGFydElkeCA+IGluZGV4KSB7XG4gICAgICAgICAgICAtLXRoaXMuYWN0aXZlUGFydElkeDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaW5kZXggPT09IHRoaXMuYXV0b0NvbXBsZXRlUGFydElkeCkge1xuICAgICAgICAgICAgdGhpcy5hdXRvQ29tcGxldGVQYXJ0SWR4ID0gbnVsbDtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmF1dG9Db21wbGV0ZVBhcnRJZHggIT09IG51bGwgJiYgdGhpcy5hdXRvQ29tcGxldGVQYXJ0SWR4ID4gaW5kZXgpIHtcbiAgICAgICAgICAgIC0tdGhpcy5hdXRvQ29tcGxldGVQYXJ0SWR4O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSByZXBsYWNlUGFydChpbmRleDogbnVtYmVyLCBwYXJ0OiBQYXJ0KTogdm9pZCB7XG4gICAgICAgIHRoaXMuX3BhcnRzLnNwbGljZShpbmRleCwgMSwgcGFydCk7XG4gICAgfVxuXG4gICAgcHVibGljIGdldCBwYXJ0cygpOiBQYXJ0W10ge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGFydHM7XG4gICAgfVxuXG4gICAgcHVibGljIGdldCBhdXRvQ29tcGxldGUoKTogQXV0b2NvbXBsZXRlV3JhcHBlck1vZGVsIHwgbnVsbCB7XG4gICAgICAgIGlmICh0aGlzLmFjdGl2ZVBhcnRJZHggPT09IHRoaXMuYXV0b0NvbXBsZXRlUGFydElkeCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2F1dG9Db21wbGV0ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0UG9zaXRpb25BdEVuZCgpOiBEb2N1bWVudFBvc2l0aW9uIHtcbiAgICAgICAgaWYgKHRoaXMuX3BhcnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLl9wYXJ0cy5sZW5ndGggLSAxO1xuICAgICAgICAgICAgY29uc3QgcGFydCA9IHRoaXMuX3BhcnRzW2luZGV4XTtcbiAgICAgICAgICAgIHJldHVybiBuZXcgRG9jdW1lbnRQb3NpdGlvbihpbmRleCwgcGFydC50ZXh0Lmxlbmd0aCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBwYXJ0IGluZGV4IC0xLCBhcyB0aGVyZSBhcmUgbm8gcGFydHMgdG8gcG9pbnQgYXRcbiAgICAgICAgICAgIHJldHVybiBuZXcgRG9jdW1lbnRQb3NpdGlvbigtMSwgMCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgc2VyaWFsaXplUGFydHMoKTogU2VyaWFsaXplZFBhcnRbXSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wYXJ0cy5tYXAoKHApID0+IHAuc2VyaWFsaXplKCkpO1xuICAgIH1cblxuICAgIHByaXZhdGUgZGlmZihuZXdWYWx1ZTogc3RyaW5nLCBpbnB1dFR5cGU6IHN0cmluZyB8IHVuZGVmaW5lZCwgY2FyZXQ6IERvY3VtZW50T2Zmc2V0KTogSURpZmYge1xuICAgICAgICBjb25zdCBwcmV2aW91c1ZhbHVlID0gdGhpcy5wYXJ0cy5yZWR1Y2UoKHRleHQsIHApID0+IHRleHQgKyBwLnRleHQsIFwiXCIpO1xuICAgICAgICAvLyBjYW4ndCB1c2UgY2FyZXQgcG9zaXRpb24gd2l0aCBkcmFnIGFuZCBkcm9wXG4gICAgICAgIGlmIChpbnB1dFR5cGUgPT09IFwiZGVsZXRlQnlEcmFnXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBkaWZmRGVsZXRpb24ocHJldmlvdXNWYWx1ZSwgbmV3VmFsdWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGRpZmZBdENhcmV0KHByZXZpb3VzVmFsdWUsIG5ld1ZhbHVlLCBjYXJldC5vZmZzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIHJlc2V0KHNlcmlhbGl6ZWRQYXJ0czogU2VyaWFsaXplZFBhcnRbXSwgY2FyZXQ/OiBDYXJldCwgaW5wdXRUeXBlPzogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIHRoaXMuX3BhcnRzID0gc2VyaWFsaXplZFBhcnRzXG4gICAgICAgICAgICAubWFwKChwKSA9PiB0aGlzLl9wYXJ0Q3JlYXRvci5kZXNlcmlhbGl6ZVBhcnQocCkpXG4gICAgICAgICAgICAuZmlsdGVyKChwKTogcCBpcyBQYXJ0ID0+IEJvb2xlYW4ocCkpO1xuICAgICAgICBpZiAoIWNhcmV0KSB7XG4gICAgICAgICAgICBjYXJldCA9IHRoaXMuZ2V0UG9zaXRpb25BdEVuZCgpO1xuICAgICAgICB9XG4gICAgICAgIC8vIGNsb3NlIGF1dG8gY29tcGxldGUgaWYgb3BlblxuICAgICAgICAvLyB0aGlzIHdvdWxkIGhhcHBlbiB3aGVuIGNsZWFyaW5nIHRoZSBjb21wb3NlciBhZnRlciBzZW5kaW5nXG4gICAgICAgIC8vIGEgbWVzc2FnZSB3aXRoIHRoZSBhdXRvY29tcGxldGUgc3RpbGwgb3BlblxuICAgICAgICBpZiAodGhpcy5fYXV0b0NvbXBsZXRlKSB7XG4gICAgICAgICAgICB0aGlzLl9hdXRvQ29tcGxldGUgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5hdXRvQ29tcGxldGVQYXJ0SWR4ID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnVwZGF0ZUNhbGxiYWNrPy4oY2FyZXQsIGlucHV0VHlwZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5zZXJ0cyB0aGUgZ2l2ZW4gcGFydHMgYXQgdGhlIGdpdmVuIHBvc2l0aW9uLlxuICAgICAqIFNob3VsZCBiZSBydW4gaW5zaWRlIGEgYG1vZGVsLnRyYW5zZm9ybSgpYCBjYWxsYmFjay5cbiAgICAgKiBAcGFyYW0ge1BhcnRbXX0gcGFydHMgdGhlIHBhcnRzIHRvIHJlcGxhY2UgdGhlIHJhbmdlIHdpdGhcbiAgICAgKiBAcGFyYW0ge0RvY3VtZW50UG9zaXRpb259IHBvc2l0aW9uIHRoZSBwb3NpdGlvbiB0byBzdGFydCBpbnNlcnRpbmcgYXRcbiAgICAgKiBAcmV0dXJuIHtOdW1iZXJ9IHRoZSBhbW91bnQgb2YgY2hhcmFjdGVycyBhZGRlZFxuICAgICAqL1xuICAgIHB1YmxpYyBpbnNlcnQocGFydHM6IFBhcnRbXSwgcG9zaXRpb246IElQb3NpdGlvbik6IG51bWJlciB7XG4gICAgICAgIGNvbnN0IGluc2VydEluZGV4ID0gdGhpcy5zcGxpdEF0KHBvc2l0aW9uKTtcbiAgICAgICAgbGV0IG5ld1RleHRMZW5ndGggPSAwO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhcnRzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBjb25zdCBwYXJ0ID0gcGFydHNbaV07XG4gICAgICAgICAgICBuZXdUZXh0TGVuZ3RoICs9IHBhcnQudGV4dC5sZW5ndGg7XG4gICAgICAgICAgICB0aGlzLmluc2VydFBhcnQoaW5zZXJ0SW5kZXggKyBpLCBwYXJ0KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3VGV4dExlbmd0aDtcbiAgICB9XG5cbiAgICBwdWJsaWMgdXBkYXRlKG5ld1ZhbHVlOiBzdHJpbmcsIGlucHV0VHlwZTogc3RyaW5nIHwgdW5kZWZpbmVkLCBjYXJldDogRG9jdW1lbnRPZmZzZXQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgY29uc3QgZGlmZiA9IHRoaXMuZGlmZihuZXdWYWx1ZSwgaW5wdXRUeXBlLCBjYXJldCk7XG4gICAgICAgIGNvbnN0IHBvc2l0aW9uID0gdGhpcy5wb3NpdGlvbkZvck9mZnNldChkaWZmLmF0IHx8IDAsIGNhcmV0LmF0Tm9kZUVuZCk7XG4gICAgICAgIGxldCByZW1vdmVkT2Zmc2V0RGVjcmVhc2UgPSAwO1xuICAgICAgICBpZiAoZGlmZi5yZW1vdmVkKSB7XG4gICAgICAgICAgICByZW1vdmVkT2Zmc2V0RGVjcmVhc2UgPSB0aGlzLnJlbW92ZVRleHQocG9zaXRpb24sIGRpZmYucmVtb3ZlZC5sZW5ndGgpO1xuICAgICAgICB9XG4gICAgICAgIGxldCBhZGRlZExlbiA9IDA7XG4gICAgICAgIGlmIChkaWZmLmFkZGVkKSB7XG4gICAgICAgICAgICBhZGRlZExlbiA9IHRoaXMuYWRkVGV4dChwb3NpdGlvbiwgZGlmZi5hZGRlZCwgaW5wdXRUeXBlKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLm1lcmdlQWRqYWNlbnRQYXJ0cygpO1xuICAgICAgICBjb25zdCBjYXJldE9mZnNldCA9IChkaWZmLmF0IHx8IDApIC0gcmVtb3ZlZE9mZnNldERlY3JlYXNlICsgYWRkZWRMZW47XG4gICAgICAgIGxldCBuZXdQb3NpdGlvbiA9IHRoaXMucG9zaXRpb25Gb3JPZmZzZXQoY2FyZXRPZmZzZXQsIHRydWUpO1xuICAgICAgICBjb25zdCBjYW5PcGVuQXV0b0NvbXBsZXRlID0gaW5wdXRUeXBlICE9PSBcImluc2VydEZyb21QYXN0ZVwiICYmIGlucHV0VHlwZSAhPT0gXCJpbnNlcnRGcm9tRHJvcFwiO1xuICAgICAgICBjb25zdCBhY1Byb21pc2UgPSB0aGlzLnNldEFjdGl2ZVBhcnQobmV3UG9zaXRpb24sIGNhbk9wZW5BdXRvQ29tcGxldGUpO1xuICAgICAgICBpZiAodGhpcy50cmFuc2Zvcm1DYWxsYmFjaykge1xuICAgICAgICAgICAgY29uc3QgdHJhbnNmb3JtQWRkZWRMZW4gPSB0aGlzLmdldFRyYW5zZm9ybUFkZGVkTGVuKG5ld1Bvc2l0aW9uLCBpbnB1dFR5cGUsIGRpZmYpO1xuICAgICAgICAgICAgbmV3UG9zaXRpb24gPSB0aGlzLnBvc2l0aW9uRm9yT2Zmc2V0KGNhcmV0T2Zmc2V0ICsgdHJhbnNmb3JtQWRkZWRMZW4sIHRydWUpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudXBkYXRlQ2FsbGJhY2s/LihuZXdQb3NpdGlvbiwgaW5wdXRUeXBlLCBkaWZmKTtcbiAgICAgICAgcmV0dXJuIGFjUHJvbWlzZTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdldFRyYW5zZm9ybUFkZGVkTGVuKG5ld1Bvc2l0aW9uOiBEb2N1bWVudFBvc2l0aW9uLCBpbnB1dFR5cGU6IHN0cmluZyB8IHVuZGVmaW5lZCwgZGlmZjogSURpZmYpOiBudW1iZXIge1xuICAgICAgICBjb25zdCByZXN1bHQgPSB0aGlzLnRyYW5zZm9ybUNhbGxiYWNrPy4obmV3UG9zaXRpb24sIGlucHV0VHlwZSwgZGlmZik7XG4gICAgICAgIHJldHVybiBOdW1iZXIuaXNGaW5pdGUocmVzdWx0KSA/IChyZXN1bHQgYXMgbnVtYmVyKSA6IDA7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzZXRBY3RpdmVQYXJ0KHBvczogRG9jdW1lbnRQb3NpdGlvbiwgY2FuT3BlbkF1dG9Db21wbGV0ZTogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCB7IGluZGV4IH0gPSBwb3M7XG4gICAgICAgIGNvbnN0IHBhcnQgPSB0aGlzLl9wYXJ0c1tpbmRleF07XG4gICAgICAgIGlmIChwYXJ0KSB7XG4gICAgICAgICAgICBpZiAoaW5kZXggIT09IHRoaXMuYWN0aXZlUGFydElkeCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYWN0aXZlUGFydElkeCA9IGluZGV4O1xuICAgICAgICAgICAgICAgIGlmIChjYW5PcGVuQXV0b0NvbXBsZXRlICYmIHRoaXMuYWN0aXZlUGFydElkeCAhPT0gdGhpcy5hdXRvQ29tcGxldGVQYXJ0SWR4KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGVsc2UgdHJ5IHRvIGNyZWF0ZSBvbmVcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYWMgPSBwYXJ0LmNyZWF0ZUF1dG9Db21wbGV0ZSh0aGlzLm9uQXV0b0NvbXBsZXRlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFjKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBtYWtlIHN1cmUgdGhhdCByZWFjdCBwaWNrcyB1cCB0aGUgZGlmZmVyZW5jZSBiZXR3ZWVuIGJvdGggYWNzXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9hdXRvQ29tcGxldGUgPSBhYztcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXV0b0NvbXBsZXRlUGFydElkeCA9IGluZGV4O1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hdXRvQ29tcGxldGVQYXJ0Q291bnQgPSAxO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gbm90IGF1dG9Db21wbGV0ZSwgb25seSB0aGVyZSBpZiBhY3RpdmUgcGFydCBpcyBhdXRvY29tcGxldGUgcGFydFxuICAgICAgICAgICAgaWYgKHRoaXMuYXV0b0NvbXBsZXRlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYXV0b0NvbXBsZXRlLm9uUGFydFVwZGF0ZShwYXJ0LCBwb3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5hY3RpdmVQYXJ0SWR4ID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX2F1dG9Db21wbGV0ZSA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLmF1dG9Db21wbGV0ZVBhcnRJZHggPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5hdXRvQ29tcGxldGVQYXJ0Q291bnQgPSAwO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIG9uQXV0b0NvbXBsZXRlID0gKHsgcmVwbGFjZVBhcnRzLCBjbG9zZSB9OiBJQ2FsbGJhY2spOiB2b2lkID0+IHtcbiAgICAgICAgbGV0IHBvczogRG9jdW1lbnRQb3NpdGlvbiB8IHVuZGVmaW5lZDtcbiAgICAgICAgaWYgKHJlcGxhY2VQYXJ0cykge1xuICAgICAgICAgICAgY29uc3QgYXV0b0NvbXBsZXRlUGFydElkeCA9IHRoaXMuYXV0b0NvbXBsZXRlUGFydElkeCB8fCAwO1xuICAgICAgICAgICAgdGhpcy5fcGFydHMuc3BsaWNlKGF1dG9Db21wbGV0ZVBhcnRJZHgsIHRoaXMuYXV0b0NvbXBsZXRlUGFydENvdW50LCAuLi5yZXBsYWNlUGFydHMpO1xuICAgICAgICAgICAgdGhpcy5hdXRvQ29tcGxldGVQYXJ0Q291bnQgPSByZXBsYWNlUGFydHMubGVuZ3RoO1xuICAgICAgICAgICAgY29uc3QgbGFzdFBhcnQgPSByZXBsYWNlUGFydHNbcmVwbGFjZVBhcnRzLmxlbmd0aCAtIDFdO1xuICAgICAgICAgICAgY29uc3QgbGFzdFBhcnRJbmRleCA9IGF1dG9Db21wbGV0ZVBhcnRJZHggKyByZXBsYWNlUGFydHMubGVuZ3RoIC0gMTtcbiAgICAgICAgICAgIHBvcyA9IG5ldyBEb2N1bWVudFBvc2l0aW9uKGxhc3RQYXJ0SW5kZXgsIGxhc3RQYXJ0LnRleHQubGVuZ3RoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2xvc2UpIHtcbiAgICAgICAgICAgIHRoaXMuX2F1dG9Db21wbGV0ZSA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLmF1dG9Db21wbGV0ZVBhcnRJZHggPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5hdXRvQ29tcGxldGVQYXJ0Q291bnQgPSAwO1xuICAgICAgICB9XG4gICAgICAgIC8vIHJlcmVuZGVyIGV2ZW4gaWYgZWRpdG9yIGNvbnRlbnRzIGRpZG4ndCBjaGFuZ2VcbiAgICAgICAgLy8gdG8gbWFrZSBzdXJlIHRoZSBNZXNzYWdlRWRpdG9yIGNoZWNrc1xuICAgICAgICAvLyBtb2RlbC5hdXRvQ29tcGxldGUgYmVpbmcgZW1wdHkgYW5kIGNsb3NlcyBpdFxuICAgICAgICB0aGlzLnVwZGF0ZUNhbGxiYWNrPy4ocG9zKTtcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBtZXJnZUFkamFjZW50UGFydHMoKTogdm9pZCB7XG4gICAgICAgIGxldCBwcmV2UGFydDogUGFydCB8IHVuZGVmaW5lZDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9wYXJ0cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgbGV0IHBhcnQ6IFBhcnQgfCB1bmRlZmluZWQgPSB0aGlzLl9wYXJ0c1tpXTtcbiAgICAgICAgICAgIGNvbnN0IGlzRW1wdHkgPSAhcGFydC50ZXh0Lmxlbmd0aDtcbiAgICAgICAgICAgIGNvbnN0IGlzTWVyZ2VkID0gIWlzRW1wdHkgJiYgcHJldlBhcnQgJiYgcHJldlBhcnQubWVyZ2U/LihwYXJ0KTtcbiAgICAgICAgICAgIGlmIChpc0VtcHR5IHx8IGlzTWVyZ2VkKSB7XG4gICAgICAgICAgICAgICAgLy8gcmVtb3ZlIGVtcHR5IG9yIG1lcmdlZCBwYXJ0XG4gICAgICAgICAgICAgICAgcGFydCA9IHByZXZQYXJ0O1xuICAgICAgICAgICAgICAgIHRoaXMucmVtb3ZlUGFydChpKTtcbiAgICAgICAgICAgICAgICAvL3JlcGVhdCB0aGlzIGluZGV4LCBhcyBpdCdzIHJlbW92ZWQgbm93XG4gICAgICAgICAgICAgICAgLS1pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcHJldlBhcnQgPSBwYXJ0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmVtb3ZlcyBgbGVuYCBhbW91bnQgb2YgY2hhcmFjdGVycyBhdCBgcG9zYC5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IGxlblxuICAgICAqIEByZXR1cm4ge051bWJlcn0gaG93IG1hbnkgY2hhcmFjdGVycyBiZWZvcmUgcG9zIHdlcmUgYWxzbyByZW1vdmVkLFxuICAgICAqIHVzdWFsbHkgYmVjYXVzZSBvZiBub24tZWRpdGFibGUgcGFydHMgdGhhdCBjYW4gb25seSBiZSByZW1vdmVkIGluIHRoZWlyIGVudGlyZXR5LlxuICAgICAqL1xuICAgIHB1YmxpYyByZW1vdmVUZXh0KHBvczogSVBvc2l0aW9uLCBsZW46IG51bWJlcik6IG51bWJlciB7XG4gICAgICAgIGxldCB7IGluZGV4LCBvZmZzZXQgfSA9IHBvcztcbiAgICAgICAgbGV0IHJlbW92ZWRPZmZzZXREZWNyZWFzZSA9IDA7XG4gICAgICAgIHdoaWxlIChsZW4gPiAwKSB7XG4gICAgICAgICAgICAvLyBwYXJ0IG1pZ2h0IGJlIHVuZGVmaW5lZCBoZXJlXG4gICAgICAgICAgICBsZXQgcGFydCA9IHRoaXMuX3BhcnRzW2luZGV4XTtcbiAgICAgICAgICAgIGNvbnN0IGFtb3VudCA9IE1hdGgubWluKGxlbiwgcGFydC50ZXh0Lmxlbmd0aCAtIG9mZnNldCk7XG4gICAgICAgICAgICAvLyBkb24ndCBhbGxvdyAwIGFtb3VudCBkZWxldGlvbnNcbiAgICAgICAgICAgIGlmIChhbW91bnQpIHtcbiAgICAgICAgICAgICAgICBpZiAocGFydC5jYW5FZGl0KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlcGxhY2VXaXRoID0gcGFydC5yZW1vdmUob2Zmc2V0LCBhbW91bnQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHJlcGxhY2VXaXRoID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlcGxhY2VQYXJ0KGluZGV4LCB0aGlzLl9wYXJ0Q3JlYXRvci5jcmVhdGVEZWZhdWx0UGFydChyZXBsYWNlV2l0aCkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHBhcnQgPSB0aGlzLl9wYXJ0c1tpbmRleF07XG4gICAgICAgICAgICAgICAgICAgIC8vIHJlbW92ZSBlbXB0eSBwYXJ0XG4gICAgICAgICAgICAgICAgICAgIGlmICghcGFydC50ZXh0Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW1vdmVQYXJ0KGluZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4ICs9IDE7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZW1vdmVkT2Zmc2V0RGVjcmVhc2UgKz0gb2Zmc2V0O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbW92ZVBhcnQoaW5kZXgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaW5kZXggKz0gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxlbiAtPSBhbW91bnQ7XG4gICAgICAgICAgICBvZmZzZXQgPSAwO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZW1vdmVkT2Zmc2V0RGVjcmVhc2U7XG4gICAgfVxuXG4gICAgLy8gcmV0dXJuIHBhcnQgaW5kZXggd2hlcmUgaW5zZXJ0aW9uIHdpbGwgaW5zZXJ0IGJldHdlZW4gYXQgb2Zmc2V0XG4gICAgcHJpdmF0ZSBzcGxpdEF0KHBvczogSVBvc2l0aW9uKTogbnVtYmVyIHtcbiAgICAgICAgaWYgKHBvcy5pbmRleCA9PT0gLTEpIHtcbiAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9XG4gICAgICAgIGlmIChwb3Mub2Zmc2V0ID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gcG9zLmluZGV4O1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHBhcnQgPSB0aGlzLl9wYXJ0c1twb3MuaW5kZXhdO1xuICAgICAgICBpZiAocG9zLm9mZnNldCA+PSBwYXJ0LnRleHQubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gcG9zLmluZGV4ICsgMTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNlY29uZFBhcnQgPSBwYXJ0LnNwbGl0KHBvcy5vZmZzZXQpO1xuICAgICAgICB0aGlzLmluc2VydFBhcnQocG9zLmluZGV4ICsgMSwgc2Vjb25kUGFydCk7XG4gICAgICAgIHJldHVybiBwb3MuaW5kZXggKyAxO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGluc2VydHMgYHN0cmAgaW50byB0aGUgbW9kZWwgYXQgYHBvc2AuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHBvc1xuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzdHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gaW5wdXRUeXBlIHRoZSBzb3VyY2Ugb2YgdGhlIGlucHV0LCBzZWUgaHRtbCBJbnB1dEV2ZW50LmlucHV0VHlwZVxuICAgICAqIEByZXR1cm4ge051bWJlcn0gaG93IGZhciBmcm9tIHBvc2l0aW9uIChpbiBjaGFyYWN0ZXJzKSB0aGUgaW5zZXJ0aW9uIGVuZGVkLlxuICAgICAqIFRoaXMgY2FuIGJlIG1vcmUgdGhhbiB0aGUgbGVuZ3RoIG9mIGBzdHJgIHdoZW4gY3Jvc3Npbmcgbm9uLWVkaXRhYmxlIHBhcnRzLCB3aGljaCBhcmUgc2tpcHBlZC5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFkZFRleHQocG9zOiBJUG9zaXRpb24sIHN0cjogc3RyaW5nLCBpbnB1dFR5cGU6IHN0cmluZyB8IHVuZGVmaW5lZCk6IG51bWJlciB7XG4gICAgICAgIGxldCB7IGluZGV4IH0gPSBwb3M7XG4gICAgICAgIGNvbnN0IHsgb2Zmc2V0IH0gPSBwb3M7XG4gICAgICAgIGxldCBhZGRMZW4gPSBzdHIubGVuZ3RoO1xuICAgICAgICBjb25zdCBwYXJ0ID0gdGhpcy5fcGFydHNbaW5kZXhdO1xuXG4gICAgICAgIGxldCBpdDogc3RyaW5nIHwgdW5kZWZpbmVkID0gc3RyO1xuXG4gICAgICAgIGlmIChwYXJ0KSB7XG4gICAgICAgICAgICBpZiAocGFydC5jYW5FZGl0KSB7XG4gICAgICAgICAgICAgICAgaWYgKHBhcnQudmFsaWRhdGVBbmRJbnNlcnQob2Zmc2V0LCBzdHIsIGlucHV0VHlwZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgaXQgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3BsaXRQYXJ0ID0gcGFydC5zcGxpdChvZmZzZXQpO1xuICAgICAgICAgICAgICAgICAgICBpbmRleCArPSAxO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmluc2VydFBhcnQoaW5kZXgsIHNwbGl0UGFydCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChvZmZzZXQgIT09IDApIHtcbiAgICAgICAgICAgICAgICAvLyBub3QtZWRpdGFibGUgcGFydCwgY2FyZXQgaXMgbm90IGF0IHN0YXJ0LFxuICAgICAgICAgICAgICAgIC8vIHNvIGluc2VydCBzdHIgYWZ0ZXIgdGhpcyBwYXJ0XG4gICAgICAgICAgICAgICAgYWRkTGVuICs9IHBhcnQudGV4dC5sZW5ndGggLSBvZmZzZXQ7XG4gICAgICAgICAgICAgICAgaW5kZXggKz0gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChpbmRleCA8IDApIHtcbiAgICAgICAgICAgIC8vIGlmIHBvc2l0aW9uIHdhcyBub3QgZm91bmQgKGluZGV4OiAtMSwgYXMgaGFwcGVucyBmb3IgZW1wdHkgZWRpdG9yKVxuICAgICAgICAgICAgLy8gcmVzZXQgaXQgdG8gaW5zZXJ0IGFzIGZpcnN0IHBhcnRcbiAgICAgICAgICAgIGluZGV4ID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIHdoaWxlIChpdCkge1xuICAgICAgICAgICAgY29uc3QgbmV3UGFydCA9IHRoaXMuX3BhcnRDcmVhdG9yLmNyZWF0ZVBhcnRGb3JJbnB1dChpdCwgaW5kZXgsIGlucHV0VHlwZSk7XG4gICAgICAgICAgICBjb25zdCBvbGRTdHIgPSBpdDtcbiAgICAgICAgICAgIGl0ID0gbmV3UGFydC5hcHBlbmRVbnRpbFJlamVjdGVkKGl0LCBpbnB1dFR5cGUpO1xuICAgICAgICAgICAgaWYgKGl0ID09PSBvbGRTdHIpIHtcbiAgICAgICAgICAgICAgICAvLyBub3RoaW5nIGNoYW5nZWQsIGJyZWFrIG91dCBvZiB0aGlzIGluZmluaXRlIGxvb3AgYW5kIGxvZyBhbiBlcnJvclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYEZhaWxlZCB0byB1cGRhdGUgbW9kZWwgZm9yIGlucHV0IChzdHIgJHtpdH0pICh0eXBlICR7aW5wdXRUeXBlfSlgKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuaW5zZXJ0UGFydChpbmRleCwgbmV3UGFydCk7XG4gICAgICAgICAgICBpbmRleCArPSAxO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhZGRMZW47XG4gICAgfVxuXG4gICAgcHVibGljIHBvc2l0aW9uRm9yT2Zmc2V0KHRvdGFsT2Zmc2V0OiBudW1iZXIsIGF0UGFydEVuZCA9IGZhbHNlKTogRG9jdW1lbnRQb3NpdGlvbiB7XG4gICAgICAgIGxldCBjdXJyZW50T2Zmc2V0ID0gMDtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLl9wYXJ0cy5maW5kSW5kZXgoKHBhcnQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHBhcnRMZW4gPSBwYXJ0LnRleHQubGVuZ3RoO1xuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgIChhdFBhcnRFbmQgJiYgY3VycmVudE9mZnNldCArIHBhcnRMZW4gPj0gdG90YWxPZmZzZXQpIHx8XG4gICAgICAgICAgICAgICAgKCFhdFBhcnRFbmQgJiYgY3VycmVudE9mZnNldCArIHBhcnRMZW4gPiB0b3RhbE9mZnNldClcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY3VycmVudE9mZnNldCArPSBwYXJ0TGVuO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGluZGV4ID09PSAtMSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0UG9zaXRpb25BdEVuZCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBEb2N1bWVudFBvc2l0aW9uKGluZGV4LCB0b3RhbE9mZnNldCAtIGN1cnJlbnRPZmZzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RhcnRzIGEgcmFuZ2UsIHdoaWNoIGNhbiBzcGFuIGFjcm9zcyBtdWx0aXBsZSBwYXJ0cywgdG8gZmluZCBhbmQgcmVwbGFjZSB0ZXh0LlxuICAgICAqIEBwYXJhbSB7RG9jdW1lbnRQb3NpdGlvbn0gcG9zaXRpb25BIGEgYm91bmRhcnkgb2YgdGhlIHJhbmdlXG4gICAgICogQHBhcmFtIHtEb2N1bWVudFBvc2l0aW9uP30gcG9zaXRpb25CIHRoZSBvdGhlciBib3VuZGFyeSBvZiB0aGUgcmFuZ2UsIG9wdGlvbmFsXG4gICAgICogQHJldHVybiB7UmFuZ2V9XG4gICAgICovXG4gICAgcHVibGljIHN0YXJ0UmFuZ2UocG9zaXRpb25BOiBEb2N1bWVudFBvc2l0aW9uLCBwb3NpdGlvbkIgPSBwb3NpdGlvbkEpOiBSYW5nZSB7XG4gICAgICAgIHJldHVybiBuZXcgUmFuZ2UodGhpcywgcG9zaXRpb25BLCBwb3NpdGlvbkIpO1xuICAgIH1cblxuICAgIHB1YmxpYyByZXBsYWNlUmFuZ2Uoc3RhcnRQb3NpdGlvbjogRG9jdW1lbnRQb3NpdGlvbiwgZW5kUG9zaXRpb246IERvY3VtZW50UG9zaXRpb24sIHBhcnRzOiBQYXJ0W10pOiB2b2lkIHtcbiAgICAgICAgLy8gY29udmVydCBlbmQgcG9zaXRpb24gdG8gb2Zmc2V0LCBzbyBpdCBpcyBpbmRlcGVuZGVudCBvZiBob3cgdGhlIGRvY3VtZW50IGlzIHNwbGl0IGludG8gcGFydHNcbiAgICAgICAgLy8gd2hpY2ggd2UnbGwgY2hhbmdlIHdoZW4gc3BsaXR0aW5nIHVwIGF0IHRoZSBzdGFydCBwb3NpdGlvblxuICAgICAgICBjb25zdCBlbmRPZmZzZXQgPSBlbmRQb3NpdGlvbi5hc09mZnNldCh0aGlzKTtcbiAgICAgICAgY29uc3QgbmV3U3RhcnRQYXJ0SW5kZXggPSB0aGlzLnNwbGl0QXQoc3RhcnRQb3NpdGlvbik7XG4gICAgICAgIC8vIGNvbnZlcnQgaXQgYmFjayB0byBwb3NpdGlvbiBvbmNlIHNwbGl0IGF0IHN0YXJ0XG4gICAgICAgIGVuZFBvc2l0aW9uID0gZW5kT2Zmc2V0LmFzUG9zaXRpb24odGhpcyk7XG4gICAgICAgIGNvbnN0IG5ld0VuZFBhcnRJbmRleCA9IHRoaXMuc3BsaXRBdChlbmRQb3NpdGlvbik7XG4gICAgICAgIGZvciAobGV0IGkgPSBuZXdFbmRQYXJ0SW5kZXggLSAxOyBpID49IG5ld1N0YXJ0UGFydEluZGV4OyAtLWkpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlUGFydChpKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgaW5zZXJ0SWR4ID0gbmV3U3RhcnRQYXJ0SW5kZXg7XG4gICAgICAgIGZvciAoY29uc3QgcGFydCBvZiBwYXJ0cykge1xuICAgICAgICAgICAgdGhpcy5pbnNlcnRQYXJ0KGluc2VydElkeCwgcGFydCk7XG4gICAgICAgICAgICBpbnNlcnRJZHggKz0gMTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLm1lcmdlQWRqYWNlbnRQYXJ0cygpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFBlcmZvcm1zIGEgdHJhbnNmb3JtYXRpb24gbm90IHBhcnQgb2YgYW4gdXBkYXRlIGN5Y2xlLlxuICAgICAqIE1vZGlmeWluZyB0aGUgbW9kZWwgc2hvdWxkIG9ubHkgaGFwcGVuIGluc2lkZSBhIHRyYW5zZm9ybSBjYWxsIGlmIG5vdCBwYXJ0IG9mIGFuIHVwZGF0ZSBjYWxsLlxuICAgICAqIEBwYXJhbSB7TWFudWFsVHJhbnNmb3JtQ2FsbGJhY2t9IGNhbGxiYWNrIHRvIHJ1biB0aGUgdHJhbnNmb3JtYXRpb25zIGluXG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gYSBwcm9taXNlIHdoZW4gYXV0by1jb21wbGV0ZSAoaWYgYXBwbGljYWJsZSkgaXMgZG9uZSB1cGRhdGluZ1xuICAgICAqL1xuICAgIHB1YmxpYyB0cmFuc2Zvcm0oY2FsbGJhY2s6IE1hbnVhbFRyYW5zZm9ybUNhbGxiYWNrKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGNvbnN0IHBvcyA9IGNhbGxiYWNrKCk7XG4gICAgICAgIGxldCBhY1Byb21pc2U6IFByb21pc2U8dm9pZD4gfCBudWxsID0gbnVsbDtcbiAgICAgICAgaWYgKCEocG9zIGluc3RhbmNlb2YgUmFuZ2UpKSB7XG4gICAgICAgICAgICBhY1Byb21pc2UgPSB0aGlzLnNldEFjdGl2ZVBhcnQocG9zLCB0cnVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFjUHJvbWlzZSA9IFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudXBkYXRlQ2FsbGJhY2s/Lihwb3MpO1xuICAgICAgICByZXR1cm4gYWNQcm9taXNlO1xuICAgIH1cbn1cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFpQkEsSUFBQUEsS0FBQSxHQUFBQyxPQUFBO0FBQ0EsSUFBQUMsU0FBQSxHQUFBQyxzQkFBQSxDQUFBRixPQUFBO0FBQ0EsSUFBQUcsTUFBQSxHQUFBRCxzQkFBQSxDQUFBRixPQUFBO0FBbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQVVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFNZSxNQUFNSSxXQUFXLENBQUM7RUFTdEJDLFdBQVdBLENBQUNDLEtBQWEsRUFBRUMsV0FBd0IsRUFBd0Q7SUFBQSxJQUE5Q0MsY0FBcUMsR0FBQUMsU0FBQSxDQUFBQyxNQUFBLFFBQUFELFNBQUEsUUFBQUUsU0FBQSxHQUFBRixTQUFBLE1BQUcsSUFBSTtJQUFBLEtBQTVDRCxjQUFxQyxHQUFyQ0EsY0FBcUM7SUFBQSxJQUFBSSxnQkFBQSxDQUFBQyxPQUFBO0lBQUEsSUFBQUQsZ0JBQUEsQ0FBQUMsT0FBQTtJQUFBLElBQUFELGdCQUFBLENBQUFDLE9BQUEseUJBTmxFLElBQUk7SUFBQSxJQUFBRCxnQkFBQSxDQUFBQyxPQUFBLHlCQUNjLElBQUk7SUFBQSxJQUFBRCxnQkFBQSxD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