"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _matrix = require("matrix-js-sdk/src/matrix");
var _utils = require("matrix-js-sdk/src/utils");
var _SdkConfig = _interopRequireDefault(require("../SdkConfig"));
var _submitRageshake = _interopRequireDefault(require("../rageshake/submit-rageshake"));
var _dispatcher = _interopRequireDefault(require("../dispatcher/dispatcher"));
var _AsyncStoreWithClient = require("./AsyncStoreWithClient");
var _SettingsStore = _interopRequireDefault(require("../settings/SettingsStore"));
var _actions = require("../dispatcher/actions");
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; } /*
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
// Minimum interval of 1 minute between reports
const RAGESHAKE_INTERVAL = 60000;
// Before rageshaking, wait 5 seconds and see if the message has successfully decrypted
const GRACE_PERIOD = 5000;
// Event type for to-device messages requesting sender auto-rageshakes
const AUTO_RS_REQUEST = "im.vector.auto_rs_request";
/**
 * Watches for decryption errors to auto-report if the relevant lab is
 * enabled, and keeps track of session IDs that have already been
 * reported.
 */
class AutoRageshakeStore extends _AsyncStoreWithClient.AsyncStoreWithClient {
  constructor() {
    super(_dispatcher.default, {
      reportedSessionIds: new Set(),
      lastRageshakeTime: 0,
      initialSyncCompleted: false
    });
    this.onDecryptionAttempt = this.onDecryptionAttempt.bind(this);
    this.onDeviceMessage = this.onDeviceMessage.bind(this);
    this.onSyncStateChange = this.onSyncStateChange.bind(this);
  }
  static get instance() {
    return AutoRageshakeStore.internalInstance;
  }
  async onAction(payload) {
    switch (payload.action) {
      case _actions.Action.ReportKeyBackupNotEnabled:
        this.onReportKeyBackupNotEnabled();
    }
  }
  async onReady() {
    if (!_SettingsStore.default.getValue("automaticDecryptionErrorReporting")) return;
    if (this.matrixClient) {
      this.matrixClient.on(_matrix.MatrixEventEvent.Decrypted, this.onDecryptionAttempt);
      this.matrixClient.on(_matrix.ClientEvent.ToDeviceEvent, this.onDeviceMessage);
      this.matrixClient.on(_matrix.ClientEvent.Sync, this.onSyncStateChange);
    }
  }
  async onNotReady() {
    if (this.matrixClient) {
      this.matrixClient.removeListener(_matrix.ClientEvent.ToDeviceEvent, this.onDeviceMessage);
      this.matrixClient.removeListener(_matrix.MatrixEventEvent.Decrypted, this.onDecryptionAttempt);
      this.matrixClient.removeListener(_matrix.ClientEvent.Sync, this.onSyncStateChange);
    }
  }
  async onDecryptionAttempt(ev) {
    if (!this.state.initialSyncCompleted) {
      return;
    }
    const wireContent = ev.getWireContent();
    const sessionId = wireContent.session_id;
    if (ev.isDecryptionFailure() && !this.state.reportedSessionIds.has(sessionId)) {
      await (0, _utils.sleep)(GRACE_PERIOD);
      if (!ev.isDecryptionFailure()) {
        return;
      }
      const newReportedSessionIds = new Set(this.state.reportedSessionIds);
      await this.updateState({
        reportedSessionIds: newReportedSessionIds.add(sessionId)
      });
      const now = new Date().getTime();
      if (now - this.state.lastRageshakeTime < RAGESHAKE_INTERVAL) {
        return;
      }
      await this.updateState({
        lastRageshakeTime: now
      });
      const eventInfo = {
        event_id: ev.getId(),
        room_id: ev.getRoomId(),
        session_id: sessionId,
        device_id: wireContent.device_id,
        user_id: ev.getSender(),
        sender_key: wireContent.sender_key
      };
      const rageshakeURL = await (0, _submitRageshake.default)(_SdkConfig.default.get().bug_report_endpoint_url, {
        userText: "Auto-reporting decryption error (recipient)",
        sendLogs: true,
        labels: ["Z-UISI", "web", "uisi-recipient"],
        customApp: _SdkConfig.default.get().uisi_autorageshake_app,
        customFields: {
          auto_uisi: JSON.stringify(eventInfo)
        }
      });
      const messageContent = _objectSpread(_objectSpread({}, eventInfo), {}, {
        recipient_rageshake: rageshakeURL
      });
      this.matrixClient?.sendToDevice(AUTO_RS_REQUEST, new Map([["messageContent.user_id", new Map([[messageContent.device_id, messageContent]])]]));
    }
  }
  async onSyncStateChange(_state, _prevState, data) {
    if (!this.state.initialSyncCompleted) {
      await this.updateState({
        initialSyncCompleted: !!data?.nextSyncToken
      });
    }
  }
  async onDeviceMessage(ev) {
    if (ev.getType() !== AUTO_RS_REQUEST) return;
    const messageContent = ev.getContent();
    const recipientRageshake = messageContent["recipient_rageshake"] || "";
    const now = new Date().getTime();
    if (now - this.state.lastRageshakeTime > RAGESHAKE_INTERVAL) {
      await this.updateState({
        lastRageshakeTime: now
      });
      await (0, _submitRageshake.default)(_SdkConfig.default.get().bug_report_endpoint_url, {
        userText: `Auto-reporting decryption error (sender)\nRecipient rageshake: ${recipientRageshake}`,
        sendLogs: true,
        labels: ["Z-UISI", "web", "uisi-sender"],
        customApp: _SdkConfig.default.get().uisi_autorageshake_app,
        customFields: {
          recipient_rageshake: recipientRageshake,
          auto_uisi: JSON.stringify(messageContent)
        }
      });
    }
  }
  async onReportKeyBackupNotEnabled() {
    if (!_SettingsStore.default.getValue("automaticKeyBackNotEnabledReporting")) return;
    await (0, _submitRageshake.default)(_SdkConfig.default.get().bug_report_endpoint_url, {
      userText: `Auto-reporting key backup not enabled`,
      sendLogs: true,
      labels: ["web", _actions.Action.ReportKeyBackupNotEnabled]
    });
  }
}
exports.default = AutoRageshakeStore;
(0, _defineProperty2.default)(AutoRageshakeStore, "internalInstance", (() => {
  const instance = new AutoRageshakeStore();
  instance.start();
  return instance;
})());
window.mxAutoRageshakeStore = AutoRageshakeStore.instance;
//# sourceMappingURL=AutoRageshakeStore.js.map