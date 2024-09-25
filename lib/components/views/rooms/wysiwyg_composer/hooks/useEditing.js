"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useEditing = useEditing;
var _react = require("react");
var _MatrixClientContext = require("../../../../../contexts/MatrixClientContext");
var _RoomContext = require("../../../../../contexts/RoomContext");
var _editing = require("../utils/editing");
var _message = require("../utils/message");
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

function useEditing(editorStateTransfer, initialContent) {
  const roomContext = (0, _RoomContext.useRoomContext)();
  const mxClient = (0, _MatrixClientContext.useMatrixClientContext)();
  const [isSaveDisabled, setIsSaveDisabled] = (0, _react.useState)(true);
  const [content, setContent] = (0, _react.useState)(initialContent);
  const onChange = (0, _react.useCallback)(_content => {
    setContent(_content);
    setIsSaveDisabled(_isSaveDisabled => _isSaveDisabled && _content === initialContent);
  }, [initialContent]);
  const editMessageMemoized = (0, _react.useCallback)(async () => {
    if (mxClient === undefined || content === undefined) {
      return;
    }
    return (0, _message.editMessage)(content, {
      roomContext,
      mxClient,
      editorStateTransfer
    });
  }, [content, roomContext, mxClient, editorStateTransfer]);
  const endEditingMemoized = (0, _react.useCallback)(() => (0, _editing.endEditing)(roomContext), [roomContext]);
  return {
    onChange,
    editMessage: editMessageMemoized,
    endEditing: endEditingMemoized,
    isSaveDisabled
  };
}
//# sourceMappingURL=useEditing.js.map