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
//# sourceMappingURL=Permalinks.js.map