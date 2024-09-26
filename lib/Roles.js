"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.levelRoleMap = levelRoleMap;
exports.textualPowerLevel = textualPowerLevel;
var _languageHandler = require("./languageHandler");
/*
Copyright 2017 Vector Creations Ltd

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

function levelRoleMap(usersDefault) {
  return {
    undefined: (0, _languageHandler._t)("Default"),
    0: (0, _languageHandler._t)("Restricted"),
    [usersDefault]: (0, _languageHandler._t)("Default"),
    50: (0, _languageHandler._t)("Moderator"),
    100: (0, _languageHandler._t)("Admin")
  };
}
function textualPowerLevel(level, usersDefault) {
  const LEVEL_ROLE_MAP = levelRoleMap(usersDefault);
  if (LEVEL_ROLE_MAP[level]) {
    return LEVEL_ROLE_MAP[level];
  } else {
    return (0, _languageHandler._t)("Custom (%(level)s)", {
      level
    });
  }
}
//# sourceMappingURL=Roles.js.map