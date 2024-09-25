"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.usePollsWithRelations = exports.usePolls = void 0;
var _react = require("react");
var _matrix = require("matrix-js-sdk/src/matrix");
var _useEventEmitter = require("../../../../hooks/useEventEmitter");
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

/**
 * Get poll instances from a room
 * Updates to include new polls
 * @param roomId - id of room to retrieve polls for
 * @param matrixClient - client
 * @returns {Map<string, Poll>} - Map of Poll instances
 */
const usePolls = (roomId, matrixClient) => {
  const room = matrixClient.getRoom(roomId);
  if (!room) {
    throw new Error("Cannot find room");
  }

  // copy room.polls map so changes can be detected
  const polls = (0, _useEventEmitter.useEventEmitterState)(room, _matrix.PollEvent.New, () => new Map(room.polls));
  return {
    polls
  };
};

/**
 * Get all poll instances from a room
 * Fetch their responses (using cached poll responses)
 * Updates on:
 * - new polls added to room
 * - new responses added to polls
 * - changes to poll ended state
 * @param roomId - id of room to retrieve polls for
 * @param matrixClient - client
 * @returns {Map<string, Poll>} - Map of Poll instances
 */
exports.usePolls = usePolls;
const usePollsWithRelations = (roomId, matrixClient) => {
  const {
    polls
  } = usePolls(roomId, matrixClient);
  const [pollsWithRelations, setPollsWithRelations] = (0, _react.useState)(polls);
  (0, _react.useEffect)(() => {
    const onPollUpdate = async () => {
      // trigger rerender by creating a new poll map
      setPollsWithRelations(new Map(polls));
    };
    if (polls) {
      for (const poll of polls.values()) {
        // listen to changes in responses and end state
        poll.on(_matrix.PollEvent.End, onPollUpdate);
        poll.on(_matrix.PollEvent.Responses, onPollUpdate);
        // trigger request to get all responses
        // if they are not already in cache
        poll.getResponses();
      }
      setPollsWithRelations(polls);
    }
    // unsubscribe
    return () => {
      if (polls) {
        for (const poll of polls.values()) {
          poll.off(_matrix.PollEvent.End, onPollUpdate);
          poll.off(_matrix.PollEvent.Responses, onPollUpdate);
        }
      }
    };
  }, [polls, setPollsWithRelations]);
  return {
    polls: pollsWithRelations
  };
};
exports.usePollsWithRelations = usePollsWithRelations;
//# sourceMappingURL=usePollHistory.js.map