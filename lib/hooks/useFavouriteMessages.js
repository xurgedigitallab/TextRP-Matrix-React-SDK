"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = useFavouriteMessages;
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

const favouriteMessageIds = JSON.parse(localStorage?.getItem("io_element_favouriteMessages") ?? "[]");
function useFavouriteMessages() {
  const [, setX] = (0, _react.useState)();

  //checks if an id already exist
  const isFavourite = eventId => favouriteMessageIds.includes(eventId);
  const toggleFavourite = eventId => {
    isFavourite(eventId) ? favouriteMessageIds.splice(favouriteMessageIds.indexOf(eventId), 1) : favouriteMessageIds.push(eventId);

    //update the local storage
    localStorage.setItem("io_element_favouriteMessages", JSON.stringify(favouriteMessageIds));

    // This forces a re-render to account for changes in appearance in real-time when the favourite button is toggled
    setX([]);
  };
  return {
    isFavourite,
    toggleFavourite
  };
}
//# sourceMappingURL=useFavouriteMessages.js.map