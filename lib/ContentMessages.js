"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.UploadCanceledError = void 0;
exports.uploadFile = uploadFile;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _event = require("matrix-js-sdk/src/@types/event");
var _matrixEncryptAttachment = _interopRequireDefault(require("matrix-encrypt-attachment"));
var _pngChunksExtract = _interopRequireDefault(require("png-chunks-extract"));
var _logger = require("matrix-js-sdk/src/logger");
var _matrix = require("matrix-js-sdk/src/matrix");
var _thread = require("matrix-js-sdk/src/models/thread");
var _utils = require("matrix-js-sdk/src/utils");
var _dispatcher = _interopRequireDefault(require("./dispatcher/dispatcher"));
var _languageHandler = require("./languageHandler");
var _Modal = _interopRequireDefault(require("./Modal"));
var _Spinner = _interopRequireDefault(require("./components/views/elements/Spinner"));
var _actions = require("./dispatcher/actions");
var _RoomUpload = require("./models/RoomUpload");
var _SettingsStore = _interopRequireDefault(require("./settings/SettingsStore"));
var _sendTimePerformanceMetrics = require("./sendTimePerformanceMetrics");
var _RoomContext = require("./contexts/RoomContext");
var _Reply = require("./utils/Reply");
var _ErrorDialog = _interopRequireDefault(require("./components/views/dialogs/ErrorDialog"));
var _UploadFailureDialog = _interopRequireDefault(require("./components/views/dialogs/UploadFailureDialog"));
var _UploadConfirmDialog = _interopRequireDefault(require("./components/views/dialogs/UploadConfirmDialog"));
var _imageMedia = require("./utils/image-media");
var _SendMessageComposer = require("./components/views/rooms/SendMessageComposer");
var _localRoom = require("./utils/local-room");
var _SDKContext = require("./contexts/SDKContext");
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         Copyright 2015, 2016 OpenMarket Ltd
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         Copyright 2019 New Vector Ltd
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
// scraped out of a macOS hidpi (5660ppm) screenshot png
//                  5669 px (x-axis)      , 5669 px (y-axis)      , per metre
const PHYS_HIDPI = [0x00, 0x00, 0x16, 0x25, 0x00, 0x00, 0x16, 0x25, 0x01];
class UploadCanceledError extends Error {}
exports.UploadCanceledError = UploadCanceledError;
/**
 * Load a file into a newly created image element.
 *
 * @param {File} imageFile The file to load in an image element.
 * @return {Promise} A promise that resolves with the html image element.
 */
async function loadImageElement(imageFile) {
  // Load the file into an html element
  const img = new Image();
  const objectUrl = URL.createObjectURL(imageFile);
  const imgPromise = new Promise((resolve, reject) => {
    img.onload = function () {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = function (e) {
      reject(e);
    };
  });
  img.src = objectUrl;

  // check for hi-dpi PNGs and fudge display resolution as needed.
  // this is mainly needed for macOS screencaps
  let parsePromise = Promise.resolve(false);
  if (imageFile.type === "image/png") {
    // in practice macOS happens to order the chunks so they fall in
    // the first 0x1000 bytes (thanks to a massive ICC header).
    // Thus we could slice the file down to only sniff the first 0x1000
    // bytes (but this makes extractPngChunks choke on the corrupt file)
    const headers = imageFile; //.slice(0, 0x1000);
    parsePromise = readFileAsArrayBuffer(headers).then(arrayBuffer => {
      const buffer = new Uint8Array(arrayBuffer);
      const chunks = (0, _pngChunksExtract.default)(buffer);
      for (const chunk of chunks) {
        if (chunk.name === "pHYs") {
          if (chunk.data.byteLength !== PHYS_HIDPI.length) return false;
          return chunk.data.every((val, i) => val === PHYS_HIDPI[i]);
        }
      }
      return false;
    }).catch(e => {
      console.error("Failed to parse PNG", e);
      return false;
    });
  }
  const [hidpi] = await Promise.all([parsePromise, imgPromise]);
  const width = hidpi ? img.width >> 1 : img.width;
  const height = hidpi ? img.height >> 1 : img.height;
  return {
    width,
    height,
    img
  };
}

// Minimum size for image files before we generate a thumbnail for them.
const IMAGE_SIZE_THRESHOLD_THUMBNAIL = 1 << 15; // 32KB
// Minimum size improvement for image thumbnails, if both are not met then don't bother uploading thumbnail.
const IMAGE_THUMBNAIL_MIN_REDUCTION_SIZE = 1 << 16; // 1MB
const IMAGE_THUMBNAIL_MIN_REDUCTION_PERCENT = 0.1; // 10%
// We don't apply these thresholds to video thumbnails as a poster image is always useful
// and videos tend to be much larger.

// Image mime types for which to always include a thumbnail for even if it is larger than the input for wider support.
const ALWAYS_INCLUDE_THUMBNAIL = ["image/avif", "image/webp"];

/**
 * Read the metadata for an image file and create and upload a thumbnail of the image.
 *
 * @param {MatrixClient} matrixClient A matrixClient to upload the thumbnail with.
 * @param {String} roomId The ID of the room the image will be uploaded in.
 * @param {File} imageFile The image to read and thumbnail.
 * @return {Promise} A promise that resolves with the attachment info.
 */
async function infoForImageFile(matrixClient, roomId, imageFile) {
  let thumbnailType = "image/png";
  if (imageFile.type === "image/jpeg") {
    thumbnailType = "image/jpeg";
  }
  const imageElement = await loadImageElement(imageFile);
  const result = await (0, _imageMedia.createThumbnail)(imageElement.img, imageElement.width, imageElement.height, thumbnailType);
  const imageInfo = result.info;

  // For lesser supported image types, always include the thumbnail even if it is larger
  if (!ALWAYS_INCLUDE_THUMBNAIL.includes(imageFile.type)) {
    // we do all sizing checks here because we still rely on thumbnail generation for making a blurhash from.
    const sizeDifference = imageFile.size - imageInfo.thumbnail_info.size;
    if (
    // image is small enough already
    imageFile.size <= IMAGE_SIZE_THRESHOLD_THUMBNAIL ||
    // thumbnail is not sufficiently smaller than original
    sizeDifference <= IMAGE_THUMBNAIL_MIN_REDUCTION_SIZE && sizeDifference <= imageFile.size * IMAGE_THUMBNAIL_MIN_REDUCTION_PERCENT) {
      delete imageInfo["thumbnail_info"];
      return imageInfo;
    }
  }
  const uploadResult = await uploadFile(matrixClient, roomId, result.thumbnail);
  imageInfo["thumbnail_url"] = uploadResult.url;
  imageInfo["thumbnail_file"] = uploadResult.file;
  return imageInfo;
}

/**
 * Load a file into a newly created video element and pull some strings
 * in an attempt to guarantee the first frame will be showing.
 *
 * @param {File} videoFile The file to load in an video element.
 * @return {Promise} A promise that resolves with the video image element.
 */
function loadVideoElement(videoFile) {
  return new Promise((resolve, reject) => {
    // Load the file into an html element
    const video = document.createElement("video");
    video.preload = "metadata";
    video.playsInline = true;
    video.muted = true;
    const reader = new FileReader();
    reader.onload = function (ev) {
      // Wait until we have enough data to thumbnail the first frame.
      video.onloadeddata = async function () {
        resolve(video);
        video.pause();
      };
      video.onerror = function (e) {
        reject(e);
      };
      let dataUrl = ev.target?.result;
      // Chrome chokes on quicktime but likes mp4, and `file.type` is
      // read only, so do this horrible hack to unbreak quicktime
      if (dataUrl?.startsWith("data:video/quicktime;")) {
        dataUrl = dataUrl.replace("data:video/quicktime;", "data:video/mp4;");
      }
      video.src = dataUrl;
      video.load();
      video.play();
    };
    reader.onerror = function (e) {
      reject(e);
    };
    reader.readAsDataURL(videoFile);
  });
}

/**
 * Read the metadata for a video file and create and upload a thumbnail of the video.
 *
 * @param {MatrixClient} matrixClient A matrixClient to upload the thumbnail with.
 * @param {String} roomId The ID of the room the video will be uploaded to.
 * @param {File} videoFile The video to read and thumbnail.
 * @return {Promise} A promise that resolves with the attachment info.
 */
function infoForVideoFile(matrixClient, roomId, videoFile) {
  const thumbnailType = "image/jpeg";
  let videoInfo;
  return loadVideoElement(videoFile).then(video => {
    return (0, _imageMedia.createThumbnail)(video, video.videoWidth, video.videoHeight, thumbnailType);
  }).then(result => {
    videoInfo = result.info;
    return uploadFile(matrixClient, roomId, result.thumbnail);
  }).then(result => {
    videoInfo.thumbnail_url = result.url;
    videoInfo.thumbnail_file = result.file;
    return videoInfo;
  });
}

/**
 * Read the file as an ArrayBuffer.
 * @param {File} file The file to read
 * @return {Promise} A promise that resolves with an ArrayBuffer when the file
 *   is read.
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      resolve(e.target?.result);
    };
    reader.onerror = function (e) {
      reject(e);
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Upload the file to the content repository.
 * If the room is encrypted then encrypt the file before uploading.
 *
 * @param {MatrixClient} matrixClient The matrix client to upload the file with.
 * @param {String} roomId The ID of the room being uploaded to.
 * @param {File} file The file to upload.
 * @param {Function?} progressHandler optional callback to be called when a chunk of
 *    data is uploaded.
 * @param {AbortController?} controller optional abortController to use for this upload.
 * @return {Promise} A promise that resolves with an object.
 *  If the file is unencrypted then the object will have a "url" key.
 *  If the file is encrypted then the object will have a "file" key.
 */
async function uploadFile(matrixClient, roomId, file, progressHandler, controller) {
  const abortController = controller ?? new AbortController();

  // If the room is encrypted then encrypt the file before uploading it.
  if (matrixClient.isRoomEncrypted(roomId)) {
    // First read the file into memory.
    const data = await readFileAsArrayBuffer(file);
    if (abortController.signal.aborted) throw new UploadCanceledError();

    // Then encrypt the file.
    const encryptResult = await _matrixEncryptAttachment.default.encryptAttachment(data);
    if (abortController.signal.aborted) throw new UploadCanceledError();

    // Pass the encrypted data as a Blob to the uploader.
    const blob = new Blob([encryptResult.data]);
    const {
      content_uri: url
    } = await matrixClient.uploadContent(blob, {
      progressHandler,
      abortController,
      includeFilename: false,
      type: "application/octet-stream"
    });
    if (abortController.signal.aborted) throw new UploadCanceledError();

    // If the attachment is encrypted then bundle the URL along with the information
    // needed to decrypt the attachment and add it under a file key.
    return {
      file: _objectSpread(_objectSpread({}, encryptResult.info), {}, {
        url
      })
    };
  } else {
    const {
      content_uri: url
    } = await matrixClient.uploadContent(file, {
      progressHandler,
      abortController
    });
    if (abortController.signal.aborted) throw new UploadCanceledError();
    // If the attachment isn't encrypted then include the URL directly.
    return {
      url
    };
  }
}
class ContentMessages {
  constructor() {
    (0, _defineProperty2.default)(this, "inprogress", []);
    (0, _defineProperty2.default)(this, "mediaConfig", null);
  }
  sendStickerContentToRoom(url, roomId, threadId, info, text, matrixClient) {
    return (0, _localRoom.doMaybeLocalRoomAction)(roomId, actualRoomId => matrixClient.sendStickerMessage(actualRoomId, threadId, url, info, text), matrixClient).catch(e => {
      _logger.logger.warn(`Failed to send content with URL ${url} to room ${roomId}`, e);
      throw e;
    });
  }
  getUploadLimit() {
    if (this.mediaConfig !== null && this.mediaConfig["m.upload.size"] !== undefined) {
      return this.mediaConfig["m.upload.size"];
    } else {
      return null;
    }
  }
  async sendContentListToRoom(files, roomId, relation, matrixClient) {
    let context = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : _RoomContext.TimelineRenderingType.Room;
    if (matrixClient.isGuest()) {
      _dispatcher.default.dispatch({
        action: "require_registration"
      });
      return;
    }
    const replyToEvent = _SDKContext.SdkContextClass.instance.roomViewStore.getQuotingEvent();
    if (!this.mediaConfig) {
      // hot-path optimization to not flash a spinner if we don't need to
      const modal = _Modal.default.createDialog(_Spinner.default, undefined, "mx_Dialog_spinner");
      await Promise.race([this.ensureMediaConfigFetched(matrixClient), modal.finished]);
      if (!this.mediaConfig) {
        // User cancelled by clicking away on the spinner
        return;
      } else {
        modal.close();
      }
    }
    const tooBigFiles = [];
    const okFiles = [];
    for (const file of files) {
      if (this.isFileSizeAcceptable(file)) {
        okFiles.push(file);
      } else {
        tooBigFiles.push(file);
      }
    }
    if (tooBigFiles.length > 0) {
      const {
        finished
      } = _Modal.default.createDialog(_UploadFailureDialog.default, {
        badFiles: tooBigFiles,
        totalFiles: files.length,
        contentMessages: this
      });
      const [shouldContinue] = await finished;
      if (!shouldContinue) return;
    }
    let uploadAll = false;
    // Promise to complete before sending next file into room, used for synchronisation of file-sending
    // to match the order the files were specified in
    let promBefore = Promise.resolve();
    for (let i = 0; i < okFiles.length; ++i) {
      const file = okFiles[i];
      const loopPromiseBefore = promBefore;
      if (!uploadAll) {
        const {
          finished
        } = _Modal.default.createDialog(_UploadConfirmDialog.default, {
          file,
          currentIndex: i,
          totalFiles: okFiles.length
        });
        const [shouldContinue, shouldUploadAll] = await finished;
        if (!shouldContinue) break;
        if (shouldUploadAll) {
          uploadAll = true;
        }
      }
      promBefore = (0, _localRoom.doMaybeLocalRoomAction)(roomId, actualRoomId => this.sendContentToRoom(file, actualRoomId, relation, matrixClient, replyToEvent ?? undefined, loopPromiseBefore), matrixClient);
    }
    if (replyToEvent) {
      // Clear event being replied to
      _dispatcher.default.dispatch({
        action: "reply_to_event",
        event: null,
        context
      });
    }

    // Focus the correct composer
    _dispatcher.default.dispatch({
      action: _actions.Action.FocusSendMessageComposer,
      context
    });
  }
  getCurrentUploads(relation) {
    return this.inprogress.filter(roomUpload => {
      const noRelation = !relation && !roomUpload.relation;
      const matchingRelation = relation && roomUpload.relation && relation.rel_type === roomUpload.relation.rel_type && relation.event_id === roomUpload.relation.event_id;
      return (noRelation || matchingRelation) && !roomUpload.cancelled;
    });
  }
  cancelUpload(upload) {
    upload.abort();
    _dispatcher.default.dispatch({
      action: _actions.Action.UploadCanceled,
      upload
    });
  }
  async sendContentToRoom(file, roomId, relation, matrixClient, replyToEvent, promBefore) {
    const fileName = file.name || (0, _languageHandler._t)("Attachment");
    const content = {
      body: fileName,
      info: {
        size: file.size
      },
      msgtype: _event.MsgType.File // set more specifically later
    };

    // Attach mentions, which really only applies if there's a replyToEvent.
    (0, _SendMessageComposer.attachMentions)(matrixClient.getSafeUserId(), content, null, replyToEvent);
    (0, _SendMessageComposer.attachRelation)(content, relation);
    if (replyToEvent) {
      (0, _Reply.addReplyToMessageContent)(content, replyToEvent, {
        includeLegacyFallback: false
      });
    }
    if (_SettingsStore.default.getValue("Performance.addSendMessageTimingMetadata")) {
      (0, _sendTimePerformanceMetrics.decorateStartSendingTime)(content);
    }

    // if we have a mime type for the file, add it to the message metadata
    if (file.type) {
      content.info.mimetype = file.type;
    }
    const upload = new _RoomUpload.RoomUpload(roomId, fileName, relation, file.size);
    this.inprogress.push(upload);
    _dispatcher.default.dispatch({
      action: _actions.Action.UploadStarted,
      upload
    });
    function onProgress(progress) {
      upload.onProgress(progress);
      _dispatcher.default.dispatch({
        action: _actions.Action.UploadProgress,
        upload
      });
    }
    try {
      if (file.type.startsWith("image/")) {
        content.msgtype = _event.MsgType.Image;
        try {
          const imageInfo = await infoForImageFile(matrixClient, roomId, file);
          Object.assign(content.info, imageInfo);
        } catch (e) {
          if (e instanceof _matrix.HTTPError) {
            // re-throw to main upload error handler
            throw e;
          }
          // Otherwise we failed to thumbnail, fall back to uploading an m.file
          _logger.logger.error(e);
          content.msgtype = _event.MsgType.File;
        }
      } else if (file.type.indexOf("audio/") === 0) {
        content.msgtype = _event.MsgType.Audio;
      } else if (file.type.indexOf("video/") === 0) {
        content.msgtype = _event.MsgType.Video;
        try {
          const videoInfo = await infoForVideoFile(matrixClient, roomId, file);
          Object.assign(content.info, videoInfo);
        } catch (e) {
          // Failed to thumbnail, fall back to uploading an m.file
          _logger.logger.error(e);
          content.msgtype = _event.MsgType.File;
        }
      } else {
        content.msgtype = _event.MsgType.File;
      }
      if (upload.cancelled) throw new UploadCanceledError();
      const result = await uploadFile(matrixClient, roomId, file, onProgress, upload.abortController);
      content.file = result.file;
      content.url = result.url;
      if (upload.cancelled) throw new UploadCanceledError();
      // Await previous message being sent into the room
      if (promBefore) await promBefore;
      if (upload.cancelled) throw new UploadCanceledError();
      const threadId = relation?.rel_type === _thread.THREAD_RELATION_TYPE.name ? relation.event_id : null;
      const response = await matrixClient.sendMessage(roomId, threadId ?? null, content);
      if (_SettingsStore.default.getValue("Performance.addSendMessageTimingMetadata")) {
        (0, _sendTimePerformanceMetrics.sendRoundTripMetric)(matrixClient, roomId, response.event_id);
      }
      _dispatcher.default.dispatch({
        action: _actions.Action.UploadFinished,
        upload
      });
      _dispatcher.default.dispatch({
        action: "message_sent"
      });
    } catch (error) {
      // 413: File was too big or upset the server in some way:
      // clear the media size limit so we fetch it again next time we try to upload
      if (error instanceof _matrix.HTTPError && error.httpStatus === 413) {
        this.mediaConfig = null;
      }
      if (!upload.cancelled) {
        let desc = (0, _languageHandler._t)("The file '%(fileName)s' failed to upload.", {
          fileName: upload.fileName
        });
        if (error instanceof _matrix.HTTPError && error.httpStatus === 413) {
          desc = (0, _languageHandler._t)("The file '%(fileName)s' exceeds this homeserver's size limit for uploads", {
            fileName: upload.fileName
          });
        }
        _Modal.default.createDialog(_ErrorDialog.default, {
          title: (0, _languageHandler._t)("Upload Failed"),
          description: desc
        });
        _dispatcher.default.dispatch({
          action: _actions.Action.UploadFailed,
          upload,
          error
        });
      }
    } finally {
      (0, _utils.removeElement)(this.inprogress, e => e.promise === upload.promise);
    }
  }
  isFileSizeAcceptable(file) {
    if (this.mediaConfig !== null && this.mediaConfig["m.upload.size"] !== undefined && file.size > this.mediaConfig["m.upload.size"]) {
      return false;
    }
    return true;
  }
  ensureMediaConfigFetched(matrixClient) {
    if (this.mediaConfig !== null) return Promise.resolve();
    _logger.logger.log("[Media Config] Fetching");
    return matrixClient.getMediaConfig().then(config => {
      _logger.logger.log("[Media Config] Fetched config:", config);
      return config;
    }).catch(() => {
      // Media repo can't or won't report limits, so provide an empty object (no limits).
      _logger.logger.log("[Media Config] Could not fetch config, so not limiting uploads.");
      return {};
    }).then(config => {
      this.mediaConfig = config;
    });
  }
  static sharedInstance() {
    if (window.mxContentMessages === undefined) {
      window.mxContentMessages = new ContentMessages();
    }
    return window.mxContentMessages;
  }
}
exports.default = ContentMessages;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfZXZlbnQiLCJyZXF1aXJlIiwiX21hdHJpeEVuY3J5cHRBdHRhY2htZW50IiwiX2ludGVyb3BSZXF1aXJlRGVmYXVsdCIsIl9wbmdDaHVua3NFeHRyYWN0IiwiX2xvZ2dlciIsIl9tYXRyaXgiLCJfdGhyZWFkIiwiX3V0aWxzIiwiX2Rpc3BhdGNoZXIiLCJfbGFuZ3VhZ2VIYW5kbGVyIiwiX01vZGFsIiwiX1NwaW5uZXIiLCJfYWN0aW9ucyIsIl9Sb29tVXBsb2FkIiwiX1NldHRpbmdzU3RvcmUiLCJfc2VuZFRpbWVQZXJmb3JtYW5jZU1ldHJpY3MiLCJfUm9vbUNvbnRleHQiLCJfUmVwbHkiLCJfRXJyb3JEaWFsb2ciLCJfVXBsb2FkRmFpbHVyZURpYWxvZyIsIl9VcGxvYWRDb25maXJtRGlhbG9nIiwiX2ltYWdlTWVkaWEiLCJfU2VuZE1lc3NhZ2VDb21wb3NlciIsIl9sb2NhbFJvb20iLCJfU0RLQ29udGV4dCIsIm93bktleXMiLCJvYmplY3QiLCJlbnVtZXJhYmxlT25seSIsImtleXMiLCJPYmplY3QiLCJnZXRPd25Qcm9wZXJ0eVN5bWJvbHMiLCJzeW1ib2xzIiwiZmlsdGVyIiwic3ltIiwiZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yIiwiZW51bWVyYWJsZSIsInB1c2giLCJhcHBseSIsIl9vYmplY3RTcHJlYWQiLCJ0YXJnZXQiLCJpIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwic291cmNlIiwiZm9yRWFjaCIsImtleSIsIl9kZWZpbmVQcm9wZXJ0eTIiLCJkZWZhdWx0IiwiZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9ycyIsImRlZmluZVByb3BlcnRpZXMiLCJkZWZpbmVQcm9wZXJ0eSIsIlBIWVNfSElEUEkiLCJVcGxvYWRDYW5jZWxlZEVycm9yIiwiRXJyb3IiLCJleHBvcnRzIiwibG9hZEltYWdlRWxlbWVudCIsImltYWdlRmlsZSIsImltZyIsIkltYWdlIiwib2JqZWN0VXJsIiwiVVJMIiwiY3JlYXRlT2JqZWN0VVJMIiwiaW1nUHJvbWlzZSIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0Iiwib25sb2FkIiwicmV2b2tlT2JqZWN0VVJMIiwib25lcnJvciIsImUiLCJzcmMiLCJwYXJzZVByb21pc2UiLCJ0eXBlIiwiaGVhZGVycyIsInJlYWRGaWxlQXNBcnJheUJ1ZmZlciIsInRoZW4iLCJhcnJheUJ1ZmZlciIsImJ1ZmZlciIsIlVpbnQ4QXJyYXkiLCJjaHVua3MiLCJleHRyYWN0UG5nQ2h1bmtzIiwiY2h1bmsiLCJuYW1lIiwiZGF0YSIsImJ5dGVMZW5ndGgiLCJldmVyeSIsInZhbCIsImNhdGNoIiwiY29uc29sZSIsImVycm9yIiwiaGlkcGkiLCJhbGwiLCJ3aWR0aCIsImhlaWdodCIsIklNQUdFX1NJWkVfVEhSRVNIT0xEX1RIVU1CTkFJTCIsIklNQUdFX1RIVU1CTkFJTF9NSU5fUkVEVUNUSU9OX1NJWkUiLCJJTUFHRV9USFVNQk5BSUxfTUlOX1JFRFVDVElPTl9QRVJDRU5UIiwiQUxXQVlTX0lOQ0xVREVfVEhVTUJOQUlMIiwiaW5mb0ZvckltYWdlRmlsZSIsIm1hdHJpeENsaWVudCIsInJvb21JZCIsInRodW1ibmFpbFR5cGUiLCJpbWFnZUVsZW1lbnQiLCJyZXN1bHQiLCJjcmVhdGVUaHVtYm5haWwiLCJpbWFnZUluZm8iLCJpbmZvIiwiaW5jbHVkZXMiLCJzaXplRGlmZmVyZW5jZSIsInNpemUiLCJ0aHVtYm5haWxfaW5mbyIsInVwbG9hZFJlc3VsdCIsInVwbG9hZEZpbGUiLCJ0aHVtYm5haWwiLCJ1cmwiLCJmaWxlIiwibG9hZFZpZGVvRWxlbWVudCIsInZpZGVvRmlsZSIsInZpZGVvIiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50IiwicHJlbG9hZCIsInBsYXlzSW5saW5lIiwibXV0ZWQiLCJyZWFkZXIiLCJGaWxlUmVhZGVyIiwiZXYiLCJvbmxvYWRlZGRhdGEiLCJwYXVzZSIsImRhdGFVcmwiLCJzdGFydHNXaXRoIiwicmVwbGFjZSIsImxvYWQiLCJwbGF5IiwicmVhZEFzRGF0YVVSTCIsImluZm9Gb3JWaWRlb0ZpbGUiLCJ2aWRlb0luZm8iLCJ2aWRlb1dpZHRoIiwidmlkZW9IZWlnaHQiLCJ0aHVtYm5haWxfdXJsIiwidGh1bWJuYWlsX2ZpbGUiLCJyZWFkQXNBcnJheUJ1ZmZlciIsInByb2dyZXNzSGFuZGxlciIsImNvbnRyb2xsZXIiLCJhYm9ydENvbnRyb2xsZXIiLCJBYm9ydENvbnRyb2xsZXIiLCJpc1Jvb21FbmNyeXB0ZWQiLCJzaWduYWwiLCJhYm9ydGVkIiwiZW5jcnlwdFJlc3VsdCIsImVuY3J5cHQiLCJlbmNyeXB0QXR0YWNobWVudCIsImJsb2IiLCJCbG9iIiwiY29udGVudF91cmkiLCJ1cGxvYWRDb250ZW50IiwiaW5jbHVkZUZpbGVuYW1lIiwiQ29udGVudE1lc3NhZ2VzIiwiY29uc3RydWN0b3IiLCJzZW5kU3RpY2tlckNvbnRlbnRUb1Jvb20iLCJ0aHJlYWRJZCIsInRleHQiLCJkb01heWJlTG9jYWxSb29tQWN0aW9uIiwiYWN0dWFsUm9vbUlkIiwic2VuZFN0aWNrZXJNZXNzYWdlIiwibG9nZ2VyIiwid2FybiIsImdldFVwbG9hZExpbWl0IiwibWVkaWFDb25maWciLCJ1bmRlZmluZWQiLCJzZW5kQ29udGVudExpc3RUb1Jvb20iLCJmaWxlcyIsInJlbGF0aW9uIiwiY29udGV4dCIsIlRpbWVsaW5lUmVuZGVyaW5nVHlwZSIsIlJvb20iLCJpc0d1ZXN0IiwiZGlzIiwiZGlzcGF0Y2giLCJhY3Rpb24iLCJyZXBseVRvRXZlbnQiLCJTZGtDb250ZXh0Q2xhc3MiLCJpbnN0YW5jZSIsInJvb21WaWV3U3RvcmUiLCJnZXRRdW90aW5nRXZlbnQiLCJtb2RhbCIsIk1vZGFsIiwiY3JlYXRlRGlhbG9nIiwiU3Bpbm5lciIsInJhY2UiLCJlbnN1cmVNZWRpYUNvbmZpZ0ZldGNoZWQiLCJmaW5pc2hlZCIsImNsb3NlIiwidG9vQmlnRmlsZXMiLCJva0ZpbGVzIiwiaXNGaWxlU2l6ZUFjY2VwdGFibGUiLCJVcGxvYWRGYWlsdXJlRGlhbG9nIiwiYmFkRmlsZXMiLCJ0b3RhbEZpbGVzIiwiY29udGVudE1lc3NhZ2VzIiwic2hvdWxkQ29udGludWUiLCJ1cGxvYWRBbGwiLCJwcm9tQmVmb3JlIiwibG9vcFByb21pc2VCZWZvcmUiLCJVcGxvYWRDb25maXJtRGlhbG9nIiwiY3VycmVudEluZGV4Iiwic2hvdWxkVXBsb2FkQWxsIiwic2VuZENvbnRlbnRUb1Jvb20iLCJldmVudCIsIkFjdGlvbiIsIkZvY3VzU2VuZE1lc3NhZ2VDb21wb3NlciIsImdldEN1cnJlbnRVcGxvYWRzIiwiaW5wcm9ncmVzcyIsInJvb21VcGxvYWQiLCJub1JlbGF0aW9uIiwibWF0Y2hpbmdSZWxhdGlvbiIsInJlbF90eXBlIiwiZXZlbnRfaWQiLCJjYW5jZWxsZWQiLCJjYW5jZWxVcGxvYWQiLCJ1cGxvYWQiLCJhYm9ydCIsIlVwbG9hZENhbmNlbGVkIiwiZmlsZU5hbWUiLCJfdCIsImNvbnRlbnQiLCJib2R5IiwibXNndHlwZSIsIk1zZ1R5cGUiLCJGaWxlIiwiYXR0YWNoTWVudGlvbnMiLCJnZXRTYWZlVXNlcklkIiwiYXR0YWNoUmVsYXRpb24iLCJhZGRSZXBseVRvTWVzc2FnZUNvbnRlbnQiLCJpbmNsdWRlTGVnYWN5RmFsbGJhY2siLCJTZXR0aW5nc1N0b3JlIiwiZ2V0VmFsdWUiLCJkZWNvcmF0ZVN0YXJ0U2VuZGluZ1RpbWUiLCJtaW1ldHlwZSIsIlJvb21VcGxvYWQiLCJVcGxvYWRTdGFydGVkIiwib25Qcm9ncmVzcyIsInByb2dyZXNzIiwiVXBsb2FkUHJvZ3Jlc3MiLCJhc3NpZ24iLCJIVFRQRXJyb3IiLCJpbmRleE9mIiwiQXVkaW8iLCJWaWRlbyIsIlRIUkVBRF9SRUxBVElPTl9UWVBFIiwicmVzcG9uc2UiLCJzZW5kTWVzc2FnZSIsInNlbmRSb3VuZFRyaXBNZXRyaWMiLCJVcGxvYWRGaW5pc2hlZCIsImh0dHBTdGF0dXMiLCJkZXNjIiwiRXJyb3JEaWFsb2ciLCJ0aXRsZSIsImRlc2NyaXB0aW9uIiwiVXBsb2FkRmFpbGVkIiwicmVtb3ZlRWxlbWVudCIsInByb21pc2UiLCJsb2ciLCJnZXRNZWRpYUNvbmZpZyIsImNvbmZpZyIsInNoYXJlZEluc3RhbmNlIiwid2luZG93IiwibXhDb250ZW50TWVzc2FnZXMiXSwic291cmNlcyI6WyIuLi9zcmMvQ29udGVudE1lc3NhZ2VzLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qXG5Db3B5cmlnaHQgMjAxNSwgMjAxNiBPcGVuTWFya2V0IEx0ZFxuQ29weXJpZ2h0IDIwMTkgTmV3IFZlY3RvciBMdGRcbkNvcHlyaWdodCAyMDIwIFRoZSBNYXRyaXgub3JnIEZvdW5kYXRpb24gQy5JLkMuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuKi9cblxuaW1wb3J0IHsgTWF0cml4Q2xpZW50IH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL2NsaWVudFwiO1xuaW1wb3J0IHsgTXNnVHlwZSB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9AdHlwZXMvZXZlbnRcIjtcbmltcG9ydCBlbmNyeXB0IGZyb20gXCJtYXRyaXgtZW5jcnlwdC1hdHRhY2htZW50XCI7XG5pbXBvcnQgZXh0cmFjdFBuZ0NodW5rcyBmcm9tIFwicG5nLWNodW5rcy1leHRyYWN0XCI7XG5pbXBvcnQgeyBJSW1hZ2VJbmZvIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL0B0eXBlcy9wYXJ0aWFsc1wiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL2xvZ2dlclwiO1xuaW1wb3J0IHtcbiAgICBIVFRQRXJyb3IsXG4gICAgSUV2ZW50UmVsYXRpb24sXG4gICAgSVNlbmRFdmVudFJlc3BvbnNlLFxuICAgIE1hdHJpeEV2ZW50LFxuICAgIFVwbG9hZE9wdHMsXG4gICAgVXBsb2FkUHJvZ3Jlc3MsXG59IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9tYXRyaXhcIjtcbmltcG9ydCB7IFRIUkVBRF9SRUxBVElPTl9UWVBFIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL21vZGVscy90aHJlYWRcIjtcbmltcG9ydCB7IHJlbW92ZUVsZW1lbnQgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvdXRpbHNcIjtcblxuaW1wb3J0IHsgSUVuY3J5cHRlZEZpbGUsIElNZWRpYUV2ZW50Q29udGVudCwgSU1lZGlhRXZlbnRJbmZvIH0gZnJvbSBcIi4vY3VzdG9taXNhdGlvbnMvbW9kZWxzL0lNZWRpYUV2ZW50Q29udGVudFwiO1xuaW1wb3J0IGRpcyBmcm9tIFwiLi9kaXNwYXRjaGVyL2Rpc3BhdGNoZXJcIjtcbmltcG9ydCB7IF90IH0gZnJvbSBcIi4vbGFuZ3VhZ2VIYW5kbGVyXCI7XG5pbXBvcnQgTW9kYWwgZnJvbSBcIi4vTW9kYWxcIjtcbmltcG9ydCBTcGlubmVyIGZyb20gXCIuL2NvbXBvbmVudHMvdmlld3MvZWxlbWVudHMvU3Bpbm5lclwiO1xuaW1wb3J0IHsgQWN0aW9uIH0gZnJvbSBcIi4vZGlzcGF0Y2hlci9hY3Rpb25zXCI7XG5pbXBvcnQge1xuICAgIFVwbG9hZENhbmNlbGVkUGF5bG9hZCxcbiAgICBVcGxvYWRFcnJvclBheWxvYWQsXG4gICAgVXBsb2FkRmluaXNoZWRQYXlsb2FkLFxuICAgIFVwbG9hZFByb2dyZXNzUGF5bG9hZCxcbiAgICBVcGxvYWRTdGFydGVkUGF5bG9hZCxcbn0gZnJvbSBcIi4vZGlzcGF0Y2hlci9wYXlsb2Fkcy9VcGxvYWRQYXlsb2FkXCI7XG5pbXBvcnQgeyBSb29tVXBsb2FkIH0gZnJvbSBcIi4vbW9kZWxzL1Jvb21VcGxvYWRcIjtcbmltcG9ydCBTZXR0aW5nc1N0b3JlIGZyb20gXCIuL3NldHRpbmdzL1NldHRpbmdzU3RvcmVcIjtcbmltcG9ydCB7IGRlY29yYXRlU3RhcnRTZW5kaW5nVGltZSwgc2VuZFJvdW5kVHJpcE1ldHJpYyB9IGZyb20gXCIuL3NlbmRUaW1lUGVyZm9ybWFuY2VNZXRyaWNzXCI7XG5pbXBvcnQgeyBUaW1lbGluZVJlbmRlcmluZ1R5cGUgfSBmcm9tIFwiLi9jb250ZXh0cy9Sb29tQ29udGV4dFwiO1xuaW1wb3J0IHsgYWRkUmVwbHlUb01lc3NhZ2VDb250ZW50IH0gZnJvbSBcIi4vdXRpbHMvUmVwbHlcIjtcbmltcG9ydCBFcnJvckRpYWxvZyBmcm9tIFwiLi9jb21wb25lbnRzL3ZpZXdzL2RpYWxvZ3MvRXJyb3JEaWFsb2dcIjtcbmltcG9ydCBVcGxvYWRGYWlsdXJlRGlhbG9nIGZyb20gXCIuL2NvbXBvbmVudHMvdmlld3MvZGlhbG9ncy9VcGxvYWRGYWlsdXJlRGlhbG9nXCI7XG5pbXBvcnQgVXBsb2FkQ29uZmlybURpYWxvZyBmcm9tIFwiLi9jb21wb25lbnRzL3ZpZXdzL2RpYWxvZ3MvVXBsb2FkQ29uZmlybURpYWxvZ1wiO1xuaW1wb3J0IHsgY3JlYXRlVGh1bWJuYWlsIH0gZnJvbSBcIi4vdXRpbHMvaW1hZ2UtbWVkaWFcIjtcbmltcG9ydCB7IGF0dGFjaE1lbnRpb25zLCBhdHRhY2hSZWxhdGlvbiB9IGZyb20gXCIuL2NvbXBvbmVudHMvdmlld3Mvcm9vbXMvU2VuZE1lc3NhZ2VDb21wb3NlclwiO1xuaW1wb3J0IHsgZG9NYXliZUxvY2FsUm9vbUFjdGlvbiB9IGZyb20gXCIuL3V0aWxzL2xvY2FsLXJvb21cIjtcbmltcG9ydCB7IFNka0NvbnRleHRDbGFzcyB9IGZyb20gXCIuL2NvbnRleHRzL1NES0NvbnRleHRcIjtcblxuLy8gc2NyYXBlZCBvdXQgb2YgYSBtYWNPUyBoaWRwaSAoNTY2MHBwbSkgc2NyZWVuc2hvdCBwbmdcbi8vICAgICAgICAgICAgICAgICAgNTY2OSBweCAoeC1heGlzKSAgICAgICwgNTY2OSBweCAoeS1heGlzKSAgICAgICwgcGVyIG1ldHJlXG5jb25zdCBQSFlTX0hJRFBJID0gWzB4MDAsIDB4MDAsIDB4MTYsIDB4MjUsIDB4MDAsIDB4MDAsIDB4MTYsIDB4MjUsIDB4MDFdO1xuXG5leHBvcnQgY2xhc3MgVXBsb2FkQ2FuY2VsZWRFcnJvciBleHRlbmRzIEVycm9yIHt9XG5cbmludGVyZmFjZSBJTWVkaWFDb25maWcge1xuICAgIFwibS51cGxvYWQuc2l6ZVwiPzogbnVtYmVyO1xufVxuXG4vKipcbiAqIExvYWQgYSBmaWxlIGludG8gYSBuZXdseSBjcmVhdGVkIGltYWdlIGVsZW1lbnQuXG4gKlxuICogQHBhcmFtIHtGaWxlfSBpbWFnZUZpbGUgVGhlIGZpbGUgdG8gbG9hZCBpbiBhbiBpbWFnZSBlbGVtZW50LlxuICogQHJldHVybiB7UHJvbWlzZX0gQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2l0aCB0aGUgaHRtbCBpbWFnZSBlbGVtZW50LlxuICovXG5hc3luYyBmdW5jdGlvbiBsb2FkSW1hZ2VFbGVtZW50KGltYWdlRmlsZTogRmlsZSk6IFByb21pc2U8e1xuICAgIHdpZHRoOiBudW1iZXI7XG4gICAgaGVpZ2h0OiBudW1iZXI7XG4gICAgaW1nOiBIVE1MSW1hZ2VFbGVtZW50O1xufT4ge1xuICAgIC8vIExvYWQgdGhlIGZpbGUgaW50byBhbiBodG1sIGVsZW1lbnRcbiAgICBjb25zdCBpbWcgPSBuZXcgSW1hZ2UoKTtcbiAgICBjb25zdCBvYmplY3RVcmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGltYWdlRmlsZSk7XG4gICAgY29uc3QgaW1nUHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaW1nLm9ubG9hZCA9IGZ1bmN0aW9uICgpOiB2b2lkIHtcbiAgICAgICAgICAgIFVSTC5yZXZva2VPYmplY3RVUkwob2JqZWN0VXJsKTtcbiAgICAgICAgICAgIHJlc29sdmUoaW1nKTtcbiAgICAgICAgfTtcbiAgICAgICAgaW1nLm9uZXJyb3IgPSBmdW5jdGlvbiAoZSk6IHZvaWQge1xuICAgICAgICAgICAgcmVqZWN0KGUpO1xuICAgICAgICB9O1xuICAgIH0pO1xuICAgIGltZy5zcmMgPSBvYmplY3RVcmw7XG5cbiAgICAvLyBjaGVjayBmb3IgaGktZHBpIFBOR3MgYW5kIGZ1ZGdlIGRpc3BsYXkgcmVzb2x1dGlvbiBhcyBuZWVkZWQuXG4gICAgLy8gdGhpcyBpcyBtYWlubHkgbmVlZGVkIGZvciBtYWNPUyBzY3JlZW5jYXBzXG4gICAgbGV0IHBhcnNlUHJvbWlzZSA9IFByb21pc2UucmVzb2x2ZShmYWxzZSk7XG4gICAgaWYgKGltYWdlRmlsZS50eXBlID09PSBcImltYWdlL3BuZ1wiKSB7XG4gICAgICAgIC8vIGluIHByYWN0aWNlIG1hY09TIGhhcHBlbnMgdG8gb3JkZXIgdGhlIGNodW5rcyBzbyB0aGV5IGZhbGwgaW5cbiAgICAgICAgLy8gdGhlIGZpcnN0IDB4MTAwMCBieXRlcyAodGhhbmtzIHRvIGEgbWFzc2l2ZSBJQ0MgaGVhZGVyKS5cbiAgICAgICAgLy8gVGh1cyB3ZSBjb3VsZCBzbGljZSB0aGUgZmlsZSBkb3duIHRvIG9ubHkgc25pZmYgdGhlIGZpcnN0IDB4MTAwMFxuICAgICAgICAvLyBieXRlcyAoYnV0IHRoaXMgbWFrZXMgZXh0cmFjdFBuZ0NodW5rcyBjaG9rZSBvbiB0aGUgY29ycnVwdCBmaWxlKVxuICAgICAgICBjb25zdCBoZWFkZXJzID0gaW1hZ2VGaWxlOyAvLy5zbGljZSgwLCAweDEwMDApO1xuICAgICAgICBwYXJzZVByb21pc2UgPSByZWFkRmlsZUFzQXJyYXlCdWZmZXIoaGVhZGVycylcbiAgICAgICAgICAgIC50aGVuKChhcnJheUJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KGFycmF5QnVmZmVyKTtcbiAgICAgICAgICAgICAgICBjb25zdCBjaHVua3MgPSBleHRyYWN0UG5nQ2h1bmtzKGJ1ZmZlcik7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBjaHVuayBvZiBjaHVua3MpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNodW5rLm5hbWUgPT09IFwicEhZc1wiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2h1bmsuZGF0YS5ieXRlTGVuZ3RoICE9PSBQSFlTX0hJRFBJLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNodW5rLmRhdGEuZXZlcnkoKHZhbCwgaSkgPT4gdmFsID09PSBQSFlTX0hJRFBJW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmNhdGNoKChlKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkZhaWxlZCB0byBwYXJzZSBQTkdcIiwgZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgW2hpZHBpXSA9IGF3YWl0IFByb21pc2UuYWxsKFtwYXJzZVByb21pc2UsIGltZ1Byb21pc2VdKTtcbiAgICBjb25zdCB3aWR0aCA9IGhpZHBpID8gaW1nLndpZHRoID4+IDEgOiBpbWcud2lkdGg7XG4gICAgY29uc3QgaGVpZ2h0ID0gaGlkcGkgPyBpbWcuaGVpZ2h0ID4+IDEgOiBpbWcuaGVpZ2h0O1xuICAgIHJldHVybiB7IHdpZHRoLCBoZWlnaHQsIGltZyB9O1xufVxuXG4vLyBNaW5pbXVtIHNpemUgZm9yIGltYWdlIGZpbGVzIGJlZm9yZSB3ZSBnZW5lcmF0ZSBhIHRodW1ibmFpbCBmb3IgdGhlbS5cbmNvbnN0IElNQUdFX1NJWkVfVEhSRVNIT0xEX1RIVU1CTkFJTCA9IDEgPDwgMTU7IC8vIDMyS0Jcbi8vIE1pbmltdW0gc2l6ZSBpbXByb3ZlbWVudCBmb3IgaW1hZ2UgdGh1bWJuYWlscywgaWYgYm90aCBhcmUgbm90IG1ldCB0aGVuIGRvbid0IGJvdGhlciB1cGxvYWRpbmcgdGh1bWJuYWlsLlxuY29uc3QgSU1BR0VfVEhVTUJOQUlMX01JTl9SRURVQ1RJT05fU0laRSA9IDEgPDwgMTY7IC8vIDFNQlxuY29uc3QgSU1BR0VfVEhVTUJOQUlMX01JTl9SRURVQ1RJT05fUEVSQ0VOVCA9IDAuMTsgLy8gMTAlXG4vLyBXZSBkb24ndCBhcHBseSB0aGVzZSB0aHJlc2hvbGRzIHRvIHZpZGVvIHRodW1ibmFpbHMgYXMgYSBwb3N0ZXIgaW1hZ2UgaXMgYWx3YXlzIHVzZWZ1bFxuLy8gYW5kIHZpZGVvcyB0ZW5kIHRvIGJlIG11Y2ggbGFyZ2VyLlxuXG4vLyBJbWFnZSBtaW1lIHR5cGVzIGZvciB3aGljaCB0byBhbHdheXMgaW5jbHVkZSBhIHRodW1ibmFpbCBmb3IgZXZlbiBpZiBpdCBpcyBsYXJnZXIgdGhhbiB0aGUgaW5wdXQgZm9yIHdpZGVyIHN1cHBvcnQuXG5jb25zdCBBTFdBWVNfSU5DTFVERV9USFVNQk5BSUwgPSBbXCJpbWFnZS9hdmlmXCIsIFwiaW1hZ2Uvd2VicFwiXTtcblxuLyoqXG4gKiBSZWFkIHRoZSBtZXRhZGF0YSBmb3IgYW4gaW1hZ2UgZmlsZSBhbmQgY3JlYXRlIGFuZCB1cGxvYWQgYSB0aHVtYm5haWwgb2YgdGhlIGltYWdlLlxuICpcbiAqIEBwYXJhbSB7TWF0cml4Q2xpZW50fSBtYXRyaXhDbGllbnQgQSBtYXRyaXhDbGllbnQgdG8gdXBsb2FkIHRoZSB0aHVtYm5haWwgd2l0aC5cbiAqIEBwYXJhbSB7U3RyaW5nfSByb29tSWQgVGhlIElEIG9mIHRoZSByb29tIHRoZSBpbWFnZSB3aWxsIGJlIHVwbG9hZGVkIGluLlxuICogQHBhcmFtIHtGaWxlfSBpbWFnZUZpbGUgVGhlIGltYWdlIHRvIHJlYWQgYW5kIHRodW1ibmFpbC5cbiAqIEByZXR1cm4ge1Byb21pc2V9IEEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdpdGggdGhlIGF0dGFjaG1lbnQgaW5mby5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gaW5mb0ZvckltYWdlRmlsZShcbiAgICBtYXRyaXhDbGllbnQ6IE1hdHJpeENsaWVudCxcbiAgICByb29tSWQ6IHN0cmluZyxcbiAgICBpbWFnZUZpbGU6IEZpbGUsXG4pOiBQcm9taXNlPFBhcnRpYWw8SU1lZGlhRXZlbnRJbmZvPj4ge1xuICAgIGxldCB0aHVtYm5haWxUeXBlID0gXCJpbWFnZS9wbmdcIjtcbiAgICBpZiAoaW1hZ2VGaWxlLnR5cGUgPT09IFwiaW1hZ2UvanBlZ1wiKSB7XG4gICAgICAgIHRodW1ibmFpbFR5cGUgPSBcImltYWdlL2pwZWdcIjtcbiAgICB9XG5cbiAgICBjb25zdCBpbWFnZUVsZW1lbnQgPSBhd2FpdCBsb2FkSW1hZ2VFbGVtZW50KGltYWdlRmlsZSk7XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjcmVhdGVUaHVtYm5haWwoaW1hZ2VFbGVtZW50LmltZywgaW1hZ2VFbGVtZW50LndpZHRoLCBpbWFnZUVsZW1lbnQuaGVpZ2h0LCB0aHVtYm5haWxUeXBlKTtcbiAgICBjb25zdCBpbWFnZUluZm8gPSByZXN1bHQuaW5mbztcblxuICAgIC8vIEZvciBsZXNzZXIgc3VwcG9ydGVkIGltYWdlIHR5cGVzLCBhbHdheXMgaW5jbHVkZSB0aGUgdGh1bWJuYWlsIGV2ZW4gaWYgaXQgaXMgbGFyZ2VyXG4gICAgaWYgKCFBTFdBWVNfSU5DTFVERV9USFVNQk5BSUwuaW5jbHVkZXMoaW1hZ2VGaWxlLnR5cGUpKSB7XG4gICAgICAgIC8vIHdlIGRvIGFsbCBzaXppbmcgY2hlY2tzIGhlcmUgYmVjYXVzZSB3ZSBzdGlsbCByZWx5IG9uIHRodW1ibmFpbCBnZW5lcmF0aW9uIGZvciBtYWtpbmcgYSBibHVyaGFzaCBmcm9tLlxuICAgICAgICBjb25zdCBzaXplRGlmZmVyZW5jZSA9IGltYWdlRmlsZS5zaXplIC0gaW1hZ2VJbmZvLnRodW1ibmFpbF9pbmZvIS5zaXplO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgICAvLyBpbWFnZSBpcyBzbWFsbCBlbm91Z2ggYWxyZWFkeVxuICAgICAgICAgICAgaW1hZ2VGaWxlLnNpemUgPD0gSU1BR0VfU0laRV9USFJFU0hPTERfVEhVTUJOQUlMIHx8XG4gICAgICAgICAgICAvLyB0aHVtYm5haWwgaXMgbm90IHN1ZmZpY2llbnRseSBzbWFsbGVyIHRoYW4gb3JpZ2luYWxcbiAgICAgICAgICAgIChzaXplRGlmZmVyZW5jZSA8PSBJTUFHRV9USFVNQk5BSUxfTUlOX1JFRFVDVElPTl9TSVpFICYmXG4gICAgICAgICAgICAgICAgc2l6ZURpZmZlcmVuY2UgPD0gaW1hZ2VGaWxlLnNpemUgKiBJTUFHRV9USFVNQk5BSUxfTUlOX1JFRFVDVElPTl9QRVJDRU5UKVxuICAgICAgICApIHtcbiAgICAgICAgICAgIGRlbGV0ZSBpbWFnZUluZm9bXCJ0aHVtYm5haWxfaW5mb1wiXTtcbiAgICAgICAgICAgIHJldHVybiBpbWFnZUluZm87XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB1cGxvYWRSZXN1bHQgPSBhd2FpdCB1cGxvYWRGaWxlKG1hdHJpeENsaWVudCwgcm9vbUlkLCByZXN1bHQudGh1bWJuYWlsKTtcblxuICAgIGltYWdlSW5mb1tcInRodW1ibmFpbF91cmxcIl0gPSB1cGxvYWRSZXN1bHQudXJsO1xuICAgIGltYWdlSW5mb1tcInRodW1ibmFpbF9maWxlXCJdID0gdXBsb2FkUmVzdWx0LmZpbGU7XG4gICAgcmV0dXJuIGltYWdlSW5mbztcbn1cblxuLyoqXG4gKiBMb2FkIGEgZmlsZSBpbnRvIGEgbmV3bHkgY3JlYXRlZCB2aWRlbyBlbGVtZW50IGFuZCBwdWxsIHNvbWUgc3RyaW5nc1xuICogaW4gYW4gYXR0ZW1wdCB0byBndWFyYW50ZWUgdGhlIGZpcnN0IGZyYW1lIHdpbGwgYmUgc2hvd2luZy5cbiAqXG4gKiBAcGFyYW0ge0ZpbGV9IHZpZGVvRmlsZSBUaGUgZmlsZSB0byBsb2FkIGluIGFuIHZpZGVvIGVsZW1lbnQuXG4gKiBAcmV0dXJuIHtQcm9taXNlfSBBIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aXRoIHRoZSB2aWRlbyBpbWFnZSBlbGVtZW50LlxuICovXG5mdW5jdGlvbiBsb2FkVmlkZW9FbGVtZW50KHZpZGVvRmlsZTogRmlsZSk6IFByb21pc2U8SFRNTFZpZGVvRWxlbWVudD4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIC8vIExvYWQgdGhlIGZpbGUgaW50byBhbiBodG1sIGVsZW1lbnRcbiAgICAgICAgY29uc3QgdmlkZW8gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidmlkZW9cIik7XG4gICAgICAgIHZpZGVvLnByZWxvYWQgPSBcIm1ldGFkYXRhXCI7XG4gICAgICAgIHZpZGVvLnBsYXlzSW5saW5lID0gdHJ1ZTtcbiAgICAgICAgdmlkZW8ubXV0ZWQgPSB0cnVlO1xuXG4gICAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG5cbiAgICAgICAgcmVhZGVyLm9ubG9hZCA9IGZ1bmN0aW9uIChldik6IHZvaWQge1xuICAgICAgICAgICAgLy8gV2FpdCB1bnRpbCB3ZSBoYXZlIGVub3VnaCBkYXRhIHRvIHRodW1ibmFpbCB0aGUgZmlyc3QgZnJhbWUuXG4gICAgICAgICAgICB2aWRlby5vbmxvYWRlZGRhdGEgPSBhc3luYyBmdW5jdGlvbiAoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSh2aWRlbyk7XG4gICAgICAgICAgICAgICAgdmlkZW8ucGF1c2UoKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB2aWRlby5vbmVycm9yID0gZnVuY3Rpb24gKGUpOiB2b2lkIHtcbiAgICAgICAgICAgICAgICByZWplY3QoZSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBsZXQgZGF0YVVybCA9IGV2LnRhcmdldD8ucmVzdWx0IGFzIHN0cmluZztcbiAgICAgICAgICAgIC8vIENocm9tZSBjaG9rZXMgb24gcXVpY2t0aW1lIGJ1dCBsaWtlcyBtcDQsIGFuZCBgZmlsZS50eXBlYCBpc1xuICAgICAgICAgICAgLy8gcmVhZCBvbmx5LCBzbyBkbyB0aGlzIGhvcnJpYmxlIGhhY2sgdG8gdW5icmVhayBxdWlja3RpbWVcbiAgICAgICAgICAgIGlmIChkYXRhVXJsPy5zdGFydHNXaXRoKFwiZGF0YTp2aWRlby9xdWlja3RpbWU7XCIpKSB7XG4gICAgICAgICAgICAgICAgZGF0YVVybCA9IGRhdGFVcmwucmVwbGFjZShcImRhdGE6dmlkZW8vcXVpY2t0aW1lO1wiLCBcImRhdGE6dmlkZW8vbXA0O1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmlkZW8uc3JjID0gZGF0YVVybDtcbiAgICAgICAgICAgIHZpZGVvLmxvYWQoKTtcbiAgICAgICAgICAgIHZpZGVvLnBsYXkoKTtcbiAgICAgICAgfTtcbiAgICAgICAgcmVhZGVyLm9uZXJyb3IgPSBmdW5jdGlvbiAoZSk6IHZvaWQge1xuICAgICAgICAgICAgcmVqZWN0KGUpO1xuICAgICAgICB9O1xuICAgICAgICByZWFkZXIucmVhZEFzRGF0YVVSTCh2aWRlb0ZpbGUpO1xuICAgIH0pO1xufVxuXG4vKipcbiAqIFJlYWQgdGhlIG1ldGFkYXRhIGZvciBhIHZpZGVvIGZpbGUgYW5kIGNyZWF0ZSBhbmQgdXBsb2FkIGEgdGh1bWJuYWlsIG9mIHRoZSB2aWRlby5cbiAqXG4gKiBAcGFyYW0ge01hdHJpeENsaWVudH0gbWF0cml4Q2xpZW50IEEgbWF0cml4Q2xpZW50IHRvIHVwbG9hZCB0aGUgdGh1bWJuYWlsIHdpdGguXG4gKiBAcGFyYW0ge1N0cmluZ30gcm9vbUlkIFRoZSBJRCBvZiB0aGUgcm9vbSB0aGUgdmlkZW8gd2lsbCBiZSB1cGxvYWRlZCB0by5cbiAqIEBwYXJhbSB7RmlsZX0gdmlkZW9GaWxlIFRoZSB2aWRlbyB0byByZWFkIGFuZCB0aHVtYm5haWwuXG4gKiBAcmV0dXJuIHtQcm9taXNlfSBBIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aXRoIHRoZSBhdHRhY2htZW50IGluZm8uXG4gKi9cbmZ1bmN0aW9uIGluZm9Gb3JWaWRlb0ZpbGUoXG4gICAgbWF0cml4Q2xpZW50OiBNYXRyaXhDbGllbnQsXG4gICAgcm9vbUlkOiBzdHJpbmcsXG4gICAgdmlkZW9GaWxlOiBGaWxlLFxuKTogUHJvbWlzZTxQYXJ0aWFsPElNZWRpYUV2ZW50SW5mbz4+IHtcbiAgICBjb25zdCB0aHVtYm5haWxUeXBlID0gXCJpbWFnZS9qcGVnXCI7XG5cbiAgICBsZXQgdmlkZW9JbmZvOiBQYXJ0aWFsPElNZWRpYUV2ZW50SW5mbz47XG4gICAgcmV0dXJuIGxvYWRWaWRlb0VsZW1lbnQodmlkZW9GaWxlKVxuICAgICAgICAudGhlbigodmlkZW8pID0+IHtcbiAgICAgICAgICAgIHJldHVybiBjcmVhdGVUaHVtYm5haWwodmlkZW8sIHZpZGVvLnZpZGVvV2lkdGgsIHZpZGVvLnZpZGVvSGVpZ2h0LCB0aHVtYm5haWxUeXBlKTtcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4oKHJlc3VsdCkgPT4ge1xuICAgICAgICAgICAgdmlkZW9JbmZvID0gcmVzdWx0LmluZm87XG4gICAgICAgICAgICByZXR1cm4gdXBsb2FkRmlsZShtYXRyaXhDbGllbnQsIHJvb21JZCwgcmVzdWx0LnRodW1ibmFpbCk7XG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKChyZXN1bHQpID0+IHtcbiAgICAgICAgICAgIHZpZGVvSW5mby50aHVtYm5haWxfdXJsID0gcmVzdWx0LnVybDtcbiAgICAgICAgICAgIHZpZGVvSW5mby50aHVtYm5haWxfZmlsZSA9IHJlc3VsdC5maWxlO1xuICAgICAgICAgICAgcmV0dXJuIHZpZGVvSW5mbztcbiAgICAgICAgfSk7XG59XG5cbi8qKlxuICogUmVhZCB0aGUgZmlsZSBhcyBhbiBBcnJheUJ1ZmZlci5cbiAqIEBwYXJhbSB7RmlsZX0gZmlsZSBUaGUgZmlsZSB0byByZWFkXG4gKiBAcmV0dXJuIHtQcm9taXNlfSBBIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aXRoIGFuIEFycmF5QnVmZmVyIHdoZW4gdGhlIGZpbGVcbiAqICAgaXMgcmVhZC5cbiAqL1xuZnVuY3Rpb24gcmVhZEZpbGVBc0FycmF5QnVmZmVyKGZpbGU6IEZpbGUgfCBCbG9iKTogUHJvbWlzZTxBcnJheUJ1ZmZlcj4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgICAgIHJlYWRlci5vbmxvYWQgPSBmdW5jdGlvbiAoZSk6IHZvaWQge1xuICAgICAgICAgICAgcmVzb2x2ZShlLnRhcmdldD8ucmVzdWx0IGFzIEFycmF5QnVmZmVyKTtcbiAgICAgICAgfTtcbiAgICAgICAgcmVhZGVyLm9uZXJyb3IgPSBmdW5jdGlvbiAoZSk6IHZvaWQge1xuICAgICAgICAgICAgcmVqZWN0KGUpO1xuICAgICAgICB9O1xuICAgICAgICByZWFkZXIucmVhZEFzQXJyYXlCdWZmZXIoZmlsZSk7XG4gICAgfSk7XG59XG5cbi8qKlxuICogVXBsb2FkIHRoZSBmaWxlIHRvIHRoZSBjb250ZW50IHJlcG9zaXRvcnkuXG4gKiBJZiB0aGUgcm9vbSBpcyBlbmNyeXB0ZWQgdGhlbiBlbmNyeXB0IHRoZSBmaWxlIGJlZm9yZSB1cGxvYWRpbmcuXG4gKlxuICogQHBhcmFtIHtNYXRyaXhDbGllbnR9IG1hdHJpeENsaWVudCBUaGUgbWF0cml4IGNsaWVudCB0byB1cGxvYWQgdGhlIGZpbGUgd2l0aC5cbiAqIEBwYXJhbSB7U3RyaW5nfSByb29tSWQgVGhlIElEIG9mIHRoZSByb29tIGJlaW5nIHVwbG9hZGVkIHRvLlxuICogQHBhcmFtIHtGaWxlfSBmaWxlIFRoZSBmaWxlIHRvIHVwbG9hZC5cbiAqIEBwYXJhbSB7RnVuY3Rpb24/fSBwcm9ncmVzc0hhbmRsZXIgb3B0aW9uYWwgY2FsbGJhY2sgdG8gYmUgY2FsbGVkIHdoZW4gYSBjaHVuayBvZlxuICogICAgZGF0YSBpcyB1cGxvYWRlZC5cbiAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyP30gY29udHJvbGxlciBvcHRpb25hbCBhYm9ydENvbnRyb2xsZXIgdG8gdXNlIGZvciB0aGlzIHVwbG9hZC5cbiAqIEByZXR1cm4ge1Byb21pc2V9IEEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdpdGggYW4gb2JqZWN0LlxuICogIElmIHRoZSBmaWxlIGlzIHVuZW5jcnlwdGVkIHRoZW4gdGhlIG9iamVjdCB3aWxsIGhhdmUgYSBcInVybFwiIGtleS5cbiAqICBJZiB0aGUgZmlsZSBpcyBlbmNyeXB0ZWQgdGhlbiB0aGUgb2JqZWN0IHdpbGwgaGF2ZSBhIFwiZmlsZVwiIGtleS5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHVwbG9hZEZpbGUoXG4gICAgbWF0cml4Q2xpZW50OiBNYXRyaXhDbGllbnQsXG4gICAgcm9vbUlkOiBzdHJpbmcsXG4gICAgZmlsZTogRmlsZSB8IEJsb2IsXG4gICAgcHJvZ3Jlc3NIYW5kbGVyPzogVXBsb2FkT3B0c1tcInByb2dyZXNzSGFuZGxlclwiXSxcbiAgICBjb250cm9sbGVyPzogQWJvcnRDb250cm9sbGVyLFxuKTogUHJvbWlzZTx7IHVybD86IHN0cmluZzsgZmlsZT86IElFbmNyeXB0ZWRGaWxlIH0+IHtcbiAgICBjb25zdCBhYm9ydENvbnRyb2xsZXIgPSBjb250cm9sbGVyID8/IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcblxuICAgIC8vIElmIHRoZSByb29tIGlzIGVuY3J5cHRlZCB0aGVuIGVuY3J5cHQgdGhlIGZpbGUgYmVmb3JlIHVwbG9hZGluZyBpdC5cbiAgICBpZiAobWF0cml4Q2xpZW50LmlzUm9vbUVuY3J5cHRlZChyb29tSWQpKSB7XG4gICAgICAgIC8vIEZpcnN0IHJlYWQgdGhlIGZpbGUgaW50byBtZW1vcnkuXG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZWFkRmlsZUFzQXJyYXlCdWZmZXIoZmlsZSk7XG4gICAgICAgIGlmIChhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHRocm93IG5ldyBVcGxvYWRDYW5jZWxlZEVycm9yKCk7XG5cbiAgICAgICAgLy8gVGhlbiBlbmNyeXB0IHRoZSBmaWxlLlxuICAgICAgICBjb25zdCBlbmNyeXB0UmVzdWx0ID0gYXdhaXQgZW5jcnlwdC5lbmNyeXB0QXR0YWNobWVudChkYXRhKTtcbiAgICAgICAgaWYgKGFib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCkgdGhyb3cgbmV3IFVwbG9hZENhbmNlbGVkRXJyb3IoKTtcblxuICAgICAgICAvLyBQYXNzIHRoZSBlbmNyeXB0ZWQgZGF0YSBhcyBhIEJsb2IgdG8gdGhlIHVwbG9hZGVyLlxuICAgICAgICBjb25zdCBibG9iID0gbmV3IEJsb2IoW2VuY3J5cHRSZXN1bHQuZGF0YV0pO1xuXG4gICAgICAgIGNvbnN0IHsgY29udGVudF91cmk6IHVybCB9ID0gYXdhaXQgbWF0cml4Q2xpZW50LnVwbG9hZENvbnRlbnQoYmxvYiwge1xuICAgICAgICAgICAgcHJvZ3Jlc3NIYW5kbGVyLFxuICAgICAgICAgICAgYWJvcnRDb250cm9sbGVyLFxuICAgICAgICAgICAgaW5jbHVkZUZpbGVuYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIHR5cGU6IFwiYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtXCIsXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSB0aHJvdyBuZXcgVXBsb2FkQ2FuY2VsZWRFcnJvcigpO1xuXG4gICAgICAgIC8vIElmIHRoZSBhdHRhY2htZW50IGlzIGVuY3J5cHRlZCB0aGVuIGJ1bmRsZSB0aGUgVVJMIGFsb25nIHdpdGggdGhlIGluZm9ybWF0aW9uXG4gICAgICAgIC8vIG5lZWRlZCB0byBkZWNyeXB0IHRoZSBhdHRhY2htZW50IGFuZCBhZGQgaXQgdW5kZXIgYSBmaWxlIGtleS5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGZpbGU6IHtcbiAgICAgICAgICAgICAgICAuLi5lbmNyeXB0UmVzdWx0LmluZm8sXG4gICAgICAgICAgICAgICAgdXJsLFxuICAgICAgICAgICAgfSBhcyBJRW5jcnlwdGVkRmlsZSxcbiAgICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCB7IGNvbnRlbnRfdXJpOiB1cmwgfSA9IGF3YWl0IG1hdHJpeENsaWVudC51cGxvYWRDb250ZW50KGZpbGUsIHsgcHJvZ3Jlc3NIYW5kbGVyLCBhYm9ydENvbnRyb2xsZXIgfSk7XG4gICAgICAgIGlmIChhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHRocm93IG5ldyBVcGxvYWRDYW5jZWxlZEVycm9yKCk7XG4gICAgICAgIC8vIElmIHRoZSBhdHRhY2htZW50IGlzbid0IGVuY3J5cHRlZCB0aGVuIGluY2x1ZGUgdGhlIFVSTCBkaXJlY3RseS5cbiAgICAgICAgcmV0dXJuIHsgdXJsIH07XG4gICAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBDb250ZW50TWVzc2FnZXMge1xuICAgIHByaXZhdGUgaW5wcm9ncmVzczogUm9vbVVwbG9hZFtdID0gW107XG4gICAgcHJpdmF0ZSBtZWRpYUNvbmZpZzogSU1lZGlhQ29uZmlnIHwgbnVsbCA9IG51bGw7XG5cbiAgICBwdWJsaWMgc2VuZFN0aWNrZXJDb250ZW50VG9Sb29tKFxuICAgICAgICB1cmw6IHN0cmluZyxcbiAgICAgICAgcm9vbUlkOiBzdHJpbmcsXG4gICAgICAgIHRocmVhZElkOiBzdHJpbmcgfCBudWxsLFxuICAgICAgICBpbmZvOiBJSW1hZ2VJbmZvLFxuICAgICAgICB0ZXh0OiBzdHJpbmcsXG4gICAgICAgIG1hdHJpeENsaWVudDogTWF0cml4Q2xpZW50LFxuICAgICk6IFByb21pc2U8SVNlbmRFdmVudFJlc3BvbnNlPiB7XG4gICAgICAgIHJldHVybiBkb01heWJlTG9jYWxSb29tQWN0aW9uKFxuICAgICAgICAgICAgcm9vbUlkLFxuICAgICAgICAgICAgKGFjdHVhbFJvb21JZDogc3RyaW5nKSA9PiBtYXRyaXhDbGllbnQuc2VuZFN0aWNrZXJNZXNzYWdlKGFjdHVhbFJvb21JZCwgdGhyZWFkSWQsIHVybCwgaW5mbywgdGV4dCksXG4gICAgICAgICAgICBtYXRyaXhDbGllbnQsXG4gICAgICAgICkuY2F0Y2goKGUpID0+IHtcbiAgICAgICAgICAgIGxvZ2dlci53YXJuKGBGYWlsZWQgdG8gc2VuZCBjb250ZW50IHdpdGggVVJMICR7dXJsfSB0byByb29tICR7cm9vbUlkfWAsIGUpO1xuICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHVibGljIGdldFVwbG9hZExpbWl0KCk6IG51bWJlciB8IG51bGwge1xuICAgICAgICBpZiAodGhpcy5tZWRpYUNvbmZpZyAhPT0gbnVsbCAmJiB0aGlzLm1lZGlhQ29uZmlnW1wibS51cGxvYWQuc2l6ZVwiXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5tZWRpYUNvbmZpZ1tcIm0udXBsb2FkLnNpemVcIl07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBzZW5kQ29udGVudExpc3RUb1Jvb20oXG4gICAgICAgIGZpbGVzOiBGaWxlW10sXG4gICAgICAgIHJvb21JZDogc3RyaW5nLFxuICAgICAgICByZWxhdGlvbjogSUV2ZW50UmVsYXRpb24gfCB1bmRlZmluZWQsXG4gICAgICAgIG1hdHJpeENsaWVudDogTWF0cml4Q2xpZW50LFxuICAgICAgICBjb250ZXh0ID0gVGltZWxpbmVSZW5kZXJpbmdUeXBlLlJvb20sXG4gICAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGlmIChtYXRyaXhDbGllbnQuaXNHdWVzdCgpKSB7XG4gICAgICAgICAgICBkaXMuZGlzcGF0Y2goeyBhY3Rpb246IFwicmVxdWlyZV9yZWdpc3RyYXRpb25cIiB9KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJlcGx5VG9FdmVudCA9IFNka0NvbnRleHRDbGFzcy5pbnN0YW5jZS5yb29tVmlld1N0b3JlLmdldFF1b3RpbmdFdmVudCgpO1xuICAgICAgICBpZiAoIXRoaXMubWVkaWFDb25maWcpIHtcbiAgICAgICAgICAgIC8vIGhvdC1wYXRoIG9wdGltaXphdGlvbiB0byBub3QgZmxhc2ggYSBzcGlubmVyIGlmIHdlIGRvbid0IG5lZWQgdG9cbiAgICAgICAgICAgIGNvbnN0IG1vZGFsID0gTW9kYWwuY3JlYXRlRGlhbG9nKFNwaW5uZXIsIHVuZGVmaW5lZCwgXCJteF9EaWFsb2dfc3Bpbm5lclwiKTtcbiAgICAgICAgICAgIGF3YWl0IFByb21pc2UucmFjZShbdGhpcy5lbnN1cmVNZWRpYUNvbmZpZ0ZldGNoZWQobWF0cml4Q2xpZW50KSwgbW9kYWwuZmluaXNoZWRdKTtcbiAgICAgICAgICAgIGlmICghdGhpcy5tZWRpYUNvbmZpZykge1xuICAgICAgICAgICAgICAgIC8vIFVzZXIgY2FuY2VsbGVkIGJ5IGNsaWNraW5nIGF3YXkgb24gdGhlIHNwaW5uZXJcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG1vZGFsLmNsb3NlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB0b29CaWdGaWxlczogRmlsZVtdID0gW107XG4gICAgICAgIGNvbnN0IG9rRmlsZXM6IEZpbGVbXSA9IFtdO1xuXG4gICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgICAgICAgaWYgKHRoaXMuaXNGaWxlU2l6ZUFjY2VwdGFibGUoZmlsZSkpIHtcbiAgICAgICAgICAgICAgICBva0ZpbGVzLnB1c2goZmlsZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRvb0JpZ0ZpbGVzLnB1c2goZmlsZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodG9vQmlnRmlsZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgY29uc3QgeyBmaW5pc2hlZCB9ID0gTW9kYWwuY3JlYXRlRGlhbG9nKFVwbG9hZEZhaWx1cmVEaWFsb2csIHtcbiAgICAgICAgICAgICAgICBiYWRGaWxlczogdG9vQmlnRmlsZXMsXG4gICAgICAgICAgICAgICAgdG90YWxGaWxlczogZmlsZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgIGNvbnRlbnRNZXNzYWdlczogdGhpcyxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3QgW3Nob3VsZENvbnRpbnVlXSA9IGF3YWl0IGZpbmlzaGVkO1xuICAgICAgICAgICAgaWYgKCFzaG91bGRDb250aW51ZSkgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHVwbG9hZEFsbCA9IGZhbHNlO1xuICAgICAgICAvLyBQcm9taXNlIHRvIGNvbXBsZXRlIGJlZm9yZSBzZW5kaW5nIG5leHQgZmlsZSBpbnRvIHJvb20sIHVzZWQgZm9yIHN5bmNocm9uaXNhdGlvbiBvZiBmaWxlLXNlbmRpbmdcbiAgICAgICAgLy8gdG8gbWF0Y2ggdGhlIG9yZGVyIHRoZSBmaWxlcyB3ZXJlIHNwZWNpZmllZCBpblxuICAgICAgICBsZXQgcHJvbUJlZm9yZTogUHJvbWlzZTxhbnk+ID0gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb2tGaWxlcy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgY29uc3QgZmlsZSA9IG9rRmlsZXNbaV07XG4gICAgICAgICAgICBjb25zdCBsb29wUHJvbWlzZUJlZm9yZSA9IHByb21CZWZvcmU7XG5cbiAgICAgICAgICAgIGlmICghdXBsb2FkQWxsKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBmaW5pc2hlZCB9ID0gTW9kYWwuY3JlYXRlRGlhbG9nKFVwbG9hZENvbmZpcm1EaWFsb2csIHtcbiAgICAgICAgICAgICAgICAgICAgZmlsZSxcbiAgICAgICAgICAgICAgICAgICAgY3VycmVudEluZGV4OiBpLFxuICAgICAgICAgICAgICAgICAgICB0b3RhbEZpbGVzOiBva0ZpbGVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCBbc2hvdWxkQ29udGludWUsIHNob3VsZFVwbG9hZEFsbF0gPSBhd2FpdCBmaW5pc2hlZDtcbiAgICAgICAgICAgICAgICBpZiAoIXNob3VsZENvbnRpbnVlKSBicmVhaztcbiAgICAgICAgICAgICAgICBpZiAoc2hvdWxkVXBsb2FkQWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIHVwbG9hZEFsbCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBwcm9tQmVmb3JlID0gZG9NYXliZUxvY2FsUm9vbUFjdGlvbihcbiAgICAgICAgICAgICAgICByb29tSWQsXG4gICAgICAgICAgICAgICAgKGFjdHVhbFJvb21JZCkgPT5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZW5kQ29udGVudFRvUm9vbShcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBhY3R1YWxSb29tSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICByZWxhdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdHJpeENsaWVudCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcGx5VG9FdmVudCA/PyB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBsb29wUHJvbWlzZUJlZm9yZSxcbiAgICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICBtYXRyaXhDbGllbnQsXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJlcGx5VG9FdmVudCkge1xuICAgICAgICAgICAgLy8gQ2xlYXIgZXZlbnQgYmVpbmcgcmVwbGllZCB0b1xuICAgICAgICAgICAgZGlzLmRpc3BhdGNoKHtcbiAgICAgICAgICAgICAgICBhY3Rpb246IFwicmVwbHlfdG9fZXZlbnRcIixcbiAgICAgICAgICAgICAgICBldmVudDogbnVsbCxcbiAgICAgICAgICAgICAgICBjb250ZXh0LFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGb2N1cyB0aGUgY29ycmVjdCBjb21wb3NlclxuICAgICAgICBkaXMuZGlzcGF0Y2goe1xuICAgICAgICAgICAgYWN0aW9uOiBBY3Rpb24uRm9jdXNTZW5kTWVzc2FnZUNvbXBvc2VyLFxuICAgICAgICAgICAgY29udGV4dCxcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHVibGljIGdldEN1cnJlbnRVcGxvYWRzKHJlbGF0aW9uPzogSUV2ZW50UmVsYXRpb24pOiBSb29tVXBsb2FkW10ge1xuICAgICAgICByZXR1cm4gdGhpcy5pbnByb2dyZXNzLmZpbHRlcigocm9vbVVwbG9hZCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgbm9SZWxhdGlvbiA9ICFyZWxhdGlvbiAmJiAhcm9vbVVwbG9hZC5yZWxhdGlvbjtcbiAgICAgICAgICAgIGNvbnN0IG1hdGNoaW5nUmVsYXRpb24gPVxuICAgICAgICAgICAgICAgIHJlbGF0aW9uICYmXG4gICAgICAgICAgICAgICAgcm9vbVVwbG9hZC5yZWxhdGlvbiAmJlxuICAgICAgICAgICAgICAgIHJlbGF0aW9uLnJlbF90eXBlID09PSByb29tVXBsb2FkLnJlbGF0aW9uLnJlbF90eXBlICYmXG4gICAgICAgICAgICAgICAgcmVsYXRpb24uZXZlbnRfaWQgPT09IHJvb21VcGxvYWQucmVsYXRpb24uZXZlbnRfaWQ7XG5cbiAgICAgICAgICAgIHJldHVybiAobm9SZWxhdGlvbiB8fCBtYXRjaGluZ1JlbGF0aW9uKSAmJiAhcm9vbVVwbG9hZC5jYW5jZWxsZWQ7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHB1YmxpYyBjYW5jZWxVcGxvYWQodXBsb2FkOiBSb29tVXBsb2FkKTogdm9pZCB7XG4gICAgICAgIHVwbG9hZC5hYm9ydCgpO1xuICAgICAgICBkaXMuZGlzcGF0Y2g8VXBsb2FkQ2FuY2VsZWRQYXlsb2FkPih7IGFjdGlvbjogQWN0aW9uLlVwbG9hZENhbmNlbGVkLCB1cGxvYWQgfSk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHNlbmRDb250ZW50VG9Sb29tKFxuICAgICAgICBmaWxlOiBGaWxlLFxuICAgICAgICByb29tSWQ6IHN0cmluZyxcbiAgICAgICAgcmVsYXRpb246IElFdmVudFJlbGF0aW9uIHwgdW5kZWZpbmVkLFxuICAgICAgICBtYXRyaXhDbGllbnQ6IE1hdHJpeENsaWVudCxcbiAgICAgICAgcmVwbHlUb0V2ZW50OiBNYXRyaXhFdmVudCB8IHVuZGVmaW5lZCxcbiAgICAgICAgcHJvbUJlZm9yZT86IFByb21pc2U8YW55PixcbiAgICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgY29uc3QgZmlsZU5hbWUgPSBmaWxlLm5hbWUgfHwgX3QoXCJBdHRhY2htZW50XCIpO1xuICAgICAgICBjb25zdCBjb250ZW50OiBPbWl0PElNZWRpYUV2ZW50Q29udGVudCwgXCJpbmZvXCI+ICYgeyBpbmZvOiBQYXJ0aWFsPElNZWRpYUV2ZW50SW5mbz4gfSA9IHtcbiAgICAgICAgICAgIGJvZHk6IGZpbGVOYW1lLFxuICAgICAgICAgICAgaW5mbzoge1xuICAgICAgICAgICAgICAgIHNpemU6IGZpbGUuc2l6ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBtc2d0eXBlOiBNc2dUeXBlLkZpbGUsIC8vIHNldCBtb3JlIHNwZWNpZmljYWxseSBsYXRlclxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIEF0dGFjaCBtZW50aW9ucywgd2hpY2ggcmVhbGx5IG9ubHkgYXBwbGllcyBpZiB0aGVyZSdzIGEgcmVwbHlUb0V2ZW50LlxuICAgICAgICBhdHRhY2hNZW50aW9ucyhtYXRyaXhDbGllbnQuZ2V0U2FmZVVzZXJJZCgpLCBjb250ZW50LCBudWxsLCByZXBseVRvRXZlbnQpO1xuICAgICAgICBhdHRhY2hSZWxhdGlvbihjb250ZW50LCByZWxhdGlvbik7XG4gICAgICAgIGlmIChyZXBseVRvRXZlbnQpIHtcbiAgICAgICAgICAgIGFkZFJlcGx5VG9NZXNzYWdlQ29udGVudChjb250ZW50LCByZXBseVRvRXZlbnQsIHtcbiAgICAgICAgICAgICAgICBpbmNsdWRlTGVnYWN5RmFsbGJhY2s6IGZhbHNlLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoU2V0dGluZ3NTdG9yZS5nZXRWYWx1ZShcIlBlcmZvcm1hbmNlLmFkZFNlbmRNZXNzYWdlVGltaW5nTWV0YWRhdGFcIikpIHtcbiAgICAgICAgICAgIGRlY29yYXRlU3RhcnRTZW5kaW5nVGltZShjb250ZW50KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIHdlIGhhdmUgYSBtaW1lIHR5cGUgZm9yIHRoZSBmaWxlLCBhZGQgaXQgdG8gdGhlIG1lc3NhZ2UgbWV0YWRhdGFcbiAgICAgICAgaWYgKGZpbGUudHlwZSkge1xuICAgICAgICAgICAgY29udGVudC5pbmZvLm1pbWV0eXBlID0gZmlsZS50eXBlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdXBsb2FkID0gbmV3IFJvb21VcGxvYWQocm9vbUlkLCBmaWxlTmFtZSwgcmVsYXRpb24sIGZpbGUuc2l6ZSk7XG4gICAgICAgIHRoaXMuaW5wcm9ncmVzcy5wdXNoKHVwbG9hZCk7XG4gICAgICAgIGRpcy5kaXNwYXRjaDxVcGxvYWRTdGFydGVkUGF5bG9hZD4oeyBhY3Rpb246IEFjdGlvbi5VcGxvYWRTdGFydGVkLCB1cGxvYWQgfSk7XG5cbiAgICAgICAgZnVuY3Rpb24gb25Qcm9ncmVzcyhwcm9ncmVzczogVXBsb2FkUHJvZ3Jlc3MpOiB2b2lkIHtcbiAgICAgICAgICAgIHVwbG9hZC5vblByb2dyZXNzKHByb2dyZXNzKTtcbiAgICAgICAgICAgIGRpcy5kaXNwYXRjaDxVcGxvYWRQcm9ncmVzc1BheWxvYWQ+KHsgYWN0aW9uOiBBY3Rpb24uVXBsb2FkUHJvZ3Jlc3MsIHVwbG9hZCB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAoZmlsZS50eXBlLnN0YXJ0c1dpdGgoXCJpbWFnZS9cIikpIHtcbiAgICAgICAgICAgICAgICBjb250ZW50Lm1zZ3R5cGUgPSBNc2dUeXBlLkltYWdlO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGltYWdlSW5mbyA9IGF3YWl0IGluZm9Gb3JJbWFnZUZpbGUobWF0cml4Q2xpZW50LCByb29tSWQsIGZpbGUpO1xuICAgICAgICAgICAgICAgICAgICBPYmplY3QuYXNzaWduKGNvbnRlbnQuaW5mbywgaW1hZ2VJbmZvKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlIGluc3RhbmNlb2YgSFRUUEVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyByZS10aHJvdyB0byBtYWluIHVwbG9hZCBlcnJvciBoYW5kbGVyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIC8vIE90aGVyd2lzZSB3ZSBmYWlsZWQgdG8gdGh1bWJuYWlsLCBmYWxsIGJhY2sgdG8gdXBsb2FkaW5nIGFuIG0uZmlsZVxuICAgICAgICAgICAgICAgICAgICBsb2dnZXIuZXJyb3IoZSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQubXNndHlwZSA9IE1zZ1R5cGUuRmlsZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGZpbGUudHlwZS5pbmRleE9mKFwiYXVkaW8vXCIpID09PSAwKSB7XG4gICAgICAgICAgICAgICAgY29udGVudC5tc2d0eXBlID0gTXNnVHlwZS5BdWRpbztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZmlsZS50eXBlLmluZGV4T2YoXCJ2aWRlby9cIikgPT09IDApIHtcbiAgICAgICAgICAgICAgICBjb250ZW50Lm1zZ3R5cGUgPSBNc2dUeXBlLlZpZGVvO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZpZGVvSW5mbyA9IGF3YWl0IGluZm9Gb3JWaWRlb0ZpbGUobWF0cml4Q2xpZW50LCByb29tSWQsIGZpbGUpO1xuICAgICAgICAgICAgICAgICAgICBPYmplY3QuYXNzaWduKGNvbnRlbnQuaW5mbywgdmlkZW9JbmZvKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEZhaWxlZCB0byB0aHVtYm5haWwsIGZhbGwgYmFjayB0byB1cGxvYWRpbmcgYW4gbS5maWxlXG4gICAgICAgICAgICAgICAgICAgIGxvZ2dlci5lcnJvcihlKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGVudC5tc2d0eXBlID0gTXNnVHlwZS5GaWxlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29udGVudC5tc2d0eXBlID0gTXNnVHlwZS5GaWxlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodXBsb2FkLmNhbmNlbGxlZCkgdGhyb3cgbmV3IFVwbG9hZENhbmNlbGVkRXJyb3IoKTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHVwbG9hZEZpbGUobWF0cml4Q2xpZW50LCByb29tSWQsIGZpbGUsIG9uUHJvZ3Jlc3MsIHVwbG9hZC5hYm9ydENvbnRyb2xsZXIpO1xuICAgICAgICAgICAgY29udGVudC5maWxlID0gcmVzdWx0LmZpbGU7XG4gICAgICAgICAgICBjb250ZW50LnVybCA9IHJlc3VsdC51cmw7XG5cbiAgICAgICAgICAgIGlmICh1cGxvYWQuY2FuY2VsbGVkKSB0aHJvdyBuZXcgVXBsb2FkQ2FuY2VsZWRFcnJvcigpO1xuICAgICAgICAgICAgLy8gQXdhaXQgcHJldmlvdXMgbWVzc2FnZSBiZWluZyBzZW50IGludG8gdGhlIHJvb21cbiAgICAgICAgICAgIGlmIChwcm9tQmVmb3JlKSBhd2FpdCBwcm9tQmVmb3JlO1xuXG4gICAgICAgICAgICBpZiAodXBsb2FkLmNhbmNlbGxlZCkgdGhyb3cgbmV3IFVwbG9hZENhbmNlbGVkRXJyb3IoKTtcbiAgICAgICAgICAgIGNvbnN0IHRocmVhZElkID0gcmVsYXRpb24/LnJlbF90eXBlID09PSBUSFJFQURfUkVMQVRJT05fVFlQRS5uYW1lID8gcmVsYXRpb24uZXZlbnRfaWQgOiBudWxsO1xuXG4gICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IG1hdHJpeENsaWVudC5zZW5kTWVzc2FnZShyb29tSWQsIHRocmVhZElkID8/IG51bGwsIGNvbnRlbnQpO1xuXG4gICAgICAgICAgICBpZiAoU2V0dGluZ3NTdG9yZS5nZXRWYWx1ZShcIlBlcmZvcm1hbmNlLmFkZFNlbmRNZXNzYWdlVGltaW5nTWV0YWRhdGFcIikpIHtcbiAgICAgICAgICAgICAgICBzZW5kUm91bmRUcmlwTWV0cmljKG1hdHJpeENsaWVudCwgcm9vbUlkLCByZXNwb25zZS5ldmVudF9pZCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGRpcy5kaXNwYXRjaDxVcGxvYWRGaW5pc2hlZFBheWxvYWQ+KHsgYWN0aW9uOiBBY3Rpb24uVXBsb2FkRmluaXNoZWQsIHVwbG9hZCB9KTtcbiAgICAgICAgICAgIGRpcy5kaXNwYXRjaCh7IGFjdGlvbjogXCJtZXNzYWdlX3NlbnRcIiB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIC8vIDQxMzogRmlsZSB3YXMgdG9vIGJpZyBvciB1cHNldCB0aGUgc2VydmVyIGluIHNvbWUgd2F5OlxuICAgICAgICAgICAgLy8gY2xlYXIgdGhlIG1lZGlhIHNpemUgbGltaXQgc28gd2UgZmV0Y2ggaXQgYWdhaW4gbmV4dCB0aW1lIHdlIHRyeSB0byB1cGxvYWRcbiAgICAgICAgICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEhUVFBFcnJvciAmJiBlcnJvci5odHRwU3RhdHVzID09PSA0MTMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLm1lZGlhQ29uZmlnID0gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCF1cGxvYWQuY2FuY2VsbGVkKSB7XG4gICAgICAgICAgICAgICAgbGV0IGRlc2MgPSBfdChcIlRoZSBmaWxlICclKGZpbGVOYW1lKXMnIGZhaWxlZCB0byB1cGxvYWQuXCIsIHsgZmlsZU5hbWU6IHVwbG9hZC5maWxlTmFtZSB9KTtcbiAgICAgICAgICAgICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBIVFRQRXJyb3IgJiYgZXJyb3IuaHR0cFN0YXR1cyA9PT0gNDEzKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlc2MgPSBfdChcIlRoZSBmaWxlICclKGZpbGVOYW1lKXMnIGV4Y2VlZHMgdGhpcyBob21lc2VydmVyJ3Mgc2l6ZSBsaW1pdCBmb3IgdXBsb2Fkc1wiLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxlTmFtZTogdXBsb2FkLmZpbGVOYW1lLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgTW9kYWwuY3JlYXRlRGlhbG9nKEVycm9yRGlhbG9nLCB7XG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiBfdChcIlVwbG9hZCBGYWlsZWRcIiksXG4gICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBkZXNjLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGRpcy5kaXNwYXRjaDxVcGxvYWRFcnJvclBheWxvYWQ+KHsgYWN0aW9uOiBBY3Rpb24uVXBsb2FkRmFpbGVkLCB1cGxvYWQsIGVycm9yIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgcmVtb3ZlRWxlbWVudCh0aGlzLmlucHJvZ3Jlc3MsIChlKSA9PiBlLnByb21pc2UgPT09IHVwbG9hZC5wcm9taXNlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgaXNGaWxlU2l6ZUFjY2VwdGFibGUoZmlsZTogRmlsZSk6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgICB0aGlzLm1lZGlhQ29uZmlnICE9PSBudWxsICYmXG4gICAgICAgICAgICB0aGlzLm1lZGlhQ29uZmlnW1wibS51cGxvYWQuc2l6ZVwiXSAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgICAgICBmaWxlLnNpemUgPiB0aGlzLm1lZGlhQ29uZmlnW1wibS51cGxvYWQuc2l6ZVwiXVxuICAgICAgICApIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGVuc3VyZU1lZGlhQ29uZmlnRmV0Y2hlZChtYXRyaXhDbGllbnQ6IE1hdHJpeENsaWVudCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBpZiAodGhpcy5tZWRpYUNvbmZpZyAhPT0gbnVsbCkgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuXG4gICAgICAgIGxvZ2dlci5sb2coXCJbTWVkaWEgQ29uZmlnXSBGZXRjaGluZ1wiKTtcbiAgICAgICAgcmV0dXJuIG1hdHJpeENsaWVudFxuICAgICAgICAgICAgLmdldE1lZGlhQ29uZmlnKClcbiAgICAgICAgICAgIC50aGVuKChjb25maWcpID0+IHtcbiAgICAgICAgICAgICAgICBsb2dnZXIubG9nKFwiW01lZGlhIENvbmZpZ10gRmV0Y2hlZCBjb25maWc6XCIsIGNvbmZpZyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbmZpZztcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuY2F0Y2goKCkgPT4ge1xuICAgICAgICAgICAgICAgIC8vIE1lZGlhIHJlcG8gY2FuJ3Qgb3Igd29uJ3QgcmVwb3J0IGxpbWl0cywgc28gcHJvdmlkZSBhbiBlbXB0eSBvYmplY3QgKG5vIGxpbWl0cykuXG4gICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhcIltNZWRpYSBDb25maWddIENvdWxkIG5vdCBmZXRjaCBjb25maWcsIHNvIG5vdCBsaW1pdGluZyB1cGxvYWRzLlwiKTtcbiAgICAgICAgICAgICAgICByZXR1cm4ge307XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLnRoZW4oKGNvbmZpZykgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMubWVkaWFDb25maWcgPSBjb25maWc7XG4gICAgICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgc3RhdGljIHNoYXJlZEluc3RhbmNlKCk6IENvbnRlbnRNZXNzYWdlcyB7XG4gICAgICAgIGlmICh3aW5kb3cubXhDb250ZW50TWVzc2FnZXMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgd2luZG93Lm14Q29udGVudE1lc3NhZ2VzID0gbmV3IENvbnRlbnRNZXNzYWdlcygpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB3aW5kb3cubXhDb250ZW50TWVzc2FnZXM7XG4gICAgfVxufVxuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFtQkEsSUFBQUEsTUFBQSxHQUFBQyxPQUFBO0FBQ0EsSUFBQUMsd0JBQUEsR0FBQUMsc0JBQUEsQ0FBQUYsT0FBQTtBQUNBLElBQUFHLGlCQUFBLEdBQUFELHNCQUFBLENBQUFGLE9BQUE7QUFFQSxJQUFBSSxPQUFBLEdBQUFKLE9BQUE7QUFDQSxJQUFBSyxPQUFBLEdBQUFMLE9BQUE7QUFRQSxJQUFBTSxPQUFB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