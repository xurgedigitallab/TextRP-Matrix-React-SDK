"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.RoomListStoreClass = exports.LISTS_UPDATE_EVENT = exports.LISTS_LOADING_EVENT = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _logger = require("matrix-js-sdk/src/logger");
var _event = require("matrix-js-sdk/src/@types/event");
var _SettingsStore = _interopRequireDefault(require("../../settings/SettingsStore"));
var _models = require("./models");
var _models2 = require("./algorithms/models");
var _dispatcher = _interopRequireDefault(require("../../dispatcher/dispatcher"));
var _readReceipts = require("../../utils/read-receipts");
var _IFilterCondition = require("./filters/IFilterCondition");
var _Algorithm = require("./algorithms/Algorithm");
var _membership = require("../../utils/membership");
var _RoomListLayoutStore = _interopRequireDefault(require("./RoomListLayoutStore"));
var _MarkedExecution = require("../../utils/MarkedExecution");
var _AsyncStoreWithClient = require("../AsyncStoreWithClient");
var _RoomNotificationStateStore = require("../notifications/RoomNotificationStateStore");
var _VisibilityProvider = require("./filters/VisibilityProvider");
var _SpaceWatcher = require("./SpaceWatcher");
var _Interface = require("./Interface");
var _SlidingRoomListStore = require("./SlidingRoomListStore");
var _AsyncStore = require("../AsyncStore");
var _SDKContext = require("../../contexts/SDKContext");
var _roomMute = require("./utils/roomMute");
/*
Copyright 2018 - 2022 The Matrix.org Foundation C.I.C.

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

const LISTS_UPDATE_EVENT = _Interface.RoomListStoreEvent.ListsUpdate;
exports.LISTS_UPDATE_EVENT = LISTS_UPDATE_EVENT;
const LISTS_LOADING_EVENT = _Interface.RoomListStoreEvent.ListsLoading; // unused; used by SlidingRoomListStore
exports.LISTS_LOADING_EVENT = LISTS_LOADING_EVENT;
class RoomListStoreClass extends _AsyncStoreWithClient.AsyncStoreWithClient {
  constructor(dis) {
    super(dis);
    (0, _defineProperty2.default)(this, "initialListsGenerated", false);
    (0, _defineProperty2.default)(this, "msc3946ProcessDynamicPredecessor", void 0);
    (0, _defineProperty2.default)(this, "msc3946SettingWatcherRef", void 0);
    (0, _defineProperty2.default)(this, "algorithm", new _Algorithm.Algorithm());
    (0, _defineProperty2.default)(this, "prefilterConditions", []);
    (0, _defineProperty2.default)(this, "updateFn", new _MarkedExecution.MarkedExecution(() => {
      for (const tagId of Object.keys(this.orderedLists)) {
        _RoomNotificationStateStore.RoomNotificationStateStore.instance.getListState(tagId).setRooms(this.orderedLists[tagId]);
      }
      this.emit(LISTS_UPDATE_EVENT);
    }));
    (0, _defineProperty2.default)(this, "onAlgorithmListUpdated", forceUpdate => {
      this.updateFn.mark();
      if (forceUpdate) this.updateFn.trigger();
    });
    (0, _defineProperty2.default)(this, "onAlgorithmFilterUpdated", () => {
      // The filter can happen off-cycle, so trigger an update. The filter will have
      // already caused a mark.
      this.updateFn.trigger();
    });
    (0, _defineProperty2.default)(this, "onPrefilterUpdated", async () => {
      await this.recalculatePrefiltering();
      this.updateFn.trigger();
    });
    this.setMaxListeners(20); // RoomList + LeftPanel + 8xRoomSubList + spares
    this.algorithm.start();
    this.msc3946ProcessDynamicPredecessor = _SettingsStore.default.getValue("feature_dynamic_room_predecessors");
    this.msc3946SettingWatcherRef = _SettingsStore.default.watchSetting("feature_dynamic_room_predecessors", null, (_settingName, _roomId, _level, _newValAtLevel, newVal) => {
      this.msc3946ProcessDynamicPredecessor = newVal;
      this.regenerateAllLists({
        trigger: true
      });
    });
  }
  componentWillUnmount() {
    _SettingsStore.default.unwatchSetting(this.msc3946SettingWatcherRef);
  }
  setupWatchers() {
    // TODO: Maybe destroy this if this class supports destruction
    new _SpaceWatcher.SpaceWatcher(this);
  }
  get orderedLists() {
    if (!this.algorithm) return {}; // No tags yet.
    return this.algorithm.getOrderedRooms();
  }

  // Intended for test usage
  async resetStore() {
    await this.reset();
    this.prefilterConditions = [];
    this.initialListsGenerated = false;
    this.algorithm.off(_Algorithm.LIST_UPDATED_EVENT, this.onAlgorithmListUpdated);
    this.algorithm.off(_IFilterCondition.FILTER_CHANGED, this.onAlgorithmListUpdated);
    this.algorithm.stop();
    this.algorithm = new _Algorithm.Algorithm();
    this.algorithm.on(_Algorithm.LIST_UPDATED_EVENT, this.onAlgorithmListUpdated);
    this.algorithm.on(_IFilterCondition.FILTER_CHANGED, this.onAlgorithmListUpdated);

    // Reset state without causing updates as the client will have been destroyed
    // and downstream code will throw NPE errors.
    await this.reset(null, true);
  }

  // Public for test usage. Do not call this.
  async makeReady(forcedClient) {
    if (forcedClient) {
      this.readyStore.useUnitTestClient(forcedClient);
    }
    _SDKContext.SdkContextClass.instance.roomViewStore.addListener(_AsyncStore.UPDATE_EVENT, () => this.handleRVSUpdate({}));
    this.algorithm.on(_Algorithm.LIST_UPDATED_EVENT, this.onAlgorithmListUpdated);
    this.algorithm.on(_IFilterCondition.FILTER_CHANGED, this.onAlgorithmFilterUpdated);
    this.setupWatchers();

    // Update any settings here, as some may have happened before we were logically ready.
    _logger.logger.log("Regenerating room lists: Startup");
    this.updateAlgorithmInstances();
    this.regenerateAllLists({
      trigger: false
    });
    this.handleRVSUpdate({
      trigger: false
    }); // fake an RVS update to adjust sticky room, if needed

    this.updateFn.mark(); // we almost certainly want to trigger an update.
    this.updateFn.trigger();
  }

  /**
   * Handles suspected RoomViewStore changes.
   * @param trigger Set to false to prevent a list update from being sent. Should only
   * be used if the calling code will manually trigger the update.
   */
  handleRVSUpdate(_ref) {
    let {
      trigger = true
    } = _ref;
    if (!this.matrixClient) return; // We assume there won't be RVS updates without a client

    const activeRoomId = _SDKContext.SdkContextClass.instance.roomViewStore.getRoomId();
    if (!activeRoomId && this.algorithm.stickyRoom) {
      this.algorithm.setStickyRoom(null);
    } else if (activeRoomId) {
      const activeRoom = this.matrixClient.getRoom(activeRoomId);
      if (!activeRoom) {
        _logger.logger.warn(`${activeRoomId} is current in RVS but missing from client - clearing sticky room`);
        this.algorithm.setStickyRoom(null);
      } else if (activeRoom !== this.algorithm.stickyRoom) {
        this.algorithm.setStickyRoom(activeRoom);
      }
    }
    if (trigger) this.updateFn.trigger();
  }
  async onReady() {
    await this.makeReady();
  }
  async onNotReady() {
    await this.resetStore();
  }
  async onAction(payload) {
    // If we're not remotely ready, don't even bother scheduling the dispatch handling.
    // This is repeated in the handler just in case things change between a decision here and
    // when the timer fires.
    const logicallyReady = this.matrixClient && this.initialListsGenerated;
    if (!logicallyReady) return;

    // When we're running tests we can't reliably use setImmediate out of timing concerns.
    // As such, we use a more synchronous model.
    if (RoomListStoreClass.TEST_MODE) {
      await this.onDispatchAsync(payload);
      return;
    }

    // We do this to intentionally break out of the current event loop task, allowing
    // us to instead wait for a more convenient time to run our updates.
    setImmediate(() => this.onDispatchAsync(payload));
  }
  async onDispatchAsync(payload) {
    // Everything here requires a MatrixClient or some sort of logical readiness.
    if (!this.matrixClient || !this.initialListsGenerated) return;
    if (!this.algorithm) {
      // This shouldn't happen because `initialListsGenerated` implies we have an algorithm.
      throw new Error("Room list store has no algorithm to process dispatcher update with");
    }
    if (payload.action === "MatrixActions.Room.receipt") {
      // First see if the receipt event is for our own user. If it was, trigger
      // a room update (we probably read the room on a different device).
      if ((0, _readReceipts.readReceiptChangeIsFor)(payload.event, this.matrixClient)) {
        const room = payload.room;
        if (!room) {
          _logger.logger.warn(`Own read receipt was in unknown room ${room.roomId}`);
          return;
        }
        await this.handleRoomUpdate(room, _models.RoomUpdateCause.ReadReceipt);
        this.updateFn.trigger();
        return;
      }
    } else if (payload.action === "MatrixActions.Room.tags") {
      const roomPayload = payload; // TODO: Type out the dispatcher types
      await this.handleRoomUpdate(roomPayload.room, _models.RoomUpdateCause.PossibleTagChange);
      this.updateFn.trigger();
    } else if (payload.action === "MatrixActions.Room.timeline") {
      const eventPayload = payload;

      // Ignore non-live events (backfill) and notification timeline set events (without a room)
      if (!eventPayload.isLiveEvent || !eventPayload.isLiveUnfilteredRoomTimelineEvent || !eventPayload.room) {
        return;
      }
      const roomId = eventPayload.event.getRoomId();
      const room = this.matrixClient.getRoom(roomId);
      const tryUpdate = async updatedRoom => {
        if (eventPayload.event.getType() === _event.EventType.RoomTombstone && eventPayload.event.getStateKey() === "") {
          const newRoom = this.matrixClient?.getRoom(eventPayload.event.getContent()["replacement_room"]);
          if (newRoom) {
            // If we have the new room, then the new room check will have seen the predecessor
            // and did the required updates, so do nothing here.
            return;
          }
        }
        await this.handleRoomUpdate(updatedRoom, _models.RoomUpdateCause.Timeline);
        this.updateFn.trigger();
      };
      if (!room) {
        _logger.logger.warn(`Live timeline event ${eventPayload.event.getId()} received without associated room`);
        _logger.logger.warn(`Queuing failed room update for retry as a result.`);
        window.setTimeout(async () => {
          const updatedRoom = this.matrixClient?.getRoom(roomId);
          if (updatedRoom) {
            await tryUpdate(updatedRoom);
          }
        }, 100); // 100ms should be enough for the room to show up
        return;
      } else {
        await tryUpdate(room);
      }
    } else if (payload.action === "MatrixActions.Event.decrypted") {
      const eventPayload = payload; // TODO: Type out the dispatcher types
      const roomId = eventPayload.event.getRoomId();
      if (!roomId) {
        return;
      }
      const room = this.matrixClient.getRoom(roomId);
      if (!room) {
        _logger.logger.warn(`Event ${eventPayload.event.getId()} was decrypted in an unknown room ${roomId}`);
        return;
      }
      await this.handleRoomUpdate(room, _models.RoomUpdateCause.Timeline);
      this.updateFn.trigger();
    } else if (payload.action === "MatrixActions.accountData" && payload.event_type === _event.EventType.Direct) {
      const eventPayload = payload; // TODO: Type out the dispatcher types
      const dmMap = eventPayload.event.getContent();
      for (const userId of Object.keys(dmMap)) {
        const roomIds = dmMap[userId];
        for (const roomId of roomIds) {
          const room = this.matrixClient.getRoom(roomId);
          if (!room) {
            _logger.logger.warn(`${roomId} was found in DMs but the room is not in the store`);
            continue;
          }

          // We expect this RoomUpdateCause to no-op if there's no change, and we don't expect
          // the user to have hundreds of rooms to update in one event. As such, we just hammer
          // away at updates until the problem is solved. If we were expecting more than a couple
          // of rooms to be updated at once, we would consider batching the rooms up.
          await this.handleRoomUpdate(room, _models.RoomUpdateCause.PossibleTagChange);
        }
      }
      this.updateFn.trigger();
    } else if (payload.action === "MatrixActions.Room.myMembership") {
      this.onDispatchMyMembership(payload);
      return;
    }
    const possibleMuteChangeRoomIds = (0, _roomMute.getChangedOverrideRoomMutePushRules)(payload);
    if (possibleMuteChangeRoomIds) {
      for (const roomId of possibleMuteChangeRoomIds) {
        const room = roomId && this.matrixClient.getRoom(roomId);
        if (room) {
          await this.handleRoomUpdate(room, _models.RoomUpdateCause.PossibleMuteChange);
        }
      }
      this.updateFn.trigger();
    }
  }

  /**
   * Handle a MatrixActions.Room.myMembership event from the dispatcher.
   *
   * Public for test.
   */
  async onDispatchMyMembership(membershipPayload) {
    // TODO: Type out the dispatcher types so membershipPayload is not any
    const oldMembership = (0, _membership.getEffectiveMembership)(membershipPayload.oldMembership);
    const newMembership = (0, _membership.getEffectiveMembership)(membershipPayload.membership);
    if (oldMembership !== _membership.EffectiveMembership.Join && newMembership === _membership.EffectiveMembership.Join) {
      // If we're joining an upgraded room, we'll want to make sure we don't proliferate
      // the dead room in the list.
      const roomState = membershipPayload.room.currentState;
      const predecessor = roomState.findPredecessor(this.msc3946ProcessDynamicPredecessor);
      if (predecessor) {
        const prevRoom = this.matrixClient?.getRoom(predecessor.roomId);
        if (prevRoom) {
          const isSticky = this.algorithm.stickyRoom === prevRoom;
          if (isSticky) {
            this.algorithm.setStickyRoom(null);
          }

          // Note: we hit the algorithm instead of our handleRoomUpdate() function to
          // avoid redundant updates.
          this.algorithm.handleRoomUpdate(prevRoom, _models.RoomUpdateCause.RoomRemoved);
        } else {
          _logger.logger.warn(`Unable to find predecessor room with id ${predecessor.roomId}`);
        }
      }
      await this.handleRoomUpdate(membershipPayload.room, _models.RoomUpdateCause.NewRoom);
      this.updateFn.trigger();
      return;
    }
    if (oldMembership !== _membership.EffectiveMembership.Invite && newMembership === _membership.EffectiveMembership.Invite) {
      await this.handleRoomUpdate(membershipPayload.room, _models.RoomUpdateCause.NewRoom);
      this.updateFn.trigger();
      return;
    }

    // If it's not a join, it's transitioning into a different list (possibly historical)
    if (oldMembership !== newMembership) {
      await this.handleRoomUpdate(membershipPayload.room, _models.RoomUpdateCause.PossibleTagChange);
      this.updateFn.trigger();
      return;
    }
  }
  async handleRoomUpdate(room, cause) {
    if (cause === _models.RoomUpdateCause.NewRoom && room.getMyMembership() === "invite") {
      // Let the visibility provider know that there is a new invited room. It would be nice
      // if this could just be an event that things listen for but the point of this is that
      // we delay doing anything about this room until the VoipUserMapper had had a chance
      // to do the things it needs to do to decide if we should show this room or not, so
      // an even wouldn't et us do that.
      await _VisibilityProvider.VisibilityProvider.instance.onNewInvitedRoom(room);
    }
    if (!_VisibilityProvider.VisibilityProvider.instance.isRoomVisible(room)) {
      return; // don't do anything on rooms that aren't visible
    }

    if ((cause === _models.RoomUpdateCause.NewRoom || cause === _models.RoomUpdateCause.PossibleTagChange) && !this.prefilterConditions.every(c => c.isVisible(room))) {
      return; // don't do anything on new/moved rooms which ought not to be shown
    }

    const shouldUpdate = this.algorithm.handleRoomUpdate(room, cause);
    if (shouldUpdate) {
      this.updateFn.mark();
    }
  }
  async recalculatePrefiltering() {
    if (!this.algorithm) return;
    if (!this.algorithm.hasTagSortingMap) return; // we're still loading

    // Inhibit updates because we're about to lie heavily to the algorithm
    this.algorithm.updatesInhibited = true;

    // Figure out which rooms are about to be valid, and the state of affairs
    const rooms = this.getPlausibleRooms();
    const currentSticky = this.algorithm.stickyRoom;
    const stickyIsStillPresent = currentSticky && rooms.includes(currentSticky);

    // Reset the sticky room before resetting the known rooms so the algorithm
    // doesn't freak out.
    this.algorithm.setStickyRoom(null);
    this.algorithm.setKnownRooms(rooms);

    // Set the sticky room back, if needed, now that we have updated the store.
    // This will use relative stickyness to the new room set.
    if (stickyIsStillPresent) {
      this.algorithm.setStickyRoom(currentSticky);
    }

    // Finally, mark an update and resume updates from the algorithm
    this.updateFn.mark();
    this.algorithm.updatesInhibited = false;
  }
  setTagSorting(tagId, sort) {
    this.setAndPersistTagSorting(tagId, sort);
    this.updateFn.trigger();
  }
  setAndPersistTagSorting(tagId, sort) {
    this.algorithm.setTagSorting(tagId, sort);
    // TODO: Per-account? https://github.com/vector-im/element-web/issues/14114
    localStorage.setItem(`mx_tagSort_${tagId}`, sort);
  }
  getTagSorting(tagId) {
    return this.algorithm.getTagSorting(tagId);
  }

  // noinspection JSMethodCanBeStatic
  getStoredTagSorting(tagId) {
    // TODO: Per-account? https://github.com/vector-im/element-web/issues/14114
    return localStorage.getItem(`mx_tagSort_${tagId}`);
  }

  // logic must match calculateListOrder
  calculateTagSorting(tagId) {
    const definedSort = this.getTagSorting(tagId);
    const storedSort = this.getStoredTagSorting(tagId);

    // We use the following order to determine which of the 4 flags to use:
    // Stored > Settings > Defined > Default

    let tagSort = _models2.SortAlgorithm.Recent;
    if (storedSort) {
      tagSort = storedSort;
    } else if (definedSort) {
      tagSort = definedSort;
    } // else default (already set)

    return tagSort;
  }
  setListOrder(tagId, order) {
    this.setAndPersistListOrder(tagId, order);
    this.updateFn.trigger();
  }
  setAndPersistListOrder(tagId, order) {
    this.algorithm.setListOrdering(tagId, order);
    // TODO: Per-account? https://github.com/vector-im/element-web/issues/14114
    localStorage.setItem(`mx_listOrder_${tagId}`, order);
  }
  getListOrder(tagId) {
    return this.algorithm.getListOrdering(tagId);
  }

  // noinspection JSMethodCanBeStatic
  getStoredListOrder(tagId) {
    // TODO: Per-account? https://github.com/vector-im/element-web/issues/14114
    return localStorage.getItem(`mx_listOrder_${tagId}`);
  }

  // logic must match calculateTagSorting
  calculateListOrder(tagId) {
    const defaultOrder = _models2.ListAlgorithm.Natural;
    const definedOrder = this.getListOrder(tagId);
    const storedOrder = this.getStoredListOrder(tagId);

    // We use the following order to determine which of the 4 flags to use:
    // Stored > Settings > Defined > Default

    let listOrder = defaultOrder;
    if (storedOrder) {
      listOrder = storedOrder;
    } else if (definedOrder) {
      listOrder = definedOrder;
    } // else default (already set)

    return listOrder;
  }
  updateAlgorithmInstances() {
    // We'll require an update, so mark for one. Marking now also prevents the calls
    // to setTagSorting and setListOrder from causing triggers.
    this.updateFn.mark();
    for (const tag of Object.keys(this.orderedLists)) {
      const definedSort = this.getTagSorting(tag);
      const definedOrder = this.getListOrder(tag);
      const tagSort = this.calculateTagSorting(tag);
      const listOrder = this.calculateListOrder(tag);
      if (tagSort !== definedSort) {
        this.setAndPersistTagSorting(tag, tagSort);
      }
      if (listOrder !== definedOrder) {
        this.setAndPersistListOrder(tag, listOrder);
      }
    }
  }
  getPlausibleRooms() {
    if (!this.matrixClient) return [];
    let rooms = this.matrixClient.getVisibleRooms(this.msc3946ProcessDynamicPredecessor);
    rooms = rooms.filter(r => _VisibilityProvider.VisibilityProvider.instance.isRoomVisible(r));
    if (this.prefilterConditions.length > 0) {
      rooms = rooms.filter(r => {
        for (const filter of this.prefilterConditions) {
          if (!filter.isVisible(r)) {
            return false;
          }
        }
        return true;
      });
    }
    return rooms;
  }

  /**
   * Regenerates the room whole room list, discarding any previous results.
   *
   * Note: This is only exposed externally for the tests. Do not call this from within
   * the app.
   * @param trigger Set to false to prevent a list update from being sent. Should only
   * be used if the calling code will manually trigger the update.
   */
  regenerateAllLists(_ref2) {
    let {
      trigger = true
    } = _ref2;
    _logger.logger.warn("Regenerating all room lists");
    const rooms = this.getPlausibleRooms();
    const sorts = {};
    const orders = {};
    const allTags = [..._models.OrderedDefaultTagIDs];
    for (const tagId of allTags) {
      sorts[tagId] = this.calculateTagSorting(tagId);
      orders[tagId] = this.calculateListOrder(tagId);
      _RoomListLayoutStore.default.instance.ensureLayoutExists(tagId);
    }
    this.algorithm.populateTags(sorts, orders);
    this.algorithm.setKnownRooms(rooms);
    this.initialListsGenerated = true;
    if (trigger) this.updateFn.trigger();
  }

  /**
   * Adds a filter condition to the room list store. Filters may be applied async,
   * and thus might not cause an update to the store immediately.
   * @param {IFilterCondition} filter The filter condition to add.
   */
  async addFilter(filter) {
    let promise = Promise.resolve();
    filter.on(_IFilterCondition.FILTER_CHANGED, this.onPrefilterUpdated);
    this.prefilterConditions.push(filter);
    promise = this.recalculatePrefiltering();
    promise.then(() => this.updateFn.trigger());
  }

  /**
   * Removes a filter condition from the room list store. If the filter was
   * not previously added to the room list store, this will no-op. The effects
   * of removing a filter may be applied async and therefore might not cause
   * an update right away.
   * @param {IFilterCondition} filter The filter condition to remove.
   */
  removeFilter(filter) {
    let promise = Promise.resolve();
    let removed = false;
    const idx = this.prefilterConditions.indexOf(filter);
    if (idx >= 0) {
      filter.off(_IFilterCondition.FILTER_CHANGED, this.onPrefilterUpdated);
      this.prefilterConditions.splice(idx, 1);
      promise = this.recalculatePrefiltering();
      removed = true;
    }
    if (removed) {
      promise.then(() => this.updateFn.trigger());
    }
  }

  /**
   * Gets the tags for a room identified by the store. The returned set
   * should never be empty, and will contain DefaultTagID.Untagged if
   * the store is not aware of any tags.
   * @param room The room to get the tags for.
   * @returns The tags for the room.
   */
  getTagsForRoom(room) {
    const algorithmTags = this.algorithm.getTagsForRoom(room);
    if (!algorithmTags) return [_models.DefaultTagID.Untagged];
    return algorithmTags;
  }
  getCount(tagId) {
    // The room list store knows about all the rooms, so just return the length.
    return this.orderedLists[tagId].length || 0;
  }

  /**
   * Manually update a room with a given cause. This should only be used if the
   * room list store would otherwise be incapable of doing the update itself. Note
   * that this may race with the room list's regular operation.
   * @param {Room} room The room to update.
   * @param {RoomUpdateCause} cause The cause to update for.
   */
  async manualRoomUpdate(room, cause) {
    await this.handleRoomUpdate(room, cause);
    this.updateFn.trigger();
  }
}
exports.RoomListStoreClass = RoomListStoreClass;
/**
 * Set to true if you're running tests on the store. Should not be touched in
 * any other environment.
 */
(0, _defineProperty2.default)(RoomListStoreClass, "TEST_MODE", false);
class RoomListStore {
  static get instance() {
    if (!RoomListStore.internalInstance) {
      if (_SettingsStore.default.getValue("feature_sliding_sync")) {
        _logger.logger.info("using SlidingRoomListStoreClass");
        const instance = new _SlidingRoomListStore.SlidingRoomListStoreClass(_dispatcher.default, _SDKContext.SdkContextClass.instance);
        instance.start();
        RoomListStore.internalInstance = instance;
      } else {
        const instance = new RoomListStoreClass(_dispatcher.default);
        instance.start();
        RoomListStore.internalInstance = instance;
      }
    }
    return this.internalInstance;
  }
}
exports.default = RoomListStore;
(0, _defineProperty2.default)(RoomListStore, "internalInstance", void 0);
window.mxRoomListStore = RoomListStore.instance;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfbG9nZ2VyIiwicmVxdWlyZSIsIl9ldmVudCIsIl9TZXR0aW5nc1N0b3JlIiwiX2ludGVyb3BSZXF1aXJlRGVmYXVsdCIsIl9tb2RlbHMiLCJfbW9kZWxzMiIsIl9kaXNwYXRjaGVyIiwiX3JlYWRSZWNlaXB0cyIsIl9JRmlsdGVyQ29uZGl0aW9uIiwiX0FsZ29yaXRobSIsIl9tZW1iZXJzaGlwIiwiX1Jvb21MaXN0TGF5b3V0U3RvcmUiLCJfTWFya2VkRXhlY3V0aW9uIiwiX0FzeW5jU3RvcmVXaXRoQ2xpZW50IiwiX1Jvb21Ob3RpZmljYXRpb25TdGF0ZVN0b3JlIiwiX1Zpc2liaWxpdHlQcm92aWRlciIsIl9TcGFjZVdhdGNoZXIiLCJfSW50ZXJmYWNlIiwiX1NsaWRpbmdSb29tTGlzdFN0b3JlIiwiX0FzeW5jU3RvcmUiLCJfU0RLQ29udGV4dCIsIl9yb29tTXV0ZSIsIkxJU1RTX1VQREFURV9FVkVOVCIsIlJvb21MaXN0U3RvcmVFdmVudCIsIkxpc3RzVXBkYXRlIiwiZXhwb3J0cyIsIkxJU1RTX0xPQURJTkdfRVZFTlQiLCJMaXN0c0xvYWRpbmciLCJSb29tTGlzdFN0b3JlQ2xhc3MiLCJBc3luY1N0b3JlV2l0aENsaWVudCIsImNvbnN0cnVjdG9yIiwiZGlzIiwiX2RlZmluZVByb3BlcnR5MiIsImRlZmF1bHQiLCJBbGdvcml0aG0iLCJNYXJrZWRFeGVjdXRpb24iLCJ0YWdJZCIsIk9iamVjdCIsImtleXMiLCJvcmRlcmVkTGlzdHMiLCJSb29tTm90aWZpY2F0aW9uU3RhdGVTdG9yZSIsImluc3RhbmNlIiwiZ2V0TGlzdFN0YXRlIiwic2V0Um9vbXMiLCJlbWl0IiwiZm9yY2VVcGRhdGUiLCJ1cGRhdGVGbiIsIm1hcmsiLCJ0cmlnZ2VyIiwicmVjYWxjdWxhdGVQcmVmaWx0ZXJpbmciLCJzZXRNYXhMaXN0ZW5lcnMiLCJhbGdvcml0aG0iLCJzdGFydCIsIm1zYzM5NDZQcm9jZXNzRHluYW1pY1ByZWRlY2Vzc29yIiwiU2V0dGluZ3NTdG9yZSIsImdldFZhbHVlIiwibXNjMzk0NlNldHRpbmdXYXRjaGVyUmVmIiwid2F0Y2hTZXR0aW5nIiwiX3NldHRpbmdOYW1lIiwiX3Jvb21JZCIsIl9sZXZlbCIsIl9uZXdWYWxBdExldmVsIiwibmV3VmFsIiwicmVnZW5lcmF0ZUFsbExpc3RzIiwiY29tcG9uZW50V2lsbFVubW91bnQiLCJ1bndhdGNoU2V0dGluZyIsInNldHVwV2F0Y2hlcnMiLCJTcGFjZVdhdGNoZXIiLCJnZXRPcmRlcmVkUm9vbXMiLCJyZXNldFN0b3JlIiwicmVzZXQiLCJwcmVmaWx0ZXJDb25kaXRpb25zIiwiaW5pdGlhbExpc3RzR2VuZXJhdGVkIiwib2ZmIiwiTElTVF9VUERBVEVEX0VWRU5UIiwib25BbGdvcml0aG1MaXN0VXBkYXRlZCIsIkZJTFRFUl9DSEFOR0VEIiwic3RvcCIsIm9uIiwibWFrZVJlYWR5IiwiZm9yY2VkQ2xpZW50IiwicmVhZHlTdG9yZSIsInVzZVVuaXRUZXN0Q2xpZW50IiwiU2RrQ29udGV4dENsYXNzIiwicm9vbVZpZXdTdG9yZSIsImFkZExpc3RlbmVyIiwiVVBEQVRFX0VWRU5UIiwiaGFuZGxlUlZTVXBkYXRlIiwib25BbGdvcml0aG1GaWx0ZXJVcGRhdGVkIiwibG9nZ2VyIiwibG9nIiwidXBkYXRlQWxnb3JpdGhtSW5zdGFuY2VzIiwiX3JlZiIsIm1hdHJpeENsaWVudCIsImFjdGl2ZVJvb21JZCIsImdldFJvb21JZCIsInN0aWNreVJvb20iLCJzZXRTdGlja3lSb29tIiwiYWN0aXZlUm9vbSIsImdldFJvb20iLCJ3YXJuIiwib25SZWFkeSIsIm9uTm90UmVhZHkiLCJvbkFjdGlvbiIsInBheWxvYWQiLCJsb2dpY2FsbHlSZWFkeSIsIlRFU1RfTU9ERSIsIm9uRGlzcGF0Y2hBc3luYyIsInNldEltbWVkaWF0ZSIsIkVycm9yIiwiYWN0aW9uIiwicmVhZFJlY2VpcHRDaGFuZ2VJc0ZvciIsImV2ZW50Iiwicm9vbSIsInJvb21JZCIsImhhbmRsZVJvb21VcGRhdGUiLCJSb29tVXBkYXRlQ2F1c2UiLCJSZWFkUmVjZWlwdCIsInJvb21QYXlsb2FkIiwiUG9zc2libGVUYWdDaGFuZ2UiLCJldmVudFBheWxvYWQiLCJpc0xpdmVFdmVudCIsImlzTGl2ZVVuZmlsdGVyZWRSb29tVGltZWxpbmVFdmVudCIsInRyeVVwZGF0ZSIsInVwZGF0ZWRSb29tIiwiZ2V0VHlwZSIsIkV2ZW50VHlwZSIsIlJvb21Ub21ic3RvbmUiLCJnZXRTdGF0ZUtleSIsIm5ld1Jvb20iLCJnZXRDb250ZW50IiwiVGltZWxpbmUiLCJnZXRJZCIsIndpbmRvdyIsInNldFRpbWVvdXQiLCJldmVudF90eXBlIiwiRGlyZWN0IiwiZG1NYXAiLCJ1c2VySWQiLCJyb29tSWRzIiwib25EaXNwYXRjaE15TWVtYmVyc2hpcCIsInBvc3NpYmxlTXV0ZUNoYW5nZVJvb21JZHMiLCJnZXRDaGFuZ2VkT3ZlcnJpZGVSb29tTXV0ZVB1c2hSdWxlcyIsIlBvc3NpYmxlTXV0ZUNoYW5nZSIsIm1lbWJlcnNoaXBQYXlsb2FkIiwib2xkTWVtYmVyc2hpcCIsImdldEVmZmVjdGl2ZU1lbWJlcnNoaXAiLCJuZXdNZW1iZXJzaGlwIiwibWVtYmVyc2hpcCIsIkVmZmVjdGl2ZU1lbWJlcnNoaXAiLCJKb2luIiwicm9vbVN0YXRlIiwiY3VycmVudFN0YXRlIiwicHJlZGVjZXNzb3IiLCJmaW5kUHJlZGVjZXNzb3IiLCJwcmV2Um9vbSIsImlzU3RpY2t5IiwiUm9vbVJlbW92ZWQiLCJOZXdSb29tIiwiSW52aXRlIiwiY2F1c2UiLCJnZXRNeU1lbWJlcnNoaXAiLCJWaXNpYmlsaXR5UHJvdmlkZXIiLCJvbk5ld0ludml0ZWRSb29tIiwiaXNSb29tVmlzaWJsZSIsImV2ZXJ5IiwiYyIsImlzVmlzaWJsZSIsInNob3VsZFVwZGF0ZSIsImhhc1RhZ1NvcnRpbmdNYXAiLCJ1cGRhdGVzSW5oaWJpdGVkIiwicm9vbXMiLCJnZXRQbGF1c2libGVSb29tcyIsImN1cnJlbnRTdGlja3kiLCJzdGlja3lJc1N0aWxsUHJlc2VudCIsImluY2x1ZGVzIiwic2V0S25vd25Sb29tcyIsInNldFRhZ1NvcnRpbmciLCJzb3J0Iiwic2V0QW5kUGVyc2lzdFRhZ1NvcnRpbmciLCJsb2NhbFN0b3JhZ2UiLCJzZXRJdGVtIiwiZ2V0VGFnU29ydGluZyIsImdldFN0b3JlZFRhZ1NvcnRpbmciLCJnZXRJdGVtIiwiY2FsY3VsYXRlVGFnU29ydGluZyIsImRlZmluZWRTb3J0Iiwic3RvcmVkU29ydCIsInRhZ1NvcnQiLCJTb3J0QWxnb3JpdGhtIiwiUmVjZW50Iiwic2V0TGlzdE9yZGVyIiwib3JkZXIiLCJzZXRBbmRQZXJzaXN0TGlzdE9yZGVyIiwic2V0TGlzdE9yZGVyaW5nIiwiZ2V0TGlzdE9yZGVyIiwiZ2V0TGlzdE9yZGVyaW5nIiwiZ2V0U3RvcmVkTGlzdE9yZGVyIiwiY2FsY3VsYXRlTGlzdE9yZGVyIiwiZGVmYXVsdE9yZGVyIiwiTGlzdEFsZ29yaXRobSIsIk5hdHVyYWwiLCJkZWZpbmVkT3JkZXIiLCJzdG9yZWRPcmRlciIsImxpc3RPcmRlciIsInRhZyIsImdldFZpc2libGVSb29tcyIsImZpbHRlciIsInIiLCJsZW5ndGgiLCJfcmVmMiIsInNvcnRzIiwib3JkZXJzIiwiYWxsVGFncyIsIk9yZGVyZWREZWZhdWx0VGFnSURzIiwiUm9vbUxpc3RMYXlvdXRTdG9yZSIsImVuc3VyZUxheW91dEV4aXN0cyIsInBvcHVsYXRlVGFncyIsImFkZEZpbHRlciIsInByb21pc2UiLCJQcm9taXNlIiwicmVzb2x2ZSIsIm9uUHJlZmlsdGVyVXBkYXRlZCIsInB1c2giLCJ0aGVuIiwicmVtb3ZlRmlsdGVyIiwicmVtb3ZlZCIsImlkeCIsImluZGV4T2YiLCJzcGxpY2UiLCJnZXRUYWdzRm9yUm9vbSIsImFsZ29yaXRobVRhZ3MiLCJEZWZhdWx0VGFnSUQiLCJVbnRhZ2dlZCIsImdldENvdW50IiwibWFudWFsUm9vbVVwZGF0ZSIsIlJvb21MaXN0U3RvcmUiLCJpbnRlcm5hbEluc3RhbmNlIiwiaW5mbyIsIlNsaWRpbmdSb29tTGlzdFN0b3JlQ2xhc3MiLCJkZWZhdWx0RGlzcGF0Y2hlciIsIm14Um9vbUxpc3RTdG9yZSJdLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9zdG9yZXMvcm9vbS1saXN0L1Jvb21MaXN0U3RvcmUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbkNvcHlyaWdodCAyMDE4IC0gMjAyMiBUaGUgTWF0cml4Lm9yZyBGb3VuZGF0aW9uIEMuSS5DLlxuXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiovXG5cbmltcG9ydCB7IE1hdHJpeENsaWVudCB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9jbGllbnRcIjtcbmltcG9ydCB7IFJvb20gfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbW9kZWxzL3Jvb21cIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9sb2dnZXJcIjtcbmltcG9ydCB7IEV2ZW50VHlwZSB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9AdHlwZXMvZXZlbnRcIjtcbmltcG9ydCB7IFJvb21TdGF0ZSB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9tYXRyaXhcIjtcblxuaW1wb3J0IFNldHRpbmdzU3RvcmUgZnJvbSBcIi4uLy4uL3NldHRpbmdzL1NldHRpbmdzU3RvcmVcIjtcbmltcG9ydCB7IERlZmF1bHRUYWdJRCwgT3JkZXJlZERlZmF1bHRUYWdJRHMsIFJvb21VcGRhdGVDYXVzZSwgVGFnSUQgfSBmcm9tIFwiLi9tb2RlbHNcIjtcbmltcG9ydCB7IElMaXN0T3JkZXJpbmdNYXAsIElUYWdNYXAsIElUYWdTb3J0aW5nTWFwLCBMaXN0QWxnb3JpdGhtLCBTb3J0QWxnb3JpdGhtIH0gZnJvbSBcIi4vYWxnb3JpdGhtcy9tb2RlbHNcIjtcbmltcG9ydCB7IEFjdGlvblBheWxvYWQgfSBmcm9tIFwiLi4vLi4vZGlzcGF0Y2hlci9wYXlsb2Fkc1wiO1xuaW1wb3J0IGRlZmF1bHREaXNwYXRjaGVyLCB7IE1hdHJpeERpc3BhdGNoZXIgfSBmcm9tIFwiLi4vLi4vZGlzcGF0Y2hlci9kaXNwYXRjaGVyXCI7XG5pbXBvcnQgeyByZWFkUmVjZWlwdENoYW5nZUlzRm9yIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3JlYWQtcmVjZWlwdHNcIjtcbmltcG9ydCB7IEZJTFRFUl9DSEFOR0VELCBJRmlsdGVyQ29uZGl0aW9uIH0gZnJvbSBcIi4vZmlsdGVycy9JRmlsdGVyQ29uZGl0aW9uXCI7XG5pbXBvcnQgeyBBbGdvcml0aG0sIExJU1RfVVBEQVRFRF9FVkVOVCB9IGZyb20gXCIuL2FsZ29yaXRobXMvQWxnb3JpdGhtXCI7XG5pbXBvcnQgeyBFZmZlY3RpdmVNZW1iZXJzaGlwLCBnZXRFZmZlY3RpdmVNZW1iZXJzaGlwIH0gZnJvbSBcIi4uLy4uL3V0aWxzL21lbWJlcnNoaXBcIjtcbmltcG9ydCBSb29tTGlzdExheW91dFN0b3JlIGZyb20gXCIuL1Jvb21MaXN0TGF5b3V0U3RvcmVcIjtcbmltcG9ydCB7IE1hcmtlZEV4ZWN1dGlvbiB9IGZyb20gXCIuLi8uLi91dGlscy9NYXJrZWRFeGVjdXRpb25cIjtcbmltcG9ydCB7IEFzeW5jU3RvcmVXaXRoQ2xpZW50IH0gZnJvbSBcIi4uL0FzeW5jU3RvcmVXaXRoQ2xpZW50XCI7XG5pbXBvcnQgeyBSb29tTm90aWZpY2F0aW9uU3RhdGVTdG9yZSB9IGZyb20gXCIuLi9ub3RpZmljYXRpb25zL1Jvb21Ob3RpZmljYXRpb25TdGF0ZVN0b3JlXCI7XG5pbXBvcnQgeyBWaXNpYmlsaXR5UHJvdmlkZXIgfSBmcm9tIFwiLi9maWx0ZXJzL1Zpc2liaWxpdHlQcm92aWRlclwiO1xuaW1wb3J0IHsgU3BhY2VXYXRjaGVyIH0gZnJvbSBcIi4vU3BhY2VXYXRjaGVyXCI7XG5pbXBvcnQgeyBJUm9vbVRpbWVsaW5lQWN0aW9uUGF5bG9hZCB9IGZyb20gXCIuLi8uLi9hY3Rpb25zL01hdHJpeEFjdGlvbkNyZWF0b3JzXCI7XG5pbXBvcnQgeyBSb29tTGlzdFN0b3JlIGFzIEludGVyZmFjZSwgUm9vbUxpc3RTdG9yZUV2ZW50IH0gZnJvbSBcIi4vSW50ZXJmYWNlXCI7XG5pbXBvcnQgeyBTbGlkaW5nUm9vbUxpc3RTdG9yZUNsYXNzIH0gZnJvbSBcIi4vU2xpZGluZ1Jvb21MaXN0U3RvcmVcIjtcbmltcG9ydCB7IFVQREFURV9FVkVOVCB9IGZyb20gXCIuLi9Bc3luY1N0b3JlXCI7XG5pbXBvcnQgeyBTZGtDb250ZXh0Q2xhc3MgfSBmcm9tIFwiLi4vLi4vY29udGV4dHMvU0RLQ29udGV4dFwiO1xuaW1wb3J0IHsgZ2V0Q2hhbmdlZE92ZXJyaWRlUm9vbU11dGVQdXNoUnVsZXMgfSBmcm9tIFwiLi91dGlscy9yb29tTXV0ZVwiO1xuXG5pbnRlcmZhY2UgSVN0YXRlIHtcbiAgICAvLyBzdGF0ZSBpcyB0cmFja2VkIGluIHVuZGVybHlpbmcgY2xhc3Nlc1xufVxuXG5leHBvcnQgY29uc3QgTElTVFNfVVBEQVRFX0VWRU5UID0gUm9vbUxpc3RTdG9yZUV2ZW50Lkxpc3RzVXBkYXRlO1xuZXhwb3J0IGNvbnN0IExJU1RTX0xPQURJTkdfRVZFTlQgPSBSb29tTGlzdFN0b3JlRXZlbnQuTGlzdHNMb2FkaW5nOyAvLyB1bnVzZWQ7IHVzZWQgYnkgU2xpZGluZ1Jvb21MaXN0U3RvcmVcblxuZXhwb3J0IGNsYXNzIFJvb21MaXN0U3RvcmVDbGFzcyBleHRlbmRzIEFzeW5jU3RvcmVXaXRoQ2xpZW50PElTdGF0ZT4gaW1wbGVtZW50cyBJbnRlcmZhY2Uge1xuICAgIC8qKlxuICAgICAqIFNldCB0byB0cnVlIGlmIHlvdSdyZSBydW5uaW5nIHRlc3RzIG9uIHRoZSBzdG9yZS4gU2hvdWxkIG5vdCBiZSB0b3VjaGVkIGluXG4gICAgICogYW55IG90aGVyIGVudmlyb25tZW50LlxuICAgICAqL1xuICAgIHB1YmxpYyBzdGF0aWMgVEVTVF9NT0RFID0gZmFsc2U7XG5cbiAgICBwcml2YXRlIGluaXRpYWxMaXN0c0dlbmVyYXRlZCA9IGZhbHNlO1xuICAgIHByaXZhdGUgbXNjMzk0NlByb2Nlc3NEeW5hbWljUHJlZGVjZXNzb3I6IGJvb2xlYW47XG4gICAgcHJpdmF0ZSBtc2MzOTQ2U2V0dGluZ1dhdGNoZXJSZWY6IHN0cmluZztcbiAgICBwcml2YXRlIGFsZ29yaXRobSA9IG5ldyBBbGdvcml0aG0oKTtcbiAgICBwcml2YXRlIHByZWZpbHRlckNvbmRpdGlvbnM6IElGaWx0ZXJDb25kaXRpb25bXSA9IFtdO1xuICAgIHByaXZhdGUgdXBkYXRlRm4gPSBuZXcgTWFya2VkRXhlY3V0aW9uKCgpID0+IHtcbiAgICAgICAgZm9yIChjb25zdCB0YWdJZCBvZiBPYmplY3Qua2V5cyh0aGlzLm9yZGVyZWRMaXN0cykpIHtcbiAgICAgICAgICAgIFJvb21Ob3RpZmljYXRpb25TdGF0ZVN0b3JlLmluc3RhbmNlLmdldExpc3RTdGF0ZSh0YWdJZCkuc2V0Um9vbXModGhpcy5vcmRlcmVkTGlzdHNbdGFnSWRdKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmVtaXQoTElTVFNfVVBEQVRFX0VWRU5UKTtcbiAgICB9KTtcblxuICAgIHB1YmxpYyBjb25zdHJ1Y3RvcihkaXM6IE1hdHJpeERpc3BhdGNoZXIpIHtcbiAgICAgICAgc3VwZXIoZGlzKTtcbiAgICAgICAgdGhpcy5zZXRNYXhMaXN0ZW5lcnMoMjApOyAvLyBSb29tTGlzdCArIExlZnRQYW5lbCArIDh4Um9vbVN1Ykxpc3QgKyBzcGFyZXNcbiAgICAgICAgdGhpcy5hbGdvcml0aG0uc3RhcnQoKTtcblxuICAgICAgICB0aGlzLm1zYzM5NDZQcm9jZXNzRHluYW1pY1ByZWRlY2Vzc29yID0gU2V0dGluZ3NTdG9yZS5nZXRWYWx1ZShcImZlYXR1cmVfZHluYW1pY19yb29tX3ByZWRlY2Vzc29yc1wiKTtcbiAgICAgICAgdGhpcy5tc2MzOTQ2U2V0dGluZ1dhdGNoZXJSZWYgPSBTZXR0aW5nc1N0b3JlLndhdGNoU2V0dGluZyhcbiAgICAgICAgICAgIFwiZmVhdHVyZV9keW5hbWljX3Jvb21fcHJlZGVjZXNzb3JzXCIsXG4gICAgICAgICAgICBudWxsLFxuICAgICAgICAgICAgKF9zZXR0aW5nTmFtZSwgX3Jvb21JZCwgX2xldmVsLCBfbmV3VmFsQXRMZXZlbCwgbmV3VmFsKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5tc2MzOTQ2UHJvY2Vzc0R5bmFtaWNQcmVkZWNlc3NvciA9IG5ld1ZhbDtcbiAgICAgICAgICAgICAgICB0aGlzLnJlZ2VuZXJhdGVBbGxMaXN0cyh7IHRyaWdnZXI6IHRydWUgfSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICApO1xuICAgIH1cblxuICAgIHB1YmxpYyBjb21wb25lbnRXaWxsVW5tb3VudCgpOiB2b2lkIHtcbiAgICAgICAgU2V0dGluZ3NTdG9yZS51bndhdGNoU2V0dGluZyh0aGlzLm1zYzM5NDZTZXR0aW5nV2F0Y2hlclJlZik7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzZXR1cFdhdGNoZXJzKCk6IHZvaWQge1xuICAgICAgICAvLyBUT0RPOiBNYXliZSBkZXN0cm95IHRoaXMgaWYgdGhpcyBjbGFzcyBzdXBwb3J0cyBkZXN0cnVjdGlvblxuICAgICAgICBuZXcgU3BhY2VXYXRjaGVyKHRoaXMpO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXQgb3JkZXJlZExpc3RzKCk6IElUYWdNYXAge1xuICAgICAgICBpZiAoIXRoaXMuYWxnb3JpdGhtKSByZXR1cm4ge307IC8vIE5vIHRhZ3MgeWV0LlxuICAgICAgICByZXR1cm4gdGhpcy5hbGdvcml0aG0uZ2V0T3JkZXJlZFJvb21zKCk7XG4gICAgfVxuXG4gICAgLy8gSW50ZW5kZWQgZm9yIHRlc3QgdXNhZ2VcbiAgICBwdWJsaWMgYXN5bmMgcmVzZXRTdG9yZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgYXdhaXQgdGhpcy5yZXNldCgpO1xuICAgICAgICB0aGlzLnByZWZpbHRlckNvbmRpdGlvbnMgPSBbXTtcbiAgICAgICAgdGhpcy5pbml0aWFsTGlzdHNHZW5lcmF0ZWQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLmFsZ29yaXRobS5vZmYoTElTVF9VUERBVEVEX0VWRU5ULCB0aGlzLm9uQWxnb3JpdGhtTGlzdFVwZGF0ZWQpO1xuICAgICAgICB0aGlzLmFsZ29yaXRobS5vZmYoRklMVEVSX0NIQU5HRUQsIHRoaXMub25BbGdvcml0aG1MaXN0VXBkYXRlZCk7XG4gICAgICAgIHRoaXMuYWxnb3JpdGhtLnN0b3AoKTtcbiAgICAgICAgdGhpcy5hbGdvcml0aG0gPSBuZXcgQWxnb3JpdGhtKCk7XG4gICAgICAgIHRoaXMuYWxnb3JpdGhtLm9uKExJU1RfVVBEQVRFRF9FVkVOVCwgdGhpcy5vbkFsZ29yaXRobUxpc3RVcGRhdGVkKTtcbiAgICAgICAgdGhpcy5hbGdvcml0aG0ub24oRklMVEVSX0NIQU5HRUQsIHRoaXMub25BbGdvcml0aG1MaXN0VXBkYXRlZCk7XG5cbiAgICAgICAgLy8gUmVzZXQgc3RhdGUgd2l0aG91dCBjYXVzaW5nIHVwZGF0ZXMgYXMgdGhlIGNsaWVudCB3aWxsIGhhdmUgYmVlbiBkZXN0cm95ZWRcbiAgICAgICAgLy8gYW5kIGRvd25zdHJlYW0gY29kZSB3aWxsIHRocm93IE5QRSBlcnJvcnMuXG4gICAgICAgIGF3YWl0IHRoaXMucmVzZXQobnVsbCwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgLy8gUHVibGljIGZvciB0ZXN0IHVzYWdlLiBEbyBub3QgY2FsbCB0aGlzLlxuICAgIHB1YmxpYyBhc3luYyBtYWtlUmVhZHkoZm9yY2VkQ2xpZW50PzogTWF0cml4Q2xpZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGlmIChmb3JjZWRDbGllbnQpIHtcbiAgICAgICAgICAgIHRoaXMucmVhZHlTdG9yZS51c2VVbml0VGVzdENsaWVudChmb3JjZWRDbGllbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgU2RrQ29udGV4dENsYXNzLmluc3RhbmNlLnJvb21WaWV3U3RvcmUuYWRkTGlzdGVuZXIoVVBEQVRFX0VWRU5ULCAoKSA9PiB0aGlzLmhhbmRsZVJWU1VwZGF0ZSh7fSkpO1xuICAgICAgICB0aGlzLmFsZ29yaXRobS5vbihMSVNUX1VQREFURURfRVZFTlQsIHRoaXMub25BbGdvcml0aG1MaXN0VXBkYXRlZCk7XG4gICAgICAgIHRoaXMuYWxnb3JpdGhtLm9uKEZJTFRFUl9DSEFOR0VELCB0aGlzLm9uQWxnb3JpdGhtRmlsdGVyVXBkYXRlZCk7XG4gICAgICAgIHRoaXMuc2V0dXBXYXRjaGVycygpO1xuXG4gICAgICAgIC8vIFVwZGF0ZSBhbnkgc2V0dGluZ3MgaGVyZSwgYXMgc29tZSBtYXkgaGF2ZSBoYXBwZW5lZCBiZWZvcmUgd2Ugd2VyZSBsb2dpY2FsbHkgcmVhZHkuXG4gICAgICAgIGxvZ2dlci5sb2coXCJSZWdlbmVyYXRpbmcgcm9vbSBsaXN0czogU3RhcnR1cFwiKTtcbiAgICAgICAgdGhpcy51cGRhdGVBbGdvcml0aG1JbnN0YW5jZXMoKTtcbiAgICAgICAgdGhpcy5yZWdlbmVyYXRlQWxsTGlzdHMoeyB0cmlnZ2VyOiBmYWxzZSB9KTtcbiAgICAgICAgdGhpcy5oYW5kbGVSVlNVcGRhdGUoeyB0cmlnZ2VyOiBmYWxzZSB9KTsgLy8gZmFrZSBhbiBSVlMgdXBkYXRlIHRvIGFkanVzdCBzdGlja3kgcm9vbSwgaWYgbmVlZGVkXG5cbiAgICAgICAgdGhpcy51cGRhdGVGbi5tYXJrKCk7IC8vIHdlIGFsbW9zdCBjZXJ0YWlubHkgd2FudCB0byB0cmlnZ2VyIGFuIHVwZGF0ZS5cbiAgICAgICAgdGhpcy51cGRhdGVGbi50cmlnZ2VyKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSGFuZGxlcyBzdXNwZWN0ZWQgUm9vbVZpZXdTdG9yZSBjaGFuZ2VzLlxuICAgICAqIEBwYXJhbSB0cmlnZ2VyIFNldCB0byBmYWxzZSB0byBwcmV2ZW50IGEgbGlzdCB1cGRhdGUgZnJvbSBiZWluZyBzZW50LiBTaG91bGQgb25seVxuICAgICAqIGJlIHVzZWQgaWYgdGhlIGNhbGxpbmcgY29kZSB3aWxsIG1hbnVhbGx5IHRyaWdnZXIgdGhlIHVwZGF0ZS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGhhbmRsZVJWU1VwZGF0ZSh7IHRyaWdnZXIgPSB0cnVlIH0pOiB2b2lkIHtcbiAgICAgICAgaWYgKCF0aGlzLm1hdHJpeENsaWVudCkgcmV0dXJuOyAvLyBXZSBhc3N1bWUgdGhlcmUgd29uJ3QgYmUgUlZTIHVwZGF0ZXMgd2l0aG91dCBhIGNsaWVudFxuXG4gICAgICAgIGNvbnN0IGFjdGl2ZVJvb21JZCA9IFNka0NvbnRleHRDbGFzcy5pbnN0YW5jZS5yb29tVmlld1N0b3JlLmdldFJvb21JZCgpO1xuICAgICAgICBpZiAoIWFjdGl2ZVJvb21JZCAmJiB0aGlzLmFsZ29yaXRobS5zdGlja3lSb29tKSB7XG4gICAgICAgICAgICB0aGlzLmFsZ29yaXRobS5zZXRTdGlja3lSb29tKG51bGwpO1xuICAgICAgICB9IGVsc2UgaWYgKGFjdGl2ZVJvb21JZCkge1xuICAgICAgICAgICAgY29uc3QgYWN0aXZlUm9vbSA9IHRoaXMubWF0cml4Q2xpZW50LmdldFJvb20oYWN0aXZlUm9vbUlkKTtcbiAgICAgICAgICAgIGlmICghYWN0aXZlUm9vbSkge1xuICAgICAgICAgICAgICAgIGxvZ2dlci53YXJuKGAke2FjdGl2ZVJvb21JZH0gaXMgY3VycmVudCBpbiBSVlMgYnV0IG1pc3NpbmcgZnJvbSBjbGllbnQgLSBjbGVhcmluZyBzdGlja3kgcm9vbWApO1xuICAgICAgICAgICAgICAgIHRoaXMuYWxnb3JpdGhtLnNldFN0aWNreVJvb20obnVsbCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFjdGl2ZVJvb20gIT09IHRoaXMuYWxnb3JpdGhtLnN0aWNreVJvb20pIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFsZ29yaXRobS5zZXRTdGlja3lSb29tKGFjdGl2ZVJvb20pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRyaWdnZXIpIHRoaXMudXBkYXRlRm4udHJpZ2dlcigpO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBhc3luYyBvblJlYWR5KCk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGF3YWl0IHRoaXMubWFrZVJlYWR5KCk7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGFzeW5jIG9uTm90UmVhZHkoKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgYXdhaXQgdGhpcy5yZXNldFN0b3JlKCk7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGFzeW5jIG9uQWN0aW9uKHBheWxvYWQ6IEFjdGlvblBheWxvYWQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgLy8gSWYgd2UncmUgbm90IHJlbW90ZWx5IHJlYWR5LCBkb24ndCBldmVuIGJvdGhlciBzY2hlZHVsaW5nIHRoZSBkaXNwYXRjaCBoYW5kbGluZy5cbiAgICAgICAgLy8gVGhpcyBpcyByZXBlYXRlZCBpbiB0aGUgaGFuZGxlciBqdXN0IGluIGNhc2UgdGhpbmdzIGNoYW5nZSBiZXR3ZWVuIGEgZGVjaXNpb24gaGVyZSBhbmRcbiAgICAgICAgLy8gd2hlbiB0aGUgdGltZXIgZmlyZXMuXG4gICAgICAgIGNvbnN0IGxvZ2ljYWxseVJlYWR5ID0gdGhpcy5tYXRyaXhDbGllbnQgJiYgdGhpcy5pbml0aWFsTGlzdHNHZW5lcmF0ZWQ7XG4gICAgICAgIGlmICghbG9naWNhbGx5UmVhZHkpIHJldHVybjtcblxuICAgICAgICAvLyBXaGVuIHdlJ3JlIHJ1bm5pbmcgdGVzdHMgd2UgY2FuJ3QgcmVsaWFibHkgdXNlIHNldEltbWVkaWF0ZSBvdXQgb2YgdGltaW5nIGNvbmNlcm5zLlxuICAgICAgICAvLyBBcyBzdWNoLCB3ZSB1c2UgYSBtb3JlIHN5bmNocm9ub3VzIG1vZGVsLlxuICAgICAgICBpZiAoUm9vbUxpc3RTdG9yZUNsYXNzLlRFU1RfTU9ERSkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5vbkRpc3BhdGNoQXN5bmMocGF5bG9hZCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBXZSBkbyB0aGlzIHRvIGludGVudGlvbmFsbHkgYnJlYWsgb3V0IG9mIHRoZSBjdXJyZW50IGV2ZW50IGxvb3AgdGFzaywgYWxsb3dpbmdcbiAgICAgICAgLy8gdXMgdG8gaW5zdGVhZCB3YWl0IGZvciBhIG1vcmUgY29udmVuaWVudCB0aW1lIHRvIHJ1biBvdXIgdXBkYXRlcy5cbiAgICAgICAgc2V0SW1tZWRpYXRlKCgpID0+IHRoaXMub25EaXNwYXRjaEFzeW5jKHBheWxvYWQpKTtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgYXN5bmMgb25EaXNwYXRjaEFzeW5jKHBheWxvYWQ6IEFjdGlvblBheWxvYWQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgLy8gRXZlcnl0aGluZyBoZXJlIHJlcXVpcmVzIGEgTWF0cml4Q2xpZW50IG9yIHNvbWUgc29ydCBvZiBsb2dpY2FsIHJlYWRpbmVzcy5cbiAgICAgICAgaWYgKCF0aGlzLm1hdHJpeENsaWVudCB8fCAhdGhpcy5pbml0aWFsTGlzdHNHZW5lcmF0ZWQpIHJldHVybjtcblxuICAgICAgICBpZiAoIXRoaXMuYWxnb3JpdGhtKSB7XG4gICAgICAgICAgICAvLyBUaGlzIHNob3VsZG4ndCBoYXBwZW4gYmVjYXVzZSBgaW5pdGlhbExpc3RzR2VuZXJhdGVkYCBpbXBsaWVzIHdlIGhhdmUgYW4gYWxnb3JpdGhtLlxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUm9vbSBsaXN0IHN0b3JlIGhhcyBubyBhbGdvcml0aG0gdG8gcHJvY2VzcyBkaXNwYXRjaGVyIHVwZGF0ZSB3aXRoXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHBheWxvYWQuYWN0aW9uID09PSBcIk1hdHJpeEFjdGlvbnMuUm9vbS5yZWNlaXB0XCIpIHtcbiAgICAgICAgICAgIC8vIEZpcnN0IHNlZSBpZiB0aGUgcmVjZWlwdCBldmVudCBpcyBmb3Igb3VyIG93biB1c2VyLiBJZiBpdCB3YXMsIHRyaWdnZXJcbiAgICAgICAgICAgIC8vIGEgcm9vbSB1cGRhdGUgKHdlIHByb2JhYmx5IHJlYWQgdGhlIHJvb20gb24gYSBkaWZmZXJlbnQgZGV2aWNlKS5cbiAgICAgICAgICAgIGlmIChyZWFkUmVjZWlwdENoYW5nZUlzRm9yKHBheWxvYWQuZXZlbnQsIHRoaXMubWF0cml4Q2xpZW50KSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJvb20gPSBwYXlsb2FkLnJvb207XG4gICAgICAgICAgICAgICAgaWYgKCFyb29tKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZ2dlci53YXJuKGBPd24gcmVhZCByZWNlaXB0IHdhcyBpbiB1bmtub3duIHJvb20gJHtyb29tLnJvb21JZH1gKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmhhbmRsZVJvb21VcGRhdGUocm9vbSwgUm9vbVVwZGF0ZUNhdXNlLlJlYWRSZWNlaXB0KTtcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZUZuLnRyaWdnZXIoKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAocGF5bG9hZC5hY3Rpb24gPT09IFwiTWF0cml4QWN0aW9ucy5Sb29tLnRhZ3NcIikge1xuICAgICAgICAgICAgY29uc3Qgcm9vbVBheWxvYWQgPSA8YW55PnBheWxvYWQ7IC8vIFRPRE86IFR5cGUgb3V0IHRoZSBkaXNwYXRjaGVyIHR5cGVzXG4gICAgICAgICAgICBhd2FpdCB0aGlzLmhhbmRsZVJvb21VcGRhdGUocm9vbVBheWxvYWQucm9vbSwgUm9vbVVwZGF0ZUNhdXNlLlBvc3NpYmxlVGFnQ2hhbmdlKTtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlRm4udHJpZ2dlcigpO1xuICAgICAgICB9IGVsc2UgaWYgKHBheWxvYWQuYWN0aW9uID09PSBcIk1hdHJpeEFjdGlvbnMuUm9vbS50aW1lbGluZVwiKSB7XG4gICAgICAgICAgICBjb25zdCBldmVudFBheWxvYWQgPSA8SVJvb21UaW1lbGluZUFjdGlvblBheWxvYWQ+cGF5bG9hZDtcblxuICAgICAgICAgICAgLy8gSWdub3JlIG5vbi1saXZlIGV2ZW50cyAoYmFja2ZpbGwpIGFuZCBub3RpZmljYXRpb24gdGltZWxpbmUgc2V0IGV2ZW50cyAod2l0aG91dCBhIHJvb20pXG4gICAgICAgICAgICBpZiAoIWV2ZW50UGF5bG9hZC5pc0xpdmVFdmVudCB8fCAhZXZlbnRQYXlsb2FkLmlzTGl2ZVVuZmlsdGVyZWRSb29tVGltZWxpbmVFdmVudCB8fCAhZXZlbnRQYXlsb2FkLnJvb20pIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHJvb21JZCA9IGV2ZW50UGF5bG9hZC5ldmVudC5nZXRSb29tSWQoKTtcbiAgICAgICAgICAgIGNvbnN0IHJvb20gPSB0aGlzLm1hdHJpeENsaWVudC5nZXRSb29tKHJvb21JZCk7XG4gICAgICAgICAgICBjb25zdCB0cnlVcGRhdGUgPSBhc3luYyAodXBkYXRlZFJvb206IFJvb20pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50UGF5bG9hZC5ldmVudC5nZXRUeXBlKCkgPT09IEV2ZW50VHlwZS5Sb29tVG9tYnN0b25lICYmXG4gICAgICAgICAgICAgICAgICAgIGV2ZW50UGF5bG9hZC5ldmVudC5nZXRTdGF0ZUtleSgpID09PSBcIlwiXG4gICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld1Jvb20gPSB0aGlzLm1hdHJpeENsaWVudD8uZ2V0Um9vbShldmVudFBheWxvYWQuZXZlbnQuZ2V0Q29udGVudCgpW1wicmVwbGFjZW1lbnRfcm9vbVwiXSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChuZXdSb29tKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBJZiB3ZSBoYXZlIHRoZSBuZXcgcm9vbSwgdGhlbiB0aGUgbmV3IHJvb20gY2hlY2sgd2lsbCBoYXZlIHNlZW4gdGhlIHByZWRlY2Vzc29yXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhbmQgZGlkIHRoZSByZXF1aXJlZCB1cGRhdGVzLCBzbyBkbyBub3RoaW5nIGhlcmUuXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5oYW5kbGVSb29tVXBkYXRlKHVwZGF0ZWRSb29tLCBSb29tVXBkYXRlQ2F1c2UuVGltZWxpbmUpO1xuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlRm4udHJpZ2dlcigpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmICghcm9vbSkge1xuICAgICAgICAgICAgICAgIGxvZ2dlci53YXJuKGBMaXZlIHRpbWVsaW5lIGV2ZW50ICR7ZXZlbnRQYXlsb2FkLmV2ZW50LmdldElkKCl9IHJlY2VpdmVkIHdpdGhvdXQgYXNzb2NpYXRlZCByb29tYCk7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLndhcm4oYFF1ZXVpbmcgZmFpbGVkIHJvb20gdXBkYXRlIGZvciByZXRyeSBhcyBhIHJlc3VsdC5gKTtcbiAgICAgICAgICAgICAgICB3aW5kb3cuc2V0VGltZW91dChhc3luYyAoKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHVwZGF0ZWRSb29tID0gdGhpcy5tYXRyaXhDbGllbnQ/LmdldFJvb20ocm9vbUlkKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAodXBkYXRlZFJvb20pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRyeVVwZGF0ZSh1cGRhdGVkUm9vbSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LCAxMDApOyAvLyAxMDBtcyBzaG91bGQgYmUgZW5vdWdoIGZvciB0aGUgcm9vbSB0byBzaG93IHVwXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBhd2FpdCB0cnlVcGRhdGUocm9vbSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAocGF5bG9hZC5hY3Rpb24gPT09IFwiTWF0cml4QWN0aW9ucy5FdmVudC5kZWNyeXB0ZWRcIikge1xuICAgICAgICAgICAgY29uc3QgZXZlbnRQYXlsb2FkID0gPGFueT5wYXlsb2FkOyAvLyBUT0RPOiBUeXBlIG91dCB0aGUgZGlzcGF0Y2hlciB0eXBlc1xuICAgICAgICAgICAgY29uc3Qgcm9vbUlkID0gZXZlbnRQYXlsb2FkLmV2ZW50LmdldFJvb21JZCgpO1xuICAgICAgICAgICAgaWYgKCFyb29tSWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCByb29tID0gdGhpcy5tYXRyaXhDbGllbnQuZ2V0Um9vbShyb29tSWQpO1xuICAgICAgICAgICAgaWYgKCFyb29tKSB7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLndhcm4oYEV2ZW50ICR7ZXZlbnRQYXlsb2FkLmV2ZW50LmdldElkKCl9IHdhcyBkZWNyeXB0ZWQgaW4gYW4gdW5rbm93biByb29tICR7cm9vbUlkfWApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlUm9vbVVwZGF0ZShyb29tLCBSb29tVXBkYXRlQ2F1c2UuVGltZWxpbmUpO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVGbi50cmlnZ2VyKCk7XG4gICAgICAgIH0gZWxzZSBpZiAocGF5bG9hZC5hY3Rpb24gPT09IFwiTWF0cml4QWN0aW9ucy5hY2NvdW50RGF0YVwiICYmIHBheWxvYWQuZXZlbnRfdHlwZSA9PT0gRXZlbnRUeXBlLkRpcmVjdCkge1xuICAgICAgICAgICAgY29uc3QgZXZlbnRQYXlsb2FkID0gPGFueT5wYXlsb2FkOyAvLyBUT0RPOiBUeXBlIG91dCB0aGUgZGlzcGF0Y2hlciB0eXBlc1xuICAgICAgICAgICAgY29uc3QgZG1NYXAgPSBldmVudFBheWxvYWQuZXZlbnQuZ2V0Q29udGVudCgpO1xuICAgICAgICAgICAgZm9yIChjb25zdCB1c2VySWQgb2YgT2JqZWN0LmtleXMoZG1NYXApKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgcm9vbUlkcyA9IGRtTWFwW3VzZXJJZF07XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCByb29tSWQgb2Ygcm9vbUlkcykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByb29tID0gdGhpcy5tYXRyaXhDbGllbnQuZ2V0Um9vbShyb29tSWQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXJvb20pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZ2dlci53YXJuKGAke3Jvb21JZH0gd2FzIGZvdW5kIGluIERNcyBidXQgdGhlIHJvb20gaXMgbm90IGluIHRoZSBzdG9yZWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBXZSBleHBlY3QgdGhpcyBSb29tVXBkYXRlQ2F1c2UgdG8gbm8tb3AgaWYgdGhlcmUncyBubyBjaGFuZ2UsIGFuZCB3ZSBkb24ndCBleHBlY3RcbiAgICAgICAgICAgICAgICAgICAgLy8gdGhlIHVzZXIgdG8gaGF2ZSBodW5kcmVkcyBvZiByb29tcyB0byB1cGRhdGUgaW4gb25lIGV2ZW50LiBBcyBzdWNoLCB3ZSBqdXN0IGhhbW1lclxuICAgICAgICAgICAgICAgICAgICAvLyBhd2F5IGF0IHVwZGF0ZXMgdW50aWwgdGhlIHByb2JsZW0gaXMgc29sdmVkLiBJZiB3ZSB3ZXJlIGV4cGVjdGluZyBtb3JlIHRoYW4gYSBjb3VwbGVcbiAgICAgICAgICAgICAgICAgICAgLy8gb2Ygcm9vbXMgdG8gYmUgdXBkYXRlZCBhdCBvbmNlLCB3ZSB3b3VsZCBjb25zaWRlciBiYXRjaGluZyB0aGUgcm9vbXMgdXAuXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlUm9vbVVwZGF0ZShyb29tLCBSb29tVXBkYXRlQ2F1c2UuUG9zc2libGVUYWdDaGFuZ2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMudXBkYXRlRm4udHJpZ2dlcigpO1xuICAgICAgICB9IGVsc2UgaWYgKHBheWxvYWQuYWN0aW9uID09PSBcIk1hdHJpeEFjdGlvbnMuUm9vbS5teU1lbWJlcnNoaXBcIikge1xuICAgICAgICAgICAgdGhpcy5vbkRpc3BhdGNoTXlNZW1iZXJzaGlwKDxhbnk+cGF5bG9hZCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwb3NzaWJsZU11dGVDaGFuZ2VSb29tSWRzID0gZ2V0Q2hhbmdlZE92ZXJyaWRlUm9vbU11dGVQdXNoUnVsZXMocGF5bG9hZCk7XG4gICAgICAgIGlmIChwb3NzaWJsZU11dGVDaGFuZ2VSb29tSWRzKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHJvb21JZCBvZiBwb3NzaWJsZU11dGVDaGFuZ2VSb29tSWRzKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgcm9vbSA9IHJvb21JZCAmJiB0aGlzLm1hdHJpeENsaWVudC5nZXRSb29tKHJvb21JZCk7XG4gICAgICAgICAgICAgICAgaWYgKHJvb20pIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5oYW5kbGVSb29tVXBkYXRlKHJvb20sIFJvb21VcGRhdGVDYXVzZS5Qb3NzaWJsZU11dGVDaGFuZ2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMudXBkYXRlRm4udHJpZ2dlcigpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSGFuZGxlIGEgTWF0cml4QWN0aW9ucy5Sb29tLm15TWVtYmVyc2hpcCBldmVudCBmcm9tIHRoZSBkaXNwYXRjaGVyLlxuICAgICAqXG4gICAgICogUHVibGljIGZvciB0ZXN0LlxuICAgICAqL1xuICAgIHB1YmxpYyBhc3luYyBvbkRpc3BhdGNoTXlNZW1iZXJzaGlwKG1lbWJlcnNoaXBQYXlsb2FkOiBhbnkpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgLy8gVE9ETzogVHlwZSBvdXQgdGhlIGRpc3BhdGNoZXIgdHlwZXMgc28gbWVtYmVyc2hpcFBheWxvYWQgaXMgbm90IGFueVxuICAgICAgICBjb25zdCBvbGRNZW1iZXJzaGlwID0gZ2V0RWZmZWN0aXZlTWVtYmVyc2hpcChtZW1iZXJzaGlwUGF5bG9hZC5vbGRNZW1iZXJzaGlwKTtcbiAgICAgICAgY29uc3QgbmV3TWVtYmVyc2hpcCA9IGdldEVmZmVjdGl2ZU1lbWJlcnNoaXAobWVtYmVyc2hpcFBheWxvYWQubWVtYmVyc2hpcCk7XG4gICAgICAgIGlmIChvbGRNZW1iZXJzaGlwICE9PSBFZmZlY3RpdmVNZW1iZXJzaGlwLkpvaW4gJiYgbmV3TWVtYmVyc2hpcCA9PT0gRWZmZWN0aXZlTWVtYmVyc2hpcC5Kb2luKSB7XG4gICAgICAgICAgICAvLyBJZiB3ZSdyZSBqb2luaW5nIGFuIHVwZ3JhZGVkIHJvb20sIHdlJ2xsIHdhbnQgdG8gbWFrZSBzdXJlIHdlIGRvbid0IHByb2xpZmVyYXRlXG4gICAgICAgICAgICAvLyB0aGUgZGVhZCByb29tIGluIHRoZSBsaXN0LlxuICAgICAgICAgICAgY29uc3Qgcm9vbVN0YXRlOiBSb29tU3RhdGUgPSBtZW1iZXJzaGlwUGF5bG9hZC5yb29tLmN1cnJlbnRTdGF0ZTtcbiAgICAgICAgICAgIGNvbnN0IHByZWRlY2Vzc29yID0gcm9vbVN0YXRlLmZpbmRQcmVkZWNlc3Nvcih0aGlzLm1zYzM5NDZQcm9jZXNzRHluYW1pY1ByZWRlY2Vzc29yKTtcbiAgICAgICAgICAgIGlmIChwcmVkZWNlc3Nvcikge1xuICAgICAgICAgICAgICAgIGNvbnN0IHByZXZSb29tID0gdGhpcy5tYXRyaXhDbGllbnQ/LmdldFJvb20ocHJlZGVjZXNzb3Iucm9vbUlkKTtcbiAgICAgICAgICAgICAgICBpZiAocHJldlJvb20pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNTdGlja3kgPSB0aGlzLmFsZ29yaXRobS5zdGlja3lSb29tID09PSBwcmV2Um9vbTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzU3RpY2t5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFsZ29yaXRobS5zZXRTdGlja3lSb29tKG51bGwpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gTm90ZTogd2UgaGl0IHRoZSBhbGdvcml0aG0gaW5zdGVhZCBvZiBvdXIgaGFuZGxlUm9vbVVwZGF0ZSgpIGZ1bmN0aW9uIHRvXG4gICAgICAgICAgICAgICAgICAgIC8vIGF2b2lkIHJlZHVuZGFudCB1cGRhdGVzLlxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFsZ29yaXRobS5oYW5kbGVSb29tVXBkYXRlKHByZXZSb29tLCBSb29tVXBkYXRlQ2F1c2UuUm9vbVJlbW92ZWQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZ2dlci53YXJuKGBVbmFibGUgdG8gZmluZCBwcmVkZWNlc3NvciByb29tIHdpdGggaWQgJHtwcmVkZWNlc3Nvci5yb29tSWR9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhd2FpdCB0aGlzLmhhbmRsZVJvb21VcGRhdGUobWVtYmVyc2hpcFBheWxvYWQucm9vbSwgUm9vbVVwZGF0ZUNhdXNlLk5ld1Jvb20pO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVGbi50cmlnZ2VyKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob2xkTWVtYmVyc2hpcCAhPT0gRWZmZWN0aXZlTWVtYmVyc2hpcC5JbnZpdGUgJiYgbmV3TWVtYmVyc2hpcCA9PT0gRWZmZWN0aXZlTWVtYmVyc2hpcC5JbnZpdGUpIHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlUm9vbVVwZGF0ZShtZW1iZXJzaGlwUGF5bG9hZC5yb29tLCBSb29tVXBkYXRlQ2F1c2UuTmV3Um9vbSk7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUZuLnRyaWdnZXIoKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIGl0J3Mgbm90IGEgam9pbiwgaXQncyB0cmFuc2l0aW9uaW5nIGludG8gYSBkaWZmZXJlbnQgbGlzdCAocG9zc2libHkgaGlzdG9yaWNhbClcbiAgICAgICAgaWYgKG9sZE1lbWJlcnNoaXAgIT09IG5ld01lbWJlcnNoaXApIHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlUm9vbVVwZGF0ZShtZW1iZXJzaGlwUGF5bG9hZC5yb29tLCBSb29tVXBkYXRlQ2F1c2UuUG9zc2libGVUYWdDaGFuZ2UpO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVGbi50cmlnZ2VyKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZVJvb21VcGRhdGUocm9vbTogUm9vbSwgY2F1c2U6IFJvb21VcGRhdGVDYXVzZSk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGlmIChjYXVzZSA9PT0gUm9vbVVwZGF0ZUNhdXNlLk5ld1Jvb20gJiYgcm9vbS5nZXRNeU1lbWJlcnNoaXAoKSA9PT0gXCJpbnZpdGVcIikge1xuICAgICAgICAgICAgLy8gTGV0IHRoZSB2aXNpYmlsaXR5IHByb3ZpZGVyIGtub3cgdGhhdCB0aGVyZSBpcyBhIG5ldyBpbnZpdGVkIHJvb20uIEl0IHdvdWxkIGJlIG5pY2VcbiAgICAgICAgICAgIC8vIGlmIHRoaXMgY291bGQganVzdCBiZSBhbiBldmVudCB0aGF0IHRoaW5ncyBsaXN0ZW4gZm9yIGJ1dCB0aGUgcG9pbnQgb2YgdGhpcyBpcyB0aGF0XG4gICAgICAgICAgICAvLyB3ZSBkZWxheSBkb2luZyBhbnl0aGluZyBhYm91dCB0aGlzIHJvb20gdW50aWwgdGhlIFZvaXBVc2VyTWFwcGVyIGhhZCBoYWQgYSBjaGFuY2VcbiAgICAgICAgICAgIC8vIHRvIGRvIHRoZSB0aGluZ3MgaXQgbmVlZHMgdG8gZG8gdG8gZGVjaWRlIGlmIHdlIHNob3VsZCBzaG93IHRoaXMgcm9vbSBvciBub3QsIHNvXG4gICAgICAgICAgICAvLyBhbiBldmVuIHdvdWxkbid0IGV0IHVzIGRvIHRoYXQuXG4gICAgICAgICAgICBhd2FpdCBWaXNpYmlsaXR5UHJvdmlkZXIuaW5zdGFuY2Uub25OZXdJbnZpdGVkUm9vbShyb29tKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghVmlzaWJpbGl0eVByb3ZpZGVyLmluc3RhbmNlLmlzUm9vbVZpc2libGUocm9vbSkpIHtcbiAgICAgICAgICAgIHJldHVybjsgLy8gZG9uJ3QgZG8gYW55dGhpbmcgb24gcm9vbXMgdGhhdCBhcmVuJ3QgdmlzaWJsZVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgKGNhdXNlID09PSBSb29tVXBkYXRlQ2F1c2UuTmV3Um9vbSB8fCBjYXVzZSA9PT0gUm9vbVVwZGF0ZUNhdXNlLlBvc3NpYmxlVGFnQ2hhbmdlKSAmJlxuICAgICAgICAgICAgIXRoaXMucHJlZmlsdGVyQ29uZGl0aW9ucy5ldmVyeSgoYykgPT4gYy5pc1Zpc2libGUocm9vbSkpXG4gICAgICAgICkge1xuICAgICAgICAgICAgcmV0dXJuOyAvLyBkb24ndCBkbyBhbnl0aGluZyBvbiBuZXcvbW92ZWQgcm9vbXMgd2hpY2ggb3VnaHQgbm90IHRvIGJlIHNob3duXG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzaG91bGRVcGRhdGUgPSB0aGlzLmFsZ29yaXRobS5oYW5kbGVSb29tVXBkYXRlKHJvb20sIGNhdXNlKTtcbiAgICAgICAgaWYgKHNob3VsZFVwZGF0ZSkge1xuICAgICAgICAgICAgdGhpcy51cGRhdGVGbi5tYXJrKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHJlY2FsY3VsYXRlUHJlZmlsdGVyaW5nKCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBpZiAoIXRoaXMuYWxnb3JpdGhtKSByZXR1cm47XG4gICAgICAgIGlmICghdGhpcy5hbGdvcml0aG0uaGFzVGFnU29ydGluZ01hcCkgcmV0dXJuOyAvLyB3ZSdyZSBzdGlsbCBsb2FkaW5nXG5cbiAgICAgICAgLy8gSW5oaWJpdCB1cGRhdGVzIGJlY2F1c2Ugd2UncmUgYWJvdXQgdG8gbGllIGhlYXZpbHkgdG8gdGhlIGFsZ29yaXRobVxuICAgICAgICB0aGlzLmFsZ29yaXRobS51cGRhdGVzSW5oaWJpdGVkID0gdHJ1ZTtcblxuICAgICAgICAvLyBGaWd1cmUgb3V0IHdoaWNoIHJvb21zIGFyZSBhYm91dCB0byBiZSB2YWxpZCwgYW5kIHRoZSBzdGF0ZSBvZiBhZmZhaXJzXG4gICAgICAgIGNvbnN0IHJvb21zID0gdGhpcy5nZXRQbGF1c2libGVSb29tcygpO1xuICAgICAgICBjb25zdCBjdXJyZW50U3RpY2t5ID0gdGhpcy5hbGdvcml0aG0uc3RpY2t5Um9vbTtcbiAgICAgICAgY29uc3Qgc3RpY2t5SXNTdGlsbFByZXNlbnQgPSBjdXJyZW50U3RpY2t5ICYmIHJvb21zLmluY2x1ZGVzKGN1cnJlbnRTdGlja3kpO1xuXG4gICAgICAgIC8vIFJlc2V0IHRoZSBzdGlja3kgcm9vbSBiZWZvcmUgcmVzZXR0aW5nIHRoZSBrbm93biByb29tcyBzbyB0aGUgYWxnb3JpdGhtXG4gICAgICAgIC8vIGRvZXNuJ3QgZnJlYWsgb3V0LlxuICAgICAgICB0aGlzLmFsZ29yaXRobS5zZXRTdGlja3lSb29tKG51bGwpO1xuICAgICAgICB0aGlzLmFsZ29yaXRobS5zZXRLbm93blJvb21zKHJvb21zKTtcblxuICAgICAgICAvLyBTZXQgdGhlIHN0aWNreSByb29tIGJhY2ssIGlmIG5lZWRlZCwgbm93IHRoYXQgd2UgaGF2ZSB1cGRhdGVkIHRoZSBzdG9yZS5cbiAgICAgICAgLy8gVGhpcyB3aWxsIHVzZSByZWxhdGl2ZSBzdGlja3luZXNzIHRvIHRoZSBuZXcgcm9vbSBzZXQuXG4gICAgICAgIGlmIChzdGlja3lJc1N0aWxsUHJlc2VudCkge1xuICAgICAgICAgICAgdGhpcy5hbGdvcml0aG0uc2V0U3RpY2t5Um9vbShjdXJyZW50U3RpY2t5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZpbmFsbHksIG1hcmsgYW4gdXBkYXRlIGFuZCByZXN1bWUgdXBkYXRlcyBmcm9tIHRoZSBhbGdvcml0aG1cbiAgICAgICAgdGhpcy51cGRhdGVGbi5tYXJrKCk7XG4gICAgICAgIHRoaXMuYWxnb3JpdGhtLnVwZGF0ZXNJbmhpYml0ZWQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc2V0VGFnU29ydGluZyh0YWdJZDogVGFnSUQsIHNvcnQ6IFNvcnRBbGdvcml0aG0pOiB2b2lkIHtcbiAgICAgICAgdGhpcy5zZXRBbmRQZXJzaXN0VGFnU29ydGluZyh0YWdJZCwgc29ydCk7XG4gICAgICAgIHRoaXMudXBkYXRlRm4udHJpZ2dlcigpO1xuICAgIH1cblxuICAgIHByaXZhdGUgc2V0QW5kUGVyc2lzdFRhZ1NvcnRpbmcodGFnSWQ6IFRhZ0lELCBzb3J0OiBTb3J0QWxnb3JpdGhtKTogdm9pZCB7XG4gICAgICAgIHRoaXMuYWxnb3JpdGhtLnNldFRhZ1NvcnRpbmcodGFnSWQsIHNvcnQpO1xuICAgICAgICAvLyBUT0RPOiBQZXItYWNjb3VudD8gaHR0cHM6Ly9naXRodWIuY29tL3ZlY3Rvci1pbS9lbGVtZW50LXdlYi9pc3N1ZXMvMTQxMTRcbiAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oYG14X3RhZ1NvcnRfJHt0YWdJZH1gLCBzb3J0KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0VGFnU29ydGluZyh0YWdJZDogVGFnSUQpOiBTb3J0QWxnb3JpdGhtIHwgbnVsbCB7XG4gICAgICAgIHJldHVybiB0aGlzLmFsZ29yaXRobS5nZXRUYWdTb3J0aW5nKHRhZ0lkKTtcbiAgICB9XG5cbiAgICAvLyBub2luc3BlY3Rpb24gSlNNZXRob2RDYW5CZVN0YXRpY1xuICAgIHByaXZhdGUgZ2V0U3RvcmVkVGFnU29ydGluZyh0YWdJZDogVGFnSUQpOiBTb3J0QWxnb3JpdGhtIHtcbiAgICAgICAgLy8gVE9ETzogUGVyLWFjY291bnQ/IGh0dHBzOi8vZ2l0aHViLmNvbS92ZWN0b3ItaW0vZWxlbWVudC13ZWIvaXNzdWVzLzE0MTE0XG4gICAgICAgIHJldHVybiA8U29ydEFsZ29yaXRobT5sb2NhbFN0b3JhZ2UuZ2V0SXRlbShgbXhfdGFnU29ydF8ke3RhZ0lkfWApO1xuICAgIH1cblxuICAgIC8vIGxvZ2ljIG11c3QgbWF0Y2ggY2FsY3VsYXRlTGlzdE9yZGVyXG4gICAgcHJpdmF0ZSBjYWxjdWxhdGVUYWdTb3J0aW5nKHRhZ0lkOiBUYWdJRCk6IFNvcnRBbGdvcml0aG0ge1xuICAgICAgICBjb25zdCBkZWZpbmVkU29ydCA9IHRoaXMuZ2V0VGFnU29ydGluZyh0YWdJZCk7XG4gICAgICAgIGNvbnN0IHN0b3JlZFNvcnQgPSB0aGlzLmdldFN0b3JlZFRhZ1NvcnRpbmcodGFnSWQpO1xuXG4gICAgICAgIC8vIFdlIHVzZSB0aGUgZm9sbG93aW5nIG9yZGVyIHRvIGRldGVybWluZSB3aGljaCBvZiB0aGUgNCBmbGFncyB0byB1c2U6XG4gICAgICAgIC8vIFN0b3JlZCA+IFNldHRpbmdzID4gRGVmaW5lZCA+IERlZmF1bHRcblxuICAgICAgICBsZXQgdGFnU29ydCA9IFNvcnRBbGdvcml0aG0uUmVjZW50O1xuICAgICAgICBpZiAoc3RvcmVkU29ydCkge1xuICAgICAgICAgICAgdGFnU29ydCA9IHN0b3JlZFNvcnQ7XG4gICAgICAgIH0gZWxzZSBpZiAoZGVmaW5lZFNvcnQpIHtcbiAgICAgICAgICAgIHRhZ1NvcnQgPSBkZWZpbmVkU29ydDtcbiAgICAgICAgfSAvLyBlbHNlIGRlZmF1bHQgKGFscmVhZHkgc2V0KVxuXG4gICAgICAgIHJldHVybiB0YWdTb3J0O1xuICAgIH1cblxuICAgIHB1YmxpYyBzZXRMaXN0T3JkZXIodGFnSWQ6IFRhZ0lELCBvcmRlcjogTGlzdEFsZ29yaXRobSk6IHZvaWQge1xuICAgICAgICB0aGlzLnNldEFuZFBlcnNpc3RMaXN0T3JkZXIodGFnSWQsIG9yZGVyKTtcbiAgICAgICAgdGhpcy51cGRhdGVGbi50cmlnZ2VyKCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzZXRBbmRQZXJzaXN0TGlzdE9yZGVyKHRhZ0lkOiBUYWdJRCwgb3JkZXI6IExpc3RBbGdvcml0aG0pOiB2b2lkIHtcbiAgICAgICAgdGhpcy5hbGdvcml0aG0uc2V0TGlzdE9yZGVyaW5nKHRhZ0lkLCBvcmRlcik7XG4gICAgICAgIC8vIFRPRE86IFBlci1hY2NvdW50PyBodHRwczovL2dpdGh1Yi5jb20vdmVjdG9yLWltL2VsZW1lbnQtd2ViL2lzc3Vlcy8xNDExNFxuICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShgbXhfbGlzdE9yZGVyXyR7dGFnSWR9YCwgb3JkZXIpO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXRMaXN0T3JkZXIodGFnSWQ6IFRhZ0lEKTogTGlzdEFsZ29yaXRobSB8IG51bGwge1xuICAgICAgICByZXR1cm4gdGhpcy5hbGdvcml0aG0uZ2V0TGlzdE9yZGVyaW5nKHRhZ0lkKTtcbiAgICB9XG5cbiAgICAvLyBub2luc3BlY3Rpb24gSlNNZXRob2RDYW5CZVN0YXRpY1xuICAgIHByaXZhdGUgZ2V0U3RvcmVkTGlzdE9yZGVyKHRhZ0lkOiBUYWdJRCk6IExpc3RBbGdvcml0aG0ge1xuICAgICAgICAvLyBUT0RPOiBQZXItYWNjb3VudD8gaHR0cHM6Ly9naXRodWIuY29tL3ZlY3Rvci1pbS9lbGVtZW50LXdlYi9pc3N1ZXMvMTQxMTRcbiAgICAgICAgcmV0dXJuIDxMaXN0QWxnb3JpdGhtPmxvY2FsU3RvcmFnZS5nZXRJdGVtKGBteF9saXN0T3JkZXJfJHt0YWdJZH1gKTtcbiAgICB9XG5cbiAgICAvLyBsb2dpYyBtdXN0IG1hdGNoIGNhbGN1bGF0ZVRhZ1NvcnRpbmdcbiAgICBwcml2YXRlIGNhbGN1bGF0ZUxpc3RPcmRlcih0YWdJZDogVGFnSUQpOiBMaXN0QWxnb3JpdGhtIHtcbiAgICAgICAgY29uc3QgZGVmYXVsdE9yZGVyID0gTGlzdEFsZ29yaXRobS5OYXR1cmFsO1xuICAgICAgICBjb25zdCBkZWZpbmVkT3JkZXIgPSB0aGlzLmdldExpc3RPcmRlcih0YWdJZCk7XG4gICAgICAgIGNvbnN0IHN0b3JlZE9yZGVyID0gdGhpcy5nZXRTdG9yZWRMaXN0T3JkZXIodGFnSWQpO1xuXG4gICAgICAgIC8vIFdlIHVzZSB0aGUgZm9sbG93aW5nIG9yZGVyIHRvIGRldGVybWluZSB3aGljaCBvZiB0aGUgNCBmbGFncyB0byB1c2U6XG4gICAgICAgIC8vIFN0b3JlZCA+IFNldHRpbmdzID4gRGVmaW5lZCA+IERlZmF1bHRcblxuICAgICAgICBsZXQgbGlzdE9yZGVyID0gZGVmYXVsdE9yZGVyO1xuICAgICAgICBpZiAoc3RvcmVkT3JkZXIpIHtcbiAgICAgICAgICAgIGxpc3RPcmRlciA9IHN0b3JlZE9yZGVyO1xuICAgICAgICB9IGVsc2UgaWYgKGRlZmluZWRPcmRlcikge1xuICAgICAgICAgICAgbGlzdE9yZGVyID0gZGVmaW5lZE9yZGVyO1xuICAgICAgICB9IC8vIGVsc2UgZGVmYXVsdCAoYWxyZWFkeSBzZXQpXG5cbiAgICAgICAgcmV0dXJuIGxpc3RPcmRlcjtcbiAgICB9XG5cbiAgICBwcml2YXRlIHVwZGF0ZUFsZ29yaXRobUluc3RhbmNlcygpOiB2b2lkIHtcbiAgICAgICAgLy8gV2UnbGwgcmVxdWlyZSBhbiB1cGRhdGUsIHNvIG1hcmsgZm9yIG9uZS4gTWFya2luZyBub3cgYWxzbyBwcmV2ZW50cyB0aGUgY2FsbHNcbiAgICAgICAgLy8gdG8gc2V0VGFnU29ydGluZyBhbmQgc2V0TGlzdE9yZGVyIGZyb20gY2F1c2luZyB0cmlnZ2Vycy5cbiAgICAgICAgdGhpcy51cGRhdGVGbi5tYXJrKCk7XG5cbiAgICAgICAgZm9yIChjb25zdCB0YWcgb2YgT2JqZWN0LmtleXModGhpcy5vcmRlcmVkTGlzdHMpKSB7XG4gICAgICAgICAgICBjb25zdCBkZWZpbmVkU29ydCA9IHRoaXMuZ2V0VGFnU29ydGluZyh0YWcpO1xuICAgICAgICAgICAgY29uc3QgZGVmaW5lZE9yZGVyID0gdGhpcy5nZXRMaXN0T3JkZXIodGFnKTtcblxuICAgICAgICAgICAgY29uc3QgdGFnU29ydCA9IHRoaXMuY2FsY3VsYXRlVGFnU29ydGluZyh0YWcpO1xuICAgICAgICAgICAgY29uc3QgbGlzdE9yZGVyID0gdGhpcy5jYWxjdWxhdGVMaXN0T3JkZXIodGFnKTtcblxuICAgICAgICAgICAgaWYgKHRhZ1NvcnQgIT09IGRlZmluZWRTb3J0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRBbmRQZXJzaXN0VGFnU29ydGluZyh0YWcsIHRhZ1NvcnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGxpc3RPcmRlciAhPT0gZGVmaW5lZE9yZGVyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRBbmRQZXJzaXN0TGlzdE9yZGVyKHRhZywgbGlzdE9yZGVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgb25BbGdvcml0aG1MaXN0VXBkYXRlZCA9IChmb3JjZVVwZGF0ZTogYm9vbGVhbik6IHZvaWQgPT4ge1xuICAgICAgICB0aGlzLnVwZGF0ZUZuLm1hcmsoKTtcbiAgICAgICAgaWYgKGZvcmNlVXBkYXRlKSB0aGlzLnVwZGF0ZUZuLnRyaWdnZXIoKTtcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBvbkFsZ29yaXRobUZpbHRlclVwZGF0ZWQgPSAoKTogdm9pZCA9PiB7XG4gICAgICAgIC8vIFRoZSBmaWx0ZXIgY2FuIGhhcHBlbiBvZmYtY3ljbGUsIHNvIHRyaWdnZXIgYW4gdXBkYXRlLiBUaGUgZmlsdGVyIHdpbGwgaGF2ZVxuICAgICAgICAvLyBhbHJlYWR5IGNhdXNlZCBhIG1hcmsuXG4gICAgICAgIHRoaXMudXBkYXRlRm4udHJpZ2dlcigpO1xuICAgIH07XG5cbiAgICBwcml2YXRlIG9uUHJlZmlsdGVyVXBkYXRlZCA9IGFzeW5jICgpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgICAgYXdhaXQgdGhpcy5yZWNhbGN1bGF0ZVByZWZpbHRlcmluZygpO1xuICAgICAgICB0aGlzLnVwZGF0ZUZuLnRyaWdnZXIoKTtcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBnZXRQbGF1c2libGVSb29tcygpOiBSb29tW10ge1xuICAgICAgICBpZiAoIXRoaXMubWF0cml4Q2xpZW50KSByZXR1cm4gW107XG5cbiAgICAgICAgbGV0IHJvb21zID0gdGhpcy5tYXRyaXhDbGllbnQuZ2V0VmlzaWJsZVJvb21zKHRoaXMubXNjMzk0NlByb2Nlc3NEeW5hbWljUHJlZGVjZXNzb3IpO1xuICAgICAgICByb29tcyA9IHJvb21zLmZpbHRlcigocikgPT4gVmlzaWJpbGl0eVByb3ZpZGVyLmluc3RhbmNlLmlzUm9vbVZpc2libGUocikpO1xuXG4gICAgICAgIGlmICh0aGlzLnByZWZpbHRlckNvbmRpdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgcm9vbXMgPSByb29tcy5maWx0ZXIoKHIpID0+IHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGZpbHRlciBvZiB0aGlzLnByZWZpbHRlckNvbmRpdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmaWx0ZXIuaXNWaXNpYmxlKHIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByb29tcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWdlbmVyYXRlcyB0aGUgcm9vbSB3aG9sZSByb29tIGxpc3QsIGRpc2NhcmRpbmcgYW55IHByZXZpb3VzIHJlc3VsdHMuXG4gICAgICpcbiAgICAgKiBOb3RlOiBUaGlzIGlzIG9ubHkgZXhwb3NlZCBleHRlcm5hbGx5IGZvciB0aGUgdGVzdHMuIERvIG5vdCBjYWxsIHRoaXMgZnJvbSB3aXRoaW5cbiAgICAgKiB0aGUgYXBwLlxuICAgICAqIEBwYXJhbSB0cmlnZ2VyIFNldCB0byBmYWxzZSB0byBwcmV2ZW50IGEgbGlzdCB1cGRhdGUgZnJvbSBiZWluZyBzZW50LiBTaG91bGQgb25seVxuICAgICAqIGJlIHVzZWQgaWYgdGhlIGNhbGxpbmcgY29kZSB3aWxsIG1hbnVhbGx5IHRyaWdnZXIgdGhlIHVwZGF0ZS5cbiAgICAgKi9cbiAgICBwdWJsaWMgcmVnZW5lcmF0ZUFsbExpc3RzKHsgdHJpZ2dlciA9IHRydWUgfSk6IHZvaWQge1xuICAgICAgICBsb2dnZXIud2FybihcIlJlZ2VuZXJhdGluZyBhbGwgcm9vbSBsaXN0c1wiKTtcblxuICAgICAgICBjb25zdCByb29tcyA9IHRoaXMuZ2V0UGxhdXNpYmxlUm9vbXMoKTtcblxuICAgICAgICBjb25zdCBzb3J0czogSVRhZ1NvcnRpbmdNYXAgPSB7fTtcbiAgICAgICAgY29uc3Qgb3JkZXJzOiBJTGlzdE9yZGVyaW5nTWFwID0ge307XG4gICAgICAgIGNvbnN0IGFsbFRhZ3MgPSBbLi4uT3JkZXJlZERlZmF1bHRUYWdJRHNdO1xuICAgICAgICBmb3IgKGNvbnN0IHRhZ0lkIG9mIGFsbFRhZ3MpIHtcbiAgICAgICAgICAgIHNvcnRzW3RhZ0lkXSA9IHRoaXMuY2FsY3VsYXRlVGFnU29ydGluZyh0YWdJZCk7XG4gICAgICAgICAgICBvcmRlcnNbdGFnSWRdID0gdGhpcy5jYWxjdWxhdGVMaXN0T3JkZXIodGFnSWQpO1xuXG4gICAgICAgICAgICBSb29tTGlzdExheW91dFN0b3JlLmluc3RhbmNlLmVuc3VyZUxheW91dEV4aXN0cyh0YWdJZCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmFsZ29yaXRobS5wb3B1bGF0ZVRhZ3Moc29ydHMsIG9yZGVycyk7XG4gICAgICAgIHRoaXMuYWxnb3JpdGhtLnNldEtub3duUm9vbXMocm9vbXMpO1xuXG4gICAgICAgIHRoaXMuaW5pdGlhbExpc3RzR2VuZXJhdGVkID0gdHJ1ZTtcblxuICAgICAgICBpZiAodHJpZ2dlcikgdGhpcy51cGRhdGVGbi50cmlnZ2VyKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIGZpbHRlciBjb25kaXRpb24gdG8gdGhlIHJvb20gbGlzdCBzdG9yZS4gRmlsdGVycyBtYXkgYmUgYXBwbGllZCBhc3luYyxcbiAgICAgKiBhbmQgdGh1cyBtaWdodCBub3QgY2F1c2UgYW4gdXBkYXRlIHRvIHRoZSBzdG9yZSBpbW1lZGlhdGVseS5cbiAgICAgKiBAcGFyYW0ge0lGaWx0ZXJDb25kaXRpb259IGZpbHRlciBUaGUgZmlsdGVyIGNvbmRpdGlvbiB0byBhZGQuXG4gICAgICovXG4gICAgcHVibGljIGFzeW5jIGFkZEZpbHRlcihmaWx0ZXI6IElGaWx0ZXJDb25kaXRpb24pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgbGV0IHByb21pc2UgPSBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgICAgZmlsdGVyLm9uKEZJTFRFUl9DSEFOR0VELCB0aGlzLm9uUHJlZmlsdGVyVXBkYXRlZCk7XG4gICAgICAgIHRoaXMucHJlZmlsdGVyQ29uZGl0aW9ucy5wdXNoKGZpbHRlcik7XG4gICAgICAgIHByb21pc2UgPSB0aGlzLnJlY2FsY3VsYXRlUHJlZmlsdGVyaW5nKCk7XG4gICAgICAgIHByb21pc2UudGhlbigoKSA9PiB0aGlzLnVwZGF0ZUZuLnRyaWdnZXIoKSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhIGZpbHRlciBjb25kaXRpb24gZnJvbSB0aGUgcm9vbSBsaXN0IHN0b3JlLiBJZiB0aGUgZmlsdGVyIHdhc1xuICAgICAqIG5vdCBwcmV2aW91c2x5IGFkZGVkIHRvIHRoZSByb29tIGxpc3Qgc3RvcmUsIHRoaXMgd2lsbCBuby1vcC4gVGhlIGVmZmVjdHNcbiAgICAgKiBvZiByZW1vdmluZyBhIGZpbHRlciBtYXkgYmUgYXBwbGllZCBhc3luYyBhbmQgdGhlcmVmb3JlIG1pZ2h0IG5vdCBjYXVzZVxuICAgICAqIGFuIHVwZGF0ZSByaWdodCBhd2F5LlxuICAgICAqIEBwYXJhbSB7SUZpbHRlckNvbmRpdGlvbn0gZmlsdGVyIFRoZSBmaWx0ZXIgY29uZGl0aW9uIHRvIHJlbW92ZS5cbiAgICAgKi9cbiAgICBwdWJsaWMgcmVtb3ZlRmlsdGVyKGZpbHRlcjogSUZpbHRlckNvbmRpdGlvbik6IHZvaWQge1xuICAgICAgICBsZXQgcHJvbWlzZSA9IFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgICBsZXQgcmVtb3ZlZCA9IGZhbHNlO1xuICAgICAgICBjb25zdCBpZHggPSB0aGlzLnByZWZpbHRlckNvbmRpdGlvbnMuaW5kZXhPZihmaWx0ZXIpO1xuICAgICAgICBpZiAoaWR4ID49IDApIHtcbiAgICAgICAgICAgIGZpbHRlci5vZmYoRklMVEVSX0NIQU5HRUQsIHRoaXMub25QcmVmaWx0ZXJVcGRhdGVkKTtcbiAgICAgICAgICAgIHRoaXMucHJlZmlsdGVyQ29uZGl0aW9ucy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgIHByb21pc2UgPSB0aGlzLnJlY2FsY3VsYXRlUHJlZmlsdGVyaW5nKCk7XG4gICAgICAgICAgICByZW1vdmVkID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZW1vdmVkKSB7XG4gICAgICAgICAgICBwcm9taXNlLnRoZW4oKCkgPT4gdGhpcy51cGRhdGVGbi50cmlnZ2VyKCkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUgdGFncyBmb3IgYSByb29tIGlkZW50aWZpZWQgYnkgdGhlIHN0b3JlLiBUaGUgcmV0dXJuZWQgc2V0XG4gICAgICogc2hvdWxkIG5ldmVyIGJlIGVtcHR5LCBhbmQgd2lsbCBjb250YWluIERlZmF1bHRUYWdJRC5VbnRhZ2dlZCBpZlxuICAgICAqIHRoZSBzdG9yZSBpcyBub3QgYXdhcmUgb2YgYW55IHRhZ3MuXG4gICAgICogQHBhcmFtIHJvb20gVGhlIHJvb20gdG8gZ2V0IHRoZSB0YWdzIGZvci5cbiAgICAgKiBAcmV0dXJucyBUaGUgdGFncyBmb3IgdGhlIHJvb20uXG4gICAgICovXG4gICAgcHVibGljIGdldFRhZ3NGb3JSb29tKHJvb206IFJvb20pOiBUYWdJRFtdIHtcbiAgICAgICAgY29uc3QgYWxnb3JpdGhtVGFncyA9IHRoaXMuYWxnb3JpdGhtLmdldFRhZ3NGb3JSb29tKHJvb20pO1xuICAgICAgICBpZiAoIWFsZ29yaXRobVRhZ3MpIHJldHVybiBbRGVmYXVsdFRhZ0lELlVudGFnZ2VkXTtcbiAgICAgICAgcmV0dXJuIGFsZ29yaXRobVRhZ3M7XG4gICAgfVxuXG4gICAgcHVibGljIGdldENvdW50KHRhZ0lkOiBUYWdJRCk6IG51bWJlciB7XG4gICAgICAgIC8vIFRoZSByb29tIGxpc3Qgc3RvcmUga25vd3MgYWJvdXQgYWxsIHRoZSByb29tcywgc28ganVzdCByZXR1cm4gdGhlIGxlbmd0aC5cbiAgICAgICAgcmV0dXJuIHRoaXMub3JkZXJlZExpc3RzW3RhZ0lkXS5sZW5ndGggfHwgMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYW51YWxseSB1cGRhdGUgYSByb29tIHdpdGggYSBnaXZlbiBjYXVzZS4gVGhpcyBzaG91bGQgb25seSBiZSB1c2VkIGlmIHRoZVxuICAgICAqIHJvb20gbGlzdCBzdG9yZSB3b3VsZCBvdGhlcndpc2UgYmUgaW5jYXBhYmxlIG9mIGRvaW5nIHRoZSB1cGRhdGUgaXRzZWxmLiBOb3RlXG4gICAgICogdGhhdCB0aGlzIG1heSByYWNlIHdpdGggdGhlIHJvb20gbGlzdCdzIHJlZ3VsYXIgb3BlcmF0aW9uLlxuICAgICAqIEBwYXJhbSB7Um9vbX0gcm9vbSBUaGUgcm9vbSB0byB1cGRhdGUuXG4gICAgICogQHBhcmFtIHtSb29tVXBkYXRlQ2F1c2V9IGNhdXNlIFRoZSBjYXVzZSB0byB1cGRhdGUgZm9yLlxuICAgICAqL1xuICAgIHB1YmxpYyBhc3luYyBtYW51YWxSb29tVXBkYXRlKHJvb206IFJvb20sIGNhdXNlOiBSb29tVXBkYXRlQ2F1c2UpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgYXdhaXQgdGhpcy5oYW5kbGVSb29tVXBkYXRlKHJvb20sIGNhdXNlKTtcbiAgICAgICAgdGhpcy51cGRhdGVGbi50cmlnZ2VyKCk7XG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBSb29tTGlzdFN0b3JlIHtcbiAgICBwcml2YXRlIHN0YXRpYyBpbnRlcm5hbEluc3RhbmNlOiBJbnRlcmZhY2U7XG5cbiAgICBwdWJsaWMgc3RhdGljIGdldCBpbnN0YW5jZSgpOiBJbnRlcmZhY2Uge1xuICAgICAgICBpZiAoIVJvb21MaXN0U3RvcmUuaW50ZXJuYWxJbnN0YW5jZSkge1xuICAgICAgICAgICAgaWYgKFNldHRpbmdzU3RvcmUuZ2V0VmFsdWUoXCJmZWF0dXJlX3NsaWRpbmdfc3luY1wiKSkge1xuICAgICAgICAgICAgICAgIGxvZ2dlci5pbmZvKFwidXNpbmcgU2xpZGluZ1Jvb21MaXN0U3RvcmVDbGFzc1wiKTtcbiAgICAgICAgICAgICAgICBjb25zdCBpbnN0YW5jZSA9IG5ldyBTbGlkaW5nUm9vbUxpc3RTdG9yZUNsYXNzKGRlZmF1bHREaXNwYXRjaGVyLCBTZGtDb250ZXh0Q2xhc3MuaW5zdGFuY2UpO1xuICAgICAgICAgICAgICAgIGluc3RhbmNlLnN0YXJ0KCk7XG4gICAgICAgICAgICAgICAgUm9vbUxpc3RTdG9yZS5pbnRlcm5hbEluc3RhbmNlID0gaW5zdGFuY2U7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlID0gbmV3IFJvb21MaXN0U3RvcmVDbGFzcyhkZWZhdWx0RGlzcGF0Y2hlcik7XG4gICAgICAgICAgICAgICAgaW5zdGFuY2Uuc3RhcnQoKTtcbiAgICAgICAgICAgICAgICBSb29tTGlzdFN0b3JlLmludGVybmFsSW5zdGFuY2UgPSBpbnN0YW5jZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLmludGVybmFsSW5zdGFuY2U7XG4gICAgfVxufVxuXG53aW5kb3cubXhSb29tTGlzdFN0b3JlID0gUm9vbUxpc3RTdG9yZS5pbnN0YW5jZTtcbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFrQkEsSUFBQUEsT0FBQSxHQUFBQyxPQUFBO0FBQ0EsSUFBQUMsTUFBQSxHQUFBRCxPQUFBO0FBR0EsSUFBQUUsY0FBQSxHQUFBQyxzQkFBQSxDQUFBSCxPQUFBO0FBQ0EsSUFBQUksT0FBQSxHQUFBSixPQUFBO0FBQ0EsSUFBQUssUUFBQSxHQUFBTCxPQUFBO0FBRUEsSUFBQU0sV0FBQSxHQUFBSCxzQkFBQSxDQUFBSCxPQUFBO0FBQ0EsSUFBQU8sYUFBQSxHQUFBUCxPQUFBO0FBQ0EsSUFBQVEsaUJBQUEsR0FBQVIsT0FBQTtBQUNBLElBQUFTLFVBQUEsR0FBQVQsT0FBQTtBQUNBLElBQUFVLFdBQUEsR0FBQVYsT0FBQTtBQUNBLElBQUFXLG9CQUFBLEdBQUFS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