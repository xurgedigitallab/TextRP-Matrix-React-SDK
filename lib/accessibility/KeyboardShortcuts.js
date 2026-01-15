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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfbGFuZ3VhZ2VIYW5kbGVyIiwicmVxdWlyZSIsIl9LZXlib2FyZCIsIktleUJpbmRpbmdBY3Rpb24iLCJleHBvcnRzIiwiQ2F0ZWdvcnlOYW1lIiwiRElHSVRTIiwiQUxURVJOQVRFX0tFWV9OQU1FIiwiS2V5IiwiUEFHRV9VUCIsIl90ZCIsIlBBR0VfRE9XTiIsIkVTQ0FQRSIsIkVOVEVSIiwiU1BBQ0UiLCJIT01FIiwiRU5EIiwiQUxUIiwiQ09OVFJPTCIsIlNISUZUIiwiS0VZX0lDT04iLCJBUlJPV19VUCIsIkFSUk9XX0RPV04iLCJBUlJPV19MRUZUIiwiQVJST1dfUklHSFQiLCJJU19NQUMiLCJNRVRBIiwiQ0FURUdPUklFUyIsIkNPTVBPU0VSIiwiY2F0ZWdvcnlMYWJlbCIsInNldHRpbmdOYW1lcyIsIlNlbmRNZXNzYWdlIiwiTmV3TGluZSIsIkZvcm1hdEJvbGQiLCJGb3JtYXRJdGFsaWNzIiwiRm9ybWF0UXVvdGUiLCJGb3JtYXRMaW5rIiwiRm9ybWF0Q29kZSIsIkVkaXRVbmRvIiwiRWRpdFJlZG8iLCJNb3ZlQ3Vyc29yVG9TdGFydCIsIk1vdmVDdXJzb3JUb0VuZCIsIkNhbmNlbFJlcGx5T3JFZGl0IiwiRWRpdE5leHRNZXNzYWdlIiwiRWRpdFByZXZNZXNzYWdlIiwiU2VsZWN0TmV4dFNlbmRIaXN0b3J5IiwiU2VsZWN0UHJldlNlbmRIaXN0b3J5IiwiU2hvd1N0aWNrZXJQaWNrZXIiLCJDQUxMUyIsIlRvZ2dsZU1pY0luQ2FsbCIsIlRvZ2dsZVdlYmNhbUluQ2FsbCIsIlJPT00iLCJTZWFyY2hJblJvb20iLCJVcGxvYWRGaWxlIiwiRGlzbWlzc1JlYWRNYXJrZXIiLCJKdW1wVG9PbGRlc3RVbnJlYWQiLCJTY3JvbGxVcCIsIlNjcm9sbERvd24iLCJKdW1wVG9GaXJzdE1lc3NhZ2UiLCJKdW1wVG9MYXRlc3RNZXNzYWdlIiwiUk9PTV9MSVNUIiwiU2VsZWN0Um9vbUluUm9vbUxpc3QiLCJDbGVhclJvb21GaWx0ZXIiLCJDb2xsYXBzZVJvb21MaXN0U2VjdGlvbiIsIkV4cGFuZFJvb21MaXN0U2VjdGlvbiIsIk5leHRSb29tIiwiUHJldlJvb20iLCJBQ0NFU1NJQklMSVRZIiwiRXNjYXBlIiwiRW50ZXIiLCJTcGFjZSIsIkJhY2tzcGFjZSIsIkRlbGV0ZSIsIkhvbWUiLCJFbmQiLCJBcnJvd0xlZnQiLCJBcnJvd1VwIiwiQXJyb3dSaWdodCIsIkFycm93RG93biIsIkNvbW1hIiwiTkFWSUdBVElPTiIsIlRvZ2dsZVVzZXJNZW51IiwiVG9nZ2xlUm9vbVNpZGVQYW5lbCIsIlRvZ2dsZVNwYWNlUGFuZWwiLCJTaG93S2V5Ym9hcmRTZXR0aW5ncyIsIkdvVG9Ib21lIiwiRmlsdGVyUm9vbXMiLCJTZWxlY3ROZXh0VW5yZWFkUm9vbSIsIlNlbGVjdFByZXZVbnJlYWRSb29tIiwiU2VsZWN0TmV4dFJvb20iLCJTZWxlY3RQcmV2Um9vbSIsIk9wZW5Vc2VyU2V0dGluZ3MiLCJTd2l0Y2hUb1NwYWNlQnlOdW1iZXIiLCJQcmV2aW91c1Zpc2l0ZWRSb29tT3JTcGFjZSIsIk5leHRWaXNpdGVkUm9vbU9yU3BhY2UiLCJBVVRPQ09NUExFVEUiLCJDYW5jZWxBdXRvY29tcGxldGUiLCJOZXh0U2VsZWN0aW9uSW5BdXRvY29tcGxldGUiLCJQcmV2U2VsZWN0aW9uSW5BdXRvY29tcGxldGUiLCJDb21wbGV0ZUF1dG9jb21wbGV0ZSIsIkZvcmNlQ29tcGxldGVBdXRvY29tcGxldGUiLCJMQUJTIiwiVG9nZ2xlSGlkZGVuRXZlbnRWaXNpYmlsaXR5IiwiREVTS1RPUF9TSE9SVENVVFMiLCJNQUNfT05MWV9TSE9SVENVVFMiLCJLRVlCT0FSRF9TSE9SVENVVFMiLCJkZWZhdWx0IiwiY3RybE9yQ21kS2V5Iiwia2V5IiwiQiIsImRpc3BsYXlOYW1lIiwiSSIsInNoaWZ0S2V5IiwiR1JFQVRFUl9USEFOIiwiRSIsIkwiLCJhbHRLZXkiLCJjdHJsS2V5IiwiU0VNSUNPTE9OIiwiRCIsIlUiLCJLIiwiQkFDS1RJQ0siLCJQRVJJT0QiLCJTTEFTSCIsIkgiLCJaIiwiWSIsIm1ldGFLZXkiLCJTUVVBUkVfQlJBQ0tFVF9MRUZUIiwiU1FVQVJFX0JSQUNLRVRfUklHSFQiLCJDT01NQSIsIkJBQ0tTUEFDRSIsIkRFTEVURSJdLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9hY2Nlc3NpYmlsaXR5L0tleWJvYXJkU2hvcnRjdXRzLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qXG5Db3B5cmlnaHQgMjAyMCBUaGUgTWF0cml4Lm9yZyBGb3VuZGF0aW9uIEMuSS5DLlxuQ29weXJpZ2h0IDIwMjIgVGhlIE1hdHJpeC5vcmcgRm91bmRhdGlvbiBDLkkuQy5cbkNvcHlyaWdodCAyMDIxIC0gMjAyMiDFoGltb24gQnJhbmRuZXIgPHNpbW9uLmJyYS5hZ0BnbWFpbC5jb20+XG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuKi9cblxuaW1wb3J0IHsgX3RkIH0gZnJvbSBcIi4uL2xhbmd1YWdlSGFuZGxlclwiO1xuaW1wb3J0IHsgSVNfTUFDLCBLZXkgfSBmcm9tIFwiLi4vS2V5Ym9hcmRcIjtcbmltcG9ydCB7IElCYXNlU2V0dGluZyB9IGZyb20gXCIuLi9zZXR0aW5ncy9TZXR0aW5nc1wiO1xuaW1wb3J0IHsgS2V5Q29tYm8gfSBmcm9tIFwiLi4vS2V5QmluZGluZ3NNYW5hZ2VyXCI7XG5cbmV4cG9ydCBlbnVtIEtleUJpbmRpbmdBY3Rpb24ge1xuICAgIC8qKiBTZW5kIGEgbWVzc2FnZSAqL1xuICAgIFNlbmRNZXNzYWdlID0gXCJLZXlCaW5kaW5nLnNlbmRNZXNzYWdlSW5Db21wb3NlclwiLFxuICAgIC8qKiBHbyBiYWNrd2FyZHMgdGhyb3VnaCB0aGUgc2VuZCBoaXN0b3J5IGFuZCB1c2UgdGhlIG1lc3NhZ2UgaW4gY29tcG9zZXIgdmlldyAqL1xuICAgIFNlbGVjdFByZXZTZW5kSGlzdG9yeSA9IFwiS2V5QmluZGluZy5wcmV2aW91c01lc3NhZ2VJbkNvbXBvc2VySGlzdG9yeVwiLFxuICAgIC8qKiBHbyBmb3J3YXJkcyB0aHJvdWdoIHRoZSBzZW5kIGhpc3RvcnkgKi9cbiAgICBTZWxlY3ROZXh0U2VuZEhpc3RvcnkgPSBcIktleUJpbmRpbmcubmV4dE1lc3NhZ2VJbkNvbXBvc2VySGlzdG9yeVwiLFxuICAgIC8qKiBTdGFydCBlZGl0aW5nIHRoZSB1c2VyJ3MgbGFzdCBzZW50IG1lc3NhZ2UgKi9cbiAgICBFZGl0UHJldk1lc3NhZ2UgPSBcIktleUJpbmRpbmcuZWRpdFByZXZpb3VzTWVzc2FnZVwiLFxuICAgIC8qKiBTdGFydCBlZGl0aW5nIHRoZSB1c2VyJ3MgbmV4dCBzZW50IG1lc3NhZ2UgKi9cbiAgICBFZGl0TmV4dE1lc3NhZ2UgPSBcIktleUJpbmRpbmcuZWRpdE5leHRNZXNzYWdlXCIsXG4gICAgLyoqIENhbmNlbCBlZGl0aW5nIGEgbWVzc2FnZSBvciBjYW5jZWwgcmVwbHlpbmcgdG8gYSBtZXNzYWdlICovXG4gICAgQ2FuY2VsUmVwbHlPckVkaXQgPSBcIktleUJpbmRpbmcuY2FuY2VsUmVwbHlJbkNvbXBvc2VyXCIsXG4gICAgLyoqIFNob3cgdGhlIHN0aWNrZXIgcGlja2VyICovXG4gICAgU2hvd1N0aWNrZXJQaWNrZXIgPSBcIktleUJpbmRpbmcuc2hvd1N0aWNrZXJQaWNrZXJcIixcblxuICAgIC8qKiBTZXQgYm9sZCBmb3JtYXQgdGhlIGN1cnJlbnQgc2VsZWN0aW9uICovXG4gICAgRm9ybWF0Qm9sZCA9IFwiS2V5QmluZGluZy50b2dnbGVCb2xkSW5Db21wb3NlclwiLFxuICAgIC8qKiBTZXQgaXRhbGljcyBmb3JtYXQgdGhlIGN1cnJlbnQgc2VsZWN0aW9uICovXG4gICAgRm9ybWF0SXRhbGljcyA9IFwiS2V5QmluZGluZy50b2dnbGVJdGFsaWNzSW5Db21wb3NlclwiLFxuICAgIC8qKiBJbnNlcnQgbGluayBmb3IgY3VycmVudCBzZWxlY3Rpb24gKi9cbiAgICBGb3JtYXRMaW5rID0gXCJLZXlCaW5kaW5nLkZvcm1hdExpbmtcIixcbiAgICAvKiogU2V0IGNvZGUgZm9ybWF0IGZvciBjdXJyZW50IHNlbGVjdGlvbiAqL1xuICAgIEZvcm1hdENvZGUgPSBcIktleUJpbmRpbmcuRm9ybWF0Q29kZVwiLFxuICAgIC8qKiBGb3JtYXQgdGhlIGN1cnJlbnQgc2VsZWN0aW9uIGFzIHF1b3RlICovXG4gICAgRm9ybWF0UXVvdGUgPSBcIktleUJpbmRpbmcudG9nZ2xlUXVvdGVJbkNvbXBvc2VyXCIsXG4gICAgLyoqIFVuZG8gdGhlIGxhc3QgZWRpdGluZyAqL1xuICAgIEVkaXRVbmRvID0gXCJLZXlCaW5kaW5nLmVkaXRVbmRvSW5Db21wb3NlclwiLFxuICAgIC8qKiBSZWRvIGVkaXRpbmcgKi9cbiAgICBFZGl0UmVkbyA9IFwiS2V5QmluZGluZy5lZGl0UmVkb0luQ29tcG9zZXJcIixcbiAgICAvKiogSW5zZXJ0IG5ldyBsaW5lICovXG4gICAgTmV3TGluZSA9IFwiS2V5QmluZGluZy5uZXdMaW5lSW5Db21wb3NlclwiLFxuICAgIC8qKiBNb3ZlIHRoZSBjdXJzb3IgdG8gdGhlIHN0YXJ0IG9mIHRoZSBtZXNzYWdlICovXG4gICAgTW92ZUN1cnNvclRvU3RhcnQgPSBcIktleUJpbmRpbmcuanVtcFRvU3RhcnRJbkNvbXBvc2VyXCIsXG4gICAgLyoqIE1vdmUgdGhlIGN1cnNvciB0byB0aGUgZW5kIG9mIHRoZSBtZXNzYWdlICovXG4gICAgTW92ZUN1cnNvclRvRW5kID0gXCJLZXlCaW5kaW5nLmp1bXBUb0VuZEluQ29tcG9zZXJcIixcblxuICAgIC8qKiBBY2NlcHRzIGNob3NlbiBhdXRvY29tcGxldGUgc2VsZWN0aW9uICovXG4gICAgQ29tcGxldGVBdXRvY29tcGxldGUgPSBcIktleUJpbmRpbmcuY29tcGxldGVBdXRvY29tcGxldGVcIixcbiAgICAvKiogQWNjZXB0cyBjaG9zZW4gYXV0b2NvbXBsZXRlIHNlbGVjdGlvbiBvcixcbiAgICAgKiBpZiB0aGUgYXV0b2NvbXBsZXRpb24gd2luZG93IGlzIG5vdCBzaG93biwgb3BlbiB0aGUgd2luZG93IGFuZCBzZWxlY3QgdGhlIGZpcnN0IHNlbGVjdGlvbiAqL1xuICAgIEZvcmNlQ29tcGxldGVBdXRvY29tcGxldGUgPSBcIktleUJpbmRpbmcuZm9yY2VDb21wbGV0ZUF1dG9jb21wbGV0ZVwiLFxuICAgIC8qKiBNb3ZlIHRvIHRoZSBwcmV2aW91cyBhdXRvY29tcGxldGUgc2VsZWN0aW9uICovXG4gICAgUHJldlNlbGVjdGlvbkluQXV0b2NvbXBsZXRlID0gXCJLZXlCaW5kaW5nLnByZXZpb3VzT3B0aW9uSW5BdXRvQ29tcGxldGVcIixcbiAgICAvKiogTW92ZSB0byB0aGUgbmV4dCBhdXRvY29tcGxldGUgc2VsZWN0aW9uICovXG4gICAgTmV4dFNlbGVjdGlvbkluQXV0b2NvbXBsZXRlID0gXCJLZXlCaW5kaW5nLm5leHRPcHRpb25JbkF1dG9Db21wbGV0ZVwiLFxuICAgIC8qKiBDbG9zZSB0aGUgYXV0b2NvbXBsZXRpb24gd2luZG93ICovXG4gICAgQ2FuY2VsQXV0b2NvbXBsZXRlID0gXCJLZXlCaW5kaW5nLmNhbmNlbEF1dG9Db21wbGV0ZVwiLFxuXG4gICAgLyoqIENsZWFyIHJvb20gbGlzdCBmaWx0ZXIgZmllbGQgKi9cbiAgICBDbGVhclJvb21GaWx0ZXIgPSBcIktleUJpbmRpbmcuY2xlYXJSb29tRmlsdGVyXCIsXG4gICAgLyoqIE5hdmlnYXRlIHVwL2Rvd24gaW4gdGhlIHJvb20gbGlzdCAqL1xuICAgIFByZXZSb29tID0gXCJLZXlCaW5kaW5nLmRvd25lclJvb21cIixcbiAgICAvKiogTmF2aWdhdGUgZG93biBpbiB0aGUgcm9vbSBsaXN0ICovXG4gICAgTmV4dFJvb20gPSBcIktleUJpbmRpbmcudXBwZXJSb29tXCIsXG4gICAgLyoqIFNlbGVjdCByb29tIGZyb20gdGhlIHJvb20gbGlzdCAqL1xuICAgIFNlbGVjdFJvb21JblJvb21MaXN0ID0gXCJLZXlCaW5kaW5nLnNlbGVjdFJvb21JblJvb21MaXN0XCIsXG4gICAgLyoqIENvbGxhcHNlIHJvb20gbGlzdCBzZWN0aW9uICovXG4gICAgQ29sbGFwc2VSb29tTGlzdFNlY3Rpb24gPSBcIktleUJpbmRpbmcuY29sbGFwc2VTZWN0aW9uSW5Sb29tTGlzdFwiLFxuICAgIC8qKiBFeHBhbmQgcm9vbSBsaXN0IHNlY3Rpb24sIGlmIGFscmVhZHkgZXhwYW5kZWQsIGp1bXAgdG8gZmlyc3Qgcm9vbSBpbiB0aGUgc2VsZWN0aW9uICovXG4gICAgRXhwYW5kUm9vbUxpc3RTZWN0aW9uID0gXCJLZXlCaW5kaW5nLmV4cGFuZFNlY3Rpb25JblJvb21MaXN0XCIsXG5cbiAgICAvKiogU2Nyb2xsIHVwIGluIHRoZSB0aW1lbGluZSAqL1xuICAgIFNjcm9sbFVwID0gXCJLZXlCaW5kaW5nLnNjcm9sbFVwSW5UaW1lbGluZVwiLFxuICAgIC8qKiBTY3JvbGwgZG93biBpbiB0aGUgdGltZWxpbmUgKi9cbiAgICBTY3JvbGxEb3duID0gXCJLZXlCaW5kaW5nLnNjcm9sbERvd25JblRpbWVsaW5lXCIsXG4gICAgLyoqIERpc21pc3MgcmVhZCBtYXJrZXIgYW5kIGp1bXAgdG8gYm90dG9tICovXG4gICAgRGlzbWlzc1JlYWRNYXJrZXIgPSBcIktleUJpbmRpbmcuZGlzbWlzc1JlYWRNYXJrZXJBbmRKdW1wVG9Cb3R0b21cIixcbiAgICAvKiogSnVtcCB0byBvbGRlc3QgdW5yZWFkIG1lc3NhZ2UgKi9cbiAgICBKdW1wVG9PbGRlc3RVbnJlYWQgPSBcIktleUJpbmRpbmcuanVtcFRvT2xkZXN0VW5yZWFkTWVzc2FnZVwiLFxuICAgIC8qKiBVcGxvYWQgYSBmaWxlICovXG4gICAgVXBsb2FkRmlsZSA9IFwiS2V5QmluZGluZy51cGxvYWRGaWxlVG9Sb29tXCIsXG4gICAgLyoqIEZvY3VzIHNlYXJjaCBtZXNzYWdlIGluIGEgcm9vbSAobXVzdCBiZSBlbmFibGVkKSAqL1xuICAgIFNlYXJjaEluUm9vbSA9IFwiS2V5QmluZGluZy5zZWFyY2hJblJvb21cIixcbiAgICAvKiogSnVtcCB0byB0aGUgZmlyc3QgKGRvd25sb2FkZWQpIG1lc3NhZ2UgaW4gdGhlIHJvb20gKi9cbiAgICBKdW1wVG9GaXJzdE1lc3NhZ2UgPSBcIktleUJpbmRpbmcuanVtcFRvRmlyc3RNZXNzYWdlSW5UaW1lbGluZVwiLFxuICAgIC8qKiBKdW1wIHRvIHRoZSBsYXRlc3QgbWVzc2FnZSBpbiB0aGUgcm9vbSAqL1xuICAgIEp1bXBUb0xhdGVzdE1lc3NhZ2UgPSBcIktleUJpbmRpbmcuanVtcFRvTGFzdE1lc3NhZ2VJblRpbWVsaW5lXCIsXG5cbiAgICAvKiogSnVtcCB0byByb29tIHNlYXJjaCAoc2VhcmNoIGZvciBhIHJvb20pICovXG4gICAgRmlsdGVyUm9vbXMgPSBcIktleUJpbmRpbmcuZmlsdGVyUm9vbXNcIixcbiAgICAvKiogVG9nZ2xlIHRoZSBzcGFjZSBwYW5lbCAqL1xuICAgIFRvZ2dsZVNwYWNlUGFuZWwgPSBcIktleUJpbmRpbmcudG9nZ2xlU3BhY2VQYW5lbFwiLFxuICAgIC8qKiBUb2dnbGUgdGhlIHJvb20gc2lkZSBwYW5lbCAqL1xuICAgIFRvZ2dsZVJvb21TaWRlUGFuZWwgPSBcIktleUJpbmRpbmcudG9nZ2xlUmlnaHRQYW5lbFwiLFxuICAgIC8qKiBUb2dnbGUgdGhlIHVzZXIgbWVudSAqL1xuICAgIFRvZ2dsZVVzZXJNZW51ID0gXCJLZXlCaW5kaW5nLnRvZ2dsZVRvcExlZnRNZW51XCIsXG4gICAgLyoqIFRvZ2dsZSB0aGUgc2hvcnQgY3V0IGhlbHAgZGlhbG9nICovXG4gICAgU2hvd0tleWJvYXJkU2V0dGluZ3MgPSBcIktleUJpbmRpbmcuc2hvd0tleUJpbmRpbmdzU2V0dGluZ3NcIixcbiAgICAvKiogR290IHRvIHRoZSBFbGVtZW50IGhvbWUgc2NyZWVuICovXG4gICAgR29Ub0hvbWUgPSBcIktleUJpbmRpbmcuZ29Ub0hvbWVWaWV3XCIsXG4gICAgLyoqIFNlbGVjdCBwcmV2IHJvb20gKi9cbiAgICBTZWxlY3RQcmV2Um9vbSA9IFwiS2V5QmluZGluZy5wcmV2aW91c1Jvb21cIixcbiAgICAvKiogU2VsZWN0IG5leHQgcm9vbSAqL1xuICAgIFNlbGVjdE5leHRSb29tID0gXCJLZXlCaW5kaW5nLm5leHRSb29tXCIsXG4gICAgLyoqIFNlbGVjdCBwcmV2IHJvb20gd2l0aCB1bnJlYWQgbWVzc2FnZXMgKi9cbiAgICBTZWxlY3RQcmV2VW5yZWFkUm9vbSA9IFwiS2V5QmluZGluZy5wcmV2aW91c1VucmVhZFJvb21cIixcbiAgICAvKiogU2VsZWN0IG5leHQgcm9vbSB3aXRoIHVucmVhZCBtZXNzYWdlcyAqL1xuICAgIFNlbGVjdE5leHRVbnJlYWRSb29tID0gXCJLZXlCaW5kaW5nLm5leHRVbnJlYWRSb29tXCIsXG5cbiAgICAvKiogU3dpdGNoZXMgdG8gYSBzcGFjZSBieSBudW1iZXIgKi9cbiAgICBTd2l0Y2hUb1NwYWNlQnlOdW1iZXIgPSBcIktleUJpbmRpbmcuc3dpdGNoVG9TcGFjZUJ5TnVtYmVyXCIsXG4gICAgLyoqIE9wZW5zIHVzZXIgc2V0dGluZ3MgKi9cbiAgICBPcGVuVXNlclNldHRpbmdzID0gXCJLZXlCaW5kaW5nLm9wZW5Vc2VyU2V0dGluZ3NcIixcbiAgICAvKiogTmF2aWdhdGVzIGJhY2t3YXJkICovXG4gICAgUHJldmlvdXNWaXNpdGVkUm9vbU9yU3BhY2UgPSBcIktleUJpbmRpbmcuUHJldmlvdXNWaXNpdGVkUm9vbU9yU3BhY2VcIixcbiAgICAvKiogTmF2aWdhdGVzIGZvcndhcmQgKi9cbiAgICBOZXh0VmlzaXRlZFJvb21PclNwYWNlID0gXCJLZXlCaW5kaW5nLk5leHRWaXNpdGVkUm9vbU9yU3BhY2VcIixcblxuICAgIC8qKiBUb2dnbGVzIG1pY3JvcGhvbmUgd2hpbGUgb24gYSBjYWxsICovXG4gICAgVG9nZ2xlTWljSW5DYWxsID0gXCJLZXlCaW5kaW5nLnRvZ2dsZU1pY0luQ2FsbFwiLFxuICAgIC8qKiBUb2dnbGVzIHdlYmNhbSB3aGlsZSBvbiBhIGNhbGwgKi9cbiAgICBUb2dnbGVXZWJjYW1JbkNhbGwgPSBcIktleUJpbmRpbmcudG9nZ2xlV2ViY2FtSW5DYWxsXCIsXG5cbiAgICAvKiogQWNjZXNzaWJpbGl0eSBhY3Rpb25zICovXG4gICAgRXNjYXBlID0gXCJLZXlCaW5kaW5nLmVzY2FwZVwiLFxuICAgIEVudGVyID0gXCJLZXlCaW5kaW5nLmVudGVyXCIsXG4gICAgU3BhY2UgPSBcIktleUJpbmRpbmcuc3BhY2VcIixcbiAgICBCYWNrc3BhY2UgPSBcIktleUJpbmRpbmcuYmFja3NwYWNlXCIsXG4gICAgRGVsZXRlID0gXCJLZXlCaW5kaW5nLmRlbGV0ZVwiLFxuICAgIEhvbWUgPSBcIktleUJpbmRpbmcuaG9tZVwiLFxuICAgIEVuZCA9IFwiS2V5QmluZGluZy5lbmRcIixcbiAgICBBcnJvd0xlZnQgPSBcIktleUJpbmRpbmcuYXJyb3dMZWZ0XCIsXG4gICAgQXJyb3dVcCA9IFwiS2V5QmluZGluZy5hcnJvd1VwXCIsXG4gICAgQXJyb3dSaWdodCA9IFwiS2V5QmluZGluZy5hcnJvd1JpZ2h0XCIsXG4gICAgQXJyb3dEb3duID0gXCJLZXlCaW5kaW5nLmFycm93RG93blwiLFxuICAgIFRhYiA9IFwiS2V5QmluZGluZy50YWJcIixcbiAgICBDb21tYSA9IFwiS2V5QmluZGluZy5jb21tYVwiLFxuXG4gICAgLyoqIFRvZ2dsZSB2aXNpYmlsaXR5IG9mIGhpZGRlbiBldmVudHMgKi9cbiAgICBUb2dnbGVIaWRkZW5FdmVudFZpc2liaWxpdHkgPSBcIktleUJpbmRpbmcudG9nZ2xlSGlkZGVuRXZlbnRWaXNpYmlsaXR5XCIsXG59XG5cbnR5cGUgS2V5Ym9hcmRTaG9ydGN1dFNldHRpbmcgPSBPbWl0PElCYXNlU2V0dGluZzxLZXlDb21ibz4sIFwic3VwcG9ydGVkTGV2ZWxzXCI+O1xuXG4vLyBUT0RPOiBXZSBzaG91bGQgZmlndXJlIG91dCB3aGF0IHRvIGRvIHdpdGggdGhlIGtleWJvYXJkIHNob3J0Y3V0cyB0aGF0IGFyZSBub3QgaGFuZGxlZCBieSBLZXliaW5kaW5nTWFuYWdlclxuZXhwb3J0IHR5cGUgSUtleWJvYXJkU2hvcnRjdXRzID0gUGFydGlhbDxSZWNvcmQ8S2V5QmluZGluZ0FjdGlvbiwgS2V5Ym9hcmRTaG9ydGN1dFNldHRpbmc+PjtcblxuZXhwb3J0IGludGVyZmFjZSBJQ2F0ZWdvcnkge1xuICAgIGNhdGVnb3J5TGFiZWw/OiBzdHJpbmc7XG4gICAgLy8gVE9ETzogV2Ugc2hvdWxkIGZpZ3VyZSBvdXQgd2hhdCB0byBkbyB3aXRoIHRoZSBrZXlib2FyZCBzaG9ydGN1dHMgdGhhdCBhcmUgbm90IGhhbmRsZWQgYnkgS2V5YmluZGluZ01hbmFnZXJcbiAgICBzZXR0aW5nTmFtZXM6IEtleUJpbmRpbmdBY3Rpb25bXTtcbn1cblxuZXhwb3J0IGVudW0gQ2F0ZWdvcnlOYW1lIHtcbiAgICBOQVZJR0FUSU9OID0gXCJOYXZpZ2F0aW9uXCIsXG4gICAgQUNDRVNTSUJJTElUWSA9IFwiQWNjZXNzaWJpbGl0eVwiLFxuICAgIENBTExTID0gXCJDYWxsc1wiLFxuICAgIENPTVBPU0VSID0gXCJDb21wb3NlclwiLFxuICAgIFJPT01fTElTVCA9IFwiUm9vbSBMaXN0XCIsXG4gICAgUk9PTSA9IFwiUm9vbVwiLFxuICAgIEFVVE9DT01QTEVURSA9IFwiQXV0b2NvbXBsZXRlXCIsXG4gICAgTEFCUyA9IFwiTGFic1wiLFxufVxuXG4vLyBNZXRhLWtleSByZXByZXNlbnRpbmcgdGhlIGRpZ2l0cyBbMC05XSBvZnRlbiBmb3VuZCBhdCB0aGUgdG9wIG9mIHN0YW5kYXJkIGtleWJvYXJkIGxheW91dHNcbmV4cG9ydCBjb25zdCBESUdJVFMgPSBcImRpZ2l0c1wiO1xuXG5leHBvcnQgY29uc3QgQUxURVJOQVRFX0tFWV9OQU1FOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgIFtLZXkuUEFHRV9VUF06IF90ZChcIlBhZ2UgVXBcIiksXG4gICAgW0tleS5QQUdFX0RPV05dOiBfdGQoXCJQYWdlIERvd25cIiksXG4gICAgW0tleS5FU0NBUEVdOiBfdGQoXCJFc2NcIiksXG4gICAgW0tleS5FTlRFUl06IF90ZChcIkVudGVyXCIpLFxuICAgIFtLZXkuU1BBQ0VdOiBfdGQoXCJTcGFjZVwiKSxcbiAgICBbS2V5LkhPTUVdOiBfdGQoXCJIb21lXCIpLFxuICAgIFtLZXkuRU5EXTogX3RkKFwiRW5kXCIpLFxuICAgIFtLZXkuQUxUXTogX3RkKFwiQWx0XCIpLFxuICAgIFtLZXkuQ09OVFJPTF06IF90ZChcIkN0cmxcIiksXG4gICAgW0tleS5TSElGVF06IF90ZChcIlNoaWZ0XCIpLFxuICAgIFtESUdJVFNdOiBfdGQoXCJbbnVtYmVyXVwiKSxcbn07XG5leHBvcnQgY29uc3QgS0VZX0lDT046IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgW0tleS5BUlJPV19VUF06IFwi4oaRXCIsXG4gICAgW0tleS5BUlJPV19ET1dOXTogXCLihpNcIixcbiAgICBbS2V5LkFSUk9XX0xFRlRdOiBcIuKGkFwiLFxuICAgIFtLZXkuQVJST1dfUklHSFRdOiBcIuKGklwiLFxufTtcbmlmIChJU19NQUMpIHtcbiAgICBLRVlfSUNPTltLZXkuTUVUQV0gPSBcIuKMmFwiO1xuICAgIEtFWV9JQ09OW0tleS5BTFRdID0gXCLijKVcIjtcbn1cblxuZXhwb3J0IGNvbnN0IENBVEVHT1JJRVM6IFJlY29yZDxDYXRlZ29yeU5hbWUsIElDYXRlZ29yeT4gPSB7XG4gICAgW0NhdGVnb3J5TmFtZS5DT01QT1NFUl06IHtcbiAgICAgICAgY2F0ZWdvcnlMYWJlbDogX3RkKFwiQ29tcG9zZXJcIiksXG4gICAgICAgIHNldHRpbmdOYW1lczogW1xuICAgICAgICAgICAgS2V5QmluZGluZ0FjdGlvbi5TZW5kTWVzc2FnZSxcbiAgICAgICAgICAgIEtleUJpbmRpbmdBY3Rpb24uTmV3TGluZSxcbiAgICAgICAgICAgIEtleUJpbmRpbmdBY3Rpb24uRm9ybWF0Qm9sZCxcbiAgICAgICAgICAgIEtleUJpbmRpbmdBY3Rpb24uRm9ybWF0SXRhbGljcyxcbiAgICAgICAgICAgIEtleUJpbmRpbmdBY3Rpb24uRm9ybWF0UXVvdGUsXG4gICAgICAgICAgICBLZXlCaW5kaW5nQWN0aW9uLkZvcm1hdExpbmssXG4gICAgICAgICAgICBLZXlCaW5kaW5nQWN0aW9uLkZvcm1hdENvZGUsXG4gICAgICAgICAgICBLZXlCaW5kaW5nQWN0aW9uLkVkaXRVbmRvLFxuICAgICAgICAgICAgS2V5QmluZGluZ0FjdGlvbi5FZGl0UmVkbyxcbiAgICAgICAgICAgIEtleUJpbmRpbmdBY3Rpb24uTW92ZUN1cnNvclRvU3RhcnQsXG4gICAgICAgICAgICBLZXlCaW5kaW5nQWN0aW9uLk1vdmVDdXJzb3JUb0VuZCxcbiAgICAgICAgICAgIEtleUJpbmRpbmdBY3Rpb24uQ2FuY2VsUmVwbHlPckVkaXQsXG4gICAgICAgICAgICBLZXlCaW5kaW5nQWN0aW9uLkVkaXROZXh0TWVzc2FnZSxcbiAgICAgICAgICAgIEtleUJpbmRpbmdBY3Rpb24uRWRpdFByZXZNZXNzYWdlLFxuICAgICAgICAgICAgS2V5QmluZGluZ0FjdGlvbi5TZWxlY3ROZXh0U2VuZEhpc3RvcnksXG4gICAgICAgICAgICBLZXlCaW5kaW5nQWN0aW9uLlNlbGVjdFByZXZTZW5kSGlzdG9yeSxcbiAgICAgICAgICAgIEtleUJpbmRpbmdBY3Rpb24uU2hvd1N0aWNrZXJQaWNrZXIsXG4gICAgICAgIF0sXG4gICAgfSxcbiAgICBbQ2F0ZWdvcnlOYW1lLkNBTExTXToge1xuICAgICAgICBjYXRlZ29yeUxhYmVsOiBfdGQoXCJDYWxsc1wiKSxcbiAgICAgICAgc2V0dGluZ05hbWVzOiBbS2V5QmluZGluZ0FjdGlvbi5Ub2dnbGVNaWNJbkNhbGwsIEtleUJpbmRpbmdBY3Rpb24uVG9nZ2xlV2ViY2FtSW5DYWxsXSxcbiAgICB9LFxuICAgIFtDYXRlZ29yeU5hbWUuUk9PTV06IHtcbiAgICAgICAgY2F0ZWdvcnlMYWJlbDogX3RkKFwiUm9vbVwiKSxcbiAgICAgICAgc2V0dGluZ05hbWVzOiBbXG4gICAgICAgICAgICBLZXlCaW5kaW5nQWN0aW9uLlNlYXJjaEluUm9vbSxcbiAgICAgICAgICAgIEtleUJpbmRpbmdBY3Rpb24uVXBsb2FkRmlsZSxcbiAgICAgICAgICAgIEtleUJpbmRpbmdBY3Rpb24uRGlzbWlzc1JlYWRNYXJrZXIsXG4gICAgICAgICAgICBLZXlCaW5kaW5nQWN0aW9uLkp1bXBUb09sZGVzdFVucmVhZCxcbiAgICAgICAgICAgIEtleUJpbmRpbmdBY3Rpb24uU2Nyb2xsVXAsXG4gICAgICAgICAgICBLZXlCaW5kaW5nQWN0aW9uLlNjcm9sbERvd24sXG4gICAgICAgICAgICBLZXlCaW5kaW5nQWN0aW9uLkp1bXBUb0ZpcnN0TWVzc2FnZSxcbiAgICAgICAgICAgIEtleUJpbmRpbmdBY3Rpb24uSnVtcFRvTGF0ZXN0TWVzc2FnZSxcbiAgICAgICAgXSxcbiAgICB9LFxuICAgIFtDYXRlZ29yeU5hbWUuUk9PTV9MSVNUXToge1xuICAgICAgICBjYXRlZ29yeUxhYmVsOiBfdGQoXCJSb29tIExpc3RcIiksXG4gICAgICAgIHNldHRpbmdOYW1lczogW1xuICAgICAgICAgICAgS2V5QmluZGluZ0FjdGlvbi5TZWxlY3RSb29tSW5Sb29tTGlzdCxcbiAgICAgICAgICAgIEtleUJpbmRpbmdBY3Rpb24uQ2xlYXJSb29tRmlsdGVyLFxuICAgICAgICAgICAgS2V5QmluZGluZ0FjdGlvbi5Db2xsYXBzZVJvb21MaXN0U2VjdGlvbixcbiAgICAgICAgICAgIEtleUJpbmRpbmdBY3Rpb24uRXhwYW5kUm9vbUxpc3RTZWN0aW9uLFxuICAgICAgICAgICAgS2V5QmluZGluZ0FjdGlvbi5OZXh0Um9vbSxcbiAgICAgICAgICAgIEtleUJpbmRpbmdBY3Rpb24uUHJldlJvb20sXG4gICAgICAgIF0sXG4gICAgfSxcbiAgICBbQ2F0ZWdvcnlOYW1lLkFDQ0VTU0lCSUxJVFldOiB7XG4gICAgICAgIGNhdGVnb3J5TGFiZWw6IF90ZChcIkFjY2Vzc2liaWxpdHlcIiksXG4gICAgICAgIHNldHRpbmdOYW1lczogW1xuICAgICAgICAgICAgS2V5QmluZGluZ0FjdGlvbi5Fc2NhcGUsXG4gICAgICAgICAgICBLZXlCaW5kaW5nQWN0aW9uLkVudGVyLFxuICAgICAgICAgICAgS2V5QmluZGluZ0FjdGlvbi5TcGFjZSxcbiAgICAgICAgICAgIEtleUJpbmRpbmdBY3Rpb24uQmFja3NwYWNlLFxuICAgICAgICAgICAgS2V5QmluZGluZ0FjdGlvbi5EZWxldGUsXG4gICAgICAgICAgICBLZXlCaW5kaW5nQWN0aW9uLkhvbWUsXG4gICAgICAgICAgICBLZXlCaW5kaW5nQWN0aW9uLkVuZCxcbiAgICAgICAgICAgIEtleUJpbmRpbmdBY3Rpb24uQXJyb3dMZWZ0LFxuICAgICAgICAgICAgS2V5QmluZGluZ0FjdGlvbi5BcnJvd1VwLFxuICAgICAgICAgICAgS2V5QmluZGluZ0FjdGlvbi5BcnJvd1JpZ2h0LFxuICAgICAgICAgICAgS2V5QmluZGluZ0FjdGlvbi5BcnJvd0Rvd24sXG4gICAgICAgICAgICBLZXlCaW5kaW5nQWN0aW9uLkNvbW1hLFxuICAgICAgICBdLFxuICAgIH0sXG4gICAgW0NhdGVnb3J5TmFtZS5OQVZJR0FUSU9OXToge1xuICAgICAgICBjYXRlZ29yeUxhYmVsOiBfdGQoXCJOYXZpZ2F0aW9uXCIpLFxuICAgICAgICBzZXR0aW5nTmFtZXM6IFtcbiAgICAgICAgICAgIEtleUJpbmRpbmdBY3Rpb24uVG9nZ2xlVXNlck1lbnUsXG4gICAgICAgICAgICBLZXlCaW5kaW5nQWN0aW9uLlRvZ2dsZVJvb21TaWRlUGFuZWwsXG4gICAgICAgICAgICBLZXlCaW5kaW5nQWN0aW9uLlRvZ2dsZVNwYWNlUGFuZWwsXG4gICAgICAgICAgICBLZXlCaW5kaW5nQWN0aW9uLlNob3dLZXlib2FyZFNldHRpbmdzLFxuICAgICAgICAgICAgS2V5QmluZGluZ0FjdGlvbi5Hb1RvSG9tZSxcbiAgICAgICAgICAgIEtleUJpbmRpbmdBY3Rpb24uRmlsdGVyUm9vbXMsXG4gICAgICAgICAgICBLZXlCaW5kaW5nQWN0aW9uLlNlbGVjdE5leHRVbnJlYWRSb29tLFxuICAgICAgICAgICAgS2V5QmluZGluZ0FjdGlvbi5TZWxlY3RQcmV2VW5yZWFkUm9vbSxcbiAgICAgICAgICAgIEtleUJpbmRpbmdBY3Rpb24uU2VsZWN0TmV4dFJvb20sXG4gICAgICAgICAgICBLZXlCaW5kaW5nQWN0aW9uLlNlbGVjdFByZXZSb29tLFxuICAgICAgICAgICAgS2V5QmluZGluZ0FjdGlvbi5PcGVuVXNlclNldHRpbmdzLFxuICAgICAgICAgICAgS2V5QmluZGluZ0FjdGlvbi5Td2l0Y2hUb1NwYWNlQnlOdW1iZXIsXG4gICAgICAgICAgICBLZXlCaW5kaW5nQWN0aW9uLlByZXZpb3VzVmlzaXRlZFJvb21PclNwYWNlLFxuICAgICAgICAgICAgS2V5QmluZGluZ0FjdGlvbi5OZXh0VmlzaXRlZFJvb21PclNwYWNlLFxuICAgICAgICBdLFxuICAgIH0sXG4gICAgW0NhdGVnb3J5TmFtZS5BVVRPQ09NUExFVEVdOiB7XG4gICAgICAgIGNhdGVnb3J5TGFiZWw6IF90ZChcIkF1dG9jb21wbGV0ZVwiKSxcbiAgICAgICAgc2V0dGluZ05hbWVzOiBbXG4gICAgICAgICAgICBLZXlCaW5kaW5nQWN0aW9uLkNhbmNlbEF1dG9jb21wbGV0ZSxcbiAgICAgICAgICAgIEtleUJpbmRpbmdBY3Rpb24uTmV4dFNlbGVjdGlvbkluQXV0b2NvbXBsZXRlLFxuICAgICAgICAgICAgS2V5QmluZGluZ0FjdGlvbi5QcmV2U2VsZWN0aW9uSW5BdXRvY29tcGxldGUsXG4gICAgICAgICAgICBLZXlCaW5kaW5nQWN0aW9uLkNvbXBsZXRlQXV0b2NvbXBsZXRlLFxuICAgICAgICAgICAgS2V5QmluZGluZ0FjdGlvbi5Gb3JjZUNvbXBsZXRlQXV0b2NvbXBsZXRlLFxuICAgICAgICBdLFxuICAgIH0sXG4gICAgW0NhdGVnb3J5TmFtZS5MQUJTXToge1xuICAgICAgICBjYXRlZ29yeUxhYmVsOiBfdGQoXCJMYWJzXCIpLFxuICAgICAgICBzZXR0aW5nTmFtZXM6IFtLZXlCaW5kaW5nQWN0aW9uLlRvZ2dsZUhpZGRlbkV2ZW50VmlzaWJpbGl0eV0sXG4gICAgfSxcbn07XG5cbmV4cG9ydCBjb25zdCBERVNLVE9QX1NIT1JUQ1VUUyA9IFtcbiAgICBLZXlCaW5kaW5nQWN0aW9uLk9wZW5Vc2VyU2V0dGluZ3MsXG4gICAgS2V5QmluZGluZ0FjdGlvbi5Td2l0Y2hUb1NwYWNlQnlOdW1iZXIsXG4gICAgS2V5QmluZGluZ0FjdGlvbi5QcmV2aW91c1Zpc2l0ZWRSb29tT3JTcGFjZSxcbiAgICBLZXlCaW5kaW5nQWN0aW9uLk5leHRWaXNpdGVkUm9vbU9yU3BhY2UsXG5dO1xuXG5leHBvcnQgY29uc3QgTUFDX09OTFlfU0hPUlRDVVRTID0gW0tleUJpbmRpbmdBY3Rpb24uT3BlblVzZXJTZXR0aW5nc107XG5cbi8vIFRoaXMgaXMgdmVyeSBpbnRlbnRpb25hbGx5IG1vZGVsbGVkIGFmdGVyIFNFVFRJTkdTIGFzIGl0IHdpbGwgbWFrZSBpdCBlYXNpZXJcbi8vIHRvIGltcGxlbWVudCBjdXN0b21pemFibGUga2V5Ym9hcmQgc2hvcnRjdXRzXG4vLyBUT0RPOiBUcmF2aXNSIHdpbGwgZml4IHRoaXMgbmlnaHRtYXJlIHdoZW4gdGhlIG5ldyB2ZXJzaW9uIG9mIHRoZSBTZXR0aW5nc1N0b3JlIGJlY29tZXMgYSB0aGluZ1xuLy8gWFhYOiBFeHBvcnRlZCBmb3IgdGVzdHNcbmV4cG9ydCBjb25zdCBLRVlCT0FSRF9TSE9SVENVVFM6IElLZXlib2FyZFNob3J0Y3V0cyA9IHtcbiAgICBbS2V5QmluZGluZ0FjdGlvbi5Gb3JtYXRCb2xkXToge1xuICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICBjdHJsT3JDbWRLZXk6IHRydWUsXG4gICAgICAgICAgICBrZXk6IEtleS5CLFxuICAgICAgICB9LFxuICAgICAgICBkaXNwbGF5TmFtZTogX3RkKFwiVG9nZ2xlIEJvbGRcIiksXG4gICAgfSxcbiAgICBbS2V5QmluZGluZ0FjdGlvbi5Gb3JtYXRJdGFsaWNzXToge1xuICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICBjdHJsT3JDbWRLZXk6IHRydWUsXG4gICAgICAgICAgICBrZXk6IEtleS5JLFxuICAgICAgICB9LFxuICAgICAgICBkaXNwbGF5TmFtZTogX3RkKFwiVG9nZ2xlIEl0YWxpY3NcIiksXG4gICAgfSxcbiAgICBbS2V5QmluZGluZ0FjdGlvbi5Gb3JtYXRRdW90ZV06IHtcbiAgICAgICAgZGVmYXVsdDoge1xuICAgICAgICAgICAgY3RybE9yQ21kS2V5OiB0cnVlLFxuICAgICAgICAgICAgc2hpZnRLZXk6IHRydWUsXG4gICAgICAgICAgICBrZXk6IEtleS5HUkVBVEVSX1RIQU4sXG4gICAgICAgIH0sXG4gICAgICAgIGRpc3BsYXlOYW1lOiBfdGQoXCJUb2dnbGUgUXVvdGVcIiksXG4gICAgfSxcbiAgICBbS2V5QmluZGluZ0FjdGlvbi5Gb3JtYXRDb2RlXToge1xuICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICBjdHJsT3JDbWRLZXk6IHRydWUsXG4gICAgICAgICAgICBrZXk6IEtleS5FLFxuICAgICAgICB9LFxuICAgICAgICBkaXNwbGF5TmFtZTogX3RkKFwiVG9nZ2xlIENvZGUgQmxvY2tcIiksXG4gICAgfSxcbiAgICBbS2V5QmluZGluZ0FjdGlvbi5Gb3JtYXRMaW5rXToge1xuICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICBjdHJsT3JDbWRLZXk6IHRydWUsXG4gICAgICAgICAgICBzaGlmdEtleTogdHJ1ZSxcbiAgICAgICAgICAgIGtleTogS2V5LkwsXG4gICAgICAgIH0sXG4gICAgICAgIGRpc3BsYXlOYW1lOiBfdGQoXCJUb2dnbGUgTGlua1wiKSxcbiAgICB9LFxuICAgIFtLZXlCaW5kaW5nQWN0aW9uLkNhbmNlbFJlcGx5T3JFZGl0XToge1xuICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICBrZXk6IEtleS5FU0NBUEUsXG4gICAgICAgIH0sXG4gICAgICAgIGRpc3BsYXlOYW1lOiBfdGQoXCJDYW5jZWwgcmVwbHlpbmcgdG8gYSBtZXNzYWdlXCIpLFxuICAgIH0sXG4gICAgW0tleUJpbmRpbmdBY3Rpb24uRWRpdE5leHRNZXNzYWdlXToge1xuICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICBrZXk6IEtleS5BUlJPV19ET1dOLFxuICAgICAgICB9LFxuICAgICAgICBkaXNwbGF5TmFtZTogX3RkKFwiTmF2aWdhdGUgdG8gbmV4dCBtZXNzYWdlIHRvIGVkaXRcIiksXG4gICAgfSxcbiAgICBbS2V5QmluZGluZ0FjdGlvbi5FZGl0UHJldk1lc3NhZ2VdOiB7XG4gICAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgICAgIGtleTogS2V5LkFSUk9XX1VQLFxuICAgICAgICB9LFxuICAgICAgICBkaXNwbGF5TmFtZTogX3RkKFwiTmF2aWdhdGUgdG8gcHJldmlvdXMgbWVzc2FnZSB0byBlZGl0XCIpLFxuICAgIH0sXG4gICAgW0tleUJpbmRpbmdBY3Rpb24uTW92ZUN1cnNvclRvU3RhcnRdOiB7XG4gICAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgICAgIGN0cmxPckNtZEtleTogdHJ1ZSxcbiAgICAgICAgICAgIGtleTogS2V5LkhPTUUsXG4gICAgICAgIH0sXG4gICAgICAgIGRpc3BsYXlOYW1lOiBfdGQoXCJKdW1wIHRvIHN0YXJ0IG9mIHRoZSBjb21wb3NlclwiKSxcbiAgICB9LFxuICAgIFtLZXlCaW5kaW5nQWN0aW9uLk1vdmVDdXJzb3JUb0VuZF06IHtcbiAgICAgICAgZGVmYXVsdDoge1xuICAgICAgICAgICAgY3RybE9yQ21kS2V5OiB0cnVlLFxuICAgICAgICAgICAga2V5OiBLZXkuRU5ELFxuICAgICAgICB9LFxuICAgICAgICBkaXNwbGF5TmFtZTogX3RkKFwiSnVtcCB0byBlbmQgb2YgdGhlIGNvbXBvc2VyXCIpLFxuICAgIH0sXG4gICAgW0tleUJpbmRpbmdBY3Rpb24uU2VsZWN0TmV4dFNlbmRIaXN0b3J5XToge1xuICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICBhbHRLZXk6IHRydWUsXG4gICAgICAgICAgICBjdHJsS2V5OiB0cnVlLFxuICAgICAgICAgICAga2V5OiBLZXkuQVJST1dfRE9XTixcbiAgICAgICAgfSxcbiAgICAgICAgZGlzcGxheU5hbWU6IF90ZChcIk5hdmlnYXRlIHRvIG5leHQgbWVzc2FnZSBpbiBjb21wb3NlciBoaXN0b3J5XCIpLFxuICAgIH0sXG4gICAgW0tleUJpbmRpbmdBY3Rpb24uU2VsZWN0UHJldlNlbmRIaXN0b3J5XToge1xuICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICBhbHRLZXk6IHRydWUsXG4gICAgICAgICAgICBjdHJsS2V5OiB0cnVlLFxuICAgICAgICAgICAga2V5OiBLZXkuQVJST1dfVVAsXG4gICAgICAgIH0sXG4gICAgICAgIGRpc3BsYXlOYW1lOiBfdGQoXCJOYXZpZ2F0ZSB0byBwcmV2aW91cyBtZXNzYWdlIGluIGNvbXBvc2VyIGhpc3RvcnlcIiksXG4gICAgfSxcbiAgICBbS2V5QmluZGluZ0FjdGlvbi5TaG93U3RpY2tlclBpY2tlcl06IHtcbiAgICAgICAgZGVmYXVsdDoge1xuICAgICAgICAgICAgY3RybE9yQ21kS2V5OiB0cnVlLFxuICAgICAgICAgICAga2V5OiBLZXkuU0VNSUNPTE9OLFxuICAgICAgICB9LFxuICAgICAgICBkaXNwbGF5TmFtZTogX3RkKFwiU2VuZCBhIHN0aWNrZXJcIiksXG4gICAgfSxcbiAgICBbS2V5QmluZGluZ0FjdGlvbi5Ub2dnbGVNaWNJbkNhbGxdOiB7XG4gICAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgICAgIGN0cmxPckNtZEtleTogdHJ1ZSxcbiAgICAgICAgICAgIGtleTogS2V5LkQsXG4gICAgICAgIH0sXG4gICAgICAgIGRpc3BsYXlOYW1lOiBfdGQoXCJUb2dnbGUgbWljcm9waG9uZSBtdXRlXCIpLFxuICAgIH0sXG4gICAgW0tleUJpbmRpbmdBY3Rpb24uVG9nZ2xlV2ViY2FtSW5DYWxsXToge1xuICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICBjdHJsT3JDbWRLZXk6IHRydWUsXG4gICAgICAgICAgICBrZXk6IEtleS5FLFxuICAgICAgICB9LFxuICAgICAgICBkaXNwbGF5TmFtZTogX3RkKFwiVG9nZ2xlIHdlYmNhbSBvbi9vZmZcIiksXG4gICAgfSxcbiAgICBbS2V5QmluZGluZ0FjdGlvbi5EaXNtaXNzUmVhZE1hcmtlcl06IHtcbiAgICAgICAgZGVmYXVsdDoge1xuICAgICAgICAgICAga2V5OiBLZXkuRVNDQVBFLFxuICAgICAgICB9LFxuICAgICAgICBkaXNwbGF5TmFtZTogX3RkKFwiRGlzbWlzcyByZWFkIG1hcmtlciBhbmQganVtcCB0byBib3R0b21cIiksXG4gICAgfSxcbiAgICBbS2V5QmluZGluZ0FjdGlvbi5KdW1wVG9PbGRlc3RVbnJlYWRdOiB7XG4gICAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgICAgIHNoaWZ0S2V5OiB0cnVlLFxuICAgICAgICAgICAga2V5OiBLZXkuUEFHRV9VUCxcbiAgICAgICAgfSxcbiAgICAgICAgZGlzcGxheU5hbWU6IF90ZChcIkp1bXAgdG8gb2xkZXN0IHVucmVhZCBtZXNzYWdlXCIpLFxuICAgIH0sXG4gICAgW0tleUJpbmRpbmdBY3Rpb24uVXBsb2FkRmlsZV06IHtcbiAgICAgICAgZGVmYXVsdDoge1xuICAgICAgICAgICAgY3RybE9yQ21kS2V5OiB0cnVlLFxuICAgICAgICAgICAgc2hpZnRLZXk6IHRydWUsXG4gICAgICAgICAgICBrZXk6IEtleS5VLFxuICAgICAgICB9LFxuICAgICAgICBkaXNwbGF5TmFtZTogX3RkKFwiVXBsb2FkIGEgZmlsZVwiKSxcbiAgICB9LFxuICAgIFtLZXlCaW5kaW5nQWN0aW9uLlNjcm9sbFVwXToge1xuICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICBrZXk6IEtleS5QQUdFX1VQLFxuICAgICAgICB9LFxuICAgICAgICBkaXNwbGF5TmFtZTogX3RkKFwiU2Nyb2xsIHVwIGluIHRoZSB0aW1lbGluZVwiKSxcbiAgICB9LFxuICAgIFtLZXlCaW5kaW5nQWN0aW9uLlNjcm9sbERvd25dOiB7XG4gICAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgICAgIGtleTogS2V5LlBBR0VfRE9XTixcbiAgICAgICAgfSxcbiAgICAgICAgZGlzcGxheU5hbWU6IF90ZChcIlNjcm9sbCBkb3duIGluIHRoZSB0aW1lbGluZVwiKSxcbiAgICB9LFxuICAgIFtLZXlCaW5kaW5nQWN0aW9uLkZpbHRlclJvb21zXToge1xuICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICBjdHJsT3JDbWRLZXk6IHRydWUsXG4gICAgICAgICAgICBrZXk6IEtleS5LLFxuICAgICAgICB9LFxuICAgICAgICBkaXNwbGF5TmFtZTogX3RkKFwiSnVtcCB0byByb29tIHNlYXJjaFwiKSxcbiAgICB9LFxuICAgIFtLZXlCaW5kaW5nQWN0aW9uLlNlbGVjdFJvb21JblJvb21MaXN0XToge1xuICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICBrZXk6IEtleS5FTlRFUixcbiAgICAgICAgfSxcbiAgICAgICAgZGlzcGxheU5hbWU6IF90ZChcIlNlbGVjdCByb29tIGZyb20gdGhlIHJvb20gbGlzdFwiKSxcbiAgICB9LFxuICAgIFtLZXlCaW5kaW5nQWN0aW9uLkNvbGxhcHNlUm9vbUxpc3RTZWN0aW9uXToge1xuICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICBrZXk6IEtleS5BUlJPV19MRUZULFxuICAgICAgICB9LFxuICAgICAgICBkaXNwbGF5TmFtZTogX3RkKFwiQ29sbGFwc2Ugcm9vbSBsaXN0IHNlY3Rpb25cIiksXG4gICAgfSxcbiAgICBbS2V5QmluZGluZ0FjdGlvbi5FeHBhbmRSb29tTGlzdFNlY3Rpb25dOiB7XG4gICAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgICAgIGtleTogS2V5LkFSUk9XX1JJR0hULFxuICAgICAgICB9LFxuICAgICAgICBkaXNwbGF5TmFtZTogX3RkKFwiRXhwYW5kIHJvb20gbGlzdCBzZWN0aW9uXCIpLFxuICAgIH0sXG4gICAgW0tleUJpbmRpbmdBY3Rpb24uTmV4dFJvb21dOiB7XG4gICAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgICAgIGtleTogS2V5LkFSUk9XX0RPV04sXG4gICAgICAgIH0sXG4gICAgICAgIGRpc3BsYXlOYW1lOiBfdGQoXCJOYXZpZ2F0ZSBkb3duIGluIHRoZSByb29tIGxpc3RcIiksXG4gICAgfSxcbiAgICBbS2V5QmluZGluZ0FjdGlvbi5QcmV2Um9vbV06IHtcbiAgICAgICAgZGVmYXVsdDoge1xuICAgICAgICAgICAga2V5OiBLZXkuQVJST1dfVVAsXG4gICAgICAgIH0sXG4gICAgICAgIGRpc3BsYXlOYW1lOiBfdGQoXCJOYXZpZ2F0ZSB1cCBpbiB0aGUgcm9vbSBsaXN0XCIpLFxuICAgIH0sXG4gICAgW0tleUJpbmRpbmdBY3Rpb24uVG9nZ2xlVXNlck1lbnVdOiB7XG4gICAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgICAgIGN0cmxPckNtZEtleTogdHJ1ZSxcbiAgICAgICAgICAgIGtleTogS2V5LkJBQ0tUSUNLLFxuICAgICAgICB9LFxuICAgICAgICBkaXNwbGF5TmFtZTogX3RkKFwiVG9nZ2xlIHRoZSB0b3AgbGVmdCBtZW51XCIpLFxuICAgIH0sXG4gICAgW0tleUJpbmRpbmdBY3Rpb24uVG9nZ2xlUm9vbVNpZGVQYW5lbF06IHtcbiAgICAgICAgZGVmYXVsdDoge1xuICAgICAgICAgICAgY3RybE9yQ21kS2V5OiB0cnVlLFxuICAgICAgICAgICAga2V5OiBLZXkuUEVSSU9ELFxuICAgICAgICB9LFxuICAgICAgICBkaXNwbGF5TmFtZTogX3RkKFwiVG9nZ2xlIHJpZ2h0IHBhbmVsXCIpLFxuICAgIH0sXG4gICAgW0tleUJpbmRpbmdBY3Rpb24uU2hvd0tleWJvYXJkU2V0dGluZ3NdOiB7XG4gICAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgICAgIGN0cmxPckNtZEtleTogdHJ1ZSxcbiAgICAgICAgICAgIGtleTogS2V5LlNMQVNILFxuICAgICAgICB9LFxuICAgICAgICBkaXNwbGF5TmFtZTogX3RkKFwiT3BlbiB0aGlzIHNldHRpbmdzIHRhYlwiKSxcbiAgICB9LFxuICAgIFtLZXlCaW5kaW5nQWN0aW9uLkdvVG9Ib21lXToge1xuICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICBjdHJsT3JDbWRLZXk6IHRydWUsXG4gICAgICAgICAgICBhbHRLZXk6ICFJU19NQUMsXG4gICAgICAgICAgICBzaGlmdEtleTogSVNfTUFDLFxuICAgICAgICAgICAga2V5OiBLZXkuSCxcbiAgICAgICAgfSxcbiAgICAgICAgZGlzcGxheU5hbWU6IF90ZChcIkdvIHRvIEhvbWUgVmlld1wiKSxcbiAgICB9LFxuICAgIFtLZXlCaW5kaW5nQWN0aW9uLlNlbGVjdE5leHRVbnJlYWRSb29tXToge1xuICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICBzaGlmdEtleTogdHJ1ZSxcbiAgICAgICAgICAgIGFsdEtleTogdHJ1ZSxcbiAgICAgICAgICAgIGtleTogS2V5LkFSUk9XX0RPV04sXG4gICAgICAgIH0sXG4gICAgICAgIGRpc3BsYXlOYW1lOiBfdGQoXCJOZXh0IHVucmVhZCByb29tIG9yIERNXCIpLFxuICAgIH0sXG4gICAgW0tleUJpbmRpbmdBY3Rpb24uU2VsZWN0UHJldlVucmVhZFJvb21dOiB7XG4gICAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgICAgIHNoaWZ0S2V5OiB0cnVlLFxuICAgICAgICAgICAgYWx0S2V5OiB0cnVlLFxuICAgICAgICAgICAga2V5OiBLZXkuQVJST1dfVVAsXG4gICAgICAgIH0sXG4gICAgICAgIGRpc3BsYXlOYW1lOiBfdGQoXCJQcmV2aW91cyB1bnJlYWQgcm9vbSBvciBETVwiKSxcbiAgICB9LFxuICAgIFtLZXlCaW5kaW5nQWN0aW9uLlNlbGVjdE5leHRSb29tXToge1xuICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICBhbHRLZXk6IHRydWUsXG4gICAgICAgICAgICBrZXk6IEtleS5BUlJPV19ET1dOLFxuICAgICAgICB9LFxuICAgICAgICBkaXNwbGF5TmFtZTogX3RkKFwiTmV4dCByb29tIG9yIERNXCIpLFxuICAgIH0sXG4gICAgW0tleUJpbmRpbmdBY3Rpb24uU2VsZWN0UHJldlJvb21dOiB7XG4gICAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgICAgIGFsdEtleTogdHJ1ZSxcbiAgICAgICAgICAgIGtleTogS2V5LkFSUk9XX1VQLFxuICAgICAgICB9LFxuICAgICAgICBkaXNwbGF5TmFtZTogX3RkKFwiUHJldmlvdXMgcm9vbSBvciBETVwiKSxcbiAgICB9LFxuICAgIFtLZXlCaW5kaW5nQWN0aW9uLkNhbmNlbEF1dG9jb21wbGV0ZV06IHtcbiAgICAgICAgZGVmYXVsdDoge1xuICAgICAgICAgICAga2V5OiBLZXkuRVNDQVBFLFxuICAgICAgICB9LFxuICAgICAgICBkaXNwbGF5TmFtZTogX3RkKFwiQ2FuY2VsIGF1dG9jb21wbGV0ZVwiKSxcbiAgICB9LFxuICAgIFtLZXlCaW5kaW5nQWN0aW9uLk5leHRTZWxlY3Rpb25JbkF1dG9jb21wbGV0ZV06IHtcbiAgICAgICAgZGVmYXVsdDoge1xuICAgICAgICAgICAga2V5OiBLZXkuQVJST1dfRE9XTixcbiAgICAgICAgfSxcbiAgICAgICAgZGlzcGxheU5hbWU6IF90ZChcIk5leHQgYXV0b2NvbXBsZXRlIHN1Z2dlc3Rpb25cIiksXG4gICAgfSxcbiAgICBbS2V5QmluZGluZ0FjdGlvbi5QcmV2U2VsZWN0aW9uSW5BdXRvY29tcGxldGVdOiB7XG4gICAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgICAgIGtleTogS2V5LkFSUk9XX1VQLFxuICAgICAgICB9LFxuICAgICAgICBkaXNwbGF5TmFtZTogX3RkKFwiUHJldmlvdXMgYXV0b2NvbXBsZXRlIHN1Z2dlc3Rpb25cIiksXG4gICAgfSxcbiAgICBbS2V5QmluZGluZ0FjdGlvbi5Ub2dnbGVTcGFjZVBhbmVsXToge1xuICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICBjdHJsT3JDbWRLZXk6IHRydWUsXG4gICAgICAgICAgICBzaGlmdEtleTogdHJ1ZSxcbiAgICAgICAgICAgIGtleTogS2V5LkQsXG4gICAgICAgIH0sXG4gICAgICAgIGRpc3BsYXlOYW1lOiBfdGQoXCJUb2dnbGUgc3BhY2UgcGFuZWxcIiksXG4gICAgfSxcbiAgICBbS2V5QmluZGluZ0FjdGlvbi5Ub2dnbGVIaWRkZW5FdmVudFZpc2liaWxpdHldOiB7XG4gICAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgICAgIGN0cmxPckNtZEtleTogdHJ1ZSxcbiAgICAgICAgICAgIHNoaWZ0S2V5OiB0cnVlLFxuICAgICAgICAgICAga2V5OiBLZXkuSCxcbiAgICAgICAgfSxcbiAgICAgICAgZGlzcGxheU5hbWU6IF90ZChcIlRvZ2dsZSBoaWRkZW4gZXZlbnQgdmlzaWJpbGl0eVwiKSxcbiAgICB9LFxuICAgIFtLZXlCaW5kaW5nQWN0aW9uLkp1bXBUb0ZpcnN0TWVzc2FnZV06IHtcbiAgICAgICAgZGVmYXVsdDoge1xuICAgICAgICAgICAga2V5OiBLZXkuSE9NRSxcbiAgICAgICAgICAgIGN0cmxLZXk6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIGRpc3BsYXlOYW1lOiBfdGQoXCJKdW1wIHRvIGZpcnN0IG1lc3NhZ2VcIiksXG4gICAgfSxcbiAgICBbS2V5QmluZGluZ0FjdGlvbi5KdW1wVG9MYXRlc3RNZXNzYWdlXToge1xuICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICBrZXk6IEtleS5FTkQsXG4gICAgICAgICAgICBjdHJsS2V5OiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBkaXNwbGF5TmFtZTogX3RkKFwiSnVtcCB0byBsYXN0IG1lc3NhZ2VcIiksXG4gICAgfSxcbiAgICBbS2V5QmluZGluZ0FjdGlvbi5FZGl0VW5kb106IHtcbiAgICAgICAgZGVmYXVsdDoge1xuICAgICAgICAgICAga2V5OiBLZXkuWixcbiAgICAgICAgICAgIGN0cmxPckNtZEtleTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgZGlzcGxheU5hbWU6IF90ZChcIlVuZG8gZWRpdFwiKSxcbiAgICB9LFxuICAgIFtLZXlCaW5kaW5nQWN0aW9uLkVkaXRSZWRvXToge1xuICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICBrZXk6IElTX01BQyA/IEtleS5aIDogS2V5LlksXG4gICAgICAgICAgICBjdHJsT3JDbWRLZXk6IHRydWUsXG4gICAgICAgICAgICBzaGlmdEtleTogSVNfTUFDLFxuICAgICAgICB9LFxuICAgICAgICBkaXNwbGF5TmFtZTogX3RkKFwiUmVkbyBlZGl0XCIpLFxuICAgIH0sXG4gICAgW0tleUJpbmRpbmdBY3Rpb24uUHJldmlvdXNWaXNpdGVkUm9vbU9yU3BhY2VdOiB7XG4gICAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgICAgIG1ldGFLZXk6IElTX01BQyxcbiAgICAgICAgICAgIGFsdEtleTogIUlTX01BQyxcbiAgICAgICAgICAgIGtleTogSVNfTUFDID8gS2V5LlNRVUFSRV9CUkFDS0VUX0xFRlQgOiBLZXkuQVJST1dfTEVGVCxcbiAgICAgICAgfSxcbiAgICAgICAgZGlzcGxheU5hbWU6IF90ZChcIlByZXZpb3VzIHJlY2VudGx5IHZpc2l0ZWQgcm9vbSBvciBzcGFjZVwiKSxcbiAgICB9LFxuICAgIFtLZXlCaW5kaW5nQWN0aW9uLk5leHRWaXNpdGVkUm9vbU9yU3BhY2VdOiB7XG4gICAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgICAgIG1ldGFLZXk6IElTX01BQyxcbiAgICAgICAgICAgIGFsdEtleTogIUlTX01BQyxcbiAgICAgICAgICAgIGtleTogSVNfTUFDID8gS2V5LlNRVUFSRV9CUkFDS0VUX1JJR0hUIDogS2V5LkFSUk9XX1JJR0hULFxuICAgICAgICB9LFxuICAgICAgICBkaXNwbGF5TmFtZTogX3RkKFwiTmV4dCByZWNlbnRseSB2aXNpdGVkIHJvb20gb3Igc3BhY2VcIiksXG4gICAgfSxcbiAgICBbS2V5QmluZGluZ0FjdGlvbi5Td2l0Y2hUb1NwYWNlQnlOdW1iZXJdOiB7XG4gICAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgICAgIGN0cmxPckNtZEtleTogdHJ1ZSxcbiAgICAgICAgICAgIGtleTogRElHSVRTLFxuICAgICAgICB9LFxuICAgICAgICBkaXNwbGF5TmFtZTogX3RkKFwiU3dpdGNoIHRvIHNwYWNlIGJ5IG51bWJlclwiKSxcbiAgICB9LFxuICAgIFtLZXlCaW5kaW5nQWN0aW9uLk9wZW5Vc2VyU2V0dGluZ3NdOiB7XG4gICAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgICAgIG1ldGFLZXk6IHRydWUsXG4gICAgICAgICAgICBrZXk6IEtleS5DT01NQSxcbiAgICAgICAgfSxcbiAgICAgICAgZGlzcGxheU5hbWU6IF90ZChcIk9wZW4gdXNlciBzZXR0aW5nc1wiKSxcbiAgICB9LFxuICAgIFtLZXlCaW5kaW5nQWN0aW9uLkVzY2FwZV06IHtcbiAgICAgICAgZGVmYXVsdDoge1xuICAgICAgICAgICAga2V5OiBLZXkuRVNDQVBFLFxuICAgICAgICB9LFxuICAgICAgICBkaXNwbGF5TmFtZTogX3RkKFwiQ2xvc2UgZGlhbG9nIG9yIGNvbnRleHQgbWVudVwiKSxcbiAgICB9LFxuICAgIFtLZXlCaW5kaW5nQWN0aW9uLkVudGVyXToge1xuICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICBrZXk6IEtleS5FTlRFUixcbiAgICAgICAgfSxcbiAgICAgICAgZGlzcGxheU5hbWU6IF90ZChcIkFjdGl2YXRlIHNlbGVjdGVkIGJ1dHRvblwiKSxcbiAgICB9LFxuICAgIFtLZXlCaW5kaW5nQWN0aW9uLlNwYWNlXToge1xuICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICBrZXk6IEtleS5TUEFDRSxcbiAgICAgICAgfSxcbiAgICB9LFxuICAgIFtLZXlCaW5kaW5nQWN0aW9uLkJhY2tzcGFjZV06IHtcbiAgICAgICAgZGVmYXVsdDoge1xuICAgICAgICAgICAga2V5OiBLZXkuQkFDS1NQQUNFLFxuICAgICAgICB9LFxuICAgIH0sXG4gICAgW0tleUJpbmRpbmdBY3Rpb24uRGVsZXRlXToge1xuICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICBrZXk6IEtleS5ERUxFVEUsXG4gICAgICAgIH0sXG4gICAgfSxcbiAgICBbS2V5QmluZGluZ0FjdGlvbi5Ib21lXToge1xuICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICBrZXk6IEtleS5IT01FLFxuICAgICAgICB9LFxuICAgIH0sXG4gICAgW0tleUJpbmRpbmdBY3Rpb24uRW5kXToge1xuICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICBrZXk6IEtleS5FTkQsXG4gICAgICAgIH0sXG4gICAgfSxcbiAgICBbS2V5QmluZGluZ0FjdGlvbi5BcnJvd0xlZnRdOiB7XG4gICAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgICAgIGtleTogS2V5LkFSUk9XX0xFRlQsXG4gICAgICAgIH0sXG4gICAgfSxcbiAgICBbS2V5QmluZGluZ0FjdGlvbi5BcnJvd1VwXToge1xuICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICBrZXk6IEtleS5BUlJPV19VUCxcbiAgICAgICAgfSxcbiAgICB9LFxuICAgIFtLZXlCaW5kaW5nQWN0aW9uLkFycm93UmlnaHRdOiB7XG4gICAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgICAgIGtleTogS2V5LkFSUk9XX1JJR0hULFxuICAgICAgICB9LFxuICAgIH0sXG4gICAgW0tleUJpbmRpbmdBY3Rpb24uQXJyb3dEb3duXToge1xuICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICBrZXk6IEtleS5BUlJPV19ET1dOLFxuICAgICAgICB9LFxuICAgIH0sXG4gICAgW0tleUJpbmRpbmdBY3Rpb24uQ29tbWFdOiB7XG4gICAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgICAgIGtleTogS2V5LkNPTU1BLFxuICAgICAgICB9LFxuICAgIH0sXG59O1xuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFrQkEsSUFBQUEsZ0JBQUEsR0FBQUMsT0FBQTtBQUNBLElBQUFDLFNBQUEsR0FBQUQsT0FBQTtBQW5CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBaEJBLElBdUJZRSxnQkFBZ0IsMEJBQWhCQSxnQkFBZ0I7RUFBaEJBLGdCQUFnQjtFQUFoQkEsZ0JBQWdCO0VBQWhCQSxnQkFBZ0I7RUFBaEJBLGdCQUFnQjtFQUFoQkEsZ0JBQWdCO0VBQWhCQSxnQkFBZ0I7RUFBaEJBLGdCQUFnQjtFQUFoQkEsZ0JBQWdCO0VBQWhCQSxnQkFBZ0I7RUFBaEJBLGdCQUFnQjtFQUFoQkEsZ0JBQWdCO0VBQWhCQSxnQkFBZ0I7RUFBaEJBLGdCQUFnQjtFQUFoQkEsZ0JBQWdCO0VBQWhCQSxnQkFBZ0I7RUFBaEJBLGdCQUFnQjtFQUFoQkEsZ0JBQWdCO0VBQWhCQSxnQkFBZ0I7RUFBaEJBLGdCQUFnQjtFQUFoQkEsZ0JBQWdCO0VBQWhCQSxnQkFBZ0I7RUFBaEJBLGdCQUFnQjtFQUFoQkEsZ0JBQWdCO0VBQWhCQSxnQkFBZ0I7RUFBaEJBLGdCQUFnQjtFQUFoQkEsZ0JBQWdCO0VBQWhCQSxnQkFBZ0I7RUFBaEJBLGdCQUFnQjtFQUFoQkEsZ0JBQWdCO0VBQWhCQSxnQkFBZ0I7RUFBaEJBLGdCQUFnQjtFQUFoQkEsZ0JBQWdCO0VBQWhCQSxnQkFBZ0I7RUFB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