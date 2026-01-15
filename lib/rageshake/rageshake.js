"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.IndexedDBLogStore = exports.ConsoleLogger = void 0;
exports.cleanup = cleanup;
exports.flush = flush;
exports.getLogsForReport = getLogsForReport;
exports.init = init;
exports.tryInitStorage = tryInitStorage;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _logger = require("matrix-js-sdk/src/logger");
var _randomstring = require("matrix-js-sdk/src/randomstring");
var _JSON = require("../utils/JSON");
/*
Copyright 2017 OpenMarket Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

// This module contains all the code needed to log the console, persist it to
// disk and submit bug reports. Rationale is as follows:
//  - Monkey-patching the console is preferable to having a log library because
//    we can catch logs by other libraries more easily, without having to all
//    depend on the same log framework / pass the logger around.
//  - We use IndexedDB to persists logs because it has generous disk space
//    limits compared to local storage. IndexedDB does not work in incognito
//    mode, in which case this module will not be able to write logs to disk.
//    However, the logs will still be stored in-memory, so can still be
//    submitted in a bug report should the user wish to: we can also store more
//    logs in-memory than in local storage, which does work in incognito mode.
//    We also need to handle the case where there are 2+ tabs. Each JS runtime
//    generates a random string which serves as the "ID" for that tab/session.
//    These IDs are stored along with the log lines.
//  - Bug reports are sent as a POST over HTTPS: it purposefully does not use
//    Matrix as bug reports may be made when Matrix is not responsive (which may
//    be the cause of the bug). We send the most recent N MB of UTF-8 log data,
//    starting with the most recent, which we know because the "ID"s are
//    actually timestamps. We then purge the remaining logs. We also do this
//    purge on startup to prevent logs from accumulating.

// the frequency with which we flush to indexeddb

const FLUSH_RATE_MS = 30 * 1000;

// the length of log data we keep in indexeddb (and include in the reports)
const MAX_LOG_SIZE = 1024 * 1024 * 5; // 5 MB

// A class which monkey-patches the global console and stores log lines.
class ConsoleLogger {
  constructor() {
    (0, _defineProperty2.default)(this, "logs", "");
    (0, _defineProperty2.default)(this, "originalFunctions", {});
  }
  monkeyPatch(consoleObj) {
    var _this = this;
    // Monkey-patch console logging
    const consoleFunctionsToLevels = {
      log: "I",
      info: "I",
      warn: "W",
      error: "E"
    };
    Object.keys(consoleFunctionsToLevels).forEach(fnName => {
      const level = consoleFunctionsToLevels[fnName];
      const originalFn = consoleObj[fnName].bind(consoleObj);
      this.originalFunctions[fnName] = originalFn;
      consoleObj[fnName] = function () {
        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }
        _this.log(level, ...args);
        originalFn(...args);
      };
    });
  }
  bypassRageshake(fnName) {
    for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      args[_key2 - 1] = arguments[_key2];
    }
    this.originalFunctions[fnName]?.(...args);
  }
  log(level) {
    for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
      args[_key3 - 1] = arguments[_key3];
    }
    // We don't know what locale the user may be running so use ISO strings
    const ts = new Date().toISOString();

    // Convert objects and errors to helpful things
    args = args.map(arg => {
      if (arg instanceof DOMException) {
        return arg.message + ` (${arg.name} | ${arg.code})`;
      } else if (arg instanceof Error) {
        return arg.message + (arg.stack ? `\n${arg.stack}` : "");
      } else if (typeof arg === "object") {
        return JSON.stringify(arg, (0, _JSON.getCircularReplacer)());
      } else {
        return arg;
      }
    });

    // Some browsers support string formatting which we're not doing here
    // so the lines are a little more ugly but easy to implement / quick to
    // run.
    // Example line:
    // 2017-01-18T11:23:53.214Z W Failed to set badge count
    let line = `${ts} ${level} ${args.join(" ")}\n`;
    // Do some cleanup
    line = line.replace(/token=[a-zA-Z0-9-]+/gm, "token=xxxxx");
    // Using + really is the quickest way in JS
    // http://jsperf.com/concat-vs-plus-vs-join
    this.logs += line;
  }

  /**
   * Retrieve log lines to flush to disk.
   * @param {boolean} keepLogs True to not delete logs after flushing.
   * @return {string} \n delimited log lines to flush.
   */
  flush(keepLogs) {
    // The ConsoleLogger doesn't care how these end up on disk, it just
    // flushes them to the caller.
    if (keepLogs) {
      return this.logs;
    }
    const logsToFlush = this.logs;
    this.logs = "";
    return logsToFlush;
  }
}

// A class which stores log lines in an IndexedDB instance.
exports.ConsoleLogger = ConsoleLogger;
class IndexedDBLogStore {
  constructor(indexedDB, logger) {
    this.indexedDB = indexedDB;
    this.logger = logger;
    (0, _defineProperty2.default)(this, "id", void 0);
    (0, _defineProperty2.default)(this, "index", 0);
    (0, _defineProperty2.default)(this, "db", null);
    (0, _defineProperty2.default)(this, "flushPromise", null);
    (0, _defineProperty2.default)(this, "flushAgainPromise", null);
    this.id = "instance-" + (0, _randomstring.randomString)(16);
  }

  /**
   * @return {Promise} Resolves when the store is ready.
   */
  connect() {
    const req = this.indexedDB.open("logs");
    return new Promise((resolve, reject) => {
      req.onsuccess = () => {
        this.db = req.result;
        // Periodically flush logs to local storage / indexeddb
        window.setInterval(this.flush.bind(this), FLUSH_RATE_MS);
        resolve();
      };
      req.onerror = () => {
        const err = "Failed to open log database: " + req.error?.name;
        _logger.logger.error(err);
        reject(new Error(err));
      };

      // First time: Setup the object store
      req.onupgradeneeded = () => {
        const db = req.result;
        const logObjStore = db.createObjectStore("logs", {
          keyPath: ["id", "index"]
        });
        // Keys in the database look like: [ "instance-148938490", 0 ]
        // Later on we need to query everything based on an instance id.
        // In order to do this, we need to set up indexes "id".
        logObjStore.createIndex("id", "id", {
          unique: false
        });
        logObjStore.add(this.generateLogEntry(new Date() + " ::: Log database was created."));
        const lastModifiedStore = db.createObjectStore("logslastmod", {
          keyPath: "id"
        });
        lastModifiedStore.add(this.generateLastModifiedTime());
      };
    });
  }

  /**
   * Flush logs to disk.
   *
   * There are guards to protect against race conditions in order to ensure
   * that all previous flushes have completed before the most recent flush.
   * Consider without guards:
   *  - A calls flush() periodically.
   *  - B calls flush() and wants to send logs immediately afterwards.
   *  - If B doesn't wait for A's flush to complete, B will be missing the
   *    contents of A's flush.
   * To protect against this, we set 'flushPromise' when a flush is ongoing.
   * Subsequent calls to flush() during this period will chain another flush,
   * then keep returning that same chained flush.
   *
   * This guarantees that we will always eventually do a flush when flush() is
   * called.
   *
   * @return {Promise} Resolved when the logs have been flushed.
   */
  flush() {
    // check if a flush() operation is ongoing
    if (this.flushPromise) {
      if (this.flushAgainPromise) {
        // this is the 3rd+ time we've called flush() : return the same promise.
        return this.flushAgainPromise;
      }
      // queue up a flush to occur immediately after the pending one completes.
      this.flushAgainPromise = this.flushPromise.then(() => {
        return this.flush();
      }).then(() => {
        this.flushAgainPromise = null;
      });
      return this.flushAgainPromise;
    }
    // there is no flush promise or there was but it has finished, so do
    // a brand new one, destroying the chain which may have been built up.
    this.flushPromise = new Promise((resolve, reject) => {
      if (!this.db) {
        // not connected yet or user rejected access for us to r/w to the db.
        reject(new Error("No connected database"));
        return;
      }
      const lines = this.logger.flush();
      if (lines.length === 0) {
        resolve();
        return;
      }
      const txn = this.db.transaction(["logs", "logslastmod"], "readwrite");
      const objStore = txn.objectStore("logs");
      txn.oncomplete = event => {
        resolve();
      };
      txn.onerror = () => {
        _logger.logger.error("Failed to flush logs : ", txn.error);
        reject(new Error("Failed to write logs: " + txn.error?.message));
      };
      objStore.add(this.generateLogEntry(lines));
      const lastModStore = txn.objectStore("logslastmod");
      lastModStore.put(this.generateLastModifiedTime());
    }).then(() => {
      this.flushPromise = null;
    });
    return this.flushPromise;
  }

  /**
   * Consume the most recent logs and return them. Older logs which are not
   * returned are deleted at the same time, so this can be called at startup
   * to do house-keeping to keep the logs from growing too large.
   *
   * @return {Promise<Object[]>} Resolves to an array of objects. The array is
   * sorted in time (oldest first) based on when the log file was created (the
   * log ID). The objects have said log ID in an "id" field and "lines" which
   * is a big string with all the new-line delimited logs.
   */
  async consume() {
    const db = this.db;

    // Returns: a string representing the concatenated logs for this ID.
    // Stops adding log fragments when the size exceeds maxSize
    function fetchLogs(id, maxSize) {
      if (!db) return Promise.reject("DB unavailable");
      const objectStore = db.transaction("logs", "readonly").objectStore("logs");
      return new Promise((resolve, reject) => {
        const query = objectStore.index("id").openCursor(IDBKeyRange.only(id), "prev");
        let lines = "";
        query.onerror = () => {
          reject(new Error("Query failed: " + query.error?.message));
        };
        query.onsuccess = () => {
          const cursor = query.result;
          if (!cursor) {
            resolve(lines);
            return; // end of results
          }

          lines = cursor.value.lines + lines;
          if (lines.length >= maxSize) {
            resolve(lines);
          } else {
            cursor.continue();
          }
        };
      });
    }

    // Returns: A sorted array of log IDs. (newest first)
    function fetchLogIds() {
      if (!db) return Promise.reject("DB unavailable");

      // To gather all the log IDs, query for all records in logslastmod.
      const o = db.transaction("logslastmod", "readonly").objectStore("logslastmod");
      return selectQuery(o, undefined, cursor => {
        return {
          id: cursor.value.id,
          ts: cursor.value.ts
        };
      }).then(res => {
        // Sort IDs by timestamp (newest first)
        return res.sort((a, b) => {
          return b.ts - a.ts;
        }).map(a => a.id);
      });
    }
    function deleteLogs(id) {
      if (!db) return Promise.reject("DB unavailable");
      return new Promise((resolve, reject) => {
        const txn = db.transaction(["logs", "logslastmod"], "readwrite");
        const o = txn.objectStore("logs");
        // only load the key path, not the data which may be huge
        const query = o.index("id").openKeyCursor(IDBKeyRange.only(id));
        query.onsuccess = () => {
          const cursor = query.result;
          if (!cursor) {
            return;
          }
          o.delete(cursor.primaryKey);
          cursor.continue();
        };
        txn.oncomplete = () => {
          resolve();
        };
        txn.onerror = () => {
          reject(new Error("Failed to delete logs for " + `'${id}' : ${query.error?.message}`));
        };
        // delete last modified entries
        const lastModStore = txn.objectStore("logslastmod");
        lastModStore.delete(id);
      });
    }
    const allLogIds = await fetchLogIds();
    let removeLogIds = [];
    const logs = [];
    let size = 0;
    for (let i = 0; i < allLogIds.length; i++) {
      const lines = await fetchLogs(allLogIds[i], MAX_LOG_SIZE - size);

      // always add the log file: fetchLogs will truncate once the maxSize we give it is
      // exceeded, so we'll go over the max but only by one fragment's worth.
      logs.push({
        lines,
        id: allLogIds[i]
      });
      size += lines.length;

      // If fetchLogs truncated we'll now be at or over the size limit,
      // in which case we should stop and remove the rest of the log files.
      if (size >= MAX_LOG_SIZE) {
        // the remaining log IDs should be removed. If we go out of
        // bounds this is just []
        removeLogIds = allLogIds.slice(i + 1);
        break;
      }
    }
    if (removeLogIds.length > 0) {
      _logger.logger.log("Removing logs: ", removeLogIds);
      // Don't await this because it's non-fatal if we can't clean up
      // logs.
      Promise.all(removeLogIds.map(id => deleteLogs(id))).then(() => {
        _logger.logger.log(`Removed ${removeLogIds.length} old logs.`);
      }, err => {
        _logger.logger.error(err);
      });
    }
    return logs;
  }
  generateLogEntry(lines) {
    return {
      id: this.id,
      lines: lines,
      index: this.index++
    };
  }
  generateLastModifiedTime() {
    return {
      id: this.id,
      ts: Date.now()
    };
  }
}

/**
 * Helper method to collect results from a Cursor and promiseify it.
 * @param {ObjectStore|Index} store The store to perform openCursor on.
 * @param {IDBKeyRange=} keyRange Optional key range to apply on the cursor.
 * @param {Function} resultMapper A function which is repeatedly called with a
 * Cursor.
 * Return the data you want to keep.
 * @return {Promise<T[]>} Resolves to an array of whatever you returned from
 * resultMapper.
 */
exports.IndexedDBLogStore = IndexedDBLogStore;
function selectQuery(store, keyRange, resultMapper) {
  const query = store.openCursor(keyRange);
  return new Promise((resolve, reject) => {
    const results = [];
    query.onerror = () => {
      reject(new Error("Query failed: " + query.error?.message));
    };
    // collect results
    query.onsuccess = () => {
      const cursor = query.result;
      if (!cursor) {
        resolve(results);
        return; // end of results
      }

      results.push(resultMapper(cursor));
      cursor.continue();
    };
  });
}

/**
 * Configure rage shaking support for sending bug reports.
 * Modifies globals.
 * @param {boolean} setUpPersistence When true (default), the persistence will
 * be set up immediately for the logs.
 * @return {Promise} Resolves when set up.
 */
function init() {
  let setUpPersistence = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
  if (global.mx_rage_initPromise) {
    return global.mx_rage_initPromise;
  }
  global.mx_rage_logger = new ConsoleLogger();
  global.mx_rage_logger.monkeyPatch(window.console);
  if (setUpPersistence) {
    return tryInitStorage();
  }
  global.mx_rage_initPromise = Promise.resolve();
  return global.mx_rage_initPromise;
}

/**
 * Try to start up the rageshake storage for logs. If not possible (client unsupported)
 * then this no-ops.
 * @return {Promise} Resolves when complete.
 */
function tryInitStorage() {
  if (global.mx_rage_initStoragePromise) {
    return global.mx_rage_initStoragePromise;
  }
  _logger.logger.log("Configuring rageshake persistence...");

  // just *accessing* indexedDB throws an exception in firefox with
  // indexeddb disabled.
  let indexedDB;
  try {
    indexedDB = window.indexedDB;
  } catch (e) {}
  if (indexedDB) {
    global.mx_rage_store = new IndexedDBLogStore(indexedDB, global.mx_rage_logger);
    global.mx_rage_initStoragePromise = global.mx_rage_store.connect();
    return global.mx_rage_initStoragePromise;
  }
  global.mx_rage_initStoragePromise = Promise.resolve();
  return global.mx_rage_initStoragePromise;
}
function flush() {
  if (!global.mx_rage_store) {
    return;
  }
  global.mx_rage_store.flush();
}

/**
 * Clean up old logs.
 * @return {Promise} Resolves if cleaned logs.
 */
async function cleanup() {
  if (!global.mx_rage_store) {
    return;
  }
  await global.mx_rage_store.consume();
}

/**
 * Get a recent snapshot of the logs, ready for attaching to a bug report
 *
 * @return {Array<{lines: string, id, string}>}  list of log data
 */
async function getLogsForReport() {
  if (!global.mx_rage_logger) {
    throw new Error("No console logger, did you forget to call init()?");
  }
  // If in incognito mode, store is null, but we still want bug report
  // sending to work going off the in-memory console logs.
  if (global.mx_rage_store) {
    // flush most recent logs
    await global.mx_rage_store.flush();
    return global.mx_rage_store.consume();
  } else {
    return [{
      lines: global.mx_rage_logger.flush(true),
      id: "-"
    }];
  }
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfbG9nZ2VyIiwicmVxdWlyZSIsIl9yYW5kb21zdHJpbmciLCJfSlNPTiIsIkZMVVNIX1JBVEVfTVMiLCJNQVhfTE9HX1NJWkUiLCJDb25zb2xlTG9nZ2VyIiwiY29uc3RydWN0b3IiLCJfZGVmaW5lUHJvcGVydHkyIiwiZGVmYXVsdCIsIm1vbmtleVBhdGNoIiwiY29uc29sZU9iaiIsIl90aGlzIiwiY29uc29sZUZ1bmN0aW9uc1RvTGV2ZWxzIiwibG9nIiwiaW5mbyIsIndhcm4iLCJlcnJvciIsIk9iamVjdCIsImtleXMiLCJmb3JFYWNoIiwiZm5OYW1lIiwibGV2ZWwiLCJvcmlnaW5hbEZuIiwiYmluZCIsIm9yaWdpbmFsRnVuY3Rpb25zIiwiX2xlbiIsImFyZ3VtZW50cyIsImxlbmd0aCIsImFyZ3MiLCJBcnJheSIsIl9rZXkiLCJieXBhc3NSYWdlc2hha2UiLCJfbGVuMiIsIl9rZXkyIiwiX2xlbjMiLCJfa2V5MyIsInRzIiwiRGF0ZSIsInRvSVNPU3RyaW5nIiwibWFwIiwiYXJnIiwiRE9NRXhjZXB0aW9uIiwibWVzc2FnZSIsIm5hbWUiLCJjb2RlIiwiRXJyb3IiLCJzdGFjayIsIkpTT04iLCJzdHJpbmdpZnkiLCJnZXRDaXJjdWxhclJlcGxhY2VyIiwibGluZSIsImpvaW4iLCJyZXBsYWNlIiwibG9ncyIsImZsdXNoIiwia2VlcExvZ3MiLCJsb2dzVG9GbHVzaCIsImV4cG9ydHMiLCJJbmRleGVkREJMb2dTdG9yZSIsImluZGV4ZWREQiIsImxvZ2dlciIsImlkIiwicmFuZG9tU3RyaW5nIiwiY29ubmVjdCIsInJlcSIsIm9wZW4iLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsIm9uc3VjY2VzcyIsImRiIiwicmVzdWx0Iiwid2luZG93Iiwic2V0SW50ZXJ2YWwiLCJvbmVycm9yIiwiZXJyIiwib251cGdyYWRlbmVlZGVkIiwibG9nT2JqU3RvcmUiLCJjcmVhdGVPYmplY3RTdG9yZSIsImtleVBhdGgiLCJjcmVhdGVJbmRleCIsInVuaXF1ZSIsImFkZCIsImdlbmVyYXRlTG9nRW50cnkiLCJsYXN0TW9kaWZpZWRTdG9yZSIsImdlbmVyYXRlTGFzdE1vZGlmaWVkVGltZSIsImZsdXNoUHJvbWlzZSIsImZsdXNoQWdhaW5Qcm9taXNlIiwidGhlbiIsImxpbmVzIiwidHhuIiwidHJhbnNhY3Rpb24iLCJvYmpTdG9yZSIsIm9iamVjdFN0b3JlIiwib25jb21wbGV0ZSIsImV2ZW50IiwibGFzdE1vZFN0b3JlIiwicHV0IiwiY29uc3VtZSIsImZldGNoTG9ncyIsIm1heFNpemUiLCJxdWVyeSIsImluZGV4Iiwib3BlbkN1cnNvciIsIklEQktleVJhbmdlIiwib25seSIsImN1cnNvciIsInZhbHVlIiwiY29udGludWUiLCJmZXRjaExvZ0lkcyIsIm8iLCJzZWxlY3RRdWVyeSIsInVuZGVmaW5lZCIsInJlcyIsInNvcnQiLCJhIiwiYiIsImRlbGV0ZUxvZ3MiLCJvcGVuS2V5Q3Vyc29yIiwiZGVsZXRlIiwicHJpbWFyeUtleSIsImFsbExvZ0lkcyIsInJlbW92ZUxvZ0lkcyIsInNpemUiLCJpIiwicHVzaCIsInNsaWNlIiwiYWxsIiwibm93Iiwic3RvcmUiLCJrZXlSYW5nZSIsInJlc3VsdE1hcHBlciIsInJlc3VsdHMiLCJpbml0Iiwic2V0VXBQZXJzaXN0ZW5jZSIsImdsb2JhbCIsIm14X3JhZ2VfaW5pdFByb21pc2UiLCJteF9yYWdlX2xvZ2dlciIsImNvbnNvbGUiLCJ0cnlJbml0U3RvcmFnZSIsIm14X3JhZ2VfaW5pdFN0b3JhZ2VQcm9taXNlIiwiZSIsIm14X3JhZ2Vfc3RvcmUiLCJjbGVhbnVwIiwiZ2V0TG9nc0ZvclJlcG9ydCJdLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9yYWdlc2hha2UvcmFnZXNoYWtlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qXG5Db3B5cmlnaHQgMjAxNyBPcGVuTWFya2V0IEx0ZFxuQ29weXJpZ2h0IDIwMTggTmV3IFZlY3RvciBMdGRcbkNvcHlyaWdodCAyMDE5IFRoZSBNYXRyaXgub3JnIEZvdW5kYXRpb24gQy5JLkMuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuKi9cblxuLy8gVGhpcyBtb2R1bGUgY29udGFpbnMgYWxsIHRoZSBjb2RlIG5lZWRlZCB0byBsb2cgdGhlIGNvbnNvbGUsIHBlcnNpc3QgaXQgdG9cbi8vIGRpc2sgYW5kIHN1Ym1pdCBidWcgcmVwb3J0cy4gUmF0aW9uYWxlIGlzIGFzIGZvbGxvd3M6XG4vLyAgLSBNb25rZXktcGF0Y2hpbmcgdGhlIGNvbnNvbGUgaXMgcHJlZmVyYWJsZSB0byBoYXZpbmcgYSBsb2cgbGlicmFyeSBiZWNhdXNlXG4vLyAgICB3ZSBjYW4gY2F0Y2ggbG9ncyBieSBvdGhlciBsaWJyYXJpZXMgbW9yZSBlYXNpbHksIHdpdGhvdXQgaGF2aW5nIHRvIGFsbFxuLy8gICAgZGVwZW5kIG9uIHRoZSBzYW1lIGxvZyBmcmFtZXdvcmsgLyBwYXNzIHRoZSBsb2dnZXIgYXJvdW5kLlxuLy8gIC0gV2UgdXNlIEluZGV4ZWREQiB0byBwZXJzaXN0cyBsb2dzIGJlY2F1c2UgaXQgaGFzIGdlbmVyb3VzIGRpc2sgc3BhY2Vcbi8vICAgIGxpbWl0cyBjb21wYXJlZCB0byBsb2NhbCBzdG9yYWdlLiBJbmRleGVkREIgZG9lcyBub3Qgd29yayBpbiBpbmNvZ25pdG9cbi8vICAgIG1vZGUsIGluIHdoaWNoIGNhc2UgdGhpcyBtb2R1bGUgd2lsbCBub3QgYmUgYWJsZSB0byB3cml0ZSBsb2dzIHRvIGRpc2suXG4vLyAgICBIb3dldmVyLCB0aGUgbG9ncyB3aWxsIHN0aWxsIGJlIHN0b3JlZCBpbi1tZW1vcnksIHNvIGNhbiBzdGlsbCBiZVxuLy8gICAgc3VibWl0dGVkIGluIGEgYnVnIHJlcG9ydCBzaG91bGQgdGhlIHVzZXIgd2lzaCB0bzogd2UgY2FuIGFsc28gc3RvcmUgbW9yZVxuLy8gICAgbG9ncyBpbi1tZW1vcnkgdGhhbiBpbiBsb2NhbCBzdG9yYWdlLCB3aGljaCBkb2VzIHdvcmsgaW4gaW5jb2duaXRvIG1vZGUuXG4vLyAgICBXZSBhbHNvIG5lZWQgdG8gaGFuZGxlIHRoZSBjYXNlIHdoZXJlIHRoZXJlIGFyZSAyKyB0YWJzLiBFYWNoIEpTIHJ1bnRpbWVcbi8vICAgIGdlbmVyYXRlcyBhIHJhbmRvbSBzdHJpbmcgd2hpY2ggc2VydmVzIGFzIHRoZSBcIklEXCIgZm9yIHRoYXQgdGFiL3Nlc3Npb24uXG4vLyAgICBUaGVzZSBJRHMgYXJlIHN0b3JlZCBhbG9uZyB3aXRoIHRoZSBsb2cgbGluZXMuXG4vLyAgLSBCdWcgcmVwb3J0cyBhcmUgc2VudCBhcyBhIFBPU1Qgb3ZlciBIVFRQUzogaXQgcHVycG9zZWZ1bGx5IGRvZXMgbm90IHVzZVxuLy8gICAgTWF0cml4IGFzIGJ1ZyByZXBvcnRzIG1heSBiZSBtYWRlIHdoZW4gTWF0cml4IGlzIG5vdCByZXNwb25zaXZlICh3aGljaCBtYXlcbi8vICAgIGJlIHRoZSBjYXVzZSBvZiB0aGUgYnVnKS4gV2Ugc2VuZCB0aGUgbW9zdCByZWNlbnQgTiBNQiBvZiBVVEYtOCBsb2cgZGF0YSxcbi8vICAgIHN0YXJ0aW5nIHdpdGggdGhlIG1vc3QgcmVjZW50LCB3aGljaCB3ZSBrbm93IGJlY2F1c2UgdGhlIFwiSURcInMgYXJlXG4vLyAgICBhY3R1YWxseSB0aW1lc3RhbXBzLiBXZSB0aGVuIHB1cmdlIHRoZSByZW1haW5pbmcgbG9ncy4gV2UgYWxzbyBkbyB0aGlzXG4vLyAgICBwdXJnZSBvbiBzdGFydHVwIHRvIHByZXZlbnQgbG9ncyBmcm9tIGFjY3VtdWxhdGluZy5cblxuLy8gdGhlIGZyZXF1ZW5jeSB3aXRoIHdoaWNoIHdlIGZsdXNoIHRvIGluZGV4ZWRkYlxuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL2xvZ2dlclwiO1xuaW1wb3J0IHsgcmFuZG9tU3RyaW5nIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL3JhbmRvbXN0cmluZ1wiO1xuXG5pbXBvcnQgeyBnZXRDaXJjdWxhclJlcGxhY2VyIH0gZnJvbSBcIi4uL3V0aWxzL0pTT05cIjtcblxuY29uc3QgRkxVU0hfUkFURV9NUyA9IDMwICogMTAwMDtcblxuLy8gdGhlIGxlbmd0aCBvZiBsb2cgZGF0YSB3ZSBrZWVwIGluIGluZGV4ZWRkYiAoYW5kIGluY2x1ZGUgaW4gdGhlIHJlcG9ydHMpXG5jb25zdCBNQVhfTE9HX1NJWkUgPSAxMDI0ICogMTAyNCAqIDU7IC8vIDUgTUJcblxudHlwZSBMb2dGdW5jdGlvbiA9ICguLi5hcmdzOiAoRXJyb3IgfCBET01FeGNlcHRpb24gfCBvYmplY3QgfCBzdHJpbmcpW10pID0+IHZvaWQ7XG50eXBlIExvZ0Z1bmN0aW9uTmFtZSA9IFwibG9nXCIgfCBcImluZm9cIiB8IFwid2FyblwiIHwgXCJlcnJvclwiO1xuXG4vLyBBIGNsYXNzIHdoaWNoIG1vbmtleS1wYXRjaGVzIHRoZSBnbG9iYWwgY29uc29sZSBhbmQgc3RvcmVzIGxvZyBsaW5lcy5cbmV4cG9ydCBjbGFzcyBDb25zb2xlTG9nZ2VyIHtcbiAgICBwcml2YXRlIGxvZ3MgPSBcIlwiO1xuICAgIHByaXZhdGUgb3JpZ2luYWxGdW5jdGlvbnM6IHsgW2tleSBpbiBMb2dGdW5jdGlvbk5hbWVdPzogTG9nRnVuY3Rpb24gfSA9IHt9O1xuXG4gICAgcHVibGljIG1vbmtleVBhdGNoKGNvbnNvbGVPYmo6IENvbnNvbGUpOiB2b2lkIHtcbiAgICAgICAgLy8gTW9ua2V5LXBhdGNoIGNvbnNvbGUgbG9nZ2luZ1xuICAgICAgICBjb25zdCBjb25zb2xlRnVuY3Rpb25zVG9MZXZlbHMgPSB7XG4gICAgICAgICAgICBsb2c6IFwiSVwiLFxuICAgICAgICAgICAgaW5mbzogXCJJXCIsXG4gICAgICAgICAgICB3YXJuOiBcIldcIixcbiAgICAgICAgICAgIGVycm9yOiBcIkVcIixcbiAgICAgICAgfSBhcyBjb25zdDtcbiAgICAgICAgKE9iamVjdC5rZXlzKGNvbnNvbGVGdW5jdGlvbnNUb0xldmVscykgYXMgW2tleW9mIHR5cGVvZiBjb25zb2xlRnVuY3Rpb25zVG9MZXZlbHNdKS5mb3JFYWNoKFxuICAgICAgICAgICAgKGZuTmFtZToga2V5b2YgdHlwZW9mIGNvbnNvbGVGdW5jdGlvbnNUb0xldmVscykgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxldmVsID0gY29uc29sZUZ1bmN0aW9uc1RvTGV2ZWxzW2ZuTmFtZV07XG4gICAgICAgICAgICAgICAgY29uc3Qgb3JpZ2luYWxGbiA9IGNvbnNvbGVPYmpbZm5OYW1lXS5iaW5kKGNvbnNvbGVPYmopO1xuICAgICAgICAgICAgICAgIHRoaXMub3JpZ2luYWxGdW5jdGlvbnNbZm5OYW1lXSA9IG9yaWdpbmFsRm47XG4gICAgICAgICAgICAgICAgY29uc29sZU9ialtmbk5hbWVdID0gKC4uLmFyZ3MpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5sb2cobGV2ZWwsIC4uLmFyZ3MpO1xuICAgICAgICAgICAgICAgICAgICBvcmlnaW5hbEZuKC4uLmFyZ3MpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9LFxuICAgICAgICApO1xuICAgIH1cblxuICAgIHB1YmxpYyBieXBhc3NSYWdlc2hha2UoZm5OYW1lOiBMb2dGdW5jdGlvbk5hbWUsIC4uLmFyZ3M6IChFcnJvciB8IERPTUV4Y2VwdGlvbiB8IG9iamVjdCB8IHN0cmluZylbXSk6IHZvaWQge1xuICAgICAgICB0aGlzLm9yaWdpbmFsRnVuY3Rpb25zW2ZuTmFtZV0/LiguLi5hcmdzKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgbG9nKGxldmVsOiBzdHJpbmcsIC4uLmFyZ3M6IChFcnJvciB8IERPTUV4Y2VwdGlvbiB8IG9iamVjdCB8IHN0cmluZylbXSk6IHZvaWQge1xuICAgICAgICAvLyBXZSBkb24ndCBrbm93IHdoYXQgbG9jYWxlIHRoZSB1c2VyIG1heSBiZSBydW5uaW5nIHNvIHVzZSBJU08gc3RyaW5nc1xuICAgICAgICBjb25zdCB0cyA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcblxuICAgICAgICAvLyBDb252ZXJ0IG9iamVjdHMgYW5kIGVycm9ycyB0byBoZWxwZnVsIHRoaW5nc1xuICAgICAgICBhcmdzID0gYXJncy5tYXAoKGFyZykgPT4ge1xuICAgICAgICAgICAgaWYgKGFyZyBpbnN0YW5jZW9mIERPTUV4Y2VwdGlvbikge1xuICAgICAgICAgICAgICAgIHJldHVybiBhcmcubWVzc2FnZSArIGAgKCR7YXJnLm5hbWV9IHwgJHthcmcuY29kZX0pYDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYXJnIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXJnLm1lc3NhZ2UgKyAoYXJnLnN0YWNrID8gYFxcbiR7YXJnLnN0YWNrfWAgOiBcIlwiKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGFyZyA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShhcmcsIGdldENpcmN1bGFyUmVwbGFjZXIoKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBhcmc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFNvbWUgYnJvd3NlcnMgc3VwcG9ydCBzdHJpbmcgZm9ybWF0dGluZyB3aGljaCB3ZSdyZSBub3QgZG9pbmcgaGVyZVxuICAgICAgICAvLyBzbyB0aGUgbGluZXMgYXJlIGEgbGl0dGxlIG1vcmUgdWdseSBidXQgZWFzeSB0byBpbXBsZW1lbnQgLyBxdWljayB0b1xuICAgICAgICAvLyBydW4uXG4gICAgICAgIC8vIEV4YW1wbGUgbGluZTpcbiAgICAgICAgLy8gMjAxNy0wMS0xOFQxMToyMzo1My4yMTRaIFcgRmFpbGVkIHRvIHNldCBiYWRnZSBjb3VudFxuICAgICAgICBsZXQgbGluZSA9IGAke3RzfSAke2xldmVsfSAke2FyZ3Muam9pbihcIiBcIil9XFxuYDtcbiAgICAgICAgLy8gRG8gc29tZSBjbGVhbnVwXG4gICAgICAgIGxpbmUgPSBsaW5lLnJlcGxhY2UoL3Rva2VuPVthLXpBLVowLTktXSsvZ20sIFwidG9rZW49eHh4eHhcIik7XG4gICAgICAgIC8vIFVzaW5nICsgcmVhbGx5IGlzIHRoZSBxdWlja2VzdCB3YXkgaW4gSlNcbiAgICAgICAgLy8gaHR0cDovL2pzcGVyZi5jb20vY29uY2F0LXZzLXBsdXMtdnMtam9pblxuICAgICAgICB0aGlzLmxvZ3MgKz0gbGluZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZSBsb2cgbGluZXMgdG8gZmx1c2ggdG8gZGlzay5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGtlZXBMb2dzIFRydWUgdG8gbm90IGRlbGV0ZSBsb2dzIGFmdGVyIGZsdXNoaW5nLlxuICAgICAqIEByZXR1cm4ge3N0cmluZ30gXFxuIGRlbGltaXRlZCBsb2cgbGluZXMgdG8gZmx1c2guXG4gICAgICovXG4gICAgcHVibGljIGZsdXNoKGtlZXBMb2dzPzogYm9vbGVhbik6IHN0cmluZyB7XG4gICAgICAgIC8vIFRoZSBDb25zb2xlTG9nZ2VyIGRvZXNuJ3QgY2FyZSBob3cgdGhlc2UgZW5kIHVwIG9uIGRpc2ssIGl0IGp1c3RcbiAgICAgICAgLy8gZmx1c2hlcyB0aGVtIHRvIHRoZSBjYWxsZXIuXG4gICAgICAgIGlmIChrZWVwTG9ncykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubG9ncztcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBsb2dzVG9GbHVzaCA9IHRoaXMubG9ncztcbiAgICAgICAgdGhpcy5sb2dzID0gXCJcIjtcbiAgICAgICAgcmV0dXJuIGxvZ3NUb0ZsdXNoO1xuICAgIH1cbn1cblxuLy8gQSBjbGFzcyB3aGljaCBzdG9yZXMgbG9nIGxpbmVzIGluIGFuIEluZGV4ZWREQiBpbnN0YW5jZS5cbmV4cG9ydCBjbGFzcyBJbmRleGVkREJMb2dTdG9yZSB7XG4gICAgcHJpdmF0ZSBpZDogc3RyaW5nO1xuICAgIHByaXZhdGUgaW5kZXggPSAwO1xuICAgIHByaXZhdGUgZGI6IElEQkRhdGFiYXNlIHwgbnVsbCA9IG51bGw7XG4gICAgcHJpdmF0ZSBmbHVzaFByb21pc2U6IFByb21pc2U8dm9pZD4gfCBudWxsID0gbnVsbDtcbiAgICBwcml2YXRlIGZsdXNoQWdhaW5Qcm9taXNlOiBQcm9taXNlPHZvaWQ+IHwgbnVsbCA9IG51bGw7XG5cbiAgICBwdWJsaWMgY29uc3RydWN0b3IocHJpdmF0ZSBpbmRleGVkREI6IElEQkZhY3RvcnksIHByaXZhdGUgbG9nZ2VyOiBDb25zb2xlTG9nZ2VyKSB7XG4gICAgICAgIHRoaXMuaWQgPSBcImluc3RhbmNlLVwiICsgcmFuZG9tU3RyaW5nKDE2KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSBSZXNvbHZlcyB3aGVuIHRoZSBzdG9yZSBpcyByZWFkeS5cbiAgICAgKi9cbiAgICBwdWJsaWMgY29ubmVjdCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgY29uc3QgcmVxID0gdGhpcy5pbmRleGVkREIub3BlbihcImxvZ3NcIik7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICByZXEub25zdWNjZXNzID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuZGIgPSByZXEucmVzdWx0O1xuICAgICAgICAgICAgICAgIC8vIFBlcmlvZGljYWxseSBmbHVzaCBsb2dzIHRvIGxvY2FsIHN0b3JhZ2UgLyBpbmRleGVkZGJcbiAgICAgICAgICAgICAgICB3aW5kb3cuc2V0SW50ZXJ2YWwodGhpcy5mbHVzaC5iaW5kKHRoaXMpLCBGTFVTSF9SQVRFX01TKTtcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICByZXEub25lcnJvciA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBlcnIgPSBcIkZhaWxlZCB0byBvcGVuIGxvZyBkYXRhYmFzZTogXCIgKyByZXEuZXJyb3I/Lm5hbWU7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmVycm9yKGVycik7XG4gICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihlcnIpKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIEZpcnN0IHRpbWU6IFNldHVwIHRoZSBvYmplY3Qgc3RvcmVcbiAgICAgICAgICAgIHJlcS5vbnVwZ3JhZGVuZWVkZWQgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGIgPSByZXEucmVzdWx0O1xuICAgICAgICAgICAgICAgIGNvbnN0IGxvZ09ialN0b3JlID0gZGIuY3JlYXRlT2JqZWN0U3RvcmUoXCJsb2dzXCIsIHtcbiAgICAgICAgICAgICAgICAgICAga2V5UGF0aDogW1wiaWRcIiwgXCJpbmRleFwiXSxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAvLyBLZXlzIGluIHRoZSBkYXRhYmFzZSBsb29rIGxpa2U6IFsgXCJpbnN0YW5jZS0xNDg5Mzg0OTBcIiwgMCBdXG4gICAgICAgICAgICAgICAgLy8gTGF0ZXIgb24gd2UgbmVlZCB0byBxdWVyeSBldmVyeXRoaW5nIGJhc2VkIG9uIGFuIGluc3RhbmNlIGlkLlxuICAgICAgICAgICAgICAgIC8vIEluIG9yZGVyIHRvIGRvIHRoaXMsIHdlIG5lZWQgdG8gc2V0IHVwIGluZGV4ZXMgXCJpZFwiLlxuICAgICAgICAgICAgICAgIGxvZ09ialN0b3JlLmNyZWF0ZUluZGV4KFwiaWRcIiwgXCJpZFwiLCB7IHVuaXF1ZTogZmFsc2UgfSk7XG5cbiAgICAgICAgICAgICAgICBsb2dPYmpTdG9yZS5hZGQodGhpcy5nZW5lcmF0ZUxvZ0VudHJ5KG5ldyBEYXRlKCkgKyBcIiA6OjogTG9nIGRhdGFiYXNlIHdhcyBjcmVhdGVkLlwiKSk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBsYXN0TW9kaWZpZWRTdG9yZSA9IGRiLmNyZWF0ZU9iamVjdFN0b3JlKFwibG9nc2xhc3Rtb2RcIiwge1xuICAgICAgICAgICAgICAgICAgICBrZXlQYXRoOiBcImlkXCIsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgbGFzdE1vZGlmaWVkU3RvcmUuYWRkKHRoaXMuZ2VuZXJhdGVMYXN0TW9kaWZpZWRUaW1lKCkpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmx1c2ggbG9ncyB0byBkaXNrLlxuICAgICAqXG4gICAgICogVGhlcmUgYXJlIGd1YXJkcyB0byBwcm90ZWN0IGFnYWluc3QgcmFjZSBjb25kaXRpb25zIGluIG9yZGVyIHRvIGVuc3VyZVxuICAgICAqIHRoYXQgYWxsIHByZXZpb3VzIGZsdXNoZXMgaGF2ZSBjb21wbGV0ZWQgYmVmb3JlIHRoZSBtb3N0IHJlY2VudCBmbHVzaC5cbiAgICAgKiBDb25zaWRlciB3aXRob3V0IGd1YXJkczpcbiAgICAgKiAgLSBBIGNhbGxzIGZsdXNoKCkgcGVyaW9kaWNhbGx5LlxuICAgICAqICAtIEIgY2FsbHMgZmx1c2goKSBhbmQgd2FudHMgdG8gc2VuZCBsb2dzIGltbWVkaWF0ZWx5IGFmdGVyd2FyZHMuXG4gICAgICogIC0gSWYgQiBkb2Vzbid0IHdhaXQgZm9yIEEncyBmbHVzaCB0byBjb21wbGV0ZSwgQiB3aWxsIGJlIG1pc3NpbmcgdGhlXG4gICAgICogICAgY29udGVudHMgb2YgQSdzIGZsdXNoLlxuICAgICAqIFRvIHByb3RlY3QgYWdhaW5zdCB0aGlzLCB3ZSBzZXQgJ2ZsdXNoUHJvbWlzZScgd2hlbiBhIGZsdXNoIGlzIG9uZ29pbmcuXG4gICAgICogU3Vic2VxdWVudCBjYWxscyB0byBmbHVzaCgpIGR1cmluZyB0aGlzIHBlcmlvZCB3aWxsIGNoYWluIGFub3RoZXIgZmx1c2gsXG4gICAgICogdGhlbiBrZWVwIHJldHVybmluZyB0aGF0IHNhbWUgY2hhaW5lZCBmbHVzaC5cbiAgICAgKlxuICAgICAqIFRoaXMgZ3VhcmFudGVlcyB0aGF0IHdlIHdpbGwgYWx3YXlzIGV2ZW50dWFsbHkgZG8gYSBmbHVzaCB3aGVuIGZsdXNoKCkgaXNcbiAgICAgKiBjYWxsZWQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSBSZXNvbHZlZCB3aGVuIHRoZSBsb2dzIGhhdmUgYmVlbiBmbHVzaGVkLlxuICAgICAqL1xuICAgIHB1YmxpYyBmbHVzaCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgLy8gY2hlY2sgaWYgYSBmbHVzaCgpIG9wZXJhdGlvbiBpcyBvbmdvaW5nXG4gICAgICAgIGlmICh0aGlzLmZsdXNoUHJvbWlzZSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuZmx1c2hBZ2FpblByb21pc2UpIHtcbiAgICAgICAgICAgICAgICAvLyB0aGlzIGlzIHRoZSAzcmQrIHRpbWUgd2UndmUgY2FsbGVkIGZsdXNoKCkgOiByZXR1cm4gdGhlIHNhbWUgcHJvbWlzZS5cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5mbHVzaEFnYWluUHJvbWlzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHF1ZXVlIHVwIGEgZmx1c2ggdG8gb2NjdXIgaW1tZWRpYXRlbHkgYWZ0ZXIgdGhlIHBlbmRpbmcgb25lIGNvbXBsZXRlcy5cbiAgICAgICAgICAgIHRoaXMuZmx1c2hBZ2FpblByb21pc2UgPSB0aGlzLmZsdXNoUHJvbWlzZVxuICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZmx1c2goKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5mbHVzaEFnYWluUHJvbWlzZSA9IG51bGw7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5mbHVzaEFnYWluUHJvbWlzZTtcbiAgICAgICAgfVxuICAgICAgICAvLyB0aGVyZSBpcyBubyBmbHVzaCBwcm9taXNlIG9yIHRoZXJlIHdhcyBidXQgaXQgaGFzIGZpbmlzaGVkLCBzbyBkb1xuICAgICAgICAvLyBhIGJyYW5kIG5ldyBvbmUsIGRlc3Ryb3lpbmcgdGhlIGNoYWluIHdoaWNoIG1heSBoYXZlIGJlZW4gYnVpbHQgdXAuXG4gICAgICAgIHRoaXMuZmx1c2hQcm9taXNlID0gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmRiKSB7XG4gICAgICAgICAgICAgICAgLy8gbm90IGNvbm5lY3RlZCB5ZXQgb3IgdXNlciByZWplY3RlZCBhY2Nlc3MgZm9yIHVzIHRvIHIvdyB0byB0aGUgZGIuXG4gICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihcIk5vIGNvbm5lY3RlZCBkYXRhYmFzZVwiKSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgbGluZXMgPSB0aGlzLmxvZ2dlci5mbHVzaCgpO1xuICAgICAgICAgICAgaWYgKGxpbmVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCB0eG4gPSB0aGlzLmRiLnRyYW5zYWN0aW9uKFtcImxvZ3NcIiwgXCJsb2dzbGFzdG1vZFwiXSwgXCJyZWFkd3JpdGVcIik7XG4gICAgICAgICAgICBjb25zdCBvYmpTdG9yZSA9IHR4bi5vYmplY3RTdG9yZShcImxvZ3NcIik7XG4gICAgICAgICAgICB0eG4ub25jb21wbGV0ZSA9IChldmVudCkgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0eG4ub25lcnJvciA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBsb2dnZXIuZXJyb3IoXCJGYWlsZWQgdG8gZmx1c2ggbG9ncyA6IFwiLCB0eG4uZXJyb3IpO1xuICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoXCJGYWlsZWQgdG8gd3JpdGUgbG9nczogXCIgKyB0eG4uZXJyb3I/Lm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBvYmpTdG9yZS5hZGQodGhpcy5nZW5lcmF0ZUxvZ0VudHJ5KGxpbmVzKSk7XG4gICAgICAgICAgICBjb25zdCBsYXN0TW9kU3RvcmUgPSB0eG4ub2JqZWN0U3RvcmUoXCJsb2dzbGFzdG1vZFwiKTtcbiAgICAgICAgICAgIGxhc3RNb2RTdG9yZS5wdXQodGhpcy5nZW5lcmF0ZUxhc3RNb2RpZmllZFRpbWUoKSk7XG4gICAgICAgIH0pLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5mbHVzaFByb21pc2UgPSBudWxsO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmx1c2hQcm9taXNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnN1bWUgdGhlIG1vc3QgcmVjZW50IGxvZ3MgYW5kIHJldHVybiB0aGVtLiBPbGRlciBsb2dzIHdoaWNoIGFyZSBub3RcbiAgICAgKiByZXR1cm5lZCBhcmUgZGVsZXRlZCBhdCB0aGUgc2FtZSB0aW1lLCBzbyB0aGlzIGNhbiBiZSBjYWxsZWQgYXQgc3RhcnR1cFxuICAgICAqIHRvIGRvIGhvdXNlLWtlZXBpbmcgdG8ga2VlcCB0aGUgbG9ncyBmcm9tIGdyb3dpbmcgdG9vIGxhcmdlLlxuICAgICAqXG4gICAgICogQHJldHVybiB7UHJvbWlzZTxPYmplY3RbXT59IFJlc29sdmVzIHRvIGFuIGFycmF5IG9mIG9iamVjdHMuIFRoZSBhcnJheSBpc1xuICAgICAqIHNvcnRlZCBpbiB0aW1lIChvbGRlc3QgZmlyc3QpIGJhc2VkIG9uIHdoZW4gdGhlIGxvZyBmaWxlIHdhcyBjcmVhdGVkICh0aGVcbiAgICAgKiBsb2cgSUQpLiBUaGUgb2JqZWN0cyBoYXZlIHNhaWQgbG9nIElEIGluIGFuIFwiaWRcIiBmaWVsZCBhbmQgXCJsaW5lc1wiIHdoaWNoXG4gICAgICogaXMgYSBiaWcgc3RyaW5nIHdpdGggYWxsIHRoZSBuZXctbGluZSBkZWxpbWl0ZWQgbG9ncy5cbiAgICAgKi9cbiAgICBwdWJsaWMgYXN5bmMgY29uc3VtZSgpOiBQcm9taXNlPHsgbGluZXM6IHN0cmluZzsgaWQ6IHN0cmluZyB9W10+IHtcbiAgICAgICAgY29uc3QgZGIgPSB0aGlzLmRiO1xuXG4gICAgICAgIC8vIFJldHVybnM6IGEgc3RyaW5nIHJlcHJlc2VudGluZyB0aGUgY29uY2F0ZW5hdGVkIGxvZ3MgZm9yIHRoaXMgSUQuXG4gICAgICAgIC8vIFN0b3BzIGFkZGluZyBsb2cgZnJhZ21lbnRzIHdoZW4gdGhlIHNpemUgZXhjZWVkcyBtYXhTaXplXG4gICAgICAgIGZ1bmN0aW9uIGZldGNoTG9ncyhpZDogc3RyaW5nLCBtYXhTaXplOiBudW1iZXIpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgICAgICAgICAgaWYgKCFkYikgcmV0dXJuIFByb21pc2UucmVqZWN0KFwiREIgdW5hdmFpbGFibGVcIik7XG5cbiAgICAgICAgICAgIGNvbnN0IG9iamVjdFN0b3JlID0gZGIudHJhbnNhY3Rpb24oXCJsb2dzXCIsIFwicmVhZG9ubHlcIikub2JqZWN0U3RvcmUoXCJsb2dzXCIpO1xuXG4gICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHF1ZXJ5ID0gb2JqZWN0U3RvcmUuaW5kZXgoXCJpZFwiKS5vcGVuQ3Vyc29yKElEQktleVJhbmdlLm9ubHkoaWQpLCBcInByZXZcIik7XG4gICAgICAgICAgICAgICAgbGV0IGxpbmVzID0gXCJcIjtcbiAgICAgICAgICAgICAgICBxdWVyeS5vbmVycm9yID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKFwiUXVlcnkgZmFpbGVkOiBcIiArIHF1ZXJ5LmVycm9yPy5tZXNzYWdlKSk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBxdWVyeS5vbnN1Y2Nlc3MgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGN1cnNvciA9IHF1ZXJ5LnJlc3VsdDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFjdXJzb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUobGluZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuOyAvLyBlbmQgb2YgcmVzdWx0c1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGxpbmVzID0gY3Vyc29yLnZhbHVlLmxpbmVzICsgbGluZXM7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsaW5lcy5sZW5ndGggPj0gbWF4U2l6ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShsaW5lcyk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjdXJzb3IuY29udGludWUoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJldHVybnM6IEEgc29ydGVkIGFycmF5IG9mIGxvZyBJRHMuIChuZXdlc3QgZmlyc3QpXG4gICAgICAgIGZ1bmN0aW9uIGZldGNoTG9nSWRzKCk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgICAgICAgICAgIGlmICghZGIpIHJldHVybiBQcm9taXNlLnJlamVjdChcIkRCIHVuYXZhaWxhYmxlXCIpO1xuXG4gICAgICAgICAgICAvLyBUbyBnYXRoZXIgYWxsIHRoZSBsb2cgSURzLCBxdWVyeSBmb3IgYWxsIHJlY29yZHMgaW4gbG9nc2xhc3Rtb2QuXG4gICAgICAgICAgICBjb25zdCBvID0gZGIudHJhbnNhY3Rpb24oXCJsb2dzbGFzdG1vZFwiLCBcInJlYWRvbmx5XCIpLm9iamVjdFN0b3JlKFwibG9nc2xhc3Rtb2RcIik7XG4gICAgICAgICAgICByZXR1cm4gc2VsZWN0UXVlcnkobywgdW5kZWZpbmVkLCAoY3Vyc29yKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgaWQ6IGN1cnNvci52YWx1ZS5pZCxcbiAgICAgICAgICAgICAgICAgICAgdHM6IGN1cnNvci52YWx1ZS50cyxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSkudGhlbigocmVzKSA9PiB7XG4gICAgICAgICAgICAgICAgLy8gU29ydCBJRHMgYnkgdGltZXN0YW1wIChuZXdlc3QgZmlyc3QpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc1xuICAgICAgICAgICAgICAgICAgICAuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGIudHMgLSBhLnRzO1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAubWFwKChhKSA9PiBhLmlkKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZGVsZXRlTG9ncyhpZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgICAgICBpZiAoIWRiKSByZXR1cm4gUHJvbWlzZS5yZWplY3QoXCJEQiB1bmF2YWlsYWJsZVwiKTtcblxuICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB0eG4gPSBkYi50cmFuc2FjdGlvbihbXCJsb2dzXCIsIFwibG9nc2xhc3Rtb2RcIl0sIFwicmVhZHdyaXRlXCIpO1xuICAgICAgICAgICAgICAgIGNvbnN0IG8gPSB0eG4ub2JqZWN0U3RvcmUoXCJsb2dzXCIpO1xuICAgICAgICAgICAgICAgIC8vIG9ubHkgbG9hZCB0aGUga2V5IHBhdGgsIG5vdCB0aGUgZGF0YSB3aGljaCBtYXkgYmUgaHVnZVxuICAgICAgICAgICAgICAgIGNvbnN0IHF1ZXJ5ID0gby5pbmRleChcImlkXCIpLm9wZW5LZXlDdXJzb3IoSURCS2V5UmFuZ2Uub25seShpZCkpO1xuICAgICAgICAgICAgICAgIHF1ZXJ5Lm9uc3VjY2VzcyA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY3Vyc29yID0gcXVlcnkucmVzdWx0O1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWN1cnNvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIG8uZGVsZXRlKGN1cnNvci5wcmltYXJ5S2V5KTtcbiAgICAgICAgICAgICAgICAgICAgY3Vyc29yLmNvbnRpbnVlKCk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB0eG4ub25jb21wbGV0ZSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgdHhuLm9uZXJyb3IgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoXCJGYWlsZWQgdG8gZGVsZXRlIGxvZ3MgZm9yIFwiICsgYCcke2lkfScgOiAke3F1ZXJ5LmVycm9yPy5tZXNzYWdlfWApKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIC8vIGRlbGV0ZSBsYXN0IG1vZGlmaWVkIGVudHJpZXNcbiAgICAgICAgICAgICAgICBjb25zdCBsYXN0TW9kU3RvcmUgPSB0eG4ub2JqZWN0U3RvcmUoXCJsb2dzbGFzdG1vZFwiKTtcbiAgICAgICAgICAgICAgICBsYXN0TW9kU3RvcmUuZGVsZXRlKGlkKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYWxsTG9nSWRzID0gYXdhaXQgZmV0Y2hMb2dJZHMoKTtcbiAgICAgICAgbGV0IHJlbW92ZUxvZ0lkczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgY29uc3QgbG9nczoge1xuICAgICAgICAgICAgbGluZXM6IHN0cmluZztcbiAgICAgICAgICAgIGlkOiBzdHJpbmc7XG4gICAgICAgIH1bXSA9IFtdO1xuICAgICAgICBsZXQgc2l6ZSA9IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWxsTG9nSWRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsaW5lcyA9IGF3YWl0IGZldGNoTG9ncyhhbGxMb2dJZHNbaV0sIE1BWF9MT0dfU0laRSAtIHNpemUpO1xuXG4gICAgICAgICAgICAvLyBhbHdheXMgYWRkIHRoZSBsb2cgZmlsZTogZmV0Y2hMb2dzIHdpbGwgdHJ1bmNhdGUgb25jZSB0aGUgbWF4U2l6ZSB3ZSBnaXZlIGl0IGlzXG4gICAgICAgICAgICAvLyBleGNlZWRlZCwgc28gd2UnbGwgZ28gb3ZlciB0aGUgbWF4IGJ1dCBvbmx5IGJ5IG9uZSBmcmFnbWVudCdzIHdvcnRoLlxuICAgICAgICAgICAgbG9ncy5wdXNoKHtcbiAgICAgICAgICAgICAgICBsaW5lcyxcbiAgICAgICAgICAgICAgICBpZDogYWxsTG9nSWRzW2ldLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBzaXplICs9IGxpbmVzLmxlbmd0aDtcblxuICAgICAgICAgICAgLy8gSWYgZmV0Y2hMb2dzIHRydW5jYXRlZCB3ZSdsbCBub3cgYmUgYXQgb3Igb3ZlciB0aGUgc2l6ZSBsaW1pdCxcbiAgICAgICAgICAgIC8vIGluIHdoaWNoIGNhc2Ugd2Ugc2hvdWxkIHN0b3AgYW5kIHJlbW92ZSB0aGUgcmVzdCBvZiB0aGUgbG9nIGZpbGVzLlxuICAgICAgICAgICAgaWYgKHNpemUgPj0gTUFYX0xPR19TSVpFKSB7XG4gICAgICAgICAgICAgICAgLy8gdGhlIHJlbWFpbmluZyBsb2cgSURzIHNob3VsZCBiZSByZW1vdmVkLiBJZiB3ZSBnbyBvdXQgb2ZcbiAgICAgICAgICAgICAgICAvLyBib3VuZHMgdGhpcyBpcyBqdXN0IFtdXG4gICAgICAgICAgICAgICAgcmVtb3ZlTG9nSWRzID0gYWxsTG9nSWRzLnNsaWNlKGkgKyAxKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAocmVtb3ZlTG9nSWRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGxvZ2dlci5sb2coXCJSZW1vdmluZyBsb2dzOiBcIiwgcmVtb3ZlTG9nSWRzKTtcbiAgICAgICAgICAgIC8vIERvbid0IGF3YWl0IHRoaXMgYmVjYXVzZSBpdCdzIG5vbi1mYXRhbCBpZiB3ZSBjYW4ndCBjbGVhbiB1cFxuICAgICAgICAgICAgLy8gbG9ncy5cbiAgICAgICAgICAgIFByb21pc2UuYWxsKHJlbW92ZUxvZ0lkcy5tYXAoKGlkKSA9PiBkZWxldGVMb2dzKGlkKSkpLnRoZW4oXG4gICAgICAgICAgICAgICAgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBsb2dnZXIubG9nKGBSZW1vdmVkICR7cmVtb3ZlTG9nSWRzLmxlbmd0aH0gb2xkIGxvZ3MuYCk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAoZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGxvZ2dlci5lcnJvcihlcnIpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBsb2dzO1xuICAgIH1cblxuICAgIHByaXZhdGUgZ2VuZXJhdGVMb2dFbnRyeShsaW5lczogc3RyaW5nKTogeyBpZDogc3RyaW5nOyBsaW5lczogc3RyaW5nOyBpbmRleDogbnVtYmVyIH0ge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaWQ6IHRoaXMuaWQsXG4gICAgICAgICAgICBsaW5lczogbGluZXMsXG4gICAgICAgICAgICBpbmRleDogdGhpcy5pbmRleCsrLFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgZ2VuZXJhdGVMYXN0TW9kaWZpZWRUaW1lKCk6IHsgaWQ6IHN0cmluZzsgdHM6IG51bWJlciB9IHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGlkOiB0aGlzLmlkLFxuICAgICAgICAgICAgdHM6IERhdGUubm93KCksXG4gICAgICAgIH07XG4gICAgfVxufVxuXG4vKipcbiAqIEhlbHBlciBtZXRob2QgdG8gY29sbGVjdCByZXN1bHRzIGZyb20gYSBDdXJzb3IgYW5kIHByb21pc2VpZnkgaXQuXG4gKiBAcGFyYW0ge09iamVjdFN0b3JlfEluZGV4fSBzdG9yZSBUaGUgc3RvcmUgdG8gcGVyZm9ybSBvcGVuQ3Vyc29yIG9uLlxuICogQHBhcmFtIHtJREJLZXlSYW5nZT19IGtleVJhbmdlIE9wdGlvbmFsIGtleSByYW5nZSB0byBhcHBseSBvbiB0aGUgY3Vyc29yLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gcmVzdWx0TWFwcGVyIEEgZnVuY3Rpb24gd2hpY2ggaXMgcmVwZWF0ZWRseSBjYWxsZWQgd2l0aCBhXG4gKiBDdXJzb3IuXG4gKiBSZXR1cm4gdGhlIGRhdGEgeW91IHdhbnQgdG8ga2VlcC5cbiAqIEByZXR1cm4ge1Byb21pc2U8VFtdPn0gUmVzb2x2ZXMgdG8gYW4gYXJyYXkgb2Ygd2hhdGV2ZXIgeW91IHJldHVybmVkIGZyb21cbiAqIHJlc3VsdE1hcHBlci5cbiAqL1xuZnVuY3Rpb24gc2VsZWN0UXVlcnk8VD4oXG4gICAgc3RvcmU6IElEQkluZGV4IHwgSURCT2JqZWN0U3RvcmUsXG4gICAga2V5UmFuZ2U6IElEQktleVJhbmdlIHwgdW5kZWZpbmVkLFxuICAgIHJlc3VsdE1hcHBlcjogKGN1cnNvcjogSURCQ3Vyc29yV2l0aFZhbHVlKSA9PiBULFxuKTogUHJvbWlzZTxUW10+IHtcbiAgICBjb25zdCBxdWVyeSA9IHN0b3JlLm9wZW5DdXJzb3Ioa2V5UmFuZ2UpO1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IHJlc3VsdHM6IFRbXSA9IFtdO1xuICAgICAgICBxdWVyeS5vbmVycm9yID0gKCkgPT4ge1xuICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihcIlF1ZXJ5IGZhaWxlZDogXCIgKyBxdWVyeS5lcnJvcj8ubWVzc2FnZSkpO1xuICAgICAgICB9O1xuICAgICAgICAvLyBjb2xsZWN0IHJlc3VsdHNcbiAgICAgICAgcXVlcnkub25zdWNjZXNzID0gKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgY3Vyc29yID0gcXVlcnkucmVzdWx0O1xuICAgICAgICAgICAgaWYgKCFjdXJzb3IpIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3VsdHMpO1xuICAgICAgICAgICAgICAgIHJldHVybjsgLy8gZW5kIG9mIHJlc3VsdHNcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc3VsdHMucHVzaChyZXN1bHRNYXBwZXIoY3Vyc29yKSk7XG4gICAgICAgICAgICBjdXJzb3IuY29udGludWUoKTtcbiAgICAgICAgfTtcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBDb25maWd1cmUgcmFnZSBzaGFraW5nIHN1cHBvcnQgZm9yIHNlbmRpbmcgYnVnIHJlcG9ydHMuXG4gKiBNb2RpZmllcyBnbG9iYWxzLlxuICogQHBhcmFtIHtib29sZWFufSBzZXRVcFBlcnNpc3RlbmNlIFdoZW4gdHJ1ZSAoZGVmYXVsdCksIHRoZSBwZXJzaXN0ZW5jZSB3aWxsXG4gKiBiZSBzZXQgdXAgaW1tZWRpYXRlbHkgZm9yIHRoZSBsb2dzLlxuICogQHJldHVybiB7UHJvbWlzZX0gUmVzb2x2ZXMgd2hlbiBzZXQgdXAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbml0KHNldFVwUGVyc2lzdGVuY2UgPSB0cnVlKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKGdsb2JhbC5teF9yYWdlX2luaXRQcm9taXNlKSB7XG4gICAgICAgIHJldHVybiBnbG9iYWwubXhfcmFnZV9pbml0UHJvbWlzZTtcbiAgICB9XG4gICAgZ2xvYmFsLm14X3JhZ2VfbG9nZ2VyID0gbmV3IENvbnNvbGVMb2dnZXIoKTtcbiAgICBnbG9iYWwubXhfcmFnZV9sb2dnZXIubW9ua2V5UGF0Y2god2luZG93LmNvbnNvbGUpO1xuXG4gICAgaWYgKHNldFVwUGVyc2lzdGVuY2UpIHtcbiAgICAgICAgcmV0dXJuIHRyeUluaXRTdG9yYWdlKCk7XG4gICAgfVxuXG4gICAgZ2xvYmFsLm14X3JhZ2VfaW5pdFByb21pc2UgPSBQcm9taXNlLnJlc29sdmUoKTtcbiAgICByZXR1cm4gZ2xvYmFsLm14X3JhZ2VfaW5pdFByb21pc2U7XG59XG5cbi8qKlxuICogVHJ5IHRvIHN0YXJ0IHVwIHRoZSByYWdlc2hha2Ugc3RvcmFnZSBmb3IgbG9ncy4gSWYgbm90IHBvc3NpYmxlIChjbGllbnQgdW5zdXBwb3J0ZWQpXG4gKiB0aGVuIHRoaXMgbm8tb3BzLlxuICogQHJldHVybiB7UHJvbWlzZX0gUmVzb2x2ZXMgd2hlbiBjb21wbGV0ZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRyeUluaXRTdG9yYWdlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmIChnbG9iYWwubXhfcmFnZV9pbml0U3RvcmFnZVByb21pc2UpIHtcbiAgICAgICAgcmV0dXJuIGdsb2JhbC5teF9yYWdlX2luaXRTdG9yYWdlUHJvbWlzZTtcbiAgICB9XG5cbiAgICBsb2dnZXIubG9nKFwiQ29uZmlndXJpbmcgcmFnZXNoYWtlIHBlcnNpc3RlbmNlLi4uXCIpO1xuXG4gICAgLy8ganVzdCAqYWNjZXNzaW5nKiBpbmRleGVkREIgdGhyb3dzIGFuIGV4Y2VwdGlvbiBpbiBmaXJlZm94IHdpdGhcbiAgICAvLyBpbmRleGVkZGIgZGlzYWJsZWQuXG4gICAgbGV0IGluZGV4ZWREQjtcbiAgICB0cnkge1xuICAgICAgICBpbmRleGVkREIgPSB3aW5kb3cuaW5kZXhlZERCO1xuICAgIH0gY2F0Y2ggKGUpIHt9XG5cbiAgICBpZiAoaW5kZXhlZERCKSB7XG4gICAgICAgIGdsb2JhbC5teF9yYWdlX3N0b3JlID0gbmV3IEluZGV4ZWREQkxvZ1N0b3JlKGluZGV4ZWREQiwgZ2xvYmFsLm14X3JhZ2VfbG9nZ2VyKTtcbiAgICAgICAgZ2xvYmFsLm14X3JhZ2VfaW5pdFN0b3JhZ2VQcm9taXNlID0gZ2xvYmFsLm14X3JhZ2Vfc3RvcmUuY29ubmVjdCgpO1xuICAgICAgICByZXR1cm4gZ2xvYmFsLm14X3JhZ2VfaW5pdFN0b3JhZ2VQcm9taXNlO1xuICAgIH1cbiAgICBnbG9iYWwubXhfcmFnZV9pbml0U3RvcmFnZVByb21pc2UgPSBQcm9taXNlLnJlc29sdmUoKTtcbiAgICByZXR1cm4gZ2xvYmFsLm14X3JhZ2VfaW5pdFN0b3JhZ2VQcm9taXNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZmx1c2goKTogdm9pZCB7XG4gICAgaWYgKCFnbG9iYWwubXhfcmFnZV9zdG9yZSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGdsb2JhbC5teF9yYWdlX3N0b3JlLmZsdXNoKCk7XG59XG5cbi8qKlxuICogQ2xlYW4gdXAgb2xkIGxvZ3MuXG4gKiBAcmV0dXJuIHtQcm9taXNlfSBSZXNvbHZlcyBpZiBjbGVhbmVkIGxvZ3MuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjbGVhbnVwKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICghZ2xvYmFsLm14X3JhZ2Vfc3RvcmUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBhd2FpdCBnbG9iYWwubXhfcmFnZV9zdG9yZS5jb25zdW1lKCk7XG59XG5cbi8qKlxuICogR2V0IGEgcmVjZW50IHNuYXBzaG90IG9mIHRoZSBsb2dzLCByZWFkeSBmb3IgYXR0YWNoaW5nIHRvIGEgYnVnIHJlcG9ydFxuICpcbiAqIEByZXR1cm4ge0FycmF5PHtsaW5lczogc3RyaW5nLCBpZCwgc3RyaW5nfT59ICBsaXN0IG9mIGxvZyBkYXRhXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRMb2dzRm9yUmVwb3J0KCk6IFByb21pc2U8eyBsaW5lczogc3RyaW5nOyBpZDogc3RyaW5nIH1bXT4ge1xuICAgIGlmICghZ2xvYmFsLm14X3JhZ2VfbG9nZ2VyKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vIGNvbnNvbGUgbG9nZ2VyLCBkaWQgeW91IGZvcmdldCB0byBjYWxsIGluaXQoKT9cIik7XG4gICAgfVxuICAgIC8vIElmIGluIGluY29nbml0byBtb2RlLCBzdG9yZSBpcyBudWxsLCBidXQgd2Ugc3RpbGwgd2FudCBidWcgcmVwb3J0XG4gICAgLy8gc2VuZGluZyB0byB3b3JrIGdvaW5nIG9mZiB0aGUgaW4tbWVtb3J5IGNvbnNvbGUgbG9ncy5cbiAgICBpZiAoZ2xvYmFsLm14X3JhZ2Vfc3RvcmUpIHtcbiAgICAgICAgLy8gZmx1c2ggbW9zdCByZWNlbnQgbG9nc1xuICAgICAgICBhd2FpdCBnbG9iYWwubXhfcmFnZV9zdG9yZS5mbHVzaCgpO1xuICAgICAgICByZXR1cm4gZ2xvYmFsLm14X3JhZ2Vfc3RvcmUuY29uc3VtZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbGluZXM6IGdsb2JhbC5teF9yYWdlX2xvZ2dlci5mbHVzaCh0cnVlKSxcbiAgICAgICAgICAgICAgICBpZDogXCItXCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdO1xuICAgIH1cbn1cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztBQXdDQSxJQUFBQSxPQUFBLEdBQUFDLE9BQUE7QUFDQSxJQUFBQyxhQUFBLEdBQUFELE9BQUE7QUFFQSxJQUFBRSxLQUFBLEdBQUFGLE9BQUE7QUEzQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQU1BLE1BQU1HLGFBQWEsR0FBRyxFQUFFLEdBQUcsSUFBSTs7QUFFL0I7QUFDQSxNQUFNQyxZQUFZLEdBQUcsSUFBSSxHQUFHLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQzs7QUFLdEM7QUFDTyxNQUFNQyxhQUFhLENBQUM7RUFBQUMsWUFBQTtJQUFBLElBQUFDLGdCQUFBLENBQUFDLE9BQUEsZ0JBQ1IsRUFBRTtJQUFBLElBQUFELGdCQUFBLENBQUFDLE9BQUEsNkJBQ3VELENBQUMsQ0FBQztFQUFBO0VBRW5FQyxXQUFXQSxDQUFDQyxVQUFtQixFQUFRO0lBQUEsSUFBQUMsS0FBQTtJQUMxQztJQUNBLE1BQU1DLHdCQUF3QixHQUFHO01BQzdCQyxHQUFHLEVBQUUsR0FBRztNQUNSQyxJQUFJLEVBQUUsR0FBRztNQUNUQyxJQUFJLEVBQUUsR0FBRztNQUNUQyxLQUFLLEVBQUU7SUFDWCxDQUFVO0lBQ1RDLE1BQU0sQ0FBQ0MsSUFBSSxDQUFDTix3QkFBd0IsQ0FBQyxDQUE2Q08sT0FBTyxDQUNyRkMsTUFBNkMsSUFBSztNQUMvQyxNQUFNQyxLQUFLLEdBQUdULHdC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