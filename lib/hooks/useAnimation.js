"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useAnimation = useAnimation;
var _logger = require("matrix-js-sdk/src/logger");
var _react = require("react");
var _SettingsStore = _interopRequireDefault(require("../settings/SettingsStore"));
/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

const debuglog = function () {
  if (_SettingsStore.default.getValue("debug_animation")) {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    _logger.logger.log.call(console, "Animation debuglog:", ...args);
  }
};
function useAnimation(enabled, callback) {
  const handle = (0, _react.useRef)(null);
  const handler = (0, _react.useCallback)(timestamp => {
    if (callback(timestamp)) {
      handle.current = requestAnimationFrame(handler);
    } else {
      debuglog("Finished animation!");
    }
  }, [callback]);
  (0, _react.useEffect)(() => {
    debuglog("Started animation!");
    if (enabled) {
      handle.current = requestAnimationFrame(handler);
    }
    return () => {
      if (handle.current) {
        debuglog("Aborted animation!");
        cancelAnimationFrame(handle.current);
        handle.current = null;
      }
    };
  }, [enabled, handler]);
}
//# sourceMappingURL=useAnimation.js.map