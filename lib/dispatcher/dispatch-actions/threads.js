"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.showThreadPanel = void 0;
var _RightPanelStore = _interopRequireDefault(require("../../stores/right-panel/RightPanelStore"));
var _RightPanelStorePhases = require("../../stores/right-panel/RightPanelStorePhases");
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

const showThreadPanel = () => {
  _RightPanelStore.default.instance.setCard({
    phase: _RightPanelStorePhases.RightPanelPhases.ThreadPanel
  });
};
exports.showThreadPanel = showThreadPanel;
//# sourceMappingURL=threads.js.map