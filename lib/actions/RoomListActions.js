"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _logger = require("matrix-js-sdk/src/logger");
var _actionCreators = require("./actionCreators");
var _Modal = _interopRequireDefault(require("../Modal"));
var Rooms = _interopRequireWildcard(require("../Rooms"));
var _languageHandler = require("../languageHandler");
var _RoomListStore = _interopRequireDefault(require("../stores/room-list/RoomListStore"));
var _models = require("../stores/room-list/algorithms/models");
var _models2 = require("../stores/room-list/models");
var _ErrorDialog = _interopRequireDefault(require("../components/views/dialogs/ErrorDialog"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
/*
Copyright 2018 New Vector Ltd
Copyright 2020 The Matrix.org Foundation C.I.C.

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

class RoomListActions {
  /**
   * Creates an action thunk that will do an asynchronous request to
   * tag room.
   *
   * @param {MatrixClient} matrixClient the matrix client to set the
   *                                    account data on.
   * @param {Room} room the room to tag.
   * @param {string} oldTag the tag to remove (unless oldTag ==== newTag)
   * @param {string} newTag the tag with which to tag the room.
   * @param {?number} oldIndex the previous position of the room in the
   *                           list of rooms.
   * @param {?number} newIndex the new position of the room in the list
   *                           of rooms.
   * @returns {AsyncActionPayload} an async action payload
   * @see asyncAction
   */
  static tagRoom(matrixClient, room, oldTag, newTag, newIndex) {
    let metaData;

    // Is the tag ordered manually?
    const store = _RoomListStore.default.instance;
    if (newTag && store.getTagSorting(newTag) === _models.SortAlgorithm.Manual) {
      const newList = [...store.orderedLists[newTag]];
      newList.sort((a, b) => a.tags[newTag].order - b.tags[newTag].order);
      const indexBefore = newIndex - 1;
      const indexAfter = newIndex;
      const prevOrder = indexBefore <= 0 ? 0 : newList[indexBefore].tags[newTag].order;
      const nextOrder = indexAfter >= newList.length ? 1 : newList[indexAfter].tags[newTag].order;
      metaData = {
        order: (prevOrder + nextOrder) / 2.0
      };
    }
    return (0, _actionCreators.asyncAction)("RoomListActions.tagRoom", () => {
      const promises = [];
      const roomId = room.roomId;

      // Evil hack to get DMs behaving
      if (oldTag === undefined && newTag === _models2.DefaultTagID.DM || oldTag === _models2.DefaultTagID.DM && newTag === undefined) {
        return Rooms.guessAndSetDMRoom(room, newTag === _models2.DefaultTagID.DM).catch(err => {
          _logger.logger.error("Failed to set DM tag " + err);
          _Modal.default.createDialog(_ErrorDialog.default, {
            title: (0, _languageHandler._t)("Failed to set direct message tag"),
            description: err && err.message ? err.message : (0, _languageHandler._t)("Operation failed")
          });
        });
      }
      const hasChangedSubLists = oldTag !== newTag;

      // More evilness: We will still be dealing with moving to favourites/low prio,
      // but we avoid ever doing a request with TAG_DM.
      //
      // if we moved lists, remove the old tag
      if (oldTag && oldTag !== _models2.DefaultTagID.DM && hasChangedSubLists) {
        const promiseToDelete = matrixClient.deleteRoomTag(roomId, oldTag).catch(function (err) {
          _logger.logger.error("Failed to remove tag " + oldTag + " from room: " + err);
          _Modal.default.createDialog(_ErrorDialog.default, {
            title: (0, _languageHandler._t)("Failed to remove tag %(tagName)s from room", {
              tagName: oldTag
            }),
            description: err && err.message ? err.message : (0, _languageHandler._t)("Operation failed")
          });
        });
        promises.push(promiseToDelete);
      }

      // if we moved lists or the ordering changed, add the new tag
      if (newTag && newTag !== _models2.DefaultTagID.DM && (hasChangedSubLists || metaData)) {
        const promiseToAdd = matrixClient.setRoomTag(roomId, newTag, metaData).catch(function (err) {
          _logger.logger.error("Failed to add tag " + newTag + " to room: " + err);
          _Modal.default.createDialog(_ErrorDialog.default, {
            title: (0, _languageHandler._t)("Failed to add tag %(tagName)s to room", {
              tagName: newTag
            }),
            description: err && err.message ? err.message : (0, _languageHandler._t)("Operation failed")
          });
          throw err;
        });
        promises.push(promiseToAdd);
      }
      return Promise.all(promises);
    }, () => {
      // For an optimistic update
      return {
        room,
        oldTag,
        newTag,
        metaData
      };
    });
  }
}
exports.default = RoomListActions;
//# sourceMappingURL=RoomListActions.js.map