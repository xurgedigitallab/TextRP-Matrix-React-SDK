"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.monitorSyncedPushRules = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _matrix = require("matrix-js-sdk/src/matrix");
var _pushprocessor = require("matrix-js-sdk/src/pushprocessor");
var _logger = require("matrix-js-sdk/src/logger");
var _notifications = require("../../notifications");
var _updatePushRuleActions = require("./updatePushRuleActions");
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; } /*
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
const pushRuleAndKindToAnnotated = ruleAndKind => ruleAndKind ? _objectSpread(_objectSpread({}, ruleAndKind.rule), {}, {
  kind: ruleAndKind.kind
}) : undefined;

/**
 * Checks that any synced rules that exist a given rule are in sync
 * And updates any that are out of sync
 * Ignores ruleIds that do not exist for the user
 * @param matrixClient - cli
 * @param pushProcessor - processor used to retrieve current state of rules
 * @param ruleId - primary rule
 * @param definition - VectorPushRuleDefinition of the primary rule
 */
const monitorSyncedRule = async (matrixClient, pushProcessor, ruleId, definition) => {
  const primaryRule = pushRuleAndKindToAnnotated(pushProcessor.getPushRuleAndKindById(ruleId));
  if (!primaryRule) {
    return;
  }
  const syncedRules = definition.syncedRuleIds?.map(ruleId => pushRuleAndKindToAnnotated(pushProcessor.getPushRuleAndKindById(ruleId))).filter(n => Boolean(n));

  // no synced rules to manage
  if (!syncedRules?.length) {
    return;
  }
  const primaryRuleVectorState = definition.ruleToVectorState(primaryRule);
  const outOfSyncRules = syncedRules.filter(syncedRule => definition.ruleToVectorState(syncedRule) !== primaryRuleVectorState);
  if (outOfSyncRules.length) {
    await (0, _updatePushRuleActions.updateExistingPushRulesWithActions)(matrixClient,
    // eslint-disable-next-line camelcase, @typescript-eslint/naming-convention
    outOfSyncRules.map(_ref => {
      let {
        rule_id
      } = _ref;
      return rule_id;
    }), primaryRule.actions);
  }
};

/**
 * On changes to m.push_rules account data,
 * check that synced push rules are in sync with their primary rule,
 * and update any out of sync rules.
 * synced rules are defined in VectorPushRulesDefinitions
 * If updating a rule fails for any reason,
 * the error is caught and handled silently
 * @param accountDataEvent - MatrixEvent
 * @param matrixClient - cli
 * @returns Resolves when updates are complete
 */
const monitorSyncedPushRules = async (accountDataEvent, matrixClient) => {
  if (accountDataEvent?.getType() !== _matrix.EventType.PushRules) {
    return;
  }
  const pushProcessor = new _pushprocessor.PushProcessor(matrixClient);
  Object.entries(_notifications.VectorPushRulesDefinitions).forEach(async _ref2 => {
    let [ruleId, definition] = _ref2;
    try {
      await monitorSyncedRule(matrixClient, pushProcessor, ruleId, definition);
    } catch (error) {
      _logger.logger.error(`Failed to fully synchronise push rules for ${ruleId}`, error);
    }
  });
};
exports.monitorSyncedPushRules = monitorSyncedPushRules;
//# sourceMappingURL=monitorSyncedPushRules.js.map