"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.calculateRoomVia = exports.RoomPermalinkCreator = void 0;
exports.getHostnameFromMatrixServerName = getHostnameFromMatrixServerName;
exports.getPrimaryPermalinkEntity = getPrimaryPermalinkEntity;
exports.getServerName = getServerName;
exports.isPermalinkHost = isPermalinkHost;
exports.makeGenericPermalink = makeGenericPermalink;
exports.makeRoomPermalink = makeRoomPermalink;
exports.makeUserPermalink = makeUserPermalink;
exports.parsePermalink = parsePermalink;
exports.tryTransformEntityToPermalink = tryTransformEntityToPermalink;
exports.tryTransformPermalinkToLocalHref = tryTransformPermalinkToLocalHref;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _isIp = _interopRequireDefault(require("is-ip"));
var utils = _interopRequireWildcard(require("matrix-js-sdk/src/utils"));
var _logger = require("matrix-js-sdk/src/logger");
var _roomState = require("matrix-js-sdk/src/models/room-state");
var _event = require("matrix-js-sdk/src/@types/event");
var _MatrixToPermalinkConstructor = _interopRequireWildcard(require("./MatrixToPermalinkConstructor"));
var _ElementPermalinkConstructor = _interopRequireDefault(require("./ElementPermalinkConstructor"));
var _SdkConfig = _interopRequireDefault(require("../../SdkConfig"));
var _linkifyMatrix = require("../../linkify-matrix");
var _MatrixSchemePermalinkConstructor = _interopRequireDefault(require("./MatrixSchemePermalinkConstructor"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
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

// The maximum number of servers to pick when working out which servers
// to add to permalinks. The servers are appended as ?via=example.org
const MAX_SERVER_CANDIDATES = 3;
const ANY_REGEX = /.*/;

// Permalinks can have servers appended to them so that the user
// receiving them can have a fighting chance at joining the room.
// These servers are called "candidates" at this point because
// it is unclear whether they are going to be useful to actually
// join in the future.
//
// We pick 3 servers based on the following criteria:
//
//   Server 1: The highest power level user in the room, provided
//   they are at least PL 50. We don't calculate "what is a moderator"
//   here because it is less relevant for the vast majority of rooms.
//   We also want to ensure that we get an admin or high-ranking mod
//   as they are less likely to leave the room. If no user happens
//   to meet this criteria, we'll pick the most popular server in the
//   room.
//
//   Server 2: The next most popular server in the room (in user
//   distribution). This cannot be the same as Server 1. If no other
//   servers are available then we'll only return Server 1.
//
//   Server 3: The next most popular server by user distribution. This
//   has the same rules as Server 2, with the added exception that it
//   must be unique from Server 1 and 2.

// Rationale for popular servers: It's hard to get rid of people when
// they keep flocking in from a particular server. Sure, the server could
// be ACL'd in the future or for some reason be evicted from the room
// however an event like that is unlikely the larger the room gets. If
// the server is ACL'd at the time of generating the link however, we
// shouldn't pick them. We also don't pick IP addresses.

// Note: we don't pick the server the room was created on because the
// homeserver should already be using that server as a last ditch attempt
// and there's less of a guarantee that the server is a resident server.
// Instead, we actively figure out which servers are likely to be residents
// in the future and try to use those.

// Note: Users receiving permalinks that happen to have all 3 potential
// servers fail them (in terms of joining) are somewhat expected to hunt
// down the person who gave them the link to ask for a participating server.
// The receiving user can then manually append the known-good server to
// the list and magically have the link work.

class RoomPermalinkCreator {
  // We support being given a roomId as a fallback in the event the `room` object
  // doesn't exist or is not healthy for us to rely on. For example, loading a
  // permalink to a room which the MatrixClient doesn't know about.
  // Some of the tests done by this class are relatively expensive, so normally
  // throttled to not happen on every update. Pass false as the shouldThrottle
  // param to disable this behaviour, eg. for tests.
  constructor(room) {
    let roomId = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    let shouldThrottle = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
    this.room = room;
    (0, _defineProperty2.default)(this, "roomId", void 0);
    (0, _defineProperty2.default)(this, "highestPlUserId", null);
    (0, _defineProperty2.default)(this, "populationMap", {});
    (0, _defineProperty2.default)(this, "bannedHostsRegexps", []);
    (0, _defineProperty2.default)(this, "allowedHostsRegexps", []);
    (0, _defineProperty2.default)(this, "_serverCandidates", void 0);
    (0, _defineProperty2.default)(this, "started", false);
    (0, _defineProperty2.default)(this, "onRoomStateUpdate", () => {
      this.fullUpdate();
    });
    (0, _defineProperty2.default)(this, "updateServerCandidates", () => {
      const candidates = new Set();
      if (this.highestPlUserId) {
        candidates.add(getServerName(this.highestPlUserId));
      }
      const serversByPopulation = Object.keys(this.populationMap).sort((a, b) => this.populationMap[b] - this.populationMap[a]);
      for (let i = 0; i < serversByPopulation.length && candidates.size < MAX_SERVER_CANDIDATES; i++) {
        const serverName = serversByPopulation[i];
        const domain = getHostnameFromMatrixServerName(serverName) ?? "";
        if (!candidates.has(serverName) && !isHostnameIpAddress(domain) && !isHostInRegex(domain, this.bannedHostsRegexps) && isHostInRegex(domain, this.allowedHostsRegexps)) {
          candidates.add(serverName);
        }
      }
      this._serverCandidates = [...candidates];
    });
    this.roomId = room ? room.roomId : roomId;
    if (!this.roomId) {
      throw new Error("Failed to resolve a roomId for the permalink creator to use");
    }
  }
  load() {
    if (!this.room || !this.room.currentState) {
      // Under rare and unknown circumstances it is possible to have a room with no
      // currentState, at least potentially at the early stages of joining a room.
      // To avoid breaking everything, we'll just warn rather than throw as well as
      // not bother updating the various aspects of the share link.
      _logger.logger.warn("Tried to load a permalink creator with no room state");
      return;
    }
    this.fullUpdate();
  }
  start() {
    this.load();
    this.room?.currentState.on(_roomState.RoomStateEvent.Update, this.onRoomStateUpdate);
    this.started = true;
  }
  stop() {
    this.room?.currentState.removeListener(_roomState.RoomStateEvent.Update, this.onRoomStateUpdate);
    this.started = false;
  }
  get serverCandidates() {
    return this._serverCandidates;
  }
  isStarted() {
    return this.started;
  }
  forEvent(eventId) {
    return getPermalinkConstructor().forEvent(this.roomId, eventId, this._serverCandidates);
  }
  forShareableRoom() {
    if (this.room) {
      // Prefer to use canonical alias for permalink if possible
      const alias = this.room.getCanonicalAlias();
      if (alias) {
        return getPermalinkConstructor().forRoom(alias);
      }
    }
    return getPermalinkConstructor().forRoom(this.roomId, this._serverCandidates);
  }
  forRoom() {
    return getPermalinkConstructor().forRoom(this.roomId, this._serverCandidates);
  }
  fullUpdate() {
    // This updates the internal state of this object from the room state. It's broken
    // down into separate functions, previously because we did some of these as incremental
    // updates, but they were on member events which can be very numerous, so the incremental
    // updates ended up being much slower than a full update. We now have the batch state update
    // event, so we just update in full, but on each batch of updates.
    this.updateAllowedServers();
    this.updateHighestPlUser();
    this.updatePopulationMap();
    this.updateServerCandidates();
  }
  updateHighestPlUser() {
    const plEvent = this.room?.currentState.getStateEvents("m.room.power_levels", "");
    if (plEvent) {
      const content = plEvent.getContent();
      if (content) {
        const users = content.users;
        if (users) {
          const entries = Object.entries(users);
          const allowedEntries = entries.filter(_ref => {
            let [userId] = _ref;
            const member = this.room?.getMember(userId);
            if (!member || member.membership !== "join") {
              return false;
            }
            const serverName = getServerName(userId);
            const domain = getHostnameFromMatrixServerName(serverName) ?? serverName;
            return !isHostnameIpAddress(domain) && !isHostInRegex(domain, this.bannedHostsRegexps) && isHostInRegex(domain, this.allowedHostsRegexps);
          });
          const maxEntry = allowedEntries.reduce((max, entry) => {
            return entry[1] > max[1] ? entry : max;
          }, [null, 0]);
          const [userId, powerLevel] = maxEntry;
          // object wasn't empty, and max entry wasn't a demotion from the default
          if (userId !== null && powerLevel >= 50) {
            this.highestPlUserId = userId;
            return;
          }
        }
      }
    }
    this.highestPlUserId = null;
  }
  updateAllowedServers() {
    const bannedHostsRegexps = [];
    let allowedHostsRegexps = [ANY_REGEX]; // default allow everyone
    if (this.room?.currentState) {
      const aclEvent = this.room?.currentState.getStateEvents(_event.EventType.RoomServerAcl, "");
      if (aclEvent && aclEvent.getContent()) {
        const getRegex = hostname => new RegExp("^" + utils.globToRegexp(hostname) + "$");
        const denied = aclEvent.getContent().deny;
        if (Array.isArray(denied)) {
          denied.forEach(h => bannedHostsRegexps.push(getRegex(h)));
        }
        const allowed = aclEvent.getContent().allow;
        allowedHostsRegexps = []; // we don't want to use the default rule here
        if (Array.isArray(denied)) {
          allowed.forEach(h => allowedHostsRegexps.push(getRegex(h)));
        }
      }
    }
    this.bannedHostsRegexps = bannedHostsRegexps;
    this.allowedHostsRegexps = allowedHostsRegexps;
  }
  updatePopulationMap() {
    const populationMap = {};
    if (this.room) {
      for (const member of this.room.getJoinedMembers()) {
        const serverName = getServerName(member.userId);
        if (!populationMap[serverName]) {
          populationMap[serverName] = 0;
        }
        populationMap[serverName]++;
      }
    }
    this.populationMap = populationMap;
  }
}
exports.RoomPermalinkCreator = RoomPermalinkCreator;
function makeGenericPermalink(entityId) {
  return getPermalinkConstructor().forEntity(entityId);
}
function makeUserPermalink(userId) {
  return getPermalinkConstructor().forUser(userId);
}
function makeRoomPermalink(matrixClient, roomId) {
  if (!roomId) {
    throw new Error("can't permalink a falsy roomId");
  }

  // If the roomId isn't actually a room ID, don't try to list the servers.
  // Aliases are already routable, and don't need extra information.
  if (roomId[0] !== "!") return getPermalinkConstructor().forRoom(roomId, []);
  const room = matrixClient.getRoom(roomId);
  if (!room) {
    return getPermalinkConstructor().forRoom(roomId, []);
  }
  const permalinkCreator = new RoomPermalinkCreator(room);
  permalinkCreator.load();
  return permalinkCreator.forShareableRoom();
}
function isPermalinkHost(host) {
  // Always check if the permalink is a spec permalink (callers are likely to call
  // parsePermalink after this function).
  if (new _MatrixToPermalinkConstructor.default().isPermalinkHost(host)) return true;
  return getPermalinkConstructor().isPermalinkHost(host);
}

/**
 * Transforms an entity (permalink, room alias, user ID, etc) into a local URL
 * if possible. If it is already a permalink (matrix.to) it gets returned
 * unchanged.
 * @param {string} entity The entity to transform.
 * @returns {string|null} The transformed permalink or null if unable.
 */
function tryTransformEntityToPermalink(matrixClient, entity) {
  if (!entity) return null;

  // Check to see if it is a bare entity for starters
  if (entity[0] === "#" || entity[0] === "!") return makeRoomPermalink(matrixClient, entity);
  if (entity[0] === "@") return makeUserPermalink(entity);
  if (entity.slice(0, 7) === "matrix:") {
    try {
      const permalinkParts = parsePermalink(entity);
      if (permalinkParts) {
        if (permalinkParts.roomIdOrAlias) {
          const eventIdPart = permalinkParts.eventId ? `/${permalinkParts.eventId}` : "";
          let pl = _MatrixToPermalinkConstructor.baseUrl + `/#/${permalinkParts.roomIdOrAlias}${eventIdPart}`;
          if (permalinkParts.viaServers?.length) {
            pl += new _MatrixToPermalinkConstructor.default().encodeServerCandidates(permalinkParts.viaServers);
          }
          return pl;
        } else if (permalinkParts.userId) {
          return _MatrixToPermalinkConstructor.baseUrl + `/#/${permalinkParts.userId}`;
        }
      }
    } catch {}
  }
  return entity;
}

/**
 * Transforms a permalink (or possible permalink) into a local URL if possible. If
 * the given permalink is found to not be a permalink, it'll be returned unaltered.
 * @param {string} permalink The permalink to try and transform.
 * @returns {string} The transformed permalink or original URL if unable.
 */
function tryTransformPermalinkToLocalHref(permalink) {
  if (!permalink.startsWith("http:") && !permalink.startsWith("https:") && !permalink.startsWith("matrix:") && !permalink.startsWith("vector:") // Element Desktop
  ) {
    return permalink;
  }
  try {
    const m = decodeURIComponent(permalink).match(_linkifyMatrix.ELEMENT_URL_PATTERN);
    if (m) {
      return m[1];
    }
  } catch (e) {
    // Not a valid URI
    return permalink;
  }

  // A bit of a hack to convert permalinks of unknown origin to Element links
  try {
    const permalinkParts = parsePermalink(permalink);
    if (permalinkParts) {
      if (permalinkParts.roomIdOrAlias) {
        const eventIdPart = permalinkParts.eventId ? `/${permalinkParts.eventId}` : "";
        permalink = `#/room/${permalinkParts.roomIdOrAlias}${eventIdPart}`;
        if (permalinkParts.viaServers?.length) {
          permalink += new _MatrixToPermalinkConstructor.default().encodeServerCandidates(permalinkParts.viaServers);
        }
      } else if (permalinkParts.userId) {
        permalink = `#/user/${permalinkParts.userId}`;
      } // else not a valid permalink for our purposes - do not handle
    }
  } catch (e) {
    // Not an href we need to care about
  }
  return permalink;
}
function getPrimaryPermalinkEntity(permalink) {
  try {
    let permalinkParts = parsePermalink(permalink);

    // If not a permalink, try the vector patterns.
    if (!permalinkParts) {
      const m = permalink.match(_linkifyMatrix.ELEMENT_URL_PATTERN);
      if (m) {
        // A bit of a hack, but it gets the job done
        const handler = new _ElementPermalinkConstructor.default("http://localhost");
        const entityInfo = m[1].split("#").slice(1).join("#");
        permalinkParts = handler.parsePermalink(`http://localhost/#${entityInfo}`);
      }
    }
    if (!permalinkParts) return null; // not processable
    if (permalinkParts.userId) return permalinkParts.userId;
    if (permalinkParts.roomIdOrAlias) return permalinkParts.roomIdOrAlias;
  } catch (e) {
    // no entity - not a permalink
  }
  return null;
}
function getPermalinkConstructor() {
  const elementPrefix = _SdkConfig.default.get("permalink_prefix");
  if (elementPrefix && elementPrefix !== _MatrixToPermalinkConstructor.baseUrl) {
    return new _ElementPermalinkConstructor.default(elementPrefix);
  }
  return new _MatrixToPermalinkConstructor.default();
}
function parsePermalink(fullUrl) {
  try {
    const elementPrefix = _SdkConfig.default.get("permalink_prefix");
    const decodedUrl = decodeURIComponent(fullUrl);
    if (new RegExp(_MatrixToPermalinkConstructor.baseUrlPattern, "i").test(decodedUrl)) {
      return new _MatrixToPermalinkConstructor.default().parsePermalink(decodedUrl);
    } else if (fullUrl.startsWith("matrix:")) {
      return new _MatrixSchemePermalinkConstructor.default().parsePermalink(fullUrl);
    } else if (elementPrefix && fullUrl.startsWith(elementPrefix)) {
      return new _ElementPermalinkConstructor.default(elementPrefix).parsePermalink(fullUrl);
    }
  } catch (e) {
    _logger.logger.error("Failed to parse permalink", e);
  }
  return null; // not a permalink we can handle
}

function getServerName(userId) {
  return userId.split(":").splice(1).join(":");
}
function getHostnameFromMatrixServerName(serverName) {
  if (!serverName) return null;
  try {
    return new URL(`https://${serverName}`).hostname;
  } catch (e) {
    console.error("Error encountered while extracting hostname from server name", e);
    return null;
  }
}
function isHostInRegex(hostname, regexps) {
  if (!hostname) return true; // assumed
  if (regexps.length > 0 && !regexps[0].test) throw new Error(regexps[0].toString());
  return regexps.some(h => h.test(hostname));
}
function isHostnameIpAddress(hostname) {
  if (!hostname) return false;

  // is-ip doesn't want IPv6 addresses surrounded by brackets, so
  // take them off.
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    hostname = hostname.substring(1, hostname.length - 1);
  }
  return (0, _isIp.default)(hostname);
}
const calculateRoomVia = room => {
  const permalinkCreator = new RoomPermalinkCreator(room);
  permalinkCreator.load();
  return permalinkCreator.serverCandidates ?? [];
};
exports.calculateRoomVia = calculateRoomVia;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfaXNJcCIsIl9pbnRlcm9wUmVxdWlyZURlZmF1bHQiLCJyZXF1aXJlIiwidXRpbHMiLCJfaW50ZXJvcFJlcXVpcmVXaWxkY2FyZCIsIl9sb2dnZXIiLCJfcm9vbVN0YXRlIiwiX2V2ZW50IiwiX01hdHJpeFRvUGVybWFsaW5rQ29uc3RydWN0b3IiLCJfRWxlbWVudFBlcm1hbGlua0NvbnN0cnVjdG9yIiwiX1Nka0NvbmZpZyIsIl9saW5raWZ5TWF0cml4IiwiX01hdHJpeFNjaGVtZVBlcm1hbGlua0NvbnN0cnVjdG9yIiwiX2dldFJlcXVpcmVXaWxkY2FyZENhY2hlIiwibm9kZUludGVyb3AiLCJXZWFrTWFwIiwiY2FjaGVCYWJlbEludGVyb3AiLCJjYWNoZU5vZGVJbnRlcm9wIiwib2JqIiwiX19lc01vZHVsZSIsImRlZmF1bHQiLCJjYWNoZSIsImhhcyIsImdldCIsIm5ld09iaiIsImhhc1Byb3BlcnR5RGVzY3JpcHRvciIsIk9iamVjdCIsImRlZmluZVByb3BlcnR5IiwiZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yIiwia2V5IiwicHJvdG90eXBlIiwiaGFzT3duUHJvcGVydHkiLCJjYWxsIiwiZGVzYyIsInNldCIsIk1BWF9TRVJWRVJfQ0FORElEQVRFUyIsIkFOWV9SRUdFWCIsIlJvb21QZXJtYWxpbmtDcmVhdG9yIiwiY29uc3RydWN0b3IiLCJyb29tIiwicm9vbUlkIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwidW5kZWZpbmVkIiwic2hvdWxkVGhyb3R0bGUiLCJfZGVmaW5lUHJvcGVydHkyIiwiZnVsbFVwZGF0ZSIsImNhbmRpZGF0ZXMiLCJTZXQiLCJoaWdoZXN0UGxVc2VySWQiLCJhZGQiLCJnZXRTZXJ2ZXJOYW1lIiwic2VydmVyc0J5UG9wdWxhdGlvbiIsImtleXMiLCJwb3B1bGF0aW9uTWFwIiwic29ydCIsImEiLCJiIiwiaSIsInNpemUiLCJzZXJ2ZXJOYW1lIiwiZG9tYWluIiwiZ2V0SG9zdG5hbWVGcm9tTWF0cml4U2VydmVyTmFtZSIsImlzSG9zdG5hbWVJcEFkZHJlc3MiLCJpc0hvc3RJblJlZ2V4IiwiYmFubmVkSG9zdHNSZWdleHBzIiwiYWxsb3dlZEhvc3RzUmVnZXhwcyIsIl9zZXJ2ZXJDYW5kaWRhdGVzIiwiRXJyb3IiLCJsb2FkIiwiY3VycmVudFN0YXRlIiwibG9nZ2VyIiwid2FybiIsInN0YXJ0Iiwib24iLCJSb29tU3RhdGVFdmVudCIsIlVwZGF0ZSIsIm9uUm9vbVN0YXRlVXBkYXRlIiwic3RhcnRlZCIsInN0b3AiLCJyZW1vdmVMaXN0ZW5lciIsInNlcnZlckNhbmRpZGF0ZXMiLCJpc1N0YXJ0ZWQiLCJmb3JFdmVudCIsImV2ZW50SWQiLCJnZXRQZXJtYWxpbmtDb25zdHJ1Y3RvciIsImZvclNoYXJlYWJsZVJvb20iLCJhbGlhcyIsImdldENhbm9uaWNhbEFsaWFzIiwiZm9yUm9vbSIsInVwZGF0ZUFsbG93ZWRTZXJ2ZXJzIiwidXBkYXRlSGlnaGVzdFBsVXNlciIsInVwZGF0ZVBvcHVsYXRpb25NYXAiLCJ1cGRhdGVTZXJ2ZXJDYW5kaWRhdGVzIiwicGxFdmVudCIsImdldFN0YXRlRXZlbnRzIiwiY29udGVudCIsImdldENvbnRlbnQiLCJ1c2VycyIsImVudHJpZXMiLCJhbGxvd2VkRW50cmllcyIsImZpbHRlciIsIl9yZWYiLCJ1c2VySWQiLCJtZW1iZXIiLCJnZXRNZW1iZXIiLCJtZW1iZXJzaGlwIiwibWF4RW50cnkiLCJyZWR1Y2UiLCJtYXgiLCJlbnRyeSIsInBvd2VyTGV2ZWwiLCJhY2xFdmVudCIsIkV2ZW50VHlwZSIsIlJvb21TZXJ2ZXJBY2wiLCJnZXRSZWdleCIsImhvc3RuYW1lIiwiUmVnRXhwIiwiZ2xvYlRvUmVnZXhwIiwiZGVuaWVkIiwiZGVueSIsIkFycmF5IiwiaXNBcnJheSIsImZvckVhY2giLCJoIiwicHVzaCIsImFsbG93ZWQiLCJhbGxvdyIsImdldEpvaW5lZE1lbWJlcnMiLCJleHBvcnRzIiwibWFrZUdlbmVyaWNQZXJtYWxpbmsiLCJlbnRpdHlJZCIsImZvckVudGl0eSIsIm1ha2VVc2VyUGVybWFsaW5rIiwiZm9yVXNlciIsIm1ha2VSb29tUGVybWFsaW5rIiwibWF0cml4Q2xpZW50IiwiZ2V0Um9vbSIsInBlcm1hbGlua0NyZWF0b3IiLCJpc1Blcm1hbGlua0hvc3QiLCJob3N0IiwiTWF0cml4VG9QZXJtYWxpbmtDb25zdHJ1Y3RvciIsInRyeVRyYW5zZm9ybUVudGl0eVRvUGVybWFsaW5rIiwiZW50aXR5Iiwic2xpY2UiLCJwZXJtYWxpbmtQYXJ0cyIsInBhcnNlUGVybWFsaW5rIiwicm9vbUlkT3JBbGlhcyIsImV2ZW50SWRQYXJ0IiwicGwiLCJtYXRyaXh0b0Jhc2VVcmwiLCJ2aWFTZXJ2ZXJzIiwiZW5jb2RlU2VydmVyQ2FuZGlkYXRlcyIsInRyeVRyYW5zZm9ybVBlcm1hbGlua1RvTG9jYWxIcmVmIiwicGVybWFsaW5rIiwic3RhcnRzV2l0aCIsIm0iLCJkZWNvZGVVUklDb21wb25lbnQiLCJtYXRjaCIsIkVMRU1FTlRfVVJMX1BBVFRFUk4iLCJlIiwiZ2V0UHJpbWFyeVBlcm1hbGlua0VudGl0eSIsImhhbmRsZXIiLCJFbGVtZW50UGVybWFsaW5rQ29uc3RydWN0b3IiLCJlbnRpdHlJbmZvIiwic3BsaXQiLCJqb2luIiwiZWxlbWVudFByZWZpeCIsIlNka0NvbmZpZyIsImZ1bGxVcmwiLCJkZWNvZGVkVXJsIiwibWF0cml4VG9CYXNlVXJsUGF0dGVybiIsInRlc3QiLCJNYXRyaXhTY2hlbWVQZXJtYWxpbmtDb25zdHJ1Y3RvciIsImVycm9yIiwic3BsaWNlIiwiVVJMIiwiY29uc29sZSIsInJlZ2V4cHMiLCJ0b1N0cmluZyIsInNvbWUiLCJlbmRzV2l0aCIsInN1YnN0cmluZyIsImlzSXAiLCJjYWxjdWxhdGVSb29tVmlhIl0sInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3V0aWxzL3Blcm1hbGlua3MvUGVybWFsaW5rcy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuQ29weXJpZ2h0IDIwMTksIDIwMjEgVGhlIE1hdHJpeC5vcmcgRm91bmRhdGlvbiBDLkkuQy5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4qL1xuXG5pbXBvcnQgaXNJcCBmcm9tIFwiaXMtaXBcIjtcbmltcG9ydCAqIGFzIHV0aWxzIGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy91dGlsc1wiO1xuaW1wb3J0IHsgUm9vbSB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9tb2RlbHMvcm9vbVwiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL2xvZ2dlclwiO1xuaW1wb3J0IHsgUm9vbVN0YXRlRXZlbnQgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbW9kZWxzL3Jvb20tc3RhdGVcIjtcbmltcG9ydCB7IEV2ZW50VHlwZSB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9AdHlwZXMvZXZlbnRcIjtcbmltcG9ydCB7IE1hdHJpeENsaWVudCB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9tYXRyaXhcIjtcblxuaW1wb3J0IE1hdHJpeFRvUGVybWFsaW5rQ29uc3RydWN0b3IsIHtcbiAgICBiYXNlVXJsIGFzIG1hdHJpeHRvQmFzZVVybCxcbiAgICBiYXNlVXJsUGF0dGVybiBhcyBtYXRyaXhUb0Jhc2VVcmxQYXR0ZXJuLFxufSBmcm9tIFwiLi9NYXRyaXhUb1Blcm1hbGlua0NvbnN0cnVjdG9yXCI7XG5pbXBvcnQgUGVybWFsaW5rQ29uc3RydWN0b3IsIHsgUGVybWFsaW5rUGFydHMgfSBmcm9tIFwiLi9QZXJtYWxpbmtDb25zdHJ1Y3RvclwiO1xuaW1wb3J0IEVsZW1lbnRQZXJtYWxpbmtDb25zdHJ1Y3RvciBmcm9tIFwiLi9FbGVtZW50UGVybWFsaW5rQ29uc3RydWN0b3JcIjtcbmltcG9ydCBTZGtDb25maWcgZnJvbSBcIi4uLy4uL1Nka0NvbmZpZ1wiO1xuaW1wb3J0IHsgRUxFTUVOVF9VUkxfUEFUVEVSTiB9IGZyb20gXCIuLi8uLi9saW5raWZ5LW1hdHJpeFwiO1xuaW1wb3J0IE1hdHJpeFNjaGVtZVBlcm1hbGlua0NvbnN0cnVjdG9yIGZyb20gXCIuL01hdHJpeFNjaGVtZVBlcm1hbGlua0NvbnN0cnVjdG9yXCI7XG5cbi8vIFRoZSBtYXhpbXVtIG51bWJlciBvZiBzZXJ2ZXJzIHRvIHBpY2sgd2hlbiB3b3JraW5nIG91dCB3aGljaCBzZXJ2ZXJzXG4vLyB0byBhZGQgdG8gcGVybWFsaW5rcy4gVGhlIHNlcnZlcnMgYXJlIGFwcGVuZGVkIGFzID92aWE9ZXhhbXBsZS5vcmdcbmNvbnN0IE1BWF9TRVJWRVJfQ0FORElEQVRFUyA9IDM7XG5cbmNvbnN0IEFOWV9SRUdFWCA9IC8uKi87XG5cbi8vIFBlcm1hbGlua3MgY2FuIGhhdmUgc2VydmVycyBhcHBlbmRlZCB0byB0aGVtIHNvIHRoYXQgdGhlIHVzZXJcbi8vIHJlY2VpdmluZyB0aGVtIGNhbiBoYXZlIGEgZmlnaHRpbmcgY2hhbmNlIGF0IGpvaW5pbmcgdGhlIHJvb20uXG4vLyBUaGVzZSBzZXJ2ZXJzIGFyZSBjYWxsZWQgXCJjYW5kaWRhdGVzXCIgYXQgdGhpcyBwb2ludCBiZWNhdXNlXG4vLyBpdCBpcyB1bmNsZWFyIHdoZXRoZXIgdGhleSBhcmUgZ29pbmcgdG8gYmUgdXNlZnVsIHRvIGFjdHVhbGx5XG4vLyBqb2luIGluIHRoZSBmdXR1cmUuXG4vL1xuLy8gV2UgcGljayAzIHNlcnZlcnMgYmFzZWQgb24gdGhlIGZvbGxvd2luZyBjcml0ZXJpYTpcbi8vXG4vLyAgIFNlcnZlciAxOiBUaGUgaGlnaGVzdCBwb3dlciBsZXZlbCB1c2VyIGluIHRoZSByb29tLCBwcm92aWRlZFxuLy8gICB0aGV5IGFyZSBhdCBsZWFzdCBQTCA1MC4gV2UgZG9uJ3QgY2FsY3VsYXRlIFwid2hhdCBpcyBhIG1vZGVyYXRvclwiXG4vLyAgIGhlcmUgYmVjYXVzZSBpdCBpcyBsZXNzIHJlbGV2YW50IGZvciB0aGUgdmFzdCBtYWpvcml0eSBvZiByb29tcy5cbi8vICAgV2UgYWxzbyB3YW50IHRvIGVuc3VyZSB0aGF0IHdlIGdldCBhbiBhZG1pbiBvciBoaWdoLXJhbmtpbmcgbW9kXG4vLyAgIGFzIHRoZXkgYXJlIGxlc3MgbGlrZWx5IHRvIGxlYXZlIHRoZSByb29tLiBJZiBubyB1c2VyIGhhcHBlbnNcbi8vICAgdG8gbWVldCB0aGlzIGNyaXRlcmlhLCB3ZSdsbCBwaWNrIHRoZSBtb3N0IHBvcHVsYXIgc2VydmVyIGluIHRoZVxuLy8gICByb29tLlxuLy9cbi8vICAgU2VydmVyIDI6IFRoZSBuZXh0IG1vc3QgcG9wdWxhciBzZXJ2ZXIgaW4gdGhlIHJvb20gKGluIHVzZXJcbi8vICAgZGlzdHJpYnV0aW9uKS4gVGhpcyBjYW5ub3QgYmUgdGhlIHNhbWUgYXMgU2VydmVyIDEuIElmIG5vIG90aGVyXG4vLyAgIHNlcnZlcnMgYXJlIGF2YWlsYWJsZSB0aGVuIHdlJ2xsIG9ubHkgcmV0dXJuIFNlcnZlciAxLlxuLy9cbi8vICAgU2VydmVyIDM6IFRoZSBuZXh0IG1vc3QgcG9wdWxhciBzZXJ2ZXIgYnkgdXNlciBkaXN0cmlidXRpb24uIFRoaXNcbi8vICAgaGFzIHRoZSBzYW1lIHJ1bGVzIGFzIFNlcnZlciAyLCB3aXRoIHRoZSBhZGRlZCBleGNlcHRpb24gdGhhdCBpdFxuLy8gICBtdXN0IGJlIHVuaXF1ZSBmcm9tIFNlcnZlciAxIGFuZCAyLlxuXG4vLyBSYXRpb25hbGUgZm9yIHBvcHVsYXIgc2VydmVyczogSXQncyBoYXJkIHRvIGdldCByaWQgb2YgcGVvcGxlIHdoZW5cbi8vIHRoZXkga2VlcCBmbG9ja2luZyBpbiBmcm9tIGEgcGFydGljdWxhciBzZXJ2ZXIuIFN1cmUsIHRoZSBzZXJ2ZXIgY291bGRcbi8vIGJlIEFDTCdkIGluIHRoZSBmdXR1cmUgb3IgZm9yIHNvbWUgcmVhc29uIGJlIGV2aWN0ZWQgZnJvbSB0aGUgcm9vbVxuLy8gaG93ZXZlciBhbiBldmVudCBsaWtlIHRoYXQgaXMgdW5saWtlbHkgdGhlIGxhcmdlciB0aGUgcm9vbSBnZXRzLiBJZlxuLy8gdGhlIHNlcnZlciBpcyBBQ0wnZCBhdCB0aGUgdGltZSBvZiBnZW5lcmF0aW5nIHRoZSBsaW5rIGhvd2V2ZXIsIHdlXG4vLyBzaG91bGRuJ3QgcGljayB0aGVtLiBXZSBhbHNvIGRvbid0IHBpY2sgSVAgYWRkcmVzc2VzLlxuXG4vLyBOb3RlOiB3ZSBkb24ndCBwaWNrIHRoZSBzZXJ2ZXIgdGhlIHJvb20gd2FzIGNyZWF0ZWQgb24gYmVjYXVzZSB0aGVcbi8vIGhvbWVzZXJ2ZXIgc2hvdWxkIGFscmVhZHkgYmUgdXNpbmcgdGhhdCBzZXJ2ZXIgYXMgYSBsYXN0IGRpdGNoIGF0dGVtcHRcbi8vIGFuZCB0aGVyZSdzIGxlc3Mgb2YgYSBndWFyYW50ZWUgdGhhdCB0aGUgc2VydmVyIGlzIGEgcmVzaWRlbnQgc2VydmVyLlxuLy8gSW5zdGVhZCwgd2UgYWN0aXZlbHkgZmlndXJlIG91dCB3aGljaCBzZXJ2ZXJzIGFyZSBsaWtlbHkgdG8gYmUgcmVzaWRlbnRzXG4vLyBpbiB0aGUgZnV0dXJlIGFuZCB0cnkgdG8gdXNlIHRob3NlLlxuXG4vLyBOb3RlOiBVc2VycyByZWNlaXZpbmcgcGVybWFsaW5rcyB0aGF0IGhhcHBlbiB0byBoYXZlIGFsbCAzIHBvdGVudGlhbFxuLy8gc2VydmVycyBmYWlsIHRoZW0gKGluIHRlcm1zIG9mIGpvaW5pbmcpIGFyZSBzb21ld2hhdCBleHBlY3RlZCB0byBodW50XG4vLyBkb3duIHRoZSBwZXJzb24gd2hvIGdhdmUgdGhlbSB0aGUgbGluayB0byBhc2sgZm9yIGEgcGFydGljaXBhdGluZyBzZXJ2ZXIuXG4vLyBUaGUgcmVjZWl2aW5nIHVzZXIgY2FuIHRoZW4gbWFudWFsbHkgYXBwZW5kIHRoZSBrbm93bi1nb29kIHNlcnZlciB0b1xuLy8gdGhlIGxpc3QgYW5kIG1hZ2ljYWxseSBoYXZlIHRoZSBsaW5rIHdvcmsuXG5cbmV4cG9ydCBjbGFzcyBSb29tUGVybWFsaW5rQ3JlYXRvciB7XG4gICAgcHJpdmF0ZSByb29tSWQ6IHN0cmluZztcbiAgICBwcml2YXRlIGhpZ2hlc3RQbFVzZXJJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgcHJpdmF0ZSBwb3B1bGF0aW9uTWFwOiB7IFtzZXJ2ZXJOYW1lOiBzdHJpbmddOiBudW1iZXIgfSA9IHt9O1xuICAgIHByaXZhdGUgYmFubmVkSG9zdHNSZWdleHBzOiBSZWdFeHBbXSA9IFtdO1xuICAgIHByaXZhdGUgYWxsb3dlZEhvc3RzUmVnZXhwczogUmVnRXhwW10gPSBbXTtcbiAgICBwcml2YXRlIF9zZXJ2ZXJDYW5kaWRhdGVzPzogc3RyaW5nW107XG4gICAgcHJpdmF0ZSBzdGFydGVkID0gZmFsc2U7XG5cbiAgICAvLyBXZSBzdXBwb3J0IGJlaW5nIGdpdmVuIGEgcm9vbUlkIGFzIGEgZmFsbGJhY2sgaW4gdGhlIGV2ZW50IHRoZSBgcm9vbWAgb2JqZWN0XG4gICAgLy8gZG9lc24ndCBleGlzdCBvciBpcyBub3QgaGVhbHRoeSBmb3IgdXMgdG8gcmVseSBvbi4gRm9yIGV4YW1wbGUsIGxvYWRpbmcgYVxuICAgIC8vIHBlcm1hbGluayB0byBhIHJvb20gd2hpY2ggdGhlIE1hdHJpeENsaWVudCBkb2Vzbid0IGtub3cgYWJvdXQuXG4gICAgLy8gU29tZSBvZiB0aGUgdGVzdHMgZG9uZSBieSB0aGlzIGNsYXNzIGFyZSByZWxhdGl2ZWx5IGV4cGVuc2l2ZSwgc28gbm9ybWFsbHlcbiAgICAvLyB0aHJvdHRsZWQgdG8gbm90IGhhcHBlbiBvbiBldmVyeSB1cGRhdGUuIFBhc3MgZmFsc2UgYXMgdGhlIHNob3VsZFRocm90dGxlXG4gICAgLy8gcGFyYW0gdG8gZGlzYWJsZSB0aGlzIGJlaGF2aW91ciwgZWcuIGZvciB0ZXN0cy5cbiAgICBwdWJsaWMgY29uc3RydWN0b3IocHJpdmF0ZSByb29tOiBSb29tIHwgbnVsbCwgcm9vbUlkOiBzdHJpbmcgfCBudWxsID0gbnVsbCwgc2hvdWxkVGhyb3R0bGUgPSB0cnVlKSB7XG4gICAgICAgIHRoaXMucm9vbUlkID0gcm9vbSA/IHJvb20ucm9vbUlkIDogcm9vbUlkITtcblxuICAgICAgICBpZiAoIXRoaXMucm9vbUlkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJGYWlsZWQgdG8gcmVzb2x2ZSBhIHJvb21JZCBmb3IgdGhlIHBlcm1hbGluayBjcmVhdG9yIHRvIHVzZVwiKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBsb2FkKCk6IHZvaWQge1xuICAgICAgICBpZiAoIXRoaXMucm9vbSB8fCAhdGhpcy5yb29tLmN1cnJlbnRTdGF0ZSkge1xuICAgICAgICAgICAgLy8gVW5kZXIgcmFyZSBhbmQgdW5rbm93biBjaXJjdW1zdGFuY2VzIGl0IGlzIHBvc3NpYmxlIHRvIGhhdmUgYSByb29tIHdpdGggbm9cbiAgICAgICAgICAgIC8vIGN1cnJlbnRTdGF0ZSwgYXQgbGVhc3QgcG90ZW50aWFsbHkgYXQgdGhlIGVhcmx5IHN0YWdlcyBvZiBqb2luaW5nIGEgcm9vbS5cbiAgICAgICAgICAgIC8vIFRvIGF2b2lkIGJyZWFraW5nIGV2ZXJ5dGhpbmcsIHdlJ2xsIGp1c3Qgd2FybiByYXRoZXIgdGhhbiB0aHJvdyBhcyB3ZWxsIGFzXG4gICAgICAgICAgICAvLyBub3QgYm90aGVyIHVwZGF0aW5nIHRoZSB2YXJpb3VzIGFzcGVjdHMgb2YgdGhlIHNoYXJlIGxpbmsuXG4gICAgICAgICAgICBsb2dnZXIud2FybihcIlRyaWVkIHRvIGxvYWQgYSBwZXJtYWxpbmsgY3JlYXRvciB3aXRoIG5vIHJvb20gc3RhdGVcIik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5mdWxsVXBkYXRlKCk7XG4gICAgfVxuXG4gICAgcHVibGljIHN0YXJ0KCk6IHZvaWQge1xuICAgICAgICB0aGlzLmxvYWQoKTtcbiAgICAgICAgdGhpcy5yb29tPy5jdXJyZW50U3RhdGUub24oUm9vbVN0YXRlRXZlbnQuVXBkYXRlLCB0aGlzLm9uUm9vbVN0YXRlVXBkYXRlKTtcbiAgICAgICAgdGhpcy5zdGFydGVkID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc3RvcCgpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5yb29tPy5jdXJyZW50U3RhdGUucmVtb3ZlTGlzdGVuZXIoUm9vbVN0YXRlRXZlbnQuVXBkYXRlLCB0aGlzLm9uUm9vbVN0YXRlVXBkYXRlKTtcbiAgICAgICAgdGhpcy5zdGFydGVkID0gZmFsc2U7XG4gICAgfVxuXG4gICAgcHVibGljIGdldCBzZXJ2ZXJDYW5kaWRhdGVzKCk6IHN0cmluZ1tdIHwgdW5kZWZpbmVkIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NlcnZlckNhbmRpZGF0ZXM7XG4gICAgfVxuXG4gICAgcHVibGljIGlzU3RhcnRlZCgpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RhcnRlZDtcbiAgICB9XG5cbiAgICBwdWJsaWMgZm9yRXZlbnQoZXZlbnRJZDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAgICAgcmV0dXJuIGdldFBlcm1hbGlua0NvbnN0cnVjdG9yKCkuZm9yRXZlbnQodGhpcy5yb29tSWQsIGV2ZW50SWQsIHRoaXMuX3NlcnZlckNhbmRpZGF0ZXMpO1xuICAgIH1cblxuICAgIHB1YmxpYyBmb3JTaGFyZWFibGVSb29tKCk6IHN0cmluZyB7XG4gICAgICAgIGlmICh0aGlzLnJvb20pIHtcbiAgICAgICAgICAgIC8vIFByZWZlciB0byB1c2UgY2Fub25pY2FsIGFsaWFzIGZvciBwZXJtYWxpbmsgaWYgcG9zc2libGVcbiAgICAgICAgICAgIGNvbnN0IGFsaWFzID0gdGhpcy5yb29tLmdldENhbm9uaWNhbEFsaWFzKCk7XG4gICAgICAgICAgICBpZiAoYWxpYXMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZ2V0UGVybWFsaW5rQ29uc3RydWN0b3IoKS5mb3JSb29tKGFsaWFzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZ2V0UGVybWFsaW5rQ29uc3RydWN0b3IoKS5mb3JSb29tKHRoaXMucm9vbUlkLCB0aGlzLl9zZXJ2ZXJDYW5kaWRhdGVzKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZm9yUm9vbSgpOiBzdHJpbmcge1xuICAgICAgICByZXR1cm4gZ2V0UGVybWFsaW5rQ29uc3RydWN0b3IoKS5mb3JSb29tKHRoaXMucm9vbUlkLCB0aGlzLl9zZXJ2ZXJDYW5kaWRhdGVzKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIG9uUm9vbVN0YXRlVXBkYXRlID0gKCk6IHZvaWQgPT4ge1xuICAgICAgICB0aGlzLmZ1bGxVcGRhdGUoKTtcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBmdWxsVXBkYXRlKCk6IHZvaWQge1xuICAgICAgICAvLyBUaGlzIHVwZGF0ZXMgdGhlIGludGVybmFsIHN0YXRlIG9mIHRoaXMgb2JqZWN0IGZyb20gdGhlIHJvb20gc3RhdGUuIEl0J3MgYnJva2VuXG4gICAgICAgIC8vIGRvd24gaW50byBzZXBhcmF0ZSBmdW5jdGlvbnMsIHByZXZpb3VzbHkgYmVjYXVzZSB3ZSBkaWQgc29tZSBvZiB0aGVzZSBhcyBpbmNyZW1lbnRhbFxuICAgICAgICAvLyB1cGRhdGVzLCBidXQgdGhleSB3ZXJlIG9uIG1lbWJlciBldmVudHMgd2hpY2ggY2FuIGJlIHZlcnkgbnVtZXJvdXMsIHNvIHRoZSBpbmNyZW1lbnRhbFxuICAgICAgICAvLyB1cGRhdGVzIGVuZGVkIHVwIGJlaW5nIG11Y2ggc2xvd2VyIHRoYW4gYSBmdWxsIHVwZGF0ZS4gV2Ugbm93IGhhdmUgdGhlIGJhdGNoIHN0YXRlIHVwZGF0ZVxuICAgICAgICAvLyBldmVudCwgc28gd2UganVzdCB1cGRhdGUgaW4gZnVsbCwgYnV0IG9uIGVhY2ggYmF0Y2ggb2YgdXBkYXRlcy5cbiAgICAgICAgdGhpcy51cGRhdGVBbGxvd2VkU2VydmVycygpO1xuICAgICAgICB0aGlzLnVwZGF0ZUhpZ2hlc3RQbFVzZXIoKTtcbiAgICAgICAgdGhpcy51cGRhdGVQb3B1bGF0aW9uTWFwKCk7XG4gICAgICAgIHRoaXMudXBkYXRlU2VydmVyQ2FuZGlkYXRlcygpO1xuICAgIH1cblxuICAgIHByaXZhdGUgdXBkYXRlSGlnaGVzdFBsVXNlcigpOiB2b2lkIHtcbiAgICAgICAgY29uc3QgcGxFdmVudCA9IHRoaXMucm9vbT8uY3VycmVudFN0YXRlLmdldFN0YXRlRXZlbnRzKFwibS5yb29tLnBvd2VyX2xldmVsc1wiLCBcIlwiKTtcbiAgICAgICAgaWYgKHBsRXZlbnQpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBwbEV2ZW50LmdldENvbnRlbnQoKTtcbiAgICAgICAgICAgIGlmIChjb250ZW50KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdXNlcnM6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSBjb250ZW50LnVzZXJzO1xuICAgICAgICAgICAgICAgIGlmICh1c2Vycykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlbnRyaWVzID0gT2JqZWN0LmVudHJpZXModXNlcnMpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhbGxvd2VkRW50cmllcyA9IGVudHJpZXMuZmlsdGVyKChbdXNlcklkXSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbWVtYmVyID0gdGhpcy5yb29tPy5nZXRNZW1iZXIodXNlcklkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbWVtYmVyIHx8IG1lbWJlci5tZW1iZXJzaGlwICE9PSBcImpvaW5cIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNlcnZlck5hbWUgPSBnZXRTZXJ2ZXJOYW1lKHVzZXJJZCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRvbWFpbiA9IGdldEhvc3RuYW1lRnJvbU1hdHJpeFNlcnZlck5hbWUoc2VydmVyTmFtZSkgPz8gc2VydmVyTmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIWlzSG9zdG5hbWVJcEFkZHJlc3MoZG9tYWluKSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICFpc0hvc3RJblJlZ2V4KGRvbWFpbiwgdGhpcy5iYW5uZWRIb3N0c1JlZ2V4cHMpICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaXNIb3N0SW5SZWdleChkb21haW4sIHRoaXMuYWxsb3dlZEhvc3RzUmVnZXhwcylcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBtYXhFbnRyeSA9IGFsbG93ZWRFbnRyaWVzLnJlZHVjZTxbc3RyaW5nIHwgbnVsbCwgbnVtYmVyXT4oXG4gICAgICAgICAgICAgICAgICAgICAgICAobWF4LCBlbnRyeSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBlbnRyeVsxXSA+IG1heFsxXSA/IGVudHJ5IDogbWF4O1xuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIFtudWxsLCAwXSxcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgW3VzZXJJZCwgcG93ZXJMZXZlbF0gPSBtYXhFbnRyeTtcbiAgICAgICAgICAgICAgICAgICAgLy8gb2JqZWN0IHdhc24ndCBlbXB0eSwgYW5kIG1heCBlbnRyeSB3YXNuJ3QgYSBkZW1vdGlvbiBmcm9tIHRoZSBkZWZhdWx0XG4gICAgICAgICAgICAgICAgICAgIGlmICh1c2VySWQgIT09IG51bGwgJiYgcG93ZXJMZXZlbCA+PSA1MCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5oaWdoZXN0UGxVc2VySWQgPSB1c2VySWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5oaWdoZXN0UGxVc2VySWQgPSBudWxsO1xuICAgIH1cblxuICAgIHByaXZhdGUgdXBkYXRlQWxsb3dlZFNlcnZlcnMoKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IGJhbm5lZEhvc3RzUmVnZXhwczogUmVnRXhwW10gPSBbXTtcbiAgICAgICAgbGV0IGFsbG93ZWRIb3N0c1JlZ2V4cHMgPSBbQU5ZX1JFR0VYXTsgLy8gZGVmYXVsdCBhbGxvdyBldmVyeW9uZVxuICAgICAgICBpZiAodGhpcy5yb29tPy5jdXJyZW50U3RhdGUpIHtcbiAgICAgICAgICAgIGNvbnN0IGFjbEV2ZW50ID0gdGhpcy5yb29tPy5jdXJyZW50U3RhdGUuZ2V0U3RhdGVFdmVudHMoRXZlbnRUeXBlLlJvb21TZXJ2ZXJBY2wsIFwiXCIpO1xuICAgICAgICAgICAgaWYgKGFjbEV2ZW50ICYmIGFjbEV2ZW50LmdldENvbnRlbnQoKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGdldFJlZ2V4ID0gKGhvc3RuYW1lOiBzdHJpbmcpOiBSZWdFeHAgPT4gbmV3IFJlZ0V4cChcIl5cIiArIHV0aWxzLmdsb2JUb1JlZ2V4cChob3N0bmFtZSkgKyBcIiRcIik7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBkZW5pZWQgPSBhY2xFdmVudC5nZXRDb250ZW50PHsgZGVueTogc3RyaW5nW10gfT4oKS5kZW55O1xuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGRlbmllZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVuaWVkLmZvckVhY2goKGgpID0+IGJhbm5lZEhvc3RzUmVnZXhwcy5wdXNoKGdldFJlZ2V4KGgpKSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgYWxsb3dlZCA9IGFjbEV2ZW50LmdldENvbnRlbnQ8eyBhbGxvdzogc3RyaW5nW10gfT4oKS5hbGxvdztcbiAgICAgICAgICAgICAgICBhbGxvd2VkSG9zdHNSZWdleHBzID0gW107IC8vIHdlIGRvbid0IHdhbnQgdG8gdXNlIHRoZSBkZWZhdWx0IHJ1bGUgaGVyZVxuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGRlbmllZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgYWxsb3dlZC5mb3JFYWNoKChoKSA9PiBhbGxvd2VkSG9zdHNSZWdleHBzLnB1c2goZ2V0UmVnZXgoaCkpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5iYW5uZWRIb3N0c1JlZ2V4cHMgPSBiYW5uZWRIb3N0c1JlZ2V4cHM7XG4gICAgICAgIHRoaXMuYWxsb3dlZEhvc3RzUmVnZXhwcyA9IGFsbG93ZWRIb3N0c1JlZ2V4cHM7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSB1cGRhdGVQb3B1bGF0aW9uTWFwKCk6IHZvaWQge1xuICAgICAgICBjb25zdCBwb3B1bGF0aW9uTWFwOiB7IFtzZXJ2ZXI6IHN0cmluZ106IG51bWJlciB9ID0ge307XG4gICAgICAgIGlmICh0aGlzLnJvb20pIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgbWVtYmVyIG9mIHRoaXMucm9vbS5nZXRKb2luZWRNZW1iZXJzKCkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzZXJ2ZXJOYW1lID0gZ2V0U2VydmVyTmFtZShtZW1iZXIudXNlcklkKTtcbiAgICAgICAgICAgICAgICBpZiAoIXBvcHVsYXRpb25NYXBbc2VydmVyTmFtZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgcG9wdWxhdGlvbk1hcFtzZXJ2ZXJOYW1lXSA9IDA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHBvcHVsYXRpb25NYXBbc2VydmVyTmFtZV0rKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLnBvcHVsYXRpb25NYXAgPSBwb3B1bGF0aW9uTWFwO1xuICAgIH1cblxuICAgIHByaXZhdGUgdXBkYXRlU2VydmVyQ2FuZGlkYXRlcyA9ICgpOiB2b2lkID0+IHtcbiAgICAgICAgY29uc3QgY2FuZGlkYXRlcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgICBpZiAodGhpcy5oaWdoZXN0UGxVc2VySWQpIHtcbiAgICAgICAgICAgIGNhbmRpZGF0ZXMuYWRkKGdldFNlcnZlck5hbWUodGhpcy5oaWdoZXN0UGxVc2VySWQpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNlcnZlcnNCeVBvcHVsYXRpb24gPSBPYmplY3Qua2V5cyh0aGlzLnBvcHVsYXRpb25NYXApLnNvcnQoXG4gICAgICAgICAgICAoYSwgYikgPT4gdGhpcy5wb3B1bGF0aW9uTWFwW2JdIC0gdGhpcy5wb3B1bGF0aW9uTWFwW2FdLFxuICAgICAgICApO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2VydmVyc0J5UG9wdWxhdGlvbi5sZW5ndGggJiYgY2FuZGlkYXRlcy5zaXplIDwgTUFYX1NFUlZFUl9DQU5ESURBVEVTOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHNlcnZlck5hbWUgPSBzZXJ2ZXJzQnlQb3B1bGF0aW9uW2ldO1xuICAgICAgICAgICAgY29uc3QgZG9tYWluID0gZ2V0SG9zdG5hbWVGcm9tTWF0cml4U2VydmVyTmFtZShzZXJ2ZXJOYW1lKSA/PyBcIlwiO1xuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICFjYW5kaWRhdGVzLmhhcyhzZXJ2ZXJOYW1lKSAmJlxuICAgICAgICAgICAgICAgICFpc0hvc3RuYW1lSXBBZGRyZXNzKGRvbWFpbikgJiZcbiAgICAgICAgICAgICAgICAhaXNIb3N0SW5SZWdleChkb21haW4sIHRoaXMuYmFubmVkSG9zdHNSZWdleHBzKSAmJlxuICAgICAgICAgICAgICAgIGlzSG9zdEluUmVnZXgoZG9tYWluLCB0aGlzLmFsbG93ZWRIb3N0c1JlZ2V4cHMpXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICBjYW5kaWRhdGVzLmFkZChzZXJ2ZXJOYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3NlcnZlckNhbmRpZGF0ZXMgPSBbLi4uY2FuZGlkYXRlc107XG4gICAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1ha2VHZW5lcmljUGVybWFsaW5rKGVudGl0eUlkOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBnZXRQZXJtYWxpbmtDb25zdHJ1Y3RvcigpLmZvckVudGl0eShlbnRpdHlJZCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtYWtlVXNlclBlcm1hbGluayh1c2VySWQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGdldFBlcm1hbGlua0NvbnN0cnVjdG9yKCkuZm9yVXNlcih1c2VySWQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWFrZVJvb21QZXJtYWxpbmsobWF0cml4Q2xpZW50OiBNYXRyaXhDbGllbnQsIHJvb21JZDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBpZiAoIXJvb21JZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJjYW4ndCBwZXJtYWxpbmsgYSBmYWxzeSByb29tSWRcIik7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlIHJvb21JZCBpc24ndCBhY3R1YWxseSBhIHJvb20gSUQsIGRvbid0IHRyeSB0byBsaXN0IHRoZSBzZXJ2ZXJzLlxuICAgIC8vIEFsaWFzZXMgYXJlIGFscmVhZHkgcm91dGFibGUsIGFuZCBkb24ndCBuZWVkIGV4dHJhIGluZm9ybWF0aW9uLlxuICAgIGlmIChyb29tSWRbMF0gIT09IFwiIVwiKSByZXR1cm4gZ2V0UGVybWFsaW5rQ29uc3RydWN0b3IoKS5mb3JSb29tKHJvb21JZCwgW10pO1xuXG4gICAgY29uc3Qgcm9vbSA9IG1hdHJpeENsaWVudC5nZXRSb29tKHJvb21JZCk7XG4gICAgaWYgKCFyb29tKSB7XG4gICAgICAgIHJldHVybiBnZXRQZXJtYWxpbmtDb25zdHJ1Y3RvcigpLmZvclJvb20ocm9vbUlkLCBbXSk7XG4gICAgfVxuICAgIGNvbnN0IHBlcm1hbGlua0NyZWF0b3IgPSBuZXcgUm9vbVBlcm1hbGlua0NyZWF0b3Iocm9vbSk7XG4gICAgcGVybWFsaW5rQ3JlYXRvci5sb2FkKCk7XG4gICAgcmV0dXJuIHBlcm1hbGlua0NyZWF0b3IuZm9yU2hhcmVhYmxlUm9vbSgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNQZXJtYWxpbmtIb3N0KGhvc3Q6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIC8vIEFsd2F5cyBjaGVjayBpZiB0aGUgcGVybWFsaW5rIGlzIGEgc3BlYyBwZXJtYWxpbmsgKGNhbGxlcnMgYXJlIGxpa2VseSB0byBjYWxsXG4gICAgLy8gcGFyc2VQZXJtYWxpbmsgYWZ0ZXIgdGhpcyBmdW5jdGlvbikuXG4gICAgaWYgKG5ldyBNYXRyaXhUb1Blcm1hbGlua0NvbnN0cnVjdG9yKCkuaXNQZXJtYWxpbmtIb3N0KGhvc3QpKSByZXR1cm4gdHJ1ZTtcbiAgICByZXR1cm4gZ2V0UGVybWFsaW5rQ29uc3RydWN0b3IoKS5pc1Blcm1hbGlua0hvc3QoaG9zdCk7XG59XG5cbi8qKlxuICogVHJhbnNmb3JtcyBhbiBlbnRpdHkgKHBlcm1hbGluaywgcm9vbSBhbGlhcywgdXNlciBJRCwgZXRjKSBpbnRvIGEgbG9jYWwgVVJMXG4gKiBpZiBwb3NzaWJsZS4gSWYgaXQgaXMgYWxyZWFkeSBhIHBlcm1hbGluayAobWF0cml4LnRvKSBpdCBnZXRzIHJldHVybmVkXG4gKiB1bmNoYW5nZWQuXG4gKiBAcGFyYW0ge3N0cmluZ30gZW50aXR5IFRoZSBlbnRpdHkgdG8gdHJhbnNmb3JtLlxuICogQHJldHVybnMge3N0cmluZ3xudWxsfSBUaGUgdHJhbnNmb3JtZWQgcGVybWFsaW5rIG9yIG51bGwgaWYgdW5hYmxlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdHJ5VHJhbnNmb3JtRW50aXR5VG9QZXJtYWxpbmsobWF0cml4Q2xpZW50OiBNYXRyaXhDbGllbnQsIGVudGl0eTogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgaWYgKCFlbnRpdHkpIHJldHVybiBudWxsO1xuXG4gICAgLy8gQ2hlY2sgdG8gc2VlIGlmIGl0IGlzIGEgYmFyZSBlbnRpdHkgZm9yIHN0YXJ0ZXJzXG4gICAgaWYgKGVudGl0eVswXSA9PT0gXCIjXCIgfHwgZW50aXR5WzBdID09PSBcIiFcIikgcmV0dXJuIG1ha2VSb29tUGVybWFsaW5rKG1hdHJpeENsaWVudCwgZW50aXR5KTtcbiAgICBpZiAoZW50aXR5WzBdID09PSBcIkBcIikgcmV0dXJuIG1ha2VVc2VyUGVybWFsaW5rKGVudGl0eSk7XG5cbiAgICBpZiAoZW50aXR5LnNsaWNlKDAsIDcpID09PSBcIm1hdHJpeDpcIikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcGVybWFsaW5rUGFydHMgPSBwYXJzZVBlcm1hbGluayhlbnRpdHkpO1xuICAgICAgICAgICAgaWYgKHBlcm1hbGlua1BhcnRzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHBlcm1hbGlua1BhcnRzLnJvb21JZE9yQWxpYXMpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZXZlbnRJZFBhcnQgPSBwZXJtYWxpbmtQYXJ0cy5ldmVudElkID8gYC8ke3Blcm1hbGlua1BhcnRzLmV2ZW50SWR9YCA6IFwiXCI7XG4gICAgICAgICAgICAgICAgICAgIGxldCBwbCA9IG1hdHJpeHRvQmFzZVVybCArIGAvIy8ke3Blcm1hbGlua1BhcnRzLnJvb21JZE9yQWxpYXN9JHtldmVudElkUGFydH1gO1xuICAgICAgICAgICAgICAgICAgICBpZiAocGVybWFsaW5rUGFydHMudmlhU2VydmVycz8ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwbCArPSBuZXcgTWF0cml4VG9QZXJtYWxpbmtDb25zdHJ1Y3RvcigpLmVuY29kZVNlcnZlckNhbmRpZGF0ZXMocGVybWFsaW5rUGFydHMudmlhU2VydmVycyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHBsO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAocGVybWFsaW5rUGFydHMudXNlcklkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBtYXRyaXh0b0Jhc2VVcmwgKyBgLyMvJHtwZXJtYWxpbmtQYXJ0cy51c2VySWR9YDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2gge31cbiAgICB9XG5cbiAgICByZXR1cm4gZW50aXR5O1xufVxuXG4vKipcbiAqIFRyYW5zZm9ybXMgYSBwZXJtYWxpbmsgKG9yIHBvc3NpYmxlIHBlcm1hbGluaykgaW50byBhIGxvY2FsIFVSTCBpZiBwb3NzaWJsZS4gSWZcbiAqIHRoZSBnaXZlbiBwZXJtYWxpbmsgaXMgZm91bmQgdG8gbm90IGJlIGEgcGVybWFsaW5rLCBpdCdsbCBiZSByZXR1cm5lZCB1bmFsdGVyZWQuXG4gKiBAcGFyYW0ge3N0cmluZ30gcGVybWFsaW5rIFRoZSBwZXJtYWxpbmsgdG8gdHJ5IGFuZCB0cmFuc2Zvcm0uXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgdHJhbnNmb3JtZWQgcGVybWFsaW5rIG9yIG9yaWdpbmFsIFVSTCBpZiB1bmFibGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cnlUcmFuc2Zvcm1QZXJtYWxpbmtUb0xvY2FsSHJlZihwZXJtYWxpbms6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgaWYgKFxuICAgICAgICAhcGVybWFsaW5rLnN0YXJ0c1dpdGgoXCJodHRwOlwiKSAmJlxuICAgICAgICAhcGVybWFsaW5rLnN0YXJ0c1dpdGgoXCJodHRwczpcIikgJiZcbiAgICAgICAgIXBlcm1hbGluay5zdGFydHNXaXRoKFwibWF0cml4OlwiKSAmJlxuICAgICAgICAhcGVybWFsaW5rLnN0YXJ0c1dpdGgoXCJ2ZWN0b3I6XCIpIC8vIEVsZW1lbnQgRGVza3RvcFxuICAgICkge1xuICAgICAgICByZXR1cm4gcGVybWFsaW5rO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IG0gPSBkZWNvZGVVUklDb21wb25lbnQocGVybWFsaW5rKS5tYXRjaChFTEVNRU5UX1VSTF9QQVRURVJOKTtcbiAgICAgICAgaWYgKG0pIHtcbiAgICAgICAgICAgIHJldHVybiBtWzFdO1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvLyBOb3QgYSB2YWxpZCBVUklcbiAgICAgICAgcmV0dXJuIHBlcm1hbGluaztcbiAgICB9XG5cbiAgICAvLyBBIGJpdCBvZiBhIGhhY2sgdG8gY29udmVydCBwZXJtYWxpbmtzIG9mIHVua25vd24gb3JpZ2luIHRvIEVsZW1lbnQgbGlua3NcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBwZXJtYWxpbmtQYXJ0cyA9IHBhcnNlUGVybWFsaW5rKHBlcm1hbGluayk7XG4gICAgICAgIGlmIChwZXJtYWxpbmtQYXJ0cykge1xuICAgICAgICAgICAgaWYgKHBlcm1hbGlua1BhcnRzLnJvb21JZE9yQWxpYXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBldmVudElkUGFydCA9IHBlcm1hbGlua1BhcnRzLmV2ZW50SWQgPyBgLyR7cGVybWFsaW5rUGFydHMuZXZlbnRJZH1gIDogXCJcIjtcbiAgICAgICAgICAgICAgICBwZXJtYWxpbmsgPSBgIy9yb29tLyR7cGVybWFsaW5rUGFydHMucm9vbUlkT3JBbGlhc30ke2V2ZW50SWRQYXJ0fWA7XG4gICAgICAgICAgICAgICAgaWYgKHBlcm1hbGlua1BhcnRzLnZpYVNlcnZlcnM/Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBwZXJtYWxpbmsgKz0gbmV3IE1hdHJpeFRvUGVybWFsaW5rQ29uc3RydWN0b3IoKS5lbmNvZGVTZXJ2ZXJDYW5kaWRhdGVzKHBlcm1hbGlua1BhcnRzLnZpYVNlcnZlcnMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAocGVybWFsaW5rUGFydHMudXNlcklkKSB7XG4gICAgICAgICAgICAgICAgcGVybWFsaW5rID0gYCMvdXNlci8ke3Blcm1hbGlua1BhcnRzLnVzZXJJZH1gO1xuICAgICAgICAgICAgfSAvLyBlbHNlIG5vdCBhIHZhbGlkIHBlcm1hbGluayBmb3Igb3VyIHB1cnBvc2VzIC0gZG8gbm90IGhhbmRsZVxuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvLyBOb3QgYW4gaHJlZiB3ZSBuZWVkIHRvIGNhcmUgYWJvdXRcbiAgICB9XG5cbiAgICByZXR1cm4gcGVybWFsaW5rO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UHJpbWFyeVBlcm1hbGlua0VudGl0eShwZXJtYWxpbms6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICAgIHRyeSB7XG4gICAgICAgIGxldCBwZXJtYWxpbmtQYXJ0cyA9IHBhcnNlUGVybWFsaW5rKHBlcm1hbGluayk7XG5cbiAgICAgICAgLy8gSWYgbm90IGEgcGVybWFsaW5rLCB0cnkgdGhlIHZlY3RvciBwYXR0ZXJucy5cbiAgICAgICAgaWYgKCFwZXJtYWxpbmtQYXJ0cykge1xuICAgICAgICAgICAgY29uc3QgbSA9IHBlcm1hbGluay5tYXRjaChFTEVNRU5UX1VSTF9QQVRURVJOKTtcbiAgICAgICAgICAgIGlmIChtKSB7XG4gICAgICAgICAgICAgICAgLy8gQSBiaXQgb2YgYSBoYWNrLCBidXQgaXQgZ2V0cyB0aGUgam9iIGRvbmVcbiAgICAgICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gbmV3IEVsZW1lbnRQZXJtYWxpbmtDb25zdHJ1Y3RvcihcImh0dHA6Ly9sb2NhbGhvc3RcIik7XG4gICAgICAgICAgICAgICAgY29uc3QgZW50aXR5SW5mbyA9IG1bMV0uc3BsaXQoXCIjXCIpLnNsaWNlKDEpLmpvaW4oXCIjXCIpO1xuICAgICAgICAgICAgICAgIHBlcm1hbGlua1BhcnRzID0gaGFuZGxlci5wYXJzZVBlcm1hbGluayhgaHR0cDovL2xvY2FsaG9zdC8jJHtlbnRpdHlJbmZvfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFwZXJtYWxpbmtQYXJ0cykgcmV0dXJuIG51bGw7IC8vIG5vdCBwcm9jZXNzYWJsZVxuICAgICAgICBpZiAocGVybWFsaW5rUGFydHMudXNlcklkKSByZXR1cm4gcGVybWFsaW5rUGFydHMudXNlcklkO1xuICAgICAgICBpZiAocGVybWFsaW5rUGFydHMucm9vbUlkT3JBbGlhcykgcmV0dXJuIHBlcm1hbGlua1BhcnRzLnJvb21JZE9yQWxpYXM7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvLyBubyBlbnRpdHkgLSBub3QgYSBwZXJtYWxpbmtcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gZ2V0UGVybWFsaW5rQ29uc3RydWN0b3IoKTogUGVybWFsaW5rQ29uc3RydWN0b3Ige1xuICAgIGNvbnN0IGVsZW1lbnRQcmVmaXggPSBTZGtDb25maWcuZ2V0KFwicGVybWFsaW5rX3ByZWZpeFwiKTtcbiAgICBpZiAoZWxlbWVudFByZWZpeCAmJiBlbGVtZW50UHJlZml4ICE9PSBtYXRyaXh0b0Jhc2VVcmwpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBFbGVtZW50UGVybWFsaW5rQ29uc3RydWN0b3IoZWxlbWVudFByZWZpeCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBNYXRyaXhUb1Blcm1hbGlua0NvbnN0cnVjdG9yKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVBlcm1hbGluayhmdWxsVXJsOiBzdHJpbmcpOiBQZXJtYWxpbmtQYXJ0cyB8IG51bGwge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGVsZW1lbnRQcmVmaXggPSBTZGtDb25maWcuZ2V0KFwicGVybWFsaW5rX3ByZWZpeFwiKTtcbiAgICAgICAgY29uc3QgZGVjb2RlZFVybCA9IGRlY29kZVVSSUNvbXBvbmVudChmdWxsVXJsKTtcbiAgICAgICAgaWYgKG5ldyBSZWdFeHAobWF0cml4VG9CYXNlVXJsUGF0dGVybiwgXCJpXCIpLnRlc3QoZGVjb2RlZFVybCkpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgTWF0cml4VG9QZXJtYWxpbmtDb25zdHJ1Y3RvcigpLnBhcnNlUGVybWFsaW5rKGRlY29kZWRVcmwpO1xuICAgICAgICB9IGVsc2UgaWYgKGZ1bGxVcmwuc3RhcnRzV2l0aChcIm1hdHJpeDpcIikpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgTWF0cml4U2NoZW1lUGVybWFsaW5rQ29uc3RydWN0b3IoKS5wYXJzZVBlcm1hbGluayhmdWxsVXJsKTtcbiAgICAgICAgfSBlbHNlIGlmIChlbGVtZW50UHJlZml4ICYmIGZ1bGxVcmwuc3RhcnRzV2l0aChlbGVtZW50UHJlZml4KSkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBFbGVtZW50UGVybWFsaW5rQ29uc3RydWN0b3IoZWxlbWVudFByZWZpeCkucGFyc2VQZXJtYWxpbmsoZnVsbFVybCk7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcihcIkZhaWxlZCB0byBwYXJzZSBwZXJtYWxpbmtcIiwgZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7IC8vIG5vdCBhIHBlcm1hbGluayB3ZSBjYW4gaGFuZGxlXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTZXJ2ZXJOYW1lKHVzZXJJZDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdXNlcklkLnNwbGl0KFwiOlwiKS5zcGxpY2UoMSkuam9pbihcIjpcIik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRIb3N0bmFtZUZyb21NYXRyaXhTZXJ2ZXJOYW1lKHNlcnZlck5hbWU6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICAgIGlmICghc2VydmVyTmFtZSkgcmV0dXJuIG51bGw7XG4gICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIG5ldyBVUkwoYGh0dHBzOi8vJHtzZXJ2ZXJOYW1lfWApLmhvc3RuYW1lO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGVuY291bnRlcmVkIHdoaWxlIGV4dHJhY3RpbmcgaG9zdG5hbWUgZnJvbSBzZXJ2ZXIgbmFtZVwiLCBlKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBpc0hvc3RJblJlZ2V4KGhvc3RuYW1lOiBzdHJpbmcsIHJlZ2V4cHM6IFJlZ0V4cFtdKTogYm9vbGVhbiB7XG4gICAgaWYgKCFob3N0bmFtZSkgcmV0dXJuIHRydWU7IC8vIGFzc3VtZWRcbiAgICBpZiAocmVnZXhwcy5sZW5ndGggPiAwICYmICFyZWdleHBzWzBdLnRlc3QpIHRocm93IG5ldyBFcnJvcihyZWdleHBzWzBdLnRvU3RyaW5nKCkpO1xuXG4gICAgcmV0dXJuIHJlZ2V4cHMuc29tZSgoaCkgPT4gaC50ZXN0KGhvc3RuYW1lKSk7XG59XG5cbmZ1bmN0aW9uIGlzSG9zdG5hbWVJcEFkZHJlc3MoaG9zdG5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGlmICghaG9zdG5hbWUpIHJldHVybiBmYWxzZTtcblxuICAgIC8vIGlzLWlwIGRvZXNuJ3Qgd2FudCBJUHY2IGFkZHJlc3NlcyBzdXJyb3VuZGVkIGJ5IGJyYWNrZXRzLCBzb1xuICAgIC8vIHRha2UgdGhlbSBvZmYuXG4gICAgaWYgKGhvc3RuYW1lLnN0YXJ0c1dpdGgoXCJbXCIpICYmIGhvc3RuYW1lLmVuZHNXaXRoKFwiXVwiKSkge1xuICAgICAgICBob3N0bmFtZSA9IGhvc3RuYW1lLnN1YnN0cmluZygxLCBob3N0bmFtZS5sZW5ndGggLSAxKTtcbiAgICB9XG5cbiAgICByZXR1cm4gaXNJcChob3N0bmFtZSk7XG59XG5cbmV4cG9ydCBjb25zdCBjYWxjdWxhdGVSb29tVmlhID0gKHJvb206IFJvb20pOiBzdHJpbmdbXSA9PiB7XG4gICAgY29uc3QgcGVybWFsaW5rQ3JlYXRvciA9IG5ldyBSb29tUGVybWFsaW5rQ3JlYXRvcihyb29tKTtcbiAgICBwZXJtYWxpbmtDcmVhdG9yLmxvYWQoKTtcbiAgICByZXR1cm4gcGVybWFsaW5rQ3JlYXRvci5zZXJ2ZXJDYW5kaWRhdGVzID8/IFtdO1xufTtcbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBZ0JBLElBQUFBLEtBQUEsR0FBQUMsc0JBQUEsQ0FBQUMsT0FBQTtBQUNBLElBQUFDLEtBQUEsR0FBQUMsdUJBQUEsQ0FBQUYsT0FBQTtBQUVBLElBQUFHLE9BQUEsR0FBQUgsT0FBQTtBQUNBLElBQUFJLFVBQUEsR0FBQUosT0FBQTtBQUNBLElBQUFLLE1BQUEsR0FBQUwsT0FBQTtBQUdBLElBQUFNLDZCQUFBLEdBQUFKLHVCQUFBLENBQUFGLE9BQUE7QUFLQSxJQUFBTyw0QkFBQSxHQUFBUixzQkFBQSxDQUFBQyxPQUFBO0FBQ0EsSUFBQVEsVUFBQSxHQUFBVCxzQkFBQSxDQUFBQyxPQUFBO0FBQ0EsSUFBQVMsY0FBQSxHQUFBVCxPQUFBO0FBQ0EsSUFBQVUsaUNBQUEsR0FBQVgsc0JBQUEsQ0FBQUMsT0FBQTtBQUFrRixTQUFBVyx5QkFBQUMsV0FBQSxlQUFBQyxPQUFBLGtDQUFBQyxpQkFBQSxPQUFBRCxPQUFBLFFBQUFFLGdCQUFBLE9BQUFGLE9BQUEsWUFBQUYsd0JBQUEsWUFBQUEsQ0FBQUMsV0FBQSxXQUFBQSxXQUFBLEdB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