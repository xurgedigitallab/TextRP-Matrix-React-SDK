"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.NotificationUtils = void 0;
var _PushRules = require("matrix-js-sdk/src/@types/PushRules");
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

class NotificationUtils {
  // Encodes a dictionary of {
  //   "notify": true/false,
  //   "sound": string or undefined,
  //   "highlight: true/false,
  // }
  // to a list of push actions.
  static encodeActions(action) {
    const notify = action.notify;
    const sound = action.sound;
    const highlight = action.highlight;
    if (notify) {
      const actions = [_PushRules.PushRuleActionName.Notify];
      if (sound) {
        actions.push({
          set_tweak: "sound",
          value: sound
        });
      }
      if (highlight) {
        actions.push({
          set_tweak: "highlight"
        });
      } else {
        actions.push({
          set_tweak: "highlight",
          value: false
        });
      }
      return actions;
    } else {
      return [_PushRules.PushRuleActionName.DontNotify];
    }
  }

  // Decode a list of actions to a dictionary of {
  //   "notify": true/false,
  //   "sound": string or undefined,
  //   "highlight: true/false,
  // }
  // If the actions couldn't be decoded then returns null.
  static decodeActions(actions) {
    let notify = false;
    let sound;
    let highlight = false;
    for (let i = 0; i < actions.length; ++i) {
      const action = actions[i];
      if (action === _PushRules.PushRuleActionName.Notify) {
        notify = true;
      } else if (action === _PushRules.PushRuleActionName.DontNotify) {
        notify = false;
      } else if (typeof action === "object") {
        if (action.set_tweak === "sound") {
          sound = action.value;
        } else if (action.set_tweak === "highlight") {
          highlight = action.value;
        } else {
          // We don't understand this kind of tweak, so give up.
          return null;
        }
      } else {
        // We don't understand this kind of action, so give up.
        return null;
      }
    }
    if (highlight === undefined) {
      // If a highlight tweak is missing a value then it defaults to true.
      highlight = true;
    }
    const result = {
      notify,
      highlight
    };
    if (sound !== undefined) {
      result.sound = sound;
    }
    return result;
  }
}
exports.NotificationUtils = NotificationUtils;
//# sourceMappingURL=NotificationUtils.js.map