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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfa2V5X3Bhc3NwaHJhc2UiLCJyZXF1aXJlIiwiX3JlY292ZXJ5a2V5IiwiX29sbWxpYiIsIl9sb2dnZXIiLCJfTW9kYWwiLCJfaW50ZXJvcFJlcXVpcmVEZWZhdWx0IiwiX01hdHJpeENsaWVudFBlZyIsIl9sYW5ndWFnZUhhbmRsZXIiLCJfV2VsbEtub3duVXRpbHMiLCJfQWNjZXNzU2VjcmV0U3RvcmFnZURpYWxvZyIsIl9SZXN0b3JlS2V5QmFja3VwRGlhbG9nIiwiX1NldHRpbmdzU3RvcmUiLCJfU2VjdXJpdHkiLCJfUXVlc3Rpb25EaWFsb2ciLCJfSW50ZXJhY3RpdmVBdXRoRGlhbG9nIiwiX2dldFJlcXVpcmVXaWxkY2FyZENhY2hlIiwibm9kZUludGVyb3AiLCJXZWFrTWFwIiwiY2FjaGVCYWJlbEludGVyb3AiLCJjYWNoZU5vZGVJbnRlcm9wIiwiX2ludGVyb3BSZXF1aXJlV2lsZGNhcmQiLCJvYmoiLCJfX2VzTW9kdWxlIiwiZGVmYXVsdCIsImNhY2hlIiwiaGFzIiwiZ2V0IiwibmV3T2JqIiwiaGFzUHJvcGVydHlEZXNjcmlwdG9yIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IiLCJrZXkiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImNhbGwiLCJkZXNjIiwic2V0Iiwic2VjcmV0U3RvcmFnZUtleXMiLCJzZWNyZXRTdG9yYWdlS2V5SW5mbyIsInNlY3JldFN0b3JhZ2VCZWluZ0FjY2Vzc2VkIiwibm9uSW50ZXJhY3RpdmUiLCJkZWh5ZHJhdGlvbkNhY2hlIiwiaXNDYWNoaW5nQWxsb3dlZCIsImlzU2VjcmV0U3RvcmFnZUJlaW5nQWNjZXNzZWQiLCJBY2Nlc3NDYW5jZWxsZWRFcnJvciIsIkVycm9yIiwiY29uc3RydWN0b3IiLCJleHBvcnRzIiwiY29uZmlybVRvRGlzbWlzcyIsInN1cmUiLCJNb2RhbCIsImNyZWF0ZURpYWxvZyIsIlF1ZXN0aW9uRGlhbG9nIiwidGl0bGUiLCJfdCIsImRlc2NyaXB0aW9uIiwiZGFuZ2VyIiwiYnV0dG9uIiwiY2FuY2VsQnV0dG9uIiwiZmluaXNoZWQiLCJtYWtlSW5wdXRUb0tleSIsImtleUluZm8iLCJfcmVmIiwicGFzc3BocmFzZSIsInJlY292ZXJ5S2V5IiwiZGVyaXZlS2V5Iiwic2FsdCIsIml0ZXJhdGlvbnMiLCJkZWNvZGVSZWNvdmVyeUtleSIsImdldFNlY3JldFN0b3JhZ2VLZXkiLCJfcmVmMiIsImtleXMiLCJrZXlJbmZvcyIsImNsaSIsIk1hdHJpeENsaWVudFBlZyIsImtleUlkIiwiZ2V0RGVmYXVsdFNlY3JldFN0b3JhZ2VLZXlJZCIsImtleUluZm9FbnRyaWVzIiwiZW50cmllcyIsImxlbmd0aCIsImNoZWNrU2VjcmV0U3RvcmFnZUtleSIsImNhY2hlU2VjcmV0U3RvcmFnZUtleSIsImtleUZyb21DdXN0b21pc2F0aW9ucyIsIlNlY3VyaXR5Q3VzdG9taXNhdGlvbnMiLCJsb2dnZXIiLCJsb2ciLCJpbnB1dFRvS2V5IiwiQWNjZXNzU2VjcmV0U3RvcmFnZURpYWxvZyIsImNoZWNrUHJpdmF0ZUtleSIsImlucHV0IiwidW5kZWZpbmVkIiwib25CZWZvcmVDbG9zZSIsInJlYXNvbiIsImtleVBhcmFtcyIsImdldERlaHlkcmF0aW9uS2V5IiwiY2hlY2tGdW5jIiwiZSIsIlVpbnQ4QXJyYXkiLCJvblNlY3JldFJlcXVlc3RlZCIsInVzZXJJZCIsImRldmljZUlkIiwicmVxdWVzdElkIiwibmFtZSIsImRldmljZVRydXN0IiwiY2xpZW50IiwiZ2V0VXNlcklkIiwiaXNWZXJpZmllZCIsImNhbGxiYWNrcyIsImdldENyb3NzU2lnbmluZ0NhY2hlQ2FsbGJhY2tzIiwiZ2V0Q3Jvc3NTaWduaW5nS2V5Q2FjaGUiLCJyZXBsYWNlIiwiZW5jb2RlQmFzZTY0IiwiY3J5cHRvIiwiZ2V0U2Vzc2lvbkJhY2t1cFByaXZhdGVLZXkiLCJ3YXJuIiwiY3Jvc3NTaWduaW5nQ2FsbGJhY2tzIiwicHJvbXB0Rm9yQmFja3VwUGFzc3BocmFzZSIsIlJlc3RvcmVLZXlCYWNrdXBEaWFsb2ciLCJzaG93U3VtbWFyeSIsImtleUNhbGxiYWNrIiwiayIsInN1Y2Nlc3MiLCJhY2Nlc3NTZWNyZXRTdG9yYWdlIiwiZnVuYyIsImFyZ3VtZW50cyIsImZvcmNlUmVzZXQiLCJoYXNTZWNyZXRTdG9yYWdlS2V5IiwiY3JlYXRlRGlhbG9nQXN5bmMiLCJQcm9taXNlIiwicmVzb2x2ZSIsInRoZW4iLCJpc1NlY3VyZUJhY2t1cFJlcXVpcmVkIiwiY29uZmlybWVkIiwiYm9vdHN0cmFwQ3Jvc3NTaWduaW5nIiwiYXV0aFVwbG9hZERldmljZVNpZ25pbmdLZXlzIiwibWFrZVJlcXVlc3QiLCJJbnRlcmFjdGl2ZUF1dGhEaWFsb2ciLCJtYXRyaXhDbGllbnQiLCJib290c3RyYXBTZWNyZXRTdG9yYWdlIiwiZ2V0S2V5QmFja3VwUGFzc3BocmFzZSIsIlNldHRpbmdzU3RvcmUiLCJnZXRWYWx1ZSIsImRlaHlkcmF0aW9uS2V5SW5mbyIsInNldERlaHlkcmF0aW9uS2V5IiwiY2F0Y2hBY2Nlc3NTZWNyZXRTdG9yYWdlRXJyb3IiLCJlcnJvciIsInRyeVRvVW5sb2NrU2VjcmV0U3RvcmFnZVdpdGhEZWh5ZHJhdGlvbktleSIsInJlc3RvcmluZ0JhY2t1cCIsImlzU2VjcmV0U3RvcmFnZVJlYWR5IiwiY2hlY2tPd25Dcm9zc1NpZ25pbmdUcnVzdCIsImJhY2t1cEluZm8iLCJnZXRLZXlCYWNrdXBWZXJzaW9uIiwicmVzdG9yZUtleUJhY2t1cFdpdGhTZWNyZXRTdG9yYWdlIiwiZmluYWxseSJdLCJzb3VyY2VzIjpbIi4uL3NyYy9TZWN1cml0eU1hbmFnZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbkNvcHlyaWdodCAyMDE5LCAyMDIwIFRoZSBNYXRyaXgub3JnIEZvdW5kYXRpb24gQy5JLkMuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuKi9cblxuaW1wb3J0IHsgSUNyeXB0b0NhbGxiYWNrcyB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9tYXRyaXhcIjtcbmltcG9ydCB7IElTZWNyZXRTdG9yYWdlS2V5SW5mbyB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9jcnlwdG8vYXBpXCI7XG5pbXBvcnQgeyBNYXRyaXhDbGllbnQgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvY2xpZW50XCI7XG5pbXBvcnQgeyBkZXJpdmVLZXkgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvY3J5cHRvL2tleV9wYXNzcGhyYXNlXCI7XG5pbXBvcnQgeyBkZWNvZGVSZWNvdmVyeUtleSB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9jcnlwdG8vcmVjb3ZlcnlrZXlcIjtcbmltcG9ydCB7IGVuY29kZUJhc2U2NCB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9jcnlwdG8vb2xtbGliXCI7XG5pbXBvcnQgeyBEZXZpY2VUcnVzdExldmVsIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL2NyeXB0by9Dcm9zc1NpZ25pbmdcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9sb2dnZXJcIjtcblxuaW1wb3J0IHR5cGUgQ3JlYXRlU2VjcmV0U3RvcmFnZURpYWxvZyBmcm9tIFwiLi9hc3luYy1jb21wb25lbnRzL3ZpZXdzL2RpYWxvZ3Mvc2VjdXJpdHkvQ3JlYXRlU2VjcmV0U3RvcmFnZURpYWxvZ1wiO1xuaW1wb3J0IE1vZGFsIGZyb20gXCIuL01vZGFsXCI7XG5pbXBvcnQgeyBNYXRyaXhDbGllbnRQZWcgfSBmcm9tIFwiLi9NYXRyaXhDbGllbnRQZWdcIjtcbmltcG9ydCB7IF90IH0gZnJvbSBcIi4vbGFuZ3VhZ2VIYW5kbGVyXCI7XG5pbXBvcnQgeyBpc1NlY3VyZUJhY2t1cFJlcXVpcmVkIH0gZnJvbSBcIi4vdXRpbHMvV2VsbEtub3duVXRpbHNcIjtcbmltcG9ydCBBY2Nlc3NTZWNyZXRTdG9yYWdlRGlhbG9nLCB7IEtleVBhcmFtcyB9IGZyb20gXCIuL2NvbXBvbmVudHMvdmlld3MvZGlhbG9ncy9zZWN1cml0eS9BY2Nlc3NTZWNyZXRTdG9yYWdlRGlhbG9nXCI7XG5pbXBvcnQgUmVzdG9yZUtleUJhY2t1cERpYWxvZyBmcm9tIFwiLi9jb21wb25lbnRzL3ZpZXdzL2RpYWxvZ3Mvc2VjdXJpdHkvUmVzdG9yZUtleUJhY2t1cERpYWxvZ1wiO1xuaW1wb3J0IFNldHRpbmdzU3RvcmUgZnJvbSBcIi4vc2V0dGluZ3MvU2V0dGluZ3NTdG9yZVwiO1xuaW1wb3J0IFNlY3VyaXR5Q3VzdG9taXNhdGlvbnMgZnJvbSBcIi4vY3VzdG9taXNhdGlvbnMvU2VjdXJpdHlcIjtcbmltcG9ydCBRdWVzdGlvbkRpYWxvZyBmcm9tIFwiLi9jb21wb25lbnRzL3ZpZXdzL2RpYWxvZ3MvUXVlc3Rpb25EaWFsb2dcIjtcbmltcG9ydCBJbnRlcmFjdGl2ZUF1dGhEaWFsb2cgZnJvbSBcIi4vY29tcG9uZW50cy92aWV3cy9kaWFsb2dzL0ludGVyYWN0aXZlQXV0aERpYWxvZ1wiO1xuXG4vLyBUaGlzIHN0b3JlcyB0aGUgc2VjcmV0IHN0b3JhZ2UgcHJpdmF0ZSBrZXlzIGluIG1lbW9yeSBmb3IgdGhlIEpTIFNESy4gVGhpcyBpc1xuLy8gb25seSBtZWFudCB0byBhY3QgYXMgYSBjYWNoZSB0byBhdm9pZCBwcm9tcHRpbmcgdGhlIHVzZXIgbXVsdGlwbGUgdGltZXNcbi8vIGR1cmluZyB0aGUgc2FtZSBzaW5nbGUgb3BlcmF0aW9uLiBVc2UgYGFjY2Vzc1NlY3JldFN0b3JhZ2VgIGJlbG93IHRvIHNjb3BlIGFcbi8vIHNpbmdsZSBzZWNyZXQgc3RvcmFnZSBvcGVyYXRpb24sIGFzIGl0IHdpbGwgY2xlYXIgdGhlIGNhY2hlZCBrZXlzIG9uY2UgdGhlXG4vLyBvcGVyYXRpb24gZW5kcy5cbmxldCBzZWNyZXRTdG9yYWdlS2V5czogUmVjb3JkPHN0cmluZywgVWludDhBcnJheT4gPSB7fTtcbmxldCBzZWNyZXRTdG9yYWdlS2V5SW5mbzogUmVjb3JkPHN0cmluZywgSVNlY3JldFN0b3JhZ2VLZXlJbmZvPiA9IHt9O1xubGV0IHNlY3JldFN0b3JhZ2VCZWluZ0FjY2Vzc2VkID0gZmFsc2U7XG5cbmxldCBub25JbnRlcmFjdGl2ZSA9IGZhbHNlO1xuXG5sZXQgZGVoeWRyYXRpb25DYWNoZToge1xuICAgIGtleT86IFVpbnQ4QXJyYXk7XG4gICAga2V5SW5mbz86IElTZWNyZXRTdG9yYWdlS2V5SW5mbztcbn0gPSB7fTtcblxuZnVuY3Rpb24gaXNDYWNoaW5nQWxsb3dlZCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gc2VjcmV0U3RvcmFnZUJlaW5nQWNjZXNzZWQ7XG59XG5cbi8qKlxuICogVGhpcyBjYW4gYmUgdXNlZCBieSBvdGhlciBjb21wb25lbnRzIHRvIGNoZWNrIGlmIHNlY3JldCBzdG9yYWdlIGFjY2VzcyBpcyBpblxuICogcHJvZ3Jlc3MsIHNvIHRoYXQgd2UgY2FuIGUuZy4gYXZvaWQgaW50ZXJtaXR0ZW50bHkgc2hvd2luZyB0b2FzdHMgZHVyaW5nXG4gKiBzZWNyZXQgc3RvcmFnZSBzZXR1cC5cbiAqXG4gKiBAcmV0dXJucyB7Ym9vbH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzU2VjcmV0U3RvcmFnZUJlaW5nQWNjZXNzZWQoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHNlY3JldFN0b3JhZ2VCZWluZ0FjY2Vzc2VkO1xufVxuXG5leHBvcnQgY2xhc3MgQWNjZXNzQ2FuY2VsbGVkRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gICAgcHVibGljIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcihcIlNlY3JldCBzdG9yYWdlIGFjY2VzcyBjYW5jZWxlZFwiKTtcbiAgICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNvbmZpcm1Ub0Rpc21pc3MoKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgY29uc3QgW3N1cmVdID0gYXdhaXQgTW9kYWwuY3JlYXRlRGlhbG9nKFF1ZXN0aW9uRGlhbG9nLCB7XG4gICAgICAgIHRpdGxlOiBfdChcIkNhbmNlbCBlbnRlcmluZyBwYXNzcGhyYXNlP1wiKSxcbiAgICAgICAgZGVzY3JpcHRpb246IF90KFwiQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIGNhbmNlbCBlbnRlcmluZyBwYXNzcGhyYXNlP1wiKSxcbiAgICAgICAgZGFuZ2VyOiBmYWxzZSxcbiAgICAgICAgYnV0dG9uOiBfdChcIkdvIEJhY2tcIiksXG4gICAgICAgIGNhbmNlbEJ1dHRvbjogX3QoXCJDYW5jZWxcIiksXG4gICAgfSkuZmluaXNoZWQ7XG4gICAgcmV0dXJuICFzdXJlO1xufVxuXG5mdW5jdGlvbiBtYWtlSW5wdXRUb0tleShrZXlJbmZvOiBJU2VjcmV0U3RvcmFnZUtleUluZm8pOiAoa2V5UGFyYW1zOiBLZXlQYXJhbXMpID0+IFByb21pc2U8VWludDhBcnJheT4ge1xuICAgIHJldHVybiBhc3luYyAoeyBwYXNzcGhyYXNlLCByZWNvdmVyeUtleSB9KTogUHJvbWlzZTxVaW50OEFycmF5PiA9PiB7XG4gICAgICAgIGlmIChwYXNzcGhyYXNlKSB7XG4gICAgICAgICAgICByZXR1cm4gZGVyaXZlS2V5KHBhc3NwaHJhc2UsIGtleUluZm8ucGFzc3BocmFzZS5zYWx0LCBrZXlJbmZvLnBhc3NwaHJhc2UuaXRlcmF0aW9ucyk7XG4gICAgICAgIH0gZWxzZSBpZiAocmVjb3ZlcnlLZXkpIHtcbiAgICAgICAgICAgIHJldHVybiBkZWNvZGVSZWNvdmVyeUtleShyZWNvdmVyeUtleSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBpbnB1dCwgcGFzc3BocmFzZSBvciByZWNvdmVyeUtleSBuZWVkIHRvIGJlIHByb3ZpZGVkXCIpO1xuICAgIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldFNlY3JldFN0b3JhZ2VLZXkoe1xuICAgIGtleXM6IGtleUluZm9zLFxufToge1xuICAgIGtleXM6IFJlY29yZDxzdHJpbmcsIElTZWNyZXRTdG9yYWdlS2V5SW5mbz47XG59KTogUHJvbWlzZTxbc3RyaW5nLCBVaW50OEFycmF5XT4ge1xuICAgIGNvbnN0IGNsaSA9IE1hdHJpeENsaWVudFBlZy5nZXQoKTtcbiAgICBsZXQga2V5SWQgPSBhd2FpdCBjbGkuZ2V0RGVmYXVsdFNlY3JldFN0b3JhZ2VLZXlJZCgpO1xuICAgIGxldCBrZXlJbmZvITogSVNlY3JldFN0b3JhZ2VLZXlJbmZvO1xuICAgIGlmIChrZXlJZCkge1xuICAgICAgICAvLyB1c2UgdGhlIGRlZmF1bHQgU1NTUyBrZXkgaWYgc2V0XG4gICAgICAgIGtleUluZm8gPSBrZXlJbmZvc1trZXlJZF07XG4gICAgICAgIGlmICgha2V5SW5mbykge1xuICAgICAgICAgICAgLy8gaWYgdGhlIGRlZmF1bHQga2V5IGlzIG5vdCBhdmFpbGFibGUsIHByZXRlbmQgdGhlIGRlZmF1bHQga2V5XG4gICAgICAgICAgICAvLyBpc24ndCBzZXRcbiAgICAgICAgICAgIGtleUlkID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoIWtleUlkKSB7XG4gICAgICAgIC8vIGlmIG5vIGRlZmF1bHQgU1NTUyBrZXkgaXMgc2V0LCBmYWxsIGJhY2sgdG8gYSBoZXVyaXN0aWMgb2YgdXNpbmcgdGhlXG4gICAgICAgIC8vIG9ubHkgYXZhaWxhYmxlIGtleSwgaWYgb25seSBvbmUga2V5IGlzIHNldFxuICAgICAgICBjb25zdCBrZXlJbmZvRW50cmllcyA9IE9iamVjdC5lbnRyaWVzKGtleUluZm9zKTtcbiAgICAgICAgaWYgKGtleUluZm9FbnRyaWVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIk11bHRpcGxlIHN0b3JhZ2Uga2V5IHJlcXVlc3RzIG5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICAgICAgfVxuICAgICAgICBba2V5SWQsIGtleUluZm9dID0ga2V5SW5mb0VudHJpZXNbMF07XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgdGhlIGluLW1lbW9yeSBjYWNoZVxuICAgIGlmIChpc0NhY2hpbmdBbGxvd2VkKCkgJiYgc2VjcmV0U3RvcmFnZUtleXNba2V5SWRdKSB7XG4gICAgICAgIHJldHVybiBba2V5SWQsIHNlY3JldFN0b3JhZ2VLZXlzW2tleUlkXV07XG4gICAgfVxuXG4gICAgaWYgKGRlaHlkcmF0aW9uQ2FjaGUua2V5KSB7XG4gICAgICAgIGlmIChhd2FpdCBNYXRyaXhDbGllbnRQZWcuZ2V0KCkuY2hlY2tTZWNyZXRTdG9yYWdlS2V5KGRlaHlkcmF0aW9uQ2FjaGUua2V5LCBrZXlJbmZvKSkge1xuICAgICAgICAgICAgY2FjaGVTZWNyZXRTdG9yYWdlS2V5KGtleUlkLCBrZXlJbmZvLCBkZWh5ZHJhdGlvbkNhY2hlLmtleSk7XG4gICAgICAgICAgICByZXR1cm4gW2tleUlkLCBkZWh5ZHJhdGlvbkNhY2hlLmtleV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBrZXlGcm9tQ3VzdG9taXNhdGlvbnMgPSBTZWN1cml0eUN1c3RvbWlzYXRpb25zLmdldFNlY3JldFN0b3JhZ2VLZXk/LigpO1xuICAgIGlmIChrZXlGcm9tQ3VzdG9taXNhdGlvbnMpIHtcbiAgICAgICAgbG9nZ2VyLmxvZyhcIlVzaW5nIGtleSBmcm9tIHNlY3VyaXR5IGN1c3RvbWlzYXRpb25zIChzZWNyZXQgc3RvcmFnZSlcIik7XG4gICAgICAgIGNhY2hlU2VjcmV0U3RvcmFnZUtleShrZXlJZCwga2V5SW5mbywga2V5RnJvbUN1c3RvbWlzYXRpb25zKTtcbiAgICAgICAgcmV0dXJuIFtrZXlJZCwga2V5RnJvbUN1c3RvbWlzYXRpb25zXTtcbiAgICB9XG5cbiAgICBpZiAobm9uSW50ZXJhY3RpdmUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ291bGQgbm90IHVubG9jayBub24taW50ZXJhY3RpdmVseVwiKTtcbiAgICB9XG5cbiAgICBjb25zdCBpbnB1dFRvS2V5ID0gbWFrZUlucHV0VG9LZXkoa2V5SW5mbyk7XG4gICAgY29uc3QgeyBmaW5pc2hlZCB9ID0gTW9kYWwuY3JlYXRlRGlhbG9nKFxuICAgICAgICBBY2Nlc3NTZWNyZXRTdG9yYWdlRGlhbG9nLFxuICAgICAgICAvKiBwcm9wcz0gKi9cbiAgICAgICAge1xuICAgICAgICAgICAga2V5SW5mbyxcbiAgICAgICAgICAgIGNoZWNrUHJpdmF0ZUtleTogYXN5bmMgKGlucHV0OiBLZXlQYXJhbXMpOiBQcm9taXNlPGJvb2xlYW4+ID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBrZXkgPSBhd2FpdCBpbnB1dFRvS2V5KGlucHV0KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gTWF0cml4Q2xpZW50UGVnLmdldCgpLmNoZWNrU2VjcmV0U3RvcmFnZUtleShrZXksIGtleUluZm8pO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgLyogY2xhc3NOYW1lPSAqLyB1bmRlZmluZWQsXG4gICAgICAgIC8qIGlzUHJpb3JpdHlNb2RhbD0gKi8gZmFsc2UsXG4gICAgICAgIC8qIGlzU3RhdGljTW9kYWw9ICovIGZhbHNlLFxuICAgICAgICAvKiBvcHRpb25zPSAqLyB7XG4gICAgICAgICAgICBvbkJlZm9yZUNsb3NlOiBhc3luYyAocmVhc29uKTogUHJvbWlzZTxib29sZWFuPiA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHJlYXNvbiA9PT0gXCJiYWNrZ3JvdW5kQ2xpY2tcIikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY29uZmlybVRvRGlzbWlzcygpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgKTtcbiAgICBjb25zdCBba2V5UGFyYW1zXSA9IGF3YWl0IGZpbmlzaGVkO1xuICAgIGlmICgha2V5UGFyYW1zKSB7XG4gICAgICAgIHRocm93IG5ldyBBY2Nlc3NDYW5jZWxsZWRFcnJvcigpO1xuICAgIH1cbiAgICBjb25zdCBrZXkgPSBhd2FpdCBpbnB1dFRvS2V5KGtleVBhcmFtcyk7XG5cbiAgICAvLyBTYXZlIHRvIGNhY2hlIHRvIGF2b2lkIGZ1dHVyZSBwcm9tcHRzIGluIHRoZSBjdXJyZW50IHNlc3Npb25cbiAgICBjYWNoZVNlY3JldFN0b3JhZ2VLZXkoa2V5SWQsIGtleUluZm8sIGtleSk7XG5cbiAgICByZXR1cm4gW2tleUlkLCBrZXldO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0RGVoeWRyYXRpb25LZXkoXG4gICAga2V5SW5mbzogSVNlY3JldFN0b3JhZ2VLZXlJbmZvLFxuICAgIGNoZWNrRnVuYzogKGRhdGE6IFVpbnQ4QXJyYXkpID0+IHZvaWQsXG4pOiBQcm9taXNlPFVpbnQ4QXJyYXk+IHtcbiAgICBjb25zdCBrZXlGcm9tQ3VzdG9taXNhdGlvbnMgPSBTZWN1cml0eUN1c3RvbWlzYXRpb25zLmdldFNlY3JldFN0b3JhZ2VLZXk/LigpO1xuICAgIGlmIChrZXlGcm9tQ3VzdG9taXNhdGlvbnMpIHtcbiAgICAgICAgbG9nZ2VyLmxvZyhcIlVzaW5nIGtleSBmcm9tIHNlY3VyaXR5IGN1c3RvbWlzYXRpb25zIChkZWh5ZHJhdGlvbilcIik7XG4gICAgICAgIHJldHVybiBrZXlGcm9tQ3VzdG9taXNhdGlvbnM7XG4gICAgfVxuXG4gICAgY29uc3QgaW5wdXRUb0tleSA9IG1ha2VJbnB1dFRvS2V5KGtleUluZm8pO1xuICAgIGNvbnN0IHsgZmluaXNoZWQgfSA9IE1vZGFsLmNyZWF0ZURpYWxvZyhcbiAgICAgICAgQWNjZXNzU2VjcmV0U3RvcmFnZURpYWxvZyxcbiAgICAgICAgLyogcHJvcHM9ICovXG4gICAgICAgIHtcbiAgICAgICAgICAgIGtleUluZm8sXG4gICAgICAgICAgICBjaGVja1ByaXZhdGVLZXk6IGFzeW5jIChpbnB1dDogS2V5UGFyYW1zKTogUHJvbWlzZTxib29sZWFuPiA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qga2V5ID0gYXdhaXQgaW5wdXRUb0tleShpbnB1dCk7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY2hlY2tGdW5jKGtleSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIC8qIGNsYXNzTmFtZT0gKi8gdW5kZWZpbmVkLFxuICAgICAgICAvKiBpc1ByaW9yaXR5TW9kYWw9ICovIGZhbHNlLFxuICAgICAgICAvKiBpc1N0YXRpY01vZGFsPSAqLyBmYWxzZSxcbiAgICAgICAgLyogb3B0aW9ucz0gKi8ge1xuICAgICAgICAgICAgb25CZWZvcmVDbG9zZTogYXN5bmMgKHJlYXNvbik6IFByb21pc2U8Ym9vbGVhbj4gPT4ge1xuICAgICAgICAgICAgICAgIGlmIChyZWFzb24gPT09IFwiYmFja2dyb3VuZENsaWNrXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvbmZpcm1Ub0Rpc21pc3MoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICk7XG4gICAgY29uc3QgW2lucHV0XSA9IGF3YWl0IGZpbmlzaGVkO1xuICAgIGlmICghaW5wdXQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEFjY2Vzc0NhbmNlbGxlZEVycm9yKCk7XG4gICAgfVxuICAgIGNvbnN0IGtleSA9IGF3YWl0IGlucHV0VG9LZXkoaW5wdXQpO1xuXG4gICAgLy8gbmVlZCB0byBjb3B5IHRoZSBrZXkgYmVjYXVzZSByZWh5ZHJhdGlvbiAodW5waWNrbGluZykgd2lsbCBjbG9iYmVyIGl0XG4gICAgZGVoeWRyYXRpb25DYWNoZSA9IHsga2V5OiBuZXcgVWludDhBcnJheShrZXkpLCBrZXlJbmZvIH07XG5cbiAgICByZXR1cm4ga2V5O1xufVxuXG5mdW5jdGlvbiBjYWNoZVNlY3JldFN0b3JhZ2VLZXkoa2V5SWQ6IHN0cmluZywga2V5SW5mbzogSVNlY3JldFN0b3JhZ2VLZXlJbmZvLCBrZXk6IFVpbnQ4QXJyYXkpOiB2b2lkIHtcbiAgICBpZiAoaXNDYWNoaW5nQWxsb3dlZCgpKSB7XG4gICAgICAgIHNlY3JldFN0b3JhZ2VLZXlzW2tleUlkXSA9IGtleTtcbiAgICAgICAgc2VjcmV0U3RvcmFnZUtleUluZm9ba2V5SWRdID0ga2V5SW5mbztcbiAgICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIG9uU2VjcmV0UmVxdWVzdGVkKFxuICAgIHVzZXJJZDogc3RyaW5nLFxuICAgIGRldmljZUlkOiBzdHJpbmcsXG4gICAgcmVxdWVzdElkOiBzdHJpbmcsXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIGRldmljZVRydXN0OiBEZXZpY2VUcnVzdExldmVsLFxuKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcbiAgICBsb2dnZXIubG9nKFwib25TZWNyZXRSZXF1ZXN0ZWRcIiwgdXNlcklkLCBkZXZpY2VJZCwgcmVxdWVzdElkLCBuYW1lLCBkZXZpY2VUcnVzdCk7XG4gICAgY29uc3QgY2xpZW50ID0gTWF0cml4Q2xpZW50UGVnLmdldCgpO1xuICAgIGlmICh1c2VySWQgIT09IGNsaWVudC5nZXRVc2VySWQoKSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICghZGV2aWNlVHJ1c3Q/LmlzVmVyaWZpZWQoKSkge1xuICAgICAgICBsb2dnZXIubG9nKGBJZ25vcmluZyBzZWNyZXQgcmVxdWVzdCBmcm9tIHVudHJ1c3RlZCBkZXZpY2UgJHtkZXZpY2VJZH1gKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoXG4gICAgICAgIG5hbWUgPT09IFwibS5jcm9zc19zaWduaW5nLm1hc3RlclwiIHx8XG4gICAgICAgIG5hbWUgPT09IFwibS5jcm9zc19zaWduaW5nLnNlbGZfc2lnbmluZ1wiIHx8XG4gICAgICAgIG5hbWUgPT09IFwibS5jcm9zc19zaWduaW5nLnVzZXJfc2lnbmluZ1wiXG4gICAgKSB7XG4gICAgICAgIGNvbnN0IGNhbGxiYWNrcyA9IGNsaWVudC5nZXRDcm9zc1NpZ25pbmdDYWNoZUNhbGxiYWNrcygpO1xuICAgICAgICBpZiAoIWNhbGxiYWNrcz8uZ2V0Q3Jvc3NTaWduaW5nS2V5Q2FjaGUpIHJldHVybjtcbiAgICAgICAgY29uc3Qga2V5SWQgPSBuYW1lLnJlcGxhY2UoXCJtLmNyb3NzX3NpZ25pbmcuXCIsIFwiXCIpO1xuICAgICAgICBjb25zdCBrZXkgPSBhd2FpdCBjYWxsYmFja3MuZ2V0Q3Jvc3NTaWduaW5nS2V5Q2FjaGUoa2V5SWQpO1xuICAgICAgICBpZiAoIWtleSkge1xuICAgICAgICAgICAgbG9nZ2VyLmxvZyhgJHtrZXlJZH0gcmVxdWVzdGVkIGJ5ICR7ZGV2aWNlSWR9LCBidXQgbm90IGZvdW5kIGluIGNhY2hlYCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGtleSA/IGVuY29kZUJhc2U2NChrZXkpIDogdW5kZWZpbmVkO1xuICAgIH0gZWxzZSBpZiAobmFtZSA9PT0gXCJtLm1lZ29sbV9iYWNrdXAudjFcIikge1xuICAgICAgICBjb25zdCBrZXkgPSBhd2FpdCBjbGllbnQuY3J5cHRvPy5nZXRTZXNzaW9uQmFja3VwUHJpdmF0ZUtleSgpO1xuICAgICAgICBpZiAoIWtleSkge1xuICAgICAgICAgICAgbG9nZ2VyLmxvZyhgc2Vzc2lvbiBiYWNrdXAga2V5IHJlcXVlc3RlZCBieSAke2RldmljZUlkfSwgYnV0IG5vdCBmb3VuZCBpbiBjYWNoZWApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBrZXkgPyBlbmNvZGVCYXNlNjQoa2V5KSA6IHVuZGVmaW5lZDtcbiAgICB9XG4gICAgbG9nZ2VyLndhcm4oXCJvblNlY3JldFJlcXVlc3RlZCBkaWRuJ3QgcmVjb2duaXNlIHRoZSBzZWNyZXQgbmFtZWQgXCIsIG5hbWUpO1xufVxuXG5leHBvcnQgY29uc3QgY3Jvc3NTaWduaW5nQ2FsbGJhY2tzOiBJQ3J5cHRvQ2FsbGJhY2tzID0ge1xuICAgIGdldFNlY3JldFN0b3JhZ2VLZXksXG4gICAgY2FjaGVTZWNyZXRTdG9yYWdlS2V5LFxuICAgIG9uU2VjcmV0UmVxdWVzdGVkLFxuICAgIGdldERlaHlkcmF0aW9uS2V5LFxufTtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHByb21wdEZvckJhY2t1cFBhc3NwaHJhc2UoKTogUHJvbWlzZTxVaW50OEFycmF5PiB7XG4gICAgbGV0IGtleSE6IFVpbnQ4QXJyYXk7XG5cbiAgICBjb25zdCB7IGZpbmlzaGVkIH0gPSBNb2RhbC5jcmVhdGVEaWFsb2coXG4gICAgICAgIFJlc3RvcmVLZXlCYWNrdXBEaWFsb2csXG4gICAgICAgIHtcbiAgICAgICAgICAgIHNob3dTdW1tYXJ5OiBmYWxzZSxcbiAgICAgICAgICAgIGtleUNhbGxiYWNrOiAoazogVWludDhBcnJheSkgPT4gKGtleSA9IGspLFxuICAgICAgICB9LFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgIC8qIHByaW9yaXR5ID0gKi8gZmFsc2UsXG4gICAgICAgIC8qIHN0YXRpYyA9ICovIHRydWUsXG4gICAgKTtcblxuICAgIGNvbnN0IHN1Y2Nlc3MgPSBhd2FpdCBmaW5pc2hlZDtcbiAgICBpZiAoIXN1Y2Nlc3MpIHRocm93IG5ldyBFcnJvcihcIktleSBiYWNrdXAgcHJvbXB0IGNhbmNlbGxlZFwiKTtcblxuICAgIHJldHVybiBrZXk7XG59XG5cbi8qKlxuICogVGhpcyBoZWxwZXIgc2hvdWxkIGJlIHVzZWQgd2hlbmV2ZXIgeW91IG5lZWQgdG8gYWNjZXNzIHNlY3JldCBzdG9yYWdlLiBJdFxuICogZW5zdXJlcyB0aGF0IHNlY3JldCBzdG9yYWdlIChhbmQgYWxzbyBjcm9zcy1zaWduaW5nIHNpbmNlIHRoZXkgZWFjaCBkZXBlbmQgb25cbiAqIGVhY2ggb3RoZXIgaW4gYSBjeWNsZSBvZiBzb3J0cykgaGF2ZSBiZWVuIGJvb3RzdHJhcHBlZCBiZWZvcmUgcnVubmluZyB0aGVcbiAqIHByb3ZpZGVkIGZ1bmN0aW9uLlxuICpcbiAqIEJvb3RzdHJhcHBpbmcgc2VjcmV0IHN0b3JhZ2UgbWF5IHRha2Ugb25lIG9mIHRoZXNlIHBhdGhzOlxuICogMS4gQ3JlYXRlIHNlY3JldCBzdG9yYWdlIGZyb20gYSBwYXNzcGhyYXNlIGFuZCBzdG9yZSBjcm9zcy1zaWduaW5nIGtleXNcbiAqICAgIGluIHNlY3JldCBzdG9yYWdlLlxuICogMi4gQWNjZXNzIGV4aXN0aW5nIHNlY3JldCBzdG9yYWdlIGJ5IHJlcXVlc3RpbmcgcGFzc3BocmFzZSBhbmQgYWNjZXNzaW5nXG4gKiAgICBjcm9zcy1zaWduaW5nIGtleXMgYXMgbmVlZGVkLlxuICogMy4gQWxsIGtleXMgYXJlIGxvYWRlZCBhbmQgdGhlcmUncyBub3RoaW5nIHRvIGRvLlxuICpcbiAqIEFkZGl0aW9uYWxseSwgdGhlIHNlY3JldCBzdG9yYWdlIGtleXMgYXJlIGNhY2hlZCBkdXJpbmcgdGhlIHNjb3BlIG9mIHRoaXMgZnVuY3Rpb25cbiAqIHRvIGVuc3VyZSB0aGUgdXNlciBpcyBwcm9tcHRlZCBvbmx5IG9uY2UgZm9yIHRoZWlyIHNlY3JldCBzdG9yYWdlXG4gKiBwYXNzcGhyYXNlLiBUaGUgY2FjaGUgaXMgdGhlbiBjbGVhcmVkIG9uY2UgdGhlIHByb3ZpZGVkIGZ1bmN0aW9uIGNvbXBsZXRlcy5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbZnVuY10gQW4gb3BlcmF0aW9uIHRvIHBlcmZvcm0gb25jZSBzZWNyZXQgc3RvcmFnZSBoYXMgYmVlblxuICogYm9vdHN0cmFwcGVkLiBPcHRpb25hbC5cbiAqIEBwYXJhbSB7Ym9vbH0gW2ZvcmNlUmVzZXRdIFJlc2V0IHNlY3JldCBzdG9yYWdlIGV2ZW4gaWYgaXQncyBhbHJlYWR5IHNldCB1cFxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYWNjZXNzU2VjcmV0U3RvcmFnZShmdW5jID0gYXN5bmMgKCk6IFByb21pc2U8dm9pZD4gPT4ge30sIGZvcmNlUmVzZXQgPSBmYWxzZSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGNsaSA9IE1hdHJpeENsaWVudFBlZy5nZXQoKTtcbiAgICBzZWNyZXRTdG9yYWdlQmVpbmdBY2Nlc3NlZCA9IHRydWU7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKCEoYXdhaXQgY2xpLmhhc1NlY3JldFN0b3JhZ2VLZXkoKSkgfHwgZm9yY2VSZXNldCkge1xuICAgICAgICAgICAgLy8gVGhpcyBkaWFsb2cgY2FsbHMgYm9vdHN0cmFwIGl0c2VsZiBhZnRlciBndWlkaW5nIHRoZSB1c2VyIHRocm91Z2hcbiAgICAgICAgICAgIC8vIHBhc3NwaHJhc2UgY3JlYXRpb24uXG4gICAgICAgICAgICBjb25zdCB7IGZpbmlzaGVkIH0gPSBNb2RhbC5jcmVhdGVEaWFsb2dBc3luYyhcbiAgICAgICAgICAgICAgICBpbXBvcnQoXCIuL2FzeW5jLWNvbXBvbmVudHMvdmlld3MvZGlhbG9ncy9zZWN1cml0eS9DcmVhdGVTZWNyZXRTdG9yYWdlRGlhbG9nXCIpIGFzIHVua25vd24gYXMgUHJvbWlzZTxcbiAgICAgICAgICAgICAgICAgICAgdHlwZW9mIENyZWF0ZVNlY3JldFN0b3JhZ2VEaWFsb2dcbiAgICAgICAgICAgICAgICA+LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yY2VSZXNldCxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAvKiBwcmlvcml0eSA9ICovIGZhbHNlLFxuICAgICAgICAgICAgICAgIC8qIHN0YXRpYyA9ICovIHRydWUsXG4gICAgICAgICAgICAgICAgLyogb3B0aW9ucyA9ICovIHtcbiAgICAgICAgICAgICAgICAgICAgb25CZWZvcmVDbG9zZTogYXN5bmMgKHJlYXNvbik6IFByb21pc2U8Ym9vbGVhbj4gPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgU2VjdXJlIEJhY2t1cCBpcyByZXF1aXJlZCwgeW91IGNhbm5vdCBsZWF2ZSB0aGUgbW9kYWwuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVhc29uID09PSBcImJhY2tncm91bmRDbGlja1wiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICFpc1NlY3VyZUJhY2t1cFJlcXVpcmVkKGNsaSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGNvbnN0IFtjb25maXJtZWRdID0gYXdhaXQgZmluaXNoZWQ7XG4gICAgICAgICAgICBpZiAoIWNvbmZpcm1lZCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlNlY3JldCBzdG9yYWdlIGNyZWF0aW9uIGNhbmNlbGVkXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXdhaXQgY2xpLmJvb3RzdHJhcENyb3NzU2lnbmluZyh7XG4gICAgICAgICAgICAgICAgYXV0aFVwbG9hZERldmljZVNpZ25pbmdLZXlzOiBhc3luYyAobWFrZVJlcXVlc3QpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBmaW5pc2hlZCB9ID0gTW9kYWwuY3JlYXRlRGlhbG9nKEludGVyYWN0aXZlQXV0aERpYWxvZywge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6IF90KFwiU2V0dGluZyB1cCBrZXlzXCIpLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWF0cml4Q2xpZW50OiBjbGksXG4gICAgICAgICAgICAgICAgICAgICAgICBtYWtlUmVxdWVzdCxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IFtjb25maXJtZWRdID0gYXdhaXQgZmluaXNoZWQ7XG4gICAgICAgICAgICAgICAgICAgIGlmICghY29uZmlybWVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDcm9zcy1zaWduaW5nIGtleSB1cGxvYWQgYXV0aCBjYW5jZWxlZFwiKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGF3YWl0IGNsaS5ib290c3RyYXBTZWNyZXRTdG9yYWdlKHtcbiAgICAgICAgICAgICAgICBnZXRLZXlCYWNrdXBQYXNzcGhyYXNlOiBwcm9tcHRGb3JCYWNrdXBQYXNzcGhyYXNlLFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGtleUlkID0gT2JqZWN0LmtleXMoc2VjcmV0U3RvcmFnZUtleXMpWzBdO1xuICAgICAgICAgICAgaWYgKGtleUlkICYmIFNldHRpbmdzU3RvcmUuZ2V0VmFsdWUoXCJmZWF0dXJlX2RlaHlkcmF0aW9uXCIpKSB7XG4gICAgICAgICAgICAgICAgbGV0IGRlaHlkcmF0aW9uS2V5SW5mbyA9IHt9O1xuICAgICAgICAgICAgICAgIGlmIChzZWNyZXRTdG9yYWdlS2V5SW5mb1trZXlJZF0gJiYgc2VjcmV0U3RvcmFnZUtleUluZm9ba2V5SWRdLnBhc3NwaHJhc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVoeWRyYXRpb25LZXlJbmZvID0geyBwYXNzcGhyYXNlOiBzZWNyZXRTdG9yYWdlS2V5SW5mb1trZXlJZF0ucGFzc3BocmFzZSB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBsb2dnZXIubG9nKFwiU2V0dGluZyBkZWh5ZHJhdGlvbiBrZXlcIik7XG4gICAgICAgICAgICAgICAgYXdhaXQgY2xpLnNldERlaHlkcmF0aW9uS2V5KHNlY3JldFN0b3JhZ2VLZXlzW2tleUlkXSwgZGVoeWRyYXRpb25LZXlJbmZvLCBcIkJhY2t1cCBkZXZpY2VcIik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCFrZXlJZCkge1xuICAgICAgICAgICAgICAgIGxvZ2dlci53YXJuKFwiTm90IHNldHRpbmcgZGVoeWRyYXRpb24ga2V5OiBubyBTU1NTIGtleSBmb3VuZFwiKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhcIk5vdCBzZXR0aW5nIGRlaHlkcmF0aW9uIGtleTogZmVhdHVyZSBkaXNhYmxlZFwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGByZXR1cm4gYXdhaXRgIG5lZWRlZCBoZXJlIHRvIGVuc3VyZSBgZmluYWxseWAgYmxvY2sgcnVucyBhZnRlciB0aGVcbiAgICAgICAgLy8gaW5uZXIgb3BlcmF0aW9uIGNvbXBsZXRlcy5cbiAgICAgICAgcmV0dXJuIGF3YWl0IGZ1bmMoKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIFNlY3VyaXR5Q3VzdG9taXNhdGlvbnMuY2F0Y2hBY2Nlc3NTZWNyZXRTdG9yYWdlRXJyb3I/LihlKTtcbiAgICAgICAgbG9nZ2VyLmVycm9yKGUpO1xuICAgICAgICAvLyBSZS10aHJvdyBzbyB0aGF0IGhpZ2hlciBsZXZlbCBsb2dpYyBjYW4gYWJvcnQgYXMgbmVlZGVkXG4gICAgICAgIHRocm93IGU7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgICAgLy8gQ2xlYXIgc2VjcmV0IHN0b3JhZ2Uga2V5IGNhY2hlIG5vdyB0aGF0IHdvcmsgaXMgY29tcGxldGVcbiAgICAgICAgc2VjcmV0U3RvcmFnZUJlaW5nQWNjZXNzZWQgPSBmYWxzZTtcbiAgICAgICAgaWYgKCFpc0NhY2hpbmdBbGxvd2VkKCkpIHtcbiAgICAgICAgICAgIHNlY3JldFN0b3JhZ2VLZXlzID0ge307XG4gICAgICAgICAgICBzZWNyZXRTdG9yYWdlS2V5SW5mbyA9IHt9O1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vLyBGSVhNRTogdGhpcyBmdW5jdGlvbiBuYW1lIGlzIGEgYml0IG9mIGEgbW91dGhmdWxcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB0cnlUb1VubG9ja1NlY3JldFN0b3JhZ2VXaXRoRGVoeWRyYXRpb25LZXkoY2xpZW50OiBNYXRyaXhDbGllbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBrZXkgPSBkZWh5ZHJhdGlvbkNhY2hlLmtleTtcbiAgICBsZXQgcmVzdG9yaW5nQmFja3VwID0gZmFsc2U7XG4gICAgaWYgKGtleSAmJiAoYXdhaXQgY2xpZW50LmlzU2VjcmV0U3RvcmFnZVJlYWR5KCkpKSB7XG4gICAgICAgIGxvZ2dlci5sb2coXCJUcnlpbmcgdG8gc2V0IHVwIGNyb3NzLXNpZ25pbmcgdXNpbmcgZGVoeWRyYXRpb24ga2V5XCIpO1xuICAgICAgICBzZWNyZXRTdG9yYWdlQmVpbmdBY2Nlc3NlZCA9IHRydWU7XG4gICAgICAgIG5vbkludGVyYWN0aXZlID0gdHJ1ZTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IGNsaWVudC5jaGVja093bkNyb3NzU2lnbmluZ1RydXN0KCk7XG5cbiAgICAgICAgICAgIC8vIHdlIGFsc28gbmVlZCB0byBzZXQgYSBuZXcgZGVoeWRyYXRlZCBkZXZpY2UgdG8gcmVwbGFjZSB0aGVcbiAgICAgICAgICAgIC8vIGRldmljZSB3ZSByZWh5ZHJhdGVkXG4gICAgICAgICAgICBsZXQgZGVoeWRyYXRpb25LZXlJbmZvID0ge307XG4gICAgICAgICAgICBpZiAoZGVoeWRyYXRpb25DYWNoZS5rZXlJbmZvICYmIGRlaHlkcmF0aW9uQ2FjaGUua2V5SW5mby5wYXNzcGhyYXNlKSB7XG4gICAgICAgICAgICAgICAgZGVoeWRyYXRpb25LZXlJbmZvID0geyBwYXNzcGhyYXNlOiBkZWh5ZHJhdGlvbkNhY2hlLmtleUluZm8ucGFzc3BocmFzZSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYXdhaXQgY2xpZW50LnNldERlaHlkcmF0aW9uS2V5KGtleSwgZGVoeWRyYXRpb25LZXlJbmZvLCBcIkJhY2t1cCBkZXZpY2VcIik7XG5cbiAgICAgICAgICAgIC8vIGFuZCByZXN0b3JlIGZyb20gYmFja3VwXG4gICAgICAgICAgICBjb25zdCBiYWNrdXBJbmZvID0gYXdhaXQgY2xpZW50LmdldEtleUJhY2t1cFZlcnNpb24oKTtcbiAgICAgICAgICAgIGlmIChiYWNrdXBJbmZvKSB7XG4gICAgICAgICAgICAgICAgcmVzdG9yaW5nQmFja3VwID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAvLyBkb24ndCBhd2FpdCwgYmVjYXVzZSB0aGlzIGNhbiB0YWtlIGEgbG9uZyB0aW1lXG4gICAgICAgICAgICAgICAgY2xpZW50LnJlc3RvcmVLZXlCYWNrdXBXaXRoU2VjcmV0U3RvcmFnZShiYWNrdXBJbmZvKS5maW5hbGx5KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgc2VjcmV0U3RvcmFnZUJlaW5nQWNjZXNzZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgbm9uSW50ZXJhY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFpc0NhY2hpbmdBbGxvd2VkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlY3JldFN0b3JhZ2VLZXlzID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWNyZXRTdG9yYWdlS2V5SW5mbyA9IHt9O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICBkZWh5ZHJhdGlvbkNhY2hlID0ge307XG4gICAgICAgICAgICAvLyB0aGUgc2VjcmV0IHN0b3JhZ2UgY2FjaGUgaXMgbmVlZGVkIGZvciByZXN0b3JpbmcgZnJvbSBiYWNrdXAsIHNvXG4gICAgICAgICAgICAvLyBkb24ndCBjbGVhciBpdCB5ZXQgaWYgd2UncmUgcmVzdG9yaW5nIGZyb20gYmFja3VwXG4gICAgICAgICAgICBpZiAoIXJlc3RvcmluZ0JhY2t1cCkge1xuICAgICAgICAgICAgICAgIHNlY3JldFN0b3JhZ2VCZWluZ0FjY2Vzc2VkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgbm9uSW50ZXJhY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBpZiAoIWlzQ2FjaGluZ0FsbG93ZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICBzZWNyZXRTdG9yYWdlS2V5cyA9IHt9O1xuICAgICAgICAgICAgICAgICAgICBzZWNyZXRTdG9yYWdlS2V5SW5mbyA9IHt9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztBQW1CQSxJQUFBQSxlQUFBLEdBQUFDLE9BQUE7QUFDQSxJQUFBQyxZQUFBLEdBQUFELE9BQUE7QUFDQSxJQUFBRSxPQUFBLEdBQUFGLE9BQUE7QUFFQSxJQUFBRyxPQUFBLEdBQUFILE9BQUE7QUFHQSxJQUFBSSxNQUFBLEdBQUFDLHNCQUFBLENBQUFMLE9BQUE7QUFDQSxJQUFBTSxnQkFBQSxHQUFBTixPQUFBO0FBQ0EsSUFBQU8sZ0JBQUEsR0FBQVAsT0FBQTtBQUNBLElBQUFRLGVB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