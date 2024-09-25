"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createVoiceMessageRecording = exports.VoiceMessageRecording = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _ContentMessages = require("../ContentMessages");
var _arrays = require("../utils/arrays");
var _Singleflight = require("../utils/Singleflight");
var _Playback = require("./Playback");
var _VoiceRecording = require("./VoiceRecording");
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

/**
 * This class can be used to record a single voice message.
 */
class VoiceMessageRecording {
  constructor(matrixClient, voiceRecording) {
    this.matrixClient = matrixClient;
    this.voiceRecording = voiceRecording;
    (0, _defineProperty2.default)(this, "lastUpload", void 0);
    (0, _defineProperty2.default)(this, "buffer", new Uint8Array(0));
    // use this.audioBuffer to access
    (0, _defineProperty2.default)(this, "playback", void 0);
    (0, _defineProperty2.default)(this, "onDataAvailable", data => {
      const buf = new Uint8Array(data);
      this.buffer = (0, _arrays.concat)(this.buffer, buf);
    });
    this.voiceRecording.onDataAvailable = this.onDataAvailable;
  }
  async start() {
    if (this.lastUpload || this.hasRecording) {
      throw new Error("Recording already prepared");
    }
    return this.voiceRecording.start();
  }
  async stop() {
    await this.voiceRecording.stop();
    return this.audioBuffer;
  }
  on(event, listener) {
    this.voiceRecording.on(event, listener);
    return this;
  }
  off(event, listener) {
    this.voiceRecording.off(event, listener);
    return this;
  }
  emit(event) {
    for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }
    return this.voiceRecording.emit(event, ...args);
  }
  get hasRecording() {
    return this.buffer.length > 0;
  }
  get isRecording() {
    return this.voiceRecording.isRecording;
  }

  /**
   * Gets a playback instance for this voice recording. Note that the playback will not
   * have been prepared fully, meaning the `prepare()` function needs to be called on it.
   *
   * The same playback instance is returned each time.
   *
   * @returns {Playback} The playback instance.
   */
  getPlayback() {
    this.playback = _Singleflight.Singleflight.for(this, "playback").do(() => {
      return new _Playback.Playback(this.audioBuffer.buffer, this.voiceRecording.amplitudes); // cast to ArrayBuffer proper;
    });

    return this.playback;
  }
  async upload(inRoomId) {
    if (!this.hasRecording) {
      throw new Error("No recording available to upload");
    }
    if (this.lastUpload) return this.lastUpload;
    try {
      this.emit(_VoiceRecording.RecordingState.Uploading);
      const {
        url: mxc,
        file: encrypted
      } = await (0, _ContentMessages.uploadFile)(this.matrixClient, inRoomId, new Blob([this.audioBuffer], {
        type: this.contentType
      }));
      this.lastUpload = {
        mxc,
        encrypted
      };
      this.emit(_VoiceRecording.RecordingState.Uploaded);
    } catch (e) {
      this.emit(_VoiceRecording.RecordingState.Ended);
      throw e;
    }
    return this.lastUpload;
  }
  get durationSeconds() {
    return this.voiceRecording.durationSeconds;
  }
  get contentType() {
    return this.voiceRecording.contentType;
  }
  get contentLength() {
    return this.buffer.length;
  }
  get liveData() {
    return this.voiceRecording.liveData;
  }
  get isSupported() {
    return this.voiceRecording.isSupported;
  }
  destroy() {
    this.playback?.destroy();
    this.voiceRecording.destroy();
  }
  get audioBuffer() {
    // We need a clone of the buffer to avoid accidentally changing the position
    // on the real thing.
    return this.buffer.slice(0);
  }
}
exports.VoiceMessageRecording = VoiceMessageRecording;
const createVoiceMessageRecording = matrixClient => {
  return new VoiceMessageRecording(matrixClient, new _VoiceRecording.VoiceRecording());
};
exports.createVoiceMessageRecording = createVoiceMessageRecording;
//# sourceMappingURL=VoiceMessageRecording.js.map