"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.normalizeWheelEvent = normalizeWheelEvent;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
const _excluded = ["deltaMode", "deltaX", "deltaY", "deltaZ"];
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
/*
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

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
 * Different browsers use different deltaModes. This causes different behaviour.
 * To avoid that we use this function to convert any event to pixels.
 * @param {WheelEvent} event to normalize
 * @returns {WheelEvent} normalized event event
 */
function normalizeWheelEvent(_ref) {
  let {
      deltaMode,
      deltaX,
      deltaY,
      deltaZ
    } = _ref,
    event = (0, _objectWithoutProperties2.default)(_ref, _excluded);
  const LINE_HEIGHT = 18;
  if (deltaMode === 1) {
    // Units are lines
    deltaX *= LINE_HEIGHT;
    deltaY *= LINE_HEIGHT;
    deltaZ *= LINE_HEIGHT;
  }
  return new WheelEvent("syntheticWheel", _objectSpread({
    deltaMode: 0,
    deltaY,
    deltaX,
    deltaZ
  }, event));
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJub3JtYWxpemVXaGVlbEV2ZW50IiwiX3JlZiIsImRlbHRhTW9kZSIsImRlbHRhWCIsImRlbHRhWSIsImRlbHRhWiIsImV2ZW50IiwiX29iamVjdFdpdGhvdXRQcm9wZXJ0aWVzMiIsImRlZmF1bHQiLCJfZXhjbHVkZWQiLCJMSU5FX0hFSUdIVCIsIldoZWVsRXZlbnQiLCJfb2JqZWN0U3ByZWFkIl0sInNvdXJjZXMiOlsiLi4vLi4vc3JjL3V0aWxzL01vdXNlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qXG5Db3B5cmlnaHQgMjAyMSDFoGltb24gQnJhbmRuZXIgPHNpbW9uLmJyYS5hZ0BnbWFpbC5jb20+XG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuKi9cblxuLyoqXG4gKiBEaWZmZXJlbnQgYnJvd3NlcnMgdXNlIGRpZmZlcmVudCBkZWx0YU1vZGVzLiBUaGlzIGNhdXNlcyBkaWZmZXJlbnQgYmVoYXZpb3VyLlxuICogVG8gYXZvaWQgdGhhdCB3ZSB1c2UgdGhpcyBmdW5jdGlvbiB0byBjb252ZXJ0IGFueSBldmVudCB0byBwaXhlbHMuXG4gKiBAcGFyYW0ge1doZWVsRXZlbnR9IGV2ZW50IHRvIG5vcm1hbGl6ZVxuICogQHJldHVybnMge1doZWVsRXZlbnR9IG5vcm1hbGl6ZWQgZXZlbnQgZXZlbnRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZVdoZWVsRXZlbnQoeyBkZWx0YU1vZGUsIGRlbHRhWCwgZGVsdGFZLCBkZWx0YVosIC4uLmV2ZW50IH06IFdoZWVsRXZlbnQpOiBXaGVlbEV2ZW50IHtcbiAgICBjb25zdCBMSU5FX0hFSUdIVCA9IDE4O1xuXG4gICAgaWYgKGRlbHRhTW9kZSA9PT0gMSkge1xuICAgICAgICAvLyBVbml0cyBhcmUgbGluZXNcbiAgICAgICAgZGVsdGFYICo9IExJTkVfSEVJR0hUO1xuICAgICAgICBkZWx0YVkgKj0gTElORV9IRUlHSFQ7XG4gICAgICAgIGRlbHRhWiAqPSBMSU5FX0hFSUdIVDtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFdoZWVsRXZlbnQoXCJzeW50aGV0aWNXaGVlbFwiLCB7XG4gICAgICAgIGRlbHRhTW9kZTogMCxcbiAgICAgICAgZGVsdGFZLFxuICAgICAgICBkZWx0YVgsXG4gICAgICAgIGRlbHRhWixcbiAgICAgICAgLi4uZXZlbnQsXG4gICAgfSk7XG59XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxTQUFTQSxtQkFBbUJBLENBQUFDLElBQUEsRUFBMEU7RUFBQSxJQUF6RTtNQUFFQyxTQUFTO01BQUVDLE1BQU07TUFBRUMsTUFBTTtNQUFFQztJQUE2QixDQUFDLEdBQUFKLElBQUE7SUFBbkJLLEtBQUssT0FBQUMseUJBQUEsQ0FBQUMsT0FBQSxFQUFBUCxJQUFBLEVBQUFRLFNBQUE7RUFDN0UsTUFBTUMsV0FBVyxHQUFHLEVBQUU7RUFFdEIsSUFBSVIsU0FBUyxLQUFLLENBQUMsRUFBRTtJQUNqQjtJQUNBQyxNQUFNLElBQUlPLFdBQVc7SUFDckJOLE1BQU0sSUFBSU0sV0FBVztJQUNyQkwsTUFBTSxJQUFJSyxXQUFXO0VBQ3pCO0VBRUEsT0FBTyxJQUFJQyxVQUFVLENBQUMsZ0JBQWdCLEVBQUFDLGFBQUE7SUFDbENWLFNBQVMsRUFBRSxDQUFDO0lBQ1pFLE1BQU07SUFDTkQsTUFBTTtJQUNORTtFQUFNLEdBQ0hDLEtBQUssQ0FDWCxDQUFDO0FBQ04ifQ==