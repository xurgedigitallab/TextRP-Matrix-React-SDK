"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.MatrixClientPeg = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _matrix = require("matrix-js-sdk/src/matrix");
var _memory = require("matrix-js-sdk/src/store/memory");
var utils = _interopRequireWildcard(require("matrix-js-sdk/src/utils"));
var _eventTimeline = require("matrix-js-sdk/src/models/event-timeline");
var _eventTimelineSet = require("matrix-js-sdk/src/models/event-timeline-set");
var _crypto = require("matrix-js-sdk/src/crypto");
var _QRCode = require("matrix-js-sdk/src/crypto/verification/QRCode");
var _logger = require("matrix-js-sdk/src/logger");
var _createMatrixClient = _interopRequireDefault(require("./utils/createMatrixClient"));
var _SettingsStore = _interopRequireDefault(require("./settings/SettingsStore"));
var _MatrixActionCreators = _interopRequireDefault(require("./actions/MatrixActionCreators"));
var _Modal = _interopRequireDefault(require("./Modal"));
var _MatrixClientBackedSettingsHandler = _interopRequireDefault(require("./settings/handlers/MatrixClientBackedSettingsHandler"));
var StorageManager = _interopRequireWildcard(require("./utils/StorageManager"));
var _IdentityAuthClient = _interopRequireDefault(require("./IdentityAuthClient"));
var _SecurityManager = require("./SecurityManager");
var _Security = _interopRequireDefault(require("./customisations/Security"));
var _SlidingSyncManager = require("./SlidingSyncManager");
var _CryptoStoreTooNewDialog = _interopRequireDefault(require("./components/views/dialogs/CryptoStoreTooNewDialog"));
var _languageHandler = require("./languageHandler");
var _SettingLevel = require("./settings/SettingLevel");
var _MatrixClientBackedController = _interopRequireDefault(require("./settings/controllers/MatrixClientBackedController"));
var _ErrorDialog = _interopRequireDefault(require("./components/views/dialogs/ErrorDialog"));
var _PlatformPeg = _interopRequireDefault(require("./PlatformPeg"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         Copyright 2015, 2016 OpenMarket Ltd
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         Copyright 2017 Vector Creations Ltd.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         Copyright 2017, 2018, 2019 New Vector Ltd
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         Copyright 2019 - 2023 The Matrix.org Foundation C.I.C.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         
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
 * Holds the current instance of the `MatrixClient` to use across the codebase.
 * Looking for an `MatrixClient`? Just look for the `MatrixClientPeg` on the peg
 * board. "Peg" is the literal meaning of something you hang something on. So
 * you'll find a `MatrixClient` hanging on the `MatrixClientPeg`.
 */

/**
 * Wrapper object for handling the js-sdk Matrix Client object in the react-sdk
 * Handles the creation/initialisation of client objects.
 * This module provides a singleton instance of this class so the 'current'
 * Matrix Client object is available easily.
 */
class MatrixClientPegClass {
  constructor() {
    // These are the default options used when when the
    // client is started in 'start'. These can be altered
    // at any time up to after the 'will_start_client'
    // event is finished processing.
    (0, _defineProperty2.default)(this, "opts", {
      initialSyncLimit: 20
    });
    (0, _defineProperty2.default)(this, "matrixClient", null);
    (0, _defineProperty2.default)(this, "justRegisteredUserId", null);
    // the credentials used to init the current client object.
    // used if we tear it down & recreate it with a different store
    (0, _defineProperty2.default)(this, "currentClientCreds", null);
    (0, _defineProperty2.default)(this, "onUnexpectedStoreClose", async () => {
      if (!this.matrixClient) return;
      this.matrixClient.stopClient(); // stop the client as the database has failed
      this.matrixClient.store.destroy();
      if (!this.matrixClient.isGuest()) {
        // If the user is not a guest then prompt them to reload rather than doing it for them
        // For guests this is likely to happen during e-mail verification as part of registration

        const {
          finished
        } = _Modal.default.createDialog(_ErrorDialog.default, {
          title: (0, _languageHandler._t)("Database unexpectedly closed"),
          description: (0, _languageHandler._t)("This may be caused by having the app open in multiple tabs or due to clearing browser data."),
          button: (0, _languageHandler._t)("Reload")
        });
        const [reload] = await finished;
        if (!reload) return;
      }
      _PlatformPeg.default.get()?.reload();
    });
  }
  get() {
    return this.matrixClient;
  }
  safeGet() {
    if (!this.matrixClient) {
      throw new _languageHandler.UserFriendlyError("User is not logged in");
    }
    return this.matrixClient;
  }
  unset() {
    this.matrixClient = null;
    _MatrixActionCreators.default.stop();
  }
  setJustRegisteredUserId(uid) {
    this.justRegisteredUserId = uid;
    if (uid) {
      const registrationTime = Date.now().toString();
      window.localStorage.setItem("mx_registration_time", registrationTime);
    }
  }
  currentUserIsJustRegistered() {
    return !!this.matrixClient && this.matrixClient.credentials.userId === this.justRegisteredUserId;
  }
  userRegisteredWithinLastHours(hours) {
    if (hours <= 0) {
      return false;
    }
    try {
      const registrationTime = parseInt(window.localStorage.getItem("mx_registration_time"), 10);
      const diff = Date.now() - registrationTime;
      return diff / 36e5 <= hours;
    } catch (e) {
      return false;
    }
  }
  userRegisteredAfter(timestamp) {
    try {
      const registrationTime = parseInt(window.localStorage.getItem("mx_registration_time"), 10);
      return timestamp.getTime() <= registrationTime;
    } catch (e) {
      return false;
    }
  }
  replaceUsingCreds(creds) {
    this.currentClientCreds = creds;
    this.createClient(creds);
  }
  async assign() {
    if (!this.matrixClient) {
      throw new Error("createClient must be called first");
    }
    for (const dbType of ["indexeddb", "memory"]) {
      try {
        const promise = this.matrixClient.store.startup();
        _logger.logger.log("MatrixClientPeg: waiting for MatrixClient store to initialise");
        await promise;
        break;
      } catch (err) {
        if (dbType === "indexeddb") {
          _logger.logger.error("Error starting matrixclient store - falling back to memory store", err);
          this.matrixClient.store = new _memory.MemoryStore({
            localStorage: localStorage
          });
        } else {
          _logger.logger.error("Failed to start memory store!", err);
          throw err;
        }
      }
    }
    this.matrixClient.store.on?.("closed", this.onUnexpectedStoreClose);

    // try to initialise e2e on the new client
    if (!_SettingsStore.default.getValue("lowBandwidth")) {
      await this.initClientCrypto();
    }
    const opts = utils.deepCopy(this.opts);
    // the react sdk doesn't work without this, so don't allow
    opts.pendingEventOrdering = _matrix.PendingEventOrdering.Detached;
    opts.lazyLoadMembers = true;
    opts.clientWellKnownPollPeriod = 2 * 60 * 60; // 2 hours
    opts.threadSupport = true;
    if (_SettingsStore.default.getValue("feature_sliding_sync")) {
      const proxyUrl = _SettingsStore.default.getValue("feature_sliding_sync_proxy_url");
      if (proxyUrl) {
        _logger.logger.log("Activating sliding sync using proxy at ", proxyUrl);
      } else {
        _logger.logger.log("Activating sliding sync");
      }
      opts.slidingSync = _SlidingSyncManager.SlidingSyncManager.instance.configure(this.matrixClient, proxyUrl || this.matrixClient.baseUrl);
      _SlidingSyncManager.SlidingSyncManager.instance.startSpidering(100, 50); // 100 rooms at a time, 50ms apart
    }

    // Connect the matrix client to the dispatcher and setting handlers
    _MatrixActionCreators.default.start(this.matrixClient);
    _MatrixClientBackedSettingsHandler.default.matrixClient = this.matrixClient;
    _MatrixClientBackedController.default.matrixClient = this.matrixClient;
    return opts;
  }

  /**
   * Attempt to initialize the crypto layer on a newly-created MatrixClient
   */
  async initClientCrypto() {
    if (!this.matrixClient) {
      throw new Error("createClient must be called first");
    }
    const useRustCrypto = _SettingsStore.default.getValue("feature_rust_crypto");

    // we want to make sure that the same crypto implementation is used throughout the lifetime of a device,
    // so persist the setting at the device layer
    // (At some point, we'll allow the user to *enable* the setting via labs, which will migrate their existing
    // device to the rust-sdk implementation, but that won't change anything here).
    await _SettingsStore.default.setValue("feature_rust_crypto", null, _SettingLevel.SettingLevel.DEVICE, useRustCrypto);

    // Now we can initialise the right crypto impl.
    if (useRustCrypto) {
      await this.matrixClient.initRustCrypto();

      // TODO: device dehydration and whathaveyou
      return;
    }

    // fall back to the libolm layer.
    try {
      // check that we have a version of the js-sdk which includes initCrypto
      if (this.matrixClient.initCrypto) {
        await this.matrixClient.initCrypto();
        this.matrixClient.setCryptoTrustCrossSignedDevices(!_SettingsStore.default.getValue("e2ee.manuallyVerifyAllSessions"));
        await (0, _SecurityManager.tryToUnlockSecretStorageWithDehydrationKey)(this.matrixClient);
        StorageManager.setCryptoInitialised(true);
      }
    } catch (e) {
      if (e instanceof Error && e.name === "InvalidCryptoStoreError") {
        // The js-sdk found a crypto DB too new for it to use
        _Modal.default.createDialog(_CryptoStoreTooNewDialog.default);
      }
      // this can happen for a number of reasons, the most likely being
      // that the olm library was missing. It's not fatal.
      _logger.logger.warn("Unable to initialise e2e", e);
    }
  }
  async start() {
    const opts = await this.assign();
    _logger.logger.log(`MatrixClientPeg: really starting MatrixClient`);
    await this.matrixClient.startClient(opts);
    _logger.logger.log(`MatrixClientPeg: MatrixClient started`);
  }
  getCredentials() {
    if (!this.matrixClient) {
      throw new Error("createClient must be called first");
    }
    let copiedCredentials = this.currentClientCreds;
    if (this.currentClientCreds?.userId !== this.matrixClient?.credentials?.userId) {
      // cached credentials belong to a different user - don't use them
      copiedCredentials = null;
    }
    return _objectSpread(_objectSpread({}, copiedCredentials ?? {}), {}, {
      homeserverUrl: this.matrixClient.baseUrl,
      identityServerUrl: this.matrixClient.idBaseUrl,
      userId: this.matrixClient.getSafeUserId(),
      deviceId: this.matrixClient.getDeviceId() ?? undefined,
      accessToken: this.matrixClient.getAccessToken() ?? undefined,
      guest: this.matrixClient.isGuest()
    });
  }
  getHomeserverName() {
    if (!this.matrixClient) return null;
    const matches = /^@[^:]+:(.+)$/.exec(this.matrixClient.getSafeUserId());
    if (matches === null || matches.length < 1) {
      throw new Error("Failed to derive homeserver name from user ID!");
    }
    return matches[1];
  }
  namesToRoomName(names, count) {
    const countWithoutMe = count - 1;
    if (!names.length) {
      return (0, _languageHandler._t)("Empty room");
    }
    if (names.length === 1 && countWithoutMe <= 1) {
      return names[0];
    }
  }
  memberNamesToRoomName(names, count) {
    const name = this.namesToRoomName(names, count);
    if (name) return name;
    if (names.length === 2 && count === 2) {
      return (0, _languageHandler._t)("%(user1)s and %(user2)s", {
        user1: names[0],
        user2: names[1]
      });
    }
    return (0, _languageHandler._t)("%(user)s and %(count)s others", {
      user: names[0],
      count: count - 1
    });
  }
  inviteeNamesToRoomName(names, count) {
    const name = this.namesToRoomName(names, count);
    if (name) return name;
    if (names.length === 2 && count === 2) {
      return (0, _languageHandler._t)("Inviting %(user1)s and %(user2)s", {
        user1: names[0],
        user2: names[1]
      });
    }
    return (0, _languageHandler._t)("Inviting %(user)s and %(count)s others", {
      user: names[0],
      count: count - 1
    });
  }
  createClient(creds) {
    console.log("🔷🔷🔷 ========== CREATE MATRIX CLIENT ========== 🔷🔷🔷");
    console.log("🔷 Credentials received:");
    console.log("🔷   - homeserverUrl:", creds.homeserverUrl);
    console.log("🔷   - identityServerUrl:", creds.identityServerUrl);
    console.log("🔷   - userId:", creds.userId);
    console.log("🔷   - deviceId:", creds.deviceId);
    console.log("🔷   - accessToken (first 20):", creds.accessToken?.substring(0, 20));
    console.log("🔷 Creating client with baseUrl:", creds.homeserverUrl);
    console.log("🔷🔷🔷 ============================================== 🔷🔷🔷");
    const opts = {
      baseUrl: creds.homeserverUrl,
      idBaseUrl: creds.identityServerUrl,
      accessToken: creds.accessToken,
      userId: creds.userId,
      deviceId: creds.deviceId,
      pickleKey: creds.pickleKey,
      timelineSupport: true,
      forceTURN: !_SettingsStore.default.getValue("webRtcAllowPeerToPeer"),
      fallbackICEServerAllowed: !!_SettingsStore.default.getValue("fallbackICEServerAllowed"),
      // Gather up to 20 ICE candidates when a call arrives: this should be more than we'd
      // ever normally need, so effectively this should make all the gathering happen when
      // the call arrives.
      iceCandidatePoolSize: 20,
      verificationMethods: [_crypto.verificationMethods.SAS, _QRCode.SHOW_QR_CODE_METHOD, _crypto.verificationMethods.RECIPROCATE_QR_CODE],
      identityServer: new _IdentityAuthClient.default(),
      // These are always installed regardless of the labs flag so that cross-signing features
      // can toggle on without reloading and also be accessed immediately after login.
      cryptoCallbacks: _objectSpread({}, _SecurityManager.crossSigningCallbacks),
      roomNameGenerator: (_, state) => {
        switch (state.type) {
          case _matrix.RoomNameType.Generated:
            switch (state.subtype) {
              case "Inviting":
                return this.inviteeNamesToRoomName(state.names, state.count);
              default:
                return this.memberNamesToRoomName(state.names, state.count);
            }
          case _matrix.RoomNameType.EmptyRoom:
            if (state.oldName) {
              return (0, _languageHandler._t)("Empty room (was %(oldName)s)", {
                oldName: state.oldName
              });
            } else {
              return (0, _languageHandler._t)("Empty room");
            }
          default:
            return null;
        }
      }
    };
    if (_Security.default.getDehydrationKey) {
      opts.cryptoCallbacks.getDehydrationKey = _Security.default.getDehydrationKey;
    }
    this.matrixClient = (0, _createMatrixClient.default)(opts);

    // we're going to add eventlisteners for each matrix event tile, so the
    // potential number of event listeners is quite high.
    this.matrixClient.setMaxListeners(500);
    this.matrixClient.setGuest(Boolean(creds.guest));
    const notifTimelineSet = new _eventTimelineSet.EventTimelineSet(undefined, {
      timelineSupport: true,
      pendingEvents: false
    });
    // XXX: what is our initial pagination token?! it somehow needs to be synchronised with /sync.
    notifTimelineSet.getLiveTimeline().setPaginationToken("", _eventTimeline.EventTimeline.BACKWARDS);
    this.matrixClient.setNotifTimelineSet(notifTimelineSet);
  }
}

/**
 * Note: You should be using a React context with access to a client rather than
 * using this, as in a multi-account world this will not exist!
 */
const MatrixClientPeg = new MatrixClientPegClass();
exports.MatrixClientPeg = MatrixClientPeg;
if (!window.mxMatrixClientPeg) {
  window.mxMatrixClientPeg = MatrixClientPeg;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfbWF0cml4IiwicmVxdWlyZSIsIl9tZW1vcnkiLCJ1dGlscyIsIl9pbnRlcm9wUmVxdWlyZVdpbGRjYXJkIiwiX2V2ZW50VGltZWxpbmUiLCJfZXZlbnRUaW1lbGluZVNldCIsIl9jcnlwdG8iLCJfUVJDb2RlIiwiX2xvZ2dlciIsIl9jcmVhdGVNYXRyaXhDbGllbnQiLCJfaW50ZXJvcFJlcXVpcmVEZWZhdWx0IiwiX1NldHRpbmdzU3RvcmUiLCJfTWF0cml4QWN0aW9uQ3JlYXRvcnMiLCJfTW9kYWwiLCJfTWF0cml4Q2xpZW50QmFja2VkU2V0dGluZ3NIYW5kbGVyIiwiU3RvcmFnZU1hbmFnZXIiLCJfSWRlbnRpdHlBdXRoQ2xpZW50IiwiX1NlY3VyaXR5TWFuYWdlciIsIl9TZWN1cml0eSIsIl9TbGlkaW5nU3luY01hbmFnZXIiLCJfQ3J5cHRvU3RvcmVUb29OZXdEaWFsb2ciLCJfbGFuZ3VhZ2VIYW5kbGVyIiwiX1NldHRpbmdMZXZlbCIsIl9NYXRyaXhDbGllbnRCYWNrZWRDb250cm9sbGVyIiwiX0Vycm9yRGlhbG9nIiwiX1BsYXRmb3JtUGVnIiwiX2dldFJlcXVpcmVXaWxkY2FyZENhY2hlIiwibm9kZUludGVyb3AiLCJXZWFrTWFwIiwiY2FjaGVCYWJlbEludGVyb3AiLCJjYWNoZU5vZGVJbnRlcm9wIiwib2JqIiwiX19lc01vZHVsZSIsImRlZmF1bHQiLCJjYWNoZSIsImhhcyIsImdldCIsIm5ld09iaiIsImhhc1Byb3BlcnR5RGVzY3JpcHRvciIsIk9iamVjdCIsImRlZmluZVByb3BlcnR5IiwiZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yIiwia2V5IiwicHJvdG90eXBlIiwiaGFzT3duUHJvcGVydHkiLCJjYWxsIiwiZGVzYyIsInNldCIsIm93bktleXMiLCJvYmplY3QiLCJlbnVtZXJhYmxlT25seSIsImtleXMiLCJnZXRPd25Qcm9wZXJ0eVN5bWJvbHMiLCJzeW1ib2xzIiwiZmlsdGVyIiwic3ltIiwiZW51bWVyYWJsZSIsInB1c2giLCJhcHBseSIsIl9vYmplY3RTcHJlYWQiLCJ0YXJnZXQiLCJpIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwic291cmNlIiwiZm9yRWFjaCIsIl9kZWZpbmVQcm9wZXJ0eTIiLCJnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzIiwiZGVmaW5lUHJvcGVydGllcyIsIk1hdHJpeENsaWVudFBlZ0NsYXNzIiwiY29uc3RydWN0b3IiLCJpbml0aWFsU3luY0xpbWl0IiwibWF0cml4Q2xpZW50Iiwic3RvcENsaWVudCIsInN0b3JlIiwiZGVzdHJveSIsImlzR3Vlc3QiLCJmaW5pc2hlZCIsIk1vZGFsIiwiY3JlYXRlRGlhbG9nIiwiRXJyb3JEaWFsb2ciLCJ0aXRsZSIsIl90IiwiZGVzY3JpcHRpb24iLCJidXR0b24iLCJyZWxvYWQiLCJQbGF0Zm9ybVBlZyIsInNhZmVHZXQiLCJVc2VyRnJpZW5kbHlFcnJvciIsInVuc2V0IiwiTWF0cml4QWN0aW9uQ3JlYXRvcnMiLCJzdG9wIiwic2V0SnVzdFJlZ2lzdGVyZWRVc2VySWQiLCJ1aWQiLCJqdXN0UmVnaXN0ZXJlZFVzZXJJZCIsInJlZ2lzdHJhdGlvblRpbWUiLCJEYXRlIiwibm93IiwidG9TdHJpbmciLCJ3aW5kb3ciLCJsb2NhbFN0b3JhZ2UiLCJzZXRJdGVtIiwiY3VycmVudFVzZXJJc0p1c3RSZWdpc3RlcmVkIiwiY3JlZGVudGlhbHMiLCJ1c2VySWQiLCJ1c2VyUmVnaXN0ZXJlZFdpdGhpbkxhc3RIb3VycyIsImhvdXJzIiwicGFyc2VJbnQiLCJnZXRJdGVtIiwiZGlmZiIsImUiLCJ1c2VyUmVnaXN0ZXJlZEFmdGVyIiwidGltZXN0YW1wIiwiZ2V0VGltZSIsInJlcGxhY2VVc2luZ0NyZWRzIiwiY3JlZHMiLCJjdXJyZW50Q2xpZW50Q3JlZHMiLCJjcmVhdGVDbGllbnQiLCJhc3NpZ24iLCJFcnJvciIsImRiVHlwZSIsInByb21pc2UiLCJzdGFydHVwIiwibG9nZ2VyIiwibG9nIiwiZXJyIiwiZXJyb3IiLCJNZW1vcnlTdG9yZSIsIm9uIiwib25VbmV4cGVjdGVkU3RvcmVDbG9zZSIsIlNldHRpbmdzU3RvcmUiLCJnZXRWYWx1ZSIsImluaXRDbGllbnRDcnlwdG8iLCJvcHRzIiwiZGVlcENvcHkiLCJwZW5kaW5nRXZlbnRPcmRlcmluZyIsIlBlbmRpbmdFdmVudE9yZGVyaW5nIiwiRGV0YWNoZWQiLCJsYXp5TG9hZE1lbWJlcnMiLCJjbGllbnRXZWxsS25vd25Qb2xsUGVyaW9kIiwidGhyZWFkU3VwcG9ydCIsInByb3h5VXJsIiwic2xpZGluZ1N5bmMiLCJTbGlkaW5nU3luY01hbmFnZXIiLCJpbnN0YW5jZSIsImNvbmZpZ3VyZSIsImJhc2VVcmwiLCJzdGFydFNwaWRlcmluZyIsInN0YXJ0IiwiTWF0cml4Q2xpZW50QmFja2VkU2V0dGluZ3NIYW5kbGVyIiwiTWF0cml4Q2xpZW50QmFja2VkQ29udHJvbGxlciIsInVzZVJ1c3RDcnlwdG8iLCJzZXRWYWx1ZSIsIlNldHRpbmdMZXZlbCIsIkRFVklDRSIsImluaXRSdXN0Q3J5cHRvIiwiaW5pdENyeXB0byIsInNldENyeXB0b1RydXN0Q3Jvc3NTaWduZWREZXZpY2VzIiwidHJ5VG9VbmxvY2tTZWNyZXRTdG9yYWdlV2l0aERlaHlkcmF0aW9uS2V5Iiwic2V0Q3J5cHRvSW5pdGlhbGlzZWQiLCJuYW1lIiwiQ3J5cHRvU3RvcmVUb29OZXdEaWFsb2ciLCJ3YXJuIiwic3RhcnRDbGllbnQiLCJnZXRDcmVkZW50aWFscyIsImNvcGllZENyZWRlbnRpYWxzIiwiaG9tZXNlcnZlclVybCIsImlkZW50aXR5U2VydmVyVXJsIiwiaWRCYXNlVXJsIiwiZ2V0U2FmZVVzZXJJZCIsImRldmljZUlkIiwiZ2V0RGV2aWNlSWQiLCJ1bmRlZmluZWQiLCJhY2Nlc3NUb2tlbiIsImdldEFjY2Vzc1Rva2VuIiwiZ3Vlc3QiLCJnZXRIb21lc2VydmVyTmFtZSIsIm1hdGNoZXMiLCJleGVjIiwibmFtZXNUb1Jvb21OYW1lIiwibmFtZXMiLCJjb3VudCIsImNvdW50V2l0aG91dE1lIiwibWVtYmVyTmFtZXNUb1Jvb21OYW1lIiwidXNlcjEiLCJ1c2VyMiIsInVzZXIiLCJpbnZpdGVlTmFtZXNUb1Jvb21OYW1lIiwiY29uc29sZSIsInN1YnN0cmluZyIsInBpY2tsZUtleSIsInRpbWVsaW5lU3VwcG9ydCIsImZvcmNlVFVSTiIsImZhbGxiYWNrSUNFU2VydmVyQWxsb3dlZCIsImljZUNhbmRpZGF0ZVBvb2xTaXplIiwidmVyaWZpY2F0aW9uTWV0aG9kcyIsIlNBUyIsIlNIT1dfUVJfQ09ERV9NRVRIT0QiLCJSRUNJUFJPQ0FURV9RUl9DT0RFIiwiaWRlbnRpdHlTZXJ2ZXIiLCJJZGVudGl0eUF1dGhDbGllbnQiLCJjcnlwdG9DYWxsYmFja3MiLCJjcm9zc1NpZ25pbmdDYWxsYmFja3MiLCJyb29tTmFtZUdlbmVyYXRvciIsIl8iLCJzdGF0ZSIsInR5cGUiLCJSb29tTmFtZVR5cGUiLCJHZW5lcmF0ZWQiLCJzdWJ0eXBlIiwiRW1wdHlSb29tIiwib2xkTmFtZSIsIlNlY3VyaXR5Q3VzdG9taXNhdGlvbnMiLCJnZXREZWh5ZHJhdGlvbktleSIsImNyZWF0ZU1hdHJpeENsaWVudCIsInNldE1heExpc3RlbmVycyIsInNldEd1ZXN0IiwiQm9vbGVhbiIsIm5vdGlmVGltZWxpbmVTZXQiLCJFdmVudFRpbWVsaW5lU2V0IiwicGVuZGluZ0V2ZW50cyIsImdldExpdmVUaW1lbGluZSIsInNldFBhZ2luYXRpb25Ub2tlbiIsIkV2ZW50VGltZWxpbmUiLCJCQUNLV0FSRFMiLCJzZXROb3RpZlRpbWVsaW5lU2V0IiwiTWF0cml4Q2xpZW50UGVnIiwiZXhwb3J0cyIsIm14TWF0cml4Q2xpZW50UGVnIl0sInNvdXJjZXMiOlsiLi4vc3JjL01hdHJpeENsaWVudFBlZy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuQ29weXJpZ2h0IDIwMTUsIDIwMTYgT3Blbk1hcmtldCBMdGRcbkNvcHlyaWdodCAyMDE3IFZlY3RvciBDcmVhdGlvbnMgTHRkLlxuQ29weXJpZ2h0IDIwMTcsIDIwMTgsIDIwMTkgTmV3IFZlY3RvciBMdGRcbkNvcHlyaWdodCAyMDE5IC0gMjAyMyBUaGUgTWF0cml4Lm9yZyBGb3VuZGF0aW9uIEMuSS5DLlxuXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiovXG5cbmltcG9ydCB7IElDcmVhdGVDbGllbnRPcHRzLCBQZW5kaW5nRXZlbnRPcmRlcmluZywgUm9vbU5hbWVTdGF0ZSwgUm9vbU5hbWVUeXBlIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL21hdHJpeFwiO1xuaW1wb3J0IHsgSVN0YXJ0Q2xpZW50T3B0cywgTWF0cml4Q2xpZW50IH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL2NsaWVudFwiO1xuaW1wb3J0IHsgTWVtb3J5U3RvcmUgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvc3RvcmUvbWVtb3J5XCI7XG5pbXBvcnQgKiBhcyB1dGlscyBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvdXRpbHNcIjtcbmltcG9ydCB7IEV2ZW50VGltZWxpbmUgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbW9kZWxzL2V2ZW50LXRpbWVsaW5lXCI7XG5pbXBvcnQgeyBFdmVudFRpbWVsaW5lU2V0IH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL21vZGVscy9ldmVudC10aW1lbGluZS1zZXRcIjtcbmltcG9ydCB7IHZlcmlmaWNhdGlvbk1ldGhvZHMgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvY3J5cHRvXCI7XG5pbXBvcnQgeyBTSE9XX1FSX0NPREVfTUVUSE9EIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL2NyeXB0by92ZXJpZmljYXRpb24vUVJDb2RlXCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbG9nZ2VyXCI7XG5cbmltcG9ydCBjcmVhdGVNYXRyaXhDbGllbnQgZnJvbSBcIi4vdXRpbHMvY3JlYXRlTWF0cml4Q2xpZW50XCI7XG5pbXBvcnQgU2V0dGluZ3NTdG9yZSBmcm9tIFwiLi9zZXR0aW5ncy9TZXR0aW5nc1N0b3JlXCI7XG5pbXBvcnQgTWF0cml4QWN0aW9uQ3JlYXRvcnMgZnJvbSBcIi4vYWN0aW9ucy9NYXRyaXhBY3Rpb25DcmVhdG9yc1wiO1xuaW1wb3J0IE1vZGFsIGZyb20gXCIuL01vZGFsXCI7XG5pbXBvcnQgTWF0cml4Q2xpZW50QmFja2VkU2V0dGluZ3NIYW5kbGVyIGZyb20gXCIuL3NldHRpbmdzL2hhbmRsZXJzL01hdHJpeENsaWVudEJhY2tlZFNldHRpbmdzSGFuZGxlclwiO1xuaW1wb3J0ICogYXMgU3RvcmFnZU1hbmFnZXIgZnJvbSBcIi4vdXRpbHMvU3RvcmFnZU1hbmFnZXJcIjtcbmltcG9ydCBJZGVudGl0eUF1dGhDbGllbnQgZnJvbSBcIi4vSWRlbnRpdHlBdXRoQ2xpZW50XCI7XG5pbXBvcnQgeyBjcm9zc1NpZ25pbmdDYWxsYmFja3MsIHRyeVRvVW5sb2NrU2VjcmV0U3RvcmFnZVdpdGhEZWh5ZHJhdGlvbktleSB9IGZyb20gXCIuL1NlY3VyaXR5TWFuYWdlclwiO1xuaW1wb3J0IFNlY3VyaXR5Q3VzdG9taXNhdGlvbnMgZnJvbSBcIi4vY3VzdG9taXNhdGlvbnMvU2VjdXJpdHlcIjtcbmltcG9ydCB7IFNsaWRpbmdTeW5jTWFuYWdlciB9IGZyb20gXCIuL1NsaWRpbmdTeW5jTWFuYWdlclwiO1xuaW1wb3J0IENyeXB0b1N0b3JlVG9vTmV3RGlhbG9nIGZyb20gXCIuL2NvbXBvbmVudHMvdmlld3MvZGlhbG9ncy9DcnlwdG9TdG9yZVRvb05ld0RpYWxvZ1wiO1xuaW1wb3J0IHsgX3QsIFVzZXJGcmllbmRseUVycm9yIH0gZnJvbSBcIi4vbGFuZ3VhZ2VIYW5kbGVyXCI7XG5pbXBvcnQgeyBTZXR0aW5nTGV2ZWwgfSBmcm9tIFwiLi9zZXR0aW5ncy9TZXR0aW5nTGV2ZWxcIjtcbmltcG9ydCBNYXRyaXhDbGllbnRCYWNrZWRDb250cm9sbGVyIGZyb20gXCIuL3NldHRpbmdzL2NvbnRyb2xsZXJzL01hdHJpeENsaWVudEJhY2tlZENvbnRyb2xsZXJcIjtcbmltcG9ydCBFcnJvckRpYWxvZyBmcm9tIFwiLi9jb21wb25lbnRzL3ZpZXdzL2RpYWxvZ3MvRXJyb3JEaWFsb2dcIjtcbmltcG9ydCBQbGF0Zm9ybVBlZyBmcm9tIFwiLi9QbGF0Zm9ybVBlZ1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIElNYXRyaXhDbGllbnRDcmVkcyB7XG4gICAgaG9tZXNlcnZlclVybDogc3RyaW5nO1xuICAgIGlkZW50aXR5U2VydmVyVXJsPzogc3RyaW5nO1xuICAgIHVzZXJJZDogc3RyaW5nO1xuICAgIGRldmljZUlkPzogc3RyaW5nO1xuICAgIGFjY2Vzc1Rva2VuPzogc3RyaW5nO1xuICAgIGd1ZXN0PzogYm9vbGVhbjtcbiAgICBwaWNrbGVLZXk/OiBzdHJpbmc7XG4gICAgZnJlc2hMb2dpbj86IGJvb2xlYW47XG59XG5cbi8qKlxuICogSG9sZHMgdGhlIGN1cnJlbnQgaW5zdGFuY2Ugb2YgdGhlIGBNYXRyaXhDbGllbnRgIHRvIHVzZSBhY3Jvc3MgdGhlIGNvZGViYXNlLlxuICogTG9va2luZyBmb3IgYW4gYE1hdHJpeENsaWVudGA/IEp1c3QgbG9vayBmb3IgdGhlIGBNYXRyaXhDbGllbnRQZWdgIG9uIHRoZSBwZWdcbiAqIGJvYXJkLiBcIlBlZ1wiIGlzIHRoZSBsaXRlcmFsIG1lYW5pbmcgb2Ygc29tZXRoaW5nIHlvdSBoYW5nIHNvbWV0aGluZyBvbi4gU29cbiAqIHlvdSdsbCBmaW5kIGEgYE1hdHJpeENsaWVudGAgaGFuZ2luZyBvbiB0aGUgYE1hdHJpeENsaWVudFBlZ2AuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSU1hdHJpeENsaWVudFBlZyB7XG4gICAgb3B0czogSVN0YXJ0Q2xpZW50T3B0cztcblxuICAgIC8qKlxuICAgICAqIFJldHVybiB0aGUgc2VydmVyIG5hbWUgb2YgdGhlIHVzZXIncyBob21lc2VydmVyXG4gICAgICogVGhyb3dzIGFuIGVycm9yIGlmIHVuYWJsZSB0byBkZWR1Y2UgdGhlIGhvbWVzZXJ2ZXIgbmFtZVxuICAgICAqIChlZy4gaWYgdGhlIHVzZXIgaXMgbm90IGxvZ2dlZCBpbilcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBob21lc2VydmVyIG5hbWUsIGlmIHByZXNlbnQuXG4gICAgICovXG4gICAgZ2V0SG9tZXNlcnZlck5hbWUoKTogc3RyaW5nIHwgbnVsbDtcblxuICAgIGdldCgpOiBNYXRyaXhDbGllbnQ7XG4gICAgc2FmZUdldCgpOiBNYXRyaXhDbGllbnQ7XG4gICAgdW5zZXQoKTogdm9pZDtcbiAgICBhc3NpZ24oKTogUHJvbWlzZTxhbnk+O1xuICAgIHN0YXJ0KCk6IFByb21pc2U8YW55PjtcblxuICAgIGdldENyZWRlbnRpYWxzKCk6IElNYXRyaXhDbGllbnRDcmVkcztcblxuICAgIC8qKlxuICAgICAqIElmIHdlJ3ZlIHJlZ2lzdGVyZWQgYSB1c2VyIElEIHdlIHNldCB0aGlzIHRvIHRoZSBJRCBvZiB0aGVcbiAgICAgKiB1c2VyIHdlJ3ZlIGp1c3QgcmVnaXN0ZXJlZC4gSWYgdGhleSB0aGVuIGdvICYgbG9nIGluLCB3ZVxuICAgICAqIGNhbiBzZW5kIHRoZW0gdG8gdGhlIHdlbGNvbWUgdXNlciAob2J2aW91c2x5IHRoaXMgZG9lc24ndFxuICAgICAqIGd1YXJhbnRlZSB0aGV5J2xsIGdldCBhIGNoYXQgd2l0aCB0aGUgd2VsY29tZSB1c2VyKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1aWQgVGhlIHVzZXIgSUQgb2YgdGhlIHVzZXIgd2UndmUganVzdCByZWdpc3RlcmVkXG4gICAgICovXG4gICAgc2V0SnVzdFJlZ2lzdGVyZWRVc2VySWQodWlkOiBzdHJpbmcgfCBudWxsKTogdm9pZDtcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgY3VycmVudCB1c2VyIGhhcyBqdXN0IGJlZW4gcmVnaXN0ZXJlZCBieSB0aGlzXG4gICAgICogY2xpZW50IGFzIGRldGVybWluZWQgYnkgc2V0SnVzdFJlZ2lzdGVyZWRVc2VySWQoKVxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2x9IFRydWUgaWYgdXNlciBoYXMganVzdCBiZWVuIHJlZ2lzdGVyZWRcbiAgICAgKi9cbiAgICBjdXJyZW50VXNlcklzSnVzdFJlZ2lzdGVyZWQoKTogYm9vbGVhbjtcblxuICAgIC8qKlxuICAgICAqIElmIHRoZSBjdXJyZW50IHVzZXIgaGFzIGJlZW4gcmVnaXN0ZXJlZCBieSB0aGlzIGRldmljZSB0aGVuIHRoaXNcbiAgICAgKiByZXR1cm5zIGEgYm9vbGVhbiBvZiB3aGV0aGVyIGl0IHdhcyB3aXRoaW4gdGhlIGxhc3QgTiBob3VycyBnaXZlbi5cbiAgICAgKi9cbiAgICB1c2VyUmVnaXN0ZXJlZFdpdGhpbkxhc3RIb3Vycyhob3VyczogbnVtYmVyKTogYm9vbGVhbjtcblxuICAgIC8qKlxuICAgICAqIElmIHRoZSBjdXJyZW50IHVzZXIgaGFzIGJlZW4gcmVnaXN0ZXJlZCBieSB0aGlzIGRldmljZSB0aGVuIHRoaXNcbiAgICAgKiByZXR1cm5zIGEgYm9vbGVhbiBvZiB3aGV0aGVyIGl0IHdhcyBhZnRlciBhIGdpdmVuIHRpbWVzdGFtcC5cbiAgICAgKi9cbiAgICB1c2VyUmVnaXN0ZXJlZEFmdGVyKGRhdGU6IERhdGUpOiBib29sZWFuO1xuXG4gICAgLyoqXG4gICAgICogUmVwbGFjZSB0aGlzIE1hdHJpeENsaWVudFBlZydzIGNsaWVudCB3aXRoIGEgY2xpZW50IGluc3RhbmNlIHRoYXQgaGFzXG4gICAgICogaG9tZXNlcnZlciAvIGlkZW50aXR5IHNlcnZlciBVUkxzIGFuZCBhY3RpdmUgY3JlZGVudGlhbHNcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7SU1hdHJpeENsaWVudENyZWRzfSBjcmVkcyBUaGUgbmV3IGNyZWRlbnRpYWxzIHRvIHVzZS5cbiAgICAgKi9cbiAgICByZXBsYWNlVXNpbmdDcmVkcyhjcmVkczogSU1hdHJpeENsaWVudENyZWRzKTogdm9pZDtcbn1cblxuLyoqXG4gKiBXcmFwcGVyIG9iamVjdCBmb3IgaGFuZGxpbmcgdGhlIGpzLXNkayBNYXRyaXggQ2xpZW50IG9iamVjdCBpbiB0aGUgcmVhY3Qtc2RrXG4gKiBIYW5kbGVzIHRoZSBjcmVhdGlvbi9pbml0aWFsaXNhdGlvbiBvZiBjbGllbnQgb2JqZWN0cy5cbiAqIFRoaXMgbW9kdWxlIHByb3ZpZGVzIGEgc2luZ2xldG9uIGluc3RhbmNlIG9mIHRoaXMgY2xhc3Mgc28gdGhlICdjdXJyZW50J1xuICogTWF0cml4IENsaWVudCBvYmplY3QgaXMgYXZhaWxhYmxlIGVhc2lseS5cbiAqL1xuY2xhc3MgTWF0cml4Q2xpZW50UGVnQ2xhc3MgaW1wbGVtZW50cyBJTWF0cml4Q2xpZW50UGVnIHtcbiAgICAvLyBUaGVzZSBhcmUgdGhlIGRlZmF1bHQgb3B0aW9ucyB1c2VkIHdoZW4gd2hlbiB0aGVcbiAgICAvLyBjbGllbnQgaXMgc3RhcnRlZCBpbiAnc3RhcnQnLiBUaGVzZSBjYW4gYmUgYWx0ZXJlZFxuICAgIC8vIGF0IGFueSB0aW1lIHVwIHRvIGFmdGVyIHRoZSAnd2lsbF9zdGFydF9jbGllbnQnXG4gICAgLy8gZXZlbnQgaXMgZmluaXNoZWQgcHJvY2Vzc2luZy5cbiAgICBwdWJsaWMgb3B0czogSVN0YXJ0Q2xpZW50T3B0cyA9IHtcbiAgICAgICAgaW5pdGlhbFN5bmNMaW1pdDogMjAsXG4gICAgfTtcblxuICAgIHByaXZhdGUgbWF0cml4Q2xpZW50OiBNYXRyaXhDbGllbnQgfCBudWxsID0gbnVsbDtcbiAgICBwcml2YXRlIGp1c3RSZWdpc3RlcmVkVXNlcklkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuICAgIC8vIHRoZSBjcmVkZW50aWFscyB1c2VkIHRvIGluaXQgdGhlIGN1cnJlbnQgY2xpZW50IG9iamVjdC5cbiAgICAvLyB1c2VkIGlmIHdlIHRlYXIgaXQgZG93biAmIHJlY3JlYXRlIGl0IHdpdGggYSBkaWZmZXJlbnQgc3RvcmVcbiAgICBwcml2YXRlIGN1cnJlbnRDbGllbnRDcmVkczogSU1hdHJpeENsaWVudENyZWRzIHwgbnVsbCA9IG51bGw7XG5cbiAgICBwdWJsaWMgZ2V0KCk6IE1hdHJpeENsaWVudCB7XG4gICAgICAgIHJldHVybiB0aGlzLm1hdHJpeENsaWVudDtcbiAgICB9XG5cbiAgICBwdWJsaWMgc2FmZUdldCgpOiBNYXRyaXhDbGllbnQge1xuICAgICAgICBpZiAoIXRoaXMubWF0cml4Q2xpZW50KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgVXNlckZyaWVuZGx5RXJyb3IoXCJVc2VyIGlzIG5vdCBsb2dnZWQgaW5cIik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMubWF0cml4Q2xpZW50O1xuICAgIH1cblxuICAgIHB1YmxpYyB1bnNldCgpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5tYXRyaXhDbGllbnQgPSBudWxsO1xuXG4gICAgICAgIE1hdHJpeEFjdGlvbkNyZWF0b3JzLnN0b3AoKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc2V0SnVzdFJlZ2lzdGVyZWRVc2VySWQodWlkOiBzdHJpbmcgfCBudWxsKTogdm9pZCB7XG4gICAgICAgIHRoaXMuanVzdFJlZ2lzdGVyZWRVc2VySWQgPSB1aWQ7XG4gICAgICAgIGlmICh1aWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHJlZ2lzdHJhdGlvblRpbWUgPSBEYXRlLm5vdygpLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICB3aW5kb3cubG9jYWxTdG9yYWdlLnNldEl0ZW0oXCJteF9yZWdpc3RyYXRpb25fdGltZVwiLCByZWdpc3RyYXRpb25UaW1lKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBjdXJyZW50VXNlcklzSnVzdFJlZ2lzdGVyZWQoKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiAhIXRoaXMubWF0cml4Q2xpZW50ICYmIHRoaXMubWF0cml4Q2xpZW50LmNyZWRlbnRpYWxzLnVzZXJJZCA9PT0gdGhpcy5qdXN0UmVnaXN0ZXJlZFVzZXJJZDtcbiAgICB9XG5cbiAgICBwdWJsaWMgdXNlclJlZ2lzdGVyZWRXaXRoaW5MYXN0SG91cnMoaG91cnM6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoaG91cnMgPD0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlZ2lzdHJhdGlvblRpbWUgPSBwYXJzZUludCh3aW5kb3cubG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJteF9yZWdpc3RyYXRpb25fdGltZVwiKSEsIDEwKTtcbiAgICAgICAgICAgIGNvbnN0IGRpZmYgPSBEYXRlLm5vdygpIC0gcmVnaXN0cmF0aW9uVGltZTtcbiAgICAgICAgICAgIHJldHVybiBkaWZmIC8gMzZlNSA8PSBob3VycztcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIHVzZXJSZWdpc3RlcmVkQWZ0ZXIodGltZXN0YW1wOiBEYXRlKTogYm9vbGVhbiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZWdpc3RyYXRpb25UaW1lID0gcGFyc2VJbnQod2luZG93LmxvY2FsU3RvcmFnZS5nZXRJdGVtKFwibXhfcmVnaXN0cmF0aW9uX3RpbWVcIikhLCAxMCk7XG4gICAgICAgICAgICByZXR1cm4gdGltZXN0YW1wLmdldFRpbWUoKSA8PSByZWdpc3RyYXRpb25UaW1lO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgcmVwbGFjZVVzaW5nQ3JlZHMoY3JlZHM6IElNYXRyaXhDbGllbnRDcmVkcyk6IHZvaWQge1xuICAgICAgICB0aGlzLmN1cnJlbnRDbGllbnRDcmVkcyA9IGNyZWRzO1xuICAgICAgICB0aGlzLmNyZWF0ZUNsaWVudChjcmVkcyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBvblVuZXhwZWN0ZWRTdG9yZUNsb3NlID0gYXN5bmMgKCk6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgICAgICBpZiAoIXRoaXMubWF0cml4Q2xpZW50KSByZXR1cm47XG4gICAgICAgIHRoaXMubWF0cml4Q2xpZW50LnN0b3BDbGllbnQoKTsgLy8gc3RvcCB0aGUgY2xpZW50IGFzIHRoZSBkYXRhYmFzZSBoYXMgZmFpbGVkXG4gICAgICAgIHRoaXMubWF0cml4Q2xpZW50LnN0b3JlLmRlc3Ryb3koKTtcblxuICAgICAgICBpZiAoIXRoaXMubWF0cml4Q2xpZW50LmlzR3Vlc3QoKSkge1xuICAgICAgICAgICAgLy8gSWYgdGhlIHVzZXIgaXMgbm90IGEgZ3Vlc3QgdGhlbiBwcm9tcHQgdGhlbSB0byByZWxvYWQgcmF0aGVyIHRoYW4gZG9pbmcgaXQgZm9yIHRoZW1cbiAgICAgICAgICAgIC8vIEZvciBndWVzdHMgdGhpcyBpcyBsaWtlbHkgdG8gaGFwcGVuIGR1cmluZyBlLW1haWwgdmVyaWZpY2F0aW9uIGFzIHBhcnQgb2YgcmVnaXN0cmF0aW9uXG5cbiAgICAgICAgICAgIGNvbnN0IHsgZmluaXNoZWQgfSA9IE1vZGFsLmNyZWF0ZURpYWxvZyhFcnJvckRpYWxvZywge1xuICAgICAgICAgICAgICAgIHRpdGxlOiBfdChcIkRhdGFiYXNlIHVuZXhwZWN0ZWRseSBjbG9zZWRcIiksXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IF90KFxuICAgICAgICAgICAgICAgICAgICBcIlRoaXMgbWF5IGJlIGNhdXNlZCBieSBoYXZpbmcgdGhlIGFwcCBvcGVuIGluIG11bHRpcGxlIHRhYnMgb3IgZHVlIHRvIGNsZWFyaW5nIGJyb3dzZXIgZGF0YS5cIixcbiAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgIGJ1dHRvbjogX3QoXCJSZWxvYWRcIiksXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IFtyZWxvYWRdID0gYXdhaXQgZmluaXNoZWQ7XG4gICAgICAgICAgICBpZiAoIXJlbG9hZCkgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgUGxhdGZvcm1QZWcuZ2V0KCk/LnJlbG9hZCgpO1xuICAgIH07XG5cbiAgICBwdWJsaWMgYXN5bmMgYXNzaWduKCk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGlmICghdGhpcy5tYXRyaXhDbGllbnQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImNyZWF0ZUNsaWVudCBtdXN0IGJlIGNhbGxlZCBmaXJzdFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoY29uc3QgZGJUeXBlIG9mIFtcImluZGV4ZWRkYlwiLCBcIm1lbW9yeVwiXSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBwcm9taXNlID0gdGhpcy5tYXRyaXhDbGllbnQuc3RvcmUuc3RhcnR1cCgpO1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coXCJNYXRyaXhDbGllbnRQZWc6IHdhaXRpbmcgZm9yIE1hdHJpeENsaWVudCBzdG9yZSB0byBpbml0aWFsaXNlXCIpO1xuICAgICAgICAgICAgICAgIGF3YWl0IHByb21pc2U7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAoZGJUeXBlID09PSBcImluZGV4ZWRkYlwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZ2dlci5lcnJvcihcIkVycm9yIHN0YXJ0aW5nIG1hdHJpeGNsaWVudCBzdG9yZSAtIGZhbGxpbmcgYmFjayB0byBtZW1vcnkgc3RvcmVcIiwgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tYXRyaXhDbGllbnQuc3RvcmUgPSBuZXcgTWVtb3J5U3RvcmUoe1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9jYWxTdG9yYWdlOiBsb2NhbFN0b3JhZ2UsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZ2dlci5lcnJvcihcIkZhaWxlZCB0byBzdGFydCBtZW1vcnkgc3RvcmUhXCIsIGVycik7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5tYXRyaXhDbGllbnQuc3RvcmUub24/LihcImNsb3NlZFwiLCB0aGlzLm9uVW5leHBlY3RlZFN0b3JlQ2xvc2UpO1xuXG4gICAgICAgIC8vIHRyeSB0byBpbml0aWFsaXNlIGUyZSBvbiB0aGUgbmV3IGNsaWVudFxuICAgICAgICBpZiAoIVNldHRpbmdzU3RvcmUuZ2V0VmFsdWUoXCJsb3dCYW5kd2lkdGhcIikpIHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuaW5pdENsaWVudENyeXB0bygpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgb3B0cyA9IHV0aWxzLmRlZXBDb3B5KHRoaXMub3B0cyk7XG4gICAgICAgIC8vIHRoZSByZWFjdCBzZGsgZG9lc24ndCB3b3JrIHdpdGhvdXQgdGhpcywgc28gZG9uJ3QgYWxsb3dcbiAgICAgICAgb3B0cy5wZW5kaW5nRXZlbnRPcmRlcmluZyA9IFBlbmRpbmdFdmVudE9yZGVyaW5nLkRldGFjaGVkO1xuICAgICAgICBvcHRzLmxhenlMb2FkTWVtYmVycyA9IHRydWU7XG4gICAgICAgIG9wdHMuY2xpZW50V2VsbEtub3duUG9sbFBlcmlvZCA9IDIgKiA2MCAqIDYwOyAvLyAyIGhvdXJzXG4gICAgICAgIG9wdHMudGhyZWFkU3VwcG9ydCA9IHRydWU7XG5cbiAgICAgICAgaWYgKFNldHRpbmdzU3RvcmUuZ2V0VmFsdWUoXCJmZWF0dXJlX3NsaWRpbmdfc3luY1wiKSkge1xuICAgICAgICAgICAgY29uc3QgcHJveHlVcmwgPSBTZXR0aW5nc1N0b3JlLmdldFZhbHVlKFwiZmVhdHVyZV9zbGlkaW5nX3N5bmNfcHJveHlfdXJsXCIpO1xuICAgICAgICAgICAgaWYgKHByb3h5VXJsKSB7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhcIkFjdGl2YXRpbmcgc2xpZGluZyBzeW5jIHVzaW5nIHByb3h5IGF0IFwiLCBwcm94eVVybCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coXCJBY3RpdmF0aW5nIHNsaWRpbmcgc3luY1wiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG9wdHMuc2xpZGluZ1N5bmMgPSBTbGlkaW5nU3luY01hbmFnZXIuaW5zdGFuY2UuY29uZmlndXJlKFxuICAgICAgICAgICAgICAgIHRoaXMubWF0cml4Q2xpZW50LFxuICAgICAgICAgICAgICAgIHByb3h5VXJsIHx8IHRoaXMubWF0cml4Q2xpZW50LmJhc2VVcmwsXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgU2xpZGluZ1N5bmNNYW5hZ2VyLmluc3RhbmNlLnN0YXJ0U3BpZGVyaW5nKDEwMCwgNTApOyAvLyAxMDAgcm9vbXMgYXQgYSB0aW1lLCA1MG1zIGFwYXJ0XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDb25uZWN0IHRoZSBtYXRyaXggY2xpZW50IHRvIHRoZSBkaXNwYXRjaGVyIGFuZCBzZXR0aW5nIGhhbmRsZXJzXG4gICAgICAgIE1hdHJpeEFjdGlvbkNyZWF0b3JzLnN0YXJ0KHRoaXMubWF0cml4Q2xpZW50KTtcbiAgICAgICAgTWF0cml4Q2xpZW50QmFja2VkU2V0dGluZ3NIYW5kbGVyLm1hdHJpeENsaWVudCA9IHRoaXMubWF0cml4Q2xpZW50O1xuICAgICAgICBNYXRyaXhDbGllbnRCYWNrZWRDb250cm9sbGVyLm1hdHJpeENsaWVudCA9IHRoaXMubWF0cml4Q2xpZW50O1xuXG4gICAgICAgIHJldHVybiBvcHRzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEF0dGVtcHQgdG8gaW5pdGlhbGl6ZSB0aGUgY3J5cHRvIGxheWVyIG9uIGEgbmV3bHktY3JlYXRlZCBNYXRyaXhDbGllbnRcbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIGluaXRDbGllbnRDcnlwdG8oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGlmICghdGhpcy5tYXRyaXhDbGllbnQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImNyZWF0ZUNsaWVudCBtdXN0IGJlIGNhbGxlZCBmaXJzdFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHVzZVJ1c3RDcnlwdG8gPSBTZXR0aW5nc1N0b3JlLmdldFZhbHVlKFwiZmVhdHVyZV9ydXN0X2NyeXB0b1wiKTtcblxuICAgICAgICAvLyB3ZSB3YW50IHRvIG1ha2Ugc3VyZSB0aGF0IHRoZSBzYW1lIGNyeXB0byBpbXBsZW1lbnRhdGlvbiBpcyB1c2VkIHRocm91Z2hvdXQgdGhlIGxpZmV0aW1lIG9mIGEgZGV2aWNlLFxuICAgICAgICAvLyBzbyBwZXJzaXN0IHRoZSBzZXR0aW5nIGF0IHRoZSBkZXZpY2UgbGF5ZXJcbiAgICAgICAgLy8gKEF0IHNvbWUgcG9pbnQsIHdlJ2xsIGFsbG93IHRoZSB1c2VyIHRvICplbmFibGUqIHRoZSBzZXR0aW5nIHZpYSBsYWJzLCB3aGljaCB3aWxsIG1pZ3JhdGUgdGhlaXIgZXhpc3RpbmdcbiAgICAgICAgLy8gZGV2aWNlIHRvIHRoZSBydXN0LXNkayBpbXBsZW1lbnRhdGlvbiwgYnV0IHRoYXQgd29uJ3QgY2hhbmdlIGFueXRoaW5nIGhlcmUpLlxuICAgICAgICBhd2FpdCBTZXR0aW5nc1N0b3JlLnNldFZhbHVlKFwiZmVhdHVyZV9ydXN0X2NyeXB0b1wiLCBudWxsLCBTZXR0aW5nTGV2ZWwuREVWSUNFLCB1c2VSdXN0Q3J5cHRvKTtcblxuICAgICAgICAvLyBOb3cgd2UgY2FuIGluaXRpYWxpc2UgdGhlIHJpZ2h0IGNyeXB0byBpbXBsLlxuICAgICAgICBpZiAodXNlUnVzdENyeXB0bykge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5tYXRyaXhDbGllbnQuaW5pdFJ1c3RDcnlwdG8oKTtcblxuICAgICAgICAgICAgLy8gVE9ETzogZGV2aWNlIGRlaHlkcmF0aW9uIGFuZCB3aGF0aGF2ZXlvdVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZmFsbCBiYWNrIHRvIHRoZSBsaWJvbG0gbGF5ZXIuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBjaGVjayB0aGF0IHdlIGhhdmUgYSB2ZXJzaW9uIG9mIHRoZSBqcy1zZGsgd2hpY2ggaW5jbHVkZXMgaW5pdENyeXB0b1xuICAgICAgICAgICAgaWYgKHRoaXMubWF0cml4Q2xpZW50LmluaXRDcnlwdG8pIHtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLm1hdHJpeENsaWVudC5pbml0Q3J5cHRvKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5tYXRyaXhDbGllbnQuc2V0Q3J5cHRvVHJ1c3RDcm9zc1NpZ25lZERldmljZXMoXG4gICAgICAgICAgICAgICAgICAgICFTZXR0aW5nc1N0b3JlLmdldFZhbHVlKFwiZTJlZS5tYW51YWxseVZlcmlmeUFsbFNlc3Npb25zXCIpLFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgYXdhaXQgdHJ5VG9VbmxvY2tTZWNyZXRTdG9yYWdlV2l0aERlaHlkcmF0aW9uS2V5KHRoaXMubWF0cml4Q2xpZW50KTtcbiAgICAgICAgICAgICAgICBTdG9yYWdlTWFuYWdlci5zZXRDcnlwdG9Jbml0aWFsaXNlZCh0cnVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgaWYgKGUgaW5zdGFuY2VvZiBFcnJvciAmJiBlLm5hbWUgPT09IFwiSW52YWxpZENyeXB0b1N0b3JlRXJyb3JcIikge1xuICAgICAgICAgICAgICAgIC8vIFRoZSBqcy1zZGsgZm91bmQgYSBjcnlwdG8gREIgdG9vIG5ldyBmb3IgaXQgdG8gdXNlXG4gICAgICAgICAgICAgICAgTW9kYWwuY3JlYXRlRGlhbG9nKENyeXB0b1N0b3JlVG9vTmV3RGlhbG9nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHRoaXMgY2FuIGhhcHBlbiBmb3IgYSBudW1iZXIgb2YgcmVhc29ucywgdGhlIG1vc3QgbGlrZWx5IGJlaW5nXG4gICAgICAgICAgICAvLyB0aGF0IHRoZSBvbG0gbGlicmFyeSB3YXMgbWlzc2luZy4gSXQncyBub3QgZmF0YWwuXG4gICAgICAgICAgICBsb2dnZXIud2FybihcIlVuYWJsZSB0byBpbml0aWFsaXNlIGUyZVwiLCBlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBzdGFydCgpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCBvcHRzID0gYXdhaXQgdGhpcy5hc3NpZ24oKTtcblxuICAgICAgICBsb2dnZXIubG9nKGBNYXRyaXhDbGllbnRQZWc6IHJlYWxseSBzdGFydGluZyBNYXRyaXhDbGllbnRgKTtcbiAgICAgICAgYXdhaXQgdGhpcy5tYXRyaXhDbGllbnQhLnN0YXJ0Q2xpZW50KG9wdHMpO1xuICAgICAgICBsb2dnZXIubG9nKGBNYXRyaXhDbGllbnRQZWc6IE1hdHJpeENsaWVudCBzdGFydGVkYCk7XG4gICAgfVxuXG4gICAgcHVibGljIGdldENyZWRlbnRpYWxzKCk6IElNYXRyaXhDbGllbnRDcmVkcyB7XG4gICAgICAgIGlmICghdGhpcy5tYXRyaXhDbGllbnQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImNyZWF0ZUNsaWVudCBtdXN0IGJlIGNhbGxlZCBmaXJzdFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBjb3BpZWRDcmVkZW50aWFsczogSU1hdHJpeENsaWVudENyZWRzIHwgbnVsbCA9IHRoaXMuY3VycmVudENsaWVudENyZWRzO1xuICAgICAgICBpZiAodGhpcy5jdXJyZW50Q2xpZW50Q3JlZHM/LnVzZXJJZCAhPT0gdGhpcy5tYXRyaXhDbGllbnQ/LmNyZWRlbnRpYWxzPy51c2VySWQpIHtcbiAgICAgICAgICAgIC8vIGNhY2hlZCBjcmVkZW50aWFscyBiZWxvbmcgdG8gYSBkaWZmZXJlbnQgdXNlciAtIGRvbid0IHVzZSB0aGVtXG4gICAgICAgICAgICBjb3BpZWRDcmVkZW50aWFscyA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC8vIENvcHkgdGhlIGNhY2hlZCBjcmVkZW50aWFscyBiZWZvcmUgb3ZlcnJpZGluZyB3aGF0IHdlIGNhbi5cbiAgICAgICAgICAgIC4uLihjb3BpZWRDcmVkZW50aWFscyA/PyB7fSksXG5cbiAgICAgICAgICAgIGhvbWVzZXJ2ZXJVcmw6IHRoaXMubWF0cml4Q2xpZW50LmJhc2VVcmwsXG4gICAgICAgICAgICBpZGVudGl0eVNlcnZlclVybDogdGhpcy5tYXRyaXhDbGllbnQuaWRCYXNlVXJsLFxuICAgICAgICAgICAgdXNlcklkOiB0aGlzLm1hdHJpeENsaWVudC5nZXRTYWZlVXNlcklkKCksXG4gICAgICAgICAgICBkZXZpY2VJZDogdGhpcy5tYXRyaXhDbGllbnQuZ2V0RGV2aWNlSWQoKSA/PyB1bmRlZmluZWQsXG4gICAgICAgICAgICBhY2Nlc3NUb2tlbjogdGhpcy5tYXRyaXhDbGllbnQuZ2V0QWNjZXNzVG9rZW4oKSA/PyB1bmRlZmluZWQsXG4gICAgICAgICAgICBndWVzdDogdGhpcy5tYXRyaXhDbGllbnQuaXNHdWVzdCgpLFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXRIb21lc2VydmVyTmFtZSgpOiBzdHJpbmcgfCBudWxsIHtcbiAgICAgICAgaWYgKCF0aGlzLm1hdHJpeENsaWVudCkgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgY29uc3QgbWF0Y2hlcyA9IC9eQFteOl0rOiguKykkLy5leGVjKHRoaXMubWF0cml4Q2xpZW50LmdldFNhZmVVc2VySWQoKSk7XG4gICAgICAgIGlmIChtYXRjaGVzID09PSBudWxsIHx8IG1hdGNoZXMubGVuZ3RoIDwgMSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRmFpbGVkIHRvIGRlcml2ZSBob21lc2VydmVyIG5hbWUgZnJvbSB1c2VyIElEIVwiKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWF0Y2hlc1sxXTtcbiAgICB9XG5cbiAgICBwcml2YXRlIG5hbWVzVG9Sb29tTmFtZShuYW1lczogc3RyaW5nW10sIGNvdW50OiBudW1iZXIpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAgICAgICBjb25zdCBjb3VudFdpdGhvdXRNZSA9IGNvdW50IC0gMTtcbiAgICAgICAgaWYgKCFuYW1lcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVybiBfdChcIkVtcHR5IHJvb21cIik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG5hbWVzLmxlbmd0aCA9PT0gMSAmJiBjb3VudFdpdGhvdXRNZSA8PSAxKSB7XG4gICAgICAgICAgICByZXR1cm4gbmFtZXNbMF07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIG1lbWJlck5hbWVzVG9Sb29tTmFtZShuYW1lczogc3RyaW5nW10sIGNvdW50OiBudW1iZXIpOiBzdHJpbmcge1xuICAgICAgICBjb25zdCBuYW1lID0gdGhpcy5uYW1lc1RvUm9vbU5hbWUobmFtZXMsIGNvdW50KTtcbiAgICAgICAgaWYgKG5hbWUpIHJldHVybiBuYW1lO1xuXG4gICAgICAgIGlmIChuYW1lcy5sZW5ndGggPT09IDIgJiYgY291bnQgPT09IDIpIHtcbiAgICAgICAgICAgIHJldHVybiBfdChcIiUodXNlcjEpcyBhbmQgJSh1c2VyMilzXCIsIHtcbiAgICAgICAgICAgICAgICB1c2VyMTogbmFtZXNbMF0sXG4gICAgICAgICAgICAgICAgdXNlcjI6IG5hbWVzWzFdLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIF90KFwiJSh1c2VyKXMgYW5kICUoY291bnQpcyBvdGhlcnNcIiwge1xuICAgICAgICAgICAgdXNlcjogbmFtZXNbMF0sXG4gICAgICAgICAgICBjb3VudDogY291bnQgLSAxLFxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGludml0ZWVOYW1lc1RvUm9vbU5hbWUobmFtZXM6IHN0cmluZ1tdLCBjb3VudDogbnVtYmVyKTogc3RyaW5nIHtcbiAgICAgICAgY29uc3QgbmFtZSA9IHRoaXMubmFtZXNUb1Jvb21OYW1lKG5hbWVzLCBjb3VudCk7XG4gICAgICAgIGlmIChuYW1lKSByZXR1cm4gbmFtZTtcblxuICAgICAgICBpZiAobmFtZXMubGVuZ3RoID09PSAyICYmIGNvdW50ID09PSAyKSB7XG4gICAgICAgICAgICByZXR1cm4gX3QoXCJJbnZpdGluZyAlKHVzZXIxKXMgYW5kICUodXNlcjIpc1wiLCB7XG4gICAgICAgICAgICAgICAgdXNlcjE6IG5hbWVzWzBdLFxuICAgICAgICAgICAgICAgIHVzZXIyOiBuYW1lc1sxXSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBfdChcIkludml0aW5nICUodXNlcilzIGFuZCAlKGNvdW50KXMgb3RoZXJzXCIsIHtcbiAgICAgICAgICAgIHVzZXI6IG5hbWVzWzBdLFxuICAgICAgICAgICAgY291bnQ6IGNvdW50IC0gMSxcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBjcmVhdGVDbGllbnQoY3JlZHM6IElNYXRyaXhDbGllbnRDcmVkcyk6IHZvaWQge1xuICAgICAgICBjb25zb2xlLmxvZyhcIvCflLfwn5S38J+UtyA9PT09PT09PT09IENSRUFURSBNQVRSSVggQ0xJRU5UID09PT09PT09PT0g8J+Ut/CflLfwn5S3XCIpO1xuICAgICAgICBjb25zb2xlLmxvZyhcIvCflLcgQ3JlZGVudGlhbHMgcmVjZWl2ZWQ6XCIpO1xuICAgICAgICBjb25zb2xlLmxvZyhcIvCflLcgICAtIGhvbWVzZXJ2ZXJVcmw6XCIsIGNyZWRzLmhvbWVzZXJ2ZXJVcmwpO1xuICAgICAgICBjb25zb2xlLmxvZyhcIvCflLcgICAtIGlkZW50aXR5U2VydmVyVXJsOlwiLCBjcmVkcy5pZGVudGl0eVNlcnZlclVybCk7XG4gICAgICAgIGNvbnNvbGUubG9nKFwi8J+UtyAgIC0gdXNlcklkOlwiLCBjcmVkcy51c2VySWQpO1xuICAgICAgICBjb25zb2xlLmxvZyhcIvCflLcgICAtIGRldmljZUlkOlwiLCBjcmVkcy5kZXZpY2VJZCk7XG4gICAgICAgIGNvbnNvbGUubG9nKFwi8J+UtyAgIC0gYWNjZXNzVG9rZW4gKGZpcnN0IDIwKTpcIiwgY3JlZHMuYWNjZXNzVG9rZW4/LnN1YnN0cmluZygwLCAyMCkpO1xuICAgICAgICBjb25zb2xlLmxvZyhcIvCflLcgQ3JlYXRpbmcgY2xpZW50IHdpdGggYmFzZVVybDpcIiwgY3JlZHMuaG9tZXNlcnZlclVybCk7XG4gICAgICAgIGNvbnNvbGUubG9nKFwi8J+Ut/CflLfwn5S3ID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0g8J+Ut/CflLfwn5S3XCIpO1xuICAgICAgICBcbiAgICAgICAgY29uc3Qgb3B0czogSUNyZWF0ZUNsaWVudE9wdHMgPSB7XG4gICAgICAgICAgICBiYXNlVXJsOiBjcmVkcy5ob21lc2VydmVyVXJsLFxuICAgICAgICAgICAgaWRCYXNlVXJsOiBjcmVkcy5pZGVudGl0eVNlcnZlclVybCxcbiAgICAgICAgICAgIGFjY2Vzc1Rva2VuOiBjcmVkcy5hY2Nlc3NUb2tlbixcbiAgICAgICAgICAgIHVzZXJJZDogY3JlZHMudXNlcklkLFxuICAgICAgICAgICAgZGV2aWNlSWQ6IGNyZWRzLmRldmljZUlkLFxuICAgICAgICAgICAgcGlja2xlS2V5OiBjcmVkcy5waWNrbGVLZXksXG4gICAgICAgICAgICB0aW1lbGluZVN1cHBvcnQ6IHRydWUsXG4gICAgICAgICAgICBmb3JjZVRVUk46ICFTZXR0aW5nc1N0b3JlLmdldFZhbHVlKFwid2ViUnRjQWxsb3dQZWVyVG9QZWVyXCIpLFxuICAgICAgICAgICAgZmFsbGJhY2tJQ0VTZXJ2ZXJBbGxvd2VkOiAhIVNldHRpbmdzU3RvcmUuZ2V0VmFsdWUoXCJmYWxsYmFja0lDRVNlcnZlckFsbG93ZWRcIiksXG4gICAgICAgICAgICAvLyBHYXRoZXIgdXAgdG8gMjAgSUNFIGNhbmRpZGF0ZXMgd2hlbiBhIGNhbGwgYXJyaXZlczogdGhpcyBzaG91bGQgYmUgbW9yZSB0aGFuIHdlJ2RcbiAgICAgICAgICAgIC8vIGV2ZXIgbm9ybWFsbHkgbmVlZCwgc28gZWZmZWN0aXZlbHkgdGhpcyBzaG91bGQgbWFrZSBhbGwgdGhlIGdhdGhlcmluZyBoYXBwZW4gd2hlblxuICAgICAgICAgICAgLy8gdGhlIGNhbGwgYXJyaXZlcy5cbiAgICAgICAgICAgIGljZUNhbmRpZGF0ZVBvb2xTaXplOiAyMCxcbiAgICAgICAgICAgIHZlcmlmaWNhdGlvbk1ldGhvZHM6IFtcbiAgICAgICAgICAgICAgICB2ZXJpZmljYXRpb25NZXRob2RzLlNBUyxcbiAgICAgICAgICAgICAgICBTSE9XX1FSX0NPREVfTUVUSE9ELFxuICAgICAgICAgICAgICAgIHZlcmlmaWNhdGlvbk1ldGhvZHMuUkVDSVBST0NBVEVfUVJfQ09ERSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBpZGVudGl0eVNlcnZlcjogbmV3IElkZW50aXR5QXV0aENsaWVudCgpLFxuICAgICAgICAgICAgLy8gVGhlc2UgYXJlIGFsd2F5cyBpbnN0YWxsZWQgcmVnYXJkbGVzcyBvZiB0aGUgbGFicyBmbGFnIHNvIHRoYXQgY3Jvc3Mtc2lnbmluZyBmZWF0dXJlc1xuICAgICAgICAgICAgLy8gY2FuIHRvZ2dsZSBvbiB3aXRob3V0IHJlbG9hZGluZyBhbmQgYWxzbyBiZSBhY2Nlc3NlZCBpbW1lZGlhdGVseSBhZnRlciBsb2dpbi5cbiAgICAgICAgICAgIGNyeXB0b0NhbGxiYWNrczogeyAuLi5jcm9zc1NpZ25pbmdDYWxsYmFja3MgfSxcbiAgICAgICAgICAgIHJvb21OYW1lR2VuZXJhdG9yOiAoXzogc3RyaW5nLCBzdGF0ZTogUm9vbU5hbWVTdGF0ZSkgPT4ge1xuICAgICAgICAgICAgICAgIHN3aXRjaCAoc3RhdGUudHlwZSkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFJvb21OYW1lVHlwZS5HZW5lcmF0ZWQ6XG4gICAgICAgICAgICAgICAgICAgICAgICBzd2l0Y2ggKHN0YXRlLnN1YnR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlIFwiSW52aXRpbmdcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuaW52aXRlZU5hbWVzVG9Sb29tTmFtZShzdGF0ZS5uYW1lcywgc3RhdGUuY291bnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1lbWJlck5hbWVzVG9Sb29tTmFtZShzdGF0ZS5uYW1lcywgc3RhdGUuY291bnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjYXNlIFJvb21OYW1lVHlwZS5FbXB0eVJvb206XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdGUub2xkTmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBfdChcIkVtcHR5IHJvb20gKHdhcyAlKG9sZE5hbWUpcylcIiwge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbGROYW1lOiBzdGF0ZS5vbGROYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gX3QoXCJFbXB0eSByb29tXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAoU2VjdXJpdHlDdXN0b21pc2F0aW9ucy5nZXREZWh5ZHJhdGlvbktleSkge1xuICAgICAgICAgICAgb3B0cy5jcnlwdG9DYWxsYmFja3MhLmdldERlaHlkcmF0aW9uS2V5ID0gU2VjdXJpdHlDdXN0b21pc2F0aW9ucy5nZXREZWh5ZHJhdGlvbktleTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubWF0cml4Q2xpZW50ID0gY3JlYXRlTWF0cml4Q2xpZW50KG9wdHMpO1xuXG4gICAgICAgIC8vIHdlJ3JlIGdvaW5nIHRvIGFkZCBldmVudGxpc3RlbmVycyBmb3IgZWFjaCBtYXRyaXggZXZlbnQgdGlsZSwgc28gdGhlXG4gICAgICAgIC8vIHBvdGVudGlhbCBudW1iZXIgb2YgZXZlbnQgbGlzdGVuZXJzIGlzIHF1aXRlIGhpZ2guXG4gICAgICAgIHRoaXMubWF0cml4Q2xpZW50LnNldE1heExpc3RlbmVycyg1MDApO1xuXG4gICAgICAgIHRoaXMubWF0cml4Q2xpZW50LnNldEd1ZXN0KEJvb2xlYW4oY3JlZHMuZ3Vlc3QpKTtcblxuICAgICAgICBjb25zdCBub3RpZlRpbWVsaW5lU2V0ID0gbmV3IEV2ZW50VGltZWxpbmVTZXQodW5kZWZpbmVkLCB7XG4gICAgICAgICAgICB0aW1lbGluZVN1cHBvcnQ6IHRydWUsXG4gICAgICAgICAgICBwZW5kaW5nRXZlbnRzOiBmYWxzZSxcbiAgICAgICAgfSk7XG4gICAgICAgIC8vIFhYWDogd2hhdCBpcyBvdXIgaW5pdGlhbCBwYWdpbmF0aW9uIHRva2VuPyEgaXQgc29tZWhvdyBuZWVkcyB0byBiZSBzeW5jaHJvbmlzZWQgd2l0aCAvc3luYy5cbiAgICAgICAgbm90aWZUaW1lbGluZVNldC5nZXRMaXZlVGltZWxpbmUoKS5zZXRQYWdpbmF0aW9uVG9rZW4oXCJcIiwgRXZlbnRUaW1lbGluZS5CQUNLV0FSRFMpO1xuICAgICAgICB0aGlzLm1hdHJpeENsaWVudC5zZXROb3RpZlRpbWVsaW5lU2V0KG5vdGlmVGltZWxpbmVTZXQpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBOb3RlOiBZb3Ugc2hvdWxkIGJlIHVzaW5nIGEgUmVhY3QgY29udGV4dCB3aXRoIGFjY2VzcyB0byBhIGNsaWVudCByYXRoZXIgdGhhblxuICogdXNpbmcgdGhpcywgYXMgaW4gYSBtdWx0aS1hY2NvdW50IHdvcmxkIHRoaXMgd2lsbCBub3QgZXhpc3QhXG4gKi9cbmV4cG9ydCBjb25zdCBNYXRyaXhDbGllbnRQZWc6IElNYXRyaXhDbGllbnRQZWcgPSBuZXcgTWF0cml4Q2xpZW50UGVnQ2xhc3MoKTtcblxuaWYgKCF3aW5kb3cubXhNYXRyaXhDbGllbnRQZWcpIHtcbiAgICB3aW5kb3cubXhNYXRyaXhDbGllbnRQZWcgPSBNYXRyaXhDbGllbnRQZWc7XG59XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBbUJBLElBQUFBLE9BQUEsR0FBQUMsT0FBQTtBQUVBLElBQUFDLE9BQUEsR0FBQUQsT0FBQTtBQUNBLElBQUFFLEtBQUEsR0FBQUMsdUJBQUEsQ0FBQUgsT0FBQTtBQUNBLElBQUFJLGNBQUEsR0FBQUosT0FBQTtBQUNBLElBQUFLLGlCQUFBLEdBQUFMLE9BQUE7QUFDQSxJQUFBTSxPQUFBLEdBQUFOLE9BQUE7QUFDQSxJQUFB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