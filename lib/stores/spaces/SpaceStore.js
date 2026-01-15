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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfbG9kYXNoIiwicmVxdWlyZSIsIl9ldmVudCIsIl9yb29tIiwiX2NsaWVudCIsIl9sb2dnZXIiLCJfcm9vbVN0YXRlIiwiX0FzeW5jU3RvcmVXaXRoQ2xpZW50IiwiX2Rpc3BhdGNoZXIiLCJfaW50ZXJvcFJlcXVpcmVEZWZhdWx0IiwiX1Jvb21MaXN0U3RvcmUiLCJfU2V0dGluZ3NTdG9yZSIsIl9ETVJvb21NYXAiLCJfU3BhY2VOb3RpZmljYXRpb25TdGF0ZSIsIl9Sb29tTm90aWZpY2F0aW9uU3RhdGVTdG9yZSIsIl9tb2RlbHMiLCJfbWFwcyIsIl9zZXRzIiwiX2FjdGlvbnMiLCJfYXJyYXlzIiwiX3N0cmluZ09yZGVyRmllbGQiLCJfUm9vbUxpc3QiLCJfIiwiX1Jvb21BbGlhc0NhY2hlIiwiX21lbWJlcnNoaXAiLCJfZmxhdHRlblNwYWNlSGllcmFyY2h5IiwiX1Bvc3Rob2dBbmFseXRpY3MiLCJfU0RLQ29udGV4dCIsIm93bktleXMiLCJvYmplY3QiLCJlbnVtZXJhYmxlT25seSIsImtleXMiLCJPYmplY3QiLCJnZXRPd25Qcm9wZXJ0eVN5bWJvbHMiLCJzeW1ib2xzIiwiZmlsdGVyIiwic3ltIiwiZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yIiwiZW51bWVyYWJsZSIsInB1c2giLCJhcHBseSIsIl9vYmplY3RTcHJlYWQiLCJ0YXJnZXQiLCJpIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwic291cmNlIiwiZm9yRWFjaCIsImtleSIsIl9kZWZpbmVQcm9wZXJ0eTIiLCJkZWZhdWx0IiwiZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9ycyIsImRlZmluZVByb3BlcnRpZXMiLCJkZWZpbmVQcm9wZXJ0eSIsIkFDVElWRV9TUEFDRV9MU19LRVkiLCJtZXRhU3BhY2VPcmRlciIsIk1ldGFTcGFjZSIsIkhvbWUiLCJGYXZvdXJpdGVzIiwiUGVvcGxlIiwiT3JwaGFucyIsIk1BWF9TVUdHRVNURURfUk9PTVMiLCJnZXRTcGFjZUNvbnRleHRLZXkiLCJzcGFjZSIsInBhcnRpdGlvblNwYWNlc0FuZFJvb21zIiwiYXJyIiwicmVkdWNlIiwicmVzdWx0Iiwicm9vbSIsImlzU3BhY2VSb29tIiwidmFsaWRPcmRlciIsIm9yZGVyIiwiQXJyYXkiLCJmcm9tIiwiZXZlcnkiLCJjIiwiY2hhckNvZGUiLCJjaGFyQ29kZUF0IiwiZ2V0Q2hpbGRPcmRlciIsInRzIiwicm9vbUlkIiwiTmFOIiwiZXhwb3J0cyIsImdldFJvb21GbiIsIlJvb21Ob3RpZmljYXRpb25TdGF0ZVN0b3JlIiwiaW5zdGFuY2UiLCJnZXRSb29tU3RhdGUiLCJTcGFjZVN0b3JlQ2xhc3MiLCJBc3luY1N0b3JlV2l0aENsaWVudCIsImNvbnN0cnVjdG9yIiwiX3RoaXMiLCJkZWZhdWx0RGlzcGF0Y2hlciIsInRoaXMiLCJFbmhhbmNlZE1hcCIsIk1hcCIsInJvb21JZHNCeVNwYWNlIiwidXNlcklkc0J5U3BhY2UiLCJTZXQiLCJTZXR0aW5nc1N0b3JlIiwiZ2V0VmFsdWUiLCJsaW1pdCIsInVuZGVmaW5lZCIsInJvb21zIiwibWF0cml4Q2xpZW50IiwiZ2V0Um9vbUhpZXJhcmNoeSIsInZpYU1hcCIsImNoaWxkcmVuX3N0YXRlIiwiZXYiLCJ0eXBlIiwiRXZlbnRUeXBlIiwiU3BhY2VDaGlsZCIsImNvbnRlbnQiLCJ2aWEiLCJnZXRPckNyZWF0ZSIsInN0YXRlX2tleSIsImFkZCIsInJvb21JbmZvIiwicm9vbV90eXBlIiwiUm9vbVR5cGUiLCJTcGFjZSIsImdldFJvb20iLCJyb29tX2lkIiwiZ2V0TXlNZW1iZXJzaGlwIiwibWFwIiwidmlhU2VydmVycyIsImdldCIsImUiLCJsb2dnZXIiLCJlcnJvciIsImluY2x1ZGVEZXNjZW5kYW50U3BhY2VzIiwidXNlQ2FjaGUiLCJhbGxSb29tc0luSG9tZSIsImdldFZpc2libGVSb29tcyIsIl9tc2MzOTQ2UHJvY2Vzc0R5bmFtaWNQcmVkZWNlc3NvciIsInIiLCJpc01ldGFTcGFjZSIsImdldEFnZ3JlZ2F0ZWRSb29tSWRzQnlTcGFjZSIsImNoaWxkU3BhY2VzQnlTcGFjZSIsImdldEFnZ3JlZ2F0ZWRVc2VySWRzQnlTcGFjZSIsImZsYXR0ZW5TcGFjZUhpZXJhcmNoeVdpdGhDYWNoZSIsIl9hZ2dyZWdhdGVkU3BhY2VDYWNoZSIsInJvb3RTcGFjZSIsInVuc2VlbiIsInN0YWNrIiwicG9wIiwiZGVsZXRlIiwiZ2V0Q2hpbGRTcGFjZXMiLCJoYXMiLCJqb2luZWRTcGFjZXMiLCJ1bnNlZW5TcGFjZXMiLCJzdWJzcGFjZSIsInJvb3RTcGFjZXMiLCJkZXRhY2hlZE5vZGVzIiwic29ydEJ5IiwibWFya1RyZWVDaGlsZHJlbiIsImRldGFjaGVkTm9kZSIsInZpc2libGVTcGFjZXMiLCJpbnZpdGVkU3BhY2VzIiwiX3JlZiIsInMiLCJqb2luZWQiLCJpbnZpdGVkIiwiZ2V0RWZmZWN0aXZlTWVtYmVyc2hpcCIsIkVmZmVjdGl2ZU1lbWJlcnNoaXAiLCJKb2luIiwiSW52aXRlIiwiZmluZFJvb3RTcGFjZXMiLCJvbGRSb290U3BhY2VzIiwic29ydFJvb3RTcGFjZXMiLCJvblJvb21zVXBkYXRlIiwiYXJyYXlIYXNPcmRlckNoYW5nZSIsImVtaXQiLCJVUERBVEVfVE9QX0xFVkVMX1NQQUNFUyIsInNwYWNlUGFuZWxTcGFjZXMiLCJlbmFibGVkTWV0YVNwYWNlcyIsIm9sZEludml0ZWRTcGFjZXMiLCJfaW52aXRlZFNwYWNlcyIsInNldEhhc0RpZmYiLCJVUERBVEVfSU5WSVRFRF9TUEFDRVMiLCJwYXJlbnRNYXAiLCJjaGlsZHJlbiIsImdldENoaWxkcmVuIiwiY2hpbGQiLCJQb3N0aG9nQW5hbHl0aWNzIiwic2V0UHJvcGVydHkiLCJzaG93SW5Ib21lU3BhY2UiLCJzZXQiLCJhY3RpdmVTcGFjZSIsInN3aXRjaFNwYWNlSWZOZWVkZWQiLCJ2aXNpYmxlUm9vbXMiLCJyZWJ1aWxkSG9tZVNwYWNlIiwiZmF2b3VyaXRlcyIsInRhZ3MiLCJEZWZhdWx0VGFnSUQiLCJGYXZvdXJpdGUiLCJvcnBoYW5zIiwic2l6ZSIsIkRNUm9vbU1hcCIsInNoYXJlZCIsImdldFVzZXJJZEZvclJvb21JZCIsInNwYWNlcyIsImRtQmFkZ2VTcGFjZSIsImZsYXR0ZW5lZFJvb21zRm9yU3BhY2UiLCJnZXRTcGFjZUZpbHRlcmVkUm9vbUlkcyIsImdldE5vdGlmaWNhdGlvblN0YXRlIiwic2V0Um9vbXMiLCJpc1Jvb21JblNwYWNlIiwibm90aWZpY2F0aW9uU3RhdGVNYXAiLCJ1c2VySWQiLCJpblNwYWNlIiwiaXNJblNwYWNlIiwiZ2V0TWVtYmVyIiwiY2xlYXIiLCJhZmZlY3RlZFBhcmVudFNwYWNlSWRzIiwiZ2V0S25vd25QYXJlbnRzIiwic3BhY2VJZCIsInByZXZSb29tc0J5U3BhY2UiLCJwcmV2VXNlcnNCeVNwYWNlIiwicHJldkNoaWxkU3BhY2VzQnlTcGFjZSIsInJlYnVpbGRQYXJlbnRNYXAiLCJyZWJ1aWxkTWV0YVNwYWNlcyIsImhpZGRlbkNoaWxkcmVuIiwiaW5jbHVkZXMiLCJnZXRQYXJlbnRzIiwicGFyZW50IiwidHJhdmVyc2VTcGFjZSIsInBhcmVudFBhdGgiLCJjaGlsZFNwYWNlcyIsImNoaWxkUm9vbXMiLCJyb29tSWRzIiwidXNlcklkcyIsImdldE1lbWJlcnMiLCJtIiwibWVtYmVyc2hpcCIsIm5ld1BhdGgiLCJjaGlsZFNwYWNlIiwiZXhwYW5kZWRSb29tSWRzIiwiZmxhdE1hcCIsImdldFJvb21VcGdyYWRlSGlzdG9yeSIsInJvb21EaWZmIiwibWFwRGlmZiIsInVzZXJEaWZmIiwic3BhY2VEaWZmIiwicm9vbXNDaGFuZ2VkIiwiY2hhbmdlZCIsImsiLCJ1c2Vyc0NoYW5nZWQiLCJzcGFjZXNDaGFuZ2VkIiwiY2hhbmdlU2V0IiwiYWRkZWQiLCJyZW1vdmVkIiwiYWZmZWN0ZWRQYXJlbnRzIiwiY2hhbmdlZElkIiwicGFyZW50SWQiLCJub3RpZmljYXRpb25TdGF0ZXNUb1VwZGF0ZSIsInVwZGF0ZU5vdGlmaWNhdGlvblN0YXRlcyIsIlNka0NvbnRleHRDbGFzcyIsInJvb21WaWV3U3RvcmUiLCJnZXRSb29tSWQiLCJzd2l0Y2hUb1JlbGF0ZWRTcGFjZSIsInN1Z2dlc3RlZFJvb21zIiwiZmluZCIsImdldENhbm9uaWNhbFBhcmVudCIsInJldmVyc2UiLCJzZXRBY3RpdmVTcGFjZSIsImdvVG9GaXJzdFNwYWNlIiwibmV3TWVtYmVyc2hpcCIsIm9sZE1lbWJlcnNoaXAiLCJyb29tTWVtYmVyc2hpcCIsIm51bVN1Z2dlc3RlZFJvb21zIiwiX3N1Z2dlc3RlZFJvb21zIiwiVVBEQVRFX1NVR0dFU1RFRF9ST09NUyIsImxlbiIsInJlYnVpbGRTcGFjZUhpZXJhcmNoeSIsImdldFR5cGUiLCJnZXRTdGF0ZUtleSIsImdldFByZXZDb250ZW50Iiwic3VnZ2VzdGVkIiwiZ2V0Q29udGVudCIsImxvYWRTdWdnZXN0ZWRSb29tcyIsIlNwYWNlUGFyZW50IiwiUm9vbVBvd2VyTGV2ZWxzIiwiZ2V0RE1Sb29tc0ZvclVzZXJJZCIsIm9uTWVtYmVyVXBkYXRlIiwibGFzdEV2IiwiU3BhY2VPcmRlciIsInNwYWNlT3JkZXJMb2NhbEVjaG9NYXAiLCJsYXN0T3JkZXIiLCJub3RpZnlJZk9yZGVyQ2hhbmdlZCIsIlRhZyIsIm9sZFRhZ3MiLCJuZXdUYWdzIiwib25Sb29tRmF2b3VyaXRlQ2hhbmdlIiwicHJldkV2IiwiRGlyZWN0IiwicHJldmlvdXNSb29tcyIsInZhbHVlcyIsImZsYXQiLCJjdXJyZW50Um9vbXMiLCJkaWZmIiwic2V0RGlmZiIsIm9uUm9vbURtQ2hhbmdlIiwiZ2V0QWNjb3VudERhdGEiLCJtb25pdG9yU2V0dGluZyIsIl9lbmFibGVkTWV0YVNwYWNlcyIsIl9hY3RpdmVTcGFjZSIsImFjdGl2ZVNwYWNlUm9vbSIsIl9hbGxSb29tc0luSG9tZSIsInNldEFjdGl2ZVJvb21JblNwYWNlIiwiZ2V0Rmlyc3RSb29tV2l0aE5vdGlmaWNhdGlvbnMiLCJkaXNwYXRjaCIsImFjdGlvbiIsIkFjdGlvbiIsIlZpZXdSb29tIiwiY29udGV4dF9zd2l0Y2giLCJtZXRyaWNzVHJpZ2dlciIsImxpc3RzIiwiUm9vbUxpc3RTdG9yZSIsIm9yZGVyZWRMaXN0cyIsIlRBR19PUkRFUiIsInQiLCJsaXN0Um9vbXMiLCJ1bnJlYWRSb29tIiwic3RhdGUiLCJpc1VucmVhZCIsImNvbnRleHRTd2l0Y2giLCJjbGlTcGFjZSIsIndpbmRvdyIsImxvY2FsU3RvcmFnZSIsInNldEl0ZW0iLCJnZXRJdGVtIiwiVmlld0hvbWVQYWdlIiwiVVBEQVRFX1NFTEVDVEVEX1NQQUNFIiwiU3BhY2VTdG9yZSIsImxvYWRNZW1iZXJzSWZOZWVkZWQiLCJmZXRjaFN1Z2dlc3RlZFJvb21zIiwiYWRkUm9vbVRvU3BhY2UiLCJzZW5kU3RhdGVFdmVudCIsImNoaWxkRXZlbnRzIiwiY3VycmVudFN0YXRlIiwiZ2V0U3RhdGVFdmVudHMiLCJnZXRUcyIsImhpc3RvcnkiLCJnZXRDaGlsZFJvb21zIiwiY2Fub25pY2FsT25seSIsImdldFNhZmVVc2VySWQiLCJldmVudHMiLCJmaWx0ZXJCb29sZWFuIiwiaXNBcnJheSIsImNhbm9uaWNhbCIsInJlbGF0aW9uIiwibWF5U2VuZFN0YXRlRXZlbnQiLCJwYXJlbnRzIiwiaW5jbHVkZUFuY2VzdG9ycyIsImZsYXR0ZW5TcGFjZUhpZXJhcmNoeSIsImRtUGFydG5lciIsImdldFNwYWNlRmlsdGVyZWRVc2VySWRzIiwibWVtYmVyIiwiaXNEbSIsImhvbWVSb29tcyIsInJlc2V0Iiwib25Ob3RSZWFkeSIsInJlbW92ZUxpc3RlbmVyIiwiQ2xpZW50RXZlbnQiLCJSb29tIiwib25Sb29tIiwiUm9vbUV2ZW50IiwiTXlNZW1iZXJzaGlwIiwiQWNjb3VudERhdGEiLCJvblJvb21BY2NvdW50RGF0YSIsIlJvb21TdGF0ZUV2ZW50IiwiRXZlbnRzIiwib25Sb29tU3RhdGUiLCJNZW1iZXJzIiwib25Sb29tU3RhdGVNZW1iZXJzIiwib25BY2NvdW50RGF0YSIsIm9uUmVhZHkiLCJvbiIsIm9sZE1ldGFTcGFjZXMiLCJzZW5kVXNlclByb3BlcnRpZXMiLCJhcnJheUhhc0RpZmYiLCJsYXN0U3BhY2VJZCIsInZhbGlkIiwiZW5hYmxlZCIsIm9uQWN0aW9uIiwicGF5bG9hZCIsImlzU3BhY2UiLCJqdXN0Q3JlYXRlZE9wdHMiLCJyb29tVHlwZSIsInJvb21fYWxpYXMiLCJnZXRDYWNoZWRSb29tSURGb3JBbGlhcyIsIkFmdGVyTGVhdmVSb29tIiwiU3dpdGNoU3BhY2UiLCJudW0iLCJudW1NZXRhU3BhY2VzIiwiU2V0dGluZ1VwZGF0ZWQiLCJzZXR0aW5nTmFtZSIsIm5ld1ZhbHVlIiwiVVBEQVRFX0hPTUVfQkVIQVZJT1VSIiwiaGFkUGVvcGxlT3JIb21lRW5hYmxlZCIsInNvbWUiLCJoYXNQZW9wbGVPckhvbWVFbmFibGVkIiwiU3BhY2VOb3RpZmljYXRpb25TdGF0ZSIsImZuIiwiaW5jbHVkZVJvb21zIiwiZ2V0U3BhY2VUYWdPcmRlcmluZyIsInNldFJvb3RTcGFjZU9yZGVyIiwic2V0Um9vbUFjY291bnREYXRhIiwid2FybiIsIm1vdmVSb290U3BhY2UiLCJmcm9tSW5kZXgiLCJ0b0luZGV4IiwiY3VycmVudE9yZGVycyIsImNoYW5nZXMiLCJyZW9yZGVyTGV4aWNvZ3JhcGhpY2FsbHkiLCJfcmVmMiIsImluZGV4IiwiaW50ZXJuYWxJbnN0YW5jZSIsInRlc3RJbnN0YW5jZSIsInN0b3JlIiwic3RhcnQiLCJteFNwYWNlU3RvcmUiXSwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvc3RvcmVzL3NwYWNlcy9TcGFjZVN0b3JlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qXG5Db3B5cmlnaHQgMjAyMSAtIDIwMjIgVGhlIE1hdHJpeC5vcmcgRm91bmRhdGlvbiBDLkkuQy5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4qL1xuXG5pbXBvcnQgeyBMaXN0SXRlcmF0ZWUsIE1hbnksIHNvcnRCeSB9IGZyb20gXCJsb2Rhc2hcIjtcbmltcG9ydCB7IEV2ZW50VHlwZSwgUm9vbVR5cGUgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvQHR5cGVzL2V2ZW50XCI7XG5pbXBvcnQgeyBSb29tLCBSb29tRXZlbnQgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbW9kZWxzL3Jvb21cIjtcbmltcG9ydCB7IE1hdHJpeEV2ZW50IH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL21vZGVscy9ldmVudFwiO1xuaW1wb3J0IHsgQ2xpZW50RXZlbnQgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvY2xpZW50XCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbG9nZ2VyXCI7XG5pbXBvcnQgeyBSb29tTWVtYmVyIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL21vZGVscy9yb29tLW1lbWJlclwiO1xuaW1wb3J0IHsgUm9vbVN0YXRlRXZlbnQgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbW9kZWxzL3Jvb20tc3RhdGVcIjtcbmltcG9ydCB7IElTZW5kRXZlbnRSZXNwb25zZSB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9AdHlwZXMvcmVxdWVzdHNcIjtcblxuaW1wb3J0IHsgQXN5bmNTdG9yZVdpdGhDbGllbnQgfSBmcm9tIFwiLi4vQXN5bmNTdG9yZVdpdGhDbGllbnRcIjtcbmltcG9ydCBkZWZhdWx0RGlzcGF0Y2hlciBmcm9tIFwiLi4vLi4vZGlzcGF0Y2hlci9kaXNwYXRjaGVyXCI7XG5pbXBvcnQgUm9vbUxpc3RTdG9yZSBmcm9tIFwiLi4vcm9vbS1saXN0L1Jvb21MaXN0U3RvcmVcIjtcbmltcG9ydCBTZXR0aW5nc1N0b3JlIGZyb20gXCIuLi8uLi9zZXR0aW5ncy9TZXR0aW5nc1N0b3JlXCI7XG5pbXBvcnQgRE1Sb29tTWFwIGZyb20gXCIuLi8uLi91dGlscy9ETVJvb21NYXBcIjtcbmltcG9ydCB7IEZldGNoUm9vbUZuIH0gZnJvbSBcIi4uL25vdGlmaWNhdGlvbnMvTGlzdE5vdGlmaWNhdGlvblN0YXRlXCI7XG5pbXBvcnQgeyBTcGFjZU5vdGlmaWNhdGlvblN0YXRlIH0gZnJvbSBcIi4uL25vdGlmaWNhdGlvbnMvU3BhY2VOb3RpZmljYXRpb25TdGF0ZVwiO1xuaW1wb3J0IHsgUm9vbU5vdGlmaWNhdGlvblN0YXRlU3RvcmUgfSBmcm9tIFwiLi4vbm90aWZpY2F0aW9ucy9Sb29tTm90aWZpY2F0aW9uU3RhdGVTdG9yZVwiO1xuaW1wb3J0IHsgRGVmYXVsdFRhZ0lEIH0gZnJvbSBcIi4uL3Jvb20tbGlzdC9tb2RlbHNcIjtcbmltcG9ydCB7IEVuaGFuY2VkTWFwLCBtYXBEaWZmIH0gZnJvbSBcIi4uLy4uL3V0aWxzL21hcHNcIjtcbmltcG9ydCB7IHNldERpZmYsIHNldEhhc0RpZmYgfSBmcm9tIFwiLi4vLi4vdXRpbHMvc2V0c1wiO1xuaW1wb3J0IHsgQWN0aW9uIH0gZnJvbSBcIi4uLy4uL2Rpc3BhdGNoZXIvYWN0aW9uc1wiO1xuaW1wb3J0IHsgYXJyYXlIYXNEaWZmLCBhcnJheUhhc09yZGVyQ2hhbmdlLCBmaWx0ZXJCb29sZWFuIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2FycmF5c1wiO1xuaW1wb3J0IHsgcmVvcmRlckxleGljb2dyYXBoaWNhbGx5IH0gZnJvbSBcIi4uLy4uL3V0aWxzL3N0cmluZ09yZGVyRmllbGRcIjtcbmltcG9ydCB7IFRBR19PUkRFUiB9IGZyb20gXCIuLi8uLi9jb21wb25lbnRzL3ZpZXdzL3Jvb21zL1Jvb21MaXN0XCI7XG5pbXBvcnQgeyBTZXR0aW5nVXBkYXRlZFBheWxvYWQgfSBmcm9tIFwiLi4vLi4vZGlzcGF0Y2hlci9wYXlsb2Fkcy9TZXR0aW5nVXBkYXRlZFBheWxvYWRcIjtcbmltcG9ydCB7XG4gICAgaXNNZXRhU3BhY2UsXG4gICAgSVN1Z2dlc3RlZFJvb20sXG4gICAgTWV0YVNwYWNlLFxuICAgIFNwYWNlS2V5LFxuICAgIFVQREFURV9IT01FX0JFSEFWSU9VUixcbiAgICBVUERBVEVfSU5WSVRFRF9TUEFDRVMsXG4gICAgVVBEQVRFX1NFTEVDVEVEX1NQQUNFLFxuICAgIFVQREFURV9TVUdHRVNURURfUk9PTVMsXG4gICAgVVBEQVRFX1RPUF9MRVZFTF9TUEFDRVMsXG59IGZyb20gXCIuXCI7XG5pbXBvcnQgeyBnZXRDYWNoZWRSb29tSURGb3JBbGlhcyB9IGZyb20gXCIuLi8uLi9Sb29tQWxpYXNDYWNoZVwiO1xuaW1wb3J0IHsgRWZmZWN0aXZlTWVtYmVyc2hpcCwgZ2V0RWZmZWN0aXZlTWVtYmVyc2hpcCB9IGZyb20gXCIuLi8uLi91dGlscy9tZW1iZXJzaGlwXCI7XG5pbXBvcnQge1xuICAgIGZsYXR0ZW5TcGFjZUhpZXJhcmNoeVdpdGhDYWNoZSxcbiAgICBTcGFjZUVudGl0eU1hcCxcbiAgICBTcGFjZURlc2NlbmRhbnRNYXAsXG4gICAgZmxhdHRlblNwYWNlSGllcmFyY2h5LFxufSBmcm9tIFwiLi9mbGF0dGVuU3BhY2VIaWVyYXJjaHlcIjtcbmltcG9ydCB7IFBvc3Rob2dBbmFseXRpY3MgfSBmcm9tIFwiLi4vLi4vUG9zdGhvZ0FuYWx5dGljc1wiO1xuaW1wb3J0IHsgVmlld1Jvb21QYXlsb2FkIH0gZnJvbSBcIi4uLy4uL2Rpc3BhdGNoZXIvcGF5bG9hZHMvVmlld1Jvb21QYXlsb2FkXCI7XG5pbXBvcnQgeyBWaWV3SG9tZVBhZ2VQYXlsb2FkIH0gZnJvbSBcIi4uLy4uL2Rpc3BhdGNoZXIvcGF5bG9hZHMvVmlld0hvbWVQYWdlUGF5bG9hZFwiO1xuaW1wb3J0IHsgU3dpdGNoU3BhY2VQYXlsb2FkIH0gZnJvbSBcIi4uLy4uL2Rpc3BhdGNoZXIvcGF5bG9hZHMvU3dpdGNoU3BhY2VQYXlsb2FkXCI7XG5pbXBvcnQgeyBBZnRlckxlYXZlUm9vbVBheWxvYWQgfSBmcm9tIFwiLi4vLi4vZGlzcGF0Y2hlci9wYXlsb2Fkcy9BZnRlckxlYXZlUm9vbVBheWxvYWRcIjtcbmltcG9ydCB7IFNka0NvbnRleHRDbGFzcyB9IGZyb20gXCIuLi8uLi9jb250ZXh0cy9TREtDb250ZXh0XCI7XG5cbmludGVyZmFjZSBJU3RhdGUge31cblxuY29uc3QgQUNUSVZFX1NQQUNFX0xTX0tFWSA9IFwibXhfYWN0aXZlX3NwYWNlXCI7XG5cbmNvbnN0IG1ldGFTcGFjZU9yZGVyOiBNZXRhU3BhY2VbXSA9IFtNZXRhU3BhY2UuSG9tZSwgTWV0YVNwYWNlLkZhdm91cml0ZXMsIE1ldGFTcGFjZS5QZW9wbGUsIE1ldGFTcGFjZS5PcnBoYW5zXTtcblxuY29uc3QgTUFYX1NVR0dFU1RFRF9ST09NUyA9IDIwO1xuXG5jb25zdCBnZXRTcGFjZUNvbnRleHRLZXkgPSAoc3BhY2U6IFNwYWNlS2V5KTogc3RyaW5nID0+IGBteF9zcGFjZV9jb250ZXh0XyR7c3BhY2V9YDtcblxuY29uc3QgcGFydGl0aW9uU3BhY2VzQW5kUm9vbXMgPSAoYXJyOiBSb29tW10pOiBbUm9vbVtdLCBSb29tW11dID0+IHtcbiAgICAvLyBbc3BhY2VzLCByb29tc11cbiAgICByZXR1cm4gYXJyLnJlZHVjZTxbUm9vbVtdLCBSb29tW11dPihcbiAgICAgICAgKHJlc3VsdCwgcm9vbTogUm9vbSkgPT4ge1xuICAgICAgICAgICAgcmVzdWx0W3Jvb20uaXNTcGFjZVJvb20oKSA/IDAgOiAxXS5wdXNoKHJvb20pO1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfSxcbiAgICAgICAgW1tdLCBbXV0sXG4gICAgKTtcbn07XG5cbmNvbnN0IHZhbGlkT3JkZXIgPSAob3JkZXI/OiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQgPT4ge1xuICAgIGlmIChcbiAgICAgICAgdHlwZW9mIG9yZGVyID09PSBcInN0cmluZ1wiICYmXG4gICAgICAgIG9yZGVyLmxlbmd0aCA8PSA1MCAmJlxuICAgICAgICBBcnJheS5mcm9tKG9yZGVyKS5ldmVyeSgoYzogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBjaGFyQ29kZSA9IGMuY2hhckNvZGVBdCgwKTtcbiAgICAgICAgICAgIHJldHVybiBjaGFyQ29kZSA+PSAweDIwICYmIGNoYXJDb2RlIDw9IDB4N2U7XG4gICAgICAgIH0pXG4gICAgKSB7XG4gICAgICAgIHJldHVybiBvcmRlcjtcbiAgICB9XG59O1xuXG4vLyBGb3Igc29ydGluZyBzcGFjZSBjaGlsZHJlbiB1c2luZyBhIHZhbGlkYXRlZCBgb3JkZXJgLCBgb3JpZ2luX3NlcnZlcl90c2AsIGByb29tX2lkYFxuZXhwb3J0IGNvbnN0IGdldENoaWxkT3JkZXIgPSAoXG4gICAgb3JkZXI6IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgICB0czogbnVtYmVyLFxuICAgIHJvb21JZDogc3RyaW5nLFxuKTogQXJyYXk8TWFueTxMaXN0SXRlcmF0ZWU8dW5rbm93bj4+PiA9PiB7XG4gICAgcmV0dXJuIFt2YWxpZE9yZGVyKG9yZGVyKSA/PyBOYU4sIHRzLCByb29tSWRdOyAvLyBOYU4gaGFzIGxvZGFzaCBzb3J0IGl0IGF0IHRoZSBlbmQgaW4gYXNjXG59O1xuXG5jb25zdCBnZXRSb29tRm46IEZldGNoUm9vbUZuID0gKHJvb206IFJvb20pID0+IHtcbiAgICByZXR1cm4gUm9vbU5vdGlmaWNhdGlvblN0YXRlU3RvcmUuaW5zdGFuY2UuZ2V0Um9vbVN0YXRlKHJvb20pO1xufTtcblxudHlwZSBTcGFjZVN0b3JlQWN0aW9ucyA9XG4gICAgfCBTZXR0aW5nVXBkYXRlZFBheWxvYWRcbiAgICB8IFZpZXdSb29tUGF5bG9hZFxuICAgIHwgVmlld0hvbWVQYWdlUGF5bG9hZFxuICAgIHwgU3dpdGNoU3BhY2VQYXlsb2FkXG4gICAgfCBBZnRlckxlYXZlUm9vbVBheWxvYWQ7XG5cbmV4cG9ydCBjbGFzcyBTcGFjZVN0b3JlQ2xhc3MgZXh0ZW5kcyBBc3luY1N0b3JlV2l0aENsaWVudDxJU3RhdGU+IHtcbiAgICAvLyBUaGUgc3BhY2VzIHJlcHJlc2VudGluZyB0aGUgcm9vdHMgb2YgdGhlIHZhcmlvdXMgdHJlZS1saWtlIGhpZXJhcmNoaWVzXG4gICAgcHJpdmF0ZSByb290U3BhY2VzOiBSb29tW10gPSBbXTtcbiAgICAvLyBNYXAgZnJvbSByb29tL3NwYWNlIElEIHRvIHNldCBvZiBzcGFjZXMgd2hpY2ggbGlzdCBpdCBhcyBhIGNoaWxkXG4gICAgcHJpdmF0ZSBwYXJlbnRNYXAgPSBuZXcgRW5oYW5jZWRNYXA8c3RyaW5nLCBTZXQ8c3RyaW5nPj4oKTtcbiAgICAvLyBNYXAgZnJvbSBTcGFjZUtleSB0byBTcGFjZU5vdGlmaWNhdGlvblN0YXRlIGluc3RhbmNlIHJlcHJlc2VudGluZyB0aGF0IHNwYWNlXG4gICAgcHJpdmF0ZSBub3RpZmljYXRpb25TdGF0ZU1hcCA9IG5ldyBNYXA8U3BhY2VLZXksIFNwYWNlTm90aWZpY2F0aW9uU3RhdGU+KCk7XG4gICAgLy8gTWFwIGZyb20gU3BhY2VLZXkgdG8gU2V0IG9mIHJvb20gSURzIHRoYXQgYXJlIGRpcmVjdCBkZXNjZW5kYW50cyBvZiB0aGF0IHNwYWNlXG4gICAgcHJpdmF0ZSByb29tSWRzQnlTcGFjZTogU3BhY2VFbnRpdHlNYXAgPSBuZXcgTWFwPFNwYWNlS2V5LCBTZXQ8c3RyaW5nPj4oKTsgLy8gd29uJ3QgY29udGFpbiBNZXRhU3BhY2UuUGVvcGxlXG4gICAgLy8gTWFwIGZyb20gc3BhY2UgaWQgdG8gU2V0IG9mIHNwYWNlIGtleXMgdGhhdCBhcmUgZGlyZWN0IGRlc2NlbmRhbnRzIG9mIHRoYXQgc3BhY2VcbiAgICAvLyBtZXRhIHNwYWNlcyBkbyBub3QgaGF2ZSBkZXNjZW5kYW50c1xuICAgIHByaXZhdGUgY2hpbGRTcGFjZXNCeVNwYWNlOiBTcGFjZURlc2NlbmRhbnRNYXAgPSBuZXcgTWFwPFJvb21bXCJyb29tSWRcIl0sIFNldDxSb29tW1wicm9vbUlkXCJdPj4oKTtcbiAgICAvLyBNYXAgZnJvbSBzcGFjZSBpZCB0byBTZXQgb2YgdXNlciBJRHMgdGhhdCBhcmUgZGlyZWN0IGRlc2NlbmRhbnRzIG9mIHRoYXQgc3BhY2VcbiAgICBwcml2YXRlIHVzZXJJZHNCeVNwYWNlOiBTcGFjZUVudGl0eU1hcCA9IG5ldyBNYXA8Um9vbVtcInJvb21JZFwiXSwgU2V0PHN0cmluZz4+KCk7XG4gICAgLy8gY2FjaGUgdGhhdCBzdG9yZXMgdGhlIGFnZ3JlZ2F0ZWQgbGlzdHMgb2Ygcm9vbUlkc0J5U3BhY2UgYW5kIHVzZXJJZHNCeVNwYWNlXG4gICAgLy8gY2xlYXJlZCBvbiBjaGFuZ2VzXG4gICAgcHJpdmF0ZSBfYWdncmVnYXRlZFNwYWNlQ2FjaGUgPSB7XG4gICAgICAgIHJvb21JZHNCeVNwYWNlOiBuZXcgTWFwPFNwYWNlS2V5LCBTZXQ8c3RyaW5nPj4oKSxcbiAgICAgICAgdXNlcklkc0J5U3BhY2U6IG5ldyBNYXA8Um9vbVtcInJvb21JZFwiXSwgU2V0PHN0cmluZz4+KCksXG4gICAgfTtcbiAgICAvLyBUaGUgc3BhY2UgY3VycmVudGx5IHNlbGVjdGVkIGluIHRoZSBTcGFjZSBQYW5lbFxuICAgIHByaXZhdGUgX2FjdGl2ZVNwYWNlOiBTcGFjZUtleSA9IE1ldGFTcGFjZS5Ib21lOyAvLyBzZXQgcHJvcGVybHkgYnkgb25SZWFkeVxuICAgIHByaXZhdGUgX3N1Z2dlc3RlZFJvb21zOiBJU3VnZ2VzdGVkUm9vbVtdID0gW107XG4gICAgcHJpdmF0ZSBfaW52aXRlZFNwYWNlcyA9IG5ldyBTZXQ8Um9vbT4oKTtcbiAgICBwcml2YXRlIHNwYWNlT3JkZXJMb2NhbEVjaG9NYXAgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nIHwgdW5kZWZpbmVkPigpO1xuICAgIC8vIFRoZSBmb2xsb3dpbmcgcHJvcGVydGllcyBhcmUgc2V0IGJ5IG9uUmVhZHkgYXMgdGhleSBsaXZlIGluIGFjY291bnRfZGF0YVxuICAgIHByaXZhdGUgX2FsbFJvb21zSW5Ib21lID0gZmFsc2U7XG4gICAgcHJpdmF0ZSBfZW5hYmxlZE1ldGFTcGFjZXM6IE1ldGFTcGFjZVtdID0gW107XG4gICAgLyoqIFdoZXRoZXIgdGhlIGZlYXR1cmUgZmxhZyBpcyBzZXQgZm9yIE1TQzM5NDYgKi9cbiAgICBwcml2YXRlIF9tc2MzOTQ2UHJvY2Vzc0R5bmFtaWNQcmVkZWNlc3NvcjogYm9vbGVhbiA9IFNldHRpbmdzU3RvcmUuZ2V0VmFsdWUoXCJmZWF0dXJlX2R5bmFtaWNfcm9vbV9wcmVkZWNlc3NvcnNcIik7XG5cbiAgICBwdWJsaWMgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKGRlZmF1bHREaXNwYXRjaGVyLCB7fSk7XG5cbiAgICAgICAgU2V0dGluZ3NTdG9yZS5tb25pdG9yU2V0dGluZyhcIlNwYWNlcy5hbGxSb29tc0luSG9tZVwiLCBudWxsKTtcbiAgICAgICAgU2V0dGluZ3NTdG9yZS5tb25pdG9yU2V0dGluZyhcIlNwYWNlcy5lbmFibGVkTWV0YVNwYWNlc1wiLCBudWxsKTtcbiAgICAgICAgU2V0dGluZ3NTdG9yZS5tb25pdG9yU2V0dGluZyhcIlNwYWNlcy5zaG93UGVvcGxlSW5TcGFjZVwiLCBudWxsKTtcbiAgICAgICAgU2V0dGluZ3NTdG9yZS5tb25pdG9yU2V0dGluZyhcImZlYXR1cmVfZHluYW1pY19yb29tX3ByZWRlY2Vzc29yc1wiLCBudWxsKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0IGludml0ZWRTcGFjZXMoKTogUm9vbVtdIHtcbiAgICAgICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5faW52aXRlZFNwYWNlcyk7XG4gICAgfVxuXG4gICAgcHVibGljIGdldCBlbmFibGVkTWV0YVNwYWNlcygpOiBNZXRhU3BhY2VbXSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9lbmFibGVkTWV0YVNwYWNlcztcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0IHNwYWNlUGFuZWxTcGFjZXMoKTogUm9vbVtdIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucm9vdFNwYWNlcztcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0IGFjdGl2ZVNwYWNlKCk6IFNwYWNlS2V5IHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FjdGl2ZVNwYWNlO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXQgYWN0aXZlU3BhY2VSb29tKCk6IFJvb20gfCBudWxsIHtcbiAgICAgICAgaWYgKGlzTWV0YVNwYWNlKHRoaXMuX2FjdGl2ZVNwYWNlKSkgcmV0dXJuIG51bGw7XG4gICAgICAgIHJldHVybiB0aGlzLm1hdHJpeENsaWVudD8uZ2V0Um9vbSh0aGlzLl9hY3RpdmVTcGFjZSkgPz8gbnVsbDtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0IHN1Z2dlc3RlZFJvb21zKCk6IElTdWdnZXN0ZWRSb29tW10ge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3VnZ2VzdGVkUm9vbXM7XG4gICAgfVxuXG4gICAgcHVibGljIGdldCBhbGxSb29tc0luSG9tZSgpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FsbFJvb21zSW5Ib21lO1xuICAgIH1cblxuICAgIHB1YmxpYyBzZXRBY3RpdmVSb29tSW5TcGFjZShzcGFjZTogU3BhY2VLZXkpOiB2b2lkIHtcbiAgICAgICAgaWYgKCFpc01ldGFTcGFjZShzcGFjZSkgJiYgIXRoaXMubWF0cml4Q2xpZW50Py5nZXRSb29tKHNwYWNlKT8uaXNTcGFjZVJvb20oKSkgcmV0dXJuO1xuICAgICAgICBpZiAoc3BhY2UgIT09IHRoaXMuYWN0aXZlU3BhY2UpIHRoaXMuc2V0QWN0aXZlU3BhY2Uoc3BhY2UsIGZhbHNlKTtcblxuICAgICAgICBpZiAoc3BhY2UpIHtcbiAgICAgICAgICAgIGNvbnN0IHJvb21JZCA9IHRoaXMuZ2V0Tm90aWZpY2F0aW9uU3RhdGUoc3BhY2UpLmdldEZpcnN0Um9vbVdpdGhOb3RpZmljYXRpb25zKCk7XG4gICAgICAgICAgICBkZWZhdWx0RGlzcGF0Y2hlci5kaXNwYXRjaDxWaWV3Um9vbVBheWxvYWQ+KHtcbiAgICAgICAgICAgICAgICBhY3Rpb246IEFjdGlvbi5WaWV3Um9vbSxcbiAgICAgICAgICAgICAgICByb29tX2lkOiByb29tSWQsXG4gICAgICAgICAgICAgICAgY29udGV4dF9zd2l0Y2g6IHRydWUsXG4gICAgICAgICAgICAgICAgbWV0cmljc1RyaWdnZXI6IFwiV2ViU3BhY2VQYW5lbE5vdGlmaWNhdGlvbkJhZGdlXCIsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGxpc3RzID0gUm9vbUxpc3RTdG9yZS5pbnN0YW5jZS5vcmRlcmVkTGlzdHM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IFRBR19PUkRFUi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHQgPSBUQUdfT1JERVJbaV07XG4gICAgICAgICAgICAgICAgY29uc3QgbGlzdFJvb21zID0gbGlzdHNbdF07XG4gICAgICAgICAgICAgICAgY29uc3QgdW5yZWFkUm9vbSA9IGxpc3RSb29tcy5maW5kKChyOiBSb29tKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnNob3dJbkhvbWVTcGFjZShyKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3RhdGUgPSBSb29tTm90aWZpY2F0aW9uU3RhdGVTdG9yZS5pbnN0YW5jZS5nZXRSb29tU3RhdGUocik7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3RhdGUuaXNVbnJlYWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAodW5yZWFkUm9vbSkge1xuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0RGlzcGF0Y2hlci5kaXNwYXRjaDxWaWV3Um9vbVBheWxvYWQ+KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjdGlvbjogQWN0aW9uLlZpZXdSb29tLFxuICAgICAgICAgICAgICAgICAgICAgICAgcm9vbV9pZDogdW5yZWFkUm9vbS5yb29tSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0X3N3aXRjaDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1ldHJpY3NUcmlnZ2VyOiBcIldlYlNwYWNlUGFuZWxOb3RpZmljYXRpb25CYWRnZVwiLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgYWN0aXZlIHNwYWNlLCB1cGRhdGVzIHJvb20gbGlzdCBmaWx0ZXJzLFxuICAgICAqIG9wdGlvbmFsbHkgc3dpdGNoZXMgdGhlIHVzZXIncyByb29tIGJhY2sgdG8gd2hlcmUgdGhleSB3ZXJlIHdoZW4gdGhleSBsYXN0IHZpZXdlZCB0aGF0IHNwYWNlLlxuICAgICAqIEBwYXJhbSBzcGFjZSB3aGljaCBzcGFjZSB0byBzd2l0Y2ggdG8uXG4gICAgICogQHBhcmFtIGNvbnRleHRTd2l0Y2ggd2hldGhlciB0byBzd2l0Y2ggdGhlIHVzZXIncyBjb250ZXh0LFxuICAgICAqIHNob3VsZCBub3QgYmUgZG9uZSB3aGVuIHRoZSBzcGFjZSBzd2l0Y2ggaXMgZG9uZSBpbXBsaWNpdGx5IGR1ZSB0byBhbm90aGVyIGV2ZW50IGxpa2Ugc3dpdGNoaW5nIHJvb20uXG4gICAgICovXG4gICAgcHVibGljIHNldEFjdGl2ZVNwYWNlKHNwYWNlOiBTcGFjZUtleSwgY29udGV4dFN3aXRjaCA9IHRydWUpOiB2b2lkIHtcbiAgICAgICAgaWYgKCFzcGFjZSB8fCAhdGhpcy5tYXRyaXhDbGllbnQgfHwgc3BhY2UgPT09IHRoaXMuYWN0aXZlU3BhY2UpIHJldHVybjtcblxuICAgICAgICBsZXQgY2xpU3BhY2U6IFJvb20gfCBudWxsID0gbnVsbDtcbiAgICAgICAgaWYgKCFpc01ldGFTcGFjZShzcGFjZSkpIHtcbiAgICAgICAgICAgIGNsaVNwYWNlID0gdGhpcy5tYXRyaXhDbGllbnQuZ2V0Um9vbShzcGFjZSk7XG4gICAgICAgICAgICBpZiAoIWNsaVNwYWNlPy5pc1NwYWNlUm9vbSgpKSByZXR1cm47XG4gICAgICAgIH0gZWxzZSBpZiAoIXRoaXMuZW5hYmxlZE1ldGFTcGFjZXMuaW5jbHVkZXMoc3BhY2UgYXMgTWV0YVNwYWNlKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgd2luZG93LmxvY2FsU3RvcmFnZS5zZXRJdGVtKEFDVElWRV9TUEFDRV9MU19LRVksICh0aGlzLl9hY3RpdmVTcGFjZSA9IHNwYWNlKSk7IC8vIFVwZGF0ZSAmIHBlcnNpc3Qgc2VsZWN0ZWQgc3BhY2VcblxuICAgICAgICBpZiAoY29udGV4dFN3aXRjaCkge1xuICAgICAgICAgICAgLy8gdmlldyBsYXN0IHNlbGVjdGVkIHJvb20gZnJvbSBzcGFjZVxuICAgICAgICAgICAgY29uc3Qgcm9vbUlkID0gd2luZG93LmxvY2FsU3RvcmFnZS5nZXRJdGVtKGdldFNwYWNlQ29udGV4dEtleShzcGFjZSkpO1xuXG4gICAgICAgICAgICAvLyBpZiB0aGUgc3BhY2UgYmVpbmcgc2VsZWN0ZWQgaXMgYW4gaW52aXRlIHRoZW4gYWx3YXlzIHZpZXcgdGhhdCBpbnZpdGVcbiAgICAgICAgICAgIC8vIGVsc2UgaWYgdGhlIGxhc3Qgdmlld2VkIHJvb20gaW4gdGhpcyBzcGFjZSBpcyBqb2luZWQgdGhlbiB2aWV3IHRoYXRcbiAgICAgICAgICAgIC8vIGVsc2UgdmlldyBzcGFjZSBob21lIG9yIGhvbWUgZGVwZW5kaW5nIG9uIHdoYXQgaXMgYmVpbmcgY2xpY2tlZCBvblxuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgIHJvb21JZCAmJlxuICAgICAgICAgICAgICAgIGNsaVNwYWNlPy5nZXRNeU1lbWJlcnNoaXAoKSAhPT0gXCJpbnZpdGVcIiAmJlxuICAgICAgICAgICAgICAgIHRoaXMubWF0cml4Q2xpZW50LmdldFJvb20ocm9vbUlkKT8uZ2V0TXlNZW1iZXJzaGlwKCkgPT09IFwiam9pblwiICYmXG4gICAgICAgICAgICAgICAgdGhpcy5pc1Jvb21JblNwYWNlKHNwYWNlLCByb29tSWQpXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICBkZWZhdWx0RGlzcGF0Y2hlci5kaXNwYXRjaDxWaWV3Um9vbVBheWxvYWQ+KHtcbiAgICAgICAgICAgICAgICAgICAgYWN0aW9uOiBBY3Rpb24uVmlld1Jvb20sXG4gICAgICAgICAgICAgICAgICAgIHJvb21faWQ6IHJvb21JZCxcbiAgICAgICAgICAgICAgICAgICAgY29udGV4dF9zd2l0Y2g6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIG1ldHJpY3NUcmlnZ2VyOiBcIldlYlNwYWNlQ29udGV4dFN3aXRjaFwiLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjbGlTcGFjZSkge1xuICAgICAgICAgICAgICAgIGRlZmF1bHREaXNwYXRjaGVyLmRpc3BhdGNoPFZpZXdSb29tUGF5bG9hZD4oe1xuICAgICAgICAgICAgICAgICAgICBhY3Rpb246IEFjdGlvbi5WaWV3Um9vbSxcbiAgICAgICAgICAgICAgICAgICAgcm9vbV9pZDogc3BhY2UsXG4gICAgICAgICAgICAgICAgICAgIGNvbnRleHRfc3dpdGNoOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBtZXRyaWNzVHJpZ2dlcjogXCJXZWJTcGFjZUNvbnRleHRTd2l0Y2hcIixcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZGVmYXVsdERpc3BhdGNoZXIuZGlzcGF0Y2g8Vmlld0hvbWVQYWdlUGF5bG9hZD4oe1xuICAgICAgICAgICAgICAgICAgICBhY3Rpb246IEFjdGlvbi5WaWV3SG9tZVBhZ2UsXG4gICAgICAgICAgICAgICAgICAgIGNvbnRleHRfc3dpdGNoOiB0cnVlLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5lbWl0KFVQREFURV9TRUxFQ1RFRF9TUEFDRSwgdGhpcy5hY3RpdmVTcGFjZSk7XG4gICAgICAgIHRoaXMuZW1pdChVUERBVEVfU1VHR0VTVEVEX1JPT01TLCAodGhpcy5fc3VnZ2VzdGVkUm9vbXMgPSBbXSkpO1xuXG4gICAgICAgIGlmIChjbGlTcGFjZSkge1xuICAgICAgICAgICAgdGhpcy5sb2FkU3VnZ2VzdGVkUm9vbXMoY2xpU3BhY2UpO1xuXG4gICAgICAgICAgICAvLyBMb2FkIGFsbCBtZW1iZXJzIGZvciB0aGUgc2VsZWN0ZWQgc3BhY2UgYW5kIGl0cyBzdWJzcGFjZXMsXG4gICAgICAgICAgICAvLyBzbyB3ZSBjYW4gY29ycmVjdGx5IHNob3cgRE1zIHdlIGhhdmUgd2l0aCBtZW1iZXJzIG9mIHRoaXMgc3BhY2UuXG4gICAgICAgICAgICBTcGFjZVN0b3JlLmluc3RhbmNlLnRyYXZlcnNlU3BhY2UoXG4gICAgICAgICAgICAgICAgc3BhY2UsXG4gICAgICAgICAgICAgICAgKHJvb21JZCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm1hdHJpeENsaWVudD8uZ2V0Um9vbShyb29tSWQpPy5sb2FkTWVtYmVyc0lmTmVlZGVkKCk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGxvYWRTdWdnZXN0ZWRSb29tcyhzcGFjZTogUm9vbSk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCBzdWdnZXN0ZWRSb29tcyA9IGF3YWl0IHRoaXMuZmV0Y2hTdWdnZXN0ZWRSb29tcyhzcGFjZSk7XG4gICAgICAgIGlmICh0aGlzLl9hY3RpdmVTcGFjZSA9PT0gc3BhY2Uucm9vbUlkKSB7XG4gICAgICAgICAgICB0aGlzLl9zdWdnZXN0ZWRSb29tcyA9IHN1Z2dlc3RlZFJvb21zO1xuICAgICAgICAgICAgdGhpcy5lbWl0KFVQREFURV9TVUdHRVNURURfUk9PTVMsIHRoaXMuX3N1Z2dlc3RlZFJvb21zKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBmZXRjaFN1Z2dlc3RlZFJvb21zID0gYXN5bmMgKHNwYWNlOiBSb29tLCBsaW1pdCA9IE1BWF9TVUdHRVNURURfUk9PTVMpOiBQcm9taXNlPElTdWdnZXN0ZWRSb29tW10+ID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgcm9vbXMgfSA9IGF3YWl0IHRoaXMubWF0cml4Q2xpZW50IS5nZXRSb29tSGllcmFyY2h5KHNwYWNlLnJvb21JZCwgbGltaXQsIDEsIHRydWUpO1xuXG4gICAgICAgICAgICBjb25zdCB2aWFNYXAgPSBuZXcgRW5oYW5jZWRNYXA8c3RyaW5nLCBTZXQ8c3RyaW5nPj4oKTtcbiAgICAgICAgICAgIHJvb21zLmZvckVhY2goKHJvb20pID0+IHtcbiAgICAgICAgICAgICAgICByb29tLmNoaWxkcmVuX3N0YXRlLmZvckVhY2goKGV2KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChldi50eXBlID09PSBFdmVudFR5cGUuU3BhY2VDaGlsZCAmJiBldi5jb250ZW50LnZpYT8ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBldi5jb250ZW50LnZpYS5mb3JFYWNoKCh2aWEpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2aWFNYXAuZ2V0T3JDcmVhdGUoZXYuc3RhdGVfa2V5LCBuZXcgU2V0KCkpLmFkZCh2aWEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gcm9vbXNcbiAgICAgICAgICAgICAgICAuZmlsdGVyKChyb29tSW5mbykgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgICAgICAgICAgcm9vbUluZm8ucm9vbV90eXBlICE9PSBSb29tVHlwZS5TcGFjZSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tYXRyaXhDbGllbnQ/LmdldFJvb20ocm9vbUluZm8ucm9vbV9pZCk/LmdldE15TWVtYmVyc2hpcCgpICE9PSBcImpvaW5cIlxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLm1hcCgocm9vbUluZm8pID0+ICh7XG4gICAgICAgICAgICAgICAgICAgIC4uLnJvb21JbmZvLFxuICAgICAgICAgICAgICAgICAgICB2aWFTZXJ2ZXJzOiBBcnJheS5mcm9tKHZpYU1hcC5nZXQocm9vbUluZm8ucm9vbV9pZCkgfHwgW10pLFxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgbG9nZ2VyLmVycm9yKGUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9O1xuXG4gICAgcHVibGljIGFkZFJvb21Ub1NwYWNlKHNwYWNlOiBSb29tLCByb29tSWQ6IHN0cmluZywgdmlhOiBzdHJpbmdbXSwgc3VnZ2VzdGVkID0gZmFsc2UpOiBQcm9taXNlPElTZW5kRXZlbnRSZXNwb25zZT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5tYXRyaXhDbGllbnQhLnNlbmRTdGF0ZUV2ZW50KFxuICAgICAgICAgICAgc3BhY2Uucm9vbUlkLFxuICAgICAgICAgICAgRXZlbnRUeXBlLlNwYWNlQ2hpbGQsXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdmlhLFxuICAgICAgICAgICAgICAgIHN1Z2dlc3RlZCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByb29tSWQsXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgcHVibGljIGdldENoaWxkcmVuKHNwYWNlSWQ6IHN0cmluZyk6IFJvb21bXSB7XG4gICAgICAgIGNvbnN0IHJvb20gPSB0aGlzLm1hdHJpeENsaWVudD8uZ2V0Um9vbShzcGFjZUlkKTtcbiAgICAgICAgY29uc3QgY2hpbGRFdmVudHMgPSByb29tPy5jdXJyZW50U3RhdGVcbiAgICAgICAgICAgIC5nZXRTdGF0ZUV2ZW50cyhFdmVudFR5cGUuU3BhY2VDaGlsZClcbiAgICAgICAgICAgIC5maWx0ZXIoKGV2KSA9PiBldi5nZXRDb250ZW50KCk/LnZpYSk7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICBzb3J0QnkoY2hpbGRFdmVudHMsIChldikgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBnZXRDaGlsZE9yZGVyKGV2LmdldENvbnRlbnQoKS5vcmRlciwgZXYuZ2V0VHMoKSwgZXYuZ2V0U3RhdGVLZXkoKSEpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAubWFwKChldikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBoaXN0b3J5ID0gdGhpcy5tYXRyaXhDbGllbnQhLmdldFJvb21VcGdyYWRlSGlzdG9yeShcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2LmdldFN0YXRlS2V5KCkhLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX21zYzM5NDZQcm9jZXNzRHluYW1pY1ByZWRlY2Vzc29yLFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaGlzdG9yeVtoaXN0b3J5Lmxlbmd0aCAtIDFdO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmZpbHRlcigocm9vbSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcm9vbT8uZ2V0TXlNZW1iZXJzaGlwKCkgPT09IFwiam9pblwiIHx8IHJvb20/LmdldE15TWVtYmVyc2hpcCgpID09PSBcImludml0ZVwiO1xuICAgICAgICAgICAgICAgIH0pIHx8IFtdXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgcHVibGljIGdldENoaWxkUm9vbXMoc3BhY2VJZDogc3RyaW5nKTogUm9vbVtdIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0Q2hpbGRyZW4oc3BhY2VJZCkuZmlsdGVyKChyKSA9PiAhci5pc1NwYWNlUm9vbSgpKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0Q2hpbGRTcGFjZXMoc3BhY2VJZDogc3RyaW5nKTogUm9vbVtdIHtcbiAgICAgICAgLy8gZG9uJ3Qgc2hvdyBpbnZpdGVkIHN1YnNwYWNlcyBhcyB0aGV5IHN1cmZhY2UgYXQgdGhlIHRvcCBsZXZlbCBmb3IgYmV0dGVyIHZpc2liaWxpdHlcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0Q2hpbGRyZW4oc3BhY2VJZCkuZmlsdGVyKChyKSA9PiByLmlzU3BhY2VSb29tKCkgJiYgci5nZXRNeU1lbWJlcnNoaXAoKSA9PT0gXCJqb2luXCIpO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXRQYXJlbnRzKHJvb21JZDogc3RyaW5nLCBjYW5vbmljYWxPbmx5ID0gZmFsc2UpOiBSb29tW10ge1xuICAgICAgICBpZiAoIXRoaXMubWF0cml4Q2xpZW50KSByZXR1cm4gW107XG4gICAgICAgIGNvbnN0IHVzZXJJZCA9IHRoaXMubWF0cml4Q2xpZW50LmdldFNhZmVVc2VySWQoKTtcbiAgICAgICAgY29uc3Qgcm9vbSA9IHRoaXMubWF0cml4Q2xpZW50LmdldFJvb20ocm9vbUlkKTtcbiAgICAgICAgY29uc3QgZXZlbnRzID0gcm9vbT8uY3VycmVudFN0YXRlLmdldFN0YXRlRXZlbnRzKEV2ZW50VHlwZS5TcGFjZVBhcmVudCkgPz8gW107XG4gICAgICAgIHJldHVybiBmaWx0ZXJCb29sZWFuKFxuICAgICAgICAgICAgZXZlbnRzLm1hcCgoZXYpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gZXYuZ2V0Q29udGVudCgpO1xuICAgICAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShjb250ZW50LnZpYSkgfHwgKGNhbm9uaWNhbE9ubHkgJiYgIWNvbnRlbnQuY2Fub25pY2FsKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47IC8vIHNraXBcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBvbmx5IHJlc3BlY3QgdGhlIHJlbGF0aW9uc2hpcCBpZiB0aGUgc2VuZGVyIGhhcyBzdWZmaWNpZW50IHBlcm1pc3Npb25zIGluIHRoZSBwYXJlbnQgdG8gc2V0XG4gICAgICAgICAgICAgICAgLy8gY2hpbGQgcmVsYXRpb25zLCBhcyBwZXIgTVNDMTc3Mi5cbiAgICAgICAgICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vbWF0cml4LW9yZy9tYXRyaXgtZG9jL2Jsb2IvbWFpbi9wcm9wb3NhbHMvMTc3Mi1ncm91cHMtYXMtcm9vbXMubWQjcmVsYXRpb25zaGlwLWJldHdlZW4tcm9vbXMtYW5kLXNwYWNlc1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhcmVudCA9IHRoaXMubWF0cml4Q2xpZW50Py5nZXRSb29tKGV2LmdldFN0YXRlS2V5KCkpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlbGF0aW9uID0gcGFyZW50Py5jdXJyZW50U3RhdGUuZ2V0U3RhdGVFdmVudHMoRXZlbnRUeXBlLlNwYWNlQ2hpbGQsIHJvb21JZCk7XG4gICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICAhcGFyZW50Py5jdXJyZW50U3RhdGUubWF5U2VuZFN0YXRlRXZlbnQoRXZlbnRUeXBlLlNwYWNlQ2hpbGQsIHVzZXJJZCkgfHxcbiAgICAgICAgICAgICAgICAgICAgLy8gYWxzbyBza2lwIHRoaXMgcmVsYXRpb24gaWYgdGhlIHBhcmVudCBoYWQgdGhpcyBjaGlsZCBhZGRlZCBidXQgdGhlbiBzaW5jZSByZW1vdmVkIGl0XG4gICAgICAgICAgICAgICAgICAgIChyZWxhdGlvbiAmJiAhQXJyYXkuaXNBcnJheShyZWxhdGlvbi5nZXRDb250ZW50KCkudmlhKSlcbiAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuOyAvLyBza2lwXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhcmVudDtcbiAgICAgICAgICAgIH0pLFxuICAgICAgICApO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXRDYW5vbmljYWxQYXJlbnQocm9vbUlkOiBzdHJpbmcpOiBSb29tIHwgbnVsbCB7XG4gICAgICAgIGNvbnN0IHBhcmVudHMgPSB0aGlzLmdldFBhcmVudHMocm9vbUlkLCB0cnVlKTtcbiAgICAgICAgcmV0dXJuIHNvcnRCeShwYXJlbnRzLCAocikgPT4gci5yb29tSWQpPy5bMF0gfHwgbnVsbDtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0S25vd25QYXJlbnRzKHJvb21JZDogc3RyaW5nLCBpbmNsdWRlQW5jZXN0b3JzPzogYm9vbGVhbik6IFNldDxzdHJpbmc+IHtcbiAgICAgICAgaWYgKGluY2x1ZGVBbmNlc3RvcnMpIHtcbiAgICAgICAgICAgIHJldHVybiBmbGF0dGVuU3BhY2VIaWVyYXJjaHkodGhpcy5wYXJlbnRNYXAsIHRoaXMucGFyZW50TWFwLCByb29tSWQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLnBhcmVudE1hcC5nZXQocm9vbUlkKSB8fCBuZXcgU2V0KCk7XG4gICAgfVxuXG4gICAgcHVibGljIGlzUm9vbUluU3BhY2Uoc3BhY2U6IFNwYWNlS2V5LCByb29tSWQ6IHN0cmluZywgaW5jbHVkZURlc2NlbmRhbnRTcGFjZXMgPSB0cnVlKTogYm9vbGVhbiB7XG4gICAgICAgIGlmIChzcGFjZSA9PT0gTWV0YVNwYWNlLkhvbWUgJiYgdGhpcy5hbGxSb29tc0luSG9tZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5nZXRTcGFjZUZpbHRlcmVkUm9vbUlkcyhzcGFjZSwgaW5jbHVkZURlc2NlbmRhbnRTcGFjZXMpPy5oYXMocm9vbUlkKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkbVBhcnRuZXIgPSBETVJvb21NYXAuc2hhcmVkKCkuZ2V0VXNlcklkRm9yUm9vbUlkKHJvb21JZCk7XG4gICAgICAgIGlmICghZG1QYXJ0bmVyKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgLy8gYmV5b25kIHRoaXMgcG9pbnQgd2Uga25vdyB0aGlzIGlzIGEgRE1cblxuICAgICAgICBpZiAoc3BhY2UgPT09IE1ldGFTcGFjZS5Ib21lIHx8IHNwYWNlID09PSBNZXRhU3BhY2UuUGVvcGxlKSB7XG4gICAgICAgICAgICAvLyB0aGVzZSBzcGFjZXMgY29udGFpbiBhbGwgRE1zXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChcbiAgICAgICAgICAgICFpc01ldGFTcGFjZShzcGFjZSkgJiZcbiAgICAgICAgICAgIHRoaXMuZ2V0U3BhY2VGaWx0ZXJlZFVzZXJJZHMoc3BhY2UsIGluY2x1ZGVEZXNjZW5kYW50U3BhY2VzKT8uaGFzKGRtUGFydG5lcikgJiZcbiAgICAgICAgICAgIFNldHRpbmdzU3RvcmUuZ2V0VmFsdWUoXCJTcGFjZXMuc2hvd1Blb3BsZUluU3BhY2VcIiwgc3BhY2UpXG4gICAgICAgICkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gZ2V0IGFsbCByb29tcyBpbiBhIHNwYWNlXG4gICAgLy8gaW5jbHVkaW5nIGRlc2NlbmRhbnQgc3BhY2VzXG4gICAgcHVibGljIGdldFNwYWNlRmlsdGVyZWRSb29tSWRzID0gKFxuICAgICAgICBzcGFjZTogU3BhY2VLZXksXG4gICAgICAgIGluY2x1ZGVEZXNjZW5kYW50U3BhY2VzID0gdHJ1ZSxcbiAgICAgICAgdXNlQ2FjaGUgPSB0cnVlLFxuICAgICk6IFNldDxzdHJpbmc+ID0+IHtcbiAgICAgICAgaWYgKHNwYWNlID09PSBNZXRhU3BhY2UuSG9tZSAmJiB0aGlzLmFsbFJvb21zSW5Ib21lKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFNldChcbiAgICAgICAgICAgICAgICB0aGlzLm1hdHJpeENsaWVudCEuZ2V0VmlzaWJsZVJvb21zKHRoaXMuX21zYzM5NDZQcm9jZXNzRHluYW1pY1ByZWRlY2Vzc29yKS5tYXAoKHIpID0+IHIucm9vbUlkKSxcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBtZXRhIHNwYWNlcyBuZXZlciBoYXZlIGRlc2NlbmRhbnRzXG4gICAgICAgIC8vIGFuZCB0aGUgYWdncmVnYXRlIGNhY2hlIGlzIG5vdCBtYW5hZ2VkIGZvciBtZXRhIHNwYWNlc1xuICAgICAgICBpZiAoIWluY2x1ZGVEZXNjZW5kYW50U3BhY2VzIHx8IGlzTWV0YVNwYWNlKHNwYWNlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucm9vbUlkc0J5U3BhY2UuZ2V0KHNwYWNlKSB8fCBuZXcgU2V0KCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5nZXRBZ2dyZWdhdGVkUm9vbUlkc0J5U3BhY2UodGhpcy5yb29tSWRzQnlTcGFjZSwgdGhpcy5jaGlsZFNwYWNlc0J5U3BhY2UsIHNwYWNlLCB1c2VDYWNoZSk7XG4gICAgfTtcblxuICAgIHB1YmxpYyBnZXRTcGFjZUZpbHRlcmVkVXNlcklkcyA9IChcbiAgICAgICAgc3BhY2U6IFNwYWNlS2V5LFxuICAgICAgICBpbmNsdWRlRGVzY2VuZGFudFNwYWNlcyA9IHRydWUsXG4gICAgICAgIHVzZUNhY2hlID0gdHJ1ZSxcbiAgICApOiBTZXQ8c3RyaW5nPiB8IHVuZGVmaW5lZCA9PiB7XG4gICAgICAgIGlmIChzcGFjZSA9PT0gTWV0YVNwYWNlLkhvbWUgJiYgdGhpcy5hbGxSb29tc0luSG9tZSkge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaXNNZXRhU3BhY2Uoc3BhY2UpKSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbWV0YSBzcGFjZXMgbmV2ZXIgaGF2ZSBkZXNjZW5kYW50c1xuICAgICAgICAvLyBhbmQgdGhlIGFnZ3JlZ2F0ZSBjYWNoZSBpcyBub3QgbWFuYWdlZCBmb3IgbWV0YSBzcGFjZXNcbiAgICAgICAgaWYgKCFpbmNsdWRlRGVzY2VuZGFudFNwYWNlcyB8fCBpc01ldGFTcGFjZShzcGFjZSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnVzZXJJZHNCeVNwYWNlLmdldChzcGFjZSkgfHwgbmV3IFNldCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0QWdncmVnYXRlZFVzZXJJZHNCeVNwYWNlKHRoaXMudXNlcklkc0J5U3BhY2UsIHRoaXMuY2hpbGRTcGFjZXNCeVNwYWNlLCBzcGFjZSwgdXNlQ2FjaGUpO1xuICAgIH07XG5cbiAgICBwcml2YXRlIGdldEFnZ3JlZ2F0ZWRSb29tSWRzQnlTcGFjZSA9IGZsYXR0ZW5TcGFjZUhpZXJhcmNoeVdpdGhDYWNoZSh0aGlzLl9hZ2dyZWdhdGVkU3BhY2VDYWNoZS5yb29tSWRzQnlTcGFjZSk7XG4gICAgcHJpdmF0ZSBnZXRBZ2dyZWdhdGVkVXNlcklkc0J5U3BhY2UgPSBmbGF0dGVuU3BhY2VIaWVyYXJjaHlXaXRoQ2FjaGUodGhpcy5fYWdncmVnYXRlZFNwYWNlQ2FjaGUudXNlcklkc0J5U3BhY2UpO1xuXG4gICAgcHJpdmF0ZSBtYXJrVHJlZUNoaWxkcmVuID0gKHJvb3RTcGFjZTogUm9vbSwgdW5zZWVuOiBTZXQ8Um9vbT4pOiB2b2lkID0+IHtcbiAgICAgICAgY29uc3Qgc3RhY2sgPSBbcm9vdFNwYWNlXTtcbiAgICAgICAgd2hpbGUgKHN0YWNrLmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc3Qgc3BhY2UgPSBzdGFjay5wb3AoKSE7XG4gICAgICAgICAgICB1bnNlZW4uZGVsZXRlKHNwYWNlKTtcbiAgICAgICAgICAgIHRoaXMuZ2V0Q2hpbGRTcGFjZXMoc3BhY2Uucm9vbUlkKS5mb3JFYWNoKChzcGFjZSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh1bnNlZW4uaGFzKHNwYWNlKSkge1xuICAgICAgICAgICAgICAgICAgICBzdGFjay5wdXNoKHNwYWNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBwcml2YXRlIGZpbmRSb290U3BhY2VzID0gKGpvaW5lZFNwYWNlczogUm9vbVtdKTogUm9vbVtdID0+IHtcbiAgICAgICAgLy8gZXhjbHVkZSBpbnZpdGVkIHNwYWNlcyBmcm9tIHVuc2VlbkNoaWxkcmVuIGFzIHRoZXkgd2lsbCBiZSBmb3JjaWJseSBzaG93biBhdCB0aGUgdG9wIGxldmVsIG9mIHRoZSB0cmVldmlld1xuICAgICAgICBjb25zdCB1bnNlZW5TcGFjZXMgPSBuZXcgU2V0KGpvaW5lZFNwYWNlcyk7XG5cbiAgICAgICAgam9pbmVkU3BhY2VzLmZvckVhY2goKHNwYWNlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmdldENoaWxkU3BhY2VzKHNwYWNlLnJvb21JZCkuZm9yRWFjaCgoc3Vic3BhY2UpID0+IHtcbiAgICAgICAgICAgICAgICB1bnNlZW5TcGFjZXMuZGVsZXRlKHN1YnNwYWNlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBDb25zaWRlciBhbnkgc3BhY2VzIHJlbWFpbmluZyBpbiB1bnNlZW5TcGFjZXMgYXMgcm9vdCxcbiAgICAgICAgLy8gZ2l2ZW4gdGhleSBhcmUgbm90IGNoaWxkcmVuIG9mIGFueSBrbm93biBzcGFjZXMuXG4gICAgICAgIC8vIFRoZSBoaWVyYXJjaHkgZnJvbSB0aGVzZSByb290cyBtYXkgbm90IHlldCBiZSBleGhhdXN0aXZlIGR1ZSB0byB0aGUgcG9zc2liaWxpdHkgb2YgZnVsbC1jeWNsZXMuXG4gICAgICAgIGNvbnN0IHJvb3RTcGFjZXMgPSBBcnJheS5mcm9tKHVuc2VlblNwYWNlcyk7XG5cbiAgICAgICAgLy8gTmV4dCB3ZSBuZWVkIHRvIGRldGVybWluZSB0aGUgcm9vdHMgb2YgYW55IHJlbWFpbmluZyBmdWxsLWN5Y2xlcy5cbiAgICAgICAgLy8gV2Ugc29ydCBzcGFjZXMgYnkgcm9vbSBJRCB0byBmb3JjZSB0aGUgY3ljbGUgYnJlYWtpbmcgdG8gYmUgZGV0ZXJtaW5pc3RpYy5cbiAgICAgICAgY29uc3QgZGV0YWNoZWROb2RlcyA9IG5ldyBTZXQ8Um9vbT4oc29ydEJ5KGpvaW5lZFNwYWNlcywgKHNwYWNlKSA9PiBzcGFjZS5yb29tSWQpKTtcblxuICAgICAgICAvLyBNYXJrIGFueSBub2RlcyB3aGljaCBhcmUgY2hpbGRyZW4gb2Ygb3VyIGV4aXN0aW5nIHJvb3Qgc3BhY2VzIGFzIGF0dGFjaGVkLlxuICAgICAgICByb290U3BhY2VzLmZvckVhY2goKHJvb3RTcGFjZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5tYXJrVHJlZUNoaWxkcmVuKHJvb3RTcGFjZSwgZGV0YWNoZWROb2Rlcyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEhhbmRsZSBzcGFjZXMgZm9ybWluZyBmdWxseSBjeWNsaWNhbCByZWxhdGlvbnNoaXBzLlxuICAgICAgICAvLyBJbiBvcmRlciwgYXNzdW1lIGVhY2ggcmVtYWluaW5nIGRldGFjaGVkTm9kZSBpcyBhIHJvb3QgdW5sZXNzIGl0IGhhcyBhbHJlYWR5XG4gICAgICAgIC8vIGJlZW4gY2xhaW1lZCBhcyB0aGUgY2hpbGQgb2YgcHJpb3IgZGV0YWNoZWQgbm9kZS5cbiAgICAgICAgLy8gV29yayBmcm9tIGEgY29weSBvZiB0aGUgZGV0YWNoZWROb2RlcyBzZXQgYXMgaXQgd2lsbCBiZSBtdXRhdGVkIGFzIHBhcnQgb2YgdGhpcyBvcGVyYXRpb24uXG4gICAgICAgIC8vIFRPRE8gY29uc2lkZXIgc29ydGluZyBieSBudW1iZXIgb2YgaW4tcmVmcyB0byBmYXZvdXIgbm9kZXMgd2l0aCBmZXdlciBwYXJlbnRzLlxuICAgICAgICBBcnJheS5mcm9tKGRldGFjaGVkTm9kZXMpLmZvckVhY2goKGRldGFjaGVkTm9kZSkgPT4ge1xuICAgICAgICAgICAgaWYgKCFkZXRhY2hlZE5vZGVzLmhhcyhkZXRhY2hlZE5vZGUpKSByZXR1cm47IC8vIGFscmVhZHkgY2xhaW1lZCwgc2tpcFxuICAgICAgICAgICAgLy8gZGVjbGFyZSB0aGlzIGRldGFjaGVkIG5vZGUgYSBuZXcgcm9vdCwgZmluZCBpdHMgY2hpbGRyZW4sIHdpdGhvdXQgZXZlciBsb29waW5nIGJhY2sgdG8gaXRcbiAgICAgICAgICAgIHJvb3RTcGFjZXMucHVzaChkZXRhY2hlZE5vZGUpOyAvLyBjb25zaWRlciB0aGlzIG5vZGUgYSBuZXcgcm9vdCBzcGFjZVxuICAgICAgICAgICAgdGhpcy5tYXJrVHJlZUNoaWxkcmVuKGRldGFjaGVkTm9kZSwgZGV0YWNoZWROb2Rlcyk7IC8vIGRlY2xhcmUgdGhpcyBub2RlIGFuZCBpdHMgY2hpbGRyZW4gYXR0YWNoZWRcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHJvb3RTcGFjZXM7XG4gICAgfTtcblxuICAgIHByaXZhdGUgcmVidWlsZFNwYWNlSGllcmFyY2h5ID0gKCk6IHZvaWQgPT4ge1xuICAgICAgICBpZiAoIXRoaXMubWF0cml4Q2xpZW50KSByZXR1cm47XG4gICAgICAgIGNvbnN0IHZpc2libGVTcGFjZXMgPSB0aGlzLm1hdHJpeENsaWVudFxuICAgICAgICAgICAgLmdldFZpc2libGVSb29tcyh0aGlzLl9tc2MzOTQ2UHJvY2Vzc0R5bmFtaWNQcmVkZWNlc3NvcilcbiAgICAgICAgICAgIC5maWx0ZXIoKHIpID0+IHIuaXNTcGFjZVJvb20oKSk7XG4gICAgICAgIGNvbnN0IFtqb2luZWRTcGFjZXMsIGludml0ZWRTcGFjZXNdID0gdmlzaWJsZVNwYWNlcy5yZWR1Y2UoXG4gICAgICAgICAgICAoW2pvaW5lZCwgaW52aXRlZF0sIHMpID0+IHtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKGdldEVmZmVjdGl2ZU1lbWJlcnNoaXAocy5nZXRNeU1lbWJlcnNoaXAoKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBFZmZlY3RpdmVNZW1iZXJzaGlwLkpvaW46XG4gICAgICAgICAgICAgICAgICAgICAgICBqb2luZWQucHVzaChzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIEVmZmVjdGl2ZU1lbWJlcnNoaXAuSW52aXRlOlxuICAgICAgICAgICAgICAgICAgICAgICAgaW52aXRlZC5wdXNoKHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBbam9pbmVkLCBpbnZpdGVkXTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBbW10sIFtdXSBhcyBbUm9vbVtdLCBSb29tW11dLFxuICAgICAgICApO1xuXG4gICAgICAgIGNvbnN0IHJvb3RTcGFjZXMgPSB0aGlzLmZpbmRSb290U3BhY2VzKGpvaW5lZFNwYWNlcyk7XG4gICAgICAgIGNvbnN0IG9sZFJvb3RTcGFjZXMgPSB0aGlzLnJvb3RTcGFjZXM7XG4gICAgICAgIHRoaXMucm9vdFNwYWNlcyA9IHRoaXMuc29ydFJvb3RTcGFjZXMocm9vdFNwYWNlcyk7XG5cbiAgICAgICAgdGhpcy5vblJvb21zVXBkYXRlKCk7XG5cbiAgICAgICAgaWYgKGFycmF5SGFzT3JkZXJDaGFuZ2Uob2xkUm9vdFNwYWNlcywgdGhpcy5yb290U3BhY2VzKSkge1xuICAgICAgICAgICAgdGhpcy5lbWl0KFVQREFURV9UT1BfTEVWRUxfU1BBQ0VTLCB0aGlzLnNwYWNlUGFuZWxTcGFjZXMsIHRoaXMuZW5hYmxlZE1ldGFTcGFjZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgb2xkSW52aXRlZFNwYWNlcyA9IHRoaXMuX2ludml0ZWRTcGFjZXM7XG4gICAgICAgIHRoaXMuX2ludml0ZWRTcGFjZXMgPSBuZXcgU2V0KHRoaXMuc29ydFJvb3RTcGFjZXMoaW52aXRlZFNwYWNlcykpO1xuICAgICAgICBpZiAoc2V0SGFzRGlmZihvbGRJbnZpdGVkU3BhY2VzLCB0aGlzLl9pbnZpdGVkU3BhY2VzKSkge1xuICAgICAgICAgICAgdGhpcy5lbWl0KFVQREFURV9JTlZJVEVEX1NQQUNFUywgdGhpcy5pbnZpdGVkU3BhY2VzKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBwcml2YXRlIHJlYnVpbGRQYXJlbnRNYXAgPSAoKTogdm9pZCA9PiB7XG4gICAgICAgIGlmICghdGhpcy5tYXRyaXhDbGllbnQpIHJldHVybjtcbiAgICAgICAgY29uc3Qgam9pbmVkU3BhY2VzID0gdGhpcy5tYXRyaXhDbGllbnQuZ2V0VmlzaWJsZVJvb21zKHRoaXMuX21zYzM5NDZQcm9jZXNzRHluYW1pY1ByZWRlY2Vzc29yKS5maWx0ZXIoKHIpID0+IHtcbiAgICAgICAgICAgIHJldHVybiByLmlzU3BhY2VSb29tKCkgJiYgci5nZXRNeU1lbWJlcnNoaXAoKSA9PT0gXCJqb2luXCI7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMucGFyZW50TWFwID0gbmV3IEVuaGFuY2VkTWFwPHN0cmluZywgU2V0PHN0cmluZz4+KCk7XG4gICAgICAgIGpvaW5lZFNwYWNlcy5mb3JFYWNoKChzcGFjZSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgY2hpbGRyZW4gPSB0aGlzLmdldENoaWxkcmVuKHNwYWNlLnJvb21JZCk7XG4gICAgICAgICAgICBjaGlsZHJlbi5mb3JFYWNoKChjaGlsZCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50TWFwLmdldE9yQ3JlYXRlKGNoaWxkLnJvb21JZCwgbmV3IFNldCgpKS5hZGQoc3BhY2Uucm9vbUlkKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICBQb3N0aG9nQW5hbHl0aWNzLmluc3RhbmNlLnNldFByb3BlcnR5KFwibnVtU3BhY2VzXCIsIGpvaW5lZFNwYWNlcy5sZW5ndGgpO1xuICAgIH07XG5cbiAgICBwcml2YXRlIHJlYnVpbGRIb21lU3BhY2UgPSAoKTogdm9pZCA9PiB7XG4gICAgICAgIGlmICh0aGlzLmFsbFJvb21zSW5Ib21lKSB7XG4gICAgICAgICAgICAvLyB0aGlzIGlzIGEgc3BlY2lhbC1jYXNlIHRvIG5vdCBoYXZlIHRvIG1haW50YWluIGEgc2V0IG9mIGFsbCByb29tc1xuICAgICAgICAgICAgdGhpcy5yb29tSWRzQnlTcGFjZS5kZWxldGUoTWV0YVNwYWNlLkhvbWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgcm9vbXMgPSBuZXcgU2V0KFxuICAgICAgICAgICAgICAgIHRoaXMubWF0cml4Q2xpZW50IS5nZXRWaXNpYmxlUm9vbXModGhpcy5fbXNjMzk0NlByb2Nlc3NEeW5hbWljUHJlZGVjZXNzb3IpXG4gICAgICAgICAgICAgICAgICAgIC5maWx0ZXIodGhpcy5zaG93SW5Ib21lU3BhY2UpXG4gICAgICAgICAgICAgICAgICAgIC5tYXAoKHIpID0+IHIucm9vbUlkKSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICB0aGlzLnJvb21JZHNCeVNwYWNlLnNldChNZXRhU3BhY2UuSG9tZSwgcm9vbXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuYWN0aXZlU3BhY2UgPT09IE1ldGFTcGFjZS5Ib21lKSB7XG4gICAgICAgICAgICB0aGlzLnN3aXRjaFNwYWNlSWZOZWVkZWQoKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBwcml2YXRlIHJlYnVpbGRNZXRhU3BhY2VzID0gKCk6IHZvaWQgPT4ge1xuICAgICAgICBpZiAoIXRoaXMubWF0cml4Q2xpZW50KSByZXR1cm47XG4gICAgICAgIGNvbnN0IGVuYWJsZWRNZXRhU3BhY2VzID0gbmV3IFNldCh0aGlzLmVuYWJsZWRNZXRhU3BhY2VzKTtcbiAgICAgICAgY29uc3QgdmlzaWJsZVJvb21zID0gdGhpcy5tYXRyaXhDbGllbnQuZ2V0VmlzaWJsZVJvb21zKHRoaXMuX21zYzM5NDZQcm9jZXNzRHluYW1pY1ByZWRlY2Vzc29yKTtcblxuICAgICAgICBpZiAoZW5hYmxlZE1ldGFTcGFjZXMuaGFzKE1ldGFTcGFjZS5Ib21lKSkge1xuICAgICAgICAgICAgdGhpcy5yZWJ1aWxkSG9tZVNwYWNlKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnJvb21JZHNCeVNwYWNlLmRlbGV0ZShNZXRhU3BhY2UuSG9tZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZW5hYmxlZE1ldGFTcGFjZXMuaGFzKE1ldGFTcGFjZS5GYXZvdXJpdGVzKSkge1xuICAgICAgICAgICAgY29uc3QgZmF2b3VyaXRlcyA9IHZpc2libGVSb29tcy5maWx0ZXIoKHIpID0+IHIudGFnc1tEZWZhdWx0VGFnSUQuRmF2b3VyaXRlXSk7XG4gICAgICAgICAgICB0aGlzLnJvb21JZHNCeVNwYWNlLnNldChNZXRhU3BhY2UuRmF2b3VyaXRlcywgbmV3IFNldChmYXZvdXJpdGVzLm1hcCgocikgPT4gci5yb29tSWQpKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnJvb21JZHNCeVNwYWNlLmRlbGV0ZShNZXRhU3BhY2UuRmF2b3VyaXRlcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUaGUgUGVvcGxlIG1ldGFzcGFjZSBkb2Vzbid0IG5lZWQgbWFpbnRhaW5pbmdcblxuICAgICAgICAvLyBQb3B1bGF0ZSB0aGUgb3JwaGFucyBzcGFjZSBpZiB0aGUgSG9tZSBzcGFjZSBpcyBlbmFibGVkIGFzIGl0IGlzIGEgc3VwZXJzZXQgb2YgaXQuXG4gICAgICAgIC8vIEhvbWUgaXMgZWZmZWN0aXZlbHkgYSBzdXBlciBzZXQgb2YgUGVvcGxlICsgT3JwaGFucyB3aXRoIHRoZSBhZGRpdGlvbiBvZiBoYXZpbmcgYWxsIGludml0ZXMgdG9vLlxuICAgICAgICBpZiAoZW5hYmxlZE1ldGFTcGFjZXMuaGFzKE1ldGFTcGFjZS5PcnBoYW5zKSB8fCBlbmFibGVkTWV0YVNwYWNlcy5oYXMoTWV0YVNwYWNlLkhvbWUpKSB7XG4gICAgICAgICAgICBjb25zdCBvcnBoYW5zID0gdmlzaWJsZVJvb21zLmZpbHRlcigocikgPT4ge1xuICAgICAgICAgICAgICAgIC8vIGZpbHRlciBvdXQgRE1zIGFuZCByb29tcyB3aXRoID4wIHBhcmVudHNcbiAgICAgICAgICAgICAgICByZXR1cm4gIXRoaXMucGFyZW50TWFwLmdldChyLnJvb21JZCk/LnNpemUgJiYgIURNUm9vbU1hcC5zaGFyZWQoKS5nZXRVc2VySWRGb3JSb29tSWQoci5yb29tSWQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aGlzLnJvb21JZHNCeVNwYWNlLnNldChNZXRhU3BhY2UuT3JwaGFucywgbmV3IFNldChvcnBoYW5zLm1hcCgocikgPT4gci5yb29tSWQpKSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNNZXRhU3BhY2UodGhpcy5hY3RpdmVTcGFjZSkpIHtcbiAgICAgICAgICAgIHRoaXMuc3dpdGNoU3BhY2VJZk5lZWRlZCgpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHByaXZhdGUgdXBkYXRlTm90aWZpY2F0aW9uU3RhdGVzID0gKHNwYWNlcz86IFNwYWNlS2V5W10pOiB2b2lkID0+IHtcbiAgICAgICAgaWYgKCF0aGlzLm1hdHJpeENsaWVudCkgcmV0dXJuO1xuICAgICAgICBjb25zdCBlbmFibGVkTWV0YVNwYWNlcyA9IG5ldyBTZXQodGhpcy5lbmFibGVkTWV0YVNwYWNlcyk7XG4gICAgICAgIGNvbnN0IHZpc2libGVSb29tcyA9IHRoaXMubWF0cml4Q2xpZW50LmdldFZpc2libGVSb29tcyh0aGlzLl9tc2MzOTQ2UHJvY2Vzc0R5bmFtaWNQcmVkZWNlc3Nvcik7XG5cbiAgICAgICAgbGV0IGRtQmFkZ2VTcGFjZTogTWV0YVNwYWNlIHwgdW5kZWZpbmVkO1xuICAgICAgICAvLyBvbmx5IHNob3cgYmFkZ2VzIG9uIGRtcyBvbiB0aGUgbW9zdCByZWxldmFudCBzcGFjZSBpZiBzdWNoIGV4aXN0c1xuICAgICAgICBpZiAoZW5hYmxlZE1ldGFTcGFjZXMuaGFzKE1ldGFTcGFjZS5QZW9wbGUpKSB7XG4gICAgICAgICAgICBkbUJhZGdlU3BhY2UgPSBNZXRhU3BhY2UuUGVvcGxlO1xuICAgICAgICB9IGVsc2UgaWYgKGVuYWJsZWRNZXRhU3BhY2VzLmhhcyhNZXRhU3BhY2UuSG9tZSkpIHtcbiAgICAgICAgICAgIGRtQmFkZ2VTcGFjZSA9IE1ldGFTcGFjZS5Ib21lO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFzcGFjZXMpIHtcbiAgICAgICAgICAgIHNwYWNlcyA9IFsuLi50aGlzLnJvb21JZHNCeVNwYWNlLmtleXMoKV07XG4gICAgICAgICAgICBpZiAoZG1CYWRnZVNwYWNlID09PSBNZXRhU3BhY2UuUGVvcGxlKSB7XG4gICAgICAgICAgICAgICAgc3BhY2VzLnB1c2goTWV0YVNwYWNlLlBlb3BsZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZW5hYmxlZE1ldGFTcGFjZXMuaGFzKE1ldGFTcGFjZS5Ib21lKSAmJiAhdGhpcy5hbGxSb29tc0luSG9tZSkge1xuICAgICAgICAgICAgICAgIHNwYWNlcy5wdXNoKE1ldGFTcGFjZS5Ib21lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHNwYWNlcy5mb3JFYWNoKChzKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5hbGxSb29tc0luSG9tZSAmJiBzID09PSBNZXRhU3BhY2UuSG9tZSkgcmV0dXJuOyAvLyB3ZSdsbCBiZSB1c2luZyB0aGUgZ2xvYmFsIG5vdGlmaWNhdGlvbiBzdGF0ZSwgc2tpcFxuXG4gICAgICAgICAgICBjb25zdCBmbGF0dGVuZWRSb29tc0ZvclNwYWNlID0gdGhpcy5nZXRTcGFjZUZpbHRlcmVkUm9vbUlkcyhzLCB0cnVlKTtcblxuICAgICAgICAgICAgLy8gVXBkYXRlIE5vdGlmaWNhdGlvblN0YXRlc1xuICAgICAgICAgICAgdGhpcy5nZXROb3RpZmljYXRpb25TdGF0ZShzKS5zZXRSb29tcyhcbiAgICAgICAgICAgICAgICB2aXNpYmxlUm9vbXMuZmlsdGVyKChyb29tKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzID09PSBNZXRhU3BhY2UuUGVvcGxlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5pc1Jvb21JblNwYWNlKE1ldGFTcGFjZS5QZW9wbGUsIHJvb20ucm9vbUlkKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChyb29tLmlzU3BhY2VSb29tKCkgfHwgIWZsYXR0ZW5lZFJvb21zRm9yU3BhY2UuaGFzKHJvb20ucm9vbUlkKSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChkbUJhZGdlU3BhY2UgJiYgRE1Sb29tTWFwLnNoYXJlZCgpLmdldFVzZXJJZEZvclJvb21JZChyb29tLnJvb21JZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzID09PSBkbUJhZGdlU3BhY2U7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChkbUJhZGdlU3BhY2UgIT09IE1ldGFTcGFjZS5QZW9wbGUpIHtcbiAgICAgICAgICAgIHRoaXMubm90aWZpY2F0aW9uU3RhdGVNYXAuZGVsZXRlKE1ldGFTcGFjZS5QZW9wbGUpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHByaXZhdGUgc2hvd0luSG9tZVNwYWNlID0gKHJvb206IFJvb20pOiBib29sZWFuID0+IHtcbiAgICAgICAgaWYgKHRoaXMuYWxsUm9vbXNJbkhvbWUpIHJldHVybiB0cnVlO1xuICAgICAgICBpZiAocm9vbS5pc1NwYWNlUm9vbSgpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAhdGhpcy5wYXJlbnRNYXAuZ2V0KHJvb20ucm9vbUlkKT8uc2l6ZSB8fCAvLyBwdXQgYWxsIG9ycGhhbmVkIHJvb21zIGluIHRoZSBIb21lIFNwYWNlXG4gICAgICAgICAgICAhIURNUm9vbU1hcC5zaGFyZWQoKS5nZXRVc2VySWRGb3JSb29tSWQocm9vbS5yb29tSWQpIHx8IC8vIHB1dCBhbGwgRE1zIGluIHRoZSBIb21lIFNwYWNlXG4gICAgICAgICAgICByb29tLmdldE15TWVtYmVyc2hpcCgpID09PSBcImludml0ZVwiXG4gICAgICAgICk7IC8vIHB1dCBhbGwgaW52aXRlcyBpbiB0aGUgSG9tZSBTcGFjZVxuICAgIH07XG5cbiAgICBwcml2YXRlIHN0YXRpYyBpc0luU3BhY2UobWVtYmVyPzogUm9vbU1lbWJlciB8IG51bGwpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIG1lbWJlcj8ubWVtYmVyc2hpcCA9PT0gXCJqb2luXCIgfHwgbWVtYmVyPy5tZW1iZXJzaGlwID09PSBcImludml0ZVwiO1xuICAgIH1cblxuICAgIC8vIE1ldGhvZCBmb3IgcmVzb2x2aW5nIHRoZSBpbXBhY3Qgb2YgYSBzaW5nbGUgdXNlcidzIG1lbWJlcnNoaXAgY2hhbmdlIGluIHRoZSBnaXZlbiBTcGFjZSBhbmQgaXRzIGhpZXJhcmNoeVxuICAgIHByaXZhdGUgb25NZW1iZXJVcGRhdGUgPSAoc3BhY2U6IFJvb20sIHVzZXJJZDogc3RyaW5nKTogdm9pZCA9PiB7XG4gICAgICAgIGNvbnN0IGluU3BhY2UgPSBTcGFjZVN0b3JlQ2xhc3MuaXNJblNwYWNlKHNwYWNlLmdldE1lbWJlcih1c2VySWQpKTtcblxuICAgICAgICBpZiAoaW5TcGFjZSkge1xuICAgICAgICAgICAgdGhpcy51c2VySWRzQnlTcGFjZS5nZXQoc3BhY2Uucm9vbUlkKT8uYWRkKHVzZXJJZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnVzZXJJZHNCeVNwYWNlLmdldChzcGFjZS5yb29tSWQpPy5kZWxldGUodXNlcklkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGJ1c3QgY2FjaGVcbiAgICAgICAgdGhpcy5fYWdncmVnYXRlZFNwYWNlQ2FjaGUudXNlcklkc0J5U3BhY2UuY2xlYXIoKTtcblxuICAgICAgICBjb25zdCBhZmZlY3RlZFBhcmVudFNwYWNlSWRzID0gdGhpcy5nZXRLbm93blBhcmVudHMoc3BhY2Uucm9vbUlkLCB0cnVlKTtcbiAgICAgICAgdGhpcy5lbWl0KHNwYWNlLnJvb21JZCk7XG4gICAgICAgIGFmZmVjdGVkUGFyZW50U3BhY2VJZHMuZm9yRWFjaCgoc3BhY2VJZCkgPT4gdGhpcy5lbWl0KHNwYWNlSWQpKTtcblxuICAgICAgICBpZiAoIWluU3BhY2UpIHtcbiAgICAgICAgICAgIC8vIHN3aXRjaCBzcGFjZSBpZiB0aGUgRE0gaXMgbm8gbG9uZ2VyIGNvbnNpZGVyZWQgcGFydCBvZiB0aGUgc3BhY2VcbiAgICAgICAgICAgIHRoaXMuc3dpdGNoU3BhY2VJZk5lZWRlZCgpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHByaXZhdGUgb25Sb29tc1VwZGF0ZSA9ICgpOiB2b2lkID0+IHtcbiAgICAgICAgaWYgKCF0aGlzLm1hdHJpeENsaWVudCkgcmV0dXJuO1xuICAgICAgICBjb25zdCB2aXNpYmxlUm9vbXMgPSB0aGlzLm1hdHJpeENsaWVudC5nZXRWaXNpYmxlUm9vbXModGhpcy5fbXNjMzk0NlByb2Nlc3NEeW5hbWljUHJlZGVjZXNzb3IpO1xuXG4gICAgICAgIGNvbnN0IHByZXZSb29tc0J5U3BhY2UgPSB0aGlzLnJvb21JZHNCeVNwYWNlO1xuICAgICAgICBjb25zdCBwcmV2VXNlcnNCeVNwYWNlID0gdGhpcy51c2VySWRzQnlTcGFjZTtcbiAgICAgICAgY29uc3QgcHJldkNoaWxkU3BhY2VzQnlTcGFjZSA9IHRoaXMuY2hpbGRTcGFjZXNCeVNwYWNlO1xuXG4gICAgICAgIHRoaXMucm9vbUlkc0J5U3BhY2UgPSBuZXcgTWFwKCk7XG4gICAgICAgIHRoaXMudXNlcklkc0J5U3BhY2UgPSBuZXcgTWFwKCk7XG4gICAgICAgIHRoaXMuY2hpbGRTcGFjZXNCeVNwYWNlID0gbmV3IE1hcCgpO1xuXG4gICAgICAgIHRoaXMucmVidWlsZFBhcmVudE1hcCgpO1xuICAgICAgICAvLyBtdXRhdGVzIHRoaXMucm9vbUlkc0J5U3BhY2VcbiAgICAgICAgdGhpcy5yZWJ1aWxkTWV0YVNwYWNlcygpO1xuXG4gICAgICAgIGNvbnN0IGhpZGRlbkNoaWxkcmVuID0gbmV3IEVuaGFuY2VkTWFwPHN0cmluZywgU2V0PHN0cmluZz4+KCk7XG4gICAgICAgIHZpc2libGVSb29tcy5mb3JFYWNoKChyb29tKSA9PiB7XG4gICAgICAgICAgICBpZiAoIVtcImpvaW5cIiwgXCJpbnZpdGVcIl0uaW5jbHVkZXMocm9vbS5nZXRNeU1lbWJlcnNoaXAoKSkpIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMuZ2V0UGFyZW50cyhyb29tLnJvb21JZCkuZm9yRWFjaCgocGFyZW50KSA9PiB7XG4gICAgICAgICAgICAgICAgaGlkZGVuQ2hpbGRyZW4uZ2V0T3JDcmVhdGUocGFyZW50LnJvb21JZCwgbmV3IFNldCgpKS5hZGQocm9vbS5yb29tSWQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMucm9vdFNwYWNlcy5mb3JFYWNoKChzKSA9PiB7XG4gICAgICAgICAgICAvLyB0cmF2ZXJzZSBlYWNoIHNwYWNlIHRyZWUgaW4gREZTIHRvIGJ1aWxkIHVwIHRoZSBzdXBlcnNldHMgYXMgeW91IGdvIHVwLFxuICAgICAgICAgICAgLy8gcmV1c2luZyByZXN1bHRzIGZyb20gbGlrZSBzdWJ0cmVlcy5cbiAgICAgICAgICAgIGNvbnN0IHRyYXZlcnNlU3BhY2UgPSAoXG4gICAgICAgICAgICAgICAgc3BhY2VJZDogc3RyaW5nLFxuICAgICAgICAgICAgICAgIHBhcmVudFBhdGg6IFNldDxzdHJpbmc+LFxuICAgICAgICAgICAgKTogW1NldDxzdHJpbmc+LCBTZXQ8c3RyaW5nPl0gfCB1bmRlZmluZWQgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChwYXJlbnRQYXRoLmhhcyhzcGFjZUlkKSkgcmV0dXJuOyAvLyBwcmV2ZW50IGN5Y2xlc1xuICAgICAgICAgICAgICAgIC8vIHJldXNlIGV4aXN0aW5nIHJlc3VsdHMgaWYgbXVsdGlwbGUgc2ltaWxhciBicmFuY2hlcyBleGlzdFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnJvb21JZHNCeVNwYWNlLmhhcyhzcGFjZUlkKSAmJiB0aGlzLnVzZXJJZHNCeVNwYWNlLmhhcyhzcGFjZUlkKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gW3RoaXMucm9vbUlkc0J5U3BhY2UuZ2V0KHNwYWNlSWQpISwgdGhpcy51c2VySWRzQnlTcGFjZS5nZXQoc3BhY2VJZCkhXTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBbY2hpbGRTcGFjZXMsIGNoaWxkUm9vbXNdID0gcGFydGl0aW9uU3BhY2VzQW5kUm9vbXModGhpcy5nZXRDaGlsZHJlbihzcGFjZUlkKSk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmNoaWxkU3BhY2VzQnlTcGFjZS5zZXQoc3BhY2VJZCwgbmV3IFNldChjaGlsZFNwYWNlcy5tYXAoKHNwYWNlKSA9PiBzcGFjZS5yb29tSWQpKSk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCByb29tSWRzID0gbmV3IFNldChjaGlsZFJvb21zLm1hcCgocikgPT4gci5yb29tSWQpKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHNwYWNlID0gdGhpcy5tYXRyaXhDbGllbnQ/LmdldFJvb20oc3BhY2VJZCk7XG4gICAgICAgICAgICAgICAgY29uc3QgdXNlcklkcyA9IG5ldyBTZXQoXG4gICAgICAgICAgICAgICAgICAgIHNwYWNlXG4gICAgICAgICAgICAgICAgICAgICAgICA/LmdldE1lbWJlcnMoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcigobSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtLm1lbWJlcnNoaXAgPT09IFwiam9pblwiIHx8IG0ubWVtYmVyc2hpcCA9PT0gXCJpbnZpdGVcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAubWFwKChtKSA9PiBtLnVzZXJJZCksXG4gICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IG5ld1BhdGggPSBuZXcgU2V0KHBhcmVudFBhdGgpLmFkZChzcGFjZUlkKTtcblxuICAgICAgICAgICAgICAgIGNoaWxkU3BhY2VzLmZvckVhY2goKGNoaWxkU3BhY2UpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdHJhdmVyc2VTcGFjZShjaGlsZFNwYWNlLnJvb21JZCwgbmV3UGF0aCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaGlkZGVuQ2hpbGRyZW4uZ2V0KHNwYWNlSWQpPy5mb3JFYWNoKChyb29tSWQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcm9vbUlkcy5hZGQocm9vbUlkKTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIC8vIEV4cGFuZCByb29tIElEcyB0byBhbGwga25vd24gdmVyc2lvbnMgb2YgdGhlIGdpdmVuIHJvb21zXG4gICAgICAgICAgICAgICAgY29uc3QgZXhwYW5kZWRSb29tSWRzID0gbmV3IFNldChcbiAgICAgICAgICAgICAgICAgICAgQXJyYXkuZnJvbShyb29tSWRzKS5mbGF0TWFwKChyb29tSWQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1hdHJpeENsaWVudCEuZ2V0Um9vbVVwZ3JhZGVIaXN0b3J5KFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvb21JZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX21zYzM5NDZQcm9jZXNzRHluYW1pY1ByZWRlY2Vzc29yLFxuICAgICAgICAgICAgICAgICAgICAgICAgKS5tYXAoKHIpID0+IHIucm9vbUlkKTtcbiAgICAgICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICAgIHRoaXMucm9vbUlkc0J5U3BhY2Uuc2V0KHNwYWNlSWQsIGV4cGFuZGVkUm9vbUlkcyk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnVzZXJJZHNCeVNwYWNlLnNldChzcGFjZUlkLCB1c2VySWRzKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gW2V4cGFuZGVkUm9vbUlkcywgdXNlcklkc107XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICB0cmF2ZXJzZVNwYWNlKHMucm9vbUlkLCBuZXcgU2V0KCkpO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCByb29tRGlmZiA9IG1hcERpZmYocHJldlJvb21zQnlTcGFjZSwgdGhpcy5yb29tSWRzQnlTcGFjZSk7XG4gICAgICAgIGNvbnN0IHVzZXJEaWZmID0gbWFwRGlmZihwcmV2VXNlcnNCeVNwYWNlLCB0aGlzLnVzZXJJZHNCeVNwYWNlKTtcbiAgICAgICAgY29uc3Qgc3BhY2VEaWZmID0gbWFwRGlmZihwcmV2Q2hpbGRTcGFjZXNCeVNwYWNlLCB0aGlzLmNoaWxkU3BhY2VzQnlTcGFjZSk7XG4gICAgICAgIC8vIGZpbHRlciBvdXQga2V5cyB3aGljaCBjaGFuZ2VkIGJ5IHJlZmVyZW5jZSBvbmx5IGJ5IGNoZWNraW5nIHdoZXRoZXIgdGhlIHNldHMgZGlmZmVyXG4gICAgICAgIGNvbnN0IHJvb21zQ2hhbmdlZCA9IHJvb21EaWZmLmNoYW5nZWQuZmlsdGVyKChrKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gc2V0SGFzRGlmZihwcmV2Um9vbXNCeVNwYWNlLmdldChrKSEsIHRoaXMucm9vbUlkc0J5U3BhY2UuZ2V0KGspISk7XG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCB1c2Vyc0NoYW5nZWQgPSB1c2VyRGlmZi5jaGFuZ2VkLmZpbHRlcigoaykgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHNldEhhc0RpZmYocHJldlVzZXJzQnlTcGFjZS5nZXQoaykhLCB0aGlzLnVzZXJJZHNCeVNwYWNlLmdldChrKSEpO1xuICAgICAgICB9KTtcbiAgICAgICAgY29uc3Qgc3BhY2VzQ2hhbmdlZCA9IHNwYWNlRGlmZi5jaGFuZ2VkLmZpbHRlcigoaykgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHNldEhhc0RpZmYocHJldkNoaWxkU3BhY2VzQnlTcGFjZS5nZXQoaykhLCB0aGlzLmNoaWxkU3BhY2VzQnlTcGFjZS5nZXQoaykhKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgY2hhbmdlU2V0ID0gbmV3IFNldChbXG4gICAgICAgICAgICAuLi5yb29tRGlmZi5hZGRlZCxcbiAgICAgICAgICAgIC4uLnVzZXJEaWZmLmFkZGVkLFxuICAgICAgICAgICAgLi4uc3BhY2VEaWZmLmFkZGVkLFxuICAgICAgICAgICAgLi4ucm9vbURpZmYucmVtb3ZlZCxcbiAgICAgICAgICAgIC4uLnVzZXJEaWZmLnJlbW92ZWQsXG4gICAgICAgICAgICAuLi5zcGFjZURpZmYucmVtb3ZlZCxcbiAgICAgICAgICAgIC4uLnJvb21zQ2hhbmdlZCxcbiAgICAgICAgICAgIC4uLnVzZXJzQ2hhbmdlZCxcbiAgICAgICAgICAgIC4uLnNwYWNlc0NoYW5nZWQsXG4gICAgICAgIF0pO1xuXG4gICAgICAgIGNvbnN0IGFmZmVjdGVkUGFyZW50cyA9IEFycmF5LmZyb20oY2hhbmdlU2V0KS5mbGF0TWFwKChjaGFuZ2VkSWQpID0+IFtcbiAgICAgICAgICAgIC4uLnRoaXMuZ2V0S25vd25QYXJlbnRzKGNoYW5nZWRJZCwgdHJ1ZSksXG4gICAgICAgIF0pO1xuICAgICAgICBhZmZlY3RlZFBhcmVudHMuZm9yRWFjaCgocGFyZW50SWQpID0+IGNoYW5nZVNldC5hZGQocGFyZW50SWQpKTtcbiAgICAgICAgLy8gYnVzdCBhZ2dyZWdhdGUgY2FjaGVcbiAgICAgICAgdGhpcy5fYWdncmVnYXRlZFNwYWNlQ2FjaGUucm9vbUlkc0J5U3BhY2UuY2xlYXIoKTtcbiAgICAgICAgdGhpcy5fYWdncmVnYXRlZFNwYWNlQ2FjaGUudXNlcklkc0J5U3BhY2UuY2xlYXIoKTtcblxuICAgICAgICBjaGFuZ2VTZXQuZm9yRWFjaCgoaykgPT4ge1xuICAgICAgICAgICAgdGhpcy5lbWl0KGspO1xuICAgICAgICB9KTtcblxuICAgICAgICBpZiAoY2hhbmdlU2V0Lmhhcyh0aGlzLmFjdGl2ZVNwYWNlKSkge1xuICAgICAgICAgICAgdGhpcy5zd2l0Y2hTcGFjZUlmTmVlZGVkKCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBub3RpZmljYXRpb25TdGF0ZXNUb1VwZGF0ZSA9IFsuLi5jaGFuZ2VTZXRdO1xuICAgICAgICAvLyBXZSB1cGRhdGUgdGhlIFBlb3BsZSBtZXRhc3BhY2UgZXZlbiBpZiB3ZSBkaWRuJ3QgZGV0ZWN0IGFueSBjaGFuZ2VzXG4gICAgICAgIC8vIGFzIHJvb21JZHNCeVNwYWNlIGRvZXMgbm90IHByZS1jYWxjdWxhdGUgaXQgc28gd2UgaGF2ZSB0byBhc3N1bWUgaXQgY291bGQgaGF2ZSBjaGFuZ2VkXG4gICAgICAgIGlmICh0aGlzLmVuYWJsZWRNZXRhU3BhY2VzLmluY2x1ZGVzKE1ldGFTcGFjZS5QZW9wbGUpKSB7XG4gICAgICAgICAgICBub3RpZmljYXRpb25TdGF0ZXNUb1VwZGF0ZS5wdXNoKE1ldGFTcGFjZS5QZW9wbGUpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudXBkYXRlTm90aWZpY2F0aW9uU3RhdGVzKG5vdGlmaWNhdGlvblN0YXRlc1RvVXBkYXRlKTtcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBzd2l0Y2hTcGFjZUlmTmVlZGVkID0gKHJvb21JZCA9IFNka0NvbnRleHRDbGFzcy5pbnN0YW5jZS5yb29tVmlld1N0b3JlLmdldFJvb21JZCgpKTogdm9pZCA9PiB7XG4gICAgICAgIGlmICghcm9vbUlkKSByZXR1cm47XG4gICAgICAgIGlmICghdGhpcy5pc1Jvb21JblNwYWNlKHRoaXMuYWN0aXZlU3BhY2UsIHJvb21JZCkgJiYgIXRoaXMubWF0cml4Q2xpZW50Py5nZXRSb29tKHJvb21JZCk/LmlzU3BhY2VSb29tKCkpIHtcbiAgICAgICAgICAgIHRoaXMuc3dpdGNoVG9SZWxhdGVkU3BhY2Uocm9vbUlkKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBwcml2YXRlIHN3aXRjaFRvUmVsYXRlZFNwYWNlID0gKHJvb21JZDogc3RyaW5nKTogdm9pZCA9PiB7XG4gICAgICAgIGlmICh0aGlzLnN1Z2dlc3RlZFJvb21zLmZpbmQoKHIpID0+IHIucm9vbV9pZCA9PT0gcm9vbUlkKSkgcmV0dXJuO1xuXG4gICAgICAgIC8vIHRyeSB0byBmaW5kIHRoZSBjYW5vbmljYWwgcGFyZW50IGZpcnN0XG4gICAgICAgIGxldCBwYXJlbnQ6IFNwYWNlS2V5IHwgdW5kZWZpbmVkID0gdGhpcy5nZXRDYW5vbmljYWxQYXJlbnQocm9vbUlkKT8ucm9vbUlkO1xuXG4gICAgICAgIC8vIG90aGVyd2lzZSwgdHJ5IHRvIGZpbmQgYSByb290IHNwYWNlIHdoaWNoIGNvbnRhaW5zIHRoaXMgcm9vbVxuICAgICAgICBpZiAoIXBhcmVudCkge1xuICAgICAgICAgICAgcGFyZW50ID0gdGhpcy5yb290U3BhY2VzLmZpbmQoKHMpID0+IHRoaXMuaXNSb29tSW5TcGFjZShzLnJvb21JZCwgcm9vbUlkKSk/LnJvb21JZDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG90aGVyd2lzZSwgdHJ5IHRvIGZpbmQgYSBtZXRhc3BhY2Ugd2hpY2ggY29udGFpbnMgdGhpcyByb29tXG4gICAgICAgIGlmICghcGFyZW50KSB7XG4gICAgICAgICAgICAvLyBzZWFyY2ggbWV0YSBzcGFjZXMgaW4gcmV2ZXJzZSBhcyBIb21lIGlzIHRoZSBmaXJzdCBhbmQgbGVhc3Qgc3BlY2lmaWMgb25lXG4gICAgICAgICAgICBwYXJlbnQgPSBbLi4udGhpcy5lbmFibGVkTWV0YVNwYWNlc10ucmV2ZXJzZSgpLmZpbmQoKHMpID0+IHRoaXMuaXNSb29tSW5TcGFjZShzLCByb29tSWQpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRvbid0IHRyaWdnZXIgYSBjb250ZXh0IHN3aXRjaCB3aGVuIHdlIGFyZSBzd2l0Y2hpbmcgYSBzcGFjZSB0byBtYXRjaCB0aGUgY2hvc2VuIHJvb21cbiAgICAgICAgaWYgKHBhcmVudCkge1xuICAgICAgICAgICAgdGhpcy5zZXRBY3RpdmVTcGFjZShwYXJlbnQsIGZhbHNlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZ29Ub0ZpcnN0U3BhY2UoKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBwcml2YXRlIG9uUm9vbSA9IChyb29tOiBSb29tLCBuZXdNZW1iZXJzaGlwPzogc3RyaW5nLCBvbGRNZW1iZXJzaGlwPzogc3RyaW5nKTogdm9pZCA9PiB7XG4gICAgICAgIGNvbnN0IHJvb21NZW1iZXJzaGlwID0gcm9vbS5nZXRNeU1lbWJlcnNoaXAoKTtcbiAgICAgICAgaWYgKCFyb29tTWVtYmVyc2hpcCkge1xuICAgICAgICAgICAgLy8gcm9vbSBpcyBzdGlsbCBiZWluZyBiYWtlZCBpbiB0aGUganMtc2RrLCB3ZSdsbCBwcm9jZXNzIGl0IGF0IFJvb20ubXlNZW1iZXJzaGlwIGluc3RlYWRcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBtZW1iZXJzaGlwID0gbmV3TWVtYmVyc2hpcCB8fCByb29tTWVtYmVyc2hpcDtcblxuICAgICAgICBpZiAoIXJvb20uaXNTcGFjZVJvb20oKSkge1xuICAgICAgICAgICAgdGhpcy5vblJvb21zVXBkYXRlKCk7XG5cbiAgICAgICAgICAgIGlmIChtZW1iZXJzaGlwID09PSBcImpvaW5cIikge1xuICAgICAgICAgICAgICAgIC8vIHRoZSB1c2VyIGp1c3Qgam9pbmVkIGEgcm9vbSwgcmVtb3ZlIGl0IGZyb20gdGhlIHN1Z2dlc3RlZCBsaXN0IGlmIGl0IHdhcyB0aGVyZVxuICAgICAgICAgICAgICAgIGNvbnN0IG51bVN1Z2dlc3RlZFJvb21zID0gdGhpcy5fc3VnZ2VzdGVkUm9vbXMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIHRoaXMuX3N1Z2dlc3RlZFJvb21zID0gdGhpcy5fc3VnZ2VzdGVkUm9vbXMuZmlsdGVyKChyKSA9PiByLnJvb21faWQgIT09IHJvb20ucm9vbUlkKTtcbiAgICAgICAgICAgICAgICBpZiAobnVtU3VnZ2VzdGVkUm9vbXMgIT09IHRoaXMuX3N1Z2dlc3RlZFJvb21zLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXQoVVBEQVRFX1NVR0dFU1RFRF9ST09NUywgdGhpcy5fc3VnZ2VzdGVkUm9vbXMpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGlmIHRoZSByb29tIGN1cnJlbnRseSBiZWluZyB2aWV3ZWQgd2FzIGp1c3Qgam9pbmVkIHRoZW4gc3dpdGNoIHRvIGl0cyByZWxhdGVkIHNwYWNlXG4gICAgICAgICAgICAgICAgaWYgKG5ld01lbWJlcnNoaXAgPT09IFwiam9pblwiICYmIHJvb20ucm9vbUlkID09PSBTZGtDb250ZXh0Q2xhc3MuaW5zdGFuY2Uucm9vbVZpZXdTdG9yZS5nZXRSb29tSWQoKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN3aXRjaFNwYWNlSWZOZWVkZWQocm9vbS5yb29tSWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNwYWNlXG4gICAgICAgIGlmIChtZW1iZXJzaGlwID09PSBcImludml0ZVwiKSB7XG4gICAgICAgICAgICBjb25zdCBsZW4gPSB0aGlzLl9pbnZpdGVkU3BhY2VzLnNpemU7XG4gICAgICAgICAgICB0aGlzLl9pbnZpdGVkU3BhY2VzLmFkZChyb29tKTtcbiAgICAgICAgICAgIGlmIChsZW4gIT09IHRoaXMuX2ludml0ZWRTcGFjZXMuc2l6ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZW1pdChVUERBVEVfSU5WSVRFRF9TUEFDRVMsIHRoaXMuaW52aXRlZFNwYWNlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAob2xkTWVtYmVyc2hpcCA9PT0gXCJpbnZpdGVcIiAmJiBtZW1iZXJzaGlwICE9PSBcImpvaW5cIikge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2ludml0ZWRTcGFjZXMuZGVsZXRlKHJvb20pKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lbWl0KFVQREFURV9JTlZJVEVEX1NQQUNFUywgdGhpcy5pbnZpdGVkU3BhY2VzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMucmVidWlsZFNwYWNlSGllcmFyY2h5KCk7XG4gICAgICAgICAgICAvLyBmaXJlIG9mZiB1cGRhdGVzIHRvIGFsbCBwYXJlbnQgbGlzdGVuZXJzXG4gICAgICAgICAgICB0aGlzLnBhcmVudE1hcC5nZXQocm9vbS5yb29tSWQpPy5mb3JFYWNoKChwYXJlbnRJZCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuZW1pdChwYXJlbnRJZCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRoaXMuZW1pdChyb29tLnJvb21JZCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWVtYmVyc2hpcCA9PT0gXCJqb2luXCIgJiYgcm9vbS5yb29tSWQgPT09IFNka0NvbnRleHRDbGFzcy5pbnN0YW5jZS5yb29tVmlld1N0b3JlLmdldFJvb21JZCgpKSB7XG4gICAgICAgICAgICAvLyBpZiB0aGUgdXNlciB3YXMgbG9va2luZyBhdCB0aGUgc3BhY2UgYW5kIHRoZW4gam9pbmVkOiBzZWxlY3QgdGhhdCBzcGFjZVxuICAgICAgICAgICAgdGhpcy5zZXRBY3RpdmVTcGFjZShyb29tLnJvb21JZCwgZmFsc2UpO1xuICAgICAgICB9IGVsc2UgaWYgKG1lbWJlcnNoaXAgPT09IFwibGVhdmVcIiAmJiByb29tLnJvb21JZCA9PT0gdGhpcy5hY3RpdmVTcGFjZSkge1xuICAgICAgICAgICAgLy8gdXNlcidzIGFjdGl2ZSBzcGFjZSBoYXMgZ29uZSBhd2F5LCBnbyBiYWNrIHRvIGhvbWVcbiAgICAgICAgICAgIHRoaXMuZ29Ub0ZpcnN0U3BhY2UodHJ1ZSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBub3RpZnlJZk9yZGVyQ2hhbmdlZCgpOiB2b2lkIHtcbiAgICAgICAgY29uc3Qgcm9vdFNwYWNlcyA9IHRoaXMuc29ydFJvb3RTcGFjZXModGhpcy5yb290U3BhY2VzKTtcbiAgICAgICAgaWYgKGFycmF5SGFzT3JkZXJDaGFuZ2UodGhpcy5yb290U3BhY2VzLCByb290U3BhY2VzKSkge1xuICAgICAgICAgICAgdGhpcy5yb290U3BhY2VzID0gcm9vdFNwYWNlcztcbiAgICAgICAgICAgIHRoaXMuZW1pdChVUERBVEVfVE9QX0xFVkVMX1NQQUNFUywgdGhpcy5zcGFjZVBhbmVsU3BhY2VzLCB0aGlzLmVuYWJsZWRNZXRhU3BhY2VzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgb25Sb29tU3RhdGUgPSAoZXY6IE1hdHJpeEV2ZW50KTogdm9pZCA9PiB7XG4gICAgICAgIGNvbnN0IHJvb20gPSB0aGlzLm1hdHJpeENsaWVudD8uZ2V0Um9vbShldi5nZXRSb29tSWQoKSk7XG5cbiAgICAgICAgaWYgKCF0aGlzLm1hdHJpeENsaWVudCB8fCAhcm9vbSkgcmV0dXJuO1xuXG4gICAgICAgIHN3aXRjaCAoZXYuZ2V0VHlwZSgpKSB7XG4gICAgICAgICAgICBjYXNlIEV2ZW50VHlwZS5TcGFjZUNoaWxkOiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5tYXRyaXhDbGllbnQuZ2V0Um9vbShldi5nZXRTdGF0ZUtleSgpKTtcblxuICAgICAgICAgICAgICAgIGlmIChyb29tLmlzU3BhY2VSb29tKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldD8uaXNTcGFjZVJvb20oKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWJ1aWxkU3BhY2VIaWVyYXJjaHkoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdCh0YXJnZXQucm9vbUlkKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMub25Sb29tc1VwZGF0ZSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdChyb29tLnJvb21JZCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICByb29tLnJvb21JZCA9PT0gdGhpcy5hY3RpdmVTcGFjZSAmJiAvLyBjdXJyZW50IHNwYWNlXG4gICAgICAgICAgICAgICAgICAgIHRhcmdldD8uZ2V0TXlNZW1iZXJzaGlwKCkgIT09IFwiam9pblwiICYmIC8vIHRhcmdldCBub3Qgam9pbmVkXG4gICAgICAgICAgICAgICAgICAgIGV2LmdldFByZXZDb250ZW50KCkuc3VnZ2VzdGVkICE9PSBldi5nZXRDb250ZW50KCkuc3VnZ2VzdGVkIC8vIHN1Z2dlc3RlZCBmbGFnIGNoYW5nZWRcbiAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5sb2FkU3VnZ2VzdGVkUm9vbXMocm9vbSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNhc2UgRXZlbnRUeXBlLlNwYWNlUGFyZW50OlxuICAgICAgICAgICAgICAgIC8vIFRPRE8gcmVidWlsZCB0aGUgc3BhY2UgcGFyZW50IGFuZCBub3QgdGhlIHJvb20gLSBjaGVjayBwZXJtaXNzaW9ucz9cbiAgICAgICAgICAgICAgICAvLyBUT0RPIGNvbmZpcm0gdGhpcyBhZnRlciBpbXBsZW1lbnRpbmcgcGFyZW50aW5nIGJlaGF2aW91clxuICAgICAgICAgICAgICAgIGlmIChyb29tLmlzU3BhY2VSb29tKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWJ1aWxkU3BhY2VIaWVyYXJjaHkoKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm9uUm9vbXNVcGRhdGUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5lbWl0KHJvb20ucm9vbUlkKTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBFdmVudFR5cGUuUm9vbVBvd2VyTGV2ZWxzOlxuICAgICAgICAgICAgICAgIGlmIChyb29tLmlzU3BhY2VSb29tKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5vblJvb21zVXBkYXRlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIGxpc3RlbmluZyBmb3IgbS5yb29tLm1lbWJlciBldmVudHMgaW4gb25Sb29tU3RhdGUgYWJvdmUgZG9lc24ndCB3b3JrIGFzIHRoZSBNZW1iZXIgb2JqZWN0IGlzbid0IHVwZGF0ZWQgYnkgdGhlblxuICAgIHByaXZhdGUgb25Sb29tU3RhdGVNZW1iZXJzID0gKGV2OiBNYXRyaXhFdmVudCk6IHZvaWQgPT4ge1xuICAgICAgICBjb25zdCByb29tID0gdGhpcy5tYXRyaXhDbGllbnQ/LmdldFJvb20oZXYuZ2V0Um9vbUlkKCkpO1xuXG4gICAgICAgIGNvbnN0IHVzZXJJZCA9IGV2LmdldFN0YXRlS2V5KCkhO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgICByb29tPy5pc1NwYWNlUm9vbSgpICYmIC8vIG9ubHkgY29uc2lkZXIgc3BhY2Ugcm9vbXNcbiAgICAgICAgICAgIERNUm9vbU1hcC5zaGFyZWQoKS5nZXRETVJvb21zRm9yVXNlcklkKHVzZXJJZCkubGVuZ3RoID4gMCAmJiAvLyBvbmx5IGNvbnNpZGVyIG1lbWJlcnMgd2UgaGF2ZSBhIERNIHdpdGhcbiAgICAgICAgICAgIGV2LmdldFByZXZDb250ZW50KCkubWVtYmVyc2hpcCAhPT0gZXYuZ2V0Q29udGVudCgpLm1lbWJlcnNoaXAgLy8gb25seSBjb25zaWRlciB3aGVuIG1lbWJlcnNoaXAgY2hhbmdlc1xuICAgICAgICApIHtcbiAgICAgICAgICAgIHRoaXMub25NZW1iZXJVcGRhdGUocm9vbSwgdXNlcklkKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBwcml2YXRlIG9uUm9vbUFjY291bnREYXRhID0gKGV2OiBNYXRyaXhFdmVudCwgcm9vbTogUm9vbSwgbGFzdEV2PzogTWF0cml4RXZlbnQpOiB2b2lkID0+IHtcbiAgICAgICAgaWYgKHJvb20uaXNTcGFjZVJvb20oKSAmJiBldi5nZXRUeXBlKCkgPT09IEV2ZW50VHlwZS5TcGFjZU9yZGVyKSB7XG4gICAgICAgICAgICB0aGlzLnNwYWNlT3JkZXJMb2NhbEVjaG9NYXAuZGVsZXRlKHJvb20ucm9vbUlkKTsgLy8gY2xlYXIgYW55IGxvY2FsIGVjaG9cbiAgICAgICAgICAgIGNvbnN0IG9yZGVyID0gZXYuZ2V0Q29udGVudCgpPy5vcmRlcjtcbiAgICAgICAgICAgIGNvbnN0IGxhc3RPcmRlciA9IGxhc3RFdj8uZ2V0Q29udGVudCgpPy5vcmRlcjtcbiAgICAgICAgICAgIGlmIChvcmRlciAhPT0gbGFzdE9yZGVyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5ub3RpZnlJZk9yZGVyQ2hhbmdlZCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGV2LmdldFR5cGUoKSA9PT0gRXZlbnRUeXBlLlRhZykge1xuICAgICAgICAgICAgLy8gSWYgdGhlIHJvb20gd2FzIGluIGZhdm91cml0ZXMgYW5kIG5vdyBpc24ndCBvciB0aGUgb3Bwb3NpdGUgdGhlbiB1cGRhdGUgaXRzIHBvc2l0aW9uIGluIHRoZSB0cmVlc1xuICAgICAgICAgICAgY29uc3Qgb2xkVGFncyA9IGxhc3RFdj8uZ2V0Q29udGVudCgpPy50YWdzIHx8IHt9O1xuICAgICAgICAgICAgY29uc3QgbmV3VGFncyA9IGV2LmdldENvbnRlbnQoKT8udGFncyB8fCB7fTtcbiAgICAgICAgICAgIGlmICghIW9sZFRhZ3NbRGVmYXVsdFRhZ0lELkZhdm91cml0ZV0gIT09ICEhbmV3VGFnc1tEZWZhdWx0VGFnSUQuRmF2b3VyaXRlXSkge1xuICAgICAgICAgICAgICAgIHRoaXMub25Sb29tRmF2b3VyaXRlQ2hhbmdlKHJvb20pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIHByaXZhdGUgb25Sb29tRmF2b3VyaXRlQ2hhbmdlKHJvb206IFJvb20pOiB2b2lkIHtcbiAgICAgICAgaWYgKHRoaXMuZW5hYmxlZE1ldGFTcGFjZXMuaW5jbHVkZXMoTWV0YVNwYWNlLkZhdm91cml0ZXMpKSB7XG4gICAgICAgICAgICBpZiAocm9vbS50YWdzW0RlZmF1bHRUYWdJRC5GYXZvdXJpdGVdKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yb29tSWRzQnlTcGFjZS5nZXQoTWV0YVNwYWNlLkZhdm91cml0ZXMpPy5hZGQocm9vbS5yb29tSWQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJvb21JZHNCeVNwYWNlLmdldChNZXRhU3BhY2UuRmF2b3VyaXRlcyk/LmRlbGV0ZShyb29tLnJvb21JZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmVtaXQoTWV0YVNwYWNlLkZhdm91cml0ZXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBvblJvb21EbUNoYW5nZShyb29tOiBSb29tLCBpc0RtOiBib29sZWFuKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IGVuYWJsZWRNZXRhU3BhY2VzID0gbmV3IFNldCh0aGlzLmVuYWJsZWRNZXRhU3BhY2VzKTtcblxuICAgICAgICBpZiAoIXRoaXMuYWxsUm9vbXNJbkhvbWUgJiYgZW5hYmxlZE1ldGFTcGFjZXMuaGFzKE1ldGFTcGFjZS5Ib21lKSkge1xuICAgICAgICAgICAgY29uc3QgaG9tZVJvb21zID0gdGhpcy5yb29tSWRzQnlTcGFjZS5nZXQoTWV0YVNwYWNlLkhvbWUpO1xuICAgICAgICAgICAgaWYgKHRoaXMuc2hvd0luSG9tZVNwYWNlKHJvb20pKSB7XG4gICAgICAgICAgICAgICAgaG9tZVJvb21zPy5hZGQocm9vbS5yb29tSWQpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICghdGhpcy5yb29tSWRzQnlTcGFjZS5nZXQoTWV0YVNwYWNlLk9ycGhhbnMpPy5oYXMocm9vbS5yb29tSWQpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yb29tSWRzQnlTcGFjZS5nZXQoTWV0YVNwYWNlLkhvbWUpPy5kZWxldGUocm9vbS5yb29tSWQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmVtaXQoTWV0YVNwYWNlLkhvbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVuYWJsZWRNZXRhU3BhY2VzLmhhcyhNZXRhU3BhY2UuUGVvcGxlKSkge1xuICAgICAgICAgICAgdGhpcy5lbWl0KE1ldGFTcGFjZS5QZW9wbGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVuYWJsZWRNZXRhU3BhY2VzLmhhcyhNZXRhU3BhY2UuT3JwaGFucykgfHwgZW5hYmxlZE1ldGFTcGFjZXMuaGFzKE1ldGFTcGFjZS5Ib21lKSkge1xuICAgICAgICAgICAgaWYgKGlzRG0gJiYgdGhpcy5yb29tSWRzQnlTcGFjZS5nZXQoTWV0YVNwYWNlLk9ycGhhbnMpPy5kZWxldGUocm9vbS5yb29tSWQpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lbWl0KE1ldGFTcGFjZS5PcnBoYW5zKTtcbiAgICAgICAgICAgICAgICB0aGlzLmVtaXQoTWV0YVNwYWNlLkhvbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBvbkFjY291bnREYXRhID0gKGV2OiBNYXRyaXhFdmVudCwgcHJldkV2PzogTWF0cml4RXZlbnQpOiB2b2lkID0+IHtcbiAgICAgICAgaWYgKGV2LmdldFR5cGUoKSA9PT0gRXZlbnRUeXBlLkRpcmVjdCkge1xuICAgICAgICAgICAgY29uc3QgcHJldmlvdXNSb29tcyA9IG5ldyBTZXQoT2JqZWN0LnZhbHVlcyhwcmV2RXY/LmdldENvbnRlbnQ8UmVjb3JkPHN0cmluZywgc3RyaW5nW10+PigpID8/IHt9KS5mbGF0KCkpO1xuICAgICAgICAgICAgY29uc3QgY3VycmVudFJvb21zID0gbmV3IFNldChPYmplY3QudmFsdWVzKGV2LmdldENvbnRlbnQ8UmVjb3JkPHN0cmluZywgc3RyaW5nW10+PigpKS5mbGF0KCkpO1xuXG4gICAgICAgICAgICBjb25zdCBkaWZmID0gc2V0RGlmZihwcmV2aW91c1Jvb21zLCBjdXJyZW50Um9vbXMpO1xuICAgICAgICAgICAgWy4uLmRpZmYuYWRkZWQsIC4uLmRpZmYucmVtb3ZlZF0uZm9yRWFjaCgocm9vbUlkKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgcm9vbSA9IHRoaXMubWF0cml4Q2xpZW50Py5nZXRSb29tKHJvb21JZCk7XG4gICAgICAgICAgICAgICAgaWYgKHJvb20pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5vblJvb21EbUNoYW5nZShyb29tLCBjdXJyZW50Um9vbXMuaGFzKHJvb21JZCkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBpZiAoZGlmZi5yZW1vdmVkLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN3aXRjaFNwYWNlSWZOZWVkZWQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBwcm90ZWN0ZWQgYXN5bmMgcmVzZXQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIHRoaXMucm9vdFNwYWNlcyA9IFtdO1xuICAgICAgICB0aGlzLnBhcmVudE1hcCA9IG5ldyBFbmhhbmNlZE1hcCgpO1xuICAgICAgICB0aGlzLm5vdGlmaWNhdGlvblN0YXRlTWFwID0gbmV3IE1hcCgpO1xuICAgICAgICB0aGlzLnJvb21JZHNCeVNwYWNlID0gbmV3IE1hcCgpO1xuICAgICAgICB0aGlzLnVzZXJJZHNCeVNwYWNlID0gbmV3IE1hcCgpO1xuICAgICAgICB0aGlzLl9hZ2dyZWdhdGVkU3BhY2VDYWNoZS5yb29tSWRzQnlTcGFjZS5jbGVhcigpO1xuICAgICAgICB0aGlzLl9hZ2dyZWdhdGVkU3BhY2VDYWNoZS51c2VySWRzQnlTcGFjZS5jbGVhcigpO1xuICAgICAgICB0aGlzLl9hY3RpdmVTcGFjZSA9IE1ldGFTcGFjZS5Ib21lOyAvLyBzZXQgcHJvcGVybHkgYnkgb25SZWFkeVxuICAgICAgICB0aGlzLl9zdWdnZXN0ZWRSb29tcyA9IFtdO1xuICAgICAgICB0aGlzLl9pbnZpdGVkU3BhY2VzID0gbmV3IFNldCgpO1xuICAgICAgICB0aGlzLl9lbmFibGVkTWV0YVNwYWNlcyA9IFtdO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBhc3luYyBvbk5vdFJlYWR5KCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBpZiAodGhpcy5tYXRyaXhDbGllbnQpIHtcbiAgICAgICAgICAgIHRoaXMubWF0cml4Q2xpZW50LnJlbW92ZUxpc3RlbmVyKENsaWVudEV2ZW50LlJvb20sIHRoaXMub25Sb29tKTtcbiAgICAgICAgICAgIHRoaXMubWF0cml4Q2xpZW50LnJlbW92ZUxpc3RlbmVyKFJvb21FdmVudC5NeU1lbWJlcnNoaXAsIHRoaXMub25Sb29tKTtcbiAgICAgICAgICAgIHRoaXMubWF0cml4Q2xpZW50LnJlbW92ZUxpc3RlbmVyKFJvb21FdmVudC5BY2NvdW50RGF0YSwgdGhpcy5vblJvb21BY2NvdW50RGF0YSk7XG4gICAgICAgICAgICB0aGlzLm1hdHJpeENsaWVudC5yZW1vdmVMaXN0ZW5lcihSb29tU3RhdGVFdmVudC5FdmVudHMsIHRoaXMub25Sb29tU3RhdGUpO1xuICAgICAgICAgICAgdGhpcy5tYXRyaXhDbGllbnQucmVtb3ZlTGlzdGVuZXIoUm9vbVN0YXRlRXZlbnQuTWVtYmVycywgdGhpcy5vblJvb21TdGF0ZU1lbWJlcnMpO1xuICAgICAgICAgICAgdGhpcy5tYXRyaXhDbGllbnQucmVtb3ZlTGlzdGVuZXIoQ2xpZW50RXZlbnQuQWNjb3VudERhdGEsIHRoaXMub25BY2NvdW50RGF0YSk7XG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgdGhpcy5yZXNldCgpO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBhc3luYyBvblJlYWR5KCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBpZiAoIXRoaXMubWF0cml4Q2xpZW50KSByZXR1cm47XG4gICAgICAgIHRoaXMubWF0cml4Q2xpZW50Lm9uKENsaWVudEV2ZW50LlJvb20sIHRoaXMub25Sb29tKTtcbiAgICAgICAgdGhpcy5tYXRyaXhDbGllbnQub24oUm9vbUV2ZW50Lk15TWVtYmVyc2hpcCwgdGhpcy5vblJvb20pO1xuICAgICAgICB0aGlzLm1hdHJpeENsaWVudC5vbihSb29tRXZlbnQuQWNjb3VudERhdGEsIHRoaXMub25Sb29tQWNjb3VudERhdGEpO1xuICAgICAgICB0aGlzLm1hdHJpeENsaWVudC5vbihSb29tU3RhdGVFdmVudC5FdmVudHMsIHRoaXMub25Sb29tU3RhdGUpO1xuICAgICAgICB0aGlzLm1hdHJpeENsaWVudC5vbihSb29tU3RhdGVFdmVudC5NZW1iZXJzLCB0aGlzLm9uUm9vbVN0YXRlTWVtYmVycyk7XG4gICAgICAgIHRoaXMubWF0cml4Q2xpZW50Lm9uKENsaWVudEV2ZW50LkFjY291bnREYXRhLCB0aGlzLm9uQWNjb3VudERhdGEpO1xuXG4gICAgICAgIGNvbnN0IG9sZE1ldGFTcGFjZXMgPSB0aGlzLl9lbmFibGVkTWV0YVNwYWNlcztcbiAgICAgICAgY29uc3QgZW5hYmxlZE1ldGFTcGFjZXMgPSBTZXR0aW5nc1N0b3JlLmdldFZhbHVlKFwiU3BhY2VzLmVuYWJsZWRNZXRhU3BhY2VzXCIpO1xuICAgICAgICB0aGlzLl9lbmFibGVkTWV0YVNwYWNlcyA9IG1ldGFTcGFjZU9yZGVyLmZpbHRlcigoaykgPT4gZW5hYmxlZE1ldGFTcGFjZXNba10pO1xuXG4gICAgICAgIHRoaXMuX2FsbFJvb21zSW5Ib21lID0gU2V0dGluZ3NTdG9yZS5nZXRWYWx1ZShcIlNwYWNlcy5hbGxSb29tc0luSG9tZVwiKTtcbiAgICAgICAgdGhpcy5zZW5kVXNlclByb3BlcnRpZXMoKTtcblxuICAgICAgICB0aGlzLnJlYnVpbGRTcGFjZUhpZXJhcmNoeSgpOyAvLyB0cmlnZ2VyIGFuIGluaXRpYWwgdXBkYXRlXG4gICAgICAgIC8vIHJlYnVpbGRTcGFjZUhpZXJhcmNoeSB3aWxsIG9ubHkgc2VuZCBhbiB1cGRhdGUgaWYgdGhlIHNwYWNlcyBoYXZlIGNoYW5nZWQuXG4gICAgICAgIC8vIElmIG9ubHkgdGhlIG1ldGEgc3BhY2VzIGhhdmUgY2hhbmdlZCwgd2UgbmVlZCB0byBzZW5kIGFuIHVwZGF0ZSBvdXJzZWx2ZXMuXG4gICAgICAgIGlmIChhcnJheUhhc0RpZmYob2xkTWV0YVNwYWNlcywgdGhpcy5fZW5hYmxlZE1ldGFTcGFjZXMpKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXQoVVBEQVRFX1RPUF9MRVZFTF9TUEFDRVMsIHRoaXMuc3BhY2VQYW5lbFNwYWNlcywgdGhpcy5lbmFibGVkTWV0YVNwYWNlcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZXN0b3JlIHNlbGVjdGVkIHN0YXRlIGZyb20gbGFzdCBzZXNzaW9uIGlmIGFueSBhbmQgc3RpbGwgdmFsaWRcbiAgICAgICAgY29uc3QgbGFzdFNwYWNlSWQgPSB3aW5kb3cubG9jYWxTdG9yYWdlLmdldEl0ZW0oQUNUSVZFX1NQQUNFX0xTX0tFWSk7XG4gICAgICAgIGNvbnN0IHZhbGlkID1cbiAgICAgICAgICAgIGxhc3RTcGFjZUlkICYmXG4gICAgICAgICAgICAoIWlzTWV0YVNwYWNlKGxhc3RTcGFjZUlkKSA/IHRoaXMubWF0cml4Q2xpZW50LmdldFJvb20obGFzdFNwYWNlSWQpIDogZW5hYmxlZE1ldGFTcGFjZXNbbGFzdFNwYWNlSWRdKTtcbiAgICAgICAgaWYgKHZhbGlkKSB7XG4gICAgICAgICAgICAvLyBkb24ndCBjb250ZXh0IHN3aXRjaCBoZXJlIGFzIGl0IG1heSBicmVhayBwZXJtYWxpbmtzXG4gICAgICAgICAgICB0aGlzLnNldEFjdGl2ZVNwYWNlKGxhc3RTcGFjZUlkLCBmYWxzZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnN3aXRjaFNwYWNlSWZOZWVkZWQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgc2VuZFVzZXJQcm9wZXJ0aWVzKCk6IHZvaWQge1xuICAgICAgICBjb25zdCBlbmFibGVkID0gbmV3IFNldCh0aGlzLmVuYWJsZWRNZXRhU3BhY2VzKTtcbiAgICAgICAgUG9zdGhvZ0FuYWx5dGljcy5pbnN0YW5jZS5zZXRQcm9wZXJ0eShcIldlYk1ldGFTcGFjZUhvbWVFbmFibGVkXCIsIGVuYWJsZWQuaGFzKE1ldGFTcGFjZS5Ib21lKSk7XG4gICAgICAgIFBvc3Rob2dBbmFseXRpY3MuaW5zdGFuY2Uuc2V0UHJvcGVydHkoXCJXZWJNZXRhU3BhY2VIb21lQWxsUm9vbXNcIiwgdGhpcy5hbGxSb29tc0luSG9tZSk7XG4gICAgICAgIFBvc3Rob2dBbmFseXRpY3MuaW5zdGFuY2Uuc2V0UHJvcGVydHkoXCJXZWJNZXRhU3BhY2VQZW9wbGVFbmFibGVkXCIsIGVuYWJsZWQuaGFzKE1ldGFTcGFjZS5QZW9wbGUpKTtcbiAgICAgICAgUG9zdGhvZ0FuYWx5dGljcy5pbnN0YW5jZS5zZXRQcm9wZXJ0eShcIldlYk1ldGFTcGFjZUZhdm91cml0ZXNFbmFibGVkXCIsIGVuYWJsZWQuaGFzKE1ldGFTcGFjZS5GYXZvdXJpdGVzKSk7XG4gICAgICAgIFBvc3Rob2dBbmFseXRpY3MuaW5zdGFuY2Uuc2V0UHJvcGVydHkoXCJXZWJNZXRhU3BhY2VPcnBoYW5zRW5hYmxlZFwiLCBlbmFibGVkLmhhcyhNZXRhU3BhY2UuT3JwaGFucykpO1xuICAgIH1cblxuICAgIHByaXZhdGUgZ29Ub0ZpcnN0U3BhY2UoY29udGV4dFN3aXRjaCA9IGZhbHNlKTogdm9pZCB7XG4gICAgICAgIHRoaXMuc2V0QWN0aXZlU3BhY2UodGhpcy5lbmFibGVkTWV0YVNwYWNlc1swXSA/PyB0aGlzLnNwYWNlUGFuZWxTcGFjZXNbMF0/LnJvb21JZCwgY29udGV4dFN3aXRjaCk7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGFzeW5jIG9uQWN0aW9uKHBheWxvYWQ6IFNwYWNlU3RvcmVBY3Rpb25zKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGlmICghdGhpcy5tYXRyaXhDbGllbnQpIHJldHVybjtcblxuICAgICAgICBzd2l0Y2ggKHBheWxvYWQuYWN0aW9uKSB7XG4gICAgICAgICAgICBjYXNlIEFjdGlvbi5WaWV3Um9vbToge1xuICAgICAgICAgICAgICAgIC8vIERvbid0IGF1dG8tc3dpdGNoIHJvb21zIHdoZW4gcmVhY3RpbmcgdG8gYSBjb250ZXh0LXN3aXRjaCBvciBmb3IgbmV3IHJvb21zIGJlaW5nIGNyZWF0ZWRcbiAgICAgICAgICAgICAgICAvLyBhcyB0aGlzIGlzIG5vdCBoZWxwZnVsIGFuZCBjYW4gY3JlYXRlIGxvb3BzIG9mIHJvb21zL3NwYWNlIHN3aXRjaGluZ1xuICAgICAgICAgICAgICAgIGNvbnN0IGlzU3BhY2UgPSBwYXlsb2FkLmp1c3RDcmVhdGVkT3B0cz8ucm9vbVR5cGUgPT09IFJvb21UeXBlLlNwYWNlO1xuICAgICAgICAgICAgICAgIGlmIChwYXlsb2FkLmNvbnRleHRfc3dpdGNoIHx8IChwYXlsb2FkLmp1c3RDcmVhdGVkT3B0cyAmJiAhaXNTcGFjZSkpIGJyZWFrO1xuICAgICAgICAgICAgICAgIGxldCByb29tSWQgPSBwYXlsb2FkLnJvb21faWQ7XG5cbiAgICAgICAgICAgICAgICBpZiAocGF5bG9hZC5yb29tX2FsaWFzICYmICFyb29tSWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcm9vbUlkID0gZ2V0Q2FjaGVkUm9vbUlERm9yQWxpYXMocGF5bG9hZC5yb29tX2FsaWFzKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIXJvb21JZCkgcmV0dXJuOyAvLyB3ZSdsbCBnZXQgcmUtZmlyZWQgd2l0aCB0aGUgcm9vbSBJRCBzaG9ydGx5XG5cbiAgICAgICAgICAgICAgICBjb25zdCByb29tID0gdGhpcy5tYXRyaXhDbGllbnQuZ2V0Um9vbShyb29tSWQpO1xuICAgICAgICAgICAgICAgIGlmIChyb29tPy5pc1NwYWNlUm9vbSgpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIERvbid0IGNvbnRleHQgc3dpdGNoIHdoZW4gbmF2aWdhdGluZyB0byB0aGUgc3BhY2Ugcm9vbVxuICAgICAgICAgICAgICAgICAgICAvLyBhcyBpdCB3aWxsIGNhdXNlIHlvdSB0byBlbmQgdXAgaW4gdGhlIHdyb25nIHJvb21cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRBY3RpdmVTcGFjZShyb29tLnJvb21JZCwgZmFsc2UpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3dpdGNoU3BhY2VJZk5lZWRlZChyb29tSWQpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFBlcnNpc3QgbGFzdCB2aWV3ZWQgcm9vbSBmcm9tIGEgc3BhY2VcbiAgICAgICAgICAgICAgICAvLyB3ZSBkb24ndCBhd2FpdCBzZXRBY3RpdmVTcGFjZSBhYm92ZSBhcyB3ZSBvbmx5IGNhcmUgYWJvdXQgdGhpcy5hY3RpdmVTcGFjZSBiZWluZyB1cCB0byBkYXRlXG4gICAgICAgICAgICAgICAgLy8gc3luY2hyb25vdXNseSBmb3IgdGhlIGJlbG93IGNvZGUgLSBldmVyeXRoaW5nIGVsc2UgY2FuIGFuZCBzaG91bGQgYmUgYXN5bmMuXG4gICAgICAgICAgICAgICAgd2luZG93LmxvY2FsU3RvcmFnZS5zZXRJdGVtKGdldFNwYWNlQ29udGV4dEtleSh0aGlzLmFjdGl2ZVNwYWNlKSwgcGF5bG9hZC5yb29tX2lkID8/IFwiXCIpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjYXNlIEFjdGlvbi5WaWV3SG9tZVBhZ2U6XG4gICAgICAgICAgICAgICAgaWYgKCFwYXlsb2FkLmNvbnRleHRfc3dpdGNoICYmIHRoaXMuZW5hYmxlZE1ldGFTcGFjZXMuaW5jbHVkZXMoTWV0YVNwYWNlLkhvbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0QWN0aXZlU3BhY2UoTWV0YVNwYWNlLkhvbWUsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgd2luZG93LmxvY2FsU3RvcmFnZS5zZXRJdGVtKGdldFNwYWNlQ29udGV4dEtleSh0aGlzLmFjdGl2ZVNwYWNlKSwgXCJcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIEFjdGlvbi5BZnRlckxlYXZlUm9vbTpcbiAgICAgICAgICAgICAgICBpZiAoIWlzTWV0YVNwYWNlKHRoaXMuX2FjdGl2ZVNwYWNlKSAmJiBwYXlsb2FkLnJvb21faWQgPT09IHRoaXMuX2FjdGl2ZVNwYWNlKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFVzZXIgaGFzIGxlZnQgdGhlIGN1cnJlbnQgc3BhY2UsIGdvIHRvIGZpcnN0IHNwYWNlXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZ29Ub0ZpcnN0U3BhY2UodHJ1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIEFjdGlvbi5Td2l0Y2hTcGFjZToge1xuICAgICAgICAgICAgICAgIC8vIE1ldGFzcGFjZXMgc3RhcnQgYXQgMSwgU3BhY2VzIGZvbGxvd1xuICAgICAgICAgICAgICAgIGlmIChwYXlsb2FkLm51bSA8IDEgfHwgcGF5bG9hZC5udW0gPiA5KSBicmVhaztcbiAgICAgICAgICAgICAgICBjb25zdCBudW1NZXRhU3BhY2VzID0gdGhpcy5lbmFibGVkTWV0YVNwYWNlcy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgaWYgKHBheWxvYWQubnVtIDw9IG51bU1ldGFTcGFjZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRBY3RpdmVTcGFjZSh0aGlzLmVuYWJsZWRNZXRhU3BhY2VzW3BheWxvYWQubnVtIC0gMV0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5zcGFjZVBhbmVsU3BhY2VzLmxlbmd0aCA+IHBheWxvYWQubnVtIC0gbnVtTWV0YVNwYWNlcyAtIDEpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRBY3RpdmVTcGFjZSh0aGlzLnNwYWNlUGFuZWxTcGFjZXNbcGF5bG9hZC5udW0gLSBudW1NZXRhU3BhY2VzIC0gMV0ucm9vbUlkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNhc2UgQWN0aW9uLlNldHRpbmdVcGRhdGVkOiB7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChwYXlsb2FkLnNldHRpbmdOYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJTcGFjZXMuYWxsUm9vbXNJbkhvbWVcIjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3VmFsdWUgPSBTZXR0aW5nc1N0b3JlLmdldFZhbHVlKFwiU3BhY2VzLmFsbFJvb21zSW5Ib21lXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuYWxsUm9vbXNJbkhvbWUgIT09IG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fYWxsUm9vbXNJbkhvbWUgPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXQoVVBEQVRFX0hPTUVfQkVIQVZJT1VSLCB0aGlzLmFsbFJvb21zSW5Ib21lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkTWV0YVNwYWNlcy5pbmNsdWRlcyhNZXRhU3BhY2UuSG9tZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWJ1aWxkSG9tZVNwYWNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2VuZFVzZXJQcm9wZXJ0aWVzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJTcGFjZXMuZW5hYmxlZE1ldGFTcGFjZXNcIjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3VmFsdWUgPSBTZXR0aW5nc1N0b3JlLmdldFZhbHVlKFwiU3BhY2VzLmVuYWJsZWRNZXRhU3BhY2VzXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZW5hYmxlZE1ldGFTcGFjZXMgPSBtZXRhU3BhY2VPcmRlci5maWx0ZXIoKGspID0+IG5ld1ZhbHVlW2tdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhcnJheUhhc0RpZmYodGhpcy5fZW5hYmxlZE1ldGFTcGFjZXMsIGVuYWJsZWRNZXRhU3BhY2VzKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGhhZFBlb3BsZU9ySG9tZUVuYWJsZWQgPSB0aGlzLmVuYWJsZWRNZXRhU3BhY2VzLnNvbWUoKHMpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHMgPT09IE1ldGFTcGFjZS5Ib21lIHx8IHMgPT09IE1ldGFTcGFjZS5QZW9wbGU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZW5hYmxlZE1ldGFTcGFjZXMgPSBlbmFibGVkTWV0YVNwYWNlcztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBoYXNQZW9wbGVPckhvbWVFbmFibGVkID0gdGhpcy5lbmFibGVkTWV0YVNwYWNlcy5zb21lKChzKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzID09PSBNZXRhU3BhY2UuSG9tZSB8fCBzID09PSBNZXRhU3BhY2UuUGVvcGxlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaWYgYSBtZXRhc3BhY2UgY3VycmVudGx5IGJlaW5nIHZpZXdlZCB3YXMgcmVtb3ZlZCwgZ28gdG8gYW5vdGhlciBvbmVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNNZXRhU3BhY2UodGhpcy5hY3RpdmVTcGFjZSkgJiYgIW5ld1ZhbHVlW3RoaXMuYWN0aXZlU3BhY2VdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3dpdGNoU3BhY2VJZk5lZWRlZCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlYnVpbGRNZXRhU3BhY2VzKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaGFkUGVvcGxlT3JIb21lRW5hYmxlZCAhPT0gaGFzUGVvcGxlT3JIb21lRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpbiB0aGlzIGNhc2Ugd2UgaGF2ZSB0byByZWJ1aWxkIGV2ZXJ5dGhpbmcgYXMgRE0gYmFkZ2VzIHdpbGwgbW92ZSB0by9mcm9tIHJlYWwgc3BhY2VzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlTm90aWZpY2F0aW9uU3RhdGVzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVOb3RpZmljYXRpb25TdGF0ZXMoZW5hYmxlZE1ldGFTcGFjZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdChVUERBVEVfVE9QX0xFVkVMX1NQQUNFUywgdGhpcy5zcGFjZVBhbmVsU3BhY2VzLCB0aGlzLmVuYWJsZWRNZXRhU3BhY2VzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNlbmRVc2VyUHJvcGVydGllcygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiU3BhY2VzLnNob3dQZW9wbGVJblNwYWNlXCI6XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocGF5bG9hZC5yb29tSWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBnZXRTcGFjZUZpbHRlcmVkVXNlcklkcyB3aWxsIHJldHVybiB0aGUgYXBwcm9wcmlhdGUgdmFsdWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXQocGF5bG9hZC5yb29tSWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5lbmFibGVkTWV0YVNwYWNlcy5zb21lKChzKSA9PiBzID09PSBNZXRhU3BhY2UuSG9tZSB8fCBzID09PSBNZXRhU3BhY2UuUGVvcGxlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZU5vdGlmaWNhdGlvblN0YXRlcyhbcGF5bG9hZC5yb29tSWRdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiZmVhdHVyZV9keW5hbWljX3Jvb21fcHJlZGVjZXNzb3JzXCI6XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9tc2MzOTQ2UHJvY2Vzc0R5bmFtaWNQcmVkZWNlc3NvciA9IFNldHRpbmdzU3RvcmUuZ2V0VmFsdWUoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJmZWF0dXJlX2R5bmFtaWNfcm9vbV9wcmVkZWNlc3NvcnNcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlYnVpbGRTcGFjZUhpZXJhcmNoeSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGdldE5vdGlmaWNhdGlvblN0YXRlKGtleTogU3BhY2VLZXkpOiBTcGFjZU5vdGlmaWNhdGlvblN0YXRlIHtcbiAgICAgICAgaWYgKHRoaXMubm90aWZpY2F0aW9uU3RhdGVNYXAuaGFzKGtleSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm5vdGlmaWNhdGlvblN0YXRlTWFwLmdldChrZXkpITtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHN0YXRlID0gbmV3IFNwYWNlTm90aWZpY2F0aW9uU3RhdGUoZ2V0Um9vbUZuKTtcbiAgICAgICAgdGhpcy5ub3RpZmljYXRpb25TdGF0ZU1hcC5zZXQoa2V5LCBzdGF0ZSk7XG4gICAgICAgIHJldHVybiBzdGF0ZTtcbiAgICB9XG5cbiAgICAvLyB0cmF2ZXJzZSBzcGFjZSB0cmVlIHdpdGggREZTIGNhbGxpbmcgZm4gb24gZWFjaCBzcGFjZSBpbmNsdWRpbmcgdGhlIGdpdmVuIHJvb3Qgb25lLFxuICAgIC8vIGlmIGluY2x1ZGVSb29tcyBpcyB0cnVlIHRoZW4gZm4gd2lsbCBiZSBjYWxsZWQgb24gZWFjaCBsZWFmIHJvb20sIGlmIGl0IGlzIHByZXNlbnQgaW4gbXVsdGlwbGUgc3ViLXNwYWNlc1xuICAgIC8vIHRoZW4gZm4gd2lsbCBiZSBjYWxsZWQgd2l0aCBpdCBtdWx0aXBsZSB0aW1lcy5cbiAgICBwdWJsaWMgdHJhdmVyc2VTcGFjZShcbiAgICAgICAgc3BhY2VJZDogc3RyaW5nLFxuICAgICAgICBmbjogKHJvb21JZDogc3RyaW5nKSA9PiB2b2lkLFxuICAgICAgICBpbmNsdWRlUm9vbXMgPSBmYWxzZSxcbiAgICAgICAgcGFyZW50UGF0aD86IFNldDxzdHJpbmc+LFxuICAgICk6IHZvaWQge1xuICAgICAgICBpZiAocGFyZW50UGF0aCAmJiBwYXJlbnRQYXRoLmhhcyhzcGFjZUlkKSkgcmV0dXJuOyAvLyBwcmV2ZW50IGN5Y2xlc1xuXG4gICAgICAgIGZuKHNwYWNlSWQpO1xuXG4gICAgICAgIGNvbnN0IG5ld1BhdGggPSBuZXcgU2V0KHBhcmVudFBhdGgpLmFkZChzcGFjZUlkKTtcbiAgICAgICAgY29uc3QgW2NoaWxkU3BhY2VzLCBjaGlsZFJvb21zXSA9IHBhcnRpdGlvblNwYWNlc0FuZFJvb21zKHRoaXMuZ2V0Q2hpbGRyZW4oc3BhY2VJZCkpO1xuXG4gICAgICAgIGlmIChpbmNsdWRlUm9vbXMpIHtcbiAgICAgICAgICAgIGNoaWxkUm9vbXMuZm9yRWFjaCgocikgPT4gZm4oci5yb29tSWQpKTtcbiAgICAgICAgfVxuICAgICAgICBjaGlsZFNwYWNlcy5mb3JFYWNoKChzKSA9PiB0aGlzLnRyYXZlcnNlU3BhY2Uocy5yb29tSWQsIGZuLCBpbmNsdWRlUm9vbXMsIG5ld1BhdGgpKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdldFNwYWNlVGFnT3JkZXJpbmcgPSAoc3BhY2U6IFJvb20pOiBzdHJpbmcgfCB1bmRlZmluZWQgPT4ge1xuICAgICAgICBpZiAodGhpcy5zcGFjZU9yZGVyTG9jYWxFY2hvTWFwLmhhcyhzcGFjZS5yb29tSWQpKSByZXR1cm4gdGhpcy5zcGFjZU9yZGVyTG9jYWxFY2hvTWFwLmdldChzcGFjZS5yb29tSWQpO1xuICAgICAgICByZXR1cm4gdmFsaWRPcmRlcihzcGFjZS5nZXRBY2NvdW50RGF0YShFdmVudFR5cGUuU3BhY2VPcmRlcik/LmdldENvbnRlbnQoKT8ub3JkZXIpO1xuICAgIH07XG5cbiAgICBwcml2YXRlIHNvcnRSb290U3BhY2VzKHNwYWNlczogUm9vbVtdKTogUm9vbVtdIHtcbiAgICAgICAgcmV0dXJuIHNvcnRCeShzcGFjZXMsIFt0aGlzLmdldFNwYWNlVGFnT3JkZXJpbmcsIFwicm9vbUlkXCJdKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldFJvb3RTcGFjZU9yZGVyKHNwYWNlOiBSb29tLCBvcmRlcj86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICB0aGlzLnNwYWNlT3JkZXJMb2NhbEVjaG9NYXAuc2V0KHNwYWNlLnJvb21JZCwgb3JkZXIpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5tYXRyaXhDbGllbnQ/LnNldFJvb21BY2NvdW50RGF0YShzcGFjZS5yb29tSWQsIEV2ZW50VHlwZS5TcGFjZU9yZGVyLCB7IG9yZGVyIH0pO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBsb2dnZXIud2FybihcIkZhaWxlZCB0byBzZXQgcm9vdCBzcGFjZSBvcmRlclwiLCBlKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnNwYWNlT3JkZXJMb2NhbEVjaG9NYXAuZ2V0KHNwYWNlLnJvb21JZCkgPT09IG9yZGVyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zcGFjZU9yZGVyTG9jYWxFY2hvTWFwLmRlbGV0ZShzcGFjZS5yb29tSWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIG1vdmVSb290U3BhY2UoZnJvbUluZGV4OiBudW1iZXIsIHRvSW5kZXg6IG51bWJlcik6IHZvaWQge1xuICAgICAgICBjb25zdCBjdXJyZW50T3JkZXJzID0gdGhpcy5yb290U3BhY2VzLm1hcCh0aGlzLmdldFNwYWNlVGFnT3JkZXJpbmcpO1xuICAgICAgICBjb25zdCBjaGFuZ2VzID0gcmVvcmRlckxleGljb2dyYXBoaWNhbGx5KGN1cnJlbnRPcmRlcnMsIGZyb21JbmRleCwgdG9JbmRleCk7XG5cbiAgICAgICAgY2hhbmdlcy5mb3JFYWNoKCh7IGluZGV4LCBvcmRlciB9KSA9PiB7XG4gICAgICAgICAgICB0aGlzLnNldFJvb3RTcGFjZU9yZGVyKHRoaXMucm9vdFNwYWNlc1tpbmRleF0sIG9yZGVyKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5ub3RpZnlJZk9yZGVyQ2hhbmdlZCgpO1xuICAgIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgU3BhY2VTdG9yZSB7XG4gICAgcHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgaW50ZXJuYWxJbnN0YW5jZSA9ICgoKSA9PiB7XG4gICAgICAgIGNvbnN0IGluc3RhbmNlID0gbmV3IFNwYWNlU3RvcmVDbGFzcygpO1xuICAgICAgICBpbnN0YW5jZS5zdGFydCgpO1xuICAgICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfSkoKTtcblxuICAgIHB1YmxpYyBzdGF0aWMgZ2V0IGluc3RhbmNlKCk6IFNwYWNlU3RvcmVDbGFzcyB7XG4gICAgICAgIHJldHVybiBTcGFjZVN0b3JlLmludGVybmFsSW5zdGFuY2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGludGVybmFsIGZvciB0ZXN0IG9ubHlcbiAgICAgKi9cbiAgICBwdWJsaWMgc3RhdGljIHRlc3RJbnN0YW5jZSgpOiBTcGFjZVN0b3JlQ2xhc3Mge1xuICAgICAgICBjb25zdCBzdG9yZSA9IG5ldyBTcGFjZVN0b3JlQ2xhc3MoKTtcbiAgICAgICAgc3RvcmUuc3RhcnQoKTtcbiAgICAgICAgcmV0dXJuIHN0b3JlO1xuICAgIH1cbn1cblxud2luZG93Lm14U3BhY2VTdG9yZSA9IFNwYWNlU3RvcmUuaW5zdGFuY2U7XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBZ0JBLElBQUFBLE9BQUEsR0FBQUMsT0FBQTtBQUNBLElBQUFDLE1BQUEsR0FBQUQsT0FBQTtBQUNBLElBQUFFLEtBQUEsR0FBQUYsT0FBQTtBQUVBLElBQUFHLE9BQUEsR0FBQUgsT0FBQTtBQUNBLElBQUFJLE9BQUEsR0FBQUosT0FBQTtBQUVBLElBQUFLLFVBQUEsR0FBQUwsT0FBQTtBQUdBLElBQUFNLHFCQUFBLEdBQUFOLE9BQUE7QUFDQSxJQUFBTyxXQUFBLEdBQUFDLHNCQUFBLENBQUFSLE9BQUE7QUFDQSxJQUFBUyxjQUFBLEdBQUFELHNCQUFBLENBQUFSLE9BQUE7QUFDQSxJQUFBVSxjQUFBLEdBQUFGLHNCQUFBLENBQUFSLE9BQUE7QUFDQSxJQUFBVyxVQUFBLEdBQUFILHNCQUFBLENBQUFSLE9BQUE7QUFFQSxJQUFBWSx1QkFBQSxHQUFBWixPQUFBO0FBQ0EsSUFBQWEsMkJBQUEsR0FBQWIsT0FBQTtBQUNBLElBQUFjLE9BQUEsR0FBQWQsT0FBQTtBQUNBLElBQUFlLEtBQUEsR0FBQWYsT0FBQTtBQUNBLElBQUFnQixLQUFBLEdBQUFoQixPQUFBO0FBQ0EsSUFBQWlCLFFBQUEsR0FBQWpCLE9BQUE7QUFDQSxJQUFBa0IsT0FBQSxHQUFBbEIsT0FBQTtBQUNBLElBQUFtQixpQkFBQSxHQUFBbkIsT0FBQTtBQUNBLElBQUFvQixTQUFB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