"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = sendBugReport;
exports.downloadBugReport = downloadBugReport;
exports.submitFeedback = submitFeedback;
var _logger = require("matrix-js-sdk/src/logger");
var _MatrixClientPeg = require("../MatrixClientPeg");
var _PlatformPeg = _interopRequireDefault(require("../PlatformPeg"));
var _languageHandler = require("../languageHandler");
var rageshake = _interopRequireWildcard(require("./rageshake"));
var _SettingsStore = _interopRequireDefault(require("../settings/SettingsStore"));
var _SdkConfig = _interopRequireDefault(require("../SdkConfig"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     Copyright 2017 OpenMarket Ltd
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     Copyright 2018 New Vector Ltd
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     Copyright 2019 The Matrix.org Foundation C.I.C.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     
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
async function collectBugReport() {
  let opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  let gzipLogs = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
  const progressCallback = opts.progressCallback || (() => {});
  progressCallback((0, _languageHandler._t)("Collecting app version information"));
  let version;
  try {
    version = await _PlatformPeg.default.get()?.getAppVersion();
  } catch (err) {} // PlatformPeg already logs this.

  const userAgent = window.navigator?.userAgent ?? "UNKNOWN";
  let installedPWA = "UNKNOWN";
  try {
    // Known to work at least for desktop Chrome
    installedPWA = String(window.matchMedia("(display-mode: standalone)").matches);
  } catch (e) {}
  let touchInput = "UNKNOWN";
  try {
    // MDN claims broad support across browsers
    touchInput = String(window.matchMedia("(pointer: coarse)").matches);
  } catch (e) {}
  const client = _MatrixClientPeg.MatrixClientPeg.get();
  _logger.logger.log("Sending bug report.");
  const body = new FormData();
  body.append("text", opts.userText || "User did not supply any additional text.");
  body.append("app", opts.customApp || "element-web");
  body.append("version", version ?? "UNKNOWN");
  body.append("user_agent", userAgent);
  body.append("installed_pwa", installedPWA);
  body.append("touch_input", touchInput);
  if (opts.customFields) {
    for (const key in opts.customFields) {
      body.append(key, opts.customFields[key]);
    }
  }
  if (client) {
    body.append("user_id", client.credentials.userId);
    body.append("device_id", client.deviceId);

    // TODO: make this work with rust crypto
    if (client.isCryptoEnabled() && client.crypto) {
      const keys = [`ed25519:${client.getDeviceEd25519Key()}`];
      if (client.getDeviceCurve25519Key) {
        keys.push(`curve25519:${client.getDeviceCurve25519Key()}`);
      }
      body.append("device_keys", keys.join(", "));
      body.append("cross_signing_key", (await client.getCrypto()?.getCrossSigningKeyId()) ?? "n/a");

      // add cross-signing status information
      const crossSigning = client.crypto.crossSigningInfo;
      const secretStorage = client.crypto.secretStorage;
      body.append("cross_signing_ready", String(await client.isCrossSigningReady()));
      body.append("cross_signing_key", crossSigning.getId() ?? "n/a");
      body.append("cross_signing_privkey_in_secret_storage", String(!!(await crossSigning.isStoredInSecretStorage(secretStorage))));
      const pkCache = client.getCrossSigningCacheCallbacks();
      body.append("cross_signing_master_privkey_cached", String(!!(pkCache && (await pkCache?.getCrossSigningKeyCache?.("master")))));
      body.append("cross_signing_self_signing_privkey_cached", String(!!(pkCache && (await pkCache?.getCrossSigningKeyCache?.("self_signing")))));
      body.append("cross_signing_user_signing_privkey_cached", String(!!(pkCache && (await pkCache?.getCrossSigningKeyCache?.("user_signing")))));
      body.append("secret_storage_ready", String(await client.isSecretStorageReady()));
      body.append("secret_storage_key_in_account", String(!!(await secretStorage.hasKey())));
      body.append("session_backup_key_in_secret_storage", String(!!(await client.isKeyBackupKeyStored())));
      const sessionBackupKeyFromCache = await client.crypto.getSessionBackupPrivateKey();
      body.append("session_backup_key_cached", String(!!sessionBackupKeyFromCache));
      body.append("session_backup_key_well_formed", String(sessionBackupKeyFromCache instanceof Uint8Array));
    }
  }
  if (opts.labels) {
    for (const label of opts.labels) {
      body.append("label", label);
    }
  }

  // add labs options
  const enabledLabs = _SettingsStore.default.getFeatureSettingNames().filter(f => _SettingsStore.default.getValue(f));
  if (enabledLabs.length) {
    body.append("enabled_labs", enabledLabs.join(", "));
  }
  // if low bandwidth mode is enabled, say so over rageshake, it causes many issues
  if (_SettingsStore.default.getValue("lowBandwidth")) {
    body.append("lowBandwidth", "enabled");
  }

  // add storage persistence/quota information
  if (navigator.storage && navigator.storage.persisted) {
    try {
      body.append("storageManager_persisted", String(await navigator.storage.persisted()));
    } catch (e) {}
  } else if (document.hasStorageAccess) {
    // Safari
    try {
      body.append("storageManager_persisted", String(await document.hasStorageAccess()));
    } catch (e) {}
  }
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      body.append("storageManager_quota", String(estimate.quota));
      body.append("storageManager_usage", String(estimate.usage));
      if (estimate.usageDetails) {
        Object.keys(estimate.usageDetails).forEach(k => {
          body.append(`storageManager_usage_${k}`, String(estimate.usageDetails[k]));
        });
      }
    } catch (e) {}
  }
  if (window.Modernizr) {
    const missingFeatures = Object.keys(window.Modernizr).filter(key => window.Modernizr[key] === false);
    if (missingFeatures.length > 0) {
      body.append("modernizr_missing_features", missingFeatures.join(", "));
    }
  }
  body.append("mx_local_settings", localStorage.getItem("mx_local_settings"));
  if (opts.sendLogs) {
    let pako;
    if (gzipLogs) {
      pako = await Promise.resolve().then(() => _interopRequireWildcard(require("pako")));
    }
    progressCallback((0, _languageHandler._t)("Collecting logs"));
    const logs = await rageshake.getLogsForReport();
    for (const entry of logs) {
      // encode as UTF-8
      let buf = new TextEncoder().encode(entry.lines);

      // compress
      if (gzipLogs) {
        buf = pako.gzip(buf);
      }
      body.append("compressed-log", new Blob([buf]), entry.id);
    }
  }
  return body;
}

/**
 * Send a bug report.
 *
 * @param {string} bugReportEndpoint HTTP url to send the report to
 *
 * @param {object} opts optional dictionary of options
 *
 * @param {string} opts.userText Any additional user input.
 *
 * @param {boolean} opts.sendLogs True to send logs
 *
 * @param {function(string)} opts.progressCallback Callback to call with progress updates
 *
 * @return {Promise<string>} URL returned by the rageshake server
 */
async function sendBugReport(bugReportEndpoint) {
  let opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  if (!bugReportEndpoint) {
    throw new Error("No bug report endpoint has been set.");
  }
  const progressCallback = opts.progressCallback || (() => {});
  const body = await collectBugReport(opts);
  progressCallback((0, _languageHandler._t)("Uploading logs"));
  return submitReport(bugReportEndpoint, body, progressCallback);
}

/**
 * Downloads the files from a bug report. This is the same as sendBugReport,
 * but instead causes the browser to download the files locally.
 *
 * @param {object} opts optional dictionary of options
 *
 * @param {string} opts.userText Any additional user input.
 *
 * @param {boolean} opts.sendLogs True to send logs
 *
 * @param {function(string)} opts.progressCallback Callback to call with progress updates
 *
 * @return {Promise} Resolved when the bug report is downloaded (or started).
 */
async function downloadBugReport() {
  let opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  const Tar = (await Promise.resolve().then(() => _interopRequireWildcard(require("tar-js")))).default;
  const progressCallback = opts.progressCallback || (() => {});
  const body = await collectBugReport(opts, false);
  progressCallback((0, _languageHandler._t)("Downloading logs"));
  let metadata = "";
  const tape = new Tar();
  let i = 0;
  for (const [key, value] of body.entries()) {
    if (key === "compressed-log") {
      await new Promise(resolve => {
        const reader = new FileReader();
        reader.addEventListener("loadend", ev => {
          tape.append(`log-${i++}.log`, new TextDecoder().decode(reader.result));
          resolve();
        });
        reader.readAsArrayBuffer(value);
      });
    } else {
      metadata += `${key} = ${value}\n`;
    }
  }
  tape.append("issue.txt", metadata);

  // We have to create a new anchor to download if we want a filename. Otherwise we could
  // just use window.open.
  const dl = document.createElement("a");
  dl.href = `data:application/octet-stream;base64,${btoa(uint8ToString(tape.out))}`;
  dl.download = "rageshake.tar";
  document.body.appendChild(dl);
  dl.click();
  document.body.removeChild(dl);
}

// Source: https://github.com/beatgammit/tar-js/blob/master/examples/main.js
function uint8ToString(buf) {
  let out = "";
  for (let i = 0; i < buf.length; i += 1) {
    out += String.fromCharCode(buf[i]);
  }
  return out;
}
async function submitFeedback(label, comment) {
  let canContact = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  let extraData = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
  let version;
  try {
    version = await _PlatformPeg.default.get()?.getAppVersion();
  } catch (err) {} // PlatformPeg already logs this.

  const body = new FormData();
  if (label) body.append("label", label);
  body.append("text", comment);
  body.append("can_contact", canContact ? "yes" : "no");
  body.append("app", "element-web");
  body.append("version", version || "UNKNOWN");
  body.append("platform", _PlatformPeg.default.get()?.getHumanReadableName() ?? "n/a");
  body.append("user_id", _MatrixClientPeg.MatrixClientPeg.get()?.getUserId() ?? "n/a");
  for (const k in extraData) {
    body.append(k, JSON.stringify(extraData[k]));
  }
  const bugReportEndpointUrl = _SdkConfig.default.get().bug_report_endpoint_url;
  if (bugReportEndpointUrl) {
    await submitReport(bugReportEndpointUrl, body, () => {});
  }
}
function submitReport(endpoint, body, progressCallback) {
  return new Promise((resolve, reject) => {
    const req = new XMLHttpRequest();
    req.open("POST", endpoint);
    req.responseType = "json";
    req.timeout = 5 * 60 * 1000;
    req.onreadystatechange = function () {
      if (req.readyState === XMLHttpRequest.LOADING) {
        progressCallback((0, _languageHandler._t)("Waiting for response from server"));
      } else if (req.readyState === XMLHttpRequest.DONE) {
        // on done
        if (req.status < 200 || req.status >= 400) {
          reject(new Error(`HTTP ${req.status}`));
          return;
        }
        resolve(req.response.report_url || "");
      }
    };
    req.send(body);
  });
}
//# sourceMappingURL=submit-rageshake.js.map