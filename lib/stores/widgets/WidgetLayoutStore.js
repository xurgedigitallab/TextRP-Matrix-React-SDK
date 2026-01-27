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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfcm9vbVN0YXRlIiwicmVxdWlyZSIsIl91dGlscyIsIl9TZXR0aW5nc1N0b3JlIiwiX2ludGVyb3BSZXF1aXJlRGVmYXVsdCIsIl9XaWRnZXRTdG9yZSIsIl9XaWRnZXRUeXBlIiwiX251bWJlcnMiLCJfZGlzcGF0Y2hlciIsIl9SZWFkeVdhdGNoaW5nU3RvcmUiLCJfU2V0dGluZ0xldmVsIiwiX2FycmF5cyIsIl9Bc3luY1N0b3JlIiwib3duS2V5cyIsIm9iamVjdCIsImVudW1lcmFibGVPbmx5Iiwia2V5cyIsIk9iamVjdCIsImdldE93blByb3BlcnR5U3ltYm9scyIsInN5bWJvbHMiLCJmaWx0ZXIiLCJzeW0iLCJnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IiLCJlbnVtZXJhYmxlIiwicHVzaCIsImFwcGx5IiwiX29iamVjdFNwcmVhZCIsInRhcmdldCIsImkiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJzb3VyY2UiLCJmb3JFYWNoIiwia2V5IiwiX2RlZmluZVByb3BlcnR5MiIsImRlZmF1bHQiLCJnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzIiwiZGVmaW5lUHJvcGVydGllcyIsImRlZmluZVByb3BlcnR5IiwiV0lER0VUX0xBWU9VVF9FVkVOVF9UWVBFIiwiZXhwb3J0cyIsIkNvbnRhaW5lciIsIk1BWF9QSU5ORUQiLCJNSU5fV0lER0VUX1dJRFRIX1BDVCIsIk1JTl9XSURHRVRfSEVJR0hUX1BDVCIsIldpZGdldExheW91dFN0b3JlIiwiUmVhZHlXYXRjaGluZ1N0b3JlIiwiY29uc3RydWN0b3IiLCJkZWZhdWx0RGlzcGF0Y2hlciIsIk1hcFdpdGhEZWZhdWx0IiwiTWFwIiwibXNjMzk0NlByb2Nlc3NEeW5hbWljUHJlZGVjZXNzb3IiLCJTZXR0aW5nc1N0b3JlIiwiZ2V0VmFsdWUiLCJtYXRyaXhDbGllbnQiLCJieVJvb20iLCJyb29tIiwiZ2V0VmlzaWJsZVJvb21zIiwicmVjYWxjdWxhdGVSb29tIiwicm9vbUlkIiwiZ2V0Um9vbSIsInVwZGF0ZUFsbFJvb21zIiwiZXYiLCJnZXRUeXBlIiwiZ2V0Um9vbUlkIiwiX3NldHRpbmdOYW1lIiwiX2F0TGV2ZWwiLCJfbmV3VmFsQXRMZXZlbCIsIl9uZXdWYWwiLCJpbnN0YW5jZSIsImludGVybmFsSW5zdGFuY2UiLCJzdGFydCIsImVtaXNzaW9uRm9yUm9vbSIsImVtaXRGb3IiLCJlbWl0Iiwib25SZWFkeSIsIm9uIiwiUm9vbVN0YXRlRXZlbnQiLCJFdmVudHMiLCJ1cGRhdGVSb29tRnJvbVN0YXRlIiwicGlubmVkUmVmIiwid2F0Y2hTZXR0aW5nIiwidXBkYXRlRnJvbVNldHRpbmdzIiwibGF5b3V0UmVmIiwiZHluYW1pY1JlZiIsIldpZGdldFN0b3JlIiwiVVBEQVRFX0VWRU5UIiwidXBkYXRlRnJvbVdpZGdldFN0b3JlIiwib25Ob3RSZWFkeSIsIm9mZiIsInVud2F0Y2hTZXR0aW5nIiwid2lkZ2V0cyIsImdldEFwcHMiLCJzZXQiLCJyb29tQ29udGFpbmVycyIsImdldE9yQ3JlYXRlIiwiYmVmb3JlQ2hhbmdlcyIsIkpTT04iLCJzdHJpbmdpZnkiLCJyZWN1cnNpdmVNYXBUb09iamVjdCIsImxheW91dEV2IiwiY3VycmVudFN0YXRlIiwiZ2V0U3RhdGVFdmVudHMiLCJsZWdhY3lQaW5uZWQiLCJ1c2VyTGF5b3V0Iiwib3ZlcnJpZGVzIiwiZ2V0SWQiLCJyb29tTGF5b3V0IiwiZ2V0Q29udGVudCIsInRvcFdpZGdldHMiLCJyaWdodFdpZGdldHMiLCJjZW50ZXJXaWRnZXRzIiwid2lkZ2V0Iiwic3RhdGVDb250YWluZXIiLCJpZCIsImNvbnRhaW5lciIsIm1hbnVhbENvbnRhaW5lciIsImlzTGVnYWN5UGlubmVkIiwiZGVmYXVsdENvbnRhaW5lciIsIldpZGdldFR5cGUiLCJKSVRTSSIsIm1hdGNoZXMiLCJ0eXBlIiwiVG9wIiwiUmlnaHQiLCJDZW50ZXIiLCJjb25zb2xlIiwiZXJyb3IiLCJ0YXJnZXRDb250YWluZXIiLCJydW5vZmYiLCJzbGljZSIsInNvcnQiLCJhIiwiYiIsImxheW91dEEiLCJsYXlvdXRCIiwidXNlckxheW91dEEiLCJ1c2VyTGF5b3V0QiIsImRlZmF1bHRBIiwiTnVtYmVyIiwiTUlOX1NBRkVfSU5URUdFUiIsIk1BWF9TQUZFX0lOVEVHRVIiLCJkZWZhdWx0QiIsIm9yZGVyQSIsImRlZmF1bHROdW1iZXIiLCJpbmRleCIsIm9yZGVyQiIsImNvbXBhcmUiLCJ3aWR0aHMiLCJtYXhIZWlnaHQiLCJkb0F1dG9iYWxhbmNlIiwid2lkZ2V0TGF5b3V0IiwidXNlcldpZGdldExheW91dCIsImlzRmluaXRlIiwid2lkdGgiLCJ2YWwiLCJub3JtYWxpemVkIiwiY2xhbXAiLCJoZWlnaHQiLCJkZWZSb29tSGVpZ2h0IiwiaCIsIk1hdGgiLCJtYXgiLCJkaWZmZXJlbmNlIiwic3VtIiwiYWJzIiwidG9SZWNsYWltIiwibGFyZ2VJbmRpY2VzIiwibWFwIiwidiIsInAiLCJpZHgiLCJuZXdSb29tQ29udGFpbmVycyIsIm9yZGVyZWQiLCJkaXN0cmlidXRpb25zIiwiYWZ0ZXJDaGFuZ2VzIiwiZ2V0Q29udGFpbmVyV2lkZ2V0cyIsImdldCIsImlzSW5Db250YWluZXIiLCJzb21lIiwidyIsImNhbkFkZFRvQ29udGFpbmVyIiwiZ2V0UmVzaXplckRpc3RyaWJ1dGlvbnMiLCJkIiwidG9GaXhlZCIsInNldFJlc2l6ZXJEaXN0cmlidXRpb25zIiwibnVtYmVycyIsInN1YnN0cmluZyIsInJlbWFpbmluZyIsInNwbGljZSIsImxvY2FsTGF5b3V0IiwidXBkYXRlVXNlckxheW91dCIsImdldENvbnRhaW5lckhlaWdodCIsInNldENvbnRhaW5lckhlaWdodCIsIm1vdmVXaXRoaW5Db250YWluZXIiLCJkZWx0YSIsImFycmF5RmFzdENsb25lIiwiY3VycmVudElkeCIsImZpbmRJbmRleCIsIm5ld0lkeCIsIm1vdmVUb0NvbnRhaW5lciIsInRvQ29udGFpbmVyIiwiYWxsV2lkZ2V0cyIsImdldEFsbFdpZGdldHMiLCJfcmVmIiwibmV3TGF5b3V0IiwiaGFzTWF4aW1pc2VkV2lkZ2V0IiwiY2VudGVyV2lkZ2V0IiwiaGFzUGlubmVkV2lkZ2V0cyIsImNhbkNvcHlMYXlvdXRUb1Jvb20iLCJtYXlTZW5kU3RhdGVFdmVudCIsImdldFVzZXJJZCIsImNvcHlMYXlvdXRUb1Jvb20iLCJldkNvbnRlbnQiLCJjb250YWluZXJXaWRnZXRzIiwicm91bmQiLCJ1bmRlZmluZWQiLCJzZW5kU3RhdGVFdmVudCIsImNvbnRhaW5lcnMiLCJyZXQiLCJjb250YWluZXJWYWx1ZSIsInNldFZhbHVlIiwiU2V0dGluZ0xldmVsIiwiUk9PTV9BQ0NPVU5UIiwiY2F0Y2giLCJ3aW5kb3ciLCJteFdpZGdldExheW91dFN0b3JlIl0sInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3N0b3Jlcy93aWRnZXRzL1dpZGdldExheW91dFN0b3JlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qXG4gKiBDb3B5cmlnaHQgMjAyMSAtIDIwMjIgVGhlIE1hdHJpeC5vcmcgRm91bmRhdGlvbiBDLkkuQy5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbmltcG9ydCB7IFJvb20gfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbW9kZWxzL3Jvb21cIjtcbmltcG9ydCB7IE1hdHJpeEV2ZW50IH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL21vZGVscy9ldmVudFwiO1xuaW1wb3J0IHsgUm9vbVN0YXRlRXZlbnQgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbW9kZWxzL3Jvb20tc3RhdGVcIjtcbmltcG9ydCB7IE9wdGlvbmFsIH0gZnJvbSBcIm1hdHJpeC1ldmVudHMtc2RrXCI7XG5pbXBvcnQgeyBjb21wYXJlLCBNYXBXaXRoRGVmYXVsdCwgcmVjdXJzaXZlTWFwVG9PYmplY3QgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvdXRpbHNcIjtcbmltcG9ydCB7IElXaWRnZXQgfSBmcm9tIFwibWF0cml4LXdpZGdldC1hcGlcIjtcblxuaW1wb3J0IFNldHRpbmdzU3RvcmUgZnJvbSBcIi4uLy4uL3NldHRpbmdzL1NldHRpbmdzU3RvcmVcIjtcbmltcG9ydCBXaWRnZXRTdG9yZSwgeyBJQXBwIH0gZnJvbSBcIi4uL1dpZGdldFN0b3JlXCI7XG5pbXBvcnQgeyBXaWRnZXRUeXBlIH0gZnJvbSBcIi4uLy4uL3dpZGdldHMvV2lkZ2V0VHlwZVwiO1xuaW1wb3J0IHsgY2xhbXAsIGRlZmF1bHROdW1iZXIsIHN1bSB9IGZyb20gXCIuLi8uLi91dGlscy9udW1iZXJzXCI7XG5pbXBvcnQgZGVmYXVsdERpc3BhdGNoZXIgZnJvbSBcIi4uLy4uL2Rpc3BhdGNoZXIvZGlzcGF0Y2hlclwiO1xuaW1wb3J0IHsgUmVhZHlXYXRjaGluZ1N0b3JlIH0gZnJvbSBcIi4uL1JlYWR5V2F0Y2hpbmdTdG9yZVwiO1xuaW1wb3J0IHsgU2V0dGluZ0xldmVsIH0gZnJvbSBcIi4uLy4uL3NldHRpbmdzL1NldHRpbmdMZXZlbFwiO1xuaW1wb3J0IHsgYXJyYXlGYXN0Q2xvbmUgfSBmcm9tIFwiLi4vLi4vdXRpbHMvYXJyYXlzXCI7XG5pbXBvcnQgeyBVUERBVEVfRVZFTlQgfSBmcm9tIFwiLi4vQXN5bmNTdG9yZVwiO1xuXG5leHBvcnQgY29uc3QgV0lER0VUX0xBWU9VVF9FVkVOVF9UWVBFID0gXCJpby5lbGVtZW50LndpZGdldHMubGF5b3V0XCI7XG5cbmV4cG9ydCBlbnVtIENvbnRhaW5lciB7XG4gICAgLy8gXCJUb3BcIiBpcyB0aGUgYXBwIGRyYXdlciwgYW5kIGN1cnJlbnRseSB0aGUgb25seSBzZW5zaWJsZSB2YWx1ZS5cbiAgICBUb3AgPSBcInRvcFwiLFxuXG4gICAgLy8gXCJSaWdodFwiIGlzIHRoZSByaWdodCBwYW5lbCwgYW5kIHRoZSBkZWZhdWx0IGZvciB3aWRnZXRzLiBTZXR0aW5nXG4gICAgLy8gdGhpcyBhcyBhIGNvbnRhaW5lciBvbiBhIHdpZGdldCBpcyBlc3NlbnRpYWxseSBsaWtlIHNheWluZyBcIm5vXG4gICAgLy8gY2hhbmdlcyBuZWVkZWRcIiwgdGhvdWdoIHRoaXMgbWF5IGNoYW5nZSBpbiB0aGUgZnV0dXJlLlxuICAgIFJpZ2h0ID0gXCJyaWdodFwiLFxuXG4gICAgQ2VudGVyID0gXCJjZW50ZXJcIixcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJU3RvcmVkTGF5b3V0IHtcbiAgICAvLyBXaGVyZSB0byBzdG9yZSB0aGUgd2lkZ2V0LiBSZXF1aXJlZC5cbiAgICBjb250YWluZXI6IENvbnRhaW5lcjtcblxuICAgIC8vIFRoZSBpbmRleCAob3JkZXIpIHRvIHBvc2l0aW9uIHRoZSB3aWRnZXRzIGluLiBPbmx5IGFwcGxpZXMgZm9yXG4gICAgLy8gb3JkZXJlZCBjb250YWluZXJzIChsaWtlIHRoZSB0b3AgY29udGFpbmVyKS4gU21hbGxlciBudW1iZXJzIGZpcnN0LFxuICAgIC8vIGFuZCBjb25mbGljdHMgcmVzb2x2ZWQgYnkgY29tcGFyaW5nIHdpZGdldCBJRHMuXG4gICAgaW5kZXg/OiBudW1iZXI7XG5cbiAgICAvLyBQZXJjZW50YWdlIChpbnRlZ2VyKSBmb3IgcmVsYXRpdmUgd2lkdGggb2YgdGhlIGNvbnRhaW5lciB0byBjb25zdW1lLlxuICAgIC8vIENsYW1wZWQgdG8gMC0xMDAgYW5kIG1heSBoYXZlIG1pbmltdW1zIGltcG9zZWQgdXBvbiBpdC4gT25seSBhcHBsaWVzXG4gICAgLy8gdG8gY29udGFpbmVycyB3aGljaCBzdXBwb3J0IGlubmVyIHJlc2l6aW5nIChjdXJyZW50bHkgb25seSB0aGUgdG9wXG4gICAgLy8gY29udGFpbmVyKS5cbiAgICB3aWR0aD86IG51bWJlcjtcblxuICAgIC8vIFBlcmNlbnRhZ2UgKGludGVnZXIpIGZvciByZWxhdGl2ZSBoZWlnaHQgb2YgdGhlIGNvbnRhaW5lci4gTm90ZSB0aGF0XG4gICAgLy8gdGhpcyBvbmx5IGFwcGxpZXMgdG8gdGhlIHRvcCBjb250YWluZXIgY3VycmVudGx5LCBhbmQgdGhhdCBjb250YWluZXJcbiAgICAvLyB3aWxsIHRha2UgdGhlIGhpZ2hlc3QgdmFsdWUgYW1vbmcgd2lkZ2V0cyBpbiB0aGUgY29udGFpbmVyLiBDbGFtcGVkXG4gICAgLy8gdG8gMC0xMDAgYW5kIG1heSBoYXZlIG1pbmltdW1zIGltcG9zZWQgb24gaXQuXG4gICAgaGVpZ2h0PzogbnVtYmVyIHwgbnVsbDtcblxuICAgIC8vIFRPRE86IFtEZWZlcnJlZF0gTWF4aW1pemluZyAoZnVsbHNjcmVlbikgd2lkZ2V0cyBieSBkZWZhdWx0LlxufVxuXG5pbnRlcmZhY2UgSVdpZGdldExheW91dHMge1xuICAgIFt3aWRnZXRJZDogc3RyaW5nXTogSVN0b3JlZExheW91dDtcbn1cblxuaW50ZXJmYWNlIElMYXlvdXRTdGF0ZUV2ZW50IHtcbiAgICAvLyBUT0RPOiBbRGVmZXJyZWRdIEZvcmNlZCBsYXlvdXQgKGZpeGVkIHdpdGggbm8gY2hhbmdlcylcblxuICAgIC8vIFRoZSB3aWRnZXQgbGF5b3V0cy5cbiAgICB3aWRnZXRzOiBJV2lkZ2V0TGF5b3V0cztcbn1cblxuaW50ZXJmYWNlIElMYXlvdXRTZXR0aW5ncyBleHRlbmRzIElMYXlvdXRTdGF0ZUV2ZW50IHtcbiAgICBvdmVycmlkZXM/OiBzdHJpbmc7IC8vIGV2ZW50IElEIGZvciBsYXlvdXQgc3RhdGUgZXZlbnQsIGlmIHByZXNlbnRcbn1cblxuLy8gRGV2IG5vdGU6IFwiUGlubmVkXCIgd2lkZ2V0cyBhcmUgb25lcyBpbiB0aGUgdG9wIGNvbnRhaW5lci5cbmV4cG9ydCBjb25zdCBNQVhfUElOTkVEID0gMztcblxuLy8gVGhlc2UgdHdvIGFyZSB3aG9sZSBwZXJjZW50YWdlcyBhbmQgZG9uJ3QgcmVhbGx5IG1lYW4gYW55dGhpbmcuIExhdGVyIHZhbHVlcyB3aWxsIGRlY2lkZVxuLy8gbWluaW11bSwgYnV0IHRoZXNlIGhlbHAgZGV0ZXJtaW5lIHByb3BvcnRpb25zIGR1cmluZyBvdXIgY2FsY3VsYXRpb25zIGhlcmUuIEluIGZhY3QsIHRoZXNlXG4vLyB2YWx1ZXMgc2hvdWxkIGJlICpzbWFsbGVyKiB0aGFuIHRoZSBhY3R1YWwgbWluaW11bXMgaW1wb3NlZCBieSBsYXRlciBjb21wb25lbnRzLlxuY29uc3QgTUlOX1dJREdFVF9XSURUSF9QQ1QgPSAxMDsgLy8gMTAlXG5jb25zdCBNSU5fV0lER0VUX0hFSUdIVF9QQ1QgPSAyOyAvLyAyJVxuXG5pbnRlcmZhY2UgQ29udGFpbmVyVmFsdWUge1xuICAgIG9yZGVyZWQ6IElBcHBbXTtcbiAgICBoZWlnaHQ/OiBudW1iZXI7XG4gICAgZGlzdHJpYnV0aW9ucz86IG51bWJlcltdO1xufVxuXG5leHBvcnQgY2xhc3MgV2lkZ2V0TGF5b3V0U3RvcmUgZXh0ZW5kcyBSZWFkeVdhdGNoaW5nU3RvcmUge1xuICAgIHByaXZhdGUgc3RhdGljIGludGVybmFsSW5zdGFuY2U6IFdpZGdldExheW91dFN0b3JlO1xuXG4gICAgLy8gTWFwOiByb29tIElkIOKGkiBjb250YWluZXIg4oaSIENvbnRhaW5lclZhbHVlXG4gICAgcHJpdmF0ZSBieVJvb206IE1hcFdpdGhEZWZhdWx0PHN0cmluZywgTWFwPENvbnRhaW5lciwgQ29udGFpbmVyVmFsdWU+PiA9IG5ldyBNYXBXaXRoRGVmYXVsdCgoKSA9PiBuZXcgTWFwKCkpO1xuICAgIHByaXZhdGUgcGlubmVkUmVmOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgcHJpdmF0ZSBsYXlvdXRSZWY6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICBwcml2YXRlIGR5bmFtaWNSZWY6IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuICAgIHByaXZhdGUgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKGRlZmF1bHREaXNwYXRjaGVyKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc3RhdGljIGdldCBpbnN0YW5jZSgpOiBXaWRnZXRMYXlvdXRTdG9yZSB7XG4gICAgICAgIGlmICghdGhpcy5pbnRlcm5hbEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLmludGVybmFsSW5zdGFuY2UgPSBuZXcgV2lkZ2V0TGF5b3V0U3RvcmUoKTtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJuYWxJbnN0YW5jZS5zdGFydCgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLmludGVybmFsSW5zdGFuY2U7XG4gICAgfVxuXG4gICAgcHVibGljIHN0YXRpYyBlbWlzc2lvbkZvclJvb20ocm9vbTogUm9vbSk6IHN0cmluZyB7XG4gICAgICAgIHJldHVybiBgdXBkYXRlXyR7cm9vbS5yb29tSWR9YDtcbiAgICB9XG5cbiAgICBwcml2YXRlIGVtaXRGb3Iocm9vbTogUm9vbSk6IHZvaWQge1xuICAgICAgICB0aGlzLmVtaXQoV2lkZ2V0TGF5b3V0U3RvcmUuZW1pc3Npb25Gb3JSb29tKHJvb20pKTtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgYXN5bmMgb25SZWFkeSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgdGhpcy51cGRhdGVBbGxSb29tcygpO1xuXG4gICAgICAgIHRoaXMubWF0cml4Q2xpZW50Py5vbihSb29tU3RhdGVFdmVudC5FdmVudHMsIHRoaXMudXBkYXRlUm9vbUZyb21TdGF0ZSk7XG4gICAgICAgIHRoaXMucGlubmVkUmVmID0gU2V0dGluZ3NTdG9yZS53YXRjaFNldHRpbmcoXCJXaWRnZXRzLnBpbm5lZFwiLCBudWxsLCB0aGlzLnVwZGF0ZUZyb21TZXR0aW5ncyk7XG4gICAgICAgIHRoaXMubGF5b3V0UmVmID0gU2V0dGluZ3NTdG9yZS53YXRjaFNldHRpbmcoXCJXaWRnZXRzLmxheW91dFwiLCBudWxsLCB0aGlzLnVwZGF0ZUZyb21TZXR0aW5ncyk7XG4gICAgICAgIHRoaXMuZHluYW1pY1JlZiA9IFNldHRpbmdzU3RvcmUud2F0Y2hTZXR0aW5nKFxuICAgICAgICAgICAgXCJmZWF0dXJlX2R5bmFtaWNfcm9vbV9wcmVkZWNlc3NvcnNcIixcbiAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUZyb21TZXR0aW5ncyxcbiAgICAgICAgKTtcbiAgICAgICAgV2lkZ2V0U3RvcmUuaW5zdGFuY2Uub24oVVBEQVRFX0VWRU5ULCB0aGlzLnVwZGF0ZUZyb21XaWRnZXRTdG9yZSk7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGFzeW5jIG9uTm90UmVhZHkoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIHRoaXMuYnlSb29tID0gbmV3IE1hcFdpdGhEZWZhdWx0KCgpID0+IG5ldyBNYXAoKSk7XG5cbiAgICAgICAgdGhpcy5tYXRyaXhDbGllbnQ/Lm9mZihSb29tU3RhdGVFdmVudC5FdmVudHMsIHRoaXMudXBkYXRlUm9vbUZyb21TdGF0ZSk7XG4gICAgICAgIGlmICh0aGlzLnBpbm5lZFJlZikgU2V0dGluZ3NTdG9yZS51bndhdGNoU2V0dGluZyh0aGlzLnBpbm5lZFJlZik7XG4gICAgICAgIGlmICh0aGlzLmxheW91dFJlZikgU2V0dGluZ3NTdG9yZS51bndhdGNoU2V0dGluZyh0aGlzLmxheW91dFJlZik7XG4gICAgICAgIGlmICh0aGlzLmR5bmFtaWNSZWYpIFNldHRpbmdzU3RvcmUudW53YXRjaFNldHRpbmcodGhpcy5keW5hbWljUmVmKTtcbiAgICAgICAgV2lkZ2V0U3RvcmUuaW5zdGFuY2Uub2ZmKFVQREFURV9FVkVOVCwgdGhpcy51cGRhdGVGcm9tV2lkZ2V0U3RvcmUpO1xuICAgIH1cblxuICAgIHByaXZhdGUgdXBkYXRlQWxsUm9vbXMgPSAoKTogdm9pZCA9PiB7XG4gICAgICAgIGNvbnN0IG1zYzM5NDZQcm9jZXNzRHluYW1pY1ByZWRlY2Vzc29yID0gU2V0dGluZ3NTdG9yZS5nZXRWYWx1ZShcImZlYXR1cmVfZHluYW1pY19yb29tX3ByZWRlY2Vzc29yc1wiKTtcbiAgICAgICAgaWYgKCF0aGlzLm1hdHJpeENsaWVudCkgcmV0dXJuO1xuICAgICAgICB0aGlzLmJ5Um9vbSA9IG5ldyBNYXBXaXRoRGVmYXVsdCgoKSA9PiBuZXcgTWFwKCkpO1xuICAgICAgICBmb3IgKGNvbnN0IHJvb20gb2YgdGhpcy5tYXRyaXhDbGllbnQuZ2V0VmlzaWJsZVJvb21zKG1zYzM5NDZQcm9jZXNzRHluYW1pY1ByZWRlY2Vzc29yKSkge1xuICAgICAgICAgICAgdGhpcy5yZWNhbGN1bGF0ZVJvb20ocm9vbSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgcHJpdmF0ZSB1cGRhdGVGcm9tV2lkZ2V0U3RvcmUgPSAocm9vbUlkPzogc3RyaW5nKTogdm9pZCA9PiB7XG4gICAgICAgIGlmIChyb29tSWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHJvb20gPSB0aGlzLm1hdHJpeENsaWVudD8uZ2V0Um9vbShyb29tSWQpO1xuICAgICAgICAgICAgaWYgKHJvb20pIHRoaXMucmVjYWxjdWxhdGVSb29tKHJvb20pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy51cGRhdGVBbGxSb29tcygpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHByaXZhdGUgdXBkYXRlUm9vbUZyb21TdGF0ZSA9IChldjogTWF0cml4RXZlbnQpOiB2b2lkID0+IHtcbiAgICAgICAgaWYgKGV2LmdldFR5cGUoKSAhPT0gV0lER0VUX0xBWU9VVF9FVkVOVF9UWVBFKSByZXR1cm47XG4gICAgICAgIGNvbnN0IHJvb20gPSB0aGlzLm1hdHJpeENsaWVudD8uZ2V0Um9vbShldi5nZXRSb29tSWQoKSk7XG4gICAgICAgIGlmIChyb29tKSB0aGlzLnJlY2FsY3VsYXRlUm9vbShyb29tKTtcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSB1cGRhdGVGcm9tU2V0dGluZ3MgPSAoXG4gICAgICAgIF9zZXR0aW5nTmFtZTogc3RyaW5nLFxuICAgICAgICByb29tSWQ6IHN0cmluZyB8IG51bGwsXG4gICAgICAgIF9hdExldmVsOiBTZXR0aW5nTGV2ZWwsXG4gICAgICAgIF9uZXdWYWxBdExldmVsOiBhbnksXG4gICAgICAgIF9uZXdWYWw6IGFueSxcbiAgICApOiB2b2lkID0+IHtcbiAgICAgICAgaWYgKHJvb21JZCkge1xuICAgICAgICAgICAgY29uc3Qgcm9vbSA9IHRoaXMubWF0cml4Q2xpZW50Py5nZXRSb29tKHJvb21JZCk7XG4gICAgICAgICAgICBpZiAocm9vbSkgdGhpcy5yZWNhbGN1bGF0ZVJvb20ocm9vbSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUFsbFJvb21zKCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgcHVibGljIHJlY2FsY3VsYXRlUm9vbShyb29tOiBSb29tKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IHdpZGdldHMgPSBXaWRnZXRTdG9yZS5pbnN0YW5jZS5nZXRBcHBzKHJvb20ucm9vbUlkKTtcbiAgICAgICAgaWYgKCF3aWRnZXRzPy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMuYnlSb29tLnNldChyb29tLnJvb21JZCwgbmV3IE1hcCgpKTtcbiAgICAgICAgICAgIHRoaXMuZW1pdEZvcihyb29tKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJvb21Db250YWluZXJzID0gdGhpcy5ieVJvb20uZ2V0T3JDcmVhdGUocm9vbS5yb29tSWQpO1xuICAgICAgICBjb25zdCBiZWZvcmVDaGFuZ2VzID0gSlNPTi5zdHJpbmdpZnkocmVjdXJzaXZlTWFwVG9PYmplY3Qocm9vbUNvbnRhaW5lcnMpKTtcblxuICAgICAgICBjb25zdCBsYXlvdXRFdiA9IHJvb20uY3VycmVudFN0YXRlLmdldFN0YXRlRXZlbnRzKFdJREdFVF9MQVlPVVRfRVZFTlRfVFlQRSwgXCJcIik7XG4gICAgICAgIGNvbnN0IGxlZ2FjeVBpbm5lZCA9IFNldHRpbmdzU3RvcmUuZ2V0VmFsdWUoXCJXaWRnZXRzLnBpbm5lZFwiLCByb29tLnJvb21JZCk7XG4gICAgICAgIGxldCB1c2VyTGF5b3V0ID0gU2V0dGluZ3NTdG9yZS5nZXRWYWx1ZTxJTGF5b3V0U2V0dGluZ3MgfCBudWxsPihcIldpZGdldHMubGF5b3V0XCIsIHJvb20ucm9vbUlkKTtcblxuICAgICAgICBpZiAobGF5b3V0RXYgJiYgdXNlckxheW91dCAmJiB1c2VyTGF5b3V0Lm92ZXJyaWRlcyAhPT0gbGF5b3V0RXYuZ2V0SWQoKSkge1xuICAgICAgICAgICAgLy8gRm9yIHNvbWUgb3RoZXIgbGF5b3V0IHRoYXQgd2UgZG9uJ3QgcmVhbGx5IGNhcmUgYWJvdXQuIFRoZSB1c2VyIGNhbiByZXNldCB0aGlzXG4gICAgICAgICAgICAvLyBieSB1cGRhdGluZyB0aGVpciBwZXJzb25hbCBsYXlvdXQuXG4gICAgICAgICAgICB1c2VyTGF5b3V0ID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJvb21MYXlvdXQgPSBsYXlvdXRFdj8uZ2V0Q29udGVudDxJTGF5b3V0U3RhdGVFdmVudD4oKSA/PyBudWxsO1xuICAgICAgICAvLyBXZSBmaWx0ZXIgZm9yIHRoZSBjZW50ZXIgY29udGFpbmVyIGZpcnN0LlxuICAgICAgICAvLyAoQW4gZXJyb3IgaXMgcmFpc2VkLCBpZiB0aGVyZSBhcmUgbXVsdGlwbGUgd2lkZ2V0cyBtYXJrZWQgZm9yIHRoZSBjZW50ZXIgY29udGFpbmVyKVxuICAgICAgICAvLyBGb3IgdGhlIHJpZ2h0IGFuZCB0b3AgY29udGFpbmVyIG11bHRpcGxlIHdpZGdldHMgYXJlIGFsbG93ZWQuXG4gICAgICAgIGNvbnN0IHRvcFdpZGdldHM6IElBcHBbXSA9IFtdO1xuICAgICAgICBjb25zdCByaWdodFdpZGdldHM6IElBcHBbXSA9IFtdO1xuICAgICAgICBjb25zdCBjZW50ZXJXaWRnZXRzOiBJQXBwW10gPSBbXTtcbiAgICAgICAgZm9yIChjb25zdCB3aWRnZXQgb2Ygd2lkZ2V0cykge1xuICAgICAgICAgICAgY29uc3Qgc3RhdGVDb250YWluZXIgPSByb29tTGF5b3V0Py53aWRnZXRzPy5bd2lkZ2V0LmlkXT8uY29udGFpbmVyO1xuICAgICAgICAgICAgY29uc3QgbWFudWFsQ29udGFpbmVyID0gdXNlckxheW91dD8ud2lkZ2V0cz8uW3dpZGdldC5pZF0/LmNvbnRhaW5lcjtcbiAgICAgICAgICAgIGNvbnN0IGlzTGVnYWN5UGlubmVkID0gISFsZWdhY3lQaW5uZWQ/Llt3aWRnZXQuaWRdO1xuICAgICAgICAgICAgY29uc3QgZGVmYXVsdENvbnRhaW5lciA9IFdpZGdldFR5cGUuSklUU0kubWF0Y2hlcyh3aWRnZXQudHlwZSkgPyBDb250YWluZXIuVG9wIDogQ29udGFpbmVyLlJpZ2h0O1xuICAgICAgICAgICAgaWYgKG1hbnVhbENvbnRhaW5lciA/IG1hbnVhbENvbnRhaW5lciA9PT0gQ29udGFpbmVyLkNlbnRlciA6IHN0YXRlQ29udGFpbmVyID09PSBDb250YWluZXIuQ2VudGVyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNlbnRlcldpZGdldHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJUcmllZCB0byBwdXNoIGEgc2Vjb25kIHdpZGdldCBpbnRvIHRoZSBjZW50ZXIgY29udGFpbmVyXCIpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNlbnRlcldpZGdldHMucHVzaCh3aWRnZXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBUaGUgd2lkZ2V0IHdvbid0IG5lZWQgdG8gYmUgcHV0IGluIGFueSBvdGhlciBjb250YWluZXIuXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgdGFyZ2V0Q29udGFpbmVyOiBDb250YWluZXIgPSBkZWZhdWx0Q29udGFpbmVyO1xuICAgICAgICAgICAgaWYgKCEhbWFudWFsQ29udGFpbmVyIHx8ICEhc3RhdGVDb250YWluZXIpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRDb250YWluZXIgPSBtYW51YWxDb250YWluZXIgPz8gc3RhdGVDb250YWluZXIhO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChpc0xlZ2FjeVBpbm5lZCAmJiAhc3RhdGVDb250YWluZXIpIHtcbiAgICAgICAgICAgICAgICAvLyBTcGVjaWFsIGxlZ2FjeSBjYXNlXG4gICAgICAgICAgICAgICAgdGFyZ2V0Q29udGFpbmVyID0gQ29udGFpbmVyLlRvcDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICh0YXJnZXRDb250YWluZXIgPT09IENvbnRhaW5lci5Ub3AgPyB0b3BXaWRnZXRzIDogcmlnaHRXaWRnZXRzKS5wdXNoKHdpZGdldCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUcmltIHRvIE1BWF9QSU5ORURcbiAgICAgICAgY29uc3QgcnVub2ZmID0gdG9wV2lkZ2V0cy5zbGljZShNQVhfUElOTkVEKTtcbiAgICAgICAgcmlnaHRXaWRnZXRzLnB1c2goLi4ucnVub2ZmKTtcblxuICAgICAgICAvLyBPcmRlciB0aGUgd2lkZ2V0cyBpbiB0aGUgdG9wIGNvbnRhaW5lciwgcHV0dGluZyBhdXRvcGlubmVkIEppdHNpIHdpZGdldHMgZmlyc3RcbiAgICAgICAgLy8gdW5sZXNzIHRoZXkgaGF2ZSBhIHNwZWNpZmljIG9yZGVyIGluIG1pbmRcbiAgICAgICAgdG9wV2lkZ2V0cy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBsYXlvdXRBID0gcm9vbUxheW91dD8ud2lkZ2V0cz8uW2EuaWRdO1xuICAgICAgICAgICAgY29uc3QgbGF5b3V0QiA9IHJvb21MYXlvdXQ/LndpZGdldHM/LltiLmlkXTtcblxuICAgICAgICAgICAgY29uc3QgdXNlckxheW91dEEgPSB1c2VyTGF5b3V0Py53aWRnZXRzPy5bYS5pZF07XG4gICAgICAgICAgICBjb25zdCB1c2VyTGF5b3V0QiA9IHVzZXJMYXlvdXQ/LndpZGdldHM/LltiLmlkXTtcblxuICAgICAgICAgICAgLy8gSml0c2kgd2lkZ2V0cyBhcmUgZGVmYXVsdGVkIHRvIGJlIHRoZSBsZWZ0bW9zdCB3aWRnZXQgd2hlcmVhcyBvdGhlciB3aWRnZXRzXG4gICAgICAgICAgICAvLyBkZWZhdWx0IHRvIHRoZSByaWdodCBzaWRlLlxuICAgICAgICAgICAgY29uc3QgZGVmYXVsdEEgPSBXaWRnZXRUeXBlLkpJVFNJLm1hdGNoZXMoYS50eXBlKSA/IE51bWJlci5NSU5fU0FGRV9JTlRFR0VSIDogTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVI7XG4gICAgICAgICAgICBjb25zdCBkZWZhdWx0QiA9IFdpZGdldFR5cGUuSklUU0kubWF0Y2hlcyhiLnR5cGUpID8gTnVtYmVyLk1JTl9TQUZFX0lOVEVHRVIgOiBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUjtcblxuICAgICAgICAgICAgY29uc3Qgb3JkZXJBID0gZGVmYXVsdE51bWJlcih1c2VyTGF5b3V0QT8uaW5kZXgsIGRlZmF1bHROdW1iZXIobGF5b3V0QT8uaW5kZXgsIGRlZmF1bHRBKSk7XG4gICAgICAgICAgICBjb25zdCBvcmRlckIgPSBkZWZhdWx0TnVtYmVyKHVzZXJMYXlvdXRCPy5pbmRleCwgZGVmYXVsdE51bWJlcihsYXlvdXRCPy5pbmRleCwgZGVmYXVsdEIpKTtcblxuICAgICAgICAgICAgaWYgKG9yZGVyQSA9PT0gb3JkZXJCKSB7XG4gICAgICAgICAgICAgICAgLy8gV2UganVzdCBuZWVkIGEgdGllYnJlYWtcbiAgICAgICAgICAgICAgICByZXR1cm4gY29tcGFyZShhLmlkLCBiLmlkKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIG9yZGVyQSAtIG9yZGVyQjtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gRGV0ZXJtaW5lIHdpZHRoIGRpc3RyaWJ1dGlvbiBhbmQgaGVpZ2h0IG9mIHRoZSB0b3AgY29udGFpbmVyIG5vdyAodGhlIG9ubHkgcmVsZXZhbnQgb25lKVxuICAgICAgICBjb25zdCB3aWR0aHM6IG51bWJlcltdID0gW107XG4gICAgICAgIGxldCBtYXhIZWlnaHQ6IG51bWJlciB8IG51bGwgPSBudWxsOyAvLyBudWxsID09IGRlZmF1bHRcbiAgICAgICAgbGV0IGRvQXV0b2JhbGFuY2UgPSB0cnVlO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRvcFdpZGdldHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHdpZGdldCA9IHRvcFdpZGdldHNbaV07XG4gICAgICAgICAgICBjb25zdCB3aWRnZXRMYXlvdXQgPSByb29tTGF5b3V0Py53aWRnZXRzPy5bd2lkZ2V0LmlkXTtcbiAgICAgICAgICAgIGNvbnN0IHVzZXJXaWRnZXRMYXlvdXQgPSB1c2VyTGF5b3V0Py53aWRnZXRzPy5bd2lkZ2V0LmlkXTtcblxuICAgICAgICAgICAgaWYgKE51bWJlci5pc0Zpbml0ZSh1c2VyV2lkZ2V0TGF5b3V0Py53aWR0aCkgfHwgTnVtYmVyLmlzRmluaXRlKHdpZGdldExheW91dD8ud2lkdGgpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdmFsID0gKHVzZXJXaWRnZXRMYXlvdXQ/LndpZHRoIHx8IHdpZGdldExheW91dD8ud2lkdGgpITtcbiAgICAgICAgICAgICAgICBjb25zdCBub3JtYWxpemVkID0gY2xhbXAodmFsLCBNSU5fV0lER0VUX1dJRFRIX1BDVCwgMTAwKTtcbiAgICAgICAgICAgICAgICB3aWR0aHMucHVzaChub3JtYWxpemVkKTtcbiAgICAgICAgICAgICAgICBkb0F1dG9iYWxhbmNlID0gZmFsc2U7IC8vIGEgbWFudWFsIHdpZHRoIHdhcyBzcGVjaWZpZWRcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgd2lkdGhzLnB1c2goMTAwKTsgLy8gd2UnbGwgZmlndXJlIHRoaXMgb3V0IGxhdGVyXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh3aWRnZXRMYXlvdXQ/LmhlaWdodCB8fCB1c2VyV2lkZ2V0TGF5b3V0Py5oZWlnaHQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBkZWZSb29tSGVpZ2h0ID0gZGVmYXVsdE51bWJlcih3aWRnZXRMYXlvdXQ/LmhlaWdodCwgTUlOX1dJREdFVF9IRUlHSFRfUENUKTtcbiAgICAgICAgICAgICAgICBjb25zdCBoID0gZGVmYXVsdE51bWJlcih1c2VyV2lkZ2V0TGF5b3V0Py5oZWlnaHQsIGRlZlJvb21IZWlnaHQpO1xuICAgICAgICAgICAgICAgIG1heEhlaWdodCA9IE1hdGgubWF4KG1heEhlaWdodCA/PyAwLCBjbGFtcChoLCBNSU5fV0lER0VUX0hFSUdIVF9QQ1QsIDEwMCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChkb0F1dG9iYWxhbmNlKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHdpZHRocy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHdpZHRoc1tpXSA9IDEwMCAvIHdpZHRocy5sZW5ndGg7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBJZiB3ZSdyZSBub3QgYXV0b2JhbGFuY2luZyB0aGVuIGl0IG1lYW5zIHRoYXQgd2UncmUgdHJ5aW5nIHRvIG1ha2VcbiAgICAgICAgICAgIC8vIHN1cmUgdGhhdCB3aWRnZXRzIG1ha2UgdXAgZXhhY3RseSAxMDAlIG9mIHNwYWNlIChub3Qgb3Zlciwgbm90IHVuZGVyKVxuICAgICAgICAgICAgY29uc3QgZGlmZmVyZW5jZSA9IHN1bSguLi53aWR0aHMpIC0gMTAwOyAvLyBwb3NpdGl2ZSA9IG92ZXIsIG5lZ2F0aXZlID0gdW5kZXJcbiAgICAgICAgICAgIGlmIChkaWZmZXJlbmNlIDwgMCkge1xuICAgICAgICAgICAgICAgIC8vIEZvciBhIGRlZmljaXQgd2UganVzdCBmaWxsIGV2ZXJ5dGhpbmcgaW4gZXF1YWxseVxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgd2lkdGhzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHdpZHRoc1tpXSArPSBNYXRoLmFicyhkaWZmZXJlbmNlKSAvIHdpZHRocy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChkaWZmZXJlbmNlID4gMCkge1xuICAgICAgICAgICAgICAgIC8vIFdoZW4gd2UncmUgb3Zlciwgd2UgdHJ5IHRvIHNjYWxlIGFsbCB0aGUgd2lkZ2V0cyB3aXRoaW4gcmFuZ2UgZmlyc3QuXG4gICAgICAgICAgICAgICAgLy8gV2UgY2xhbXAgdmFsdWVzIHRvIHRyeSBhbmQga2VlcCBvdXJzZWx2ZXMgc2FuZSBhbmQgd2l0aGluIHJhbmdlLlxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgd2lkdGhzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHdpZHRoc1tpXSA9IGNsYW1wKHdpZHRoc1tpXSAtIGRpZmZlcmVuY2UgLyB3aWR0aHMubGVuZ3RoLCBNSU5fV0lER0VUX1dJRFRIX1BDVCwgMTAwKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBJZiB3ZSdyZSBzdGlsbCBvdmVyLCBmaW5kIHRoZSB3aWRnZXRzIHdoaWNoIGhhdmUgbW9yZSB3aWR0aCB0aGFuIHRoZSBtaW5pbXVtXG4gICAgICAgICAgICAgICAgLy8gYW5kIGJhbGFuY2UgdGhlbSBvdXQgdW50aWwgd2UncmUgYXQgMTAwJS4gVGhpcyBzaG91bGQga2VlcCB1cyBhcyBjbG9zZSBhcyBwb3NzaWJsZVxuICAgICAgICAgICAgICAgIC8vIHRvIHRoZSBpbnRlbmRlZCBkaXN0cmlidXRpb25zLlxuICAgICAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAgICAgLy8gTm90ZTogaWYgd2UgZXZlciBkZWNpZGUgdG8gc2V0IGEgbWluaW11bSB3aGljaCBpcyBsYXJnZXIgdGhhbiAxMDAlL01BWF9XSURHRVRTIHRoZW5cbiAgICAgICAgICAgICAgICAvLyB3ZSBwcm9iYWJseSBoYXZlIG90aGVyIGlzc3VlcyAtIHRoaXMgY29kZSBhc3N1bWVzIHdlIGRvbid0IGRvIHRoYXQuXG4gICAgICAgICAgICAgICAgY29uc3QgdG9SZWNsYWltID0gc3VtKC4uLndpZHRocykgLSAxMDA7XG4gICAgICAgICAgICAgICAgaWYgKHRvUmVjbGFpbSA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGFyZ2VJbmRpY2VzID0gd2lkdGhzXG4gICAgICAgICAgICAgICAgICAgICAgICAubWFwKCh2LCBpKSA9PiBbaSwgdl0pXG4gICAgICAgICAgICAgICAgICAgICAgICAuZmlsdGVyKChwKSA9PiBwWzFdID4gTUlOX1dJREdFVF9XSURUSF9QQ1QpXG4gICAgICAgICAgICAgICAgICAgICAgICAubWFwKChwKSA9PiBwWzBdKTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBpZHggb2YgbGFyZ2VJbmRpY2VzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB3aWR0aHNbaWR4XSAtPSB0b1JlY2xhaW0gLyBsYXJnZUluZGljZXMubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gRmluYWxseSwgZmlsbCBpbiBvdXIgY2FjaGUgYW5kIHVwZGF0ZVxuICAgICAgICBjb25zdCBuZXdSb29tQ29udGFpbmVycyA9IG5ldyBNYXAoKTtcbiAgICAgICAgdGhpcy5ieVJvb20uc2V0KHJvb20ucm9vbUlkLCBuZXdSb29tQ29udGFpbmVycyk7XG4gICAgICAgIGlmICh0b3BXaWRnZXRzLmxlbmd0aCkge1xuICAgICAgICAgICAgbmV3Um9vbUNvbnRhaW5lcnMuc2V0KENvbnRhaW5lci5Ub3AsIHtcbiAgICAgICAgICAgICAgICBvcmRlcmVkOiB0b3BXaWRnZXRzLFxuICAgICAgICAgICAgICAgIGRpc3RyaWJ1dGlvbnM6IHdpZHRocyxcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IG1heEhlaWdodCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChyaWdodFdpZGdldHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBuZXdSb29tQ29udGFpbmVycy5zZXQoQ29udGFpbmVyLlJpZ2h0LCB7XG4gICAgICAgICAgICAgICAgb3JkZXJlZDogcmlnaHRXaWRnZXRzLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNlbnRlcldpZGdldHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBuZXdSb29tQ29udGFpbmVycy5zZXQoQ29udGFpbmVyLkNlbnRlciwge1xuICAgICAgICAgICAgICAgIG9yZGVyZWQ6IGNlbnRlcldpZGdldHMsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGFmdGVyQ2hhbmdlcyA9IEpTT04uc3RyaW5naWZ5KHJlY3Vyc2l2ZU1hcFRvT2JqZWN0KG5ld1Jvb21Db250YWluZXJzKSk7XG5cbiAgICAgICAgaWYgKGFmdGVyQ2hhbmdlcyAhPT0gYmVmb3JlQ2hhbmdlcykge1xuICAgICAgICAgICAgdGhpcy5lbWl0Rm9yKHJvb20pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGdldENvbnRhaW5lcldpZGdldHMocm9vbTogT3B0aW9uYWw8Um9vbT4sIGNvbnRhaW5lcjogQ29udGFpbmVyKTogSVdpZGdldFtdIHtcbiAgICAgICAgcmV0dXJuIChyb29tICYmIHRoaXMuYnlSb29tLmdldChyb29tLnJvb21JZCk/LmdldChjb250YWluZXIpPy5vcmRlcmVkKSB8fCBbXTtcbiAgICB9XG5cbiAgICBwdWJsaWMgaXNJbkNvbnRhaW5lcihyb29tOiBSb29tLCB3aWRnZXQ6IElXaWRnZXQsIGNvbnRhaW5lcjogQ29udGFpbmVyKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldENvbnRhaW5lcldpZGdldHMocm9vbSwgY29udGFpbmVyKS5zb21lKCh3KSA9PiB3LmlkID09PSB3aWRnZXQuaWQpO1xuICAgIH1cblxuICAgIHB1YmxpYyBjYW5BZGRUb0NvbnRhaW5lcihyb29tOiBSb29tLCBjb250YWluZXI6IENvbnRhaW5lcik6IGJvb2xlYW4ge1xuICAgICAgICBzd2l0Y2ggKGNvbnRhaW5lcikge1xuICAgICAgICAgICAgY2FzZSBDb250YWluZXIuVG9wOlxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmdldENvbnRhaW5lcldpZGdldHMocm9vbSwgY29udGFpbmVyKS5sZW5ndGggPCBNQVhfUElOTkVEO1xuICAgICAgICAgICAgY2FzZSBDb250YWluZXIuUmlnaHQ6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0Q29udGFpbmVyV2lkZ2V0cyhyb29tLCBjb250YWluZXIpLmxlbmd0aCA8IE1BWF9QSU5ORUQ7XG4gICAgICAgICAgICBjYXNlIENvbnRhaW5lci5DZW50ZXI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0Q29udGFpbmVyV2lkZ2V0cyhyb29tLCBjb250YWluZXIpLmxlbmd0aCA8IDE7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0UmVzaXplckRpc3RyaWJ1dGlvbnMocm9vbTogUm9vbSwgY29udGFpbmVyOiBDb250YWluZXIpOiBzdHJpbmdbXSB7XG4gICAgICAgIC8vIHllcywgc3RyaW5nLlxuICAgICAgICBsZXQgZGlzdHJpYnV0aW9ucyA9IHRoaXMuYnlSb29tLmdldChyb29tLnJvb21JZCk/LmdldChjb250YWluZXIpPy5kaXN0cmlidXRpb25zO1xuICAgICAgICBpZiAoIWRpc3RyaWJ1dGlvbnMgfHwgZGlzdHJpYnV0aW9ucy5sZW5ndGggPCAyKSByZXR1cm4gW107XG5cbiAgICAgICAgLy8gVGhlIGRpc3RyaWJ1dG9yIGFjdHVhbGx5IGV4cGVjdHMgdG8gYmUgZmVkIE4tMSBzaXplcyBhbmQgZXhwYW5kcyB0aGUgbWlkZGxlIHNlY3Rpb25cbiAgICAgICAgLy8gaW5zdGVhZCBvZiB0aGUgZWRnZXMuIFRoZXJlZm9yZSwgd2UgbmVlZCB0byByZXR1cm4gWzBdIHdoZW4gdGhlcmUncyB0d28gd2lkZ2V0cyBvclxuICAgICAgICAvLyBbMCwgMl0gd2hlbiB0aGVyZSdzIHRocmVlIChza2lwcGluZyBbMV0gYmVjYXVzZSBpdCdzIGlycmVsZXZhbnQpLlxuXG4gICAgICAgIGlmIChkaXN0cmlidXRpb25zLmxlbmd0aCA9PT0gMikgZGlzdHJpYnV0aW9ucyA9IFtkaXN0cmlidXRpb25zWzBdXTtcbiAgICAgICAgaWYgKGRpc3RyaWJ1dGlvbnMubGVuZ3RoID09PSAzKSBkaXN0cmlidXRpb25zID0gW2Rpc3RyaWJ1dGlvbnNbMF0sIGRpc3RyaWJ1dGlvbnNbMl1dO1xuICAgICAgICByZXR1cm4gZGlzdHJpYnV0aW9ucy5tYXAoKGQpID0+IGAke2QudG9GaXhlZCgxKX0lYCk7IC8vIGFjdHVhbCBwZXJjZW50cyAtIHRoZXNlIGFyZSBkZWNvZGVkIGxhdGVyXG4gICAgfVxuXG4gICAgcHVibGljIHNldFJlc2l6ZXJEaXN0cmlidXRpb25zKHJvb206IFJvb20sIGNvbnRhaW5lcjogQ29udGFpbmVyLCBkaXN0cmlidXRpb25zOiBzdHJpbmdbXSk6IHZvaWQge1xuICAgICAgICBpZiAoY29udGFpbmVyICE9PSBDb250YWluZXIuVG9wKSByZXR1cm47IC8vIGlnbm9yZSAtIG5vdCByZWxldmFudFxuXG4gICAgICAgIGNvbnN0IG51bWJlcnMgPSBkaXN0cmlidXRpb25zLm1hcCgoZCkgPT4gTnVtYmVyKE51bWJlcihkLnN1YnN0cmluZygwLCBkLmxlbmd0aCAtIDEpKS50b0ZpeGVkKDEpKSk7XG4gICAgICAgIGNvbnN0IHdpZGdldHMgPSB0aGlzLmdldENvbnRhaW5lcldpZGdldHMocm9vbSwgY29udGFpbmVyKTtcblxuICAgICAgICAvLyBGcm9tIGdldFJlc2l6ZXJEaXN0cmlidXRpb25zLCB3ZSBuZWVkIHRvIGZpbGwgaW4gdGhlIG1pZGRsZSBzaXplIGlmIGFwcGxpY2FibGUuXG4gICAgICAgIGNvbnN0IHJlbWFpbmluZyA9IDEwMCAtIHN1bSguLi5udW1iZXJzKTtcbiAgICAgICAgaWYgKG51bWJlcnMubGVuZ3RoID09PSAyKSBudW1iZXJzLnNwbGljZSgxLCAwLCByZW1haW5pbmcpO1xuICAgICAgICBpZiAobnVtYmVycy5sZW5ndGggPT09IDEpIG51bWJlcnMucHVzaChyZW1haW5pbmcpO1xuXG4gICAgICAgIGNvbnN0IGxvY2FsTGF5b3V0OiBSZWNvcmQ8c3RyaW5nLCBJU3RvcmVkTGF5b3V0PiA9IHt9O1xuICAgICAgICB3aWRnZXRzLmZvckVhY2goKHcsIGkpID0+IHtcbiAgICAgICAgICAgIGxvY2FsTGF5b3V0W3cuaWRdID0ge1xuICAgICAgICAgICAgICAgIGNvbnRhaW5lcjogY29udGFpbmVyLFxuICAgICAgICAgICAgICAgIHdpZHRoOiBudW1iZXJzW2ldLFxuICAgICAgICAgICAgICAgIGluZGV4OiBpLFxuICAgICAgICAgICAgICAgIGhlaWdodDogdGhpcy5ieVJvb20uZ2V0KHJvb20ucm9vbUlkKT8uZ2V0KGNvbnRhaW5lcik/LmhlaWdodCB8fCBNSU5fV0lER0VUX0hFSUdIVF9QQ1QsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy51cGRhdGVVc2VyTGF5b3V0KHJvb20sIGxvY2FsTGF5b3V0KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0Q29udGFpbmVySGVpZ2h0KHJvb206IFJvb20sIGNvbnRhaW5lcjogQ29udGFpbmVyKTogbnVtYmVyIHwgbnVsbCB7XG4gICAgICAgIHJldHVybiB0aGlzLmJ5Um9vbS5nZXQocm9vbS5yb29tSWQpPy5nZXQoY29udGFpbmVyKT8uaGVpZ2h0ID8/IG51bGw7IC8vIGxldCB0aGUgZGVmYXVsdCBnZXQgcmV0dXJuZWQgaWYgbmVlZGVkXG4gICAgfVxuXG4gICAgcHVibGljIHNldENvbnRhaW5lckhlaWdodChyb29tOiBSb29tLCBjb250YWluZXI6IENvbnRhaW5lciwgaGVpZ2h0PzogbnVtYmVyIHwgbnVsbCk6IHZvaWQge1xuICAgICAgICBjb25zdCB3aWRnZXRzID0gdGhpcy5nZXRDb250YWluZXJXaWRnZXRzKHJvb20sIGNvbnRhaW5lcik7XG4gICAgICAgIGNvbnN0IHdpZHRocyA9IHRoaXMuYnlSb29tLmdldChyb29tLnJvb21JZCk/LmdldChjb250YWluZXIpPy5kaXN0cmlidXRpb25zO1xuICAgICAgICBjb25zdCBsb2NhbExheW91dDogUmVjb3JkPHN0cmluZywgSVN0b3JlZExheW91dD4gPSB7fTtcbiAgICAgICAgd2lkZ2V0cy5mb3JFYWNoKCh3LCBpKSA9PiB7XG4gICAgICAgICAgICBsb2NhbExheW91dFt3LmlkXSA9IHtcbiAgICAgICAgICAgICAgICBjb250YWluZXI6IGNvbnRhaW5lcixcbiAgICAgICAgICAgICAgICB3aWR0aDogd2lkdGhzPy5baV0sXG4gICAgICAgICAgICAgICAgaW5kZXg6IGksXG4gICAgICAgICAgICAgICAgaGVpZ2h0OiBoZWlnaHQsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy51cGRhdGVVc2VyTGF5b3V0KHJvb20sIGxvY2FsTGF5b3V0KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgbW92ZVdpdGhpbkNvbnRhaW5lcihyb29tOiBSb29tLCBjb250YWluZXI6IENvbnRhaW5lciwgd2lkZ2V0OiBJV2lkZ2V0LCBkZWx0YTogbnVtYmVyKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IHdpZGdldHMgPSBhcnJheUZhc3RDbG9uZSh0aGlzLmdldENvbnRhaW5lcldpZGdldHMocm9vbSwgY29udGFpbmVyKSk7XG4gICAgICAgIGNvbnN0IGN1cnJlbnRJZHggPSB3aWRnZXRzLmZpbmRJbmRleCgodykgPT4gdy5pZCA9PT0gd2lkZ2V0LmlkKTtcbiAgICAgICAgaWYgKGN1cnJlbnRJZHggPCAwKSByZXR1cm47IC8vIG5vIGNoYW5nZSBuZWVkZWRcblxuICAgICAgICB3aWRnZXRzLnNwbGljZShjdXJyZW50SWR4LCAxKTsgLy8gcmVtb3ZlIGV4aXN0aW5nIHdpZGdldFxuICAgICAgICBjb25zdCBuZXdJZHggPSBjbGFtcChjdXJyZW50SWR4ICsgZGVsdGEsIDAsIHdpZGdldHMubGVuZ3RoKTtcbiAgICAgICAgd2lkZ2V0cy5zcGxpY2UobmV3SWR4LCAwLCB3aWRnZXQpO1xuXG4gICAgICAgIGNvbnN0IHdpZHRocyA9IHRoaXMuYnlSb29tLmdldChyb29tLnJvb21JZCk/LmdldChjb250YWluZXIpPy5kaXN0cmlidXRpb25zO1xuICAgICAgICBjb25zdCBoZWlnaHQgPSB0aGlzLmJ5Um9vbS5nZXQocm9vbS5yb29tSWQpPy5nZXQoY29udGFpbmVyKT8uaGVpZ2h0O1xuICAgICAgICBjb25zdCBsb2NhbExheW91dDogUmVjb3JkPHN0cmluZywgSVN0b3JlZExheW91dD4gPSB7fTtcbiAgICAgICAgd2lkZ2V0cy5mb3JFYWNoKCh3LCBpKSA9PiB7XG4gICAgICAgICAgICBsb2NhbExheW91dFt3LmlkXSA9IHtcbiAgICAgICAgICAgICAgICBjb250YWluZXI6IGNvbnRhaW5lcixcbiAgICAgICAgICAgICAgICB3aWR0aDogd2lkdGhzPy5baV0sXG4gICAgICAgICAgICAgICAgaW5kZXg6IGksXG4gICAgICAgICAgICAgICAgaGVpZ2h0LFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMudXBkYXRlVXNlckxheW91dChyb29tLCBsb2NhbExheW91dCk7XG4gICAgfVxuXG4gICAgcHVibGljIG1vdmVUb0NvbnRhaW5lcihyb29tOiBSb29tLCB3aWRnZXQ6IElXaWRnZXQsIHRvQ29udGFpbmVyOiBDb250YWluZXIpOiB2b2lkIHtcbiAgICAgICAgY29uc3QgYWxsV2lkZ2V0cyA9IHRoaXMuZ2V0QWxsV2lkZ2V0cyhyb29tKTtcbiAgICAgICAgaWYgKCFhbGxXaWRnZXRzLnNvbWUoKFt3XSkgPT4gdy5pZCA9PT0gd2lkZ2V0LmlkKSkgcmV0dXJuOyAvLyBpbnZhbGlkXG4gICAgICAgIC8vIFByZXBhcmUgb3RoZXIgY29udGFpbmVycyAocG90ZW50aWFsbHkgbW92ZSB3aWRnZXRzIHRvIG9iZXkgdGhlIGZvbGxvd2luZyBydWxlcylcbiAgICAgICAgY29uc3QgbmV3TGF5b3V0OiBSZWNvcmQ8c3RyaW5nLCBJU3RvcmVkTGF5b3V0PiA9IHt9O1xuICAgICAgICBzd2l0Y2ggKHRvQ29udGFpbmVyKSB7XG4gICAgICAgICAgICBjYXNlIENvbnRhaW5lci5SaWdodDpcbiAgICAgICAgICAgICAgICAvLyBuZXcgXCJyaWdodFwiIHdpZGdldFxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBDb250YWluZXIuQ2VudGVyOlxuICAgICAgICAgICAgICAgIC8vIG5ldyBcImNlbnRlclwiIHdpZGdldCA9PiBhbGwgb3RoZXIgd2lkZ2V0cyBnbyBpbnRvIFwicmlnaHRcIlxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgdyBvZiB0aGlzLmdldENvbnRhaW5lcldpZGdldHMocm9vbSwgQ29udGFpbmVyLlRvcCkpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3TGF5b3V0W3cuaWRdID0geyBjb250YWluZXI6IENvbnRhaW5lci5SaWdodCB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHcgb2YgdGhpcy5nZXRDb250YWluZXJXaWRnZXRzKHJvb20sIENvbnRhaW5lci5DZW50ZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld0xheW91dFt3LmlkXSA9IHsgY29udGFpbmVyOiBDb250YWluZXIuUmlnaHQgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIENvbnRhaW5lci5Ub3A6XG4gICAgICAgICAgICAgICAgLy8gbmV3IFwidG9wXCIgd2lkZ2V0ID0+IHRoZSBjZW50ZXIgd2lkZ2V0IG1vdmVzIGludG8gXCJyaWdodFwiXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuaGFzTWF4aW1pc2VkV2lkZ2V0KHJvb20pKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNlbnRlcldpZGdldCA9IHRoaXMuZ2V0Q29udGFpbmVyV2lkZ2V0cyhyb29tLCBDb250YWluZXIuQ2VudGVyKVswXTtcbiAgICAgICAgICAgICAgICAgICAgbmV3TGF5b3V0W2NlbnRlcldpZGdldC5pZF0gPSB7IGNvbnRhaW5lcjogQ29udGFpbmVyLlJpZ2h0IH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgbmV3TGF5b3V0W3dpZGdldC5pZF0gPSB7IGNvbnRhaW5lcjogdG9Db250YWluZXIgfTtcblxuICAgICAgICAvLyBtb3ZlIHdpZGdldHMgaW50byByZXF1ZXN0ZWQgY29udGFpbmVycy5cbiAgICAgICAgdGhpcy51cGRhdGVVc2VyTGF5b3V0KHJvb20sIG5ld0xheW91dCk7XG4gICAgfVxuXG4gICAgcHVibGljIGhhc01heGltaXNlZFdpZGdldChyb29tOiBSb29tKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldENvbnRhaW5lcldpZGdldHMocm9vbSwgQ29udGFpbmVyLkNlbnRlcikubGVuZ3RoID4gMDtcbiAgICB9XG5cbiAgICBwdWJsaWMgaGFzUGlubmVkV2lkZ2V0cyhyb29tOiBSb29tKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldENvbnRhaW5lcldpZGdldHMocm9vbSwgQ29udGFpbmVyLlRvcCkubGVuZ3RoID4gMDtcbiAgICB9XG5cbiAgICBwdWJsaWMgY2FuQ29weUxheW91dFRvUm9vbShyb29tOiBSb29tKTogYm9vbGVhbiB7XG4gICAgICAgIGlmICghdGhpcy5tYXRyaXhDbGllbnQpIHJldHVybiBmYWxzZTsgLy8gbm90IHJlYWR5IHlldFxuICAgICAgICByZXR1cm4gcm9vbS5jdXJyZW50U3RhdGUubWF5U2VuZFN0YXRlRXZlbnQoV0lER0VUX0xBWU9VVF9FVkVOVF9UWVBFLCB0aGlzLm1hdHJpeENsaWVudC5nZXRVc2VySWQoKSEpO1xuICAgIH1cblxuICAgIHB1YmxpYyBjb3B5TGF5b3V0VG9Sb29tKHJvb206IFJvb20pOiB2b2lkIHtcbiAgICAgICAgY29uc3QgYWxsV2lkZ2V0cyA9IHRoaXMuZ2V0QWxsV2lkZ2V0cyhyb29tKTtcbiAgICAgICAgY29uc3QgZXZDb250ZW50OiBJTGF5b3V0U3RhdGVFdmVudCA9IHsgd2lkZ2V0czoge30gfTtcbiAgICAgICAgZm9yIChjb25zdCBbd2lkZ2V0LCBjb250YWluZXJdIG9mIGFsbFdpZGdldHMpIHtcbiAgICAgICAgICAgIGV2Q29udGVudC53aWRnZXRzW3dpZGdldC5pZF0gPSB7IGNvbnRhaW5lciB9O1xuICAgICAgICAgICAgaWYgKGNvbnRhaW5lciA9PT0gQ29udGFpbmVyLlRvcCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRhaW5lcldpZGdldHMgPSB0aGlzLmdldENvbnRhaW5lcldpZGdldHMocm9vbSwgY29udGFpbmVyKTtcbiAgICAgICAgICAgICAgICBjb25zdCBpZHggPSBjb250YWluZXJXaWRnZXRzLmZpbmRJbmRleCgodykgPT4gdy5pZCA9PT0gd2lkZ2V0LmlkKTtcbiAgICAgICAgICAgICAgICBjb25zdCB3aWR0aHMgPSB0aGlzLmJ5Um9vbS5nZXQocm9vbS5yb29tSWQpPy5nZXQoY29udGFpbmVyKT8uZGlzdHJpYnV0aW9ucztcbiAgICAgICAgICAgICAgICBjb25zdCBoZWlnaHQgPSB0aGlzLmJ5Um9vbS5nZXQocm9vbS5yb29tSWQpPy5nZXQoY29udGFpbmVyKT8uaGVpZ2h0O1xuICAgICAgICAgICAgICAgIGV2Q29udGVudC53aWRnZXRzW3dpZGdldC5pZF0gPSB7XG4gICAgICAgICAgICAgICAgICAgIC4uLmV2Q29udGVudC53aWRnZXRzW3dpZGdldC5pZF0sXG4gICAgICAgICAgICAgICAgICAgIGhlaWdodDogaGVpZ2h0ID8gTWF0aC5yb3VuZChoZWlnaHQpIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgICAgICB3aWR0aDogd2lkdGhzPy5baWR4XSA/IE1hdGgucm91bmQod2lkdGhzW2lkeF0pIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgICAgICBpbmRleDogaWR4LFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5tYXRyaXhDbGllbnQ/LnNlbmRTdGF0ZUV2ZW50KHJvb20ucm9vbUlkLCBXSURHRVRfTEFZT1VUX0VWRU5UX1RZUEUsIGV2Q29udGVudCwgXCJcIik7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZXRBbGxXaWRnZXRzKHJvb206IFJvb20pOiBbSUFwcCwgQ29udGFpbmVyXVtdIHtcbiAgICAgICAgY29uc3QgY29udGFpbmVycyA9IHRoaXMuYnlSb29tLmdldChyb29tLnJvb21JZCk7XG4gICAgICAgIGlmICghY29udGFpbmVycykgcmV0dXJuIFtdO1xuXG4gICAgICAgIGNvbnN0IHJldDogW0lBcHAsIENvbnRhaW5lcl1bXSA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IFtjb250YWluZXIsIGNvbnRhaW5lclZhbHVlXSBvZiBjb250YWluZXJzKSB7XG4gICAgICAgICAgICBjb25zdCB3aWRnZXRzID0gY29udGFpbmVyVmFsdWUub3JkZXJlZDtcbiAgICAgICAgICAgIGZvciAoY29uc3Qgd2lkZ2V0IG9mIHdpZGdldHMpIHtcbiAgICAgICAgICAgICAgICByZXQucHVzaChbd2lkZ2V0LCBjb250YWluZXIgYXMgQ29udGFpbmVyXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJldDtcbiAgICB9XG5cbiAgICBwcml2YXRlIHVwZGF0ZVVzZXJMYXlvdXQocm9vbTogUm9vbSwgbmV3TGF5b3V0OiBJV2lkZ2V0TGF5b3V0cyk6IHZvaWQge1xuICAgICAgICAvLyBQb2x5ZmlsbCBhbnkgbWlzc2luZyB3aWRnZXRzXG4gICAgICAgIGNvbnN0IGFsbFdpZGdldHMgPSB0aGlzLmdldEFsbFdpZGdldHMocm9vbSk7XG4gICAgICAgIGZvciAoY29uc3QgW3dpZGdldCwgY29udGFpbmVyXSBvZiBhbGxXaWRnZXRzKSB7XG4gICAgICAgICAgICBjb25zdCBjb250YWluZXJXaWRnZXRzID0gdGhpcy5nZXRDb250YWluZXJXaWRnZXRzKHJvb20sIGNvbnRhaW5lcik7XG4gICAgICAgICAgICBjb25zdCBpZHggPSBjb250YWluZXJXaWRnZXRzLmZpbmRJbmRleCgodykgPT4gdy5pZCA9PT0gd2lkZ2V0LmlkKTtcbiAgICAgICAgICAgIGNvbnN0IHdpZHRocyA9IHRoaXMuYnlSb29tLmdldChyb29tLnJvb21JZCk/LmdldChjb250YWluZXIpPy5kaXN0cmlidXRpb25zO1xuICAgICAgICAgICAgaWYgKCFuZXdMYXlvdXRbd2lkZ2V0LmlkXSkge1xuICAgICAgICAgICAgICAgIG5ld0xheW91dFt3aWRnZXQuaWRdID0ge1xuICAgICAgICAgICAgICAgICAgICBjb250YWluZXI6IGNvbnRhaW5lcixcbiAgICAgICAgICAgICAgICAgICAgaW5kZXg6IGlkeCxcbiAgICAgICAgICAgICAgICAgICAgaGVpZ2h0OiB0aGlzLmJ5Um9vbS5nZXQocm9vbS5yb29tSWQpPy5nZXQoY29udGFpbmVyKT8uaGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgICB3aWR0aDogd2lkdGhzPy5baWR4XSxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbGF5b3V0RXYgPSByb29tLmN1cnJlbnRTdGF0ZS5nZXRTdGF0ZUV2ZW50cyhXSURHRVRfTEFZT1VUX0VWRU5UX1RZUEUsIFwiXCIpO1xuICAgICAgICBTZXR0aW5nc1N0b3JlLnNldFZhbHVlKFwiV2lkZ2V0cy5sYXlvdXRcIiwgcm9vbS5yb29tSWQsIFNldHRpbmdMZXZlbC5ST09NX0FDQ09VTlQsIHtcbiAgICAgICAgICAgIG92ZXJyaWRlczogbGF5b3V0RXY/LmdldElkKCksXG4gICAgICAgICAgICB3aWRnZXRzOiBuZXdMYXlvdXQsXG4gICAgICAgIH0pLmNhdGNoKCgpID0+IHRoaXMucmVjYWxjdWxhdGVSb29tKHJvb20pKTtcbiAgICAgICAgdGhpcy5yZWNhbGN1bGF0ZVJvb20ocm9vbSk7IC8vIGNhbGwgdG8gdHJ5IGxvY2FsIGVjaG8gb24gY2hhbmdlcyAodGhlIGNhdGNoIGFib3ZlIHVuZG9lcyBhbnkgZXJyb3JzKVxuICAgIH1cbn1cblxud2luZG93Lm14V2lkZ2V0TGF5b3V0U3RvcmUgPSBXaWRnZXRMYXlvdXRTdG9yZS5pbnN0YW5jZTtcbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFrQkEsSUFBQUEsVUFBQSxHQUFBQyxPQUFBO0FBRUEsSUFBQUMsTUFBQSxHQUFBRCxPQUFBO0FBR0EsSUFBQUUsY0FBQSxHQUFBQyxzQkFBQSxDQUFBSCxPQUFBO0FBQ0EsSUFBQUksWUFBQSxHQUFBRCxzQkFBQSxDQUFBSCxPQUFBO0FBQ0EsSUFBQUssV0FBQSxHQUFBTCxPQUFBO0FBQ0EsSUFBQU0sUUFBQSxHQUFBTixPQUFBO0FBQ0EsSUFBQU8sV0FBQSxHQUFBSixzQkFBQSxDQUFBSCxPQUFBO0FBQ0EsSUFBQVEsbUJBQUEsR0FBQVIsT0FBQTtBQUNBLElBQUFTLGFBQUEsR0FBQVQsT0FBQTtBQUNBLElBQUFVLE9BQUEsR0FBQVYsT0FBQTtBQUNBLElBQUFXLFdBQUEsR0FBQVgsT0FBQTtBQUE2QyxTQUFBWSxRQUFBQyxNQUFBLEVBQUFDLGNBQUEsUUFBQUMsSUFB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