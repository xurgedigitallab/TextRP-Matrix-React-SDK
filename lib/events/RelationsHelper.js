"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RelationsHelperEvent = exports.RelationsHelper = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _matrix = require("matrix-js-sdk/src/matrix");
var _relations = require("matrix-js-sdk/src/models/relations");
var _typedEventEmitter = require("matrix-js-sdk/src/models/typed-event-emitter");
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
let RelationsHelperEvent = /*#__PURE__*/function (RelationsHelperEvent) {
  RelationsHelperEvent["Add"] = "add";
  return RelationsHelperEvent;
}({});
exports.RelationsHelperEvent = RelationsHelperEvent;
/**
 * Helper class that manages a specific event type relation for an event.
 * Just create an instance and listen for new events for that relation.
 * Optionally receive the current events by calling emitCurrent().
 * Clean up everything by calling destroy().
 */
class RelationsHelper extends _typedEventEmitter.TypedEventEmitter {
  constructor(event, relationType, relationEventType, client) {
    super();
    this.event = event;
    this.relationType = relationType;
    this.relationEventType = relationEventType;
    this.client = client;
    (0, _defineProperty2.default)(this, "relations", void 0);
    (0, _defineProperty2.default)(this, "eventId", void 0);
    (0, _defineProperty2.default)(this, "roomId", void 0);
    (0, _defineProperty2.default)(this, "setUpRelations", () => {
      this.setRelations();
      if (this.relations) {
        this.relations.on(_relations.RelationsEvent.Add, this.onRelationsAdd);
      } else {
        this.event.once(_matrix.MatrixEventEvent.RelationsCreated, this.onRelationsCreated);
      }
    });
    (0, _defineProperty2.default)(this, "onRelationsCreated", () => {
      this.setRelations();
      if (this.relations) {
        this.relations.on(_relations.RelationsEvent.Add, this.onRelationsAdd);
        this.emitCurrent();
      } else {
        this.event.once(_matrix.MatrixEventEvent.RelationsCreated, this.onRelationsCreated);
      }
    });
    (0, _defineProperty2.default)(this, "onRelationsAdd", event => {
      this.emit(RelationsHelperEvent.Add, event);
    });
    const eventId = event.getId();
    if (!eventId) {
      throw new Error("unable to create RelationsHelper: missing event ID");
    }
    const roomId = event.getRoomId();
    if (!roomId) {
      throw new Error("unable to create RelationsHelper: missing room ID");
    }
    this.eventId = eventId;
    this.roomId = roomId;
    this.setUpRelations();
  }
  setRelations() {
    const room = this.client.getRoom(this.event.getRoomId());
    this.relations = room?.getUnfilteredTimelineSet()?.relations?.getChildEventsForEvent(this.eventId, this.relationType, this.relationEventType);
  }
  emitCurrent() {
    this.relations?.getRelations()?.forEach(e => this.emit(RelationsHelperEvent.Add, e));
  }
  getCurrent() {
    return this.relations?.getRelations() || [];
  }

  /**
   * Fetches all related events from the server and emits them.
   */
  async emitFetchCurrent() {
    let nextBatch = undefined;
    do {
      const response = await this.client.relations(this.roomId, this.eventId, this.relationType, this.relationEventType, {
        from: nextBatch,
        limit: 50
      });
      nextBatch = response?.nextBatch ?? undefined;
      response?.events.forEach(e => this.emit(RelationsHelperEvent.Add, e));
    } while (nextBatch);
  }
  destroy() {
    this.removeAllListeners();
    this.event.off(_matrix.MatrixEventEvent.RelationsCreated, this.onRelationsCreated);
    if (this.relations) {
      this.relations.off(_relations.RelationsEvent.Add, this.onRelationsAdd);
    }
  }
}
exports.RelationsHelper = RelationsHelper;
//# sourceMappingURL=RelationsHelper.js.map