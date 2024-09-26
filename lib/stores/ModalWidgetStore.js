"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ModalWidgetStore = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _logger = require("matrix-js-sdk/src/logger");
var _AsyncStoreWithClient = require("./AsyncStoreWithClient");
var _dispatcher = _interopRequireDefault(require("../dispatcher/dispatcher"));
var _Modal = _interopRequireDefault(require("../Modal"));
var _ModalWidgetDialog = _interopRequireDefault(require("../components/views/dialogs/ModalWidgetDialog"));
var _WidgetMessagingStore = require("./widgets/WidgetMessagingStore");
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; } /*
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
class ModalWidgetStore extends _AsyncStoreWithClient.AsyncStoreWithClient {
  constructor() {
    super(_dispatcher.default, {});
    (0, _defineProperty2.default)(this, "modalInstance", null);
    (0, _defineProperty2.default)(this, "openSourceWidgetId", null);
    (0, _defineProperty2.default)(this, "openSourceWidgetRoomId", null);
    (0, _defineProperty2.default)(this, "canOpenModalWidget", () => {
      return !this.modalInstance;
    });
    (0, _defineProperty2.default)(this, "openModalWidget", (requestData, sourceWidget, widgetRoomId) => {
      if (this.modalInstance) return;
      this.openSourceWidgetId = sourceWidget.id;
      this.openSourceWidgetRoomId = widgetRoomId ?? null;
      this.modalInstance = _Modal.default.createDialog(_ModalWidgetDialog.default, {
        widgetDefinition: _objectSpread({}, requestData),
        widgetRoomId,
        sourceWidgetId: sourceWidget.id,
        onFinished: (success, data) => {
          if (!success) {
            this.closeModalWidget(sourceWidget, widgetRoomId, {
              "m.exited": true
            });
          } else {
            this.closeModalWidget(sourceWidget, widgetRoomId, data);
          }
          this.openSourceWidgetId = null;
          this.openSourceWidgetRoomId = null;
          this.modalInstance = null;
        }
      }, undefined, /* priority = */false, /* static = */true);
    });
    (0, _defineProperty2.default)(this, "closeModalWidget", (sourceWidget, widgetRoomId, data) => {
      if (!this.modalInstance) return;
      if (this.openSourceWidgetId === sourceWidget.id && this.openSourceWidgetRoomId === widgetRoomId) {
        this.openSourceWidgetId = null;
        this.openSourceWidgetRoomId = null;
        this.modalInstance.close();
        this.modalInstance = null;
        const sourceMessaging = _WidgetMessagingStore.WidgetMessagingStore.instance.getMessaging(sourceWidget, widgetRoomId);
        if (!sourceMessaging) {
          _logger.logger.error("No source widget messaging for modal widget");
          return;
        }
        sourceMessaging.notifyModalWidgetClose(data);
      }
    });
  }
  static get instance() {
    return ModalWidgetStore.internalInstance;
  }
  async onAction(payload) {
    // nothing
  }
}
exports.ModalWidgetStore = ModalWidgetStore;
(0, _defineProperty2.default)(ModalWidgetStore, "internalInstance", (() => {
  const instance = new ModalWidgetStore();
  instance.start();
  return instance;
})());
window.mxModalWidgetStore = ModalWidgetStore.instance;
//# sourceMappingURL=ModalWidgetStore.js.map