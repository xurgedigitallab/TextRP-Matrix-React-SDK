"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.MediaEventHelper = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _event = require("matrix-js-sdk/src/@types/event");
var _logger = require("matrix-js-sdk/src/logger");
var _LazyValue = require("./LazyValue");
var _Media = require("../customisations/Media");
var _DecryptFile = require("./DecryptFile");
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

// TODO: We should consider caching the blobs. https://github.com/vector-im/element-web/issues/17192

class MediaEventHelper {
  constructor(event) {
    this.event = event;
    // Either an HTTP or Object URL (when encrypted) to the media.
    (0, _defineProperty2.default)(this, "sourceUrl", void 0);
    (0, _defineProperty2.default)(this, "thumbnailUrl", void 0);
    // Either the raw or decrypted (when encrypted) contents of the file.
    (0, _defineProperty2.default)(this, "sourceBlob", void 0);
    (0, _defineProperty2.default)(this, "thumbnailBlob", void 0);
    (0, _defineProperty2.default)(this, "media", void 0);
    (0, _defineProperty2.default)(this, "prepareSourceUrl", async () => {
      if (this.media.isEncrypted) {
        const blob = await this.sourceBlob.value;
        return URL.createObjectURL(blob);
      } else {
        return this.media.srcHttp;
      }
    });
    (0, _defineProperty2.default)(this, "prepareThumbnailUrl", async () => {
      if (this.media.isEncrypted) {
        const blob = await this.thumbnailBlob.value;
        if (blob === null) return null;
        return URL.createObjectURL(blob);
      } else {
        return this.media.thumbnailHttp;
      }
    });
    (0, _defineProperty2.default)(this, "fetchSource", () => {
      if (this.media.isEncrypted) {
        const content = this.event.getContent();
        return (0, _DecryptFile.decryptFile)(content.file, content.info);
      }
      return this.media.downloadSource().then(r => r.blob());
    });
    (0, _defineProperty2.default)(this, "fetchThumbnail", () => {
      if (!this.media.hasThumbnail) return Promise.resolve(null);
      if (this.media.isEncrypted) {
        const content = this.event.getContent();
        if (content.info?.thumbnail_file) {
          return (0, _DecryptFile.decryptFile)(content.info.thumbnail_file, content.info.thumbnail_info);
        } else {
          // "Should never happen"
          _logger.logger.warn("Media claims to have thumbnail and is encrypted, but no thumbnail_file found");
          return Promise.resolve(null);
        }
      }
      const thumbnailHttp = this.media.thumbnailHttp;
      if (!thumbnailHttp) return Promise.resolve(null);
      return fetch(thumbnailHttp).then(r => r.blob());
    });
    this.sourceUrl = new _LazyValue.LazyValue(this.prepareSourceUrl);
    this.thumbnailUrl = new _LazyValue.LazyValue(this.prepareThumbnailUrl);
    this.sourceBlob = new _LazyValue.LazyValue(this.fetchSource);
    this.thumbnailBlob = new _LazyValue.LazyValue(this.fetchThumbnail);
    this.media = (0, _Media.mediaFromContent)(this.event.getContent());
  }
  get fileName() {
    return this.event.getContent().filename || this.event.getContent().body || "download";
  }
  destroy() {
    if (this.media.isEncrypted) {
      if (this.sourceUrl.cachedValue) URL.revokeObjectURL(this.sourceUrl.cachedValue);
      if (this.thumbnailUrl.cachedValue) URL.revokeObjectURL(this.thumbnailUrl.cachedValue);
    }
  }
  static isEligible(event) {
    if (!event) return false;
    if (event.isRedacted()) return false;
    if (event.getType() === _event.EventType.Sticker) return true;
    if (event.getType() !== _event.EventType.RoomMessage) return false;
    const content = event.getContent();
    const mediaMsgTypes = [_event.MsgType.Video, _event.MsgType.Audio, _event.MsgType.Image, _event.MsgType.File];
    if (mediaMsgTypes.includes(content.msgtype)) return true;
    if (typeof content.url === "string") return true;

    // Finally, it's probably not media
    return false;
  }
}
exports.MediaEventHelper = MediaEventHelper;
//# sourceMappingURL=MediaEventHelper.js.map