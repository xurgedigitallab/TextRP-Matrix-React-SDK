"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.attemptTokenLogin = attemptTokenLogin;
exports.getStoredSessionOwner = getStoredSessionOwner;
exports.getStoredSessionVars = getStoredSessionVars;
exports.handleInvalidStoreError = handleInvalidStoreError;
exports.hydrateSession = hydrateSession;
exports.isLoggingOut = isLoggingOut;
exports.isSoftLogout = isSoftLogout;
exports.loadSession = loadSession;
exports.logout = logout;
exports.onLoggedOut = onLoggedOut;
exports.restoreFromLocalStorage = restoreFromLocalStorage;
exports.setLoggedIn = setLoggedIn;
exports.softLogout = softLogout;
exports.stopMatrixClient = stopMatrixClient;
var _matrix = require("matrix-js-sdk/src/matrix");
var _errors = require("matrix-js-sdk/src/errors");
var _aes = require("matrix-js-sdk/src/crypto/aes");
var _logger = require("matrix-js-sdk/src/logger");
var _auth = require("matrix-js-sdk/src/@types/auth");
var _MatrixClientPeg = require("./MatrixClientPeg");
var _Security = _interopRequireDefault(require("./customisations/Security"));
var _EventIndexPeg = _interopRequireDefault(require("./indexing/EventIndexPeg"));
var _createMatrixClient = _interopRequireDefault(require("./utils/createMatrixClient"));
var _Notifier = _interopRequireDefault(require("./Notifier"));
var _UserActivity = _interopRequireDefault(require("./UserActivity"));
var _Presence = _interopRequireDefault(require("./Presence"));
var _dispatcher = _interopRequireDefault(require("./dispatcher/dispatcher"));
var _DMRoomMap = _interopRequireDefault(require("./utils/DMRoomMap"));
var _Modal = _interopRequireDefault(require("./Modal"));
var _ActiveWidgetStore = _interopRequireDefault(require("./stores/ActiveWidgetStore"));
var _PlatformPeg = _interopRequireDefault(require("./PlatformPeg"));
var _Login = require("./Login");
var StorageManager = _interopRequireWildcard(require("./utils/StorageManager"));
var _SettingsStore = _interopRequireDefault(require("./settings/SettingsStore"));
var _ToastStore = _interopRequireDefault(require("./stores/ToastStore"));
var _IntegrationManagers = require("./integrations/IntegrationManagers");
var _Mjolnir = require("./mjolnir/Mjolnir");
var _DeviceListener = _interopRequireDefault(require("./DeviceListener"));
var _Jitsi = require("./widgets/Jitsi");
var _BasePlatform = require("./BasePlatform");
var _ThreepidInviteStore = _interopRequireDefault(require("./stores/ThreepidInviteStore"));
var _PosthogAnalytics = require("./PosthogAnalytics");
var _LegacyCallHandler = _interopRequireDefault(require("./LegacyCallHandler"));
var _Lifecycle = _interopRequireDefault(require("./customisations/Lifecycle"));
var _ErrorDialog = _interopRequireDefault(require("./components/views/dialogs/ErrorDialog"));
var _languageHandler = require("./languageHandler");
var _LazyLoadingResyncDialog = _interopRequireDefault(require("./components/views/dialogs/LazyLoadingResyncDialog"));
var _LazyLoadingDisabledDialog = _interopRequireDefault(require("./components/views/dialogs/LazyLoadingDisabledDialog"));
var _SessionRestoreErrorDialog = _interopRequireDefault(require("./components/views/dialogs/SessionRestoreErrorDialog"));
var _StorageEvictedDialog = _interopRequireDefault(require("./components/views/dialogs/StorageEvictedDialog"));
var _sentry = require("./sentry");
var _SdkConfig = _interopRequireDefault(require("./SdkConfig"));
var _DialogOpener = require("./utils/DialogOpener");
var _actions = require("./dispatcher/actions");
var _AbstractLocalStorageSettingsHandler = _interopRequireDefault(require("./settings/handlers/AbstractLocalStorageSettingsHandler"));
var _SDKContext = require("./contexts/SDKContext");
var _ErrorUtils = require("./utils/ErrorUtils");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2018 New Vector Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

const HOMESERVER_URL_KEY = "mx_hs_url";
const ID_SERVER_URL_KEY = "mx_is_url";
_dispatcher.default.register(payload => {
  if (payload.action === _actions.Action.TriggerLogout) {
    // noinspection JSIgnoredPromiseFromCall - we don't care if it fails
    onLoggedOut();
  } else if (payload.action === _actions.Action.OverwriteLogin) {
    const typed = payload;
    // noinspection JSIgnoredPromiseFromCall - we don't care if it fails
    doSetLoggedIn(typed.credentials, true);
  }
});
/**
 * Called at startup, to attempt to build a logged-in Matrix session. It tries
 * a number of things:
 *
 * 1. if we have a guest access token in the fragment query params, it uses
 *    that.
 * 2. if an access token is stored in local storage (from a previous session),
 *    it uses that.
 * 3. it attempts to auto-register as a guest user.
 *
 * If any of steps 1-4 are successful, it will call {_doSetLoggedIn}, which in
 * turn will raise on_logged_in and will_start_client events.
 *
 * @param {object} [opts]
 * @param {object} [opts.fragmentQueryParams]: string->string map of the
 *     query-parameters extracted from the #-fragment of the starting URI.
 * @param {boolean} [opts.enableGuest]: set to true to enable guest access
 *     tokens and auto-guest registrations.
 * @param {string} [opts.guestHsUrl]: homeserver URL. Only used if enableGuest
 *     is true; defines the HS to register against.
 * @param {string} [opts.guestIsUrl]: homeserver URL. Only used if enableGuest
 *     is true; defines the IS to use.
 * @param {bool} [opts.ignoreGuest]: If the stored session is a guest account,
 *     ignore it and don't load it.
 * @param {string} [opts.defaultDeviceDisplayName]: Default display name to use
 *     when registering as a guest.
 * @returns {Promise} a promise which resolves when the above process completes.
 *     Resolves to `true` if we ended up starting a session, or `false` if we
 *     failed.
 */
async function loadSession() {
  let opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  try {
    let enableGuest = opts.enableGuest || false;
    const guestHsUrl = opts.guestHsUrl;
    const guestIsUrl = opts.guestIsUrl;
    const fragmentQueryParams = opts.fragmentQueryParams || {};
    const defaultDeviceDisplayName = opts.defaultDeviceDisplayName;
    if (enableGuest && !guestHsUrl) {
      _logger.logger.warn("Cannot enable guest access: can't determine HS URL to use");
      enableGuest = false;
    }
    if (enableGuest && guestHsUrl && fragmentQueryParams.guest_user_id && fragmentQueryParams.guest_access_token) {
      _logger.logger.log("Using guest access credentials");
      return doSetLoggedIn({
        userId: fragmentQueryParams.guest_user_id,
        accessToken: fragmentQueryParams.guest_access_token,
        homeserverUrl: guestHsUrl,
        identityServerUrl: guestIsUrl,
        guest: true
      }, true).then(() => true);
    }
    const success = await restoreFromLocalStorage({
      ignoreGuest: Boolean(opts.ignoreGuest)
    });
    if (success) {
      return true;
    }
    if (enableGuest && guestHsUrl) {
      return registerAsGuest(guestHsUrl, guestIsUrl, defaultDeviceDisplayName);
    }

    // fall back to welcome screen
    return false;
  } catch (e) {
    if (e instanceof AbortLoginAndRebuildStorage) {
      // If we're aborting login because of a storage inconsistency, we don't
      // need to show the general failure dialog. Instead, just go back to welcome.
      return false;
    }
    return handleLoadSessionFailure(e);
  }
}

/**
 * Gets the user ID of the persisted session, if one exists. This does not validate
 * that the user's credentials still work, just that they exist and that a user ID
 * is associated with them. The session is not loaded.
 * @returns {[string, boolean]} The persisted session's owner and whether the stored
 *     session is for a guest user, if an owner exists. If there is no stored session,
 *     return [null, null].
 */
async function getStoredSessionOwner() {
  const {
    hsUrl,
    userId,
    hasAccessToken,
    isGuest
  } = await getStoredSessionVars();
  return hsUrl && userId && hasAccessToken ? [userId, !!isGuest] : [null, null];
}

/**
 * @param {Object} queryParams    string->string map of the
 *     query-parameters extracted from the real query-string of the starting
 *     URI.
 *
 * @param {string} defaultDeviceDisplayName
 * @param {string} fragmentAfterLogin path to go to after a successful login, only used for "Try again"
 *
 * @returns {Promise} promise which resolves to true if we completed the token
 *    login, else false
 */
function attemptTokenLogin(queryParams, defaultDeviceDisplayName, fragmentAfterLogin) {
  if (!queryParams.loginToken) {
    return Promise.resolve(false);
  }
  const homeserver = localStorage.getItem(_BasePlatform.SSO_HOMESERVER_URL_KEY);
  const identityServer = localStorage.getItem(_BasePlatform.SSO_ID_SERVER_URL_KEY) ?? undefined;
  if (!homeserver) {
    _logger.logger.warn("Cannot log in with token: can't determine HS URL to use");
    _Modal.default.createDialog(_ErrorDialog.default, {
      title: (0, _languageHandler._t)("We couldn't log you in"),
      description: (0, _languageHandler._t)("We asked the browser to remember which homeserver you use to let you sign in, " + "but unfortunately your browser has forgotten it. Go to the sign in page and try again."),
      button: (0, _languageHandler._t)("Try again")
    });
    return Promise.resolve(false);
  }
  return (0, _Login.sendLoginRequest)(homeserver, identityServer, "m.login.token", {
    token: queryParams.loginToken,
    initial_device_display_name: defaultDeviceDisplayName
  }).then(function (creds) {
    _logger.logger.log("Logged in with token");
    return clearStorage().then(async () => {
      await persistCredentials(creds);
      // remember that we just logged in
      sessionStorage.setItem("mx_fresh_login", String(true));
      return true;
    });
  }).catch(err => {
    _Modal.default.createDialog(_ErrorDialog.default, {
      title: (0, _languageHandler._t)("We couldn't log you in"),
      description: (0, _ErrorUtils.messageForLoginError)(err, {
        hsUrl: homeserver,
        hsName: homeserver
      }),
      button: (0, _languageHandler._t)("Try again"),
      onFinished: tryAgain => {
        if (tryAgain) {
          const cli = (0, _matrix.createClient)({
            baseUrl: homeserver,
            idBaseUrl: identityServer
          });
          const idpId = localStorage.getItem(_BasePlatform.SSO_IDP_ID_KEY) || undefined;
          _PlatformPeg.default.get()?.startSingleSignOn(cli, "sso", fragmentAfterLogin, idpId, _auth.SSOAction.LOGIN);
        }
      }
    });
    _logger.logger.error("Failed to log in with login token:");
    _logger.logger.error(err);
    return false;
  });
}
function handleInvalidStoreError(e) {
  if (e.reason === _errors.InvalidStoreError.TOGGLED_LAZY_LOADING) {
    return Promise.resolve().then(() => {
      const lazyLoadEnabled = e.value;
      if (lazyLoadEnabled) {
        return new Promise(resolve => {
          _Modal.default.createDialog(_LazyLoadingResyncDialog.default, {
            onFinished: resolve
          });
        });
      } else {
        // show warning about simultaneous use
        // between LL/non-LL version on same host.
        // as disabling LL when previously enabled
        // is a strong indicator of this (/develop & /app)
        return new Promise(resolve => {
          _Modal.default.createDialog(_LazyLoadingDisabledDialog.default, {
            onFinished: resolve,
            host: window.location.host
          });
        });
      }
    }).then(() => {
      return _MatrixClientPeg.MatrixClientPeg.get().store.deleteAllData();
    }).then(() => {
      _PlatformPeg.default.get()?.reload();
    });
  }
}
function registerAsGuest(hsUrl, isUrl, defaultDeviceDisplayName) {
  _logger.logger.log(`Doing guest login on ${hsUrl}`);

  // create a temporary MatrixClient to do the login
  const client = (0, _matrix.createClient)({
    baseUrl: hsUrl
  });
  return client.registerGuest({
    body: {
      initial_device_display_name: defaultDeviceDisplayName
    }
  }).then(creds => {
    _logger.logger.log(`Registered as guest: ${creds.user_id}`);
    return doSetLoggedIn({
      userId: creds.user_id,
      deviceId: creds.device_id,
      accessToken: creds.access_token,
      homeserverUrl: hsUrl,
      identityServerUrl: isUrl,
      guest: true
    }, true).then(() => true);
  }, err => {
    _logger.logger.error("Failed to register as guest", err);
    return false;
  });
}
/**
 * Retrieves information about the stored session from the browser's storage. The session
 * may not be valid, as it is not tested for consistency here.
 * @returns {Object} Information about the session - see implementation for variables.
 */
async function getStoredSessionVars() {
  const hsUrl = localStorage.getItem(HOMESERVER_URL_KEY) ?? undefined;
  const isUrl = localStorage.getItem(ID_SERVER_URL_KEY) ?? undefined;
  let accessToken;
  try {
    accessToken = await StorageManager.idbLoad("account", "mx_access_token");
  } catch (e) {
    _logger.logger.error("StorageManager.idbLoad failed for account:mx_access_token", e);
  }
  if (!accessToken) {
    accessToken = localStorage.getItem("mx_access_token") ?? undefined;
    if (accessToken) {
      try {
        // try to migrate access token to IndexedDB if we can
        await StorageManager.idbSave("account", "mx_access_token", accessToken);
        localStorage.removeItem("mx_access_token");
      } catch (e) {
        _logger.logger.error("migration of access token to IndexedDB failed", e);
      }
    }
  }
  // if we pre-date storing "mx_has_access_token", but we retrieved an access
  // token, then we should say we have an access token
  const hasAccessToken = localStorage.getItem("mx_has_access_token") === "true" || !!accessToken;
  const userId = localStorage.getItem("mx_user_id") ?? undefined;
  const deviceId = localStorage.getItem("mx_device_id") ?? undefined;
  let isGuest;
  if (localStorage.getItem("mx_is_guest") !== null) {
    isGuest = localStorage.getItem("mx_is_guest") === "true";
  } else {
    // legacy key name
    isGuest = localStorage.getItem("matrix-is-guest") === "true";
  }
  return {
    hsUrl,
    isUrl,
    hasAccessToken,
    accessToken,
    userId,
    deviceId,
    isGuest
  };
}

// The pickle key is a string of unspecified length and format.  For AES, we
// need a 256-bit Uint8Array. So we HKDF the pickle key to generate the AES
// key.  The AES key should be zeroed after it is used.
async function pickleKeyToAesKey(pickleKey) {
  const pickleKeyBuffer = new Uint8Array(pickleKey.length);
  for (let i = 0; i < pickleKey.length; i++) {
    pickleKeyBuffer[i] = pickleKey.charCodeAt(i);
  }
  const hkdfKey = await window.crypto.subtle.importKey("raw", pickleKeyBuffer, "HKDF", false, ["deriveBits"]);
  pickleKeyBuffer.fill(0);
  return new Uint8Array(await window.crypto.subtle.deriveBits({
    name: "HKDF",
    hash: "SHA-256",
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/879
    salt: new Uint8Array(32),
    info: new Uint8Array(0)
  }, hkdfKey, 256));
}
async function abortLogin() {
  const signOut = await showStorageEvictedDialog();
  if (signOut) {
    await clearStorage();
    // This error feels a bit clunky, but we want to make sure we don't go any
    // further and instead head back to sign in.
    throw new AbortLoginAndRebuildStorage("Aborting login in progress because of storage inconsistency");
  }
}

// returns a promise which resolves to true if a session is found in
// localstorage
//
// N.B. Lifecycle.js should not maintain any further localStorage state, we
//      are moving towards using SessionStore to keep track of state related
//      to the current session (which is typically backed by localStorage).
//
//      The plan is to gradually move the localStorage access done here into
//      SessionStore to avoid bugs where the view becomes out-of-sync with
//      localStorage (e.g. isGuest etc.)
async function restoreFromLocalStorage(opts) {
  const ignoreGuest = opts?.ignoreGuest;
  if (!localStorage) {
    return false;
  }
  const {
    hsUrl,
    isUrl,
    hasAccessToken,
    accessToken,
    userId,
    deviceId,
    isGuest
  } = await getStoredSessionVars();
  if (hasAccessToken && !accessToken) {
    await abortLogin();
  }
  if (accessToken && userId && hsUrl) {
    if (ignoreGuest && isGuest) {
      _logger.logger.log("Ignoring stored guest account: " + userId);
      return false;
    }
    let decryptedAccessToken = accessToken;
    const pickleKey = await _PlatformPeg.default.get()?.getPickleKey(userId, deviceId ?? "");
    if (pickleKey) {
      _logger.logger.log("Got pickle key");
      if (typeof accessToken !== "string") {
        const encrKey = await pickleKeyToAesKey(pickleKey);
        decryptedAccessToken = await (0, _aes.decryptAES)(accessToken, encrKey, "access_token");
        encrKey.fill(0);
      }
    } else {
      _logger.logger.log("No pickle key available");
    }
    const freshLogin = sessionStorage.getItem("mx_fresh_login") === "true";
    sessionStorage.removeItem("mx_fresh_login");
    _logger.logger.log(`Restoring session for ${userId}`);
    await doSetLoggedIn({
      userId: userId,
      deviceId: deviceId,
      accessToken: decryptedAccessToken,
      homeserverUrl: hsUrl,
      identityServerUrl: isUrl,
      guest: isGuest,
      pickleKey: pickleKey ?? undefined,
      freshLogin: freshLogin
    }, false);
    return true;
  } else {
    _logger.logger.log("No previous session found.");
    return false;
  }
}
async function handleLoadSessionFailure(e) {
  _logger.logger.error("Unable to load session", e);
  const modal = _Modal.default.createDialog(_SessionRestoreErrorDialog.default, {
    error: e
  });
  const [success] = await modal.finished;
  if (success) {
    // user clicked continue.
    await clearStorage();
    return false;
  }

  // try, try again
  return loadSession();
}

/**
 * Transitions to a logged-in state using the given credentials.
 *
 * Starts the matrix client and all other react-sdk services that
 * listen for events while a session is logged in.
 *
 * Also stops the old MatrixClient and clears old credentials/etc out of
 * storage before starting the new client.
 *
 * @param {IMatrixClientCreds} credentials The credentials to use
 *
 * @returns {Promise} promise which resolves to the new MatrixClient once it has been started
 */
async function setLoggedIn(credentials) {
  credentials.freshLogin = true;
  stopMatrixClient();
  const pickleKey = credentials.userId && credentials.deviceId ? await _PlatformPeg.default.get()?.createPickleKey(credentials.userId, credentials.deviceId) : null;
  if (pickleKey) {
    _logger.logger.log("Created pickle key");
  } else {
    _logger.logger.log("Pickle key not created");
  }
  return doSetLoggedIn(Object.assign({}, credentials, {
    pickleKey
  }), true);
}

/**
 * Hydrates an existing session by using the credentials provided. This will
 * not clear any local storage, unlike setLoggedIn().
 *
 * Stops the existing Matrix client (without clearing its data) and starts a
 * new one in its place. This additionally starts all other react-sdk services
 * which use the new Matrix client.
 *
 * If the credentials belong to a different user from the session already stored,
 * the old session will be cleared automatically.
 *
 * @param {IMatrixClientCreds} credentials The credentials to use
 *
 * @returns {Promise} promise which resolves to the new MatrixClient once it has been started
 */
async function hydrateSession(credentials) {
  const oldUserId = _MatrixClientPeg.MatrixClientPeg.get().getUserId();
  const oldDeviceId = _MatrixClientPeg.MatrixClientPeg.get().getDeviceId();
  stopMatrixClient(); // unsets MatrixClientPeg.get()
  localStorage.removeItem("mx_soft_logout");
  _isLoggingOut = false;
  const overwrite = credentials.userId !== oldUserId || credentials.deviceId !== oldDeviceId;
  if (overwrite) {
    _logger.logger.warn("Clearing all data: Old session belongs to a different user/session");
  }
  if (!credentials.pickleKey && credentials.deviceId !== undefined) {
    _logger.logger.info("Lifecycle#hydrateSession: Pickle key not provided - trying to get one");
    credentials.pickleKey = (await _PlatformPeg.default.get()?.getPickleKey(credentials.userId, credentials.deviceId)) ?? undefined;
  }
  return doSetLoggedIn(credentials, overwrite);
}

/**
 * optionally clears localstorage, persists new credentials
 * to localstorage, starts the new client.
 *
 * @param {IMatrixClientCreds} credentials
 * @param {Boolean} clearStorageEnabled
 *
 * @returns {Promise} promise which resolves to the new MatrixClient once it has been started
 */
async function doSetLoggedIn(credentials, clearStorageEnabled) {
  credentials.guest = Boolean(credentials.guest);
  const softLogout = isSoftLogout();
  _logger.logger.log("setLoggedIn: mxid: " + credentials.userId + " deviceId: " + credentials.deviceId + " guest: " + credentials.guest + " hs: " + credentials.homeserverUrl + " softLogout: " + softLogout, " freshLogin: " + credentials.freshLogin);
  if (clearStorageEnabled) {
    await clearStorage();
  }
  const results = await StorageManager.checkConsistency();
  // If there's an inconsistency between account data in local storage and the
  // crypto store, we'll be generally confused when handling encrypted data.
  // Show a modal recommending a full reset of storage.
  if (results.dataInLocalStorage && results.cryptoInited && !results.dataInCryptoStore) {
    await abortLogin();
  }
  _MatrixClientPeg.MatrixClientPeg.replaceUsingCreds(credentials);
  const client = _MatrixClientPeg.MatrixClientPeg.get();
  (0, _sentry.setSentryUser)(credentials.userId);
  if (_PosthogAnalytics.PosthogAnalytics.instance.isEnabled()) {
    _PosthogAnalytics.PosthogAnalytics.instance.startListeningToSettingsChanges(client);
  }
  if (credentials.freshLogin && _SettingsStore.default.getValue("feature_dehydration")) {
    // If we just logged in, try to rehydrate a device instead of using a
    // new device.  If it succeeds, we'll get a new device ID, so make sure
    // we persist that ID to localStorage
    const newDeviceId = await client.rehydrateDevice();
    if (newDeviceId) {
      credentials.deviceId = newDeviceId;
    }
    delete credentials.freshLogin;
  }
  if (localStorage) {
    try {
      await persistCredentials(credentials);
      // make sure we don't think that it's a fresh login any more
      sessionStorage.removeItem("mx_fresh_login");
    } catch (e) {
      _logger.logger.warn("Error using local storage: can't persist session!", e);
    }
  } else {
    _logger.logger.warn("No local storage available: can't persist session!");
  }
  _dispatcher.default.fire(_actions.Action.OnLoggedIn);
  await startMatrixClient(client, /*startSyncing=*/!softLogout);
  return client;
}
async function showStorageEvictedDialog() {
  const {
    finished
  } = _Modal.default.createDialog(_StorageEvictedDialog.default);
  const [ok] = await finished;
  return !!ok;
}

// Note: Babel 6 requires the `transform-builtin-extend` plugin for this to satisfy
// `instanceof`. Babel 7 supports this natively in their class handling.
class AbortLoginAndRebuildStorage extends Error {}
async function persistCredentials(credentials) {
  localStorage.setItem(HOMESERVER_URL_KEY, credentials.homeserverUrl);
  if (credentials.identityServerUrl) {
    localStorage.setItem(ID_SERVER_URL_KEY, credentials.identityServerUrl);
  }
  localStorage.setItem("mx_user_id", credentials.userId);
  localStorage.setItem("mx_is_guest", JSON.stringify(credentials.guest));

  // store whether we expect to find an access token, to detect the case
  // where IndexedDB is blown away
  if (credentials.accessToken) {
    localStorage.setItem("mx_has_access_token", "true");
  } else {
    localStorage.deleteItem("mx_has_access_token");
  }
  if (credentials.pickleKey) {
    let encryptedAccessToken;
    try {
      // try to encrypt the access token using the pickle key
      const encrKey = await pickleKeyToAesKey(credentials.pickleKey);
      encryptedAccessToken = await (0, _aes.encryptAES)(credentials.accessToken, encrKey, "access_token");
      encrKey.fill(0);
    } catch (e) {
      _logger.logger.warn("Could not encrypt access token", e);
    }
    try {
      // save either the encrypted access token, or the plain access
      // token if we were unable to encrypt (e.g. if the browser doesn't
      // have WebCrypto).
      await StorageManager.idbSave("account", "mx_access_token", encryptedAccessToken || credentials.accessToken);
    } catch (e) {
      // if we couldn't save to indexedDB, fall back to localStorage.  We
      // store the access token unencrypted since localStorage only saves
      // strings.
      localStorage.setItem("mx_access_token", credentials.accessToken);
    }
    localStorage.setItem("mx_has_pickle_key", String(true));
  } else {
    try {
      await StorageManager.idbSave("account", "mx_access_token", credentials.accessToken);
    } catch (e) {
      localStorage.setItem("mx_access_token", credentials.accessToken);
    }
    if (localStorage.getItem("mx_has_pickle_key") === "true") {
      _logger.logger.error("Expected a pickle key, but none provided.  Encryption may not work.");
    }
  }

  // if we didn't get a deviceId from the login, leave mx_device_id unset,
  // rather than setting it to "undefined".
  //
  // (in this case MatrixClient doesn't bother with the crypto stuff
  // - that's fine for us).
  if (credentials.deviceId) {
    localStorage.setItem("mx_device_id", credentials.deviceId);
  }
  _Security.default.persistCredentials?.(credentials);
  _logger.logger.log(`Session persisted for ${credentials.userId}`);
}
let _isLoggingOut = false;

/**
 * Logs the current session out and transitions to the logged-out state
 */
function logout() {
  if (!_MatrixClientPeg.MatrixClientPeg.get()) return;
  _PosthogAnalytics.PosthogAnalytics.instance.logout();
  if (_MatrixClientPeg.MatrixClientPeg.get().isGuest()) {
    // logout doesn't work for guest sessions
    // Also we sometimes want to re-log in a guest session if we abort the login.
    // defer until next tick because it calls a synchronous dispatch, and we are likely here from a dispatch.
    setImmediate(() => onLoggedOut());
    return;
  }
  _isLoggingOut = true;
  const client = _MatrixClientPeg.MatrixClientPeg.get();
  _PlatformPeg.default.get()?.destroyPickleKey(client.getSafeUserId(), client.getDeviceId() ?? "");
  client.logout(true).then(onLoggedOut, err => {
    // Just throwing an error here is going to be very unhelpful
    // if you're trying to log out because your server's down and
    // you want to log into a different server, so just forget the
    // access token. It's annoying that this will leave the access
    // token still valid, but we should fix this by having access
    // tokens expire (and if you really think you've been compromised,
    // change your password).
    _logger.logger.warn("Failed to call logout API: token will not be invalidated", err);
    onLoggedOut();
  });
}
function softLogout() {
  if (!_MatrixClientPeg.MatrixClientPeg.get()) return;

  // Track that we've detected and trapped a soft logout. This helps prevent other
  // parts of the app from starting if there's no point (ie: don't sync if we've
  // been soft logged out, despite having credentials and data for a MatrixClient).
  localStorage.setItem("mx_soft_logout", "true");

  // Dev note: please keep this log line around. It can be useful for track down
  // random clients stopping in the middle of the logs.
  _logger.logger.log("Soft logout initiated");
  _isLoggingOut = true; // to avoid repeated flags
  // Ensure that we dispatch a view change **before** stopping the client so
  // so that React components unmount first. This avoids React soft crashes
  // that can occur when components try to use a null client.
  _dispatcher.default.dispatch({
    action: "on_client_not_viable"
  }); // generic version of on_logged_out
  stopMatrixClient( /*unsetClient=*/false);

  // DO NOT CALL LOGOUT. A soft logout preserves data, logout does not.
}

function isSoftLogout() {
  return localStorage.getItem("mx_soft_logout") === "true";
}
function isLoggingOut() {
  return _isLoggingOut;
}

/**
 * Starts the matrix client and all other react-sdk services that
 * listen for events while a session is logged in.
 * @param client the matrix client to start
 * @param {boolean} startSyncing True (default) to actually start
 * syncing the client.
 */
async function startMatrixClient(client) {
  let startSyncing = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
  _logger.logger.log(`Lifecycle: Starting MatrixClient`);

  // dispatch this before starting the matrix client: it's used
  // to add listeners for the 'sync' event so otherwise we'd have
  // a race condition (and we need to dispatch synchronously for this
  // to work).
  _dispatcher.default.dispatch({
    action: "will_start_client"
  }, true);

  // reset things first just in case
  _SDKContext.SdkContextClass.instance.typingStore.reset();
  _ToastStore.default.sharedInstance().reset();
  _DialogOpener.DialogOpener.instance.prepare(client);
  _Notifier.default.start();
  _UserActivity.default.sharedInstance().start();
  _DMRoomMap.default.makeShared(client).start();
  _IntegrationManagers.IntegrationManagers.sharedInstance().startWatching();
  _ActiveWidgetStore.default.instance.start();
  _LegacyCallHandler.default.instance.start();

  // Start Mjolnir even though we haven't checked the feature flag yet. Starting
  // the thing just wastes CPU cycles, but should result in no actual functionality
  // being exposed to the user.
  _Mjolnir.Mjolnir.sharedInstance().start();
  if (startSyncing) {
    // The client might want to populate some views with events from the
    // index (e.g. the FilePanel), therefore initialize the event index
    // before the client.
    await _EventIndexPeg.default.init();
    await _MatrixClientPeg.MatrixClientPeg.start();
  } else {
    _logger.logger.warn("Caller requested only auxiliary services be started");
    await _MatrixClientPeg.MatrixClientPeg.assign();
  }

  // Run the migrations after the MatrixClientPeg has been assigned
  _SettingsStore.default.runMigrations();

  // This needs to be started after crypto is set up
  _DeviceListener.default.sharedInstance().start(client);
  // Similarly, don't start sending presence updates until we've started
  // the client
  if (!_SettingsStore.default.getValue("lowBandwidth")) {
    _Presence.default.start();
  }

  // Now that we have a MatrixClientPeg, update the Jitsi info
  _Jitsi.Jitsi.getInstance().start();

  // dispatch that we finished starting up to wire up any other bits
  // of the matrix client that cannot be set prior to starting up.
  _dispatcher.default.dispatch({
    action: "client_started"
  });
  if (isSoftLogout()) {
    softLogout();
  }
}

/*
 * Stops a running client and all related services, and clears persistent
 * storage. Used after a session has been logged out.
 */
async function onLoggedOut() {
  // Ensure that we dispatch a view change **before** stopping the client,
  // that React components unmount first. This avoids React soft crashes
  // that can occur when components try to use a null client.
  _dispatcher.default.fire(_actions.Action.OnLoggedOut, true);
  stopMatrixClient();
  await clearStorage({
    deleteEverything: true
  });
  _Lifecycle.default.onLoggedOutAndStorageCleared?.();
  await _PlatformPeg.default.get()?.clearStorage();

  // Do this last, so we can make sure all storage has been cleared and all
  // customisations got the memo.
  if (_SdkConfig.default.get().logout_redirect_url) {
    _logger.logger.log("Redirecting to external provider to finish logout");
    // XXX: Defer this so that it doesn't race with MatrixChat unmounting the world by going to /#/login
    window.setTimeout(() => {
      window.location.href = _SdkConfig.default.get().logout_redirect_url;
    }, 100);
  }
  // Do this last to prevent racing `stopMatrixClient` and `on_logged_out` with MatrixChat handling Session.logged_out
  _isLoggingOut = false;
}

/**
 * @param {object} opts Options for how to clear storage.
 * @returns {Promise} promise which resolves once the stores have been cleared
 */
async function clearStorage(opts) {
  if (window.localStorage) {
    // try to save any 3pid invites from being obliterated and registration time
    const pendingInvites = _ThreepidInviteStore.default.instance.getWireInvites();
    const registrationTime = window.localStorage.getItem("mx_registration_time");
    window.localStorage.clear();
    _AbstractLocalStorageSettingsHandler.default.clear();
    try {
      await StorageManager.idbDelete("account", "mx_access_token");
    } catch (e) {
      _logger.logger.error("idbDelete failed for account:mx_access_token", e);
    }

    // now restore those invites and registration time
    if (!opts?.deleteEverything) {
      pendingInvites.forEach(i => {
        const roomId = i.roomId;
        delete i.roomId; // delete to avoid confusing the store
        _ThreepidInviteStore.default.instance.storeInvite(roomId, i);
      });
      if (registrationTime) {
        window.localStorage.setItem("mx_registration_time", registrationTime);
      }
    }
  }

  // Preserve WalletConnect session data during login (before clearing sessionStorage)
  const wcSessionTopic = window.sessionStorage?.getItem('wc_session_topic');
  const walletAddress = window.sessionStorage?.getItem('wallet_address');
  const walletName = window.sessionStorage?.getItem('wallet_name');
  window.sessionStorage?.clear();

  // Restore WalletConnect session data after clearing (only during login, not during deleteEverything/logout)
  if (!opts?.deleteEverything && window.sessionStorage) {
    if (wcSessionTopic) {
      window.sessionStorage.setItem('wc_session_topic', wcSessionTopic);
      _logger.logger.log('🔄 Preserved WalletConnect session ID during login clearStorage:', wcSessionTopic);
    }
    if (walletAddress) {
      window.sessionStorage.setItem('wallet_address', walletAddress);
    }
    if (walletName) {
      window.sessionStorage.setItem('wallet_name', walletName);
    }
  }

  // create a temporary client to clear out the persistent stores.
  const cli = (0, _createMatrixClient.default)({
    // we'll never make any requests, so can pass a bogus HS URL
    baseUrl: ""
  });
  await _EventIndexPeg.default.deleteEventIndex();
  await cli.clearStores();
}

/**
 * Stop all the background processes related to the current client.
 * @param {boolean} unsetClient True (default) to abandon the client
 * on MatrixClientPeg after stopping.
 */
function stopMatrixClient() {
  let unsetClient = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
  _Notifier.default.stop();
  _LegacyCallHandler.default.instance.stop();
  _UserActivity.default.sharedInstance().stop();
  _SDKContext.SdkContextClass.instance.typingStore.reset();
  _Presence.default.stop();
  _ActiveWidgetStore.default.instance.stop();
  _IntegrationManagers.IntegrationManagers.sharedInstance().stopWatching();
  _Mjolnir.Mjolnir.sharedInstance().stop();
  _DeviceListener.default.sharedInstance().stop();
  _DMRoomMap.default.shared()?.stop();
  _EventIndexPeg.default.stop();
  const cli = _MatrixClientPeg.MatrixClientPeg.get();
  if (cli) {
    cli.stopClient();
    cli.removeAllListeners();
    if (unsetClient) {
      _MatrixClientPeg.MatrixClientPeg.unset();
      _EventIndexPeg.default.unset();
      cli.store.destroy();
    }
  }
}

// Utility method to perform a login with an existing access_token
window.mxLoginWithAccessToken = async (hsUrl, accessToken) => {
  const tempClient = (0, _matrix.createClient)({
    baseUrl: hsUrl,
    accessToken
  });
  const {
    user_id: userId
  } = await tempClient.whoami();
  await doSetLoggedIn({
    homeserverUrl: hsUrl,
    accessToken,
    userId
  }, true);
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfbWF0cml4IiwicmVxdWlyZSIsIl9lcnJvcnMiLCJfYWVzIiwiX2xvZ2dlciIsIl9hdXRoIiwiX01hdHJpeENsaWVudFBlZyIsIl9TZWN1cml0eSIsIl9pbnRlcm9wUmVxdWlyZURlZmF1bHQiLCJfRXZlbnRJbmRleFBlZyIsIl9jcmVhdGVNYXRyaXhDbGllbnQiLCJfTm90aWZpZXIiLCJfVXNlckFjdGl2aXR5IiwiX1ByZXNlbmNlIiwiX2Rpc3BhdGNoZXIiLCJfRE1Sb29tTWFwIiwiX01vZGFsIiwiX0FjdGl2ZVdpZGdldFN0b3JlIiwiX1BsYXRmb3JtUGVnIiwiX0xvZ2luIiwiU3RvcmFnZU1hbmFnZXIiLCJfaW50ZXJvcFJlcXVpcmVXaWxkY2FyZCIsIl9TZXR0aW5nc1N0b3JlIiwiX1RvYXN0U3RvcmUiLCJfSW50ZWdyYXRpb25NYW5hZ2VycyIsIl9Nam9sbmlyIiwiX0RldmljZUxpc3RlbmVyIiwiX0ppdHNpIiwiX0Jhc2VQbGF0Zm9ybSIsIl9UaHJlZXBpZEludml0ZVN0b3JlIiwiX1Bvc3Rob2dBbmFseXRpY3MiLCJfTGVnYWN5Q2FsbEhhbmRsZXIiLCJfTGlmZWN5Y2xlIiwiX0Vycm9yRGlhbG9nIiwiX2xhbmd1YWdlSGFuZGxlciIsIl9MYXp5TG9hZGluZ1Jlc3luY0RpYWxvZyIsIl9MYXp5TG9hZGluZ0Rpc2FibGVkRGlhbG9nIiwiX1Nlc3Npb25SZXN0b3JlRXJyb3JEaWFsb2ciLCJfU3RvcmFnZUV2aWN0ZWREaWFsb2ciLCJfc2VudHJ5IiwiX1Nka0NvbmZpZyIsIl9EaWFsb2dPcGVuZXIiLCJfYWN0aW9ucyIsIl9BYnN0cmFjdExvY2FsU3RvcmFnZVNldHRpbmdzSGFuZGxlciIsIl9TREtDb250ZXh0IiwiX0Vycm9yVXRpbHMiLCJfZ2V0UmVxdWlyZVdpbGRjYXJkQ2FjaGUiLCJub2RlSW50ZXJvcCIsIldlYWtNYXAiLCJjYWNoZUJhYmVsSW50ZXJvcCIsImNhY2hlTm9kZUludGVyb3AiLCJvYmoiLCJfX2VzTW9kdWxlIiwiZGVmYXVsdCIsImNhY2hlIiwiaGFzIiwiZ2V0IiwibmV3T2JqIiwiaGFzUHJvcGVydHlEZXNjcmlwdG9yIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IiLCJrZXkiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImNhbGwiLCJkZXNjIiwic2V0IiwiSE9NRVNFUlZFUl9VUkxfS0VZIiwiSURfU0VSVkVSX1VSTF9LRVkiLCJkaXMiLCJyZWdpc3RlciIsInBheWxvYWQiLCJhY3Rpb24iLCJBY3Rpb24iLCJUcmlnZ2VyTG9nb3V0Iiwib25Mb2dnZWRPdXQiLCJPdmVyd3JpdGVMb2dpbiIsInR5cGVkIiwiZG9TZXRMb2dnZWRJbiIsImNyZWRlbnRpYWxzIiwibG9hZFNlc3Npb24iLCJvcHRzIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwidW5kZWZpbmVkIiwiZW5hYmxlR3Vlc3QiLCJndWVzdEhzVXJsIiwiZ3Vlc3RJc1VybCIsImZyYWdtZW50UXVlcnlQYXJhbXMiLCJkZWZhdWx0RGV2aWNlRGlzcGxheU5hbWUiLCJsb2dnZXIiLCJ3YXJuIiwiZ3Vlc3RfdXNlcl9pZCIsImd1ZXN0X2FjY2Vzc190b2tlbiIsImxvZyIsInVzZXJJZCIsImFjY2Vzc1Rva2VuIiwiaG9tZXNlcnZlclVybCIsImlkZW50aXR5U2VydmVyVXJsIiwiZ3Vlc3QiLCJ0aGVuIiwic3VjY2VzcyIsInJlc3RvcmVGcm9tTG9jYWxTdG9yYWdlIiwiaWdub3JlR3Vlc3QiLCJCb29sZWFuIiwicmVnaXN0ZXJBc0d1ZXN0IiwiZSIsIkFib3J0TG9naW5BbmRSZWJ1aWxkU3RvcmFnZSIsImhhbmRsZUxvYWRTZXNzaW9uRmFpbHVyZSIsImdldFN0b3JlZFNlc3Npb25Pd25lciIsImhzVXJsIiwiaGFzQWNjZXNzVG9rZW4iLCJpc0d1ZXN0IiwiZ2V0U3RvcmVkU2Vzc2lvblZhcnMiLCJhdHRlbXB0VG9rZW5Mb2dpbiIsInF1ZXJ5UGFyYW1zIiwiZnJhZ21lbnRBZnRlckxvZ2luIiwibG9naW5Ub2tlbiIsIlByb21pc2UiLCJyZXNvbHZlIiwiaG9tZXNlcnZlciIsImxvY2FsU3RvcmFnZSIsImdldEl0ZW0iLCJTU09fSE9NRVNFUlZFUl9VUkxfS0VZIiwiaWRlbnRpdHlTZXJ2ZXIiLCJTU09fSURfU0VSVkVSX1VSTF9LRVkiLCJNb2RhbCIsImNyZWF0ZURpYWxvZyIsIkVycm9yRGlhbG9nIiwidGl0bGUiLCJfdCIsImRlc2NyaXB0aW9uIiwiYnV0dG9uIiwic2VuZExvZ2luUmVxdWVzdCIsInRva2VuIiwiaW5pdGlhbF9kZXZpY2VfZGlzcGxheV9uYW1lIiwiY3JlZHMiLCJjbGVhclN0b3JhZ2UiLCJwZXJzaXN0Q3JlZGVudGlhbHMiLCJzZXNzaW9uU3RvcmFnZSIsInNldEl0ZW0iLCJTdHJpbmciLCJjYXRjaCIsImVyciIsIm1lc3NhZ2VGb3JMb2dpbkVycm9yIiwiaHNOYW1lIiwib25GaW5pc2hlZCIsInRyeUFnYWluIiwiY2xpIiwiY3JlYXRlQ2xpZW50IiwiYmFzZVVybCIsImlkQmFzZVVybCIsImlkcElkIiwiU1NPX0lEUF9JRF9LRVkiLCJQbGF0Zm9ybVBlZyIsInN0YXJ0U2luZ2xlU2lnbk9uIiwiU1NPQWN0aW9uIiwiTE9HSU4iLCJlcnJvciIsImhhbmRsZUludmFsaWRTdG9yZUVycm9yIiwicmVhc29uIiwiSW52YWxpZFN0b3JlRXJyb3IiLCJUT0dHTEVEX0xBWllfTE9BRElORyIsImxhenlMb2FkRW5hYmxlZCIsInZhbHVlIiwiTGF6eUxvYWRpbmdSZXN5bmNEaWFsb2ciLCJMYXp5TG9hZGluZ0Rpc2FibGVkRGlhbG9nIiwiaG9zdCIsIndpbmRvdyIsImxvY2F0aW9uIiwiTWF0cml4Q2xpZW50UGVnIiwic3RvcmUiLCJkZWxldGVBbGxEYXRhIiwicmVsb2FkIiwiaXNVcmwiLCJjbGllbnQiLCJyZWdpc3Rlckd1ZXN0IiwiYm9keSIsInVzZXJfaWQiLCJkZXZpY2VJZCIsImRldmljZV9pZCIsImFjY2Vzc190b2tlbiIsImlkYkxvYWQiLCJpZGJTYXZlIiwicmVtb3ZlSXRlbSIsInBpY2tsZUtleVRvQWVzS2V5IiwicGlja2xlS2V5IiwicGlja2xlS2V5QnVmZmVyIiwiVWludDhBcnJheSIsImkiLCJjaGFyQ29kZUF0IiwiaGtkZktleSIsImNyeXB0byIsInN1YnRsZSIsImltcG9ydEtleSIsImZpbGwiLCJkZXJpdmVCaXRzIiwibmFtZSIsImhhc2giLCJzYWx0IiwiaW5mbyIsImFib3J0TG9naW4iLCJzaWduT3V0Iiwic2hvd1N0b3JhZ2VFdmljdGVkRGlhbG9nIiwiZGVjcnlwdGVkQWNjZXNzVG9rZW4iLCJnZXRQaWNrbGVLZXkiLCJlbmNyS2V5IiwiZGVjcnlwdEFFUyIsImZyZXNoTG9naW4iLCJtb2RhbCIsIlNlc3Npb25SZXN0b3JlRXJyb3JEaWFsb2ciLCJmaW5pc2hlZCIsInNldExvZ2dlZEluIiwic3RvcE1hdHJpeENsaWVudCIsImNyZWF0ZVBpY2tsZUtleSIsImFzc2lnbiIsImh5ZHJhdGVTZXNzaW9uIiwib2xkVXNlcklkIiwiZ2V0VXNlcklkIiwib2xkRGV2aWNlSWQiLCJnZXREZXZpY2VJZCIsIl9pc0xvZ2dpbmdPdXQiLCJvdmVyd3JpdGUiLCJjbGVhclN0b3JhZ2VFbmFibGVkIiwic29mdExvZ291dCIsImlzU29mdExvZ291dCIsInJlc3VsdHMiLCJjaGVja0NvbnNpc3RlbmN5IiwiZGF0YUluTG9jYWxTdG9yYWdlIiwiY3J5cHRvSW5pdGVkIiwiZGF0YUluQ3J5cHRvU3RvcmUiLCJyZXBsYWNlVXNpbmdDcmVkcyIsInNldFNlbnRyeVVzZXIiLCJQb3N0aG9nQW5hbHl0aWNzIiwiaW5zdGFuY2UiLCJpc0VuYWJsZWQiLCJzdGFydExpc3RlbmluZ1RvU2V0dGluZ3NDaGFuZ2VzIiwiU2V0dGluZ3NTdG9yZSIsImdldFZhbHVlIiwibmV3RGV2aWNlSWQiLCJyZWh5ZHJhdGVEZXZpY2UiLCJmaXJlIiwiT25Mb2dnZWRJbiIsInN0YXJ0TWF0cml4Q2xpZW50IiwiU3RvcmFnZUV2aWN0ZWREaWFsb2ciLCJvayIsIkVycm9yIiwiSlNPTiIsInN0cmluZ2lmeSIsImRlbGV0ZUl0ZW0iLCJlbmNyeXB0ZWRBY2Nlc3NUb2tlbiIsImVuY3J5cHRBRVMiLCJTZWN1cml0eUN1c3RvbWlzYXRpb25zIiwibG9nb3V0Iiwic2V0SW1tZWRpYXRlIiwiZGVzdHJveVBpY2tsZUtleSIsImdldFNhZmVVc2VySWQiLCJkaXNwYXRjaCIsImlzTG9nZ2luZ091dCIsInN0YXJ0U3luY2luZyIsIlNka0NvbnRleHRDbGFzcyIsInR5cGluZ1N0b3JlIiwicmVzZXQiLCJUb2FzdFN0b3JlIiwic2hhcmVkSW5zdGFuY2UiLCJEaWFsb2dPcGVuZXIiLCJwcmVwYXJlIiwiTm90aWZpZXIiLCJzdGFydCIsIlVzZXJBY3Rpdml0eSIsIkRNUm9vbU1hcCIsIm1ha2VTaGFyZWQiLCJJbnRlZ3JhdGlvbk1hbmFnZXJzIiwic3RhcnRXYXRjaGluZyIsIkFjdGl2ZVdpZGdldFN0b3JlIiwiTGVnYWN5Q2FsbEhhbmRsZXIiLCJNam9sbmlyIiwiRXZlbnRJbmRleFBlZyIsImluaXQiLCJydW5NaWdyYXRpb25zIiwiRGV2aWNlTGlzdGVuZXIiLCJQcmVzZW5jZSIsIkppdHNpIiwiZ2V0SW5zdGFuY2UiLCJPbkxvZ2dlZE91dCIsImRlbGV0ZUV2ZXJ5dGhpbmciLCJMaWZlY3ljbGVDdXN0b21pc2F0aW9ucyIsIm9uTG9nZ2VkT3V0QW5kU3RvcmFnZUNsZWFyZWQiLCJTZGtDb25maWciLCJsb2dvdXRfcmVkaXJlY3RfdXJsIiwic2V0VGltZW91dCIsImhyZWYiLCJwZW5kaW5nSW52aXRlcyIsIlRocmVlcGlkSW52aXRlU3RvcmUiLCJnZXRXaXJlSW52aXRlcyIsInJlZ2lzdHJhdGlvblRpbWUiLCJjbGVhciIsIkFic3RyYWN0TG9jYWxTdG9yYWdlU2V0dGluZ3NIYW5kbGVyIiwiaWRiRGVsZXRlIiwiZm9yRWFjaCIsInJvb21JZCIsInN0b3JlSW52aXRlIiwid2NTZXNzaW9uVG9waWMiLCJ3YWxsZXRBZGRyZXNzIiwid2FsbGV0TmFtZSIsImNyZWF0ZU1hdHJpeENsaWVudCIsImRlbGV0ZUV2ZW50SW5kZXgiLCJjbGVhclN0b3JlcyIsInVuc2V0Q2xpZW50Iiwic3RvcCIsInN0b3BXYXRjaGluZyIsInNoYXJlZCIsInN0b3BDbGllbnQiLCJyZW1vdmVBbGxMaXN0ZW5lcnMiLCJ1bnNldCIsImRlc3Ryb3kiLCJteExvZ2luV2l0aEFjY2Vzc1Rva2VuIiwidGVtcENsaWVudCIsIndob2FtaSJdLCJzb3VyY2VzIjpbIi4uL3NyYy9MaWZlY3ljbGUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbkNvcHlyaWdodCAyMDE1LCAyMDE2IE9wZW5NYXJrZXQgTHRkXG5Db3B5cmlnaHQgMjAxNyBWZWN0b3IgQ3JlYXRpb25zIEx0ZFxuQ29weXJpZ2h0IDIwMTggTmV3IFZlY3RvciBMdGRcbkNvcHlyaWdodCAyMDE5LCAyMDIwIFRoZSBNYXRyaXgub3JnIEZvdW5kYXRpb24gQy5JLkMuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuKi9cblxuaW1wb3J0IHsgY3JlYXRlQ2xpZW50IH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL21hdHJpeFwiO1xuaW1wb3J0IHsgSW52YWxpZFN0b3JlRXJyb3IgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvZXJyb3JzXCI7XG5pbXBvcnQgeyBNYXRyaXhDbGllbnQgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvY2xpZW50XCI7XG5pbXBvcnQgeyBkZWNyeXB0QUVTLCBlbmNyeXB0QUVTLCBJRW5jcnlwdGVkUGF5bG9hZCB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9jcnlwdG8vYWVzXCI7XG5pbXBvcnQgeyBRdWVyeURpY3QgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvdXRpbHNcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9sb2dnZXJcIjtcbmltcG9ydCB7IFNTT0FjdGlvbiB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9AdHlwZXMvYXV0aFwiO1xuXG5pbXBvcnQgeyBJTWF0cml4Q2xpZW50Q3JlZHMsIE1hdHJpeENsaWVudFBlZyB9IGZyb20gXCIuL01hdHJpeENsaWVudFBlZ1wiO1xuaW1wb3J0IFNlY3VyaXR5Q3VzdG9taXNhdGlvbnMgZnJvbSBcIi4vY3VzdG9taXNhdGlvbnMvU2VjdXJpdHlcIjtcbmltcG9ydCBFdmVudEluZGV4UGVnIGZyb20gXCIuL2luZGV4aW5nL0V2ZW50SW5kZXhQZWdcIjtcbmltcG9ydCBjcmVhdGVNYXRyaXhDbGllbnQgZnJvbSBcIi4vdXRpbHMvY3JlYXRlTWF0cml4Q2xpZW50XCI7XG5pbXBvcnQgTm90aWZpZXIgZnJvbSBcIi4vTm90aWZpZXJcIjtcbmltcG9ydCBVc2VyQWN0aXZpdHkgZnJvbSBcIi4vVXNlckFjdGl2aXR5XCI7XG5pbXBvcnQgUHJlc2VuY2UgZnJvbSBcIi4vUHJlc2VuY2VcIjtcbmltcG9ydCBkaXMgZnJvbSBcIi4vZGlzcGF0Y2hlci9kaXNwYXRjaGVyXCI7XG5pbXBvcnQgRE1Sb29tTWFwIGZyb20gXCIuL3V0aWxzL0RNUm9vbU1hcFwiO1xuaW1wb3J0IE1vZGFsIGZyb20gXCIuL01vZGFsXCI7XG5pbXBvcnQgQWN0aXZlV2lkZ2V0U3RvcmUgZnJvbSBcIi4vc3RvcmVzL0FjdGl2ZVdpZGdldFN0b3JlXCI7XG5pbXBvcnQgUGxhdGZvcm1QZWcgZnJvbSBcIi4vUGxhdGZvcm1QZWdcIjtcbmltcG9ydCB7IHNlbmRMb2dpblJlcXVlc3QgfSBmcm9tIFwiLi9Mb2dpblwiO1xuaW1wb3J0ICogYXMgU3RvcmFnZU1hbmFnZXIgZnJvbSBcIi4vdXRpbHMvU3RvcmFnZU1hbmFnZXJcIjtcbmltcG9ydCBTZXR0aW5nc1N0b3JlIGZyb20gXCIuL3NldHRpbmdzL1NldHRpbmdzU3RvcmVcIjtcbmltcG9ydCBUb2FzdFN0b3JlIGZyb20gXCIuL3N0b3Jlcy9Ub2FzdFN0b3JlXCI7XG5pbXBvcnQgeyBJbnRlZ3JhdGlvbk1hbmFnZXJzIH0gZnJvbSBcIi4vaW50ZWdyYXRpb25zL0ludGVncmF0aW9uTWFuYWdlcnNcIjtcbmltcG9ydCB7IE1qb2xuaXIgfSBmcm9tIFwiLi9tam9sbmlyL01qb2xuaXJcIjtcbmltcG9ydCBEZXZpY2VMaXN0ZW5lciBmcm9tIFwiLi9EZXZpY2VMaXN0ZW5lclwiO1xuaW1wb3J0IHsgSml0c2kgfSBmcm9tIFwiLi93aWRnZXRzL0ppdHNpXCI7XG5pbXBvcnQgeyBTU09fSE9NRVNFUlZFUl9VUkxfS0VZLCBTU09fSURfU0VSVkVSX1VSTF9LRVksIFNTT19JRFBfSURfS0VZIH0gZnJvbSBcIi4vQmFzZVBsYXRmb3JtXCI7XG5pbXBvcnQgVGhyZWVwaWRJbnZpdGVTdG9yZSBmcm9tIFwiLi9zdG9yZXMvVGhyZWVwaWRJbnZpdGVTdG9yZVwiO1xuaW1wb3J0IHsgUG9zdGhvZ0FuYWx5dGljcyB9IGZyb20gXCIuL1Bvc3Rob2dBbmFseXRpY3NcIjtcbmltcG9ydCBMZWdhY3lDYWxsSGFuZGxlciBmcm9tIFwiLi9MZWdhY3lDYWxsSGFuZGxlclwiO1xuaW1wb3J0IExpZmVjeWNsZUN1c3RvbWlzYXRpb25zIGZyb20gXCIuL2N1c3RvbWlzYXRpb25zL0xpZmVjeWNsZVwiO1xuaW1wb3J0IEVycm9yRGlhbG9nIGZyb20gXCIuL2NvbXBvbmVudHMvdmlld3MvZGlhbG9ncy9FcnJvckRpYWxvZ1wiO1xuaW1wb3J0IHsgX3QgfSBmcm9tIFwiLi9sYW5ndWFnZUhhbmRsZXJcIjtcbmltcG9ydCBMYXp5TG9hZGluZ1Jlc3luY0RpYWxvZyBmcm9tIFwiLi9jb21wb25lbnRzL3ZpZXdzL2RpYWxvZ3MvTGF6eUxvYWRpbmdSZXN5bmNEaWFsb2dcIjtcbmltcG9ydCBMYXp5TG9hZGluZ0Rpc2FibGVkRGlhbG9nIGZyb20gXCIuL2NvbXBvbmVudHMvdmlld3MvZGlhbG9ncy9MYXp5TG9hZGluZ0Rpc2FibGVkRGlhbG9nXCI7XG5pbXBvcnQgU2Vzc2lvblJlc3RvcmVFcnJvckRpYWxvZyBmcm9tIFwiLi9jb21wb25lbnRzL3ZpZXdzL2RpYWxvZ3MvU2Vzc2lvblJlc3RvcmVFcnJvckRpYWxvZ1wiO1xuaW1wb3J0IFN0b3JhZ2VFdmljdGVkRGlhbG9nIGZyb20gXCIuL2NvbXBvbmVudHMvdmlld3MvZGlhbG9ncy9TdG9yYWdlRXZpY3RlZERpYWxvZ1wiO1xuaW1wb3J0IHsgc2V0U2VudHJ5VXNlciB9IGZyb20gXCIuL3NlbnRyeVwiO1xuaW1wb3J0IFNka0NvbmZpZyBmcm9tIFwiLi9TZGtDb25maWdcIjtcbmltcG9ydCB7IERpYWxvZ09wZW5lciB9IGZyb20gXCIuL3V0aWxzL0RpYWxvZ09wZW5lclwiO1xuaW1wb3J0IHsgQWN0aW9uIH0gZnJvbSBcIi4vZGlzcGF0Y2hlci9hY3Rpb25zXCI7XG5pbXBvcnQgQWJzdHJhY3RMb2NhbFN0b3JhZ2VTZXR0aW5nc0hhbmRsZXIgZnJvbSBcIi4vc2V0dGluZ3MvaGFuZGxlcnMvQWJzdHJhY3RMb2NhbFN0b3JhZ2VTZXR0aW5nc0hhbmRsZXJcIjtcbmltcG9ydCB7IE92ZXJ3cml0ZUxvZ2luUGF5bG9hZCB9IGZyb20gXCIuL2Rpc3BhdGNoZXIvcGF5bG9hZHMvT3ZlcndyaXRlTG9naW5QYXlsb2FkXCI7XG5pbXBvcnQgeyBTZGtDb250ZXh0Q2xhc3MgfSBmcm9tIFwiLi9jb250ZXh0cy9TREtDb250ZXh0XCI7XG5pbXBvcnQgeyBtZXNzYWdlRm9yTG9naW5FcnJvciB9IGZyb20gXCIuL3V0aWxzL0Vycm9yVXRpbHNcIjtcblxuY29uc3QgSE9NRVNFUlZFUl9VUkxfS0VZID0gXCJteF9oc191cmxcIjtcbmNvbnN0IElEX1NFUlZFUl9VUkxfS0VZID0gXCJteF9pc191cmxcIjtcblxuZGlzLnJlZ2lzdGVyKChwYXlsb2FkKSA9PiB7XG4gICAgaWYgKHBheWxvYWQuYWN0aW9uID09PSBBY3Rpb24uVHJpZ2dlckxvZ291dCkge1xuICAgICAgICAvLyBub2luc3BlY3Rpb24gSlNJZ25vcmVkUHJvbWlzZUZyb21DYWxsIC0gd2UgZG9uJ3QgY2FyZSBpZiBpdCBmYWlsc1xuICAgICAgICBvbkxvZ2dlZE91dCgpO1xuICAgIH0gZWxzZSBpZiAocGF5bG9hZC5hY3Rpb24gPT09IEFjdGlvbi5PdmVyd3JpdGVMb2dpbikge1xuICAgICAgICBjb25zdCB0eXBlZCA9IDxPdmVyd3JpdGVMb2dpblBheWxvYWQ+cGF5bG9hZDtcbiAgICAgICAgLy8gbm9pbnNwZWN0aW9uIEpTSWdub3JlZFByb21pc2VGcm9tQ2FsbCAtIHdlIGRvbid0IGNhcmUgaWYgaXQgZmFpbHNcbiAgICAgICAgZG9TZXRMb2dnZWRJbih0eXBlZC5jcmVkZW50aWFscywgdHJ1ZSk7XG4gICAgfVxufSk7XG5cbmludGVyZmFjZSBJTG9hZFNlc3Npb25PcHRzIHtcbiAgICBlbmFibGVHdWVzdD86IGJvb2xlYW47XG4gICAgZ3Vlc3RIc1VybD86IHN0cmluZztcbiAgICBndWVzdElzVXJsPzogc3RyaW5nO1xuICAgIGlnbm9yZUd1ZXN0PzogYm9vbGVhbjtcbiAgICBkZWZhdWx0RGV2aWNlRGlzcGxheU5hbWU/OiBzdHJpbmc7XG4gICAgZnJhZ21lbnRRdWVyeVBhcmFtcz86IFF1ZXJ5RGljdDtcbn1cblxuLyoqXG4gKiBDYWxsZWQgYXQgc3RhcnR1cCwgdG8gYXR0ZW1wdCB0byBidWlsZCBhIGxvZ2dlZC1pbiBNYXRyaXggc2Vzc2lvbi4gSXQgdHJpZXNcbiAqIGEgbnVtYmVyIG9mIHRoaW5nczpcbiAqXG4gKiAxLiBpZiB3ZSBoYXZlIGEgZ3Vlc3QgYWNjZXNzIHRva2VuIGluIHRoZSBmcmFnbWVudCBxdWVyeSBwYXJhbXMsIGl0IHVzZXNcbiAqICAgIHRoYXQuXG4gKiAyLiBpZiBhbiBhY2Nlc3MgdG9rZW4gaXMgc3RvcmVkIGluIGxvY2FsIHN0b3JhZ2UgKGZyb20gYSBwcmV2aW91cyBzZXNzaW9uKSxcbiAqICAgIGl0IHVzZXMgdGhhdC5cbiAqIDMuIGl0IGF0dGVtcHRzIHRvIGF1dG8tcmVnaXN0ZXIgYXMgYSBndWVzdCB1c2VyLlxuICpcbiAqIElmIGFueSBvZiBzdGVwcyAxLTQgYXJlIHN1Y2Nlc3NmdWwsIGl0IHdpbGwgY2FsbCB7X2RvU2V0TG9nZ2VkSW59LCB3aGljaCBpblxuICogdHVybiB3aWxsIHJhaXNlIG9uX2xvZ2dlZF9pbiBhbmQgd2lsbF9zdGFydF9jbGllbnQgZXZlbnRzLlxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0c11cbiAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0cy5mcmFnbWVudFF1ZXJ5UGFyYW1zXTogc3RyaW5nLT5zdHJpbmcgbWFwIG9mIHRoZVxuICogICAgIHF1ZXJ5LXBhcmFtZXRlcnMgZXh0cmFjdGVkIGZyb20gdGhlICMtZnJhZ21lbnQgb2YgdGhlIHN0YXJ0aW5nIFVSSS5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMuZW5hYmxlR3Vlc3RdOiBzZXQgdG8gdHJ1ZSB0byBlbmFibGUgZ3Vlc3QgYWNjZXNzXG4gKiAgICAgdG9rZW5zIGFuZCBhdXRvLWd1ZXN0IHJlZ2lzdHJhdGlvbnMuXG4gKiBAcGFyYW0ge3N0cmluZ30gW29wdHMuZ3Vlc3RIc1VybF06IGhvbWVzZXJ2ZXIgVVJMLiBPbmx5IHVzZWQgaWYgZW5hYmxlR3Vlc3RcbiAqICAgICBpcyB0cnVlOyBkZWZpbmVzIHRoZSBIUyB0byByZWdpc3RlciBhZ2FpbnN0LlxuICogQHBhcmFtIHtzdHJpbmd9IFtvcHRzLmd1ZXN0SXNVcmxdOiBob21lc2VydmVyIFVSTC4gT25seSB1c2VkIGlmIGVuYWJsZUd1ZXN0XG4gKiAgICAgaXMgdHJ1ZTsgZGVmaW5lcyB0aGUgSVMgdG8gdXNlLlxuICogQHBhcmFtIHtib29sfSBbb3B0cy5pZ25vcmVHdWVzdF06IElmIHRoZSBzdG9yZWQgc2Vzc2lvbiBpcyBhIGd1ZXN0IGFjY291bnQsXG4gKiAgICAgaWdub3JlIGl0IGFuZCBkb24ndCBsb2FkIGl0LlxuICogQHBhcmFtIHtzdHJpbmd9IFtvcHRzLmRlZmF1bHREZXZpY2VEaXNwbGF5TmFtZV06IERlZmF1bHQgZGlzcGxheSBuYW1lIHRvIHVzZVxuICogICAgIHdoZW4gcmVnaXN0ZXJpbmcgYXMgYSBndWVzdC5cbiAqIEByZXR1cm5zIHtQcm9taXNlfSBhIHByb21pc2Ugd2hpY2ggcmVzb2x2ZXMgd2hlbiB0aGUgYWJvdmUgcHJvY2VzcyBjb21wbGV0ZXMuXG4gKiAgICAgUmVzb2x2ZXMgdG8gYHRydWVgIGlmIHdlIGVuZGVkIHVwIHN0YXJ0aW5nIGEgc2Vzc2lvbiwgb3IgYGZhbHNlYCBpZiB3ZVxuICogICAgIGZhaWxlZC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvYWRTZXNzaW9uKG9wdHM6IElMb2FkU2Vzc2lvbk9wdHMgPSB7fSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIHRyeSB7XG4gICAgICAgIGxldCBlbmFibGVHdWVzdCA9IG9wdHMuZW5hYmxlR3Vlc3QgfHwgZmFsc2U7XG4gICAgICAgIGNvbnN0IGd1ZXN0SHNVcmwgPSBvcHRzLmd1ZXN0SHNVcmw7XG4gICAgICAgIGNvbnN0IGd1ZXN0SXNVcmwgPSBvcHRzLmd1ZXN0SXNVcmw7XG4gICAgICAgIGNvbnN0IGZyYWdtZW50UXVlcnlQYXJhbXMgPSBvcHRzLmZyYWdtZW50UXVlcnlQYXJhbXMgfHwge307XG4gICAgICAgIGNvbnN0IGRlZmF1bHREZXZpY2VEaXNwbGF5TmFtZSA9IG9wdHMuZGVmYXVsdERldmljZURpc3BsYXlOYW1lO1xuXG4gICAgICAgIGlmIChlbmFibGVHdWVzdCAmJiAhZ3Vlc3RIc1VybCkge1xuICAgICAgICAgICAgbG9nZ2VyLndhcm4oXCJDYW5ub3QgZW5hYmxlIGd1ZXN0IGFjY2VzczogY2FuJ3QgZGV0ZXJtaW5lIEhTIFVSTCB0byB1c2VcIik7XG4gICAgICAgICAgICBlbmFibGVHdWVzdCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVuYWJsZUd1ZXN0ICYmIGd1ZXN0SHNVcmwgJiYgZnJhZ21lbnRRdWVyeVBhcmFtcy5ndWVzdF91c2VyX2lkICYmIGZyYWdtZW50UXVlcnlQYXJhbXMuZ3Vlc3RfYWNjZXNzX3Rva2VuKSB7XG4gICAgICAgICAgICBsb2dnZXIubG9nKFwiVXNpbmcgZ3Vlc3QgYWNjZXNzIGNyZWRlbnRpYWxzXCIpO1xuICAgICAgICAgICAgcmV0dXJuIGRvU2V0TG9nZ2VkSW4oXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICB1c2VySWQ6IGZyYWdtZW50UXVlcnlQYXJhbXMuZ3Vlc3RfdXNlcl9pZCBhcyBzdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgIGFjY2Vzc1Rva2VuOiBmcmFnbWVudFF1ZXJ5UGFyYW1zLmd1ZXN0X2FjY2Vzc190b2tlbiBhcyBzdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgIGhvbWVzZXJ2ZXJVcmw6IGd1ZXN0SHNVcmwsXG4gICAgICAgICAgICAgICAgICAgIGlkZW50aXR5U2VydmVyVXJsOiBndWVzdElzVXJsLFxuICAgICAgICAgICAgICAgICAgICBndWVzdDogdHJ1ZSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHRydWUsXG4gICAgICAgICAgICApLnRoZW4oKCkgPT4gdHJ1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgc3VjY2VzcyA9IGF3YWl0IHJlc3RvcmVGcm9tTG9jYWxTdG9yYWdlKHtcbiAgICAgICAgICAgIGlnbm9yZUd1ZXN0OiBCb29sZWFuKG9wdHMuaWdub3JlR3Vlc3QpLFxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKHN1Y2Nlc3MpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVuYWJsZUd1ZXN0ICYmIGd1ZXN0SHNVcmwpIHtcbiAgICAgICAgICAgIHJldHVybiByZWdpc3RlckFzR3Vlc3QoZ3Vlc3RIc1VybCwgZ3Vlc3RJc1VybCwgZGVmYXVsdERldmljZURpc3BsYXlOYW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGZhbGwgYmFjayB0byB3ZWxjb21lIHNjcmVlblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBpZiAoZSBpbnN0YW5jZW9mIEFib3J0TG9naW5BbmRSZWJ1aWxkU3RvcmFnZSkge1xuICAgICAgICAgICAgLy8gSWYgd2UncmUgYWJvcnRpbmcgbG9naW4gYmVjYXVzZSBvZiBhIHN0b3JhZ2UgaW5jb25zaXN0ZW5jeSwgd2UgZG9uJ3RcbiAgICAgICAgICAgIC8vIG5lZWQgdG8gc2hvdyB0aGUgZ2VuZXJhbCBmYWlsdXJlIGRpYWxvZy4gSW5zdGVhZCwganVzdCBnbyBiYWNrIHRvIHdlbGNvbWUuXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGhhbmRsZUxvYWRTZXNzaW9uRmFpbHVyZShlKTtcbiAgICB9XG59XG5cbi8qKlxuICogR2V0cyB0aGUgdXNlciBJRCBvZiB0aGUgcGVyc2lzdGVkIHNlc3Npb24sIGlmIG9uZSBleGlzdHMuIFRoaXMgZG9lcyBub3QgdmFsaWRhdGVcbiAqIHRoYXQgdGhlIHVzZXIncyBjcmVkZW50aWFscyBzdGlsbCB3b3JrLCBqdXN0IHRoYXQgdGhleSBleGlzdCBhbmQgdGhhdCBhIHVzZXIgSURcbiAqIGlzIGFzc29jaWF0ZWQgd2l0aCB0aGVtLiBUaGUgc2Vzc2lvbiBpcyBub3QgbG9hZGVkLlxuICogQHJldHVybnMge1tzdHJpbmcsIGJvb2xlYW5dfSBUaGUgcGVyc2lzdGVkIHNlc3Npb24ncyBvd25lciBhbmQgd2hldGhlciB0aGUgc3RvcmVkXG4gKiAgICAgc2Vzc2lvbiBpcyBmb3IgYSBndWVzdCB1c2VyLCBpZiBhbiBvd25lciBleGlzdHMuIElmIHRoZXJlIGlzIG5vIHN0b3JlZCBzZXNzaW9uLFxuICogICAgIHJldHVybiBbbnVsbCwgbnVsbF0uXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRTdG9yZWRTZXNzaW9uT3duZXIoKTogUHJvbWlzZTxbc3RyaW5nLCBib29sZWFuXSB8IFtudWxsLCBudWxsXT4ge1xuICAgIGNvbnN0IHsgaHNVcmwsIHVzZXJJZCwgaGFzQWNjZXNzVG9rZW4sIGlzR3Vlc3QgfSA9IGF3YWl0IGdldFN0b3JlZFNlc3Npb25WYXJzKCk7XG4gICAgcmV0dXJuIGhzVXJsICYmIHVzZXJJZCAmJiBoYXNBY2Nlc3NUb2tlbiA/IFt1c2VySWQsICEhaXNHdWVzdF0gOiBbbnVsbCwgbnVsbF07XG59XG5cbi8qKlxuICogQHBhcmFtIHtPYmplY3R9IHF1ZXJ5UGFyYW1zICAgIHN0cmluZy0+c3RyaW5nIG1hcCBvZiB0aGVcbiAqICAgICBxdWVyeS1wYXJhbWV0ZXJzIGV4dHJhY3RlZCBmcm9tIHRoZSByZWFsIHF1ZXJ5LXN0cmluZyBvZiB0aGUgc3RhcnRpbmdcbiAqICAgICBVUkkuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IGRlZmF1bHREZXZpY2VEaXNwbGF5TmFtZVxuICogQHBhcmFtIHtzdHJpbmd9IGZyYWdtZW50QWZ0ZXJMb2dpbiBwYXRoIHRvIGdvIHRvIGFmdGVyIGEgc3VjY2Vzc2Z1bCBsb2dpbiwgb25seSB1c2VkIGZvciBcIlRyeSBhZ2FpblwiXG4gKlxuICogQHJldHVybnMge1Byb21pc2V9IHByb21pc2Ugd2hpY2ggcmVzb2x2ZXMgdG8gdHJ1ZSBpZiB3ZSBjb21wbGV0ZWQgdGhlIHRva2VuXG4gKiAgICBsb2dpbiwgZWxzZSBmYWxzZVxuICovXG5leHBvcnQgZnVuY3Rpb24gYXR0ZW1wdFRva2VuTG9naW4oXG4gICAgcXVlcnlQYXJhbXM6IFF1ZXJ5RGljdCxcbiAgICBkZWZhdWx0RGV2aWNlRGlzcGxheU5hbWU/OiBzdHJpbmcsXG4gICAgZnJhZ21lbnRBZnRlckxvZ2luPzogc3RyaW5nLFxuKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgaWYgKCFxdWVyeVBhcmFtcy5sb2dpblRva2VuKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoZmFsc2UpO1xuICAgIH1cblxuICAgIGNvbnN0IGhvbWVzZXJ2ZXIgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbShTU09fSE9NRVNFUlZFUl9VUkxfS0VZKTtcbiAgICBjb25zdCBpZGVudGl0eVNlcnZlciA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKFNTT19JRF9TRVJWRVJfVVJMX0tFWSkgPz8gdW5kZWZpbmVkO1xuICAgIGlmICghaG9tZXNlcnZlcikge1xuICAgICAgICBsb2dnZXIud2FybihcIkNhbm5vdCBsb2cgaW4gd2l0aCB0b2tlbjogY2FuJ3QgZGV0ZXJtaW5lIEhTIFVSTCB0byB1c2VcIik7XG4gICAgICAgIE1vZGFsLmNyZWF0ZURpYWxvZyhFcnJvckRpYWxvZywge1xuICAgICAgICAgICAgdGl0bGU6IF90KFwiV2UgY291bGRuJ3QgbG9nIHlvdSBpblwiKSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBfdChcbiAgICAgICAgICAgICAgICBcIldlIGFza2VkIHRoZSBicm93c2VyIHRvIHJlbWVtYmVyIHdoaWNoIGhvbWVzZXJ2ZXIgeW91IHVzZSB0byBsZXQgeW91IHNpZ24gaW4sIFwiICtcbiAgICAgICAgICAgICAgICAgICAgXCJidXQgdW5mb3J0dW5hdGVseSB5b3VyIGJyb3dzZXIgaGFzIGZvcmdvdHRlbiBpdC4gR28gdG8gdGhlIHNpZ24gaW4gcGFnZSBhbmQgdHJ5IGFnYWluLlwiLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIGJ1dHRvbjogX3QoXCJUcnkgYWdhaW5cIiksXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGZhbHNlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gc2VuZExvZ2luUmVxdWVzdChob21lc2VydmVyLCBpZGVudGl0eVNlcnZlciwgXCJtLmxvZ2luLnRva2VuXCIsIHtcbiAgICAgICAgdG9rZW46IHF1ZXJ5UGFyYW1zLmxvZ2luVG9rZW4gYXMgc3RyaW5nLFxuICAgICAgICBpbml0aWFsX2RldmljZV9kaXNwbGF5X25hbWU6IGRlZmF1bHREZXZpY2VEaXNwbGF5TmFtZSxcbiAgICB9KVxuICAgICAgICAudGhlbihmdW5jdGlvbiAoY3JlZHMpIHtcbiAgICAgICAgICAgIGxvZ2dlci5sb2coXCJMb2dnZWQgaW4gd2l0aCB0b2tlblwiKTtcbiAgICAgICAgICAgIHJldHVybiBjbGVhclN0b3JhZ2UoKS50aGVuKGFzeW5jICgpOiBQcm9taXNlPGJvb2xlYW4+ID0+IHtcbiAgICAgICAgICAgICAgICBhd2FpdCBwZXJzaXN0Q3JlZGVudGlhbHMoY3JlZHMpO1xuICAgICAgICAgICAgICAgIC8vIHJlbWVtYmVyIHRoYXQgd2UganVzdCBsb2dnZWQgaW5cbiAgICAgICAgICAgICAgICBzZXNzaW9uU3RvcmFnZS5zZXRJdGVtKFwibXhfZnJlc2hfbG9naW5cIiwgU3RyaW5nKHRydWUpKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgICAgTW9kYWwuY3JlYXRlRGlhbG9nKEVycm9yRGlhbG9nLCB7XG4gICAgICAgICAgICAgICAgdGl0bGU6IF90KFwiV2UgY291bGRuJ3QgbG9nIHlvdSBpblwiKSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogbWVzc2FnZUZvckxvZ2luRXJyb3IoZXJyLCB7XG4gICAgICAgICAgICAgICAgICAgIGhzVXJsOiBob21lc2VydmVyLFxuICAgICAgICAgICAgICAgICAgICBoc05hbWU6IGhvbWVzZXJ2ZXIsXG4gICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgYnV0dG9uOiBfdChcIlRyeSBhZ2FpblwiKSxcbiAgICAgICAgICAgICAgICBvbkZpbmlzaGVkOiAodHJ5QWdhaW4pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRyeUFnYWluKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjbGkgPSBjcmVhdGVDbGllbnQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJhc2VVcmw6IGhvbWVzZXJ2ZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWRCYXNlVXJsOiBpZGVudGl0eVNlcnZlcixcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaWRwSWQgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbShTU09fSURQX0lEX0tFWSkgfHwgdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgUGxhdGZvcm1QZWcuZ2V0KCk/LnN0YXJ0U2luZ2xlU2lnbk9uKGNsaSwgXCJzc29cIiwgZnJhZ21lbnRBZnRlckxvZ2luLCBpZHBJZCwgU1NPQWN0aW9uLkxPR0lOKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGxvZ2dlci5lcnJvcihcIkZhaWxlZCB0byBsb2cgaW4gd2l0aCBsb2dpbiB0b2tlbjpcIik7XG4gICAgICAgICAgICBsb2dnZXIuZXJyb3IoZXJyKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBoYW5kbGVJbnZhbGlkU3RvcmVFcnJvcihlOiBJbnZhbGlkU3RvcmVFcnJvcik6IFByb21pc2U8dm9pZD4gfCB2b2lkIHtcbiAgICBpZiAoZS5yZWFzb24gPT09IEludmFsaWRTdG9yZUVycm9yLlRPR0dMRURfTEFaWV9MT0FESU5HKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxhenlMb2FkRW5hYmxlZCA9IGUudmFsdWU7XG4gICAgICAgICAgICAgICAgaWYgKGxhenlMb2FkRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIE1vZGFsLmNyZWF0ZURpYWxvZyhMYXp5TG9hZGluZ1Jlc3luY0RpYWxvZywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uRmluaXNoZWQ6IHJlc29sdmUsXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gc2hvdyB3YXJuaW5nIGFib3V0IHNpbXVsdGFuZW91cyB1c2VcbiAgICAgICAgICAgICAgICAgICAgLy8gYmV0d2VlbiBMTC9ub24tTEwgdmVyc2lvbiBvbiBzYW1lIGhvc3QuXG4gICAgICAgICAgICAgICAgICAgIC8vIGFzIGRpc2FibGluZyBMTCB3aGVuIHByZXZpb3VzbHkgZW5hYmxlZFxuICAgICAgICAgICAgICAgICAgICAvLyBpcyBhIHN0cm9uZyBpbmRpY2F0b3Igb2YgdGhpcyAoL2RldmVsb3AgJiAvYXBwKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIE1vZGFsLmNyZWF0ZURpYWxvZyhMYXp5TG9hZGluZ0Rpc2FibGVkRGlhbG9nLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25GaW5pc2hlZDogcmVzb2x2ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBob3N0OiB3aW5kb3cubG9jYXRpb24uaG9zdCxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBNYXRyaXhDbGllbnRQZWcuZ2V0KCkuc3RvcmUuZGVsZXRlQWxsRGF0YSgpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICBQbGF0Zm9ybVBlZy5nZXQoKT8ucmVsb2FkKCk7XG4gICAgICAgICAgICB9KTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlZ2lzdGVyQXNHdWVzdChoc1VybDogc3RyaW5nLCBpc1VybD86IHN0cmluZywgZGVmYXVsdERldmljZURpc3BsYXlOYW1lPzogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgbG9nZ2VyLmxvZyhgRG9pbmcgZ3Vlc3QgbG9naW4gb24gJHtoc1VybH1gKTtcblxuICAgIC8vIGNyZWF0ZSBhIHRlbXBvcmFyeSBNYXRyaXhDbGllbnQgdG8gZG8gdGhlIGxvZ2luXG4gICAgY29uc3QgY2xpZW50ID0gY3JlYXRlQ2xpZW50KHtcbiAgICAgICAgYmFzZVVybDogaHNVcmwsXG4gICAgfSk7XG5cbiAgICByZXR1cm4gY2xpZW50XG4gICAgICAgIC5yZWdpc3Rlckd1ZXN0KHtcbiAgICAgICAgICAgIGJvZHk6IHtcbiAgICAgICAgICAgICAgICBpbml0aWFsX2RldmljZV9kaXNwbGF5X25hbWU6IGRlZmF1bHREZXZpY2VEaXNwbGF5TmFtZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKFxuICAgICAgICAgICAgKGNyZWRzKSA9PiB7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgUmVnaXN0ZXJlZCBhcyBndWVzdDogJHtjcmVkcy51c2VyX2lkfWApO1xuICAgICAgICAgICAgICAgIHJldHVybiBkb1NldExvZ2dlZEluKFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1c2VySWQ6IGNyZWRzLnVzZXJfaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2VJZDogY3JlZHMuZGV2aWNlX2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgYWNjZXNzVG9rZW46IGNyZWRzLmFjY2Vzc190b2tlbixcbiAgICAgICAgICAgICAgICAgICAgICAgIGhvbWVzZXJ2ZXJVcmw6IGhzVXJsLFxuICAgICAgICAgICAgICAgICAgICAgICAgaWRlbnRpdHlTZXJ2ZXJVcmw6IGlzVXJsLFxuICAgICAgICAgICAgICAgICAgICAgICAgZ3Vlc3Q6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHRydWUsXG4gICAgICAgICAgICAgICAgKS50aGVuKCgpID0+IHRydWUpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIChlcnIpID0+IHtcbiAgICAgICAgICAgICAgICBsb2dnZXIuZXJyb3IoXCJGYWlsZWQgdG8gcmVnaXN0ZXIgYXMgZ3Vlc3RcIiwgZXJyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9LFxuICAgICAgICApO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElTdG9yZWRTZXNzaW9uIHtcbiAgICBoc1VybDogc3RyaW5nO1xuICAgIGlzVXJsOiBzdHJpbmc7XG4gICAgaGFzQWNjZXNzVG9rZW46IGJvb2xlYW47XG4gICAgYWNjZXNzVG9rZW46IHN0cmluZyB8IElFbmNyeXB0ZWRQYXlsb2FkO1xuICAgIHVzZXJJZDogc3RyaW5nO1xuICAgIGRldmljZUlkOiBzdHJpbmc7XG4gICAgaXNHdWVzdDogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBSZXRyaWV2ZXMgaW5mb3JtYXRpb24gYWJvdXQgdGhlIHN0b3JlZCBzZXNzaW9uIGZyb20gdGhlIGJyb3dzZXIncyBzdG9yYWdlLiBUaGUgc2Vzc2lvblxuICogbWF5IG5vdCBiZSB2YWxpZCwgYXMgaXQgaXMgbm90IHRlc3RlZCBmb3IgY29uc2lzdGVuY3kgaGVyZS5cbiAqIEByZXR1cm5zIHtPYmplY3R9IEluZm9ybWF0aW9uIGFib3V0IHRoZSBzZXNzaW9uIC0gc2VlIGltcGxlbWVudGF0aW9uIGZvciB2YXJpYWJsZXMuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRTdG9yZWRTZXNzaW9uVmFycygpOiBQcm9taXNlPFBhcnRpYWw8SVN0b3JlZFNlc3Npb24+PiB7XG4gICAgY29uc3QgaHNVcmwgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbShIT01FU0VSVkVSX1VSTF9LRVkpID8/IHVuZGVmaW5lZDtcbiAgICBjb25zdCBpc1VybCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKElEX1NFUlZFUl9VUkxfS0VZKSA/PyB1bmRlZmluZWQ7XG4gICAgbGV0IGFjY2Vzc1Rva2VuOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgdHJ5IHtcbiAgICAgICAgYWNjZXNzVG9rZW4gPSBhd2FpdCBTdG9yYWdlTWFuYWdlci5pZGJMb2FkKFwiYWNjb3VudFwiLCBcIm14X2FjY2Vzc190b2tlblwiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcihcIlN0b3JhZ2VNYW5hZ2VyLmlkYkxvYWQgZmFpbGVkIGZvciBhY2NvdW50Om14X2FjY2Vzc190b2tlblwiLCBlKTtcbiAgICB9XG4gICAgaWYgKCFhY2Nlc3NUb2tlbikge1xuICAgICAgICBhY2Nlc3NUb2tlbiA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKFwibXhfYWNjZXNzX3Rva2VuXCIpID8/IHVuZGVmaW5lZDtcbiAgICAgICAgaWYgKGFjY2Vzc1Rva2VuKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIC8vIHRyeSB0byBtaWdyYXRlIGFjY2VzcyB0b2tlbiB0byBJbmRleGVkREIgaWYgd2UgY2FuXG4gICAgICAgICAgICAgICAgYXdhaXQgU3RvcmFnZU1hbmFnZXIuaWRiU2F2ZShcImFjY291bnRcIiwgXCJteF9hY2Nlc3NfdG9rZW5cIiwgYWNjZXNzVG9rZW4pO1xuICAgICAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKFwibXhfYWNjZXNzX3Rva2VuXCIpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGxvZ2dlci5lcnJvcihcIm1pZ3JhdGlvbiBvZiBhY2Nlc3MgdG9rZW4gdG8gSW5kZXhlZERCIGZhaWxlZFwiLCBlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICAvLyBpZiB3ZSBwcmUtZGF0ZSBzdG9yaW5nIFwibXhfaGFzX2FjY2Vzc190b2tlblwiLCBidXQgd2UgcmV0cmlldmVkIGFuIGFjY2Vzc1xuICAgIC8vIHRva2VuLCB0aGVuIHdlIHNob3VsZCBzYXkgd2UgaGF2ZSBhbiBhY2Nlc3MgdG9rZW5cbiAgICBjb25zdCBoYXNBY2Nlc3NUb2tlbiA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKFwibXhfaGFzX2FjY2Vzc190b2tlblwiKSA9PT0gXCJ0cnVlXCIgfHwgISFhY2Nlc3NUb2tlbjtcbiAgICBjb25zdCB1c2VySWQgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbShcIm14X3VzZXJfaWRcIikgPz8gdW5kZWZpbmVkO1xuICAgIGNvbnN0IGRldmljZUlkID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJteF9kZXZpY2VfaWRcIikgPz8gdW5kZWZpbmVkO1xuXG4gICAgbGV0IGlzR3Vlc3Q6IGJvb2xlYW47XG4gICAgaWYgKGxvY2FsU3RvcmFnZS5nZXRJdGVtKFwibXhfaXNfZ3Vlc3RcIikgIT09IG51bGwpIHtcbiAgICAgICAgaXNHdWVzdCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKFwibXhfaXNfZ3Vlc3RcIikgPT09IFwidHJ1ZVwiO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGxlZ2FjeSBrZXkgbmFtZVxuICAgICAgICBpc0d1ZXN0ID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJtYXRyaXgtaXMtZ3Vlc3RcIikgPT09IFwidHJ1ZVwiO1xuICAgIH1cblxuICAgIHJldHVybiB7IGhzVXJsLCBpc1VybCwgaGFzQWNjZXNzVG9rZW4sIGFjY2Vzc1Rva2VuLCB1c2VySWQsIGRldmljZUlkLCBpc0d1ZXN0IH07XG59XG5cbi8vIFRoZSBwaWNrbGUga2V5IGlzIGEgc3RyaW5nIG9mIHVuc3BlY2lmaWVkIGxlbmd0aCBhbmQgZm9ybWF0LiAgRm9yIEFFUywgd2Vcbi8vIG5lZWQgYSAyNTYtYml0IFVpbnQ4QXJyYXkuIFNvIHdlIEhLREYgdGhlIHBpY2tsZSBrZXkgdG8gZ2VuZXJhdGUgdGhlIEFFU1xuLy8ga2V5LiAgVGhlIEFFUyBrZXkgc2hvdWxkIGJlIHplcm9lZCBhZnRlciBpdCBpcyB1c2VkLlxuYXN5bmMgZnVuY3Rpb24gcGlja2xlS2V5VG9BZXNLZXkocGlja2xlS2V5OiBzdHJpbmcpOiBQcm9taXNlPFVpbnQ4QXJyYXk+IHtcbiAgICBjb25zdCBwaWNrbGVLZXlCdWZmZXIgPSBuZXcgVWludDhBcnJheShwaWNrbGVLZXkubGVuZ3RoKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBpY2tsZUtleS5sZW5ndGg7IGkrKykge1xuICAgICAgICBwaWNrbGVLZXlCdWZmZXJbaV0gPSBwaWNrbGVLZXkuY2hhckNvZGVBdChpKTtcbiAgICB9XG4gICAgY29uc3QgaGtkZktleSA9IGF3YWl0IHdpbmRvdy5jcnlwdG8uc3VidGxlLmltcG9ydEtleShcInJhd1wiLCBwaWNrbGVLZXlCdWZmZXIsIFwiSEtERlwiLCBmYWxzZSwgW1wiZGVyaXZlQml0c1wiXSk7XG4gICAgcGlja2xlS2V5QnVmZmVyLmZpbGwoMCk7XG4gICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KFxuICAgICAgICBhd2FpdCB3aW5kb3cuY3J5cHRvLnN1YnRsZS5kZXJpdmVCaXRzKFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6IFwiSEtERlwiLFxuICAgICAgICAgICAgICAgIGhhc2g6IFwiU0hBLTI1NlwiLFxuICAgICAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvYmFuLXRzLWNvbW1lbnRcbiAgICAgICAgICAgICAgICAvLyBAdHMtaWdub3JlOiBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L1R5cGVTY3JpcHQtRE9NLWxpYi1nZW5lcmF0b3IvcHVsbC84NzlcbiAgICAgICAgICAgICAgICBzYWx0OiBuZXcgVWludDhBcnJheSgzMiksXG4gICAgICAgICAgICAgICAgaW5mbzogbmV3IFVpbnQ4QXJyYXkoMCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgaGtkZktleSxcbiAgICAgICAgICAgIDI1NixcbiAgICAgICAgKSxcbiAgICApO1xufVxuXG5hc3luYyBmdW5jdGlvbiBhYm9ydExvZ2luKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHNpZ25PdXQgPSBhd2FpdCBzaG93U3RvcmFnZUV2aWN0ZWREaWFsb2coKTtcbiAgICBpZiAoc2lnbk91dCkge1xuICAgICAgICBhd2FpdCBjbGVhclN0b3JhZ2UoKTtcbiAgICAgICAgLy8gVGhpcyBlcnJvciBmZWVscyBhIGJpdCBjbHVua3ksIGJ1dCB3ZSB3YW50IHRvIG1ha2Ugc3VyZSB3ZSBkb24ndCBnbyBhbnlcbiAgICAgICAgLy8gZnVydGhlciBhbmQgaW5zdGVhZCBoZWFkIGJhY2sgdG8gc2lnbiBpbi5cbiAgICAgICAgdGhyb3cgbmV3IEFib3J0TG9naW5BbmRSZWJ1aWxkU3RvcmFnZShcIkFib3J0aW5nIGxvZ2luIGluIHByb2dyZXNzIGJlY2F1c2Ugb2Ygc3RvcmFnZSBpbmNvbnNpc3RlbmN5XCIpO1xuICAgIH1cbn1cblxuLy8gcmV0dXJucyBhIHByb21pc2Ugd2hpY2ggcmVzb2x2ZXMgdG8gdHJ1ZSBpZiBhIHNlc3Npb24gaXMgZm91bmQgaW5cbi8vIGxvY2Fsc3RvcmFnZVxuLy9cbi8vIE4uQi4gTGlmZWN5Y2xlLmpzIHNob3VsZCBub3QgbWFpbnRhaW4gYW55IGZ1cnRoZXIgbG9jYWxTdG9yYWdlIHN0YXRlLCB3ZVxuLy8gICAgICBhcmUgbW92aW5nIHRvd2FyZHMgdXNpbmcgU2Vzc2lvblN0b3JlIHRvIGtlZXAgdHJhY2sgb2Ygc3RhdGUgcmVsYXRlZFxuLy8gICAgICB0byB0aGUgY3VycmVudCBzZXNzaW9uICh3aGljaCBpcyB0eXBpY2FsbHkgYmFja2VkIGJ5IGxvY2FsU3RvcmFnZSkuXG4vL1xuLy8gICAgICBUaGUgcGxhbiBpcyB0byBncmFkdWFsbHkgbW92ZSB0aGUgbG9jYWxTdG9yYWdlIGFjY2VzcyBkb25lIGhlcmUgaW50b1xuLy8gICAgICBTZXNzaW9uU3RvcmUgdG8gYXZvaWQgYnVncyB3aGVyZSB0aGUgdmlldyBiZWNvbWVzIG91dC1vZi1zeW5jIHdpdGhcbi8vICAgICAgbG9jYWxTdG9yYWdlIChlLmcuIGlzR3Vlc3QgZXRjLilcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZXN0b3JlRnJvbUxvY2FsU3RvcmFnZShvcHRzPzogeyBpZ25vcmVHdWVzdD86IGJvb2xlYW4gfSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGNvbnN0IGlnbm9yZUd1ZXN0ID0gb3B0cz8uaWdub3JlR3Vlc3Q7XG5cbiAgICBpZiAoIWxvY2FsU3RvcmFnZSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgY29uc3QgeyBoc1VybCwgaXNVcmwsIGhhc0FjY2Vzc1Rva2VuLCBhY2Nlc3NUb2tlbiwgdXNlcklkLCBkZXZpY2VJZCwgaXNHdWVzdCB9ID0gYXdhaXQgZ2V0U3RvcmVkU2Vzc2lvblZhcnMoKTtcblxuICAgIGlmIChoYXNBY2Nlc3NUb2tlbiAmJiAhYWNjZXNzVG9rZW4pIHtcbiAgICAgICAgYXdhaXQgYWJvcnRMb2dpbigpO1xuICAgIH1cblxuICAgIGlmIChhY2Nlc3NUb2tlbiAmJiB1c2VySWQgJiYgaHNVcmwpIHtcbiAgICAgICAgaWYgKGlnbm9yZUd1ZXN0ICYmIGlzR3Vlc3QpIHtcbiAgICAgICAgICAgIGxvZ2dlci5sb2coXCJJZ25vcmluZyBzdG9yZWQgZ3Vlc3QgYWNjb3VudDogXCIgKyB1c2VySWQpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGRlY3J5cHRlZEFjY2Vzc1Rva2VuID0gYWNjZXNzVG9rZW47XG4gICAgICAgIGNvbnN0IHBpY2tsZUtleSA9IGF3YWl0IFBsYXRmb3JtUGVnLmdldCgpPy5nZXRQaWNrbGVLZXkodXNlcklkLCBkZXZpY2VJZCA/PyBcIlwiKTtcbiAgICAgICAgaWYgKHBpY2tsZUtleSkge1xuICAgICAgICAgICAgbG9nZ2VyLmxvZyhcIkdvdCBwaWNrbGUga2V5XCIpO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBhY2Nlc3NUb2tlbiAhPT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGVuY3JLZXkgPSBhd2FpdCBwaWNrbGVLZXlUb0Flc0tleShwaWNrbGVLZXkpO1xuICAgICAgICAgICAgICAgIGRlY3J5cHRlZEFjY2Vzc1Rva2VuID0gYXdhaXQgZGVjcnlwdEFFUyhhY2Nlc3NUb2tlbiwgZW5jcktleSwgXCJhY2Nlc3NfdG9rZW5cIik7XG4gICAgICAgICAgICAgICAgZW5jcktleS5maWxsKDApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbG9nZ2VyLmxvZyhcIk5vIHBpY2tsZSBrZXkgYXZhaWxhYmxlXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZnJlc2hMb2dpbiA9IHNlc3Npb25TdG9yYWdlLmdldEl0ZW0oXCJteF9mcmVzaF9sb2dpblwiKSA9PT0gXCJ0cnVlXCI7XG4gICAgICAgIHNlc3Npb25TdG9yYWdlLnJlbW92ZUl0ZW0oXCJteF9mcmVzaF9sb2dpblwiKTtcblxuICAgICAgICBsb2dnZXIubG9nKGBSZXN0b3Jpbmcgc2Vzc2lvbiBmb3IgJHt1c2VySWR9YCk7XG4gICAgICAgIGF3YWl0IGRvU2V0TG9nZ2VkSW4oXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdXNlcklkOiB1c2VySWQsXG4gICAgICAgICAgICAgICAgZGV2aWNlSWQ6IGRldmljZUlkLFxuICAgICAgICAgICAgICAgIGFjY2Vzc1Rva2VuOiBkZWNyeXB0ZWRBY2Nlc3NUb2tlbiBhcyBzdHJpbmcsXG4gICAgICAgICAgICAgICAgaG9tZXNlcnZlclVybDogaHNVcmwsXG4gICAgICAgICAgICAgICAgaWRlbnRpdHlTZXJ2ZXJVcmw6IGlzVXJsLFxuICAgICAgICAgICAgICAgIGd1ZXN0OiBpc0d1ZXN0LFxuICAgICAgICAgICAgICAgIHBpY2tsZUtleTogcGlja2xlS2V5ID8/IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICBmcmVzaExvZ2luOiBmcmVzaExvZ2luLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZhbHNlLFxuICAgICAgICApO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBsb2dnZXIubG9nKFwiTm8gcHJldmlvdXMgc2Vzc2lvbiBmb3VuZC5cIik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZUxvYWRTZXNzaW9uRmFpbHVyZShlOiBFcnJvcik6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGxvZ2dlci5lcnJvcihcIlVuYWJsZSB0byBsb2FkIHNlc3Npb25cIiwgZSk7XG5cbiAgICBjb25zdCBtb2RhbCA9IE1vZGFsLmNyZWF0ZURpYWxvZyhTZXNzaW9uUmVzdG9yZUVycm9yRGlhbG9nLCB7XG4gICAgICAgIGVycm9yOiBlLFxuICAgIH0pO1xuXG4gICAgY29uc3QgW3N1Y2Nlc3NdID0gYXdhaXQgbW9kYWwuZmluaXNoZWQ7XG4gICAgaWYgKHN1Y2Nlc3MpIHtcbiAgICAgICAgLy8gdXNlciBjbGlja2VkIGNvbnRpbnVlLlxuICAgICAgICBhd2FpdCBjbGVhclN0b3JhZ2UoKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIHRyeSwgdHJ5IGFnYWluXG4gICAgcmV0dXJuIGxvYWRTZXNzaW9uKCk7XG59XG5cbi8qKlxuICogVHJhbnNpdGlvbnMgdG8gYSBsb2dnZWQtaW4gc3RhdGUgdXNpbmcgdGhlIGdpdmVuIGNyZWRlbnRpYWxzLlxuICpcbiAqIFN0YXJ0cyB0aGUgbWF0cml4IGNsaWVudCBhbmQgYWxsIG90aGVyIHJlYWN0LXNkayBzZXJ2aWNlcyB0aGF0XG4gKiBsaXN0ZW4gZm9yIGV2ZW50cyB3aGlsZSBhIHNlc3Npb24gaXMgbG9nZ2VkIGluLlxuICpcbiAqIEFsc28gc3RvcHMgdGhlIG9sZCBNYXRyaXhDbGllbnQgYW5kIGNsZWFycyBvbGQgY3JlZGVudGlhbHMvZXRjIG91dCBvZlxuICogc3RvcmFnZSBiZWZvcmUgc3RhcnRpbmcgdGhlIG5ldyBjbGllbnQuXG4gKlxuICogQHBhcmFtIHtJTWF0cml4Q2xpZW50Q3JlZHN9IGNyZWRlbnRpYWxzIFRoZSBjcmVkZW50aWFscyB0byB1c2VcbiAqXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gcHJvbWlzZSB3aGljaCByZXNvbHZlcyB0byB0aGUgbmV3IE1hdHJpeENsaWVudCBvbmNlIGl0IGhhcyBiZWVuIHN0YXJ0ZWRcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNldExvZ2dlZEluKGNyZWRlbnRpYWxzOiBJTWF0cml4Q2xpZW50Q3JlZHMpOiBQcm9taXNlPE1hdHJpeENsaWVudD4ge1xuICAgIGNyZWRlbnRpYWxzLmZyZXNoTG9naW4gPSB0cnVlO1xuICAgIHN0b3BNYXRyaXhDbGllbnQoKTtcbiAgICBjb25zdCBwaWNrbGVLZXkgPVxuICAgICAgICBjcmVkZW50aWFscy51c2VySWQgJiYgY3JlZGVudGlhbHMuZGV2aWNlSWRcbiAgICAgICAgICAgID8gYXdhaXQgUGxhdGZvcm1QZWcuZ2V0KCk/LmNyZWF0ZVBpY2tsZUtleShjcmVkZW50aWFscy51c2VySWQsIGNyZWRlbnRpYWxzLmRldmljZUlkKVxuICAgICAgICAgICAgOiBudWxsO1xuXG4gICAgaWYgKHBpY2tsZUtleSkge1xuICAgICAgICBsb2dnZXIubG9nKFwiQ3JlYXRlZCBwaWNrbGUga2V5XCIpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGxvZ2dlci5sb2coXCJQaWNrbGUga2V5IG5vdCBjcmVhdGVkXCIpO1xuICAgIH1cblxuICAgIHJldHVybiBkb1NldExvZ2dlZEluKE9iamVjdC5hc3NpZ24oe30sIGNyZWRlbnRpYWxzLCB7IHBpY2tsZUtleSB9KSwgdHJ1ZSk7XG59XG5cbi8qKlxuICogSHlkcmF0ZXMgYW4gZXhpc3Rpbmcgc2Vzc2lvbiBieSB1c2luZyB0aGUgY3JlZGVudGlhbHMgcHJvdmlkZWQuIFRoaXMgd2lsbFxuICogbm90IGNsZWFyIGFueSBsb2NhbCBzdG9yYWdlLCB1bmxpa2Ugc2V0TG9nZ2VkSW4oKS5cbiAqXG4gKiBTdG9wcyB0aGUgZXhpc3RpbmcgTWF0cml4IGNsaWVudCAod2l0aG91dCBjbGVhcmluZyBpdHMgZGF0YSkgYW5kIHN0YXJ0cyBhXG4gKiBuZXcgb25lIGluIGl0cyBwbGFjZS4gVGhpcyBhZGRpdGlvbmFsbHkgc3RhcnRzIGFsbCBvdGhlciByZWFjdC1zZGsgc2VydmljZXNcbiAqIHdoaWNoIHVzZSB0aGUgbmV3IE1hdHJpeCBjbGllbnQuXG4gKlxuICogSWYgdGhlIGNyZWRlbnRpYWxzIGJlbG9uZyB0byBhIGRpZmZlcmVudCB1c2VyIGZyb20gdGhlIHNlc3Npb24gYWxyZWFkeSBzdG9yZWQsXG4gKiB0aGUgb2xkIHNlc3Npb24gd2lsbCBiZSBjbGVhcmVkIGF1dG9tYXRpY2FsbHkuXG4gKlxuICogQHBhcmFtIHtJTWF0cml4Q2xpZW50Q3JlZHN9IGNyZWRlbnRpYWxzIFRoZSBjcmVkZW50aWFscyB0byB1c2VcbiAqXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gcHJvbWlzZSB3aGljaCByZXNvbHZlcyB0byB0aGUgbmV3IE1hdHJpeENsaWVudCBvbmNlIGl0IGhhcyBiZWVuIHN0YXJ0ZWRcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGh5ZHJhdGVTZXNzaW9uKGNyZWRlbnRpYWxzOiBJTWF0cml4Q2xpZW50Q3JlZHMpOiBQcm9taXNlPE1hdHJpeENsaWVudD4ge1xuICAgIGNvbnN0IG9sZFVzZXJJZCA9IE1hdHJpeENsaWVudFBlZy5nZXQoKS5nZXRVc2VySWQoKTtcbiAgICBjb25zdCBvbGREZXZpY2VJZCA9IE1hdHJpeENsaWVudFBlZy5nZXQoKS5nZXREZXZpY2VJZCgpO1xuXG4gICAgc3RvcE1hdHJpeENsaWVudCgpOyAvLyB1bnNldHMgTWF0cml4Q2xpZW50UGVnLmdldCgpXG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oXCJteF9zb2Z0X2xvZ291dFwiKTtcbiAgICBfaXNMb2dnaW5nT3V0ID0gZmFsc2U7XG5cbiAgICBjb25zdCBvdmVyd3JpdGUgPSBjcmVkZW50aWFscy51c2VySWQgIT09IG9sZFVzZXJJZCB8fCBjcmVkZW50aWFscy5kZXZpY2VJZCAhPT0gb2xkRGV2aWNlSWQ7XG4gICAgaWYgKG92ZXJ3cml0ZSkge1xuICAgICAgICBsb2dnZXIud2FybihcIkNsZWFyaW5nIGFsbCBkYXRhOiBPbGQgc2Vzc2lvbiBiZWxvbmdzIHRvIGEgZGlmZmVyZW50IHVzZXIvc2Vzc2lvblwiKTtcbiAgICB9XG5cbiAgICBpZiAoIWNyZWRlbnRpYWxzLnBpY2tsZUtleSAmJiBjcmVkZW50aWFscy5kZXZpY2VJZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGxvZ2dlci5pbmZvKFwiTGlmZWN5Y2xlI2h5ZHJhdGVTZXNzaW9uOiBQaWNrbGUga2V5IG5vdCBwcm92aWRlZCAtIHRyeWluZyB0byBnZXQgb25lXCIpO1xuICAgICAgICBjcmVkZW50aWFscy5waWNrbGVLZXkgPVxuICAgICAgICAgICAgKGF3YWl0IFBsYXRmb3JtUGVnLmdldCgpPy5nZXRQaWNrbGVLZXkoY3JlZGVudGlhbHMudXNlcklkLCBjcmVkZW50aWFscy5kZXZpY2VJZCkpID8/IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICByZXR1cm4gZG9TZXRMb2dnZWRJbihjcmVkZW50aWFscywgb3ZlcndyaXRlKTtcbn1cblxuLyoqXG4gKiBvcHRpb25hbGx5IGNsZWFycyBsb2NhbHN0b3JhZ2UsIHBlcnNpc3RzIG5ldyBjcmVkZW50aWFsc1xuICogdG8gbG9jYWxzdG9yYWdlLCBzdGFydHMgdGhlIG5ldyBjbGllbnQuXG4gKlxuICogQHBhcmFtIHtJTWF0cml4Q2xpZW50Q3JlZHN9IGNyZWRlbnRpYWxzXG4gKiBAcGFyYW0ge0Jvb2xlYW59IGNsZWFyU3RvcmFnZUVuYWJsZWRcbiAqXG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gcHJvbWlzZSB3aGljaCByZXNvbHZlcyB0byB0aGUgbmV3IE1hdHJpeENsaWVudCBvbmNlIGl0IGhhcyBiZWVuIHN0YXJ0ZWRcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZG9TZXRMb2dnZWRJbihjcmVkZW50aWFsczogSU1hdHJpeENsaWVudENyZWRzLCBjbGVhclN0b3JhZ2VFbmFibGVkOiBib29sZWFuKTogUHJvbWlzZTxNYXRyaXhDbGllbnQ+IHtcbiAgICBjcmVkZW50aWFscy5ndWVzdCA9IEJvb2xlYW4oY3JlZGVudGlhbHMuZ3Vlc3QpO1xuXG4gICAgY29uc3Qgc29mdExvZ291dCA9IGlzU29mdExvZ291dCgpO1xuXG4gICAgbG9nZ2VyLmxvZyhcbiAgICAgICAgXCJzZXRMb2dnZWRJbjogbXhpZDogXCIgK1xuICAgICAgICAgICAgY3JlZGVudGlhbHMudXNlcklkICtcbiAgICAgICAgICAgIFwiIGRldmljZUlkOiBcIiArXG4gICAgICAgICAgICBjcmVkZW50aWFscy5kZXZpY2VJZCArXG4gICAgICAgICAgICBcIiBndWVzdDogXCIgK1xuICAgICAgICAgICAgY3JlZGVudGlhbHMuZ3Vlc3QgK1xuICAgICAgICAgICAgXCIgaHM6IFwiICtcbiAgICAgICAgICAgIGNyZWRlbnRpYWxzLmhvbWVzZXJ2ZXJVcmwgK1xuICAgICAgICAgICAgXCIgc29mdExvZ291dDogXCIgK1xuICAgICAgICAgICAgc29mdExvZ291dCxcbiAgICAgICAgXCIgZnJlc2hMb2dpbjogXCIgKyBjcmVkZW50aWFscy5mcmVzaExvZ2luLFxuICAgICk7XG5cbiAgICBpZiAoY2xlYXJTdG9yYWdlRW5hYmxlZCkge1xuICAgICAgICBhd2FpdCBjbGVhclN0b3JhZ2UoKTtcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgU3RvcmFnZU1hbmFnZXIuY2hlY2tDb25zaXN0ZW5jeSgpO1xuICAgIC8vIElmIHRoZXJlJ3MgYW4gaW5jb25zaXN0ZW5jeSBiZXR3ZWVuIGFjY291bnQgZGF0YSBpbiBsb2NhbCBzdG9yYWdlIGFuZCB0aGVcbiAgICAvLyBjcnlwdG8gc3RvcmUsIHdlJ2xsIGJlIGdlbmVyYWxseSBjb25mdXNlZCB3aGVuIGhhbmRsaW5nIGVuY3J5cHRlZCBkYXRhLlxuICAgIC8vIFNob3cgYSBtb2RhbCByZWNvbW1lbmRpbmcgYSBmdWxsIHJlc2V0IG9mIHN0b3JhZ2UuXG4gICAgaWYgKHJlc3VsdHMuZGF0YUluTG9jYWxTdG9yYWdlICYmIHJlc3VsdHMuY3J5cHRvSW5pdGVkICYmICFyZXN1bHRzLmRhdGFJbkNyeXB0b1N0b3JlKSB7XG4gICAgICAgIGF3YWl0IGFib3J0TG9naW4oKTtcbiAgICB9XG5cbiAgICBNYXRyaXhDbGllbnRQZWcucmVwbGFjZVVzaW5nQ3JlZHMoY3JlZGVudGlhbHMpO1xuICAgIGNvbnN0IGNsaWVudCA9IE1hdHJpeENsaWVudFBlZy5nZXQoKTtcblxuICAgIHNldFNlbnRyeVVzZXIoY3JlZGVudGlhbHMudXNlcklkKTtcblxuICAgIGlmIChQb3N0aG9nQW5hbHl0aWNzLmluc3RhbmNlLmlzRW5hYmxlZCgpKSB7XG4gICAgICAgIFBvc3Rob2dBbmFseXRpY3MuaW5zdGFuY2Uuc3RhcnRMaXN0ZW5pbmdUb1NldHRpbmdzQ2hhbmdlcyhjbGllbnQpO1xuICAgIH1cblxuICAgIGlmIChjcmVkZW50aWFscy5mcmVzaExvZ2luICYmIFNldHRpbmdzU3RvcmUuZ2V0VmFsdWUoXCJmZWF0dXJlX2RlaHlkcmF0aW9uXCIpKSB7XG4gICAgICAgIC8vIElmIHdlIGp1c3QgbG9nZ2VkIGluLCB0cnkgdG8gcmVoeWRyYXRlIGEgZGV2aWNlIGluc3RlYWQgb2YgdXNpbmcgYVxuICAgICAgICAvLyBuZXcgZGV2aWNlLiAgSWYgaXQgc3VjY2VlZHMsIHdlJ2xsIGdldCBhIG5ldyBkZXZpY2UgSUQsIHNvIG1ha2Ugc3VyZVxuICAgICAgICAvLyB3ZSBwZXJzaXN0IHRoYXQgSUQgdG8gbG9jYWxTdG9yYWdlXG4gICAgICAgIGNvbnN0IG5ld0RldmljZUlkID0gYXdhaXQgY2xpZW50LnJlaHlkcmF0ZURldmljZSgpO1xuICAgICAgICBpZiAobmV3RGV2aWNlSWQpIHtcbiAgICAgICAgICAgIGNyZWRlbnRpYWxzLmRldmljZUlkID0gbmV3RGV2aWNlSWQ7XG4gICAgICAgIH1cblxuICAgICAgICBkZWxldGUgY3JlZGVudGlhbHMuZnJlc2hMb2dpbjtcbiAgICB9XG5cbiAgICBpZiAobG9jYWxTdG9yYWdlKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBwZXJzaXN0Q3JlZGVudGlhbHMoY3JlZGVudGlhbHMpO1xuICAgICAgICAgICAgLy8gbWFrZSBzdXJlIHdlIGRvbid0IHRoaW5rIHRoYXQgaXQncyBhIGZyZXNoIGxvZ2luIGFueSBtb3JlXG4gICAgICAgICAgICBzZXNzaW9uU3RvcmFnZS5yZW1vdmVJdGVtKFwibXhfZnJlc2hfbG9naW5cIik7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGxvZ2dlci53YXJuKFwiRXJyb3IgdXNpbmcgbG9jYWwgc3RvcmFnZTogY2FuJ3QgcGVyc2lzdCBzZXNzaW9uIVwiLCBlKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGxvZ2dlci53YXJuKFwiTm8gbG9jYWwgc3RvcmFnZSBhdmFpbGFibGU6IGNhbid0IHBlcnNpc3Qgc2Vzc2lvbiFcIik7XG4gICAgfVxuXG4gICAgZGlzLmZpcmUoQWN0aW9uLk9uTG9nZ2VkSW4pO1xuICAgIGF3YWl0IHN0YXJ0TWF0cml4Q2xpZW50KGNsaWVudCwgLypzdGFydFN5bmNpbmc9Ki8gIXNvZnRMb2dvdXQpO1xuXG4gICAgcmV0dXJuIGNsaWVudDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gc2hvd1N0b3JhZ2VFdmljdGVkRGlhbG9nKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGNvbnN0IHsgZmluaXNoZWQgfSA9IE1vZGFsLmNyZWF0ZURpYWxvZyhTdG9yYWdlRXZpY3RlZERpYWxvZyk7XG4gICAgY29uc3QgW29rXSA9IGF3YWl0IGZpbmlzaGVkO1xuICAgIHJldHVybiAhIW9rO1xufVxuXG4vLyBOb3RlOiBCYWJlbCA2IHJlcXVpcmVzIHRoZSBgdHJhbnNmb3JtLWJ1aWx0aW4tZXh0ZW5kYCBwbHVnaW4gZm9yIHRoaXMgdG8gc2F0aXNmeVxuLy8gYGluc3RhbmNlb2ZgLiBCYWJlbCA3IHN1cHBvcnRzIHRoaXMgbmF0aXZlbHkgaW4gdGhlaXIgY2xhc3MgaGFuZGxpbmcuXG5jbGFzcyBBYm9ydExvZ2luQW5kUmVidWlsZFN0b3JhZ2UgZXh0ZW5kcyBFcnJvciB7fVxuXG5hc3luYyBmdW5jdGlvbiBwZXJzaXN0Q3JlZGVudGlhbHMoY3JlZGVudGlhbHM6IElNYXRyaXhDbGllbnRDcmVkcyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKEhPTUVTRVJWRVJfVVJMX0tFWSwgY3JlZGVudGlhbHMuaG9tZXNlcnZlclVybCk7XG4gICAgaWYgKGNyZWRlbnRpYWxzLmlkZW50aXR5U2VydmVyVXJsKSB7XG4gICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKElEX1NFUlZFUl9VUkxfS0VZLCBjcmVkZW50aWFscy5pZGVudGl0eVNlcnZlclVybCk7XG4gICAgfVxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFwibXhfdXNlcl9pZFwiLCBjcmVkZW50aWFscy51c2VySWQpO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFwibXhfaXNfZ3Vlc3RcIiwgSlNPTi5zdHJpbmdpZnkoY3JlZGVudGlhbHMuZ3Vlc3QpKTtcblxuICAgIC8vIHN0b3JlIHdoZXRoZXIgd2UgZXhwZWN0IHRvIGZpbmQgYW4gYWNjZXNzIHRva2VuLCB0byBkZXRlY3QgdGhlIGNhc2VcbiAgICAvLyB3aGVyZSBJbmRleGVkREIgaXMgYmxvd24gYXdheVxuICAgIGlmIChjcmVkZW50aWFscy5hY2Nlc3NUb2tlbikge1xuICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShcIm14X2hhc19hY2Nlc3NfdG9rZW5cIiwgXCJ0cnVlXCIpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGxvY2FsU3RvcmFnZS5kZWxldGVJdGVtKFwibXhfaGFzX2FjY2Vzc190b2tlblwiKTtcbiAgICB9XG5cbiAgICBpZiAoY3JlZGVudGlhbHMucGlja2xlS2V5KSB7XG4gICAgICAgIGxldCBlbmNyeXB0ZWRBY2Nlc3NUb2tlbjogSUVuY3J5cHRlZFBheWxvYWQgfCB1bmRlZmluZWQ7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyB0cnkgdG8gZW5jcnlwdCB0aGUgYWNjZXNzIHRva2VuIHVzaW5nIHRoZSBwaWNrbGUga2V5XG4gICAgICAgICAgICBjb25zdCBlbmNyS2V5ID0gYXdhaXQgcGlja2xlS2V5VG9BZXNLZXkoY3JlZGVudGlhbHMucGlja2xlS2V5KTtcbiAgICAgICAgICAgIGVuY3J5cHRlZEFjY2Vzc1Rva2VuID0gYXdhaXQgZW5jcnlwdEFFUyhjcmVkZW50aWFscy5hY2Nlc3NUb2tlbiwgZW5jcktleSwgXCJhY2Nlc3NfdG9rZW5cIik7XG4gICAgICAgICAgICBlbmNyS2V5LmZpbGwoMCk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGxvZ2dlci53YXJuKFwiQ291bGQgbm90IGVuY3J5cHQgYWNjZXNzIHRva2VuXCIsIGUpO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBzYXZlIGVpdGhlciB0aGUgZW5jcnlwdGVkIGFjY2VzcyB0b2tlbiwgb3IgdGhlIHBsYWluIGFjY2Vzc1xuICAgICAgICAgICAgLy8gdG9rZW4gaWYgd2Ugd2VyZSB1bmFibGUgdG8gZW5jcnlwdCAoZS5nLiBpZiB0aGUgYnJvd3NlciBkb2Vzbid0XG4gICAgICAgICAgICAvLyBoYXZlIFdlYkNyeXB0bykuXG4gICAgICAgICAgICBhd2FpdCBTdG9yYWdlTWFuYWdlci5pZGJTYXZlKFwiYWNjb3VudFwiLCBcIm14X2FjY2Vzc190b2tlblwiLCBlbmNyeXB0ZWRBY2Nlc3NUb2tlbiB8fCBjcmVkZW50aWFscy5hY2Nlc3NUb2tlbik7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIC8vIGlmIHdlIGNvdWxkbid0IHNhdmUgdG8gaW5kZXhlZERCLCBmYWxsIGJhY2sgdG8gbG9jYWxTdG9yYWdlLiAgV2VcbiAgICAgICAgICAgIC8vIHN0b3JlIHRoZSBhY2Nlc3MgdG9rZW4gdW5lbmNyeXB0ZWQgc2luY2UgbG9jYWxTdG9yYWdlIG9ubHkgc2F2ZXNcbiAgICAgICAgICAgIC8vIHN0cmluZ3MuXG4gICAgICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShcIm14X2FjY2Vzc190b2tlblwiLCBjcmVkZW50aWFscy5hY2Nlc3NUb2tlbik7XG4gICAgICAgIH1cbiAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oXCJteF9oYXNfcGlja2xlX2tleVwiLCBTdHJpbmcodHJ1ZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBTdG9yYWdlTWFuYWdlci5pZGJTYXZlKFwiYWNjb3VudFwiLCBcIm14X2FjY2Vzc190b2tlblwiLCBjcmVkZW50aWFscy5hY2Nlc3NUb2tlbik7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFwibXhfYWNjZXNzX3Rva2VuXCIsIGNyZWRlbnRpYWxzLmFjY2Vzc1Rva2VuKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJteF9oYXNfcGlja2xlX2tleVwiKSA9PT0gXCJ0cnVlXCIpIHtcbiAgICAgICAgICAgIGxvZ2dlci5lcnJvcihcIkV4cGVjdGVkIGEgcGlja2xlIGtleSwgYnV0IG5vbmUgcHJvdmlkZWQuICBFbmNyeXB0aW9uIG1heSBub3Qgd29yay5cIik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBpZiB3ZSBkaWRuJ3QgZ2V0IGEgZGV2aWNlSWQgZnJvbSB0aGUgbG9naW4sIGxlYXZlIG14X2RldmljZV9pZCB1bnNldCxcbiAgICAvLyByYXRoZXIgdGhhbiBzZXR0aW5nIGl0IHRvIFwidW5kZWZpbmVkXCIuXG4gICAgLy9cbiAgICAvLyAoaW4gdGhpcyBjYXNlIE1hdHJpeENsaWVudCBkb2Vzbid0IGJvdGhlciB3aXRoIHRoZSBjcnlwdG8gc3R1ZmZcbiAgICAvLyAtIHRoYXQncyBmaW5lIGZvciB1cykuXG4gICAgaWYgKGNyZWRlbnRpYWxzLmRldmljZUlkKSB7XG4gICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFwibXhfZGV2aWNlX2lkXCIsIGNyZWRlbnRpYWxzLmRldmljZUlkKTtcbiAgICB9XG5cbiAgICBTZWN1cml0eUN1c3RvbWlzYXRpb25zLnBlcnNpc3RDcmVkZW50aWFscz8uKGNyZWRlbnRpYWxzKTtcblxuICAgIGxvZ2dlci5sb2coYFNlc3Npb24gcGVyc2lzdGVkIGZvciAke2NyZWRlbnRpYWxzLnVzZXJJZH1gKTtcbn1cblxubGV0IF9pc0xvZ2dpbmdPdXQgPSBmYWxzZTtcblxuLyoqXG4gKiBMb2dzIHRoZSBjdXJyZW50IHNlc3Npb24gb3V0IGFuZCB0cmFuc2l0aW9ucyB0byB0aGUgbG9nZ2VkLW91dCBzdGF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gbG9nb3V0KCk6IHZvaWQge1xuICAgIGlmICghTWF0cml4Q2xpZW50UGVnLmdldCgpKSByZXR1cm47XG5cbiAgICBQb3N0aG9nQW5hbHl0aWNzLmluc3RhbmNlLmxvZ291dCgpO1xuXG4gICAgaWYgKE1hdHJpeENsaWVudFBlZy5nZXQoKS5pc0d1ZXN0KCkpIHtcbiAgICAgICAgLy8gbG9nb3V0IGRvZXNuJ3Qgd29yayBmb3IgZ3Vlc3Qgc2Vzc2lvbnNcbiAgICAgICAgLy8gQWxzbyB3ZSBzb21ldGltZXMgd2FudCB0byByZS1sb2cgaW4gYSBndWVzdCBzZXNzaW9uIGlmIHdlIGFib3J0IHRoZSBsb2dpbi5cbiAgICAgICAgLy8gZGVmZXIgdW50aWwgbmV4dCB0aWNrIGJlY2F1c2UgaXQgY2FsbHMgYSBzeW5jaHJvbm91cyBkaXNwYXRjaCwgYW5kIHdlIGFyZSBsaWtlbHkgaGVyZSBmcm9tIGEgZGlzcGF0Y2guXG4gICAgICAgIHNldEltbWVkaWF0ZSgoKSA9PiBvbkxvZ2dlZE91dCgpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIF9pc0xvZ2dpbmdPdXQgPSB0cnVlO1xuICAgIGNvbnN0IGNsaWVudCA9IE1hdHJpeENsaWVudFBlZy5nZXQoKTtcbiAgICBQbGF0Zm9ybVBlZy5nZXQoKT8uZGVzdHJveVBpY2tsZUtleShjbGllbnQuZ2V0U2FmZVVzZXJJZCgpLCBjbGllbnQuZ2V0RGV2aWNlSWQoKSA/PyBcIlwiKTtcbiAgICBjbGllbnQubG9nb3V0KHRydWUpLnRoZW4ob25Mb2dnZWRPdXQsIChlcnIpID0+IHtcbiAgICAgICAgLy8gSnVzdCB0aHJvd2luZyBhbiBlcnJvciBoZXJlIGlzIGdvaW5nIHRvIGJlIHZlcnkgdW5oZWxwZnVsXG4gICAgICAgIC8vIGlmIHlvdSdyZSB0cnlpbmcgdG8gbG9nIG91dCBiZWNhdXNlIHlvdXIgc2VydmVyJ3MgZG93biBhbmRcbiAgICAgICAgLy8geW91IHdhbnQgdG8gbG9nIGludG8gYSBkaWZmZXJlbnQgc2VydmVyLCBzbyBqdXN0IGZvcmdldCB0aGVcbiAgICAgICAgLy8gYWNjZXNzIHRva2VuLiBJdCdzIGFubm95aW5nIHRoYXQgdGhpcyB3aWxsIGxlYXZlIHRoZSBhY2Nlc3NcbiAgICAgICAgLy8gdG9rZW4gc3RpbGwgdmFsaWQsIGJ1dCB3ZSBzaG91bGQgZml4IHRoaXMgYnkgaGF2aW5nIGFjY2Vzc1xuICAgICAgICAvLyB0b2tlbnMgZXhwaXJlIChhbmQgaWYgeW91IHJlYWxseSB0aGluayB5b3UndmUgYmVlbiBjb21wcm9taXNlZCxcbiAgICAgICAgLy8gY2hhbmdlIHlvdXIgcGFzc3dvcmQpLlxuICAgICAgICBsb2dnZXIud2FybihcIkZhaWxlZCB0byBjYWxsIGxvZ291dCBBUEk6IHRva2VuIHdpbGwgbm90IGJlIGludmFsaWRhdGVkXCIsIGVycik7XG4gICAgICAgIG9uTG9nZ2VkT3V0KCk7XG4gICAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzb2Z0TG9nb3V0KCk6IHZvaWQge1xuICAgIGlmICghTWF0cml4Q2xpZW50UGVnLmdldCgpKSByZXR1cm47XG5cbiAgICAvLyBUcmFjayB0aGF0IHdlJ3ZlIGRldGVjdGVkIGFuZCB0cmFwcGVkIGEgc29mdCBsb2dvdXQuIFRoaXMgaGVscHMgcHJldmVudCBvdGhlclxuICAgIC8vIHBhcnRzIG9mIHRoZSBhcHAgZnJvbSBzdGFydGluZyBpZiB0aGVyZSdzIG5vIHBvaW50IChpZTogZG9uJ3Qgc3luYyBpZiB3ZSd2ZVxuICAgIC8vIGJlZW4gc29mdCBsb2dnZWQgb3V0LCBkZXNwaXRlIGhhdmluZyBjcmVkZW50aWFscyBhbmQgZGF0YSBmb3IgYSBNYXRyaXhDbGllbnQpLlxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFwibXhfc29mdF9sb2dvdXRcIiwgXCJ0cnVlXCIpO1xuXG4gICAgLy8gRGV2IG5vdGU6IHBsZWFzZSBrZWVwIHRoaXMgbG9nIGxpbmUgYXJvdW5kLiBJdCBjYW4gYmUgdXNlZnVsIGZvciB0cmFjayBkb3duXG4gICAgLy8gcmFuZG9tIGNsaWVudHMgc3RvcHBpbmcgaW4gdGhlIG1pZGRsZSBvZiB0aGUgbG9ncy5cbiAgICBsb2dnZXIubG9nKFwiU29mdCBsb2dvdXQgaW5pdGlhdGVkXCIpO1xuICAgIF9pc0xvZ2dpbmdPdXQgPSB0cnVlOyAvLyB0byBhdm9pZCByZXBlYXRlZCBmbGFnc1xuICAgIC8vIEVuc3VyZSB0aGF0IHdlIGRpc3BhdGNoIGEgdmlldyBjaGFuZ2UgKipiZWZvcmUqKiBzdG9wcGluZyB0aGUgY2xpZW50IHNvXG4gICAgLy8gc28gdGhhdCBSZWFjdCBjb21wb25lbnRzIHVubW91bnQgZmlyc3QuIFRoaXMgYXZvaWRzIFJlYWN0IHNvZnQgY3Jhc2hlc1xuICAgIC8vIHRoYXQgY2FuIG9jY3VyIHdoZW4gY29tcG9uZW50cyB0cnkgdG8gdXNlIGEgbnVsbCBjbGllbnQuXG4gICAgZGlzLmRpc3BhdGNoKHsgYWN0aW9uOiBcIm9uX2NsaWVudF9ub3RfdmlhYmxlXCIgfSk7IC8vIGdlbmVyaWMgdmVyc2lvbiBvZiBvbl9sb2dnZWRfb3V0XG4gICAgc3RvcE1hdHJpeENsaWVudCgvKnVuc2V0Q2xpZW50PSovIGZhbHNlKTtcblxuICAgIC8vIERPIE5PVCBDQUxMIExPR09VVC4gQSBzb2Z0IGxvZ291dCBwcmVzZXJ2ZXMgZGF0YSwgbG9nb3V0IGRvZXMgbm90LlxufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNTb2Z0TG9nb3V0KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBsb2NhbFN0b3JhZ2UuZ2V0SXRlbShcIm14X3NvZnRfbG9nb3V0XCIpID09PSBcInRydWVcIjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzTG9nZ2luZ091dCgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gX2lzTG9nZ2luZ091dDtcbn1cblxuLyoqXG4gKiBTdGFydHMgdGhlIG1hdHJpeCBjbGllbnQgYW5kIGFsbCBvdGhlciByZWFjdC1zZGsgc2VydmljZXMgdGhhdFxuICogbGlzdGVuIGZvciBldmVudHMgd2hpbGUgYSBzZXNzaW9uIGlzIGxvZ2dlZCBpbi5cbiAqIEBwYXJhbSBjbGllbnQgdGhlIG1hdHJpeCBjbGllbnQgdG8gc3RhcnRcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gc3RhcnRTeW5jaW5nIFRydWUgKGRlZmF1bHQpIHRvIGFjdHVhbGx5IHN0YXJ0XG4gKiBzeW5jaW5nIHRoZSBjbGllbnQuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHN0YXJ0TWF0cml4Q2xpZW50KGNsaWVudDogTWF0cml4Q2xpZW50LCBzdGFydFN5bmNpbmcgPSB0cnVlKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgbG9nZ2VyLmxvZyhgTGlmZWN5Y2xlOiBTdGFydGluZyBNYXRyaXhDbGllbnRgKTtcblxuICAgIC8vIGRpc3BhdGNoIHRoaXMgYmVmb3JlIHN0YXJ0aW5nIHRoZSBtYXRyaXggY2xpZW50OiBpdCdzIHVzZWRcbiAgICAvLyB0byBhZGQgbGlzdGVuZXJzIGZvciB0aGUgJ3N5bmMnIGV2ZW50IHNvIG90aGVyd2lzZSB3ZSdkIGhhdmVcbiAgICAvLyBhIHJhY2UgY29uZGl0aW9uIChhbmQgd2UgbmVlZCB0byBkaXNwYXRjaCBzeW5jaHJvbm91c2x5IGZvciB0aGlzXG4gICAgLy8gdG8gd29yaykuXG4gICAgZGlzLmRpc3BhdGNoKHsgYWN0aW9uOiBcIndpbGxfc3RhcnRfY2xpZW50XCIgfSwgdHJ1ZSk7XG5cbiAgICAvLyByZXNldCB0aGluZ3MgZmlyc3QganVzdCBpbiBjYXNlXG4gICAgU2RrQ29udGV4dENsYXNzLmluc3RhbmNlLnR5cGluZ1N0b3JlLnJlc2V0KCk7XG4gICAgVG9hc3RTdG9yZS5zaGFyZWRJbnN0YW5jZSgpLnJlc2V0KCk7XG5cbiAgICBEaWFsb2dPcGVuZXIuaW5zdGFuY2UucHJlcGFyZShjbGllbnQpO1xuICAgIE5vdGlmaWVyLnN0YXJ0KCk7XG4gICAgVXNlckFjdGl2aXR5LnNoYXJlZEluc3RhbmNlKCkuc3RhcnQoKTtcbiAgICBETVJvb21NYXAubWFrZVNoYXJlZChjbGllbnQpLnN0YXJ0KCk7XG4gICAgSW50ZWdyYXRpb25NYW5hZ2Vycy5zaGFyZWRJbnN0YW5jZSgpLnN0YXJ0V2F0Y2hpbmcoKTtcbiAgICBBY3RpdmVXaWRnZXRTdG9yZS5pbnN0YW5jZS5zdGFydCgpO1xuICAgIExlZ2FjeUNhbGxIYW5kbGVyLmluc3RhbmNlLnN0YXJ0KCk7XG5cbiAgICAvLyBTdGFydCBNam9sbmlyIGV2ZW4gdGhvdWdoIHdlIGhhdmVuJ3QgY2hlY2tlZCB0aGUgZmVhdHVyZSBmbGFnIHlldC4gU3RhcnRpbmdcbiAgICAvLyB0aGUgdGhpbmcganVzdCB3YXN0ZXMgQ1BVIGN5Y2xlcywgYnV0IHNob3VsZCByZXN1bHQgaW4gbm8gYWN0dWFsIGZ1bmN0aW9uYWxpdHlcbiAgICAvLyBiZWluZyBleHBvc2VkIHRvIHRoZSB1c2VyLlxuICAgIE1qb2xuaXIuc2hhcmVkSW5zdGFuY2UoKS5zdGFydCgpO1xuXG4gICAgaWYgKHN0YXJ0U3luY2luZykge1xuICAgICAgICAvLyBUaGUgY2xpZW50IG1pZ2h0IHdhbnQgdG8gcG9wdWxhdGUgc29tZSB2aWV3cyB3aXRoIGV2ZW50cyBmcm9tIHRoZVxuICAgICAgICAvLyBpbmRleCAoZS5nLiB0aGUgRmlsZVBhbmVsKSwgdGhlcmVmb3JlIGluaXRpYWxpemUgdGhlIGV2ZW50IGluZGV4XG4gICAgICAgIC8vIGJlZm9yZSB0aGUgY2xpZW50LlxuICAgICAgICBhd2FpdCBFdmVudEluZGV4UGVnLmluaXQoKTtcbiAgICAgICAgYXdhaXQgTWF0cml4Q2xpZW50UGVnLnN0YXJ0KCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbG9nZ2VyLndhcm4oXCJDYWxsZXIgcmVxdWVzdGVkIG9ubHkgYXV4aWxpYXJ5IHNlcnZpY2VzIGJlIHN0YXJ0ZWRcIik7XG4gICAgICAgIGF3YWl0IE1hdHJpeENsaWVudFBlZy5hc3NpZ24oKTtcbiAgICB9XG5cbiAgICAvLyBSdW4gdGhlIG1pZ3JhdGlvbnMgYWZ0ZXIgdGhlIE1hdHJpeENsaWVudFBlZyBoYXMgYmVlbiBhc3NpZ25lZFxuICAgIFNldHRpbmdzU3RvcmUucnVuTWlncmF0aW9ucygpO1xuXG4gICAgLy8gVGhpcyBuZWVkcyB0byBiZSBzdGFydGVkIGFmdGVyIGNyeXB0byBpcyBzZXQgdXBcbiAgICBEZXZpY2VMaXN0ZW5lci5zaGFyZWRJbnN0YW5jZSgpLnN0YXJ0KGNsaWVudCk7XG4gICAgLy8gU2ltaWxhcmx5LCBkb24ndCBzdGFydCBzZW5kaW5nIHByZXNlbmNlIHVwZGF0ZXMgdW50aWwgd2UndmUgc3RhcnRlZFxuICAgIC8vIHRoZSBjbGllbnRcbiAgICBpZiAoIVNldHRpbmdzU3RvcmUuZ2V0VmFsdWUoXCJsb3dCYW5kd2lkdGhcIikpIHtcbiAgICAgICAgUHJlc2VuY2Uuc3RhcnQoKTtcbiAgICB9XG5cbiAgICAvLyBOb3cgdGhhdCB3ZSBoYXZlIGEgTWF0cml4Q2xpZW50UGVnLCB1cGRhdGUgdGhlIEppdHNpIGluZm9cbiAgICBKaXRzaS5nZXRJbnN0YW5jZSgpLnN0YXJ0KCk7XG5cbiAgICAvLyBkaXNwYXRjaCB0aGF0IHdlIGZpbmlzaGVkIHN0YXJ0aW5nIHVwIHRvIHdpcmUgdXAgYW55IG90aGVyIGJpdHNcbiAgICAvLyBvZiB0aGUgbWF0cml4IGNsaWVudCB0aGF0IGNhbm5vdCBiZSBzZXQgcHJpb3IgdG8gc3RhcnRpbmcgdXAuXG4gICAgZGlzLmRpc3BhdGNoKHsgYWN0aW9uOiBcImNsaWVudF9zdGFydGVkXCIgfSk7XG5cbiAgICBpZiAoaXNTb2Z0TG9nb3V0KCkpIHtcbiAgICAgICAgc29mdExvZ291dCgpO1xuICAgIH1cbn1cblxuLypcbiAqIFN0b3BzIGEgcnVubmluZyBjbGllbnQgYW5kIGFsbCByZWxhdGVkIHNlcnZpY2VzLCBhbmQgY2xlYXJzIHBlcnNpc3RlbnRcbiAqIHN0b3JhZ2UuIFVzZWQgYWZ0ZXIgYSBzZXNzaW9uIGhhcyBiZWVuIGxvZ2dlZCBvdXQuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBvbkxvZ2dlZE91dCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAvLyBFbnN1cmUgdGhhdCB3ZSBkaXNwYXRjaCBhIHZpZXcgY2hhbmdlICoqYmVmb3JlKiogc3RvcHBpbmcgdGhlIGNsaWVudCxcbiAgICAvLyB0aGF0IFJlYWN0IGNvbXBvbmVudHMgdW5tb3VudCBmaXJzdC4gVGhpcyBhdm9pZHMgUmVhY3Qgc29mdCBjcmFzaGVzXG4gICAgLy8gdGhhdCBjYW4gb2NjdXIgd2hlbiBjb21wb25lbnRzIHRyeSB0byB1c2UgYSBudWxsIGNsaWVudC5cbiAgICBkaXMuZmlyZShBY3Rpb24uT25Mb2dnZWRPdXQsIHRydWUpO1xuICAgIHN0b3BNYXRyaXhDbGllbnQoKTtcbiAgICBhd2FpdCBjbGVhclN0b3JhZ2UoeyBkZWxldGVFdmVyeXRoaW5nOiB0cnVlIH0pO1xuICAgIExpZmVjeWNsZUN1c3RvbWlzYXRpb25zLm9uTG9nZ2VkT3V0QW5kU3RvcmFnZUNsZWFyZWQ/LigpO1xuICAgIGF3YWl0IFBsYXRmb3JtUGVnLmdldCgpPy5jbGVhclN0b3JhZ2UoKTtcblxuICAgIC8vIERvIHRoaXMgbGFzdCwgc28gd2UgY2FuIG1ha2Ugc3VyZSBhbGwgc3RvcmFnZSBoYXMgYmVlbiBjbGVhcmVkIGFuZCBhbGxcbiAgICAvLyBjdXN0b21pc2F0aW9ucyBnb3QgdGhlIG1lbW8uXG4gICAgaWYgKFNka0NvbmZpZy5nZXQoKS5sb2dvdXRfcmVkaXJlY3RfdXJsKSB7XG4gICAgICAgIGxvZ2dlci5sb2coXCJSZWRpcmVjdGluZyB0byBleHRlcm5hbCBwcm92aWRlciB0byBmaW5pc2ggbG9nb3V0XCIpO1xuICAgICAgICAvLyBYWFg6IERlZmVyIHRoaXMgc28gdGhhdCBpdCBkb2Vzbid0IHJhY2Ugd2l0aCBNYXRyaXhDaGF0IHVubW91bnRpbmcgdGhlIHdvcmxkIGJ5IGdvaW5nIHRvIC8jL2xvZ2luXG4gICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gU2RrQ29uZmlnLmdldCgpLmxvZ291dF9yZWRpcmVjdF91cmwhO1xuICAgICAgICB9LCAxMDApO1xuICAgIH1cbiAgICAvLyBEbyB0aGlzIGxhc3QgdG8gcHJldmVudCByYWNpbmcgYHN0b3BNYXRyaXhDbGllbnRgIGFuZCBgb25fbG9nZ2VkX291dGAgd2l0aCBNYXRyaXhDaGF0IGhhbmRsaW5nIFNlc3Npb24ubG9nZ2VkX291dFxuICAgIF9pc0xvZ2dpbmdPdXQgPSBmYWxzZTtcbn1cblxuLyoqXG4gKiBAcGFyYW0ge29iamVjdH0gb3B0cyBPcHRpb25zIGZvciBob3cgdG8gY2xlYXIgc3RvcmFnZS5cbiAqIEByZXR1cm5zIHtQcm9taXNlfSBwcm9taXNlIHdoaWNoIHJlc29sdmVzIG9uY2UgdGhlIHN0b3JlcyBoYXZlIGJlZW4gY2xlYXJlZFxuICovXG5hc3luYyBmdW5jdGlvbiBjbGVhclN0b3JhZ2Uob3B0cz86IHsgZGVsZXRlRXZlcnl0aGluZz86IGJvb2xlYW4gfSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICh3aW5kb3cubG9jYWxTdG9yYWdlKSB7XG4gICAgICAgIC8vIHRyeSB0byBzYXZlIGFueSAzcGlkIGludml0ZXMgZnJvbSBiZWluZyBvYmxpdGVyYXRlZCBhbmQgcmVnaXN0cmF0aW9uIHRpbWVcbiAgICAgICAgY29uc3QgcGVuZGluZ0ludml0ZXMgPSBUaHJlZXBpZEludml0ZVN0b3JlLmluc3RhbmNlLmdldFdpcmVJbnZpdGVzKCk7XG4gICAgICAgIGNvbnN0IHJlZ2lzdHJhdGlvblRpbWUgPSB3aW5kb3cubG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJteF9yZWdpc3RyYXRpb25fdGltZVwiKTtcblxuICAgICAgICB3aW5kb3cubG9jYWxTdG9yYWdlLmNsZWFyKCk7XG4gICAgICAgIEFic3RyYWN0TG9jYWxTdG9yYWdlU2V0dGluZ3NIYW5kbGVyLmNsZWFyKCk7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IFN0b3JhZ2VNYW5hZ2VyLmlkYkRlbGV0ZShcImFjY291bnRcIiwgXCJteF9hY2Nlc3NfdG9rZW5cIik7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGxvZ2dlci5lcnJvcihcImlkYkRlbGV0ZSBmYWlsZWQgZm9yIGFjY291bnQ6bXhfYWNjZXNzX3Rva2VuXCIsIGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbm93IHJlc3RvcmUgdGhvc2UgaW52aXRlcyBhbmQgcmVnaXN0cmF0aW9uIHRpbWVcbiAgICAgICAgaWYgKCFvcHRzPy5kZWxldGVFdmVyeXRoaW5nKSB7XG4gICAgICAgICAgICBwZW5kaW5nSW52aXRlcy5mb3JFYWNoKChpKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgcm9vbUlkID0gaS5yb29tSWQ7XG4gICAgICAgICAgICAgICAgZGVsZXRlIGkucm9vbUlkOyAvLyBkZWxldGUgdG8gYXZvaWQgY29uZnVzaW5nIHRoZSBzdG9yZVxuICAgICAgICAgICAgICAgIFRocmVlcGlkSW52aXRlU3RvcmUuaW5zdGFuY2Uuc3RvcmVJbnZpdGUocm9vbUlkLCBpKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBpZiAocmVnaXN0cmF0aW9uVGltZSkge1xuICAgICAgICAgICAgICAgIHdpbmRvdy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbShcIm14X3JlZ2lzdHJhdGlvbl90aW1lXCIsIHJlZ2lzdHJhdGlvblRpbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gUHJlc2VydmUgV2FsbGV0Q29ubmVjdCBzZXNzaW9uIGRhdGEgZHVyaW5nIGxvZ2luIChiZWZvcmUgY2xlYXJpbmcgc2Vzc2lvblN0b3JhZ2UpXG4gICAgY29uc3Qgd2NTZXNzaW9uVG9waWMgPSB3aW5kb3cuc2Vzc2lvblN0b3JhZ2U/LmdldEl0ZW0oJ3djX3Nlc3Npb25fdG9waWMnKTtcbiAgICBjb25zdCB3YWxsZXRBZGRyZXNzID0gd2luZG93LnNlc3Npb25TdG9yYWdlPy5nZXRJdGVtKCd3YWxsZXRfYWRkcmVzcycpO1xuICAgIGNvbnN0IHdhbGxldE5hbWUgPSB3aW5kb3cuc2Vzc2lvblN0b3JhZ2U/LmdldEl0ZW0oJ3dhbGxldF9uYW1lJyk7XG5cbiAgICB3aW5kb3cuc2Vzc2lvblN0b3JhZ2U/LmNsZWFyKCk7XG5cbiAgICAvLyBSZXN0b3JlIFdhbGxldENvbm5lY3Qgc2Vzc2lvbiBkYXRhIGFmdGVyIGNsZWFyaW5nIChvbmx5IGR1cmluZyBsb2dpbiwgbm90IGR1cmluZyBkZWxldGVFdmVyeXRoaW5nL2xvZ291dClcbiAgICBpZiAoIW9wdHM/LmRlbGV0ZUV2ZXJ5dGhpbmcgJiYgd2luZG93LnNlc3Npb25TdG9yYWdlKSB7XG4gICAgICAgIGlmICh3Y1Nlc3Npb25Ub3BpYykge1xuICAgICAgICAgICAgd2luZG93LnNlc3Npb25TdG9yYWdlLnNldEl0ZW0oJ3djX3Nlc3Npb25fdG9waWMnLCB3Y1Nlc3Npb25Ub3BpYyk7XG4gICAgICAgICAgICBsb2dnZXIubG9nKCfwn5SEIFByZXNlcnZlZCBXYWxsZXRDb25uZWN0IHNlc3Npb24gSUQgZHVyaW5nIGxvZ2luIGNsZWFyU3RvcmFnZTonLCB3Y1Nlc3Npb25Ub3BpYyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHdhbGxldEFkZHJlc3MpIHtcbiAgICAgICAgICAgIHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5zZXRJdGVtKCd3YWxsZXRfYWRkcmVzcycsIHdhbGxldEFkZHJlc3MpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh3YWxsZXROYW1lKSB7XG4gICAgICAgICAgICB3aW5kb3cuc2Vzc2lvblN0b3JhZ2Uuc2V0SXRlbSgnd2FsbGV0X25hbWUnLCB3YWxsZXROYW1lKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGNyZWF0ZSBhIHRlbXBvcmFyeSBjbGllbnQgdG8gY2xlYXIgb3V0IHRoZSBwZXJzaXN0ZW50IHN0b3Jlcy5cbiAgICBjb25zdCBjbGkgPSBjcmVhdGVNYXRyaXhDbGllbnQoe1xuICAgICAgICAvLyB3ZSdsbCBuZXZlciBtYWtlIGFueSByZXF1ZXN0cywgc28gY2FuIHBhc3MgYSBib2d1cyBIUyBVUkxcbiAgICAgICAgYmFzZVVybDogXCJcIixcbiAgICB9KTtcblxuICAgIGF3YWl0IEV2ZW50SW5kZXhQZWcuZGVsZXRlRXZlbnRJbmRleCgpO1xuICAgIGF3YWl0IGNsaS5jbGVhclN0b3JlcygpO1xufVxuXG4vKipcbiAqIFN0b3AgYWxsIHRoZSBiYWNrZ3JvdW5kIHByb2Nlc3NlcyByZWxhdGVkIHRvIHRoZSBjdXJyZW50IGNsaWVudC5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gdW5zZXRDbGllbnQgVHJ1ZSAoZGVmYXVsdCkgdG8gYWJhbmRvbiB0aGUgY2xpZW50XG4gKiBvbiBNYXRyaXhDbGllbnRQZWcgYWZ0ZXIgc3RvcHBpbmcuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzdG9wTWF0cml4Q2xpZW50KHVuc2V0Q2xpZW50ID0gdHJ1ZSk6IHZvaWQge1xuICAgIE5vdGlmaWVyLnN0b3AoKTtcbiAgICBMZWdhY3lDYWxsSGFuZGxlci5pbnN0YW5jZS5zdG9wKCk7XG4gICAgVXNlckFjdGl2aXR5LnNoYXJlZEluc3RhbmNlKCkuc3RvcCgpO1xuICAgIFNka0NvbnRleHRDbGFzcy5pbnN0YW5jZS50eXBpbmdTdG9yZS5yZXNldCgpO1xuICAgIFByZXNlbmNlLnN0b3AoKTtcbiAgICBBY3RpdmVXaWRnZXRTdG9yZS5pbnN0YW5jZS5zdG9wKCk7XG4gICAgSW50ZWdyYXRpb25NYW5hZ2Vycy5zaGFyZWRJbnN0YW5jZSgpLnN0b3BXYXRjaGluZygpO1xuICAgIE1qb2xuaXIuc2hhcmVkSW5zdGFuY2UoKS5zdG9wKCk7XG4gICAgRGV2aWNlTGlzdGVuZXIuc2hhcmVkSW5zdGFuY2UoKS5zdG9wKCk7XG4gICAgRE1Sb29tTWFwLnNoYXJlZCgpPy5zdG9wKCk7XG4gICAgRXZlbnRJbmRleFBlZy5zdG9wKCk7XG4gICAgY29uc3QgY2xpID0gTWF0cml4Q2xpZW50UGVnLmdldCgpO1xuICAgIGlmIChjbGkpIHtcbiAgICAgICAgY2xpLnN0b3BDbGllbnQoKTtcbiAgICAgICAgY2xpLnJlbW92ZUFsbExpc3RlbmVycygpO1xuXG4gICAgICAgIGlmICh1bnNldENsaWVudCkge1xuICAgICAgICAgICAgTWF0cml4Q2xpZW50UGVnLnVuc2V0KCk7XG4gICAgICAgICAgICBFdmVudEluZGV4UGVnLnVuc2V0KCk7XG4gICAgICAgICAgICBjbGkuc3RvcmUuZGVzdHJveSgpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vLyBVdGlsaXR5IG1ldGhvZCB0byBwZXJmb3JtIGEgbG9naW4gd2l0aCBhbiBleGlzdGluZyBhY2Nlc3NfdG9rZW5cbndpbmRvdy5teExvZ2luV2l0aEFjY2Vzc1Rva2VuID0gYXN5bmMgKGhzVXJsOiBzdHJpbmcsIGFjY2Vzc1Rva2VuOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICBjb25zdCB0ZW1wQ2xpZW50ID0gY3JlYXRlQ2xpZW50KHtcbiAgICAgICAgYmFzZVVybDogaHNVcmwsXG4gICAgICAgIGFjY2Vzc1Rva2VuLFxuICAgIH0pO1xuICAgIGNvbnN0IHsgdXNlcl9pZDogdXNlcklkIH0gPSBhd2FpdCB0ZW1wQ2xpZW50Lndob2FtaSgpO1xuICAgIGF3YWl0IGRvU2V0TG9nZ2VkSW4oXG4gICAgICAgIHtcbiAgICAgICAgICAgIGhvbWVzZXJ2ZXJVcmw6IGhzVXJsLFxuICAgICAgICAgICAgYWNjZXNzVG9rZW4sXG4gICAgICAgICAgICB1c2VySWQsXG4gICAgICAgIH0sXG4gICAgICAgIHRydWUsXG4gICAgKTtcbn07XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBbUJBLElBQUFBLE9BQUEsR0FBQUMsT0FBQTtBQUNBLElBQUFDLE9BQUEsR0FBQUQsT0FBQTtBQUVBLElBQUFFLElBQUEsR0FBQUYsT0FBQTtBQUVBLElBQUFHLE9BQUEsR0FBQUgsT0FBQTtBQUNBLElBQUFJLEtBQUEsR0FBQUosT0FBQTtBQUVBLElBQUFLLGdCQUFBLEdBQUFMLE9BQUE7QUFDQSxJQUFBTSxTQUFBLEdBQUFDLHNCQUFBLENBQUFQLE9BQUE7QUFDQSxJQUFBUSxjQUFBLEdBQUFELHNCQUFBLENBQUFQLE9BQUE7QUFDQSxJQUFBUyxtQkFBQSxHQUFBRixzQkFBQSxDQUFBUCxPQUFBO0FBQ0EsSUFBQVUsU0FBQSxHQUFBSCxzQkFBQSxDQUFBUCxPQUFBO0FBQ0EsSUFBQVcsYUFBQSxHQUFBSixzQkFBQSxDQUFBUCxPQUFBO0FBQ0EsSUFB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