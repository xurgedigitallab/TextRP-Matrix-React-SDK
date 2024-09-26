"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useTimeoutToggle = void 0;
var _react = require("react");
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

/**
 * Hook that allows toggling a boolean value and resets it after a timeout.
 *
 * @param {boolean} defaultValue Default value
 * @param {number} timeoutMs Time after that the value will be reset
 */
const useTimeoutToggle = (defaultValue, timeoutMs) => {
  const timeoutId = (0, _react.useRef)();
  const [value, setValue] = (0, _react.useState)(defaultValue);
  const toggle = () => {
    setValue(!defaultValue);
    timeoutId.current = window.setTimeout(() => setValue(defaultValue), timeoutMs);
  };
  (0, _react.useEffect)(() => {
    return () => {
      clearTimeout(timeoutId.current);
    };
  });
  return {
    toggle,
    value
  };
};
exports.useTimeoutToggle = useTimeoutToggle;
//# sourceMappingURL=useTimeoutToggle.js.map