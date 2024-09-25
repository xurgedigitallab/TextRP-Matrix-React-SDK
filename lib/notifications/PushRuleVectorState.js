"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.VectorState = exports.PushRuleVectorState = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _StandardActions = require("./StandardActions");
var _NotificationUtils = require("./NotificationUtils");
/*
Copyright 2016 - 2021 The Matrix.org Foundation C.I.C.

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
let VectorState = /*#__PURE__*/function (VectorState) {
  VectorState["Off"] = "off";
  VectorState["On"] = "on";
  VectorState["Loud"] = "loud";
  return VectorState;
}({});
exports.VectorState = VectorState;
class PushRuleVectorState {
  /**
   * Convert a PushRuleVectorState to a list of actions
   *
   * @return [object] list of push-rule actions
   */
  static actionsFor(pushRuleVectorState) {
    if (pushRuleVectorState === VectorState.On) {
      return _StandardActions.StandardActions.ACTION_NOTIFY;
    } else if (pushRuleVectorState === VectorState.Loud) {
      return _StandardActions.StandardActions.ACTION_HIGHLIGHT_DEFAULT_SOUND;
    }
    return [];
  }

  /**
   * Convert a pushrule's actions to a PushRuleVectorState.
   *
   * Determines whether a content rule is in the PushRuleVectorState.ON
   * category or in PushRuleVectorState.LOUD, regardless of its enabled
   * state. Returns null if it does not match these categories.
   */
  static contentRuleVectorStateKind(rule) {
    const decoded = _NotificationUtils.NotificationUtils.decodeActions(rule.actions);
    if (!decoded) {
      return null;
    }

    // Count tweaks to determine if it is a ON or LOUD rule
    let tweaks = 0;
    if (decoded.sound) {
      tweaks++;
    }
    if (decoded.highlight) {
      tweaks++;
    }
    let stateKind = null;
    switch (tweaks) {
      case 0:
        stateKind = VectorState.On;
        break;
      case 2:
        stateKind = VectorState.Loud;
        break;
    }
    return stateKind;
  }
}
exports.PushRuleVectorState = PushRuleVectorState;
// Backwards compatibility (things should probably be using the enum above instead)
(0, _defineProperty2.default)(PushRuleVectorState, "OFF", VectorState.Off);
(0, _defineProperty2.default)(PushRuleVectorState, "ON", VectorState.On);
(0, _defineProperty2.default)(PushRuleVectorState, "LOUD", VectorState.Loud);
/**
 * Enum for state of a push rule as defined by the Vector UI.
 * @readonly
 * @enum {string}
 */
(0, _defineProperty2.default)(PushRuleVectorState, "states", VectorState);
//# sourceMappingURL=PushRuleVectorState.js.map