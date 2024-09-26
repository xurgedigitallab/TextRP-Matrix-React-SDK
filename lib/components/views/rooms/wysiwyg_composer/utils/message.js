"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.editMessage = editMessage;
exports.sendMessage = sendMessage;
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _thread = require("matrix-js-sdk/src/models/thread");
var _PosthogAnalytics = require("../../../../../PosthogAnalytics");
var _SettingsStore = _interopRequireDefault(require("../../../../../settings/SettingsStore"));
var _sendTimePerformanceMetrics = require("../../../../../sendTimePerformanceMetrics");
var _localRoom = require("../../../../../utils/local-room");
var _effects = require("../../../../../effects");
var _utils = require("../../../../../effects/utils");
var _dispatcher = _interopRequireDefault(require("../../../../../dispatcher/dispatcher"));
var _ConfirmRedactDialog = require("../../../dialogs/ConfirmRedactDialog");
var _editing = require("./editing");
var _createMessageContent = require("./createMessageContent");
var _isContentModified = require("./isContentModified");
var _SlashCommands = require("../../../../../SlashCommands");
var _commands = require("../../../../../editor/commands");
var _actions = require("../../../../../dispatcher/actions");
var _Reply = require("../../../../../utils/Reply");
var _SendMessageComposer = require("../../SendMessageComposer");
const _excluded = ["roomContext", "mxClient"];
/*
Copyright 2022 - 2023 The Matrix.org Foundation C.I.C.

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
async function sendMessage(message, isHTML, _ref) {
  let {
      roomContext,
      mxClient
    } = _ref,
    params = (0, _objectWithoutProperties2.default)(_ref, _excluded);
  const {
    relation,
    replyToEvent,
    permalinkCreator
  } = params;
  const {
    room
  } = roomContext;
  const roomId = room?.roomId;
  if (!roomId) {
    return;
  }
  const posthogEvent = {
    eventName: "Composer",
    isEditing: false,
    isReply: Boolean(replyToEvent),
    // TODO thread
    inThread: relation?.rel_type === _thread.THREAD_RELATION_TYPE.name
  };

  // TODO thread
  /*if (posthogEvent.inThread) {
      const threadRoot = room.findEventById(relation?.event_id);
      posthogEvent.startsThread = threadRoot?.getThread()?.events.length === 1;
  }*/
  _PosthogAnalytics.PosthogAnalytics.instance.trackEvent(posthogEvent);
  let content = null;

  // Slash command handling here approximates what can be found in SendMessageComposer.sendMessage()
  // but note that the /me and // special cases are handled by the call to createMessageContent
  if (message.startsWith("/") && !message.startsWith("//") && !message.startsWith(_createMessageContent.EMOTE_PREFIX)) {
    const {
      cmd,
      args
    } = (0, _SlashCommands.getCommand)(message);
    if (cmd) {
      const threadId = relation?.rel_type === _thread.THREAD_RELATION_TYPE.name ? relation?.event_id : null;
      let commandSuccessful;
      [content, commandSuccessful] = await (0, _commands.runSlashCommand)(mxClient, cmd, args, roomId, threadId ?? null);
      if (!commandSuccessful) {
        return; // errored
      }

      if (content && (cmd.category === _SlashCommands.CommandCategories.messages || cmd.category === _SlashCommands.CommandCategories.effects)) {
        (0, _SendMessageComposer.attachRelation)(content, relation);
        if (replyToEvent) {
          (0, _Reply.addReplyToMessageContent)(content, replyToEvent, {
            permalinkCreator,
            // Exclude the legacy fallback for custom event types such as those used by /fireworks
            includeLegacyFallback: content.msgtype?.startsWith("m.") ?? true
          });
        }
      } else {
        // instead of setting shouldSend to false as in SendMessageComposer, just return
        return;
      }
    } else {
      const sendAnyway = await (0, _commands.shouldSendAnyway)(message);
      // re-focus the composer after QuestionDialog is closed
      _dispatcher.default.dispatch({
        action: _actions.Action.FocusAComposer,
        context: roomContext.timelineRenderingType
      });
      // if !sendAnyway bail to let the user edit the composer and try again
      if (!sendAnyway) return;
    }
  }

  // if content is null, we haven't done any slash command processing, so generate some content
  content ??= await (0, _createMessageContent.createMessageContent)(message, isHTML, params);

  // TODO replace emotion end of message ?

  // TODO quick reaction

  // don't bother sending an empty message
  if (!content.body.trim()) {
    return;
  }
  if (_SettingsStore.default.getValue("Performance.addSendMessageTimingMetadata")) {
    (0, _sendTimePerformanceMetrics.decorateStartSendingTime)(content);
  }
  const threadId = relation?.event_id && relation?.rel_type === _thread.THREAD_RELATION_TYPE.name ? relation.event_id : null;
  const prom = (0, _localRoom.doMaybeLocalRoomAction)(roomId, actualRoomId => mxClient.sendMessage(actualRoomId, threadId, content), mxClient);
  if (replyToEvent) {
    // Clear reply_to_event as we put the message into the queue
    // if the send fails, retry will handle resending.
    _dispatcher.default.dispatch({
      action: "reply_to_event",
      event: null,
      context: roomContext.timelineRenderingType
    });
  }
  _dispatcher.default.dispatch({
    action: "message_sent"
  });
  _effects.CHAT_EFFECTS.forEach(effect => {
    if (content && (0, _utils.containsEmoji)(content, effect.emojis)) {
      // For initial threads launch, chat effects are disabled
      // see #19731
      const isNotThread = relation?.rel_type !== _thread.THREAD_RELATION_TYPE.name;
      if (isNotThread) {
        _dispatcher.default.dispatch({
          action: `effects.${effect.command}`
        });
      }
    }
  });
  if (_SettingsStore.default.getValue("Performance.addSendMessageTimingMetadata")) {
    prom.then(resp => {
      (0, _sendTimePerformanceMetrics.sendRoundTripMetric)(mxClient, roomId, resp.event_id);
    });
  }

  // TODO save history
  // TODO save local state

  //if (shouldSend && SettingsStore.getValue("scrollToBottomOnMessageSent")) {
  if (_SettingsStore.default.getValue("scrollToBottomOnMessageSent")) {
    _dispatcher.default.dispatch({
      action: "scroll_to_bottom",
      timelineRenderingType: roomContext.timelineRenderingType
    });
  }
  return prom;
}
async function editMessage(html, _ref2) {
  let {
    roomContext,
    mxClient,
    editorStateTransfer
  } = _ref2;
  const editedEvent = editorStateTransfer.getEvent();
  _PosthogAnalytics.PosthogAnalytics.instance.trackEvent({
    eventName: "Composer",
    isEditing: true,
    inThread: Boolean(editedEvent?.getThread()),
    isReply: Boolean(editedEvent.replyEventId)
  });

  // TODO emoji
  // Replace emoticon at the end of the message
  /*    if (SettingsStore.getValue('MessageComposerInput.autoReplaceEmoji')) {
      const caret = this.editorRef.current?.getCaret();
      const position = this.model.positionForOffset(caret.offset, caret.atNodeEnd);
      this.editorRef.current?.replaceEmoticon(position, REGEX_EMOTICON);
  }*/
  const editContent = await (0, _createMessageContent.createMessageContent)(html, true, {
    editedEvent
  });
  const newContent = editContent["m.new_content"];
  const shouldSend = true;
  if (newContent?.body === "") {
    (0, _editing.cancelPreviousPendingEdit)(mxClient, editorStateTransfer);
    (0, _ConfirmRedactDialog.createRedactEventDialog)({
      mxEvent: editedEvent,
      onCloseDialog: () => {
        (0, _editing.endEditing)(roomContext);
      }
    });
    return;
  }
  let response;
  const roomId = editedEvent.getRoomId();

  // If content is modified then send an updated event into the room
  if ((0, _isContentModified.isContentModified)(newContent, editorStateTransfer) && roomId) {
    // TODO Slash Commands

    if (shouldSend) {
      (0, _editing.cancelPreviousPendingEdit)(mxClient, editorStateTransfer);
      const event = editorStateTransfer.getEvent();
      const threadId = event.threadRootId || null;
      response = mxClient.sendMessage(roomId, threadId, editContent);
      _dispatcher.default.dispatch({
        action: "message_sent"
      });
    }
  }
  (0, _editing.endEditing)(roomContext);
  return response;
}
//# sourceMappingURL=message.js.map