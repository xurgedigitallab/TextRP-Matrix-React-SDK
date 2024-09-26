"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.legacyVerifyUser = legacyVerifyUser;
exports.pendingVerificationRequestForUser = pendingVerificationRequestForUser;
exports.verifyDevice = verifyDevice;
exports.verifyUser = verifyUser;
var _crypto = require("matrix-js-sdk/src/crypto");
var _cryptoApi = require("matrix-js-sdk/src/crypto-api");
var _dispatcher = _interopRequireDefault(require("./dispatcher/dispatcher"));
var _Modal = _interopRequireDefault(require("./Modal"));
var _RightPanelStorePhases = require("./stores/right-panel/RightPanelStorePhases");
var _SecurityManager = require("./SecurityManager");
var _UntrustedDeviceDialog = _interopRequireDefault(require("./components/views/dialogs/UntrustedDeviceDialog"));
var _ManualDeviceKeyVerificationDialog = require("./components/views/dialogs/ManualDeviceKeyVerificationDialog");
var _RightPanelStore = _interopRequireDefault(require("./stores/right-panel/RightPanelStore"));
var _findDMForUser = require("./utils/dm/findDMForUser");
/*
Copyright 2019, 2020, 2021 The Matrix.org Foundation C.I.C.

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

async function enable4SIfNeeded(matrixClient) {
  const crypto = matrixClient.getCrypto();
  if (!crypto) return false;
  const usk = await crypto.getCrossSigningKeyId(_cryptoApi.CrossSigningKey.UserSigning);
  if (!usk) {
    await (0, _SecurityManager.accessSecretStorage)();
    return false;
  }
  return true;
}
async function verifyDevice(matrixClient, user, device) {
  if (matrixClient.isGuest()) {
    _dispatcher.default.dispatch({
      action: "require_registration"
    });
    return;
  }
  // if cross-signing is not explicitly disabled, check if it should be enabled first.
  if (matrixClient.getCryptoTrustCrossSignedDevices()) {
    if (!(await enable4SIfNeeded(matrixClient))) {
      return;
    }
  }
  _Modal.default.createDialog(_UntrustedDeviceDialog.default, {
    user,
    device,
    onFinished: async action => {
      if (action === "sas") {
        const verificationRequestPromise = matrixClient.legacyDeviceVerification(user.userId, device.deviceId, _crypto.verificationMethods.SAS);
        setRightPanel({
          member: user,
          verificationRequestPromise
        });
      } else if (action === "legacy") {
        _Modal.default.createDialog(_ManualDeviceKeyVerificationDialog.ManualDeviceKeyVerificationDialog, {
          userId: user.userId,
          device
        });
      }
    }
  });
}
async function legacyVerifyUser(matrixClient, user) {
  if (matrixClient.isGuest()) {
    _dispatcher.default.dispatch({
      action: "require_registration"
    });
    return;
  }
  // if cross-signing is not explicitly disabled, check if it should be enabled first.
  if (matrixClient.getCryptoTrustCrossSignedDevices()) {
    if (!(await enable4SIfNeeded(matrixClient))) {
      return;
    }
  }
  const verificationRequestPromise = matrixClient.requestVerification(user.userId);
  setRightPanel({
    member: user,
    verificationRequestPromise
  });
}
async function verifyUser(matrixClient, user) {
  if (matrixClient.isGuest()) {
    _dispatcher.default.dispatch({
      action: "require_registration"
    });
    return;
  }
  if (!(await enable4SIfNeeded(matrixClient))) {
    return;
  }
  const existingRequest = pendingVerificationRequestForUser(matrixClient, user);
  setRightPanel({
    member: user,
    verificationRequest: existingRequest
  });
}
function setRightPanel(state) {
  if (_RightPanelStore.default.instance.roomPhaseHistory.some(card => card.phase == _RightPanelStorePhases.RightPanelPhases.RoomSummary)) {
    _RightPanelStore.default.instance.pushCard({
      phase: _RightPanelStorePhases.RightPanelPhases.EncryptionPanel,
      state
    });
  } else {
    _RightPanelStore.default.instance.setCards([{
      phase: _RightPanelStorePhases.RightPanelPhases.RoomSummary
    }, {
      phase: _RightPanelStorePhases.RightPanelPhases.RoomMemberInfo,
      state: {
        member: state.member
      }
    }, {
      phase: _RightPanelStorePhases.RightPanelPhases.EncryptionPanel,
      state
    }]);
  }
}
function pendingVerificationRequestForUser(matrixClient, user) {
  const dmRoom = (0, _findDMForUser.findDMForUser)(matrixClient, user.userId);
  if (dmRoom) {
    return matrixClient.findVerificationRequestDMInProgress(dmRoom.roomId);
  }
}
//# sourceMappingURL=verification.js.map