"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.EventIndexPeg = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _logger = require("matrix-js-sdk/src/logger");
var _PlatformPeg = _interopRequireDefault(require("../PlatformPeg"));
var _EventIndex = _interopRequireDefault(require("../indexing/EventIndex"));
var _MatrixClientPeg = require("../MatrixClientPeg");
var _SettingsStore = _interopRequireDefault(require("../settings/SettingsStore"));
var _SettingLevel = require("../settings/SettingLevel");
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

/*
 * Object holding the global EventIndex object. Can only be initialized if the
 * platform supports event indexing.
 */

const INDEX_VERSION = 1;

/**
 * Holds the current instance of the `EventIndex` to use across the codebase.
 * Looking for an `EventIndex`? Just look for the `EventIndexPeg` on the peg
 * board. "Peg" is the literal meaning of something you hang something on. So
 * you'll find a `EventIndex` hanging on the `EventIndexPeg`.
 */
class EventIndexPeg {
  constructor() {
    (0, _defineProperty2.default)(this, "index", null);
    (0, _defineProperty2.default)(this, "error", null);
    (0, _defineProperty2.default)(this, "_supportIsInstalled", false);
  }
  /**
   * Initialize the EventIndexPeg and if event indexing is enabled initialize
   * the event index.
   *
   * @return {Promise<boolean>} A promise that will resolve to true if an
   * EventIndex was successfully initialized, false otherwise.
   */
  async init() {
    const indexManager = _PlatformPeg.default.get()?.getEventIndexingManager();
    if (!indexManager) {
      _logger.logger.log("EventIndex: Platform doesn't support event indexing, not initializing.");
      return false;
    }
    this._supportIsInstalled = await indexManager.supportsEventIndexing();
    if (!this.supportIsInstalled()) {
      _logger.logger.log("EventIndex: Event indexing isn't installed for the platform, not initializing.");
      return false;
    }
    if (!_SettingsStore.default.getValueAt(_SettingLevel.SettingLevel.DEVICE, "enableEventIndexing")) {
      _logger.logger.log("EventIndex: Event indexing is disabled, not initializing");
      return false;
    }
    return this.initEventIndex();
  }

  /**
   * Initialize the event index.
   *
   * @returns {boolean} True if the event index was successfully initialized,
   * false otherwise.
   */
  async initEventIndex() {
    const index = new _EventIndex.default();
    const indexManager = _PlatformPeg.default.get()?.getEventIndexingManager();
    const client = _MatrixClientPeg.MatrixClientPeg.get();
    if (!indexManager || !client) {
      throw new Error("Unable to init event index");
    }
    const userId = client.getUserId();
    const deviceId = client.getDeviceId();
    try {
      await indexManager.initEventIndex(userId, deviceId);
      const userVersion = await indexManager.getUserVersion();
      const eventIndexIsEmpty = await indexManager.isEventIndexEmpty();
      if (eventIndexIsEmpty) {
        await indexManager.setUserVersion(INDEX_VERSION);
      } else if (userVersion === 0 && !eventIndexIsEmpty) {
        await indexManager.closeEventIndex();
        await this.deleteEventIndex();
        await indexManager.initEventIndex(userId, deviceId);
        await indexManager.setUserVersion(INDEX_VERSION);
      }
      _logger.logger.log("EventIndex: Successfully initialized the event index");
      await index.init();
    } catch (e) {
      _logger.logger.log("EventIndex: Error initializing the event index", e);
      this.error = e;
      return false;
    }
    this.index = index;
    return true;
  }

  /**
   * Check if the current platform has support for event indexing.
   *
   * @return {boolean} True if it has support, false otherwise. Note that this
   * does not mean that support is installed.
   */
  platformHasSupport() {
    return _PlatformPeg.default.get()?.getEventIndexingManager() != null;
  }

  /**
   * Check if event indexing support is installed for the platform.
   *
   * Event indexing might require additional optional modules to be installed,
   * this tells us if those are installed. Note that this should only be
   * called after the init() method was called.
   *
   * @return {boolean} True if support is installed, false otherwise.
   */
  supportIsInstalled() {
    return this._supportIsInstalled;
  }

  /**
   * Get the current event index.
   *
   * @return {EventIndex} The current event index.
   */
  get() {
    return this.index;
  }
  start() {
    if (this.index === null) return;
    this.index.startCrawler();
  }
  stop() {
    if (this.index === null) return;
    this.index.stopCrawler();
  }

  /**
   * Unset our event store
   *
   * After a call to this the init() method will need to be called again.
   *
   * @return {Promise} A promise that will resolve once the event index is
   * closed.
   */
  async unset() {
    if (this.index === null) return;
    await this.index.close();
    this.index = null;
  }

  /**
   * Delete our event indexer.
   *
   * After a call to this the init() method will need to be called again.
   *
   * @return {Promise} A promise that will resolve once the event index is
   * deleted.
   */
  async deleteEventIndex() {
    const indexManager = _PlatformPeg.default.get()?.getEventIndexingManager();
    if (indexManager) {
      await this.unset();
      _logger.logger.log("EventIndex: Deleting event index.");
      await indexManager.deleteEventIndex();
    }
  }
}
exports.EventIndexPeg = EventIndexPeg;
if (!window.mxEventIndexPeg) {
  window.mxEventIndexPeg = new EventIndexPeg();
}
var _default = window.mxEventIndexPeg;
exports.default = _default;
//# sourceMappingURL=EventIndexPeg.js.map