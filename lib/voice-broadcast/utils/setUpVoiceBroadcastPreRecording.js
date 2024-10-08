"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.setUpVoiceBroadcastPreRecording = void 0;
var _ = require("..");
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

const setUpVoiceBroadcastPreRecording = async (room, client, playbacksStore, recordingsStore, preRecordingStore) => {
  if (!(await (0, _.checkVoiceBroadcastPreConditions)(room, client, recordingsStore))) {
    return null;
  }
  const userId = client.getUserId();
  if (!userId) return null;
  const sender = room.getMember(userId);
  if (!sender) return null;

  // pause and clear current playback (if any)
  playbacksStore.getCurrent()?.pause();
  playbacksStore.clearCurrent();
  const preRecording = new _.VoiceBroadcastPreRecording(room, sender, client, playbacksStore, recordingsStore);
  preRecordingStore.setCurrent(preRecording);
  return preRecording;
};
exports.setUpVoiceBroadcastPreRecording = setUpVoiceBroadcastPreRecording;
//# sourceMappingURL=setUpVoiceBroadcastPreRecording.js.map