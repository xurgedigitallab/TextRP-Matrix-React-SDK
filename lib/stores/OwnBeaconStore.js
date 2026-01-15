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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfbG9kYXNoIiwicmVxdWlyZSIsIl9tYXRyaXgiLCJfY29udGVudEhlbHBlcnMiLCJfYmVhY29uIiwiX2xvZ2dlciIsIl9kaXNwYXRjaGVyIiwiX2ludGVyb3BSZXF1aXJlRGVmYXVsdCIsIl9Bc3luY1N0b3JlV2l0aENsaWVudCIsIl9hcnJheXMiLCJfYmVhY29uMiIsIl9sb2NhbFJvb20iLCJfU2V0dGluZ3NTdG9yZSIsIm93bktleXMiLCJvYmplY3QiLCJlbnVtZXJhYmxlT25seSIsImtleXMiLCJPYmplY3QiLCJnZXRPd25Qcm9wZXJ0eVN5bWJvbHMiLCJzeW1ib2xzIiwiZmlsdGVyIiwic3ltIiwiZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yIiwiZW51bWVyYWJsZSIsInB1c2giLCJhcHBseSIsIl9vYmplY3RTcHJlYWQiLCJ0YXJnZXQiLCJpIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwic291cmNlIiwiZm9yRWFjaCIsImtleSIsIl9kZWZpbmVQcm9wZXJ0eTIiLCJkZWZhdWx0IiwiZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9ycyIsImRlZmluZVByb3BlcnRpZXMiLCJkZWZpbmVQcm9wZXJ0eSIsImlzT3duQmVhY29uIiwiYmVhY29uIiwidXNlcklkIiwiYmVhY29uSW5mb093bmVyIiwiT3duQmVhY29uU3RvcmVFdmVudCIsImV4cG9ydHMiLCJNT1ZJTkdfVVBEQVRFX0lOVEVSVkFMIiwiU1RBVElDX1VQREFURV9JTlRFUlZBTCIsIkJBSUxfQUZURVJfQ09OU0VDVVRJVkVfRVJST1JfQ09VTlQiLCJDUkVBVEVEX0JFQUNPTlNfS0VZIiwicmVtb3ZlTG9jYWxseUNyZWF0ZUJlYWNvbkV2ZW50SWQiLCJldmVudElkIiwiaWRzIiwiZ2V0TG9jYWxseUNyZWF0ZWRCZWFjb25FdmVudElkcyIsIndpbmRvdyIsImxvY2FsU3RvcmFnZSIsInNldEl0ZW0iLCJKU09OIiwic3RyaW5naWZ5IiwiaWQiLCJzdG9yZUxvY2FsbHlDcmVhdGVCZWFjb25FdmVudElkIiwicGFyc2UiLCJnZXRJdGVtIiwiQXJyYXkiLCJpc0FycmF5IiwiRXJyb3IiLCJlcnJvciIsImxvZ2dlciIsIk93bkJlYWNvblN0b3JlIiwiQXN5bmNTdG9yZVdpdGhDbGllbnQiLCJjb25zdHJ1Y3RvciIsImRlZmF1bHREaXNwYXRjaGVyIiwiTWFwIiwicm9vbUlkIiwiZ2V0TGl2ZUJlYWNvbklkcyIsInNvbWUiLCJiZWFjb25IYXNMb2NhdGlvblB1Ymxpc2hFcnJvciIsImJlYWNvbklkIiwiY291bnRzIiwiYmVhY29uTG9jYXRpb25QdWJsaXNoRXJyb3JDb3VudHMiLCJnZXQiLCJ1bmRlZmluZWQiLCJpbmNyZW1lbnRCZWFjb25Mb2NhdGlvblB1Ymxpc2hFcnJvckNvdW50IiwicHVibGlzaEN1cnJlbnRMb2NhdGlvblRvQmVhY29ucyIsImxpdmVCZWFjb25JZHMiLCJiZWFjb25zQnlSb29tSWQiLCJoYXMiLCJiZWFjb25zIiwiYmVhY29uSWRlbnRpZmllciIsImJlYWNvbkluZm8iLCJsaXZlIiwidXBkYXRlQmVhY29uRXZlbnQiLCJiZWFjb25JbmZvSWQiLCJfZXZlbnQiLCJtYXRyaXhDbGllbnQiLCJnZXRVc2VySWQiLCJhZGRCZWFjb24iLCJjaGVja0xpdmVuZXNzIiwibW9uaXRvckxpdmVuZXNzIiwiaXNMaXZlIiwiaWRlbnRpZmllciIsInN0b3BCZWFjb24iLCJlbWl0IiwiTGl2ZW5lc3NDaGFuZ2UiLCJyb29tU3RhdGUiLCJtZW1iZXIiLCJtZW1iZXJzaGlwIiwicmVtb3ZlQmVhY29uIiwiZGVsZXRlIiwiY2xlYXJCZWFjb25zIiwiaW5pdGlhbGlzZUJlYWNvblN0YXRlIiwiZ2V0U2FmZVVzZXJJZCIsInZpc2libGVSb29tcyIsImdldFZpc2libGVSb29tcyIsIlNldHRpbmdzU3RvcmUiLCJnZXRWYWx1ZSIsInJvb20iLCJjdXJyZW50U3RhdGUiLCJvd25CZWFjb25zQXJyYXkiLCJ2YWx1ZXMiLCJzZXQiLCJTZXQiLCJhZGQiLCJkZXN0cm95IiwibG9jYWxseUNyZWF0ZWRCZWFjb25FdmVudElkcyIsInByZXZMaXZlQmVhY29uSWRzIiwiaW5jbHVkZXMiLCJzb3J0Iiwic29ydEJlYWNvbnNCeUxhdGVzdENyZWF0aW9uIiwibWFwIiwiZGlmZiIsImFycmF5RGlmZiIsImFkZGVkIiwicmVtb3ZlZCIsImlzTW9uaXRvcmluZ0xpdmVMb2NhdGlvbiIsInRvZ2dsZVBvbGxpbmdMb2NhdGlvbiIsImJlYWNvbkluZm9Db250ZW50IiwiZXhpc3RpbmdMaXZlQmVhY29uSWRzRm9yUm9vbSIsIlByb21pc2UiLCJhbGwiLCJldmVudF9pZCIsImRvTWF5YmVMb2NhbFJvb21BY3Rpb24iLCJhY3R1YWxSb29tSWQiLCJ1bnN0YWJsZV9jcmVhdGVMaXZlQmVhY29uIiwic3RhcnRQb2xsaW5nTG9jYXRpb24iLCJzdG9wUG9sbGluZ0xvY2F0aW9uIiwiY2xlYXJQb3NpdGlvbldhdGNoIiwid2F0Y2hQb3NpdGlvbiIsIm9uV2F0Y2hlZFBvc2l0aW9uIiwib25HZW9sb2NhdGlvbkVycm9yIiwibWVzc2FnZSIsImxvY2F0aW9uSW50ZXJ2YWwiLCJzZXRJbnRlcnZhbCIsImxhc3RQdWJsaXNoZWRQb3NpdGlvblRpbWVzdGFtcCIsIkRhdGUiLCJub3ciLCJNb25pdG9yaW5nTGl2ZVBvc2l0aW9uIiwiY2xlYXJJbnRlcnZhbCIsImdlb2xvY2F0aW9uRXJyb3IiLCJwb3NpdGlvbiIsInRpbWVkR2VvUG9zaXRpb24iLCJtYXBHZW9sb2NhdGlvblBvc2l0aW9uVG9UaW1lZEdlbyIsInB1Ymxpc2hMb2NhdGlvblRvQmVhY29ucyIsImRlYm91bmNlZFB1Ymxpc2hMb2NhdGlvblRvQmVhY29ucyIsIkdlb2xvY2F0aW9uRXJyb3IiLCJVbmF2YWlsYWJsZSIsIlBlcm1pc3Npb25EZW5pZWQiLCJnZXRDdXJyZW50UG9zaXRpb24iLCJ1cGRhdGUiLCJkZXNjcmlwdGlvbiIsInRpbWVvdXQiLCJ0aW1lc3RhbXAiLCJhc3NldFR5cGUiLCJ1cGRhdGVDb250ZW50IiwibWFrZUJlYWNvbkluZm9Db250ZW50IiwidW5zdGFibGVfc2V0TGl2ZUJlYWNvbiIsImhhZEVycm9yIiwiYmVhY29uVXBkYXRlRXJyb3JzIiwiQmVhY29uVXBkYXRlRXJyb3IiLCJoZWFsdGh5TGl2ZUJlYWNvbklkcyIsInNlbmRMb2NhdGlvblRvQmVhY29uIiwiZGVib3VuY2UiLCJfcmVmIiwiZ2VvVXJpIiwiY29udGVudCIsIm1ha2VCZWFjb25Db250ZW50Iiwic2VuZEV2ZW50IiwiTV9CRUFDT04iLCJuYW1lIiwiaXNFcnJvciIsIkxvY2F0aW9uUHVibGlzaEVycm9yIiwiaW5zdGFuY2UiLCJpbnRlcm5hbEluc3RhbmNlIiwib25Ob3RSZWFkeSIsInJlbW92ZUxpc3RlbmVyIiwiQmVhY29uRXZlbnQiLCJvbkJlYWNvbkxpdmVuZXNzIiwiTmV3Iiwib25OZXdCZWFjb24iLCJVcGRhdGUiLCJvblVwZGF0ZUJlYWNvbiIsIkRlc3Ryb3kiLCJvbkRlc3Ryb3lCZWFjb24iLCJSb29tU3RhdGVFdmVudCIsIk1lbWJlcnMiLCJvblJvb21TdGF0ZU1lbWJlcnMiLCJ1bndhdGNoU2V0dGluZyIsImR5bmFtaWNXYXRjaGVyUmVmIiwiY2xlYXIiLCJvblJlYWR5Iiwib24iLCJ3YXRjaFNldHRpbmciLCJyZWluaXRpYWxpc2VCZWFjb25TdGF0ZSIsIm9uQWN0aW9uIiwicGF5bG9hZCIsInN0YXJ0Il0sInNvdXJjZXMiOlsiLi4vLi4vc3JjL3N0b3Jlcy9Pd25CZWFjb25TdG9yZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuQ29weXJpZ2h0IDIwMjIgVGhlIE1hdHJpeC5vcmcgRm91bmRhdGlvbiBDLkkuQy5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4qL1xuXG5pbXBvcnQgeyBkZWJvdW5jZSB9IGZyb20gXCJsb2Rhc2hcIjtcbmltcG9ydCB7XG4gICAgQmVhY29uLFxuICAgIEJlYWNvbklkZW50aWZpZXIsXG4gICAgQmVhY29uRXZlbnQsXG4gICAgTWF0cml4RXZlbnQsXG4gICAgUm9vbSxcbiAgICBSb29tTWVtYmVyLFxuICAgIFJvb21TdGF0ZSxcbiAgICBSb29tU3RhdGVFdmVudCxcbn0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL21hdHJpeFwiO1xuaW1wb3J0IHsgQmVhY29uSW5mb1N0YXRlLCBtYWtlQmVhY29uQ29udGVudCwgbWFrZUJlYWNvbkluZm9Db250ZW50IH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL2NvbnRlbnQtaGVscGVyc1wiO1xuaW1wb3J0IHsgTUJlYWNvbkluZm9FdmVudENvbnRlbnQsIE1fQkVBQ09OIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL0B0eXBlcy9iZWFjb25cIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9sb2dnZXJcIjtcblxuaW1wb3J0IGRlZmF1bHREaXNwYXRjaGVyIGZyb20gXCIuLi9kaXNwYXRjaGVyL2Rpc3BhdGNoZXJcIjtcbmltcG9ydCB7IEFjdGlvblBheWxvYWQgfSBmcm9tIFwiLi4vZGlzcGF0Y2hlci9wYXlsb2Fkc1wiO1xuaW1wb3J0IHsgQXN5bmNTdG9yZVdpdGhDbGllbnQgfSBmcm9tIFwiLi9Bc3luY1N0b3JlV2l0aENsaWVudFwiO1xuaW1wb3J0IHsgYXJyYXlEaWZmIH0gZnJvbSBcIi4uL3V0aWxzL2FycmF5c1wiO1xuaW1wb3J0IHtcbiAgICBDbGVhcldhdGNoQ2FsbGJhY2ssXG4gICAgR2VvbG9jYXRpb25FcnJvcixcbiAgICBtYXBHZW9sb2NhdGlvblBvc2l0aW9uVG9UaW1lZEdlbyxcbiAgICBzb3J0QmVhY29uc0J5TGF0ZXN0Q3JlYXRpb24sXG4gICAgVGltZWRHZW9VcmksXG4gICAgd2F0Y2hQb3NpdGlvbixcbn0gZnJvbSBcIi4uL3V0aWxzL2JlYWNvblwiO1xuaW1wb3J0IHsgZ2V0Q3VycmVudFBvc2l0aW9uIH0gZnJvbSBcIi4uL3V0aWxzL2JlYWNvblwiO1xuaW1wb3J0IHsgZG9NYXliZUxvY2FsUm9vbUFjdGlvbiB9IGZyb20gXCIuLi91dGlscy9sb2NhbC1yb29tXCI7XG5pbXBvcnQgU2V0dGluZ3NTdG9yZSBmcm9tIFwiLi4vc2V0dGluZ3MvU2V0dGluZ3NTdG9yZVwiO1xuXG5jb25zdCBpc093bkJlYWNvbiA9IChiZWFjb246IEJlYWNvbiwgdXNlcklkOiBzdHJpbmcpOiBib29sZWFuID0+IGJlYWNvbi5iZWFjb25JbmZvT3duZXIgPT09IHVzZXJJZDtcblxuZXhwb3J0IGVudW0gT3duQmVhY29uU3RvcmVFdmVudCB7XG4gICAgTGl2ZW5lc3NDaGFuZ2UgPSBcIk93bkJlYWNvblN0b3JlLkxpdmVuZXNzQ2hhbmdlXCIsXG4gICAgTW9uaXRvcmluZ0xpdmVQb3NpdGlvbiA9IFwiT3duQmVhY29uU3RvcmUuTW9uaXRvcmluZ0xpdmVQb3NpdGlvblwiLFxuICAgIExvY2F0aW9uUHVibGlzaEVycm9yID0gXCJMb2NhdGlvblB1Ymxpc2hFcnJvclwiLFxuICAgIEJlYWNvblVwZGF0ZUVycm9yID0gXCJCZWFjb25VcGRhdGVFcnJvclwiLFxufVxuXG5jb25zdCBNT1ZJTkdfVVBEQVRFX0lOVEVSVkFMID0gNTAwMDtcbmNvbnN0IFNUQVRJQ19VUERBVEVfSU5URVJWQUwgPSAzMDAwMDtcblxuY29uc3QgQkFJTF9BRlRFUl9DT05TRUNVVElWRV9FUlJPUl9DT1VOVCA9IDI7XG5cbnR5cGUgT3duQmVhY29uU3RvcmVTdGF0ZSA9IHtcbiAgICBiZWFjb25zOiBNYXA8QmVhY29uSWRlbnRpZmllciwgQmVhY29uPjtcbiAgICBiZWFjb25Mb2NhdGlvblB1Ymxpc2hFcnJvckNvdW50czogTWFwPEJlYWNvbklkZW50aWZpZXIsIG51bWJlcj47XG4gICAgYmVhY29uVXBkYXRlRXJyb3JzOiBNYXA8QmVhY29uSWRlbnRpZmllciwgRXJyb3I+O1xuICAgIGJlYWNvbnNCeVJvb21JZDogTWFwPFJvb21bXCJyb29tSWRcIl0sIFNldDxCZWFjb25JZGVudGlmaWVyPj47XG4gICAgbGl2ZUJlYWNvbklkczogQmVhY29uSWRlbnRpZmllcltdO1xufTtcblxuY29uc3QgQ1JFQVRFRF9CRUFDT05TX0tFWSA9IFwibXhfbGl2ZV9iZWFjb25fY3JlYXRlZF9pZFwiO1xuY29uc3QgcmVtb3ZlTG9jYWxseUNyZWF0ZUJlYWNvbkV2ZW50SWQgPSAoZXZlbnRJZDogc3RyaW5nKTogdm9pZCA9PiB7XG4gICAgY29uc3QgaWRzID0gZ2V0TG9jYWxseUNyZWF0ZWRCZWFjb25FdmVudElkcygpO1xuICAgIHdpbmRvdy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbShDUkVBVEVEX0JFQUNPTlNfS0VZLCBKU09OLnN0cmluZ2lmeShpZHMuZmlsdGVyKChpZCkgPT4gaWQgIT09IGV2ZW50SWQpKSk7XG59O1xuY29uc3Qgc3RvcmVMb2NhbGx5Q3JlYXRlQmVhY29uRXZlbnRJZCA9IChldmVudElkOiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICBjb25zdCBpZHMgPSBnZXRMb2NhbGx5Q3JlYXRlZEJlYWNvbkV2ZW50SWRzKCk7XG4gICAgd2luZG93LmxvY2FsU3RvcmFnZS5zZXRJdGVtKENSRUFURURfQkVBQ09OU19LRVksIEpTT04uc3RyaW5naWZ5KFsuLi5pZHMsIGV2ZW50SWRdKSk7XG59O1xuXG5jb25zdCBnZXRMb2NhbGx5Q3JlYXRlZEJlYWNvbkV2ZW50SWRzID0gKCk6IHN0cmluZ1tdID0+IHtcbiAgICBsZXQgaWRzOiBzdHJpbmdbXTtcbiAgICB0cnkge1xuICAgICAgICBpZHMgPSBKU09OLnBhcnNlKHdpbmRvdy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbShDUkVBVEVEX0JFQUNPTlNfS0VZKSA/PyBcIltdXCIpO1xuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkoaWRzKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBzdG9yZWQgdmFsdWVcIik7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsb2dnZXIuZXJyb3IoXCJGYWlsZWQgdG8gcmV0cmlldmUgbG9jYWxseSBjcmVhdGVkIGJlYWNvbiBldmVudCBpZHNcIiwgZXJyb3IpO1xuICAgICAgICBpZHMgPSBbXTtcbiAgICB9XG4gICAgcmV0dXJuIGlkcztcbn07XG5leHBvcnQgY2xhc3MgT3duQmVhY29uU3RvcmUgZXh0ZW5kcyBBc3luY1N0b3JlV2l0aENsaWVudDxPd25CZWFjb25TdG9yZVN0YXRlPiB7XG4gICAgcHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgaW50ZXJuYWxJbnN0YW5jZSA9ICgoKSA9PiB7XG4gICAgICAgIGNvbnN0IGluc3RhbmNlID0gbmV3IE93bkJlYWNvblN0b3JlKCk7XG4gICAgICAgIGluc3RhbmNlLnN0YXJ0KCk7XG4gICAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICB9KSgpO1xuICAgIC8vIHVzZXJzIGJlYWNvbnMsIGtleWVkIGJ5IGV2ZW50IHR5cGVcbiAgICBwdWJsaWMgcmVhZG9ubHkgYmVhY29ucyA9IG5ldyBNYXA8QmVhY29uSWRlbnRpZmllciwgQmVhY29uPigpO1xuICAgIHB1YmxpYyByZWFkb25seSBiZWFjb25zQnlSb29tSWQgPSBuZXcgTWFwPFJvb21bXCJyb29tSWRcIl0sIFNldDxCZWFjb25JZGVudGlmaWVyPj4oKTtcbiAgICAvKipcbiAgICAgKiBUcmFjayBvdmVyIHRoZSB3aXJlIGVycm9ycyBmb3IgcHVibGlzaGVkIHBvc2l0aW9uc1xuICAgICAqIENvdW50cyBjb25zZWN1dGl2ZSB3aXJlIGVycm9ycyBwZXIgYmVhY29uXG4gICAgICogUmVzZXQgb24gc3VjY2Vzc2Z1bCBwdWJsaXNoIG9mIGxvY2F0aW9uXG4gICAgICovXG4gICAgcHVibGljIHJlYWRvbmx5IGJlYWNvbkxvY2F0aW9uUHVibGlzaEVycm9yQ291bnRzID0gbmV3IE1hcDxCZWFjb25JZGVudGlmaWVyLCBudW1iZXI+KCk7XG4gICAgcHVibGljIHJlYWRvbmx5IGJlYWNvblVwZGF0ZUVycm9ycyA9IG5ldyBNYXA8QmVhY29uSWRlbnRpZmllciwgRXJyb3I+KCk7XG4gICAgLyoqXG4gICAgICogaWRzIG9mIGxpdmUgYmVhY29uc1xuICAgICAqIG9yZGVyZWQgYnkgY3JlYXRpb24gdGltZSBkZXNjZW5kaW5nXG4gICAgICovXG4gICAgcHJpdmF0ZSBsaXZlQmVhY29uSWRzOiBCZWFjb25JZGVudGlmaWVyW10gPSBbXTtcbiAgICBwcml2YXRlIGxvY2F0aW9uSW50ZXJ2YWw/OiBudW1iZXI7XG4gICAgcHJpdmF0ZSBnZW9sb2NhdGlvbkVycm9yPzogR2VvbG9jYXRpb25FcnJvcjtcbiAgICBwcml2YXRlIGNsZWFyUG9zaXRpb25XYXRjaD86IENsZWFyV2F0Y2hDYWxsYmFjaztcbiAgICAvKipcbiAgICAgKiBUcmFjayB3aGVuIHRoZSBsYXN0IHBvc2l0aW9uIHdhcyBwdWJsaXNoZWRcbiAgICAgKiBTbyB3ZSBjYW4gbWFudWFsbHkgZ2V0IHBvc2l0aW9uIG9uIHNsb3cgaW50ZXJ2YWxcbiAgICAgKiB3aGVuIHRoZSB0YXJnZXQgaXMgc3RhdGlvbmFyeVxuICAgICAqL1xuICAgIHByaXZhdGUgbGFzdFB1Ymxpc2hlZFBvc2l0aW9uVGltZXN0YW1wPzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIFJlZiByZXR1cm5lZCBmcm9tIHdhdGNoU2V0dGluZyBmb3IgdGhlIE1TQzM5NDYgbGFicyBmbGFnXG4gICAgICovXG4gICAgcHJpdmF0ZSBkeW5hbWljV2F0Y2hlclJlZjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG4gICAgcHVibGljIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcihkZWZhdWx0RGlzcGF0Y2hlcik7XG4gICAgfVxuXG4gICAgcHVibGljIHN0YXRpYyBnZXQgaW5zdGFuY2UoKTogT3duQmVhY29uU3RvcmUge1xuICAgICAgICByZXR1cm4gT3duQmVhY29uU3RvcmUuaW50ZXJuYWxJbnN0YW5jZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIHdoZW4gd2UgaGF2ZSBsaXZlIGJlYWNvbnNcbiAgICAgKiBhbmQgZ2VvbG9jYXRpb24ud2F0Y2hQb3NpdGlvbiBpcyBhY3RpdmVcbiAgICAgKi9cbiAgICBwdWJsaWMgZ2V0IGlzTW9uaXRvcmluZ0xpdmVMb2NhdGlvbigpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuICEhdGhpcy5jbGVhclBvc2l0aW9uV2F0Y2g7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGFzeW5jIG9uTm90UmVhZHkoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGlmICh0aGlzLm1hdHJpeENsaWVudCkge1xuICAgICAgICAgICAgdGhpcy5tYXRyaXhDbGllbnQucmVtb3ZlTGlzdGVuZXIoQmVhY29uRXZlbnQuTGl2ZW5lc3NDaGFuZ2UsIHRoaXMub25CZWFjb25MaXZlbmVzcyk7XG4gICAgICAgICAgICB0aGlzLm1hdHJpeENsaWVudC5yZW1vdmVMaXN0ZW5lcihCZWFjb25FdmVudC5OZXcsIHRoaXMub25OZXdCZWFjb24pO1xuICAgICAgICAgICAgdGhpcy5tYXRyaXhDbGllbnQucmVtb3ZlTGlzdGVuZXIoQmVhY29uRXZlbnQuVXBkYXRlLCB0aGlzLm9uVXBkYXRlQmVhY29uKTtcbiAgICAgICAgICAgIHRoaXMubWF0cml4Q2xpZW50LnJlbW92ZUxpc3RlbmVyKEJlYWNvbkV2ZW50LkRlc3Ryb3ksIHRoaXMub25EZXN0cm95QmVhY29uKTtcbiAgICAgICAgICAgIHRoaXMubWF0cml4Q2xpZW50LnJlbW92ZUxpc3RlbmVyKFJvb21TdGF0ZUV2ZW50Lk1lbWJlcnMsIHRoaXMub25Sb29tU3RhdGVNZW1iZXJzKTtcbiAgICAgICAgfVxuICAgICAgICBTZXR0aW5nc1N0b3JlLnVud2F0Y2hTZXR0aW5nKHRoaXMuZHluYW1pY1dhdGNoZXJSZWYgPz8gXCJcIik7XG5cbiAgICAgICAgdGhpcy5jbGVhckJlYWNvbnMoKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGNsZWFyQmVhY29ucygpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5iZWFjb25zLmZvckVhY2goKGJlYWNvbikgPT4gYmVhY29uLmRlc3Ryb3koKSk7XG5cbiAgICAgICAgdGhpcy5zdG9wUG9sbGluZ0xvY2F0aW9uKCk7XG4gICAgICAgIHRoaXMuYmVhY29ucy5jbGVhcigpO1xuICAgICAgICB0aGlzLmJlYWNvbnNCeVJvb21JZC5jbGVhcigpO1xuICAgICAgICB0aGlzLmxpdmVCZWFjb25JZHMgPSBbXTtcbiAgICAgICAgdGhpcy5iZWFjb25Mb2NhdGlvblB1Ymxpc2hFcnJvckNvdW50cy5jbGVhcigpO1xuICAgICAgICB0aGlzLmJlYWNvblVwZGF0ZUVycm9ycy5jbGVhcigpO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBhc3luYyBvblJlYWR5KCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBpZiAodGhpcy5tYXRyaXhDbGllbnQpIHtcbiAgICAgICAgICAgIHRoaXMubWF0cml4Q2xpZW50Lm9uKEJlYWNvbkV2ZW50LkxpdmVuZXNzQ2hhbmdlLCB0aGlzLm9uQmVhY29uTGl2ZW5lc3MpO1xuICAgICAgICAgICAgdGhpcy5tYXRyaXhDbGllbnQub24oQmVhY29uRXZlbnQuTmV3LCB0aGlzLm9uTmV3QmVhY29uKTtcbiAgICAgICAgICAgIHRoaXMubWF0cml4Q2xpZW50Lm9uKEJlYWNvbkV2ZW50LlVwZGF0ZSwgdGhpcy5vblVwZGF0ZUJlYWNvbik7XG4gICAgICAgICAgICB0aGlzLm1hdHJpeENsaWVudC5vbihCZWFjb25FdmVudC5EZXN0cm95LCB0aGlzLm9uRGVzdHJveUJlYWNvbik7XG4gICAgICAgICAgICB0aGlzLm1hdHJpeENsaWVudC5vbihSb29tU3RhdGVFdmVudC5NZW1iZXJzLCB0aGlzLm9uUm9vbVN0YXRlTWVtYmVycyk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5keW5hbWljV2F0Y2hlclJlZiA9IFNldHRpbmdzU3RvcmUud2F0Y2hTZXR0aW5nKFxuICAgICAgICAgICAgXCJmZWF0dXJlX2R5bmFtaWNfcm9vbV9wcmVkZWNlc3NvcnNcIixcbiAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICB0aGlzLnJlaW5pdGlhbGlzZUJlYWNvblN0YXRlLFxuICAgICAgICApO1xuXG4gICAgICAgIHRoaXMuaW5pdGlhbGlzZUJlYWNvblN0YXRlKCk7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGFzeW5jIG9uQWN0aW9uKHBheWxvYWQ6IEFjdGlvblBheWxvYWQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgLy8gd2UgZG9uJ3QgYWN0dWFsbHkgZG8gYW55dGhpbmcgaGVyZVxuICAgIH1cblxuICAgIHB1YmxpYyBoYXNMaXZlQmVhY29ucyA9IChyb29tSWQ/OiBzdHJpbmcpOiBib29sZWFuID0+IHtcbiAgICAgICAgcmV0dXJuICEhdGhpcy5nZXRMaXZlQmVhY29uSWRzKHJvb21JZCkubGVuZ3RoO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBTb21lIGxpdmUgYmVhY29uIGhhcyBhIHdpcmUgZXJyb3JcbiAgICAgKiBPcHRpb25hbGx5IGZpbHRlciBieSByb29tXG4gICAgICovXG4gICAgcHVibGljIGhhc0xvY2F0aW9uUHVibGlzaEVycm9ycyA9IChyb29tSWQ/OiBzdHJpbmcpOiBib29sZWFuID0+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0TGl2ZUJlYWNvbklkcyhyb29tSWQpLnNvbWUodGhpcy5iZWFjb25IYXNMb2NhdGlvblB1Ymxpc2hFcnJvcik7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIElmIGEgYmVhY29uIGhhcyBmYWlsZWQgdG8gcHVibGlzaCBwb3NpdGlvblxuICAgICAqIHBhc3QgdGhlIGFsbG93ZWQgY29uc2VjdXRpdmUgZmFpbHVyZSBjb3VudCAoQkFJTF9BRlRFUl9DT05TRUNVVElWRV9FUlJPUl9DT1VOVClcbiAgICAgKiBUaGVuIGNvbnNpZGVyIGl0IHRvIGhhdmUgYW4gZXJyb3JcbiAgICAgKi9cbiAgICBwdWJsaWMgYmVhY29uSGFzTG9jYXRpb25QdWJsaXNoRXJyb3IgPSAoYmVhY29uSWQ6IHN0cmluZyk6IGJvb2xlYW4gPT4ge1xuICAgICAgICBjb25zdCBjb3VudHMgPSB0aGlzLmJlYWNvbkxvY2F0aW9uUHVibGlzaEVycm9yQ291bnRzLmdldChiZWFjb25JZCk7XG4gICAgICAgIHJldHVybiBjb3VudHMgIT09IHVuZGVmaW5lZCAmJiBjb3VudHMgPj0gQkFJTF9BRlRFUl9DT05TRUNVVElWRV9FUlJPUl9DT1VOVDtcbiAgICB9O1xuXG4gICAgcHVibGljIHJlc2V0TG9jYXRpb25QdWJsaXNoRXJyb3IgPSAoYmVhY29uSWQ6IHN0cmluZyk6IHZvaWQgPT4ge1xuICAgICAgICB0aGlzLmluY3JlbWVudEJlYWNvbkxvY2F0aW9uUHVibGlzaEVycm9yQ291bnQoYmVhY29uSWQsIGZhbHNlKTtcblxuICAgICAgICAvLyBhbHdheXMgcHVibGlzaCB0byBhbGwgbGl2ZSBiZWFjb25zIHRvZ2V0aGVyXG4gICAgICAgIC8vIGluc3RlYWQgb2YganVzdCBvbmUgdGhhdCB3YXMgY2hhbmdlZFxuICAgICAgICAvLyB0byBrZWVwIGxhc3RQdWJsaXNoZWRUaW1lc3RhbXAgc2ltcGxlXG4gICAgICAgIC8vIGFuZCBleHRyYSBwdWJsaXNoZWQgbG9jYXRpb25zIGRvbid0IGh1cnRcbiAgICAgICAgdGhpcy5wdWJsaXNoQ3VycmVudExvY2F0aW9uVG9CZWFjb25zKCk7XG4gICAgfTtcblxuICAgIHB1YmxpYyBnZXRMaXZlQmVhY29uSWRzID0gKHJvb21JZD86IHN0cmluZyk6IHN0cmluZ1tdID0+IHtcbiAgICAgICAgaWYgKCFyb29tSWQpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmxpdmVCZWFjb25JZHM7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMubGl2ZUJlYWNvbklkcy5maWx0ZXIoKGJlYWNvbklkKSA9PiB0aGlzLmJlYWNvbnNCeVJvb21JZC5nZXQocm9vbUlkKT8uaGFzKGJlYWNvbklkKSk7XG4gICAgfTtcblxuICAgIHB1YmxpYyBnZXRMaXZlQmVhY29uSWRzV2l0aExvY2F0aW9uUHVibGlzaEVycm9yID0gKHJvb21JZD86IHN0cmluZyk6IHN0cmluZ1tdID0+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0TGl2ZUJlYWNvbklkcyhyb29tSWQpLmZpbHRlcih0aGlzLmJlYWNvbkhhc0xvY2F0aW9uUHVibGlzaEVycm9yKTtcbiAgICB9O1xuXG4gICAgcHVibGljIGdldEJlYWNvbkJ5SWQgPSAoYmVhY29uSWQ6IHN0cmluZyk6IEJlYWNvbiB8IHVuZGVmaW5lZCA9PiB7XG4gICAgICAgIHJldHVybiB0aGlzLmJlYWNvbnMuZ2V0KGJlYWNvbklkKTtcbiAgICB9O1xuXG4gICAgcHVibGljIHN0b3BCZWFjb24gPSBhc3luYyAoYmVhY29uSWRlbnRpZmllcjogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICAgIGNvbnN0IGJlYWNvbiA9IHRoaXMuYmVhY29ucy5nZXQoYmVhY29uSWRlbnRpZmllcik7XG4gICAgICAgIC8vIGlmIG5vIGJlYWNvbiwgb3IgYmVhY29uIGlzIGFscmVhZHkgZXhwbGljaXRseSBzZXQgaXNMaXZlOiBmYWxzZVxuICAgICAgICAvLyBkbyBub3RoaW5nXG4gICAgICAgIGlmICghYmVhY29uPy5iZWFjb25JbmZvPy5saXZlKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBhd2FpdCB0aGlzLnVwZGF0ZUJlYWNvbkV2ZW50KGJlYWNvbiwgeyBsaXZlOiBmYWxzZSB9KTtcbiAgICAgICAgLy8gcHJ1bmUgZnJvbSBsb2NhbCBzdG9yZVxuICAgICAgICByZW1vdmVMb2NhbGx5Q3JlYXRlQmVhY29uRXZlbnRJZChiZWFjb24uYmVhY29uSW5mb0lkKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogTGlzdGVuZXJzXG4gICAgICovXG5cbiAgICBwcml2YXRlIG9uTmV3QmVhY29uID0gKF9ldmVudDogTWF0cml4RXZlbnQsIGJlYWNvbjogQmVhY29uKTogdm9pZCA9PiB7XG4gICAgICAgIGlmICghdGhpcy5tYXRyaXhDbGllbnQgfHwgIWlzT3duQmVhY29uKGJlYWNvbiwgdGhpcy5tYXRyaXhDbGllbnQuZ2V0VXNlcklkKCkhKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuYWRkQmVhY29uKGJlYWNvbik7XG4gICAgICAgIHRoaXMuY2hlY2tMaXZlbmVzcygpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBUaGlzIHdpbGwgYmUgY2FsbGVkIHdoZW4gYSBiZWFjb24gaXMgcmVwbGFjZWRcbiAgICAgKi9cbiAgICBwcml2YXRlIG9uVXBkYXRlQmVhY29uID0gKF9ldmVudDogTWF0cml4RXZlbnQsIGJlYWNvbjogQmVhY29uKTogdm9pZCA9PiB7XG4gICAgICAgIGlmICghdGhpcy5tYXRyaXhDbGllbnQgfHwgIWlzT3duQmVhY29uKGJlYWNvbiwgdGhpcy5tYXRyaXhDbGllbnQuZ2V0VXNlcklkKCkhKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jaGVja0xpdmVuZXNzKCk7XG4gICAgICAgIGJlYWNvbi5tb25pdG9yTGl2ZW5lc3MoKTtcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBvbkRlc3Ryb3lCZWFjb24gPSAoYmVhY29uSWRlbnRpZmllcjogQmVhY29uSWRlbnRpZmllcik6IHZvaWQgPT4ge1xuICAgICAgICAvLyBjaGVjayBpZiB3ZSBjYXJlIGFib3V0IHRoaXMgYmVhY29uXG4gICAgICAgIGlmICghdGhpcy5iZWFjb25zLmhhcyhiZWFjb25JZGVudGlmaWVyKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jaGVja0xpdmVuZXNzKCk7XG4gICAgfTtcblxuICAgIHByaXZhdGUgb25CZWFjb25MaXZlbmVzcyA9IChpc0xpdmU6IGJvb2xlYW4sIGJlYWNvbjogQmVhY29uKTogdm9pZCA9PiB7XG4gICAgICAgIC8vIGNoZWNrIGlmIHdlIGNhcmUgYWJvdXQgdGhpcyBiZWFjb25cbiAgICAgICAgaWYgKCF0aGlzLmJlYWNvbnMuaGFzKGJlYWNvbi5pZGVudGlmaWVyKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYmVhY29uIGV4cGlyZWQsIHVwZGF0ZSBiZWFjb24gdG8gdW4tYWxpdmUgc3RhdGVcbiAgICAgICAgaWYgKCFpc0xpdmUpIHtcbiAgICAgICAgICAgIHRoaXMuc3RvcEJlYWNvbihiZWFjb24uaWRlbnRpZmllcik7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNoZWNrTGl2ZW5lc3MoKTtcblxuICAgICAgICB0aGlzLmVtaXQoT3duQmVhY29uU3RvcmVFdmVudC5MaXZlbmVzc0NoYW5nZSwgdGhpcy5nZXRMaXZlQmVhY29uSWRzKCkpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBmb3IgY2hhbmdlcyBpbiBtZW1iZXJzaGlwIGluIHJvb21zIHdpdGggYmVhY29uc1xuICAgICAqIGFuZCBzdG9wIG1vbml0b3JpbmcgYmVhY29ucyBpbiByb29tcyB1c2VyIGlzIG5vIGxvbmdlciBtZW1iZXIgb2ZcbiAgICAgKi9cbiAgICBwcml2YXRlIG9uUm9vbVN0YXRlTWVtYmVycyA9IChfZXZlbnQ6IE1hdHJpeEV2ZW50LCByb29tU3RhdGU6IFJvb21TdGF0ZSwgbWVtYmVyOiBSb29tTWVtYmVyKTogdm9pZCA9PiB7XG4gICAgICAgIC8vIG5vIGJlYWNvbnMgZm9yIHRoaXMgcm9vbSwgaWdub3JlXG4gICAgICAgIGlmIChcbiAgICAgICAgICAgICF0aGlzLm1hdHJpeENsaWVudCB8fFxuICAgICAgICAgICAgIXRoaXMuYmVhY29uc0J5Um9vbUlkLmhhcyhyb29tU3RhdGUucm9vbUlkKSB8fFxuICAgICAgICAgICAgbWVtYmVyLnVzZXJJZCAhPT0gdGhpcy5tYXRyaXhDbGllbnQuZ2V0VXNlcklkKClcbiAgICAgICAgKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUT0RPIGNoZWNrIHBvd2VybGV2ZWxzIGhlcmVcbiAgICAgICAgLy8gaW4gUFNGLTc5N1xuXG4gICAgICAgIC8vIHN0b3Agd2F0Y2hpbmcgYmVhY29ucyBpbiByb29tcyB3aGVyZSB1c2VyIGlzIG5vIGxvbmdlciBhIG1lbWJlclxuICAgICAgICBpZiAobWVtYmVyLm1lbWJlcnNoaXAgPT09IFwibGVhdmVcIiB8fCBtZW1iZXIubWVtYmVyc2hpcCA9PT0gXCJiYW5cIikge1xuICAgICAgICAgICAgdGhpcy5iZWFjb25zQnlSb29tSWQuZ2V0KHJvb21TdGF0ZS5yb29tSWQpPy5mb3JFYWNoKHRoaXMucmVtb3ZlQmVhY29uKTtcbiAgICAgICAgICAgIHRoaXMuYmVhY29uc0J5Um9vbUlkLmRlbGV0ZShyb29tU3RhdGUucm9vbUlkKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBTdGF0ZSBtYW5hZ2VtZW50XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBMaXZlIGJlYWNvbiBpZHMgdGhhdCBkbyBub3QgaGF2ZSB3aXJlIGVycm9yc1xuICAgICAqL1xuICAgIHByaXZhdGUgZ2V0IGhlYWx0aHlMaXZlQmVhY29uSWRzKCk6IHN0cmluZ1tdIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubGl2ZUJlYWNvbklkcy5maWx0ZXIoXG4gICAgICAgICAgICAoYmVhY29uSWQpID0+ICF0aGlzLmJlYWNvbkhhc0xvY2F0aW9uUHVibGlzaEVycm9yKGJlYWNvbklkKSAmJiAhdGhpcy5iZWFjb25VcGRhdGVFcnJvcnMuaGFzKGJlYWNvbklkKSxcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAaW50ZXJuYWwgcHVibGljIGZvciB0ZXN0IG9ubHlcbiAgICAgKi9cbiAgICBwdWJsaWMgcmVpbml0aWFsaXNlQmVhY29uU3RhdGUgPSAoKTogdm9pZCA9PiB7XG4gICAgICAgIHRoaXMuY2xlYXJCZWFjb25zKCk7XG4gICAgICAgIHRoaXMuaW5pdGlhbGlzZUJlYWNvblN0YXRlKCk7XG4gICAgfTtcblxuICAgIHByaXZhdGUgaW5pdGlhbGlzZUJlYWNvblN0YXRlID0gKCk6IHZvaWQgPT4ge1xuICAgICAgICBpZiAoIXRoaXMubWF0cml4Q2xpZW50KSByZXR1cm47XG4gICAgICAgIGNvbnN0IHVzZXJJZCA9IHRoaXMubWF0cml4Q2xpZW50LmdldFNhZmVVc2VySWQoKTtcbiAgICAgICAgY29uc3QgdmlzaWJsZVJvb21zID0gdGhpcy5tYXRyaXhDbGllbnQuZ2V0VmlzaWJsZVJvb21zKFxuICAgICAgICAgICAgU2V0dGluZ3NTdG9yZS5nZXRWYWx1ZShcImZlYXR1cmVfZHluYW1pY19yb29tX3ByZWRlY2Vzc29yc1wiKSxcbiAgICAgICAgKTtcblxuICAgICAgICB2aXNpYmxlUm9vbXMuZm9yRWFjaCgocm9vbSkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgcm9vbVN0YXRlID0gcm9vbS5jdXJyZW50U3RhdGU7XG4gICAgICAgICAgICBjb25zdCBiZWFjb25zID0gcm9vbVN0YXRlLmJlYWNvbnM7XG4gICAgICAgICAgICBjb25zdCBvd25CZWFjb25zQXJyYXkgPSBbLi4uYmVhY29ucy52YWx1ZXMoKV0uZmlsdGVyKChiZWFjb24pID0+IGlzT3duQmVhY29uKGJlYWNvbiwgdXNlcklkKSk7XG4gICAgICAgICAgICBvd25CZWFjb25zQXJyYXkuZm9yRWFjaCgoYmVhY29uKSA9PiB0aGlzLmFkZEJlYWNvbihiZWFjb24pKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5jaGVja0xpdmVuZXNzKCk7XG4gICAgfTtcblxuICAgIHByaXZhdGUgYWRkQmVhY29uID0gKGJlYWNvbjogQmVhY29uKTogdm9pZCA9PiB7XG4gICAgICAgIHRoaXMuYmVhY29ucy5zZXQoYmVhY29uLmlkZW50aWZpZXIsIGJlYWNvbik7XG5cbiAgICAgICAgaWYgKCF0aGlzLmJlYWNvbnNCeVJvb21JZC5oYXMoYmVhY29uLnJvb21JZCkpIHtcbiAgICAgICAgICAgIHRoaXMuYmVhY29uc0J5Um9vbUlkLnNldChiZWFjb24ucm9vbUlkLCBuZXcgU2V0PHN0cmluZz4oKSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmJlYWNvbnNCeVJvb21JZC5nZXQoYmVhY29uLnJvb21JZCkhLmFkZChiZWFjb24uaWRlbnRpZmllcik7XG5cbiAgICAgICAgYmVhY29uLm1vbml0b3JMaXZlbmVzcygpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgbGlzdGVuZXJzIGZvciBhIGdpdmVuIGJlYWNvblxuICAgICAqIHJlbW92ZSBmcm9tIHN0YXRlXG4gICAgICogYW5kIHVwZGF0ZSBsaXZlbmVzcyBpZiBjaGFuZ2VkXG4gICAgICovXG4gICAgcHJpdmF0ZSByZW1vdmVCZWFjb24gPSAoYmVhY29uSWQ6IHN0cmluZyk6IHZvaWQgPT4ge1xuICAgICAgICBpZiAoIXRoaXMuYmVhY29ucy5oYXMoYmVhY29uSWQpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5iZWFjb25zLmdldChiZWFjb25JZCkhLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5iZWFjb25zLmRlbGV0ZShiZWFjb25JZCk7XG5cbiAgICAgICAgdGhpcy5jaGVja0xpdmVuZXNzKCk7XG4gICAgfTtcblxuICAgIHByaXZhdGUgY2hlY2tMaXZlbmVzcyA9ICgpOiB2b2lkID0+IHtcbiAgICAgICAgY29uc3QgbG9jYWxseUNyZWF0ZWRCZWFjb25FdmVudElkcyA9IGdldExvY2FsbHlDcmVhdGVkQmVhY29uRXZlbnRJZHMoKTtcbiAgICAgICAgY29uc3QgcHJldkxpdmVCZWFjb25JZHMgPSB0aGlzLmdldExpdmVCZWFjb25JZHMoKTtcbiAgICAgICAgdGhpcy5saXZlQmVhY29uSWRzID0gWy4uLnRoaXMuYmVhY29ucy52YWx1ZXMoKV1cbiAgICAgICAgICAgIC5maWx0ZXIoXG4gICAgICAgICAgICAgICAgKGJlYWNvbikgPT5cbiAgICAgICAgICAgICAgICAgICAgYmVhY29uLmlzTGl2ZSAmJlxuICAgICAgICAgICAgICAgICAgICAvLyBvbmx5IGJlYWNvbnMgY3JlYXRlZCBvbiB0aGlzIGRldmljZSBzaG91bGQgYmUgc2hhcmVkIHRvXG4gICAgICAgICAgICAgICAgICAgIGxvY2FsbHlDcmVhdGVkQmVhY29uRXZlbnRJZHMuaW5jbHVkZXMoYmVhY29uLmJlYWNvbkluZm9JZCksXG4gICAgICAgICAgICApXG4gICAgICAgICAgICAuc29ydChzb3J0QmVhY29uc0J5TGF0ZXN0Q3JlYXRpb24pXG4gICAgICAgICAgICAubWFwKChiZWFjb24pID0+IGJlYWNvbi5pZGVudGlmaWVyKTtcblxuICAgICAgICBjb25zdCBkaWZmID0gYXJyYXlEaWZmKHByZXZMaXZlQmVhY29uSWRzLCB0aGlzLmxpdmVCZWFjb25JZHMpO1xuXG4gICAgICAgIGlmIChkaWZmLmFkZGVkLmxlbmd0aCB8fCBkaWZmLnJlbW92ZWQubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXQoT3duQmVhY29uU3RvcmVFdmVudC5MaXZlbmVzc0NoYW5nZSwgdGhpcy5saXZlQmVhY29uSWRzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHB1Ymxpc2ggY3VycmVudCBsb2NhdGlvbiBpbW1lZGlhdGVseVxuICAgICAgICAvLyB3aGVuIHRoZXJlIGFyZSBuZXcgbGl2ZSBiZWFjb25zXG4gICAgICAgIC8vIGFuZCB3ZSBhbHJlYWR5IGhhdmUgYSBsaXZlIG1vbml0b3JcbiAgICAgICAgLy8gc28gZmlyc3QgcG9zaXRpb24gaXMgcHVibGlzaGVkIHF1aWNrbHlcbiAgICAgICAgLy8gZXZlbiB3aGVuIHRhcmdldCBpcyBzdGF0aW9uYXJ5XG4gICAgICAgIC8vXG4gICAgICAgIC8vIHdoZW4gdGhlcmUgaXMgbm8gZXhpc3RpbmcgbGl2ZSBtb25pdG9yXG4gICAgICAgIC8vIGl0IHdpbGwgYmUgY3JlYXRlZCBiZWxvdyBieSB0b2dnbGVQb2xsaW5nTG9jYXRpb25cbiAgICAgICAgLy8gYW5kIHB1Ymxpc2ggZmlyc3QgcG9zaXRpb24gcXVpY2tseVxuICAgICAgICBpZiAoZGlmZi5hZGRlZC5sZW5ndGggJiYgdGhpcy5pc01vbml0b3JpbmdMaXZlTG9jYXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMucHVibGlzaEN1cnJlbnRMb2NhdGlvblRvQmVhY29ucygpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgb3ZlcmFsbCBsaXZlbmVzcyBjaGFuZ2VkXG4gICAgICAgIGlmICghIXByZXZMaXZlQmVhY29uSWRzPy5sZW5ndGggIT09ICEhdGhpcy5saXZlQmVhY29uSWRzLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhpcy50b2dnbGVQb2xsaW5nTG9jYXRpb24oKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBwdWJsaWMgY3JlYXRlTGl2ZUJlYWNvbiA9IGFzeW5jIChcbiAgICAgICAgcm9vbUlkOiBSb29tW1wicm9vbUlkXCJdLFxuICAgICAgICBiZWFjb25JbmZvQ29udGVudDogTUJlYWNvbkluZm9FdmVudENvbnRlbnQsXG4gICAgKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICAgIGlmICghdGhpcy5tYXRyaXhDbGllbnQpIHJldHVybjtcbiAgICAgICAgLy8gZXhwbGljaXRseSBzdG9wIGFueSBsaXZlIGJlYWNvbnMgdGhpcyB1c2VyIGhhc1xuICAgICAgICAvLyB0byBlbnN1cmUgdGhleSByZW1haW4gc3RvcHBlZFxuICAgICAgICAvLyBpZiB0aGUgbmV3IHJlcGxhY2luZyBiZWFjb24gaXMgcmVkYWN0ZWRcbiAgICAgICAgY29uc3QgZXhpc3RpbmdMaXZlQmVhY29uSWRzRm9yUm9vbSA9IHRoaXMuZ2V0TGl2ZUJlYWNvbklkcyhyb29tSWQpO1xuICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChleGlzdGluZ0xpdmVCZWFjb25JZHNGb3JSb29tLm1hcCgoYmVhY29uSWQpID0+IHRoaXMuc3RvcEJlYWNvbihiZWFjb25JZCkpKTtcblxuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgY2FtZWxjYXNlXG4gICAgICAgIGNvbnN0IHsgZXZlbnRfaWQgfSA9IGF3YWl0IGRvTWF5YmVMb2NhbFJvb21BY3Rpb24oXG4gICAgICAgICAgICByb29tSWQsXG4gICAgICAgICAgICAoYWN0dWFsUm9vbUlkOiBzdHJpbmcpID0+IHRoaXMubWF0cml4Q2xpZW50IS51bnN0YWJsZV9jcmVhdGVMaXZlQmVhY29uKGFjdHVhbFJvb21JZCwgYmVhY29uSW5mb0NvbnRlbnQpLFxuICAgICAgICAgICAgdGhpcy5tYXRyaXhDbGllbnQsXG4gICAgICAgICk7XG5cbiAgICAgICAgc3RvcmVMb2NhbGx5Q3JlYXRlQmVhY29uRXZlbnRJZChldmVudF9pZCk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEdlb2xvY2F0aW9uXG4gICAgICovXG5cbiAgICBwcml2YXRlIHRvZ2dsZVBvbGxpbmdMb2NhdGlvbiA9ICgpOiB2b2lkID0+IHtcbiAgICAgICAgaWYgKCEhdGhpcy5saXZlQmVhY29uSWRzLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhpcy5zdGFydFBvbGxpbmdMb2NhdGlvbigpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5zdG9wUG9sbGluZ0xvY2F0aW9uKCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBzdGFydFBvbGxpbmdMb2NhdGlvbiA9IGFzeW5jICgpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgICAgLy8gY2xlYXIgYW55IGV4aXN0aW5nIGludGVydmFsXG4gICAgICAgIHRoaXMuc3RvcFBvbGxpbmdMb2NhdGlvbigpO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLmNsZWFyUG9zaXRpb25XYXRjaCA9IHdhdGNoUG9zaXRpb24odGhpcy5vbldhdGNoZWRQb3NpdGlvbiwgdGhpcy5vbkdlb2xvY2F0aW9uRXJyb3IpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgdGhpcy5vbkdlb2xvY2F0aW9uRXJyb3IoZXJyb3I/Lm1lc3NhZ2UpO1xuICAgICAgICAgICAgLy8gZG9uJ3Qgc2V0IGxvY2F0aW9uSW50ZXJ2YWwgaWYgZ2VvbG9jYXRpb24gZmFpbGVkIHRvIHNldHVwXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmxvY2F0aW9uSW50ZXJ2YWwgPSB3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmxhc3RQdWJsaXNoZWRQb3NpdGlvblRpbWVzdGFtcCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIGlmIHBvc2l0aW9uIHdhcyBsYXN0IHVwZGF0ZWQgU1RBVElDX1VQREFURV9JTlRFUlZBTCBtcyBhZ28gb3IgbW9yZVxuICAgICAgICAgICAgLy8gZ2V0IG91ciBwb3NpdGlvbiBhbmQgcHVibGlzaCBpdFxuICAgICAgICAgICAgaWYgKHRoaXMubGFzdFB1Ymxpc2hlZFBvc2l0aW9uVGltZXN0YW1wIDw9IERhdGUubm93KCkgLSBTVEFUSUNfVVBEQVRFX0lOVEVSVkFMKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wdWJsaXNoQ3VycmVudExvY2F0aW9uVG9CZWFjb25zKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIFNUQVRJQ19VUERBVEVfSU5URVJWQUwpO1xuXG4gICAgICAgIHRoaXMuZW1pdChPd25CZWFjb25TdG9yZUV2ZW50Lk1vbml0b3JpbmdMaXZlUG9zaXRpb24pO1xuICAgIH07XG5cbiAgICBwcml2YXRlIHN0b3BQb2xsaW5nTG9jYXRpb24gPSAoKTogdm9pZCA9PiB7XG4gICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5sb2NhdGlvbkludGVydmFsKTtcbiAgICAgICAgdGhpcy5sb2NhdGlvbkludGVydmFsID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLmxhc3RQdWJsaXNoZWRQb3NpdGlvblRpbWVzdGFtcCA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5nZW9sb2NhdGlvbkVycm9yID0gdW5kZWZpbmVkO1xuXG4gICAgICAgIGlmICh0aGlzLmNsZWFyUG9zaXRpb25XYXRjaCkge1xuICAgICAgICAgICAgdGhpcy5jbGVhclBvc2l0aW9uV2F0Y2goKTtcbiAgICAgICAgICAgIHRoaXMuY2xlYXJQb3NpdGlvbldhdGNoID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5lbWl0KE93bkJlYWNvblN0b3JlRXZlbnQuTW9uaXRvcmluZ0xpdmVQb3NpdGlvbik7XG4gICAgfTtcblxuICAgIHByaXZhdGUgb25XYXRjaGVkUG9zaXRpb24gPSAocG9zaXRpb246IEdlb2xvY2F0aW9uUG9zaXRpb24pOiB2b2lkID0+IHtcbiAgICAgICAgY29uc3QgdGltZWRHZW9Qb3NpdGlvbiA9IG1hcEdlb2xvY2F0aW9uUG9zaXRpb25Ub1RpbWVkR2VvKHBvc2l0aW9uKTtcblxuICAgICAgICAvLyBpZiB0aGlzIGlzIG91ciBmaXJzdCBwb3NpdGlvbiwgcHVibGlzaCBpbW1lZGlhdGVseVxuICAgICAgICBpZiAoIXRoaXMubGFzdFB1Ymxpc2hlZFBvc2l0aW9uVGltZXN0YW1wKSB7XG4gICAgICAgICAgICB0aGlzLnB1Ymxpc2hMb2NhdGlvblRvQmVhY29ucyh0aW1lZEdlb1Bvc2l0aW9uKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZGVib3VuY2VkUHVibGlzaExvY2F0aW9uVG9CZWFjb25zKHRpbWVkR2VvUG9zaXRpb24pO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHByaXZhdGUgb25HZW9sb2NhdGlvbkVycm9yID0gYXN5bmMgKGVycm9yOiBHZW9sb2NhdGlvbkVycm9yKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICAgIHRoaXMuZ2VvbG9jYXRpb25FcnJvciA9IGVycm9yO1xuICAgICAgICBsb2dnZXIuZXJyb3IoXCJHZW9sb2NhdGlvbiBmYWlsZWRcIiwgdGhpcy5nZW9sb2NhdGlvbkVycm9yKTtcblxuICAgICAgICAvLyBvdGhlciBlcnJvcnMgYXJlIGNvbnNpZGVyZWQgbm9uLWZhdGFsXG4gICAgICAgIC8vIGFuZCBzZWxmIHJlY292ZXJpbmdcbiAgICAgICAgaWYgKCFbR2VvbG9jYXRpb25FcnJvci5VbmF2YWlsYWJsZSwgR2VvbG9jYXRpb25FcnJvci5QZXJtaXNzaW9uRGVuaWVkXS5pbmNsdWRlcyhlcnJvcikpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3RvcFBvbGxpbmdMb2NhdGlvbigpO1xuICAgICAgICAvLyBraWxsIGxpdmUgYmVhY29ucyB3aGVuIGxvY2F0aW9uIHBlcm1pc3Npb25zIGFyZSByZXZva2VkXG4gICAgICAgIGF3YWl0IFByb21pc2UuYWxsKHRoaXMubGl2ZUJlYWNvbklkcy5tYXAodGhpcy5zdG9wQmVhY29uKSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIGN1cnJlbnQgbG9jYXRpb25cbiAgICAgKiAoYXMgb3Bwb3NlZCB0byB1c2luZyB3YXRjaGVkIGxvY2F0aW9uKVxuICAgICAqIGFuZCBwdWJsaXNoZXMgaXQgdG8gYWxsIGxpdmUgYmVhY29uc1xuICAgICAqL1xuICAgIHByaXZhdGUgcHVibGlzaEN1cnJlbnRMb2NhdGlvblRvQmVhY29ucyA9IGFzeW5jICgpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHBvc2l0aW9uID0gYXdhaXQgZ2V0Q3VycmVudFBvc2l0aW9uKCk7XG4gICAgICAgICAgICB0aGlzLnB1Ymxpc2hMb2NhdGlvblRvQmVhY29ucyhtYXBHZW9sb2NhdGlvblBvc2l0aW9uVG9UaW1lZEdlbyhwb3NpdGlvbikpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgdGhpcy5vbkdlb2xvY2F0aW9uRXJyb3IoZXJyb3I/Lm1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIE1hdHJpeENsaWVudCBhcGlcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZXMgYmVhY29uIHdpdGggcHJvdmlkZWQgY29udGVudCB1cGRhdGVcbiAgICAgKiBSZWNvcmRzIGVycm9yIGluIGJlYWNvblVwZGF0ZUVycm9yc1xuICAgICAqIHJldGhyb3dzXG4gICAgICovXG4gICAgcHJpdmF0ZSB1cGRhdGVCZWFjb25FdmVudCA9IGFzeW5jIChiZWFjb246IEJlYWNvbiwgdXBkYXRlOiBQYXJ0aWFsPEJlYWNvbkluZm9TdGF0ZT4pOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgICAgY29uc3QgeyBkZXNjcmlwdGlvbiwgdGltZW91dCwgdGltZXN0YW1wLCBsaXZlLCBhc3NldFR5cGUgfSA9IHtcbiAgICAgICAgICAgIC4uLmJlYWNvbi5iZWFjb25JbmZvLFxuICAgICAgICAgICAgLi4udXBkYXRlLFxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IHVwZGF0ZUNvbnRlbnQgPSBtYWtlQmVhY29uSW5mb0NvbnRlbnQodGltZW91dCwgbGl2ZSwgZGVzY3JpcHRpb24sIGFzc2V0VHlwZSwgdGltZXN0YW1wKTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5tYXRyaXhDbGllbnQhLnVuc3RhYmxlX3NldExpdmVCZWFjb24oYmVhY29uLnJvb21JZCwgdXBkYXRlQ29udGVudCk7XG4gICAgICAgICAgICAvLyBjbGVhbnVwIGFueSBlcnJvcnNcbiAgICAgICAgICAgIGNvbnN0IGhhZEVycm9yID0gdGhpcy5iZWFjb25VcGRhdGVFcnJvcnMuaGFzKGJlYWNvbi5pZGVudGlmaWVyKTtcbiAgICAgICAgICAgIGlmIChoYWRFcnJvcikge1xuICAgICAgICAgICAgICAgIHRoaXMuYmVhY29uVXBkYXRlRXJyb3JzLmRlbGV0ZShiZWFjb24uaWRlbnRpZmllcik7XG4gICAgICAgICAgICAgICAgdGhpcy5lbWl0KE93bkJlYWNvblN0b3JlRXZlbnQuQmVhY29uVXBkYXRlRXJyb3IsIGJlYWNvbi5pZGVudGlmaWVyLCBmYWxzZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBsb2dnZXIuZXJyb3IoXCJGYWlsZWQgdG8gdXBkYXRlIGJlYWNvblwiLCBlcnJvcik7XG4gICAgICAgICAgICB0aGlzLmJlYWNvblVwZGF0ZUVycm9ycy5zZXQoYmVhY29uLmlkZW50aWZpZXIsIGVycm9yKTtcbiAgICAgICAgICAgIHRoaXMuZW1pdChPd25CZWFjb25TdG9yZUV2ZW50LkJlYWNvblVwZGF0ZUVycm9yLCBiZWFjb24uaWRlbnRpZmllciwgdHJ1ZSk7XG5cbiAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFNlbmRzIG0ubG9jYXRpb24gZXZlbnRzIHRvIGFsbCBsaXZlIGJlYWNvbnNcbiAgICAgKiBTZXRzIGxhc3QgcHVibGlzaGVkIGJlYWNvblxuICAgICAqL1xuICAgIHByaXZhdGUgcHVibGlzaExvY2F0aW9uVG9CZWFjb25zID0gYXN5bmMgKHBvc2l0aW9uOiBUaW1lZEdlb1VyaSk6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgICAgICB0aGlzLmxhc3RQdWJsaXNoZWRQb3NpdGlvblRpbWVzdGFtcCA9IERhdGUubm93KCk7XG4gICAgICAgIGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgICAgICAgdGhpcy5oZWFsdGh5TGl2ZUJlYWNvbklkcy5tYXAoKGJlYWNvbklkKSA9PlxuICAgICAgICAgICAgICAgIHRoaXMuYmVhY29ucy5oYXMoYmVhY29uSWQpID8gdGhpcy5zZW5kTG9jYXRpb25Ub0JlYWNvbih0aGlzLmJlYWNvbnMuZ2V0KGJlYWNvbklkKSEsIHBvc2l0aW9uKSA6IG51bGwsXG4gICAgICAgICAgICApLFxuICAgICAgICApO1xuICAgIH07XG5cbiAgICBwcml2YXRlIGRlYm91bmNlZFB1Ymxpc2hMb2NhdGlvblRvQmVhY29ucyA9IGRlYm91bmNlKHRoaXMucHVibGlzaExvY2F0aW9uVG9CZWFjb25zLCBNT1ZJTkdfVVBEQVRFX0lOVEVSVkFMKTtcblxuICAgIC8qKlxuICAgICAqIFNlbmRzIG0ubG9jYXRpb24gZXZlbnQgdG8gcmVmZXJlbmNpbmcgZ2l2ZW4gYmVhY29uXG4gICAgICovXG4gICAgcHJpdmF0ZSBzZW5kTG9jYXRpb25Ub0JlYWNvbiA9IGFzeW5jIChiZWFjb246IEJlYWNvbiwgeyBnZW9VcmksIHRpbWVzdGFtcCB9OiBUaW1lZEdlb1VyaSk6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgICAgICBjb25zdCBjb250ZW50ID0gbWFrZUJlYWNvbkNvbnRlbnQoZ2VvVXJpLCB0aW1lc3RhbXAsIGJlYWNvbi5iZWFjb25JbmZvSWQpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5tYXRyaXhDbGllbnQhLnNlbmRFdmVudChiZWFjb24ucm9vbUlkLCBNX0JFQUNPTi5uYW1lLCBjb250ZW50KTtcbiAgICAgICAgICAgIHRoaXMuaW5jcmVtZW50QmVhY29uTG9jYXRpb25QdWJsaXNoRXJyb3JDb3VudChiZWFjb24uaWRlbnRpZmllciwgZmFsc2UpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgbG9nZ2VyLmVycm9yKGVycm9yKTtcbiAgICAgICAgICAgIHRoaXMuaW5jcmVtZW50QmVhY29uTG9jYXRpb25QdWJsaXNoRXJyb3JDb3VudChiZWFjb24uaWRlbnRpZmllciwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogTWFuYWdlIGJlYWNvbiB3aXJlIGVycm9yIGNvdW50XG4gICAgICogLSBjbGVhciBjb3VudCBmb3IgYmVhY29uIHdoZW4gbm90IGVycm9yXG4gICAgICogLSBpbmNyZW1lbnQgY291bnQgZm9yIGJlYWNvbiB3aGVuIGlzIGVycm9yXG4gICAgICogLSBlbWl0IGlmIGJlYWNvbiBlcnJvciBjb3VudCBjcm9zc2VkIHRocmVzaG9sZFxuICAgICAqL1xuICAgIHByaXZhdGUgaW5jcmVtZW50QmVhY29uTG9jYXRpb25QdWJsaXNoRXJyb3JDb3VudCA9IChiZWFjb25JZDogc3RyaW5nLCBpc0Vycm9yOiBib29sZWFuKTogdm9pZCA9PiB7XG4gICAgICAgIGNvbnN0IGhhZEVycm9yID0gdGhpcy5iZWFjb25IYXNMb2NhdGlvblB1Ymxpc2hFcnJvcihiZWFjb25JZCk7XG5cbiAgICAgICAgaWYgKGlzRXJyb3IpIHtcbiAgICAgICAgICAgIC8vIGluY3JlbWVudCBlcnJvciBjb3VudFxuICAgICAgICAgICAgdGhpcy5iZWFjb25Mb2NhdGlvblB1Ymxpc2hFcnJvckNvdW50cy5zZXQoXG4gICAgICAgICAgICAgICAgYmVhY29uSWQsXG4gICAgICAgICAgICAgICAgKHRoaXMuYmVhY29uTG9jYXRpb25QdWJsaXNoRXJyb3JDb3VudHMuZ2V0KGJlYWNvbklkKSA/PyAwKSArIDEsXG4gICAgICAgICAgICApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gY2xlYXIgYW55IGVycm9yIGNvdW50XG4gICAgICAgICAgICB0aGlzLmJlYWNvbkxvY2F0aW9uUHVibGlzaEVycm9yQ291bnRzLmRlbGV0ZShiZWFjb25JZCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5iZWFjb25IYXNMb2NhdGlvblB1Ymxpc2hFcnJvcihiZWFjb25JZCkgIT09IGhhZEVycm9yKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXQoT3duQmVhY29uU3RvcmVFdmVudC5Mb2NhdGlvblB1Ymxpc2hFcnJvciwgYmVhY29uSWQpO1xuICAgICAgICB9XG4gICAgfTtcbn1cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFnQkEsSUFBQUEsT0FBQSxHQUFBQyxPQUFBO0FBQ0EsSUFBQUMsT0FBQSxHQUFBRCxPQUFBO0FBVUEsSUFBQUUsZUFBQSxHQUFBRixPQUFBO0FBQ0EsSUFBQUcsT0FBQSxHQUFBSCxPQUFBO0FBQ0EsSUFBQUksT0FBQSxHQUFBSixPQUFBO0FBRUEsSUFBQUssV0FBQSxHQUFBQyxzQkFBQSxDQUFBTixPQUFBO0FBRUEsSUFBQU8scUJBQUEsR0FBQVAsT0FBQTtBQUNBLElBQUFRLE9BQUEsR0FBQVIsT0FBQTtBQUNBLElBQUFTLFFBQUEsR0FBQVQsT0FBQTtBQVNBLElBQUFVLFVBQUEsR0FBQVYsT0FBQTtBQUNBLElBQUFXLGNBQUEsR0FBQUwsc0JBQUEsQ0FBQU4sT0FBQTtBQUFzRCxTQUFBWSxRQUFBQyxNQUFBLEVBQUFDLGNBQUEsUUFBQUMsSUFBQSxHQUFBQyxNQUFBLENBQUFELElBQUEsQ0FBQUYsTUFBQSxPQUFBRyxNQUFBLENBQUFDLHFCQUFBLFFBQUFDLE9BQUEsR0FBQUYsTUFBQSxDQUFBQyxxQkFBQSxDQUFBSixNQUFBLEdBQUFDLGNBQUEsS0FBQUksT0FBQSxHQUFBQSxPQUFBLENBQUFDLE1BQUEsV0FBQUMsR0FBQSxXQUFBSixNQUFBLENBQUFLLHdCQUFBLENBQUFSLE1BQUEsRUFBQU8sR0FBQSxFQUFBRSxVQUFBLE9BQUFQLElBQUEsQ0FBQVEsSUFBQSxDQUFBQyxLQUFBLENBQUFULElBQUEsRUFBQUcsT0FBQSxZQUFBSCxJQUFBO0FBQUEsU0FBQVUsY0FBQUMsTUFBQSxhQUFBQyxDQUFBLE1BQUFBLENBQUEsR0FBQUMsU0FBQSxDQUFBQyxNQUFBLEVBQUFGLENBQUEsVUFBQUcsTUFBQSxXQUFBRixTQUFBLENB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