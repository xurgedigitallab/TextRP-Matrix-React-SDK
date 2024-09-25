"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _SettingController = _interopRequireDefault(require("./SettingController"));
/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

// Dev note: This whole class exists in the event someone logs out and back in - we want
// to make sure the right MatrixClient is listening for changes.
/**
 * Represents the base class for settings controllers which need access to a MatrixClient.
 * This class performs no logic and should be overridden.
 */
class MatrixClientBackedController extends _SettingController.default {
  static set matrixClient(client) {
    const oldClient = MatrixClientBackedController._matrixClient;
    MatrixClientBackedController._matrixClient = client;
    for (const instance of MatrixClientBackedController.instances) {
      instance.initMatrixClient(oldClient, client);
    }
  }
  constructor() {
    super();
    MatrixClientBackedController.instances.push(this);
  }
  get client() {
    return MatrixClientBackedController._matrixClient;
  }
}
exports.default = MatrixClientBackedController;
(0, _defineProperty2.default)(MatrixClientBackedController, "_matrixClient", void 0);
(0, _defineProperty2.default)(MatrixClientBackedController, "instances", []);
//# sourceMappingURL=MatrixClientBackedController.js.map