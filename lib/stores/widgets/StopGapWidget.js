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

      // Add auth_provider from profile store
      const authProvider = _OwnProfileStore.OwnProfileStore.instance.authProvider || "unknown";
      parsed.searchParams.set("authProvider", authProvider);

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfcGF5bWVudFNlcnZpY2VzIiwicmVxdWlyZSIsIl9tYXRyaXhXaWRnZXRBcGkiLCJfZXZlbnRzIiwiX2V2ZW50IiwiX2xvZ2dlciIsIl9jbGllbnQiLCJfbGFuZ3VhZ2VIYW5kbGVyIiwiX1N0b3BHYXBXaWRnZXREcml2ZXIiLCJfV2lkZ2V0TWVzc2FnaW5nU3RvcmUiLCJfTWF0cml4Q2xpZW50UGVnIiwiX093blByb2ZpbGVTdG9yZSIsIl9XaWRnZXRVdGlscyIsIl9pbnRlcm9wUmVxdWlyZURlZmF1bHQiLCJfSW50ZWdyYXRpb25NYW5hZ2VycyIsIl9TZXR0aW5nc1N0b3JlIiwiX1dpZGdldFR5cGUiLCJfQWN0aXZlV2lkZ2V0U3RvcmUiLCJfb2JqZWN0cyIsIl9kaXNwYXRjaGVyIiwiX2FjdGlvbnMiLCJfRWxlbWVudFdpZGdldEFjdGlvbnMiLCJfTW9kYWxXaWRnZXRTdG9yZSIsIl9XaWRnZXRTdG9yZSIsIl9UaGVtZVdhdGNoZXIiLCJfdGhlbWUiLCJfRWxlbWVudFdpZGdldENhcGFiaWxpdGllcyIsIl9pZGVudGlmaWVycyIsIl9XaWRnZXRWYXJpYWJsZXMiLCJfYXJyYXlzIiwiX01vZGFsIiwiX0Vycm9yRGlhbG9nIiwiX1NES0NvbnRleHQiLCJvd25LZXlzIiwib2JqZWN0IiwiZW51bWVyYWJsZU9ubHkiLCJrZXlzIiwiT2JqZWN0IiwiZ2V0T3duUHJvcGVydHlTeW1ib2xzIiwic3ltYm9scyIsImZpbHRlciIsInN5bSIsImdldE93blByb3BlcnR5RGVzY3JpcHRvciIsImVudW1lcmFibGUiLCJwdXNoIiwiYXBwbHkiLCJfb2JqZWN0U3ByZWFkIiwidGFyZ2V0IiwiaSIsImFyZ3VtZW50cyIsImxlbmd0aCIsInNvdXJjZSIsImZvckVhY2giLCJrZXkiLCJfZGVmaW5lUHJvcGVydHkyIiwiZGVmYXVsdCIsImdldE93blByb3BlcnR5RGVzY3JpcHRvcnMiLCJkZWZpbmVQcm9wZXJ0aWVzIiwiZGVmaW5lUHJvcGVydHkiLCJFbGVtZW50V2lkZ2V0IiwiV2lkZ2V0IiwiY29uc3RydWN0b3IiLCJyYXdEZWZpbml0aW9uIiwidGVtcGxhdGVVcmwiLCJXaWRnZXRUeXBlIiwiSklUU0kiLCJtYXRjaGVzIiwidHlwZSIsIldpZGdldFV0aWxzIiwiZ2V0TG9jYWxKaXRzaVdyYXBwZXJVcmwiLCJmb3JMb2NhbFJlbmRlciIsImF1dGgiLCJyYXdEYXRhIiwicG9wb3V0VGVtcGxhdGVVcmwiLCJjb25mZXJlbmNlSWQiLCJ1bmRlZmluZWQiLCJwYXJzZWRVcmwiLCJVUkwiLCJzZWFyY2hQYXJhbXMiLCJnZXQiLCJkb21haW4iLCJ0aGVtZSIsIlRoZW1lV2F0Y2hlciIsImdldEVmZmVjdGl2ZVRoZW1lIiwic3RhcnRzV2l0aCIsImN1c3RvbVRoZW1lIiwiZ2V0Q3VzdG9tVGhlbWUiLCJzbGljZSIsImlzX2RhcmsiLCJpbmNsdWRlcyIsImdldENvbXBsZXRlVXJsIiwicGFyYW1zIiwiYXNQb3BvdXQiLCJydW5UZW1wbGF0ZSIsImRhdGEiLCJleHBvcnRzIiwiU3RvcEdhcFdpZGdldCIsIkV2ZW50RW1pdHRlciIsImFwcFRpbGVQcm9wcyIsImV2IiwicHJldmVudERlZmF1bHQiLCJNb2RhbFdpZGdldFN0b3JlIiwiaW5zdGFuY2UiLCJjYW5PcGVuTW9kYWxXaWRnZXQiLCJvcGVuTW9kYWxXaWRnZXQiLCJkZXRhaWwiLCJtb2NrV2lkZ2V0Iiwicm9vbUlkIiwibWVzc2FnaW5nIiwidHJhbnNwb3J0IiwicmVwbHkiLCJlcnJvciIsIm1lc3NhZ2UiLCJjbGllbnQiLCJkZWNyeXB0RXZlbnRJZk5lZWRlZCIsImlzQmVpbmdEZWNyeXB0ZWQiLCJpc0RlY3J5cHRpb25GYWlsdXJlIiwiZmVlZEV2ZW50IiwiZmVlZFRvRGV2aWNlIiwiZ2V0RWZmZWN0aXZlRXZlbnQiLCJpc0VuY3J5cHRlZCIsIk1hdHJpeENsaWVudFBlZyIsImNvbnNvbGUiLCJsb2ciLCJhcHAiLCJjcmVhdG9yVXNlcklkIiwib2JqZWN0U2hhbGxvd0Nsb25lIiwiZ2V0VXNlcklkIiwicm9vbSIsImtpbmQiLCJ1c2VyV2lkZ2V0IiwiV2lkZ2V0S2luZCIsIkFjY291bnQiLCJSb29tIiwidmlydHVhbCIsImlzQXBwV2lkZ2V0IiwiZXZlbnRJZCIsImV2ZW50TGlzdGVuZXJSb29tSWQiLCJTZGtDb250ZXh0Q2xhc3MiLCJyb29tVmlld1N0b3JlIiwiZ2V0Um9vbUlkIiwid2lkZ2V0QXBpIiwiZW1iZWRVcmwiLCJydW5VcmxUZW1wbGF0ZSIsInBvcG91dFVybCIsIm9wdHMiLCJmcm9tQ3VzdG9taXNhdGlvbiIsIldpZGdldFZhcmlhYmxlQ3VzdG9taXNhdGlvbnMiLCJwcm92aWRlVmFyaWFibGVzIiwiZGVmYXVsdHMiLCJ3aWRnZXRSb29tSWQiLCJjdXJyZW50VXNlcklkIiwidXNlckRpc3BsYXlOYW1lIiwiT3duUHJvZmlsZVN0b3JlIiwiZGlzcGxheU5hbWUiLCJ1c2VySHR0cEF2YXRhclVybCIsImdldEh0dHBBdmF0YXJVcmwiLCJjbGllbnRJZCIsIkVMRU1FTlRfQ0xJRU5UX0lEIiwiY2xpZW50VGhlbWUiLCJTZXR0aW5nc1N0b3JlIiwiZ2V0VmFsdWUiLCJjbGllbnRMYW5ndWFnZSIsImdldFVzZXJMYW5ndWFnZSIsImRldmljZUlkIiwiZ2V0RGV2aWNlSWQiLCJ0ZW1wbGF0ZWQiLCJhc3NpZ24iLCJyb29tSW5mbyIsImdldFJvb20iLCJ1c2VySW5mbyIsInVzZXJJZCIsIm15VXNlcklkIiwid2FsbGV0QWRkcmVzcyIsImV4dHJhY3RXYWxsZXRBZGRyZXNzIiwiZ2V0TWVtYmVyIiwibmFtZSIsInJvb21NZW1iZXJzIiwiZ2V0Sm9pbmVkTWVtYmVycyIsIm1lbWViZXJzSW5mbyIsIm1lbWJlciIsIkpTT04iLCJzdHJpbmdpZnkiLCJwYXJzZWQiLCJzZWFyY2giLCJyZXBsYWNlIiwic2V0IiwiaWQiLCJ3aW5kb3ciLCJsb2NhdGlvbiIsImhyZWYiLCJzcGxpdCIsImF1dGhQcm92aWRlciIsInNjYWxhclRva2VuIiwidG9TdHJpbmciLCJpc01hbmFnZWRCeU1hbmFnZXIiLCJzdGFydGVkIiwic3RhcnRNZXNzYWdpbmciLCJpZnJhbWUiLCJhbGxvd2VkQ2FwYWJpbGl0aWVzIiwid2hpdGVsaXN0Q2FwYWJpbGl0aWVzIiwiZHJpdmVyIiwiU3RvcEdhcFdpZGdldERyaXZlciIsIkNsaWVudFdpZGdldEFwaSIsIm9uIiwiZW1pdCIsIldpZGdldE1lc3NhZ2luZ1N0b3JlIiwic3RvcmVNZXNzYWdpbmciLCJXaWRnZXRBcGlGcm9tV2lkZ2V0QWN0aW9uIiwiT3Blbk1vZGFsV2lkZ2V0Iiwib25PcGVuTW9kYWwiLCJFbGVtZW50V2lkZ2V0QWN0aW9ucyIsIkpvaW5DYWxsIiwidm9pY2VCcm9hZGNhc3RSZWNvcmRpbmdzU3RvcmUiLCJnZXRDdXJyZW50IiwicGF1c2UiLCJWaWV3Um9vbSIsInRhcmdldFJvb21JZCIsInJvb21faWQiLCJoYXNDYXBhYmlsaXR5IiwiRWxlbWVudFdpZGdldENhcGFiaWxpdGllcyIsIkNhbkNoYW5nZVZpZXdlZFJvb20iLCJkZWZhdWx0RGlzcGF0Y2hlciIsImRpc3BhdGNoIiwiYWN0aW9uIiwiQWN0aW9uIiwibWV0cmljc1RyaWdnZXIiLCJnZXRSb29tcyIsImV2ZW50cyIsImdldExpdmVUaW1lbGluZSIsImdldEV2ZW50cyIsInJvb21FdmVudCIsInJlYWRVcFRvTWFwIiwiZ2V0SWQiLCJDbGllbnRFdmVudCIsIkV2ZW50Iiwib25FdmVudCIsIk1hdHJpeEV2ZW50RXZlbnQiLCJEZWNyeXB0ZWQiLCJvbkV2ZW50RGVjcnlwdGVkIiwiVG9EZXZpY2VFdmVudCIsIm9uVG9EZXZpY2VFdmVudCIsIlVwZGF0ZUFsd2F5c09uU2NyZWVuIiwiTWF0cml4Q2FwYWJpbGl0aWVzIiwiQWx3YXlzT25TY3JlZW4iLCJBY3RpdmVXaWRnZXRTdG9yZSIsInNldFdpZGdldFBlcnNpc3RlbmNlIiwidmFsdWUiLCJTZW5kU3RpY2tlciIsIlN0aWNrZXJTZW5kaW5nIiwid2lkZ2V0SWQiLCJTVElDS0VSUElDS0VSIiwiT3BlbkludGVncmF0aW9uTWFuYWdlciIsImludGVnVHlwZSIsImludGVnSWQiLCJJbnRlZ3JhdGlvbk1hbmFnZXJzIiwic2hhcmVkSW5zdGFuY2UiLCJnZXRQcmltYXJ5TWFuYWdlciIsIm9wZW4iLCJIYW5ndXBDYWxsIiwiZXJyb3JNZXNzYWdlIiwiTW9kYWwiLCJjcmVhdGVEaWFsb2ciLCJFcnJvckRpYWxvZyIsInRpdGxlIiwiX3QiLCJkZXNjcmlwdGlvbiIsInByZXBhcmUiLCJpc1JlYWR5IiwiUHJvbWlzZSIsInJlc29sdmUiLCJleGlzdGluZ01lc3NhZ2luZyIsImdldE1lc3NhZ2luZyIsImlzU2NhbGFyVXJsIiwibWFuYWdlcnMiLCJoYXNNYW5hZ2VyIiwiZGVmYXVsdE1hbmFnZXIiLCJhcGlVcmwiLCJzY2FsYXIiLCJnZXRTY2FsYXJDbGllbnQiLCJnZXRTY2FsYXJUb2tlbiIsImUiLCJsb2dnZXIiLCJzdG9wTWVzc2FnaW5nIiwiZm9yY2VEZXN0cm95IiwiZ2V0V2lkZ2V0UGVyc2lzdGVuY2UiLCJvZmYiLCJ1cFRvRXZlbnRJZCIsImlzQmVmb3JlTWFyayIsInRpbWVsaW5lIiwiYXJyYXlGYXN0Q2xvbmUiLCJyZXZlcnNlIiwidGltZWxpbmVFdmVudCIsImV2Um9vbUlkIiwiZXZJZCIsImdldE15TWVtYmVyc2hpcCIsInJhdyIsImNhdGNoIl0sInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3N0b3Jlcy93aWRnZXRzL1N0b3BHYXBXaWRnZXQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIENvcHlyaWdodCAyMDIwIC0gMjAyMiBUaGUgTWF0cml4Lm9yZyBGb3VuZGF0aW9uIEMuSS5DLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuaW1wb3J0IHsgUm9vbSB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9tb2RlbHMvcm9vbVwiO1xuaW1wb3J0IHsgZXh0cmFjdFdhbGxldEFkZHJlc3MgfSBmcm9tIFwiLi4vLi4vcGF5bWVudFNlcnZpY2VzXCI7XG5pbXBvcnQge1xuICAgIENsaWVudFdpZGdldEFwaSxcbiAgICBJTW9kYWxXaWRnZXRPcGVuUmVxdWVzdCxcbiAgICBJUm9vbUV2ZW50LFxuICAgIElTdGlja2VyQWN0aW9uUmVxdWVzdCxcbiAgICBJU3RpY2t5QWN0aW9uUmVxdWVzdCxcbiAgICBJVGVtcGxhdGVQYXJhbXMsXG4gICAgSVdpZGdldCxcbiAgICBJV2lkZ2V0QXBpRXJyb3JSZXNwb25zZURhdGEsXG4gICAgSVdpZGdldEFwaVJlcXVlc3QsXG4gICAgSVdpZGdldEFwaVJlcXVlc3RFbXB0eURhdGEsXG4gICAgSVdpZGdldERhdGEsXG4gICAgTWF0cml4Q2FwYWJpbGl0aWVzLFxuICAgIHJ1blRlbXBsYXRlLFxuICAgIFdpZGdldCxcbiAgICBXaWRnZXRBcGlGcm9tV2lkZ2V0QWN0aW9uLFxuICAgIFdpZGdldEtpbmQsXG59IGZyb20gXCJtYXRyaXgtd2lkZ2V0LWFwaVwiO1xuaW1wb3J0IHsgT3B0aW9uYWwgfSBmcm9tIFwibWF0cml4LWV2ZW50cy1zZGtcIjtcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gXCJldmVudHNcIjtcbmltcG9ydCB7IE1hdHJpeENsaWVudCB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9jbGllbnRcIjtcbmltcG9ydCB7IE1hdHJpeEV2ZW50LCBNYXRyaXhFdmVudEV2ZW50IH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL21vZGVscy9ldmVudFwiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL2xvZ2dlclwiO1xuaW1wb3J0IHsgQ2xpZW50RXZlbnQgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvY2xpZW50XCI7XG5cbmltcG9ydCB7IF90IH0gZnJvbSBcIi4uLy4uL2xhbmd1YWdlSGFuZGxlclwiO1xuaW1wb3J0IHsgU3RvcEdhcFdpZGdldERyaXZlciB9IGZyb20gXCIuL1N0b3BHYXBXaWRnZXREcml2ZXJcIjtcbmltcG9ydCB7IFdpZGdldE1lc3NhZ2luZ1N0b3JlIH0gZnJvbSBcIi4vV2lkZ2V0TWVzc2FnaW5nU3RvcmVcIjtcbmltcG9ydCB7IE1hdHJpeENsaWVudFBlZyB9IGZyb20gXCIuLi8uLi9NYXRyaXhDbGllbnRQZWdcIjtcbmltcG9ydCB7IE93blByb2ZpbGVTdG9yZSB9IGZyb20gXCIuLi9Pd25Qcm9maWxlU3RvcmVcIjtcbmltcG9ydCBXaWRnZXRVdGlscyBmcm9tIFwiLi4vLi4vdXRpbHMvV2lkZ2V0VXRpbHNcIjtcbmltcG9ydCB7IEludGVncmF0aW9uTWFuYWdlcnMgfSBmcm9tIFwiLi4vLi4vaW50ZWdyYXRpb25zL0ludGVncmF0aW9uTWFuYWdlcnNcIjtcbmltcG9ydCBTZXR0aW5nc1N0b3JlIGZyb20gXCIuLi8uLi9zZXR0aW5ncy9TZXR0aW5nc1N0b3JlXCI7XG5pbXBvcnQgeyBXaWRnZXRUeXBlIH0gZnJvbSBcIi4uLy4uL3dpZGdldHMvV2lkZ2V0VHlwZVwiO1xuaW1wb3J0IEFjdGl2ZVdpZGdldFN0b3JlIGZyb20gXCIuLi9BY3RpdmVXaWRnZXRTdG9yZVwiO1xuaW1wb3J0IHsgb2JqZWN0U2hhbGxvd0Nsb25lIH0gZnJvbSBcIi4uLy4uL3V0aWxzL29iamVjdHNcIjtcbmltcG9ydCBkZWZhdWx0RGlzcGF0Y2hlciBmcm9tIFwiLi4vLi4vZGlzcGF0Y2hlci9kaXNwYXRjaGVyXCI7XG5pbXBvcnQgeyBBY3Rpb24gfSBmcm9tIFwiLi4vLi4vZGlzcGF0Y2hlci9hY3Rpb25zXCI7XG5pbXBvcnQgeyBFbGVtZW50V2lkZ2V0QWN0aW9ucywgSUhhbmd1cENhbGxBcGlSZXF1ZXN0LCBJVmlld1Jvb21BcGlSZXF1ZXN0IH0gZnJvbSBcIi4vRWxlbWVudFdpZGdldEFjdGlvbnNcIjtcbmltcG9ydCB7IE1vZGFsV2lkZ2V0U3RvcmUgfSBmcm9tIFwiLi4vTW9kYWxXaWRnZXRTdG9yZVwiO1xuaW1wb3J0IHsgSUFwcCwgaXNBcHBXaWRnZXQgfSBmcm9tIFwiLi4vV2lkZ2V0U3RvcmVcIjtcbmltcG9ydCBUaGVtZVdhdGNoZXIgZnJvbSBcIi4uLy4uL3NldHRpbmdzL3dhdGNoZXJzL1RoZW1lV2F0Y2hlclwiO1xuaW1wb3J0IHsgZ2V0Q3VzdG9tVGhlbWUgfSBmcm9tIFwiLi4vLi4vdGhlbWVcIjtcbmltcG9ydCB7IEVsZW1lbnRXaWRnZXRDYXBhYmlsaXRpZXMgfSBmcm9tIFwiLi9FbGVtZW50V2lkZ2V0Q2FwYWJpbGl0aWVzXCI7XG5pbXBvcnQgeyBFTEVNRU5UX0NMSUVOVF9JRCB9IGZyb20gXCIuLi8uLi9pZGVudGlmaWVyc1wiO1xuaW1wb3J0IHsgZ2V0VXNlckxhbmd1YWdlIH0gZnJvbSBcIi4uLy4uL2xhbmd1YWdlSGFuZGxlclwiO1xuaW1wb3J0IHsgV2lkZ2V0VmFyaWFibGVDdXN0b21pc2F0aW9ucyB9IGZyb20gXCIuLi8uLi9jdXN0b21pc2F0aW9ucy9XaWRnZXRWYXJpYWJsZXNcIjtcbmltcG9ydCB7IGFycmF5RmFzdENsb25lIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FycmF5c1wiO1xuaW1wb3J0IHsgVmlld1Jvb21QYXlsb2FkIH0gZnJvbSBcIi4uLy4uL2Rpc3BhdGNoZXIvcGF5bG9hZHMvVmlld1Jvb21QYXlsb2FkXCI7XG5pbXBvcnQgTW9kYWwgZnJvbSBcIi4uLy4uL01vZGFsXCI7XG5pbXBvcnQgRXJyb3JEaWFsb2cgZnJvbSBcIi4uLy4uL2NvbXBvbmVudHMvdmlld3MvZGlhbG9ncy9FcnJvckRpYWxvZ1wiO1xuaW1wb3J0IHsgU2RrQ29udGV4dENsYXNzIH0gZnJvbSBcIi4uLy4uL2NvbnRleHRzL1NES0NvbnRleHRcIjtcblxuLy8gVE9ETzogRGVzdHJveSBhbGwgb2YgdGhpcyBjb2RlXG5cbmludGVyZmFjZSBJQXBwVGlsZVByb3BzIHtcbiAgICAvLyBOb3RlOiB0aGVzZSBhcmUgb25seSB0aGUgcHJvcHMgd2UgY2FyZSBhYm91dFxuICAgIGFwcDogSUFwcCB8IElXaWRnZXQ7XG4gICAgcm9vbT86IFJvb207IC8vIHdpdGhvdXQgYSByb29tIGl0IGlzIGEgdXNlciB3aWRnZXRcbiAgICB1c2VySWQ6IHN0cmluZztcbiAgICBjcmVhdG9yVXNlcklkOiBzdHJpbmc7XG4gICAgd2FpdEZvcklmcmFtZUxvYWQ6IGJvb2xlYW47XG4gICAgd2hpdGVsaXN0Q2FwYWJpbGl0aWVzPzogc3RyaW5nW107XG4gICAgdXNlcldpZGdldDogYm9vbGVhbjtcbn1cblxuLy8gVE9ETzogRG9uJ3QgdXNlIHRoaXMgYmVjYXVzZSBpdCdzIHdyb25nXG5leHBvcnQgY2xhc3MgRWxlbWVudFdpZGdldCBleHRlbmRzIFdpZGdldCB7XG4gICAgcHVibGljIGNvbnN0cnVjdG9yKHByaXZhdGUgcmF3RGVmaW5pdGlvbjogSVdpZGdldCkge1xuICAgICAgICBzdXBlcihyYXdEZWZpbml0aW9uKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0IHRlbXBsYXRlVXJsKCk6IHN0cmluZyB7XG4gICAgICAgIGlmIChXaWRnZXRUeXBlLkpJVFNJLm1hdGNoZXModGhpcy50eXBlKSkge1xuICAgICAgICAgICAgcmV0dXJuIFdpZGdldFV0aWxzLmdldExvY2FsSml0c2lXcmFwcGVyVXJsKHtcbiAgICAgICAgICAgICAgICBmb3JMb2NhbFJlbmRlcjogdHJ1ZSxcbiAgICAgICAgICAgICAgICBhdXRoOiBzdXBlci5yYXdEYXRhPy5hdXRoIGFzIHN0cmluZywgLy8gdGhpcy5yYXdEYXRhIGNhbiBjYWxsIHRlbXBsYXRlVXJsLCBkbyB0aGlzIHRvIHByZXZlbnQgbG9vcGluZ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHN1cGVyLnRlbXBsYXRlVXJsO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXQgcG9wb3V0VGVtcGxhdGVVcmwoKTogc3RyaW5nIHtcbiAgICAgICAgaWYgKFdpZGdldFR5cGUuSklUU0kubWF0Y2hlcyh0aGlzLnR5cGUpKSB7XG4gICAgICAgICAgICByZXR1cm4gV2lkZ2V0VXRpbHMuZ2V0TG9jYWxKaXRzaVdyYXBwZXJVcmwoe1xuICAgICAgICAgICAgICAgIGZvckxvY2FsUmVuZGVyOiBmYWxzZSwgLy8gVGhlIG9ubHkgaW1wb3J0YW50IGRpZmZlcmVuY2UgYmV0d2VlbiB0aGlzIGFuZCB0ZW1wbGF0ZVVybCgpXG4gICAgICAgICAgICAgICAgYXV0aDogc3VwZXIucmF3RGF0YT8uYXV0aCBhcyBzdHJpbmcsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy50ZW1wbGF0ZVVybDsgLy8gdXNlIHRoaXMgaW5zdGVhZCBvZiBzdXBlciB0byBlbnN1cmUgd2UgZ2V0IGFwcHJvcHJpYXRlIHRlbXBsYXRpbmdcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0IHJhd0RhdGEoKTogSVdpZGdldERhdGEge1xuICAgICAgICBsZXQgY29uZmVyZW5jZUlkID0gc3VwZXIucmF3RGF0YVtcImNvbmZlcmVuY2VJZFwiXTtcbiAgICAgICAgaWYgKGNvbmZlcmVuY2VJZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyB3ZSdsbCBuZWVkIHRvIHBhcnNlIHRoZSBjb25mZXJlbmNlIElEIG91dCBvZiB0aGUgVVJMIGZvciB2MSBKaXRzaSB3aWRnZXRzXG4gICAgICAgICAgICBjb25zdCBwYXJzZWRVcmwgPSBuZXcgVVJMKHN1cGVyLnRlbXBsYXRlVXJsKTsgLy8gdXNlIHN1cGVyIHRvIGdldCB0aGUgcmF3IHdpZGdldCBVUkxcbiAgICAgICAgICAgIGNvbmZlcmVuY2VJZCA9IHBhcnNlZFVybC5zZWFyY2hQYXJhbXMuZ2V0KFwiY29uZklkXCIpO1xuICAgICAgICB9XG4gICAgICAgIGxldCBkb21haW4gPSBzdXBlci5yYXdEYXRhW1wiZG9tYWluXCJdO1xuICAgICAgICBpZiAoZG9tYWluID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vIHYxIHdpZGdldHMgZGVmYXVsdCB0byBtZWV0LmVsZW1lbnQuaW8gcmVnYXJkbGVzcyBvZiB1c2VyIHNldHRpbmdzXG4gICAgICAgICAgICBkb21haW4gPSBcIm1lZXQuZWxlbWVudC5pb1wiO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHRoZW1lID0gbmV3IFRoZW1lV2F0Y2hlcigpLmdldEVmZmVjdGl2ZVRoZW1lKCk7XG4gICAgICAgIGlmICh0aGVtZS5zdGFydHNXaXRoKFwiY3VzdG9tLVwiKSkge1xuICAgICAgICAgICAgY29uc3QgY3VzdG9tVGhlbWUgPSBnZXRDdXN0b21UaGVtZSh0aGVtZS5zbGljZSg3KSk7XG4gICAgICAgICAgICAvLyBKaXRzaSBvbmx5IHVuZGVyc3RhbmRzIGxpZ2h0L2RhcmtcbiAgICAgICAgICAgIHRoZW1lID0gY3VzdG9tVGhlbWUuaXNfZGFyayA/IFwiZGFya1wiIDogXCJsaWdodFwiO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gb25seSBhbGxvdyBsaWdodC9kYXJrIHRocm91Z2gsIGRlZmF1bHRpbmcgdG8gZGFyayBhcyB0aGF0IHdhcyBwcmV2aW91c2x5IHRoZSBvbmx5IHN0YXRlXG4gICAgICAgIC8vIGFjY291bnRzIGZvciBsZWdhY3ktbGlnaHQvbGVnYWN5LWRhcmsgdGhlbWVzIHRvb1xuICAgICAgICBpZiAodGhlbWUuaW5jbHVkZXMoXCJsaWdodFwiKSkge1xuICAgICAgICAgICAgdGhlbWUgPSBcImxpZ2h0XCI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGVtZSA9IFwiZGFya1wiO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC4uLnN1cGVyLnJhd0RhdGEsXG4gICAgICAgICAgICB0aGVtZSxcbiAgICAgICAgICAgIGNvbmZlcmVuY2VJZCxcbiAgICAgICAgICAgIGRvbWFpbixcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0Q29tcGxldGVVcmwocGFyYW1zOiBJVGVtcGxhdGVQYXJhbXMsIGFzUG9wb3V0ID0gZmFsc2UpOiBzdHJpbmcge1xuICAgICAgICByZXR1cm4gcnVuVGVtcGxhdGUoXG4gICAgICAgICAgICBhc1BvcG91dCA/IHRoaXMucG9wb3V0VGVtcGxhdGVVcmwgOiB0aGlzLnRlbXBsYXRlVXJsLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIC4uLnRoaXMucmF3RGVmaW5pdGlvbixcbiAgICAgICAgICAgICAgICBkYXRhOiB0aGlzLnJhd0RhdGEsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcGFyYW1zLFxuICAgICAgICApO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFN0b3BHYXBXaWRnZXQgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICAgIHByaXZhdGUgY2xpZW50OiBNYXRyaXhDbGllbnQ7XG4gICAgcHJpdmF0ZSBtZXNzYWdpbmc6IENsaWVudFdpZGdldEFwaSB8IG51bGwgPSBudWxsO1xuICAgIHByaXZhdGUgbW9ja1dpZGdldDogRWxlbWVudFdpZGdldDtcbiAgICBwcml2YXRlIHNjYWxhclRva2VuPzogc3RyaW5nO1xuICAgIHByaXZhdGUgcm9vbUlkPzogc3RyaW5nO1xuICAgIHByaXZhdGUga2luZDogV2lkZ2V0S2luZDtcbiAgICBwcml2YXRlIHJlYWRvbmx5IHZpcnR1YWw6IGJvb2xlYW47XG4gICAgcHJpdmF0ZSByZWFkVXBUb01hcDogeyBbcm9vbUlkOiBzdHJpbmddOiBzdHJpbmcgfSA9IHt9OyAvLyByb29tIElEIHRvIGV2ZW50IElEXG5cbiAgICBwdWJsaWMgY29uc3RydWN0b3IocHJpdmF0ZSBhcHBUaWxlUHJvcHM6IElBcHBUaWxlUHJvcHMpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5jbGllbnQgPSBNYXRyaXhDbGllbnRQZWcuZ2V0KCk7XG5cbiAgICAgICAgY29uc29sZS5sb2coXCJIZWxsb29vb29vb29vb29vb29vb29vb29vb29vb29vb29vb29vb29vb29vb29vb29vb29vb1wiKVxuXG4gICAgICAgIGxldCBhcHAgPSBhcHBUaWxlUHJvcHMuYXBwO1xuICAgICAgICAvLyBCYWNrd2FyZHMgY29tcGF0aWJpbGl0eTogbm90IGFsbCBvbGQgd2lkZ2V0cyBoYXZlIGEgY3JlYXRvclVzZXJJZFxuICAgICAgICBpZiAoIWFwcC5jcmVhdG9yVXNlcklkKSB7XG4gICAgICAgICAgICBhcHAgPSBvYmplY3RTaGFsbG93Q2xvbmUoYXBwKTsgLy8gY2xvbmUgdG8gcHJldmVudCBhY2NpZGVudGFsIG11dGF0aW9uXG4gICAgICAgICAgICBhcHAuY3JlYXRvclVzZXJJZCA9IHRoaXMuY2xpZW50LmdldFVzZXJJZCgpITtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubW9ja1dpZGdldCA9IG5ldyBFbGVtZW50V2lkZ2V0KGFwcCk7XG4gICAgICAgIHRoaXMucm9vbUlkID0gYXBwVGlsZVByb3BzLnJvb20/LnJvb21JZDtcbiAgICAgICAgdGhpcy5raW5kID0gYXBwVGlsZVByb3BzLnVzZXJXaWRnZXQgPyBXaWRnZXRLaW5kLkFjY291bnQgOiBXaWRnZXRLaW5kLlJvb207IC8vIHByb2JhYmx5XG4gICAgICAgIHRoaXMudmlydHVhbCA9IGlzQXBwV2lkZ2V0KGFwcCkgJiYgYXBwLmV2ZW50SWQgPT09IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdldCBldmVudExpc3RlbmVyUm9vbUlkKCk6IE9wdGlvbmFsPHN0cmluZz4ge1xuICAgICAgICAvLyBXaGVuIHdpZGdldHMgYXJlIGxpc3RlbmluZyB0byBldmVudHMsIHdlIG5lZWQgdG8gbWFrZSBzdXJlIHRoZXkncmUgb25seVxuICAgICAgICAvLyByZWNlaXZpbmcgZXZlbnRzIGZvciB0aGUgcmlnaHQgcm9vbS4gSW4gcGFydGljdWxhciwgcm9vbSB3aWRnZXRzIGdldCBsb2NrZWRcbiAgICAgICAgLy8gdG8gdGhlIHJvb20gdGhleSB3ZXJlIGFkZGVkIGluIHdoaWxlIGFjY291bnQgd2lkZ2V0cyBsaXN0ZW4gdG8gdGhlIGN1cnJlbnRseVxuICAgICAgICAvLyBhY3RpdmUgcm9vbS5cblxuICAgICAgICBpZiAodGhpcy5yb29tSWQpIHJldHVybiB0aGlzLnJvb21JZDtcblxuICAgICAgICByZXR1cm4gU2RrQ29udGV4dENsYXNzLmluc3RhbmNlLnJvb21WaWV3U3RvcmUuZ2V0Um9vbUlkKCk7XG4gICAgfVxuXG4gICAgcHVibGljIGdldCB3aWRnZXRBcGkoKTogQ2xpZW50V2lkZ2V0QXBpIHwgbnVsbCB7XG4gICAgICAgIHJldHVybiB0aGlzLm1lc3NhZ2luZztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgVVJMIHRvIHVzZSBpbiB0aGUgaWZyYW1lXG4gICAgICovXG4gICAgcHVibGljIGdldCBlbWJlZFVybCgpOiBzdHJpbmcge1xuICAgICAgICBjb25zb2xlLmxvZyhcInJ1blVybFRlbXBsYXRlIGVtYmVkVXJsfn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+XCIpXG4gICAgICAgIHJldHVybiB0aGlzLnJ1blVybFRlbXBsYXRlKHsgYXNQb3BvdXQ6IGZhbHNlIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBVUkwgdG8gdXNlIGluIHRoZSBwb3BvdXRcbiAgICAgKi9cbiAgICBwdWJsaWMgZ2V0IHBvcG91dFVybCgpOiBzdHJpbmcge1xuICAgICAgICByZXR1cm4gdGhpcy5ydW5VcmxUZW1wbGF0ZSh7IGFzUG9wb3V0OiB0cnVlIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgcnVuVXJsVGVtcGxhdGUob3B0cyA9IHsgYXNQb3BvdXQ6IGZhbHNlIH0pOiBzdHJpbmcge1xuICAgICAgICBjb25zdCBmcm9tQ3VzdG9taXNhdGlvbiA9IFdpZGdldFZhcmlhYmxlQ3VzdG9taXNhdGlvbnM/LnByb3ZpZGVWYXJpYWJsZXM/LigpID8/IHt9O1xuICAgICAgICBjb25zdCBkZWZhdWx0czogSVRlbXBsYXRlUGFyYW1zID0ge1xuICAgICAgICAgICAgd2lkZ2V0Um9vbUlkOiB0aGlzLnJvb21JZCxcbiAgICAgICAgICAgIGN1cnJlbnRVc2VySWQ6IHRoaXMuY2xpZW50LmdldFVzZXJJZCgpISxcbiAgICAgICAgICAgIHVzZXJEaXNwbGF5TmFtZTogT3duUHJvZmlsZVN0b3JlLmluc3RhbmNlLmRpc3BsYXlOYW1lID8/IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHVzZXJIdHRwQXZhdGFyVXJsOiBPd25Qcm9maWxlU3RvcmUuaW5zdGFuY2UuZ2V0SHR0cEF2YXRhclVybCgpID8/IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIGNsaWVudElkOiBFTEVNRU5UX0NMSUVOVF9JRCxcbiAgICAgICAgICAgIGNsaWVudFRoZW1lOiBTZXR0aW5nc1N0b3JlLmdldFZhbHVlKFwidGhlbWVcIiksXG4gICAgICAgICAgICBjbGllbnRMYW5ndWFnZTogZ2V0VXNlckxhbmd1YWdlKCksXG4gICAgICAgICAgICBkZXZpY2VJZDogdGhpcy5jbGllbnQuZ2V0RGV2aWNlSWQoKSA/PyB1bmRlZmluZWQsXG4gICAgICAgICAgICAvLyBtYXRyaXhfYXV0aF9wcm92aWRlcjogT3duUHJvZmlsZVN0b3JlLmluc3RhbmNlLmF1dGhQcm92aWRlciA/PyB1bmRlZmluZWQsXG4gICAgICAgIH07XG4gICAgICAgIGNvbnNvbGUubG9nKFwiZGVmYXVsdHMgPT09PT4gXCIsIGRlZmF1bHRzKVxuICAgICAgICBjb25zdCB0ZW1wbGF0ZWQgPSB0aGlzLm1vY2tXaWRnZXQuZ2V0Q29tcGxldGVVcmwoT2JqZWN0LmFzc2lnbihkZWZhdWx0cywgZnJvbUN1c3RvbWlzYXRpb24pLCBvcHRzPy5hc1BvcG91dCk7XG4gICAgICAgIGNvbnN0IGNsaWVudCA9IE1hdHJpeENsaWVudFBlZy5nZXQoKTtcbiAgICAgICAgY29uc3Qgcm9vbUluZm8gPSBjbGllbnQuZ2V0Um9vbSh0aGlzLnJvb21JZCk7XG4gICAgICAgIGNvbnN0IHVzZXJJbmZvID0ge1xuICAgICAgICAgICAgdXNlcklkOiByb29tSW5mby5teVVzZXJJZCxcbiAgICAgICAgICAgIHdhbGxldEFkZHJlc3M6IGV4dHJhY3RXYWxsZXRBZGRyZXNzKHJvb21JbmZvLm15VXNlcklkKSxcbiAgICAgICAgICAgIGRpc3BsYXlOYW1lOiByb29tSW5mby5nZXRNZW1iZXIocm9vbUluZm8ubXlVc2VySWQpPy5uYW1lLFxuICAgICAgICB9O1xuICAgICAgICBjb25zdCByb29tTWVtYmVycyA9IHJvb21JbmZvLmdldEpvaW5lZE1lbWJlcnMoKTtcbiAgICAgICAgY29uc3QgbWVtZWJlcnNJbmZvID0gW107XG4gICAgICAgIHJvb21NZW1iZXJzLmZvckVhY2goKG1lbWJlcikgPT4ge1xuICAgICAgICAgICAgaWYgKG1lbWJlci51c2VySWQgIT09IHVzZXJJbmZvLnVzZXJJZCkge1xuICAgICAgICAgICAgICAgIG1lbWViZXJzSW5mby5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgdXNlcklkOiBtZW1iZXIudXNlcklkLFxuICAgICAgICAgICAgICAgICAgICB3YWxsZXRBZGRyZXNzOiBleHRyYWN0V2FsbGV0QWRkcmVzcyhtZW1iZXIudXNlcklkKSxcbiAgICAgICAgICAgICAgICAgICAgZGlzcGxheU5hbWU6IG1lbWJlci5uYW1lLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgY29uc29sZS5sb2coXCJ1c2VySW5mb1wiLCB1c2VySW5mbywgbWVtZWJlcnNJbmZvKTtcbiAgICAgICAgY29uc29sZS5sb2coXCJKU09OLnN0cmluZ2lmeSh1c2VySW5mbylcIiwgSlNPTi5zdHJpbmdpZnkodXNlckluZm8pKTtcbiAgICAgICAgY29uc29sZS5sb2coXCJ0ZW1wbGF0ZWRcIiwgdGVtcGxhdGVkKTtcbiAgICAgICAgbGV0IHBhcnNlZCA9IG5ldyBVUkwodGVtcGxhdGVkKTtcbiAgICAgICAgY29uc29sZS5sb2coXCJwYXJzZWQuc2VhcmNoXCIsIHBhcnNlZC5zZWFyY2gpO1xuICAgICAgICBpZiAocGFyc2VkLnNlYXJjaC5pbmNsdWRlcyhcIj91cmw9aHR0cHMlM0ElMkYlMkZ0ZXh0cnBkZW1vLnMzLmV1LWNlbnRyYWwtMS5hbWF6b25hd3MuY29tJTJGaW5kZXguaHRtbFwiKSkge1xuICAgICAgICAgICAgcGFyc2VkLnNlYXJjaD0gIHBhcnNlZC5zZWFyY2gucmVwbGFjZShcbiAgICAgICAgICAgICAgICBcIj91cmw9aHR0cHMlM0ElMkYlMkZ0ZXh0cnBkZW1vLnMzLmV1LWNlbnRyYWwtMS5hbWF6b25hd3MuY29tJTJGaW5kZXguaHRtbFwiLFxuICAgICAgICAgICAgICAgIGA/dXJsPWh0dHBzJTNBJTJGJTJGdGV4dHJwZGVtby5zMy5ldS1jZW50cmFsLTEuYW1hem9uYXdzLmNvbSUyRmluZGV4Lmh0bWw/dXNlckluZm89JHtKU09OLnN0cmluZ2lmeSh1c2VySW5mbyl9JTI2bWVtZWJlcnNJbmZvPSR7SlNPTi5zdHJpbmdpZnkobWVtZWJlcnNJbmZvKX1gLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBBZGQgaW4gc29tZSBsZWdhY3kgc3VwcG9ydCBzcHJpbmtsZXMgKGZvciBub24tcG9wb3V0IHdpZGdldHMpXG4gICAgICAgIC8vIFRPRE86IFJlcGxhY2UgdGhlc2Ugd2l0aCBwcm9wZXIgd2lkZ2V0IHBhcmFtc1xuICAgICAgICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL21hdHJpeC1vcmcvbWF0cml4LWRvYy9wdWxsLzE5NTgvZmlsZXMjcjQwNTcxNDgzM1xuICAgICAgICBpZiAoIW9wdHM/LmFzUG9wb3V0KSB7XG4gICAgICAgICAgICBwYXJzZWQuc2VhcmNoUGFyYW1zLnNldChcIndpZGdldElkXCIsIHRoaXMubW9ja1dpZGdldC5pZCk7XG4gICAgICAgICAgICBwYXJzZWQuc2VhcmNoUGFyYW1zLnNldChcInBhcmVudFVybFwiLCB3aW5kb3cubG9jYXRpb24uaHJlZi5zcGxpdChcIiNcIiwgMilbMF0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBBZGQgYXV0aF9wcm92aWRlciBmcm9tIHByb2ZpbGUgc3RvcmVcbiAgICAgICAgICAgIGNvbnN0IGF1dGhQcm92aWRlciA9IE93blByb2ZpbGVTdG9yZS5pbnN0YW5jZS5hdXRoUHJvdmlkZXIgfHwgXCJ1bmtub3duXCI7XG4gICAgICAgICAgICBwYXJzZWQuc2VhcmNoUGFyYW1zLnNldChcImF1dGhQcm92aWRlclwiLCBhdXRoUHJvdmlkZXIpO1xuXG4gICAgICAgICAgICAvLyBHaXZlIHRoZSB3aWRnZXQgYSBzY2FsYXIgdG9rZW4gaWYgd2UncmUgc3VwcG9zZWQgdG8gKG1vcmUgbGVnYWN5KVxuICAgICAgICAgICAgLy8gVE9ETzogU3RvcCBkb2luZyB0aGlzXG4gICAgICAgICAgICBpZiAodGhpcy5zY2FsYXJUb2tlbikge1xuICAgICAgICAgICAgICAgIHBhcnNlZC5zZWFyY2hQYXJhbXMuc2V0KFwic2NhbGFyX3Rva2VuXCIsIHRoaXMuc2NhbGFyVG9rZW4pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVwbGFjZSB0aGUgZW5jb2RlZCBkb2xsYXIgc2lnbnMgYmFjayB0byBkb2xsYXIgc2lnbnMuIFRoZXkgaGF2ZSBubyBzcGVjaWFsIG1lYW5pbmdcbiAgICAgICAgLy8gaW4gSFRUUCwgYnV0IFVSTCBwYXJzZXJzIGVuY29kZSB0aGVtIGFueXdheXMuXG4gICAgICAgIGNvbnNvbGUubG9nKFwicGFyc2VkLnRvU3RyaW5nKClcIiwgcGFyc2VkLnRvU3RyaW5nKCkucmVwbGFjZSgvJTI0L2csIFwiJFwiKSk7XG4gICAgICAgIHJldHVybiBwYXJzZWQudG9TdHJpbmcoKS5yZXBsYWNlKC8lMjQvZywgXCIkXCIpO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXQgaXNNYW5hZ2VkQnlNYW5hZ2VyKCk6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gISF0aGlzLnNjYWxhclRva2VuO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXQgc3RhcnRlZCgpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuICEhdGhpcy5tZXNzYWdpbmc7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBvbk9wZW5Nb2RhbCA9IGFzeW5jIChldjogQ3VzdG9tRXZlbnQ8SU1vZGFsV2lkZ2V0T3BlblJlcXVlc3Q+KTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICAgIGV2LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGlmIChNb2RhbFdpZGdldFN0b3JlLmluc3RhbmNlLmNhbk9wZW5Nb2RhbFdpZGdldCgpKSB7XG4gICAgICAgICAgICBNb2RhbFdpZGdldFN0b3JlLmluc3RhbmNlLm9wZW5Nb2RhbFdpZGdldChldi5kZXRhaWwuZGF0YSwgdGhpcy5tb2NrV2lkZ2V0LCB0aGlzLnJvb21JZCk7XG4gICAgICAgICAgICB0aGlzLm1lc3NhZ2luZz8udHJhbnNwb3J0LnJlcGx5KGV2LmRldGFpbCwge30pOyAvLyBhY2tcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubWVzc2FnaW5nPy50cmFuc3BvcnQucmVwbHkoZXYuZGV0YWlsLCB7XG4gICAgICAgICAgICAgICAgZXJyb3I6IHtcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogXCJVbmFibGUgdG8gb3BlbiBtb2RhbCBhdCB0aGlzIHRpbWVcIixcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIC8qKlxuICAgICAqIFRoaXMgc3RhcnRzIHRoZSBtZXNzYWdpbmcgZm9yIHRoZSB3aWRnZXQgaWYgaXQgaXMgbm90IGluIHRoZSBzdGF0ZSBgc3RhcnRlZGAgeWV0LlxuICAgICAqIEBwYXJhbSBpZnJhbWUgdGhlIGlmcmFtZSB0aGUgd2lkZ2V0IHNob3VsZCB1c2VcbiAgICAgKi9cbiAgICBwdWJsaWMgc3RhcnRNZXNzYWdpbmcoaWZyYW1lOiBIVE1MSUZyYW1lRWxlbWVudCk6IGFueSB7XG4gICAgICAgIGlmICh0aGlzLnN0YXJ0ZWQpIHJldHVybjtcblxuICAgICAgICBjb25zdCBhbGxvd2VkQ2FwYWJpbGl0aWVzID0gdGhpcy5hcHBUaWxlUHJvcHMud2hpdGVsaXN0Q2FwYWJpbGl0aWVzIHx8IFtdO1xuICAgICAgICBjb25zdCBkcml2ZXIgPSBuZXcgU3RvcEdhcFdpZGdldERyaXZlcihcbiAgICAgICAgICAgIGFsbG93ZWRDYXBhYmlsaXRpZXMsXG4gICAgICAgICAgICB0aGlzLm1vY2tXaWRnZXQsXG4gICAgICAgICAgICB0aGlzLmtpbmQsXG4gICAgICAgICAgICB0aGlzLnZpcnR1YWwsXG4gICAgICAgICAgICB0aGlzLnJvb21JZCxcbiAgICAgICAgKTtcblxuICAgICAgICB0aGlzLm1lc3NhZ2luZyA9IG5ldyBDbGllbnRXaWRnZXRBcGkodGhpcy5tb2NrV2lkZ2V0LCBpZnJhbWUsIGRyaXZlcik7XG4gICAgICAgIHRoaXMubWVzc2FnaW5nLm9uKFwicHJlcGFyaW5nXCIsICgpID0+IHRoaXMuZW1pdChcInByZXBhcmluZ1wiKSk7XG4gICAgICAgIHRoaXMubWVzc2FnaW5nLm9uKFwicmVhZHlcIiwgKCkgPT4ge1xuICAgICAgICAgICAgV2lkZ2V0TWVzc2FnaW5nU3RvcmUuaW5zdGFuY2Uuc3RvcmVNZXNzYWdpbmcodGhpcy5tb2NrV2lkZ2V0LCB0aGlzLnJvb21JZCwgdGhpcy5tZXNzYWdpbmchKTtcbiAgICAgICAgICAgIHRoaXMuZW1pdChcInJlYWR5XCIpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5tZXNzYWdpbmcub24oXCJjYXBhYmlsaXRpZXNOb3RpZmllZFwiLCAoKSA9PiB0aGlzLmVtaXQoXCJjYXBhYmlsaXRpZXNOb3RpZmllZFwiKSk7XG4gICAgICAgIHRoaXMubWVzc2FnaW5nLm9uKGBhY3Rpb246JHtXaWRnZXRBcGlGcm9tV2lkZ2V0QWN0aW9uLk9wZW5Nb2RhbFdpZGdldH1gLCB0aGlzLm9uT3Blbk1vZGFsKTtcbiAgICAgICAgdGhpcy5tZXNzYWdpbmcub24oYGFjdGlvbjoke0VsZW1lbnRXaWRnZXRBY3Rpb25zLkpvaW5DYWxsfWAsICgpID0+IHtcbiAgICAgICAgICAgIC8vIHBhdXNlIHZvaWNlIGJyb2FkY2FzdCByZWNvcmRpbmcgd2hlbiBhbnkgd2lkZ2V0IHNlbmRzIGEgXCJqb2luXCJcbiAgICAgICAgICAgIFNka0NvbnRleHRDbGFzcy5pbnN0YW5jZS52b2ljZUJyb2FkY2FzdFJlY29yZGluZ3NTdG9yZS5nZXRDdXJyZW50KCk/LnBhdXNlKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFsd2F5cyBhdHRhY2ggYSBoYW5kbGVyIGZvciBWaWV3Um9vbSwgYnV0IHBlcm1pc3Npb24gY2hlY2sgaXQgaW50ZXJuYWxseVxuICAgICAgICB0aGlzLm1lc3NhZ2luZy5vbihgYWN0aW9uOiR7RWxlbWVudFdpZGdldEFjdGlvbnMuVmlld1Jvb219YCwgKGV2OiBDdXN0b21FdmVudDxJVmlld1Jvb21BcGlSZXF1ZXN0PikgPT4ge1xuICAgICAgICAgICAgZXYucHJldmVudERlZmF1bHQoKTsgLy8gc3RvcCB0aGUgd2lkZ2V0IEFQSSBmcm9tIGF1dG8tcmVqZWN0aW5nIHRoaXNcblxuICAgICAgICAgICAgLy8gQ2hlY2sgdXAgZnJvbnQgaWYgdGhpcyBpcyBldmVuIGEgdmFsaWQgcmVxdWVzdFxuICAgICAgICAgICAgY29uc3QgdGFyZ2V0Um9vbUlkID0gKGV2LmRldGFpbC5kYXRhIHx8IHt9KS5yb29tX2lkO1xuICAgICAgICAgICAgaWYgKCF0YXJnZXRSb29tSWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tZXNzYWdpbmc/LnRyYW5zcG9ydC5yZXBseShldi5kZXRhaWwsIDxJV2lkZ2V0QXBpRXJyb3JSZXNwb25zZURhdGE+e1xuICAgICAgICAgICAgICAgICAgICBlcnJvcjogeyBtZXNzYWdlOiBcIlJvb20gSUQgbm90IHN1cHBsaWVkLlwiIH0sXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIENoZWNrIHRoZSB3aWRnZXQncyBwZXJtaXNzaW9uXG4gICAgICAgICAgICBpZiAoIXRoaXMubWVzc2FnaW5nPy5oYXNDYXBhYmlsaXR5KEVsZW1lbnRXaWRnZXRDYXBhYmlsaXRpZXMuQ2FuQ2hhbmdlVmlld2VkUm9vbSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tZXNzYWdpbmc/LnRyYW5zcG9ydC5yZXBseShldi5kZXRhaWwsIDxJV2lkZ2V0QXBpRXJyb3JSZXNwb25zZURhdGE+e1xuICAgICAgICAgICAgICAgICAgICBlcnJvcjogeyBtZXNzYWdlOiBcIlRoaXMgd2lkZ2V0IGRvZXMgbm90IGhhdmUgcGVybWlzc2lvbiBmb3IgdGhpcyBhY3Rpb24gKGRlbmllZCkuXCIgfSxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYXQgdGhpcyBwb2ludCB3ZSBjYW4gY2hhbmdlIHJvb21zLCBzbyBkbyB0aGF0XG4gICAgICAgICAgICBkZWZhdWx0RGlzcGF0Y2hlci5kaXNwYXRjaDxWaWV3Um9vbVBheWxvYWQ+KHtcbiAgICAgICAgICAgICAgICBhY3Rpb246IEFjdGlvbi5WaWV3Um9vbSxcbiAgICAgICAgICAgICAgICByb29tX2lkOiB0YXJnZXRSb29tSWQsXG4gICAgICAgICAgICAgICAgbWV0cmljc1RyaWdnZXI6IFwiV2lkZ2V0XCIsXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gYWNrbm93bGVkZ2Ugc28gdGhlIHdpZGdldCBkb2Vzbid0IGZyZWFrIG91dFxuICAgICAgICAgICAgdGhpcy5tZXNzYWdpbmcudHJhbnNwb3J0LnJlcGx5KGV2LmRldGFpbCwgPElXaWRnZXRBcGlSZXF1ZXN0RW1wdHlEYXRhPnt9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gUG9wdWxhdGUgdGhlIG1hcCBvZiBcInJlYWQgdXAgdG9cIiBldmVudHMgZm9yIHRoaXMgd2lkZ2V0IHdpdGggdGhlIGN1cnJlbnQgZXZlbnQgaW4gZXZlcnkgcm9vbS5cbiAgICAgICAgLy8gVGhpcyBpcyBhIGJpdCBpbmVmZmljaWVudCwgYnV0IHNob3VsZCBiZSBva2F5LiBXZSBkbyB0aGlzIGZvciBhbGwgcm9vbXMgaW4gY2FzZSB0aGUgd2lkZ2V0XG4gICAgICAgIC8vIHJlcXVlc3RzIHRpbWVsaW5lIGNhcGFiaWxpdGllcyBpbiBvdGhlciByb29tcyBkb3duIHRoZSByb2FkLiBJdCdzIGp1c3QgZWFzaWVyIHRvIG1hbmFnZSBoZXJlLlxuICAgICAgICBmb3IgKGNvbnN0IHJvb20gb2YgdGhpcy5jbGllbnQuZ2V0Um9vbXMoKSkge1xuICAgICAgICAgICAgLy8gVGltZWxpbmVzIGFyZSBtb3N0IHJlY2VudCBsYXN0XG4gICAgICAgICAgICBjb25zdCBldmVudHMgPSByb29tLmdldExpdmVUaW1lbGluZSgpPy5nZXRFdmVudHMoKSB8fCBbXTtcbiAgICAgICAgICAgIGNvbnN0IHJvb21FdmVudCA9IGV2ZW50c1tldmVudHMubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICBpZiAoIXJvb21FdmVudCkgY29udGludWU7IC8vIGZvcmNlIGxhdGVyIGNvZGUgdG8gdGhpbmsgdGhlIHJvb20gaXMgZnJlc2hcbiAgICAgICAgICAgIHRoaXMucmVhZFVwVG9NYXBbcm9vbS5yb29tSWRdID0gcm9vbUV2ZW50LmdldElkKCkhO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQXR0YWNoIGxpc3RlbmVycyBmb3IgZmVlZGluZyBldmVudHMgLSB0aGUgdW5kZXJseWluZyB3aWRnZXQgY2xhc3NlcyBoYW5kbGUgcGVybWlzc2lvbnMgZm9yIHVzXG4gICAgICAgIHRoaXMuY2xpZW50Lm9uKENsaWVudEV2ZW50LkV2ZW50LCB0aGlzLm9uRXZlbnQpO1xuICAgICAgICB0aGlzLmNsaWVudC5vbihNYXRyaXhFdmVudEV2ZW50LkRlY3J5cHRlZCwgdGhpcy5vbkV2ZW50RGVjcnlwdGVkKTtcbiAgICAgICAgdGhpcy5jbGllbnQub24oQ2xpZW50RXZlbnQuVG9EZXZpY2VFdmVudCwgdGhpcy5vblRvRGV2aWNlRXZlbnQpO1xuXG4gICAgICAgIHRoaXMubWVzc2FnaW5nLm9uKFxuICAgICAgICAgICAgYGFjdGlvbjoke1dpZGdldEFwaUZyb21XaWRnZXRBY3Rpb24uVXBkYXRlQWx3YXlzT25TY3JlZW59YCxcbiAgICAgICAgICAgIChldjogQ3VzdG9tRXZlbnQ8SVN0aWNreUFjdGlvblJlcXVlc3Q+KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubWVzc2FnaW5nPy5oYXNDYXBhYmlsaXR5KE1hdHJpeENhcGFiaWxpdGllcy5BbHdheXNPblNjcmVlbikpIHtcbiAgICAgICAgICAgICAgICAgICAgQWN0aXZlV2lkZ2V0U3RvcmUuaW5zdGFuY2Uuc2V0V2lkZ2V0UGVyc2lzdGVuY2UoXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm1vY2tXaWRnZXQuaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJvb21JZCA/PyBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgZXYuZGV0YWlsLmRhdGEudmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIGV2LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubWVzc2FnaW5nLnRyYW5zcG9ydC5yZXBseShldi5kZXRhaWwsIDxJV2lkZ2V0QXBpUmVxdWVzdEVtcHR5RGF0YT57fSk7IC8vIGFja1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICk7XG5cbiAgICAgICAgLy8gVE9ETzogUmVwbGFjZSB0aGlzIGV2ZW50IGxpc3RlbmVyIHdpdGggYXBwcm9wcmlhdGUgZHJpdmVyIGZ1bmN0aW9uYWxpdHkgb25jZSB0aGUgQVBJXG4gICAgICAgIC8vIGVzdGFibGlzaGVzIGEgc2FuZSB3YXkgdG8gc2VuZCBldmVudHMgYmFjayBhbmQgZm9ydGguXG4gICAgICAgIHRoaXMubWVzc2FnaW5nLm9uKFxuICAgICAgICAgICAgYGFjdGlvbjoke1dpZGdldEFwaUZyb21XaWRnZXRBY3Rpb24uU2VuZFN0aWNrZXJ9YCxcbiAgICAgICAgICAgIChldjogQ3VzdG9tRXZlbnQ8SVN0aWNrZXJBY3Rpb25SZXF1ZXN0PikgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLm1lc3NhZ2luZz8uaGFzQ2FwYWJpbGl0eShNYXRyaXhDYXBhYmlsaXRpZXMuU3RpY2tlclNlbmRpbmcpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEFja25vd2xlZGdlIGZpcnN0XG4gICAgICAgICAgICAgICAgICAgIGV2LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubWVzc2FnaW5nLnRyYW5zcG9ydC5yZXBseShldi5kZXRhaWwsIDxJV2lkZ2V0QXBpUmVxdWVzdEVtcHR5RGF0YT57fSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gU2VuZCB0aGUgc3RpY2tlclxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0RGlzcGF0Y2hlci5kaXNwYXRjaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBhY3Rpb246IFwibS5zdGlja2VyXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiBldi5kZXRhaWwuZGF0YSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpZGdldElkOiB0aGlzLm1vY2tXaWRnZXQuaWQsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICk7XG5cbiAgICAgICAgaWYgKFdpZGdldFR5cGUuU1RJQ0tFUlBJQ0tFUi5tYXRjaGVzKHRoaXMubW9ja1dpZGdldC50eXBlKSkge1xuICAgICAgICAgICAgdGhpcy5tZXNzYWdpbmcub24oXG4gICAgICAgICAgICAgICAgYGFjdGlvbjoke0VsZW1lbnRXaWRnZXRBY3Rpb25zLk9wZW5JbnRlZ3JhdGlvbk1hbmFnZXJ9YCxcbiAgICAgICAgICAgICAgICAoZXY6IEN1c3RvbUV2ZW50PElXaWRnZXRBcGlSZXF1ZXN0PikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBBY2tub3dsZWRnZSBmaXJzdFxuICAgICAgICAgICAgICAgICAgICBldi5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm1lc3NhZ2luZz8udHJhbnNwb3J0LnJlcGx5KGV2LmRldGFpbCwgPElXaWRnZXRBcGlSZXF1ZXN0RW1wdHlEYXRhPnt9KTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBGaXJzdCBjbG9zZSB0aGUgc3RpY2tlcnBpY2tlclxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0RGlzcGF0Y2hlci5kaXNwYXRjaCh7IGFjdGlvbjogXCJzdGlja2VycGlja2VyX2Nsb3NlXCIgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gTm93IG9wZW4gdGhlIGludGVncmF0aW9uIG1hbmFnZXJcbiAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogU3BlYyB0aGlzIGludGVyYWN0aW9uLlxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkYXRhID0gZXYuZGV0YWlsLmRhdGE7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGludGVnVHlwZSA9IGRhdGE/LmludGVnVHlwZSBhcyBzdHJpbmc7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGludGVnSWQgPSA8c3RyaW5nPmRhdGE/LmludGVnSWQ7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgcm9vbUlkID0gU2RrQ29udGV4dENsYXNzLmluc3RhbmNlLnJvb21WaWV3U3RvcmUuZ2V0Um9vbUlkKCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJvb20gPSByb29tSWQgPyB0aGlzLmNsaWVudC5nZXRSb29tKHJvb21JZCkgOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgICAgIGlmICghcm9vbSkgcmV0dXJuO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIG5vaW5zcGVjdGlvbiBKU0lnbm9yZWRQcm9taXNlRnJvbUNhbGxcbiAgICAgICAgICAgICAgICAgICAgSW50ZWdyYXRpb25NYW5hZ2Vycy5zaGFyZWRJbnN0YW5jZSgpPy5nZXRQcmltYXJ5TWFuYWdlcigpPy5vcGVuKHJvb20sIGB0eXBlXyR7aW50ZWdUeXBlfWAsIGludGVnSWQpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKFdpZGdldFR5cGUuSklUU0kubWF0Y2hlcyh0aGlzLm1vY2tXaWRnZXQudHlwZSkpIHtcbiAgICAgICAgICAgIHRoaXMubWVzc2FnaW5nLm9uKGBhY3Rpb246JHtFbGVtZW50V2lkZ2V0QWN0aW9ucy5IYW5ndXBDYWxsfWAsIChldjogQ3VzdG9tRXZlbnQ8SUhhbmd1cENhbGxBcGlSZXF1ZXN0PikgPT4ge1xuICAgICAgICAgICAgICAgIGV2LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgaWYgKGV2LmRldGFpbC5kYXRhPy5lcnJvck1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICAgICAgTW9kYWwuY3JlYXRlRGlhbG9nKEVycm9yRGlhbG9nLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogX3QoXCJDb25uZWN0aW9uIGxvc3RcIiksXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogX3QoXCJZb3Ugd2VyZSBkaXNjb25uZWN0ZWQgZnJvbSB0aGUgY2FsbC4gKEVycm9yOiAlKG1lc3NhZ2UpcylcIiwge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGV2LmRldGFpbC5kYXRhLmVycm9yTWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5tZXNzYWdpbmc/LnRyYW5zcG9ydC5yZXBseShldi5kZXRhaWwsIDxJV2lkZ2V0QXBpUmVxdWVzdEVtcHR5RGF0YT57fSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBwcmVwYXJlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICAvLyBFbnN1cmUgdGhlIHZhcmlhYmxlcyBhcmUgcmVhZHkgZm9yIHVzIHRvIGJlIHJlbmRlcmVkIGJlZm9yZSBjb250aW51aW5nXG4gICAgICAgIGF3YWl0IChXaWRnZXRWYXJpYWJsZUN1c3RvbWlzYXRpb25zPy5pc1JlYWR5Py4oKSA/PyBQcm9taXNlLnJlc29sdmUoKSk7XG5cbiAgICAgICAgaWYgKHRoaXMuc2NhbGFyVG9rZW4pIHJldHVybjtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdNZXNzYWdpbmcgPSBXaWRnZXRNZXNzYWdpbmdTdG9yZS5pbnN0YW5jZS5nZXRNZXNzYWdpbmcodGhpcy5tb2NrV2lkZ2V0LCB0aGlzLnJvb21JZCk7XG4gICAgICAgIGlmIChleGlzdGluZ01lc3NhZ2luZykgdGhpcy5tZXNzYWdpbmcgPSBleGlzdGluZ01lc3NhZ2luZztcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmIChXaWRnZXRVdGlscy5pc1NjYWxhclVybCh0aGlzLm1vY2tXaWRnZXQudGVtcGxhdGVVcmwpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWFuYWdlcnMgPSBJbnRlZ3JhdGlvbk1hbmFnZXJzLnNoYXJlZEluc3RhbmNlKCk7XG4gICAgICAgICAgICAgICAgaWYgKG1hbmFnZXJzLmhhc01hbmFnZXIoKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBUT0RPOiBQaWNrIHRoZSByaWdodCBtYW5hZ2VyIGZvciB0aGUgd2lkZ2V0XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlZmF1bHRNYW5hZ2VyID0gbWFuYWdlcnMuZ2V0UHJpbWFyeU1hbmFnZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRlZmF1bHRNYW5hZ2VyICYmIFdpZGdldFV0aWxzLmlzU2NhbGFyVXJsKGRlZmF1bHRNYW5hZ2VyLmFwaVVybCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNjYWxhciA9IGRlZmF1bHRNYW5hZ2VyLmdldFNjYWxhckNsaWVudCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zY2FsYXJUb2tlbiA9IGF3YWl0IHNjYWxhci5nZXRTY2FsYXJUb2tlbigpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAvLyBBbGwgZXJyb3JzIGFyZSBub24tZmF0YWxcbiAgICAgICAgICAgIGxvZ2dlci5lcnJvcihcIkVycm9yIHByZXBhcmluZyB3aWRnZXQgY29tbXVuaWNhdGlvbnM6IFwiLCBlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN0b3BzIHRoZSB3aWRnZXQgbWVzc2FnaW5nIGZvciBpZiBpdCBpcyBzdGFydGVkLiBTa2lwcyBzdG9wcGluZyBpZiBpdCBpcyBhbiBhY3RpdmVcbiAgICAgKiB3aWRnZXQuXG4gICAgICogQHBhcmFtIG9wdHNcbiAgICAgKi9cbiAgICBwdWJsaWMgc3RvcE1lc3NhZ2luZyhvcHRzID0geyBmb3JjZURlc3Ryb3k6IGZhbHNlIH0pOiB2b2lkIHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgIW9wdHM/LmZvcmNlRGVzdHJveSAmJlxuICAgICAgICAgICAgQWN0aXZlV2lkZ2V0U3RvcmUuaW5zdGFuY2UuZ2V0V2lkZ2V0UGVyc2lzdGVuY2UodGhpcy5tb2NrV2lkZ2V0LmlkLCB0aGlzLnJvb21JZCA/PyBudWxsKVxuICAgICAgICApIHtcbiAgICAgICAgICAgIGxvZ2dlci5sb2coXCJTa2lwcGluZyBkZXN0cm95IC0gcGVyc2lzdGVudCB3aWRnZXRcIik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzLnN0YXJ0ZWQpIHJldHVybjtcbiAgICAgICAgV2lkZ2V0TWVzc2FnaW5nU3RvcmUuaW5zdGFuY2Uuc3RvcE1lc3NhZ2luZyh0aGlzLm1vY2tXaWRnZXQsIHRoaXMucm9vbUlkKTtcbiAgICAgICAgdGhpcy5tZXNzYWdpbmcgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuY2xpZW50Lm9mZihDbGllbnRFdmVudC5FdmVudCwgdGhpcy5vbkV2ZW50KTtcbiAgICAgICAgdGhpcy5jbGllbnQub2ZmKE1hdHJpeEV2ZW50RXZlbnQuRGVjcnlwdGVkLCB0aGlzLm9uRXZlbnREZWNyeXB0ZWQpO1xuICAgICAgICB0aGlzLmNsaWVudC5vZmYoQ2xpZW50RXZlbnQuVG9EZXZpY2VFdmVudCwgdGhpcy5vblRvRGV2aWNlRXZlbnQpO1xuICAgIH1cblxuICAgIHByaXZhdGUgb25FdmVudCA9IChldjogTWF0cml4RXZlbnQpOiB2b2lkID0+IHtcbiAgICAgICAgdGhpcy5jbGllbnQuZGVjcnlwdEV2ZW50SWZOZWVkZWQoZXYpO1xuICAgICAgICBpZiAoZXYuaXNCZWluZ0RlY3J5cHRlZCgpIHx8IGV2LmlzRGVjcnlwdGlvbkZhaWx1cmUoKSkgcmV0dXJuO1xuICAgICAgICB0aGlzLmZlZWRFdmVudChldik7XG4gICAgfTtcblxuICAgIHByaXZhdGUgb25FdmVudERlY3J5cHRlZCA9IChldjogTWF0cml4RXZlbnQpOiB2b2lkID0+IHtcbiAgICAgICAgaWYgKGV2LmlzRGVjcnlwdGlvbkZhaWx1cmUoKSkgcmV0dXJuO1xuICAgICAgICB0aGlzLmZlZWRFdmVudChldik7XG4gICAgfTtcblxuICAgIHByaXZhdGUgb25Ub0RldmljZUV2ZW50ID0gYXN5bmMgKGV2OiBNYXRyaXhFdmVudCk6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgICAgICBhd2FpdCB0aGlzLmNsaWVudC5kZWNyeXB0RXZlbnRJZk5lZWRlZChldik7XG4gICAgICAgIGlmIChldi5pc0RlY3J5cHRpb25GYWlsdXJlKCkpIHJldHVybjtcbiAgICAgICAgYXdhaXQgdGhpcy5tZXNzYWdpbmc/LmZlZWRUb0RldmljZShldi5nZXRFZmZlY3RpdmVFdmVudCgpIGFzIElSb29tRXZlbnQsIGV2LmlzRW5jcnlwdGVkKCkpO1xuICAgIH07XG5cbiAgICBwcml2YXRlIGZlZWRFdmVudChldjogTWF0cml4RXZlbnQpOiB2b2lkIHtcbiAgICAgICAgaWYgKCF0aGlzLm1lc3NhZ2luZykgcmV0dXJuO1xuXG4gICAgICAgIC8vIENoZWNrIHRvIHNlZSBpZiB0aGlzIGV2ZW50IHdvdWxkIGJlIGJlZm9yZSBvciBhZnRlciBvdXIgXCJyZWFkIHVwIHRvXCIgbWFya2VyLiBJZiBpdCdzXG4gICAgICAgIC8vIGJlZm9yZSwgb3Igd2UgY2FuJ3QgZGVjaWRlLCB0aGVuIHdlIGFzc3VtZSB0aGUgd2lkZ2V0IHdpbGwgaGF2ZSBhbHJlYWR5IHNlZW4gdGhlIGV2ZW50LlxuICAgICAgICAvLyBJZiB0aGUgZXZlbnQgaXMgYWZ0ZXIsIG9yIHdlIGRvbid0IGhhdmUgYSBtYXJrZXIgZm9yIHRoZSByb29tLCB0aGVuIHdlJ2xsIHNlbmQgaXQgdGhyb3VnaC5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gVGhpcyBhcHByb2FjaCBvZiBcInJlYWQgdXAgdG9cIiBwcmV2ZW50cyB3aWRnZXRzIHJlY2VpdmluZyBkZWNyeXB0aW9uIHNwYW0gZnJvbSBzdGFydHVwIG9yXG4gICAgICAgIC8vIHJlY2VpdmluZyBvdXQtb2Ytb3JkZXIgZXZlbnRzIGZyb20gYmFja2ZpbGwgYW5kIHN1Y2guXG4gICAgICAgIGNvbnN0IHVwVG9FdmVudElkID0gdGhpcy5yZWFkVXBUb01hcFtldi5nZXRSb29tSWQoKSFdO1xuICAgICAgICBpZiAodXBUb0V2ZW50SWQpIHtcbiAgICAgICAgICAgIC8vIFNtYWxsIG9wdGltaXphdGlvbiBmb3IgZXhhY3QgbWF0Y2ggKHByZXZlbnQgc2VhcmNoKVxuICAgICAgICAgICAgaWYgKHVwVG9FdmVudElkID09PSBldi5nZXRJZCgpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgaXNCZWZvcmVNYXJrID0gdHJ1ZTtcblxuICAgICAgICAgICAgY29uc3Qgcm9vbSA9IHRoaXMuY2xpZW50LmdldFJvb20oZXYuZ2V0Um9vbUlkKCkhKTtcbiAgICAgICAgICAgIGlmICghcm9vbSkgcmV0dXJuO1xuICAgICAgICAgICAgLy8gVGltZWxpbmVzIGFyZSBtb3N0IHJlY2VudCBsYXN0LCBzbyByZXZlcnNlIHRoZSBvcmRlciBhbmQgbGltaXQgb3Vyc2VsdmVzIHRvIDEwMCBldmVudHNcbiAgICAgICAgICAgIC8vIHRvIGF2b2lkIG92ZXJ1c2luZyB0aGUgQ1BVLlxuICAgICAgICAgICAgY29uc3QgdGltZWxpbmUgPSByb29tLmdldExpdmVUaW1lbGluZSgpO1xuICAgICAgICAgICAgY29uc3QgZXZlbnRzID0gYXJyYXlGYXN0Q2xvbmUodGltZWxpbmUuZ2V0RXZlbnRzKCkpLnJldmVyc2UoKS5zbGljZSgwLCAxMDApO1xuXG4gICAgICAgICAgICBmb3IgKGNvbnN0IHRpbWVsaW5lRXZlbnQgb2YgZXZlbnRzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRpbWVsaW5lRXZlbnQuZ2V0SWQoKSA9PT0gdXBUb0V2ZW50SWQpIHtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0aW1lbGluZUV2ZW50LmdldElkKCkgPT09IGV2LmdldElkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgaXNCZWZvcmVNYXJrID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGlzQmVmb3JlTWFyaykge1xuICAgICAgICAgICAgICAgIC8vIElnbm9yZSB0aGUgZXZlbnQ6IGl0IGlzIGJlZm9yZSBvdXIgaW50ZXJlc3QuXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2tpcCBtYXJrZXIgYXNzaWdubWVudCBpZiBtZW1iZXJzaGlwIGlzICdpbnZpdGUnLCBvdGhlcndpc2UgJ20ucm9vbS5tZW1iZXInIGZyb21cbiAgICAgICAgLy8gaW52aXRhdGlvbiByb29tIHdpbGwgYXNzaWduIGl0IGFuZCBuZXcgc3RhdGUgZXZlbnRzIHdpbGwgYmUgbm90IGZvcndhcmRlZCB0byB0aGUgd2lkZ2V0XG4gICAgICAgIC8vIGJlY2F1c2Ugb2YgZW1wdHkgdGltZWxpbmUgZm9yIGludml0YXRpb24gcm9vbSBhbmQgYXNzaWduZWQgbWFya2VyLlxuICAgICAgICBjb25zdCBldlJvb21JZCA9IGV2LmdldFJvb21JZCgpO1xuICAgICAgICBjb25zdCBldklkID0gZXYuZ2V0SWQoKTtcbiAgICAgICAgaWYgKGV2Um9vbUlkICYmIGV2SWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHJvb20gPSB0aGlzLmNsaWVudC5nZXRSb29tKGV2Um9vbUlkKTtcbiAgICAgICAgICAgIGlmIChyb29tICYmIHJvb20uZ2V0TXlNZW1iZXJzaGlwKCkgPT09IFwiam9pblwiKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWFkVXBUb01hcFtldlJvb21JZF0gPSBldklkO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmF3ID0gZXYuZ2V0RWZmZWN0aXZlRXZlbnQoKTtcbiAgICAgICAgdGhpcy5tZXNzYWdpbmcuZmVlZEV2ZW50KHJhdyBhcyBJUm9vbUV2ZW50LCB0aGlzLmV2ZW50TGlzdGVuZXJSb29tSWQhKS5jYXRjaCgoZSkgPT4ge1xuICAgICAgICAgICAgbG9nZ2VyLmVycm9yKFwiRXJyb3Igc2VuZGluZyBldmVudCB0byB3aWRnZXQ6IFwiLCBlKTtcbiAgICAgICAgfSk7XG4gICAgfVxufVxuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQWlCQSxJQUFBQSxnQkFBQSxHQUFBQyxPQUFBO0FBQ0EsSUFBQUMsZ0JBQUEsR0FBQUQsT0FBQTtBQW1CQSxJQUFBRSxPQUFBLEdBQUFGLE9BQUE7QUFFQSxJQUFBRyxNQUFBLEdBQUFILE9BQUE7QUFDQSxJQUFBSSxPQUFBLEdBQUFKLE9BQUE7QUFDQSxJQUFBSyxPQUFBLEdBQUFMLE9BQUE7QUFFQSxJQUFBTSxnQkFBQSxHQUFBTixPQUFBO0FBQ0EsSUFBQU8sb0JBQUEsR0FBQVAsT0FBQTtBQUNBLElBQUFRLHFCQUFBLEdBQUFSLE9BQUE7QUFDQSxJQUFBUyxnQkFBQSxHQUFBVCxPQUFBO0FBQ0EsSUFBQVUsZ0JBQUEsR0FBQVYsT0FBQTtBQUNBLElBQUFXLFlBQUEsR0FBQUMsc0JBQUEsQ0FBQVosT0FBQTtBQUNBLElBQUFhLG9CQUFBLEdBQUFiLE9BQUE7QUFDQSxJQUFBYyxjQUFBLEdBQUFGLHNCQUFBLENBQUFaLE9BQUE7QUFDQSxJQUFBZSxXQUFBLEdBQUFmLE9BQUE7QUFDQSxJQUFBZ0Isa0JBQUEsR0FBQUosc0JBQUEsQ0FBQVosT0FBQTtBQUNBLElBQUFpQixRQUFBLEdBQUFqQixPQUFBO0FBQ0EsSUFBQWtCLFdBQUEsR0FBQU4sc0JBQUEsQ0FBQVosT0FBQTtBQUNBLElBQUFtQixRQUFBLEdBQUFuQixPQUFBO0FBQ0EsSUFBQW9CLHFCQUFBLEdBQUFwQixPQUFBO0FBQ0EsSUFBQXFCLGlCQUFBLEdBQUFyQixPQUFBO0FBQ0EsSUFBQXNCLFlBQUEsR0FBQXRCLE9BQUE7QUFDQSxJQUFBdUIsYUFB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