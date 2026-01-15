"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.looksValid = looksValid;
/*
Copyright 2016 OpenMarket Ltd
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

// Regexp based on Simpler Version from https://gist.github.com/gregseth/5582254 - matches RFC2822
const EMAIL_ADDRESS_REGEX = new RegExp("^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*" +
// localpart
"@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$", "i");
function looksValid(email) {
  // short circuit regex with this basic check
  if (email.indexOf("@") < 1) return false;
  return EMAIL_ADDRESS_REGEX.test(email);
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJFTUFJTF9BRERSRVNTX1JFR0VYIiwiUmVnRXhwIiwibG9va3NWYWxpZCIsImVtYWlsIiwiaW5kZXhPZiIsInRlc3QiXSwic291cmNlcyI6WyIuLi9zcmMvZW1haWwudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbkNvcHlyaWdodCAyMDE2IE9wZW5NYXJrZXQgTHRkXG5Db3B5cmlnaHQgMjAyMyBUaGUgTWF0cml4Lm9yZyBGb3VuZGF0aW9uIEMuSS5DLlxuXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiovXG5cbi8vIFJlZ2V4cCBiYXNlZCBvbiBTaW1wbGVyIFZlcnNpb24gZnJvbSBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9ncmVnc2V0aC81NTgyMjU0IC0gbWF0Y2hlcyBSRkMyODIyXG5jb25zdCBFTUFJTF9BRERSRVNTX1JFR0VYID0gbmV3IFJlZ0V4cChcbiAgICBcIl5bYS16MC05ISMkJSYnKisvPT9eX2B7fH1+LV0rKD86XFxcXC5bYS16MC05ISMkJSYnKisvPT9eX2B7fH1+LV0rKSpcIiArIC8vIGxvY2FscGFydFxuICAgICAgICBcIkAoPzpbYS16MC05XSg/OlthLXowLTktXSpbYS16MC05XSk/XFxcXC4pK1thLXowLTldKD86W2EtejAtOS1dKlthLXowLTldKT8kXCIsXG4gICAgXCJpXCIsXG4pO1xuXG5leHBvcnQgZnVuY3Rpb24gbG9va3NWYWxpZChlbWFpbDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgLy8gc2hvcnQgY2lyY3VpdCByZWdleCB3aXRoIHRoaXMgYmFzaWMgY2hlY2tcbiAgICBpZiAoZW1haWwuaW5kZXhPZihcIkBcIikgPCAxKSByZXR1cm4gZmFsc2U7XG5cbiAgICByZXR1cm4gRU1BSUxfQUREUkVTU19SRUdFWC50ZXN0KGVtYWlsKTtcbn1cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSxNQUFNQSxtQkFBbUIsR0FBRyxJQUFJQyxNQUFNLENBQ2xDLG1FQUFtRTtBQUFHO0FBQ2xFLDBFQUEwRSxFQUM5RSxHQUNKLENBQUM7QUFFTSxTQUFTQyxVQUFVQSxDQUFDQyxLQUFhLEVBQVc7RUFDL0M7RUFDQSxJQUFJQSxLQUFLLENBQUNDLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsT0FBTyxLQUFLO0VBRXhDLE9BQU9KLG1CQUFtQixDQUFDSyxJQUFJLENBQUNGLEtBQUssQ0FBQztBQUMxQyJ9