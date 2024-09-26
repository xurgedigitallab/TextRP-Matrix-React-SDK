"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.OwnDevicesError = void 0;
exports.fetchExtendedDeviceInformation = fetchExtendedDeviceInformation;
exports.useOwnDevices = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _react = require("react");
var _matrix = require("matrix-js-sdk/src/matrix");
var _logger = require("matrix-js-sdk/src/logger");
var _crypto = require("matrix-js-sdk/src/crypto");
var _MatrixClientContext = _interopRequireDefault(require("../../../../contexts/MatrixClientContext"));
var _languageHandler = require("../../../../languageHandler");
var _clientInformation = require("../../../../utils/device/clientInformation");
var _useEventEmitter = require("../../../../hooks/useEventEmitter");
var _parseUserAgent = require("../../../../utils/device/parseUserAgent");
var _isDeviceVerified = require("../../../../utils/device/isDeviceVerified");
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; } /*
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
const parseDeviceExtendedInformation = (matrixClient, device) => {
  const {
    name,
    version,
    url
  } = (0, _clientInformation.getDeviceClientInformation)(matrixClient, device.device_id);
  return {
    appName: name,
    appVersion: version,
    url
  };
};

/**
 * Fetch extended details of the user's own devices
 *
 * @param matrixClient - Matrix Client
 * @returns A dictionary mapping from device ID to ExtendedDevice
 */
async function fetchExtendedDeviceInformation(matrixClient) {
  const {
    devices
  } = await matrixClient.getDevices();
  const devicesDict = {};
  for (const device of devices) {
    devicesDict[device.device_id] = _objectSpread(_objectSpread(_objectSpread({}, device), {}, {
      isVerified: await (0, _isDeviceVerified.isDeviceVerified)(matrixClient, device.device_id)
    }, parseDeviceExtendedInformation(matrixClient, device)), (0, _parseUserAgent.parseUserAgent)(device[_matrix.UNSTABLE_MSC3852_LAST_SEEN_UA.name]));
  }
  return devicesDict;
}
let OwnDevicesError = /*#__PURE__*/function (OwnDevicesError) {
  OwnDevicesError["Unsupported"] = "Unsupported";
  OwnDevicesError["Default"] = "Default";
  return OwnDevicesError;
}({});
exports.OwnDevicesError = OwnDevicesError;
const useOwnDevices = () => {
  const matrixClient = (0, _react.useContext)(_MatrixClientContext.default);
  const currentDeviceId = matrixClient.getDeviceId();
  const userId = matrixClient.getSafeUserId();
  const [devices, setDevices] = (0, _react.useState)({});
  const [pushers, setPushers] = (0, _react.useState)([]);
  const [localNotificationSettings, setLocalNotificationSettings] = (0, _react.useState)(new Map());
  const [isLoadingDeviceList, setIsLoadingDeviceList] = (0, _react.useState)(true);
  const [supportsMSC3881, setSupportsMSC3881] = (0, _react.useState)(true); // optimisticly saying yes!

  const [error, setError] = (0, _react.useState)();
  (0, _react.useEffect)(() => {
    matrixClient.doesServerSupportUnstableFeature("org.matrix.msc3881").then(hasSupport => {
      setSupportsMSC3881(hasSupport);
    });
  }, [matrixClient]);
  const refreshDevices = (0, _react.useCallback)(async () => {
    setIsLoadingDeviceList(true);
    try {
      const devices = await fetchExtendedDeviceInformation(matrixClient);
      setDevices(devices);
      const {
        pushers
      } = await matrixClient.getPushers();
      setPushers(pushers);
      const notificationSettings = new Map();
      Object.keys(devices).forEach(deviceId => {
        const eventType = `${_matrix.LOCAL_NOTIFICATION_SETTINGS_PREFIX.name}.${deviceId}`;
        const event = matrixClient.getAccountData(eventType);
        if (event) {
          notificationSettings.set(deviceId, event.getContent());
        }
      });
      setLocalNotificationSettings(notificationSettings);
      setIsLoadingDeviceList(false);
    } catch (error) {
      if (error.httpStatus == 404) {
        // 404 probably means the HS doesn't yet support the API.
        setError(OwnDevicesError.Unsupported);
      } else {
        _logger.logger.error("Error loading sessions:", error);
        setError(OwnDevicesError.Default);
      }
      setIsLoadingDeviceList(false);
    }
  }, [matrixClient]);
  (0, _react.useEffect)(() => {
    refreshDevices();
  }, [refreshDevices]);
  (0, _react.useEffect)(() => {
    const deviceIds = Object.keys(devices);
    // empty devices means devices have not been fetched yet
    // as there is always at least the current device
    if (deviceIds.length) {
      (0, _clientInformation.pruneClientInformation)(deviceIds, matrixClient);
    }
  }, [devices, matrixClient]);
  (0, _useEventEmitter.useEventEmitter)(matrixClient, _crypto.CryptoEvent.DevicesUpdated, users => {
    if (users.includes(userId)) {
      refreshDevices();
    }
  });
  (0, _useEventEmitter.useEventEmitter)(matrixClient, _matrix.ClientEvent.AccountData, event => {
    const type = event.getType();
    if (type.startsWith(_matrix.LOCAL_NOTIFICATION_SETTINGS_PREFIX.name)) {
      const newSettings = new Map(localNotificationSettings);
      const deviceId = type.slice(type.lastIndexOf(".") + 1);
      newSettings.set(deviceId, event.getContent());
      setLocalNotificationSettings(newSettings);
    }
  });
  const isCurrentDeviceVerified = !!devices[currentDeviceId]?.isVerified;
  const requestDeviceVerification = isCurrentDeviceVerified && userId ? async deviceId => {
    return await matrixClient.requestVerification(userId, [deviceId]);
  } : undefined;
  const saveDeviceName = (0, _react.useCallback)(async (deviceId, deviceName) => {
    const device = devices[deviceId];

    // no change
    if (deviceName === device?.display_name) {
      return;
    }
    try {
      await matrixClient.setDeviceDetails(deviceId, {
        display_name: deviceName
      });
      await refreshDevices();
    } catch (error) {
      _logger.logger.error("Error setting session display name", error);
      throw new Error((0, _languageHandler._t)("Failed to set display name"));
    }
  }, [matrixClient, devices, refreshDevices]);
  const setPushNotifications = (0, _react.useCallback)(async (deviceId, enabled) => {
    try {
      const pusher = pushers.find(pusher => pusher[_matrix.PUSHER_DEVICE_ID.name] === deviceId);
      if (pusher) {
        await matrixClient.setPusher(_objectSpread(_objectSpread({}, pusher), {}, {
          [_matrix.PUSHER_ENABLED.name]: enabled
        }));
      } else if (localNotificationSettings.has(deviceId)) {
        await matrixClient.setLocalNotificationSettings(deviceId, {
          is_silenced: !enabled
        });
      }
    } catch (error) {
      _logger.logger.error("Error setting pusher state", error);
      throw new Error((0, _languageHandler._t)("Failed to set pusher state"));
    } finally {
      await refreshDevices();
    }
  }, [matrixClient, pushers, localNotificationSettings, refreshDevices]);
  return {
    devices,
    pushers,
    localNotificationSettings,
    currentDeviceId,
    isLoadingDeviceList,
    error,
    requestDeviceVerification,
    refreshDevices,
    saveDeviceName,
    setPushNotifications,
    supportsMSC3881
  };
};
exports.useOwnDevices = useOwnDevices;
//# sourceMappingURL=useOwnDevices.js.map