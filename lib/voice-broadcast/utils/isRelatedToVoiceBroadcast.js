"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isRelatedToVoiceBroadcast = void 0;
var _matrix = require("matrix-js-sdk/src/matrix");
var _types = require("../types");
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

const isRelatedToVoiceBroadcast = (event, client) => {
  const relation = event.getRelation();
  return relation?.rel_type === _matrix.RelationType.Reference && !!relation.event_id && client.getRoom(event.getRoomId())?.findEventById(relation.event_id)?.getType() === _types.VoiceBroadcastInfoEventType;
};
exports.isRelatedToVoiceBroadcast = isRelatedToVoiceBroadcast;
//# sourceMappingURL=isRelatedToVoiceBroadcast.js.map