"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.doMaybeLocalRoomAction = doMaybeLocalRoomAction;
exports.waitForRoomReadyAndApplyAfterCreateCallbacks = waitForRoomReadyAndApplyAfterCreateCallbacks;
var _logger = require("matrix-js-sdk/src/logger");
var _matrix = require("matrix-js-sdk/src/matrix");
var _dispatcher = _interopRequireDefault(require("../dispatcher/dispatcher"));
var _LocalRoom = require("../models/LocalRoom");
var _isLocalRoom = require("./localRoom/isLocalRoom");
var _isRoomReady = require("./localRoom/isRoomReady");
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

const isActualRoomIdDefined = actualRoomId => {
  if (actualRoomId === undefined) {
    // should not happen
    throw new Error("Local room in CREATED state without actual room Id occurred");
  }
  return true;
};

/**
 * Does a room action:
 * For non-local rooms it calls fn directly.
 * For local rooms it adds the callback function to the room's afterCreateCallbacks and
 * dispatches a "local_room_event".
 *
 * @async
 * @template T
 * @param {string} roomId Room ID of the target room
 * @param {(actualRoomId: string) => Promise<T>} fn Callback to be called directly or collected at the local room
 * @param {MatrixClient} [client]
 * @returns {Promise<T>} Promise that gets resolved after the callback has finished
 */
async function doMaybeLocalRoomAction(roomId, fn, client) {
  if ((0, _isLocalRoom.isLocalRoom)(roomId)) {
    const room = client.getRoom(roomId);
    if (room.isCreated && isActualRoomIdDefined(room.actualRoomId)) {
      return fn(room.actualRoomId);
    }
    return new Promise((resolve, reject) => {
      room.afterCreateCallbacks.push(newRoomId => {
        fn(newRoomId).then(resolve).catch(reject);
      });
      _dispatcher.default.dispatch({
        action: "local_room_event",
        roomId: room.roomId
      });
    });
  }
  return fn(roomId);
}

/**
 * Waits until a room is ready and then applies the after-create local room callbacks.
 * Also implements a stopgap timeout after that a room is assumed to be ready.
 *
 * @see isRoomReady
 * @async
 * @param {MatrixClient} client
 * @param {LocalRoom} localRoom
 * @param actualRoomId Id of the actual room
 * @returns {Promise<string>} Resolved to the actual room id
 */
async function waitForRoomReadyAndApplyAfterCreateCallbacks(client, localRoom, actualRoomId) {
  if ((0, _isRoomReady.isRoomReady)(client, localRoom)) {
    return applyAfterCreateCallbacks(localRoom, actualRoomId).then(() => {
      localRoom.state = _LocalRoom.LocalRoomState.CREATED;
      client.emit(_matrix.ClientEvent.Room, localRoom);
      return Promise.resolve(actualRoomId);
    });
  }
  return new Promise((resolve, reject) => {
    const finish = () => {
      if (checkRoomStateIntervalHandle) clearInterval(checkRoomStateIntervalHandle);
      if (stopgapTimeoutHandle) clearTimeout(stopgapTimeoutHandle);
      applyAfterCreateCallbacks(localRoom, actualRoomId).then(() => {
        localRoom.state = _LocalRoom.LocalRoomState.CREATED;
        client.emit(_matrix.ClientEvent.Room, localRoom);
        resolve(actualRoomId);
      }).catch(err => {
        reject(err);
      });
    };
    const stopgapFinish = () => {
      _logger.logger.warn(`Assuming local room ${localRoom.roomId} is ready after hitting timeout`);
      finish();
    };
    const checkRoomStateIntervalHandle = window.setInterval(() => {
      if ((0, _isRoomReady.isRoomReady)(client, localRoom)) finish();
    }, 500);
    const stopgapTimeoutHandle = window.setTimeout(stopgapFinish, 5000);
  });
}

/**
 * Applies the after-create callback of a local room.
 *
 * @async
 * @param {LocalRoom} localRoom
 * @param {string} roomId
 * @returns {Promise<void>} Resolved after all callbacks have been called
 */
async function applyAfterCreateCallbacks(localRoom, roomId) {
  for (const afterCreateCallback of localRoom.afterCreateCallbacks) {
    await afterCreateCallback(roomId);
  }
  localRoom.afterCreateCallbacks = [];
}
//# sourceMappingURL=local-room.js.map