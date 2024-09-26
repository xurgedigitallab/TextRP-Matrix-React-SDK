"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.IntegrationManagers = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _logger = require("matrix-js-sdk/src/logger");
var _client = require("matrix-js-sdk/src/client");
var _utils = require("matrix-js-sdk/src/utils");
var _SdkConfig = _interopRequireDefault(require("../SdkConfig"));
var _Modal = _interopRequireDefault(require("../Modal"));
var _IntegrationManagerInstance = require("./IntegrationManagerInstance");
var _IntegrationsImpossibleDialog = _interopRequireDefault(require("../components/views/dialogs/IntegrationsImpossibleDialog"));
var _IntegrationsDisabledDialog = _interopRequireDefault(require("../components/views/dialogs/IntegrationsDisabledDialog"));
var _WidgetUtils = _interopRequireDefault(require("../utils/WidgetUtils"));
var _MatrixClientPeg = require("../MatrixClientPeg");
var _UrlUtils = require("../utils/UrlUtils");
/*
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

const KIND_PREFERENCE = [
// Ordered: first is most preferred, last is least preferred.
_IntegrationManagerInstance.Kind.Account, _IntegrationManagerInstance.Kind.Homeserver, _IntegrationManagerInstance.Kind.Config];
class IntegrationManagers {
  static sharedInstance() {
    if (!IntegrationManagers.instance) {
      IntegrationManagers.instance = new IntegrationManagers();
    }
    return IntegrationManagers.instance;
  }
  constructor() {
    (0, _defineProperty2.default)(this, "managers", []);
    (0, _defineProperty2.default)(this, "client", void 0);
    (0, _defineProperty2.default)(this, "primaryManager", null);
    (0, _defineProperty2.default)(this, "setupHomeserverManagers", async discoveryResponse => {
      _logger.logger.log("Updating homeserver-configured integration managers...");
      if (discoveryResponse && discoveryResponse["m.integrations"]) {
        let managers = discoveryResponse["m.integrations"]["managers"];
        if (!Array.isArray(managers)) managers = []; // make it an array so we can wipe the HS managers

        _logger.logger.log(`Homeserver has ${managers.length} integration managers`);

        // Clear out any known managers for the homeserver
        // TODO: Log out of the scalar clients
        this.managers = this.managers.filter(m => m.kind !== _IntegrationManagerInstance.Kind.Homeserver);

        // Now add all the managers the homeserver wants us to have
        for (const hsManager of managers) {
          if (!hsManager["api_url"]) continue;
          this.managers.push(new _IntegrationManagerInstance.IntegrationManagerInstance(_IntegrationManagerInstance.Kind.Homeserver, hsManager["api_url"], hsManager["ui_url"]) // optional
          );
        }

        this.primaryManager = null; // reset primary
      } else {
        _logger.logger.log("Homeserver has no integration managers");
      }
    });
    (0, _defineProperty2.default)(this, "onAccountData", ev => {
      if (ev.getType() === "m.widgets") {
        this.compileManagers();
      }
    });
    this.compileManagers();
  }
  startWatching() {
    this.stopWatching();
    this.client = _MatrixClientPeg.MatrixClientPeg.get();
    this.client.on(_client.ClientEvent.AccountData, this.onAccountData);
    this.client.on(_client.ClientEvent.ClientWellKnown, this.setupHomeserverManagers);
    this.compileManagers();
  }
  stopWatching() {
    if (!this.client) return;
    this.client.removeListener(_client.ClientEvent.AccountData, this.onAccountData);
    this.client.removeListener(_client.ClientEvent.ClientWellKnown, this.setupHomeserverManagers);
  }
  compileManagers() {
    this.managers = [];
    this.setupConfiguredManager();
    this.setupAccountManagers();
  }
  setupConfiguredManager() {
    const apiUrl = _SdkConfig.default.get("integrations_rest_url");
    const uiUrl = _SdkConfig.default.get("integrations_ui_url");
    if (apiUrl && uiUrl) {
      this.managers.push(new _IntegrationManagerInstance.IntegrationManagerInstance(_IntegrationManagerInstance.Kind.Config, apiUrl, uiUrl));
      this.primaryManager = null; // reset primary
    }
  }

  setupAccountManagers() {
    if (!this.client || !this.client.getUserId()) return; // not logged in
    const widgets = _WidgetUtils.default.getIntegrationManagerWidgets(this.client);
    widgets.forEach(w => {
      const data = w.content["data"];
      if (!data) return;
      const uiUrl = w.content["url"];
      const apiUrl = data["api_url"];
      if (!apiUrl || !uiUrl) return;
      const manager = new _IntegrationManagerInstance.IntegrationManagerInstance(_IntegrationManagerInstance.Kind.Account, apiUrl, uiUrl, w["id"] || w["state_key"] || "");
      this.managers.push(manager);
    });
    this.primaryManager = null; // reset primary
  }

  hasManager() {
    return this.managers.length > 0;
  }
  getOrderedManagers() {
    const ordered = [];
    for (const kind of KIND_PREFERENCE) {
      const managers = this.managers.filter(m => m.kind === kind);
      if (!managers || !managers.length) continue;
      if (kind === _IntegrationManagerInstance.Kind.Account) {
        // Order by state_keys (IDs)
        managers.sort((a, b) => (0, _utils.compare)(a.id ?? "", b.id ?? ""));
      }
      ordered.push(...managers);
    }
    return ordered;
  }
  getPrimaryManager() {
    if (this.hasManager()) {
      if (this.primaryManager) return this.primaryManager;
      this.primaryManager = this.getOrderedManagers()[0];
      return this.primaryManager;
    } else {
      return null;
    }
  }
  openNoManagerDialog() {
    _Modal.default.createDialog(_IntegrationsImpossibleDialog.default);
  }
  showDisabledDialog() {
    _Modal.default.createDialog(_IntegrationsDisabledDialog.default);
  }

  /**
   * Attempts to discover an integration manager using only its name. This will not validate that
   * the integration manager is functional - that is the caller's responsibility.
   * @param {string} domainName The domain name to look up.
   * @returns {Promise<IntegrationManagerInstance>} Resolves to an integration manager instance,
   * or null if none was found.
   */
  async tryDiscoverManager(domainName) {
    _logger.logger.log("Looking up integration manager via .well-known");
    if (domainName.startsWith("http:") || domainName.startsWith("https:")) {
      // trim off the scheme and just use the domain
      domainName = (0, _UrlUtils.parseUrl)(domainName).host;
    }
    let wkConfig;
    try {
      const result = await fetch(`https://${domainName}/.well-known/matrix/integrations`);
      wkConfig = await result.json();
    } catch (e) {
      _logger.logger.error(e);
      _logger.logger.warn("Failed to locate integration manager");
      return null;
    }
    if (!wkConfig || !wkConfig["m.integrations_widget"]) {
      _logger.logger.warn("Missing integrations widget on .well-known response");
      return null;
    }
    const widget = wkConfig["m.integrations_widget"];
    if (!widget["url"] || !widget["data"] || !widget["data"]["api_url"]) {
      _logger.logger.warn("Malformed .well-known response for integrations widget");
      return null;
    }

    // All discovered managers are per-user managers
    const manager = new _IntegrationManagerInstance.IntegrationManagerInstance(_IntegrationManagerInstance.Kind.Account, widget["data"]["api_url"], widget["url"]);
    _logger.logger.log("Got an integration manager (untested)");

    // We don't test the manager because the caller may need to do extra
    // checks or similar with it. For instance, they may need to deal with
    // terms of service or want to call something particular.

    return manager;
  }
}

// For debugging
exports.IntegrationManagers = IntegrationManagers;
(0, _defineProperty2.default)(IntegrationManagers, "instance", void 0);
window.mxIntegrationManagers = IntegrationManagers;
//# sourceMappingURL=IntegrationManagers.js.map