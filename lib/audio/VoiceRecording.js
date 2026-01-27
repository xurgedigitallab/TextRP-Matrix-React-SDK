"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.voiceRecorderOptions = exports.highQualityRecorderOptions = exports.VoiceRecording = exports.SAMPLE_RATE = exports.RecordingState = exports.RECORDING_PLAYBACK_SAMPLES = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _recorderMin = _interopRequireDefault(require("opus-recorder/dist/recorder.min.js"));
var _encoderWorkerMin = _interopRequireDefault(require("opus-recorder/dist/encoderWorker.min.js"));
var _matrixWidgetApi = require("matrix-widget-api");
var _events = _interopRequireDefault(require("events"));
var _logger = require("matrix-js-sdk/src/logger");
var _MediaDeviceHandler = _interopRequireDefault(require("../MediaDeviceHandler"));
var _Singleflight = require("../utils/Singleflight");
var _consts = require("./consts");
var _AsyncStore = require("../stores/AsyncStore");
var _compat = require("./compat");
var _FixedRollingArray = require("../utils/FixedRollingArray");
var _numbers = require("../utils/numbers");
var _RecorderWorklet = _interopRequireDefault(require("./RecorderWorklet"));
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

const CHANNELS = 1; // stereo isn't important
const SAMPLE_RATE = 48000; // 48khz is what WebRTC uses. 12khz is where we lose quality.
exports.SAMPLE_RATE = SAMPLE_RATE;
const TARGET_MAX_LENGTH = 900; // 15 minutes in seconds. Somewhat arbitrary, though longer == larger files.
const TARGET_WARN_TIME_LEFT = 10; // 10 seconds, also somewhat arbitrary.

const RECORDING_PLAYBACK_SAMPLES = 44;
exports.RECORDING_PLAYBACK_SAMPLES = RECORDING_PLAYBACK_SAMPLES;
const voiceRecorderOptions = {
  bitrate: 24000,
  // recommended Opus bitrate for high-quality VoIP
  encoderApplication: 2048 // voice
};
exports.voiceRecorderOptions = voiceRecorderOptions;
const highQualityRecorderOptions = {
  bitrate: 96000,
  // recommended Opus bitrate for high-quality music/audio streaming
  encoderApplication: 2049 // full band audio
};
exports.highQualityRecorderOptions = highQualityRecorderOptions;
let RecordingState = /*#__PURE__*/function (RecordingState) {
  RecordingState["Started"] = "started";
  RecordingState["EndingSoon"] = "ending_soon";
  RecordingState["Ended"] = "ended";
  RecordingState["Uploading"] = "uploading";
  RecordingState["Uploaded"] = "uploaded";
  return RecordingState;
}({});
exports.RecordingState = RecordingState;
class VoiceRecording extends _events.default {
  constructor() {
    super(...arguments);
    (0, _defineProperty2.default)(this, "recorder", void 0);
    (0, _defineProperty2.default)(this, "recorderContext", void 0);
    (0, _defineProperty2.default)(this, "recorderSource", void 0);
    (0, _defineProperty2.default)(this, "recorderStream", void 0);
    (0, _defineProperty2.default)(this, "recorderWorklet", void 0);
    (0, _defineProperty2.default)(this, "recorderProcessor", void 0);
    (0, _defineProperty2.default)(this, "recording", false);
    (0, _defineProperty2.default)(this, "observable", void 0);
    (0, _defineProperty2.default)(this, "targetMaxLength", TARGET_MAX_LENGTH);
    (0, _defineProperty2.default)(this, "amplitudes", []);
    // at each second mark, generated
    (0, _defineProperty2.default)(this, "liveWaveform", new _FixedRollingArray.FixedRollingArray(RECORDING_PLAYBACK_SAMPLES, 0));
    (0, _defineProperty2.default)(this, "onDataAvailable", void 0);
    (0, _defineProperty2.default)(this, "onAudioProcess", ev => {
      this.processAudioUpdate(ev.playbackTime);

      // We skip the functionality of the worklet regarding waveform calculations: we
      // should get that information pretty quick during the playback info.
    });
    (0, _defineProperty2.default)(this, "processAudioUpdate", timeSeconds => {
      if (!this.recording) return;
      this.observable.update({
        waveform: this.liveWaveform.value.map(v => (0, _numbers.clamp)(v, 0, 1)),
        timeSeconds: timeSeconds
      });

      // Now that we've updated the data/waveform, let's do a time check. We don't want to
      // go horribly over the limit. We also emit a warning state if needed.
      //
      // We use the recorder's perspective of time to make sure we don't cut off the last
      // frame of audio, otherwise we end up with a 14:59 clip (899.68 seconds). This extra
      // safety can allow us to overshoot the target a bit, but at least when we say 15min
      // maximum we actually mean it.
      //
      // In testing, recorder time and worker time lag by about 400ms, which is roughly the
      // time needed to encode a sample/frame.
      //

      if (!this.targetMaxLength) {
        // skip time checks if max length has been disabled
        return;
      }
      const secondsLeft = TARGET_MAX_LENGTH - this.recorderSeconds;
      if (secondsLeft < 0) {
        // go over to make sure we definitely capture that last frame
        // noinspection JSIgnoredPromiseFromCall - we aren't concerned with it overlapping
        this.stop();
      } else if (secondsLeft <= TARGET_WARN_TIME_LEFT) {
        _Singleflight.Singleflight.for(this, "ending_soon").do(() => {
          this.emit(RecordingState.EndingSoon, {
            secondsLeft
          });
          return _Singleflight.Singleflight.Void;
        });
      }
    });
  }
  get contentType() {
    return "audio/ogg";
  }
  get durationSeconds() {
    if (!this.recorder || !this.recorderContext) throw new Error("Duration not available without a recording");
    return this.recorderContext.currentTime;
  }
  get isRecording() {
    return this.recording;
  }
  emit(event) {
    for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }
    super.emit(event, ...args);
    super.emit(_AsyncStore.UPDATE_EVENT, event, ...args);
    return true; // we don't ever care if the event had listeners, so just return "yes"
  }

  disableMaxLength() {
    this.targetMaxLength = null;
  }
  shouldRecordInHighQuality() {
    // Non-voice use case is suspected when noise suppression is disabled by the user.
    // When recording complex audio, higher quality is required to avoid audio artifacts.
    // This is a really arbitrary decision, but it can be refined/replaced at any time.
    return !_MediaDeviceHandler.default.getAudioNoiseSuppression();
  }
  async makeRecorder() {
    try {
      this.recorderStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: CHANNELS,
          deviceId: _MediaDeviceHandler.default.getAudioInput(),
          autoGainControl: {
            ideal: _MediaDeviceHandler.default.getAudioAutoGainControl()
          },
          echoCancellation: {
            ideal: _MediaDeviceHandler.default.getAudioEchoCancellation()
          },
          noiseSuppression: {
            ideal: _MediaDeviceHandler.default.getAudioNoiseSuppression()
          }
        }
      });
      this.recorderContext = (0, _compat.createAudioContext)({
        // latencyHint: "interactive", // we don't want a latency hint (this causes data smoothing)
      });
      this.recorderSource = this.recorderContext.createMediaStreamSource(this.recorderStream);

      // Connect our inputs and outputs
      if (this.recorderContext.audioWorklet) {
        // Set up our worklet. We use this for timing information and waveform analysis: the
        // web audio API prefers this be done async to avoid holding the main thread with math.
        await this.recorderContext.audioWorklet.addModule(_RecorderWorklet.default);
        this.recorderWorklet = new AudioWorkletNode(this.recorderContext, _consts.WORKLET_NAME);
        this.recorderSource.connect(this.recorderWorklet);
        this.recorderWorklet.connect(this.recorderContext.destination);

        // Dev note: we can't use `addEventListener` for some reason. It just doesn't work.
        this.recorderWorklet.port.onmessage = ev => {
          switch (ev.data["ev"]) {
            case _consts.PayloadEvent.Timekeep:
              this.processAudioUpdate(ev.data["timeSeconds"]);
              break;
            case _consts.PayloadEvent.AmplitudeMark:
              // Sanity check to make sure we're adding about one sample per second
              if (ev.data["forIndex"] === this.amplitudes.length) {
                this.amplitudes.push(ev.data["amplitude"]);
                this.liveWaveform.pushValue(ev.data["amplitude"]);
              }
              break;
          }
        };
      } else {
        // Safari fallback: use a processor node instead, buffered to 1024 bytes of data
        // like the worklet is.
        this.recorderProcessor = this.recorderContext.createScriptProcessor(1024, CHANNELS, CHANNELS);
        this.recorderSource.connect(this.recorderProcessor);
        this.recorderProcessor.connect(this.recorderContext.destination);
        this.recorderProcessor.addEventListener("audioprocess", this.onAudioProcess);
      }
      const recorderOptions = this.shouldRecordInHighQuality() ? highQualityRecorderOptions : voiceRecorderOptions;
      const {
        encoderApplication,
        bitrate
      } = recorderOptions;
      this.recorder = new _recorderMin.default({
        encoderPath: _encoderWorkerMin.default,
        // magic from webpack
        encoderSampleRate: SAMPLE_RATE,
        encoderApplication: encoderApplication,
        streamPages: true,
        // this speeds up the encoding process by using CPU over time
        encoderFrameSize: 20,
        // ms, arbitrary frame size we send to the encoder
        numberOfChannels: CHANNELS,
        sourceNode: this.recorderSource,
        encoderBitRate: bitrate,
        // We use low values for the following to ease CPU usage - the resulting waveform
        // is indistinguishable for a voice message. Note that the underlying library will
        // pick defaults which prefer the highest possible quality, CPU be damned.
        encoderComplexity: 3,
        // 0-10, 10 is slow and high quality.
        resampleQuality: 3 // 0-10, 10 is slow and high quality
      });

      // not using EventEmitter here because it leads to detached bufferes
      this.recorder.ondataavailable = data => this.onDataAvailable?.(data);
    } catch (e) {
      _logger.logger.error("Error starting recording: ", e);
      if (e instanceof DOMException) {
        // Unhelpful DOMExceptions are common - parse them sanely
        _logger.logger.error(`${e.name} (${e.code}): ${e.message}`);
      }

      // Clean up as best as possible
      if (this.recorderStream) this.recorderStream.getTracks().forEach(t => t.stop());
      if (this.recorderSource) this.recorderSource.disconnect();
      if (this.recorder) this.recorder.close();
      if (this.recorderContext) {
        // noinspection ES6MissingAwait - not important that we wait
        this.recorderContext.close();
      }
      throw e; // rethrow so upstream can handle it
    }
  }

  get liveData() {
    if (!this.recording || !this.observable) throw new Error("No observable when not recording");
    return this.observable;
  }
  get isSupported() {
    return !!_recorderMin.default.isRecordingSupported();
  }
  /**
   * {@link https://github.com/chris-rudmin/opus-recorder#instance-fields ref for recorderSeconds}
   */
  get recorderSeconds() {
    if (!this.recorder) return undefined;
    return this.recorder.encodedSamplePosition / 48000;
  }
  async start() {
    if (this.recording) {
      throw new Error("Recording already in progress");
    }
    if (this.observable) {
      this.observable.close();
    }
    this.observable = new _matrixWidgetApi.SimpleObservable();
    await this.makeRecorder();
    await this.recorder?.start();
    this.recording = true;
    this.emit(RecordingState.Started);
  }
  async stop() {
    return _Singleflight.Singleflight.for(this, "stop").do(async () => {
      if (!this.recording) {
        throw new Error("No recording to stop");
      }

      // Disconnect the source early to start shutting down resources
      await this.recorder.stop(); // stop first to flush the last frame
      this.recorderSource.disconnect();
      if (this.recorderWorklet) this.recorderWorklet.disconnect();
      if (this.recorderProcessor) {
        this.recorderProcessor.disconnect();
        this.recorderProcessor.removeEventListener("audioprocess", this.onAudioProcess);
      }

      // close the context after the recorder so the recorder doesn't try to
      // connect anything to the context (this would generate a warning)
      await this.recorderContext.close();

      // Now stop all the media tracks so we can release them back to the user/OS
      this.recorderStream.getTracks().forEach(t => t.stop());

      // Finally do our post-processing and clean up
      this.recording = false;
      await this.recorder.close();
      this.emit(RecordingState.Ended);
    });
  }
  destroy() {
    // noinspection JSIgnoredPromiseFromCall - not concerned about stop() being called async here
    this.stop();
    this.removeAllListeners();
    this.onDataAvailable = undefined;
    _Singleflight.Singleflight.forgetAllFor(this);
    // noinspection JSIgnoredPromiseFromCall - not concerned about being called async here
    this.observable?.close();
  }
}
exports.VoiceRecording = VoiceRecording;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfcmVjb3JkZXJNaW4iLCJfaW50ZXJvcFJlcXVpcmVEZWZhdWx0IiwicmVxdWlyZSIsIl9lbmNvZGVyV29ya2VyTWluIiwiX21hdHJpeFdpZGdldEFwaSIsIl9ldmVudHMiLCJfbG9nZ2VyIiwiX01lZGlhRGV2aWNlSGFuZGxlciIsIl9TaW5nbGVmbGlnaHQiLCJfY29uc3RzIiwiX0FzeW5jU3RvcmUiLCJfY29tcGF0IiwiX0ZpeGVkUm9sbGluZ0FycmF5IiwiX251bWJlcnMiLCJfUmVjb3JkZXJXb3JrbGV0IiwiQ0hBTk5FTFMiLCJTQU1QTEVfUkFURSIsImV4cG9ydHMiLCJUQVJHRVRfTUFYX0xFTkdUSCIsIlRBUkdFVF9XQVJOX1RJTUVfTEVGVCIsIlJFQ09SRElOR19QTEFZQkFDS19TQU1QTEVTIiwidm9pY2VSZWNvcmRlck9wdGlvbnMiLCJiaXRyYXRlIiwiZW5jb2RlckFwcGxpY2F0aW9uIiwiaGlnaFF1YWxpdHlSZWNvcmRlck9wdGlvbnMiLCJSZWNvcmRpbmdTdGF0ZSIsIlZvaWNlUmVjb3JkaW5nIiwiRXZlbnRFbWl0dGVyIiwiY29uc3RydWN0b3IiLCJhcmd1bWVudHMiLCJfZGVmaW5lUHJvcGVydHkyIiwiZGVmYXVsdCIsIkZpeGVkUm9sbGluZ0FycmF5IiwiZXYiLCJwcm9jZXNzQXVkaW9VcGRhdGUiLCJwbGF5YmFja1RpbWUiLCJ0aW1lU2Vjb25kcyIsInJlY29yZGluZyIsIm9ic2VydmFibGUiLCJ1cGRhdGUiLCJ3YXZlZm9ybSIsImxpdmVXYXZlZm9ybSIsInZhbHVlIiwibWFwIiwidiIsImNsYW1wIiwidGFyZ2V0TWF4TGVuZ3RoIiwic2Vjb25kc0xlZnQiLCJyZWNvcmRlclNlY29uZHMiLCJzdG9wIiwiU2luZ2xlZmxpZ2h0IiwiZm9yIiwiZG8iLCJlbWl0IiwiRW5kaW5nU29vbiIsIlZvaWQiLCJjb250ZW50VHlwZSIsImR1cmF0aW9uU2Vjb25kcyIsInJlY29yZGVyIiwicmVjb3JkZXJDb250ZXh0IiwiRXJyb3IiLCJjdXJyZW50VGltZSIsImlzUmVjb3JkaW5nIiwiZXZlbnQiLCJfbGVuIiwibGVuZ3RoIiwiYXJncyIsIkFycmF5IiwiX2tleSIsIlVQREFURV9FVkVOVCIsImRpc2FibGVNYXhMZW5ndGgiLCJzaG91bGRSZWNvcmRJbkhpZ2hRdWFsaXR5IiwiTWVkaWFEZXZpY2VIYW5kbGVyIiwiZ2V0QXVkaW9Ob2lzZVN1cHByZXNzaW9uIiwibWFrZVJlY29yZGVyIiwicmVjb3JkZXJTdHJlYW0iLCJuYXZpZ2F0b3IiLCJtZWRpYURldmljZXMiLCJnZXRVc2VyTWVkaWEiLCJhdWRpbyIsImNoYW5uZWxDb3VudCIsImRldmljZUlkIiwiZ2V0QXVkaW9JbnB1dCIsImF1dG9HYWluQ29udHJvbCIsImlkZWFsIiwiZ2V0QXVkaW9BdXRvR2FpbkNvbnRyb2wiLCJlY2hvQ2FuY2VsbGF0aW9uIiwiZ2V0QXVkaW9FY2hvQ2FuY2VsbGF0aW9uIiwibm9pc2VTdXBwcmVzc2lvbiIsImNyZWF0ZUF1ZGlvQ29udGV4dCIsInJlY29yZGVyU291cmNlIiwiY3JlYXRlTWVkaWFTdHJlYW1Tb3VyY2UiLCJhdWRpb1dvcmtsZXQiLCJhZGRNb2R1bGUiLCJteFJlY29yZGVyV29ya2xldFBhdGgiLCJyZWNvcmRlcldvcmtsZXQiLCJBdWRpb1dvcmtsZXROb2RlIiwiV09SS0xFVF9OQU1FIiwiY29ubmVjdCIsImRlc3RpbmF0aW9uIiwicG9ydCIsIm9ubWVzc2FnZSIsImRhdGEiLCJQYXlsb2FkRXZlbnQiLCJUaW1la2VlcCIsIkFtcGxpdHVkZU1hcmsiLCJhbXBsaXR1ZGVzIiwicHVzaCIsInB1c2hWYWx1ZSIsInJlY29yZGVyUHJvY2Vzc29yIiwiY3JlYXRlU2NyaXB0UHJvY2Vzc29yIiwiYWRkRXZlbnRMaXN0ZW5lciIsIm9uQXVkaW9Qcm9jZXNzIiwicmVjb3JkZXJPcHRpb25zIiwiUmVjb3JkZXIiLCJlbmNvZGVyUGF0aCIsImVuY29kZXJTYW1wbGVSYXRlIiwic3RyZWFtUGFnZXMiLCJlbmNvZGVyRnJhbWVTaXplIiwibnVtYmVyT2ZDaGFubmVscyIsInNvdXJjZU5vZGUiLCJlbmNvZGVyQml0UmF0ZSIsImVuY29kZXJDb21wbGV4aXR5IiwicmVzYW1wbGVRdWFsaXR5Iiwib25kYXRhYXZhaWxhYmxlIiwib25EYXRhQXZhaWxhYmxlIiwiZSIsImxvZ2dlciIsImVycm9yIiwiRE9NRXhjZXB0aW9uIiwibmFtZSIsImNvZGUiLCJtZXNzYWdlIiwiZ2V0VHJhY2tzIiwiZm9yRWFjaCIsInQiLCJkaXNjb25uZWN0IiwiY2xvc2UiLCJsaXZlRGF0YSIsImlzU3VwcG9ydGVkIiwiaXNSZWNvcmRpbmdTdXBwb3J0ZWQiLCJ1bmRlZmluZWQiLCJlbmNvZGVkU2FtcGxlUG9zaXRpb24iLCJzdGFydCIsIlNpbXBsZU9ic2VydmFibGUiLCJTdGFydGVkIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsIkVuZGVkIiwiZGVzdHJveSIsInJlbW92ZUFsbExpc3RlbmVycyIsImZvcmdldEFsbEZvciJdLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9hdWRpby9Wb2ljZVJlY29yZGluZy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuQ29weXJpZ2h0IDIwMjEgVGhlIE1hdHJpeC5vcmcgRm91bmRhdGlvbiBDLkkuQy5cblxuTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbnlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbllvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuXG4gICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG5cblVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbmRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbldJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxubGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4qL1xuXG5pbXBvcnQgUmVjb3JkZXIgZnJvbSBcIm9wdXMtcmVjb3JkZXIvZGlzdC9yZWNvcmRlci5taW4uanNcIjtcbmltcG9ydCBlbmNvZGVyUGF0aCBmcm9tIFwib3B1cy1yZWNvcmRlci9kaXN0L2VuY29kZXJXb3JrZXIubWluLmpzXCI7XG5pbXBvcnQgeyBTaW1wbGVPYnNlcnZhYmxlIH0gZnJvbSBcIm1hdHJpeC13aWRnZXQtYXBpXCI7XG5pbXBvcnQgRXZlbnRFbWl0dGVyIGZyb20gXCJldmVudHNcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCJtYXRyaXgtanMtc2RrL3NyYy9sb2dnZXJcIjtcblxuaW1wb3J0IE1lZGlhRGV2aWNlSGFuZGxlciBmcm9tIFwiLi4vTWVkaWFEZXZpY2VIYW5kbGVyXCI7XG5pbXBvcnQgeyBJRGVzdHJveWFibGUgfSBmcm9tIFwiLi4vdXRpbHMvSURlc3Ryb3lhYmxlXCI7XG5pbXBvcnQgeyBTaW5nbGVmbGlnaHQgfSBmcm9tIFwiLi4vdXRpbHMvU2luZ2xlZmxpZ2h0XCI7XG5pbXBvcnQgeyBQYXlsb2FkRXZlbnQsIFdPUktMRVRfTkFNRSB9IGZyb20gXCIuL2NvbnN0c1wiO1xuaW1wb3J0IHsgVVBEQVRFX0VWRU5UIH0gZnJvbSBcIi4uL3N0b3Jlcy9Bc3luY1N0b3JlXCI7XG5pbXBvcnQgeyBjcmVhdGVBdWRpb0NvbnRleHQgfSBmcm9tIFwiLi9jb21wYXRcIjtcbmltcG9ydCB7IEZpeGVkUm9sbGluZ0FycmF5IH0gZnJvbSBcIi4uL3V0aWxzL0ZpeGVkUm9sbGluZ0FycmF5XCI7XG5pbXBvcnQgeyBjbGFtcCB9IGZyb20gXCIuLi91dGlscy9udW1iZXJzXCI7XG5pbXBvcnQgbXhSZWNvcmRlcldvcmtsZXRQYXRoIGZyb20gXCIuL1JlY29yZGVyV29ya2xldFwiO1xuXG5jb25zdCBDSEFOTkVMUyA9IDE7IC8vIHN0ZXJlbyBpc24ndCBpbXBvcnRhbnRcbmV4cG9ydCBjb25zdCBTQU1QTEVfUkFURSA9IDQ4MDAwOyAvLyA0OGtoeiBpcyB3aGF0IFdlYlJUQyB1c2VzLiAxMmtoeiBpcyB3aGVyZSB3ZSBsb3NlIHF1YWxpdHkuXG5jb25zdCBUQVJHRVRfTUFYX0xFTkdUSCA9IDkwMDsgLy8gMTUgbWludXRlcyBpbiBzZWNvbmRzLiBTb21ld2hhdCBhcmJpdHJhcnksIHRob3VnaCBsb25nZXIgPT0gbGFyZ2VyIGZpbGVzLlxuY29uc3QgVEFSR0VUX1dBUk5fVElNRV9MRUZUID0gMTA7IC8vIDEwIHNlY29uZHMsIGFsc28gc29tZXdoYXQgYXJiaXRyYXJ5LlxuXG5leHBvcnQgY29uc3QgUkVDT1JESU5HX1BMQVlCQUNLX1NBTVBMRVMgPSA0NDtcblxuaW50ZXJmYWNlIFJlY29yZGVyT3B0aW9ucyB7XG4gICAgYml0cmF0ZTogbnVtYmVyO1xuICAgIGVuY29kZXJBcHBsaWNhdGlvbjogbnVtYmVyO1xufVxuXG5leHBvcnQgY29uc3Qgdm9pY2VSZWNvcmRlck9wdGlvbnM6IFJlY29yZGVyT3B0aW9ucyA9IHtcbiAgICBiaXRyYXRlOiAyNDAwMCwgLy8gcmVjb21tZW5kZWQgT3B1cyBiaXRyYXRlIGZvciBoaWdoLXF1YWxpdHkgVm9JUFxuICAgIGVuY29kZXJBcHBsaWNhdGlvbjogMjA0OCwgLy8gdm9pY2Vcbn07XG5cbmV4cG9ydCBjb25zdCBoaWdoUXVhbGl0eVJlY29yZGVyT3B0aW9uczogUmVjb3JkZXJPcHRpb25zID0ge1xuICAgIGJpdHJhdGU6IDk2MDAwLCAvLyByZWNvbW1lbmRlZCBPcHVzIGJpdHJhdGUgZm9yIGhpZ2gtcXVhbGl0eSBtdXNpYy9hdWRpbyBzdHJlYW1pbmdcbiAgICBlbmNvZGVyQXBwbGljYXRpb246IDIwNDksIC8vIGZ1bGwgYmFuZCBhdWRpb1xufTtcblxuZXhwb3J0IGludGVyZmFjZSBJUmVjb3JkaW5nVXBkYXRlIHtcbiAgICB3YXZlZm9ybTogbnVtYmVyW107IC8vIGZsb2F0aW5nIHBvaW50cyBiZXR3ZWVuIDAgKGxvdykgYW5kIDEgKGhpZ2gpLlxuICAgIHRpbWVTZWNvbmRzOiBudW1iZXI7IC8vIGZsb2F0XG59XG5cbmV4cG9ydCBlbnVtIFJlY29yZGluZ1N0YXRlIHtcbiAgICBTdGFydGVkID0gXCJzdGFydGVkXCIsXG4gICAgRW5kaW5nU29vbiA9IFwiZW5kaW5nX3Nvb25cIiwgLy8gZW1pdHMgYW4gb2JqZWN0IHdpdGggYSBzaW5nbGUgbnVtZXJpY2FsIHZhbHVlOiBzZWNvbmRzTGVmdFxuICAgIEVuZGVkID0gXCJlbmRlZFwiLFxuICAgIFVwbG9hZGluZyA9IFwidXBsb2FkaW5nXCIsXG4gICAgVXBsb2FkZWQgPSBcInVwbG9hZGVkXCIsXG59XG5cbmV4cG9ydCBjbGFzcyBWb2ljZVJlY29yZGluZyBleHRlbmRzIEV2ZW50RW1pdHRlciBpbXBsZW1lbnRzIElEZXN0cm95YWJsZSB7XG4gICAgcHJpdmF0ZSByZWNvcmRlcj86IFJlY29yZGVyO1xuICAgIHByaXZhdGUgcmVjb3JkZXJDb250ZXh0PzogQXVkaW9Db250ZXh0O1xuICAgIHByaXZhdGUgcmVjb3JkZXJTb3VyY2U/OiBNZWRpYVN0cmVhbUF1ZGlvU291cmNlTm9kZTtcbiAgICBwcml2YXRlIHJlY29yZGVyU3RyZWFtPzogTWVkaWFTdHJlYW07XG4gICAgcHJpdmF0ZSByZWNvcmRlcldvcmtsZXQ/OiBBdWRpb1dvcmtsZXROb2RlO1xuICAgIHByaXZhdGUgcmVjb3JkZXJQcm9jZXNzb3I/OiBTY3JpcHRQcm9jZXNzb3JOb2RlO1xuICAgIHByaXZhdGUgcmVjb3JkaW5nID0gZmFsc2U7XG4gICAgcHJpdmF0ZSBvYnNlcnZhYmxlPzogU2ltcGxlT2JzZXJ2YWJsZTxJUmVjb3JkaW5nVXBkYXRlPjtcbiAgICBwcml2YXRlIHRhcmdldE1heExlbmd0aDogbnVtYmVyIHwgbnVsbCA9IFRBUkdFVF9NQVhfTEVOR1RIO1xuICAgIHB1YmxpYyBhbXBsaXR1ZGVzOiBudW1iZXJbXSA9IFtdOyAvLyBhdCBlYWNoIHNlY29uZCBtYXJrLCBnZW5lcmF0ZWRcbiAgICBwcml2YXRlIGxpdmVXYXZlZm9ybSA9IG5ldyBGaXhlZFJvbGxpbmdBcnJheShSRUNPUkRJTkdfUExBWUJBQ0tfU0FNUExFUywgMCk7XG4gICAgcHVibGljIG9uRGF0YUF2YWlsYWJsZT86IChkYXRhOiBBcnJheUJ1ZmZlcikgPT4gdm9pZDtcblxuICAgIHB1YmxpYyBnZXQgY29udGVudFR5cGUoKTogc3RyaW5nIHtcbiAgICAgICAgcmV0dXJuIFwiYXVkaW8vb2dnXCI7XG4gICAgfVxuXG4gICAgcHVibGljIGdldCBkdXJhdGlvblNlY29uZHMoKTogbnVtYmVyIHtcbiAgICAgICAgaWYgKCF0aGlzLnJlY29yZGVyIHx8ICF0aGlzLnJlY29yZGVyQ29udGV4dCkgdGhyb3cgbmV3IEVycm9yKFwiRHVyYXRpb24gbm90IGF2YWlsYWJsZSB3aXRob3V0IGEgcmVjb3JkaW5nXCIpO1xuICAgICAgICByZXR1cm4gdGhpcy5yZWNvcmRlckNvbnRleHQuY3VycmVudFRpbWU7XG4gICAgfVxuXG4gICAgcHVibGljIGdldCBpc1JlY29yZGluZygpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucmVjb3JkaW5nO1xuICAgIH1cblxuICAgIHB1YmxpYyBlbWl0KGV2ZW50OiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKTogYm9vbGVhbiB7XG4gICAgICAgIHN1cGVyLmVtaXQoZXZlbnQsIC4uLmFyZ3MpO1xuICAgICAgICBzdXBlci5lbWl0KFVQREFURV9FVkVOVCwgZXZlbnQsIC4uLmFyZ3MpO1xuICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gd2UgZG9uJ3QgZXZlciBjYXJlIGlmIHRoZSBldmVudCBoYWQgbGlzdGVuZXJzLCBzbyBqdXN0IHJldHVybiBcInllc1wiXG4gICAgfVxuXG4gICAgcHVibGljIGRpc2FibGVNYXhMZW5ndGgoKTogdm9pZCB7XG4gICAgICAgIHRoaXMudGFyZ2V0TWF4TGVuZ3RoID0gbnVsbDtcbiAgICB9XG5cbiAgICBwcml2YXRlIHNob3VsZFJlY29yZEluSGlnaFF1YWxpdHkoKTogYm9vbGVhbiB7XG4gICAgICAgIC8vIE5vbi12b2ljZSB1c2UgY2FzZSBpcyBzdXNwZWN0ZWQgd2hlbiBub2lzZSBzdXBwcmVzc2lvbiBpcyBkaXNhYmxlZCBieSB0aGUgdXNlci5cbiAgICAgICAgLy8gV2hlbiByZWNvcmRpbmcgY29tcGxleCBhdWRpbywgaGlnaGVyIHF1YWxpdHkgaXMgcmVxdWlyZWQgdG8gYXZvaWQgYXVkaW8gYXJ0aWZhY3RzLlxuICAgICAgICAvLyBUaGlzIGlzIGEgcmVhbGx5IGFyYml0cmFyeSBkZWNpc2lvbiwgYnV0IGl0IGNhbiBiZSByZWZpbmVkL3JlcGxhY2VkIGF0IGFueSB0aW1lLlxuICAgICAgICByZXR1cm4gIU1lZGlhRGV2aWNlSGFuZGxlci5nZXRBdWRpb05vaXNlU3VwcHJlc3Npb24oKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIG1ha2VSZWNvcmRlcigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHRoaXMucmVjb3JkZXJTdHJlYW0gPSBhd2FpdCBuYXZpZ2F0b3IubWVkaWFEZXZpY2VzLmdldFVzZXJNZWRpYSh7XG4gICAgICAgICAgICAgICAgYXVkaW86IHtcbiAgICAgICAgICAgICAgICAgICAgY2hhbm5lbENvdW50OiBDSEFOTkVMUyxcbiAgICAgICAgICAgICAgICAgICAgZGV2aWNlSWQ6IE1lZGlhRGV2aWNlSGFuZGxlci5nZXRBdWRpb0lucHV0KCksXG4gICAgICAgICAgICAgICAgICAgIGF1dG9HYWluQ29udHJvbDogeyBpZGVhbDogTWVkaWFEZXZpY2VIYW5kbGVyLmdldEF1ZGlvQXV0b0dhaW5Db250cm9sKCkgfSxcbiAgICAgICAgICAgICAgICAgICAgZWNob0NhbmNlbGxhdGlvbjogeyBpZGVhbDogTWVkaWFEZXZpY2VIYW5kbGVyLmdldEF1ZGlvRWNob0NhbmNlbGxhdGlvbigpIH0sXG4gICAgICAgICAgICAgICAgICAgIG5vaXNlU3VwcHJlc3Npb246IHsgaWRlYWw6IE1lZGlhRGV2aWNlSGFuZGxlci5nZXRBdWRpb05vaXNlU3VwcHJlc3Npb24oKSB9LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRoaXMucmVjb3JkZXJDb250ZXh0ID0gY3JlYXRlQXVkaW9Db250ZXh0KHtcbiAgICAgICAgICAgICAgICAvLyBsYXRlbmN5SGludDogXCJpbnRlcmFjdGl2ZVwiLCAvLyB3ZSBkb24ndCB3YW50IGEgbGF0ZW5jeSBoaW50ICh0aGlzIGNhdXNlcyBkYXRhIHNtb290aGluZylcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhpcy5yZWNvcmRlclNvdXJjZSA9IHRoaXMucmVjb3JkZXJDb250ZXh0LmNyZWF0ZU1lZGlhU3RyZWFtU291cmNlKHRoaXMucmVjb3JkZXJTdHJlYW0pO1xuXG4gICAgICAgICAgICAvLyBDb25uZWN0IG91ciBpbnB1dHMgYW5kIG91dHB1dHNcbiAgICAgICAgICAgIGlmICh0aGlzLnJlY29yZGVyQ29udGV4dC5hdWRpb1dvcmtsZXQpIHtcbiAgICAgICAgICAgICAgICAvLyBTZXQgdXAgb3VyIHdvcmtsZXQuIFdlIHVzZSB0aGlzIGZvciB0aW1pbmcgaW5mb3JtYXRpb24gYW5kIHdhdmVmb3JtIGFuYWx5c2lzOiB0aGVcbiAgICAgICAgICAgICAgICAvLyB3ZWIgYXVkaW8gQVBJIHByZWZlcnMgdGhpcyBiZSBkb25lIGFzeW5jIHRvIGF2b2lkIGhvbGRpbmcgdGhlIG1haW4gdGhyZWFkIHdpdGggbWF0aC5cbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnJlY29yZGVyQ29udGV4dC5hdWRpb1dvcmtsZXQuYWRkTW9kdWxlKG14UmVjb3JkZXJXb3JrbGV0UGF0aCk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWNvcmRlcldvcmtsZXQgPSBuZXcgQXVkaW9Xb3JrbGV0Tm9kZSh0aGlzLnJlY29yZGVyQ29udGV4dCwgV09SS0xFVF9OQU1FKTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlY29yZGVyU291cmNlLmNvbm5lY3QodGhpcy5yZWNvcmRlcldvcmtsZXQpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVjb3JkZXJXb3JrbGV0LmNvbm5lY3QodGhpcy5yZWNvcmRlckNvbnRleHQuZGVzdGluYXRpb24pO1xuXG4gICAgICAgICAgICAgICAgLy8gRGV2IG5vdGU6IHdlIGNhbid0IHVzZSBgYWRkRXZlbnRMaXN0ZW5lcmAgZm9yIHNvbWUgcmVhc29uLiBJdCBqdXN0IGRvZXNuJ3Qgd29yay5cbiAgICAgICAgICAgICAgICB0aGlzLnJlY29yZGVyV29ya2xldC5wb3J0Lm9ubWVzc2FnZSA9IChldikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2ggKGV2LmRhdGFbXCJldlwiXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBQYXlsb2FkRXZlbnQuVGltZWtlZXA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9jZXNzQXVkaW9VcGRhdGUoZXYuZGF0YVtcInRpbWVTZWNvbmRzXCJdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgUGF5bG9hZEV2ZW50LkFtcGxpdHVkZU1hcms6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gU2FuaXR5IGNoZWNrIHRvIG1ha2Ugc3VyZSB3ZSdyZSBhZGRpbmcgYWJvdXQgb25lIHNhbXBsZSBwZXIgc2Vjb25kXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGV2LmRhdGFbXCJmb3JJbmRleFwiXSA9PT0gdGhpcy5hbXBsaXR1ZGVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFtcGxpdHVkZXMucHVzaChldi5kYXRhW1wiYW1wbGl0dWRlXCJdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5saXZlV2F2ZWZvcm0ucHVzaFZhbHVlKGV2LmRhdGFbXCJhbXBsaXR1ZGVcIl0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIFNhZmFyaSBmYWxsYmFjazogdXNlIGEgcHJvY2Vzc29yIG5vZGUgaW5zdGVhZCwgYnVmZmVyZWQgdG8gMTAyNCBieXRlcyBvZiBkYXRhXG4gICAgICAgICAgICAgICAgLy8gbGlrZSB0aGUgd29ya2xldCBpcy5cbiAgICAgICAgICAgICAgICB0aGlzLnJlY29yZGVyUHJvY2Vzc29yID0gdGhpcy5yZWNvcmRlckNvbnRleHQuY3JlYXRlU2NyaXB0UHJvY2Vzc29yKDEwMjQsIENIQU5ORUxTLCBDSEFOTkVMUyk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWNvcmRlclNvdXJjZS5jb25uZWN0KHRoaXMucmVjb3JkZXJQcm9jZXNzb3IpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVjb3JkZXJQcm9jZXNzb3IuY29ubmVjdCh0aGlzLnJlY29yZGVyQ29udGV4dC5kZXN0aW5hdGlvbik7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWNvcmRlclByb2Nlc3Nvci5hZGRFdmVudExpc3RlbmVyKFwiYXVkaW9wcm9jZXNzXCIsIHRoaXMub25BdWRpb1Byb2Nlc3MpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCByZWNvcmRlck9wdGlvbnMgPSB0aGlzLnNob3VsZFJlY29yZEluSGlnaFF1YWxpdHkoKVxuICAgICAgICAgICAgICAgID8gaGlnaFF1YWxpdHlSZWNvcmRlck9wdGlvbnNcbiAgICAgICAgICAgICAgICA6IHZvaWNlUmVjb3JkZXJPcHRpb25zO1xuICAgICAgICAgICAgY29uc3QgeyBlbmNvZGVyQXBwbGljYXRpb24sIGJpdHJhdGUgfSA9IHJlY29yZGVyT3B0aW9ucztcblxuICAgICAgICAgICAgdGhpcy5yZWNvcmRlciA9IG5ldyBSZWNvcmRlcih7XG4gICAgICAgICAgICAgICAgZW5jb2RlclBhdGgsIC8vIG1hZ2ljIGZyb20gd2VicGFja1xuICAgICAgICAgICAgICAgIGVuY29kZXJTYW1wbGVSYXRlOiBTQU1QTEVfUkFURSxcbiAgICAgICAgICAgICAgICBlbmNvZGVyQXBwbGljYXRpb246IGVuY29kZXJBcHBsaWNhdGlvbixcbiAgICAgICAgICAgICAgICBzdHJlYW1QYWdlczogdHJ1ZSwgLy8gdGhpcyBzcGVlZHMgdXAgdGhlIGVuY29kaW5nIHByb2Nlc3MgYnkgdXNpbmcgQ1BVIG92ZXIgdGltZVxuICAgICAgICAgICAgICAgIGVuY29kZXJGcmFtZVNpemU6IDIwLCAvLyBtcywgYXJiaXRyYXJ5IGZyYW1lIHNpemUgd2Ugc2VuZCB0byB0aGUgZW5jb2RlclxuICAgICAgICAgICAgICAgIG51bWJlck9mQ2hhbm5lbHM6IENIQU5ORUxTLFxuICAgICAgICAgICAgICAgIHNvdXJjZU5vZGU6IHRoaXMucmVjb3JkZXJTb3VyY2UsXG4gICAgICAgICAgICAgICAgZW5jb2RlckJpdFJhdGU6IGJpdHJhdGUsXG5cbiAgICAgICAgICAgICAgICAvLyBXZSB1c2UgbG93IHZhbHVlcyBmb3IgdGhlIGZvbGxvd2luZyB0byBlYXNlIENQVSB1c2FnZSAtIHRoZSByZXN1bHRpbmcgd2F2ZWZvcm1cbiAgICAgICAgICAgICAgICAvLyBpcyBpbmRpc3Rpbmd1aXNoYWJsZSBmb3IgYSB2b2ljZSBtZXNzYWdlLiBOb3RlIHRoYXQgdGhlIHVuZGVybHlpbmcgbGlicmFyeSB3aWxsXG4gICAgICAgICAgICAgICAgLy8gcGljayBkZWZhdWx0cyB3aGljaCBwcmVmZXIgdGhlIGhpZ2hlc3QgcG9zc2libGUgcXVhbGl0eSwgQ1BVIGJlIGRhbW5lZC5cbiAgICAgICAgICAgICAgICBlbmNvZGVyQ29tcGxleGl0eTogMywgLy8gMC0xMCwgMTAgaXMgc2xvdyBhbmQgaGlnaCBxdWFsaXR5LlxuICAgICAgICAgICAgICAgIHJlc2FtcGxlUXVhbGl0eTogMywgLy8gMC0xMCwgMTAgaXMgc2xvdyBhbmQgaGlnaCBxdWFsaXR5XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gbm90IHVzaW5nIEV2ZW50RW1pdHRlciBoZXJlIGJlY2F1c2UgaXQgbGVhZHMgdG8gZGV0YWNoZWQgYnVmZmVyZXNcbiAgICAgICAgICAgIHRoaXMucmVjb3JkZXIub25kYXRhYXZhaWxhYmxlID0gKGRhdGE6IEFycmF5QnVmZmVyKSA9PiB0aGlzLm9uRGF0YUF2YWlsYWJsZT8uKGRhdGEpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBsb2dnZXIuZXJyb3IoXCJFcnJvciBzdGFydGluZyByZWNvcmRpbmc6IFwiLCBlKTtcbiAgICAgICAgICAgIGlmIChlIGluc3RhbmNlb2YgRE9NRXhjZXB0aW9uKSB7XG4gICAgICAgICAgICAgICAgLy8gVW5oZWxwZnVsIERPTUV4Y2VwdGlvbnMgYXJlIGNvbW1vbiAtIHBhcnNlIHRoZW0gc2FuZWx5XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmVycm9yKGAke2UubmFtZX0gKCR7ZS5jb2RlfSk6ICR7ZS5tZXNzYWdlfWApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDbGVhbiB1cCBhcyBiZXN0IGFzIHBvc3NpYmxlXG4gICAgICAgICAgICBpZiAodGhpcy5yZWNvcmRlclN0cmVhbSkgdGhpcy5yZWNvcmRlclN0cmVhbS5nZXRUcmFja3MoKS5mb3JFYWNoKCh0KSA9PiB0LnN0b3AoKSk7XG4gICAgICAgICAgICBpZiAodGhpcy5yZWNvcmRlclNvdXJjZSkgdGhpcy5yZWNvcmRlclNvdXJjZS5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICBpZiAodGhpcy5yZWNvcmRlcikgdGhpcy5yZWNvcmRlci5jbG9zZSgpO1xuICAgICAgICAgICAgaWYgKHRoaXMucmVjb3JkZXJDb250ZXh0KSB7XG4gICAgICAgICAgICAgICAgLy8gbm9pbnNwZWN0aW9uIEVTNk1pc3NpbmdBd2FpdCAtIG5vdCBpbXBvcnRhbnQgdGhhdCB3ZSB3YWl0XG4gICAgICAgICAgICAgICAgdGhpcy5yZWNvcmRlckNvbnRleHQuY2xvc2UoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhyb3cgZTsgLy8gcmV0aHJvdyBzbyB1cHN0cmVhbSBjYW4gaGFuZGxlIGl0XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0IGxpdmVEYXRhKCk6IFNpbXBsZU9ic2VydmFibGU8SVJlY29yZGluZ1VwZGF0ZT4ge1xuICAgICAgICBpZiAoIXRoaXMucmVjb3JkaW5nIHx8ICF0aGlzLm9ic2VydmFibGUpIHRocm93IG5ldyBFcnJvcihcIk5vIG9ic2VydmFibGUgd2hlbiBub3QgcmVjb3JkaW5nXCIpO1xuICAgICAgICByZXR1cm4gdGhpcy5vYnNlcnZhYmxlO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXQgaXNTdXBwb3J0ZWQoKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiAhIVJlY29yZGVyLmlzUmVjb3JkaW5nU3VwcG9ydGVkKCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBvbkF1ZGlvUHJvY2VzcyA9IChldjogQXVkaW9Qcm9jZXNzaW5nRXZlbnQpOiB2b2lkID0+IHtcbiAgICAgICAgdGhpcy5wcm9jZXNzQXVkaW9VcGRhdGUoZXYucGxheWJhY2tUaW1lKTtcblxuICAgICAgICAvLyBXZSBza2lwIHRoZSBmdW5jdGlvbmFsaXR5IG9mIHRoZSB3b3JrbGV0IHJlZ2FyZGluZyB3YXZlZm9ybSBjYWxjdWxhdGlvbnM6IHdlXG4gICAgICAgIC8vIHNob3VsZCBnZXQgdGhhdCBpbmZvcm1hdGlvbiBwcmV0dHkgcXVpY2sgZHVyaW5nIHRoZSBwbGF5YmFjayBpbmZvLlxuICAgIH07XG5cbiAgICBwcml2YXRlIHByb2Nlc3NBdWRpb1VwZGF0ZSA9ICh0aW1lU2Vjb25kczogbnVtYmVyKTogdm9pZCA9PiB7XG4gICAgICAgIGlmICghdGhpcy5yZWNvcmRpbmcpIHJldHVybjtcblxuICAgICAgICB0aGlzLm9ic2VydmFibGUhLnVwZGF0ZSh7XG4gICAgICAgICAgICB3YXZlZm9ybTogdGhpcy5saXZlV2F2ZWZvcm0udmFsdWUubWFwKCh2KSA9PiBjbGFtcCh2LCAwLCAxKSksXG4gICAgICAgICAgICB0aW1lU2Vjb25kczogdGltZVNlY29uZHMsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIE5vdyB0aGF0IHdlJ3ZlIHVwZGF0ZWQgdGhlIGRhdGEvd2F2ZWZvcm0sIGxldCdzIGRvIGEgdGltZSBjaGVjay4gV2UgZG9uJ3Qgd2FudCB0b1xuICAgICAgICAvLyBnbyBob3JyaWJseSBvdmVyIHRoZSBsaW1pdC4gV2UgYWxzbyBlbWl0IGEgd2FybmluZyBzdGF0ZSBpZiBuZWVkZWQuXG4gICAgICAgIC8vXG4gICAgICAgIC8vIFdlIHVzZSB0aGUgcmVjb3JkZXIncyBwZXJzcGVjdGl2ZSBvZiB0aW1lIHRvIG1ha2Ugc3VyZSB3ZSBkb24ndCBjdXQgb2ZmIHRoZSBsYXN0XG4gICAgICAgIC8vIGZyYW1lIG9mIGF1ZGlvLCBvdGhlcndpc2Ugd2UgZW5kIHVwIHdpdGggYSAxNDo1OSBjbGlwICg4OTkuNjggc2Vjb25kcykuIFRoaXMgZXh0cmFcbiAgICAgICAgLy8gc2FmZXR5IGNhbiBhbGxvdyB1cyB0byBvdmVyc2hvb3QgdGhlIHRhcmdldCBhIGJpdCwgYnV0IGF0IGxlYXN0IHdoZW4gd2Ugc2F5IDE1bWluXG4gICAgICAgIC8vIG1heGltdW0gd2UgYWN0dWFsbHkgbWVhbiBpdC5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gSW4gdGVzdGluZywgcmVjb3JkZXIgdGltZSBhbmQgd29ya2VyIHRpbWUgbGFnIGJ5IGFib3V0IDQwMG1zLCB3aGljaCBpcyByb3VnaGx5IHRoZVxuICAgICAgICAvLyB0aW1lIG5lZWRlZCB0byBlbmNvZGUgYSBzYW1wbGUvZnJhbWUuXG4gICAgICAgIC8vXG5cbiAgICAgICAgaWYgKCF0aGlzLnRhcmdldE1heExlbmd0aCkge1xuICAgICAgICAgICAgLy8gc2tpcCB0aW1lIGNoZWNrcyBpZiBtYXggbGVuZ3RoIGhhcyBiZWVuIGRpc2FibGVkXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzZWNvbmRzTGVmdCA9IFRBUkdFVF9NQVhfTEVOR1RIIC0gdGhpcy5yZWNvcmRlclNlY29uZHMhO1xuICAgICAgICBpZiAoc2Vjb25kc0xlZnQgPCAwKSB7XG4gICAgICAgICAgICAvLyBnbyBvdmVyIHRvIG1ha2Ugc3VyZSB3ZSBkZWZpbml0ZWx5IGNhcHR1cmUgdGhhdCBsYXN0IGZyYW1lXG4gICAgICAgICAgICAvLyBub2luc3BlY3Rpb24gSlNJZ25vcmVkUHJvbWlzZUZyb21DYWxsIC0gd2UgYXJlbid0IGNvbmNlcm5lZCB3aXRoIGl0IG92ZXJsYXBwaW5nXG4gICAgICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICAgICAgfSBlbHNlIGlmIChzZWNvbmRzTGVmdCA8PSBUQVJHRVRfV0FSTl9USU1FX0xFRlQpIHtcbiAgICAgICAgICAgIFNpbmdsZWZsaWdodC5mb3IodGhpcywgXCJlbmRpbmdfc29vblwiKS5kbygoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5lbWl0KFJlY29yZGluZ1N0YXRlLkVuZGluZ1Nvb24sIHsgc2Vjb25kc0xlZnQgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFNpbmdsZWZsaWdodC5Wb2lkO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICoge0BsaW5rIGh0dHBzOi8vZ2l0aHViLmNvbS9jaHJpcy1ydWRtaW4vb3B1cy1yZWNvcmRlciNpbnN0YW5jZS1maWVsZHMgcmVmIGZvciByZWNvcmRlclNlY29uZHN9XG4gICAgICovXG4gICAgcHVibGljIGdldCByZWNvcmRlclNlY29uZHMoKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcbiAgICAgICAgaWYgKCF0aGlzLnJlY29yZGVyKSByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICByZXR1cm4gdGhpcy5yZWNvcmRlci5lbmNvZGVkU2FtcGxlUG9zaXRpb24gLyA0ODAwMDtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgc3RhcnQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGlmICh0aGlzLnJlY29yZGluZykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUmVjb3JkaW5nIGFscmVhZHkgaW4gcHJvZ3Jlc3NcIik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMub2JzZXJ2YWJsZSkge1xuICAgICAgICAgICAgdGhpcy5vYnNlcnZhYmxlLmNsb3NlKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5vYnNlcnZhYmxlID0gbmV3IFNpbXBsZU9ic2VydmFibGU8SVJlY29yZGluZ1VwZGF0ZT4oKTtcbiAgICAgICAgYXdhaXQgdGhpcy5tYWtlUmVjb3JkZXIoKTtcbiAgICAgICAgYXdhaXQgdGhpcy5yZWNvcmRlcj8uc3RhcnQoKTtcbiAgICAgICAgdGhpcy5yZWNvcmRpbmcgPSB0cnVlO1xuICAgICAgICB0aGlzLmVtaXQoUmVjb3JkaW5nU3RhdGUuU3RhcnRlZCk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHN0b3AoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIHJldHVybiBTaW5nbGVmbGlnaHQuZm9yKHRoaXMsIFwic3RvcFwiKS5kbyhhc3luYyAoKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICAgICAgICBpZiAoIXRoaXMucmVjb3JkaW5nKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm8gcmVjb3JkaW5nIHRvIHN0b3BcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIERpc2Nvbm5lY3QgdGhlIHNvdXJjZSBlYXJseSB0byBzdGFydCBzaHV0dGluZyBkb3duIHJlc291cmNlc1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5yZWNvcmRlciEuc3RvcCgpOyAvLyBzdG9wIGZpcnN0IHRvIGZsdXNoIHRoZSBsYXN0IGZyYW1lXG4gICAgICAgICAgICB0aGlzLnJlY29yZGVyU291cmNlIS5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICBpZiAodGhpcy5yZWNvcmRlcldvcmtsZXQpIHRoaXMucmVjb3JkZXJXb3JrbGV0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnJlY29yZGVyUHJvY2Vzc29yKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWNvcmRlclByb2Nlc3Nvci5kaXNjb25uZWN0KCk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWNvcmRlclByb2Nlc3Nvci5yZW1vdmVFdmVudExpc3RlbmVyKFwiYXVkaW9wcm9jZXNzXCIsIHRoaXMub25BdWRpb1Byb2Nlc3MpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBjbG9zZSB0aGUgY29udGV4dCBhZnRlciB0aGUgcmVjb3JkZXIgc28gdGhlIHJlY29yZGVyIGRvZXNuJ3QgdHJ5IHRvXG4gICAgICAgICAgICAvLyBjb25uZWN0IGFueXRoaW5nIHRvIHRoZSBjb250ZXh0ICh0aGlzIHdvdWxkIGdlbmVyYXRlIGEgd2FybmluZylcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucmVjb3JkZXJDb250ZXh0IS5jbG9zZSgpO1xuXG4gICAgICAgICAgICAvLyBOb3cgc3RvcCBhbGwgdGhlIG1lZGlhIHRyYWNrcyBzbyB3ZSBjYW4gcmVsZWFzZSB0aGVtIGJhY2sgdG8gdGhlIHVzZXIvT1NcbiAgICAgICAgICAgIHRoaXMucmVjb3JkZXJTdHJlYW0hLmdldFRyYWNrcygpLmZvckVhY2goKHQpID0+IHQuc3RvcCgpKTtcblxuICAgICAgICAgICAgLy8gRmluYWxseSBkbyBvdXIgcG9zdC1wcm9jZXNzaW5nIGFuZCBjbGVhbiB1cFxuICAgICAgICAgICAgdGhpcy5yZWNvcmRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucmVjb3JkZXIhLmNsb3NlKCk7XG4gICAgICAgICAgICB0aGlzLmVtaXQoUmVjb3JkaW5nU3RhdGUuRW5kZWQpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZGVzdHJveSgpOiB2b2lkIHtcbiAgICAgICAgLy8gbm9pbnNwZWN0aW9uIEpTSWdub3JlZFByb21pc2VGcm9tQ2FsbCAtIG5vdCBjb25jZXJuZWQgYWJvdXQgc3RvcCgpIGJlaW5nIGNhbGxlZCBhc3luYyBoZXJlXG4gICAgICAgIHRoaXMuc3RvcCgpO1xuICAgICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICAgICAgICB0aGlzLm9uRGF0YUF2YWlsYWJsZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgU2luZ2xlZmxpZ2h0LmZvcmdldEFsbEZvcih0aGlzKTtcbiAgICAgICAgLy8gbm9pbnNwZWN0aW9uIEpTSWdub3JlZFByb21pc2VGcm9tQ2FsbCAtIG5vdCBjb25jZXJuZWQgYWJvdXQgYmVpbmcgY2FsbGVkIGFzeW5jIGhlcmVcbiAgICAgICAgdGhpcy5vYnNlcnZhYmxlPy5jbG9zZSgpO1xuICAgIH1cbn1cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFnQkEsSUFBQUEsWUFBQSxHQUFBQyxzQkFBQSxDQUFBQyxPQUFBO0FBQ0EsSUFBQUMsaUJBQUEsR0FBQUYsc0JBQUEsQ0FBQUMsT0FBQTtBQUNBLElBQUFFLGdCQUFBLEdBQUFGLE9BQUE7QUFDQSxJQUFBRyxPQUFBLEdBQUFKLHNCQUFBLENBQUFDLE9BQUE7QUFDQSxJQUFBSSxPQUFBLEdBQUFKLE9BQUE7QUFFQSxJQUFBSyxtQkFBQSxHQUFBTixzQkFBQSxDQUFBQyxPQUFBO0FBRUEsSUFBQU0sYUFBQSxHQUFBTixPQUFBO0FBQ0EsSUFBQU8sT0FBQSxHQUFBUCxPQUFBO0FBQ0EsSUFBQVEsV0FBQSxHQUFBUixPQUFBO0FBQ0EsSUFBQVMsT0FBQSxHQUFBVCxPQUFBO0FBQ0EsSUFBQVUs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