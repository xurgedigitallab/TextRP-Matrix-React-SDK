"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createVoiceBroadcastRecorder = exports.VoiceBroadcastRecorderEvent = exports.VoiceBroadcastRecorder = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _lodash = require("lodash");
var _logger = require("matrix-js-sdk/src/logger");
var _typedEventEmitter = require("matrix-js-sdk/src/models/typed-event-emitter");
var _ = require("..");
var _VoiceRecording = require("../../audio/VoiceRecording");
var _arrays = require("../../utils/arrays");
var _Singleflight = require("../../utils/Singleflight");
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
let VoiceBroadcastRecorderEvent = /*#__PURE__*/function (VoiceBroadcastRecorderEvent) {
  VoiceBroadcastRecorderEvent["ChunkRecorded"] = "chunk_recorded";
  VoiceBroadcastRecorderEvent["CurrentChunkLengthUpdated"] = "current_chunk_length_updated";
  return VoiceBroadcastRecorderEvent;
}({});
exports.VoiceBroadcastRecorderEvent = VoiceBroadcastRecorderEvent;
// char sequence of "OpusHead"
const OpusHead = [79, 112, 117, 115, 72, 101, 97, 100];

// char sequence of "OpusTags"
const OpusTags = [79, 112, 117, 115, 84, 97, 103, 115];

/**
 * This class provides the function to seamlessly record fixed length chunks.
 * Subscribe with on(VoiceBroadcastRecordingEvents.ChunkRecorded, (payload: ChunkRecordedPayload) => {})
 * to retrieve chunks while recording.
 */
class VoiceBroadcastRecorder extends _typedEventEmitter.TypedEventEmitter {
  constructor(voiceRecording, targetChunkLength) {
    super();
    this.voiceRecording = voiceRecording;
    this.targetChunkLength = targetChunkLength;
    (0, _defineProperty2.default)(this, "opusHead", void 0);
    (0, _defineProperty2.default)(this, "opusTags", void 0);
    (0, _defineProperty2.default)(this, "chunkBuffer", new Uint8Array(0));
    // position of the previous chunk in seconds
    (0, _defineProperty2.default)(this, "previousChunkEndTimePosition", 0);
    // current chunk length in seconds
    (0, _defineProperty2.default)(this, "currentChunkLength", 0);
    (0, _defineProperty2.default)(this, "onDataAvailable", data => {
      const dataArray = new Uint8Array(data);

      // extract the part, that contains the header type info
      const headerType = Array.from(dataArray.slice(28, 36));
      if ((0, _lodash.isEqual)(OpusHead, headerType)) {
        // data seems to be an "OpusHead" header
        this.opusHead = dataArray;
        return;
      }
      if ((0, _lodash.isEqual)(OpusTags, headerType)) {
        // data seems to be an "OpusTags" header
        this.opusTags = dataArray;
        return;
      }
      this.setCurrentChunkLength(this.voiceRecording.recorderSeconds - this.previousChunkEndTimePosition);
      this.handleData(dataArray);
    });
    this.voiceRecording.onDataAvailable = this.onDataAvailable;
  }
  async start() {
    await this.voiceRecording.start();
    this.voiceRecording.liveData.onUpdate(data => {
      this.setCurrentChunkLength(data.timeSeconds - this.previousChunkEndTimePosition);
    });
  }

  /**
   * Stops the recording and returns the remaining chunk (if any).
   */
  async stop() {
    try {
      await this.voiceRecording.stop();
    } catch (e) {
      // Ignore if the recording raises any error.
    }

    // forget about that call, so that we can stop it again later
    _Singleflight.Singleflight.forgetAllFor(this.voiceRecording);
    const chunk = this.extractChunk();
    this.currentChunkLength = 0;
    this.previousChunkEndTimePosition = 0;
    return chunk;
  }
  get contentType() {
    return this.voiceRecording.contentType;
  }
  setCurrentChunkLength(currentChunkLength) {
    if (this.currentChunkLength === currentChunkLength) return;
    this.currentChunkLength = currentChunkLength;
    this.emit(VoiceBroadcastRecorderEvent.CurrentChunkLengthUpdated, currentChunkLength);
  }
  getCurrentChunkLength() {
    return this.currentChunkLength;
  }
  handleData(data) {
    this.chunkBuffer = (0, _arrays.concat)(this.chunkBuffer, data);
    this.emitChunkIfTargetLengthReached();
  }
  emitChunkIfTargetLengthReached() {
    if (this.getCurrentChunkLength() >= this.targetChunkLength) {
      this.emitAndResetChunk();
    }
  }

  /**
   * Extracts the current chunk and resets the buffer.
   */
  extractChunk() {
    if (this.chunkBuffer.length === 0) {
      return null;
    }
    if (!this.opusHead || !this.opusTags) {
      _logger.logger.warn("Broadcast chunk cannot be extracted. OpusHead or OpusTags is missing.");
      return null;
    }
    const currentRecorderTime = this.voiceRecording.recorderSeconds;
    const payload = {
      buffer: (0, _arrays.concat)(this.opusHead, this.opusTags, this.chunkBuffer),
      length: this.getCurrentChunkLength()
    };
    this.chunkBuffer = new Uint8Array(0);
    this.setCurrentChunkLength(0);
    this.previousChunkEndTimePosition = currentRecorderTime;
    return payload;
  }
  emitAndResetChunk() {
    if (this.chunkBuffer.length === 0) {
      return;
    }
    this.emit(VoiceBroadcastRecorderEvent.ChunkRecorded, this.extractChunk());
  }
  destroy() {
    this.removeAllListeners();
    this.voiceRecording.destroy();
  }
}
exports.VoiceBroadcastRecorder = VoiceBroadcastRecorder;
const createVoiceBroadcastRecorder = () => {
  const voiceRecording = new _VoiceRecording.VoiceRecording();
  voiceRecording.disableMaxLength();
  return new VoiceBroadcastRecorder(voiceRecording, (0, _.getChunkLength)());
};
exports.createVoiceBroadcastRecorder = createVoiceBroadcastRecorder;
//# sourceMappingURL=VoiceBroadcastRecorder.js.map