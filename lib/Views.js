"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
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
/** constants for MatrixChat.state.view */
var Views = /*#__PURE__*/function (Views) {
  Views[Views["LOADING"] = 0] = "LOADING";
  Views[Views["WELCOME"] = 1] = "WELCOME";
  Views[Views["LOGIN"] = 2] = "LOGIN";
  Views[Views["REGISTER"] = 3] = "REGISTER";
  Views[Views["FORGOT_PASSWORD"] = 4] = "FORGOT_PASSWORD";
  Views[Views["COMPLETE_SECURITY"] = 5] = "COMPLETE_SECURITY";
  Views[Views["E2E_SETUP"] = 6] = "E2E_SETUP";
  Views[Views["USE_CASE_SELECTION"] = 7] = "USE_CASE_SELECTION";
  Views[Views["LOGGED_IN"] = 8] = "LOGGED_IN";
  Views[Views["SOFT_LOGOUT"] = 9] = "SOFT_LOGOUT";
  return Views;
}(Views || {});
var _default = Views;
exports.default = _default;
//# sourceMappingURL=Views.js.map