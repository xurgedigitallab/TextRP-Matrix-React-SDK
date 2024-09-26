"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.USER_RULE_TYPES = exports.SERVER_RULE_TYPES = exports.RULE_USER = exports.RULE_SERVER = exports.RULE_ROOM = exports.ROOM_RULE_TYPES = exports.BanList = exports.ALL_RULE_TYPES = void 0;
exports.ruleTypeToStable = ruleTypeToStable;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _ListRule = require("./ListRule");
var _MatrixClientPeg = require("../MatrixClientPeg");
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

const RULE_USER = "m.policy.rule.user";
exports.RULE_USER = RULE_USER;
const RULE_ROOM = "m.policy.rule.room";
exports.RULE_ROOM = RULE_ROOM;
const RULE_SERVER = "m.policy.rule.server";

// m.room.* events are legacy from when MSC2313 changed to m.policy.* last minute.
exports.RULE_SERVER = RULE_SERVER;
const USER_RULE_TYPES = [RULE_USER, "m.room.rule.user", "org.matrix.mjolnir.rule.user"];
exports.USER_RULE_TYPES = USER_RULE_TYPES;
const ROOM_RULE_TYPES = [RULE_ROOM, "m.room.rule.room", "org.matrix.mjolnir.rule.room"];
exports.ROOM_RULE_TYPES = ROOM_RULE_TYPES;
const SERVER_RULE_TYPES = [RULE_SERVER, "m.room.rule.server", "org.matrix.mjolnir.rule.server"];
exports.SERVER_RULE_TYPES = SERVER_RULE_TYPES;
const ALL_RULE_TYPES = [...USER_RULE_TYPES, ...ROOM_RULE_TYPES, ...SERVER_RULE_TYPES];
exports.ALL_RULE_TYPES = ALL_RULE_TYPES;
function ruleTypeToStable(rule) {
  if (USER_RULE_TYPES.includes(rule)) {
    return RULE_USER;
  }
  if (ROOM_RULE_TYPES.includes(rule)) {
    return RULE_ROOM;
  }
  if (SERVER_RULE_TYPES.includes(rule)) {
    return RULE_SERVER;
  }
  return null;
}
class BanList {
  constructor(roomId) {
    (0, _defineProperty2.default)(this, "_rules", []);
    (0, _defineProperty2.default)(this, "_roomId", void 0);
    this._roomId = roomId;
    this.updateList();
  }
  get roomId() {
    return this._roomId;
  }
  get serverRules() {
    return this._rules.filter(r => r.kind === RULE_SERVER);
  }
  get userRules() {
    return this._rules.filter(r => r.kind === RULE_USER);
  }
  get roomRules() {
    return this._rules.filter(r => r.kind === RULE_ROOM);
  }
  async banEntity(kind, entity, reason) {
    const type = ruleTypeToStable(kind);
    if (!type) return; // unknown rule type
    await _MatrixClientPeg.MatrixClientPeg.get().sendStateEvent(this._roomId, type, {
      entity: entity,
      reason: reason,
      recommendation: (0, _ListRule.recommendationToStable)(_ListRule.RECOMMENDATION_BAN, true)
    }, "rule:" + entity);
    this._rules.push(new _ListRule.ListRule(entity, _ListRule.RECOMMENDATION_BAN, reason, type));
  }
  async unbanEntity(kind, entity) {
    const type = ruleTypeToStable(kind);
    if (!type) return; // unknown rule type
    // Empty state event is effectively deleting it.
    await _MatrixClientPeg.MatrixClientPeg.get().sendStateEvent(this._roomId, type, {}, "rule:" + entity);
    this._rules = this._rules.filter(r => {
      if (r.kind !== ruleTypeToStable(kind)) return true;
      if (r.entity !== entity) return true;
      return false; // we just deleted this rule
    });
  }

  updateList() {
    this._rules = [];
    const room = _MatrixClientPeg.MatrixClientPeg.get().getRoom(this._roomId);
    if (!room) return;
    for (const eventType of ALL_RULE_TYPES) {
      const events = room.currentState.getStateEvents(eventType);
      for (const ev of events) {
        if (!ev.getStateKey()) continue;
        const kind = ruleTypeToStable(eventType);
        if (!kind) continue; // unknown type

        const entity = ev.getContent()["entity"];
        const recommendation = ev.getContent()["recommendation"];
        const reason = ev.getContent()["reason"];
        if (!entity || !recommendation || !reason) continue;
        this._rules.push(new _ListRule.ListRule(entity, recommendation, reason, kind));
      }
    }
  }
}
exports.BanList = BanList;
//# sourceMappingURL=BanList.js.map