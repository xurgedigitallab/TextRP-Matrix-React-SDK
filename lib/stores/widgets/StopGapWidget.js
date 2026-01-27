"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.StopGapWidget = exports.ElementWidget = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _paymentServices = require("../../paymentServices");
var _matrixWidgetApi = require("matrix-widget-api");
var _events = require("events");
var _event = require("matrix-js-sdk/src/models/event");
var _logger = require("matrix-js-sdk/src/logger");
var _client = require("matrix-js-sdk/src/client");
var _languageHandler = require("../../languageHandler");
var _StopGapWidgetDriver = require("./StopGapWidgetDriver");
var _WidgetMessagingStore = require("./WidgetMessagingStore");
var _MatrixClientPeg = require("../../MatrixClientPeg");
var _OwnProfileStore = require("../OwnProfileStore");
var _WidgetUtils = _interopRequireDefault(require("../../utils/WidgetUtils"));
var _IntegrationManagers = require("../../integrations/IntegrationManagers");
var _SettingsStore = _interopRequireDefault(require("../../settings/SettingsStore"));
var _WidgetType = require("../../widgets/WidgetType");
var _ActiveWidgetStore = _interopRequireDefault(require("../ActiveWidgetStore"));
var _objects = require("../../utils/objects");
var _dispatcher = _interopRequireDefault(require("../../dispatcher/dispatcher"));
var _actions = require("../../dispatcher/actions");
var _ElementWidgetActions = require("./ElementWidgetActions");
var _ModalWidgetStore = require("../ModalWidgetStore");
var _WidgetStore = require("../WidgetStore");
var _ThemeWatcher = _interopRequireDefault(require("../../settings/watchers/ThemeWatcher"));
var _theme = require("../../theme");
var _ElementWidgetCapabilities = require("./ElementWidgetCapabilities");
var _identifiers = require("../../identifiers");
var _WidgetVariables = require("../../customisations/WidgetVariables");
var _arrays = require("../../utils/arrays");
var _Modal = _interopRequireDefault(require("../../Modal"));
var _ErrorDialog = _interopRequireDefault(require("../../components/views/dialogs/ErrorDialog"));
var _SDKContext = require("../../contexts/SDKContext");
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          * Copyright 2020 - 2022 The Matrix.org Foundation C.I.C.
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
// TODO: Destroy all of this code

// TODO: Don't use this because it's wrong
class ElementWidget extends _matrixWidgetApi.Widget {
  constructor(rawDefinition) {
    super(rawDefinition);
    this.rawDefinition = rawDefinition;
  }
  get templateUrl() {
    if (_WidgetType.WidgetType.JITSI.matches(this.type)) {
      return _WidgetUtils.default.getLocalJitsiWrapperUrl({
        forLocalRender: true,
        auth: super.rawData?.auth // this.rawData can call templateUrl, do this to prevent looping
      });
    }

    return super.templateUrl;
  }
  get popoutTemplateUrl() {
    if (_WidgetType.WidgetType.JITSI.matches(this.type)) {
      return _WidgetUtils.default.getLocalJitsiWrapperUrl({
        forLocalRender: false,
        // The only important difference between this and templateUrl()
        auth: super.rawData?.auth
      });
    }
    return this.templateUrl; // use this instead of super to ensure we get appropriate templating
  }

  get rawData() {
    let conferenceId = super.rawData["conferenceId"];
    if (conferenceId === undefined) {
      // we'll need to parse the conference ID out of the URL for v1 Jitsi widgets
      const parsedUrl = new URL(super.templateUrl); // use super to get the raw widget URL
      conferenceId = parsedUrl.searchParams.get("confId");
    }
    let domain = super.rawData["domain"];
    if (domain === undefined) {
      // v1 widgets default to meet.element.io regardless of user settings
      domain = "meet.element.io";
    }
    let theme = new _ThemeWatcher.default().getEffectiveTheme();
    if (theme.startsWith("custom-")) {
      const customTheme = (0, _theme.getCustomTheme)(theme.slice(7));
      // Jitsi only understands light/dark
      theme = customTheme.is_dark ? "dark" : "light";
    }

    // only allow light/dark through, defaulting to dark as that was previously the only state
    // accounts for legacy-light/legacy-dark themes too
    if (theme.includes("light")) {
      theme = "light";
    } else {
      theme = "dark";
    }
    return _objectSpread(_objectSpread({}, super.rawData), {}, {
      theme,
      conferenceId,
      domain
    });
  }
  getCompleteUrl(params) {
    let asPopout = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    return (0, _matrixWidgetApi.runTemplate)(asPopout ? this.popoutTemplateUrl : this.templateUrl, _objectSpread(_objectSpread({}, this.rawDefinition), {}, {
      data: this.rawData
    }), params);
  }
}
exports.ElementWidget = ElementWidget;
class StopGapWidget extends _events.EventEmitter {
  // room ID to event ID

  constructor(appTileProps) {
    super();
    this.appTileProps = appTileProps;
    (0, _defineProperty2.default)(this, "client", void 0);
    (0, _defineProperty2.default)(this, "messaging", null);
    (0, _defineProperty2.default)(this, "mockWidget", void 0);
    (0, _defineProperty2.default)(this, "scalarToken", void 0);
    (0, _defineProperty2.default)(this, "roomId", void 0);
    (0, _defineProperty2.default)(this, "kind", void 0);
    (0, _defineProperty2.default)(this, "virtual", void 0);
    (0, _defineProperty2.default)(this, "readUpToMap", {});
    (0, _defineProperty2.default)(this, "onOpenModal", async ev => {
      ev.preventDefault();
      if (_ModalWidgetStore.ModalWidgetStore.instance.canOpenModalWidget()) {
        _ModalWidgetStore.ModalWidgetStore.instance.openModalWidget(ev.detail.data, this.mockWidget, this.roomId);
        this.messaging?.transport.reply(ev.detail, {}); // ack
      } else {
        this.messaging?.transport.reply(ev.detail, {
          error: {
            message: "Unable to open modal at this time"
          }
        });
      }
    });
    (0, _defineProperty2.default)(this, "onEvent", ev => {
      this.client.decryptEventIfNeeded(ev);
      if (ev.isBeingDecrypted() || ev.isDecryptionFailure()) return;
      this.feedEvent(ev);
    });
    (0, _defineProperty2.default)(this, "onEventDecrypted", ev => {
      if (ev.isDecryptionFailure()) return;
      this.feedEvent(ev);
    });
    (0, _defineProperty2.default)(this, "onToDeviceEvent", async ev => {
      await this.client.decryptEventIfNeeded(ev);
      if (ev.isDecryptionFailure()) return;
      await this.messaging?.feedToDevice(ev.getEffectiveEvent(), ev.isEncrypted());
    });
    this.client = _MatrixClientPeg.MatrixClientPeg.get();
    let app = appTileProps.app;
    // Backwards compatibility: not all old widgets have a creatorUserId
    if (!app.creatorUserId) {
      app = (0, _objects.objectShallowClone)(app); // clone to prevent accidental mutation
      app.creatorUserId = this.client.getUserId();
    }
    this.mockWidget = new ElementWidget(app);
    this.roomId = appTileProps.room?.roomId;
    this.kind = appTileProps.userWidget ? _matrixWidgetApi.WidgetKind.Account : _matrixWidgetApi.WidgetKind.Room; // probably
    this.virtual = (0, _WidgetStore.isAppWidget)(app) && app.eventId === undefined;
  }
  get eventListenerRoomId() {
    // When widgets are listening to events, we need to make sure they're only
    // receiving events for the right room. In particular, room widgets get locked
    // to the room they were added in while account widgets listen to the currently
    // active room.

    if (this.roomId) return this.roomId;
    return _SDKContext.SdkContextClass.instance.roomViewStore.getRoomId();
  }
  get widgetApi() {
    return this.messaging;
  }

  /**
   * The URL to use in the iframe
   */
  get embedUrl() {
    return this.runUrlTemplate({
      asPopout: false
    });
  }

  /**
   * The URL to use in the popout
   */
  get popoutUrl() {
    return this.runUrlTemplate({
      asPopout: true
    });
  }
  runUrlTemplate() {
    let opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {
      asPopout: false
    };
    const fromCustomisation = _WidgetVariables.WidgetVariableCustomisations?.provideVariables?.() ?? {};
    const defaults = {
      widgetRoomId: this.roomId,
      currentUserId: this.client.getUserId(),
      userDisplayName: _OwnProfileStore.OwnProfileStore.instance.displayName ?? undefined,
      userHttpAvatarUrl: _OwnProfileStore.OwnProfileStore.instance.getHttpAvatarUrl() ?? undefined,
      clientId: _identifiers.ELEMENT_CLIENT_ID,
      clientTheme: _SettingsStore.default.getValue("theme"),
      clientLanguage: (0, _languageHandler.getUserLanguage)(),
      deviceId: this.client.getDeviceId() ?? undefined
    };
    const templated = this.mockWidget.getCompleteUrl(Object.assign(defaults, fromCustomisation), opts?.asPopout);
    const client = _MatrixClientPeg.MatrixClientPeg.get();
    const roomInfo = client.getRoom(this.roomId);
    const userInfo = {
      userId: roomInfo.myUserId,
      walletAddress: (0, _paymentServices.extractWalletAddress)(roomInfo.myUserId),
      displayName: roomInfo.getMember(roomInfo.myUserId)?.name
    };
    const roomMembers = roomInfo.getJoinedMembers();
    const memebersInfo = [];
    roomMembers.forEach(member => {
      if (member.userId !== userInfo.userId) {
        memebersInfo.push({
          userId: member.userId,
          walletAddress: (0, _paymentServices.extractWalletAddress)(member.userId),
          displayName: member.name
        });
      }
    });
    console.log("userInfo", userInfo, memebersInfo);
    let parsed = new URL(templated);
    if (parsed.search.includes("?url=https%3A%2F%2Ftextrpdemo.s3.eu-central-1.amazonaws.com%2Findex.html")) {
      parsed.search = parsed.search.replace("?url=https%3A%2F%2Ftextrpdemo.s3.eu-central-1.amazonaws.com%2Findex.html", `?url=https%3A%2F%2Ftextrpdemo.s3.eu-central-1.amazonaws.com%2Findex.html?userInfo=${JSON.stringify(userInfo)}%26memebersInfo=${JSON.stringify(memebersInfo)}`);
    }
    // Add in some legacy support sprinkles (for non-popout widgets)
    // TODO: Replace these with proper widget params
    // See https://github.com/matrix-org/matrix-doc/pull/1958/files#r405714833
    if (!opts?.asPopout) {
      parsed.searchParams.set("widgetId", this.mockWidget.id);
      parsed.searchParams.set("parentUrl", window.location.href.split("#", 2)[0]);

      // Give the widget a scalar token if we're supposed to (more legacy)
      // TODO: Stop doing this
      if (this.scalarToken) {
        parsed.searchParams.set("scalar_token", this.scalarToken);
      }
    }

    // Replace the encoded dollar signs back to dollar signs. They have no special meaning
    // in HTTP, but URL parsers encode them anyways.
    return parsed.toString().replace(/%24/g, "$");
  }
  get isManagedByManager() {
    return !!this.scalarToken;
  }
  get started() {
    return !!this.messaging;
  }
  /**
   * This starts the messaging for the widget if it is not in the state `started` yet.
   * @param iframe the iframe the widget should use
   */
  startMessaging(iframe) {
    if (this.started) return;
    const allowedCapabilities = this.appTileProps.whitelistCapabilities || [];
    const driver = new _StopGapWidgetDriver.StopGapWidgetDriver(allowedCapabilities, this.mockWidget, this.kind, this.virtual, this.roomId);
    this.messaging = new _matrixWidgetApi.ClientWidgetApi(this.mockWidget, iframe, driver);
    this.messaging.on("preparing", () => this.emit("preparing"));
    this.messaging.on("ready", () => {
      _WidgetMessagingStore.WidgetMessagingStore.instance.storeMessaging(this.mockWidget, this.roomId, this.messaging);
      this.emit("ready");
    });
    this.messaging.on("capabilitiesNotified", () => this.emit("capabilitiesNotified"));
    this.messaging.on(`action:${_matrixWidgetApi.WidgetApiFromWidgetAction.OpenModalWidget}`, this.onOpenModal);
    this.messaging.on(`action:${_ElementWidgetActions.ElementWidgetActions.JoinCall}`, () => {
      // pause voice broadcast recording when any widget sends a "join"
      _SDKContext.SdkContextClass.instance.voiceBroadcastRecordingsStore.getCurrent()?.pause();
    });

    // Always attach a handler for ViewRoom, but permission check it internally
    this.messaging.on(`action:${_ElementWidgetActions.ElementWidgetActions.ViewRoom}`, ev => {
      ev.preventDefault(); // stop the widget API from auto-rejecting this

      // Check up front if this is even a valid request
      const targetRoomId = (ev.detail.data || {}).room_id;
      if (!targetRoomId) {
        return this.messaging?.transport.reply(ev.detail, {
          error: {
            message: "Room ID not supplied."
          }
        });
      }

      // Check the widget's permission
      if (!this.messaging?.hasCapability(_ElementWidgetCapabilities.ElementWidgetCapabilities.CanChangeViewedRoom)) {
        return this.messaging?.transport.reply(ev.detail, {
          error: {
            message: "This widget does not have permission for this action (denied)."
          }
        });
      }

      // at this point we can change rooms, so do that
      _dispatcher.default.dispatch({
        action: _actions.Action.ViewRoom,
        room_id: targetRoomId,
        metricsTrigger: "Widget"
      });

      // acknowledge so the widget doesn't freak out
      this.messaging.transport.reply(ev.detail, {});
    });

    // Populate the map of "read up to" events for this widget with the current event in every room.
    // This is a bit inefficient, but should be okay. We do this for all rooms in case the widget
    // requests timeline capabilities in other rooms down the road. It's just easier to manage here.
    for (const room of this.client.getRooms()) {
      // Timelines are most recent last
      const events = room.getLiveTimeline()?.getEvents() || [];
      const roomEvent = events[events.length - 1];
      if (!roomEvent) continue; // force later code to think the room is fresh
      this.readUpToMap[room.roomId] = roomEvent.getId();
    }

    // Attach listeners for feeding events - the underlying widget classes handle permissions for us
    this.client.on(_client.ClientEvent.Event, this.onEvent);
    this.client.on(_event.MatrixEventEvent.Decrypted, this.onEventDecrypted);
    this.client.on(_client.ClientEvent.ToDeviceEvent, this.onToDeviceEvent);
    this.messaging.on(`action:${_matrixWidgetApi.WidgetApiFromWidgetAction.UpdateAlwaysOnScreen}`, ev => {
      if (this.messaging?.hasCapability(_matrixWidgetApi.MatrixCapabilities.AlwaysOnScreen)) {
        _ActiveWidgetStore.default.instance.setWidgetPersistence(this.mockWidget.id, this.roomId ?? null, ev.detail.data.value);
        ev.preventDefault();
        this.messaging.transport.reply(ev.detail, {}); // ack
      }
    });

    // TODO: Replace this event listener with appropriate driver functionality once the API
    // establishes a sane way to send events back and forth.
    this.messaging.on(`action:${_matrixWidgetApi.WidgetApiFromWidgetAction.SendSticker}`, ev => {
      if (this.messaging?.hasCapability(_matrixWidgetApi.MatrixCapabilities.StickerSending)) {
        // Acknowledge first
        ev.preventDefault();
        this.messaging.transport.reply(ev.detail, {});

        // Send the sticker
        _dispatcher.default.dispatch({
          action: "m.sticker",
          data: ev.detail.data,
          widgetId: this.mockWidget.id
        });
      }
    });
    if (_WidgetType.WidgetType.STICKERPICKER.matches(this.mockWidget.type)) {
      this.messaging.on(`action:${_ElementWidgetActions.ElementWidgetActions.OpenIntegrationManager}`, ev => {
        // Acknowledge first
        ev.preventDefault();
        this.messaging?.transport.reply(ev.detail, {});

        // First close the stickerpicker
        _dispatcher.default.dispatch({
          action: "stickerpicker_close"
        });

        // Now open the integration manager
        // TODO: Spec this interaction.
        const data = ev.detail.data;
        const integType = data?.integType;
        const integId = data?.integId;
        const roomId = _SDKContext.SdkContextClass.instance.roomViewStore.getRoomId();
        const room = roomId ? this.client.getRoom(roomId) : undefined;
        if (!room) return;

        // noinspection JSIgnoredPromiseFromCall
        _IntegrationManagers.IntegrationManagers.sharedInstance()?.getPrimaryManager()?.open(room, `type_${integType}`, integId);
      });
    }
    if (_WidgetType.WidgetType.JITSI.matches(this.mockWidget.type)) {
      this.messaging.on(`action:${_ElementWidgetActions.ElementWidgetActions.HangupCall}`, ev => {
        ev.preventDefault();
        if (ev.detail.data?.errorMessage) {
          _Modal.default.createDialog(_ErrorDialog.default, {
            title: (0, _languageHandler._t)("Connection lost"),
            description: (0, _languageHandler._t)("You were disconnected from the call. (Error: %(message)s)", {
              message: ev.detail.data.errorMessage
            })
          });
        }
        this.messaging?.transport.reply(ev.detail, {});
      });
    }
  }
  async prepare() {
    // Ensure the variables are ready for us to be rendered before continuing
    await (_WidgetVariables.WidgetVariableCustomisations?.isReady?.() ?? Promise.resolve());
    if (this.scalarToken) return;
    const existingMessaging = _WidgetMessagingStore.WidgetMessagingStore.instance.getMessaging(this.mockWidget, this.roomId);
    if (existingMessaging) this.messaging = existingMessaging;
    try {
      if (_WidgetUtils.default.isScalarUrl(this.mockWidget.templateUrl)) {
        const managers = _IntegrationManagers.IntegrationManagers.sharedInstance();
        if (managers.hasManager()) {
          // TODO: Pick the right manager for the widget
          const defaultManager = managers.getPrimaryManager();
          if (defaultManager && _WidgetUtils.default.isScalarUrl(defaultManager.apiUrl)) {
            const scalar = defaultManager.getScalarClient();
            this.scalarToken = await scalar.getScalarToken();
          }
        }
      }
    } catch (e) {
      // All errors are non-fatal
      _logger.logger.error("Error preparing widget communications: ", e);
    }
  }

  /**
   * Stops the widget messaging for if it is started. Skips stopping if it is an active
   * widget.
   * @param opts
   */
  stopMessaging() {
    let opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {
      forceDestroy: false
    };
    if (!opts?.forceDestroy && _ActiveWidgetStore.default.instance.getWidgetPersistence(this.mockWidget.id, this.roomId ?? null)) {
      _logger.logger.log("Skipping destroy - persistent widget");
      return;
    }
    if (!this.started) return;
    _WidgetMessagingStore.WidgetMessagingStore.instance.stopMessaging(this.mockWidget, this.roomId);
    this.messaging = null;
    this.client.off(_client.ClientEvent.Event, this.onEvent);
    this.client.off(_event.MatrixEventEvent.Decrypted, this.onEventDecrypted);
    this.client.off(_client.ClientEvent.ToDeviceEvent, this.onToDeviceEvent);
  }
  feedEvent(ev) {
    if (!this.messaging) return;

    // Check to see if this event would be before or after our "read up to" marker. If it's
    // before, or we can't decide, then we assume the widget will have already seen the event.
    // If the event is after, or we don't have a marker for the room, then we'll send it through.
    //
    // This approach of "read up to" prevents widgets receiving decryption spam from startup or
    // receiving out-of-order events from backfill and such.
    const upToEventId = this.readUpToMap[ev.getRoomId()];
    if (upToEventId) {
      // Small optimization for exact match (prevent search)
      if (upToEventId === ev.getId()) {
        return;
      }
      let isBeforeMark = true;
      const room = this.client.getRoom(ev.getRoomId());
      if (!room) return;
      // Timelines are most recent last, so reverse the order and limit ourselves to 100 events
      // to avoid overusing the CPU.
      const timeline = room.getLiveTimeline();
      const events = (0, _arrays.arrayFastClone)(timeline.getEvents()).reverse().slice(0, 100);
      for (const timelineEvent of events) {
        if (timelineEvent.getId() === upToEventId) {
          break;
        } else if (timelineEvent.getId() === ev.getId()) {
          isBeforeMark = false;
          break;
        }
      }
      if (isBeforeMark) {
        // Ignore the event: it is before our interest.
        return;
      }
    }

    // Skip marker assignment if membership is 'invite', otherwise 'm.room.member' from
    // invitation room will assign it and new state events will be not forwarded to the widget
    // because of empty timeline for invitation room and assigned marker.
    const evRoomId = ev.getRoomId();
    const evId = ev.getId();
    if (evRoomId && evId) {
      const room = this.client.getRoom(evRoomId);
      if (room && room.getMyMembership() === "join") {
        this.readUpToMap[evRoomId] = evId;
      }
    }
    const raw = ev.getEffectiveEvent();
    this.messaging.feedEvent(raw, this.eventListenerRoomId).catch(e => {
      _logger.logger.error("Error sending event to widget: ", e);
    });
  }
}
exports.StopGapWidget = StopGapWidget;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfcGF5bWVudFNlcnZpY2VzIiwicmVxdWlyZSIsIl9tYXRyaXhXaWRnZXRBcGkiLCJfZXZlbnRzIiwiX2V2ZW50IiwiX2xvZ2dlciIsIl9jbGllbnQiLCJfbGFuZ3VhZ2VIYW5kbGVyIiwiX1N0b3BHYXBXaWRnZXREcml2ZXIiLCJfV2lkZ2V0TWVzc2FnaW5nU3RvcmUiLCJfTWF0cml4Q2xpZW50UGVnIiwiX093blByb2ZpbGVTdG9yZSIsIl9XaWRnZXRVdGlscyIsIl9pbnRlcm9wUmVxdWlyZURlZmF1bHQiLCJfSW50ZWdyYXRpb25NYW5hZ2VycyIsIl9TZXR0aW5nc1N0b3JlIiwiX1dpZGdldFR5cGUiLCJfQWN0aXZlV2lkZ2V0U3RvcmUiLCJfb2JqZWN0cyIsIl9kaXNwYXRjaGVyIiwiX2FjdGlvbnMiLCJfRWxlbWVudFdpZGdldEFjdGlvbnMiLCJfTW9kYWxXaWRnZXRTdG9yZSIsIl9XaWRnZXRTdG9yZSIsIl9UaGVtZVdhdGNoZXIiLCJfdGhlbWUiLCJfRWxlbWVudFdpZGdldENhcGFiaWxpdGllcyIsIl9pZGVudGlmaWVycyIsIl9XaWRnZXRWYXJpYWJsZXMiLCJfYXJyYXlzIiwiX01vZGFsIiwiX0Vycm9yRGlhbG9nIiwiX1NES0NvbnRleHQiLCJvd25LZXlzIiwib2JqZWN0IiwiZW51bWVyYWJsZU9ubHkiLCJrZXlzIiwiT2JqZWN0IiwiZ2V0T3duUHJvcGVydHlTeW1ib2xzIiwic3ltYm9scyIsImZpbHRlciIsInN5bSIsImdldE93blByb3BlcnR5RGVzY3JpcHRvciIsImVudW1lcmFibGUiLCJwdXNoIiwiYXBwbHkiLCJfb2JqZWN0U3ByZWFkIiwidGFyZ2V0IiwiaSIsImFyZ3VtZW50cyIsImxlbmd0aCIsInNvdXJjZSIsImZvckVhY2giLCJrZXkiLCJfZGVmaW5lUHJvcGVydHkyIiwiZGVmYXVsdCIsImdldE93blByb3BlcnR5RGVzY3JpcHRvcnMiLCJkZWZpbmVQcm9wZXJ0aWVzIiwiZGVmaW5lUHJvcGVydHkiLCJFbGVtZW50V2lkZ2V0IiwiV2lkZ2V0IiwiY29uc3RydWN0b3IiLCJyYXdEZWZpbml0aW9uIiwidGVtcGxhdGVVcmwiLCJXaWRnZXRUeXBlIiwiSklUU0kiLCJtYXRjaGVzIiwidHlwZSIsIldpZGdldFV0aWxzIiwiZ2V0TG9jYWxKaXRzaVdyYXBwZXJVcmwiLCJmb3JMb2NhbFJlbmRlciIsImF1dGgiLCJyYXdEYXRhIiwicG9wb3V0VGVtcGxhdGVVcmwiLCJjb25mZXJlbmNlSWQiLCJ1bmRlZmluZWQiLCJwYXJzZWRVcmwiLCJVUkwiLCJzZWFyY2hQYXJhbXMiLCJnZXQiLCJkb21haW4iLCJ0aGVtZSIsIlRoZW1lV2F0Y2hlciIsImdldEVmZmVjdGl2ZVRoZW1lIiwic3RhcnRzV2l0aCIsImN1c3RvbVRoZW1lIiwiZ2V0Q3VzdG9tVGhlbWUiLCJzbGljZSIsImlzX2RhcmsiLCJpbmNsdWRlcyIsImdldENvbXBsZXRlVXJsIiwicGFyYW1zIiwiYXNQb3BvdXQiLCJydW5UZW1wbGF0ZSIsImRhdGEiLCJleHBvcnRzIiwiU3RvcEdhcFdpZGdldCIsIkV2ZW50RW1pdHRlciIsImFwcFRpbGVQcm9wcyIsImV2IiwicHJldmVudERlZmF1bHQiLCJNb2RhbFdpZGdldFN0b3JlIiwiaW5zdGFuY2UiLCJjYW5PcGVuTW9kYWxXaWRnZXQiLCJvcGVuTW9kYWxXaWRnZXQiLCJkZXRhaWwiLCJtb2NrV2lkZ2V0Iiwicm9vbUlkIiwibWVzc2FnaW5nIiwidHJhbnNwb3J0IiwicmVwbHkiLCJlcnJvciIsIm1lc3NhZ2UiLCJjbGllbnQiLCJkZWNyeXB0RXZlbnRJZk5lZWRlZCIsImlzQmVpbmdEZWNyeXB0ZWQiLCJpc0RlY3J5cHRpb25GYWlsdXJlIiwiZmVlZEV2ZW50IiwiZmVlZFRvRGV2aWNlIiwiZ2V0RWZmZWN0aXZlRXZlbnQiLCJpc0VuY3J5cHRlZCIsIk1hdHJpeENsaWVudFBlZyIsImFwcCIsImNyZWF0b3JVc2VySWQiLCJvYmplY3RTaGFsbG93Q2xvbmUiLCJnZXRVc2VySWQiLCJyb29tIiwia2luZCIsInVzZXJXaWRnZXQiLCJXaWRnZXRLaW5kIiwiQWNjb3VudCIsIlJvb20iLCJ2aXJ0dWFsIiwiaXNBcHBXaWRnZXQiLCJldmVudElkIiwiZXZlbnRMaXN0ZW5lclJvb21JZCIsIlNka0NvbnRleHRDbGFzcyIsInJvb21WaWV3U3RvcmUiLCJnZXRSb29tSWQiLCJ3aWRnZXRBcGkiLCJlbWJlZFVybCIsInJ1blVybFRlbXBsYXRlIiwicG9wb3V0VXJsIiwib3B0cyIsImZyb21DdXN0b21pc2F0aW9uIiwiV2lkZ2V0VmFyaWFibGVDdXN0b21pc2F0aW9ucyIsInByb3ZpZGVWYXJpYWJsZXMiLCJkZWZhdWx0cyIsIndpZGdldFJvb21JZCIsImN1cnJlbnRVc2VySWQiLCJ1c2VyRGlzcGxheU5hbWUiLCJPd25Qcm9maWxlU3RvcmUiLCJkaXNwbGF5TmFtZSIsInVzZXJIdHRwQXZhdGFyVXJsIiwiZ2V0SHR0cEF2YXRhclVybCIsImNsaWVudElkIiwiRUxFTUVOVF9DTElFTlRfSUQiLCJjbGllbnRUaGVtZSIsIlNldHRpbmdzU3RvcmUiLCJnZXRWYWx1ZSIsImNsaWVudExhbmd1YWdlIiwiZ2V0VXNlckxhbmd1YWdlIiwiZGV2aWNlSWQiLCJnZXREZXZpY2VJZCIsInRlbXBsYXRlZCIsImFzc2lnbiIsInJvb21JbmZvIiwiZ2V0Um9vbSIsInVzZXJJbmZvIiwidXNlcklkIiwibXlVc2VySWQiLCJ3YWxsZXRBZGRyZXNzIiwiZXh0cmFjdFdhbGxldEFkZHJlc3MiLCJnZXRNZW1iZXIiLCJuYW1lIiwicm9vbU1lbWJlcnMiLCJnZXRKb2luZWRNZW1iZXJzIiwibWVtZWJlcnNJbmZvIiwibWVtYmVyIiwiY29uc29sZSIsImxvZyIsInBhcnNlZCIsInNlYXJjaCIsInJlcGxhY2UiLCJKU09OIiwic3RyaW5naWZ5Iiwic2V0IiwiaWQiLCJ3aW5kb3ciLCJsb2NhdGlvbiIsImhyZWYiLCJzcGxpdCIsInNjYWxhclRva2VuIiwidG9TdHJpbmciLCJpc01hbmFnZWRCeU1hbmFnZXIiLCJzdGFydGVkIiwic3RhcnRNZXNzYWdpbmciLCJpZnJhbWUiLCJhbGxvd2VkQ2FwYWJpbGl0aWVzIiwid2hpdGVsaXN0Q2FwYWJpbGl0aWVzIiwiZHJpdmVyIiwiU3RvcEdhcFdpZGdldERyaXZlciIsIkNsaWVudFdpZGdldEFwaSIsIm9uIiwiZW1pdCIsIldpZGdldE1lc3NhZ2luZ1N0b3JlIiwic3RvcmVNZXNzYWdpbmciLCJXaWRnZXRBcGlGcm9tV2lkZ2V0QWN0aW9uIiwiT3Blbk1vZGFsV2lkZ2V0Iiwib25PcGVuTW9kYWwiLCJFbGVtZW50V2lkZ2V0QWN0aW9ucyIsIkpvaW5DYWxsIiwidm9pY2VCcm9hZGNhc3RSZWNvcmRpbmdzU3RvcmUiLCJnZXRDdXJyZW50IiwicGF1c2UiLCJWaWV3Um9vbSIsInRhcmdldFJvb21JZCIsInJvb21faWQiLCJoYXNDYXBhYmlsaXR5IiwiRWxlbWVudFdpZGdldENhcGFiaWxpdGllcyIsIkNhbkNoYW5nZVZpZXdlZFJvb20iLCJkZWZhdWx0RGlzcGF0Y2hlciIsImRpc3BhdGNoIiwiYWN0aW9uIiwiQWN0aW9uIiwibWV0cmljc1RyaWdnZXIiLCJnZXRSb29tcyIsImV2ZW50cyIsImdldExpdmVUaW1lbGluZSIsImdldEV2ZW50cyIsInJvb21FdmVudCIsInJlYWRVcFRvTWFwIiwiZ2V0SWQiLCJDbGllbnRFdmVudCIsIkV2ZW50Iiwib25FdmVudCIsIk1hdHJpeEV2ZW50RXZlbnQiLCJEZWNyeXB0ZWQiLCJvbkV2ZW50RGVjcnlwdGVkIiwiVG9EZXZpY2VFdmVudCIsIm9uVG9EZXZpY2VFdmVudCIsIlVwZGF0ZUFsd2F5c09uU2NyZWVuIiwiTWF0cml4Q2FwYWJpbGl0aWVzIiwiQWx3YXlzT25TY3JlZW4iLCJBY3RpdmVXaWRnZXRTdG9yZSIsInNldFdpZGdldFBlcnNpc3RlbmNlIiwidmFsdWUiLCJTZW5kU3RpY2tlciIsIlN0aWNrZXJTZW5kaW5nIiwid2lkZ2V0SWQiLCJTVElDS0VSUElDS0VSIiwiT3BlbkludGVncmF0aW9uTWFuYWdlciIsImludGVnVHlwZSIsImludGVnSWQiLCJJbnRlZ3JhdGlvbk1hbmFnZXJzIiwic2hhcmVkSW5zdGFuY2UiLCJnZXRQcmltYXJ5TWFuYWdlciIsIm9wZW4iLCJIYW5ndXBDYWxsIiwiZXJyb3JNZXNzYWdlIiwiTW9kYWwiLCJjcmVhdGVEaWFsb2ciLCJFcnJvckRpYWxvZyIsInRpdGxlIiwiX3QiLCJkZXNjcmlwdGlvbiIsInByZXBhcmUiLCJpc1JlYWR5IiwiUHJvbWlzZSIsInJlc29sdmUiLCJleGlzdGluZ01lc3NhZ2luZyIsImdldE1lc3NhZ2luZyIsImlzU2NhbGFyVXJsIiwibWFuYWdlcnMiLCJoYXNNYW5hZ2VyIiwiZGVmYXVsdE1hbmFnZXIiLCJhcGlVcmwiLCJzY2FsYXIiLCJnZXRTY2FsYXJDbGllbnQiLCJnZXRTY2FsYXJUb2tlbiIsImUiLCJsb2dnZXIiLCJzdG9wTWVzc2FnaW5nIiwiZm9yY2VEZXN0cm95IiwiZ2V0V2lkZ2V0UGVyc2lzdGVuY2UiLCJvZmYiLCJ1cFRvRXZlbnRJZCIsImlzQmVmb3JlTWFyayIsInRpbWVsaW5lIiwiYXJyYXlGYXN0Q2xvbmUiLCJyZXZlcnNlIiwidGltZWxpbmVFdmVudCIsImV2Um9vbUlkIiwiZXZJZCIsImdldE15TWVtYmVyc2hpcCIsInJhdyIsImNhdGNoIl0sInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3N0b3Jlcy93aWRnZXRzL1N0b3BHYXBXaWRnZXQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIENvcHlyaWdodCAyMDIwIC0gMjAyMiBUaGUgTWF0cml4Lm9yZyBGb3VuZGF0aW9uIEMuSS5DLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuaW1wb3J0IHsgUm9vbSB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9tb2RlbHMvcm9vbVwiO1xuaW1wb3J0IHsgZXh0cmFjdFdhbGxldEFkZHJlc3MgfSBmcm9tIFwiLi4vLi4vcGF5bWVudFNlcnZpY2VzXCI7XG5pbXBvcnQge1xuICAgIENsaWVudFdpZGdldEFwaSxcbiAgICBJTW9kYWxXaWRnZXRPcGVuUmVxdWVzdCxcbiAgICBJUm9vbUV2ZW50LFxuICAgIElTdGlja2VyQWN0aW9uUmVxdWVzdCxcbiAgICBJU3RpY2t5QWN0aW9uUmVxdWVzdCxcbiAgICBJVGVtcGxhdGVQYXJhbXMsXG4gICAgSVdpZGdldCxcbiAgICBJV2lkZ2V0QXBpRXJyb3JSZXNwb25zZURhdGEsXG4gICAgSVdpZGdldEFwaVJlcXVlc3QsXG4gICAgSVdpZGdldEFwaVJlcXVlc3RFbXB0eURhdGEsXG4gICAgSVdpZGdldERhdGEsXG4gICAgTWF0cml4Q2FwYWJpbGl0aWVzLFxuICAgIHJ1blRlbXBsYXRlLFxuICAgIFdpZGdldCxcbiAgICBXaWRnZXRBcGlGcm9tV2lkZ2V0QWN0aW9uLFxuICAgIFdpZGdldEtpbmQsXG59IGZyb20gXCJtYXRyaXgtd2lkZ2V0LWFwaVwiO1xuaW1wb3J0IHsgT3B0aW9uYWwgfSBmcm9tIFwibWF0cml4LWV2ZW50cy1zZGtcIjtcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gXCJldmVudHNcIjtcbmltcG9ydCB7IE1hdHJpeENsaWVudCB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9jbGllbnRcIjtcbmltcG9ydCB7IE1hdHJpeEV2ZW50LCBNYXRyaXhFdmVudEV2ZW50IH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL21vZGVscy9ldmVudFwiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL2xvZ2dlclwiO1xuaW1wb3J0IHsgQ2xpZW50RXZlbnQgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvY2xpZW50XCI7XG5cbmltcG9ydCB7IF90IH0gZnJvbSBcIi4uLy4uL2xhbmd1YWdlSGFuZGxlclwiO1xuaW1wb3J0IHsgU3RvcEdhcFdpZGdldERyaXZlciB9IGZyb20gXCIuL1N0b3BHYXBXaWRnZXREcml2ZXJcIjtcbmltcG9ydCB7IFdpZGdldE1lc3NhZ2luZ1N0b3JlIH0gZnJvbSBcIi4vV2lkZ2V0TWVzc2FnaW5nU3RvcmVcIjtcbmltcG9ydCB7IE1hdHJpeENsaWVudFBlZyB9IGZyb20gXCIuLi8uLi9NYXRyaXhDbGllbnRQZWdcIjtcbmltcG9ydCB7IE93blByb2ZpbGVTdG9yZSB9IGZyb20gXCIuLi9Pd25Qcm9maWxlU3RvcmVcIjtcbmltcG9ydCBXaWRnZXRVdGlscyBmcm9tIFwiLi4vLi4vdXRpbHMvV2lkZ2V0VXRpbHNcIjtcbmltcG9ydCB7IEludGVncmF0aW9uTWFuYWdlcnMgfSBmcm9tIFwiLi4vLi4vaW50ZWdyYXRpb25zL0ludGVncmF0aW9uTWFuYWdlcnNcIjtcbmltcG9ydCBTZXR0aW5nc1N0b3JlIGZyb20gXCIuLi8uLi9zZXR0aW5ncy9TZXR0aW5nc1N0b3JlXCI7XG5pbXBvcnQgeyBXaWRnZXRUeXBlIH0gZnJvbSBcIi4uLy4uL3dpZGdldHMvV2lkZ2V0VHlwZVwiO1xuaW1wb3J0IEFjdGl2ZVdpZGdldFN0b3JlIGZyb20gXCIuLi9BY3RpdmVXaWRnZXRTdG9yZVwiO1xuaW1wb3J0IHsgb2JqZWN0U2hhbGxvd0Nsb25lIH0gZnJvbSBcIi4uLy4uL3V0aWxzL29iamVjdHNcIjtcbmltcG9ydCBkZWZhdWx0RGlzcGF0Y2hlciBmcm9tIFwiLi4vLi4vZGlzcGF0Y2hlci9kaXNwYXRjaGVyXCI7XG5pbXBvcnQgeyBBY3Rpb24gfSBmcm9tIFwiLi4vLi4vZGlzcGF0Y2hlci9hY3Rpb25zXCI7XG5pbXBvcnQgeyBFbGVtZW50V2lkZ2V0QWN0aW9ucywgSUhhbmd1cENhbGxBcGlSZXF1ZXN0LCBJVmlld1Jvb21BcGlSZXF1ZXN0IH0gZnJvbSBcIi4vRWxlbWVudFdpZGdldEFjdGlvbnNcIjtcbmltcG9ydCB7IE1vZGFsV2lkZ2V0U3RvcmUgfSBmcm9tIFwiLi4vTW9kYWxXaWRnZXRTdG9yZVwiO1xuaW1wb3J0IHsgSUFwcCwgaXNBcHBXaWRnZXQgfSBmcm9tIFwiLi4vV2lkZ2V0U3RvcmVcIjtcbmltcG9ydCBUaGVtZVdhdGNoZXIgZnJvbSBcIi4uLy4uL3NldHRpbmdzL3dhdGNoZXJzL1RoZW1lV2F0Y2hlclwiO1xuaW1wb3J0IHsgZ2V0Q3VzdG9tVGhlbWUgfSBmcm9tIFwiLi4vLi4vdGhlbWVcIjtcbmltcG9ydCB7IEVsZW1lbnRXaWRnZXRDYXBhYmlsaXRpZXMgfSBmcm9tIFwiLi9FbGVtZW50V2lkZ2V0Q2FwYWJpbGl0aWVzXCI7XG5pbXBvcnQgeyBFTEVNRU5UX0NMSUVOVF9JRCB9IGZyb20gXCIuLi8uLi9pZGVudGlmaWVyc1wiO1xuaW1wb3J0IHsgZ2V0VXNlckxhbmd1YWdlIH0gZnJvbSBcIi4uLy4uL2xhbmd1YWdlSGFuZGxlclwiO1xuaW1wb3J0IHsgV2lkZ2V0VmFyaWFibGVDdXN0b21pc2F0aW9ucyB9IGZyb20gXCIuLi8uLi9jdXN0b21pc2F0aW9ucy9XaWRnZXRWYXJpYWJsZXNcIjtcbmltcG9ydCB7IGFycmF5RmFzdENsb25lIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FycmF5c1wiO1xuaW1wb3J0IHsgVmlld1Jvb21QYXlsb2FkIH0gZnJvbSBcIi4uLy4uL2Rpc3BhdGNoZXIvcGF5bG9hZHMvVmlld1Jvb21QYXlsb2FkXCI7XG5pbXBvcnQgTW9kYWwgZnJvbSBcIi4uLy4uL01vZGFsXCI7XG5pbXBvcnQgRXJyb3JEaWFsb2cgZnJvbSBcIi4uLy4uL2NvbXBvbmVudHMvdmlld3MvZGlhbG9ncy9FcnJvckRpYWxvZ1wiO1xuaW1wb3J0IHsgU2RrQ29udGV4dENsYXNzIH0gZnJvbSBcIi4uLy4uL2NvbnRleHRzL1NES0NvbnRleHRcIjtcblxuLy8gVE9ETzogRGVzdHJveSBhbGwgb2YgdGhpcyBjb2RlXG5cbmludGVyZmFjZSBJQXBwVGlsZVByb3BzIHtcbiAgICAvLyBOb3RlOiB0aGVzZSBhcmUgb25seSB0aGUgcHJvcHMgd2UgY2FyZSBhYm91dFxuICAgIGFwcDogSUFwcCB8IElXaWRnZXQ7XG4gICAgcm9vbT86IFJvb207IC8vIHdpdGhvdXQgYSByb29tIGl0IGlzIGEgdXNlciB3aWRnZXRcbiAgICB1c2VySWQ6IHN0cmluZztcbiAgICBjcmVhdG9yVXNlcklkOiBzdHJpbmc7XG4gICAgd2FpdEZvcklmcmFtZUxvYWQ6IGJvb2xlYW47XG4gICAgd2hpdGVsaXN0Q2FwYWJpbGl0aWVzPzogc3RyaW5nW107XG4gICAgdXNlcldpZGdldDogYm9vbGVhbjtcbn1cblxuLy8gVE9ETzogRG9uJ3QgdXNlIHRoaXMgYmVjYXVzZSBpdCdzIHdyb25nXG5leHBvcnQgY2xhc3MgRWxlbWVudFdpZGdldCBleHRlbmRzIFdpZGdldCB7XG4gICAgcHVibGljIGNvbnN0cnVjdG9yKHByaXZhdGUgcmF3RGVmaW5pdGlvbjogSVdpZGdldCkge1xuICAgICAgICBzdXBlcihyYXdEZWZpbml0aW9uKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0IHRlbXBsYXRlVXJsKCk6IHN0cmluZyB7XG4gICAgICAgIGlmIChXaWRnZXRUeXBlLkpJVFNJLm1hdGNoZXModGhpcy50eXBlKSkge1xuICAgICAgICAgICAgcmV0dXJuIFdpZGdldFV0aWxzLmdldExvY2FsSml0c2lXcmFwcGVyVXJsKHtcbiAgICAgICAgICAgICAgICBmb3JMb2NhbFJlbmRlcjogdHJ1ZSxcbiAgICAgICAgICAgICAgICBhdXRoOiBzdXBlci5yYXdEYXRhPy5hdXRoIGFzIHN0cmluZywgLy8gdGhpcy5yYXdEYXRhIGNhbiBjYWxsIHRlbXBsYXRlVXJsLCBkbyB0aGlzIHRvIHByZXZlbnQgbG9vcGluZ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHN1cGVyLnRlbXBsYXRlVXJsO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXQgcG9wb3V0VGVtcGxhdGVVcmwoKTogc3RyaW5nIHtcbiAgICAgICAgaWYgKFdpZGdldFR5cGUuSklUU0kubWF0Y2hlcyh0aGlzLnR5cGUpKSB7XG4gICAgICAgICAgICByZXR1cm4gV2lkZ2V0VXRpbHMuZ2V0TG9jYWxKaXRzaVdyYXBwZXJVcmwoe1xuICAgICAgICAgICAgICAgIGZvckxvY2FsUmVuZGVyOiBmYWxzZSwgLy8gVGhlIG9ubHkgaW1wb3J0YW50IGRpZmZlcmVuY2UgYmV0d2VlbiB0aGlzIGFuZCB0ZW1wbGF0ZVVybCgpXG4gICAgICAgICAgICAgICAgYXV0aDogc3VwZXIucmF3RGF0YT8uYXV0aCBhcyBzdHJpbmcsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy50ZW1wbGF0ZVVybDsgLy8gdXNlIHRoaXMgaW5zdGVhZCBvZiBzdXBlciB0byBlbnN1cmUgd2UgZ2V0IGFwcHJvcHJpYXRlIHRlbXBsYXRpbmdcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0IHJhd0RhdGEoKTogSVdpZGdldERhdGEge1xuICAgICAgICBsZXQgY29uZmVyZW5jZUlkID0gc3VwZXIucmF3RGF0YVtcImNvbmZlcmVuY2VJZFwiXTtcbiAgICAgICAgaWYgKGNvbmZlcmVuY2VJZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyB3ZSdsbCBuZWVkIHRvIHBhcnNlIHRoZSBjb25mZXJlbmNlIElEIG91dCBvZiB0aGUgVVJMIGZvciB2MSBKaXRzaSB3aWRnZXRzXG4gICAgICAgICAgICBjb25zdCBwYXJzZWRVcmwgPSBuZXcgVVJMKHN1cGVyLnRlbXBsYXRlVXJsKTsgLy8gdXNlIHN1cGVyIHRvIGdldCB0aGUgcmF3IHdpZGdldCBVUkxcbiAgICAgICAgICAgIGNvbmZlcmVuY2VJZCA9IHBhcnNlZFVybC5zZWFyY2hQYXJhbXMuZ2V0KFwiY29uZklkXCIpO1xuICAgICAgICB9XG4gICAgICAgIGxldCBkb21haW4gPSBzdXBlci5yYXdEYXRhW1wiZG9tYWluXCJdO1xuICAgICAgICBpZiAoZG9tYWluID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vIHYxIHdpZGdldHMgZGVmYXVsdCB0byBtZWV0LmVsZW1lbnQuaW8gcmVnYXJkbGVzcyBvZiB1c2VyIHNldHRpbmdzXG4gICAgICAgICAgICBkb21haW4gPSBcIm1lZXQuZWxlbWVudC5pb1wiO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHRoZW1lID0gbmV3IFRoZW1lV2F0Y2hlcigpLmdldEVmZmVjdGl2ZVRoZW1lKCk7XG4gICAgICAgIGlmICh0aGVtZS5zdGFydHNXaXRoKFwiY3VzdG9tLVwiKSkge1xuICAgICAgICAgICAgY29uc3QgY3VzdG9tVGhlbWUgPSBnZXRDdXN0b21UaGVtZSh0aGVtZS5zbGljZSg3KSk7XG4gICAgICAgICAgICAvLyBKaXRzaSBvbmx5IHVuZGVyc3RhbmRzIGxpZ2h0L2RhcmtcbiAgICAgICAgICAgIHRoZW1lID0gY3VzdG9tVGhlbWUuaXNfZGFyayA/IFwiZGFya1wiIDogXCJsaWdodFwiO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gb25seSBhbGxvdyBsaWdodC9kYXJrIHRocm91Z2gsIGRlZmF1bHRpbmcgdG8gZGFyayBhcyB0aGF0IHdhcyBwcmV2aW91c2x5IHRoZSBvbmx5IHN0YXRlXG4gICAgICAgIC8vIGFjY291bnRzIGZvciBsZWdhY3ktbGlnaHQvbGVnYWN5LWRhcmsgdGhlbWVzIHRvb1xuICAgICAgICBpZiAodGhlbWUuaW5jbHVkZXMoXCJsaWdodFwiKSkge1xuICAgICAgICAgICAgdGhlbWUgPSBcImxpZ2h0XCI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGVtZSA9IFwiZGFya1wiO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC4uLnN1cGVyLnJhd0RhdGEsXG4gICAgICAgICAgICB0aGVtZSxcbiAgICAgICAgICAgIGNvbmZlcmVuY2VJZCxcbiAgICAgICAgICAgIGRvbWFpbixcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0Q29tcGxldGVVcmwocGFyYW1zOiBJVGVtcGxhdGVQYXJhbXMsIGFzUG9wb3V0ID0gZmFsc2UpOiBzdHJpbmcge1xuICAgICAgICByZXR1cm4gcnVuVGVtcGxhdGUoXG4gICAgICAgICAgICBhc1BvcG91dCA/IHRoaXMucG9wb3V0VGVtcGxhdGVVcmwgOiB0aGlzLnRlbXBsYXRlVXJsLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIC4uLnRoaXMucmF3RGVmaW5pdGlvbixcbiAgICAgICAgICAgICAgICBkYXRhOiB0aGlzLnJhd0RhdGEsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcGFyYW1zLFxuICAgICAgICApO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFN0b3BHYXBXaWRnZXQgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICAgIHByaXZhdGUgY2xpZW50OiBNYXRyaXhDbGllbnQ7XG4gICAgcHJpdmF0ZSBtZXNzYWdpbmc6IENsaWVudFdpZGdldEFwaSB8IG51bGwgPSBudWxsO1xuICAgIHByaXZhdGUgbW9ja1dpZGdldDogRWxlbWVudFdpZGdldDtcbiAgICBwcml2YXRlIHNjYWxhclRva2VuPzogc3RyaW5nO1xuICAgIHByaXZhdGUgcm9vbUlkPzogc3RyaW5nO1xuICAgIHByaXZhdGUga2luZDogV2lkZ2V0S2luZDtcbiAgICBwcml2YXRlIHJlYWRvbmx5IHZpcnR1YWw6IGJvb2xlYW47XG4gICAgcHJpdmF0ZSByZWFkVXBUb01hcDogeyBbcm9vbUlkOiBzdHJpbmddOiBzdHJpbmcgfSA9IHt9OyAvLyByb29tIElEIHRvIGV2ZW50IElEXG5cbiAgICBwdWJsaWMgY29uc3RydWN0b3IocHJpdmF0ZSBhcHBUaWxlUHJvcHM6IElBcHBUaWxlUHJvcHMpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5jbGllbnQgPSBNYXRyaXhDbGllbnRQZWcuZ2V0KCk7XG5cbiAgICAgICAgbGV0IGFwcCA9IGFwcFRpbGVQcm9wcy5hcHA7XG4gICAgICAgIC8vIEJhY2t3YXJkcyBjb21wYXRpYmlsaXR5OiBub3QgYWxsIG9sZCB3aWRnZXRzIGhhdmUgYSBjcmVhdG9yVXNlcklkXG4gICAgICAgIGlmICghYXBwLmNyZWF0b3JVc2VySWQpIHtcbiAgICAgICAgICAgIGFwcCA9IG9iamVjdFNoYWxsb3dDbG9uZShhcHApOyAvLyBjbG9uZSB0byBwcmV2ZW50IGFjY2lkZW50YWwgbXV0YXRpb25cbiAgICAgICAgICAgIGFwcC5jcmVhdG9yVXNlcklkID0gdGhpcy5jbGllbnQuZ2V0VXNlcklkKCkhO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5tb2NrV2lkZ2V0ID0gbmV3IEVsZW1lbnRXaWRnZXQoYXBwKTtcbiAgICAgICAgdGhpcy5yb29tSWQgPSBhcHBUaWxlUHJvcHMucm9vbT8ucm9vbUlkO1xuICAgICAgICB0aGlzLmtpbmQgPSBhcHBUaWxlUHJvcHMudXNlcldpZGdldCA/IFdpZGdldEtpbmQuQWNjb3VudCA6IFdpZGdldEtpbmQuUm9vbTsgLy8gcHJvYmFibHlcbiAgICAgICAgdGhpcy52aXJ0dWFsID0gaXNBcHBXaWRnZXQoYXBwKSAmJiBhcHAuZXZlbnRJZCA9PT0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHByaXZhdGUgZ2V0IGV2ZW50TGlzdGVuZXJSb29tSWQoKTogT3B0aW9uYWw8c3RyaW5nPiB7XG4gICAgICAgIC8vIFdoZW4gd2lkZ2V0cyBhcmUgbGlzdGVuaW5nIHRvIGV2ZW50cywgd2UgbmVlZCB0byBtYWtlIHN1cmUgdGhleSdyZSBvbmx5XG4gICAgICAgIC8vIHJlY2VpdmluZyBldmVudHMgZm9yIHRoZSByaWdodCByb29tLiBJbiBwYXJ0aWN1bGFyLCByb29tIHdpZGdldHMgZ2V0IGxvY2tlZFxuICAgICAgICAvLyB0byB0aGUgcm9vbSB0aGV5IHdlcmUgYWRkZWQgaW4gd2hpbGUgYWNjb3VudCB3aWRnZXRzIGxpc3RlbiB0byB0aGUgY3VycmVudGx5XG4gICAgICAgIC8vIGFjdGl2ZSByb29tLlxuXG4gICAgICAgIGlmICh0aGlzLnJvb21JZCkgcmV0dXJuIHRoaXMucm9vbUlkO1xuXG4gICAgICAgIHJldHVybiBTZGtDb250ZXh0Q2xhc3MuaW5zdGFuY2Uucm9vbVZpZXdTdG9yZS5nZXRSb29tSWQoKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0IHdpZGdldEFwaSgpOiBDbGllbnRXaWRnZXRBcGkgfCBudWxsIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubWVzc2FnaW5nO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBVUkwgdG8gdXNlIGluIHRoZSBpZnJhbWVcbiAgICAgKi9cbiAgICBwdWJsaWMgZ2V0IGVtYmVkVXJsKCk6IHN0cmluZyB7XG4gICAgICAgIHJldHVybiB0aGlzLnJ1blVybFRlbXBsYXRlKHsgYXNQb3BvdXQ6IGZhbHNlIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBVUkwgdG8gdXNlIGluIHRoZSBwb3BvdXRcbiAgICAgKi9cbiAgICBwdWJsaWMgZ2V0IHBvcG91dFVybCgpOiBzdHJpbmcge1xuICAgICAgICByZXR1cm4gdGhpcy5ydW5VcmxUZW1wbGF0ZSh7IGFzUG9wb3V0OiB0cnVlIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgcnVuVXJsVGVtcGxhdGUob3B0cyA9IHsgYXNQb3BvdXQ6IGZhbHNlIH0pOiBzdHJpbmcge1xuICAgICAgICBjb25zdCBmcm9tQ3VzdG9taXNhdGlvbiA9IFdpZGdldFZhcmlhYmxlQ3VzdG9taXNhdGlvbnM/LnByb3ZpZGVWYXJpYWJsZXM/LigpID8/IHt9O1xuICAgICAgICBjb25zdCBkZWZhdWx0czogSVRlbXBsYXRlUGFyYW1zID0ge1xuICAgICAgICAgICAgd2lkZ2V0Um9vbUlkOiB0aGlzLnJvb21JZCxcbiAgICAgICAgICAgIGN1cnJlbnRVc2VySWQ6IHRoaXMuY2xpZW50LmdldFVzZXJJZCgpISxcbiAgICAgICAgICAgIHVzZXJEaXNwbGF5TmFtZTogT3duUHJvZmlsZVN0b3JlLmluc3RhbmNlLmRpc3BsYXlOYW1lID8/IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHVzZXJIdHRwQXZhdGFyVXJsOiBPd25Qcm9maWxlU3RvcmUuaW5zdGFuY2UuZ2V0SHR0cEF2YXRhclVybCgpID8/IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIGNsaWVudElkOiBFTEVNRU5UX0NMSUVOVF9JRCxcbiAgICAgICAgICAgIGNsaWVudFRoZW1lOiBTZXR0aW5nc1N0b3JlLmdldFZhbHVlKFwidGhlbWVcIiksXG4gICAgICAgICAgICBjbGllbnRMYW5ndWFnZTogZ2V0VXNlckxhbmd1YWdlKCksXG4gICAgICAgICAgICBkZXZpY2VJZDogdGhpcy5jbGllbnQuZ2V0RGV2aWNlSWQoKSA/PyB1bmRlZmluZWQsXG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IHRlbXBsYXRlZCA9IHRoaXMubW9ja1dpZGdldC5nZXRDb21wbGV0ZVVybChPYmplY3QuYXNzaWduKGRlZmF1bHRzLCBmcm9tQ3VzdG9taXNhdGlvbiksIG9wdHM/LmFzUG9wb3V0KTtcbiAgICAgICAgY29uc3QgY2xpZW50ID0gTWF0cml4Q2xpZW50UGVnLmdldCgpO1xuICAgICAgICBjb25zdCByb29tSW5mbyA9IGNsaWVudC5nZXRSb29tKHRoaXMucm9vbUlkKTtcbiAgICAgICAgY29uc3QgdXNlckluZm8gPSB7XG4gICAgICAgICAgICB1c2VySWQ6IHJvb21JbmZvLm15VXNlcklkLFxuICAgICAgICAgICAgd2FsbGV0QWRkcmVzczogZXh0cmFjdFdhbGxldEFkZHJlc3Mocm9vbUluZm8ubXlVc2VySWQpLFxuICAgICAgICAgICAgZGlzcGxheU5hbWU6IHJvb21JbmZvLmdldE1lbWJlcihyb29tSW5mby5teVVzZXJJZCk/Lm5hbWUsXG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IHJvb21NZW1iZXJzID0gcm9vbUluZm8uZ2V0Sm9pbmVkTWVtYmVycygpO1xuICAgICAgICBjb25zdCBtZW1lYmVyc0luZm8gPSBbXTtcbiAgICAgICAgcm9vbU1lbWJlcnMuZm9yRWFjaCgobWVtYmVyKSA9PiB7XG4gICAgICAgICAgICBpZiAobWVtYmVyLnVzZXJJZCAhPT0gdXNlckluZm8udXNlcklkKSB7XG4gICAgICAgICAgICAgICAgbWVtZWJlcnNJbmZvLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICB1c2VySWQ6IG1lbWJlci51c2VySWQsXG4gICAgICAgICAgICAgICAgICAgIHdhbGxldEFkZHJlc3M6IGV4dHJhY3RXYWxsZXRBZGRyZXNzKG1lbWJlci51c2VySWQpLFxuICAgICAgICAgICAgICAgICAgICBkaXNwbGF5TmFtZTogbWVtYmVyLm5hbWUsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBjb25zb2xlLmxvZyhcInVzZXJJbmZvXCIsIHVzZXJJbmZvLCBtZW1lYmVyc0luZm8pO1xuICAgICAgICBcbiAgICAgICAgbGV0IHBhcnNlZCA9IG5ldyBVUkwodGVtcGxhdGVkKTtcbiAgICAgICAgaWYgKHBhcnNlZC5zZWFyY2guaW5jbHVkZXMoXCI/dXJsPWh0dHBzJTNBJTJGJTJGdGV4dHJwZGVtby5zMy5ldS1jZW50cmFsLTEuYW1hem9uYXdzLmNvbSUyRmluZGV4Lmh0bWxcIikpIHtcbiAgICAgICAgICAgIHBhcnNlZC5zZWFyY2g9ICBwYXJzZWQuc2VhcmNoLnJlcGxhY2UoXG4gICAgICAgICAgICAgICAgXCI/dXJsPWh0dHBzJTNBJTJGJTJGdGV4dHJwZGVtby5zMy5ldS1jZW50cmFsLTEuYW1hem9uYXdzLmNvbSUyRmluZGV4Lmh0bWxcIixcbiAgICAgICAgICAgICAgICBgP3VybD1odHRwcyUzQSUyRiUyRnRleHRycGRlbW8uczMuZXUtY2VudHJhbC0xLmFtYXpvbmF3cy5jb20lMkZpbmRleC5odG1sP3VzZXJJbmZvPSR7SlNPTi5zdHJpbmdpZnkodXNlckluZm8pfSUyNm1lbWViZXJzSW5mbz0ke0pTT04uc3RyaW5naWZ5KG1lbWViZXJzSW5mbyl9YCxcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQWRkIGluIHNvbWUgbGVnYWN5IHN1cHBvcnQgc3ByaW5rbGVzIChmb3Igbm9uLXBvcG91dCB3aWRnZXRzKVxuICAgICAgICAvLyBUT0RPOiBSZXBsYWNlIHRoZXNlIHdpdGggcHJvcGVyIHdpZGdldCBwYXJhbXNcbiAgICAgICAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9tYXRyaXgtb3JnL21hdHJpeC1kb2MvcHVsbC8xOTU4L2ZpbGVzI3I0MDU3MTQ4MzNcbiAgICAgICAgaWYgKCFvcHRzPy5hc1BvcG91dCkge1xuICAgICAgICAgICAgcGFyc2VkLnNlYXJjaFBhcmFtcy5zZXQoXCJ3aWRnZXRJZFwiLCB0aGlzLm1vY2tXaWRnZXQuaWQpO1xuICAgICAgICAgICAgcGFyc2VkLnNlYXJjaFBhcmFtcy5zZXQoXCJwYXJlbnRVcmxcIiwgd2luZG93LmxvY2F0aW9uLmhyZWYuc3BsaXQoXCIjXCIsIDIpWzBdKTtcblxuICAgICAgICAgICAgLy8gR2l2ZSB0aGUgd2lkZ2V0IGEgc2NhbGFyIHRva2VuIGlmIHdlJ3JlIHN1cHBvc2VkIHRvIChtb3JlIGxlZ2FjeSlcbiAgICAgICAgICAgIC8vIFRPRE86IFN0b3AgZG9pbmcgdGhpc1xuICAgICAgICAgICAgaWYgKHRoaXMuc2NhbGFyVG9rZW4pIHtcbiAgICAgICAgICAgICAgICBwYXJzZWQuc2VhcmNoUGFyYW1zLnNldChcInNjYWxhcl90b2tlblwiLCB0aGlzLnNjYWxhclRva2VuKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlcGxhY2UgdGhlIGVuY29kZWQgZG9sbGFyIHNpZ25zIGJhY2sgdG8gZG9sbGFyIHNpZ25zLiBUaGV5IGhhdmUgbm8gc3BlY2lhbCBtZWFuaW5nXG4gICAgICAgIC8vIGluIEhUVFAsIGJ1dCBVUkwgcGFyc2VycyBlbmNvZGUgdGhlbSBhbnl3YXlzLlxuICAgICAgICByZXR1cm4gcGFyc2VkLnRvU3RyaW5nKCkucmVwbGFjZSgvJTI0L2csIFwiJFwiKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0IGlzTWFuYWdlZEJ5TWFuYWdlcigpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuICEhdGhpcy5zY2FsYXJUb2tlbjtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0IHN0YXJ0ZWQoKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiAhIXRoaXMubWVzc2FnaW5nO1xuICAgIH1cblxuICAgIHByaXZhdGUgb25PcGVuTW9kYWwgPSBhc3luYyAoZXY6IEN1c3RvbUV2ZW50PElNb2RhbFdpZGdldE9wZW5SZXF1ZXN0Pik6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgICAgICBldi5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBpZiAoTW9kYWxXaWRnZXRTdG9yZS5pbnN0YW5jZS5jYW5PcGVuTW9kYWxXaWRnZXQoKSkge1xuICAgICAgICAgICAgTW9kYWxXaWRnZXRTdG9yZS5pbnN0YW5jZS5vcGVuTW9kYWxXaWRnZXQoZXYuZGV0YWlsLmRhdGEsIHRoaXMubW9ja1dpZGdldCwgdGhpcy5yb29tSWQpO1xuICAgICAgICAgICAgdGhpcy5tZXNzYWdpbmc/LnRyYW5zcG9ydC5yZXBseShldi5kZXRhaWwsIHt9KTsgLy8gYWNrXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLm1lc3NhZ2luZz8udHJhbnNwb3J0LnJlcGx5KGV2LmRldGFpbCwge1xuICAgICAgICAgICAgICAgIGVycm9yOiB7XG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IFwiVW5hYmxlIHRvIG9wZW4gbW9kYWwgYXQgdGhpcyB0aW1lXCIsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBUaGlzIHN0YXJ0cyB0aGUgbWVzc2FnaW5nIGZvciB0aGUgd2lkZ2V0IGlmIGl0IGlzIG5vdCBpbiB0aGUgc3RhdGUgYHN0YXJ0ZWRgIHlldC5cbiAgICAgKiBAcGFyYW0gaWZyYW1lIHRoZSBpZnJhbWUgdGhlIHdpZGdldCBzaG91bGQgdXNlXG4gICAgICovXG4gICAgcHVibGljIHN0YXJ0TWVzc2FnaW5nKGlmcmFtZTogSFRNTElGcmFtZUVsZW1lbnQpOiBhbnkge1xuICAgICAgICBpZiAodGhpcy5zdGFydGVkKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgYWxsb3dlZENhcGFiaWxpdGllcyA9IHRoaXMuYXBwVGlsZVByb3BzLndoaXRlbGlzdENhcGFiaWxpdGllcyB8fCBbXTtcbiAgICAgICAgY29uc3QgZHJpdmVyID0gbmV3IFN0b3BHYXBXaWRnZXREcml2ZXIoXG4gICAgICAgICAgICBhbGxvd2VkQ2FwYWJpbGl0aWVzLFxuICAgICAgICAgICAgdGhpcy5tb2NrV2lkZ2V0LFxuICAgICAgICAgICAgdGhpcy5raW5kLFxuICAgICAgICAgICAgdGhpcy52aXJ0dWFsLFxuICAgICAgICAgICAgdGhpcy5yb29tSWQsXG4gICAgICAgICk7XG5cbiAgICAgICAgdGhpcy5tZXNzYWdpbmcgPSBuZXcgQ2xpZW50V2lkZ2V0QXBpKHRoaXMubW9ja1dpZGdldCwgaWZyYW1lLCBkcml2ZXIpO1xuICAgICAgICB0aGlzLm1lc3NhZ2luZy5vbihcInByZXBhcmluZ1wiLCAoKSA9PiB0aGlzLmVtaXQoXCJwcmVwYXJpbmdcIikpO1xuICAgICAgICB0aGlzLm1lc3NhZ2luZy5vbihcInJlYWR5XCIsICgpID0+IHtcbiAgICAgICAgICAgIFdpZGdldE1lc3NhZ2luZ1N0b3JlLmluc3RhbmNlLnN0b3JlTWVzc2FnaW5nKHRoaXMubW9ja1dpZGdldCwgdGhpcy5yb29tSWQsIHRoaXMubWVzc2FnaW5nISk7XG4gICAgICAgICAgICB0aGlzLmVtaXQoXCJyZWFkeVwiKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMubWVzc2FnaW5nLm9uKFwiY2FwYWJpbGl0aWVzTm90aWZpZWRcIiwgKCkgPT4gdGhpcy5lbWl0KFwiY2FwYWJpbGl0aWVzTm90aWZpZWRcIikpO1xuICAgICAgICB0aGlzLm1lc3NhZ2luZy5vbihgYWN0aW9uOiR7V2lkZ2V0QXBpRnJvbVdpZGdldEFjdGlvbi5PcGVuTW9kYWxXaWRnZXR9YCwgdGhpcy5vbk9wZW5Nb2RhbCk7XG4gICAgICAgIHRoaXMubWVzc2FnaW5nLm9uKGBhY3Rpb246JHtFbGVtZW50V2lkZ2V0QWN0aW9ucy5Kb2luQ2FsbH1gLCAoKSA9PiB7XG4gICAgICAgICAgICAvLyBwYXVzZSB2b2ljZSBicm9hZGNhc3QgcmVjb3JkaW5nIHdoZW4gYW55IHdpZGdldCBzZW5kcyBhIFwiam9pblwiXG4gICAgICAgICAgICBTZGtDb250ZXh0Q2xhc3MuaW5zdGFuY2Uudm9pY2VCcm9hZGNhc3RSZWNvcmRpbmdzU3RvcmUuZ2V0Q3VycmVudCgpPy5wYXVzZSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBBbHdheXMgYXR0YWNoIGEgaGFuZGxlciBmb3IgVmlld1Jvb20sIGJ1dCBwZXJtaXNzaW9uIGNoZWNrIGl0IGludGVybmFsbHlcbiAgICAgICAgdGhpcy5tZXNzYWdpbmcub24oYGFjdGlvbjoke0VsZW1lbnRXaWRnZXRBY3Rpb25zLlZpZXdSb29tfWAsIChldjogQ3VzdG9tRXZlbnQ8SVZpZXdSb29tQXBpUmVxdWVzdD4pID0+IHtcbiAgICAgICAgICAgIGV2LnByZXZlbnREZWZhdWx0KCk7IC8vIHN0b3AgdGhlIHdpZGdldCBBUEkgZnJvbSBhdXRvLXJlamVjdGluZyB0aGlzXG5cbiAgICAgICAgICAgIC8vIENoZWNrIHVwIGZyb250IGlmIHRoaXMgaXMgZXZlbiBhIHZhbGlkIHJlcXVlc3RcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldFJvb21JZCA9IChldi5kZXRhaWwuZGF0YSB8fCB7fSkucm9vbV9pZDtcbiAgICAgICAgICAgIGlmICghdGFyZ2V0Um9vbUlkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWVzc2FnaW5nPy50cmFuc3BvcnQucmVwbHkoZXYuZGV0YWlsLCA8SVdpZGdldEFwaUVycm9yUmVzcG9uc2VEYXRhPntcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IHsgbWVzc2FnZTogXCJSb29tIElEIG5vdCBzdXBwbGllZC5cIiB9LFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDaGVjayB0aGUgd2lkZ2V0J3MgcGVybWlzc2lvblxuICAgICAgICAgICAgaWYgKCF0aGlzLm1lc3NhZ2luZz8uaGFzQ2FwYWJpbGl0eShFbGVtZW50V2lkZ2V0Q2FwYWJpbGl0aWVzLkNhbkNoYW5nZVZpZXdlZFJvb20pKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWVzc2FnaW5nPy50cmFuc3BvcnQucmVwbHkoZXYuZGV0YWlsLCA8SVdpZGdldEFwaUVycm9yUmVzcG9uc2VEYXRhPntcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IHsgbWVzc2FnZTogXCJUaGlzIHdpZGdldCBkb2VzIG5vdCBoYXZlIHBlcm1pc3Npb24gZm9yIHRoaXMgYWN0aW9uIChkZW5pZWQpLlwiIH0sXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGF0IHRoaXMgcG9pbnQgd2UgY2FuIGNoYW5nZSByb29tcywgc28gZG8gdGhhdFxuICAgICAgICAgICAgZGVmYXVsdERpc3BhdGNoZXIuZGlzcGF0Y2g8Vmlld1Jvb21QYXlsb2FkPih7XG4gICAgICAgICAgICAgICAgYWN0aW9uOiBBY3Rpb24uVmlld1Jvb20sXG4gICAgICAgICAgICAgICAgcm9vbV9pZDogdGFyZ2V0Um9vbUlkLFxuICAgICAgICAgICAgICAgIG1ldHJpY3NUcmlnZ2VyOiBcIldpZGdldFwiLFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIGFja25vd2xlZGdlIHNvIHRoZSB3aWRnZXQgZG9lc24ndCBmcmVhayBvdXRcbiAgICAgICAgICAgIHRoaXMubWVzc2FnaW5nLnRyYW5zcG9ydC5yZXBseShldi5kZXRhaWwsIDxJV2lkZ2V0QXBpUmVxdWVzdEVtcHR5RGF0YT57fSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFBvcHVsYXRlIHRoZSBtYXAgb2YgXCJyZWFkIHVwIHRvXCIgZXZlbnRzIGZvciB0aGlzIHdpZGdldCB3aXRoIHRoZSBjdXJyZW50IGV2ZW50IGluIGV2ZXJ5IHJvb20uXG4gICAgICAgIC8vIFRoaXMgaXMgYSBiaXQgaW5lZmZpY2llbnQsIGJ1dCBzaG91bGQgYmUgb2theS4gV2UgZG8gdGhpcyBmb3IgYWxsIHJvb21zIGluIGNhc2UgdGhlIHdpZGdldFxuICAgICAgICAvLyByZXF1ZXN0cyB0aW1lbGluZSBjYXBhYmlsaXRpZXMgaW4gb3RoZXIgcm9vbXMgZG93biB0aGUgcm9hZC4gSXQncyBqdXN0IGVhc2llciB0byBtYW5hZ2UgaGVyZS5cbiAgICAgICAgZm9yIChjb25zdCByb29tIG9mIHRoaXMuY2xpZW50LmdldFJvb21zKCkpIHtcbiAgICAgICAgICAgIC8vIFRpbWVsaW5lcyBhcmUgbW9zdCByZWNlbnQgbGFzdFxuICAgICAgICAgICAgY29uc3QgZXZlbnRzID0gcm9vbS5nZXRMaXZlVGltZWxpbmUoKT8uZ2V0RXZlbnRzKCkgfHwgW107XG4gICAgICAgICAgICBjb25zdCByb29tRXZlbnQgPSBldmVudHNbZXZlbnRzLmxlbmd0aCAtIDFdO1xuICAgICAgICAgICAgaWYgKCFyb29tRXZlbnQpIGNvbnRpbnVlOyAvLyBmb3JjZSBsYXRlciBjb2RlIHRvIHRoaW5rIHRoZSByb29tIGlzIGZyZXNoXG4gICAgICAgICAgICB0aGlzLnJlYWRVcFRvTWFwW3Jvb20ucm9vbUlkXSA9IHJvb21FdmVudC5nZXRJZCgpITtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEF0dGFjaCBsaXN0ZW5lcnMgZm9yIGZlZWRpbmcgZXZlbnRzIC0gdGhlIHVuZGVybHlpbmcgd2lkZ2V0IGNsYXNzZXMgaGFuZGxlIHBlcm1pc3Npb25zIGZvciB1c1xuICAgICAgICB0aGlzLmNsaWVudC5vbihDbGllbnRFdmVudC5FdmVudCwgdGhpcy5vbkV2ZW50KTtcbiAgICAgICAgdGhpcy5jbGllbnQub24oTWF0cml4RXZlbnRFdmVudC5EZWNyeXB0ZWQsIHRoaXMub25FdmVudERlY3J5cHRlZCk7XG4gICAgICAgIHRoaXMuY2xpZW50Lm9uKENsaWVudEV2ZW50LlRvRGV2aWNlRXZlbnQsIHRoaXMub25Ub0RldmljZUV2ZW50KTtcblxuICAgICAgICB0aGlzLm1lc3NhZ2luZy5vbihcbiAgICAgICAgICAgIGBhY3Rpb246JHtXaWRnZXRBcGlGcm9tV2lkZ2V0QWN0aW9uLlVwZGF0ZUFsd2F5c09uU2NyZWVufWAsXG4gICAgICAgICAgICAoZXY6IEN1c3RvbUV2ZW50PElTdGlja3lBY3Rpb25SZXF1ZXN0PikgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLm1lc3NhZ2luZz8uaGFzQ2FwYWJpbGl0eShNYXRyaXhDYXBhYmlsaXRpZXMuQWx3YXlzT25TY3JlZW4pKSB7XG4gICAgICAgICAgICAgICAgICAgIEFjdGl2ZVdpZGdldFN0b3JlLmluc3RhbmNlLnNldFdpZGdldFBlcnNpc3RlbmNlKFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tb2NrV2lkZ2V0LmlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yb29tSWQgPz8gbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2LmRldGFpbC5kYXRhLnZhbHVlLFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICBldi5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm1lc3NhZ2luZy50cmFuc3BvcnQucmVwbHkoZXYuZGV0YWlsLCA8SVdpZGdldEFwaVJlcXVlc3RFbXB0eURhdGE+e30pOyAvLyBhY2tcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICApO1xuXG4gICAgICAgIC8vIFRPRE86IFJlcGxhY2UgdGhpcyBldmVudCBsaXN0ZW5lciB3aXRoIGFwcHJvcHJpYXRlIGRyaXZlciBmdW5jdGlvbmFsaXR5IG9uY2UgdGhlIEFQSVxuICAgICAgICAvLyBlc3RhYmxpc2hlcyBhIHNhbmUgd2F5IHRvIHNlbmQgZXZlbnRzIGJhY2sgYW5kIGZvcnRoLlxuICAgICAgICB0aGlzLm1lc3NhZ2luZy5vbihcbiAgICAgICAgICAgIGBhY3Rpb246JHtXaWRnZXRBcGlGcm9tV2lkZ2V0QWN0aW9uLlNlbmRTdGlja2VyfWAsXG4gICAgICAgICAgICAoZXY6IEN1c3RvbUV2ZW50PElTdGlja2VyQWN0aW9uUmVxdWVzdD4pID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tZXNzYWdpbmc/Lmhhc0NhcGFiaWxpdHkoTWF0cml4Q2FwYWJpbGl0aWVzLlN0aWNrZXJTZW5kaW5nKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBBY2tub3dsZWRnZSBmaXJzdFxuICAgICAgICAgICAgICAgICAgICBldi5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm1lc3NhZ2luZy50cmFuc3BvcnQucmVwbHkoZXYuZGV0YWlsLCA8SVdpZGdldEFwaVJlcXVlc3RFbXB0eURhdGE+e30pO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFNlbmQgdGhlIHN0aWNrZXJcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdERpc3BhdGNoZXIuZGlzcGF0Y2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgYWN0aW9uOiBcIm0uc3RpY2tlclwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogZXYuZGV0YWlsLmRhdGEsXG4gICAgICAgICAgICAgICAgICAgICAgICB3aWRnZXRJZDogdGhpcy5tb2NrV2lkZ2V0LmlkLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICApO1xuXG4gICAgICAgIGlmIChXaWRnZXRUeXBlLlNUSUNLRVJQSUNLRVIubWF0Y2hlcyh0aGlzLm1vY2tXaWRnZXQudHlwZSkpIHtcbiAgICAgICAgICAgIHRoaXMubWVzc2FnaW5nLm9uKFxuICAgICAgICAgICAgICAgIGBhY3Rpb246JHtFbGVtZW50V2lkZ2V0QWN0aW9ucy5PcGVuSW50ZWdyYXRpb25NYW5hZ2VyfWAsXG4gICAgICAgICAgICAgICAgKGV2OiBDdXN0b21FdmVudDxJV2lkZ2V0QXBpUmVxdWVzdD4pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQWNrbm93bGVkZ2UgZmlyc3RcbiAgICAgICAgICAgICAgICAgICAgZXYucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tZXNzYWdpbmc/LnRyYW5zcG9ydC5yZXBseShldi5kZXRhaWwsIDxJV2lkZ2V0QXBpUmVxdWVzdEVtcHR5RGF0YT57fSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gRmlyc3QgY2xvc2UgdGhlIHN0aWNrZXJwaWNrZXJcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdERpc3BhdGNoZXIuZGlzcGF0Y2goeyBhY3Rpb246IFwic3RpY2tlcnBpY2tlcl9jbG9zZVwiIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIE5vdyBvcGVuIHRoZSBpbnRlZ3JhdGlvbiBtYW5hZ2VyXG4gICAgICAgICAgICAgICAgICAgIC8vIFRPRE86IFNwZWMgdGhpcyBpbnRlcmFjdGlvbi5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IGV2LmRldGFpbC5kYXRhO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbnRlZ1R5cGUgPSBkYXRhPy5pbnRlZ1R5cGUgYXMgc3RyaW5nO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbnRlZ0lkID0gPHN0cmluZz5kYXRhPy5pbnRlZ0lkO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJvb21JZCA9IFNka0NvbnRleHRDbGFzcy5pbnN0YW5jZS5yb29tVmlld1N0b3JlLmdldFJvb21JZCgpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByb29tID0gcm9vbUlkID8gdGhpcy5jbGllbnQuZ2V0Um9vbShyb29tSWQpIDogdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXJvb20pIHJldHVybjtcblxuICAgICAgICAgICAgICAgICAgICAvLyBub2luc3BlY3Rpb24gSlNJZ25vcmVkUHJvbWlzZUZyb21DYWxsXG4gICAgICAgICAgICAgICAgICAgIEludGVncmF0aW9uTWFuYWdlcnMuc2hhcmVkSW5zdGFuY2UoKT8uZ2V0UHJpbWFyeU1hbmFnZXIoKT8ub3Blbihyb29tLCBgdHlwZV8ke2ludGVnVHlwZX1gLCBpbnRlZ0lkKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChXaWRnZXRUeXBlLkpJVFNJLm1hdGNoZXModGhpcy5tb2NrV2lkZ2V0LnR5cGUpKSB7XG4gICAgICAgICAgICB0aGlzLm1lc3NhZ2luZy5vbihgYWN0aW9uOiR7RWxlbWVudFdpZGdldEFjdGlvbnMuSGFuZ3VwQ2FsbH1gLCAoZXY6IEN1c3RvbUV2ZW50PElIYW5ndXBDYWxsQXBpUmVxdWVzdD4pID0+IHtcbiAgICAgICAgICAgICAgICBldi5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgIGlmIChldi5kZXRhaWwuZGF0YT8uZXJyb3JNZXNzYWdlKSB7XG4gICAgICAgICAgICAgICAgICAgIE1vZGFsLmNyZWF0ZURpYWxvZyhFcnJvckRpYWxvZywge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6IF90KFwiQ29ubmVjdGlvbiBsb3N0XCIpLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IF90KFwiWW91IHdlcmUgZGlzY29ubmVjdGVkIGZyb20gdGhlIGNhbGwuIChFcnJvcjogJShtZXNzYWdlKXMpXCIsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBldi5kZXRhaWwuZGF0YS5lcnJvck1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMubWVzc2FnaW5nPy50cmFuc3BvcnQucmVwbHkoZXYuZGV0YWlsLCA8SVdpZGdldEFwaVJlcXVlc3RFbXB0eURhdGE+e30pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgcHJlcGFyZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgLy8gRW5zdXJlIHRoZSB2YXJpYWJsZXMgYXJlIHJlYWR5IGZvciB1cyB0byBiZSByZW5kZXJlZCBiZWZvcmUgY29udGludWluZ1xuICAgICAgICBhd2FpdCAoV2lkZ2V0VmFyaWFibGVDdXN0b21pc2F0aW9ucz8uaXNSZWFkeT8uKCkgPz8gUHJvbWlzZS5yZXNvbHZlKCkpO1xuXG4gICAgICAgIGlmICh0aGlzLnNjYWxhclRva2VuKSByZXR1cm47XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nTWVzc2FnaW5nID0gV2lkZ2V0TWVzc2FnaW5nU3RvcmUuaW5zdGFuY2UuZ2V0TWVzc2FnaW5nKHRoaXMubW9ja1dpZGdldCwgdGhpcy5yb29tSWQpO1xuICAgICAgICBpZiAoZXhpc3RpbmdNZXNzYWdpbmcpIHRoaXMubWVzc2FnaW5nID0gZXhpc3RpbmdNZXNzYWdpbmc7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAoV2lkZ2V0VXRpbHMuaXNTY2FsYXJVcmwodGhpcy5tb2NrV2lkZ2V0LnRlbXBsYXRlVXJsKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1hbmFnZXJzID0gSW50ZWdyYXRpb25NYW5hZ2Vycy5zaGFyZWRJbnN0YW5jZSgpO1xuICAgICAgICAgICAgICAgIGlmIChtYW5hZ2Vycy5oYXNNYW5hZ2VyKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogUGljayB0aGUgcmlnaHQgbWFuYWdlciBmb3IgdGhlIHdpZGdldFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkZWZhdWx0TWFuYWdlciA9IG1hbmFnZXJzLmdldFByaW1hcnlNYW5hZ2VyKCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkZWZhdWx0TWFuYWdlciAmJiBXaWRnZXRVdGlscy5pc1NjYWxhclVybChkZWZhdWx0TWFuYWdlci5hcGlVcmwpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzY2FsYXIgPSBkZWZhdWx0TWFuYWdlci5nZXRTY2FsYXJDbGllbnQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2NhbGFyVG9rZW4gPSBhd2FpdCBzY2FsYXIuZ2V0U2NhbGFyVG9rZW4oKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgLy8gQWxsIGVycm9ycyBhcmUgbm9uLWZhdGFsXG4gICAgICAgICAgICBsb2dnZXIuZXJyb3IoXCJFcnJvciBwcmVwYXJpbmcgd2lkZ2V0IGNvbW11bmljYXRpb25zOiBcIiwgZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdG9wcyB0aGUgd2lkZ2V0IG1lc3NhZ2luZyBmb3IgaWYgaXQgaXMgc3RhcnRlZC4gU2tpcHMgc3RvcHBpbmcgaWYgaXQgaXMgYW4gYWN0aXZlXG4gICAgICogd2lkZ2V0LlxuICAgICAqIEBwYXJhbSBvcHRzXG4gICAgICovXG4gICAgcHVibGljIHN0b3BNZXNzYWdpbmcob3B0cyA9IHsgZm9yY2VEZXN0cm95OiBmYWxzZSB9KTogdm9pZCB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAgICFvcHRzPy5mb3JjZURlc3Ryb3kgJiZcbiAgICAgICAgICAgIEFjdGl2ZVdpZGdldFN0b3JlLmluc3RhbmNlLmdldFdpZGdldFBlcnNpc3RlbmNlKHRoaXMubW9ja1dpZGdldC5pZCwgdGhpcy5yb29tSWQgPz8gbnVsbClcbiAgICAgICAgKSB7XG4gICAgICAgICAgICBsb2dnZXIubG9nKFwiU2tpcHBpbmcgZGVzdHJveSAtIHBlcnNpc3RlbnQgd2lkZ2V0XCIpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICghdGhpcy5zdGFydGVkKSByZXR1cm47XG4gICAgICAgIFdpZGdldE1lc3NhZ2luZ1N0b3JlLmluc3RhbmNlLnN0b3BNZXNzYWdpbmcodGhpcy5tb2NrV2lkZ2V0LCB0aGlzLnJvb21JZCk7XG4gICAgICAgIHRoaXMubWVzc2FnaW5nID0gbnVsbDtcblxuICAgICAgICB0aGlzLmNsaWVudC5vZmYoQ2xpZW50RXZlbnQuRXZlbnQsIHRoaXMub25FdmVudCk7XG4gICAgICAgIHRoaXMuY2xpZW50Lm9mZihNYXRyaXhFdmVudEV2ZW50LkRlY3J5cHRlZCwgdGhpcy5vbkV2ZW50RGVjcnlwdGVkKTtcbiAgICAgICAgdGhpcy5jbGllbnQub2ZmKENsaWVudEV2ZW50LlRvRGV2aWNlRXZlbnQsIHRoaXMub25Ub0RldmljZUV2ZW50KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIG9uRXZlbnQgPSAoZXY6IE1hdHJpeEV2ZW50KTogdm9pZCA9PiB7XG4gICAgICAgIHRoaXMuY2xpZW50LmRlY3J5cHRFdmVudElmTmVlZGVkKGV2KTtcbiAgICAgICAgaWYgKGV2LmlzQmVpbmdEZWNyeXB0ZWQoKSB8fCBldi5pc0RlY3J5cHRpb25GYWlsdXJlKCkpIHJldHVybjtcbiAgICAgICAgdGhpcy5mZWVkRXZlbnQoZXYpO1xuICAgIH07XG5cbiAgICBwcml2YXRlIG9uRXZlbnREZWNyeXB0ZWQgPSAoZXY6IE1hdHJpeEV2ZW50KTogdm9pZCA9PiB7XG4gICAgICAgIGlmIChldi5pc0RlY3J5cHRpb25GYWlsdXJlKCkpIHJldHVybjtcbiAgICAgICAgdGhpcy5mZWVkRXZlbnQoZXYpO1xuICAgIH07XG5cbiAgICBwcml2YXRlIG9uVG9EZXZpY2VFdmVudCA9IGFzeW5jIChldjogTWF0cml4RXZlbnQpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgICAgYXdhaXQgdGhpcy5jbGllbnQuZGVjcnlwdEV2ZW50SWZOZWVkZWQoZXYpO1xuICAgICAgICBpZiAoZXYuaXNEZWNyeXB0aW9uRmFpbHVyZSgpKSByZXR1cm47XG4gICAgICAgIGF3YWl0IHRoaXMubWVzc2FnaW5nPy5mZWVkVG9EZXZpY2UoZXYuZ2V0RWZmZWN0aXZlRXZlbnQoKSBhcyBJUm9vbUV2ZW50LCBldi5pc0VuY3J5cHRlZCgpKTtcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBmZWVkRXZlbnQoZXY6IE1hdHJpeEV2ZW50KTogdm9pZCB7XG4gICAgICAgIGlmICghdGhpcy5tZXNzYWdpbmcpIHJldHVybjtcblxuICAgICAgICAvLyBDaGVjayB0byBzZWUgaWYgdGhpcyBldmVudCB3b3VsZCBiZSBiZWZvcmUgb3IgYWZ0ZXIgb3VyIFwicmVhZCB1cCB0b1wiIG1hcmtlci4gSWYgaXQnc1xuICAgICAgICAvLyBiZWZvcmUsIG9yIHdlIGNhbid0IGRlY2lkZSwgdGhlbiB3ZSBhc3N1bWUgdGhlIHdpZGdldCB3aWxsIGhhdmUgYWxyZWFkeSBzZWVuIHRoZSBldmVudC5cbiAgICAgICAgLy8gSWYgdGhlIGV2ZW50IGlzIGFmdGVyLCBvciB3ZSBkb24ndCBoYXZlIGEgbWFya2VyIGZvciB0aGUgcm9vbSwgdGhlbiB3ZSdsbCBzZW5kIGl0IHRocm91Z2guXG4gICAgICAgIC8vXG4gICAgICAgIC8vIFRoaXMgYXBwcm9hY2ggb2YgXCJyZWFkIHVwIHRvXCIgcHJldmVudHMgd2lkZ2V0cyByZWNlaXZpbmcgZGVjcnlwdGlvbiBzcGFtIGZyb20gc3RhcnR1cCBvclxuICAgICAgICAvLyByZWNlaXZpbmcgb3V0LW9mLW9yZGVyIGV2ZW50cyBmcm9tIGJhY2tmaWxsIGFuZCBzdWNoLlxuICAgICAgICBjb25zdCB1cFRvRXZlbnRJZCA9IHRoaXMucmVhZFVwVG9NYXBbZXYuZ2V0Um9vbUlkKCkhXTtcbiAgICAgICAgaWYgKHVwVG9FdmVudElkKSB7XG4gICAgICAgICAgICAvLyBTbWFsbCBvcHRpbWl6YXRpb24gZm9yIGV4YWN0IG1hdGNoIChwcmV2ZW50IHNlYXJjaClcbiAgICAgICAgICAgIGlmICh1cFRvRXZlbnRJZCA9PT0gZXYuZ2V0SWQoKSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IGlzQmVmb3JlTWFyayA9IHRydWU7XG5cbiAgICAgICAgICAgIGNvbnN0IHJvb20gPSB0aGlzLmNsaWVudC5nZXRSb29tKGV2LmdldFJvb21JZCgpISk7XG4gICAgICAgICAgICBpZiAoIXJvb20pIHJldHVybjtcbiAgICAgICAgICAgIC8vIFRpbWVsaW5lcyBhcmUgbW9zdCByZWNlbnQgbGFzdCwgc28gcmV2ZXJzZSB0aGUgb3JkZXIgYW5kIGxpbWl0IG91cnNlbHZlcyB0byAxMDAgZXZlbnRzXG4gICAgICAgICAgICAvLyB0byBhdm9pZCBvdmVydXNpbmcgdGhlIENQVS5cbiAgICAgICAgICAgIGNvbnN0IHRpbWVsaW5lID0gcm9vbS5nZXRMaXZlVGltZWxpbmUoKTtcbiAgICAgICAgICAgIGNvbnN0IGV2ZW50cyA9IGFycmF5RmFzdENsb25lKHRpbWVsaW5lLmdldEV2ZW50cygpKS5yZXZlcnNlKCkuc2xpY2UoMCwgMTAwKTtcblxuICAgICAgICAgICAgZm9yIChjb25zdCB0aW1lbGluZUV2ZW50IG9mIGV2ZW50cykge1xuICAgICAgICAgICAgICAgIGlmICh0aW1lbGluZUV2ZW50LmdldElkKCkgPT09IHVwVG9FdmVudElkKSB7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodGltZWxpbmVFdmVudC5nZXRJZCgpID09PSBldi5nZXRJZCgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlzQmVmb3JlTWFyayA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChpc0JlZm9yZU1hcmspIHtcbiAgICAgICAgICAgICAgICAvLyBJZ25vcmUgdGhlIGV2ZW50OiBpdCBpcyBiZWZvcmUgb3VyIGludGVyZXN0LlxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNraXAgbWFya2VyIGFzc2lnbm1lbnQgaWYgbWVtYmVyc2hpcCBpcyAnaW52aXRlJywgb3RoZXJ3aXNlICdtLnJvb20ubWVtYmVyJyBmcm9tXG4gICAgICAgIC8vIGludml0YXRpb24gcm9vbSB3aWxsIGFzc2lnbiBpdCBhbmQgbmV3IHN0YXRlIGV2ZW50cyB3aWxsIGJlIG5vdCBmb3J3YXJkZWQgdG8gdGhlIHdpZGdldFxuICAgICAgICAvLyBiZWNhdXNlIG9mIGVtcHR5IHRpbWVsaW5lIGZvciBpbnZpdGF0aW9uIHJvb20gYW5kIGFzc2lnbmVkIG1hcmtlci5cbiAgICAgICAgY29uc3QgZXZSb29tSWQgPSBldi5nZXRSb29tSWQoKTtcbiAgICAgICAgY29uc3QgZXZJZCA9IGV2LmdldElkKCk7XG4gICAgICAgIGlmIChldlJvb21JZCAmJiBldklkKSB7XG4gICAgICAgICAgICBjb25zdCByb29tID0gdGhpcy5jbGllbnQuZ2V0Um9vbShldlJvb21JZCk7XG4gICAgICAgICAgICBpZiAocm9vbSAmJiByb29tLmdldE15TWVtYmVyc2hpcCgpID09PSBcImpvaW5cIikge1xuICAgICAgICAgICAgICAgIHRoaXMucmVhZFVwVG9NYXBbZXZSb29tSWRdID0gZXZJZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJhdyA9IGV2LmdldEVmZmVjdGl2ZUV2ZW50KCk7XG4gICAgICAgIHRoaXMubWVzc2FnaW5nLmZlZWRFdmVudChyYXcgYXMgSVJvb21FdmVudCwgdGhpcy5ldmVudExpc3RlbmVyUm9vbUlkISkuY2F0Y2goKGUpID0+IHtcbiAgICAgICAgICAgIGxvZ2dlci5lcnJvcihcIkVycm9yIHNlbmRpbmcgZXZlbnQgdG8gd2lkZ2V0OiBcIiwgZSk7XG4gICAgICAgIH0pO1xuICAgIH1cbn1cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFpQkEsSUFBQUEsZ0JBQUEsR0FBQUMsT0FBQTtBQUNBLElBQUFDLGdCQUFBLEdBQUFELE9BQUE7QUFtQkEsSUFBQUUsT0FBQSxHQUFBRixPQUFBO0FBRUEsSUFBQUcsTUFBQSxHQUFBSCxPQUFBO0FBQ0EsSUFBQUksT0FBQSxHQUFBSixPQUFBO0FBQ0EsSUFBQUssT0FBQSxHQUFBTCxPQUFBO0FBRUEsSUFBQU0sZ0JBQUEsR0FBQU4sT0FBQTtBQUNBLElBQUFPLG9CQUFBLEdBQUFQLE9BQUE7QUFDQSxJQUFBUSxxQkFBQSxHQUFBUixPQUFBO0FBQ0EsSUFBQVMsZ0JBQUEsR0FBQVQsT0FBQTtBQUNBLElBQUFVLGdCQUFBLEdBQUFWLE9BQUE7QUFDQSxJQUFBVyxZQUFBLEdBQUFDLHNCQUFBLENBQUFaLE9BQUE7QUFDQSxJQUFBYSxvQkFBQSxHQUFBYixPQUFBO0FBQ0EsSUFBQWMsY0FBQSxHQUFBRixzQkFBQSxDQUFBWixPQUFBO0FBQ0EsSUFBQWUsV0FBQSxHQUFBZixPQUFBO0FBQ0EsSUFBQWdCLGtCQUFBLEdBQUFKLHNCQUFBLENBQUFaLE9BQUE7QUFDQSxJQUFBaUIsUUFBQSxHQUFBakIsT0FBQTtBQUNBLElBQUFrQixXQUFBLEdBQUFOLHNCQUFBLENBQUFaLE9BQUE7QUFDQSxJQUFBbUIsUUFBQSxHQUFBbkIsT0FBQTtBQUNBLElB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