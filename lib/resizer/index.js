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
//# sourceMappingURL=index.js.map