"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.showToast = exports.hideToast = exports.Kind = void 0;
var _Modal = _interopRequireDefault(require("../Modal"));
var _languageHandler = require("../languageHandler");
var _DeviceListener = _interopRequireDefault(require("../DeviceListener"));
var _SetupEncryptionDialog = _interopRequireDefault(require("../components/views/dialogs/security/SetupEncryptionDialog"));
var _SecurityManager = require("../SecurityManager");
var _ToastStore = _interopRequireDefault(require("../stores/ToastStore"));
var _GenericToast = _interopRequireDefault(require("../components/views/toasts/GenericToast"));
var _Security = _interopRequireDefault(require("../customisations/Security"));
var _Spinner = _interopRequireDefault(require("../components/views/elements/Spinner"));
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

const TOAST_KEY = "setupencryption";
const getTitle = kind => {
  switch (kind) {
    case Kind.SET_UP_ENCRYPTION:
      return (0, _languageHandler._t)("Set up Secure Backup");
    case Kind.UPGRADE_ENCRYPTION:
      return (0, _languageHandler._t)("Encryption upgrade available");
    case Kind.VERIFY_THIS_SESSION:
      return (0, _languageHandler._t)("Verify this session");
  }
};
const getIcon = kind => {
  switch (kind) {
    case Kind.SET_UP_ENCRYPTION:
    case Kind.UPGRADE_ENCRYPTION:
      return "secure_backup";
    case Kind.VERIFY_THIS_SESSION:
      return "verification_warning";
  }
};
const getSetupCaption = kind => {
  switch (kind) {
    case Kind.SET_UP_ENCRYPTION:
      return (0, _languageHandler._t)("Continue");
    case Kind.UPGRADE_ENCRYPTION:
      return (0, _languageHandler._t)("Upgrade");
    case Kind.VERIFY_THIS_SESSION:
      return (0, _languageHandler._t)("Verify");
  }
};
const getDescription = kind => {
  switch (kind) {
    case Kind.SET_UP_ENCRYPTION:
    case Kind.UPGRADE_ENCRYPTION:
      return (0, _languageHandler._t)("Safeguard against losing access to encrypted messages & data");
    case Kind.VERIFY_THIS_SESSION:
      return (0, _languageHandler._t)("Other users may not trust it");
  }
};
let Kind = /*#__PURE__*/function (Kind) {
  Kind["SET_UP_ENCRYPTION"] = "set_up_encryption";
  Kind["UPGRADE_ENCRYPTION"] = "upgrade_encryption";
  Kind["VERIFY_THIS_SESSION"] = "verify_this_session";
  return Kind;
}({});
exports.Kind = Kind;
const onReject = () => {
  _DeviceListener.default.sharedInstance().dismissEncryptionSetup();
};
const showToast = kind => {
  if (_Security.default.setupEncryptionNeeded?.(kind)) {
    return;
  }
  const onAccept = async () => {
    if (kind === Kind.VERIFY_THIS_SESSION) {
      _Modal.default.createDialog(_SetupEncryptionDialog.default, {}, undefined, /* priority = */false, /* static = */true);
    } else {
      const modal = _Modal.default.createDialog(_Spinner.default, undefined, "mx_Dialog_spinner", /* priority */false, /* static */true);
      try {
        await (0, _SecurityManager.accessSecretStorage)();
      } finally {
        modal.close();
      }
    }
  };
  _ToastStore.default.sharedInstance().addOrReplaceToast({
    key: TOAST_KEY,
    title: getTitle(kind),
    icon: getIcon(kind),
    props: {
      description: getDescription(kind),
      acceptLabel: getSetupCaption(kind),
      onAccept,
      rejectLabel: (0, _languageHandler._t)("Later"),
      onReject
    },
    component: _GenericToast.default,
    priority: kind === Kind.VERIFY_THIS_SESSION ? 95 : 40
  });
};
exports.showToast = showToast;
const hideToast = () => {
  _ToastStore.default.sharedInstance().dismissToast(TOAST_KEY);
};
exports.hideToast = hideToast;
//# sourceMappingURL=SetupEncryptionToast.js.map