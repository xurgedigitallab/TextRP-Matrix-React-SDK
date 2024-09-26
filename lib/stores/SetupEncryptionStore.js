"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SetupEncryptionStore = exports.Phase = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _events = _interopRequireDefault(require("events"));
var _VerificationRequest = require("matrix-js-sdk/src/crypto/verification/request/VerificationRequest");
var _logger = require("matrix-js-sdk/src/logger");
var _crypto = require("matrix-js-sdk/src/crypto");
var _MatrixClientPeg = require("../MatrixClientPeg");
var _SecurityManager = require("../SecurityManager");
var _Modal = _interopRequireDefault(require("../Modal"));
var _InteractiveAuthDialog = _interopRequireDefault(require("../components/views/dialogs/InteractiveAuthDialog"));
var _languageHandler = require("../languageHandler");
var _SDKContext = require("../contexts/SDKContext");
var _arrays = require("../utils/arrays");
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
let Phase = /*#__PURE__*/function (Phase) {
  Phase[Phase["Loading"] = 0] = "Loading";
  Phase[Phase["Intro"] = 1] = "Intro";
  Phase[Phase["Busy"] = 2] = "Busy";
  Phase[Phase["Done"] = 3] = "Done";
  Phase[Phase["ConfirmSkip"] = 4] = "ConfirmSkip";
  Phase[Phase["Finished"] = 5] = "Finished";
  Phase[Phase["ConfirmReset"] = 6] = "ConfirmReset";
  return Phase;
}({});
exports.Phase = Phase;
class SetupEncryptionStore extends _events.default {
  constructor() {
    super(...arguments);
    (0, _defineProperty2.default)(this, "started", void 0);
    (0, _defineProperty2.default)(this, "phase", void 0);
    (0, _defineProperty2.default)(this, "verificationRequest", null);
    (0, _defineProperty2.default)(this, "backupInfo", null);
    // ID of the key that the secrets we want are encrypted with
    (0, _defineProperty2.default)(this, "keyId", null);
    // Descriptor of the key that the secrets we want are encrypted with
    (0, _defineProperty2.default)(this, "keyInfo", null);
    (0, _defineProperty2.default)(this, "hasDevicesToVerifyAgainst", void 0);
    (0, _defineProperty2.default)(this, "onUserTrustStatusChanged", async userId => {
      if (userId !== _MatrixClientPeg.MatrixClientPeg.get().getUserId()) return;
      const publicKeysTrusted = await _MatrixClientPeg.MatrixClientPeg.get().getCrypto()?.getCrossSigningKeyId();
      if (publicKeysTrusted) {
        this.phase = Phase.Done;
        this.emit("update");
      }
    });
    (0, _defineProperty2.default)(this, "onVerificationRequest", request => {
      this.setActiveVerificationRequest(request);
    });
    (0, _defineProperty2.default)(this, "onVerificationRequestChange", async () => {
      if (this.verificationRequest?.phase === _VerificationRequest.Phase.Cancelled) {
        this.verificationRequest.off(_VerificationRequest.VerificationRequestEvent.Change, this.onVerificationRequestChange);
        this.verificationRequest = null;
        this.emit("update");
      } else if (this.verificationRequest?.phase === _VerificationRequest.PHASE_DONE) {
        this.verificationRequest.off(_VerificationRequest.VerificationRequestEvent.Change, this.onVerificationRequestChange);
        this.verificationRequest = null;
        // At this point, the verification has finished, we just need to wait for
        // cross signing to be ready to use, so wait for the user trust status to
        // change (or change to DONE if it's already ready).
        const publicKeysTrusted = await _MatrixClientPeg.MatrixClientPeg.get().getCrypto()?.getCrossSigningKeyId();
        this.phase = publicKeysTrusted ? Phase.Done : Phase.Busy;
        this.emit("update");
      }
    });
  }
  static sharedInstance() {
    if (!window.mxSetupEncryptionStore) window.mxSetupEncryptionStore = new SetupEncryptionStore();
    return window.mxSetupEncryptionStore;
  }
  start() {
    if (this.started) {
      return;
    }
    this.started = true;
    this.phase = Phase.Loading;
    const cli = _MatrixClientPeg.MatrixClientPeg.get();
    cli.on(_crypto.CryptoEvent.VerificationRequest, this.onVerificationRequest);
    cli.on(_crypto.CryptoEvent.UserTrustStatusChanged, this.onUserTrustStatusChanged);
    const requestsInProgress = cli.getVerificationRequestsToDeviceInProgress(cli.getUserId());
    if (requestsInProgress.length) {
      // If there are multiple, we take the most recent. Equally if the user sends another request from
      // another device after this screen has been shown, we'll switch to the new one, so this
      // generally doesn't support multiple requests.
      this.setActiveVerificationRequest(requestsInProgress[requestsInProgress.length - 1]);
    }
    this.fetchKeyInfo();
  }
  stop() {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.verificationRequest?.off(_VerificationRequest.VerificationRequestEvent.Change, this.onVerificationRequestChange);
    if (_MatrixClientPeg.MatrixClientPeg.get()) {
      _MatrixClientPeg.MatrixClientPeg.get().removeListener(_crypto.CryptoEvent.VerificationRequest, this.onVerificationRequest);
      _MatrixClientPeg.MatrixClientPeg.get().removeListener(_crypto.CryptoEvent.UserTrustStatusChanged, this.onUserTrustStatusChanged);
    }
  }
  async fetchKeyInfo() {
    if (!this.started) return; // bail if we were stopped
    const cli = _MatrixClientPeg.MatrixClientPeg.get();
    const keys = await cli.isSecretStored("m.cross_signing.master");
    if (keys === null || Object.keys(keys).length === 0) {
      this.keyId = null;
      this.keyInfo = null;
    } else {
      // If the secret is stored under more than one key, we just pick an arbitrary one
      this.keyId = Object.keys(keys)[0];
      this.keyInfo = keys[this.keyId];
    }

    // do we have any other verified devices which are E2EE which we can verify against?
    const dehydratedDevice = await cli.getDehydratedDevice();
    const ownUserId = cli.getUserId();
    this.hasDevicesToVerifyAgainst = await (0, _arrays.asyncSome)(cli.getStoredDevicesForUser(ownUserId), async device => {
      if (!device.getIdentityKey() || dehydratedDevice && device.deviceId == dehydratedDevice?.device_id) {
        return false;
      }
      const verificationStatus = await cli.getCrypto()?.getDeviceVerificationStatus(ownUserId, device.deviceId);
      return !!verificationStatus?.signedByOwner;
    });
    this.phase = Phase.Intro;
    this.emit("update");
  }
  async usePassPhrase() {
    this.phase = Phase.Busy;
    this.emit("update");
    const cli = _MatrixClientPeg.MatrixClientPeg.get();
    try {
      const backupInfo = await cli.getKeyBackupVersion();
      this.backupInfo = backupInfo;
      this.emit("update");
      // The control flow is fairly twisted here...
      // For the purposes of completing security, we only wait on getting
      // as far as the trust check and then show a green shield.
      // We also begin the key backup restore as well, which we're
      // awaiting inside `accessSecretStorage` only so that it keeps your
      // passphase cached for that work. This dialog itself will only wait
      // on the first trust check, and the key backup restore will happen
      // in the background.
      await new Promise((resolve, reject) => {
        (0, _SecurityManager.accessSecretStorage)(async () => {
          await cli.checkOwnCrossSigningTrust();
          resolve();
          if (backupInfo) {
            // A complete restore can take many minutes for large
            // accounts / slow servers, so we allow the dialog
            // to advance before this.
            await cli.restoreKeyBackupWithSecretStorage(backupInfo);
          }
        }).catch(reject);
      });
      if (await cli.getCrypto()?.getCrossSigningKeyId()) {
        this.phase = Phase.Done;
        this.emit("update");
      }
    } catch (e) {
      if (!(e instanceof _SecurityManager.AccessCancelledError)) {
        _logger.logger.log(e);
      }
      // this will throw if the user hits cancel, so ignore
      this.phase = Phase.Intro;
      this.emit("update");
    }
  }
  skip() {
    this.phase = Phase.ConfirmSkip;
    this.emit("update");
  }
  skipConfirm() {
    this.phase = Phase.Finished;
    this.emit("update");
  }
  returnAfterSkip() {
    this.phase = Phase.Intro;
    this.emit("update");
  }
  reset() {
    this.phase = Phase.ConfirmReset;
    this.emit("update");
  }
  async resetConfirm() {
    try {
      // If we've gotten here, the user presumably lost their
      // secret storage key if they had one. Start by resetting
      // secret storage and setting up a new recovery key, then
      // create new cross-signing keys once that succeeds.
      await (0, _SecurityManager.accessSecretStorage)(async () => {
        const cli = _MatrixClientPeg.MatrixClientPeg.get();
        await cli.bootstrapCrossSigning({
          authUploadDeviceSigningKeys: async makeRequest => {
            const cachedPassword = _SDKContext.SdkContextClass.instance.accountPasswordStore.getPassword();
            if (cachedPassword) {
              await makeRequest({
                type: "m.login.password",
                identifier: {
                  type: "m.id.user",
                  user: cli.getUserId()
                },
                user: cli.getUserId(),
                password: cachedPassword
              });
              return;
            }
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
          },
          setupNewCrossSigning: true
        });
        this.phase = Phase.Finished;
      }, true);
    } catch (e) {
      _logger.logger.error("Error resetting cross-signing", e);
      this.phase = Phase.Intro;
    }
    this.emit("update");
  }
  returnAfterReset() {
    this.phase = Phase.Intro;
    this.emit("update");
  }
  done() {
    this.phase = Phase.Finished;
    this.emit("update");
    // async - ask other clients for keys, if necessary
    _MatrixClientPeg.MatrixClientPeg.get().crypto?.cancelAndResendAllOutgoingKeyRequests();
  }
  async setActiveVerificationRequest(request) {
    if (!this.started) return; // bail if we were stopped
    if (request.otherUserId !== _MatrixClientPeg.MatrixClientPeg.get().getUserId()) return;
    if (this.verificationRequest) {
      this.verificationRequest.off(_VerificationRequest.VerificationRequestEvent.Change, this.onVerificationRequestChange);
    }
    this.verificationRequest = request;
    await request.accept();
    request.on(_VerificationRequest.VerificationRequestEvent.Change, this.onVerificationRequestChange);
    this.emit("update");
  }
  lostKeys() {
    return !this.hasDevicesToVerifyAgainst && !this.keyInfo;
  }
}
exports.SetupEncryptionStore = SetupEncryptionStore;
//# sourceMappingURL=SetupEncryptionStore.js.map