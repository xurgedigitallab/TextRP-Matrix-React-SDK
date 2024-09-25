"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TILE_SERVER_WK_KEY = exports.SecureBackupSetupMethod = void 0;
exports.embeddedPagesFromWellKnown = embeddedPagesFromWellKnown;
exports.getCallBehaviourWellKnown = getCallBehaviourWellKnown;
exports.getE2EEWellKnown = getE2EEWellKnown;
exports.getEmbeddedPagesWellKnown = getEmbeddedPagesWellKnown;
exports.getSecureBackupSetupMethods = getSecureBackupSetupMethods;
exports.getTileServerWellKnown = getTileServerWellKnown;
exports.isSecureBackupRequired = isSecureBackupRequired;
exports.tileServerFromWellKnown = tileServerFromWellKnown;
var _NamespacedValue = require("matrix-js-sdk/src/NamespacedValue");
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

const CALL_BEHAVIOUR_WK_KEY = "io.element.call_behaviour";
const E2EE_WK_KEY = "io.element.e2ee";
const E2EE_WK_KEY_DEPRECATED = "im.vector.riot.e2ee";
const TILE_SERVER_WK_KEY = new _NamespacedValue.UnstableValue("m.tile_server", "org.matrix.msc3488.tile_server");
exports.TILE_SERVER_WK_KEY = TILE_SERVER_WK_KEY;
const EMBEDDED_PAGES_WK_PROPERTY = "io.element.embedded_pages";

/* eslint-disable camelcase */

/* eslint-enable camelcase */

function getCallBehaviourWellKnown(matrixClient) {
  const clientWellKnown = matrixClient.getClientWellKnown();
  return clientWellKnown?.[CALL_BEHAVIOUR_WK_KEY];
}
function getE2EEWellKnown(matrixClient) {
  const clientWellKnown = matrixClient.getClientWellKnown();
  if (clientWellKnown?.[E2EE_WK_KEY]) {
    return clientWellKnown[E2EE_WK_KEY];
  }
  if (clientWellKnown?.[E2EE_WK_KEY_DEPRECATED]) {
    return clientWellKnown[E2EE_WK_KEY_DEPRECATED];
  }
  return null;
}
function getTileServerWellKnown(matrixClient) {
  return tileServerFromWellKnown(matrixClient.getClientWellKnown());
}
function tileServerFromWellKnown(clientWellKnown) {
  return clientWellKnown?.[TILE_SERVER_WK_KEY.name] ?? clientWellKnown?.[TILE_SERVER_WK_KEY.altName];
}
function getEmbeddedPagesWellKnown(matrixClient) {
  return embeddedPagesFromWellKnown(matrixClient?.getClientWellKnown());
}
function embeddedPagesFromWellKnown(clientWellKnown) {
  return clientWellKnown?.[EMBEDDED_PAGES_WK_PROPERTY];
}
function isSecureBackupRequired(matrixClient) {
  return getE2EEWellKnown(matrixClient)?.["secure_backup_required"] === true;
}
let SecureBackupSetupMethod = /*#__PURE__*/function (SecureBackupSetupMethod) {
  SecureBackupSetupMethod["Key"] = "key";
  SecureBackupSetupMethod["Passphrase"] = "passphrase";
  return SecureBackupSetupMethod;
}({});
exports.SecureBackupSetupMethod = SecureBackupSetupMethod;
function getSecureBackupSetupMethods(matrixClient) {
  const wellKnown = getE2EEWellKnown(matrixClient);
  if (!wellKnown || !wellKnown["secure_backup_setup_methods"] || !wellKnown["secure_backup_setup_methods"].length || !(wellKnown["secure_backup_setup_methods"].includes(SecureBackupSetupMethod.Key) || wellKnown["secure_backup_setup_methods"].includes(SecureBackupSetupMethod.Passphrase))) {
    return [SecureBackupSetupMethod.Key, SecureBackupSetupMethod.Passphrase];
  }
  return wellKnown["secure_backup_setup_methods"];
}
//# sourceMappingURL=WellKnownUtils.js.map