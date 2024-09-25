"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.MAC_ONLY_SHORTCUTS = exports.KeyBindingAction = exports.KEY_ICON = exports.KEYBOARD_SHORTCUTS = exports.DIGITS = exports.DESKTOP_SHORTCUTS = exports.CategoryName = exports.CATEGORIES = exports.ALTERNATE_KEY_NAME = void 0;
var _languageHandler = require("../languageHandler");
var _Keyboard = require("../Keyboard");
/*
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2022 The Matrix.org Foundation C.I.C.
Copyright 2021 - 2022 Šimon Brandner <simon.bra.ag@gmail.com>

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
let KeyBindingAction = /*#__PURE__*/function (KeyBindingAction) {
  KeyBindingAction["SendMessage"] = "KeyBinding.sendMessageInComposer";
  KeyBindingAction["SelectPrevSendHistory"] = "KeyBinding.previousMessageInComposerHistory";
  KeyBindingAction["SelectNextSendHistory"] = "KeyBinding.nextMessageInComposerHistory";
  KeyBindingAction["EditPrevMessage"] = "KeyBinding.editPreviousMessage";
  KeyBindingAction["EditNextMessage"] = "KeyBinding.editNextMessage";
  KeyBindingAction["CancelReplyOrEdit"] = "KeyBinding.cancelReplyInComposer";
  KeyBindingAction["ShowStickerPicker"] = "KeyBinding.showStickerPicker";
  KeyBindingAction["FormatBold"] = "KeyBinding.toggleBoldInComposer";
  KeyBindingAction["FormatItalics"] = "KeyBinding.toggleItalicsInComposer";
  KeyBindingAction["FormatLink"] = "KeyBinding.FormatLink";
  KeyBindingAction["FormatCode"] = "KeyBinding.FormatCode";
  KeyBindingAction["FormatQuote"] = "KeyBinding.toggleQuoteInComposer";
  KeyBindingAction["EditUndo"] = "KeyBinding.editUndoInComposer";
  KeyBindingAction["EditRedo"] = "KeyBinding.editRedoInComposer";
  KeyBindingAction["NewLine"] = "KeyBinding.newLineInComposer";
  KeyBindingAction["MoveCursorToStart"] = "KeyBinding.jumpToStartInComposer";
  KeyBindingAction["MoveCursorToEnd"] = "KeyBinding.jumpToEndInComposer";
  KeyBindingAction["CompleteAutocomplete"] = "KeyBinding.completeAutocomplete";
  KeyBindingAction["ForceCompleteAutocomplete"] = "KeyBinding.forceCompleteAutocomplete";
  KeyBindingAction["PrevSelectionInAutocomplete"] = "KeyBinding.previousOptionInAutoComplete";
  KeyBindingAction["NextSelectionInAutocomplete"] = "KeyBinding.nextOptionInAutoComplete";
  KeyBindingAction["CancelAutocomplete"] = "KeyBinding.cancelAutoComplete";
  KeyBindingAction["ClearRoomFilter"] = "KeyBinding.clearRoomFilter";
  KeyBindingAction["PrevRoom"] = "KeyBinding.downerRoom";
  KeyBindingAction["NextRoom"] = "KeyBinding.upperRoom";
  KeyBindingAction["SelectRoomInRoomList"] = "KeyBinding.selectRoomInRoomList";
  KeyBindingAction["CollapseRoomListSection"] = "KeyBinding.collapseSectionInRoomList";
  KeyBindingAction["ExpandRoomListSection"] = "KeyBinding.expandSectionInRoomList";
  KeyBindingAction["ScrollUp"] = "KeyBinding.scrollUpInTimeline";
  KeyBindingAction["ScrollDown"] = "KeyBinding.scrollDownInTimeline";
  KeyBindingAction["DismissReadMarker"] = "KeyBinding.dismissReadMarkerAndJumpToBottom";
  KeyBindingAction["JumpToOldestUnread"] = "KeyBinding.jumpToOldestUnreadMessage";
  KeyBindingAction["UploadFile"] = "KeyBinding.uploadFileToRoom";
  KeyBindingAction["SearchInRoom"] = "KeyBinding.searchInRoom";
  KeyBindingAction["JumpToFirstMessage"] = "KeyBinding.jumpToFirstMessageInTimeline";
  KeyBindingAction["JumpToLatestMessage"] = "KeyBinding.jumpToLastMessageInTimeline";
  KeyBindingAction["FilterRooms"] = "KeyBinding.filterRooms";
  KeyBindingAction["ToggleSpacePanel"] = "KeyBinding.toggleSpacePanel";
  KeyBindingAction["ToggleRoomSidePanel"] = "KeyBinding.toggleRightPanel";
  KeyBindingAction["ToggleUserMenu"] = "KeyBinding.toggleTopLeftMenu";
  KeyBindingAction["ShowKeyboardSettings"] = "KeyBinding.showKeyBindingsSettings";
  KeyBindingAction["GoToHome"] = "KeyBinding.goToHomeView";
  KeyBindingAction["SelectPrevRoom"] = "KeyBinding.previousRoom";
  KeyBindingAction["SelectNextRoom"] = "KeyBinding.nextRoom";
  KeyBindingAction["SelectPrevUnreadRoom"] = "KeyBinding.previousUnreadRoom";
  KeyBindingAction["SelectNextUnreadRoom"] = "KeyBinding.nextUnreadRoom";
  KeyBindingAction["SwitchToSpaceByNumber"] = "KeyBinding.switchToSpaceByNumber";
  KeyBindingAction["OpenUserSettings"] = "KeyBinding.openUserSettings";
  KeyBindingAction["PreviousVisitedRoomOrSpace"] = "KeyBinding.PreviousVisitedRoomOrSpace";
  KeyBindingAction["NextVisitedRoomOrSpace"] = "KeyBinding.NextVisitedRoomOrSpace";
  KeyBindingAction["ToggleMicInCall"] = "KeyBinding.toggleMicInCall";
  KeyBindingAction["ToggleWebcamInCall"] = "KeyBinding.toggleWebcamInCall";
  KeyBindingAction["Escape"] = "KeyBinding.escape";
  KeyBindingAction["Enter"] = "KeyBinding.enter";
  KeyBindingAction["Space"] = "KeyBinding.space";
  KeyBindingAction["Backspace"] = "KeyBinding.backspace";
  KeyBindingAction["Delete"] = "KeyBinding.delete";
  KeyBindingAction["Home"] = "KeyBinding.home";
  KeyBindingAction["End"] = "KeyBinding.end";
  KeyBindingAction["ArrowLeft"] = "KeyBinding.arrowLeft";
  KeyBindingAction["ArrowUp"] = "KeyBinding.arrowUp";
  KeyBindingAction["ArrowRight"] = "KeyBinding.arrowRight";
  KeyBindingAction["ArrowDown"] = "KeyBinding.arrowDown";
  KeyBindingAction["Tab"] = "KeyBinding.tab";
  KeyBindingAction["Comma"] = "KeyBinding.comma";
  KeyBindingAction["ToggleHiddenEventVisibility"] = "KeyBinding.toggleHiddenEventVisibility";
  return KeyBindingAction;
}({}); // TODO: We should figure out what to do with the keyboard shortcuts that are not handled by KeybindingManager
exports.KeyBindingAction = KeyBindingAction;
let CategoryName = /*#__PURE__*/function (CategoryName) {
  CategoryName["NAVIGATION"] = "Navigation";
  CategoryName["ACCESSIBILITY"] = "Accessibility";
  CategoryName["CALLS"] = "Calls";
  CategoryName["COMPOSER"] = "Composer";
  CategoryName["ROOM_LIST"] = "Room List";
  CategoryName["ROOM"] = "Room";
  CategoryName["AUTOCOMPLETE"] = "Autocomplete";
  CategoryName["LABS"] = "Labs";
  return CategoryName;
}({}); // Meta-key representing the digits [0-9] often found at the top of standard keyboard layouts
exports.CategoryName = CategoryName;
const DIGITS = "digits";
exports.DIGITS = DIGITS;
const ALTERNATE_KEY_NAME = {
  [_Keyboard.Key.PAGE_UP]: (0, _languageHandler._td)("Page Up"),
  [_Keyboard.Key.PAGE_DOWN]: (0, _languageHandler._td)("Page Down"),
  [_Keyboard.Key.ESCAPE]: (0, _languageHandler._td)("Esc"),
  [_Keyboard.Key.ENTER]: (0, _languageHandler._td)("Enter"),
  [_Keyboard.Key.SPACE]: (0, _languageHandler._td)("Space"),
  [_Keyboard.Key.HOME]: (0, _languageHandler._td)("Home"),
  [_Keyboard.Key.END]: (0, _languageHandler._td)("End"),
  [_Keyboard.Key.ALT]: (0, _languageHandler._td)("Alt"),
  [_Keyboard.Key.CONTROL]: (0, _languageHandler._td)("Ctrl"),
  [_Keyboard.Key.SHIFT]: (0, _languageHandler._td)("Shift"),
  [DIGITS]: (0, _languageHandler._td)("[number]")
};
exports.ALTERNATE_KEY_NAME = ALTERNATE_KEY_NAME;
const KEY_ICON = {
  [_Keyboard.Key.ARROW_UP]: "↑",
  [_Keyboard.Key.ARROW_DOWN]: "↓",
  [_Keyboard.Key.ARROW_LEFT]: "←",
  [_Keyboard.Key.ARROW_RIGHT]: "→"
};
exports.KEY_ICON = KEY_ICON;
if (_Keyboard.IS_MAC) {
  KEY_ICON[_Keyboard.Key.META] = "⌘";
  KEY_ICON[_Keyboard.Key.ALT] = "⌥";
}
const CATEGORIES = {
  [CategoryName.COMPOSER]: {
    categoryLabel: (0, _languageHandler._td)("Composer"),
    settingNames: [KeyBindingAction.SendMessage, KeyBindingAction.NewLine, KeyBindingAction.FormatBold, KeyBindingAction.FormatItalics, KeyBindingAction.FormatQuote, KeyBindingAction.FormatLink, KeyBindingAction.FormatCode, KeyBindingAction.EditUndo, KeyBindingAction.EditRedo, KeyBindingAction.MoveCursorToStart, KeyBindingAction.MoveCursorToEnd, KeyBindingAction.CancelReplyOrEdit, KeyBindingAction.EditNextMessage, KeyBindingAction.EditPrevMessage, KeyBindingAction.SelectNextSendHistory, KeyBindingAction.SelectPrevSendHistory, KeyBindingAction.ShowStickerPicker]
  },
  [CategoryName.CALLS]: {
    categoryLabel: (0, _languageHandler._td)("Calls"),
    settingNames: [KeyBindingAction.ToggleMicInCall, KeyBindingAction.ToggleWebcamInCall]
  },
  [CategoryName.ROOM]: {
    categoryLabel: (0, _languageHandler._td)("Room"),
    settingNames: [KeyBindingAction.SearchInRoom, KeyBindingAction.UploadFile, KeyBindingAction.DismissReadMarker, KeyBindingAction.JumpToOldestUnread, KeyBindingAction.ScrollUp, KeyBindingAction.ScrollDown, KeyBindingAction.JumpToFirstMessage, KeyBindingAction.JumpToLatestMessage]
  },
  [CategoryName.ROOM_LIST]: {
    categoryLabel: (0, _languageHandler._td)("Room List"),
    settingNames: [KeyBindingAction.SelectRoomInRoomList, KeyBindingAction.ClearRoomFilter, KeyBindingAction.CollapseRoomListSection, KeyBindingAction.ExpandRoomListSection, KeyBindingAction.NextRoom, KeyBindingAction.PrevRoom]
  },
  [CategoryName.ACCESSIBILITY]: {
    categoryLabel: (0, _languageHandler._td)("Accessibility"),
    settingNames: [KeyBindingAction.Escape, KeyBindingAction.Enter, KeyBindingAction.Space, KeyBindingAction.Backspace, KeyBindingAction.Delete, KeyBindingAction.Home, KeyBindingAction.End, KeyBindingAction.ArrowLeft, KeyBindingAction.ArrowUp, KeyBindingAction.ArrowRight, KeyBindingAction.ArrowDown, KeyBindingAction.Comma]
  },
  [CategoryName.NAVIGATION]: {
    categoryLabel: (0, _languageHandler._td)("Navigation"),
    settingNames: [KeyBindingAction.ToggleUserMenu, KeyBindingAction.ToggleRoomSidePanel, KeyBindingAction.ToggleSpacePanel, KeyBindingAction.ShowKeyboardSettings, KeyBindingAction.GoToHome, KeyBindingAction.FilterRooms, KeyBindingAction.SelectNextUnreadRoom, KeyBindingAction.SelectPrevUnreadRoom, KeyBindingAction.SelectNextRoom, KeyBindingAction.SelectPrevRoom, KeyBindingAction.OpenUserSettings, KeyBindingAction.SwitchToSpaceByNumber, KeyBindingAction.PreviousVisitedRoomOrSpace, KeyBindingAction.NextVisitedRoomOrSpace]
  },
  [CategoryName.AUTOCOMPLETE]: {
    categoryLabel: (0, _languageHandler._td)("Autocomplete"),
    settingNames: [KeyBindingAction.CancelAutocomplete, KeyBindingAction.NextSelectionInAutocomplete, KeyBindingAction.PrevSelectionInAutocomplete, KeyBindingAction.CompleteAutocomplete, KeyBindingAction.ForceCompleteAutocomplete]
  },
  [CategoryName.LABS]: {
    categoryLabel: (0, _languageHandler._td)("Labs"),
    settingNames: [KeyBindingAction.ToggleHiddenEventVisibility]
  }
};
exports.CATEGORIES = CATEGORIES;
const DESKTOP_SHORTCUTS = [KeyBindingAction.OpenUserSettings, KeyBindingAction.SwitchToSpaceByNumber, KeyBindingAction.PreviousVisitedRoomOrSpace, KeyBindingAction.NextVisitedRoomOrSpace];
exports.DESKTOP_SHORTCUTS = DESKTOP_SHORTCUTS;
const MAC_ONLY_SHORTCUTS = [KeyBindingAction.OpenUserSettings];

// This is very intentionally modelled after SETTINGS as it will make it easier
// to implement customizable keyboard shortcuts
// TODO: TravisR will fix this nightmare when the new version of the SettingsStore becomes a thing
// XXX: Exported for tests
exports.MAC_ONLY_SHORTCUTS = MAC_ONLY_SHORTCUTS;
const KEYBOARD_SHORTCUTS = {
  [KeyBindingAction.FormatBold]: {
    default: {
      ctrlOrCmdKey: true,
      key: _Keyboard.Key.B
    },
    displayName: (0, _languageHandler._td)("Toggle Bold")
  },
  [KeyBindingAction.FormatItalics]: {
    default: {
      ctrlOrCmdKey: true,
      key: _Keyboard.Key.I
    },
    displayName: (0, _languageHandler._td)("Toggle Italics")
  },
  [KeyBindingAction.FormatQuote]: {
    default: {
      ctrlOrCmdKey: true,
      shiftKey: true,
      key: _Keyboard.Key.GREATER_THAN
    },
    displayName: (0, _languageHandler._td)("Toggle Quote")
  },
  [KeyBindingAction.FormatCode]: {
    default: {
      ctrlOrCmdKey: true,
      key: _Keyboard.Key.E
    },
    displayName: (0, _languageHandler._td)("Toggle Code Block")
  },
  [KeyBindingAction.FormatLink]: {
    default: {
      ctrlOrCmdKey: true,
      shiftKey: true,
      key: _Keyboard.Key.L
    },
    displayName: (0, _languageHandler._td)("Toggle Link")
  },
  [KeyBindingAction.CancelReplyOrEdit]: {
    default: {
      key: _Keyboard.Key.ESCAPE
    },
    displayName: (0, _languageHandler._td)("Cancel replying to a message")
  },
  [KeyBindingAction.EditNextMessage]: {
    default: {
      key: _Keyboard.Key.ARROW_DOWN
    },
    displayName: (0, _languageHandler._td)("Navigate to next message to edit")
  },
  [KeyBindingAction.EditPrevMessage]: {
    default: {
      key: _Keyboard.Key.ARROW_UP
    },
    displayName: (0, _languageHandler._td)("Navigate to previous message to edit")
  },
  [KeyBindingAction.MoveCursorToStart]: {
    default: {
      ctrlOrCmdKey: true,
      key: _Keyboard.Key.HOME
    },
    displayName: (0, _languageHandler._td)("Jump to start of the composer")
  },
  [KeyBindingAction.MoveCursorToEnd]: {
    default: {
      ctrlOrCmdKey: true,
      key: _Keyboard.Key.END
    },
    displayName: (0, _languageHandler._td)("Jump to end of the composer")
  },
  [KeyBindingAction.SelectNextSendHistory]: {
    default: {
      altKey: true,
      ctrlKey: true,
      key: _Keyboard.Key.ARROW_DOWN
    },
    displayName: (0, _languageHandler._td)("Navigate to next message in composer history")
  },
  [KeyBindingAction.SelectPrevSendHistory]: {
    default: {
      altKey: true,
      ctrlKey: true,
      key: _Keyboard.Key.ARROW_UP
    },
    displayName: (0, _languageHandler._td)("Navigate to previous message in composer history")
  },
  [KeyBindingAction.ShowStickerPicker]: {
    default: {
      ctrlOrCmdKey: true,
      key: _Keyboard.Key.SEMICOLON
    },
    displayName: (0, _languageHandler._td)("Send a sticker")
  },
  [KeyBindingAction.ToggleMicInCall]: {
    default: {
      ctrlOrCmdKey: true,
      key: _Keyboard.Key.D
    },
    displayName: (0, _languageHandler._td)("Toggle microphone mute")
  },
  [KeyBindingAction.ToggleWebcamInCall]: {
    default: {
      ctrlOrCmdKey: true,
      key: _Keyboard.Key.E
    },
    displayName: (0, _languageHandler._td)("Toggle webcam on/off")
  },
  [KeyBindingAction.DismissReadMarker]: {
    default: {
      key: _Keyboard.Key.ESCAPE
    },
    displayName: (0, _languageHandler._td)("Dismiss read marker and jump to bottom")
  },
  [KeyBindingAction.JumpToOldestUnread]: {
    default: {
      shiftKey: true,
      key: _Keyboard.Key.PAGE_UP
    },
    displayName: (0, _languageHandler._td)("Jump to oldest unread message")
  },
  [KeyBindingAction.UploadFile]: {
    default: {
      ctrlOrCmdKey: true,
      shiftKey: true,
      key: _Keyboard.Key.U
    },
    displayName: (0, _languageHandler._td)("Upload a file")
  },
  [KeyBindingAction.ScrollUp]: {
    default: {
      key: _Keyboard.Key.PAGE_UP
    },
    displayName: (0, _languageHandler._td)("Scroll up in the timeline")
  },
  [KeyBindingAction.ScrollDown]: {
    default: {
      key: _Keyboard.Key.PAGE_DOWN
    },
    displayName: (0, _languageHandler._td)("Scroll down in the timeline")
  },
  [KeyBindingAction.FilterRooms]: {
    default: {
      ctrlOrCmdKey: true,
      key: _Keyboard.Key.K
    },
    displayName: (0, _languageHandler._td)("Jump to room search")
  },
  [KeyBindingAction.SelectRoomInRoomList]: {
    default: {
      key: _Keyboard.Key.ENTER
    },
    displayName: (0, _languageHandler._td)("Select room from the room list")
  },
  [KeyBindingAction.CollapseRoomListSection]: {
    default: {
      key: _Keyboard.Key.ARROW_LEFT
    },
    displayName: (0, _languageHandler._td)("Collapse room list section")
  },
  [KeyBindingAction.ExpandRoomListSection]: {
    default: {
      key: _Keyboard.Key.ARROW_RIGHT
    },
    displayName: (0, _languageHandler._td)("Expand room list section")
  },
  [KeyBindingAction.NextRoom]: {
    default: {
      key: _Keyboard.Key.ARROW_DOWN
    },
    displayName: (0, _languageHandler._td)("Navigate down in the room list")
  },
  [KeyBindingAction.PrevRoom]: {
    default: {
      key: _Keyboard.Key.ARROW_UP
    },
    displayName: (0, _languageHandler._td)("Navigate up in the room list")
  },
  [KeyBindingAction.ToggleUserMenu]: {
    default: {
      ctrlOrCmdKey: true,
      key: _Keyboard.Key.BACKTICK
    },
    displayName: (0, _languageHandler._td)("Toggle the top left menu")
  },
  [KeyBindingAction.ToggleRoomSidePanel]: {
    default: {
      ctrlOrCmdKey: true,
      key: _Keyboard.Key.PERIOD
    },
    displayName: (0, _languageHandler._td)("Toggle right panel")
  },
  [KeyBindingAction.ShowKeyboardSettings]: {
    default: {
      ctrlOrCmdKey: true,
      key: _Keyboard.Key.SLASH
    },
    displayName: (0, _languageHandler._td)("Open this settings tab")
  },
  [KeyBindingAction.GoToHome]: {
    default: {
      ctrlOrCmdKey: true,
      altKey: !_Keyboard.IS_MAC,
      shiftKey: _Keyboard.IS_MAC,
      key: _Keyboard.Key.H
    },
    displayName: (0, _languageHandler._td)("Go to Home View")
  },
  [KeyBindingAction.SelectNextUnreadRoom]: {
    default: {
      shiftKey: true,
      altKey: true,
      key: _Keyboard.Key.ARROW_DOWN
    },
    displayName: (0, _languageHandler._td)("Next unread room or DM")
  },
  [KeyBindingAction.SelectPrevUnreadRoom]: {
    default: {
      shiftKey: true,
      altKey: true,
      key: _Keyboard.Key.ARROW_UP
    },
    displayName: (0, _languageHandler._td)("Previous unread room or DM")
  },
  [KeyBindingAction.SelectNextRoom]: {
    default: {
      altKey: true,
      key: _Keyboard.Key.ARROW_DOWN
    },
    displayName: (0, _languageHandler._td)("Next room or DM")
  },
  [KeyBindingAction.SelectPrevRoom]: {
    default: {
      altKey: true,
      key: _Keyboard.Key.ARROW_UP
    },
    displayName: (0, _languageHandler._td)("Previous room or DM")
  },
  [KeyBindingAction.CancelAutocomplete]: {
    default: {
      key: _Keyboard.Key.ESCAPE
    },
    displayName: (0, _languageHandler._td)("Cancel autocomplete")
  },
  [KeyBindingAction.NextSelectionInAutocomplete]: {
    default: {
      key: _Keyboard.Key.ARROW_DOWN
    },
    displayName: (0, _languageHandler._td)("Next autocomplete suggestion")
  },
  [KeyBindingAction.PrevSelectionInAutocomplete]: {
    default: {
      key: _Keyboard.Key.ARROW_UP
    },
    displayName: (0, _languageHandler._td)("Previous autocomplete suggestion")
  },
  [KeyBindingAction.ToggleSpacePanel]: {
    default: {
      ctrlOrCmdKey: true,
      shiftKey: true,
      key: _Keyboard.Key.D
    },
    displayName: (0, _languageHandler._td)("Toggle space panel")
  },
  [KeyBindingAction.ToggleHiddenEventVisibility]: {
    default: {
      ctrlOrCmdKey: true,
      shiftKey: true,
      key: _Keyboard.Key.H
    },
    displayName: (0, _languageHandler._td)("Toggle hidden event visibility")
  },
  [KeyBindingAction.JumpToFirstMessage]: {
    default: {
      key: _Keyboard.Key.HOME,
      ctrlKey: true
    },
    displayName: (0, _languageHandler._td)("Jump to first message")
  },
  [KeyBindingAction.JumpToLatestMessage]: {
    default: {
      key: _Keyboard.Key.END,
      ctrlKey: true
    },
    displayName: (0, _languageHandler._td)("Jump to last message")
  },
  [KeyBindingAction.EditUndo]: {
    default: {
      key: _Keyboard.Key.Z,
      ctrlOrCmdKey: true
    },
    displayName: (0, _languageHandler._td)("Undo edit")
  },
  [KeyBindingAction.EditRedo]: {
    default: {
      key: _Keyboard.IS_MAC ? _Keyboard.Key.Z : _Keyboard.Key.Y,
      ctrlOrCmdKey: true,
      shiftKey: _Keyboard.IS_MAC
    },
    displayName: (0, _languageHandler._td)("Redo edit")
  },
  [KeyBindingAction.PreviousVisitedRoomOrSpace]: {
    default: {
      metaKey: _Keyboard.IS_MAC,
      altKey: !_Keyboard.IS_MAC,
      key: _Keyboard.IS_MAC ? _Keyboard.Key.SQUARE_BRACKET_LEFT : _Keyboard.Key.ARROW_LEFT
    },
    displayName: (0, _languageHandler._td)("Previous recently visited room or space")
  },
  [KeyBindingAction.NextVisitedRoomOrSpace]: {
    default: {
      metaKey: _Keyboard.IS_MAC,
      altKey: !_Keyboard.IS_MAC,
      key: _Keyboard.IS_MAC ? _Keyboard.Key.SQUARE_BRACKET_RIGHT : _Keyboard.Key.ARROW_RIGHT
    },
    displayName: (0, _languageHandler._td)("Next recently visited room or space")
  },
  [KeyBindingAction.SwitchToSpaceByNumber]: {
    default: {
      ctrlOrCmdKey: true,
      key: DIGITS
    },
    displayName: (0, _languageHandler._td)("Switch to space by number")
  },
  [KeyBindingAction.OpenUserSettings]: {
    default: {
      metaKey: true,
      key: _Keyboard.Key.COMMA
    },
    displayName: (0, _languageHandler._td)("Open user settings")
  },
  [KeyBindingAction.Escape]: {
    default: {
      key: _Keyboard.Key.ESCAPE
    },
    displayName: (0, _languageHandler._td)("Close dialog or context menu")
  },
  [KeyBindingAction.Enter]: {
    default: {
      key: _Keyboard.Key.ENTER
    },
    displayName: (0, _languageHandler._td)("Activate selected button")
  },
  [KeyBindingAction.Space]: {
    default: {
      key: _Keyboard.Key.SPACE
    }
  },
  [KeyBindingAction.Backspace]: {
    default: {
      key: _Keyboard.Key.BACKSPACE
    }
  },
  [KeyBindingAction.Delete]: {
    default: {
      key: _Keyboard.Key.DELETE
    }
  },
  [KeyBindingAction.Home]: {
    default: {
      key: _Keyboard.Key.HOME
    }
  },
  [KeyBindingAction.End]: {
    default: {
      key: _Keyboard.Key.END
    }
  },
  [KeyBindingAction.ArrowLeft]: {
    default: {
      key: _Keyboard.Key.ARROW_LEFT
    }
  },
  [KeyBindingAction.ArrowUp]: {
    default: {
      key: _Keyboard.Key.ARROW_UP
    }
  },
  [KeyBindingAction.ArrowRight]: {
    default: {
      key: _Keyboard.Key.ARROW_RIGHT
    }
  },
  [KeyBindingAction.ArrowDown]: {
    default: {
      key: _Keyboard.Key.ARROW_DOWN
    }
  },
  [KeyBindingAction.Comma]: {
    default: {
      key: _Keyboard.Key.COMMA
    }
  }
};
exports.KEYBOARD_SHORTCUTS = KEYBOARD_SHORTCUTS;
//# sourceMappingURL=KeyboardShortcuts.js.map