"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _utils = require("matrix-js-sdk/src/utils");
/*
Copyright 2018, 2021 The Matrix.org Foundation C.I.C.

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

/**
A countdown timer, exposing a promise api.
A timer starts in a non-started state,
and needs to be started by calling `start()`` on it first.

Timers can be `abort()`-ed which makes the promise reject prematurely.

Once a timer is finished or aborted, it can't be started again
(because the promise should not be replaced). Instead, create
a new one through `clone()` or `cloneIfRun()`.
*/
class Timer {
  constructor(timeout) {
    this.timeout = timeout;
    (0, _defineProperty2.default)(this, "timerHandle", void 0);
    (0, _defineProperty2.default)(this, "startTs", void 0);
    (0, _defineProperty2.default)(this, "deferred", void 0);
    (0, _defineProperty2.default)(this, "onTimeout", () => {
      const now = Date.now();
      const elapsed = now - this.startTs;
      if (elapsed >= this.timeout) {
        this.deferred.resolve();
        this.setNotStarted();
      } else {
        const delta = this.timeout - elapsed;
        this.timerHandle = window.setTimeout(this.onTimeout, delta);
      }
    });
    this.setNotStarted();
  }
  setNotStarted() {
    this.timerHandle = undefined;
    this.startTs = undefined;
    this.deferred = (0, _utils.defer)();
    this.deferred.promise = this.deferred.promise.finally(() => {
      this.timerHandle = undefined;
    });
  }
  changeTimeout(timeout) {
    if (timeout === this.timeout) {
      return;
    }
    const isSmallerTimeout = timeout < this.timeout;
    this.timeout = timeout;
    if (this.isRunning() && isSmallerTimeout) {
      clearTimeout(this.timerHandle);
      this.onTimeout();
    }
  }

  /**
   * if not started before, starts the timer.
   * @returns {Timer} the same timer
   */
  start() {
    if (!this.isRunning()) {
      this.startTs = Date.now();
      this.timerHandle = window.setTimeout(this.onTimeout, this.timeout);
    }
    return this;
  }

  /**
   * (re)start the timer. If it's running, reset the timeout. If not, start it.
   * @returns {Timer} the same timer
   */
  restart() {
    if (this.isRunning()) {
      // don't clearTimeout here as this method
      // can be called in fast succession,
      // instead just take note and compare
      // when the already running timeout expires
      this.startTs = Date.now();
      return this;
    } else {
      return this.start();
    }
  }

  /**
   * if the timer is running, abort it,
   * and reject the promise for this timer.
   * @returns {Timer} the same timer
   */
  abort() {
    if (this.isRunning()) {
      clearTimeout(this.timerHandle);
      this.deferred.reject(new Error("Timer was aborted."));
      this.setNotStarted();
    }
    return this;
  }

  /**
   *promise that will resolve when the timer elapses,
   *or is rejected when abort is called
   *@return {Promise}
   */
  finished() {
    return this.deferred.promise;
  }
  isRunning() {
    return this.timerHandle !== undefined;
  }
}
exports.default = Timer;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfdXRpbHMiLCJyZXF1aXJlIiwiVGltZXIiLCJjb25zdHJ1Y3RvciIsInRpbWVvdXQiLCJfZGVmaW5lUHJvcGVydHkyIiwiZGVmYXVsdCIsIm5vdyIsIkRhdGUiLCJlbGFwc2VkIiwic3RhcnRUcyIsImRlZmVycmVkIiwicmVzb2x2ZSIsInNldE5vdFN0YXJ0ZWQiLCJkZWx0YSIsInRpbWVySGFuZGxlIiwid2luZG93Iiwic2V0VGltZW91dCIsIm9uVGltZW91dCIsInVuZGVmaW5lZCIsImRlZmVyIiwicHJvbWlzZSIsImZpbmFsbHkiLCJjaGFuZ2VUaW1lb3V0IiwiaXNTbWFsbGVyVGltZW91dCIsImlzUnVubmluZyIsImNsZWFyVGltZW91dCIsInN0YXJ0IiwicmVzdGFydCIsImFib3J0IiwicmVqZWN0IiwiRXJyb3IiLCJmaW5pc2hlZCIsImV4cG9ydHMiXSwic291cmNlcyI6WyIuLi8uLi9zcmMvdXRpbHMvVGltZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbkNvcHlyaWdodCAyMDE4LCAyMDIxIFRoZSBNYXRyaXgub3JnIEZvdW5kYXRpb24gQy5JLkMuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuKi9cblxuaW1wb3J0IHsgSURlZmVycmVkLCBkZWZlciB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy91dGlsc1wiO1xuXG4vKipcbkEgY291bnRkb3duIHRpbWVyLCBleHBvc2luZyBhIHByb21pc2UgYXBpLlxuQSB0aW1lciBzdGFydHMgaW4gYSBub24tc3RhcnRlZCBzdGF0ZSxcbmFuZCBuZWVkcyB0byBiZSBzdGFydGVkIGJ5IGNhbGxpbmcgYHN0YXJ0KClgYCBvbiBpdCBmaXJzdC5cblxuVGltZXJzIGNhbiBiZSBgYWJvcnQoKWAtZWQgd2hpY2ggbWFrZXMgdGhlIHByb21pc2UgcmVqZWN0IHByZW1hdHVyZWx5LlxuXG5PbmNlIGEgdGltZXIgaXMgZmluaXNoZWQgb3IgYWJvcnRlZCwgaXQgY2FuJ3QgYmUgc3RhcnRlZCBhZ2FpblxuKGJlY2F1c2UgdGhlIHByb21pc2Ugc2hvdWxkIG5vdCBiZSByZXBsYWNlZCkuIEluc3RlYWQsIGNyZWF0ZVxuYSBuZXcgb25lIHRocm91Z2ggYGNsb25lKClgIG9yIGBjbG9uZUlmUnVuKClgLlxuKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFRpbWVyIHtcbiAgICBwcml2YXRlIHRpbWVySGFuZGxlPzogbnVtYmVyO1xuICAgIHByaXZhdGUgc3RhcnRUcz86IG51bWJlcjtcbiAgICBwcml2YXRlIGRlZmVycmVkITogSURlZmVycmVkPHZvaWQ+O1xuXG4gICAgcHVibGljIGNvbnN0cnVjdG9yKHByaXZhdGUgdGltZW91dDogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMuc2V0Tm90U3RhcnRlZCgpO1xuICAgIH1cblxuICAgIHByaXZhdGUgc2V0Tm90U3RhcnRlZCgpOiB2b2lkIHtcbiAgICAgICAgdGhpcy50aW1lckhhbmRsZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5zdGFydFRzID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLmRlZmVycmVkID0gZGVmZXIoKTtcbiAgICAgICAgdGhpcy5kZWZlcnJlZC5wcm9taXNlID0gdGhpcy5kZWZlcnJlZC5wcm9taXNlLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy50aW1lckhhbmRsZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBvblRpbWVvdXQgPSAoKTogdm9pZCA9PiB7XG4gICAgICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgICAgIGNvbnN0IGVsYXBzZWQgPSBub3cgLSB0aGlzLnN0YXJ0VHMhO1xuICAgICAgICBpZiAoZWxhcHNlZCA+PSB0aGlzLnRpbWVvdXQpIHtcbiAgICAgICAgICAgIHRoaXMuZGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgICAgICAgdGhpcy5zZXROb3RTdGFydGVkKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBkZWx0YSA9IHRoaXMudGltZW91dCAtIGVsYXBzZWQ7XG4gICAgICAgICAgICB0aGlzLnRpbWVySGFuZGxlID0gd2luZG93LnNldFRpbWVvdXQodGhpcy5vblRpbWVvdXQsIGRlbHRhKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBwdWJsaWMgY2hhbmdlVGltZW91dCh0aW1lb3V0OiBudW1iZXIpOiB2b2lkIHtcbiAgICAgICAgaWYgKHRpbWVvdXQgPT09IHRoaXMudGltZW91dCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGlzU21hbGxlclRpbWVvdXQgPSB0aW1lb3V0IDwgdGhpcy50aW1lb3V0O1xuICAgICAgICB0aGlzLnRpbWVvdXQgPSB0aW1lb3V0O1xuICAgICAgICBpZiAodGhpcy5pc1J1bm5pbmcoKSAmJiBpc1NtYWxsZXJUaW1lb3V0KSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGhpcy50aW1lckhhbmRsZSk7XG4gICAgICAgICAgICB0aGlzLm9uVGltZW91dCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogaWYgbm90IHN0YXJ0ZWQgYmVmb3JlLCBzdGFydHMgdGhlIHRpbWVyLlxuICAgICAqIEByZXR1cm5zIHtUaW1lcn0gdGhlIHNhbWUgdGltZXJcbiAgICAgKi9cbiAgICBwdWJsaWMgc3RhcnQoKTogVGltZXIge1xuICAgICAgICBpZiAoIXRoaXMuaXNSdW5uaW5nKCkpIHtcbiAgICAgICAgICAgIHRoaXMuc3RhcnRUcyA9IERhdGUubm93KCk7XG4gICAgICAgICAgICB0aGlzLnRpbWVySGFuZGxlID0gd2luZG93LnNldFRpbWVvdXQodGhpcy5vblRpbWVvdXQsIHRoaXMudGltZW91dCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogKHJlKXN0YXJ0IHRoZSB0aW1lci4gSWYgaXQncyBydW5uaW5nLCByZXNldCB0aGUgdGltZW91dC4gSWYgbm90LCBzdGFydCBpdC5cbiAgICAgKiBAcmV0dXJucyB7VGltZXJ9IHRoZSBzYW1lIHRpbWVyXG4gICAgICovXG4gICAgcHVibGljIHJlc3RhcnQoKTogVGltZXIge1xuICAgICAgICBpZiAodGhpcy5pc1J1bm5pbmcoKSkge1xuICAgICAgICAgICAgLy8gZG9uJ3QgY2xlYXJUaW1lb3V0IGhlcmUgYXMgdGhpcyBtZXRob2RcbiAgICAgICAgICAgIC8vIGNhbiBiZSBjYWxsZWQgaW4gZmFzdCBzdWNjZXNzaW9uLFxuICAgICAgICAgICAgLy8gaW5zdGVhZCBqdXN0IHRha2Ugbm90ZSBhbmQgY29tcGFyZVxuICAgICAgICAgICAgLy8gd2hlbiB0aGUgYWxyZWFkeSBydW5uaW5nIHRpbWVvdXQgZXhwaXJlc1xuICAgICAgICAgICAgdGhpcy5zdGFydFRzID0gRGF0ZS5ub3coKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuc3RhcnQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGlmIHRoZSB0aW1lciBpcyBydW5uaW5nLCBhYm9ydCBpdCxcbiAgICAgKiBhbmQgcmVqZWN0IHRoZSBwcm9taXNlIGZvciB0aGlzIHRpbWVyLlxuICAgICAqIEByZXR1cm5zIHtUaW1lcn0gdGhlIHNhbWUgdGltZXJcbiAgICAgKi9cbiAgICBwdWJsaWMgYWJvcnQoKTogVGltZXIge1xuICAgICAgICBpZiAodGhpcy5pc1J1bm5pbmcoKSkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMudGltZXJIYW5kbGUpO1xuICAgICAgICAgICAgdGhpcy5kZWZlcnJlZC5yZWplY3QobmV3IEVycm9yKFwiVGltZXIgd2FzIGFib3J0ZWQuXCIpKTtcbiAgICAgICAgICAgIHRoaXMuc2V0Tm90U3RhcnRlZCgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqcHJvbWlzZSB0aGF0IHdpbGwgcmVzb2x2ZSB3aGVuIHRoZSB0aW1lciBlbGFwc2VzLFxuICAgICAqb3IgaXMgcmVqZWN0ZWQgd2hlbiBhYm9ydCBpcyBjYWxsZWRcbiAgICAgKkByZXR1cm4ge1Byb21pc2V9XG4gICAgICovXG4gICAgcHVibGljIGZpbmlzaGVkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICByZXR1cm4gdGhpcy5kZWZlcnJlZC5wcm9taXNlO1xuICAgIH1cblxuICAgIHB1YmxpYyBpc1J1bm5pbmcoKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB0aGlzLnRpbWVySGFuZGxlICE9PSB1bmRlZmluZWQ7XG4gICAgfVxufVxuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQWdCQSxJQUFBQSxNQUFBLEdBQUFDLE9BQUE7QUFoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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