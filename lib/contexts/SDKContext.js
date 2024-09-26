"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SdkContextClass = exports.SDKContext = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _react = require("react");
var _dispatcher = _interopRequireDefault(require("../dispatcher/dispatcher"));
var _LegacyCallHandler = _interopRequireDefault(require("../LegacyCallHandler"));
var _PosthogAnalytics = require("../PosthogAnalytics");
var _SlidingSyncManager = require("../SlidingSyncManager");
var _AccountPasswordStore = require("../stores/AccountPasswordStore");
var _MemberListStore = require("../stores/MemberListStore");
var _RoomNotificationStateStore = require("../stores/notifications/RoomNotificationStateStore");
var _RightPanelStore = _interopRequireDefault(require("../stores/right-panel/RightPanelStore"));
var _RoomViewStore = require("../stores/RoomViewStore");
var _SpaceStore = _interopRequireDefault(require("../stores/spaces/SpaceStore"));
var _TypingStore = _interopRequireDefault(require("../stores/TypingStore"));
var _UserProfilesStore = require("../stores/UserProfilesStore");
var _WidgetLayoutStore = require("../stores/widgets/WidgetLayoutStore");
var _WidgetPermissionStore = require("../stores/widgets/WidgetPermissionStore");
var _WidgetStore = _interopRequireDefault(require("../stores/WidgetStore"));
var _voiceBroadcast = require("../voice-broadcast");
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

// This context is available to components under MatrixChat,
// the context must not be used by components outside a SdkContextClass tree.
// This assertion allows us to make the type not nullable.
const SDKContext = /*#__PURE__*/(0, _react.createContext)(null);
exports.SDKContext = SDKContext;
SDKContext.displayName = "SDKContext";

/**
 * A class which lazily initialises stores as and when they are requested, ensuring they remain
 * as singletons scoped to this object.
 */
class SdkContextClass {
  constructor() {
    // Optional as we don't have a client on initial load if unregistered. This should be set
    // when the MatrixClient is first acquired in the dispatcher event Action.OnLoggedIn.
    // It is only safe to set this once, as updating this value will NOT notify components using
    // this Context.
    (0, _defineProperty2.default)(this, "client", void 0);
    // All protected fields to make it easier to derive test stores
    (0, _defineProperty2.default)(this, "_WidgetPermissionStore", void 0);
    (0, _defineProperty2.default)(this, "_MemberListStore", void 0);
    (0, _defineProperty2.default)(this, "_RightPanelStore", void 0);
    (0, _defineProperty2.default)(this, "_RoomNotificationStateStore", void 0);
    (0, _defineProperty2.default)(this, "_RoomViewStore", void 0);
    (0, _defineProperty2.default)(this, "_WidgetLayoutStore", void 0);
    (0, _defineProperty2.default)(this, "_WidgetStore", void 0);
    (0, _defineProperty2.default)(this, "_PosthogAnalytics", void 0);
    (0, _defineProperty2.default)(this, "_SlidingSyncManager", void 0);
    (0, _defineProperty2.default)(this, "_SpaceStore", void 0);
    (0, _defineProperty2.default)(this, "_LegacyCallHandler", void 0);
    (0, _defineProperty2.default)(this, "_TypingStore", void 0);
    (0, _defineProperty2.default)(this, "_VoiceBroadcastRecordingsStore", void 0);
    (0, _defineProperty2.default)(this, "_VoiceBroadcastPreRecordingStore", void 0);
    (0, _defineProperty2.default)(this, "_VoiceBroadcastPlaybacksStore", void 0);
    (0, _defineProperty2.default)(this, "_AccountPasswordStore", void 0);
    (0, _defineProperty2.default)(this, "_UserProfilesStore", void 0);
  }
  /**
   * Automatically construct stores which need to be created eagerly so they can register with
   * the dispatcher.
   */
  constructEagerStores() {
    this._RoomViewStore = this.roomViewStore;
  }
  get legacyCallHandler() {
    if (!this._LegacyCallHandler) {
      this._LegacyCallHandler = _LegacyCallHandler.default.instance;
    }
    return this._LegacyCallHandler;
  }
  get rightPanelStore() {
    if (!this._RightPanelStore) {
      this._RightPanelStore = _RightPanelStore.default.instance;
    }
    return this._RightPanelStore;
  }
  get roomNotificationStateStore() {
    if (!this._RoomNotificationStateStore) {
      this._RoomNotificationStateStore = _RoomNotificationStateStore.RoomNotificationStateStore.instance;
    }
    return this._RoomNotificationStateStore;
  }
  get roomViewStore() {
    if (!this._RoomViewStore) {
      this._RoomViewStore = new _RoomViewStore.RoomViewStore(_dispatcher.default, this);
    }
    return this._RoomViewStore;
  }
  get widgetLayoutStore() {
    if (!this._WidgetLayoutStore) {
      this._WidgetLayoutStore = _WidgetLayoutStore.WidgetLayoutStore.instance;
    }
    return this._WidgetLayoutStore;
  }
  get widgetPermissionStore() {
    if (!this._WidgetPermissionStore) {
      this._WidgetPermissionStore = new _WidgetPermissionStore.WidgetPermissionStore(this);
    }
    return this._WidgetPermissionStore;
  }
  get widgetStore() {
    if (!this._WidgetStore) {
      this._WidgetStore = _WidgetStore.default.instance;
    }
    return this._WidgetStore;
  }
  get posthogAnalytics() {
    if (!this._PosthogAnalytics) {
      this._PosthogAnalytics = _PosthogAnalytics.PosthogAnalytics.instance;
    }
    return this._PosthogAnalytics;
  }
  get memberListStore() {
    if (!this._MemberListStore) {
      this._MemberListStore = new _MemberListStore.MemberListStore(this);
    }
    return this._MemberListStore;
  }
  get slidingSyncManager() {
    if (!this._SlidingSyncManager) {
      this._SlidingSyncManager = _SlidingSyncManager.SlidingSyncManager.instance;
    }
    return this._SlidingSyncManager;
  }
  get spaceStore() {
    if (!this._SpaceStore) {
      this._SpaceStore = _SpaceStore.default.instance;
    }
    return this._SpaceStore;
  }
  get typingStore() {
    if (!this._TypingStore) {
      this._TypingStore = new _TypingStore.default(this);
      window.mxTypingStore = this._TypingStore;
    }
    return this._TypingStore;
  }
  get voiceBroadcastRecordingsStore() {
    if (!this._VoiceBroadcastRecordingsStore) {
      this._VoiceBroadcastRecordingsStore = new _voiceBroadcast.VoiceBroadcastRecordingsStore();
    }
    return this._VoiceBroadcastRecordingsStore;
  }
  get voiceBroadcastPreRecordingStore() {
    if (!this._VoiceBroadcastPreRecordingStore) {
      this._VoiceBroadcastPreRecordingStore = new _voiceBroadcast.VoiceBroadcastPreRecordingStore();
    }
    return this._VoiceBroadcastPreRecordingStore;
  }
  get voiceBroadcastPlaybacksStore() {
    if (!this._VoiceBroadcastPlaybacksStore) {
      this._VoiceBroadcastPlaybacksStore = new _voiceBroadcast.VoiceBroadcastPlaybacksStore(this.voiceBroadcastRecordingsStore);
    }
    return this._VoiceBroadcastPlaybacksStore;
  }
  get accountPasswordStore() {
    if (!this._AccountPasswordStore) {
      this._AccountPasswordStore = new _AccountPasswordStore.AccountPasswordStore();
    }
    return this._AccountPasswordStore;
  }
  get userProfilesStore() {
    if (!this.client) {
      throw new Error("Unable to create UserProfilesStore without a client");
    }
    if (!this._UserProfilesStore) {
      this._UserProfilesStore = new _UserProfilesStore.UserProfilesStore(this.client);
    }
    return this._UserProfilesStore;
  }
  onLoggedOut() {
    this._UserProfilesStore = undefined;
  }
}
exports.SdkContextClass = SdkContextClass;
/**
 * The global SdkContextClass instance. This is a temporary measure whilst so many stores remain global
 * as well. Over time, these stores should accept a `SdkContextClass` instance in their constructor.
 * When all stores do this, this static variable can be deleted.
 */
(0, _defineProperty2.default)(SdkContextClass, "instance", new SdkContextClass());
//# sourceMappingURL=SDKContext.js.map