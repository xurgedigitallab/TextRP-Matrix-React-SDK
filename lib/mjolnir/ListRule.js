"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RECOMMENDATION_BAN_TYPES = exports.RECOMMENDATION_BAN = exports.ListRule = void 0;
exports.recommendationToStable = recommendationToStable;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _MatrixGlob = require("../utils/MatrixGlob");
/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

// Inspiration largely taken from Mjolnir itself

const RECOMMENDATION_BAN = "m.ban";
exports.RECOMMENDATION_BAN = RECOMMENDATION_BAN;
const RECOMMENDATION_BAN_TYPES = [RECOMMENDATION_BAN, "org.matrix.mjolnir.ban"];
exports.RECOMMENDATION_BAN_TYPES = RECOMMENDATION_BAN_TYPES;
function recommendationToStable(recommendation) {
  let unstable = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
  if (RECOMMENDATION_BAN_TYPES.includes(recommendation)) {
    return unstable ? RECOMMENDATION_BAN_TYPES[RECOMMENDATION_BAN_TYPES.length - 1] : RECOMMENDATION_BAN;
  }
  return null;
}
class ListRule {
  constructor(entity, action, reason, kind) {
    (0, _defineProperty2.default)(this, "_glob", void 0);
    (0, _defineProperty2.default)(this, "_entity", void 0);
    (0, _defineProperty2.default)(this, "_action", void 0);
    (0, _defineProperty2.default)(this, "_reason", void 0);
    (0, _defineProperty2.default)(this, "_kind", void 0);
    this._glob = new _MatrixGlob.MatrixGlob(entity);
    this._entity = entity;
    this._action = recommendationToStable(action, false);
    this._reason = reason;
    this._kind = kind;
  }
  get entity() {
    return this._entity;
  }
  get reason() {
    return this._reason;
  }
  get kind() {
    return this._kind;
  }
  get recommendation() {
    return this._action;
  }
  isMatch(entity) {
    return this._glob.test(entity);
  }
}
exports.ListRule = ListRule;
//# sourceMappingURL=ListRule.js.map