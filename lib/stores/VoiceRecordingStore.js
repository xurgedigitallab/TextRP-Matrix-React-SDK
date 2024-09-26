"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.VoiceRecordingStore = void 0;
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _event = require("matrix-js-sdk/src/@types/event");
var _AsyncStoreWithClient = require("./AsyncStoreWithClient");
var _dispatcher = _interopRequireDefault(require("../dispatcher/dispatcher"));
var _VoiceMessageRecording = require("../audio/VoiceMessageRecording");
function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return typeof key === "symbol" ? key : String(key); }
function _toPrimitive(input, hint) { if (typeof input !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (typeof res !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         Copyright 2021 - 2022 The Matrix.org Foundation C.I.C.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         
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
const SEPARATOR = "|";
class VoiceRecordingStore extends _AsyncStoreWithClient.AsyncStoreWithClient {
  constructor() {
    super(_dispatcher.default, {});
  }
  static get instance() {
    if (!this.internalInstance) {
      this.internalInstance = new VoiceRecordingStore();
      this.internalInstance.start();
    }
    return this.internalInstance;
  }
  async onAction(payload) {
    // Nothing to do, but we're required to override the function
    return;
  }
  static getVoiceRecordingId(room, relation) {
    if (relation?.rel_type === "io.element.thread" || relation?.rel_type === _event.RelationType.Thread) {
      return room.roomId + SEPARATOR + relation.event_id;
    } else {
      return room.roomId;
    }
  }

  /**
   * Gets the active recording instance, if any.
   * @param {string} voiceRecordingId The room ID (with optionally the thread ID if in one) to get the recording in.
   * @returns {Optional<VoiceRecording>} The recording, if any.
   */
  getActiveRecording(voiceRecordingId) {
    return this.state[voiceRecordingId];
  }

  /**
   * Starts a new recording if one isn't already in progress. Note that this simply
   * creates a recording instance - whether or not recording is actively in progress
   * can be seen via the VoiceRecording class.
   * @param {string} voiceRecordingId The room ID (with optionally the thread ID if in one) to start recording in.
   * @returns {VoiceRecording} The recording.
   */
  startRecording(voiceRecordingId) {
    if (!this.matrixClient) throw new Error("Cannot start a recording without a MatrixClient");
    if (!voiceRecordingId) throw new Error("Recording must be associated with a room");
    if (this.state[voiceRecordingId]) throw new Error("A recording is already in progress");
    const recording = (0, _VoiceMessageRecording.createVoiceMessageRecording)(this.matrixClient);

    // noinspection JSIgnoredPromiseFromCall - we can safely run this async
    this.updateState(_objectSpread(_objectSpread({}, this.state), {}, {
      [voiceRecordingId]: recording
    }));
    return recording;
  }

  /**
   * Disposes of the current recording, no matter the state of it.
   * @param {string} voiceRecordingId The room ID (with optionally the thread ID if in one) to dispose of the recording in.
   * @returns {Promise<void>} Resolves when complete.
   */
  disposeRecording(voiceRecordingId) {
    this.state[voiceRecordingId]?.destroy(); // stops internally

    const _this$state = this.state,
      {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        [voiceRecordingId]: _toDelete
      } = _this$state,
      newState = (0, _objectWithoutProperties2.default)(_this$state, [voiceRecordingId].map(_toPropertyKey));
    // unexpectedly AsyncStore.updateState merges state
    // AsyncStore.reset actually just *sets*
    return this.reset(newState);
  }
}
exports.VoiceRecordingStore = VoiceRecordingStore;
(0, _defineProperty2.default)(VoiceRecordingStore, "internalInstance", void 0);
window.mxVoiceRecordingStore = VoiceRecordingStore.instance;
//# sourceMappingURL=VoiceRecordingStore.js.map