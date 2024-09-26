"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.VoiceBroadcastChunkEvents = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _ = require("..");
/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
 * Voice broadcast chunk collection.
 * Orders chunks by sequence (if available) or timestamp.
 */
class VoiceBroadcastChunkEvents {
  constructor() {
    (0, _defineProperty2.default)(this, "events", []);
    (0, _defineProperty2.default)(this, "addOrReplaceEvent", event => {
      this.events = this.events.filter(e => !this.equalByTxnIdOrId(event, e));
      this.events.push(event);
      return true;
    });
    (0, _defineProperty2.default)(this, "compareBySequence", (a, b) => {
      const aSequence = a.getContent()?.[_.VoiceBroadcastChunkEventType]?.sequence || 0;
      const bSequence = b.getContent()?.[_.VoiceBroadcastChunkEventType]?.sequence || 0;
      return aSequence - bSequence;
    });
    (0, _defineProperty2.default)(this, "compareByTimestamp", (a, b) => {
      return a.getTs() - b.getTs();
    });
  }
  getEvents() {
    return [...this.events];
  }
  getNext(event) {
    return this.events[this.events.indexOf(event) + 1];
  }
  addEvent(event) {
    if (this.addOrReplaceEvent(event)) {
      this.sort();
    }
  }
  addEvents(events) {
    const atLeastOneNew = events.reduce((newSoFar, event) => {
      return this.addOrReplaceEvent(event) || newSoFar;
    }, false);
    if (atLeastOneNew) {
      this.sort();
    }
  }
  includes(event) {
    return !!this.events.find(e => this.equalByTxnIdOrId(event, e));
  }

  /**
   * @returns {number} Length in milliseconds
   */
  getLength() {
    return this.events.reduce((length, event) => {
      return length + this.calculateChunkLength(event);
    }, 0);
  }
  getLengthSeconds() {
    return this.getLength() / 1000;
  }

  /**
   * Returns the accumulated length to (excl.) a chunk event.
   */
  getLengthTo(event) {
    let length = 0;
    for (let i = 0; i < this.events.indexOf(event); i++) {
      length += this.calculateChunkLength(this.events[i]);
    }
    return length;
  }
  findByTime(time) {
    let lengthSoFar = 0;
    for (let i = 0; i < this.events.length; i++) {
      lengthSoFar += this.calculateChunkLength(this.events[i]);
      if (lengthSoFar >= time) {
        return this.events[i];
      }
    }
    return null;
  }
  isLast(event) {
    return this.events.indexOf(event) >= this.events.length - 1;
  }
  getSequenceForEvent(event) {
    const sequence = parseInt(event.getContent()?.[_.VoiceBroadcastChunkEventType]?.sequence, 10);
    if (!isNaN(sequence)) return sequence;
    if (this.events.includes(event)) return this.events.indexOf(event) + 1;
    return null;
  }
  getNumberOfEvents() {
    return this.events.length;
  }
  calculateChunkLength(event) {
    return event.getContent()?.["org.matrix.msc1767.audio"]?.duration || event.getContent()?.info?.duration || 0;
  }
  equalByTxnIdOrId(eventA, eventB) {
    return eventA.getTxnId() && eventB.getTxnId() && eventA.getTxnId() === eventB.getTxnId() || eventA.getId() === eventB.getId();
  }

  /**
   * Sort by sequence, if available for all events.
   * Else fall back to timestamp.
   */
  sort() {
    const compareFn = this.allHaveSequence() ? this.compareBySequence : this.compareByTimestamp;
    this.events.sort(compareFn);
  }
  allHaveSequence() {
    return !this.events.some(event => {
      const sequence = event.getContent()?.[_.VoiceBroadcastChunkEventType]?.sequence;
      return parseInt(sequence, 10) !== sequence;
    });
  }
}
exports.VoiceBroadcastChunkEvents = VoiceBroadcastChunkEvents;
//# sourceMappingURL=VoiceBroadcastChunkEvents.js.map