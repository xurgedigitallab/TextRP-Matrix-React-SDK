"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.VectorPushRulesDefinitions = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _PushRules = require("matrix-js-sdk/src/@types/PushRules");
var _logger = require("matrix-js-sdk/src/logger");
var _languageHandler = require("../languageHandler");
var _StandardActions = require("./StandardActions");
var _PushRuleVectorState = require("./PushRuleVectorState");
var _NotificationUtils = require("./NotificationUtils");
/*
Copyright 2016 - 2022 The Matrix.org Foundation C.I.C.

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

class VectorPushRuleDefinition {
  constructor(opts) {
    (0, _defineProperty2.default)(this, "description", void 0);
    (0, _defineProperty2.default)(this, "vectorStateToActions", void 0);
    (0, _defineProperty2.default)(this, "syncedRuleIds", void 0);
    this.description = opts.description;
    this.vectorStateToActions = opts.vectorStateToActions;
    this.syncedRuleIds = opts.syncedRuleIds;
  }

  // Translate the rule actions and its enabled value into vector state
  ruleToVectorState(rule) {
    let enabled = false;
    if (rule) {
      enabled = rule.enabled;
    }
    for (const state of Object.values(_PushRuleVectorState.PushRuleVectorState.states)) {
      const vectorStateToActions = this.vectorStateToActions[state];
      if (!vectorStateToActions) {
        // No defined actions means that this vector state expects a disabled (or absent) rule
        if (!enabled) {
          return state;
        }
      } else {
        // The actions must match to the ones expected by vector state.
        // Use `decodeActions` on both sides to canonicalize things like
        // value: true vs. unspecified for highlight (which defaults to
        // true, making them equivalent).
        if (enabled && JSON.stringify(_NotificationUtils.NotificationUtils.decodeActions(rule.actions)) === JSON.stringify(_NotificationUtils.NotificationUtils.decodeActions(vectorStateToActions))) {
          return state;
        }
      }
    }
    _logger.logger.error(`Cannot translate rule actions into Vector rule state. ` + `Rule: ${JSON.stringify(rule)}, ` + `Expected: ${JSON.stringify(this.vectorStateToActions)}`);
    return undefined;
  }
}
/**
 * The descriptions of rules managed by the Vector UI.
 */
const VectorPushRulesDefinitions = {
  // Messages containing user's display name
  ".m.rule.contains_display_name": new VectorPushRuleDefinition({
    description: (0, _languageHandler._td)("Messages containing my display name"),
    // passed through _t() translation in src/components/views/settings/Notifications.js
    vectorStateToActions: {
      // The actions for each vector state, or null to disable the rule.
      [_PushRuleVectorState.VectorState.On]: _StandardActions.StandardActions.ACTION_NOTIFY,
      [_PushRuleVectorState.VectorState.Loud]: _StandardActions.StandardActions.ACTION_HIGHLIGHT_DEFAULT_SOUND,
      [_PushRuleVectorState.VectorState.Off]: _StandardActions.StandardActions.ACTION_DISABLED
    }
  }),
  // Messages containing user's username (localpart/MXID)
  ".m.rule.contains_user_name": new VectorPushRuleDefinition({
    description: (0, _languageHandler._td)("Messages containing my username"),
    // passed through _t() translation in src/components/views/settings/Notifications.js
    vectorStateToActions: {
      // The actions for each vector state, or null to disable the rule.
      [_PushRuleVectorState.VectorState.On]: _StandardActions.StandardActions.ACTION_NOTIFY,
      [_PushRuleVectorState.VectorState.Loud]: _StandardActions.StandardActions.ACTION_HIGHLIGHT_DEFAULT_SOUND,
      [_PushRuleVectorState.VectorState.Off]: _StandardActions.StandardActions.ACTION_DISABLED
    }
  }),
  // Messages containing @room
  ".m.rule.roomnotif": new VectorPushRuleDefinition({
    description: (0, _languageHandler._td)("Messages containing @room"),
    // passed through _t() translation in src/components/views/settings/Notifications.js
    vectorStateToActions: {
      // The actions for each vector state, or null to disable the rule.
      [_PushRuleVectorState.VectorState.On]: _StandardActions.StandardActions.ACTION_NOTIFY,
      [_PushRuleVectorState.VectorState.Loud]: _StandardActions.StandardActions.ACTION_HIGHLIGHT,
      [_PushRuleVectorState.VectorState.Off]: _StandardActions.StandardActions.ACTION_DISABLED
    }
  }),
  // Messages just sent to the user in a 1:1 room
  ".m.rule.room_one_to_one": new VectorPushRuleDefinition({
    description: (0, _languageHandler._td)("Messages in one-to-one chats"),
    // passed through _t() translation in src/components/views/settings/Notifications.js
    vectorStateToActions: {
      [_PushRuleVectorState.VectorState.On]: _StandardActions.StandardActions.ACTION_NOTIFY,
      [_PushRuleVectorState.VectorState.Loud]: _StandardActions.StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
      [_PushRuleVectorState.VectorState.Off]: _StandardActions.StandardActions.ACTION_DONT_NOTIFY
    },
    syncedRuleIds: [_PushRules.RuleId.PollStartOneToOne, _PushRules.RuleId.PollStartOneToOneUnstable, _PushRules.RuleId.PollEndOneToOne, _PushRules.RuleId.PollEndOneToOneUnstable]
  }),
  // Encrypted messages just sent to the user in a 1:1 room
  ".m.rule.encrypted_room_one_to_one": new VectorPushRuleDefinition({
    description: (0, _languageHandler._td)("Encrypted messages in one-to-one chats"),
    // passed through _t() translation in src/components/views/settings/Notifications.js
    vectorStateToActions: {
      [_PushRuleVectorState.VectorState.On]: _StandardActions.StandardActions.ACTION_NOTIFY,
      [_PushRuleVectorState.VectorState.Loud]: _StandardActions.StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
      [_PushRuleVectorState.VectorState.Off]: _StandardActions.StandardActions.ACTION_DONT_NOTIFY
    }
  }),
  // Messages just sent to a group chat room
  // 1:1 room messages are caught by the .m.rule.room_one_to_one rule if any defined
  // By opposition, all other room messages are from group chat rooms.
  ".m.rule.message": new VectorPushRuleDefinition({
    description: (0, _languageHandler._td)("Messages in group chats"),
    // passed through _t() translation in src/components/views/settings/Notifications.js
    vectorStateToActions: {
      [_PushRuleVectorState.VectorState.On]: _StandardActions.StandardActions.ACTION_NOTIFY,
      [_PushRuleVectorState.VectorState.Loud]: _StandardActions.StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
      [_PushRuleVectorState.VectorState.Off]: _StandardActions.StandardActions.ACTION_DONT_NOTIFY
    },
    syncedRuleIds: [_PushRules.RuleId.PollStart, _PushRules.RuleId.PollStartUnstable, _PushRules.RuleId.PollEnd, _PushRules.RuleId.PollEndUnstable]
  }),
  // Encrypted messages just sent to a group chat room
  // Encrypted 1:1 room messages are caught by the .m.rule.encrypted_room_one_to_one rule if any defined
  // By opposition, all other room messages are from group chat rooms.
  ".m.rule.encrypted": new VectorPushRuleDefinition({
    description: (0, _languageHandler._td)("Encrypted messages in group chats"),
    // passed through _t() translation in src/components/views/settings/Notifications.js
    vectorStateToActions: {
      [_PushRuleVectorState.VectorState.On]: _StandardActions.StandardActions.ACTION_NOTIFY,
      [_PushRuleVectorState.VectorState.Loud]: _StandardActions.StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
      [_PushRuleVectorState.VectorState.Off]: _StandardActions.StandardActions.ACTION_DONT_NOTIFY
    }
  }),
  // Invitation for the user
  ".m.rule.invite_for_me": new VectorPushRuleDefinition({
    description: (0, _languageHandler._td)("When I'm invited to a room"),
    // passed through _t() translation in src/components/views/settings/Notifications.js
    vectorStateToActions: {
      [_PushRuleVectorState.VectorState.On]: _StandardActions.StandardActions.ACTION_NOTIFY,
      [_PushRuleVectorState.VectorState.Loud]: _StandardActions.StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
      [_PushRuleVectorState.VectorState.Off]: _StandardActions.StandardActions.ACTION_DISABLED
    }
  }),
  // Incoming call
  ".m.rule.call": new VectorPushRuleDefinition({
    description: (0, _languageHandler._td)("Call invitation"),
    // passed through _t() translation in src/components/views/settings/Notifications.js
    vectorStateToActions: {
      [_PushRuleVectorState.VectorState.On]: _StandardActions.StandardActions.ACTION_NOTIFY,
      [_PushRuleVectorState.VectorState.Loud]: _StandardActions.StandardActions.ACTION_NOTIFY_RING_SOUND,
      [_PushRuleVectorState.VectorState.Off]: _StandardActions.StandardActions.ACTION_DISABLED
    }
  }),
  // Notifications from bots
  ".m.rule.suppress_notices": new VectorPushRuleDefinition({
    description: (0, _languageHandler._td)("Messages sent by bot"),
    // passed through _t() translation in src/components/views/settings/Notifications.js
    vectorStateToActions: {
      // .m.rule.suppress_notices is a "negative" rule, we have to invert its enabled value for vector UI
      [_PushRuleVectorState.VectorState.On]: _StandardActions.StandardActions.ACTION_DISABLED,
      [_PushRuleVectorState.VectorState.Loud]: _StandardActions.StandardActions.ACTION_NOTIFY_DEFAULT_SOUND,
      [_PushRuleVectorState.VectorState.Off]: _StandardActions.StandardActions.ACTION_DONT_NOTIFY
    }
  }),
  // Room upgrades (tombstones)
  ".m.rule.tombstone": new VectorPushRuleDefinition({
    description: (0, _languageHandler._td)("When rooms are upgraded"),
    // passed through _t() translation in src/components/views/settings/Notifications.js
    vectorStateToActions: {
      // The actions for each vector state, or null to disable the rule.
      [_PushRuleVectorState.VectorState.On]: _StandardActions.StandardActions.ACTION_NOTIFY,
      [_PushRuleVectorState.VectorState.Loud]: _StandardActions.StandardActions.ACTION_HIGHLIGHT,
      [_PushRuleVectorState.VectorState.Off]: _StandardActions.StandardActions.ACTION_DISABLED
    }
  })
};
exports.VectorPushRulesDefinitions = VectorPushRulesDefinitions;
//# sourceMappingURL=VectorPushRulesDefinitions.js.map