"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useSettingValue = exports.useFeatureEnabled = void 0;
var _react = require("react");
var _SettingsStore = _interopRequireDefault(require("../settings/SettingsStore"));
/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

// Hook to fetch the value of a setting and dynamically update when it changes
const useSettingValue = function (settingName) {
  let roomId = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
  let excludeDefault = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  const [value, setValue] = (0, _react.useState)(_SettingsStore.default.getValue(settingName, roomId, excludeDefault));
  (0, _react.useEffect)(() => {
    const ref = _SettingsStore.default.watchSetting(settingName, roomId, () => {
      setValue(_SettingsStore.default.getValue(settingName, roomId, excludeDefault));
    });
    // clean-up
    return () => {
      _SettingsStore.default.unwatchSetting(ref);
    };
  }, [settingName, roomId, excludeDefault]);
  return value;
};

// Hook to fetch whether a feature is enabled and dynamically update when that changes
exports.useSettingValue = useSettingValue;
const useFeatureEnabled = function (featureName) {
  let roomId = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
  const [enabled, setEnabled] = (0, _react.useState)(_SettingsStore.default.getValue(featureName, roomId));
  (0, _react.useEffect)(() => {
    const ref = _SettingsStore.default.watchSetting(featureName, roomId, () => {
      setEnabled(_SettingsStore.default.getValue(featureName, roomId));
    });
    // clean-up
    return () => {
      _SettingsStore.default.unwatchSetting(ref);
    };
  }, [featureName, roomId]);
  return enabled;
};
exports.useFeatureEnabled = useFeatureEnabled;
//# sourceMappingURL=useSettings.js.map