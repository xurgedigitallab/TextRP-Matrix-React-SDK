"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Jitsi = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _logger = require("matrix-js-sdk/src/logger");
var _client = require("matrix-js-sdk/src/client");
var _SdkConfig = _interopRequireDefault(require("../SdkConfig"));
var _MatrixClientPeg = require("../MatrixClientPeg");
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

const JITSI_WK_PROPERTY = "im.vector.riot.jitsi";
class Jitsi {
  constructor() {
    (0, _defineProperty2.default)(this, "domain", void 0);
    (0, _defineProperty2.default)(this, "update", async discoveryResponse => {
      // Start with a default of the config's domain
      let domain = _SdkConfig.default.getObject("jitsi")?.get("preferred_domain") || "meet.element.io";
      _logger.logger.log("Attempting to get Jitsi conference information from homeserver");
      const wkPreferredDomain = discoveryResponse?.[JITSI_WK_PROPERTY]?.["preferredDomain"];
      if (wkPreferredDomain) domain = wkPreferredDomain;

      // Put the result into memory for us to use later
      this.domain = domain;
      _logger.logger.log("Jitsi conference domain:", this.preferredDomain);
    });
  }
  get preferredDomain() {
    return this.domain || "meet.element.io";
  }

  /**
   * Checks for auth needed by looking up a well-known file
   *
   * If the file does not exist, we assume no auth.
   *
   * See https://github.com/matrix-org/prosody-mod-auth-matrix-user-verification
   */
  async getJitsiAuth() {
    if (!this.preferredDomain) {
      return null;
    }
    let data;
    try {
      const response = await fetch(`https://${this.preferredDomain}/.well-known/element/jitsi`);
      data = await response.json();
    } catch (error) {
      return null;
    }
    if (data.auth) {
      return data.auth;
    }
    return null;
  }
  start() {
    const cli = _MatrixClientPeg.MatrixClientPeg.get();
    cli.on(_client.ClientEvent.ClientWellKnown, this.update);
    // call update initially in case we missed the first WellKnown.client event and for if no well-known present
    this.update(cli.getClientWellKnown());
  }
  /**
   * Parses the given URL into the data needed for a Jitsi widget, if the widget
   * URL matches the preferredDomain for the app.
   * @param {string} url The URL to parse.
   * @returns {JitsiWidgetData} The widget data if eligible, otherwise null.
   */
  parsePreferredConferenceUrl(url) {
    const parsed = new URL(url);
    if (parsed.hostname !== this.preferredDomain) return null; // invalid
    return {
      // URL pathnames always contain a leading slash.
      // Remove it to be left with just the conference name.
      conferenceId: parsed.pathname.substring(1),
      domain: parsed.hostname,
      isAudioOnly: false
    };
  }
  static getInstance() {
    if (!Jitsi.instance) {
      Jitsi.instance = new Jitsi();
    }
    return Jitsi.instance;
  }
}
exports.Jitsi = Jitsi;
(0, _defineProperty2.default)(Jitsi, "instance", void 0);
//# sourceMappingURL=Jitsi.js.map