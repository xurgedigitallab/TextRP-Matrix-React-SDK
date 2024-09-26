"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _actions = require("../dispatcher/actions");
var _dispatcher = _interopRequireDefault(require("../dispatcher/dispatcher"));
var _AsyncStore = require("./AsyncStore");
/*
Copyright 2017-2021 The Matrix.org Foundation C.I.C.

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

const INITIAL_STATE = {
  deferredAction: null
};

/**
 * A class for storing application state to do with authentication. This is a simple
 * store that listens for actions and updates its state accordingly, informing any
 * listeners (views) of state changes.
 */
class LifecycleStore extends _AsyncStore.AsyncStore {
  constructor() {
    super(_dispatcher.default, INITIAL_STATE);
  }
  onDispatch(payload) {
    switch (payload.action) {
      case _actions.Action.DoAfterSyncPrepared:
        this.updateState({
          deferredAction: payload.deferred_action
        });
        break;
      case "cancel_after_sync_prepared":
        this.updateState({
          deferredAction: null
        });
        break;
      case "MatrixActions.sync":
        {
          if (payload.state !== "PREPARED") {
            break;
          }
          if (!this.state.deferredAction) break;
          const deferredAction = Object.assign({}, this.state.deferredAction);
          this.updateState({
            deferredAction: null
          });
          _dispatcher.default.dispatch(deferredAction);
          break;
        }
      case "on_client_not_viable":
      case _actions.Action.OnLoggedOut:
        this.reset();
        break;
    }
  }
}
let singletonLifecycleStore = null;
if (!singletonLifecycleStore) {
  singletonLifecycleStore = new LifecycleStore();
}
var _default = singletonLifecycleStore;
exports.default = _default;
//# sourceMappingURL=LifecycleStore.js.map