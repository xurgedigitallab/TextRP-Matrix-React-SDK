"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.UserProfilesStore = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _logger = require("matrix-js-sdk/src/logger");
var _matrix = require("matrix-js-sdk/src/matrix");
var _LruCache = require("../utils/LruCache");
/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

const cacheSize = 500;
/**
 * This store provides cached access to user profiles.
 * Listens for membership events and invalidates the cache for a profile on update with different profile values.
 */
class UserProfilesStore {
  constructor(client) {
    this.client = client;
    (0, _defineProperty2.default)(this, "profiles", new _LruCache.LruCache(cacheSize));
    (0, _defineProperty2.default)(this, "profileLookupErrors", new _LruCache.LruCache(cacheSize));
    (0, _defineProperty2.default)(this, "knownProfiles", new _LruCache.LruCache(cacheSize));
    /**
     * Simple cache invalidation if a room membership event is received and
     * at least one profile value differs from the cached one.
     */
    (0, _defineProperty2.default)(this, "onRoomMembershipEvent", (event, member) => {
      const profile = this.profiles.get(member.userId);
      if (profile && (profile.displayname !== member.rawDisplayName || profile.avatar_url !== member.getMxcAvatarUrl())) {
        this.profiles.delete(member.userId);
      }
      const knownProfile = this.knownProfiles.get(member.userId);
      if (knownProfile && (knownProfile.displayname !== member.rawDisplayName || knownProfile.avatar_url !== member.getMxcAvatarUrl())) {
        this.knownProfiles.delete(member.userId);
      }
    });
    client.on(_matrix.RoomMemberEvent.Membership, this.onRoomMembershipEvent);
  }

  /**
   * Synchronously get a profile from the store cache.
   *
   * @param userId - User Id of the profile to fetch
   * @returns The profile, if cached by the store.
   *          Null if the profile does not exist.
   *          Undefined if the profile is not cached by the store.
   *          In this case a profile can be fetched from the API via {@link fetchProfile}.
   */
  getProfile(userId) {
    return this.profiles.get(userId);
  }

  /**
   * Async shortcut function that returns the profile from cache or
   * or fetches it on cache miss.
   *
   * @param userId - User Id of the profile to get or fetch
   * @returns The profile, if cached by the store or fetched from the API.
   *          Null if the profile does not exist or an error occurred during fetch.
   */
  async getOrFetchProfile(userId, options) {
    const cachedProfile = this.profiles.get(userId);
    if (cachedProfile) return cachedProfile;
    return this.fetchProfile(userId, options);
  }

  /**
   * Get a profile lookup error.
   *
   * @param userId - User Id for which to get the lookup error
   * @returns The lookup error or undefined if there was no error or the profile was not fetched.
   */
  getProfileLookupError(userId) {
    return this.profileLookupErrors.get(userId);
  }

  /**
   * Synchronously get a profile from known users from the store cache.
   * Known user means that at least one shared room with the user exists.
   *
   * @param userId - User Id of the profile to fetch
   * @returns The profile, if cached by the store.
   *          Null if the profile does not exist.
   *          Undefined if the profile is not cached by the store.
   *          In this case a profile can be fetched from the API via {@link fetchOnlyKnownProfile}.
   */
  getOnlyKnownProfile(userId) {
    return this.knownProfiles.get(userId);
  }

  /**
   * Asynchronousely fetches a profile from the API.
   * Stores the result in the cache, so that next time {@link getProfile} returns this value.
   *
   * @param userId - User Id for which the profile should be fetched for
   * @returns The profile, if found.
   *          Null if the profile does not exist or there was an error fetching it.
   */
  async fetchProfile(userId, options) {
    const profile = await this.fetchProfileFromApi(userId, options);
    this.profiles.set(userId, profile);
    return profile;
  }

  /**
   * Asynchronousely fetches a profile from a known user from the API.
   * Known user means that at least one shared room with the user exists.
   * Stores the result in the cache, so that next time {@link getOnlyKnownProfile} returns this value.
   *
   * @param userId - User Id for which the profile should be fetched for
   * @returns The profile, if found.
   *          Undefined if the user is unknown.
   *          Null if the profile does not exist or there was an error fetching it.
   */
  async fetchOnlyKnownProfile(userId) {
    // Do not look up unknown users. The test for existence in knownProfiles is a performance optimisation.
    // If the user Id exists in knownProfiles we know them.
    if (!this.knownProfiles.has(userId) && !this.isUserIdKnown(userId)) return undefined;
    const profile = await this.fetchProfileFromApi(userId);
    this.knownProfiles.set(userId, profile);
    return profile;
  }
  flush() {
    this.profiles = new _LruCache.LruCache(cacheSize);
    this.profileLookupErrors = new _LruCache.LruCache(cacheSize);
    this.knownProfiles = new _LruCache.LruCache(cacheSize);
  }

  /**
   * Looks up a user profile via API.
   *
   * @param userId - User Id for which the profile should be fetched for
   * @returns The profile information or null on errors
   */
  async fetchProfileFromApi(userId, options) {
    // invalidate cached profile errors
    this.profileLookupErrors.delete(userId);
    try {
      return (await this.client.getProfileInfo(userId)) ?? null;
    } catch (e) {
      _logger.logger.warn(`Error retrieving profile for userId ${userId}`, e);
      if (e instanceof _matrix.MatrixError) {
        this.profileLookupErrors.set(userId, e);
      }
      if (options?.shouldThrow) {
        throw e;
      }
    }
    return null;
  }

  /**
   * Whether at least one shared room with the userId exists.
   *
   * @param userId
   * @returns true: at least one room shared with user identified by its Id, else false.
   */
  isUserIdKnown(userId) {
    return this.client.getRooms().some(room => {
      return !!room.getMember(userId);
    });
  }
}
exports.UserProfilesStore = UserProfilesStore;
//# sourceMappingURL=UserProfilesStore.js.map