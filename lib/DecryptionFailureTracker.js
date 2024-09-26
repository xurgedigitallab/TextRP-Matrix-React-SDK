"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DecryptionFailureTracker = exports.DecryptionFailure = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _PosthogAnalytics = require("./PosthogAnalytics");
/*
Copyright 2018 - 2021 The Matrix.org Foundation C.I.C.

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

class DecryptionFailure {
  constructor(failedEventId, errorCode) {
    this.failedEventId = failedEventId;
    this.errorCode = errorCode;
    (0, _defineProperty2.default)(this, "ts", void 0);
    this.ts = Date.now();
  }
}
exports.DecryptionFailure = DecryptionFailure;
class DecryptionFailureTracker {
  /**
   * Create a new DecryptionFailureTracker.
   *
   * Call `eventDecrypted(event, err)` on this instance when an event is decrypted.
   *
   * Call `start()` to start the tracker, and `stop()` to stop tracking.
   *
   * @param {function} fn The tracking function, which will be called when failures
   * are tracked. The function should have a signature `(count, trackedErrorCode) => {...}`,
   * where `count` is the number of failures and `errorCode` matches the `.code` of
   * provided DecryptionError errors (by default, unless `errorCodeMapFn` is specified.
   * @param {function?} errorCodeMapFn The function used to map error codes to the
   * trackedErrorCode. If not provided, the `.code` of errors will be used.
   */
  constructor(fn, errorCodeMapFn) {
    this.fn = fn;
    this.errorCodeMapFn = errorCodeMapFn;
    // Map of event IDs to DecryptionFailure items.
    (0, _defineProperty2.default)(this, "failures", new Map());
    // Set of event IDs that have been visible to the user.
    (0, _defineProperty2.default)(this, "visibleEvents", new Set());
    // Map of visible event IDs to `DecryptionFailure`s. Every
    // `CHECK_INTERVAL_MS`, this map is checked for failures that
    // happened > `GRACE_PERIOD_MS` ago. Those that did are
    // accumulated in `failureCounts`.
    (0, _defineProperty2.default)(this, "visibleFailures", new Map());
    // A histogram of the number of failures that will be tracked at the next tracking
    // interval, split by failure error code.
    (0, _defineProperty2.default)(this, "failureCounts", {
      // [errorCode]: 42
    });
    // Event IDs of failures that were tracked previously
    (0, _defineProperty2.default)(this, "trackedEvents", new Set());
    // Set to an interval ID when `start` is called
    (0, _defineProperty2.default)(this, "checkInterval", null);
    (0, _defineProperty2.default)(this, "trackInterval", null);
    if (!fn || typeof fn !== "function") {
      throw new Error("DecryptionFailureTracker requires tracking function");
    }
    if (typeof errorCodeMapFn !== "function") {
      throw new Error("DecryptionFailureTracker second constructor argument should be a function");
    }
  }
  static get instance() {
    return DecryptionFailureTracker.internalInstance;
  }

  // loadTrackedEvents() {
  //     this.trackedEvents = new Set(JSON.parse(localStorage.getItem('mx-decryption-failure-event-ids')) || []);
  // }

  // saveTrackedEvents() {
  //     localStorage.setItem('mx-decryption-failure-event-ids', JSON.stringify([...this.trackedEvents]));
  // }

  eventDecrypted(e, err) {
    // for now we only track megolm decrytion failures
    if (e.getWireContent().algorithm != "m.megolm.v1.aes-sha2") {
      return;
    }
    if (err) {
      this.addDecryptionFailure(new DecryptionFailure(e.getId(), err.code));
    } else {
      // Could be an event in the failures, remove it
      this.removeDecryptionFailuresForEvent(e);
    }
  }
  addVisibleEvent(e) {
    const eventId = e.getId();
    if (this.trackedEvents.has(eventId)) {
      return;
    }
    this.visibleEvents.add(eventId);
    if (this.failures.has(eventId) && !this.visibleFailures.has(eventId)) {
      this.visibleFailures.set(eventId, this.failures.get(eventId));
    }
  }
  addDecryptionFailure(failure) {
    const eventId = failure.failedEventId;
    if (this.trackedEvents.has(eventId)) {
      return;
    }
    this.failures.set(eventId, failure);
    if (this.visibleEvents.has(eventId) && !this.visibleFailures.has(eventId)) {
      this.visibleFailures.set(eventId, failure);
    }
  }
  removeDecryptionFailuresForEvent(e) {
    const eventId = e.getId();
    this.failures.delete(eventId);
    this.visibleFailures.delete(eventId);
  }

  /**
   * Start checking for and tracking failures.
   */
  start() {
    this.checkInterval = window.setInterval(() => this.checkFailures(Date.now()), DecryptionFailureTracker.CHECK_INTERVAL_MS);
    this.trackInterval = window.setInterval(() => this.trackFailures(), DecryptionFailureTracker.TRACK_INTERVAL_MS);
  }

  /**
   * Clear state and stop checking for and tracking failures.
   */
  stop() {
    if (this.checkInterval) clearInterval(this.checkInterval);
    if (this.trackInterval) clearInterval(this.trackInterval);
    this.failures = new Map();
    this.visibleEvents = new Set();
    this.visibleFailures = new Map();
    this.failureCounts = {};
  }

  /**
   * Mark failures that occurred before nowTs - GRACE_PERIOD_MS as failures that should be
   * tracked. Only mark one failure per event ID.
   * @param {number} nowTs the timestamp that represents the time now.
   */
  checkFailures(nowTs) {
    const failuresGivenGrace = new Set();
    const failuresNotReady = new Map();
    for (const [eventId, failure] of this.visibleFailures) {
      if (nowTs > failure.ts + DecryptionFailureTracker.GRACE_PERIOD_MS) {
        failuresGivenGrace.add(failure);
        this.trackedEvents.add(eventId);
      } else {
        failuresNotReady.set(eventId, failure);
      }
    }
    this.visibleFailures = failuresNotReady;

    // Commented out for now for expediency, we need to consider unbound nature of storing
    // this in localStorage
    // this.saveTrackedEvents();

    this.aggregateFailures(failuresGivenGrace);
  }
  aggregateFailures(failures) {
    for (const failure of failures) {
      const errorCode = failure.errorCode;
      this.failureCounts[errorCode] = (this.failureCounts[errorCode] || 0) + 1;
    }
  }

  /**
   * If there are failures that should be tracked, call the given trackDecryptionFailure
   * function with the number of failures that should be tracked.
   */
  trackFailures() {
    for (const errorCode of Object.keys(this.failureCounts)) {
      if (this.failureCounts[errorCode] > 0) {
        const trackedErrorCode = this.errorCodeMapFn(errorCode);
        this.fn(this.failureCounts[errorCode], trackedErrorCode, errorCode);
        this.failureCounts[errorCode] = 0;
      }
    }
  }
}
exports.DecryptionFailureTracker = DecryptionFailureTracker;
(0, _defineProperty2.default)(DecryptionFailureTracker, "internalInstance", new DecryptionFailureTracker((total, errorCode, rawError) => {
  for (let i = 0; i < total; i++) {
    _PosthogAnalytics.PosthogAnalytics.instance.trackEvent({
      eventName: "Error",
      domain: "E2EE",
      name: errorCode,
      context: `mxc_crypto_error_type_${rawError}`
    });
  }
}, errorCode => {
  // Map JS-SDK error codes to tracker codes for aggregation
  switch (errorCode) {
    case "MEGOLM_UNKNOWN_INBOUND_SESSION_ID":
      return "OlmKeysNotSentError";
    case "OLM_UNKNOWN_MESSAGE_INDEX":
      return "OlmIndexError";
    case undefined:
      return "OlmUnspecifiedError";
    default:
      return "UnknownError";
  }
}));
// Spread the load on `Analytics` by tracking at a low frequency, `TRACK_INTERVAL_MS`.
(0, _defineProperty2.default)(DecryptionFailureTracker, "TRACK_INTERVAL_MS", 60000);
// Call `checkFailures` every `CHECK_INTERVAL_MS`.
(0, _defineProperty2.default)(DecryptionFailureTracker, "CHECK_INTERVAL_MS", 5000);
// Give events a chance to be decrypted by waiting `GRACE_PERIOD_MS` before counting
// the failure in `failureCounts`.
(0, _defineProperty2.default)(DecryptionFailureTracker, "GRACE_PERIOD_MS", 4000);
//# sourceMappingURL=DecryptionFailureTracker.js.map