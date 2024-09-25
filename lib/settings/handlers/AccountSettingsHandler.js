"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _client = require("matrix-js-sdk/src/client");
var _utils = require("matrix-js-sdk/src/utils");
var _MatrixClientBackedSettingsHandler = _interopRequireDefault(require("./MatrixClientBackedSettingsHandler"));
var _objects = require("../../utils/objects");
var _SettingLevel = require("../SettingLevel");
/*
Copyright 2017 Travis Ralston
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

const BREADCRUMBS_LEGACY_EVENT_TYPE = "im.vector.riot.breadcrumb_rooms";
const BREADCRUMBS_EVENT_TYPE = "im.vector.setting.breadcrumbs";
const BREADCRUMBS_EVENT_TYPES = [BREADCRUMBS_LEGACY_EVENT_TYPE, BREADCRUMBS_EVENT_TYPE];
const RECENT_EMOJI_EVENT_TYPE = "io.element.recent_emoji";
const INTEG_PROVISIONING_EVENT_TYPE = "im.vector.setting.integration_provisioning";
const ANALYTICS_EVENT_TYPE = "im.vector.analytics";
const DEFAULT_SETTINGS_EVENT_TYPE = "im.vector.web.settings";

/**
 * Gets and sets settings at the "account" level for the current user.
 * This handler does not make use of the roomId parameter.
 */
class AccountSettingsHandler extends _MatrixClientBackedSettingsHandler.default {
  constructor(watchers) {
    super();
    this.watchers = watchers;
    (0, _defineProperty2.default)(this, "onAccountData", (event, prevEvent) => {
      if (event.getType() === "org.matrix.preview_urls") {
        let val = event.getContent()["disable"];
        if (typeof val !== "boolean") {
          val = null;
        } else {
          val = !val;
        }
        this.watchers.notifyUpdate("urlPreviewsEnabled", null, _SettingLevel.SettingLevel.ACCOUNT, val);
      } else if (event.getType() === DEFAULT_SETTINGS_EVENT_TYPE || event.getType() === ANALYTICS_EVENT_TYPE) {
        // Figure out what changed and fire those updates
        const prevContent = prevEvent?.getContent() ?? {};
        const changedSettings = (0, _objects.objectKeyChanges)(prevContent, event.getContent());
        for (const settingName of changedSettings) {
          const val = event.getContent()[settingName];
          this.watchers.notifyUpdate(settingName, null, _SettingLevel.SettingLevel.ACCOUNT, val);
        }
      } else if (BREADCRUMBS_EVENT_TYPES.includes(event.getType())) {
        this.notifyBreadcrumbsUpdate(event);
      } else if (event.getType() === INTEG_PROVISIONING_EVENT_TYPE) {
        const val = event.getContent()["enabled"];
        this.watchers.notifyUpdate("integrationProvisioning", null, _SettingLevel.SettingLevel.ACCOUNT, val);
      } else if (event.getType() === RECENT_EMOJI_EVENT_TYPE) {
        const val = event.getContent()["enabled"];
        this.watchers.notifyUpdate("recent_emoji", null, _SettingLevel.SettingLevel.ACCOUNT, val);
      }
    });
  }
  get level() {
    return _SettingLevel.SettingLevel.ACCOUNT;
  }
  initMatrixClient(oldClient, newClient) {
    oldClient?.removeListener(_client.ClientEvent.AccountData, this.onAccountData);
    newClient.on(_client.ClientEvent.AccountData, this.onAccountData);
  }
  getValue(settingName, roomId) {
    // Special case URL previews
    if (settingName === "urlPreviewsEnabled") {
      const content = this.getSettings("org.matrix.preview_urls") || {};

      // Check to make sure that we actually got a boolean
      if (typeof content["disable"] !== "boolean") return null;
      return !content["disable"];
    }

    // Special case for breadcrumbs
    if (settingName === "breadcrumb_rooms") {
      let content = this.getSettings(BREADCRUMBS_EVENT_TYPE);
      if (!content || !content["recent_rooms"]) {
        content = this.getSettings(BREADCRUMBS_LEGACY_EVENT_TYPE);

        // This is a bit of a hack, but it makes things slightly easier
        if (content) content["recent_rooms"] = content["rooms"];
      }
      return content && content["recent_rooms"] ? content["recent_rooms"] : [];
    }

    // Special case recent emoji
    if (settingName === "recent_emoji") {
      const content = this.getSettings(RECENT_EMOJI_EVENT_TYPE);
      return content ? content["recent_emoji"] : null;
    }

    // Special case integration manager provisioning
    if (settingName === "integrationProvisioning") {
      const content = this.getSettings(INTEG_PROVISIONING_EVENT_TYPE);
      return content ? content["enabled"] : null;
    }
    if (settingName === "pseudonymousAnalyticsOptIn") {
      const content = this.getSettings(ANALYTICS_EVENT_TYPE) || {};
      // Check to make sure that we actually got a boolean
      if (typeof content[settingName] !== "boolean") return null;
      return content[settingName];
    }
    if (settingName === "MessageComposerInput.insertTrailingColon") {
      const content = this.getSettings() || {};
      const value = content[settingName];
      if (value === null || value === undefined) {
        // Write true as it is the default. This will give us the option
        // of making this opt-in in the future, without affecting old
        // users
        this.setValue(settingName, roomId, true);
        return true;
      }
      return value;
    }
    const settings = this.getSettings() || {};
    let preferredValue = settings[settingName];
    if (preferredValue === null || preferredValue === undefined) {
      // Honour the old setting on read only
      if (settingName === "hideAvatarChanges" || settingName === "hideDisplaynameChanges") {
        preferredValue = settings["hideAvatarDisplaynameChanges"];
      }
    }
    return preferredValue;
  }

  // helper function to set account data then await it being echoed back
  async setAccountData(eventType, field, value, legacyEventType) {
    let content = this.getSettings(eventType);
    if (legacyEventType && !content?.[field]) {
      content = this.getSettings(legacyEventType);
    }
    if (!content) {
      content = {};
    }
    content[field] = value;

    // Attach a deferred *before* setting the account data to ensure we catch any requests
    // which race between different lines.
    const deferred = (0, _utils.defer)();
    const handler = event => {
      if (event.getType() !== eventType || event.getContent()[field] !== value) return;
      this.client.off(_client.ClientEvent.AccountData, handler);
      deferred.resolve();
    };
    this.client.on(_client.ClientEvent.AccountData, handler);
    await this.client.setAccountData(eventType, content);
    await deferred.promise;
  }
  setValue(settingName, roomId, newValue) {
    switch (settingName) {
      // Special case URL previews
      case "urlPreviewsEnabled":
        return this.setAccountData("org.matrix.preview_urls", "disable", !newValue);

      // Special case for breadcrumbs
      case "breadcrumb_rooms":
        return this.setAccountData(BREADCRUMBS_EVENT_TYPE, "recent_rooms", newValue, BREADCRUMBS_LEGACY_EVENT_TYPE);

      // Special case recent emoji
      case "recent_emoji":
        return this.setAccountData(RECENT_EMOJI_EVENT_TYPE, "recent_emoji", newValue);

      // Special case integration manager provisioning
      case "integrationProvisioning":
        return this.setAccountData(INTEG_PROVISIONING_EVENT_TYPE, "enabled", newValue);

      // Special case analytics
      case "pseudonymousAnalyticsOptIn":
        return this.setAccountData(ANALYTICS_EVENT_TYPE, "pseudonymousAnalyticsOptIn", newValue);
      default:
        return this.setAccountData(DEFAULT_SETTINGS_EVENT_TYPE, settingName, newValue);
    }
  }
  canSetValue(settingName, roomId) {
    return true; // It's their account, so they should be able to
  }

  isSupported() {
    return this.client && !this.client.isGuest();
  }
  getSettings() {
    let eventType = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "im.vector.web.settings";
    // TODO: [TS] Types on return
    if (!this.client) return null;
    const event = this.client.getAccountData(eventType);
    if (!event || !event.getContent()) return null;
    return (0, _objects.objectClone)(event.getContent()); // clone to prevent mutation
  }

  notifyBreadcrumbsUpdate(event) {
    let val = [];
    if (event.getType() === BREADCRUMBS_LEGACY_EVENT_TYPE) {
      // This seems fishy - try and get the event for the new rooms
      const newType = this.getSettings(BREADCRUMBS_EVENT_TYPE);
      if (newType) val = newType["recent_rooms"];else val = event.getContent()["rooms"];
    } else if (event.getType() === BREADCRUMBS_EVENT_TYPE) {
      val = event.getContent()["recent_rooms"];
    } else {
      return; // for sanity, not because we expect to be here.
    }

    this.watchers.notifyUpdate("breadcrumb_rooms", null, _SettingLevel.SettingLevel.ACCOUNT, val || []);
  }
}
exports.default = AccountSettingsHandler;
//# sourceMappingURL=AccountSettingsHandler.js.map