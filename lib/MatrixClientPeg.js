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
//# sourceMappingURL=MatrixClientPeg.js.map