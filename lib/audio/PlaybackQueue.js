"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PlaybackQueue = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _event = require("matrix-js-sdk/src/@types/event");
var _logger = require("matrix-js-sdk/src/logger");
var _Playback = require("./Playback");
var _AsyncStore = require("../stores/AsyncStore");
var _MatrixClientPeg = require("../MatrixClientPeg");
var _arrays = require("../utils/arrays");
var _PlaybackManager = require("./PlaybackManager");
var _EventUtils = require("../utils/EventUtils");
var _SDKContext = require("../contexts/SDKContext");
/*
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

/**
 * Audio playback queue management for a given room. This keeps track of where the user
 * was at for each playback, what order the playbacks were played in, and triggers subsequent
 * playbacks.
 *
 * Currently this is only intended to be used by voice messages.
 *
 * The primary mechanics are:
 * * Persisted clock state for each playback instance (tied to Event ID).
 * * Limited memory of playback order (see code; not persisted).
 * * Autoplay of next eligible playback instance.
 */
class PlaybackQueue {
  // event IDs

  constructor(room) {
    this.room = room;
    // keyed by room ID
    (0, _defineProperty2.default)(this, "playbacks", new Map());
    // keyed by event ID
    (0, _defineProperty2.default)(this, "clockStates", new Map());
    // keyed by event ID
    (0, _defineProperty2.default)(this, "playbackIdOrder", []);
    // event IDs, last == current
    (0, _defineProperty2.default)(this, "currentPlaybackId", null);
    // event ID, broken out from above for ease of use
    (0, _defineProperty2.default)(this, "recentFullPlays", new Set());
    this.loadClocks();
    _SDKContext.SdkContextClass.instance.roomViewStore.addRoomListener(this.room.roomId, isActive => {
      if (!isActive) return;

      // Reset the state of the playbacks before they start mounting and enqueuing updates.
      // We reset the entirety of the queue, including order, to ensure the user isn't left
      // confused with what order the messages are playing in.
      this.currentPlaybackId = null; // this in particular stops autoplay when the room is switched to
      this.recentFullPlays = new Set();
      this.playbackIdOrder = [];
    });
  }
  static forRoom(roomId) {
    const cli = _MatrixClientPeg.MatrixClientPeg.get();
    const room = cli.getRoom(roomId);
    if (!room) throw new Error("Unknown room");
    if (PlaybackQueue.queues.has(room.roomId)) {
      return PlaybackQueue.queues.get(room.roomId);
    }
    const queue = new PlaybackQueue(room);
    PlaybackQueue.queues.set(room.roomId, queue);
    return queue;
  }
  persistClocks() {
    localStorage.setItem(`mx_voice_message_clocks_${this.room.roomId}`, JSON.stringify(Array.from(this.clockStates.entries())));
  }
  loadClocks() {
    const val = localStorage.getItem(`mx_voice_message_clocks_${this.room.roomId}`);
    if (!!val) {
      this.clockStates = new Map(JSON.parse(val));
    }
  }
  unsortedEnqueue(mxEvent, playback) {
    // We don't ever detach our listeners: we expect the Playback to clean up for us
    this.playbacks.set(mxEvent.getId(), playback);
    playback.on(_AsyncStore.UPDATE_EVENT, state => this.onPlaybackStateChange(playback, mxEvent, state));
    playback.clockInfo.liveData.onUpdate(clock => this.onPlaybackClock(playback, mxEvent, clock));
  }
  onPlaybackStateChange(playback, mxEvent, newState) {
    // Remember where the user got to in playback
    const wasLastPlaying = this.currentPlaybackId === mxEvent.getId();
    if (newState === _Playback.PlaybackState.Stopped && this.clockStates.has(mxEvent.getId()) && !wasLastPlaying) {
      // noinspection JSIgnoredPromiseFromCall
      playback.skipTo(this.clockStates.get(mxEvent.getId()));
    } else if (newState === _Playback.PlaybackState.Stopped) {
      // Remove the now-useless clock for some space savings
      this.clockStates.delete(mxEvent.getId());
      if (wasLastPlaying && this.currentPlaybackId) {
        this.recentFullPlays.add(this.currentPlaybackId);
        const orderClone = (0, _arrays.arrayFastClone)(this.playbackIdOrder);
        const last = orderClone.pop();
        if (last === this.currentPlaybackId) {
          const next = orderClone.pop();
          if (next) {
            const instance = this.playbacks.get(next);
            if (!instance) {
              _logger.logger.warn("Voice message queue desync: Missing playback for next message: " + `Current=${this.currentPlaybackId} Last=${last} Next=${next}`);
            } else {
              this.playbackIdOrder = orderClone;
              _PlaybackManager.PlaybackManager.instance.pauseAllExcept(instance);

              // This should cause a Play event, which will re-populate our playback order
              // and update our current playback ID.
              // noinspection JSIgnoredPromiseFromCall
              instance.play();
            }
          } else {
            // else no explicit next event, so find an event we haven't played that comes next. The live
            // timeline is already most recent last, so we can iterate down that.
            const timeline = (0, _arrays.arrayFastClone)(this.room.getLiveTimeline().getEvents());
            let scanForVoiceMessage = false;
            let nextEv;
            for (const event of timeline) {
              if (event.getId() === mxEvent.getId()) {
                scanForVoiceMessage = true;
                continue;
              }
              if (!scanForVoiceMessage) continue;
              if (!(0, _EventUtils.isVoiceMessage)(event)) {
                const evType = event.getType();
                if (evType !== _event.EventType.RoomMessage && evType !== _event.EventType.Sticker) {
                  continue; // Event can be skipped for automatic playback consideration
                }

                break; // Stop automatic playback: next useful event is not a voice message
              }

              const havePlayback = this.playbacks.has(event.getId());
              const isRecentlyCompleted = this.recentFullPlays.has(event.getId());
              if (havePlayback && !isRecentlyCompleted) {
                nextEv = event;
                break;
              }
            }
            if (!nextEv) {
              // if we don't have anywhere to go, reset the recent playback queue so the user
              // can start a new chain of playbacks.
              this.recentFullPlays = new Set();
              this.playbackIdOrder = [];
            } else {
              this.playbackIdOrder = orderClone;
              const instance = this.playbacks.get(nextEv.getId());
              _PlaybackManager.PlaybackManager.instance.pauseAllExcept(instance);

              // This should cause a Play event, which will re-populate our playback order
              // and update our current playback ID.
              // noinspection JSIgnoredPromiseFromCall
              instance?.play();
            }
          }
        } else {
          _logger.logger.warn("Voice message queue desync: Expected playback stop to be last in order. " + `Current=${this.currentPlaybackId} Last=${last} EventID=${mxEvent.getId()}`);
        }
      }
    }
    if (newState === _Playback.PlaybackState.Playing) {
      const order = this.playbackIdOrder;
      if (this.currentPlaybackId !== mxEvent.getId() && !!this.currentPlaybackId) {
        if (order.length === 0 || order[order.length - 1] !== this.currentPlaybackId) {
          const lastInstance = this.playbacks.get(this.currentPlaybackId);
          if (lastInstance && [_Playback.PlaybackState.Playing, _Playback.PlaybackState.Paused].includes(lastInstance.currentState)) {
            order.push(this.currentPlaybackId);
          }
        }
      }
      this.currentPlaybackId = mxEvent.getId();
      if (order.length === 0 || order[order.length - 1] !== this.currentPlaybackId) {
        order.push(this.currentPlaybackId);
      }
    }

    // Only persist clock information on pause/stop (end) to avoid overwhelming the storage.
    // This should get triggered from normal voice message component unmount due to the playback
    // stopping itself for cleanup.
    if (newState === _Playback.PlaybackState.Paused || newState === _Playback.PlaybackState.Stopped) {
      this.persistClocks();
    }
  }
  onPlaybackClock(playback, mxEvent, clocks) {
    if (playback.currentState === _Playback.PlaybackState.Decoding) return; // ignore pre-ready values

    if (playback.currentState !== _Playback.PlaybackState.Stopped) {
      this.clockStates.set(mxEvent.getId(), clocks[0]); // [0] is the current seek position
    }
  }
}
exports.PlaybackQueue = PlaybackQueue;
(0, _defineProperty2.default)(PlaybackQueue, "queues", new Map());
//# sourceMappingURL=PlaybackQueue.js.map