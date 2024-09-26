"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WidgetType = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
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

// TODO: Move to matrix-widget-api
class WidgetType {
  constructor(preferred, legacy) {
    this.preferred = preferred;
    this.legacy = legacy;
  }
  matches(type) {
    return type === this.preferred || type === this.legacy;
  }
  static fromString(type) {
    // First try and match it against something we're already aware of
    const known = Object.values(WidgetType).filter(v => v instanceof WidgetType);
    const knownMatch = known.find(w => w.matches(type));
    if (knownMatch) return knownMatch;

    // If that fails, invent a new widget type
    return new WidgetType(type, type);
  }
}
exports.WidgetType = WidgetType;
(0, _defineProperty2.default)(WidgetType, "JITSI", new WidgetType("m.jitsi", "jitsi"));
(0, _defineProperty2.default)(WidgetType, "STICKERPICKER", new WidgetType("m.stickerpicker", "m.stickerpicker"));
(0, _defineProperty2.default)(WidgetType, "INTEGRATION_MANAGER", new WidgetType("m.integration_manager", "m.integration_manager"));
(0, _defineProperty2.default)(WidgetType, "CUSTOM", new WidgetType("m.custom", "m.custom"));
//# sourceMappingURL=WidgetType.js.map