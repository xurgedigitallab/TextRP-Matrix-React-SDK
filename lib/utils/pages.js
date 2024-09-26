"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getHomePageUrl = getHomePageUrl;
exports.shouldUseLoginForWelcome = shouldUseLoginForWelcome;
var _logger = require("matrix-js-sdk/src/logger");
var _WellKnownUtils = require("../utils/WellKnownUtils");
var _SnakedObject = require("./SnakedObject");
/*
Copyright 2019, 2021 The Matrix.org Foundation C.I.C.

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

function getHomePageUrl(appConfig, matrixClient) {
  const config = new _SnakedObject.SnakedObject(appConfig);
  const pagesConfig = config.get("embedded_pages");
  let pageUrl = pagesConfig ? new _SnakedObject.SnakedObject(pagesConfig).get("home_url") : null;
  if (!pageUrl) {
    // This is a deprecated config option for the home page
    // (despite the name, given we also now have a welcome
    // page, which is not the same).
    pageUrl = appConfig.welcomePageUrl;
    if (pageUrl) {
      _logger.logger.warn("You are using a deprecated config option: `welcomePageUrl`. Please use " + "`embedded_pages.home_url` instead, per https://github.com/vector-im/element-web/issues/21428");
    }
  }
  if (!pageUrl) {
    pageUrl = (0, _WellKnownUtils.getEmbeddedPagesWellKnown)(matrixClient)?.home_url;
  }
  return pageUrl;
}
function shouldUseLoginForWelcome(appConfig) {
  const config = new _SnakedObject.SnakedObject(appConfig);
  const pagesConfig = config.get("embedded_pages");
  return pagesConfig ? new _SnakedObject.SnakedObject(pagesConfig).get("login_for_welcome") === true : false;
}
//# sourceMappingURL=pages.js.map