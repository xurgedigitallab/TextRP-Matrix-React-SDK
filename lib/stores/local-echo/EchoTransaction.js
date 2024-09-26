"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TransactionStatus = exports.EchoTransaction = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
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
let TransactionStatus = /*#__PURE__*/function (TransactionStatus) {
  TransactionStatus[TransactionStatus["Pending"] = 0] = "Pending";
  TransactionStatus[TransactionStatus["Success"] = 1] = "Success";
  TransactionStatus[TransactionStatus["Error"] = 2] = "Error";
  return TransactionStatus;
}({});
exports.TransactionStatus = TransactionStatus;
class EchoTransaction extends _Whenable.Whenable {
  constructor(auditName, runFn) {
    super();
    this.auditName = auditName;
    this.runFn = runFn;
    (0, _defineProperty2.default)(this, "_status", TransactionStatus.Pending);
    (0, _defineProperty2.default)(this, "didFail", false);
    (0, _defineProperty2.default)(this, "startTime", new Date());
  }
  get didPreviouslyFail() {
    return this.didFail;
  }
  get status() {
    return this._status;
  }
  run() {
    if (this.status === TransactionStatus.Success) {
      throw new Error("Cannot re-run a successful echo transaction");
    }
    this.setStatus(TransactionStatus.Pending);
    this.runFn().then(() => this.setStatus(TransactionStatus.Success)).catch(() => this.setStatus(TransactionStatus.Error));
  }
  cancel() {
    // Success basically means "done"
    this.setStatus(TransactionStatus.Success);
  }
  setStatus(status) {
    this._status = status;
    if (status === TransactionStatus.Error) {
      this.didFail = true;
    } else if (status === TransactionStatus.Success) {
      this.didFail = false;
    }
    this.notifyCondition(status);
  }
}
exports.EchoTransaction = EchoTransaction;
//# sourceMappingURL=EchoTransaction.js.map