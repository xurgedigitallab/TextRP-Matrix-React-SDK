"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _MatrixClientBackedController = _interopRequireDefault(require("./MatrixClientBackedController"));
var _SettingsStore = _interopRequireDefault(require("../SettingsStore"));
/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
 * Disables a given setting if the server unstable feature it requires is not supported
 * When a setting gets disabled or enabled from this controller it notifies the given WatchManager
 */
class ServerSupportUnstableFeatureController extends _MatrixClientBackedController.default {
  /**
   * Construct a new ServerSupportUnstableFeatureController.
   *
   * @param unstableFeatureGroups - If any one of the feature groups is satisfied,
   * then the setting is considered enabled. A feature group is satisfied if all of
   * the features in the group are supported (all features in a group are required).
   */
  constructor(settingName, watchers, unstableFeatureGroups, stableVersion, disabledMessage) {
    let forcedValue = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : false;
    super();
    this.settingName = settingName;
    this.watchers = watchers;
    this.unstableFeatureGroups = unstableFeatureGroups;
    this.stableVersion = stableVersion;
    this.disabledMessage = disabledMessage;
    this.forcedValue = forcedValue;
    // Starts off as `undefined` so when we first compare the `newDisabledValue`, it sees
    // it as a change and updates the watchers.
    (0, _defineProperty2.default)(this, "enabled", void 0);
  }
  get disabled() {
    return !this.enabled;
  }
  set disabled(newDisabledValue) {
    if (!newDisabledValue === this.enabled) return;
    this.enabled = !newDisabledValue;
    const level = _SettingsStore.default.firstSupportedLevel(this.settingName);
    if (!level) return;
    const settingValue = _SettingsStore.default.getValue(this.settingName, null);
    this.watchers.notifyUpdate(this.settingName, null, level, settingValue);
  }
  async initMatrixClient(oldClient, newClient) {
    // Check for stable version support first
    if (this.stableVersion && (await this.client.isVersionSupported(this.stableVersion))) {
      this.disabled = false;
      return;
    }

    // Otherwise, only one of the unstable feature groups needs to be satisfied in
    // order for this setting overall to be enabled
    let isEnabled = false;
    for (const featureGroup of this.unstableFeatureGroups) {
      const featureSupportList = await Promise.all(featureGroup.map(async feature => {
        const isFeatureSupported = await this.client.doesServerSupportUnstableFeature(feature);
        return isFeatureSupported;
      }));

      // Every feature in a feature group is required in order
      // for this setting overall to be enabled.
      const isFeatureGroupSatisfied = featureSupportList.every(isFeatureSupported => isFeatureSupported);
      if (isFeatureGroupSatisfied) {
        isEnabled = true;
        break;
      }
    }
    this.disabled = !isEnabled;
  }
  getValueOverride(level, roomId, calculatedValue, calculatedAtLevel) {
    if (this.settingDisabled) {
      return this.forcedValue;
    }
    return null; // no override
  }

  get settingDisabled() {
    if (this.disabled) {
      return this.disabledMessage ?? true;
    }
    return false;
  }
}
exports.default = ServerSupportUnstableFeatureController;
//# sourceMappingURL=ServerSupportUnstableFeatureController.js.map