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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfbWF0cml4V2lkZ2V0QXBpIiwicmVxdWlyZSIsIl9jbGllbnQiLCJfZXZlbnQiLCJfbG9nZ2VyIiwiX3RocmVhZCIsIl9XaWRnZXRMaWZlY3ljbGUiLCJfU2RrQ29uZmlnIiwiX2ludGVyb3BSZXF1aXJlV2lsZGNhcmQiLCJfaXRlcmFibGVzIiwiX01hdHJpeENsaWVudFBlZyIsIl9Nb2RhbCIsIl9pbnRlcm9wUmVxdWlyZURlZmF1bHQiLCJfV2lkZ2V0T3BlbklEUGVybWlzc2lvbnNEaWFsb2ciLCJfV2lkZ2V0Q2FwYWJpbGl0aWVzUHJvbXB0RGlhbG9nIiwiX1dpZGdldFBlcm1pc3Npb25zIiwiX1dpZGdldFBlcm1pc3Npb25TdG9yZSIsIl9XaWRnZXRUeXBlIiwiX2VmZmVjdHMiLCJfdXRpbHMiLCJfZGlzcGF0Y2hlciIsIl9FbGVtZW50V2lkZ2V0Q2FwYWJpbGl0aWVzIiwiX25hdmlnYXRvciIsIl9TREtDb250ZXh0IiwiX01vZHVsZVJ1bm5lciIsIl9TZXR0aW5nc1N0b3JlIiwiX2dldFJlcXVpcmVXaWxkY2FyZENhY2hlIiwibm9kZUludGVyb3AiLCJXZWFrTWFwIiwiY2FjaGVCYWJlbEludGVyb3AiLCJjYWNoZU5vZGVJbnRlcm9wIiwib2JqIiwiX19lc01vZHVsZSIsImRlZmF1bHQiLCJjYWNoZSIsImhhcyIsImdldCIsIm5ld09iaiIsImhhc1Byb3BlcnR5RGVzY3JpcHRvciIsIk9iamVjdCIsImRlZmluZVByb3BlcnR5IiwiZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yIiwia2V5IiwicHJvdG90eXBlIiwiaGFzT3duUHJvcGVydHkiLCJjYWxsIiwiZGVzYyIsInNldCIsImdldFJlbWVtYmVyZWRDYXBhYmlsaXRpZXNGb3JXaWRnZXQiLCJ3aWRnZXQiLCJKU09OIiwicGFyc2UiLCJsb2NhbFN0b3JhZ2UiLCJnZXRJdGVtIiwiaWQiLCJzZXRSZW1lbWJlcmVkQ2FwYWJpbGl0aWVzRm9yV2lkZ2V0IiwiY2FwcyIsInNldEl0ZW0iLCJzdHJpbmdpZnkiLCJub3JtYWxpemVUdXJuU2VydmVyIiwiX3JlZiIsInVybHMiLCJ1c2VybmFtZSIsImNyZWRlbnRpYWwiLCJ1cmlzIiwicGFzc3dvcmQiLCJTdG9wR2FwV2lkZ2V0RHJpdmVyIiwiV2lkZ2V0RHJpdmVyIiwiY29uc3RydWN0b3IiLCJhbGxvd2VkQ2FwYWJpbGl0aWVzIiwiZm9yV2lkZ2V0IiwiZm9yV2lkZ2V0S2luZCIsInZpcnR1YWwiLCJpblJvb21JZCIsIl9kZWZpbmVQcm9wZXJ0eTIiLCJTZXQiLCJNYXRyaXhDYXBhYmlsaXRpZXMiLCJTY3JlZW5zaG90cyIsIkVsZW1lbnRXaWRnZXRDYXBhYmlsaXRpZXMiLCJSZXF1aXJlc0NsaWVudCIsIldpZGdldFR5cGUiLCJKSVRTSSIsIm1hdGNoZXMiLCJ0eXBlIiwiV2lkZ2V0S2luZCIsIlJvb20iLCJhZGQiLCJBbHdheXNPblNjcmVlbiIsIlNUSUNLRVJQSUNLRVIiLCJBY2NvdW50Iiwic3RpY2tlclNlbmRpbmdDYXAiLCJXaWRnZXRFdmVudENhcGFiaWxpdHkiLCJmb3JSb29tRXZlbnQiLCJFdmVudERpcmVjdGlvbiIsIlNlbmQiLCJFdmVudFR5cGUiLCJTdGlja2VyIiwicmF3IiwiU3RpY2tlclNlbmRpbmciLCJVUkwiLCJTZGtDb25maWciLCJ1cmwiLCJERUZBVUxUUyIsImVsZW1lbnRfY2FsbCIsIm9yaWdpbiIsIk1TQzM4NDZUdXJuU2VydmVycyIsIlJlY2VpdmUiLCJmb3JTdGF0ZUV2ZW50IiwiUm9vbU1lbWJlciIsIk1hdHJpeENsaWVudFBlZyIsImdldFVzZXJJZCIsInNlbmRSZWN2VG9EZXZpY2UiLCJDYWxsSW52aXRlIiwiQ2FsbENhbmRpZGF0ZXMiLCJDYWxsQW5zd2VyIiwiQ2FsbEhhbmd1cCIsIkNhbGxSZWplY3QiLCJDYWxsU2VsZWN0QW5zd2VyIiwiQ2FsbE5lZ290aWF0ZSIsIkNhbGxTRFBTdHJlYW1NZXRhZGF0YUNoYW5nZWQiLCJDYWxsU0RQU3RyZWFtTWV0YWRhdGFDaGFuZ2VkUHJlZml4IiwiQ2FsbFJlcGxhY2VzIiwiZXZlbnRUeXBlIiwiZm9yVG9EZXZpY2VFdmVudCIsInZhbGlkYXRlQ2FwYWJpbGl0aWVzIiwicmVxdWVzdGVkIiwiZGlmZiIsIml0ZXJhYmxlRGlmZiIsIm1pc3NpbmciLCJyZW1vdmVkIiwiYWxsb3dlZFNvRmFyIiwiZm9yRWFjaCIsImNhcCIsImRlbGV0ZSIsImFwcHJvdmVkIiwiV2lkZ2V0UGVybWlzc2lvbkN1c3RvbWlzYXRpb25zIiwicHJlYXBwcm92ZUNhcGFiaWxpdGllcyIsIm9wdHMiLCJhcHByb3ZlZENhcGFiaWxpdGllcyIsInVuZGVmaW5lZCIsIk1vZHVsZVJ1bm5lciIsImluc3RhbmNlIiwiaW52b2tlIiwiV2lkZ2V0TGlmZWN5Y2xlIiwiQ2FwYWJpbGl0aWVzUmVxdWVzdCIsInJlbWVtYmVyQXBwcm92ZWQiLCJzaXplIiwicmVzdWx0IiwiTW9kYWwiLCJjcmVhdGVEaWFsb2ciLCJXaWRnZXRDYXBhYmlsaXRpZXNQcm9tcHREaWFsb2ciLCJyZXF1ZXN0ZWRDYXBhYmlsaXRpZXMiLCJ3aWRnZXRLaW5kIiwiZmluaXNoZWQiLCJyZW1lbWJlciIsImUiLCJsb2dnZXIiLCJlcnJvciIsImFsbEFsbG93ZWQiLCJpdGVyYWJsZUludGVyc2VjdGlvbiIsIkFycmF5IiwiZnJvbSIsInNlbmRFdmVudCIsImNvbnRlbnQiLCJzdGF0ZUtleSIsInRhcmdldFJvb21JZCIsImNsaWVudCIsInJvb21JZCIsIlNka0NvbnRleHRDbGFzcyIsInJvb21WaWV3U3RvcmUiLCJnZXRSb29tSWQiLCJFcnJvciIsInIiLCJzZW5kU3RhdGVFdmVudCIsIlJvb21SZWRhY3Rpb24iLCJyZWRhY3RFdmVudCIsIlJvb21NZXNzYWdlIiwiQ0hBVF9FRkZFQ1RTIiwiZWZmZWN0IiwiY29udGFpbnNFbW9qaSIsImVtb2ppcyIsImlzTm90VGhyZWFkIiwicmVsX3R5cGUiLCJUSFJFQURfUkVMQVRJT05fVFlQRSIsIm5hbWUiLCJkaXMiLCJkaXNwYXRjaCIsImFjdGlvbiIsImNvbW1hbmQiLCJldmVudElkIiwiZXZlbnRfaWQiLCJzZW5kVG9EZXZpY2UiLCJlbmNyeXB0ZWQiLCJjb250ZW50TWFwIiwiZGV2aWNlSW5mb01hcCIsImNyeXB0byIsImRldmljZUxpc3QiLCJkb3dubG9hZEtleXMiLCJrZXlzIiwiUHJvbWlzZSIsImFsbCIsImVudHJpZXMiLCJmbGF0TWFwIiwiX3JlZjIiLCJ1c2VySWQiLCJ1c2VyQ29udGVudE1hcCIsIm1hcCIsIl9yZWYzIiwiZGV2aWNlSWQiLCJkZXZpY2VzIiwiZW5jcnlwdEFuZFNlbmRUb0RldmljZXMiLCJ2YWx1ZXMiLCJkZXZpY2VJbmZvIiwicXVldWVUb0RldmljZSIsImJhdGNoIiwiX3JlZjQiLCJfcmVmNSIsInBheWxvYWQiLCJwaWNrUm9vbXMiLCJyb29tSWRzIiwidGFyZ2V0Um9vbXMiLCJpbmNsdWRlcyIsIlN5bWJvbHMiLCJBbnlSb29tIiwiZ2V0VmlzaWJsZVJvb21zIiwiU2V0dGluZ3NTdG9yZSIsImdldFZhbHVlIiwiZ2V0Um9vbSIsImZpbHRlciIsInJlYWRSb29tRXZlbnRzIiwibXNndHlwZSIsImxpbWl0UGVyUm9vbSIsIk1hdGgiLCJtaW4iLCJOdW1iZXIiLCJNQVhfU0FGRV9JTlRFR0VSIiwicm9vbXMiLCJhbGxSZXN1bHRzIiwicm9vbSIsInJlc3VsdHMiLCJldmVudHMiLCJnZXRMaXZlVGltZWxpbmUiLCJnZXRFdmVudHMiLCJpIiwibGVuZ3RoIiwiZXYiLCJnZXRUeXBlIiwiaXNTdGF0ZSIsImdldENvbnRlbnQiLCJwdXNoIiwiZ2V0RWZmZWN0aXZlRXZlbnQiLCJyZWFkU3RhdGVFdmVudHMiLCJzdGF0ZSIsImN1cnJlbnRTdGF0ZSIsImZvcktleSIsInNsaWNlIiwiYXNrT3BlbklEIiwib2JzZXJ2ZXIiLCJJZGVudGl0eVJlcXVlc3QiLCJ1cGRhdGUiLCJPcGVuSURSZXF1ZXN0U3RhdGUiLCJBbGxvd2VkIiwidG9rZW4iLCJnZXRPcGVuSWRUb2tlbiIsIm9pZGNTdGF0ZSIsIndpZGdldFBlcm1pc3Npb25TdG9yZSIsImdldE9JRENTdGF0ZSIsImdldFRva2VuIiwiT0lEQ1N0YXRlIiwiRGVuaWVkIiwiQmxvY2tlZCIsIlBlbmRpbmdVc2VyQ29uZmlybWF0aW9uIiwiV2lkZ2V0T3BlbklEUGVybWlzc2lvbnNEaWFsb2ciLCJvbkZpbmlzaGVkIiwiY29uZmlybSIsIm5hdmlnYXRlIiwidXJpIiwibmF2aWdhdGVUb1Blcm1hbGluayIsImdldFR1cm5TZXJ2ZXJzIiwicG9sbGluZ1R1cm5TZXJ2ZXJzIiwic2V0VHVyblNlcnZlciIsInNldEVycm9yIiwib25UdXJuU2VydmVycyIsIl9yZWY2Iiwic2VydmVyIiwib25UdXJuU2VydmVyc0Vycm9yIiwiZmF0YWwiLCJvbiIsIkNsaWVudEV2ZW50IiwiVHVyblNlcnZlcnMiLCJUdXJuU2VydmVyc0Vycm9yIiwiaW5pdGlhbFR1cm5TZXJ2ZXIiLCJyZXNvbHZlIiwicmVqZWN0Iiwib2ZmIiwicmVhZEV2ZW50UmVsYXRpb25zIiwicmVsYXRpb25UeXBlIiwidG8iLCJsaW1pdCIsImRpcmVjdGlvbiIsImRpciIsIm5leHRCYXRjaCIsInByZXZCYXRjaCIsInJlbGF0aW9ucyIsImNodW5rIiwic2VhcmNoVXNlckRpcmVjdG9yeSIsInNlYXJjaFRlcm0iLCJsaW1pdGVkIiwidGVybSIsInVzZXJfaWQiLCJkaXNwbGF5TmFtZSIsImRpc3BsYXlfbmFtZSIsImF2YXRhclVybCIsImF2YXRhcl91cmwiLCJleHBvcnRzIl0sInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3N0b3Jlcy93aWRnZXRzL1N0b3BHYXBXaWRnZXREcml2ZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIENvcHlyaWdodCAyMDIwIC0gMjAyMyBUaGUgTWF0cml4Lm9yZyBGb3VuZGF0aW9uIEMuSS5DLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuaW1wb3J0IHtcbiAgICBDYXBhYmlsaXR5LFxuICAgIEV2ZW50RGlyZWN0aW9uLFxuICAgIElPcGVuSURDcmVkZW50aWFscyxcbiAgICBJT3BlbklEVXBkYXRlLFxuICAgIElTZW5kRXZlbnREZXRhaWxzLFxuICAgIElUdXJuU2VydmVyLFxuICAgIElSZWFkRXZlbnRSZWxhdGlvbnNSZXN1bHQsXG4gICAgSVJvb21FdmVudCxcbiAgICBNYXRyaXhDYXBhYmlsaXRpZXMsXG4gICAgT3BlbklEUmVxdWVzdFN0YXRlLFxuICAgIFNpbXBsZU9ic2VydmFibGUsXG4gICAgU3ltYm9scyxcbiAgICBXaWRnZXQsXG4gICAgV2lkZ2V0RHJpdmVyLFxuICAgIFdpZGdldEV2ZW50Q2FwYWJpbGl0eSxcbiAgICBXaWRnZXRLaW5kLFxuICAgIElTZWFyY2hVc2VyRGlyZWN0b3J5UmVzdWx0LFxufSBmcm9tIFwibWF0cml4LXdpZGdldC1hcGlcIjtcbmltcG9ydCB7IENsaWVudEV2ZW50LCBJVHVyblNlcnZlciBhcyBJQ2xpZW50VHVyblNlcnZlciB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9jbGllbnRcIjtcbmltcG9ydCB7IEV2ZW50VHlwZSB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9AdHlwZXMvZXZlbnRcIjtcbmltcG9ydCB7IElDb250ZW50LCBNYXRyaXhFdmVudCB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9tb2RlbHMvZXZlbnRcIjtcbmltcG9ydCB7IFJvb20gfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbW9kZWxzL3Jvb21cIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9sb2dnZXJcIjtcbmltcG9ydCB7IFRIUkVBRF9SRUxBVElPTl9UWVBFIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL21vZGVscy90aHJlYWRcIjtcbmltcG9ydCB7IERpcmVjdGlvbiB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9tYXRyaXhcIjtcbmltcG9ydCB7XG4gICAgQXBwcm92YWxPcHRzLFxuICAgIENhcGFiaWxpdGllc09wdHMsXG4gICAgV2lkZ2V0TGlmZWN5Y2xlLFxufSBmcm9tIFwiQG1hdHJpeC1vcmcvcmVhY3Qtc2RrLW1vZHVsZS1hcGkvbGliL2xpZmVjeWNsZXMvV2lkZ2V0TGlmZWN5Y2xlXCI7XG5cbmltcG9ydCBTZGtDb25maWcsIHsgREVGQVVMVFMgfSBmcm9tIFwiLi4vLi4vU2RrQ29uZmlnXCI7XG5pbXBvcnQgeyBpdGVyYWJsZURpZmYsIGl0ZXJhYmxlSW50ZXJzZWN0aW9uIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2l0ZXJhYmxlc1wiO1xuaW1wb3J0IHsgTWF0cml4Q2xpZW50UGVnIH0gZnJvbSBcIi4uLy4uL01hdHJpeENsaWVudFBlZ1wiO1xuaW1wb3J0IE1vZGFsIGZyb20gXCIuLi8uLi9Nb2RhbFwiO1xuaW1wb3J0IFdpZGdldE9wZW5JRFBlcm1pc3Npb25zRGlhbG9nIGZyb20gXCIuLi8uLi9jb21wb25lbnRzL3ZpZXdzL2RpYWxvZ3MvV2lkZ2V0T3BlbklEUGVybWlzc2lvbnNEaWFsb2dcIjtcbmltcG9ydCBXaWRnZXRDYXBhYmlsaXRpZXNQcm9tcHREaWFsb2cgZnJvbSBcIi4uLy4uL2NvbXBvbmVudHMvdmlld3MvZGlhbG9ncy9XaWRnZXRDYXBhYmlsaXRpZXNQcm9tcHREaWFsb2dcIjtcbmltcG9ydCB7IFdpZGdldFBlcm1pc3Npb25DdXN0b21pc2F0aW9ucyB9IGZyb20gXCIuLi8uLi9jdXN0b21pc2F0aW9ucy9XaWRnZXRQZXJtaXNzaW9uc1wiO1xuaW1wb3J0IHsgT0lEQ1N0YXRlIH0gZnJvbSBcIi4vV2lkZ2V0UGVybWlzc2lvblN0b3JlXCI7XG5pbXBvcnQgeyBXaWRnZXRUeXBlIH0gZnJvbSBcIi4uLy4uL3dpZGdldHMvV2lkZ2V0VHlwZVwiO1xuaW1wb3J0IHsgQ0hBVF9FRkZFQ1RTIH0gZnJvbSBcIi4uLy4uL2VmZmVjdHNcIjtcbmltcG9ydCB7IGNvbnRhaW5zRW1vamkgfSBmcm9tIFwiLi4vLi4vZWZmZWN0cy91dGlsc1wiO1xuaW1wb3J0IGRpcyBmcm9tIFwiLi4vLi4vZGlzcGF0Y2hlci9kaXNwYXRjaGVyXCI7XG5pbXBvcnQgeyBFbGVtZW50V2lkZ2V0Q2FwYWJpbGl0aWVzIH0gZnJvbSBcIi4vRWxlbWVudFdpZGdldENhcGFiaWxpdGllc1wiO1xuaW1wb3J0IHsgbmF2aWdhdGVUb1Blcm1hbGluayB9IGZyb20gXCIuLi8uLi91dGlscy9wZXJtYWxpbmtzL25hdmlnYXRvclwiO1xuaW1wb3J0IHsgU2RrQ29udGV4dENsYXNzIH0gZnJvbSBcIi4uLy4uL2NvbnRleHRzL1NES0NvbnRleHRcIjtcbmltcG9ydCB7IE1vZHVsZVJ1bm5lciB9IGZyb20gXCIuLi8uLi9tb2R1bGVzL01vZHVsZVJ1bm5lclwiO1xuaW1wb3J0IFNldHRpbmdzU3RvcmUgZnJvbSBcIi4uLy4uL3NldHRpbmdzL1NldHRpbmdzU3RvcmVcIjtcblxuLy8gVE9ETzogUHVyZ2UgdGhpcyBmcm9tIHRoZSB1bml2ZXJzZVxuXG5mdW5jdGlvbiBnZXRSZW1lbWJlcmVkQ2FwYWJpbGl0aWVzRm9yV2lkZ2V0KHdpZGdldDogV2lkZ2V0KTogQ2FwYWJpbGl0eVtdIHtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbShgd2lkZ2V0XyR7d2lkZ2V0LmlkfV9hcHByb3ZlZF9jYXBzYCkgfHwgXCJbXVwiKTtcbn1cblxuZnVuY3Rpb24gc2V0UmVtZW1iZXJlZENhcGFiaWxpdGllc0ZvcldpZGdldCh3aWRnZXQ6IFdpZGdldCwgY2FwczogQ2FwYWJpbGl0eVtdKTogdm9pZCB7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oYHdpZGdldF8ke3dpZGdldC5pZH1fYXBwcm92ZWRfY2Fwc2AsIEpTT04uc3RyaW5naWZ5KGNhcHMpKTtcbn1cblxuY29uc3Qgbm9ybWFsaXplVHVyblNlcnZlciA9ICh7IHVybHMsIHVzZXJuYW1lLCBjcmVkZW50aWFsIH06IElDbGllbnRUdXJuU2VydmVyKTogSVR1cm5TZXJ2ZXIgPT4gKHtcbiAgICB1cmlzOiB1cmxzLFxuICAgIHVzZXJuYW1lLFxuICAgIHBhc3N3b3JkOiBjcmVkZW50aWFsLFxufSk7XG5cbmV4cG9ydCBjbGFzcyBTdG9wR2FwV2lkZ2V0RHJpdmVyIGV4dGVuZHMgV2lkZ2V0RHJpdmVyIHtcbiAgICBwcml2YXRlIGFsbG93ZWRDYXBhYmlsaXRpZXM6IFNldDxDYXBhYmlsaXR5PjtcblxuICAgIC8vIFRPRE86IFJlZmFjdG9yIHdpZGdldEtpbmQgaW50byB0aGUgV2lkZ2V0IGNsYXNzXG4gICAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgICAgICBhbGxvd2VkQ2FwYWJpbGl0aWVzOiBDYXBhYmlsaXR5W10sXG4gICAgICAgIHByaXZhdGUgZm9yV2lkZ2V0OiBXaWRnZXQsXG4gICAgICAgIHByaXZhdGUgZm9yV2lkZ2V0S2luZDogV2lkZ2V0S2luZCxcbiAgICAgICAgdmlydHVhbDogYm9vbGVhbixcbiAgICAgICAgcHJpdmF0ZSBpblJvb21JZD86IHN0cmluZyxcbiAgICApIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICAvLyBBbHdheXMgYWxsb3cgc2NyZWVuc2hvdHMgdG8gYmUgdGFrZW4gYmVjYXVzZSBpdCdzIGEgY2xpZW50LWluZHVjZWQgZmxvdy4gVGhlIHdpZGdldCBjYW4ndFxuICAgICAgICAvLyBzcGV3IHNjcmVlbnNob3RzIGF0IHVzIGFuZCBjYW4ndCByZXF1ZXN0IHNjcmVlbnNob3RzIG9mIHVzLCBzbyBpdCdzIHVwIHRvIHVzIHRvIHByb3ZpZGUgdGhlXG4gICAgICAgIC8vIGJ1dHRvbiBpZiB0aGUgd2lkZ2V0IHNheXMgaXQgc3VwcG9ydHMgc2NyZWVuc2hvdHMuXG4gICAgICAgIHRoaXMuYWxsb3dlZENhcGFiaWxpdGllcyA9IG5ldyBTZXQoW1xuICAgICAgICAgICAgLi4uYWxsb3dlZENhcGFiaWxpdGllcyxcbiAgICAgICAgICAgIE1hdHJpeENhcGFiaWxpdGllcy5TY3JlZW5zaG90cyxcbiAgICAgICAgICAgIEVsZW1lbnRXaWRnZXRDYXBhYmlsaXRpZXMuUmVxdWlyZXNDbGllbnQsXG4gICAgICAgIF0pO1xuXG4gICAgICAgIC8vIEdyYW50IHRoZSBwZXJtaXNzaW9ucyB0aGF0IGFyZSBzcGVjaWZpYyB0byBnaXZlbiB3aWRnZXQgdHlwZXNcbiAgICAgICAgaWYgKFdpZGdldFR5cGUuSklUU0kubWF0Y2hlcyh0aGlzLmZvcldpZGdldC50eXBlKSAmJiBmb3JXaWRnZXRLaW5kID09PSBXaWRnZXRLaW5kLlJvb20pIHtcbiAgICAgICAgICAgIHRoaXMuYWxsb3dlZENhcGFiaWxpdGllcy5hZGQoTWF0cml4Q2FwYWJpbGl0aWVzLkFsd2F5c09uU2NyZWVuKTtcbiAgICAgICAgfSBlbHNlIGlmIChXaWRnZXRUeXBlLlNUSUNLRVJQSUNLRVIubWF0Y2hlcyh0aGlzLmZvcldpZGdldC50eXBlKSAmJiBmb3JXaWRnZXRLaW5kID09PSBXaWRnZXRLaW5kLkFjY291bnQpIHtcbiAgICAgICAgICAgIGNvbnN0IHN0aWNrZXJTZW5kaW5nQ2FwID0gV2lkZ2V0RXZlbnRDYXBhYmlsaXR5LmZvclJvb21FdmVudChFdmVudERpcmVjdGlvbi5TZW5kLCBFdmVudFR5cGUuU3RpY2tlcikucmF3O1xuICAgICAgICAgICAgdGhpcy5hbGxvd2VkQ2FwYWJpbGl0aWVzLmFkZChNYXRyaXhDYXBhYmlsaXRpZXMuU3RpY2tlclNlbmRpbmcpOyAvLyBsZWdhY3kgYXMgZmFyIGFzIE1TQzI3NjIgaXMgY29uY2VybmVkXG4gICAgICAgICAgICB0aGlzLmFsbG93ZWRDYXBhYmlsaXRpZXMuYWRkKHN0aWNrZXJTZW5kaW5nQ2FwKTtcblxuICAgICAgICAgICAgLy8gQXV0by1hcHByb3ZlIHRoZSBsZWdhY3kgdmlzaWJpbGl0eSBjYXBhYmlsaXR5LiBXZSBzZW5kIGl0IHJlZ2FyZGxlc3Mgb2YgY2FwYWJpbGl0eS5cbiAgICAgICAgICAgIC8vIFdpZGdldHMgZG9uJ3QgdGVjaG5pY2FsbHkgbmVlZCB0byByZXF1ZXN0IHRoaXMgY2FwYWJpbGl0eSwgYnV0IFNjYWxhciBzdGlsbCBkb2VzLlxuICAgICAgICAgICAgdGhpcy5hbGxvd2VkQ2FwYWJpbGl0aWVzLmFkZChcInZpc2liaWxpdHlcIik7XG4gICAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgICAgICB2aXJ0dWFsICYmXG4gICAgICAgICAgICBuZXcgVVJMKFNka0NvbmZpZy5nZXQoXCJlbGVtZW50X2NhbGxcIikudXJsID8/IERFRkFVTFRTLmVsZW1lbnRfY2FsbC51cmwhKS5vcmlnaW4gPT09IHRoaXMuZm9yV2lkZ2V0Lm9yaWdpblxuICAgICAgICApIHtcbiAgICAgICAgICAgIC8vIFRoaXMgaXMgYSB0cnVzdGVkIEVsZW1lbnQgQ2FsbCB3aWRnZXQgdGhhdCB3ZSBjb250cm9sXG4gICAgICAgICAgICB0aGlzLmFsbG93ZWRDYXBhYmlsaXRpZXMuYWRkKE1hdHJpeENhcGFiaWxpdGllcy5BbHdheXNPblNjcmVlbik7XG4gICAgICAgICAgICB0aGlzLmFsbG93ZWRDYXBhYmlsaXRpZXMuYWRkKE1hdHJpeENhcGFiaWxpdGllcy5NU0MzODQ2VHVyblNlcnZlcnMpO1xuICAgICAgICAgICAgdGhpcy5hbGxvd2VkQ2FwYWJpbGl0aWVzLmFkZChgb3JnLm1hdHJpeC5tc2MyNzYyLnRpbWVsaW5lOiR7aW5Sb29tSWR9YCk7XG5cbiAgICAgICAgICAgIHRoaXMuYWxsb3dlZENhcGFiaWxpdGllcy5hZGQoXG4gICAgICAgICAgICAgICAgV2lkZ2V0RXZlbnRDYXBhYmlsaXR5LmZvclJvb21FdmVudChFdmVudERpcmVjdGlvbi5TZW5kLCBcIm9yZy5tYXRyaXgucmFnZXNoYWtlX3JlcXVlc3RcIikucmF3LFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHRoaXMuYWxsb3dlZENhcGFiaWxpdGllcy5hZGQoXG4gICAgICAgICAgICAgICAgV2lkZ2V0RXZlbnRDYXBhYmlsaXR5LmZvclJvb21FdmVudChFdmVudERpcmVjdGlvbi5SZWNlaXZlLCBcIm9yZy5tYXRyaXgucmFnZXNoYWtlX3JlcXVlc3RcIikucmF3LFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHRoaXMuYWxsb3dlZENhcGFiaWxpdGllcy5hZGQoXG4gICAgICAgICAgICAgICAgV2lkZ2V0RXZlbnRDYXBhYmlsaXR5LmZvclN0YXRlRXZlbnQoRXZlbnREaXJlY3Rpb24uUmVjZWl2ZSwgRXZlbnRUeXBlLlJvb21NZW1iZXIpLnJhdyxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICB0aGlzLmFsbG93ZWRDYXBhYmlsaXRpZXMuYWRkKFxuICAgICAgICAgICAgICAgIFdpZGdldEV2ZW50Q2FwYWJpbGl0eS5mb3JTdGF0ZUV2ZW50KEV2ZW50RGlyZWN0aW9uLlJlY2VpdmUsIFwib3JnLm1hdHJpeC5tc2MzNDAxLmNhbGxcIikucmF3LFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHRoaXMuYWxsb3dlZENhcGFiaWxpdGllcy5hZGQoXG4gICAgICAgICAgICAgICAgV2lkZ2V0RXZlbnRDYXBhYmlsaXR5LmZvclN0YXRlRXZlbnQoXG4gICAgICAgICAgICAgICAgICAgIEV2ZW50RGlyZWN0aW9uLlNlbmQsXG4gICAgICAgICAgICAgICAgICAgIFwib3JnLm1hdHJpeC5tc2MzNDAxLmNhbGwubWVtYmVyXCIsXG4gICAgICAgICAgICAgICAgICAgIE1hdHJpeENsaWVudFBlZy5nZXQoKS5nZXRVc2VySWQoKSEsXG4gICAgICAgICAgICAgICAgKS5yYXcsXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgdGhpcy5hbGxvd2VkQ2FwYWJpbGl0aWVzLmFkZChcbiAgICAgICAgICAgICAgICBXaWRnZXRFdmVudENhcGFiaWxpdHkuZm9yU3RhdGVFdmVudChFdmVudERpcmVjdGlvbi5SZWNlaXZlLCBcIm9yZy5tYXRyaXgubXNjMzQwMS5jYWxsLm1lbWJlclwiKS5yYXcsXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBjb25zdCBzZW5kUmVjdlRvRGV2aWNlID0gW1xuICAgICAgICAgICAgICAgIEV2ZW50VHlwZS5DYWxsSW52aXRlLFxuICAgICAgICAgICAgICAgIEV2ZW50VHlwZS5DYWxsQ2FuZGlkYXRlcyxcbiAgICAgICAgICAgICAgICBFdmVudFR5cGUuQ2FsbEFuc3dlcixcbiAgICAgICAgICAgICAgICBFdmVudFR5cGUuQ2FsbEhhbmd1cCxcbiAgICAgICAgICAgICAgICBFdmVudFR5cGUuQ2FsbFJlamVjdCxcbiAgICAgICAgICAgICAgICBFdmVudFR5cGUuQ2FsbFNlbGVjdEFuc3dlcixcbiAgICAgICAgICAgICAgICBFdmVudFR5cGUuQ2FsbE5lZ290aWF0ZSxcbiAgICAgICAgICAgICAgICBFdmVudFR5cGUuQ2FsbFNEUFN0cmVhbU1ldGFkYXRhQ2hhbmdlZCxcbiAgICAgICAgICAgICAgICBFdmVudFR5cGUuQ2FsbFNEUFN0cmVhbU1ldGFkYXRhQ2hhbmdlZFByZWZpeCxcbiAgICAgICAgICAgICAgICBFdmVudFR5cGUuQ2FsbFJlcGxhY2VzLFxuICAgICAgICAgICAgXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZXZlbnRUeXBlIG9mIHNlbmRSZWN2VG9EZXZpY2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFsbG93ZWRDYXBhYmlsaXRpZXMuYWRkKFxuICAgICAgICAgICAgICAgICAgICBXaWRnZXRFdmVudENhcGFiaWxpdHkuZm9yVG9EZXZpY2VFdmVudChFdmVudERpcmVjdGlvbi5TZW5kLCBldmVudFR5cGUpLnJhdyxcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIHRoaXMuYWxsb3dlZENhcGFiaWxpdGllcy5hZGQoXG4gICAgICAgICAgICAgICAgICAgIFdpZGdldEV2ZW50Q2FwYWJpbGl0eS5mb3JUb0RldmljZUV2ZW50KEV2ZW50RGlyZWN0aW9uLlJlY2VpdmUsIGV2ZW50VHlwZSkucmF3LFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgdmFsaWRhdGVDYXBhYmlsaXRpZXMocmVxdWVzdGVkOiBTZXQ8Q2FwYWJpbGl0eT4pOiBQcm9taXNlPFNldDxDYXBhYmlsaXR5Pj4ge1xuICAgICAgICAvLyBDaGVjayB0byBzZWUgaWYgYW55IGNhcGFiaWxpdGllcyBhcmVuJ3QgYXV0b21hdGljYWxseSBhY2NlcHRlZCAoc3VjaCBhcyBzdGlja2VyIHBpY2tlcnNcbiAgICAgICAgLy8gYWxsb3dpbmcgc3RpY2tlcnMgdG8gYmUgc2VudCkuIElmIHRoZXJlIGFyZSBleGNlc3MgY2FwYWJpbGl0aWVzIHRvIGJlIGFwcHJvdmVkLCB0aGUgdXNlclxuICAgICAgICAvLyB3aWxsIGJlIHByb21wdGVkIHRvIGFjY2VwdCB0aGVtLlxuICAgICAgICBjb25zdCBkaWZmID0gaXRlcmFibGVEaWZmKHJlcXVlc3RlZCwgdGhpcy5hbGxvd2VkQ2FwYWJpbGl0aWVzKTtcbiAgICAgICAgY29uc3QgbWlzc2luZyA9IG5ldyBTZXQoZGlmZi5yZW1vdmVkKTsgLy8gXCJyZW1vdmVkXCIgaXMgXCJpbiBBIChyZXF1ZXN0ZWQpIGJ1dCBub3QgaW4gQiAoYWxsb3dlZClcIlxuICAgICAgICBjb25zdCBhbGxvd2VkU29GYXIgPSBuZXcgU2V0KHRoaXMuYWxsb3dlZENhcGFiaWxpdGllcyk7XG4gICAgICAgIGdldFJlbWVtYmVyZWRDYXBhYmlsaXRpZXNGb3JXaWRnZXQodGhpcy5mb3JXaWRnZXQpLmZvckVhY2goKGNhcCkgPT4ge1xuICAgICAgICAgICAgYWxsb3dlZFNvRmFyLmFkZChjYXApO1xuICAgICAgICAgICAgbWlzc2luZy5kZWxldGUoY2FwKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbGV0IGFwcHJvdmVkOiBTZXQ8c3RyaW5nPiB8IHVuZGVmaW5lZDtcbiAgICAgICAgaWYgKFdpZGdldFBlcm1pc3Npb25DdXN0b21pc2F0aW9ucy5wcmVhcHByb3ZlQ2FwYWJpbGl0aWVzKSB7XG4gICAgICAgICAgICBhcHByb3ZlZCA9IGF3YWl0IFdpZGdldFBlcm1pc3Npb25DdXN0b21pc2F0aW9ucy5wcmVhcHByb3ZlQ2FwYWJpbGl0aWVzKHRoaXMuZm9yV2lkZ2V0LCByZXF1ZXN0ZWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgb3B0czogQ2FwYWJpbGl0aWVzT3B0cyA9IHsgYXBwcm92ZWRDYXBhYmlsaXRpZXM6IHVuZGVmaW5lZCB9O1xuICAgICAgICAgICAgTW9kdWxlUnVubmVyLmluc3RhbmNlLmludm9rZShXaWRnZXRMaWZlY3ljbGUuQ2FwYWJpbGl0aWVzUmVxdWVzdCwgb3B0cywgdGhpcy5mb3JXaWRnZXQsIHJlcXVlc3RlZCk7XG4gICAgICAgICAgICBhcHByb3ZlZCA9IG9wdHMuYXBwcm92ZWRDYXBhYmlsaXRpZXM7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGFwcHJvdmVkKSB7XG4gICAgICAgICAgICBhcHByb3ZlZC5mb3JFYWNoKChjYXApID0+IHtcbiAgICAgICAgICAgICAgICBhbGxvd2VkU29GYXIuYWRkKGNhcCk7XG4gICAgICAgICAgICAgICAgbWlzc2luZy5kZWxldGUoY2FwKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVE9ETzogRG8gc29tZXRoaW5nIHdoZW4gdGhlIHdpZGdldCByZXF1ZXN0cyBuZXcgY2FwYWJpbGl0aWVzIG5vdCB5ZXQgYXNrZWQgZm9yXG4gICAgICAgIGxldCByZW1lbWJlckFwcHJvdmVkID0gZmFsc2U7XG4gICAgICAgIGlmIChtaXNzaW5nLnNpemUgPiAwKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IFtyZXN1bHRdID0gYXdhaXQgTW9kYWwuY3JlYXRlRGlhbG9nKFdpZGdldENhcGFiaWxpdGllc1Byb21wdERpYWxvZywge1xuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0ZWRDYXBhYmlsaXRpZXM6IG1pc3NpbmcsXG4gICAgICAgICAgICAgICAgICAgIHdpZGdldDogdGhpcy5mb3JXaWRnZXQsXG4gICAgICAgICAgICAgICAgICAgIHdpZGdldEtpbmQ6IHRoaXMuZm9yV2lkZ2V0S2luZCxcbiAgICAgICAgICAgICAgICB9KS5maW5pc2hlZDtcbiAgICAgICAgICAgICAgICByZXN1bHQ/LmFwcHJvdmVkPy5mb3JFYWNoKChjYXApID0+IGFsbG93ZWRTb0Zhci5hZGQoY2FwKSk7XG4gICAgICAgICAgICAgICAgcmVtZW1iZXJBcHByb3ZlZCA9ICEhcmVzdWx0Py5yZW1lbWJlcjtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICBsb2dnZXIuZXJyb3IoXCJOb24tZmF0YWwgZXJyb3IgZ2V0dGluZyBjYXBhYmlsaXRpZXM6IFwiLCBlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRpc2NhcmQgYWxsIHByZXZpb3VzbHkgYWxsb3dlZCBjYXBhYmlsaXRpZXMgaWYgdGhleSBhcmUgbm90IHJlcXVlc3RlZFxuICAgICAgICAvLyBUT0RPOiB0aGlzIHJlc3VsdHMgaW4gYW4gdW5leHBlY3RlZCBiZWhhdmlvciB3aGVuIHRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIGR1cmluZyB0aGUgY2FwYWJpbGl0aWVzIHJlbmVnb3RpYXRpb24gb2YgTVNDMjk3NCB0aGF0IHdpbGwgYmUgcmVzb2x2ZWQgbGF0ZXIuXG4gICAgICAgIGNvbnN0IGFsbEFsbG93ZWQgPSBuZXcgU2V0KGl0ZXJhYmxlSW50ZXJzZWN0aW9uKGFsbG93ZWRTb0ZhciwgcmVxdWVzdGVkKSk7XG5cbiAgICAgICAgaWYgKHJlbWVtYmVyQXBwcm92ZWQpIHtcbiAgICAgICAgICAgIHNldFJlbWVtYmVyZWRDYXBhYmlsaXRpZXNGb3JXaWRnZXQodGhpcy5mb3JXaWRnZXQsIEFycmF5LmZyb20oYWxsQWxsb3dlZCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGFsbEFsbG93ZWQ7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHNlbmRFdmVudChcbiAgICAgICAgZXZlbnRUeXBlOiBzdHJpbmcsXG4gICAgICAgIGNvbnRlbnQ6IElDb250ZW50LFxuICAgICAgICBzdGF0ZUtleT86IHN0cmluZyB8IG51bGwsXG4gICAgICAgIHRhcmdldFJvb21JZD86IHN0cmluZyxcbiAgICApOiBQcm9taXNlPElTZW5kRXZlbnREZXRhaWxzPiB7XG4gICAgICAgIGNvbnN0IGNsaWVudCA9IE1hdHJpeENsaWVudFBlZy5nZXQoKTtcbiAgICAgICAgY29uc3Qgcm9vbUlkID0gdGFyZ2V0Um9vbUlkIHx8IFNka0NvbnRleHRDbGFzcy5pbnN0YW5jZS5yb29tVmlld1N0b3JlLmdldFJvb21JZCgpO1xuXG4gICAgICAgIGlmICghY2xpZW50IHx8ICFyb29tSWQpIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbiBhIHJvb20gb3Igbm90IGF0dGFjaGVkIHRvIGEgY2xpZW50XCIpO1xuXG4gICAgICAgIGxldCByOiB7IGV2ZW50X2lkOiBzdHJpbmcgfSB8IG51bGwgPSBudWxsOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIGNhbWVsY2FzZVxuICAgICAgICBpZiAoc3RhdGVLZXkgIT09IG51bGwpIHtcbiAgICAgICAgICAgIC8vIHN0YXRlIGV2ZW50XG4gICAgICAgICAgICByID0gYXdhaXQgY2xpZW50LnNlbmRTdGF0ZUV2ZW50KHJvb21JZCwgZXZlbnRUeXBlLCBjb250ZW50LCBzdGF0ZUtleSk7XG4gICAgICAgIH0gZWxzZSBpZiAoZXZlbnRUeXBlID09PSBFdmVudFR5cGUuUm9vbVJlZGFjdGlvbikge1xuICAgICAgICAgICAgLy8gc3BlY2lhbCBjYXNlOiBleHRyYWN0IHRoZSBgcmVkYWN0c2AgcHJvcGVydHkgYW5kIGNhbGwgcmVkYWN0XG4gICAgICAgICAgICByID0gYXdhaXQgY2xpZW50LnJlZGFjdEV2ZW50KHJvb21JZCwgY29udGVudFtcInJlZGFjdHNcIl0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gbWVzc2FnZSBldmVudFxuICAgICAgICAgICAgciA9IGF3YWl0IGNsaWVudC5zZW5kRXZlbnQocm9vbUlkLCBldmVudFR5cGUsIGNvbnRlbnQpO1xuXG4gICAgICAgICAgICBpZiAoZXZlbnRUeXBlID09PSBFdmVudFR5cGUuUm9vbU1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICBDSEFUX0VGRkVDVFMuZm9yRWFjaCgoZWZmZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjb250YWluc0Vtb2ppKGNvbnRlbnQsIGVmZmVjdC5lbW9qaXMpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBGb3IgaW5pdGlhbCB0aHJlYWRzIGxhdW5jaCwgY2hhdCBlZmZlY3RzIGFyZSBkaXNhYmxlZFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2VlICMxOTczMVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNOb3RUaHJlYWQgPSBjb250ZW50W1wibS5yZWxhdGVzX3RvXCJdPy5yZWxfdHlwZSAhPT0gVEhSRUFEX1JFTEFUSU9OX1RZUEUubmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc05vdFRocmVhZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpcy5kaXNwYXRjaCh7IGFjdGlvbjogYGVmZmVjdHMuJHtlZmZlY3QuY29tbWFuZH1gIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4geyByb29tSWQsIGV2ZW50SWQ6IHIuZXZlbnRfaWQgfTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgc2VuZFRvRGV2aWNlKFxuICAgICAgICBldmVudFR5cGU6IHN0cmluZyxcbiAgICAgICAgZW5jcnlwdGVkOiBib29sZWFuLFxuICAgICAgICBjb250ZW50TWFwOiB7IFt1c2VySWQ6IHN0cmluZ106IHsgW2RldmljZUlkOiBzdHJpbmddOiBvYmplY3QgfSB9LFxuICAgICk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCBjbGllbnQgPSBNYXRyaXhDbGllbnRQZWcuZ2V0KCk7XG5cbiAgICAgICAgaWYgKGVuY3J5cHRlZCkge1xuICAgICAgICAgICAgY29uc3QgZGV2aWNlSW5mb01hcCA9IGF3YWl0IGNsaWVudC5jcnlwdG8hLmRldmljZUxpc3QuZG93bmxvYWRLZXlzKE9iamVjdC5rZXlzKGNvbnRlbnRNYXApLCBmYWxzZSk7XG5cbiAgICAgICAgICAgIGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgICAgICAgICAgIE9iamVjdC5lbnRyaWVzKGNvbnRlbnRNYXApLmZsYXRNYXAoKFt1c2VySWQsIHVzZXJDb250ZW50TWFwXSkgPT5cbiAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmVudHJpZXModXNlckNvbnRlbnRNYXApLm1hcChhc3luYyAoW2RldmljZUlkLCBjb250ZW50XSk6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGV2aWNlcyA9IGRldmljZUluZm9NYXAuZ2V0KHVzZXJJZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWRldmljZXMpIHJldHVybjtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRldmljZUlkID09PSBcIipcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFNlbmQgdGhlIG1lc3NhZ2UgdG8gYWxsIGRldmljZXMgd2UgaGF2ZSBrZXlzIGZvclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGNsaWVudC5lbmNyeXB0QW5kU2VuZFRvRGV2aWNlcyhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQXJyYXkuZnJvbShkZXZpY2VzLnZhbHVlcygpKS5tYXAoKGRldmljZUluZm8pID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1c2VySWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2VJbmZvLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZGV2aWNlcy5oYXMoZGV2aWNlSWQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gU2VuZCB0aGUgbWVzc2FnZSB0byBhIHNwZWNpZmljIGRldmljZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGNsaWVudC5lbmNyeXB0QW5kU2VuZFRvRGV2aWNlcyhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgW3sgdXNlcklkLCBkZXZpY2VJbmZvOiBkZXZpY2VzLmdldChkZXZpY2VJZCkhIH1dLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250ZW50LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXdhaXQgY2xpZW50LnF1ZXVlVG9EZXZpY2Uoe1xuICAgICAgICAgICAgICAgIGV2ZW50VHlwZSxcbiAgICAgICAgICAgICAgICBiYXRjaDogT2JqZWN0LmVudHJpZXMoY29udGVudE1hcCkuZmxhdE1hcCgoW3VzZXJJZCwgdXNlckNvbnRlbnRNYXBdKSA9PlxuICAgICAgICAgICAgICAgICAgICBPYmplY3QuZW50cmllcyh1c2VyQ29udGVudE1hcCkubWFwKChbZGV2aWNlSWQsIGNvbnRlbnRdKSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgdXNlcklkLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXlsb2FkOiBjb250ZW50LFxuICAgICAgICAgICAgICAgICAgICB9KSksXG4gICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBwaWNrUm9vbXMocm9vbUlkcz86IChzdHJpbmcgfCBTeW1ib2xzLkFueVJvb20pW10pOiBSb29tW10ge1xuICAgICAgICBjb25zdCBjbGllbnQgPSBNYXRyaXhDbGllbnRQZWcuZ2V0KCk7XG4gICAgICAgIGlmICghY2xpZW50KSB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgYXR0YWNoZWQgdG8gYSBjbGllbnRcIik7XG5cbiAgICAgICAgY29uc3QgdGFyZ2V0Um9vbXMgPSByb29tSWRzXG4gICAgICAgICAgICA/IHJvb21JZHMuaW5jbHVkZXMoU3ltYm9scy5BbnlSb29tKVxuICAgICAgICAgICAgICAgID8gY2xpZW50LmdldFZpc2libGVSb29tcyhTZXR0aW5nc1N0b3JlLmdldFZhbHVlKFwiZmVhdHVyZV9keW5hbWljX3Jvb21fcHJlZGVjZXNzb3JzXCIpKVxuICAgICAgICAgICAgICAgIDogcm9vbUlkcy5tYXAoKHIpID0+IGNsaWVudC5nZXRSb29tKHIpKVxuICAgICAgICAgICAgOiBbY2xpZW50LmdldFJvb20oU2RrQ29udGV4dENsYXNzLmluc3RhbmNlLnJvb21WaWV3U3RvcmUuZ2V0Um9vbUlkKCkhKV07XG4gICAgICAgIHJldHVybiB0YXJnZXRSb29tcy5maWx0ZXIoKHIpID0+ICEhcikgYXMgUm9vbVtdO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyByZWFkUm9vbUV2ZW50cyhcbiAgICAgICAgZXZlbnRUeXBlOiBzdHJpbmcsXG4gICAgICAgIG1zZ3R5cGU6IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgICAgICAgbGltaXRQZXJSb29tOiBudW1iZXIsXG4gICAgICAgIHJvb21JZHM/OiAoc3RyaW5nIHwgU3ltYm9scy5BbnlSb29tKVtdLFxuICAgICk6IFByb21pc2U8SVJvb21FdmVudFtdPiB7XG4gICAgICAgIGxpbWl0UGVyUm9vbSA9IGxpbWl0UGVyUm9vbSA+IDAgPyBNYXRoLm1pbihsaW1pdFBlclJvb20sIE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKSA6IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSOyAvLyByZWxhdGl2ZWx5IGFyYml0cmFyeVxuXG4gICAgICAgIGNvbnN0IHJvb21zID0gdGhpcy5waWNrUm9vbXMocm9vbUlkcyk7XG4gICAgICAgIGNvbnN0IGFsbFJlc3VsdHM6IElSb29tRXZlbnRbXSA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IHJvb20gb2Ygcm9vbXMpIHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdHM6IE1hdHJpeEV2ZW50W10gPSBbXTtcbiAgICAgICAgICAgIGNvbnN0IGV2ZW50cyA9IHJvb20uZ2V0TGl2ZVRpbWVsaW5lKCkuZ2V0RXZlbnRzKCk7IC8vIHRpbWVsaW5lcyBhcmUgbW9zdCByZWNlbnQgbGFzdFxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IGV2ZW50cy5sZW5ndGggLSAxOyBpID4gMDsgaS0tKSB7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdHMubGVuZ3RoID49IGxpbWl0UGVyUm9vbSkgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBldiA9IGV2ZW50c1tpXTtcbiAgICAgICAgICAgICAgICBpZiAoZXYuZ2V0VHlwZSgpICE9PSBldmVudFR5cGUgfHwgZXYuaXNTdGF0ZSgpKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBpZiAoZXZlbnRUeXBlID09PSBFdmVudFR5cGUuUm9vbU1lc3NhZ2UgJiYgbXNndHlwZSAmJiBtc2d0eXBlICE9PSBldi5nZXRDb250ZW50KClbXCJtc2d0eXBlXCJdKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goZXYpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXN1bHRzLmZvckVhY2goKGUpID0+IGFsbFJlc3VsdHMucHVzaChlLmdldEVmZmVjdGl2ZUV2ZW50KCkgYXMgSVJvb21FdmVudCkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhbGxSZXN1bHRzO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyByZWFkU3RhdGVFdmVudHMoXG4gICAgICAgIGV2ZW50VHlwZTogc3RyaW5nLFxuICAgICAgICBzdGF0ZUtleTogc3RyaW5nIHwgdW5kZWZpbmVkLFxuICAgICAgICBsaW1pdFBlclJvb206IG51bWJlcixcbiAgICAgICAgcm9vbUlkcz86IChzdHJpbmcgfCBTeW1ib2xzLkFueVJvb20pW10sXG4gICAgKTogUHJvbWlzZTxJUm9vbUV2ZW50W10+IHtcbiAgICAgICAgbGltaXRQZXJSb29tID0gbGltaXRQZXJSb29tID4gMCA/IE1hdGgubWluKGxpbWl0UGVyUm9vbSwgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpIDogTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVI7IC8vIHJlbGF0aXZlbHkgYXJiaXRyYXJ5XG5cbiAgICAgICAgY29uc3Qgcm9vbXMgPSB0aGlzLnBpY2tSb29tcyhyb29tSWRzKTtcbiAgICAgICAgY29uc3QgYWxsUmVzdWx0czogSVJvb21FdmVudFtdID0gW107XG4gICAgICAgIGZvciAoY29uc3Qgcm9vbSBvZiByb29tcykge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0czogTWF0cml4RXZlbnRbXSA9IFtdO1xuICAgICAgICAgICAgY29uc3Qgc3RhdGUgPSByb29tLmN1cnJlbnRTdGF0ZS5ldmVudHMuZ2V0KGV2ZW50VHlwZSk7XG4gICAgICAgICAgICBpZiAoc3RhdGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoc3RhdGVLZXkgPT09IFwiXCIgfHwgISFzdGF0ZUtleSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmb3JLZXkgPSBzdGF0ZS5nZXQoc3RhdGVLZXkpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZm9yS2V5KSByZXN1bHRzLnB1c2goZm9yS2V5KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goLi4uQXJyYXkuZnJvbShzdGF0ZS52YWx1ZXMoKSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmVzdWx0cy5zbGljZSgwLCBsaW1pdFBlclJvb20pLmZvckVhY2goKGUpID0+IGFsbFJlc3VsdHMucHVzaChlLmdldEVmZmVjdGl2ZUV2ZW50KCkgYXMgSVJvb21FdmVudCkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhbGxSZXN1bHRzO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBhc2tPcGVuSUQob2JzZXJ2ZXI6IFNpbXBsZU9ic2VydmFibGU8SU9wZW5JRFVwZGF0ZT4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgY29uc3Qgb3B0czogQXBwcm92YWxPcHRzID0geyBhcHByb3ZlZDogdW5kZWZpbmVkIH07XG4gICAgICAgIE1vZHVsZVJ1bm5lci5pbnN0YW5jZS5pbnZva2UoV2lkZ2V0TGlmZWN5Y2xlLklkZW50aXR5UmVxdWVzdCwgb3B0cywgdGhpcy5mb3JXaWRnZXQpO1xuICAgICAgICBpZiAob3B0cy5hcHByb3ZlZCkge1xuICAgICAgICAgICAgcmV0dXJuIG9ic2VydmVyLnVwZGF0ZSh7XG4gICAgICAgICAgICAgICAgc3RhdGU6IE9wZW5JRFJlcXVlc3RTdGF0ZS5BbGxvd2VkLFxuICAgICAgICAgICAgICAgIHRva2VuOiBhd2FpdCBNYXRyaXhDbGllbnRQZWcuZ2V0KCkuZ2V0T3BlbklkVG9rZW4oKSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgb2lkY1N0YXRlID0gU2RrQ29udGV4dENsYXNzLmluc3RhbmNlLndpZGdldFBlcm1pc3Npb25TdG9yZS5nZXRPSURDU3RhdGUoXG4gICAgICAgICAgICB0aGlzLmZvcldpZGdldCxcbiAgICAgICAgICAgIHRoaXMuZm9yV2lkZ2V0S2luZCxcbiAgICAgICAgICAgIHRoaXMuaW5Sb29tSWQsXG4gICAgICAgICk7XG5cbiAgICAgICAgY29uc3QgZ2V0VG9rZW4gPSAoKTogUHJvbWlzZTxJT3BlbklEQ3JlZGVudGlhbHM+ID0+IHtcbiAgICAgICAgICAgIHJldHVybiBNYXRyaXhDbGllbnRQZWcuZ2V0KCkuZ2V0T3BlbklkVG9rZW4oKTtcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAob2lkY1N0YXRlID09PSBPSURDU3RhdGUuRGVuaWVkKSB7XG4gICAgICAgICAgICByZXR1cm4gb2JzZXJ2ZXIudXBkYXRlKHsgc3RhdGU6IE9wZW5JRFJlcXVlc3RTdGF0ZS5CbG9ja2VkIH0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvaWRjU3RhdGUgPT09IE9JRENTdGF0ZS5BbGxvd2VkKSB7XG4gICAgICAgICAgICByZXR1cm4gb2JzZXJ2ZXIudXBkYXRlKHsgc3RhdGU6IE9wZW5JRFJlcXVlc3RTdGF0ZS5BbGxvd2VkLCB0b2tlbjogYXdhaXQgZ2V0VG9rZW4oKSB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIG9ic2VydmVyLnVwZGF0ZSh7IHN0YXRlOiBPcGVuSURSZXF1ZXN0U3RhdGUuUGVuZGluZ1VzZXJDb25maXJtYXRpb24gfSk7XG5cbiAgICAgICAgTW9kYWwuY3JlYXRlRGlhbG9nKFdpZGdldE9wZW5JRFBlcm1pc3Npb25zRGlhbG9nLCB7XG4gICAgICAgICAgICB3aWRnZXQ6IHRoaXMuZm9yV2lkZ2V0LFxuICAgICAgICAgICAgd2lkZ2V0S2luZDogdGhpcy5mb3JXaWRnZXRLaW5kLFxuICAgICAgICAgICAgaW5Sb29tSWQ6IHRoaXMuaW5Sb29tSWQsXG5cbiAgICAgICAgICAgIG9uRmluaXNoZWQ6IGFzeW5jIChjb25maXJtKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCFjb25maXJtKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvYnNlcnZlci51cGRhdGUoeyBzdGF0ZTogT3BlbklEUmVxdWVzdFN0YXRlLkJsb2NrZWQgfSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIG9ic2VydmVyLnVwZGF0ZSh7IHN0YXRlOiBPcGVuSURSZXF1ZXN0U3RhdGUuQWxsb3dlZCwgdG9rZW46IGF3YWl0IGdldFRva2VuKCkgfSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgbmF2aWdhdGUodXJpOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgbmF2aWdhdGVUb1Blcm1hbGluayh1cmkpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyAqZ2V0VHVyblNlcnZlcnMoKTogQXN5bmNHZW5lcmF0b3I8SVR1cm5TZXJ2ZXI+IHtcbiAgICAgICAgY29uc3QgY2xpZW50ID0gTWF0cml4Q2xpZW50UGVnLmdldCgpO1xuICAgICAgICBpZiAoIWNsaWVudC5wb2xsaW5nVHVyblNlcnZlcnMgfHwgIWNsaWVudC5nZXRUdXJuU2VydmVycygpLmxlbmd0aCkgcmV0dXJuO1xuXG4gICAgICAgIGxldCBzZXRUdXJuU2VydmVyOiAoc2VydmVyOiBJVHVyblNlcnZlcikgPT4gdm9pZDtcbiAgICAgICAgbGV0IHNldEVycm9yOiAoZXJyb3I6IEVycm9yKSA9PiB2b2lkO1xuXG4gICAgICAgIGNvbnN0IG9uVHVyblNlcnZlcnMgPSAoW3NlcnZlcl06IElDbGllbnRUdXJuU2VydmVyW10pOiB2b2lkID0+IHNldFR1cm5TZXJ2ZXIobm9ybWFsaXplVHVyblNlcnZlcihzZXJ2ZXIpKTtcbiAgICAgICAgY29uc3Qgb25UdXJuU2VydmVyc0Vycm9yID0gKGVycm9yOiBFcnJvciwgZmF0YWw6IGJvb2xlYW4pOiB2b2lkID0+IHtcbiAgICAgICAgICAgIGlmIChmYXRhbCkgc2V0RXJyb3IoZXJyb3IpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNsaWVudC5vbihDbGllbnRFdmVudC5UdXJuU2VydmVycywgb25UdXJuU2VydmVycyk7XG4gICAgICAgIGNsaWVudC5vbihDbGllbnRFdmVudC5UdXJuU2VydmVyc0Vycm9yLCBvblR1cm5TZXJ2ZXJzRXJyb3IpO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBpbml0aWFsVHVyblNlcnZlciA9IGNsaWVudC5nZXRUdXJuU2VydmVycygpWzBdO1xuICAgICAgICAgICAgeWllbGQgbm9ybWFsaXplVHVyblNlcnZlcihpbml0aWFsVHVyblNlcnZlcik7XG5cbiAgICAgICAgICAgIC8vIFJlcGVhdGVkbHkgbGlzdGVuIGZvciBuZXcgVFVSTiBzZXJ2ZXJzIHVudGlsIGFuIGVycm9yIG9jY3VycyBvclxuICAgICAgICAgICAgLy8gdGhlIGNhbGxlciBzdG9wcyB0aGlzIGdlbmVyYXRvclxuICAgICAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgICAgICB5aWVsZCBhd2FpdCBuZXcgUHJvbWlzZTxJVHVyblNlcnZlcj4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBzZXRUdXJuU2VydmVyID0gcmVzb2x2ZTtcbiAgICAgICAgICAgICAgICAgICAgc2V0RXJyb3IgPSByZWplY3Q7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICAvLyBUaGUgbG9vcCB3YXMgYnJva2VuIC0gY2xlYW4gdXBcbiAgICAgICAgICAgIGNsaWVudC5vZmYoQ2xpZW50RXZlbnQuVHVyblNlcnZlcnMsIG9uVHVyblNlcnZlcnMpO1xuICAgICAgICAgICAgY2xpZW50Lm9mZihDbGllbnRFdmVudC5UdXJuU2VydmVyc0Vycm9yLCBvblR1cm5TZXJ2ZXJzRXJyb3IpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHJlYWRFdmVudFJlbGF0aW9ucyhcbiAgICAgICAgZXZlbnRJZDogc3RyaW5nLFxuICAgICAgICByb29tSWQ/OiBzdHJpbmcsXG4gICAgICAgIHJlbGF0aW9uVHlwZT86IHN0cmluZyxcbiAgICAgICAgZXZlbnRUeXBlPzogc3RyaW5nLFxuICAgICAgICBmcm9tPzogc3RyaW5nLFxuICAgICAgICB0bz86IHN0cmluZyxcbiAgICAgICAgbGltaXQ/OiBudW1iZXIsXG4gICAgICAgIGRpcmVjdGlvbj86IFwiZlwiIHwgXCJiXCIsXG4gICAgKTogUHJvbWlzZTxJUmVhZEV2ZW50UmVsYXRpb25zUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IGNsaWVudCA9IE1hdHJpeENsaWVudFBlZy5nZXQoKTtcbiAgICAgICAgY29uc3QgZGlyID0gZGlyZWN0aW9uIGFzIERpcmVjdGlvbjtcbiAgICAgICAgcm9vbUlkID0gcm9vbUlkID8/IFNka0NvbnRleHRDbGFzcy5pbnN0YW5jZS5yb29tVmlld1N0b3JlLmdldFJvb21JZCgpID8/IHVuZGVmaW5lZDtcblxuICAgICAgICBpZiAodHlwZW9mIHJvb21JZCAhPT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRXJyb3Igd2hpbGUgcmVhZGluZyB0aGUgY3VycmVudCByb29tXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgeyBldmVudHMsIG5leHRCYXRjaCwgcHJldkJhdGNoIH0gPSBhd2FpdCBjbGllbnQucmVsYXRpb25zKFxuICAgICAgICAgICAgcm9vbUlkLFxuICAgICAgICAgICAgZXZlbnRJZCxcbiAgICAgICAgICAgIHJlbGF0aW9uVHlwZSA/PyBudWxsLFxuICAgICAgICAgICAgZXZlbnRUeXBlID8/IG51bGwsXG4gICAgICAgICAgICB7IGZyb20sIHRvLCBsaW1pdCwgZGlyIH0sXG4gICAgICAgICk7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNodW5rOiBldmVudHMubWFwKChlKSA9PiBlLmdldEVmZmVjdGl2ZUV2ZW50KCkgYXMgSVJvb21FdmVudCksXG4gICAgICAgICAgICBuZXh0QmF0Y2g6IG5leHRCYXRjaCA/PyB1bmRlZmluZWQsXG4gICAgICAgICAgICBwcmV2QmF0Y2g6IHByZXZCYXRjaCA/PyB1bmRlZmluZWQsXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHNlYXJjaFVzZXJEaXJlY3Rvcnkoc2VhcmNoVGVybTogc3RyaW5nLCBsaW1pdD86IG51bWJlcik6IFByb21pc2U8SVNlYXJjaFVzZXJEaXJlY3RvcnlSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgY2xpZW50ID0gTWF0cml4Q2xpZW50UGVnLmdldCgpO1xuXG4gICAgICAgIGNvbnN0IHsgbGltaXRlZCwgcmVzdWx0cyB9ID0gYXdhaXQgY2xpZW50LnNlYXJjaFVzZXJEaXJlY3RvcnkoeyB0ZXJtOiBzZWFyY2hUZXJtLCBsaW1pdCB9KTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbGltaXRlZCxcbiAgICAgICAgICAgIHJlc3VsdHM6IHJlc3VsdHMubWFwKChyKSA9PiAoe1xuICAgICAgICAgICAgICAgIHVzZXJJZDogci51c2VyX2lkLFxuICAgICAgICAgICAgICAgIGRpc3BsYXlOYW1lOiByLmRpc3BsYXlfbmFtZSxcbiAgICAgICAgICAgICAgICBhdmF0YXJVcmw6IHIuYXZhdGFyX3VybCxcbiAgICAgICAgICAgIH0pKSxcbiAgICAgICAgfTtcbiAgICB9XG59XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBZ0JBLElBQUFBLGdCQUFBLEdBQUFDLE9BQUE7QUFtQkEsSUFBQUMsT0FBQSxHQUFBRCxPQUFBO0FBQ0EsSUFBQUUsTUFBQSxHQUFBRixPQUFBO0FBR0EsSUFBQUcsT0FBQSxHQUFBSCxPQUFBO0FBQ0EsSUFBQUksT0FBQSxHQUFBSixPQUFBO0FBRUEsSUFBQUssZ0JBQUEsR0FBQUwsT0FBQTtBQU1BLElBQUFNLFVBQUEsR0FBQUMsdUJBQUEsQ0FBQVAsT0FBQTtBQUNBLElBQUFRLFVBQUEsR0FBQVIsT0FBQTtBQUNBLElBQUFTLGdCQUFBLEdBQUFULE9BQUE7QUFDQSxJQUFBVSxNQUFBLEdBQUFDLHNCQUFBLENBQUFYLE9BQUE7QUFDQSxJQUFBWSw4QkFBQSxHQUFBRCxzQkFBQSxDQUFBWCxPQUFBO0FBQ0EsSUFBQWEsK0JBQUEsR0FBQUYsc0JBQUEsQ0FBQVgsT0FBQTtBQUNBLElBQUFjLGtCQUFBLEdBQUFkLE9BQUE7QUFDQSxJQUFBZSxzQkFBQSxHQUFBZixPQUFBO0FBQ0EsSUFBQWdCLFdBQUEsR0FBQWhCLE9BQUE7QUFDQSxJQUFBaUIsUUFBQSxHQUFBakIsT0FBQTtBQUNBLElBQUFrQixNQUFBLEdBQUFsQixPQUFBO0FBQ0EsSUFBQW1CLFdBQUEsR0FBQVIsc0JBQUEsQ0FBQVgsT0FBQTtBQUNBLElBQUFvQiwwQkFBQSxHQUFBcEIsT0FBQTtBQUNBLElBQUFxQixVQUFBLEdBQUFyQixPQUFBO0FBQ0EsSUFBQXNCLFdBQUEsR0FBQXRCLE9BQUE7QUFDQSxJQUFBdUIsYUFBQSxHQUFBdkIsT0FBQTtBQUNBLElBQUF3QixjQUFBLEdBQUFiLHNCQUFBLENBQUFYLE9BQUE7QUFBeUQsU0FBQXlCLHlCQUFBQyxXQUFBLGVBQUFDLE9BQUEsa0NBQUFDLGlCQUFBLE9BQUFELE9BQUEsUUFBQUUsZ0JBQUEsT0FBQUYsT0FBQSxZQUFBRix3QkFB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