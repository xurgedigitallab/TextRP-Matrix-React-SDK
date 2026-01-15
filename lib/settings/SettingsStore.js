"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.LEVEL_ORDER = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _logger = require("matrix-js-sdk/src/logger");
var _DeviceSettingsHandler = _interopRequireDefault(require("./handlers/DeviceSettingsHandler"));
var _RoomDeviceSettingsHandler = _interopRequireDefault(require("./handlers/RoomDeviceSettingsHandler"));
var _DefaultSettingsHandler = _interopRequireDefault(require("./handlers/DefaultSettingsHandler"));
var _RoomAccountSettingsHandler = _interopRequireDefault(require("./handlers/RoomAccountSettingsHandler"));
var _AccountSettingsHandler = _interopRequireDefault(require("./handlers/AccountSettingsHandler"));
var _RoomSettingsHandler = _interopRequireDefault(require("./handlers/RoomSettingsHandler"));
var _ConfigSettingsHandler = _interopRequireDefault(require("./handlers/ConfigSettingsHandler"));
var _languageHandler = require("../languageHandler");
var _dispatcher = _interopRequireDefault(require("../dispatcher/dispatcher"));
var _Settings = require("./Settings");
var _LocalEchoWrapper = _interopRequireDefault(require("./handlers/LocalEchoWrapper"));
var _SettingLevel = require("./SettingLevel");
var _actions = require("../dispatcher/actions");
var _PlatformSettingsHandler = _interopRequireDefault(require("./handlers/PlatformSettingsHandler"));
var _MatrixClientPeg = require("../MatrixClientPeg");
/*
Copyright 2017 Travis Ralston
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

// Convert the settings to easier to manage objects for the handlers
const defaultSettings = {};
const invertedDefaultSettings = {};
const featureNames = [];
for (const key in _Settings.SETTINGS) {
  const setting = _Settings.SETTINGS[key];
  defaultSettings[key] = setting.default;
  if (setting.isFeature) featureNames.push(key);
  if (setting.invertedSettingName) {
    // Invert now so that the rest of the system will invert it back to what was intended.
    invertedDefaultSettings[setting.invertedSettingName] = !setting.default;
  }
}

// Only wrap the handlers with async setters in a local echo wrapper
const LEVEL_HANDLERS = {
  [_SettingLevel.SettingLevel.DEVICE]: new _DeviceSettingsHandler.default(featureNames, _Settings.defaultWatchManager),
  [_SettingLevel.SettingLevel.ROOM_DEVICE]: new _RoomDeviceSettingsHandler.default(_Settings.defaultWatchManager),
  [_SettingLevel.SettingLevel.ROOM_ACCOUNT]: new _LocalEchoWrapper.default(new _RoomAccountSettingsHandler.default(_Settings.defaultWatchManager), _SettingLevel.SettingLevel.ROOM_ACCOUNT),
  [_SettingLevel.SettingLevel.ACCOUNT]: new _LocalEchoWrapper.default(new _AccountSettingsHandler.default(_Settings.defaultWatchManager), _SettingLevel.SettingLevel.ACCOUNT),
  [_SettingLevel.SettingLevel.ROOM]: new _LocalEchoWrapper.default(new _RoomSettingsHandler.default(_Settings.defaultWatchManager), _SettingLevel.SettingLevel.ROOM),
  [_SettingLevel.SettingLevel.PLATFORM]: new _LocalEchoWrapper.default(new _PlatformSettingsHandler.default(), _SettingLevel.SettingLevel.PLATFORM),
  [_SettingLevel.SettingLevel.CONFIG]: new _ConfigSettingsHandler.default(featureNames),
  [_SettingLevel.SettingLevel.DEFAULT]: new _DefaultSettingsHandler.default(defaultSettings, invertedDefaultSettings)
};
const LEVEL_ORDER = [_SettingLevel.SettingLevel.DEVICE, _SettingLevel.SettingLevel.ROOM_DEVICE, _SettingLevel.SettingLevel.ROOM_ACCOUNT, _SettingLevel.SettingLevel.ACCOUNT, _SettingLevel.SettingLevel.ROOM, _SettingLevel.SettingLevel.CONFIG, _SettingLevel.SettingLevel.DEFAULT];
exports.LEVEL_ORDER = LEVEL_ORDER;
function getLevelOrder(setting) {
  // Settings which support only a single setting level are inherently ordered
  if (setting.supportedLevelsAreOrdered || setting.supportedLevels.length === 1) {
    // return a copy to prevent callers from modifying the array
    return [...setting.supportedLevels];
  }
  return LEVEL_ORDER;
}
/**
 * Controls and manages application settings by providing varying levels at which the
 * setting value may be specified. The levels are then used to determine what the setting
 * value should be given a set of circumstances. The levels, in priority order, are:
 * - SettingLevel.DEVICE         - Values are determined by the current device
 * - SettingLevel.ROOM_DEVICE    - Values are determined by the current device for a particular room
 * - SettingLevel.ROOM_ACCOUNT   - Values are determined by the current account for a particular room
 * - SettingLevel.ACCOUNT        - Values are determined by the current account
 * - SettingLevel.ROOM           - Values are determined by a particular room (by the room admins)
 * - SettingLevel.CONFIG         - Values are determined by the config.json
 * - SettingLevel.DEFAULT        - Values are determined by the hardcoded defaults
 *
 * Each level has a different method to storing the setting value. For implementation
 * specific details, please see the handlers. The "config" and "default" levels are
 * both always supported on all platforms. All other settings should be guarded by
 * isLevelSupported() prior to attempting to set the value.
 *
 * Settings can also represent features. Features are significant portions of the
 * application that warrant a dedicated setting to toggle them on or off. Features are
 * special-cased to ensure that their values respect the configuration (for example, a
 * feature may be reported as disabled even though a user has specifically requested it
 * be enabled).
 */
class SettingsStore {
  /**
   * Gets all the feature-style setting names.
   * @returns {string[]} The names of the feature settings.
   */
  static getFeatureSettingNames() {
    return Object.keys(_Settings.SETTINGS).filter(n => SettingsStore.isFeature(n));
  }

  /**
   * Watches for changes in a particular setting. This is done without any local echo
   * wrapping and fires whenever a change is detected in a setting's value, at any level.
   * Watching is intended to be used in scenarios where the app needs to react to changes
   * made by other devices. It is otherwise expected that callers will be able to use the
   * Controller system or track their own changes to settings. Callers should retain the
   * returned reference to later unsubscribe from updates.
   * @param {string} settingName The setting name to watch
   * @param {String} roomId The room ID to watch for changes in. May be null for 'all'.
   * @param {function} callbackFn A function to be called when a setting change is
   * detected. Five arguments can be expected: the setting name, the room ID (may be null),
   * the level the change happened at, the new value at the given level, and finally the new
   * value for the setting regardless of level. The callback is responsible for determining
   * if the change in value is worthwhile enough to react upon.
   * @returns {string} A reference to the watcher that was employed.
   */
  static watchSetting(settingName, roomId, callbackFn) {
    const setting = _Settings.SETTINGS[settingName];
    const originalSettingName = settingName;
    if (!setting) throw new Error(`${settingName} is not a setting`);
    if (setting.invertedSettingName) {
      settingName = setting.invertedSettingName;
    }
    const watcherId = `${new Date().getTime()}_${SettingsStore.watcherCount++}_${settingName}_${roomId}`;
    const localizedCallback = (changedInRoomId, atLevel, newValAtLevel) => {
      if (!SettingsStore.doesSettingSupportLevel(originalSettingName, atLevel)) {
        _logger.logger.warn(`Setting handler notified for an update of an invalid setting level: ` + `${originalSettingName}@${atLevel} - this likely means a weird setting value ` + `made it into the level's storage. The notification will be ignored.`);
        return;
      }
      const newValue = SettingsStore.getValue(originalSettingName);
      const newValueAtLevel = SettingsStore.getValueAt(atLevel, originalSettingName) ?? newValAtLevel;
      callbackFn(originalSettingName, changedInRoomId, atLevel, newValueAtLevel, newValue);
    };
    SettingsStore.watchers.set(watcherId, localizedCallback);
    _Settings.defaultWatchManager.watchSetting(settingName, roomId, localizedCallback);
    return watcherId;
  }

  /**
   * Stops the SettingsStore from watching a setting. This is a no-op if the watcher
   * provided is not found.
   * @param {string} watcherReference The watcher reference (received from #watchSetting)
   * to cancel.
   */
  static unwatchSetting(watcherReference) {
    if (!SettingsStore.watchers.has(watcherReference)) {
      _logger.logger.warn(`Ending non-existent watcher ID ${watcherReference}`);
      return;
    }
    _Settings.defaultWatchManager.unwatchSetting(SettingsStore.watchers.get(watcherReference));
    SettingsStore.watchers.delete(watcherReference);
  }

  /**
   * Sets up a monitor for a setting. This behaves similar to #watchSetting except instead
   * of making a call to a callback, it forwards all changes to the dispatcher. Callers can
   * expect to listen for the 'setting_updated' action with an object containing settingName,
   * roomId, level, newValueAtLevel, and newValue.
   * @param {string} settingName The setting name to monitor.
   * @param {String} roomId The room ID to monitor for changes in. Use null for all rooms.
   */
  static monitorSetting(settingName, roomId) {
    roomId = roomId || null; // the thing wants null specifically to work, so appease it.

    if (!this.monitors.has(settingName)) this.monitors.set(settingName, new Map());
    const registerWatcher = () => {
      this.monitors.get(settingName).set(roomId, SettingsStore.watchSetting(settingName, roomId, (settingName, inRoomId, level, newValueAtLevel, newValue) => {
        _dispatcher.default.dispatch({
          action: _actions.Action.SettingUpdated,
          settingName,
          roomId: inRoomId,
          level,
          newValueAtLevel,
          newValue
        });
      }));
    };
    const rooms = Array.from(this.monitors.get(settingName).keys());
    const hasRoom = rooms.find(r => r === roomId || r === null);
    if (!hasRoom) {
      registerWatcher();
    } else {
      if (roomId === null) {
        // Unregister all existing watchers and register the new one
        rooms.forEach(roomId => {
          SettingsStore.unwatchSetting(this.monitors.get(settingName).get(roomId));
        });
        this.monitors.get(settingName).clear();
        registerWatcher();
      } // else a watcher is already registered for the room, so don't bother registering it again
    }
  }

  /**
   * Gets the translated display name for a given setting
   * @param {string} settingName The setting to look up.
   * @param {SettingLevel} atLevel
   * The level to get the display name for; Defaults to 'default'.
   * @return {String} The display name for the setting, or null if not found.
   */
  static getDisplayName(settingName) {
    let atLevel = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : _SettingLevel.SettingLevel.DEFAULT;
    if (!_Settings.SETTINGS[settingName] || !_Settings.SETTINGS[settingName].displayName) return null;
    let displayName = _Settings.SETTINGS[settingName].displayName;
    if (displayName instanceof Object) {
      if (displayName[atLevel]) displayName = displayName[atLevel];else displayName = displayName["default"];
    }
    return (0, _languageHandler._t)(displayName);
  }

  /**
   * Gets the translated description for a given setting
   * @param {string} settingName The setting to look up.
   * @return {String} The description for the setting, or null if not found.
   */
  static getDescription(settingName) {
    const description = _Settings.SETTINGS[settingName]?.description;
    if (!description) return null;
    if (typeof description !== "string") return description();
    return (0, _languageHandler._t)(description);
  }

  /**
   * Determines if a setting is also a feature.
   * @param {string} settingName The setting to look up.
   * @return {boolean} True if the setting is a feature.
   */
  static isFeature(settingName) {
    if (!_Settings.SETTINGS[settingName]) return false;
    return !!_Settings.SETTINGS[settingName].isFeature;
  }

  /**
   * Determines if a setting should have a warning sign in the microcopy
   * @param {string} settingName The setting to look up.
   * @return {boolean} True if the setting should have a warning sign.
   */
  static shouldHaveWarning(settingName) {
    if (!_Settings.SETTINGS[settingName]) return false;
    return _Settings.SETTINGS[settingName].shouldWarn ?? false;
  }
  static getBetaInfo(settingName) {
    // consider a beta disabled if the config is explicitly set to false, in which case treat as normal Labs flag
    if (SettingsStore.isFeature(settingName) && SettingsStore.getValueAt(_SettingLevel.SettingLevel.CONFIG, settingName, null, true, true) !== false) {
      return _Settings.SETTINGS[settingName]?.betaInfo;
    }
  }
  static getLabGroup(settingName) {
    if (SettingsStore.isFeature(settingName)) {
      return _Settings.SETTINGS[settingName].labsGroup;
    }
  }

  /**
   * Determines if a setting is enabled.
   * If a setting is disabled then it should normally be hidden from the user to de-clutter the user interface.
   * This rule is intentionally ignored for labs flags to unveil what features are available with
   * the right server support.
   * @param {string} settingName The setting to look up.
   * @return {boolean} True if the setting is enabled.
   */
  static isEnabled(settingName) {
    if (!_Settings.SETTINGS[settingName]) return false;
    return !_Settings.SETTINGS[settingName].controller?.settingDisabled ?? true;
  }

  /**
   * Retrieves the reason a setting is disabled if one is assigned.
   * If a setting is not disabled, or no reason is given by the `SettingController`,
   * this will return undefined.
   * @param {string} settingName The setting to look up.
   * @return {string} The reason the setting is disabled.
   */
  static disabledMessage(settingName) {
    const disabled = _Settings.SETTINGS[settingName].controller?.settingDisabled;
    return typeof disabled === "string" ? disabled : undefined;
  }

  /**
   * Gets the value of a setting. The room ID is optional if the setting is not to
   * be applied to any particular room, otherwise it should be supplied.
   * @param {string} settingName The name of the setting to read the value of.
   * @param {String} roomId The room ID to read the setting value in, may be null.
   * @param {boolean} excludeDefault True to disable using the default value.
   * @return {*} The value, or null if not found
   */
  static getValue(settingName) {
    let roomId = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    let excludeDefault = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
    // Verify that the setting is actually a setting
    if (!_Settings.SETTINGS[settingName]) {
      throw new Error("Setting '" + settingName + "' does not appear to be a setting.");
    }
    const setting = _Settings.SETTINGS[settingName];
    const levelOrder = getLevelOrder(setting);
    return SettingsStore.getValueAt(levelOrder[0], settingName, roomId, false, excludeDefault);
  }

  /**
   * Gets a setting's value at a particular level, ignoring all levels that are more specific.
   * @param {SettingLevel|"config"|"default"} level The
   * level to look at.
   * @param {string} settingName The name of the setting to read.
   * @param {String} roomId The room ID to read the setting value in, may be null.
   * @param {boolean} explicit If true, this method will not consider other levels, just the one
   * provided. Defaults to false.
   * @param {boolean} excludeDefault True to disable using the default value.
   * @return {*} The value, or null if not found.
   */
  static getValueAt(level, settingName) {
    let roomId = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
    let explicit = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
    let excludeDefault = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
    // Verify that the setting is actually a setting
    const setting = _Settings.SETTINGS[settingName];
    if (!setting) {
      throw new Error("Setting '" + settingName + "' does not appear to be a setting.");
    }
    const levelOrder = getLevelOrder(setting);
    if (!levelOrder.includes(_SettingLevel.SettingLevel.DEFAULT)) levelOrder.push(_SettingLevel.SettingLevel.DEFAULT); // always include default

    const minIndex = levelOrder.indexOf(level);
    if (minIndex === -1) throw new Error(`Level "${level}" for setting "${settingName}" is not prioritized`);
    const handlers = SettingsStore.getHandlers(settingName);

    // Check if we need to invert the setting at all. Do this after we get the setting
    // handlers though, otherwise we'll fail to read the value.
    if (setting.invertedSettingName) {
      //console.warn(`Inverting ${settingName} to be ${setting.invertedSettingName} - legacy setting`);
      settingName = setting.invertedSettingName;
    }
    if (explicit) {
      const handler = handlers[level];
      if (!handler) {
        return SettingsStore.getFinalValue(setting, level, roomId, null, null);
      }
      const value = handler.getValue(settingName, roomId);
      return SettingsStore.getFinalValue(setting, level, roomId, value, level);
    }
    for (let i = minIndex; i < levelOrder.length; i++) {
      const handler = handlers[levelOrder[i]];
      if (!handler) continue;
      if (excludeDefault && levelOrder[i] === "default") continue;
      const value = handler.getValue(settingName, roomId);
      if (value === null || value === undefined) continue;
      return SettingsStore.getFinalValue(setting, level, roomId, value, levelOrder[i]);
    }
    return SettingsStore.getFinalValue(setting, level, roomId, null, null);
  }

  /**
   * Gets the default value of a setting.
   * @param {string} settingName The name of the setting to read the value of.
   * @param {String} roomId The room ID to read the setting value in, may be null.
   * @return {*} The default value
   */
  static getDefaultValue(settingName) {
    // Verify that the setting is actually a setting
    if (!_Settings.SETTINGS[settingName]) {
      throw new Error("Setting '" + settingName + "' does not appear to be a setting.");
    }
    return _Settings.SETTINGS[settingName].default;
  }
  static getFinalValue(setting, level, roomId, calculatedValue, calculatedAtLevel) {
    let resultingValue = calculatedValue;
    if (setting.controller) {
      const actualValue = setting.controller.getValueOverride(level, roomId, calculatedValue, calculatedAtLevel);
      if (actualValue !== undefined && actualValue !== null) resultingValue = actualValue;
    }
    if (setting.invertedSettingName) resultingValue = !resultingValue;
    return resultingValue;
  }

  /* eslint-disable valid-jsdoc */ //https://github.com/eslint/eslint/issues/7307
  /**
   * Sets the value for a setting. The room ID is optional if the setting is not being
   * set for a particular room, otherwise it should be supplied. The value may be null
   * to indicate that the level should no longer have an override.
   * @param {string} settingName The name of the setting to change.
   * @param {String} roomId The room ID to change the value in, may be null.
   * @param {SettingLevel} level The level
   * to change the value at.
   * @param {*} value The new value of the setting, may be null.
   * @return {Promise} Resolves when the setting has been changed.
   */

  /* eslint-enable valid-jsdoc */
  static async setValue(settingName, roomId, level, value) {
    // Verify that the setting is actually a setting
    const setting = _Settings.SETTINGS[settingName];
    if (!setting) {
      throw new Error("Setting '" + settingName + "' does not appear to be a setting.");
    }
    const handler = SettingsStore.getHandler(settingName, level);
    if (!handler) {
      throw new Error("Setting " + settingName + " does not have a handler for " + level);
    }
    if (setting.invertedSettingName) {
      // Note: We can't do this when the `level` is "default", however we also
      // know that the user can't possible change the default value through this
      // function so we don't bother checking it.
      //console.warn(`Inverting ${settingName} to be ${setting.invertedSettingName} - legacy setting`);
      settingName = setting.invertedSettingName;
      value = !value;
    }
    if (!handler.canSetValue(settingName, roomId)) {
      throw new Error("User cannot set " + settingName + " at " + level + " in " + roomId);
    }
    if (setting.controller && !(await setting.controller.beforeChange(level, roomId, value))) {
      return; // controller says no
    }

    await handler.setValue(settingName, roomId, value);
    setting.controller?.onChange(level, roomId, value);
  }

  /**
   * Determines if the current user is permitted to set the given setting at the given
   * level for a particular room. The room ID is optional if the setting is not being
   * set for a particular room, otherwise it should be supplied.
   * @param {string} settingName The name of the setting to check.
   * @param {String} roomId The room ID to check in, may be null.
   * @param {SettingLevel} level The level to
   * check at.
   * @return {boolean} True if the user may set the setting, false otherwise.
   */
  static canSetValue(settingName, roomId, level) {
    // Verify that the setting is actually a setting
    if (!_Settings.SETTINGS[settingName]) {
      throw new Error("Setting '" + settingName + "' does not appear to be a setting.");
    }
    if (!SettingsStore.isEnabled(settingName)) {
      return false;
    }

    // When non-beta features are specified in the config.json, we force them as enabled or disabled.
    if (SettingsStore.isFeature(settingName) && !_Settings.SETTINGS[settingName]?.betaInfo) {
      const configVal = SettingsStore.getValueAt(_SettingLevel.SettingLevel.CONFIG, settingName, roomId, true, true);
      if (configVal === true || configVal === false) return false;
    }
    const handler = SettingsStore.getHandler(settingName, level);
    if (!handler) return false;
    return handler.canSetValue(settingName, roomId);
  }

  /**
   * Determines if the given level is supported on this device.
   * @param {SettingLevel} level The level
   * to check the feasibility of.
   * @return {boolean} True if the level is supported, false otherwise.
   */
  static isLevelSupported(level) {
    if (!LEVEL_HANDLERS[level]) return false;
    return LEVEL_HANDLERS[level].isSupported();
  }

  /**
   * Determines if a setting supports a particular level.
   * @param settingName The setting name.
   * @param level The level.
   * @returns True if supported, false otherwise. Note that this will not check to see if
   * the level itself can be supported by the runtime (ie: you will need to call #isLevelSupported()
   * on your own).
   */
  static doesSettingSupportLevel(settingName, level) {
    const setting = _Settings.SETTINGS[settingName];
    if (!setting) {
      throw new Error("Setting '" + settingName + "' does not appear to be a setting.");
    }
    return level === _SettingLevel.SettingLevel.DEFAULT || !!setting.supportedLevels?.includes(level);
  }

  /**
   * Determines the first supported level out of all the levels that can be used for a
   * specific setting.
   * @param {string} settingName The setting name.
   * @return {SettingLevel}
   */
  static firstSupportedLevel(settingName) {
    // Verify that the setting is actually a setting
    const setting = _Settings.SETTINGS[settingName];
    if (!setting) {
      throw new Error("Setting '" + settingName + "' does not appear to be a setting.");
    }
    const levelOrder = getLevelOrder(setting);
    if (!levelOrder.includes(_SettingLevel.SettingLevel.DEFAULT)) levelOrder.push(_SettingLevel.SettingLevel.DEFAULT); // always include default

    const handlers = SettingsStore.getHandlers(settingName);
    for (const level of levelOrder) {
      const handler = handlers[level];
      if (!handler) continue;
      return level;
    }
    return null;
  }

  /**
   * Runs or queues any setting migrations needed.
   */
  static runMigrations() {
    // Dev notes: to add your migration, just add a new `migrateMyFeature` function, call it, and
    // add a comment to note when it can be removed.

    SettingsStore.migrateHiddenReadReceipts(); // Can be removed after October 2022.
  }

  static migrateHiddenReadReceipts() {
    if (_MatrixClientPeg.MatrixClientPeg.get().isGuest()) return; // not worth it

    // We wait for the first sync to ensure that the user's existing account data has loaded, as otherwise
    // getValue() for an account-level setting like sendReadReceipts will return `null`.
    const disRef = _dispatcher.default.register(payload => {
      if (payload.action === "MatrixActions.sync") {
        _dispatcher.default.unregister(disRef);
        const rrVal = SettingsStore.getValue("sendReadReceipts", null, true);
        if (typeof rrVal !== "boolean") {
          // new setting isn't set - see if the labs flag was. We have to manually reach into the
          // handler for this because it isn't a setting anymore (`getValue` will yell at us).
          const handler = LEVEL_HANDLERS[_SettingLevel.SettingLevel.DEVICE];
          const labsVal = handler.readFeature("feature_hidden_read_receipts");
          if (typeof labsVal === "boolean") {
            // Inverse of labs flag because negative->positive language switch in setting name
            const newVal = !labsVal;
            console.log(`Setting sendReadReceipts to ${newVal} because of previously-set labs flag`);

            // noinspection JSIgnoredPromiseFromCall
            SettingsStore.setValue("sendReadReceipts", null, _SettingLevel.SettingLevel.ACCOUNT, newVal);
          }
        }
      }
    });
  }

  /**
   * Debugging function for reading explicit setting values without going through the
   * complicated/biased functions in the SettingsStore. This will print information to
   * the console for analysis. Not intended to be used within the application.
   * @param {string} realSettingName The setting name to try and read.
   * @param {string} roomId Optional room ID to test the setting in.
   */
  static debugSetting(realSettingName, roomId) {
    _logger.logger.log(`--- DEBUG ${realSettingName}`);

    // Note: we intentionally use JSON.stringify here to avoid the console masking the
    // problem if there's a type representation issue. Also, this way it is guaranteed
    // to show up in a rageshake if required.

    const def = _Settings.SETTINGS[realSettingName];
    _logger.logger.log(`--- definition: ${def ? JSON.stringify(def) : "<NOT_FOUND>"}`);
    _logger.logger.log(`--- default level order: ${JSON.stringify(LEVEL_ORDER)}`);
    _logger.logger.log(`--- registered handlers: ${JSON.stringify(Object.keys(LEVEL_HANDLERS))}`);
    const doChecks = settingName => {
      for (const handlerName of Object.keys(LEVEL_HANDLERS)) {
        const handler = LEVEL_HANDLERS[handlerName];
        try {
          const value = handler.getValue(settingName, roomId);
          _logger.logger.log(`---     ${handlerName}@${roomId || "<no_room>"} = ${JSON.stringify(value)}`);
        } catch (e) {
          _logger.logger.log(`---     ${handler.constructor.name}@${roomId || "<no_room>"} THREW ERROR: ${e.message}`);
          _logger.logger.error(e);
        }
        if (roomId) {
          try {
            const value = handler.getValue(settingName, null);
            _logger.logger.log(`---     ${handlerName}@<no_room> = ${JSON.stringify(value)}`);
          } catch (e) {
            _logger.logger.log(`---     ${handler.constructor.name}@<no_room> THREW ERROR: ${e.message}`);
            _logger.logger.error(e);
          }
        }
      }
      _logger.logger.log(`--- calculating as returned by SettingsStore`);
      _logger.logger.log(`--- these might not match if the setting uses a controller - be warned!`);
      try {
        const value = SettingsStore.getValue(settingName, roomId);
        _logger.logger.log(`---     SettingsStore#generic@${roomId || "<no_room>"}  = ${JSON.stringify(value)}`);
      } catch (e) {
        _logger.logger.log(`---     SettingsStore#generic@${roomId || "<no_room>"} THREW ERROR: ${e.message}`);
        _logger.logger.error(e);
      }
      if (roomId) {
        try {
          const value = SettingsStore.getValue(settingName, null);
          _logger.logger.log(`---     SettingsStore#generic@<no_room>  = ${JSON.stringify(value)}`);
        } catch (e) {
          _logger.logger.log(`---     SettingsStore#generic@$<no_room> THREW ERROR: ${e.message}`);
          _logger.logger.error(e);
        }
      }
      for (const level of LEVEL_ORDER) {
        try {
          const value = SettingsStore.getValueAt(level, settingName, roomId);
          _logger.logger.log(`---     SettingsStore#${level}@${roomId || "<no_room>"} = ${JSON.stringify(value)}`);
        } catch (e) {
          _logger.logger.log(`---     SettingsStore#${level}@${roomId || "<no_room>"} THREW ERROR: ${e.message}`);
          _logger.logger.error(e);
        }
        if (roomId) {
          try {
            const value = SettingsStore.getValueAt(level, settingName, null);
            _logger.logger.log(`---     SettingsStore#${level}@<no_room> = ${JSON.stringify(value)}`);
          } catch (e) {
            _logger.logger.log(`---     SettingsStore#${level}@$<no_room> THREW ERROR: ${e.message}`);
            _logger.logger.error(e);
          }
        }
      }
    };
    doChecks(realSettingName);
    if (def.invertedSettingName) {
      _logger.logger.log(`--- TESTING INVERTED SETTING NAME`);
      _logger.logger.log(`--- inverted: ${def.invertedSettingName}`);
      doChecks(def.invertedSettingName);
    }
    _logger.logger.log(`--- END DEBUG`);
  }
  static getHandler(settingName, level) {
    const handlers = SettingsStore.getHandlers(settingName);
    if (!handlers[level]) return null;
    return handlers[level];
  }
  static getHandlers(settingName) {
    if (!_Settings.SETTINGS[settingName]) return {};
    const handlers = {};
    for (const level of _Settings.SETTINGS[settingName].supportedLevels) {
      if (!LEVEL_HANDLERS[level]) throw new Error("Unexpected level " + level);
      if (SettingsStore.isLevelSupported(level)) handlers[level] = LEVEL_HANDLERS[level];
    }

    // Always support 'default'
    if (!handlers["default"]) handlers["default"] = LEVEL_HANDLERS["default"];
    return handlers;
  }
}

// For debugging purposes
exports.default = SettingsStore;
// We support watching settings for changes, and do this by tracking which callbacks have
// been given to us. We end up returning the callbackRef to the caller so they can unsubscribe
// at a later point.
//
// We also maintain a list of monitors which are special watchers: they cause dispatches
// when the setting changes. We track which rooms we're monitoring though to ensure we
// don't duplicate updates on the bus.
(0, _defineProperty2.default)(SettingsStore, "watchers", new Map());
(0, _defineProperty2.default)(SettingsStore, "monitors", new Map());
// { settingName => { roomId => callbackRef } }
// Counter used for generation of watcher IDs
(0, _defineProperty2.default)(SettingsStore, "watcherCount", 1);
window.mxSettingsStore = SettingsStore;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfbG9nZ2VyIiwicmVxdWlyZSIsIl9EZXZpY2VTZXR0aW5nc0hhbmRsZXIiLCJfaW50ZXJvcFJlcXVpcmVEZWZhdWx0IiwiX1Jvb21EZXZpY2VTZXR0aW5nc0hhbmRsZXIiLCJfRGVmYXVsdFNldHRpbmdzSGFuZGxlciIsIl9Sb29tQWNjb3VudFNldHRpbmdzSGFuZGxlciIsIl9BY2NvdW50U2V0dGluZ3NIYW5kbGVyIiwiX1Jvb21TZXR0aW5nc0hhbmRsZXIiLCJfQ29uZmlnU2V0dGluZ3NIYW5kbGVyIiwiX2xhbmd1YWdlSGFuZGxlciIsIl9kaXNwYXRjaGVyIiwiX1NldHRpbmdzIiwiX0xvY2FsRWNob1dyYXBwZXIiLCJfU2V0dGluZ0xldmVsIiwiX2FjdGlvbnMiLCJfUGxhdGZvcm1TZXR0aW5nc0hhbmRsZXIiLCJfTWF0cml4Q2xpZW50UGVnIiwiZGVmYXVsdFNldHRpbmdzIiwiaW52ZXJ0ZWREZWZhdWx0U2V0dGluZ3MiLCJmZWF0dXJlTmFtZXMiLCJrZXkiLCJTRVRUSU5HUyIsInNldHRpbmciLCJkZWZhdWx0IiwiaXNGZWF0dXJlIiwicHVzaCIsImludmVydGVkU2V0dGluZ05hbWUiLCJMRVZFTF9IQU5ETEVSUyIsIlNldHRpbmdMZXZlbCIsIkRFVklDRSIsIkRldmljZVNldHRpbmdzSGFuZGxlciIsImRlZmF1bHRXYXRjaE1hbmFnZXIiLCJST09NX0RFVklDRSIsIlJvb21EZXZpY2VTZXR0aW5nc0hhbmRsZXIiLCJST09NX0FDQ09VTlQiLCJMb2NhbEVjaG9XcmFwcGVyIiwiUm9vbUFjY291bnRTZXR0aW5nc0hhbmRsZXIiLCJBQ0NPVU5UIiwiQWNjb3VudFNldHRpbmdzSGFuZGxlciIsIlJPT00iLCJSb29tU2V0dGluZ3NIYW5kbGVyIiwiUExBVEZPUk0iLCJQbGF0Zm9ybVNldHRpbmdzSGFuZGxlciIsIkNPTkZJRyIsIkNvbmZpZ1NldHRpbmdzSGFuZGxlciIsIkRFRkFVTFQiLCJEZWZhdWx0U2V0dGluZ3NIYW5kbGVyIiwiTEVWRUxfT1JERVIiLCJleHBvcnRzIiwiZ2V0TGV2ZWxPcmRlciIsInN1cHBvcnRlZExldmVsc0FyZU9yZGVyZWQiLCJzdXBwb3J0ZWRMZXZlbHMiLCJsZW5ndGgiLCJTZXR0aW5nc1N0b3JlIiwiZ2V0RmVhdHVyZVNldHRpbmdOYW1lcyIsIk9iamVjdCIsImtleXMiLCJmaWx0ZXIiLCJuIiwid2F0Y2hTZXR0aW5nIiwic2V0dGluZ05hbWUiLCJyb29tSWQiLCJjYWxsYmFja0ZuIiwib3JpZ2luYWxTZXR0aW5nTmFtZSIsIkVycm9yIiwid2F0Y2hlcklkIiwiRGF0ZSIsImdldFRpbWUiLCJ3YXRjaGVyQ291bnQiLCJsb2NhbGl6ZWRDYWxsYmFjayIsImNoYW5nZWRJblJvb21JZCIsImF0TGV2ZWwiLCJuZXdWYWxBdExldmVsIiwiZG9lc1NldHRpbmdTdXBwb3J0TGV2ZWwiLCJsb2dnZXIiLCJ3YXJuIiwibmV3VmFsdWUiLCJnZXRWYWx1ZSIsIm5ld1ZhbHVlQXRMZXZlbCIsImdldFZhbHVlQXQiLCJ3YXRjaGVycyIsInNldCIsInVud2F0Y2hTZXR0aW5nIiwid2F0Y2hlclJlZmVyZW5jZSIsImhhcyIsImdldCIsImRlbGV0ZSIsIm1vbml0b3JTZXR0aW5nIiwibW9uaXRvcnMiLCJNYXAiLCJyZWdpc3RlcldhdGNoZXIiLCJpblJvb21JZCIsImxldmVsIiwiZGlzIiwiZGlzcGF0Y2giLCJhY3Rpb24iLCJBY3Rpb24iLCJTZXR0aW5nVXBkYXRlZCIsInJvb21zIiwiQXJyYXkiLCJmcm9tIiwiaGFzUm9vbSIsImZpbmQiLCJyIiwiZm9yRWFjaCIsImNsZWFyIiwiZ2V0RGlzcGxheU5hbWUiLCJhcmd1bWVudHMiLCJ1bmRlZmluZWQiLCJkaXNwbGF5TmFtZSIsIl90IiwiZ2V0RGVzY3JpcHRpb24iLCJkZXNjcmlwdGlvbiIsInNob3VsZEhhdmVXYXJuaW5nIiwic2hvdWxkV2FybiIsImdldEJldGFJbmZvIiwiYmV0YUluZm8iLCJnZXRMYWJHcm91cCIsImxhYnNHcm91cCIsImlzRW5hYmxlZCIsImNvbnRyb2xsZXIiLCJzZXR0aW5nRGlzYWJsZWQiLCJkaXNhYmxlZE1lc3NhZ2UiLCJkaXNhYmxlZCIsImV4Y2x1ZGVEZWZhdWx0IiwibGV2ZWxPcmRlciIsImV4cGxpY2l0IiwiaW5jbHVkZXMiLCJtaW5JbmRleCIsImluZGV4T2YiLCJoYW5kbGVycyIsImdldEhhbmRsZXJzIiwiaGFuZGxlciIsImdldEZpbmFsVmFsdWUiLCJ2YWx1ZSIsImkiLCJnZXREZWZhdWx0VmFsdWUiLCJjYWxjdWxhdGVkVmFsdWUiLCJjYWxjdWxhdGVkQXRMZXZlbCIsInJlc3VsdGluZ1ZhbHVlIiwiYWN0dWFsVmFsdWUiLCJnZXRWYWx1ZU92ZXJyaWRlIiwic2V0VmFsdWUiLCJnZXRIYW5kbGVyIiwiY2FuU2V0VmFsdWUiLCJiZWZvcmVDaGFuZ2UiLCJvbkNoYW5nZSIsImNvbmZpZ1ZhbCIsImlzTGV2ZWxTdXBwb3J0ZWQiLCJpc1N1cHBvcnRlZCIsImZpcnN0U3VwcG9ydGVkTGV2ZWwiLCJydW5NaWdyYXRpb25zIiwibWlncmF0ZUhpZGRlblJlYWRSZWNlaXB0cyIsIk1hdHJpeENsaWVudFBlZyIsImlzR3Vlc3QiLCJkaXNSZWYiLCJkaXNwYXRjaGVyIiwicmVnaXN0ZXIiLCJwYXlsb2FkIiwidW5yZWdpc3RlciIsInJyVmFsIiwibGFic1ZhbCIsInJlYWRGZWF0dXJlIiwibmV3VmFsIiwiY29uc29sZSIsImxvZyIsImRlYnVnU2V0dGluZyIsInJlYWxTZXR0aW5nTmFtZSIsImRlZiIsIkpTT04iLCJzdHJpbmdpZnkiLCJkb0NoZWNrcyIsImhhbmRsZXJOYW1lIiwiZSIsImNvbnN0cnVjdG9yIiwibmFtZSIsIm1lc3NhZ2UiLCJlcnJvciIsIl9kZWZpbmVQcm9wZXJ0eTIiLCJ3aW5kb3ciLCJteFNldHRpbmdzU3RvcmUiXSwic291cmNlcyI6WyIuLi8uLi9zcmMvc2V0dGluZ3MvU2V0dGluZ3NTdG9yZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuQ29weXJpZ2h0IDIwMTcgVHJhdmlzIFJhbHN0b25cbkNvcHlyaWdodCAyMDE5LCAyMDIwIFRoZSBNYXRyaXgub3JnIEZvdW5kYXRpb24gQy5JLkMuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuKi9cblxuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL2xvZ2dlclwiO1xuaW1wb3J0IHsgUmVhY3ROb2RlIH0gZnJvbSBcInJlYWN0XCI7XG5cbmltcG9ydCBEZXZpY2VTZXR0aW5nc0hhbmRsZXIgZnJvbSBcIi4vaGFuZGxlcnMvRGV2aWNlU2V0dGluZ3NIYW5kbGVyXCI7XG5pbXBvcnQgUm9vbURldmljZVNldHRpbmdzSGFuZGxlciBmcm9tIFwiLi9oYW5kbGVycy9Sb29tRGV2aWNlU2V0dGluZ3NIYW5kbGVyXCI7XG5pbXBvcnQgRGVmYXVsdFNldHRpbmdzSGFuZGxlciBmcm9tIFwiLi9oYW5kbGVycy9EZWZhdWx0U2V0dGluZ3NIYW5kbGVyXCI7XG5pbXBvcnQgUm9vbUFjY291bnRTZXR0aW5nc0hhbmRsZXIgZnJvbSBcIi4vaGFuZGxlcnMvUm9vbUFjY291bnRTZXR0aW5nc0hhbmRsZXJcIjtcbmltcG9ydCBBY2NvdW50U2V0dGluZ3NIYW5kbGVyIGZyb20gXCIuL2hhbmRsZXJzL0FjY291bnRTZXR0aW5nc0hhbmRsZXJcIjtcbmltcG9ydCBSb29tU2V0dGluZ3NIYW5kbGVyIGZyb20gXCIuL2hhbmRsZXJzL1Jvb21TZXR0aW5nc0hhbmRsZXJcIjtcbmltcG9ydCBDb25maWdTZXR0aW5nc0hhbmRsZXIgZnJvbSBcIi4vaGFuZGxlcnMvQ29uZmlnU2V0dGluZ3NIYW5kbGVyXCI7XG5pbXBvcnQgeyBfdCB9IGZyb20gXCIuLi9sYW5ndWFnZUhhbmRsZXJcIjtcbmltcG9ydCBkaXMgZnJvbSBcIi4uL2Rpc3BhdGNoZXIvZGlzcGF0Y2hlclwiO1xuaW1wb3J0IHsgSUZlYXR1cmUsIElTZXR0aW5nLCBMYWJHcm91cCwgU0VUVElOR1MsIGRlZmF1bHRXYXRjaE1hbmFnZXIgfSBmcm9tIFwiLi9TZXR0aW5nc1wiO1xuaW1wb3J0IExvY2FsRWNob1dyYXBwZXIgZnJvbSBcIi4vaGFuZGxlcnMvTG9jYWxFY2hvV3JhcHBlclwiO1xuaW1wb3J0IHsgQ2FsbGJhY2tGbiBhcyBXYXRjaENhbGxiYWNrRm4gfSBmcm9tIFwiLi9XYXRjaE1hbmFnZXJcIjtcbmltcG9ydCB7IFNldHRpbmdMZXZlbCB9IGZyb20gXCIuL1NldHRpbmdMZXZlbFwiO1xuaW1wb3J0IFNldHRpbmdzSGFuZGxlciBmcm9tIFwiLi9oYW5kbGVycy9TZXR0aW5nc0hhbmRsZXJcIjtcbmltcG9ydCB7IFNldHRpbmdVcGRhdGVkUGF5bG9hZCB9IGZyb20gXCIuLi9kaXNwYXRjaGVyL3BheWxvYWRzL1NldHRpbmdVcGRhdGVkUGF5bG9hZFwiO1xuaW1wb3J0IHsgQWN0aW9uIH0gZnJvbSBcIi4uL2Rpc3BhdGNoZXIvYWN0aW9uc1wiO1xuaW1wb3J0IFBsYXRmb3JtU2V0dGluZ3NIYW5kbGVyIGZyb20gXCIuL2hhbmRsZXJzL1BsYXRmb3JtU2V0dGluZ3NIYW5kbGVyXCI7XG5pbXBvcnQgZGlzcGF0Y2hlciBmcm9tIFwiLi4vZGlzcGF0Y2hlci9kaXNwYXRjaGVyXCI7XG5pbXBvcnQgeyBBY3Rpb25QYXlsb2FkIH0gZnJvbSBcIi4uL2Rpc3BhdGNoZXIvcGF5bG9hZHNcIjtcbmltcG9ydCB7IE1hdHJpeENsaWVudFBlZyB9IGZyb20gXCIuLi9NYXRyaXhDbGllbnRQZWdcIjtcblxuLy8gQ29udmVydCB0aGUgc2V0dGluZ3MgdG8gZWFzaWVyIHRvIG1hbmFnZSBvYmplY3RzIGZvciB0aGUgaGFuZGxlcnNcbmNvbnN0IGRlZmF1bHRTZXR0aW5nczogUmVjb3JkPHN0cmluZywgYW55PiA9IHt9O1xuY29uc3QgaW52ZXJ0ZWREZWZhdWx0U2V0dGluZ3M6IFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+ID0ge307XG5jb25zdCBmZWF0dXJlTmFtZXM6IHN0cmluZ1tdID0gW107XG5mb3IgKGNvbnN0IGtleSBpbiBTRVRUSU5HUykge1xuICAgIGNvbnN0IHNldHRpbmcgPSBTRVRUSU5HU1trZXldO1xuICAgIGRlZmF1bHRTZXR0aW5nc1trZXldID0gc2V0dGluZy5kZWZhdWx0O1xuICAgIGlmIChzZXR0aW5nLmlzRmVhdHVyZSkgZmVhdHVyZU5hbWVzLnB1c2goa2V5KTtcbiAgICBpZiAoc2V0dGluZy5pbnZlcnRlZFNldHRpbmdOYW1lKSB7XG4gICAgICAgIC8vIEludmVydCBub3cgc28gdGhhdCB0aGUgcmVzdCBvZiB0aGUgc3lzdGVtIHdpbGwgaW52ZXJ0IGl0IGJhY2sgdG8gd2hhdCB3YXMgaW50ZW5kZWQuXG4gICAgICAgIGludmVydGVkRGVmYXVsdFNldHRpbmdzW3NldHRpbmcuaW52ZXJ0ZWRTZXR0aW5nTmFtZV0gPSAhc2V0dGluZy5kZWZhdWx0O1xuICAgIH1cbn1cblxuLy8gT25seSB3cmFwIHRoZSBoYW5kbGVycyB3aXRoIGFzeW5jIHNldHRlcnMgaW4gYSBsb2NhbCBlY2hvIHdyYXBwZXJcbmNvbnN0IExFVkVMX0hBTkRMRVJTOiBSZWNvcmQ8U2V0dGluZ0xldmVsLCBTZXR0aW5nc0hhbmRsZXI+ID0ge1xuICAgIFtTZXR0aW5nTGV2ZWwuREVWSUNFXTogbmV3IERldmljZVNldHRpbmdzSGFuZGxlcihmZWF0dXJlTmFtZXMsIGRlZmF1bHRXYXRjaE1hbmFnZXIpLFxuICAgIFtTZXR0aW5nTGV2ZWwuUk9PTV9ERVZJQ0VdOiBuZXcgUm9vbURldmljZVNldHRpbmdzSGFuZGxlcihkZWZhdWx0V2F0Y2hNYW5hZ2VyKSxcbiAgICBbU2V0dGluZ0xldmVsLlJPT01fQUNDT1VOVF06IG5ldyBMb2NhbEVjaG9XcmFwcGVyKFxuICAgICAgICBuZXcgUm9vbUFjY291bnRTZXR0aW5nc0hhbmRsZXIoZGVmYXVsdFdhdGNoTWFuYWdlciksXG4gICAgICAgIFNldHRpbmdMZXZlbC5ST09NX0FDQ09VTlQsXG4gICAgKSxcbiAgICBbU2V0dGluZ0xldmVsLkFDQ09VTlRdOiBuZXcgTG9jYWxFY2hvV3JhcHBlcihuZXcgQWNjb3VudFNldHRpbmdzSGFuZGxlcihkZWZhdWx0V2F0Y2hNYW5hZ2VyKSwgU2V0dGluZ0xldmVsLkFDQ09VTlQpLFxuICAgIFtTZXR0aW5nTGV2ZWwuUk9PTV06IG5ldyBMb2NhbEVjaG9XcmFwcGVyKG5ldyBSb29tU2V0dGluZ3NIYW5kbGVyKGRlZmF1bHRXYXRjaE1hbmFnZXIpLCBTZXR0aW5nTGV2ZWwuUk9PTSksXG4gICAgW1NldHRpbmdMZXZlbC5QTEFURk9STV06IG5ldyBMb2NhbEVjaG9XcmFwcGVyKG5ldyBQbGF0Zm9ybVNldHRpbmdzSGFuZGxlcigpLCBTZXR0aW5nTGV2ZWwuUExBVEZPUk0pLFxuICAgIFtTZXR0aW5nTGV2ZWwuQ09ORklHXTogbmV3IENvbmZpZ1NldHRpbmdzSGFuZGxlcihmZWF0dXJlTmFtZXMpLFxuICAgIFtTZXR0aW5nTGV2ZWwuREVGQVVMVF06IG5ldyBEZWZhdWx0U2V0dGluZ3NIYW5kbGVyKGRlZmF1bHRTZXR0aW5ncywgaW52ZXJ0ZWREZWZhdWx0U2V0dGluZ3MpLFxufTtcblxuZXhwb3J0IGNvbnN0IExFVkVMX09SREVSID0gW1xuICAgIFNldHRpbmdMZXZlbC5ERVZJQ0UsXG4gICAgU2V0dGluZ0xldmVsLlJPT01fREVWSUNFLFxuICAgIFNldHRpbmdMZXZlbC5ST09NX0FDQ09VTlQsXG4gICAgU2V0dGluZ0xldmVsLkFDQ09VTlQsXG4gICAgU2V0dGluZ0xldmVsLlJPT00sXG4gICAgU2V0dGluZ0xldmVsLkNPTkZJRyxcbiAgICBTZXR0aW5nTGV2ZWwuREVGQVVMVCxcbl07XG5cbmZ1bmN0aW9uIGdldExldmVsT3JkZXIoc2V0dGluZzogSVNldHRpbmcpOiBTZXR0aW5nTGV2ZWxbXSB7XG4gICAgLy8gU2V0dGluZ3Mgd2hpY2ggc3VwcG9ydCBvbmx5IGEgc2luZ2xlIHNldHRpbmcgbGV2ZWwgYXJlIGluaGVyZW50bHkgb3JkZXJlZFxuICAgIGlmIChzZXR0aW5nLnN1cHBvcnRlZExldmVsc0FyZU9yZGVyZWQgfHwgc2V0dGluZy5zdXBwb3J0ZWRMZXZlbHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIC8vIHJldHVybiBhIGNvcHkgdG8gcHJldmVudCBjYWxsZXJzIGZyb20gbW9kaWZ5aW5nIHRoZSBhcnJheVxuICAgICAgICByZXR1cm4gWy4uLnNldHRpbmcuc3VwcG9ydGVkTGV2ZWxzXTtcbiAgICB9XG4gICAgcmV0dXJuIExFVkVMX09SREVSO1xufVxuXG5leHBvcnQgdHlwZSBDYWxsYmFja0ZuID0gKFxuICAgIHNldHRpbmdOYW1lOiBzdHJpbmcsXG4gICAgcm9vbUlkOiBzdHJpbmcgfCBudWxsLFxuICAgIGF0TGV2ZWw6IFNldHRpbmdMZXZlbCxcbiAgICBuZXdWYWxBdExldmVsOiBhbnksXG4gICAgbmV3VmFsOiBhbnksXG4pID0+IHZvaWQ7XG5cbnR5cGUgSGFuZGxlck1hcCA9IFBhcnRpYWw8e1xuICAgIFtsZXZlbCBpbiBTZXR0aW5nTGV2ZWxdOiBTZXR0aW5nc0hhbmRsZXI7XG59PjtcblxuLyoqXG4gKiBDb250cm9scyBhbmQgbWFuYWdlcyBhcHBsaWNhdGlvbiBzZXR0aW5ncyBieSBwcm92aWRpbmcgdmFyeWluZyBsZXZlbHMgYXQgd2hpY2ggdGhlXG4gKiBzZXR0aW5nIHZhbHVlIG1heSBiZSBzcGVjaWZpZWQuIFRoZSBsZXZlbHMgYXJlIHRoZW4gdXNlZCB0byBkZXRlcm1pbmUgd2hhdCB0aGUgc2V0dGluZ1xuICogdmFsdWUgc2hvdWxkIGJlIGdpdmVuIGEgc2V0IG9mIGNpcmN1bXN0YW5jZXMuIFRoZSBsZXZlbHMsIGluIHByaW9yaXR5IG9yZGVyLCBhcmU6XG4gKiAtIFNldHRpbmdMZXZlbC5ERVZJQ0UgICAgICAgICAtIFZhbHVlcyBhcmUgZGV0ZXJtaW5lZCBieSB0aGUgY3VycmVudCBkZXZpY2VcbiAqIC0gU2V0dGluZ0xldmVsLlJPT01fREVWSUNFICAgIC0gVmFsdWVzIGFyZSBkZXRlcm1pbmVkIGJ5IHRoZSBjdXJyZW50IGRldmljZSBmb3IgYSBwYXJ0aWN1bGFyIHJvb21cbiAqIC0gU2V0dGluZ0xldmVsLlJPT01fQUNDT1VOVCAgIC0gVmFsdWVzIGFyZSBkZXRlcm1pbmVkIGJ5IHRoZSBjdXJyZW50IGFjY291bnQgZm9yIGEgcGFydGljdWxhciByb29tXG4gKiAtIFNldHRpbmdMZXZlbC5BQ0NPVU5UICAgICAgICAtIFZhbHVlcyBhcmUgZGV0ZXJtaW5lZCBieSB0aGUgY3VycmVudCBhY2NvdW50XG4gKiAtIFNldHRpbmdMZXZlbC5ST09NICAgICAgICAgICAtIFZhbHVlcyBhcmUgZGV0ZXJtaW5lZCBieSBhIHBhcnRpY3VsYXIgcm9vbSAoYnkgdGhlIHJvb20gYWRtaW5zKVxuICogLSBTZXR0aW5nTGV2ZWwuQ09ORklHICAgICAgICAgLSBWYWx1ZXMgYXJlIGRldGVybWluZWQgYnkgdGhlIGNvbmZpZy5qc29uXG4gKiAtIFNldHRpbmdMZXZlbC5ERUZBVUxUICAgICAgICAtIFZhbHVlcyBhcmUgZGV0ZXJtaW5lZCBieSB0aGUgaGFyZGNvZGVkIGRlZmF1bHRzXG4gKlxuICogRWFjaCBsZXZlbCBoYXMgYSBkaWZmZXJlbnQgbWV0aG9kIHRvIHN0b3JpbmcgdGhlIHNldHRpbmcgdmFsdWUuIEZvciBpbXBsZW1lbnRhdGlvblxuICogc3BlY2lmaWMgZGV0YWlscywgcGxlYXNlIHNlZSB0aGUgaGFuZGxlcnMuIFRoZSBcImNvbmZpZ1wiIGFuZCBcImRlZmF1bHRcIiBsZXZlbHMgYXJlXG4gKiBib3RoIGFsd2F5cyBzdXBwb3J0ZWQgb24gYWxsIHBsYXRmb3Jtcy4gQWxsIG90aGVyIHNldHRpbmdzIHNob3VsZCBiZSBndWFyZGVkIGJ5XG4gKiBpc0xldmVsU3VwcG9ydGVkKCkgcHJpb3IgdG8gYXR0ZW1wdGluZyB0byBzZXQgdGhlIHZhbHVlLlxuICpcbiAqIFNldHRpbmdzIGNhbiBhbHNvIHJlcHJlc2VudCBmZWF0dXJlcy4gRmVhdHVyZXMgYXJlIHNpZ25pZmljYW50IHBvcnRpb25zIG9mIHRoZVxuICogYXBwbGljYXRpb24gdGhhdCB3YXJyYW50IGEgZGVkaWNhdGVkIHNldHRpbmcgdG8gdG9nZ2xlIHRoZW0gb24gb3Igb2ZmLiBGZWF0dXJlcyBhcmVcbiAqIHNwZWNpYWwtY2FzZWQgdG8gZW5zdXJlIHRoYXQgdGhlaXIgdmFsdWVzIHJlc3BlY3QgdGhlIGNvbmZpZ3VyYXRpb24gKGZvciBleGFtcGxlLCBhXG4gKiBmZWF0dXJlIG1heSBiZSByZXBvcnRlZCBhcyBkaXNhYmxlZCBldmVuIHRob3VnaCBhIHVzZXIgaGFzIHNwZWNpZmljYWxseSByZXF1ZXN0ZWQgaXRcbiAqIGJlIGVuYWJsZWQpLlxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBTZXR0aW5nc1N0b3JlIHtcbiAgICAvLyBXZSBzdXBwb3J0IHdhdGNoaW5nIHNldHRpbmdzIGZvciBjaGFuZ2VzLCBhbmQgZG8gdGhpcyBieSB0cmFja2luZyB3aGljaCBjYWxsYmFja3MgaGF2ZVxuICAgIC8vIGJlZW4gZ2l2ZW4gdG8gdXMuIFdlIGVuZCB1cCByZXR1cm5pbmcgdGhlIGNhbGxiYWNrUmVmIHRvIHRoZSBjYWxsZXIgc28gdGhleSBjYW4gdW5zdWJzY3JpYmVcbiAgICAvLyBhdCBhIGxhdGVyIHBvaW50LlxuICAgIC8vXG4gICAgLy8gV2UgYWxzbyBtYWludGFpbiBhIGxpc3Qgb2YgbW9uaXRvcnMgd2hpY2ggYXJlIHNwZWNpYWwgd2F0Y2hlcnM6IHRoZXkgY2F1c2UgZGlzcGF0Y2hlc1xuICAgIC8vIHdoZW4gdGhlIHNldHRpbmcgY2hhbmdlcy4gV2UgdHJhY2sgd2hpY2ggcm9vbXMgd2UncmUgbW9uaXRvcmluZyB0aG91Z2ggdG8gZW5zdXJlIHdlXG4gICAgLy8gZG9uJ3QgZHVwbGljYXRlIHVwZGF0ZXMgb24gdGhlIGJ1cy5cbiAgICBwcml2YXRlIHN0YXRpYyB3YXRjaGVycyA9IG5ldyBNYXA8c3RyaW5nLCBXYXRjaENhbGxiYWNrRm4+KCk7XG4gICAgcHJpdmF0ZSBzdGF0aWMgbW9uaXRvcnMgPSBuZXcgTWFwPHN0cmluZywgTWFwPHN0cmluZyB8IG51bGwsIHN0cmluZz4+KCk7IC8vIHsgc2V0dGluZ05hbWUgPT4geyByb29tSWQgPT4gY2FsbGJhY2tSZWYgfSB9XG5cbiAgICAvLyBDb3VudGVyIHVzZWQgZm9yIGdlbmVyYXRpb24gb2Ygd2F0Y2hlciBJRHNcbiAgICBwcml2YXRlIHN0YXRpYyB3YXRjaGVyQ291bnQgPSAxO1xuXG4gICAgLyoqXG4gICAgICogR2V0cyBhbGwgdGhlIGZlYXR1cmUtc3R5bGUgc2V0dGluZyBuYW1lcy5cbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nW119IFRoZSBuYW1lcyBvZiB0aGUgZmVhdHVyZSBzZXR0aW5ncy5cbiAgICAgKi9cbiAgICBwdWJsaWMgc3RhdGljIGdldEZlYXR1cmVTZXR0aW5nTmFtZXMoKTogc3RyaW5nW10ge1xuICAgICAgICByZXR1cm4gT2JqZWN0LmtleXMoU0VUVElOR1MpLmZpbHRlcigobikgPT4gU2V0dGluZ3NTdG9yZS5pc0ZlYXR1cmUobikpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdhdGNoZXMgZm9yIGNoYW5nZXMgaW4gYSBwYXJ0aWN1bGFyIHNldHRpbmcuIFRoaXMgaXMgZG9uZSB3aXRob3V0IGFueSBsb2NhbCBlY2hvXG4gICAgICogd3JhcHBpbmcgYW5kIGZpcmVzIHdoZW5ldmVyIGEgY2hhbmdlIGlzIGRldGVjdGVkIGluIGEgc2V0dGluZydzIHZhbHVlLCBhdCBhbnkgbGV2ZWwuXG4gICAgICogV2F0Y2hpbmcgaXMgaW50ZW5kZWQgdG8gYmUgdXNlZCBpbiBzY2VuYXJpb3Mgd2hlcmUgdGhlIGFwcCBuZWVkcyB0byByZWFjdCB0byBjaGFuZ2VzXG4gICAgICogbWFkZSBieSBvdGhlciBkZXZpY2VzLiBJdCBpcyBvdGhlcndpc2UgZXhwZWN0ZWQgdGhhdCBjYWxsZXJzIHdpbGwgYmUgYWJsZSB0byB1c2UgdGhlXG4gICAgICogQ29udHJvbGxlciBzeXN0ZW0gb3IgdHJhY2sgdGhlaXIgb3duIGNoYW5nZXMgdG8gc2V0dGluZ3MuIENhbGxlcnMgc2hvdWxkIHJldGFpbiB0aGVcbiAgICAgKiByZXR1cm5lZCByZWZlcmVuY2UgdG8gbGF0ZXIgdW5zdWJzY3JpYmUgZnJvbSB1cGRhdGVzLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzZXR0aW5nTmFtZSBUaGUgc2V0dGluZyBuYW1lIHRvIHdhdGNoXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHJvb21JZCBUaGUgcm9vbSBJRCB0byB3YXRjaCBmb3IgY2hhbmdlcyBpbi4gTWF5IGJlIG51bGwgZm9yICdhbGwnLlxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrRm4gQSBmdW5jdGlvbiB0byBiZSBjYWxsZWQgd2hlbiBhIHNldHRpbmcgY2hhbmdlIGlzXG4gICAgICogZGV0ZWN0ZWQuIEZpdmUgYXJndW1lbnRzIGNhbiBiZSBleHBlY3RlZDogdGhlIHNldHRpbmcgbmFtZSwgdGhlIHJvb20gSUQgKG1heSBiZSBudWxsKSxcbiAgICAgKiB0aGUgbGV2ZWwgdGhlIGNoYW5nZSBoYXBwZW5lZCBhdCwgdGhlIG5ldyB2YWx1ZSBhdCB0aGUgZ2l2ZW4gbGV2ZWwsIGFuZCBmaW5hbGx5IHRoZSBuZXdcbiAgICAgKiB2YWx1ZSBmb3IgdGhlIHNldHRpbmcgcmVnYXJkbGVzcyBvZiBsZXZlbC4gVGhlIGNhbGxiYWNrIGlzIHJlc3BvbnNpYmxlIGZvciBkZXRlcm1pbmluZ1xuICAgICAqIGlmIHRoZSBjaGFuZ2UgaW4gdmFsdWUgaXMgd29ydGh3aGlsZSBlbm91Z2ggdG8gcmVhY3QgdXBvbi5cbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBBIHJlZmVyZW5jZSB0byB0aGUgd2F0Y2hlciB0aGF0IHdhcyBlbXBsb3llZC5cbiAgICAgKi9cbiAgICBwdWJsaWMgc3RhdGljIHdhdGNoU2V0dGluZyhzZXR0aW5nTmFtZTogc3RyaW5nLCByb29tSWQ6IHN0cmluZyB8IG51bGwsIGNhbGxiYWNrRm46IENhbGxiYWNrRm4pOiBzdHJpbmcge1xuICAgICAgICBjb25zdCBzZXR0aW5nID0gU0VUVElOR1Nbc2V0dGluZ05hbWVdO1xuICAgICAgICBjb25zdCBvcmlnaW5hbFNldHRpbmdOYW1lID0gc2V0dGluZ05hbWU7XG4gICAgICAgIGlmICghc2V0dGluZykgdGhyb3cgbmV3IEVycm9yKGAke3NldHRpbmdOYW1lfSBpcyBub3QgYSBzZXR0aW5nYCk7XG5cbiAgICAgICAgaWYgKHNldHRpbmcuaW52ZXJ0ZWRTZXR0aW5nTmFtZSkge1xuICAgICAgICAgICAgc2V0dGluZ05hbWUgPSBzZXR0aW5nLmludmVydGVkU2V0dGluZ05hbWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB3YXRjaGVySWQgPSBgJHtuZXcgRGF0ZSgpLmdldFRpbWUoKX1fJHtTZXR0aW5nc1N0b3JlLndhdGNoZXJDb3VudCsrfV8ke3NldHRpbmdOYW1lfV8ke3Jvb21JZH1gO1xuXG4gICAgICAgIGNvbnN0IGxvY2FsaXplZENhbGxiYWNrID0gKGNoYW5nZWRJblJvb21JZDogc3RyaW5nIHwgbnVsbCwgYXRMZXZlbDogU2V0dGluZ0xldmVsLCBuZXdWYWxBdExldmVsOiBhbnkpOiB2b2lkID0+IHtcbiAgICAgICAgICAgIGlmICghU2V0dGluZ3NTdG9yZS5kb2VzU2V0dGluZ1N1cHBvcnRMZXZlbChvcmlnaW5hbFNldHRpbmdOYW1lLCBhdExldmVsKSkge1xuICAgICAgICAgICAgICAgIGxvZ2dlci53YXJuKFxuICAgICAgICAgICAgICAgICAgICBgU2V0dGluZyBoYW5kbGVyIG5vdGlmaWVkIGZvciBhbiB1cGRhdGUgb2YgYW4gaW52YWxpZCBzZXR0aW5nIGxldmVsOiBgICtcbiAgICAgICAgICAgICAgICAgICAgICAgIGAke29yaWdpbmFsU2V0dGluZ05hbWV9QCR7YXRMZXZlbH0gLSB0aGlzIGxpa2VseSBtZWFucyBhIHdlaXJkIHNldHRpbmcgdmFsdWUgYCArXG4gICAgICAgICAgICAgICAgICAgICAgICBgbWFkZSBpdCBpbnRvIHRoZSBsZXZlbCdzIHN0b3JhZ2UuIFRoZSBub3RpZmljYXRpb24gd2lsbCBiZSBpZ25vcmVkLmAsXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBuZXdWYWx1ZSA9IFNldHRpbmdzU3RvcmUuZ2V0VmFsdWUob3JpZ2luYWxTZXR0aW5nTmFtZSk7XG4gICAgICAgICAgICBjb25zdCBuZXdWYWx1ZUF0TGV2ZWwgPSBTZXR0aW5nc1N0b3JlLmdldFZhbHVlQXQoYXRMZXZlbCwgb3JpZ2luYWxTZXR0aW5nTmFtZSkgPz8gbmV3VmFsQXRMZXZlbDtcbiAgICAgICAgICAgIGNhbGxiYWNrRm4ob3JpZ2luYWxTZXR0aW5nTmFtZSwgY2hhbmdlZEluUm9vbUlkLCBhdExldmVsLCBuZXdWYWx1ZUF0TGV2ZWwsIG5ld1ZhbHVlKTtcbiAgICAgICAgfTtcblxuICAgICAgICBTZXR0aW5nc1N0b3JlLndhdGNoZXJzLnNldCh3YXRjaGVySWQsIGxvY2FsaXplZENhbGxiYWNrKTtcbiAgICAgICAgZGVmYXVsdFdhdGNoTWFuYWdlci53YXRjaFNldHRpbmcoc2V0dGluZ05hbWUsIHJvb21JZCwgbG9jYWxpemVkQ2FsbGJhY2spO1xuXG4gICAgICAgIHJldHVybiB3YXRjaGVySWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RvcHMgdGhlIFNldHRpbmdzU3RvcmUgZnJvbSB3YXRjaGluZyBhIHNldHRpbmcuIFRoaXMgaXMgYSBuby1vcCBpZiB0aGUgd2F0Y2hlclxuICAgICAqIHByb3ZpZGVkIGlzIG5vdCBmb3VuZC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gd2F0Y2hlclJlZmVyZW5jZSBUaGUgd2F0Y2hlciByZWZlcmVuY2UgKHJlY2VpdmVkIGZyb20gI3dhdGNoU2V0dGluZylcbiAgICAgKiB0byBjYW5jZWwuXG4gICAgICovXG4gICAgcHVibGljIHN0YXRpYyB1bndhdGNoU2V0dGluZyh3YXRjaGVyUmVmZXJlbmNlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgICAgaWYgKCFTZXR0aW5nc1N0b3JlLndhdGNoZXJzLmhhcyh3YXRjaGVyUmVmZXJlbmNlKSkge1xuICAgICAgICAgICAgbG9nZ2VyLndhcm4oYEVuZGluZyBub24tZXhpc3RlbnQgd2F0Y2hlciBJRCAke3dhdGNoZXJSZWZlcmVuY2V9YCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBkZWZhdWx0V2F0Y2hNYW5hZ2VyLnVud2F0Y2hTZXR0aW5nKFNldHRpbmdzU3RvcmUud2F0Y2hlcnMuZ2V0KHdhdGNoZXJSZWZlcmVuY2UpISk7XG4gICAgICAgIFNldHRpbmdzU3RvcmUud2F0Y2hlcnMuZGVsZXRlKHdhdGNoZXJSZWZlcmVuY2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdXAgYSBtb25pdG9yIGZvciBhIHNldHRpbmcuIFRoaXMgYmVoYXZlcyBzaW1pbGFyIHRvICN3YXRjaFNldHRpbmcgZXhjZXB0IGluc3RlYWRcbiAgICAgKiBvZiBtYWtpbmcgYSBjYWxsIHRvIGEgY2FsbGJhY2ssIGl0IGZvcndhcmRzIGFsbCBjaGFuZ2VzIHRvIHRoZSBkaXNwYXRjaGVyLiBDYWxsZXJzIGNhblxuICAgICAqIGV4cGVjdCB0byBsaXN0ZW4gZm9yIHRoZSAnc2V0dGluZ191cGRhdGVkJyBhY3Rpb24gd2l0aCBhbiBvYmplY3QgY29udGFpbmluZyBzZXR0aW5nTmFtZSxcbiAgICAgKiByb29tSWQsIGxldmVsLCBuZXdWYWx1ZUF0TGV2ZWwsIGFuZCBuZXdWYWx1ZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc2V0dGluZ05hbWUgVGhlIHNldHRpbmcgbmFtZSB0byBtb25pdG9yLlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSByb29tSWQgVGhlIHJvb20gSUQgdG8gbW9uaXRvciBmb3IgY2hhbmdlcyBpbi4gVXNlIG51bGwgZm9yIGFsbCByb29tcy5cbiAgICAgKi9cbiAgICBwdWJsaWMgc3RhdGljIG1vbml0b3JTZXR0aW5nKHNldHRpbmdOYW1lOiBzdHJpbmcsIHJvb21JZDogc3RyaW5nIHwgbnVsbCk6IHZvaWQge1xuICAgICAgICByb29tSWQgPSByb29tSWQgfHwgbnVsbDsgLy8gdGhlIHRoaW5nIHdhbnRzIG51bGwgc3BlY2lmaWNhbGx5IHRvIHdvcmssIHNvIGFwcGVhc2UgaXQuXG5cbiAgICAgICAgaWYgKCF0aGlzLm1vbml0b3JzLmhhcyhzZXR0aW5nTmFtZSkpIHRoaXMubW9uaXRvcnMuc2V0KHNldHRpbmdOYW1lLCBuZXcgTWFwKCkpO1xuXG4gICAgICAgIGNvbnN0IHJlZ2lzdGVyV2F0Y2hlciA9ICgpOiB2b2lkID0+IHtcbiAgICAgICAgICAgIHRoaXMubW9uaXRvcnMuZ2V0KHNldHRpbmdOYW1lKSEuc2V0KFxuICAgICAgICAgICAgICAgIHJvb21JZCxcbiAgICAgICAgICAgICAgICBTZXR0aW5nc1N0b3JlLndhdGNoU2V0dGluZyhcbiAgICAgICAgICAgICAgICAgICAgc2V0dGluZ05hbWUsXG4gICAgICAgICAgICAgICAgICAgIHJvb21JZCxcbiAgICAgICAgICAgICAgICAgICAgKHNldHRpbmdOYW1lLCBpblJvb21JZCwgbGV2ZWwsIG5ld1ZhbHVlQXRMZXZlbCwgbmV3VmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRpcy5kaXNwYXRjaDxTZXR0aW5nVXBkYXRlZFBheWxvYWQ+KHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhY3Rpb246IEFjdGlvbi5TZXR0aW5nVXBkYXRlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXR0aW5nTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByb29tSWQ6IGluUm9vbUlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ld1ZhbHVlQXRMZXZlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXdWYWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICApO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IHJvb21zID0gQXJyYXkuZnJvbSh0aGlzLm1vbml0b3JzLmdldChzZXR0aW5nTmFtZSkhLmtleXMoKSk7XG4gICAgICAgIGNvbnN0IGhhc1Jvb20gPSByb29tcy5maW5kKChyKSA9PiByID09PSByb29tSWQgfHwgciA9PT0gbnVsbCk7XG4gICAgICAgIGlmICghaGFzUm9vbSkge1xuICAgICAgICAgICAgcmVnaXN0ZXJXYXRjaGVyKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAocm9vbUlkID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgLy8gVW5yZWdpc3RlciBhbGwgZXhpc3Rpbmcgd2F0Y2hlcnMgYW5kIHJlZ2lzdGVyIHRoZSBuZXcgb25lXG4gICAgICAgICAgICAgICAgcm9vbXMuZm9yRWFjaCgocm9vbUlkKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIFNldHRpbmdzU3RvcmUudW53YXRjaFNldHRpbmcodGhpcy5tb25pdG9ycy5nZXQoc2V0dGluZ05hbWUpIS5nZXQocm9vbUlkKSEpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHRoaXMubW9uaXRvcnMuZ2V0KHNldHRpbmdOYW1lKSEuY2xlYXIoKTtcbiAgICAgICAgICAgICAgICByZWdpc3RlcldhdGNoZXIoKTtcbiAgICAgICAgICAgIH0gLy8gZWxzZSBhIHdhdGNoZXIgaXMgYWxyZWFkeSByZWdpc3RlcmVkIGZvciB0aGUgcm9vbSwgc28gZG9uJ3QgYm90aGVyIHJlZ2lzdGVyaW5nIGl0IGFnYWluXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB0cmFuc2xhdGVkIGRpc3BsYXkgbmFtZSBmb3IgYSBnaXZlbiBzZXR0aW5nXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNldHRpbmdOYW1lIFRoZSBzZXR0aW5nIHRvIGxvb2sgdXAuXG4gICAgICogQHBhcmFtIHtTZXR0aW5nTGV2ZWx9IGF0TGV2ZWxcbiAgICAgKiBUaGUgbGV2ZWwgdG8gZ2V0IHRoZSBkaXNwbGF5IG5hbWUgZm9yOyBEZWZhdWx0cyB0byAnZGVmYXVsdCcuXG4gICAgICogQHJldHVybiB7U3RyaW5nfSBUaGUgZGlzcGxheSBuYW1lIGZvciB0aGUgc2V0dGluZywgb3IgbnVsbCBpZiBub3QgZm91bmQuXG4gICAgICovXG4gICAgcHVibGljIHN0YXRpYyBnZXREaXNwbGF5TmFtZShzZXR0aW5nTmFtZTogc3RyaW5nLCBhdExldmVsID0gU2V0dGluZ0xldmVsLkRFRkFVTFQpOiBzdHJpbmcgfCBudWxsIHtcbiAgICAgICAgaWYgKCFTRVRUSU5HU1tzZXR0aW5nTmFtZV0gfHwgIVNFVFRJTkdTW3NldHRpbmdOYW1lXS5kaXNwbGF5TmFtZSkgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgbGV0IGRpc3BsYXlOYW1lID0gU0VUVElOR1Nbc2V0dGluZ05hbWVdLmRpc3BsYXlOYW1lO1xuICAgICAgICBpZiAoZGlzcGxheU5hbWUgaW5zdGFuY2VvZiBPYmplY3QpIHtcbiAgICAgICAgICAgIGlmIChkaXNwbGF5TmFtZVthdExldmVsXSkgZGlzcGxheU5hbWUgPSBkaXNwbGF5TmFtZVthdExldmVsXTtcbiAgICAgICAgICAgIGVsc2UgZGlzcGxheU5hbWUgPSBkaXNwbGF5TmFtZVtcImRlZmF1bHRcIl07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gX3QoZGlzcGxheU5hbWUgYXMgc3RyaW5nKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSB0cmFuc2xhdGVkIGRlc2NyaXB0aW9uIGZvciBhIGdpdmVuIHNldHRpbmdcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc2V0dGluZ05hbWUgVGhlIHNldHRpbmcgdG8gbG9vayB1cC5cbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9IFRoZSBkZXNjcmlwdGlvbiBmb3IgdGhlIHNldHRpbmcsIG9yIG51bGwgaWYgbm90IGZvdW5kLlxuICAgICAqL1xuICAgIHB1YmxpYyBzdGF0aWMgZ2V0RGVzY3JpcHRpb24oc2V0dGluZ05hbWU6IHN0cmluZyk6IHN0cmluZyB8IFJlYWN0Tm9kZSB7XG4gICAgICAgIGNvbnN0IGRlc2NyaXB0aW9uID0gU0VUVElOR1Nbc2V0dGluZ05hbWVdPy5kZXNjcmlwdGlvbjtcbiAgICAgICAgaWYgKCFkZXNjcmlwdGlvbikgcmV0dXJuIG51bGw7XG4gICAgICAgIGlmICh0eXBlb2YgZGVzY3JpcHRpb24gIT09IFwic3RyaW5nXCIpIHJldHVybiBkZXNjcmlwdGlvbigpO1xuICAgICAgICByZXR1cm4gX3QoZGVzY3JpcHRpb24pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERldGVybWluZXMgaWYgYSBzZXR0aW5nIGlzIGFsc28gYSBmZWF0dXJlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzZXR0aW5nTmFtZSBUaGUgc2V0dGluZyB0byBsb29rIHVwLlxuICAgICAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgaWYgdGhlIHNldHRpbmcgaXMgYSBmZWF0dXJlLlxuICAgICAqL1xuICAgIHB1YmxpYyBzdGF0aWMgaXNGZWF0dXJlKHNldHRpbmdOYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKCFTRVRUSU5HU1tzZXR0aW5nTmFtZV0pIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuICEhU0VUVElOR1Nbc2V0dGluZ05hbWVdLmlzRmVhdHVyZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXRlcm1pbmVzIGlmIGEgc2V0dGluZyBzaG91bGQgaGF2ZSBhIHdhcm5pbmcgc2lnbiBpbiB0aGUgbWljcm9jb3B5XG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNldHRpbmdOYW1lIFRoZSBzZXR0aW5nIHRvIGxvb2sgdXAuXG4gICAgICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgc2V0dGluZyBzaG91bGQgaGF2ZSBhIHdhcm5pbmcgc2lnbi5cbiAgICAgKi9cbiAgICBwdWJsaWMgc3RhdGljIHNob3VsZEhhdmVXYXJuaW5nKHNldHRpbmdOYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKCFTRVRUSU5HU1tzZXR0aW5nTmFtZV0pIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIFNFVFRJTkdTW3NldHRpbmdOYW1lXS5zaG91bGRXYXJuID8/IGZhbHNlO1xuICAgIH1cblxuICAgIHB1YmxpYyBzdGF0aWMgZ2V0QmV0YUluZm8oc2V0dGluZ05hbWU6IHN0cmluZyk6IElTZXR0aW5nW1wiYmV0YUluZm9cIl0ge1xuICAgICAgICAvLyBjb25zaWRlciBhIGJldGEgZGlzYWJsZWQgaWYgdGhlIGNvbmZpZyBpcyBleHBsaWNpdGx5IHNldCB0byBmYWxzZSwgaW4gd2hpY2ggY2FzZSB0cmVhdCBhcyBub3JtYWwgTGFicyBmbGFnXG4gICAgICAgIGlmIChcbiAgICAgICAgICAgIFNldHRpbmdzU3RvcmUuaXNGZWF0dXJlKHNldHRpbmdOYW1lKSAmJlxuICAgICAgICAgICAgU2V0dGluZ3NTdG9yZS5nZXRWYWx1ZUF0KFNldHRpbmdMZXZlbC5DT05GSUcsIHNldHRpbmdOYW1lLCBudWxsLCB0cnVlLCB0cnVlKSAhPT0gZmFsc2VcbiAgICAgICAgKSB7XG4gICAgICAgICAgICByZXR1cm4gU0VUVElOR1Nbc2V0dGluZ05hbWVdPy5iZXRhSW5mbztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBzdGF0aWMgZ2V0TGFiR3JvdXAoc2V0dGluZ05hbWU6IHN0cmluZyk6IExhYkdyb3VwIHwgdW5kZWZpbmVkIHtcbiAgICAgICAgaWYgKFNldHRpbmdzU3RvcmUuaXNGZWF0dXJlKHNldHRpbmdOYW1lKSkge1xuICAgICAgICAgICAgcmV0dXJuICg8SUZlYXR1cmU+U0VUVElOR1Nbc2V0dGluZ05hbWVdKS5sYWJzR3JvdXA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXRlcm1pbmVzIGlmIGEgc2V0dGluZyBpcyBlbmFibGVkLlxuICAgICAqIElmIGEgc2V0dGluZyBpcyBkaXNhYmxlZCB0aGVuIGl0IHNob3VsZCBub3JtYWxseSBiZSBoaWRkZW4gZnJvbSB0aGUgdXNlciB0byBkZS1jbHV0dGVyIHRoZSB1c2VyIGludGVyZmFjZS5cbiAgICAgKiBUaGlzIHJ1bGUgaXMgaW50ZW50aW9uYWxseSBpZ25vcmVkIGZvciBsYWJzIGZsYWdzIHRvIHVudmVpbCB3aGF0IGZlYXR1cmVzIGFyZSBhdmFpbGFibGUgd2l0aFxuICAgICAqIHRoZSByaWdodCBzZXJ2ZXIgc3VwcG9ydC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc2V0dGluZ05hbWUgVGhlIHNldHRpbmcgdG8gbG9vayB1cC5cbiAgICAgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIGlmIHRoZSBzZXR0aW5nIGlzIGVuYWJsZWQuXG4gICAgICovXG4gICAgcHVibGljIHN0YXRpYyBpc0VuYWJsZWQoc2V0dGluZ05hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoIVNFVFRJTkdTW3NldHRpbmdOYW1lXSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gIVNFVFRJTkdTW3NldHRpbmdOYW1lXS5jb250cm9sbGVyPy5zZXR0aW5nRGlzYWJsZWQgPz8gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIHJlYXNvbiBhIHNldHRpbmcgaXMgZGlzYWJsZWQgaWYgb25lIGlzIGFzc2lnbmVkLlxuICAgICAqIElmIGEgc2V0dGluZyBpcyBub3QgZGlzYWJsZWQsIG9yIG5vIHJlYXNvbiBpcyBnaXZlbiBieSB0aGUgYFNldHRpbmdDb250cm9sbGVyYCxcbiAgICAgKiB0aGlzIHdpbGwgcmV0dXJuIHVuZGVmaW5lZC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc2V0dGluZ05hbWUgVGhlIHNldHRpbmcgdG8gbG9vayB1cC5cbiAgICAgKiBAcmV0dXJuIHtzdHJpbmd9IFRoZSByZWFzb24gdGhlIHNldHRpbmcgaXMgZGlzYWJsZWQuXG4gICAgICovXG4gICAgcHVibGljIHN0YXRpYyBkaXNhYmxlZE1lc3NhZ2Uoc2V0dGluZ05hbWU6IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gICAgICAgIGNvbnN0IGRpc2FibGVkID0gU0VUVElOR1Nbc2V0dGluZ05hbWVdLmNvbnRyb2xsZXI/LnNldHRpbmdEaXNhYmxlZDtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBkaXNhYmxlZCA9PT0gXCJzdHJpbmdcIiA/IGRpc2FibGVkIDogdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHZhbHVlIG9mIGEgc2V0dGluZy4gVGhlIHJvb20gSUQgaXMgb3B0aW9uYWwgaWYgdGhlIHNldHRpbmcgaXMgbm90IHRvXG4gICAgICogYmUgYXBwbGllZCB0byBhbnkgcGFydGljdWxhciByb29tLCBvdGhlcndpc2UgaXQgc2hvdWxkIGJlIHN1cHBsaWVkLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzZXR0aW5nTmFtZSBUaGUgbmFtZSBvZiB0aGUgc2V0dGluZyB0byByZWFkIHRoZSB2YWx1ZSBvZi5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gcm9vbUlkIFRoZSByb29tIElEIHRvIHJlYWQgdGhlIHNldHRpbmcgdmFsdWUgaW4sIG1heSBiZSBudWxsLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZXhjbHVkZURlZmF1bHQgVHJ1ZSB0byBkaXNhYmxlIHVzaW5nIHRoZSBkZWZhdWx0IHZhbHVlLlxuICAgICAqIEByZXR1cm4geyp9IFRoZSB2YWx1ZSwgb3IgbnVsbCBpZiBub3QgZm91bmRcbiAgICAgKi9cbiAgICBwdWJsaWMgc3RhdGljIGdldFZhbHVlPFQgPSBhbnk+KHNldHRpbmdOYW1lOiBzdHJpbmcsIHJvb21JZDogc3RyaW5nIHwgbnVsbCA9IG51bGwsIGV4Y2x1ZGVEZWZhdWx0ID0gZmFsc2UpOiBUIHtcbiAgICAgICAgLy8gVmVyaWZ5IHRoYXQgdGhlIHNldHRpbmcgaXMgYWN0dWFsbHkgYSBzZXR0aW5nXG4gICAgICAgIGlmICghU0VUVElOR1Nbc2V0dGluZ05hbWVdKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJTZXR0aW5nICdcIiArIHNldHRpbmdOYW1lICsgXCInIGRvZXMgbm90IGFwcGVhciB0byBiZSBhIHNldHRpbmcuXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2V0dGluZyA9IFNFVFRJTkdTW3NldHRpbmdOYW1lXTtcbiAgICAgICAgY29uc3QgbGV2ZWxPcmRlciA9IGdldExldmVsT3JkZXIoc2V0dGluZyk7XG5cbiAgICAgICAgcmV0dXJuIFNldHRpbmdzU3RvcmUuZ2V0VmFsdWVBdChsZXZlbE9yZGVyWzBdLCBzZXR0aW5nTmFtZSwgcm9vbUlkLCBmYWxzZSwgZXhjbHVkZURlZmF1bHQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgYSBzZXR0aW5nJ3MgdmFsdWUgYXQgYSBwYXJ0aWN1bGFyIGxldmVsLCBpZ25vcmluZyBhbGwgbGV2ZWxzIHRoYXQgYXJlIG1vcmUgc3BlY2lmaWMuXG4gICAgICogQHBhcmFtIHtTZXR0aW5nTGV2ZWx8XCJjb25maWdcInxcImRlZmF1bHRcIn0gbGV2ZWwgVGhlXG4gICAgICogbGV2ZWwgdG8gbG9vayBhdC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc2V0dGluZ05hbWUgVGhlIG5hbWUgb2YgdGhlIHNldHRpbmcgdG8gcmVhZC5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gcm9vbUlkIFRoZSByb29tIElEIHRvIHJlYWQgdGhlIHNldHRpbmcgdmFsdWUgaW4sIG1heSBiZSBudWxsLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZXhwbGljaXQgSWYgdHJ1ZSwgdGhpcyBtZXRob2Qgd2lsbCBub3QgY29uc2lkZXIgb3RoZXIgbGV2ZWxzLCBqdXN0IHRoZSBvbmVcbiAgICAgKiBwcm92aWRlZC4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBleGNsdWRlRGVmYXVsdCBUcnVlIHRvIGRpc2FibGUgdXNpbmcgdGhlIGRlZmF1bHQgdmFsdWUuXG4gICAgICogQHJldHVybiB7Kn0gVGhlIHZhbHVlLCBvciBudWxsIGlmIG5vdCBmb3VuZC5cbiAgICAgKi9cbiAgICBwdWJsaWMgc3RhdGljIGdldFZhbHVlQXQoXG4gICAgICAgIGxldmVsOiBTZXR0aW5nTGV2ZWwsXG4gICAgICAgIHNldHRpbmdOYW1lOiBzdHJpbmcsXG4gICAgICAgIHJvb21JZDogc3RyaW5nIHwgbnVsbCA9IG51bGwsXG4gICAgICAgIGV4cGxpY2l0ID0gZmFsc2UsXG4gICAgICAgIGV4Y2x1ZGVEZWZhdWx0ID0gZmFsc2UsXG4gICAgKTogYW55IHtcbiAgICAgICAgLy8gVmVyaWZ5IHRoYXQgdGhlIHNldHRpbmcgaXMgYWN0dWFsbHkgYSBzZXR0aW5nXG4gICAgICAgIGNvbnN0IHNldHRpbmcgPSBTRVRUSU5HU1tzZXR0aW5nTmFtZV07XG4gICAgICAgIGlmICghc2V0dGluZykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiU2V0dGluZyAnXCIgKyBzZXR0aW5nTmFtZSArIFwiJyBkb2VzIG5vdCBhcHBlYXIgdG8gYmUgYSBzZXR0aW5nLlwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGxldmVsT3JkZXIgPSBnZXRMZXZlbE9yZGVyKHNldHRpbmcpO1xuICAgICAgICBpZiAoIWxldmVsT3JkZXIuaW5jbHVkZXMoU2V0dGluZ0xldmVsLkRFRkFVTFQpKSBsZXZlbE9yZGVyLnB1c2goU2V0dGluZ0xldmVsLkRFRkFVTFQpOyAvLyBhbHdheXMgaW5jbHVkZSBkZWZhdWx0XG5cbiAgICAgICAgY29uc3QgbWluSW5kZXggPSBsZXZlbE9yZGVyLmluZGV4T2YobGV2ZWwpO1xuICAgICAgICBpZiAobWluSW5kZXggPT09IC0xKSB0aHJvdyBuZXcgRXJyb3IoYExldmVsIFwiJHtsZXZlbH1cIiBmb3Igc2V0dGluZyBcIiR7c2V0dGluZ05hbWV9XCIgaXMgbm90IHByaW9yaXRpemVkYCk7XG5cbiAgICAgICAgY29uc3QgaGFuZGxlcnMgPSBTZXR0aW5nc1N0b3JlLmdldEhhbmRsZXJzKHNldHRpbmdOYW1lKTtcblxuICAgICAgICAvLyBDaGVjayBpZiB3ZSBuZWVkIHRvIGludmVydCB0aGUgc2V0dGluZyBhdCBhbGwuIERvIHRoaXMgYWZ0ZXIgd2UgZ2V0IHRoZSBzZXR0aW5nXG4gICAgICAgIC8vIGhhbmRsZXJzIHRob3VnaCwgb3RoZXJ3aXNlIHdlJ2xsIGZhaWwgdG8gcmVhZCB0aGUgdmFsdWUuXG4gICAgICAgIGlmIChzZXR0aW5nLmludmVydGVkU2V0dGluZ05hbWUpIHtcbiAgICAgICAgICAgIC8vY29uc29sZS53YXJuKGBJbnZlcnRpbmcgJHtzZXR0aW5nTmFtZX0gdG8gYmUgJHtzZXR0aW5nLmludmVydGVkU2V0dGluZ05hbWV9IC0gbGVnYWN5IHNldHRpbmdgKTtcbiAgICAgICAgICAgIHNldHRpbmdOYW1lID0gc2V0dGluZy5pbnZlcnRlZFNldHRpbmdOYW1lO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGV4cGxpY2l0KSB7XG4gICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gaGFuZGxlcnNbbGV2ZWxdO1xuICAgICAgICAgICAgaWYgKCFoYW5kbGVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFNldHRpbmdzU3RvcmUuZ2V0RmluYWxWYWx1ZShzZXR0aW5nLCBsZXZlbCwgcm9vbUlkLCBudWxsLCBudWxsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gaGFuZGxlci5nZXRWYWx1ZShzZXR0aW5nTmFtZSwgcm9vbUlkKTtcbiAgICAgICAgICAgIHJldHVybiBTZXR0aW5nc1N0b3JlLmdldEZpbmFsVmFsdWUoc2V0dGluZywgbGV2ZWwsIHJvb21JZCwgdmFsdWUsIGxldmVsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSBtaW5JbmRleDsgaSA8IGxldmVsT3JkZXIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGhhbmRsZXIgPSBoYW5kbGVyc1tsZXZlbE9yZGVyW2ldXTtcbiAgICAgICAgICAgIGlmICghaGFuZGxlcikgY29udGludWU7XG4gICAgICAgICAgICBpZiAoZXhjbHVkZURlZmF1bHQgJiYgbGV2ZWxPcmRlcltpXSA9PT0gXCJkZWZhdWx0XCIpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBjb25zdCB2YWx1ZSA9IGhhbmRsZXIuZ2V0VmFsdWUoc2V0dGluZ05hbWUsIHJvb21JZCk7XG4gICAgICAgICAgICBpZiAodmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCkgY29udGludWU7XG4gICAgICAgICAgICByZXR1cm4gU2V0dGluZ3NTdG9yZS5nZXRGaW5hbFZhbHVlKHNldHRpbmcsIGxldmVsLCByb29tSWQsIHZhbHVlLCBsZXZlbE9yZGVyW2ldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBTZXR0aW5nc1N0b3JlLmdldEZpbmFsVmFsdWUoc2V0dGluZywgbGV2ZWwsIHJvb21JZCwgbnVsbCwgbnVsbCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUgZGVmYXVsdCB2YWx1ZSBvZiBhIHNldHRpbmcuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNldHRpbmdOYW1lIFRoZSBuYW1lIG9mIHRoZSBzZXR0aW5nIHRvIHJlYWQgdGhlIHZhbHVlIG9mLlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSByb29tSWQgVGhlIHJvb20gSUQgdG8gcmVhZCB0aGUgc2V0dGluZyB2YWx1ZSBpbiwgbWF5IGJlIG51bGwuXG4gICAgICogQHJldHVybiB7Kn0gVGhlIGRlZmF1bHQgdmFsdWVcbiAgICAgKi9cbiAgICBwdWJsaWMgc3RhdGljIGdldERlZmF1bHRWYWx1ZShzZXR0aW5nTmFtZTogc3RyaW5nKTogYW55IHtcbiAgICAgICAgLy8gVmVyaWZ5IHRoYXQgdGhlIHNldHRpbmcgaXMgYWN0dWFsbHkgYSBzZXR0aW5nXG4gICAgICAgIGlmICghU0VUVElOR1Nbc2V0dGluZ05hbWVdKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJTZXR0aW5nICdcIiArIHNldHRpbmdOYW1lICsgXCInIGRvZXMgbm90IGFwcGVhciB0byBiZSBhIHNldHRpbmcuXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIFNFVFRJTkdTW3NldHRpbmdOYW1lXS5kZWZhdWx0O1xuICAgIH1cblxuICAgIHByaXZhdGUgc3RhdGljIGdldEZpbmFsVmFsdWUoXG4gICAgICAgIHNldHRpbmc6IElTZXR0aW5nLFxuICAgICAgICBsZXZlbDogU2V0dGluZ0xldmVsLFxuICAgICAgICByb29tSWQ6IHN0cmluZyB8IG51bGwsXG4gICAgICAgIGNhbGN1bGF0ZWRWYWx1ZTogYW55LFxuICAgICAgICBjYWxjdWxhdGVkQXRMZXZlbDogU2V0dGluZ0xldmVsIHwgbnVsbCxcbiAgICApOiBhbnkge1xuICAgICAgICBsZXQgcmVzdWx0aW5nVmFsdWUgPSBjYWxjdWxhdGVkVmFsdWU7XG5cbiAgICAgICAgaWYgKHNldHRpbmcuY29udHJvbGxlcikge1xuICAgICAgICAgICAgY29uc3QgYWN0dWFsVmFsdWUgPSBzZXR0aW5nLmNvbnRyb2xsZXIuZ2V0VmFsdWVPdmVycmlkZShsZXZlbCwgcm9vbUlkLCBjYWxjdWxhdGVkVmFsdWUsIGNhbGN1bGF0ZWRBdExldmVsKTtcbiAgICAgICAgICAgIGlmIChhY3R1YWxWYWx1ZSAhPT0gdW5kZWZpbmVkICYmIGFjdHVhbFZhbHVlICE9PSBudWxsKSByZXN1bHRpbmdWYWx1ZSA9IGFjdHVhbFZhbHVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNldHRpbmcuaW52ZXJ0ZWRTZXR0aW5nTmFtZSkgcmVzdWx0aW5nVmFsdWUgPSAhcmVzdWx0aW5nVmFsdWU7XG4gICAgICAgIHJldHVybiByZXN1bHRpbmdWYWx1ZTtcbiAgICB9XG5cbiAgICAvKiBlc2xpbnQtZGlzYWJsZSB2YWxpZC1qc2RvYyAqLyAvL2h0dHBzOi8vZ2l0aHViLmNvbS9lc2xpbnQvZXNsaW50L2lzc3Vlcy83MzA3XG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgdmFsdWUgZm9yIGEgc2V0dGluZy4gVGhlIHJvb20gSUQgaXMgb3B0aW9uYWwgaWYgdGhlIHNldHRpbmcgaXMgbm90IGJlaW5nXG4gICAgICogc2V0IGZvciBhIHBhcnRpY3VsYXIgcm9vbSwgb3RoZXJ3aXNlIGl0IHNob3VsZCBiZSBzdXBwbGllZC4gVGhlIHZhbHVlIG1heSBiZSBudWxsXG4gICAgICogdG8gaW5kaWNhdGUgdGhhdCB0aGUgbGV2ZWwgc2hvdWxkIG5vIGxvbmdlciBoYXZlIGFuIG92ZXJyaWRlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzZXR0aW5nTmFtZSBUaGUgbmFtZSBvZiB0aGUgc2V0dGluZyB0byBjaGFuZ2UuXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHJvb21JZCBUaGUgcm9vbSBJRCB0byBjaGFuZ2UgdGhlIHZhbHVlIGluLCBtYXkgYmUgbnVsbC5cbiAgICAgKiBAcGFyYW0ge1NldHRpbmdMZXZlbH0gbGV2ZWwgVGhlIGxldmVsXG4gICAgICogdG8gY2hhbmdlIHRoZSB2YWx1ZSBhdC5cbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlIFRoZSBuZXcgdmFsdWUgb2YgdGhlIHNldHRpbmcsIG1heSBiZSBudWxsLlxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9IFJlc29sdmVzIHdoZW4gdGhlIHNldHRpbmcgaGFzIGJlZW4gY2hhbmdlZC5cbiAgICAgKi9cblxuICAgIC8qIGVzbGludC1lbmFibGUgdmFsaWQtanNkb2MgKi9cbiAgICBwdWJsaWMgc3RhdGljIGFzeW5jIHNldFZhbHVlKFxuICAgICAgICBzZXR0aW5nTmFtZTogc3RyaW5nLFxuICAgICAgICByb29tSWQ6IHN0cmluZyB8IG51bGwsXG4gICAgICAgIGxldmVsOiBTZXR0aW5nTGV2ZWwsXG4gICAgICAgIHZhbHVlOiBhbnksXG4gICAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIC8vIFZlcmlmeSB0aGF0IHRoZSBzZXR0aW5nIGlzIGFjdHVhbGx5IGEgc2V0dGluZ1xuICAgICAgICBjb25zdCBzZXR0aW5nID0gU0VUVElOR1Nbc2V0dGluZ05hbWVdO1xuICAgICAgICBpZiAoIXNldHRpbmcpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlNldHRpbmcgJ1wiICsgc2V0dGluZ05hbWUgKyBcIicgZG9lcyBub3QgYXBwZWFyIHRvIGJlIGEgc2V0dGluZy5cIik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBoYW5kbGVyID0gU2V0dGluZ3NTdG9yZS5nZXRIYW5kbGVyKHNldHRpbmdOYW1lLCBsZXZlbCk7XG4gICAgICAgIGlmICghaGFuZGxlcikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiU2V0dGluZyBcIiArIHNldHRpbmdOYW1lICsgXCIgZG9lcyBub3QgaGF2ZSBhIGhhbmRsZXIgZm9yIFwiICsgbGV2ZWwpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNldHRpbmcuaW52ZXJ0ZWRTZXR0aW5nTmFtZSkge1xuICAgICAgICAgICAgLy8gTm90ZTogV2UgY2FuJ3QgZG8gdGhpcyB3aGVuIHRoZSBgbGV2ZWxgIGlzIFwiZGVmYXVsdFwiLCBob3dldmVyIHdlIGFsc29cbiAgICAgICAgICAgIC8vIGtub3cgdGhhdCB0aGUgdXNlciBjYW4ndCBwb3NzaWJsZSBjaGFuZ2UgdGhlIGRlZmF1bHQgdmFsdWUgdGhyb3VnaCB0aGlzXG4gICAgICAgICAgICAvLyBmdW5jdGlvbiBzbyB3ZSBkb24ndCBib3RoZXIgY2hlY2tpbmcgaXQuXG4gICAgICAgICAgICAvL2NvbnNvbGUud2FybihgSW52ZXJ0aW5nICR7c2V0dGluZ05hbWV9IHRvIGJlICR7c2V0dGluZy5pbnZlcnRlZFNldHRpbmdOYW1lfSAtIGxlZ2FjeSBzZXR0aW5nYCk7XG4gICAgICAgICAgICBzZXR0aW5nTmFtZSA9IHNldHRpbmcuaW52ZXJ0ZWRTZXR0aW5nTmFtZTtcbiAgICAgICAgICAgIHZhbHVlID0gIXZhbHVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFoYW5kbGVyLmNhblNldFZhbHVlKHNldHRpbmdOYW1lLCByb29tSWQpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVc2VyIGNhbm5vdCBzZXQgXCIgKyBzZXR0aW5nTmFtZSArIFwiIGF0IFwiICsgbGV2ZWwgKyBcIiBpbiBcIiArIHJvb21JZCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2V0dGluZy5jb250cm9sbGVyICYmICEoYXdhaXQgc2V0dGluZy5jb250cm9sbGVyLmJlZm9yZUNoYW5nZShsZXZlbCwgcm9vbUlkLCB2YWx1ZSkpKSB7XG4gICAgICAgICAgICByZXR1cm47IC8vIGNvbnRyb2xsZXIgc2F5cyBub1xuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgaGFuZGxlci5zZXRWYWx1ZShzZXR0aW5nTmFtZSwgcm9vbUlkLCB2YWx1ZSk7XG5cbiAgICAgICAgc2V0dGluZy5jb250cm9sbGVyPy5vbkNoYW5nZShsZXZlbCwgcm9vbUlkLCB2YWx1ZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGV0ZXJtaW5lcyBpZiB0aGUgY3VycmVudCB1c2VyIGlzIHBlcm1pdHRlZCB0byBzZXQgdGhlIGdpdmVuIHNldHRpbmcgYXQgdGhlIGdpdmVuXG4gICAgICogbGV2ZWwgZm9yIGEgcGFydGljdWxhciByb29tLiBUaGUgcm9vbSBJRCBpcyBvcHRpb25hbCBpZiB0aGUgc2V0dGluZyBpcyBub3QgYmVpbmdcbiAgICAgKiBzZXQgZm9yIGEgcGFydGljdWxhciByb29tLCBvdGhlcndpc2UgaXQgc2hvdWxkIGJlIHN1cHBsaWVkLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzZXR0aW5nTmFtZSBUaGUgbmFtZSBvZiB0aGUgc2V0dGluZyB0byBjaGVjay5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gcm9vbUlkIFRoZSByb29tIElEIHRvIGNoZWNrIGluLCBtYXkgYmUgbnVsbC5cbiAgICAgKiBAcGFyYW0ge1NldHRpbmdMZXZlbH0gbGV2ZWwgVGhlIGxldmVsIHRvXG4gICAgICogY2hlY2sgYXQuXG4gICAgICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgdXNlciBtYXkgc2V0IHRoZSBzZXR0aW5nLCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICovXG4gICAgcHVibGljIHN0YXRpYyBjYW5TZXRWYWx1ZShzZXR0aW5nTmFtZTogc3RyaW5nLCByb29tSWQ6IHN0cmluZyB8IG51bGwsIGxldmVsOiBTZXR0aW5nTGV2ZWwpOiBib29sZWFuIHtcbiAgICAgICAgLy8gVmVyaWZ5IHRoYXQgdGhlIHNldHRpbmcgaXMgYWN0dWFsbHkgYSBzZXR0aW5nXG4gICAgICAgIGlmICghU0VUVElOR1Nbc2V0dGluZ05hbWVdKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJTZXR0aW5nICdcIiArIHNldHRpbmdOYW1lICsgXCInIGRvZXMgbm90IGFwcGVhciB0byBiZSBhIHNldHRpbmcuXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFTZXR0aW5nc1N0b3JlLmlzRW5hYmxlZChzZXR0aW5nTmFtZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFdoZW4gbm9uLWJldGEgZmVhdHVyZXMgYXJlIHNwZWNpZmllZCBpbiB0aGUgY29uZmlnLmpzb24sIHdlIGZvcmNlIHRoZW0gYXMgZW5hYmxlZCBvciBkaXNhYmxlZC5cbiAgICAgICAgaWYgKFNldHRpbmdzU3RvcmUuaXNGZWF0dXJlKHNldHRpbmdOYW1lKSAmJiAhU0VUVElOR1Nbc2V0dGluZ05hbWVdPy5iZXRhSW5mbykge1xuICAgICAgICAgICAgY29uc3QgY29uZmlnVmFsID0gU2V0dGluZ3NTdG9yZS5nZXRWYWx1ZUF0KFNldHRpbmdMZXZlbC5DT05GSUcsIHNldHRpbmdOYW1lLCByb29tSWQsIHRydWUsIHRydWUpO1xuICAgICAgICAgICAgaWYgKGNvbmZpZ1ZhbCA9PT0gdHJ1ZSB8fCBjb25maWdWYWwgPT09IGZhbHNlKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBoYW5kbGVyID0gU2V0dGluZ3NTdG9yZS5nZXRIYW5kbGVyKHNldHRpbmdOYW1lLCBsZXZlbCk7XG4gICAgICAgIGlmICghaGFuZGxlcikgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gaGFuZGxlci5jYW5TZXRWYWx1ZShzZXR0aW5nTmFtZSwgcm9vbUlkKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXRlcm1pbmVzIGlmIHRoZSBnaXZlbiBsZXZlbCBpcyBzdXBwb3J0ZWQgb24gdGhpcyBkZXZpY2UuXG4gICAgICogQHBhcmFtIHtTZXR0aW5nTGV2ZWx9IGxldmVsIFRoZSBsZXZlbFxuICAgICAqIHRvIGNoZWNrIHRoZSBmZWFzaWJpbGl0eSBvZi5cbiAgICAgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIGlmIHRoZSBsZXZlbCBpcyBzdXBwb3J0ZWQsIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBwdWJsaWMgc3RhdGljIGlzTGV2ZWxTdXBwb3J0ZWQobGV2ZWw6IFNldHRpbmdMZXZlbCk6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoIUxFVkVMX0hBTkRMRVJTW2xldmVsXSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gTEVWRUxfSEFORExFUlNbbGV2ZWxdLmlzU3VwcG9ydGVkKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGV0ZXJtaW5lcyBpZiBhIHNldHRpbmcgc3VwcG9ydHMgYSBwYXJ0aWN1bGFyIGxldmVsLlxuICAgICAqIEBwYXJhbSBzZXR0aW5nTmFtZSBUaGUgc2V0dGluZyBuYW1lLlxuICAgICAqIEBwYXJhbSBsZXZlbCBUaGUgbGV2ZWwuXG4gICAgICogQHJldHVybnMgVHJ1ZSBpZiBzdXBwb3J0ZWQsIGZhbHNlIG90aGVyd2lzZS4gTm90ZSB0aGF0IHRoaXMgd2lsbCBub3QgY2hlY2sgdG8gc2VlIGlmXG4gICAgICogdGhlIGxldmVsIGl0c2VsZiBjYW4gYmUgc3VwcG9ydGVkIGJ5IHRoZSBydW50aW1lIChpZTogeW91IHdpbGwgbmVlZCB0byBjYWxsICNpc0xldmVsU3VwcG9ydGVkKClcbiAgICAgKiBvbiB5b3VyIG93bikuXG4gICAgICovXG4gICAgcHVibGljIHN0YXRpYyBkb2VzU2V0dGluZ1N1cHBvcnRMZXZlbChzZXR0aW5nTmFtZTogc3RyaW5nLCBsZXZlbDogU2V0dGluZ0xldmVsKTogYm9vbGVhbiB7XG4gICAgICAgIGNvbnN0IHNldHRpbmcgPSBTRVRUSU5HU1tzZXR0aW5nTmFtZV07XG4gICAgICAgIGlmICghc2V0dGluZykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiU2V0dGluZyAnXCIgKyBzZXR0aW5nTmFtZSArIFwiJyBkb2VzIG5vdCBhcHBlYXIgdG8gYmUgYSBzZXR0aW5nLlwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBsZXZlbCA9PT0gU2V0dGluZ0xldmVsLkRFRkFVTFQgfHwgISFzZXR0aW5nLnN1cHBvcnRlZExldmVscz8uaW5jbHVkZXMobGV2ZWwpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERldGVybWluZXMgdGhlIGZpcnN0IHN1cHBvcnRlZCBsZXZlbCBvdXQgb2YgYWxsIHRoZSBsZXZlbHMgdGhhdCBjYW4gYmUgdXNlZCBmb3IgYVxuICAgICAqIHNwZWNpZmljIHNldHRpbmcuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNldHRpbmdOYW1lIFRoZSBzZXR0aW5nIG5hbWUuXG4gICAgICogQHJldHVybiB7U2V0dGluZ0xldmVsfVxuICAgICAqL1xuICAgIHB1YmxpYyBzdGF0aWMgZmlyc3RTdXBwb3J0ZWRMZXZlbChzZXR0aW5nTmFtZTogc3RyaW5nKTogU2V0dGluZ0xldmVsIHwgbnVsbCB7XG4gICAgICAgIC8vIFZlcmlmeSB0aGF0IHRoZSBzZXR0aW5nIGlzIGFjdHVhbGx5IGEgc2V0dGluZ1xuICAgICAgICBjb25zdCBzZXR0aW5nID0gU0VUVElOR1Nbc2V0dGluZ05hbWVdO1xuICAgICAgICBpZiAoIXNldHRpbmcpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlNldHRpbmcgJ1wiICsgc2V0dGluZ05hbWUgKyBcIicgZG9lcyBub3QgYXBwZWFyIHRvIGJlIGEgc2V0dGluZy5cIik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBsZXZlbE9yZGVyID0gZ2V0TGV2ZWxPcmRlcihzZXR0aW5nKTtcbiAgICAgICAgaWYgKCFsZXZlbE9yZGVyLmluY2x1ZGVzKFNldHRpbmdMZXZlbC5ERUZBVUxUKSkgbGV2ZWxPcmRlci5wdXNoKFNldHRpbmdMZXZlbC5ERUZBVUxUKTsgLy8gYWx3YXlzIGluY2x1ZGUgZGVmYXVsdFxuXG4gICAgICAgIGNvbnN0IGhhbmRsZXJzID0gU2V0dGluZ3NTdG9yZS5nZXRIYW5kbGVycyhzZXR0aW5nTmFtZSk7XG5cbiAgICAgICAgZm9yIChjb25zdCBsZXZlbCBvZiBsZXZlbE9yZGVyKSB7XG4gICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gaGFuZGxlcnNbbGV2ZWxdO1xuICAgICAgICAgICAgaWYgKCFoYW5kbGVyKSBjb250aW51ZTtcbiAgICAgICAgICAgIHJldHVybiBsZXZlbDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSdW5zIG9yIHF1ZXVlcyBhbnkgc2V0dGluZyBtaWdyYXRpb25zIG5lZWRlZC5cbiAgICAgKi9cbiAgICBwdWJsaWMgc3RhdGljIHJ1bk1pZ3JhdGlvbnMoKTogdm9pZCB7XG4gICAgICAgIC8vIERldiBub3RlczogdG8gYWRkIHlvdXIgbWlncmF0aW9uLCBqdXN0IGFkZCBhIG5ldyBgbWlncmF0ZU15RmVhdHVyZWAgZnVuY3Rpb24sIGNhbGwgaXQsIGFuZFxuICAgICAgICAvLyBhZGQgYSBjb21tZW50IHRvIG5vdGUgd2hlbiBpdCBjYW4gYmUgcmVtb3ZlZC5cblxuICAgICAgICBTZXR0aW5nc1N0b3JlLm1pZ3JhdGVIaWRkZW5SZWFkUmVjZWlwdHMoKTsgLy8gQ2FuIGJlIHJlbW92ZWQgYWZ0ZXIgT2N0b2JlciAyMDIyLlxuICAgIH1cblxuICAgIHByaXZhdGUgc3RhdGljIG1pZ3JhdGVIaWRkZW5SZWFkUmVjZWlwdHMoKTogdm9pZCB7XG4gICAgICAgIGlmIChNYXRyaXhDbGllbnRQZWcuZ2V0KCkuaXNHdWVzdCgpKSByZXR1cm47IC8vIG5vdCB3b3J0aCBpdFxuXG4gICAgICAgIC8vIFdlIHdhaXQgZm9yIHRoZSBmaXJzdCBzeW5jIHRvIGVuc3VyZSB0aGF0IHRoZSB1c2VyJ3MgZXhpc3RpbmcgYWNjb3VudCBkYXRhIGhhcyBsb2FkZWQsIGFzIG90aGVyd2lzZVxuICAgICAgICAvLyBnZXRWYWx1ZSgpIGZvciBhbiBhY2NvdW50LWxldmVsIHNldHRpbmcgbGlrZSBzZW5kUmVhZFJlY2VpcHRzIHdpbGwgcmV0dXJuIGBudWxsYC5cbiAgICAgICAgY29uc3QgZGlzUmVmID0gZGlzcGF0Y2hlci5yZWdpc3RlcigocGF5bG9hZDogQWN0aW9uUGF5bG9hZCkgPT4ge1xuICAgICAgICAgICAgaWYgKHBheWxvYWQuYWN0aW9uID09PSBcIk1hdHJpeEFjdGlvbnMuc3luY1wiKSB7XG4gICAgICAgICAgICAgICAgZGlzcGF0Y2hlci51bnJlZ2lzdGVyKGRpc1JlZik7XG5cbiAgICAgICAgICAgICAgICBjb25zdCByclZhbCA9IFNldHRpbmdzU3RvcmUuZ2V0VmFsdWUoXCJzZW5kUmVhZFJlY2VpcHRzXCIsIG51bGwsIHRydWUpO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgcnJWYWwgIT09IFwiYm9vbGVhblwiKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIG5ldyBzZXR0aW5nIGlzbid0IHNldCAtIHNlZSBpZiB0aGUgbGFicyBmbGFnIHdhcy4gV2UgaGF2ZSB0byBtYW51YWxseSByZWFjaCBpbnRvIHRoZVxuICAgICAgICAgICAgICAgICAgICAvLyBoYW5kbGVyIGZvciB0aGlzIGJlY2F1c2UgaXQgaXNuJ3QgYSBzZXR0aW5nIGFueW1vcmUgKGBnZXRWYWx1ZWAgd2lsbCB5ZWxsIGF0IHVzKS5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaGFuZGxlciA9IExFVkVMX0hBTkRMRVJTW1NldHRpbmdMZXZlbC5ERVZJQ0VdIGFzIERldmljZVNldHRpbmdzSGFuZGxlcjtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGFic1ZhbCA9IGhhbmRsZXIucmVhZEZlYXR1cmUoXCJmZWF0dXJlX2hpZGRlbl9yZWFkX3JlY2VpcHRzXCIpO1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGxhYnNWYWwgPT09IFwiYm9vbGVhblwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBJbnZlcnNlIG9mIGxhYnMgZmxhZyBiZWNhdXNlIG5lZ2F0aXZlLT5wb3NpdGl2ZSBsYW5ndWFnZSBzd2l0Y2ggaW4gc2V0dGluZyBuYW1lXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdWYWwgPSAhbGFic1ZhbDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBTZXR0aW5nIHNlbmRSZWFkUmVjZWlwdHMgdG8gJHtuZXdWYWx9IGJlY2F1c2Ugb2YgcHJldmlvdXNseS1zZXQgbGFicyBmbGFnYCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG5vaW5zcGVjdGlvbiBKU0lnbm9yZWRQcm9taXNlRnJvbUNhbGxcbiAgICAgICAgICAgICAgICAgICAgICAgIFNldHRpbmdzU3RvcmUuc2V0VmFsdWUoXCJzZW5kUmVhZFJlY2VpcHRzXCIsIG51bGwsIFNldHRpbmdMZXZlbC5BQ0NPVU5ULCBuZXdWYWwpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZWJ1Z2dpbmcgZnVuY3Rpb24gZm9yIHJlYWRpbmcgZXhwbGljaXQgc2V0dGluZyB2YWx1ZXMgd2l0aG91dCBnb2luZyB0aHJvdWdoIHRoZVxuICAgICAqIGNvbXBsaWNhdGVkL2JpYXNlZCBmdW5jdGlvbnMgaW4gdGhlIFNldHRpbmdzU3RvcmUuIFRoaXMgd2lsbCBwcmludCBpbmZvcm1hdGlvbiB0b1xuICAgICAqIHRoZSBjb25zb2xlIGZvciBhbmFseXNpcy4gTm90IGludGVuZGVkIHRvIGJlIHVzZWQgd2l0aGluIHRoZSBhcHBsaWNhdGlvbi5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gcmVhbFNldHRpbmdOYW1lIFRoZSBzZXR0aW5nIG5hbWUgdG8gdHJ5IGFuZCByZWFkLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSByb29tSWQgT3B0aW9uYWwgcm9vbSBJRCB0byB0ZXN0IHRoZSBzZXR0aW5nIGluLlxuICAgICAqL1xuICAgIHB1YmxpYyBzdGF0aWMgZGVidWdTZXR0aW5nKHJlYWxTZXR0aW5nTmFtZTogc3RyaW5nLCByb29tSWQ6IHN0cmluZyk6IHZvaWQge1xuICAgICAgICBsb2dnZXIubG9nKGAtLS0gREVCVUcgJHtyZWFsU2V0dGluZ05hbWV9YCk7XG5cbiAgICAgICAgLy8gTm90ZTogd2UgaW50ZW50aW9uYWxseSB1c2UgSlNPTi5zdHJpbmdpZnkgaGVyZSB0byBhdm9pZCB0aGUgY29uc29sZSBtYXNraW5nIHRoZVxuICAgICAgICAvLyBwcm9ibGVtIGlmIHRoZXJlJ3MgYSB0eXBlIHJlcHJlc2VudGF0aW9uIGlzc3VlLiBBbHNvLCB0aGlzIHdheSBpdCBpcyBndWFyYW50ZWVkXG4gICAgICAgIC8vIHRvIHNob3cgdXAgaW4gYSByYWdlc2hha2UgaWYgcmVxdWlyZWQuXG5cbiAgICAgICAgY29uc3QgZGVmID0gU0VUVElOR1NbcmVhbFNldHRpbmdOYW1lXTtcbiAgICAgICAgbG9nZ2VyLmxvZyhgLS0tIGRlZmluaXRpb246ICR7ZGVmID8gSlNPTi5zdHJpbmdpZnkoZGVmKSA6IFwiPE5PVF9GT1VORD5cIn1gKTtcbiAgICAgICAgbG9nZ2VyLmxvZyhgLS0tIGRlZmF1bHQgbGV2ZWwgb3JkZXI6ICR7SlNPTi5zdHJpbmdpZnkoTEVWRUxfT1JERVIpfWApO1xuICAgICAgICBsb2dnZXIubG9nKGAtLS0gcmVnaXN0ZXJlZCBoYW5kbGVyczogJHtKU09OLnN0cmluZ2lmeShPYmplY3Qua2V5cyhMRVZFTF9IQU5ETEVSUykpfWApO1xuXG4gICAgICAgIGNvbnN0IGRvQ2hlY2tzID0gKHNldHRpbmdOYW1lOiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgaGFuZGxlck5hbWUgb2YgT2JqZWN0LmtleXMoTEVWRUxfSEFORExFUlMpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaGFuZGxlciA9IExFVkVMX0hBTkRMRVJTW2hhbmRsZXJOYW1lIGFzIFNldHRpbmdMZXZlbF07XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB2YWx1ZSA9IGhhbmRsZXIuZ2V0VmFsdWUoc2V0dGluZ05hbWUsIHJvb21JZCk7XG4gICAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYC0tLSAgICAgJHtoYW5kbGVyTmFtZX1AJHtyb29tSWQgfHwgXCI8bm9fcm9vbT5cIn0gPSAke0pTT04uc3RyaW5naWZ5KHZhbHVlKX1gKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coXG4gICAgICAgICAgICAgICAgICAgICAgICBgLS0tICAgICAke2hhbmRsZXIuY29uc3RydWN0b3IubmFtZX1AJHtyb29tSWQgfHwgXCI8bm9fcm9vbT5cIn0gVEhSRVcgRVJST1I6ICR7ZS5tZXNzYWdlfWAsXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIGxvZ2dlci5lcnJvcihlKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAocm9vbUlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB2YWx1ZSA9IGhhbmRsZXIuZ2V0VmFsdWUoc2V0dGluZ05hbWUsIG51bGwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgLS0tICAgICAke2hhbmRsZXJOYW1lfUA8bm9fcm9vbT4gPSAke0pTT04uc3RyaW5naWZ5KHZhbHVlKX1gKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgLS0tICAgICAke2hhbmRsZXIuY29uc3RydWN0b3IubmFtZX1APG5vX3Jvb20+IFRIUkVXIEVSUk9SOiAke2UubWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZ2dlci5lcnJvcihlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbG9nZ2VyLmxvZyhgLS0tIGNhbGN1bGF0aW5nIGFzIHJldHVybmVkIGJ5IFNldHRpbmdzU3RvcmVgKTtcbiAgICAgICAgICAgIGxvZ2dlci5sb2coYC0tLSB0aGVzZSBtaWdodCBub3QgbWF0Y2ggaWYgdGhlIHNldHRpbmcgdXNlcyBhIGNvbnRyb2xsZXIgLSBiZSB3YXJuZWQhYCk7XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBTZXR0aW5nc1N0b3JlLmdldFZhbHVlKHNldHRpbmdOYW1lLCByb29tSWQpO1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYC0tLSAgICAgU2V0dGluZ3NTdG9yZSNnZW5lcmljQCR7cm9vbUlkIHx8IFwiPG5vX3Jvb20+XCJ9ICA9ICR7SlNPTi5zdHJpbmdpZnkodmFsdWUpfWApO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYC0tLSAgICAgU2V0dGluZ3NTdG9yZSNnZW5lcmljQCR7cm9vbUlkIHx8IFwiPG5vX3Jvb20+XCJ9IFRIUkVXIEVSUk9SOiAke2UubWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgICBsb2dnZXIuZXJyb3IoZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChyb29tSWQpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB2YWx1ZSA9IFNldHRpbmdzU3RvcmUuZ2V0VmFsdWUoc2V0dGluZ05hbWUsIG51bGwpO1xuICAgICAgICAgICAgICAgICAgICBsb2dnZXIubG9nKGAtLS0gICAgIFNldHRpbmdzU3RvcmUjZ2VuZXJpY0A8bm9fcm9vbT4gID0gJHtKU09OLnN0cmluZ2lmeSh2YWx1ZSl9YCk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICBsb2dnZXIubG9nKGAtLS0gICAgIFNldHRpbmdzU3RvcmUjZ2VuZXJpY0AkPG5vX3Jvb20+IFRIUkVXIEVSUk9SOiAke2UubWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLmVycm9yKGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yIChjb25zdCBsZXZlbCBvZiBMRVZFTF9PUkRFUikge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gU2V0dGluZ3NTdG9yZS5nZXRWYWx1ZUF0KGxldmVsLCBzZXR0aW5nTmFtZSwgcm9vbUlkKTtcbiAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgLS0tICAgICBTZXR0aW5nc1N0b3JlIyR7bGV2ZWx9QCR7cm9vbUlkIHx8IFwiPG5vX3Jvb20+XCJ9ID0gJHtKU09OLnN0cmluZ2lmeSh2YWx1ZSl9YCk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICBsb2dnZXIubG9nKGAtLS0gICAgIFNldHRpbmdzU3RvcmUjJHtsZXZlbH1AJHtyb29tSWQgfHwgXCI8bm9fcm9vbT5cIn0gVEhSRVcgRVJST1I6ICR7ZS5tZXNzYWdlfWApO1xuICAgICAgICAgICAgICAgICAgICBsb2dnZXIuZXJyb3IoZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHJvb21JZCkge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBTZXR0aW5nc1N0b3JlLmdldFZhbHVlQXQobGV2ZWwsIHNldHRpbmdOYW1lLCBudWxsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYC0tLSAgICAgU2V0dGluZ3NTdG9yZSMke2xldmVsfUA8bm9fcm9vbT4gPSAke0pTT04uc3RyaW5naWZ5KHZhbHVlKX1gKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgLS0tICAgICBTZXR0aW5nc1N0b3JlIyR7bGV2ZWx9QCQ8bm9fcm9vbT4gVEhSRVcgRVJST1I6ICR7ZS5tZXNzYWdlfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLmVycm9yKGUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGRvQ2hlY2tzKHJlYWxTZXR0aW5nTmFtZSk7XG5cbiAgICAgICAgaWYgKGRlZi5pbnZlcnRlZFNldHRpbmdOYW1lKSB7XG4gICAgICAgICAgICBsb2dnZXIubG9nKGAtLS0gVEVTVElORyBJTlZFUlRFRCBTRVRUSU5HIE5BTUVgKTtcbiAgICAgICAgICAgIGxvZ2dlci5sb2coYC0tLSBpbnZlcnRlZDogJHtkZWYuaW52ZXJ0ZWRTZXR0aW5nTmFtZX1gKTtcbiAgICAgICAgICAgIGRvQ2hlY2tzKGRlZi5pbnZlcnRlZFNldHRpbmdOYW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxvZ2dlci5sb2coYC0tLSBFTkQgREVCVUdgKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHN0YXRpYyBnZXRIYW5kbGVyKHNldHRpbmdOYW1lOiBzdHJpbmcsIGxldmVsOiBTZXR0aW5nTGV2ZWwpOiBTZXR0aW5nc0hhbmRsZXIgfCBudWxsIHtcbiAgICAgICAgY29uc3QgaGFuZGxlcnMgPSBTZXR0aW5nc1N0b3JlLmdldEhhbmRsZXJzKHNldHRpbmdOYW1lKTtcbiAgICAgICAgaWYgKCFoYW5kbGVyc1tsZXZlbF0pIHJldHVybiBudWxsO1xuICAgICAgICByZXR1cm4gaGFuZGxlcnNbbGV2ZWxdITtcbiAgICB9XG5cbiAgICBwcml2YXRlIHN0YXRpYyBnZXRIYW5kbGVycyhzZXR0aW5nTmFtZTogc3RyaW5nKTogSGFuZGxlck1hcCB7XG4gICAgICAgIGlmICghU0VUVElOR1Nbc2V0dGluZ05hbWVdKSByZXR1cm4ge307XG5cbiAgICAgICAgY29uc3QgaGFuZGxlcnM6IFBhcnRpYWw8UmVjb3JkPFNldHRpbmdMZXZlbCwgU2V0dGluZ3NIYW5kbGVyPj4gPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBsZXZlbCBvZiBTRVRUSU5HU1tzZXR0aW5nTmFtZV0uc3VwcG9ydGVkTGV2ZWxzKSB7XG4gICAgICAgICAgICBpZiAoIUxFVkVMX0hBTkRMRVJTW2xldmVsXSkgdGhyb3cgbmV3IEVycm9yKFwiVW5leHBlY3RlZCBsZXZlbCBcIiArIGxldmVsKTtcbiAgICAgICAgICAgIGlmIChTZXR0aW5nc1N0b3JlLmlzTGV2ZWxTdXBwb3J0ZWQobGV2ZWwpKSBoYW5kbGVyc1tsZXZlbF0gPSBMRVZFTF9IQU5ETEVSU1tsZXZlbF07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBbHdheXMgc3VwcG9ydCAnZGVmYXVsdCdcbiAgICAgICAgaWYgKCFoYW5kbGVyc1tcImRlZmF1bHRcIl0pIGhhbmRsZXJzW1wiZGVmYXVsdFwiXSA9IExFVkVMX0hBTkRMRVJTW1wiZGVmYXVsdFwiXTtcblxuICAgICAgICByZXR1cm4gaGFuZGxlcnM7XG4gICAgfVxufVxuXG4vLyBGb3IgZGVidWdnaW5nIHB1cnBvc2VzXG53aW5kb3cubXhTZXR0aW5nc1N0b3JlID0gU2V0dGluZ3NTdG9yZTtcbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFpQkEsSUFBQUEsT0FBQSxHQUFBQyxPQUFBO0FBR0EsSUFBQUMsc0JBQUEsR0FBQUMsc0JBQUEsQ0FBQUYsT0FBQTtBQUNBLElBQUFHLDBCQUFBLEdBQUFELHNCQUFBLENBQUFGLE9BQUE7QUFDQSxJQUFBSSx1QkFBQSxHQUFBRixzQkFBQSxDQUFBRixPQUFBO0FBQ0EsSUFBQUssMkJBQUEsR0FBQUgsc0JBQUEsQ0FBQUYsT0FBQTtBQUNBLElBQUFNLHVCQUFBLEdBQUFKLHNCQUFBLENBQUFGLE9BQUE7QUFDQSxJQUFBTyxvQkFBQSxHQUFBTCxzQkFBQSxDQUFBRixPQUFBO0FBQ0EsSUFBQVEsc0JBQUEsR0FBQU4sc0JBQUEsQ0FBQUYsT0FBQTtBQUNBLElBQUFTLGdCQUFBLEdBQUFULE9BQUE7QUFDQSxJQUFBVSxXQUFBLEdBQUFSLHNCQUFBLENBQUFGLE9BQUE7QUFDQSxJQUFBVyxTQUFBLEdBQUFYLE9BQUE7QUFDQSxJQUFBWSxpQkFBQSxHQUFBVixzQkFBQSxDQUFBRixP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