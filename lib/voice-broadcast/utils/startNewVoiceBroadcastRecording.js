"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.startNewVoiceBroadcastRecording = void 0;
var _matrix = require("matrix-js-sdk/src/matrix");
var _utils = require("matrix-js-sdk/src/utils");
var _ = require("..");
var _checkVoiceBroadcastPreConditions = require("./checkVoiceBroadcastPreConditions");
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

const startBroadcast = async (room, client, recordingsStore) => {
  const {
    promise,
    resolve,
    reject
  } = (0, _utils.defer)();
  const userId = client.getUserId();
  if (!userId) {
    reject("unable to start voice broadcast if current user is unknown");
    return promise;
  }
  let result = null;
  const onRoomStateEvents = () => {
    if (!result) return;
    const voiceBroadcastEvent = room.currentState.getStateEvents(_.VoiceBroadcastInfoEventType, userId);
    if (voiceBroadcastEvent?.getId() === result.event_id) {
      room.off(_matrix.RoomStateEvent.Events, onRoomStateEvents);
      const recording = new _.VoiceBroadcastRecording(voiceBroadcastEvent, client);
      recordingsStore.setCurrent(recording);
      recording.start();
      resolve(recording);
    }
  };
  room.on(_matrix.RoomStateEvent.Events, onRoomStateEvents);

  // XXX Michael W: refactor to live event
  result = await client.sendStateEvent(room.roomId, _.VoiceBroadcastInfoEventType, {
    device_id: client.getDeviceId(),
    state: _.VoiceBroadcastInfoState.Started,
    chunk_length: (0, _.getChunkLength)()
  }, userId);
  return promise;
};

/**
 * Starts a new Voice Broadcast Recording, if
 * - the user has the permissions to do so in the room
 * - the user is not already recording a voice broadcast
 * - there is no other broadcast being recorded in the room, yet
 * Sends a voice_broadcast_info state event and waits for the event to actually appear in the room state.
 */
const startNewVoiceBroadcastRecording = async (room, client, playbacksStore, recordingsStore) => {
  if (!(await (0, _checkVoiceBroadcastPreConditions.checkVoiceBroadcastPreConditions)(room, client, recordingsStore))) {
    return null;
  }

  // pause and clear current playback (if any)
  playbacksStore.getCurrent()?.pause();
  playbacksStore.clearCurrent();
  return startBroadcast(room, client, recordingsStore);
};
exports.startNewVoiceBroadcastRecording = startNewVoiceBroadcastRecording;
//# sourceMappingURL=startNewVoiceBroadcastRecording.js.map