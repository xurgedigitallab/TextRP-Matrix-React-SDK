"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.VoiceBroadcastResumer = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _matrix = require("matrix-js-sdk/src/matrix");
var _sync = require("matrix-js-sdk/src/sync");
var _ = require("..");
var _findRoomLiveVoiceBroadcastFromUserAndDevice = require("./findRoomLiveVoiceBroadcastFromUserAndDevice");
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

/**
 * Handles voice broadcasts on app resume (after logging in, reload, crash…).
 */
class VoiceBroadcastResumer {
  constructor(client) {
    this.client = client;
    (0, _defineProperty2.default)(this, "onClientSync", () => {
      if (this.client.getSyncState() === _sync.SyncState.Syncing) {
        this.client.off(_matrix.ClientEvent.Sync, this.onClientSync);
        this.resume();
      }
    });
    if (client.isInitialSyncComplete()) {
      this.resume();
    } else {
      // wait for initial sync
      client.on(_matrix.ClientEvent.Sync, this.onClientSync);
    }
  }
  resume() {
    const userId = this.client.getUserId();
    const deviceId = this.client.getDeviceId();
    if (!userId || !deviceId) {
      // Resuming a voice broadcast only makes sense if there is a user.
      return;
    }
    this.client.getRooms().forEach(room => {
      const infoEvent = (0, _findRoomLiveVoiceBroadcastFromUserAndDevice.findRoomLiveVoiceBroadcastFromUserAndDevice)(room, userId, deviceId);
      if (infoEvent) {
        // Found a live broadcast event from current device; stop it.
        // Stopping it is a temporary solution (see PSF-1669).
        this.sendStopVoiceBroadcastStateEvent(infoEvent);
        return false;
      }
    });
  }
  sendStopVoiceBroadcastStateEvent(infoEvent) {
    const userId = this.client.getUserId();
    const deviceId = this.client.getDeviceId();
    const roomId = infoEvent.getRoomId();
    if (!userId || !deviceId || !roomId) {
      // We can only send a state event if we know all the IDs.
      return;
    }
    const content = {
      device_id: deviceId,
      state: _.VoiceBroadcastInfoState.Stopped
    };

    // all events should reference the started event
    const referencedEventId = infoEvent.getContent()?.state === _.VoiceBroadcastInfoState.Started ? infoEvent.getId() : infoEvent.getContent()?.["m.relates_to"]?.event_id;
    if (referencedEventId) {
      content["m.relates_to"] = {
        rel_type: _matrix.RelationType.Reference,
        event_id: referencedEventId
      };
    }
    this.client.sendStateEvent(roomId, _.VoiceBroadcastInfoEventType, content, userId);
  }
  destroy() {
    this.client.off(_matrix.ClientEvent.Sync, this.onClientSync);
  }
}
exports.VoiceBroadcastResumer = VoiceBroadcastResumer;
//# sourceMappingURL=VoiceBroadcastResumer.js.map