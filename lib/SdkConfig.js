"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.DEFAULTS = void 0;
exports.parseSsoRedirectOptions = parseSsoRedirectOptions;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _lodash = require("lodash");
var _SnakedObject = require("./utils/SnakedObject");
var _objects = require("./utils/objects");
/*
Copyright 2016 OpenMarket Ltd
Copyright 2019 - 2022 The Matrix.org Foundation C.I.C.

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

// see element-web config.md for docs, or the IConfigOptions interface for dev docs
const DEFAULTS = {
  brand: "Element",
  integrations_ui_url: "https://scalar.vector.im/",
  integrations_rest_url: "https://scalar.vector.im/api",
  uisi_autorageshake_app: "element-auto-uisi",
  jitsi: {
    preferred_domain: "meet.element.io"
  },
  element_call: {
    url: "https://call.element.io",
    use_exclusively: false,
    participant_limit: 8,
    brand: "Element Call"
  },
  backend_url: "http://localhost:8080",
  // backend_url: "https://backend.textrp.io",
  xrpl_bridge_bot: "@r8K8gtpqaq2yzRNuPWVSY16t5tfvSDrhq:synapse.textrp.io",
  // @ts-ignore - we deliberately use the camelCase version here so we trigger
  // the fallback behaviour. If we used the snake_case version then we'd break
  // everyone's config which has the camelCase property because our default would
  // be preferred over their config.
  desktopBuilds: {
    available: true,
    logo: require("../res/img/element-desktop-logo.svg").default,
    url: "https://element.io/get-started"
  },
  voice_broadcast: {
    chunk_length: 2 * 60,
    // two minutes
    max_length: 4 * 60 * 60 // four hours
  },

  feedback: {
    existing_issues_url: "https://github.com/vector-im/element-web/issues?q=is%3Aopen+is%3Aissue+sort%3Areactions-%2B1-desc",
    new_issue_url: "https://github.com/vector-im/element-web/issues/new/choose"
  }
};
exports.DEFAULTS = DEFAULTS;
function mergeConfig(config, changes) {
  // return { ...config, ...changes };
  return (0, _lodash.mergeWith)((0, _objects.objectClone)(config), changes, (objValue, srcValue) => {
    // Don't merge arrays, prefer values from newer object
    if (Array.isArray(objValue)) {
      return srcValue;
    }

    // Don't allow objects to get nulled out, this will break our types
    if ((0, _objects.isObject)(objValue) && !(0, _objects.isObject)(srcValue)) {
      return objValue;
    }
  });
}
class SdkConfig {
  static setInstance(i) {
    SdkConfig.instance = i;
    SdkConfig.fallback = new _SnakedObject.SnakedObject(i);

    // For debugging purposes
    window.mxReactSdkConfig = i;
  }
  static get(key, altCaseName) {
    if (key === undefined) {
      // safe to cast as a fallback - we want to break the runtime contract in this case
      return SdkConfig.instance || {};
    }
    return SdkConfig.fallback.get(key, altCaseName);
  }
  static getObject(key, altCaseName) {
    const val = SdkConfig.get(key, altCaseName);
    if ((0, _objects.isObject)(val)) {
      return new _SnakedObject.SnakedObject(val);
    }

    // return the same type for sensitive callers (some want `undefined` specifically)
    return val === undefined ? undefined : null;
  }
  static put(cfg) {
    SdkConfig.setInstance(mergeConfig(DEFAULTS, cfg));
  }

  /**
   * Resets the config.
   */
  static reset() {
    SdkConfig.setInstance(mergeConfig(DEFAULTS, {})); // safe to cast - defaults will be applied
  }

  static add(cfg) {
    SdkConfig.put(mergeConfig(SdkConfig.get(), cfg));
  }
}
exports.default = SdkConfig;
(0, _defineProperty2.default)(SdkConfig, "instance", void 0);
(0, _defineProperty2.default)(SdkConfig, "fallback", void 0);
function parseSsoRedirectOptions(config) {
  // Ignore deprecated options if the config is using new ones
  if (config.sso_redirect_options) return config.sso_redirect_options;

  // We can cheat here because the default is false anyways
  if (config.sso_immediate_redirect) return {
    immediate: true
  };

  // Default: do nothing
  return {};
}
//# sourceMappingURL=SdkConfig.js.map