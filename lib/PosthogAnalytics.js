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
//# sourceMappingURL=PosthogAnalytics.js.map