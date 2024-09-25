"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.cancelPreviousPendingEdit = cancelPreviousPendingEdit;
exports.endEditing = endEditing;
var _matrix = require("matrix-js-sdk/src/matrix");
var _dispatcher = _interopRequireDefault(require("../../../../../dispatcher/dispatcher"));
var _actions = require("../../../../../dispatcher/actions");
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

function endEditing(roomContext) {
  // todo local storage
  // localStorage.removeItem(this.editorRoomKey);
  // localStorage.removeItem(this.editorStateKey);

  // close the event editing and focus composer
  _dispatcher.default.dispatch({
    action: _actions.Action.EditEvent,
    event: null,
    timelineRenderingType: roomContext.timelineRenderingType
  });
  _dispatcher.default.dispatch({
    action: _actions.Action.FocusSendMessageComposer,
    context: roomContext.timelineRenderingType
  });
}
function cancelPreviousPendingEdit(mxClient, editorStateTransfer) {
  const originalEvent = editorStateTransfer.getEvent();
  const previousEdit = originalEvent.replacingEvent();
  if (previousEdit && (previousEdit.status === _matrix.EventStatus.QUEUED || previousEdit.status === _matrix.EventStatus.NOT_SENT)) {
    mxClient.cancelPendingEvent(previousEdit);
  }
}
//# sourceMappingURL=editing.js.map