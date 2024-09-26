"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.PermalinkParts = void 0;
/*
Copyright 2019, 2021 The Matrix.org Foundation C.I.C.

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
 * Interface for classes that actually produce permalinks (strings).
 * TODO: Convert this to a real TypeScript interface
 */
class PermalinkConstructor {
  forEvent(roomId, eventId) {
    let serverCandidates = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
    throw new Error("Not implemented");
  }
  forRoom(roomIdOrAlias) {
    let serverCandidates = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
    throw new Error("Not implemented");
  }
  forUser(userId) {
    throw new Error("Not implemented");
  }
  forEntity(entityId) {
    throw new Error("Not implemented");
  }
  isPermalinkHost(host) {
    throw new Error("Not implemented");
  }
  parsePermalink(fullUrl) {
    throw new Error("Not implemented");
  }
}

// Inspired by/Borrowed with permission from the matrix-bot-sdk:
// https://github.com/turt2live/matrix-js-bot-sdk/blob/7c4665c9a25c2c8e0fe4e509f2616505b5b66a1c/src/Permalinks.ts#L1-L6
exports.default = PermalinkConstructor;
class PermalinkParts {
  constructor(roomIdOrAlias, eventId, userId, viaServers) {
    this.roomIdOrAlias = roomIdOrAlias;
    this.eventId = eventId;
    this.userId = userId;
    this.viaServers = viaServers;
  }
  static forUser(userId) {
    return new PermalinkParts(null, null, userId, null);
  }
  static forRoom(roomIdOrAlias) {
    let viaServers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
    return new PermalinkParts(roomIdOrAlias, null, null, viaServers);
  }
  static forEvent(roomId, eventId) {
    let viaServers = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
    return new PermalinkParts(roomId, eventId, null, viaServers);
  }
  get primaryEntityId() {
    return this.roomIdOrAlias || this.userId;
  }
  get sigil() {
    return this.primaryEntityId?.[0] || "?";
  }
}
exports.PermalinkParts = PermalinkParts;
//# sourceMappingURL=PermalinkConstructor.js.map