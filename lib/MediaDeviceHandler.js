"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.MediaDeviceKindEnum = exports.MediaDeviceHandlerEvent = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _events = _interopRequireDefault(require("events"));
var _logger = require("matrix-js-sdk/src/logger");
var _SettingsStore = _interopRequireDefault(require("./settings/SettingsStore"));
var _SettingLevel = require("./settings/SettingLevel");
var _MatrixClientPeg = require("./MatrixClientPeg");
var _languageHandler = require("./languageHandler");
/*
Copyright 2017 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

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
// XXX: MediaDeviceKind is a union type, so we make our own enum
let MediaDeviceKindEnum = /*#__PURE__*/function (MediaDeviceKindEnum) {
  MediaDeviceKindEnum["AudioOutput"] = "audiooutput";
  MediaDeviceKindEnum["AudioInput"] = "audioinput";
  MediaDeviceKindEnum["VideoInput"] = "videoinput";
  return MediaDeviceKindEnum;
}({});
exports.MediaDeviceKindEnum = MediaDeviceKindEnum;
let MediaDeviceHandlerEvent = /*#__PURE__*/function (MediaDeviceHandlerEvent) {
  MediaDeviceHandlerEvent["AudioOutputChanged"] = "audio_output_changed";
  return MediaDeviceHandlerEvent;
}({});
exports.MediaDeviceHandlerEvent = MediaDeviceHandlerEvent;
class MediaDeviceHandler extends _events.default {
  static get instance() {
    if (!MediaDeviceHandler.internalInstance) {
      MediaDeviceHandler.internalInstance = new MediaDeviceHandler();
    }
    return MediaDeviceHandler.internalInstance;
  }
  static async hasAnyLabeledDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some(d => Boolean(d.label));
  }

  /**
   * Gets the available audio input/output and video input devices
   * from the browser: a thin wrapper around mediaDevices.enumerateDevices()
   * that also returns results by type of devices. Note that this requires
   * user media permissions and an active stream, otherwise you'll get blank
   * device labels.
   *
   * Once the Permissions API
   * (https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API)
   * is ready for primetime, it might help make this simpler.
   *
   * @return Promise<IMediaDevices> The available media devices
   */
  static async getDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const output = {
        [MediaDeviceKindEnum.AudioOutput]: [],
        [MediaDeviceKindEnum.AudioInput]: [],
        [MediaDeviceKindEnum.VideoInput]: []
      };
      devices.forEach(device => output[device.kind].push(device));
      return output;
    } catch (error) {
      _logger.logger.warn("Unable to refresh WebRTC Devices: ", error);
    }
  }
  /**
   * Retrieves devices from the SettingsStore and tells the js-sdk to use them
   */
  static async loadDevices() {
    const audioDeviceId = _SettingsStore.default.getValue("webrtc_audioinput");
    const videoDeviceId = _SettingsStore.default.getValue("webrtc_videoinput");
    await _MatrixClientPeg.MatrixClientPeg.get().getMediaHandler().setAudioInput(audioDeviceId);
    await _MatrixClientPeg.MatrixClientPeg.get().getMediaHandler().setVideoInput(videoDeviceId);
    await MediaDeviceHandler.updateAudioSettings();
  }
  static async updateAudioSettings() {
    await _MatrixClientPeg.MatrixClientPeg.get().getMediaHandler().setAudioSettings({
      autoGainControl: MediaDeviceHandler.getAudioAutoGainControl(),
      echoCancellation: MediaDeviceHandler.getAudioEchoCancellation(),
      noiseSuppression: MediaDeviceHandler.getAudioNoiseSuppression()
    });
  }
  setAudioOutput(deviceId) {
    _SettingsStore.default.setValue("webrtc_audiooutput", null, _SettingLevel.SettingLevel.DEVICE, deviceId);
    this.emit(MediaDeviceHandlerEvent.AudioOutputChanged, deviceId);
  }

  /**
   * This will not change the device that a potential call uses. The call will
   * need to be ended and started again for this change to take effect
   * @param {string} deviceId
   */
  async setAudioInput(deviceId) {
    _SettingsStore.default.setValue("webrtc_audioinput", null, _SettingLevel.SettingLevel.DEVICE, deviceId);
    return _MatrixClientPeg.MatrixClientPeg.get().getMediaHandler().setAudioInput(deviceId);
  }

  /**
   * This will not change the device that a potential call uses. The call will
   * need to be ended and started again for this change to take effect
   * @param {string} deviceId
   */
  async setVideoInput(deviceId) {
    _SettingsStore.default.setValue("webrtc_videoinput", null, _SettingLevel.SettingLevel.DEVICE, deviceId);
    return _MatrixClientPeg.MatrixClientPeg.get().getMediaHandler().setVideoInput(deviceId);
  }
  async setDevice(deviceId, kind) {
    switch (kind) {
      case MediaDeviceKindEnum.AudioOutput:
        this.setAudioOutput(deviceId);
        break;
      case MediaDeviceKindEnum.AudioInput:
        await this.setAudioInput(deviceId);
        break;
      case MediaDeviceKindEnum.VideoInput:
        await this.setVideoInput(deviceId);
        break;
    }
  }
  static async setAudioAutoGainControl(value) {
    await _SettingsStore.default.setValue("webrtc_audio_autoGainControl", null, _SettingLevel.SettingLevel.DEVICE, value);
    await MediaDeviceHandler.updateAudioSettings();
  }
  static async setAudioEchoCancellation(value) {
    await _SettingsStore.default.setValue("webrtc_audio_echoCancellation", null, _SettingLevel.SettingLevel.DEVICE, value);
    await MediaDeviceHandler.updateAudioSettings();
  }
  static async setAudioNoiseSuppression(value) {
    await _SettingsStore.default.setValue("webrtc_audio_noiseSuppression", null, _SettingLevel.SettingLevel.DEVICE, value);
    await MediaDeviceHandler.updateAudioSettings();
  }
  static getAudioOutput() {
    return _SettingsStore.default.getValueAt(_SettingLevel.SettingLevel.DEVICE, "webrtc_audiooutput");
  }
  static getAudioInput() {
    return _SettingsStore.default.getValueAt(_SettingLevel.SettingLevel.DEVICE, "webrtc_audioinput");
  }
  static getVideoInput() {
    return _SettingsStore.default.getValueAt(_SettingLevel.SettingLevel.DEVICE, "webrtc_videoinput");
  }
  static getAudioAutoGainControl() {
    return _SettingsStore.default.getValue("webrtc_audio_autoGainControl");
  }
  static getAudioEchoCancellation() {
    return _SettingsStore.default.getValue("webrtc_audio_echoCancellation");
  }
  static getAudioNoiseSuppression() {
    return _SettingsStore.default.getValue("webrtc_audio_noiseSuppression");
  }

  /**
   * Returns the current set deviceId for a device kind
   * @param {MediaDeviceKindEnum} kind of the device that will be returned
   * @returns {string} the deviceId
   */
  static getDevice(kind) {
    switch (kind) {
      case MediaDeviceKindEnum.AudioOutput:
        return this.getAudioOutput();
      case MediaDeviceKindEnum.AudioInput:
        return this.getAudioInput();
      case MediaDeviceKindEnum.VideoInput:
        return this.getVideoInput();
    }
  }
  static get startWithAudioMuted() {
    return _SettingsStore.default.getValue("audioInputMuted");
  }
  static set startWithAudioMuted(value) {
    _SettingsStore.default.setValue("audioInputMuted", null, _SettingLevel.SettingLevel.DEVICE, value);
  }
  static get startWithVideoMuted() {
    return _SettingsStore.default.getValue("videoInputMuted");
  }
  static set startWithVideoMuted(value) {
    _SettingsStore.default.setValue("videoInputMuted", null, _SettingLevel.SettingLevel.DEVICE, value);
  }
}
exports.default = MediaDeviceHandler;
(0, _defineProperty2.default)(MediaDeviceHandler, "internalInstance", void 0);
(0, _defineProperty2.default)(MediaDeviceHandler, "getDefaultDevice", devices => {
  // Note we're looking for a device with deviceId 'default' but adding a device
  // with deviceId == the empty string: this is because Chrome gives us a device
  // with deviceId 'default', so we're looking for this, not the one we are adding.
  if (!devices.some(i => i.deviceId === "default")) {
    devices.unshift({
      deviceId: "",
      label: (0, _languageHandler._t)("Default Device")
    });
    return "";
  } else {
    return "default";
  }
});
//# sourceMappingURL=MediaDeviceHandler.js.map