"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Whenable = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _logger = require("matrix-js-sdk/src/logger");
var _arrays = require("./arrays");
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
 * Whenables are a cheap way to have Observable patterns mixed with typical
 * usage of Promises, without having to tear down listeners or calls. Whenables
 * are intended to be used when a condition will be met multiple times and
 * the consumer needs to know *when* that happens.
 */
class Whenable {
  constructor() {
    (0, _defineProperty2.default)(this, "listeners", []);
  }
  /**
   * Sets up a call to `fn` *when* the `condition` is met.
   * @param condition The condition to match.
   * @param fn The function to call.
   * @returns This.
   */
  when(condition, fn) {
    this.listeners.push({
      condition,
      fn
    });
    return this;
  }

  /**
   * Sets up a call to `fn` *when* any of the `conditions` are met.
   * @param conditions The conditions to match.
   * @param fn The function to call.
   * @returns This.
   */
  whenAnyOf(conditions, fn) {
    for (const condition of conditions) {
      this.when(condition, fn);
    }
    return this;
  }

  /**
   * Sets up a call to `fn` *when* any condition is met.
   * @param fn The function to call.
   * @returns This.
   */
  whenAnything(fn) {
    this.listeners.push({
      condition: null,
      fn
    });
    return this;
  }

  /**
   * Notifies all the listeners of a given condition.
   * @param condition The new condition that has been met.
   */
  notifyCondition(condition) {
    const listeners = (0, _arrays.arrayFastClone)(this.listeners); // clone just in case the handler modifies us
    for (const listener of listeners) {
      if (listener.condition === null || listener.condition === condition) {
        try {
          listener.fn(this);
        } catch (e) {
          _logger.logger.error(`Error calling whenable listener for ${condition}:`, e);
        }
      }
    }
  }
  destroy() {
    this.listeners = [];
  }
}
exports.Whenable = Whenable;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfbG9nZ2VyIiwicmVxdWlyZSIsIl9hcnJheXMiLCJXaGVuYWJsZSIsImNvbnN0cnVjdG9yIiwiX2RlZmluZVByb3BlcnR5MiIsImRlZmF1bHQiLCJ3aGVuIiwiY29uZGl0aW9uIiwiZm4iLCJsaXN0ZW5lcnMiLCJwdXNoIiwid2hlbkFueU9mIiwiY29uZGl0aW9ucyIsIndoZW5Bbnl0aGluZyIsIm5vdGlmeUNvbmRpdGlvbiIsImFycmF5RmFzdENsb25lIiwibGlzdGVuZXIiLCJlIiwibG9nZ2VyIiwiZXJyb3IiLCJkZXN0cm95IiwiZXhwb3J0cyJdLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlscy9XaGVuYWJsZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuQ29weXJpZ2h0IDIwMjAgVGhlIE1hdHJpeC5vcmcgRm91bmRhdGlvbiBDLkkuQy5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG5odHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiovXG5cbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9sb2dnZXJcIjtcblxuaW1wb3J0IHsgSURlc3Ryb3lhYmxlIH0gZnJvbSBcIi4vSURlc3Ryb3lhYmxlXCI7XG5pbXBvcnQgeyBhcnJheUZhc3RDbG9uZSB9IGZyb20gXCIuL2FycmF5c1wiO1xuXG5leHBvcnQgdHlwZSBXaGVuRm48VCBleHRlbmRzIHN0cmluZyB8IG51bWJlcj4gPSAodzogV2hlbmFibGU8VD4pID0+IHZvaWQ7XG5cbi8qKlxuICogV2hlbmFibGVzIGFyZSBhIGNoZWFwIHdheSB0byBoYXZlIE9ic2VydmFibGUgcGF0dGVybnMgbWl4ZWQgd2l0aCB0eXBpY2FsXG4gKiB1c2FnZSBvZiBQcm9taXNlcywgd2l0aG91dCBoYXZpbmcgdG8gdGVhciBkb3duIGxpc3RlbmVycyBvciBjYWxscy4gV2hlbmFibGVzXG4gKiBhcmUgaW50ZW5kZWQgdG8gYmUgdXNlZCB3aGVuIGEgY29uZGl0aW9uIHdpbGwgYmUgbWV0IG11bHRpcGxlIHRpbWVzIGFuZFxuICogdGhlIGNvbnN1bWVyIG5lZWRzIHRvIGtub3cgKndoZW4qIHRoYXQgaGFwcGVucy5cbiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFdoZW5hYmxlPFQgZXh0ZW5kcyBzdHJpbmcgfCBudW1iZXI+IGltcGxlbWVudHMgSURlc3Ryb3lhYmxlIHtcbiAgICBwcml2YXRlIGxpc3RlbmVyczogeyBjb25kaXRpb246IFQgfCBudWxsOyBmbjogV2hlbkZuPFQ+IH1bXSA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogU2V0cyB1cCBhIGNhbGwgdG8gYGZuYCAqd2hlbiogdGhlIGBjb25kaXRpb25gIGlzIG1ldC5cbiAgICAgKiBAcGFyYW0gY29uZGl0aW9uIFRoZSBjb25kaXRpb24gdG8gbWF0Y2guXG4gICAgICogQHBhcmFtIGZuIFRoZSBmdW5jdGlvbiB0byBjYWxsLlxuICAgICAqIEByZXR1cm5zIFRoaXMuXG4gICAgICovXG4gICAgcHVibGljIHdoZW4oY29uZGl0aW9uOiBULCBmbjogV2hlbkZuPFQ+KTogV2hlbmFibGU8VD4ge1xuICAgICAgICB0aGlzLmxpc3RlbmVycy5wdXNoKHsgY29uZGl0aW9uLCBmbiB9KTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB1cCBhIGNhbGwgdG8gYGZuYCAqd2hlbiogYW55IG9mIHRoZSBgY29uZGl0aW9uc2AgYXJlIG1ldC5cbiAgICAgKiBAcGFyYW0gY29uZGl0aW9ucyBUaGUgY29uZGl0aW9ucyB0byBtYXRjaC5cbiAgICAgKiBAcGFyYW0gZm4gVGhlIGZ1bmN0aW9uIHRvIGNhbGwuXG4gICAgICogQHJldHVybnMgVGhpcy5cbiAgICAgKi9cbiAgICBwdWJsaWMgd2hlbkFueU9mKGNvbmRpdGlvbnM6IFRbXSwgZm46IFdoZW5GbjxUPik6IFdoZW5hYmxlPFQ+IHtcbiAgICAgICAgZm9yIChjb25zdCBjb25kaXRpb24gb2YgY29uZGl0aW9ucykge1xuICAgICAgICAgICAgdGhpcy53aGVuKGNvbmRpdGlvbiwgZm4pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdXAgYSBjYWxsIHRvIGBmbmAgKndoZW4qIGFueSBjb25kaXRpb24gaXMgbWV0LlxuICAgICAqIEBwYXJhbSBmbiBUaGUgZnVuY3Rpb24gdG8gY2FsbC5cbiAgICAgKiBAcmV0dXJucyBUaGlzLlxuICAgICAqL1xuICAgIHB1YmxpYyB3aGVuQW55dGhpbmcoZm46IFdoZW5GbjxUPik6IFdoZW5hYmxlPFQ+IHtcbiAgICAgICAgdGhpcy5saXN0ZW5lcnMucHVzaCh7IGNvbmRpdGlvbjogbnVsbCwgZm4gfSk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE5vdGlmaWVzIGFsbCB0aGUgbGlzdGVuZXJzIG9mIGEgZ2l2ZW4gY29uZGl0aW9uLlxuICAgICAqIEBwYXJhbSBjb25kaXRpb24gVGhlIG5ldyBjb25kaXRpb24gdGhhdCBoYXMgYmVlbiBtZXQuXG4gICAgICovXG4gICAgcHJvdGVjdGVkIG5vdGlmeUNvbmRpdGlvbihjb25kaXRpb246IFQpOiB2b2lkIHtcbiAgICAgICAgY29uc3QgbGlzdGVuZXJzID0gYXJyYXlGYXN0Q2xvbmUodGhpcy5saXN0ZW5lcnMpOyAvLyBjbG9uZSBqdXN0IGluIGNhc2UgdGhlIGhhbmRsZXIgbW9kaWZpZXMgdXNcbiAgICAgICAgZm9yIChjb25zdCBsaXN0ZW5lciBvZiBsaXN0ZW5lcnMpIHtcbiAgICAgICAgICAgIGlmIChsaXN0ZW5lci5jb25kaXRpb24gPT09IG51bGwgfHwgbGlzdGVuZXIuY29uZGl0aW9uID09PSBjb25kaXRpb24pIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBsaXN0ZW5lci5mbih0aGlzKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZ2dlci5lcnJvcihgRXJyb3IgY2FsbGluZyB3aGVuYWJsZSBsaXN0ZW5lciBmb3IgJHtjb25kaXRpb259OmAsIGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBkZXN0cm95KCk6IHZvaWQge1xuICAgICAgICB0aGlzLmxpc3RlbmVycyA9IFtdO1xuICAgIH1cbn1cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFnQkEsSUFBQUEsT0FBQSxHQUFBQyxPQUFBO0FBR0EsSUFBQUMsT0FBQSxHQUFBRCxPQUFBO0FBbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFlRSxRQUFRLENBQW9EO0VBQUFDLFlBQUE7SUFBQSxJQUFBQyxnQkFBQSxDQUFBQyxPQUFBLHFCQUNoQixFQUFFO0VBQUE7RUFFaEU7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ1dDLElBQUlBLENBQUNDLFNBQVksRUFBRUMsRUFBYSxFQUFlO0lBQ2xELElBQUksQ0FBQ0MsU0FBUyxDQUFDQyxJQUFJLENBQUM7TUFBRUgsU0FBUztNQUFFQztJQUFHLENBQUMsQ0FBQztJQUN0QyxPQUFPLElBQUk7RUFDZjs7RUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDV0csU0FBU0EsQ0FBQ0MsVUFBZSxFQUFFSixFQUFhLEVBQWU7SUFDMUQsS0FBSyxNQUFNRCxTQUFTLElBQUlLLFVBQVUsRUFBRTtNQUNoQyxJQUFJLENBQUNOLElBQUksQ0FBQ0MsU0FBUyxFQUFFQyxFQUFFLENBQUM7SUFDNUI7SUFDQSxPQUFPLElBQUk7RUFDZjs7RUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ1dLLFlBQVlBLENBQUNMLEVBQWEsRUFBZTtJQUM1QyxJQUFJLENBQUNDLFNBQVMsQ0FBQ0MsSUFBSSxDQUFDO01BQUVILFNBQVMsRUFBRSxJQUFJO01BQUVDO0lBQUcsQ0FBQyxDQUFDO0lBQzVDLE9BQU8sSUFBSTtFQUNmOztFQUVBO0FBQ0o7QUFDQTtBQUNBO0VBQ2NNLGVBQWVBLENBQUNQLFNBQVksRUFBUTtJQUMxQyxNQUFNRSxTQUFTLEdBQUcsSUFBQU0sc0JBQWMsRUFBQyxJQUFJLENBQUNOLFNBQVMsQ0FBQyxDQUFDLENBQUM7SUFDbEQsS0FBSyxNQUFNTyxRQUFRLElBQUlQLFNBQVMsRUFBRTtNQUM5QixJQUFJTyxRQUFRLENBQUNULFNBQVMsS0FBSyxJQUFJLElBQUlTLFFBQVEsQ0FBQ1QsU0FBUyxLQUFLQSxTQUFTLEVBQUU7UUFDakUsSUFBSTtVQUNBUyxRQUFRLENBQUNSLEVBQUUsQ0FBQyxJQUFJLENBQUM7UUFDckIsQ0FBQyxDQUFDLE9BQU9TLENBQUMsRUFBRTtVQUNSQyxjQUFNLENBQUNDLEtBQUssQ0FBRSx1Q0FBc0NaLFNBQVUsR0FBRSxFQUFFVSxDQUFDLENBQUM7UUFDeEU7TUFDSjtJQUNKO0VBQ0o7RUFFT0csT0FBT0EsQ0FBQSxFQUFTO0lBQ25CLElBQUksQ0FBQ1gsU0FBUyxHQUFHLEVBQUU7RUFDdkI7QUFDSjtBQUFDWSxPQUFBLENBQUFuQixRQUFBLEdBQUFBLFFBQUEifQ==