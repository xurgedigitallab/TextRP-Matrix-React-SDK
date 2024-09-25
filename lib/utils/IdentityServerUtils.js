"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.doesAccountDataHaveIdentityServer = doesAccountDataHaveIdentityServer;
exports.doesIdentityServerHaveTerms = doesIdentityServerHaveTerms;
exports.getDefaultIdentityServerUrl = getDefaultIdentityServerUrl;
exports.setToDefaultIdentityServer = setToDefaultIdentityServer;
var _serviceTypes = require("matrix-js-sdk/src/service-types");
var _logger = require("matrix-js-sdk/src/logger");
var _httpApi = require("matrix-js-sdk/src/http-api");
var _SdkConfig = _interopRequireDefault(require("../SdkConfig"));
/*
Copyright 2019 - 2021 The Matrix.org Foundation C.I.C.

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

function getDefaultIdentityServerUrl() {
  return _SdkConfig.default.get("validated_server_config")?.isUrl;
}
function setToDefaultIdentityServer(matrixClient) {
  const url = getDefaultIdentityServerUrl();
  // Account data change will update localstorage, client, etc through dispatcher
  matrixClient.setAccountData("m.identity_server", {
    base_url: url
  });
}
async function doesIdentityServerHaveTerms(matrixClient, fullUrl) {
  let terms;
  try {
    terms = await matrixClient.getTerms(_serviceTypes.SERVICE_TYPES.IS, fullUrl);
  } catch (e) {
    _logger.logger.error(e);
    if (e.cors === "rejected" || e instanceof _httpApi.HTTPError && e.httpStatus === 404) {
      terms = null;
    } else {
      throw e;
    }
  }
  return !!terms?.["policies"] && Object.keys(terms["policies"]).length > 0;
}
function doesAccountDataHaveIdentityServer(matrixClient) {
  const event = matrixClient.getAccountData("m.identity_server");
  return event?.getContent()["base_url"];
}
//# sourceMappingURL=IdentityServerUtils.js.map