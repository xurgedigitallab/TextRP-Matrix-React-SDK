"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.privateShouldBeEncrypted = privateShouldBeEncrypted;
var _WellKnownUtils = require("./WellKnownUtils");
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

function privateShouldBeEncrypted(client) {
  const e2eeWellKnown = (0, _WellKnownUtils.getE2EEWellKnown)(client);
  if (e2eeWellKnown) {
    const defaultDisabled = e2eeWellKnown["default"] === false;
    return !defaultDisabled;
  }
  return true;
}
//# sourceMappingURL=rooms.js.map