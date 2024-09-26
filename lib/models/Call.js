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
//# sourceMappingURL=Call.js.map