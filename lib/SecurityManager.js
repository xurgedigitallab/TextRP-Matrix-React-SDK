"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.AccessCancelledError = void 0;
exports.accessSecretStorage = accessSecretStorage;
exports.crossSigningCallbacks = void 0;
exports.getDehydrationKey = getDehydrationKey;
exports.isSecretStorageBeingAccessed = isSecretStorageBeingAccessed;
exports.promptForBackupPassphrase = promptForBackupPassphrase;
exports.tryToUnlockSecretStorageWithDehydrationKey = tryToUnlockSecretStorageWithDehydrationKey;
var _key_passphrase = require("matrix-js-sdk/src/crypto/key_passphrase");
var _recoverykey = require("matrix-js-sdk/src/crypto/recoverykey");
var _olmlib = require("matrix-js-sdk/src/crypto/olmlib");
var _logger = require("matrix-js-sdk/src/logger");
var _Modal = _interopRequireDefault(require("./Modal"));
var _MatrixClientPeg = require("./MatrixClientPeg");
var _languageHandler = require("./languageHandler");
var _WellKnownUtils = require("./utils/WellKnownUtils");
var _AccessSecretStorageDialog = _interopRequireDefault(require("./components/views/dialogs/security/AccessSecretStorageDialog"));
var _RestoreKeyBackupDialog = _interopRequireDefault(require("./components/views/dialogs/security/RestoreKeyBackupDialog"));
var _SettingsStore = _interopRequireDefault(require("./settings/SettingsStore"));
var _Security = _interopRequireDefault(require("./customisations/Security"));
var _QuestionDialog = _interopRequireDefault(require("./components/views/dialogs/QuestionDialog"));
var _InteractiveAuthDialog = _interopRequireDefault(require("./components/views/dialogs/InteractiveAuthDialog"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; } /*
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
// This stores the secret storage private keys in memory for the JS SDK. This is
// only meant to act as a cache to avoid prompting the user multiple times
// during the same single operation. Use `accessSecretStorage` below to scope a
// single secret storage operation, as it will clear the cached keys once the
// operation ends.
let secretStorageKeys = {};
let secretStorageKeyInfo = {};
let secretStorageBeingAccessed = false;
let nonInteractive = false;
let dehydrationCache = {};
function isCachingAllowed() {
  return secretStorageBeingAccessed;
}

/**
 * This can be used by other components to check if secret storage access is in
 * progress, so that we can e.g. avoid intermittently showing toasts during
 * secret storage setup.
 *
 * @returns {bool}
 */
function isSecretStorageBeingAccessed() {
  return secretStorageBeingAccessed;
}
class AccessCancelledError extends Error {
  constructor() {
    super("Secret storage access canceled");
  }
}
exports.AccessCancelledError = AccessCancelledError;
async function confirmToDismiss() {
  const [sure] = await _Modal.default.createDialog(_QuestionDialog.default, {
    title: (0, _languageHandler._t)("Cancel entering passphrase?"),
    description: (0, _languageHandler._t)("Are you sure you want to cancel entering passphrase?"),
    danger: false,
    button: (0, _languageHandler._t)("Go Back"),
    cancelButton: (0, _languageHandler._t)("Cancel")
  }).finished;
  return !sure;
}
function makeInputToKey(keyInfo) {
  return async _ref => {
    let {
      passphrase,
      recoveryKey
    } = _ref;
    if (passphrase) {
      return (0, _key_passphrase.deriveKey)(passphrase, keyInfo.passphrase.salt, keyInfo.passphrase.iterations);
    } else if (recoveryKey) {
      return (0, _recoverykey.decodeRecoveryKey)(recoveryKey);
    }
    throw new Error("Invalid input, passphrase or recoveryKey need to be provided");
  };
}
async function getSecretStorageKey(_ref2) {
  let {
    keys: keyInfos
  } = _ref2;
  const cli = _MatrixClientPeg.MatrixClientPeg.get();
  let keyId = await cli.getDefaultSecretStorageKeyId();
  let keyInfo;
  if (keyId) {
    // use the default SSSS key if set
    keyInfo = keyInfos[keyId];
    if (!keyInfo) {
      // if the default key is not available, pretend the default key
      // isn't set
      keyId = null;
    }
  }
  if (!keyId) {
    // if no default SSSS key is set, fall back to a heuristic of using the
    // only available key, if only one key is set
    const keyInfoEntries = Object.entries(keyInfos);
    if (keyInfoEntries.length > 1) {
      throw new Error("Multiple storage key requests not implemented");
    }
    [keyId, keyInfo] = keyInfoEntries[0];
  }

  // Check the in-memory cache
  if (isCachingAllowed() && secretStorageKeys[keyId]) {
    return [keyId, secretStorageKeys[keyId]];
  }
  if (dehydrationCache.key) {
    if (await _MatrixClientPeg.MatrixClientPeg.get().checkSecretStorageKey(dehydrationCache.key, keyInfo)) {
      cacheSecretStorageKey(keyId, keyInfo, dehydrationCache.key);
      return [keyId, dehydrationCache.key];
    }
  }
  const keyFromCustomisations = _Security.default.getSecretStorageKey?.();
  if (keyFromCustomisations) {
    _logger.logger.log("Using key from security customisations (secret storage)");
    cacheSecretStorageKey(keyId, keyInfo, keyFromCustomisations);
    return [keyId, keyFromCustomisations];
  }
  if (nonInteractive) {
    throw new Error("Could not unlock non-interactively");
  }
  const inputToKey = makeInputToKey(keyInfo);
  const {
    finished
  } = _Modal.default.createDialog(_AccessSecretStorageDialog.default, /* props= */
  {
    keyInfo,
    checkPrivateKey: async input => {
      const key = await inputToKey(input);
      return _MatrixClientPeg.MatrixClientPeg.get().checkSecretStorageKey(key, keyInfo);
    }
  }, /* className= */undefined, /* isPriorityModal= */false, /* isStaticModal= */false, /* options= */{
    onBeforeClose: async reason => {
      if (reason === "backgroundClick") {
        return confirmToDismiss();
      }
      return true;
    }
  });
  const [keyParams] = await finished;
  if (!keyParams) {
    throw new AccessCancelledError();
  }
  const key = await inputToKey(keyParams);

  // Save to cache to avoid future prompts in the current session
  cacheSecretStorageKey(keyId, keyInfo, key);
  return [keyId, key];
}
async function getDehydrationKey(keyInfo, checkFunc) {
  const keyFromCustomisations = _Security.default.getSecretStorageKey?.();
  if (keyFromCustomisations) {
    _logger.logger.log("Using key from security customisations (dehydration)");
    return keyFromCustomisations;
  }
  const inputToKey = makeInputToKey(keyInfo);
  const {
    finished
  } = _Modal.default.createDialog(_AccessSecretStorageDialog.default, /* props= */
  {
    keyInfo,
    checkPrivateKey: async input => {
      const key = await inputToKey(input);
      try {
        checkFunc(key);
        return true;
      } catch (e) {
        return false;
      }
    }
  }, /* className= */undefined, /* isPriorityModal= */false, /* isStaticModal= */false, /* options= */{
    onBeforeClose: async reason => {
      if (reason === "backgroundClick") {
        return confirmToDismiss();
      }
      return true;
    }
  });
  const [input] = await finished;
  if (!input) {
    throw new AccessCancelledError();
  }
  const key = await inputToKey(input);

  // need to copy the key because rehydration (unpickling) will clobber it
  dehydrationCache = {
    key: new Uint8Array(key),
    keyInfo
  };
  return key;
}
function cacheSecretStorageKey(keyId, keyInfo, key) {
  if (isCachingAllowed()) {
    secretStorageKeys[keyId] = key;
    secretStorageKeyInfo[keyId] = keyInfo;
  }
}
async function onSecretRequested(userId, deviceId, requestId, name, deviceTrust) {
  _logger.logger.log("onSecretRequested", userId, deviceId, requestId, name, deviceTrust);
  const client = _MatrixClientPeg.MatrixClientPeg.get();
  if (userId !== client.getUserId()) {
    return;
  }
  if (!deviceTrust?.isVerified()) {
    _logger.logger.log(`Ignoring secret request from untrusted device ${deviceId}`);
    return;
  }
  if (name === "m.cross_signing.master" || name === "m.cross_signing.self_signing" || name === "m.cross_signing.user_signing") {
    const callbacks = client.getCrossSigningCacheCallbacks();
    if (!callbacks?.getCrossSigningKeyCache) return;
    const keyId = name.replace("m.cross_signing.", "");
    const key = await callbacks.getCrossSigningKeyCache(keyId);
    if (!key) {
      _logger.logger.log(`${keyId} requested by ${deviceId}, but not found in cache`);
    }
    return key ? (0, _olmlib.encodeBase64)(key) : undefined;
  } else if (name === "m.megolm_backup.v1") {
    const key = await client.crypto?.getSessionBackupPrivateKey();
    if (!key) {
      _logger.logger.log(`session backup key requested by ${deviceId}, but not found in cache`);
    }
    return key ? (0, _olmlib.encodeBase64)(key) : undefined;
  }
  _logger.logger.warn("onSecretRequested didn't recognise the secret named ", name);
}
const crossSigningCallbacks = {
  getSecretStorageKey,
  cacheSecretStorageKey,
  onSecretRequested,
  getDehydrationKey
};
exports.crossSigningCallbacks = crossSigningCallbacks;
async function promptForBackupPassphrase() {
  let key;
  const {
    finished
  } = _Modal.default.createDialog(_RestoreKeyBackupDialog.default, {
    showSummary: false,
    keyCallback: k => key = k
  }, undefined, /* priority = */false, /* static = */true);
  const success = await finished;
  if (!success) throw new Error("Key backup prompt cancelled");
  return key;
}

/**
 * This helper should be used whenever you need to access secret storage. It
 * ensures that secret storage (and also cross-signing since they each depend on
 * each other in a cycle of sorts) have been bootstrapped before running the
 * provided function.
 *
 * Bootstrapping secret storage may take one of these paths:
 * 1. Create secret storage from a passphrase and store cross-signing keys
 *    in secret storage.
 * 2. Access existing secret storage by requesting passphrase and accessing
 *    cross-signing keys as needed.
 * 3. All keys are loaded and there's nothing to do.
 *
 * Additionally, the secret storage keys are cached during the scope of this function
 * to ensure the user is prompted only once for their secret storage
 * passphrase. The cache is then cleared once the provided function completes.
 *
 * @param {Function} [func] An operation to perform once secret storage has been
 * bootstrapped. Optional.
 * @param {bool} [forceReset] Reset secret storage even if it's already set up
 */
async function accessSecretStorage() {
  let func = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : async () => {};
  let forceReset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
  const cli = _MatrixClientPeg.MatrixClientPeg.get();
  secretStorageBeingAccessed = true;
  try {
    if (!(await cli.hasSecretStorageKey()) || forceReset) {
      // This dialog calls bootstrap itself after guiding the user through
      // passphrase creation.
      const {
        finished
      } = _Modal.default.createDialogAsync(Promise.resolve().then(() => _interopRequireWildcard(require("./async-components/views/dialogs/security/CreateSecretStorageDialog"))), {
        forceReset
      }, undefined, /* priority = */false, /* static = */true, /* options = */{
        onBeforeClose: async reason => {
          // If Secure Backup is required, you cannot leave the modal.
          if (reason === "backgroundClick") {
            return !(0, _WellKnownUtils.isSecureBackupRequired)(cli);
          }
          return true;
        }
      });
      const [confirmed] = await finished;
      if (!confirmed) {
        throw new Error("Secret storage creation canceled");
      }
    } else {
      await cli.bootstrapCrossSigning({
        authUploadDeviceSigningKeys: async makeRequest => {
          const {
            finished
          } = _Modal.default.createDialog(_InteractiveAuthDialog.default, {
            title: (0, _languageHandler._t)("Setting up keys"),
            matrixClient: cli,
            makeRequest
          });
          const [confirmed] = await finished;
          if (!confirmed) {
            throw new Error("Cross-signing key upload auth canceled");
          }
        }
      });
      await cli.bootstrapSecretStorage({
        getKeyBackupPassphrase: promptForBackupPassphrase
      });
      const keyId = Object.keys(secretStorageKeys)[0];
      if (keyId && _SettingsStore.default.getValue("feature_dehydration")) {
        let dehydrationKeyInfo = {};
        if (secretStorageKeyInfo[keyId] && secretStorageKeyInfo[keyId].passphrase) {
          dehydrationKeyInfo = {
            passphrase: secretStorageKeyInfo[keyId].passphrase
          };
        }
        _logger.logger.log("Setting dehydration key");
        await cli.setDehydrationKey(secretStorageKeys[keyId], dehydrationKeyInfo, "Backup device");
      } else if (!keyId) {
        _logger.logger.warn("Not setting dehydration key: no SSSS key found");
      } else {
        _logger.logger.log("Not setting dehydration key: feature disabled");
      }
    }

    // `return await` needed here to ensure `finally` block runs after the
    // inner operation completes.
    return await func();
  } catch (e) {
    _Security.default.catchAccessSecretStorageError?.(e);
    _logger.logger.error(e);
    // Re-throw so that higher level logic can abort as needed
    throw e;
  } finally {
    // Clear secret storage key cache now that work is complete
    secretStorageBeingAccessed = false;
    if (!isCachingAllowed()) {
      secretStorageKeys = {};
      secretStorageKeyInfo = {};
    }
  }
}

// FIXME: this function name is a bit of a mouthful
async function tryToUnlockSecretStorageWithDehydrationKey(client) {
  const key = dehydrationCache.key;
  let restoringBackup = false;
  if (key && (await client.isSecretStorageReady())) {
    _logger.logger.log("Trying to set up cross-signing using dehydration key");
    secretStorageBeingAccessed = true;
    nonInteractive = true;
    try {
      await client.checkOwnCrossSigningTrust();

      // we also need to set a new dehydrated device to replace the
      // device we rehydrated
      let dehydrationKeyInfo = {};
      if (dehydrationCache.keyInfo && dehydrationCache.keyInfo.passphrase) {
        dehydrationKeyInfo = {
          passphrase: dehydrationCache.keyInfo.passphrase
        };
      }
      await client.setDehydrationKey(key, dehydrationKeyInfo, "Backup device");

      // and restore from backup
      const backupInfo = await client.getKeyBackupVersion();
      if (backupInfo) {
        restoringBackup = true;
        // don't await, because this can take a long time
        client.restoreKeyBackupWithSecretStorage(backupInfo).finally(() => {
          secretStorageBeingAccessed = false;
          nonInteractive = false;
          if (!isCachingAllowed()) {
            secretStorageKeys = {};
            secretStorageKeyInfo = {};
          }
        });
      }
    } finally {
      dehydrationCache = {};
      // the secret storage cache is needed for restoring from backup, so
      // don't clear it yet if we're restoring from backup
      if (!restoringBackup) {
        secretStorageBeingAccessed = false;
        nonInteractive = false;
        if (!isCachingAllowed()) {
          secretStorageKeys = {};
          secretStorageKeyInfo = {};
        }
      }
    }
  }
}
//# sourceMappingURL=SecurityManager.js.map