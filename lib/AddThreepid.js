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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfbWF0cml4IiwicmVxdWlyZSIsIl9Nb2RhbCIsIl9pbnRlcm9wUmVxdWlyZURlZmF1bHQiLCJfbGFuZ3VhZ2VIYW5kbGVyIiwiX0lkZW50aXR5QXV0aENsaWVudCIsIl9JbnRlcmFjdGl2ZUF1dGhFbnRyeUNvbXBvbmVudHMiLCJfSW50ZXJhY3RpdmVBdXRoRGlhbG9nIiwiZ2V0SWRTZXJ2ZXJEb21haW4iLCJtYXRyaXhDbGllbnQiLCJpZEJhc2VVcmwiLCJnZXRJZGVudGl0eVNlcnZlclVybCIsIlVzZXJGcmllbmRseUVycm9yIiwiQWRkVGhyZWVwaWQiLCJjb25zdHJ1Y3RvciIsIl9kZWZpbmVQcm9wZXJ0eTIiLCJkZWZhdWx0IiwiYXV0aCIsImFkZFRocmVlUGlkT25seSIsInNpZCIsInNlc3Npb25JZCIsImNsaWVudF9zZWNyZXQiLCJjbGllbnRTZWNyZXQiLCJnZW5lcmF0ZUNsaWVudFNlY3JldCIsImFkZEVtYWlsQWRkcmVzcyIsImVtYWlsQWRkcmVzcyIsInJlcyIsInJlcXVlc3RBZGQzcGlkRW1haWxUb2tlbiIsImVyciIsIk1hdHJpeEVycm9yIiwiZXJyY29kZSIsImNhdXNlIiwiYmluZEVtYWlsQWRkcmVzcyIsImJpbmQiLCJkb2VzU2VydmVyU3VwcG9ydFNlcGFyYXRlQWRkQW5kQmluZCIsImF1dGhDbGllbnQiLCJJZGVudGl0eUF1dGhDbGllbnQiLCJpZGVudGl0eUFjY2Vzc1Rva2VuIiwiZ2V0QWNjZXNzVG9rZW4iLCJ1bmRlZmluZWQiLCJyZXF1ZXN0RW1haWxUb2tlbiIsImFkZE1zaXNkbiIsInBob25lQ291bnRyeSIsInBob25lTnVtYmVyIiwicmVxdWVzdEFkZDNwaWRNc2lzZG5Ub2tlbiIsInN1Ym1pdFVybCIsInN1Ym1pdF91cmwiLCJiaW5kTXNpc2RuIiwicmVxdWVzdE1zaXNkblRva2VuIiwiY2hlY2tFbWFpbExpbmtDbGlja2VkIiwiYmluZFRocmVlUGlkIiwiaWRfc2VydmVyIiwiaWRfYWNjZXNzX3Rva2VuIiwibWFrZUFkZFRocmVlcGlkT25seVJlcXVlc3QiLCJodHRwU3RhdHVzIiwiZGF0YSIsImZsb3dzIiwiZGlhbG9nQWVzdGhldGljcyIsIlNTT0F1dGhFbnRyeSIsIlBIQVNFX1BSRUFVVEgiLCJ0aXRsZSIsIl90IiwiYm9keSIsImNvbnRpbnVlVGV4dCIsImNvbnRpbnVlS2luZCIsIlBIQVNFX1BPU1RBVVRIIiwiZmluaXNoZWQiLCJNb2RhbCIsImNyZWF0ZURpYWxvZyIsIkludGVyYWN0aXZlQXV0aERpYWxvZyIsImF1dGhEYXRhIiwibWFrZVJlcXVlc3QiLCJhZXN0aGV0aWNzRm9yU3RhZ2VQaGFzZXMiLCJMT0dJTl9UWVBFIiwiVU5TVEFCTEVfTE9HSU5fVFlQRSIsImFkZFRocmVlUGlkIiwiSFRUUEVycm9yIiwiaGF2ZU1zaXNkblRva2VuIiwibXNpc2RuVG9rZW4iLCJzdXBwb3J0c1NlcGFyYXRlQWRkQW5kQmluZCIsInJlc3VsdCIsInN1Ym1pdE1zaXNkblRva2VuT3RoZXJVcmwiLCJzdWJtaXRNc2lzZG5Ub2tlbiIsIkVycm9yIiwiZXhwb3J0cyJdLCJzb3VyY2VzIjpbIi4uL3NyYy9BZGRUaHJlZXBpZC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuQ29weXJpZ2h0IDIwMTYgT3Blbk1hcmtldCBMdGRcbkNvcHlyaWdodCAyMDE3IFZlY3RvciBDcmVhdGlvbnMgTHRkXG5Db3B5cmlnaHQgMjAxOSBUaGUgTWF0cml4Lm9yZyBGb3VuZGF0aW9uIEMuSS5DLlxuXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiovXG5cbmltcG9ydCB7IElBdXRoRGF0YSwgSVJlcXVlc3RNc2lzZG5Ub2tlblJlc3BvbnNlLCBJUmVxdWVzdFRva2VuUmVzcG9uc2UsIE1hdHJpeENsaWVudCB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9tYXRyaXhcIjtcbmltcG9ydCB7IE1hdHJpeEVycm9yLCBIVFRQRXJyb3IgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbWF0cml4XCI7XG5cbmltcG9ydCBNb2RhbCBmcm9tIFwiLi9Nb2RhbFwiO1xuaW1wb3J0IHsgX3QsIFVzZXJGcmllbmRseUVycm9yIH0gZnJvbSBcIi4vbGFuZ3VhZ2VIYW5kbGVyXCI7XG5pbXBvcnQgSWRlbnRpdHlBdXRoQ2xpZW50IGZyb20gXCIuL0lkZW50aXR5QXV0aENsaWVudFwiO1xuaW1wb3J0IHsgU1NPQXV0aEVudHJ5IH0gZnJvbSBcIi4vY29tcG9uZW50cy92aWV3cy9hdXRoL0ludGVyYWN0aXZlQXV0aEVudHJ5Q29tcG9uZW50c1wiO1xuaW1wb3J0IEludGVyYWN0aXZlQXV0aERpYWxvZyBmcm9tIFwiLi9jb21wb25lbnRzL3ZpZXdzL2RpYWxvZ3MvSW50ZXJhY3RpdmVBdXRoRGlhbG9nXCI7XG5cbmZ1bmN0aW9uIGdldElkU2VydmVyRG9tYWluKG1hdHJpeENsaWVudDogTWF0cml4Q2xpZW50KTogc3RyaW5nIHtcbiAgICBjb25zdCBpZEJhc2VVcmwgPSBtYXRyaXhDbGllbnQuZ2V0SWRlbnRpdHlTZXJ2ZXJVcmwodHJ1ZSk7XG4gICAgaWYgKCFpZEJhc2VVcmwpIHtcbiAgICAgICAgdGhyb3cgbmV3IFVzZXJGcmllbmRseUVycm9yKFwiSWRlbnRpdHkgc2VydmVyIG5vdCBzZXRcIik7XG4gICAgfVxuICAgIHJldHVybiBpZEJhc2VVcmw7XG59XG5cbmV4cG9ydCB0eXBlIEJpbmRpbmcgPSB7XG4gICAgYmluZDogYm9vbGVhbjtcbiAgICBsYWJlbDogc3RyaW5nO1xuICAgIGVycm9yVGl0bGU6IHN0cmluZztcbn07XG5cbi8qKlxuICogQWxsb3dzIGEgdXNlciB0byBhZGQgYSB0aGlyZCBwYXJ0eSBpZGVudGlmaWVyIHRvIHRoZWlyIGhvbWVzZXJ2ZXIgYW5kLFxuICogb3B0aW9uYWxseSwgdGhlIGlkZW50aXR5IHNlcnZlcnMuXG4gKlxuICogVGhpcyBpbnZvbHZlcyBnZXR0aW5nIGFuIGVtYWlsIHRva2VuIGZyb20gdGhlIGlkZW50aXR5IHNlcnZlciB0byBcInByb3ZlXCIgdGhhdFxuICogdGhlIGNsaWVudCBvd25zIHRoZSBnaXZlbiBlbWFpbCBhZGRyZXNzLCB3aGljaCBpcyB0aGVuIHBhc3NlZCB0byB0aGVcbiAqIGFkZCB0aHJlZXBpZCBBUEkgb24gdGhlIGhvbWVzZXJ2ZXIuXG4gKlxuICogRGlhZ3JhbXMgb2YgdGhlIGludGVuZGVkIEFQSSBmbG93cyBoZXJlIGFyZSBhdmFpbGFibGUgYXQ6XG4gKlxuICogaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vanJ5YW5zLzgzOWEwOWJmMGM1YTcwZTJmMzZlZDk5MGQ1MGVkOTI4XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEFkZFRocmVlcGlkIHtcbiAgICBwcml2YXRlIHNlc3Npb25JZDogc3RyaW5nO1xuICAgIHByaXZhdGUgc3VibWl0VXJsPzogc3RyaW5nO1xuICAgIHByaXZhdGUgYmluZCA9IGZhbHNlO1xuICAgIHByaXZhdGUgcmVhZG9ubHkgY2xpZW50U2VjcmV0OiBzdHJpbmc7XG5cbiAgICBwdWJsaWMgY29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBtYXRyaXhDbGllbnQ6IE1hdHJpeENsaWVudCkge1xuICAgICAgICB0aGlzLmNsaWVudFNlY3JldCA9IG1hdHJpeENsaWVudC5nZW5lcmF0ZUNsaWVudFNlY3JldCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEF0dGVtcHQgdG8gYWRkIGFuIGVtYWlsIHRocmVlcGlkIHRvIHRoZSBob21lc2VydmVyLlxuICAgICAqIFRoaXMgd2lsbCB0cmlnZ2VyIGEgc2lkZS1lZmZlY3Qgb2Ygc2VuZGluZyBhbiBlbWFpbCB0byB0aGUgcHJvdmlkZWQgZW1haWwgYWRkcmVzcy5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZW1haWxBZGRyZXNzIFRoZSBlbWFpbCBhZGRyZXNzIHRvIGFkZFxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9IFJlc29sdmVzIHdoZW4gdGhlIGVtYWlsIGhhcyBiZWVuIHNlbnQuIFRoZW4gY2FsbCBjaGVja0VtYWlsTGlua0NsaWNrZWQoKS5cbiAgICAgKi9cbiAgICBwdWJsaWMgYXN5bmMgYWRkRW1haWxBZGRyZXNzKGVtYWlsQWRkcmVzczogc3RyaW5nKTogUHJvbWlzZTxJUmVxdWVzdFRva2VuUmVzcG9uc2U+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMubWF0cml4Q2xpZW50LnJlcXVlc3RBZGQzcGlkRW1haWxUb2tlbihlbWFpbEFkZHJlc3MsIHRoaXMuY2xpZW50U2VjcmV0LCAxKTtcbiAgICAgICAgICAgIHRoaXMuc2Vzc2lvbklkID0gcmVzLnNpZDtcbiAgICAgICAgICAgIHJldHVybiByZXM7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgaWYgKGVyciBpbnN0YW5jZW9mIE1hdHJpeEVycm9yICYmIGVyci5lcnJjb2RlID09PSBcIk1fVEhSRUVQSURfSU5fVVNFXCIpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVXNlckZyaWVuZGx5RXJyb3IoXCJUaGlzIGVtYWlsIGFkZHJlc3MgaXMgYWxyZWFkeSBpbiB1c2VcIiwgeyBjYXVzZTogZXJyIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gT3RoZXJ3aXNlLCBqdXN0IGJsdXJ0IG91dCB0aGUgc2FtZSBlcnJvclxuICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXR0ZW1wdCB0byBiaW5kIGFuIGVtYWlsIHRocmVlcGlkIG9uIHRoZSBpZGVudGl0eSBzZXJ2ZXIgdmlhIHRoZSBob21lc2VydmVyLlxuICAgICAqIFRoaXMgd2lsbCB0cmlnZ2VyIGEgc2lkZS1lZmZlY3Qgb2Ygc2VuZGluZyBhbiBlbWFpbCB0byB0aGUgcHJvdmlkZWQgZW1haWwgYWRkcmVzcy5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZW1haWxBZGRyZXNzIFRoZSBlbWFpbCBhZGRyZXNzIHRvIGFkZFxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9IFJlc29sdmVzIHdoZW4gdGhlIGVtYWlsIGhhcyBiZWVuIHNlbnQuIFRoZW4gY2FsbCBjaGVja0VtYWlsTGlua0NsaWNrZWQoKS5cbiAgICAgKi9cbiAgICBwdWJsaWMgYXN5bmMgYmluZEVtYWlsQWRkcmVzcyhlbWFpbEFkZHJlc3M6IHN0cmluZyk6IFByb21pc2U8SVJlcXVlc3RUb2tlblJlc3BvbnNlPiB7XG4gICAgICAgIHRoaXMuYmluZCA9IHRydWU7XG4gICAgICAgIGlmIChhd2FpdCB0aGlzLm1hdHJpeENsaWVudC5kb2VzU2VydmVyU3VwcG9ydFNlcGFyYXRlQWRkQW5kQmluZCgpKSB7XG4gICAgICAgICAgICAvLyBGb3Igc2VwYXJhdGUgYmluZCwgcmVxdWVzdCBhIHRva2VuIGRpcmVjdGx5IGZyb20gdGhlIElTLlxuICAgICAgICAgICAgY29uc3QgYXV0aENsaWVudCA9IG5ldyBJZGVudGl0eUF1dGhDbGllbnQoKTtcbiAgICAgICAgICAgIGNvbnN0IGlkZW50aXR5QWNjZXNzVG9rZW4gPSAoYXdhaXQgYXV0aENsaWVudC5nZXRBY2Nlc3NUb2tlbigpKSA/PyB1bmRlZmluZWQ7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMubWF0cml4Q2xpZW50LnJlcXVlc3RFbWFpbFRva2VuKFxuICAgICAgICAgICAgICAgICAgICBlbWFpbEFkZHJlc3MsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2xpZW50U2VjcmV0LFxuICAgICAgICAgICAgICAgICAgICAxLFxuICAgICAgICAgICAgICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgICAgIGlkZW50aXR5QWNjZXNzVG9rZW4sXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNlc3Npb25JZCA9IHJlcy5zaWQ7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlcztcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIGlmIChlcnIgaW5zdGFuY2VvZiBNYXRyaXhFcnJvciAmJiBlcnIuZXJyY29kZSA9PT0gXCJNX1RIUkVFUElEX0lOX1VTRVwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBVc2VyRnJpZW5kbHlFcnJvcihcIlRoaXMgZW1haWwgYWRkcmVzcyBpcyBhbHJlYWR5IGluIHVzZVwiLCB7IGNhdXNlOiBlcnIgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIE90aGVyd2lzZSwganVzdCBibHVydCBvdXQgdGhlIHNhbWUgZXJyb3JcbiAgICAgICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBGb3IgdGFuZ2xlZCBiaW5kLCByZXF1ZXN0IGEgdG9rZW4gdmlhIHRoZSBIUy5cbiAgICAgICAgICAgIHJldHVybiB0aGlzLmFkZEVtYWlsQWRkcmVzcyhlbWFpbEFkZHJlc3MpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXR0ZW1wdCB0byBhZGQgYSBNU0lTRE4gdGhyZWVwaWQgdG8gdGhlIGhvbWVzZXJ2ZXIuXG4gICAgICogVGhpcyB3aWxsIHRyaWdnZXIgYSBzaWRlLWVmZmVjdCBvZiBzZW5kaW5nIGFuIFNNUyB0byB0aGUgcHJvdmlkZWQgcGhvbmUgbnVtYmVyLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBwaG9uZUNvdW50cnkgVGhlIElTTyAyIGxldHRlciBjb2RlIG9mIHRoZSBjb3VudHJ5IHRvIHJlc29sdmUgcGhvbmVOdW1iZXIgaW5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gcGhvbmVOdW1iZXIgVGhlIG5hdGlvbmFsIG9yIGludGVybmF0aW9uYWwgZm9ybWF0dGVkIHBob25lIG51bWJlciB0byBhZGRcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfSBSZXNvbHZlcyB3aGVuIHRoZSB0ZXh0IG1lc3NhZ2UgaGFzIGJlZW4gc2VudC4gVGhlbiBjYWxsIGhhdmVNc2lzZG5Ub2tlbigpLlxuICAgICAqL1xuICAgIHB1YmxpYyBhc3luYyBhZGRNc2lzZG4ocGhvbmVDb3VudHJ5OiBzdHJpbmcsIHBob25lTnVtYmVyOiBzdHJpbmcpOiBQcm9taXNlPElSZXF1ZXN0TXNpc2RuVG9rZW5SZXNwb25zZT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5tYXRyaXhDbGllbnQucmVxdWVzdEFkZDNwaWRNc2lzZG5Ub2tlbihcbiAgICAgICAgICAgICAgICBwaG9uZUNvdW50cnksXG4gICAgICAgICAgICAgICAgcGhvbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgdGhpcy5jbGllbnRTZWNyZXQsXG4gICAgICAgICAgICAgICAgMSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICB0aGlzLnNlc3Npb25JZCA9IHJlcy5zaWQ7XG4gICAgICAgICAgICB0aGlzLnN1Ym1pdFVybCA9IHJlcy5zdWJtaXRfdXJsO1xuICAgICAgICAgICAgcmV0dXJuIHJlcztcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBpZiAoZXJyIGluc3RhbmNlb2YgTWF0cml4RXJyb3IgJiYgZXJyLmVycmNvZGUgPT09IFwiTV9USFJFRVBJRF9JTl9VU0VcIikge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBVc2VyRnJpZW5kbHlFcnJvcihcIlRoaXMgcGhvbmUgbnVtYmVyIGlzIGFscmVhZHkgaW4gdXNlXCIsIHsgY2F1c2U6IGVyciB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIE90aGVyd2lzZSwganVzdCBibHVydCBvdXQgdGhlIHNhbWUgZXJyb3JcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEF0dGVtcHQgdG8gYmluZCBhIE1TSVNETiB0aHJlZXBpZCBvbiB0aGUgaWRlbnRpdHkgc2VydmVyIHZpYSB0aGUgaG9tZXNlcnZlci5cbiAgICAgKiBUaGlzIHdpbGwgdHJpZ2dlciBhIHNpZGUtZWZmZWN0IG9mIHNlbmRpbmcgYW4gU01TIHRvIHRoZSBwcm92aWRlZCBwaG9uZSBudW1iZXIuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHBob25lQ291bnRyeSBUaGUgSVNPIDIgbGV0dGVyIGNvZGUgb2YgdGhlIGNvdW50cnkgdG8gcmVzb2x2ZSBwaG9uZU51bWJlciBpblxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBwaG9uZU51bWJlciBUaGUgbmF0aW9uYWwgb3IgaW50ZXJuYXRpb25hbCBmb3JtYXR0ZWQgcGhvbmUgbnVtYmVyIHRvIGFkZFxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9IFJlc29sdmVzIHdoZW4gdGhlIHRleHQgbWVzc2FnZSBoYXMgYmVlbiBzZW50LiBUaGVuIGNhbGwgaGF2ZU1zaXNkblRva2VuKCkuXG4gICAgICovXG4gICAgcHVibGljIGFzeW5jIGJpbmRNc2lzZG4ocGhvbmVDb3VudHJ5OiBzdHJpbmcsIHBob25lTnVtYmVyOiBzdHJpbmcpOiBQcm9taXNlPElSZXF1ZXN0TXNpc2RuVG9rZW5SZXNwb25zZT4ge1xuICAgICAgICB0aGlzLmJpbmQgPSB0cnVlO1xuICAgICAgICBpZiAoYXdhaXQgdGhpcy5tYXRyaXhDbGllbnQuZG9lc1NlcnZlclN1cHBvcnRTZXBhcmF0ZUFkZEFuZEJpbmQoKSkge1xuICAgICAgICAgICAgLy8gRm9yIHNlcGFyYXRlIGJpbmQsIHJlcXVlc3QgYSB0b2tlbiBkaXJlY3RseSBmcm9tIHRoZSBJUy5cbiAgICAgICAgICAgIGNvbnN0IGF1dGhDbGllbnQgPSBuZXcgSWRlbnRpdHlBdXRoQ2xpZW50KCk7XG4gICAgICAgICAgICBjb25zdCBpZGVudGl0eUFjY2Vzc1Rva2VuID0gKGF3YWl0IGF1dGhDbGllbnQuZ2V0QWNjZXNzVG9rZW4oKSkgPz8gdW5kZWZpbmVkO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLm1hdHJpeENsaWVudC5yZXF1ZXN0TXNpc2RuVG9rZW4oXG4gICAgICAgICAgICAgICAgICAgIHBob25lQ291bnRyeSxcbiAgICAgICAgICAgICAgICAgICAgcGhvbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2xpZW50U2VjcmV0LFxuICAgICAgICAgICAgICAgICAgICAxLFxuICAgICAgICAgICAgICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgICAgIGlkZW50aXR5QWNjZXNzVG9rZW4sXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNlc3Npb25JZCA9IHJlcy5zaWQ7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlcztcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIGlmIChlcnIgaW5zdGFuY2VvZiBNYXRyaXhFcnJvciAmJiBlcnIuZXJyY29kZSA9PT0gXCJNX1RIUkVFUElEX0lOX1VTRVwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBVc2VyRnJpZW5kbHlFcnJvcihcIlRoaXMgcGhvbmUgbnVtYmVyIGlzIGFscmVhZHkgaW4gdXNlXCIsIHsgY2F1c2U6IGVyciB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gT3RoZXJ3aXNlLCBqdXN0IGJsdXJ0IG91dCB0aGUgc2FtZSBlcnJvclxuICAgICAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIEZvciB0YW5nbGVkIGJpbmQsIHJlcXVlc3QgYSB0b2tlbiB2aWEgdGhlIEhTLlxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRkTXNpc2RuKHBob25lQ291bnRyeSwgcGhvbmVOdW1iZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIGlmIHRoZSBlbWFpbCBsaW5rIGhhcyBiZWVuIGNsaWNrZWQgYnkgYXR0ZW1wdGluZyB0byBhZGQgdGhlIHRocmVlcGlkXG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gUmVzb2x2ZXMgaWYgdGhlIGVtYWlsIGFkZHJlc3Mgd2FzIGFkZGVkLiBSZWplY3RzIHdpdGggYW4gb2JqZWN0XG4gICAgICogd2l0aCBhIFwibWVzc2FnZVwiIHByb3BlcnR5IHdoaWNoIGNvbnRhaW5zIGEgaHVtYW4tcmVhZGFibGUgbWVzc2FnZSBkZXRhaWxpbmcgd2h5XG4gICAgICogdGhlIHJlcXVlc3QgZmFpbGVkLlxuICAgICAqL1xuICAgIHB1YmxpYyBhc3luYyBjaGVja0VtYWlsTGlua0NsaWNrZWQoKTogUHJvbWlzZTxbc3VjY2Vzcz86IGJvb2xlYW4sIHJlc3VsdD86IElBdXRoRGF0YSB8IEVycm9yIHwgbnVsbF0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmIChhd2FpdCB0aGlzLm1hdHJpeENsaWVudC5kb2VzU2VydmVyU3VwcG9ydFNlcGFyYXRlQWRkQW5kQmluZCgpKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuYmluZCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhdXRoQ2xpZW50ID0gbmV3IElkZW50aXR5QXV0aENsaWVudCgpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpZGVudGl0eUFjY2Vzc1Rva2VuID0gYXdhaXQgYXV0aENsaWVudC5nZXRBY2Nlc3NUb2tlbigpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWlkZW50aXR5QWNjZXNzVG9rZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBVc2VyRnJpZW5kbHlFcnJvcihcIk5vIGlkZW50aXR5IGFjY2VzcyB0b2tlbiBmb3VuZFwiKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLm1hdHJpeENsaWVudC5iaW5kVGhyZWVQaWQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgc2lkOiB0aGlzLnNlc3Npb25JZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsaWVudF9zZWNyZXQ6IHRoaXMuY2xpZW50U2VjcmV0LFxuICAgICAgICAgICAgICAgICAgICAgICAgaWRfc2VydmVyOiBnZXRJZFNlcnZlckRvbWFpbih0aGlzLm1hdHJpeENsaWVudCksXG4gICAgICAgICAgICAgICAgICAgICAgICBpZF9hY2Nlc3NfdG9rZW46IGlkZW50aXR5QWNjZXNzVG9rZW4sXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLm1ha2VBZGRUaHJlZXBpZE9ubHlSZXF1ZXN0KCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRoZSBzcGVjIGhhcyBhbHdheXMgcmVxdWlyZWQgdGhpcyB0byB1c2UgVUkgYXV0aCBidXQgc3luYXBzZSBicmllZmx5XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpbXBsZW1lbnRlZCBpdCB3aXRob3V0LCBzbyB0aGlzIG1heSBqdXN0IHN1Y2NlZWQgYW5kIHRoYXQncyBPSy5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBbdHJ1ZV07XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCEoZXJyIGluc3RhbmNlb2YgTWF0cml4RXJyb3IpIHx8IGVyci5odHRwU3RhdHVzICE9PSA0MDEgfHwgIWVyci5kYXRhIHx8ICFlcnIuZGF0YS5mbG93cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGRvZXNuJ3QgbG9vayBsaWtlIGFuIGludGVyYWN0aXZlLWF1dGggZmFpbHVyZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGlhbG9nQWVzdGhldGljcyA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBbU1NPQXV0aEVudHJ5LlBIQVNFX1BSRUFVVEhdOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiBfdChcIlVzZSBTaW5nbGUgU2lnbiBPbiB0byBjb250aW51ZVwiKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYm9keTogX3QoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIkNvbmZpcm0gYWRkaW5nIHRoaXMgZW1haWwgYWRkcmVzcyBieSB1c2luZyBTaW5nbGUgU2lnbiBPbiB0byBwcm92ZSB5b3VyIGlkZW50aXR5LlwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZVRleHQ6IF90KFwiU2luZ2xlIFNpZ24gT25cIiksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlS2luZDogXCJwcmltYXJ5XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBbU1NPQXV0aEVudHJ5LlBIQVNFX1BPU1RBVVRIXToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogX3QoXCJDb25maXJtIGFkZGluZyBlbWFpbFwiKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYm9keTogX3QoXCJDbGljayB0aGUgYnV0dG9uIGJlbG93IHRvIGNvbmZpcm0gYWRkaW5nIHRoaXMgZW1haWwgYWRkcmVzcy5cIiksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlVGV4dDogX3QoXCJDb25maXJtXCIpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZUtpbmQ6IFwicHJpbWFyeVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBmaW5pc2hlZCB9ID0gTW9kYWwuY3JlYXRlRGlhbG9nKEludGVyYWN0aXZlQXV0aERpYWxvZywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiBfdChcIkFkZCBFbWFpbCBBZGRyZXNzXCIpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hdHJpeENsaWVudDogdGhpcy5tYXRyaXhDbGllbnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXV0aERhdGE6IGVyci5kYXRhLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1ha2VSZXF1ZXN0OiB0aGlzLm1ha2VBZGRUaHJlZXBpZE9ubHlSZXF1ZXN0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFlc3RoZXRpY3NGb3JTdGFnZVBoYXNlczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbU1NPQXV0aEVudHJ5LkxPR0lOX1RZUEVdOiBkaWFsb2dBZXN0aGV0aWNzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbU1NPQXV0aEVudHJ5LlVOU1RBQkxFX0xPR0lOX1RZUEVdOiBkaWFsb2dBZXN0aGV0aWNzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmaW5pc2hlZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5tYXRyaXhDbGllbnQuYWRkVGhyZWVQaWQoXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpZDogdGhpcy5zZXNzaW9uSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGllbnRfc2VjcmV0OiB0aGlzLmNsaWVudFNlY3JldCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkX3NlcnZlcjogZ2V0SWRTZXJ2ZXJEb21haW4odGhpcy5tYXRyaXhDbGllbnQpLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB0aGlzLmJpbmQsXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBpZiAoZXJyIGluc3RhbmNlb2YgSFRUUEVycm9yICYmIGVyci5odHRwU3RhdHVzID09PSA0MDEpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVXNlckZyaWVuZGx5RXJyb3IoXG4gICAgICAgICAgICAgICAgICAgIFwiRmFpbGVkIHRvIHZlcmlmeSBlbWFpbCBhZGRyZXNzOiBtYWtlIHN1cmUgeW91IGNsaWNrZWQgdGhlIGxpbmsgaW4gdGhlIGVtYWlsXCIsXG4gICAgICAgICAgICAgICAgICAgIHsgY2F1c2U6IGVyciB9LFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBPdGhlcndpc2UsIGp1c3QgYmx1cnQgb3V0IHRoZSBzYW1lIGVycm9yXG4gICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7e3R5cGU6IHN0cmluZywgc2Vzc2lvbj86IHN0cmluZ319IGF1dGggVUkgYXV0aCBvYmplY3RcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlPE9iamVjdD59IFJlc3BvbnNlIGZyb20gLzNwaWQvYWRkIGNhbGwgKGluIGN1cnJlbnQgc3BlYywgYW4gZW1wdHkgb2JqZWN0KVxuICAgICAqL1xuICAgIHByaXZhdGUgbWFrZUFkZFRocmVlcGlkT25seVJlcXVlc3QgPSAoYXV0aD86IHsgdHlwZTogc3RyaW5nOyBzZXNzaW9uPzogc3RyaW5nIH0pOiBQcm9taXNlPHt9PiA9PiB7XG4gICAgICAgIHJldHVybiB0aGlzLm1hdHJpeENsaWVudC5hZGRUaHJlZVBpZE9ubHkoe1xuICAgICAgICAgICAgc2lkOiB0aGlzLnNlc3Npb25JZCxcbiAgICAgICAgICAgIGNsaWVudF9zZWNyZXQ6IHRoaXMuY2xpZW50U2VjcmV0LFxuICAgICAgICAgICAgYXV0aCxcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFRha2VzIGEgcGhvbmUgbnVtYmVyIHZlcmlmaWNhdGlvbiBjb2RlIGFzIGVudGVyZWQgYnkgdGhlIHVzZXIgYW5kIHZhbGlkYXRlc1xuICAgICAqIGl0IHdpdGggdGhlIGlkZW50aXR5IHNlcnZlciwgdGhlbiBpZiBzdWNjZXNzZnVsLCBhZGRzIHRoZSBwaG9uZSBudW1iZXIuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG1zaXNkblRva2VuIHBob25lIG51bWJlciB2ZXJpZmljYXRpb24gY29kZSBhcyBlbnRlcmVkIGJ5IHRoZSB1c2VyXG4gICAgICogQHJldHVybiB7UHJvbWlzZX0gUmVzb2x2ZXMgaWYgdGhlIHBob25lIG51bWJlciB3YXMgYWRkZWQuIFJlamVjdHMgd2l0aCBhbiBvYmplY3RcbiAgICAgKiB3aXRoIGEgXCJtZXNzYWdlXCIgcHJvcGVydHkgd2hpY2ggY29udGFpbnMgYSBodW1hbi1yZWFkYWJsZSBtZXNzYWdlIGRldGFpbGluZyB3aHlcbiAgICAgKiB0aGUgcmVxdWVzdCBmYWlsZWQuXG4gICAgICovXG4gICAgcHVibGljIGFzeW5jIGhhdmVNc2lzZG5Ub2tlbihcbiAgICAgICAgbXNpc2RuVG9rZW46IHN0cmluZyxcbiAgICApOiBQcm9taXNlPFtzdWNjZXNzPzogYm9vbGVhbiwgcmVzdWx0PzogSUF1dGhEYXRhIHwgRXJyb3IgfCBudWxsXSB8IHVuZGVmaW5lZD4ge1xuICAgICAgICBjb25zdCBhdXRoQ2xpZW50ID0gbmV3IElkZW50aXR5QXV0aENsaWVudCgpO1xuICAgICAgICBjb25zdCBzdXBwb3J0c1NlcGFyYXRlQWRkQW5kQmluZCA9IGF3YWl0IHRoaXMubWF0cml4Q2xpZW50LmRvZXNTZXJ2ZXJTdXBwb3J0U2VwYXJhdGVBZGRBbmRCaW5kKCk7XG5cbiAgICAgICAgbGV0IHJlc3VsdDogeyBzdWNjZXNzOiBib29sZWFuIH0gfCBNYXRyaXhFcnJvcjtcbiAgICAgICAgaWYgKHRoaXMuc3VibWl0VXJsKSB7XG4gICAgICAgICAgICByZXN1bHQgPSBhd2FpdCB0aGlzLm1hdHJpeENsaWVudC5zdWJtaXRNc2lzZG5Ub2tlbk90aGVyVXJsKFxuICAgICAgICAgICAgICAgIHRoaXMuc3VibWl0VXJsLFxuICAgICAgICAgICAgICAgIHRoaXMuc2Vzc2lvbklkLFxuICAgICAgICAgICAgICAgIHRoaXMuY2xpZW50U2VjcmV0LFxuICAgICAgICAgICAgICAgIG1zaXNkblRva2VuLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmJpbmQgfHwgIXN1cHBvcnRzU2VwYXJhdGVBZGRBbmRCaW5kKSB7XG4gICAgICAgICAgICByZXN1bHQgPSBhd2FpdCB0aGlzLm1hdHJpeENsaWVudC5zdWJtaXRNc2lzZG5Ub2tlbihcbiAgICAgICAgICAgICAgICB0aGlzLnNlc3Npb25JZCxcbiAgICAgICAgICAgICAgICB0aGlzLmNsaWVudFNlY3JldCxcbiAgICAgICAgICAgICAgICBtc2lzZG5Ub2tlbixcbiAgICAgICAgICAgICAgICBhd2FpdCBhdXRoQ2xpZW50LmdldEFjY2Vzc1Rva2VuKCksXG4gICAgICAgICAgICApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFVzZXJGcmllbmRseUVycm9yKFwiVGhlIGFkZCAvIGJpbmQgd2l0aCBNU0lTRE4gZmxvdyBpcyBtaXNjb25maWd1cmVkXCIpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZXN1bHQgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICAgICAgdGhyb3cgcmVzdWx0O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHN1cHBvcnRzU2VwYXJhdGVBZGRBbmRCaW5kKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5iaW5kKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5tYXRyaXhDbGllbnQuYmluZFRocmVlUGlkKHtcbiAgICAgICAgICAgICAgICAgICAgc2lkOiB0aGlzLnNlc3Npb25JZCxcbiAgICAgICAgICAgICAgICAgICAgY2xpZW50X3NlY3JldDogdGhpcy5jbGllbnRTZWNyZXQsXG4gICAgICAgICAgICAgICAgICAgIGlkX3NlcnZlcjogZ2V0SWRTZXJ2ZXJEb21haW4odGhpcy5tYXRyaXhDbGllbnQpLFxuICAgICAgICAgICAgICAgICAgICBpZF9hY2Nlc3NfdG9rZW46IGF3YWl0IGF1dGhDbGllbnQuZ2V0QWNjZXNzVG9rZW4oKSxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5tYWtlQWRkVGhyZWVwaWRPbmx5UmVxdWVzdCgpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFRoZSBzcGVjIGhhcyBhbHdheXMgcmVxdWlyZWQgdGhpcyB0byB1c2UgVUkgYXV0aCBidXQgc3luYXBzZSBicmllZmx5XG4gICAgICAgICAgICAgICAgICAgIC8vIGltcGxlbWVudGVkIGl0IHdpdGhvdXQsIHNvIHRoaXMgbWF5IGp1c3Qgc3VjY2VlZCBhbmQgdGhhdCdzIE9LLlxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghKGVyciBpbnN0YW5jZW9mIE1hdHJpeEVycm9yKSB8fCBlcnIuaHR0cFN0YXR1cyAhPT0gNDAxIHx8ICFlcnIuZGF0YSB8fCAhZXJyLmRhdGEuZmxvd3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGRvZXNuJ3QgbG9vayBsaWtlIGFuIGludGVyYWN0aXZlLWF1dGggZmFpbHVyZVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGlhbG9nQWVzdGhldGljcyA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFtTU09BdXRoRW50cnkuUEhBU0VfUFJFQVVUSF06IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogX3QoXCJVc2UgU2luZ2xlIFNpZ24gT24gdG8gY29udGludWVcIiksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYm9keTogX3QoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiQ29uZmlybSBhZGRpbmcgdGhpcyBwaG9uZSBudW1iZXIgYnkgdXNpbmcgU2luZ2xlIFNpZ24gT24gdG8gcHJvdmUgeW91ciBpZGVudGl0eS5cIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlVGV4dDogX3QoXCJTaW5nbGUgU2lnbiBPblwiKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZUtpbmQ6IFwicHJpbWFyeVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIFtTU09BdXRoRW50cnkuUEhBU0VfUE9TVEFVVEhdOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6IF90KFwiQ29uZmlybSBhZGRpbmcgcGhvbmUgbnVtYmVyXCIpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJvZHk6IF90KFwiQ2xpY2sgdGhlIGJ1dHRvbiBiZWxvdyB0byBjb25maXJtIGFkZGluZyB0aGlzIHBob25lIG51bWJlci5cIiksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWVUZXh0OiBfdChcIkNvbmZpcm1cIiksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWVLaW5kOiBcInByaW1hcnlcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgZmluaXNoZWQgfSA9IE1vZGFsLmNyZWF0ZURpYWxvZyhJbnRlcmFjdGl2ZUF1dGhEaWFsb2csIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiBfdChcIkFkZCBQaG9uZSBOdW1iZXJcIiksXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRyaXhDbGllbnQ6IHRoaXMubWF0cml4Q2xpZW50LFxuICAgICAgICAgICAgICAgICAgICAgICAgYXV0aERhdGE6IGVyci5kYXRhLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWFrZVJlcXVlc3Q6IHRoaXMubWFrZUFkZFRocmVlcGlkT25seVJlcXVlc3QsXG4gICAgICAgICAgICAgICAgICAgICAgICBhZXN0aGV0aWNzRm9yU3RhZ2VQaGFzZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBbU1NPQXV0aEVudHJ5LkxPR0lOX1RZUEVdOiBkaWFsb2dBZXN0aGV0aWNzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFtTU09BdXRoRW50cnkuVU5TVEFCTEVfTE9HSU5fVFlQRV06IGRpYWxvZ0Flc3RoZXRpY3MsXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZpbmlzaGVkO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMubWF0cml4Q2xpZW50LmFkZFRocmVlUGlkKFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgc2lkOiB0aGlzLnNlc3Npb25JZCxcbiAgICAgICAgICAgICAgICAgICAgY2xpZW50X3NlY3JldDogdGhpcy5jbGllbnRTZWNyZXQsXG4gICAgICAgICAgICAgICAgICAgIGlkX3NlcnZlcjogZ2V0SWRTZXJ2ZXJEb21haW4odGhpcy5tYXRyaXhDbGllbnQpLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgdGhpcy5iaW5kLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFtQkEsSUFBQUEsT0FBQSxHQUFBQyxPQUFBO0FBRUEsSUFBQUMsTUFBQSxHQUFBQyxzQkFBQSxDQUFBRixPQUFBO0FBQ0EsSUFBQUcsZ0JBQUEsR0FBQUgsT0FBQTtBQUNBLElBQUFJLG1CQUFBLEdBQUFGLHNCQUFBLENBQUFGLE9BQUE7QUFDQSxJQUFBSywrQkFB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