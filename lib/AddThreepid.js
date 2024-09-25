"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _matrix = require("matrix-js-sdk/src/matrix");
var _Modal = _interopRequireDefault(require("./Modal"));
var _languageHandler = require("./languageHandler");
var _IdentityAuthClient = _interopRequireDefault(require("./IdentityAuthClient"));
var _InteractiveAuthEntryComponents = require("./components/views/auth/InteractiveAuthEntryComponents");
var _InteractiveAuthDialog = _interopRequireDefault(require("./components/views/dialogs/InteractiveAuthDialog"));
/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

function getIdServerDomain(matrixClient) {
  const idBaseUrl = matrixClient.getIdentityServerUrl(true);
  if (!idBaseUrl) {
    throw new _languageHandler.UserFriendlyError("Identity server not set");
  }
  return idBaseUrl;
}
/**
 * Allows a user to add a third party identifier to their homeserver and,
 * optionally, the identity servers.
 *
 * This involves getting an email token from the identity server to "prove" that
 * the client owns the given email address, which is then passed to the
 * add threepid API on the homeserver.
 *
 * Diagrams of the intended API flows here are available at:
 *
 * https://gist.github.com/jryans/839a09bf0c5a70e2f36ed990d50ed928
 */
class AddThreepid {
  constructor(matrixClient) {
    this.matrixClient = matrixClient;
    (0, _defineProperty2.default)(this, "sessionId", void 0);
    (0, _defineProperty2.default)(this, "submitUrl", void 0);
    (0, _defineProperty2.default)(this, "bind", false);
    (0, _defineProperty2.default)(this, "clientSecret", void 0);
    /**
     * @param {{type: string, session?: string}} auth UI auth object
     * @return {Promise<Object>} Response from /3pid/add call (in current spec, an empty object)
     */
    (0, _defineProperty2.default)(this, "makeAddThreepidOnlyRequest", auth => {
      return this.matrixClient.addThreePidOnly({
        sid: this.sessionId,
        client_secret: this.clientSecret,
        auth
      });
    });
    this.clientSecret = matrixClient.generateClientSecret();
  }

  /**
   * Attempt to add an email threepid to the homeserver.
   * This will trigger a side-effect of sending an email to the provided email address.
   * @param {string} emailAddress The email address to add
   * @return {Promise} Resolves when the email has been sent. Then call checkEmailLinkClicked().
   */
  async addEmailAddress(emailAddress) {
    try {
      const res = await this.matrixClient.requestAdd3pidEmailToken(emailAddress, this.clientSecret, 1);
      this.sessionId = res.sid;
      return res;
    } catch (err) {
      if (err instanceof _matrix.MatrixError && err.errcode === "M_THREEPID_IN_USE") {
        throw new _languageHandler.UserFriendlyError("This email address is already in use", {
          cause: err
        });
      }
      // Otherwise, just blurt out the same error
      throw err;
    }
  }

  /**
   * Attempt to bind an email threepid on the identity server via the homeserver.
   * This will trigger a side-effect of sending an email to the provided email address.
   * @param {string} emailAddress The email address to add
   * @return {Promise} Resolves when the email has been sent. Then call checkEmailLinkClicked().
   */
  async bindEmailAddress(emailAddress) {
    this.bind = true;
    if (await this.matrixClient.doesServerSupportSeparateAddAndBind()) {
      // For separate bind, request a token directly from the IS.
      const authClient = new _IdentityAuthClient.default();
      const identityAccessToken = (await authClient.getAccessToken()) ?? undefined;
      try {
        const res = await this.matrixClient.requestEmailToken(emailAddress, this.clientSecret, 1, undefined, identityAccessToken);
        this.sessionId = res.sid;
        return res;
      } catch (err) {
        if (err instanceof _matrix.MatrixError && err.errcode === "M_THREEPID_IN_USE") {
          throw new _languageHandler.UserFriendlyError("This email address is already in use", {
            cause: err
          });
        }
        // Otherwise, just blurt out the same error
        throw err;
      }
    } else {
      // For tangled bind, request a token via the HS.
      return this.addEmailAddress(emailAddress);
    }
  }

  /**
   * Attempt to add a MSISDN threepid to the homeserver.
   * This will trigger a side-effect of sending an SMS to the provided phone number.
   * @param {string} phoneCountry The ISO 2 letter code of the country to resolve phoneNumber in
   * @param {string} phoneNumber The national or international formatted phone number to add
   * @return {Promise} Resolves when the text message has been sent. Then call haveMsisdnToken().
   */
  async addMsisdn(phoneCountry, phoneNumber) {
    try {
      const res = await this.matrixClient.requestAdd3pidMsisdnToken(phoneCountry, phoneNumber, this.clientSecret, 1);
      this.sessionId = res.sid;
      this.submitUrl = res.submit_url;
      return res;
    } catch (err) {
      if (err instanceof _matrix.MatrixError && err.errcode === "M_THREEPID_IN_USE") {
        throw new _languageHandler.UserFriendlyError("This phone number is already in use", {
          cause: err
        });
      }
      // Otherwise, just blurt out the same error
      throw err;
    }
  }

  /**
   * Attempt to bind a MSISDN threepid on the identity server via the homeserver.
   * This will trigger a side-effect of sending an SMS to the provided phone number.
   * @param {string} phoneCountry The ISO 2 letter code of the country to resolve phoneNumber in
   * @param {string} phoneNumber The national or international formatted phone number to add
   * @return {Promise} Resolves when the text message has been sent. Then call haveMsisdnToken().
   */
  async bindMsisdn(phoneCountry, phoneNumber) {
    this.bind = true;
    if (await this.matrixClient.doesServerSupportSeparateAddAndBind()) {
      // For separate bind, request a token directly from the IS.
      const authClient = new _IdentityAuthClient.default();
      const identityAccessToken = (await authClient.getAccessToken()) ?? undefined;
      try {
        const res = await this.matrixClient.requestMsisdnToken(phoneCountry, phoneNumber, this.clientSecret, 1, undefined, identityAccessToken);
        this.sessionId = res.sid;
        return res;
      } catch (err) {
        if (err instanceof _matrix.MatrixError && err.errcode === "M_THREEPID_IN_USE") {
          throw new _languageHandler.UserFriendlyError("This phone number is already in use", {
            cause: err
          });
        }
        // Otherwise, just blurt out the same error
        throw err;
      }
    } else {
      // For tangled bind, request a token via the HS.
      return this.addMsisdn(phoneCountry, phoneNumber);
    }
  }

  /**
   * Checks if the email link has been clicked by attempting to add the threepid
   * @return {Promise} Resolves if the email address was added. Rejects with an object
   * with a "message" property which contains a human-readable message detailing why
   * the request failed.
   */
  async checkEmailLinkClicked() {
    try {
      if (await this.matrixClient.doesServerSupportSeparateAddAndBind()) {
        if (this.bind) {
          const authClient = new _IdentityAuthClient.default();
          const identityAccessToken = await authClient.getAccessToken();
          if (!identityAccessToken) {
            throw new _languageHandler.UserFriendlyError("No identity access token found");
          }
          await this.matrixClient.bindThreePid({
            sid: this.sessionId,
            client_secret: this.clientSecret,
            id_server: getIdServerDomain(this.matrixClient),
            id_access_token: identityAccessToken
          });
        } else {
          try {
            await this.makeAddThreepidOnlyRequest();

            // The spec has always required this to use UI auth but synapse briefly
            // implemented it without, so this may just succeed and that's OK.
            return [true];
          } catch (err) {
            if (!(err instanceof _matrix.MatrixError) || err.httpStatus !== 401 || !err.data || !err.data.flows) {
              // doesn't look like an interactive-auth failure
              throw err;
            }
            const dialogAesthetics = {
              [_InteractiveAuthEntryComponents.SSOAuthEntry.PHASE_PREAUTH]: {
                title: (0, _languageHandler._t)("Use Single Sign On to continue"),
                body: (0, _languageHandler._t)("Confirm adding this email address by using Single Sign On to prove your identity."),
                continueText: (0, _languageHandler._t)("Single Sign On"),
                continueKind: "primary"
              },
              [_InteractiveAuthEntryComponents.SSOAuthEntry.PHASE_POSTAUTH]: {
                title: (0, _languageHandler._t)("Confirm adding email"),
                body: (0, _languageHandler._t)("Click the button below to confirm adding this email address."),
                continueText: (0, _languageHandler._t)("Confirm"),
                continueKind: "primary"
              }
            };
            const {
              finished
            } = _Modal.default.createDialog(_InteractiveAuthDialog.default, {
              title: (0, _languageHandler._t)("Add Email Address"),
              matrixClient: this.matrixClient,
              authData: err.data,
              makeRequest: this.makeAddThreepidOnlyRequest,
              aestheticsForStagePhases: {
                [_InteractiveAuthEntryComponents.SSOAuthEntry.LOGIN_TYPE]: dialogAesthetics,
                [_InteractiveAuthEntryComponents.SSOAuthEntry.UNSTABLE_LOGIN_TYPE]: dialogAesthetics
              }
            });
            return finished;
          }
        }
      } else {
        await this.matrixClient.addThreePid({
          sid: this.sessionId,
          client_secret: this.clientSecret,
          id_server: getIdServerDomain(this.matrixClient)
        }, this.bind);
      }
    } catch (err) {
      if (err instanceof _matrix.HTTPError && err.httpStatus === 401) {
        throw new _languageHandler.UserFriendlyError("Failed to verify email address: make sure you clicked the link in the email", {
          cause: err
        });
      }
      // Otherwise, just blurt out the same error
      throw err;
    }
    return [];
  }
  /**
   * Takes a phone number verification code as entered by the user and validates
   * it with the identity server, then if successful, adds the phone number.
   * @param {string} msisdnToken phone number verification code as entered by the user
   * @return {Promise} Resolves if the phone number was added. Rejects with an object
   * with a "message" property which contains a human-readable message detailing why
   * the request failed.
   */
  async haveMsisdnToken(msisdnToken) {
    const authClient = new _IdentityAuthClient.default();
    const supportsSeparateAddAndBind = await this.matrixClient.doesServerSupportSeparateAddAndBind();
    let result;
    if (this.submitUrl) {
      result = await this.matrixClient.submitMsisdnTokenOtherUrl(this.submitUrl, this.sessionId, this.clientSecret, msisdnToken);
    } else if (this.bind || !supportsSeparateAddAndBind) {
      result = await this.matrixClient.submitMsisdnToken(this.sessionId, this.clientSecret, msisdnToken, await authClient.getAccessToken());
    } else {
      throw new _languageHandler.UserFriendlyError("The add / bind with MSISDN flow is misconfigured");
    }
    if (result instanceof Error) {
      throw result;
    }
    if (supportsSeparateAddAndBind) {
      if (this.bind) {
        await this.matrixClient.bindThreePid({
          sid: this.sessionId,
          client_secret: this.clientSecret,
          id_server: getIdServerDomain(this.matrixClient),
          id_access_token: await authClient.getAccessToken()
        });
      } else {
        try {
          await this.makeAddThreepidOnlyRequest();

          // The spec has always required this to use UI auth but synapse briefly
          // implemented it without, so this may just succeed and that's OK.
          return;
        } catch (err) {
          if (!(err instanceof _matrix.MatrixError) || err.httpStatus !== 401 || !err.data || !err.data.flows) {
            // doesn't look like an interactive-auth failure
            throw err;
          }
          const dialogAesthetics = {
            [_InteractiveAuthEntryComponents.SSOAuthEntry.PHASE_PREAUTH]: {
              title: (0, _languageHandler._t)("Use Single Sign On to continue"),
              body: (0, _languageHandler._t)("Confirm adding this phone number by using Single Sign On to prove your identity."),
              continueText: (0, _languageHandler._t)("Single Sign On"),
              continueKind: "primary"
            },
            [_InteractiveAuthEntryComponents.SSOAuthEntry.PHASE_POSTAUTH]: {
              title: (0, _languageHandler._t)("Confirm adding phone number"),
              body: (0, _languageHandler._t)("Click the button below to confirm adding this phone number."),
              continueText: (0, _languageHandler._t)("Confirm"),
              continueKind: "primary"
            }
          };
          const {
            finished
          } = _Modal.default.createDialog(_InteractiveAuthDialog.default, {
            title: (0, _languageHandler._t)("Add Phone Number"),
            matrixClient: this.matrixClient,
            authData: err.data,
            makeRequest: this.makeAddThreepidOnlyRequest,
            aestheticsForStagePhases: {
              [_InteractiveAuthEntryComponents.SSOAuthEntry.LOGIN_TYPE]: dialogAesthetics,
              [_InteractiveAuthEntryComponents.SSOAuthEntry.UNSTABLE_LOGIN_TYPE]: dialogAesthetics
            }
          });
          return finished;
        }
      }
    } else {
      await this.matrixClient.addThreePid({
        sid: this.sessionId,
        client_secret: this.clientSecret,
        id_server: getIdServerDomain(this.matrixClient)
      }, this.bind);
    }
  }
}
exports.default = AddThreepid;
//# sourceMappingURL=AddThreepid.js.map