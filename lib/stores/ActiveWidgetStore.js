"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.ActiveWidgetStoreEvent = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _events = _interopRequireDefault(require("events"));
var _matrix = require("matrix-js-sdk/src/matrix");
var _MatrixClientPeg = require("../MatrixClientPeg");
var _WidgetUtils = _interopRequireDefault(require("../utils/WidgetUtils"));
var _WidgetMessagingStore = require("./widgets/WidgetMessagingStore");
/*
Copyright 2018 New Vector Ltd

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
let ActiveWidgetStoreEvent = /*#__PURE__*/function (ActiveWidgetStoreEvent) {
  ActiveWidgetStoreEvent["Persistence"] = "persistence";
  ActiveWidgetStoreEvent["Dock"] = "dock";
  ActiveWidgetStoreEvent["Undock"] = "undock";
  return ActiveWidgetStoreEvent;
}({});
/**
 * Stores information about the widgets active in the app right now:
 *  * What widget is set to remain always-on-screen, if any
 *    Only one widget may be 'always on screen' at any one time.
 *  * Reference counts to keep track of whether a widget is kept docked or alive
 *    by any components
 */
exports.ActiveWidgetStoreEvent = ActiveWidgetStoreEvent;
class ActiveWidgetStore extends _events.default {
  constructor() {
    super(...arguments);
    (0, _defineProperty2.default)(this, "persistentWidgetId", null);
    (0, _defineProperty2.default)(this, "persistentRoomId", null);
    (0, _defineProperty2.default)(this, "dockedWidgetsByUid", new Map());
    (0, _defineProperty2.default)(this, "onRoomStateEvents", (ev, _ref) => {
      let {
        roomId
      } = _ref;
      // XXX: This listens for state events in order to remove the active widget.
      // Everything else relies on views listening for events and calling setters
      // on this class which is terrible. This store should just listen for events
      // and keep itself up to date.
      // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
      if (ev.getType() === "im.vector.modular.widgets") {
        this.destroyPersistentWidget(ev.getStateKey(), roomId);
      }
    });
  }
  static get instance() {
    if (!ActiveWidgetStore.internalInstance) {
      ActiveWidgetStore.internalInstance = new ActiveWidgetStore();
    }
    return ActiveWidgetStore.internalInstance;
  }
  start() {
    _MatrixClientPeg.MatrixClientPeg.get().on(_matrix.RoomStateEvent.Events, this.onRoomStateEvents);
  }
  stop() {
    _MatrixClientPeg.MatrixClientPeg.get()?.removeListener(_matrix.RoomStateEvent.Events, this.onRoomStateEvents);
  }
  destroyPersistentWidget(widgetId, roomId) {
    if (!this.getWidgetPersistence(widgetId, roomId)) return;
    _WidgetMessagingStore.WidgetMessagingStore.instance.stopMessagingByUid(_WidgetUtils.default.calcWidgetUid(widgetId, roomId ?? undefined));
    this.setWidgetPersistence(widgetId, roomId, false);
  }
  setWidgetPersistence(widgetId, roomId, val) {
    const isPersisted = this.getWidgetPersistence(widgetId, roomId);
    if (isPersisted && !val) {
      this.persistentWidgetId = null;
      this.persistentRoomId = null;
    } else if (!isPersisted && val) {
      this.persistentWidgetId = widgetId;
      this.persistentRoomId = roomId;
    }
    this.emit(ActiveWidgetStoreEvent.Persistence);
  }
  getWidgetPersistence(widgetId, roomId) {
    return this.persistentWidgetId === widgetId && this.persistentRoomId === roomId;
  }
  getPersistentWidgetId() {
    return this.persistentWidgetId;
  }
  getPersistentRoomId() {
    return this.persistentRoomId;
  }

  // Registers the given widget as being docked somewhere in the UI (not a PiP),
  // to allow its lifecycle to be tracked.
  dockWidget(widgetId, roomId) {
    const uid = _WidgetUtils.default.calcWidgetUid(widgetId, roomId ?? undefined);
    const refs = this.dockedWidgetsByUid.get(uid) ?? 0;
    this.dockedWidgetsByUid.set(uid, refs + 1);
    if (refs === 0) this.emit(ActiveWidgetStoreEvent.Dock);
  }
  undockWidget(widgetId, roomId) {
    const uid = _WidgetUtils.default.calcWidgetUid(widgetId, roomId ?? undefined);
    const refs = this.dockedWidgetsByUid.get(uid);
    if (refs) this.dockedWidgetsByUid.set(uid, refs - 1);
    if (refs === 1) this.emit(ActiveWidgetStoreEvent.Undock);
  }

  // Determines whether the given widget is docked anywhere in the UI (not a PiP)
  isDocked(widgetId, roomId) {
    const uid = _WidgetUtils.default.calcWidgetUid(widgetId, roomId ?? undefined);
    const refs = this.dockedWidgetsByUid.get(uid) ?? 0;
    return refs > 0;
  }

  // Determines whether the given widget is being kept alive in the UI, including PiPs
  isLive(widgetId, roomId) {
    return this.isDocked(widgetId, roomId) || this.getWidgetPersistence(widgetId, roomId);
  }
}
exports.default = ActiveWidgetStore;
(0, _defineProperty2.default)(ActiveWidgetStore, "internalInstance", void 0);
window.mxActiveWidgetStore = ActiveWidgetStore.instance;
//# sourceMappingURL=ActiveWidgetStore.js.map