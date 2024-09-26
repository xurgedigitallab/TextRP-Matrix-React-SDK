"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useDebouncedCallback = useDebouncedCallback;
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

const DEBOUNCE_TIMEOUT = 100;
function useDebouncedCallback(enabled, callback, params) {
  (0, _react.useEffect)(() => {
    let handle = null;
    const doSearch = () => {
      handle = null;
      callback(...params);
    };
    if (enabled !== false) {
      handle = window.setTimeout(doSearch, DEBOUNCE_TIMEOUT);
      return () => {
        if (handle) {
          clearTimeout(handle);
        }
      };
    }
  }, [enabled, callback, params]);
}
//# sourceMappingURL=useDebouncedCallback.js.map