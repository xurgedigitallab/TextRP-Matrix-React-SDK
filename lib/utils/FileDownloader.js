"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FileDownloader = exports.DEFAULT_STYLES = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
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

const DEFAULT_STYLES = {
  imgSrc: "",
  imgStyle: null,
  // css props
  style: "",
  textContent: ""
};
exports.DEFAULT_STYLES = DEFAULT_STYLES;
// set up the iframe as a singleton so we don't have to figure out destruction of it down the line.
let managedIframe;
let onLoadPromise;
function getManagedIframe() {
  if (managedIframe) return {
    iframe: managedIframe,
    onLoadPromise
  };
  managedIframe = document.createElement("iframe");

  // Need to append the iframe in order for the browser to load it.
  document.body.appendChild(managedIframe);

  // Dev note: the reassignment warnings are entirely incorrect here.

  managedIframe.style.display = "none";

  // @ts-ignore
  // noinspection JSConstantReassignment
  managedIframe.sandbox = "allow-scripts allow-downloads allow-downloads-without-user-activation";
  onLoadPromise = new Promise(resolve => {
    managedIframe.onload = () => {
      resolve();
    };
    managedIframe.src = "usercontent/"; // XXX: Should come from the skin
  });

  return {
    iframe: managedIframe,
    onLoadPromise
  };
}

// TODO: If we decide to keep the download link behaviour, we should bring the style management into here.

/**
 * Helper to handle safe file downloads. This operates off an iframe for reasons described
 * by the blob helpers. By default, this will use a hidden iframe to manage the download
 * through a user content wrapper, but can be given an iframe reference if the caller needs
 * additional control over the styling/position of the iframe itself.
 */
class FileDownloader {
  /**
   * Creates a new file downloader
   * @param iframeFn Function to get a pre-configured iframe. Set to null to have the downloader
   * use a generic, hidden, iframe.
   */
  constructor(iframeFn) {
    this.iframeFn = iframeFn;
    (0, _defineProperty2.default)(this, "onLoadPromise", void 0);
  }
  get iframe() {
    const iframe = this.iframeFn?.();
    if (!iframe) {
      const managed = getManagedIframe();
      this.onLoadPromise = managed.onLoadPromise;
      return managed.iframe;
    }
    this.onLoadPromise = undefined;
    return iframe;
  }
  async download(_ref) {
    let {
      blob,
      name,
      autoDownload = true,
      opts = DEFAULT_STYLES
    } = _ref;
    const iframe = this.iframe; // get the iframe first just in case we need to await onload
    if (this.onLoadPromise) await this.onLoadPromise;
    iframe.contentWindow?.postMessage(_objectSpread(_objectSpread({}, opts), {}, {
      blob: blob,
      download: name,
      auto: autoDownload
    }), "*");
  }
}
exports.FileDownloader = FileDownloader;
//# sourceMappingURL=FileDownloader.js.map