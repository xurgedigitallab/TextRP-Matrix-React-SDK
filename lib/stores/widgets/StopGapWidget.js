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
//# sourceMappingURL=StopGapWidget.js.map