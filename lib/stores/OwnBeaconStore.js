"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.OwnBeaconStoreEvent = exports.OwnBeaconStore = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _lodash = require("lodash");
var _matrix = require("matrix-js-sdk/src/matrix");
var _contentHelpers = require("matrix-js-sdk/src/content-helpers");
var _beacon = require("matrix-js-sdk/src/@types/beacon");
var _logger = require("matrix-js-sdk/src/logger");
var _dispatcher = _interopRequireDefault(require("../dispatcher/dispatcher"));
var _AsyncStoreWithClient = require("./AsyncStoreWithClient");
var _arrays = require("../utils/arrays");
var _beacon2 = require("../utils/beacon");
var _localRoom = require("../utils/local-room");
var _SettingsStore = _interopRequireDefault(require("../settings/SettingsStore"));
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; } /*
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
const isOwnBeacon = (beacon, userId) => beacon.beaconInfoOwner === userId;
let OwnBeaconStoreEvent = /*#__PURE__*/function (OwnBeaconStoreEvent) {
  OwnBeaconStoreEvent["LivenessChange"] = "OwnBeaconStore.LivenessChange";
  OwnBeaconStoreEvent["MonitoringLivePosition"] = "OwnBeaconStore.MonitoringLivePosition";
  OwnBeaconStoreEvent["LocationPublishError"] = "LocationPublishError";
  OwnBeaconStoreEvent["BeaconUpdateError"] = "BeaconUpdateError";
  return OwnBeaconStoreEvent;
}({});
exports.OwnBeaconStoreEvent = OwnBeaconStoreEvent;
const MOVING_UPDATE_INTERVAL = 5000;
const STATIC_UPDATE_INTERVAL = 30000;
const BAIL_AFTER_CONSECUTIVE_ERROR_COUNT = 2;
const CREATED_BEACONS_KEY = "mx_live_beacon_created_id";
const removeLocallyCreateBeaconEventId = eventId => {
  const ids = getLocallyCreatedBeaconEventIds();
  window.localStorage.setItem(CREATED_BEACONS_KEY, JSON.stringify(ids.filter(id => id !== eventId)));
};
const storeLocallyCreateBeaconEventId = eventId => {
  const ids = getLocallyCreatedBeaconEventIds();
  window.localStorage.setItem(CREATED_BEACONS_KEY, JSON.stringify([...ids, eventId]));
};
const getLocallyCreatedBeaconEventIds = () => {
  let ids;
  try {
    ids = JSON.parse(window.localStorage.getItem(CREATED_BEACONS_KEY) ?? "[]");
    if (!Array.isArray(ids)) {
      throw new Error("Invalid stored value");
    }
  } catch (error) {
    _logger.logger.error("Failed to retrieve locally created beacon event ids", error);
    ids = [];
  }
  return ids;
};
class OwnBeaconStore extends _AsyncStoreWithClient.AsyncStoreWithClient {
  constructor() {
    super(_dispatcher.default);
    // users beacons, keyed by event type
    (0, _defineProperty2.default)(this, "beacons", new Map());
    (0, _defineProperty2.default)(this, "beaconsByRoomId", new Map());
    /**
     * Track over the wire errors for published positions
     * Counts consecutive wire errors per beacon
     * Reset on successful publish of location
     */
    (0, _defineProperty2.default)(this, "beaconLocationPublishErrorCounts", new Map());
    (0, _defineProperty2.default)(this, "beaconUpdateErrors", new Map());
    /**
     * ids of live beacons
     * ordered by creation time descending
     */
    (0, _defineProperty2.default)(this, "liveBeaconIds", []);
    (0, _defineProperty2.default)(this, "locationInterval", void 0);
    (0, _defineProperty2.default)(this, "geolocationError", void 0);
    (0, _defineProperty2.default)(this, "clearPositionWatch", void 0);
    /**
     * Track when the last position was published
     * So we can manually get position on slow interval
     * when the target is stationary
     */
    (0, _defineProperty2.default)(this, "lastPublishedPositionTimestamp", void 0);
    /**
     * Ref returned from watchSetting for the MSC3946 labs flag
     */
    (0, _defineProperty2.default)(this, "dynamicWatcherRef", void 0);
    (0, _defineProperty2.default)(this, "hasLiveBeacons", roomId => {
      return !!this.getLiveBeaconIds(roomId).length;
    });
    /**
     * Some live beacon has a wire error
     * Optionally filter by room
     */
    (0, _defineProperty2.default)(this, "hasLocationPublishErrors", roomId => {
      return this.getLiveBeaconIds(roomId).some(this.beaconHasLocationPublishError);
    });
    /**
     * If a beacon has failed to publish position
     * past the allowed consecutive failure count (BAIL_AFTER_CONSECUTIVE_ERROR_COUNT)
     * Then consider it to have an error
     */
    (0, _defineProperty2.default)(this, "beaconHasLocationPublishError", beaconId => {
      const counts = this.beaconLocationPublishErrorCounts.get(beaconId);
      return counts !== undefined && counts >= BAIL_AFTER_CONSECUTIVE_ERROR_COUNT;
    });
    (0, _defineProperty2.default)(this, "resetLocationPublishError", beaconId => {
      this.incrementBeaconLocationPublishErrorCount(beaconId, false);

      // always publish to all live beacons together
      // instead of just one that was changed
      // to keep lastPublishedTimestamp simple
      // and extra published locations don't hurt
      this.publishCurrentLocationToBeacons();
    });
    (0, _defineProperty2.default)(this, "getLiveBeaconIds", roomId => {
      if (!roomId) {
        return this.liveBeaconIds;
      }
      return this.liveBeaconIds.filter(beaconId => this.beaconsByRoomId.get(roomId)?.has(beaconId));
    });
    (0, _defineProperty2.default)(this, "getLiveBeaconIdsWithLocationPublishError", roomId => {
      return this.getLiveBeaconIds(roomId).filter(this.beaconHasLocationPublishError);
    });
    (0, _defineProperty2.default)(this, "getBeaconById", beaconId => {
      return this.beacons.get(beaconId);
    });
    (0, _defineProperty2.default)(this, "stopBeacon", async beaconIdentifier => {
      const beacon = this.beacons.get(beaconIdentifier);
      // if no beacon, or beacon is already explicitly set isLive: false
      // do nothing
      if (!beacon?.beaconInfo?.live) {
        return;
      }
      await this.updateBeaconEvent(beacon, {
        live: false
      });
      // prune from local store
      removeLocallyCreateBeaconEventId(beacon.beaconInfoId);
    });
    /**
     * Listeners
     */
    (0, _defineProperty2.default)(this, "onNewBeacon", (_event, beacon) => {
      if (!this.matrixClient || !isOwnBeacon(beacon, this.matrixClient.getUserId())) {
        return;
      }
      this.addBeacon(beacon);
      this.checkLiveness();
    });
    /**
     * This will be called when a beacon is replaced
     */
    (0, _defineProperty2.default)(this, "onUpdateBeacon", (_event, beacon) => {
      if (!this.matrixClient || !isOwnBeacon(beacon, this.matrixClient.getUserId())) {
        return;
      }
      this.checkLiveness();
      beacon.monitorLiveness();
    });
    (0, _defineProperty2.default)(this, "onDestroyBeacon", beaconIdentifier => {
      // check if we care about this beacon
      if (!this.beacons.has(beaconIdentifier)) {
        return;
      }
      this.checkLiveness();
    });
    (0, _defineProperty2.default)(this, "onBeaconLiveness", (isLive, beacon) => {
      // check if we care about this beacon
      if (!this.beacons.has(beacon.identifier)) {
        return;
      }

      // beacon expired, update beacon to un-alive state
      if (!isLive) {
        this.stopBeacon(beacon.identifier);
      }
      this.checkLiveness();
      this.emit(OwnBeaconStoreEvent.LivenessChange, this.getLiveBeaconIds());
    });
    /**
     * Check for changes in membership in rooms with beacons
     * and stop monitoring beacons in rooms user is no longer member of
     */
    (0, _defineProperty2.default)(this, "onRoomStateMembers", (_event, roomState, member) => {
      // no beacons for this room, ignore
      if (!this.matrixClient || !this.beaconsByRoomId.has(roomState.roomId) || member.userId !== this.matrixClient.getUserId()) {
        return;
      }

      // TODO check powerlevels here
      // in PSF-797

      // stop watching beacons in rooms where user is no longer a member
      if (member.membership === "leave" || member.membership === "ban") {
        this.beaconsByRoomId.get(roomState.roomId)?.forEach(this.removeBeacon);
        this.beaconsByRoomId.delete(roomState.roomId);
      }
    });
    /**
     * @internal public for test only
     */
    (0, _defineProperty2.default)(this, "reinitialiseBeaconState", () => {
      this.clearBeacons();
      this.initialiseBeaconState();
    });
    (0, _defineProperty2.default)(this, "initialiseBeaconState", () => {
      if (!this.matrixClient) return;
      const userId = this.matrixClient.getSafeUserId();
      const visibleRooms = this.matrixClient.getVisibleRooms(_SettingsStore.default.getValue("feature_dynamic_room_predecessors"));
      visibleRooms.forEach(room => {
        const roomState = room.currentState;
        const beacons = roomState.beacons;
        const ownBeaconsArray = [...beacons.values()].filter(beacon => isOwnBeacon(beacon, userId));
        ownBeaconsArray.forEach(beacon => this.addBeacon(beacon));
      });
      this.checkLiveness();
    });
    (0, _defineProperty2.default)(this, "addBeacon", beacon => {
      this.beacons.set(beacon.identifier, beacon);
      if (!this.beaconsByRoomId.has(beacon.roomId)) {
        this.beaconsByRoomId.set(beacon.roomId, new Set());
      }
      this.beaconsByRoomId.get(beacon.roomId).add(beacon.identifier);
      beacon.monitorLiveness();
    });
    /**
     * Remove listeners for a given beacon
     * remove from state
     * and update liveness if changed
     */
    (0, _defineProperty2.default)(this, "removeBeacon", beaconId => {
      if (!this.beacons.has(beaconId)) {
        return;
      }
      this.beacons.get(beaconId).destroy();
      this.beacons.delete(beaconId);
      this.checkLiveness();
    });
    (0, _defineProperty2.default)(this, "checkLiveness", () => {
      const locallyCreatedBeaconEventIds = getLocallyCreatedBeaconEventIds();
      const prevLiveBeaconIds = this.getLiveBeaconIds();
      this.liveBeaconIds = [...this.beacons.values()].filter(beacon => beacon.isLive &&
      // only beacons created on this device should be shared to
      locallyCreatedBeaconEventIds.includes(beacon.beaconInfoId)).sort(_beacon2.sortBeaconsByLatestCreation).map(beacon => beacon.identifier);
      const diff = (0, _arrays.arrayDiff)(prevLiveBeaconIds, this.liveBeaconIds);
      if (diff.added.length || diff.removed.length) {
        this.emit(OwnBeaconStoreEvent.LivenessChange, this.liveBeaconIds);
      }

      // publish current location immediately
      // when there are new live beacons
      // and we already have a live monitor
      // so first position is published quickly
      // even when target is stationary
      //
      // when there is no existing live monitor
      // it will be created below by togglePollingLocation
      // and publish first position quickly
      if (diff.added.length && this.isMonitoringLiveLocation) {
        this.publishCurrentLocationToBeacons();
      }

      // if overall liveness changed
      if (!!prevLiveBeaconIds?.length !== !!this.liveBeaconIds.length) {
        this.togglePollingLocation();
      }
    });
    (0, _defineProperty2.default)(this, "createLiveBeacon", async (roomId, beaconInfoContent) => {
      if (!this.matrixClient) return;
      // explicitly stop any live beacons this user has
      // to ensure they remain stopped
      // if the new replacing beacon is redacted
      const existingLiveBeaconIdsForRoom = this.getLiveBeaconIds(roomId);
      await Promise.all(existingLiveBeaconIdsForRoom.map(beaconId => this.stopBeacon(beaconId)));

      // eslint-disable-next-line camelcase
      const {
        event_id
      } = await (0, _localRoom.doMaybeLocalRoomAction)(roomId, actualRoomId => this.matrixClient.unstable_createLiveBeacon(actualRoomId, beaconInfoContent), this.matrixClient);
      storeLocallyCreateBeaconEventId(event_id);
    });
    /**
     * Geolocation
     */
    (0, _defineProperty2.default)(this, "togglePollingLocation", () => {
      if (!!this.liveBeaconIds.length) {
        this.startPollingLocation();
      } else {
        this.stopPollingLocation();
      }
    });
    (0, _defineProperty2.default)(this, "startPollingLocation", async () => {
      // clear any existing interval
      this.stopPollingLocation();
      try {
        this.clearPositionWatch = (0, _beacon2.watchPosition)(this.onWatchedPosition, this.onGeolocationError);
      } catch (error) {
        this.onGeolocationError(error?.message);
        // don't set locationInterval if geolocation failed to setup
        return;
      }
      this.locationInterval = window.setInterval(() => {
        if (!this.lastPublishedPositionTimestamp) {
          return;
        }
        // if position was last updated STATIC_UPDATE_INTERVAL ms ago or more
        // get our position and publish it
        if (this.lastPublishedPositionTimestamp <= Date.now() - STATIC_UPDATE_INTERVAL) {
          this.publishCurrentLocationToBeacons();
        }
      }, STATIC_UPDATE_INTERVAL);
      this.emit(OwnBeaconStoreEvent.MonitoringLivePosition);
    });
    (0, _defineProperty2.default)(this, "stopPollingLocation", () => {
      clearInterval(this.locationInterval);
      this.locationInterval = undefined;
      this.lastPublishedPositionTimestamp = undefined;
      this.geolocationError = undefined;
      if (this.clearPositionWatch) {
        this.clearPositionWatch();
        this.clearPositionWatch = undefined;
      }
      this.emit(OwnBeaconStoreEvent.MonitoringLivePosition);
    });
    (0, _defineProperty2.default)(this, "onWatchedPosition", position => {
      const timedGeoPosition = (0, _beacon2.mapGeolocationPositionToTimedGeo)(position);

      // if this is our first position, publish immediately
      if (!this.lastPublishedPositionTimestamp) {
        this.publishLocationToBeacons(timedGeoPosition);
      } else {
        this.debouncedPublishLocationToBeacons(timedGeoPosition);
      }
    });
    (0, _defineProperty2.default)(this, "onGeolocationError", async error => {
      this.geolocationError = error;
      _logger.logger.error("Geolocation failed", this.geolocationError);

      // other errors are considered non-fatal
      // and self recovering
      if (![_beacon2.GeolocationError.Unavailable, _beacon2.GeolocationError.PermissionDenied].includes(error)) {
        return;
      }
      this.stopPollingLocation();
      // kill live beacons when location permissions are revoked
      await Promise.all(this.liveBeaconIds.map(this.stopBeacon));
    });
    /**
     * Gets the current location
     * (as opposed to using watched location)
     * and publishes it to all live beacons
     */
    (0, _defineProperty2.default)(this, "publishCurrentLocationToBeacons", async () => {
      try {
        const position = await (0, _beacon2.getCurrentPosition)();
        this.publishLocationToBeacons((0, _beacon2.mapGeolocationPositionToTimedGeo)(position));
      } catch (error) {
        this.onGeolocationError(error?.message);
      }
    });
    /**
     * MatrixClient api
     */
    /**
     * Updates beacon with provided content update
     * Records error in beaconUpdateErrors
     * rethrows
     */
    (0, _defineProperty2.default)(this, "updateBeaconEvent", async (beacon, update) => {
      const {
        description,
        timeout,
        timestamp,
        live,
        assetType
      } = _objectSpread(_objectSpread({}, beacon.beaconInfo), update);
      const updateContent = (0, _contentHelpers.makeBeaconInfoContent)(timeout, live, description, assetType, timestamp);
      try {
        await this.matrixClient.unstable_setLiveBeacon(beacon.roomId, updateContent);
        // cleanup any errors
        const hadError = this.beaconUpdateErrors.has(beacon.identifier);
        if (hadError) {
          this.beaconUpdateErrors.delete(beacon.identifier);
          this.emit(OwnBeaconStoreEvent.BeaconUpdateError, beacon.identifier, false);
        }
      } catch (error) {
        _logger.logger.error("Failed to update beacon", error);
        this.beaconUpdateErrors.set(beacon.identifier, error);
        this.emit(OwnBeaconStoreEvent.BeaconUpdateError, beacon.identifier, true);
        throw error;
      }
    });
    /**
     * Sends m.location events to all live beacons
     * Sets last published beacon
     */
    (0, _defineProperty2.default)(this, "publishLocationToBeacons", async position => {
      this.lastPublishedPositionTimestamp = Date.now();
      await Promise.all(this.healthyLiveBeaconIds.map(beaconId => this.beacons.has(beaconId) ? this.sendLocationToBeacon(this.beacons.get(beaconId), position) : null));
    });
    (0, _defineProperty2.default)(this, "debouncedPublishLocationToBeacons", (0, _lodash.debounce)(this.publishLocationToBeacons, MOVING_UPDATE_INTERVAL));
    /**
     * Sends m.location event to referencing given beacon
     */
    (0, _defineProperty2.default)(this, "sendLocationToBeacon", async (beacon, _ref) => {
      let {
        geoUri,
        timestamp
      } = _ref;
      const content = (0, _contentHelpers.makeBeaconContent)(geoUri, timestamp, beacon.beaconInfoId);
      try {
        await this.matrixClient.sendEvent(beacon.roomId, _beacon.M_BEACON.name, content);
        this.incrementBeaconLocationPublishErrorCount(beacon.identifier, false);
      } catch (error) {
        _logger.logger.error(error);
        this.incrementBeaconLocationPublishErrorCount(beacon.identifier, true);
      }
    });
    /**
     * Manage beacon wire error count
     * - clear count for beacon when not error
     * - increment count for beacon when is error
     * - emit if beacon error count crossed threshold
     */
    (0, _defineProperty2.default)(this, "incrementBeaconLocationPublishErrorCount", (beaconId, isError) => {
      const hadError = this.beaconHasLocationPublishError(beaconId);
      if (isError) {
        // increment error count
        this.beaconLocationPublishErrorCounts.set(beaconId, (this.beaconLocationPublishErrorCounts.get(beaconId) ?? 0) + 1);
      } else {
        // clear any error count
        this.beaconLocationPublishErrorCounts.delete(beaconId);
      }
      if (this.beaconHasLocationPublishError(beaconId) !== hadError) {
        this.emit(OwnBeaconStoreEvent.LocationPublishError, beaconId);
      }
    });
  }
  static get instance() {
    return OwnBeaconStore.internalInstance;
  }

  /**
   * True when we have live beacons
   * and geolocation.watchPosition is active
   */
  get isMonitoringLiveLocation() {
    return !!this.clearPositionWatch;
  }
  async onNotReady() {
    if (this.matrixClient) {
      this.matrixClient.removeListener(_matrix.BeaconEvent.LivenessChange, this.onBeaconLiveness);
      this.matrixClient.removeListener(_matrix.BeaconEvent.New, this.onNewBeacon);
      this.matrixClient.removeListener(_matrix.BeaconEvent.Update, this.onUpdateBeacon);
      this.matrixClient.removeListener(_matrix.BeaconEvent.Destroy, this.onDestroyBeacon);
      this.matrixClient.removeListener(_matrix.RoomStateEvent.Members, this.onRoomStateMembers);
    }
    _SettingsStore.default.unwatchSetting(this.dynamicWatcherRef ?? "");
    this.clearBeacons();
  }
  clearBeacons() {
    this.beacons.forEach(beacon => beacon.destroy());
    this.stopPollingLocation();
    this.beacons.clear();
    this.beaconsByRoomId.clear();
    this.liveBeaconIds = [];
    this.beaconLocationPublishErrorCounts.clear();
    this.beaconUpdateErrors.clear();
  }
  async onReady() {
    if (this.matrixClient) {
      this.matrixClient.on(_matrix.BeaconEvent.LivenessChange, this.onBeaconLiveness);
      this.matrixClient.on(_matrix.BeaconEvent.New, this.onNewBeacon);
      this.matrixClient.on(_matrix.BeaconEvent.Update, this.onUpdateBeacon);
      this.matrixClient.on(_matrix.BeaconEvent.Destroy, this.onDestroyBeacon);
      this.matrixClient.on(_matrix.RoomStateEvent.Members, this.onRoomStateMembers);
    }
    this.dynamicWatcherRef = _SettingsStore.default.watchSetting("feature_dynamic_room_predecessors", null, this.reinitialiseBeaconState);
    this.initialiseBeaconState();
  }
  async onAction(payload) {
    // we don't actually do anything here
  }
  /**
   * State management
   */
  /**
   * Live beacon ids that do not have wire errors
   */
  get healthyLiveBeaconIds() {
    return this.liveBeaconIds.filter(beaconId => !this.beaconHasLocationPublishError(beaconId) && !this.beaconUpdateErrors.has(beaconId));
  }
}
exports.OwnBeaconStore = OwnBeaconStore;
(0, _defineProperty2.default)(OwnBeaconStore, "internalInstance", (() => {
  const instance = new OwnBeaconStore();
  instance.start();
  return instance;
})());
//# sourceMappingURL=OwnBeaconStore.js.map