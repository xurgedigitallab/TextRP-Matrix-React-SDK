"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.KeyBindingsManager = void 0;
exports.getKeyBindingsManager = getKeyBindingsManager;
exports.isKeyComboMatch = isKeyComboMatch;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _KeyBindingsDefaults = require("./KeyBindingsDefaults");
var _Keyboard = require("./Keyboard");
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

/**
 * Represent a key combination.
 *
 * The combo is evaluated strictly, i.e. the KeyboardEvent must match exactly what is specified in the KeyCombo.
 */

/**
 * Helper method to check if a KeyboardEvent matches a KeyCombo
 *
 * Note, this method is only exported for testing.
 */
function isKeyComboMatch(ev, combo, onMac) {
  if (combo.key !== undefined) {
    // When shift is pressed, letters are returned as upper case chars. In this case do a lower case comparison.
    // This works for letter combos such as shift + U as well for none letter combos such as shift + Escape.
    // If shift is not pressed, the toLowerCase conversion can be avoided.
    if (ev.shiftKey) {
      if (ev.key.toLowerCase() !== combo.key.toLowerCase()) {
        return false;
      }
    } else if (ev.key !== combo.key) {
      return false;
    }
  }
  const comboCtrl = combo.ctrlKey ?? false;
  const comboAlt = combo.altKey ?? false;
  const comboShift = combo.shiftKey ?? false;
  const comboMeta = combo.metaKey ?? false;
  // Tests mock events may keep the modifiers undefined; convert them to booleans
  const evCtrl = ev.ctrlKey ?? false;
  const evAlt = ev.altKey ?? false;
  const evShift = ev.shiftKey ?? false;
  const evMeta = ev.metaKey ?? false;
  // When ctrlOrCmd is set, the keys need do evaluated differently on PC and Mac
  if (combo.ctrlOrCmdKey) {
    if (onMac) {
      if (!evMeta || evCtrl !== comboCtrl || evAlt !== comboAlt || evShift !== comboShift) {
        return false;
      }
    } else {
      if (!evCtrl || evMeta !== comboMeta || evAlt !== comboAlt || evShift !== comboShift) {
        return false;
      }
    }
    return true;
  }
  if (evMeta !== comboMeta || evCtrl !== comboCtrl || evAlt !== comboAlt || evShift !== comboShift) {
    return false;
  }
  return true;
}
class KeyBindingsManager {
  constructor() {
    /**
     * List of key bindings providers.
     *
     * Key bindings from the first provider(s) in the list will have precedence over key bindings from later providers.
     *
     * To overwrite the default key bindings add a new providers before the default provider, e.g. a provider for
     * customized key bindings.
     */
    (0, _defineProperty2.default)(this, "bindingsProviders", [_KeyBindingsDefaults.defaultBindingsProvider]);
  }
  /**
   * Finds a matching KeyAction for a given KeyboardEvent
   */
  getAction(getters, ev) {
    for (const getter of getters) {
      const bindings = getter();
      const binding = bindings.find(it => isKeyComboMatch(ev, it.keyCombo, _Keyboard.IS_MAC));
      if (binding) {
        return binding.action;
      }
    }
    return undefined;
  }
  getMessageComposerAction(ev) {
    return this.getAction(this.bindingsProviders.map(it => it.getMessageComposerBindings), ev);
  }
  getAutocompleteAction(ev) {
    return this.getAction(this.bindingsProviders.map(it => it.getAutocompleteBindings), ev);
  }
  getRoomListAction(ev) {
    return this.getAction(this.bindingsProviders.map(it => it.getRoomListBindings), ev);
  }
  getRoomAction(ev) {
    return this.getAction(this.bindingsProviders.map(it => it.getRoomBindings), ev);
  }
  getNavigationAction(ev) {
    return this.getAction(this.bindingsProviders.map(it => it.getNavigationBindings), ev);
  }
  getAccessibilityAction(ev) {
    return this.getAction(this.bindingsProviders.map(it => it.getAccessibilityBindings), ev);
  }
  getCallAction(ev) {
    return this.getAction(this.bindingsProviders.map(it => it.getCallBindings), ev);
  }
  getLabsAction(ev) {
    return this.getAction(this.bindingsProviders.map(it => it.getLabsBindings), ev);
  }
}
exports.KeyBindingsManager = KeyBindingsManager;
const manager = new KeyBindingsManager();
function getKeyBindingsManager() {
  return manager;
}
//# sourceMappingURL=KeyBindingsManager.js.map