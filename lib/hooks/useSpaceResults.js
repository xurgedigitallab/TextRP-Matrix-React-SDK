"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useSpaceResults = void 0;
var _react = require("react");
var _matrix = require("matrix-js-sdk/src/matrix");
var _roomHierarchy = require("matrix-js-sdk/src/room-hierarchy");
var _utils = require("matrix-js-sdk/src/utils");
var _MatrixClientPeg = require("../MatrixClientPeg");
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

const useSpaceResults = (space, query) => {
  const [rooms, setRooms] = (0, _react.useState)([]);
  const [hierarchy, setHierarchy] = (0, _react.useState)();
  const resetHierarchy = (0, _react.useCallback)(() => {
    setHierarchy(space ? new _roomHierarchy.RoomHierarchy(space, 50) : undefined);
  }, [space]);
  (0, _react.useEffect)(resetHierarchy, [resetHierarchy]);
  (0, _react.useEffect)(() => {
    if (!space || !hierarchy) return; // nothing to load

    let unmounted = false;
    (async () => {
      while (hierarchy?.canLoadMore && !unmounted && space === hierarchy.root) {
        await hierarchy.load();
        if (hierarchy.canLoadMore) hierarchy.load(); // start next load so that the loading attribute is right
        setRooms(hierarchy.rooms);
      }
    })();
    return () => {
      unmounted = true;
    };
  }, [space, hierarchy]);
  const results = (0, _react.useMemo)(() => {
    const trimmedQuery = query.trim();
    const lcQuery = trimmedQuery.toLowerCase();
    const normalizedQuery = (0, _utils.normalize)(trimmedQuery);
    const cli = _MatrixClientPeg.MatrixClientPeg.get();
    return rooms?.filter(r => {
      return r.room_type !== _matrix.RoomType.Space && cli.getRoom(r.room_id)?.getMyMembership() !== "join" && ((0, _utils.normalize)(r.name || "").includes(normalizedQuery) || (r.canonical_alias || "").includes(lcQuery));
    });
  }, [rooms, query]);
  return [results, hierarchy?.loading ?? false];
};
exports.useSpaceResults = useSpaceResults;
//# sourceMappingURL=useSpaceResults.js.map