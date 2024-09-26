"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _event = require("matrix-js-sdk/src/models/event");
var _logger = require("matrix-js-sdk/src/logger");
var _dispatcher = _interopRequireDefault(require("./dispatcher/dispatcher"));
/*
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

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

class Resend {
  static resendUnsentEvents(room) {
    return Promise.all(room.getPendingEvents().filter(function (ev) {
      return ev.status === _event.EventStatus.NOT_SENT;
    }).map(function (event) {
      return Resend.resend(room.client, event);
    }));
  }
  static cancelUnsentEvents(room) {
    room.getPendingEvents().filter(function (ev) {
      return ev.status === _event.EventStatus.NOT_SENT;
    }).forEach(function (event) {
      Resend.removeFromQueue(room.client, event);
    });
  }
  static resend(client, event) {
    const room = client.getRoom(event.getRoomId());
    return client.resendEvent(event, room).then(function (res) {
      _dispatcher.default.dispatch({
        action: "message_sent",
        event: event
      });
    }, function (err) {
      // XXX: temporary logging to try to diagnose
      // https://github.com/vector-im/element-web/issues/3148
      _logger.logger.log("Resend got send failure: " + err.name + "(" + err + ")");
    });
  }
  static removeFromQueue(client, event) {
    client.cancelPendingEvent(event);
  }
}
exports.default = Resend;
//# sourceMappingURL=Resend.js.map