"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SettingLevel = void 0;
/*
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
 * Represents the various setting levels supported by the SettingsStore.
 */
let SettingLevel = /*#__PURE__*/function (SettingLevel) {
  SettingLevel["DEVICE"] = "device";
  SettingLevel["ROOM_DEVICE"] = "room-device";
  SettingLevel["ROOM_ACCOUNT"] = "room-account";
  SettingLevel["ACCOUNT"] = "account";
  SettingLevel["ROOM"] = "room";
  SettingLevel["PLATFORM"] = "platform";
  SettingLevel["CONFIG"] = "config";
  SettingLevel["DEFAULT"] = "default";
  return SettingLevel;
}({});
exports.SettingLevel = SettingLevel;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJTZXR0aW5nTGV2ZWwiLCJleHBvcnRzIl0sInNvdXJjZXMiOlsiLi4vLi4vc3JjL3NldHRpbmdzL1NldHRpbmdMZXZlbC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuQ29weXJpZ2h0IDIwMjAgVGhlIE1hdHJpeC5vcmcgRm91bmRhdGlvbiBDLkkuQy5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4qL1xuXG4vKipcbiAqIFJlcHJlc2VudHMgdGhlIHZhcmlvdXMgc2V0dGluZyBsZXZlbHMgc3VwcG9ydGVkIGJ5IHRoZSBTZXR0aW5nc1N0b3JlLlxuICovXG5leHBvcnQgZW51bSBTZXR0aW5nTGV2ZWwge1xuICAgIC8vIFRPRE86IFtUU10gRm9sbG93IG5hbWluZyBjb252ZW50aW9uXG4gICAgREVWSUNFID0gXCJkZXZpY2VcIixcbiAgICBST09NX0RFVklDRSA9IFwicm9vbS1kZXZpY2VcIixcbiAgICBST09NX0FDQ09VTlQgPSBcInJvb20tYWNjb3VudFwiLFxuICAgIEFDQ09VTlQgPSBcImFjY291bnRcIixcbiAgICBST09NID0gXCJyb29tXCIsXG4gICAgUExBVEZPUk0gPSBcInBsYXRmb3JtXCIsXG4gICAgQ09ORklHID0gXCJjb25maWdcIixcbiAgICBERUZBVUxUID0gXCJkZWZhdWx0XCIsXG59XG4iXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUVBO0FBQ0E7QUFDQTtBQUZBLElBR1lBLFlBQVksMEJBQVpBLFlBQVk7RUFBWkEsWUFBWTtFQUFaQSxZQUFZO0VBQVpBLFlBQVk7RUFBWkEsWUFBWTtFQUFaQSxZQUFZO0VBQVpBLFlBQVk7RUFBWkEsWUFBWTtFQUFaQSxZQUFZO0VBQUEsT0FBWkEsWUFBWTtBQUFBO0FBQUFDLE9BQUEsQ0FBQUQsWUFBQSxHQUFBQSxZQUFBIn0=