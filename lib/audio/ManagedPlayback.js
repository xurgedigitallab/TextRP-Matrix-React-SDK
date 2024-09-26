"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ManagedPlayback = void 0;
var _Playback = require("./Playback");
var _consts = require("./consts");
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

/**
 * A managed playback is a Playback instance that is guided by a PlaybackManager.
 */
class ManagedPlayback extends _Playback.Playback {
  constructor(manager, buf) {
    let seedWaveform = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : _consts.DEFAULT_WAVEFORM;
    super(buf, seedWaveform);
    this.manager = manager;
  }
  async play() {
    this.manager.pauseAllExcept(this);
    return super.play();
  }
  destroy() {
    this.manager.destroyPlaybackInstance(this);
    super.destroy();
  }
}
exports.ManagedPlayback = ManagedPlayback;
//# sourceMappingURL=ManagedPlayback.js.map