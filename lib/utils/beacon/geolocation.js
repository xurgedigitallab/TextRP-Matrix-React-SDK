"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.watchPosition = exports.mapGeolocationPositionToTimedGeo = exports.mapGeolocationError = exports.getGeoUri = exports.getCurrentPosition = exports.genericPositionFromGeolocation = exports.GeolocationError = void 0;
var _logger = require("matrix-js-sdk/src/logger");
/*
Copyright 2022 The Matrix.org Foundation C.I.C

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
// map GeolocationPositionError codes
// https://developer.mozilla.org/en-US/docs/Web/API/GeolocationPositionError
let GeolocationError = /*#__PURE__*/function (GeolocationError) {
  GeolocationError["Unavailable"] = "Unavailable";
  GeolocationError["PermissionDenied"] = "PermissionDenied";
  GeolocationError["PositionUnavailable"] = "PositionUnavailable";
  GeolocationError["Timeout"] = "Timeout";
  GeolocationError["Default"] = "Default";
  return GeolocationError;
}({});
exports.GeolocationError = GeolocationError;
const GeolocationOptions = {
  timeout: 10000,
  maximumAge: 60000
};
const isGeolocationPositionError = error => typeof error === "object" && !!error["PERMISSION_DENIED"];
/**
 * Maps GeolocationPositionError to our GeolocationError enum
 */
const mapGeolocationError = error => {
  _logger.logger.error("Geolocation failed", error?.message ?? error);
  if (isGeolocationPositionError(error)) {
    switch (error?.code) {
      case error.PERMISSION_DENIED:
        return GeolocationError.PermissionDenied;
      case error.POSITION_UNAVAILABLE:
        return GeolocationError.PositionUnavailable;
      case error.TIMEOUT:
        return GeolocationError.Timeout;
      default:
        return GeolocationError.Default;
    }
  } else if (error.message === GeolocationError.Unavailable) {
    return GeolocationError.Unavailable;
  } else {
    return GeolocationError.Default;
  }
};
exports.mapGeolocationError = mapGeolocationError;
const getGeolocation = () => {
  if (!navigator.geolocation) {
    throw new Error(GeolocationError.Unavailable);
  }
  return navigator.geolocation;
};
const genericPositionFromGeolocation = geoPosition => {
  const {
    latitude,
    longitude,
    altitude,
    accuracy
  } = geoPosition.coords;
  return {
    // safari reports geolocation timestamps as Apple Cocoa Core Data timestamp
    // or ms since 1/1/2001 instead of the regular epoch
    // they also use local time, not utc
    // to simplify, just use Date.now()
    timestamp: Date.now(),
    latitude,
    longitude,
    altitude: altitude ?? undefined,
    accuracy
  };
};
exports.genericPositionFromGeolocation = genericPositionFromGeolocation;
const getGeoUri = position => {
  const lat = position.latitude;
  const lon = position.longitude;
  const alt = Number.isFinite(position.altitude) ? `,${position.altitude}` : "";
  const acc = Number.isFinite(position.accuracy) ? `;u=${position.accuracy}` : "";
  return `geo:${lat},${lon}${alt}${acc}`;
};
exports.getGeoUri = getGeoUri;
const mapGeolocationPositionToTimedGeo = position => {
  const genericPosition = genericPositionFromGeolocation(position);
  return {
    timestamp: genericPosition.timestamp,
    geoUri: getGeoUri(genericPosition)
  };
};

/**
 * Gets current position, returns a promise
 * @returns Promise<GeolocationPosition>
 */
exports.mapGeolocationPositionToTimedGeo = mapGeolocationPositionToTimedGeo;
const getCurrentPosition = async () => {
  try {
    const position = await new Promise((resolve, reject) => {
      getGeolocation().getCurrentPosition(resolve, reject, GeolocationOptions);
    });
    return position;
  } catch (error) {
    throw new Error(mapGeolocationError(error));
  }
};
exports.getCurrentPosition = getCurrentPosition;
const watchPosition = (onWatchPosition, onWatchPositionError) => {
  try {
    const onError = error => onWatchPositionError(mapGeolocationError(error));
    const watchId = getGeolocation().watchPosition(onWatchPosition, onError, GeolocationOptions);
    const clearWatch = () => {
      getGeolocation().clearWatch(watchId);
    };
    return clearWatch;
  } catch (error) {
    throw new Error(mapGeolocationError(error));
  }
};
exports.watchPosition = watchPosition;
//# sourceMappingURL=geolocation.js.map