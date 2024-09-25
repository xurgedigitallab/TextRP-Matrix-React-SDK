"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getBindingsByCategory = exports.defaultBindingsProvider = void 0;
var _Keyboard = require("./Keyboard");
var _SettingsStore = _interopRequireDefault(require("./settings/SettingsStore"));
var _SdkConfig = _interopRequireDefault(require("./SdkConfig"));
var _KeyboardShortcuts = require("./accessibility/KeyboardShortcuts");
var _KeyboardShortcutUtils = require("./accessibility/KeyboardShortcutUtils");
/*
Copyright 2021 Clemens Zeidler
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

const getBindingsByCategory = category => {
  return _KeyboardShortcuts.CATEGORIES[category].settingNames.reduce((bindings, action) => {
    const keyCombo = (0, _KeyboardShortcutUtils.getKeyboardShortcuts)()[action]?.default;
    if (keyCombo) {
      bindings.push({
        action,
        keyCombo
      });
    }
    return bindings;
  }, []);
};
exports.getBindingsByCategory = getBindingsByCategory;
const messageComposerBindings = () => {
  const bindings = getBindingsByCategory(_KeyboardShortcuts.CategoryName.COMPOSER);
  if (_SettingsStore.default.getValue("MessageComposerInput.ctrlEnterToSend")) {
    bindings.push({
      action: _KeyboardShortcuts.KeyBindingAction.SendMessage,
      keyCombo: {
        key: _Keyboard.Key.ENTER,
        ctrlOrCmdKey: true
      }
    });
    bindings.push({
      action: _KeyboardShortcuts.KeyBindingAction.NewLine,
      keyCombo: {
        key: _Keyboard.Key.ENTER
      }
    });
    bindings.push({
      action: _KeyboardShortcuts.KeyBindingAction.NewLine,
      keyCombo: {
        key: _Keyboard.Key.ENTER,
        shiftKey: true
      }
    });
  } else {
    bindings.push({
      action: _KeyboardShortcuts.KeyBindingAction.SendMessage,
      keyCombo: {
        key: _Keyboard.Key.ENTER
      }
    });
    bindings.push({
      action: _KeyboardShortcuts.KeyBindingAction.NewLine,
      keyCombo: {
        key: _Keyboard.Key.ENTER,
        shiftKey: true
      }
    });
    if (_Keyboard.IS_MAC) {
      bindings.push({
        action: _KeyboardShortcuts.KeyBindingAction.NewLine,
        keyCombo: {
          key: _Keyboard.Key.ENTER,
          altKey: true
        }
      });
    }
  }
  return bindings;
};
const autocompleteBindings = () => {
  const bindings = getBindingsByCategory(_KeyboardShortcuts.CategoryName.AUTOCOMPLETE);
  bindings.push({
    action: _KeyboardShortcuts.KeyBindingAction.ForceCompleteAutocomplete,
    keyCombo: {
      key: _Keyboard.Key.TAB
    }
  });
  bindings.push({
    action: _KeyboardShortcuts.KeyBindingAction.ForceCompleteAutocomplete,
    keyCombo: {
      key: _Keyboard.Key.TAB,
      ctrlKey: true
    }
  });
  bindings.push({
    action: _KeyboardShortcuts.KeyBindingAction.CompleteAutocomplete,
    keyCombo: {
      key: _Keyboard.Key.ENTER
    }
  });
  bindings.push({
    action: _KeyboardShortcuts.KeyBindingAction.CompleteAutocomplete,
    keyCombo: {
      key: _Keyboard.Key.ENTER,
      ctrlKey: true
    }
  });
  return bindings;
};
const roomListBindings = () => {
  return getBindingsByCategory(_KeyboardShortcuts.CategoryName.ROOM_LIST);
};
const roomBindings = () => {
  const bindings = getBindingsByCategory(_KeyboardShortcuts.CategoryName.ROOM);
  if (_SettingsStore.default.getValue("ctrlFForSearch")) {
    bindings.push({
      action: _KeyboardShortcuts.KeyBindingAction.SearchInRoom,
      keyCombo: {
        key: _Keyboard.Key.F,
        ctrlOrCmdKey: true
      }
    });
  }
  return bindings;
};
const navigationBindings = () => {
  return getBindingsByCategory(_KeyboardShortcuts.CategoryName.NAVIGATION);
};
const accessibilityBindings = () => {
  return getBindingsByCategory(_KeyboardShortcuts.CategoryName.ACCESSIBILITY);
};
const callBindings = () => {
  return getBindingsByCategory(_KeyboardShortcuts.CategoryName.CALLS);
};
const labsBindings = () => {
  if (!_SdkConfig.default.get("show_labs_settings")) return [];
  return getBindingsByCategory(_KeyboardShortcuts.CategoryName.LABS);
};
const defaultBindingsProvider = {
  getMessageComposerBindings: messageComposerBindings,
  getAutocompleteBindings: autocompleteBindings,
  getRoomListBindings: roomListBindings,
  getRoomBindings: roomBindings,
  getNavigationBindings: navigationBindings,
  getAccessibilityBindings: accessibilityBindings,
  getCallBindings: callBindings,
  getLabsBindings: labsBindings
};
exports.defaultBindingsProvider = defaultBindingsProvider;
//# sourceMappingURL=KeyBindingsDefaults.js.map