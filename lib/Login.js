"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
exports.sendLoginRequest = sendLoginRequest;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _matrix = require("matrix-js-sdk/src/matrix");
var _logger = require("matrix-js-sdk/src/logger");
var _auth = require("matrix-js-sdk/src/@types/auth");
var _Security = _interopRequireDefault(require("./customisations/Security"));
/*
Copyright 2015-2021 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

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

// @ts-ignore - XXX: tsc doesn't like this: our js-sdk imports are complex so this isn't surprising

class Login {
  // memoize

  constructor(hsUrl, isUrl, fallbackHsUrl, opts) {
    this.hsUrl = hsUrl;
    this.isUrl = isUrl;
    this.fallbackHsUrl = fallbackHsUrl;
    (0, _defineProperty2.default)(this, "flows", []);
    (0, _defineProperty2.default)(this, "defaultDeviceDisplayName", void 0);
    (0, _defineProperty2.default)(this, "tempClient", null);
    this.defaultDeviceDisplayName = opts.defaultDeviceDisplayName;
  }
  getHomeserverUrl() {
    return this.hsUrl;
  }
  getIdentityServerUrl() {
    return this.isUrl;
  }
  setHomeserverUrl(hsUrl) {
    this.tempClient = null; // clear memoization
    this.hsUrl = hsUrl;
  }
  setIdentityServerUrl(isUrl) {
    this.tempClient = null; // clear memoization
    this.isUrl = isUrl;
  }

  /**
   * Get a temporary MatrixClient, which can be used for login or register
   * requests.
   * @returns {MatrixClient}
   */
  createTemporaryClient() {
    if (!this.tempClient) {
      this.tempClient = (0, _matrix.createClient)({
        baseUrl: this.hsUrl,
        idBaseUrl: this.isUrl
      });
    }
    return this.tempClient;
  }
  async getFlows() {
    const client = this.createTemporaryClient();
    const {
      flows
    } = await client.loginFlows();
    // If an m.login.sso flow is present which is also flagged as being for MSC3824 OIDC compatibility then we only
    // return that flow as (per MSC3824) it is the only one that the user should be offered to give the best experience
    const oidcCompatibilityFlow = flows.find(f => f.type === "m.login.sso" && _auth.DELEGATED_OIDC_COMPATIBILITY.findIn(f));
    this.flows = oidcCompatibilityFlow ? [oidcCompatibilityFlow] : flows;
    return this.flows;
  }
  loginViaPassword(username, phoneCountry, phoneNumber, password) {
    const isEmail = !!username && username.indexOf("@") > 0;
    let identifier;
    if (phoneCountry && phoneNumber) {
      identifier = {
        type: "m.id.phone",
        country: phoneCountry,
        phone: phoneNumber,
        // XXX: Synapse historically wanted `number` and not `phone`
        number: phoneNumber
      };
    } else if (isEmail) {
      identifier = {
        type: "m.id.thirdparty",
        medium: "email",
        address: username
      };
    } else {
      identifier = {
        type: "m.id.user",
        user: username
      };
    }
    const loginParams = {
      password,
      identifier,
      initial_device_display_name: this.defaultDeviceDisplayName
    };
    const tryFallbackHs = originalError => {
      return sendLoginRequest(this.fallbackHsUrl, this.isUrl, "m.login.password", loginParams).catch(fallbackError => {
        _logger.logger.log("fallback HS login failed", fallbackError);
        // throw the original error
        throw originalError;
      });
    };
    let originalLoginError = null;
    return sendLoginRequest(this.hsUrl, this.isUrl, "m.login.password", loginParams).catch(error => {
      originalLoginError = error;
      if (error.httpStatus === 403) {
        if (this.fallbackHsUrl) {
          return tryFallbackHs(originalLoginError);
        }
      }
      throw originalLoginError;
    }).catch(error => {
      _logger.logger.log("Login failed", error);
      throw error;
    });
  }
  loginViaJWT(token) {
    console.log("🟠🟠🟠 ========== loginViaJWT CALLED ========== 🟠🟠🟠");
    console.log("🟠 Token length:", token.length);
    console.log("🟠 Homeserver URL (this.hsUrl):", this.hsUrl);
    console.log("🟠 Identity server URL (this.isUrl):", this.isUrl);
    const loginParams = {
      token,
      initial_device_display_name: this.defaultDeviceDisplayName
    };
    console.log("🟠 Login params:", loginParams);
    console.log("🟠 Sending login request with type: org.matrix.login.jwt");
    console.log("🟠🟠🟠 ============================================== 🟠🟠🟠");
    return sendLoginRequest(this.hsUrl, this.isUrl, "org.matrix.login.jwt", loginParams).then(result => {
      console.log("✅✅✅ ========== JWT LOGIN REQUEST SUCCESS ========== ✅✅✅");
      console.log("✅ Result object:", result);
      console.log("✅ Result.homeserverUrl:", result.homeserverUrl);
      console.log("✅ Result.userId:", result.userId);
      console.log("✅ Result.deviceId:", result.deviceId);
      console.log("✅ Result.accessToken (first 20):", result.accessToken?.substring(0, 20));
      console.log("✅✅✅ ==================================================== ✅✅✅");
      return result;
    }).catch(error => {
      console.error("❌❌❌ ========== JWT LOGIN REQUEST FAILED ========== ❌❌❌");
      console.error("❌ Error:", error);
      console.error("❌ Error status:", error.httpStatus);
      console.error("❌ Error data:", error.data);
      console.error("❌❌❌ ================================================== ❌❌❌");
      _logger.logger.log("JWT Login failed", error);
      throw error;
    });
  }
}

/**
 * Send a login request to the given server, and format the response
 * as a MatrixClientCreds
 *
 * @param {string} hsUrl   the base url of the Homeserver used to log in.
 * @param {string} isUrl   the base url of the default identity server
 * @param {string} loginType the type of login to do
 * @param {ILoginParams} loginParams the parameters for the login
 *
 * @returns {IMatrixClientCreds}
 */
exports.default = Login;
async function sendLoginRequest(hsUrl, isUrl, loginType, loginParams) {
  console.log("🔶🔶🔶 ========== sendLoginRequest ========== 🔶🔶🔶");
  console.log("🔶 Input hsUrl:", hsUrl);
  console.log("🔶 Login type:", loginType);
  const client = (0, _matrix.createClient)({
    baseUrl: hsUrl,
    idBaseUrl: isUrl
  });
  const data = await client.login(loginType, loginParams);
  console.log("🔶 Login response data:", data);
  console.log("🔶 Well-known data:", data.well_known);

  // Store the original hsUrl for JWT logins
  const originalHsUrl = hsUrl;
  const wellknown = data.well_known;
  if (wellknown) {
    if (wellknown["m.homeserver"]?.["base_url"]) {
      // For JWT login (wallet-based), preserve the explicitly specified homeserver URL
      // instead of using the well_known override
      if (loginType === "org.matrix.login.jwt") {
        console.log("🔶 JWT login detected - IGNORING well_known homeserver override");
        console.log("🔶 Well-known tried to change to:", wellknown["m.homeserver"]["base_url"]);
        console.log("🔶 Keeping original URL:", originalHsUrl);
      } else {
        hsUrl = wellknown["m.homeserver"]["base_url"];
        _logger.logger.log(`Overrode homeserver setting with ${hsUrl} from login response`);
      }
    }
    if (wellknown["m.identity_server"]?.["base_url"]) {
      // TODO: should we prompt here?
      isUrl = wellknown["m.identity_server"]["base_url"];
      _logger.logger.log(`Overrode IS setting with ${isUrl} from login response`);
    }
  }
  const creds = {
    homeserverUrl: hsUrl,
    identityServerUrl: isUrl,
    userId: data.user_id,
    deviceId: data.device_id,
    accessToken: data.access_token
  };
  console.log("🔶 Final credentials homeserverUrl:", creds.homeserverUrl);
  console.log("🔶🔶🔶 ============================================== 🔶🔶🔶");
  _Security.default.examineLoginResponse?.(data, creds);
  return creds;
}
//# sourceMappingURL=Login.js.map