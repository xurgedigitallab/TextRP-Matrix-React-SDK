"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _events = require("events");
var _roomMember = require("matrix-js-sdk/src/models/room-member");
var _eventTimeline = require("matrix-js-sdk/src/models/event-timeline");
var _room = require("matrix-js-sdk/src/models/room");
var _roomState = require("matrix-js-sdk/src/models/room-state");
var _utils = require("matrix-js-sdk/src/utils");
var _logger = require("matrix-js-sdk/src/logger");
var _event = require("matrix-js-sdk/src/@types/event");
var _client = require("matrix-js-sdk/src/client");
var _httpApi = require("matrix-js-sdk/src/http-api");
var _PlatformPeg = _interopRequireDefault(require("../PlatformPeg"));
var _MatrixClientPeg = require("../MatrixClientPeg");
var _SettingsStore = _interopRequireDefault(require("../settings/SettingsStore"));
var _SettingLevel = require("../settings/SettingLevel");
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

// The time in ms that the crawler will wait loop iterations if there
// have not been any checkpoints to consume in the last iteration.
const CRAWLER_IDLE_TIME = 5000;

// The maximum number of events our crawler should fetch in a single crawl.
const EVENTS_PER_CRAWL = 100;
/*
 * Event indexing class that wraps the platform specific event indexing.
 */
class EventIndex extends _events.EventEmitter {
  constructor() {
    super(...arguments);
    (0, _defineProperty2.default)(this, "crawlerCheckpoints", []);
    (0, _defineProperty2.default)(this, "crawler", null);
    (0, _defineProperty2.default)(this, "currentCheckpoint", null);
    /*
     * The sync event listener.
     *
     * The listener has two cases:
     *     - First sync after start up, check if the index is empty, add
     *         initial checkpoints, if so. Start the crawler background task.
     *     - Every other sync, tell the event index to commit all the queued up
     *         live events
     */
    (0, _defineProperty2.default)(this, "onSync", async (state, prevState, data) => {
      const indexManager = _PlatformPeg.default.get()?.getEventIndexingManager();
      if (!indexManager) return;
      if (prevState === "PREPARED" && state === "SYNCING") {
        // If our indexer is empty we're most likely running Element the
        // first time with indexing support or running it with an
        // initial sync. Add checkpoints to crawl our encrypted rooms.
        const eventIndexWasEmpty = await indexManager.isEventIndexEmpty();
        if (eventIndexWasEmpty) await this.addInitialCheckpoints();
        this.startCrawler();
        return;
      }
      if (prevState === "SYNCING" && state === "SYNCING") {
        // A sync was done, presumably we queued up some live events,
        // commit them now.
        await indexManager.commitLiveEvents();
      }
    });
    /*
     * The Room.timeline listener.
     *
     * This listener waits for live events in encrypted rooms, if they are
     * decrypted or unencrypted we queue them to be added to the index,
     * otherwise we save their event id and wait for them in the Event.decrypted
     * listener.
     */
    (0, _defineProperty2.default)(this, "onRoomTimeline", async (ev, room, toStartOfTimeline, removed, data) => {
      if (!room) return; // notification timeline, we'll get this event again with a room specific timeline

      const client = _MatrixClientPeg.MatrixClientPeg.get();

      // We only index encrypted rooms locally.
      if (!client.isRoomEncrypted(ev.getRoomId())) return;
      if (ev.isRedaction()) {
        return this.redactEvent(ev);
      }

      // If it isn't a live event or if it's redacted there's nothing to do.
      if (toStartOfTimeline || !data || !data.liveEvent || ev.isRedacted()) {
        return;
      }
      await client.decryptEventIfNeeded(ev);
      await this.addLiveEventToIndex(ev);
    });
    (0, _defineProperty2.default)(this, "onRoomStateEvent", async (ev, state) => {
      if (!_MatrixClientPeg.MatrixClientPeg.get().isRoomEncrypted(state.roomId)) return;
      if (ev.getType() === _event.EventType.RoomEncryption && !(await this.isRoomIndexed(state.roomId))) {
        _logger.logger.log("EventIndex: Adding a checkpoint for a newly encrypted room", state.roomId);
        this.addRoomCheckpoint(state.roomId, true);
      }
    });
    /*
     * Removes a redacted event from our event index.
     * We cannot rely on Room.redaction as this only fires if the redaction applied to an event the js-sdk has loaded.
     */
    (0, _defineProperty2.default)(this, "redactEvent", async ev => {
      const indexManager = _PlatformPeg.default.get()?.getEventIndexingManager();
      if (!indexManager) return;
      const associatedId = ev.getAssociatedId();
      if (!associatedId) return;
      try {
        await indexManager.deleteEvent(associatedId);
      } catch (e) {
        _logger.logger.log("EventIndex: Error deleting event from index", e);
      }
    });
    /*
     * The Room.timelineReset listener.
     *
     * Listens for timeline resets that are caused by a limited timeline to
     * re-add checkpoints for rooms that need to be crawled again.
     */
    (0, _defineProperty2.default)(this, "onTimelineReset", async room => {
      if (!room) return;
      if (!_MatrixClientPeg.MatrixClientPeg.get().isRoomEncrypted(room.roomId)) return;
      _logger.logger.log("EventIndex: Adding a checkpoint because of a limited timeline", room.roomId);
      this.addRoomCheckpoint(room.roomId, false);
    });
  }
  async init() {
    const indexManager = _PlatformPeg.default.get()?.getEventIndexingManager();
    if (!indexManager) return;
    this.crawlerCheckpoints = await indexManager.loadCheckpoints();
    _logger.logger.log("EventIndex: Loaded checkpoints", this.crawlerCheckpoints);
    this.registerListeners();
  }

  /**
   * Register event listeners that are necessary for the event index to work.
   */
  registerListeners() {
    const client = _MatrixClientPeg.MatrixClientPeg.get();
    client.on(_client.ClientEvent.Sync, this.onSync);
    client.on(_room.RoomEvent.Timeline, this.onRoomTimeline);
    client.on(_room.RoomEvent.TimelineReset, this.onTimelineReset);
    client.on(_roomState.RoomStateEvent.Events, this.onRoomStateEvent);
  }

  /**
   * Remove the event index specific event listeners.
   */
  removeListeners() {
    const client = _MatrixClientPeg.MatrixClientPeg.get();
    if (client === null) return;
    client.removeListener(_client.ClientEvent.Sync, this.onSync);
    client.removeListener(_room.RoomEvent.Timeline, this.onRoomTimeline);
    client.removeListener(_room.RoomEvent.TimelineReset, this.onTimelineReset);
    client.removeListener(_roomState.RoomStateEvent.Events, this.onRoomStateEvent);
  }

  /**
   * Get crawler checkpoints for the encrypted rooms and store them in the index.
   */
  async addInitialCheckpoints() {
    const indexManager = _PlatformPeg.default.get()?.getEventIndexingManager();
    if (!indexManager) return;
    const client = _MatrixClientPeg.MatrixClientPeg.get();
    const rooms = client.getRooms();
    const isRoomEncrypted = room => {
      return client.isRoomEncrypted(room.roomId);
    };

    // We only care to crawl the encrypted rooms, non-encrypted
    // rooms can use the search provided by the homeserver.
    const encryptedRooms = rooms.filter(isRoomEncrypted);
    _logger.logger.log("EventIndex: Adding initial crawler checkpoints");

    // Gather the prev_batch tokens and create checkpoints for
    // our message crawler.
    await Promise.all(encryptedRooms.map(async room => {
      const timeline = room.getLiveTimeline();
      const token = timeline.getPaginationToken(_eventTimeline.Direction.Backward);
      const backCheckpoint = {
        roomId: room.roomId,
        token: token,
        direction: _eventTimeline.Direction.Backward,
        fullCrawl: true
      };
      const forwardCheckpoint = {
        roomId: room.roomId,
        token: token,
        direction: _eventTimeline.Direction.Forward
      };
      try {
        if (backCheckpoint.token) {
          await indexManager.addCrawlerCheckpoint(backCheckpoint);
          this.crawlerCheckpoints.push(backCheckpoint);
        }
        if (forwardCheckpoint.token) {
          await indexManager.addCrawlerCheckpoint(forwardCheckpoint);
          this.crawlerCheckpoints.push(forwardCheckpoint);
        }
      } catch (e) {
        _logger.logger.log("EventIndex: Error adding initial checkpoints for room", room.roomId, backCheckpoint, forwardCheckpoint, e);
      }
    }));
  }
  /**
   * Check if an event should be added to the event index.
   *
   * Most notably we filter events for which decryption failed, are redacted
   * or aren't of a type that we know how to index.
   *
   * @param {MatrixEvent} ev The event that should be checked.
   * @returns {bool} Returns true if the event can be indexed, false
   * otherwise.
   */
  isValidEvent(ev) {
    const isUsefulType = [_event.EventType.RoomMessage, _event.EventType.RoomName, _event.EventType.RoomTopic].includes(ev.getType());
    const validEventType = isUsefulType && !ev.isRedacted() && !ev.isDecryptionFailure();
    let validMsgType = true;
    let hasContentValue = true;
    if (ev.getType() === _event.EventType.RoomMessage && !ev.isRedacted()) {
      // Expand this if there are more invalid msgtypes.
      const msgtype = ev.getContent().msgtype;
      if (!msgtype) validMsgType = false;else validMsgType = !msgtype.startsWith("m.key.verification");
      if (!ev.getContent().body) hasContentValue = false;
    } else if (ev.getType() === _event.EventType.RoomTopic && !ev.isRedacted()) {
      if (!ev.getContent().topic) hasContentValue = false;
    } else if (ev.getType() === _event.EventType.RoomName && !ev.isRedacted()) {
      if (!ev.getContent().name) hasContentValue = false;
    }
    return validEventType && validMsgType && hasContentValue;
  }
  eventToJson(ev) {
    const jsonEvent = ev.toJSON();
    const e = ev.isEncrypted() ? jsonEvent.decrypted : jsonEvent;
    if (ev.isEncrypted()) {
      // Let us store some additional data so we can re-verify the event.
      // The js-sdk checks if an event is encrypted using the algorithm,
      // the sender key and ed25519 signing key are used to find the
      // correct device that sent the event which allows us to check the
      // verification state of the event, either directly or using cross
      // signing.
      e.curve25519Key = ev.getSenderKey();
      e.ed25519Key = ev.getClaimedEd25519Key();
      e.algorithm = ev.getWireContent().algorithm;
      e.forwardingCurve25519KeyChain = ev.getForwardingCurve25519KeyChain();
    } else {
      // Make sure that unencrypted events don't contain any of that data,
      // despite what the server might give to us.
      delete e.curve25519Key;
      delete e.ed25519Key;
      delete e.algorithm;
      delete e.forwardingCurve25519KeyChain;
    }
    return e;
  }

  /**
   * Queue up live events to be added to the event index.
   *
   * @param {MatrixEvent} ev The event that should be added to the index.
   */
  async addLiveEventToIndex(ev) {
    const indexManager = _PlatformPeg.default.get()?.getEventIndexingManager();
    if (!indexManager || !this.isValidEvent(ev)) return;
    const e = this.eventToJson(ev);
    const profile = {
      displayname: ev.sender?.rawDisplayName,
      avatar_url: ev.sender?.getMxcAvatarUrl()
    };
    await indexManager.addEventToIndex(e, profile);
  }

  /**
   * Emmit that the crawler has changed the checkpoint that it's currently
   * handling.
   */
  emitNewCheckpoint() {
    this.emit("changedCheckpoint", this.currentRoom());
  }
  async addEventsFromLiveTimeline(timeline) {
    const events = timeline.getEvents();
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      await this.addLiveEventToIndex(ev);
    }
  }
  async addRoomCheckpoint(roomId) {
    let fullCrawl = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    const indexManager = _PlatformPeg.default.get()?.getEventIndexingManager();
    if (!indexManager) return;
    const client = _MatrixClientPeg.MatrixClientPeg.get();
    const room = client.getRoom(roomId);
    if (!room) return;
    const timeline = room.getLiveTimeline();
    const token = timeline.getPaginationToken(_eventTimeline.Direction.Backward);
    if (!token) {
      // The room doesn't contain any tokens, meaning the live timeline
      // contains all the events, add those to the index.
      await this.addEventsFromLiveTimeline(timeline);
      return;
    }
    const checkpoint = {
      roomId: room.roomId,
      token: token,
      fullCrawl: fullCrawl,
      direction: _eventTimeline.Direction.Backward
    };
    _logger.logger.log("EventIndex: Adding checkpoint", checkpoint);
    try {
      await indexManager.addCrawlerCheckpoint(checkpoint);
    } catch (e) {
      _logger.logger.log("EventIndex: Error adding new checkpoint for room", room.roomId, checkpoint, e);
    }
    this.crawlerCheckpoints.push(checkpoint);
  }

  /**
   * The main crawler loop.
   *
   * Goes through crawlerCheckpoints and fetches events from the server to be
   * added to the EventIndex.
   *
   * If a /room/{roomId}/messages request doesn't contain any events, stop the
   * crawl, otherwise create a new checkpoint and push it to the
   * crawlerCheckpoints queue, so we go through them in a round-robin way.
   */
  async crawlerFunc() {
    let cancelled = false;
    const client = _MatrixClientPeg.MatrixClientPeg.get();
    const indexManager = _PlatformPeg.default.get()?.getEventIndexingManager();
    if (!indexManager) return;
    this.crawler = {
      cancel: () => {
        cancelled = true;
      }
    };
    let idle = false;
    while (!cancelled) {
      let sleepTime = _SettingsStore.default.getValueAt(_SettingLevel.SettingLevel.DEVICE, "crawlerSleepTime");

      // Don't let the user configure a lower sleep time than 100 ms.
      sleepTime = Math.max(sleepTime, 100);
      if (idle) {
        sleepTime = CRAWLER_IDLE_TIME;
      }
      if (this.currentCheckpoint !== null) {
        this.currentCheckpoint = null;
        this.emitNewCheckpoint();
      }
      await (0, _utils.sleep)(sleepTime);
      if (cancelled) {
        break;
      }
      const checkpoint = this.crawlerCheckpoints.shift();

      /// There is no checkpoint available currently, one may appear if
      // a sync with limited room timelines happens, so go back to sleep.
      if (checkpoint === undefined) {
        idle = true;
        continue;
      }
      this.currentCheckpoint = checkpoint;
      this.emitNewCheckpoint();
      idle = false;

      // We have a checkpoint, let us fetch some messages, again, very
      // conservatively to not bother our homeserver too much.
      const eventMapper = client.getEventMapper({
        preventReEmit: true
      });
      // TODO we need to ensure to use member lazy loading with this
      // request so we get the correct profiles.
      let res;
      try {
        res = await client.createMessagesRequest(checkpoint.roomId, checkpoint.token, EVENTS_PER_CRAWL, checkpoint.direction);
      } catch (e) {
        if (e instanceof _httpApi.HTTPError && e.httpStatus === 403) {
          _logger.logger.log("EventIndex: Removing checkpoint as we don't have ", "permissions to fetch messages from this room.", checkpoint);
          try {
            await indexManager.removeCrawlerCheckpoint(checkpoint);
          } catch (e) {
            _logger.logger.log("EventIndex: Error removing checkpoint", checkpoint, e);
            // We don't push the checkpoint here back, it will
            // hopefully be removed after a restart. But let us
            // ignore it for now as we don't want to hammer the
            // endpoint.
          }

          continue;
        }
        _logger.logger.log("EventIndex: Error crawling using checkpoint:", checkpoint, ",", e);
        this.crawlerCheckpoints.push(checkpoint);
        continue;
      }
      if (cancelled) {
        this.crawlerCheckpoints.push(checkpoint);
        break;
      }
      if (res.chunk.length === 0) {
        _logger.logger.log("EventIndex: Done with the checkpoint", checkpoint);
        // We got to the start/end of our timeline, lets just
        // delete our checkpoint and go back to sleep.
        try {
          await indexManager.removeCrawlerCheckpoint(checkpoint);
        } catch (e) {
          _logger.logger.log("EventIndex: Error removing checkpoint", checkpoint, e);
        }
        continue;
      }

      // Convert the plain JSON events into Matrix events so they get
      // decrypted if necessary.
      const matrixEvents = res.chunk.map(eventMapper);
      let stateEvents = [];
      if (res.state !== undefined) {
        stateEvents = res.state.map(eventMapper);
      }
      const profiles = {};
      stateEvents.forEach(ev => {
        if (ev.getContent().membership === "join") {
          profiles[ev.getSender()] = {
            displayname: ev.getContent().displayname,
            avatar_url: ev.getContent().avatar_url
          };
        }
      });
      const decryptionPromises = matrixEvents.filter(event => event.isEncrypted()).map(event => {
        return client.decryptEventIfNeeded(event, {
          isRetry: true,
          emit: false
        });
      });

      // Let us wait for all the events to get decrypted.
      await Promise.all(decryptionPromises);

      // TODO if there are no events at this point we're missing a lot
      // decryption keys, do we want to retry this checkpoint at a later
      // stage?
      const filteredEvents = matrixEvents.filter(this.isValidEvent);

      // Collect the redaction events, so we can delete the redacted events from the index.
      const redactionEvents = matrixEvents.filter(ev => ev.isRedaction());

      // Let us convert the events back into a format that EventIndex can
      // consume.
      const events = filteredEvents.map(ev => {
        const e = this.eventToJson(ev);
        let profile = {};
        if (e.sender in profiles) profile = profiles[e.sender];
        const object = {
          event: e,
          profile: profile
        };
        return object;
      });
      let newCheckpoint = null;

      // The token can be null for some reason. Don't create a checkpoint
      // in that case since adding it to the db will fail.
      if (res.end) {
        // Create a new checkpoint so we can continue crawling the room
        // for messages.
        newCheckpoint = {
          roomId: checkpoint.roomId,
          token: res.end,
          fullCrawl: checkpoint.fullCrawl,
          direction: checkpoint.direction
        };
      }
      try {
        for (let i = 0; i < redactionEvents.length; i++) {
          const ev = redactionEvents[i];
          const eventId = ev.getAssociatedId();
          if (eventId) {
            await indexManager.deleteEvent(eventId);
          } else {
            _logger.logger.warn("EventIndex: Redaction event doesn't contain a valid associated event id", ev);
          }
        }
        const eventsAlreadyAdded = await indexManager.addHistoricEvents(events, newCheckpoint, checkpoint);

        // We didn't get a valid new checkpoint from the server, nothing
        // to do here anymore.
        if (!newCheckpoint) {
          _logger.logger.log("EventIndex: The server didn't return a valid ", "new checkpoint, not continuing the crawl.", checkpoint);
          continue;
        }

        // If all events were already indexed we assume that we caught
        // up with our index and don't need to crawl the room further.
        // Let us delete the checkpoint in that case, otherwise push
        // the new checkpoint to be used by the crawler.
        if (eventsAlreadyAdded === true && newCheckpoint.fullCrawl !== true) {
          _logger.logger.log("EventIndex: Checkpoint had already all events", "added, stopping the crawl", checkpoint);
          await indexManager.removeCrawlerCheckpoint(newCheckpoint);
        } else {
          if (eventsAlreadyAdded === true) {
            _logger.logger.log("EventIndex: Checkpoint had already all events", "added, but continuing due to a full crawl", checkpoint);
          }
          this.crawlerCheckpoints.push(newCheckpoint);
        }
      } catch (e) {
        _logger.logger.log("EventIndex: Error during a crawl", e);
        // An error occurred, put the checkpoint back so we
        // can retry.
        this.crawlerCheckpoints.push(checkpoint);
      }
    }
    this.crawler = null;
  }

  /**
   * Start the crawler background task.
   */
  startCrawler() {
    if (this.crawler !== null) return;
    this.crawlerFunc();
  }

  /**
   * Stop the crawler background task.
   */
  stopCrawler() {
    if (this.crawler === null) return;
    this.crawler.cancel();
  }

  /**
   * Close the event index.
   *
   * This removes all the MatrixClient event listeners, stops the crawler
   * task, and closes the index.
   */
  async close() {
    const indexManager = _PlatformPeg.default.get()?.getEventIndexingManager();
    this.removeListeners();
    this.stopCrawler();
    await indexManager?.closeEventIndex();
  }

  /**
   * Search the event index using the given term for matching events.
   *
   * @param {ISearchArgs} searchArgs The search configuration for the search,
   * sets the search term and determines the search result contents.
   *
   * @return {Promise<IResultRoomEvents[]>} A promise that will resolve to an array
   * of search results once the search is done.
   */
  async search(searchArgs) {
    const indexManager = _PlatformPeg.default.get()?.getEventIndexingManager();
    return indexManager?.searchEventIndex(searchArgs);
  }

  /**
   * Load events that contain URLs from the event index.
   *
   * @param {Room} room The room for which we should fetch events containing
   * URLs
   *
   * @param {number} limit The maximum number of events to fetch.
   *
   * @param {string} fromEvent From which event should we continue fetching
   * events from the index. This is only needed if we're continuing to fill
   * the timeline, e.g. if we're paginating. This needs to be set to a event
   * id of an event that was previously fetched with this function.
   *
   * @param {string} direction The direction in which we will continue
   * fetching events. EventTimeline.BACKWARDS to continue fetching events that
   * are older than the event given in fromEvent, EventTimeline.FORWARDS to
   * fetch newer events.
   *
   * @returns {Promise<MatrixEvent[]>} Resolves to an array of events that
   * contain URLs.
   */
  async loadFileEvents(room) {
    let limit = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 10;
    let fromEvent = arguments.length > 2 ? arguments[2] : undefined;
    let direction = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : _eventTimeline.EventTimeline.BACKWARDS;
    const client = _MatrixClientPeg.MatrixClientPeg.get();
    const indexManager = _PlatformPeg.default.get()?.getEventIndexingManager();
    if (!indexManager) return [];
    const loadArgs = {
      roomId: room.roomId,
      limit: limit
    };
    if (fromEvent) {
      loadArgs.fromEvent = fromEvent;
      loadArgs.direction = direction;
    }
    let events;

    // Get our events from the event index.
    try {
      events = await indexManager.loadFileEvents(loadArgs);
    } catch (e) {
      _logger.logger.log("EventIndex: Error getting file events", e);
      return [];
    }
    const eventMapper = client.getEventMapper();

    // Turn the events into MatrixEvent objects.
    const matrixEvents = events.map(e => {
      const matrixEvent = eventMapper(e.event);
      const member = new _roomMember.RoomMember(room.roomId, matrixEvent.getSender());

      // We can't really reconstruct the whole room state from our
      // EventIndex to calculate the correct display name. Use the
      // disambiguated form always instead.
      member.name = e.profile.displayname + " (" + matrixEvent.getSender() + ")";

      // This is sets the avatar URL.
      const memberEvent = eventMapper({
        content: {
          membership: "join",
          avatar_url: e.profile.avatar_url,
          displayname: e.profile.displayname
        },
        type: _event.EventType.RoomMember,
        event_id: matrixEvent.getId() + ":eventIndex",
        room_id: matrixEvent.getRoomId(),
        sender: matrixEvent.getSender(),
        origin_server_ts: matrixEvent.getTs(),
        state_key: matrixEvent.getSender()
      });

      // We set this manually to avoid emitting RoomMember.membership and
      // RoomMember.name events.
      member.events.member = memberEvent;
      matrixEvent.sender = member;
      return matrixEvent;
    });
    return matrixEvents;
  }

  /**
   * Fill a timeline with events that contain URLs.
   *
   * @param {TimelineSet} timelineSet The TimelineSet the Timeline belongs to,
   * used to check if we're adding duplicate events.
   *
   * @param {Timeline} timeline The Timeline which should be filed with
   * events.
   *
   * @param {Room} room The room for which we should fetch events containing
   * URLs
   *
   * @param {number} limit The maximum number of events to fetch.
   *
   * @param {string} fromEvent From which event should we continue fetching
   * events from the index. This is only needed if we're continuing to fill
   * the timeline, e.g. if we're paginating. This needs to be set to a event
   * id of an event that was previously fetched with this function.
   *
   * @param {string} direction The direction in which we will continue
   * fetching events. EventTimeline.BACKWARDS to continue fetching events that
   * are older than the event given in fromEvent, EventTimeline.FORWARDS to
   * fetch newer events.
   *
   * @returns {Promise<boolean>} Resolves to true if events were added to the
   * timeline, false otherwise.
   */
  async populateFileTimeline(timelineSet, timeline, room) {
    let limit = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 10;
    let fromEvent = arguments.length > 4 ? arguments[4] : undefined;
    let direction = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : _eventTimeline.EventTimeline.BACKWARDS;
    const matrixEvents = await this.loadFileEvents(room, limit, fromEvent, direction);

    // If this is a normal fill request, not a pagination request, we need
    // to get our events in the BACKWARDS direction but populate them in the
    // forwards direction.
    // This needs to happen because a fill request might come with an
    // existing timeline e.g. if you close and re-open the FilePanel.
    if (fromEvent === null) {
      matrixEvents.reverse();
      direction = direction == _eventTimeline.EventTimeline.BACKWARDS ? _eventTimeline.EventTimeline.FORWARDS : _eventTimeline.EventTimeline.BACKWARDS;
    }

    // Add the events to the timeline of the file panel.
    matrixEvents.forEach(e => {
      if (!timelineSet.eventIdToTimeline(e.getId())) {
        timelineSet.addEventToTimeline(e, timeline, direction == _eventTimeline.EventTimeline.BACKWARDS);
      }
    });
    let ret = false;
    let paginationToken = "";

    // Set the pagination token to the oldest event that we retrieved.
    if (matrixEvents.length > 0) {
      paginationToken = matrixEvents[matrixEvents.length - 1].getId();
      ret = true;
    }
    _logger.logger.log("EventIndex: Populating file panel with", matrixEvents.length, "events and setting the pagination token to", paginationToken);
    timeline.setPaginationToken(paginationToken, _eventTimeline.EventTimeline.BACKWARDS);
    return ret;
  }

  /**
   * Emulate a TimelineWindow pagination() request with the event index as the event source
   *
   * Might not fetch events from the index if the timeline already contains
   * events that the window isn't showing.
   *
   * @param {Room} room The room for which we should fetch events containing
   * URLs
   *
   * @param {TimelineWindow} timelineWindow The timeline window that should be
   * populated with new events.
   *
   * @param {string} direction The direction in which we should paginate.
   * EventTimeline.BACKWARDS to paginate back, EventTimeline.FORWARDS to
   * paginate forwards.
   *
   * @param {number} limit The maximum number of events to fetch while
   * paginating.
   *
   * @returns {Promise<boolean>} Resolves to a boolean which is true if more
   * events were successfully retrieved.
   */
  paginateTimelineWindow(room, timelineWindow, direction, limit) {
    const tl = timelineWindow.getTimelineIndex(direction);
    if (!tl) return Promise.resolve(false);
    if (tl.pendingPaginate) return tl.pendingPaginate;
    if (timelineWindow.extend(direction, limit)) {
      return Promise.resolve(true);
    }
    const paginationMethod = async (timelineWindow, timelineIndex, room, direction, limit) => {
      const timeline = timelineIndex.timeline;
      const timelineSet = timeline.getTimelineSet();
      const token = timeline.getPaginationToken(direction) ?? undefined;
      const ret = await this.populateFileTimeline(timelineSet, timeline, room, limit, token, direction);
      timelineIndex.pendingPaginate = undefined;
      timelineWindow.extend(direction, limit);
      return ret;
    };
    const paginationPromise = paginationMethod(timelineWindow, tl, room, direction, limit);
    tl.pendingPaginate = paginationPromise;
    return paginationPromise;
  }

  /**
   * Get statistical information of the index.
   *
   * @return {Promise<IIndexStats>} A promise that will resolve to the index
   * statistics.
   */
  async getStats() {
    const indexManager = _PlatformPeg.default.get()?.getEventIndexingManager();
    return indexManager?.getStats();
  }

  /**
   * Check if the room with the given id is already indexed.
   *
   * @param {string} roomId The ID of the room which we want to check if it
   * has been already indexed.
   *
   * @return {Promise<boolean>} Returns true if the index contains events for
   * the given room, false otherwise.
   */
  async isRoomIndexed(roomId) {
    const indexManager = _PlatformPeg.default.get()?.getEventIndexingManager();
    return indexManager?.isRoomIndexed(roomId);
  }

  /**
   * Get the room that we are currently crawling.
   *
   * @returns {Room} A MatrixRoom that is being currently crawled, null
   * if no room is currently being crawled.
   */
  currentRoom() {
    if (this.currentCheckpoint === null && this.crawlerCheckpoints.length === 0) {
      return null;
    }
    const client = _MatrixClientPeg.MatrixClientPeg.get();
    if (this.currentCheckpoint !== null) {
      return client.getRoom(this.currentCheckpoint.roomId);
    } else {
      return client.getRoom(this.crawlerCheckpoints[0].roomId);
    }
  }
  crawlingRooms() {
    const totalRooms = new Set();
    const crawlingRooms = new Set();
    this.crawlerCheckpoints.forEach((checkpoint, index) => {
      crawlingRooms.add(checkpoint.roomId);
    });
    if (this.currentCheckpoint !== null) {
      crawlingRooms.add(this.currentCheckpoint.roomId);
    }
    const client = _MatrixClientPeg.MatrixClientPeg.get();
    const rooms = client.getRooms();
    const isRoomEncrypted = room => {
      return client.isRoomEncrypted(room.roomId);
    };
    const encryptedRooms = rooms.filter(isRoomEncrypted);
    encryptedRooms.forEach((room, index) => {
      totalRooms.add(room.roomId);
    });
    return {
      crawlingRooms,
      totalRooms
    };
  }
}
exports.default = EventIndex;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfZXZlbnRzIiwicmVxdWlyZSIsIl9yb29tTWVtYmVyIiwiX2V2ZW50VGltZWxpbmUiLCJfcm9vbSIsIl9yb29tU3RhdGUiLCJfdXRpbHMiLCJfbG9nZ2VyIiwiX2V2ZW50IiwiX2NsaWVudCIsIl9odHRwQXBpIiwiX1BsYXRmb3JtUGVnIiwiX2ludGVyb3BSZXF1aXJlRGVmYXVsdCIsIl9NYXRyaXhDbGllbnRQZWciLCJfU2V0dGluZ3NTdG9yZSIsIl9TZXR0aW5nTGV2ZWwiLCJDUkFXTEVSX0lETEVfVElNRSIsIkVWRU5UU19QRVJfQ1JBV0wiLCJFdmVudEluZGV4IiwiRXZlbnRFbWl0dGVyIiwiY29uc3RydWN0b3IiLCJhcmd1bWVudHMiLCJfZGVmaW5lUHJvcGVydHkyIiwiZGVmYXVsdCIsInN0YXRlIiwicHJldlN0YXRlIiwiZGF0YSIsImluZGV4TWFuYWdlciIsIlBsYXRmb3JtUGVnIiwiZ2V0IiwiZ2V0RXZlbnRJbmRleGluZ01hbmFnZXIiLCJldmVudEluZGV4V2FzRW1wdHkiLCJpc0V2ZW50SW5kZXhFbXB0eSIsImFkZEluaXRpYWxDaGVja3BvaW50cyIsInN0YXJ0Q3Jhd2xlciIsImNvbW1pdExpdmVFdmVudHMiLCJldiIsInJvb20iLCJ0b1N0YXJ0T2ZUaW1lbGluZSIsInJlbW92ZWQiLCJjbGllbnQiLCJNYXRyaXhDbGllbnRQZWciLCJpc1Jvb21FbmNyeXB0ZWQiLCJnZXRSb29tSWQiLCJpc1JlZGFjdGlvbiIsInJlZGFjdEV2ZW50IiwibGl2ZUV2ZW50IiwiaXNSZWRhY3RlZCIsImRlY3J5cHRFdmVudElmTmVlZGVkIiwiYWRkTGl2ZUV2ZW50VG9JbmRleCIsInJvb21JZCIsImdldFR5cGUiLCJFdmVudFR5cGUiLCJSb29tRW5jcnlwdGlvbiIsImlzUm9vbUluZGV4ZWQiLCJsb2dnZXIiLCJsb2ciLCJhZGRSb29tQ2hlY2twb2ludCIsImFzc29jaWF0ZWRJZCIsImdldEFzc29jaWF0ZWRJZCIsImRlbGV0ZUV2ZW50IiwiZSIsImluaXQiLCJjcmF3bGVyQ2hlY2twb2ludHMiLCJsb2FkQ2hlY2twb2ludHMiLCJyZWdpc3Rlckxpc3RlbmVycyIsIm9uIiwiQ2xpZW50RXZlbnQiLCJTeW5jIiwib25TeW5jIiwiUm9vbUV2ZW50IiwiVGltZWxpbmUiLCJvblJvb21UaW1lbGluZSIsIlRpbWVsaW5lUmVzZXQiLCJvblRpbWVsaW5lUmVzZXQiLCJSb29tU3RhdGVFdmVudCIsIkV2ZW50cyIsIm9uUm9vbVN0YXRlRXZlbnQiLCJyZW1vdmVMaXN0ZW5lcnMiLCJyZW1vdmVMaXN0ZW5lciIsInJvb21zIiwiZ2V0Um9vbXMiLCJlbmNyeXB0ZWRSb29tcyIsImZpbHRlciIsIlByb21pc2UiLCJhbGwiLCJtYXAiLCJ0aW1lbGluZSIsImdldExpdmVUaW1lbGluZSIsInRva2VuIiwiZ2V0UGFnaW5hdGlvblRva2VuIiwiRGlyZWN0aW9uIiwiQmFja3dhcmQiLCJiYWNrQ2hlY2twb2ludCIsImRpcmVjdGlvbiIsImZ1bGxDcmF3bCIsImZvcndhcmRDaGVja3BvaW50IiwiRm9yd2FyZCIsImFkZENyYXdsZXJDaGVja3BvaW50IiwicHVzaCIsImlzVmFsaWRFdmVudCIsImlzVXNlZnVsVHlwZSIsIlJvb21NZXNzYWdlIiwiUm9vbU5hbWUiLCJSb29tVG9waWMiLCJpbmNsdWRlcyIsInZhbGlkRXZlbnRUeXBlIiwiaXNEZWNyeXB0aW9uRmFpbHVyZSIsInZhbGlkTXNnVHlwZSIsImhhc0NvbnRlbnRWYWx1ZSIsIm1zZ3R5cGUiLCJnZXRDb250ZW50Iiwic3RhcnRzV2l0aCIsImJvZHkiLCJ0b3BpYyIsIm5hbWUiLCJldmVudFRvSnNvbiIsImpzb25FdmVudCIsInRvSlNPTiIsImlzRW5jcnlwdGVkIiwiZGVjcnlwdGVkIiwiY3VydmUyNTUxOUtleSIsImdldFNlbmRlcktleSIsImVkMjU1MTlLZXkiLCJnZXRDbGFpbWVkRWQyNTUxOUtleSIsImFsZ29yaXRobSIsImdldFdpcmVDb250ZW50IiwiZm9yd2FyZGluZ0N1cnZlMjU1MTlLZXlDaGFpbiIsImdldEZvcndhcmRpbmdDdXJ2ZTI1NTE5S2V5Q2hhaW4iLCJwcm9maWxlIiwiZGlzcGxheW5hbWUiLCJzZW5kZXIiLCJyYXdEaXNwbGF5TmFtZSIsImF2YXRhcl91cmwiLCJnZXRNeGNBdmF0YXJVcmwiLCJhZGRFdmVudFRvSW5kZXgiLCJlbWl0TmV3Q2hlY2twb2ludCIsImVtaXQiLCJjdXJyZW50Um9vbSIsImFkZEV2ZW50c0Zyb21MaXZlVGltZWxpbmUiLCJldmVudHMiLCJnZXRFdmVudHMiLCJpIiwibGVuZ3RoIiwidW5kZWZpbmVkIiwiZ2V0Um9vbSIsImNoZWNrcG9pbnQiLCJjcmF3bGVyRnVuYyIsImNhbmNlbGxlZCIsImNyYXdsZXIiLCJjYW5jZWwiLCJpZGxlIiwic2xlZXBUaW1lIiwiU2V0dGluZ3NTdG9yZSIsImdldFZhbHVlQXQiLCJTZXR0aW5nTGV2ZWwiLCJERVZJQ0UiLCJNYXRoIiwibWF4IiwiY3VycmVudENoZWNrcG9pbnQiLCJzbGVlcCIsInNoaWZ0IiwiZXZlbnRNYXBwZXIiLCJnZXRFdmVudE1hcHBlciIsInByZXZlbnRSZUVtaXQiLCJyZXMiLCJjcmVhdGVNZXNzYWdlc1JlcXVlc3QiLCJIVFRQRXJyb3IiLCJodHRwU3RhdHVzIiwicmVtb3ZlQ3Jhd2xlckNoZWNrcG9pbnQiLCJjaHVuayIsIm1hdHJpeEV2ZW50cyIsInN0YXRlRXZlbnRzIiwicHJvZmlsZXMiLCJmb3JFYWNoIiwibWVtYmVyc2hpcCIsImdldFNlbmRlciIsImRlY3J5cHRpb25Qcm9taXNlcyIsImV2ZW50IiwiaXNSZXRyeSIsImZpbHRlcmVkRXZlbnRzIiwicmVkYWN0aW9uRXZlbnRzIiwib2JqZWN0IiwibmV3Q2hlY2twb2ludCIsImVuZCIsImV2ZW50SWQiLCJ3YXJuIiwiZXZlbnRzQWxyZWFkeUFkZGVkIiwiYWRkSGlzdG9yaWNFdmVudHMiLCJzdG9wQ3Jhd2xlciIsImNsb3NlIiwiY2xvc2VFdmVudEluZGV4Iiwic2VhcmNoIiwic2VhcmNoQXJncyIsInNlYXJjaEV2ZW50SW5kZXgiLCJsb2FkRmlsZUV2ZW50cyIsImxpbWl0IiwiZnJvbUV2ZW50IiwiRXZlbnRUaW1lbGluZSIsIkJBQ0tXQVJEUyIsImxvYWRBcmdzIiwibWF0cml4RXZlbnQiLCJtZW1iZXIiLCJSb29tTWVtYmVyIiwibWVtYmVyRXZlbnQiLCJjb250ZW50IiwidHlwZSIsImV2ZW50X2lkIiwiZ2V0SWQiLCJyb29tX2lkIiwib3JpZ2luX3NlcnZlcl90cyIsImdldFRzIiwic3RhdGVfa2V5IiwicG9wdWxhdGVGaWxlVGltZWxpbmUiLCJ0aW1lbGluZVNldCIsInJldmVyc2UiLCJGT1JXQVJEUyIsImV2ZW50SWRUb1RpbWVsaW5lIiwiYWRkRXZlbnRUb1RpbWVsaW5lIiwicmV0IiwicGFnaW5hdGlvblRva2VuIiwic2V0UGFnaW5hdGlvblRva2VuIiwicGFnaW5hdGVUaW1lbGluZVdpbmRvdyIsInRpbWVsaW5lV2luZG93IiwidGwiLCJnZXRUaW1lbGluZUluZGV4IiwicmVzb2x2ZSIsInBlbmRpbmdQYWdpbmF0ZSIsImV4dGVuZCIsInBhZ2luYXRpb25NZXRob2QiLCJ0aW1lbGluZUluZGV4IiwiZ2V0VGltZWxpbmVTZXQiLCJwYWdpbmF0aW9uUHJvbWlzZSIsImdldFN0YXRzIiwiY3Jhd2xpbmdSb29tcyIsInRvdGFsUm9vbXMiLCJTZXQiLCJpbmRleCIsImFkZCIsImV4cG9ydHMiXSwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5kZXhpbmcvRXZlbnRJbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuQ29weXJpZ2h0IDIwMTksIDIwMjEgVGhlIE1hdHJpeC5vcmcgRm91bmRhdGlvbiBDLkkuQy5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4qL1xuXG5pbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tIFwiZXZlbnRzXCI7XG5pbXBvcnQgeyBSb29tTWVtYmVyIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL21vZGVscy9yb29tLW1lbWJlclwiO1xuaW1wb3J0IHsgRGlyZWN0aW9uLCBFdmVudFRpbWVsaW5lIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL21vZGVscy9ldmVudC10aW1lbGluZVwiO1xuaW1wb3J0IHsgUm9vbSwgUm9vbUV2ZW50IH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL21vZGVscy9yb29tXCI7XG5pbXBvcnQgeyBNYXRyaXhFdmVudCB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9tb2RlbHMvZXZlbnRcIjtcbmltcG9ydCB7IEV2ZW50VGltZWxpbmVTZXQsIElSb29tVGltZWxpbmVEYXRhIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL21vZGVscy9ldmVudC10aW1lbGluZS1zZXRcIjtcbmltcG9ydCB7IFJvb21TdGF0ZSwgUm9vbVN0YXRlRXZlbnQgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbW9kZWxzL3Jvb20tc3RhdGVcIjtcbmltcG9ydCB7IFRpbWVsaW5lSW5kZXgsIFRpbWVsaW5lV2luZG93IH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL3RpbWVsaW5lLXdpbmRvd1wiO1xuaW1wb3J0IHsgc2xlZXAgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvdXRpbHNcIjtcbmltcG9ydCB7IElFdmVudFdpdGhSb29tSWQsIElNYXRyaXhQcm9maWxlLCBJUmVzdWx0Um9vbUV2ZW50cyB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9AdHlwZXMvc2VhcmNoXCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbG9nZ2VyXCI7XG5pbXBvcnQgeyBFdmVudFR5cGUgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvQHR5cGVzL2V2ZW50XCI7XG5pbXBvcnQgeyBDbGllbnRFdmVudCwgTWF0cml4Q2xpZW50IH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL2NsaWVudFwiO1xuaW1wb3J0IHsgSVN5bmNTdGF0ZURhdGEsIFN5bmNTdGF0ZSB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9zeW5jXCI7XG5pbXBvcnQgeyBIVFRQRXJyb3IgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvaHR0cC1hcGlcIjtcblxuaW1wb3J0IFBsYXRmb3JtUGVnIGZyb20gXCIuLi9QbGF0Zm9ybVBlZ1wiO1xuaW1wb3J0IHsgTWF0cml4Q2xpZW50UGVnIH0gZnJvbSBcIi4uL01hdHJpeENsaWVudFBlZ1wiO1xuaW1wb3J0IFNldHRpbmdzU3RvcmUgZnJvbSBcIi4uL3NldHRpbmdzL1NldHRpbmdzU3RvcmVcIjtcbmltcG9ydCB7IFNldHRpbmdMZXZlbCB9IGZyb20gXCIuLi9zZXR0aW5ncy9TZXR0aW5nTGV2ZWxcIjtcbmltcG9ydCB7IElDcmF3bGVyQ2hlY2twb2ludCwgSUV2ZW50QW5kUHJvZmlsZSwgSUluZGV4U3RhdHMsIElMb2FkQXJncywgSVNlYXJjaEFyZ3MgfSBmcm9tIFwiLi9CYXNlRXZlbnRJbmRleE1hbmFnZXJcIjtcblxuLy8gVGhlIHRpbWUgaW4gbXMgdGhhdCB0aGUgY3Jhd2xlciB3aWxsIHdhaXQgbG9vcCBpdGVyYXRpb25zIGlmIHRoZXJlXG4vLyBoYXZlIG5vdCBiZWVuIGFueSBjaGVja3BvaW50cyB0byBjb25zdW1lIGluIHRoZSBsYXN0IGl0ZXJhdGlvbi5cbmNvbnN0IENSQVdMRVJfSURMRV9USU1FID0gNTAwMDtcblxuLy8gVGhlIG1heGltdW0gbnVtYmVyIG9mIGV2ZW50cyBvdXIgY3Jhd2xlciBzaG91bGQgZmV0Y2ggaW4gYSBzaW5nbGUgY3Jhd2wuXG5jb25zdCBFVkVOVFNfUEVSX0NSQVdMID0gMTAwO1xuXG5pbnRlcmZhY2UgSUNyYXdsZXIge1xuICAgIGNhbmNlbCgpOiB2b2lkO1xufVxuXG4vKlxuICogRXZlbnQgaW5kZXhpbmcgY2xhc3MgdGhhdCB3cmFwcyB0aGUgcGxhdGZvcm0gc3BlY2lmaWMgZXZlbnQgaW5kZXhpbmcuXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEV2ZW50SW5kZXggZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICAgIHByaXZhdGUgY3Jhd2xlckNoZWNrcG9pbnRzOiBJQ3Jhd2xlckNoZWNrcG9pbnRbXSA9IFtdO1xuICAgIHByaXZhdGUgY3Jhd2xlcjogSUNyYXdsZXIgfCBudWxsID0gbnVsbDtcbiAgICBwcml2YXRlIGN1cnJlbnRDaGVja3BvaW50OiBJQ3Jhd2xlckNoZWNrcG9pbnQgfCBudWxsID0gbnVsbDtcblxuICAgIHB1YmxpYyBhc3luYyBpbml0KCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCBpbmRleE1hbmFnZXIgPSBQbGF0Zm9ybVBlZy5nZXQoKT8uZ2V0RXZlbnRJbmRleGluZ01hbmFnZXIoKTtcbiAgICAgICAgaWYgKCFpbmRleE1hbmFnZXIpIHJldHVybjtcblxuICAgICAgICB0aGlzLmNyYXdsZXJDaGVja3BvaW50cyA9IGF3YWl0IGluZGV4TWFuYWdlci5sb2FkQ2hlY2twb2ludHMoKTtcbiAgICAgICAgbG9nZ2VyLmxvZyhcIkV2ZW50SW5kZXg6IExvYWRlZCBjaGVja3BvaW50c1wiLCB0aGlzLmNyYXdsZXJDaGVja3BvaW50cyk7XG5cbiAgICAgICAgdGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVyIGV2ZW50IGxpc3RlbmVycyB0aGF0IGFyZSBuZWNlc3NhcnkgZm9yIHRoZSBldmVudCBpbmRleCB0byB3b3JrLlxuICAgICAqL1xuICAgIHB1YmxpYyByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcbiAgICAgICAgY29uc3QgY2xpZW50ID0gTWF0cml4Q2xpZW50UGVnLmdldCgpO1xuXG4gICAgICAgIGNsaWVudC5vbihDbGllbnRFdmVudC5TeW5jLCB0aGlzLm9uU3luYyk7XG4gICAgICAgIGNsaWVudC5vbihSb29tRXZlbnQuVGltZWxpbmUsIHRoaXMub25Sb29tVGltZWxpbmUpO1xuICAgICAgICBjbGllbnQub24oUm9vbUV2ZW50LlRpbWVsaW5lUmVzZXQsIHRoaXMub25UaW1lbGluZVJlc2V0KTtcbiAgICAgICAgY2xpZW50Lm9uKFJvb21TdGF0ZUV2ZW50LkV2ZW50cywgdGhpcy5vblJvb21TdGF0ZUV2ZW50KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgdGhlIGV2ZW50IGluZGV4IHNwZWNpZmljIGV2ZW50IGxpc3RlbmVycy5cbiAgICAgKi9cbiAgICBwdWJsaWMgcmVtb3ZlTGlzdGVuZXJzKCk6IHZvaWQge1xuICAgICAgICBjb25zdCBjbGllbnQgPSBNYXRyaXhDbGllbnRQZWcuZ2V0KCk7XG4gICAgICAgIGlmIChjbGllbnQgPT09IG51bGwpIHJldHVybjtcblxuICAgICAgICBjbGllbnQucmVtb3ZlTGlzdGVuZXIoQ2xpZW50RXZlbnQuU3luYywgdGhpcy5vblN5bmMpO1xuICAgICAgICBjbGllbnQucmVtb3ZlTGlzdGVuZXIoUm9vbUV2ZW50LlRpbWVsaW5lLCB0aGlzLm9uUm9vbVRpbWVsaW5lKTtcbiAgICAgICAgY2xpZW50LnJlbW92ZUxpc3RlbmVyKFJvb21FdmVudC5UaW1lbGluZVJlc2V0LCB0aGlzLm9uVGltZWxpbmVSZXNldCk7XG4gICAgICAgIGNsaWVudC5yZW1vdmVMaXN0ZW5lcihSb29tU3RhdGVFdmVudC5FdmVudHMsIHRoaXMub25Sb29tU3RhdGVFdmVudCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IGNyYXdsZXIgY2hlY2twb2ludHMgZm9yIHRoZSBlbmNyeXB0ZWQgcm9vbXMgYW5kIHN0b3JlIHRoZW0gaW4gdGhlIGluZGV4LlxuICAgICAqL1xuICAgIHB1YmxpYyBhc3luYyBhZGRJbml0aWFsQ2hlY2twb2ludHMoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGNvbnN0IGluZGV4TWFuYWdlciA9IFBsYXRmb3JtUGVnLmdldCgpPy5nZXRFdmVudEluZGV4aW5nTWFuYWdlcigpO1xuICAgICAgICBpZiAoIWluZGV4TWFuYWdlcikgcmV0dXJuO1xuICAgICAgICBjb25zdCBjbGllbnQgPSBNYXRyaXhDbGllbnRQZWcuZ2V0KCk7XG4gICAgICAgIGNvbnN0IHJvb21zID0gY2xpZW50LmdldFJvb21zKCk7XG5cbiAgICAgICAgY29uc3QgaXNSb29tRW5jcnlwdGVkID0gKHJvb206IFJvb20pOiBib29sZWFuID0+IHtcbiAgICAgICAgICAgIHJldHVybiBjbGllbnQuaXNSb29tRW5jcnlwdGVkKHJvb20ucm9vbUlkKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBXZSBvbmx5IGNhcmUgdG8gY3Jhd2wgdGhlIGVuY3J5cHRlZCByb29tcywgbm9uLWVuY3J5cHRlZFxuICAgICAgICAvLyByb29tcyBjYW4gdXNlIHRoZSBzZWFyY2ggcHJvdmlkZWQgYnkgdGhlIGhvbWVzZXJ2ZXIuXG4gICAgICAgIGNvbnN0IGVuY3J5cHRlZFJvb21zID0gcm9vbXMuZmlsdGVyKGlzUm9vbUVuY3J5cHRlZCk7XG5cbiAgICAgICAgbG9nZ2VyLmxvZyhcIkV2ZW50SW5kZXg6IEFkZGluZyBpbml0aWFsIGNyYXdsZXIgY2hlY2twb2ludHNcIik7XG5cbiAgICAgICAgLy8gR2F0aGVyIHRoZSBwcmV2X2JhdGNoIHRva2VucyBhbmQgY3JlYXRlIGNoZWNrcG9pbnRzIGZvclxuICAgICAgICAvLyBvdXIgbWVzc2FnZSBjcmF3bGVyLlxuICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgICAgIGVuY3J5cHRlZFJvb21zLm1hcChhc3luYyAocm9vbSk6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRpbWVsaW5lID0gcm9vbS5nZXRMaXZlVGltZWxpbmUoKTtcbiAgICAgICAgICAgICAgICBjb25zdCB0b2tlbiA9IHRpbWVsaW5lLmdldFBhZ2luYXRpb25Ub2tlbihEaXJlY3Rpb24uQmFja3dhcmQpO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgYmFja0NoZWNrcG9pbnQ6IElDcmF3bGVyQ2hlY2twb2ludCA9IHtcbiAgICAgICAgICAgICAgICAgICAgcm9vbUlkOiByb29tLnJvb21JZCxcbiAgICAgICAgICAgICAgICAgICAgdG9rZW46IHRva2VuLFxuICAgICAgICAgICAgICAgICAgICBkaXJlY3Rpb246IERpcmVjdGlvbi5CYWNrd2FyZCxcbiAgICAgICAgICAgICAgICAgICAgZnVsbENyYXdsOiB0cnVlLFxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICBjb25zdCBmb3J3YXJkQ2hlY2twb2ludDogSUNyYXdsZXJDaGVja3BvaW50ID0ge1xuICAgICAgICAgICAgICAgICAgICByb29tSWQ6IHJvb20ucm9vbUlkLFxuICAgICAgICAgICAgICAgICAgICB0b2tlbjogdG9rZW4sXG4gICAgICAgICAgICAgICAgICAgIGRpcmVjdGlvbjogRGlyZWN0aW9uLkZvcndhcmQsXG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChiYWNrQ2hlY2twb2ludC50b2tlbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgaW5kZXhNYW5hZ2VyLmFkZENyYXdsZXJDaGVja3BvaW50KGJhY2tDaGVja3BvaW50KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY3Jhd2xlckNoZWNrcG9pbnRzLnB1c2goYmFja0NoZWNrcG9pbnQpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGZvcndhcmRDaGVja3BvaW50LnRva2VuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBpbmRleE1hbmFnZXIuYWRkQ3Jhd2xlckNoZWNrcG9pbnQoZm9yd2FyZENoZWNrcG9pbnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jcmF3bGVyQ2hlY2twb2ludHMucHVzaChmb3J3YXJkQ2hlY2twb2ludCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coXG4gICAgICAgICAgICAgICAgICAgICAgICBcIkV2ZW50SW5kZXg6IEVycm9yIGFkZGluZyBpbml0aWFsIGNoZWNrcG9pbnRzIGZvciByb29tXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICByb29tLnJvb21JZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGJhY2tDaGVja3BvaW50LFxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yd2FyZENoZWNrcG9pbnQsXG4gICAgICAgICAgICAgICAgICAgICAgICBlLFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pLFxuICAgICAgICApO1xuICAgIH1cblxuICAgIC8qXG4gICAgICogVGhlIHN5bmMgZXZlbnQgbGlzdGVuZXIuXG4gICAgICpcbiAgICAgKiBUaGUgbGlzdGVuZXIgaGFzIHR3byBjYXNlczpcbiAgICAgKiAgICAgLSBGaXJzdCBzeW5jIGFmdGVyIHN0YXJ0IHVwLCBjaGVjayBpZiB0aGUgaW5kZXggaXMgZW1wdHksIGFkZFxuICAgICAqICAgICAgICAgaW5pdGlhbCBjaGVja3BvaW50cywgaWYgc28uIFN0YXJ0IHRoZSBjcmF3bGVyIGJhY2tncm91bmQgdGFzay5cbiAgICAgKiAgICAgLSBFdmVyeSBvdGhlciBzeW5jLCB0ZWxsIHRoZSBldmVudCBpbmRleCB0byBjb21taXQgYWxsIHRoZSBxdWV1ZWQgdXBcbiAgICAgKiAgICAgICAgIGxpdmUgZXZlbnRzXG4gICAgICovXG4gICAgcHJpdmF0ZSBvblN5bmMgPSBhc3luYyAoc3RhdGU6IFN5bmNTdGF0ZSwgcHJldlN0YXRlOiBTeW5jU3RhdGUgfCBudWxsLCBkYXRhPzogSVN5bmNTdGF0ZURhdGEpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgICAgY29uc3QgaW5kZXhNYW5hZ2VyID0gUGxhdGZvcm1QZWcuZ2V0KCk/LmdldEV2ZW50SW5kZXhpbmdNYW5hZ2VyKCk7XG4gICAgICAgIGlmICghaW5kZXhNYW5hZ2VyKSByZXR1cm47XG5cbiAgICAgICAgaWYgKHByZXZTdGF0ZSA9PT0gXCJQUkVQQVJFRFwiICYmIHN0YXRlID09PSBcIlNZTkNJTkdcIikge1xuICAgICAgICAgICAgLy8gSWYgb3VyIGluZGV4ZXIgaXMgZW1wdHkgd2UncmUgbW9zdCBsaWtlbHkgcnVubmluZyBFbGVtZW50IHRoZVxuICAgICAgICAgICAgLy8gZmlyc3QgdGltZSB3aXRoIGluZGV4aW5nIHN1cHBvcnQgb3IgcnVubmluZyBpdCB3aXRoIGFuXG4gICAgICAgICAgICAvLyBpbml0aWFsIHN5bmMuIEFkZCBjaGVja3BvaW50cyB0byBjcmF3bCBvdXIgZW5jcnlwdGVkIHJvb21zLlxuICAgICAgICAgICAgY29uc3QgZXZlbnRJbmRleFdhc0VtcHR5ID0gYXdhaXQgaW5kZXhNYW5hZ2VyLmlzRXZlbnRJbmRleEVtcHR5KCk7XG4gICAgICAgICAgICBpZiAoZXZlbnRJbmRleFdhc0VtcHR5KSBhd2FpdCB0aGlzLmFkZEluaXRpYWxDaGVja3BvaW50cygpO1xuXG4gICAgICAgICAgICB0aGlzLnN0YXJ0Q3Jhd2xlcigpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHByZXZTdGF0ZSA9PT0gXCJTWU5DSU5HXCIgJiYgc3RhdGUgPT09IFwiU1lOQ0lOR1wiKSB7XG4gICAgICAgICAgICAvLyBBIHN5bmMgd2FzIGRvbmUsIHByZXN1bWFibHkgd2UgcXVldWVkIHVwIHNvbWUgbGl2ZSBldmVudHMsXG4gICAgICAgICAgICAvLyBjb21taXQgdGhlbSBub3cuXG4gICAgICAgICAgICBhd2FpdCBpbmRleE1hbmFnZXIuY29tbWl0TGl2ZUV2ZW50cygpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qXG4gICAgICogVGhlIFJvb20udGltZWxpbmUgbGlzdGVuZXIuXG4gICAgICpcbiAgICAgKiBUaGlzIGxpc3RlbmVyIHdhaXRzIGZvciBsaXZlIGV2ZW50cyBpbiBlbmNyeXB0ZWQgcm9vbXMsIGlmIHRoZXkgYXJlXG4gICAgICogZGVjcnlwdGVkIG9yIHVuZW5jcnlwdGVkIHdlIHF1ZXVlIHRoZW0gdG8gYmUgYWRkZWQgdG8gdGhlIGluZGV4LFxuICAgICAqIG90aGVyd2lzZSB3ZSBzYXZlIHRoZWlyIGV2ZW50IGlkIGFuZCB3YWl0IGZvciB0aGVtIGluIHRoZSBFdmVudC5kZWNyeXB0ZWRcbiAgICAgKiBsaXN0ZW5lci5cbiAgICAgKi9cbiAgICBwcml2YXRlIG9uUm9vbVRpbWVsaW5lID0gYXN5bmMgKFxuICAgICAgICBldjogTWF0cml4RXZlbnQsXG4gICAgICAgIHJvb206IFJvb20gfCB1bmRlZmluZWQsXG4gICAgICAgIHRvU3RhcnRPZlRpbWVsaW5lOiBib29sZWFuIHwgdW5kZWZpbmVkLFxuICAgICAgICByZW1vdmVkOiBib29sZWFuLFxuICAgICAgICBkYXRhOiBJUm9vbVRpbWVsaW5lRGF0YSxcbiAgICApOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgICAgaWYgKCFyb29tKSByZXR1cm47IC8vIG5vdGlmaWNhdGlvbiB0aW1lbGluZSwgd2UnbGwgZ2V0IHRoaXMgZXZlbnQgYWdhaW4gd2l0aCBhIHJvb20gc3BlY2lmaWMgdGltZWxpbmVcblxuICAgICAgICBjb25zdCBjbGllbnQgPSBNYXRyaXhDbGllbnRQZWcuZ2V0KCk7XG5cbiAgICAgICAgLy8gV2Ugb25seSBpbmRleCBlbmNyeXB0ZWQgcm9vbXMgbG9jYWxseS5cbiAgICAgICAgaWYgKCFjbGllbnQuaXNSb29tRW5jcnlwdGVkKGV2LmdldFJvb21JZCgpISkpIHJldHVybjtcblxuICAgICAgICBpZiAoZXYuaXNSZWRhY3Rpb24oKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVkYWN0RXZlbnQoZXYpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgaXQgaXNuJ3QgYSBsaXZlIGV2ZW50IG9yIGlmIGl0J3MgcmVkYWN0ZWQgdGhlcmUncyBub3RoaW5nIHRvIGRvLlxuICAgICAgICBpZiAodG9TdGFydE9mVGltZWxpbmUgfHwgIWRhdGEgfHwgIWRhdGEubGl2ZUV2ZW50IHx8IGV2LmlzUmVkYWN0ZWQoKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgY2xpZW50LmRlY3J5cHRFdmVudElmTmVlZGVkKGV2KTtcblxuICAgICAgICBhd2FpdCB0aGlzLmFkZExpdmVFdmVudFRvSW5kZXgoZXYpO1xuICAgIH07XG5cbiAgICBwcml2YXRlIG9uUm9vbVN0YXRlRXZlbnQgPSBhc3luYyAoZXY6IE1hdHJpeEV2ZW50LCBzdGF0ZTogUm9vbVN0YXRlKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICAgIGlmICghTWF0cml4Q2xpZW50UGVnLmdldCgpLmlzUm9vbUVuY3J5cHRlZChzdGF0ZS5yb29tSWQpKSByZXR1cm47XG5cbiAgICAgICAgaWYgKGV2LmdldFR5cGUoKSA9PT0gRXZlbnRUeXBlLlJvb21FbmNyeXB0aW9uICYmICEoYXdhaXQgdGhpcy5pc1Jvb21JbmRleGVkKHN0YXRlLnJvb21JZCkpKSB7XG4gICAgICAgICAgICBsb2dnZXIubG9nKFwiRXZlbnRJbmRleDogQWRkaW5nIGEgY2hlY2twb2ludCBmb3IgYSBuZXdseSBlbmNyeXB0ZWQgcm9vbVwiLCBzdGF0ZS5yb29tSWQpO1xuICAgICAgICAgICAgdGhpcy5hZGRSb29tQ2hlY2twb2ludChzdGF0ZS5yb29tSWQsIHRydWUpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qXG4gICAgICogUmVtb3ZlcyBhIHJlZGFjdGVkIGV2ZW50IGZyb20gb3VyIGV2ZW50IGluZGV4LlxuICAgICAqIFdlIGNhbm5vdCByZWx5IG9uIFJvb20ucmVkYWN0aW9uIGFzIHRoaXMgb25seSBmaXJlcyBpZiB0aGUgcmVkYWN0aW9uIGFwcGxpZWQgdG8gYW4gZXZlbnQgdGhlIGpzLXNkayBoYXMgbG9hZGVkLlxuICAgICAqL1xuICAgIHByaXZhdGUgcmVkYWN0RXZlbnQgPSBhc3luYyAoZXY6IE1hdHJpeEV2ZW50KTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICAgIGNvbnN0IGluZGV4TWFuYWdlciA9IFBsYXRmb3JtUGVnLmdldCgpPy5nZXRFdmVudEluZGV4aW5nTWFuYWdlcigpO1xuICAgICAgICBpZiAoIWluZGV4TWFuYWdlcikgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IGFzc29jaWF0ZWRJZCA9IGV2LmdldEFzc29jaWF0ZWRJZCgpO1xuICAgICAgICBpZiAoIWFzc29jaWF0ZWRJZCkgcmV0dXJuO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBpbmRleE1hbmFnZXIuZGVsZXRlRXZlbnQoYXNzb2NpYXRlZElkKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgbG9nZ2VyLmxvZyhcIkV2ZW50SW5kZXg6IEVycm9yIGRlbGV0aW5nIGV2ZW50IGZyb20gaW5kZXhcIiwgZSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLypcbiAgICAgKiBUaGUgUm9vbS50aW1lbGluZVJlc2V0IGxpc3RlbmVyLlxuICAgICAqXG4gICAgICogTGlzdGVucyBmb3IgdGltZWxpbmUgcmVzZXRzIHRoYXQgYXJlIGNhdXNlZCBieSBhIGxpbWl0ZWQgdGltZWxpbmUgdG9cbiAgICAgKiByZS1hZGQgY2hlY2twb2ludHMgZm9yIHJvb21zIHRoYXQgbmVlZCB0byBiZSBjcmF3bGVkIGFnYWluLlxuICAgICAqL1xuICAgIHByaXZhdGUgb25UaW1lbGluZVJlc2V0ID0gYXN5bmMgKHJvb206IFJvb20gfCB1bmRlZmluZWQpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgICAgaWYgKCFyb29tKSByZXR1cm47XG4gICAgICAgIGlmICghTWF0cml4Q2xpZW50UGVnLmdldCgpLmlzUm9vbUVuY3J5cHRlZChyb29tLnJvb21JZCkpIHJldHVybjtcblxuICAgICAgICBsb2dnZXIubG9nKFwiRXZlbnRJbmRleDogQWRkaW5nIGEgY2hlY2twb2ludCBiZWNhdXNlIG9mIGEgbGltaXRlZCB0aW1lbGluZVwiLCByb29tLnJvb21JZCk7XG5cbiAgICAgICAgdGhpcy5hZGRSb29tQ2hlY2twb2ludChyb29tLnJvb21JZCwgZmFsc2UpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiBhbiBldmVudCBzaG91bGQgYmUgYWRkZWQgdG8gdGhlIGV2ZW50IGluZGV4LlxuICAgICAqXG4gICAgICogTW9zdCBub3RhYmx5IHdlIGZpbHRlciBldmVudHMgZm9yIHdoaWNoIGRlY3J5cHRpb24gZmFpbGVkLCBhcmUgcmVkYWN0ZWRcbiAgICAgKiBvciBhcmVuJ3Qgb2YgYSB0eXBlIHRoYXQgd2Uga25vdyBob3cgdG8gaW5kZXguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01hdHJpeEV2ZW50fSBldiBUaGUgZXZlbnQgdGhhdCBzaG91bGQgYmUgY2hlY2tlZC5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbH0gUmV0dXJucyB0cnVlIGlmIHRoZSBldmVudCBjYW4gYmUgaW5kZXhlZCwgZmFsc2VcbiAgICAgKiBvdGhlcndpc2UuXG4gICAgICovXG4gICAgcHJpdmF0ZSBpc1ZhbGlkRXZlbnQoZXY6IE1hdHJpeEV2ZW50KTogYm9vbGVhbiB7XG4gICAgICAgIGNvbnN0IGlzVXNlZnVsVHlwZSA9IFtFdmVudFR5cGUuUm9vbU1lc3NhZ2UsIEV2ZW50VHlwZS5Sb29tTmFtZSwgRXZlbnRUeXBlLlJvb21Ub3BpY10uaW5jbHVkZXMoXG4gICAgICAgICAgICBldi5nZXRUeXBlKCkgYXMgRXZlbnRUeXBlLFxuICAgICAgICApO1xuICAgICAgICBjb25zdCB2YWxpZEV2ZW50VHlwZSA9IGlzVXNlZnVsVHlwZSAmJiAhZXYuaXNSZWRhY3RlZCgpICYmICFldi5pc0RlY3J5cHRpb25GYWlsdXJlKCk7XG5cbiAgICAgICAgbGV0IHZhbGlkTXNnVHlwZSA9IHRydWU7XG4gICAgICAgIGxldCBoYXNDb250ZW50VmFsdWUgPSB0cnVlO1xuXG4gICAgICAgIGlmIChldi5nZXRUeXBlKCkgPT09IEV2ZW50VHlwZS5Sb29tTWVzc2FnZSAmJiAhZXYuaXNSZWRhY3RlZCgpKSB7XG4gICAgICAgICAgICAvLyBFeHBhbmQgdGhpcyBpZiB0aGVyZSBhcmUgbW9yZSBpbnZhbGlkIG1zZ3R5cGVzLlxuICAgICAgICAgICAgY29uc3QgbXNndHlwZSA9IGV2LmdldENvbnRlbnQoKS5tc2d0eXBlO1xuXG4gICAgICAgICAgICBpZiAoIW1zZ3R5cGUpIHZhbGlkTXNnVHlwZSA9IGZhbHNlO1xuICAgICAgICAgICAgZWxzZSB2YWxpZE1zZ1R5cGUgPSAhbXNndHlwZS5zdGFydHNXaXRoKFwibS5rZXkudmVyaWZpY2F0aW9uXCIpO1xuXG4gICAgICAgICAgICBpZiAoIWV2LmdldENvbnRlbnQoKS5ib2R5KSBoYXNDb250ZW50VmFsdWUgPSBmYWxzZTtcbiAgICAgICAgfSBlbHNlIGlmIChldi5nZXRUeXBlKCkgPT09IEV2ZW50VHlwZS5Sb29tVG9waWMgJiYgIWV2LmlzUmVkYWN0ZWQoKSkge1xuICAgICAgICAgICAgaWYgKCFldi5nZXRDb250ZW50KCkudG9waWMpIGhhc0NvbnRlbnRWYWx1ZSA9IGZhbHNlO1xuICAgICAgICB9IGVsc2UgaWYgKGV2LmdldFR5cGUoKSA9PT0gRXZlbnRUeXBlLlJvb21OYW1lICYmICFldi5pc1JlZGFjdGVkKCkpIHtcbiAgICAgICAgICAgIGlmICghZXYuZ2V0Q29udGVudCgpLm5hbWUpIGhhc0NvbnRlbnRWYWx1ZSA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHZhbGlkRXZlbnRUeXBlICYmIHZhbGlkTXNnVHlwZSAmJiBoYXNDb250ZW50VmFsdWU7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBldmVudFRvSnNvbihldjogTWF0cml4RXZlbnQpOiBJRXZlbnRXaXRoUm9vbUlkIHtcbiAgICAgICAgY29uc3QganNvbkV2ZW50OiBhbnkgPSBldi50b0pTT04oKTtcbiAgICAgICAgY29uc3QgZSA9IGV2LmlzRW5jcnlwdGVkKCkgPyBqc29uRXZlbnQuZGVjcnlwdGVkIDoganNvbkV2ZW50O1xuXG4gICAgICAgIGlmIChldi5pc0VuY3J5cHRlZCgpKSB7XG4gICAgICAgICAgICAvLyBMZXQgdXMgc3RvcmUgc29tZSBhZGRpdGlvbmFsIGRhdGEgc28gd2UgY2FuIHJlLXZlcmlmeSB0aGUgZXZlbnQuXG4gICAgICAgICAgICAvLyBUaGUganMtc2RrIGNoZWNrcyBpZiBhbiBldmVudCBpcyBlbmNyeXB0ZWQgdXNpbmcgdGhlIGFsZ29yaXRobSxcbiAgICAgICAgICAgIC8vIHRoZSBzZW5kZXIga2V5IGFuZCBlZDI1NTE5IHNpZ25pbmcga2V5IGFyZSB1c2VkIHRvIGZpbmQgdGhlXG4gICAgICAgICAgICAvLyBjb3JyZWN0IGRldmljZSB0aGF0IHNlbnQgdGhlIGV2ZW50IHdoaWNoIGFsbG93cyB1cyB0byBjaGVjayB0aGVcbiAgICAgICAgICAgIC8vIHZlcmlmaWNhdGlvbiBzdGF0ZSBvZiB0aGUgZXZlbnQsIGVpdGhlciBkaXJlY3RseSBvciB1c2luZyBjcm9zc1xuICAgICAgICAgICAgLy8gc2lnbmluZy5cbiAgICAgICAgICAgIGUuY3VydmUyNTUxOUtleSA9IGV2LmdldFNlbmRlcktleSgpO1xuICAgICAgICAgICAgZS5lZDI1NTE5S2V5ID0gZXYuZ2V0Q2xhaW1lZEVkMjU1MTlLZXkoKTtcbiAgICAgICAgICAgIGUuYWxnb3JpdGhtID0gZXYuZ2V0V2lyZUNvbnRlbnQoKS5hbGdvcml0aG07XG4gICAgICAgICAgICBlLmZvcndhcmRpbmdDdXJ2ZTI1NTE5S2V5Q2hhaW4gPSBldi5nZXRGb3J3YXJkaW5nQ3VydmUyNTUxOUtleUNoYWluKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBNYWtlIHN1cmUgdGhhdCB1bmVuY3J5cHRlZCBldmVudHMgZG9uJ3QgY29udGFpbiBhbnkgb2YgdGhhdCBkYXRhLFxuICAgICAgICAgICAgLy8gZGVzcGl0ZSB3aGF0IHRoZSBzZXJ2ZXIgbWlnaHQgZ2l2ZSB0byB1cy5cbiAgICAgICAgICAgIGRlbGV0ZSBlLmN1cnZlMjU1MTlLZXk7XG4gICAgICAgICAgICBkZWxldGUgZS5lZDI1NTE5S2V5O1xuICAgICAgICAgICAgZGVsZXRlIGUuYWxnb3JpdGhtO1xuICAgICAgICAgICAgZGVsZXRlIGUuZm9yd2FyZGluZ0N1cnZlMjU1MTlLZXlDaGFpbjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFF1ZXVlIHVwIGxpdmUgZXZlbnRzIHRvIGJlIGFkZGVkIHRvIHRoZSBldmVudCBpbmRleC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TWF0cml4RXZlbnR9IGV2IFRoZSBldmVudCB0aGF0IHNob3VsZCBiZSBhZGRlZCB0byB0aGUgaW5kZXguXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBhZGRMaXZlRXZlbnRUb0luZGV4KGV2OiBNYXRyaXhFdmVudCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCBpbmRleE1hbmFnZXIgPSBQbGF0Zm9ybVBlZy5nZXQoKT8uZ2V0RXZlbnRJbmRleGluZ01hbmFnZXIoKTtcblxuICAgICAgICBpZiAoIWluZGV4TWFuYWdlciB8fCAhdGhpcy5pc1ZhbGlkRXZlbnQoZXYpKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgZSA9IHRoaXMuZXZlbnRUb0pzb24oZXYpO1xuXG4gICAgICAgIGNvbnN0IHByb2ZpbGUgPSB7XG4gICAgICAgICAgICBkaXNwbGF5bmFtZTogZXYuc2VuZGVyPy5yYXdEaXNwbGF5TmFtZSxcbiAgICAgICAgICAgIGF2YXRhcl91cmw6IGV2LnNlbmRlcj8uZ2V0TXhjQXZhdGFyVXJsKCksXG4gICAgICAgIH07XG5cbiAgICAgICAgYXdhaXQgaW5kZXhNYW5hZ2VyLmFkZEV2ZW50VG9JbmRleChlLCBwcm9maWxlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbW1pdCB0aGF0IHRoZSBjcmF3bGVyIGhhcyBjaGFuZ2VkIHRoZSBjaGVja3BvaW50IHRoYXQgaXQncyBjdXJyZW50bHlcbiAgICAgKiBoYW5kbGluZy5cbiAgICAgKi9cbiAgICBwcml2YXRlIGVtaXROZXdDaGVja3BvaW50KCk6IHZvaWQge1xuICAgICAgICB0aGlzLmVtaXQoXCJjaGFuZ2VkQ2hlY2twb2ludFwiLCB0aGlzLmN1cnJlbnRSb29tKCkpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgYWRkRXZlbnRzRnJvbUxpdmVUaW1lbGluZSh0aW1lbGluZTogRXZlbnRUaW1lbGluZSk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCBldmVudHMgPSB0aW1lbGluZS5nZXRFdmVudHMoKTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGV2ZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZXYgPSBldmVudHNbaV07XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmFkZExpdmVFdmVudFRvSW5kZXgoZXYpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBhZGRSb29tQ2hlY2twb2ludChyb29tSWQ6IHN0cmluZywgZnVsbENyYXdsID0gZmFsc2UpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgY29uc3QgaW5kZXhNYW5hZ2VyID0gUGxhdGZvcm1QZWcuZ2V0KCk/LmdldEV2ZW50SW5kZXhpbmdNYW5hZ2VyKCk7XG4gICAgICAgIGlmICghaW5kZXhNYW5hZ2VyKSByZXR1cm47XG4gICAgICAgIGNvbnN0IGNsaWVudCA9IE1hdHJpeENsaWVudFBlZy5nZXQoKTtcbiAgICAgICAgY29uc3Qgcm9vbSA9IGNsaWVudC5nZXRSb29tKHJvb21JZCk7XG5cbiAgICAgICAgaWYgKCFyb29tKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgdGltZWxpbmUgPSByb29tLmdldExpdmVUaW1lbGluZSgpO1xuICAgICAgICBjb25zdCB0b2tlbiA9IHRpbWVsaW5lLmdldFBhZ2luYXRpb25Ub2tlbihEaXJlY3Rpb24uQmFja3dhcmQpO1xuXG4gICAgICAgIGlmICghdG9rZW4pIHtcbiAgICAgICAgICAgIC8vIFRoZSByb29tIGRvZXNuJ3QgY29udGFpbiBhbnkgdG9rZW5zLCBtZWFuaW5nIHRoZSBsaXZlIHRpbWVsaW5lXG4gICAgICAgICAgICAvLyBjb250YWlucyBhbGwgdGhlIGV2ZW50cywgYWRkIHRob3NlIHRvIHRoZSBpbmRleC5cbiAgICAgICAgICAgIGF3YWl0IHRoaXMuYWRkRXZlbnRzRnJvbUxpdmVUaW1lbGluZSh0aW1lbGluZSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjaGVja3BvaW50ID0ge1xuICAgICAgICAgICAgcm9vbUlkOiByb29tLnJvb21JZCxcbiAgICAgICAgICAgIHRva2VuOiB0b2tlbixcbiAgICAgICAgICAgIGZ1bGxDcmF3bDogZnVsbENyYXdsLFxuICAgICAgICAgICAgZGlyZWN0aW9uOiBEaXJlY3Rpb24uQmFja3dhcmQsXG4gICAgICAgIH07XG5cbiAgICAgICAgbG9nZ2VyLmxvZyhcIkV2ZW50SW5kZXg6IEFkZGluZyBjaGVja3BvaW50XCIsIGNoZWNrcG9pbnQpO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBpbmRleE1hbmFnZXIuYWRkQ3Jhd2xlckNoZWNrcG9pbnQoY2hlY2twb2ludCk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGxvZ2dlci5sb2coXCJFdmVudEluZGV4OiBFcnJvciBhZGRpbmcgbmV3IGNoZWNrcG9pbnQgZm9yIHJvb21cIiwgcm9vbS5yb29tSWQsIGNoZWNrcG9pbnQsIGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jcmF3bGVyQ2hlY2twb2ludHMucHVzaChjaGVja3BvaW50KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWFpbiBjcmF3bGVyIGxvb3AuXG4gICAgICpcbiAgICAgKiBHb2VzIHRocm91Z2ggY3Jhd2xlckNoZWNrcG9pbnRzIGFuZCBmZXRjaGVzIGV2ZW50cyBmcm9tIHRoZSBzZXJ2ZXIgdG8gYmVcbiAgICAgKiBhZGRlZCB0byB0aGUgRXZlbnRJbmRleC5cbiAgICAgKlxuICAgICAqIElmIGEgL3Jvb20ve3Jvb21JZH0vbWVzc2FnZXMgcmVxdWVzdCBkb2Vzbid0IGNvbnRhaW4gYW55IGV2ZW50cywgc3RvcCB0aGVcbiAgICAgKiBjcmF3bCwgb3RoZXJ3aXNlIGNyZWF0ZSBhIG5ldyBjaGVja3BvaW50IGFuZCBwdXNoIGl0IHRvIHRoZVxuICAgICAqIGNyYXdsZXJDaGVja3BvaW50cyBxdWV1ZSwgc28gd2UgZ28gdGhyb3VnaCB0aGVtIGluIGEgcm91bmQtcm9iaW4gd2F5LlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgY3Jhd2xlckZ1bmMoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGxldCBjYW5jZWxsZWQgPSBmYWxzZTtcblxuICAgICAgICBjb25zdCBjbGllbnQgPSBNYXRyaXhDbGllbnRQZWcuZ2V0KCk7XG4gICAgICAgIGNvbnN0IGluZGV4TWFuYWdlciA9IFBsYXRmb3JtUGVnLmdldCgpPy5nZXRFdmVudEluZGV4aW5nTWFuYWdlcigpO1xuICAgICAgICBpZiAoIWluZGV4TWFuYWdlcikgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuY3Jhd2xlciA9IHtcbiAgICAgICAgICAgIGNhbmNlbDogKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNhbmNlbGxlZCA9IHRydWU7XG4gICAgICAgICAgICB9LFxuICAgICAgICB9O1xuXG4gICAgICAgIGxldCBpZGxlID0gZmFsc2U7XG5cbiAgICAgICAgd2hpbGUgKCFjYW5jZWxsZWQpIHtcbiAgICAgICAgICAgIGxldCBzbGVlcFRpbWUgPSBTZXR0aW5nc1N0b3JlLmdldFZhbHVlQXQoU2V0dGluZ0xldmVsLkRFVklDRSwgXCJjcmF3bGVyU2xlZXBUaW1lXCIpO1xuXG4gICAgICAgICAgICAvLyBEb24ndCBsZXQgdGhlIHVzZXIgY29uZmlndXJlIGEgbG93ZXIgc2xlZXAgdGltZSB0aGFuIDEwMCBtcy5cbiAgICAgICAgICAgIHNsZWVwVGltZSA9IE1hdGgubWF4KHNsZWVwVGltZSwgMTAwKTtcblxuICAgICAgICAgICAgaWYgKGlkbGUpIHtcbiAgICAgICAgICAgICAgICBzbGVlcFRpbWUgPSBDUkFXTEVSX0lETEVfVElNRTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuY3VycmVudENoZWNrcG9pbnQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDaGVja3BvaW50ID0gbnVsbDtcbiAgICAgICAgICAgICAgICB0aGlzLmVtaXROZXdDaGVja3BvaW50KCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGF3YWl0IHNsZWVwKHNsZWVwVGltZSk7XG5cbiAgICAgICAgICAgIGlmIChjYW5jZWxsZWQpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgY2hlY2twb2ludCA9IHRoaXMuY3Jhd2xlckNoZWNrcG9pbnRzLnNoaWZ0KCk7XG5cbiAgICAgICAgICAgIC8vLyBUaGVyZSBpcyBubyBjaGVja3BvaW50IGF2YWlsYWJsZSBjdXJyZW50bHksIG9uZSBtYXkgYXBwZWFyIGlmXG4gICAgICAgICAgICAvLyBhIHN5bmMgd2l0aCBsaW1pdGVkIHJvb20gdGltZWxpbmVzIGhhcHBlbnMsIHNvIGdvIGJhY2sgdG8gc2xlZXAuXG4gICAgICAgICAgICBpZiAoY2hlY2twb2ludCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgaWRsZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuY3VycmVudENoZWNrcG9pbnQgPSBjaGVja3BvaW50O1xuICAgICAgICAgICAgdGhpcy5lbWl0TmV3Q2hlY2twb2ludCgpO1xuXG4gICAgICAgICAgICBpZGxlID0gZmFsc2U7XG5cbiAgICAgICAgICAgIC8vIFdlIGhhdmUgYSBjaGVja3BvaW50LCBsZXQgdXMgZmV0Y2ggc29tZSBtZXNzYWdlcywgYWdhaW4sIHZlcnlcbiAgICAgICAgICAgIC8vIGNvbnNlcnZhdGl2ZWx5IHRvIG5vdCBib3RoZXIgb3VyIGhvbWVzZXJ2ZXIgdG9vIG11Y2guXG4gICAgICAgICAgICBjb25zdCBldmVudE1hcHBlciA9IGNsaWVudC5nZXRFdmVudE1hcHBlcih7IHByZXZlbnRSZUVtaXQ6IHRydWUgfSk7XG4gICAgICAgICAgICAvLyBUT0RPIHdlIG5lZWQgdG8gZW5zdXJlIHRvIHVzZSBtZW1iZXIgbGF6eSBsb2FkaW5nIHdpdGggdGhpc1xuICAgICAgICAgICAgLy8gcmVxdWVzdCBzbyB3ZSBnZXQgdGhlIGNvcnJlY3QgcHJvZmlsZXMuXG4gICAgICAgICAgICBsZXQgcmVzOiBBd2FpdGVkPFJldHVyblR5cGU8TWF0cml4Q2xpZW50W1wiY3JlYXRlTWVzc2FnZXNSZXF1ZXN0XCJdPj47XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcmVzID0gYXdhaXQgY2xpZW50LmNyZWF0ZU1lc3NhZ2VzUmVxdWVzdChcbiAgICAgICAgICAgICAgICAgICAgY2hlY2twb2ludC5yb29tSWQsXG4gICAgICAgICAgICAgICAgICAgIGNoZWNrcG9pbnQudG9rZW4sXG4gICAgICAgICAgICAgICAgICAgIEVWRU5UU19QRVJfQ1JBV0wsXG4gICAgICAgICAgICAgICAgICAgIGNoZWNrcG9pbnQuZGlyZWN0aW9uLFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgaWYgKGUgaW5zdGFuY2VvZiBIVFRQRXJyb3IgJiYgZS5odHRwU3RhdHVzID09PSA0MDMpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiRXZlbnRJbmRleDogUmVtb3ZpbmcgY2hlY2twb2ludCBhcyB3ZSBkb24ndCBoYXZlIFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJwZXJtaXNzaW9ucyB0byBmZXRjaCBtZXNzYWdlcyBmcm9tIHRoaXMgcm9vbS5cIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoZWNrcG9pbnQsXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBpbmRleE1hbmFnZXIucmVtb3ZlQ3Jhd2xlckNoZWNrcG9pbnQoY2hlY2twb2ludCk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coXCJFdmVudEluZGV4OiBFcnJvciByZW1vdmluZyBjaGVja3BvaW50XCIsIGNoZWNrcG9pbnQsIGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gV2UgZG9uJ3QgcHVzaCB0aGUgY2hlY2twb2ludCBoZXJlIGJhY2ssIGl0IHdpbGxcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGhvcGVmdWxseSBiZSByZW1vdmVkIGFmdGVyIGEgcmVzdGFydC4gQnV0IGxldCB1c1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gaWdub3JlIGl0IGZvciBub3cgYXMgd2UgZG9uJ3Qgd2FudCB0byBoYW1tZXIgdGhlXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBlbmRwb2ludC5cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBsb2dnZXIubG9nKFwiRXZlbnRJbmRleDogRXJyb3IgY3Jhd2xpbmcgdXNpbmcgY2hlY2twb2ludDpcIiwgY2hlY2twb2ludCwgXCIsXCIsIGUpO1xuICAgICAgICAgICAgICAgIHRoaXMuY3Jhd2xlckNoZWNrcG9pbnRzLnB1c2goY2hlY2twb2ludCk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChjYW5jZWxsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNyYXdsZXJDaGVja3BvaW50cy5wdXNoKGNoZWNrcG9pbnQpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocmVzLmNodW5rLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coXCJFdmVudEluZGV4OiBEb25lIHdpdGggdGhlIGNoZWNrcG9pbnRcIiwgY2hlY2twb2ludCk7XG4gICAgICAgICAgICAgICAgLy8gV2UgZ290IHRvIHRoZSBzdGFydC9lbmQgb2Ygb3VyIHRpbWVsaW5lLCBsZXRzIGp1c3RcbiAgICAgICAgICAgICAgICAvLyBkZWxldGUgb3VyIGNoZWNrcG9pbnQgYW5kIGdvIGJhY2sgdG8gc2xlZXAuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgaW5kZXhNYW5hZ2VyLnJlbW92ZUNyYXdsZXJDaGVja3BvaW50KGNoZWNrcG9pbnQpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhcIkV2ZW50SW5kZXg6IEVycm9yIHJlbW92aW5nIGNoZWNrcG9pbnRcIiwgY2hlY2twb2ludCwgZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDb252ZXJ0IHRoZSBwbGFpbiBKU09OIGV2ZW50cyBpbnRvIE1hdHJpeCBldmVudHMgc28gdGhleSBnZXRcbiAgICAgICAgICAgIC8vIGRlY3J5cHRlZCBpZiBuZWNlc3NhcnkuXG4gICAgICAgICAgICBjb25zdCBtYXRyaXhFdmVudHMgPSByZXMuY2h1bmsubWFwKGV2ZW50TWFwcGVyKTtcbiAgICAgICAgICAgIGxldCBzdGF0ZUV2ZW50czogTWF0cml4RXZlbnRbXSA9IFtdO1xuICAgICAgICAgICAgaWYgKHJlcy5zdGF0ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgc3RhdGVFdmVudHMgPSByZXMuc3RhdGUubWFwKGV2ZW50TWFwcGVyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgcHJvZmlsZXM6IFJlY29yZDxzdHJpbmcsIElNYXRyaXhQcm9maWxlPiA9IHt9O1xuXG4gICAgICAgICAgICBzdGF0ZUV2ZW50cy5mb3JFYWNoKChldikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChldi5nZXRDb250ZW50KCkubWVtYmVyc2hpcCA9PT0gXCJqb2luXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgcHJvZmlsZXNbZXYuZ2V0U2VuZGVyKCkhXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRpc3BsYXluYW1lOiBldi5nZXRDb250ZW50KCkuZGlzcGxheW5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBhdmF0YXJfdXJsOiBldi5nZXRDb250ZW50KCkuYXZhdGFyX3VybCxcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgY29uc3QgZGVjcnlwdGlvblByb21pc2VzID0gbWF0cml4RXZlbnRzXG4gICAgICAgICAgICAgICAgLmZpbHRlcigoZXZlbnQpID0+IGV2ZW50LmlzRW5jcnlwdGVkKCkpXG4gICAgICAgICAgICAgICAgLm1hcCgoZXZlbnQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNsaWVudC5kZWNyeXB0RXZlbnRJZk5lZWRlZChldmVudCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgaXNSZXRyeTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVtaXQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gTGV0IHVzIHdhaXQgZm9yIGFsbCB0aGUgZXZlbnRzIHRvIGdldCBkZWNyeXB0ZWQuXG4gICAgICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChkZWNyeXB0aW9uUHJvbWlzZXMpO1xuXG4gICAgICAgICAgICAvLyBUT0RPIGlmIHRoZXJlIGFyZSBubyBldmVudHMgYXQgdGhpcyBwb2ludCB3ZSdyZSBtaXNzaW5nIGEgbG90XG4gICAgICAgICAgICAvLyBkZWNyeXB0aW9uIGtleXMsIGRvIHdlIHdhbnQgdG8gcmV0cnkgdGhpcyBjaGVja3BvaW50IGF0IGEgbGF0ZXJcbiAgICAgICAgICAgIC8vIHN0YWdlP1xuICAgICAgICAgICAgY29uc3QgZmlsdGVyZWRFdmVudHMgPSBtYXRyaXhFdmVudHMuZmlsdGVyKHRoaXMuaXNWYWxpZEV2ZW50KTtcblxuICAgICAgICAgICAgLy8gQ29sbGVjdCB0aGUgcmVkYWN0aW9uIGV2ZW50cywgc28gd2UgY2FuIGRlbGV0ZSB0aGUgcmVkYWN0ZWQgZXZlbnRzIGZyb20gdGhlIGluZGV4LlxuICAgICAgICAgICAgY29uc3QgcmVkYWN0aW9uRXZlbnRzID0gbWF0cml4RXZlbnRzLmZpbHRlcigoZXYpID0+IGV2LmlzUmVkYWN0aW9uKCkpO1xuXG4gICAgICAgICAgICAvLyBMZXQgdXMgY29udmVydCB0aGUgZXZlbnRzIGJhY2sgaW50byBhIGZvcm1hdCB0aGF0IEV2ZW50SW5kZXggY2FuXG4gICAgICAgICAgICAvLyBjb25zdW1lLlxuICAgICAgICAgICAgY29uc3QgZXZlbnRzID0gZmlsdGVyZWRFdmVudHMubWFwKChldikgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGUgPSB0aGlzLmV2ZW50VG9Kc29uKGV2KTtcblxuICAgICAgICAgICAgICAgIGxldCBwcm9maWxlOiBJTWF0cml4UHJvZmlsZSA9IHt9O1xuICAgICAgICAgICAgICAgIGlmIChlLnNlbmRlciBpbiBwcm9maWxlcykgcHJvZmlsZSA9IHByb2ZpbGVzW2Uuc2VuZGVyXTtcbiAgICAgICAgICAgICAgICBjb25zdCBvYmplY3QgPSB7XG4gICAgICAgICAgICAgICAgICAgIGV2ZW50OiBlLFxuICAgICAgICAgICAgICAgICAgICBwcm9maWxlOiBwcm9maWxlLFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9iamVjdDtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBsZXQgbmV3Q2hlY2twb2ludDogSUNyYXdsZXJDaGVja3BvaW50IHwgbnVsbCA9IG51bGw7XG5cbiAgICAgICAgICAgIC8vIFRoZSB0b2tlbiBjYW4gYmUgbnVsbCBmb3Igc29tZSByZWFzb24uIERvbid0IGNyZWF0ZSBhIGNoZWNrcG9pbnRcbiAgICAgICAgICAgIC8vIGluIHRoYXQgY2FzZSBzaW5jZSBhZGRpbmcgaXQgdG8gdGhlIGRiIHdpbGwgZmFpbC5cbiAgICAgICAgICAgIGlmIChyZXMuZW5kKSB7XG4gICAgICAgICAgICAgICAgLy8gQ3JlYXRlIGEgbmV3IGNoZWNrcG9pbnQgc28gd2UgY2FuIGNvbnRpbnVlIGNyYXdsaW5nIHRoZSByb29tXG4gICAgICAgICAgICAgICAgLy8gZm9yIG1lc3NhZ2VzLlxuICAgICAgICAgICAgICAgIG5ld0NoZWNrcG9pbnQgPSB7XG4gICAgICAgICAgICAgICAgICAgIHJvb21JZDogY2hlY2twb2ludC5yb29tSWQsXG4gICAgICAgICAgICAgICAgICAgIHRva2VuOiByZXMuZW5kLFxuICAgICAgICAgICAgICAgICAgICBmdWxsQ3Jhd2w6IGNoZWNrcG9pbnQuZnVsbENyYXdsLFxuICAgICAgICAgICAgICAgICAgICBkaXJlY3Rpb246IGNoZWNrcG9pbnQuZGlyZWN0aW9uLFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZWRhY3Rpb25FdmVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZXYgPSByZWRhY3Rpb25FdmVudHNbaV07XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGV2ZW50SWQgPSBldi5nZXRBc3NvY2lhdGVkSWQoKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoZXZlbnRJZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgaW5kZXhNYW5hZ2VyLmRlbGV0ZUV2ZW50KGV2ZW50SWQpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLndhcm4oXCJFdmVudEluZGV4OiBSZWRhY3Rpb24gZXZlbnQgZG9lc24ndCBjb250YWluIGEgdmFsaWQgYXNzb2NpYXRlZCBldmVudCBpZFwiLCBldik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBldmVudHNBbHJlYWR5QWRkZWQgPSBhd2FpdCBpbmRleE1hbmFnZXIuYWRkSGlzdG9yaWNFdmVudHMoZXZlbnRzLCBuZXdDaGVja3BvaW50LCBjaGVja3BvaW50KTtcblxuICAgICAgICAgICAgICAgIC8vIFdlIGRpZG4ndCBnZXQgYSB2YWxpZCBuZXcgY2hlY2twb2ludCBmcm9tIHRoZSBzZXJ2ZXIsIG5vdGhpbmdcbiAgICAgICAgICAgICAgICAvLyB0byBkbyBoZXJlIGFueW1vcmUuXG4gICAgICAgICAgICAgICAgaWYgKCFuZXdDaGVja3BvaW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coXG4gICAgICAgICAgICAgICAgICAgICAgICBcIkV2ZW50SW5kZXg6IFRoZSBzZXJ2ZXIgZGlkbid0IHJldHVybiBhIHZhbGlkIFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJuZXcgY2hlY2twb2ludCwgbm90IGNvbnRpbnVpbmcgdGhlIGNyYXdsLlwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgY2hlY2twb2ludCxcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gSWYgYWxsIGV2ZW50cyB3ZXJlIGFscmVhZHkgaW5kZXhlZCB3ZSBhc3N1bWUgdGhhdCB3ZSBjYXVnaHRcbiAgICAgICAgICAgICAgICAvLyB1cCB3aXRoIG91ciBpbmRleCBhbmQgZG9uJ3QgbmVlZCB0byBjcmF3bCB0aGUgcm9vbSBmdXJ0aGVyLlxuICAgICAgICAgICAgICAgIC8vIExldCB1cyBkZWxldGUgdGhlIGNoZWNrcG9pbnQgaW4gdGhhdCBjYXNlLCBvdGhlcndpc2UgcHVzaFxuICAgICAgICAgICAgICAgIC8vIHRoZSBuZXcgY2hlY2twb2ludCB0byBiZSB1c2VkIGJ5IHRoZSBjcmF3bGVyLlxuICAgICAgICAgICAgICAgIGlmIChldmVudHNBbHJlYWR5QWRkZWQgPT09IHRydWUgJiYgbmV3Q2hlY2twb2ludC5mdWxsQ3Jhd2wgIT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiRXZlbnRJbmRleDogQ2hlY2twb2ludCBoYWQgYWxyZWFkeSBhbGwgZXZlbnRzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBcImFkZGVkLCBzdG9wcGluZyB0aGUgY3Jhd2xcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoZWNrcG9pbnQsXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IGluZGV4TWFuYWdlci5yZW1vdmVDcmF3bGVyQ2hlY2twb2ludChuZXdDaGVja3BvaW50KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXZlbnRzQWxyZWFkeUFkZGVkID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2dnZXIubG9nKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiRXZlbnRJbmRleDogQ2hlY2twb2ludCBoYWQgYWxyZWFkeSBhbGwgZXZlbnRzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJhZGRlZCwgYnV0IGNvbnRpbnVpbmcgZHVlIHRvIGEgZnVsbCBjcmF3bFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoZWNrcG9pbnQsXG4gICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY3Jhd2xlckNoZWNrcG9pbnRzLnB1c2gobmV3Q2hlY2twb2ludCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coXCJFdmVudEluZGV4OiBFcnJvciBkdXJpbmcgYSBjcmF3bFwiLCBlKTtcbiAgICAgICAgICAgICAgICAvLyBBbiBlcnJvciBvY2N1cnJlZCwgcHV0IHRoZSBjaGVja3BvaW50IGJhY2sgc28gd2VcbiAgICAgICAgICAgICAgICAvLyBjYW4gcmV0cnkuXG4gICAgICAgICAgICAgICAgdGhpcy5jcmF3bGVyQ2hlY2twb2ludHMucHVzaChjaGVja3BvaW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY3Jhd2xlciA9IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RhcnQgdGhlIGNyYXdsZXIgYmFja2dyb3VuZCB0YXNrLlxuICAgICAqL1xuICAgIHB1YmxpYyBzdGFydENyYXdsZXIoKTogdm9pZCB7XG4gICAgICAgIGlmICh0aGlzLmNyYXdsZXIgIT09IG51bGwpIHJldHVybjtcbiAgICAgICAgdGhpcy5jcmF3bGVyRnVuYygpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN0b3AgdGhlIGNyYXdsZXIgYmFja2dyb3VuZCB0YXNrLlxuICAgICAqL1xuICAgIHB1YmxpYyBzdG9wQ3Jhd2xlcigpOiB2b2lkIHtcbiAgICAgICAgaWYgKHRoaXMuY3Jhd2xlciA9PT0gbnVsbCkgcmV0dXJuO1xuICAgICAgICB0aGlzLmNyYXdsZXIuY2FuY2VsKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xvc2UgdGhlIGV2ZW50IGluZGV4LlxuICAgICAqXG4gICAgICogVGhpcyByZW1vdmVzIGFsbCB0aGUgTWF0cml4Q2xpZW50IGV2ZW50IGxpc3RlbmVycywgc3RvcHMgdGhlIGNyYXdsZXJcbiAgICAgKiB0YXNrLCBhbmQgY2xvc2VzIHRoZSBpbmRleC5cbiAgICAgKi9cbiAgICBwdWJsaWMgYXN5bmMgY2xvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGNvbnN0IGluZGV4TWFuYWdlciA9IFBsYXRmb3JtUGVnLmdldCgpPy5nZXRFdmVudEluZGV4aW5nTWFuYWdlcigpO1xuICAgICAgICB0aGlzLnJlbW92ZUxpc3RlbmVycygpO1xuICAgICAgICB0aGlzLnN0b3BDcmF3bGVyKCk7XG4gICAgICAgIGF3YWl0IGluZGV4TWFuYWdlcj8uY2xvc2VFdmVudEluZGV4KCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2VhcmNoIHRoZSBldmVudCBpbmRleCB1c2luZyB0aGUgZ2l2ZW4gdGVybSBmb3IgbWF0Y2hpbmcgZXZlbnRzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtJU2VhcmNoQXJnc30gc2VhcmNoQXJncyBUaGUgc2VhcmNoIGNvbmZpZ3VyYXRpb24gZm9yIHRoZSBzZWFyY2gsXG4gICAgICogc2V0cyB0aGUgc2VhcmNoIHRlcm0gYW5kIGRldGVybWluZXMgdGhlIHNlYXJjaCByZXN1bHQgY29udGVudHMuXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlPElSZXN1bHRSb29tRXZlbnRzW10+fSBBIHByb21pc2UgdGhhdCB3aWxsIHJlc29sdmUgdG8gYW4gYXJyYXlcbiAgICAgKiBvZiBzZWFyY2ggcmVzdWx0cyBvbmNlIHRoZSBzZWFyY2ggaXMgZG9uZS5cbiAgICAgKi9cbiAgICBwdWJsaWMgYXN5bmMgc2VhcmNoKHNlYXJjaEFyZ3M6IElTZWFyY2hBcmdzKTogUHJvbWlzZTxJUmVzdWx0Um9vbUV2ZW50cyB8IHVuZGVmaW5lZD4ge1xuICAgICAgICBjb25zdCBpbmRleE1hbmFnZXIgPSBQbGF0Zm9ybVBlZy5nZXQoKT8uZ2V0RXZlbnRJbmRleGluZ01hbmFnZXIoKTtcbiAgICAgICAgcmV0dXJuIGluZGV4TWFuYWdlcj8uc2VhcmNoRXZlbnRJbmRleChzZWFyY2hBcmdzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMb2FkIGV2ZW50cyB0aGF0IGNvbnRhaW4gVVJMcyBmcm9tIHRoZSBldmVudCBpbmRleC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Um9vbX0gcm9vbSBUaGUgcm9vbSBmb3Igd2hpY2ggd2Ugc2hvdWxkIGZldGNoIGV2ZW50cyBjb250YWluaW5nXG4gICAgICogVVJMc1xuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGxpbWl0IFRoZSBtYXhpbXVtIG51bWJlciBvZiBldmVudHMgdG8gZmV0Y2guXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZnJvbUV2ZW50IEZyb20gd2hpY2ggZXZlbnQgc2hvdWxkIHdlIGNvbnRpbnVlIGZldGNoaW5nXG4gICAgICogZXZlbnRzIGZyb20gdGhlIGluZGV4LiBUaGlzIGlzIG9ubHkgbmVlZGVkIGlmIHdlJ3JlIGNvbnRpbnVpbmcgdG8gZmlsbFxuICAgICAqIHRoZSB0aW1lbGluZSwgZS5nLiBpZiB3ZSdyZSBwYWdpbmF0aW5nLiBUaGlzIG5lZWRzIHRvIGJlIHNldCB0byBhIGV2ZW50XG4gICAgICogaWQgb2YgYW4gZXZlbnQgdGhhdCB3YXMgcHJldmlvdXNseSBmZXRjaGVkIHdpdGggdGhpcyBmdW5jdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBkaXJlY3Rpb24gVGhlIGRpcmVjdGlvbiBpbiB3aGljaCB3ZSB3aWxsIGNvbnRpbnVlXG4gICAgICogZmV0Y2hpbmcgZXZlbnRzLiBFdmVudFRpbWVsaW5lLkJBQ0tXQVJEUyB0byBjb250aW51ZSBmZXRjaGluZyBldmVudHMgdGhhdFxuICAgICAqIGFyZSBvbGRlciB0aGFuIHRoZSBldmVudCBnaXZlbiBpbiBmcm9tRXZlbnQsIEV2ZW50VGltZWxpbmUuRk9SV0FSRFMgdG9cbiAgICAgKiBmZXRjaCBuZXdlciBldmVudHMuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxNYXRyaXhFdmVudFtdPn0gUmVzb2x2ZXMgdG8gYW4gYXJyYXkgb2YgZXZlbnRzIHRoYXRcbiAgICAgKiBjb250YWluIFVSTHMuXG4gICAgICovXG4gICAgcHVibGljIGFzeW5jIGxvYWRGaWxlRXZlbnRzKFxuICAgICAgICByb29tOiBSb29tLFxuICAgICAgICBsaW1pdCA9IDEwLFxuICAgICAgICBmcm9tRXZlbnQ/OiBzdHJpbmcsXG4gICAgICAgIGRpcmVjdGlvbjogc3RyaW5nID0gRXZlbnRUaW1lbGluZS5CQUNLV0FSRFMsXG4gICAgKTogUHJvbWlzZTxNYXRyaXhFdmVudFtdPiB7XG4gICAgICAgIGNvbnN0IGNsaWVudCA9IE1hdHJpeENsaWVudFBlZy5nZXQoKTtcbiAgICAgICAgY29uc3QgaW5kZXhNYW5hZ2VyID0gUGxhdGZvcm1QZWcuZ2V0KCk/LmdldEV2ZW50SW5kZXhpbmdNYW5hZ2VyKCk7XG4gICAgICAgIGlmICghaW5kZXhNYW5hZ2VyKSByZXR1cm4gW107XG5cbiAgICAgICAgY29uc3QgbG9hZEFyZ3M6IElMb2FkQXJncyA9IHtcbiAgICAgICAgICAgIHJvb21JZDogcm9vbS5yb29tSWQsXG4gICAgICAgICAgICBsaW1pdDogbGltaXQsXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKGZyb21FdmVudCkge1xuICAgICAgICAgICAgbG9hZEFyZ3MuZnJvbUV2ZW50ID0gZnJvbUV2ZW50O1xuICAgICAgICAgICAgbG9hZEFyZ3MuZGlyZWN0aW9uID0gZGlyZWN0aW9uO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGV2ZW50czogSUV2ZW50QW5kUHJvZmlsZVtdO1xuXG4gICAgICAgIC8vIEdldCBvdXIgZXZlbnRzIGZyb20gdGhlIGV2ZW50IGluZGV4LlxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgZXZlbnRzID0gYXdhaXQgaW5kZXhNYW5hZ2VyLmxvYWRGaWxlRXZlbnRzKGxvYWRBcmdzKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgbG9nZ2VyLmxvZyhcIkV2ZW50SW5kZXg6IEVycm9yIGdldHRpbmcgZmlsZSBldmVudHNcIiwgZSk7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBldmVudE1hcHBlciA9IGNsaWVudC5nZXRFdmVudE1hcHBlcigpO1xuXG4gICAgICAgIC8vIFR1cm4gdGhlIGV2ZW50cyBpbnRvIE1hdHJpeEV2ZW50IG9iamVjdHMuXG4gICAgICAgIGNvbnN0IG1hdHJpeEV2ZW50cyA9IGV2ZW50cy5tYXAoKGUpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1hdHJpeEV2ZW50ID0gZXZlbnRNYXBwZXIoZS5ldmVudCk7XG5cbiAgICAgICAgICAgIGNvbnN0IG1lbWJlciA9IG5ldyBSb29tTWVtYmVyKHJvb20ucm9vbUlkLCBtYXRyaXhFdmVudC5nZXRTZW5kZXIoKSEpO1xuXG4gICAgICAgICAgICAvLyBXZSBjYW4ndCByZWFsbHkgcmVjb25zdHJ1Y3QgdGhlIHdob2xlIHJvb20gc3RhdGUgZnJvbSBvdXJcbiAgICAgICAgICAgIC8vIEV2ZW50SW5kZXggdG8gY2FsY3VsYXRlIHRoZSBjb3JyZWN0IGRpc3BsYXkgbmFtZS4gVXNlIHRoZVxuICAgICAgICAgICAgLy8gZGlzYW1iaWd1YXRlZCBmb3JtIGFsd2F5cyBpbnN0ZWFkLlxuICAgICAgICAgICAgbWVtYmVyLm5hbWUgPSBlLnByb2ZpbGUuZGlzcGxheW5hbWUgKyBcIiAoXCIgKyBtYXRyaXhFdmVudC5nZXRTZW5kZXIoKSArIFwiKVwiO1xuXG4gICAgICAgICAgICAvLyBUaGlzIGlzIHNldHMgdGhlIGF2YXRhciBVUkwuXG4gICAgICAgICAgICBjb25zdCBtZW1iZXJFdmVudCA9IGV2ZW50TWFwcGVyKHtcbiAgICAgICAgICAgICAgICBjb250ZW50OiB7XG4gICAgICAgICAgICAgICAgICAgIG1lbWJlcnNoaXA6IFwiam9pblwiLFxuICAgICAgICAgICAgICAgICAgICBhdmF0YXJfdXJsOiBlLnByb2ZpbGUuYXZhdGFyX3VybCxcbiAgICAgICAgICAgICAgICAgICAgZGlzcGxheW5hbWU6IGUucHJvZmlsZS5kaXNwbGF5bmFtZSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHR5cGU6IEV2ZW50VHlwZS5Sb29tTWVtYmVyLFxuICAgICAgICAgICAgICAgIGV2ZW50X2lkOiBtYXRyaXhFdmVudC5nZXRJZCgpICsgXCI6ZXZlbnRJbmRleFwiLFxuICAgICAgICAgICAgICAgIHJvb21faWQ6IG1hdHJpeEV2ZW50LmdldFJvb21JZCgpLFxuICAgICAgICAgICAgICAgIHNlbmRlcjogbWF0cml4RXZlbnQuZ2V0U2VuZGVyKCksXG4gICAgICAgICAgICAgICAgb3JpZ2luX3NlcnZlcl90czogbWF0cml4RXZlbnQuZ2V0VHMoKSxcbiAgICAgICAgICAgICAgICBzdGF0ZV9rZXk6IG1hdHJpeEV2ZW50LmdldFNlbmRlcigpLFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIFdlIHNldCB0aGlzIG1hbnVhbGx5IHRvIGF2b2lkIGVtaXR0aW5nIFJvb21NZW1iZXIubWVtYmVyc2hpcCBhbmRcbiAgICAgICAgICAgIC8vIFJvb21NZW1iZXIubmFtZSBldmVudHMuXG4gICAgICAgICAgICBtZW1iZXIuZXZlbnRzLm1lbWJlciA9IG1lbWJlckV2ZW50O1xuICAgICAgICAgICAgbWF0cml4RXZlbnQuc2VuZGVyID0gbWVtYmVyO1xuXG4gICAgICAgICAgICByZXR1cm4gbWF0cml4RXZlbnQ7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBtYXRyaXhFdmVudHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmlsbCBhIHRpbWVsaW5lIHdpdGggZXZlbnRzIHRoYXQgY29udGFpbiBVUkxzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtUaW1lbGluZVNldH0gdGltZWxpbmVTZXQgVGhlIFRpbWVsaW5lU2V0IHRoZSBUaW1lbGluZSBiZWxvbmdzIHRvLFxuICAgICAqIHVzZWQgdG8gY2hlY2sgaWYgd2UncmUgYWRkaW5nIGR1cGxpY2F0ZSBldmVudHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1RpbWVsaW5lfSB0aW1lbGluZSBUaGUgVGltZWxpbmUgd2hpY2ggc2hvdWxkIGJlIGZpbGVkIHdpdGhcbiAgICAgKiBldmVudHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1Jvb219IHJvb20gVGhlIHJvb20gZm9yIHdoaWNoIHdlIHNob3VsZCBmZXRjaCBldmVudHMgY29udGFpbmluZ1xuICAgICAqIFVSTHNcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBsaW1pdCBUaGUgbWF4aW11bSBudW1iZXIgb2YgZXZlbnRzIHRvIGZldGNoLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGZyb21FdmVudCBGcm9tIHdoaWNoIGV2ZW50IHNob3VsZCB3ZSBjb250aW51ZSBmZXRjaGluZ1xuICAgICAqIGV2ZW50cyBmcm9tIHRoZSBpbmRleC4gVGhpcyBpcyBvbmx5IG5lZWRlZCBpZiB3ZSdyZSBjb250aW51aW5nIHRvIGZpbGxcbiAgICAgKiB0aGUgdGltZWxpbmUsIGUuZy4gaWYgd2UncmUgcGFnaW5hdGluZy4gVGhpcyBuZWVkcyB0byBiZSBzZXQgdG8gYSBldmVudFxuICAgICAqIGlkIG9mIGFuIGV2ZW50IHRoYXQgd2FzIHByZXZpb3VzbHkgZmV0Y2hlZCB3aXRoIHRoaXMgZnVuY3Rpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZGlyZWN0aW9uIFRoZSBkaXJlY3Rpb24gaW4gd2hpY2ggd2Ugd2lsbCBjb250aW51ZVxuICAgICAqIGZldGNoaW5nIGV2ZW50cy4gRXZlbnRUaW1lbGluZS5CQUNLV0FSRFMgdG8gY29udGludWUgZmV0Y2hpbmcgZXZlbnRzIHRoYXRcbiAgICAgKiBhcmUgb2xkZXIgdGhhbiB0aGUgZXZlbnQgZ2l2ZW4gaW4gZnJvbUV2ZW50LCBFdmVudFRpbWVsaW5lLkZPUldBUkRTIHRvXG4gICAgICogZmV0Y2ggbmV3ZXIgZXZlbnRzLlxuICAgICAqXG4gICAgICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59IFJlc29sdmVzIHRvIHRydWUgaWYgZXZlbnRzIHdlcmUgYWRkZWQgdG8gdGhlXG4gICAgICogdGltZWxpbmUsIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBwdWJsaWMgYXN5bmMgcG9wdWxhdGVGaWxlVGltZWxpbmUoXG4gICAgICAgIHRpbWVsaW5lU2V0OiBFdmVudFRpbWVsaW5lU2V0LFxuICAgICAgICB0aW1lbGluZTogRXZlbnRUaW1lbGluZSxcbiAgICAgICAgcm9vbTogUm9vbSxcbiAgICAgICAgbGltaXQgPSAxMCxcbiAgICAgICAgZnJvbUV2ZW50Pzogc3RyaW5nLFxuICAgICAgICBkaXJlY3Rpb246IHN0cmluZyA9IEV2ZW50VGltZWxpbmUuQkFDS1dBUkRTLFxuICAgICk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgICAgICBjb25zdCBtYXRyaXhFdmVudHMgPSBhd2FpdCB0aGlzLmxvYWRGaWxlRXZlbnRzKHJvb20sIGxpbWl0LCBmcm9tRXZlbnQsIGRpcmVjdGlvbik7XG5cbiAgICAgICAgLy8gSWYgdGhpcyBpcyBhIG5vcm1hbCBmaWxsIHJlcXVlc3QsIG5vdCBhIHBhZ2luYXRpb24gcmVxdWVzdCwgd2UgbmVlZFxuICAgICAgICAvLyB0byBnZXQgb3VyIGV2ZW50cyBpbiB0aGUgQkFDS1dBUkRTIGRpcmVjdGlvbiBidXQgcG9wdWxhdGUgdGhlbSBpbiB0aGVcbiAgICAgICAgLy8gZm9yd2FyZHMgZGlyZWN0aW9uLlxuICAgICAgICAvLyBUaGlzIG5lZWRzIHRvIGhhcHBlbiBiZWNhdXNlIGEgZmlsbCByZXF1ZXN0IG1pZ2h0IGNvbWUgd2l0aCBhblxuICAgICAgICAvLyBleGlzdGluZyB0aW1lbGluZSBlLmcuIGlmIHlvdSBjbG9zZSBhbmQgcmUtb3BlbiB0aGUgRmlsZVBhbmVsLlxuICAgICAgICBpZiAoZnJvbUV2ZW50ID09PSBudWxsKSB7XG4gICAgICAgICAgICBtYXRyaXhFdmVudHMucmV2ZXJzZSgpO1xuICAgICAgICAgICAgZGlyZWN0aW9uID0gZGlyZWN0aW9uID09IEV2ZW50VGltZWxpbmUuQkFDS1dBUkRTID8gRXZlbnRUaW1lbGluZS5GT1JXQVJEUyA6IEV2ZW50VGltZWxpbmUuQkFDS1dBUkRTO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQWRkIHRoZSBldmVudHMgdG8gdGhlIHRpbWVsaW5lIG9mIHRoZSBmaWxlIHBhbmVsLlxuICAgICAgICBtYXRyaXhFdmVudHMuZm9yRWFjaCgoZSkgPT4ge1xuICAgICAgICAgICAgaWYgKCF0aW1lbGluZVNldC5ldmVudElkVG9UaW1lbGluZShlLmdldElkKCkhKSkge1xuICAgICAgICAgICAgICAgIHRpbWVsaW5lU2V0LmFkZEV2ZW50VG9UaW1lbGluZShlLCB0aW1lbGluZSwgZGlyZWN0aW9uID09IEV2ZW50VGltZWxpbmUuQkFDS1dBUkRTKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgbGV0IHJldCA9IGZhbHNlO1xuICAgICAgICBsZXQgcGFnaW5hdGlvblRva2VuID0gXCJcIjtcblxuICAgICAgICAvLyBTZXQgdGhlIHBhZ2luYXRpb24gdG9rZW4gdG8gdGhlIG9sZGVzdCBldmVudCB0aGF0IHdlIHJldHJpZXZlZC5cbiAgICAgICAgaWYgKG1hdHJpeEV2ZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBwYWdpbmF0aW9uVG9rZW4gPSBtYXRyaXhFdmVudHNbbWF0cml4RXZlbnRzLmxlbmd0aCAtIDFdLmdldElkKCkhO1xuICAgICAgICAgICAgcmV0ID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxvZ2dlci5sb2coXG4gICAgICAgICAgICBcIkV2ZW50SW5kZXg6IFBvcHVsYXRpbmcgZmlsZSBwYW5lbCB3aXRoXCIsXG4gICAgICAgICAgICBtYXRyaXhFdmVudHMubGVuZ3RoLFxuICAgICAgICAgICAgXCJldmVudHMgYW5kIHNldHRpbmcgdGhlIHBhZ2luYXRpb24gdG9rZW4gdG9cIixcbiAgICAgICAgICAgIHBhZ2luYXRpb25Ub2tlbixcbiAgICAgICAgKTtcblxuICAgICAgICB0aW1lbGluZS5zZXRQYWdpbmF0aW9uVG9rZW4ocGFnaW5hdGlvblRva2VuLCBFdmVudFRpbWVsaW5lLkJBQ0tXQVJEUyk7XG4gICAgICAgIHJldHVybiByZXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW11bGF0ZSBhIFRpbWVsaW5lV2luZG93IHBhZ2luYXRpb24oKSByZXF1ZXN0IHdpdGggdGhlIGV2ZW50IGluZGV4IGFzIHRoZSBldmVudCBzb3VyY2VcbiAgICAgKlxuICAgICAqIE1pZ2h0IG5vdCBmZXRjaCBldmVudHMgZnJvbSB0aGUgaW5kZXggaWYgdGhlIHRpbWVsaW5lIGFscmVhZHkgY29udGFpbnNcbiAgICAgKiBldmVudHMgdGhhdCB0aGUgd2luZG93IGlzbid0IHNob3dpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1Jvb219IHJvb20gVGhlIHJvb20gZm9yIHdoaWNoIHdlIHNob3VsZCBmZXRjaCBldmVudHMgY29udGFpbmluZ1xuICAgICAqIFVSTHNcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VGltZWxpbmVXaW5kb3d9IHRpbWVsaW5lV2luZG93IFRoZSB0aW1lbGluZSB3aW5kb3cgdGhhdCBzaG91bGQgYmVcbiAgICAgKiBwb3B1bGF0ZWQgd2l0aCBuZXcgZXZlbnRzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGRpcmVjdGlvbiBUaGUgZGlyZWN0aW9uIGluIHdoaWNoIHdlIHNob3VsZCBwYWdpbmF0ZS5cbiAgICAgKiBFdmVudFRpbWVsaW5lLkJBQ0tXQVJEUyB0byBwYWdpbmF0ZSBiYWNrLCBFdmVudFRpbWVsaW5lLkZPUldBUkRTIHRvXG4gICAgICogcGFnaW5hdGUgZm9yd2FyZHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbGltaXQgVGhlIG1heGltdW0gbnVtYmVyIG9mIGV2ZW50cyB0byBmZXRjaCB3aGlsZVxuICAgICAqIHBhZ2luYXRpbmcuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn0gUmVzb2x2ZXMgdG8gYSBib29sZWFuIHdoaWNoIGlzIHRydWUgaWYgbW9yZVxuICAgICAqIGV2ZW50cyB3ZXJlIHN1Y2Nlc3NmdWxseSByZXRyaWV2ZWQuXG4gICAgICovXG4gICAgcHVibGljIHBhZ2luYXRlVGltZWxpbmVXaW5kb3coXG4gICAgICAgIHJvb206IFJvb20sXG4gICAgICAgIHRpbWVsaW5lV2luZG93OiBUaW1lbGluZVdpbmRvdyxcbiAgICAgICAgZGlyZWN0aW9uOiBEaXJlY3Rpb24sXG4gICAgICAgIGxpbWl0OiBudW1iZXIsXG4gICAgKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgICAgIGNvbnN0IHRsID0gdGltZWxpbmVXaW5kb3cuZ2V0VGltZWxpbmVJbmRleChkaXJlY3Rpb24pO1xuXG4gICAgICAgIGlmICghdGwpIHJldHVybiBQcm9taXNlLnJlc29sdmUoZmFsc2UpO1xuICAgICAgICBpZiAodGwucGVuZGluZ1BhZ2luYXRlKSByZXR1cm4gdGwucGVuZGluZ1BhZ2luYXRlO1xuXG4gICAgICAgIGlmICh0aW1lbGluZVdpbmRvdy5leHRlbmQoZGlyZWN0aW9uLCBsaW1pdCkpIHtcbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodHJ1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwYWdpbmF0aW9uTWV0aG9kID0gYXN5bmMgKFxuICAgICAgICAgICAgdGltZWxpbmVXaW5kb3c6IFRpbWVsaW5lV2luZG93LFxuICAgICAgICAgICAgdGltZWxpbmVJbmRleDogVGltZWxpbmVJbmRleCxcbiAgICAgICAgICAgIHJvb206IFJvb20sXG4gICAgICAgICAgICBkaXJlY3Rpb246IERpcmVjdGlvbixcbiAgICAgICAgICAgIGxpbWl0OiBudW1iZXIsXG4gICAgICAgICk6IFByb21pc2U8Ym9vbGVhbj4gPT4ge1xuICAgICAgICAgICAgY29uc3QgdGltZWxpbmUgPSB0aW1lbGluZUluZGV4LnRpbWVsaW5lO1xuICAgICAgICAgICAgY29uc3QgdGltZWxpbmVTZXQgPSB0aW1lbGluZS5nZXRUaW1lbGluZVNldCgpO1xuICAgICAgICAgICAgY29uc3QgdG9rZW4gPSB0aW1lbGluZS5nZXRQYWdpbmF0aW9uVG9rZW4oZGlyZWN0aW9uKSA/PyB1bmRlZmluZWQ7XG5cbiAgICAgICAgICAgIGNvbnN0IHJldCA9IGF3YWl0IHRoaXMucG9wdWxhdGVGaWxlVGltZWxpbmUodGltZWxpbmVTZXQsIHRpbWVsaW5lLCByb29tLCBsaW1pdCwgdG9rZW4sIGRpcmVjdGlvbik7XG5cbiAgICAgICAgICAgIHRpbWVsaW5lSW5kZXgucGVuZGluZ1BhZ2luYXRlID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgdGltZWxpbmVXaW5kb3cuZXh0ZW5kKGRpcmVjdGlvbiwgbGltaXQpO1xuXG4gICAgICAgICAgICByZXR1cm4gcmV0O1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IHBhZ2luYXRpb25Qcm9taXNlID0gcGFnaW5hdGlvbk1ldGhvZCh0aW1lbGluZVdpbmRvdywgdGwsIHJvb20sIGRpcmVjdGlvbiwgbGltaXQpO1xuICAgICAgICB0bC5wZW5kaW5nUGFnaW5hdGUgPSBwYWdpbmF0aW9uUHJvbWlzZTtcblxuICAgICAgICByZXR1cm4gcGFnaW5hdGlvblByb21pc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHN0YXRpc3RpY2FsIGluZm9ybWF0aW9uIG9mIHRoZSBpbmRleC5cbiAgICAgKlxuICAgICAqIEByZXR1cm4ge1Byb21pc2U8SUluZGV4U3RhdHM+fSBBIHByb21pc2UgdGhhdCB3aWxsIHJlc29sdmUgdG8gdGhlIGluZGV4XG4gICAgICogc3RhdGlzdGljcy5cbiAgICAgKi9cbiAgICBwdWJsaWMgYXN5bmMgZ2V0U3RhdHMoKTogUHJvbWlzZTxJSW5kZXhTdGF0cyB8IHVuZGVmaW5lZD4ge1xuICAgICAgICBjb25zdCBpbmRleE1hbmFnZXIgPSBQbGF0Zm9ybVBlZy5nZXQoKT8uZ2V0RXZlbnRJbmRleGluZ01hbmFnZXIoKTtcbiAgICAgICAgcmV0dXJuIGluZGV4TWFuYWdlcj8uZ2V0U3RhdHMoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiB0aGUgcm9vbSB3aXRoIHRoZSBnaXZlbiBpZCBpcyBhbHJlYWR5IGluZGV4ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gcm9vbUlkIFRoZSBJRCBvZiB0aGUgcm9vbSB3aGljaCB3ZSB3YW50IHRvIGNoZWNrIGlmIGl0XG4gICAgICogaGFzIGJlZW4gYWxyZWFkeSBpbmRleGVkLlxuICAgICAqXG4gICAgICogQHJldHVybiB7UHJvbWlzZTxib29sZWFuPn0gUmV0dXJucyB0cnVlIGlmIHRoZSBpbmRleCBjb250YWlucyBldmVudHMgZm9yXG4gICAgICogdGhlIGdpdmVuIHJvb20sIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBwdWJsaWMgYXN5bmMgaXNSb29tSW5kZXhlZChyb29tSWQ6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbiB8IHVuZGVmaW5lZD4ge1xuICAgICAgICBjb25zdCBpbmRleE1hbmFnZXIgPSBQbGF0Zm9ybVBlZy5nZXQoKT8uZ2V0RXZlbnRJbmRleGluZ01hbmFnZXIoKTtcbiAgICAgICAgcmV0dXJuIGluZGV4TWFuYWdlcj8uaXNSb29tSW5kZXhlZChyb29tSWQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcm9vbSB0aGF0IHdlIGFyZSBjdXJyZW50bHkgY3Jhd2xpbmcuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Um9vbX0gQSBNYXRyaXhSb29tIHRoYXQgaXMgYmVpbmcgY3VycmVudGx5IGNyYXdsZWQsIG51bGxcbiAgICAgKiBpZiBubyByb29tIGlzIGN1cnJlbnRseSBiZWluZyBjcmF3bGVkLlxuICAgICAqL1xuICAgIHB1YmxpYyBjdXJyZW50Um9vbSgpOiBSb29tIHwgbnVsbCB7XG4gICAgICAgIGlmICh0aGlzLmN1cnJlbnRDaGVja3BvaW50ID09PSBudWxsICYmIHRoaXMuY3Jhd2xlckNoZWNrcG9pbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjbGllbnQgPSBNYXRyaXhDbGllbnRQZWcuZ2V0KCk7XG5cbiAgICAgICAgaWYgKHRoaXMuY3VycmVudENoZWNrcG9pbnQgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiBjbGllbnQuZ2V0Um9vbSh0aGlzLmN1cnJlbnRDaGVja3BvaW50LnJvb21JZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gY2xpZW50LmdldFJvb20odGhpcy5jcmF3bGVyQ2hlY2twb2ludHNbMF0ucm9vbUlkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBjcmF3bGluZ1Jvb21zKCk6IHtcbiAgICAgICAgY3Jhd2xpbmdSb29tczogU2V0PHN0cmluZz47XG4gICAgICAgIHRvdGFsUm9vbXM6IFNldDxzdHJpbmc+O1xuICAgIH0ge1xuICAgICAgICBjb25zdCB0b3RhbFJvb21zID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICAgIGNvbnN0IGNyYXdsaW5nUm9vbXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICAgICAgICB0aGlzLmNyYXdsZXJDaGVja3BvaW50cy5mb3JFYWNoKChjaGVja3BvaW50LCBpbmRleCkgPT4ge1xuICAgICAgICAgICAgY3Jhd2xpbmdSb29tcy5hZGQoY2hlY2twb2ludC5yb29tSWQpO1xuICAgICAgICB9KTtcblxuICAgICAgICBpZiAodGhpcy5jdXJyZW50Q2hlY2twb2ludCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgY3Jhd2xpbmdSb29tcy5hZGQodGhpcy5jdXJyZW50Q2hlY2twb2ludC5yb29tSWQpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY2xpZW50ID0gTWF0cml4Q2xpZW50UGVnLmdldCgpO1xuICAgICAgICBjb25zdCByb29tcyA9IGNsaWVudC5nZXRSb29tcygpO1xuXG4gICAgICAgIGNvbnN0IGlzUm9vbUVuY3J5cHRlZCA9IChyb29tOiBSb29tKTogYm9vbGVhbiA9PiB7XG4gICAgICAgICAgICByZXR1cm4gY2xpZW50LmlzUm9vbUVuY3J5cHRlZChyb29tLnJvb21JZCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgZW5jcnlwdGVkUm9vbXMgPSByb29tcy5maWx0ZXIoaXNSb29tRW5jcnlwdGVkKTtcbiAgICAgICAgZW5jcnlwdGVkUm9vbXMuZm9yRWFjaCgocm9vbSwgaW5kZXgpID0+IHtcbiAgICAgICAgICAgIHRvdGFsUm9vbXMuYWRkKHJvb20ucm9vbUlkKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHsgY3Jhd2xpbmdSb29tcywgdG90YWxSb29tcyB9O1xuICAgIH1cbn1cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFnQkEsSUFBQUEsT0FBQSxHQUFBQyxPQUFBO0FBQ0EsSUFBQUMsV0FBQSxHQUFBRCxPQUFBO0FBQ0EsSUFBQUUsY0FBQSxHQUFBRixPQUFBO0FBQ0EsSUFBQUcsS0FBQSxHQUFBSCxPQUFBO0FBR0EsSUFBQUksVUFBQSxHQUFBSixPQUFBO0FBRUEsSUFBQUssTUFBQSxHQUFBTCxPQUFBO0FBRUEsSUFBQU0sT0FBQSxHQUFBTixPQUFBO0FBQ0EsSUFBQU8sTUFBQSxHQUFBUCxPQUFBO0FBQ0EsSUFBQVEsT0FBQSxHQUFBUixPQUFBO0FBRUEsSUFBQVMsUUFBQSxHQUFBVCxPQUFBO0FBRUEsSUFBQVUsWUFBQSxHQUFBQyxzQkFBQSxDQUFBWCxPQUFBO0FBQ0EsSUFBQVksZ0JBQUEsR0FBQVosT0FBQTtBQUNBLElBQUFhLGNBQUEsR0FBQUYsc0JBQUEsQ0FBQVgsT0FBQTtBQUNBLElBQUFjLGFBQUEsR0FBQWQsT0FBQTtBQW5DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBd0JBO0FBQ0E7QUFDQSxNQUFNZSxpQkFBaUIsR0FBRyxJQUFJOztBQUU5QjtBQUNBLE1BQU1DLGdCQUFnQixHQUFHLEdBQUc7QUFNNUI7QUFDQTtBQUNBO0FBQ2UsTUFBTUMsVUFBVSxTQUFTQyxvQkFBWSxDQUFDO0VBQUFDLFlBQUE7SUFBQSxTQUFBQyxTQUFBO0lBQUEsSUFBQUMsZ0JBQUEsQ0FBQUMsT0FBQSw4QkFDRSxFQUFFO0lBQUEsSUFBQUQsZ0JBQUEsQ0FBQUMsT0FBQSxtQkFDbEIsSUFBSTtJQUFBLElBQUFELGdCQUFBLENBQUFDLE9BQUEsNkJBQ2dCLElBQUk7SUFtRzNEO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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