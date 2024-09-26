"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.OwnProfileStore = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _user = require("matrix-js-sdk/src/models/user");
var _roomState = require("matrix-js-sdk/src/models/room-state");
var _lodash = require("lodash");
var _event = require("matrix-js-sdk/src/@types/event");
var _AsyncStoreWithClient = require("./AsyncStoreWithClient");
var _dispatcher = _interopRequireDefault(require("../dispatcher/dispatcher"));
var _MatrixClientPeg = require("../MatrixClientPeg");
var _languageHandler = require("../languageHandler");
var _Media = require("../customisations/Media");
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

const KEY_DISPLAY_NAME = "mx_profile_displayname";
const KEY_AVATAR_URL = "mx_profile_avatar_url";
class OwnProfileStore extends _AsyncStoreWithClient.AsyncStoreWithClient {
  constructor() {
    // seed from localstorage because otherwise we won't get these values until a whole network
    // round-trip after the client is ready, and we often load widgets in that time, and we'd
    // and up passing them an incorrect display name
    super(_dispatcher.default, {
      displayName: window.localStorage.getItem(KEY_DISPLAY_NAME) || undefined,
      avatarUrl: window.localStorage.getItem(KEY_AVATAR_URL) || undefined
    });
    (0, _defineProperty2.default)(this, "monitoredUser", null);
    (0, _defineProperty2.default)(this, "onProfileUpdate", (0, _lodash.throttle)(async () => {
      if (!this.matrixClient) return;
      // We specifically do not use the User object we stored for profile info as it
      // could easily be wrong (such as per-room instead of global profile).
      const profileInfo = await this.matrixClient.getProfileInfo(this.matrixClient.getSafeUserId());
      if (profileInfo.displayname) {
        window.localStorage.setItem(KEY_DISPLAY_NAME, profileInfo.displayname);
      } else {
        window.localStorage.removeItem(KEY_DISPLAY_NAME);
      }
      if (profileInfo.avatar_url) {
        window.localStorage.setItem(KEY_AVATAR_URL, profileInfo.avatar_url);
      } else {
        window.localStorage.removeItem(KEY_AVATAR_URL);
      }
      await this.updateState({
        displayName: profileInfo.displayname,
        avatarUrl: profileInfo.avatar_url,
        fetchedAt: Date.now()
      });
    }, 200, {
      trailing: true,
      leading: true
    }));
    (0, _defineProperty2.default)(this, "onStateEvents", async ev => {
      const myUserId = _MatrixClientPeg.MatrixClientPeg.get().getUserId();
      if (ev.getType() === _event.EventType.RoomMember && ev.getSender() === myUserId && ev.getStateKey() === myUserId) {
        await this.onProfileUpdate();
      }
    });
  }
  static get instance() {
    return OwnProfileStore.internalInstance;
  }

  /**
   * Gets the display name for the user, or null if not present.
   */
  get displayName() {
    if (!this.matrixClient) return this.state.displayName || null;
    if (this.matrixClient.isGuest()) {
      return (0, _languageHandler._t)("Guest");
    } else if (this.state.displayName) {
      return this.state.displayName;
    } else {
      return this.matrixClient.getUserId();
    }
  }
  get isProfileInfoFetched() {
    return !!this.state.fetchedAt;
  }

  /**
   * Gets the MXC URI of the user's avatar, or null if not present.
   */
  get avatarMxc() {
    return this.state.avatarUrl || null;
  }

  /**
   * Gets the user's avatar as an HTTP URL of the given size. If the user's
   * avatar is not present, this returns null.
   * @param size The size of the avatar. If zero, a full res copy of the avatar
   * will be returned as an HTTP URL.
   * @returns The HTTP URL of the user's avatar
   */
  getHttpAvatarUrl() {
    let size = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
    if (!this.avatarMxc) return null;
    const media = (0, _Media.mediaFromMxc)(this.avatarMxc);
    if (!size || size <= 0) {
      return media.srcHttp;
    } else {
      return media.getSquareThumbnailHttp(size);
    }
  }
  async onNotReady() {
    if (this.monitoredUser) {
      this.monitoredUser.removeListener(_user.UserEvent.DisplayName, this.onProfileUpdate);
      this.monitoredUser.removeListener(_user.UserEvent.AvatarUrl, this.onProfileUpdate);
    }
    this.matrixClient?.removeListener(_roomState.RoomStateEvent.Events, this.onStateEvents);
    await this.reset({});
  }
  async onReady() {
    if (!this.matrixClient) return;
    const myUserId = this.matrixClient.getSafeUserId();
    this.monitoredUser = this.matrixClient.getUser(myUserId);
    if (this.monitoredUser) {
      this.monitoredUser.on(_user.UserEvent.DisplayName, this.onProfileUpdate);
      this.monitoredUser.on(_user.UserEvent.AvatarUrl, this.onProfileUpdate);
    }

    // We also have to listen for membership events for ourselves as the above User events
    // are fired only with presence, which matrix.org (and many others) has disabled.
    this.matrixClient.on(_roomState.RoomStateEvent.Events, this.onStateEvents);
    await this.onProfileUpdate(); // trigger an initial update
  }

  async onAction(payload) {
    // we don't actually do anything here
  }
}
exports.OwnProfileStore = OwnProfileStore;
(0, _defineProperty2.default)(OwnProfileStore, "internalInstance", (() => {
  const instance = new OwnProfileStore();
  instance.start();
  return instance;
})());
//# sourceMappingURL=OwnProfileStore.js.map