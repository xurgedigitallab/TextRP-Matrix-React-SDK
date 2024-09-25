"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.hasRoomLiveVoiceBroadcast = void 0;
var _ = require("..");
var _arrays = require("../../utils/arrays");
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

const hasRoomLiveVoiceBroadcast = async (client, room, userId) => {
  let hasBroadcast = false;
  let startedByUser = false;
  let infoEvent = null;
  const stateEvents = room.currentState.getStateEvents(_.VoiceBroadcastInfoEventType);
  await (0, _arrays.asyncEvery)(stateEvents, async event => {
    const state = event.getContent()?.state;
    if (state && state !== _.VoiceBroadcastInfoState.Stopped) {
      const startEvent = await (0, _.retrieveStartedInfoEvent)(event, client);

      // skip if started voice broadcast event is redacted
      if (startEvent?.isRedacted()) return true;
      hasBroadcast = true;
      infoEvent = startEvent;

      // state key = sender's MXID
      if (event.getStateKey() === userId) {
        startedByUser = true;
        // break here, because more than true / true is not possible
        return false;
      }
    }
    return true;
  });
  return {
    hasBroadcast,
    infoEvent,
    startedByUser
  };
};
exports.hasRoomLiveVoiceBroadcast = hasRoomLiveVoiceBroadcast;
//# sourceMappingURL=hasRoomLiveVoiceBroadcast.js.map