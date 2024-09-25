"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getConfigLivestreamUrl = getConfigLivestreamUrl;
exports.startJitsiAudioLivestream = startJitsiAudioLivestream;
var _SdkConfig = _interopRequireDefault(require("./SdkConfig"));
var _ElementWidgetActions = require("./stores/widgets/ElementWidgetActions");
/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

function getConfigLivestreamUrl() {
  return _SdkConfig.default.get("audio_stream_url");
}

// Dummy rtmp URL used to signal that we want a special audio-only stream
const AUDIOSTREAM_DUMMY_URL = "rtmp://audiostream.dummy/";
async function createLiveStream(matrixClient, roomId) {
  const openIdToken = await matrixClient.getOpenIdToken();
  const url = getConfigLivestreamUrl() + "/createStream";
  const response = await window.fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      room_id: roomId,
      openid_token: openIdToken
    })
  });
  const respBody = await response.json();
  return respBody["stream_id"];
}
async function startJitsiAudioLivestream(matrixClient, widgetMessaging, roomId) {
  const streamId = await createLiveStream(matrixClient, roomId);
  await widgetMessaging.transport.send(_ElementWidgetActions.ElementWidgetActions.StartLiveStream, {
    rtmpStreamKey: AUDIOSTREAM_DUMMY_URL + streamId
  });
}
//# sourceMappingURL=Livestream.js.map