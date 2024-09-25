"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.findMapStyleUrl = findMapStyleUrl;
var _logger = require("matrix-js-sdk/src/logger");
var _SdkConfig = _interopRequireDefault(require("../../SdkConfig"));
var _WellKnownUtils = require("../WellKnownUtils");
var _LocationShareErrors = require("./LocationShareErrors");
/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

/**
 * Look up what map tile server style URL was provided in the homeserver's
 * .well-known location, or, failing that, in our local config, or, failing
 * that, defaults to the same tile server listed by matrix.org.
 */
function findMapStyleUrl(matrixClient) {
  const mapStyleUrl = (0, _WellKnownUtils.getTileServerWellKnown)(matrixClient)?.map_style_url ?? _SdkConfig.default.get().map_style_url;
  if (!mapStyleUrl) {
    _logger.logger.error("'map_style_url' missing from homeserver .well-known area, and missing from from config.json.");
    throw new Error(_LocationShareErrors.LocationShareError.MapStyleUrlNotConfigured);
  }
  return mapStyleUrl;
}
//# sourceMappingURL=findMapStyleUrl.js.map