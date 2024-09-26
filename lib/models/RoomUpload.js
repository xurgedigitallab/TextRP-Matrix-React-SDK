"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RoomUpload = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
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

class RoomUpload {
  constructor(roomId, fileName, relation) {
    let fileSize = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
    this.roomId = roomId;
    this.fileName = fileName;
    this.relation = relation;
    this.fileSize = fileSize;
    (0, _defineProperty2.default)(this, "abortController", new AbortController());
    (0, _defineProperty2.default)(this, "promise", void 0);
    (0, _defineProperty2.default)(this, "uploaded", 0);
  }
  onProgress(progress) {
    this.uploaded = progress.loaded;
    this.fileSize = progress.total;
  }
  abort() {
    this.abortController.abort();
  }
  get cancelled() {
    return this.abortController.signal.aborted;
  }
  get total() {
    return this.fileSize;
  }
  get loaded() {
    return this.uploaded;
  }
}
exports.RoomUpload = RoomUpload;
//# sourceMappingURL=RoomUpload.js.map