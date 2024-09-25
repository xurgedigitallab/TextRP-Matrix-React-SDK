"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _serviceTypes = require("matrix-js-sdk/src/service-types");
var _logger = require("matrix-js-sdk/src/logger");
var _SettingsStore = _interopRequireDefault(require("./settings/SettingsStore"));
var _Terms = require("./Terms");
var _MatrixClientPeg = require("./MatrixClientPeg");
var _SdkConfig = _interopRequireDefault(require("./SdkConfig"));
var _UrlUtils = require("./utils/UrlUtils");
/*
Copyright 2016, 2019, 2021 The Matrix.org Foundation C.I.C.

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

// The version of the integration manager API we're intending to work with
const imApiVersion = "1.1";

// TODO: Generify the name of this class and all components within - it's not just for Scalar.

class ScalarAuthClient {
  constructor(apiUrl, uiUrl) {
    this.apiUrl = apiUrl;
    this.uiUrl = uiUrl;
    (0, _defineProperty2.default)(this, "scalarToken", void 0);
    (0, _defineProperty2.default)(this, "termsInteractionCallback", void 0);
    (0, _defineProperty2.default)(this, "isDefaultManager", void 0);
    this.scalarToken = null;
    // `undefined` to allow `startTermsFlow` to fallback to a default
    // callback if this is unset.
    this.termsInteractionCallback = undefined;

    // We try and store the token on a per-manager basis, but need a fallback
    // for the default manager.
    const configApiUrl = _SdkConfig.default.get("integrations_rest_url");
    const configUiUrl = _SdkConfig.default.get("integrations_ui_url");
    this.isDefaultManager = apiUrl === configApiUrl && configUiUrl === uiUrl;
  }
  writeTokenToStore() {
    window.localStorage.setItem("mx_scalar_token_at_" + this.apiUrl, this.scalarToken ?? "");
    if (this.isDefaultManager) {
      // We remove the old token from storage to migrate upwards. This is safe
      // to do because even if the user switches to /app when this is on /develop
      // they'll at worst register for a new token.
      window.localStorage.removeItem("mx_scalar_token"); // no-op when not present
    }
  }

  readTokenFromStore() {
    let token = window.localStorage.getItem("mx_scalar_token_at_" + this.apiUrl);
    if (!token && this.isDefaultManager) {
      token = window.localStorage.getItem("mx_scalar_token");
    }
    return token;
  }
  readToken() {
    if (this.scalarToken) return this.scalarToken;
    return this.readTokenFromStore();
  }
  setTermsInteractionCallback(callback) {
    this.termsInteractionCallback = callback;
  }
  connect() {
    return this.getScalarToken().then(tok => {
      this.scalarToken = tok;
    });
  }
  hasCredentials() {
    return this.scalarToken != null; // undef or null
  }

  // Returns a promise that resolves to a scalar_token string
  getScalarToken() {
    const token = this.readToken();
    if (!token) {
      return this.registerForToken();
    } else {
      return this.checkToken(token).catch(e => {
        if (e instanceof _Terms.TermsNotSignedError) {
          // retrying won't help this
          throw e;
        }
        return this.registerForToken();
      });
    }
  }
  async getAccountName(token) {
    const url = new URL(this.apiUrl + "/account");
    url.searchParams.set("scalar_token", token);
    url.searchParams.set("v", imApiVersion);
    const res = await fetch(url, {
      method: "GET"
    });
    const body = await res.json();
    if (body?.errcode === "M_TERMS_NOT_SIGNED") {
      throw new _Terms.TermsNotSignedError();
    }
    if (!res.ok) {
      throw body;
    }
    if (!body?.user_id) {
      throw new Error("Missing user_id in response");
    }
    return body.user_id;
  }
  checkToken(token) {
    return this.getAccountName(token).then(userId => {
      const me = _MatrixClientPeg.MatrixClientPeg.get().getUserId();
      if (userId !== me) {
        throw new Error("Scalar token is owned by someone else: " + me);
      }
      return token;
    }).catch(e => {
      if (e instanceof _Terms.TermsNotSignedError) {
        _logger.logger.log("Integration manager requires new terms to be agreed to");
        // The terms endpoints are new and so live on standard _matrix prefixes,
        // but IM rest urls are currently configured with paths, so remove the
        // path from the base URL before passing it to the js-sdk

        // We continue to use the full URL for the calls done by
        // matrix-react-sdk, but the standard terms API called
        // by the js-sdk lives on the standard _matrix path. This means we
        // don't support running IMs on a non-root path, but it's the only
        // realistic way of transitioning to _matrix paths since configs in
        // the wild contain bits of the API path.

        // Once we've fully transitioned to _matrix URLs, we can give people
        // a grace period to update their configs, then use the rest url as
        // a regular base url.
        const parsedImRestUrl = (0, _UrlUtils.parseUrl)(this.apiUrl);
        parsedImRestUrl.pathname = "";
        return (0, _Terms.startTermsFlow)(_MatrixClientPeg.MatrixClientPeg.get(), [new _Terms.Service(_serviceTypes.SERVICE_TYPES.IM, parsedImRestUrl.toString(), token)], this.termsInteractionCallback).then(() => {
          return token;
        });
      } else {
        throw e;
      }
    });
  }
  registerForToken() {
    // Get openid bearer token from the HS as the first part of our dance
    return _MatrixClientPeg.MatrixClientPeg.get().getOpenIdToken().then(tokenObject => {
      // Now we can send that to scalar and exchange it for a scalar token
      return this.exchangeForScalarToken(tokenObject);
    }).then(token => {
      // Validate it (this mostly checks to see if the IM needs us to agree to some terms)
      return this.checkToken(token);
    }).then(token => {
      this.scalarToken = token;
      this.writeTokenToStore();
      return token;
    });
  }
  async exchangeForScalarToken(openidTokenObject) {
    const scalarRestUrl = new URL(this.apiUrl + "/register");
    scalarRestUrl.searchParams.set("v", imApiVersion);
    const res = await fetch(scalarRestUrl, {
      method: "POST",
      body: JSON.stringify(openidTokenObject),
      headers: {
        "Content-Type": "application/json"
      }
    });
    if (!res.ok) {
      throw new Error(`Scalar request failed: ${res.status}`);
    }
    const body = await res.json();
    if (!body?.scalar_token) {
      throw new Error("Missing scalar_token in response");
    }
    return body.scalar_token;
  }
  async getScalarPageTitle(url) {
    const scalarPageLookupUrl = new URL(this.getStarterLink(this.apiUrl + "/widgets/title_lookup"));
    scalarPageLookupUrl.searchParams.set("curl", encodeURIComponent(url));
    const res = await fetch(scalarPageLookupUrl, {
      method: "GET"
    });
    if (!res.ok) {
      throw new Error(`Scalar request failed: ${res.status}`);
    }
    const body = await res.json();
    return body?.page_title_cache_item?.cached_title;
  }

  /**
   * Mark all assets associated with the specified widget as "disabled" in the
   * integration manager database.
   * This can be useful to temporarily prevent purchased assets from being displayed.
   * @param  {WidgetType} widgetType The Widget Type to disable assets for
   * @param  {string} widgetId   The widget ID to disable assets for
   * @return {Promise}           Resolves on completion
   */
  async disableWidgetAssets(widgetType, widgetId) {
    const url = new URL(this.getStarterLink(this.apiUrl + "/widgets/set_assets_state"));
    url.searchParams.set("widget_type", widgetType.preferred);
    url.searchParams.set("widget_id", widgetId);
    url.searchParams.set("state", "disable");
    const res = await fetch(url, {
      method: "GET" // XXX: Actions shouldn't be GET requests
    });

    if (!res.ok) {
      throw new Error(`Scalar request failed: ${res.status}`);
    }
    const body = await res.text();
    if (!body) {
      throw new Error("Failed to set widget assets state");
    }
  }
  getScalarInterfaceUrlForRoom(room, screen, id) {
    const roomId = room.roomId;
    const roomName = room.name;
    let url = this.uiUrl;
    if (this.scalarToken) url += "?scalar_token=" + encodeURIComponent(this.scalarToken);
    url += "&room_id=" + encodeURIComponent(roomId);
    url += "&room_name=" + encodeURIComponent(roomName);
    url += "&theme=" + encodeURIComponent(_SettingsStore.default.getValue("theme"));
    if (id) {
      url += "&integ_id=" + encodeURIComponent(id);
    }
    if (screen) {
      url += "&screen=" + encodeURIComponent(screen);
    }
    return url;
  }
  getStarterLink(starterLinkUrl) {
    if (!this.scalarToken) return starterLinkUrl;
    return starterLinkUrl + "?scalar_token=" + encodeURIComponent(this.scalarToken);
  }
}
exports.default = ScalarAuthClient;
//# sourceMappingURL=ScalarAuthClient.js.map