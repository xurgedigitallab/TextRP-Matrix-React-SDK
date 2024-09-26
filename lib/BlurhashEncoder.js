"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.BlurhashEncoder = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _blurhashWorker = _interopRequireDefault(require("./workers/blurhash.worker.ts"));
var _WorkerManager = require("./WorkerManager");
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

// @ts-ignore - `.ts` is needed here to make TS happy

class BlurhashEncoder {
  constructor() {
    (0, _defineProperty2.default)(this, "worker", new _WorkerManager.WorkerManager(_blurhashWorker.default));
  }
  static get instance() {
    return BlurhashEncoder.internalInstance;
  }
  getBlurhash(imageData) {
    return this.worker.call({
      imageData
    }).then(resp => resp.blurhash);
  }
}
exports.BlurhashEncoder = BlurhashEncoder;
(0, _defineProperty2.default)(BlurhashEncoder, "internalInstance", new BlurhashEncoder());
//# sourceMappingURL=BlurhashEncoder.js.map