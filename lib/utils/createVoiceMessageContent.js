"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createVoiceMessageContent = void 0;
var _matrix = require("matrix-js-sdk/src/matrix");
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
 * @param {string} mxc MXC URL of the file
 * @param {string} mimetype
 * @param {number} duration Duration in milliseconds
 * @param {number} size
 * @param {number[]} [waveform]
 * @param {IEncryptedFile} [file] Encrypted file
 */
const createVoiceMessageContent = (mxc, mimetype, duration, size, file, waveform) => {
  return {
    "body": "Voice message",
    //"msgtype": "org.matrix.msc2516.voice",
    "msgtype": _matrix.MsgType.Audio,
    "url": mxc,
    "file": file,
    "info": {
      duration,
      mimetype,
      size
    },
    // MSC1767 + Ideals of MSC2516 as MSC3245
    // https://github.com/matrix-org/matrix-doc/pull/3245
    "org.matrix.msc1767.text": "Voice message",
    "org.matrix.msc1767.file": {
      url: mxc,
      file,
      name: "Voice message.ogg",
      mimetype,
      size
    },
    "org.matrix.msc1767.audio": {
      duration,
      // https://github.com/matrix-org/matrix-doc/pull/3246
      waveform
    },
    "org.matrix.msc3245.voice": {} // No content, this is a rendering hint
  };
};
exports.createVoiceMessageContent = createVoiceMessageContent;
//# sourceMappingURL=createVoiceMessageContent.js.map