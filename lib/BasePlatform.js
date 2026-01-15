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
   * @param preserveWalletConnect - If true, preserves WalletConnect session data (default: false for logout)
   */
  async clearStorage() {
    let preserveWalletConnect = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
    let wcSessionTopic = null;
    let walletAddress = null;
    let walletName = null;

    // Only preserve WalletConnect data if explicitly requested (during login, not logout)
    if (preserveWalletConnect) {
      wcSessionTopic = window.sessionStorage.getItem('wc_session_topic');
      walletAddress = window.sessionStorage.getItem('wallet_address');
      walletName = window.sessionStorage.getItem('wallet_name');
    }
    window.sessionStorage.clear();
    window.localStorage.clear();

    // Restore WalletConnect session data only if preservation was requested
    if (preserveWalletConnect) {
      if (wcSessionTopic) {
        window.sessionStorage.setItem('wc_session_topic', wcSessionTopic);
        console.log('🔄 Preserved WalletConnect session ID during login clearStorage:', wcSessionTopic);
      }
      if (walletAddress) {
        window.sessionStorage.setItem('wallet_address', walletAddress);
      }
      if (walletName) {
        window.sessionStorage.setItem('wallet_name', walletName);
      }
    } else {
      console.log('🧹 Cleared all storage including WalletConnect session data (logout)');
    }
  }
}
exports.default = BasePlatform;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfb2xtbGliIiwicmVxdWlyZSIsIl9sb2dnZXIiLCJfZGlzcGF0Y2hlciIsIl9pbnRlcm9wUmVxdWlyZURlZmF1bHQiLCJfYWN0aW9ucyIsIl9VcGRhdGVUb2FzdCIsIl9NYXRyaXhDbGllbnRQZWciLCJfU3RvcmFnZU1hbmFnZXIiLCJTU09fSE9NRVNFUlZFUl9VUkxfS0VZIiwiZXhwb3J0cyIsIlNTT19JRF9TRVJWRVJfVVJMX0tFWSIsIlNTT19JRFBfSURfS0VZIiwiVXBkYXRlQ2hlY2tTdGF0dXMiLCJVUERBVEVfREVGRVJfS0VZIiwiQmFzZVBsYXRmb3JtIiwiY29uc3RydWN0b3IiLCJfZGVmaW5lUHJvcGVydHkyIiwiZGVmYXVsdCIsInBheWxvYWQiLCJhY3Rpb24iLCJBY3Rpb24iLCJPbkxvZ2dlZE91dCIsInNldE5vdGlmaWNhdGlvbkNvdW50IiwiZGlzIiwicmVnaXN0ZXIiLCJvbkFjdGlvbiIsInN0YXJ0VXBkYXRlQ2hlY2siLCJiaW5kIiwiY291bnQiLCJub3RpZmljYXRpb25Db3VudCIsInNldEVycm9yU3RhdHVzIiwiZXJyb3JEaWRPY2N1ciIsImNhblNlbGZVcGRhdGUiLCJoaWRlVXBkYXRlVG9hc3QiLCJsb2NhbFN0b3JhZ2UiLCJyZW1vdmVJdGVtIiwiZGlzcGF0Y2giLCJDaGVja1VwZGF0ZXMiLCJzdGF0dXMiLCJDaGVja2luZyIsImluc3RhbGxVcGRhdGUiLCJzaG91bGRTaG93VXBkYXRlIiwibmV3VmVyc2lvbiIsIk1hdHJpeENsaWVudFBlZyIsInVzZXJSZWdpc3RlcmVkV2l0aGluTGFzdEhvdXJzIiwidmVyc2lvbiIsImRlZmVyVW50aWwiLCJKU09OIiwicGFyc2UiLCJnZXRJdGVtIiwiRGF0ZSIsIm5vdyIsImUiLCJkZWZlclVwZGF0ZSIsImRhdGUiLCJzZXRIb3VycyIsInNldEl0ZW0iLCJzdHJpbmdpZnkiLCJnZXRUaW1lIiwic3VwcG9ydHNTcGVsbENoZWNrU2V0dGluZ3MiLCJhbGxvd092ZXJyaWRpbmdOYXRpdmVDb250ZXh0TWVudXMiLCJzdXBwb3J0c05vdGlmaWNhdGlvbnMiLCJtYXlTZW5kTm90aWZpY2F0aW9ucyIsImRpc3BsYXlOb3RpZmljYXRpb24iLCJ0aXRsZSIsIm1zZyIsImF2YXRhclVybCIsInJvb20iLCJldiIsIm5vdGlmQm9keSIsImJvZHkiLCJzaWxlbnQiLCJub3RpZmljYXRpb24iLCJ3aW5kb3ciLCJOb3RpZmljYXRpb24iLCJvbmNsaWNrIiwiVmlld1Jvb20iLCJyb29tX2lkIiwicm9vbUlkIiwibWV0cmljc1RyaWdnZXIiLCJnZXRUaHJlYWQiLCJldmVudF9pZCIsImdldElkIiwiZm9jdXMiLCJsb3VkTm90aWZpY2F0aW9uIiwiY2xlYXJOb3RpZmljYXRpb24iLCJub3RpZiIsImNsb3NlIiwibmVlZHNVcmxUb29sdGlwcyIsInN1cHBvcnRzU2V0dGluZyIsInNldHRpbmdOYW1lIiwiZ2V0U2V0dGluZ1ZhbHVlIiwidW5kZWZpbmVkIiwic2V0U2V0dGluZ1ZhbHVlIiwidmFsdWUiLCJFcnJvciIsImdldEV2ZW50SW5kZXhpbmdNYW5hZ2VyIiwic2V0TGFuZ3VhZ2UiLCJwcmVmZXJyZWRMYW5ncyIsInNldFNwZWxsQ2hlY2tFbmFibGVkIiwiZW5hYmxlZCIsImdldFNwZWxsQ2hlY2tFbmFibGVkIiwic2V0U3BlbGxDaGVja0xhbmd1YWdlcyIsImdldFNwZWxsQ2hlY2tMYW5ndWFnZXMiLCJnZXREZXNrdG9wQ2FwdHVyZXJTb3VyY2VzIiwib3B0aW9ucyIsInN1cHBvcnRzRGVza3RvcENhcHR1cmVyIiwic3VwcG9ydHNKaXRzaVNjcmVlbnNoYXJpbmciLCJvdmVycmlkZUJyb3dzZXJTaG9ydGN1dHMiLCJuYXZpZ2F0ZUZvcndhcmRCYWNrIiwiYmFjayIsImdldEF2YWlsYWJsZVNwZWxsQ2hlY2tMYW5ndWFnZXMiLCJnZXRTU09DYWxsYmFja1VybCIsImZyYWdtZW50QWZ0ZXJMb2dpbiIsImFyZ3VtZW50cyIsImxlbmd0aCIsInVybCIsIlVSTCIsImxvY2F0aW9uIiwiaHJlZiIsImhhc2giLCJzdGFydFNpbmdsZVNpZ25PbiIsIm14Q2xpZW50IiwibG9naW5UeXBlIiwiaWRwSWQiLCJnZXRIb21lc2VydmVyVXJsIiwiZ2V0SWRlbnRpdHlTZXJ2ZXJVcmwiLCJjYWxsYmFja1VybCIsImdldFNzb0xvZ2luVXJsIiwidG9TdHJpbmciLCJnZXRQaWNrbGVLZXkiLCJ1c2VySWQiLCJkZXZpY2VJZCIsImNyeXB0byIsInN1YnRsZSIsImRhdGEiLCJpZGJMb2FkIiwibG9nZ2VyIiwiZXJyb3IiLCJlbmNyeXB0ZWQiLCJpdiIsImNyeXB0b0tleSIsImFkZGl0aW9uYWxEYXRhIiwiVWludDhBcnJheSIsImkiLCJjaGFyQ29kZUF0Iiwia2V5IiwiZGVjcnlwdCIsIm5hbWUiLCJlbmNvZGVVbnBhZGRlZEJhc2U2NCIsImNyZWF0ZVBpY2tsZUtleSIsInJhbmRvbUFycmF5IiwiZ2V0UmFuZG9tVmFsdWVzIiwiZ2VuZXJhdGVLZXkiLCJlbmNyeXB0IiwiaWRiU2F2ZSIsImRlc3Ryb3lQaWNrbGVLZXkiLCJpZGJEZWxldGUiLCJjbGVhclN0b3JhZ2UiLCJwcmVzZXJ2ZVdhbGxldENvbm5lY3QiLCJ3Y1Nlc3Npb25Ub3BpYyIsIndhbGxldEFkZHJlc3MiLCJ3YWxsZXROYW1lIiwic2Vzc2lvblN0b3JhZ2UiLCJjbGVhciIsImNvbnNvbGUiLCJsb2ciXSwic291cmNlcyI6WyIuLi9zcmMvQmFzZVBsYXRmb3JtLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qXG5Db3B5cmlnaHQgMjAxNiBBdmlyYWwgRGFzZ3VwdGFcbkNvcHlyaWdodCAyMDE2IE9wZW5NYXJrZXQgTHRkXG5Db3B5cmlnaHQgMjAxOCBOZXcgVmVjdG9yIEx0ZFxuQ29weXJpZ2h0IDIwMjAgVGhlIE1hdHJpeC5vcmcgRm91bmRhdGlvbiBDLkkuQy5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4qL1xuXG5pbXBvcnQgeyBNYXRyaXhDbGllbnQgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvY2xpZW50XCI7XG5pbXBvcnQgeyBlbmNvZGVVbnBhZGRlZEJhc2U2NCB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9jcnlwdG8vb2xtbGliXCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbG9nZ2VyXCI7XG5pbXBvcnQgeyBNYXRyaXhFdmVudCB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9tb2RlbHMvZXZlbnRcIjtcbmltcG9ydCB7IFJvb20gfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbW9kZWxzL3Jvb21cIjtcbmltcG9ydCB7IFNTT0FjdGlvbiB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9AdHlwZXMvYXV0aFwiO1xuXG5pbXBvcnQgZGlzIGZyb20gXCIuL2Rpc3BhdGNoZXIvZGlzcGF0Y2hlclwiO1xuaW1wb3J0IEJhc2VFdmVudEluZGV4TWFuYWdlciBmcm9tIFwiLi9pbmRleGluZy9CYXNlRXZlbnRJbmRleE1hbmFnZXJcIjtcbmltcG9ydCB7IEFjdGlvblBheWxvYWQgfSBmcm9tIFwiLi9kaXNwYXRjaGVyL3BheWxvYWRzXCI7XG5pbXBvcnQgeyBDaGVja1VwZGF0ZXNQYXlsb2FkIH0gZnJvbSBcIi4vZGlzcGF0Y2hlci9wYXlsb2Fkcy9DaGVja1VwZGF0ZXNQYXlsb2FkXCI7XG5pbXBvcnQgeyBBY3Rpb24gfSBmcm9tIFwiLi9kaXNwYXRjaGVyL2FjdGlvbnNcIjtcbmltcG9ydCB7IGhpZGVUb2FzdCBhcyBoaWRlVXBkYXRlVG9hc3QgfSBmcm9tIFwiLi90b2FzdHMvVXBkYXRlVG9hc3RcIjtcbmltcG9ydCB7IE1hdHJpeENsaWVudFBlZyB9IGZyb20gXCIuL01hdHJpeENsaWVudFBlZ1wiO1xuaW1wb3J0IHsgaWRiTG9hZCwgaWRiU2F2ZSwgaWRiRGVsZXRlIH0gZnJvbSBcIi4vdXRpbHMvU3RvcmFnZU1hbmFnZXJcIjtcbmltcG9ydCB7IFZpZXdSb29tUGF5bG9hZCB9IGZyb20gXCIuL2Rpc3BhdGNoZXIvcGF5bG9hZHMvVmlld1Jvb21QYXlsb2FkXCI7XG5pbXBvcnQgeyBJQ29uZmlnT3B0aW9ucyB9IGZyb20gXCIuL0lDb25maWdPcHRpb25zXCI7XG5cbmV4cG9ydCBjb25zdCBTU09fSE9NRVNFUlZFUl9VUkxfS0VZID0gXCJteF9zc29faHNfdXJsXCI7XG5leHBvcnQgY29uc3QgU1NPX0lEX1NFUlZFUl9VUkxfS0VZID0gXCJteF9zc29faXNfdXJsXCI7XG5leHBvcnQgY29uc3QgU1NPX0lEUF9JRF9LRVkgPSBcIm14X3Nzb19pZHBfaWRcIjtcblxuZXhwb3J0IGVudW0gVXBkYXRlQ2hlY2tTdGF0dXMge1xuICAgIENoZWNraW5nID0gXCJDSEVDS0lOR1wiLFxuICAgIEVycm9yID0gXCJFUlJPUlwiLFxuICAgIE5vdEF2YWlsYWJsZSA9IFwiTk9UQVZBSUxBQkxFXCIsXG4gICAgRG93bmxvYWRpbmcgPSBcIkRPV05MT0FESU5HXCIsXG4gICAgUmVhZHkgPSBcIlJFQURZXCIsXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVXBkYXRlU3RhdHVzIHtcbiAgICAvKipcbiAgICAgKiBUaGUgY3VycmVudCBwaGFzZSBvZiB0aGUgbWFudWFsIHVwZGF0ZSBjaGVjay5cbiAgICAgKi9cbiAgICBzdGF0dXM6IFVwZGF0ZUNoZWNrU3RhdHVzO1xuICAgIC8qKlxuICAgICAqIERldGFpbCBzdHJpbmcgcmVsYXRpbmcgdG8gdGhlIGN1cnJlbnQgc3RhdHVzLCB0eXBpY2FsbHkgZm9yIGVycm9yIGRldGFpbHMuXG4gICAgICovXG4gICAgZGV0YWlsPzogc3RyaW5nO1xufVxuXG5jb25zdCBVUERBVEVfREVGRVJfS0VZID0gXCJteF9kZWZlcl91cGRhdGVcIjtcblxuLyoqXG4gKiBCYXNlIGNsYXNzIGZvciBjbGFzc2VzIHRoYXQgcHJvdmlkZSBwbGF0Zm9ybS1zcGVjaWZpYyBmdW5jdGlvbmFsaXR5XG4gKiBlZy4gU2V0dGluZyBhbiBhcHBsaWNhdGlvbiBiYWRnZSBvciBkaXNwbGF5aW5nIG5vdGlmaWNhdGlvbnNcbiAqXG4gKiBJbnN0YW5jZXMgb2YgdGhpcyBjbGFzcyBhcmUgcHJvdmlkZWQgYnkgdGhlIGFwcGxpY2F0aW9uLlxuICovXG5leHBvcnQgZGVmYXVsdCBhYnN0cmFjdCBjbGFzcyBCYXNlUGxhdGZvcm0ge1xuICAgIHByb3RlY3RlZCBub3RpZmljYXRpb25Db3VudCA9IDA7XG4gICAgcHJvdGVjdGVkIGVycm9yRGlkT2NjdXIgPSBmYWxzZTtcblxuICAgIHB1YmxpYyBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgZGlzLnJlZ2lzdGVyKHRoaXMub25BY3Rpb24pO1xuICAgICAgICB0aGlzLnN0YXJ0VXBkYXRlQ2hlY2sgPSB0aGlzLnN0YXJ0VXBkYXRlQ2hlY2suYmluZCh0aGlzKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYWJzdHJhY3QgZ2V0Q29uZmlnKCk6IFByb21pc2U8SUNvbmZpZ09wdGlvbnMgfCB1bmRlZmluZWQ+O1xuXG4gICAgcHVibGljIGFic3RyYWN0IGdldERlZmF1bHREZXZpY2VEaXNwbGF5TmFtZSgpOiBzdHJpbmc7XG5cbiAgICBwcm90ZWN0ZWQgb25BY3Rpb24gPSAocGF5bG9hZDogQWN0aW9uUGF5bG9hZCk6IHZvaWQgPT4ge1xuICAgICAgICBzd2l0Y2ggKHBheWxvYWQuYWN0aW9uKSB7XG4gICAgICAgICAgICBjYXNlIFwib25fY2xpZW50X25vdF92aWFibGVcIjpcbiAgICAgICAgICAgIGNhc2UgQWN0aW9uLk9uTG9nZ2VkT3V0OlxuICAgICAgICAgICAgICAgIHRoaXMuc2V0Tm90aWZpY2F0aW9uQ291bnQoMCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gVXNlZCBwcmltYXJpbHkgZm9yIEFuYWx5dGljc1xuICAgIHB1YmxpYyBhYnN0cmFjdCBnZXRIdW1hblJlYWRhYmxlTmFtZSgpOiBzdHJpbmc7XG5cbiAgICBwdWJsaWMgc2V0Tm90aWZpY2F0aW9uQ291bnQoY291bnQ6IG51bWJlcik6IHZvaWQge1xuICAgICAgICB0aGlzLm5vdGlmaWNhdGlvbkNvdW50ID0gY291bnQ7XG4gICAgfVxuXG4gICAgcHVibGljIHNldEVycm9yU3RhdHVzKGVycm9yRGlkT2NjdXI6IGJvb2xlYW4pOiB2b2lkIHtcbiAgICAgICAgdGhpcy5lcnJvckRpZE9jY3VyID0gZXJyb3JEaWRPY2N1cjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHdlIGNhbiBjYWxsIGNoZWNrRm9yVXBkYXRlIG9uIHRoaXMgcGxhdGZvcm0gYnVpbGRcbiAgICAgKi9cbiAgICBwdWJsaWMgYXN5bmMgY2FuU2VsZlVwZGF0ZSgpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHB1YmxpYyBzdGFydFVwZGF0ZUNoZWNrKCk6IHZvaWQge1xuICAgICAgICBoaWRlVXBkYXRlVG9hc3QoKTtcbiAgICAgICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oVVBEQVRFX0RFRkVSX0tFWSk7XG4gICAgICAgIGRpcy5kaXNwYXRjaDxDaGVja1VwZGF0ZXNQYXlsb2FkPih7XG4gICAgICAgICAgICBhY3Rpb246IEFjdGlvbi5DaGVja1VwZGF0ZXMsXG4gICAgICAgICAgICBzdGF0dXM6IFVwZGF0ZUNoZWNrU3RhdHVzLkNoZWNraW5nLFxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGUgdGhlIGN1cnJlbnRseSBydW5uaW5nIGFwcCB0byB0aGUgbGF0ZXN0IGF2YWlsYWJsZSB2ZXJzaW9uXG4gICAgICogYW5kIHJlcGxhY2UgdGhpcyBpbnN0YW5jZSBvZiB0aGUgYXBwIHdpdGggdGhlIG5ldyB2ZXJzaW9uLlxuICAgICAqL1xuICAgIHB1YmxpYyBpbnN0YWxsVXBkYXRlKCk6IHZvaWQge31cblxuICAgIC8qKlxuICAgICAqIENoZWNrIGlmIHRoZSB2ZXJzaW9uIHVwZGF0ZSBoYXMgYmVlbiBkZWZlcnJlZCBhbmQgdGhhdCBkZWZlcm1lbnQgaXMgc3RpbGwgaW4gZWZmZWN0XG4gICAgICogQHBhcmFtIG5ld1ZlcnNpb24gdGhlIHZlcnNpb24gc3RyaW5nIHRvIGNoZWNrXG4gICAgICovXG4gICAgcHJvdGVjdGVkIHNob3VsZFNob3dVcGRhdGUobmV3VmVyc2lvbjogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgICAgIC8vIElmIHRoZSB1c2VyIHJlZ2lzdGVyZWQgb24gdGhpcyBjbGllbnQgaW4gdGhlIGxhc3QgMjQgaG91cnMgdGhlbiBkbyBub3Qgc2hvdyB0aGVtIHRoZSB1cGRhdGUgdG9hc3RcbiAgICAgICAgaWYgKE1hdHJpeENsaWVudFBlZy51c2VyUmVnaXN0ZXJlZFdpdGhpbkxhc3RIb3VycygyNCkpIHJldHVybiBmYWxzZTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgW3ZlcnNpb24sIGRlZmVyVW50aWxdID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbShVUERBVEVfREVGRVJfS0VZKSEpO1xuICAgICAgICAgICAgcmV0dXJuIG5ld1ZlcnNpb24gIT09IHZlcnNpb24gfHwgRGF0ZS5ub3coKSA+IGRlZmVyVW50aWw7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWdub3JlIHRoZSBwZW5kaW5nIHVwZGF0ZSBhbmQgZG9uJ3QgcHJvbXB0IGFib3V0IHRoaXMgdmVyc2lvblxuICAgICAqIHVudGlsIHRoZSBuZXh0IG1vcm5pbmcgKDhhbSkuXG4gICAgICovXG4gICAgcHVibGljIGRlZmVyVXBkYXRlKG5ld1ZlcnNpb246IHN0cmluZyk6IHZvaWQge1xuICAgICAgICBjb25zdCBkYXRlID0gbmV3IERhdGUoRGF0ZS5ub3coKSArIDI0ICogNjAgKiA2MCAqIDEwMDApO1xuICAgICAgICBkYXRlLnNldEhvdXJzKDgsIDAsIDAsIDApOyAvLyBzZXQgdG8gbmV4dCA4YW1cbiAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oVVBEQVRFX0RFRkVSX0tFWSwgSlNPTi5zdHJpbmdpZnkoW25ld1ZlcnNpb24sIGRhdGUuZ2V0VGltZSgpXSkpO1xuICAgICAgICBoaWRlVXBkYXRlVG9hc3QoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm4gdHJ1ZSBpZiBwbGF0Zm9ybSBzdXBwb3J0cyBtdWx0aS1sYW5ndWFnZVxuICAgICAqIHNwZWxsLWNoZWNraW5nLCBvdGhlcndpc2UgZmFsc2UuXG4gICAgICovXG4gICAgcHVibGljIHN1cHBvcnRzU3BlbGxDaGVja1NldHRpbmdzKCk6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHBsYXRmb3JtIGFsbG93cyBvdmVycmlkaW5nIG5hdGl2ZSBjb250ZXh0IG1lbnVzXG4gICAgICovXG4gICAgcHVibGljIGFsbG93T3ZlcnJpZGluZ05hdGl2ZUNvbnRleHRNZW51cygpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgcGxhdGZvcm0gc3VwcG9ydHMgZGlzcGxheWluZ1xuICAgICAqIG5vdGlmaWNhdGlvbnMsIG90aGVyd2lzZSBmYWxzZS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gd2hldGhlciB0aGUgcGxhdGZvcm0gc3VwcG9ydHMgZGlzcGxheWluZyBub3RpZmljYXRpb25zXG4gICAgICovXG4gICAgcHVibGljIHN1cHBvcnRzTm90aWZpY2F0aW9ucygpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgYXBwbGljYXRpb24gY3VycmVudGx5IGhhcyBwZXJtaXNzaW9uXG4gICAgICogdG8gZGlzcGxheSBub3RpZmljYXRpb25zLiBPdGhlcndpc2UgZmFsc2UuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IHdoZXRoZXIgdGhlIGFwcGxpY2F0aW9uIGhhcyBwZXJtaXNzaW9uIHRvIGRpc3BsYXkgbm90aWZpY2F0aW9uc1xuICAgICAqL1xuICAgIHB1YmxpYyBtYXlTZW5kTm90aWZpY2F0aW9ucygpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlcXVlc3RzIHBlcm1pc3Npb24gdG8gc2VuZCBub3RpZmljYXRpb25zLiBSZXR1cm5zXG4gICAgICogYSBwcm9taXNlIHRoYXQgaXMgcmVzb2x2ZWQgd2hlbiB0aGUgdXNlciBoYXMgcmVzcG9uZGVkXG4gICAgICogdG8gdGhlIHJlcXVlc3QuIFRoZSBwcm9taXNlIGhhcyBhIHNpbmdsZSBzdHJpbmcgYXJndW1lbnRcbiAgICAgKiB0aGF0IGlzICdncmFudGVkJyBpZiB0aGUgdXNlciBhbGxvd2VkIHRoZSByZXF1ZXN0IG9yXG4gICAgICogJ2RlbmllZCcgb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIHB1YmxpYyBhYnN0cmFjdCByZXF1ZXN0Tm90aWZpY2F0aW9uUGVybWlzc2lvbigpOiBQcm9taXNlPHN0cmluZz47XG5cbiAgICBwdWJsaWMgZGlzcGxheU5vdGlmaWNhdGlvbihcbiAgICAgICAgdGl0bGU6IHN0cmluZyxcbiAgICAgICAgbXNnOiBzdHJpbmcsXG4gICAgICAgIGF2YXRhclVybDogc3RyaW5nIHwgbnVsbCxcbiAgICAgICAgcm9vbTogUm9vbSxcbiAgICAgICAgZXY/OiBNYXRyaXhFdmVudCxcbiAgICApOiBOb3RpZmljYXRpb24ge1xuICAgICAgICBjb25zdCBub3RpZkJvZHk6IE5vdGlmaWNhdGlvbk9wdGlvbnMgPSB7XG4gICAgICAgICAgICBib2R5OiBtc2csXG4gICAgICAgICAgICBzaWxlbnQ6IHRydWUsIC8vIHdlIHBsYXkgb3VyIG93biBzb3VuZHNcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKGF2YXRhclVybCkgbm90aWZCb2R5W1wiaWNvblwiXSA9IGF2YXRhclVybDtcbiAgICAgICAgY29uc3Qgbm90aWZpY2F0aW9uID0gbmV3IHdpbmRvdy5Ob3RpZmljYXRpb24odGl0bGUsIG5vdGlmQm9keSk7XG5cbiAgICAgICAgbm90aWZpY2F0aW9uLm9uY2xpY2sgPSAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwYXlsb2FkOiBWaWV3Um9vbVBheWxvYWQgPSB7XG4gICAgICAgICAgICAgICAgYWN0aW9uOiBBY3Rpb24uVmlld1Jvb20sXG4gICAgICAgICAgICAgICAgcm9vbV9pZDogcm9vbS5yb29tSWQsXG4gICAgICAgICAgICAgICAgbWV0cmljc1RyaWdnZXI6IFwiTm90aWZpY2F0aW9uXCIsXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpZiAoZXY/LmdldFRocmVhZCgpKSB7XG4gICAgICAgICAgICAgICAgcGF5bG9hZC5ldmVudF9pZCA9IGV2LmdldElkKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGRpcy5kaXNwYXRjaChwYXlsb2FkKTtcbiAgICAgICAgICAgIHdpbmRvdy5mb2N1cygpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBub3RpZmljYXRpb247XG4gICAgfVxuXG4gICAgcHVibGljIGxvdWROb3RpZmljYXRpb24oZXY6IE1hdHJpeEV2ZW50LCByb29tOiBSb29tKTogdm9pZCB7fVxuXG4gICAgcHVibGljIGNsZWFyTm90aWZpY2F0aW9uKG5vdGlmOiBOb3RpZmljYXRpb24pOiB2b2lkIHtcbiAgICAgICAgLy8gU29tZSBicm93c2VycyBkb24ndCBzdXBwb3J0IHRoaXMsIGUuZyBTYWZhcmkgb24gaU9TXG4gICAgICAgIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9Ob3RpZmljYXRpb24vY2xvc2VcbiAgICAgICAgaWYgKG5vdGlmLmNsb3NlKSB7XG4gICAgICAgICAgICBub3RpZi5jbG9zZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBwbGF0Zm9ybSByZXF1aXJlcyBVUkwgcHJldmlld3MgaW4gdG9vbHRpcHMsIG90aGVyd2lzZSBmYWxzZS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gd2hldGhlciB0aGUgcGxhdGZvcm0gcmVxdWlyZXMgVVJMIHByZXZpZXdzIGluIHRvb2x0aXBzXG4gICAgICovXG4gICAgcHVibGljIG5lZWRzVXJsVG9vbHRpcHMoKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIGEgc3RyaW5nIHJlcHJlc2VudGluZyB0aGUgY3VycmVudCB2ZXJzaW9uIG9mIHRoZSBhcHBsaWNhdGlvbi5cbiAgICAgKi9cbiAgICBwdWJsaWMgYWJzdHJhY3QgZ2V0QXBwVmVyc2lvbigpOiBQcm9taXNlPHN0cmluZz47XG5cbiAgICAvKipcbiAgICAgKiBSZXN0YXJ0cyB0aGUgYXBwbGljYXRpb24sIHdpdGhvdXQgbmVjZXNzYXJpbHkgcmVsb2FkaW5nXG4gICAgICogYW55IGFwcGxpY2F0aW9uIGNvZGVcbiAgICAgKi9cbiAgICBwdWJsaWMgYWJzdHJhY3QgcmVsb2FkKCk6IHZvaWQ7XG5cbiAgICBwdWJsaWMgc3VwcG9ydHNTZXR0aW5nKHNldHRpbmdOYW1lPzogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0U2V0dGluZ1ZhbHVlKHNldHRpbmdOYW1lOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHB1YmxpYyBzZXRTZXR0aW5nVmFsdWUoc2V0dGluZ05hbWU6IHN0cmluZywgdmFsdWU6IGFueSk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmltcGxlbWVudGVkXCIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBvdXIgcGxhdGZvcm0gc3BlY2lmaWMgRXZlbnRJbmRleE1hbmFnZXIuXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtCYXNlRXZlbnRJbmRleE1hbmFnZXJ9IFRoZSBFdmVudEluZGV4IG1hbmFnZXIgZm9yIG91ciBwbGF0Zm9ybSxcbiAgICAgKiBjYW4gYmUgbnVsbCBpZiB0aGUgcGxhdGZvcm0gZG9lc24ndCBzdXBwb3J0IGV2ZW50IGluZGV4aW5nLlxuICAgICAqL1xuICAgIHB1YmxpYyBnZXRFdmVudEluZGV4aW5nTWFuYWdlcigpOiBCYXNlRXZlbnRJbmRleE1hbmFnZXIgfCBudWxsIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcHVibGljIHNldExhbmd1YWdlKHByZWZlcnJlZExhbmdzOiBzdHJpbmdbXSk6IHZvaWQge31cblxuICAgIHB1YmxpYyBzZXRTcGVsbENoZWNrRW5hYmxlZChlbmFibGVkOiBib29sZWFuKTogdm9pZCB7fVxuXG4gICAgcHVibGljIGFzeW5jIGdldFNwZWxsQ2hlY2tFbmFibGVkKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcHVibGljIHNldFNwZWxsQ2hlY2tMYW5ndWFnZXMocHJlZmVycmVkTGFuZ3M6IHN0cmluZ1tdKTogdm9pZCB7fVxuXG4gICAgcHVibGljIGdldFNwZWxsQ2hlY2tMYW5ndWFnZXMoKTogUHJvbWlzZTxzdHJpbmdbXT4gfCBudWxsIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGdldERlc2t0b3BDYXB0dXJlclNvdXJjZXMob3B0aW9uczogR2V0U291cmNlc09wdGlvbnMpOiBQcm9taXNlPEFycmF5PERlc2t0b3BDYXB0dXJlclNvdXJjZT4+IHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIHB1YmxpYyBzdXBwb3J0c0Rlc2t0b3BDYXB0dXJlcigpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHB1YmxpYyBzdXBwb3J0c0ppdHNpU2NyZWVuc2hhcmluZygpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcHVibGljIG92ZXJyaWRlQnJvd3NlclNob3J0Y3V0cygpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHB1YmxpYyBuYXZpZ2F0ZUZvcndhcmRCYWNrKGJhY2s6IGJvb2xlYW4pOiB2b2lkIHt9XG5cbiAgICBwdWJsaWMgZ2V0QXZhaWxhYmxlU3BlbGxDaGVja0xhbmd1YWdlcygpOiBQcm9taXNlPHN0cmluZ1tdPiB8IG51bGwge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgZ2V0U1NPQ2FsbGJhY2tVcmwoZnJhZ21lbnRBZnRlckxvZ2luID0gXCJcIik6IFVSTCB7XG4gICAgICAgIGNvbnN0IHVybCA9IG5ldyBVUkwod2luZG93LmxvY2F0aW9uLmhyZWYpO1xuICAgICAgICB1cmwuaGFzaCA9IGZyYWdtZW50QWZ0ZXJMb2dpbjtcbiAgICAgICAgcmV0dXJuIHVybDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBCZWdpbiBTaW5nbGUgU2lnbiBPbiBmbG93cy5cbiAgICAgKiBAcGFyYW0ge01hdHJpeENsaWVudH0gbXhDbGllbnQgdGhlIG1hdHJpeCBjbGllbnQgdXNpbmcgd2hpY2ggd2Ugc2hvdWxkIHN0YXJ0IHRoZSBmbG93XG4gICAgICogQHBhcmFtIHtcInNzb1wifFwiY2FzXCJ9IGxvZ2luVHlwZSB0aGUgdHlwZSBvZiBTU08gaXQgaXMsIENBUy9TU08uXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGZyYWdtZW50QWZ0ZXJMb2dpbiB0aGUgaGFzaCB0byBwYXNzIHRvIHRoZSBhcHAgZHVyaW5nIHNzbyBjYWxsYmFjay5cbiAgICAgKiBAcGFyYW0ge1NTT0FjdGlvbn0gYWN0aW9uIHRoZSBTU08gZmxvdyB0byBpbmRpY2F0ZSB0byB0aGUgSWRQLCBvcHRpb25hbC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gaWRwSWQgVGhlIElEIG9mIHRoZSBJZGVudGl0eSBQcm92aWRlciBiZWluZyB0YXJnZXRlZCwgb3B0aW9uYWwuXG4gICAgICovXG4gICAgcHVibGljIHN0YXJ0U2luZ2xlU2lnbk9uKFxuICAgICAgICBteENsaWVudDogTWF0cml4Q2xpZW50LFxuICAgICAgICBsb2dpblR5cGU6IFwic3NvXCIgfCBcImNhc1wiLFxuICAgICAgICBmcmFnbWVudEFmdGVyTG9naW4/OiBzdHJpbmcsXG4gICAgICAgIGlkcElkPzogc3RyaW5nLFxuICAgICAgICBhY3Rpb24/OiBTU09BY3Rpb24sXG4gICAgKTogdm9pZCB7XG4gICAgICAgIC8vIHBlcnNpc3QgaHMgdXJsIGFuZCBpcyB1cmwgZm9yIHdoZW4gdGhlIHVzZXIgaXMgcmV0dXJuZWQgdG8gdGhlIGFwcCB3aXRoIHRoZSBsb2dpbiB0b2tlblxuICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShTU09fSE9NRVNFUlZFUl9VUkxfS0VZLCBteENsaWVudC5nZXRIb21lc2VydmVyVXJsKCkpO1xuICAgICAgICBpZiAobXhDbGllbnQuZ2V0SWRlbnRpdHlTZXJ2ZXJVcmwoKSkge1xuICAgICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oU1NPX0lEX1NFUlZFUl9VUkxfS0VZLCBteENsaWVudC5nZXRJZGVudGl0eVNlcnZlclVybCgpISk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlkcElkKSB7XG4gICAgICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShTU09fSURQX0lEX0tFWSwgaWRwSWQpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNhbGxiYWNrVXJsID0gdGhpcy5nZXRTU09DYWxsYmFja1VybChmcmFnbWVudEFmdGVyTG9naW4pO1xuICAgICAgICB3aW5kb3cubG9jYXRpb24uaHJlZiA9IG14Q2xpZW50LmdldFNzb0xvZ2luVXJsKGNhbGxiYWNrVXJsLnRvU3RyaW5nKCksIGxvZ2luVHlwZSwgaWRwSWQsIGFjdGlvbik7IC8vIHJlZGlyZWN0IHRvIFNTT1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBhIHByZXZpb3VzbHkgc3RvcmVkIHBpY2tsZSBrZXkuICBUaGUgcGlja2xlIGtleSBpcyB1c2VkIGZvclxuICAgICAqIGVuY3J5cHRpbmcgbGlib2xtIG9iamVjdHMuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVzZXJJZCB0aGUgdXNlciBJRCBmb3IgdGhlIHVzZXIgdGhhdCB0aGUgcGlja2xlIGtleSBpcyBmb3IuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVzZXJJZCB0aGUgZGV2aWNlIElEIHRoYXQgdGhlIHBpY2tsZSBrZXkgaXMgZm9yLlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd8bnVsbH0gdGhlIHByZXZpb3VzbHkgc3RvcmVkIHBpY2tsZSBrZXksIG9yIG51bGwgaWYgbm9cbiAgICAgKiAgICAgcGlja2xlIGtleSBoYXMgYmVlbiBzdG9yZWQuXG4gICAgICovXG4gICAgcHVibGljIGFzeW5jIGdldFBpY2tsZUtleSh1c2VySWQ6IHN0cmluZywgZGV2aWNlSWQ6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICAgICAgICBpZiAoIXdpbmRvdy5jcnlwdG8gfHwgIXdpbmRvdy5jcnlwdG8uc3VidGxlKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBsZXQgZGF0YTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGRhdGEgPSBhd2FpdCBpZGJMb2FkKFwicGlja2xlS2V5XCIsIFt1c2VySWQsIGRldmljZUlkXSk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGxvZ2dlci5lcnJvcihcImlkYkxvYWQgZm9yIHBpY2tsZUtleSBmYWlsZWRcIiwgZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFkYXRhKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWRhdGEuZW5jcnlwdGVkIHx8ICFkYXRhLml2IHx8ICFkYXRhLmNyeXB0b0tleSkge1xuICAgICAgICAgICAgbG9nZ2VyLmVycm9yKFwiQmFkbHkgZm9ybWF0dGVkIHBpY2tsZSBrZXlcIik7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGFkZGl0aW9uYWxEYXRhID0gbmV3IFVpbnQ4QXJyYXkodXNlcklkLmxlbmd0aCArIGRldmljZUlkLmxlbmd0aCArIDEpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHVzZXJJZC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYWRkaXRpb25hbERhdGFbaV0gPSB1c2VySWQuY2hhckNvZGVBdChpKTtcbiAgICAgICAgfVxuICAgICAgICBhZGRpdGlvbmFsRGF0YVt1c2VySWQubGVuZ3RoXSA9IDEyNDsgLy8gXCJ8XCJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkZXZpY2VJZC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYWRkaXRpb25hbERhdGFbdXNlcklkLmxlbmd0aCArIDEgKyBpXSA9IGRldmljZUlkLmNoYXJDb2RlQXQoaSk7XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qga2V5ID0gYXdhaXQgY3J5cHRvLnN1YnRsZS5kZWNyeXB0KFxuICAgICAgICAgICAgICAgIHsgbmFtZTogXCJBRVMtR0NNXCIsIGl2OiBkYXRhLml2LCBhZGRpdGlvbmFsRGF0YSB9LFxuICAgICAgICAgICAgICAgIGRhdGEuY3J5cHRvS2V5LFxuICAgICAgICAgICAgICAgIGRhdGEuZW5jcnlwdGVkLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHJldHVybiBlbmNvZGVVbnBhZGRlZEJhc2U2NChrZXkpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBsb2dnZXIuZXJyb3IoXCJFcnJvciBkZWNyeXB0aW5nIHBpY2tsZSBrZXlcIik7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhbmQgc3RvcmUgYSBwaWNrbGUga2V5IGZvciBlbmNyeXB0aW5nIGxpYm9sbSBvYmplY3RzLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1c2VySWQgdGhlIHVzZXIgSUQgZm9yIHRoZSB1c2VyIHRoYXQgdGhlIHBpY2tsZSBrZXkgaXMgZm9yLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBkZXZpY2VJZCB0aGUgZGV2aWNlIElEIHRoYXQgdGhlIHBpY2tsZSBrZXkgaXMgZm9yLlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd8bnVsbH0gdGhlIHBpY2tsZSBrZXksIG9yIG51bGwgaWYgdGhlIHBsYXRmb3JtIGRvZXMgbm90XG4gICAgICogICAgIHN1cHBvcnQgc3RvcmluZyBwaWNrbGUga2V5cy5cbiAgICAgKi9cbiAgICBwdWJsaWMgYXN5bmMgY3JlYXRlUGlja2xlS2V5KHVzZXJJZDogc3RyaW5nLCBkZXZpY2VJZDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gICAgICAgIGlmICghd2luZG93LmNyeXB0byB8fCAhd2luZG93LmNyeXB0by5zdWJ0bGUpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNyeXB0byA9IHdpbmRvdy5jcnlwdG87XG4gICAgICAgIGNvbnN0IHJhbmRvbUFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoMzIpO1xuICAgICAgICBjcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKHJhbmRvbUFycmF5KTtcbiAgICAgICAgY29uc3QgY3J5cHRvS2V5ID0gYXdhaXQgY3J5cHRvLnN1YnRsZS5nZW5lcmF0ZUtleSh7IG5hbWU6IFwiQUVTLUdDTVwiLCBsZW5ndGg6IDI1NiB9LCBmYWxzZSwgW1xuICAgICAgICAgICAgXCJlbmNyeXB0XCIsXG4gICAgICAgICAgICBcImRlY3J5cHRcIixcbiAgICAgICAgXSk7XG4gICAgICAgIGNvbnN0IGl2ID0gbmV3IFVpbnQ4QXJyYXkoMzIpO1xuICAgICAgICBjcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKGl2KTtcblxuICAgICAgICBjb25zdCBhZGRpdGlvbmFsRGF0YSA9IG5ldyBVaW50OEFycmF5KHVzZXJJZC5sZW5ndGggKyBkZXZpY2VJZC5sZW5ndGggKyAxKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB1c2VySWQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFkZGl0aW9uYWxEYXRhW2ldID0gdXNlcklkLmNoYXJDb2RlQXQoaSk7XG4gICAgICAgIH1cbiAgICAgICAgYWRkaXRpb25hbERhdGFbdXNlcklkLmxlbmd0aF0gPSAxMjQ7IC8vIFwifFwiXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGV2aWNlSWQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFkZGl0aW9uYWxEYXRhW3VzZXJJZC5sZW5ndGggKyAxICsgaV0gPSBkZXZpY2VJZC5jaGFyQ29kZUF0KGkpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZW5jcnlwdGVkID0gYXdhaXQgY3J5cHRvLnN1YnRsZS5lbmNyeXB0KHsgbmFtZTogXCJBRVMtR0NNXCIsIGl2LCBhZGRpdGlvbmFsRGF0YSB9LCBjcnlwdG9LZXksIHJhbmRvbUFycmF5KTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgaWRiU2F2ZShcInBpY2tsZUtleVwiLCBbdXNlcklkLCBkZXZpY2VJZF0sIHsgZW5jcnlwdGVkLCBpdiwgY3J5cHRvS2V5IH0pO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZW5jb2RlVW5wYWRkZWRCYXNlNjQocmFuZG9tQXJyYXkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlbGV0ZSBhIHByZXZpb3VzbHkgc3RvcmVkIHBpY2tsZSBrZXkgZnJvbSBzdG9yYWdlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1c2VySWQgdGhlIHVzZXIgSUQgZm9yIHRoZSB1c2VyIHRoYXQgdGhlIHBpY2tsZSBrZXkgaXMgZm9yLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1c2VySWQgdGhlIGRldmljZSBJRCB0aGF0IHRoZSBwaWNrbGUga2V5IGlzIGZvci5cbiAgICAgKi9cbiAgICBwdWJsaWMgYXN5bmMgZGVzdHJveVBpY2tsZUtleSh1c2VySWQ6IHN0cmluZywgZGV2aWNlSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgaWRiRGVsZXRlKFwicGlja2xlS2V5XCIsIFt1c2VySWQsIGRldmljZUlkXSk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGxvZ2dlci5lcnJvcihcImlkYkRlbGV0ZSBmYWlsZWQgaW4gZGVzdHJveVBpY2tsZUtleVwiLCBlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsZWFyIGFwcCBzdG9yYWdlLCBjYWxsZWQgd2hlbiBsb2dnaW5nIG91dCB0byBwZXJmb3JtIGRhdGEgY2xlYW4gdXAuXG4gICAgICogQHBhcmFtIHByZXNlcnZlV2FsbGV0Q29ubmVjdCAtIElmIHRydWUsIHByZXNlcnZlcyBXYWxsZXRDb25uZWN0IHNlc3Npb24gZGF0YSAoZGVmYXVsdDogZmFsc2UgZm9yIGxvZ291dClcbiAgICAgKi9cbiAgICBwdWJsaWMgYXN5bmMgY2xlYXJTdG9yYWdlKHByZXNlcnZlV2FsbGV0Q29ubmVjdCA9IGZhbHNlKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGxldCB3Y1Nlc3Npb25Ub3BpYzogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgICAgIGxldCB3YWxsZXRBZGRyZXNzOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgICAgICAgbGV0IHdhbGxldE5hbWU6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXG4gICAgICAgIC8vIE9ubHkgcHJlc2VydmUgV2FsbGV0Q29ubmVjdCBkYXRhIGlmIGV4cGxpY2l0bHkgcmVxdWVzdGVkIChkdXJpbmcgbG9naW4sIG5vdCBsb2dvdXQpXG4gICAgICAgIGlmIChwcmVzZXJ2ZVdhbGxldENvbm5lY3QpIHtcbiAgICAgICAgICAgIHdjU2Vzc2lvblRvcGljID0gd2luZG93LnNlc3Npb25TdG9yYWdlLmdldEl0ZW0oJ3djX3Nlc3Npb25fdG9waWMnKTtcbiAgICAgICAgICAgIHdhbGxldEFkZHJlc3MgPSB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UuZ2V0SXRlbSgnd2FsbGV0X2FkZHJlc3MnKTtcbiAgICAgICAgICAgIHdhbGxldE5hbWUgPSB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UuZ2V0SXRlbSgnd2FsbGV0X25hbWUnKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgd2luZG93LnNlc3Npb25TdG9yYWdlLmNsZWFyKCk7XG4gICAgICAgIHdpbmRvdy5sb2NhbFN0b3JhZ2UuY2xlYXIoKTtcbiAgICAgICAgXG4gICAgICAgIC8vIFJlc3RvcmUgV2FsbGV0Q29ubmVjdCBzZXNzaW9uIGRhdGEgb25seSBpZiBwcmVzZXJ2YXRpb24gd2FzIHJlcXVlc3RlZFxuICAgICAgICBpZiAocHJlc2VydmVXYWxsZXRDb25uZWN0KSB7XG4gICAgICAgICAgICBpZiAod2NTZXNzaW9uVG9waWMpIHtcbiAgICAgICAgICAgICAgICB3aW5kb3cuc2Vzc2lvblN0b3JhZ2Uuc2V0SXRlbSgnd2Nfc2Vzc2lvbl90b3BpYycsIHdjU2Vzc2lvblRvcGljKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygn8J+UhCBQcmVzZXJ2ZWQgV2FsbGV0Q29ubmVjdCBzZXNzaW9uIElEIGR1cmluZyBsb2dpbiBjbGVhclN0b3JhZ2U6Jywgd2NTZXNzaW9uVG9waWMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHdhbGxldEFkZHJlc3MpIHtcbiAgICAgICAgICAgICAgICB3aW5kb3cuc2Vzc2lvblN0b3JhZ2Uuc2V0SXRlbSgnd2FsbGV0X2FkZHJlc3MnLCB3YWxsZXRBZGRyZXNzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh3YWxsZXROYW1lKSB7XG4gICAgICAgICAgICAgICAgd2luZG93LnNlc3Npb25TdG9yYWdlLnNldEl0ZW0oJ3dhbGxldF9uYW1lJywgd2FsbGV0TmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygn8J+nuSBDbGVhcmVkIGFsbCBzdG9yYWdlIGluY2x1ZGluZyBXYWxsZXRDb25uZWN0IHNlc3Npb24gZGF0YSAobG9nb3V0KScpO1xuICAgICAgICB9XG4gICAgfVxufVxuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQW9CQSxJQUFBQSxPQUFBLEdBQUFDLE9BQUE7QUFDQSxJQUFBQyxPQUFBLEdBQUFE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