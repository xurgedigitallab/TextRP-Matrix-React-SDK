"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getKeyboardShortcutsForUI = exports.getKeyboardShortcuts = exports.getKeyboardShortcutValue = exports.getKeyboardShortcutDisplayName = void 0;
var _Keyboard = require("../Keyboard");
var _languageHandler = require("../languageHandler");
var _PlatformPeg = _interopRequireDefault(require("../PlatformPeg"));
var _SettingsStore = _interopRequireDefault(require("../settings/SettingsStore"));
var _KeyboardShortcuts = require("./KeyboardShortcuts");
/*
Copyright 2022 Šimon Brandner <simon.bra.ag@gmail.com>

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
 * This function gets the keyboard shortcuts that should be presented in the UI
 * but they shouldn't be consumed by KeyBindingDefaults. That means that these
 * have to be manually mirrored in KeyBindingDefaults.
 */
const getUIOnlyShortcuts = () => {
  const ctrlEnterToSend = _SettingsStore.default.getValue("MessageComposerInput.ctrlEnterToSend");
  const keyboardShortcuts = {
    [_KeyboardShortcuts.KeyBindingAction.SendMessage]: {
      default: {
        key: _Keyboard.Key.ENTER,
        ctrlOrCmdKey: ctrlEnterToSend
      },
      displayName: (0, _languageHandler._td)("Send message")
    },
    [_KeyboardShortcuts.KeyBindingAction.NewLine]: {
      default: {
        key: _Keyboard.Key.ENTER,
        shiftKey: !ctrlEnterToSend
      },
      displayName: (0, _languageHandler._td)("New line")
    },
    [_KeyboardShortcuts.KeyBindingAction.CompleteAutocomplete]: {
      default: {
        key: _Keyboard.Key.ENTER
      },
      displayName: (0, _languageHandler._td)("Complete")
    },
    [_KeyboardShortcuts.KeyBindingAction.ForceCompleteAutocomplete]: {
      default: {
        key: _Keyboard.Key.TAB
      },
      displayName: (0, _languageHandler._td)("Force complete")
    },
    [_KeyboardShortcuts.KeyBindingAction.SearchInRoom]: {
      default: {
        ctrlOrCmdKey: true,
        key: _Keyboard.Key.F
      },
      displayName: (0, _languageHandler._td)("Search (must be enabled)")
    }
  };
  if (_PlatformPeg.default.get()?.overrideBrowserShortcuts()) {
    // XXX: This keyboard shortcut isn't manually added to
    // KeyBindingDefaults as it can't be easily handled by the
    // KeyBindingManager
    keyboardShortcuts[_KeyboardShortcuts.KeyBindingAction.SwitchToSpaceByNumber] = {
      default: {
        ctrlOrCmdKey: true,
        key: _KeyboardShortcuts.DIGITS
      },
      displayName: (0, _languageHandler._td)("Switch to space by number")
    };
  }
  return keyboardShortcuts;
};

/**
 * This function gets keyboard shortcuts that can be consumed by the KeyBindingDefaults.
 */
const getKeyboardShortcuts = () => {
  const overrideBrowserShortcuts = _PlatformPeg.default.get()?.overrideBrowserShortcuts();
  return Object.keys(_KeyboardShortcuts.KEYBOARD_SHORTCUTS).filter(k => {
    if (_KeyboardShortcuts.KEYBOARD_SHORTCUTS[k]?.controller?.settingDisabled) return false;
    if (_KeyboardShortcuts.MAC_ONLY_SHORTCUTS.includes(k) && !_Keyboard.IS_MAC) return false;
    if (_KeyboardShortcuts.DESKTOP_SHORTCUTS.includes(k) && !overrideBrowserShortcuts) return false;
    return true;
  }).reduce((o, key) => {
    o[key] = _KeyboardShortcuts.KEYBOARD_SHORTCUTS[key];
    return o;
  }, {});
};

/**
 * Gets keyboard shortcuts that should be presented to the user in the UI.
 */
exports.getKeyboardShortcuts = getKeyboardShortcuts;
const getKeyboardShortcutsForUI = () => {
  const entries = [...Object.entries(getUIOnlyShortcuts()), ...Object.entries(getKeyboardShortcuts())];
  return entries.reduce((acc, _ref) => {
    let [key, value] = _ref;
    acc[key] = value;
    return acc;
  }, {});
};
exports.getKeyboardShortcutsForUI = getKeyboardShortcutsForUI;
const getKeyboardShortcutValue = name => {
  return getKeyboardShortcutsForUI()[name]?.default;
};
exports.getKeyboardShortcutValue = getKeyboardShortcutValue;
const getKeyboardShortcutDisplayName = name => {
  const keyboardShortcutDisplayName = getKeyboardShortcutsForUI()[name]?.displayName;
  return keyboardShortcutDisplayName && (0, _languageHandler._t)(keyboardShortcutDisplayName);
};
exports.getKeyboardShortcutDisplayName = getKeyboardShortcutDisplayName;
//# sourceMappingURL=KeyboardShortcutUtils.js.map