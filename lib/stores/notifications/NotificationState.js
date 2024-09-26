"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.NotificationStateSnapshot = exports.NotificationStateEvents = exports.NotificationState = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _typedEventEmitter = require("matrix-js-sdk/src/models/typed-event-emitter");
var _NotificationColor = require("./NotificationColor");
var _SettingsStore = _interopRequireDefault(require("../../settings/SettingsStore"));
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
let NotificationStateEvents = /*#__PURE__*/function (NotificationStateEvents) {
  NotificationStateEvents["Update"] = "update";
  return NotificationStateEvents;
}({});
exports.NotificationStateEvents = NotificationStateEvents;
class NotificationState extends _typedEventEmitter.TypedEventEmitter {
  constructor() {
    super();
    //
    (0, _defineProperty2.default)(this, "_symbol", null);
    (0, _defineProperty2.default)(this, "_count", 0);
    (0, _defineProperty2.default)(this, "_color", _NotificationColor.NotificationColor.None);
    (0, _defineProperty2.default)(this, "_muted", false);
    (0, _defineProperty2.default)(this, "watcherReferences", []);
    this.watcherReferences.push(_SettingsStore.default.watchSetting("feature_hidebold", null, () => {
      this.emit(NotificationStateEvents.Update);
    }));
  }
  get symbol() {
    return this._symbol;
  }
  get count() {
    return this._count;
  }
  get color() {
    return this._color;
  }
  get muted() {
    return this._muted;
  }
  get isIdle() {
    return this.color <= _NotificationColor.NotificationColor.None;
  }
  get isUnread() {
    if (this.color > _NotificationColor.NotificationColor.Bold) {
      return true;
    } else {
      const hideBold = _SettingsStore.default.getValue("feature_hidebold");
      return this.color === _NotificationColor.NotificationColor.Bold && !hideBold;
    }
  }
  get hasUnreadCount() {
    return this.color >= _NotificationColor.NotificationColor.Grey && (!!this.count || !!this.symbol);
  }
  get hasMentions() {
    return this.color >= _NotificationColor.NotificationColor.Red;
  }
  emitIfUpdated(snapshot) {
    if (snapshot.isDifferentFrom(this)) {
      this.emit(NotificationStateEvents.Update);
    }
  }
  snapshot() {
    return new NotificationStateSnapshot(this);
  }
  destroy() {
    this.removeAllListeners(NotificationStateEvents.Update);
    for (const watcherReference of this.watcherReferences) {
      _SettingsStore.default.unwatchSetting(watcherReference);
    }
    this.watcherReferences = [];
  }
}
exports.NotificationState = NotificationState;
class NotificationStateSnapshot {
  constructor(state) {
    (0, _defineProperty2.default)(this, "symbol", void 0);
    (0, _defineProperty2.default)(this, "count", void 0);
    (0, _defineProperty2.default)(this, "color", void 0);
    (0, _defineProperty2.default)(this, "muted", void 0);
    this.symbol = state.symbol;
    this.count = state.count;
    this.color = state.color;
    this.muted = state.muted;
  }
  isDifferentFrom(other) {
    const before = {
      count: this.count,
      symbol: this.symbol,
      color: this.color,
      muted: this.muted
    };
    const after = {
      count: other.count,
      symbol: other.symbol,
      color: other.color,
      muted: other.muted
    };
    return JSON.stringify(before) !== JSON.stringify(after);
  }
}
exports.NotificationStateSnapshot = NotificationStateSnapshot;
//# sourceMappingURL=NotificationState.js.map