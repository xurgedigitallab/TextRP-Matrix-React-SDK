"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var _duration = require("./duration");
Object.keys(_duration).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (key in exports && exports[key] === _duration[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _duration[key];
    }
  });
});
var _geolocation = require("./geolocation");
Object.keys(_geolocation).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (key in exports && exports[key] === _geolocation[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _geolocation[key];
    }
  });
});
var _useBeacon = require("./useBeacon");
Object.keys(_useBeacon).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (key in exports && exports[key] === _useBeacon[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _useBeacon[key];
    }
  });
});
var _useOwnLiveBeacons = require("./useOwnLiveBeacons");
Object.keys(_useOwnLiveBeacons).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (key in exports && exports[key] === _useOwnLiveBeacons[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _useOwnLiveBeacons[key];
    }
  });
});
//# sourceMappingURL=index.js.map