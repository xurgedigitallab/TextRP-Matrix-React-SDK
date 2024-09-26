"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.EchoContext = exports.ContextTransactionState = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _EchoTransaction = require("./EchoTransaction");
var _arrays = require("../../utils/arrays");
var _Whenable = require("../../utils/Whenable");
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
let ContextTransactionState = /*#__PURE__*/function (ContextTransactionState) {
  ContextTransactionState[ContextTransactionState["NotStarted"] = 0] = "NotStarted";
  ContextTransactionState[ContextTransactionState["PendingErrors"] = 1] = "PendingErrors";
  ContextTransactionState[ContextTransactionState["AllSuccessful"] = 2] = "AllSuccessful";
  return ContextTransactionState;
}({});
exports.ContextTransactionState = ContextTransactionState;
class EchoContext extends _Whenable.Whenable {
  constructor() {
    super(...arguments);
    (0, _defineProperty2.default)(this, "_transactions", []);
    (0, _defineProperty2.default)(this, "_state", ContextTransactionState.NotStarted);
    (0, _defineProperty2.default)(this, "checkTransactions", () => {
      let status = ContextTransactionState.AllSuccessful;
      for (const txn of this.transactions) {
        if (txn.status === _EchoTransaction.TransactionStatus.Error || txn.didPreviouslyFail) {
          status = ContextTransactionState.PendingErrors;
          break;
        } else if (txn.status === _EchoTransaction.TransactionStatus.Pending) {
          status = ContextTransactionState.NotStarted;
          // no break as we might hit something which broke
        }
      }

      this._state = status;
      this.notifyCondition(status);
    });
  }
  get transactions() {
    return (0, _arrays.arrayFastClone)(this._transactions);
  }
  get state() {
    return this._state;
  }
  get firstFailedTime() {
    const failedTxn = this.transactions.find(t => t.didPreviouslyFail || t.status === _EchoTransaction.TransactionStatus.Error);
    if (failedTxn) return failedTxn.startTime;
    return null;
  }
  disownTransaction(txn) {
    const idx = this._transactions.indexOf(txn);
    if (idx >= 0) this._transactions.splice(idx, 1);
    txn.destroy();
    this.checkTransactions();
  }
  beginTransaction(auditName, runFn) {
    const txn = new _EchoTransaction.EchoTransaction(auditName, runFn);
    this._transactions.push(txn);
    txn.whenAnything(this.checkTransactions);

    // We have no intent to call the transaction again if it succeeds (in fact, it'll
    // be really angry at us if we do), so call that the end of the road for the events.
    txn.when(_EchoTransaction.TransactionStatus.Success, () => txn.destroy());
    return txn;
  }
  destroy() {
    for (const txn of this.transactions) {
      txn.destroy();
    }
    this._transactions = [];
    super.destroy();
  }
}
exports.EchoContext = EchoContext;
//# sourceMappingURL=EchoContext.js.map