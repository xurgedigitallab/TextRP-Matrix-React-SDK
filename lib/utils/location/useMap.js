"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useMap = void 0;
var _react = require("react");
var _map = require("./map");
var _MatrixClientContext = require("../../contexts/MatrixClientContext");
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
 * Create a map instance
 * Add listeners for errors
 * Make sure `onError` has a stable reference
 * As map is recreated on changes to it
 */
const useMap = _ref => {
  let {
    interactive,
    bodyId,
    onError
  } = _ref;
  const cli = (0, _MatrixClientContext.useMatrixClientContext)();
  const [map, setMap] = (0, _react.useState)();
  (0, _react.useEffect)(() => {
    try {
      setMap((0, _map.createMap)(cli, !!interactive, bodyId, onError));
    } catch (error) {
      onError?.(error);
    }
    return () => {
      if (map) {
        map.remove();
        setMap(undefined);
      }
    };
  },
  // map is excluded as a dependency
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [interactive, bodyId, onError]);
  return map;
};
exports.useMap = useMap;
//# sourceMappingURL=useMap.js.map