"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.defaultDispatcher = exports.default = exports.MatrixDispatcher = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _payloads = require("./payloads");
/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 New Vector Ltd
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

function invariant(cond, error) {
  if (!cond) throw new Error(error);
}

/**
 * A dispatcher for ActionPayloads (the default within the SDK).
 * Based on the old Flux dispatcher https://github.com/facebook/flux/blob/main/src/Dispatcher.js
 */
class MatrixDispatcher {
  constructor() {
    (0, _defineProperty2.default)(this, "callbacks", new Map());
    (0, _defineProperty2.default)(this, "isHandled", new Map());
    (0, _defineProperty2.default)(this, "isPending", new Map());
    (0, _defineProperty2.default)(this, "pendingPayload", void 0);
    (0, _defineProperty2.default)(this, "lastId", 1);
    /**
     * Dispatches a payload to all registered callbacks.
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    (0, _defineProperty2.default)(this, "_dispatch", payload => {
      invariant(!this.isDispatching(), "Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch.");
      this.startDispatching(payload);
      try {
        for (const [id] of this.callbacks) {
          if (this.isPending.get(id)) {
            continue;
          }
          this.invokeCallback(id);
        }
      } finally {
        this.stopDispatching();
      }
    });
  }
  /**
   * Registers a callback to be invoked with every dispatched payload. Returns
   * a token that can be used with `waitFor()`.
   */
  register(callback) {
    const id = "ID_" + this.lastId++;
    this.callbacks.set(id, callback);
    if (this.isDispatching()) {
      // If there is a dispatch happening right now then the newly registered callback should be skipped
      this.isPending.set(id, true);
      this.isHandled.set(id, true);
    }
    return id;
  }

  /**
   * Removes a callback based on its token.
   */
  unregister(id) {
    invariant(this.callbacks.has(id), `Dispatcher.unregister(...): '${id}' does not map to a registered callback.`);
    this.callbacks.delete(id);
  }

  /**
   * Waits for the callbacks specified to be invoked before continuing execution
   * of the current callback. This method should only be used by a callback in
   * response to a dispatched payload.
   */
  waitFor(ids) {
    invariant(this.isDispatching(), "Dispatcher.waitFor(...): Must be invoked while dispatching.");
    for (const id of ids) {
      if (this.isPending.get(id)) {
        invariant(this.isHandled.get(id), `Dispatcher.waitFor(...): Circular dependency detected while waiting for '${id}'.`);
        continue;
      }
      invariant(this.callbacks.get(id), `Dispatcher.waitFor(...): '${id}' does not map to a registered callback.`);
      this.invokeCallback(id);
    }
  }
  /**
   * Is this Dispatcher currently dispatching.
   */
  isDispatching() {
    return !!this.pendingPayload;
  }

  /**
   * Call the callback stored with the given id. Also do some internal
   * bookkeeping.
   *
   * Must only be called with an id which has a callback and pendingPayload set
   * @internal
   */
  invokeCallback(id) {
    this.isPending.set(id, true);
    this.callbacks.get(id)(this.pendingPayload);
    this.isHandled.set(id, true);
  }

  /**
   * Set up bookkeeping needed when dispatching.
   *
   * @internal
   */
  startDispatching(payload) {
    for (const [id] of this.callbacks) {
      this.isPending.set(id, false);
      this.isHandled.set(id, false);
    }
    this.pendingPayload = payload;
  }

  /**
   * Clear bookkeeping used for dispatching.
   *
   * @internal
   */
  stopDispatching() {
    this.pendingPayload = undefined;
  }

  /**
   * Dispatches an event on the dispatcher's event bus.
   * @param {ActionPayload} payload Required. The payload to dispatch.
   * @param {boolean=false} sync Optional. Pass true to dispatch
   *        synchronously. This is useful for anything triggering
   *        an operation that the browser requires user interaction
   *        for. Default false (async).
   */
  dispatch(payload) {
    let sync = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    if (payload instanceof _payloads.AsyncActionPayload) {
      payload.fn(action => {
        this.dispatch(action, sync);
      });
      return;
    }
    if (sync) {
      this._dispatch(payload);
    } else {
      // Unless the caller explicitly asked for us to dispatch synchronously,
      // we always set a timeout to do this: The flux dispatcher complains
      // if you dispatch from within a dispatch, so rather than action
      // handlers having to worry about not calling anything that might
      // then dispatch, we just do dispatches asynchronously.
      window.setTimeout(this._dispatch, 0, payload);
    }
  }

  /**
   * Shorthand for dispatch({action: Action.WHATEVER}, sync). No additional
   * properties can be included with this version.
   * @param {Action} action The action to dispatch.
   * @param {boolean=false} sync Whether the dispatch should be sync or not.
   * @see dispatch(action: ActionPayload, sync: boolean)
   */
  fire(action) {
    let sync = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    this.dispatch({
      action
    }, sync);
  }
}
exports.MatrixDispatcher = MatrixDispatcher;
const defaultDispatcher = new MatrixDispatcher();
exports.defaultDispatcher = defaultDispatcher;
if (!window.mxDispatcher) {
  window.mxDispatcher = defaultDispatcher;
}
var _default = defaultDispatcher;
exports.default = _default;
//# sourceMappingURL=dispatcher.js.map