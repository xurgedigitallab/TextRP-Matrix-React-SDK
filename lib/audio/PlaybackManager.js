"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PlaybackManager = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _Playback = require("./Playback");
var _ManagedPlayback = require("./ManagedPlayback");
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
 * Handles management of playback instances to ensure certain functionality, like
 * one playback operating at any one time.
 */
class PlaybackManager {
  constructor() {
    (0, _defineProperty2.default)(this, "instances", []);
  }
  static get instance() {
    if (!PlaybackManager.internalInstance) {
      PlaybackManager.internalInstance = new PlaybackManager();
    }
    return PlaybackManager.internalInstance;
  }

  /**
   * Pauses all other playback instances. If no playback is provided, all playing
   * instances are paused.
   * @param playback Optional. The playback to leave untouched.
   */
  pauseAllExcept(playback) {
    this.instances.filter(p => p !== playback && p.currentState === _Playback.PlaybackState.Playing).forEach(p => p.pause());
  }
  destroyPlaybackInstance(playback) {
    this.instances = this.instances.filter(p => p !== playback);
  }
  createPlaybackInstance(buf) {
    let waveform = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : _consts.DEFAULT_WAVEFORM;
    const instance = new _ManagedPlayback.ManagedPlayback(this, buf, waveform);
    this.instances.push(instance);
    return instance;
  }
}
exports.PlaybackManager = PlaybackManager;
(0, _defineProperty2.default)(PlaybackManager, "internalInstance", void 0);
//# sourceMappingURL=PlaybackManager.js.map