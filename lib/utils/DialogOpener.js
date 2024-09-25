"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DialogOpener = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _classnames = _interopRequireDefault(require("classnames"));
var _dispatcher = _interopRequireDefault(require("../dispatcher/dispatcher"));
var _Modal = _interopRequireDefault(require("../Modal"));
var _RoomSettingsDialog = _interopRequireDefault(require("../components/views/dialogs/RoomSettingsDialog"));
var _ForwardDialog = _interopRequireDefault(require("../components/views/dialogs/ForwardDialog"));
var _actions = require("../dispatcher/actions");
var _ReportEventDialog = _interopRequireDefault(require("../components/views/dialogs/ReportEventDialog"));
var _SpacePreferencesDialog = _interopRequireDefault(require("../components/views/dialogs/SpacePreferencesDialog"));
var _SpaceSettingsDialog = _interopRequireDefault(require("../components/views/dialogs/SpaceSettingsDialog"));
var _InviteDialog = _interopRequireDefault(require("../components/views/dialogs/InviteDialog"));
var _AddExistingToSpaceDialog = _interopRequireDefault(require("../components/views/dialogs/AddExistingToSpaceDialog"));
var _PosthogTrackers = _interopRequireDefault(require("../PosthogTrackers"));
var _space = require("./space");
var _SDKContext = require("../contexts/SDKContext");
/*
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

/**
 * Auxiliary class to listen for dialog opening over the dispatcher and
 * open the required dialogs. Not all dialogs run through here, but the
 * ones which cause import cycles are good candidates.
 */
class DialogOpener {
  constructor() {
    (0, _defineProperty2.default)(this, "isRegistered", false);
    (0, _defineProperty2.default)(this, "matrixClient", void 0);
    (0, _defineProperty2.default)(this, "onDispatch", payload => {
      if (!this.matrixClient) return;
      switch (payload.action) {
        case "open_room_settings":
          _Modal.default.createDialog(_RoomSettingsDialog.default, {
            roomId: payload.room_id || _SDKContext.SdkContextClass.instance.roomViewStore.getRoomId(),
            initialTabId: payload.initial_tab_id
          }, /*className=*/undefined, /*isPriority=*/false, /*isStatic=*/true);
          break;
        case _actions.Action.OpenForwardDialog:
          _Modal.default.createDialog(_ForwardDialog.default, {
            matrixClient: this.matrixClient,
            event: payload.event,
            permalinkCreator: payload.permalinkCreator
          });
          break;
        case _actions.Action.OpenReportEventDialog:
          _Modal.default.createDialog(_ReportEventDialog.default, {
            mxEvent: payload.event
          }, "mx_Dialog_reportEvent");
          break;
        case _actions.Action.OpenSpacePreferences:
          _Modal.default.createDialog(_SpacePreferencesDialog.default, {
            initialTabId: payload.initalTabId,
            space: payload.space
          }, undefined, false, true);
          break;
        case _actions.Action.OpenSpaceSettings:
          _Modal.default.createDialog(_SpaceSettingsDialog.default, {
            matrixClient: payload.space.client,
            space: payload.space
          }, /*className=*/undefined, /*isPriority=*/false, /*isStatic=*/true);
          break;
        case _actions.Action.OpenInviteDialog:
          _Modal.default.createDialog(_InviteDialog.default, {
            kind: payload.kind,
            call: payload.call,
            roomId: payload.roomId
          }, (0, _classnames.default)("mx_InviteDialog_flexWrapper", payload.className), false, true).finished.then(results => {
            payload.onFinishedCallback?.(results);
          });
          break;
        case _actions.Action.OpenAddToExistingSpaceDialog:
          {
            const space = payload.space;
            _Modal.default.createDialog(_AddExistingToSpaceDialog.default, {
              onCreateRoomClick: ev => {
                (0, _space.showCreateNewRoom)(space);
                _PosthogTrackers.default.trackInteraction("WebAddExistingToSpaceDialogCreateRoomButton", ev);
              },
              onAddSubspaceClick: () => (0, _space.showAddExistingSubspace)(space),
              space,
              onFinished: added => {
                if (added && _SDKContext.SdkContextClass.instance.roomViewStore.getRoomId() === space.roomId) {
                  _dispatcher.default.fire(_actions.Action.UpdateSpaceHierarchy);
                }
              }
            }, "mx_AddExistingToSpaceDialog_wrapper");
            break;
          }
      }
    });
  }

  // We could do this in the constructor, but then we wouldn't have
  // a function to call from Lifecycle to capture the class.
  prepare(matrixClient) {
    this.matrixClient = matrixClient;
    if (this.isRegistered) return;
    _dispatcher.default.register(this.onDispatch);
    this.isRegistered = true;
  }
}
exports.DialogOpener = DialogOpener;
(0, _defineProperty2.default)(DialogOpener, "instance", new DialogOpener());
//# sourceMappingURL=DialogOpener.js.map