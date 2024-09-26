"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _SettingController = _interopRequireDefault(require("./SettingController"));
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

/**
 * For animation-like settings, this controller checks whether the user has
 * indicated they prefer reduced motion via browser or OS level settings.
 * If they have, this forces the setting value to false.
 */
class ReducedMotionController extends _SettingController.default {
  getValueOverride(level, roomId, calculatedValue, calculatedAtLevel) {
    if (this.prefersReducedMotion()) {
      return false;
    }
    return null; // no override
  }

  get settingDisabled() {
    return this.prefersReducedMotion();
  }
  prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
}
exports.default = ReducedMotionController;
//# sourceMappingURL=ReducedMotionController.js.map