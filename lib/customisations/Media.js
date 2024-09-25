"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Media = void 0;
exports.mediaFromContent = mediaFromContent;
exports.mediaFromMxc = mediaFromMxc;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _MatrixClientPeg = require("../MatrixClientPeg");
var _IMediaEventContent = require("./models/IMediaEventContent");
var _languageHandler = require("../languageHandler");
/*
 * Copyright 2021 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Populate this class with the details of your customisations when copying it.

// Implementation note: The Media class must complete the contract as shown here, though
// the constructor can be whatever is relevant to your implementation. The mediaForX
// functions below create an instance of the Media class and are used throughout the
// project.

/**
 * A media object is a representation of a "source media" and an optional
 * "thumbnail media", derived from event contents or external sources.
 */
class Media {
  // Per above, this constructor signature can be whatever is helpful for you.
  constructor(prepared, client) {
    this.prepared = prepared;
    (0, _defineProperty2.default)(this, "client", void 0);
    this.client = client ?? _MatrixClientPeg.MatrixClientPeg.get();
    if (!this.client) {
      throw new Error("No possible MatrixClient for media resolution. Please provide one or log in.");
    }
  }

  /**
   * True if the media appears to be encrypted. Actual file contents may vary.
   */
  get isEncrypted() {
    return !!this.prepared.file;
  }

  /**
   * The MXC URI of the source media.
   */
  get srcMxc() {
    return this.prepared.mxc;
  }

  /**
   * The MXC URI of the thumbnail media, if a thumbnail is recorded. Null/undefined
   * otherwise.
   */
  get thumbnailMxc() {
    return this.prepared.thumbnail?.mxc;
  }

  /**
   * Whether or not a thumbnail is recorded for this media.
   */
  get hasThumbnail() {
    return !!this.thumbnailMxc;
  }

  /**
   * The HTTP URL for the source media.
   */
  get srcHttp() {
    // eslint-disable-next-line no-restricted-properties
    return this.client.mxcUrlToHttp(this.srcMxc) || null;
  }

  /**
   * The HTTP URL for the thumbnail media (without any specified width, height, etc). Null/undefined
   * if no thumbnail media recorded.
   */
  get thumbnailHttp() {
    if (!this.hasThumbnail) return null;
    // eslint-disable-next-line no-restricted-properties
    return this.client.mxcUrlToHttp(this.thumbnailMxc);
  }

  /**
   * Gets the HTTP URL for the thumbnail media with the requested characteristics, if a thumbnail
   * is recorded for this media. Returns null/undefined otherwise.
   * @param {number} width The desired width of the thumbnail.
   * @param {number} height The desired height of the thumbnail.
   * @param {"scale"|"crop"} mode The desired thumbnailing mode. Defaults to scale.
   * @returns {string} The HTTP URL which points to the thumbnail.
   */
  getThumbnailHttp(width, height) {
    let mode = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "scale";
    if (!this.hasThumbnail) return null;
    // scale using the device pixel ratio to keep images clear
    width = Math.floor(width * window.devicePixelRatio);
    height = Math.floor(height * window.devicePixelRatio);
    // eslint-disable-next-line no-restricted-properties
    return this.client.mxcUrlToHttp(this.thumbnailMxc, width, height, mode);
  }

  /**
   * Gets the HTTP URL for a thumbnail of the source media with the requested characteristics.
   * @param {number} width The desired width of the thumbnail.
   * @param {number} height The desired height of the thumbnail.
   * @param {"scale"|"crop"} mode The desired thumbnailing mode. Defaults to scale.
   * @returns {string} The HTTP URL which points to the thumbnail.
   */
  getThumbnailOfSourceHttp(width, height) {
    let mode = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "scale";
    // scale using the device pixel ratio to keep images clear
    width = Math.floor(width * window.devicePixelRatio);
    height = Math.floor(height * window.devicePixelRatio);
    // eslint-disable-next-line no-restricted-properties
    return this.client.mxcUrlToHttp(this.srcMxc, width, height, mode);
  }

  /**
   * Creates a square thumbnail of the media. If the media has a thumbnail recorded, that MXC will
   * be used, otherwise the source media will be used.
   * @param {number} dim The desired width and height.
   * @returns {string} An HTTP URL for the thumbnail.
   */
  getSquareThumbnailHttp(dim) {
    dim = Math.floor(dim * window.devicePixelRatio); // scale using the device pixel ratio to keep images clear
    if (this.hasThumbnail) {
      return this.getThumbnailHttp(dim, dim, "crop");
    }
    return this.getThumbnailOfSourceHttp(dim, dim, "crop");
  }

  /**
   * Downloads the source media.
   * @returns {Promise<Response>} Resolves to the server's response for chaining.
   */
  downloadSource() {
    const src = this.srcHttp;
    if (!src) {
      throw new _languageHandler.UserFriendlyError("Failed to download source media, no source url was found");
    }
    return fetch(src);
  }
}

/**
 * Creates a media object from event content.
 * @param {IMediaEventContent} content The event content.
 * @param {MatrixClient} client? Optional client to use.
 * @returns {Media} The media object.
 */
exports.Media = Media;
function mediaFromContent(content, client) {
  return new Media((0, _IMediaEventContent.prepEventContentAsMedia)(content), client);
}

/**
 * Creates a media object from an MXC URI.
 * @param {string} mxc The MXC URI.
 * @param {MatrixClient} client? Optional client to use.
 * @returns {Media} The media object.
 */
function mediaFromMxc(mxc, client) {
  return mediaFromContent({
    url: mxc
  }, client);
}
//# sourceMappingURL=Media.js.map