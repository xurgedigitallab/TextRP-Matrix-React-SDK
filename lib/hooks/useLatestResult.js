"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useLatestResult = void 0;
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
 * Hook to prevent a slower response to an earlier query overwriting the result to a faster response of a later query
 * @param onResultChanged
 */
const useLatestResult = onResultChanged => {
  const ref = (0, _react.useRef)(null);
  const setQuery = (0, _react.useCallback)(query => {
    ref.current = query;
  }, []);
  const setResult = (0, _react.useCallback)((query, result) => {
    if (ref.current === query) {
      onResultChanged(result);
    }
  }, [onResultChanged]);
  return [setQuery, setResult];
};
exports.useLatestResult = useLatestResult;
//# sourceMappingURL=useLatestResult.js.map