"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _PermalinkConstructor = _interopRequireWildcard(require("./PermalinkConstructor"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
 * Generates matrix: scheme permalinks
 */
class MatrixSchemePermalinkConstructor extends _PermalinkConstructor.default {
  constructor() {
    super();
  }
  encodeEntity(entity) {
    if (entity[0] === "!") {
      return `roomid/${entity.slice(1)}`;
    } else if (entity[0] === "#") {
      return `r/${entity.slice(1)}`;
    } else if (entity[0] === "@") {
      return `u/${entity.slice(1)}`;
    } else if (entity[0] === "$") {
      return `e/${entity.slice(1)}`;
    }
    throw new Error("Cannot encode entity: " + entity);
  }
  forEvent(roomId, eventId, serverCandidates) {
    return `matrix:${this.encodeEntity(roomId)}` + `/${this.encodeEntity(eventId)}${this.encodeServerCandidates(serverCandidates)}`;
  }
  forRoom(roomIdOrAlias, serverCandidates) {
    return `matrix:${this.encodeEntity(roomIdOrAlias)}${this.encodeServerCandidates(serverCandidates)}`;
  }
  forUser(userId) {
    return `matrix:${this.encodeEntity(userId)}`;
  }
  forEntity(entityId) {
    return `matrix:${this.encodeEntity(entityId)}`;
  }
  isPermalinkHost(testHost) {
    // TODO: Change API signature to accept the URL for checking
    return testHost === "";
  }
  encodeServerCandidates(candidates) {
    if (!candidates || candidates.length === 0) return "";
    return `?via=${candidates.map(c => encodeURIComponent(c)).join("&via=")}`;
  }
  parsePermalink(fullUrl) {
    if (!fullUrl || !fullUrl.startsWith("matrix:")) {
      throw new Error("Does not appear to be a permalink");
    }
    const url = new URL(fullUrl);
    const parts = url.pathname.split("/");
    const identifier = parts[0];
    const entityNoSigil = parts[1];
    if (identifier === "u") {
      // Probably a user, no further parsing needed.
      return _PermalinkConstructor.PermalinkParts.forUser(`@${entityNoSigil}`);
    } else if (identifier === "r" || identifier === "roomid") {
      const sigil = identifier === "r" ? "#" : "!";
      if (parts.length === 2) {
        // room without event permalink
        const [roomId, query = ""] = entityNoSigil.split("?");
        const via = query.split(/&?via=/g).filter(p => !!p);
        return _PermalinkConstructor.PermalinkParts.forRoom(`${sigil}${roomId}`, via);
      }
      if (parts[2] === "e") {
        // event permalink
        const eventIdAndQuery = parts.length > 3 ? parts.slice(3).join("/") : "";
        const [eventId, query = ""] = eventIdAndQuery.split("?");
        const via = query.split(/&?via=/g).filter(p => !!p);
        return _PermalinkConstructor.PermalinkParts.forEvent(`${sigil}${entityNoSigil}`, `$${eventId}`, via);
      }
      throw new Error("Faulty room permalink");
    } else {
      throw new Error("Unknown entity type in permalink");
    }
  }
}
exports.default = MatrixSchemePermalinkConstructor;
//# sourceMappingURL=MatrixSchemePermalinkConstructor.js.map