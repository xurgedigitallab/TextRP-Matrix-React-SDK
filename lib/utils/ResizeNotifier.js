"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _events = require("events");
var _lodash = require("lodash");
/*
Copyright 2019 - 2021 The Matrix.org Foundation C.I.C.

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

/**
 * Fires when the middle panel has been resized (throttled).
 * @event module:utils~ResizeNotifier#"middlePanelResized"
 */
/**
 * Fires when the middle panel has been resized by a pixel.
 * @event module:utils~ResizeNotifier#"middlePanelResizedNoisy"
 */

class ResizeNotifier extends _events.EventEmitter {
  constructor() {
    super(...arguments);
    (0, _defineProperty2.default)(this, "_isResizing", false);
    // with default options, will call fn once at first call, and then every x ms
    // if there was another call in that timespan
    (0, _defineProperty2.default)(this, "throttledMiddlePanel", (0, _lodash.throttle)(() => this.emit("middlePanelResized"), 200));
  }
  get isResizing() {
    return this._isResizing;
  }
  startResizing() {
    this._isResizing = true;
    this.emit("isResizing", true);
  }
  stopResizing() {
    this._isResizing = false;
    this.emit("isResizing", false);
  }
  noisyMiddlePanel() {
    this.emit("middlePanelResizedNoisy");
  }
  updateMiddlePanel() {
    this.throttledMiddlePanel();
    this.noisyMiddlePanel();
  }

  // can be called in quick succession
  notifyLeftHandleResized() {
    // don't emit event for own region
    this.updateMiddlePanel();
  }

  // can be called in quick succession
  notifyRightHandleResized() {
    this.updateMiddlePanel();
  }
  notifyTimelineHeightChanged() {
    this.updateMiddlePanel();
  }

  // can be called in quick succession
  notifyWindowResized() {
    this.updateMiddlePanel();
  }
}
exports.default = ResizeNotifier;
//# sourceMappingURL=ResizeNotifier.js.map