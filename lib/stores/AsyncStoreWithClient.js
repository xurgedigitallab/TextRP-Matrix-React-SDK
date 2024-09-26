"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.AsyncStoreWithClient = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _AsyncStore = require("./AsyncStore");
var _ReadyWatchingStore = require("./ReadyWatchingStore");
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

class AsyncStoreWithClient extends _AsyncStore.AsyncStore {
  constructor(dispatcher) {
    let initialState = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    super(dispatcher, initialState);

    // Create an anonymous class to avoid code duplication
    (0, _defineProperty2.default)(this, "readyStore", void 0);
    const asyncStore = this; // eslint-disable-line @typescript-eslint/no-this-alias
    this.readyStore = new class extends _ReadyWatchingStore.ReadyWatchingStore {
      get mxClient() {
        return this.matrixClient;
      }
      async onReady() {
        return asyncStore.onReady();
      }
      async onNotReady() {
        return asyncStore.onNotReady();
      }
    }(dispatcher);
  }
  async start() {
    await this.readyStore.start();
  }
  get matrixClient() {
    return this.readyStore.mxClient;
  }
  async onReady() {
    // Default implementation is to do nothing.
  }
  async onNotReady() {
    // Default implementation is to do nothing.
  }
  async onDispatch(payload) {
    await this.onAction(payload);
  }
}
exports.AsyncStoreWithClient = AsyncStoreWithClient;
//# sourceMappingURL=AsyncStoreWithClient.js.map