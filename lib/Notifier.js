"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.Notifier = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _event = require("matrix-js-sdk/src/models/event");
var _room = require("matrix-js-sdk/src/models/room");
var _client = require("matrix-js-sdk/src/client");
var _logger = require("matrix-js-sdk/src/logger");
var _event2 = require("matrix-js-sdk/src/@types/event");
var _location = require("matrix-js-sdk/src/@types/location");
var _sync = require("matrix-js-sdk/src/sync");
var _MatrixClientPeg = require("./MatrixClientPeg");
var _PosthogAnalytics = require("./PosthogAnalytics");
var _SdkConfig = _interopRequireDefault(require("./SdkConfig"));
var _PlatformPeg = _interopRequireDefault(require("./PlatformPeg"));
var TextForEvent = _interopRequireWildcard(require("./TextForEvent"));
var Avatar = _interopRequireWildcard(require("./Avatar"));
var _dispatcher = _interopRequireDefault(require("./dispatcher/dispatcher"));
var _languageHandler = require("./languageHandler");
var _Modal = _interopRequireDefault(require("./Modal"));
var _SettingsStore = _interopRequireDefault(require("./settings/SettingsStore"));
var _DesktopNotificationsToast = require("./toasts/DesktopNotificationsToast");
var _SettingLevel = require("./settings/SettingLevel");
var _NotificationControllers = require("./settings/controllers/NotificationControllers");
var _UserActivity = _interopRequireDefault(require("./UserActivity"));
var _Media = require("./customisations/Media");
var _ErrorDialog = _interopRequireDefault(require("./components/views/dialogs/ErrorDialog"));
var _LegacyCallHandler = _interopRequireDefault(require("./LegacyCallHandler"));
var _VoipUserMapper = _interopRequireDefault(require("./VoipUserMapper"));
var _SDKContext = require("./contexts/SDKContext");
var _notifications = require("./utils/notifications");
var _IncomingCallToast = require("./toasts/IncomingCallToast");
var _ToastStore = _interopRequireDefault(require("./stores/ToastStore"));
var _Call = require("./models/Call");
var _voiceBroadcast = require("./voice-broadcast");
var _getSenderName = require("./utils/event/getSenderName");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2017 New Vector Ltd
Copyright 2020 The Matrix.org Foundation C.I.C.

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

/*
 * Dispatches:
 * {
 *   action: "notifier_enabled",
 *   value: boolean
 * }
 */

const MAX_PENDING_ENCRYPTED = 20;

/*
Override both the content body and the TextForEvent handler for specific msgtypes, in notifications.
This is useful when the content body contains fallback text that would explain that the client can't handle a particular
type of tile.
*/
const msgTypeHandlers = {
  [_event2.MsgType.KeyVerificationRequest]: event => {
    const name = (event.sender || {}).name;
    return (0, _languageHandler._t)("%(name)s is requesting verification", {
      name
    });
  },
  [_location.M_LOCATION.name]: event => {
    return TextForEvent.textForLocationEvent(event)();
  },
  [_location.M_LOCATION.altName]: event => {
    return TextForEvent.textForLocationEvent(event)();
  },
  [_event2.MsgType.Audio]: event => {
    if (event.getContent()?.[_voiceBroadcast.VoiceBroadcastChunkEventType]) {
      if (event.getContent()?.[_voiceBroadcast.VoiceBroadcastChunkEventType]?.sequence === 1) {
        // Show a notification for the first broadcast chunk.
        // At this point a user received something to listen to.
        return (0, _languageHandler._t)("%(senderName)s started a voice broadcast", {
          senderName: (0, _getSenderName.getSenderName)(event)
        });
      }

      // Mute other broadcast chunks
      return null;
    }
    return TextForEvent.textForEvent(event, _MatrixClientPeg.MatrixClientPeg.get());
  }
};
class NotifierClass {
  constructor() {
    (0, _defineProperty2.default)(this, "notifsByRoom", {});
    // A list of event IDs that we've received but need to wait until
    // they're decrypted until we decide whether to notify for them
    // or not
    (0, _defineProperty2.default)(this, "pendingEncryptedEventIds", []);
    (0, _defineProperty2.default)(this, "toolbarHidden", void 0);
    (0, _defineProperty2.default)(this, "isSyncing", void 0);
    // XXX: Exported for tests
    (0, _defineProperty2.default)(this, "onSyncStateChange", (state, prevState, data) => {
      if (state === _sync.SyncState.Syncing) {
        this.isSyncing = true;
      } else if (state === _sync.SyncState.Stopped || state === _sync.SyncState.Error) {
        this.isSyncing = false;
      }

      // wait for first non-cached sync to complete
      if (![_sync.SyncState.Stopped, _sync.SyncState.Error].includes(state) && !data?.fromCache) {
        (0, _notifications.createLocalNotificationSettingsIfNeeded)(_MatrixClientPeg.MatrixClientPeg.get());
      }
    });
    (0, _defineProperty2.default)(this, "onEvent", (ev, room, toStartOfTimeline, removed, data) => {
      if (!data.liveEvent) return; // only notify for new things, not old.
      if (!this.isSyncing) return; // don't alert for any messages initially
      if (ev.getSender() === _MatrixClientPeg.MatrixClientPeg.get().getUserId()) return;
      _MatrixClientPeg.MatrixClientPeg.get().decryptEventIfNeeded(ev);

      // If it's an encrypted event and the type is still 'm.room.encrypted',
      // it hasn't yet been decrypted, so wait until it is.
      if (ev.isBeingDecrypted() || ev.isDecryptionFailure()) {
        this.pendingEncryptedEventIds.push(ev.getId());
        // don't let the list fill up indefinitely
        while (this.pendingEncryptedEventIds.length > MAX_PENDING_ENCRYPTED) {
          this.pendingEncryptedEventIds.shift();
        }
        return;
      }
      this.evaluateEvent(ev);
    });
    (0, _defineProperty2.default)(this, "onEventDecrypted", ev => {
      // 'decrypted' means the decryption process has finished: it may have failed,
      // in which case it might decrypt soon if the keys arrive
      if (ev.isDecryptionFailure()) return;
      const idx = this.pendingEncryptedEventIds.indexOf(ev.getId());
      if (idx === -1) return;
      this.pendingEncryptedEventIds.splice(idx, 1);
      this.evaluateEvent(ev);
    });
    (0, _defineProperty2.default)(this, "onRoomReceipt", (ev, room) => {
      if (room.getUnreadNotificationCount() === 0) {
        // ideally we would clear each notification when it was read,
        // but we have no way, given a read receipt, to know whether
        // the receipt comes before or after an event, so we can't
        // do this. Instead, clear all notifications for a room once
        // there are no notifs left in that room., which is not quite
        // as good but it's something.
        const plaf = _PlatformPeg.default.get();
        if (!plaf) return;
        if (this.notifsByRoom[room.roomId] === undefined) return;
        for (const notif of this.notifsByRoom[room.roomId]) {
          plaf.clearNotification(notif);
        }
        delete this.notifsByRoom[room.roomId];
      }
    });
  }
  notificationMessageForEvent(ev) {
    const msgType = ev.getContent().msgtype;
    if (msgType && msgTypeHandlers.hasOwnProperty(msgType)) {
      return msgTypeHandlers[msgType](ev);
    }
    return TextForEvent.textForEvent(ev, _MatrixClientPeg.MatrixClientPeg.get());
  }

  // XXX: exported for tests
  displayPopupNotification(ev, room) {
    const plaf = _PlatformPeg.default.get();
    const cli = _MatrixClientPeg.MatrixClientPeg.get();
    if (!plaf) {
      return;
    }
    if (!plaf.supportsNotifications() || !plaf.maySendNotifications()) {
      return;
    }
    if ((0, _notifications.localNotificationsAreSilenced)(cli)) {
      return;
    }
    let msg = this.notificationMessageForEvent(ev);
    if (!msg) return;
    let title;
    if (!ev.sender || room.name === ev.sender.name) {
      title = room.name;
      // notificationMessageForEvent includes sender, but we already have the sender here
      const msgType = ev.getContent().msgtype;
      if (ev.getContent().body && (!msgType || !msgTypeHandlers.hasOwnProperty(msgType))) {
        msg = ev.getContent().body;
      }
    } else if (ev.getType() === "m.room.member") {
      // context is all in the message here, we don't need
      // to display sender info
      title = room.name;
    } else if (ev.sender) {
      title = ev.sender.name + " (" + room.name + ")";
      // notificationMessageForEvent includes sender, but we've just out sender in the title
      const msgType = ev.getContent().msgtype;
      if (ev.getContent().body && (!msgType || !msgTypeHandlers.hasOwnProperty(msgType))) {
        msg = ev.getContent().body;
      }
    }
    if (!title) return;
    if (!this.isBodyEnabled()) {
      msg = "";
    }
    let avatarUrl = null;
    if (ev.sender && !_SettingsStore.default.getValue("lowBandwidth")) {
      avatarUrl = Avatar.avatarUrlForMember(ev.sender, 40, 40, "crop");
    }
    const notif = plaf.displayNotification(title, msg, avatarUrl, room, ev);

    // if displayNotification returns non-null,  the platform supports
    // clearing notifications later, so keep track of this.
    if (notif) {
      if (this.notifsByRoom[ev.getRoomId()] === undefined) this.notifsByRoom[ev.getRoomId()] = [];
      this.notifsByRoom[ev.getRoomId()].push(notif);
    }
  }
  getSoundForRoom(roomId) {
    // We do no caching here because the SDK caches setting
    // and the browser will cache the sound.
    const content = _SettingsStore.default.getValue("notificationSound", roomId);
    if (!content) {
      return null;
    }
    if (typeof content.url !== "string") {
      _logger.logger.warn(`${roomId} has custom notification sound event, but no url string`);
      return null;
    }
    if (!content.url.startsWith("mxc://")) {
      _logger.logger.warn(`${roomId} has custom notification sound event, but url is not a mxc url`);
      return null;
    }

    // Ideally in here we could use MSC1310 to detect the type of file, and reject it.

    const url = (0, _Media.mediaFromMxc)(content.url).srcHttp;
    if (!url) {
      _logger.logger.warn("Something went wrong when generating src http url for mxc");
      return null;
    }
    return {
      url,
      name: content.name,
      type: content.type,
      size: content.size
    };
  }

  // XXX: Exported for tests
  async playAudioNotification(ev, room) {
    const cli = _MatrixClientPeg.MatrixClientPeg.get();
    if ((0, _notifications.localNotificationsAreSilenced)(cli)) {
      return;
    }
    const sound = this.getSoundForRoom(room.roomId);
    _logger.logger.log(`Got sound ${sound && sound.name || "default"} for ${room.roomId}`);
    try {
      const selector = document.querySelector(sound ? `audio[src='${sound.url}']` : "#messageAudio");
      let audioElement = selector;
      if (!audioElement) {
        if (!sound) {
          _logger.logger.error("No audio element or sound to play for notification");
          return;
        }
        audioElement = new Audio(sound.url);
        if (sound.type) {
          audioElement.type = sound.type;
        }
        document.body.appendChild(audioElement);
      }
      await audioElement.play();
    } catch (ex) {
      _logger.logger.warn("Caught error when trying to fetch room notification sound:", ex);
    }
  }
  start() {
    _MatrixClientPeg.MatrixClientPeg.get().on(_room.RoomEvent.Timeline, this.onEvent);
    _MatrixClientPeg.MatrixClientPeg.get().on(_room.RoomEvent.Receipt, this.onRoomReceipt);
    _MatrixClientPeg.MatrixClientPeg.get().on(_event.MatrixEventEvent.Decrypted, this.onEventDecrypted);
    _MatrixClientPeg.MatrixClientPeg.get().on(_client.ClientEvent.Sync, this.onSyncStateChange);
    this.toolbarHidden = false;
    this.isSyncing = false;
  }
  stop() {
    if (_MatrixClientPeg.MatrixClientPeg.get()) {
      _MatrixClientPeg.MatrixClientPeg.get().removeListener(_room.RoomEvent.Timeline, this.onEvent);
      _MatrixClientPeg.MatrixClientPeg.get().removeListener(_room.RoomEvent.Receipt, this.onRoomReceipt);
      _MatrixClientPeg.MatrixClientPeg.get().removeListener(_event.MatrixEventEvent.Decrypted, this.onEventDecrypted);
      _MatrixClientPeg.MatrixClientPeg.get().removeListener(_client.ClientEvent.Sync, this.onSyncStateChange);
    }
    this.isSyncing = false;
  }
  supportsDesktopNotifications() {
    return _PlatformPeg.default.get()?.supportsNotifications() ?? false;
  }
  setEnabled(enable, callback) {
    const plaf = _PlatformPeg.default.get();
    if (!plaf) return;

    // Dev note: We don't set the "notificationsEnabled" setting to true here because it is a
    // calculated value. It is determined based upon whether or not the master rule is enabled
    // and other flags. Setting it here would cause a circular reference.

    // make sure that we persist the current setting audio_enabled setting
    // before changing anything
    if (_SettingsStore.default.isLevelSupported(_SettingLevel.SettingLevel.DEVICE)) {
      _SettingsStore.default.setValue("audioNotificationsEnabled", null, _SettingLevel.SettingLevel.DEVICE, this.isEnabled());
    }
    if (enable) {
      // Attempt to get permission from user
      plaf.requestNotificationPermission().then(result => {
        if (result !== "granted") {
          // The permission request was dismissed or denied
          // TODO: Support alternative branding in messaging
          const brand = _SdkConfig.default.get().brand;
          const description = result === "denied" ? (0, _languageHandler._t)("%(brand)s does not have permission to send you notifications - " + "please check your browser settings", {
            brand
          }) : (0, _languageHandler._t)("%(brand)s was not given permission to send notifications - please try again", {
            brand
          });
          _Modal.default.createDialog(_ErrorDialog.default, {
            title: (0, _languageHandler._t)("Unable to enable Notifications"),
            description
          });
          return;
        }
        if (callback) callback();
        _PosthogAnalytics.PosthogAnalytics.instance.trackEvent({
          eventName: "PermissionChanged",
          permission: "Notification",
          granted: true
        });
        _dispatcher.default.dispatch({
          action: "notifier_enabled",
          value: true
        });
      });
    } else {
      _PosthogAnalytics.PosthogAnalytics.instance.trackEvent({
        eventName: "PermissionChanged",
        permission: "Notification",
        granted: false
      });
      _dispatcher.default.dispatch({
        action: "notifier_enabled",
        value: false
      });
    }
    // set the notifications_hidden flag, as the user has knowingly interacted
    // with the setting we shouldn't nag them any further
    this.setPromptHidden(true);
  }
  isEnabled() {
    return this.isPossible() && _SettingsStore.default.getValue("notificationsEnabled");
  }
  isPossible() {
    const plaf = _PlatformPeg.default.get();
    if (!plaf?.supportsNotifications()) return false;
    if (!plaf.maySendNotifications()) return false;
    return true; // possible, but not necessarily enabled
  }

  isBodyEnabled() {
    return this.isEnabled() && _SettingsStore.default.getValue("notificationBodyEnabled");
  }
  isAudioEnabled() {
    // We don't route Audio via the HTML Notifications API so it is possible regardless of other things
    return _SettingsStore.default.getValue("audioNotificationsEnabled");
  }
  setPromptHidden(hidden) {
    let persistent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
    this.toolbarHidden = hidden;
    (0, _DesktopNotificationsToast.hideToast)();

    // update the info to localStorage for persistent settings
    if (persistent && global.localStorage) {
      global.localStorage.setItem("notifications_hidden", String(hidden));
    }
  }
  shouldShowPrompt() {
    const client = _MatrixClientPeg.MatrixClientPeg.get();
    if (!client) {
      return false;
    }
    const isGuest = client.isGuest();
    return !isGuest && this.supportsDesktopNotifications() && !(0, _NotificationControllers.isPushNotifyDisabled)() && !this.isEnabled() && !this.isPromptHidden();
  }
  isPromptHidden() {
    // Check localStorage for any such meta data
    if (global.localStorage) {
      return global.localStorage.getItem("notifications_hidden") === "true";
    }
    return !!this.toolbarHidden;
  }
  // XXX: exported for tests
  evaluateEvent(ev) {
    // Mute notifications for broadcast info events
    if (ev.getType() === _voiceBroadcast.VoiceBroadcastInfoEventType) return;
    let roomId = ev.getRoomId();
    if (_LegacyCallHandler.default.instance.getSupportsVirtualRooms()) {
      // Attempt to translate a virtual room to a native one
      const nativeRoomId = _VoipUserMapper.default.sharedInstance().nativeRoomForVirtualRoom(roomId);
      if (nativeRoomId) {
        roomId = nativeRoomId;
      }
    }
    const room = _MatrixClientPeg.MatrixClientPeg.get().getRoom(roomId);
    if (!room) {
      // e.g we are in the process of joining a room.
      // Seen in the cypress lazy-loading test.
      return;
    }
    const actions = _MatrixClientPeg.MatrixClientPeg.get().getPushActionsForEvent(ev);
    if (actions?.notify) {
      this.performCustomEventHandling(ev);
      const store = _SDKContext.SdkContextClass.instance.roomViewStore;
      const isViewingRoom = store.getRoomId() === room.roomId;
      const threadId = ev.getId() !== ev.threadRootId ? ev.threadRootId : undefined;
      const isViewingThread = store.getThreadId() === threadId;
      const isViewingEventTimeline = isViewingRoom && (!threadId || isViewingThread);
      if (isViewingEventTimeline && _UserActivity.default.sharedInstance().userActiveRecently() && !_Modal.default.hasDialogs()) {
        // don't bother notifying as user was recently active in this room
        return;
      }
      if (this.isEnabled()) {
        this.displayPopupNotification(ev, room);
      }
      if (actions.tweaks.sound && this.isAudioEnabled()) {
        _PlatformPeg.default.get()?.loudNotification(ev, room);
        this.playAudioNotification(ev, room);
      }
    }
  }

  /**
   * Some events require special handling such as showing in-app toasts
   */
  performCustomEventHandling(ev) {
    if (_Call.ElementCall.CALL_EVENT_TYPE.names.includes(ev.getType()) && _SettingsStore.default.getValue("feature_group_calls")) {
      _ToastStore.default.sharedInstance().addOrReplaceToast({
        key: (0, _IncomingCallToast.getIncomingCallToastKey)(ev.getStateKey()),
        priority: 100,
        component: _IncomingCallToast.IncomingCallToast,
        bodyClassName: "mx_IncomingCallToast",
        props: {
          callEvent: ev
        }
      });
    }
  }
}
if (!window.mxNotifier) {
  window.mxNotifier = new NotifierClass();
}
var _default = window.mxNotifier;
exports.default = _default;
const Notifier = window.mxNotifier;
exports.Notifier = Notifier;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfZXZlbnQiLCJyZXF1aXJlIiwiX3Jvb20iLCJfY2xpZW50IiwiX2xvZ2dlciIsIl9ldmVudDIiLCJfbG9jYXRpb24iLCJfc3luYyIsIl9NYXRyaXhDbGllbnRQZWciLCJfUG9zdGhvZ0FuYWx5dGljcyIsIl9TZGtDb25maWciLCJfaW50ZXJvcFJlcXVpcmVEZWZhdWx0IiwiX1BsYXRmb3JtUGVnIiwiVGV4dEZvckV2ZW50IiwiX2ludGVyb3BSZXF1aXJlV2lsZGNhcmQiLCJBdmF0YXIiLCJfZGlzcGF0Y2hlciIsIl9sYW5ndWFnZUhhbmRsZXIiLCJfTW9kYWwiLCJfU2V0dGluZ3NTdG9yZSIsIl9EZXNrdG9wTm90aWZpY2F0aW9uc1RvYXN0IiwiX1NldHRpbmdMZXZlbCIsIl9Ob3RpZmljYXRpb25Db250cm9sbGVycyIsIl9Vc2VyQWN0aXZpdHkiLCJfTWVkaWEiLCJfRXJyb3JEaWFsb2ciLCJfTGVnYWN5Q2FsbEhhbmRsZXIiLCJfVm9pcFVzZXJNYXBwZXIiLCJfU0RLQ29udGV4dCIsIl9ub3RpZmljYXRpb25zIiwiX0luY29taW5nQ2FsbFRvYXN0IiwiX1RvYXN0U3RvcmUiLCJfQ2FsbCIsIl92b2ljZUJyb2FkY2FzdCIsIl9nZXRTZW5kZXJOYW1lIiwiX2dldFJlcXVpcmVXaWxkY2FyZENhY2hlIiwibm9kZUludGVyb3AiLCJXZWFrTWFwIiwiY2FjaGVCYWJlbEludGVyb3AiLCJjYWNoZU5vZGVJbnRlcm9wIiwib2JqIiwiX19lc01vZHVsZSIsImRlZmF1bHQiLCJjYWNoZSIsImhhcyIsImdldCIsIm5ld09iaiIsImhhc1Byb3BlcnR5RGVzY3JpcHRvciIsIk9iamVjdCIsImRlZmluZVByb3BlcnR5IiwiZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yIiwia2V5IiwicHJvdG90eXBlIiwiaGFzT3duUHJvcGVydHkiLCJjYWxsIiwiZGVzYyIsInNldCIsIk1BWF9QRU5ESU5HX0VOQ1JZUFRFRCIsIm1zZ1R5cGVIYW5kbGVycyIsIk1zZ1R5cGUiLCJLZXlWZXJpZmljYXRpb25SZXF1ZXN0IiwiZXZlbnQiLCJuYW1lIiwic2VuZGVyIiwiX3QiLCJNX0xPQ0FUSU9OIiwidGV4dEZvckxvY2F0aW9uRXZlbnQiLCJhbHROYW1lIiwiQXVkaW8iLCJnZXRDb250ZW50IiwiVm9pY2VCcm9hZGNhc3RDaHVua0V2ZW50VHlwZSIsInNlcXVlbmNlIiwic2VuZGVyTmFtZSIsImdldFNlbmRlck5hbWUiLCJ0ZXh0Rm9yRXZlbnQiLCJNYXRyaXhDbGllbnRQZWciLCJOb3RpZmllckNsYXNzIiwiY29uc3RydWN0b3IiLCJfZGVmaW5lUHJvcGVydHkyIiwic3RhdGUiLCJwcmV2U3RhdGUiLCJkYXRhIiwiU3luY1N0YXRlIiwiU3luY2luZyIsImlzU3luY2luZyIsIlN0b3BwZWQiLCJFcnJvciIsImluY2x1ZGVzIiwiZnJvbUNhY2hlIiwiY3JlYXRlTG9jYWxOb3RpZmljYXRpb25TZXR0aW5nc0lmTmVlZGVkIiwiZXYiLCJyb29tIiwidG9TdGFydE9mVGltZWxpbmUiLCJyZW1vdmVkIiwibGl2ZUV2ZW50IiwiZ2V0U2VuZGVyIiwiZ2V0VXNlcklkIiwiZGVjcnlwdEV2ZW50SWZOZWVkZWQiLCJpc0JlaW5nRGVjcnlwdGVkIiwiaXNEZWNyeXB0aW9uRmFpbHVyZSIsInBlbmRpbmdFbmNyeXB0ZWRFdmVudElkcyIsInB1c2giLCJnZXRJZCIsImxlbmd0aCIsInNoaWZ0IiwiZXZhbHVhdGVFdmVudCIsImlkeCIsImluZGV4T2YiLCJzcGxpY2UiLCJnZXRVbnJlYWROb3RpZmljYXRpb25Db3VudCIsInBsYWYiLCJQbGF0Zm9ybVBlZyIsIm5vdGlmc0J5Um9vbSIsInJvb21JZCIsInVuZGVmaW5lZCIsIm5vdGlmIiwiY2xlYXJOb3RpZmljYXRpb24iLCJub3RpZmljYXRpb25NZXNzYWdlRm9yRXZlbnQiLCJtc2dUeXBlIiwibXNndHlwZSIsImRpc3BsYXlQb3B1cE5vdGlmaWNhdGlvbiIsImNsaSIsInN1cHBvcnRzTm90aWZpY2F0aW9ucyIsIm1heVNlbmROb3RpZmljYXRpb25zIiwibG9jYWxOb3RpZmljYXRpb25zQXJlU2lsZW5jZWQiLCJtc2ciLCJ0aXRsZSIsImJvZHkiLCJnZXRUeXBlIiwiaXNCb2R5RW5hYmxlZCIsImF2YXRhclVybCIsIlNldHRpbmdzU3RvcmUiLCJnZXRWYWx1ZSIsImF2YXRhclVybEZvck1lbWJlciIsImRpc3BsYXlOb3RpZmljYXRpb24iLCJnZXRSb29tSWQiLCJnZXRTb3VuZEZvclJvb20iLCJjb250ZW50IiwidXJsIiwibG9nZ2VyIiwid2FybiIsInN0YXJ0c1dpdGgiLCJtZWRpYUZyb21NeGMiLCJzcmNIdHRwIiwidHlwZSIsInNpemUiLCJwbGF5QXVkaW9Ob3RpZmljYXRpb24iLCJzb3VuZCIsImxvZyIsInNlbGVjdG9yIiwiZG9jdW1lbnQiLCJxdWVyeVNlbGVjdG9yIiwiYXVkaW9FbGVtZW50IiwiZXJyb3IiLCJhcHBlbmRDaGlsZCIsInBsYXkiLCJleCIsInN0YXJ0Iiwib24iLCJSb29tRXZlbnQiLCJUaW1lbGluZSIsIm9uRXZlbnQiLCJSZWNlaXB0Iiwib25Sb29tUmVjZWlwdCIsIk1hdHJpeEV2ZW50RXZlbnQiLCJEZWNyeXB0ZWQiLCJvbkV2ZW50RGVjcnlwdGVkIiwiQ2xpZW50RXZlbnQiLCJTeW5jIiwib25TeW5jU3RhdGVDaGFuZ2UiLCJ0b29sYmFySGlkZGVuIiwic3RvcCIsInJlbW92ZUxpc3RlbmVyIiwic3VwcG9ydHNEZXNrdG9wTm90aWZpY2F0aW9ucyIsInNldEVuYWJsZWQiLCJlbmFibGUiLCJjYWxsYmFjayIsImlzTGV2ZWxTdXBwb3J0ZWQiLCJTZXR0aW5nTGV2ZWwiLCJERVZJQ0UiLCJzZXRWYWx1ZSIsImlzRW5hYmxlZCIsInJlcXVlc3ROb3RpZmljYXRpb25QZXJtaXNzaW9uIiwidGhlbiIsInJlc3VsdCIsImJyYW5kIiwiU2RrQ29uZmlnIiwiZGVzY3JpcHRpb24iLCJNb2RhbCIsImNyZWF0ZURpYWxvZyIsIkVycm9yRGlhbG9nIiwiUG9zdGhvZ0FuYWx5dGljcyIsImluc3RhbmNlIiwidHJhY2tFdmVudCIsImV2ZW50TmFtZSIsInBlcm1pc3Npb24iLCJncmFudGVkIiwiZGlzIiwiZGlzcGF0Y2giLCJhY3Rpb24iLCJ2YWx1ZSIsInNldFByb21wdEhpZGRlbiIsImlzUG9zc2libGUiLCJpc0F1ZGlvRW5hYmxlZCIsImhpZGRlbiIsInBlcnNpc3RlbnQiLCJhcmd1bWVudHMiLCJoaWRlTm90aWZpY2F0aW9uc1RvYXN0IiwiZ2xvYmFsIiwibG9jYWxTdG9yYWdlIiwic2V0SXRlbSIsIlN0cmluZyIsInNob3VsZFNob3dQcm9tcHQiLCJjbGllbnQiLCJpc0d1ZXN0IiwiaXNQdXNoTm90aWZ5RGlzYWJsZWQiLCJpc1Byb21wdEhpZGRlbiIsImdldEl0ZW0iLCJWb2ljZUJyb2FkY2FzdEluZm9FdmVudFR5cGUiLCJMZWdhY3lDYWxsSGFuZGxlciIsImdldFN1cHBvcnRzVmlydHVhbFJvb21zIiwibmF0aXZlUm9vbUlkIiwiVm9pcFVzZXJNYXBwZXIiLCJzaGFyZWRJbnN0YW5jZSIsIm5hdGl2ZVJvb21Gb3JWaXJ0dWFsUm9vbSIsImdldFJvb20iLCJhY3Rpb25zIiwiZ2V0UHVzaEFjdGlvbnNGb3JFdmVudCIsIm5vdGlmeSIsInBlcmZvcm1DdXN0b21FdmVudEhhbmRsaW5nIiwic3RvcmUiLCJTZGtDb250ZXh0Q2xhc3MiLCJyb29tVmlld1N0b3JlIiwiaXNWaWV3aW5nUm9vbSIsInRocmVhZElkIiwidGhyZWFkUm9vdElkIiwiaXNWaWV3aW5nVGhyZWFkIiwiZ2V0VGhyZWFkSWQiLCJpc1ZpZXdpbmdFdmVudFRpbWVsaW5lIiwiVXNlckFjdGl2aXR5IiwidXNlckFjdGl2ZVJlY2VudGx5IiwiaGFzRGlhbG9ncyIsInR3ZWFrcyIsImxvdWROb3RpZmljYXRpb24iLCJFbGVtZW50Q2FsbCIsIkNBTExfRVZFTlRfVFlQRSIsIm5hbWVzIiwiVG9hc3RTdG9yZSIsImFkZE9yUmVwbGFjZVRvYXN0IiwiZ2V0SW5jb21pbmdDYWxsVG9hc3RLZXkiLCJnZXRTdGF0ZUtleSIsInByaW9yaXR5IiwiY29tcG9uZW50IiwiSW5jb21pbmdDYWxsVG9hc3QiLCJib2R5Q2xhc3NOYW1lIiwicHJvcHMiLCJjYWxsRXZlbnQiLCJ3aW5kb3ciLCJteE5vdGlmaWVyIiwiX2RlZmF1bHQiLCJleHBvcnRzIiwiTm90aWZpZXIiXSwic291cmNlcyI6WyIuLi9zcmMvTm90aWZpZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbkNvcHlyaWdodCAyMDE1LCAyMDE2IE9wZW5NYXJrZXQgTHRkXG5Db3B5cmlnaHQgMjAxNyBWZWN0b3IgQ3JlYXRpb25zIEx0ZFxuQ29weXJpZ2h0IDIwMTcgTmV3IFZlY3RvciBMdGRcbkNvcHlyaWdodCAyMDIwIFRoZSBNYXRyaXgub3JnIEZvdW5kYXRpb24gQy5JLkMuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuKi9cblxuaW1wb3J0IHsgTWF0cml4RXZlbnQsIE1hdHJpeEV2ZW50RXZlbnQgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbW9kZWxzL2V2ZW50XCI7XG5pbXBvcnQgeyBSb29tLCBSb29tRXZlbnQgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbW9kZWxzL3Jvb21cIjtcbmltcG9ydCB7IENsaWVudEV2ZW50IH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL2NsaWVudFwiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL2xvZ2dlclwiO1xuaW1wb3J0IHsgTXNnVHlwZSB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9AdHlwZXMvZXZlbnRcIjtcbmltcG9ydCB7IE1fTE9DQVRJT04gfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvQHR5cGVzL2xvY2F0aW9uXCI7XG5pbXBvcnQgeyBQZXJtaXNzaW9uQ2hhbmdlZCBhcyBQZXJtaXNzaW9uQ2hhbmdlZEV2ZW50IH0gZnJvbSBcIkBtYXRyaXgtb3JnL2FuYWx5dGljcy1ldmVudHMvdHlwZXMvdHlwZXNjcmlwdC9QZXJtaXNzaW9uQ2hhbmdlZFwiO1xuaW1wb3J0IHsgSVN5bmNTdGF0ZURhdGEsIFN5bmNTdGF0ZSB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9zeW5jXCI7XG5pbXBvcnQgeyBJUm9vbVRpbWVsaW5lRGF0YSB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9tYXRyaXhcIjtcblxuaW1wb3J0IHsgTWF0cml4Q2xpZW50UGVnIH0gZnJvbSBcIi4vTWF0cml4Q2xpZW50UGVnXCI7XG5pbXBvcnQgeyBQb3N0aG9nQW5hbHl0aWNzIH0gZnJvbSBcIi4vUG9zdGhvZ0FuYWx5dGljc1wiO1xuaW1wb3J0IFNka0NvbmZpZyBmcm9tIFwiLi9TZGtDb25maWdcIjtcbmltcG9ydCBQbGF0Zm9ybVBlZyBmcm9tIFwiLi9QbGF0Zm9ybVBlZ1wiO1xuaW1wb3J0ICogYXMgVGV4dEZvckV2ZW50IGZyb20gXCIuL1RleHRGb3JFdmVudFwiO1xuaW1wb3J0ICogYXMgQXZhdGFyIGZyb20gXCIuL0F2YXRhclwiO1xuaW1wb3J0IGRpcyBmcm9tIFwiLi9kaXNwYXRjaGVyL2Rpc3BhdGNoZXJcIjtcbmltcG9ydCB7IF90IH0gZnJvbSBcIi4vbGFuZ3VhZ2VIYW5kbGVyXCI7XG5pbXBvcnQgTW9kYWwgZnJvbSBcIi4vTW9kYWxcIjtcbmltcG9ydCBTZXR0aW5nc1N0b3JlIGZyb20gXCIuL3NldHRpbmdzL1NldHRpbmdzU3RvcmVcIjtcbmltcG9ydCB7IGhpZGVUb2FzdCBhcyBoaWRlTm90aWZpY2F0aW9uc1RvYXN0IH0gZnJvbSBcIi4vdG9hc3RzL0Rlc2t0b3BOb3RpZmljYXRpb25zVG9hc3RcIjtcbmltcG9ydCB7IFNldHRpbmdMZXZlbCB9IGZyb20gXCIuL3NldHRpbmdzL1NldHRpbmdMZXZlbFwiO1xuaW1wb3J0IHsgaXNQdXNoTm90aWZ5RGlzYWJsZWQgfSBmcm9tIFwiLi9zZXR0aW5ncy9jb250cm9sbGVycy9Ob3RpZmljYXRpb25Db250cm9sbGVyc1wiO1xuaW1wb3J0IFVzZXJBY3Rpdml0eSBmcm9tIFwiLi9Vc2VyQWN0aXZpdHlcIjtcbmltcG9ydCB7IG1lZGlhRnJvbU14YyB9IGZyb20gXCIuL2N1c3RvbWlzYXRpb25zL01lZGlhXCI7XG5pbXBvcnQgRXJyb3JEaWFsb2cgZnJvbSBcIi4vY29tcG9uZW50cy92aWV3cy9kaWFsb2dzL0Vycm9yRGlhbG9nXCI7XG5pbXBvcnQgTGVnYWN5Q2FsbEhhbmRsZXIgZnJvbSBcIi4vTGVnYWN5Q2FsbEhhbmRsZXJcIjtcbmltcG9ydCBWb2lwVXNlck1hcHBlciBmcm9tIFwiLi9Wb2lwVXNlck1hcHBlclwiO1xuaW1wb3J0IHsgU2RrQ29udGV4dENsYXNzIH0gZnJvbSBcIi4vY29udGV4dHMvU0RLQ29udGV4dFwiO1xuaW1wb3J0IHsgbG9jYWxOb3RpZmljYXRpb25zQXJlU2lsZW5jZWQsIGNyZWF0ZUxvY2FsTm90aWZpY2F0aW9uU2V0dGluZ3NJZk5lZWRlZCB9IGZyb20gXCIuL3V0aWxzL25vdGlmaWNhdGlvbnNcIjtcbmltcG9ydCB7IGdldEluY29taW5nQ2FsbFRvYXN0S2V5LCBJbmNvbWluZ0NhbGxUb2FzdCB9IGZyb20gXCIuL3RvYXN0cy9JbmNvbWluZ0NhbGxUb2FzdFwiO1xuaW1wb3J0IFRvYXN0U3RvcmUgZnJvbSBcIi4vc3RvcmVzL1RvYXN0U3RvcmVcIjtcbmltcG9ydCB7IEVsZW1lbnRDYWxsIH0gZnJvbSBcIi4vbW9kZWxzL0NhbGxcIjtcbmltcG9ydCB7IFZvaWNlQnJvYWRjYXN0Q2h1bmtFdmVudFR5cGUsIFZvaWNlQnJvYWRjYXN0SW5mb0V2ZW50VHlwZSB9IGZyb20gXCIuL3ZvaWNlLWJyb2FkY2FzdFwiO1xuaW1wb3J0IHsgZ2V0U2VuZGVyTmFtZSB9IGZyb20gXCIuL3V0aWxzL2V2ZW50L2dldFNlbmRlck5hbWVcIjtcblxuLypcbiAqIERpc3BhdGNoZXM6XG4gKiB7XG4gKiAgIGFjdGlvbjogXCJub3RpZmllcl9lbmFibGVkXCIsXG4gKiAgIHZhbHVlOiBib29sZWFuXG4gKiB9XG4gKi9cblxuY29uc3QgTUFYX1BFTkRJTkdfRU5DUllQVEVEID0gMjA7XG5cbi8qXG5PdmVycmlkZSBib3RoIHRoZSBjb250ZW50IGJvZHkgYW5kIHRoZSBUZXh0Rm9yRXZlbnQgaGFuZGxlciBmb3Igc3BlY2lmaWMgbXNndHlwZXMsIGluIG5vdGlmaWNhdGlvbnMuXG5UaGlzIGlzIHVzZWZ1bCB3aGVuIHRoZSBjb250ZW50IGJvZHkgY29udGFpbnMgZmFsbGJhY2sgdGV4dCB0aGF0IHdvdWxkIGV4cGxhaW4gdGhhdCB0aGUgY2xpZW50IGNhbid0IGhhbmRsZSBhIHBhcnRpY3VsYXJcbnR5cGUgb2YgdGlsZS5cbiovXG5jb25zdCBtc2dUeXBlSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChldmVudDogTWF0cml4RXZlbnQpID0+IHN0cmluZyB8IG51bGw+ID0ge1xuICAgIFtNc2dUeXBlLktleVZlcmlmaWNhdGlvblJlcXVlc3RdOiAoZXZlbnQ6IE1hdHJpeEV2ZW50KSA9PiB7XG4gICAgICAgIGNvbnN0IG5hbWUgPSAoZXZlbnQuc2VuZGVyIHx8IHt9KS5uYW1lO1xuICAgICAgICByZXR1cm4gX3QoXCIlKG5hbWUpcyBpcyByZXF1ZXN0aW5nIHZlcmlmaWNhdGlvblwiLCB7IG5hbWUgfSk7XG4gICAgfSxcbiAgICBbTV9MT0NBVElPTi5uYW1lXTogKGV2ZW50OiBNYXRyaXhFdmVudCkgPT4ge1xuICAgICAgICByZXR1cm4gVGV4dEZvckV2ZW50LnRleHRGb3JMb2NhdGlvbkV2ZW50KGV2ZW50KSgpO1xuICAgIH0sXG4gICAgW01fTE9DQVRJT04uYWx0TmFtZV06IChldmVudDogTWF0cml4RXZlbnQpID0+IHtcbiAgICAgICAgcmV0dXJuIFRleHRGb3JFdmVudC50ZXh0Rm9yTG9jYXRpb25FdmVudChldmVudCkoKTtcbiAgICB9LFxuICAgIFtNc2dUeXBlLkF1ZGlvXTogKGV2ZW50OiBNYXRyaXhFdmVudCk6IHN0cmluZyB8IG51bGwgPT4ge1xuICAgICAgICBpZiAoZXZlbnQuZ2V0Q29udGVudCgpPy5bVm9pY2VCcm9hZGNhc3RDaHVua0V2ZW50VHlwZV0pIHtcbiAgICAgICAgICAgIGlmIChldmVudC5nZXRDb250ZW50KCk/LltWb2ljZUJyb2FkY2FzdENodW5rRXZlbnRUeXBlXT8uc2VxdWVuY2UgPT09IDEpIHtcbiAgICAgICAgICAgICAgICAvLyBTaG93IGEgbm90aWZpY2F0aW9uIGZvciB0aGUgZmlyc3QgYnJvYWRjYXN0IGNodW5rLlxuICAgICAgICAgICAgICAgIC8vIEF0IHRoaXMgcG9pbnQgYSB1c2VyIHJlY2VpdmVkIHNvbWV0aGluZyB0byBsaXN0ZW4gdG8uXG4gICAgICAgICAgICAgICAgcmV0dXJuIF90KFwiJShzZW5kZXJOYW1lKXMgc3RhcnRlZCBhIHZvaWNlIGJyb2FkY2FzdFwiLCB7IHNlbmRlck5hbWU6IGdldFNlbmRlck5hbWUoZXZlbnQpIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBNdXRlIG90aGVyIGJyb2FkY2FzdCBjaHVua3NcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIFRleHRGb3JFdmVudC50ZXh0Rm9yRXZlbnQoZXZlbnQsIE1hdHJpeENsaWVudFBlZy5nZXQoKSk7XG4gICAgfSxcbn07XG5cbmNsYXNzIE5vdGlmaWVyQ2xhc3Mge1xuICAgIHByaXZhdGUgbm90aWZzQnlSb29tOiBSZWNvcmQ8c3RyaW5nLCBOb3RpZmljYXRpb25bXT4gPSB7fTtcblxuICAgIC8vIEEgbGlzdCBvZiBldmVudCBJRHMgdGhhdCB3ZSd2ZSByZWNlaXZlZCBidXQgbmVlZCB0byB3YWl0IHVudGlsXG4gICAgLy8gdGhleSdyZSBkZWNyeXB0ZWQgdW50aWwgd2UgZGVjaWRlIHdoZXRoZXIgdG8gbm90aWZ5IGZvciB0aGVtXG4gICAgLy8gb3Igbm90XG4gICAgcHJpdmF0ZSBwZW5kaW5nRW5jcnlwdGVkRXZlbnRJZHM6IHN0cmluZ1tdID0gW107XG5cbiAgICBwcml2YXRlIHRvb2xiYXJIaWRkZW4/OiBib29sZWFuO1xuICAgIHByaXZhdGUgaXNTeW5jaW5nPzogYm9vbGVhbjtcblxuICAgIHB1YmxpYyBub3RpZmljYXRpb25NZXNzYWdlRm9yRXZlbnQoZXY6IE1hdHJpeEV2ZW50KTogc3RyaW5nIHwgbnVsbCB7XG4gICAgICAgIGNvbnN0IG1zZ1R5cGUgPSBldi5nZXRDb250ZW50KCkubXNndHlwZTtcbiAgICAgICAgaWYgKG1zZ1R5cGUgJiYgbXNnVHlwZUhhbmRsZXJzLmhhc093blByb3BlcnR5KG1zZ1R5cGUpKSB7XG4gICAgICAgICAgICByZXR1cm4gbXNnVHlwZUhhbmRsZXJzW21zZ1R5cGVdKGV2KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gVGV4dEZvckV2ZW50LnRleHRGb3JFdmVudChldiwgTWF0cml4Q2xpZW50UGVnLmdldCgpKTtcbiAgICB9XG5cbiAgICAvLyBYWFg6IGV4cG9ydGVkIGZvciB0ZXN0c1xuICAgIHB1YmxpYyBkaXNwbGF5UG9wdXBOb3RpZmljYXRpb24oZXY6IE1hdHJpeEV2ZW50LCByb29tOiBSb29tKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IHBsYWYgPSBQbGF0Zm9ybVBlZy5nZXQoKTtcbiAgICAgICAgY29uc3QgY2xpID0gTWF0cml4Q2xpZW50UGVnLmdldCgpO1xuICAgICAgICBpZiAoIXBsYWYpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXBsYWYuc3VwcG9ydHNOb3RpZmljYXRpb25zKCkgfHwgIXBsYWYubWF5U2VuZE5vdGlmaWNhdGlvbnMoKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGxvY2FsTm90aWZpY2F0aW9uc0FyZVNpbGVuY2VkKGNsaSkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBtc2cgPSB0aGlzLm5vdGlmaWNhdGlvbk1lc3NhZ2VGb3JFdmVudChldik7XG4gICAgICAgIGlmICghbXNnKSByZXR1cm47XG5cbiAgICAgICAgbGV0IHRpdGxlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgIGlmICghZXYuc2VuZGVyIHx8IHJvb20ubmFtZSA9PT0gZXYuc2VuZGVyLm5hbWUpIHtcbiAgICAgICAgICAgIHRpdGxlID0gcm9vbS5uYW1lO1xuICAgICAgICAgICAgLy8gbm90aWZpY2F0aW9uTWVzc2FnZUZvckV2ZW50IGluY2x1ZGVzIHNlbmRlciwgYnV0IHdlIGFscmVhZHkgaGF2ZSB0aGUgc2VuZGVyIGhlcmVcbiAgICAgICAgICAgIGNvbnN0IG1zZ1R5cGUgPSBldi5nZXRDb250ZW50KCkubXNndHlwZTtcbiAgICAgICAgICAgIGlmIChldi5nZXRDb250ZW50KCkuYm9keSAmJiAoIW1zZ1R5cGUgfHwgIW1zZ1R5cGVIYW5kbGVycy5oYXNPd25Qcm9wZXJ0eShtc2dUeXBlKSkpIHtcbiAgICAgICAgICAgICAgICBtc2cgPSBldi5nZXRDb250ZW50KCkuYm9keTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChldi5nZXRUeXBlKCkgPT09IFwibS5yb29tLm1lbWJlclwiKSB7XG4gICAgICAgICAgICAvLyBjb250ZXh0IGlzIGFsbCBpbiB0aGUgbWVzc2FnZSBoZXJlLCB3ZSBkb24ndCBuZWVkXG4gICAgICAgICAgICAvLyB0byBkaXNwbGF5IHNlbmRlciBpbmZvXG4gICAgICAgICAgICB0aXRsZSA9IHJvb20ubmFtZTtcbiAgICAgICAgfSBlbHNlIGlmIChldi5zZW5kZXIpIHtcbiAgICAgICAgICAgIHRpdGxlID0gZXYuc2VuZGVyLm5hbWUgKyBcIiAoXCIgKyByb29tLm5hbWUgKyBcIilcIjtcbiAgICAgICAgICAgIC8vIG5vdGlmaWNhdGlvbk1lc3NhZ2VGb3JFdmVudCBpbmNsdWRlcyBzZW5kZXIsIGJ1dCB3ZSd2ZSBqdXN0IG91dCBzZW5kZXIgaW4gdGhlIHRpdGxlXG4gICAgICAgICAgICBjb25zdCBtc2dUeXBlID0gZXYuZ2V0Q29udGVudCgpLm1zZ3R5cGU7XG4gICAgICAgICAgICBpZiAoZXYuZ2V0Q29udGVudCgpLmJvZHkgJiYgKCFtc2dUeXBlIHx8ICFtc2dUeXBlSGFuZGxlcnMuaGFzT3duUHJvcGVydHkobXNnVHlwZSkpKSB7XG4gICAgICAgICAgICAgICAgbXNnID0gZXYuZ2V0Q29udGVudCgpLmJvZHk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRpdGxlKSByZXR1cm47XG5cbiAgICAgICAgaWYgKCF0aGlzLmlzQm9keUVuYWJsZWQoKSkge1xuICAgICAgICAgICAgbXNnID0gXCJcIjtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBhdmF0YXJVcmw6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICAgICAgICBpZiAoZXYuc2VuZGVyICYmICFTZXR0aW5nc1N0b3JlLmdldFZhbHVlKFwibG93QmFuZHdpZHRoXCIpKSB7XG4gICAgICAgICAgICBhdmF0YXJVcmwgPSBBdmF0YXIuYXZhdGFyVXJsRm9yTWVtYmVyKGV2LnNlbmRlciwgNDAsIDQwLCBcImNyb3BcIik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBub3RpZiA9IHBsYWYuZGlzcGxheU5vdGlmaWNhdGlvbih0aXRsZSwgbXNnISwgYXZhdGFyVXJsLCByb29tLCBldik7XG5cbiAgICAgICAgLy8gaWYgZGlzcGxheU5vdGlmaWNhdGlvbiByZXR1cm5zIG5vbi1udWxsLCAgdGhlIHBsYXRmb3JtIHN1cHBvcnRzXG4gICAgICAgIC8vIGNsZWFyaW5nIG5vdGlmaWNhdGlvbnMgbGF0ZXIsIHNvIGtlZXAgdHJhY2sgb2YgdGhpcy5cbiAgICAgICAgaWYgKG5vdGlmKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5ub3RpZnNCeVJvb21bZXYuZ2V0Um9vbUlkKCkhXSA9PT0gdW5kZWZpbmVkKSB0aGlzLm5vdGlmc0J5Um9vbVtldi5nZXRSb29tSWQoKSFdID0gW107XG4gICAgICAgICAgICB0aGlzLm5vdGlmc0J5Um9vbVtldi5nZXRSb29tSWQoKSFdLnB1c2gobm90aWYpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGdldFNvdW5kRm9yUm9vbShyb29tSWQ6IHN0cmluZyk6IHtcbiAgICAgICAgdXJsOiBzdHJpbmc7XG4gICAgICAgIG5hbWU6IHN0cmluZztcbiAgICAgICAgdHlwZTogc3RyaW5nO1xuICAgICAgICBzaXplOiBzdHJpbmc7XG4gICAgfSB8IG51bGwge1xuICAgICAgICAvLyBXZSBkbyBubyBjYWNoaW5nIGhlcmUgYmVjYXVzZSB0aGUgU0RLIGNhY2hlcyBzZXR0aW5nXG4gICAgICAgIC8vIGFuZCB0aGUgYnJvd3NlciB3aWxsIGNhY2hlIHRoZSBzb3VuZC5cbiAgICAgICAgY29uc3QgY29udGVudCA9IFNldHRpbmdzU3RvcmUuZ2V0VmFsdWUoXCJub3RpZmljYXRpb25Tb3VuZFwiLCByb29tSWQpO1xuICAgICAgICBpZiAoIWNvbnRlbnQpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBjb250ZW50LnVybCAhPT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgbG9nZ2VyLndhcm4oYCR7cm9vbUlkfSBoYXMgY3VzdG9tIG5vdGlmaWNhdGlvbiBzb3VuZCBldmVudCwgYnV0IG5vIHVybCBzdHJpbmdgKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFjb250ZW50LnVybC5zdGFydHNXaXRoKFwibXhjOi8vXCIpKSB7XG4gICAgICAgICAgICBsb2dnZXIud2FybihgJHtyb29tSWR9IGhhcyBjdXN0b20gbm90aWZpY2F0aW9uIHNvdW5kIGV2ZW50LCBidXQgdXJsIGlzIG5vdCBhIG14YyB1cmxgKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWRlYWxseSBpbiBoZXJlIHdlIGNvdWxkIHVzZSBNU0MxMzEwIHRvIGRldGVjdCB0aGUgdHlwZSBvZiBmaWxlLCBhbmQgcmVqZWN0IGl0LlxuXG4gICAgICAgIGNvbnN0IHVybCA9IG1lZGlhRnJvbU14Yyhjb250ZW50LnVybCkuc3JjSHR0cDtcbiAgICAgICAgaWYgKCF1cmwpIHtcbiAgICAgICAgICAgIGxvZ2dlci53YXJuKFwiU29tZXRoaW5nIHdlbnQgd3Jvbmcgd2hlbiBnZW5lcmF0aW5nIHNyYyBodHRwIHVybCBmb3IgbXhjXCIpO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdXJsLFxuICAgICAgICAgICAgbmFtZTogY29udGVudC5uYW1lLFxuICAgICAgICAgICAgdHlwZTogY29udGVudC50eXBlLFxuICAgICAgICAgICAgc2l6ZTogY29udGVudC5zaXplLFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vIFhYWDogRXhwb3J0ZWQgZm9yIHRlc3RzXG4gICAgcHVibGljIGFzeW5jIHBsYXlBdWRpb05vdGlmaWNhdGlvbihldjogTWF0cml4RXZlbnQsIHJvb206IFJvb20pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgY29uc3QgY2xpID0gTWF0cml4Q2xpZW50UGVnLmdldCgpO1xuICAgICAgICBpZiAobG9jYWxOb3RpZmljYXRpb25zQXJlU2lsZW5jZWQoY2xpKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc291bmQgPSB0aGlzLmdldFNvdW5kRm9yUm9vbShyb29tLnJvb21JZCk7XG4gICAgICAgIGxvZ2dlci5sb2coYEdvdCBzb3VuZCAkeyhzb3VuZCAmJiBzb3VuZC5uYW1lKSB8fCBcImRlZmF1bHRcIn0gZm9yICR7cm9vbS5yb29tSWR9YCk7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHNlbGVjdG9yID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MQXVkaW9FbGVtZW50PihcbiAgICAgICAgICAgICAgICBzb3VuZCA/IGBhdWRpb1tzcmM9JyR7c291bmQudXJsfSddYCA6IFwiI21lc3NhZ2VBdWRpb1wiLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGxldCBhdWRpb0VsZW1lbnQgPSBzZWxlY3RvcjtcbiAgICAgICAgICAgIGlmICghYXVkaW9FbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgaWYgKCFzb3VuZCkge1xuICAgICAgICAgICAgICAgICAgICBsb2dnZXIuZXJyb3IoXCJObyBhdWRpbyBlbGVtZW50IG9yIHNvdW5kIHRvIHBsYXkgZm9yIG5vdGlmaWNhdGlvblwiKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBhdWRpb0VsZW1lbnQgPSBuZXcgQXVkaW8oc291bmQudXJsKTtcbiAgICAgICAgICAgICAgICBpZiAoc291bmQudHlwZSkge1xuICAgICAgICAgICAgICAgICAgICBhdWRpb0VsZW1lbnQudHlwZSA9IHNvdW5kLnR5cGU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYXVkaW9FbGVtZW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGF3YWl0IGF1ZGlvRWxlbWVudC5wbGF5KCk7XG4gICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgICBsb2dnZXIud2FybihcIkNhdWdodCBlcnJvciB3aGVuIHRyeWluZyB0byBmZXRjaCByb29tIG5vdGlmaWNhdGlvbiBzb3VuZDpcIiwgZXgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIHN0YXJ0KCk6IHZvaWQge1xuICAgICAgICBNYXRyaXhDbGllbnRQZWcuZ2V0KCkub24oUm9vbUV2ZW50LlRpbWVsaW5lLCB0aGlzLm9uRXZlbnQpO1xuICAgICAgICBNYXRyaXhDbGllbnRQZWcuZ2V0KCkub24oUm9vbUV2ZW50LlJlY2VpcHQsIHRoaXMub25Sb29tUmVjZWlwdCk7XG4gICAgICAgIE1hdHJpeENsaWVudFBlZy5nZXQoKS5vbihNYXRyaXhFdmVudEV2ZW50LkRlY3J5cHRlZCwgdGhpcy5vbkV2ZW50RGVjcnlwdGVkKTtcbiAgICAgICAgTWF0cml4Q2xpZW50UGVnLmdldCgpLm9uKENsaWVudEV2ZW50LlN5bmMsIHRoaXMub25TeW5jU3RhdGVDaGFuZ2UpO1xuICAgICAgICB0aGlzLnRvb2xiYXJIaWRkZW4gPSBmYWxzZTtcbiAgICAgICAgdGhpcy5pc1N5bmNpbmcgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc3RvcCgpOiB2b2lkIHtcbiAgICAgICAgaWYgKE1hdHJpeENsaWVudFBlZy5nZXQoKSkge1xuICAgICAgICAgICAgTWF0cml4Q2xpZW50UGVnLmdldCgpLnJlbW92ZUxpc3RlbmVyKFJvb21FdmVudC5UaW1lbGluZSwgdGhpcy5vbkV2ZW50KTtcbiAgICAgICAgICAgIE1hdHJpeENsaWVudFBlZy5nZXQoKS5yZW1vdmVMaXN0ZW5lcihSb29tRXZlbnQuUmVjZWlwdCwgdGhpcy5vblJvb21SZWNlaXB0KTtcbiAgICAgICAgICAgIE1hdHJpeENsaWVudFBlZy5nZXQoKS5yZW1vdmVMaXN0ZW5lcihNYXRyaXhFdmVudEV2ZW50LkRlY3J5cHRlZCwgdGhpcy5vbkV2ZW50RGVjcnlwdGVkKTtcbiAgICAgICAgICAgIE1hdHJpeENsaWVudFBlZy5nZXQoKS5yZW1vdmVMaXN0ZW5lcihDbGllbnRFdmVudC5TeW5jLCB0aGlzLm9uU3luY1N0YXRlQ2hhbmdlKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmlzU3luY2luZyA9IGZhbHNlO1xuICAgIH1cblxuICAgIHB1YmxpYyBzdXBwb3J0c0Rlc2t0b3BOb3RpZmljYXRpb25zKCk6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gUGxhdGZvcm1QZWcuZ2V0KCk/LnN1cHBvcnRzTm90aWZpY2F0aW9ucygpID8/IGZhbHNlO1xuICAgIH1cblxuICAgIHB1YmxpYyBzZXRFbmFibGVkKGVuYWJsZTogYm9vbGVhbiwgY2FsbGJhY2s/OiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IHBsYWYgPSBQbGF0Zm9ybVBlZy5nZXQoKTtcbiAgICAgICAgaWYgKCFwbGFmKSByZXR1cm47XG5cbiAgICAgICAgLy8gRGV2IG5vdGU6IFdlIGRvbid0IHNldCB0aGUgXCJub3RpZmljYXRpb25zRW5hYmxlZFwiIHNldHRpbmcgdG8gdHJ1ZSBoZXJlIGJlY2F1c2UgaXQgaXMgYVxuICAgICAgICAvLyBjYWxjdWxhdGVkIHZhbHVlLiBJdCBpcyBkZXRlcm1pbmVkIGJhc2VkIHVwb24gd2hldGhlciBvciBub3QgdGhlIG1hc3RlciBydWxlIGlzIGVuYWJsZWRcbiAgICAgICAgLy8gYW5kIG90aGVyIGZsYWdzLiBTZXR0aW5nIGl0IGhlcmUgd291bGQgY2F1c2UgYSBjaXJjdWxhciByZWZlcmVuY2UuXG5cbiAgICAgICAgLy8gbWFrZSBzdXJlIHRoYXQgd2UgcGVyc2lzdCB0aGUgY3VycmVudCBzZXR0aW5nIGF1ZGlvX2VuYWJsZWQgc2V0dGluZ1xuICAgICAgICAvLyBiZWZvcmUgY2hhbmdpbmcgYW55dGhpbmdcbiAgICAgICAgaWYgKFNldHRpbmdzU3RvcmUuaXNMZXZlbFN1cHBvcnRlZChTZXR0aW5nTGV2ZWwuREVWSUNFKSkge1xuICAgICAgICAgICAgU2V0dGluZ3NTdG9yZS5zZXRWYWx1ZShcImF1ZGlvTm90aWZpY2F0aW9uc0VuYWJsZWRcIiwgbnVsbCwgU2V0dGluZ0xldmVsLkRFVklDRSwgdGhpcy5pc0VuYWJsZWQoKSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZW5hYmxlKSB7XG4gICAgICAgICAgICAvLyBBdHRlbXB0IHRvIGdldCBwZXJtaXNzaW9uIGZyb20gdXNlclxuICAgICAgICAgICAgcGxhZi5yZXF1ZXN0Tm90aWZpY2F0aW9uUGVybWlzc2lvbigpLnRoZW4oKHJlc3VsdCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQgIT09IFwiZ3JhbnRlZFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFRoZSBwZXJtaXNzaW9uIHJlcXVlc3Qgd2FzIGRpc21pc3NlZCBvciBkZW5pZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogU3VwcG9ydCBhbHRlcm5hdGl2ZSBicmFuZGluZyBpbiBtZXNzYWdpbmdcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYnJhbmQgPSBTZGtDb25maWcuZ2V0KCkuYnJhbmQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlc2NyaXB0aW9uID1cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9PT0gXCJkZW5pZWRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gX3QoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCIlKGJyYW5kKXMgZG9lcyBub3QgaGF2ZSBwZXJtaXNzaW9uIHRvIHNlbmQgeW91IG5vdGlmaWNhdGlvbnMgLSBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwicGxlYXNlIGNoZWNrIHlvdXIgYnJvd3NlciBzZXR0aW5nc1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgYnJhbmQgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IF90KFwiJShicmFuZClzIHdhcyBub3QgZ2l2ZW4gcGVybWlzc2lvbiB0byBzZW5kIG5vdGlmaWNhdGlvbnMgLSBwbGVhc2UgdHJ5IGFnYWluXCIsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmFuZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBNb2RhbC5jcmVhdGVEaWFsb2coRXJyb3JEaWFsb2csIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiBfdChcIlVuYWJsZSB0byBlbmFibGUgTm90aWZpY2F0aW9uc1wiKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soKTtcblxuICAgICAgICAgICAgICAgIFBvc3Rob2dBbmFseXRpY3MuaW5zdGFuY2UudHJhY2tFdmVudDxQZXJtaXNzaW9uQ2hhbmdlZEV2ZW50Pih7XG4gICAgICAgICAgICAgICAgICAgIGV2ZW50TmFtZTogXCJQZXJtaXNzaW9uQ2hhbmdlZFwiLFxuICAgICAgICAgICAgICAgICAgICBwZXJtaXNzaW9uOiBcIk5vdGlmaWNhdGlvblwiLFxuICAgICAgICAgICAgICAgICAgICBncmFudGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGRpcy5kaXNwYXRjaCh7XG4gICAgICAgICAgICAgICAgICAgIGFjdGlvbjogXCJub3RpZmllcl9lbmFibGVkXCIsXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiB0cnVlLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBQb3N0aG9nQW5hbHl0aWNzLmluc3RhbmNlLnRyYWNrRXZlbnQ8UGVybWlzc2lvbkNoYW5nZWRFdmVudD4oe1xuICAgICAgICAgICAgICAgIGV2ZW50TmFtZTogXCJQZXJtaXNzaW9uQ2hhbmdlZFwiLFxuICAgICAgICAgICAgICAgIHBlcm1pc3Npb246IFwiTm90aWZpY2F0aW9uXCIsXG4gICAgICAgICAgICAgICAgZ3JhbnRlZDogZmFsc2UsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGRpcy5kaXNwYXRjaCh7XG4gICAgICAgICAgICAgICAgYWN0aW9uOiBcIm5vdGlmaWVyX2VuYWJsZWRcIixcbiAgICAgICAgICAgICAgICB2YWx1ZTogZmFsc2UsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICAvLyBzZXQgdGhlIG5vdGlmaWNhdGlvbnNfaGlkZGVuIGZsYWcsIGFzIHRoZSB1c2VyIGhhcyBrbm93aW5nbHkgaW50ZXJhY3RlZFxuICAgICAgICAvLyB3aXRoIHRoZSBzZXR0aW5nIHdlIHNob3VsZG4ndCBuYWcgdGhlbSBhbnkgZnVydGhlclxuICAgICAgICB0aGlzLnNldFByb21wdEhpZGRlbih0cnVlKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgaXNFbmFibGVkKCk6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gdGhpcy5pc1Bvc3NpYmxlKCkgJiYgU2V0dGluZ3NTdG9yZS5nZXRWYWx1ZShcIm5vdGlmaWNhdGlvbnNFbmFibGVkXCIpO1xuICAgIH1cblxuICAgIHB1YmxpYyBpc1Bvc3NpYmxlKCk6IGJvb2xlYW4ge1xuICAgICAgICBjb25zdCBwbGFmID0gUGxhdGZvcm1QZWcuZ2V0KCk7XG4gICAgICAgIGlmICghcGxhZj8uc3VwcG9ydHNOb3RpZmljYXRpb25zKCkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgaWYgKCFwbGFmLm1heVNlbmROb3RpZmljYXRpb25zKCkpIHJldHVybiBmYWxzZTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gcG9zc2libGUsIGJ1dCBub3QgbmVjZXNzYXJpbHkgZW5hYmxlZFxuICAgIH1cblxuICAgIHB1YmxpYyBpc0JvZHlFbmFibGVkKCk6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gdGhpcy5pc0VuYWJsZWQoKSAmJiBTZXR0aW5nc1N0b3JlLmdldFZhbHVlKFwibm90aWZpY2F0aW9uQm9keUVuYWJsZWRcIik7XG4gICAgfVxuXG4gICAgcHVibGljIGlzQXVkaW9FbmFibGVkKCk6IGJvb2xlYW4ge1xuICAgICAgICAvLyBXZSBkb24ndCByb3V0ZSBBdWRpbyB2aWEgdGhlIEhUTUwgTm90aWZpY2F0aW9ucyBBUEkgc28gaXQgaXMgcG9zc2libGUgcmVnYXJkbGVzcyBvZiBvdGhlciB0aGluZ3NcbiAgICAgICAgcmV0dXJuIFNldHRpbmdzU3RvcmUuZ2V0VmFsdWUoXCJhdWRpb05vdGlmaWNhdGlvbnNFbmFibGVkXCIpO1xuICAgIH1cblxuICAgIHB1YmxpYyBzZXRQcm9tcHRIaWRkZW4oaGlkZGVuOiBib29sZWFuLCBwZXJzaXN0ZW50ID0gdHJ1ZSk6IHZvaWQge1xuICAgICAgICB0aGlzLnRvb2xiYXJIaWRkZW4gPSBoaWRkZW47XG5cbiAgICAgICAgaGlkZU5vdGlmaWNhdGlvbnNUb2FzdCgpO1xuXG4gICAgICAgIC8vIHVwZGF0ZSB0aGUgaW5mbyB0byBsb2NhbFN0b3JhZ2UgZm9yIHBlcnNpc3RlbnQgc2V0dGluZ3NcbiAgICAgICAgaWYgKHBlcnNpc3RlbnQgJiYgZ2xvYmFsLmxvY2FsU3RvcmFnZSkge1xuICAgICAgICAgICAgZ2xvYmFsLmxvY2FsU3RvcmFnZS5zZXRJdGVtKFwibm90aWZpY2F0aW9uc19oaWRkZW5cIiwgU3RyaW5nKGhpZGRlbikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIHNob3VsZFNob3dQcm9tcHQoKTogYm9vbGVhbiB7XG4gICAgICAgIGNvbnN0IGNsaWVudCA9IE1hdHJpeENsaWVudFBlZy5nZXQoKTtcbiAgICAgICAgaWYgKCFjbGllbnQpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBpc0d1ZXN0ID0gY2xpZW50LmlzR3Vlc3QoKTtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICFpc0d1ZXN0ICYmXG4gICAgICAgICAgICB0aGlzLnN1cHBvcnRzRGVza3RvcE5vdGlmaWNhdGlvbnMoKSAmJlxuICAgICAgICAgICAgIWlzUHVzaE5vdGlmeURpc2FibGVkKCkgJiZcbiAgICAgICAgICAgICF0aGlzLmlzRW5hYmxlZCgpICYmXG4gICAgICAgICAgICAhdGhpcy5pc1Byb21wdEhpZGRlbigpXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBpc1Byb21wdEhpZGRlbigpOiBib29sZWFuIHtcbiAgICAgICAgLy8gQ2hlY2sgbG9jYWxTdG9yYWdlIGZvciBhbnkgc3VjaCBtZXRhIGRhdGFcbiAgICAgICAgaWYgKGdsb2JhbC5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgICAgICAgIHJldHVybiBnbG9iYWwubG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJub3RpZmljYXRpb25zX2hpZGRlblwiKSA9PT0gXCJ0cnVlXCI7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gISF0aGlzLnRvb2xiYXJIaWRkZW47XG4gICAgfVxuXG4gICAgLy8gWFhYOiBFeHBvcnRlZCBmb3IgdGVzdHNcbiAgICBwdWJsaWMgb25TeW5jU3RhdGVDaGFuZ2UgPSAoc3RhdGU6IFN5bmNTdGF0ZSwgcHJldlN0YXRlOiBTeW5jU3RhdGUgfCBudWxsLCBkYXRhPzogSVN5bmNTdGF0ZURhdGEpOiB2b2lkID0+IHtcbiAgICAgICAgaWYgKHN0YXRlID09PSBTeW5jU3RhdGUuU3luY2luZykge1xuICAgICAgICAgICAgdGhpcy5pc1N5bmNpbmcgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSBTeW5jU3RhdGUuU3RvcHBlZCB8fCBzdGF0ZSA9PT0gU3luY1N0YXRlLkVycm9yKSB7XG4gICAgICAgICAgICB0aGlzLmlzU3luY2luZyA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gd2FpdCBmb3IgZmlyc3Qgbm9uLWNhY2hlZCBzeW5jIHRvIGNvbXBsZXRlXG4gICAgICAgIGlmICghW1N5bmNTdGF0ZS5TdG9wcGVkLCBTeW5jU3RhdGUuRXJyb3JdLmluY2x1ZGVzKHN0YXRlKSAmJiAhZGF0YT8uZnJvbUNhY2hlKSB7XG4gICAgICAgICAgICBjcmVhdGVMb2NhbE5vdGlmaWNhdGlvblNldHRpbmdzSWZOZWVkZWQoTWF0cml4Q2xpZW50UGVnLmdldCgpKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBwcml2YXRlIG9uRXZlbnQgPSAoXG4gICAgICAgIGV2OiBNYXRyaXhFdmVudCxcbiAgICAgICAgcm9vbTogUm9vbSB8IHVuZGVmaW5lZCxcbiAgICAgICAgdG9TdGFydE9mVGltZWxpbmU6IGJvb2xlYW4gfCB1bmRlZmluZWQsXG4gICAgICAgIHJlbW92ZWQ6IGJvb2xlYW4sXG4gICAgICAgIGRhdGE6IElSb29tVGltZWxpbmVEYXRhLFxuICAgICk6IHZvaWQgPT4ge1xuICAgICAgICBpZiAoIWRhdGEubGl2ZUV2ZW50KSByZXR1cm47IC8vIG9ubHkgbm90aWZ5IGZvciBuZXcgdGhpbmdzLCBub3Qgb2xkLlxuICAgICAgICBpZiAoIXRoaXMuaXNTeW5jaW5nKSByZXR1cm47IC8vIGRvbid0IGFsZXJ0IGZvciBhbnkgbWVzc2FnZXMgaW5pdGlhbGx5XG4gICAgICAgIGlmIChldi5nZXRTZW5kZXIoKSA9PT0gTWF0cml4Q2xpZW50UGVnLmdldCgpLmdldFVzZXJJZCgpKSByZXR1cm47XG5cbiAgICAgICAgTWF0cml4Q2xpZW50UGVnLmdldCgpLmRlY3J5cHRFdmVudElmTmVlZGVkKGV2KTtcblxuICAgICAgICAvLyBJZiBpdCdzIGFuIGVuY3J5cHRlZCBldmVudCBhbmQgdGhlIHR5cGUgaXMgc3RpbGwgJ20ucm9vbS5lbmNyeXB0ZWQnLFxuICAgICAgICAvLyBpdCBoYXNuJ3QgeWV0IGJlZW4gZGVjcnlwdGVkLCBzbyB3YWl0IHVudGlsIGl0IGlzLlxuICAgICAgICBpZiAoZXYuaXNCZWluZ0RlY3J5cHRlZCgpIHx8IGV2LmlzRGVjcnlwdGlvbkZhaWx1cmUoKSkge1xuICAgICAgICAgICAgdGhpcy5wZW5kaW5nRW5jcnlwdGVkRXZlbnRJZHMucHVzaChldi5nZXRJZCgpISk7XG4gICAgICAgICAgICAvLyBkb24ndCBsZXQgdGhlIGxpc3QgZmlsbCB1cCBpbmRlZmluaXRlbHlcbiAgICAgICAgICAgIHdoaWxlICh0aGlzLnBlbmRpbmdFbmNyeXB0ZWRFdmVudElkcy5sZW5ndGggPiBNQVhfUEVORElOR19FTkNSWVBURUQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBlbmRpbmdFbmNyeXB0ZWRFdmVudElkcy5zaGlmdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5ldmFsdWF0ZUV2ZW50KGV2KTtcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBvbkV2ZW50RGVjcnlwdGVkID0gKGV2OiBNYXRyaXhFdmVudCk6IHZvaWQgPT4ge1xuICAgICAgICAvLyAnZGVjcnlwdGVkJyBtZWFucyB0aGUgZGVjcnlwdGlvbiBwcm9jZXNzIGhhcyBmaW5pc2hlZDogaXQgbWF5IGhhdmUgZmFpbGVkLFxuICAgICAgICAvLyBpbiB3aGljaCBjYXNlIGl0IG1pZ2h0IGRlY3J5cHQgc29vbiBpZiB0aGUga2V5cyBhcnJpdmVcbiAgICAgICAgaWYgKGV2LmlzRGVjcnlwdGlvbkZhaWx1cmUoKSkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IGlkeCA9IHRoaXMucGVuZGluZ0VuY3J5cHRlZEV2ZW50SWRzLmluZGV4T2YoZXYuZ2V0SWQoKSEpO1xuICAgICAgICBpZiAoaWR4ID09PSAtMSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMucGVuZGluZ0VuY3J5cHRlZEV2ZW50SWRzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICB0aGlzLmV2YWx1YXRlRXZlbnQoZXYpO1xuICAgIH07XG5cbiAgICBwcml2YXRlIG9uUm9vbVJlY2VpcHQgPSAoZXY6IE1hdHJpeEV2ZW50LCByb29tOiBSb29tKTogdm9pZCA9PiB7XG4gICAgICAgIGlmIChyb29tLmdldFVucmVhZE5vdGlmaWNhdGlvbkNvdW50KCkgPT09IDApIHtcbiAgICAgICAgICAgIC8vIGlkZWFsbHkgd2Ugd291bGQgY2xlYXIgZWFjaCBub3RpZmljYXRpb24gd2hlbiBpdCB3YXMgcmVhZCxcbiAgICAgICAgICAgIC8vIGJ1dCB3ZSBoYXZlIG5vIHdheSwgZ2l2ZW4gYSByZWFkIHJlY2VpcHQsIHRvIGtub3cgd2hldGhlclxuICAgICAgICAgICAgLy8gdGhlIHJlY2VpcHQgY29tZXMgYmVmb3JlIG9yIGFmdGVyIGFuIGV2ZW50LCBzbyB3ZSBjYW4ndFxuICAgICAgICAgICAgLy8gZG8gdGhpcy4gSW5zdGVhZCwgY2xlYXIgYWxsIG5vdGlmaWNhdGlvbnMgZm9yIGEgcm9vbSBvbmNlXG4gICAgICAgICAgICAvLyB0aGVyZSBhcmUgbm8gbm90aWZzIGxlZnQgaW4gdGhhdCByb29tLiwgd2hpY2ggaXMgbm90IHF1aXRlXG4gICAgICAgICAgICAvLyBhcyBnb29kIGJ1dCBpdCdzIHNvbWV0aGluZy5cbiAgICAgICAgICAgIGNvbnN0IHBsYWYgPSBQbGF0Zm9ybVBlZy5nZXQoKTtcbiAgICAgICAgICAgIGlmICghcGxhZikgcmV0dXJuO1xuICAgICAgICAgICAgaWYgKHRoaXMubm90aWZzQnlSb29tW3Jvb20ucm9vbUlkXSA9PT0gdW5kZWZpbmVkKSByZXR1cm47XG4gICAgICAgICAgICBmb3IgKGNvbnN0IG5vdGlmIG9mIHRoaXMubm90aWZzQnlSb29tW3Jvb20ucm9vbUlkXSkge1xuICAgICAgICAgICAgICAgIHBsYWYuY2xlYXJOb3RpZmljYXRpb24obm90aWYpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVsZXRlIHRoaXMubm90aWZzQnlSb29tW3Jvb20ucm9vbUlkXTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBYWFg6IGV4cG9ydGVkIGZvciB0ZXN0c1xuICAgIHB1YmxpYyBldmFsdWF0ZUV2ZW50KGV2OiBNYXRyaXhFdmVudCk6IHZvaWQge1xuICAgICAgICAvLyBNdXRlIG5vdGlmaWNhdGlvbnMgZm9yIGJyb2FkY2FzdCBpbmZvIGV2ZW50c1xuICAgICAgICBpZiAoZXYuZ2V0VHlwZSgpID09PSBWb2ljZUJyb2FkY2FzdEluZm9FdmVudFR5cGUpIHJldHVybjtcbiAgICAgICAgbGV0IHJvb21JZCA9IGV2LmdldFJvb21JZCgpITtcbiAgICAgICAgaWYgKExlZ2FjeUNhbGxIYW5kbGVyLmluc3RhbmNlLmdldFN1cHBvcnRzVmlydHVhbFJvb21zKCkpIHtcbiAgICAgICAgICAgIC8vIEF0dGVtcHQgdG8gdHJhbnNsYXRlIGEgdmlydHVhbCByb29tIHRvIGEgbmF0aXZlIG9uZVxuICAgICAgICAgICAgY29uc3QgbmF0aXZlUm9vbUlkID0gVm9pcFVzZXJNYXBwZXIuc2hhcmVkSW5zdGFuY2UoKS5uYXRpdmVSb29tRm9yVmlydHVhbFJvb20ocm9vbUlkKTtcbiAgICAgICAgICAgIGlmIChuYXRpdmVSb29tSWQpIHtcbiAgICAgICAgICAgICAgICByb29tSWQgPSBuYXRpdmVSb29tSWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgcm9vbSA9IE1hdHJpeENsaWVudFBlZy5nZXQoKS5nZXRSb29tKHJvb21JZCk7XG4gICAgICAgIGlmICghcm9vbSkge1xuICAgICAgICAgICAgLy8gZS5nIHdlIGFyZSBpbiB0aGUgcHJvY2VzcyBvZiBqb2luaW5nIGEgcm9vbS5cbiAgICAgICAgICAgIC8vIFNlZW4gaW4gdGhlIGN5cHJlc3MgbGF6eS1sb2FkaW5nIHRlc3QuXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhY3Rpb25zID0gTWF0cml4Q2xpZW50UGVnLmdldCgpLmdldFB1c2hBY3Rpb25zRm9yRXZlbnQoZXYpO1xuXG4gICAgICAgIGlmIChhY3Rpb25zPy5ub3RpZnkpIHtcbiAgICAgICAgICAgIHRoaXMucGVyZm9ybUN1c3RvbUV2ZW50SGFuZGxpbmcoZXYpO1xuXG4gICAgICAgICAgICBjb25zdCBzdG9yZSA9IFNka0NvbnRleHRDbGFzcy5pbnN0YW5jZS5yb29tVmlld1N0b3JlO1xuICAgICAgICAgICAgY29uc3QgaXNWaWV3aW5nUm9vbSA9IHN0b3JlLmdldFJvb21JZCgpID09PSByb29tLnJvb21JZDtcbiAgICAgICAgICAgIGNvbnN0IHRocmVhZElkOiBzdHJpbmcgfCB1bmRlZmluZWQgPSBldi5nZXRJZCgpICE9PSBldi50aHJlYWRSb290SWQgPyBldi50aHJlYWRSb290SWQgOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICBjb25zdCBpc1ZpZXdpbmdUaHJlYWQgPSBzdG9yZS5nZXRUaHJlYWRJZCgpID09PSB0aHJlYWRJZDtcblxuICAgICAgICAgICAgY29uc3QgaXNWaWV3aW5nRXZlbnRUaW1lbGluZSA9IGlzVmlld2luZ1Jvb20gJiYgKCF0aHJlYWRJZCB8fCBpc1ZpZXdpbmdUaHJlYWQpO1xuXG4gICAgICAgICAgICBpZiAoaXNWaWV3aW5nRXZlbnRUaW1lbGluZSAmJiBVc2VyQWN0aXZpdHkuc2hhcmVkSW5zdGFuY2UoKS51c2VyQWN0aXZlUmVjZW50bHkoKSAmJiAhTW9kYWwuaGFzRGlhbG9ncygpKSB7XG4gICAgICAgICAgICAgICAgLy8gZG9uJ3QgYm90aGVyIG5vdGlmeWluZyBhcyB1c2VyIHdhcyByZWNlbnRseSBhY3RpdmUgaW4gdGhpcyByb29tXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5pc0VuYWJsZWQoKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGlzcGxheVBvcHVwTm90aWZpY2F0aW9uKGV2LCByb29tKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChhY3Rpb25zLnR3ZWFrcy5zb3VuZCAmJiB0aGlzLmlzQXVkaW9FbmFibGVkKCkpIHtcbiAgICAgICAgICAgICAgICBQbGF0Zm9ybVBlZy5nZXQoKT8ubG91ZE5vdGlmaWNhdGlvbihldiwgcm9vbSk7XG4gICAgICAgICAgICAgICAgdGhpcy5wbGF5QXVkaW9Ob3RpZmljYXRpb24oZXYsIHJvb20pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU29tZSBldmVudHMgcmVxdWlyZSBzcGVjaWFsIGhhbmRsaW5nIHN1Y2ggYXMgc2hvd2luZyBpbi1hcHAgdG9hc3RzXG4gICAgICovXG4gICAgcHJpdmF0ZSBwZXJmb3JtQ3VzdG9tRXZlbnRIYW5kbGluZyhldjogTWF0cml4RXZlbnQpOiB2b2lkIHtcbiAgICAgICAgaWYgKEVsZW1lbnRDYWxsLkNBTExfRVZFTlRfVFlQRS5uYW1lcy5pbmNsdWRlcyhldi5nZXRUeXBlKCkpICYmIFNldHRpbmdzU3RvcmUuZ2V0VmFsdWUoXCJmZWF0dXJlX2dyb3VwX2NhbGxzXCIpKSB7XG4gICAgICAgICAgICBUb2FzdFN0b3JlLnNoYXJlZEluc3RhbmNlKCkuYWRkT3JSZXBsYWNlVG9hc3Qoe1xuICAgICAgICAgICAgICAgIGtleTogZ2V0SW5jb21pbmdDYWxsVG9hc3RLZXkoZXYuZ2V0U3RhdGVLZXkoKSEpLFxuICAgICAgICAgICAgICAgIHByaW9yaXR5OiAxMDAsXG4gICAgICAgICAgICAgICAgY29tcG9uZW50OiBJbmNvbWluZ0NhbGxUb2FzdCxcbiAgICAgICAgICAgICAgICBib2R5Q2xhc3NOYW1lOiBcIm14X0luY29taW5nQ2FsbFRvYXN0XCIsXG4gICAgICAgICAgICAgICAgcHJvcHM6IHsgY2FsbEV2ZW50OiBldiB9LFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmlmICghd2luZG93Lm14Tm90aWZpZXIpIHtcbiAgICB3aW5kb3cubXhOb3RpZmllciA9IG5ldyBOb3RpZmllckNsYXNzKCk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IHdpbmRvdy5teE5vdGlmaWVyO1xuZXhwb3J0IGNvbnN0IE5vdGlmaWVyOiBOb3RpZmllckNsYXNzID0gd2luZG93Lm14Tm90aWZpZXI7XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBbUJBLElBQUFBLE1BQUEsR0FBQUMsT0FBQTtBQUNBLElBQUFDLEtBQUEsR0FBQUQsT0FBQTtBQUNBLElBQUFFLE9BQUEsR0FBQUYsT0FBQTtBQUNBLElBQUFHLE9BQUEsR0FBQUgsT0FBQTtBQUNBLElBQUFJLE9BQUEsR0FBQUosT0FBQTtBQUNBLElBQUFLLFNBQUEsR0FBQUwsT0FBQTtBQUVBLElBQUFNLEtBQUEsR0FBQU4sT0FBQTtBQUdBLElBQUFPLGdCQUFBLEdBQUFQLE9BQUE7QUFDQSxJQUFBUSxpQkFBQSxHQUFBUixPQUFBO0FBQ0EsSUFBQVMsVUFBQSxHQUFBQyxzQkFBQSxDQUFBVixPQUFBO0FBQ0EsSUFBQVcsWUFBQSxHQUFBRCxzQkFBQSxDQUFBVixPQUFBO0FBQ0EsSUFBQVksWUFBQSxHQUFBQyx1QkFBQSxDQUFBYixPQUFBO0FBQ0EsSUFBQWMsTUFBQSxHQUFBRCx1QkFBQSxDQUFBYixPQUFBO0FBQ0EsSUFBQWUsV0FBQSxHQUFBTCxzQkFBQSxDQUFBVixPQUFBO0FBQ0EsSUFBQWdCLGdCQUFBLEdBQUFoQixPQUFBO0FBQ0EsSUFBQWlCLE1BQUEsR0FBQVAsc0JBQUEsQ0FBQVYsT0FBQTtBQUNBLElBQUFrQixjQUFBLEdBQUFSLHNCQUFBLENBQUFWLE9BQUE7QUFDQSxJQUFBbUIsMEJBQUEsR0FBQW5CLE9BQUE7QUFDQSxJQUFBb0IsYUFBQSxHQUFBcEIsT0FBQTtBQUNBLElBQUFxQix3QkFBQSxHQUFBckIsT0FBQTtBQUNBLElBQUFzQixhQUFBLEdBQUFaLHNCQUFBLENBQUFWLE9BQUE7QUFDQSxJQUFBdUIsTUFBQSxHQUFBdkIsT0FBQTtBQUNBLElBQUF3QixZQUFBLEdBQUFkLHNCQUFBLENBQUFW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