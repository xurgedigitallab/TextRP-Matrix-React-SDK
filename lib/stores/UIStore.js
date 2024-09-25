"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.UI_EVENTS = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _events = _interopRequireDefault(require("events"));
/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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
let UI_EVENTS = /*#__PURE__*/function (UI_EVENTS) {
  UI_EVENTS["Resize"] = "resize";
  return UI_EVENTS;
}({});
exports.UI_EVENTS = UI_EVENTS;
class UIStore extends _events.default {
  constructor() {
    super();

    // eslint-disable-next-line no-restricted-properties
    (0, _defineProperty2.default)(this, "resizeObserver", void 0);
    (0, _defineProperty2.default)(this, "uiElementDimensions", new Map());
    (0, _defineProperty2.default)(this, "trackedUiElements", new Map());
    (0, _defineProperty2.default)(this, "windowWidth", void 0);
    (0, _defineProperty2.default)(this, "windowHeight", void 0);
    (0, _defineProperty2.default)(this, "resizeObserverCallback", entries => {
      const windowEntry = entries.find(entry => entry.target === document.body);
      if (windowEntry) {
        this.windowWidth = windowEntry.contentRect.width;
        this.windowHeight = windowEntry.contentRect.height;
      }
      entries.forEach(entry => {
        const trackedElementName = this.trackedUiElements.get(entry.target);
        if (trackedElementName) {
          this.uiElementDimensions.set(trackedElementName, entry.contentRect);
          this.emit(trackedElementName, UI_EVENTS.Resize, entry);
        }
      });
      this.emit(UI_EVENTS.Resize, entries);
    });
    this.windowWidth = window.innerWidth;
    // eslint-disable-next-line no-restricted-properties
    this.windowHeight = window.innerHeight;
    this.resizeObserver = new ResizeObserver(this.resizeObserverCallback);
    this.resizeObserver.observe(document.body);
  }
  static get instance() {
    if (!UIStore._instance) {
      UIStore._instance = new UIStore();
    }
    return UIStore._instance;
  }
  static destroy() {
    if (UIStore._instance) {
      UIStore._instance.resizeObserver.disconnect();
      UIStore._instance.removeAllListeners();
      UIStore._instance = null;
    }
  }
  getElementDimensions(name) {
    return this.uiElementDimensions.get(name);
  }
  trackElementDimensions(name, element) {
    this.trackedUiElements.set(element, name);
    this.resizeObserver.observe(element);
  }
  stopTrackingElementDimensions(name) {
    let trackedElement;
    this.trackedUiElements.forEach((trackedElementName, element) => {
      if (trackedElementName === name) {
        trackedElement = element;
      }
    });
    if (trackedElement) {
      this.resizeObserver.unobserve(trackedElement);
      this.uiElementDimensions.delete(name);
      this.trackedUiElements.delete(trackedElement);
    }
  }
  isTrackingElementDimensions(name) {
    return this.uiElementDimensions.has(name);
  }
}
exports.default = UIStore;
(0, _defineProperty2.default)(UIStore, "_instance", null);
window.mxUIStore = UIStore.instance;
//# sourceMappingURL=UIStore.js.map