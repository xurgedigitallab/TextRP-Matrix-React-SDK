"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.MarkedExecution = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
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

/**
 * A utility to ensure that a function is only called once triggered with
 * a mark applied. Multiple marks can be applied to the function, however
 * the function will only be called once upon trigger().
 *
 * The function starts unmarked.
 */
class MarkedExecution {
  /**
   * Creates a MarkedExecution for the provided function.
   * @param {Function} fn The function to be called upon trigger if marked.
   * @param {Function} onMarkCallback A function that is called when a new mark is made. Not
   * called if a mark is already flagged.
   */
  constructor(fn, onMarkCallback) {
    this.fn = fn;
    this.onMarkCallback = onMarkCallback;
    (0, _defineProperty2.default)(this, "marked", false);
  }

  /**
   * Resets the mark without calling the function.
   */
  reset() {
    this.marked = false;
  }

  /**
   * Marks the function to be called upon trigger().
   */
  mark() {
    if (!this.marked) this.onMarkCallback?.();
    this.marked = true;
  }

  /**
   * If marked, the function will be called, otherwise this does nothing.
   */
  trigger() {
    if (!this.marked) return;
    this.reset(); // reset first just in case the fn() causes a trigger()
    this.fn();
  }
}
exports.MarkedExecution = MarkedExecution;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJNYXJrZWRFeGVjdXRpb24iLCJjb25zdHJ1Y3RvciIsImZuIiwib25NYXJrQ2FsbGJhY2siLCJfZGVmaW5lUHJvcGVydHkyIiwiZGVmYXVsdCIsInJlc2V0IiwibWFya2VkIiwibWFyayIsInRyaWdnZXIiLCJleHBvcnRzIl0sInNvdXJjZXMiOlsiLi4vLi4vc3JjL3V0aWxzL01hcmtlZEV4ZWN1dGlvbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuQ29weXJpZ2h0IDIwMjAgVGhlIE1hdHJpeC5vcmcgRm91bmRhdGlvbiBDLkkuQy5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4qL1xuXG4vKipcbiAqIEEgdXRpbGl0eSB0byBlbnN1cmUgdGhhdCBhIGZ1bmN0aW9uIGlzIG9ubHkgY2FsbGVkIG9uY2UgdHJpZ2dlcmVkIHdpdGhcbiAqIGEgbWFyayBhcHBsaWVkLiBNdWx0aXBsZSBtYXJrcyBjYW4gYmUgYXBwbGllZCB0byB0aGUgZnVuY3Rpb24sIGhvd2V2ZXJcbiAqIHRoZSBmdW5jdGlvbiB3aWxsIG9ubHkgYmUgY2FsbGVkIG9uY2UgdXBvbiB0cmlnZ2VyKCkuXG4gKlxuICogVGhlIGZ1bmN0aW9uIHN0YXJ0cyB1bm1hcmtlZC5cbiAqL1xuZXhwb3J0IGNsYXNzIE1hcmtlZEV4ZWN1dGlvbiB7XG4gICAgcHJpdmF0ZSBtYXJrZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBNYXJrZWRFeGVjdXRpb24gZm9yIHRoZSBwcm92aWRlZCBmdW5jdGlvbi5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiBUaGUgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIHVwb24gdHJpZ2dlciBpZiBtYXJrZWQuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gb25NYXJrQ2FsbGJhY2sgQSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCB3aGVuIGEgbmV3IG1hcmsgaXMgbWFkZS4gTm90XG4gICAgICogY2FsbGVkIGlmIGEgbWFyayBpcyBhbHJlYWR5IGZsYWdnZWQuXG4gICAgICovXG4gICAgcHVibGljIGNvbnN0cnVjdG9yKHByaXZhdGUgZm46ICgpID0+IHZvaWQsIHByaXZhdGUgb25NYXJrQ2FsbGJhY2s/OiAoKSA9PiB2b2lkKSB7fVxuXG4gICAgLyoqXG4gICAgICogUmVzZXRzIHRoZSBtYXJrIHdpdGhvdXQgY2FsbGluZyB0aGUgZnVuY3Rpb24uXG4gICAgICovXG4gICAgcHVibGljIHJlc2V0KCk6IHZvaWQge1xuICAgICAgICB0aGlzLm1hcmtlZCA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1hcmtzIHRoZSBmdW5jdGlvbiB0byBiZSBjYWxsZWQgdXBvbiB0cmlnZ2VyKCkuXG4gICAgICovXG4gICAgcHVibGljIG1hcmsoKTogdm9pZCB7XG4gICAgICAgIGlmICghdGhpcy5tYXJrZWQpIHRoaXMub25NYXJrQ2FsbGJhY2s/LigpO1xuICAgICAgICB0aGlzLm1hcmtlZCA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgbWFya2VkLCB0aGUgZnVuY3Rpb24gd2lsbCBiZSBjYWxsZWQsIG90aGVyd2lzZSB0aGlzIGRvZXMgbm90aGluZy5cbiAgICAgKi9cbiAgICBwdWJsaWMgdHJpZ2dlcigpOiB2b2lkIHtcbiAgICAgICAgaWYgKCF0aGlzLm1hcmtlZCkgcmV0dXJuO1xuICAgICAgICB0aGlzLnJlc2V0KCk7IC8vIHJlc2V0IGZpcnN0IGp1c3QgaW4gY2FzZSB0aGUgZm4oKSBjYXVzZXMgYSB0cmlnZ2VyKClcbiAgICAgICAgdGhpcy5mbigpO1xuICAgIH1cbn1cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQSxlQUFlLENBQUM7RUFHekI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ1dDLFdBQVdBLENBQVNDLEVBQWMsRUFBVUMsY0FBMkIsRUFBRTtJQUFBLEtBQXJERCxFQUFjLEdBQWRBLEVBQWM7SUFBQSxLQUFVQyxjQUEyQixHQUEzQkEsY0FBMkI7SUFBQSxJQUFBQyxnQkFBQSxDQUFBQyxPQUFBLGtCQVI3RCxLQUFLO0VBUTJEOztFQUVqRjtBQUNKO0FBQ0E7RUFDV0MsS0FBS0EsQ0FBQSxFQUFTO0lBQ2pCLElBQUksQ0FBQ0MsTUFBTSxHQUFHLEtBQUs7RUFDdkI7O0VBRUE7QUFDSjtBQUNBO0VBQ1dDLElBQUlBLENBQUEsRUFBUztJQUNoQixJQUFJLENBQUMsSUFBSSxDQUFDRCxNQUFNLEVBQUUsSUFBSSxDQUFDSixjQUFjLEdBQUcsQ0FBQztJQUN6QyxJQUFJLENBQUNJLE1BQU0sR0FBRyxJQUFJO0VBQ3RCOztFQUVBO0FBQ0o7QUFDQTtFQUNXRSxPQUFPQSxDQUFBLEVBQVM7SUFDbkIsSUFBSSxDQUFDLElBQUksQ0FBQ0YsTUFBTSxFQUFFO0lBQ2xCLElBQUksQ0FBQ0QsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2QsSUFBSSxDQUFDSixFQUFFLENBQUMsQ0FBQztFQUNiO0FBQ0o7QUFBQ1EsT0FBQSxDQUFBVixlQUFBLEdBQUFBLGVBQUEifQ==