"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getLineAndNodePosition = getLineAndNodePosition;
exports.setCaretPosition = setCaretPosition;
exports.setSelection = setSelection;
var _render = require("./render");
var _range = _interopRequireDefault(require("./range"));
var _parts = require("./parts");
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

function setSelection(editor, model, selection) {
  if (selection instanceof _range.default) {
    setDocumentRangeSelection(editor, model, selection);
  } else {
    setCaretPosition(editor, model, selection);
  }
}
function setDocumentRangeSelection(editor, model, range) {
  const sel = document.getSelection();
  sel.removeAllRanges();
  const selectionRange = document.createRange();
  const start = getNodeAndOffsetForPosition(editor, model, range.start);
  selectionRange.setStart(start.node, start.offset);
  const end = getNodeAndOffsetForPosition(editor, model, range.end);
  selectionRange.setEnd(end.node, end.offset);
  sel.addRange(selectionRange);
}
function setCaretPosition(editor, model, caretPosition) {
  if (model.isEmpty) return; // selection can't possibly be wrong, so avoid a reflow

  const range = document.createRange();
  const {
    node,
    offset
  } = getNodeAndOffsetForPosition(editor, model, caretPosition);
  range.setStart(node, offset);
  range.collapse(true);
  const sel = document.getSelection();
  if (sel.rangeCount === 1) {
    const existingRange = sel.getRangeAt(0);
    if (existingRange.startContainer === range.startContainer && existingRange.startOffset === range.startOffset && existingRange.collapsed === range.collapsed) {
      // If the selection matches, it's important to leave it alone.
      // Recreating the selection state in at least Chrome can cause
      // strange side effects, like touch bar flickering on every key.
      // See https://github.com/vector-im/element-web/issues/9299
      return;
    }
  }
  sel.removeAllRanges();
  sel.addRange(range);
}
function getNodeAndOffsetForPosition(editor, model, position) {
  const {
    offset,
    lineIndex,
    nodeIndex
  } = getLineAndNodePosition(model, position);
  const lineNode = editor.childNodes[lineIndex];
  let focusNode;
  // empty line with just a <br>
  if (nodeIndex === -1) {
    focusNode = lineNode;
  } else {
    focusNode = lineNode.childNodes[nodeIndex];
    // make sure we have a text node
    if (focusNode.nodeType === Node.ELEMENT_NODE && focusNode.firstChild) {
      focusNode = focusNode.firstChild;
    }
  }
  return {
    node: focusNode,
    offset
  };
}
function getLineAndNodePosition(model, caretPosition) {
  const {
    parts
  } = model;
  const partIndex = caretPosition.index;
  const lineResult = findNodeInLineForPart(parts, partIndex);
  const {
    lineIndex
  } = lineResult;
  let {
    nodeIndex
  } = lineResult;
  let {
    offset
  } = caretPosition;
  // we're at an empty line between a newline part
  // and another newline part or end/start of parts.
  // set offset to 0 so it gets set to the <br> inside the line container
  if (nodeIndex === -1) {
    offset = 0;
  } else {
    // move caret out of uneditable part (into caret node, or empty line br) if needed
    ({
      nodeIndex,
      offset
    } = moveOutOfUnselectablePart(parts, partIndex, nodeIndex, offset));
  }
  return {
    lineIndex,
    nodeIndex,
    offset
  };
}
function findNodeInLineForPart(parts, partIndex) {
  let lineIndex = 0;
  let nodeIndex = -1;
  let prevPart;
  // go through to parts up till (and including) the index
  // to find newline parts
  for (let i = 0; i <= partIndex; ++i) {
    const part = parts[i];
    if (part.type === _parts.Type.Newline) {
      lineIndex += 1;
      nodeIndex = -1;
      prevPart = undefined;
    } else {
      nodeIndex += 1;
      if ((0, _render.needsCaretNodeBefore)(part, prevPart)) {
        nodeIndex += 1;
      }
      // only jump over caret node if we're not at our destination node already,
      // as we'll assume in moveOutOfUnselectablePart that nodeIndex
      // refers to the node  corresponding to the part,
      // and not an adjacent caret node
      if (i < partIndex) {
        const nextPart = parts[i + 1];
        const isLastOfLine = !nextPart || nextPart.type === _parts.Type.Newline;
        if ((0, _render.needsCaretNodeAfter)(part, isLastOfLine)) {
          nodeIndex += 1;
        }
      }
      prevPart = part;
    }
  }
  return {
    lineIndex,
    nodeIndex
  };
}
function moveOutOfUnselectablePart(parts, partIndex, nodeIndex, offset) {
  // move caret before or after unselectable part
  const part = parts[partIndex];
  if (part && !part.acceptsCaret) {
    if (offset === 0) {
      nodeIndex -= 1;
      const prevPart = parts[partIndex - 1];
      // if the previous node is a caret node, it's empty
      // so the offset can stay at 0
      // only when it's not, we need to set the offset
      // at the end of the node
      if (!(0, _render.needsCaretNodeBefore)(part, prevPart)) {
        offset = prevPart.text.length;
      }
    } else {
      nodeIndex += 1;
      offset = 0;
    }
  }
  return {
    nodeIndex,
    offset
  };
}
//# sourceMappingURL=caret.js.map