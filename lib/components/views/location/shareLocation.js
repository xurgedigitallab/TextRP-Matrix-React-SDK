"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.shareLocation = exports.shareLiveLocation = exports.LocationShareType = void 0;
var _contentHelpers = require("matrix-js-sdk/src/content-helpers");
var _logger = require("matrix-js-sdk/src/logger");
var _location = require("matrix-js-sdk/src/@types/location");
var _thread = require("matrix-js-sdk/src/models/thread");
var _languageHandler = require("../../../languageHandler");
var _Modal = _interopRequireDefault(require("../../../Modal"));
var _QuestionDialog = _interopRequireDefault(require("../dialogs/QuestionDialog"));
var _SdkConfig = _interopRequireDefault(require("../../../SdkConfig"));
var _OwnBeaconStore = require("../../../stores/OwnBeaconStore");
var _localRoom = require("../../../utils/local-room");
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
let LocationShareType = /*#__PURE__*/function (LocationShareType) {
  LocationShareType["Own"] = "Own";
  LocationShareType["Pin"] = "Pin";
  LocationShareType["Live"] = "Live";
  return LocationShareType;
}({});
exports.LocationShareType = LocationShareType;
// default duration to 5min for now
const DEFAULT_LIVE_DURATION = 300000;
const getPermissionsErrorParams = shareType => {
  const errorMessage = shareType === LocationShareType.Live ? "Insufficient permissions to start sharing your live location" : "Insufficient permissions to send your location";
  const modalParams = {
    title: (0, _languageHandler._t)("You don't have permission to share locations"),
    description: (0, _languageHandler._t)("You need to have the right permissions in order to share locations in this room."),
    button: (0, _languageHandler._t)("OK"),
    hasCancelButton: false,
    onFinished: () => {} // NOOP
  };

  return {
    modalParams,
    errorMessage
  };
};
const getDefaultErrorParams = (shareType, openMenu) => {
  const errorMessage = shareType === LocationShareType.Live ? "We couldn't start sharing your live location" : "We couldn't send your location";
  const modalParams = {
    title: (0, _languageHandler._t)("We couldn't send your location"),
    description: (0, _languageHandler._t)("%(brand)s could not send your location. Please try again later.", {
      brand: _SdkConfig.default.get().brand
    }),
    button: (0, _languageHandler._t)("Try again"),
    cancelButton: (0, _languageHandler._t)("Cancel"),
    onFinished: tryAgain => {
      if (tryAgain) {
        openMenu();
      }
    }
  };
  return {
    modalParams,
    errorMessage
  };
};
const handleShareError = (error, openMenu, shareType) => {
  const {
    modalParams,
    errorMessage
  } = error.errcode === "M_FORBIDDEN" ? getPermissionsErrorParams(shareType) : getDefaultErrorParams(shareType, openMenu);
  _logger.logger.error(errorMessage, error);
  _Modal.default.createDialog(_QuestionDialog.default, modalParams);
};
const shareLiveLocation = (client, roomId, displayName, openMenu) => async _ref => {
  let {
    timeout
  } = _ref;
  const description = (0, _languageHandler._t)(`%(displayName)s's live location`, {
    displayName
  });
  try {
    await _OwnBeaconStore.OwnBeaconStore.instance.createLiveBeacon(roomId, (0, _contentHelpers.makeBeaconInfoContent)(timeout ?? DEFAULT_LIVE_DURATION, true /* isLive */, description, _location.LocationAssetType.Self));
  } catch (error) {
    handleShareError(error, openMenu, LocationShareType.Live);
  }
};
exports.shareLiveLocation = shareLiveLocation;
const shareLocation = (client, roomId, shareType, relation, openMenu) => async _ref2 => {
  let {
    uri,
    timestamp
  } = _ref2;
  if (!uri) return;
  try {
    const threadId = relation?.rel_type === _thread.THREAD_RELATION_TYPE.name && relation?.event_id || null;
    const assetType = shareType === LocationShareType.Pin ? _location.LocationAssetType.Pin : _location.LocationAssetType.Self;
    const content = (0, _contentHelpers.makeLocationContent)(undefined, uri, timestamp, undefined, assetType);
    await (0, _localRoom.doMaybeLocalRoomAction)(roomId, actualRoomId => client.sendMessage(actualRoomId, threadId, content), client);
  } catch (error) {
    handleShareError(error, openMenu, shareType);
  }
};
exports.shareLocation = shareLocation;
//# sourceMappingURL=shareLocation.js.map