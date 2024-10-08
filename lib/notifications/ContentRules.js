"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ContentRules = void 0;
var _PushRules = require("matrix-js-sdk/src/@types/PushRules");
var _PushRuleVectorState = require("./PushRuleVectorState");
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

class ContentRules {
  /**
   * Extract the keyword rules from a list of rules, and parse them
   * into a form which is useful for Vector's UI.
   *
   * Returns an object containing:
   *   rules: the primary list of keyword rules
   *   vectorState: a PushRuleVectorState indicating whether those rules are
   *      OFF/ON/LOUD
   *   externalRules: a list of other keyword rules, with states other than
   *      vectorState
   */
  static parseContentRules(rulesets) {
    // first categorise the keyword rules in terms of their actions
    const contentRules = ContentRules.categoriseContentRules(rulesets);

    // Decide which content rules to display in Vector UI.
    // Vector displays a single global rule for a list of keywords
    // whereas Matrix has a push rule per keyword.
    // Vector can set the unique rule in ON, LOUD or OFF state.
    // Matrix has enabled/disabled plus a combination of (highlight, sound) tweaks.

    // The code below determines which set of user's content push rules can be
    // displayed by the vector UI.
    // Push rules that does not fit, ie defined by another Matrix client, ends
    // in externalRules.
    // There is priority in the determination of which set will be the displayed one.
    // The set with rules that have LOUD tweaks is the first choice. Then, the ones
    // with ON tweaks (no tweaks).

    if (contentRules.loud.length) {
      return {
        vectorState: _PushRuleVectorState.VectorState.Loud,
        rules: contentRules.loud,
        externalRules: [...contentRules.loud_but_disabled, ...contentRules.on, ...contentRules.on_but_disabled, ...contentRules.other]
      };
    } else if (contentRules.loud_but_disabled.length) {
      return {
        vectorState: _PushRuleVectorState.VectorState.Off,
        rules: contentRules.loud_but_disabled,
        externalRules: [...contentRules.on, ...contentRules.on_but_disabled, ...contentRules.other]
      };
    } else if (contentRules.on.length) {
      return {
        vectorState: _PushRuleVectorState.VectorState.On,
        rules: contentRules.on,
        externalRules: [...contentRules.on_but_disabled, ...contentRules.other]
      };
    } else if (contentRules.on_but_disabled.length) {
      return {
        vectorState: _PushRuleVectorState.VectorState.Off,
        rules: contentRules.on_but_disabled,
        externalRules: contentRules.other
      };
    } else {
      return {
        vectorState: _PushRuleVectorState.VectorState.On,
        rules: [],
        externalRules: contentRules.other
      };
    }
  }
  static categoriseContentRules(rulesets) {
    const contentRules = {
      on: [],
      on_but_disabled: [],
      loud: [],
      loud_but_disabled: [],
      other: []
    };
    for (const kind in rulesets.global) {
      for (let i = 0; i < Object.keys(rulesets.global[kind]).length; ++i) {
        const r = rulesets.global[kind][i];

        // check it's not a default rule
        if (r.rule_id[0] === "." || kind !== _PushRules.PushRuleKind.ContentSpecific) {
          continue;
        }

        // this is needed as we are flattening an object of arrays into a single array
        r.kind = kind;
        switch (_PushRuleVectorState.PushRuleVectorState.contentRuleVectorStateKind(r)) {
          case _PushRuleVectorState.VectorState.On:
            if (r.enabled) {
              contentRules.on.push(r);
            } else {
              contentRules.on_but_disabled.push(r);
            }
            break;
          case _PushRuleVectorState.VectorState.Loud:
            if (r.enabled) {
              contentRules.loud.push(r);
            } else {
              contentRules.loud_but_disabled.push(r);
            }
            break;
          default:
            contentRules.other.push(r);
            break;
        }
      }
    }
    return contentRules;
  }
}
exports.ContentRules = ContentRules;
//# sourceMappingURL=ContentRules.js.map