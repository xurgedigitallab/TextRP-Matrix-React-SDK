"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.StopGapWidgetDriver = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _matrixWidgetApi = require("matrix-widget-api");
var _client = require("matrix-js-sdk/src/client");
var _event = require("matrix-js-sdk/src/@types/event");
var _logger = require("matrix-js-sdk/src/logger");
var _thread = require("matrix-js-sdk/src/models/thread");
var _WidgetLifecycle = require("@matrix-org/react-sdk-module-api/lib/lifecycles/WidgetLifecycle");
var _SdkConfig = _interopRequireWildcard(require("../../SdkConfig"));
var _iterables = require("../../utils/iterables");
var _MatrixClientPeg = require("../../MatrixClientPeg");
var _Modal = _interopRequireDefault(require("../../Modal"));
var _WidgetOpenIDPermissionsDialog = _interopRequireDefault(require("../../components/views/dialogs/WidgetOpenIDPermissionsDialog"));
var _WidgetCapabilitiesPromptDialog = _interopRequireDefault(require("../../components/views/dialogs/WidgetCapabilitiesPromptDialog"));
var _WidgetPermissions = require("../../customisations/WidgetPermissions");
var _WidgetPermissionStore = require("./WidgetPermissionStore");
var _WidgetType = require("../../widgets/WidgetType");
var _effects = require("../../effects");
var _utils = require("../../effects/utils");
var _dispatcher = _interopRequireDefault(require("../../dispatcher/dispatcher"));
var _ElementWidgetCapabilities = require("./ElementWidgetCapabilities");
var _navigator = require("../../utils/permalinks/navigator");
var _SDKContext = require("../../contexts/SDKContext");
var _ModuleRunner = require("../../modules/ModuleRunner");
var _SettingsStore = _interopRequireDefault(require("../../settings/SettingsStore"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
/*
 * Copyright 2020 - 2023 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// TODO: Purge this from the universe

function getRememberedCapabilitiesForWidget(widget) {
  return JSON.parse(localStorage.getItem(`widget_${widget.id}_approved_caps`) || "[]");
}
function setRememberedCapabilitiesForWidget(widget, caps) {
  localStorage.setItem(`widget_${widget.id}_approved_caps`, JSON.stringify(caps));
}
const normalizeTurnServer = _ref => {
  let {
    urls,
    username,
    credential
  } = _ref;
  return {
    uris: urls,
    username,
    password: credential
  };
};
class StopGapWidgetDriver extends _matrixWidgetApi.WidgetDriver {
  // TODO: Refactor widgetKind into the Widget class
  constructor(allowedCapabilities, forWidget, forWidgetKind, virtual, inRoomId) {
    super();

    // Always allow screenshots to be taken because it's a client-induced flow. The widget can't
    // spew screenshots at us and can't request screenshots of us, so it's up to us to provide the
    // button if the widget says it supports screenshots.
    this.forWidget = forWidget;
    this.forWidgetKind = forWidgetKind;
    this.inRoomId = inRoomId;
    (0, _defineProperty2.default)(this, "allowedCapabilities", void 0);
    this.allowedCapabilities = new Set([...allowedCapabilities, _matrixWidgetApi.MatrixCapabilities.Screenshots, _ElementWidgetCapabilities.ElementWidgetCapabilities.RequiresClient]);

    // Grant the permissions that are specific to given widget types
    if (_WidgetType.WidgetType.JITSI.matches(this.forWidget.type) && forWidgetKind === _matrixWidgetApi.WidgetKind.Room) {
      this.allowedCapabilities.add(_matrixWidgetApi.MatrixCapabilities.AlwaysOnScreen);
    } else if (_WidgetType.WidgetType.STICKERPICKER.matches(this.forWidget.type) && forWidgetKind === _matrixWidgetApi.WidgetKind.Account) {
      const stickerSendingCap = _matrixWidgetApi.WidgetEventCapability.forRoomEvent(_matrixWidgetApi.EventDirection.Send, _event.EventType.Sticker).raw;
      this.allowedCapabilities.add(_matrixWidgetApi.MatrixCapabilities.StickerSending); // legacy as far as MSC2762 is concerned
      this.allowedCapabilities.add(stickerSendingCap);

      // Auto-approve the legacy visibility capability. We send it regardless of capability.
      // Widgets don't technically need to request this capability, but Scalar still does.
      this.allowedCapabilities.add("visibility");
    } else if (virtual && new URL(_SdkConfig.default.get("element_call").url ?? _SdkConfig.DEFAULTS.element_call.url).origin === this.forWidget.origin) {
      // This is a trusted Element Call widget that we control
      this.allowedCapabilities.add(_matrixWidgetApi.MatrixCapabilities.AlwaysOnScreen);
      this.allowedCapabilities.add(_matrixWidgetApi.MatrixCapabilities.MSC3846TurnServers);
      this.allowedCapabilities.add(`org.matrix.msc2762.timeline:${inRoomId}`);
      this.allowedCapabilities.add(_matrixWidgetApi.WidgetEventCapability.forRoomEvent(_matrixWidgetApi.EventDirection.Send, "org.matrix.rageshake_request").raw);
      this.allowedCapabilities.add(_matrixWidgetApi.WidgetEventCapability.forRoomEvent(_matrixWidgetApi.EventDirection.Receive, "org.matrix.rageshake_request").raw);
      this.allowedCapabilities.add(_matrixWidgetApi.WidgetEventCapability.forStateEvent(_matrixWidgetApi.EventDirection.Receive, _event.EventType.RoomMember).raw);
      this.allowedCapabilities.add(_matrixWidgetApi.WidgetEventCapability.forStateEvent(_matrixWidgetApi.EventDirection.Receive, "org.matrix.msc3401.call").raw);
      this.allowedCapabilities.add(_matrixWidgetApi.WidgetEventCapability.forStateEvent(_matrixWidgetApi.EventDirection.Send, "org.matrix.msc3401.call.member", _MatrixClientPeg.MatrixClientPeg.get().getUserId()).raw);
      this.allowedCapabilities.add(_matrixWidgetApi.WidgetEventCapability.forStateEvent(_matrixWidgetApi.EventDirection.Receive, "org.matrix.msc3401.call.member").raw);
      const sendRecvToDevice = [_event.EventType.CallInvite, _event.EventType.CallCandidates, _event.EventType.CallAnswer, _event.EventType.CallHangup, _event.EventType.CallReject, _event.EventType.CallSelectAnswer, _event.EventType.CallNegotiate, _event.EventType.CallSDPStreamMetadataChanged, _event.EventType.CallSDPStreamMetadataChangedPrefix, _event.EventType.CallReplaces];
      for (const eventType of sendRecvToDevice) {
        this.allowedCapabilities.add(_matrixWidgetApi.WidgetEventCapability.forToDeviceEvent(_matrixWidgetApi.EventDirection.Send, eventType).raw);
        this.allowedCapabilities.add(_matrixWidgetApi.WidgetEventCapability.forToDeviceEvent(_matrixWidgetApi.EventDirection.Receive, eventType).raw);
      }
    }
  }
  async validateCapabilities(requested) {
    // Check to see if any capabilities aren't automatically accepted (such as sticker pickers
    // allowing stickers to be sent). If there are excess capabilities to be approved, the user
    // will be prompted to accept them.
    const diff = (0, _iterables.iterableDiff)(requested, this.allowedCapabilities);
    const missing = new Set(diff.removed); // "removed" is "in A (requested) but not in B (allowed)"
    const allowedSoFar = new Set(this.allowedCapabilities);
    getRememberedCapabilitiesForWidget(this.forWidget).forEach(cap => {
      allowedSoFar.add(cap);
      missing.delete(cap);
    });
    let approved;
    if (_WidgetPermissions.WidgetPermissionCustomisations.preapproveCapabilities) {
      approved = await _WidgetPermissions.WidgetPermissionCustomisations.preapproveCapabilities(this.forWidget, requested);
    } else {
      const opts = {
        approvedCapabilities: undefined
      };
      _ModuleRunner.ModuleRunner.instance.invoke(_WidgetLifecycle.WidgetLifecycle.CapabilitiesRequest, opts, this.forWidget, requested);
      approved = opts.approvedCapabilities;
    }
    if (approved) {
      approved.forEach(cap => {
        allowedSoFar.add(cap);
        missing.delete(cap);
      });
    }

    // TODO: Do something when the widget requests new capabilities not yet asked for
    let rememberApproved = false;
    if (missing.size > 0) {
      try {
        const [result] = await _Modal.default.createDialog(_WidgetCapabilitiesPromptDialog.default, {
          requestedCapabilities: missing,
          widget: this.forWidget,
          widgetKind: this.forWidgetKind
        }).finished;
        result?.approved?.forEach(cap => allowedSoFar.add(cap));
        rememberApproved = !!result?.remember;
      } catch (e) {
        _logger.logger.error("Non-fatal error getting capabilities: ", e);
      }
    }

    // discard all previously allowed capabilities if they are not requested
    // TODO: this results in an unexpected behavior when this function is called during the capabilities renegotiation of MSC2974 that will be resolved later.
    const allAllowed = new Set((0, _iterables.iterableIntersection)(allowedSoFar, requested));
    if (rememberApproved) {
      setRememberedCapabilitiesForWidget(this.forWidget, Array.from(allAllowed));
    }
    return allAllowed;
  }
  async sendEvent(eventType, content, stateKey, targetRoomId) {
    const client = _MatrixClientPeg.MatrixClientPeg.get();
    const roomId = targetRoomId || _SDKContext.SdkContextClass.instance.roomViewStore.getRoomId();
    if (!client || !roomId) throw new Error("Not in a room or not attached to a client");
    let r = null; // eslint-disable-line camelcase
    if (stateKey !== null) {
      // state event
      r = await client.sendStateEvent(roomId, eventType, content, stateKey);
    } else if (eventType === _event.EventType.RoomRedaction) {
      // special case: extract the `redacts` property and call redact
      r = await client.redactEvent(roomId, content["redacts"]);
    } else {
      // message event
      r = await client.sendEvent(roomId, eventType, content);
      if (eventType === _event.EventType.RoomMessage) {
        _effects.CHAT_EFFECTS.forEach(effect => {
          if ((0, _utils.containsEmoji)(content, effect.emojis)) {
            // For initial threads launch, chat effects are disabled
            // see #19731
            const isNotThread = content["m.relates_to"]?.rel_type !== _thread.THREAD_RELATION_TYPE.name;
            if (isNotThread) {
              _dispatcher.default.dispatch({
                action: `effects.${effect.command}`
              });
            }
          }
        });
      }
    }
    return {
      roomId,
      eventId: r.event_id
    };
  }
  async sendToDevice(eventType, encrypted, contentMap) {
    const client = _MatrixClientPeg.MatrixClientPeg.get();
    if (encrypted) {
      const deviceInfoMap = await client.crypto.deviceList.downloadKeys(Object.keys(contentMap), false);
      await Promise.all(Object.entries(contentMap).flatMap(_ref2 => {
        let [userId, userContentMap] = _ref2;
        return Object.entries(userContentMap).map(async _ref3 => {
          let [deviceId, content] = _ref3;
          const devices = deviceInfoMap.get(userId);
          if (!devices) return;
          if (deviceId === "*") {
            // Send the message to all devices we have keys for
            await client.encryptAndSendToDevices(Array.from(devices.values()).map(deviceInfo => ({
              userId,
              deviceInfo
            })), content);
          } else if (devices.has(deviceId)) {
            // Send the message to a specific device
            await client.encryptAndSendToDevices([{
              userId,
              deviceInfo: devices.get(deviceId)
            }], content);
          }
        });
      }));
    } else {
      await client.queueToDevice({
        eventType,
        batch: Object.entries(contentMap).flatMap(_ref4 => {
          let [userId, userContentMap] = _ref4;
          return Object.entries(userContentMap).map(_ref5 => {
            let [deviceId, content] = _ref5;
            return {
              userId,
              deviceId,
              payload: content
            };
          });
        })
      });
    }
  }
  pickRooms(roomIds) {
    const client = _MatrixClientPeg.MatrixClientPeg.get();
    if (!client) throw new Error("Not attached to a client");
    const targetRooms = roomIds ? roomIds.includes(_matrixWidgetApi.Symbols.AnyRoom) ? client.getVisibleRooms(_SettingsStore.default.getValue("feature_dynamic_room_predecessors")) : roomIds.map(r => client.getRoom(r)) : [client.getRoom(_SDKContext.SdkContextClass.instance.roomViewStore.getRoomId())];
    return targetRooms.filter(r => !!r);
  }
  async readRoomEvents(eventType, msgtype, limitPerRoom, roomIds) {
    limitPerRoom = limitPerRoom > 0 ? Math.min(limitPerRoom, Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER; // relatively arbitrary

    const rooms = this.pickRooms(roomIds);
    const allResults = [];
    for (const room of rooms) {
      const results = [];
      const events = room.getLiveTimeline().getEvents(); // timelines are most recent last
      for (let i = events.length - 1; i > 0; i--) {
        if (results.length >= limitPerRoom) break;
        const ev = events[i];
        if (ev.getType() !== eventType || ev.isState()) continue;
        if (eventType === _event.EventType.RoomMessage && msgtype && msgtype !== ev.getContent()["msgtype"]) continue;
        results.push(ev);
      }
      results.forEach(e => allResults.push(e.getEffectiveEvent()));
    }
    return allResults;
  }
  async readStateEvents(eventType, stateKey, limitPerRoom, roomIds) {
    limitPerRoom = limitPerRoom > 0 ? Math.min(limitPerRoom, Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER; // relatively arbitrary

    const rooms = this.pickRooms(roomIds);
    const allResults = [];
    for (const room of rooms) {
      const results = [];
      const state = room.currentState.events.get(eventType);
      if (state) {
        if (stateKey === "" || !!stateKey) {
          const forKey = state.get(stateKey);
          if (forKey) results.push(forKey);
        } else {
          results.push(...Array.from(state.values()));
        }
      }
      results.slice(0, limitPerRoom).forEach(e => allResults.push(e.getEffectiveEvent()));
    }
    return allResults;
  }
  async askOpenID(observer) {
    const opts = {
      approved: undefined
    };
    _ModuleRunner.ModuleRunner.instance.invoke(_WidgetLifecycle.WidgetLifecycle.IdentityRequest, opts, this.forWidget);
    if (opts.approved) {
      return observer.update({
        state: _matrixWidgetApi.OpenIDRequestState.Allowed,
        token: await _MatrixClientPeg.MatrixClientPeg.get().getOpenIdToken()
      });
    }
    const oidcState = _SDKContext.SdkContextClass.instance.widgetPermissionStore.getOIDCState(this.forWidget, this.forWidgetKind, this.inRoomId);
    const getToken = () => {
      return _MatrixClientPeg.MatrixClientPeg.get().getOpenIdToken();
    };
    if (oidcState === _WidgetPermissionStore.OIDCState.Denied) {
      return observer.update({
        state: _matrixWidgetApi.OpenIDRequestState.Blocked
      });
    }
    if (oidcState === _WidgetPermissionStore.OIDCState.Allowed) {
      return observer.update({
        state: _matrixWidgetApi.OpenIDRequestState.Allowed,
        token: await getToken()
      });
    }
    observer.update({
      state: _matrixWidgetApi.OpenIDRequestState.PendingUserConfirmation
    });
    _Modal.default.createDialog(_WidgetOpenIDPermissionsDialog.default, {
      widget: this.forWidget,
      widgetKind: this.forWidgetKind,
      inRoomId: this.inRoomId,
      onFinished: async confirm => {
        if (!confirm) {
          return observer.update({
            state: _matrixWidgetApi.OpenIDRequestState.Blocked
          });
        }
        return observer.update({
          state: _matrixWidgetApi.OpenIDRequestState.Allowed,
          token: await getToken()
        });
      }
    });
  }
  async navigate(uri) {
    (0, _navigator.navigateToPermalink)(uri);
  }
  async *getTurnServers() {
    const client = _MatrixClientPeg.MatrixClientPeg.get();
    if (!client.pollingTurnServers || !client.getTurnServers().length) return;
    let setTurnServer;
    let setError;
    const onTurnServers = _ref6 => {
      let [server] = _ref6;
      return setTurnServer(normalizeTurnServer(server));
    };
    const onTurnServersError = (error, fatal) => {
      if (fatal) setError(error);
    };
    client.on(_client.ClientEvent.TurnServers, onTurnServers);
    client.on(_client.ClientEvent.TurnServersError, onTurnServersError);
    try {
      const initialTurnServer = client.getTurnServers()[0];
      yield normalizeTurnServer(initialTurnServer);

      // Repeatedly listen for new TURN servers until an error occurs or
      // the caller stops this generator
      while (true) {
        yield await new Promise((resolve, reject) => {
          setTurnServer = resolve;
          setError = reject;
        });
      }
    } finally {
      // The loop was broken - clean up
      client.off(_client.ClientEvent.TurnServers, onTurnServers);
      client.off(_client.ClientEvent.TurnServersError, onTurnServersError);
    }
  }
  async readEventRelations(eventId, roomId, relationType, eventType, from, to, limit, direction) {
    const client = _MatrixClientPeg.MatrixClientPeg.get();
    const dir = direction;
    roomId = roomId ?? _SDKContext.SdkContextClass.instance.roomViewStore.getRoomId() ?? undefined;
    if (typeof roomId !== "string") {
      throw new Error("Error while reading the current room");
    }
    const {
      events,
      nextBatch,
      prevBatch
    } = await client.relations(roomId, eventId, relationType ?? null, eventType ?? null, {
      from,
      to,
      limit,
      dir
    });
    return {
      chunk: events.map(e => e.getEffectiveEvent()),
      nextBatch: nextBatch ?? undefined,
      prevBatch: prevBatch ?? undefined
    };
  }
  async searchUserDirectory(searchTerm, limit) {
    const client = _MatrixClientPeg.MatrixClientPeg.get();
    const {
      limited,
      results
    } = await client.searchUserDirectory({
      term: searchTerm,
      limit
    });
    return {
      limited,
      results: results.map(r => ({
        userId: r.user_id,
        displayName: r.display_name,
        avatarUrl: r.avatar_url
      }))
    };
  }
}
exports.StopGapWidgetDriver = StopGapWidgetDriver;
//# sourceMappingURL=StopGapWidgetDriver.js.map