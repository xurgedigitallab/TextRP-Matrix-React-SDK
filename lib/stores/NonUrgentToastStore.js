"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _events = _interopRequireDefault(require("events"));
var _AsyncStore = require("./AsyncStore");
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

class NonUrgentToastStore extends _events.default {
  constructor() {
    super(...arguments);
    (0, _defineProperty2.default)(this, "toasts", new Map());
  }
  static get instance() {
    if (!NonUrgentToastStore._instance) {
      NonUrgentToastStore._instance = new NonUrgentToastStore();
    }
    return NonUrgentToastStore._instance;
  }
  get components() {
    return Array.from(this.toasts.values());
  }
  addToast(c) {
    const ref = Symbol();
    this.toasts.set(ref, c);
    this.emit(_AsyncStore.UPDATE_EVENT);
    return ref;
  }
  removeToast(ref) {
    this.toasts.delete(ref);
    this.emit(_AsyncStore.UPDATE_EVENT);
  }
}
exports.default = NonUrgentToastStore;
(0, _defineProperty2.default)(NonUrgentToastStore, "_instance", void 0);
//# sourceMappingURL=NonUrgentToastStore.js.map