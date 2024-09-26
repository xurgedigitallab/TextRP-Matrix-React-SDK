"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "PerformanceEntryNames", {
  enumerable: true,
  get: function () {
    return _entryNames.PerformanceEntryNames;
  }
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _logger = require("matrix-js-sdk/src/logger");
var _entryNames = require("./entry-names");
/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

class PerformanceMonitor {
  constructor() {
    (0, _defineProperty2.default)(this, "START_PREFIX", "start:");
    (0, _defineProperty2.default)(this, "STOP_PREFIX", "stop:");
    (0, _defineProperty2.default)(this, "listeners", []);
    (0, _defineProperty2.default)(this, "entries", []);
  }
  static get instance() {
    if (!PerformanceMonitor._instance) {
      PerformanceMonitor._instance = new PerformanceMonitor();
    }
    return PerformanceMonitor._instance;
  }

  /**
   * Starts a performance recording
   * @param name Name of the recording
   * @param id Specify an identifier appended to the measurement name
   * @returns {void}
   */
  start(name, id) {
    if (!this.supportsPerformanceApi()) {
      return;
    }
    const key = this.buildKey(name, id);
    if (performance.getEntriesByName(this.START_PREFIX + key).length > 0) {
      _logger.logger.warn(`Recording already started for: ${name}`);
      return;
    }
    performance.mark(this.START_PREFIX + key);
  }

  /**
   * Stops a performance recording and stores delta duration
   * with the start marker
   * @param name Name of the recording
   * @param id Specify an identifier appended to the measurement name
   * @returns The measurement
   */
  stop(name, id) {
    if (!this.supportsPerformanceApi()) {
      return;
    }
    const key = this.buildKey(name, id);
    if (performance.getEntriesByName(this.START_PREFIX + key).length === 0) {
      _logger.logger.warn(`No recording started for: ${name}`);
      return;
    }
    performance.mark(this.STOP_PREFIX + key);
    performance.measure(key, this.START_PREFIX + key, this.STOP_PREFIX + key);
    this.clear(name, id);
    const measurement = performance.getEntriesByName(key).pop();

    // Keeping a reference to all PerformanceEntry created
    // by this abstraction for historical events collection
    // when adding a data callback
    this.entries.push(measurement);
    this.listeners.forEach(listener => {
      if (this.shouldEmit(listener, measurement)) {
        listener.callback([measurement]);
      }
    });
    return measurement;
  }
  clear(name, id) {
    if (!this.supportsPerformanceApi()) {
      return;
    }
    const key = this.buildKey(name, id);
    performance.clearMarks(this.START_PREFIX + key);
    performance.clearMarks(this.STOP_PREFIX + key);
  }
  getEntries() {
    let {
      name,
      type
    } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    return this.entries.filter(entry => {
      const satisfiesName = !name || entry.name === name;
      const satisfiedType = !type || entry.entryType === type;
      return satisfiesName && satisfiedType;
    });
  }
  addPerformanceDataCallback(listener) {
    let buffer = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    this.listeners.push(listener);
    if (buffer) {
      const toEmit = this.entries.filter(entry => this.shouldEmit(listener, entry));
      if (toEmit.length > 0) {
        listener.callback(toEmit);
      }
    }
  }
  removePerformanceDataCallback(callback) {
    if (!callback) {
      this.listeners = [];
    } else {
      this.listeners.splice(this.listeners.findIndex(listener => listener.callback === callback), 1);
    }
  }

  /**
   * Tor browser does not support the Performance API
   * @returns {boolean} true if the Performance API is supported
   */
  supportsPerformanceApi() {
    return performance !== undefined && performance.mark !== undefined;
  }
  shouldEmit(listener, entry) {
    return !listener.entryNames || listener.entryNames.includes(entry.name);
  }

  /**
   * Internal utility to ensure consistent name for the recording
   * @param name Name of the recording
   * @param id Specify an identifier appended to the measurement name
   * @returns {string} a compound of the name and identifier if present
   */
  buildKey(name, id) {
    const suffix = id ? `:${id}` : "";
    return `${name}${suffix}`;
  }
}

// Convenience exports
exports.default = PerformanceMonitor;
(0, _defineProperty2.default)(PerformanceMonitor, "_instance", void 0);
// Exposing those to the window object to bridge them from tests
window.mxPerformanceMonitor = PerformanceMonitor.instance;
window.mxPerformanceEntryNames = _entryNames.PerformanceEntryNames;
//# sourceMappingURL=index.js.map