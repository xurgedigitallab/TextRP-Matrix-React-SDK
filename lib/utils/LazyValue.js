"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.LazyValue = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
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

/**
 * Utility class for lazily getting a variable.
 */
class LazyValue {
  constructor(getFn) {
    this.getFn = getFn;
    (0, _defineProperty2.default)(this, "val", void 0);
    (0, _defineProperty2.default)(this, "prom", void 0);
    (0, _defineProperty2.default)(this, "done", false);
  }

  /**
   * Whether or not a cached value is present.
   */
  get present() {
    // we use a tracking variable just in case the final value is falsy
    return this.done;
  }

  /**
   * Gets the value without invoking a get. May be undefined until the
   * value is fetched properly.
   */
  get cachedValue() {
    return this.val;
  }

  /**
   * Gets a promise which resolves to the value, eventually.
   */
  get value() {
    if (this.prom) return this.prom;
    this.prom = this.getFn();
    return this.prom.then(v => {
      this.val = v;
      this.done = true;
      return v;
    });
  }
}
exports.LazyValue = LazyValue;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJMYXp5VmFsdWUiLCJjb25zdHJ1Y3RvciIsImdldEZuIiwiX2RlZmluZVByb3BlcnR5MiIsImRlZmF1bHQiLCJwcmVzZW50IiwiZG9uZSIsImNhY2hlZFZhbHVlIiwidmFsIiwidmFsdWUiLCJwcm9tIiwidGhlbiIsInYiLCJleHBvcnRzIl0sInNvdXJjZXMiOlsiLi4vLi4vc3JjL3V0aWxzL0xhenlWYWx1ZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuQ29weXJpZ2h0IDIwMjEgVGhlIE1hdHJpeC5vcmcgRm91bmRhdGlvbiBDLkkuQy5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4qL1xuXG4vKipcbiAqIFV0aWxpdHkgY2xhc3MgZm9yIGxhemlseSBnZXR0aW5nIGEgdmFyaWFibGUuXG4gKi9cbmV4cG9ydCBjbGFzcyBMYXp5VmFsdWU8VD4ge1xuICAgIHByaXZhdGUgdmFsPzogVDtcbiAgICBwcml2YXRlIHByb20/OiBQcm9taXNlPFQ+O1xuICAgIHByaXZhdGUgZG9uZSA9IGZhbHNlO1xuXG4gICAgcHVibGljIGNvbnN0cnVjdG9yKHByaXZhdGUgZ2V0Rm46ICgpID0+IFByb21pc2U8VD4pIHt9XG5cbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIG9yIG5vdCBhIGNhY2hlZCB2YWx1ZSBpcyBwcmVzZW50LlxuICAgICAqL1xuICAgIHB1YmxpYyBnZXQgcHJlc2VudCgpOiBib29sZWFuIHtcbiAgICAgICAgLy8gd2UgdXNlIGEgdHJhY2tpbmcgdmFyaWFibGUganVzdCBpbiBjYXNlIHRoZSBmaW5hbCB2YWx1ZSBpcyBmYWxzeVxuICAgICAgICByZXR1cm4gdGhpcy5kb25lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHZhbHVlIHdpdGhvdXQgaW52b2tpbmcgYSBnZXQuIE1heSBiZSB1bmRlZmluZWQgdW50aWwgdGhlXG4gICAgICogdmFsdWUgaXMgZmV0Y2hlZCBwcm9wZXJseS5cbiAgICAgKi9cbiAgICBwdWJsaWMgZ2V0IGNhY2hlZFZhbHVlKCk6IFQgfCB1bmRlZmluZWQge1xuICAgICAgICByZXR1cm4gdGhpcy52YWw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyBhIHByb21pc2Ugd2hpY2ggcmVzb2x2ZXMgdG8gdGhlIHZhbHVlLCBldmVudHVhbGx5LlxuICAgICAqL1xuICAgIHB1YmxpYyBnZXQgdmFsdWUoKTogUHJvbWlzZTxUPiB7XG4gICAgICAgIGlmICh0aGlzLnByb20pIHJldHVybiB0aGlzLnByb207XG4gICAgICAgIHRoaXMucHJvbSA9IHRoaXMuZ2V0Rm4oKTtcblxuICAgICAgICByZXR1cm4gdGhpcy5wcm9tLnRoZW4oKHYpID0+IHtcbiAgICAgICAgICAgIHRoaXMudmFsID0gdjtcbiAgICAgICAgICAgIHRoaXMuZG9uZSA9IHRydWU7XG4gICAgICAgICAgICByZXR1cm4gdjtcbiAgICAgICAgfSk7XG4gICAgfVxufVxuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQSxTQUFTLENBQUk7RUFLZkMsV0FBV0EsQ0FBU0MsS0FBdUIsRUFBRTtJQUFBLEtBQXpCQSxLQUF1QixHQUF2QkEsS0FBdUI7SUFBQSxJQUFBQyxnQkFBQSxDQUFBQyxPQUFBO0lBQUEsSUFBQUQsZ0JBQUEsQ0FBQUMsT0FBQTtJQUFBLElBQUFELGdCQUFBLENBQUFDLE9BQUEsZ0JBRm5DLEtBQUs7RUFFaUM7O0VBRXJEO0FBQ0o7QUFDQTtFQUNJLElBQVdDLE9BQU9BLENBQUEsRUFBWTtJQUMxQjtJQUNBLE9BQU8sSUFBSSxDQUFDQyxJQUFJO0VBQ3BCOztFQUVBO0FBQ0o7QUFDQTtBQUNBO0VBQ0ksSUFBV0MsV0FBV0EsQ0FBQSxFQUFrQjtJQUNwQyxPQUFPLElBQUksQ0FBQ0MsR0FBRztFQUNuQjs7RUFFQTtBQUNKO0FBQ0E7RUFDSSxJQUFXQyxLQUFLQSxDQUFBLEVBQWU7SUFDM0IsSUFBSSxJQUFJLENBQUNDLElBQUksRUFBRSxPQUFPLElBQUksQ0FBQ0EsSUFBSTtJQUMvQixJQUFJLENBQUNBLElBQUksR0FBRyxJQUFJLENBQUNSLEtBQUssQ0FBQyxDQUFDO0lBRXhCLE9BQU8sSUFBSSxDQUFDUSxJQUFJLENBQUNDLElBQUksQ0FBRUMsQ0FBQyxJQUFLO01BQ3pCLElBQUksQ0FBQ0osR0FBRyxHQUFHSSxDQUFDO01BQ1osSUFBSSxDQUFDTixJQUFJLEdBQUcsSUFBSTtNQUNoQixPQUFPTSxDQUFDO0lBQ1osQ0FBQyxDQUFDO0VBQ047QUFDSjtBQUFDQyxPQUFBLENBQUFiLFNBQUEsR0FBQUEsU0FBQSJ9