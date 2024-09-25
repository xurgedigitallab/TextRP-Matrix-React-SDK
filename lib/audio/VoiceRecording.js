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
//# sourceMappingURL=VoiceRecording.js.map