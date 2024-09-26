"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getFunctionalMembers = void 0;
var _matrix = require("matrix-js-sdk/src/matrix");
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

const getFunctionalMembers = room => {
  const [functionalUsersStateEvent] = room.currentState.getStateEvents(_matrix.UNSTABLE_ELEMENT_FUNCTIONAL_USERS.name);
  if (Array.isArray(functionalUsersStateEvent?.getContent().service_members)) {
    return functionalUsersStateEvent.getContent().service_members;
  }
  return [];
};
exports.getFunctionalMembers = getFunctionalMembers;
//# sourceMappingURL=getFunctionalMembers.js.map