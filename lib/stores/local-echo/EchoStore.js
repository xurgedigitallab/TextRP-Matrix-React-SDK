"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.EchoStore = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _RoomEchoChamber = require("./RoomEchoChamber");
var _RoomEchoContext = require("./RoomEchoContext");
var _AsyncStoreWithClient = require("../AsyncStoreWithClient");
var _dispatcher = _interopRequireDefault(require("../../dispatcher/dispatcher"));
var _EchoContext = require("./EchoContext");
var _NonUrgentToastStore = _interopRequireDefault(require("../NonUrgentToastStore"));
var _NonUrgentEchoFailureToast = _interopRequireDefault(require("../../components/views/toasts/NonUrgentEchoFailureToast"));
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

const roomContextKey = room => `room-${room.roomId}`;
class EchoStore extends _AsyncStoreWithClient.AsyncStoreWithClient {
  constructor() {
    super(_dispatcher.default);
    (0, _defineProperty2.default)(this, "caches", new Map());
  }
  static get instance() {
    if (!this._instance) {
      this._instance = new EchoStore();
      this._instance.start();
    }
    return this._instance;
  }
  get contexts() {
    return Array.from(this.caches.values()).map(e => e.context);
  }
  getOrCreateChamberForRoom(room) {
    if (this.caches.has(roomContextKey(room))) {
      return this.caches.get(roomContextKey(room));
    }
    const context = new _RoomEchoContext.RoomEchoContext(room);
    context.whenAnything(() => this.checkContexts());
    const echo = new _RoomEchoChamber.RoomEchoChamber(context);
    echo.setClient(this.matrixClient);
    this.caches.set(roomContextKey(room), echo);
    return echo;
  }
  async checkContexts() {
    let hasOrHadError = false;
    for (const echo of this.caches.values()) {
      hasOrHadError = echo.context.state === _EchoContext.ContextTransactionState.PendingErrors;
      if (hasOrHadError) break;
    }
    if (hasOrHadError && !this.state.toastRef) {
      const ref = _NonUrgentToastStore.default.instance.addToast(_NonUrgentEchoFailureToast.default);
      await this.updateState({
        toastRef: ref
      });
    } else if (!hasOrHadError && this.state.toastRef) {
      _NonUrgentToastStore.default.instance.removeToast(this.state.toastRef);
      await this.updateState({
        toastRef: null
      });
    }
  }
  async onReady() {
    if (!this.caches) return; // can only happen during initialization
    for (const echo of this.caches.values()) {
      echo.setClient(this.matrixClient);
    }
  }
  async onNotReady() {
    for (const echo of this.caches.values()) {
      echo.setClient(null);
    }
  }
  async onAction(payload) {}
}
exports.EchoStore = EchoStore;
(0, _defineProperty2.default)(EchoStore, "_instance", void 0);
//# sourceMappingURL=EchoStore.js.map