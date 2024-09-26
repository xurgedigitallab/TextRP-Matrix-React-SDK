"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.initSentry = initSentry;
exports.sendSentryReport = sendSentryReport;
exports.setSentryUser = setSentryUser;
var Sentry = _interopRequireWildcard(require("@sentry/browser"));
var _SdkConfig = _interopRequireDefault(require("./SdkConfig"));
var _MatrixClientPeg = require("./MatrixClientPeg");
var _SettingsStore = _interopRequireDefault(require("./settings/SettingsStore"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

/* eslint-disable camelcase */

/* eslint-enable camelcase */

async function getStorageContext() {
  const result = {};

  // add storage persistence/quota information
  if (navigator.storage && navigator.storage.persisted) {
    try {
      result["storageManager_persisted"] = String(await navigator.storage.persisted());
    } catch (e) {}
  } else if (document.hasStorageAccess) {
    // Safari
    try {
      result["storageManager_persisted"] = String(await document.hasStorageAccess());
    } catch (e) {}
  }
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      result["storageManager_quota"] = String(estimate.quota);
      result["storageManager_usage"] = String(estimate.usage);
      if (estimate.usageDetails) {
        const usageDetails = [];
        Object.keys(estimate.usageDetails).forEach(k => {
          usageDetails.push(`${k}: ${String(estimate.usageDetails[k])}`);
        });
        result[`storageManager_usage`] = usageDetails.join(", ");
      }
    } catch (e) {}
  }
  return result;
}
function getUserContext(client) {
  return {
    username: client.credentials.userId,
    enabled_labs: getEnabledLabs(),
    low_bandwidth: _SettingsStore.default.getValue("lowBandwidth") ? "enabled" : "disabled"
  };
}
function getEnabledLabs() {
  const enabledLabs = _SettingsStore.default.getFeatureSettingNames().filter(f => _SettingsStore.default.getValue(f));
  if (enabledLabs.length) {
    return enabledLabs.join(", ");
  }
  return "";
}
async function getCryptoContext(client) {
  // TODO: make this work with rust crypto
  if (!client.isCryptoEnabled() || !client.crypto) {
    return {};
  }
  const keys = [`ed25519:${client.getDeviceEd25519Key()}`];
  if (client.getDeviceCurve25519Key) {
    keys.push(`curve25519:${client.getDeviceCurve25519Key()}`);
  }
  const crossSigning = client.crypto.crossSigningInfo;
  const secretStorage = client.crypto.secretStorage;
  const pkCache = client.getCrossSigningCacheCallbacks();
  const sessionBackupKeyFromCache = await client.crypto.getSessionBackupPrivateKey();
  return {
    device_keys: keys.join(", "),
    cross_signing_ready: String(await client.isCrossSigningReady()),
    cross_signing_key: crossSigning.getId(),
    cross_signing_privkey_in_secret_storage: String(!!(await crossSigning.isStoredInSecretStorage(secretStorage))),
    cross_signing_master_privkey_cached: String(!!(pkCache && (await pkCache.getCrossSigningKeyCache?.("master")))),
    cross_signing_user_signing_privkey_cached: String(!!(pkCache && (await pkCache.getCrossSigningKeyCache?.("user_signing")))),
    secret_storage_ready: String(await client.isSecretStorageReady()),
    secret_storage_key_in_account: String(!!(await secretStorage.hasKey())),
    session_backup_key_in_secret_storage: String(!!(await client.isKeyBackupKeyStored())),
    session_backup_key_cached: String(!!sessionBackupKeyFromCache),
    session_backup_key_well_formed: String(sessionBackupKeyFromCache instanceof Uint8Array)
  };
}
function getDeviceContext(client) {
  const result = {
    device_id: client?.deviceId ?? undefined,
    mx_local_settings: localStorage.getItem("mx_local_settings")
  };
  if (window.Modernizr) {
    const missingFeatures = Object.keys(window.Modernizr).filter(key => window.Modernizr[key] === false);
    if (missingFeatures.length > 0) {
      result["modernizr_missing_features"] = missingFeatures.join(", ");
    }
  }
  return result;
}
async function getContexts() {
  const client = _MatrixClientPeg.MatrixClientPeg.get();
  return {
    user: getUserContext(client),
    crypto: await getCryptoContext(client),
    device: getDeviceContext(client),
    storage: await getStorageContext()
  };
}
async function sendSentryReport(userText, issueUrl, error) {
  const sentryConfig = _SdkConfig.default.getObject("sentry");
  if (!sentryConfig) return;
  const captureContext = {
    contexts: await getContexts(),
    extra: {
      user_text: userText,
      issue_url: issueUrl
    }
  };

  // If there's no error and no issueUrl, the report will just produce non-grouped noise in Sentry, so don't
  // upload it
  if (error) {
    Sentry.captureException(error, captureContext);
  } else if (issueUrl) {
    Sentry.captureMessage(`Issue: ${issueUrl}`, captureContext);
  }
}
function setSentryUser(mxid) {
  if (!_SdkConfig.default.get().sentry || !_SettingsStore.default.getValue("automaticErrorReporting")) return;
  Sentry.setUser({
    username: mxid
  });
}
async function initSentry(sentryConfig) {
  if (!sentryConfig) return;
  // Only enable Integrations.GlobalHandlers, which hooks uncaught exceptions, if automaticErrorReporting is true
  const integrations = [new Sentry.Integrations.InboundFilters(), new Sentry.Integrations.FunctionToString(), new Sentry.Integrations.Breadcrumbs(), new Sentry.Integrations.HttpContext(), new Sentry.Integrations.Dedupe()];
  if (_SettingsStore.default.getValue("automaticErrorReporting")) {
    integrations.push(new Sentry.Integrations.GlobalHandlers({
      onerror: false,
      onunhandledrejection: true
    }));
    integrations.push(new Sentry.Integrations.TryCatch());
  }
  Sentry.init({
    dsn: sentryConfig.dsn,
    release: process.env.VERSION,
    environment: sentryConfig.environment,
    defaultIntegrations: false,
    autoSessionTracking: false,
    integrations,
    // Set to 1.0 which is reasonable if we're only submitting Rageshakes; will need to be set < 1.0
    // if we collect more frequently.
    tracesSampleRate: 1.0
  });
}
window.mxSendSentryReport = sendSentryReport;
//# sourceMappingURL=sentry.js.map