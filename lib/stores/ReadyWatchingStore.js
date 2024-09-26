"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ReadyWatchingStore = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _sync = require("matrix-js-sdk/src/sync");
var _events = require("events");
var _MatrixClientPeg = require("../MatrixClientPeg");
var _actions = require("../dispatcher/actions");
/*
 * Copyright 2021 - 2022 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

class ReadyWatchingStore extends _events.EventEmitter {
  constructor(dispatcher) {
    super();
    this.dispatcher = dispatcher;
    (0, _defineProperty2.default)(this, "matrixClient", null);
    (0, _defineProperty2.default)(this, "dispatcherRef", null);
    (0, _defineProperty2.default)(this, "onAction", async payload => {
      this.onDispatcherAction(payload);
      if (payload.action === "MatrixActions.sync") {
        // Only set the client on the transition into the PREPARED state.
        // Everything after this is unnecessary (we only need to know once we have a client)
        // and we intentionally don't set the client before this point to avoid stores
        // updating for every event emitted during the cached sync.
        if (payload.prevState !== _sync.SyncState.Prepared && payload.state === _sync.SyncState.Prepared && this.matrixClient !== payload.matrixClient) {
          if (this.matrixClient) {
            await this.onNotReady();
          }
          this.matrixClient = payload.matrixClient;
          await this.onReady();
        }
      } else if (payload.action === "on_client_not_viable" || payload.action === _actions.Action.OnLoggedOut) {
        if (this.matrixClient) {
          await this.onNotReady();
          this.matrixClient = null;
        }
      }
    });
  }
  async start() {
    this.dispatcherRef = this.dispatcher.register(this.onAction);
    const matrixClient = _MatrixClientPeg.MatrixClientPeg.get();
    if (matrixClient) {
      this.matrixClient = matrixClient;
      await this.onReady();
    }
  }
  get mxClient() {
    return this.matrixClient; // for external readonly access
  }

  useUnitTestClient(cli) {
    this.matrixClient = cli;
  }
  destroy() {
    if (this.dispatcherRef !== null) this.dispatcher.unregister(this.dispatcherRef);
  }
  async onReady() {
    // Default implementation is to do nothing.
  }
  async onNotReady() {
    // Default implementation is to do nothing.
  }
  onDispatcherAction(payload) {
    // Default implementation is to do nothing.
  }
}
exports.ReadyWatchingStore = ReadyWatchingStore;
//# sourceMappingURL=ReadyWatchingStore.js.map