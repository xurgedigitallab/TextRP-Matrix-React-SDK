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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfbG9nZ2VyIiwicmVxdWlyZSIsIl9hY3Rpb25DcmVhdG9ycyIsIl9Nb2RhbCIsIl9pbnRlcm9wUmVxdWlyZURlZmF1bHQiLCJSb29tcyIsIl9pbnRlcm9wUmVxdWlyZVdpbGRjYXJkIiwiX2xhbmd1YWdlSGFuZGxlciIsIl9Sb29tTGlzdFN0b3JlIiwiX21vZGVscyIsIl9tb2RlbHMyIiwiX0Vycm9yRGlhbG9nIiwiX2dldFJlcXVpcmVXaWxkY2FyZENhY2hlIiwibm9kZUludGVyb3AiLCJXZWFrTWFwIiwiY2FjaGVCYWJlbEludGVyb3AiLCJjYWNoZU5vZGVJbnRlcm9wIiwib2JqIiwiX19lc01vZHVsZSIsImRlZmF1bHQiLCJjYWNoZSIsImhhcyIsImdldCIsIm5ld09iaiIsImhhc1Byb3BlcnR5RGVzY3JpcHRvciIsIk9iamVjdCIsImRlZmluZVByb3BlcnR5IiwiZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yIiwia2V5IiwicHJvdG90eXBlIiwiaGFzT3duUHJvcGVydHkiLCJjYWxsIiwiZGVzYyIsInNldCIsIlJvb21MaXN0QWN0aW9ucyIsInRhZ1Jvb20iLCJtYXRyaXhDbGllbnQiLCJyb29tIiwib2xkVGFnIiwibmV3VGFnIiwibmV3SW5kZXgiLCJtZXRhRGF0YSIsInN0b3JlIiwiUm9vbUxpc3RTdG9yZSIsImluc3RhbmNlIiwiZ2V0VGFnU29ydGluZyIsIlNvcnRBbGdvcml0aG0iLCJNYW51YWwiLCJuZXdMaXN0Iiwib3JkZXJlZExpc3RzIiwic29ydCIsImEiLCJiIiwidGFncyIsIm9yZGVyIiwiaW5kZXhCZWZvcmUiLCJpbmRleEFmdGVyIiwicHJldk9yZGVyIiwibmV4dE9yZGVyIiwibGVuZ3RoIiwiYXN5bmNBY3Rpb24iLCJwcm9taXNlcyIsInJvb21JZCIsInVuZGVmaW5lZCIsIkRlZmF1bHRUYWdJRCIsIkRNIiwiZ3Vlc3NBbmRTZXRETVJvb20iLCJjYXRjaCIsImVyciIsImxvZ2dlciIsImVycm9yIiwiTW9kYWwiLCJjcmVhdGVEaWFsb2ciLCJFcnJvckRpYWxvZyIsInRpdGxlIiwiX3QiLCJkZXNjcmlwdGlvbiIsIm1lc3NhZ2UiLCJoYXNDaGFuZ2VkU3ViTGlzdHMiLCJwcm9taXNlVG9EZWxldGUiLCJkZWxldGVSb29tVGFnIiwidGFnTmFtZSIsInB1c2giLCJwcm9taXNlVG9BZGQiLCJzZXRSb29tVGFnIiwiUHJvbWlzZSIsImFsbCIsImV4cG9ydHMiXSwic291cmNlcyI6WyIuLi8uLi9zcmMvYWN0aW9ucy9Sb29tTGlzdEFjdGlvbnMudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbkNvcHlyaWdodCAyMDE4IE5ldyBWZWN0b3IgTHRkXG5Db3B5cmlnaHQgMjAyMCBUaGUgTWF0cml4Lm9yZyBGb3VuZGF0aW9uIEMuSS5DLlxuXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiovXG5cbmltcG9ydCB7IE1hdHJpeENsaWVudCB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9jbGllbnRcIjtcbmltcG9ydCB7IFJvb20gfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbW9kZWxzL3Jvb21cIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9sb2dnZXJcIjtcblxuaW1wb3J0IHsgYXN5bmNBY3Rpb24gfSBmcm9tIFwiLi9hY3Rpb25DcmVhdG9yc1wiO1xuaW1wb3J0IE1vZGFsIGZyb20gXCIuLi9Nb2RhbFwiO1xuaW1wb3J0ICogYXMgUm9vbXMgZnJvbSBcIi4uL1Jvb21zXCI7XG5pbXBvcnQgeyBfdCB9IGZyb20gXCIuLi9sYW5ndWFnZUhhbmRsZXJcIjtcbmltcG9ydCB7IEFzeW5jQWN0aW9uUGF5bG9hZCB9IGZyb20gXCIuLi9kaXNwYXRjaGVyL3BheWxvYWRzXCI7XG5pbXBvcnQgUm9vbUxpc3RTdG9yZSBmcm9tIFwiLi4vc3RvcmVzL3Jvb20tbGlzdC9Sb29tTGlzdFN0b3JlXCI7XG5pbXBvcnQgeyBTb3J0QWxnb3JpdGhtIH0gZnJvbSBcIi4uL3N0b3Jlcy9yb29tLWxpc3QvYWxnb3JpdGhtcy9tb2RlbHNcIjtcbmltcG9ydCB7IERlZmF1bHRUYWdJRCwgVGFnSUQgfSBmcm9tIFwiLi4vc3RvcmVzL3Jvb20tbGlzdC9tb2RlbHNcIjtcbmltcG9ydCBFcnJvckRpYWxvZyBmcm9tIFwiLi4vY29tcG9uZW50cy92aWV3cy9kaWFsb2dzL0Vycm9yRGlhbG9nXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFJvb21MaXN0QWN0aW9ucyB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhbiBhY3Rpb24gdGh1bmsgdGhhdCB3aWxsIGRvIGFuIGFzeW5jaHJvbm91cyByZXF1ZXN0IHRvXG4gICAgICogdGFnIHJvb20uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01hdHJpeENsaWVudH0gbWF0cml4Q2xpZW50IHRoZSBtYXRyaXggY2xpZW50IHRvIHNldCB0aGVcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFjY291bnQgZGF0YSBvbi5cbiAgICAgKiBAcGFyYW0ge1Jvb219IHJvb20gdGhlIHJvb20gdG8gdGFnLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBvbGRUYWcgdGhlIHRhZyB0byByZW1vdmUgKHVubGVzcyBvbGRUYWcgPT09PSBuZXdUYWcpXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5ld1RhZyB0aGUgdGFnIHdpdGggd2hpY2ggdG8gdGFnIHRoZSByb29tLlxuICAgICAqIEBwYXJhbSB7P251bWJlcn0gb2xkSW5kZXggdGhlIHByZXZpb3VzIHBvc2l0aW9uIG9mIHRoZSByb29tIGluIHRoZVxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlzdCBvZiByb29tcy5cbiAgICAgKiBAcGFyYW0gez9udW1iZXJ9IG5ld0luZGV4IHRoZSBuZXcgcG9zaXRpb24gb2YgdGhlIHJvb20gaW4gdGhlIGxpc3RcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgIG9mIHJvb21zLlxuICAgICAqIEByZXR1cm5zIHtBc3luY0FjdGlvblBheWxvYWR9IGFuIGFzeW5jIGFjdGlvbiBwYXlsb2FkXG4gICAgICogQHNlZSBhc3luY0FjdGlvblxuICAgICAqL1xuICAgIHB1YmxpYyBzdGF0aWMgdGFnUm9vbShcbiAgICAgICAgbWF0cml4Q2xpZW50OiBNYXRyaXhDbGllbnQsXG4gICAgICAgIHJvb206IFJvb20sXG4gICAgICAgIG9sZFRhZzogVGFnSUQgfCBudWxsLFxuICAgICAgICBuZXdUYWc6IFRhZ0lEIHwgbnVsbCxcbiAgICAgICAgbmV3SW5kZXg6IG51bWJlcixcbiAgICApOiBBc3luY0FjdGlvblBheWxvYWQge1xuICAgICAgICBsZXQgbWV0YURhdGE6IFBhcmFtZXRlcnM8TWF0cml4Q2xpZW50W1wic2V0Um9vbVRhZ1wiXT5bMl0gfCB1bmRlZmluZWQ7XG5cbiAgICAgICAgLy8gSXMgdGhlIHRhZyBvcmRlcmVkIG1hbnVhbGx5P1xuICAgICAgICBjb25zdCBzdG9yZSA9IFJvb21MaXN0U3RvcmUuaW5zdGFuY2U7XG4gICAgICAgIGlmIChuZXdUYWcgJiYgc3RvcmUuZ2V0VGFnU29ydGluZyhuZXdUYWcpID09PSBTb3J0QWxnb3JpdGhtLk1hbnVhbCkge1xuICAgICAgICAgICAgY29uc3QgbmV3TGlzdCA9IFsuLi5zdG9yZS5vcmRlcmVkTGlzdHNbbmV3VGFnXV07XG5cbiAgICAgICAgICAgIG5ld0xpc3Quc29ydCgoYSwgYikgPT4gYS50YWdzW25ld1RhZ10ub3JkZXIgLSBiLnRhZ3NbbmV3VGFnXS5vcmRlcik7XG5cbiAgICAgICAgICAgIGNvbnN0IGluZGV4QmVmb3JlID0gbmV3SW5kZXggLSAxO1xuICAgICAgICAgICAgY29uc3QgaW5kZXhBZnRlciA9IG5ld0luZGV4O1xuXG4gICAgICAgICAgICBjb25zdCBwcmV2T3JkZXIgPSBpbmRleEJlZm9yZSA8PSAwID8gMCA6IG5ld0xpc3RbaW5kZXhCZWZvcmVdLnRhZ3NbbmV3VGFnXS5vcmRlcjtcbiAgICAgICAgICAgIGNvbnN0IG5leHRPcmRlciA9IGluZGV4QWZ0ZXIgPj0gbmV3TGlzdC5sZW5ndGggPyAxIDogbmV3TGlzdFtpbmRleEFmdGVyXS50YWdzW25ld1RhZ10ub3JkZXI7XG5cbiAgICAgICAgICAgIG1ldGFEYXRhID0ge1xuICAgICAgICAgICAgICAgIG9yZGVyOiAocHJldk9yZGVyICsgbmV4dE9yZGVyKSAvIDIuMCxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYXN5bmNBY3Rpb24oXG4gICAgICAgICAgICBcIlJvb21MaXN0QWN0aW9ucy50YWdSb29tXCIsXG4gICAgICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcHJvbWlzZXM6IFByb21pc2U8YW55PltdID0gW107XG4gICAgICAgICAgICAgICAgY29uc3Qgcm9vbUlkID0gcm9vbS5yb29tSWQ7XG5cbiAgICAgICAgICAgICAgICAvLyBFdmlsIGhhY2sgdG8gZ2V0IERNcyBiZWhhdmluZ1xuICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgKG9sZFRhZyA9PT0gdW5kZWZpbmVkICYmIG5ld1RhZyA9PT0gRGVmYXVsdFRhZ0lELkRNKSB8fFxuICAgICAgICAgICAgICAgICAgICAob2xkVGFnID09PSBEZWZhdWx0VGFnSUQuRE0gJiYgbmV3VGFnID09PSB1bmRlZmluZWQpXG4gICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBSb29tcy5ndWVzc0FuZFNldERNUm9vbShyb29tLCBuZXdUYWcgPT09IERlZmF1bHRUYWdJRC5ETSkuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLmVycm9yKFwiRmFpbGVkIHRvIHNldCBETSB0YWcgXCIgKyBlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgTW9kYWwuY3JlYXRlRGlhbG9nKEVycm9yRGlhbG9nLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6IF90KFwiRmFpbGVkIHRvIHNldCBkaXJlY3QgbWVzc2FnZSB0YWdcIiksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGVyciAmJiBlcnIubWVzc2FnZSA/IGVyci5tZXNzYWdlIDogX3QoXCJPcGVyYXRpb24gZmFpbGVkXCIpLFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGhhc0NoYW5nZWRTdWJMaXN0cyA9IG9sZFRhZyAhPT0gbmV3VGFnO1xuXG4gICAgICAgICAgICAgICAgLy8gTW9yZSBldmlsbmVzczogV2Ugd2lsbCBzdGlsbCBiZSBkZWFsaW5nIHdpdGggbW92aW5nIHRvIGZhdm91cml0ZXMvbG93IHByaW8sXG4gICAgICAgICAgICAgICAgLy8gYnV0IHdlIGF2b2lkIGV2ZXIgZG9pbmcgYSByZXF1ZXN0IHdpdGggVEFHX0RNLlxuICAgICAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAgICAgLy8gaWYgd2UgbW92ZWQgbGlzdHMsIHJlbW92ZSB0aGUgb2xkIHRhZ1xuICAgICAgICAgICAgICAgIGlmIChvbGRUYWcgJiYgb2xkVGFnICE9PSBEZWZhdWx0VGFnSUQuRE0gJiYgaGFzQ2hhbmdlZFN1Ykxpc3RzKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHByb21pc2VUb0RlbGV0ZSA9IG1hdHJpeENsaWVudC5kZWxldGVSb29tVGFnKHJvb21JZCwgb2xkVGFnKS5jYXRjaChmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2dnZXIuZXJyb3IoXCJGYWlsZWQgdG8gcmVtb3ZlIHRhZyBcIiArIG9sZFRhZyArIFwiIGZyb20gcm9vbTogXCIgKyBlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgTW9kYWwuY3JlYXRlRGlhbG9nKEVycm9yRGlhbG9nLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6IF90KFwiRmFpbGVkIHRvIHJlbW92ZSB0YWcgJSh0YWdOYW1lKXMgZnJvbSByb29tXCIsIHsgdGFnTmFtZTogb2xkVGFnIH0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBlcnIgJiYgZXJyLm1lc3NhZ2UgPyBlcnIubWVzc2FnZSA6IF90KFwiT3BlcmF0aW9uIGZhaWxlZFwiKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICBwcm9taXNlcy5wdXNoKHByb21pc2VUb0RlbGV0ZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gaWYgd2UgbW92ZWQgbGlzdHMgb3IgdGhlIG9yZGVyaW5nIGNoYW5nZWQsIGFkZCB0aGUgbmV3IHRhZ1xuICAgICAgICAgICAgICAgIGlmIChuZXdUYWcgJiYgbmV3VGFnICE9PSBEZWZhdWx0VGFnSUQuRE0gJiYgKGhhc0NoYW5nZWRTdWJMaXN0cyB8fCBtZXRhRGF0YSkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJvbWlzZVRvQWRkID0gbWF0cml4Q2xpZW50LnNldFJvb21UYWcocm9vbUlkLCBuZXdUYWcsIG1ldGFEYXRhKS5jYXRjaChmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2dnZXIuZXJyb3IoXCJGYWlsZWQgdG8gYWRkIHRhZyBcIiArIG5ld1RhZyArIFwiIHRvIHJvb206IFwiICsgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIE1vZGFsLmNyZWF0ZURpYWxvZyhFcnJvckRpYWxvZywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiBfdChcIkZhaWxlZCB0byBhZGQgdGFnICUodGFnTmFtZSlzIHRvIHJvb21cIiwgeyB0YWdOYW1lOiBuZXdUYWcgfSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGVyciAmJiBlcnIubWVzc2FnZSA/IGVyci5tZXNzYWdlIDogX3QoXCJPcGVyYXRpb24gZmFpbGVkXCIpLFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgcHJvbWlzZXMucHVzaChwcm9taXNlVG9BZGQpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLmFsbChwcm9taXNlcyk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgKCkgPT4ge1xuICAgICAgICAgICAgICAgIC8vIEZvciBhbiBvcHRpbWlzdGljIHVwZGF0ZVxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHJvb20sXG4gICAgICAgICAgICAgICAgICAgIG9sZFRhZyxcbiAgICAgICAgICAgICAgICAgICAgbmV3VGFnLFxuICAgICAgICAgICAgICAgICAgICBtZXRhRGF0YSxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSxcbiAgICAgICAgKTtcbiAgICB9XG59XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFtQkEsSUFBQUEsT0FBQSxHQUFBQyxPQUFBO0FBRUEsSUFBQUMsZUFBQSxHQUFBRCxPQUFBO0FBQ0EsSUFBQUUsTUFBQSxHQUFBQyxzQkFBQSxDQUFBSCxPQUFBO0FBQ0EsSUFBQUksS0FBQSxHQUFBQyx1QkFBQSxDQUFBTCxPQUFBO0FBQ0EsSUFBQU0sZ0JBQUEsR0FBQU4sT0FBQTtBQUVBLElBQUFPLGNBQUEsR0FBQUosc0JBQUEsQ0FBQUgsT0FBQTtBQUNBLElBQUFRLE9BQUEsR0FBQVIsT0FBQTtBQUNBLElBQUFTLFFBQUEsR0FBQVQsT0FBQTtBQUNBLElBQUFVLFlBQUEsR0FBQVAsc0JBQUEsQ0FBQUgsT0FBQTtBQUFrRSxTQUFBVyx5QkFBQUMsV0FBQSxlQUFBQyxPQUFBLGtDQUFBQyxpQkFBQSxPQUFBRCxPQUFBLFFBQUFFLGdCQUFBLE9BQUFGLE9BQUEsWUFBQUYsd0JBQUEsWUFBQUEsQ0FBQUMsV0FBQSxXQUFBQSxXQUFBLEdBQUFHLGdCQUFBLEdBQUFELGlCQUFBLEtBQUFGLFdBQUE7QUFBQSxTQUFBUCx3QkFBQVcsR0FBQSxFQUFBSixXQUFBLFNBQUFBLFdBQUEsSUFBQUksR0FBQSxJQUFBQSxHQUFBLENBQUFDLFVBQUEsV0FBQUQsR0FBQSxRQUFBQSxHQUFBLG9CQUFBQSxHQUFBLHdCQUFBQSxHQUFBLDRCQUFBRSxPQUFBLEVBQUFGLEdBQUEsVUFBQUcsS0FBQSxHQUFBUix3QkFBQSxDQUFBQyxXQUFBLE9BQUFPLEtBQUEsSUFBQUEsS0FBQSxDQUFBQyxHQUFBLENBQUFKLEdBQUEsWUFBQUcsS0FBQSxDQUFBRSxHQUFBLENBQUFMLEdBQUEsU0FBQU0sTUFBQSxXQUFBQyxxQkFB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