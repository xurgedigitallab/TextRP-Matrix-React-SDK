"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.usePlainTextListeners = usePlainTextListeners;
var _react = require("react");
var _useSettings = require("../../../../../hooks/useSettings");
var _Keyboard = require("../../../../../Keyboard");
var _utils = require("./utils");
var _useSuggestion = require("./useSuggestion");
var _Typeguards = require("../../../../../Typeguards");
var _RoomContext = require("../../../../../contexts/RoomContext");
var _MatrixClientContext = require("../../../../../contexts/MatrixClientContext");
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

function isDivElement(target) {
  return target instanceof HTMLDivElement;
}

// Hitting enter inside the editor inserts an editable div, initially containing a <br />
// For correct display, first replace this pattern with a newline character and then remove divs
// noting that they are used to delimit paragraphs
function amendInnerHtml(text) {
  return text.replace(/<div><br><\/div>/g, "\n") // this is pressing enter then not typing
  .replace(/<div>/g, "\n") // this is from pressing enter, then typing inside the div
  .replace(/<\/div>/g, "");
}

/**
 * React hook which generates all of the listeners and the ref to be attached to the editor.
 *
 * Also returns pieces of state and utility functions that are required for use in other hooks
 * and by the autocomplete component.
 *
 * @param initialContent - the content of the editor when it is first mounted
 * @param onChange - called whenever there is change in the editor content
 * @param onSend - called whenever the user sends the message
 * @returns
 * - `ref`: a ref object which the caller must attach to the HTML `div` node for the editor
 * * `autocompleteRef`: a ref object which the caller must attach to the autocomplete component
 * - `content`: state representing the editor's current text content
 * - `setContent`: the setter function for `content`
 * - `onInput`, `onPaste`, `onKeyDown`: handlers for input, paste and keyDown events
 * - the output from the {@link useSuggestion} hook
 */
function usePlainTextListeners(initialContent, onChange, onSend, eventRelation) {
  const roomContext = (0, _RoomContext.useRoomContext)();
  const mxClient = (0, _MatrixClientContext.useMatrixClientContext)();
  const ref = (0, _react.useRef)(null);
  const autocompleteRef = (0, _react.useRef)(null);
  const [content, setContent] = (0, _react.useState)(initialContent);
  const send = (0, _react.useCallback)(() => {
    if (ref.current) {
      ref.current.innerHTML = "";
    }
    onSend?.();
  }, [ref, onSend]);
  const setText = (0, _react.useCallback)(text => {
    if ((0, _Typeguards.isNotUndefined)(text)) {
      setContent(text);
      onChange?.(text);
    } else if ((0, _Typeguards.isNotNull)(ref) && (0, _Typeguards.isNotNull)(ref.current)) {
      // if called with no argument, read the current innerHTML from the ref
      const currentRefContent = ref.current.innerHTML;
      setContent(currentRefContent);
      onChange?.(currentRefContent);
    }
  }, [onChange, ref]);

  // For separation of concerns, the suggestion handling is kept in a separate hook but is
  // nested here because we do need to be able to update the `content` state in this hook
  // when a user selects a suggestion from the autocomplete menu
  const {
    suggestion,
    onSelect,
    handleCommand,
    handleMention
  } = (0, _useSuggestion.useSuggestion)(ref, setText);
  const enterShouldSend = !(0, _useSettings.useSettingValue)("MessageComposerInput.ctrlEnterToSend");
  const onInput = (0, _react.useCallback)(event => {
    if (isDivElement(event.target)) {
      // if enterShouldSend, we do not need to amend the html before setting text
      const newInnerHTML = enterShouldSend ? event.target.innerHTML : amendInnerHtml(event.target.innerHTML);
      setText(newInnerHTML);
    }
  }, [setText, enterShouldSend]);
  const onPaste = (0, _react.useCallback)(event => {
    const {
      nativeEvent
    } = event;
    let imagePasteWasHandled = false;
    if ((0, _utils.isEventToHandleAsClipboardEvent)(nativeEvent)) {
      const data = nativeEvent instanceof ClipboardEvent ? nativeEvent.clipboardData : nativeEvent.dataTransfer;
      imagePasteWasHandled = (0, _utils.handleClipboardEvent)(nativeEvent, data, roomContext, mxClient, eventRelation);
    }

    // prevent default behaviour and skip call to onInput if the image paste event was handled
    if (imagePasteWasHandled) {
      event.preventDefault();
    } else {
      onInput(event);
    }
  }, [eventRelation, mxClient, onInput, roomContext]);
  const onKeyDown = (0, _react.useCallback)(event => {
    // we need autocomplete to take priority when it is open for using enter to select
    const isHandledByAutocomplete = (0, _utils.handleEventWithAutocomplete)(autocompleteRef, event);
    if (isHandledByAutocomplete) {
      return;
    }

    // resume regular flow
    if (event.key === _Keyboard.Key.ENTER) {
      // TODO use getKeyBindingsManager().getMessageComposerAction(event) like in useInputEventProcessor
      const sendModifierIsPressed = _Keyboard.IS_MAC ? event.metaKey : event.ctrlKey;

      // if enter should send, send if the user is not pushing shift
      if (enterShouldSend && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        send();
      }

      // if enter should not send, send only if the user is pushing ctrl/cmd
      if (!enterShouldSend && sendModifierIsPressed) {
        event.preventDefault();
        event.stopPropagation();
        send();
      }
    }
  }, [autocompleteRef, enterShouldSend, send]);
  return {
    ref,
    autocompleteRef,
    onBeforeInput: onPaste,
    onInput,
    onPaste,
    onKeyDown,
    content,
    setContent: setText,
    suggestion,
    onSelect,
    handleCommand,
    handleMention
  };
}
//# sourceMappingURL=usePlainTextListeners.js.map