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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfZXZlbnRzIiwiX2ludGVyb3BSZXF1aXJlRGVmYXVsdCIsInJlcXVpcmUiLCJfbWF0cml4V2lkZ2V0QXBpIiwiX2xvZ2dlciIsIl91dGlscyIsIl9wbGF5YmFja1dvcmtlciIsIl9Bc3luY1N0b3JlIiwiX2FycmF5cyIsIl9QbGF5YmFja0Nsb2NrIiwiX2NvbXBhdCIsIl9udW1iZXJzIiwiX1dvcmtlck1hbmFnZXIiLCJfY29uc3RzIiwiUGxheWJhY2tTdGF0ZSIsImV4cG9ydHMiLCJUSFVNQk5BSUxfV0FWRUZPUk1fU0FNUExFUyIsIlBsYXliYWNrIiwiRXZlbnRFbWl0dGVyIiwiY29uc3RydWN0b3IiLCJidWYiLCJzZWVkV2F2ZWZvcm0iLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJ1bmRlZmluZWQiLCJERUZBVUxUX1dBVkVGT1JNIiwiX2RlZmluZVByb3BlcnR5MiIsImRlZmF1bHQiLCJEZWNvZGluZyIsIlNpbXBsZU9ic2VydmFibGUiLCJXb3JrZXJNYW5hZ2VyIiwiUGxheWJhY2tXb3JrZXIiLCJjb250ZXh0Iiwic3VzcGVuZCIsImVtaXQiLCJTdG9wcGVkIiwiZmlsZVNpemUiLCJieXRlTGVuZ3RoIiwiY3JlYXRlQXVkaW9Db250ZXh0IiwicmVzYW1wbGVkV2F2ZWZvcm0iLCJhcnJheUZhc3RSZXNhbXBsZSIsIlBMQVlCQUNLX1dBVkVGT1JNX1NBTVBMRVMiLCJ0aHVtYm5haWxXYXZlZm9ybSIsIndhdmVmb3JtT2JzZXJ2YWJsZSIsInVwZGF0ZSIsImNsb2NrIiwiUGxheWJhY2tDbG9jayIsInNpemVCeXRlcyIsIndhdmVmb3JtIiwid2F2ZWZvcm1EYXRhIiwiY2xvY2tJbmZvIiwibGl2ZURhdGEiLCJ0aW1lU2Vjb25kcyIsImR1cmF0aW9uU2Vjb25kcyIsImN1cnJlbnRTdGF0ZSIsInN0YXRlIiwiaXNQbGF5aW5nIiwiUGxheWluZyIsImV2ZW50IiwiX2xlbiIsImFyZ3MiLCJBcnJheSIsIl9rZXkiLCJVUERBVEVfRVZFTlQiLCJkZXN0cm95Iiwic3RvcCIsInJlbW92ZUFsbExpc3RlbmVycyIsImNsb3NlIiwiZWxlbWVudCIsIlVSTCIsInJldm9rZU9iamVjdFVSTCIsInNyYyIsInJlbW92ZSIsInByZXBhcmUiLCJsb2dnZXIiLCJsb2ciLCJkb2N1bWVudCIsImNyZWF0ZUVsZW1lbnQiLCJkZWZlcnJlZCIsImRlZmVyIiwib25sb2FkZWRkYXRhIiwicmVzb2x2ZSIsIm9uZXJyb3IiLCJyZWplY3QiLCJjcmVhdGVPYmplY3RVUkwiLCJCbG9iIiwicHJvbWlzZSIsImF1ZGlvQnVmIiwiUHJvbWlzZSIsImRlY29kZUF1ZGlvRGF0YSIsImIiLCJlIiwiZXJyb3IiLCJ3YXJuIiwid2F2IiwiZGVjb2RlT2dnIiwibWFrZVBsYXliYWNrV2F2ZWZvcm0iLCJnZXRDaGFubmVsRGF0YSIsImZsYWdMb2FkVGltZSIsImR1cmF0aW9uIiwiaW5wdXQiLCJ3b3JrZXIiLCJjYWxsIiwiZGF0YSIsImZyb20iLCJ0aGVuIiwicmVzcCIsInBsYXkiLCJkaXNjb25uZWN0U291cmNlIiwibWFrZU5ld1NvdXJjZUJ1ZmZlciIsInNvdXJjZSIsInN0YXJ0IiwicmVzdW1lIiwiZmxhZ1N0YXJ0IiwiZGlzY29ubmVjdCIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJvblBsYXliYWNrRW5kIiwiY3JlYXRlTWVkaWFFbGVtZW50U291cmNlIiwiY3JlYXRlQnVmZmVyU291cmNlIiwiYnVmZmVyIiwiYWRkRXZlbnRMaXN0ZW5lciIsImNvbm5lY3QiLCJkZXN0aW5hdGlvbiIsInBhdXNlIiwiUGF1c2VkIiwiZmxhZ1N0b3AiLCJ0b2dnbGUiLCJza2lwVG8iLCJjbGFtcCIsIm5vdyIsImN1cnJlbnRUaW1lIiwic3luY1RvIl0sInNvdXJjZXMiOlsiLi4vLi4vc3JjL2F1ZGlvL1BsYXliYWNrLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qXG5Db3B5cmlnaHQgMjAyMSBUaGUgTWF0cml4Lm9yZyBGb3VuZGF0aW9uIEMuSS5DLlxuXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiovXG5cbmltcG9ydCBFdmVudEVtaXR0ZXIgZnJvbSBcImV2ZW50c1wiO1xuaW1wb3J0IHsgU2ltcGxlT2JzZXJ2YWJsZSB9IGZyb20gXCJtYXRyaXgtd2lkZ2V0LWFwaVwiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIm1hdHJpeC1qcy1zZGsvc3JjL2xvZ2dlclwiO1xuaW1wb3J0IHsgZGVmZXIgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvdXRpbHNcIjtcblxuLy8gQHRzLWlnbm9yZSAtIGAudHNgIGlzIG5lZWRlZCBoZXJlIHRvIG1ha2UgVFMgaGFwcHlcbmltcG9ydCBQbGF5YmFja1dvcmtlciwgeyBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gXCIuLi93b3JrZXJzL3BsYXliYWNrLndvcmtlci50c1wiO1xuaW1wb3J0IHsgVVBEQVRFX0VWRU5UIH0gZnJvbSBcIi4uL3N0b3Jlcy9Bc3luY1N0b3JlXCI7XG5pbXBvcnQgeyBhcnJheUZhc3RSZXNhbXBsZSB9IGZyb20gXCIuLi91dGlscy9hcnJheXNcIjtcbmltcG9ydCB7IElEZXN0cm95YWJsZSB9IGZyb20gXCIuLi91dGlscy9JRGVzdHJveWFibGVcIjtcbmltcG9ydCB7IFBsYXliYWNrQ2xvY2sgfSBmcm9tIFwiLi9QbGF5YmFja0Nsb2NrXCI7XG5pbXBvcnQgeyBjcmVhdGVBdWRpb0NvbnRleHQsIGRlY29kZU9nZyB9IGZyb20gXCIuL2NvbXBhdFwiO1xuaW1wb3J0IHsgY2xhbXAgfSBmcm9tIFwiLi4vdXRpbHMvbnVtYmVyc1wiO1xuaW1wb3J0IHsgV29ya2VyTWFuYWdlciB9IGZyb20gXCIuLi9Xb3JrZXJNYW5hZ2VyXCI7XG5pbXBvcnQgeyBERUZBVUxUX1dBVkVGT1JNLCBQTEFZQkFDS19XQVZFRk9STV9TQU1QTEVTIH0gZnJvbSBcIi4vY29uc3RzXCI7XG5cbmV4cG9ydCBlbnVtIFBsYXliYWNrU3RhdGUge1xuICAgIERlY29kaW5nID0gXCJkZWNvZGluZ1wiLFxuICAgIFN0b3BwZWQgPSBcInN0b3BwZWRcIiwgLy8gbm8gcHJvZ3Jlc3Mgb24gdGltZWxpbmVcbiAgICBQYXVzZWQgPSBcInBhdXNlZFwiLCAvLyBzb21lIHByb2dyZXNzIG9uIHRpbWVsaW5lXG4gICAgUGxheWluZyA9IFwicGxheWluZ1wiLCAvLyBhY3RpdmUgcHJvZ3Jlc3MgdGhyb3VnaCB0aW1lbGluZVxufVxuXG5jb25zdCBUSFVNQk5BSUxfV0FWRUZPUk1fU0FNUExFUyA9IDEwMDsgLy8gYXJiaXRyYXJ5OiBbMzAsMTIwXVxuXG5leHBvcnQgaW50ZXJmYWNlIFBsYXliYWNrSW50ZXJmYWNlIHtcbiAgICByZWFkb25seSBjdXJyZW50U3RhdGU6IFBsYXliYWNrU3RhdGU7XG4gICAgcmVhZG9ubHkgbGl2ZURhdGE6IFNpbXBsZU9ic2VydmFibGU8bnVtYmVyW10+O1xuICAgIHJlYWRvbmx5IHRpbWVTZWNvbmRzOiBudW1iZXI7XG4gICAgcmVhZG9ubHkgZHVyYXRpb25TZWNvbmRzOiBudW1iZXI7XG4gICAgc2tpcFRvKHRpbWVTZWNvbmRzOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+O1xufVxuXG5leHBvcnQgY2xhc3MgUGxheWJhY2sgZXh0ZW5kcyBFdmVudEVtaXR0ZXIgaW1wbGVtZW50cyBJRGVzdHJveWFibGUsIFBsYXliYWNrSW50ZXJmYWNlIHtcbiAgICAvKipcbiAgICAgKiBTdGFibGUgd2F2ZWZvcm0gZm9yIHJlcHJlc2VudGluZyBhIHRodW1ibmFpbCBvZiB0aGUgbWVkaWEuIFZhbHVlcyBhcmVcbiAgICAgKiBndWFyYW50ZWVkIHRvIGJlIGJldHdlZW4gemVybyBhbmQgb25lLCBpbmNsdXNpdmUuXG4gICAgICovXG4gICAgcHVibGljIHJlYWRvbmx5IHRodW1ibmFpbFdhdmVmb3JtOiBudW1iZXJbXTtcblxuICAgIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dDogQXVkaW9Db250ZXh0O1xuICAgIHByaXZhdGUgc291cmNlPzogQXVkaW9CdWZmZXJTb3VyY2VOb2RlIHwgTWVkaWFFbGVtZW50QXVkaW9Tb3VyY2VOb2RlO1xuICAgIHByaXZhdGUgc3RhdGUgPSBQbGF5YmFja1N0YXRlLkRlY29kaW5nO1xuICAgIHByaXZhdGUgYXVkaW9CdWY/OiBBdWRpb0J1ZmZlcjtcbiAgICBwcml2YXRlIGVsZW1lbnQ/OiBIVE1MQXVkaW9FbGVtZW50O1xuICAgIHByaXZhdGUgcmVzYW1wbGVkV2F2ZWZvcm06IG51bWJlcltdO1xuICAgIHByaXZhdGUgd2F2ZWZvcm1PYnNlcnZhYmxlID0gbmV3IFNpbXBsZU9ic2VydmFibGU8bnVtYmVyW10+KCk7XG4gICAgcHJpdmF0ZSByZWFkb25seSBjbG9jazogUGxheWJhY2tDbG9jaztcbiAgICBwcml2YXRlIHJlYWRvbmx5IGZpbGVTaXplOiBudW1iZXI7XG4gICAgcHJpdmF0ZSByZWFkb25seSB3b3JrZXIgPSBuZXcgV29ya2VyTWFuYWdlcjxSZXF1ZXN0LCBSZXNwb25zZT4oUGxheWJhY2tXb3JrZXIpO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIG5ldyBwbGF5YmFjayBpbnN0YW5jZSBmcm9tIGEgYnVmZmVyLlxuICAgICAqIEBwYXJhbSB7QXJyYXlCdWZmZXJ9IGJ1ZiBUaGUgYnVmZmVyIGNvbnRhaW5pbmcgdGhlIHNvdW5kIHNhbXBsZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBzZWVkV2F2ZWZvcm0gT3B0aW9uYWwgc2VlZCB3YXZlZm9ybSB0byBwcmVzZW50IHVudGlsIHRoZSBwcm9wZXIgd2F2ZWZvcm1cbiAgICAgKiBjYW4gYmUgY2FsY3VsYXRlZC4gQ29udGFpbnMgdmFsdWVzIGJldHdlZW4gemVybyBhbmQgb25lLCBpbmNsdXNpdmUuXG4gICAgICovXG4gICAgcHVibGljIGNvbnN0cnVjdG9yKHByaXZhdGUgYnVmOiBBcnJheUJ1ZmZlciwgc2VlZFdhdmVmb3JtID0gREVGQVVMVF9XQVZFRk9STSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICAvLyBDYXB0dXJlIHRoZSBmaWxlIHNpemUgZWFybHkgYXMgcmVhZGluZyB0aGUgYnVmZmVyIHdpbGwgcmVzdWx0IGluIGEgMC1sZW5ndGggYnVmZmVyIGxlZnQgYmVoaW5kXG4gICAgICAgIHRoaXMuZmlsZVNpemUgPSB0aGlzLmJ1Zi5ieXRlTGVuZ3RoO1xuICAgICAgICB0aGlzLmNvbnRleHQgPSBjcmVhdGVBdWRpb0NvbnRleHQoKTtcbiAgICAgICAgdGhpcy5yZXNhbXBsZWRXYXZlZm9ybSA9IGFycmF5RmFzdFJlc2FtcGxlKHNlZWRXYXZlZm9ybSA/PyBERUZBVUxUX1dBVkVGT1JNLCBQTEFZQkFDS19XQVZFRk9STV9TQU1QTEVTKTtcbiAgICAgICAgdGhpcy50aHVtYm5haWxXYXZlZm9ybSA9IGFycmF5RmFzdFJlc2FtcGxlKHNlZWRXYXZlZm9ybSA/PyBERUZBVUxUX1dBVkVGT1JNLCBUSFVNQk5BSUxfV0FWRUZPUk1fU0FNUExFUyk7XG4gICAgICAgIHRoaXMud2F2ZWZvcm1PYnNlcnZhYmxlLnVwZGF0ZSh0aGlzLnJlc2FtcGxlZFdhdmVmb3JtKTtcbiAgICAgICAgdGhpcy5jbG9jayA9IG5ldyBQbGF5YmFja0Nsb2NrKHRoaXMuY29udGV4dCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2l6ZSBvZiB0aGUgYXVkaW8gY2xpcCBpbiBieXRlcy4gTWF5IGJlIHplcm8gaWYgdW5rbm93bi4gVGhpcyBpcyB1cGRhdGVkXG4gICAgICogd2hlbiB0aGUgcGxheWJhY2sgZ29lcyB0aHJvdWdoIHBoYXNlIGNoYW5nZXMuXG4gICAgICovXG4gICAgcHVibGljIGdldCBzaXplQnl0ZXMoKTogbnVtYmVyIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmlsZVNpemU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RhYmxlIHdhdmVmb3JtIGZvciB0aGUgcGxheWJhY2suIFZhbHVlcyBhcmUgZ3VhcmFudGVlZCB0byBiZSBiZXR3ZWVuXG4gICAgICogemVybyBhbmQgb25lLCBpbmNsdXNpdmUuXG4gICAgICovXG4gICAgcHVibGljIGdldCB3YXZlZm9ybSgpOiBudW1iZXJbXSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJlc2FtcGxlZFdhdmVmb3JtO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXQgd2F2ZWZvcm1EYXRhKCk6IFNpbXBsZU9ic2VydmFibGU8bnVtYmVyW10+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMud2F2ZWZvcm1PYnNlcnZhYmxlO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXQgY2xvY2tJbmZvKCk6IFBsYXliYWNrQ2xvY2sge1xuICAgICAgICByZXR1cm4gdGhpcy5jbG9jaztcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0IGxpdmVEYXRhKCk6IFNpbXBsZU9ic2VydmFibGU8bnVtYmVyW10+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY2xvY2subGl2ZURhdGE7XG4gICAgfVxuXG4gICAgcHVibGljIGdldCB0aW1lU2Vjb25kcygpOiBudW1iZXIge1xuICAgICAgICByZXR1cm4gdGhpcy5jbG9jay50aW1lU2Vjb25kcztcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0IGR1cmF0aW9uU2Vjb25kcygpOiBudW1iZXIge1xuICAgICAgICByZXR1cm4gdGhpcy5jbG9jay5kdXJhdGlvblNlY29uZHM7XG4gICAgfVxuXG4gICAgcHVibGljIGdldCBjdXJyZW50U3RhdGUoKTogUGxheWJhY2tTdGF0ZSB7XG4gICAgICAgIHJldHVybiB0aGlzLnN0YXRlO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXQgaXNQbGF5aW5nKCk6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gdGhpcy5jdXJyZW50U3RhdGUgPT09IFBsYXliYWNrU3RhdGUuUGxheWluZztcbiAgICB9XG5cbiAgICBwdWJsaWMgZW1pdChldmVudDogUGxheWJhY2tTdGF0ZSwgLi4uYXJnczogYW55W10pOiBib29sZWFuIHtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IGV2ZW50O1xuICAgICAgICBzdXBlci5lbWl0KGV2ZW50LCAuLi5hcmdzKTtcbiAgICAgICAgc3VwZXIuZW1pdChVUERBVEVfRVZFTlQsIGV2ZW50LCAuLi5hcmdzKTtcbiAgICAgICAgcmV0dXJuIHRydWU7IC8vIHdlIGRvbid0IGV2ZXIgY2FyZSBpZiB0aGUgZXZlbnQgaGFkIGxpc3RlbmVycywgc28ganVzdCByZXR1cm4gXCJ5ZXNcIlxuICAgIH1cblxuICAgIHB1YmxpYyBkZXN0cm95KCk6IHZvaWQge1xuICAgICAgICAvLyBEZXYgbm90ZTogSXQncyBjcml0aWNhbCB0aGF0IHdlIGNhbGwgc3RvcCgpIGR1cmluZyBjbGVhbnVwIHRvIGVuc3VyZSB0aGF0IGRvd25zdHJlYW0gY2FsbGVyc1xuICAgICAgICAvLyBhcmUgYXdhcmUgb2YgdGhlIGZpbmFsIGNsb2NrIHBvc2l0aW9uIGJlZm9yZSB0aGUgdXNlciB0cmlnZ2VyZWQgYW4gdW5sb2FkLlxuICAgICAgICAvLyBub2luc3BlY3Rpb24gSlNJZ25vcmVkUHJvbWlzZUZyb21DYWxsIC0gbm90IGNvbmNlcm5lZCBhYm91dCBiZWluZyBjYWxsZWQgYXN5bmMgaGVyZVxuICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcbiAgICAgICAgdGhpcy5jbG9jay5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMud2F2ZWZvcm1PYnNlcnZhYmxlLmNsb3NlKCk7XG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnQpIHtcbiAgICAgICAgICAgIFVSTC5yZXZva2VPYmplY3RVUkwodGhpcy5lbGVtZW50LnNyYyk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnQucmVtb3ZlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgcHJlcGFyZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgLy8gZG9uJ3QgYXR0ZW1wdCB0byBkZWNvZGUgdGhlIG1lZGlhIGFnYWluXG4gICAgICAgIC8vIEF1ZGlvQ29udGV4dC5kZWNvZGVBdWRpb0RhdGEgZGV0YWNoZXMgdGhlIGFycmF5IGJ1ZmZlciBgdGhpcy5idWZgXG4gICAgICAgIC8vIG1lYW5pbmcgaXQgY2Fubm90IGJlIHJlLXJlYWRcbiAgICAgICAgaWYgKHRoaXMuc3RhdGUgIT09IFBsYXliYWNrU3RhdGUuRGVjb2RpbmcpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRoZSBwb2ludCB3aGVyZSB3ZSB1c2UgYW4gYXVkaW8gZWxlbWVudCBpcyBmYWlybHkgYXJiaXRyYXJ5LCB0aG91Z2ggd2UgZG9uJ3Qgd2FudFxuICAgICAgICAvLyBpdCB0byBiZSB0b28gbG93LiBBcyBvZiB3cml0aW5nLCB2b2ljZSBtZXNzYWdlcyB3YW50IHRvIHNob3cgYSB3YXZlZm9ybSBidXQgYXVkaW9cbiAgICAgICAgLy8gbWVzc2FnZXMgZG8gbm90LiBVc2luZyBhbiBhdWRpbyBlbGVtZW50IG1lYW5zIHdlIGNhbid0IHNob3cgYSB3YXZlZm9ybSBwcmV2aWV3LCBzb1xuICAgICAgICAvLyB3ZSB0cnkgdG8gdGFyZ2V0IHRoZSBkaWZmZXJlbmNlIGJldHdlZW4gYSB2b2ljZSBtZXNzYWdlIGZpbGUgYW5kIGxhcmdlIGF1ZGlvIGZpbGUuXG4gICAgICAgIC8vIE92ZXJhbGwsIHRoZSBwb2ludCBvZiB0aGlzIGlzIHRvIGF2b2lkIG1lbW9yeS1yZWxhdGVkIGlzc3VlcyBkdWUgdG8gc3RvcmluZyBhIG1hc3NpdmVcbiAgICAgICAgLy8gYXVkaW8gYnVmZmVyIGluIG1lbW9yeSwgYXMgdGhhdCBjYW4gYmFsbG9vbiB0byBmYXIgZ3JlYXRlciB0aGFuIHRoZSBpbnB1dCBidWZmZXInc1xuICAgICAgICAvLyBieXRlIGxlbmd0aC5cbiAgICAgICAgaWYgKHRoaXMuYnVmLmJ5dGVMZW5ndGggPiA1ICogMTAyNCAqIDEwMjQpIHtcbiAgICAgICAgICAgIC8vIDVtYlxuICAgICAgICAgICAgbG9nZ2VyLmxvZyhcIkF1ZGlvIGZpbGUgdG9vIGxhcmdlOiBwcm9jZXNzaW5nIHRocm91Z2ggPGF1ZGlvIC8+IGVsZW1lbnRcIik7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiQVVESU9cIikgYXMgSFRNTEF1ZGlvRWxlbWVudDtcbiAgICAgICAgICAgIGNvbnN0IGRlZmVycmVkID0gZGVmZXI8dW5rbm93bj4oKTtcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudC5vbmxvYWRlZGRhdGEgPSBkZWZlcnJlZC5yZXNvbHZlO1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50Lm9uZXJyb3IgPSBkZWZlcnJlZC5yZWplY3Q7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnQuc3JjID0gVVJMLmNyZWF0ZU9iamVjdFVSTChuZXcgQmxvYihbdGhpcy5idWZdKSk7XG4gICAgICAgICAgICBhd2FpdCBkZWZlcnJlZC5wcm9taXNlOyAvLyBtYWtlIHN1cmUgdGhlIGF1ZGlvIGVsZW1lbnQgaXMgcmVhZHkgZm9yIHVzXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBTYWZhcmkgY29tcGF0OiBwcm9taXNlIEFQSSBub3Qgc3VwcG9ydGVkIG9uIHRoaXMgZnVuY3Rpb25cbiAgICAgICAgICAgIHRoaXMuYXVkaW9CdWYgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5jb250ZXh0LmRlY29kZUF1ZGlvRGF0YShcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5idWYsXG4gICAgICAgICAgICAgICAgICAgIChiKSA9PiByZXNvbHZlKGIpLFxuICAgICAgICAgICAgICAgICAgICBhc3luYyAoZSk6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBUaGlzIGVycm9yIGhhbmRsZXIgaXMgbGFyZ2VseSBmb3IgU2FmYXJpIGFzIHdlbGwsIHdoaWNoIGRvZXNuJ3Qgc3VwcG9ydCBPcHVzL09nZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHZlcnkgd2VsbC5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2dnZXIuZXJyb3IoXCJFcnJvciBkZWNvZGluZyByZWNvcmRpbmc6IFwiLCBlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2dnZXIud2FybihcIlRyeWluZyB0byByZS1lbmNvZGUgdG8gV0FWIGluc3RlYWQuLi5cIik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB3YXYgPSBhd2FpdCBkZWNvZGVPZ2codGhpcy5idWYpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbm9pbnNwZWN0aW9uIEVTNk1pc3NpbmdBd2FpdCAtIG5vdCBuZWVkZWQgd2hlbiB1c2luZyBjYWxsYmFja3NcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbnRleHQuZGVjb2RlQXVkaW9EYXRhKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3YXYsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChiKSA9PiByZXNvbHZlKGIpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLmVycm9yKFwiU3RpbGwgZmFpbGVkIHRvIGRlY29kZSByZWNvcmRpbmc6IFwiLCBlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZ2dlci5lcnJvcihcIkNhdWdodCBkZWNvZGluZyBlcnJvcjpcIiwgZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gVXBkYXRlIHRoZSB3YXZlZm9ybSB0byB0aGUgcmVhbCB3YXZlZm9ybSBvbmNlIHdlIGhhdmUgY2hhbm5lbCBkYXRhIHRvIHVzZS4gV2UgZG9uJ3RcbiAgICAgICAgICAgIC8vIGV4YWN0bHkgdHJ1c3QgdGhlIHVzZXItcHJvdmlkZWQgd2F2ZWZvcm0gdG8gYmUgYWNjdXJhdGUuLi5cbiAgICAgICAgICAgIHRoaXMucmVzYW1wbGVkV2F2ZWZvcm0gPSBhd2FpdCB0aGlzLm1ha2VQbGF5YmFja1dhdmVmb3JtKHRoaXMuYXVkaW9CdWYuZ2V0Q2hhbm5lbERhdGEoMCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy53YXZlZm9ybU9ic2VydmFibGUudXBkYXRlKHRoaXMucmVzYW1wbGVkV2F2ZWZvcm0pO1xuXG4gICAgICAgIHRoaXMuY2xvY2suZmxhZ0xvYWRUaW1lKCk7IC8vIG11c3QgaGFwcGVuIGZpcnN0IGJlY2F1c2Ugc2V0dGluZyB0aGUgZHVyYXRpb24gZmlyZXMgYSBjbG9jayB1cGRhdGVcbiAgICAgICAgdGhpcy5jbG9jay5kdXJhdGlvblNlY29uZHMgPSB0aGlzLmVsZW1lbnQ/LmR1cmF0aW9uID8/IHRoaXMuYXVkaW9CdWYhLmR1cmF0aW9uO1xuXG4gICAgICAgIC8vIFNpZ25hbCB0aGF0IHdlJ3JlIG5vdCBkZWNvZGluZyBhbnltb3JlLiBUaGlzIGlzIGRvbmUgbGFzdCB0byBlbnN1cmUgdGhlIGNsb2NrIGlzIHVwZGF0ZWQgZm9yXG4gICAgICAgIC8vIHdoZW4gdGhlIGRvd25zdHJlYW0gY2FsbGVycyB0cnkgdG8gdXNlIGl0LlxuICAgICAgICB0aGlzLmVtaXQoUGxheWJhY2tTdGF0ZS5TdG9wcGVkKTsgLy8gc2lnbmFsIHRoYXQgd2UncmUgbm90IGRlY29kaW5nIGFueW1vcmVcbiAgICB9XG5cbiAgICBwcml2YXRlIG1ha2VQbGF5YmFja1dhdmVmb3JtKGlucHV0OiBGbG9hdDMyQXJyYXkpOiBQcm9taXNlPG51bWJlcltdPiB7XG4gICAgICAgIHJldHVybiB0aGlzLndvcmtlci5jYWxsKHsgZGF0YTogQXJyYXkuZnJvbShpbnB1dCkgfSkudGhlbigocmVzcCkgPT4gcmVzcC53YXZlZm9ybSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBvblBsYXliYWNrRW5kID0gYXN5bmMgKCk6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgICAgICBhd2FpdCB0aGlzLmNvbnRleHQuc3VzcGVuZCgpO1xuICAgICAgICB0aGlzLmVtaXQoUGxheWJhY2tTdGF0ZS5TdG9wcGVkKTtcbiAgICB9O1xuXG4gICAgcHVibGljIGFzeW5jIHBsYXkoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIC8vIFdlIGNhbid0IHJlc3RhcnQgYSBidWZmZXIgc291cmNlLCBzbyB3ZSBuZWVkIHRvIGNyZWF0ZSBhIG5ldyBvbmUgaWYgd2UgaGl0IHRoZSBlbmRcbiAgICAgICAgaWYgKHRoaXMuc3RhdGUgPT09IFBsYXliYWNrU3RhdGUuU3RvcHBlZCkge1xuICAgICAgICAgICAgdGhpcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgICAgICAgICB0aGlzLm1ha2VOZXdTb3VyY2VCdWZmZXIoKTtcbiAgICAgICAgICAgIGlmICh0aGlzLmVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmVsZW1lbnQucGxheSgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAodGhpcy5zb3VyY2UgYXMgQXVkaW9CdWZmZXJTb3VyY2VOb2RlKS5zdGFydCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gV2UgdXNlIHRoZSBjb250ZXh0IHN1c3BlbmQvcmVzdW1lIGZ1bmN0aW9ucyBiZWNhdXNlIGl0IGFsbG93cyB1cyB0byBwYXVzZSBhIHNvdXJjZVxuICAgICAgICAvLyBub2RlLCBidXQgdGhhdCBzdGlsbCBkb2Vzbid0IGhlbHAgdXMgd2hlbiB0aGUgc291cmNlIG5vZGUgcnVucyBvdXQgKHNlZSBhYm92ZSkuXG4gICAgICAgIGF3YWl0IHRoaXMuY29udGV4dC5yZXN1bWUoKTtcbiAgICAgICAgdGhpcy5jbG9jay5mbGFnU3RhcnQoKTtcbiAgICAgICAgdGhpcy5lbWl0KFBsYXliYWNrU3RhdGUuUGxheWluZyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBkaXNjb25uZWN0U291cmNlKCk6IHZvaWQge1xuICAgICAgICBpZiAodGhpcy5lbGVtZW50KSByZXR1cm47IC8vIGxlYXZlIGNvbm5lY3RlZCwgd2UgY2FuIChhbmQgbXVzdCkgcmUtdXNlIGl0XG4gICAgICAgIHRoaXMuc291cmNlPy5kaXNjb25uZWN0KCk7XG4gICAgICAgIHRoaXMuc291cmNlPy5yZW1vdmVFdmVudExpc3RlbmVyKFwiZW5kZWRcIiwgdGhpcy5vblBsYXliYWNrRW5kKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIG1ha2VOZXdTb3VyY2VCdWZmZXIoKTogdm9pZCB7XG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnQgJiYgdGhpcy5zb3VyY2UpIHJldHVybjsgLy8gbGVhdmUgY29ubmVjdGVkLCB3ZSBjYW4gKGFuZCBtdXN0KSByZS11c2UgaXRcblxuICAgICAgICBpZiAodGhpcy5lbGVtZW50KSB7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZSA9IHRoaXMuY29udGV4dC5jcmVhdGVNZWRpYUVsZW1lbnRTb3VyY2UodGhpcy5lbGVtZW50KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuc291cmNlID0gdGhpcy5jb250ZXh0LmNyZWF0ZUJ1ZmZlclNvdXJjZSgpO1xuICAgICAgICAgICAgdGhpcy5zb3VyY2UuYnVmZmVyID0gdGhpcy5hdWRpb0J1ZiA/PyBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zb3VyY2UuYWRkRXZlbnRMaXN0ZW5lcihcImVuZGVkXCIsIHRoaXMub25QbGF5YmFja0VuZCk7XG4gICAgICAgIHRoaXMuc291cmNlLmNvbm5lY3QodGhpcy5jb250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgcGF1c2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGF3YWl0IHRoaXMuY29udGV4dC5zdXNwZW5kKCk7XG4gICAgICAgIHRoaXMuZW1pdChQbGF5YmFja1N0YXRlLlBhdXNlZCk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHN0b3AoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGF3YWl0IHRoaXMub25QbGF5YmFja0VuZCgpO1xuICAgICAgICB0aGlzLmNsb2NrLmZsYWdTdG9wKCk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHRvZ2dsZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgaWYgKHRoaXMuaXNQbGF5aW5nKSBhd2FpdCB0aGlzLnBhdXNlKCk7XG4gICAgICAgIGVsc2UgYXdhaXQgdGhpcy5wbGF5KCk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHNraXBUbyh0aW1lU2Vjb25kczogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIC8vIERldiBub3RlOiB0aGlzIGZ1bmN0aW9uIHRhbGtzIGEgbG90IGFib3V0IGNsb2NrIGRlc3luY3MuIFRoZXJlIGlzIGEgY2xvY2sgcnVubmluZ1xuICAgICAgICAvLyBpbmRlcGVuZGVudGx5IHRvIHRoZSBhdWRpbyBjb250ZXh0IGFuZCBidWZmZXIgc28gdGhhdCBhY2N1cmF0ZSBodW1hbi1wZXJjZXB0aWJsZVxuICAgICAgICAvLyB0aW1lIGNhbiBiZSBleHBvc2VkLiBUaGUgUGxheWJhY2tDbG9jayBjbGFzcyBoYXMgbW9yZSBpbmZvcm1hdGlvbiwgYnV0IHRoZSBzaG9ydFxuICAgICAgICAvLyB2ZXJzaW9uIGlzIHRoYXQgd2UgbmVlZCB0byBsaW5lIHVwIHRoZSB1c2VmdWwgdGltZSAoY2xpcCBwb3NpdGlvbikgd2l0aCB0aGUgY29udGV4dFxuICAgICAgICAvLyB0aW1lLCBhbmQgYXZvaWQgYXMgbWFueSBkZXZpYXRpb25zIGFzIHBvc3NpYmxlIGFzIG90aGVyd2lzZSB0aGUgdXNlciBjb3VsZCBzZWUgdGhlXG4gICAgICAgIC8vIHdyb25nIHRpbWUsIGFuZCB3ZSBzdG9wIHBsYXliYWNrIGF0IHRoZSB3cm9uZyB0aW1lLCBldGMuXG5cbiAgICAgICAgdGltZVNlY29uZHMgPSBjbGFtcCh0aW1lU2Vjb25kcywgMCwgdGhpcy5jbG9jay5kdXJhdGlvblNlY29uZHMpO1xuXG4gICAgICAgIC8vIFRyYWNrIHBsYXlpbmcgc3RhdGUgc28gd2UgZG9uJ3QgY2F1c2Ugc2Vla2luZyB0byBzdGFydCBwbGF5aW5nIHRoZSB0cmFjay5cbiAgICAgICAgY29uc3QgaXNQbGF5aW5nID0gdGhpcy5pc1BsYXlpbmc7XG5cbiAgICAgICAgaWYgKGlzUGxheWluZykge1xuICAgICAgICAgICAgLy8gUGF1c2UgZmlyc3Qgc28gd2UgY2FuIGdldCBhbiBhY2N1cmF0ZSBtZWFzdXJlbWVudCBvZiB0aW1lXG4gICAgICAgICAgICBhd2FpdCB0aGlzLmNvbnRleHQuc3VzcGVuZCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gV2UgY2FuJ3Qgc2ltcGx5IHRlbGwgdGhlIGNvbnRleHQvYnVmZmVyIHRvIGp1bXAgdG8gYSB0aW1lLCBzbyB3ZSBoYXZlIHRvXG4gICAgICAgIC8vIHN0YXJ0IGEgd2hvbGUgbmV3IGJ1ZmZlciBhbmQgc3RhcnQgaXQgZnJvbSB0aGUgbmV3IHRpbWUgb2Zmc2V0LlxuICAgICAgICBjb25zdCBub3cgPSB0aGlzLmNvbnRleHQuY3VycmVudFRpbWU7XG4gICAgICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgICAgICB0aGlzLm1ha2VOZXdTb3VyY2VCdWZmZXIoKTtcblxuICAgICAgICAvLyBXZSBoYXZlIHRvIHJlc3luYyB0aGUgY2xvY2sgYmVjYXVzZSBpdCBjYW4gZ2V0IGNvbmZ1c2VkIGFib3V0IHdoZXJlIHdlJ3JlXG4gICAgICAgIC8vIGF0IGluIHRoZSBhdWRpbyBjbGlwLlxuICAgICAgICB0aGlzLmNsb2NrLnN5bmNUbyhub3csIHRpbWVTZWNvbmRzKTtcblxuICAgICAgICAvLyBBbHdheXMgc3RhcnQgdGhlIHNvdXJjZSB0byBxdWV1ZSBpdCB1cC4gV2UgaGF2ZSB0byBkbyB0aGlzIG5vdyAoYW5kIHBhdXNlXG4gICAgICAgIC8vIHF1aWNrbHkgaWYgd2UncmUgbm90IHN1cHBvc2VkIHRvIGJlIHBsYXlpbmcpIGFzIG90aGVyd2lzZSB0aGUgY2xvY2sgY2FuIGRlc3luY1xuICAgICAgICAvLyB3aGVuIGl0IGNvbWVzIHRpbWUgdG8gdGhlIHVzZXIgaGl0dGluZyBwbGF5LiBBZnRlciBhIGNvdXBsZSBqdW1wcywgdGhlIHVzZXJcbiAgICAgICAgLy8gd2lsbCBoYXZlIGRlc3luY2VkIHRoZSBjbG9jayBlbm91Z2ggdG8gYmUgYWJvdXQgMTAtMTUgc2Vjb25kcyBvZmYsIHdoaWxlIHRoaXNcbiAgICAgICAgLy8ga2VlcHMgaXQgYXMgY2xvc2UgdG8gcGVyZmVjdCBhcyBodW1hbnMgY2FuIHBlcmNlaXZlLlxuICAgICAgICBpZiAodGhpcy5lbGVtZW50KSB7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnQuY3VycmVudFRpbWUgPSB0aW1lU2Vjb25kcztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICh0aGlzLnNvdXJjZSBhcyBBdWRpb0J1ZmZlclNvdXJjZU5vZGUpLnN0YXJ0KG5vdywgdGltZVNlY29uZHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRGV2IG5vdGU6IGl0J3MgY3JpdGljYWwgdGhhdCB0aGUgY29kZSBnYXAgYmV0d2VlbiBgdGhpcy5zb3VyY2Uuc3RhcnQoKWAgYW5kXG4gICAgICAgIC8vIGB0aGlzLnBhdXNlKClgIGlzIGFzIHNtYWxsIGFzIHBvc3NpYmxlOiB3ZSBkbyBub3Qgd2FudCB0byBkZWxheSAqYW55dGhpbmcqXG4gICAgICAgIC8vIGFzIHRoYXQgY291bGQgY2F1c2UgYSBjbG9jayBkZXN5bmMsIG9yIGEgYnVnZ3kgZmVlbGluZyBhcyBhIHNpbmdsZSBub3RlIHBsYXlzXG4gICAgICAgIC8vIGR1cmluZyBzZWVraW5nLlxuXG4gICAgICAgIGlmIChpc1BsYXlpbmcpIHtcbiAgICAgICAgICAgIC8vIElmIHdlIHdlcmUgcGxheWluZyBiZWZvcmUsIGNvbnRpbnVlIHRoZSBjb250ZXh0IHNvIHRoZSBjbG9jayBkb2Vzbid0IGRlc3luYy5cbiAgICAgICAgICAgIGF3YWl0IHRoaXMuY29udGV4dC5yZXN1bWUoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIEFzIG1lbnRpb25lZCBhYm92ZSwgd2UnbGwgaGF2ZSB0byBwYXVzZSB0aGUgY2xpcCBpZiB3ZSB3ZXJlbid0IHN1cHBvc2VkIHRvXG4gICAgICAgICAgICAvLyBiZSBwbGF5aW5nIGl0IGp1c3QgeWV0LiBJZiB3ZSBkaWRuJ3QgaGF2ZSB0aGlzLCB0aGUgYXVkaW8gY2xpcCBwbGF5cyBidXQgYWxsXG4gICAgICAgICAgICAvLyB0aGUgc3RhdGVzIHdpbGwgYmUgd3Jvbmc6IGNsb2NrIHdvbid0IGFkdmFuY2UsIHBhdXNlIHN0YXRlIGRvZXNuJ3QgbWF0Y2ggdGhlXG4gICAgICAgICAgICAvLyBibGFyaW5nIG5vaXNlIGxlYXZpbmcgdGhlIHVzZXIncyBzcGVha2VycywgZXRjLlxuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vIEFsc28gYXMgbWVudGlvbmVkLCBpZiB0aGUgY29kZSBnYXAgaXMgc21hbGwgZW5vdWdoIHRoZW4gdGhpcyBzaG91bGQgYmVcbiAgICAgICAgICAgIC8vIGV4ZWN1dGVkIGltbWVkaWF0ZWx5IGFmdGVyIHRoZSBzdGFydCB0aW1lLCBsZWF2aW5nIG5vIGZlYXNpYmxlIHRpbWUgZm9yIHRoZVxuICAgICAgICAgICAgLy8gdXNlcidzIHNwZWFrZXJzIHRvIHBsYXkgYW55IHNvdW5kLlxuICAgICAgICAgICAgYXdhaXQgdGhpcy5wYXVzZSgpO1xuICAgICAgICB9XG4gICAgfVxufVxuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQWdCQSxJQUFBQSxPQUFBLEdBQUFDLHNCQUFBLENBQUFDLE9BQUE7QUFDQSxJQUFBQyxnQkFBQSxHQUFBRCxPQUFBO0FBQ0EsSUFBQUUsT0FBQSxHQUFBRixPQUFBO0FBQ0EsSUFBQUcsTUFBQSxHQUFBSCxPQUFBO0FBR0EsSUFBQUksZUFBQSxHQUFBTCxzQkFBQSxDQUFBQyxPQUFBO0FBQ0EsSUFBQUssV0FBQSxHQUFBTCxPQUFBO0FBQ0EsSUFBQU0sT0FBQSxHQUFBTixPQUFBO0FBRUEsSUFBQU8sY0FBQSxHQUFBUCxPQUFBO0FBQ0EsSUFBQVEsT0FBQSxHQUFBUixPQUFBO0FBQ0EsSUFBQVMsUUFBQSxHQUFBVCxPQUFBO0FBQ0EsSUFBQVUsY0FBQSxHQUFBVixPQUFBO0FBQ0EsSUFBQVcsT0FBQSxHQUFBWCxPQUFBO0FBOUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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