"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WidgetMessagingStoreEvent = exports.WidgetMessagingStore = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _AsyncStoreWithClient = require("../AsyncStoreWithClient");
var _dispatcher = _interopRequireDefault(require("../../dispatcher/dispatcher"));
var _maps = require("../../utils/maps");
var _WidgetUtils = _interopRequireDefault(require("../../utils/WidgetUtils"));
/*
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
let WidgetMessagingStoreEvent = /*#__PURE__*/function (WidgetMessagingStoreEvent) {
  WidgetMessagingStoreEvent["StoreMessaging"] = "store_messaging";
  WidgetMessagingStoreEvent["StopMessaging"] = "stop_messaging";
  return WidgetMessagingStoreEvent;
}({});
/**
 * Temporary holding store for widget messaging instances. This is eventually
 * going to be merged with a more complete WidgetStore, but for now it's
 * easiest to split this into a single place.
 */
exports.WidgetMessagingStoreEvent = WidgetMessagingStoreEvent;
class WidgetMessagingStore extends _AsyncStoreWithClient.AsyncStoreWithClient {
  // <widget UID, ClientWidgetAPi>

  constructor() {
    super(_dispatcher.default);
    (0, _defineProperty2.default)(this, "widgetMap", new _maps.EnhancedMap());
  }
  static get instance() {
    return WidgetMessagingStore.internalInstance;
  }
  async onAction(payload) {
    // nothing to do
  }
  async onReady() {
    // just in case
    this.widgetMap.clear();
  }
  storeMessaging(widget, roomId, widgetApi) {
    this.stopMessaging(widget, roomId);
    const uid = _WidgetUtils.default.calcWidgetUid(widget.id, roomId);
    this.widgetMap.set(uid, widgetApi);
    this.emit(WidgetMessagingStoreEvent.StoreMessaging, uid, widgetApi);
  }
  stopMessaging(widget, roomId) {
    this.stopMessagingByUid(_WidgetUtils.default.calcWidgetUid(widget.id, roomId));
  }
  getMessaging(widget, roomId) {
    return this.widgetMap.get(_WidgetUtils.default.calcWidgetUid(widget.id, roomId));
  }

  /**
   * Stops the widget messaging instance for a given widget UID.
   * @param {string} widgetUid The widget UID.
   */
  stopMessagingByUid(widgetUid) {
    this.widgetMap.remove(widgetUid)?.stop();
    this.emit(WidgetMessagingStoreEvent.StopMessaging, widgetUid);
  }

  /**
   * Gets the widget messaging class for a given widget UID.
   * @param {string} widgetUid The widget UID.
   * @returns {ClientWidgetApi} The widget API, or a falsy value if not found.
   */
  getMessagingForUid(widgetUid) {
    return this.widgetMap.get(widgetUid);
  }
}
exports.WidgetMessagingStore = WidgetMessagingStore;
(0, _defineProperty2.default)(WidgetMessagingStore, "internalInstance", (() => {
  const instance = new WidgetMessagingStore();
  instance.start();
  return instance;
})());
//# sourceMappingURL=WidgetMessagingStore.js.map