"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isConnected = exports.Layout = exports.JitsiCall = exports.ElementCall = exports.ConnectionState = exports.CallEvent = exports.Call = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _typedEventEmitter = require("matrix-js-sdk/src/models/typed-event-emitter");
var _logger = require("matrix-js-sdk/src/logger");
var _randomstring = require("matrix-js-sdk/src/randomstring");
var _room2 = require("matrix-js-sdk/src/models/room");
var _roomState = require("matrix-js-sdk/src/models/room-state");
var _call = require("matrix-js-sdk/src/webrtc/call");
var _NamespacedValue = require("matrix-js-sdk/src/NamespacedValue");
var _matrixWidgetApi = require("matrix-widget-api");
var _groupCall = require("matrix-js-sdk/src/webrtc/groupCall");
var _event = require("matrix-js-sdk/src/@types/event");
var _SdkConfig = _interopRequireWildcard(require("../SdkConfig"));
var _SettingsStore = _interopRequireDefault(require("../settings/SettingsStore"));
var _MediaDeviceHandler = _interopRequireWildcard(require("../MediaDeviceHandler"));
var _promise = require("../utils/promise");
var _WidgetUtils = _interopRequireDefault(require("../utils/WidgetUtils"));
var _WidgetType = require("../widgets/WidgetType");
var _ElementWidgetActions = require("../stores/widgets/ElementWidgetActions");
var _WidgetStore = _interopRequireDefault(require("../stores/WidgetStore"));
var _WidgetMessagingStore = require("../stores/widgets/WidgetMessagingStore");
var _ActiveWidgetStore = _interopRequireWildcard(require("../stores/ActiveWidgetStore"));
var _PlatformPeg = _interopRequireDefault(require("../PlatformPeg"));
var _languageHandler = require("../languageHandler");
var _DesktopCapturerSourcePicker = _interopRequireDefault(require("../components/views/elements/DesktopCapturerSourcePicker"));
var _Modal = _interopRequireDefault(require("../Modal"));
var _FontWatcher = require("../settings/watchers/FontWatcher");
var _PosthogAnalytics = require("../PosthogAnalytics");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
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

const TIMEOUT_MS = 16000;

// Waits until an event is emitted satisfying the given predicate
const waitForEvent = async function (emitter, event) {
  let pred = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : () => true;
  let listener;
  const wait = new Promise(resolve => {
    listener = function () {
      if (pred(...arguments)) resolve();
    };
    emitter.on(event, listener);
  });
  const timedOut = (await (0, _promise.timeout)(wait, false, TIMEOUT_MS)) === false;
  emitter.off(event, listener);
  if (timedOut) throw new Error("Timed out");
};
let ConnectionState = /*#__PURE__*/function (ConnectionState) {
  ConnectionState["Disconnected"] = "disconnected";
  ConnectionState["Connecting"] = "connecting";
  ConnectionState["Connected"] = "connected";
  ConnectionState["Disconnecting"] = "disconnecting";
  return ConnectionState;
}({});
exports.ConnectionState = ConnectionState;
const isConnected = state => state === ConnectionState.Connected || state === ConnectionState.Disconnecting;
exports.isConnected = isConnected;
let Layout = /*#__PURE__*/function (Layout) {
  Layout["Tile"] = "tile";
  Layout["Spotlight"] = "spotlight";
  return Layout;
}({});
exports.Layout = Layout;
let CallEvent = /*#__PURE__*/function (CallEvent) {
  CallEvent["ConnectionState"] = "connection_state";
  CallEvent["Participants"] = "participants";
  CallEvent["Layout"] = "layout";
  CallEvent["Destroy"] = "destroy";
  return CallEvent;
}({});
exports.CallEvent = CallEvent;
/**
 * A group call accessed through a widget.
 */
class Call extends _typedEventEmitter.TypedEventEmitter {
  /**
   * The widget's messaging, or null if disconnected.
   */
  get messaging() {
    return this._messaging;
  }
  set messaging(value) {
    this._messaging = value;
  }
  get roomId() {
    return this.widget.roomId;
  }
  get connectionState() {
    return this._connectionState;
  }
  set connectionState(value) {
    const prevValue = this._connectionState;
    this._connectionState = value;
    this.emit(CallEvent.ConnectionState, value, prevValue);
  }
  get connected() {
    return isConnected(this.connectionState);
  }
  /**
   * The participants in the call, as a map from members to device IDs.
   */
  get participants() {
    return this._participants;
  }
  set participants(value) {
    const prevValue = this._participants;
    this._participants = value;
    this.emit(CallEvent.Participants, value, prevValue);
  }
  constructor(
  /**
   * The widget used to access this call.
   */
  widget, client) {
    super();
    this.widget = widget;
    this.client = client;
    (0, _defineProperty2.default)(this, "widgetUid", _WidgetUtils.default.getWidgetUid(this.widget));
    (0, _defineProperty2.default)(this, "room", this.client.getRoom(this.roomId));
    /**
     * The time after which device member state should be considered expired.
     */
    (0, _defineProperty2.default)(this, "STUCK_DEVICE_TIMEOUT_MS", void 0);
    (0, _defineProperty2.default)(this, "_messaging", null);
    (0, _defineProperty2.default)(this, "_connectionState", ConnectionState.Disconnected);
    (0, _defineProperty2.default)(this, "_participants", new Map());
    (0, _defineProperty2.default)(this, "onMyMembership", async (_room, membership) => {
      if (membership !== "join") this.setDisconnected();
    });
    (0, _defineProperty2.default)(this, "onStopMessaging", uid => {
      if (uid === this.widgetUid) {
        _logger.logger.log("The widget died; treating this as a user hangup");
        this.setDisconnected();
      }
    });
    (0, _defineProperty2.default)(this, "beforeUnload", () => this.setDisconnected());
  }

  /**
   * Gets the call associated with the given room, if any.
   * @param {Room} room The room.
   * @returns {Call | null} The call.
   */
  static get(room) {
    return ElementCall.get(room) ?? JitsiCall.get(room);
  }

  /**
   * Performs a routine check of the call's associated room state, cleaning up
   * any data left over from an unclean disconnection.
   */

  /**
   * Contacts the widget to connect to the call.
   * @param {MediaDeviceInfo | null} audioInput The audio input to use, or
   *   null to start muted.
   * @param {MediaDeviceInfo | null} audioInput The video input to use, or
   *   null to start muted.
   */

  /**
   * Contacts the widget to disconnect from the call.
   */

  /**
   * Connects the user to the call using the media devices set in
   * MediaDeviceHandler. The widget associated with the call must be active
   * for this to succeed.
   */
  async connect() {
    this.connectionState = ConnectionState.Connecting;
    const {
      [_MediaDeviceHandler.MediaDeviceKindEnum.AudioInput]: audioInputs,
      [_MediaDeviceHandler.MediaDeviceKindEnum.VideoInput]: videoInputs
    } = await _MediaDeviceHandler.default.getDevices();
    let audioInput = null;
    if (!_MediaDeviceHandler.default.startWithAudioMuted) {
      const deviceId = _MediaDeviceHandler.default.getAudioInput();
      audioInput = audioInputs.find(d => d.deviceId === deviceId) ?? audioInputs[0] ?? null;
    }
    let videoInput = null;
    if (!_MediaDeviceHandler.default.startWithVideoMuted) {
      const deviceId = _MediaDeviceHandler.default.getVideoInput();
      videoInput = videoInputs.find(d => d.deviceId === deviceId) ?? videoInputs[0] ?? null;
    }
    const messagingStore = _WidgetMessagingStore.WidgetMessagingStore.instance;
    this.messaging = messagingStore.getMessagingForUid(this.widgetUid) ?? null;
    if (!this.messaging) {
      // The widget might still be initializing, so wait for it
      try {
        await waitForEvent(messagingStore, _WidgetMessagingStore.WidgetMessagingStoreEvent.StoreMessaging, (uid, widgetApi) => {
          if (uid === this.widgetUid) {
            this.messaging = widgetApi;
            return true;
          }
          return false;
        });
      } catch (e) {
        throw new Error(`Failed to bind call widget in room ${this.roomId}: ${e}`);
      }
    }
    try {
      await this.performConnection(audioInput, videoInput);
    } catch (e) {
      this.connectionState = ConnectionState.Disconnected;
      throw e;
    }
    this.room.on(_room2.RoomEvent.MyMembership, this.onMyMembership);
    _WidgetMessagingStore.WidgetMessagingStore.instance.on(_WidgetMessagingStore.WidgetMessagingStoreEvent.StopMessaging, this.onStopMessaging);
    window.addEventListener("beforeunload", this.beforeUnload);
    this.connectionState = ConnectionState.Connected;
  }

  /**
   * Disconnects the user from the call.
   */
  async disconnect() {
    if (this.connectionState !== ConnectionState.Connected) throw new Error("Not connected");
    this.connectionState = ConnectionState.Disconnecting;
    await this.performDisconnection();
    this.setDisconnected();
  }

  /**
   * Manually marks the call as disconnected and cleans up.
   */
  setDisconnected() {
    this.room.off(_room2.RoomEvent.MyMembership, this.onMyMembership);
    _WidgetMessagingStore.WidgetMessagingStore.instance.off(_WidgetMessagingStore.WidgetMessagingStoreEvent.StopMessaging, this.onStopMessaging);
    window.removeEventListener("beforeunload", this.beforeUnload);
    this.messaging = null;
    this.connectionState = ConnectionState.Disconnected;
  }

  /**
   * Stops all internal timers and tasks to prepare for garbage collection.
   */
  destroy() {
    if (this.connected) this.setDisconnected();
    this.emit(CallEvent.Destroy);
  }
}
exports.Call = Call;
/**
 * A group call using Jitsi as a backend.
 */
class JitsiCall extends Call {
  constructor(widget, client) {
    super(widget, client);
    (0, _defineProperty2.default)(this, "STUCK_DEVICE_TIMEOUT_MS", 1000 * 60 * 60);
    // 1 hour
    (0, _defineProperty2.default)(this, "resendDevicesTimer", null);
    (0, _defineProperty2.default)(this, "participantsExpirationTimer", null);
    (0, _defineProperty2.default)(this, "onRoomState", () => this.updateParticipants());
    (0, _defineProperty2.default)(this, "onConnectionState", async (state, prevState) => {
      if (state === ConnectionState.Connected && !isConnected(prevState)) {
        this.updateParticipants(); // Local echo

        // Tell others that we're connected, by adding our device to room state
        await this.addOurDevice();
        // Re-add this device every so often so our video member event doesn't become stale
        this.resendDevicesTimer = window.setInterval(async () => {
          _logger.logger.log(`Resending video member event for ${this.roomId}`);
          await this.addOurDevice();
        }, this.STUCK_DEVICE_TIMEOUT_MS * 3 / 4);
      } else if (state === ConnectionState.Disconnected && isConnected(prevState)) {
        this.updateParticipants(); // Local echo

        if (this.resendDevicesTimer !== null) {
          clearInterval(this.resendDevicesTimer);
          this.resendDevicesTimer = null;
        }
        // Tell others that we're disconnected, by removing our device from room state
        await this.removeOurDevice();
      }
    });
    (0, _defineProperty2.default)(this, "onDock", async () => {
      // The widget is no longer a PiP, so let's restore the default layout
      await this.messaging.transport.send(_ElementWidgetActions.ElementWidgetActions.TileLayout, {});
    });
    (0, _defineProperty2.default)(this, "onUndock", async () => {
      // The widget has become a PiP, so let's switch Jitsi to spotlight mode
      // to only show the active speaker and economize on space
      await this.messaging.transport.send(_ElementWidgetActions.ElementWidgetActions.SpotlightLayout, {});
    });
    (0, _defineProperty2.default)(this, "onHangup", async ev => {
      // If we're already in the middle of a client-initiated disconnection,
      // ignore the event
      if (this.connectionState === ConnectionState.Disconnecting) return;
      ev.preventDefault();

      // In case this hangup is caused by Jitsi Meet crashing at startup,
      // wait for the connection event in order to avoid racing
      if (this.connectionState === ConnectionState.Connecting) {
        await waitForEvent(this, CallEvent.ConnectionState);
      }
      await this.messaging.transport.reply(ev.detail, {}); // ack
      this.setDisconnected();
    });
    this.room.on(_roomState.RoomStateEvent.Update, this.onRoomState);
    this.on(CallEvent.ConnectionState, this.onConnectionState);
    this.updateParticipants();
  }
  static get(room) {
    // Only supported in video rooms
    if (_SettingsStore.default.getValue("feature_video_rooms") && room.isElementVideoRoom()) {
      const apps = _WidgetStore.default.instance.getApps(room.roomId);
      // The isVideoChannel field differentiates rich Jitsi calls from bare Jitsi widgets
      const jitsiWidget = apps.find(app => _WidgetType.WidgetType.JITSI.matches(app.type) && app.data?.isVideoChannel);
      if (jitsiWidget) return new JitsiCall(jitsiWidget, room.client);
    }
    return null;
  }
  static async create(room) {
    await _WidgetUtils.default.addJitsiWidget(room.client, room.roomId, _call.CallType.Video, "Group call", true, room.name);
  }
  updateParticipants() {
    if (this.participantsExpirationTimer !== null) {
      clearTimeout(this.participantsExpirationTimer);
      this.participantsExpirationTimer = null;
    }
    const participants = new Map();
    const now = Date.now();
    let allExpireAt = Infinity;
    for (const e of this.room.currentState.getStateEvents(JitsiCall.MEMBER_EVENT_TYPE)) {
      const member = this.room.getMember(e.getStateKey());
      const content = e.getContent();
      const expiresAt = typeof content.expires_ts === "number" ? content.expires_ts : -Infinity;
      let devices = expiresAt > now && Array.isArray(content.devices) ? content.devices.filter(d => typeof d === "string") : [];

      // Apply local echo for the disconnected case
      if (!this.connected && member?.userId === this.client.getUserId()) {
        devices = devices.filter(d => d !== this.client.getDeviceId());
      }
      // Must have a connected device and still be joined to the room
      if (devices.length > 0 && member?.membership === "join") {
        participants.set(member, new Set(devices));
        if (expiresAt < allExpireAt) allExpireAt = expiresAt;
      }
    }

    // Apply local echo for the connected case
    if (this.connected) {
      const localMember = this.room.getMember(this.client.getUserId());
      let devices = participants.get(localMember);
      if (devices === undefined) {
        devices = new Set();
        participants.set(localMember, devices);
      }
      devices.add(this.client.getDeviceId());
    }
    this.participants = participants;
    if (allExpireAt < Infinity) {
      this.participantsExpirationTimer = window.setTimeout(() => this.updateParticipants(), allExpireAt - now);
    }
  }

  /**
   * Updates our member state with the devices returned by the given function.
   * @param fn A function from the current devices to the new devices. If it
   *     returns null, the update is skipped.
   */
  async updateDevices(fn) {
    if (this.room.getMyMembership() !== "join") return;
    const event = this.room.currentState.getStateEvents(JitsiCall.MEMBER_EVENT_TYPE, this.client.getUserId());
    const content = event?.getContent();
    const expiresAt = typeof content?.expires_ts === "number" ? content.expires_ts : -Infinity;
    const devices = expiresAt > Date.now() && Array.isArray(content?.devices) ? content.devices : [];
    const newDevices = fn(devices);
    if (newDevices !== null) {
      const newContent = {
        devices: newDevices,
        expires_ts: Date.now() + this.STUCK_DEVICE_TIMEOUT_MS
      };
      await this.client.sendStateEvent(this.roomId, JitsiCall.MEMBER_EVENT_TYPE, newContent, this.client.getUserId());
    }
  }
  async clean() {
    const now = Date.now();
    const {
      devices: myDevices
    } = await this.client.getDevices();
    const deviceMap = new Map(myDevices.map(d => [d.device_id, d]));

    // Clean up our member state by filtering out logged out devices,
    // inactive devices, and our own device (if we're disconnected)
    await this.updateDevices(devices => {
      const newDevices = devices.filter(d => {
        const device = deviceMap.get(d);
        return device?.last_seen_ts !== undefined && !(d === this.client.getDeviceId() && !this.connected) && now - device.last_seen_ts < this.STUCK_DEVICE_TIMEOUT_MS;
      });

      // Skip the update if the devices are unchanged
      return newDevices.length === devices.length ? null : newDevices;
    });
  }
  async addOurDevice() {
    await this.updateDevices(devices => Array.from(new Set(devices).add(this.client.getDeviceId())));
  }
  async removeOurDevice() {
    await this.updateDevices(devices => {
      const devicesSet = new Set(devices);
      devicesSet.delete(this.client.getDeviceId());
      return Array.from(devicesSet);
    });
  }
  async performConnection(audioInput, videoInput) {
    // Ensure that the messaging doesn't get stopped while we're waiting for responses
    const dontStopMessaging = new Promise((resolve, reject) => {
      const messagingStore = _WidgetMessagingStore.WidgetMessagingStore.instance;
      const listener = uid => {
        if (uid === this.widgetUid) {
          cleanup();
          reject(new Error("Messaging stopped"));
        }
      };
      const done = () => {
        cleanup();
        resolve();
      };
      const cleanup = () => {
        messagingStore.off(_WidgetMessagingStore.WidgetMessagingStoreEvent.StopMessaging, listener);
        this.off(CallEvent.ConnectionState, done);
      };
      messagingStore.on(_WidgetMessagingStore.WidgetMessagingStoreEvent.StopMessaging, listener);
      this.on(CallEvent.ConnectionState, done);
    });

    // Empirically, it's possible for Jitsi Meet to crash instantly at startup,
    // sending a hangup event that races with the rest of this method, so we need
    // to add the hangup listener now rather than later
    this.messaging.on(`action:${_ElementWidgetActions.ElementWidgetActions.HangupCall}`, this.onHangup);

    // Actually perform the join
    const response = waitForEvent(this.messaging, `action:${_ElementWidgetActions.ElementWidgetActions.JoinCall}`, ev => {
      ev.preventDefault();
      this.messaging.transport.reply(ev.detail, {}); // ack
      return true;
    });
    const request = this.messaging.transport.send(_ElementWidgetActions.ElementWidgetActions.JoinCall, {
      audioInput: audioInput?.label ?? null,
      videoInput: videoInput?.label ?? null
    });
    try {
      await Promise.race([Promise.all([request, response]), dontStopMessaging]);
    } catch (e) {
      // If it timed out, clean up our advance preparations
      this.messaging.off(`action:${_ElementWidgetActions.ElementWidgetActions.HangupCall}`, this.onHangup);
      if (this.messaging.transport.ready) {
        // The messaging still exists, which means Jitsi might still be going in the background
        this.messaging.transport.send(_ElementWidgetActions.ElementWidgetActions.HangupCall, {
          force: true
        });
      }
      throw new Error(`Failed to join call in room ${this.roomId}: ${e}`);
    }
    _ActiveWidgetStore.default.instance.on(_ActiveWidgetStore.ActiveWidgetStoreEvent.Dock, this.onDock);
    _ActiveWidgetStore.default.instance.on(_ActiveWidgetStore.ActiveWidgetStoreEvent.Undock, this.onUndock);
  }
  async performDisconnection() {
    const response = waitForEvent(this.messaging, `action:${_ElementWidgetActions.ElementWidgetActions.HangupCall}`, ev => {
      ev.preventDefault();
      this.messaging.transport.reply(ev.detail, {}); // ack
      return true;
    });
    const request = this.messaging.transport.send(_ElementWidgetActions.ElementWidgetActions.HangupCall, {});
    try {
      await Promise.all([request, response]);
    } catch (e) {
      throw new Error(`Failed to hangup call in room ${this.roomId}: ${e}`);
    }
  }
  setDisconnected() {
    this.messaging.off(`action:${_ElementWidgetActions.ElementWidgetActions.HangupCall}`, this.onHangup);
    _ActiveWidgetStore.default.instance.off(_ActiveWidgetStore.ActiveWidgetStoreEvent.Dock, this.onDock);
    _ActiveWidgetStore.default.instance.off(_ActiveWidgetStore.ActiveWidgetStoreEvent.Undock, this.onUndock);
    super.setDisconnected();
  }
  destroy() {
    this.room.off(_roomState.RoomStateEvent.Update, this.onRoomState);
    this.on(CallEvent.ConnectionState, this.onConnectionState);
    if (this.participantsExpirationTimer !== null) {
      clearTimeout(this.participantsExpirationTimer);
      this.participantsExpirationTimer = null;
    }
    if (this.resendDevicesTimer !== null) {
      clearInterval(this.resendDevicesTimer);
      this.resendDevicesTimer = null;
    }
    super.destroy();
  }
}

/**
 * A group call using MSC3401 and Element Call as a backend.
 * (somewhat cheekily named)
 */
exports.JitsiCall = JitsiCall;
(0, _defineProperty2.default)(JitsiCall, "MEMBER_EVENT_TYPE", "io.element.video.member");
class ElementCall extends Call {
  get layout() {
    return this._layout;
  }
  set layout(value) {
    this._layout = value;
    this.emit(CallEvent.Layout, value);
  }
  constructor(groupCall, client) {
    const accountAnalyticsData = client.getAccountData(_PosthogAnalytics.PosthogAnalytics.ANALYTICS_EVENT_TYPE);
    // The analyticsID is passed directly to element call (EC) since this codepath is only for EC and no other widget.
    // We really don't want the same analyticID's for the EC and EW posthog instances (Data on posthog should be limited/anonymized as much as possible).
    // This is prohibited in EC where a hashed version of the analyticsID is used for the actual posthog identification.
    // We can pass the raw EW analyticsID here since we need to trust EC with not sending sensitive data to posthog (EC has access to more sensible data than the analyticsID e.g. the username)
    const analyticsID = accountAnalyticsData?.getContent().pseudonymousAnalyticsOptIn ? accountAnalyticsData?.getContent().id : "";

    // Splice together the Element Call URL for this call
    const params = new URLSearchParams({
      embed: "",
      preload: "",
      hideHeader: "",
      userId: client.getUserId(),
      deviceId: client.getDeviceId(),
      roomId: groupCall.room.roomId,
      baseUrl: client.baseUrl,
      lang: (0, _languageHandler.getCurrentLanguage)().replace("_", "-"),
      fontScale: `${_SettingsStore.default.getValue("baseFontSize") / _FontWatcher.FontWatcher.DEFAULT_SIZE}`,
      analyticsID
    });
    if (_SettingsStore.default.getValue("fallbackICEServerAllowed")) params.append("allowIceFallback", "");

    // Set custom fonts
    if (_SettingsStore.default.getValue("useSystemFont")) {
      _SettingsStore.default.getValue("systemFont").split(",").map(font => {
        // Strip whitespace and quotes
        font = font.trim();
        if (font.startsWith('"') && font.endsWith('"')) font = font.slice(1, -1);
        return font;
      }).forEach(font => params.append("font", font));
    }
    const url = new URL(_SdkConfig.default.get("element_call").url ?? _SdkConfig.DEFAULTS.element_call.url);
    url.pathname = "/room";
    url.hash = `#?${params.toString()}`;

    // To use Element Call without touching room state, we create a virtual
    // widget (one that doesn't have a corresponding state event)
    super(_WidgetStore.default.instance.addVirtualWidget({
      id: (0, _randomstring.randomString)(24),
      // So that it's globally unique
      creatorUserId: client.getUserId(),
      name: "Element Call",
      type: _matrixWidgetApi.MatrixWidgetType.Custom,
      url: url.toString()
    }, groupCall.room.roomId), client);
    this.groupCall = groupCall;
    (0, _defineProperty2.default)(this, "STUCK_DEVICE_TIMEOUT_MS", 1000 * 60 * 60);
    // 1 hour
    (0, _defineProperty2.default)(this, "terminationTimer", null);
    (0, _defineProperty2.default)(this, "_layout", Layout.Tile);
    (0, _defineProperty2.default)(this, "onParticipants", async (participants, prevParticipants) => {
      let participantCount = 0;
      for (const devices of participants.values()) participantCount += devices.size;
      let prevParticipantCount = 0;
      for (const devices of prevParticipants.values()) prevParticipantCount += devices.size;

      // If the last participant disconnected, terminate the call
      if (participantCount === 0 && prevParticipantCount > 0 && this.mayTerminate) {
        if (prevParticipants.get(this.room.getMember(this.client.getUserId()))?.has(this.client.getDeviceId())) {
          // If we were that last participant, do the termination ourselves
          await this.groupCall.terminate();
        } else {
          // We don't appear to have been the last participant, but because of
          // the potential for races, users lacking permission, and a myriad of
          // other reasons, we can't rely on other clients to terminate the call.
          // Since it's likely that other clients are using this same logic, we wait
          // randomly between 2 and 8 seconds before terminating the call, to
          // probabilistically reduce event spam. If someone else beats us to it,
          // this timer will be automatically cleared upon the call's destruction.
          this.terminationTimer = window.setTimeout(() => this.groupCall.terminate(), Math.random() * 6000 + 2000);
        }
      }
    });
    (0, _defineProperty2.default)(this, "onGroupCallParticipants", () => this.updateParticipants());
    (0, _defineProperty2.default)(this, "onGroupCallState", state => {
      if (state === _groupCall.GroupCallState.Ended) this.destroy();
    });
    (0, _defineProperty2.default)(this, "onHangup", async ev => {
      ev.preventDefault();
      await this.messaging.transport.reply(ev.detail, {}); // ack
      this.setDisconnected();
    });
    (0, _defineProperty2.default)(this, "onTileLayout", async ev => {
      ev.preventDefault();
      this.layout = Layout.Tile;
      await this.messaging.transport.reply(ev.detail, {}); // ack
    });
    (0, _defineProperty2.default)(this, "onSpotlightLayout", async ev => {
      ev.preventDefault();
      this.layout = Layout.Spotlight;
      await this.messaging.transport.reply(ev.detail, {}); // ack
    });
    (0, _defineProperty2.default)(this, "onScreenshareRequest", async ev => {
      ev.preventDefault();
      if (_PlatformPeg.default.get()?.supportsDesktopCapturer()) {
        await this.messaging.transport.reply(ev.detail, {
          pending: true
        });
        const {
          finished
        } = _Modal.default.createDialog(_DesktopCapturerSourcePicker.default);
        const [source] = await finished;
        if (source) {
          await this.messaging.transport.send(_ElementWidgetActions.ElementWidgetActions.ScreenshareStart, {
            desktopCapturerSourceId: source
          });
        } else {
          await this.messaging.transport.send(_ElementWidgetActions.ElementWidgetActions.ScreenshareStop, {});
        }
      } else {
        await this.messaging.transport.reply(ev.detail, {
          pending: false
        });
      }
    });
    this.on(CallEvent.Participants, this.onParticipants);
    groupCall.on(_groupCall.GroupCallEvent.ParticipantsChanged, this.onGroupCallParticipants);
    groupCall.on(_groupCall.GroupCallEvent.GroupCallStateChanged, this.onGroupCallState);
    this.updateParticipants();
  }
  static get(room) {
    // Only supported in the new group call experience or in video rooms
    if (_SettingsStore.default.getValue("feature_group_calls") || _SettingsStore.default.getValue("feature_video_rooms") && _SettingsStore.default.getValue("feature_element_call_video_rooms") && room.isCallRoom()) {
      const groupCall = room.client.groupCallEventHandler.groupCalls.get(room.roomId);
      if (groupCall !== undefined) return new ElementCall(groupCall, room.client);
    }
    return null;
  }
  static async create(room) {
    const isVideoRoom = _SettingsStore.default.getValue("feature_video_rooms") && _SettingsStore.default.getValue("feature_element_call_video_rooms") && room.isCallRoom();
    const groupCall = new _groupCall.GroupCall(room.client, room, _groupCall.GroupCallType.Video, false, isVideoRoom ? _groupCall.GroupCallIntent.Room : _groupCall.GroupCallIntent.Prompt);
    await groupCall.create();
  }
  clean() {
    return this.groupCall.cleanMemberState();
  }
  async performConnection(audioInput, videoInput) {
    try {
      await this.messaging.transport.send(_ElementWidgetActions.ElementWidgetActions.JoinCall, {
        audioInput: audioInput?.label ?? null,
        videoInput: videoInput?.label ?? null
      });
    } catch (e) {
      throw new Error(`Failed to join call in room ${this.roomId}: ${e}`);
    }
    this.groupCall.enteredViaAnotherSession = true;
    this.messaging.on(`action:${_ElementWidgetActions.ElementWidgetActions.HangupCall}`, this.onHangup);
    this.messaging.on(`action:${_ElementWidgetActions.ElementWidgetActions.TileLayout}`, this.onTileLayout);
    this.messaging.on(`action:${_ElementWidgetActions.ElementWidgetActions.SpotlightLayout}`, this.onSpotlightLayout);
    this.messaging.on(`action:${_ElementWidgetActions.ElementWidgetActions.ScreenshareRequest}`, this.onScreenshareRequest);
  }
  async performDisconnection() {
    try {
      await this.messaging.transport.send(_ElementWidgetActions.ElementWidgetActions.HangupCall, {});
    } catch (e) {
      throw new Error(`Failed to hangup call in room ${this.roomId}: ${e}`);
    }
  }
  setDisconnected() {
    this.messaging.off(`action:${_ElementWidgetActions.ElementWidgetActions.HangupCall}`, this.onHangup);
    this.messaging.off(`action:${_ElementWidgetActions.ElementWidgetActions.TileLayout}`, this.onTileLayout);
    this.messaging.off(`action:${_ElementWidgetActions.ElementWidgetActions.SpotlightLayout}`, this.onSpotlightLayout);
    this.messaging.off(`action:${_ElementWidgetActions.ElementWidgetActions.ScreenshareRequest}`, this.onScreenshareRequest);
    super.setDisconnected();
    this.groupCall.enteredViaAnotherSession = false;
  }
  destroy() {
    _ActiveWidgetStore.default.instance.destroyPersistentWidget(this.widget.id, this.groupCall.room.roomId);
    _WidgetStore.default.instance.removeVirtualWidget(this.widget.id, this.groupCall.room.roomId);
    this.off(CallEvent.Participants, this.onParticipants);
    this.groupCall.off(_groupCall.GroupCallEvent.ParticipantsChanged, this.onGroupCallParticipants);
    this.groupCall.off(_groupCall.GroupCallEvent.GroupCallStateChanged, this.onGroupCallState);
    if (this.terminationTimer !== null) {
      clearTimeout(this.terminationTimer);
      this.terminationTimer = null;
    }
    super.destroy();
  }

  /**
   * Sets the call's layout.
   * @param layout The layout to switch to.
   */
  async setLayout(layout) {
    const action = layout === Layout.Tile ? _ElementWidgetActions.ElementWidgetActions.TileLayout : _ElementWidgetActions.ElementWidgetActions.SpotlightLayout;
    await this.messaging.transport.send(action, {});
  }
  updateParticipants() {
    const participants = new Map();
    for (const [member, deviceMap] of this.groupCall.participants) {
      participants.set(member, new Set(deviceMap.keys()));
    }
    this.participants = participants;
  }
  get mayTerminate() {
    return this.groupCall.intent !== _groupCall.GroupCallIntent.Room && this.room.currentState.mayClientSendStateEvent(ElementCall.CALL_EVENT_TYPE.name, this.client);
  }
}
exports.ElementCall = ElementCall;
(0, _defineProperty2.default)(ElementCall, "CALL_EVENT_TYPE", new _NamespacedValue.NamespacedValue(null, _event.EventType.GroupCallPrefix));
(0, _defineProperty2.default)(ElementCall, "MEMBER_EVENT_TYPE", new _NamespacedValue.NamespacedValue(null, _event.EventType.GroupCallMemberPrefix));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfdHlwZWRFdmVudEVtaXR0ZXIiLCJyZXF1aXJlIiwiX2xvZ2dlciIsIl9yYW5kb21zdHJpbmciLCJfcm9vbTIiLCJfcm9vbVN0YXRlIiwiX2NhbGwiLCJfTmFtZXNwYWNlZFZhbHVlIiwiX21hdHJpeFdpZGdldEFwaSIsIl9ncm91cENhbGwiLCJfZXZlbnQiLCJfU2RrQ29uZmlnIiwiX2ludGVyb3BSZXF1aXJlV2lsZGNhcmQiLCJfU2V0dGluZ3NTdG9yZSIsIl9pbnRlcm9wUmVxdWlyZURlZmF1bHQiLCJfTWVkaWFEZXZpY2VIYW5kbGVyIiwiX3Byb21pc2UiLCJfV2lkZ2V0VXRpbHMiLCJfV2lkZ2V0VHlwZSIsIl9FbGVtZW50V2lkZ2V0QWN0aW9ucyIsIl9XaWRnZXRTdG9yZSIsIl9XaWRnZXRNZXNzYWdpbmdTdG9yZSIsIl9BY3RpdmVXaWRnZXRTdG9yZSIsIl9QbGF0Zm9ybVBlZyIsIl9sYW5ndWFnZUhhbmRsZXIiLCJfRGVza3RvcENhcHR1cmVyU291cmNlUGlja2VyIiwiX01vZGFsIiwiX0ZvbnRXYXRjaGVyIiwiX1Bvc3Rob2dBbmFseXRpY3MiLCJfZ2V0UmVxdWlyZVdpbGRjYXJkQ2FjaGUiLCJub2RlSW50ZXJvcCIsIldlYWtNYXAiLCJjYWNoZUJhYmVsSW50ZXJvcCIsImNhY2hlTm9kZUludGVyb3AiLCJvYmoiLCJfX2VzTW9kdWxlIiwiZGVmYXVsdCIsImNhY2hlIiwiaGFzIiwiZ2V0IiwibmV3T2JqIiwiaGFzUHJvcGVydHlEZXNjcmlwdG9yIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IiLCJrZXkiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImNhbGwiLCJkZXNjIiwic2V0IiwiVElNRU9VVF9NUyIsIndhaXRGb3JFdmVudCIsImVtaXR0ZXIiLCJldmVudCIsInByZWQiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJ1bmRlZmluZWQiLCJsaXN0ZW5lciIsIndhaXQiLCJQcm9taXNlIiwicmVzb2x2ZSIsIm9uIiwidGltZWRPdXQiLCJ0aW1lb3V0Iiwib2ZmIiwiRXJyb3IiLCJDb25uZWN0aW9uU3RhdGUiLCJleHBvcnRzIiwiaXNDb25uZWN0ZWQiLCJzdGF0ZSIsIkNvbm5lY3RlZCIsIkRpc2Nvbm5lY3RpbmciLCJMYXlvdXQiLCJDYWxsRXZlbnQiLCJDYWxsIiwiVHlwZWRFdmVudEVtaXR0ZXIiLCJtZXNzYWdpbmciLCJfbWVzc2FnaW5nIiwidmFsdWUiLCJyb29tSWQiLCJ3aWRnZXQiLCJjb25uZWN0aW9uU3RhdGUiLCJfY29ubmVjdGlvblN0YXRlIiwicHJldlZhbHVlIiwiZW1pdCIsImNvbm5lY3RlZCIsInBhcnRpY2lwYW50cyIsIl9wYXJ0aWNpcGFudHMiLCJQYXJ0aWNpcGFudHMiLCJjb25zdHJ1Y3RvciIsImNsaWVudCIsIl9kZWZpbmVQcm9wZXJ0eTIiLCJXaWRnZXRVdGlscyIsImdldFdpZGdldFVpZCIsImdldFJvb20iLCJEaXNjb25uZWN0ZWQiLCJNYXAiLCJfcm9vbSIsIm1lbWJlcnNoaXAiLCJzZXREaXNjb25uZWN0ZWQiLCJ1aWQiLCJ3aWRnZXRVaWQiLCJsb2dnZXIiLCJsb2ciLCJyb29tIiwiRWxlbWVudENhbGwiLCJKaXRzaUNhbGwiLCJjb25uZWN0IiwiQ29ubmVjdGluZyIsIk1lZGlhRGV2aWNlS2luZEVudW0iLCJBdWRpb0lucHV0IiwiYXVkaW9JbnB1dHMiLCJWaWRlb0lucHV0IiwidmlkZW9JbnB1dHMiLCJNZWRpYURldmljZUhhbmRsZXIiLCJnZXREZXZpY2VzIiwiYXVkaW9JbnB1dCIsInN0YXJ0V2l0aEF1ZGlvTXV0ZWQiLCJkZXZpY2VJZCIsImdldEF1ZGlvSW5wdXQiLCJmaW5kIiwiZCIsInZpZGVvSW5wdXQiLCJzdGFydFdpdGhWaWRlb011dGVkIiwiZ2V0VmlkZW9JbnB1dCIsIm1lc3NhZ2luZ1N0b3JlIiwiV2lkZ2V0TWVzc2FnaW5nU3RvcmUiLCJpbnN0YW5jZSIsImdldE1lc3NhZ2luZ0ZvclVpZCIsIldpZGdldE1lc3NhZ2luZ1N0b3JlRXZlbnQiLCJTdG9yZU1lc3NhZ2luZyIsIndpZGdldEFwaSIsImUiLCJwZXJmb3JtQ29ubmVjdGlvbiIsIlJvb21FdmVudCIsIk15TWVtYmVyc2hpcCIsIm9uTXlNZW1iZXJzaGlwIiwiU3RvcE1lc3NhZ2luZyIsIm9uU3RvcE1lc3NhZ2luZyIsIndpbmRvdyIsImFkZEV2ZW50TGlzdGVuZXIiLCJiZWZvcmVVbmxvYWQiLCJkaXNjb25uZWN0IiwicGVyZm9ybURpc2Nvbm5lY3Rpb24iLCJyZW1vdmVFdmVudExpc3RlbmVyIiwiZGVzdHJveSIsIkRlc3Ryb3kiLCJ1cGRhdGVQYXJ0aWNpcGFudHMiLCJwcmV2U3RhdGUiLCJhZGRPdXJEZXZpY2UiLCJyZXNlbmREZXZpY2VzVGltZXIiLCJzZXRJbnRlcnZhbCIsIlNUVUNLX0RFVklDRV9USU1FT1VUX01TIiwiY2xlYXJJbnRlcnZhbCIsInJlbW92ZU91ckRldmljZSIsInRyYW5zcG9ydCIsInNlbmQiLCJFbGVtZW50V2lkZ2V0QWN0aW9ucyIsIlRpbGVMYXlvdXQiLCJTcG90bGlnaHRMYXlvdXQiLCJldiIsInByZXZlbnREZWZhdWx0IiwicmVwbHkiLCJkZXRhaWwiLCJSb29tU3RhdGVFdmVudCIsIlVwZGF0ZSIsIm9uUm9vbVN0YXRlIiwib25Db25uZWN0aW9uU3RhdGUiLCJTZXR0aW5nc1N0b3JlIiwiZ2V0VmFsdWUiLCJpc0VsZW1lbnRWaWRlb1Jvb20iLCJhcHBzIiwiV2lkZ2V0U3RvcmUiLCJnZXRBcHBzIiwiaml0c2lXaWRnZXQiLCJhcHAiLCJXaWRnZXRUeXBlIiwiSklUU0kiLCJtYXRjaGVzIiwidHlwZSIsImRhdGEiLCJpc1ZpZGVvQ2hhbm5lbCIsImNyZWF0ZSIsImFkZEppdHNpV2lkZ2V0IiwiQ2FsbFR5cGUiLCJWaWRlbyIsIm5hbWUiLCJwYXJ0aWNpcGFudHNFeHBpcmF0aW9uVGltZXIiLCJjbGVhclRpbWVvdXQiLCJub3ciLCJEYXRlIiwiYWxsRXhwaXJlQXQiLCJJbmZpbml0eSIsImN1cnJlbnRTdGF0ZSIsImdldFN0YXRlRXZlbnRzIiwiTUVNQkVSX0VWRU5UX1RZUEUiLCJtZW1iZXIiLCJnZXRNZW1iZXIiLCJnZXRTdGF0ZUtleSIsImNvbnRlbnQiLCJnZXRDb250ZW50IiwiZXhwaXJlc0F0IiwiZXhwaXJlc190cyIsImRldmljZXMiLCJBcnJheSIsImlzQXJyYXkiLCJmaWx0ZXIiLCJ1c2VySWQiLCJnZXRVc2VySWQiLCJnZXREZXZpY2VJZCIsIlNldCIsImxvY2FsTWVtYmVyIiwiYWRkIiwic2V0VGltZW91dCIsInVwZGF0ZURldmljZXMiLCJmbiIsImdldE15TWVtYmVyc2hpcCIsIm5ld0RldmljZXMiLCJuZXdDb250ZW50Iiwic2VuZFN0YXRlRXZlbnQiLCJjbGVhbiIsIm15RGV2aWNlcyIsImRldmljZU1hcCIsIm1hcCIsImRldmljZV9pZCIsImRldmljZSIsImxhc3Rfc2Vlbl90cyIsImZyb20iLCJkZXZpY2VzU2V0IiwiZGVsZXRlIiwiZG9udFN0b3BNZXNzYWdpbmciLCJyZWplY3QiLCJjbGVhbnVwIiwiZG9uZSIsIkhhbmd1cENhbGwiLCJvbkhhbmd1cCIsInJlc3BvbnNlIiwiSm9pbkNhbGwiLCJyZXF1ZXN0IiwibGFiZWwiLCJyYWNlIiwiYWxsIiwicmVhZHkiLCJmb3JjZSIsIkFjdGl2ZVdpZGdldFN0b3JlIiwiQWN0aXZlV2lkZ2V0U3RvcmVFdmVudCIsIkRvY2siLCJvbkRvY2siLCJVbmRvY2siLCJvblVuZG9jayIsImxheW91dCIsIl9sYXlvdXQiLCJncm91cENhbGwiLCJhY2NvdW50QW5hbHl0aWNzRGF0YSIsImdldEFjY291bnREYXRhIiwiUG9zdGhvZ0FuYWx5dGljcyIsIkFOQUxZVElDU19FVkVOVF9UWVBFIiwiYW5hbHl0aWNzSUQiLCJwc2V1ZG9ueW1vdXNBbmFseXRpY3NPcHRJbiIsImlkIiwicGFyYW1zIiwiVVJMU2VhcmNoUGFyYW1zIiwiZW1iZWQiLCJwcmVsb2FkIiwiaGlkZUhlYWRlciIsImJhc2VVcmwiLCJsYW5nIiwiZ2V0Q3VycmVudExhbmd1YWdlIiwicmVwbGFjZSIsImZvbnRTY2FsZSIsIkZvbnRXYXRjaGVyIiwiREVGQVVMVF9TSVpFIiwiYXBwZW5kIiwic3BsaXQiLCJmb250IiwidHJpbSIsInN0YXJ0c1dpdGgiLCJlbmRzV2l0aCIsInNsaWNlIiwiZm9yRWFjaCIsInVybCIsIlVSTCIsIlNka0NvbmZpZyIsIkRFRkFVTFRTIiwiZWxlbWVudF9jYWxsIiwicGF0aG5hbWUiLCJoYXNoIiwidG9TdHJpbmciLCJhZGRWaXJ0dWFsV2lkZ2V0IiwicmFuZG9tU3RyaW5nIiwiY3JlYXRvclVzZXJJZCIsIk1hdHJpeFdpZGdldFR5cGUiLCJDdXN0b20iLCJUaWxlIiwicHJldlBhcnRpY2lwYW50cyIsInBhcnRpY2lwYW50Q291bnQiLCJ2YWx1ZXMiLCJzaXplIiwicHJldlBhcnRpY2lwYW50Q291bnQiLCJtYXlUZXJtaW5hdGUiLCJ0ZXJtaW5hdGUiLCJ0ZXJtaW5hdGlvblRpbWVyIiwiTWF0aCIsInJhbmRvbSIsIkdyb3VwQ2FsbFN0YXRlIiwiRW5kZWQiLCJTcG90bGlnaHQiLCJQbGF0Zm9ybVBlZyIsInN1cHBvcnRzRGVza3RvcENhcHR1cmVyIiwicGVuZGluZyIsImZpbmlzaGVkIiwiTW9kYWwiLCJjcmVhdGVEaWFsb2ciLCJEZXNrdG9wQ2FwdHVyZXJTb3VyY2VQaWNrZXIiLCJzb3VyY2UiLCJTY3JlZW5zaGFyZVN0YXJ0IiwiZGVza3RvcENhcHR1cmVyU291cmNlSWQiLCJTY3JlZW5zaGFyZVN0b3AiLCJvblBhcnRpY2lwYW50cyIsIkdyb3VwQ2FsbEV2ZW50IiwiUGFydGljaXBhbnRzQ2hhbmdlZCIsIm9uR3JvdXBDYWxsUGFydGljaXBhbnRzIiwiR3JvdXBDYWxsU3RhdGVDaGFuZ2VkIiwib25Hcm91cENhbGxTdGF0ZSIsImlzQ2FsbFJvb20iLCJncm91cENhbGxFdmVudEhhbmRsZXIiLCJncm91cENhbGxzIiwiaXNWaWRlb1Jvb20iLCJHcm91cENhbGwiLCJHcm91cENhbGxUeXBlIiwiR3JvdXBDYWxsSW50ZW50IiwiUm9vbSIsIlByb21wdCIsImNsZWFuTWVtYmVyU3RhdGUiLCJlbnRlcmVkVmlhQW5vdGhlclNlc3Npb24iLCJvblRpbGVMYXlvdXQiLCJvblNwb3RsaWdodExheW91dCIsIlNjcmVlbnNoYXJlUmVxdWVzdCIsIm9uU2NyZWVuc2hhcmVSZXF1ZXN0IiwiZGVzdHJveVBlcnNpc3RlbnRXaWRnZXQiLCJyZW1vdmVWaXJ0dWFsV2lkZ2V0Iiwic2V0TGF5b3V0IiwiYWN0aW9uIiwia2V5cyIsImludGVudCIsIm1heUNsaWVudFNlbmRTdGF0ZUV2ZW50IiwiQ0FMTF9FVkVOVF9UWVBFIiwiTmFtZXNwYWNlZFZhbHVlIiwiRXZlbnRUeXBlIiwiR3JvdXBDYWxsUHJlZml4IiwiR3JvdXBDYWxsTWVtYmVyUHJlZml4Il0sInNvdXJjZXMiOlsiLi4vLi4vc3JjL21vZGVscy9DYWxsLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qXG5Db3B5cmlnaHQgMjAyMiBUaGUgTWF0cml4Lm9yZyBGb3VuZGF0aW9uIEMuSS5DLlxuXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiovXG5cbmltcG9ydCB7IFR5cGVkRXZlbnRFbWl0dGVyIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL21vZGVscy90eXBlZC1ldmVudC1lbWl0dGVyXCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbG9nZ2VyXCI7XG5pbXBvcnQgeyByYW5kb21TdHJpbmcgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvcmFuZG9tc3RyaW5nXCI7XG5pbXBvcnQgeyBNYXRyaXhDbGllbnQgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvY2xpZW50XCI7XG5pbXBvcnQgeyBSb29tRXZlbnQgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbW9kZWxzL3Jvb21cIjtcbmltcG9ydCB7IFJvb21TdGF0ZUV2ZW50IH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL21vZGVscy9yb29tLXN0YXRlXCI7XG5pbXBvcnQgeyBDYWxsVHlwZSB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy93ZWJydGMvY2FsbFwiO1xuaW1wb3J0IHsgTmFtZXNwYWNlZFZhbHVlIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL05hbWVzcGFjZWRWYWx1ZVwiO1xuaW1wb3J0IHsgSVdpZGdldEFwaVJlcXVlc3QsIE1hdHJpeFdpZGdldFR5cGUgfSBmcm9tIFwibWF0cml4LXdpZGdldC1hcGlcIjtcbmltcG9ydCB7XG4gICAgR3JvdXBDYWxsLFxuICAgIEdyb3VwQ2FsbEV2ZW50LFxuICAgIEdyb3VwQ2FsbEludGVudCxcbiAgICBHcm91cENhbGxTdGF0ZSxcbiAgICBHcm91cENhbGxUeXBlLFxufSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvd2VicnRjL2dyb3VwQ2FsbFwiO1xuaW1wb3J0IHsgRXZlbnRUeXBlIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL0B0eXBlcy9ldmVudFwiO1xuXG5pbXBvcnQgdHlwZSBFdmVudEVtaXR0ZXIgZnJvbSBcImV2ZW50c1wiO1xuaW1wb3J0IHR5cGUgeyBJTXlEZXZpY2UgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvY2xpZW50XCI7XG5pbXBvcnQgdHlwZSB7IFJvb20gfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbW9kZWxzL3Jvb21cIjtcbmltcG9ydCB0eXBlIHsgUm9vbU1lbWJlciB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9tb2RlbHMvcm9vbS1tZW1iZXJcIjtcbmltcG9ydCB0eXBlIHsgQ2xpZW50V2lkZ2V0QXBpIH0gZnJvbSBcIm1hdHJpeC13aWRnZXQtYXBpXCI7XG5pbXBvcnQgdHlwZSB7IElBcHAgfSBmcm9tIFwiLi4vc3RvcmVzL1dpZGdldFN0b3JlXCI7XG5pbXBvcnQgU2RrQ29uZmlnLCB7IERFRkFVTFRTIH0gZnJvbSBcIi4uL1Nka0NvbmZpZ1wiO1xuaW1wb3J0IFNldHRpbmdzU3RvcmUgZnJvbSBcIi4uL3NldHRpbmdzL1NldHRpbmdzU3RvcmVcIjtcbmltcG9ydCBNZWRpYURldmljZUhhbmRsZXIsIHsgTWVkaWFEZXZpY2VLaW5kRW51bSB9IGZyb20gXCIuLi9NZWRpYURldmljZUhhbmRsZXJcIjtcbmltcG9ydCB7IHRpbWVvdXQgfSBmcm9tIFwiLi4vdXRpbHMvcHJvbWlzZVwiO1xuaW1wb3J0IFdpZGdldFV0aWxzIGZyb20gXCIuLi91dGlscy9XaWRnZXRVdGlsc1wiO1xuaW1wb3J0IHsgV2lkZ2V0VHlwZSB9IGZyb20gXCIuLi93aWRnZXRzL1dpZGdldFR5cGVcIjtcbmltcG9ydCB7IEVsZW1lbnRXaWRnZXRBY3Rpb25zIH0gZnJvbSBcIi4uL3N0b3Jlcy93aWRnZXRzL0VsZW1lbnRXaWRnZXRBY3Rpb25zXCI7XG5pbXBvcnQgV2lkZ2V0U3RvcmUgZnJvbSBcIi4uL3N0b3Jlcy9XaWRnZXRTdG9yZVwiO1xuaW1wb3J0IHsgV2lkZ2V0TWVzc2FnaW5nU3RvcmUsIFdpZGdldE1lc3NhZ2luZ1N0b3JlRXZlbnQgfSBmcm9tIFwiLi4vc3RvcmVzL3dpZGdldHMvV2lkZ2V0TWVzc2FnaW5nU3RvcmVcIjtcbmltcG9ydCBBY3RpdmVXaWRnZXRTdG9yZSwgeyBBY3RpdmVXaWRnZXRTdG9yZUV2ZW50IH0gZnJvbSBcIi4uL3N0b3Jlcy9BY3RpdmVXaWRnZXRTdG9yZVwiO1xuaW1wb3J0IFBsYXRmb3JtUGVnIGZyb20gXCIuLi9QbGF0Zm9ybVBlZ1wiO1xuaW1wb3J0IHsgZ2V0Q3VycmVudExhbmd1YWdlIH0gZnJvbSBcIi4uL2xhbmd1YWdlSGFuZGxlclwiO1xuaW1wb3J0IERlc2t0b3BDYXB0dXJlclNvdXJjZVBpY2tlciBmcm9tIFwiLi4vY29tcG9uZW50cy92aWV3cy9lbGVtZW50cy9EZXNrdG9wQ2FwdHVyZXJTb3VyY2VQaWNrZXJcIjtcbmltcG9ydCBNb2RhbCBmcm9tIFwiLi4vTW9kYWxcIjtcbmltcG9ydCB7IEZvbnRXYXRjaGVyIH0gZnJvbSBcIi4uL3NldHRpbmdzL3dhdGNoZXJzL0ZvbnRXYXRjaGVyXCI7XG5pbXBvcnQgeyBQb3N0aG9nQW5hbHl0aWNzIH0gZnJvbSBcIi4uL1Bvc3Rob2dBbmFseXRpY3NcIjtcblxuY29uc3QgVElNRU9VVF9NUyA9IDE2MDAwO1xuXG4vLyBXYWl0cyB1bnRpbCBhbiBldmVudCBpcyBlbWl0dGVkIHNhdGlzZnlpbmcgdGhlIGdpdmVuIHByZWRpY2F0ZVxuY29uc3Qgd2FpdEZvckV2ZW50ID0gYXN5bmMgKFxuICAgIGVtaXR0ZXI6IEV2ZW50RW1pdHRlcixcbiAgICBldmVudDogc3RyaW5nLFxuICAgIHByZWQ6ICguLi5hcmdzOiBhbnlbXSkgPT4gYm9vbGVhbiA9ICgpID0+IHRydWUsXG4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICBsZXQgbGlzdGVuZXI6ICguLi5hcmdzOiBhbnlbXSkgPT4gdm9pZDtcbiAgICBjb25zdCB3YWl0ID0gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IHtcbiAgICAgICAgbGlzdGVuZXIgPSAoLi4uYXJncykgPT4ge1xuICAgICAgICAgICAgaWYgKHByZWQoLi4uYXJncykpIHJlc29sdmUoKTtcbiAgICAgICAgfTtcbiAgICAgICAgZW1pdHRlci5vbihldmVudCwgbGlzdGVuZXIpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgdGltZWRPdXQgPSAoYXdhaXQgdGltZW91dCh3YWl0LCBmYWxzZSwgVElNRU9VVF9NUykpID09PSBmYWxzZTtcbiAgICBlbWl0dGVyLm9mZihldmVudCwgbGlzdGVuZXIhKTtcbiAgICBpZiAodGltZWRPdXQpIHRocm93IG5ldyBFcnJvcihcIlRpbWVkIG91dFwiKTtcbn07XG5cbmV4cG9ydCBlbnVtIENvbm5lY3Rpb25TdGF0ZSB7XG4gICAgRGlzY29ubmVjdGVkID0gXCJkaXNjb25uZWN0ZWRcIixcbiAgICBDb25uZWN0aW5nID0gXCJjb25uZWN0aW5nXCIsXG4gICAgQ29ubmVjdGVkID0gXCJjb25uZWN0ZWRcIixcbiAgICBEaXNjb25uZWN0aW5nID0gXCJkaXNjb25uZWN0aW5nXCIsXG59XG5cbmV4cG9ydCBjb25zdCBpc0Nvbm5lY3RlZCA9IChzdGF0ZTogQ29ubmVjdGlvblN0YXRlKTogYm9vbGVhbiA9PlxuICAgIHN0YXRlID09PSBDb25uZWN0aW9uU3RhdGUuQ29ubmVjdGVkIHx8IHN0YXRlID09PSBDb25uZWN0aW9uU3RhdGUuRGlzY29ubmVjdGluZztcblxuZXhwb3J0IGVudW0gTGF5b3V0IHtcbiAgICBUaWxlID0gXCJ0aWxlXCIsXG4gICAgU3BvdGxpZ2h0ID0gXCJzcG90bGlnaHRcIixcbn1cblxuZXhwb3J0IGVudW0gQ2FsbEV2ZW50IHtcbiAgICBDb25uZWN0aW9uU3RhdGUgPSBcImNvbm5lY3Rpb25fc3RhdGVcIixcbiAgICBQYXJ0aWNpcGFudHMgPSBcInBhcnRpY2lwYW50c1wiLFxuICAgIExheW91dCA9IFwibGF5b3V0XCIsXG4gICAgRGVzdHJveSA9IFwiZGVzdHJveVwiLFxufVxuXG5pbnRlcmZhY2UgQ2FsbEV2ZW50SGFuZGxlck1hcCB7XG4gICAgW0NhbGxFdmVudC5Db25uZWN0aW9uU3RhdGVdOiAoc3RhdGU6IENvbm5lY3Rpb25TdGF0ZSwgcHJldlN0YXRlOiBDb25uZWN0aW9uU3RhdGUpID0+IHZvaWQ7XG4gICAgW0NhbGxFdmVudC5QYXJ0aWNpcGFudHNdOiAoXG4gICAgICAgIHBhcnRpY2lwYW50czogTWFwPFJvb21NZW1iZXIsIFNldDxzdHJpbmc+PixcbiAgICAgICAgcHJldlBhcnRpY2lwYW50czogTWFwPFJvb21NZW1iZXIsIFNldDxzdHJpbmc+PixcbiAgICApID0+IHZvaWQ7XG4gICAgW0NhbGxFdmVudC5MYXlvdXRdOiAobGF5b3V0OiBMYXlvdXQpID0+IHZvaWQ7XG4gICAgW0NhbGxFdmVudC5EZXN0cm95XTogKCkgPT4gdm9pZDtcbn1cblxuLyoqXG4gKiBBIGdyb3VwIGNhbGwgYWNjZXNzZWQgdGhyb3VnaCBhIHdpZGdldC5cbiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIENhbGwgZXh0ZW5kcyBUeXBlZEV2ZW50RW1pdHRlcjxDYWxsRXZlbnQsIENhbGxFdmVudEhhbmRsZXJNYXA+IHtcbiAgICBwcm90ZWN0ZWQgcmVhZG9ubHkgd2lkZ2V0VWlkID0gV2lkZ2V0VXRpbHMuZ2V0V2lkZ2V0VWlkKHRoaXMud2lkZ2V0KTtcbiAgICBwcm90ZWN0ZWQgcmVhZG9ubHkgcm9vbSA9IHRoaXMuY2xpZW50LmdldFJvb20odGhpcy5yb29tSWQpITtcblxuICAgIC8qKlxuICAgICAqIFRoZSB0aW1lIGFmdGVyIHdoaWNoIGRldmljZSBtZW1iZXIgc3RhdGUgc2hvdWxkIGJlIGNvbnNpZGVyZWQgZXhwaXJlZC5cbiAgICAgKi9cbiAgICBwdWJsaWMgYWJzdHJhY3QgcmVhZG9ubHkgU1RVQ0tfREVWSUNFX1RJTUVPVVRfTVM6IG51bWJlcjtcblxuICAgIHByaXZhdGUgX21lc3NhZ2luZzogQ2xpZW50V2lkZ2V0QXBpIHwgbnVsbCA9IG51bGw7XG4gICAgLyoqXG4gICAgICogVGhlIHdpZGdldCdzIG1lc3NhZ2luZywgb3IgbnVsbCBpZiBkaXNjb25uZWN0ZWQuXG4gICAgICovXG4gICAgcHJvdGVjdGVkIGdldCBtZXNzYWdpbmcoKTogQ2xpZW50V2lkZ2V0QXBpIHwgbnVsbCB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tZXNzYWdpbmc7XG4gICAgfVxuICAgIHByaXZhdGUgc2V0IG1lc3NhZ2luZyh2YWx1ZTogQ2xpZW50V2lkZ2V0QXBpIHwgbnVsbCkge1xuICAgICAgICB0aGlzLl9tZXNzYWdpbmcgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0IHJvb21JZCgpOiBzdHJpbmcge1xuICAgICAgICByZXR1cm4gdGhpcy53aWRnZXQucm9vbUlkO1xuICAgIH1cblxuICAgIHByaXZhdGUgX2Nvbm5lY3Rpb25TdGF0ZSA9IENvbm5lY3Rpb25TdGF0ZS5EaXNjb25uZWN0ZWQ7XG4gICAgcHVibGljIGdldCBjb25uZWN0aW9uU3RhdGUoKTogQ29ubmVjdGlvblN0YXRlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Nvbm5lY3Rpb25TdGF0ZTtcbiAgICB9XG4gICAgcHJvdGVjdGVkIHNldCBjb25uZWN0aW9uU3RhdGUodmFsdWU6IENvbm5lY3Rpb25TdGF0ZSkge1xuICAgICAgICBjb25zdCBwcmV2VmFsdWUgPSB0aGlzLl9jb25uZWN0aW9uU3RhdGU7XG4gICAgICAgIHRoaXMuX2Nvbm5lY3Rpb25TdGF0ZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLmVtaXQoQ2FsbEV2ZW50LkNvbm5lY3Rpb25TdGF0ZSwgdmFsdWUsIHByZXZWYWx1ZSk7XG4gICAgfVxuXG4gICAgcHVibGljIGdldCBjb25uZWN0ZWQoKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiBpc0Nvbm5lY3RlZCh0aGlzLmNvbm5lY3Rpb25TdGF0ZSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBfcGFydGljaXBhbnRzID0gbmV3IE1hcDxSb29tTWVtYmVyLCBTZXQ8c3RyaW5nPj4oKTtcbiAgICAvKipcbiAgICAgKiBUaGUgcGFydGljaXBhbnRzIGluIHRoZSBjYWxsLCBhcyBhIG1hcCBmcm9tIG1lbWJlcnMgdG8gZGV2aWNlIElEcy5cbiAgICAgKi9cbiAgICBwdWJsaWMgZ2V0IHBhcnRpY2lwYW50cygpOiBNYXA8Um9vbU1lbWJlciwgU2V0PHN0cmluZz4+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BhcnRpY2lwYW50cztcbiAgICB9XG4gICAgcHJvdGVjdGVkIHNldCBwYXJ0aWNpcGFudHModmFsdWU6IE1hcDxSb29tTWVtYmVyLCBTZXQ8c3RyaW5nPj4pIHtcbiAgICAgICAgY29uc3QgcHJldlZhbHVlID0gdGhpcy5fcGFydGljaXBhbnRzO1xuICAgICAgICB0aGlzLl9wYXJ0aWNpcGFudHMgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5lbWl0KENhbGxFdmVudC5QYXJ0aWNpcGFudHMsIHZhbHVlLCBwcmV2VmFsdWUpO1xuICAgIH1cblxuICAgIHB1YmxpYyBjb25zdHJ1Y3RvcihcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSB3aWRnZXQgdXNlZCB0byBhY2Nlc3MgdGhpcyBjYWxsLlxuICAgICAgICAgKi9cbiAgICAgICAgcHVibGljIHJlYWRvbmx5IHdpZGdldDogSUFwcCxcbiAgICAgICAgcHJvdGVjdGVkIHJlYWRvbmx5IGNsaWVudDogTWF0cml4Q2xpZW50LFxuICAgICkge1xuICAgICAgICBzdXBlcigpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIGNhbGwgYXNzb2NpYXRlZCB3aXRoIHRoZSBnaXZlbiByb29tLCBpZiBhbnkuXG4gICAgICogQHBhcmFtIHtSb29tfSByb29tIFRoZSByb29tLlxuICAgICAqIEByZXR1cm5zIHtDYWxsIHwgbnVsbH0gVGhlIGNhbGwuXG4gICAgICovXG4gICAgcHVibGljIHN0YXRpYyBnZXQocm9vbTogUm9vbSk6IENhbGwgfCBudWxsIHtcbiAgICAgICAgcmV0dXJuIEVsZW1lbnRDYWxsLmdldChyb29tKSA/PyBKaXRzaUNhbGwuZ2V0KHJvb20pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFBlcmZvcm1zIGEgcm91dGluZSBjaGVjayBvZiB0aGUgY2FsbCdzIGFzc29jaWF0ZWQgcm9vbSBzdGF0ZSwgY2xlYW5pbmcgdXBcbiAgICAgKiBhbnkgZGF0YSBsZWZ0IG92ZXIgZnJvbSBhbiB1bmNsZWFuIGRpc2Nvbm5lY3Rpb24uXG4gICAgICovXG4gICAgcHVibGljIGFic3RyYWN0IGNsZWFuKCk6IFByb21pc2U8dm9pZD47XG5cbiAgICAvKipcbiAgICAgKiBDb250YWN0cyB0aGUgd2lkZ2V0IHRvIGNvbm5lY3QgdG8gdGhlIGNhbGwuXG4gICAgICogQHBhcmFtIHtNZWRpYURldmljZUluZm8gfCBudWxsfSBhdWRpb0lucHV0IFRoZSBhdWRpbyBpbnB1dCB0byB1c2UsIG9yXG4gICAgICogICBudWxsIHRvIHN0YXJ0IG11dGVkLlxuICAgICAqIEBwYXJhbSB7TWVkaWFEZXZpY2VJbmZvIHwgbnVsbH0gYXVkaW9JbnB1dCBUaGUgdmlkZW8gaW5wdXQgdG8gdXNlLCBvclxuICAgICAqICAgbnVsbCB0byBzdGFydCBtdXRlZC5cbiAgICAgKi9cbiAgICBwcm90ZWN0ZWQgYWJzdHJhY3QgcGVyZm9ybUNvbm5lY3Rpb24oXG4gICAgICAgIGF1ZGlvSW5wdXQ6IE1lZGlhRGV2aWNlSW5mbyB8IG51bGwsXG4gICAgICAgIHZpZGVvSW5wdXQ6IE1lZGlhRGV2aWNlSW5mbyB8IG51bGwsXG4gICAgKTogUHJvbWlzZTx2b2lkPjtcblxuICAgIC8qKlxuICAgICAqIENvbnRhY3RzIHRoZSB3aWRnZXQgdG8gZGlzY29ubmVjdCBmcm9tIHRoZSBjYWxsLlxuICAgICAqL1xuICAgIHByb3RlY3RlZCBhYnN0cmFjdCBwZXJmb3JtRGlzY29ubmVjdGlvbigpOiBQcm9taXNlPHZvaWQ+O1xuXG4gICAgLyoqXG4gICAgICogQ29ubmVjdHMgdGhlIHVzZXIgdG8gdGhlIGNhbGwgdXNpbmcgdGhlIG1lZGlhIGRldmljZXMgc2V0IGluXG4gICAgICogTWVkaWFEZXZpY2VIYW5kbGVyLiBUaGUgd2lkZ2V0IGFzc29jaWF0ZWQgd2l0aCB0aGUgY2FsbCBtdXN0IGJlIGFjdGl2ZVxuICAgICAqIGZvciB0aGlzIHRvIHN1Y2NlZWQuXG4gICAgICovXG4gICAgcHVibGljIGFzeW5jIGNvbm5lY3QoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIHRoaXMuY29ubmVjdGlvblN0YXRlID0gQ29ubmVjdGlvblN0YXRlLkNvbm5lY3Rpbmc7XG5cbiAgICAgICAgY29uc3QgeyBbTWVkaWFEZXZpY2VLaW5kRW51bS5BdWRpb0lucHV0XTogYXVkaW9JbnB1dHMsIFtNZWRpYURldmljZUtpbmRFbnVtLlZpZGVvSW5wdXRdOiB2aWRlb0lucHV0cyB9ID1cbiAgICAgICAgICAgIChhd2FpdCBNZWRpYURldmljZUhhbmRsZXIuZ2V0RGV2aWNlcygpKSE7XG5cbiAgICAgICAgbGV0IGF1ZGlvSW5wdXQ6IE1lZGlhRGV2aWNlSW5mbyB8IG51bGwgPSBudWxsO1xuICAgICAgICBpZiAoIU1lZGlhRGV2aWNlSGFuZGxlci5zdGFydFdpdGhBdWRpb011dGVkKSB7XG4gICAgICAgICAgICBjb25zdCBkZXZpY2VJZCA9IE1lZGlhRGV2aWNlSGFuZGxlci5nZXRBdWRpb0lucHV0KCk7XG4gICAgICAgICAgICBhdWRpb0lucHV0ID0gYXVkaW9JbnB1dHMuZmluZCgoZCkgPT4gZC5kZXZpY2VJZCA9PT0gZGV2aWNlSWQpID8/IGF1ZGlvSW5wdXRzWzBdID8/IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHZpZGVvSW5wdXQ6IE1lZGlhRGV2aWNlSW5mbyB8IG51bGwgPSBudWxsO1xuICAgICAgICBpZiAoIU1lZGlhRGV2aWNlSGFuZGxlci5zdGFydFdpdGhWaWRlb011dGVkKSB7XG4gICAgICAgICAgICBjb25zdCBkZXZpY2VJZCA9IE1lZGlhRGV2aWNlSGFuZGxlci5nZXRWaWRlb0lucHV0KCk7XG4gICAgICAgICAgICB2aWRlb0lucHV0ID0gdmlkZW9JbnB1dHMuZmluZCgoZCkgPT4gZC5kZXZpY2VJZCA9PT0gZGV2aWNlSWQpID8/IHZpZGVvSW5wdXRzWzBdID8/IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBtZXNzYWdpbmdTdG9yZSA9IFdpZGdldE1lc3NhZ2luZ1N0b3JlLmluc3RhbmNlO1xuICAgICAgICB0aGlzLm1lc3NhZ2luZyA9IG1lc3NhZ2luZ1N0b3JlLmdldE1lc3NhZ2luZ0ZvclVpZCh0aGlzLndpZGdldFVpZCkgPz8gbnVsbDtcbiAgICAgICAgaWYgKCF0aGlzLm1lc3NhZ2luZykge1xuICAgICAgICAgICAgLy8gVGhlIHdpZGdldCBtaWdodCBzdGlsbCBiZSBpbml0aWFsaXppbmcsIHNvIHdhaXQgZm9yIGl0XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGF3YWl0IHdhaXRGb3JFdmVudChcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnaW5nU3RvcmUsXG4gICAgICAgICAgICAgICAgICAgIFdpZGdldE1lc3NhZ2luZ1N0b3JlRXZlbnQuU3RvcmVNZXNzYWdpbmcsXG4gICAgICAgICAgICAgICAgICAgICh1aWQ6IHN0cmluZywgd2lkZ2V0QXBpOiBDbGllbnRXaWRnZXRBcGkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh1aWQgPT09IHRoaXMud2lkZ2V0VWlkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tZXNzYWdpbmcgPSB3aWRnZXRBcGk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBiaW5kIGNhbGwgd2lkZ2V0IGluIHJvb20gJHt0aGlzLnJvb21JZH06ICR7ZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBlcmZvcm1Db25uZWN0aW9uKGF1ZGlvSW5wdXQsIHZpZGVvSW5wdXQpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICB0aGlzLmNvbm5lY3Rpb25TdGF0ZSA9IENvbm5lY3Rpb25TdGF0ZS5EaXNjb25uZWN0ZWQ7XG4gICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5yb29tLm9uKFJvb21FdmVudC5NeU1lbWJlcnNoaXAsIHRoaXMub25NeU1lbWJlcnNoaXApO1xuICAgICAgICBXaWRnZXRNZXNzYWdpbmdTdG9yZS5pbnN0YW5jZS5vbihXaWRnZXRNZXNzYWdpbmdTdG9yZUV2ZW50LlN0b3BNZXNzYWdpbmcsIHRoaXMub25TdG9wTWVzc2FnaW5nKTtcbiAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJiZWZvcmV1bmxvYWRcIiwgdGhpcy5iZWZvcmVVbmxvYWQpO1xuICAgICAgICB0aGlzLmNvbm5lY3Rpb25TdGF0ZSA9IENvbm5lY3Rpb25TdGF0ZS5Db25uZWN0ZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGlzY29ubmVjdHMgdGhlIHVzZXIgZnJvbSB0aGUgY2FsbC5cbiAgICAgKi9cbiAgICBwdWJsaWMgYXN5bmMgZGlzY29ubmVjdCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgaWYgKHRoaXMuY29ubmVjdGlvblN0YXRlICE9PSBDb25uZWN0aW9uU3RhdGUuQ29ubmVjdGVkKSB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgY29ubmVjdGVkXCIpO1xuXG4gICAgICAgIHRoaXMuY29ubmVjdGlvblN0YXRlID0gQ29ubmVjdGlvblN0YXRlLkRpc2Nvbm5lY3Rpbmc7XG4gICAgICAgIGF3YWl0IHRoaXMucGVyZm9ybURpc2Nvbm5lY3Rpb24oKTtcbiAgICAgICAgdGhpcy5zZXREaXNjb25uZWN0ZWQoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYW51YWxseSBtYXJrcyB0aGUgY2FsbCBhcyBkaXNjb25uZWN0ZWQgYW5kIGNsZWFucyB1cC5cbiAgICAgKi9cbiAgICBwdWJsaWMgc2V0RGlzY29ubmVjdGVkKCk6IHZvaWQge1xuICAgICAgICB0aGlzLnJvb20ub2ZmKFJvb21FdmVudC5NeU1lbWJlcnNoaXAsIHRoaXMub25NeU1lbWJlcnNoaXApO1xuICAgICAgICBXaWRnZXRNZXNzYWdpbmdTdG9yZS5pbnN0YW5jZS5vZmYoV2lkZ2V0TWVzc2FnaW5nU3RvcmVFdmVudC5TdG9wTWVzc2FnaW5nLCB0aGlzLm9uU3RvcE1lc3NhZ2luZyk7XG4gICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwiYmVmb3JldW5sb2FkXCIsIHRoaXMuYmVmb3JlVW5sb2FkKTtcbiAgICAgICAgdGhpcy5tZXNzYWdpbmcgPSBudWxsO1xuICAgICAgICB0aGlzLmNvbm5lY3Rpb25TdGF0ZSA9IENvbm5lY3Rpb25TdGF0ZS5EaXNjb25uZWN0ZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RvcHMgYWxsIGludGVybmFsIHRpbWVycyBhbmQgdGFza3MgdG8gcHJlcGFyZSBmb3IgZ2FyYmFnZSBjb2xsZWN0aW9uLlxuICAgICAqL1xuICAgIHB1YmxpYyBkZXN0cm95KCk6IHZvaWQge1xuICAgICAgICBpZiAodGhpcy5jb25uZWN0ZWQpIHRoaXMuc2V0RGlzY29ubmVjdGVkKCk7XG4gICAgICAgIHRoaXMuZW1pdChDYWxsRXZlbnQuRGVzdHJveSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBvbk15TWVtYmVyc2hpcCA9IGFzeW5jIChfcm9vbTogUm9vbSwgbWVtYmVyc2hpcDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICAgIGlmIChtZW1iZXJzaGlwICE9PSBcImpvaW5cIikgdGhpcy5zZXREaXNjb25uZWN0ZWQoKTtcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBvblN0b3BNZXNzYWdpbmcgPSAodWlkOiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICAgICAgaWYgKHVpZCA9PT0gdGhpcy53aWRnZXRVaWQpIHtcbiAgICAgICAgICAgIGxvZ2dlci5sb2coXCJUaGUgd2lkZ2V0IGRpZWQ7IHRyZWF0aW5nIHRoaXMgYXMgYSB1c2VyIGhhbmd1cFwiKTtcbiAgICAgICAgICAgIHRoaXMuc2V0RGlzY29ubmVjdGVkKCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBiZWZvcmVVbmxvYWQgPSAoKTogdm9pZCA9PiB0aGlzLnNldERpc2Nvbm5lY3RlZCgpO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEppdHNpQ2FsbE1lbWJlckNvbnRlbnQge1xuICAgIC8vIENvbm5lY3RlZCBkZXZpY2UgSURzXG4gICAgZGV2aWNlczogc3RyaW5nW107XG4gICAgLy8gVGltZSBhdCB3aGljaCB0aGlzIHN0YXRlIGV2ZW50IHNob3VsZCBiZSBjb25zaWRlcmVkIHN0YWxlXG4gICAgZXhwaXJlc190czogbnVtYmVyO1xufVxuXG4vKipcbiAqIEEgZ3JvdXAgY2FsbCB1c2luZyBKaXRzaSBhcyBhIGJhY2tlbmQuXG4gKi9cbmV4cG9ydCBjbGFzcyBKaXRzaUNhbGwgZXh0ZW5kcyBDYWxsIHtcbiAgICBwdWJsaWMgc3RhdGljIHJlYWRvbmx5IE1FTUJFUl9FVkVOVF9UWVBFID0gXCJpby5lbGVtZW50LnZpZGVvLm1lbWJlclwiO1xuICAgIHB1YmxpYyByZWFkb25seSBTVFVDS19ERVZJQ0VfVElNRU9VVF9NUyA9IDEwMDAgKiA2MCAqIDYwOyAvLyAxIGhvdXJcblxuICAgIHByaXZhdGUgcmVzZW5kRGV2aWNlc1RpbWVyOiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgICBwcml2YXRlIHBhcnRpY2lwYW50c0V4cGlyYXRpb25UaW1lcjogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cbiAgICBwcml2YXRlIGNvbnN0cnVjdG9yKHdpZGdldDogSUFwcCwgY2xpZW50OiBNYXRyaXhDbGllbnQpIHtcbiAgICAgICAgc3VwZXIod2lkZ2V0LCBjbGllbnQpO1xuXG4gICAgICAgIHRoaXMucm9vbS5vbihSb29tU3RhdGVFdmVudC5VcGRhdGUsIHRoaXMub25Sb29tU3RhdGUpO1xuICAgICAgICB0aGlzLm9uKENhbGxFdmVudC5Db25uZWN0aW9uU3RhdGUsIHRoaXMub25Db25uZWN0aW9uU3RhdGUpO1xuICAgICAgICB0aGlzLnVwZGF0ZVBhcnRpY2lwYW50cygpO1xuICAgIH1cblxuICAgIHB1YmxpYyBzdGF0aWMgZ2V0KHJvb206IFJvb20pOiBKaXRzaUNhbGwgfCBudWxsIHtcbiAgICAgICAgLy8gT25seSBzdXBwb3J0ZWQgaW4gdmlkZW8gcm9vbXNcbiAgICAgICAgaWYgKFNldHRpbmdzU3RvcmUuZ2V0VmFsdWUoXCJmZWF0dXJlX3ZpZGVvX3Jvb21zXCIpICYmIHJvb20uaXNFbGVtZW50VmlkZW9Sb29tKCkpIHtcbiAgICAgICAgICAgIGNvbnN0IGFwcHMgPSBXaWRnZXRTdG9yZS5pbnN0YW5jZS5nZXRBcHBzKHJvb20ucm9vbUlkKTtcbiAgICAgICAgICAgIC8vIFRoZSBpc1ZpZGVvQ2hhbm5lbCBmaWVsZCBkaWZmZXJlbnRpYXRlcyByaWNoIEppdHNpIGNhbGxzIGZyb20gYmFyZSBKaXRzaSB3aWRnZXRzXG4gICAgICAgICAgICBjb25zdCBqaXRzaVdpZGdldCA9IGFwcHMuZmluZCgoYXBwKSA9PiBXaWRnZXRUeXBlLkpJVFNJLm1hdGNoZXMoYXBwLnR5cGUpICYmIGFwcC5kYXRhPy5pc1ZpZGVvQ2hhbm5lbCk7XG4gICAgICAgICAgICBpZiAoaml0c2lXaWRnZXQpIHJldHVybiBuZXcgSml0c2lDYWxsKGppdHNpV2lkZ2V0LCByb29tLmNsaWVudCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBwdWJsaWMgc3RhdGljIGFzeW5jIGNyZWF0ZShyb29tOiBSb29tKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGF3YWl0IFdpZGdldFV0aWxzLmFkZEppdHNpV2lkZ2V0KHJvb20uY2xpZW50LCByb29tLnJvb21JZCwgQ2FsbFR5cGUuVmlkZW8sIFwiR3JvdXAgY2FsbFwiLCB0cnVlLCByb29tLm5hbWUpO1xuICAgIH1cblxuICAgIHByaXZhdGUgdXBkYXRlUGFydGljaXBhbnRzKCk6IHZvaWQge1xuICAgICAgICBpZiAodGhpcy5wYXJ0aWNpcGFudHNFeHBpcmF0aW9uVGltZXIgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLnBhcnRpY2lwYW50c0V4cGlyYXRpb25UaW1lcik7XG4gICAgICAgICAgICB0aGlzLnBhcnRpY2lwYW50c0V4cGlyYXRpb25UaW1lciA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwYXJ0aWNpcGFudHMgPSBuZXcgTWFwPFJvb21NZW1iZXIsIFNldDxzdHJpbmc+PigpO1xuICAgICAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgICAgICBsZXQgYWxsRXhwaXJlQXQgPSBJbmZpbml0eTtcblxuICAgICAgICBmb3IgKGNvbnN0IGUgb2YgdGhpcy5yb29tLmN1cnJlbnRTdGF0ZS5nZXRTdGF0ZUV2ZW50cyhKaXRzaUNhbGwuTUVNQkVSX0VWRU5UX1RZUEUpKSB7XG4gICAgICAgICAgICBjb25zdCBtZW1iZXIgPSB0aGlzLnJvb20uZ2V0TWVtYmVyKGUuZ2V0U3RhdGVLZXkoKSEpO1xuICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGUuZ2V0Q29udGVudDxKaXRzaUNhbGxNZW1iZXJDb250ZW50PigpO1xuICAgICAgICAgICAgY29uc3QgZXhwaXJlc0F0ID0gdHlwZW9mIGNvbnRlbnQuZXhwaXJlc190cyA9PT0gXCJudW1iZXJcIiA/IGNvbnRlbnQuZXhwaXJlc190cyA6IC1JbmZpbml0eTtcbiAgICAgICAgICAgIGxldCBkZXZpY2VzID1cbiAgICAgICAgICAgICAgICBleHBpcmVzQXQgPiBub3cgJiYgQXJyYXkuaXNBcnJheShjb250ZW50LmRldmljZXMpXG4gICAgICAgICAgICAgICAgICAgID8gY29udGVudC5kZXZpY2VzLmZpbHRlcigoZCkgPT4gdHlwZW9mIGQgPT09IFwic3RyaW5nXCIpXG4gICAgICAgICAgICAgICAgICAgIDogW107XG5cbiAgICAgICAgICAgIC8vIEFwcGx5IGxvY2FsIGVjaG8gZm9yIHRoZSBkaXNjb25uZWN0ZWQgY2FzZVxuICAgICAgICAgICAgaWYgKCF0aGlzLmNvbm5lY3RlZCAmJiBtZW1iZXI/LnVzZXJJZCA9PT0gdGhpcy5jbGllbnQuZ2V0VXNlcklkKCkpIHtcbiAgICAgICAgICAgICAgICBkZXZpY2VzID0gZGV2aWNlcy5maWx0ZXIoKGQpID0+IGQgIT09IHRoaXMuY2xpZW50LmdldERldmljZUlkKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gTXVzdCBoYXZlIGEgY29ubmVjdGVkIGRldmljZSBhbmQgc3RpbGwgYmUgam9pbmVkIHRvIHRoZSByb29tXG4gICAgICAgICAgICBpZiAoZGV2aWNlcy5sZW5ndGggPiAwICYmIG1lbWJlcj8ubWVtYmVyc2hpcCA9PT0gXCJqb2luXCIpIHtcbiAgICAgICAgICAgICAgICBwYXJ0aWNpcGFudHMuc2V0KG1lbWJlciwgbmV3IFNldChkZXZpY2VzKSk7XG4gICAgICAgICAgICAgICAgaWYgKGV4cGlyZXNBdCA8IGFsbEV4cGlyZUF0KSBhbGxFeHBpcmVBdCA9IGV4cGlyZXNBdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFwcGx5IGxvY2FsIGVjaG8gZm9yIHRoZSBjb25uZWN0ZWQgY2FzZVxuICAgICAgICBpZiAodGhpcy5jb25uZWN0ZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IGxvY2FsTWVtYmVyID0gdGhpcy5yb29tLmdldE1lbWJlcih0aGlzLmNsaWVudC5nZXRVc2VySWQoKSEpITtcbiAgICAgICAgICAgIGxldCBkZXZpY2VzID0gcGFydGljaXBhbnRzLmdldChsb2NhbE1lbWJlcik7XG4gICAgICAgICAgICBpZiAoZGV2aWNlcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgZGV2aWNlcyA9IG5ldyBTZXQoKTtcbiAgICAgICAgICAgICAgICBwYXJ0aWNpcGFudHMuc2V0KGxvY2FsTWVtYmVyLCBkZXZpY2VzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZGV2aWNlcy5hZGQodGhpcy5jbGllbnQuZ2V0RGV2aWNlSWQoKSEpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wYXJ0aWNpcGFudHMgPSBwYXJ0aWNpcGFudHM7XG4gICAgICAgIGlmIChhbGxFeHBpcmVBdCA8IEluZmluaXR5KSB7XG4gICAgICAgICAgICB0aGlzLnBhcnRpY2lwYW50c0V4cGlyYXRpb25UaW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHRoaXMudXBkYXRlUGFydGljaXBhbnRzKCksIGFsbEV4cGlyZUF0IC0gbm93KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZXMgb3VyIG1lbWJlciBzdGF0ZSB3aXRoIHRoZSBkZXZpY2VzIHJldHVybmVkIGJ5IHRoZSBnaXZlbiBmdW5jdGlvbi5cbiAgICAgKiBAcGFyYW0gZm4gQSBmdW5jdGlvbiBmcm9tIHRoZSBjdXJyZW50IGRldmljZXMgdG8gdGhlIG5ldyBkZXZpY2VzLiBJZiBpdFxuICAgICAqICAgICByZXR1cm5zIG51bGwsIHRoZSB1cGRhdGUgaXMgc2tpcHBlZC5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHVwZGF0ZURldmljZXMoZm46IChkZXZpY2VzOiBzdHJpbmdbXSkgPT4gc3RyaW5nW10gfCBudWxsKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGlmICh0aGlzLnJvb20uZ2V0TXlNZW1iZXJzaGlwKCkgIT09IFwiam9pblwiKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgZXZlbnQgPSB0aGlzLnJvb20uY3VycmVudFN0YXRlLmdldFN0YXRlRXZlbnRzKEppdHNpQ2FsbC5NRU1CRVJfRVZFTlRfVFlQRSwgdGhpcy5jbGllbnQuZ2V0VXNlcklkKCkhKTtcbiAgICAgICAgY29uc3QgY29udGVudCA9IGV2ZW50Py5nZXRDb250ZW50PEppdHNpQ2FsbE1lbWJlckNvbnRlbnQ+KCk7XG4gICAgICAgIGNvbnN0IGV4cGlyZXNBdCA9IHR5cGVvZiBjb250ZW50Py5leHBpcmVzX3RzID09PSBcIm51bWJlclwiID8gY29udGVudC5leHBpcmVzX3RzIDogLUluZmluaXR5O1xuICAgICAgICBjb25zdCBkZXZpY2VzID0gZXhwaXJlc0F0ID4gRGF0ZS5ub3coKSAmJiBBcnJheS5pc0FycmF5KGNvbnRlbnQ/LmRldmljZXMpID8gY29udGVudCEuZGV2aWNlcyA6IFtdO1xuICAgICAgICBjb25zdCBuZXdEZXZpY2VzID0gZm4oZGV2aWNlcyk7XG5cbiAgICAgICAgaWYgKG5ld0RldmljZXMgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnN0IG5ld0NvbnRlbnQ6IEppdHNpQ2FsbE1lbWJlckNvbnRlbnQgPSB7XG4gICAgICAgICAgICAgICAgZGV2aWNlczogbmV3RGV2aWNlcyxcbiAgICAgICAgICAgICAgICBleHBpcmVzX3RzOiBEYXRlLm5vdygpICsgdGhpcy5TVFVDS19ERVZJQ0VfVElNRU9VVF9NUyxcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGF3YWl0IHRoaXMuY2xpZW50LnNlbmRTdGF0ZUV2ZW50KFxuICAgICAgICAgICAgICAgIHRoaXMucm9vbUlkLFxuICAgICAgICAgICAgICAgIEppdHNpQ2FsbC5NRU1CRVJfRVZFTlRfVFlQRSxcbiAgICAgICAgICAgICAgICBuZXdDb250ZW50LFxuICAgICAgICAgICAgICAgIHRoaXMuY2xpZW50LmdldFVzZXJJZCgpISxcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgY2xlYW4oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgICAgIGNvbnN0IHsgZGV2aWNlczogbXlEZXZpY2VzIH0gPSBhd2FpdCB0aGlzLmNsaWVudC5nZXREZXZpY2VzKCk7XG4gICAgICAgIGNvbnN0IGRldmljZU1hcCA9IG5ldyBNYXA8c3RyaW5nLCBJTXlEZXZpY2U+KG15RGV2aWNlcy5tYXAoKGQpID0+IFtkLmRldmljZV9pZCwgZF0pKTtcblxuICAgICAgICAvLyBDbGVhbiB1cCBvdXIgbWVtYmVyIHN0YXRlIGJ5IGZpbHRlcmluZyBvdXQgbG9nZ2VkIG91dCBkZXZpY2VzLFxuICAgICAgICAvLyBpbmFjdGl2ZSBkZXZpY2VzLCBhbmQgb3VyIG93biBkZXZpY2UgKGlmIHdlJ3JlIGRpc2Nvbm5lY3RlZClcbiAgICAgICAgYXdhaXQgdGhpcy51cGRhdGVEZXZpY2VzKChkZXZpY2VzKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBuZXdEZXZpY2VzID0gZGV2aWNlcy5maWx0ZXIoKGQpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBkZXZpY2UgPSBkZXZpY2VNYXAuZ2V0KGQpO1xuICAgICAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgICAgICAgIGRldmljZT8ubGFzdF9zZWVuX3RzICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgICAgICAgICAgIShkID09PSB0aGlzLmNsaWVudC5nZXREZXZpY2VJZCgpICYmICF0aGlzLmNvbm5lY3RlZCkgJiZcbiAgICAgICAgICAgICAgICAgICAgbm93IC0gZGV2aWNlLmxhc3Rfc2Vlbl90cyA8IHRoaXMuU1RVQ0tfREVWSUNFX1RJTUVPVVRfTVNcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIFNraXAgdGhlIHVwZGF0ZSBpZiB0aGUgZGV2aWNlcyBhcmUgdW5jaGFuZ2VkXG4gICAgICAgICAgICByZXR1cm4gbmV3RGV2aWNlcy5sZW5ndGggPT09IGRldmljZXMubGVuZ3RoID8gbnVsbCA6IG5ld0RldmljZXM7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgYWRkT3VyRGV2aWNlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBhd2FpdCB0aGlzLnVwZGF0ZURldmljZXMoKGRldmljZXMpID0+IEFycmF5LmZyb20obmV3IFNldChkZXZpY2VzKS5hZGQodGhpcy5jbGllbnQuZ2V0RGV2aWNlSWQoKSEpKSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyByZW1vdmVPdXJEZXZpY2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGF3YWl0IHRoaXMudXBkYXRlRGV2aWNlcygoZGV2aWNlcykgPT4ge1xuICAgICAgICAgICAgY29uc3QgZGV2aWNlc1NldCA9IG5ldyBTZXQoZGV2aWNlcyk7XG4gICAgICAgICAgICBkZXZpY2VzU2V0LmRlbGV0ZSh0aGlzLmNsaWVudC5nZXREZXZpY2VJZCgpISk7XG4gICAgICAgICAgICByZXR1cm4gQXJyYXkuZnJvbShkZXZpY2VzU2V0KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGFzeW5jIHBlcmZvcm1Db25uZWN0aW9uKFxuICAgICAgICBhdWRpb0lucHV0OiBNZWRpYURldmljZUluZm8gfCBudWxsLFxuICAgICAgICB2aWRlb0lucHV0OiBNZWRpYURldmljZUluZm8gfCBudWxsLFxuICAgICk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICAvLyBFbnN1cmUgdGhhdCB0aGUgbWVzc2FnaW5nIGRvZXNuJ3QgZ2V0IHN0b3BwZWQgd2hpbGUgd2UncmUgd2FpdGluZyBmb3IgcmVzcG9uc2VzXG4gICAgICAgIGNvbnN0IGRvbnRTdG9wTWVzc2FnaW5nID0gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbWVzc2FnaW5nU3RvcmUgPSBXaWRnZXRNZXNzYWdpbmdTdG9yZS5pbnN0YW5jZTtcblxuICAgICAgICAgICAgY29uc3QgbGlzdGVuZXIgPSAodWlkOiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodWlkID09PSB0aGlzLndpZGdldFVpZCkge1xuICAgICAgICAgICAgICAgICAgICBjbGVhbnVwKCk7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoXCJNZXNzYWdpbmcgc3RvcHBlZFwiKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGNvbnN0IGRvbmUgPSAoKTogdm9pZCA9PiB7XG4gICAgICAgICAgICAgICAgY2xlYW51cCgpO1xuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBjb25zdCBjbGVhbnVwID0gKCk6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICAgIG1lc3NhZ2luZ1N0b3JlLm9mZihXaWRnZXRNZXNzYWdpbmdTdG9yZUV2ZW50LlN0b3BNZXNzYWdpbmcsIGxpc3RlbmVyKTtcbiAgICAgICAgICAgICAgICB0aGlzLm9mZihDYWxsRXZlbnQuQ29ubmVjdGlvblN0YXRlLCBkb25lKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIG1lc3NhZ2luZ1N0b3JlLm9uKFdpZGdldE1lc3NhZ2luZ1N0b3JlRXZlbnQuU3RvcE1lc3NhZ2luZywgbGlzdGVuZXIpO1xuICAgICAgICAgICAgdGhpcy5vbihDYWxsRXZlbnQuQ29ubmVjdGlvblN0YXRlLCBkb25lKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gRW1waXJpY2FsbHksIGl0J3MgcG9zc2libGUgZm9yIEppdHNpIE1lZXQgdG8gY3Jhc2ggaW5zdGFudGx5IGF0IHN0YXJ0dXAsXG4gICAgICAgIC8vIHNlbmRpbmcgYSBoYW5ndXAgZXZlbnQgdGhhdCByYWNlcyB3aXRoIHRoZSByZXN0IG9mIHRoaXMgbWV0aG9kLCBzbyB3ZSBuZWVkXG4gICAgICAgIC8vIHRvIGFkZCB0aGUgaGFuZ3VwIGxpc3RlbmVyIG5vdyByYXRoZXIgdGhhbiBsYXRlclxuICAgICAgICB0aGlzLm1lc3NhZ2luZyEub24oYGFjdGlvbjoke0VsZW1lbnRXaWRnZXRBY3Rpb25zLkhhbmd1cENhbGx9YCwgdGhpcy5vbkhhbmd1cCk7XG5cbiAgICAgICAgLy8gQWN0dWFsbHkgcGVyZm9ybSB0aGUgam9pblxuICAgICAgICBjb25zdCByZXNwb25zZSA9IHdhaXRGb3JFdmVudChcbiAgICAgICAgICAgIHRoaXMubWVzc2FnaW5nISxcbiAgICAgICAgICAgIGBhY3Rpb246JHtFbGVtZW50V2lkZ2V0QWN0aW9ucy5Kb2luQ2FsbH1gLFxuICAgICAgICAgICAgKGV2OiBDdXN0b21FdmVudDxJV2lkZ2V0QXBpUmVxdWVzdD4pID0+IHtcbiAgICAgICAgICAgICAgICBldi5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgIHRoaXMubWVzc2FnaW5nIS50cmFuc3BvcnQucmVwbHkoZXYuZGV0YWlsLCB7fSk7IC8vIGFja1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgKTtcbiAgICAgICAgY29uc3QgcmVxdWVzdCA9IHRoaXMubWVzc2FnaW5nIS50cmFuc3BvcnQuc2VuZChFbGVtZW50V2lkZ2V0QWN0aW9ucy5Kb2luQ2FsbCwge1xuICAgICAgICAgICAgYXVkaW9JbnB1dDogYXVkaW9JbnB1dD8ubGFiZWwgPz8gbnVsbCxcbiAgICAgICAgICAgIHZpZGVvSW5wdXQ6IHZpZGVvSW5wdXQ/LmxhYmVsID8/IG51bGwsXG4gICAgICAgIH0pO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgUHJvbWlzZS5yYWNlKFtQcm9taXNlLmFsbChbcmVxdWVzdCwgcmVzcG9uc2VdKSwgZG9udFN0b3BNZXNzYWdpbmddKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgLy8gSWYgaXQgdGltZWQgb3V0LCBjbGVhbiB1cCBvdXIgYWR2YW5jZSBwcmVwYXJhdGlvbnNcbiAgICAgICAgICAgIHRoaXMubWVzc2FnaW5nIS5vZmYoYGFjdGlvbjoke0VsZW1lbnRXaWRnZXRBY3Rpb25zLkhhbmd1cENhbGx9YCwgdGhpcy5vbkhhbmd1cCk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLm1lc3NhZ2luZyEudHJhbnNwb3J0LnJlYWR5KSB7XG4gICAgICAgICAgICAgICAgLy8gVGhlIG1lc3NhZ2luZyBzdGlsbCBleGlzdHMsIHdoaWNoIG1lYW5zIEppdHNpIG1pZ2h0IHN0aWxsIGJlIGdvaW5nIGluIHRoZSBiYWNrZ3JvdW5kXG4gICAgICAgICAgICAgICAgdGhpcy5tZXNzYWdpbmchLnRyYW5zcG9ydC5zZW5kKEVsZW1lbnRXaWRnZXRBY3Rpb25zLkhhbmd1cENhbGwsIHsgZm9yY2U6IHRydWUgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGpvaW4gY2FsbCBpbiByb29tICR7dGhpcy5yb29tSWR9OiAke2V9YCk7XG4gICAgICAgIH1cblxuICAgICAgICBBY3RpdmVXaWRnZXRTdG9yZS5pbnN0YW5jZS5vbihBY3RpdmVXaWRnZXRTdG9yZUV2ZW50LkRvY2ssIHRoaXMub25Eb2NrKTtcbiAgICAgICAgQWN0aXZlV2lkZ2V0U3RvcmUuaW5zdGFuY2Uub24oQWN0aXZlV2lkZ2V0U3RvcmVFdmVudC5VbmRvY2ssIHRoaXMub25VbmRvY2spO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBhc3luYyBwZXJmb3JtRGlzY29ubmVjdGlvbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSB3YWl0Rm9yRXZlbnQoXG4gICAgICAgICAgICB0aGlzLm1lc3NhZ2luZyEsXG4gICAgICAgICAgICBgYWN0aW9uOiR7RWxlbWVudFdpZGdldEFjdGlvbnMuSGFuZ3VwQ2FsbH1gLFxuICAgICAgICAgICAgKGV2OiBDdXN0b21FdmVudDxJV2lkZ2V0QXBpUmVxdWVzdD4pID0+IHtcbiAgICAgICAgICAgICAgICBldi5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgIHRoaXMubWVzc2FnaW5nIS50cmFuc3BvcnQucmVwbHkoZXYuZGV0YWlsLCB7fSk7IC8vIGFja1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgKTtcbiAgICAgICAgY29uc3QgcmVxdWVzdCA9IHRoaXMubWVzc2FnaW5nIS50cmFuc3BvcnQuc2VuZChFbGVtZW50V2lkZ2V0QWN0aW9ucy5IYW5ndXBDYWxsLCB7fSk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChbcmVxdWVzdCwgcmVzcG9uc2VdKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gaGFuZ3VwIGNhbGwgaW4gcm9vbSAke3RoaXMucm9vbUlkfTogJHtlfWApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIHNldERpc2Nvbm5lY3RlZCgpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5tZXNzYWdpbmchLm9mZihgYWN0aW9uOiR7RWxlbWVudFdpZGdldEFjdGlvbnMuSGFuZ3VwQ2FsbH1gLCB0aGlzLm9uSGFuZ3VwKTtcbiAgICAgICAgQWN0aXZlV2lkZ2V0U3RvcmUuaW5zdGFuY2Uub2ZmKEFjdGl2ZVdpZGdldFN0b3JlRXZlbnQuRG9jaywgdGhpcy5vbkRvY2spO1xuICAgICAgICBBY3RpdmVXaWRnZXRTdG9yZS5pbnN0YW5jZS5vZmYoQWN0aXZlV2lkZ2V0U3RvcmVFdmVudC5VbmRvY2ssIHRoaXMub25VbmRvY2spO1xuXG4gICAgICAgIHN1cGVyLnNldERpc2Nvbm5lY3RlZCgpO1xuICAgIH1cblxuICAgIHB1YmxpYyBkZXN0cm95KCk6IHZvaWQge1xuICAgICAgICB0aGlzLnJvb20ub2ZmKFJvb21TdGF0ZUV2ZW50LlVwZGF0ZSwgdGhpcy5vblJvb21TdGF0ZSk7XG4gICAgICAgIHRoaXMub24oQ2FsbEV2ZW50LkNvbm5lY3Rpb25TdGF0ZSwgdGhpcy5vbkNvbm5lY3Rpb25TdGF0ZSk7XG4gICAgICAgIGlmICh0aGlzLnBhcnRpY2lwYW50c0V4cGlyYXRpb25UaW1lciAhPT0gbnVsbCkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMucGFydGljaXBhbnRzRXhwaXJhdGlvblRpbWVyKTtcbiAgICAgICAgICAgIHRoaXMucGFydGljaXBhbnRzRXhwaXJhdGlvblRpbWVyID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5yZXNlbmREZXZpY2VzVGltZXIgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5yZXNlbmREZXZpY2VzVGltZXIpO1xuICAgICAgICAgICAgdGhpcy5yZXNlbmREZXZpY2VzVGltZXIgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgc3VwZXIuZGVzdHJveSgpO1xuICAgIH1cblxuICAgIHByaXZhdGUgb25Sb29tU3RhdGUgPSAoKTogdm9pZCA9PiB0aGlzLnVwZGF0ZVBhcnRpY2lwYW50cygpO1xuXG4gICAgcHJpdmF0ZSBvbkNvbm5lY3Rpb25TdGF0ZSA9IGFzeW5jIChzdGF0ZTogQ29ubmVjdGlvblN0YXRlLCBwcmV2U3RhdGU6IENvbm5lY3Rpb25TdGF0ZSk6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgICAgICBpZiAoc3RhdGUgPT09IENvbm5lY3Rpb25TdGF0ZS5Db25uZWN0ZWQgJiYgIWlzQ29ubmVjdGVkKHByZXZTdGF0ZSkpIHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlUGFydGljaXBhbnRzKCk7IC8vIExvY2FsIGVjaG9cblxuICAgICAgICAgICAgLy8gVGVsbCBvdGhlcnMgdGhhdCB3ZSdyZSBjb25uZWN0ZWQsIGJ5IGFkZGluZyBvdXIgZGV2aWNlIHRvIHJvb20gc3RhdGVcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuYWRkT3VyRGV2aWNlKCk7XG4gICAgICAgICAgICAvLyBSZS1hZGQgdGhpcyBkZXZpY2UgZXZlcnkgc28gb2Z0ZW4gc28gb3VyIHZpZGVvIG1lbWJlciBldmVudCBkb2Vzbid0IGJlY29tZSBzdGFsZVxuICAgICAgICAgICAgdGhpcy5yZXNlbmREZXZpY2VzVGltZXIgPSB3aW5kb3cuc2V0SW50ZXJ2YWwoYXN5bmMgKCk6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYFJlc2VuZGluZyB2aWRlbyBtZW1iZXIgZXZlbnQgZm9yICR7dGhpcy5yb29tSWR9YCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5hZGRPdXJEZXZpY2UoKTtcbiAgICAgICAgICAgIH0sICh0aGlzLlNUVUNLX0RFVklDRV9USU1FT1VUX01TICogMykgLyA0KTtcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gQ29ubmVjdGlvblN0YXRlLkRpc2Nvbm5lY3RlZCAmJiBpc0Nvbm5lY3RlZChwcmV2U3RhdGUpKSB7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVBhcnRpY2lwYW50cygpOyAvLyBMb2NhbCBlY2hvXG5cbiAgICAgICAgICAgIGlmICh0aGlzLnJlc2VuZERldmljZXNUaW1lciAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5yZXNlbmREZXZpY2VzVGltZXIpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVzZW5kRGV2aWNlc1RpbWVyID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFRlbGwgb3RoZXJzIHRoYXQgd2UncmUgZGlzY29ubmVjdGVkLCBieSByZW1vdmluZyBvdXIgZGV2aWNlIGZyb20gcm9vbSBzdGF0ZVxuICAgICAgICAgICAgYXdhaXQgdGhpcy5yZW1vdmVPdXJEZXZpY2UoKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBwcml2YXRlIG9uRG9jayA9IGFzeW5jICgpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgICAgLy8gVGhlIHdpZGdldCBpcyBubyBsb25nZXIgYSBQaVAsIHNvIGxldCdzIHJlc3RvcmUgdGhlIGRlZmF1bHQgbGF5b3V0XG4gICAgICAgIGF3YWl0IHRoaXMubWVzc2FnaW5nIS50cmFuc3BvcnQuc2VuZChFbGVtZW50V2lkZ2V0QWN0aW9ucy5UaWxlTGF5b3V0LCB7fSk7XG4gICAgfTtcblxuICAgIHByaXZhdGUgb25VbmRvY2sgPSBhc3luYyAoKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICAgIC8vIFRoZSB3aWRnZXQgaGFzIGJlY29tZSBhIFBpUCwgc28gbGV0J3Mgc3dpdGNoIEppdHNpIHRvIHNwb3RsaWdodCBtb2RlXG4gICAgICAgIC8vIHRvIG9ubHkgc2hvdyB0aGUgYWN0aXZlIHNwZWFrZXIgYW5kIGVjb25vbWl6ZSBvbiBzcGFjZVxuICAgICAgICBhd2FpdCB0aGlzLm1lc3NhZ2luZyEudHJhbnNwb3J0LnNlbmQoRWxlbWVudFdpZGdldEFjdGlvbnMuU3BvdGxpZ2h0TGF5b3V0LCB7fSk7XG4gICAgfTtcblxuICAgIHByaXZhdGUgb25IYW5ndXAgPSBhc3luYyAoZXY6IEN1c3RvbUV2ZW50PElXaWRnZXRBcGlSZXF1ZXN0Pik6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgICAgICAvLyBJZiB3ZSdyZSBhbHJlYWR5IGluIHRoZSBtaWRkbGUgb2YgYSBjbGllbnQtaW5pdGlhdGVkIGRpc2Nvbm5lY3Rpb24sXG4gICAgICAgIC8vIGlnbm9yZSB0aGUgZXZlbnRcbiAgICAgICAgaWYgKHRoaXMuY29ubmVjdGlvblN0YXRlID09PSBDb25uZWN0aW9uU3RhdGUuRGlzY29ubmVjdGluZykgcmV0dXJuO1xuXG4gICAgICAgIGV2LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgLy8gSW4gY2FzZSB0aGlzIGhhbmd1cCBpcyBjYXVzZWQgYnkgSml0c2kgTWVldCBjcmFzaGluZyBhdCBzdGFydHVwLFxuICAgICAgICAvLyB3YWl0IGZvciB0aGUgY29ubmVjdGlvbiBldmVudCBpbiBvcmRlciB0byBhdm9pZCByYWNpbmdcbiAgICAgICAgaWYgKHRoaXMuY29ubmVjdGlvblN0YXRlID09PSBDb25uZWN0aW9uU3RhdGUuQ29ubmVjdGluZykge1xuICAgICAgICAgICAgYXdhaXQgd2FpdEZvckV2ZW50KHRoaXMsIENhbGxFdmVudC5Db25uZWN0aW9uU3RhdGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgdGhpcy5tZXNzYWdpbmchLnRyYW5zcG9ydC5yZXBseShldi5kZXRhaWwsIHt9KTsgLy8gYWNrXG4gICAgICAgIHRoaXMuc2V0RGlzY29ubmVjdGVkKCk7XG4gICAgfTtcbn1cblxuLyoqXG4gKiBBIGdyb3VwIGNhbGwgdXNpbmcgTVNDMzQwMSBhbmQgRWxlbWVudCBDYWxsIGFzIGEgYmFja2VuZC5cbiAqIChzb21ld2hhdCBjaGVla2lseSBuYW1lZClcbiAqL1xuZXhwb3J0IGNsYXNzIEVsZW1lbnRDYWxsIGV4dGVuZHMgQ2FsbCB7XG4gICAgcHVibGljIHN0YXRpYyByZWFkb25seSBDQUxMX0VWRU5UX1RZUEUgPSBuZXcgTmFtZXNwYWNlZFZhbHVlKG51bGwsIEV2ZW50VHlwZS5Hcm91cENhbGxQcmVmaXgpO1xuICAgIHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgTUVNQkVSX0VWRU5UX1RZUEUgPSBuZXcgTmFtZXNwYWNlZFZhbHVlKG51bGwsIEV2ZW50VHlwZS5Hcm91cENhbGxNZW1iZXJQcmVmaXgpO1xuICAgIHB1YmxpYyByZWFkb25seSBTVFVDS19ERVZJQ0VfVElNRU9VVF9NUyA9IDEwMDAgKiA2MCAqIDYwOyAvLyAxIGhvdXJcblxuICAgIHByaXZhdGUgdGVybWluYXRpb25UaW1lcjogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cbiAgICBwcml2YXRlIF9sYXlvdXQgPSBMYXlvdXQuVGlsZTtcbiAgICBwdWJsaWMgZ2V0IGxheW91dCgpOiBMYXlvdXQge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGF5b3V0O1xuICAgIH1cbiAgICBwcm90ZWN0ZWQgc2V0IGxheW91dCh2YWx1ZTogTGF5b3V0KSB7XG4gICAgICAgIHRoaXMuX2xheW91dCA9IHZhbHVlO1xuICAgICAgICB0aGlzLmVtaXQoQ2FsbEV2ZW50LkxheW91dCwgdmFsdWUpO1xuICAgIH1cblxuICAgIHByaXZhdGUgY29uc3RydWN0b3IocHVibGljIHJlYWRvbmx5IGdyb3VwQ2FsbDogR3JvdXBDYWxsLCBjbGllbnQ6IE1hdHJpeENsaWVudCkge1xuICAgICAgICBjb25zdCBhY2NvdW50QW5hbHl0aWNzRGF0YSA9IGNsaWVudC5nZXRBY2NvdW50RGF0YShQb3N0aG9nQW5hbHl0aWNzLkFOQUxZVElDU19FVkVOVF9UWVBFKTtcbiAgICAgICAgLy8gVGhlIGFuYWx5dGljc0lEIGlzIHBhc3NlZCBkaXJlY3RseSB0byBlbGVtZW50IGNhbGwgKEVDKSBzaW5jZSB0aGlzIGNvZGVwYXRoIGlzIG9ubHkgZm9yIEVDIGFuZCBubyBvdGhlciB3aWRnZXQuXG4gICAgICAgIC8vIFdlIHJlYWxseSBkb24ndCB3YW50IHRoZSBzYW1lIGFuYWx5dGljSUQncyBmb3IgdGhlIEVDIGFuZCBFVyBwb3N0aG9nIGluc3RhbmNlcyAoRGF0YSBvbiBwb3N0aG9nIHNob3VsZCBiZSBsaW1pdGVkL2Fub255bWl6ZWQgYXMgbXVjaCBhcyBwb3NzaWJsZSkuXG4gICAgICAgIC8vIFRoaXMgaXMgcHJvaGliaXRlZCBpbiBFQyB3aGVyZSBhIGhhc2hlZCB2ZXJzaW9uIG9mIHRoZSBhbmFseXRpY3NJRCBpcyB1c2VkIGZvciB0aGUgYWN0dWFsIHBvc3Rob2cgaWRlbnRpZmljYXRpb24uXG4gICAgICAgIC8vIFdlIGNhbiBwYXNzIHRoZSByYXcgRVcgYW5hbHl0aWNzSUQgaGVyZSBzaW5jZSB3ZSBuZWVkIHRvIHRydXN0IEVDIHdpdGggbm90IHNlbmRpbmcgc2Vuc2l0aXZlIGRhdGEgdG8gcG9zdGhvZyAoRUMgaGFzIGFjY2VzcyB0byBtb3JlIHNlbnNpYmxlIGRhdGEgdGhhbiB0aGUgYW5hbHl0aWNzSUQgZS5nLiB0aGUgdXNlcm5hbWUpXG4gICAgICAgIGNvbnN0IGFuYWx5dGljc0lEOiBzdHJpbmcgPSBhY2NvdW50QW5hbHl0aWNzRGF0YT8uZ2V0Q29udGVudCgpLnBzZXVkb255bW91c0FuYWx5dGljc09wdEluXG4gICAgICAgICAgICA/IGFjY291bnRBbmFseXRpY3NEYXRhPy5nZXRDb250ZW50KCkuaWRcbiAgICAgICAgICAgIDogXCJcIjtcblxuICAgICAgICAvLyBTcGxpY2UgdG9nZXRoZXIgdGhlIEVsZW1lbnQgQ2FsbCBVUkwgZm9yIHRoaXMgY2FsbFxuICAgICAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHtcbiAgICAgICAgICAgIGVtYmVkOiBcIlwiLFxuICAgICAgICAgICAgcHJlbG9hZDogXCJcIixcbiAgICAgICAgICAgIGhpZGVIZWFkZXI6IFwiXCIsXG4gICAgICAgICAgICB1c2VySWQ6IGNsaWVudC5nZXRVc2VySWQoKSEsXG4gICAgICAgICAgICBkZXZpY2VJZDogY2xpZW50LmdldERldmljZUlkKCkhLFxuICAgICAgICAgICAgcm9vbUlkOiBncm91cENhbGwucm9vbS5yb29tSWQsXG4gICAgICAgICAgICBiYXNlVXJsOiBjbGllbnQuYmFzZVVybCxcbiAgICAgICAgICAgIGxhbmc6IGdldEN1cnJlbnRMYW5ndWFnZSgpLnJlcGxhY2UoXCJfXCIsIFwiLVwiKSxcbiAgICAgICAgICAgIGZvbnRTY2FsZTogYCR7U2V0dGluZ3NTdG9yZS5nZXRWYWx1ZShcImJhc2VGb250U2l6ZVwiKSAvIEZvbnRXYXRjaGVyLkRFRkFVTFRfU0laRX1gLFxuICAgICAgICAgICAgYW5hbHl0aWNzSUQsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChTZXR0aW5nc1N0b3JlLmdldFZhbHVlKFwiZmFsbGJhY2tJQ0VTZXJ2ZXJBbGxvd2VkXCIpKSBwYXJhbXMuYXBwZW5kKFwiYWxsb3dJY2VGYWxsYmFja1wiLCBcIlwiKTtcblxuICAgICAgICAvLyBTZXQgY3VzdG9tIGZvbnRzXG4gICAgICAgIGlmIChTZXR0aW5nc1N0b3JlLmdldFZhbHVlKFwidXNlU3lzdGVtRm9udFwiKSkge1xuICAgICAgICAgICAgU2V0dGluZ3NTdG9yZS5nZXRWYWx1ZTxzdHJpbmc+KFwic3lzdGVtRm9udFwiKVxuICAgICAgICAgICAgICAgIC5zcGxpdChcIixcIilcbiAgICAgICAgICAgICAgICAubWFwKChmb250KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFN0cmlwIHdoaXRlc3BhY2UgYW5kIHF1b3Rlc1xuICAgICAgICAgICAgICAgICAgICBmb250ID0gZm9udC50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmb250LnN0YXJ0c1dpdGgoJ1wiJykgJiYgZm9udC5lbmRzV2l0aCgnXCInKSkgZm9udCA9IGZvbnQuc2xpY2UoMSwgLTEpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZm9udDtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5mb3JFYWNoKChmb250KSA9PiBwYXJhbXMuYXBwZW5kKFwiZm9udFwiLCBmb250KSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB1cmwgPSBuZXcgVVJMKFNka0NvbmZpZy5nZXQoXCJlbGVtZW50X2NhbGxcIikudXJsID8/IERFRkFVTFRTLmVsZW1lbnRfY2FsbC51cmwhKTtcbiAgICAgICAgdXJsLnBhdGhuYW1lID0gXCIvcm9vbVwiO1xuICAgICAgICB1cmwuaGFzaCA9IGAjPyR7cGFyYW1zLnRvU3RyaW5nKCl9YDtcblxuICAgICAgICAvLyBUbyB1c2UgRWxlbWVudCBDYWxsIHdpdGhvdXQgdG91Y2hpbmcgcm9vbSBzdGF0ZSwgd2UgY3JlYXRlIGEgdmlydHVhbFxuICAgICAgICAvLyB3aWRnZXQgKG9uZSB0aGF0IGRvZXNuJ3QgaGF2ZSBhIGNvcnJlc3BvbmRpbmcgc3RhdGUgZXZlbnQpXG4gICAgICAgIHN1cGVyKFxuICAgICAgICAgICAgV2lkZ2V0U3RvcmUuaW5zdGFuY2UuYWRkVmlydHVhbFdpZGdldChcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGlkOiByYW5kb21TdHJpbmcoMjQpLCAvLyBTbyB0aGF0IGl0J3MgZ2xvYmFsbHkgdW5pcXVlXG4gICAgICAgICAgICAgICAgICAgIGNyZWF0b3JVc2VySWQ6IGNsaWVudC5nZXRVc2VySWQoKSEsXG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IFwiRWxlbWVudCBDYWxsXCIsXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IE1hdHJpeFdpZGdldFR5cGUuQ3VzdG9tLFxuICAgICAgICAgICAgICAgICAgICB1cmw6IHVybC50b1N0cmluZygpLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZ3JvdXBDYWxsLnJvb20ucm9vbUlkLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIGNsaWVudCxcbiAgICAgICAgKTtcblxuICAgICAgICB0aGlzLm9uKENhbGxFdmVudC5QYXJ0aWNpcGFudHMsIHRoaXMub25QYXJ0aWNpcGFudHMpO1xuICAgICAgICBncm91cENhbGwub24oR3JvdXBDYWxsRXZlbnQuUGFydGljaXBhbnRzQ2hhbmdlZCwgdGhpcy5vbkdyb3VwQ2FsbFBhcnRpY2lwYW50cyk7XG4gICAgICAgIGdyb3VwQ2FsbC5vbihHcm91cENhbGxFdmVudC5Hcm91cENhbGxTdGF0ZUNoYW5nZWQsIHRoaXMub25Hcm91cENhbGxTdGF0ZSk7XG5cbiAgICAgICAgdGhpcy51cGRhdGVQYXJ0aWNpcGFudHMoKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc3RhdGljIGdldChyb29tOiBSb29tKTogRWxlbWVudENhbGwgfCBudWxsIHtcbiAgICAgICAgLy8gT25seSBzdXBwb3J0ZWQgaW4gdGhlIG5ldyBncm91cCBjYWxsIGV4cGVyaWVuY2Ugb3IgaW4gdmlkZW8gcm9vbXNcbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgU2V0dGluZ3NTdG9yZS5nZXRWYWx1ZShcImZlYXR1cmVfZ3JvdXBfY2FsbHNcIikgfHxcbiAgICAgICAgICAgIChTZXR0aW5nc1N0b3JlLmdldFZhbHVlKFwiZmVhdHVyZV92aWRlb19yb29tc1wiKSAmJlxuICAgICAgICAgICAgICAgIFNldHRpbmdzU3RvcmUuZ2V0VmFsdWUoXCJmZWF0dXJlX2VsZW1lbnRfY2FsbF92aWRlb19yb29tc1wiKSAmJlxuICAgICAgICAgICAgICAgIHJvb20uaXNDYWxsUm9vbSgpKVxuICAgICAgICApIHtcbiAgICAgICAgICAgIGNvbnN0IGdyb3VwQ2FsbCA9IHJvb20uY2xpZW50Lmdyb3VwQ2FsbEV2ZW50SGFuZGxlciEuZ3JvdXBDYWxscy5nZXQocm9vbS5yb29tSWQpO1xuICAgICAgICAgICAgaWYgKGdyb3VwQ2FsbCAhPT0gdW5kZWZpbmVkKSByZXR1cm4gbmV3IEVsZW1lbnRDYWxsKGdyb3VwQ2FsbCwgcm9vbS5jbGllbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcHVibGljIHN0YXRpYyBhc3luYyBjcmVhdGUocm9vbTogUm9vbSk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCBpc1ZpZGVvUm9vbSA9XG4gICAgICAgICAgICBTZXR0aW5nc1N0b3JlLmdldFZhbHVlKFwiZmVhdHVyZV92aWRlb19yb29tc1wiKSAmJlxuICAgICAgICAgICAgU2V0dGluZ3NTdG9yZS5nZXRWYWx1ZShcImZlYXR1cmVfZWxlbWVudF9jYWxsX3ZpZGVvX3Jvb21zXCIpICYmXG4gICAgICAgICAgICByb29tLmlzQ2FsbFJvb20oKTtcblxuICAgICAgICBjb25zdCBncm91cENhbGwgPSBuZXcgR3JvdXBDYWxsKFxuICAgICAgICAgICAgcm9vbS5jbGllbnQsXG4gICAgICAgICAgICByb29tLFxuICAgICAgICAgICAgR3JvdXBDYWxsVHlwZS5WaWRlbyxcbiAgICAgICAgICAgIGZhbHNlLFxuICAgICAgICAgICAgaXNWaWRlb1Jvb20gPyBHcm91cENhbGxJbnRlbnQuUm9vbSA6IEdyb3VwQ2FsbEludGVudC5Qcm9tcHQsXG4gICAgICAgICk7XG5cbiAgICAgICAgYXdhaXQgZ3JvdXBDYWxsLmNyZWF0ZSgpO1xuICAgIH1cblxuICAgIHB1YmxpYyBjbGVhbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ3JvdXBDYWxsLmNsZWFuTWVtYmVyU3RhdGUoKTtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgYXN5bmMgcGVyZm9ybUNvbm5lY3Rpb24oXG4gICAgICAgIGF1ZGlvSW5wdXQ6IE1lZGlhRGV2aWNlSW5mbyB8IG51bGwsXG4gICAgICAgIHZpZGVvSW5wdXQ6IE1lZGlhRGV2aWNlSW5mbyB8IG51bGwsXG4gICAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLm1lc3NhZ2luZyEudHJhbnNwb3J0LnNlbmQoRWxlbWVudFdpZGdldEFjdGlvbnMuSm9pbkNhbGwsIHtcbiAgICAgICAgICAgICAgICBhdWRpb0lucHV0OiBhdWRpb0lucHV0Py5sYWJlbCA/PyBudWxsLFxuICAgICAgICAgICAgICAgIHZpZGVvSW5wdXQ6IHZpZGVvSW5wdXQ/LmxhYmVsID8/IG51bGwsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gam9pbiBjYWxsIGluIHJvb20gJHt0aGlzLnJvb21JZH06ICR7ZX1gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZ3JvdXBDYWxsLmVudGVyZWRWaWFBbm90aGVyU2Vzc2lvbiA9IHRydWU7XG4gICAgICAgIHRoaXMubWVzc2FnaW5nIS5vbihgYWN0aW9uOiR7RWxlbWVudFdpZGdldEFjdGlvbnMuSGFuZ3VwQ2FsbH1gLCB0aGlzLm9uSGFuZ3VwKTtcbiAgICAgICAgdGhpcy5tZXNzYWdpbmchLm9uKGBhY3Rpb246JHtFbGVtZW50V2lkZ2V0QWN0aW9ucy5UaWxlTGF5b3V0fWAsIHRoaXMub25UaWxlTGF5b3V0KTtcbiAgICAgICAgdGhpcy5tZXNzYWdpbmchLm9uKGBhY3Rpb246JHtFbGVtZW50V2lkZ2V0QWN0aW9ucy5TcG90bGlnaHRMYXlvdXR9YCwgdGhpcy5vblNwb3RsaWdodExheW91dCk7XG4gICAgICAgIHRoaXMubWVzc2FnaW5nIS5vbihgYWN0aW9uOiR7RWxlbWVudFdpZGdldEFjdGlvbnMuU2NyZWVuc2hhcmVSZXF1ZXN0fWAsIHRoaXMub25TY3JlZW5zaGFyZVJlcXVlc3QpO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBhc3luYyBwZXJmb3JtRGlzY29ubmVjdGlvbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMubWVzc2FnaW5nIS50cmFuc3BvcnQuc2VuZChFbGVtZW50V2lkZ2V0QWN0aW9ucy5IYW5ndXBDYWxsLCB7fSk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGhhbmd1cCBjYWxsIGluIHJvb20gJHt0aGlzLnJvb21JZH06ICR7ZX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBzZXREaXNjb25uZWN0ZWQoKTogdm9pZCB7XG4gICAgICAgIHRoaXMubWVzc2FnaW5nIS5vZmYoYGFjdGlvbjoke0VsZW1lbnRXaWRnZXRBY3Rpb25zLkhhbmd1cENhbGx9YCwgdGhpcy5vbkhhbmd1cCk7XG4gICAgICAgIHRoaXMubWVzc2FnaW5nIS5vZmYoYGFjdGlvbjoke0VsZW1lbnRXaWRnZXRBY3Rpb25zLlRpbGVMYXlvdXR9YCwgdGhpcy5vblRpbGVMYXlvdXQpO1xuICAgICAgICB0aGlzLm1lc3NhZ2luZyEub2ZmKGBhY3Rpb246JHtFbGVtZW50V2lkZ2V0QWN0aW9ucy5TcG90bGlnaHRMYXlvdXR9YCwgdGhpcy5vblNwb3RsaWdodExheW91dCk7XG4gICAgICAgIHRoaXMubWVzc2FnaW5nIS5vZmYoYGFjdGlvbjoke0VsZW1lbnRXaWRnZXRBY3Rpb25zLlNjcmVlbnNoYXJlUmVxdWVzdH1gLCB0aGlzLm9uU2NyZWVuc2hhcmVSZXF1ZXN0KTtcbiAgICAgICAgc3VwZXIuc2V0RGlzY29ubmVjdGVkKCk7XG4gICAgICAgIHRoaXMuZ3JvdXBDYWxsLmVudGVyZWRWaWFBbm90aGVyU2Vzc2lvbiA9IGZhbHNlO1xuICAgIH1cblxuICAgIHB1YmxpYyBkZXN0cm95KCk6IHZvaWQge1xuICAgICAgICBBY3RpdmVXaWRnZXRTdG9yZS5pbnN0YW5jZS5kZXN0cm95UGVyc2lzdGVudFdpZGdldCh0aGlzLndpZGdldC5pZCwgdGhpcy5ncm91cENhbGwucm9vbS5yb29tSWQpO1xuICAgICAgICBXaWRnZXRTdG9yZS5pbnN0YW5jZS5yZW1vdmVWaXJ0dWFsV2lkZ2V0KHRoaXMud2lkZ2V0LmlkLCB0aGlzLmdyb3VwQ2FsbC5yb29tLnJvb21JZCk7XG4gICAgICAgIHRoaXMub2ZmKENhbGxFdmVudC5QYXJ0aWNpcGFudHMsIHRoaXMub25QYXJ0aWNpcGFudHMpO1xuICAgICAgICB0aGlzLmdyb3VwQ2FsbC5vZmYoR3JvdXBDYWxsRXZlbnQuUGFydGljaXBhbnRzQ2hhbmdlZCwgdGhpcy5vbkdyb3VwQ2FsbFBhcnRpY2lwYW50cyk7XG4gICAgICAgIHRoaXMuZ3JvdXBDYWxsLm9mZihHcm91cENhbGxFdmVudC5Hcm91cENhbGxTdGF0ZUNoYW5nZWQsIHRoaXMub25Hcm91cENhbGxTdGF0ZSk7XG5cbiAgICAgICAgaWYgKHRoaXMudGVybWluYXRpb25UaW1lciAhPT0gbnVsbCkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMudGVybWluYXRpb25UaW1lcik7XG4gICAgICAgICAgICB0aGlzLnRlcm1pbmF0aW9uVGltZXIgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgc3VwZXIuZGVzdHJveSgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGNhbGwncyBsYXlvdXQuXG4gICAgICogQHBhcmFtIGxheW91dCBUaGUgbGF5b3V0IHRvIHN3aXRjaCB0by5cbiAgICAgKi9cbiAgICBwdWJsaWMgYXN5bmMgc2V0TGF5b3V0KGxheW91dDogTGF5b3V0KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGNvbnN0IGFjdGlvbiA9IGxheW91dCA9PT0gTGF5b3V0LlRpbGUgPyBFbGVtZW50V2lkZ2V0QWN0aW9ucy5UaWxlTGF5b3V0IDogRWxlbWVudFdpZGdldEFjdGlvbnMuU3BvdGxpZ2h0TGF5b3V0O1xuXG4gICAgICAgIGF3YWl0IHRoaXMubWVzc2FnaW5nIS50cmFuc3BvcnQuc2VuZChhY3Rpb24sIHt9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHVwZGF0ZVBhcnRpY2lwYW50cygpOiB2b2lkIHtcbiAgICAgICAgY29uc3QgcGFydGljaXBhbnRzID0gbmV3IE1hcDxSb29tTWVtYmVyLCBTZXQ8c3RyaW5nPj4oKTtcblxuICAgICAgICBmb3IgKGNvbnN0IFttZW1iZXIsIGRldmljZU1hcF0gb2YgdGhpcy5ncm91cENhbGwucGFydGljaXBhbnRzKSB7XG4gICAgICAgICAgICBwYXJ0aWNpcGFudHMuc2V0KG1lbWJlciwgbmV3IFNldChkZXZpY2VNYXAua2V5cygpKSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnBhcnRpY2lwYW50cyA9IHBhcnRpY2lwYW50cztcbiAgICB9XG5cbiAgICBwcml2YXRlIGdldCBtYXlUZXJtaW5hdGUoKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICB0aGlzLmdyb3VwQ2FsbC5pbnRlbnQgIT09IEdyb3VwQ2FsbEludGVudC5Sb29tICYmXG4gICAgICAgICAgICB0aGlzLnJvb20uY3VycmVudFN0YXRlLm1heUNsaWVudFNlbmRTdGF0ZUV2ZW50KEVsZW1lbnRDYWxsLkNBTExfRVZFTlRfVFlQRS5uYW1lLCB0aGlzLmNsaWVudClcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIG9uUGFydGljaXBhbnRzID0gYXN5bmMgKFxuICAgICAgICBwYXJ0aWNpcGFudHM6IE1hcDxSb29tTWVtYmVyLCBTZXQ8c3RyaW5nPj4sXG4gICAgICAgIHByZXZQYXJ0aWNpcGFudHM6IE1hcDxSb29tTWVtYmVyLCBTZXQ8c3RyaW5nPj4sXG4gICAgKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICAgIGxldCBwYXJ0aWNpcGFudENvdW50ID0gMDtcbiAgICAgICAgZm9yIChjb25zdCBkZXZpY2VzIG9mIHBhcnRpY2lwYW50cy52YWx1ZXMoKSkgcGFydGljaXBhbnRDb3VudCArPSBkZXZpY2VzLnNpemU7XG5cbiAgICAgICAgbGV0IHByZXZQYXJ0aWNpcGFudENvdW50ID0gMDtcbiAgICAgICAgZm9yIChjb25zdCBkZXZpY2VzIG9mIHByZXZQYXJ0aWNpcGFudHMudmFsdWVzKCkpIHByZXZQYXJ0aWNpcGFudENvdW50ICs9IGRldmljZXMuc2l6ZTtcblxuICAgICAgICAvLyBJZiB0aGUgbGFzdCBwYXJ0aWNpcGFudCBkaXNjb25uZWN0ZWQsIHRlcm1pbmF0ZSB0aGUgY2FsbFxuICAgICAgICBpZiAocGFydGljaXBhbnRDb3VudCA9PT0gMCAmJiBwcmV2UGFydGljaXBhbnRDb3VudCA+IDAgJiYgdGhpcy5tYXlUZXJtaW5hdGUpIHtcbiAgICAgICAgICAgIGlmIChwcmV2UGFydGljaXBhbnRzLmdldCh0aGlzLnJvb20uZ2V0TWVtYmVyKHRoaXMuY2xpZW50LmdldFVzZXJJZCgpISkhKT8uaGFzKHRoaXMuY2xpZW50LmdldERldmljZUlkKCkhKSkge1xuICAgICAgICAgICAgICAgIC8vIElmIHdlIHdlcmUgdGhhdCBsYXN0IHBhcnRpY2lwYW50LCBkbyB0aGUgdGVybWluYXRpb24gb3Vyc2VsdmVzXG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5ncm91cENhbGwudGVybWluYXRlKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIFdlIGRvbid0IGFwcGVhciB0byBoYXZlIGJlZW4gdGhlIGxhc3QgcGFydGljaXBhbnQsIGJ1dCBiZWNhdXNlIG9mXG4gICAgICAgICAgICAgICAgLy8gdGhlIHBvdGVudGlhbCBmb3IgcmFjZXMsIHVzZXJzIGxhY2tpbmcgcGVybWlzc2lvbiwgYW5kIGEgbXlyaWFkIG9mXG4gICAgICAgICAgICAgICAgLy8gb3RoZXIgcmVhc29ucywgd2UgY2FuJ3QgcmVseSBvbiBvdGhlciBjbGllbnRzIHRvIHRlcm1pbmF0ZSB0aGUgY2FsbC5cbiAgICAgICAgICAgICAgICAvLyBTaW5jZSBpdCdzIGxpa2VseSB0aGF0IG90aGVyIGNsaWVudHMgYXJlIHVzaW5nIHRoaXMgc2FtZSBsb2dpYywgd2Ugd2FpdFxuICAgICAgICAgICAgICAgIC8vIHJhbmRvbWx5IGJldHdlZW4gMiBhbmQgOCBzZWNvbmRzIGJlZm9yZSB0ZXJtaW5hdGluZyB0aGUgY2FsbCwgdG9cbiAgICAgICAgICAgICAgICAvLyBwcm9iYWJpbGlzdGljYWxseSByZWR1Y2UgZXZlbnQgc3BhbS4gSWYgc29tZW9uZSBlbHNlIGJlYXRzIHVzIHRvIGl0LFxuICAgICAgICAgICAgICAgIC8vIHRoaXMgdGltZXIgd2lsbCBiZSBhdXRvbWF0aWNhbGx5IGNsZWFyZWQgdXBvbiB0aGUgY2FsbCdzIGRlc3RydWN0aW9uLlxuICAgICAgICAgICAgICAgIHRoaXMudGVybWluYXRpb25UaW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KFxuICAgICAgICAgICAgICAgICAgICAoKSA9PiB0aGlzLmdyb3VwQ2FsbC50ZXJtaW5hdGUoKSxcbiAgICAgICAgICAgICAgICAgICAgTWF0aC5yYW5kb20oKSAqIDYwMDAgKyAyMDAwLFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBvbkdyb3VwQ2FsbFBhcnRpY2lwYW50cyA9ICgpOiB2b2lkID0+IHRoaXMudXBkYXRlUGFydGljaXBhbnRzKCk7XG5cbiAgICBwcml2YXRlIG9uR3JvdXBDYWxsU3RhdGUgPSAoc3RhdGU6IEdyb3VwQ2FsbFN0YXRlKTogdm9pZCA9PiB7XG4gICAgICAgIGlmIChzdGF0ZSA9PT0gR3JvdXBDYWxsU3RhdGUuRW5kZWQpIHRoaXMuZGVzdHJveSgpO1xuICAgIH07XG5cbiAgICBwcml2YXRlIG9uSGFuZ3VwID0gYXN5bmMgKGV2OiBDdXN0b21FdmVudDxJV2lkZ2V0QXBpUmVxdWVzdD4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgICAgZXYucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgYXdhaXQgdGhpcy5tZXNzYWdpbmchLnRyYW5zcG9ydC5yZXBseShldi5kZXRhaWwsIHt9KTsgLy8gYWNrXG4gICAgICAgIHRoaXMuc2V0RGlzY29ubmVjdGVkKCk7XG4gICAgfTtcblxuICAgIHByaXZhdGUgb25UaWxlTGF5b3V0ID0gYXN5bmMgKGV2OiBDdXN0b21FdmVudDxJV2lkZ2V0QXBpUmVxdWVzdD4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgICAgZXYucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgdGhpcy5sYXlvdXQgPSBMYXlvdXQuVGlsZTtcbiAgICAgICAgYXdhaXQgdGhpcy5tZXNzYWdpbmchLnRyYW5zcG9ydC5yZXBseShldi5kZXRhaWwsIHt9KTsgLy8gYWNrXG4gICAgfTtcblxuICAgIHByaXZhdGUgb25TcG90bGlnaHRMYXlvdXQgPSBhc3luYyAoZXY6IEN1c3RvbUV2ZW50PElXaWRnZXRBcGlSZXF1ZXN0Pik6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgICAgICBldi5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICB0aGlzLmxheW91dCA9IExheW91dC5TcG90bGlnaHQ7XG4gICAgICAgIGF3YWl0IHRoaXMubWVzc2FnaW5nIS50cmFuc3BvcnQucmVwbHkoZXYuZGV0YWlsLCB7fSk7IC8vIGFja1xuICAgIH07XG5cbiAgICBwcml2YXRlIG9uU2NyZWVuc2hhcmVSZXF1ZXN0ID0gYXN5bmMgKGV2OiBDdXN0b21FdmVudDxJV2lkZ2V0QXBpUmVxdWVzdD4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgICAgZXYucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICBpZiAoUGxhdGZvcm1QZWcuZ2V0KCk/LnN1cHBvcnRzRGVza3RvcENhcHR1cmVyKCkpIHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMubWVzc2FnaW5nIS50cmFuc3BvcnQucmVwbHkoZXYuZGV0YWlsLCB7IHBlbmRpbmc6IHRydWUgfSk7XG5cbiAgICAgICAgICAgIGNvbnN0IHsgZmluaXNoZWQgfSA9IE1vZGFsLmNyZWF0ZURpYWxvZyhEZXNrdG9wQ2FwdHVyZXJTb3VyY2VQaWNrZXIpO1xuICAgICAgICAgICAgY29uc3QgW3NvdXJjZV0gPSBhd2FpdCBmaW5pc2hlZDtcblxuICAgICAgICAgICAgaWYgKHNvdXJjZSkge1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMubWVzc2FnaW5nIS50cmFuc3BvcnQuc2VuZChFbGVtZW50V2lkZ2V0QWN0aW9ucy5TY3JlZW5zaGFyZVN0YXJ0LCB7XG4gICAgICAgICAgICAgICAgICAgIGRlc2t0b3BDYXB0dXJlclNvdXJjZUlkOiBzb3VyY2UsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMubWVzc2FnaW5nIS50cmFuc3BvcnQuc2VuZChFbGVtZW50V2lkZ2V0QWN0aW9ucy5TY3JlZW5zaGFyZVN0b3AsIHt9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMubWVzc2FnaW5nIS50cmFuc3BvcnQucmVwbHkoZXYuZGV0YWlsLCB7IHBlbmRpbmc6IGZhbHNlIH0pO1xuICAgICAgICB9XG4gICAgfTtcbn1cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFnQkEsSUFBQUEsa0JBQUEsR0FBQUMsT0FBQTtBQUNBLElBQUFDLE9BQUEsR0FBQUQsT0FBQTtBQUNBLElBQUFFLGFBQUEsR0FBQUYsT0FBQTtBQUVBLElBQUFHLE1BQUEsR0FBQUgsT0FBQTtBQUNBLElBQUFJLFVBQUEsR0FBQUosT0FBQTtBQUNBLElBQUFLLEtBQUEsR0FBQUwsT0FBQTtBQUNBLElBQUFNLGdCQUFBLEdBQUFOLE9BQUE7QUFDQSxJQUFBTyxnQkFBQSxHQUFBUCxPQUFBO0FBQ0EsSUFBQVEsVUFBQSxHQUFBUixPQUFBO0FBT0EsSUFBQVMsTUFBQSxHQUFBVCxPQUFBO0FBUUEsSUFBQVUsVUFBQSxHQUFBQyx1QkFBQSxDQUFB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