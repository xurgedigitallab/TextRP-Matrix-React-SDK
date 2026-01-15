"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PosthogAnalytics = exports.Anonymity = void 0;
exports.getRedactedCurrentLocation = getRedactedCurrentLocation;
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _posthogJs = _interopRequireDefault(require("posthog-js"));
var _logger = require("matrix-js-sdk/src/logger");
var _PlatformPeg = _interopRequireDefault(require("./PlatformPeg"));
var _SdkConfig = _interopRequireDefault(require("./SdkConfig"));
var _MatrixClientPeg = require("./MatrixClientPeg");
var _SettingsStore = _interopRequireDefault(require("./settings/SettingsStore"));
var _actions = require("./dispatcher/actions");
var _dispatcher = _interopRequireDefault(require("./dispatcher/dispatcher"));
var _Layout = require("./settings/enums/Layout");
const _excluded = ["eventName"];
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         Copyright 2021 The Matrix.org Foundation C.I.C.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         
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
/* Posthog analytics tracking.
 *
 * Anonymity behaviour is as follows:
 *
 * - If Posthog isn't configured in `config.json`, events are not sent.
 * - If [Do Not Track](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/doNotTrack) is
 *   enabled, events are not sent (this detection is built into posthog and turned on via the
 *   `respect_dnt` flag being passed to `posthog.init`).
 * - If the `feature_pseudonymous_analytics_opt_in` labs flag is `true`, track pseudonomously by maintaining
 *   a randomised analytics ID in account_data for that user (shared between devices) and sending it to posthog to
     identify the user.
 * - Otherwise, if the existing `analyticsOptIn` flag is `true`, track anonymously, i.e. do not identify the user
     using any identifier that would be consistent across devices.
 * - If both flags are false or not set, events are not sent.
 */
let Anonymity = /*#__PURE__*/function (Anonymity) {
  Anonymity[Anonymity["Disabled"] = 0] = "Disabled";
  Anonymity[Anonymity["Anonymous"] = 1] = "Anonymous";
  Anonymity[Anonymity["Pseudonymous"] = 2] = "Pseudonymous";
  return Anonymity;
}({});
exports.Anonymity = Anonymity;
const whitelistedScreens = new Set(["register", "login", "forgot_password", "soft_logout", "new", "settings", "welcome", "home", "start", "directory", "start_sso", "start_cas", "complete_security", "post_registration", "room", "user"]);
function getRedactedCurrentLocation(origin, hash, pathname) {
  // Redact PII from the current location.
  // For known screens, assumes a URL structure of /<screen name>/might/be/pii
  if (origin.startsWith("file://")) {
    pathname = "/<redacted_file_scheme_url>/";
  }
  let hashStr;
  if (hash == "") {
    hashStr = "";
  } else {
    let [beforeFirstSlash, screen] = hash.split("/");
    if (!whitelistedScreens.has(screen)) {
      screen = "<redacted_screen_name>";
    }
    hashStr = `${beforeFirstSlash}/${screen}/<redacted>`;
  }
  return origin + pathname + hashStr;
}
class PosthogAnalytics {
  static get instance() {
    if (!this._instance) {
      this._instance = new PosthogAnalytics(_posthogJs.default);
    }
    return this._instance;
  }
  constructor(posthog) {
    this.posthog = posthog;
    /* Wrapper for Posthog analytics.
     * 3 modes of anonymity are supported, governed by this.anonymity
     * - Anonymity.Disabled means *no data* is passed to posthog
     * - Anonymity.Anonymous means no identifier is passed to posthog
     * - Anonymity.Pseudonymous means an analytics ID stored in account_data and shared between devices
     *   is passed to posthog.
     *
     * To update anonymity, call updateAnonymityFromSettings() or you can set it directly via setAnonymity().
     *
     * To pass an event to Posthog:
     *
     * 1. Declare a type for the event, extending IAnonymousEvent or IPseudonymousEvent.
     * 2. Call the appropriate track*() method. Pseudonymous events will be dropped when anonymity is
     *    Anonymous or Disabled; Anonymous events will be dropped when anonymity is Disabled.
     */
    (0, _defineProperty2.default)(this, "anonymity", Anonymity.Disabled);
    // set true during the constructor if posthog config is present, otherwise false
    (0, _defineProperty2.default)(this, "enabled", false);
    (0, _defineProperty2.default)(this, "platformSuperProperties", {});
    (0, _defineProperty2.default)(this, "propertiesForNextEvent", {});
    (0, _defineProperty2.default)(this, "userPropertyCache", {});
    (0, _defineProperty2.default)(this, "authenticationType", "Other");
    (0, _defineProperty2.default)(this, "onLayoutUpdated", () => {
      let layout;
      switch (_SettingsStore.default.getValue("layout")) {
        case _Layout.Layout.IRC:
          layout = "IRC";
          break;
        case _Layout.Layout.Bubble:
          layout = "Bubble";
          break;
        case _Layout.Layout.Group:
          layout = _SettingsStore.default.getValue("useCompactLayout") ? "Compact" : "Group";
          break;
      }

      // This is known to clobber other devices but is a good enough solution
      // to get an idea of how much use each layout gets.
      this.setProperty("WebLayout", layout);
    });
    (0, _defineProperty2.default)(this, "onAction", payload => {
      if (payload.action !== _actions.Action.SettingUpdated) return;
      const settingsPayload = payload;
      if (["layout", "useCompactLayout"].includes(settingsPayload.settingName)) {
        this.onLayoutUpdated();
      }
    });
    // we persist the last `$screen_name` and send it for all events until it is replaced
    (0, _defineProperty2.default)(this, "lastScreen", "Loading");
    (0, _defineProperty2.default)(this, "sanitizeProperties", (properties, eventName) => {
      // Callback from posthog to sanitize properties before sending them to the server.
      //
      // Here we sanitize posthog's built in properties which leak PII e.g. url reporting.
      // See utils.js _.info.properties in posthog-js.

      if (eventName === "$pageview") {
        this.lastScreen = properties["$current_url"];
      }
      // We inject a screen identifier in $current_url as per https://posthog.com/tutorials/spa
      properties["$current_url"] = this.lastScreen;
      if (this.anonymity == Anonymity.Anonymous) {
        // drop referrer information for anonymous users
        properties["$referrer"] = null;
        properties["$referring_domain"] = null;
        properties["$initial_referrer"] = null;
        properties["$initial_referring_domain"] = null;

        // drop device ID, which is a UUID persisted in local storage
        properties["$device_id"] = null;
      }
      return properties;
    });
    const posthogConfig = _SdkConfig.default.getObject("posthog");
    if (posthogConfig) {
      this.posthog.init(posthogConfig.get("project_api_key"), {
        api_host: posthogConfig.get("api_host"),
        autocapture: false,
        mask_all_text: true,
        mask_all_element_attributes: true,
        // This only triggers on page load, which for our SPA isn't particularly useful.
        // Plus, the .capture call originating from somewhere in posthog makes it hard
        // to redact URLs, which requires async code.
        //
        // To raise this manually, just call .capture("$pageview") or posthog.capture_pageview.
        capture_pageview: false,
        sanitize_properties: this.sanitizeProperties,
        respect_dnt: true,
        advanced_disable_decide: true
      });
      this.enabled = true;
    } else {
      this.enabled = false;
    }
    _dispatcher.default.register(this.onAction);
    _SettingsStore.default.monitorSetting("layout", null);
    _SettingsStore.default.monitorSetting("useCompactLayout", null);
    this.onLayoutUpdated();
  }
  registerSuperProperties(properties) {
    if (this.enabled) {
      this.posthog.register(properties);
    }
  }
  static async getPlatformProperties() {
    const platform = _PlatformPeg.default.get();
    let appVersion;
    try {
      appVersion = await platform?.getAppVersion();
    } catch (e) {
      // this happens if no version is set i.e. in dev
      appVersion = "unknown";
    }
    return {
      appVersion,
      appPlatform: platform?.getHumanReadableName()
    };
  }

  // eslint-disable-nextline no-unused-vars
  capture(eventName, properties, options) {
    if (!this.enabled) {
      return;
    }
    const {
      origin,
      hash,
      pathname
    } = window.location;
    properties["redactedCurrentUrl"] = getRedactedCurrentLocation(origin, hash, pathname);
    this.posthog.capture(eventName, _objectSpread(_objectSpread({}, this.propertiesForNextEvent), properties) // TODO: Uncomment below once https://github.com/PostHog/posthog-js/pull/391
    // gets merged
    /* options as any, */
    // No proper type definition in the posthog library
    );
    this.propertiesForNextEvent = {};
  }
  isEnabled() {
    return this.enabled;
  }
  setAnonymity(anonymity) {
    // Update this.anonymity.
    // This is public for testing purposes, typically you want to call updateAnonymityFromSettings
    // to ensure this value is in step with the user's settings.
    if (this.enabled && (anonymity == Anonymity.Disabled || anonymity == Anonymity.Anonymous)) {
      // when transitioning to Disabled or Anonymous ensure we clear out any prior state
      // set in posthog e.g. distinct ID
      this.posthog.reset();
      // Restore any previously set platform super properties
      this.registerSuperProperties(this.platformSuperProperties);
    }
    this.anonymity = anonymity;
  }
  static getRandomAnalyticsId() {
    return [...crypto.getRandomValues(new Uint8Array(16))].map(c => c.toString(16)).join("");
  }
  async identifyUser(client, analyticsIdGenerator) {
    if (this.anonymity == Anonymity.Pseudonymous) {
      // Check the user's account_data for an analytics ID to use. Storing the ID in account_data allows
      // different devices to send the same ID.
      try {
        const accountData = await client.getAccountDataFromServer(PosthogAnalytics.ANALYTICS_EVENT_TYPE);
        let analyticsID = accountData?.id;
        if (!analyticsID) {
          // Couldn't retrieve an analytics ID from user settings, so create one and set it on the server.
          // Note there's a race condition here - if two devices do these steps at the same time, last write
          // wins, and the first writer will send tracking with an ID that doesn't match the one on the server
          // until the next time account data is refreshed and this function is called (most likely on next
          // page load). This will happen pretty infrequently, so we can tolerate the possibility.
          analyticsID = analyticsIdGenerator();
          await client.setAccountData(PosthogAnalytics.ANALYTICS_EVENT_TYPE, Object.assign({
            id: analyticsID
          }, accountData));
        }
        if (this.posthog.get_distinct_id() === analyticsID) {
          // No point identifying again
          return;
        }
        if (this.posthog.persistence.get_user_state() === "identified") {
          // Analytics ID has changed, reset as Posthog will refuse to merge in this case
          this.posthog.reset();
        }
        this.posthog.identify(analyticsID);
      } catch (e) {
        // The above could fail due to network requests, but not essential to starting the application,
        // so swallow it.
        _logger.logger.log("Unable to identify user for tracking" + e.toString());
      }
    }
  }
  getAnonymity() {
    return this.anonymity;
  }
  logout() {
    if (this.enabled) {
      this.posthog.reset();
    }
    this.setAnonymity(Anonymity.Disabled);
  }
  trackEvent(_ref, options) {
    let {
        eventName
      } = _ref,
      properties = (0, _objectWithoutProperties2.default)(_ref, _excluded);
    if (this.anonymity == Anonymity.Disabled || this.anonymity == Anonymity.Anonymous) return;
    this.capture(eventName, properties, options);
  }
  setProperty(key, value) {
    if (this.userPropertyCache[key] === value) return; // nothing to do
    this.userPropertyCache[key] = value;
    if (!this.propertiesForNextEvent["$set"]) {
      this.propertiesForNextEvent["$set"] = {};
    }
    this.propertiesForNextEvent["$set"][key] = value;
  }
  setPropertyOnce(key, value) {
    if (this.userPropertyCache[key]) return; // nothing to do
    this.userPropertyCache[key] = value;
    if (!this.propertiesForNextEvent["$set_once"]) {
      this.propertiesForNextEvent["$set_once"] = {};
    }
    this.propertiesForNextEvent["$set_once"][key] = value;
  }
  async updatePlatformSuperProperties() {
    // Update super properties in posthog with our platform (app version, platform).
    // These properties will be subsequently passed in every event.
    //
    // This only needs to be done once per page lifetime. Note that getPlatformProperties
    // is async and can involve a network request if we are running in a browser.
    this.platformSuperProperties = await PosthogAnalytics.getPlatformProperties();
    this.registerSuperProperties(this.platformSuperProperties);
  }
  async updateAnonymityFromSettings(client, pseudonymousOptIn) {
    // Update this.anonymity based on the user's analytics opt-in settings
    const anonymity = pseudonymousOptIn ? Anonymity.Pseudonymous : Anonymity.Disabled;
    this.setAnonymity(anonymity);
    if (anonymity === Anonymity.Pseudonymous) {
      await this.identifyUser(client, PosthogAnalytics.getRandomAnalyticsId);
      if (_MatrixClientPeg.MatrixClientPeg.currentUserIsJustRegistered()) {
        this.trackNewUserEvent();
      }
    }
    if (anonymity !== Anonymity.Disabled) {
      await PosthogAnalytics.instance.updatePlatformSuperProperties();
    }
  }
  startListeningToSettingsChanges(client) {
    // Listen to account data changes from sync so we can observe changes to relevant flags and update.
    // This is called -
    //  * On page load, when the account data is first received by sync
    //  * On login
    //  * When another device changes account data
    //  * When the user changes their preferences on this device
    // Note that for new accounts, pseudonymousAnalyticsOptIn won't be set, so updateAnonymityFromSettings
    // won't be called (i.e. this.anonymity will be left as the default, until the setting changes)
    _SettingsStore.default.watchSetting("pseudonymousAnalyticsOptIn", null, (originalSettingName, changedInRoomId, atLevel, newValueAtLevel, newValue) => {
      this.updateAnonymityFromSettings(client, !!newValue);
    });
  }
  setAuthenticationType(authenticationType) {
    this.authenticationType = authenticationType;
  }
  trackNewUserEvent() {
    // This is the only event that could have occured before analytics opt-in
    // that we want to accumulate before the user has given consent
    // All other scenarios should not track a user before they have given
    // explicit consent that they are ok with their analytics data being collected
    const options = {};
    const registrationTime = parseInt(window.localStorage.getItem("mx_registration_time"), 10);
    if (!isNaN(registrationTime)) {
      options.timestamp = new Date(registrationTime);
    }
    return this.trackEvent({
      eventName: "Signup",
      authenticationType: this.authenticationType
    }, options);
  }
}
exports.PosthogAnalytics = PosthogAnalytics;
(0, _defineProperty2.default)(PosthogAnalytics, "_instance", null);
(0, _defineProperty2.default)(PosthogAnalytics, "ANALYTICS_EVENT_TYPE", "im.vector.analytics");
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfcG9zdGhvZ0pzIiwiX2ludGVyb3BSZXF1aXJlRGVmYXVsdCIsInJlcXVpcmUiLCJfbG9nZ2VyIiwiX1BsYXRmb3JtUGVnIiwiX1Nka0NvbmZpZyIsIl9NYXRyaXhDbGllbnRQZWciLCJfU2V0dGluZ3NTdG9yZSIsIl9hY3Rpb25zIiwiX2Rpc3BhdGNoZXIiLCJfTGF5b3V0IiwiX2V4Y2x1ZGVkIiwib3duS2V5cyIsIm9iamVjdCIsImVudW1lcmFibGVPbmx5Iiwia2V5cyIsIk9iamVjdCIsImdldE93blByb3BlcnR5U3ltYm9scyIsInN5bWJvbHMiLCJmaWx0ZXIiLCJzeW0iLCJnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IiLCJlbnVtZXJhYmxlIiwicHVzaCIsImFwcGx5IiwiX29iamVjdFNwcmVhZCIsInRhcmdldCIsImkiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJzb3VyY2UiLCJmb3JFYWNoIiwia2V5IiwiX2RlZmluZVByb3BlcnR5MiIsImRlZmF1bHQiLCJnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzIiwiZGVmaW5lUHJvcGVydGllcyIsImRlZmluZVByb3BlcnR5IiwiQW5vbnltaXR5IiwiZXhwb3J0cyIsIndoaXRlbGlzdGVkU2NyZWVucyIsIlNldCIsImdldFJlZGFjdGVkQ3VycmVudExvY2F0aW9uIiwib3JpZ2luIiwiaGFzaCIsInBhdGhuYW1lIiwic3RhcnRzV2l0aCIsImhhc2hTdHIiLCJiZWZvcmVGaXJzdFNsYXNoIiwic2NyZWVuIiwic3BsaXQiLCJoYXMiLCJQb3N0aG9nQW5hbHl0aWNzIiwiaW5zdGFuY2UiLCJfaW5zdGFuY2UiLCJwb3N0aG9nIiwiY29uc3RydWN0b3IiLCJEaXNhYmxlZCIsImxheW91dCIsIlNldHRpbmdzU3RvcmUiLCJnZXRWYWx1ZSIsIkxheW91dCIsIklSQyIsIkJ1YmJsZSIsIkdyb3VwIiwic2V0UHJvcGVydHkiLCJwYXlsb2FkIiwiYWN0aW9uIiwiQWN0aW9uIiwiU2V0dGluZ1VwZGF0ZWQiLCJzZXR0aW5nc1BheWxvYWQiLCJpbmNsdWRlcyIsInNldHRpbmdOYW1lIiwib25MYXlvdXRVcGRhdGVkIiwicHJvcGVydGllcyIsImV2ZW50TmFtZSIsImxhc3RTY3JlZW4iLCJhbm9ueW1pdHkiLCJBbm9ueW1vdXMiLCJwb3N0aG9nQ29uZmlnIiwiU2RrQ29uZmlnIiwiZ2V0T2JqZWN0IiwiaW5pdCIsImdldCIsImFwaV9ob3N0IiwiYXV0b2NhcHR1cmUiLCJtYXNrX2FsbF90ZXh0IiwibWFza19hbGxfZWxlbWVudF9hdHRyaWJ1dGVzIiwiY2FwdHVyZV9wYWdldmlldyIsInNhbml0aXplX3Byb3BlcnRpZXMiLCJzYW5pdGl6ZVByb3BlcnRpZXMiLCJyZXNwZWN0X2RudCIsImFkdmFuY2VkX2Rpc2FibGVfZGVjaWRlIiwiZW5hYmxlZCIsImRpcyIsInJlZ2lzdGVyIiwib25BY3Rpb24iLCJtb25pdG9yU2V0dGluZyIsInJlZ2lzdGVyU3VwZXJQcm9wZXJ0aWVzIiwiZ2V0UGxhdGZvcm1Qcm9wZXJ0aWVzIiwicGxhdGZvcm0iLCJQbGF0Zm9ybVBlZyIsImFwcFZlcnNpb24iLCJnZXRBcHBWZXJzaW9uIiwiZSIsImFwcFBsYXRmb3JtIiwiZ2V0SHVtYW5SZWFkYWJsZU5hbWUiLCJjYXB0dXJlIiwib3B0aW9ucyIsIndpbmRvdyIsImxvY2F0aW9uIiwicHJvcGVydGllc0Zvck5leHRFdmVudCIsImlzRW5hYmxlZCIsInNldEFub255bWl0eSIsInJlc2V0IiwicGxhdGZvcm1TdXBlclByb3BlcnRpZXMiLCJnZXRSYW5kb21BbmFseXRpY3NJZCIsImNyeXB0byIsImdldFJhbmRvbVZhbHVlcyIsIlVpbnQ4QXJyYXkiLCJtYXAiLCJjIiwidG9TdHJpbmciLCJqb2luIiwiaWRlbnRpZnlVc2VyIiwiY2xpZW50IiwiYW5hbHl0aWNzSWRHZW5lcmF0b3IiLCJQc2V1ZG9ueW1vdXMiLCJhY2NvdW50RGF0YSIsImdldEFjY291bnREYXRhRnJvbVNlcnZlciIsIkFOQUxZVElDU19FVkVOVF9UWVBFIiwiYW5hbHl0aWNzSUQiLCJpZCIsInNldEFjY291bnREYXRhIiwiYXNzaWduIiwiZ2V0X2Rpc3RpbmN0X2lkIiwicGVyc2lzdGVuY2UiLCJnZXRfdXNlcl9zdGF0ZSIsImlkZW50aWZ5IiwibG9nZ2VyIiwibG9nIiwiZ2V0QW5vbnltaXR5IiwibG9nb3V0IiwidHJhY2tFdmVudCIsIl9yZWYiLCJfb2JqZWN0V2l0aG91dFByb3BlcnRpZXMyIiwidmFsdWUiLCJ1c2VyUHJvcGVydHlDYWNoZSIsInNldFByb3BlcnR5T25jZSIsInVwZGF0ZVBsYXRmb3JtU3VwZXJQcm9wZXJ0aWVzIiwidXBkYXRlQW5vbnltaXR5RnJvbVNldHRpbmdzIiwicHNldWRvbnltb3VzT3B0SW4iLCJNYXRyaXhDbGllbnRQZWciLCJjdXJyZW50VXNlcklzSnVzdFJlZ2lzdGVyZWQiLCJ0cmFja05ld1VzZXJFdmVudCIsInN0YXJ0TGlzdGVuaW5nVG9TZXR0aW5nc0NoYW5nZXMiLCJ3YXRjaFNldHRpbmciLCJvcmlnaW5hbFNldHRpbmdOYW1lIiwiY2hhbmdlZEluUm9vbUlkIiwiYXRMZXZlbCIsIm5ld1ZhbHVlQXRMZXZlbCIsIm5ld1ZhbHVlIiwic2V0QXV0aGVudGljYXRpb25UeXBlIiwiYXV0aGVudGljYXRpb25UeXBlIiwicmVnaXN0cmF0aW9uVGltZSIsInBhcnNlSW50IiwibG9jYWxTdG9yYWdlIiwiZ2V0SXRlbSIsImlzTmFOIiwidGltZXN0YW1wIiwiRGF0ZSJdLCJzb3VyY2VzIjpbIi4uL3NyYy9Qb3N0aG9nQW5hbHl0aWNzLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qXG5Db3B5cmlnaHQgMjAyMSBUaGUgTWF0cml4Lm9yZyBGb3VuZGF0aW9uIEMuSS5DLlxuXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiovXG5cbmltcG9ydCBwb3N0aG9nLCB7IFBvc3RIb2csIFByb3BlcnRpZXMgfSBmcm9tIFwicG9zdGhvZy1qc1wiO1xuaW1wb3J0IHsgTWF0cml4Q2xpZW50IH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL2NsaWVudFwiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL2xvZ2dlclwiO1xuaW1wb3J0IHsgVXNlclByb3BlcnRpZXMgfSBmcm9tIFwiQG1hdHJpeC1vcmcvYW5hbHl0aWNzLWV2ZW50cy90eXBlcy90eXBlc2NyaXB0L1VzZXJQcm9wZXJ0aWVzXCI7XG5pbXBvcnQgeyBTaWdudXAgfSBmcm9tIFwiQG1hdHJpeC1vcmcvYW5hbHl0aWNzLWV2ZW50cy90eXBlcy90eXBlc2NyaXB0L1NpZ251cFwiO1xuXG5pbXBvcnQgUGxhdGZvcm1QZWcgZnJvbSBcIi4vUGxhdGZvcm1QZWdcIjtcbmltcG9ydCBTZGtDb25maWcgZnJvbSBcIi4vU2RrQ29uZmlnXCI7XG5pbXBvcnQgeyBNYXRyaXhDbGllbnRQZWcgfSBmcm9tIFwiLi9NYXRyaXhDbGllbnRQZWdcIjtcbmltcG9ydCBTZXR0aW5nc1N0b3JlIGZyb20gXCIuL3NldHRpbmdzL1NldHRpbmdzU3RvcmVcIjtcbmltcG9ydCB7IFNjcmVlbk5hbWUgfSBmcm9tIFwiLi9Qb3N0aG9nVHJhY2tlcnNcIjtcbmltcG9ydCB7IEFjdGlvblBheWxvYWQgfSBmcm9tIFwiLi9kaXNwYXRjaGVyL3BheWxvYWRzXCI7XG5pbXBvcnQgeyBBY3Rpb24gfSBmcm9tIFwiLi9kaXNwYXRjaGVyL2FjdGlvbnNcIjtcbmltcG9ydCB7IFNldHRpbmdVcGRhdGVkUGF5bG9hZCB9IGZyb20gXCIuL2Rpc3BhdGNoZXIvcGF5bG9hZHMvU2V0dGluZ1VwZGF0ZWRQYXlsb2FkXCI7XG5pbXBvcnQgZGlzIGZyb20gXCIuL2Rpc3BhdGNoZXIvZGlzcGF0Y2hlclwiO1xuaW1wb3J0IHsgTGF5b3V0IH0gZnJvbSBcIi4vc2V0dGluZ3MvZW51bXMvTGF5b3V0XCI7XG5cbi8qIFBvc3Rob2cgYW5hbHl0aWNzIHRyYWNraW5nLlxuICpcbiAqIEFub255bWl0eSBiZWhhdmlvdXIgaXMgYXMgZm9sbG93czpcbiAqXG4gKiAtIElmIFBvc3Rob2cgaXNuJ3QgY29uZmlndXJlZCBpbiBgY29uZmlnLmpzb25gLCBldmVudHMgYXJlIG5vdCBzZW50LlxuICogLSBJZiBbRG8gTm90IFRyYWNrXShodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvTmF2aWdhdG9yL2RvTm90VHJhY2spIGlzXG4gKiAgIGVuYWJsZWQsIGV2ZW50cyBhcmUgbm90IHNlbnQgKHRoaXMgZGV0ZWN0aW9uIGlzIGJ1aWx0IGludG8gcG9zdGhvZyBhbmQgdHVybmVkIG9uIHZpYSB0aGVcbiAqICAgYHJlc3BlY3RfZG50YCBmbGFnIGJlaW5nIHBhc3NlZCB0byBgcG9zdGhvZy5pbml0YCkuXG4gKiAtIElmIHRoZSBgZmVhdHVyZV9wc2V1ZG9ueW1vdXNfYW5hbHl0aWNzX29wdF9pbmAgbGFicyBmbGFnIGlzIGB0cnVlYCwgdHJhY2sgcHNldWRvbm9tb3VzbHkgYnkgbWFpbnRhaW5pbmdcbiAqICAgYSByYW5kb21pc2VkIGFuYWx5dGljcyBJRCBpbiBhY2NvdW50X2RhdGEgZm9yIHRoYXQgdXNlciAoc2hhcmVkIGJldHdlZW4gZGV2aWNlcykgYW5kIHNlbmRpbmcgaXQgdG8gcG9zdGhvZyB0b1xuICAgICBpZGVudGlmeSB0aGUgdXNlci5cbiAqIC0gT3RoZXJ3aXNlLCBpZiB0aGUgZXhpc3RpbmcgYGFuYWx5dGljc09wdEluYCBmbGFnIGlzIGB0cnVlYCwgdHJhY2sgYW5vbnltb3VzbHksIGkuZS4gZG8gbm90IGlkZW50aWZ5IHRoZSB1c2VyXG4gICAgIHVzaW5nIGFueSBpZGVudGlmaWVyIHRoYXQgd291bGQgYmUgY29uc2lzdGVudCBhY3Jvc3MgZGV2aWNlcy5cbiAqIC0gSWYgYm90aCBmbGFncyBhcmUgZmFsc2Ugb3Igbm90IHNldCwgZXZlbnRzIGFyZSBub3Qgc2VudC5cbiAqL1xuXG5leHBvcnQgaW50ZXJmYWNlIElQb3N0aG9nRXZlbnQge1xuICAgIC8vIFRoZSBldmVudCBuYW1lIHRoYXQgd2lsbCBiZSB1c2VkIGJ5IFBvc3RIb2cuIEV2ZW50IG5hbWVzIHNob3VsZCB1c2UgY2FtZWxDYXNlLlxuICAgIGV2ZW50TmFtZTogc3RyaW5nO1xuXG4gICAgLy8gZG8gbm90IGFsbG93IHRoZXNlIHRvIGJlIHNlbnQgbWFudWFsbHksIHdlIGVucXVldWUgdGhlbSBhbGwgZm9yIGNhY2hpbmcgcHVycG9zZXNcbiAgICAkc2V0Pzogdm9pZDtcbiAgICAkc2V0X29uY2U/OiB2b2lkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElQb3N0SG9nRXZlbnRPcHRpb25zIHtcbiAgICB0aW1lc3RhbXA/OiBEYXRlO1xufVxuXG5leHBvcnQgZW51bSBBbm9ueW1pdHkge1xuICAgIERpc2FibGVkLFxuICAgIEFub255bW91cyxcbiAgICBQc2V1ZG9ueW1vdXMsXG59XG5cbmNvbnN0IHdoaXRlbGlzdGVkU2NyZWVucyA9IG5ldyBTZXQoW1xuICAgIFwicmVnaXN0ZXJcIixcbiAgICBcImxvZ2luXCIsXG4gICAgXCJmb3Jnb3RfcGFzc3dvcmRcIixcbiAgICBcInNvZnRfbG9nb3V0XCIsXG4gICAgXCJuZXdcIixcbiAgICBcInNldHRpbmdzXCIsXG4gICAgXCJ3ZWxjb21lXCIsXG4gICAgXCJob21lXCIsXG4gICAgXCJzdGFydFwiLFxuICAgIFwiZGlyZWN0b3J5XCIsXG4gICAgXCJzdGFydF9zc29cIixcbiAgICBcInN0YXJ0X2Nhc1wiLFxuICAgIFwiY29tcGxldGVfc2VjdXJpdHlcIixcbiAgICBcInBvc3RfcmVnaXN0cmF0aW9uXCIsXG4gICAgXCJyb29tXCIsXG4gICAgXCJ1c2VyXCIsXG5dKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldFJlZGFjdGVkQ3VycmVudExvY2F0aW9uKG9yaWdpbjogc3RyaW5nLCBoYXNoOiBzdHJpbmcsIHBhdGhuYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIC8vIFJlZGFjdCBQSUkgZnJvbSB0aGUgY3VycmVudCBsb2NhdGlvbi5cbiAgICAvLyBGb3Iga25vd24gc2NyZWVucywgYXNzdW1lcyBhIFVSTCBzdHJ1Y3R1cmUgb2YgLzxzY3JlZW4gbmFtZT4vbWlnaHQvYmUvcGlpXG4gICAgaWYgKG9yaWdpbi5zdGFydHNXaXRoKFwiZmlsZTovL1wiKSkge1xuICAgICAgICBwYXRobmFtZSA9IFwiLzxyZWRhY3RlZF9maWxlX3NjaGVtZV91cmw+L1wiO1xuICAgIH1cblxuICAgIGxldCBoYXNoU3RyO1xuICAgIGlmIChoYXNoID09IFwiXCIpIHtcbiAgICAgICAgaGFzaFN0ciA9IFwiXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbGV0IFtiZWZvcmVGaXJzdFNsYXNoLCBzY3JlZW5dID0gaGFzaC5zcGxpdChcIi9cIik7XG5cbiAgICAgICAgaWYgKCF3aGl0ZWxpc3RlZFNjcmVlbnMuaGFzKHNjcmVlbikpIHtcbiAgICAgICAgICAgIHNjcmVlbiA9IFwiPHJlZGFjdGVkX3NjcmVlbl9uYW1lPlwiO1xuICAgICAgICB9XG5cbiAgICAgICAgaGFzaFN0ciA9IGAke2JlZm9yZUZpcnN0U2xhc2h9LyR7c2NyZWVufS88cmVkYWN0ZWQ+YDtcbiAgICB9XG4gICAgcmV0dXJuIG9yaWdpbiArIHBhdGhuYW1lICsgaGFzaFN0cjtcbn1cblxuaW50ZXJmYWNlIFBsYXRmb3JtUHJvcGVydGllcyB7XG4gICAgYXBwVmVyc2lvbjogc3RyaW5nO1xuICAgIGFwcFBsYXRmb3JtOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBQb3N0aG9nQW5hbHl0aWNzIHtcbiAgICAvKiBXcmFwcGVyIGZvciBQb3N0aG9nIGFuYWx5dGljcy5cbiAgICAgKiAzIG1vZGVzIG9mIGFub255bWl0eSBhcmUgc3VwcG9ydGVkLCBnb3Zlcm5lZCBieSB0aGlzLmFub255bWl0eVxuICAgICAqIC0gQW5vbnltaXR5LkRpc2FibGVkIG1lYW5zICpubyBkYXRhKiBpcyBwYXNzZWQgdG8gcG9zdGhvZ1xuICAgICAqIC0gQW5vbnltaXR5LkFub255bW91cyBtZWFucyBubyBpZGVudGlmaWVyIGlzIHBhc3NlZCB0byBwb3N0aG9nXG4gICAgICogLSBBbm9ueW1pdHkuUHNldWRvbnltb3VzIG1lYW5zIGFuIGFuYWx5dGljcyBJRCBzdG9yZWQgaW4gYWNjb3VudF9kYXRhIGFuZCBzaGFyZWQgYmV0d2VlbiBkZXZpY2VzXG4gICAgICogICBpcyBwYXNzZWQgdG8gcG9zdGhvZy5cbiAgICAgKlxuICAgICAqIFRvIHVwZGF0ZSBhbm9ueW1pdHksIGNhbGwgdXBkYXRlQW5vbnltaXR5RnJvbVNldHRpbmdzKCkgb3IgeW91IGNhbiBzZXQgaXQgZGlyZWN0bHkgdmlhIHNldEFub255bWl0eSgpLlxuICAgICAqXG4gICAgICogVG8gcGFzcyBhbiBldmVudCB0byBQb3N0aG9nOlxuICAgICAqXG4gICAgICogMS4gRGVjbGFyZSBhIHR5cGUgZm9yIHRoZSBldmVudCwgZXh0ZW5kaW5nIElBbm9ueW1vdXNFdmVudCBvciBJUHNldWRvbnltb3VzRXZlbnQuXG4gICAgICogMi4gQ2FsbCB0aGUgYXBwcm9wcmlhdGUgdHJhY2sqKCkgbWV0aG9kLiBQc2V1ZG9ueW1vdXMgZXZlbnRzIHdpbGwgYmUgZHJvcHBlZCB3aGVuIGFub255bWl0eSBpc1xuICAgICAqICAgIEFub255bW91cyBvciBEaXNhYmxlZDsgQW5vbnltb3VzIGV2ZW50cyB3aWxsIGJlIGRyb3BwZWQgd2hlbiBhbm9ueW1pdHkgaXMgRGlzYWJsZWQuXG4gICAgICovXG5cbiAgICBwcml2YXRlIGFub255bWl0eSA9IEFub255bWl0eS5EaXNhYmxlZDtcbiAgICAvLyBzZXQgdHJ1ZSBkdXJpbmcgdGhlIGNvbnN0cnVjdG9yIGlmIHBvc3Rob2cgY29uZmlnIGlzIHByZXNlbnQsIG90aGVyd2lzZSBmYWxzZVxuICAgIHByaXZhdGUgcmVhZG9ubHkgZW5hYmxlZDogYm9vbGVhbiA9IGZhbHNlO1xuICAgIHByaXZhdGUgc3RhdGljIF9pbnN0YW5jZTogUG9zdGhvZ0FuYWx5dGljcyB8IG51bGwgPSBudWxsO1xuICAgIHByaXZhdGUgcGxhdGZvcm1TdXBlclByb3BlcnRpZXM6IFByb3BlcnRpZXMgPSB7fTtcbiAgICBwdWJsaWMgc3RhdGljIHJlYWRvbmx5IEFOQUxZVElDU19FVkVOVF9UWVBFID0gXCJpbS52ZWN0b3IuYW5hbHl0aWNzXCI7XG4gICAgcHJpdmF0ZSBwcm9wZXJ0aWVzRm9yTmV4dEV2ZW50OiBQYXJ0aWFsPFJlY29yZDxcIiRzZXRcIiB8IFwiJHNldF9vbmNlXCIsIFVzZXJQcm9wZXJ0aWVzPj4gPSB7fTtcbiAgICBwcml2YXRlIHVzZXJQcm9wZXJ0eUNhY2hlOiBVc2VyUHJvcGVydGllcyA9IHt9O1xuICAgIHByaXZhdGUgYXV0aGVudGljYXRpb25UeXBlOiBTaWdudXBbXCJhdXRoZW50aWNhdGlvblR5cGVcIl0gPSBcIk90aGVyXCI7XG5cbiAgICBwdWJsaWMgc3RhdGljIGdldCBpbnN0YW5jZSgpOiBQb3N0aG9nQW5hbHl0aWNzIHtcbiAgICAgICAgaWYgKCF0aGlzLl9pbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy5faW5zdGFuY2UgPSBuZXcgUG9zdGhvZ0FuYWx5dGljcyhwb3N0aG9nKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5faW5zdGFuY2U7XG4gICAgfVxuXG4gICAgcHVibGljIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgcG9zdGhvZzogUG9zdEhvZykge1xuICAgICAgICBjb25zdCBwb3N0aG9nQ29uZmlnID0gU2RrQ29uZmlnLmdldE9iamVjdChcInBvc3Rob2dcIik7XG4gICAgICAgIGlmIChwb3N0aG9nQ29uZmlnKSB7XG4gICAgICAgICAgICB0aGlzLnBvc3Rob2cuaW5pdChwb3N0aG9nQ29uZmlnLmdldChcInByb2plY3RfYXBpX2tleVwiKSwge1xuICAgICAgICAgICAgICAgIGFwaV9ob3N0OiBwb3N0aG9nQ29uZmlnLmdldChcImFwaV9ob3N0XCIpLFxuICAgICAgICAgICAgICAgIGF1dG9jYXB0dXJlOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBtYXNrX2FsbF90ZXh0OiB0cnVlLFxuICAgICAgICAgICAgICAgIG1hc2tfYWxsX2VsZW1lbnRfYXR0cmlidXRlczogdHJ1ZSxcbiAgICAgICAgICAgICAgICAvLyBUaGlzIG9ubHkgdHJpZ2dlcnMgb24gcGFnZSBsb2FkLCB3aGljaCBmb3Igb3VyIFNQQSBpc24ndCBwYXJ0aWN1bGFybHkgdXNlZnVsLlxuICAgICAgICAgICAgICAgIC8vIFBsdXMsIHRoZSAuY2FwdHVyZSBjYWxsIG9yaWdpbmF0aW5nIGZyb20gc29tZXdoZXJlIGluIHBvc3Rob2cgbWFrZXMgaXQgaGFyZFxuICAgICAgICAgICAgICAgIC8vIHRvIHJlZGFjdCBVUkxzLCB3aGljaCByZXF1aXJlcyBhc3luYyBjb2RlLlxuICAgICAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAgICAgLy8gVG8gcmFpc2UgdGhpcyBtYW51YWxseSwganVzdCBjYWxsIC5jYXB0dXJlKFwiJHBhZ2V2aWV3XCIpIG9yIHBvc3Rob2cuY2FwdHVyZV9wYWdldmlldy5cbiAgICAgICAgICAgICAgICBjYXB0dXJlX3BhZ2V2aWV3OiBmYWxzZSxcbiAgICAgICAgICAgICAgICBzYW5pdGl6ZV9wcm9wZXJ0aWVzOiB0aGlzLnNhbml0aXplUHJvcGVydGllcyxcbiAgICAgICAgICAgICAgICByZXNwZWN0X2RudDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBhZHZhbmNlZF9kaXNhYmxlX2RlY2lkZTogdHJ1ZSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgZGlzLnJlZ2lzdGVyKHRoaXMub25BY3Rpb24pO1xuICAgICAgICBTZXR0aW5nc1N0b3JlLm1vbml0b3JTZXR0aW5nKFwibGF5b3V0XCIsIG51bGwpO1xuICAgICAgICBTZXR0aW5nc1N0b3JlLm1vbml0b3JTZXR0aW5nKFwidXNlQ29tcGFjdExheW91dFwiLCBudWxsKTtcbiAgICAgICAgdGhpcy5vbkxheW91dFVwZGF0ZWQoKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIG9uTGF5b3V0VXBkYXRlZCA9ICgpOiB2b2lkID0+IHtcbiAgICAgICAgbGV0IGxheW91dDogVXNlclByb3BlcnRpZXNbXCJXZWJMYXlvdXRcIl07XG5cbiAgICAgICAgc3dpdGNoIChTZXR0aW5nc1N0b3JlLmdldFZhbHVlKFwibGF5b3V0XCIpKSB7XG4gICAgICAgICAgICBjYXNlIExheW91dC5JUkM6XG4gICAgICAgICAgICAgICAgbGF5b3V0ID0gXCJJUkNcIjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgTGF5b3V0LkJ1YmJsZTpcbiAgICAgICAgICAgICAgICBsYXlvdXQgPSBcIkJ1YmJsZVwiO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBMYXlvdXQuR3JvdXA6XG4gICAgICAgICAgICAgICAgbGF5b3V0ID0gU2V0dGluZ3NTdG9yZS5nZXRWYWx1ZShcInVzZUNvbXBhY3RMYXlvdXRcIikgPyBcIkNvbXBhY3RcIiA6IFwiR3JvdXBcIjtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRoaXMgaXMga25vd24gdG8gY2xvYmJlciBvdGhlciBkZXZpY2VzIGJ1dCBpcyBhIGdvb2QgZW5vdWdoIHNvbHV0aW9uXG4gICAgICAgIC8vIHRvIGdldCBhbiBpZGVhIG9mIGhvdyBtdWNoIHVzZSBlYWNoIGxheW91dCBnZXRzLlxuICAgICAgICB0aGlzLnNldFByb3BlcnR5KFwiV2ViTGF5b3V0XCIsIGxheW91dCk7XG4gICAgfTtcblxuICAgIHByaXZhdGUgb25BY3Rpb24gPSAocGF5bG9hZDogQWN0aW9uUGF5bG9hZCk6IHZvaWQgPT4ge1xuICAgICAgICBpZiAocGF5bG9hZC5hY3Rpb24gIT09IEFjdGlvbi5TZXR0aW5nVXBkYXRlZCkgcmV0dXJuO1xuICAgICAgICBjb25zdCBzZXR0aW5nc1BheWxvYWQgPSBwYXlsb2FkIGFzIFNldHRpbmdVcGRhdGVkUGF5bG9hZDtcbiAgICAgICAgaWYgKFtcImxheW91dFwiLCBcInVzZUNvbXBhY3RMYXlvdXRcIl0uaW5jbHVkZXMoc2V0dGluZ3NQYXlsb2FkLnNldHRpbmdOYW1lKSkge1xuICAgICAgICAgICAgdGhpcy5vbkxheW91dFVwZGF0ZWQoKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvLyB3ZSBwZXJzaXN0IHRoZSBsYXN0IGAkc2NyZWVuX25hbWVgIGFuZCBzZW5kIGl0IGZvciBhbGwgZXZlbnRzIHVudGlsIGl0IGlzIHJlcGxhY2VkXG4gICAgcHJpdmF0ZSBsYXN0U2NyZWVuOiBTY3JlZW5OYW1lID0gXCJMb2FkaW5nXCI7XG5cbiAgICBwcml2YXRlIHNhbml0aXplUHJvcGVydGllcyA9IChwcm9wZXJ0aWVzOiBQcm9wZXJ0aWVzLCBldmVudE5hbWU6IHN0cmluZyk6IFByb3BlcnRpZXMgPT4ge1xuICAgICAgICAvLyBDYWxsYmFjayBmcm9tIHBvc3Rob2cgdG8gc2FuaXRpemUgcHJvcGVydGllcyBiZWZvcmUgc2VuZGluZyB0aGVtIHRvIHRoZSBzZXJ2ZXIuXG4gICAgICAgIC8vXG4gICAgICAgIC8vIEhlcmUgd2Ugc2FuaXRpemUgcG9zdGhvZydzIGJ1aWx0IGluIHByb3BlcnRpZXMgd2hpY2ggbGVhayBQSUkgZS5nLiB1cmwgcmVwb3J0aW5nLlxuICAgICAgICAvLyBTZWUgdXRpbHMuanMgXy5pbmZvLnByb3BlcnRpZXMgaW4gcG9zdGhvZy1qcy5cblxuICAgICAgICBpZiAoZXZlbnROYW1lID09PSBcIiRwYWdldmlld1wiKSB7XG4gICAgICAgICAgICB0aGlzLmxhc3RTY3JlZW4gPSBwcm9wZXJ0aWVzW1wiJGN1cnJlbnRfdXJsXCJdO1xuICAgICAgICB9XG4gICAgICAgIC8vIFdlIGluamVjdCBhIHNjcmVlbiBpZGVudGlmaWVyIGluICRjdXJyZW50X3VybCBhcyBwZXIgaHR0cHM6Ly9wb3N0aG9nLmNvbS90dXRvcmlhbHMvc3BhXG4gICAgICAgIHByb3BlcnRpZXNbXCIkY3VycmVudF91cmxcIl0gPSB0aGlzLmxhc3RTY3JlZW47XG5cbiAgICAgICAgaWYgKHRoaXMuYW5vbnltaXR5ID09IEFub255bWl0eS5Bbm9ueW1vdXMpIHtcbiAgICAgICAgICAgIC8vIGRyb3AgcmVmZXJyZXIgaW5mb3JtYXRpb24gZm9yIGFub255bW91cyB1c2Vyc1xuICAgICAgICAgICAgcHJvcGVydGllc1tcIiRyZWZlcnJlclwiXSA9IG51bGw7XG4gICAgICAgICAgICBwcm9wZXJ0aWVzW1wiJHJlZmVycmluZ19kb21haW5cIl0gPSBudWxsO1xuICAgICAgICAgICAgcHJvcGVydGllc1tcIiRpbml0aWFsX3JlZmVycmVyXCJdID0gbnVsbDtcbiAgICAgICAgICAgIHByb3BlcnRpZXNbXCIkaW5pdGlhbF9yZWZlcnJpbmdfZG9tYWluXCJdID0gbnVsbDtcblxuICAgICAgICAgICAgLy8gZHJvcCBkZXZpY2UgSUQsIHdoaWNoIGlzIGEgVVVJRCBwZXJzaXN0ZWQgaW4gbG9jYWwgc3RvcmFnZVxuICAgICAgICAgICAgcHJvcGVydGllc1tcIiRkZXZpY2VfaWRcIl0gPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHByb3BlcnRpZXM7XG4gICAgfTtcblxuICAgIHByaXZhdGUgcmVnaXN0ZXJTdXBlclByb3BlcnRpZXMocHJvcGVydGllczogUHJvcGVydGllcyk6IHZvaWQge1xuICAgICAgICBpZiAodGhpcy5lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLnBvc3Rob2cucmVnaXN0ZXIocHJvcGVydGllcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHN0YXRpYyBhc3luYyBnZXRQbGF0Zm9ybVByb3BlcnRpZXMoKTogUHJvbWlzZTxQYXJ0aWFsPFBsYXRmb3JtUHJvcGVydGllcz4+IHtcbiAgICAgICAgY29uc3QgcGxhdGZvcm0gPSBQbGF0Zm9ybVBlZy5nZXQoKTtcbiAgICAgICAgbGV0IGFwcFZlcnNpb246IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGFwcFZlcnNpb24gPSBhd2FpdCBwbGF0Zm9ybT8uZ2V0QXBwVmVyc2lvbigpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAvLyB0aGlzIGhhcHBlbnMgaWYgbm8gdmVyc2lvbiBpcyBzZXQgaS5lLiBpbiBkZXZcbiAgICAgICAgICAgIGFwcFZlcnNpb24gPSBcInVua25vd25cIjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBhcHBWZXJzaW9uLFxuICAgICAgICAgICAgYXBwUGxhdGZvcm06IHBsYXRmb3JtPy5nZXRIdW1hblJlYWRhYmxlTmFtZSgpLFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHRsaW5lIG5vLXVudXNlZC12YXJzXG4gICAgcHJpdmF0ZSBjYXB0dXJlKGV2ZW50TmFtZTogc3RyaW5nLCBwcm9wZXJ0aWVzOiBQcm9wZXJ0aWVzLCBvcHRpb25zPzogSVBvc3RIb2dFdmVudE9wdGlvbnMpOiB2b2lkIHtcbiAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB7IG9yaWdpbiwgaGFzaCwgcGF0aG5hbWUgfSA9IHdpbmRvdy5sb2NhdGlvbjtcbiAgICAgICAgcHJvcGVydGllc1tcInJlZGFjdGVkQ3VycmVudFVybFwiXSA9IGdldFJlZGFjdGVkQ3VycmVudExvY2F0aW9uKG9yaWdpbiwgaGFzaCwgcGF0aG5hbWUpO1xuICAgICAgICB0aGlzLnBvc3Rob2cuY2FwdHVyZShcbiAgICAgICAgICAgIGV2ZW50TmFtZSxcbiAgICAgICAgICAgIHsgLi4udGhpcy5wcm9wZXJ0aWVzRm9yTmV4dEV2ZW50LCAuLi5wcm9wZXJ0aWVzIH0sXG4gICAgICAgICAgICAvLyBUT0RPOiBVbmNvbW1lbnQgYmVsb3cgb25jZSBodHRwczovL2dpdGh1Yi5jb20vUG9zdEhvZy9wb3N0aG9nLWpzL3B1bGwvMzkxXG4gICAgICAgICAgICAvLyBnZXRzIG1lcmdlZFxuICAgICAgICAgICAgLyogb3B0aW9ucyBhcyBhbnksICovIC8vIE5vIHByb3BlciB0eXBlIGRlZmluaXRpb24gaW4gdGhlIHBvc3Rob2cgbGlicmFyeVxuICAgICAgICApO1xuICAgICAgICB0aGlzLnByb3BlcnRpZXNGb3JOZXh0RXZlbnQgPSB7fTtcbiAgICB9XG5cbiAgICBwdWJsaWMgaXNFbmFibGVkKCk6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gdGhpcy5lbmFibGVkO1xuICAgIH1cblxuICAgIHB1YmxpYyBzZXRBbm9ueW1pdHkoYW5vbnltaXR5OiBBbm9ueW1pdHkpOiB2b2lkIHtcbiAgICAgICAgLy8gVXBkYXRlIHRoaXMuYW5vbnltaXR5LlxuICAgICAgICAvLyBUaGlzIGlzIHB1YmxpYyBmb3IgdGVzdGluZyBwdXJwb3NlcywgdHlwaWNhbGx5IHlvdSB3YW50IHRvIGNhbGwgdXBkYXRlQW5vbnltaXR5RnJvbVNldHRpbmdzXG4gICAgICAgIC8vIHRvIGVuc3VyZSB0aGlzIHZhbHVlIGlzIGluIHN0ZXAgd2l0aCB0aGUgdXNlcidzIHNldHRpbmdzLlxuICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIChhbm9ueW1pdHkgPT0gQW5vbnltaXR5LkRpc2FibGVkIHx8IGFub255bWl0eSA9PSBBbm9ueW1pdHkuQW5vbnltb3VzKSkge1xuICAgICAgICAgICAgLy8gd2hlbiB0cmFuc2l0aW9uaW5nIHRvIERpc2FibGVkIG9yIEFub255bW91cyBlbnN1cmUgd2UgY2xlYXIgb3V0IGFueSBwcmlvciBzdGF0ZVxuICAgICAgICAgICAgLy8gc2V0IGluIHBvc3Rob2cgZS5nLiBkaXN0aW5jdCBJRFxuICAgICAgICAgICAgdGhpcy5wb3N0aG9nLnJlc2V0KCk7XG4gICAgICAgICAgICAvLyBSZXN0b3JlIGFueSBwcmV2aW91c2x5IHNldCBwbGF0Zm9ybSBzdXBlciBwcm9wZXJ0aWVzXG4gICAgICAgICAgICB0aGlzLnJlZ2lzdGVyU3VwZXJQcm9wZXJ0aWVzKHRoaXMucGxhdGZvcm1TdXBlclByb3BlcnRpZXMpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuYW5vbnltaXR5ID0gYW5vbnltaXR5O1xuICAgIH1cblxuICAgIHByaXZhdGUgc3RhdGljIGdldFJhbmRvbUFuYWx5dGljc0lkKCk6IHN0cmluZyB7XG4gICAgICAgIHJldHVybiBbLi4uY3J5cHRvLmdldFJhbmRvbVZhbHVlcyhuZXcgVWludDhBcnJheSgxNikpXS5tYXAoKGMpID0+IGMudG9TdHJpbmcoMTYpKS5qb2luKFwiXCIpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBpZGVudGlmeVVzZXIoY2xpZW50OiBNYXRyaXhDbGllbnQsIGFuYWx5dGljc0lkR2VuZXJhdG9yOiAoKSA9PiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgaWYgKHRoaXMuYW5vbnltaXR5ID09IEFub255bWl0eS5Qc2V1ZG9ueW1vdXMpIHtcbiAgICAgICAgICAgIC8vIENoZWNrIHRoZSB1c2VyJ3MgYWNjb3VudF9kYXRhIGZvciBhbiBhbmFseXRpY3MgSUQgdG8gdXNlLiBTdG9yaW5nIHRoZSBJRCBpbiBhY2NvdW50X2RhdGEgYWxsb3dzXG4gICAgICAgICAgICAvLyBkaWZmZXJlbnQgZGV2aWNlcyB0byBzZW5kIHRoZSBzYW1lIElELlxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBhY2NvdW50RGF0YSA9IGF3YWl0IGNsaWVudC5nZXRBY2NvdW50RGF0YUZyb21TZXJ2ZXIoUG9zdGhvZ0FuYWx5dGljcy5BTkFMWVRJQ1NfRVZFTlRfVFlQRSk7XG4gICAgICAgICAgICAgICAgbGV0IGFuYWx5dGljc0lEID0gYWNjb3VudERhdGE/LmlkO1xuICAgICAgICAgICAgICAgIGlmICghYW5hbHl0aWNzSUQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQ291bGRuJ3QgcmV0cmlldmUgYW4gYW5hbHl0aWNzIElEIGZyb20gdXNlciBzZXR0aW5ncywgc28gY3JlYXRlIG9uZSBhbmQgc2V0IGl0IG9uIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAgICAgICAgICAgIC8vIE5vdGUgdGhlcmUncyBhIHJhY2UgY29uZGl0aW9uIGhlcmUgLSBpZiB0d28gZGV2aWNlcyBkbyB0aGVzZSBzdGVwcyBhdCB0aGUgc2FtZSB0aW1lLCBsYXN0IHdyaXRlXG4gICAgICAgICAgICAgICAgICAgIC8vIHdpbnMsIGFuZCB0aGUgZmlyc3Qgd3JpdGVyIHdpbGwgc2VuZCB0cmFja2luZyB3aXRoIGFuIElEIHRoYXQgZG9lc24ndCBtYXRjaCB0aGUgb25lIG9uIHRoZSBzZXJ2ZXJcbiAgICAgICAgICAgICAgICAgICAgLy8gdW50aWwgdGhlIG5leHQgdGltZSBhY2NvdW50IGRhdGEgaXMgcmVmcmVzaGVkIGFuZCB0aGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCAobW9zdCBsaWtlbHkgb24gbmV4dFxuICAgICAgICAgICAgICAgICAgICAvLyBwYWdlIGxvYWQpLiBUaGlzIHdpbGwgaGFwcGVuIHByZXR0eSBpbmZyZXF1ZW50bHksIHNvIHdlIGNhbiB0b2xlcmF0ZSB0aGUgcG9zc2liaWxpdHkuXG4gICAgICAgICAgICAgICAgICAgIGFuYWx5dGljc0lEID0gYW5hbHl0aWNzSWRHZW5lcmF0b3IoKTtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgY2xpZW50LnNldEFjY291bnREYXRhKFxuICAgICAgICAgICAgICAgICAgICAgICAgUG9zdGhvZ0FuYWx5dGljcy5BTkFMWVRJQ1NfRVZFTlRfVFlQRSxcbiAgICAgICAgICAgICAgICAgICAgICAgIE9iamVjdC5hc3NpZ24oeyBpZDogYW5hbHl0aWNzSUQgfSwgYWNjb3VudERhdGEpLFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5wb3N0aG9nLmdldF9kaXN0aW5jdF9pZCgpID09PSBhbmFseXRpY3NJRCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBObyBwb2ludCBpZGVudGlmeWluZyBhZ2FpblxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnBvc3Rob2cucGVyc2lzdGVuY2UuZ2V0X3VzZXJfc3RhdGUoKSA9PT0gXCJpZGVudGlmaWVkXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQW5hbHl0aWNzIElEIGhhcyBjaGFuZ2VkLCByZXNldCBhcyBQb3N0aG9nIHdpbGwgcmVmdXNlIHRvIG1lcmdlIGluIHRoaXMgY2FzZVxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBvc3Rob2cucmVzZXQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5wb3N0aG9nLmlkZW50aWZ5KGFuYWx5dGljc0lEKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAvLyBUaGUgYWJvdmUgY291bGQgZmFpbCBkdWUgdG8gbmV0d29yayByZXF1ZXN0cywgYnV0IG5vdCBlc3NlbnRpYWwgdG8gc3RhcnRpbmcgdGhlIGFwcGxpY2F0aW9uLFxuICAgICAgICAgICAgICAgIC8vIHNvIHN3YWxsb3cgaXQuXG4gICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhcIlVuYWJsZSB0byBpZGVudGlmeSB1c2VyIGZvciB0cmFja2luZ1wiICsgZS50b1N0cmluZygpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBnZXRBbm9ueW1pdHkoKTogQW5vbnltaXR5IHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYW5vbnltaXR5O1xuICAgIH1cblxuICAgIHB1YmxpYyBsb2dvdXQoKTogdm9pZCB7XG4gICAgICAgIGlmICh0aGlzLmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMucG9zdGhvZy5yZXNldCgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc2V0QW5vbnltaXR5KEFub255bWl0eS5EaXNhYmxlZCk7XG4gICAgfVxuXG4gICAgcHVibGljIHRyYWNrRXZlbnQ8RSBleHRlbmRzIElQb3N0aG9nRXZlbnQ+KHsgZXZlbnROYW1lLCAuLi5wcm9wZXJ0aWVzIH06IEUsIG9wdGlvbnM/OiBJUG9zdEhvZ0V2ZW50T3B0aW9ucyk6IHZvaWQge1xuICAgICAgICBpZiAodGhpcy5hbm9ueW1pdHkgPT0gQW5vbnltaXR5LkRpc2FibGVkIHx8IHRoaXMuYW5vbnltaXR5ID09IEFub255bWl0eS5Bbm9ueW1vdXMpIHJldHVybjtcbiAgICAgICAgdGhpcy5jYXB0dXJlKGV2ZW50TmFtZSwgcHJvcGVydGllcywgb3B0aW9ucyk7XG4gICAgfVxuXG4gICAgcHVibGljIHNldFByb3BlcnR5PEsgZXh0ZW5kcyBrZXlvZiBVc2VyUHJvcGVydGllcz4oa2V5OiBLLCB2YWx1ZTogVXNlclByb3BlcnRpZXNbS10pOiB2b2lkIHtcbiAgICAgICAgaWYgKHRoaXMudXNlclByb3BlcnR5Q2FjaGVba2V5XSA9PT0gdmFsdWUpIHJldHVybjsgLy8gbm90aGluZyB0byBkb1xuICAgICAgICB0aGlzLnVzZXJQcm9wZXJ0eUNhY2hlW2tleV0gPSB2YWx1ZTtcblxuICAgICAgICBpZiAoIXRoaXMucHJvcGVydGllc0Zvck5leHRFdmVudFtcIiRzZXRcIl0pIHtcbiAgICAgICAgICAgIHRoaXMucHJvcGVydGllc0Zvck5leHRFdmVudFtcIiRzZXRcIl0gPSB7fTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnByb3BlcnRpZXNGb3JOZXh0RXZlbnRbXCIkc2V0XCJdW2tleV0gPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc2V0UHJvcGVydHlPbmNlPEsgZXh0ZW5kcyBrZXlvZiBVc2VyUHJvcGVydGllcz4oa2V5OiBLLCB2YWx1ZTogVXNlclByb3BlcnRpZXNbS10pOiB2b2lkIHtcbiAgICAgICAgaWYgKHRoaXMudXNlclByb3BlcnR5Q2FjaGVba2V5XSkgcmV0dXJuOyAvLyBub3RoaW5nIHRvIGRvXG4gICAgICAgIHRoaXMudXNlclByb3BlcnR5Q2FjaGVba2V5XSA9IHZhbHVlO1xuXG4gICAgICAgIGlmICghdGhpcy5wcm9wZXJ0aWVzRm9yTmV4dEV2ZW50W1wiJHNldF9vbmNlXCJdKSB7XG4gICAgICAgICAgICB0aGlzLnByb3BlcnRpZXNGb3JOZXh0RXZlbnRbXCIkc2V0X29uY2VcIl0gPSB7fTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnByb3BlcnRpZXNGb3JOZXh0RXZlbnRbXCIkc2V0X29uY2VcIl1ba2V5XSA9IHZhbHVlO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyB1cGRhdGVQbGF0Zm9ybVN1cGVyUHJvcGVydGllcygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgLy8gVXBkYXRlIHN1cGVyIHByb3BlcnRpZXMgaW4gcG9zdGhvZyB3aXRoIG91ciBwbGF0Zm9ybSAoYXBwIHZlcnNpb24sIHBsYXRmb3JtKS5cbiAgICAgICAgLy8gVGhlc2UgcHJvcGVydGllcyB3aWxsIGJlIHN1YnNlcXVlbnRseSBwYXNzZWQgaW4gZXZlcnkgZXZlbnQuXG4gICAgICAgIC8vXG4gICAgICAgIC8vIFRoaXMgb25seSBuZWVkcyB0byBiZSBkb25lIG9uY2UgcGVyIHBhZ2UgbGlmZXRpbWUuIE5vdGUgdGhhdCBnZXRQbGF0Zm9ybVByb3BlcnRpZXNcbiAgICAgICAgLy8gaXMgYXN5bmMgYW5kIGNhbiBpbnZvbHZlIGEgbmV0d29yayByZXF1ZXN0IGlmIHdlIGFyZSBydW5uaW5nIGluIGEgYnJvd3Nlci5cbiAgICAgICAgdGhpcy5wbGF0Zm9ybVN1cGVyUHJvcGVydGllcyA9IGF3YWl0IFBvc3Rob2dBbmFseXRpY3MuZ2V0UGxhdGZvcm1Qcm9wZXJ0aWVzKCk7XG4gICAgICAgIHRoaXMucmVnaXN0ZXJTdXBlclByb3BlcnRpZXModGhpcy5wbGF0Zm9ybVN1cGVyUHJvcGVydGllcyk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHVwZGF0ZUFub255bWl0eUZyb21TZXR0aW5ncyhjbGllbnQ6IE1hdHJpeENsaWVudCwgcHNldWRvbnltb3VzT3B0SW46IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgLy8gVXBkYXRlIHRoaXMuYW5vbnltaXR5IGJhc2VkIG9uIHRoZSB1c2VyJ3MgYW5hbHl0aWNzIG9wdC1pbiBzZXR0aW5nc1xuICAgICAgICBjb25zdCBhbm9ueW1pdHkgPSBwc2V1ZG9ueW1vdXNPcHRJbiA/IEFub255bWl0eS5Qc2V1ZG9ueW1vdXMgOiBBbm9ueW1pdHkuRGlzYWJsZWQ7XG4gICAgICAgIHRoaXMuc2V0QW5vbnltaXR5KGFub255bWl0eSk7XG4gICAgICAgIGlmIChhbm9ueW1pdHkgPT09IEFub255bWl0eS5Qc2V1ZG9ueW1vdXMpIHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuaWRlbnRpZnlVc2VyKGNsaWVudCwgUG9zdGhvZ0FuYWx5dGljcy5nZXRSYW5kb21BbmFseXRpY3NJZCk7XG4gICAgICAgICAgICBpZiAoTWF0cml4Q2xpZW50UGVnLmN1cnJlbnRVc2VySXNKdXN0UmVnaXN0ZXJlZCgpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50cmFja05ld1VzZXJFdmVudCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGFub255bWl0eSAhPT0gQW5vbnltaXR5LkRpc2FibGVkKSB7XG4gICAgICAgICAgICBhd2FpdCBQb3N0aG9nQW5hbHl0aWNzLmluc3RhbmNlLnVwZGF0ZVBsYXRmb3JtU3VwZXJQcm9wZXJ0aWVzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgc3RhcnRMaXN0ZW5pbmdUb1NldHRpbmdzQ2hhbmdlcyhjbGllbnQ6IE1hdHJpeENsaWVudCk6IHZvaWQge1xuICAgICAgICAvLyBMaXN0ZW4gdG8gYWNjb3VudCBkYXRhIGNoYW5nZXMgZnJvbSBzeW5jIHNvIHdlIGNhbiBvYnNlcnZlIGNoYW5nZXMgdG8gcmVsZXZhbnQgZmxhZ3MgYW5kIHVwZGF0ZS5cbiAgICAgICAgLy8gVGhpcyBpcyBjYWxsZWQgLVxuICAgICAgICAvLyAgKiBPbiBwYWdlIGxvYWQsIHdoZW4gdGhlIGFjY291bnQgZGF0YSBpcyBmaXJzdCByZWNlaXZlZCBieSBzeW5jXG4gICAgICAgIC8vICAqIE9uIGxvZ2luXG4gICAgICAgIC8vICAqIFdoZW4gYW5vdGhlciBkZXZpY2UgY2hhbmdlcyBhY2NvdW50IGRhdGFcbiAgICAgICAgLy8gICogV2hlbiB0aGUgdXNlciBjaGFuZ2VzIHRoZWlyIHByZWZlcmVuY2VzIG9uIHRoaXMgZGV2aWNlXG4gICAgICAgIC8vIE5vdGUgdGhhdCBmb3IgbmV3IGFjY291bnRzLCBwc2V1ZG9ueW1vdXNBbmFseXRpY3NPcHRJbiB3b24ndCBiZSBzZXQsIHNvIHVwZGF0ZUFub255bWl0eUZyb21TZXR0aW5nc1xuICAgICAgICAvLyB3b24ndCBiZSBjYWxsZWQgKGkuZS4gdGhpcy5hbm9ueW1pdHkgd2lsbCBiZSBsZWZ0IGFzIHRoZSBkZWZhdWx0LCB1bnRpbCB0aGUgc2V0dGluZyBjaGFuZ2VzKVxuICAgICAgICBTZXR0aW5nc1N0b3JlLndhdGNoU2V0dGluZyhcbiAgICAgICAgICAgIFwicHNldWRvbnltb3VzQW5hbHl0aWNzT3B0SW5cIixcbiAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICAob3JpZ2luYWxTZXR0aW5nTmFtZSwgY2hhbmdlZEluUm9vbUlkLCBhdExldmVsLCBuZXdWYWx1ZUF0TGV2ZWwsIG5ld1ZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVBbm9ueW1pdHlGcm9tU2V0dGluZ3MoY2xpZW50LCAhIW5ld1ZhbHVlKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgcHVibGljIHNldEF1dGhlbnRpY2F0aW9uVHlwZShhdXRoZW50aWNhdGlvblR5cGU6IFNpZ251cFtcImF1dGhlbnRpY2F0aW9uVHlwZVwiXSk6IHZvaWQge1xuICAgICAgICB0aGlzLmF1dGhlbnRpY2F0aW9uVHlwZSA9IGF1dGhlbnRpY2F0aW9uVHlwZTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHRyYWNrTmV3VXNlckV2ZW50KCk6IHZvaWQge1xuICAgICAgICAvLyBUaGlzIGlzIHRoZSBvbmx5IGV2ZW50IHRoYXQgY291bGQgaGF2ZSBvY2N1cmVkIGJlZm9yZSBhbmFseXRpY3Mgb3B0LWluXG4gICAgICAgIC8vIHRoYXQgd2Ugd2FudCB0byBhY2N1bXVsYXRlIGJlZm9yZSB0aGUgdXNlciBoYXMgZ2l2ZW4gY29uc2VudFxuICAgICAgICAvLyBBbGwgb3RoZXIgc2NlbmFyaW9zIHNob3VsZCBub3QgdHJhY2sgYSB1c2VyIGJlZm9yZSB0aGV5IGhhdmUgZ2l2ZW5cbiAgICAgICAgLy8gZXhwbGljaXQgY29uc2VudCB0aGF0IHRoZXkgYXJlIG9rIHdpdGggdGhlaXIgYW5hbHl0aWNzIGRhdGEgYmVpbmcgY29sbGVjdGVkXG4gICAgICAgIGNvbnN0IG9wdGlvbnM6IElQb3N0SG9nRXZlbnRPcHRpb25zID0ge307XG4gICAgICAgIGNvbnN0IHJlZ2lzdHJhdGlvblRpbWUgPSBwYXJzZUludCh3aW5kb3cubG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJteF9yZWdpc3RyYXRpb25fdGltZVwiKSEsIDEwKTtcbiAgICAgICAgaWYgKCFpc05hTihyZWdpc3RyYXRpb25UaW1lKSkge1xuICAgICAgICAgICAgb3B0aW9ucy50aW1lc3RhbXAgPSBuZXcgRGF0ZShyZWdpc3RyYXRpb25UaW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLnRyYWNrRXZlbnQ8U2lnbnVwPihcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBldmVudE5hbWU6IFwiU2lnbnVwXCIsXG4gICAgICAgICAgICAgICAgYXV0aGVudGljYXRpb25UeXBlOiB0aGlzLmF1dGhlbnRpY2F0aW9uVHlwZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBvcHRpb25zLFxuICAgICAgICApO1xuICAgIH1cbn1cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQWdCQSxJQUFBQSxVQUFBLEdBQUFDLHNCQUFBLENBQUFDLE9BQUE7QUFFQSxJQUFBQyxPQUFBLEdBQUFELE9BQUE7QUFJQSxJQUFBRSxZQUFBLEdBQUFILHNCQUFBLENBQUFDLE9BQUE7QUFDQSxJQUFBRyxVQUFBLEdBQUFKLHNCQUFBLENBQUFDLE9BQUE7QUFDQSxJQUFBSSxnQkFBQSxHQUFBSixPQUFBO0FBQ0EsSUFBQUssY0FBQSxHQUFBTixzQkFBQSxDQUFBQyxPQUFBO0FBR0EsSUFBQU0sUUFBQSxHQUFBTixPQUFBO0FBRUEsSUFBQU8sV0FBQSxHQUFBUixzQkFBQSxDQUFBQyxPQUFBO0FBQ0EsSUFBQVEsT0FBQSxHQUFBUixPQUFBO0FBQWlELE1BQUFTLFNBQUE7QUFBQSxTQUFBQyxRQUFBQyxNQUFBLEVBQUFDLGNBQUEsUUFBQUMsSUFBQSxHQUFBQyxNQUFBLENBQUFELElBQUEsQ0FBQUYsTUFBQSxPQUFBRyxNQUFBLENBQUFDLHFCQUFBLFFBQUFDLE9BQUEsR0FBQUYsTUFBQSxDQUFBQyxxQkFBQSxDQUFBSixNQUFBLEdBQUFD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