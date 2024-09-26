"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _SettingsHandler = _interopRequireDefault(require("./SettingsHandler"));
/*
Copyright 2019 - 2022 The Matrix.org Foundation C.I.C.

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
 * Abstract settings handler wrapping around localStorage making getValue calls cheaper
 * by caching the values and listening for localStorage updates from other tabs.
 */
class AbstractLocalStorageSettingsHandler extends _SettingsHandler.default {
  // Expose the clear event for Lifecycle to call, the storage listener only fires for changes from other tabs
  static clear() {
    AbstractLocalStorageSettingsHandler.itemCache.clear();
    AbstractLocalStorageSettingsHandler.objectCache.clear();
  }
  constructor() {
    super();
    if (!AbstractLocalStorageSettingsHandler.storageListenerBound) {
      AbstractLocalStorageSettingsHandler.storageListenerBound = true;
      // Listen for storage changes from other tabs to bust the cache
      window.addEventListener("storage", AbstractLocalStorageSettingsHandler.onStorageEvent);
    }
  }
  getItem(key) {
    if (!AbstractLocalStorageSettingsHandler.itemCache.has(key)) {
      const value = localStorage.getItem(key);
      AbstractLocalStorageSettingsHandler.itemCache.set(key, value);
      return value;
    }
    return AbstractLocalStorageSettingsHandler.itemCache.get(key);
  }
  getBoolean(key) {
    const item = this.getItem(key);
    if (item === "true") return true;
    if (item === "false") return false;
    // Fall back to the next config level
    return null;
  }
  getObject(key) {
    if (!AbstractLocalStorageSettingsHandler.objectCache.has(key)) {
      try {
        const value = JSON.parse(localStorage.getItem(key));
        AbstractLocalStorageSettingsHandler.objectCache.set(key, value);
        return value;
      } catch (err) {
        console.error("Failed to parse localStorage object", err);
        return null;
      }
    }
    return AbstractLocalStorageSettingsHandler.objectCache.get(key);
  }
  setItem(key, value) {
    AbstractLocalStorageSettingsHandler.itemCache.set(key, value);
    localStorage.setItem(key, value);
  }
  setBoolean(key, value) {
    this.setItem(key, `${value}`);
  }
  setObject(key, value) {
    AbstractLocalStorageSettingsHandler.objectCache.set(key, value);
    localStorage.setItem(key, JSON.stringify(value));
  }

  // handles both items and objects
  removeItem(key) {
    localStorage.removeItem(key);
    AbstractLocalStorageSettingsHandler.itemCache.delete(key);
    AbstractLocalStorageSettingsHandler.objectCache.delete(key);
  }
  isSupported() {
    return localStorage !== undefined && localStorage !== null;
  }
}
exports.default = AbstractLocalStorageSettingsHandler;
// Shared cache between all subclass instances
(0, _defineProperty2.default)(AbstractLocalStorageSettingsHandler, "itemCache", new Map());
(0, _defineProperty2.default)(AbstractLocalStorageSettingsHandler, "objectCache", new Map());
(0, _defineProperty2.default)(AbstractLocalStorageSettingsHandler, "storageListenerBound", false);
(0, _defineProperty2.default)(AbstractLocalStorageSettingsHandler, "onStorageEvent", e => {
  if (e.key === null) {
    AbstractLocalStorageSettingsHandler.clear();
  } else {
    AbstractLocalStorageSettingsHandler.itemCache.delete(e.key);
    AbstractLocalStorageSettingsHandler.objectCache.delete(e.key);
  }
});
//# sourceMappingURL=AbstractLocalStorageSettingsHandler.js.map