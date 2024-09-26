"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = createMatrixClient;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _matrix = require("matrix-js-sdk/src/matrix");
var _indexeddbCryptoStore = require("matrix-js-sdk/src/crypto/store/indexeddb-crypto-store");
var _indexeddb = require("matrix-js-sdk/src/store/indexeddb");
var _localStorageCryptoStore = require("matrix-js-sdk/src/crypto/store/localStorage-crypto-store");
var _indexeddbWorker = _interopRequireDefault(require("../workers/indexeddb.worker.ts"));
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         Copyright 2017 - 2021 The Matrix.org Foundation C.I.C.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         Licensed under the Apache License, Version 2.0 (the "License");
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         you may not use this file except in compliance with the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         You may obtain a copy of the License at
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             http://www.apache.org/licenses/LICENSE-2.0
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         Unless required by applicable law or agreed to in writing, software
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         distributed under the License is distributed on an "AS IS" BASIS,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         See the License for the specific language governing permissions and
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         limitations under the License.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         */ // @ts-ignore - `.ts` is needed here to make TS happy
const localStorage = window.localStorage;

// just *accessing* indexedDB throws an exception in firefox with
// indexeddb disabled.
let indexedDB;
try {
  indexedDB = window.indexedDB;
} catch (e) {}

/**
 * Create a new matrix client, with the persistent stores set up appropriately
 * (using localstorage/indexeddb, etc)
 *
 * @param {Object} opts  options to pass to Matrix.createClient. This will be
 *    extended with `sessionStore` and `store` members.
 *
 * @returns {MatrixClient} the newly-created MatrixClient
 */
function createMatrixClient(opts) {
  const storeOpts = {
    useAuthorizationHeader: true
  };
  if (indexedDB && localStorage) {
    storeOpts.store = new _indexeddb.IndexedDBStore({
      indexedDB: indexedDB,
      dbName: "riot-web-sync",
      localStorage,
      workerFactory: () => new _indexeddbWorker.default()
    });
  } else if (localStorage) {
    storeOpts.store = new _matrix.MemoryStore({
      localStorage
    });
  }
  if (indexedDB) {
    storeOpts.cryptoStore = new _indexeddbCryptoStore.IndexedDBCryptoStore(indexedDB, "matrix-js-sdk:crypto");
  } else if (localStorage) {
    storeOpts.cryptoStore = new _localStorageCryptoStore.LocalStorageCryptoStore(localStorage);
  } else {
    storeOpts.cryptoStore = new _matrix.MemoryCryptoStore();
  }
  return (0, _matrix.createClient)(_objectSpread(_objectSpread({}, storeOpts), opts));
}
//# sourceMappingURL=createMatrixClient.js.map