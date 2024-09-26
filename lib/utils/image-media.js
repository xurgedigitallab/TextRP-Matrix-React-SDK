"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.BLURHASH_FIELD = void 0;
exports.createThumbnail = createThumbnail;
var _BlurhashEncoder = require("../BlurhashEncoder");
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

const BLURHASH_FIELD = "xyz.amorgan.blurhash"; // MSC2448
exports.BLURHASH_FIELD = BLURHASH_FIELD;
const MAX_WIDTH = 800;
const MAX_HEIGHT = 600;

/**
 * Create a thumbnail for a image DOM element.
 * The image will be smaller than MAX_WIDTH and MAX_HEIGHT.
 * The thumbnail will have the same aspect ratio as the original.
 * Draws the element into a canvas using CanvasRenderingContext2D.drawImage
 * Then calls Canvas.toBlob to get a blob object for the image data.
 *
 * Since it needs to calculate the dimensions of the source image and the
 * thumbnailed image it returns an info object filled out with information
 * about the original image and the thumbnail.
 *
 * @param {HTMLElement} element The element to thumbnail.
 * @param {number} inputWidth The width of the image in the input element.
 * @param {number} inputHeight the width of the image in the input element.
 * @param {string} mimeType The mimeType to save the blob as.
 * @param {boolean} calculateBlurhash Whether to calculate a blurhash of the given image too.
 * @return {Promise} A promise that resolves with an object with an info key
 *  and a thumbnail key.
 */
async function createThumbnail(element, inputWidth, inputHeight, mimeType) {
  let calculateBlurhash = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : true;
  let targetWidth = inputWidth;
  let targetHeight = inputHeight;
  if (targetHeight > MAX_HEIGHT) {
    targetWidth = Math.floor(targetWidth * (MAX_HEIGHT / targetHeight));
    targetHeight = MAX_HEIGHT;
  }
  if (targetWidth > MAX_WIDTH) {
    targetHeight = Math.floor(targetHeight * (MAX_WIDTH / targetWidth));
    targetWidth = MAX_WIDTH;
  }
  let canvas;
  let context;
  try {
    canvas = new window.OffscreenCanvas(targetWidth, targetHeight);
    context = canvas.getContext("2d");
  } catch (e) {
    // Fallback support for other browsers (Safari and Firefox for now)
    canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    context = canvas.getContext("2d");
  }
  context.drawImage(element, 0, 0, targetWidth, targetHeight);
  let thumbnailPromise;
  if (window.OffscreenCanvas && canvas instanceof OffscreenCanvas) {
    thumbnailPromise = canvas.convertToBlob({
      type: mimeType
    });
  } else {
    thumbnailPromise = new Promise(resolve => canvas.toBlob(resolve, mimeType));
  }
  const imageData = context.getImageData(0, 0, targetWidth, targetHeight);
  // thumbnailPromise and blurhash promise are being awaited concurrently
  const blurhash = calculateBlurhash ? await _BlurhashEncoder.BlurhashEncoder.instance.getBlurhash(imageData) : undefined;
  const thumbnail = await thumbnailPromise;
  return {
    info: {
      thumbnail_info: {
        w: targetWidth,
        h: targetHeight,
        mimetype: thumbnail.type,
        size: thumbnail.size
      },
      w: inputWidth,
      h: inputHeight,
      [BLURHASH_FIELD]: blurhash
    },
    thumbnail
  };
}
//# sourceMappingURL=image-media.js.map