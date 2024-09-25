"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useLocalStorageState = void 0;
var _react = require("react");
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

const getValue = (key, initialValue) => {
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : initialValue;
  } catch (error) {
    return initialValue;
  }
};

// Hook behaving like useState but persisting the value to localStorage. Returns same as useState
const useLocalStorageState = (key, initialValue) => {
  const lsKey = "mx_" + key;
  const [value, setValue] = (0, _react.useState)(getValue(lsKey, initialValue));
  (0, _react.useEffect)(() => {
    setValue(getValue(lsKey, initialValue));
  }, [lsKey, initialValue]);
  const _setValue = (0, _react.useCallback)(v => {
    window.localStorage.setItem(lsKey, JSON.stringify(v));
    setValue(v);
  }, [lsKey]);
  return [value, _setValue];
};
exports.useLocalStorageState = useLocalStorageState;
//# sourceMappingURL=useLocalStorageState.js.map