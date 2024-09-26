"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useVoiceBroadcastPlayback = void 0;
var _useEventEmitter = require("../../hooks/useEventEmitter");
var _MatrixClientPeg = require("../../MatrixClientPeg");
var _ = require("..");
/*
Copyright 2022-2023 The Matrix.org Foundation C.I.C.

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

const useVoiceBroadcastPlayback = playback => {
  const client = _MatrixClientPeg.MatrixClientPeg.get();
  const room = client.getRoom(playback.infoEvent.getRoomId());
  if (!room) {
    throw new Error(`Voice Broadcast room not found (event ${playback.infoEvent.getId()})`);
  }
  const sender = playback.infoEvent.sender;
  if (!sender) {
    throw new Error(`Voice Broadcast sender not found (event ${playback.infoEvent.getId()})`);
  }
  const playbackToggle = () => {
    playback.toggle();
  };
  const playbackState = (0, _useEventEmitter.useTypedEventEmitterState)(playback, _.VoiceBroadcastPlaybackEvent.StateChanged, state => {
    return state ?? playback.getState();
  });
  const times = (0, _useEventEmitter.useTypedEventEmitterState)(playback, _.VoiceBroadcastPlaybackEvent.TimesChanged, t => {
    return t ?? {
      duration: playback.durationSeconds,
      position: playback.timeSeconds,
      timeLeft: playback.timeLeftSeconds
    };
  });
  const liveness = (0, _useEventEmitter.useTypedEventEmitterState)(playback, _.VoiceBroadcastPlaybackEvent.LivenessChanged, l => {
    return l ?? playback.getLiveness();
  });
  return {
    times,
    liveness: liveness,
    playbackState,
    room: room,
    sender,
    toggle: playbackToggle
  };
};
exports.useVoiceBroadcastPlayback = useVoiceBroadcastPlayback;
//# sourceMappingURL=useVoiceBroadcastPlayback.js.map