"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useAudioDeviceSelection = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _react = require("react");
var _languageHandler = require("../languageHandler");
var _MediaDeviceHandler = _interopRequireWildcard(require("../MediaDeviceHandler"));
var _requestMediaPermissions = require("../utils/media/requestMediaPermissions");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
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
const useAudioDeviceSelection = onDeviceChanged => {
  const shouldRequestPermissionsRef = (0, _react.useRef)(true);
  const [state, setState] = (0, _react.useState)({
    devices: [],
    device: null
  });
  if (shouldRequestPermissionsRef.current) {
    shouldRequestPermissionsRef.current = false;
    (0, _requestMediaPermissions.requestMediaPermissions)(false).then(stream => {
      _MediaDeviceHandler.default.getDevices().then(devices => {
        if (!devices) return;
        const {
          audioinput
        } = devices;
        _MediaDeviceHandler.default.getDefaultDevice(audioinput);
        const deviceFromSettings = _MediaDeviceHandler.default.getAudioInput();
        const device = audioinput.find(d => {
          return d.deviceId === deviceFromSettings;
        }) || audioinput[0];
        setState(_objectSpread(_objectSpread({}, state), {}, {
          devices: audioinput,
          device
        }));
        stream?.getTracks().forEach(t => t.stop());
      });
    });
  }
  const setDevice = device => {
    const shouldNotify = device.deviceId !== state.device?.deviceId;
    _MediaDeviceHandler.default.instance.setDevice(device.deviceId, _MediaDeviceHandler.MediaDeviceKindEnum.AudioInput);
    setState(_objectSpread(_objectSpread({}, state), {}, {
      device
    }));
    if (shouldNotify) {
      onDeviceChanged?.(device);
    }
  };
  return {
    currentDevice: state.device,
    currentDeviceLabel: state.device?.label || (0, _languageHandler._t)("Default Device"),
    devices: state.devices,
    setDevice
  };
};
exports.useAudioDeviceSelection = useAudioDeviceSelection;
//# sourceMappingURL=useAudioDeviceSelection.js.map