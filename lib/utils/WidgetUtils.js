"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _rfc = require("rfc4648");
var _logger = require("matrix-js-sdk/src/logger");
var _matrix = require("matrix-js-sdk/src/matrix");
var _call = require("matrix-js-sdk/src/webrtc/call");
var _randomstring = require("matrix-js-sdk/src/randomstring");
var _PlatformPeg = _interopRequireDefault(require("../PlatformPeg"));
var _SdkConfig = _interopRequireDefault(require("../SdkConfig"));
var _dispatcher = _interopRequireDefault(require("../dispatcher/dispatcher"));
var _WidgetEchoStore = _interopRequireDefault(require("../stores/WidgetEchoStore"));
var _IntegrationManagers = require("../integrations/IntegrationManagers");
var _WidgetType = require("../widgets/WidgetType");
var _Jitsi = require("../widgets/Jitsi");
var _objects = require("./objects");
var _languageHandler = require("../languageHandler");
var _WidgetStore = require("../stores/WidgetStore");
var _UrlUtils = require("./UrlUtils");
/*
Copyright 2019 Travis Ralston
Copyright 2017 - 2020 The Matrix.org Foundation C.I.C.

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

// How long we wait for the state event echo to come back from the server
// before waitFor[Room/User]Widget rejects its promise
const WIDGET_WAIT_TIME = 20000;
class WidgetUtils {
  /**
   * Returns true if user is able to send state events to modify widgets in this room
   * (Does not apply to non-room-based / user widgets)
   * @param client The matrix client of the logged-in user
   * @param roomId -- The ID of the room to check
   * @return Boolean -- true if the user can modify widgets in this room
   * @throws Error -- specifies the error reason
   */
  static canUserModifyWidgets(client, roomId) {
    if (!roomId) {
      _logger.logger.warn("No room ID specified");
      return false;
    }
    if (!client) {
      _logger.logger.warn("User must be be logged in");
      return false;
    }
    const room = client.getRoom(roomId);
    if (!room) {
      _logger.logger.warn(`Room ID ${roomId} is not recognised`);
      return false;
    }
    const me = client.getUserId();
    if (!me) {
      _logger.logger.warn("Failed to get user ID");
      return false;
    }
    if (room.getMyMembership() !== "join") {
      _logger.logger.warn(`User ${me} is not in room ${roomId}`);
      return false;
    }

    // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
    return room.currentState.maySendStateEvent("im.vector.modular.widgets", me);
  }

  // TODO: Generify the name of this function. It's not just scalar.
  /**
   * Returns true if specified url is a scalar URL, typically https://scalar.vector.im/api
   * @param matrixClient The matrix client of the logged-in user
   * @param  {[type]}  testUrlString URL to check
   * @return {Boolean} True if specified URL is a scalar URL
   */
  static isScalarUrl(testUrlString) {
    if (!testUrlString) {
      _logger.logger.error("Scalar URL check failed. No URL specified");
      return false;
    }
    const testUrl = (0, _UrlUtils.parseUrl)(testUrlString);
    let scalarUrls = _SdkConfig.default.get().integrations_widgets_urls;
    if (!scalarUrls || scalarUrls.length === 0) {
      const defaultManager = _IntegrationManagers.IntegrationManagers.sharedInstance().getPrimaryManager();
      if (defaultManager) {
        scalarUrls = [defaultManager.apiUrl];
      } else {
        scalarUrls = [];
      }
    }
    for (let i = 0; i < scalarUrls.length; i++) {
      const scalarUrl = (0, _UrlUtils.parseUrl)(scalarUrls[i]);
      if (testUrl && scalarUrl) {
        if (testUrl.protocol === scalarUrl.protocol && testUrl.host === scalarUrl.host && scalarUrl.pathname && testUrl.pathname?.startsWith(scalarUrl.pathname)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Returns a promise that resolves when a widget with the given
   * ID has been added as a user widget (ie. the accountData event
   * arrives) or rejects after a timeout
   *
   * @param client The matrix client of the logged-in user
   * @param widgetId The ID of the widget to wait for
   * @param add True to wait for the widget to be added,
   *     false to wait for it to be deleted.
   * @returns {Promise} that resolves when the widget is in the
   *     requested state according to the `add` param
   */
  static waitForUserWidget(client, widgetId, add) {
    return new Promise((resolve, reject) => {
      // Tests an account data event, returning true if it's in the state
      // we're waiting for it to be in
      function eventInIntendedState(ev) {
        if (!ev) return false;
        if (add) {
          return ev.getContent()[widgetId] !== undefined;
        } else {
          return ev.getContent()[widgetId] === undefined;
        }
      }
      const startingAccountDataEvent = client.getAccountData("m.widgets");
      if (eventInIntendedState(startingAccountDataEvent)) {
        resolve();
        return;
      }
      function onAccountData(ev) {
        const currentAccountDataEvent = client.getAccountData("m.widgets");
        if (eventInIntendedState(currentAccountDataEvent)) {
          client.removeListener(_matrix.ClientEvent.AccountData, onAccountData);
          clearTimeout(timerId);
          resolve();
        }
      }
      const timerId = window.setTimeout(() => {
        client.removeListener(_matrix.ClientEvent.AccountData, onAccountData);
        reject(new Error("Timed out waiting for widget ID " + widgetId + " to appear"));
      }, WIDGET_WAIT_TIME);
      client.on(_matrix.ClientEvent.AccountData, onAccountData);
    });
  }

  /**
   * Returns a promise that resolves when a widget with the given
   * ID has been added as a room widget in the given room (ie. the
   * room state event arrives) or rejects after a timeout
   *
   * @param client The matrix client of the logged-in user
   * @param {string} widgetId The ID of the widget to wait for
   * @param {string} roomId The ID of the room to wait for the widget in
   * @param {boolean} add True to wait for the widget to be added,
   *     false to wait for it to be deleted.
   * @returns {Promise} that resolves when the widget is in the
   *     requested state according to the `add` param
   */
  static waitForRoomWidget(client, widgetId, roomId, add) {
    return new Promise((resolve, reject) => {
      // Tests a list of state events, returning true if it's in the state
      // we're waiting for it to be in
      function eventsInIntendedState(evList) {
        const widgetPresent = evList?.some(ev => {
          return ev.getContent() && ev.getContent()["id"] === widgetId;
        });
        if (add) {
          return !!widgetPresent;
        } else {
          return !widgetPresent;
        }
      }
      const room = client.getRoom(roomId);
      // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
      const startingWidgetEvents = room?.currentState.getStateEvents("im.vector.modular.widgets");
      if (eventsInIntendedState(startingWidgetEvents)) {
        resolve();
        return;
      }
      function onRoomStateEvents(ev) {
        if (ev.getRoomId() !== roomId || ev.getType() !== "im.vector.modular.widgets") return;

        // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
        const currentWidgetEvents = room?.currentState.getStateEvents("im.vector.modular.widgets");
        if (eventsInIntendedState(currentWidgetEvents)) {
          client.removeListener(_matrix.RoomStateEvent.Events, onRoomStateEvents);
          clearTimeout(timerId);
          resolve();
        }
      }
      const timerId = window.setTimeout(() => {
        client.removeListener(_matrix.RoomStateEvent.Events, onRoomStateEvents);
        reject(new Error("Timed out waiting for widget ID " + widgetId + " to appear"));
      }, WIDGET_WAIT_TIME);
      client.on(_matrix.RoomStateEvent.Events, onRoomStateEvents);
    });
  }
  static setUserWidget(client, widgetId, widgetType, widgetUrl, widgetName, widgetData) {
    // Get the current widgets and clone them before we modify them, otherwise
    // we'll modify the content of the old event.
    const userWidgets = (0, _objects.objectClone)(WidgetUtils.getUserWidgets(client));

    // Delete existing widget with ID
    try {
      delete userWidgets[widgetId];
    } catch (e) {
      _logger.logger.error(`$widgetId is non-configurable`);
    }
    const addingWidget = Boolean(widgetUrl);
    const userId = client.getSafeUserId();
    const content = {
      id: widgetId,
      type: widgetType.preferred,
      url: widgetUrl,
      name: widgetName,
      data: widgetData,
      creatorUserId: userId
    };

    // Add new widget / update
    if (addingWidget) {
      userWidgets[widgetId] = {
        content: content,
        sender: userId,
        state_key: widgetId,
        type: "m.widget",
        id: widgetId
      };
    }

    // This starts listening for when the echo comes back from the server
    // since the widget won't appear added until this happens. If we don't
    // wait for this, the action will complete but if the user is fast enough,
    // the widget still won't actually be there.
    return client.setAccountData("m.widgets", userWidgets).then(() => {
      return WidgetUtils.waitForUserWidget(client, widgetId, addingWidget);
    }).then(() => {
      _dispatcher.default.dispatch({
        action: "user_widget_updated"
      });
    });
  }
  static setRoomWidget(client, roomId, widgetId, widgetType, widgetUrl, widgetName, widgetData, widgetAvatarUrl) {
    let content;
    const addingWidget = Boolean(widgetUrl);
    if (addingWidget) {
      content = {
        // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
        // For now we'll send the legacy event type for compatibility with older apps/elements
        type: widgetType?.legacy,
        url: widgetUrl,
        name: widgetName,
        data: widgetData,
        avatar_url: widgetAvatarUrl
      };
    } else {
      content = {};
    }
    return WidgetUtils.setRoomWidgetContent(client, roomId, widgetId, content);
  }
  static setRoomWidgetContent(client, roomId, widgetId, content) {
    const addingWidget = !!content.url;
    _WidgetEchoStore.default.setRoomWidgetEcho(roomId, widgetId, content);

    // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
    return client.sendStateEvent(roomId, "im.vector.modular.widgets", content, widgetId).then(() => {
      return WidgetUtils.waitForRoomWidget(client, widgetId, roomId, addingWidget);
    }).finally(() => {
      _WidgetEchoStore.default.removeRoomWidgetEcho(roomId, widgetId);
    });
  }

  /**
   * Get room specific widgets
   * @param  {Room} room The room to get widgets force
   * @return {[object]} Array containing current / active room widgets
   */
  static getRoomWidgets(room) {
    // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
    const appsStateEvents = room.currentState.getStateEvents("im.vector.modular.widgets");
    if (!appsStateEvents) {
      return [];
    }
    return appsStateEvents.filter(ev => {
      return ev.getContent().type && ev.getContent().url;
    });
  }

  /**
   * Get user specific widgets (not linked to a specific room)
   * @param client The matrix client of the logged-in user
   * @return {object} Event content object containing current / active user widgets
   */
  static getUserWidgets(client) {
    if (!client) {
      throw new Error("User not logged in");
    }
    const userWidgets = client.getAccountData("m.widgets");
    if (userWidgets && userWidgets.getContent()) {
      return userWidgets.getContent();
    }
    return {};
  }

  /**
   * Get user specific widgets (not linked to a specific room) as an array
   * @param client The matrix client of the logged-in user
   * @return {[object]} Array containing current / active user widgets
   */
  static getUserWidgetsArray(client) {
    return Object.values(WidgetUtils.getUserWidgets(client));
  }

  /**
   * Get active stickerpicker widgets (stickerpickers are user widgets by nature)
   * @param client The matrix client of the logged-in user
   * @return {[object]} Array containing current / active stickerpicker widgets
   */
  static getStickerpickerWidgets(client) {
    const widgets = WidgetUtils.getUserWidgetsArray(client);
    return widgets.filter(widget => widget.content?.type === "m.stickerpicker");
  }

  /**
   * Get all integration manager widgets for this user.
   * @param client The matrix client of the logged-in user
   * @returns {Object[]} An array of integration manager user widgets.
   */
  static getIntegrationManagerWidgets(client) {
    const widgets = WidgetUtils.getUserWidgetsArray(client);
    return widgets.filter(w => w.content?.type === "m.integration_manager");
  }
  static getRoomWidgetsOfType(room, type) {
    const widgets = WidgetUtils.getRoomWidgets(room) || [];
    return widgets.filter(w => {
      const content = w.getContent();
      return content.url && type.matches(content.type);
    });
  }
  static async removeIntegrationManagerWidgets(client) {
    if (!client) {
      throw new Error("User not logged in");
    }
    const widgets = client.getAccountData("m.widgets");
    if (!widgets) return;
    const userWidgets = widgets.getContent() || {};
    Object.entries(userWidgets).forEach(_ref => {
      let [key, widget] = _ref;
      if (widget.content && widget.content.type === "m.integration_manager") {
        delete userWidgets[key];
      }
    });
    await client.setAccountData("m.widgets", userWidgets);
  }
  static addIntegrationManagerWidget(client, name, uiUrl, apiUrl) {
    return WidgetUtils.setUserWidget(client, "integration_manager_" + new Date().getTime(), _WidgetType.WidgetType.INTEGRATION_MANAGER, uiUrl, "Integration manager: " + name, {
      api_url: apiUrl
    });
  }

  /**
   * Remove all stickerpicker widgets (stickerpickers are user widgets by nature)
   * @param client The matrix client of the logged-in user
   * @return {Promise} Resolves on account data updated
   */
  static async removeStickerpickerWidgets(client) {
    if (!client) {
      throw new Error("User not logged in");
    }
    const widgets = client.getAccountData("m.widgets");
    if (!widgets) return;
    const userWidgets = widgets.getContent() || {};
    Object.entries(userWidgets).forEach(_ref2 => {
      let [key, widget] = _ref2;
      if (widget.content && widget.content.type === "m.stickerpicker") {
        delete userWidgets[key];
      }
    });
    await client.setAccountData("m.widgets", userWidgets);
  }
  static async addJitsiWidget(client, roomId, type, name, isVideoChannel, oobRoomName) {
    const domain = _Jitsi.Jitsi.getInstance().preferredDomain;
    const auth = (await _Jitsi.Jitsi.getInstance().getJitsiAuth()) ?? undefined;
    const widgetId = (0, _randomstring.randomString)(24); // Must be globally unique

    let confId;
    if (auth === "openidtoken-jwt") {
      // Create conference ID from room ID
      // For compatibility with Jitsi, use base32 without padding.
      // More details here:
      // https://github.com/matrix-org/prosody-mod-auth-matrix-user-verification
      confId = _rfc.base32.stringify(Buffer.from(roomId), {
        pad: false
      });
    } else {
      // Create a random conference ID
      confId = `Jitsi${(0, _randomstring.randomUppercaseString)(1)}${(0, _randomstring.randomLowercaseString)(23)}`;
    }

    // TODO: Remove URL hacks when the mobile clients eventually support v2 widgets
    const widgetUrl = new URL(WidgetUtils.getLocalJitsiWrapperUrl({
      auth
    }));
    widgetUrl.search = ""; // Causes the URL class use searchParams instead
    widgetUrl.searchParams.set("confId", confId);
    await WidgetUtils.setRoomWidget(client, roomId, widgetId, _WidgetType.WidgetType.JITSI, widgetUrl.toString(), name, {
      conferenceId: confId,
      roomName: oobRoomName ?? client.getRoom(roomId)?.name,
      isAudioOnly: type === _call.CallType.Voice,
      isVideoChannel,
      domain,
      auth
    });
  }
  static makeAppConfig(appId, app, senderUserId, roomId, eventId) {
    if (!senderUserId) {
      throw new Error("Widgets must be created by someone - provide a senderUserId");
    }
    app.creatorUserId = senderUserId;
    app.id = appId;
    app.roomId = roomId;
    app.eventId = eventId;
    app.name = app.name || app.type;
    return app;
  }
  static getLocalJitsiWrapperUrl() {
    let opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    // NB. we can't just encodeURIComponent all of these because the $ signs need to be there
    const queryStringParts = ["conferenceDomain=$domain", "conferenceId=$conferenceId", "isAudioOnly=$isAudioOnly", "startWithAudioMuted=$startWithAudioMuted", "startWithVideoMuted=$startWithVideoMuted", "isVideoChannel=$isVideoChannel", "displayName=$matrix_display_name", "avatarUrl=$matrix_avatar_url", "userId=$matrix_user_id", "roomId=$matrix_room_id", "theme=$theme", "roomName=$roomName", `supportsScreensharing=${_PlatformPeg.default.get()?.supportsJitsiScreensharing()}`, "language=$org.matrix.msc2873.client_language"];
    if (opts.auth) {
      queryStringParts.push(`auth=${opts.auth}`);
    }
    const queryString = queryStringParts.join("&");
    let baseUrl = window.location.href;
    if (window.location.protocol !== "https:" && !opts.forLocalRender) {
      // Use an external wrapper if we're not locally rendering the widget. This is usually
      // the URL that will end up in the widget event, so we want to make sure it's relatively
      // safe to send.
      // We'll end up using a local render URL when we see a Jitsi widget anyways, so this is
      // really just for backwards compatibility and to appease the spec.
      baseUrl = "https://app.element.io/";
    }
    const url = new URL("jitsi.html#" + queryString, baseUrl); // this strips hash fragment from baseUrl
    return url.href;
  }
  static getWidgetName(app) {
    return app?.name?.trim() || (0, _languageHandler._t)("Unknown App");
  }
  static getWidgetDataTitle(app) {
    return app?.data?.title?.trim() || "";
  }
  static getWidgetUid(app) {
    return app ? WidgetUtils.calcWidgetUid(app.id, (0, _WidgetStore.isAppWidget)(app) ? app.roomId : undefined) : "";
  }
  static calcWidgetUid(widgetId, roomId) {
    return roomId ? `room_${roomId}_${widgetId}` : `user_${widgetId}`;
  }
  static editWidget(room, app) {
    // noinspection JSIgnoredPromiseFromCall
    _IntegrationManagers.IntegrationManagers.sharedInstance().getPrimaryManager()?.open(room, "type_" + app.type, app.id);
  }
  static isManagedByManager(app) {
    if (WidgetUtils.isScalarUrl(app.url)) {
      const managers = _IntegrationManagers.IntegrationManagers.sharedInstance();
      if (managers.hasManager()) {
        // TODO: Pick the right manager for the widget
        const defaultManager = managers.getPrimaryManager();
        return WidgetUtils.isScalarUrl(defaultManager?.apiUrl);
      }
    }
    return false;
  }
}
exports.default = WidgetUtils;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfcmZjIiwicmVxdWlyZSIsIl9sb2dnZXIiLCJfbWF0cml4IiwiX2NhbGwiLCJfcmFuZG9tc3RyaW5nIiwiX1BsYXRmb3JtUGVnIiwiX2ludGVyb3BSZXF1aXJlRGVmYXVsdCIsIl9TZGtDb25maWciLCJfZGlzcGF0Y2hlciIsIl9XaWRnZXRFY2hvU3RvcmUiLCJfSW50ZWdyYXRpb25NYW5hZ2VycyIsIl9XaWRnZXRUeXBlIiwiX0ppdHNpIiwiX29iamVjdHMiLCJfbGFuZ3VhZ2VIYW5kbGVyIiwiX1dpZGdldFN0b3JlIiwiX1VybFV0aWxzIiwiV0lER0VUX1dBSVRfVElNRSIsIldpZGdldFV0aWxzIiwiY2FuVXNlck1vZGlmeVdpZGdldHMiLCJjbGllbnQiLCJyb29tSWQiLCJsb2dnZXIiLCJ3YXJuIiwicm9vbSIsImdldFJvb20iLCJtZSIsImdldFVzZXJJZCIsImdldE15TWVtYmVyc2hpcCIsImN1cnJlbnRTdGF0ZSIsIm1heVNlbmRTdGF0ZUV2ZW50IiwiaXNTY2FsYXJVcmwiLCJ0ZXN0VXJsU3RyaW5nIiwiZXJyb3IiLCJ0ZXN0VXJsIiwicGFyc2VVcmwiLCJzY2FsYXJVcmxzIiwiU2RrQ29uZmlnIiwiZ2V0IiwiaW50ZWdyYXRpb25zX3dpZGdldHNfdXJscyIsImxlbmd0aCIsImRlZmF1bHRNYW5hZ2VyIiwiSW50ZWdyYXRpb25NYW5hZ2VycyIsInNoYXJlZEluc3RhbmNlIiwiZ2V0UHJpbWFyeU1hbmFnZXIiLCJhcGlVcmwiLCJpIiwic2NhbGFyVXJsIiwicHJvdG9jb2wiLCJob3N0IiwicGF0aG5hbWUiLCJzdGFydHNXaXRoIiwid2FpdEZvclVzZXJXaWRnZXQiLCJ3aWRnZXRJZCIsImFkZCIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiZXZlbnRJbkludGVuZGVkU3RhdGUiLCJldiIsImdldENvbnRlbnQiLCJ1bmRlZmluZWQiLCJzdGFydGluZ0FjY291bnREYXRhRXZlbnQiLCJnZXRBY2NvdW50RGF0YSIsIm9uQWNjb3VudERhdGEiLCJjdXJyZW50QWNjb3VudERhdGFFdmVudCIsInJlbW92ZUxpc3RlbmVyIiwiQ2xpZW50RXZlbnQiLCJBY2NvdW50RGF0YSIsImNsZWFyVGltZW91dCIsInRpbWVySWQiLCJ3aW5kb3ciLCJzZXRUaW1lb3V0IiwiRXJyb3IiLCJvbiIsIndhaXRGb3JSb29tV2lkZ2V0IiwiZXZlbnRzSW5JbnRlbmRlZFN0YXRlIiwiZXZMaXN0Iiwid2lkZ2V0UHJlc2VudCIsInNvbWUiLCJzdGFydGluZ1dpZGdldEV2ZW50cyIsImdldFN0YXRlRXZlbnRzIiwib25Sb29tU3RhdGVFdmVudHMiLCJnZXRSb29tSWQiLCJnZXRUeXBlIiwiY3VycmVudFdpZGdldEV2ZW50cyIsIlJvb21TdGF0ZUV2ZW50IiwiRXZlbnRzIiwic2V0VXNlcldpZGdldCIsIndpZGdldFR5cGUiLCJ3aWRnZXRVcmwiLCJ3aWRnZXROYW1lIiwid2lkZ2V0RGF0YSIsInVzZXJXaWRnZXRzIiwib2JqZWN0Q2xvbmUiLCJnZXRVc2VyV2lkZ2V0cyIsImUiLCJhZGRpbmdXaWRnZXQiLCJCb29sZWFuIiwidXNlcklkIiwiZ2V0U2FmZVVzZXJJZCIsImNvbnRlbnQiLCJpZCIsInR5cGUiLCJwcmVmZXJyZWQiLCJ1cmwiLCJuYW1lIiwiZGF0YSIsImNyZWF0b3JVc2VySWQiLCJzZW5kZXIiLCJzdGF0ZV9rZXkiLCJzZXRBY2NvdW50RGF0YSIsInRoZW4iLCJkaXMiLCJkaXNwYXRjaCIsImFjdGlvbiIsInNldFJvb21XaWRnZXQiLCJ3aWRnZXRBdmF0YXJVcmwiLCJsZWdhY3kiLCJhdmF0YXJfdXJsIiwic2V0Um9vbVdpZGdldENvbnRlbnQiLCJXaWRnZXRFY2hvU3RvcmUiLCJzZXRSb29tV2lkZ2V0RWNobyIsInNlbmRTdGF0ZUV2ZW50IiwiZmluYWxseSIsInJlbW92ZVJvb21XaWRnZXRFY2hvIiwiZ2V0Um9vbVdpZGdldHMiLCJhcHBzU3RhdGVFdmVudHMiLCJmaWx0ZXIiLCJnZXRVc2VyV2lkZ2V0c0FycmF5IiwiT2JqZWN0IiwidmFsdWVzIiwiZ2V0U3RpY2tlcnBpY2tlcldpZGdldHMiLCJ3aWRnZXRzIiwid2lkZ2V0IiwiZ2V0SW50ZWdyYXRpb25NYW5hZ2VyV2lkZ2V0cyIsInciLCJnZXRSb29tV2lkZ2V0c09mVHlwZSIsIm1hdGNoZXMiLCJyZW1vdmVJbnRlZ3JhdGlvbk1hbmFnZXJXaWRnZXRzIiwiZW50cmllcyIsImZvckVhY2giLCJfcmVmIiwia2V5IiwiYWRkSW50ZWdyYXRpb25NYW5hZ2VyV2lkZ2V0IiwidWlVcmwiLCJEYXRlIiwiZ2V0VGltZSIsIldpZGdldFR5cGUiLCJJTlRFR1JBVElPTl9NQU5BR0VSIiwiYXBpX3VybCIsInJlbW92ZVN0aWNrZXJwaWNrZXJXaWRnZXRzIiwiX3JlZjIiLCJhZGRKaXRzaVdpZGdldCIsImlzVmlkZW9DaGFubmVsIiwib29iUm9vbU5hbWUiLCJkb21haW4iLCJKaXRzaSIsImdldEluc3RhbmNlIiwicHJlZmVycmVkRG9tYWluIiwiYXV0aCIsImdldEppdHNpQXV0aCIsInJhbmRvbVN0cmluZyIsImNvbmZJZCIsImJhc2UzMiIsInN0cmluZ2lmeSIsIkJ1ZmZlciIsImZyb20iLCJwYWQiLCJyYW5kb21VcHBlcmNhc2VTdHJpbmciLCJyYW5kb21Mb3dlcmNhc2VTdHJpbmciLCJVUkwiLCJnZXRMb2NhbEppdHNpV3JhcHBlclVybCIsInNlYXJjaCIsInNlYXJjaFBhcmFtcyIsInNldCIsIkpJVFNJIiwidG9TdHJpbmciLCJjb25mZXJlbmNlSWQiLCJyb29tTmFtZSIsImlzQXVkaW9Pbmx5IiwiQ2FsbFR5cGUiLCJWb2ljZSIsIm1ha2VBcHBDb25maWciLCJhcHBJZCIsImFwcCIsInNlbmRlclVzZXJJZCIsImV2ZW50SWQiLCJvcHRzIiwiYXJndW1lbnRzIiwicXVlcnlTdHJpbmdQYXJ0cyIsIlBsYXRmb3JtUGVnIiwic3VwcG9ydHNKaXRzaVNjcmVlbnNoYXJpbmciLCJwdXNoIiwicXVlcnlTdHJpbmciLCJqb2luIiwiYmFzZVVybCIsImxvY2F0aW9uIiwiaHJlZiIsImZvckxvY2FsUmVuZGVyIiwiZ2V0V2lkZ2V0TmFtZSIsInRyaW0iLCJfdCIsImdldFdpZGdldERhdGFUaXRsZSIsInRpdGxlIiwiZ2V0V2lkZ2V0VWlkIiwiY2FsY1dpZGdldFVpZCIsImlzQXBwV2lkZ2V0IiwiZWRpdFdpZGdldCIsIm9wZW4iLCJpc01hbmFnZWRCeU1hbmFnZXIiLCJtYW5hZ2VycyIsImhhc01hbmFnZXIiLCJleHBvcnRzIiwiZGVmYXVsdCJdLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlscy9XaWRnZXRVdGlscy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuQ29weXJpZ2h0IDIwMTkgVHJhdmlzIFJhbHN0b25cbkNvcHlyaWdodCAyMDE3IC0gMjAyMCBUaGUgTWF0cml4Lm9yZyBGb3VuZGF0aW9uIEMuSS5DLlxuXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiovXG5cbmltcG9ydCB7IGJhc2UzMiB9IGZyb20gXCJyZmM0NjQ4XCI7XG5pbXBvcnQgeyBJV2lkZ2V0LCBJV2lkZ2V0RGF0YSB9IGZyb20gXCJtYXRyaXgtd2lkZ2V0LWFwaVwiO1xuaW1wb3J0IHsgUm9vbSB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9tb2RlbHMvcm9vbVwiO1xuaW1wb3J0IHsgTWF0cml4RXZlbnQgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbW9kZWxzL2V2ZW50XCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbG9nZ2VyXCI7XG5pbXBvcnQgeyBDbGllbnRFdmVudCwgTWF0cml4Q2xpZW50LCBSb29tU3RhdGVFdmVudCB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9tYXRyaXhcIjtcbmltcG9ydCB7IENhbGxUeXBlIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL3dlYnJ0Yy9jYWxsXCI7XG5pbXBvcnQgeyByYW5kb21TdHJpbmcsIHJhbmRvbUxvd2VyY2FzZVN0cmluZywgcmFuZG9tVXBwZXJjYXNlU3RyaW5nIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL3JhbmRvbXN0cmluZ1wiO1xuXG5pbXBvcnQgUGxhdGZvcm1QZWcgZnJvbSBcIi4uL1BsYXRmb3JtUGVnXCI7XG5pbXBvcnQgU2RrQ29uZmlnIGZyb20gXCIuLi9TZGtDb25maWdcIjtcbmltcG9ydCBkaXMgZnJvbSBcIi4uL2Rpc3BhdGNoZXIvZGlzcGF0Y2hlclwiO1xuaW1wb3J0IFdpZGdldEVjaG9TdG9yZSBmcm9tIFwiLi4vc3RvcmVzL1dpZGdldEVjaG9TdG9yZVwiO1xuaW1wb3J0IHsgSW50ZWdyYXRpb25NYW5hZ2VycyB9IGZyb20gXCIuLi9pbnRlZ3JhdGlvbnMvSW50ZWdyYXRpb25NYW5hZ2Vyc1wiO1xuaW1wb3J0IHsgV2lkZ2V0VHlwZSB9IGZyb20gXCIuLi93aWRnZXRzL1dpZGdldFR5cGVcIjtcbmltcG9ydCB7IEppdHNpIH0gZnJvbSBcIi4uL3dpZGdldHMvSml0c2lcIjtcbmltcG9ydCB7IG9iamVjdENsb25lIH0gZnJvbSBcIi4vb2JqZWN0c1wiO1xuaW1wb3J0IHsgX3QgfSBmcm9tIFwiLi4vbGFuZ3VhZ2VIYW5kbGVyXCI7XG5pbXBvcnQgeyBJQXBwLCBpc0FwcFdpZGdldCB9IGZyb20gXCIuLi9zdG9yZXMvV2lkZ2V0U3RvcmVcIjtcbmltcG9ydCB7IHBhcnNlVXJsIH0gZnJvbSBcIi4vVXJsVXRpbHNcIjtcblxuLy8gSG93IGxvbmcgd2Ugd2FpdCBmb3IgdGhlIHN0YXRlIGV2ZW50IGVjaG8gdG8gY29tZSBiYWNrIGZyb20gdGhlIHNlcnZlclxuLy8gYmVmb3JlIHdhaXRGb3JbUm9vbS9Vc2VyXVdpZGdldCByZWplY3RzIGl0cyBwcm9taXNlXG5jb25zdCBXSURHRVRfV0FJVF9USU1FID0gMjAwMDA7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVdpZGdldEV2ZW50IHtcbiAgICBpZDogc3RyaW5nO1xuICAgIHR5cGU6IHN0cmluZztcbiAgICBzZW5kZXI6IHN0cmluZztcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgY2FtZWxjYXNlXG4gICAgc3RhdGVfa2V5OiBzdHJpbmc7XG4gICAgY29udGVudDogSUFwcDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBVc2VyV2lkZ2V0IGV4dGVuZHMgT21pdDxJV2lkZ2V0RXZlbnQsIFwiY29udGVudFwiPiB7XG4gICAgY29udGVudDogSVdpZGdldCAmIFBhcnRpYWw8SUFwcD47XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFdpZGdldFV0aWxzIHtcbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdXNlciBpcyBhYmxlIHRvIHNlbmQgc3RhdGUgZXZlbnRzIHRvIG1vZGlmeSB3aWRnZXRzIGluIHRoaXMgcm9vbVxuICAgICAqIChEb2VzIG5vdCBhcHBseSB0byBub24tcm9vbS1iYXNlZCAvIHVzZXIgd2lkZ2V0cylcbiAgICAgKiBAcGFyYW0gY2xpZW50IFRoZSBtYXRyaXggY2xpZW50IG9mIHRoZSBsb2dnZWQtaW4gdXNlclxuICAgICAqIEBwYXJhbSByb29tSWQgLS0gVGhlIElEIG9mIHRoZSByb29tIHRvIGNoZWNrXG4gICAgICogQHJldHVybiBCb29sZWFuIC0tIHRydWUgaWYgdGhlIHVzZXIgY2FuIG1vZGlmeSB3aWRnZXRzIGluIHRoaXMgcm9vbVxuICAgICAqIEB0aHJvd3MgRXJyb3IgLS0gc3BlY2lmaWVzIHRoZSBlcnJvciByZWFzb25cbiAgICAgKi9cbiAgICBwdWJsaWMgc3RhdGljIGNhblVzZXJNb2RpZnlXaWRnZXRzKGNsaWVudDogTWF0cml4Q2xpZW50LCByb29tSWQ/OiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKCFyb29tSWQpIHtcbiAgICAgICAgICAgIGxvZ2dlci53YXJuKFwiTm8gcm9vbSBJRCBzcGVjaWZpZWRcIik7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWNsaWVudCkge1xuICAgICAgICAgICAgbG9nZ2VyLndhcm4oXCJVc2VyIG11c3QgYmUgYmUgbG9nZ2VkIGluXCIpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgcm9vbSA9IGNsaWVudC5nZXRSb29tKHJvb21JZCk7XG4gICAgICAgIGlmICghcm9vbSkge1xuICAgICAgICAgICAgbG9nZ2VyLndhcm4oYFJvb20gSUQgJHtyb29tSWR9IGlzIG5vdCByZWNvZ25pc2VkYCk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBtZSA9IGNsaWVudC5nZXRVc2VySWQoKTtcbiAgICAgICAgaWYgKCFtZSkge1xuICAgICAgICAgICAgbG9nZ2VyLndhcm4oXCJGYWlsZWQgdG8gZ2V0IHVzZXIgSURcIik7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocm9vbS5nZXRNeU1lbWJlcnNoaXAoKSAhPT0gXCJqb2luXCIpIHtcbiAgICAgICAgICAgIGxvZ2dlci53YXJuKGBVc2VyICR7bWV9IGlzIG5vdCBpbiByb29tICR7cm9vbUlkfWApO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVE9ETzogRW5hYmxlIHN1cHBvcnQgZm9yIG0ud2lkZ2V0IGV2ZW50IHR5cGUgKGh0dHBzOi8vZ2l0aHViLmNvbS92ZWN0b3ItaW0vZWxlbWVudC13ZWIvaXNzdWVzLzEzMTExKVxuICAgICAgICByZXR1cm4gcm9vbS5jdXJyZW50U3RhdGUubWF5U2VuZFN0YXRlRXZlbnQoXCJpbS52ZWN0b3IubW9kdWxhci53aWRnZXRzXCIsIG1lKTtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiBHZW5lcmlmeSB0aGUgbmFtZSBvZiB0aGlzIGZ1bmN0aW9uLiBJdCdzIG5vdCBqdXN0IHNjYWxhci5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgc3BlY2lmaWVkIHVybCBpcyBhIHNjYWxhciBVUkwsIHR5cGljYWxseSBodHRwczovL3NjYWxhci52ZWN0b3IuaW0vYXBpXG4gICAgICogQHBhcmFtIG1hdHJpeENsaWVudCBUaGUgbWF0cml4IGNsaWVudCBvZiB0aGUgbG9nZ2VkLWluIHVzZXJcbiAgICAgKiBAcGFyYW0gIHtbdHlwZV19ICB0ZXN0VXJsU3RyaW5nIFVSTCB0byBjaGVja1xuICAgICAqIEByZXR1cm4ge0Jvb2xlYW59IFRydWUgaWYgc3BlY2lmaWVkIFVSTCBpcyBhIHNjYWxhciBVUkxcbiAgICAgKi9cbiAgICBwdWJsaWMgc3RhdGljIGlzU2NhbGFyVXJsKHRlc3RVcmxTdHJpbmc/OiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKCF0ZXN0VXJsU3RyaW5nKSB7XG4gICAgICAgICAgICBsb2dnZXIuZXJyb3IoXCJTY2FsYXIgVVJMIGNoZWNrIGZhaWxlZC4gTm8gVVJMIHNwZWNpZmllZFwiKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHRlc3RVcmwgPSBwYXJzZVVybCh0ZXN0VXJsU3RyaW5nKTtcbiAgICAgICAgbGV0IHNjYWxhclVybHMgPSBTZGtDb25maWcuZ2V0KCkuaW50ZWdyYXRpb25zX3dpZGdldHNfdXJscztcbiAgICAgICAgaWYgKCFzY2FsYXJVcmxzIHx8IHNjYWxhclVybHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBjb25zdCBkZWZhdWx0TWFuYWdlciA9IEludGVncmF0aW9uTWFuYWdlcnMuc2hhcmVkSW5zdGFuY2UoKS5nZXRQcmltYXJ5TWFuYWdlcigpO1xuICAgICAgICAgICAgaWYgKGRlZmF1bHRNYW5hZ2VyKSB7XG4gICAgICAgICAgICAgICAgc2NhbGFyVXJscyA9IFtkZWZhdWx0TWFuYWdlci5hcGlVcmxdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzY2FsYXJVcmxzID0gW107XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNjYWxhclVybHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHNjYWxhclVybCA9IHBhcnNlVXJsKHNjYWxhclVybHNbaV0pO1xuICAgICAgICAgICAgaWYgKHRlc3RVcmwgJiYgc2NhbGFyVXJsKSB7XG4gICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICB0ZXN0VXJsLnByb3RvY29sID09PSBzY2FsYXJVcmwucHJvdG9jb2wgJiZcbiAgICAgICAgICAgICAgICAgICAgdGVzdFVybC5ob3N0ID09PSBzY2FsYXJVcmwuaG9zdCAmJlxuICAgICAgICAgICAgICAgICAgICBzY2FsYXJVcmwucGF0aG5hbWUgJiZcbiAgICAgICAgICAgICAgICAgICAgdGVzdFVybC5wYXRobmFtZT8uc3RhcnRzV2l0aChzY2FsYXJVcmwucGF0aG5hbWUpXG4gICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIGEgd2lkZ2V0IHdpdGggdGhlIGdpdmVuXG4gICAgICogSUQgaGFzIGJlZW4gYWRkZWQgYXMgYSB1c2VyIHdpZGdldCAoaWUuIHRoZSBhY2NvdW50RGF0YSBldmVudFxuICAgICAqIGFycml2ZXMpIG9yIHJlamVjdHMgYWZ0ZXIgYSB0aW1lb3V0XG4gICAgICpcbiAgICAgKiBAcGFyYW0gY2xpZW50IFRoZSBtYXRyaXggY2xpZW50IG9mIHRoZSBsb2dnZWQtaW4gdXNlclxuICAgICAqIEBwYXJhbSB3aWRnZXRJZCBUaGUgSUQgb2YgdGhlIHdpZGdldCB0byB3YWl0IGZvclxuICAgICAqIEBwYXJhbSBhZGQgVHJ1ZSB0byB3YWl0IGZvciB0aGUgd2lkZ2V0IHRvIGJlIGFkZGVkLFxuICAgICAqICAgICBmYWxzZSB0byB3YWl0IGZvciBpdCB0byBiZSBkZWxldGVkLlxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlfSB0aGF0IHJlc29sdmVzIHdoZW4gdGhlIHdpZGdldCBpcyBpbiB0aGVcbiAgICAgKiAgICAgcmVxdWVzdGVkIHN0YXRlIGFjY29yZGluZyB0byB0aGUgYGFkZGAgcGFyYW1cbiAgICAgKi9cbiAgICBwdWJsaWMgc3RhdGljIHdhaXRGb3JVc2VyV2lkZ2V0KGNsaWVudDogTWF0cml4Q2xpZW50LCB3aWRnZXRJZDogc3RyaW5nLCBhZGQ6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIC8vIFRlc3RzIGFuIGFjY291bnQgZGF0YSBldmVudCwgcmV0dXJuaW5nIHRydWUgaWYgaXQncyBpbiB0aGUgc3RhdGVcbiAgICAgICAgICAgIC8vIHdlJ3JlIHdhaXRpbmcgZm9yIGl0IHRvIGJlIGluXG4gICAgICAgICAgICBmdW5jdGlvbiBldmVudEluSW50ZW5kZWRTdGF0ZShldj86IE1hdHJpeEV2ZW50KTogYm9vbGVhbiB7XG4gICAgICAgICAgICAgICAgaWYgKCFldikgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIGlmIChhZGQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGV2LmdldENvbnRlbnQoKVt3aWRnZXRJZF0gIT09IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXYuZ2V0Q29udGVudCgpW3dpZGdldElkXSA9PT0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgc3RhcnRpbmdBY2NvdW50RGF0YUV2ZW50ID0gY2xpZW50LmdldEFjY291bnREYXRhKFwibS53aWRnZXRzXCIpO1xuICAgICAgICAgICAgaWYgKGV2ZW50SW5JbnRlbmRlZFN0YXRlKHN0YXJ0aW5nQWNjb3VudERhdGFFdmVudCkpIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmdW5jdGlvbiBvbkFjY291bnREYXRhKGV2OiBNYXRyaXhFdmVudCk6IHZvaWQge1xuICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRBY2NvdW50RGF0YUV2ZW50ID0gY2xpZW50LmdldEFjY291bnREYXRhKFwibS53aWRnZXRzXCIpO1xuICAgICAgICAgICAgICAgIGlmIChldmVudEluSW50ZW5kZWRTdGF0ZShjdXJyZW50QWNjb3VudERhdGFFdmVudCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY2xpZW50LnJlbW92ZUxpc3RlbmVyKENsaWVudEV2ZW50LkFjY291bnREYXRhLCBvbkFjY291bnREYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVySWQpO1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgdGltZXJJZCA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICBjbGllbnQucmVtb3ZlTGlzdGVuZXIoQ2xpZW50RXZlbnQuQWNjb3VudERhdGEsIG9uQWNjb3VudERhdGEpO1xuICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoXCJUaW1lZCBvdXQgd2FpdGluZyBmb3Igd2lkZ2V0IElEIFwiICsgd2lkZ2V0SWQgKyBcIiB0byBhcHBlYXJcIikpO1xuICAgICAgICAgICAgfSwgV0lER0VUX1dBSVRfVElNRSk7XG4gICAgICAgICAgICBjbGllbnQub24oQ2xpZW50RXZlbnQuQWNjb3VudERhdGEsIG9uQWNjb3VudERhdGEpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdoZW4gYSB3aWRnZXQgd2l0aCB0aGUgZ2l2ZW5cbiAgICAgKiBJRCBoYXMgYmVlbiBhZGRlZCBhcyBhIHJvb20gd2lkZ2V0IGluIHRoZSBnaXZlbiByb29tIChpZS4gdGhlXG4gICAgICogcm9vbSBzdGF0ZSBldmVudCBhcnJpdmVzKSBvciByZWplY3RzIGFmdGVyIGEgdGltZW91dFxuICAgICAqXG4gICAgICogQHBhcmFtIGNsaWVudCBUaGUgbWF0cml4IGNsaWVudCBvZiB0aGUgbG9nZ2VkLWluIHVzZXJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gd2lkZ2V0SWQgVGhlIElEIG9mIHRoZSB3aWRnZXQgdG8gd2FpdCBmb3JcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gcm9vbUlkIFRoZSBJRCBvZiB0aGUgcm9vbSB0byB3YWl0IGZvciB0aGUgd2lkZ2V0IGluXG4gICAgICogQHBhcmFtIHtib29sZWFufSBhZGQgVHJ1ZSB0byB3YWl0IGZvciB0aGUgd2lkZ2V0IHRvIGJlIGFkZGVkLFxuICAgICAqICAgICBmYWxzZSB0byB3YWl0IGZvciBpdCB0byBiZSBkZWxldGVkLlxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlfSB0aGF0IHJlc29sdmVzIHdoZW4gdGhlIHdpZGdldCBpcyBpbiB0aGVcbiAgICAgKiAgICAgcmVxdWVzdGVkIHN0YXRlIGFjY29yZGluZyB0byB0aGUgYGFkZGAgcGFyYW1cbiAgICAgKi9cbiAgICBwdWJsaWMgc3RhdGljIHdhaXRGb3JSb29tV2lkZ2V0KFxuICAgICAgICBjbGllbnQ6IE1hdHJpeENsaWVudCxcbiAgICAgICAgd2lkZ2V0SWQ6IHN0cmluZyxcbiAgICAgICAgcm9vbUlkOiBzdHJpbmcsXG4gICAgICAgIGFkZDogYm9vbGVhbixcbiAgICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIC8vIFRlc3RzIGEgbGlzdCBvZiBzdGF0ZSBldmVudHMsIHJldHVybmluZyB0cnVlIGlmIGl0J3MgaW4gdGhlIHN0YXRlXG4gICAgICAgICAgICAvLyB3ZSdyZSB3YWl0aW5nIGZvciBpdCB0byBiZSBpblxuICAgICAgICAgICAgZnVuY3Rpb24gZXZlbnRzSW5JbnRlbmRlZFN0YXRlKGV2TGlzdD86IE1hdHJpeEV2ZW50W10pOiBib29sZWFuIHtcbiAgICAgICAgICAgICAgICBjb25zdCB3aWRnZXRQcmVzZW50ID0gZXZMaXN0Py5zb21lKChldikgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXYuZ2V0Q29udGVudCgpICYmIGV2LmdldENvbnRlbnQoKVtcImlkXCJdID09PSB3aWRnZXRJZDtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAoYWRkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAhIXdpZGdldFByZXNlbnQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICF3aWRnZXRQcmVzZW50O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgcm9vbSA9IGNsaWVudC5nZXRSb29tKHJvb21JZCk7XG4gICAgICAgICAgICAvLyBUT0RPOiBFbmFibGUgc3VwcG9ydCBmb3IgbS53aWRnZXQgZXZlbnQgdHlwZSAoaHR0cHM6Ly9naXRodWIuY29tL3ZlY3Rvci1pbS9lbGVtZW50LXdlYi9pc3N1ZXMvMTMxMTEpXG4gICAgICAgICAgICBjb25zdCBzdGFydGluZ1dpZGdldEV2ZW50cyA9IHJvb20/LmN1cnJlbnRTdGF0ZS5nZXRTdGF0ZUV2ZW50cyhcImltLnZlY3Rvci5tb2R1bGFyLndpZGdldHNcIik7XG4gICAgICAgICAgICBpZiAoZXZlbnRzSW5JbnRlbmRlZFN0YXRlKHN0YXJ0aW5nV2lkZ2V0RXZlbnRzKSkge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIG9uUm9vbVN0YXRlRXZlbnRzKGV2OiBNYXRyaXhFdmVudCk6IHZvaWQge1xuICAgICAgICAgICAgICAgIGlmIChldi5nZXRSb29tSWQoKSAhPT0gcm9vbUlkIHx8IGV2LmdldFR5cGUoKSAhPT0gXCJpbS52ZWN0b3IubW9kdWxhci53aWRnZXRzXCIpIHJldHVybjtcblxuICAgICAgICAgICAgICAgIC8vIFRPRE86IEVuYWJsZSBzdXBwb3J0IGZvciBtLndpZGdldCBldmVudCB0eXBlIChodHRwczovL2dpdGh1Yi5jb20vdmVjdG9yLWltL2VsZW1lbnQtd2ViL2lzc3Vlcy8xMzExMSlcbiAgICAgICAgICAgICAgICBjb25zdCBjdXJyZW50V2lkZ2V0RXZlbnRzID0gcm9vbT8uY3VycmVudFN0YXRlLmdldFN0YXRlRXZlbnRzKFwiaW0udmVjdG9yLm1vZHVsYXIud2lkZ2V0c1wiKTtcblxuICAgICAgICAgICAgICAgIGlmIChldmVudHNJbkludGVuZGVkU3RhdGUoY3VycmVudFdpZGdldEV2ZW50cykpIHtcbiAgICAgICAgICAgICAgICAgICAgY2xpZW50LnJlbW92ZUxpc3RlbmVyKFJvb21TdGF0ZUV2ZW50LkV2ZW50cywgb25Sb29tU3RhdGVFdmVudHMpO1xuICAgICAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQodGltZXJJZCk7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCB0aW1lcklkID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNsaWVudC5yZW1vdmVMaXN0ZW5lcihSb29tU3RhdGVFdmVudC5FdmVudHMsIG9uUm9vbVN0YXRlRXZlbnRzKTtcbiAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKFwiVGltZWQgb3V0IHdhaXRpbmcgZm9yIHdpZGdldCBJRCBcIiArIHdpZGdldElkICsgXCIgdG8gYXBwZWFyXCIpKTtcbiAgICAgICAgICAgIH0sIFdJREdFVF9XQUlUX1RJTUUpO1xuICAgICAgICAgICAgY2xpZW50Lm9uKFJvb21TdGF0ZUV2ZW50LkV2ZW50cywgb25Sb29tU3RhdGVFdmVudHMpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc3RhdGljIHNldFVzZXJXaWRnZXQoXG4gICAgICAgIGNsaWVudDogTWF0cml4Q2xpZW50LFxuICAgICAgICB3aWRnZXRJZDogc3RyaW5nLFxuICAgICAgICB3aWRnZXRUeXBlOiBXaWRnZXRUeXBlLFxuICAgICAgICB3aWRnZXRVcmw6IHN0cmluZyxcbiAgICAgICAgd2lkZ2V0TmFtZTogc3RyaW5nLFxuICAgICAgICB3aWRnZXREYXRhOiBJV2lkZ2V0RGF0YSxcbiAgICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgLy8gR2V0IHRoZSBjdXJyZW50IHdpZGdldHMgYW5kIGNsb25lIHRoZW0gYmVmb3JlIHdlIG1vZGlmeSB0aGVtLCBvdGhlcndpc2VcbiAgICAgICAgLy8gd2UnbGwgbW9kaWZ5IHRoZSBjb250ZW50IG9mIHRoZSBvbGQgZXZlbnQuXG4gICAgICAgIGNvbnN0IHVzZXJXaWRnZXRzID0gb2JqZWN0Q2xvbmUoV2lkZ2V0VXRpbHMuZ2V0VXNlcldpZGdldHMoY2xpZW50KSk7XG5cbiAgICAgICAgLy8gRGVsZXRlIGV4aXN0aW5nIHdpZGdldCB3aXRoIElEXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBkZWxldGUgdXNlcldpZGdldHNbd2lkZ2V0SWRdO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBsb2dnZXIuZXJyb3IoYCR3aWRnZXRJZCBpcyBub24tY29uZmlndXJhYmxlYCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhZGRpbmdXaWRnZXQgPSBCb29sZWFuKHdpZGdldFVybCk7XG5cbiAgICAgICAgY29uc3QgdXNlcklkID0gY2xpZW50LmdldFNhZmVVc2VySWQoKTtcblxuICAgICAgICBjb25zdCBjb250ZW50ID0ge1xuICAgICAgICAgICAgaWQ6IHdpZGdldElkLFxuICAgICAgICAgICAgdHlwZTogd2lkZ2V0VHlwZS5wcmVmZXJyZWQsXG4gICAgICAgICAgICB1cmw6IHdpZGdldFVybCxcbiAgICAgICAgICAgIG5hbWU6IHdpZGdldE5hbWUsXG4gICAgICAgICAgICBkYXRhOiB3aWRnZXREYXRhLFxuICAgICAgICAgICAgY3JlYXRvclVzZXJJZDogdXNlcklkLFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIEFkZCBuZXcgd2lkZ2V0IC8gdXBkYXRlXG4gICAgICAgIGlmIChhZGRpbmdXaWRnZXQpIHtcbiAgICAgICAgICAgIHVzZXJXaWRnZXRzW3dpZGdldElkXSA9IHtcbiAgICAgICAgICAgICAgICBjb250ZW50OiBjb250ZW50LFxuICAgICAgICAgICAgICAgIHNlbmRlcjogdXNlcklkLFxuICAgICAgICAgICAgICAgIHN0YXRlX2tleTogd2lkZ2V0SWQsXG4gICAgICAgICAgICAgICAgdHlwZTogXCJtLndpZGdldFwiLFxuICAgICAgICAgICAgICAgIGlkOiB3aWRnZXRJZCxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUaGlzIHN0YXJ0cyBsaXN0ZW5pbmcgZm9yIHdoZW4gdGhlIGVjaG8gY29tZXMgYmFjayBmcm9tIHRoZSBzZXJ2ZXJcbiAgICAgICAgLy8gc2luY2UgdGhlIHdpZGdldCB3b24ndCBhcHBlYXIgYWRkZWQgdW50aWwgdGhpcyBoYXBwZW5zLiBJZiB3ZSBkb24ndFxuICAgICAgICAvLyB3YWl0IGZvciB0aGlzLCB0aGUgYWN0aW9uIHdpbGwgY29tcGxldGUgYnV0IGlmIHRoZSB1c2VyIGlzIGZhc3QgZW5vdWdoLFxuICAgICAgICAvLyB0aGUgd2lkZ2V0IHN0aWxsIHdvbid0IGFjdHVhbGx5IGJlIHRoZXJlLlxuICAgICAgICByZXR1cm4gY2xpZW50XG4gICAgICAgICAgICAuc2V0QWNjb3VudERhdGEoXCJtLndpZGdldHNcIiwgdXNlcldpZGdldHMpXG4gICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFdpZGdldFV0aWxzLndhaXRGb3JVc2VyV2lkZ2V0KGNsaWVudCwgd2lkZ2V0SWQsIGFkZGluZ1dpZGdldCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIGRpcy5kaXNwYXRjaCh7IGFjdGlvbjogXCJ1c2VyX3dpZGdldF91cGRhdGVkXCIgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc3RhdGljIHNldFJvb21XaWRnZXQoXG4gICAgICAgIGNsaWVudDogTWF0cml4Q2xpZW50LFxuICAgICAgICByb29tSWQ6IHN0cmluZyxcbiAgICAgICAgd2lkZ2V0SWQ6IHN0cmluZyxcbiAgICAgICAgd2lkZ2V0VHlwZT86IFdpZGdldFR5cGUsXG4gICAgICAgIHdpZGdldFVybD86IHN0cmluZyxcbiAgICAgICAgd2lkZ2V0TmFtZT86IHN0cmluZyxcbiAgICAgICAgd2lkZ2V0RGF0YT86IElXaWRnZXREYXRhLFxuICAgICAgICB3aWRnZXRBdmF0YXJVcmw/OiBzdHJpbmcsXG4gICAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGxldCBjb250ZW50OiBQYXJ0aWFsPElXaWRnZXQ+ICYgeyBhdmF0YXJfdXJsPzogc3RyaW5nIH07XG5cbiAgICAgICAgY29uc3QgYWRkaW5nV2lkZ2V0ID0gQm9vbGVhbih3aWRnZXRVcmwpO1xuXG4gICAgICAgIGlmIChhZGRpbmdXaWRnZXQpIHtcbiAgICAgICAgICAgIGNvbnRlbnQgPSB7XG4gICAgICAgICAgICAgICAgLy8gVE9ETzogRW5hYmxlIHN1cHBvcnQgZm9yIG0ud2lkZ2V0IGV2ZW50IHR5cGUgKGh0dHBzOi8vZ2l0aHViLmNvbS92ZWN0b3ItaW0vZWxlbWVudC13ZWIvaXNzdWVzLzEzMTExKVxuICAgICAgICAgICAgICAgIC8vIEZvciBub3cgd2UnbGwgc2VuZCB0aGUgbGVnYWN5IGV2ZW50IHR5cGUgZm9yIGNvbXBhdGliaWxpdHkgd2l0aCBvbGRlciBhcHBzL2VsZW1lbnRzXG4gICAgICAgICAgICAgICAgdHlwZTogd2lkZ2V0VHlwZT8ubGVnYWN5LFxuICAgICAgICAgICAgICAgIHVybDogd2lkZ2V0VXJsLFxuICAgICAgICAgICAgICAgIG5hbWU6IHdpZGdldE5hbWUsXG4gICAgICAgICAgICAgICAgZGF0YTogd2lkZ2V0RGF0YSxcbiAgICAgICAgICAgICAgICBhdmF0YXJfdXJsOiB3aWRnZXRBdmF0YXJVcmwsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29udGVudCA9IHt9O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIFdpZGdldFV0aWxzLnNldFJvb21XaWRnZXRDb250ZW50KGNsaWVudCwgcm9vbUlkLCB3aWRnZXRJZCwgY29udGVudCBhcyBJV2lkZ2V0KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc3RhdGljIHNldFJvb21XaWRnZXRDb250ZW50KFxuICAgICAgICBjbGllbnQ6IE1hdHJpeENsaWVudCxcbiAgICAgICAgcm9vbUlkOiBzdHJpbmcsXG4gICAgICAgIHdpZGdldElkOiBzdHJpbmcsXG4gICAgICAgIGNvbnRlbnQ6IElXaWRnZXQsXG4gICAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGNvbnN0IGFkZGluZ1dpZGdldCA9ICEhY29udGVudC51cmw7XG5cbiAgICAgICAgV2lkZ2V0RWNob1N0b3JlLnNldFJvb21XaWRnZXRFY2hvKHJvb21JZCwgd2lkZ2V0SWQsIGNvbnRlbnQpO1xuXG4gICAgICAgIC8vIFRPRE86IEVuYWJsZSBzdXBwb3J0IGZvciBtLndpZGdldCBldmVudCB0eXBlIChodHRwczovL2dpdGh1Yi5jb20vdmVjdG9yLWltL2VsZW1lbnQtd2ViL2lzc3Vlcy8xMzExMSlcbiAgICAgICAgcmV0dXJuIGNsaWVudFxuICAgICAgICAgICAgLnNlbmRTdGF0ZUV2ZW50KHJvb21JZCwgXCJpbS52ZWN0b3IubW9kdWxhci53aWRnZXRzXCIsIGNvbnRlbnQsIHdpZGdldElkKVxuICAgICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBXaWRnZXRVdGlscy53YWl0Rm9yUm9vbVdpZGdldChjbGllbnQsIHdpZGdldElkLCByb29tSWQsIGFkZGluZ1dpZGdldCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgICAgICAgICAgIFdpZGdldEVjaG9TdG9yZS5yZW1vdmVSb29tV2lkZ2V0RWNobyhyb29tSWQsIHdpZGdldElkKTtcbiAgICAgICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCByb29tIHNwZWNpZmljIHdpZGdldHNcbiAgICAgKiBAcGFyYW0gIHtSb29tfSByb29tIFRoZSByb29tIHRvIGdldCB3aWRnZXRzIGZvcmNlXG4gICAgICogQHJldHVybiB7W29iamVjdF19IEFycmF5IGNvbnRhaW5pbmcgY3VycmVudCAvIGFjdGl2ZSByb29tIHdpZGdldHNcbiAgICAgKi9cbiAgICBwdWJsaWMgc3RhdGljIGdldFJvb21XaWRnZXRzKHJvb206IFJvb20pOiBNYXRyaXhFdmVudFtdIHtcbiAgICAgICAgLy8gVE9ETzogRW5hYmxlIHN1cHBvcnQgZm9yIG0ud2lkZ2V0IGV2ZW50IHR5cGUgKGh0dHBzOi8vZ2l0aHViLmNvbS92ZWN0b3ItaW0vZWxlbWVudC13ZWIvaXNzdWVzLzEzMTExKVxuICAgICAgICBjb25zdCBhcHBzU3RhdGVFdmVudHMgPSByb29tLmN1cnJlbnRTdGF0ZS5nZXRTdGF0ZUV2ZW50cyhcImltLnZlY3Rvci5tb2R1bGFyLndpZGdldHNcIik7XG4gICAgICAgIGlmICghYXBwc1N0YXRlRXZlbnRzKSB7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYXBwc1N0YXRlRXZlbnRzLmZpbHRlcigoZXYpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBldi5nZXRDb250ZW50KCkudHlwZSAmJiBldi5nZXRDb250ZW50KCkudXJsO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdXNlciBzcGVjaWZpYyB3aWRnZXRzIChub3QgbGlua2VkIHRvIGEgc3BlY2lmaWMgcm9vbSlcbiAgICAgKiBAcGFyYW0gY2xpZW50IFRoZSBtYXRyaXggY2xpZW50IG9mIHRoZSBsb2dnZWQtaW4gdXNlclxuICAgICAqIEByZXR1cm4ge29iamVjdH0gRXZlbnQgY29udGVudCBvYmplY3QgY29udGFpbmluZyBjdXJyZW50IC8gYWN0aXZlIHVzZXIgd2lkZ2V0c1xuICAgICAqL1xuICAgIHB1YmxpYyBzdGF0aWMgZ2V0VXNlcldpZGdldHMoY2xpZW50OiBNYXRyaXhDbGllbnQgfCB1bmRlZmluZWQpOiBSZWNvcmQ8c3RyaW5nLCBVc2VyV2lkZ2V0PiB7XG4gICAgICAgIGlmICghY2xpZW50KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVc2VyIG5vdCBsb2dnZWQgaW5cIik7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdXNlcldpZGdldHMgPSBjbGllbnQuZ2V0QWNjb3VudERhdGEoXCJtLndpZGdldHNcIik7XG4gICAgICAgIGlmICh1c2VyV2lkZ2V0cyAmJiB1c2VyV2lkZ2V0cy5nZXRDb250ZW50KCkpIHtcbiAgICAgICAgICAgIHJldHVybiB1c2VyV2lkZ2V0cy5nZXRDb250ZW50KCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHt9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB1c2VyIHNwZWNpZmljIHdpZGdldHMgKG5vdCBsaW5rZWQgdG8gYSBzcGVjaWZpYyByb29tKSBhcyBhbiBhcnJheVxuICAgICAqIEBwYXJhbSBjbGllbnQgVGhlIG1hdHJpeCBjbGllbnQgb2YgdGhlIGxvZ2dlZC1pbiB1c2VyXG4gICAgICogQHJldHVybiB7W29iamVjdF19IEFycmF5IGNvbnRhaW5pbmcgY3VycmVudCAvIGFjdGl2ZSB1c2VyIHdpZGdldHNcbiAgICAgKi9cbiAgICBwdWJsaWMgc3RhdGljIGdldFVzZXJXaWRnZXRzQXJyYXkoY2xpZW50OiBNYXRyaXhDbGllbnQgfCB1bmRlZmluZWQpOiBVc2VyV2lkZ2V0W10ge1xuICAgICAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyhXaWRnZXRVdGlscy5nZXRVc2VyV2lkZ2V0cyhjbGllbnQpKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgYWN0aXZlIHN0aWNrZXJwaWNrZXIgd2lkZ2V0cyAoc3RpY2tlcnBpY2tlcnMgYXJlIHVzZXIgd2lkZ2V0cyBieSBuYXR1cmUpXG4gICAgICogQHBhcmFtIGNsaWVudCBUaGUgbWF0cml4IGNsaWVudCBvZiB0aGUgbG9nZ2VkLWluIHVzZXJcbiAgICAgKiBAcmV0dXJuIHtbb2JqZWN0XX0gQXJyYXkgY29udGFpbmluZyBjdXJyZW50IC8gYWN0aXZlIHN0aWNrZXJwaWNrZXIgd2lkZ2V0c1xuICAgICAqL1xuICAgIHB1YmxpYyBzdGF0aWMgZ2V0U3RpY2tlcnBpY2tlcldpZGdldHMoY2xpZW50OiBNYXRyaXhDbGllbnQgfCB1bmRlZmluZWQpOiBVc2VyV2lkZ2V0W10ge1xuICAgICAgICBjb25zdCB3aWRnZXRzID0gV2lkZ2V0VXRpbHMuZ2V0VXNlcldpZGdldHNBcnJheShjbGllbnQpO1xuICAgICAgICByZXR1cm4gd2lkZ2V0cy5maWx0ZXIoKHdpZGdldCkgPT4gd2lkZ2V0LmNvbnRlbnQ/LnR5cGUgPT09IFwibS5zdGlja2VycGlja2VyXCIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBhbGwgaW50ZWdyYXRpb24gbWFuYWdlciB3aWRnZXRzIGZvciB0aGlzIHVzZXIuXG4gICAgICogQHBhcmFtIGNsaWVudCBUaGUgbWF0cml4IGNsaWVudCBvZiB0aGUgbG9nZ2VkLWluIHVzZXJcbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0W119IEFuIGFycmF5IG9mIGludGVncmF0aW9uIG1hbmFnZXIgdXNlciB3aWRnZXRzLlxuICAgICAqL1xuICAgIHB1YmxpYyBzdGF0aWMgZ2V0SW50ZWdyYXRpb25NYW5hZ2VyV2lkZ2V0cyhjbGllbnQ6IE1hdHJpeENsaWVudCB8IHVuZGVmaW5lZCk6IFVzZXJXaWRnZXRbXSB7XG4gICAgICAgIGNvbnN0IHdpZGdldHMgPSBXaWRnZXRVdGlscy5nZXRVc2VyV2lkZ2V0c0FycmF5KGNsaWVudCk7XG4gICAgICAgIHJldHVybiB3aWRnZXRzLmZpbHRlcigodykgPT4gdy5jb250ZW50Py50eXBlID09PSBcIm0uaW50ZWdyYXRpb25fbWFuYWdlclwiKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc3RhdGljIGdldFJvb21XaWRnZXRzT2ZUeXBlKHJvb206IFJvb20sIHR5cGU6IFdpZGdldFR5cGUpOiBNYXRyaXhFdmVudFtdIHtcbiAgICAgICAgY29uc3Qgd2lkZ2V0cyA9IFdpZGdldFV0aWxzLmdldFJvb21XaWRnZXRzKHJvb20pIHx8IFtdO1xuICAgICAgICByZXR1cm4gd2lkZ2V0cy5maWx0ZXIoKHcpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSB3LmdldENvbnRlbnQoKTtcbiAgICAgICAgICAgIHJldHVybiBjb250ZW50LnVybCAmJiB0eXBlLm1hdGNoZXMoY29udGVudC50eXBlKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHVibGljIHN0YXRpYyBhc3luYyByZW1vdmVJbnRlZ3JhdGlvbk1hbmFnZXJXaWRnZXRzKGNsaWVudDogTWF0cml4Q2xpZW50IHwgdW5kZWZpbmVkKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGlmICghY2xpZW50KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVc2VyIG5vdCBsb2dnZWQgaW5cIik7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgd2lkZ2V0cyA9IGNsaWVudC5nZXRBY2NvdW50RGF0YShcIm0ud2lkZ2V0c1wiKTtcbiAgICAgICAgaWYgKCF3aWRnZXRzKSByZXR1cm47XG4gICAgICAgIGNvbnN0IHVzZXJXaWRnZXRzOiBSZWNvcmQ8c3RyaW5nLCBJV2lkZ2V0RXZlbnQ+ID0gd2lkZ2V0cy5nZXRDb250ZW50KCkgfHwge307XG4gICAgICAgIE9iamVjdC5lbnRyaWVzKHVzZXJXaWRnZXRzKS5mb3JFYWNoKChba2V5LCB3aWRnZXRdKSA9PiB7XG4gICAgICAgICAgICBpZiAod2lkZ2V0LmNvbnRlbnQgJiYgd2lkZ2V0LmNvbnRlbnQudHlwZSA9PT0gXCJtLmludGVncmF0aW9uX21hbmFnZXJcIikge1xuICAgICAgICAgICAgICAgIGRlbGV0ZSB1c2VyV2lkZ2V0c1trZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgYXdhaXQgY2xpZW50LnNldEFjY291bnREYXRhKFwibS53aWRnZXRzXCIsIHVzZXJXaWRnZXRzKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc3RhdGljIGFkZEludGVncmF0aW9uTWFuYWdlcldpZGdldChcbiAgICAgICAgY2xpZW50OiBNYXRyaXhDbGllbnQsXG4gICAgICAgIG5hbWU6IHN0cmluZyxcbiAgICAgICAgdWlVcmw6IHN0cmluZyxcbiAgICAgICAgYXBpVXJsOiBzdHJpbmcsXG4gICAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIHJldHVybiBXaWRnZXRVdGlscy5zZXRVc2VyV2lkZ2V0KFxuICAgICAgICAgICAgY2xpZW50LFxuICAgICAgICAgICAgXCJpbnRlZ3JhdGlvbl9tYW5hZ2VyX1wiICsgbmV3IERhdGUoKS5nZXRUaW1lKCksXG4gICAgICAgICAgICBXaWRnZXRUeXBlLklOVEVHUkFUSU9OX01BTkFHRVIsXG4gICAgICAgICAgICB1aVVybCxcbiAgICAgICAgICAgIFwiSW50ZWdyYXRpb24gbWFuYWdlcjogXCIgKyBuYW1lLFxuICAgICAgICAgICAgeyBhcGlfdXJsOiBhcGlVcmwgfSxcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgYWxsIHN0aWNrZXJwaWNrZXIgd2lkZ2V0cyAoc3RpY2tlcnBpY2tlcnMgYXJlIHVzZXIgd2lkZ2V0cyBieSBuYXR1cmUpXG4gICAgICogQHBhcmFtIGNsaWVudCBUaGUgbWF0cml4IGNsaWVudCBvZiB0aGUgbG9nZ2VkLWluIHVzZXJcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSBSZXNvbHZlcyBvbiBhY2NvdW50IGRhdGEgdXBkYXRlZFxuICAgICAqL1xuICAgIHB1YmxpYyBzdGF0aWMgYXN5bmMgcmVtb3ZlU3RpY2tlcnBpY2tlcldpZGdldHMoY2xpZW50OiBNYXRyaXhDbGllbnQgfCB1bmRlZmluZWQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgaWYgKCFjbGllbnQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlVzZXIgbm90IGxvZ2dlZCBpblwiKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB3aWRnZXRzID0gY2xpZW50LmdldEFjY291bnREYXRhKFwibS53aWRnZXRzXCIpO1xuICAgICAgICBpZiAoIXdpZGdldHMpIHJldHVybjtcbiAgICAgICAgY29uc3QgdXNlcldpZGdldHM6IFJlY29yZDxzdHJpbmcsIElXaWRnZXRFdmVudD4gPSB3aWRnZXRzLmdldENvbnRlbnQoKSB8fCB7fTtcbiAgICAgICAgT2JqZWN0LmVudHJpZXModXNlcldpZGdldHMpLmZvckVhY2goKFtrZXksIHdpZGdldF0pID0+IHtcbiAgICAgICAgICAgIGlmICh3aWRnZXQuY29udGVudCAmJiB3aWRnZXQuY29udGVudC50eXBlID09PSBcIm0uc3RpY2tlcnBpY2tlclwiKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIHVzZXJXaWRnZXRzW2tleV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBhd2FpdCBjbGllbnQuc2V0QWNjb3VudERhdGEoXCJtLndpZGdldHNcIiwgdXNlcldpZGdldHMpO1xuICAgIH1cblxuICAgIHB1YmxpYyBzdGF0aWMgYXN5bmMgYWRkSml0c2lXaWRnZXQoXG4gICAgICAgIGNsaWVudDogTWF0cml4Q2xpZW50LFxuICAgICAgICByb29tSWQ6IHN0cmluZyxcbiAgICAgICAgdHlwZTogQ2FsbFR5cGUsXG4gICAgICAgIG5hbWU6IHN0cmluZyxcbiAgICAgICAgaXNWaWRlb0NoYW5uZWw6IGJvb2xlYW4sXG4gICAgICAgIG9vYlJvb21OYW1lPzogc3RyaW5nLFxuICAgICk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCBkb21haW4gPSBKaXRzaS5nZXRJbnN0YW5jZSgpLnByZWZlcnJlZERvbWFpbjtcbiAgICAgICAgY29uc3QgYXV0aCA9IChhd2FpdCBKaXRzaS5nZXRJbnN0YW5jZSgpLmdldEppdHNpQXV0aCgpKSA/PyB1bmRlZmluZWQ7XG4gICAgICAgIGNvbnN0IHdpZGdldElkID0gcmFuZG9tU3RyaW5nKDI0KTsgLy8gTXVzdCBiZSBnbG9iYWxseSB1bmlxdWVcblxuICAgICAgICBsZXQgY29uZklkOiBzdHJpbmc7XG4gICAgICAgIGlmIChhdXRoID09PSBcIm9wZW5pZHRva2VuLWp3dFwiKSB7XG4gICAgICAgICAgICAvLyBDcmVhdGUgY29uZmVyZW5jZSBJRCBmcm9tIHJvb20gSURcbiAgICAgICAgICAgIC8vIEZvciBjb21wYXRpYmlsaXR5IHdpdGggSml0c2ksIHVzZSBiYXNlMzIgd2l0aG91dCBwYWRkaW5nLlxuICAgICAgICAgICAgLy8gTW9yZSBkZXRhaWxzIGhlcmU6XG4gICAgICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vbWF0cml4LW9yZy9wcm9zb2R5LW1vZC1hdXRoLW1hdHJpeC11c2VyLXZlcmlmaWNhdGlvblxuICAgICAgICAgICAgY29uZklkID0gYmFzZTMyLnN0cmluZ2lmeShCdWZmZXIuZnJvbShyb29tSWQpLCB7IHBhZDogZmFsc2UgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBDcmVhdGUgYSByYW5kb20gY29uZmVyZW5jZSBJRFxuICAgICAgICAgICAgY29uZklkID0gYEppdHNpJHtyYW5kb21VcHBlcmNhc2VTdHJpbmcoMSl9JHtyYW5kb21Mb3dlcmNhc2VTdHJpbmcoMjMpfWA7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUT0RPOiBSZW1vdmUgVVJMIGhhY2tzIHdoZW4gdGhlIG1vYmlsZSBjbGllbnRzIGV2ZW50dWFsbHkgc3VwcG9ydCB2MiB3aWRnZXRzXG4gICAgICAgIGNvbnN0IHdpZGdldFVybCA9IG5ldyBVUkwoV2lkZ2V0VXRpbHMuZ2V0TG9jYWxKaXRzaVdyYXBwZXJVcmwoeyBhdXRoIH0pKTtcbiAgICAgICAgd2lkZ2V0VXJsLnNlYXJjaCA9IFwiXCI7IC8vIENhdXNlcyB0aGUgVVJMIGNsYXNzIHVzZSBzZWFyY2hQYXJhbXMgaW5zdGVhZFxuICAgICAgICB3aWRnZXRVcmwuc2VhcmNoUGFyYW1zLnNldChcImNvbmZJZFwiLCBjb25mSWQpO1xuXG4gICAgICAgIGF3YWl0IFdpZGdldFV0aWxzLnNldFJvb21XaWRnZXQoY2xpZW50LCByb29tSWQsIHdpZGdldElkLCBXaWRnZXRUeXBlLkpJVFNJLCB3aWRnZXRVcmwudG9TdHJpbmcoKSwgbmFtZSwge1xuICAgICAgICAgICAgY29uZmVyZW5jZUlkOiBjb25mSWQsXG4gICAgICAgICAgICByb29tTmFtZTogb29iUm9vbU5hbWUgPz8gY2xpZW50LmdldFJvb20ocm9vbUlkKT8ubmFtZSxcbiAgICAgICAgICAgIGlzQXVkaW9Pbmx5OiB0eXBlID09PSBDYWxsVHlwZS5Wb2ljZSxcbiAgICAgICAgICAgIGlzVmlkZW9DaGFubmVsLFxuICAgICAgICAgICAgZG9tYWluLFxuICAgICAgICAgICAgYXV0aCxcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHVibGljIHN0YXRpYyBtYWtlQXBwQ29uZmlnKFxuICAgICAgICBhcHBJZDogc3RyaW5nLFxuICAgICAgICBhcHA6IFBhcnRpYWw8SUFwcD4sXG4gICAgICAgIHNlbmRlclVzZXJJZDogc3RyaW5nLFxuICAgICAgICByb29tSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgICAgICAgZXZlbnRJZDogc3RyaW5nIHwgdW5kZWZpbmVkLFxuICAgICk6IElBcHAge1xuICAgICAgICBpZiAoIXNlbmRlclVzZXJJZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiV2lkZ2V0cyBtdXN0IGJlIGNyZWF0ZWQgYnkgc29tZW9uZSAtIHByb3ZpZGUgYSBzZW5kZXJVc2VySWRcIik7XG4gICAgICAgIH1cbiAgICAgICAgYXBwLmNyZWF0b3JVc2VySWQgPSBzZW5kZXJVc2VySWQ7XG5cbiAgICAgICAgYXBwLmlkID0gYXBwSWQ7XG4gICAgICAgIGFwcC5yb29tSWQgPSByb29tSWQ7XG4gICAgICAgIGFwcC5ldmVudElkID0gZXZlbnRJZDtcbiAgICAgICAgYXBwLm5hbWUgPSBhcHAubmFtZSB8fCBhcHAudHlwZTtcblxuICAgICAgICByZXR1cm4gYXBwIGFzIElBcHA7XG4gICAgfVxuXG4gICAgcHVibGljIHN0YXRpYyBnZXRMb2NhbEppdHNpV3JhcHBlclVybChvcHRzOiB7IGZvckxvY2FsUmVuZGVyPzogYm9vbGVhbjsgYXV0aD86IHN0cmluZyB9ID0ge30pOiBzdHJpbmcge1xuICAgICAgICAvLyBOQi4gd2UgY2FuJ3QganVzdCBlbmNvZGVVUklDb21wb25lbnQgYWxsIG9mIHRoZXNlIGJlY2F1c2UgdGhlICQgc2lnbnMgbmVlZCB0byBiZSB0aGVyZVxuICAgICAgICBjb25zdCBxdWVyeVN0cmluZ1BhcnRzID0gW1xuICAgICAgICAgICAgXCJjb25mZXJlbmNlRG9tYWluPSRkb21haW5cIixcbiAgICAgICAgICAgIFwiY29uZmVyZW5jZUlkPSRjb25mZXJlbmNlSWRcIixcbiAgICAgICAgICAgIFwiaXNBdWRpb09ubHk9JGlzQXVkaW9Pbmx5XCIsXG4gICAgICAgICAgICBcInN0YXJ0V2l0aEF1ZGlvTXV0ZWQ9JHN0YXJ0V2l0aEF1ZGlvTXV0ZWRcIixcbiAgICAgICAgICAgIFwic3RhcnRXaXRoVmlkZW9NdXRlZD0kc3RhcnRXaXRoVmlkZW9NdXRlZFwiLFxuICAgICAgICAgICAgXCJpc1ZpZGVvQ2hhbm5lbD0kaXNWaWRlb0NoYW5uZWxcIixcbiAgICAgICAgICAgIFwiZGlzcGxheU5hbWU9JG1hdHJpeF9kaXNwbGF5X25hbWVcIixcbiAgICAgICAgICAgIFwiYXZhdGFyVXJsPSRtYXRyaXhfYXZhdGFyX3VybFwiLFxuICAgICAgICAgICAgXCJ1c2VySWQ9JG1hdHJpeF91c2VyX2lkXCIsXG4gICAgICAgICAgICBcInJvb21JZD0kbWF0cml4X3Jvb21faWRcIixcbiAgICAgICAgICAgIFwidGhlbWU9JHRoZW1lXCIsXG4gICAgICAgICAgICBcInJvb21OYW1lPSRyb29tTmFtZVwiLFxuICAgICAgICAgICAgYHN1cHBvcnRzU2NyZWVuc2hhcmluZz0ke1BsYXRmb3JtUGVnLmdldCgpPy5zdXBwb3J0c0ppdHNpU2NyZWVuc2hhcmluZygpfWAsXG4gICAgICAgICAgICBcImxhbmd1YWdlPSRvcmcubWF0cml4Lm1zYzI4NzMuY2xpZW50X2xhbmd1YWdlXCIsXG4gICAgICAgIF07XG4gICAgICAgIGlmIChvcHRzLmF1dGgpIHtcbiAgICAgICAgICAgIHF1ZXJ5U3RyaW5nUGFydHMucHVzaChgYXV0aD0ke29wdHMuYXV0aH1gKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBxdWVyeVN0cmluZyA9IHF1ZXJ5U3RyaW5nUGFydHMuam9pbihcIiZcIik7XG5cbiAgICAgICAgbGV0IGJhc2VVcmwgPSB3aW5kb3cubG9jYXRpb24uaHJlZjtcbiAgICAgICAgaWYgKHdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbCAhPT0gXCJodHRwczpcIiAmJiAhb3B0cy5mb3JMb2NhbFJlbmRlcikge1xuICAgICAgICAgICAgLy8gVXNlIGFuIGV4dGVybmFsIHdyYXBwZXIgaWYgd2UncmUgbm90IGxvY2FsbHkgcmVuZGVyaW5nIHRoZSB3aWRnZXQuIFRoaXMgaXMgdXN1YWxseVxuICAgICAgICAgICAgLy8gdGhlIFVSTCB0aGF0IHdpbGwgZW5kIHVwIGluIHRoZSB3aWRnZXQgZXZlbnQsIHNvIHdlIHdhbnQgdG8gbWFrZSBzdXJlIGl0J3MgcmVsYXRpdmVseVxuICAgICAgICAgICAgLy8gc2FmZSB0byBzZW5kLlxuICAgICAgICAgICAgLy8gV2UnbGwgZW5kIHVwIHVzaW5nIGEgbG9jYWwgcmVuZGVyIFVSTCB3aGVuIHdlIHNlZSBhIEppdHNpIHdpZGdldCBhbnl3YXlzLCBzbyB0aGlzIGlzXG4gICAgICAgICAgICAvLyByZWFsbHkganVzdCBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkgYW5kIHRvIGFwcGVhc2UgdGhlIHNwZWMuXG4gICAgICAgICAgICBiYXNlVXJsID0gXCJodHRwczovL2FwcC5lbGVtZW50LmlvL1wiO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHVybCA9IG5ldyBVUkwoXCJqaXRzaS5odG1sI1wiICsgcXVlcnlTdHJpbmcsIGJhc2VVcmwpOyAvLyB0aGlzIHN0cmlwcyBoYXNoIGZyYWdtZW50IGZyb20gYmFzZVVybFxuICAgICAgICByZXR1cm4gdXJsLmhyZWY7XG4gICAgfVxuXG4gICAgcHVibGljIHN0YXRpYyBnZXRXaWRnZXROYW1lKGFwcD86IElXaWRnZXQpOiBzdHJpbmcge1xuICAgICAgICByZXR1cm4gYXBwPy5uYW1lPy50cmltKCkgfHwgX3QoXCJVbmtub3duIEFwcFwiKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc3RhdGljIGdldFdpZGdldERhdGFUaXRsZShhcHA/OiBJV2lkZ2V0KTogc3RyaW5nIHtcbiAgICAgICAgcmV0dXJuIGFwcD8uZGF0YT8udGl0bGU/LnRyaW0oKSB8fCBcIlwiO1xuICAgIH1cblxuICAgIHB1YmxpYyBzdGF0aWMgZ2V0V2lkZ2V0VWlkKGFwcD86IElBcHAgfCBJV2lkZ2V0KTogc3RyaW5nIHtcbiAgICAgICAgcmV0dXJuIGFwcCA/IFdpZGdldFV0aWxzLmNhbGNXaWRnZXRVaWQoYXBwLmlkLCBpc0FwcFdpZGdldChhcHApID8gYXBwLnJvb21JZCA6IHVuZGVmaW5lZCkgOiBcIlwiO1xuICAgIH1cblxuICAgIHB1YmxpYyBzdGF0aWMgY2FsY1dpZGdldFVpZCh3aWRnZXRJZDogc3RyaW5nLCByb29tSWQ/OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgICByZXR1cm4gcm9vbUlkID8gYHJvb21fJHtyb29tSWR9XyR7d2lkZ2V0SWR9YCA6IGB1c2VyXyR7d2lkZ2V0SWR9YDtcbiAgICB9XG5cbiAgICBwdWJsaWMgc3RhdGljIGVkaXRXaWRnZXQocm9vbTogUm9vbSwgYXBwOiBJV2lkZ2V0KTogdm9pZCB7XG4gICAgICAgIC8vIG5vaW5zcGVjdGlvbiBKU0lnbm9yZWRQcm9taXNlRnJvbUNhbGxcbiAgICAgICAgSW50ZWdyYXRpb25NYW5hZ2Vycy5zaGFyZWRJbnN0YW5jZSgpXG4gICAgICAgICAgICAuZ2V0UHJpbWFyeU1hbmFnZXIoKVxuICAgICAgICAgICAgPy5vcGVuKHJvb20sIFwidHlwZV9cIiArIGFwcC50eXBlLCBhcHAuaWQpO1xuICAgIH1cblxuICAgIHB1YmxpYyBzdGF0aWMgaXNNYW5hZ2VkQnlNYW5hZ2VyKGFwcDogSVdpZGdldCk6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoV2lkZ2V0VXRpbHMuaXNTY2FsYXJVcmwoYXBwLnVybCkpIHtcbiAgICAgICAgICAgIGNvbnN0IG1hbmFnZXJzID0gSW50ZWdyYXRpb25NYW5hZ2Vycy5zaGFyZWRJbnN0YW5jZSgpO1xuICAgICAgICAgICAgaWYgKG1hbmFnZXJzLmhhc01hbmFnZXIoKSkge1xuICAgICAgICAgICAgICAgIC8vIFRPRE86IFBpY2sgdGhlIHJpZ2h0IG1hbmFnZXIgZm9yIHRoZSB3aWRnZXRcbiAgICAgICAgICAgICAgICBjb25zdCBkZWZhdWx0TWFuYWdlciA9IG1hbmFnZXJzLmdldFByaW1hcnlNYW5hZ2VyKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFdpZGdldFV0aWxzLmlzU2NhbGFyVXJsKGRlZmF1bHRNYW5hZ2VyPy5hcGlVcmwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFpQkEsSUFBQUEsSUFBQSxHQUFBQyxPQUFBO0FBSUEsSUFBQUMsT0FBQSxHQUFBRCxPQUFBO0FBQ0EsSUFBQUUsT0FBQSxHQUFBRixPQUFBO0FBQ0EsSUFBQUcsS0FBQSxHQUFBSCxPQUFBO0FBQ0EsSUFBQUksYUFBQSxHQUFBSixPQUFBO0FBRUEsSUFBQUssWUFBQSxHQUFBQyxzQkFBQSxDQUFBTixPQUFBO0FBQ0EsSUFBQU8sVUFBQSxHQUFBRCxzQkFBQSxDQUFBTixPQUFBO0FBQ0EsSUFBQVEsV0FBQSxHQUFBRixzQkFBQSxDQUFBTixPQUFBO0FBQ0EsSUFBQVMsZ0JBQUEsR0FBQUgsc0JBQUEsQ0FBQU4sT0FBQTtBQUNBLElBQUFVLG9CQUFBLEdBQUFWLE9BQUE7QUFDQSxJQUFBVyxXQUFBLEdBQUFYLE9BQUE7QUFDQSxJQUFBWSxNQUFBLEdBQUFaLE9BQUE7QUFDQSxJQUFBYSxRQUFBLEdB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