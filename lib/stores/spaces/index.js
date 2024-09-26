"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getMetaSpaceName = exports.UPDATE_TOP_LEVEL_SPACES = exports.UPDATE_SUGGESTED_ROOMS = exports.UPDATE_SELECTED_SPACE = exports.UPDATE_INVITED_SPACES = exports.UPDATE_HOME_BEHAVIOUR = exports.MetaSpace = void 0;
exports.isMetaSpace = isMetaSpace;
var _languageHandler = require("../../languageHandler");
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

// The consts & types are moved out here to prevent cyclical imports

const UPDATE_TOP_LEVEL_SPACES = Symbol("top-level-spaces");
exports.UPDATE_TOP_LEVEL_SPACES = UPDATE_TOP_LEVEL_SPACES;
const UPDATE_INVITED_SPACES = Symbol("invited-spaces");
exports.UPDATE_INVITED_SPACES = UPDATE_INVITED_SPACES;
const UPDATE_SELECTED_SPACE = Symbol("selected-space");
exports.UPDATE_SELECTED_SPACE = UPDATE_SELECTED_SPACE;
const UPDATE_HOME_BEHAVIOUR = Symbol("home-behaviour");
exports.UPDATE_HOME_BEHAVIOUR = UPDATE_HOME_BEHAVIOUR;
const UPDATE_SUGGESTED_ROOMS = Symbol("suggested-rooms");
// Space Key will be emitted when a Space's children change
exports.UPDATE_SUGGESTED_ROOMS = UPDATE_SUGGESTED_ROOMS;
let MetaSpace = /*#__PURE__*/function (MetaSpace) {
  MetaSpace["Home"] = "home-space";
  MetaSpace["Favourites"] = "favourites-space";
  MetaSpace["People"] = "people-space";
  MetaSpace["Orphans"] = "orphans-space";
  return MetaSpace;
}({});
exports.MetaSpace = MetaSpace;
const getMetaSpaceName = function (spaceKey) {
  let allRoomsInHome = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
  switch (spaceKey) {
    case MetaSpace.Home:
      return allRoomsInHome ? (0, _languageHandler._t)("All rooms") : (0, _languageHandler._t)("Home");
    case MetaSpace.Favourites:
      return (0, _languageHandler._t)("Favourites");
    case MetaSpace.People:
      return (0, _languageHandler._t)("People");
    case MetaSpace.Orphans:
      return (0, _languageHandler._t)("Other rooms");
  }
};
exports.getMetaSpaceName = getMetaSpaceName;
function isMetaSpace(spaceKey) {
  return spaceKey === MetaSpace.Home || spaceKey === MetaSpace.Favourites || spaceKey === MetaSpace.People || spaceKey === MetaSpace.Orphans;
}
//# sourceMappingURL=index.js.map