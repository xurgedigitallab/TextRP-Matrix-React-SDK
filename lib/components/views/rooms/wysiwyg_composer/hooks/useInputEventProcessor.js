"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useInputEventProcessor = useInputEventProcessor;
var _react = require("react");
var _useSettings = require("../../../../../hooks/useSettings");
var _KeyBindingsManager = require("../../../../../KeyBindingsManager");
var _KeyboardShortcuts = require("../../../../../accessibility/KeyboardShortcuts");
var _EventUtils = require("../../../../../utils/EventUtils");
var _dispatcher = _interopRequireDefault(require("../../../../../dispatcher/dispatcher"));
var _actions = require("../../../../../dispatcher/actions");
var _RoomContext = require("../../../../../contexts/RoomContext");
var _ComposerContext = require("../ComposerContext");
var _MatrixClientContext = require("../../../../../contexts/MatrixClientContext");
var _selection = require("../utils/selection");
var _event = require("../utils/event");
var _editing = require("../utils/editing");
var _utils = require("./utils");
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

function useInputEventProcessor(onSend, autocompleteRef, initialContent, eventRelation) {
  const roomContext = (0, _RoomContext.useRoomContext)();
  const composerContext = (0, _ComposerContext.useComposerContext)();
  const mxClient = (0, _MatrixClientContext.useMatrixClientContext)();
  const isCtrlEnterToSend = (0, _useSettings.useSettingValue)("MessageComposerInput.ctrlEnterToSend");
  return (0, _react.useCallback)((event, composer, editor) => {
    const send = () => {
      event.stopPropagation?.();
      event.preventDefault?.();
      // do not send the message if we have the autocomplete open, regardless of settings
      if (autocompleteRef?.current && !autocompleteRef.current.state.hide) {
        return;
      }
      onSend();
    };
    if ((0, _utils.isEventToHandleAsClipboardEvent)(event)) {
      const data = event instanceof ClipboardEvent ? event.clipboardData : event.dataTransfer;
      const handled = (0, _utils.handleClipboardEvent)(event, data, roomContext, mxClient, eventRelation);
      return handled ? null : event;
    }
    const isKeyboardEvent = event instanceof KeyboardEvent;
    if (isKeyboardEvent) {
      return handleKeyboardEvent(event, send, initialContent, composer, editor, roomContext, composerContext, mxClient, autocompleteRef);
    } else {
      return handleInputEvent(event, send, isCtrlEnterToSend);
    }
  }, [isCtrlEnterToSend, onSend, initialContent, roomContext, composerContext, mxClient, autocompleteRef, eventRelation]);
}
function handleKeyboardEvent(event, send, initialContent, composer, editor, roomContext, composerContext, mxClient, autocompleteRef) {
  const {
    editorStateTransfer
  } = composerContext;
  const isEditing = Boolean(editorStateTransfer);
  const isEditorModified = isEditing ? initialContent !== composer.content() : composer.content().length !== 0;
  const action = (0, _KeyBindingsManager.getKeyBindingsManager)().getMessageComposerAction(event);

  // we need autocomplete to take priority when it is open for using enter to select
  const isHandledByAutocomplete = (0, _utils.handleEventWithAutocomplete)(autocompleteRef, event);
  if (isHandledByAutocomplete) {
    return event;
  }

  // taking the client from context gives us an client | undefined type, narrow it down
  if (mxClient === undefined) {
    return null;
  }
  switch (action) {
    case _KeyboardShortcuts.KeyBindingAction.SendMessage:
      send();
      return null;
    case _KeyboardShortcuts.KeyBindingAction.EditPrevMessage:
      {
        // Or if the caret is not at the beginning of the editor
        // Or the editor is modified
        if (!(0, _selection.isCaretAtStart)(editor) || isEditorModified) {
          break;
        }
        const isDispatched = dispatchEditEvent(event, false, editorStateTransfer, composerContext, roomContext, mxClient);
        if (isDispatched) {
          return null;
        }
        break;
      }
    case _KeyboardShortcuts.KeyBindingAction.EditNextMessage:
      {
        // If not in edition
        // Or if the caret is not at the end of the editor
        // Or the editor is modified
        if (!editorStateTransfer || !(0, _selection.isCaretAtEnd)(editor) || isEditorModified) {
          break;
        }
        const isDispatched = dispatchEditEvent(event, true, editorStateTransfer, composerContext, roomContext, mxClient);
        if (!isDispatched) {
          (0, _editing.endEditing)(roomContext);
          event.preventDefault();
          event.stopPropagation();
        }
        return null;
      }
  }
  return event;
}
function dispatchEditEvent(event, isForward, editorStateTransfer, composerContext, roomContext, mxClient) {
  const foundEvents = editorStateTransfer ? (0, _event.getEventsFromEditorStateTransfer)(editorStateTransfer, roomContext, mxClient) : (0, _event.getEventsFromRoom)(composerContext, roomContext);
  if (!foundEvents) {
    return false;
  }
  const newEvent = (0, _EventUtils.findEditableEvent)({
    events: foundEvents,
    isForward,
    fromEventId: editorStateTransfer?.getEvent().getId(),
    matrixClient: mxClient
  });
  if (newEvent) {
    _dispatcher.default.dispatch({
      action: _actions.Action.EditEvent,
      event: newEvent,
      timelineRenderingType: roomContext.timelineRenderingType
    });
    event.stopPropagation();
    event.preventDefault();
    return true;
  }
  return false;
}
function handleInputEvent(event, send, isCtrlEnterToSend) {
  switch (event.inputType) {
    case "insertParagraph":
      if (!isCtrlEnterToSend) {
        send();
        return null;
      }
      break;
    case "sendMessage":
      if (isCtrlEnterToSend) {
        send();
        return null;
      }
      break;
  }
  return event;
}
//# sourceMappingURL=useInputEventProcessor.js.map