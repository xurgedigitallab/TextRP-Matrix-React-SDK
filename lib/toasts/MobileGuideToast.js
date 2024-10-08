"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.showToast = exports.hideToast = void 0;
var _languageHandler = require("../languageHandler");
var _GenericToast = _interopRequireDefault(require("../components/views/toasts/GenericToast"));
var _ToastStore = _interopRequireDefault(require("../stores/ToastStore"));
var _SdkConfig = _interopRequireDefault(require("../SdkConfig"));
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

const onAccept = () => {
  window.location.href = "mobile_guide/";
};
const onReject = () => {
  document.cookie = "element_mobile_redirect_to_guide=false;path=/;max-age=14400";
  hideToast();
};
const TOAST_KEY = "mobileguide";
const showToast = () => {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isAndroid = /Android/.test(navigator.userAgent);
  const brand = _SdkConfig.default.get().brand;
  if (!isIos && !isAndroid) {
    return;
  }
  if (document.cookie.includes("element_mobile_redirect_to_guide=false")) {
    return;
  }
  _ToastStore.default.sharedInstance().addOrReplaceToast({
    key: TOAST_KEY,
    title: (0, _languageHandler._t)("Use app for a better experience"),
    props: {
      description: (0, _languageHandler._t)("%(brand)s is experimental on a mobile web browser. " + "For a better experience and the latest features, use our free native app.", {
        brand
      }),
      acceptLabel: (0, _languageHandler._t)("Use app"),
      onAccept,
      rejectLabel: (0, _languageHandler._t)("Dismiss"),
      onReject
    },
    component: _GenericToast.default,
    priority: 99
  });
};
exports.showToast = showToast;
const hideToast = () => {
  _ToastStore.default.sharedInstance().dismissToast(TOAST_KEY);
};
exports.hideToast = hideToast;
//# sourceMappingURL=MobileGuideToast.js.map