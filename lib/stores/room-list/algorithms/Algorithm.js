"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.LIST_UPDATED_EVENT = exports.Algorithm = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _utils = require("matrix-js-sdk/src/utils");
var _events = require("events");
var _logger = require("matrix-js-sdk/src/logger");
var _DMRoomMap = _interopRequireDefault(require("../../../utils/DMRoomMap"));
var _arrays = require("../../../utils/arrays");
var _models = require("../models");
var _membership = require("../../../utils/membership");
var _listOrdering = require("./list-ordering");
var _VisibilityProvider = require("../filters/VisibilityProvider");
var _CallStore = require("../../CallStore");
/*
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

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
 * Fired when the Algorithm has determined a list has been updated.
 */
const LIST_UPDATED_EVENT = "list_updated_event";

// These are the causes which require a room to be known in order for us to handle them. If
// a cause in this list is raised and we don't know about the room, we don't handle the update.
//
// Note: these typically happen when a new room is coming in, such as the user creating or
// joining the room. For these cases, we need to know about the room prior to handling it otherwise
// we'll make bad assumptions.
exports.LIST_UPDATED_EVENT = LIST_UPDATED_EVENT;
const CAUSES_REQUIRING_ROOM = [_models.RoomUpdateCause.Timeline, _models.RoomUpdateCause.ReadReceipt];
/**
 * Represents a list ordering algorithm. This class will take care of tag
 * management (which rooms go in which tags) and ask the implementation to
 * deal with ordering mechanics.
 */
class Algorithm extends _events.EventEmitter {
  constructor() {
    super(...arguments);
    (0, _defineProperty2.default)(this, "_cachedRooms", {});
    (0, _defineProperty2.default)(this, "_cachedStickyRooms", {});
    // a clone of the _cachedRooms, with the sticky room
    (0, _defineProperty2.default)(this, "_stickyRoom", null);
    (0, _defineProperty2.default)(this, "_lastStickyRoom", null);
    // only not-null when changing the sticky room
    (0, _defineProperty2.default)(this, "sortAlgorithms", null);
    (0, _defineProperty2.default)(this, "listAlgorithms", null);
    (0, _defineProperty2.default)(this, "algorithms", null);
    (0, _defineProperty2.default)(this, "rooms", []);
    (0, _defineProperty2.default)(this, "roomIdsToTags", {});
    /**
     * Set to true to suspend emissions of algorithm updates.
     */
    (0, _defineProperty2.default)(this, "updatesInhibited", false);
    (0, _defineProperty2.default)(this, "onActiveCalls", () => {
      // In case we're unsticking a room, sort it back into natural order
      this.recalculateStickyRoom();

      // Update the stickiness of rooms with calls
      this.recalculateActiveCallRooms();
      if (this.updatesInhibited) return;
      // This isn't in response to any particular RoomListStore update,
      // so notify the store that it needs to force-update
      this.emit(LIST_UPDATED_EVENT, true);
    });
  }
  start() {
    _CallStore.CallStore.instance.on(_CallStore.CallStoreEvent.ActiveCalls, this.onActiveCalls);
  }
  stop() {
    _CallStore.CallStore.instance.off(_CallStore.CallStoreEvent.ActiveCalls, this.onActiveCalls);
  }
  get stickyRoom() {
    return this._stickyRoom ? this._stickyRoom.room : null;
  }
  get knownRooms() {
    return this.rooms;
  }
  get hasTagSortingMap() {
    return !!this.sortAlgorithms;
  }
  set cachedRooms(val) {
    this._cachedRooms = val;
    this.recalculateStickyRoom();
    this.recalculateActiveCallRooms();
  }
  get cachedRooms() {
    // 🐉 Here be dragons.
    // Note: this is used by the underlying algorithm classes, so don't make it return
    // the sticky room cache. If it ends up returning the sticky room cache, we end up
    // corrupting our caches and confusing them.
    return this._cachedRooms;
  }

  /**
   * Awaitable version of the sticky room setter.
   * @param val The new room to sticky.
   */
  setStickyRoom(val) {
    try {
      this.updateStickyRoom(val);
    } catch (e) {
      _logger.logger.warn("Failed to update sticky room", e);
    }
  }
  getTagSorting(tagId) {
    if (!this.sortAlgorithms) return null;
    return this.sortAlgorithms[tagId];
  }
  setTagSorting(tagId, sort) {
    if (!tagId) throw new Error("Tag ID must be defined");
    if (!sort) throw new Error("Algorithm must be defined");
    if (!this.sortAlgorithms) throw new Error("this.sortAlgorithms must be defined before calling setTagSorting");
    if (!this.algorithms) throw new Error("this.algorithms must be defined before calling setTagSorting");
    this.sortAlgorithms[tagId] = sort;
    const algorithm = this.algorithms[tagId];
    algorithm.setSortAlgorithm(sort);
    this._cachedRooms[tagId] = algorithm.orderedRooms;
    this.recalculateStickyRoom(tagId); // update sticky room to make sure it appears if needed
    this.recalculateActiveCallRooms(tagId);
  }
  getListOrdering(tagId) {
    if (!this.listAlgorithms) return null;
    return this.listAlgorithms[tagId];
  }
  setListOrdering(tagId, order) {
    if (!tagId) throw new Error("Tag ID must be defined");
    if (!order) throw new Error("Algorithm must be defined");
    if (!this.sortAlgorithms) throw new Error("this.sortAlgorithms must be defined before calling setListOrdering");
    if (!this.listAlgorithms) throw new Error("this.listAlgorithms must be defined before calling setListOrdering");
    if (!this.algorithms) throw new Error("this.algorithms must be defined before calling setListOrdering");
    this.listAlgorithms[tagId] = order;
    const algorithm = (0, _listOrdering.getListAlgorithmInstance)(order, tagId, this.sortAlgorithms[tagId]);
    this.algorithms[tagId] = algorithm;
    algorithm.setRooms(this._cachedRooms[tagId]);
    this._cachedRooms[tagId] = algorithm.orderedRooms;
    this.recalculateStickyRoom(tagId); // update sticky room to make sure it appears if needed
    this.recalculateActiveCallRooms(tagId);
  }
  updateStickyRoom(val) {
    this.doUpdateStickyRoom(val);
    this._lastStickyRoom = null; // clear to indicate we're done changing
  }

  doUpdateStickyRoom(val) {
    if (val?.isSpaceRoom() && val.getMyMembership() !== "invite") {
      // no-op sticky rooms for spaces - they're effectively virtual rooms
      val = null;
    }
    if (val && !_VisibilityProvider.VisibilityProvider.instance.isRoomVisible(val)) {
      val = null; // the room isn't visible - lie to the rest of this function
    }

    // Set the last sticky room to indicate that we're in a change. The code throughout the
    // class can safely handle a null room, so this should be safe to do as a backup.
    this._lastStickyRoom = this._stickyRoom || {};

    // It's possible to have no selected room. In that case, clear the sticky room
    if (!val) {
      if (this._stickyRoom) {
        const stickyRoom = this._stickyRoom.room;
        this._stickyRoom = null; // clear before we go to update the algorithm

        // Lie to the algorithm and re-add the room to the algorithm
        this.handleRoomUpdate(stickyRoom, _models.RoomUpdateCause.NewRoom);
        return;
      }
      return;
    }

    // When we do have a room though, we expect to be able to find it
    let tag = this.roomIdsToTags[val.roomId]?.[0];
    if (!tag) throw new Error(`${val.roomId} does not belong to a tag and cannot be sticky`);

    // We specifically do NOT use the ordered rooms set as it contains the sticky room, which
    // means we'll be off by 1 when the user is switching rooms. This leads to visual jumping
    // when the user is moving south in the list (not north, because of math).
    const tagList = this.getOrderedRoomsWithoutSticky()[tag] || []; // can be null if filtering
    let position = tagList.indexOf(val);

    // We do want to see if a tag change happened though - if this did happen then we'll want
    // to force the position to zero (top) to ensure we can properly handle it.
    const wasSticky = this._lastStickyRoom.room ? this._lastStickyRoom.room.roomId === val.roomId : false;
    if (this._lastStickyRoom.tag && tag !== this._lastStickyRoom.tag && wasSticky && position < 0) {
      _logger.logger.warn(`Sticky room ${val.roomId} changed tags during sticky room handling`);
      position = 0;
    }

    // Sanity check the position to make sure the room is qualified for being sticky
    if (position < 0) throw new Error(`${val.roomId} does not appear to be known and cannot be sticky`);

    // 🐉 Here be dragons.
    // Before we can go through with lying to the underlying algorithm about a room
    // we need to ensure that when we do we're ready for the inevitable sticky room
    // update we'll receive. To prepare for that, we first remove the sticky room and
    // recalculate the state ourselves so that when the underlying algorithm calls for
    // the same thing it no-ops. After we're done calling the algorithm, we'll issue
    // a new update for ourselves.
    const lastStickyRoom = this._stickyRoom;
    this._stickyRoom = null; // clear before we update the algorithm
    this.recalculateStickyRoom();

    // When we do have the room, re-add the old room (if needed) to the algorithm
    // and remove the sticky room from the algorithm. This is so the underlying
    // algorithm doesn't try and confuse itself with the sticky room concept.
    // We don't add the new room if the sticky room isn't changing because that's
    // an easy way to cause duplication. We have to do room ID checks instead of
    // referential checks as the references can differ through the lifecycle.
    if (lastStickyRoom && lastStickyRoom.room && lastStickyRoom.room.roomId !== val.roomId) {
      // Lie to the algorithm and re-add the room to the algorithm
      this.handleRoomUpdate(lastStickyRoom.room, _models.RoomUpdateCause.NewRoom);
    }
    // Lie to the algorithm and remove the room from it's field of view
    this.handleRoomUpdate(val, _models.RoomUpdateCause.RoomRemoved);

    // handleRoomUpdate may have modified this._stickyRoom. Convince the
    // compiler of this fact.
    this._stickyRoom = this.stickyRoomMightBeModified();

    // Check for tag & position changes while we're here. We also check the room to ensure
    // it is still the same room.
    if (this._stickyRoom) {
      if (this._stickyRoom.room !== val) {
        // Check the room IDs just in case
        if (this._stickyRoom.room.roomId === val.roomId) {
          _logger.logger.warn("Sticky room changed references");
        } else {
          throw new Error("Sticky room changed while the sticky room was changing");
        }
      }
      _logger.logger.warn(`Sticky room changed tag & position from ${tag} / ${position} ` + `to ${this._stickyRoom.tag} / ${this._stickyRoom.position}`);
      tag = this._stickyRoom.tag;
      position = this._stickyRoom.position;
    }

    // Now that we're done lying to the algorithm, we need to update our position
    // marker only if the user is moving further down the same list. If they're switching
    // lists, or moving upwards, the position marker will splice in just fine but if
    // they went downwards in the same list we'll be off by 1 due to the shifting rooms.
    if (lastStickyRoom && lastStickyRoom.tag === tag && lastStickyRoom.position <= position) {
      position++;
    }
    this._stickyRoom = {
      room: val,
      position: position,
      tag: tag
    };

    // We update the filtered rooms just in case, as otherwise users will end up visiting
    // a room while filtering and it'll disappear. We don't update the filter earlier in
    // this function simply because we don't have to.
    this.recalculateStickyRoom();
    this.recalculateActiveCallRooms(tag);
    if (lastStickyRoom && lastStickyRoom.tag !== tag) this.recalculateActiveCallRooms(lastStickyRoom.tag);

    // Finally, trigger an update
    if (this.updatesInhibited) return;
    this.emit(LIST_UPDATED_EVENT);
  }

  /**
   * Hack to prevent Typescript claiming this._stickyRoom is always null.
   */
  stickyRoomMightBeModified() {
    return this._stickyRoom;
  }
  initCachedStickyRooms() {
    this._cachedStickyRooms = {};
    for (const tagId of Object.keys(this.cachedRooms)) {
      this._cachedStickyRooms[tagId] = [...this.cachedRooms[tagId]]; // shallow clone
    }
  }

  /**
   * Recalculate the sticky room position. If this is being called in relation to
   * a specific tag being updated, it should be given to this function to optimize
   * the call.
   * @param updatedTag The tag that was updated, if possible.
   */
  recalculateStickyRoom() {
    let updatedTag = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    // 🐉 Here be dragons.
    // This function does far too much for what it should, and is called by many places.
    // Not only is this responsible for ensuring the sticky room is held in place at all
    // times, it is also responsible for ensuring our clone of the cachedRooms is up to
    // date. If either of these desyncs, we see weird behaviour like duplicated rooms,
    // outdated lists, and other nonsensical issues that aren't necessarily obvious.

    if (!this._stickyRoom) {
      // If there's no sticky room, just do nothing useful.
      if (!!this._cachedStickyRooms) {
        // Clear the cache if we won't be needing it
        this._cachedStickyRooms = null;
        if (this.updatesInhibited) return;
        this.emit(LIST_UPDATED_EVENT);
      }
      return;
    }
    if (!this._cachedStickyRooms || !updatedTag) {
      this.initCachedStickyRooms();
    }
    if (updatedTag) {
      // Update the tag indicated by the caller, if possible. This is mostly to ensure
      // our cache is up to date.
      if (this._cachedStickyRooms) {
        this._cachedStickyRooms[updatedTag] = [...this.cachedRooms[updatedTag]]; // shallow clone
      }
    }

    // Now try to insert the sticky room, if we need to.
    // We need to if there's no updated tag (we regenned the whole cache) or if the tag
    // we might have updated from the cache is also our sticky room.
    const sticky = this._stickyRoom;
    if (sticky && (!updatedTag || updatedTag === sticky.tag) && this._cachedStickyRooms) {
      this._cachedStickyRooms[sticky.tag].splice(sticky.position, 0, sticky.room);
    }

    // Finally, trigger an update
    if (this.updatesInhibited) return;
    this.emit(LIST_UPDATED_EVENT);
  }

  /**
   * Recalculate the position of any rooms with calls. If this is being called in
   * relation to a specific tag being updated, it should be given to this function to
   * optimize the call.
   *
   * This expects to be called *after* the sticky rooms are updated, and sticks the
   * room with the currently active call to the top of its tag.
   *
   * @param updatedTag The tag that was updated, if possible.
   */
  recalculateActiveCallRooms() {
    let updatedTag = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    if (!updatedTag) {
      // Assume all tags need updating
      // We're not modifying the map here, so can safely rely on the cached values
      // rather than the explicitly sticky map.
      for (const tagId of Object.keys(this.cachedRooms)) {
        if (!tagId) {
          throw new Error("Unexpected recursion: falsy tag");
        }
        this.recalculateActiveCallRooms(tagId);
      }
      return;
    }
    if (_CallStore.CallStore.instance.activeCalls.size) {
      // We operate on the sticky rooms map
      if (!this._cachedStickyRooms) this.initCachedStickyRooms();
      const rooms = this._cachedStickyRooms[updatedTag];
      const activeRoomIds = new Set([..._CallStore.CallStore.instance.activeCalls].map(call => call.roomId));
      const activeRooms = [];
      const inactiveRooms = [];
      for (const room of rooms) {
        (activeRoomIds.has(room.roomId) ? activeRooms : inactiveRooms).push(room);
      }

      // Stick rooms with active calls to the top
      this._cachedStickyRooms[updatedTag] = [...activeRooms, ...inactiveRooms];
    }
  }

  /**
   * Asks the Algorithm to regenerate all lists, using the tags given
   * as reference for which lists to generate and which way to generate
   * them.
   * @param {ITagSortingMap} tagSortingMap The tags to generate.
   * @param {IListOrderingMap} listOrderingMap The ordering of those tags.
   */
  populateTags(tagSortingMap, listOrderingMap) {
    if (!tagSortingMap) throw new Error(`Sorting map cannot be null or empty`);
    if (!listOrderingMap) throw new Error(`Ordering ma cannot be null or empty`);
    if ((0, _arrays.arrayHasDiff)(Object.keys(tagSortingMap), Object.keys(listOrderingMap))) {
      throw new Error(`Both maps must contain the exact same tags`);
    }
    this.sortAlgorithms = tagSortingMap;
    this.listAlgorithms = listOrderingMap;
    this.algorithms = {};
    for (const tag of Object.keys(tagSortingMap)) {
      this.algorithms[tag] = (0, _listOrdering.getListAlgorithmInstance)(this.listAlgorithms[tag], tag, this.sortAlgorithms[tag]);
    }
    return this.setKnownRooms(this.rooms);
  }

  /**
   * Gets an ordered set of rooms for the all known tags.
   * @returns {ITagMap} The cached list of rooms, ordered,
   * for each tag. May be empty, but never null/undefined.
   */
  getOrderedRooms() {
    return this._cachedStickyRooms || this.cachedRooms;
  }

  /**
   * This returns the same as getOrderedRooms(), but without the sticky room
   * map as it causes issues for sticky room handling (see sticky room handling
   * for more information).
   * @returns {ITagMap} The cached list of rooms, ordered,
   * for each tag. May be empty, but never null/undefined.
   */
  getOrderedRoomsWithoutSticky() {
    return this.cachedRooms;
  }

  /**
   * Seeds the Algorithm with a set of rooms. The algorithm will discard all
   * previously known information and instead use these rooms instead.
   * @param {Room[]} rooms The rooms to force the algorithm to use.
   */
  setKnownRooms(rooms) {
    if ((0, _utils.isNullOrUndefined)(rooms)) throw new Error(`Array of rooms cannot be null`);
    if (!this.sortAlgorithms) throw new Error(`Cannot set known rooms without a tag sorting map`);
    if (!this.updatesInhibited) {
      // We only log this if we're expecting to be publishing updates, which means that
      // this could be an unexpected invocation. If we're inhibited, then this is probably
      // an intentional invocation.
      _logger.logger.warn("Resetting known rooms, initiating regeneration");
    }

    // Before we go any further we need to clear (but remember) the sticky room to
    // avoid accidentally duplicating it in the list.
    const oldStickyRoom = this._stickyRoom;
    if (oldStickyRoom) this.updateStickyRoom(null);
    this.rooms = rooms;
    const newTags = {};
    for (const tagId in this.sortAlgorithms) {
      // noinspection JSUnfilteredForInLoop
      newTags[tagId] = [];
    }

    // If we can avoid doing work, do so.
    if (!rooms.length) {
      this.generateFreshTags(newTags); // just in case it wants to do something
      this.cachedRooms = newTags;
      return;
    }

    // Split out the easy rooms first (leave and invite)
    const memberships = (0, _membership.splitRoomsByMembership)(rooms);
    for (const room of memberships[_membership.EffectiveMembership.Invite]) {
      newTags[_models.DefaultTagID.Invite].push(room);
    }
    for (const room of memberships[_membership.EffectiveMembership.Leave]) {
      newTags[_models.DefaultTagID.Archived].push(room);
    }

    // Now process all the joined rooms. This is a bit more complicated
    for (const room of memberships[_membership.EffectiveMembership.Join]) {
      const tags = this.getTagsOfJoinedRoom(room);
      let inTag = false;
      if (tags.length > 0) {
        for (const tag of tags) {
          if (!(0, _utils.isNullOrUndefined)(newTags[tag])) {
            newTags[tag].push(room);
            inTag = true;
          }
        }
      }
      if (!inTag) {
        if (_DMRoomMap.default.shared().getUserIdForRoomId(room.roomId)) {
          newTags[_models.DefaultTagID.DM].push(room);
        } else {
          newTags[_models.DefaultTagID.Untagged].push(room);
        }
      }
    }
    this.generateFreshTags(newTags);
    this.cachedRooms = newTags; // this recalculates the filtered rooms for us
    this.updateTagsFromCache();

    // Now that we've finished generation, we need to update the sticky room to what
    // it was. It's entirely possible that it changed lists though, so if it did then
    // we also have to update the position of it.
    if (oldStickyRoom && oldStickyRoom.room) {
      this.updateStickyRoom(oldStickyRoom.room);
      if (this._stickyRoom && this._stickyRoom.room) {
        // just in case the update doesn't go according to plan
        if (this._stickyRoom.tag !== oldStickyRoom.tag) {
          // We put the sticky room at the top of the list to treat it as an obvious tag change.
          this._stickyRoom.position = 0;
          this.recalculateStickyRoom(this._stickyRoom.tag);
        }
      }
    }
  }
  getTagsForRoom(room) {
    const tags = [];
    const membership = (0, _membership.getEffectiveMembership)(room.getMyMembership());
    if (membership === _membership.EffectiveMembership.Invite) {
      tags.push(_models.DefaultTagID.Invite);
    } else if (membership === _membership.EffectiveMembership.Leave) {
      tags.push(_models.DefaultTagID.Archived);
    } else {
      tags.push(...this.getTagsOfJoinedRoom(room));
    }
    if (!tags.length) tags.push(_models.DefaultTagID.Untagged);
    return tags;
  }
  getTagsOfJoinedRoom(room) {
    let tags = Object.keys(room.tags || {});
    if (room.name.includes("Twitter bridge bot") || room.name.includes("Discord bridge bot") || room.name.includes("Twilio Puppet Bridge")) {
      tags = [_models.DefaultTagID.Bot];
    }
    if (tags.length === 0) {
      // Check to see if it's a DM if it isn't anything else
      if (_DMRoomMap.default.shared().getUserIdForRoomId(room.roomId)) {
        tags = [_models.DefaultTagID.DM];
      }
    }
    ``;
    return tags;
  }

  /**
   * Updates the roomsToTags map
   */
  updateTagsFromCache() {
    const newMap = {};
    const tags = Object.keys(this.cachedRooms);
    for (const tagId of tags) {
      const rooms = this.cachedRooms[tagId];
      for (const room of rooms) {
        if (!newMap[room.roomId]) newMap[room.roomId] = [];
        newMap[room.roomId].push(tagId);
      }
    }
    this.roomIdsToTags = newMap;
  }

  /**
   * Called when the Algorithm believes a complete regeneration of the existing
   * lists is needed.
   * @param {ITagMap} updatedTagMap The tag map which needs populating. Each tag
   * will already have the rooms which belong to it - they just need ordering. Must
   * be mutated in place.
   */
  generateFreshTags(updatedTagMap) {
    if (!this.algorithms) throw new Error("Not ready: no algorithms to determine tags from");
    for (const tag of Object.keys(updatedTagMap)) {
      const algorithm = this.algorithms[tag];
      if (!algorithm) throw new Error(`No algorithm for ${tag}`);
      algorithm.setRooms(updatedTagMap[tag]);
      updatedTagMap[tag] = algorithm.orderedRooms;
    }
  }

  /**
   * Asks the Algorithm to update its knowledge of a room. For example, when
   * a user tags a room, joins/creates a room, or leaves a room the Algorithm
   * should be told that the room's info might have changed. The Algorithm
   * may no-op this request if no changes are required.
   * @param {Room} room The room which might have affected sorting.
   * @param {RoomUpdateCause} cause The reason for the update being triggered.
   * @returns {Promise<boolean>} A boolean of whether or not getOrderedRooms()
   * should be called after processing.
   */
  handleRoomUpdate(room, cause) {
    if (!this.algorithms) throw new Error("Not ready: no algorithms to determine tags from");

    // Note: check the isSticky against the room ID just in case the reference is wrong
    const isSticky = this._stickyRoom?.room?.roomId === room.roomId;
    if (cause === _models.RoomUpdateCause.NewRoom) {
      const isForLastSticky = this._lastStickyRoom?.room === room;
      const roomTags = this.roomIdsToTags[room.roomId];
      const hasTags = roomTags && roomTags.length > 0;

      // Don't change the cause if the last sticky room is being re-added. If we fail to
      // pass the cause through as NewRoom, we'll fail to lie to the algorithm and thus
      // lose the room.
      if (hasTags && !isForLastSticky) {
        _logger.logger.warn(`${room.roomId} is reportedly new but is already known - assuming TagChange instead`);
        cause = _models.RoomUpdateCause.PossibleTagChange;
      }

      // Check to see if the room is known first
      let knownRoomRef = this.rooms.includes(room);
      if (hasTags && !knownRoomRef) {
        _logger.logger.warn(`${room.roomId} might be a reference change - attempting to update reference`);
        this.rooms = this.rooms.map(r => r.roomId === room.roomId ? room : r);
        knownRoomRef = this.rooms.includes(room);
        if (!knownRoomRef) {
          _logger.logger.warn(`${room.roomId} is still not referenced. It may be sticky.`);
        }
      }

      // If we have tags for a room and don't have the room referenced, something went horribly
      // wrong - the reference should have been updated above.
      if (hasTags && !knownRoomRef && !isSticky) {
        throw new Error(`${room.roomId} is missing from room array but is known - trying to find duplicate`);
      }

      // Like above, update the reference to the sticky room if we need to
      if (hasTags && isSticky && this._stickyRoom) {
        // Go directly in and set the sticky room's new reference, being careful not
        // to trigger a sticky room update ourselves.
        this._stickyRoom.room = room;
      }

      // If after all that we're still a NewRoom update, add the room if applicable.
      // We don't do this for the sticky room (because it causes duplication issues)
      // or if we know about the reference (as it should be replaced).
      if (cause === _models.RoomUpdateCause.NewRoom && !isSticky && !knownRoomRef) {
        this.rooms.push(room);
      }
    }
    let didTagChange = false;
    if (cause === _models.RoomUpdateCause.PossibleTagChange) {
      const oldTags = this.roomIdsToTags[room.roomId] || [];
      const newTags = this.getTagsForRoom(room);
      const diff = (0, _arrays.arrayDiff)(oldTags, newTags);
      if (diff.removed.length > 0 || diff.added.length > 0) {
        for (const rmTag of diff.removed) {
          const algorithm = this.algorithms[rmTag];
          if (!algorithm) throw new Error(`No algorithm for ${rmTag}`);
          algorithm.handleRoomUpdate(room, _models.RoomUpdateCause.RoomRemoved);
          this._cachedRooms[rmTag] = algorithm.orderedRooms;
          this.recalculateStickyRoom(rmTag); // update sticky room to make sure it moves if needed
          this.recalculateActiveCallRooms(rmTag);
        }
        for (const addTag of diff.added) {
          const algorithm = this.algorithms[addTag];
          if (!algorithm) throw new Error(`No algorithm for ${addTag}`);
          algorithm.handleRoomUpdate(room, _models.RoomUpdateCause.NewRoom);
          this._cachedRooms[addTag] = algorithm.orderedRooms;
        }

        // Update the tag map so we don't regen it in a moment
        this.roomIdsToTags[room.roomId] = newTags;
        cause = _models.RoomUpdateCause.Timeline;
        didTagChange = true;
      } else {
        // This is a tag change update and no tags were changed, nothing to do!
        return false;
      }
      if (didTagChange && isSticky) {
        // Manually update the tag for the sticky room without triggering a sticky room
        // update. The update will be handled implicitly by the sticky room handling and
        // requires no changes on our part, if we're in the middle of a sticky room change.
        if (this._lastStickyRoom) {
          this._stickyRoom = {
            room,
            tag: this.roomIdsToTags[room.roomId][0],
            position: 0 // right at the top as it changed tags
          };
        } else {
          // We have to clear the lock as the sticky room change will trigger updates.
          this.setStickyRoom(room);
        }
      }
    }

    // If the update is for a room change which might be the sticky room, prevent it. We
    // need to make sure that the causes (NewRoom and RoomRemoved) are still triggered though
    // as the sticky room relies on this.
    if (cause !== _models.RoomUpdateCause.NewRoom && cause !== _models.RoomUpdateCause.RoomRemoved) {
      if (this.stickyRoom === room) {
        return false;
      }
    }
    if (!this.roomIdsToTags[room.roomId]) {
      if (CAUSES_REQUIRING_ROOM.includes(cause)) {
        return false;
      }

      // Get the tags for the room and populate the cache
      const roomTags = this.getTagsForRoom(room).filter(t => !(0, _utils.isNullOrUndefined)(this.cachedRooms[t]));

      // "This should never happen" condition - we specify DefaultTagID.Untagged in getTagsForRoom(),
      // which means we should *always* have a tag to go off of.
      if (!roomTags.length) throw new Error(`Tags cannot be determined for ${room.roomId}`);
      this.roomIdsToTags[room.roomId] = roomTags;
    }
    const tags = this.roomIdsToTags[room.roomId];
    if (!tags) {
      _logger.logger.warn(`No tags known for "${room.name}" (${room.roomId})`);
      return false;
    }
    let changed = didTagChange;
    for (const tag of tags) {
      const algorithm = this.algorithms[tag];
      if (!algorithm) throw new Error(`No algorithm for ${tag}`);
      algorithm.handleRoomUpdate(room, cause);
      this._cachedRooms[tag] = algorithm.orderedRooms;

      // Flag that we've done something
      this.recalculateStickyRoom(tag); // update sticky room to make sure it appears if needed
      this.recalculateActiveCallRooms(tag);
      changed = true;
    }
    return changed;
  }
}
exports.Algorithm = Algorithm;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfdXRpbHMiLCJyZXF1aXJlIiwiX2V2ZW50cyIsIl9sb2dnZXIiLCJfRE1Sb29tTWFwIiwiX2ludGVyb3BSZXF1aXJlRGVmYXVsdCIsIl9hcnJheXMiLCJfbW9kZWxzIiwiX21lbWJlcnNoaXAiLCJfbGlzdE9yZGVyaW5nIiwiX1Zpc2liaWxpdHlQcm92aWRlciIsIl9DYWxsU3RvcmUiLCJMSVNUX1VQREFURURfRVZFTlQiLCJleHBvcnRzIiwiQ0FVU0VTX1JFUVVJUklOR19ST09NIiwiUm9vbVVwZGF0ZUNhdXNlIiwiVGltZWxpbmUiLCJSZWFkUmVjZWlwdCIsIkFsZ29yaXRobSIsIkV2ZW50RW1pdHRlciIsImNvbnN0cnVjdG9yIiwiYXJndW1lbnRzIiwiX2RlZmluZVByb3BlcnR5MiIsImRlZmF1bHQiLCJyZWNhbGN1bGF0ZVN0aWNreVJvb20iLCJyZWNhbGN1bGF0ZUFjdGl2ZUNhbGxSb29tcyIsInVwZGF0ZXNJbmhpYml0ZWQiLCJlbWl0Iiwic3RhcnQiLCJDYWxsU3RvcmUiLCJpbnN0YW5jZSIsIm9uIiwiQ2FsbFN0b3JlRXZlbnQiLCJBY3RpdmVDYWxscyIsIm9uQWN0aXZlQ2FsbHMiLCJzdG9wIiwib2ZmIiwic3RpY2t5Um9vbSIsIl9zdGlja3lSb29tIiwicm9vbSIsImtub3duUm9vbXMiLCJyb29tcyIsImhhc1RhZ1NvcnRpbmdNYXAiLCJzb3J0QWxnb3JpdGhtcyIsImNhY2hlZFJvb21zIiwidmFsIiwiX2NhY2hlZFJvb21zIiwic2V0U3RpY2t5Um9vbSIsInVwZGF0ZVN0aWNreVJvb20iLCJlIiwibG9nZ2VyIiwid2FybiIsImdldFRhZ1NvcnRpbmciLCJ0YWdJZCIsInNldFRhZ1NvcnRpbmciLCJzb3J0IiwiRXJyb3IiLCJhbGdvcml0aG1zIiwiYWxnb3JpdGhtIiwic2V0U29ydEFsZ29yaXRobSIsIm9yZGVyZWRSb29tcyIsImdldExpc3RPcmRlcmluZyIsImxpc3RBbGdvcml0aG1zIiwic2V0TGlzdE9yZGVyaW5nIiwib3JkZXIiLCJnZXRMaXN0QWxnb3JpdGhtSW5zdGFuY2UiLCJzZXRSb29tcyIsImRvVXBkYXRlU3RpY2t5Um9vbSIsIl9sYXN0U3RpY2t5Um9vbSIsImlzU3BhY2VSb29tIiwiZ2V0TXlNZW1iZXJzaGlwIiwiVmlzaWJpbGl0eVByb3ZpZGVyIiwiaXNSb29tVmlzaWJsZSIsImhhbmRsZVJvb21VcGRhdGUiLCJOZXdSb29tIiwidGFnIiwicm9vbUlkc1RvVGFncyIsInJvb21JZCIsInRhZ0xpc3QiLCJnZXRPcmRlcmVkUm9vbXNXaXRob3V0U3RpY2t5IiwicG9zaXRpb24iLCJpbmRleE9mIiwid2FzU3RpY2t5IiwibGFzdFN0aWNreVJvb20iLCJSb29tUmVtb3ZlZCIsInN0aWNreVJvb21NaWdodEJlTW9kaWZpZWQiLCJpbml0Q2FjaGVkU3RpY2t5Um9vbXMiLCJfY2FjaGVkU3RpY2t5Um9vbXMiLCJPYmplY3QiLCJrZXlzIiwidXBkYXRlZFRhZyIsImxlbmd0aCIsInVuZGVmaW5lZCIsInN0aWNreSIsInNwbGljZSIsImFjdGl2ZUNhbGxzIiwic2l6ZSIsImFjdGl2ZVJvb21JZHMiLCJTZXQiLCJtYXAiLCJjYWxsIiwiYWN0aXZlUm9vbXMiLCJpbmFjdGl2ZVJvb21zIiwiaGFzIiwicHVzaCIsInBvcHVsYXRlVGFncyIsInRhZ1NvcnRpbmdNYXAiLCJsaXN0T3JkZXJpbmdNYXAiLCJhcnJheUhhc0RpZmYiLCJzZXRLbm93blJvb21zIiwiZ2V0T3JkZXJlZFJvb21zIiwiaXNOdWxsT3JVbmRlZmluZWQiLCJvbGRTdGlja3lSb29tIiwibmV3VGFncyIsImdlbmVyYXRlRnJlc2hUYWdzIiwibWVtYmVyc2hpcHMiLCJzcGxpdFJvb21zQnlNZW1iZXJzaGlwIiwiRWZmZWN0aXZlTWVtYmVyc2hpcCIsIkludml0ZSIsIkRlZmF1bHRUYWdJRCIsIkxlYXZlIiwiQXJjaGl2ZWQiLCJKb2luIiwidGFncyIsImdldFRhZ3NPZkpvaW5lZFJvb20iLCJpblRhZyIsIkRNUm9vbU1hcCIsInNoYXJlZCIsImdldFVzZXJJZEZvclJvb21JZCIsIkRNIiwiVW50YWdnZWQiLCJ1cGRhdGVUYWdzRnJvbUNhY2hlIiwiZ2V0VGFnc0ZvclJvb20iLCJtZW1iZXJzaGlwIiwiZ2V0RWZmZWN0aXZlTWVtYmVyc2hpcCIsIm5hbWUiLCJpbmNsdWRlcyIsIkJvdCIsIm5ld01hcCIsInVwZGF0ZWRUYWdNYXAiLCJjYXVzZSIsImlzU3RpY2t5IiwiaXNGb3JMYXN0U3RpY2t5Iiwicm9vbVRhZ3MiLCJoYXNUYWdzIiwiUG9zc2libGVUYWdDaGFuZ2UiLCJrbm93blJvb21SZWYiLCJyIiwiZGlkVGFnQ2hhbmdlIiwib2xkVGFncyIsImRpZmYiLCJhcnJheURpZmYiLCJyZW1vdmVkIiwiYWRkZWQiLCJybVRhZyIsImFkZFRhZyIsImZpbHRlciIsInQiLCJjaGFuZ2VkIl0sInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3N0b3Jlcy9yb29tLWxpc3QvYWxnb3JpdGhtcy9BbGdvcml0aG0udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbkNvcHlyaWdodCAyMDIwLCAyMDIxIFRoZSBNYXRyaXgub3JnIEZvdW5kYXRpb24gQy5JLkMuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuKi9cblxuaW1wb3J0IHsgUm9vbSB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9tb2RlbHMvcm9vbVwiO1xuaW1wb3J0IHsgaXNOdWxsT3JVbmRlZmluZWQgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvdXRpbHNcIjtcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gXCJldmVudHNcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9sb2dnZXJcIjtcblxuaW1wb3J0IERNUm9vbU1hcCBmcm9tIFwiLi4vLi4vLi4vdXRpbHMvRE1Sb29tTWFwXCI7XG5pbXBvcnQgeyBhcnJheURpZmYsIGFycmF5SGFzRGlmZiB9IGZyb20gXCIuLi8uLi8uLi91dGlscy9hcnJheXNcIjtcbmltcG9ydCB7IERlZmF1bHRUYWdJRCwgUm9vbVVwZGF0ZUNhdXNlLCBUYWdJRCB9IGZyb20gXCIuLi9tb2RlbHNcIjtcbmltcG9ydCB7XG4gICAgSUxpc3RPcmRlcmluZ01hcCxcbiAgICBJT3JkZXJpbmdBbGdvcml0aG1NYXAsXG4gICAgSVRhZ01hcCxcbiAgICBJVGFnU29ydGluZ01hcCxcbiAgICBMaXN0QWxnb3JpdGhtLFxuICAgIFNvcnRBbGdvcml0aG0sXG59IGZyb20gXCIuL21vZGVsc1wiO1xuaW1wb3J0IHsgRWZmZWN0aXZlTWVtYmVyc2hpcCwgZ2V0RWZmZWN0aXZlTWVtYmVyc2hpcCwgc3BsaXRSb29tc0J5TWVtYmVyc2hpcCB9IGZyb20gXCIuLi8uLi8uLi91dGlscy9tZW1iZXJzaGlwXCI7XG5pbXBvcnQgeyBPcmRlcmluZ0FsZ29yaXRobSB9IGZyb20gXCIuL2xpc3Qtb3JkZXJpbmcvT3JkZXJpbmdBbGdvcml0aG1cIjtcbmltcG9ydCB7IGdldExpc3RBbGdvcml0aG1JbnN0YW5jZSB9IGZyb20gXCIuL2xpc3Qtb3JkZXJpbmdcIjtcbmltcG9ydCB7IFZpc2liaWxpdHlQcm92aWRlciB9IGZyb20gXCIuLi9maWx0ZXJzL1Zpc2liaWxpdHlQcm92aWRlclwiO1xuaW1wb3J0IHsgQ2FsbFN0b3JlLCBDYWxsU3RvcmVFdmVudCB9IGZyb20gXCIuLi8uLi9DYWxsU3RvcmVcIjtcblxuLyoqXG4gKiBGaXJlZCB3aGVuIHRoZSBBbGdvcml0aG0gaGFzIGRldGVybWluZWQgYSBsaXN0IGhhcyBiZWVuIHVwZGF0ZWQuXG4gKi9cbmV4cG9ydCBjb25zdCBMSVNUX1VQREFURURfRVZFTlQgPSBcImxpc3RfdXBkYXRlZF9ldmVudFwiO1xuXG4vLyBUaGVzZSBhcmUgdGhlIGNhdXNlcyB3aGljaCByZXF1aXJlIGEgcm9vbSB0byBiZSBrbm93biBpbiBvcmRlciBmb3IgdXMgdG8gaGFuZGxlIHRoZW0uIElmXG4vLyBhIGNhdXNlIGluIHRoaXMgbGlzdCBpcyByYWlzZWQgYW5kIHdlIGRvbid0IGtub3cgYWJvdXQgdGhlIHJvb20sIHdlIGRvbid0IGhhbmRsZSB0aGUgdXBkYXRlLlxuLy9cbi8vIE5vdGU6IHRoZXNlIHR5cGljYWxseSBoYXBwZW4gd2hlbiBhIG5ldyByb29tIGlzIGNvbWluZyBpbiwgc3VjaCBhcyB0aGUgdXNlciBjcmVhdGluZyBvclxuLy8gam9pbmluZyB0aGUgcm9vbS4gRm9yIHRoZXNlIGNhc2VzLCB3ZSBuZWVkIHRvIGtub3cgYWJvdXQgdGhlIHJvb20gcHJpb3IgdG8gaGFuZGxpbmcgaXQgb3RoZXJ3aXNlXG4vLyB3ZSdsbCBtYWtlIGJhZCBhc3N1bXB0aW9ucy5cbmNvbnN0IENBVVNFU19SRVFVSVJJTkdfUk9PTSA9IFtSb29tVXBkYXRlQ2F1c2UuVGltZWxpbmUsIFJvb21VcGRhdGVDYXVzZS5SZWFkUmVjZWlwdF07XG5cbmludGVyZmFjZSBJU3RpY2t5Um9vbSB7XG4gICAgcm9vbTogUm9vbTtcbiAgICBwb3NpdGlvbjogbnVtYmVyO1xuICAgIHRhZzogVGFnSUQ7XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIGxpc3Qgb3JkZXJpbmcgYWxnb3JpdGhtLiBUaGlzIGNsYXNzIHdpbGwgdGFrZSBjYXJlIG9mIHRhZ1xuICogbWFuYWdlbWVudCAod2hpY2ggcm9vbXMgZ28gaW4gd2hpY2ggdGFncykgYW5kIGFzayB0aGUgaW1wbGVtZW50YXRpb24gdG9cbiAqIGRlYWwgd2l0aCBvcmRlcmluZyBtZWNoYW5pY3MuXG4gKi9cbmV4cG9ydCBjbGFzcyBBbGdvcml0aG0gZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICAgIHByaXZhdGUgX2NhY2hlZFJvb21zOiBJVGFnTWFwID0ge307XG4gICAgcHJpdmF0ZSBfY2FjaGVkU3RpY2t5Um9vbXM6IElUYWdNYXAgfCBudWxsID0ge307IC8vIGEgY2xvbmUgb2YgdGhlIF9jYWNoZWRSb29tcywgd2l0aCB0aGUgc3RpY2t5IHJvb21cbiAgICBwcml2YXRlIF9zdGlja3lSb29tOiBJU3RpY2t5Um9vbSB8IG51bGwgPSBudWxsO1xuICAgIHByaXZhdGUgX2xhc3RTdGlja3lSb29tOiBJU3RpY2t5Um9vbSB8IG51bGwgPSBudWxsOyAvLyBvbmx5IG5vdC1udWxsIHdoZW4gY2hhbmdpbmcgdGhlIHN0aWNreSByb29tXG4gICAgcHJpdmF0ZSBzb3J0QWxnb3JpdGhtczogSVRhZ1NvcnRpbmdNYXAgfCBudWxsID0gbnVsbDtcbiAgICBwcml2YXRlIGxpc3RBbGdvcml0aG1zOiBJTGlzdE9yZGVyaW5nTWFwIHwgbnVsbCA9IG51bGw7XG4gICAgcHJpdmF0ZSBhbGdvcml0aG1zOiBJT3JkZXJpbmdBbGdvcml0aG1NYXAgfCBudWxsID0gbnVsbDtcbiAgICBwcml2YXRlIHJvb21zOiBSb29tW10gPSBbXTtcbiAgICBwcml2YXRlIHJvb21JZHNUb1RhZ3M6IHtcbiAgICAgICAgW3Jvb21JZDogc3RyaW5nXTogVGFnSURbXTtcbiAgICB9ID0ge307XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdG8gdHJ1ZSB0byBzdXNwZW5kIGVtaXNzaW9ucyBvZiBhbGdvcml0aG0gdXBkYXRlcy5cbiAgICAgKi9cbiAgICBwdWJsaWMgdXBkYXRlc0luaGliaXRlZCA9IGZhbHNlO1xuXG4gICAgcHVibGljIHN0YXJ0KCk6IHZvaWQge1xuICAgICAgICBDYWxsU3RvcmUuaW5zdGFuY2Uub24oQ2FsbFN0b3JlRXZlbnQuQWN0aXZlQ2FsbHMsIHRoaXMub25BY3RpdmVDYWxscyk7XG4gICAgfVxuXG4gICAgcHVibGljIHN0b3AoKTogdm9pZCB7XG4gICAgICAgIENhbGxTdG9yZS5pbnN0YW5jZS5vZmYoQ2FsbFN0b3JlRXZlbnQuQWN0aXZlQ2FsbHMsIHRoaXMub25BY3RpdmVDYWxscyk7XG4gICAgfVxuXG4gICAgcHVibGljIGdldCBzdGlja3lSb29tKCk6IFJvb20gfCBudWxsIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N0aWNreVJvb20gPyB0aGlzLl9zdGlja3lSb29tLnJvb20gOiBudWxsO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXQga25vd25Sb29tcygpOiBSb29tW10ge1xuICAgICAgICByZXR1cm4gdGhpcy5yb29tcztcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0IGhhc1RhZ1NvcnRpbmdNYXAoKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiAhIXRoaXMuc29ydEFsZ29yaXRobXM7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIHNldCBjYWNoZWRSb29tcyh2YWw6IElUYWdNYXApIHtcbiAgICAgICAgdGhpcy5fY2FjaGVkUm9vbXMgPSB2YWw7XG4gICAgICAgIHRoaXMucmVjYWxjdWxhdGVTdGlja3lSb29tKCk7XG4gICAgICAgIHRoaXMucmVjYWxjdWxhdGVBY3RpdmVDYWxsUm9vbXMoKTtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgZ2V0IGNhY2hlZFJvb21zKCk6IElUYWdNYXAge1xuICAgICAgICAvLyDwn5CJIEhlcmUgYmUgZHJhZ29ucy5cbiAgICAgICAgLy8gTm90ZTogdGhpcyBpcyB1c2VkIGJ5IHRoZSB1bmRlcmx5aW5nIGFsZ29yaXRobSBjbGFzc2VzLCBzbyBkb24ndCBtYWtlIGl0IHJldHVyblxuICAgICAgICAvLyB0aGUgc3RpY2t5IHJvb20gY2FjaGUuIElmIGl0IGVuZHMgdXAgcmV0dXJuaW5nIHRoZSBzdGlja3kgcm9vbSBjYWNoZSwgd2UgZW5kIHVwXG4gICAgICAgIC8vIGNvcnJ1cHRpbmcgb3VyIGNhY2hlcyBhbmQgY29uZnVzaW5nIHRoZW0uXG4gICAgICAgIHJldHVybiB0aGlzLl9jYWNoZWRSb29tcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBd2FpdGFibGUgdmVyc2lvbiBvZiB0aGUgc3RpY2t5IHJvb20gc2V0dGVyLlxuICAgICAqIEBwYXJhbSB2YWwgVGhlIG5ldyByb29tIHRvIHN0aWNreS5cbiAgICAgKi9cbiAgICBwdWJsaWMgc2V0U3RpY2t5Um9vbSh2YWw6IFJvb20gfCBudWxsKTogdm9pZCB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVN0aWNreVJvb20odmFsKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgbG9nZ2VyLndhcm4oXCJGYWlsZWQgdG8gdXBkYXRlIHN0aWNreSByb29tXCIsIGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGdldFRhZ1NvcnRpbmcodGFnSWQ6IFRhZ0lEKTogU29ydEFsZ29yaXRobSB8IG51bGwge1xuICAgICAgICBpZiAoIXRoaXMuc29ydEFsZ29yaXRobXMpIHJldHVybiBudWxsO1xuICAgICAgICByZXR1cm4gdGhpcy5zb3J0QWxnb3JpdGhtc1t0YWdJZF07XG4gICAgfVxuXG4gICAgcHVibGljIHNldFRhZ1NvcnRpbmcodGFnSWQ6IFRhZ0lELCBzb3J0OiBTb3J0QWxnb3JpdGhtKTogdm9pZCB7XG4gICAgICAgIGlmICghdGFnSWQpIHRocm93IG5ldyBFcnJvcihcIlRhZyBJRCBtdXN0IGJlIGRlZmluZWRcIik7XG4gICAgICAgIGlmICghc29ydCkgdGhyb3cgbmV3IEVycm9yKFwiQWxnb3JpdGhtIG11c3QgYmUgZGVmaW5lZFwiKTtcbiAgICAgICAgaWYgKCF0aGlzLnNvcnRBbGdvcml0aG1zKSB0aHJvdyBuZXcgRXJyb3IoXCJ0aGlzLnNvcnRBbGdvcml0aG1zIG11c3QgYmUgZGVmaW5lZCBiZWZvcmUgY2FsbGluZyBzZXRUYWdTb3J0aW5nXCIpO1xuICAgICAgICBpZiAoIXRoaXMuYWxnb3JpdGhtcykgdGhyb3cgbmV3IEVycm9yKFwidGhpcy5hbGdvcml0aG1zIG11c3QgYmUgZGVmaW5lZCBiZWZvcmUgY2FsbGluZyBzZXRUYWdTb3J0aW5nXCIpO1xuICAgICAgICB0aGlzLnNvcnRBbGdvcml0aG1zW3RhZ0lkXSA9IHNvcnQ7XG5cbiAgICAgICAgY29uc3QgYWxnb3JpdGhtOiBPcmRlcmluZ0FsZ29yaXRobSA9IHRoaXMuYWxnb3JpdGhtc1t0YWdJZF07XG4gICAgICAgIGFsZ29yaXRobS5zZXRTb3J0QWxnb3JpdGhtKHNvcnQpO1xuICAgICAgICB0aGlzLl9jYWNoZWRSb29tc1t0YWdJZF0gPSBhbGdvcml0aG0ub3JkZXJlZFJvb21zO1xuICAgICAgICB0aGlzLnJlY2FsY3VsYXRlU3RpY2t5Um9vbSh0YWdJZCk7IC8vIHVwZGF0ZSBzdGlja3kgcm9vbSB0byBtYWtlIHN1cmUgaXQgYXBwZWFycyBpZiBuZWVkZWRcbiAgICAgICAgdGhpcy5yZWNhbGN1bGF0ZUFjdGl2ZUNhbGxSb29tcyh0YWdJZCk7XG4gICAgfVxuXG4gICAgcHVibGljIGdldExpc3RPcmRlcmluZyh0YWdJZDogVGFnSUQpOiBMaXN0QWxnb3JpdGhtIHwgbnVsbCB7XG4gICAgICAgIGlmICghdGhpcy5saXN0QWxnb3JpdGhtcykgcmV0dXJuIG51bGw7XG4gICAgICAgIHJldHVybiB0aGlzLmxpc3RBbGdvcml0aG1zW3RhZ0lkXTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc2V0TGlzdE9yZGVyaW5nKHRhZ0lkOiBUYWdJRCwgb3JkZXI6IExpc3RBbGdvcml0aG0pOiB2b2lkIHtcbiAgICAgICAgaWYgKCF0YWdJZCkgdGhyb3cgbmV3IEVycm9yKFwiVGFnIElEIG11c3QgYmUgZGVmaW5lZFwiKTtcbiAgICAgICAgaWYgKCFvcmRlcikgdGhyb3cgbmV3IEVycm9yKFwiQWxnb3JpdGhtIG11c3QgYmUgZGVmaW5lZFwiKTtcbiAgICAgICAgaWYgKCF0aGlzLnNvcnRBbGdvcml0aG1zKSB0aHJvdyBuZXcgRXJyb3IoXCJ0aGlzLnNvcnRBbGdvcml0aG1zIG11c3QgYmUgZGVmaW5lZCBiZWZvcmUgY2FsbGluZyBzZXRMaXN0T3JkZXJpbmdcIik7XG4gICAgICAgIGlmICghdGhpcy5saXN0QWxnb3JpdGhtcykgdGhyb3cgbmV3IEVycm9yKFwidGhpcy5saXN0QWxnb3JpdGhtcyBtdXN0IGJlIGRlZmluZWQgYmVmb3JlIGNhbGxpbmcgc2V0TGlzdE9yZGVyaW5nXCIpO1xuICAgICAgICBpZiAoIXRoaXMuYWxnb3JpdGhtcykgdGhyb3cgbmV3IEVycm9yKFwidGhpcy5hbGdvcml0aG1zIG11c3QgYmUgZGVmaW5lZCBiZWZvcmUgY2FsbGluZyBzZXRMaXN0T3JkZXJpbmdcIik7XG4gICAgICAgIHRoaXMubGlzdEFsZ29yaXRobXNbdGFnSWRdID0gb3JkZXI7XG5cbiAgICAgICAgY29uc3QgYWxnb3JpdGhtID0gZ2V0TGlzdEFsZ29yaXRobUluc3RhbmNlKG9yZGVyLCB0YWdJZCwgdGhpcy5zb3J0QWxnb3JpdGhtc1t0YWdJZF0pO1xuICAgICAgICB0aGlzLmFsZ29yaXRobXNbdGFnSWRdID0gYWxnb3JpdGhtO1xuXG4gICAgICAgIGFsZ29yaXRobS5zZXRSb29tcyh0aGlzLl9jYWNoZWRSb29tc1t0YWdJZF0pO1xuICAgICAgICB0aGlzLl9jYWNoZWRSb29tc1t0YWdJZF0gPSBhbGdvcml0aG0ub3JkZXJlZFJvb21zO1xuICAgICAgICB0aGlzLnJlY2FsY3VsYXRlU3RpY2t5Um9vbSh0YWdJZCk7IC8vIHVwZGF0ZSBzdGlja3kgcm9vbSB0byBtYWtlIHN1cmUgaXQgYXBwZWFycyBpZiBuZWVkZWRcbiAgICAgICAgdGhpcy5yZWNhbGN1bGF0ZUFjdGl2ZUNhbGxSb29tcyh0YWdJZCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSB1cGRhdGVTdGlja3lSb29tKHZhbDogUm9vbSB8IG51bGwpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5kb1VwZGF0ZVN0aWNreVJvb20odmFsKTtcbiAgICAgICAgdGhpcy5fbGFzdFN0aWNreVJvb20gPSBudWxsOyAvLyBjbGVhciB0byBpbmRpY2F0ZSB3ZSdyZSBkb25lIGNoYW5naW5nXG4gICAgfVxuXG4gICAgcHJpdmF0ZSBkb1VwZGF0ZVN0aWNreVJvb20odmFsOiBSb29tIHwgbnVsbCk6IHZvaWQge1xuICAgICAgICBpZiAodmFsPy5pc1NwYWNlUm9vbSgpICYmIHZhbC5nZXRNeU1lbWJlcnNoaXAoKSAhPT0gXCJpbnZpdGVcIikge1xuICAgICAgICAgICAgLy8gbm8tb3Agc3RpY2t5IHJvb21zIGZvciBzcGFjZXMgLSB0aGV5J3JlIGVmZmVjdGl2ZWx5IHZpcnR1YWwgcm9vbXNcbiAgICAgICAgICAgIHZhbCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmFsICYmICFWaXNpYmlsaXR5UHJvdmlkZXIuaW5zdGFuY2UuaXNSb29tVmlzaWJsZSh2YWwpKSB7XG4gICAgICAgICAgICB2YWwgPSBudWxsOyAvLyB0aGUgcm9vbSBpc24ndCB2aXNpYmxlIC0gbGllIHRvIHRoZSByZXN0IG9mIHRoaXMgZnVuY3Rpb25cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNldCB0aGUgbGFzdCBzdGlja3kgcm9vbSB0byBpbmRpY2F0ZSB0aGF0IHdlJ3JlIGluIGEgY2hhbmdlLiBUaGUgY29kZSB0aHJvdWdob3V0IHRoZVxuICAgICAgICAvLyBjbGFzcyBjYW4gc2FmZWx5IGhhbmRsZSBhIG51bGwgcm9vbSwgc28gdGhpcyBzaG91bGQgYmUgc2FmZSB0byBkbyBhcyBhIGJhY2t1cC5cbiAgICAgICAgdGhpcy5fbGFzdFN0aWNreVJvb20gPSB0aGlzLl9zdGlja3lSb29tIHx8IDxJU3RpY2t5Um9vbT57fTtcblxuICAgICAgICAvLyBJdCdzIHBvc3NpYmxlIHRvIGhhdmUgbm8gc2VsZWN0ZWQgcm9vbS4gSW4gdGhhdCBjYXNlLCBjbGVhciB0aGUgc3RpY2t5IHJvb21cbiAgICAgICAgaWYgKCF2YWwpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zdGlja3lSb29tKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RpY2t5Um9vbSA9IHRoaXMuX3N0aWNreVJvb20ucm9vbTtcbiAgICAgICAgICAgICAgICB0aGlzLl9zdGlja3lSb29tID0gbnVsbDsgLy8gY2xlYXIgYmVmb3JlIHdlIGdvIHRvIHVwZGF0ZSB0aGUgYWxnb3JpdGhtXG5cbiAgICAgICAgICAgICAgICAvLyBMaWUgdG8gdGhlIGFsZ29yaXRobSBhbmQgcmUtYWRkIHRoZSByb29tIHRvIHRoZSBhbGdvcml0aG1cbiAgICAgICAgICAgICAgICB0aGlzLmhhbmRsZVJvb21VcGRhdGUoc3RpY2t5Um9vbSwgUm9vbVVwZGF0ZUNhdXNlLk5ld1Jvb20pO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFdoZW4gd2UgZG8gaGF2ZSBhIHJvb20gdGhvdWdoLCB3ZSBleHBlY3QgdG8gYmUgYWJsZSB0byBmaW5kIGl0XG4gICAgICAgIGxldCB0YWcgPSB0aGlzLnJvb21JZHNUb1RhZ3NbdmFsLnJvb21JZF0/LlswXTtcbiAgICAgICAgaWYgKCF0YWcpIHRocm93IG5ldyBFcnJvcihgJHt2YWwucm9vbUlkfSBkb2VzIG5vdCBiZWxvbmcgdG8gYSB0YWcgYW5kIGNhbm5vdCBiZSBzdGlja3lgKTtcblxuICAgICAgICAvLyBXZSBzcGVjaWZpY2FsbHkgZG8gTk9UIHVzZSB0aGUgb3JkZXJlZCByb29tcyBzZXQgYXMgaXQgY29udGFpbnMgdGhlIHN0aWNreSByb29tLCB3aGljaFxuICAgICAgICAvLyBtZWFucyB3ZSdsbCBiZSBvZmYgYnkgMSB3aGVuIHRoZSB1c2VyIGlzIHN3aXRjaGluZyByb29tcy4gVGhpcyBsZWFkcyB0byB2aXN1YWwganVtcGluZ1xuICAgICAgICAvLyB3aGVuIHRoZSB1c2VyIGlzIG1vdmluZyBzb3V0aCBpbiB0aGUgbGlzdCAobm90IG5vcnRoLCBiZWNhdXNlIG9mIG1hdGgpLlxuICAgICAgICBjb25zdCB0YWdMaXN0ID0gdGhpcy5nZXRPcmRlcmVkUm9vbXNXaXRob3V0U3RpY2t5KClbdGFnXSB8fCBbXTsgLy8gY2FuIGJlIG51bGwgaWYgZmlsdGVyaW5nXG4gICAgICAgIGxldCBwb3NpdGlvbiA9IHRhZ0xpc3QuaW5kZXhPZih2YWwpO1xuXG4gICAgICAgIC8vIFdlIGRvIHdhbnQgdG8gc2VlIGlmIGEgdGFnIGNoYW5nZSBoYXBwZW5lZCB0aG91Z2ggLSBpZiB0aGlzIGRpZCBoYXBwZW4gdGhlbiB3ZSdsbCB3YW50XG4gICAgICAgIC8vIHRvIGZvcmNlIHRoZSBwb3NpdGlvbiB0byB6ZXJvICh0b3ApIHRvIGVuc3VyZSB3ZSBjYW4gcHJvcGVybHkgaGFuZGxlIGl0LlxuICAgICAgICBjb25zdCB3YXNTdGlja3kgPSB0aGlzLl9sYXN0U3RpY2t5Um9vbS5yb29tID8gdGhpcy5fbGFzdFN0aWNreVJvb20ucm9vbS5yb29tSWQgPT09IHZhbC5yb29tSWQgOiBmYWxzZTtcbiAgICAgICAgaWYgKHRoaXMuX2xhc3RTdGlja3lSb29tLnRhZyAmJiB0YWcgIT09IHRoaXMuX2xhc3RTdGlja3lSb29tLnRhZyAmJiB3YXNTdGlja3kgJiYgcG9zaXRpb24gPCAwKSB7XG4gICAgICAgICAgICBsb2dnZXIud2FybihgU3RpY2t5IHJvb20gJHt2YWwucm9vbUlkfSBjaGFuZ2VkIHRhZ3MgZHVyaW5nIHN0aWNreSByb29tIGhhbmRsaW5nYCk7XG4gICAgICAgICAgICBwb3NpdGlvbiA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTYW5pdHkgY2hlY2sgdGhlIHBvc2l0aW9uIHRvIG1ha2Ugc3VyZSB0aGUgcm9vbSBpcyBxdWFsaWZpZWQgZm9yIGJlaW5nIHN0aWNreVxuICAgICAgICBpZiAocG9zaXRpb24gPCAwKSB0aHJvdyBuZXcgRXJyb3IoYCR7dmFsLnJvb21JZH0gZG9lcyBub3QgYXBwZWFyIHRvIGJlIGtub3duIGFuZCBjYW5ub3QgYmUgc3RpY2t5YCk7XG5cbiAgICAgICAgLy8g8J+QiSBIZXJlIGJlIGRyYWdvbnMuXG4gICAgICAgIC8vIEJlZm9yZSB3ZSBjYW4gZ28gdGhyb3VnaCB3aXRoIGx5aW5nIHRvIHRoZSB1bmRlcmx5aW5nIGFsZ29yaXRobSBhYm91dCBhIHJvb21cbiAgICAgICAgLy8gd2UgbmVlZCB0byBlbnN1cmUgdGhhdCB3aGVuIHdlIGRvIHdlJ3JlIHJlYWR5IGZvciB0aGUgaW5ldml0YWJsZSBzdGlja3kgcm9vbVxuICAgICAgICAvLyB1cGRhdGUgd2UnbGwgcmVjZWl2ZS4gVG8gcHJlcGFyZSBmb3IgdGhhdCwgd2UgZmlyc3QgcmVtb3ZlIHRoZSBzdGlja3kgcm9vbSBhbmRcbiAgICAgICAgLy8gcmVjYWxjdWxhdGUgdGhlIHN0YXRlIG91cnNlbHZlcyBzbyB0aGF0IHdoZW4gdGhlIHVuZGVybHlpbmcgYWxnb3JpdGhtIGNhbGxzIGZvclxuICAgICAgICAvLyB0aGUgc2FtZSB0aGluZyBpdCBuby1vcHMuIEFmdGVyIHdlJ3JlIGRvbmUgY2FsbGluZyB0aGUgYWxnb3JpdGhtLCB3ZSdsbCBpc3N1ZVxuICAgICAgICAvLyBhIG5ldyB1cGRhdGUgZm9yIG91cnNlbHZlcy5cbiAgICAgICAgY29uc3QgbGFzdFN0aWNreVJvb20gPSB0aGlzLl9zdGlja3lSb29tO1xuICAgICAgICB0aGlzLl9zdGlja3lSb29tID0gbnVsbDsgLy8gY2xlYXIgYmVmb3JlIHdlIHVwZGF0ZSB0aGUgYWxnb3JpdGhtXG4gICAgICAgIHRoaXMucmVjYWxjdWxhdGVTdGlja3lSb29tKCk7XG5cbiAgICAgICAgLy8gV2hlbiB3ZSBkbyBoYXZlIHRoZSByb29tLCByZS1hZGQgdGhlIG9sZCByb29tIChpZiBuZWVkZWQpIHRvIHRoZSBhbGdvcml0aG1cbiAgICAgICAgLy8gYW5kIHJlbW92ZSB0aGUgc3RpY2t5IHJvb20gZnJvbSB0aGUgYWxnb3JpdGhtLiBUaGlzIGlzIHNvIHRoZSB1bmRlcmx5aW5nXG4gICAgICAgIC8vIGFsZ29yaXRobSBkb2Vzbid0IHRyeSBhbmQgY29uZnVzZSBpdHNlbGYgd2l0aCB0aGUgc3RpY2t5IHJvb20gY29uY2VwdC5cbiAgICAgICAgLy8gV2UgZG9uJ3QgYWRkIHRoZSBuZXcgcm9vbSBpZiB0aGUgc3RpY2t5IHJvb20gaXNuJ3QgY2hhbmdpbmcgYmVjYXVzZSB0aGF0J3NcbiAgICAgICAgLy8gYW4gZWFzeSB3YXkgdG8gY2F1c2UgZHVwbGljYXRpb24uIFdlIGhhdmUgdG8gZG8gcm9vbSBJRCBjaGVja3MgaW5zdGVhZCBvZlxuICAgICAgICAvLyByZWZlcmVudGlhbCBjaGVja3MgYXMgdGhlIHJlZmVyZW5jZXMgY2FuIGRpZmZlciB0aHJvdWdoIHRoZSBsaWZlY3ljbGUuXG4gICAgICAgIGlmIChsYXN0U3RpY2t5Um9vbSAmJiBsYXN0U3RpY2t5Um9vbS5yb29tICYmIGxhc3RTdGlja3lSb29tLnJvb20ucm9vbUlkICE9PSB2YWwucm9vbUlkKSB7XG4gICAgICAgICAgICAvLyBMaWUgdG8gdGhlIGFsZ29yaXRobSBhbmQgcmUtYWRkIHRoZSByb29tIHRvIHRoZSBhbGdvcml0aG1cbiAgICAgICAgICAgIHRoaXMuaGFuZGxlUm9vbVVwZGF0ZShsYXN0U3RpY2t5Um9vbS5yb29tLCBSb29tVXBkYXRlQ2F1c2UuTmV3Um9vbSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gTGllIHRvIHRoZSBhbGdvcml0aG0gYW5kIHJlbW92ZSB0aGUgcm9vbSBmcm9tIGl0J3MgZmllbGQgb2Ygdmlld1xuICAgICAgICB0aGlzLmhhbmRsZVJvb21VcGRhdGUodmFsLCBSb29tVXBkYXRlQ2F1c2UuUm9vbVJlbW92ZWQpO1xuXG4gICAgICAgIC8vIGhhbmRsZVJvb21VcGRhdGUgbWF5IGhhdmUgbW9kaWZpZWQgdGhpcy5fc3RpY2t5Um9vbS4gQ29udmluY2UgdGhlXG4gICAgICAgIC8vIGNvbXBpbGVyIG9mIHRoaXMgZmFjdC5cbiAgICAgICAgdGhpcy5fc3RpY2t5Um9vbSA9IHRoaXMuc3RpY2t5Um9vbU1pZ2h0QmVNb2RpZmllZCgpO1xuXG4gICAgICAgIC8vIENoZWNrIGZvciB0YWcgJiBwb3NpdGlvbiBjaGFuZ2VzIHdoaWxlIHdlJ3JlIGhlcmUuIFdlIGFsc28gY2hlY2sgdGhlIHJvb20gdG8gZW5zdXJlXG4gICAgICAgIC8vIGl0IGlzIHN0aWxsIHRoZSBzYW1lIHJvb20uXG4gICAgICAgIGlmICh0aGlzLl9zdGlja3lSb29tKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fc3RpY2t5Um9vbS5yb29tICE9PSB2YWwpIHtcbiAgICAgICAgICAgICAgICAvLyBDaGVjayB0aGUgcm9vbSBJRHMganVzdCBpbiBjYXNlXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX3N0aWNreVJvb20ucm9vbS5yb29tSWQgPT09IHZhbC5yb29tSWQpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLndhcm4oXCJTdGlja3kgcm9vbSBjaGFuZ2VkIHJlZmVyZW5jZXNcIik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiU3RpY2t5IHJvb20gY2hhbmdlZCB3aGlsZSB0aGUgc3RpY2t5IHJvb20gd2FzIGNoYW5naW5nXCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbG9nZ2VyLndhcm4oXG4gICAgICAgICAgICAgICAgYFN0aWNreSByb29tIGNoYW5nZWQgdGFnICYgcG9zaXRpb24gZnJvbSAke3RhZ30gLyAke3Bvc2l0aW9ufSBgICtcbiAgICAgICAgICAgICAgICAgICAgYHRvICR7dGhpcy5fc3RpY2t5Um9vbS50YWd9IC8gJHt0aGlzLl9zdGlja3lSb29tLnBvc2l0aW9ufWAsXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICB0YWcgPSB0aGlzLl9zdGlja3lSb29tLnRhZztcbiAgICAgICAgICAgIHBvc2l0aW9uID0gdGhpcy5fc3RpY2t5Um9vbS5wb3NpdGlvbjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE5vdyB0aGF0IHdlJ3JlIGRvbmUgbHlpbmcgdG8gdGhlIGFsZ29yaXRobSwgd2UgbmVlZCB0byB1cGRhdGUgb3VyIHBvc2l0aW9uXG4gICAgICAgIC8vIG1hcmtlciBvbmx5IGlmIHRoZSB1c2VyIGlzIG1vdmluZyBmdXJ0aGVyIGRvd24gdGhlIHNhbWUgbGlzdC4gSWYgdGhleSdyZSBzd2l0Y2hpbmdcbiAgICAgICAgLy8gbGlzdHMsIG9yIG1vdmluZyB1cHdhcmRzLCB0aGUgcG9zaXRpb24gbWFya2VyIHdpbGwgc3BsaWNlIGluIGp1c3QgZmluZSBidXQgaWZcbiAgICAgICAgLy8gdGhleSB3ZW50IGRvd253YXJkcyBpbiB0aGUgc2FtZSBsaXN0IHdlJ2xsIGJlIG9mZiBieSAxIGR1ZSB0byB0aGUgc2hpZnRpbmcgcm9vbXMuXG4gICAgICAgIGlmIChsYXN0U3RpY2t5Um9vbSAmJiBsYXN0U3RpY2t5Um9vbS50YWcgPT09IHRhZyAmJiBsYXN0U3RpY2t5Um9vbS5wb3NpdGlvbiA8PSBwb3NpdGlvbikge1xuICAgICAgICAgICAgcG9zaXRpb24rKztcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3N0aWNreVJvb20gPSB7XG4gICAgICAgICAgICByb29tOiB2YWwsXG4gICAgICAgICAgICBwb3NpdGlvbjogcG9zaXRpb24sXG4gICAgICAgICAgICB0YWc6IHRhZyxcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBXZSB1cGRhdGUgdGhlIGZpbHRlcmVkIHJvb21zIGp1c3QgaW4gY2FzZSwgYXMgb3RoZXJ3aXNlIHVzZXJzIHdpbGwgZW5kIHVwIHZpc2l0aW5nXG4gICAgICAgIC8vIGEgcm9vbSB3aGlsZSBmaWx0ZXJpbmcgYW5kIGl0J2xsIGRpc2FwcGVhci4gV2UgZG9uJ3QgdXBkYXRlIHRoZSBmaWx0ZXIgZWFybGllciBpblxuICAgICAgICAvLyB0aGlzIGZ1bmN0aW9uIHNpbXBseSBiZWNhdXNlIHdlIGRvbid0IGhhdmUgdG8uXG4gICAgICAgIHRoaXMucmVjYWxjdWxhdGVTdGlja3lSb29tKCk7XG4gICAgICAgIHRoaXMucmVjYWxjdWxhdGVBY3RpdmVDYWxsUm9vbXModGFnKTtcbiAgICAgICAgaWYgKGxhc3RTdGlja3lSb29tICYmIGxhc3RTdGlja3lSb29tLnRhZyAhPT0gdGFnKSB0aGlzLnJlY2FsY3VsYXRlQWN0aXZlQ2FsbFJvb21zKGxhc3RTdGlja3lSb29tLnRhZyk7XG5cbiAgICAgICAgLy8gRmluYWxseSwgdHJpZ2dlciBhbiB1cGRhdGVcbiAgICAgICAgaWYgKHRoaXMudXBkYXRlc0luaGliaXRlZCkgcmV0dXJuO1xuICAgICAgICB0aGlzLmVtaXQoTElTVF9VUERBVEVEX0VWRU5UKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBIYWNrIHRvIHByZXZlbnQgVHlwZXNjcmlwdCBjbGFpbWluZyB0aGlzLl9zdGlja3lSb29tIGlzIGFsd2F5cyBudWxsLlxuICAgICAqL1xuICAgIHByaXZhdGUgc3RpY2t5Um9vbU1pZ2h0QmVNb2RpZmllZCgpOiBJU3RpY2t5Um9vbSB8IG51bGwge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3RpY2t5Um9vbTtcbiAgICB9XG5cbiAgICBwcml2YXRlIG9uQWN0aXZlQ2FsbHMgPSAoKTogdm9pZCA9PiB7XG4gICAgICAgIC8vIEluIGNhc2Ugd2UncmUgdW5zdGlja2luZyBhIHJvb20sIHNvcnQgaXQgYmFjayBpbnRvIG5hdHVyYWwgb3JkZXJcbiAgICAgICAgdGhpcy5yZWNhbGN1bGF0ZVN0aWNreVJvb20oKTtcblxuICAgICAgICAvLyBVcGRhdGUgdGhlIHN0aWNraW5lc3Mgb2Ygcm9vbXMgd2l0aCBjYWxsc1xuICAgICAgICB0aGlzLnJlY2FsY3VsYXRlQWN0aXZlQ2FsbFJvb21zKCk7XG5cbiAgICAgICAgaWYgKHRoaXMudXBkYXRlc0luaGliaXRlZCkgcmV0dXJuO1xuICAgICAgICAvLyBUaGlzIGlzbid0IGluIHJlc3BvbnNlIHRvIGFueSBwYXJ0aWN1bGFyIFJvb21MaXN0U3RvcmUgdXBkYXRlLFxuICAgICAgICAvLyBzbyBub3RpZnkgdGhlIHN0b3JlIHRoYXQgaXQgbmVlZHMgdG8gZm9yY2UtdXBkYXRlXG4gICAgICAgIHRoaXMuZW1pdChMSVNUX1VQREFURURfRVZFTlQsIHRydWUpO1xuICAgIH07XG5cbiAgICBwcml2YXRlIGluaXRDYWNoZWRTdGlja3lSb29tcygpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5fY2FjaGVkU3RpY2t5Um9vbXMgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCB0YWdJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmNhY2hlZFJvb21zKSkge1xuICAgICAgICAgICAgdGhpcy5fY2FjaGVkU3RpY2t5Um9vbXNbdGFnSWRdID0gWy4uLnRoaXMuY2FjaGVkUm9vbXNbdGFnSWRdXTsgLy8gc2hhbGxvdyBjbG9uZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVjYWxjdWxhdGUgdGhlIHN0aWNreSByb29tIHBvc2l0aW9uLiBJZiB0aGlzIGlzIGJlaW5nIGNhbGxlZCBpbiByZWxhdGlvbiB0b1xuICAgICAqIGEgc3BlY2lmaWMgdGFnIGJlaW5nIHVwZGF0ZWQsIGl0IHNob3VsZCBiZSBnaXZlbiB0byB0aGlzIGZ1bmN0aW9uIHRvIG9wdGltaXplXG4gICAgICogdGhlIGNhbGwuXG4gICAgICogQHBhcmFtIHVwZGF0ZWRUYWcgVGhlIHRhZyB0aGF0IHdhcyB1cGRhdGVkLCBpZiBwb3NzaWJsZS5cbiAgICAgKi9cbiAgICBwcm90ZWN0ZWQgcmVjYWxjdWxhdGVTdGlja3lSb29tKHVwZGF0ZWRUYWc6IFRhZ0lEIHwgbnVsbCA9IG51bGwpOiB2b2lkIHtcbiAgICAgICAgLy8g8J+QiSBIZXJlIGJlIGRyYWdvbnMuXG4gICAgICAgIC8vIFRoaXMgZnVuY3Rpb24gZG9lcyBmYXIgdG9vIG11Y2ggZm9yIHdoYXQgaXQgc2hvdWxkLCBhbmQgaXMgY2FsbGVkIGJ5IG1hbnkgcGxhY2VzLlxuICAgICAgICAvLyBOb3Qgb25seSBpcyB0aGlzIHJlc3BvbnNpYmxlIGZvciBlbnN1cmluZyB0aGUgc3RpY2t5IHJvb20gaXMgaGVsZCBpbiBwbGFjZSBhdCBhbGxcbiAgICAgICAgLy8gdGltZXMsIGl0IGlzIGFsc28gcmVzcG9uc2libGUgZm9yIGVuc3VyaW5nIG91ciBjbG9uZSBvZiB0aGUgY2FjaGVkUm9vbXMgaXMgdXAgdG9cbiAgICAgICAgLy8gZGF0ZS4gSWYgZWl0aGVyIG9mIHRoZXNlIGRlc3luY3MsIHdlIHNlZSB3ZWlyZCBiZWhhdmlvdXIgbGlrZSBkdXBsaWNhdGVkIHJvb21zLFxuICAgICAgICAvLyBvdXRkYXRlZCBsaXN0cywgYW5kIG90aGVyIG5vbnNlbnNpY2FsIGlzc3VlcyB0aGF0IGFyZW4ndCBuZWNlc3NhcmlseSBvYnZpb3VzLlxuXG4gICAgICAgIGlmICghdGhpcy5fc3RpY2t5Um9vbSkge1xuICAgICAgICAgICAgLy8gSWYgdGhlcmUncyBubyBzdGlja3kgcm9vbSwganVzdCBkbyBub3RoaW5nIHVzZWZ1bC5cbiAgICAgICAgICAgIGlmICghIXRoaXMuX2NhY2hlZFN0aWNreVJvb21zKSB7XG4gICAgICAgICAgICAgICAgLy8gQ2xlYXIgdGhlIGNhY2hlIGlmIHdlIHdvbid0IGJlIG5lZWRpbmcgaXRcbiAgICAgICAgICAgICAgICB0aGlzLl9jYWNoZWRTdGlja3lSb29tcyA9IG51bGw7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMudXBkYXRlc0luaGliaXRlZCkgcmV0dXJuO1xuICAgICAgICAgICAgICAgIHRoaXMuZW1pdChMSVNUX1VQREFURURfRVZFTlQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLl9jYWNoZWRTdGlja3lSb29tcyB8fCAhdXBkYXRlZFRhZykge1xuICAgICAgICAgICAgdGhpcy5pbml0Q2FjaGVkU3RpY2t5Um9vbXMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh1cGRhdGVkVGFnKSB7XG4gICAgICAgICAgICAvLyBVcGRhdGUgdGhlIHRhZyBpbmRpY2F0ZWQgYnkgdGhlIGNhbGxlciwgaWYgcG9zc2libGUuIFRoaXMgaXMgbW9zdGx5IHRvIGVuc3VyZVxuICAgICAgICAgICAgLy8gb3VyIGNhY2hlIGlzIHVwIHRvIGRhdGUuXG4gICAgICAgICAgICBpZiAodGhpcy5fY2FjaGVkU3RpY2t5Um9vbXMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9jYWNoZWRTdGlja3lSb29tc1t1cGRhdGVkVGFnXSA9IFsuLi50aGlzLmNhY2hlZFJvb21zW3VwZGF0ZWRUYWddXTsgLy8gc2hhbGxvdyBjbG9uZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gTm93IHRyeSB0byBpbnNlcnQgdGhlIHN0aWNreSByb29tLCBpZiB3ZSBuZWVkIHRvLlxuICAgICAgICAvLyBXZSBuZWVkIHRvIGlmIHRoZXJlJ3Mgbm8gdXBkYXRlZCB0YWcgKHdlIHJlZ2VubmVkIHRoZSB3aG9sZSBjYWNoZSkgb3IgaWYgdGhlIHRhZ1xuICAgICAgICAvLyB3ZSBtaWdodCBoYXZlIHVwZGF0ZWQgZnJvbSB0aGUgY2FjaGUgaXMgYWxzbyBvdXIgc3RpY2t5IHJvb20uXG4gICAgICAgIGNvbnN0IHN0aWNreSA9IHRoaXMuX3N0aWNreVJvb207XG4gICAgICAgIGlmIChzdGlja3kgJiYgKCF1cGRhdGVkVGFnIHx8IHVwZGF0ZWRUYWcgPT09IHN0aWNreS50YWcpICYmIHRoaXMuX2NhY2hlZFN0aWNreVJvb21zKSB7XG4gICAgICAgICAgICB0aGlzLl9jYWNoZWRTdGlja3lSb29tc1tzdGlja3kudGFnXS5zcGxpY2Uoc3RpY2t5LnBvc2l0aW9uLCAwLCBzdGlja3kucm9vbSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGaW5hbGx5LCB0cmlnZ2VyIGFuIHVwZGF0ZVxuICAgICAgICBpZiAodGhpcy51cGRhdGVzSW5oaWJpdGVkKSByZXR1cm47XG4gICAgICAgIHRoaXMuZW1pdChMSVNUX1VQREFURURfRVZFTlQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlY2FsY3VsYXRlIHRoZSBwb3NpdGlvbiBvZiBhbnkgcm9vbXMgd2l0aCBjYWxscy4gSWYgdGhpcyBpcyBiZWluZyBjYWxsZWQgaW5cbiAgICAgKiByZWxhdGlvbiB0byBhIHNwZWNpZmljIHRhZyBiZWluZyB1cGRhdGVkLCBpdCBzaG91bGQgYmUgZ2l2ZW4gdG8gdGhpcyBmdW5jdGlvbiB0b1xuICAgICAqIG9wdGltaXplIHRoZSBjYWxsLlxuICAgICAqXG4gICAgICogVGhpcyBleHBlY3RzIHRvIGJlIGNhbGxlZCAqYWZ0ZXIqIHRoZSBzdGlja3kgcm9vbXMgYXJlIHVwZGF0ZWQsIGFuZCBzdGlja3MgdGhlXG4gICAgICogcm9vbSB3aXRoIHRoZSBjdXJyZW50bHkgYWN0aXZlIGNhbGwgdG8gdGhlIHRvcCBvZiBpdHMgdGFnLlxuICAgICAqXG4gICAgICogQHBhcmFtIHVwZGF0ZWRUYWcgVGhlIHRhZyB0aGF0IHdhcyB1cGRhdGVkLCBpZiBwb3NzaWJsZS5cbiAgICAgKi9cbiAgICBwcm90ZWN0ZWQgcmVjYWxjdWxhdGVBY3RpdmVDYWxsUm9vbXModXBkYXRlZFRhZzogVGFnSUQgfCBudWxsID0gbnVsbCk6IHZvaWQge1xuICAgICAgICBpZiAoIXVwZGF0ZWRUYWcpIHtcbiAgICAgICAgICAgIC8vIEFzc3VtZSBhbGwgdGFncyBuZWVkIHVwZGF0aW5nXG4gICAgICAgICAgICAvLyBXZSdyZSBub3QgbW9kaWZ5aW5nIHRoZSBtYXAgaGVyZSwgc28gY2FuIHNhZmVseSByZWx5IG9uIHRoZSBjYWNoZWQgdmFsdWVzXG4gICAgICAgICAgICAvLyByYXRoZXIgdGhhbiB0aGUgZXhwbGljaXRseSBzdGlja3kgbWFwLlxuICAgICAgICAgICAgZm9yIChjb25zdCB0YWdJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmNhY2hlZFJvb21zKSkge1xuICAgICAgICAgICAgICAgIGlmICghdGFnSWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5leHBlY3RlZCByZWN1cnNpb246IGZhbHN5IHRhZ1wiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5yZWNhbGN1bGF0ZUFjdGl2ZUNhbGxSb29tcyh0YWdJZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoQ2FsbFN0b3JlLmluc3RhbmNlLmFjdGl2ZUNhbGxzLnNpemUpIHtcbiAgICAgICAgICAgIC8vIFdlIG9wZXJhdGUgb24gdGhlIHN0aWNreSByb29tcyBtYXBcbiAgICAgICAgICAgIGlmICghdGhpcy5fY2FjaGVkU3RpY2t5Um9vbXMpIHRoaXMuaW5pdENhY2hlZFN0aWNreVJvb21zKCk7XG4gICAgICAgICAgICBjb25zdCByb29tcyA9IHRoaXMuX2NhY2hlZFN0aWNreVJvb21zIVt1cGRhdGVkVGFnXTtcblxuICAgICAgICAgICAgY29uc3QgYWN0aXZlUm9vbUlkcyA9IG5ldyBTZXQoWy4uLkNhbGxTdG9yZS5pbnN0YW5jZS5hY3RpdmVDYWxsc10ubWFwKChjYWxsKSA9PiBjYWxsLnJvb21JZCkpO1xuICAgICAgICAgICAgY29uc3QgYWN0aXZlUm9vbXM6IFJvb21bXSA9IFtdO1xuICAgICAgICAgICAgY29uc3QgaW5hY3RpdmVSb29tczogUm9vbVtdID0gW107XG5cbiAgICAgICAgICAgIGZvciAoY29uc3Qgcm9vbSBvZiByb29tcykge1xuICAgICAgICAgICAgICAgIChhY3RpdmVSb29tSWRzLmhhcyhyb29tLnJvb21JZCkgPyBhY3RpdmVSb29tcyA6IGluYWN0aXZlUm9vbXMpLnB1c2gocm9vbSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFN0aWNrIHJvb21zIHdpdGggYWN0aXZlIGNhbGxzIHRvIHRoZSB0b3BcbiAgICAgICAgICAgIHRoaXMuX2NhY2hlZFN0aWNreVJvb21zIVt1cGRhdGVkVGFnXSA9IFsuLi5hY3RpdmVSb29tcywgLi4uaW5hY3RpdmVSb29tc107XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBc2tzIHRoZSBBbGdvcml0aG0gdG8gcmVnZW5lcmF0ZSBhbGwgbGlzdHMsIHVzaW5nIHRoZSB0YWdzIGdpdmVuXG4gICAgICogYXMgcmVmZXJlbmNlIGZvciB3aGljaCBsaXN0cyB0byBnZW5lcmF0ZSBhbmQgd2hpY2ggd2F5IHRvIGdlbmVyYXRlXG4gICAgICogdGhlbS5cbiAgICAgKiBAcGFyYW0ge0lUYWdTb3J0aW5nTWFwfSB0YWdTb3J0aW5nTWFwIFRoZSB0YWdzIHRvIGdlbmVyYXRlLlxuICAgICAqIEBwYXJhbSB7SUxpc3RPcmRlcmluZ01hcH0gbGlzdE9yZGVyaW5nTWFwIFRoZSBvcmRlcmluZyBvZiB0aG9zZSB0YWdzLlxuICAgICAqL1xuICAgIHB1YmxpYyBwb3B1bGF0ZVRhZ3ModGFnU29ydGluZ01hcDogSVRhZ1NvcnRpbmdNYXAsIGxpc3RPcmRlcmluZ01hcDogSUxpc3RPcmRlcmluZ01hcCk6IHZvaWQge1xuICAgICAgICBpZiAoIXRhZ1NvcnRpbmdNYXApIHRocm93IG5ldyBFcnJvcihgU29ydGluZyBtYXAgY2Fubm90IGJlIG51bGwgb3IgZW1wdHlgKTtcbiAgICAgICAgaWYgKCFsaXN0T3JkZXJpbmdNYXApIHRocm93IG5ldyBFcnJvcihgT3JkZXJpbmcgbWEgY2Fubm90IGJlIG51bGwgb3IgZW1wdHlgKTtcbiAgICAgICAgaWYgKGFycmF5SGFzRGlmZihPYmplY3Qua2V5cyh0YWdTb3J0aW5nTWFwKSwgT2JqZWN0LmtleXMobGlzdE9yZGVyaW5nTWFwKSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQm90aCBtYXBzIG11c3QgY29udGFpbiB0aGUgZXhhY3Qgc2FtZSB0YWdzYCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zb3J0QWxnb3JpdGhtcyA9IHRhZ1NvcnRpbmdNYXA7XG4gICAgICAgIHRoaXMubGlzdEFsZ29yaXRobXMgPSBsaXN0T3JkZXJpbmdNYXA7XG4gICAgICAgIHRoaXMuYWxnb3JpdGhtcyA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IHRhZyBvZiBPYmplY3Qua2V5cyh0YWdTb3J0aW5nTWFwKSkge1xuICAgICAgICAgICAgdGhpcy5hbGdvcml0aG1zW3RhZ10gPSBnZXRMaXN0QWxnb3JpdGhtSW5zdGFuY2UodGhpcy5saXN0QWxnb3JpdGhtc1t0YWddLCB0YWcsIHRoaXMuc29ydEFsZ29yaXRobXNbdGFnXSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuc2V0S25vd25Sb29tcyh0aGlzLnJvb21zKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIGFuIG9yZGVyZWQgc2V0IG9mIHJvb21zIGZvciB0aGUgYWxsIGtub3duIHRhZ3MuXG4gICAgICogQHJldHVybnMge0lUYWdNYXB9IFRoZSBjYWNoZWQgbGlzdCBvZiByb29tcywgb3JkZXJlZCxcbiAgICAgKiBmb3IgZWFjaCB0YWcuIE1heSBiZSBlbXB0eSwgYnV0IG5ldmVyIG51bGwvdW5kZWZpbmVkLlxuICAgICAqL1xuICAgIHB1YmxpYyBnZXRPcmRlcmVkUm9vbXMoKTogSVRhZ01hcCB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYWNoZWRTdGlja3lSb29tcyB8fCB0aGlzLmNhY2hlZFJvb21zO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoaXMgcmV0dXJucyB0aGUgc2FtZSBhcyBnZXRPcmRlcmVkUm9vbXMoKSwgYnV0IHdpdGhvdXQgdGhlIHN0aWNreSByb29tXG4gICAgICogbWFwIGFzIGl0IGNhdXNlcyBpc3N1ZXMgZm9yIHN0aWNreSByb29tIGhhbmRsaW5nIChzZWUgc3RpY2t5IHJvb20gaGFuZGxpbmdcbiAgICAgKiBmb3IgbW9yZSBpbmZvcm1hdGlvbikuXG4gICAgICogQHJldHVybnMge0lUYWdNYXB9IFRoZSBjYWNoZWQgbGlzdCBvZiByb29tcywgb3JkZXJlZCxcbiAgICAgKiBmb3IgZWFjaCB0YWcuIE1heSBiZSBlbXB0eSwgYnV0IG5ldmVyIG51bGwvdW5kZWZpbmVkLlxuICAgICAqL1xuICAgIHByaXZhdGUgZ2V0T3JkZXJlZFJvb21zV2l0aG91dFN0aWNreSgpOiBJVGFnTWFwIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY2FjaGVkUm9vbXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2VlZHMgdGhlIEFsZ29yaXRobSB3aXRoIGEgc2V0IG9mIHJvb21zLiBUaGUgYWxnb3JpdGhtIHdpbGwgZGlzY2FyZCBhbGxcbiAgICAgKiBwcmV2aW91c2x5IGtub3duIGluZm9ybWF0aW9uIGFuZCBpbnN0ZWFkIHVzZSB0aGVzZSByb29tcyBpbnN0ZWFkLlxuICAgICAqIEBwYXJhbSB7Um9vbVtdfSByb29tcyBUaGUgcm9vbXMgdG8gZm9yY2UgdGhlIGFsZ29yaXRobSB0byB1c2UuXG4gICAgICovXG4gICAgcHVibGljIHNldEtub3duUm9vbXMocm9vbXM6IFJvb21bXSk6IHZvaWQge1xuICAgICAgICBpZiAoaXNOdWxsT3JVbmRlZmluZWQocm9vbXMpKSB0aHJvdyBuZXcgRXJyb3IoYEFycmF5IG9mIHJvb21zIGNhbm5vdCBiZSBudWxsYCk7XG4gICAgICAgIGlmICghdGhpcy5zb3J0QWxnb3JpdGhtcykgdGhyb3cgbmV3IEVycm9yKGBDYW5ub3Qgc2V0IGtub3duIHJvb21zIHdpdGhvdXQgYSB0YWcgc29ydGluZyBtYXBgKTtcblxuICAgICAgICBpZiAoIXRoaXMudXBkYXRlc0luaGliaXRlZCkge1xuICAgICAgICAgICAgLy8gV2Ugb25seSBsb2cgdGhpcyBpZiB3ZSdyZSBleHBlY3RpbmcgdG8gYmUgcHVibGlzaGluZyB1cGRhdGVzLCB3aGljaCBtZWFucyB0aGF0XG4gICAgICAgICAgICAvLyB0aGlzIGNvdWxkIGJlIGFuIHVuZXhwZWN0ZWQgaW52b2NhdGlvbi4gSWYgd2UncmUgaW5oaWJpdGVkLCB0aGVuIHRoaXMgaXMgcHJvYmFibHlcbiAgICAgICAgICAgIC8vIGFuIGludGVudGlvbmFsIGludm9jYXRpb24uXG4gICAgICAgICAgICBsb2dnZXIud2FybihcIlJlc2V0dGluZyBrbm93biByb29tcywgaW5pdGlhdGluZyByZWdlbmVyYXRpb25cIik7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEJlZm9yZSB3ZSBnbyBhbnkgZnVydGhlciB3ZSBuZWVkIHRvIGNsZWFyIChidXQgcmVtZW1iZXIpIHRoZSBzdGlja3kgcm9vbSB0b1xuICAgICAgICAvLyBhdm9pZCBhY2NpZGVudGFsbHkgZHVwbGljYXRpbmcgaXQgaW4gdGhlIGxpc3QuXG4gICAgICAgIGNvbnN0IG9sZFN0aWNreVJvb20gPSB0aGlzLl9zdGlja3lSb29tO1xuICAgICAgICBpZiAob2xkU3RpY2t5Um9vbSkgdGhpcy51cGRhdGVTdGlja3lSb29tKG51bGwpO1xuXG4gICAgICAgIHRoaXMucm9vbXMgPSByb29tcztcblxuICAgICAgICBjb25zdCBuZXdUYWdzOiBJVGFnTWFwID0ge307XG4gICAgICAgIGZvciAoY29uc3QgdGFnSWQgaW4gdGhpcy5zb3J0QWxnb3JpdGhtcykge1xuICAgICAgICAgICAgLy8gbm9pbnNwZWN0aW9uIEpTVW5maWx0ZXJlZEZvckluTG9vcFxuICAgICAgICAgICAgbmV3VGFnc1t0YWdJZF0gPSBbXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIHdlIGNhbiBhdm9pZCBkb2luZyB3b3JrLCBkbyBzby5cbiAgICAgICAgaWYgKCFyb29tcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMuZ2VuZXJhdGVGcmVzaFRhZ3MobmV3VGFncyk7IC8vIGp1c3QgaW4gY2FzZSBpdCB3YW50cyB0byBkbyBzb21ldGhpbmdcbiAgICAgICAgICAgIHRoaXMuY2FjaGVkUm9vbXMgPSBuZXdUYWdzO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3BsaXQgb3V0IHRoZSBlYXN5IHJvb21zIGZpcnN0IChsZWF2ZSBhbmQgaW52aXRlKVxuICAgICAgICBjb25zdCBtZW1iZXJzaGlwcyA9IHNwbGl0Um9vbXNCeU1lbWJlcnNoaXAocm9vbXMpO1xuXG4gICAgICAgIGZvciAoY29uc3Qgcm9vbSBvZiBtZW1iZXJzaGlwc1tFZmZlY3RpdmVNZW1iZXJzaGlwLkludml0ZV0pIHtcbiAgICAgICAgICAgIG5ld1RhZ3NbRGVmYXVsdFRhZ0lELkludml0ZV0ucHVzaChyb29tKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IHJvb20gb2YgbWVtYmVyc2hpcHNbRWZmZWN0aXZlTWVtYmVyc2hpcC5MZWF2ZV0pIHtcbiAgICAgICAgICAgIG5ld1RhZ3NbRGVmYXVsdFRhZ0lELkFyY2hpdmVkXS5wdXNoKHJvb20pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gTm93IHByb2Nlc3MgYWxsIHRoZSBqb2luZWQgcm9vbXMuIFRoaXMgaXMgYSBiaXQgbW9yZSBjb21wbGljYXRlZFxuICAgICAgICBmb3IgKGNvbnN0IHJvb20gb2YgbWVtYmVyc2hpcHNbRWZmZWN0aXZlTWVtYmVyc2hpcC5Kb2luXSkge1xuICAgICAgICAgICAgY29uc3QgdGFncyA9IHRoaXMuZ2V0VGFnc09mSm9pbmVkUm9vbShyb29tKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbGV0IGluVGFnID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAodGFncy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCB0YWcgb2YgdGFncykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWlzTnVsbE9yVW5kZWZpbmVkKG5ld1RhZ3NbdGFnXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld1RhZ3NbdGFnXS5wdXNoKHJvb20pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5UYWcgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWluVGFnKSB7XG4gICAgICAgICAgICAgICAgaWYgKERNUm9vbU1hcC5zaGFyZWQoKS5nZXRVc2VySWRGb3JSb29tSWQocm9vbS5yb29tSWQpKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld1RhZ3NbRGVmYXVsdFRhZ0lELkRNXS5wdXNoKHJvb20pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld1RhZ3NbRGVmYXVsdFRhZ0lELlVudGFnZ2VkXS5wdXNoKHJvb20pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZ2VuZXJhdGVGcmVzaFRhZ3MobmV3VGFncyk7XG5cbiAgICAgICAgdGhpcy5jYWNoZWRSb29tcyA9IG5ld1RhZ3M7IC8vIHRoaXMgcmVjYWxjdWxhdGVzIHRoZSBmaWx0ZXJlZCByb29tcyBmb3IgdXNcbiAgICAgICAgdGhpcy51cGRhdGVUYWdzRnJvbUNhY2hlKCk7XG5cbiAgICAgICAgLy8gTm93IHRoYXQgd2UndmUgZmluaXNoZWQgZ2VuZXJhdGlvbiwgd2UgbmVlZCB0byB1cGRhdGUgdGhlIHN0aWNreSByb29tIHRvIHdoYXRcbiAgICAgICAgLy8gaXQgd2FzLiBJdCdzIGVudGlyZWx5IHBvc3NpYmxlIHRoYXQgaXQgY2hhbmdlZCBsaXN0cyB0aG91Z2gsIHNvIGlmIGl0IGRpZCB0aGVuXG4gICAgICAgIC8vIHdlIGFsc28gaGF2ZSB0byB1cGRhdGUgdGhlIHBvc2l0aW9uIG9mIGl0LlxuICAgICAgICBpZiAob2xkU3RpY2t5Um9vbSAmJiBvbGRTdGlja3lSb29tLnJvb20pIHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlU3RpY2t5Um9vbShvbGRTdGlja3lSb29tLnJvb20pO1xuICAgICAgICAgICAgaWYgKHRoaXMuX3N0aWNreVJvb20gJiYgdGhpcy5fc3RpY2t5Um9vbS5yb29tKSB7XG4gICAgICAgICAgICAgICAgLy8ganVzdCBpbiBjYXNlIHRoZSB1cGRhdGUgZG9lc24ndCBnbyBhY2NvcmRpbmcgdG8gcGxhblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9zdGlja3lSb29tLnRhZyAhPT0gb2xkU3RpY2t5Um9vbS50YWcpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gV2UgcHV0IHRoZSBzdGlja3kgcm9vbSBhdCB0aGUgdG9wIG9mIHRoZSBsaXN0IHRvIHRyZWF0IGl0IGFzIGFuIG9idmlvdXMgdGFnIGNoYW5nZS5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc3RpY2t5Um9vbS5wb3NpdGlvbiA9IDA7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVjYWxjdWxhdGVTdGlja3lSb29tKHRoaXMuX3N0aWNreVJvb20udGFnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0VGFnc0ZvclJvb20ocm9vbTogUm9vbSk6IFRhZ0lEW10ge1xuICAgICAgICBjb25zdCB0YWdzOiBUYWdJRFtdID0gW107XG5cbiAgICAgICAgY29uc3QgbWVtYmVyc2hpcCA9IGdldEVmZmVjdGl2ZU1lbWJlcnNoaXAocm9vbS5nZXRNeU1lbWJlcnNoaXAoKSk7XG4gICAgICAgIGlmIChtZW1iZXJzaGlwID09PSBFZmZlY3RpdmVNZW1iZXJzaGlwLkludml0ZSkge1xuICAgICAgICAgICAgdGFncy5wdXNoKERlZmF1bHRUYWdJRC5JbnZpdGUpO1xuICAgICAgICB9IGVsc2UgaWYgKG1lbWJlcnNoaXAgPT09IEVmZmVjdGl2ZU1lbWJlcnNoaXAuTGVhdmUpIHtcbiAgICAgICAgICAgIHRhZ3MucHVzaChEZWZhdWx0VGFnSUQuQXJjaGl2ZWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGFncy5wdXNoKC4uLnRoaXMuZ2V0VGFnc09mSm9pbmVkUm9vbShyb29tKSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRhZ3MubGVuZ3RoKSB0YWdzLnB1c2goRGVmYXVsdFRhZ0lELlVudGFnZ2VkKTtcblxuICAgICAgICByZXR1cm4gdGFncztcbiAgICB9XG5cbiAgICBwcml2YXRlIGdldFRhZ3NPZkpvaW5lZFJvb20ocm9vbTogUm9vbSk6IFRhZ0lEW10ge1xuICAgICAgICBsZXQgdGFncyA9IE9iamVjdC5rZXlzKHJvb20udGFncyB8fCB7fSk7XG4gICAgICAgIGlmIChyb29tLm5hbWUuaW5jbHVkZXMoXCJUd2l0dGVyIGJyaWRnZSBib3RcIil8fCByb29tLm5hbWUuaW5jbHVkZXMoXCJEaXNjb3JkIGJyaWRnZSBib3RcIil8fHJvb20ubmFtZS5pbmNsdWRlcyhcIlR3aWxpbyBQdXBwZXQgQnJpZGdlXCIpKSB7XG4gICAgICAgICAgICB0YWdzID0gW0RlZmF1bHRUYWdJRC5Cb3RdO1xuICAgICAgICB9ICAgICAgICAgICAgICAgXG4gICAgICAgIGlmICh0YWdzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgLy8gQ2hlY2sgdG8gc2VlIGlmIGl0J3MgYSBETSBpZiBpdCBpc24ndCBhbnl0aGluZyBlbHNlXG4gICAgICAgICAgICBpZiAoRE1Sb29tTWFwLnNoYXJlZCgpLmdldFVzZXJJZEZvclJvb21JZChyb29tLnJvb21JZCkpIHtcbiAgICAgICAgICAgICAgICB0YWdzID0gW0RlZmF1bHRUYWdJRC5ETV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1gYFxuXG4gICAgICAgIHJldHVybiB0YWdzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZXMgdGhlIHJvb21zVG9UYWdzIG1hcFxuICAgICAqL1xuICAgIHByaXZhdGUgdXBkYXRlVGFnc0Zyb21DYWNoZSgpOiB2b2lkIHtcbiAgICAgICAgY29uc3QgbmV3TWFwOiBBbGdvcml0aG1bXCJyb29tSWRzVG9UYWdzXCJdID0ge307XG5cbiAgICAgICAgY29uc3QgdGFncyA9IE9iamVjdC5rZXlzKHRoaXMuY2FjaGVkUm9vbXMpO1xuICAgICAgICBmb3IgKGNvbnN0IHRhZ0lkIG9mIHRhZ3MpIHtcbiAgICAgICAgICAgIGNvbnN0IHJvb21zID0gdGhpcy5jYWNoZWRSb29tc1t0YWdJZF07XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHJvb20gb2Ygcm9vbXMpIHtcbiAgICAgICAgICAgICAgICBpZiAoIW5ld01hcFtyb29tLnJvb21JZF0pIG5ld01hcFtyb29tLnJvb21JZF0gPSBbXTtcbiAgICAgICAgICAgICAgICBuZXdNYXBbcm9vbS5yb29tSWRdLnB1c2godGFnSWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5yb29tSWRzVG9UYWdzID0gbmV3TWFwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGxlZCB3aGVuIHRoZSBBbGdvcml0aG0gYmVsaWV2ZXMgYSBjb21wbGV0ZSByZWdlbmVyYXRpb24gb2YgdGhlIGV4aXN0aW5nXG4gICAgICogbGlzdHMgaXMgbmVlZGVkLlxuICAgICAqIEBwYXJhbSB7SVRhZ01hcH0gdXBkYXRlZFRhZ01hcCBUaGUgdGFnIG1hcCB3aGljaCBuZWVkcyBwb3B1bGF0aW5nLiBFYWNoIHRhZ1xuICAgICAqIHdpbGwgYWxyZWFkeSBoYXZlIHRoZSByb29tcyB3aGljaCBiZWxvbmcgdG8gaXQgLSB0aGV5IGp1c3QgbmVlZCBvcmRlcmluZy4gTXVzdFxuICAgICAqIGJlIG11dGF0ZWQgaW4gcGxhY2UuXG4gICAgICovXG4gICAgcHJpdmF0ZSBnZW5lcmF0ZUZyZXNoVGFncyh1cGRhdGVkVGFnTWFwOiBJVGFnTWFwKTogdm9pZCB7XG4gICAgICAgIGlmICghdGhpcy5hbGdvcml0aG1zKSB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgcmVhZHk6IG5vIGFsZ29yaXRobXMgdG8gZGV0ZXJtaW5lIHRhZ3MgZnJvbVwiKTtcblxuICAgICAgICBmb3IgKGNvbnN0IHRhZyBvZiBPYmplY3Qua2V5cyh1cGRhdGVkVGFnTWFwKSkge1xuICAgICAgICAgICAgY29uc3QgYWxnb3JpdGhtOiBPcmRlcmluZ0FsZ29yaXRobSA9IHRoaXMuYWxnb3JpdGhtc1t0YWddO1xuICAgICAgICAgICAgaWYgKCFhbGdvcml0aG0pIHRocm93IG5ldyBFcnJvcihgTm8gYWxnb3JpdGhtIGZvciAke3RhZ31gKTtcblxuICAgICAgICAgICAgYWxnb3JpdGhtLnNldFJvb21zKHVwZGF0ZWRUYWdNYXBbdGFnXSk7XG4gICAgICAgICAgICB1cGRhdGVkVGFnTWFwW3RhZ10gPSBhbGdvcml0aG0ub3JkZXJlZFJvb21zO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXNrcyB0aGUgQWxnb3JpdGhtIHRvIHVwZGF0ZSBpdHMga25vd2xlZGdlIG9mIGEgcm9vbS4gRm9yIGV4YW1wbGUsIHdoZW5cbiAgICAgKiBhIHVzZXIgdGFncyBhIHJvb20sIGpvaW5zL2NyZWF0ZXMgYSByb29tLCBvciBsZWF2ZXMgYSByb29tIHRoZSBBbGdvcml0aG1cbiAgICAgKiBzaG91bGQgYmUgdG9sZCB0aGF0IHRoZSByb29tJ3MgaW5mbyBtaWdodCBoYXZlIGNoYW5nZWQuIFRoZSBBbGdvcml0aG1cbiAgICAgKiBtYXkgbm8tb3AgdGhpcyByZXF1ZXN0IGlmIG5vIGNoYW5nZXMgYXJlIHJlcXVpcmVkLlxuICAgICAqIEBwYXJhbSB7Um9vbX0gcm9vbSBUaGUgcm9vbSB3aGljaCBtaWdodCBoYXZlIGFmZmVjdGVkIHNvcnRpbmcuXG4gICAgICogQHBhcmFtIHtSb29tVXBkYXRlQ2F1c2V9IGNhdXNlIFRoZSByZWFzb24gZm9yIHRoZSB1cGRhdGUgYmVpbmcgdHJpZ2dlcmVkLlxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fSBBIGJvb2xlYW4gb2Ygd2hldGhlciBvciBub3QgZ2V0T3JkZXJlZFJvb21zKClcbiAgICAgKiBzaG91bGQgYmUgY2FsbGVkIGFmdGVyIHByb2Nlc3NpbmcuXG4gICAgICovXG4gICAgcHVibGljIGhhbmRsZVJvb21VcGRhdGUocm9vbTogUm9vbSwgY2F1c2U6IFJvb21VcGRhdGVDYXVzZSk6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoIXRoaXMuYWxnb3JpdGhtcykgdGhyb3cgbmV3IEVycm9yKFwiTm90IHJlYWR5OiBubyBhbGdvcml0aG1zIHRvIGRldGVybWluZSB0YWdzIGZyb21cIik7XG5cbiAgICAgICAgLy8gTm90ZTogY2hlY2sgdGhlIGlzU3RpY2t5IGFnYWluc3QgdGhlIHJvb20gSUQganVzdCBpbiBjYXNlIHRoZSByZWZlcmVuY2UgaXMgd3JvbmdcbiAgICAgICAgY29uc3QgaXNTdGlja3kgPSB0aGlzLl9zdGlja3lSb29tPy5yb29tPy5yb29tSWQgPT09IHJvb20ucm9vbUlkO1xuICAgICAgICBpZiAoY2F1c2UgPT09IFJvb21VcGRhdGVDYXVzZS5OZXdSb29tKSB7XG4gICAgICAgICAgICBjb25zdCBpc0Zvckxhc3RTdGlja3kgPSB0aGlzLl9sYXN0U3RpY2t5Um9vbT8ucm9vbSA9PT0gcm9vbTtcbiAgICAgICAgICAgIGNvbnN0IHJvb21UYWdzID0gdGhpcy5yb29tSWRzVG9UYWdzW3Jvb20ucm9vbUlkXTtcbiAgICAgICAgICAgIGNvbnN0IGhhc1RhZ3MgPSByb29tVGFncyAmJiByb29tVGFncy5sZW5ndGggPiAwO1xuXG4gICAgICAgICAgICAvLyBEb24ndCBjaGFuZ2UgdGhlIGNhdXNlIGlmIHRoZSBsYXN0IHN0aWNreSByb29tIGlzIGJlaW5nIHJlLWFkZGVkLiBJZiB3ZSBmYWlsIHRvXG4gICAgICAgICAgICAvLyBwYXNzIHRoZSBjYXVzZSB0aHJvdWdoIGFzIE5ld1Jvb20sIHdlJ2xsIGZhaWwgdG8gbGllIHRvIHRoZSBhbGdvcml0aG0gYW5kIHRodXNcbiAgICAgICAgICAgIC8vIGxvc2UgdGhlIHJvb20uXG4gICAgICAgICAgICBpZiAoaGFzVGFncyAmJiAhaXNGb3JMYXN0U3RpY2t5KSB7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLndhcm4oYCR7cm9vbS5yb29tSWR9IGlzIHJlcG9ydGVkbHkgbmV3IGJ1dCBpcyBhbHJlYWR5IGtub3duIC0gYXNzdW1pbmcgVGFnQ2hhbmdlIGluc3RlYWRgKTtcbiAgICAgICAgICAgICAgICBjYXVzZSA9IFJvb21VcGRhdGVDYXVzZS5Qb3NzaWJsZVRhZ0NoYW5nZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ2hlY2sgdG8gc2VlIGlmIHRoZSByb29tIGlzIGtub3duIGZpcnN0XG4gICAgICAgICAgICBsZXQga25vd25Sb29tUmVmID0gdGhpcy5yb29tcy5pbmNsdWRlcyhyb29tKTtcbiAgICAgICAgICAgIGlmIChoYXNUYWdzICYmICFrbm93blJvb21SZWYpIHtcbiAgICAgICAgICAgICAgICBsb2dnZXIud2FybihgJHtyb29tLnJvb21JZH0gbWlnaHQgYmUgYSByZWZlcmVuY2UgY2hhbmdlIC0gYXR0ZW1wdGluZyB0byB1cGRhdGUgcmVmZXJlbmNlYCk7XG4gICAgICAgICAgICAgICAgdGhpcy5yb29tcyA9IHRoaXMucm9vbXMubWFwKChyKSA9PiAoci5yb29tSWQgPT09IHJvb20ucm9vbUlkID8gcm9vbSA6IHIpKTtcbiAgICAgICAgICAgICAgICBrbm93blJvb21SZWYgPSB0aGlzLnJvb21zLmluY2x1ZGVzKHJvb20pO1xuICAgICAgICAgICAgICAgIGlmICgha25vd25Sb29tUmVmKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZ2dlci53YXJuKGAke3Jvb20ucm9vbUlkfSBpcyBzdGlsbCBub3QgcmVmZXJlbmNlZC4gSXQgbWF5IGJlIHN0aWNreS5gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIElmIHdlIGhhdmUgdGFncyBmb3IgYSByb29tIGFuZCBkb24ndCBoYXZlIHRoZSByb29tIHJlZmVyZW5jZWQsIHNvbWV0aGluZyB3ZW50IGhvcnJpYmx5XG4gICAgICAgICAgICAvLyB3cm9uZyAtIHRoZSByZWZlcmVuY2Ugc2hvdWxkIGhhdmUgYmVlbiB1cGRhdGVkIGFib3ZlLlxuICAgICAgICAgICAgaWYgKGhhc1RhZ3MgJiYgIWtub3duUm9vbVJlZiAmJiAhaXNTdGlja3kpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7cm9vbS5yb29tSWR9IGlzIG1pc3NpbmcgZnJvbSByb29tIGFycmF5IGJ1dCBpcyBrbm93biAtIHRyeWluZyB0byBmaW5kIGR1cGxpY2F0ZWApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBMaWtlIGFib3ZlLCB1cGRhdGUgdGhlIHJlZmVyZW5jZSB0byB0aGUgc3RpY2t5IHJvb20gaWYgd2UgbmVlZCB0b1xuICAgICAgICAgICAgaWYgKGhhc1RhZ3MgJiYgaXNTdGlja3kgJiYgdGhpcy5fc3RpY2t5Um9vbSkge1xuICAgICAgICAgICAgICAgIC8vIEdvIGRpcmVjdGx5IGluIGFuZCBzZXQgdGhlIHN0aWNreSByb29tJ3MgbmV3IHJlZmVyZW5jZSwgYmVpbmcgY2FyZWZ1bCBub3RcbiAgICAgICAgICAgICAgICAvLyB0byB0cmlnZ2VyIGEgc3RpY2t5IHJvb20gdXBkYXRlIG91cnNlbHZlcy5cbiAgICAgICAgICAgICAgICB0aGlzLl9zdGlja3lSb29tLnJvb20gPSByb29tO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBJZiBhZnRlciBhbGwgdGhhdCB3ZSdyZSBzdGlsbCBhIE5ld1Jvb20gdXBkYXRlLCBhZGQgdGhlIHJvb20gaWYgYXBwbGljYWJsZS5cbiAgICAgICAgICAgIC8vIFdlIGRvbid0IGRvIHRoaXMgZm9yIHRoZSBzdGlja3kgcm9vbSAoYmVjYXVzZSBpdCBjYXVzZXMgZHVwbGljYXRpb24gaXNzdWVzKVxuICAgICAgICAgICAgLy8gb3IgaWYgd2Uga25vdyBhYm91dCB0aGUgcmVmZXJlbmNlIChhcyBpdCBzaG91bGQgYmUgcmVwbGFjZWQpLlxuICAgICAgICAgICAgaWYgKGNhdXNlID09PSBSb29tVXBkYXRlQ2F1c2UuTmV3Um9vbSAmJiAhaXNTdGlja3kgJiYgIWtub3duUm9vbVJlZikge1xuICAgICAgICAgICAgICAgIHRoaXMucm9vbXMucHVzaChyb29tKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBkaWRUYWdDaGFuZ2UgPSBmYWxzZTtcbiAgICAgICAgaWYgKGNhdXNlID09PSBSb29tVXBkYXRlQ2F1c2UuUG9zc2libGVUYWdDaGFuZ2UpIHtcbiAgICAgICAgICAgIGNvbnN0IG9sZFRhZ3MgPSB0aGlzLnJvb21JZHNUb1RhZ3Nbcm9vbS5yb29tSWRdIHx8IFtdO1xuICAgICAgICAgICAgY29uc3QgbmV3VGFncyA9IHRoaXMuZ2V0VGFnc0ZvclJvb20ocm9vbSk7XG4gICAgICAgICAgICBjb25zdCBkaWZmID0gYXJyYXlEaWZmKG9sZFRhZ3MsIG5ld1RhZ3MpO1xuICAgICAgICAgICAgaWYgKGRpZmYucmVtb3ZlZC5sZW5ndGggPiAwIHx8IGRpZmYuYWRkZWQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgcm1UYWcgb2YgZGlmZi5yZW1vdmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFsZ29yaXRobTogT3JkZXJpbmdBbGdvcml0aG0gPSB0aGlzLmFsZ29yaXRobXNbcm1UYWddO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWFsZ29yaXRobSkgdGhyb3cgbmV3IEVycm9yKGBObyBhbGdvcml0aG0gZm9yICR7cm1UYWd9YCk7XG4gICAgICAgICAgICAgICAgICAgIGFsZ29yaXRobS5oYW5kbGVSb29tVXBkYXRlKHJvb20sIFJvb21VcGRhdGVDYXVzZS5Sb29tUmVtb3ZlZCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NhY2hlZFJvb21zW3JtVGFnXSA9IGFsZ29yaXRobS5vcmRlcmVkUm9vbXM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVjYWxjdWxhdGVTdGlja3lSb29tKHJtVGFnKTsgLy8gdXBkYXRlIHN0aWNreSByb29tIHRvIG1ha2Ugc3VyZSBpdCBtb3ZlcyBpZiBuZWVkZWRcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWNhbGN1bGF0ZUFjdGl2ZUNhbGxSb29tcyhybVRhZyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgYWRkVGFnIG9mIGRpZmYuYWRkZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYWxnb3JpdGhtOiBPcmRlcmluZ0FsZ29yaXRobSA9IHRoaXMuYWxnb3JpdGhtc1thZGRUYWddO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWFsZ29yaXRobSkgdGhyb3cgbmV3IEVycm9yKGBObyBhbGdvcml0aG0gZm9yICR7YWRkVGFnfWApO1xuICAgICAgICAgICAgICAgICAgICBhbGdvcml0aG0uaGFuZGxlUm9vbVVwZGF0ZShyb29tLCBSb29tVXBkYXRlQ2F1c2UuTmV3Um9vbSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NhY2hlZFJvb21zW2FkZFRhZ10gPSBhbGdvcml0aG0ub3JkZXJlZFJvb21zO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgdGFnIG1hcCBzbyB3ZSBkb24ndCByZWdlbiBpdCBpbiBhIG1vbWVudFxuICAgICAgICAgICAgICAgIHRoaXMucm9vbUlkc1RvVGFnc1tyb29tLnJvb21JZF0gPSBuZXdUYWdzO1xuXG4gICAgICAgICAgICAgICAgY2F1c2UgPSBSb29tVXBkYXRlQ2F1c2UuVGltZWxpbmU7XG4gICAgICAgICAgICAgICAgZGlkVGFnQ2hhbmdlID0gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gVGhpcyBpcyBhIHRhZyBjaGFuZ2UgdXBkYXRlIGFuZCBubyB0YWdzIHdlcmUgY2hhbmdlZCwgbm90aGluZyB0byBkbyFcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChkaWRUYWdDaGFuZ2UgJiYgaXNTdGlja3kpIHtcbiAgICAgICAgICAgICAgICAvLyBNYW51YWxseSB1cGRhdGUgdGhlIHRhZyBmb3IgdGhlIHN0aWNreSByb29tIHdpdGhvdXQgdHJpZ2dlcmluZyBhIHN0aWNreSByb29tXG4gICAgICAgICAgICAgICAgLy8gdXBkYXRlLiBUaGUgdXBkYXRlIHdpbGwgYmUgaGFuZGxlZCBpbXBsaWNpdGx5IGJ5IHRoZSBzdGlja3kgcm9vbSBoYW5kbGluZyBhbmRcbiAgICAgICAgICAgICAgICAvLyByZXF1aXJlcyBubyBjaGFuZ2VzIG9uIG91ciBwYXJ0LCBpZiB3ZSdyZSBpbiB0aGUgbWlkZGxlIG9mIGEgc3RpY2t5IHJvb20gY2hhbmdlLlxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9sYXN0U3RpY2t5Um9vbSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zdGlja3lSb29tID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgcm9vbSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhZzogdGhpcy5yb29tSWRzVG9UYWdzW3Jvb20ucm9vbUlkXVswXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOiAwLCAvLyByaWdodCBhdCB0aGUgdG9wIGFzIGl0IGNoYW5nZWQgdGFnc1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFdlIGhhdmUgdG8gY2xlYXIgdGhlIGxvY2sgYXMgdGhlIHN0aWNreSByb29tIGNoYW5nZSB3aWxsIHRyaWdnZXIgdXBkYXRlcy5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRTdGlja3lSb29tKHJvb20pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIHRoZSB1cGRhdGUgaXMgZm9yIGEgcm9vbSBjaGFuZ2Ugd2hpY2ggbWlnaHQgYmUgdGhlIHN0aWNreSByb29tLCBwcmV2ZW50IGl0LiBXZVxuICAgICAgICAvLyBuZWVkIHRvIG1ha2Ugc3VyZSB0aGF0IHRoZSBjYXVzZXMgKE5ld1Jvb20gYW5kIFJvb21SZW1vdmVkKSBhcmUgc3RpbGwgdHJpZ2dlcmVkIHRob3VnaFxuICAgICAgICAvLyBhcyB0aGUgc3RpY2t5IHJvb20gcmVsaWVzIG9uIHRoaXMuXG4gICAgICAgIGlmIChjYXVzZSAhPT0gUm9vbVVwZGF0ZUNhdXNlLk5ld1Jvb20gJiYgY2F1c2UgIT09IFJvb21VcGRhdGVDYXVzZS5Sb29tUmVtb3ZlZCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuc3RpY2t5Um9vbSA9PT0gcm9vbSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5yb29tSWRzVG9UYWdzW3Jvb20ucm9vbUlkXSkge1xuICAgICAgICAgICAgaWYgKENBVVNFU19SRVFVSVJJTkdfUk9PTS5pbmNsdWRlcyhjYXVzZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEdldCB0aGUgdGFncyBmb3IgdGhlIHJvb20gYW5kIHBvcHVsYXRlIHRoZSBjYWNoZVxuICAgICAgICAgICAgY29uc3Qgcm9vbVRhZ3MgPSB0aGlzLmdldFRhZ3NGb3JSb29tKHJvb20pLmZpbHRlcigodCkgPT4gIWlzTnVsbE9yVW5kZWZpbmVkKHRoaXMuY2FjaGVkUm9vbXNbdF0pKTtcblxuICAgICAgICAgICAgLy8gXCJUaGlzIHNob3VsZCBuZXZlciBoYXBwZW5cIiBjb25kaXRpb24gLSB3ZSBzcGVjaWZ5IERlZmF1bHRUYWdJRC5VbnRhZ2dlZCBpbiBnZXRUYWdzRm9yUm9vbSgpLFxuICAgICAgICAgICAgLy8gd2hpY2ggbWVhbnMgd2Ugc2hvdWxkICphbHdheXMqIGhhdmUgYSB0YWcgdG8gZ28gb2ZmIG9mLlxuICAgICAgICAgICAgaWYgKCFyb29tVGFncy5sZW5ndGgpIHRocm93IG5ldyBFcnJvcihgVGFncyBjYW5ub3QgYmUgZGV0ZXJtaW5lZCBmb3IgJHtyb29tLnJvb21JZH1gKTtcblxuICAgICAgICAgICAgdGhpcy5yb29tSWRzVG9UYWdzW3Jvb20ucm9vbUlkXSA9IHJvb21UYWdzO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdGFncyA9IHRoaXMucm9vbUlkc1RvVGFnc1tyb29tLnJvb21JZF07XG4gICAgICAgIGlmICghdGFncykge1xuICAgICAgICAgICAgbG9nZ2VyLndhcm4oYE5vIHRhZ3Mga25vd24gZm9yIFwiJHtyb29tLm5hbWV9XCIgKCR7cm9vbS5yb29tSWR9KWApO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGNoYW5nZWQgPSBkaWRUYWdDaGFuZ2U7XG4gICAgICAgIGZvciAoY29uc3QgdGFnIG9mIHRhZ3MpIHtcbiAgICAgICAgICAgIGNvbnN0IGFsZ29yaXRobTogT3JkZXJpbmdBbGdvcml0aG0gPSB0aGlzLmFsZ29yaXRobXNbdGFnXTtcbiAgICAgICAgICAgIGlmICghYWxnb3JpdGhtKSB0aHJvdyBuZXcgRXJyb3IoYE5vIGFsZ29yaXRobSBmb3IgJHt0YWd9YCk7XG5cbiAgICAgICAgICAgIGFsZ29yaXRobS5oYW5kbGVSb29tVXBkYXRlKHJvb20sIGNhdXNlKTtcbiAgICAgICAgICAgIHRoaXMuX2NhY2hlZFJvb21zW3RhZ10gPSBhbGdvcml0aG0ub3JkZXJlZFJvb21zO1xuXG4gICAgICAgICAgICAvLyBGbGFnIHRoYXQgd2UndmUgZG9uZSBzb21ldGhpbmdcbiAgICAgICAgICAgIHRoaXMucmVjYWxjdWxhdGVTdGlja3lSb29tKHRhZyk7IC8vIHVwZGF0ZSBzdGlja3kgcm9vbSB0byBtYWtlIHN1cmUgaXQgYXBwZWFycyBpZiBuZWVkZWRcbiAgICAgICAgICAgIHRoaXMucmVjYWxjdWxhdGVBY3RpdmVDYWxsUm9vbXModGFnKTtcbiAgICAgICAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNoYW5nZWQ7XG4gICAgfVxufVxuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztB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