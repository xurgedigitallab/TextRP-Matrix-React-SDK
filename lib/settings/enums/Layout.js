"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Layout = void 0;
/*
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>
Copyright 2021 Quirin Götz <codeworks@supercable.onl>

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
/* TODO: This should be later reworked into something more generic */
let Layout = /*#__PURE__*/function (Layout) {
  Layout["IRC"] = "irc";
  Layout["Group"] = "group";
  Layout["Bubble"] = "bubble";
  return Layout;
}({});
exports.Layout = Layout;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJMYXlvdXQiLCJleHBvcnRzIl0sInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3NldHRpbmdzL2VudW1zL0xheW91dC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuQ29weXJpZ2h0IDIwMjEgxaBpbW9uIEJyYW5kbmVyIDxzaW1vbi5icmEuYWdAZ21haWwuY29tPlxuQ29weXJpZ2h0IDIwMjEgUXVpcmluIEfDtnR6IDxjb2Rld29ya3NAc3VwZXJjYWJsZS5vbmw+XG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuKi9cblxuLyogVE9ETzogVGhpcyBzaG91bGQgYmUgbGF0ZXIgcmV3b3JrZWQgaW50byBzb21ldGhpbmcgbW9yZSBnZW5lcmljICovXG5leHBvcnQgZW51bSBMYXlvdXQge1xuICAgIElSQyA9IFwiaXJjXCIsXG4gICAgR3JvdXAgPSBcImdyb3VwXCIsXG4gICAgQnViYmxlID0gXCJidWJibGVcIixcbn1cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFFQTtBQUFBLElBQ1lBLE1BQU0sMEJBQU5BLE1BQU07RUFBTkEsTUFBTTtFQUFOQSxNQUFNO0VBQU5BLE1BQU07RUFBQSxPQUFOQSxNQUFNO0FBQUE7QUFBQUMsT0FBQSxDQUFBRCxNQUFBLEdBQUFBLE1BQUEifQ==