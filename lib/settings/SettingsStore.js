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
//# sourceMappingURL=SettingsStore.js.map