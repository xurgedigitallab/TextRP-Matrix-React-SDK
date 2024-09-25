"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.parseUserAgent = exports.DeviceType = void 0;
var _uaParserJs = _interopRequireDefault(require("ua-parser-js"));
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
let DeviceType = /*#__PURE__*/function (DeviceType) {
  DeviceType["Desktop"] = "Desktop";
  DeviceType["Mobile"] = "Mobile";
  DeviceType["Web"] = "Web";
  DeviceType["Unknown"] = "Unknown";
  return DeviceType;
}({});
exports.DeviceType = DeviceType;
// Element/1.8.21 (iPhone XS Max; iOS 15.2; Scale/3.00)
const IOS_KEYWORD = "; iOS ";
const BROWSER_KEYWORD = "Mozilla/";
const getDeviceType = (userAgent, device, browser, operatingSystem) => {
  if (browser.name === "Electron") {
    return DeviceType.Desktop;
  }
  if (!!browser.name) {
    return DeviceType.Web;
  }
  if (device.type === "mobile" || operatingSystem.name?.includes("Android") || userAgent.indexOf(IOS_KEYWORD) > -1) {
    return DeviceType.Mobile;
  }
  return DeviceType.Unknown;
};
/**
 * Some mobile model and OS strings are not recognised
 * by the UA parsing library
 * check they exist by hand
 */
const checkForCustomValues = userAgent => {
  if (userAgent.includes(BROWSER_KEYWORD)) {
    return {};
  }
  const mightHaveDevice = userAgent.includes("(");
  if (!mightHaveDevice) {
    return {};
  }
  const deviceInfoSegments = userAgent.substring(userAgent.indexOf("(") + 1).split("; ");
  const customDeviceModel = deviceInfoSegments[0] || undefined;
  const customDeviceOS = deviceInfoSegments[1] || undefined;
  return {
    customDeviceModel,
    customDeviceOS
  };
};
const concatenateNameAndVersion = (name, version) => name && [name, version].filter(Boolean).join(" ");
const parseUserAgent = userAgent => {
  if (!userAgent) {
    return {
      deviceType: DeviceType.Unknown
    };
  }
  const parser = new _uaParserJs.default(userAgent);
  const browser = parser.getBrowser();
  const device = parser.getDevice();
  const operatingSystem = parser.getOS();
  const deviceType = getDeviceType(userAgent, device, browser, operatingSystem);

  // OSX versions are frozen at 10.15.17 in UA strings https://chromestatus.com/feature/5452592194781184
  // ignore OS version in browser based sessions
  const shouldIgnoreOSVersion = deviceType === DeviceType.Web || deviceType === DeviceType.Desktop;
  const deviceOperatingSystem = concatenateNameAndVersion(operatingSystem.name, shouldIgnoreOSVersion ? undefined : operatingSystem.version);
  const deviceModel = concatenateNameAndVersion(device.vendor, device.model);
  const client = concatenateNameAndVersion(browser.name, browser.version);

  // only try to parse custom model and OS when device type is known
  const {
    customDeviceModel,
    customDeviceOS
  } = deviceType !== DeviceType.Unknown ? checkForCustomValues(userAgent) : {};
  return {
    deviceType,
    deviceModel: deviceModel || customDeviceModel,
    deviceOperatingSystem: deviceOperatingSystem || customDeviceOS,
    client
  };
};
exports.parseUserAgent = parseUserAgent;
//# sourceMappingURL=parseUserAgent.js.map