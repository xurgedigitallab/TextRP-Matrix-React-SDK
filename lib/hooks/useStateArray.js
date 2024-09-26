"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useStateArray = void 0;
var _react = require("react");
/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

// Hook to simplify managing state of arrays of a common type
const useStateArray = (initialSize, initialState) => {
  const [data, setData] = (0, _react.useState)(() => {
    return Array.isArray(initialState) ? initialState : new Array(initialSize).fill(initialState);
  });
  return [data, (index, value) => setData(data => {
    const copy = [...data];
    copy[index] = value;
    return copy;
  })];
};
exports.useStateArray = useStateArray;
//# sourceMappingURL=useStateArray.js.map