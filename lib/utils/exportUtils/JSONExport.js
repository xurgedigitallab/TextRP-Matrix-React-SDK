"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _event = require("matrix-js-sdk/src/@types/event");
var _logger = require("matrix-js-sdk/src/logger");
var _Exporter = _interopRequireDefault(require("./Exporter"));
var _DateUtils = require("../../DateUtils");
var _languageHandler = require("../../languageHandler");
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

class JSONExporter extends _Exporter.default {
  constructor(room, exportType, exportOptions, setProgressText) {
    super(room, exportType, exportOptions, setProgressText);
    (0, _defineProperty2.default)(this, "totalSize", 0);
    (0, _defineProperty2.default)(this, "messages", []);
  }
  get destinationFileName() {
    return this.makeFileNameNoExtension() + ".json";
  }
  createJSONString() {
    const exportDate = (0, _DateUtils.formatFullDateNoDayNoTime)(new Date());
    const creator = this.room.currentState.getStateEvents(_event.EventType.RoomCreate, "")?.getSender();
    const creatorName = creator && this.room?.getMember(creator)?.rawDisplayName || creator;
    const topic = this.room.currentState.getStateEvents(_event.EventType.RoomTopic, "")?.getContent()?.topic || "";
    const exporter = this.room.client.getUserId();
    const exporterName = this.room?.getMember(exporter)?.rawDisplayName || exporter;
    const jsonObject = {
      room_name: this.room.name,
      room_creator: creatorName,
      topic,
      export_date: exportDate,
      exported_by: exporterName,
      messages: this.messages
    };
    return JSON.stringify(jsonObject, null, 2);
  }
  async getJSONString(mxEv) {
    if (this.exportOptions.attachmentsIncluded && this.isAttachment(mxEv)) {
      try {
        const blob = await this.getMediaBlob(mxEv);
        if (this.totalSize + blob.size < this.exportOptions.maxSize) {
          this.totalSize += blob.size;
          const filePath = this.getFilePath(mxEv);
          if (this.totalSize == this.exportOptions.maxSize) {
            this.exportOptions.attachmentsIncluded = false;
          }
          this.addFile(filePath, blob);
        }
      } catch (err) {
        _logger.logger.log("Error fetching file: " + err);
      }
    }
    const jsonEvent = mxEv.toJSON();
    const clearEvent = mxEv.isEncrypted() ? jsonEvent.decrypted : jsonEvent;
    return clearEvent;
  }
  async createOutput(events) {
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      this.updateProgress((0, _languageHandler._t)("Processing event %(number)s out of %(total)s", {
        number: i + 1,
        total: events.length
      }), false, true);
      if (this.cancelled) return this.cleanUp();
      if (!(0, _EventTileFactory.haveRendererForEvent)(event, false)) continue;
      this.messages.push(await this.getJSONString(event));
    }
    return this.createJSONString();
  }
  async export() {
    _logger.logger.info("Starting export process...");
    _logger.logger.info("Fetching events...");
    const fetchStart = performance.now();
    const res = await this.getRequiredEvents();
    const fetchEnd = performance.now();
    _logger.logger.log(`Fetched ${res.length} events in ${(fetchEnd - fetchStart) / 1000}s`);
    _logger.logger.info("Creating output...");
    const text = await this.createOutput(res);
    if (this.files.length) {
      this.addFile("export.json", new Blob([text]));
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
exports.default = JSONExporter;
//# sourceMappingURL=JSONExport.js.map