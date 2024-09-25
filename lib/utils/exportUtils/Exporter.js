"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _eventTimeline = require("matrix-js-sdk/src/models/event-timeline");
var _fileSaver = require("file-saver");
var _logger = require("matrix-js-sdk/src/logger");
var _sanitizeFilename = _interopRequireDefault(require("sanitize-filename"));
var _exportUtils = require("./exportUtils");
var _DecryptFile = require("../DecryptFile");
var _Media = require("../../customisations/Media");
var _DateUtils = require("../../DateUtils");
var _EventUtils = require("../EventUtils");
var _languageHandler = require("../../languageHandler");
var _SdkConfig = _interopRequireDefault(require("../../SdkConfig"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     Copyright 2021 - 2022 The Matrix.org Foundation C.I.C.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     
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
class Exporter {
  constructor(room, exportType, exportOptions, setProgressText) {
    this.room = room;
    this.exportType = exportType;
    this.exportOptions = exportOptions;
    this.setProgressText = setProgressText;
    (0, _defineProperty2.default)(this, "files", []);
    (0, _defineProperty2.default)(this, "cancelled", false);
    if (exportOptions.maxSize < 1 * 1024 * 1024 ||
    // Less than 1 MB
    exportOptions.maxSize > 8000 * 1024 * 1024 ||
    // More than 8 GB
    !!exportOptions.numberOfMessages && exportOptions.numberOfMessages > 10 ** 8 || exportType === _exportUtils.ExportType.LastNMessages && !exportOptions.numberOfMessages) {
      throw new Error("Invalid export options");
    }
    window.addEventListener("beforeunload", this.onBeforeUnload);
  }
  get destinationFileName() {
    return this.makeFileNameNoExtension(_SdkConfig.default.get().brand) + ".zip";
  }
  onBeforeUnload(e) {
    e.preventDefault();
    return e.returnValue = (0, _languageHandler._t)("Are you sure you want to exit during this export?");
  }
  updateProgress(progress) {
    let log = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
    let show = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
    if (log) _logger.logger.log(progress);
    if (show) this.setProgressText(progress);
  }
  addFile(filePath, blob) {
    const file = {
      name: filePath,
      blob
    };
    this.files.push(file);
  }
  makeFileNameNoExtension() {
    let brand = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "matrix";
    // First try to use the real name of the room, then a translated copy of a generic name,
    // then finally hardcoded default to guarantee we'll have a name.
    const safeRoomName = (0, _sanitizeFilename.default)(this.room.name ?? (0, _languageHandler._t)("Unnamed Room")).trim() || "Unnamed Room";
    const safeDate = (0, _DateUtils.formatFullDateNoDayISO)(new Date()).replace(/:/g, "-"); // ISO format automatically removes a lot of stuff for us
    const safeBrand = (0, _sanitizeFilename.default)(brand);
    return `${safeBrand} - ${safeRoomName} - Chat Export - ${safeDate}`;
  }
  async downloadZIP() {
    const filename = this.destinationFileName;
    const filenameWithoutExt = filename.substring(0, filename.lastIndexOf(".")); // take off the extension
    const {
      default: JSZip
    } = await Promise.resolve().then(() => _interopRequireWildcard(require("jszip")));
    const zip = new JSZip();
    // Create a writable stream to the directory
    if (!this.cancelled) this.updateProgress((0, _languageHandler._t)("Generating a ZIP"));else return this.cleanUp();
    for (const file of this.files) zip.file(filenameWithoutExt + "/" + file.name, file.blob);
    const content = await zip.generateAsync({
      type: "blob"
    });
    (0, _fileSaver.saveAs)(content, filenameWithoutExt + ".zip");
  }
  cleanUp() {
    _logger.logger.log("Cleaning up...");
    window.removeEventListener("beforeunload", this.onBeforeUnload);
    return "";
  }
  async cancelExport() {
    _logger.logger.log("Cancelling export...");
    this.cancelled = true;
  }
  downloadPlainText(fileName, text) {
    const content = new Blob([text], {
      type: "text/plain"
    });
    (0, _fileSaver.saveAs)(content, fileName);
  }
  setEventMetadata(event) {
    const roomState = this.room.currentState;
    const sender = event.getSender();
    event.sender = !!sender && roomState?.getSentinelMember(sender) || null;
    if (event.getType() === "m.room.member") {
      event.target = roomState?.getSentinelMember(event.getStateKey()) ?? null;
    }
    return event;
  }
  getLimit() {
    let limit;
    switch (this.exportType) {
      case _exportUtils.ExportType.LastNMessages:
        // validated in constructor that numberOfMessages is defined
        // when export type is LastNMessages
        limit = this.exportOptions.numberOfMessages;
        break;
      case _exportUtils.ExportType.Timeline:
        limit = 40;
        break;
      default:
        limit = 10 ** 8;
    }
    return limit;
  }
  async getRequiredEvents() {
    const eventMapper = this.room.client.getEventMapper();
    let prevToken = null;
    let limit = this.getLimit();
    const events = [];
    while (limit) {
      const eventsPerCrawl = Math.min(limit, 1000);
      const res = await this.room.client.createMessagesRequest(this.room.roomId, prevToken, eventsPerCrawl, _eventTimeline.Direction.Backward);
      if (this.cancelled) {
        this.cleanUp();
        return [];
      }
      if (res.chunk.length === 0) break;
      limit -= res.chunk.length;
      const matrixEvents = res.chunk.map(eventMapper);
      for (const mxEv of matrixEvents) {
        // if (this.exportOptions.startDate && mxEv.getTs() < this.exportOptions.startDate) {
        //     // Once the last message received is older than the start date, we break out of both the loops
        //     limit = 0;
        //     break;
        // }
        events.push(mxEv);
      }
      if (this.exportType === _exportUtils.ExportType.LastNMessages) {
        this.updateProgress((0, _languageHandler._t)("Fetched %(count)s events out of %(total)s", {
          count: events.length,
          total: this.exportOptions.numberOfMessages
        }));
      } else {
        this.updateProgress((0, _languageHandler._t)("Fetched %(count)s events so far", {
          count: events.length
        }));
      }
      prevToken = res.end ?? null;
    }
    // Reverse the events so that we preserve the order
    for (let i = 0; i < Math.floor(events.length / 2); i++) {
      [events[i], events[events.length - i - 1]] = [events[events.length - i - 1], events[i]];
    }
    const decryptionPromises = events.filter(event => event.isEncrypted()).map(event => {
      return this.room.client.decryptEventIfNeeded(event, {
        isRetry: true,
        emit: false
      });
    });

    // Wait for all the events to get decrypted.
    await Promise.all(decryptionPromises);
    for (let i = 0; i < events.length; i++) this.setEventMetadata(events[i]);
    return events;
  }

  /**
   * Decrypts if necessary, and fetches media from a matrix event
   * @param event - matrix event with media event content
   * @resolves when media has been fetched
   * @throws if media was unable to be fetched
   */
  async getMediaBlob(event) {
    let blob = undefined;
    try {
      const isEncrypted = event.isEncrypted();
      const content = event.getContent();
      const shouldDecrypt = isEncrypted && content.hasOwnProperty("file") && event.getType() !== "m.sticker";
      if (shouldDecrypt) {
        blob = await (0, _DecryptFile.decryptFile)(content.file);
      } else {
        const media = (0, _Media.mediaFromContent)(content);
        if (!media.srcHttp) {
          throw new Error("Cannot fetch without srcHttp");
        }
        const image = await fetch(media.srcHttp);
        blob = await image.blob();
      }
    } catch (err) {
      _logger.logger.log("Error decrypting media");
    }
    if (!blob) {
      throw new Error("Unable to fetch file");
    }
    return blob;
  }
  splitFileName(file) {
    const lastDot = file.lastIndexOf(".");
    if (lastDot === -1) return [file, ""];
    const fileName = file.slice(0, lastDot);
    const ext = file.slice(lastDot + 1);
    return [fileName, "." + ext];
  }
  getFilePath(event) {
    const mediaType = event.getContent().msgtype;
    let fileDirectory;
    switch (mediaType) {
      case "m.image":
        fileDirectory = "images";
        break;
      case "m.video":
        fileDirectory = "videos";
        break;
      case "m.audio":
        fileDirectory = "audio";
        break;
      default:
        fileDirectory = event.getType() === "m.sticker" ? "stickers" : "files";
    }
    const fileDate = (0, _DateUtils.formatFullDateNoDay)(new Date(event.getTs()));
    let [fileName, fileExt] = this.splitFileName(event.getContent().body);
    if (event.getType() === "m.sticker") fileExt = ".png";
    if ((0, _EventUtils.isVoiceMessage)(event)) fileExt = ".ogg";
    return fileDirectory + "/" + fileName + "-" + fileDate + fileExt;
  }
  isReply(event) {
    const isEncrypted = event.isEncrypted();
    // If encrypted, in_reply_to lies in event.event.content
    const content = isEncrypted ? event.event.content : event.getContent();
    const relatesTo = content["m.relates_to"];
    return !!(relatesTo && relatesTo["m.in_reply_to"]);
  }
  isAttachment(mxEv) {
    const attachmentTypes = ["m.sticker", "m.image", "m.file", "m.video", "m.audio"];
    return mxEv.getType() === attachmentTypes[0] || attachmentTypes.includes(mxEv.getContent().msgtype);
  }
}
exports.default = Exporter;
//# sourceMappingURL=Exporter.js.map