"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _logger = require("matrix-js-sdk/src/logger");
var _Exporter = _interopRequireDefault(require("./Exporter"));
var _languageHandler = require("../../languageHandler");
var _TextForEvent = require("../../TextForEvent");
var _EventTileFactory = require("../../events/EventTileFactory");
/*
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

class PlainTextExporter extends _Exporter.default {
  constructor(room, exportType, exportOptions, setProgressText) {
    super(room, exportType, exportOptions, setProgressText);
    (0, _defineProperty2.default)(this, "totalSize", void 0);
    (0, _defineProperty2.default)(this, "mediaOmitText", void 0);
    (0, _defineProperty2.default)(this, "textForReplyEvent", content => {
      const REPLY_REGEX = /> <(.*?)>(.*?)\n\n(.*)/s;
      const REPLY_SOURCE_MAX_LENGTH = 32;
      const match = REPLY_REGEX.exec(content.body);

      // if the reply format is invalid, then return the body
      if (!match) return content.body;
      let rplSource;
      const rplName = match[1];
      const rplText = match[3];
      rplSource = match[2].substring(1);
      // Get the first non-blank line from the source.
      const lines = rplSource.split("\n").filter(line => !/^\s*$/.test(line));
      if (lines.length > 0) {
        // Cut to a maximum length.
        rplSource = lines[0].substring(0, REPLY_SOURCE_MAX_LENGTH);
        // Ellipsis if needed.
        if (lines[0].length > REPLY_SOURCE_MAX_LENGTH) {
          rplSource = rplSource + "...";
        }
        // Wrap in formatting
        rplSource = ` "${rplSource}"`;
      } else {
        // Don't show a source because we couldn't format one.
        rplSource = "";
      }
      return `<${rplName}${rplSource}> ${rplText}`;
    });
    (0, _defineProperty2.default)(this, "plainTextForEvent", async mxEv => {
      const senderDisplayName = mxEv.sender && mxEv.sender.name ? mxEv.sender.name : mxEv.getSender();
      let mediaText = "";
      if (this.isAttachment(mxEv)) {
        if (this.exportOptions.attachmentsIncluded) {
          try {
            const blob = await this.getMediaBlob(mxEv);
            if (this.totalSize + blob.size > this.exportOptions.maxSize) {
              mediaText = ` (${this.mediaOmitText})`;
            } else {
              this.totalSize += blob.size;
              const filePath = this.getFilePath(mxEv);
              mediaText = " (" + (0, _languageHandler._t)("File Attached") + ")";
              this.addFile(filePath, blob);
              if (this.totalSize == this.exportOptions.maxSize) {
                this.exportOptions.attachmentsIncluded = false;
              }
            }
          } catch (error) {
            mediaText = " (" + (0, _languageHandler._t)("Error fetching file") + ")";
            _logger.logger.log("Error fetching file " + error);
          }
        } else mediaText = ` (${this.mediaOmitText})`;
      }
      if (this.isReply(mxEv)) return senderDisplayName + ": " + this.textForReplyEvent(mxEv.getContent()) + mediaText;else return (0, _TextForEvent.textForEvent)(mxEv, this.room.client) + mediaText;
    });
    this.totalSize = 0;
    this.mediaOmitText = !this.exportOptions.attachmentsIncluded ? (0, _languageHandler._t)("Media omitted") : (0, _languageHandler._t)("Media omitted - file size limit exceeded");
  }
  get destinationFileName() {
    return this.makeFileNameNoExtension() + ".txt";
  }
  async createOutput(events) {
    let content = "";
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      this.updateProgress((0, _languageHandler._t)("Processing event %(number)s out of %(total)s", {
        number: i + 1,
        total: events.length
      }), false, true);
      if (this.cancelled) return this.cleanUp();
      if (!(0, _EventTileFactory.haveRendererForEvent)(event, false)) continue;
      const textForEvent = await this.plainTextForEvent(event);
      content += textForEvent && `${new Date(event.getTs()).toLocaleString()} - ${textForEvent}\n`;
    }
    return content;
  }
  async export() {
    this.updateProgress((0, _languageHandler._t)("Starting export process…"));
    this.updateProgress((0, _languageHandler._t)("Fetching events…"));
    const fetchStart = performance.now();
    const res = await this.getRequiredEvents();
    const fetchEnd = performance.now();
    _logger.logger.log(`Fetched ${res.length} events in ${(fetchEnd - fetchStart) / 1000}s`);
    this.updateProgress((0, _languageHandler._t)("Creating output…"));
    const text = await this.createOutput(res);
    if (this.files.length) {
      this.addFile("export.txt", new Blob([text]));
      await this.downloadZIP();
    } else {
      const fileName = this.destinationFileName;
      this.downloadPlainText(fileName, text);
    }
    const exportEnd = performance.now();
    if (this.cancelled) {
      _logger.logger.info("Export cancelled successfully");
    } else {
      _logger.logger.info("Export successful!");
      _logger.logger.log(`Exported ${res.length} events in ${(exportEnd - fetchStart) / 1000} seconds`);
    }
    this.cleanUp();
  }
}
exports.default = PlainTextExporter;
//# sourceMappingURL=PlainTextExport.js.map