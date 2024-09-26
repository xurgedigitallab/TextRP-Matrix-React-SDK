"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useSlidingSyncRoomSearch = void 0;
var _react = require("react");
var _MatrixClientPeg = require("../MatrixClientPeg");
var _useLatestResult = require("./useLatestResult");
var _SlidingSyncManager = require("../SlidingSyncManager");
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

const useSlidingSyncRoomSearch = () => {
  const [rooms, setRooms] = (0, _react.useState)([]);
  const [loading, setLoading] = (0, _react.useState)(false);
  const [updateQuery, updateResult] = (0, _useLatestResult.useLatestResult)(setRooms);
  const search = (0, _react.useCallback)(async _ref => {
    let {
      limit = 100,
      query: term
    } = _ref;
    const opts = {
      limit,
      term
    };
    updateQuery(opts);
    if (!term?.length) {
      setRooms([]);
      return true;
    }
    try {
      setLoading(true);
      await _SlidingSyncManager.SlidingSyncManager.instance.ensureListRegistered(_SlidingSyncManager.SlidingSyncManager.ListSearch, {
        ranges: [[0, limit]],
        filters: {
          room_name_like: term
        }
      });
      const rooms = [];
      const {
        roomIndexToRoomId
      } = _SlidingSyncManager.SlidingSyncManager.instance.slidingSync.getListData(_SlidingSyncManager.SlidingSyncManager.ListSearch);
      let i = 0;
      while (roomIndexToRoomId[i]) {
        const roomId = roomIndexToRoomId[i];
        const room = _MatrixClientPeg.MatrixClientPeg.get().getRoom(roomId);
        if (room) {
          rooms.push(room);
        }
        i++;
      }
      updateResult(opts, rooms);
      return true;
    } catch (e) {
      console.error("Could not fetch sliding sync rooms for params", {
        limit,
        term
      }, e);
      updateResult(opts, []);
      return false;
    } finally {
      setLoading(false);
      // TODO: delete the list?
    }
  }, [updateQuery, updateResult]);
  return {
    loading,
    rooms,
    search
  };
};
exports.useSlidingSyncRoomSearch = useSlidingSyncRoomSearch;
//# sourceMappingURL=useSlidingSyncRoomSearch.js.map