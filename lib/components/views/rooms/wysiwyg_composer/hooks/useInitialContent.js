"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.parseEditorStateTransfer = parseEditorStateTransfer;
exports.useInitialContent = useInitialContent;
var _react = require("react");
var _MatrixClientContext = require("../../../../../contexts/MatrixClientContext");
var _RoomContext = require("../../../../../contexts/RoomContext");
var _deserialize = require("../../../../../editor/deserialize");
var _parts = require("../../../../../editor/parts");
var _SettingsStore = _interopRequireDefault(require("../../../../../settings/SettingsStore"));
/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

function getFormattedContent(editorStateTransfer) {
  return editorStateTransfer.getEvent().getContent().formatted_body?.replace(/<mx-reply>.*<\/mx-reply>/, "") || "";
}
function parseEditorStateTransfer(editorStateTransfer, room, mxClient) {
  const partCreator = new _parts.CommandPartCreator(room, mxClient);
  let parts = [];
  if (editorStateTransfer.hasEditorState()) {
    // if restoring state from a previous editor,
    // restore serialized parts from the state
    const serializedParts = editorStateTransfer.getSerializedParts();
    if (serializedParts !== null) {
      parts = serializedParts.map(p => partCreator.deserializePart(p));
    }
  } else {
    // otherwise, either restore serialized parts from localStorage or parse the body of the event
    // TODO local storage
    // const restoredParts = this.restoreStoredEditorState(partCreator);

    if (editorStateTransfer.getEvent().getContent().format === "org.matrix.custom.html") {
      return getFormattedContent(editorStateTransfer);
    }
    parts = (0, _deserialize.parseEvent)(editorStateTransfer.getEvent(), partCreator, {
      shouldEscape: _SettingsStore.default.getValue("MessageComposerInput.useMarkdown")
    });
  }
  return parts.reduce((content, part) => content + part?.text, "");
  // Todo local storage
  // this.saveStoredEditorState();
}

function useInitialContent(editorStateTransfer) {
  const roomContext = (0, _RoomContext.useRoomContext)();
  const mxClient = (0, _MatrixClientContext.useMatrixClientContext)();
  return (0, _react.useMemo)(() => {
    if (editorStateTransfer && roomContext.room && mxClient) {
      return parseEditorStateTransfer(editorStateTransfer, roomContext.room, mxClient);
    }
  }, [editorStateTransfer, roomContext, mxClient]);
}
//# sourceMappingURL=useInitialContent.js.map