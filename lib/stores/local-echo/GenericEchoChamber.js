"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PROPERTY_UPDATED = exports.GenericEchoChamber = void 0;
exports.implicitlyReverted = implicitlyReverted;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _events = require("events");
var _EchoTransaction = require("./EchoTransaction");
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

async function implicitlyReverted() {
  // do nothing :D
}
const PROPERTY_UPDATED = "property_updated";
exports.PROPERTY_UPDATED = PROPERTY_UPDATED;
class GenericEchoChamber extends _events.EventEmitter {
  constructor(context, lookupFn) {
    super();
    this.context = context;
    this.lookupFn = lookupFn;
    (0, _defineProperty2.default)(this, "cache", new Map());
    (0, _defineProperty2.default)(this, "matrixClient", null);
  }
  setClient(client) {
    const oldClient = this.matrixClient;
    this.matrixClient = client;
    this.onClientChanged(oldClient, client);
  }
  /**
   * Gets a value. If the key is in flight, the cached value will be returned. If
   * the key is not in flight then the lookupFn provided to this class will be
   * called instead.
   * @param key The key to look up.
   * @returns The value for the key.
   */
  getValue(key) {
    return this.cache.has(key) ? this.cache.get(key).val : this.lookupFn(key);
  }
  cacheVal(key, val, txn) {
    this.cache.set(key, {
      txn,
      val
    });
    this.emit(PROPERTY_UPDATED, key);
  }
  decacheKey(key) {
    if (this.cache.has(key)) {
      this.context.disownTransaction(this.cache.get(key).txn);
      this.cache.delete(key);
      this.emit(PROPERTY_UPDATED, key);
    }
  }
  markEchoReceived(key) {
    if (this.cache.has(key)) {
      const txn = this.cache.get(key).txn;
      this.context.disownTransaction(txn);
      txn.cancel();
    }
    this.decacheKey(key);
  }
  setValue(auditName, key, targetVal, runFn, revertFn) {
    // Cancel any pending transactions for the same key
    if (this.cache.has(key)) {
      this.cache.get(key).txn.cancel();
    }
    const ctxn = this.context.beginTransaction(auditName, runFn);
    this.cacheVal(key, targetVal, ctxn); // set the cache now as it won't be updated by the .when() ladder below.

    ctxn.when(_EchoTransaction.TransactionStatus.Pending, () => this.cacheVal(key, targetVal, ctxn)).when(_EchoTransaction.TransactionStatus.Error, () => revertFn());
    ctxn.run();
  }
}
exports.GenericEchoChamber = GenericEchoChamber;
//# sourceMappingURL=GenericEchoChamber.js.map