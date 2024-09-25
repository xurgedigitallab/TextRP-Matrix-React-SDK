"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getEventDisplayInfo = getEventDisplayInfo;
var _event = require("matrix-js-sdk/src/@types/event");
var _polls = require("matrix-js-sdk/src/@types/polls");
var _beacon = require("matrix-js-sdk/src/@types/beacon");
var _SettingsStore = _interopRequireDefault(require("../settings/SettingsStore"));
var _EventTileFactory = require("../events/EventTileFactory");
var _EventUtils = require("./EventUtils");
var _Call = require("../models/Call");
var _voiceBroadcast = require("../voice-broadcast");
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

const calcIsInfoMessage = (eventType, content, isBubbleMessage, isLeftAlignedBubbleMessage) => {
  return !isBubbleMessage && !isLeftAlignedBubbleMessage && eventType !== _event.EventType.RoomMessage && eventType !== _event.EventType.RoomMessageEncrypted && eventType !== _event.EventType.Sticker && eventType !== _event.EventType.RoomCreate && !_polls.M_POLL_START.matches(eventType) && !_polls.M_POLL_END.matches(eventType) && !_beacon.M_BEACON_INFO.matches(eventType) && !(eventType === _voiceBroadcast.VoiceBroadcastInfoEventType && content?.state === _voiceBroadcast.VoiceBroadcastInfoState.Started);
};
function getEventDisplayInfo(matrixClient, mxEvent, showHiddenEvents, hideEvent) {
  const content = mxEvent.getContent();
  const msgtype = content.msgtype;
  const eventType = mxEvent.getType();
  let isSeeingThroughMessageHiddenForModeration = false;
  if (_SettingsStore.default.getValue("feature_msc3531_hide_messages_pending_moderation")) {
    switch ((0, _EventUtils.getMessageModerationState)(mxEvent, matrixClient)) {
      case _EventUtils.MessageModerationState.VISIBLE_FOR_ALL:
      case _EventUtils.MessageModerationState.HIDDEN_TO_CURRENT_USER:
        // Nothing specific to do here
        break;
      case _EventUtils.MessageModerationState.SEE_THROUGH_FOR_CURRENT_USER:
        // Show message with a marker.
        isSeeingThroughMessageHiddenForModeration = true;
        break;
    }
  }
  let factory = (0, _EventTileFactory.pickFactory)(mxEvent, matrixClient, showHiddenEvents);

  // Info messages are basically information about commands processed on a room
  let isBubbleMessage = eventType.startsWith("m.key.verification") || eventType === _event.EventType.RoomMessage && msgtype?.startsWith("m.key.verification") || eventType === _event.EventType.RoomCreate || eventType === _event.EventType.RoomEncryption || factory === _EventTileFactory.JitsiEventFactory;
  const isLeftAlignedBubbleMessage = !isBubbleMessage && (eventType === _event.EventType.CallInvite || _Call.ElementCall.CALL_EVENT_TYPE.matches(eventType));
  let isInfoMessage = calcIsInfoMessage(eventType, content, isBubbleMessage, isLeftAlignedBubbleMessage);
  // Some non-info messages want to be rendered in the appropriate bubble column but without the bubble background
  const noBubbleEvent = eventType === _event.EventType.RoomMessage && msgtype === _event.MsgType.Emote || _polls.M_POLL_START.matches(eventType) || _beacon.M_BEACON_INFO.matches(eventType) || (0, _EventUtils.isLocationEvent)(mxEvent) || eventType === _voiceBroadcast.VoiceBroadcastInfoEventType;

  // If we're showing hidden events in the timeline, we should use the
  // source tile when there's no regular tile for an event and also for
  // replace relations (which otherwise would display as a confusing
  // duplicate of the thing they are replacing).
  if (hideEvent || !(0, _EventTileFactory.haveRendererForEvent)(mxEvent, showHiddenEvents)) {
    // forcefully ask for a factory for a hidden event (hidden event setting is checked internally)
    factory = (0, _EventTileFactory.pickFactory)(mxEvent, matrixClient, showHiddenEvents, true);
    if (factory === _EventTileFactory.JSONEventFactory) {
      isBubbleMessage = false;
      // Reuse info message avatar and sender profile styling
      isInfoMessage = true;
    }
  }
  return {
    hasRenderer: !!factory,
    isInfoMessage,
    isBubbleMessage,
    isLeftAlignedBubbleMessage,
    noBubbleEvent,
    isSeeingThroughMessageHiddenForModeration
  };
}
//# sourceMappingURL=EventRenderingUtils.js.map