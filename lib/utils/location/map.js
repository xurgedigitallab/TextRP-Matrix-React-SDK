"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.makeMapSiteLink = exports.createMarker = exports.createMapSiteLinkFromEvent = exports.createMap = void 0;
var maplibregl = _interopRequireWildcard(require("maplibre-gl"));
var _location = require("matrix-js-sdk/src/@types/location");
var _logger = require("matrix-js-sdk/src/logger");
var _languageHandler = require("../../languageHandler");
var _parseGeoUri = require("./parseGeoUri");
var _findMapStyleUrl = require("./findMapStyleUrl");
var _LocationShareErrors = require("./LocationShareErrors");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
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

const createMap = (client, interactive, bodyId, onError) => {
  try {
    const styleUrl = (0, _findMapStyleUrl.findMapStyleUrl)(client);
    const map = new maplibregl.Map({
      container: bodyId,
      style: styleUrl,
      zoom: 15,
      interactive,
      attributionControl: false,
      locale: {
        "AttributionControl.ToggleAttribution": (0, _languageHandler._t)("Toggle attribution"),
        "AttributionControl.MapFeedback": (0, _languageHandler._t)("Map feedback"),
        "FullscreenControl.Enter": (0, _languageHandler._t)("Enter fullscreen"),
        "FullscreenControl.Exit": (0, _languageHandler._t)("Exit fullscreen"),
        "GeolocateControl.FindMyLocation": (0, _languageHandler._t)("Find my location"),
        "GeolocateControl.LocationNotAvailable": (0, _languageHandler._t)("Location not available"),
        "LogoControl.Title": (0, _languageHandler._t)("Mapbox logo"),
        "NavigationControl.ResetBearing": (0, _languageHandler._t)("Reset bearing to north"),
        "NavigationControl.ZoomIn": (0, _languageHandler._t)("Zoom in"),
        "NavigationControl.ZoomOut": (0, _languageHandler._t)("Zoom out")
      }
    });
    map.addControl(new maplibregl.AttributionControl(), "top-right");
    map.on("error", e => {
      _logger.logger.error("Failed to load map: check map_style_url in config.json has a valid URL and API key", e.error);
      onError?.(new Error(_LocationShareErrors.LocationShareError.MapStyleUrlNotReachable));
    });
    return map;
  } catch (e) {
    _logger.logger.error("Failed to render map", e);
    const errorMessage = e?.message;
    if (errorMessage.includes("Failed to initialize WebGL")) throw new Error(_LocationShareErrors.LocationShareError.WebGLNotEnabled);
    throw e;
  }
};
exports.createMap = createMap;
const createMarker = (coords, element) => {
  const marker = new maplibregl.Marker({
    element,
    anchor: "bottom",
    offset: [0, -1]
  }).setLngLat({
    lon: coords.longitude,
    lat: coords.latitude
  });
  return marker;
};
exports.createMarker = createMarker;
const makeMapSiteLink = coords => {
  return "https://www.openstreetmap.org/" + `?mlat=${coords.latitude}` + `&mlon=${coords.longitude}` + `#map=16/${coords.latitude}/${coords.longitude}`;
};
exports.makeMapSiteLink = makeMapSiteLink;
const createMapSiteLinkFromEvent = event => {
  const content = event.getContent();
  const mLocation = content[_location.M_LOCATION.name];
  if (mLocation !== undefined) {
    const uri = mLocation["uri"];
    if (uri !== undefined) {
      const geoCoords = (0, _parseGeoUri.parseGeoUri)(uri);
      return geoCoords ? makeMapSiteLink(geoCoords) : null;
    }
  } else {
    const geoUri = content["geo_uri"];
    if (geoUri) {
      const geoCoords = (0, _parseGeoUri.parseGeoUri)(geoUri);
      return geoCoords ? makeMapSiteLink(geoCoords) : null;
    }
  }
  return null;
};
exports.createMapSiteLinkFromEvent = createMapSiteLinkFromEvent;
//# sourceMappingURL=map.js.map