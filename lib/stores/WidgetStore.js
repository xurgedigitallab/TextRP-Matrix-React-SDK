"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
exports.isAppWidget = isAppWidget;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _logger = require("matrix-js-sdk/src/logger");
var _client = require("matrix-js-sdk/src/client");
var _roomState = require("matrix-js-sdk/src/models/room-state");
var _AsyncStoreWithClient = require("./AsyncStoreWithClient");
var _dispatcher = _interopRequireDefault(require("../dispatcher/dispatcher"));
var _WidgetEchoStore = _interopRequireDefault(require("../stores/WidgetEchoStore"));
var _ActiveWidgetStore = _interopRequireDefault(require("../stores/ActiveWidgetStore"));
var _WidgetUtils = _interopRequireDefault(require("../utils/WidgetUtils"));
var _AsyncStore = require("./AsyncStore");
/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

function isAppWidget(widget) {
  return "roomId" in widget && typeof widget.roomId === "string";
}
// TODO consolidate WidgetEchoStore into this
// TODO consolidate ActiveWidgetStore into this
class WidgetStore extends _AsyncStoreWithClient.AsyncStoreWithClient {
  // Key is room ID

  constructor() {
    super(_dispatcher.default, {});
    (0, _defineProperty2.default)(this, "widgetMap", new Map());
    // Key is widget Unique ID (UID)
    (0, _defineProperty2.default)(this, "roomMap", new Map());
    (0, _defineProperty2.default)(this, "onWidgetEchoStoreUpdate", roomId => {
      this.initRoom(roomId);
      this.loadRoomWidgets(this.matrixClient?.getRoom(roomId) ?? null);
      this.emit(_AsyncStore.UPDATE_EVENT, roomId);
    });
    (0, _defineProperty2.default)(this, "onRoom", room => {
      this.initRoom(room.roomId);
      this.loadRoomWidgets(room);
      this.emit(_AsyncStore.UPDATE_EVENT, room.roomId);
    });
    (0, _defineProperty2.default)(this, "onRoomStateEvents", ev => {
      if (ev.getType() !== "im.vector.modular.widgets") return; // TODO: Support m.widget too
      const roomId = ev.getRoomId();
      this.initRoom(roomId);
      this.loadRoomWidgets(this.matrixClient?.getRoom(roomId) ?? null);
      this.emit(_AsyncStore.UPDATE_EVENT, roomId);
    });
    _WidgetEchoStore.default.on("update", this.onWidgetEchoStoreUpdate);
  }
  static get instance() {
    return WidgetStore.internalInstance;
  }
  initRoom(roomId) {
    if (!this.roomMap.has(roomId)) {
      this.roomMap.set(roomId, {
        widgets: []
      });
    }
  }
  async onReady() {
    if (!this.matrixClient) return;
    this.matrixClient.on(_client.ClientEvent.Room, this.onRoom);
    this.matrixClient.on(_roomState.RoomStateEvent.Events, this.onRoomStateEvents);
    this.matrixClient.getRooms().forEach(room => {
      this.loadRoomWidgets(room);
    });
    this.emit(_AsyncStore.UPDATE_EVENT, null); // emit for all rooms
  }

  async onNotReady() {
    if (this.matrixClient) {
      this.matrixClient.off(_client.ClientEvent.Room, this.onRoom);
      this.matrixClient.off(_roomState.RoomStateEvent.Events, this.onRoomStateEvents);
    }
    this.widgetMap = new Map();
    this.roomMap = new Map();
    await this.reset({});
  }

  // We don't need this, but our contract says we do.
  async onAction(payload) {
    return;
  }
  generateApps(room) {
    return _WidgetEchoStore.default.getEchoedRoomWidgets(room.roomId, _WidgetUtils.default.getRoomWidgets(room)).map(ev => {
      return _WidgetUtils.default.makeAppConfig(ev.getStateKey(), ev.getContent(), ev.getSender(), ev.getRoomId(), ev.getId());
    });
  }
  loadRoomWidgets(room) {
    if (!room) return;
    const roomInfo = this.roomMap.get(room.roomId) || {};
    roomInfo.widgets = [];

    // first clean out old widgets from the map which originate from this room
    // otherwise we are out of sync with the rest of the app with stale widget events during removal
    Array.from(this.widgetMap.values()).forEach(app => {
      if (app.roomId !== room.roomId) return; // skip - wrong room
      if (app.eventId === undefined) {
        // virtual widget - keep it
        roomInfo.widgets.push(app);
      } else {
        this.widgetMap.delete(_WidgetUtils.default.getWidgetUid(app));
      }
    });
    let edited = false;
    this.generateApps(room).forEach(app => {
      // Sanity check for https://github.com/vector-im/element-web/issues/15705
      const existingApp = this.widgetMap.get(_WidgetUtils.default.getWidgetUid(app));
      if (existingApp) {
        _logger.logger.warn(`Possible widget ID conflict for ${app.id} - wants to store in room ${app.roomId} ` + `but is currently stored as ${existingApp.roomId} - letting the want win`);
      }
      this.widgetMap.set(_WidgetUtils.default.getWidgetUid(app), app);
      roomInfo.widgets.push(app);
      edited = true;
    });
    if (edited && !this.roomMap.has(room.roomId)) {
      this.roomMap.set(room.roomId, roomInfo);
    }

    // If a persistent widget is active, check to see if it's just been removed.
    // If it has, it needs to destroyed otherwise unmounting the node won't kill it
    const persistentWidgetId = _ActiveWidgetStore.default.instance.getPersistentWidgetId();
    if (persistentWidgetId && _ActiveWidgetStore.default.instance.getPersistentRoomId() === room.roomId && !roomInfo.widgets.some(w => w.id === persistentWidgetId)) {
      _logger.logger.log(`Persistent widget ${persistentWidgetId} removed from room ${room.roomId}: destroying.`);
      _ActiveWidgetStore.default.instance.destroyPersistentWidget(persistentWidgetId, room.roomId);
    }
    this.emit(room.roomId);
  }
  get(widgetId, roomId) {
    return this.widgetMap.get(_WidgetUtils.default.calcWidgetUid(widgetId, roomId));
  }
  getRoom(roomId) {
    let initIfNeeded = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    if (initIfNeeded) this.initRoom(roomId); // internally handles "if needed"
    return this.roomMap.get(roomId);
  }
  getApps(roomId) {
    const roomInfo = this.getRoom(roomId);
    return roomInfo?.widgets || [];
  }
  addVirtualWidget(widget, roomId) {
    this.initRoom(roomId);
    const app = _WidgetUtils.default.makeAppConfig(widget.id, widget, widget.creatorUserId, roomId, undefined);
    this.widgetMap.set(_WidgetUtils.default.getWidgetUid(app), app);
    this.roomMap.get(roomId).widgets.push(app);
    return app;
  }
  removeVirtualWidget(widgetId, roomId) {
    this.widgetMap.delete(_WidgetUtils.default.calcWidgetUid(widgetId, roomId));
    const roomApps = this.roomMap.get(roomId);
    if (roomApps) {
      roomApps.widgets = roomApps.widgets.filter(app => !(app.id === widgetId && app.roomId === roomId));
    }
  }
}
exports.default = WidgetStore;
(0, _defineProperty2.default)(WidgetStore, "internalInstance", (() => {
  const instance = new WidgetStore();
  instance.start();
  return instance;
})());
window.mxWidgetStore = WidgetStore.instance;
//# sourceMappingURL=WidgetStore.js.map