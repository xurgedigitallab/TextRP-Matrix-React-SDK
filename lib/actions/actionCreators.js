"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.asyncAction = asyncAction;
var _payloads = require("../dispatcher/payloads");
/*
Copyright 2017 New Vector Ltd
Copyright 2020 The Matrix.org Foundation C.I.C.

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
 * Create an action thunk that will dispatch actions indicating the current
 * status of the Promise returned by fn.
 *
 * @param {string} id the id to give the dispatched actions. This is given a
 *                    suffix determining whether it is pending, successful or
 *                    a failure.
 * @param {function} fn a function that returns a Promise.
 * @param {function?} pendingFn a function that returns an object to assign
 *                              to the `request` key of the ${id}.pending
 *                              payload.
 * @returns {AsyncActionPayload} an async action payload. Includes a function
 *                     that uses its single argument as a dispatch function
 *                     to dispatch the following actions:
 *                         `${id}.pending` and either
 *                         `${id}.success` or
 *                         `${id}.failure`.
 *
 *                     The shape of each are:
 *                     { action: '${id}.pending', request }
 *                     { action: '${id}.success', result }
 *                     { action: '${id}.failure', err }
 *
 *                     where `request` is returned by `pendingFn` and
 *                     result is the result of the promise returned by
 *                     `fn`.
 */
function asyncAction(id, fn, pendingFn) {
  const helper = dispatch => {
    dispatch({
      action: id + ".pending",
      request: typeof pendingFn === "function" ? pendingFn() : undefined
    });
    fn().then(result => {
      dispatch({
        action: id + ".success",
        result
      });
    }).catch(err => {
      dispatch({
        action: id + ".failure",
        err
      });
    });
  };
  return new _payloads.AsyncActionPayload(helper);
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfcGF5bG9hZHMiLCJyZXF1aXJlIiwiYXN5bmNBY3Rpb24iLCJpZCIsImZuIiwicGVuZGluZ0ZuIiwiaGVscGVyIiwiZGlzcGF0Y2giLCJhY3Rpb24iLCJyZXF1ZXN0IiwidW5kZWZpbmVkIiwidGhlbiIsInJlc3VsdCIsImNhdGNoIiwiZXJyIiwiQXN5bmNBY3Rpb25QYXlsb2FkIl0sInNvdXJjZXMiOlsiLi4vLi4vc3JjL2FjdGlvbnMvYWN0aW9uQ3JlYXRvcnMudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbkNvcHlyaWdodCAyMDE3IE5ldyBWZWN0b3IgTHRkXG5Db3B5cmlnaHQgMjAyMCBUaGUgTWF0cml4Lm9yZyBGb3VuZGF0aW9uIEMuSS5DLlxuXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiovXG5cbmltcG9ydCB7IEFzeW5jQWN0aW9uRm4sIEFzeW5jQWN0aW9uUGF5bG9hZCB9IGZyb20gXCIuLi9kaXNwYXRjaGVyL3BheWxvYWRzXCI7XG5cbi8qKlxuICogQ3JlYXRlIGFuIGFjdGlvbiB0aHVuayB0aGF0IHdpbGwgZGlzcGF0Y2ggYWN0aW9ucyBpbmRpY2F0aW5nIHRoZSBjdXJyZW50XG4gKiBzdGF0dXMgb2YgdGhlIFByb21pc2UgcmV0dXJuZWQgYnkgZm4uXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IGlkIHRoZSBpZCB0byBnaXZlIHRoZSBkaXNwYXRjaGVkIGFjdGlvbnMuIFRoaXMgaXMgZ2l2ZW4gYVxuICogICAgICAgICAgICAgICAgICAgIHN1ZmZpeCBkZXRlcm1pbmluZyB3aGV0aGVyIGl0IGlzIHBlbmRpbmcsIHN1Y2Nlc3NmdWwgb3JcbiAqICAgICAgICAgICAgICAgICAgICBhIGZhaWx1cmUuXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBmbiBhIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIFByb21pc2UuXG4gKiBAcGFyYW0ge2Z1bmN0aW9uP30gcGVuZGluZ0ZuIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGFuIG9iamVjdCB0byBhc3NpZ25cbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdG8gdGhlIGByZXF1ZXN0YCBrZXkgb2YgdGhlICR7aWR9LnBlbmRpbmdcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGF5bG9hZC5cbiAqIEByZXR1cm5zIHtBc3luY0FjdGlvblBheWxvYWR9IGFuIGFzeW5jIGFjdGlvbiBwYXlsb2FkLiBJbmNsdWRlcyBhIGZ1bmN0aW9uXG4gKiAgICAgICAgICAgICAgICAgICAgIHRoYXQgdXNlcyBpdHMgc2luZ2xlIGFyZ3VtZW50IGFzIGEgZGlzcGF0Y2ggZnVuY3Rpb25cbiAqICAgICAgICAgICAgICAgICAgICAgdG8gZGlzcGF0Y2ggdGhlIGZvbGxvd2luZyBhY3Rpb25zOlxuICogICAgICAgICAgICAgICAgICAgICAgICAgYCR7aWR9LnBlbmRpbmdgIGFuZCBlaXRoZXJcbiAqICAgICAgICAgICAgICAgICAgICAgICAgIGAke2lkfS5zdWNjZXNzYCBvclxuICogICAgICAgICAgICAgICAgICAgICAgICAgYCR7aWR9LmZhaWx1cmVgLlxuICpcbiAqICAgICAgICAgICAgICAgICAgICAgVGhlIHNoYXBlIG9mIGVhY2ggYXJlOlxuICogICAgICAgICAgICAgICAgICAgICB7IGFjdGlvbjogJyR7aWR9LnBlbmRpbmcnLCByZXF1ZXN0IH1cbiAqICAgICAgICAgICAgICAgICAgICAgeyBhY3Rpb246ICcke2lkfS5zdWNjZXNzJywgcmVzdWx0IH1cbiAqICAgICAgICAgICAgICAgICAgICAgeyBhY3Rpb246ICcke2lkfS5mYWlsdXJlJywgZXJyIH1cbiAqXG4gKiAgICAgICAgICAgICAgICAgICAgIHdoZXJlIGByZXF1ZXN0YCBpcyByZXR1cm5lZCBieSBgcGVuZGluZ0ZuYCBhbmRcbiAqICAgICAgICAgICAgICAgICAgICAgcmVzdWx0IGlzIHRoZSByZXN1bHQgb2YgdGhlIHByb21pc2UgcmV0dXJuZWQgYnlcbiAqICAgICAgICAgICAgICAgICAgICAgYGZuYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzeW5jQWN0aW9uKGlkOiBzdHJpbmcsIGZuOiAoKSA9PiBQcm9taXNlPGFueT4sIHBlbmRpbmdGbjogKCkgPT4gYW55IHwgbnVsbCk6IEFzeW5jQWN0aW9uUGF5bG9hZCB7XG4gICAgY29uc3QgaGVscGVyOiBBc3luY0FjdGlvbkZuID0gKGRpc3BhdGNoKSA9PiB7XG4gICAgICAgIGRpc3BhdGNoKHtcbiAgICAgICAgICAgIGFjdGlvbjogaWQgKyBcIi5wZW5kaW5nXCIsXG4gICAgICAgICAgICByZXF1ZXN0OiB0eXBlb2YgcGVuZGluZ0ZuID09PSBcImZ1bmN0aW9uXCIgPyBwZW5kaW5nRm4oKSA6IHVuZGVmaW5lZCxcbiAgICAgICAgfSk7XG4gICAgICAgIGZuKClcbiAgICAgICAgICAgIC50aGVuKChyZXN1bHQpID0+IHtcbiAgICAgICAgICAgICAgICBkaXNwYXRjaCh7IGFjdGlvbjogaWQgKyBcIi5zdWNjZXNzXCIsIHJlc3VsdCB9KTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgICAgICAgIGRpc3BhdGNoKHsgYWN0aW9uOiBpZCArIFwiLmZhaWx1cmVcIiwgZXJyIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgfTtcbiAgICByZXR1cm4gbmV3IEFzeW5jQWN0aW9uUGF5bG9hZChoZWxwZXIpO1xufVxuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFpQkEsSUFBQUEsU0FBQSxHQUFBQyxPQUFBO0FBakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLFNBQVNDLFdBQVdBLENBQUNDLEVBQVUsRUFBRUMsRUFBc0IsRUFBRUMsU0FBMkIsRUFBc0I7RUFDN0csTUFBTUMsTUFBcUIsR0FBSUMsUUFBUSxJQUFLO0lBQ3hDQSxRQUFRLENBQUM7TUFDTEMsTUFBTSxFQUFFTCxFQUFFLEdBQUcsVUFBVTtNQUN2Qk0sT0FBTyxFQUFFLE9BQU9KLFNBQVMsS0FBSyxVQUFVLEdBQUdBLFNBQVMsQ0FBQyxDQUFDLEdBQUdLO0lBQzdELENBQUMsQ0FBQztJQUNGTixFQUFFLENBQUMsQ0FBQyxDQUNDTyxJQUFJLENBQUVDLE1BQU0sSUFBSztNQUNkTCxRQUFRLENBQUM7UUFBRUMsTUFBTSxFQUFFTCxFQUFFLEdBQUcsVUFBVTtRQUFFUztNQUFPLENBQUMsQ0FBQztJQUNqRCxDQUFDLENBQUMsQ0FDREMsS0FBSyxDQUFFQyxHQUFHLElBQUs7TUFDWlAsUUFBUSxDQUFDO1FBQUVDLE1BQU0sRUFBRUwsRUFBRSxHQUFHLFVBQVU7UUFBRVc7TUFBSSxDQUFDLENBQUM7SUFDOUMsQ0FBQyxDQUFDO0VBQ1YsQ0FBQztFQUNELE9BQU8sSUFBSUMsNEJBQWtCLENBQUNULE1BQU0sQ0FBQztBQUN6QyJ9