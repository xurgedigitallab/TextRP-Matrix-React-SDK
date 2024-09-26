"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.checkConsistency = checkConsistency;
exports.idbDelete = idbDelete;
exports.idbLoad = idbLoad;
exports.idbSave = idbSave;
exports.setCryptoInitialised = setCryptoInitialised;
exports.tryPersistStorage = tryPersistStorage;
var _localStorageCryptoStore = require("matrix-js-sdk/src/crypto/store/localStorage-crypto-store");
var _indexeddb = require("matrix-js-sdk/src/store/indexeddb");
var _indexeddbCryptoStore = require("matrix-js-sdk/src/crypto/store/indexeddb-crypto-store");
var _logger = require("matrix-js-sdk/src/logger");
/*
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

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

const localStorage = window.localStorage;

// just *accessing* indexedDB throws an exception in firefox with
// indexeddb disabled.
let indexedDB;
try {
  indexedDB = window.indexedDB;
} catch (e) {}

// The JS SDK will add a prefix of "matrix-js-sdk:" to the sync store name.
const SYNC_STORE_NAME = "riot-web-sync";
const CRYPTO_STORE_NAME = "matrix-js-sdk:crypto";
function log(msg) {
  _logger.logger.log(`StorageManager: ${msg}`);
}
function error(msg) {
  for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    args[_key - 1] = arguments[_key];
  }
  _logger.logger.error(`StorageManager: ${msg}`, ...args);
}
function tryPersistStorage() {
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then(persistent => {
      _logger.logger.log("StorageManager: Persistent?", persistent);
    });
  } else if (document.requestStorageAccess) {
    // Safari
    document.requestStorageAccess().then(() => _logger.logger.log("StorageManager: Persistent?", true), () => _logger.logger.log("StorageManager: Persistent?", false));
  } else {
    _logger.logger.log("StorageManager: Persistence unsupported");
  }
}
async function checkConsistency() {
  log("Checking storage consistency");
  log(`Local storage supported? ${!!localStorage}`);
  log(`IndexedDB supported? ${!!indexedDB}`);
  let dataInLocalStorage = false;
  let dataInCryptoStore = false;
  let cryptoInited = false;
  let healthy = true;
  if (localStorage) {
    dataInLocalStorage = localStorage.length > 0;
    log(`Local storage contains data? ${dataInLocalStorage}`);
    cryptoInited = !!localStorage.getItem("mx_crypto_initialised");
    log(`Crypto initialised? ${cryptoInited}`);
  } else {
    healthy = false;
    error("Local storage cannot be used on this browser");
  }
  if (indexedDB && localStorage) {
    const results = await checkSyncStore();
    if (!results.healthy) {
      healthy = false;
    }
  } else {
    healthy = false;
    error("Sync store cannot be used on this browser");
  }
  if (indexedDB) {
    const results = await checkCryptoStore();
    dataInCryptoStore = results.exists;
    if (!results.healthy) {
      healthy = false;
    }
  } else {
    healthy = false;
    error("Crypto store cannot be used on this browser");
  }
  if (dataInLocalStorage && cryptoInited && !dataInCryptoStore) {
    healthy = false;
    error("Data exists in local storage and crypto is marked as initialised " + " but no data found in crypto store. " + "IndexedDB storage has likely been evicted by the browser!");
  }
  if (healthy) {
    log("Storage consistency checks passed");
  } else {
    error("Storage consistency checks failed");
  }
  return {
    dataInLocalStorage,
    dataInCryptoStore,
    cryptoInited,
    healthy
  };
}
async function checkSyncStore() {
  let exists = false;
  try {
    exists = await _indexeddb.IndexedDBStore.exists(indexedDB, SYNC_STORE_NAME);
    log(`Sync store using IndexedDB contains data? ${exists}`);
    return {
      exists,
      healthy: true
    };
  } catch (e) {
    error("Sync store using IndexedDB inaccessible", e);
  }
  log("Sync store using memory only");
  return {
    exists,
    healthy: false
  };
}
async function checkCryptoStore() {
  let exists = false;
  try {
    exists = await _indexeddbCryptoStore.IndexedDBCryptoStore.exists(indexedDB, CRYPTO_STORE_NAME);
    log(`Crypto store using IndexedDB contains data? ${exists}`);
    return {
      exists,
      healthy: true
    };
  } catch (e) {
    error("Crypto store using IndexedDB inaccessible", e);
  }
  try {
    exists = _localStorageCryptoStore.LocalStorageCryptoStore.exists(localStorage);
    log(`Crypto store using local storage contains data? ${exists}`);
    return {
      exists,
      healthy: true
    };
  } catch (e) {
    error("Crypto store using local storage inaccessible", e);
  }
  log("Crypto store using memory only");
  return {
    exists,
    healthy: false
  };
}

/**
 * Sets whether crypto has ever been successfully
 * initialised on this client.
 * StorageManager uses this to determine whether indexeddb
 * has been wiped by the browser: this flag is saved to localStorage
 * and if it is true and not crypto data is found, an error is
 * presented to the user.
 *
 * @param {boolean} cryptoInited True if crypto has been set up
 */
function setCryptoInitialised(cryptoInited) {
  localStorage.setItem("mx_crypto_initialised", String(cryptoInited));
}

/* Simple wrapper functions around IndexedDB.
 */

let idb = null;
async function idbInit() {
  if (!indexedDB) {
    throw new Error("IndexedDB not available");
  }
  idb = await new Promise((resolve, reject) => {
    const request = indexedDB.open("matrix-react-sdk", 1);
    request.onerror = reject;
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("pickleKey");
      db.createObjectStore("account");
    };
  });
}
async function idbLoad(table, key) {
  if (!idb) {
    await idbInit();
  }
  return new Promise((resolve, reject) => {
    const txn = idb.transaction([table], "readonly");
    txn.onerror = reject;
    const objectStore = txn.objectStore(table);
    const request = objectStore.get(key);
    request.onerror = reject;
    request.onsuccess = event => {
      resolve(request.result);
    };
  });
}
async function idbSave(table, key, data) {
  if (!idb) {
    await idbInit();
  }
  return new Promise((resolve, reject) => {
    const txn = idb.transaction([table], "readwrite");
    txn.onerror = reject;
    const objectStore = txn.objectStore(table);
    const request = objectStore.put(data, key);
    request.onerror = reject;
    request.onsuccess = event => {
      resolve();
    };
  });
}
async function idbDelete(table, key) {
  if (!idb) {
    await idbInit();
  }
  return new Promise((resolve, reject) => {
    const txn = idb.transaction([table], "readwrite");
    txn.onerror = reject;
    const objectStore = txn.objectStore(table);
    const request = objectStore.delete(key);
    request.onerror = reject;
    request.onsuccess = () => {
      resolve();
    };
  });
}
//# sourceMappingURL=StorageManager.js.map