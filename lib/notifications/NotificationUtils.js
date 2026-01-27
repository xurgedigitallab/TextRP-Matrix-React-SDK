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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfUHVzaFJ1bGVzIiwicmVxdWlyZSIsIk5vdGlmaWNhdGlvblV0aWxzIiwiZW5jb2RlQWN0aW9ucyIsImFjdGlvbiIsIm5vdGlmeSIsInNvdW5kIiwiaGlnaGxpZ2h0IiwiYWN0aW9ucyIsIlB1c2hSdWxlQWN0aW9uTmFtZSIsIk5vdGlmeSIsInB1c2giLCJzZXRfdHdlYWsiLCJ2YWx1ZSIsIkRvbnROb3RpZnkiLCJkZWNvZGVBY3Rpb25zIiwiaSIsImxlbmd0aCIsInVuZGVmaW5lZCIsInJlc3VsdCIsImV4cG9ydHMiXSwic291cmNlcyI6WyIuLi8uLi9zcmMvbm90aWZpY2F0aW9ucy9Ob3RpZmljYXRpb25VdGlscy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuQ29weXJpZ2h0IDIwMTYgLSAyMDIxIFRoZSBNYXRyaXgub3JnIEZvdW5kYXRpb24gQy5JLkMuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuKi9cblxuaW1wb3J0IHsgUHVzaFJ1bGVBY3Rpb24sIFB1c2hSdWxlQWN0aW9uTmFtZSwgVHdlYWtIaWdobGlnaHQsIFR3ZWFrU291bmQgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvQHR5cGVzL1B1c2hSdWxlc1wiO1xuXG5pbnRlcmZhY2UgSUVuY29kZWRBY3Rpb25zIHtcbiAgICBub3RpZnk6IGJvb2xlYW47XG4gICAgc291bmQ/OiBzdHJpbmc7XG4gICAgaGlnaGxpZ2h0PzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGNsYXNzIE5vdGlmaWNhdGlvblV0aWxzIHtcbiAgICAvLyBFbmNvZGVzIGEgZGljdGlvbmFyeSBvZiB7XG4gICAgLy8gICBcIm5vdGlmeVwiOiB0cnVlL2ZhbHNlLFxuICAgIC8vICAgXCJzb3VuZFwiOiBzdHJpbmcgb3IgdW5kZWZpbmVkLFxuICAgIC8vICAgXCJoaWdobGlnaHQ6IHRydWUvZmFsc2UsXG4gICAgLy8gfVxuICAgIC8vIHRvIGEgbGlzdCBvZiBwdXNoIGFjdGlvbnMuXG4gICAgcHVibGljIHN0YXRpYyBlbmNvZGVBY3Rpb25zKGFjdGlvbjogSUVuY29kZWRBY3Rpb25zKTogUHVzaFJ1bGVBY3Rpb25bXSB7XG4gICAgICAgIGNvbnN0IG5vdGlmeSA9IGFjdGlvbi5ub3RpZnk7XG4gICAgICAgIGNvbnN0IHNvdW5kID0gYWN0aW9uLnNvdW5kO1xuICAgICAgICBjb25zdCBoaWdobGlnaHQgPSBhY3Rpb24uaGlnaGxpZ2h0O1xuICAgICAgICBpZiAobm90aWZ5KSB7XG4gICAgICAgICAgICBjb25zdCBhY3Rpb25zOiBQdXNoUnVsZUFjdGlvbltdID0gW1B1c2hSdWxlQWN0aW9uTmFtZS5Ob3RpZnldO1xuICAgICAgICAgICAgaWYgKHNvdW5kKSB7XG4gICAgICAgICAgICAgICAgYWN0aW9ucy5wdXNoKHsgc2V0X3R3ZWFrOiBcInNvdW5kXCIsIHZhbHVlOiBzb3VuZCB9IGFzIFR3ZWFrU291bmQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGhpZ2hsaWdodCkge1xuICAgICAgICAgICAgICAgIGFjdGlvbnMucHVzaCh7IHNldF90d2VhazogXCJoaWdobGlnaHRcIiB9IGFzIFR3ZWFrSGlnaGxpZ2h0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYWN0aW9ucy5wdXNoKHsgc2V0X3R3ZWFrOiBcImhpZ2hsaWdodFwiLCB2YWx1ZTogZmFsc2UgfSBhcyBUd2Vha0hpZ2hsaWdodCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gYWN0aW9ucztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBbUHVzaFJ1bGVBY3Rpb25OYW1lLkRvbnROb3RpZnldO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gRGVjb2RlIGEgbGlzdCBvZiBhY3Rpb25zIHRvIGEgZGljdGlvbmFyeSBvZiB7XG4gICAgLy8gICBcIm5vdGlmeVwiOiB0cnVlL2ZhbHNlLFxuICAgIC8vICAgXCJzb3VuZFwiOiBzdHJpbmcgb3IgdW5kZWZpbmVkLFxuICAgIC8vICAgXCJoaWdobGlnaHQ6IHRydWUvZmFsc2UsXG4gICAgLy8gfVxuICAgIC8vIElmIHRoZSBhY3Rpb25zIGNvdWxkbid0IGJlIGRlY29kZWQgdGhlbiByZXR1cm5zIG51bGwuXG4gICAgcHVibGljIHN0YXRpYyBkZWNvZGVBY3Rpb25zKGFjdGlvbnM6IFB1c2hSdWxlQWN0aW9uW10pOiBJRW5jb2RlZEFjdGlvbnMgfCBudWxsIHtcbiAgICAgICAgbGV0IG5vdGlmeSA9IGZhbHNlO1xuICAgICAgICBsZXQgc291bmQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgbGV0IGhpZ2hsaWdodDogYm9vbGVhbiB8IHVuZGVmaW5lZCA9IGZhbHNlO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWN0aW9ucy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgY29uc3QgYWN0aW9uID0gYWN0aW9uc1tpXTtcbiAgICAgICAgICAgIGlmIChhY3Rpb24gPT09IFB1c2hSdWxlQWN0aW9uTmFtZS5Ob3RpZnkpIHtcbiAgICAgICAgICAgICAgICBub3RpZnkgPSB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhY3Rpb24gPT09IFB1c2hSdWxlQWN0aW9uTmFtZS5Eb250Tm90aWZ5KSB7XG4gICAgICAgICAgICAgICAgbm90aWZ5ID0gZmFsc2U7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBhY3Rpb24gPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoYWN0aW9uLnNldF90d2VhayA9PT0gXCJzb3VuZFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHNvdW5kID0gYWN0aW9uLnZhbHVlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoYWN0aW9uLnNldF90d2VhayA9PT0gXCJoaWdobGlnaHRcIikge1xuICAgICAgICAgICAgICAgICAgICBoaWdobGlnaHQgPSBhY3Rpb24udmFsdWU7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gV2UgZG9uJ3QgdW5kZXJzdGFuZCB0aGlzIGtpbmQgb2YgdHdlYWssIHNvIGdpdmUgdXAuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gV2UgZG9uJ3QgdW5kZXJzdGFuZCB0aGlzIGtpbmQgb2YgYWN0aW9uLCBzbyBnaXZlIHVwLlxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGhpZ2hsaWdodCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBJZiBhIGhpZ2hsaWdodCB0d2VhayBpcyBtaXNzaW5nIGEgdmFsdWUgdGhlbiBpdCBkZWZhdWx0cyB0byB0cnVlLlxuICAgICAgICAgICAgaGlnaGxpZ2h0ID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJlc3VsdDogSUVuY29kZWRBY3Rpb25zID0geyBub3RpZnksIGhpZ2hsaWdodCB9O1xuICAgICAgICBpZiAoc291bmQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmVzdWx0LnNvdW5kID0gc291bmQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG4iXSwibWFwcGluZ3MiOiI7Ozs7OztBQWdCQSxJQUFBQSxVQUFBLEdBQUFDLE9BQUE7QUFoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQVVPLE1BQU1DLGlCQUFpQixDQUFDO0VBQzNCO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLE9BQWNDLGFBQWFBLENBQUNDLE1BQXVCLEVBQW9CO0lBQ25FLE1BQU1DLE1BQU0sR0FBR0QsTUFBTSxDQUFDQyxNQUFNO0lBQzVCLE1BQU1DLEtBQUssR0FBR0YsTUFBTSxDQUFDRSxLQUFLO0lBQzFCLE1BQU1DLFNBQVMsR0FBR0gsTUFBTSxDQUFDRyxTQUFTO0lBQ2xDLElBQUlGLE1BQU0sRUFBRTtNQUNSLE1BQU1HLE9BQXlCLEdBQUcsQ0FBQ0MsNkJBQWtCLENBQUNDLE1BQU0sQ0FBQztNQUM3RCxJQUFJSixLQUFLLEVBQUU7UUFDUEUsT0FBTyxDQUFDRyxJQUFJLENBQUM7VUFBRUMsU0FBUyxFQUFFLE9BQU87VUFBRUMsS0FBSyxFQUFFUDtRQUFNLENBQWUsQ0FBQztNQUNwRTtNQUNBLElBQUlDLFNBQVMsRUFBRTtRQUNYQyxPQUFPLENBQUNHLElBQUksQ0FBQztVQUFFQyxTQUFTLEVBQUU7UUFBWSxDQUFtQixDQUFDO01BQzlELENBQUMsTUFBTTtRQUNISixPQUFPLENBQUNHLElBQUksQ0FBQztVQUFFQyxTQUFTLEVBQUUsV0FBVztVQUFFQyxLQUFLLEVBQUU7UUFBTSxDQUFtQixDQUFDO01BQzVFO01BQ0EsT0FBT0wsT0FBTztJQUNsQixDQUFDLE1BQU07TUFDSCxPQUFPLENBQUNDLDZCQUFrQixDQUFDSyxVQUFVLENBQUM7SUFDMUM7RUFDSjs7RUFFQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxPQUFjQyxhQUFhQSxDQUFDUCxPQUF5QixFQUEwQjtJQUMzRSxJQUFJSCxNQUFNLEdBQUcsS0FBSztJQUNsQixJQUFJQyxLQUF5QjtJQUM3QixJQUFJQyxTQUE4QixHQUFHLEtBQUs7SUFFMUMsS0FBSyxJQUFJUyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdSLE9BQU8sQ0FBQ1MsTUFBTSxFQUFFLEVBQUVELENBQUMsRUFBRTtNQUNyQyxNQUFNWixNQUFNLEdBQUdJLE9BQU8sQ0FBQ1EsQ0FBQyxDQUFDO01BQ3pCLElBQUlaLE1BQU0sS0FBS0ssNkJBQWtCLENBQUNDLE1BQU0sRUFBRTtRQUN0Q0wsTUFBTSxHQUFHLElBQUk7TUFDakIsQ0FBQyxNQUFNLElBQUlELE1BQU0sS0FBS0ssNkJBQWtCLENBQUNLLFVBQVUsRUFBRTtRQUNqRFQsTUFBTSxHQUFHLEtBQUs7TUFDbEIsQ0FBQyxNQUFNLElBQUksT0FBT0QsTUFBTSxLQUFLLFFBQVEsRUFBRTtRQUNuQyxJQUFJQSxNQUFNLENBQUNRLFNBQVMsS0FBSyxPQUFPLEVBQUU7VUFDOUJOLEtBQUssR0FBR0YsTUFBTSxDQUFDUyxLQUFLO1FBQ3hCLENBQUMsTUFBTSxJQUFJVCxNQUFNLENBQUNRLFNBQVMsS0FBSyxXQUFXLEVBQUU7VUFDekNMLFNBQVMsR0FBR0gsTUFBTSxDQUFDUyxLQUFLO1FBQzVCLENBQUMsTUFBTTtVQUNIO1VBQ0EsT0FBTyxJQUFJO1FBQ2Y7TUFDSixDQUFDLE1BQU07UUFDSDtRQUNBLE9BQU8sSUFBSTtNQUNmO0lBQ0o7SUFFQSxJQUFJTixTQUFTLEtBQUtXLFNBQVMsRUFBRTtNQUN6QjtNQUNBWCxTQUFTLEdBQUcsSUFBSTtJQUNwQjtJQUVBLE1BQU1ZLE1BQXVCLEdBQUc7TUFBRWQsTUFBTTtNQUFFRTtJQUFVLENBQUM7SUFDckQsSUFBSUQsS0FBSyxLQUFLWSxTQUFTLEVBQUU7TUFDckJDLE1BQU0sQ0FBQ2IsS0FBSyxHQUFHQSxLQUFLO0lBQ3hCO0lBQ0EsT0FBT2EsTUFBTTtFQUNqQjtBQUNKO0FBQUNDLE9BQUEsQ0FBQWxCLGlCQUFBLEdBQUFBLGlCQUFBIn0=