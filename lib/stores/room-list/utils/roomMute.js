"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getChangedOverrideRoomMutePushRules = void 0;
var _matrix = require("matrix-js-sdk/src/matrix");
var _RoomNotifs = require("../../../RoomNotifs");
var _arrays = require("../../../utils/arrays");
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
 * Gets any changed push rules that are room specific overrides
 * that mute notifications
 * @param actionPayload
 * @returns {string[]} ruleIds of added or removed rules
 */
const getChangedOverrideRoomMutePushRules = actionPayload => {
  if (actionPayload.action !== "MatrixActions.accountData" || actionPayload.event?.getType() !== _matrix.EventType.PushRules) {
    return undefined;
  }
  const event = actionPayload.event;
  const prevEvent = actionPayload.previousEvent;
  if (!event || !prevEvent) {
    return undefined;
  }
  const roomPushRules = event.getContent()?.global?.override?.filter(_RoomNotifs.isRuleMaybeRoomMuteRule);
  const prevRoomPushRules = prevEvent?.getContent()?.global?.override?.filter(_RoomNotifs.isRuleMaybeRoomMuteRule);
  const {
    added,
    removed
  } = (0, _arrays.arrayDiff)(prevRoomPushRules?.map(rule => rule.rule_id) || [], roomPushRules?.map(rule => rule.rule_id) || []);
  return [...added, ...removed];
};
exports.getChangedOverrideRoomMutePushRules = getChangedOverrideRoomMutePushRules;
//# sourceMappingURL=roomMute.js.map