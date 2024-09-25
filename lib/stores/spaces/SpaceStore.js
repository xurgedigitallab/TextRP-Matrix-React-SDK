"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getChildOrder = exports.default = exports.SpaceStoreClass = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _lodash = require("lodash");
var _event = require("matrix-js-sdk/src/@types/event");
var _room = require("matrix-js-sdk/src/models/room");
var _client = require("matrix-js-sdk/src/client");
var _logger = require("matrix-js-sdk/src/logger");
var _roomState = require("matrix-js-sdk/src/models/room-state");
var _AsyncStoreWithClient = require("../AsyncStoreWithClient");
var _dispatcher = _interopRequireDefault(require("../../dispatcher/dispatcher"));
var _RoomListStore = _interopRequireDefault(require("../room-list/RoomListStore"));
var _SettingsStore = _interopRequireDefault(require("../../settings/SettingsStore"));
var _DMRoomMap = _interopRequireDefault(require("../../utils/DMRoomMap"));
var _SpaceNotificationState = require("../notifications/SpaceNotificationState");
var _RoomNotificationStateStore = require("../notifications/RoomNotificationStateStore");
var _models = require("../room-list/models");
var _maps = require("../../utils/maps");
var _sets = require("../../utils/sets");
var _actions = require("../../dispatcher/actions");
var _arrays = require("../../utils/arrays");
var _stringOrderField = require("../../utils/stringOrderField");
var _RoomList = require("../../components/views/rooms/RoomList");
var _ = require(".");
var _RoomAliasCache = require("../../RoomAliasCache");
var _membership = require("../../utils/membership");
var _flattenSpaceHierarchy = require("./flattenSpaceHierarchy");
var _PosthogAnalytics = require("../../PosthogAnalytics");
var _SDKContext = require("../../contexts/SDKContext");
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         Copyright 2021 - 2022 The Matrix.org Foundation C.I.C.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         
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
const ACTIVE_SPACE_LS_KEY = "mx_active_space";
const metaSpaceOrder = [_.MetaSpace.Home, _.MetaSpace.Favourites, _.MetaSpace.People, _.MetaSpace.Orphans];
const MAX_SUGGESTED_ROOMS = 20;
const getSpaceContextKey = space => `mx_space_context_${space}`;
const partitionSpacesAndRooms = arr => {
  // [spaces, rooms]
  return arr.reduce((result, room) => {
    result[room.isSpaceRoom() ? 0 : 1].push(room);
    return result;
  }, [[], []]);
};
const validOrder = order => {
  if (typeof order === "string" && order.length <= 50 && Array.from(order).every(c => {
    const charCode = c.charCodeAt(0);
    return charCode >= 0x20 && charCode <= 0x7e;
  })) {
    return order;
  }
};

// For sorting space children using a validated `order`, `origin_server_ts`, `room_id`
const getChildOrder = (order, ts, roomId) => {
  return [validOrder(order) ?? NaN, ts, roomId]; // NaN has lodash sort it at the end in asc
};
exports.getChildOrder = getChildOrder;
const getRoomFn = room => {
  return _RoomNotificationStateStore.RoomNotificationStateStore.instance.getRoomState(room);
};
class SpaceStoreClass extends _AsyncStoreWithClient.AsyncStoreWithClient {
  constructor() {
    var _this;
    super(_dispatcher.default, {});
    _this = this;
    // The spaces representing the roots of the various tree-like hierarchies
    (0, _defineProperty2.default)(this, "rootSpaces", []);
    // Map from room/space ID to set of spaces which list it as a child
    (0, _defineProperty2.default)(this, "parentMap", new _maps.EnhancedMap());
    // Map from SpaceKey to SpaceNotificationState instance representing that space
    (0, _defineProperty2.default)(this, "notificationStateMap", new Map());
    // Map from SpaceKey to Set of room IDs that are direct descendants of that space
    (0, _defineProperty2.default)(this, "roomIdsBySpace", new Map());
    // won't contain MetaSpace.People
    // Map from space id to Set of space keys that are direct descendants of that space
    // meta spaces do not have descendants
    (0, _defineProperty2.default)(this, "childSpacesBySpace", new Map());
    // Map from space id to Set of user IDs that are direct descendants of that space
    (0, _defineProperty2.default)(this, "userIdsBySpace", new Map());
    // cache that stores the aggregated lists of roomIdsBySpace and userIdsBySpace
    // cleared on changes
    (0, _defineProperty2.default)(this, "_aggregatedSpaceCache", {
      roomIdsBySpace: new Map(),
      userIdsBySpace: new Map()
    });
    // The space currently selected in the Space Panel
    (0, _defineProperty2.default)(this, "_activeSpace", _.MetaSpace.Home);
    // set properly by onReady
    (0, _defineProperty2.default)(this, "_suggestedRooms", []);
    (0, _defineProperty2.default)(this, "_invitedSpaces", new Set());
    (0, _defineProperty2.default)(this, "spaceOrderLocalEchoMap", new Map());
    // The following properties are set by onReady as they live in account_data
    (0, _defineProperty2.default)(this, "_allRoomsInHome", false);
    (0, _defineProperty2.default)(this, "_enabledMetaSpaces", []);
    /** Whether the feature flag is set for MSC3946 */
    (0, _defineProperty2.default)(this, "_msc3946ProcessDynamicPredecessor", _SettingsStore.default.getValue("feature_dynamic_room_predecessors"));
    (0, _defineProperty2.default)(this, "fetchSuggestedRooms", async function (space) {
      let limit = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : MAX_SUGGESTED_ROOMS;
      try {
        const {
          rooms
        } = await _this.matrixClient.getRoomHierarchy(space.roomId, limit, 1, true);
        const viaMap = new _maps.EnhancedMap();
        rooms.forEach(room => {
          room.children_state.forEach(ev => {
            if (ev.type === _event.EventType.SpaceChild && ev.content.via?.length) {
              ev.content.via.forEach(via => {
                viaMap.getOrCreate(ev.state_key, new Set()).add(via);
              });
            }
          });
        });
        return rooms.filter(roomInfo => {
          return roomInfo.room_type !== _event.RoomType.Space && _this.matrixClient?.getRoom(roomInfo.room_id)?.getMyMembership() !== "join";
        }).map(roomInfo => _objectSpread(_objectSpread({}, roomInfo), {}, {
          viaServers: Array.from(viaMap.get(roomInfo.room_id) || [])
        }));
      } catch (e) {
        _logger.logger.error(e);
      }
      return [];
    });
    // get all rooms in a space
    // including descendant spaces
    (0, _defineProperty2.default)(this, "getSpaceFilteredRoomIds", function (space) {
      let includeDescendantSpaces = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
      let useCache = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
      if (space === _.MetaSpace.Home && _this.allRoomsInHome) {
        return new Set(_this.matrixClient.getVisibleRooms(_this._msc3946ProcessDynamicPredecessor).map(r => r.roomId));
      }

      // meta spaces never have descendants
      // and the aggregate cache is not managed for meta spaces
      if (!includeDescendantSpaces || (0, _.isMetaSpace)(space)) {
        return _this.roomIdsBySpace.get(space) || new Set();
      }
      return _this.getAggregatedRoomIdsBySpace(_this.roomIdsBySpace, _this.childSpacesBySpace, space, useCache);
    });
    (0, _defineProperty2.default)(this, "getSpaceFilteredUserIds", function (space) {
      let includeDescendantSpaces = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
      let useCache = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
      if (space === _.MetaSpace.Home && _this.allRoomsInHome) {
        return undefined;
      }
      if ((0, _.isMetaSpace)(space)) {
        return undefined;
      }

      // meta spaces never have descendants
      // and the aggregate cache is not managed for meta spaces
      if (!includeDescendantSpaces || (0, _.isMetaSpace)(space)) {
        return _this.userIdsBySpace.get(space) || new Set();
      }
      return _this.getAggregatedUserIdsBySpace(_this.userIdsBySpace, _this.childSpacesBySpace, space, useCache);
    });
    (0, _defineProperty2.default)(this, "getAggregatedRoomIdsBySpace", (0, _flattenSpaceHierarchy.flattenSpaceHierarchyWithCache)(this._aggregatedSpaceCache.roomIdsBySpace));
    (0, _defineProperty2.default)(this, "getAggregatedUserIdsBySpace", (0, _flattenSpaceHierarchy.flattenSpaceHierarchyWithCache)(this._aggregatedSpaceCache.userIdsBySpace));
    (0, _defineProperty2.default)(this, "markTreeChildren", (rootSpace, unseen) => {
      const stack = [rootSpace];
      while (stack.length) {
        const space = stack.pop();
        unseen.delete(space);
        this.getChildSpaces(space.roomId).forEach(space => {
          if (unseen.has(space)) {
            stack.push(space);
          }
        });
      }
    });
    (0, _defineProperty2.default)(this, "findRootSpaces", joinedSpaces => {
      // exclude invited spaces from unseenChildren as they will be forcibly shown at the top level of the treeview
      const unseenSpaces = new Set(joinedSpaces);
      joinedSpaces.forEach(space => {
        this.getChildSpaces(space.roomId).forEach(subspace => {
          unseenSpaces.delete(subspace);
        });
      });

      // Consider any spaces remaining in unseenSpaces as root,
      // given they are not children of any known spaces.
      // The hierarchy from these roots may not yet be exhaustive due to the possibility of full-cycles.
      const rootSpaces = Array.from(unseenSpaces);

      // Next we need to determine the roots of any remaining full-cycles.
      // We sort spaces by room ID to force the cycle breaking to be deterministic.
      const detachedNodes = new Set((0, _lodash.sortBy)(joinedSpaces, space => space.roomId));

      // Mark any nodes which are children of our existing root spaces as attached.
      rootSpaces.forEach(rootSpace => {
        this.markTreeChildren(rootSpace, detachedNodes);
      });

      // Handle spaces forming fully cyclical relationships.
      // In order, assume each remaining detachedNode is a root unless it has already
      // been claimed as the child of prior detached node.
      // Work from a copy of the detachedNodes set as it will be mutated as part of this operation.
      // TODO consider sorting by number of in-refs to favour nodes with fewer parents.
      Array.from(detachedNodes).forEach(detachedNode => {
        if (!detachedNodes.has(detachedNode)) return; // already claimed, skip
        // declare this detached node a new root, find its children, without ever looping back to it
        rootSpaces.push(detachedNode); // consider this node a new root space
        this.markTreeChildren(detachedNode, detachedNodes); // declare this node and its children attached
      });

      return rootSpaces;
    });
    (0, _defineProperty2.default)(this, "rebuildSpaceHierarchy", () => {
      if (!this.matrixClient) return;
      const visibleSpaces = this.matrixClient.getVisibleRooms(this._msc3946ProcessDynamicPredecessor).filter(r => r.isSpaceRoom());
      const [joinedSpaces, invitedSpaces] = visibleSpaces.reduce((_ref, s) => {
        let [joined, invited] = _ref;
        switch ((0, _membership.getEffectiveMembership)(s.getMyMembership())) {
          case _membership.EffectiveMembership.Join:
            joined.push(s);
            break;
          case _membership.EffectiveMembership.Invite:
            invited.push(s);
            break;
        }
        return [joined, invited];
      }, [[], []]);
      const rootSpaces = this.findRootSpaces(joinedSpaces);
      const oldRootSpaces = this.rootSpaces;
      this.rootSpaces = this.sortRootSpaces(rootSpaces);
      this.onRoomsUpdate();
      if ((0, _arrays.arrayHasOrderChange)(oldRootSpaces, this.rootSpaces)) {
        this.emit(_.UPDATE_TOP_LEVEL_SPACES, this.spacePanelSpaces, this.enabledMetaSpaces);
      }
      const oldInvitedSpaces = this._invitedSpaces;
      this._invitedSpaces = new Set(this.sortRootSpaces(invitedSpaces));
      if ((0, _sets.setHasDiff)(oldInvitedSpaces, this._invitedSpaces)) {
        this.emit(_.UPDATE_INVITED_SPACES, this.invitedSpaces);
      }
    });
    (0, _defineProperty2.default)(this, "rebuildParentMap", () => {
      if (!this.matrixClient) return;
      const joinedSpaces = this.matrixClient.getVisibleRooms(this._msc3946ProcessDynamicPredecessor).filter(r => {
        return r.isSpaceRoom() && r.getMyMembership() === "join";
      });
      this.parentMap = new _maps.EnhancedMap();
      joinedSpaces.forEach(space => {
        const children = this.getChildren(space.roomId);
        children.forEach(child => {
          this.parentMap.getOrCreate(child.roomId, new Set()).add(space.roomId);
        });
      });
      _PosthogAnalytics.PosthogAnalytics.instance.setProperty("numSpaces", joinedSpaces.length);
    });
    (0, _defineProperty2.default)(this, "rebuildHomeSpace", () => {
      if (this.allRoomsInHome) {
        // this is a special-case to not have to maintain a set of all rooms
        this.roomIdsBySpace.delete(_.MetaSpace.Home);
      } else {
        const rooms = new Set(this.matrixClient.getVisibleRooms(this._msc3946ProcessDynamicPredecessor).filter(this.showInHomeSpace).map(r => r.roomId));
        this.roomIdsBySpace.set(_.MetaSpace.Home, rooms);
      }
      if (this.activeSpace === _.MetaSpace.Home) {
        this.switchSpaceIfNeeded();
      }
    });
    (0, _defineProperty2.default)(this, "rebuildMetaSpaces", () => {
      if (!this.matrixClient) return;
      const enabledMetaSpaces = new Set(this.enabledMetaSpaces);
      const visibleRooms = this.matrixClient.getVisibleRooms(this._msc3946ProcessDynamicPredecessor);
      if (enabledMetaSpaces.has(_.MetaSpace.Home)) {
        this.rebuildHomeSpace();
      } else {
        this.roomIdsBySpace.delete(_.MetaSpace.Home);
      }
      if (enabledMetaSpaces.has(_.MetaSpace.Favourites)) {
        const favourites = visibleRooms.filter(r => r.tags[_models.DefaultTagID.Favourite]);
        this.roomIdsBySpace.set(_.MetaSpace.Favourites, new Set(favourites.map(r => r.roomId)));
      } else {
        this.roomIdsBySpace.delete(_.MetaSpace.Favourites);
      }

      // The People metaspace doesn't need maintaining

      // Populate the orphans space if the Home space is enabled as it is a superset of it.
      // Home is effectively a super set of People + Orphans with the addition of having all invites too.
      if (enabledMetaSpaces.has(_.MetaSpace.Orphans) || enabledMetaSpaces.has(_.MetaSpace.Home)) {
        const orphans = visibleRooms.filter(r => {
          // filter out DMs and rooms with >0 parents
          return !this.parentMap.get(r.roomId)?.size && !_DMRoomMap.default.shared().getUserIdForRoomId(r.roomId);
        });
        this.roomIdsBySpace.set(_.MetaSpace.Orphans, new Set(orphans.map(r => r.roomId)));
      }
      if ((0, _.isMetaSpace)(this.activeSpace)) {
        this.switchSpaceIfNeeded();
      }
    });
    (0, _defineProperty2.default)(this, "updateNotificationStates", spaces => {
      if (!this.matrixClient) return;
      const enabledMetaSpaces = new Set(this.enabledMetaSpaces);
      const visibleRooms = this.matrixClient.getVisibleRooms(this._msc3946ProcessDynamicPredecessor);
      let dmBadgeSpace;
      // only show badges on dms on the most relevant space if such exists
      if (enabledMetaSpaces.has(_.MetaSpace.People)) {
        dmBadgeSpace = _.MetaSpace.People;
      } else if (enabledMetaSpaces.has(_.MetaSpace.Home)) {
        dmBadgeSpace = _.MetaSpace.Home;
      }
      if (!spaces) {
        spaces = [...this.roomIdsBySpace.keys()];
        if (dmBadgeSpace === _.MetaSpace.People) {
          spaces.push(_.MetaSpace.People);
        }
        if (enabledMetaSpaces.has(_.MetaSpace.Home) && !this.allRoomsInHome) {
          spaces.push(_.MetaSpace.Home);
        }
      }
      spaces.forEach(s => {
        if (this.allRoomsInHome && s === _.MetaSpace.Home) return; // we'll be using the global notification state, skip

        const flattenedRoomsForSpace = this.getSpaceFilteredRoomIds(s, true);

        // Update NotificationStates
        this.getNotificationState(s).setRooms(visibleRooms.filter(room => {
          if (s === _.MetaSpace.People) {
            return this.isRoomInSpace(_.MetaSpace.People, room.roomId);
          }
          if (room.isSpaceRoom() || !flattenedRoomsForSpace.has(room.roomId)) return false;
          if (dmBadgeSpace && _DMRoomMap.default.shared().getUserIdForRoomId(room.roomId)) {
            return s === dmBadgeSpace;
          }
          return true;
        }));
      });
      if (dmBadgeSpace !== _.MetaSpace.People) {
        this.notificationStateMap.delete(_.MetaSpace.People);
      }
    });
    (0, _defineProperty2.default)(this, "showInHomeSpace", room => {
      if (this.allRoomsInHome) return true;
      if (room.isSpaceRoom()) return false;
      return !this.parentMap.get(room.roomId)?.size ||
      // put all orphaned rooms in the Home Space
      !!_DMRoomMap.default.shared().getUserIdForRoomId(room.roomId) ||
      // put all DMs in the Home Space
      room.getMyMembership() === "invite"; // put all invites in the Home Space
    });
    // Method for resolving the impact of a single user's membership change in the given Space and its hierarchy
    (0, _defineProperty2.default)(this, "onMemberUpdate", (space, userId) => {
      const inSpace = SpaceStoreClass.isInSpace(space.getMember(userId));
      if (inSpace) {
        this.userIdsBySpace.get(space.roomId)?.add(userId);
      } else {
        this.userIdsBySpace.get(space.roomId)?.delete(userId);
      }

      // bust cache
      this._aggregatedSpaceCache.userIdsBySpace.clear();
      const affectedParentSpaceIds = this.getKnownParents(space.roomId, true);
      this.emit(space.roomId);
      affectedParentSpaceIds.forEach(spaceId => this.emit(spaceId));
      if (!inSpace) {
        // switch space if the DM is no longer considered part of the space
        this.switchSpaceIfNeeded();
      }
    });
    (0, _defineProperty2.default)(this, "onRoomsUpdate", () => {
      if (!this.matrixClient) return;
      const visibleRooms = this.matrixClient.getVisibleRooms(this._msc3946ProcessDynamicPredecessor);
      const prevRoomsBySpace = this.roomIdsBySpace;
      const prevUsersBySpace = this.userIdsBySpace;
      const prevChildSpacesBySpace = this.childSpacesBySpace;
      this.roomIdsBySpace = new Map();
      this.userIdsBySpace = new Map();
      this.childSpacesBySpace = new Map();
      this.rebuildParentMap();
      // mutates this.roomIdsBySpace
      this.rebuildMetaSpaces();
      const hiddenChildren = new _maps.EnhancedMap();
      visibleRooms.forEach(room => {
        if (!["join", "invite"].includes(room.getMyMembership())) return;
        this.getParents(room.roomId).forEach(parent => {
          hiddenChildren.getOrCreate(parent.roomId, new Set()).add(room.roomId);
        });
      });
      this.rootSpaces.forEach(s => {
        // traverse each space tree in DFS to build up the supersets as you go up,
        // reusing results from like subtrees.
        const traverseSpace = (spaceId, parentPath) => {
          if (parentPath.has(spaceId)) return; // prevent cycles
          // reuse existing results if multiple similar branches exist
          if (this.roomIdsBySpace.has(spaceId) && this.userIdsBySpace.has(spaceId)) {
            return [this.roomIdsBySpace.get(spaceId), this.userIdsBySpace.get(spaceId)];
          }
          const [childSpaces, childRooms] = partitionSpacesAndRooms(this.getChildren(spaceId));
          this.childSpacesBySpace.set(spaceId, new Set(childSpaces.map(space => space.roomId)));
          const roomIds = new Set(childRooms.map(r => r.roomId));
          const space = this.matrixClient?.getRoom(spaceId);
          const userIds = new Set(space?.getMembers().filter(m => {
            return m.membership === "join" || m.membership === "invite";
          }).map(m => m.userId));
          const newPath = new Set(parentPath).add(spaceId);
          childSpaces.forEach(childSpace => {
            traverseSpace(childSpace.roomId, newPath);
          });
          hiddenChildren.get(spaceId)?.forEach(roomId => {
            roomIds.add(roomId);
          });

          // Expand room IDs to all known versions of the given rooms
          const expandedRoomIds = new Set(Array.from(roomIds).flatMap(roomId => {
            return this.matrixClient.getRoomUpgradeHistory(roomId, true, this._msc3946ProcessDynamicPredecessor).map(r => r.roomId);
          }));
          this.roomIdsBySpace.set(spaceId, expandedRoomIds);
          this.userIdsBySpace.set(spaceId, userIds);
          return [expandedRoomIds, userIds];
        };
        traverseSpace(s.roomId, new Set());
      });
      const roomDiff = (0, _maps.mapDiff)(prevRoomsBySpace, this.roomIdsBySpace);
      const userDiff = (0, _maps.mapDiff)(prevUsersBySpace, this.userIdsBySpace);
      const spaceDiff = (0, _maps.mapDiff)(prevChildSpacesBySpace, this.childSpacesBySpace);
      // filter out keys which changed by reference only by checking whether the sets differ
      const roomsChanged = roomDiff.changed.filter(k => {
        return (0, _sets.setHasDiff)(prevRoomsBySpace.get(k), this.roomIdsBySpace.get(k));
      });
      const usersChanged = userDiff.changed.filter(k => {
        return (0, _sets.setHasDiff)(prevUsersBySpace.get(k), this.userIdsBySpace.get(k));
      });
      const spacesChanged = spaceDiff.changed.filter(k => {
        return (0, _sets.setHasDiff)(prevChildSpacesBySpace.get(k), this.childSpacesBySpace.get(k));
      });
      const changeSet = new Set([...roomDiff.added, ...userDiff.added, ...spaceDiff.added, ...roomDiff.removed, ...userDiff.removed, ...spaceDiff.removed, ...roomsChanged, ...usersChanged, ...spacesChanged]);
      const affectedParents = Array.from(changeSet).flatMap(changedId => [...this.getKnownParents(changedId, true)]);
      affectedParents.forEach(parentId => changeSet.add(parentId));
      // bust aggregate cache
      this._aggregatedSpaceCache.roomIdsBySpace.clear();
      this._aggregatedSpaceCache.userIdsBySpace.clear();
      changeSet.forEach(k => {
        this.emit(k);
      });
      if (changeSet.has(this.activeSpace)) {
        this.switchSpaceIfNeeded();
      }
      const notificationStatesToUpdate = [...changeSet];
      // We update the People metaspace even if we didn't detect any changes
      // as roomIdsBySpace does not pre-calculate it so we have to assume it could have changed
      if (this.enabledMetaSpaces.includes(_.MetaSpace.People)) {
        notificationStatesToUpdate.push(_.MetaSpace.People);
      }
      this.updateNotificationStates(notificationStatesToUpdate);
    });
    (0, _defineProperty2.default)(this, "switchSpaceIfNeeded", function () {
      let roomId = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : _SDKContext.SdkContextClass.instance.roomViewStore.getRoomId();
      if (!roomId) return;
      if (!_this.isRoomInSpace(_this.activeSpace, roomId) && !_this.matrixClient?.getRoom(roomId)?.isSpaceRoom()) {
        _this.switchToRelatedSpace(roomId);
      }
    });
    (0, _defineProperty2.default)(this, "switchToRelatedSpace", roomId => {
      if (this.suggestedRooms.find(r => r.room_id === roomId)) return;

      // try to find the canonical parent first
      let parent = this.getCanonicalParent(roomId)?.roomId;

      // otherwise, try to find a root space which contains this room
      if (!parent) {
        parent = this.rootSpaces.find(s => this.isRoomInSpace(s.roomId, roomId))?.roomId;
      }

      // otherwise, try to find a metaspace which contains this room
      if (!parent) {
        // search meta spaces in reverse as Home is the first and least specific one
        parent = [...this.enabledMetaSpaces].reverse().find(s => this.isRoomInSpace(s, roomId));
      }

      // don't trigger a context switch when we are switching a space to match the chosen room
      if (parent) {
        this.setActiveSpace(parent, false);
      } else {
        this.goToFirstSpace();
      }
    });
    (0, _defineProperty2.default)(this, "onRoom", (room, newMembership, oldMembership) => {
      const roomMembership = room.getMyMembership();
      if (!roomMembership) {
        // room is still being baked in the js-sdk, we'll process it at Room.myMembership instead
        return;
      }
      const membership = newMembership || roomMembership;
      if (!room.isSpaceRoom()) {
        this.onRoomsUpdate();
        if (membership === "join") {
          // the user just joined a room, remove it from the suggested list if it was there
          const numSuggestedRooms = this._suggestedRooms.length;
          this._suggestedRooms = this._suggestedRooms.filter(r => r.room_id !== room.roomId);
          if (numSuggestedRooms !== this._suggestedRooms.length) {
            this.emit(_.UPDATE_SUGGESTED_ROOMS, this._suggestedRooms);
          }

          // if the room currently being viewed was just joined then switch to its related space
          if (newMembership === "join" && room.roomId === _SDKContext.SdkContextClass.instance.roomViewStore.getRoomId()) {
            this.switchSpaceIfNeeded(room.roomId);
          }
        }
        return;
      }

      // Space
      if (membership === "invite") {
        const len = this._invitedSpaces.size;
        this._invitedSpaces.add(room);
        if (len !== this._invitedSpaces.size) {
          this.emit(_.UPDATE_INVITED_SPACES, this.invitedSpaces);
        }
      } else if (oldMembership === "invite" && membership !== "join") {
        if (this._invitedSpaces.delete(room)) {
          this.emit(_.UPDATE_INVITED_SPACES, this.invitedSpaces);
        }
      } else {
        this.rebuildSpaceHierarchy();
        // fire off updates to all parent listeners
        this.parentMap.get(room.roomId)?.forEach(parentId => {
          this.emit(parentId);
        });
        this.emit(room.roomId);
      }
      if (membership === "join" && room.roomId === _SDKContext.SdkContextClass.instance.roomViewStore.getRoomId()) {
        // if the user was looking at the space and then joined: select that space
        this.setActiveSpace(room.roomId, false);
      } else if (membership === "leave" && room.roomId === this.activeSpace) {
        // user's active space has gone away, go back to home
        this.goToFirstSpace(true);
      }
    });
    (0, _defineProperty2.default)(this, "onRoomState", ev => {
      const room = this.matrixClient?.getRoom(ev.getRoomId());
      if (!this.matrixClient || !room) return;
      switch (ev.getType()) {
        case _event.EventType.SpaceChild:
          {
            const target = this.matrixClient.getRoom(ev.getStateKey());
            if (room.isSpaceRoom()) {
              if (target?.isSpaceRoom()) {
                this.rebuildSpaceHierarchy();
                this.emit(target.roomId);
              } else {
                this.onRoomsUpdate();
              }
              this.emit(room.roomId);
            }
            if (room.roomId === this.activeSpace &&
            // current space
            target?.getMyMembership() !== "join" &&
            // target not joined
            ev.getPrevContent().suggested !== ev.getContent().suggested // suggested flag changed
            ) {
              this.loadSuggestedRooms(room);
            }
            break;
          }
        case _event.EventType.SpaceParent:
          // TODO rebuild the space parent and not the room - check permissions?
          // TODO confirm this after implementing parenting behaviour
          if (room.isSpaceRoom()) {
            this.rebuildSpaceHierarchy();
          } else {
            this.onRoomsUpdate();
          }
          this.emit(room.roomId);
          break;
        case _event.EventType.RoomPowerLevels:
          if (room.isSpaceRoom()) {
            this.onRoomsUpdate();
          }
          break;
      }
    });
    // listening for m.room.member events in onRoomState above doesn't work as the Member object isn't updated by then
    (0, _defineProperty2.default)(this, "onRoomStateMembers", ev => {
      const room = this.matrixClient?.getRoom(ev.getRoomId());
      const userId = ev.getStateKey();
      if (room?.isSpaceRoom() &&
      // only consider space rooms
      _DMRoomMap.default.shared().getDMRoomsForUserId(userId).length > 0 &&
      // only consider members we have a DM with
      ev.getPrevContent().membership !== ev.getContent().membership // only consider when membership changes
      ) {
        this.onMemberUpdate(room, userId);
      }
    });
    (0, _defineProperty2.default)(this, "onRoomAccountData", (ev, room, lastEv) => {
      if (room.isSpaceRoom() && ev.getType() === _event.EventType.SpaceOrder) {
        this.spaceOrderLocalEchoMap.delete(room.roomId); // clear any local echo
        const order = ev.getContent()?.order;
        const lastOrder = lastEv?.getContent()?.order;
        if (order !== lastOrder) {
          this.notifyIfOrderChanged();
        }
      } else if (ev.getType() === _event.EventType.Tag) {
        // If the room was in favourites and now isn't or the opposite then update its position in the trees
        const oldTags = lastEv?.getContent()?.tags || {};
        const newTags = ev.getContent()?.tags || {};
        if (!!oldTags[_models.DefaultTagID.Favourite] !== !!newTags[_models.DefaultTagID.Favourite]) {
          this.onRoomFavouriteChange(room);
        }
      }
    });
    (0, _defineProperty2.default)(this, "onAccountData", (ev, prevEv) => {
      if (ev.getType() === _event.EventType.Direct) {
        const previousRooms = new Set(Object.values(prevEv?.getContent() ?? {}).flat());
        const currentRooms = new Set(Object.values(ev.getContent()).flat());
        const diff = (0, _sets.setDiff)(previousRooms, currentRooms);
        [...diff.added, ...diff.removed].forEach(roomId => {
          const room = this.matrixClient?.getRoom(roomId);
          if (room) {
            this.onRoomDmChange(room, currentRooms.has(roomId));
          }
        });
        if (diff.removed.length > 0) {
          this.switchSpaceIfNeeded();
        }
      }
    });
    (0, _defineProperty2.default)(this, "getSpaceTagOrdering", space => {
      if (this.spaceOrderLocalEchoMap.has(space.roomId)) return this.spaceOrderLocalEchoMap.get(space.roomId);
      return validOrder(space.getAccountData(_event.EventType.SpaceOrder)?.getContent()?.order);
    });
    _SettingsStore.default.monitorSetting("Spaces.allRoomsInHome", null);
    _SettingsStore.default.monitorSetting("Spaces.enabledMetaSpaces", null);
    _SettingsStore.default.monitorSetting("Spaces.showPeopleInSpace", null);
    _SettingsStore.default.monitorSetting("feature_dynamic_room_predecessors", null);
  }
  get invitedSpaces() {
    return Array.from(this._invitedSpaces);
  }
  get enabledMetaSpaces() {
    return this._enabledMetaSpaces;
  }
  get spacePanelSpaces() {
    return this.rootSpaces;
  }
  get activeSpace() {
    return this._activeSpace;
  }
  get activeSpaceRoom() {
    if ((0, _.isMetaSpace)(this._activeSpace)) return null;
    return this.matrixClient?.getRoom(this._activeSpace) ?? null;
  }
  get suggestedRooms() {
    return this._suggestedRooms;
  }
  get allRoomsInHome() {
    return this._allRoomsInHome;
  }
  setActiveRoomInSpace(space) {
    if (!(0, _.isMetaSpace)(space) && !this.matrixClient?.getRoom(space)?.isSpaceRoom()) return;
    if (space !== this.activeSpace) this.setActiveSpace(space, false);
    if (space) {
      const roomId = this.getNotificationState(space).getFirstRoomWithNotifications();
      _dispatcher.default.dispatch({
        action: _actions.Action.ViewRoom,
        room_id: roomId,
        context_switch: true,
        metricsTrigger: "WebSpacePanelNotificationBadge"
      });
    } else {
      const lists = _RoomListStore.default.instance.orderedLists;
      for (let i = 0; i < _RoomList.TAG_ORDER.length; i++) {
        const t = _RoomList.TAG_ORDER[i];
        const listRooms = lists[t];
        const unreadRoom = listRooms.find(r => {
          if (this.showInHomeSpace(r)) {
            const state = _RoomNotificationStateStore.RoomNotificationStateStore.instance.getRoomState(r);
            return state.isUnread;
          }
        });
        if (unreadRoom) {
          _dispatcher.default.dispatch({
            action: _actions.Action.ViewRoom,
            room_id: unreadRoom.roomId,
            context_switch: true,
            metricsTrigger: "WebSpacePanelNotificationBadge"
          });
          break;
        }
      }
    }
  }

  /**
   * Sets the active space, updates room list filters,
   * optionally switches the user's room back to where they were when they last viewed that space.
   * @param space which space to switch to.
   * @param contextSwitch whether to switch the user's context,
   * should not be done when the space switch is done implicitly due to another event like switching room.
   */
  setActiveSpace(space) {
    let contextSwitch = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
    if (!space || !this.matrixClient || space === this.activeSpace) return;
    let cliSpace = null;
    if (!(0, _.isMetaSpace)(space)) {
      cliSpace = this.matrixClient.getRoom(space);
      if (!cliSpace?.isSpaceRoom()) return;
    } else if (!this.enabledMetaSpaces.includes(space)) {
      return;
    }
    window.localStorage.setItem(ACTIVE_SPACE_LS_KEY, this._activeSpace = space); // Update & persist selected space

    if (contextSwitch) {
      // view last selected room from space
      const roomId = window.localStorage.getItem(getSpaceContextKey(space));

      // if the space being selected is an invite then always view that invite
      // else if the last viewed room in this space is joined then view that
      // else view space home or home depending on what is being clicked on
      if (roomId && cliSpace?.getMyMembership() !== "invite" && this.matrixClient.getRoom(roomId)?.getMyMembership() === "join" && this.isRoomInSpace(space, roomId)) {
        _dispatcher.default.dispatch({
          action: _actions.Action.ViewRoom,
          room_id: roomId,
          context_switch: true,
          metricsTrigger: "WebSpaceContextSwitch"
        });
      } else if (cliSpace) {
        _dispatcher.default.dispatch({
          action: _actions.Action.ViewRoom,
          room_id: space,
          context_switch: true,
          metricsTrigger: "WebSpaceContextSwitch"
        });
      } else {
        _dispatcher.default.dispatch({
          action: _actions.Action.ViewHomePage,
          context_switch: true
        });
      }
    }
    this.emit(_.UPDATE_SELECTED_SPACE, this.activeSpace);
    this.emit(_.UPDATE_SUGGESTED_ROOMS, this._suggestedRooms = []);
    if (cliSpace) {
      this.loadSuggestedRooms(cliSpace);

      // Load all members for the selected space and its subspaces,
      // so we can correctly show DMs we have with members of this space.
      SpaceStore.instance.traverseSpace(space, roomId => {
        this.matrixClient?.getRoom(roomId)?.loadMembersIfNeeded();
      }, false);
    }
  }
  async loadSuggestedRooms(space) {
    const suggestedRooms = await this.fetchSuggestedRooms(space);
    if (this._activeSpace === space.roomId) {
      this._suggestedRooms = suggestedRooms;
      this.emit(_.UPDATE_SUGGESTED_ROOMS, this._suggestedRooms);
    }
  }
  addRoomToSpace(space, roomId, via) {
    let suggested = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
    return this.matrixClient.sendStateEvent(space.roomId, _event.EventType.SpaceChild, {
      via,
      suggested
    }, roomId);
  }
  getChildren(spaceId) {
    const room = this.matrixClient?.getRoom(spaceId);
    const childEvents = room?.currentState.getStateEvents(_event.EventType.SpaceChild).filter(ev => ev.getContent()?.via);
    return (0, _lodash.sortBy)(childEvents, ev => {
      return getChildOrder(ev.getContent().order, ev.getTs(), ev.getStateKey());
    }).map(ev => {
      const history = this.matrixClient.getRoomUpgradeHistory(ev.getStateKey(), true, this._msc3946ProcessDynamicPredecessor);
      return history[history.length - 1];
    }).filter(room => {
      return room?.getMyMembership() === "join" || room?.getMyMembership() === "invite";
    }) || [];
  }
  getChildRooms(spaceId) {
    return this.getChildren(spaceId).filter(r => !r.isSpaceRoom());
  }
  getChildSpaces(spaceId) {
    // don't show invited subspaces as they surface at the top level for better visibility
    return this.getChildren(spaceId).filter(r => r.isSpaceRoom() && r.getMyMembership() === "join");
  }
  getParents(roomId) {
    let canonicalOnly = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    if (!this.matrixClient) return [];
    const userId = this.matrixClient.getSafeUserId();
    const room = this.matrixClient.getRoom(roomId);
    const events = room?.currentState.getStateEvents(_event.EventType.SpaceParent) ?? [];
    return (0, _arrays.filterBoolean)(events.map(ev => {
      const content = ev.getContent();
      if (!Array.isArray(content.via) || canonicalOnly && !content.canonical) {
        return; // skip
      }

      // only respect the relationship if the sender has sufficient permissions in the parent to set
      // child relations, as per MSC1772.
      // https://github.com/matrix-org/matrix-doc/blob/main/proposals/1772-groups-as-rooms.md#relationship-between-rooms-and-spaces
      const parent = this.matrixClient?.getRoom(ev.getStateKey());
      const relation = parent?.currentState.getStateEvents(_event.EventType.SpaceChild, roomId);
      if (!parent?.currentState.maySendStateEvent(_event.EventType.SpaceChild, userId) ||
      // also skip this relation if the parent had this child added but then since removed it
      relation && !Array.isArray(relation.getContent().via)) {
        return; // skip
      }

      return parent;
    }));
  }
  getCanonicalParent(roomId) {
    const parents = this.getParents(roomId, true);
    return (0, _lodash.sortBy)(parents, r => r.roomId)?.[0] || null;
  }
  getKnownParents(roomId, includeAncestors) {
    if (includeAncestors) {
      return (0, _flattenSpaceHierarchy.flattenSpaceHierarchy)(this.parentMap, this.parentMap, roomId);
    }
    return this.parentMap.get(roomId) || new Set();
  }
  isRoomInSpace(space, roomId) {
    let includeDescendantSpaces = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
    if (space === _.MetaSpace.Home && this.allRoomsInHome) {
      return true;
    }
    if (this.getSpaceFilteredRoomIds(space, includeDescendantSpaces)?.has(roomId)) {
      return true;
    }
    const dmPartner = _DMRoomMap.default.shared().getUserIdForRoomId(roomId);
    if (!dmPartner) {
      return false;
    }
    // beyond this point we know this is a DM

    if (space === _.MetaSpace.Home || space === _.MetaSpace.People) {
      // these spaces contain all DMs
      return true;
    }
    if (!(0, _.isMetaSpace)(space) && this.getSpaceFilteredUserIds(space, includeDescendantSpaces)?.has(dmPartner) && _SettingsStore.default.getValue("Spaces.showPeopleInSpace", space)) {
      return true;
    }
    return false;
  }
  static isInSpace(member) {
    return member?.membership === "join" || member?.membership === "invite";
  }
  notifyIfOrderChanged() {
    const rootSpaces = this.sortRootSpaces(this.rootSpaces);
    if ((0, _arrays.arrayHasOrderChange)(this.rootSpaces, rootSpaces)) {
      this.rootSpaces = rootSpaces;
      this.emit(_.UPDATE_TOP_LEVEL_SPACES, this.spacePanelSpaces, this.enabledMetaSpaces);
    }
  }
  onRoomFavouriteChange(room) {
    if (this.enabledMetaSpaces.includes(_.MetaSpace.Favourites)) {
      if (room.tags[_models.DefaultTagID.Favourite]) {
        this.roomIdsBySpace.get(_.MetaSpace.Favourites)?.add(room.roomId);
      } else {
        this.roomIdsBySpace.get(_.MetaSpace.Favourites)?.delete(room.roomId);
      }
      this.emit(_.MetaSpace.Favourites);
    }
  }
  onRoomDmChange(room, isDm) {
    const enabledMetaSpaces = new Set(this.enabledMetaSpaces);
    if (!this.allRoomsInHome && enabledMetaSpaces.has(_.MetaSpace.Home)) {
      const homeRooms = this.roomIdsBySpace.get(_.MetaSpace.Home);
      if (this.showInHomeSpace(room)) {
        homeRooms?.add(room.roomId);
      } else if (!this.roomIdsBySpace.get(_.MetaSpace.Orphans)?.has(room.roomId)) {
        this.roomIdsBySpace.get(_.MetaSpace.Home)?.delete(room.roomId);
      }
      this.emit(_.MetaSpace.Home);
    }
    if (enabledMetaSpaces.has(_.MetaSpace.People)) {
      this.emit(_.MetaSpace.People);
    }
    if (enabledMetaSpaces.has(_.MetaSpace.Orphans) || enabledMetaSpaces.has(_.MetaSpace.Home)) {
      if (isDm && this.roomIdsBySpace.get(_.MetaSpace.Orphans)?.delete(room.roomId)) {
        this.emit(_.MetaSpace.Orphans);
        this.emit(_.MetaSpace.Home);
      }
    }
  }
  async reset() {
    this.rootSpaces = [];
    this.parentMap = new _maps.EnhancedMap();
    this.notificationStateMap = new Map();
    this.roomIdsBySpace = new Map();
    this.userIdsBySpace = new Map();
    this._aggregatedSpaceCache.roomIdsBySpace.clear();
    this._aggregatedSpaceCache.userIdsBySpace.clear();
    this._activeSpace = _.MetaSpace.Home; // set properly by onReady
    this._suggestedRooms = [];
    this._invitedSpaces = new Set();
    this._enabledMetaSpaces = [];
  }
  async onNotReady() {
    if (this.matrixClient) {
      this.matrixClient.removeListener(_client.ClientEvent.Room, this.onRoom);
      this.matrixClient.removeListener(_room.RoomEvent.MyMembership, this.onRoom);
      this.matrixClient.removeListener(_room.RoomEvent.AccountData, this.onRoomAccountData);
      this.matrixClient.removeListener(_roomState.RoomStateEvent.Events, this.onRoomState);
      this.matrixClient.removeListener(_roomState.RoomStateEvent.Members, this.onRoomStateMembers);
      this.matrixClient.removeListener(_client.ClientEvent.AccountData, this.onAccountData);
    }
    await this.reset();
  }
  async onReady() {
    if (!this.matrixClient) return;
    this.matrixClient.on(_client.ClientEvent.Room, this.onRoom);
    this.matrixClient.on(_room.RoomEvent.MyMembership, this.onRoom);
    this.matrixClient.on(_room.RoomEvent.AccountData, this.onRoomAccountData);
    this.matrixClient.on(_roomState.RoomStateEvent.Events, this.onRoomState);
    this.matrixClient.on(_roomState.RoomStateEvent.Members, this.onRoomStateMembers);
    this.matrixClient.on(_client.ClientEvent.AccountData, this.onAccountData);
    const oldMetaSpaces = this._enabledMetaSpaces;
    const enabledMetaSpaces = _SettingsStore.default.getValue("Spaces.enabledMetaSpaces");
    this._enabledMetaSpaces = metaSpaceOrder.filter(k => enabledMetaSpaces[k]);
    this._allRoomsInHome = _SettingsStore.default.getValue("Spaces.allRoomsInHome");
    this.sendUserProperties();
    this.rebuildSpaceHierarchy(); // trigger an initial update
    // rebuildSpaceHierarchy will only send an update if the spaces have changed.
    // If only the meta spaces have changed, we need to send an update ourselves.
    if ((0, _arrays.arrayHasDiff)(oldMetaSpaces, this._enabledMetaSpaces)) {
      this.emit(_.UPDATE_TOP_LEVEL_SPACES, this.spacePanelSpaces, this.enabledMetaSpaces);
    }

    // restore selected state from last session if any and still valid
    const lastSpaceId = window.localStorage.getItem(ACTIVE_SPACE_LS_KEY);
    const valid = lastSpaceId && (!(0, _.isMetaSpace)(lastSpaceId) ? this.matrixClient.getRoom(lastSpaceId) : enabledMetaSpaces[lastSpaceId]);
    if (valid) {
      // don't context switch here as it may break permalinks
      this.setActiveSpace(lastSpaceId, false);
    } else {
      this.switchSpaceIfNeeded();
    }
  }
  sendUserProperties() {
    const enabled = new Set(this.enabledMetaSpaces);
    _PosthogAnalytics.PosthogAnalytics.instance.setProperty("WebMetaSpaceHomeEnabled", enabled.has(_.MetaSpace.Home));
    _PosthogAnalytics.PosthogAnalytics.instance.setProperty("WebMetaSpaceHomeAllRooms", this.allRoomsInHome);
    _PosthogAnalytics.PosthogAnalytics.instance.setProperty("WebMetaSpacePeopleEnabled", enabled.has(_.MetaSpace.People));
    _PosthogAnalytics.PosthogAnalytics.instance.setProperty("WebMetaSpaceFavouritesEnabled", enabled.has(_.MetaSpace.Favourites));
    _PosthogAnalytics.PosthogAnalytics.instance.setProperty("WebMetaSpaceOrphansEnabled", enabled.has(_.MetaSpace.Orphans));
  }
  goToFirstSpace() {
    let contextSwitch = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
    this.setActiveSpace(this.enabledMetaSpaces[0] ?? this.spacePanelSpaces[0]?.roomId, contextSwitch);
  }
  async onAction(payload) {
    if (!this.matrixClient) return;
    switch (payload.action) {
      case _actions.Action.ViewRoom:
        {
          // Don't auto-switch rooms when reacting to a context-switch or for new rooms being created
          // as this is not helpful and can create loops of rooms/space switching
          const isSpace = payload.justCreatedOpts?.roomType === _event.RoomType.Space;
          if (payload.context_switch || payload.justCreatedOpts && !isSpace) break;
          let roomId = payload.room_id;
          if (payload.room_alias && !roomId) {
            roomId = (0, _RoomAliasCache.getCachedRoomIDForAlias)(payload.room_alias);
          }
          if (!roomId) return; // we'll get re-fired with the room ID shortly

          const room = this.matrixClient.getRoom(roomId);
          if (room?.isSpaceRoom()) {
            // Don't context switch when navigating to the space room
            // as it will cause you to end up in the wrong room
            this.setActiveSpace(room.roomId, false);
          } else {
            this.switchSpaceIfNeeded(roomId);
          }

          // Persist last viewed room from a space
          // we don't await setActiveSpace above as we only care about this.activeSpace being up to date
          // synchronously for the below code - everything else can and should be async.
          window.localStorage.setItem(getSpaceContextKey(this.activeSpace), payload.room_id ?? "");
          break;
        }
      case _actions.Action.ViewHomePage:
        if (!payload.context_switch && this.enabledMetaSpaces.includes(_.MetaSpace.Home)) {
          this.setActiveSpace(_.MetaSpace.Home, false);
          window.localStorage.setItem(getSpaceContextKey(this.activeSpace), "");
        }
        break;
      case _actions.Action.AfterLeaveRoom:
        if (!(0, _.isMetaSpace)(this._activeSpace) && payload.room_id === this._activeSpace) {
          // User has left the current space, go to first space
          this.goToFirstSpace(true);
        }
        break;
      case _actions.Action.SwitchSpace:
        {
          // Metaspaces start at 1, Spaces follow
          if (payload.num < 1 || payload.num > 9) break;
          const numMetaSpaces = this.enabledMetaSpaces.length;
          if (payload.num <= numMetaSpaces) {
            this.setActiveSpace(this.enabledMetaSpaces[payload.num - 1]);
          } else if (this.spacePanelSpaces.length > payload.num - numMetaSpaces - 1) {
            this.setActiveSpace(this.spacePanelSpaces[payload.num - numMetaSpaces - 1].roomId);
          }
          break;
        }
      case _actions.Action.SettingUpdated:
        {
          switch (payload.settingName) {
            case "Spaces.allRoomsInHome":
              {
                const newValue = _SettingsStore.default.getValue("Spaces.allRoomsInHome");
                if (this.allRoomsInHome !== newValue) {
                  this._allRoomsInHome = newValue;
                  this.emit(_.UPDATE_HOME_BEHAVIOUR, this.allRoomsInHome);
                  if (this.enabledMetaSpaces.includes(_.MetaSpace.Home)) {
                    this.rebuildHomeSpace();
                  }
                  this.sendUserProperties();
                }
                break;
              }
            case "Spaces.enabledMetaSpaces":
              {
                const newValue = _SettingsStore.default.getValue("Spaces.enabledMetaSpaces");
                const enabledMetaSpaces = metaSpaceOrder.filter(k => newValue[k]);
                if ((0, _arrays.arrayHasDiff)(this._enabledMetaSpaces, enabledMetaSpaces)) {
                  const hadPeopleOrHomeEnabled = this.enabledMetaSpaces.some(s => {
                    return s === _.MetaSpace.Home || s === _.MetaSpace.People;
                  });
                  this._enabledMetaSpaces = enabledMetaSpaces;
                  const hasPeopleOrHomeEnabled = this.enabledMetaSpaces.some(s => {
                    return s === _.MetaSpace.Home || s === _.MetaSpace.People;
                  });

                  // if a metaspace currently being viewed was removed, go to another one
                  if ((0, _.isMetaSpace)(this.activeSpace) && !newValue[this.activeSpace]) {
                    this.switchSpaceIfNeeded();
                  }
                  this.rebuildMetaSpaces();
                  if (hadPeopleOrHomeEnabled !== hasPeopleOrHomeEnabled) {
                    // in this case we have to rebuild everything as DM badges will move to/from real spaces
                    this.updateNotificationStates();
                  } else {
                    this.updateNotificationStates(enabledMetaSpaces);
                  }
                  this.emit(_.UPDATE_TOP_LEVEL_SPACES, this.spacePanelSpaces, this.enabledMetaSpaces);
                  this.sendUserProperties();
                }
                break;
              }
            case "Spaces.showPeopleInSpace":
              if (payload.roomId) {
                // getSpaceFilteredUserIds will return the appropriate value
                this.emit(payload.roomId);
                if (!this.enabledMetaSpaces.some(s => s === _.MetaSpace.Home || s === _.MetaSpace.People)) {
                  this.updateNotificationStates([payload.roomId]);
                }
              }
              break;
            case "feature_dynamic_room_predecessors":
              this._msc3946ProcessDynamicPredecessor = _SettingsStore.default.getValue("feature_dynamic_room_predecessors");
              this.rebuildSpaceHierarchy();
              break;
          }
        }
    }
  }
  getNotificationState(key) {
    if (this.notificationStateMap.has(key)) {
      return this.notificationStateMap.get(key);
    }
    const state = new _SpaceNotificationState.SpaceNotificationState(getRoomFn);
    this.notificationStateMap.set(key, state);
    return state;
  }

  // traverse space tree with DFS calling fn on each space including the given root one,
  // if includeRooms is true then fn will be called on each leaf room, if it is present in multiple sub-spaces
  // then fn will be called with it multiple times.
  traverseSpace(spaceId, fn) {
    let includeRooms = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
    let parentPath = arguments.length > 3 ? arguments[3] : undefined;
    if (parentPath && parentPath.has(spaceId)) return; // prevent cycles

    fn(spaceId);
    const newPath = new Set(parentPath).add(spaceId);
    const [childSpaces, childRooms] = partitionSpacesAndRooms(this.getChildren(spaceId));
    if (includeRooms) {
      childRooms.forEach(r => fn(r.roomId));
    }
    childSpaces.forEach(s => this.traverseSpace(s.roomId, fn, includeRooms, newPath));
  }
  sortRootSpaces(spaces) {
    return (0, _lodash.sortBy)(spaces, [this.getSpaceTagOrdering, "roomId"]);
  }
  async setRootSpaceOrder(space, order) {
    this.spaceOrderLocalEchoMap.set(space.roomId, order);
    try {
      await this.matrixClient?.setRoomAccountData(space.roomId, _event.EventType.SpaceOrder, {
        order
      });
    } catch (e) {
      _logger.logger.warn("Failed to set root space order", e);
      if (this.spaceOrderLocalEchoMap.get(space.roomId) === order) {
        this.spaceOrderLocalEchoMap.delete(space.roomId);
      }
    }
  }
  moveRootSpace(fromIndex, toIndex) {
    const currentOrders = this.rootSpaces.map(this.getSpaceTagOrdering);
    const changes = (0, _stringOrderField.reorderLexicographically)(currentOrders, fromIndex, toIndex);
    changes.forEach(_ref2 => {
      let {
        index,
        order
      } = _ref2;
      this.setRootSpaceOrder(this.rootSpaces[index], order);
    });
    this.notifyIfOrderChanged();
  }
}
exports.SpaceStoreClass = SpaceStoreClass;
class SpaceStore {
  static get instance() {
    return SpaceStore.internalInstance;
  }

  /**
   * @internal for test only
   */
  static testInstance() {
    const store = new SpaceStoreClass();
    store.start();
    return store;
  }
}
exports.default = SpaceStore;
(0, _defineProperty2.default)(SpaceStore, "internalInstance", (() => {
  const instance = new SpaceStoreClass();
  instance.start();
  return instance;
})());
window.mxSpaceStore = SpaceStore.instance;
//# sourceMappingURL=SpaceStore.js.map