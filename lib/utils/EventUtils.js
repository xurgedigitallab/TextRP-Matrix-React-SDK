"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.MessageModerationState = void 0;
exports.canCancel = canCancel;
exports.canEditContent = canEditContent;
exports.canEditOwnEvent = canEditOwnEvent;
exports.canPinEvent = canPinEvent;
exports.editEvent = editEvent;
exports.fetchInitialEvent = fetchInitialEvent;
exports.findEditableEvent = findEditableEvent;
exports.getMessageModerationState = getMessageModerationState;
exports.hasThreadSummary = hasThreadSummary;
exports.highlightEvent = void 0;
exports.isContentActionable = isContentActionable;
exports.isLocationEvent = void 0;
exports.isVoiceMessage = isVoiceMessage;
var _event = require("matrix-js-sdk/src/models/event");
var _event2 = require("matrix-js-sdk/src/@types/event");
var _logger = require("matrix-js-sdk/src/logger");
var _polls = require("matrix-js-sdk/src/@types/polls");
var _location = require("matrix-js-sdk/src/@types/location");
var _beacon = require("matrix-js-sdk/src/@types/beacon");
var _thread = require("matrix-js-sdk/src/models/thread");
var _shouldHideEvent = _interopRequireDefault(require("../shouldHideEvent"));
var _SettingsStore = _interopRequireDefault(require("../settings/SettingsStore"));
var _dispatcher = _interopRequireDefault(require("../dispatcher/dispatcher"));
var _MPollBody = require("../components/views/messages/MPollBody");
var _actions = require("../dispatcher/actions");
var _types = require("../voice-broadcast/types");
/*
Copyright 2019 - 2022 The Matrix.org Foundation C.I.C.

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
 * Returns whether an event should allow actions like reply, reactions, edit, etc.
 * which effectively checks whether it's a regular message that has been sent and that we
 * can display.
 *
 * @param {MatrixEvent} mxEvent The event to check
 * @returns {boolean} true if actionable
 */
function isContentActionable(mxEvent) {
  const {
    status: eventStatus
  } = mxEvent;

  // status is SENT before remote-echo, null after
  const isSent = !eventStatus || eventStatus === _event.EventStatus.SENT;
  if (isSent && !mxEvent.isRedacted()) {
    if (mxEvent.getType() === "m.room.message") {
      const content = mxEvent.getContent();
      if (content.msgtype && content.msgtype !== "m.bad.encrypted" && content.hasOwnProperty("body")) {
        return true;
      }
    } else if (mxEvent.getType() === "m.sticker" || _polls.M_POLL_START.matches(mxEvent.getType()) || _polls.M_POLL_END.matches(mxEvent.getType()) || _beacon.M_BEACON_INFO.matches(mxEvent.getType()) || mxEvent.getType() === _types.VoiceBroadcastInfoEventType && mxEvent.getContent()?.state === _types.VoiceBroadcastInfoState.Started) {
      return true;
    }
  }
  return false;
}
function canEditContent(matrixClient, mxEvent) {
  const isCancellable = mxEvent.getType() === _event2.EventType.RoomMessage || _polls.M_POLL_START.matches(mxEvent.getType());
  if (!isCancellable || mxEvent.status === _event.EventStatus.CANCELLED || mxEvent.isRedacted() || mxEvent.isRelation(_event2.RelationType.Replace) || mxEvent.getSender() !== matrixClient.getUserId()) {
    return false;
  }
  const {
    msgtype,
    body
  } = mxEvent.getOriginalContent();
  return _polls.M_POLL_START.matches(mxEvent.getType()) || (msgtype === _event2.MsgType.Text || msgtype === _event2.MsgType.Emote) && !!body && typeof body === "string";
}
function canEditOwnEvent(matrixClient, mxEvent) {
  // for now we only allow editing
  // your own events. So this just call through
  // In the future though, moderators will be able to
  // edit other people's messages as well but we don't
  // want findEditableEvent to return other people's events
  // hence this method.
  return canEditContent(matrixClient, mxEvent);
}
const MAX_JUMP_DISTANCE = 100;
function findEditableEvent(_ref) {
  let {
    matrixClient,
    events,
    isForward,
    fromEventId
  } = _ref;
  if (!events.length) return;
  const maxIdx = events.length - 1;
  const inc = isForward ? 1 : -1;
  const beginIdx = isForward ? 0 : maxIdx;
  let endIdx = isForward ? maxIdx : 0;
  if (!fromEventId) {
    endIdx = Math.min(Math.max(0, beginIdx + inc * MAX_JUMP_DISTANCE), maxIdx);
  }
  let foundFromEventId = !fromEventId;
  for (let i = beginIdx; i !== endIdx + inc; i += inc) {
    const e = events[i];
    // find start event first
    if (!foundFromEventId && e.getId() === fromEventId) {
      foundFromEventId = true;
      // don't look further than MAX_JUMP_DISTANCE events from `fromEventId`
      // to not iterate potentially 1000nds of events on key up/down
      endIdx = Math.min(Math.max(0, i + inc * MAX_JUMP_DISTANCE), maxIdx);
    } else if (foundFromEventId && !(0, _shouldHideEvent.default)(e) && canEditOwnEvent(matrixClient, e)) {
      // otherwise look for editable event
      return e;
    }
  }
}

/**
 * How we should render a message depending on its moderation state.
 */
let MessageModerationState = /*#__PURE__*/function (MessageModerationState) {
  MessageModerationState["VISIBLE_FOR_ALL"] = "VISIBLE_FOR_ALL";
  MessageModerationState["HIDDEN_TO_CURRENT_USER"] = "HIDDEN_TO_CURRENT_USER";
  MessageModerationState["SEE_THROUGH_FOR_CURRENT_USER"] = "SEE_THROUGH_FOR_CURRENT_USER";
  return MessageModerationState;
}({}); // This is lazily initialized and cached since getMessageModerationState needs it,
// and is called on timeline rendering hot-paths
exports.MessageModerationState = MessageModerationState;
let msc3531Enabled = null;
const getMsc3531Enabled = () => {
  if (msc3531Enabled === null) {
    msc3531Enabled = _SettingsStore.default.getValue("feature_msc3531_hide_messages_pending_moderation");
  }
  return msc3531Enabled;
};

/**
 * Determine whether a message should be displayed as hidden pending moderation.
 *
 * If MSC3531 is deactivated in settings, all messages are considered visible
 * to all.
 */
function getMessageModerationState(mxEvent, client) {
  if (!getMsc3531Enabled()) {
    return MessageModerationState.VISIBLE_FOR_ALL;
  }
  const visibility = mxEvent.messageVisibility();
  if (visibility.visible) {
    return MessageModerationState.VISIBLE_FOR_ALL;
  }

  // At this point, we know that the message is marked as hidden
  // pending moderation. However, if we're the author or a moderator,
  // we still need to display it.

  if (mxEvent.sender?.userId === client.getUserId()) {
    // We're the author, show the message.
    return MessageModerationState.SEE_THROUGH_FOR_CURRENT_USER;
  }
  const room = client.getRoom(mxEvent.getRoomId());
  if (_event2.EVENT_VISIBILITY_CHANGE_TYPE.name && room?.currentState.maySendStateEvent(_event2.EVENT_VISIBILITY_CHANGE_TYPE.name, client.getUserId())) {
    // We're a moderator (as indicated by prefixed event name), show the message.
    return MessageModerationState.SEE_THROUGH_FOR_CURRENT_USER;
  }
  if (_event2.EVENT_VISIBILITY_CHANGE_TYPE.altName && room?.currentState.maySendStateEvent(_event2.EVENT_VISIBILITY_CHANGE_TYPE.altName, client.getUserId())) {
    // We're a moderator (as indicated by unprefixed event name), show the message.
    return MessageModerationState.SEE_THROUGH_FOR_CURRENT_USER;
  }
  // For everybody else, hide the message.
  return MessageModerationState.HIDDEN_TO_CURRENT_USER;
}
function isVoiceMessage(mxEvent) {
  const content = mxEvent.getContent();
  // MSC2516 is a legacy identifier. See https://github.com/matrix-org/matrix-doc/pull/3245
  return !!content["org.matrix.msc2516.voice"] || !!content["org.matrix.msc3245.voice"];
}
async function fetchInitialEvent(client, roomId, eventId) {
  let initialEvent;
  try {
    const eventData = await client.fetchRoomEvent(roomId, eventId);
    initialEvent = new _event.MatrixEvent(eventData);
  } catch (e) {
    _logger.logger.warn("Could not find initial event: " + eventId);
    initialEvent = null;
  }
  if (client.supportsThreads() && initialEvent?.isRelation(_thread.THREAD_RELATION_TYPE.name) && !initialEvent.getThread()) {
    const threadId = initialEvent.threadRootId;
    const room = client.getRoom(roomId);
    const mapper = client.getEventMapper();
    const rootEvent = room?.findEventById(threadId) ?? mapper(await client.fetchRoomEvent(roomId, threadId));
    try {
      room?.createThread(threadId, rootEvent, [initialEvent], true);
    } catch (e) {
      _logger.logger.warn("Could not find root event: " + threadId);
    }
  }
  return initialEvent;
}
function editEvent(matrixClient, mxEvent, timelineRenderingType, getRelationsForEvent) {
  if (!canEditContent(matrixClient, mxEvent)) return;
  if (_polls.M_POLL_START.matches(mxEvent.getType())) {
    (0, _MPollBody.launchPollEditor)(mxEvent, getRelationsForEvent);
  } else {
    _dispatcher.default.dispatch({
      action: _actions.Action.EditEvent,
      event: mxEvent,
      timelineRenderingType: timelineRenderingType
    });
  }
}
function canCancel(status) {
  return status === _event.EventStatus.QUEUED || status === _event.EventStatus.NOT_SENT || status === _event.EventStatus.ENCRYPTING;
}
const isLocationEvent = event => {
  const eventType = event.getType();
  return _location.M_LOCATION.matches(eventType) || eventType === _event2.EventType.RoomMessage && _location.M_LOCATION.matches(event.getContent().msgtype);
};
exports.isLocationEvent = isLocationEvent;
function hasThreadSummary(event) {
  return event.isThreadRoot && !!event.getThread()?.length && !!event.getThread().replyToEvent;
}
function canPinEvent(event) {
  return !_beacon.M_BEACON_INFO.matches(event.getType());
}
const highlightEvent = (roomId, eventId) => {
  _dispatcher.default.dispatch({
    action: _actions.Action.ViewRoom,
    event_id: eventId,
    highlighted: true,
    room_id: roomId,
    metricsTrigger: undefined // room doesn't change
  });
};
exports.highlightEvent = highlightEvent;
//# sourceMappingURL=EventUtils.js.map