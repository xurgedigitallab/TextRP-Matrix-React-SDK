"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ModuleRunner = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _utils = require("matrix-js-sdk/src/utils");
var _AppModule = require("./AppModule");
require("./ModuleComponents");
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

/**
 * Handles and coordinates the operation of modules.
 */
class ModuleRunner {
  constructor() {
    (0, _defineProperty2.default)(this, "modules", []);
  } // we only want one instance

  /**
   * Resets the runner, clearing all known modules.
   *
   * Intended for test usage only.
   */
  reset() {
    this.modules = [];
  }

  /**
   * All custom translations from all registered modules.
   */
  get allTranslations() {
    const merged = {};
    for (const module of this.modules) {
      const i18n = module.api.translations;
      if (!i18n) continue;
      for (const [lang, strings] of Object.entries(i18n)) {
        (0, _utils.safeSet)(merged, lang, merged[lang] || {});
        for (const [str, val] of Object.entries(strings)) {
          (0, _utils.safeSet)(merged[lang], str, val);
        }
      }
    }
    return merged;
  }

  /**
   * Registers a factory which creates a module for later loading. The factory
   * will be called immediately.
   * @param factory The module factory.
   */
  registerModule(factory) {
    this.modules.push(new _AppModule.AppModule(factory));
  }

  /**
   * Invokes a lifecycle event, notifying registered modules.
   * @param lifecycleEvent The lifecycle event.
   * @param args The arguments for the lifecycle event.
   */
  invoke(lifecycleEvent) {
    for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }
    for (const module of this.modules) {
      module.module.emit(lifecycleEvent, ...args);
    }
  }
}
exports.ModuleRunner = ModuleRunner;
(0, _defineProperty2.default)(ModuleRunner, "instance", new ModuleRunner());
//# sourceMappingURL=ModuleRunner.js.map