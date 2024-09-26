"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.retrieveStartedInfoEvent = void 0;
var _matrix = require("matrix-js-sdk/src/matrix");
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

const retrieveStartedInfoEvent = async (event, client) => {
  // started event passed as argument
  if (event.getContent()?.state === _.VoiceBroadcastInfoState.Started) return event;
  const relatedEventId = event.getRelation()?.event_id;

  // no related event
  if (!relatedEventId) return null;
  const roomId = event.getRoomId() || "";
  const relatedEventFromRoom = client.getRoom(roomId)?.findEventById(relatedEventId);

  // event found
  if (relatedEventFromRoom) return relatedEventFromRoom;
  try {
    const relatedEventData = await client.fetchRoomEvent(roomId, relatedEventId);
    return new _matrix.MatrixEvent(relatedEventData);
  } catch (e) {}
  return null;
};
exports.retrieveStartedInfoEvent = retrieveStartedInfoEvent;
//# sourceMappingURL=retrieveStartedInfoEvent.js.map