"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updatePushRuleActions = exports.updateExistingPushRulesWithActions = void 0;
var _pushprocessor = require("matrix-js-sdk/src/pushprocessor");
/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
 * Sets the actions for a given push rule id and kind
 * When actions are falsy, disables the rule
 * @param matrixClient - cli
 * @param ruleId - rule id to update
 * @param kind - PushRuleKind
 * @param actions - push rule actions to set for rule
 */
const updatePushRuleActions = async (matrixClient, ruleId, kind, actions) => {
  if (!actions) {
    await matrixClient.setPushRuleEnabled("global", kind, ruleId, false);
  } else {
    await matrixClient.setPushRuleActions("global", kind, ruleId, actions);
    await matrixClient.setPushRuleEnabled("global", kind, ruleId, true);
  }
};
exports.updatePushRuleActions = updatePushRuleActions;
/**
 * Update push rules with given actions
 * Where they already exist for current user
 * Rules are updated sequentially and stop at first error
 * @param matrixClient - cli
 * @param ruleIds - RuleIds of push rules to attempt to set actions for
 * @param actions - push rule actions to set for rule
 * @returns resolves when all rules have been updated
 * @returns rejects when a rule update fails
 */
const updateExistingPushRulesWithActions = async (matrixClient, ruleIds, actions) => {
  const pushProcessor = new _pushprocessor.PushProcessor(matrixClient);
  const rules = ruleIds?.map(ruleId => pushProcessor.getPushRuleAndKindById(ruleId)).filter(n => Boolean(n));
  if (!rules?.length) {
    return;
  }
  for (const {
    kind,
    rule
  } of rules) {
    await updatePushRuleActions(matrixClient, rule.rule_id, kind, actions);
  }
};
exports.updateExistingPushRulesWithActions = updateExistingPushRulesWithActions;
//# sourceMappingURL=updatePushRuleActions.js.map