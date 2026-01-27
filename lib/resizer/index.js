"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "CollapseDistributor", {
  enumerable: true,
  get: function () {
    return _collapse.default;
  }
});
Object.defineProperty(exports, "FixedDistributor", {
  enumerable: true,
  get: function () {
    return _fixed.default;
  }
});
Object.defineProperty(exports, "PercentageDistributor", {
  enumerable: true,
  get: function () {
    return _percentage.default;
  }
});
Object.defineProperty(exports, "Resizer", {
  enumerable: true,
  get: function () {
    return _resizer.default;
  }
});
var _fixed = _interopRequireDefault(require("./distributors/fixed"));
var _percentage = _interopRequireDefault(require("./distributors/percentage"));
var _collapse = _interopRequireDefault(require("./distributors/collapse"));
var _resizer = _interopRequireDefault(require("./resizer"));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfZml4ZWQiLCJfaW50ZXJvcFJlcXVpcmVEZWZhdWx0IiwicmVxdWlyZSIsIl9wZXJjZW50YWdlIiwiX2NvbGxhcHNlIiwiX3Jlc2l6ZXIiXSwic291cmNlcyI6WyIuLi8uLi9zcmMvcmVzaXplci9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuQ29weXJpZ2h0IDIwMTkgVGhlIE1hdHJpeC5vcmcgRm91bmRhdGlvbiBDLkkuQy5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4qL1xuXG5leHBvcnQgeyBkZWZhdWx0IGFzIEZpeGVkRGlzdHJpYnV0b3IgfSBmcm9tIFwiLi9kaXN0cmlidXRvcnMvZml4ZWRcIjtcbmV4cG9ydCB7IGRlZmF1bHQgYXMgUGVyY2VudGFnZURpc3RyaWJ1dG9yIH0gZnJvbSBcIi4vZGlzdHJpYnV0b3JzL3BlcmNlbnRhZ2VcIjtcbmV4cG9ydCB7IGRlZmF1bHQgYXMgQ29sbGFwc2VEaXN0cmlidXRvciB9IGZyb20gXCIuL2Rpc3RyaWJ1dG9ycy9jb2xsYXBzZVwiO1xuZXhwb3J0IHsgZGVmYXVsdCBhcyBSZXNpemVyIH0gZnJvbSBcIi4vcmVzaXplclwiO1xuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFnQkEsSUFBQUEsTUFBQSxHQUFBQyxzQkFBQSxDQUFBQyxPQUFBO0FBQ0EsSUFBQUMsV0FBQSxHQUFBRixzQkFBQSxDQUFBQyxPQUFBO0FBQ0EsSUFBQUUsU0FBQSxHQUFBSCxzQkFBQSxDQUFBQyxPQUFBO0FBQ0EsSUFBQUcsUUFBQSxHQUFBSixzQkFBQSxDQUFBQyxPQUFBIn0=