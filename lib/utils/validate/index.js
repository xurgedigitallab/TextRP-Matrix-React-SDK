"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var _numberInRange = require("./numberInRange");
Object.keys(_numberInRange).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (key in exports && exports[key] === _numberInRange[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _numberInRange[key];
    }
  });
});
//# sourceMappingURL=index.js.map