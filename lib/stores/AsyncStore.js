"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.UPDATE_EVENT = exports.AsyncStore = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _events = require("events");
var _awaitLock = _interopRequireDefault(require("await-lock"));
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
 * The event/channel to listen for in an AsyncStore.
 */
const UPDATE_EVENT = "update";

/**
 * Represents a minimal store which works similar to Flux stores. Instead
 * of everything needing to happen in a dispatch cycle, everything can
 * happen async to that cycle.
 *
 * The store operates by using Object.assign() to mutate state - it sends the
 * state objects (current and new) through the function onto a new empty
 * object. Because of this, it is recommended to break out your state to be as
 * safe as possible. The state mutations are also locked, preventing concurrent
 * writes.
 *
 * All updates to the store happen on the UPDATE_EVENT event channel with the
 * one argument being the instance of the store.
 *
 * To update the state, use updateState() and preferably await the result to
 * help prevent lock conflicts.
 */
exports.UPDATE_EVENT = UPDATE_EVENT;
class AsyncStore extends _events.EventEmitter {
  /**
   * Creates a new AsyncStore using the given dispatcher.
   * @param {Dispatcher<ActionPayload>} dispatcher The dispatcher to rely upon.
   * @param {T} initialState The initial state for the store.
   */
  constructor(dispatcher) {
    let initialState = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    super();
    this.dispatcher = dispatcher;
    (0, _defineProperty2.default)(this, "storeState", void 0);
    (0, _defineProperty2.default)(this, "lock", new _awaitLock.default());
    (0, _defineProperty2.default)(this, "dispatcherRef", void 0);
    this.dispatcherRef = dispatcher.register(this.onDispatch.bind(this));
    this.storeState = initialState;
  }

  /**
   * The current state of the store. Cannot be mutated.
   */
  get state() {
    return this.storeState;
  }

  /**
   * Stops the store's listening functions, such as the listener to the dispatcher.
   */
  stop() {
    if (this.dispatcherRef) this.dispatcher.unregister(this.dispatcherRef);
  }

  /**
   * Updates the state of the store.
   * @param {T|*} newState The state to update in the store using Object.assign()
   */
  async updateState(newState) {
    await this.lock.acquireAsync();
    try {
      this.storeState = Object.freeze(Object.assign({}, this.storeState, newState));
      this.emit(UPDATE_EVENT, this);
    } finally {
      await this.lock.release();
    }
  }

  /**
   * Resets the store's to the provided state or an empty object.
   * @param {T|*} newState The new state of the store.
   * @param {boolean} quiet If true, the function will not raise an UPDATE_EVENT.
   */
  async reset() {
    let newState = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    let quiet = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    await this.lock.acquireAsync();
    try {
      this.storeState = Object.freeze(newState || {});
      if (!quiet) this.emit(UPDATE_EVENT, this);
    } finally {
      await this.lock.release();
    }
  }

  /**
   * Called when the dispatcher broadcasts a dispatch event.
   * @param {ActionPayload} payload The event being dispatched.
   */
}
exports.AsyncStore = AsyncStore;
//# sourceMappingURL=AsyncStore.js.map