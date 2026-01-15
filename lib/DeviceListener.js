"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _logger = require("matrix-js-sdk/src/logger");
var _crypto = require("matrix-js-sdk/src/crypto");
var _matrix = require("matrix-js-sdk/src/matrix");
var _dispatcher = _interopRequireDefault(require("./dispatcher/dispatcher"));
var _BulkUnverifiedSessionsToast = require("./toasts/BulkUnverifiedSessionsToast");
var _SetupEncryptionToast = require("./toasts/SetupEncryptionToast");
var _UnverifiedSessionToast = require("./toasts/UnverifiedSessionToast");
var _SecurityManager = require("./SecurityManager");
var _WellKnownUtils = require("./utils/WellKnownUtils");
var _actions = require("./dispatcher/actions");
var _login = require("./utils/login");
var _SdkConfig = _interopRequireDefault(require("./SdkConfig"));
var _PlatformPeg = _interopRequireDefault(require("./PlatformPeg"));
var _clientInformation = require("./utils/device/clientInformation");
var _SettingsStore = _interopRequireDefault(require("./settings/SettingsStore"));
var _UIFeature = require("./settings/UIFeature");
var _snoozeBulkUnverifiedDeviceReminder = require("./utils/device/snoozeBulkUnverifiedDeviceReminder");
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

const KEY_BACKUP_POLL_INTERVAL = 5 * 60 * 1000;
class DeviceListener {
  constructor() {
    (0, _defineProperty2.default)(this, "dispatcherRef", void 0);
    // device IDs for which the user has dismissed the verify toast ('Later')
    (0, _defineProperty2.default)(this, "dismissed", new Set());
    // has the user dismissed any of the various nag toasts to setup encryption on this device?
    (0, _defineProperty2.default)(this, "dismissedThisDeviceToast", false);
    // cache of the key backup info
    (0, _defineProperty2.default)(this, "keyBackupInfo", null);
    (0, _defineProperty2.default)(this, "keyBackupFetchedAt", null);
    (0, _defineProperty2.default)(this, "keyBackupStatusChecked", false);
    // We keep a list of our own device IDs so we can batch ones that were already
    // there the last time the app launched into a single toast, but display new
    // ones in their own toasts.
    (0, _defineProperty2.default)(this, "ourDeviceIdsAtStart", null);
    // The set of device IDs we're currently displaying toasts for
    (0, _defineProperty2.default)(this, "displayingToastsForDeviceIds", new Set());
    (0, _defineProperty2.default)(this, "running", false);
    // The client with which the instance is running. Only set if `running` is true, otherwise undefined.
    (0, _defineProperty2.default)(this, "client", void 0);
    (0, _defineProperty2.default)(this, "shouldRecordClientInformation", false);
    (0, _defineProperty2.default)(this, "enableBulkUnverifiedSessionsReminder", true);
    (0, _defineProperty2.default)(this, "deviceClientInformationSettingWatcherRef", void 0);
    (0, _defineProperty2.default)(this, "onWillUpdateDevices", async (users, initialFetch) => {
      if (!this.client) return;
      // If we didn't know about *any* devices before (ie. it's fresh login),
      // then they are all pre-existing devices, so ignore this and set the
      // devicesAtStart list to the devices that we see after the fetch.
      if (initialFetch) return;
      const myUserId = this.client.getSafeUserId();
      if (users.includes(myUserId)) await this.ensureDeviceIdsAtStartPopulated();

      // No need to do a recheck here: we just need to get a snapshot of our devices
      // before we download any new ones.
    });
    (0, _defineProperty2.default)(this, "onDevicesUpdated", users => {
      if (!this.client) return;
      if (!users.includes(this.client.getSafeUserId())) return;
      this.recheck();
    });
    (0, _defineProperty2.default)(this, "onDeviceVerificationChanged", userId => {
      if (!this.client) return;
      if (userId !== this.client.getUserId()) return;
      this.recheck();
    });
    (0, _defineProperty2.default)(this, "onUserTrustStatusChanged", userId => {
      if (!this.client) return;
      if (userId !== this.client.getUserId()) return;
      this.recheck();
    });
    (0, _defineProperty2.default)(this, "onCrossSingingKeysChanged", () => {
      this.recheck();
    });
    (0, _defineProperty2.default)(this, "onAccountData", ev => {
      // User may have:
      // * migrated SSSS to symmetric
      // * uploaded keys to secret storage
      // * completed secret storage creation
      // which result in account data changes affecting checks below.
      if (ev.getType().startsWith("m.secret_storage.") || ev.getType().startsWith("m.cross_signing.") || ev.getType() === "m.megolm_backup.v1") {
        this.recheck();
      }
    });
    (0, _defineProperty2.default)(this, "onSync", (state, prevState) => {
      if (state === "PREPARED" && prevState === null) {
        this.recheck();
      }
    });
    (0, _defineProperty2.default)(this, "onRoomStateEvents", ev => {
      if (ev.getType() !== _matrix.EventType.RoomEncryption) return;

      // If a room changes to encrypted, re-check as it may be our first
      // encrypted room. This also catches encrypted room creation as well.
      this.recheck();
    });
    (0, _defineProperty2.default)(this, "onAction", _ref => {
      let {
        action
      } = _ref;
      if (action !== _actions.Action.OnLoggedIn) return;
      this.recheck();
      this.updateClientInformation();
    });
    (0, _defineProperty2.default)(this, "checkKeyBackupStatus", async () => {
      if (this.keyBackupStatusChecked || !this.client) {
        return;
      }
      // returns null when key backup status hasn't finished being checked
      const isKeyBackupEnabled = this.client.getKeyBackupEnabled();
      this.keyBackupStatusChecked = isKeyBackupEnabled !== null;
      if (isKeyBackupEnabled === false) {
        _dispatcher.default.dispatch({
          action: _actions.Action.ReportKeyBackupNotEnabled
        });
      }
    });
    (0, _defineProperty2.default)(this, "onRecordClientInformationSettingChange", (_originalSettingName, _roomId, _level, _newLevel, newValue) => {
      const prevValue = this.shouldRecordClientInformation;
      this.shouldRecordClientInformation = !!newValue;
      if (this.shouldRecordClientInformation !== prevValue) {
        this.updateClientInformation();
      }
    });
    (0, _defineProperty2.default)(this, "updateClientInformation", async () => {
      if (!this.client) return;
      try {
        if (this.shouldRecordClientInformation) {
          await (0, _clientInformation.recordClientInformation)(this.client, _SdkConfig.default.get(), _PlatformPeg.default.get() ?? undefined);
        } else {
          await (0, _clientInformation.removeClientInformation)(this.client);
        }
      } catch (error) {
        // this is a best effort operation
        // log the error without rethrowing
        _logger.logger.error("Failed to update client information", error);
      }
    });
  }
  static sharedInstance() {
    if (!window.mxDeviceListener) window.mxDeviceListener = new DeviceListener();
    return window.mxDeviceListener;
  }
  start(matrixClient) {
    this.running = true;
    this.client = matrixClient;
    this.client.on(_crypto.CryptoEvent.WillUpdateDevices, this.onWillUpdateDevices);
    this.client.on(_crypto.CryptoEvent.DevicesUpdated, this.onDevicesUpdated);
    this.client.on(_crypto.CryptoEvent.DeviceVerificationChanged, this.onDeviceVerificationChanged);
    this.client.on(_crypto.CryptoEvent.UserTrustStatusChanged, this.onUserTrustStatusChanged);
    this.client.on(_crypto.CryptoEvent.KeysChanged, this.onCrossSingingKeysChanged);
    this.client.on(_matrix.ClientEvent.AccountData, this.onAccountData);
    this.client.on(_matrix.ClientEvent.Sync, this.onSync);
    this.client.on(_matrix.RoomStateEvent.Events, this.onRoomStateEvents);
    this.shouldRecordClientInformation = _SettingsStore.default.getValue("deviceClientInformationOptIn");
    // only configurable in config, so we don't need to watch the value
    this.enableBulkUnverifiedSessionsReminder = _SettingsStore.default.getValue(_UIFeature.UIFeature.BulkUnverifiedSessionsReminder);
    this.deviceClientInformationSettingWatcherRef = _SettingsStore.default.watchSetting("deviceClientInformationOptIn", null, this.onRecordClientInformationSettingChange);
    this.dispatcherRef = _dispatcher.default.register(this.onAction);
    this.recheck();
    this.updateClientInformation();
  }
  stop() {
    this.running = false;
    if (this.client) {
      this.client.removeListener(_crypto.CryptoEvent.WillUpdateDevices, this.onWillUpdateDevices);
      this.client.removeListener(_crypto.CryptoEvent.DevicesUpdated, this.onDevicesUpdated);
      this.client.removeListener(_crypto.CryptoEvent.DeviceVerificationChanged, this.onDeviceVerificationChanged);
      this.client.removeListener(_crypto.CryptoEvent.UserTrustStatusChanged, this.onUserTrustStatusChanged);
      this.client.removeListener(_crypto.CryptoEvent.KeysChanged, this.onCrossSingingKeysChanged);
      this.client.removeListener(_matrix.ClientEvent.AccountData, this.onAccountData);
      this.client.removeListener(_matrix.ClientEvent.Sync, this.onSync);
      this.client.removeListener(_matrix.RoomStateEvent.Events, this.onRoomStateEvents);
    }
    if (this.deviceClientInformationSettingWatcherRef) {
      _SettingsStore.default.unwatchSetting(this.deviceClientInformationSettingWatcherRef);
    }
    if (this.dispatcherRef) {
      _dispatcher.default.unregister(this.dispatcherRef);
      this.dispatcherRef = undefined;
    }
    this.dismissed.clear();
    this.dismissedThisDeviceToast = false;
    this.keyBackupInfo = null;
    this.keyBackupFetchedAt = null;
    this.keyBackupStatusChecked = false;
    this.ourDeviceIdsAtStart = null;
    this.displayingToastsForDeviceIds = new Set();
    this.client = undefined;
  }

  /**
   * Dismiss notifications about our own unverified devices
   *
   * @param {String[]} deviceIds List of device IDs to dismiss notifications for
   */
  async dismissUnverifiedSessions(deviceIds) {
    _logger.logger.log("Dismissing unverified sessions: " + Array.from(deviceIds).join(","));
    for (const d of deviceIds) {
      this.dismissed.add(d);
    }
    this.recheck();
  }
  dismissEncryptionSetup() {
    this.dismissedThisDeviceToast = true;
    this.recheck();
  }
  async ensureDeviceIdsAtStartPopulated() {
    if (this.ourDeviceIdsAtStart === null) {
      this.ourDeviceIdsAtStart = await this.getDeviceIds();
    }
  }

  /** Get the device list for the current user
   *
   * @returns the set of device IDs
   */
  async getDeviceIds() {
    const cli = this.client;
    const crypto = cli?.getCrypto();
    if (crypto === undefined) return new Set();
    const userId = cli.getSafeUserId();
    const devices = await crypto.getUserDeviceInfo([userId]);
    return new Set(devices.get(userId)?.keys() ?? []);
  }
  // The server doesn't tell us when key backup is set up, so we poll
  // & cache the result
  async getKeyBackupInfo() {
    if (!this.client) return null;
    const now = new Date().getTime();
    if (!this.keyBackupInfo || !this.keyBackupFetchedAt || this.keyBackupFetchedAt < now - KEY_BACKUP_POLL_INTERVAL) {
      this.keyBackupInfo = await this.client.getKeyBackupVersion();
      this.keyBackupFetchedAt = now;
    }
    return this.keyBackupInfo;
  }
  shouldShowSetupEncryptionToast() {
    // If we're in the middle of a secret storage operation, we're likely
    // modifying the state involved here, so don't add new toasts to setup.
    if ((0, _SecurityManager.isSecretStorageBeingAccessed)()) return false;
    // Show setup toasts once the user is in at least one encrypted room.
    const cli = this.client;
    return cli?.getRooms().some(r => cli.isRoomEncrypted(r.roomId)) ?? false;
  }
  async recheck() {
    if (!this.running || !this.client) return; // we have been stopped
    const cli = this.client;

    // cross-signing support was added to Matrix in MSC1756, which landed in spec v1.1
    if (!(await cli.isVersionSupported("v1.1"))) return;
    const crypto = cli.getCrypto();
    if (!crypto) return;

    // don't recheck until the initial sync is complete: lots of account data events will fire
    // while the initial sync is processing and we don't need to recheck on each one of them
    // (we add a listener on sync to do once check after the initial sync is done)
    if (!cli.isInitialSyncComplete()) return;
    const crossSigningReady = await crypto.isCrossSigningReady();
    const secretStorageReady = await crypto.isSecretStorageReady();
    const allSystemsReady = crossSigningReady && secretStorageReady;
    if (this.dismissedThisDeviceToast || allSystemsReady) {
      (0, _SetupEncryptionToast.hideToast)();
      this.checkKeyBackupStatus();
    } else if (this.shouldShowSetupEncryptionToast()) {
      // make sure our keys are finished downloading
      await crypto.getUserDeviceInfo([cli.getSafeUserId()]);

      // cross signing isn't enabled - nag to enable it
      // There are 3 different toasts for:
      if (!(await crypto.getCrossSigningKeyId()) && cli.getStoredCrossSigningForUser(cli.getSafeUserId())) {
        // Cross-signing on account but this device doesn't trust the master key (verify this session)
        (0, _SetupEncryptionToast.showToast)(_SetupEncryptionToast.Kind.VERIFY_THIS_SESSION);
        this.checkKeyBackupStatus();
      } else {
        const backupInfo = await this.getKeyBackupInfo();
        if (backupInfo) {
          // No cross-signing on account but key backup available (upgrade encryption)
          (0, _SetupEncryptionToast.showToast)(_SetupEncryptionToast.Kind.UPGRADE_ENCRYPTION);
        } else {
          // No cross-signing or key backup on account (set up encryption)
          await cli.waitForClientWellKnown();
          if ((0, _WellKnownUtils.isSecureBackupRequired)(cli) && (0, _login.isLoggedIn)()) {
            // If we're meant to set up, and Secure Backup is required,
            // trigger the flow directly without a toast once logged in.
            (0, _SetupEncryptionToast.hideToast)();
            (0, _SecurityManager.accessSecretStorage)();
          } else {
            (0, _SetupEncryptionToast.showToast)(_SetupEncryptionToast.Kind.SET_UP_ENCRYPTION);
          }
        }
      }
    }

    // This needs to be done after awaiting on getUserDeviceInfo() above, so
    // we make sure we get the devices after the fetch is done.
    await this.ensureDeviceIdsAtStartPopulated();

    // Unverified devices that were there last time the app ran
    // (technically could just be a boolean: we don't actually
    // need to remember the device IDs, but for the sake of
    // symmetry...).
    const oldUnverifiedDeviceIds = new Set();
    // Unverified devices that have appeared since then
    const newUnverifiedDeviceIds = new Set();
    const isCurrentDeviceTrusted = crossSigningReady && Boolean((await crypto.getDeviceVerificationStatus(cli.getSafeUserId(), cli.deviceId))?.crossSigningVerified);

    // as long as cross-signing isn't ready,
    // you can't see or dismiss any device toasts
    if (crossSigningReady) {
      const devices = await this.getDeviceIds();
      for (const deviceId of devices) {
        if (deviceId === cli.deviceId) continue;
        const deviceTrust = await crypto.getDeviceVerificationStatus(cli.getSafeUserId(), deviceId);
        if (!deviceTrust?.crossSigningVerified && !this.dismissed.has(deviceId)) {
          if (this.ourDeviceIdsAtStart?.has(deviceId)) {
            oldUnverifiedDeviceIds.add(deviceId);
          } else {
            newUnverifiedDeviceIds.add(deviceId);
          }
        }
      }
    }
    _logger.logger.debug("Old unverified sessions: " + Array.from(oldUnverifiedDeviceIds).join(","));
    _logger.logger.debug("New unverified sessions: " + Array.from(newUnverifiedDeviceIds).join(","));
    _logger.logger.debug("Currently showing toasts for: " + Array.from(this.displayingToastsForDeviceIds).join(","));
    const isBulkUnverifiedSessionsReminderSnoozed = (0, _snoozeBulkUnverifiedDeviceReminder.isBulkUnverifiedDeviceReminderSnoozed)();

    // Display or hide the batch toast for old unverified sessions
    // don't show the toast if the current device is unverified
    if (oldUnverifiedDeviceIds.size > 0 && isCurrentDeviceTrusted && this.enableBulkUnverifiedSessionsReminder && !isBulkUnverifiedSessionsReminderSnoozed) {
      (0, _BulkUnverifiedSessionsToast.showToast)(oldUnverifiedDeviceIds);
    } else {
      (0, _BulkUnverifiedSessionsToast.hideToast)();
    }

    // Show toasts for new unverified devices if they aren't already there
    for (const deviceId of newUnverifiedDeviceIds) {
      (0, _UnverifiedSessionToast.showToast)(deviceId);
    }

    // ...and hide any we don't need any more
    for (const deviceId of this.displayingToastsForDeviceIds) {
      if (!newUnverifiedDeviceIds.has(deviceId)) {
        _logger.logger.debug("Hiding unverified session toast for " + deviceId);
        (0, _UnverifiedSessionToast.hideToast)(deviceId);
      }
    }
    this.displayingToastsForDeviceIds = newUnverifiedDeviceIds;
  }
}
exports.default = DeviceListener;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfbG9nZ2VyIiwicmVxdWlyZSIsIl9jcnlwdG8iLCJfbWF0cml4IiwiX2Rpc3BhdGNoZXIiLCJfaW50ZXJvcFJlcXVpcmVEZWZhdWx0IiwiX0J1bGtVbnZlcmlmaWVkU2Vzc2lvbnNUb2FzdCIsIl9TZXR1cEVuY3J5cHRpb25Ub2FzdCIsIl9VbnZlcmlmaWVkU2Vzc2lvblRvYXN0IiwiX1NlY3VyaXR5TWFuYWdlciIsIl9XZWxsS25vd25VdGlscyIsIl9hY3Rpb25zIiwiX2xvZ2luIiwiX1Nka0NvbmZpZyIsIl9QbGF0Zm9ybVBlZyIsIl9jbGllbnRJbmZvcm1hdGlvbiIsIl9TZXR0aW5nc1N0b3JlIiwiX1VJRmVhdHVyZSIsIl9zbm9vemVCdWxrVW52ZXJpZmllZERldmljZVJlbWluZGVyIiwiS0VZX0JBQ0tVUF9QT0xMX0lOVEVSVkFMIiwiRGV2aWNlTGlzdGVuZXIiLCJjb25zdHJ1Y3RvciIsIl9kZWZpbmVQcm9wZXJ0eTIiLCJkZWZhdWx0IiwiU2V0IiwidXNlcnMiLCJpbml0aWFsRmV0Y2giLCJjbGllbnQiLCJteVVzZXJJZCIsImdldFNhZmVVc2VySWQiLCJpbmNsdWRlcyIsImVuc3VyZURldmljZUlkc0F0U3RhcnRQb3B1bGF0ZWQiLCJyZWNoZWNrIiwidXNlcklkIiwiZ2V0VXNlcklkIiwiZXYiLCJnZXRUeXBlIiwic3RhcnRzV2l0aCIsInN0YXRlIiwicHJldlN0YXRlIiwiRXZlbnRUeXBlIiwiUm9vbUVuY3J5cHRpb24iLCJfcmVmIiwiYWN0aW9uIiwiQWN0aW9uIiwiT25Mb2dnZWRJbiIsInVwZGF0ZUNsaWVudEluZm9ybWF0aW9uIiwia2V5QmFja3VwU3RhdHVzQ2hlY2tlZCIsImlzS2V5QmFja3VwRW5hYmxlZCIsImdldEtleUJhY2t1cEVuYWJsZWQiLCJkaXMiLCJkaXNwYXRjaCIsIlJlcG9ydEtleUJhY2t1cE5vdEVuYWJsZWQiLCJfb3JpZ2luYWxTZXR0aW5nTmFtZSIsIl9yb29tSWQiLCJfbGV2ZWwiLCJfbmV3TGV2ZWwiLCJuZXdWYWx1ZSIsInByZXZWYWx1ZSIsInNob3VsZFJlY29yZENsaWVudEluZm9ybWF0aW9uIiwicmVjb3JkQ2xpZW50SW5mb3JtYXRpb24iLCJTZGtDb25maWciLCJnZXQiLCJQbGF0Zm9ybVBlZyIsInVuZGVmaW5lZCIsInJlbW92ZUNsaWVudEluZm9ybWF0aW9uIiwiZXJyb3IiLCJsb2dnZXIiLCJzaGFyZWRJbnN0YW5jZSIsIndpbmRvdyIsIm14RGV2aWNlTGlzdGVuZXIiLCJzdGFydCIsIm1hdHJpeENsaWVudCIsInJ1bm5pbmciLCJvbiIsIkNyeXB0b0V2ZW50IiwiV2lsbFVwZGF0ZURldmljZXMiLCJvbldpbGxVcGRhdGVEZXZpY2VzIiwiRGV2aWNlc1VwZGF0ZWQiLCJvbkRldmljZXNVcGRhdGVkIiwiRGV2aWNlVmVyaWZpY2F0aW9uQ2hhbmdlZCIsIm9uRGV2aWNlVmVyaWZpY2F0aW9uQ2hhbmdlZCIsIlVzZXJUcnVzdFN0YXR1c0NoYW5nZWQiLCJvblVzZXJUcnVzdFN0YXR1c0NoYW5nZWQiLCJLZXlzQ2hhbmdlZCIsIm9uQ3Jvc3NTaW5naW5nS2V5c0NoYW5nZWQiLCJDbGllbnRFdmVudCIsIkFjY291bnREYXRhIiwib25BY2NvdW50RGF0YSIsIlN5bmMiLCJvblN5bmMiLCJSb29tU3RhdGVFdmVudCIsIkV2ZW50cyIsIm9uUm9vbVN0YXRlRXZlbnRzIiwiU2V0dGluZ3NTdG9yZSIsImdldFZhbHVlIiwiZW5hYmxlQnVsa1VudmVyaWZpZWRTZXNzaW9uc1JlbWluZGVyIiwiVUlGZWF0dXJlIiwiQnVsa1VudmVyaWZpZWRTZXNzaW9uc1JlbWluZGVyIiwiZGV2aWNlQ2xpZW50SW5mb3JtYXRpb25TZXR0aW5nV2F0Y2hlclJlZiIsIndhdGNoU2V0dGluZyIsIm9uUmVjb3JkQ2xpZW50SW5mb3JtYXRpb25TZXR0aW5nQ2hhbmdlIiwiZGlzcGF0Y2hlclJlZiIsInJlZ2lzdGVyIiwib25BY3Rpb24iLCJzdG9wIiwicmVtb3ZlTGlzdGVuZXIiLCJ1bndhdGNoU2V0dGluZyIsInVucmVnaXN0ZXIiLCJkaXNtaXNzZWQiLCJjbGVhciIsImRpc21pc3NlZFRoaXNEZXZpY2VUb2FzdCIsImtleUJhY2t1cEluZm8iLCJrZXlCYWNrdXBGZXRjaGVkQXQiLCJvdXJEZXZpY2VJZHNBdFN0YXJ0IiwiZGlzcGxheWluZ1RvYXN0c0ZvckRldmljZUlkcyIsImRpc21pc3NVbnZlcmlmaWVkU2Vzc2lvbnMiLCJkZXZpY2VJZHMiLCJsb2ciLCJBcnJheSIsImZyb20iLCJqb2luIiwiZCIsImFkZCIsImRpc21pc3NFbmNyeXB0aW9uU2V0dXAiLCJnZXREZXZpY2VJZHMiLCJjbGkiLCJjcnlwdG8iLCJnZXRDcnlwdG8iLCJkZXZpY2VzIiwiZ2V0VXNlckRldmljZUluZm8iLCJrZXlzIiwiZ2V0S2V5QmFja3VwSW5mbyIsIm5vdyIsIkRhdGUiLCJnZXRUaW1lIiwiZ2V0S2V5QmFja3VwVmVyc2lvbiIsInNob3VsZFNob3dTZXR1cEVuY3J5cHRpb25Ub2FzdCIsImlzU2VjcmV0U3RvcmFnZUJlaW5nQWNjZXNzZWQiLCJnZXRSb29tcyIsInNvbWUiLCJyIiwiaXNSb29tRW5jcnlwdGVkIiwicm9vbUlkIiwiaXNWZXJzaW9uU3VwcG9ydGVkIiwiaXNJbml0aWFsU3luY0NvbXBsZXRlIiwiY3Jvc3NTaWduaW5nUmVhZHkiLCJpc0Nyb3NzU2lnbmluZ1JlYWR5Iiwic2VjcmV0U3RvcmFnZVJlYWR5IiwiaXNTZWNyZXRTdG9yYWdlUmVhZHkiLCJhbGxTeXN0ZW1zUmVhZHkiLCJoaWRlU2V0dXBFbmNyeXB0aW9uVG9hc3QiLCJjaGVja0tleUJhY2t1cFN0YXR1cyIsImdldENyb3NzU2lnbmluZ0tleUlkIiwiZ2V0U3RvcmVkQ3Jvc3NTaWduaW5nRm9yVXNlciIsInNob3dTZXR1cEVuY3J5cHRpb25Ub2FzdCIsIlNldHVwS2luZCIsIlZFUklGWV9USElTX1NFU1NJT04iLCJiYWNrdXBJbmZvIiwiVVBHUkFERV9FTkNSWVBUSU9OIiwid2FpdEZvckNsaWVudFdlbGxLbm93biIsImlzU2VjdXJlQmFja3VwUmVxdWlyZWQiLCJpc0xvZ2dlZEluIiwiYWNjZXNzU2VjcmV0U3RvcmFnZSIsIlNFVF9VUF9FTkNSWVBUSU9OIiwib2xkVW52ZXJpZmllZERldmljZUlkcyIsIm5ld1VudmVyaWZpZWREZXZpY2VJZHMiLCJpc0N1cnJlbnREZXZpY2VUcnVzdGVkIiwiQm9vbGVhbiIsImdldERldmljZVZlcmlmaWNhdGlvblN0YXR1cyIsImRldmljZUlkIiwiY3Jvc3NTaWduaW5nVmVyaWZpZWQiLCJkZXZpY2VUcnVzdCIsImhhcyIsImRlYnVnIiwiaXNCdWxrVW52ZXJpZmllZFNlc3Npb25zUmVtaW5kZXJTbm9vemVkIiwiaXNCdWxrVW52ZXJpZmllZERldmljZVJlbWluZGVyU25vb3plZCIsInNpemUiLCJzaG93QnVsa1VudmVyaWZpZWRTZXNzaW9uc1RvYXN0IiwiaGlkZUJ1bGtVbnZlcmlmaWVkU2Vzc2lvbnNUb2FzdCIsInNob3dVbnZlcmlmaWVkU2Vzc2lvbnNUb2FzdCIsImhpZGVVbnZlcmlmaWVkU2Vzc2lvbnNUb2FzdCIsImV4cG9ydHMiXSwic291cmNlcyI6WyIuLi9zcmMvRGV2aWNlTGlzdGVuZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbkNvcHlyaWdodCAyMDIwIFRoZSBNYXRyaXgub3JnIEZvdW5kYXRpb24gQy5JLkMuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuKi9cblxuaW1wb3J0IHsgTWF0cml4RXZlbnQgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbW9kZWxzL2V2ZW50XCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbG9nZ2VyXCI7XG5pbXBvcnQgeyBDcnlwdG9FdmVudCB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9jcnlwdG9cIjtcbmltcG9ydCB7IENsaWVudEV2ZW50LCBFdmVudFR5cGUsIE1hdHJpeENsaWVudCwgUm9vbVN0YXRlRXZlbnQgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbWF0cml4XCI7XG5pbXBvcnQgeyBTeW5jU3RhdGUgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvc3luY1wiO1xuaW1wb3J0IHsgSUtleUJhY2t1cEluZm8gfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvY3J5cHRvL2tleWJhY2t1cFwiO1xuXG5pbXBvcnQgZGlzIGZyb20gXCIuL2Rpc3BhdGNoZXIvZGlzcGF0Y2hlclwiO1xuaW1wb3J0IHtcbiAgICBoaWRlVG9hc3QgYXMgaGlkZUJ1bGtVbnZlcmlmaWVkU2Vzc2lvbnNUb2FzdCxcbiAgICBzaG93VG9hc3QgYXMgc2hvd0J1bGtVbnZlcmlmaWVkU2Vzc2lvbnNUb2FzdCxcbn0gZnJvbSBcIi4vdG9hc3RzL0J1bGtVbnZlcmlmaWVkU2Vzc2lvbnNUb2FzdFwiO1xuaW1wb3J0IHtcbiAgICBoaWRlVG9hc3QgYXMgaGlkZVNldHVwRW5jcnlwdGlvblRvYXN0LFxuICAgIEtpbmQgYXMgU2V0dXBLaW5kLFxuICAgIHNob3dUb2FzdCBhcyBzaG93U2V0dXBFbmNyeXB0aW9uVG9hc3QsXG59IGZyb20gXCIuL3RvYXN0cy9TZXR1cEVuY3J5cHRpb25Ub2FzdFwiO1xuaW1wb3J0IHtcbiAgICBoaWRlVG9hc3QgYXMgaGlkZVVudmVyaWZpZWRTZXNzaW9uc1RvYXN0LFxuICAgIHNob3dUb2FzdCBhcyBzaG93VW52ZXJpZmllZFNlc3Npb25zVG9hc3QsXG59IGZyb20gXCIuL3RvYXN0cy9VbnZlcmlmaWVkU2Vzc2lvblRvYXN0XCI7XG5pbXBvcnQgeyBhY2Nlc3NTZWNyZXRTdG9yYWdlLCBpc1NlY3JldFN0b3JhZ2VCZWluZ0FjY2Vzc2VkIH0gZnJvbSBcIi4vU2VjdXJpdHlNYW5hZ2VyXCI7XG5pbXBvcnQgeyBpc1NlY3VyZUJhY2t1cFJlcXVpcmVkIH0gZnJvbSBcIi4vdXRpbHMvV2VsbEtub3duVXRpbHNcIjtcbmltcG9ydCB7IEFjdGlvblBheWxvYWQgfSBmcm9tIFwiLi9kaXNwYXRjaGVyL3BheWxvYWRzXCI7XG5pbXBvcnQgeyBBY3Rpb24gfSBmcm9tIFwiLi9kaXNwYXRjaGVyL2FjdGlvbnNcIjtcbmltcG9ydCB7IGlzTG9nZ2VkSW4gfSBmcm9tIFwiLi91dGlscy9sb2dpblwiO1xuaW1wb3J0IFNka0NvbmZpZyBmcm9tIFwiLi9TZGtDb25maWdcIjtcbmltcG9ydCBQbGF0Zm9ybVBlZyBmcm9tIFwiLi9QbGF0Zm9ybVBlZ1wiO1xuaW1wb3J0IHsgcmVjb3JkQ2xpZW50SW5mb3JtYXRpb24sIHJlbW92ZUNsaWVudEluZm9ybWF0aW9uIH0gZnJvbSBcIi4vdXRpbHMvZGV2aWNlL2NsaWVudEluZm9ybWF0aW9uXCI7XG5pbXBvcnQgU2V0dGluZ3NTdG9yZSwgeyBDYWxsYmFja0ZuIH0gZnJvbSBcIi4vc2V0dGluZ3MvU2V0dGluZ3NTdG9yZVwiO1xuaW1wb3J0IHsgVUlGZWF0dXJlIH0gZnJvbSBcIi4vc2V0dGluZ3MvVUlGZWF0dXJlXCI7XG5pbXBvcnQgeyBpc0J1bGtVbnZlcmlmaWVkRGV2aWNlUmVtaW5kZXJTbm9vemVkIH0gZnJvbSBcIi4vdXRpbHMvZGV2aWNlL3Nub296ZUJ1bGtVbnZlcmlmaWVkRGV2aWNlUmVtaW5kZXJcIjtcblxuY29uc3QgS0VZX0JBQ0tVUF9QT0xMX0lOVEVSVkFMID0gNSAqIDYwICogMTAwMDtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRGV2aWNlTGlzdGVuZXIge1xuICAgIHByaXZhdGUgZGlzcGF0Y2hlclJlZj86IHN0cmluZztcbiAgICAvLyBkZXZpY2UgSURzIGZvciB3aGljaCB0aGUgdXNlciBoYXMgZGlzbWlzc2VkIHRoZSB2ZXJpZnkgdG9hc3QgKCdMYXRlcicpXG4gICAgcHJpdmF0ZSBkaXNtaXNzZWQgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICAvLyBoYXMgdGhlIHVzZXIgZGlzbWlzc2VkIGFueSBvZiB0aGUgdmFyaW91cyBuYWcgdG9hc3RzIHRvIHNldHVwIGVuY3J5cHRpb24gb24gdGhpcyBkZXZpY2U/XG4gICAgcHJpdmF0ZSBkaXNtaXNzZWRUaGlzRGV2aWNlVG9hc3QgPSBmYWxzZTtcbiAgICAvLyBjYWNoZSBvZiB0aGUga2V5IGJhY2t1cCBpbmZvXG4gICAgcHJpdmF0ZSBrZXlCYWNrdXBJbmZvOiBJS2V5QmFja3VwSW5mbyB8IG51bGwgPSBudWxsO1xuICAgIHByaXZhdGUga2V5QmFja3VwRmV0Y2hlZEF0OiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgICBwcml2YXRlIGtleUJhY2t1cFN0YXR1c0NoZWNrZWQgPSBmYWxzZTtcbiAgICAvLyBXZSBrZWVwIGEgbGlzdCBvZiBvdXIgb3duIGRldmljZSBJRHMgc28gd2UgY2FuIGJhdGNoIG9uZXMgdGhhdCB3ZXJlIGFscmVhZHlcbiAgICAvLyB0aGVyZSB0aGUgbGFzdCB0aW1lIHRoZSBhcHAgbGF1bmNoZWQgaW50byBhIHNpbmdsZSB0b2FzdCwgYnV0IGRpc3BsYXkgbmV3XG4gICAgLy8gb25lcyBpbiB0aGVpciBvd24gdG9hc3RzLlxuICAgIHByaXZhdGUgb3VyRGV2aWNlSWRzQXRTdGFydDogU2V0PHN0cmluZz4gfCBudWxsID0gbnVsbDtcbiAgICAvLyBUaGUgc2V0IG9mIGRldmljZSBJRHMgd2UncmUgY3VycmVudGx5IGRpc3BsYXlpbmcgdG9hc3RzIGZvclxuICAgIHByaXZhdGUgZGlzcGxheWluZ1RvYXN0c0ZvckRldmljZUlkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIHByaXZhdGUgcnVubmluZyA9IGZhbHNlO1xuICAgIC8vIFRoZSBjbGllbnQgd2l0aCB3aGljaCB0aGUgaW5zdGFuY2UgaXMgcnVubmluZy4gT25seSBzZXQgaWYgYHJ1bm5pbmdgIGlzIHRydWUsIG90aGVyd2lzZSB1bmRlZmluZWQuXG4gICAgcHJpdmF0ZSBjbGllbnQ/OiBNYXRyaXhDbGllbnQ7XG4gICAgcHJpdmF0ZSBzaG91bGRSZWNvcmRDbGllbnRJbmZvcm1hdGlvbiA9IGZhbHNlO1xuICAgIHByaXZhdGUgZW5hYmxlQnVsa1VudmVyaWZpZWRTZXNzaW9uc1JlbWluZGVyID0gdHJ1ZTtcbiAgICBwcml2YXRlIGRldmljZUNsaWVudEluZm9ybWF0aW9uU2V0dGluZ1dhdGNoZXJSZWY6IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuICAgIHB1YmxpYyBzdGF0aWMgc2hhcmVkSW5zdGFuY2UoKTogRGV2aWNlTGlzdGVuZXIge1xuICAgICAgICBpZiAoIXdpbmRvdy5teERldmljZUxpc3RlbmVyKSB3aW5kb3cubXhEZXZpY2VMaXN0ZW5lciA9IG5ldyBEZXZpY2VMaXN0ZW5lcigpO1xuICAgICAgICByZXR1cm4gd2luZG93Lm14RGV2aWNlTGlzdGVuZXI7XG4gICAgfVxuXG4gICAgcHVibGljIHN0YXJ0KG1hdHJpeENsaWVudDogTWF0cml4Q2xpZW50KTogdm9pZCB7XG4gICAgICAgIHRoaXMucnVubmluZyA9IHRydWU7XG4gICAgICAgIHRoaXMuY2xpZW50ID0gbWF0cml4Q2xpZW50O1xuICAgICAgICB0aGlzLmNsaWVudC5vbihDcnlwdG9FdmVudC5XaWxsVXBkYXRlRGV2aWNlcywgdGhpcy5vbldpbGxVcGRhdGVEZXZpY2VzKTtcbiAgICAgICAgdGhpcy5jbGllbnQub24oQ3J5cHRvRXZlbnQuRGV2aWNlc1VwZGF0ZWQsIHRoaXMub25EZXZpY2VzVXBkYXRlZCk7XG4gICAgICAgIHRoaXMuY2xpZW50Lm9uKENyeXB0b0V2ZW50LkRldmljZVZlcmlmaWNhdGlvbkNoYW5nZWQsIHRoaXMub25EZXZpY2VWZXJpZmljYXRpb25DaGFuZ2VkKTtcbiAgICAgICAgdGhpcy5jbGllbnQub24oQ3J5cHRvRXZlbnQuVXNlclRydXN0U3RhdHVzQ2hhbmdlZCwgdGhpcy5vblVzZXJUcnVzdFN0YXR1c0NoYW5nZWQpO1xuICAgICAgICB0aGlzLmNsaWVudC5vbihDcnlwdG9FdmVudC5LZXlzQ2hhbmdlZCwgdGhpcy5vbkNyb3NzU2luZ2luZ0tleXNDaGFuZ2VkKTtcbiAgICAgICAgdGhpcy5jbGllbnQub24oQ2xpZW50RXZlbnQuQWNjb3VudERhdGEsIHRoaXMub25BY2NvdW50RGF0YSk7XG4gICAgICAgIHRoaXMuY2xpZW50Lm9uKENsaWVudEV2ZW50LlN5bmMsIHRoaXMub25TeW5jKTtcbiAgICAgICAgdGhpcy5jbGllbnQub24oUm9vbVN0YXRlRXZlbnQuRXZlbnRzLCB0aGlzLm9uUm9vbVN0YXRlRXZlbnRzKTtcbiAgICAgICAgdGhpcy5zaG91bGRSZWNvcmRDbGllbnRJbmZvcm1hdGlvbiA9IFNldHRpbmdzU3RvcmUuZ2V0VmFsdWUoXCJkZXZpY2VDbGllbnRJbmZvcm1hdGlvbk9wdEluXCIpO1xuICAgICAgICAvLyBvbmx5IGNvbmZpZ3VyYWJsZSBpbiBjb25maWcsIHNvIHdlIGRvbid0IG5lZWQgdG8gd2F0Y2ggdGhlIHZhbHVlXG4gICAgICAgIHRoaXMuZW5hYmxlQnVsa1VudmVyaWZpZWRTZXNzaW9uc1JlbWluZGVyID0gU2V0dGluZ3NTdG9yZS5nZXRWYWx1ZShVSUZlYXR1cmUuQnVsa1VudmVyaWZpZWRTZXNzaW9uc1JlbWluZGVyKTtcbiAgICAgICAgdGhpcy5kZXZpY2VDbGllbnRJbmZvcm1hdGlvblNldHRpbmdXYXRjaGVyUmVmID0gU2V0dGluZ3NTdG9yZS53YXRjaFNldHRpbmcoXG4gICAgICAgICAgICBcImRldmljZUNsaWVudEluZm9ybWF0aW9uT3B0SW5cIixcbiAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICB0aGlzLm9uUmVjb3JkQ2xpZW50SW5mb3JtYXRpb25TZXR0aW5nQ2hhbmdlLFxuICAgICAgICApO1xuICAgICAgICB0aGlzLmRpc3BhdGNoZXJSZWYgPSBkaXMucmVnaXN0ZXIodGhpcy5vbkFjdGlvbik7XG4gICAgICAgIHRoaXMucmVjaGVjaygpO1xuICAgICAgICB0aGlzLnVwZGF0ZUNsaWVudEluZm9ybWF0aW9uKCk7XG4gICAgfVxuXG4gICAgcHVibGljIHN0b3AoKTogdm9pZCB7XG4gICAgICAgIHRoaXMucnVubmluZyA9IGZhbHNlO1xuICAgICAgICBpZiAodGhpcy5jbGllbnQpIHtcbiAgICAgICAgICAgIHRoaXMuY2xpZW50LnJlbW92ZUxpc3RlbmVyKENyeXB0b0V2ZW50LldpbGxVcGRhdGVEZXZpY2VzLCB0aGlzLm9uV2lsbFVwZGF0ZURldmljZXMpO1xuICAgICAgICAgICAgdGhpcy5jbGllbnQucmVtb3ZlTGlzdGVuZXIoQ3J5cHRvRXZlbnQuRGV2aWNlc1VwZGF0ZWQsIHRoaXMub25EZXZpY2VzVXBkYXRlZCk7XG4gICAgICAgICAgICB0aGlzLmNsaWVudC5yZW1vdmVMaXN0ZW5lcihDcnlwdG9FdmVudC5EZXZpY2VWZXJpZmljYXRpb25DaGFuZ2VkLCB0aGlzLm9uRGV2aWNlVmVyaWZpY2F0aW9uQ2hhbmdlZCk7XG4gICAgICAgICAgICB0aGlzLmNsaWVudC5yZW1vdmVMaXN0ZW5lcihDcnlwdG9FdmVudC5Vc2VyVHJ1c3RTdGF0dXNDaGFuZ2VkLCB0aGlzLm9uVXNlclRydXN0U3RhdHVzQ2hhbmdlZCk7XG4gICAgICAgICAgICB0aGlzLmNsaWVudC5yZW1vdmVMaXN0ZW5lcihDcnlwdG9FdmVudC5LZXlzQ2hhbmdlZCwgdGhpcy5vbkNyb3NzU2luZ2luZ0tleXNDaGFuZ2VkKTtcbiAgICAgICAgICAgIHRoaXMuY2xpZW50LnJlbW92ZUxpc3RlbmVyKENsaWVudEV2ZW50LkFjY291bnREYXRhLCB0aGlzLm9uQWNjb3VudERhdGEpO1xuICAgICAgICAgICAgdGhpcy5jbGllbnQucmVtb3ZlTGlzdGVuZXIoQ2xpZW50RXZlbnQuU3luYywgdGhpcy5vblN5bmMpO1xuICAgICAgICAgICAgdGhpcy5jbGllbnQucmVtb3ZlTGlzdGVuZXIoUm9vbVN0YXRlRXZlbnQuRXZlbnRzLCB0aGlzLm9uUm9vbVN0YXRlRXZlbnRzKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5kZXZpY2VDbGllbnRJbmZvcm1hdGlvblNldHRpbmdXYXRjaGVyUmVmKSB7XG4gICAgICAgICAgICBTZXR0aW5nc1N0b3JlLnVud2F0Y2hTZXR0aW5nKHRoaXMuZGV2aWNlQ2xpZW50SW5mb3JtYXRpb25TZXR0aW5nV2F0Y2hlclJlZik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuZGlzcGF0Y2hlclJlZikge1xuICAgICAgICAgICAgZGlzLnVucmVnaXN0ZXIodGhpcy5kaXNwYXRjaGVyUmVmKTtcbiAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hlclJlZiA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmRpc21pc3NlZC5jbGVhcigpO1xuICAgICAgICB0aGlzLmRpc21pc3NlZFRoaXNEZXZpY2VUb2FzdCA9IGZhbHNlO1xuICAgICAgICB0aGlzLmtleUJhY2t1cEluZm8gPSBudWxsO1xuICAgICAgICB0aGlzLmtleUJhY2t1cEZldGNoZWRBdCA9IG51bGw7XG4gICAgICAgIHRoaXMua2V5QmFja3VwU3RhdHVzQ2hlY2tlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLm91ckRldmljZUlkc0F0U3RhcnQgPSBudWxsO1xuICAgICAgICB0aGlzLmRpc3BsYXlpbmdUb2FzdHNGb3JEZXZpY2VJZHMgPSBuZXcgU2V0KCk7XG4gICAgICAgIHRoaXMuY2xpZW50ID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERpc21pc3Mgbm90aWZpY2F0aW9ucyBhYm91dCBvdXIgb3duIHVudmVyaWZpZWQgZGV2aWNlc1xuICAgICAqXG4gICAgICogQHBhcmFtIHtTdHJpbmdbXX0gZGV2aWNlSWRzIExpc3Qgb2YgZGV2aWNlIElEcyB0byBkaXNtaXNzIG5vdGlmaWNhdGlvbnMgZm9yXG4gICAgICovXG4gICAgcHVibGljIGFzeW5jIGRpc21pc3NVbnZlcmlmaWVkU2Vzc2lvbnMoZGV2aWNlSWRzOiBJdGVyYWJsZTxzdHJpbmc+KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGxvZ2dlci5sb2coXCJEaXNtaXNzaW5nIHVudmVyaWZpZWQgc2Vzc2lvbnM6IFwiICsgQXJyYXkuZnJvbShkZXZpY2VJZHMpLmpvaW4oXCIsXCIpKTtcbiAgICAgICAgZm9yIChjb25zdCBkIG9mIGRldmljZUlkcykge1xuICAgICAgICAgICAgdGhpcy5kaXNtaXNzZWQuYWRkKGQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5yZWNoZWNrKCk7XG4gICAgfVxuXG4gICAgcHVibGljIGRpc21pc3NFbmNyeXB0aW9uU2V0dXAoKTogdm9pZCB7XG4gICAgICAgIHRoaXMuZGlzbWlzc2VkVGhpc0RldmljZVRvYXN0ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5yZWNoZWNrKCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBlbnN1cmVEZXZpY2VJZHNBdFN0YXJ0UG9wdWxhdGVkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBpZiAodGhpcy5vdXJEZXZpY2VJZHNBdFN0YXJ0ID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLm91ckRldmljZUlkc0F0U3RhcnQgPSBhd2FpdCB0aGlzLmdldERldmljZUlkcygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEdldCB0aGUgZGV2aWNlIGxpc3QgZm9yIHRoZSBjdXJyZW50IHVzZXJcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHRoZSBzZXQgb2YgZGV2aWNlIElEc1xuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgZ2V0RGV2aWNlSWRzKCk6IFByb21pc2U8U2V0PHN0cmluZz4+IHtcbiAgICAgICAgY29uc3QgY2xpID0gdGhpcy5jbGllbnQ7XG4gICAgICAgIGNvbnN0IGNyeXB0byA9IGNsaT8uZ2V0Q3J5cHRvKCk7XG4gICAgICAgIGlmIChjcnlwdG8gPT09IHVuZGVmaW5lZCkgcmV0dXJuIG5ldyBTZXQoKTtcblxuICAgICAgICBjb25zdCB1c2VySWQgPSBjbGkhLmdldFNhZmVVc2VySWQoKTtcbiAgICAgICAgY29uc3QgZGV2aWNlcyA9IGF3YWl0IGNyeXB0by5nZXRVc2VyRGV2aWNlSW5mbyhbdXNlcklkXSk7XG4gICAgICAgIHJldHVybiBuZXcgU2V0KGRldmljZXMuZ2V0KHVzZXJJZCk/LmtleXMoKSA/PyBbXSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBvbldpbGxVcGRhdGVEZXZpY2VzID0gYXN5bmMgKHVzZXJzOiBzdHJpbmdbXSwgaW5pdGlhbEZldGNoPzogYm9vbGVhbik6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgICAgICBpZiAoIXRoaXMuY2xpZW50KSByZXR1cm47XG4gICAgICAgIC8vIElmIHdlIGRpZG4ndCBrbm93IGFib3V0ICphbnkqIGRldmljZXMgYmVmb3JlIChpZS4gaXQncyBmcmVzaCBsb2dpbiksXG4gICAgICAgIC8vIHRoZW4gdGhleSBhcmUgYWxsIHByZS1leGlzdGluZyBkZXZpY2VzLCBzbyBpZ25vcmUgdGhpcyBhbmQgc2V0IHRoZVxuICAgICAgICAvLyBkZXZpY2VzQXRTdGFydCBsaXN0IHRvIHRoZSBkZXZpY2VzIHRoYXQgd2Ugc2VlIGFmdGVyIHRoZSBmZXRjaC5cbiAgICAgICAgaWYgKGluaXRpYWxGZXRjaCkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IG15VXNlcklkID0gdGhpcy5jbGllbnQuZ2V0U2FmZVVzZXJJZCgpO1xuICAgICAgICBpZiAodXNlcnMuaW5jbHVkZXMobXlVc2VySWQpKSBhd2FpdCB0aGlzLmVuc3VyZURldmljZUlkc0F0U3RhcnRQb3B1bGF0ZWQoKTtcblxuICAgICAgICAvLyBObyBuZWVkIHRvIGRvIGEgcmVjaGVjayBoZXJlOiB3ZSBqdXN0IG5lZWQgdG8gZ2V0IGEgc25hcHNob3Qgb2Ygb3VyIGRldmljZXNcbiAgICAgICAgLy8gYmVmb3JlIHdlIGRvd25sb2FkIGFueSBuZXcgb25lcy5cbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBvbkRldmljZXNVcGRhdGVkID0gKHVzZXJzOiBzdHJpbmdbXSk6IHZvaWQgPT4ge1xuICAgICAgICBpZiAoIXRoaXMuY2xpZW50KSByZXR1cm47XG4gICAgICAgIGlmICghdXNlcnMuaW5jbHVkZXModGhpcy5jbGllbnQuZ2V0U2FmZVVzZXJJZCgpKSkgcmV0dXJuO1xuICAgICAgICB0aGlzLnJlY2hlY2soKTtcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBvbkRldmljZVZlcmlmaWNhdGlvbkNoYW5nZWQgPSAodXNlcklkOiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICAgICAgaWYgKCF0aGlzLmNsaWVudCkgcmV0dXJuO1xuICAgICAgICBpZiAodXNlcklkICE9PSB0aGlzLmNsaWVudC5nZXRVc2VySWQoKSkgcmV0dXJuO1xuICAgICAgICB0aGlzLnJlY2hlY2soKTtcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBvblVzZXJUcnVzdFN0YXR1c0NoYW5nZWQgPSAodXNlcklkOiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICAgICAgaWYgKCF0aGlzLmNsaWVudCkgcmV0dXJuO1xuICAgICAgICBpZiAodXNlcklkICE9PSB0aGlzLmNsaWVudC5nZXRVc2VySWQoKSkgcmV0dXJuO1xuICAgICAgICB0aGlzLnJlY2hlY2soKTtcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBvbkNyb3NzU2luZ2luZ0tleXNDaGFuZ2VkID0gKCk6IHZvaWQgPT4ge1xuICAgICAgICB0aGlzLnJlY2hlY2soKTtcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBvbkFjY291bnREYXRhID0gKGV2OiBNYXRyaXhFdmVudCk6IHZvaWQgPT4ge1xuICAgICAgICAvLyBVc2VyIG1heSBoYXZlOlxuICAgICAgICAvLyAqIG1pZ3JhdGVkIFNTU1MgdG8gc3ltbWV0cmljXG4gICAgICAgIC8vICogdXBsb2FkZWQga2V5cyB0byBzZWNyZXQgc3RvcmFnZVxuICAgICAgICAvLyAqIGNvbXBsZXRlZCBzZWNyZXQgc3RvcmFnZSBjcmVhdGlvblxuICAgICAgICAvLyB3aGljaCByZXN1bHQgaW4gYWNjb3VudCBkYXRhIGNoYW5nZXMgYWZmZWN0aW5nIGNoZWNrcyBiZWxvdy5cbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgZXYuZ2V0VHlwZSgpLnN0YXJ0c1dpdGgoXCJtLnNlY3JldF9zdG9yYWdlLlwiKSB8fFxuICAgICAgICAgICAgZXYuZ2V0VHlwZSgpLnN0YXJ0c1dpdGgoXCJtLmNyb3NzX3NpZ25pbmcuXCIpIHx8XG4gICAgICAgICAgICBldi5nZXRUeXBlKCkgPT09IFwibS5tZWdvbG1fYmFja3VwLnYxXCJcbiAgICAgICAgKSB7XG4gICAgICAgICAgICB0aGlzLnJlY2hlY2soKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBwcml2YXRlIG9uU3luYyA9IChzdGF0ZTogU3luY1N0YXRlLCBwcmV2U3RhdGU6IFN5bmNTdGF0ZSB8IG51bGwpOiB2b2lkID0+IHtcbiAgICAgICAgaWYgKHN0YXRlID09PSBcIlBSRVBBUkVEXCIgJiYgcHJldlN0YXRlID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLnJlY2hlY2soKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBwcml2YXRlIG9uUm9vbVN0YXRlRXZlbnRzID0gKGV2OiBNYXRyaXhFdmVudCk6IHZvaWQgPT4ge1xuICAgICAgICBpZiAoZXYuZ2V0VHlwZSgpICE9PSBFdmVudFR5cGUuUm9vbUVuY3J5cHRpb24pIHJldHVybjtcblxuICAgICAgICAvLyBJZiBhIHJvb20gY2hhbmdlcyB0byBlbmNyeXB0ZWQsIHJlLWNoZWNrIGFzIGl0IG1heSBiZSBvdXIgZmlyc3RcbiAgICAgICAgLy8gZW5jcnlwdGVkIHJvb20uIFRoaXMgYWxzbyBjYXRjaGVzIGVuY3J5cHRlZCByb29tIGNyZWF0aW9uIGFzIHdlbGwuXG4gICAgICAgIHRoaXMucmVjaGVjaygpO1xuICAgIH07XG5cbiAgICBwcml2YXRlIG9uQWN0aW9uID0gKHsgYWN0aW9uIH06IEFjdGlvblBheWxvYWQpOiB2b2lkID0+IHtcbiAgICAgICAgaWYgKGFjdGlvbiAhPT0gQWN0aW9uLk9uTG9nZ2VkSW4pIHJldHVybjtcbiAgICAgICAgdGhpcy5yZWNoZWNrKCk7XG4gICAgICAgIHRoaXMudXBkYXRlQ2xpZW50SW5mb3JtYXRpb24oKTtcbiAgICB9O1xuXG4gICAgLy8gVGhlIHNlcnZlciBkb2Vzbid0IHRlbGwgdXMgd2hlbiBrZXkgYmFja3VwIGlzIHNldCB1cCwgc28gd2UgcG9sbFxuICAgIC8vICYgY2FjaGUgdGhlIHJlc3VsdFxuICAgIHByaXZhdGUgYXN5bmMgZ2V0S2V5QmFja3VwSW5mbygpOiBQcm9taXNlPElLZXlCYWNrdXBJbmZvIHwgbnVsbD4ge1xuICAgICAgICBpZiAoIXRoaXMuY2xpZW50KSByZXR1cm4gbnVsbDtcbiAgICAgICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAgICF0aGlzLmtleUJhY2t1cEluZm8gfHxcbiAgICAgICAgICAgICF0aGlzLmtleUJhY2t1cEZldGNoZWRBdCB8fFxuICAgICAgICAgICAgdGhpcy5rZXlCYWNrdXBGZXRjaGVkQXQgPCBub3cgLSBLRVlfQkFDS1VQX1BPTExfSU5URVJWQUxcbiAgICAgICAgKSB7XG4gICAgICAgICAgICB0aGlzLmtleUJhY2t1cEluZm8gPSBhd2FpdCB0aGlzLmNsaWVudC5nZXRLZXlCYWNrdXBWZXJzaW9uKCk7XG4gICAgICAgICAgICB0aGlzLmtleUJhY2t1cEZldGNoZWRBdCA9IG5vdztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5rZXlCYWNrdXBJbmZvO1xuICAgIH1cblxuICAgIHByaXZhdGUgc2hvdWxkU2hvd1NldHVwRW5jcnlwdGlvblRvYXN0KCk6IGJvb2xlYW4ge1xuICAgICAgICAvLyBJZiB3ZSdyZSBpbiB0aGUgbWlkZGxlIG9mIGEgc2VjcmV0IHN0b3JhZ2Ugb3BlcmF0aW9uLCB3ZSdyZSBsaWtlbHlcbiAgICAgICAgLy8gbW9kaWZ5aW5nIHRoZSBzdGF0ZSBpbnZvbHZlZCBoZXJlLCBzbyBkb24ndCBhZGQgbmV3IHRvYXN0cyB0byBzZXR1cC5cbiAgICAgICAgaWYgKGlzU2VjcmV0U3RvcmFnZUJlaW5nQWNjZXNzZWQoKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAvLyBTaG93IHNldHVwIHRvYXN0cyBvbmNlIHRoZSB1c2VyIGlzIGluIGF0IGxlYXN0IG9uZSBlbmNyeXB0ZWQgcm9vbS5cbiAgICAgICAgY29uc3QgY2xpID0gdGhpcy5jbGllbnQ7XG4gICAgICAgIHJldHVybiBjbGk/LmdldFJvb21zKCkuc29tZSgocikgPT4gY2xpLmlzUm9vbUVuY3J5cHRlZChyLnJvb21JZCkpID8/IGZhbHNlO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgcmVjaGVjaygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgaWYgKCF0aGlzLnJ1bm5pbmcgfHwgIXRoaXMuY2xpZW50KSByZXR1cm47IC8vIHdlIGhhdmUgYmVlbiBzdG9wcGVkXG4gICAgICAgIGNvbnN0IGNsaSA9IHRoaXMuY2xpZW50O1xuXG4gICAgICAgIC8vIGNyb3NzLXNpZ25pbmcgc3VwcG9ydCB3YXMgYWRkZWQgdG8gTWF0cml4IGluIE1TQzE3NTYsIHdoaWNoIGxhbmRlZCBpbiBzcGVjIHYxLjFcbiAgICAgICAgaWYgKCEoYXdhaXQgY2xpLmlzVmVyc2lvblN1cHBvcnRlZChcInYxLjFcIikpKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgY3J5cHRvID0gY2xpLmdldENyeXB0bygpO1xuICAgICAgICBpZiAoIWNyeXB0bykgcmV0dXJuO1xuXG4gICAgICAgIC8vIGRvbid0IHJlY2hlY2sgdW50aWwgdGhlIGluaXRpYWwgc3luYyBpcyBjb21wbGV0ZTogbG90cyBvZiBhY2NvdW50IGRhdGEgZXZlbnRzIHdpbGwgZmlyZVxuICAgICAgICAvLyB3aGlsZSB0aGUgaW5pdGlhbCBzeW5jIGlzIHByb2Nlc3NpbmcgYW5kIHdlIGRvbid0IG5lZWQgdG8gcmVjaGVjayBvbiBlYWNoIG9uZSBvZiB0aGVtXG4gICAgICAgIC8vICh3ZSBhZGQgYSBsaXN0ZW5lciBvbiBzeW5jIHRvIGRvIG9uY2UgY2hlY2sgYWZ0ZXIgdGhlIGluaXRpYWwgc3luYyBpcyBkb25lKVxuICAgICAgICBpZiAoIWNsaS5pc0luaXRpYWxTeW5jQ29tcGxldGUoKSkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IGNyb3NzU2lnbmluZ1JlYWR5ID0gYXdhaXQgY3J5cHRvLmlzQ3Jvc3NTaWduaW5nUmVhZHkoKTtcbiAgICAgICAgY29uc3Qgc2VjcmV0U3RvcmFnZVJlYWR5ID0gYXdhaXQgY3J5cHRvLmlzU2VjcmV0U3RvcmFnZVJlYWR5KCk7XG4gICAgICAgIGNvbnN0IGFsbFN5c3RlbXNSZWFkeSA9IGNyb3NzU2lnbmluZ1JlYWR5ICYmIHNlY3JldFN0b3JhZ2VSZWFkeTtcblxuICAgICAgICBpZiAodGhpcy5kaXNtaXNzZWRUaGlzRGV2aWNlVG9hc3QgfHwgYWxsU3lzdGVtc1JlYWR5KSB7XG4gICAgICAgICAgICBoaWRlU2V0dXBFbmNyeXB0aW9uVG9hc3QoKTtcblxuICAgICAgICAgICAgdGhpcy5jaGVja0tleUJhY2t1cFN0YXR1cygpO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuc2hvdWxkU2hvd1NldHVwRW5jcnlwdGlvblRvYXN0KCkpIHtcbiAgICAgICAgICAgIC8vIG1ha2Ugc3VyZSBvdXIga2V5cyBhcmUgZmluaXNoZWQgZG93bmxvYWRpbmdcbiAgICAgICAgICAgIGF3YWl0IGNyeXB0by5nZXRVc2VyRGV2aWNlSW5mbyhbY2xpLmdldFNhZmVVc2VySWQoKV0pO1xuXG4gICAgICAgICAgICAvLyBjcm9zcyBzaWduaW5nIGlzbid0IGVuYWJsZWQgLSBuYWcgdG8gZW5hYmxlIGl0XG4gICAgICAgICAgICAvLyBUaGVyZSBhcmUgMyBkaWZmZXJlbnQgdG9hc3RzIGZvcjpcbiAgICAgICAgICAgIGlmICghKGF3YWl0IGNyeXB0by5nZXRDcm9zc1NpZ25pbmdLZXlJZCgpKSAmJiBjbGkuZ2V0U3RvcmVkQ3Jvc3NTaWduaW5nRm9yVXNlcihjbGkuZ2V0U2FmZVVzZXJJZCgpKSkge1xuICAgICAgICAgICAgICAgIC8vIENyb3NzLXNpZ25pbmcgb24gYWNjb3VudCBidXQgdGhpcyBkZXZpY2UgZG9lc24ndCB0cnVzdCB0aGUgbWFzdGVyIGtleSAodmVyaWZ5IHRoaXMgc2Vzc2lvbilcbiAgICAgICAgICAgICAgICBzaG93U2V0dXBFbmNyeXB0aW9uVG9hc3QoU2V0dXBLaW5kLlZFUklGWV9USElTX1NFU1NJT04pO1xuICAgICAgICAgICAgICAgIHRoaXMuY2hlY2tLZXlCYWNrdXBTdGF0dXMoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYmFja3VwSW5mbyA9IGF3YWl0IHRoaXMuZ2V0S2V5QmFja3VwSW5mbygpO1xuICAgICAgICAgICAgICAgIGlmIChiYWNrdXBJbmZvKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIE5vIGNyb3NzLXNpZ25pbmcgb24gYWNjb3VudCBidXQga2V5IGJhY2t1cCBhdmFpbGFibGUgKHVwZ3JhZGUgZW5jcnlwdGlvbilcbiAgICAgICAgICAgICAgICAgICAgc2hvd1NldHVwRW5jcnlwdGlvblRvYXN0KFNldHVwS2luZC5VUEdSQURFX0VOQ1JZUFRJT04pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIE5vIGNyb3NzLXNpZ25pbmcgb3Iga2V5IGJhY2t1cCBvbiBhY2NvdW50IChzZXQgdXAgZW5jcnlwdGlvbilcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgY2xpLndhaXRGb3JDbGllbnRXZWxsS25vd24oKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzU2VjdXJlQmFja3VwUmVxdWlyZWQoY2xpKSAmJiBpc0xvZ2dlZEluKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIHdlJ3JlIG1lYW50IHRvIHNldCB1cCwgYW5kIFNlY3VyZSBCYWNrdXAgaXMgcmVxdWlyZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0cmlnZ2VyIHRoZSBmbG93IGRpcmVjdGx5IHdpdGhvdXQgYSB0b2FzdCBvbmNlIGxvZ2dlZCBpbi5cbiAgICAgICAgICAgICAgICAgICAgICAgIGhpZGVTZXR1cEVuY3J5cHRpb25Ub2FzdCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYWNjZXNzU2VjcmV0U3RvcmFnZSgpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2hvd1NldHVwRW5jcnlwdGlvblRvYXN0KFNldHVwS2luZC5TRVRfVVBfRU5DUllQVElPTik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUaGlzIG5lZWRzIHRvIGJlIGRvbmUgYWZ0ZXIgYXdhaXRpbmcgb24gZ2V0VXNlckRldmljZUluZm8oKSBhYm92ZSwgc29cbiAgICAgICAgLy8gd2UgbWFrZSBzdXJlIHdlIGdldCB0aGUgZGV2aWNlcyBhZnRlciB0aGUgZmV0Y2ggaXMgZG9uZS5cbiAgICAgICAgYXdhaXQgdGhpcy5lbnN1cmVEZXZpY2VJZHNBdFN0YXJ0UG9wdWxhdGVkKCk7XG5cbiAgICAgICAgLy8gVW52ZXJpZmllZCBkZXZpY2VzIHRoYXQgd2VyZSB0aGVyZSBsYXN0IHRpbWUgdGhlIGFwcCByYW5cbiAgICAgICAgLy8gKHRlY2huaWNhbGx5IGNvdWxkIGp1c3QgYmUgYSBib29sZWFuOiB3ZSBkb24ndCBhY3R1YWxseVxuICAgICAgICAvLyBuZWVkIHRvIHJlbWVtYmVyIHRoZSBkZXZpY2UgSURzLCBidXQgZm9yIHRoZSBzYWtlIG9mXG4gICAgICAgIC8vIHN5bW1ldHJ5Li4uKS5cbiAgICAgICAgY29uc3Qgb2xkVW52ZXJpZmllZERldmljZUlkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgICAvLyBVbnZlcmlmaWVkIGRldmljZXMgdGhhdCBoYXZlIGFwcGVhcmVkIHNpbmNlIHRoZW5cbiAgICAgICAgY29uc3QgbmV3VW52ZXJpZmllZERldmljZUlkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4gICAgICAgIGNvbnN0IGlzQ3VycmVudERldmljZVRydXN0ZWQgPVxuICAgICAgICAgICAgY3Jvc3NTaWduaW5nUmVhZHkgJiZcbiAgICAgICAgICAgIEJvb2xlYW4oXG4gICAgICAgICAgICAgICAgKGF3YWl0IGNyeXB0by5nZXREZXZpY2VWZXJpZmljYXRpb25TdGF0dXMoY2xpLmdldFNhZmVVc2VySWQoKSwgY2xpLmRldmljZUlkISkpPy5jcm9zc1NpZ25pbmdWZXJpZmllZCxcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgLy8gYXMgbG9uZyBhcyBjcm9zcy1zaWduaW5nIGlzbid0IHJlYWR5LFxuICAgICAgICAvLyB5b3UgY2FuJ3Qgc2VlIG9yIGRpc21pc3MgYW55IGRldmljZSB0b2FzdHNcbiAgICAgICAgaWYgKGNyb3NzU2lnbmluZ1JlYWR5KSB7XG4gICAgICAgICAgICBjb25zdCBkZXZpY2VzID0gYXdhaXQgdGhpcy5nZXREZXZpY2VJZHMoKTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZGV2aWNlSWQgb2YgZGV2aWNlcykge1xuICAgICAgICAgICAgICAgIGlmIChkZXZpY2VJZCA9PT0gY2xpLmRldmljZUlkKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGRldmljZVRydXN0ID0gYXdhaXQgY3J5cHRvLmdldERldmljZVZlcmlmaWNhdGlvblN0YXR1cyhjbGkuZ2V0U2FmZVVzZXJJZCgpLCBkZXZpY2VJZCk7XG4gICAgICAgICAgICAgICAgaWYgKCFkZXZpY2VUcnVzdD8uY3Jvc3NTaWduaW5nVmVyaWZpZWQgJiYgIXRoaXMuZGlzbWlzc2VkLmhhcyhkZXZpY2VJZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMub3VyRGV2aWNlSWRzQXRTdGFydD8uaGFzKGRldmljZUlkKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgb2xkVW52ZXJpZmllZERldmljZUlkcy5hZGQoZGV2aWNlSWQpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV3VW52ZXJpZmllZERldmljZUlkcy5hZGQoZGV2aWNlSWQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbG9nZ2VyLmRlYnVnKFwiT2xkIHVudmVyaWZpZWQgc2Vzc2lvbnM6IFwiICsgQXJyYXkuZnJvbShvbGRVbnZlcmlmaWVkRGV2aWNlSWRzKS5qb2luKFwiLFwiKSk7XG4gICAgICAgIGxvZ2dlci5kZWJ1ZyhcIk5ldyB1bnZlcmlmaWVkIHNlc3Npb25zOiBcIiArIEFycmF5LmZyb20obmV3VW52ZXJpZmllZERldmljZUlkcykuam9pbihcIixcIikpO1xuICAgICAgICBsb2dnZXIuZGVidWcoXCJDdXJyZW50bHkgc2hvd2luZyB0b2FzdHMgZm9yOiBcIiArIEFycmF5LmZyb20odGhpcy5kaXNwbGF5aW5nVG9hc3RzRm9yRGV2aWNlSWRzKS5qb2luKFwiLFwiKSk7XG5cbiAgICAgICAgY29uc3QgaXNCdWxrVW52ZXJpZmllZFNlc3Npb25zUmVtaW5kZXJTbm9vemVkID0gaXNCdWxrVW52ZXJpZmllZERldmljZVJlbWluZGVyU25vb3plZCgpO1xuXG4gICAgICAgIC8vIERpc3BsYXkgb3IgaGlkZSB0aGUgYmF0Y2ggdG9hc3QgZm9yIG9sZCB1bnZlcmlmaWVkIHNlc3Npb25zXG4gICAgICAgIC8vIGRvbid0IHNob3cgdGhlIHRvYXN0IGlmIHRoZSBjdXJyZW50IGRldmljZSBpcyB1bnZlcmlmaWVkXG4gICAgICAgIGlmIChcbiAgICAgICAgICAgIG9sZFVudmVyaWZpZWREZXZpY2VJZHMuc2l6ZSA+IDAgJiZcbiAgICAgICAgICAgIGlzQ3VycmVudERldmljZVRydXN0ZWQgJiZcbiAgICAgICAgICAgIHRoaXMuZW5hYmxlQnVsa1VudmVyaWZpZWRTZXNzaW9uc1JlbWluZGVyICYmXG4gICAgICAgICAgICAhaXNCdWxrVW52ZXJpZmllZFNlc3Npb25zUmVtaW5kZXJTbm9vemVkXG4gICAgICAgICkge1xuICAgICAgICAgICAgc2hvd0J1bGtVbnZlcmlmaWVkU2Vzc2lvbnNUb2FzdChvbGRVbnZlcmlmaWVkRGV2aWNlSWRzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGhpZGVCdWxrVW52ZXJpZmllZFNlc3Npb25zVG9hc3QoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNob3cgdG9hc3RzIGZvciBuZXcgdW52ZXJpZmllZCBkZXZpY2VzIGlmIHRoZXkgYXJlbid0IGFscmVhZHkgdGhlcmVcbiAgICAgICAgZm9yIChjb25zdCBkZXZpY2VJZCBvZiBuZXdVbnZlcmlmaWVkRGV2aWNlSWRzKSB7XG4gICAgICAgICAgICBzaG93VW52ZXJpZmllZFNlc3Npb25zVG9hc3QoZGV2aWNlSWQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gLi4uYW5kIGhpZGUgYW55IHdlIGRvbid0IG5lZWQgYW55IG1vcmVcbiAgICAgICAgZm9yIChjb25zdCBkZXZpY2VJZCBvZiB0aGlzLmRpc3BsYXlpbmdUb2FzdHNGb3JEZXZpY2VJZHMpIHtcbiAgICAgICAgICAgIGlmICghbmV3VW52ZXJpZmllZERldmljZUlkcy5oYXMoZGV2aWNlSWQpKSB7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmRlYnVnKFwiSGlkaW5nIHVudmVyaWZpZWQgc2Vzc2lvbiB0b2FzdCBmb3IgXCIgKyBkZXZpY2VJZCk7XG4gICAgICAgICAgICAgICAgaGlkZVVudmVyaWZpZWRTZXNzaW9uc1RvYXN0KGRldmljZUlkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZGlzcGxheWluZ1RvYXN0c0ZvckRldmljZUlkcyA9IG5ld1VudmVyaWZpZWREZXZpY2VJZHM7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBjaGVja0tleUJhY2t1cFN0YXR1cyA9IGFzeW5jICgpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgICAgaWYgKHRoaXMua2V5QmFja3VwU3RhdHVzQ2hlY2tlZCB8fCAhdGhpcy5jbGllbnQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICAvLyByZXR1cm5zIG51bGwgd2hlbiBrZXkgYmFja3VwIHN0YXR1cyBoYXNuJ3QgZmluaXNoZWQgYmVpbmcgY2hlY2tlZFxuICAgICAgICBjb25zdCBpc0tleUJhY2t1cEVuYWJsZWQgPSB0aGlzLmNsaWVudC5nZXRLZXlCYWNrdXBFbmFibGVkKCk7XG4gICAgICAgIHRoaXMua2V5QmFja3VwU3RhdHVzQ2hlY2tlZCA9IGlzS2V5QmFja3VwRW5hYmxlZCAhPT0gbnVsbDtcblxuICAgICAgICBpZiAoaXNLZXlCYWNrdXBFbmFibGVkID09PSBmYWxzZSkge1xuICAgICAgICAgICAgZGlzLmRpc3BhdGNoKHsgYWN0aW9uOiBBY3Rpb24uUmVwb3J0S2V5QmFja3VwTm90RW5hYmxlZCB9KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBwcml2YXRlIG9uUmVjb3JkQ2xpZW50SW5mb3JtYXRpb25TZXR0aW5nQ2hhbmdlOiBDYWxsYmFja0ZuID0gKFxuICAgICAgICBfb3JpZ2luYWxTZXR0aW5nTmFtZSxcbiAgICAgICAgX3Jvb21JZCxcbiAgICAgICAgX2xldmVsLFxuICAgICAgICBfbmV3TGV2ZWwsXG4gICAgICAgIG5ld1ZhbHVlLFxuICAgICkgPT4ge1xuICAgICAgICBjb25zdCBwcmV2VmFsdWUgPSB0aGlzLnNob3VsZFJlY29yZENsaWVudEluZm9ybWF0aW9uO1xuXG4gICAgICAgIHRoaXMuc2hvdWxkUmVjb3JkQ2xpZW50SW5mb3JtYXRpb24gPSAhIW5ld1ZhbHVlO1xuXG4gICAgICAgIGlmICh0aGlzLnNob3VsZFJlY29yZENsaWVudEluZm9ybWF0aW9uICE9PSBwcmV2VmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlQ2xpZW50SW5mb3JtYXRpb24oKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBwcml2YXRlIHVwZGF0ZUNsaWVudEluZm9ybWF0aW9uID0gYXN5bmMgKCk6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgICAgICBpZiAoIXRoaXMuY2xpZW50KSByZXR1cm47XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAodGhpcy5zaG91bGRSZWNvcmRDbGllbnRJbmZvcm1hdGlvbikge1xuICAgICAgICAgICAgICAgIGF3YWl0IHJlY29yZENsaWVudEluZm9ybWF0aW9uKHRoaXMuY2xpZW50LCBTZGtDb25maWcuZ2V0KCksIFBsYXRmb3JtUGVnLmdldCgpID8/IHVuZGVmaW5lZCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGF3YWl0IHJlbW92ZUNsaWVudEluZm9ybWF0aW9uKHRoaXMuY2xpZW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIC8vIHRoaXMgaXMgYSBiZXN0IGVmZm9ydCBvcGVyYXRpb25cbiAgICAgICAgICAgIC8vIGxvZyB0aGUgZXJyb3Igd2l0aG91dCByZXRocm93aW5nXG4gICAgICAgICAgICBsb2dnZXIuZXJyb3IoXCJGYWlsZWQgdG8gdXBkYXRlIGNsaWVudCBpbmZvcm1hdGlvblwiLCBlcnJvcik7XG4gICAgICAgIH1cbiAgICB9O1xufVxuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQWlCQSxJQUFBQSxPQUFBLEdBQUFDLE9BQUE7QUFDQSxJQUFBQyxPQUFBLEdB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