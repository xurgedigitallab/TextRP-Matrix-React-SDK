"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createReconnectedListener = void 0;
var _sync = require("matrix-js-sdk/src/sync");
/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
 * Creates a MatrixClient event listener function that can be used to get notified about reconnects.
 * @param callback The callback to be called on reconnect
 */
const createReconnectedListener = callback => {
  return (syncState, prevState) => {
    if (syncState !== _sync.SyncState.Error && prevState !== syncState) {
      // Consider the client reconnected if there is no error with syncing.
      // This means the state could be RECONNECTING, SYNCING, PREPARED or CATCHUP.
      callback();
    }
  };
};
exports.createReconnectedListener = createReconnectedListener;
//# sourceMappingURL=connection.js.map