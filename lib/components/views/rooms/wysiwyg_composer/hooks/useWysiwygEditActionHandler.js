"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useWysiwygEditActionHandler = useWysiwygEditActionHandler;
var _react = require("react");
var _dispatcher = _interopRequireDefault(require("../../../../../dispatcher/dispatcher"));
var _actions = require("../../../../../dispatcher/actions");
var _RoomContext = require("../../../../../contexts/RoomContext");
var _useDispatcher = require("../../../../../hooks/useDispatcher");
var _utils = require("./utils");
var _ComposerInsertPayload = require("../../../../../dispatcher/payloads/ComposerInsertPayload");
var _selection = require("../utils/selection");
var _ComposerContext = require("../ComposerContext");
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

function useWysiwygEditActionHandler(disabled, composerElement, composerFunctions) {
  const roomContext = (0, _RoomContext.useRoomContext)();
  const composerContext = (0, _ComposerContext.useComposerContext)();
  const timeoutId = (0, _react.useRef)(null);
  const handler = (0, _react.useCallback)(payload => {
    // don't let the user into the composer if it is disabled - all of these branches lead
    // to the cursor being in the composer
    if (disabled || !composerElement.current) return;
    const context = payload.context ?? _RoomContext.TimelineRenderingType.Room;
    switch (payload.action) {
      case _actions.Action.FocusEditMessageComposer:
        (0, _utils.focusComposer)(composerElement, context, roomContext, timeoutId);
        break;
      case _actions.Action.ComposerInsert:
        if (payload.timelineRenderingType !== roomContext.timelineRenderingType) break;
        if (payload.composerType !== _ComposerInsertPayload.ComposerType.Edit) break;
        if (payload.text) {
          (0, _selection.setSelection)(composerContext.selection).then(() => composerFunctions.insertText(payload.text));
        }
        break;
    }
  }, [disabled, composerElement, composerFunctions, timeoutId, roomContext, composerContext]);
  (0, _useDispatcher.useDispatcher)(_dispatcher.default, handler);
}
//# sourceMappingURL=useWysiwygEditActionHandler.js.map