"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PlaybackState = exports.Playback = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _events = _interopRequireDefault(require("events"));
var _matrixWidgetApi = require("matrix-widget-api");
var _logger = require("matrix-js-sdk/src/logger");
var _utils = require("matrix-js-sdk/src/utils");
var _playbackWorker = _interopRequireDefault(require("../workers/playback.worker.ts"));
var _AsyncStore = require("../stores/AsyncStore");
var _arrays = require("../utils/arrays");
var _PlaybackClock = require("./PlaybackClock");
var _compat = require("./compat");
var _numbers = require("../utils/numbers");
var _WorkerManager = require("../WorkerManager");
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
// @ts-ignore - `.ts` is needed here to make TS happy
let PlaybackState = /*#__PURE__*/function (PlaybackState) {
  PlaybackState["Decoding"] = "decoding";
  PlaybackState["Stopped"] = "stopped";
  PlaybackState["Paused"] = "paused";
  PlaybackState["Playing"] = "playing";
  return PlaybackState;
}({}); // active progress through timeline
exports.PlaybackState = PlaybackState;
const THUMBNAIL_WAVEFORM_SAMPLES = 100; // arbitrary: [30,120]

class Playback extends _events.default {
  /**
   * Creates a new playback instance from a buffer.
   * @param {ArrayBuffer} buf The buffer containing the sound sample.
   * @param {number[]} seedWaveform Optional seed waveform to present until the proper waveform
   * can be calculated. Contains values between zero and one, inclusive.
   */
  constructor(buf) {
    let seedWaveform = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : _consts.DEFAULT_WAVEFORM;
    super();
    // Capture the file size early as reading the buffer will result in a 0-length buffer left behind
    this.buf = buf;
    /**
     * Stable waveform for representing a thumbnail of the media. Values are
     * guaranteed to be between zero and one, inclusive.
     */
    (0, _defineProperty2.default)(this, "thumbnailWaveform", void 0);
    (0, _defineProperty2.default)(this, "context", void 0);
    (0, _defineProperty2.default)(this, "source", void 0);
    (0, _defineProperty2.default)(this, "state", PlaybackState.Decoding);
    (0, _defineProperty2.default)(this, "audioBuf", void 0);
    (0, _defineProperty2.default)(this, "element", void 0);
    (0, _defineProperty2.default)(this, "resampledWaveform", void 0);
    (0, _defineProperty2.default)(this, "waveformObservable", new _matrixWidgetApi.SimpleObservable());
    (0, _defineProperty2.default)(this, "clock", void 0);
    (0, _defineProperty2.default)(this, "fileSize", void 0);
    (0, _defineProperty2.default)(this, "worker", new _WorkerManager.WorkerManager(_playbackWorker.default));
    (0, _defineProperty2.default)(this, "onPlaybackEnd", async () => {
      await this.context.suspend();
      this.emit(PlaybackState.Stopped);
    });
    this.fileSize = this.buf.byteLength;
    this.context = (0, _compat.createAudioContext)();
    this.resampledWaveform = (0, _arrays.arrayFastResample)(seedWaveform ?? _consts.DEFAULT_WAVEFORM, _consts.PLAYBACK_WAVEFORM_SAMPLES);
    this.thumbnailWaveform = (0, _arrays.arrayFastResample)(seedWaveform ?? _consts.DEFAULT_WAVEFORM, THUMBNAIL_WAVEFORM_SAMPLES);
    this.waveformObservable.update(this.resampledWaveform);
    this.clock = new _PlaybackClock.PlaybackClock(this.context);
  }

  /**
   * Size of the audio clip in bytes. May be zero if unknown. This is updated
   * when the playback goes through phase changes.
   */
  get sizeBytes() {
    return this.fileSize;
  }

  /**
   * Stable waveform for the playback. Values are guaranteed to be between
   * zero and one, inclusive.
   */
  get waveform() {
    return this.resampledWaveform;
  }
  get waveformData() {
    return this.waveformObservable;
  }
  get clockInfo() {
    return this.clock;
  }
  get liveData() {
    return this.clock.liveData;
  }
  get timeSeconds() {
    return this.clock.timeSeconds;
  }
  get durationSeconds() {
    return this.clock.durationSeconds;
  }
  get currentState() {
    return this.state;
  }
  get isPlaying() {
    return this.currentState === PlaybackState.Playing;
  }
  emit(event) {
    this.state = event;
    for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }
    super.emit(event, ...args);
    super.emit(_AsyncStore.UPDATE_EVENT, event, ...args);
    return true; // we don't ever care if the event had listeners, so just return "yes"
  }

  destroy() {
    // Dev note: It's critical that we call stop() during cleanup to ensure that downstream callers
    // are aware of the final clock position before the user triggered an unload.
    // noinspection JSIgnoredPromiseFromCall - not concerned about being called async here
    this.stop();
    this.removeAllListeners();
    this.clock.destroy();
    this.waveformObservable.close();
    if (this.element) {
      URL.revokeObjectURL(this.element.src);
      this.element.remove();
    }
  }
  async prepare() {
    // don't attempt to decode the media again
    // AudioContext.decodeAudioData detaches the array buffer `this.buf`
    // meaning it cannot be re-read
    if (this.state !== PlaybackState.Decoding) {
      return;
    }

    // The point where we use an audio element is fairly arbitrary, though we don't want
    // it to be too low. As of writing, voice messages want to show a waveform but audio
    // messages do not. Using an audio element means we can't show a waveform preview, so
    // we try to target the difference between a voice message file and large audio file.
    // Overall, the point of this is to avoid memory-related issues due to storing a massive
    // audio buffer in memory, as that can balloon to far greater than the input buffer's
    // byte length.
    if (this.buf.byteLength > 5 * 1024 * 1024) {
      // 5mb
      _logger.logger.log("Audio file too large: processing through <audio /> element");
      this.element = document.createElement("AUDIO");
      const deferred = (0, _utils.defer)();
      this.element.onloadeddata = deferred.resolve;
      this.element.onerror = deferred.reject;
      this.element.src = URL.createObjectURL(new Blob([this.buf]));
      await deferred.promise; // make sure the audio element is ready for us
    } else {
      // Safari compat: promise API not supported on this function
      this.audioBuf = await new Promise((resolve, reject) => {
        this.context.decodeAudioData(this.buf, b => resolve(b), async e => {
          try {
            // This error handler is largely for Safari as well, which doesn't support Opus/Ogg
            // very well.
            _logger.logger.error("Error decoding recording: ", e);
            _logger.logger.warn("Trying to re-encode to WAV instead...");
            const wav = await (0, _compat.decodeOgg)(this.buf);

            // noinspection ES6MissingAwait - not needed when using callbacks
            this.context.decodeAudioData(wav, b => resolve(b), e => {
              _logger.logger.error("Still failed to decode recording: ", e);
              reject(e);
            });
          } catch (e) {
            _logger.logger.error("Caught decoding error:", e);
            reject(e);
          }
        });
      });

      // Update the waveform to the real waveform once we have channel data to use. We don't
      // exactly trust the user-provided waveform to be accurate...
      this.resampledWaveform = await this.makePlaybackWaveform(this.audioBuf.getChannelData(0));
    }
    this.waveformObservable.update(this.resampledWaveform);
    this.clock.flagLoadTime(); // must happen first because setting the duration fires a clock update
    this.clock.durationSeconds = this.element?.duration ?? this.audioBuf.duration;

    // Signal that we're not decoding anymore. This is done last to ensure the clock is updated for
    // when the downstream callers try to use it.
    this.emit(PlaybackState.Stopped); // signal that we're not decoding anymore
  }

  makePlaybackWaveform(input) {
    return this.worker.call({
      data: Array.from(input)
    }).then(resp => resp.waveform);
  }
  async play() {
    // We can't restart a buffer source, so we need to create a new one if we hit the end
    if (this.state === PlaybackState.Stopped) {
      this.disconnectSource();
      this.makeNewSourceBuffer();
      if (this.element) {
        await this.element.play();
      } else {
        this.source.start();
      }
    }

    // We use the context suspend/resume functions because it allows us to pause a source
    // node, but that still doesn't help us when the source node runs out (see above).
    await this.context.resume();
    this.clock.flagStart();
    this.emit(PlaybackState.Playing);
  }
  disconnectSource() {
    if (this.element) return; // leave connected, we can (and must) re-use it
    this.source?.disconnect();
    this.source?.removeEventListener("ended", this.onPlaybackEnd);
  }
  makeNewSourceBuffer() {
    if (this.element && this.source) return; // leave connected, we can (and must) re-use it

    if (this.element) {
      this.source = this.context.createMediaElementSource(this.element);
    } else {
      this.source = this.context.createBufferSource();
      this.source.buffer = this.audioBuf ?? null;
    }
    this.source.addEventListener("ended", this.onPlaybackEnd);
    this.source.connect(this.context.destination);
  }
  async pause() {
    await this.context.suspend();
    this.emit(PlaybackState.Paused);
  }
  async stop() {
    await this.onPlaybackEnd();
    this.clock.flagStop();
  }
  async toggle() {
    if (this.isPlaying) await this.pause();else await this.play();
  }
  async skipTo(timeSeconds) {
    // Dev note: this function talks a lot about clock desyncs. There is a clock running
    // independently to the audio context and buffer so that accurate human-perceptible
    // time can be exposed. The PlaybackClock class has more information, but the short
    // version is that we need to line up the useful time (clip position) with the context
    // time, and avoid as many deviations as possible as otherwise the user could see the
    // wrong time, and we stop playback at the wrong time, etc.

    timeSeconds = (0, _numbers.clamp)(timeSeconds, 0, this.clock.durationSeconds);

    // Track playing state so we don't cause seeking to start playing the track.
    const isPlaying = this.isPlaying;
    if (isPlaying) {
      // Pause first so we can get an accurate measurement of time
      await this.context.suspend();
    }

    // We can't simply tell the context/buffer to jump to a time, so we have to
    // start a whole new buffer and start it from the new time offset.
    const now = this.context.currentTime;
    this.disconnectSource();
    this.makeNewSourceBuffer();

    // We have to resync the clock because it can get confused about where we're
    // at in the audio clip.
    this.clock.syncTo(now, timeSeconds);

    // Always start the source to queue it up. We have to do this now (and pause
    // quickly if we're not supposed to be playing) as otherwise the clock can desync
    // when it comes time to the user hitting play. After a couple jumps, the user
    // will have desynced the clock enough to be about 10-15 seconds off, while this
    // keeps it as close to perfect as humans can perceive.
    if (this.element) {
      this.element.currentTime = timeSeconds;
    } else {
      this.source.start(now, timeSeconds);
    }

    // Dev note: it's critical that the code gap between `this.source.start()` and
    // `this.pause()` is as small as possible: we do not want to delay *anything*
    // as that could cause a clock desync, or a buggy feeling as a single note plays
    // during seeking.

    if (isPlaying) {
      // If we were playing before, continue the context so the clock doesn't desync.
      await this.context.resume();
    } else {
      // As mentioned above, we'll have to pause the clip if we weren't supposed to
      // be playing it just yet. If we didn't have this, the audio clip plays but all
      // the states will be wrong: clock won't advance, pause state doesn't match the
      // blaring noise leaving the user's speakers, etc.
      //
      // Also as mentioned, if the code gap is small enough then this should be
      // executed immediately after the start time, leaving no feasible time for the
      // user's speakers to play any sound.
      await this.pause();
    }
  }
}
exports.Playback = Playback;
//# sourceMappingURL=Playback.js.map