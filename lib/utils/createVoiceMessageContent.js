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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfbWF0cml4IiwicmVxdWlyZSIsImNyZWF0ZVZvaWNlTWVzc2FnZUNvbnRlbnQiLCJteGMiLCJtaW1ldHlwZSIsImR1cmF0aW9uIiwic2l6ZSIsImZpbGUiLCJ3YXZlZm9ybSIsIk1zZ1R5cGUiLCJBdWRpbyIsInVybCIsIm5hbWUiLCJleHBvcnRzIl0sInNvdXJjZXMiOlsiLi4vLi4vc3JjL3V0aWxzL2NyZWF0ZVZvaWNlTWVzc2FnZUNvbnRlbnQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbkNvcHlyaWdodCAyMDIyIFRoZSBNYXRyaXgub3JnIEZvdW5kYXRpb24gQy5JLkMuXG5cbkxpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG55b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG5Zb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcblxuICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuXG5Vbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG5kaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG5XSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cblNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbmxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuKi9cblxuaW1wb3J0IHsgSUNvbnRlbnQsIElFbmNyeXB0ZWRGaWxlLCBNc2dUeXBlIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL21hdHJpeFwiO1xuXG4vKipcbiAqIEBwYXJhbSB7c3RyaW5nfSBteGMgTVhDIFVSTCBvZiB0aGUgZmlsZVxuICogQHBhcmFtIHtzdHJpbmd9IG1pbWV0eXBlXG4gKiBAcGFyYW0ge251bWJlcn0gZHVyYXRpb24gRHVyYXRpb24gaW4gbWlsbGlzZWNvbmRzXG4gKiBAcGFyYW0ge251bWJlcn0gc2l6ZVxuICogQHBhcmFtIHtudW1iZXJbXX0gW3dhdmVmb3JtXVxuICogQHBhcmFtIHtJRW5jcnlwdGVkRmlsZX0gW2ZpbGVdIEVuY3J5cHRlZCBmaWxlXG4gKi9cbmV4cG9ydCBjb25zdCBjcmVhdGVWb2ljZU1lc3NhZ2VDb250ZW50ID0gKFxuICAgIG14Yzogc3RyaW5nIHwgdW5kZWZpbmVkLFxuICAgIG1pbWV0eXBlOiBzdHJpbmcsXG4gICAgZHVyYXRpb246IG51bWJlcixcbiAgICBzaXplOiBudW1iZXIsXG4gICAgZmlsZT86IElFbmNyeXB0ZWRGaWxlLFxuICAgIHdhdmVmb3JtPzogbnVtYmVyW10sXG4pOiBJQ29udGVudCA9PiB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgXCJib2R5XCI6IFwiVm9pY2UgbWVzc2FnZVwiLFxuICAgICAgICAvL1wibXNndHlwZVwiOiBcIm9yZy5tYXRyaXgubXNjMjUxNi52b2ljZVwiLFxuICAgICAgICBcIm1zZ3R5cGVcIjogTXNnVHlwZS5BdWRpbyxcbiAgICAgICAgXCJ1cmxcIjogbXhjLFxuICAgICAgICBcImZpbGVcIjogZmlsZSxcbiAgICAgICAgXCJpbmZvXCI6IHtcbiAgICAgICAgICAgIGR1cmF0aW9uLFxuICAgICAgICAgICAgbWltZXR5cGUsXG4gICAgICAgICAgICBzaXplLFxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIE1TQzE3NjcgKyBJZGVhbHMgb2YgTVNDMjUxNiBhcyBNU0MzMjQ1XG4gICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9tYXRyaXgtb3JnL21hdHJpeC1kb2MvcHVsbC8zMjQ1XG4gICAgICAgIFwib3JnLm1hdHJpeC5tc2MxNzY3LnRleHRcIjogXCJWb2ljZSBtZXNzYWdlXCIsXG4gICAgICAgIFwib3JnLm1hdHJpeC5tc2MxNzY3LmZpbGVcIjoge1xuICAgICAgICAgICAgdXJsOiBteGMsXG4gICAgICAgICAgICBmaWxlLFxuICAgICAgICAgICAgbmFtZTogXCJWb2ljZSBtZXNzYWdlLm9nZ1wiLFxuICAgICAgICAgICAgbWltZXR5cGUsXG4gICAgICAgICAgICBzaXplLFxuICAgICAgICB9LFxuICAgICAgICBcIm9yZy5tYXRyaXgubXNjMTc2Ny5hdWRpb1wiOiB7XG4gICAgICAgICAgICBkdXJhdGlvbixcbiAgICAgICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9tYXRyaXgtb3JnL21hdHJpeC1kb2MvcHVsbC8zMjQ2XG4gICAgICAgICAgICB3YXZlZm9ybSxcbiAgICAgICAgfSxcbiAgICAgICAgXCJvcmcubWF0cml4Lm1zYzMyNDUudm9pY2VcIjoge30sIC8vIE5vIGNvbnRlbnQsIHRoaXMgaXMgYSByZW5kZXJpbmcgaGludFxuICAgIH07XG59O1xuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFnQkEsSUFBQUEsT0FBQSxHQUFBQyxPQUFBO0FBaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMseUJBQXlCLEdBQUdBLENBQ3JDQyxHQUF1QixFQUN2QkMsUUFBZ0IsRUFDaEJDLFFBQWdCLEVBQ2hCQyxJQUFZLEVBQ1pDLElBQXFCLEVBQ3JCQyxRQUFtQixLQUNSO0VBQ1gsT0FBTztJQUNILE1BQU0sRUFBRSxlQUFlO0lBQ3ZCO0lBQ0EsU0FBUyxFQUFFQyxlQUFPLENBQUNDLEtBQUs7SUFDeEIsS0FBSyxFQUFFUCxHQUFHO0lBQ1YsTUFBTSxFQUFFSSxJQUFJO0lBQ1osTUFBTSxFQUFFO01BQ0pGLFFBQVE7TUFDUkQsUUFBUTtNQUNSRTtJQUNKLENBQUM7SUFFRDtJQUNBO0lBQ0EseUJBQXlCLEVBQUUsZUFBZTtJQUMxQyx5QkFBeUIsRUFBRTtNQUN2QkssR0FBRyxFQUFFUixHQUFHO01BQ1JJLElBQUk7TUFDSkssSUFBSSxFQUFFLG1CQUFtQjtNQUN6QlIsUUFBUTtNQUNSRTtJQUNKLENBQUM7SUFDRCwwQkFBMEIsRUFBRTtNQUN4QkQsUUFBUTtNQUNSO01BQ0FHO0lBQ0osQ0FBQztJQUNELDBCQUEwQixFQUFFLENBQUMsQ0FBQyxDQUFFO0VBQ3BDLENBQUM7QUFDTCxDQUFDO0FBQUNLLE9BQUEsQ0FBQVgseUJBQUEsR0FBQUEseUJBQUEifQ==