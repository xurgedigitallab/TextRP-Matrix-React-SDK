"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useSmoothAnimation = useSmoothAnimation;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _logger = require("matrix-js-sdk/src/logger");
var _react = require("react");
var _SettingsStore = _interopRequireDefault(require("../settings/SettingsStore"));
var _useAnimation = require("./useAnimation");
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
const debuglog = function () {
  if (_SettingsStore.default.getValue("debug_animation")) {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    _logger.logger.log.call(console, "Animation debuglog:", ...args);
  }
};

/**
 * Utility function to smoothly animate to a certain target value
 * @param initialValue Initial value to be used as initial starting point
 * @param targetValue Desired value to animate to (can be changed repeatedly to whatever is current at that time)
 * @param duration Duration that each animation should take, specify 0 to skip animating
 */
function useSmoothAnimation(initialValue, targetValue, duration) {
  const state = (0, _react.useRef)({
    timestamp: null,
    value: initialValue
  });
  const [currentValue, setCurrentValue] = (0, _react.useState)(initialValue);
  const [currentStepSize, setCurrentStepSize] = (0, _react.useState)(0);
  (0, _react.useEffect)(() => {
    const totalDelta = targetValue - state.current.value;
    setCurrentStepSize(totalDelta / duration);
    state.current = _objectSpread(_objectSpread({}, state.current), {}, {
      timestamp: null
    });
  }, [duration, targetValue]);
  const update = (0, _react.useCallback)(timestamp => {
    if (!state.current.timestamp) {
      state.current = _objectSpread(_objectSpread({}, state.current), {}, {
        timestamp
      });
      return true;
    }
    if (Math.abs(currentStepSize) < Number.EPSILON) {
      return false;
    }
    const timeDelta = timestamp - state.current.timestamp;
    const valueDelta = currentStepSize * timeDelta;
    const maxValueDelta = targetValue - state.current.value;
    const clampedValueDelta = Math.sign(valueDelta) * Math.min(Math.abs(maxValueDelta), Math.abs(valueDelta));
    const value = state.current.value + clampedValueDelta;
    debuglog(`Animating to ${targetValue} at ${value} timeDelta=${timeDelta}, valueDelta=${valueDelta}`);
    setCurrentValue(value);
    state.current = {
      value,
      timestamp
    };
    return Math.abs(maxValueDelta) > Number.EPSILON;
  }, [currentStepSize, targetValue]);
  (0, _useAnimation.useAnimation)(duration > 0, update);
  return duration > 0 ? currentValue : targetValue;
}
//# sourceMappingURL=useSmoothAnimation.js.map