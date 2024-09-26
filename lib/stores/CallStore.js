"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CallStoreEvent = exports.CallStore = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _logger = require("matrix-js-sdk/src/logger");
var _groupCallEventHandler = require("matrix-js-sdk/src/webrtc/groupCallEventHandler");
var _dispatcher = _interopRequireDefault(require("../dispatcher/dispatcher"));
var _AsyncStore = require("./AsyncStore");
var _AsyncStoreWithClient = require("./AsyncStoreWithClient");
var _WidgetStore = _interopRequireDefault(require("./WidgetStore"));
var _SettingsStore = _interopRequireDefault(require("../settings/SettingsStore"));
var _SettingLevel = require("../settings/SettingLevel");
var _Call = require("../models/Call");
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
let CallStoreEvent = /*#__PURE__*/function (CallStoreEvent) {
  CallStoreEvent["Call"] = "call";
  CallStoreEvent["ActiveCalls"] = "active_calls";
  return CallStoreEvent;
}({});
exports.CallStoreEvent = CallStoreEvent;
class CallStore extends _AsyncStoreWithClient.AsyncStoreWithClient {
  static get instance() {
    if (!this._instance) {
      this._instance = new CallStore();
      this._instance.start();
    }
    return this._instance;
  }
  constructor() {
    super(_dispatcher.default);
    (0, _defineProperty2.default)(this, "_activeCalls", new Set());
    (0, _defineProperty2.default)(this, "calls", new Map());
    // Key is room ID
    (0, _defineProperty2.default)(this, "callListeners", new Map());
    (0, _defineProperty2.default)(this, "onWidgets", roomId => {
      if (!this.matrixClient) return;
      if (roomId === null) {
        // This store happened to start before the widget store was done
        // loading all rooms, so we need to initialize each room again
        for (const room of this.matrixClient.getRooms()) {
          this.updateRoom(room);
        }
      } else {
        const room = this.matrixClient.getRoom(roomId);
        // Widget updates can arrive before the room does, empirically
        if (room !== null) this.updateRoom(room);
      }
    });
    (0, _defineProperty2.default)(this, "onGroupCall", groupCall => this.updateRoom(groupCall.room));
  }
  async onAction() {
    // nothing to do
  }
  async onReady() {
    if (!this.matrixClient) return;
    // We assume that the calls present in a room are a function of room
    // widgets and group calls, so we initialize the room map here and then
    // update it whenever those change
    for (const room of this.matrixClient.getRooms()) {
      this.updateRoom(room);
    }
    this.matrixClient.on(_groupCallEventHandler.GroupCallEventHandlerEvent.Incoming, this.onGroupCall);
    this.matrixClient.on(_groupCallEventHandler.GroupCallEventHandlerEvent.Outgoing, this.onGroupCall);
    _WidgetStore.default.instance.on(_AsyncStore.UPDATE_EVENT, this.onWidgets);

    // If the room ID of a previously connected call is still in settings at
    // this time, that's a sign that we failed to disconnect from it
    // properly, and need to clean up after ourselves
    const uncleanlyDisconnectedRoomIds = _SettingsStore.default.getValue("activeCallRoomIds");
    if (uncleanlyDisconnectedRoomIds.length) {
      await Promise.all([...uncleanlyDisconnectedRoomIds.map(async uncleanlyDisconnectedRoomId => {
        _logger.logger.log(`Cleaning up call state for room ${uncleanlyDisconnectedRoomId}`);
        await this.getCall(uncleanlyDisconnectedRoomId)?.clean();
      }), _SettingsStore.default.setValue("activeCallRoomIds", null, _SettingLevel.SettingLevel.DEVICE, [])]);
    }
  }
  async onNotReady() {
    for (const [call, listenerMap] of this.callListeners) {
      // It's important that we remove the listeners before destroying the
      // call, because otherwise the call's onDestroy callback would fire
      // and immediately repopulate the map
      for (const [event, listener] of listenerMap) call.off(event, listener);
      call.destroy();
    }
    this.callListeners.clear();
    this.calls.clear();
    this._activeCalls.clear();
    if (this.matrixClient) {
      this.matrixClient.off(_groupCallEventHandler.GroupCallEventHandlerEvent.Incoming, this.onGroupCall);
      this.matrixClient.off(_groupCallEventHandler.GroupCallEventHandlerEvent.Outgoing, this.onGroupCall);
      this.matrixClient.off(_groupCallEventHandler.GroupCallEventHandlerEvent.Ended, this.onGroupCall);
    }
    _WidgetStore.default.instance.off(_AsyncStore.UPDATE_EVENT, this.onWidgets);
  }
  /**
   * The calls to which the user is currently connected.
   */
  get activeCalls() {
    return this._activeCalls;
  }
  set activeCalls(value) {
    this._activeCalls = value;
    this.emit(CallStoreEvent.ActiveCalls, value);

    // The room IDs are persisted to settings so we can detect unclean disconnects
    _SettingsStore.default.setValue("activeCallRoomIds", null, _SettingLevel.SettingLevel.DEVICE, [...value].map(call => call.roomId));
  }
  updateRoom(room) {
    if (!this.calls.has(room.roomId)) {
      const call = _Call.Call.get(room);
      if (call) {
        const onConnectionState = state => {
          if (state === _Call.ConnectionState.Connected) {
            this.activeCalls = new Set([...this.activeCalls, call]);
          } else if (state === _Call.ConnectionState.Disconnected) {
            this.activeCalls = new Set([...this.activeCalls].filter(c => c !== call));
          }
        };
        const onDestroy = () => {
          this.calls.delete(room.roomId);
          for (const [event, listener] of this.callListeners.get(call)) call.off(event, listener);
          this.updateRoom(room);
        };
        call.on(_Call.CallEvent.ConnectionState, onConnectionState);
        call.on(_Call.CallEvent.Destroy, onDestroy);
        this.calls.set(room.roomId, call);
        this.callListeners.set(call, new Map([[_Call.CallEvent.ConnectionState, onConnectionState], [_Call.CallEvent.Destroy, onDestroy]]));
      }
      this.emit(CallStoreEvent.Call, call, room.roomId);
    }
  }

  /**
   * Gets the call associated with the given room, if any.
   * @param {string} roomId The room's ID.
   * @returns {Call | null} The call.
   */
  getCall(roomId) {
    return this.calls.get(roomId) ?? null;
  }

  /**
   * Gets the active call associated with the given room, if any.
   * @param roomId The room's ID.
   * @returns The active call.
   */
  getActiveCall(roomId) {
    const call = this.getCall(roomId);
    return call !== null && this.activeCalls.has(call) ? call : null;
  }
}
exports.CallStore = CallStore;
(0, _defineProperty2.default)(CallStore, "_instance", void 0);
//# sourceMappingURL=CallStore.js.map