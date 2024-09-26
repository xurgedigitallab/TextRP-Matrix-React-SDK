"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.addManagedHybridWidget = addManagedHybridWidget;
exports.isManagedHybridWidgetEnabled = isManagedHybridWidgetEnabled;
var _logger = require("matrix-js-sdk/src/logger");
var _MatrixClientPeg = require("../MatrixClientPeg");
var _WellKnownUtils = require("../utils/WellKnownUtils");
var _WidgetUtils = _interopRequireDefault(require("../utils/WidgetUtils"));
var _WidgetLayoutStore = require("../stores/widgets/WidgetLayoutStore");
var _WidgetEchoStore = _interopRequireDefault(require("../stores/WidgetEchoStore"));
var _WidgetStore = _interopRequireDefault(require("../stores/WidgetStore"));
var _SdkConfig = _interopRequireDefault(require("../SdkConfig"));
var _DMRoomMap = _interopRequireDefault(require("../utils/DMRoomMap"));
/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

/* eslint-disable camelcase */

/* eslint-enable camelcase */

function getWidgetBuildUrl(roomId) {
  const isDm = !!_DMRoomMap.default.shared().getUserIdForRoomId(roomId);
  if (_SdkConfig.default.get().widget_build_url) {
    if (isDm && _SdkConfig.default.get().widget_build_url_ignore_dm) {
      return undefined;
    }
    return _SdkConfig.default.get().widget_build_url;
  }
  const wellKnown = (0, _WellKnownUtils.getCallBehaviourWellKnown)(_MatrixClientPeg.MatrixClientPeg.get());
  if (isDm && wellKnown?.ignore_dm) {
    return undefined;
  }
  /* eslint-disable-next-line camelcase */
  return wellKnown?.widget_build_url;
}
function isManagedHybridWidgetEnabled(roomId) {
  return !!getWidgetBuildUrl(roomId);
}
async function addManagedHybridWidget(roomId) {
  const cli = _MatrixClientPeg.MatrixClientPeg.get();
  const room = cli.getRoom(roomId);
  if (!room) {
    return;
  }

  // Check for permission
  if (!_WidgetUtils.default.canUserModifyWidgets(cli, roomId)) {
    _logger.logger.error(`User not allowed to modify widgets in ${roomId}`);
    return;
  }

  // Get widget data
  /* eslint-disable-next-line camelcase */
  const widgetBuildUrl = getWidgetBuildUrl(roomId);
  if (!widgetBuildUrl) {
    return;
  }
  let widgetData;
  try {
    const response = await fetch(`${widgetBuildUrl}?roomId=${roomId}`);
    widgetData = await response.json();
  } catch (e) {
    _logger.logger.error(`Managed hybrid widget builder failed for room ${roomId}`, e);
    return;
  }
  if (!widgetData) {
    return;
  }
  const {
    widget_id: widgetId,
    widget: widgetContent,
    layout
  } = widgetData;

  // Ensure the widget is not already present in the room
  let widgets = _WidgetStore.default.instance.getApps(roomId);
  const existing = widgets.some(w => w.id === widgetId) || _WidgetEchoStore.default.roomHasPendingWidgets(roomId, []);
  if (existing) {
    _logger.logger.error(`Managed hybrid widget already present in room ${roomId}`);
    return;
  }

  // Add the widget
  try {
    await _WidgetUtils.default.setRoomWidgetContent(cli, roomId, widgetId, widgetContent);
  } catch (e) {
    _logger.logger.error(`Unable to add managed hybrid widget in room ${roomId}`, e);
    return;
  }

  // Move the widget into position
  if (!_WidgetLayoutStore.WidgetLayoutStore.instance.canCopyLayoutToRoom(room)) {
    return;
  }
  widgets = _WidgetStore.default.instance.getApps(roomId);
  const installedWidget = widgets.find(w => w.id === widgetId);
  if (!installedWidget) {
    return;
  }
  _WidgetLayoutStore.WidgetLayoutStore.instance.moveToContainer(room, installedWidget, layout.container);
  _WidgetLayoutStore.WidgetLayoutStore.instance.setContainerHeight(room, layout.container, layout.height);
  _WidgetLayoutStore.WidgetLayoutStore.instance.copyLayoutToRoom(room);
}
//# sourceMappingURL=ManagedHybrid.js.map