"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.locationEventGeoUri = void 0;
var _location = require("matrix-js-sdk/src/@types/location");
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
 * Find the geo-URI contained within a location event.
 */
const locationEventGeoUri = mxEvent => {
  // unfortunately we're stuck supporting legacy `content.geo_uri`
  // events until the end of days, or until we figure out mutable
  // events - so folks can read their old chat history correctly.
  // https://github.com/matrix-org/matrix-doc/issues/3516
  const content = mxEvent.getContent();
  const loc = _location.M_LOCATION.findIn(content);
  return loc ? loc.uri : content["geo_uri"];
};
exports.locationEventGeoUri = locationEventGeoUri;
//# sourceMappingURL=locationEventGeoUri.js.map