"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WidgetLayoutStore = exports.WIDGET_LAYOUT_EVENT_TYPE = exports.MAX_PINNED = exports.Container = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _roomState = require("matrix-js-sdk/src/models/room-state");
var _utils = require("matrix-js-sdk/src/utils");
var _SettingsStore = _interopRequireDefault(require("../../settings/SettingsStore"));
var _WidgetStore = _interopRequireDefault(require("../WidgetStore"));
var _WidgetType = require("../../widgets/WidgetType");
var _numbers = require("../../utils/numbers");
var _dispatcher = _interopRequireDefault(require("../../dispatcher/dispatcher"));
var _ReadyWatchingStore = require("../ReadyWatchingStore");
var _SettingLevel = require("../../settings/SettingLevel");
var _arrays = require("../../utils/arrays");
var _AsyncStore = require("../AsyncStore");
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          * Copyright 2021 - 2022 The Matrix.org Foundation C.I.C.
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
const WIDGET_LAYOUT_EVENT_TYPE = "io.element.widgets.layout";
exports.WIDGET_LAYOUT_EVENT_TYPE = WIDGET_LAYOUT_EVENT_TYPE;
let Container = /*#__PURE__*/function (Container) {
  Container["Top"] = "top";
  Container["Right"] = "right";
  Container["Center"] = "center";
  return Container;
}({});
exports.Container = Container;
// Dev note: "Pinned" widgets are ones in the top container.
const MAX_PINNED = 3;

// These two are whole percentages and don't really mean anything. Later values will decide
// minimum, but these help determine proportions during our calculations here. In fact, these
// values should be *smaller* than the actual minimums imposed by later components.
exports.MAX_PINNED = MAX_PINNED;
const MIN_WIDGET_WIDTH_PCT = 10; // 10%
const MIN_WIDGET_HEIGHT_PCT = 2; // 2%

class WidgetLayoutStore extends _ReadyWatchingStore.ReadyWatchingStore {
  constructor() {
    super(_dispatcher.default);
    // Map: room Id → container → ContainerValue
    (0, _defineProperty2.default)(this, "byRoom", new _utils.MapWithDefault(() => new Map()));
    (0, _defineProperty2.default)(this, "pinnedRef", void 0);
    (0, _defineProperty2.default)(this, "layoutRef", void 0);
    (0, _defineProperty2.default)(this, "dynamicRef", void 0);
    (0, _defineProperty2.default)(this, "updateAllRooms", () => {
      const msc3946ProcessDynamicPredecessor = _SettingsStore.default.getValue("feature_dynamic_room_predecessors");
      if (!this.matrixClient) return;
      this.byRoom = new _utils.MapWithDefault(() => new Map());
      for (const room of this.matrixClient.getVisibleRooms(msc3946ProcessDynamicPredecessor)) {
        this.recalculateRoom(room);
      }
    });
    (0, _defineProperty2.default)(this, "updateFromWidgetStore", roomId => {
      if (roomId) {
        const room = this.matrixClient?.getRoom(roomId);
        if (room) this.recalculateRoom(room);
      } else {
        this.updateAllRooms();
      }
    });
    (0, _defineProperty2.default)(this, "updateRoomFromState", ev => {
      if (ev.getType() !== WIDGET_LAYOUT_EVENT_TYPE) return;
      const room = this.matrixClient?.getRoom(ev.getRoomId());
      if (room) this.recalculateRoom(room);
    });
    (0, _defineProperty2.default)(this, "updateFromSettings", (_settingName, roomId, _atLevel, _newValAtLevel, _newVal) => {
      if (roomId) {
        const room = this.matrixClient?.getRoom(roomId);
        if (room) this.recalculateRoom(room);
      } else {
        this.updateAllRooms();
      }
    });
  }
  static get instance() {
    if (!this.internalInstance) {
      this.internalInstance = new WidgetLayoutStore();
      this.internalInstance.start();
    }
    return this.internalInstance;
  }
  static emissionForRoom(room) {
    return `update_${room.roomId}`;
  }
  emitFor(room) {
    this.emit(WidgetLayoutStore.emissionForRoom(room));
  }
  async onReady() {
    this.updateAllRooms();
    this.matrixClient?.on(_roomState.RoomStateEvent.Events, this.updateRoomFromState);
    this.pinnedRef = _SettingsStore.default.watchSetting("Widgets.pinned", null, this.updateFromSettings);
    this.layoutRef = _SettingsStore.default.watchSetting("Widgets.layout", null, this.updateFromSettings);
    this.dynamicRef = _SettingsStore.default.watchSetting("feature_dynamic_room_predecessors", null, this.updateFromSettings);
    _WidgetStore.default.instance.on(_AsyncStore.UPDATE_EVENT, this.updateFromWidgetStore);
  }
  async onNotReady() {
    this.byRoom = new _utils.MapWithDefault(() => new Map());
    this.matrixClient?.off(_roomState.RoomStateEvent.Events, this.updateRoomFromState);
    if (this.pinnedRef) _SettingsStore.default.unwatchSetting(this.pinnedRef);
    if (this.layoutRef) _SettingsStore.default.unwatchSetting(this.layoutRef);
    if (this.dynamicRef) _SettingsStore.default.unwatchSetting(this.dynamicRef);
    _WidgetStore.default.instance.off(_AsyncStore.UPDATE_EVENT, this.updateFromWidgetStore);
  }
  recalculateRoom(room) {
    const widgets = _WidgetStore.default.instance.getApps(room.roomId);
    if (!widgets?.length) {
      this.byRoom.set(room.roomId, new Map());
      this.emitFor(room);
      return;
    }
    const roomContainers = this.byRoom.getOrCreate(room.roomId);
    const beforeChanges = JSON.stringify((0, _utils.recursiveMapToObject)(roomContainers));
    const layoutEv = room.currentState.getStateEvents(WIDGET_LAYOUT_EVENT_TYPE, "");
    const legacyPinned = _SettingsStore.default.getValue("Widgets.pinned", room.roomId);
    let userLayout = _SettingsStore.default.getValue("Widgets.layout", room.roomId);
    if (layoutEv && userLayout && userLayout.overrides !== layoutEv.getId()) {
      // For some other layout that we don't really care about. The user can reset this
      // by updating their personal layout.
      userLayout = null;
    }
    const roomLayout = layoutEv?.getContent() ?? null;
    // We filter for the center container first.
    // (An error is raised, if there are multiple widgets marked for the center container)
    // For the right and top container multiple widgets are allowed.
    const topWidgets = [];
    const rightWidgets = [];
    const centerWidgets = [];
    for (const widget of widgets) {
      const stateContainer = roomLayout?.widgets?.[widget.id]?.container;
      const manualContainer = userLayout?.widgets?.[widget.id]?.container;
      const isLegacyPinned = !!legacyPinned?.[widget.id];
      const defaultContainer = _WidgetType.WidgetType.JITSI.matches(widget.type) ? Container.Top : Container.Right;
      if (manualContainer ? manualContainer === Container.Center : stateContainer === Container.Center) {
        if (centerWidgets.length) {
          console.error("Tried to push a second widget into the center container");
        } else {
          centerWidgets.push(widget);
        }
        // The widget won't need to be put in any other container.
        continue;
      }
      let targetContainer = defaultContainer;
      if (!!manualContainer || !!stateContainer) {
        targetContainer = manualContainer ?? stateContainer;
      } else if (isLegacyPinned && !stateContainer) {
        // Special legacy case
        targetContainer = Container.Top;
      }
      (targetContainer === Container.Top ? topWidgets : rightWidgets).push(widget);
    }

    // Trim to MAX_PINNED
    const runoff = topWidgets.slice(MAX_PINNED);
    rightWidgets.push(...runoff);

    // Order the widgets in the top container, putting autopinned Jitsi widgets first
    // unless they have a specific order in mind
    topWidgets.sort((a, b) => {
      const layoutA = roomLayout?.widgets?.[a.id];
      const layoutB = roomLayout?.widgets?.[b.id];
      const userLayoutA = userLayout?.widgets?.[a.id];
      const userLayoutB = userLayout?.widgets?.[b.id];

      // Jitsi widgets are defaulted to be the leftmost widget whereas other widgets
      // default to the right side.
      const defaultA = _WidgetType.WidgetType.JITSI.matches(a.type) ? Number.MIN_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
      const defaultB = _WidgetType.WidgetType.JITSI.matches(b.type) ? Number.MIN_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
      const orderA = (0, _numbers.defaultNumber)(userLayoutA?.index, (0, _numbers.defaultNumber)(layoutA?.index, defaultA));
      const orderB = (0, _numbers.defaultNumber)(userLayoutB?.index, (0, _numbers.defaultNumber)(layoutB?.index, defaultB));
      if (orderA === orderB) {
        // We just need a tiebreak
        return (0, _utils.compare)(a.id, b.id);
      }
      return orderA - orderB;
    });

    // Determine width distribution and height of the top container now (the only relevant one)
    const widths = [];
    let maxHeight = null; // null == default
    let doAutobalance = true;
    for (let i = 0; i < topWidgets.length; i++) {
      const widget = topWidgets[i];
      const widgetLayout = roomLayout?.widgets?.[widget.id];
      const userWidgetLayout = userLayout?.widgets?.[widget.id];
      if (Number.isFinite(userWidgetLayout?.width) || Number.isFinite(widgetLayout?.width)) {
        const val = userWidgetLayout?.width || widgetLayout?.width;
        const normalized = (0, _numbers.clamp)(val, MIN_WIDGET_WIDTH_PCT, 100);
        widths.push(normalized);
        doAutobalance = false; // a manual width was specified
      } else {
        widths.push(100); // we'll figure this out later
      }

      if (widgetLayout?.height || userWidgetLayout?.height) {
        const defRoomHeight = (0, _numbers.defaultNumber)(widgetLayout?.height, MIN_WIDGET_HEIGHT_PCT);
        const h = (0, _numbers.defaultNumber)(userWidgetLayout?.height, defRoomHeight);
        maxHeight = Math.max(maxHeight ?? 0, (0, _numbers.clamp)(h, MIN_WIDGET_HEIGHT_PCT, 100));
      }
    }
    if (doAutobalance) {
      for (let i = 0; i < widths.length; i++) {
        widths[i] = 100 / widths.length;
      }
    } else {
      // If we're not autobalancing then it means that we're trying to make
      // sure that widgets make up exactly 100% of space (not over, not under)
      const difference = (0, _numbers.sum)(...widths) - 100; // positive = over, negative = under
      if (difference < 0) {
        // For a deficit we just fill everything in equally
        for (let i = 0; i < widths.length; i++) {
          widths[i] += Math.abs(difference) / widths.length;
        }
      } else if (difference > 0) {
        // When we're over, we try to scale all the widgets within range first.
        // We clamp values to try and keep ourselves sane and within range.
        for (let i = 0; i < widths.length; i++) {
          widths[i] = (0, _numbers.clamp)(widths[i] - difference / widths.length, MIN_WIDGET_WIDTH_PCT, 100);
        }

        // If we're still over, find the widgets which have more width than the minimum
        // and balance them out until we're at 100%. This should keep us as close as possible
        // to the intended distributions.
        //
        // Note: if we ever decide to set a minimum which is larger than 100%/MAX_WIDGETS then
        // we probably have other issues - this code assumes we don't do that.
        const toReclaim = (0, _numbers.sum)(...widths) - 100;
        if (toReclaim > 0) {
          const largeIndices = widths.map((v, i) => [i, v]).filter(p => p[1] > MIN_WIDGET_WIDTH_PCT).map(p => p[0]);
          for (const idx of largeIndices) {
            widths[idx] -= toReclaim / largeIndices.length;
          }
        }
      }
    }

    // Finally, fill in our cache and update
    const newRoomContainers = new Map();
    this.byRoom.set(room.roomId, newRoomContainers);
    if (topWidgets.length) {
      newRoomContainers.set(Container.Top, {
        ordered: topWidgets,
        distributions: widths,
        height: maxHeight
      });
    }
    if (rightWidgets.length) {
      newRoomContainers.set(Container.Right, {
        ordered: rightWidgets
      });
    }
    if (centerWidgets.length) {
      newRoomContainers.set(Container.Center, {
        ordered: centerWidgets
      });
    }
    const afterChanges = JSON.stringify((0, _utils.recursiveMapToObject)(newRoomContainers));
    if (afterChanges !== beforeChanges) {
      this.emitFor(room);
    }
  }
  getContainerWidgets(room, container) {
    return room && this.byRoom.get(room.roomId)?.get(container)?.ordered || [];
  }
  isInContainer(room, widget, container) {
    return this.getContainerWidgets(room, container).some(w => w.id === widget.id);
  }
  canAddToContainer(room, container) {
    switch (container) {
      case Container.Top:
        return this.getContainerWidgets(room, container).length < MAX_PINNED;
      case Container.Right:
        return this.getContainerWidgets(room, container).length < MAX_PINNED;
      case Container.Center:
        return this.getContainerWidgets(room, container).length < 1;
    }
  }
  getResizerDistributions(room, container) {
    // yes, string.
    let distributions = this.byRoom.get(room.roomId)?.get(container)?.distributions;
    if (!distributions || distributions.length < 2) return [];

    // The distributor actually expects to be fed N-1 sizes and expands the middle section
    // instead of the edges. Therefore, we need to return [0] when there's two widgets or
    // [0, 2] when there's three (skipping [1] because it's irrelevant).

    if (distributions.length === 2) distributions = [distributions[0]];
    if (distributions.length === 3) distributions = [distributions[0], distributions[2]];
    return distributions.map(d => `${d.toFixed(1)}%`); // actual percents - these are decoded later
  }

  setResizerDistributions(room, container, distributions) {
    if (container !== Container.Top) return; // ignore - not relevant

    const numbers = distributions.map(d => Number(Number(d.substring(0, d.length - 1)).toFixed(1)));
    const widgets = this.getContainerWidgets(room, container);

    // From getResizerDistributions, we need to fill in the middle size if applicable.
    const remaining = 100 - (0, _numbers.sum)(...numbers);
    if (numbers.length === 2) numbers.splice(1, 0, remaining);
    if (numbers.length === 1) numbers.push(remaining);
    const localLayout = {};
    widgets.forEach((w, i) => {
      localLayout[w.id] = {
        container: container,
        width: numbers[i],
        index: i,
        height: this.byRoom.get(room.roomId)?.get(container)?.height || MIN_WIDGET_HEIGHT_PCT
      };
    });
    this.updateUserLayout(room, localLayout);
  }
  getContainerHeight(room, container) {
    return this.byRoom.get(room.roomId)?.get(container)?.height ?? null; // let the default get returned if needed
  }

  setContainerHeight(room, container, height) {
    const widgets = this.getContainerWidgets(room, container);
    const widths = this.byRoom.get(room.roomId)?.get(container)?.distributions;
    const localLayout = {};
    widgets.forEach((w, i) => {
      localLayout[w.id] = {
        container: container,
        width: widths?.[i],
        index: i,
        height: height
      };
    });
    this.updateUserLayout(room, localLayout);
  }
  moveWithinContainer(room, container, widget, delta) {
    const widgets = (0, _arrays.arrayFastClone)(this.getContainerWidgets(room, container));
    const currentIdx = widgets.findIndex(w => w.id === widget.id);
    if (currentIdx < 0) return; // no change needed

    widgets.splice(currentIdx, 1); // remove existing widget
    const newIdx = (0, _numbers.clamp)(currentIdx + delta, 0, widgets.length);
    widgets.splice(newIdx, 0, widget);
    const widths = this.byRoom.get(room.roomId)?.get(container)?.distributions;
    const height = this.byRoom.get(room.roomId)?.get(container)?.height;
    const localLayout = {};
    widgets.forEach((w, i) => {
      localLayout[w.id] = {
        container: container,
        width: widths?.[i],
        index: i,
        height
      };
    });
    this.updateUserLayout(room, localLayout);
  }
  moveToContainer(room, widget, toContainer) {
    const allWidgets = this.getAllWidgets(room);
    if (!allWidgets.some(_ref => {
      let [w] = _ref;
      return w.id === widget.id;
    })) return; // invalid
    // Prepare other containers (potentially move widgets to obey the following rules)
    const newLayout = {};
    switch (toContainer) {
      case Container.Right:
        // new "right" widget
        break;
      case Container.Center:
        // new "center" widget => all other widgets go into "right"
        for (const w of this.getContainerWidgets(room, Container.Top)) {
          newLayout[w.id] = {
            container: Container.Right
          };
        }
        for (const w of this.getContainerWidgets(room, Container.Center)) {
          newLayout[w.id] = {
            container: Container.Right
          };
        }
        break;
      case Container.Top:
        // new "top" widget => the center widget moves into "right"
        if (this.hasMaximisedWidget(room)) {
          const centerWidget = this.getContainerWidgets(room, Container.Center)[0];
          newLayout[centerWidget.id] = {
            container: Container.Right
          };
        }
        break;
    }
    newLayout[widget.id] = {
      container: toContainer
    };

    // move widgets into requested containers.
    this.updateUserLayout(room, newLayout);
  }
  hasMaximisedWidget(room) {
    return this.getContainerWidgets(room, Container.Center).length > 0;
  }
  hasPinnedWidgets(room) {
    return this.getContainerWidgets(room, Container.Top).length > 0;
  }
  canCopyLayoutToRoom(room) {
    if (!this.matrixClient) return false; // not ready yet
    return room.currentState.maySendStateEvent(WIDGET_LAYOUT_EVENT_TYPE, this.matrixClient.getUserId());
  }
  copyLayoutToRoom(room) {
    const allWidgets = this.getAllWidgets(room);
    const evContent = {
      widgets: {}
    };
    for (const [widget, container] of allWidgets) {
      evContent.widgets[widget.id] = {
        container
      };
      if (container === Container.Top) {
        const containerWidgets = this.getContainerWidgets(room, container);
        const idx = containerWidgets.findIndex(w => w.id === widget.id);
        const widths = this.byRoom.get(room.roomId)?.get(container)?.distributions;
        const height = this.byRoom.get(room.roomId)?.get(container)?.height;
        evContent.widgets[widget.id] = _objectSpread(_objectSpread({}, evContent.widgets[widget.id]), {}, {
          height: height ? Math.round(height) : undefined,
          width: widths?.[idx] ? Math.round(widths[idx]) : undefined,
          index: idx
        });
      }
    }
    this.matrixClient?.sendStateEvent(room.roomId, WIDGET_LAYOUT_EVENT_TYPE, evContent, "");
  }
  getAllWidgets(room) {
    const containers = this.byRoom.get(room.roomId);
    if (!containers) return [];
    const ret = [];
    for (const [container, containerValue] of containers) {
      const widgets = containerValue.ordered;
      for (const widget of widgets) {
        ret.push([widget, container]);
      }
    }
    return ret;
  }
  updateUserLayout(room, newLayout) {
    // Polyfill any missing widgets
    const allWidgets = this.getAllWidgets(room);
    for (const [widget, container] of allWidgets) {
      const containerWidgets = this.getContainerWidgets(room, container);
      const idx = containerWidgets.findIndex(w => w.id === widget.id);
      const widths = this.byRoom.get(room.roomId)?.get(container)?.distributions;
      if (!newLayout[widget.id]) {
        newLayout[widget.id] = {
          container: container,
          index: idx,
          height: this.byRoom.get(room.roomId)?.get(container)?.height,
          width: widths?.[idx]
        };
      }
    }
    const layoutEv = room.currentState.getStateEvents(WIDGET_LAYOUT_EVENT_TYPE, "");
    _SettingsStore.default.setValue("Widgets.layout", room.roomId, _SettingLevel.SettingLevel.ROOM_ACCOUNT, {
      overrides: layoutEv?.getId(),
      widgets: newLayout
    }).catch(() => this.recalculateRoom(room));
    this.recalculateRoom(room); // call to try local echo on changes (the catch above undoes any errors)
  }
}
exports.WidgetLayoutStore = WidgetLayoutStore;
(0, _defineProperty2.default)(WidgetLayoutStore, "internalInstance", void 0);
window.mxWidgetLayoutStore = WidgetLayoutStore.instance;
//# sourceMappingURL=WidgetLayoutStore.js.map