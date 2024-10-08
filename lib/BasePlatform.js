"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.UpdateCheckStatus = exports.SSO_ID_SERVER_URL_KEY = exports.SSO_IDP_ID_KEY = exports.SSO_HOMESERVER_URL_KEY = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _olmlib = require("matrix-js-sdk/src/crypto/olmlib");
var _logger = require("matrix-js-sdk/src/logger");
var _dispatcher = _interopRequireDefault(require("./dispatcher/dispatcher"));
var _actions = require("./dispatcher/actions");
var _UpdateToast = require("./toasts/UpdateToast");
var _MatrixClientPeg = require("./MatrixClientPeg");
var _StorageManager = require("./utils/StorageManager");
/*
Copyright 2016 Aviral Dasgupta
Copyright 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd
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

const SSO_HOMESERVER_URL_KEY = "mx_sso_hs_url";
exports.SSO_HOMESERVER_URL_KEY = SSO_HOMESERVER_URL_KEY;
const SSO_ID_SERVER_URL_KEY = "mx_sso_is_url";
exports.SSO_ID_SERVER_URL_KEY = SSO_ID_SERVER_URL_KEY;
const SSO_IDP_ID_KEY = "mx_sso_idp_id";
exports.SSO_IDP_ID_KEY = SSO_IDP_ID_KEY;
let UpdateCheckStatus = /*#__PURE__*/function (UpdateCheckStatus) {
  UpdateCheckStatus["Checking"] = "CHECKING";
  UpdateCheckStatus["Error"] = "ERROR";
  UpdateCheckStatus["NotAvailable"] = "NOTAVAILABLE";
  UpdateCheckStatus["Downloading"] = "DOWNLOADING";
  UpdateCheckStatus["Ready"] = "READY";
  return UpdateCheckStatus;
}({});
exports.UpdateCheckStatus = UpdateCheckStatus;
const UPDATE_DEFER_KEY = "mx_defer_update";

/**
 * Base class for classes that provide platform-specific functionality
 * eg. Setting an application badge or displaying notifications
 *
 * Instances of this class are provided by the application.
 */
class BasePlatform {
  constructor() {
    (0, _defineProperty2.default)(this, "notificationCount", 0);
    (0, _defineProperty2.default)(this, "errorDidOccur", false);
    (0, _defineProperty2.default)(this, "onAction", payload => {
      switch (payload.action) {
        case "on_client_not_viable":
        case _actions.Action.OnLoggedOut:
          this.setNotificationCount(0);
          break;
      }
    });
    _dispatcher.default.register(this.onAction);
    this.startUpdateCheck = this.startUpdateCheck.bind(this);
  }

  // Used primarily for Analytics

  setNotificationCount(count) {
    this.notificationCount = count;
  }
  setErrorStatus(errorDidOccur) {
    this.errorDidOccur = errorDidOccur;
  }

  /**
   * Whether we can call checkForUpdate on this platform build
   */
  async canSelfUpdate() {
    return false;
  }
  startUpdateCheck() {
    (0, _UpdateToast.hideToast)();
    localStorage.removeItem(UPDATE_DEFER_KEY);
    _dispatcher.default.dispatch({
      action: _actions.Action.CheckUpdates,
      status: UpdateCheckStatus.Checking
    });
  }

  /**
   * Update the currently running app to the latest available version
   * and replace this instance of the app with the new version.
   */
  installUpdate() {}

  /**
   * Check if the version update has been deferred and that deferment is still in effect
   * @param newVersion the version string to check
   */
  shouldShowUpdate(newVersion) {
    // If the user registered on this client in the last 24 hours then do not show them the update toast
    if (_MatrixClientPeg.MatrixClientPeg.userRegisteredWithinLastHours(24)) return false;
    try {
      const [version, deferUntil] = JSON.parse(localStorage.getItem(UPDATE_DEFER_KEY));
      return newVersion !== version || Date.now() > deferUntil;
    } catch (e) {
      return true;
    }
  }

  /**
   * Ignore the pending update and don't prompt about this version
   * until the next morning (8am).
   */
  deferUpdate(newVersion) {
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
    date.setHours(8, 0, 0, 0); // set to next 8am
    localStorage.setItem(UPDATE_DEFER_KEY, JSON.stringify([newVersion, date.getTime()]));
    (0, _UpdateToast.hideToast)();
  }

  /**
   * Return true if platform supports multi-language
   * spell-checking, otherwise false.
   */
  supportsSpellCheckSettings() {
    return false;
  }

  /**
   * Returns true if platform allows overriding native context menus
   */
  allowOverridingNativeContextMenus() {
    return false;
  }

  /**
   * Returns true if the platform supports displaying
   * notifications, otherwise false.
   * @returns {boolean} whether the platform supports displaying notifications
   */
  supportsNotifications() {
    return false;
  }

  /**
   * Returns true if the application currently has permission
   * to display notifications. Otherwise false.
   * @returns {boolean} whether the application has permission to display notifications
   */
  maySendNotifications() {
    return false;
  }

  /**
   * Requests permission to send notifications. Returns
   * a promise that is resolved when the user has responded
   * to the request. The promise has a single string argument
   * that is 'granted' if the user allowed the request or
   * 'denied' otherwise.
   */

  displayNotification(title, msg, avatarUrl, room, ev) {
    const notifBody = {
      body: msg,
      silent: true // we play our own sounds
    };

    if (avatarUrl) notifBody["icon"] = avatarUrl;
    const notification = new window.Notification(title, notifBody);
    notification.onclick = () => {
      const payload = {
        action: _actions.Action.ViewRoom,
        room_id: room.roomId,
        metricsTrigger: "Notification"
      };
      if (ev?.getThread()) {
        payload.event_id = ev.getId();
      }
      _dispatcher.default.dispatch(payload);
      window.focus();
    };
    return notification;
  }
  loudNotification(ev, room) {}
  clearNotification(notif) {
    // Some browsers don't support this, e.g Safari on iOS
    // https://developer.mozilla.org/en-US/docs/Web/API/Notification/close
    if (notif.close) {
      notif.close();
    }
  }

  /**
   * Returns true if the platform requires URL previews in tooltips, otherwise false.
   * @returns {boolean} whether the platform requires URL previews in tooltips
   */
  needsUrlTooltips() {
    return false;
  }

  /**
   * Returns a promise that resolves to a string representing the current version of the application.
   */

  /**
   * Restarts the application, without necessarily reloading
   * any application code
   */

  supportsSetting(settingName) {
    return false;
  }
  async getSettingValue(settingName) {
    return undefined;
  }
  setSettingValue(settingName, value) {
    throw new Error("Unimplemented");
  }

  /**
   * Get our platform specific EventIndexManager.
   *
   * @return {BaseEventIndexManager} The EventIndex manager for our platform,
   * can be null if the platform doesn't support event indexing.
   */
  getEventIndexingManager() {
    return null;
  }
  setLanguage(preferredLangs) {}
  setSpellCheckEnabled(enabled) {}
  async getSpellCheckEnabled() {
    return false;
  }
  setSpellCheckLanguages(preferredLangs) {}
  getSpellCheckLanguages() {
    return null;
  }
  async getDesktopCapturerSources(options) {
    return [];
  }
  supportsDesktopCapturer() {
    return false;
  }
  supportsJitsiScreensharing() {
    return true;
  }
  overrideBrowserShortcuts() {
    return false;
  }
  navigateForwardBack(back) {}
  getAvailableSpellCheckLanguages() {
    return null;
  }
  getSSOCallbackUrl() {
    let fragmentAfterLogin = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "";
    const url = new URL(window.location.href);
    url.hash = fragmentAfterLogin;
    return url;
  }

  /**
   * Begin Single Sign On flows.
   * @param {MatrixClient} mxClient the matrix client using which we should start the flow
   * @param {"sso"|"cas"} loginType the type of SSO it is, CAS/SSO.
   * @param {string} fragmentAfterLogin the hash to pass to the app during sso callback.
   * @param {SSOAction} action the SSO flow to indicate to the IdP, optional.
   * @param {string} idpId The ID of the Identity Provider being targeted, optional.
   */
  startSingleSignOn(mxClient, loginType, fragmentAfterLogin, idpId, action) {
    // persist hs url and is url for when the user is returned to the app with the login token
    localStorage.setItem(SSO_HOMESERVER_URL_KEY, mxClient.getHomeserverUrl());
    if (mxClient.getIdentityServerUrl()) {
      localStorage.setItem(SSO_ID_SERVER_URL_KEY, mxClient.getIdentityServerUrl());
    }
    if (idpId) {
      localStorage.setItem(SSO_IDP_ID_KEY, idpId);
    }
    const callbackUrl = this.getSSOCallbackUrl(fragmentAfterLogin);
    window.location.href = mxClient.getSsoLoginUrl(callbackUrl.toString(), loginType, idpId, action); // redirect to SSO
  }

  /**
   * Get a previously stored pickle key.  The pickle key is used for
   * encrypting libolm objects.
   * @param {string} userId the user ID for the user that the pickle key is for.
   * @param {string} userId the device ID that the pickle key is for.
   * @returns {string|null} the previously stored pickle key, or null if no
   *     pickle key has been stored.
   */
  async getPickleKey(userId, deviceId) {
    if (!window.crypto || !window.crypto.subtle) {
      return null;
    }
    let data;
    try {
      data = await (0, _StorageManager.idbLoad)("pickleKey", [userId, deviceId]);
    } catch (e) {
      _logger.logger.error("idbLoad for pickleKey failed", e);
    }
    if (!data) {
      return null;
    }
    if (!data.encrypted || !data.iv || !data.cryptoKey) {
      _logger.logger.error("Badly formatted pickle key");
      return null;
    }
    const additionalData = new Uint8Array(userId.length + deviceId.length + 1);
    for (let i = 0; i < userId.length; i++) {
      additionalData[i] = userId.charCodeAt(i);
    }
    additionalData[userId.length] = 124; // "|"
    for (let i = 0; i < deviceId.length; i++) {
      additionalData[userId.length + 1 + i] = deviceId.charCodeAt(i);
    }
    try {
      const key = await crypto.subtle.decrypt({
        name: "AES-GCM",
        iv: data.iv,
        additionalData
      }, data.cryptoKey, data.encrypted);
      return (0, _olmlib.encodeUnpaddedBase64)(key);
    } catch (e) {
      _logger.logger.error("Error decrypting pickle key");
      return null;
    }
  }

  /**
   * Create and store a pickle key for encrypting libolm objects.
   * @param {string} userId the user ID for the user that the pickle key is for.
   * @param {string} deviceId the device ID that the pickle key is for.
   * @returns {string|null} the pickle key, or null if the platform does not
   *     support storing pickle keys.
   */
  async createPickleKey(userId, deviceId) {
    if (!window.crypto || !window.crypto.subtle) {
      return null;
    }
    const crypto = window.crypto;
    const randomArray = new Uint8Array(32);
    crypto.getRandomValues(randomArray);
    const cryptoKey = await crypto.subtle.generateKey({
      name: "AES-GCM",
      length: 256
    }, false, ["encrypt", "decrypt"]);
    const iv = new Uint8Array(32);
    crypto.getRandomValues(iv);
    const additionalData = new Uint8Array(userId.length + deviceId.length + 1);
    for (let i = 0; i < userId.length; i++) {
      additionalData[i] = userId.charCodeAt(i);
    }
    additionalData[userId.length] = 124; // "|"
    for (let i = 0; i < deviceId.length; i++) {
      additionalData[userId.length + 1 + i] = deviceId.charCodeAt(i);
    }
    const encrypted = await crypto.subtle.encrypt({
      name: "AES-GCM",
      iv,
      additionalData
    }, cryptoKey, randomArray);
    try {
      await (0, _StorageManager.idbSave)("pickleKey", [userId, deviceId], {
        encrypted,
        iv,
        cryptoKey
      });
    } catch (e) {
      return null;
    }
    return (0, _olmlib.encodeUnpaddedBase64)(randomArray);
  }

  /**
   * Delete a previously stored pickle key from storage.
   * @param {string} userId the user ID for the user that the pickle key is for.
   * @param {string} userId the device ID that the pickle key is for.
   */
  async destroyPickleKey(userId, deviceId) {
    try {
      await (0, _StorageManager.idbDelete)("pickleKey", [userId, deviceId]);
    } catch (e) {
      _logger.logger.error("idbDelete failed in destroyPickleKey", e);
    }
  }

  /**
   * Clear app storage, called when logging out to perform data clean up.
   */
  async clearStorage() {
    window.sessionStorage.clear();
    window.localStorage.clear();
  }
}
exports.default = BasePlatform;
//# sourceMappingURL=BasePlatform.js.map