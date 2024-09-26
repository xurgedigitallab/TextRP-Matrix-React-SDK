"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _events = _interopRequireDefault(require("events"));
/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
 * Holds the active toasts
 */
class ToastStore extends _events.default {
  constructor() {
    super(...arguments);
    (0, _defineProperty2.default)(this, "toasts", []);
    // The count of toasts which have been seen & dealt with in this stack
    // where the count resets when the stack of toasts clears.
    (0, _defineProperty2.default)(this, "countSeen", 0);
  }
  static sharedInstance() {
    if (!window.mxToastStore) window.mxToastStore = new ToastStore();
    return window.mxToastStore;
  }
  reset() {
    this.toasts = [];
    this.countSeen = 0;
  }

  /**
   * Add or replace a toast
   * If a toast with the same toastKey already exists, the given toast will replace it
   * Toasts are always added underneath any toasts of the same priority, so existing
   * toasts stay at the top unless a higher priority one arrives (better to not change the
   * toast unless necessary).
   *
   * @param {object} newToast The new toast
   */
  addOrReplaceToast(newToast) {
    const oldIndex = this.toasts.findIndex(t => t.key === newToast.key);
    if (oldIndex === -1) {
      let newIndex = this.toasts.length;
      while (newIndex > 0 && this.toasts[newIndex - 1].priority < newToast.priority) --newIndex;
      this.toasts.splice(newIndex, 0, newToast);
    } else {
      this.toasts[oldIndex] = newToast;
    }
    this.emit("update");
  }
  dismissToast(key) {
    if (this.toasts[0] && this.toasts[0].key === key) {
      this.countSeen++;
    }
    const length = this.toasts.length;
    this.toasts = this.toasts.filter(t => t.key !== key);
    if (length !== this.toasts.length) {
      if (this.toasts.length === 0) {
        this.countSeen = 0;
      }
      this.emit("update");
    }
  }
  getToasts() {
    return this.toasts;
  }
  getCountSeen() {
    return this.countSeen;
  }
}
exports.default = ToastStore;
//# sourceMappingURL=ToastStore.js.map