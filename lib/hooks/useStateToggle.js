"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useStateToggle = void 0;
var _react = require("react");
/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

// Hook to simplify toggling of a boolean state value
// Returns value, method to toggle boolean value and method to set the boolean value
const useStateToggle = function () {
  let initialValue = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
  const [value, setValue] = (0, _react.useState)(initialValue);
  const toggleValue = () => {
    setValue(!value);
  };
  return [value, toggleValue, setValue];
};
exports.useStateToggle = useStateToggle;
//# sourceMappingURL=useStateToggle.js.map