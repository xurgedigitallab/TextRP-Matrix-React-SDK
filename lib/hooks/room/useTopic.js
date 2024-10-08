"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getTopic = void 0;
exports.useTopic = useTopic;
var _react = require("react");
var _event = require("matrix-js-sdk/src/@types/event");
var _roomState = require("matrix-js-sdk/src/models/room-state");
var _contentHelpers = require("matrix-js-sdk/src/content-helpers");
var _useEventEmitter = require("../useEventEmitter");
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

const getTopic = room => {
  const content = room?.currentState?.getStateEvents(_event.EventType.RoomTopic, "")?.getContent();
  return !!content ? (0, _contentHelpers.parseTopicContent)(content) : null;
};
exports.getTopic = getTopic;
function useTopic(room) {
  const [topic, setTopic] = (0, _react.useState)(getTopic(room));
  (0, _useEventEmitter.useTypedEventEmitter)(room.currentState, _roomState.RoomStateEvent.Events, ev => {
    if (ev.getType() !== _event.EventType.RoomTopic) return;
    setTopic(getTopic(room));
  });
  (0, _react.useEffect)(() => {
    setTopic(getTopic(room));
  }, [room]);
  return topic;
}
//# sourceMappingURL=useTopic.js.map