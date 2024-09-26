"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.removeClientInformation = exports.recordClientInformation = exports.pruneClientInformation = exports.getDeviceClientInformation = exports.getClientInformationEventType = void 0;
/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

const formatUrl = () => {
  // don't record url for electron clients
  if (window.electron) {
    return undefined;
  }

  // strip query-string and fragment from uri
  const url = new URL(window.location.href);
  return [url.host, url.pathname.replace(/\/$/, "") // Remove trailing slash if present
  ].join("");
};
const clientInformationEventPrefix = "io.element.matrix_client_information.";
const getClientInformationEventType = deviceId => `${clientInformationEventPrefix}${deviceId}`;

/**
 * Record extra client information for the current device
 * https://github.com/vector-im/element-meta/blob/develop/spec/matrix_client_information.md
 */
exports.getClientInformationEventType = getClientInformationEventType;
const recordClientInformation = async (matrixClient, sdkConfig, platform) => {
  const deviceId = matrixClient.getDeviceId();
  const {
    brand
  } = sdkConfig;
  const version = await platform?.getAppVersion();
  const type = getClientInformationEventType(deviceId);
  const url = formatUrl();
  await matrixClient.setAccountData(type, {
    name: brand,
    version,
    url
  });
};

/**
 * Remove client information events for devices that no longer exist
 * @param validDeviceIds - ids of current devices,
 *                      client information for devices NOT in this list will be removed
 */
exports.recordClientInformation = recordClientInformation;
const pruneClientInformation = (validDeviceIds, matrixClient) => {
  Array.from(matrixClient.store.accountData.values()).forEach(event => {
    if (!event.getType().startsWith(clientInformationEventPrefix)) {
      return;
    }
    const [, deviceId] = event.getType().split(clientInformationEventPrefix);
    if (deviceId && !validDeviceIds.includes(deviceId)) {
      matrixClient.deleteAccountData(event.getType());
    }
  });
};

/**
 * Remove extra client information for current device
 */
exports.pruneClientInformation = pruneClientInformation;
const removeClientInformation = async matrixClient => {
  const deviceId = matrixClient.getDeviceId();
  const type = getClientInformationEventType(deviceId);
  const clientInformation = getDeviceClientInformation(matrixClient, deviceId);

  // if a non-empty client info event exists, remove it
  if (clientInformation.name || clientInformation.version || clientInformation.url) {
    await matrixClient.deleteAccountData(type);
  }
};
exports.removeClientInformation = removeClientInformation;
const sanitizeContentString = value => value && typeof value === "string" ? value : undefined;
const getDeviceClientInformation = (matrixClient, deviceId) => {
  const event = matrixClient.getAccountData(getClientInformationEventType(deviceId));
  if (!event) {
    return {};
  }
  const {
    name,
    version,
    url
  } = event.getContent();
  return {
    name: sanitizeContentString(name),
    version: sanitizeContentString(version),
    url: sanitizeContentString(url)
  };
};
exports.getDeviceClientInformation = getDeviceClientInformation;
//# sourceMappingURL=clientInformation.js.map