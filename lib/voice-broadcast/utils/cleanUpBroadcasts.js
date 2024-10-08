"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.cleanUpBroadcasts = void 0;
/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

const cleanUpBroadcasts = async stores => {
  stores.voiceBroadcastPlaybacksStore.getCurrent()?.stop();
  stores.voiceBroadcastPlaybacksStore.clearCurrent();
  await stores.voiceBroadcastRecordingsStore.getCurrent()?.stop();
  stores.voiceBroadcastRecordingsStore.clearCurrent();
  stores.voiceBroadcastPreRecordingStore.getCurrent()?.cancel();
  stores.voiceBroadcastPreRecordingStore.clearCurrent();
};
exports.cleanUpBroadcasts = cleanUpBroadcasts;
//# sourceMappingURL=cleanUpBroadcasts.js.map