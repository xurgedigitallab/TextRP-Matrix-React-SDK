"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.EchoChamber = void 0;
var _EchoStore = require("./EchoStore");
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

/**
 * Semantic access to local echo
 */
class EchoChamber {
  constructor() {}
  static forRoom(room) {
    return _EchoStore.EchoStore.instance.getOrCreateChamberForRoom(room);
  }
}
exports.EchoChamber = EchoChamber;
//# sourceMappingURL=EchoChamber.js.map