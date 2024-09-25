"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _events = _interopRequireDefault(require("events"));
var _rfc = require("rfc4648");
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; } /*
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
// Dev note: the interface is split in two so we don't have to disable the
// linter across the whole project.
// Any data about the room that would normally come from the homeserver
// but has been passed out-of-band, eg. the room name and avatar URL
// from an email invite (a workaround for the fact that we can't
// get this information from the HS using an email invite).
const STORAGE_PREFIX = "mx_threepid_invite_";
class ThreepidInviteStore extends _events.default {
  static get instance() {
    if (!ThreepidInviteStore._instance) {
      ThreepidInviteStore._instance = new ThreepidInviteStore();
    }
    return ThreepidInviteStore._instance;
  }
  storeInvite(roomId, wireInvite) {
    const invite = _objectSpread({
      roomId
    }, wireInvite);
    const id = this.generateIdOf(invite);
    localStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(invite));
    return this.translateInvite(invite);
  }
  getWireInvites() {
    const results = [];
    for (let i = 0; i < localStorage.length; i++) {
      const keyName = localStorage.key(i);
      if (!keyName?.startsWith(STORAGE_PREFIX)) continue;
      try {
        results.push(JSON.parse(localStorage.getItem(keyName)));
      } catch (e) {
        console.warn("Failed to parse 3pid invite", e);
      }
    }
    return results;
  }
  getInvites() {
    return this.getWireInvites().map(i => this.translateInvite(i));
  }

  // Currently Element can only handle one invite at a time, so handle that
  pickBestInvite() {
    return this.getInvites()[0];
  }
  resolveInvite(invite) {
    localStorage.removeItem(`${STORAGE_PREFIX}${invite.id}`);
  }
  generateIdOf(persisted) {
    // Use a consistent "hash" to form an ID.
    return _rfc.base32.stringify(Buffer.from(JSON.stringify(persisted)));
  }
  translateInvite(persisted) {
    return {
      id: this.generateIdOf(persisted),
      roomId: persisted.roomId,
      toEmail: persisted.email,
      signUrl: persisted.signurl,
      roomName: persisted.room_name,
      roomAvatarUrl: persisted.room_avatar_url,
      inviterName: persisted.inviter_name
    };
  }
  translateToWireFormat(invite) {
    return {
      email: invite.toEmail,
      signurl: invite.signUrl,
      room_name: invite.roomName,
      room_avatar_url: invite.roomAvatarUrl,
      inviter_name: invite.inviterName
    };
  }
}
exports.default = ThreepidInviteStore;
(0, _defineProperty2.default)(ThreepidInviteStore, "_instance", void 0);
//# sourceMappingURL=ThreepidInviteStore.js.map