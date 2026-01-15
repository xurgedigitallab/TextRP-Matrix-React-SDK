"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.startListening = startListening;
exports.stopListening = stopListening;
var _event = require("matrix-js-sdk/src/models/event");
var _logger = require("matrix-js-sdk/src/logger");
var _MatrixClientPeg = require("./MatrixClientPeg");
var _dispatcher = _interopRequireDefault(require("./dispatcher/dispatcher"));
var _WidgetUtils = _interopRequireDefault(require("./utils/WidgetUtils"));
var _languageHandler = require("./languageHandler");
var _IntegrationManagers = require("./integrations/IntegrationManagers");
var _WidgetType = require("./widgets/WidgetType");
var _objects = require("./utils/objects");
var _membership = require("./utils/membership");
var _SDKContext = require("./contexts/SDKContext");
/*
Copyright 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2018 New Vector Ltd

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
// TODO: Generify the name of this and all components within - it's not just for scalar.
/*
Listens for incoming postMessage requests from the integrations UI URL. The following API is exposed:
{
    action: "invite" | "membership_state" | "bot_options" | "set_bot_options" | etc... ,
    room_id: $ROOM_ID,
    user_id: $USER_ID
    // additional request fields
}

The complete request object is returned to the caller with an additional "response" key like so:
{
    action: "invite" | "membership_state" | "bot_options" | "set_bot_options",
    room_id: $ROOM_ID,
    user_id: $USER_ID,
    // additional request fields
    response: { ... }
}

The "action" determines the format of the request and response. All actions can return an error response.
An error response is a "response" object which consists of a sole "error" key to indicate an error.
They look like:
{
    error: {
        message: "Unable to invite user into room.",
        _error: <Original Error Object>
    }
}
The "message" key should be a human-friendly string.

ACTIONS
=======
All actions can return an error response instead of the response outlined below.

invite
------
Invites a user into a room. The request will no-op if the user is already joined OR invited to the room.

Request:
 - room_id is the room to invite the user into.
 - user_id is the user ID to invite.
 - No additional fields.
Response:
{
    success: true
}
Example:
{
    action: "invite",
    room_id: "!foo:bar",
    user_id: "@invitee:bar",
    response: {
        success: true
    }
}

kick
------
Kicks a user from a room. The request will no-op if the user is not in the room.

Request:
 - room_id is the room to kick the user from.
 - user_id is the user ID to kick.
 - reason is an optional string for the kick reason
Response:
{
    success: true
}
Example:
{
    action: "kick",
    room_id: "!foo:bar",
    user_id: "@target:example.org",
    reason: "Removed from room",
    response: {
        success: true
    }
}

set_bot_options
---------------
Set the m.room.bot.options state event for a bot user.

Request:
 - room_id is the room to send the state event into.
 - user_id is the user ID of the bot who you're setting options for.
 - "content" is an object consisting of the content you wish to set.
Response:
{
    success: true
}
Example:
{
    action: "set_bot_options",
    room_id: "!foo:bar",
    user_id: "@bot:bar",
    content: {
        default_option: "alpha"
    },
    response: {
        success: true
    }
}

get_membership_count
--------------------
Get the number of joined users in the room.

Request:
 - room_id is the room to get the count in.
Response:
78
Example:
{
    action: "get_membership_count",
    room_id: "!foo:bar",
    response: 78
}

can_send_event
--------------
Check if the client can send the given event into the given room. If the client
is unable to do this, an error response is returned instead of 'response: false'.

Request:
 - room_id is the room to do the check in.
 - event_type is the event type which will be sent.
 - is_state is true if the event to be sent is a state event.
Response:
true
Example:
{
    action: "can_send_event",
    is_state: false,
    event_type: "m.room.message",
    room_id: "!foo:bar",
    response: true
}

set_widget
----------
Set a new widget in the room. Clobbers based on the ID.

Request:
 - `room_id` (String) is the room to set the widget in.
 - `widget_id` (String) is the ID of the widget to add (or replace if it already exists).
   It can be an arbitrary UTF8 string and is purely for distinguishing between widgets.
 - `url` (String) is the URL that clients should load in an iframe to run the widget.
   All widgets must have a valid URL. If the URL is `null` (not `undefined`), the
   widget will be removed from the room.
 - `type` (String) is the type of widget, which is provided as a hint for matrix clients so they
   can configure/lay out the widget in different ways. All widgets must have a type.
 - `name` (String) is an optional human-readable string about the widget.
 - `data` (Object) is some optional data about the widget, and can contain arbitrary key/value pairs.
 - `avatar_url` (String) is some optional mxc: URI pointing to the avatar of the widget.
Response:
{
    success: true
}
Example:
{
    action: "set_widget",
    room_id: "!foo:bar",
    widget_id: "abc123",
    url: "http://widget.url",
    type: "example",
    response: {
        success: true
    }
}

get_widgets
-----------
Get a list of all widgets in the room. The response is an array
of state events.

Request:
 - `room_id` (String) is the room to get the widgets in.
Response:
[
    {
        // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
        type: "im.vector.modular.widgets",
        state_key: "wid1",
        content: {
            type: "grafana",
            url: "https://grafanaurl",
            name: "dashboard",
            data: {key: "val"}
        }
        room_id: "!foo:bar",
        sender: "@alice:localhost"
    }
]
Example:
{
    action: "get_widgets",
    room_id: "!foo:bar",
    response: [
        {
            // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
            type: "im.vector.modular.widgets",
            state_key: "wid1",
            content: {
                type: "grafana",
                url: "https://grafanaurl",
                name: "dashboard",
                data: {key: "val"}
            }
            room_id: "!foo:bar",
            sender: "@alice:localhost"
        }
    ]
}

membership_state AND bot_options
--------------------------------
Get the content of the "m.room.member" or "m.room.bot.options" state event respectively.

NB: Whilst this API is basically equivalent to getStateEvent, we specifically do not
    want external entities to be able to query any state event for any room, hence the
    restrictive API outlined here.

Request:
 - room_id is the room which has the state event.
 - user_id is the state_key parameter which in both cases is a user ID (the member or the bot).
 - No additional fields.
Response:
 - The event content. If there is no state event, the "response" key should be null.
Example:
{
    action: "membership_state",
    room_id: "!foo:bar",
    user_id: "@somemember:bar",
    response: {
        membership: "join",
        displayname: "Bob",
        avatar_url: null
    }
}

get_open_id_token
-----------------
Get an openID token for the current user session.
Request: No parameters
Response:
 - The openId token object as described in https://spec.matrix.org/v1.2/client-server-api/#post_matrixclientv3useruseridopenidrequest_token

send_event
----------
Sends an event in a room.

Request:
 - type is the event type to send.
 - state_key is the state key to send. Omitted if not a state event.
 - content is the event content to send.

Response:
 - room_id is the room ID where the event was sent.
 - event_id is the event ID of the event which was sent.

read_events
-----------
Read events from a room.

Request:
 - type is the event type to read.
 - state_key is the state key to read, or `true` to read all events of the type. Omitted if not a state event.

Response:
 - events: Array of events. If none found, this will be an empty array.

*/
var Action = /*#__PURE__*/function (Action) {
  Action["CloseScalar"] = "close_scalar";
  Action["GetWidgets"] = "get_widgets";
  Action["SetWidget"] = "set_widget";
  Action["JoinRulesState"] = "join_rules_state";
  Action["SetPlumbingState"] = "set_plumbing_state";
  Action["GetMembershipCount"] = "get_membership_count";
  Action["GetRoomEncryptionState"] = "get_room_enc_state";
  Action["CanSendEvent"] = "can_send_event";
  Action["MembershipState"] = "membership_state";
  Action["invite"] = "invite";
  Action["Kick"] = "kick";
  Action["BotOptions"] = "bot_options";
  Action["SetBotOptions"] = "set_bot_options";
  Action["SetBotPower"] = "set_bot_power";
  Action["GetOpenIdToken"] = "get_open_id_token";
  Action["SendEvent"] = "send_event";
  Action["ReadEvents"] = "read_events";
  return Action;
}(Action || {});
function sendResponse(event, res) {
  const data = (0, _objects.objectClone)(event.data);
  data.response = res;
  // @ts-ignore
  event.source.postMessage(data, event.origin);
}
function sendError(event, msg, nestedError) {
  _logger.logger.error("Action:" + event.data.action + " failed with message: " + msg);
  const data = (0, _objects.objectClone)(event.data);
  data.response = {
    error: {
      message: msg
    }
  };
  if (nestedError) {
    data.response.error._error = nestedError;
  }
  // @ts-ignore
  event.source.postMessage(data, event.origin);
}
function inviteUser(event, roomId, userId) {
  _logger.logger.log(`Received request to invite ${userId} into room ${roomId}`);
  const client = _MatrixClientPeg.MatrixClientPeg.get();
  if (!client) {
    sendError(event, (0, _languageHandler._t)("You need to be logged in."));
    return;
  }
  const room = client.getRoom(roomId);
  if (room) {
    // if they are already invited or joined we can resolve immediately.
    const member = room.getMember(userId);
    if (member && ["join", "invite"].includes(member.membership)) {
      sendResponse(event, {
        success: true
      });
      return;
    }
  }
  client.invite(roomId, userId).then(function () {
    sendResponse(event, {
      success: true
    });
  }, function (err) {
    sendError(event, (0, _languageHandler._t)("You need to be able to invite users to do that."), err);
  });
}
function kickUser(event, roomId, userId) {
  _logger.logger.log(`Received request to kick ${userId} from room ${roomId}`);
  const client = _MatrixClientPeg.MatrixClientPeg.get();
  if (!client) {
    sendError(event, (0, _languageHandler._t)("You need to be logged in."));
    return;
  }
  const room = client.getRoom(roomId);
  if (room) {
    // if they are already not in the room we can resolve immediately.
    const member = room.getMember(userId);
    if (!member || (0, _membership.getEffectiveMembership)(member.membership) === _membership.EffectiveMembership.Leave) {
      sendResponse(event, {
        success: true
      });
      return;
    }
  }
  const reason = event.data.reason;
  client.kick(roomId, userId, reason).then(() => {
    sendResponse(event, {
      success: true
    });
  }).catch(err => {
    sendError(event, (0, _languageHandler._t)("You need to be able to kick users to do that."), err);
  });
}
function setWidget(event, roomId) {
  const client = _MatrixClientPeg.MatrixClientPeg.get();
  const widgetId = event.data.widget_id;
  let widgetType = event.data.type;
  const widgetUrl = event.data.url;
  const widgetName = event.data.name; // optional
  const widgetData = event.data.data; // optional
  const widgetAvatarUrl = event.data.avatar_url; // optional
  const userWidget = event.data.userWidget;

  // both adding/removing widgets need these checks
  if (!widgetId || widgetUrl === undefined) {
    sendError(event, (0, _languageHandler._t)("Unable to create widget."), new Error("Missing required widget fields."));
    return;
  }
  if (widgetUrl !== null) {
    // if url is null it is being deleted, don't need to check name/type/etc
    // check types of fields
    if (widgetName !== undefined && typeof widgetName !== "string") {
      sendError(event, (0, _languageHandler._t)("Unable to create widget."), new Error("Optional field 'name' must be a string."));
      return;
    }
    if (widgetData !== undefined && !(widgetData instanceof Object)) {
      sendError(event, (0, _languageHandler._t)("Unable to create widget."), new Error("Optional field 'data' must be an Object."));
      return;
    }
    if (widgetAvatarUrl !== undefined && typeof widgetAvatarUrl !== "string") {
      sendError(event, (0, _languageHandler._t)("Unable to create widget."), new Error("Optional field 'avatar_url' must be a string."));
      return;
    }
    if (typeof widgetType !== "string") {
      sendError(event, (0, _languageHandler._t)("Unable to create widget."), new Error("Field 'type' must be a string."));
      return;
    }
    if (typeof widgetUrl !== "string") {
      sendError(event, (0, _languageHandler._t)("Unable to create widget."), new Error("Field 'url' must be a string or null."));
      return;
    }
  }

  // convert the widget type to a known widget type
  widgetType = _WidgetType.WidgetType.fromString(widgetType);
  if (userWidget) {
    _WidgetUtils.default.setUserWidget(client, widgetId, widgetType, widgetUrl, widgetName, widgetData).then(() => {
      sendResponse(event, {
        success: true
      });
      _dispatcher.default.dispatch({
        action: "user_widget_updated"
      });
    }).catch(e => {
      sendError(event, (0, _languageHandler._t)("Unable to create widget."), e);
    });
  } else {
    // Room widget
    if (!roomId) {
      sendError(event, (0, _languageHandler._t)("Missing roomId."));
      return;
    }
    _WidgetUtils.default.setRoomWidget(client, roomId, widgetId, widgetType, widgetUrl, widgetName, widgetData, widgetAvatarUrl).then(() => {
      sendResponse(event, {
        success: true
      });
    }, err => {
      sendError(event, (0, _languageHandler._t)("Failed to send request."), err);
    });
  }
}
function getWidgets(event, roomId) {
  const client = _MatrixClientPeg.MatrixClientPeg.get();
  if (!client) {
    sendError(event, (0, _languageHandler._t)("You need to be logged in."));
    return;
  }
  let widgetStateEvents = [];
  if (roomId) {
    const room = client.getRoom(roomId);
    if (!room) {
      sendError(event, (0, _languageHandler._t)("This room is not recognised."));
      return;
    }
    // XXX: This gets the raw event object (I think because we can't
    // send the MatrixEvent over postMessage?)
    widgetStateEvents = _WidgetUtils.default.getRoomWidgets(room).map(ev => ev.event);
  }

  // Add user widgets (not linked to a specific room)
  const userWidgets = _WidgetUtils.default.getUserWidgetsArray(client);
  widgetStateEvents = widgetStateEvents.concat(userWidgets);
  sendResponse(event, widgetStateEvents);
}
function getRoomEncState(event, roomId) {
  const client = _MatrixClientPeg.MatrixClientPeg.get();
  if (!client) {
    sendError(event, (0, _languageHandler._t)("You need to be logged in."));
    return;
  }
  const room = client.getRoom(roomId);
  if (!room) {
    sendError(event, (0, _languageHandler._t)("This room is not recognised."));
    return;
  }
  const roomIsEncrypted = _MatrixClientPeg.MatrixClientPeg.get().isRoomEncrypted(roomId);
  sendResponse(event, roomIsEncrypted);
}
function setPlumbingState(event, roomId, status) {
  if (typeof status !== "string") {
    throw new Error("Plumbing state status should be a string");
  }
  _logger.logger.log(`Received request to set plumbing state to status "${status}" in room ${roomId}`);
  const client = _MatrixClientPeg.MatrixClientPeg.get();
  if (!client) {
    sendError(event, (0, _languageHandler._t)("You need to be logged in."));
    return;
  }
  client.sendStateEvent(roomId, "m.room.plumbing", {
    status: status
  }).then(() => {
    sendResponse(event, {
      success: true
    });
  }, err => {
    sendError(event, err.message ? err.message : (0, _languageHandler._t)("Failed to send request."), err);
  });
}
function setBotOptions(event, roomId, userId) {
  _logger.logger.log(`Received request to set options for bot ${userId} in room ${roomId}`);
  const client = _MatrixClientPeg.MatrixClientPeg.get();
  if (!client) {
    sendError(event, (0, _languageHandler._t)("You need to be logged in."));
    return;
  }
  client.sendStateEvent(roomId, "m.room.bot.options", event.data.content, "_" + userId).then(() => {
    sendResponse(event, {
      success: true
    });
  }, err => {
    sendError(event, err.message ? err.message : (0, _languageHandler._t)("Failed to send request."), err);
  });
}
async function setBotPower(event, roomId, userId, level, ignoreIfGreater) {
  if (!(Number.isInteger(level) && level >= 0)) {
    sendError(event, (0, _languageHandler._t)("Power level must be positive integer."));
    return;
  }
  _logger.logger.log(`Received request to set power level to ${level} for bot ${userId} in room ${roomId}.`);
  const client = _MatrixClientPeg.MatrixClientPeg.get();
  if (!client) {
    sendError(event, (0, _languageHandler._t)("You need to be logged in."));
    return;
  }
  try {
    const powerLevels = await client.getStateEvent(roomId, "m.room.power_levels", "");

    // If the PL is equal to or greater than the requested PL, ignore.
    if (ignoreIfGreater === true) {
      // As per https://matrix.org/docs/spec/client_server/r0.6.0#m-room-power-levels
      const currentPl = powerLevels.users?.[userId] ?? powerLevels.users_default ?? 0;
      if (currentPl >= level) {
        return sendResponse(event, {
          success: true
        });
      }
    }
    await client.setPowerLevel(roomId, userId, level, new _event.MatrixEvent({
      type: "m.room.power_levels",
      content: powerLevels
    }));
    return sendResponse(event, {
      success: true
    });
  } catch (err) {
    sendError(event, err.message ? err.message : (0, _languageHandler._t)("Failed to send request."), err);
  }
}
function getMembershipState(event, roomId, userId) {
  _logger.logger.log(`membership_state of ${userId} in room ${roomId} requested.`);
  returnStateEvent(event, roomId, "m.room.member", userId);
}
function getJoinRules(event, roomId) {
  _logger.logger.log(`join_rules of ${roomId} requested.`);
  returnStateEvent(event, roomId, "m.room.join_rules", "");
}
function botOptions(event, roomId, userId) {
  _logger.logger.log(`bot_options of ${userId} in room ${roomId} requested.`);
  returnStateEvent(event, roomId, "m.room.bot.options", "_" + userId);
}
function getMembershipCount(event, roomId) {
  const client = _MatrixClientPeg.MatrixClientPeg.get();
  if (!client) {
    sendError(event, (0, _languageHandler._t)("You need to be logged in."));
    return;
  }
  const room = client.getRoom(roomId);
  if (!room) {
    sendError(event, (0, _languageHandler._t)("This room is not recognised."));
    return;
  }
  const count = room.getJoinedMemberCount();
  sendResponse(event, count);
}
function canSendEvent(event, roomId) {
  const evType = "" + event.data.event_type; // force stringify
  const isState = Boolean(event.data.is_state);
  const client = _MatrixClientPeg.MatrixClientPeg.get();
  if (!client) {
    sendError(event, (0, _languageHandler._t)("You need to be logged in."));
    return;
  }
  const room = client.getRoom(roomId);
  if (!room) {
    sendError(event, (0, _languageHandler._t)("This room is not recognised."));
    return;
  }
  if (room.getMyMembership() !== "join") {
    sendError(event, (0, _languageHandler._t)("You are not in this room."));
    return;
  }
  const me = client.credentials.userId;
  let canSend = false;
  if (isState) {
    canSend = room.currentState.maySendStateEvent(evType, me);
  } else {
    canSend = room.currentState.maySendEvent(evType, me);
  }
  if (!canSend) {
    sendError(event, (0, _languageHandler._t)("You do not have permission to do that in this room."));
    return;
  }
  sendResponse(event, true);
}
function returnStateEvent(event, roomId, eventType, stateKey) {
  const client = _MatrixClientPeg.MatrixClientPeg.get();
  if (!client) {
    sendError(event, (0, _languageHandler._t)("You need to be logged in."));
    return;
  }
  const room = client.getRoom(roomId);
  if (!room) {
    sendError(event, (0, _languageHandler._t)("This room is not recognised."));
    return;
  }
  const stateEvent = room.currentState.getStateEvents(eventType, stateKey);
  if (!stateEvent) {
    sendResponse(event, null);
    return;
  }
  sendResponse(event, stateEvent.getContent());
}
async function getOpenIdToken(event) {
  try {
    const tokenObject = await _MatrixClientPeg.MatrixClientPeg.get().getOpenIdToken();
    sendResponse(event, tokenObject);
  } catch (ex) {
    _logger.logger.warn("Unable to fetch openId token.", ex);
    sendError(event, "Unable to fetch openId token.");
  }
}
async function sendEvent(event, roomId) {
  const eventType = event.data.type;
  const stateKey = event.data.state_key;
  const content = event.data.content;
  if (typeof eventType !== "string") {
    sendError(event, (0, _languageHandler._t)("Failed to send event"), new Error("Invalid 'type' in request"));
    return;
  }
  const allowedEventTypes = ["m.widgets", "im.vector.modular.widgets", "io.element.integrations.installations"];
  if (!allowedEventTypes.includes(eventType)) {
    sendError(event, (0, _languageHandler._t)("Failed to send event"), new Error("Disallowed 'type' in request"));
    return;
  }
  if (!content || typeof content !== "object") {
    sendError(event, (0, _languageHandler._t)("Failed to send event"), new Error("Invalid 'content' in request"));
    return;
  }
  const client = _MatrixClientPeg.MatrixClientPeg.get();
  if (!client) {
    sendError(event, (0, _languageHandler._t)("You need to be logged in."));
    return;
  }
  const room = client.getRoom(roomId);
  if (!room) {
    sendError(event, (0, _languageHandler._t)("This room is not recognised."));
    return;
  }
  if (stateKey !== undefined) {
    // state event
    try {
      const res = await client.sendStateEvent(roomId, eventType, content, stateKey);
      sendResponse(event, {
        room_id: roomId,
        event_id: res.event_id
      });
    } catch (e) {
      sendError(event, (0, _languageHandler._t)("Failed to send event"), e);
      return;
    }
  } else {
    // message event
    sendError(event, (0, _languageHandler._t)("Failed to send event"), new Error("Sending message events is not implemented"));
    return;
  }
}
async function readEvents(event, roomId) {
  const eventType = event.data.type;
  const stateKey = event.data.state_key;
  const limit = event.data.limit;
  if (typeof eventType !== "string") {
    sendError(event, (0, _languageHandler._t)("Failed to read events"), new Error("Invalid 'type' in request"));
    return;
  }
  const allowedEventTypes = ["m.room.power_levels", "m.room.encryption", "m.room.member", "m.room.name", "m.widgets", "im.vector.modular.widgets", "io.element.integrations.installations"];
  if (!allowedEventTypes.includes(eventType)) {
    sendError(event, (0, _languageHandler._t)("Failed to read events"), new Error("Disallowed 'type' in request"));
    return;
  }
  let effectiveLimit;
  if (limit !== undefined) {
    if (typeof limit !== "number" || limit < 0) {
      sendError(event, (0, _languageHandler._t)("Failed to read events"), new Error("Invalid 'limit' in request"));
      return;
    }
    effectiveLimit = Math.min(limit, Number.MAX_SAFE_INTEGER);
  } else {
    effectiveLimit = Number.MAX_SAFE_INTEGER;
  }
  const client = _MatrixClientPeg.MatrixClientPeg.get();
  if (!client) {
    sendError(event, (0, _languageHandler._t)("You need to be logged in."));
    return;
  }
  const room = client.getRoom(roomId);
  if (!room) {
    sendError(event, (0, _languageHandler._t)("This room is not recognised."));
    return;
  }
  if (stateKey !== undefined) {
    // state events
    if (typeof stateKey !== "string" && stateKey !== true) {
      sendError(event, (0, _languageHandler._t)("Failed to read events"), new Error("Invalid 'state_key' in request"));
      return;
    }
    // When `true` is passed for state key, get events with any state key.
    const effectiveStateKey = stateKey === true ? undefined : stateKey;
    let events = [];
    events = events.concat(room.currentState.getStateEvents(eventType, effectiveStateKey) || []);
    events = events.slice(0, effectiveLimit);
    sendResponse(event, {
      events: events.map(e => e.getEffectiveEvent())
    });
    return;
  } else {
    // message events
    sendError(event, (0, _languageHandler._t)("Failed to read events"), new Error("Reading message events is not implemented"));
    return;
  }
}
const onMessage = function (event) {
  if (!event.origin) {
    // @ts-ignore - stupid chrome
    event.origin = event.originalEvent.origin;
  }

  // Check that the integrations UI URL starts with the origin of the event
  // This means the URL could contain a path (like /develop) and still be used
  // to validate event origins, which do not specify paths.
  // (See https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
  let configUrl;
  try {
    if (!openManagerUrl) openManagerUrl = _IntegrationManagers.IntegrationManagers.sharedInstance().getPrimaryManager()?.uiUrl;
    configUrl = new URL(openManagerUrl);
  } catch (e) {
    // No integrations UI URL, ignore silently.
    return;
  }
  let eventOriginUrl;
  try {
    eventOriginUrl = new URL(event.origin);
  } catch (e) {
    return;
  }
  // TODO -- Scalar postMessage API should be namespaced with event.data.api field
  // Fix following "if" statement to respond only to specific API messages.
  if (configUrl.origin !== eventOriginUrl.origin || !event.data.action || event.data.api // Ignore messages with specific API set
  ) {
    // don't log this - debugging APIs and browser add-ons like to spam
    // postMessage which floods the log otherwise
    return;
  }
  if (event.data.action === Action.CloseScalar) {
    _dispatcher.default.dispatch({
      action: Action.CloseScalar
    });
    sendResponse(event, null);
    return;
  }
  const roomId = event.data.room_id;
  const userId = event.data.user_id;
  if (!roomId) {
    // These APIs don't require roomId
    if (event.data.action === Action.GetWidgets) {
      getWidgets(event, null);
      return;
    } else if (event.data.action === Action.SetWidget) {
      setWidget(event, null);
      return;
    } else if (event.data.action === Action.GetOpenIdToken) {
      getOpenIdToken(event);
      return;
    } else {
      sendError(event, (0, _languageHandler._t)("Missing room_id in request"));
      return;
    }
  }
  if (roomId !== _SDKContext.SdkContextClass.instance.roomViewStore.getRoomId()) {
    sendError(event, (0, _languageHandler._t)("Room %(roomId)s not visible", {
      roomId: roomId
    }));
    return;
  }

  // Get and set room-based widgets
  if (event.data.action === Action.GetWidgets) {
    getWidgets(event, roomId);
    return;
  } else if (event.data.action === Action.SetWidget) {
    setWidget(event, roomId);
    return;
  }

  // These APIs don't require userId
  if (event.data.action === Action.JoinRulesState) {
    getJoinRules(event, roomId);
    return;
  } else if (event.data.action === Action.SetPlumbingState) {
    setPlumbingState(event, roomId, event.data.status);
    return;
  } else if (event.data.action === Action.GetMembershipCount) {
    getMembershipCount(event, roomId);
    return;
  } else if (event.data.action === Action.GetRoomEncryptionState) {
    getRoomEncState(event, roomId);
    return;
  } else if (event.data.action === Action.CanSendEvent) {
    canSendEvent(event, roomId);
    return;
  } else if (event.data.action === Action.SendEvent) {
    sendEvent(event, roomId);
    return;
  } else if (event.data.action === Action.ReadEvents) {
    readEvents(event, roomId);
    return;
  }
  if (!userId) {
    sendError(event, (0, _languageHandler._t)("Missing user_id in request"));
    return;
  }
  switch (event.data.action) {
    case Action.MembershipState:
      getMembershipState(event, roomId, userId);
      break;
    case Action.invite:
      inviteUser(event, roomId, userId);
      break;
    case Action.Kick:
      kickUser(event, roomId, userId);
      break;
    case Action.BotOptions:
      botOptions(event, roomId, userId);
      break;
    case Action.SetBotOptions:
      setBotOptions(event, roomId, userId);
      break;
    case Action.SetBotPower:
      setBotPower(event, roomId, userId, event.data.level, event.data.ignoreIfGreater);
      break;
    default:
      _logger.logger.warn("Unhandled postMessage event with action '" + event.data.action + "'");
      break;
  }
};
let listenerCount = 0;
let openManagerUrl;
function startListening() {
  if (listenerCount === 0) {
    window.addEventListener("message", onMessage, false);
  }
  listenerCount += 1;
}
function stopListening() {
  listenerCount -= 1;
  if (listenerCount === 0) {
    window.removeEventListener("message", onMessage);
  }
  if (listenerCount < 0) {
    // Make an error so we get a stack trace
    const e = new Error("ScalarMessaging: mismatched startListening / stopListening detected." + " Negative count");
    _logger.logger.error(e);
  }
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfZXZlbnQiLCJyZXF1aXJlIiwiX2xvZ2dlciIsIl9NYXRyaXhDbGllbnRQZWciLCJfZGlzcGF0Y2hlciIsIl9pbnRlcm9wUmVxdWlyZURlZmF1bHQiLCJfV2lkZ2V0VXRpbHMiLCJfbGFuZ3VhZ2VIYW5kbGVyIiwiX0ludGVncmF0aW9uTWFuYWdlcnMiLCJfV2lkZ2V0VHlwZSIsIl9vYmplY3RzIiwiX21lbWJlcnNoaXAiLCJfU0RLQ29udGV4dCIsIkFjdGlvbiIsInNlbmRSZXNwb25zZSIsImV2ZW50IiwicmVzIiwiZGF0YSIsIm9iamVjdENsb25lIiwicmVzcG9uc2UiLCJzb3VyY2UiLCJwb3N0TWVzc2FnZSIsIm9yaWdpbiIsInNlbmRFcnJvciIsIm1zZyIsIm5lc3RlZEVycm9yIiwibG9nZ2VyIiwiZXJyb3IiLCJhY3Rpb24iLCJtZXNzYWdlIiwiX2Vycm9yIiwiaW52aXRlVXNlciIsInJvb21JZCIsInVzZXJJZCIsImxvZyIsImNsaWVudCIsIk1hdHJpeENsaWVudFBlZyIsImdldCIsIl90Iiwicm9vbSIsImdldFJvb20iLCJtZW1iZXIiLCJnZXRNZW1iZXIiLCJpbmNsdWRlcyIsIm1lbWJlcnNoaXAiLCJzdWNjZXNzIiwiaW52aXRlIiwidGhlbiIsImVyciIsImtpY2tVc2VyIiwiZ2V0RWZmZWN0aXZlTWVtYmVyc2hpcCIsIkVmZmVjdGl2ZU1lbWJlcnNoaXAiLCJMZWF2ZSIsInJlYXNvbiIsImtpY2siLCJjYXRjaCIsInNldFdpZGdldCIsIndpZGdldElkIiwid2lkZ2V0X2lkIiwid2lkZ2V0VHlwZSIsInR5cGUiLCJ3aWRnZXRVcmwiLCJ1cmwiLCJ3aWRnZXROYW1lIiwibmFtZSIsIndpZGdldERhdGEiLCJ3aWRnZXRBdmF0YXJVcmwiLCJhdmF0YXJfdXJsIiwidXNlcldpZGdldCIsInVuZGVmaW5lZCIsIkVycm9yIiwiT2JqZWN0IiwiV2lkZ2V0VHlwZSIsImZyb21TdHJpbmciLCJXaWRnZXRVdGlscyIsInNldFVzZXJXaWRnZXQiLCJkaXMiLCJkaXNwYXRjaCIsImUiLCJzZXRSb29tV2lkZ2V0IiwiZ2V0V2lkZ2V0cyIsIndpZGdldFN0YXRlRXZlbnRzIiwiZ2V0Um9vbVdpZGdldHMiLCJtYXAiLCJldiIsInVzZXJXaWRnZXRzIiwiZ2V0VXNlcldpZGdldHNBcnJheSIsImNvbmNhdCIsImdldFJvb21FbmNTdGF0ZSIsInJvb21Jc0VuY3J5cHRlZCIsImlzUm9vbUVuY3J5cHRlZCIsInNldFBsdW1iaW5nU3RhdGUiLCJzdGF0dXMiLCJzZW5kU3RhdGVFdmVudCIsInNldEJvdE9wdGlvbnMiLCJjb250ZW50Iiwic2V0Qm90UG93ZXIiLCJsZXZlbCIsImlnbm9yZUlmR3JlYXRlciIsIk51bWJlciIsImlzSW50ZWdlciIsInBvd2VyTGV2ZWxzIiwiZ2V0U3RhdGVFdmVudCIsImN1cnJlbnRQbCIsInVzZXJzIiwidXNlcnNfZGVmYXVsdCIsInNldFBvd2VyTGV2ZWwiLCJNYXRyaXhFdmVudCIsImdldE1lbWJlcnNoaXBTdGF0ZSIsInJldHVyblN0YXRlRXZlbnQiLCJnZXRKb2luUnVsZXMiLCJib3RPcHRpb25zIiwiZ2V0TWVtYmVyc2hpcENvdW50IiwiY291bnQiLCJnZXRKb2luZWRNZW1iZXJDb3VudCIsImNhblNlbmRFdmVudCIsImV2VHlwZSIsImV2ZW50X3R5cGUiLCJpc1N0YXRlIiwiQm9vbGVhbiIsImlzX3N0YXRlIiwiZ2V0TXlNZW1iZXJzaGlwIiwibWUiLCJjcmVkZW50aWFscyIsImNhblNlbmQiLCJjdXJyZW50U3RhdGUiLCJtYXlTZW5kU3RhdGVFdmVudCIsIm1heVNlbmRFdmVudCIsImV2ZW50VHlwZSIsInN0YXRlS2V5Iiwic3RhdGVFdmVudCIsImdldFN0YXRlRXZlbnRzIiwiZ2V0Q29udGVudCIsImdldE9wZW5JZFRva2VuIiwidG9rZW5PYmplY3QiLCJleCIsIndhcm4iLCJzZW5kRXZlbnQiLCJzdGF0ZV9rZXkiLCJhbGxvd2VkRXZlbnRUeXBlcyIsInJvb21faWQiLCJldmVudF9pZCIsInJlYWRFdmVudHMiLCJsaW1pdCIsImVmZmVjdGl2ZUxpbWl0IiwiTWF0aCIsIm1pbiIsIk1BWF9TQUZFX0lOVEVHRVIiLCJlZmZlY3RpdmVTdGF0ZUtleSIsImV2ZW50cyIsInNsaWNlIiwiZ2V0RWZmZWN0aXZlRXZlbnQiLCJvbk1lc3NhZ2UiLCJvcmlnaW5hbEV2ZW50IiwiY29uZmlnVXJsIiwib3Blbk1hbmFnZXJVcmwiLCJJbnRlZ3JhdGlvbk1hbmFnZXJzIiwic2hhcmVkSW5zdGFuY2UiLCJnZXRQcmltYXJ5TWFuYWdlciIsInVpVXJsIiwiVVJMIiwiZXZlbnRPcmlnaW5VcmwiLCJhcGkiLCJDbG9zZVNjYWxhciIsInVzZXJfaWQiLCJHZXRXaWRnZXRzIiwiU2V0V2lkZ2V0IiwiR2V0T3BlbklkVG9rZW4iLCJTZGtDb250ZXh0Q2xhc3MiLCJpbnN0YW5jZSIsInJvb21WaWV3U3RvcmUiLCJnZXRSb29tSWQiLCJKb2luUnVsZXNTdGF0ZSIsIlNldFBsdW1iaW5nU3RhdGUiLCJHZXRNZW1iZXJzaGlwQ291bnQiLCJHZXRSb29tRW5jcnlwdGlvblN0YXRlIiwiQ2FuU2VuZEV2ZW50IiwiU2VuZEV2ZW50IiwiUmVhZEV2ZW50cyIsIk1lbWJlcnNoaXBTdGF0ZSIsIktpY2siLCJCb3RPcHRpb25zIiwiU2V0Qm90T3B0aW9ucyIsIlNldEJvdFBvd2VyIiwibGlzdGVuZXJDb3VudCIsInN0YXJ0TGlzdGVuaW5nIiwid2luZG93IiwiYWRkRXZlbnRMaXN0ZW5lciIsInN0b3BMaXN0ZW5pbmciLCJyZW1vdmVFdmVudExpc3RlbmVyIl0sInNvdXJjZXMiOlsiLi4vc3JjL1NjYWxhck1lc3NhZ2luZy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuQ29weXJpZ2h0IDIwMTYgT3Blbk1hcmtldCBMdGRcbkNvcHlyaWdodCAyMDE3IFZlY3RvciBDcmVhdGlvbnMgTHRkXG5Db3B5cmlnaHQgMjAxOCBOZXcgVmVjdG9yIEx0ZFxuXG5MaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xueW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG5cbiAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcblxuVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG5TZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG5saW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiovXG5cbi8vIFRPRE86IEdlbmVyaWZ5IHRoZSBuYW1lIG9mIHRoaXMgYW5kIGFsbCBjb21wb25lbnRzIHdpdGhpbiAtIGl0J3Mgbm90IGp1c3QgZm9yIHNjYWxhci5cblxuLypcbkxpc3RlbnMgZm9yIGluY29taW5nIHBvc3RNZXNzYWdlIHJlcXVlc3RzIGZyb20gdGhlIGludGVncmF0aW9ucyBVSSBVUkwuIFRoZSBmb2xsb3dpbmcgQVBJIGlzIGV4cG9zZWQ6XG57XG4gICAgYWN0aW9uOiBcImludml0ZVwiIHwgXCJtZW1iZXJzaGlwX3N0YXRlXCIgfCBcImJvdF9vcHRpb25zXCIgfCBcInNldF9ib3Rfb3B0aW9uc1wiIHwgZXRjLi4uICxcbiAgICByb29tX2lkOiAkUk9PTV9JRCxcbiAgICB1c2VyX2lkOiAkVVNFUl9JRFxuICAgIC8vIGFkZGl0aW9uYWwgcmVxdWVzdCBmaWVsZHNcbn1cblxuVGhlIGNvbXBsZXRlIHJlcXVlc3Qgb2JqZWN0IGlzIHJldHVybmVkIHRvIHRoZSBjYWxsZXIgd2l0aCBhbiBhZGRpdGlvbmFsIFwicmVzcG9uc2VcIiBrZXkgbGlrZSBzbzpcbntcbiAgICBhY3Rpb246IFwiaW52aXRlXCIgfCBcIm1lbWJlcnNoaXBfc3RhdGVcIiB8IFwiYm90X29wdGlvbnNcIiB8IFwic2V0X2JvdF9vcHRpb25zXCIsXG4gICAgcm9vbV9pZDogJFJPT01fSUQsXG4gICAgdXNlcl9pZDogJFVTRVJfSUQsXG4gICAgLy8gYWRkaXRpb25hbCByZXF1ZXN0IGZpZWxkc1xuICAgIHJlc3BvbnNlOiB7IC4uLiB9XG59XG5cblRoZSBcImFjdGlvblwiIGRldGVybWluZXMgdGhlIGZvcm1hdCBvZiB0aGUgcmVxdWVzdCBhbmQgcmVzcG9uc2UuIEFsbCBhY3Rpb25zIGNhbiByZXR1cm4gYW4gZXJyb3IgcmVzcG9uc2UuXG5BbiBlcnJvciByZXNwb25zZSBpcyBhIFwicmVzcG9uc2VcIiBvYmplY3Qgd2hpY2ggY29uc2lzdHMgb2YgYSBzb2xlIFwiZXJyb3JcIiBrZXkgdG8gaW5kaWNhdGUgYW4gZXJyb3IuXG5UaGV5IGxvb2sgbGlrZTpcbntcbiAgICBlcnJvcjoge1xuICAgICAgICBtZXNzYWdlOiBcIlVuYWJsZSB0byBpbnZpdGUgdXNlciBpbnRvIHJvb20uXCIsXG4gICAgICAgIF9lcnJvcjogPE9yaWdpbmFsIEVycm9yIE9iamVjdD5cbiAgICB9XG59XG5UaGUgXCJtZXNzYWdlXCIga2V5IHNob3VsZCBiZSBhIGh1bWFuLWZyaWVuZGx5IHN0cmluZy5cblxuQUNUSU9OU1xuPT09PT09PVxuQWxsIGFjdGlvbnMgY2FuIHJldHVybiBhbiBlcnJvciByZXNwb25zZSBpbnN0ZWFkIG9mIHRoZSByZXNwb25zZSBvdXRsaW5lZCBiZWxvdy5cblxuaW52aXRlXG4tLS0tLS1cbkludml0ZXMgYSB1c2VyIGludG8gYSByb29tLiBUaGUgcmVxdWVzdCB3aWxsIG5vLW9wIGlmIHRoZSB1c2VyIGlzIGFscmVhZHkgam9pbmVkIE9SIGludml0ZWQgdG8gdGhlIHJvb20uXG5cblJlcXVlc3Q6XG4gLSByb29tX2lkIGlzIHRoZSByb29tIHRvIGludml0ZSB0aGUgdXNlciBpbnRvLlxuIC0gdXNlcl9pZCBpcyB0aGUgdXNlciBJRCB0byBpbnZpdGUuXG4gLSBObyBhZGRpdGlvbmFsIGZpZWxkcy5cblJlc3BvbnNlOlxue1xuICAgIHN1Y2Nlc3M6IHRydWVcbn1cbkV4YW1wbGU6XG57XG4gICAgYWN0aW9uOiBcImludml0ZVwiLFxuICAgIHJvb21faWQ6IFwiIWZvbzpiYXJcIixcbiAgICB1c2VyX2lkOiBcIkBpbnZpdGVlOmJhclwiLFxuICAgIHJlc3BvbnNlOiB7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWVcbiAgICB9XG59XG5cbmtpY2tcbi0tLS0tLVxuS2lja3MgYSB1c2VyIGZyb20gYSByb29tLiBUaGUgcmVxdWVzdCB3aWxsIG5vLW9wIGlmIHRoZSB1c2VyIGlzIG5vdCBpbiB0aGUgcm9vbS5cblxuUmVxdWVzdDpcbiAtIHJvb21faWQgaXMgdGhlIHJvb20gdG8ga2ljayB0aGUgdXNlciBmcm9tLlxuIC0gdXNlcl9pZCBpcyB0aGUgdXNlciBJRCB0byBraWNrLlxuIC0gcmVhc29uIGlzIGFuIG9wdGlvbmFsIHN0cmluZyBmb3IgdGhlIGtpY2sgcmVhc29uXG5SZXNwb25zZTpcbntcbiAgICBzdWNjZXNzOiB0cnVlXG59XG5FeGFtcGxlOlxue1xuICAgIGFjdGlvbjogXCJraWNrXCIsXG4gICAgcm9vbV9pZDogXCIhZm9vOmJhclwiLFxuICAgIHVzZXJfaWQ6IFwiQHRhcmdldDpleGFtcGxlLm9yZ1wiLFxuICAgIHJlYXNvbjogXCJSZW1vdmVkIGZyb20gcm9vbVwiLFxuICAgIHJlc3BvbnNlOiB7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWVcbiAgICB9XG59XG5cbnNldF9ib3Rfb3B0aW9uc1xuLS0tLS0tLS0tLS0tLS0tXG5TZXQgdGhlIG0ucm9vbS5ib3Qub3B0aW9ucyBzdGF0ZSBldmVudCBmb3IgYSBib3QgdXNlci5cblxuUmVxdWVzdDpcbiAtIHJvb21faWQgaXMgdGhlIHJvb20gdG8gc2VuZCB0aGUgc3RhdGUgZXZlbnQgaW50by5cbiAtIHVzZXJfaWQgaXMgdGhlIHVzZXIgSUQgb2YgdGhlIGJvdCB3aG8geW91J3JlIHNldHRpbmcgb3B0aW9ucyBmb3IuXG4gLSBcImNvbnRlbnRcIiBpcyBhbiBvYmplY3QgY29uc2lzdGluZyBvZiB0aGUgY29udGVudCB5b3Ugd2lzaCB0byBzZXQuXG5SZXNwb25zZTpcbntcbiAgICBzdWNjZXNzOiB0cnVlXG59XG5FeGFtcGxlOlxue1xuICAgIGFjdGlvbjogXCJzZXRfYm90X29wdGlvbnNcIixcbiAgICByb29tX2lkOiBcIiFmb286YmFyXCIsXG4gICAgdXNlcl9pZDogXCJAYm90OmJhclwiLFxuICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgZGVmYXVsdF9vcHRpb246IFwiYWxwaGFcIlxuICAgIH0sXG4gICAgcmVzcG9uc2U6IHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZVxuICAgIH1cbn1cblxuZ2V0X21lbWJlcnNoaXBfY291bnRcbi0tLS0tLS0tLS0tLS0tLS0tLS0tXG5HZXQgdGhlIG51bWJlciBvZiBqb2luZWQgdXNlcnMgaW4gdGhlIHJvb20uXG5cblJlcXVlc3Q6XG4gLSByb29tX2lkIGlzIHRoZSByb29tIHRvIGdldCB0aGUgY291bnQgaW4uXG5SZXNwb25zZTpcbjc4XG5FeGFtcGxlOlxue1xuICAgIGFjdGlvbjogXCJnZXRfbWVtYmVyc2hpcF9jb3VudFwiLFxuICAgIHJvb21faWQ6IFwiIWZvbzpiYXJcIixcbiAgICByZXNwb25zZTogNzhcbn1cblxuY2FuX3NlbmRfZXZlbnRcbi0tLS0tLS0tLS0tLS0tXG5DaGVjayBpZiB0aGUgY2xpZW50IGNhbiBzZW5kIHRoZSBnaXZlbiBldmVudCBpbnRvIHRoZSBnaXZlbiByb29tLiBJZiB0aGUgY2xpZW50XG5pcyB1bmFibGUgdG8gZG8gdGhpcywgYW4gZXJyb3IgcmVzcG9uc2UgaXMgcmV0dXJuZWQgaW5zdGVhZCBvZiAncmVzcG9uc2U6IGZhbHNlJy5cblxuUmVxdWVzdDpcbiAtIHJvb21faWQgaXMgdGhlIHJvb20gdG8gZG8gdGhlIGNoZWNrIGluLlxuIC0gZXZlbnRfdHlwZSBpcyB0aGUgZXZlbnQgdHlwZSB3aGljaCB3aWxsIGJlIHNlbnQuXG4gLSBpc19zdGF0ZSBpcyB0cnVlIGlmIHRoZSBldmVudCB0byBiZSBzZW50IGlzIGEgc3RhdGUgZXZlbnQuXG5SZXNwb25zZTpcbnRydWVcbkV4YW1wbGU6XG57XG4gICAgYWN0aW9uOiBcImNhbl9zZW5kX2V2ZW50XCIsXG4gICAgaXNfc3RhdGU6IGZhbHNlLFxuICAgIGV2ZW50X3R5cGU6IFwibS5yb29tLm1lc3NhZ2VcIixcbiAgICByb29tX2lkOiBcIiFmb286YmFyXCIsXG4gICAgcmVzcG9uc2U6IHRydWVcbn1cblxuc2V0X3dpZGdldFxuLS0tLS0tLS0tLVxuU2V0IGEgbmV3IHdpZGdldCBpbiB0aGUgcm9vbS4gQ2xvYmJlcnMgYmFzZWQgb24gdGhlIElELlxuXG5SZXF1ZXN0OlxuIC0gYHJvb21faWRgIChTdHJpbmcpIGlzIHRoZSByb29tIHRvIHNldCB0aGUgd2lkZ2V0IGluLlxuIC0gYHdpZGdldF9pZGAgKFN0cmluZykgaXMgdGhlIElEIG9mIHRoZSB3aWRnZXQgdG8gYWRkIChvciByZXBsYWNlIGlmIGl0IGFscmVhZHkgZXhpc3RzKS5cbiAgIEl0IGNhbiBiZSBhbiBhcmJpdHJhcnkgVVRGOCBzdHJpbmcgYW5kIGlzIHB1cmVseSBmb3IgZGlzdGluZ3Vpc2hpbmcgYmV0d2VlbiB3aWRnZXRzLlxuIC0gYHVybGAgKFN0cmluZykgaXMgdGhlIFVSTCB0aGF0IGNsaWVudHMgc2hvdWxkIGxvYWQgaW4gYW4gaWZyYW1lIHRvIHJ1biB0aGUgd2lkZ2V0LlxuICAgQWxsIHdpZGdldHMgbXVzdCBoYXZlIGEgdmFsaWQgVVJMLiBJZiB0aGUgVVJMIGlzIGBudWxsYCAobm90IGB1bmRlZmluZWRgKSwgdGhlXG4gICB3aWRnZXQgd2lsbCBiZSByZW1vdmVkIGZyb20gdGhlIHJvb20uXG4gLSBgdHlwZWAgKFN0cmluZykgaXMgdGhlIHR5cGUgb2Ygd2lkZ2V0LCB3aGljaCBpcyBwcm92aWRlZCBhcyBhIGhpbnQgZm9yIG1hdHJpeCBjbGllbnRzIHNvIHRoZXlcbiAgIGNhbiBjb25maWd1cmUvbGF5IG91dCB0aGUgd2lkZ2V0IGluIGRpZmZlcmVudCB3YXlzLiBBbGwgd2lkZ2V0cyBtdXN0IGhhdmUgYSB0eXBlLlxuIC0gYG5hbWVgIChTdHJpbmcpIGlzIGFuIG9wdGlvbmFsIGh1bWFuLXJlYWRhYmxlIHN0cmluZyBhYm91dCB0aGUgd2lkZ2V0LlxuIC0gYGRhdGFgIChPYmplY3QpIGlzIHNvbWUgb3B0aW9uYWwgZGF0YSBhYm91dCB0aGUgd2lkZ2V0LCBhbmQgY2FuIGNvbnRhaW4gYXJiaXRyYXJ5IGtleS92YWx1ZSBwYWlycy5cbiAtIGBhdmF0YXJfdXJsYCAoU3RyaW5nKSBpcyBzb21lIG9wdGlvbmFsIG14YzogVVJJIHBvaW50aW5nIHRvIHRoZSBhdmF0YXIgb2YgdGhlIHdpZGdldC5cblJlc3BvbnNlOlxue1xuICAgIHN1Y2Nlc3M6IHRydWVcbn1cbkV4YW1wbGU6XG57XG4gICAgYWN0aW9uOiBcInNldF93aWRnZXRcIixcbiAgICByb29tX2lkOiBcIiFmb286YmFyXCIsXG4gICAgd2lkZ2V0X2lkOiBcImFiYzEyM1wiLFxuICAgIHVybDogXCJodHRwOi8vd2lkZ2V0LnVybFwiLFxuICAgIHR5cGU6IFwiZXhhbXBsZVwiLFxuICAgIHJlc3BvbnNlOiB7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWVcbiAgICB9XG59XG5cbmdldF93aWRnZXRzXG4tLS0tLS0tLS0tLVxuR2V0IGEgbGlzdCBvZiBhbGwgd2lkZ2V0cyBpbiB0aGUgcm9vbS4gVGhlIHJlc3BvbnNlIGlzIGFuIGFycmF5XG5vZiBzdGF0ZSBldmVudHMuXG5cblJlcXVlc3Q6XG4gLSBgcm9vbV9pZGAgKFN0cmluZykgaXMgdGhlIHJvb20gdG8gZ2V0IHRoZSB3aWRnZXRzIGluLlxuUmVzcG9uc2U6XG5bXG4gICAge1xuICAgICAgICAvLyBUT0RPOiBFbmFibGUgc3VwcG9ydCBmb3IgbS53aWRnZXQgZXZlbnQgdHlwZSAoaHR0cHM6Ly9naXRodWIuY29tL3ZlY3Rvci1pbS9lbGVtZW50LXdlYi9pc3N1ZXMvMTMxMTEpXG4gICAgICAgIHR5cGU6IFwiaW0udmVjdG9yLm1vZHVsYXIud2lkZ2V0c1wiLFxuICAgICAgICBzdGF0ZV9rZXk6IFwid2lkMVwiLFxuICAgICAgICBjb250ZW50OiB7XG4gICAgICAgICAgICB0eXBlOiBcImdyYWZhbmFcIixcbiAgICAgICAgICAgIHVybDogXCJodHRwczovL2dyYWZhbmF1cmxcIixcbiAgICAgICAgICAgIG5hbWU6IFwiZGFzaGJvYXJkXCIsXG4gICAgICAgICAgICBkYXRhOiB7a2V5OiBcInZhbFwifVxuICAgICAgICB9XG4gICAgICAgIHJvb21faWQ6IFwiIWZvbzpiYXJcIixcbiAgICAgICAgc2VuZGVyOiBcIkBhbGljZTpsb2NhbGhvc3RcIlxuICAgIH1cbl1cbkV4YW1wbGU6XG57XG4gICAgYWN0aW9uOiBcImdldF93aWRnZXRzXCIsXG4gICAgcm9vbV9pZDogXCIhZm9vOmJhclwiLFxuICAgIHJlc3BvbnNlOiBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIC8vIFRPRE86IEVuYWJsZSBzdXBwb3J0IGZvciBtLndpZGdldCBldmVudCB0eXBlIChodHRwczovL2dpdGh1Yi5jb20vdmVjdG9yLWltL2VsZW1lbnQtd2ViL2lzc3Vlcy8xMzExMSlcbiAgICAgICAgICAgIHR5cGU6IFwiaW0udmVjdG9yLm1vZHVsYXIud2lkZ2V0c1wiLFxuICAgICAgICAgICAgc3RhdGVfa2V5OiBcIndpZDFcIixcbiAgICAgICAgICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiBcImdyYWZhbmFcIixcbiAgICAgICAgICAgICAgICB1cmw6IFwiaHR0cHM6Ly9ncmFmYW5hdXJsXCIsXG4gICAgICAgICAgICAgICAgbmFtZTogXCJkYXNoYm9hcmRcIixcbiAgICAgICAgICAgICAgICBkYXRhOiB7a2V5OiBcInZhbFwifVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcm9vbV9pZDogXCIhZm9vOmJhclwiLFxuICAgICAgICAgICAgc2VuZGVyOiBcIkBhbGljZTpsb2NhbGhvc3RcIlxuICAgICAgICB9XG4gICAgXVxufVxuXG5tZW1iZXJzaGlwX3N0YXRlIEFORCBib3Rfb3B0aW9uc1xuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbkdldCB0aGUgY29udGVudCBvZiB0aGUgXCJtLnJvb20ubWVtYmVyXCIgb3IgXCJtLnJvb20uYm90Lm9wdGlvbnNcIiBzdGF0ZSBldmVudCByZXNwZWN0aXZlbHkuXG5cbk5COiBXaGlsc3QgdGhpcyBBUEkgaXMgYmFzaWNhbGx5IGVxdWl2YWxlbnQgdG8gZ2V0U3RhdGVFdmVudCwgd2Ugc3BlY2lmaWNhbGx5IGRvIG5vdFxuICAgIHdhbnQgZXh0ZXJuYWwgZW50aXRpZXMgdG8gYmUgYWJsZSB0byBxdWVyeSBhbnkgc3RhdGUgZXZlbnQgZm9yIGFueSByb29tLCBoZW5jZSB0aGVcbiAgICByZXN0cmljdGl2ZSBBUEkgb3V0bGluZWQgaGVyZS5cblxuUmVxdWVzdDpcbiAtIHJvb21faWQgaXMgdGhlIHJvb20gd2hpY2ggaGFzIHRoZSBzdGF0ZSBldmVudC5cbiAtIHVzZXJfaWQgaXMgdGhlIHN0YXRlX2tleSBwYXJhbWV0ZXIgd2hpY2ggaW4gYm90aCBjYXNlcyBpcyBhIHVzZXIgSUQgKHRoZSBtZW1iZXIgb3IgdGhlIGJvdCkuXG4gLSBObyBhZGRpdGlvbmFsIGZpZWxkcy5cblJlc3BvbnNlOlxuIC0gVGhlIGV2ZW50IGNvbnRlbnQuIElmIHRoZXJlIGlzIG5vIHN0YXRlIGV2ZW50LCB0aGUgXCJyZXNwb25zZVwiIGtleSBzaG91bGQgYmUgbnVsbC5cbkV4YW1wbGU6XG57XG4gICAgYWN0aW9uOiBcIm1lbWJlcnNoaXBfc3RhdGVcIixcbiAgICByb29tX2lkOiBcIiFmb286YmFyXCIsXG4gICAgdXNlcl9pZDogXCJAc29tZW1lbWJlcjpiYXJcIixcbiAgICByZXNwb25zZToge1xuICAgICAgICBtZW1iZXJzaGlwOiBcImpvaW5cIixcbiAgICAgICAgZGlzcGxheW5hbWU6IFwiQm9iXCIsXG4gICAgICAgIGF2YXRhcl91cmw6IG51bGxcbiAgICB9XG59XG5cbmdldF9vcGVuX2lkX3Rva2VuXG4tLS0tLS0tLS0tLS0tLS0tLVxuR2V0IGFuIG9wZW5JRCB0b2tlbiBmb3IgdGhlIGN1cnJlbnQgdXNlciBzZXNzaW9uLlxuUmVxdWVzdDogTm8gcGFyYW1ldGVyc1xuUmVzcG9uc2U6XG4gLSBUaGUgb3BlbklkIHRva2VuIG9iamVjdCBhcyBkZXNjcmliZWQgaW4gaHR0cHM6Ly9zcGVjLm1hdHJpeC5vcmcvdjEuMi9jbGllbnQtc2VydmVyLWFwaS8jcG9zdF9tYXRyaXhjbGllbnR2M3VzZXJ1c2VyaWRvcGVuaWRyZXF1ZXN0X3Rva2VuXG5cbnNlbmRfZXZlbnRcbi0tLS0tLS0tLS1cblNlbmRzIGFuIGV2ZW50IGluIGEgcm9vbS5cblxuUmVxdWVzdDpcbiAtIHR5cGUgaXMgdGhlIGV2ZW50IHR5cGUgdG8gc2VuZC5cbiAtIHN0YXRlX2tleSBpcyB0aGUgc3RhdGUga2V5IHRvIHNlbmQuIE9taXR0ZWQgaWYgbm90IGEgc3RhdGUgZXZlbnQuXG4gLSBjb250ZW50IGlzIHRoZSBldmVudCBjb250ZW50IHRvIHNlbmQuXG5cblJlc3BvbnNlOlxuIC0gcm9vbV9pZCBpcyB0aGUgcm9vbSBJRCB3aGVyZSB0aGUgZXZlbnQgd2FzIHNlbnQuXG4gLSBldmVudF9pZCBpcyB0aGUgZXZlbnQgSUQgb2YgdGhlIGV2ZW50IHdoaWNoIHdhcyBzZW50LlxuXG5yZWFkX2V2ZW50c1xuLS0tLS0tLS0tLS1cblJlYWQgZXZlbnRzIGZyb20gYSByb29tLlxuXG5SZXF1ZXN0OlxuIC0gdHlwZSBpcyB0aGUgZXZlbnQgdHlwZSB0byByZWFkLlxuIC0gc3RhdGVfa2V5IGlzIHRoZSBzdGF0ZSBrZXkgdG8gcmVhZCwgb3IgYHRydWVgIHRvIHJlYWQgYWxsIGV2ZW50cyBvZiB0aGUgdHlwZS4gT21pdHRlZCBpZiBub3QgYSBzdGF0ZSBldmVudC5cblxuUmVzcG9uc2U6XG4gLSBldmVudHM6IEFycmF5IG9mIGV2ZW50cy4gSWYgbm9uZSBmb3VuZCwgdGhpcyB3aWxsIGJlIGFuIGVtcHR5IGFycmF5LlxuXG4qL1xuXG5pbXBvcnQgeyBJQ29udGVudCwgTWF0cml4RXZlbnQgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbW9kZWxzL2V2ZW50XCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbG9nZ2VyXCI7XG5pbXBvcnQgeyBJRXZlbnQgfSBmcm9tIFwibWF0cml4LWpzLXNkay9zcmMvbWF0cml4XCI7XG5cbmltcG9ydCB7IE1hdHJpeENsaWVudFBlZyB9IGZyb20gXCIuL01hdHJpeENsaWVudFBlZ1wiO1xuaW1wb3J0IGRpcyBmcm9tIFwiLi9kaXNwYXRjaGVyL2Rpc3BhdGNoZXJcIjtcbmltcG9ydCBXaWRnZXRVdGlscyBmcm9tIFwiLi91dGlscy9XaWRnZXRVdGlsc1wiO1xuaW1wb3J0IHsgX3QgfSBmcm9tIFwiLi9sYW5ndWFnZUhhbmRsZXJcIjtcbmltcG9ydCB7IEludGVncmF0aW9uTWFuYWdlcnMgfSBmcm9tIFwiLi9pbnRlZ3JhdGlvbnMvSW50ZWdyYXRpb25NYW5hZ2Vyc1wiO1xuaW1wb3J0IHsgV2lkZ2V0VHlwZSB9IGZyb20gXCIuL3dpZGdldHMvV2lkZ2V0VHlwZVwiO1xuaW1wb3J0IHsgb2JqZWN0Q2xvbmUgfSBmcm9tIFwiLi91dGlscy9vYmplY3RzXCI7XG5pbXBvcnQgeyBFZmZlY3RpdmVNZW1iZXJzaGlwLCBnZXRFZmZlY3RpdmVNZW1iZXJzaGlwIH0gZnJvbSBcIi4vdXRpbHMvbWVtYmVyc2hpcFwiO1xuaW1wb3J0IHsgU2RrQ29udGV4dENsYXNzIH0gZnJvbSBcIi4vY29udGV4dHMvU0RLQ29udGV4dFwiO1xuXG5lbnVtIEFjdGlvbiB7XG4gICAgQ2xvc2VTY2FsYXIgPSBcImNsb3NlX3NjYWxhclwiLFxuICAgIEdldFdpZGdldHMgPSBcImdldF93aWRnZXRzXCIsXG4gICAgU2V0V2lkZ2V0ID0gXCJzZXRfd2lkZ2V0XCIsXG4gICAgSm9pblJ1bGVzU3RhdGUgPSBcImpvaW5fcnVsZXNfc3RhdGVcIixcbiAgICBTZXRQbHVtYmluZ1N0YXRlID0gXCJzZXRfcGx1bWJpbmdfc3RhdGVcIixcbiAgICBHZXRNZW1iZXJzaGlwQ291bnQgPSBcImdldF9tZW1iZXJzaGlwX2NvdW50XCIsXG4gICAgR2V0Um9vbUVuY3J5cHRpb25TdGF0ZSA9IFwiZ2V0X3Jvb21fZW5jX3N0YXRlXCIsXG4gICAgQ2FuU2VuZEV2ZW50ID0gXCJjYW5fc2VuZF9ldmVudFwiLFxuICAgIE1lbWJlcnNoaXBTdGF0ZSA9IFwibWVtYmVyc2hpcF9zdGF0ZVwiLFxuICAgIGludml0ZSA9IFwiaW52aXRlXCIsXG4gICAgS2ljayA9IFwia2lja1wiLFxuICAgIEJvdE9wdGlvbnMgPSBcImJvdF9vcHRpb25zXCIsXG4gICAgU2V0Qm90T3B0aW9ucyA9IFwic2V0X2JvdF9vcHRpb25zXCIsXG4gICAgU2V0Qm90UG93ZXIgPSBcInNldF9ib3RfcG93ZXJcIixcbiAgICBHZXRPcGVuSWRUb2tlbiA9IFwiZ2V0X29wZW5faWRfdG9rZW5cIixcbiAgICBTZW5kRXZlbnQgPSBcInNlbmRfZXZlbnRcIixcbiAgICBSZWFkRXZlbnRzID0gXCJyZWFkX2V2ZW50c1wiLFxufVxuXG5mdW5jdGlvbiBzZW5kUmVzcG9uc2UoZXZlbnQ6IE1lc3NhZ2VFdmVudDxhbnk+LCByZXM6IGFueSk6IHZvaWQge1xuICAgIGNvbnN0IGRhdGEgPSBvYmplY3RDbG9uZShldmVudC5kYXRhKTtcbiAgICBkYXRhLnJlc3BvbnNlID0gcmVzO1xuICAgIC8vIEB0cy1pZ25vcmVcbiAgICBldmVudC5zb3VyY2UucG9zdE1lc3NhZ2UoZGF0YSwgZXZlbnQub3JpZ2luKTtcbn1cblxuZnVuY3Rpb24gc2VuZEVycm9yKGV2ZW50OiBNZXNzYWdlRXZlbnQ8YW55PiwgbXNnOiBzdHJpbmcsIG5lc3RlZEVycm9yPzogRXJyb3IpOiB2b2lkIHtcbiAgICBsb2dnZXIuZXJyb3IoXCJBY3Rpb246XCIgKyBldmVudC5kYXRhLmFjdGlvbiArIFwiIGZhaWxlZCB3aXRoIG1lc3NhZ2U6IFwiICsgbXNnKTtcbiAgICBjb25zdCBkYXRhID0gb2JqZWN0Q2xvbmUoZXZlbnQuZGF0YSk7XG4gICAgZGF0YS5yZXNwb25zZSA9IHtcbiAgICAgICAgZXJyb3I6IHtcbiAgICAgICAgICAgIG1lc3NhZ2U6IG1zZyxcbiAgICAgICAgfSxcbiAgICB9O1xuICAgIGlmIChuZXN0ZWRFcnJvcikge1xuICAgICAgICBkYXRhLnJlc3BvbnNlLmVycm9yLl9lcnJvciA9IG5lc3RlZEVycm9yO1xuICAgIH1cbiAgICAvLyBAdHMtaWdub3JlXG4gICAgZXZlbnQuc291cmNlLnBvc3RNZXNzYWdlKGRhdGEsIGV2ZW50Lm9yaWdpbik7XG59XG5cbmZ1bmN0aW9uIGludml0ZVVzZXIoZXZlbnQ6IE1lc3NhZ2VFdmVudDxhbnk+LCByb29tSWQ6IHN0cmluZywgdXNlcklkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBsb2dnZXIubG9nKGBSZWNlaXZlZCByZXF1ZXN0IHRvIGludml0ZSAke3VzZXJJZH0gaW50byByb29tICR7cm9vbUlkfWApO1xuICAgIGNvbnN0IGNsaWVudCA9IE1hdHJpeENsaWVudFBlZy5nZXQoKTtcbiAgICBpZiAoIWNsaWVudCkge1xuICAgICAgICBzZW5kRXJyb3IoZXZlbnQsIF90KFwiWW91IG5lZWQgdG8gYmUgbG9nZ2VkIGluLlwiKSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3Qgcm9vbSA9IGNsaWVudC5nZXRSb29tKHJvb21JZCk7XG4gICAgaWYgKHJvb20pIHtcbiAgICAgICAgLy8gaWYgdGhleSBhcmUgYWxyZWFkeSBpbnZpdGVkIG9yIGpvaW5lZCB3ZSBjYW4gcmVzb2x2ZSBpbW1lZGlhdGVseS5cbiAgICAgICAgY29uc3QgbWVtYmVyID0gcm9vbS5nZXRNZW1iZXIodXNlcklkKTtcbiAgICAgICAgaWYgKG1lbWJlciAmJiBbXCJqb2luXCIsIFwiaW52aXRlXCJdLmluY2x1ZGVzKG1lbWJlci5tZW1iZXJzaGlwISkpIHtcbiAgICAgICAgICAgIHNlbmRSZXNwb25zZShldmVudCwge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNsaWVudC5pbnZpdGUocm9vbUlkLCB1c2VySWQpLnRoZW4oXG4gICAgICAgIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHNlbmRSZXNwb25zZShldmVudCwge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgc2VuZEVycm9yKGV2ZW50LCBfdChcIllvdSBuZWVkIHRvIGJlIGFibGUgdG8gaW52aXRlIHVzZXJzIHRvIGRvIHRoYXQuXCIpLCBlcnIpO1xuICAgICAgICB9LFxuICAgICk7XG59XG5cbmZ1bmN0aW9uIGtpY2tVc2VyKGV2ZW50OiBNZXNzYWdlRXZlbnQ8YW55Piwgcm9vbUlkOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nKTogdm9pZCB7XG4gICAgbG9nZ2VyLmxvZyhgUmVjZWl2ZWQgcmVxdWVzdCB0byBraWNrICR7dXNlcklkfSBmcm9tIHJvb20gJHtyb29tSWR9YCk7XG4gICAgY29uc3QgY2xpZW50ID0gTWF0cml4Q2xpZW50UGVnLmdldCgpO1xuICAgIGlmICghY2xpZW50KSB7XG4gICAgICAgIHNlbmRFcnJvcihldmVudCwgX3QoXCJZb3UgbmVlZCB0byBiZSBsb2dnZWQgaW4uXCIpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCByb29tID0gY2xpZW50LmdldFJvb20ocm9vbUlkKTtcbiAgICBpZiAocm9vbSkge1xuICAgICAgICAvLyBpZiB0aGV5IGFyZSBhbHJlYWR5IG5vdCBpbiB0aGUgcm9vbSB3ZSBjYW4gcmVzb2x2ZSBpbW1lZGlhdGVseS5cbiAgICAgICAgY29uc3QgbWVtYmVyID0gcm9vbS5nZXRNZW1iZXIodXNlcklkKTtcbiAgICAgICAgaWYgKCFtZW1iZXIgfHwgZ2V0RWZmZWN0aXZlTWVtYmVyc2hpcChtZW1iZXIubWVtYmVyc2hpcCEpID09PSBFZmZlY3RpdmVNZW1iZXJzaGlwLkxlYXZlKSB7XG4gICAgICAgICAgICBzZW5kUmVzcG9uc2UoZXZlbnQsIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCByZWFzb24gPSBldmVudC5kYXRhLnJlYXNvbjtcbiAgICBjbGllbnRcbiAgICAgICAgLmtpY2socm9vbUlkLCB1c2VySWQsIHJlYXNvbilcbiAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgc2VuZFJlc3BvbnNlKGV2ZW50LCB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgICAgc2VuZEVycm9yKGV2ZW50LCBfdChcIllvdSBuZWVkIHRvIGJlIGFibGUgdG8ga2ljayB1c2VycyB0byBkbyB0aGF0LlwiKSwgZXJyKTtcbiAgICAgICAgfSk7XG59XG5cbmZ1bmN0aW9uIHNldFdpZGdldChldmVudDogTWVzc2FnZUV2ZW50PGFueT4sIHJvb21JZDogc3RyaW5nIHwgbnVsbCk6IHZvaWQge1xuICAgIGNvbnN0IGNsaWVudCA9IE1hdHJpeENsaWVudFBlZy5nZXQoKTtcbiAgICBjb25zdCB3aWRnZXRJZCA9IGV2ZW50LmRhdGEud2lkZ2V0X2lkO1xuICAgIGxldCB3aWRnZXRUeXBlID0gZXZlbnQuZGF0YS50eXBlO1xuICAgIGNvbnN0IHdpZGdldFVybCA9IGV2ZW50LmRhdGEudXJsO1xuICAgIGNvbnN0IHdpZGdldE5hbWUgPSBldmVudC5kYXRhLm5hbWU7IC8vIG9wdGlvbmFsXG4gICAgY29uc3Qgd2lkZ2V0RGF0YSA9IGV2ZW50LmRhdGEuZGF0YTsgLy8gb3B0aW9uYWxcbiAgICBjb25zdCB3aWRnZXRBdmF0YXJVcmwgPSBldmVudC5kYXRhLmF2YXRhcl91cmw7IC8vIG9wdGlvbmFsXG4gICAgY29uc3QgdXNlcldpZGdldCA9IGV2ZW50LmRhdGEudXNlcldpZGdldDtcblxuICAgIC8vIGJvdGggYWRkaW5nL3JlbW92aW5nIHdpZGdldHMgbmVlZCB0aGVzZSBjaGVja3NcbiAgICBpZiAoIXdpZGdldElkIHx8IHdpZGdldFVybCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHNlbmRFcnJvcihldmVudCwgX3QoXCJVbmFibGUgdG8gY3JlYXRlIHdpZGdldC5cIiksIG5ldyBFcnJvcihcIk1pc3NpbmcgcmVxdWlyZWQgd2lkZ2V0IGZpZWxkcy5cIikpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHdpZGdldFVybCAhPT0gbnVsbCkge1xuICAgICAgICAvLyBpZiB1cmwgaXMgbnVsbCBpdCBpcyBiZWluZyBkZWxldGVkLCBkb24ndCBuZWVkIHRvIGNoZWNrIG5hbWUvdHlwZS9ldGNcbiAgICAgICAgLy8gY2hlY2sgdHlwZXMgb2YgZmllbGRzXG4gICAgICAgIGlmICh3aWRnZXROYW1lICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIHdpZGdldE5hbWUgIT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgIHNlbmRFcnJvcihldmVudCwgX3QoXCJVbmFibGUgdG8gY3JlYXRlIHdpZGdldC5cIiksIG5ldyBFcnJvcihcIk9wdGlvbmFsIGZpZWxkICduYW1lJyBtdXN0IGJlIGEgc3RyaW5nLlwiKSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHdpZGdldERhdGEgIT09IHVuZGVmaW5lZCAmJiAhKHdpZGdldERhdGEgaW5zdGFuY2VvZiBPYmplY3QpKSB7XG4gICAgICAgICAgICBzZW5kRXJyb3IoZXZlbnQsIF90KFwiVW5hYmxlIHRvIGNyZWF0ZSB3aWRnZXQuXCIpLCBuZXcgRXJyb3IoXCJPcHRpb25hbCBmaWVsZCAnZGF0YScgbXVzdCBiZSBhbiBPYmplY3QuXCIpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAod2lkZ2V0QXZhdGFyVXJsICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIHdpZGdldEF2YXRhclVybCAhPT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgc2VuZEVycm9yKFxuICAgICAgICAgICAgICAgIGV2ZW50LFxuICAgICAgICAgICAgICAgIF90KFwiVW5hYmxlIHRvIGNyZWF0ZSB3aWRnZXQuXCIpLFxuICAgICAgICAgICAgICAgIG5ldyBFcnJvcihcIk9wdGlvbmFsIGZpZWxkICdhdmF0YXJfdXJsJyBtdXN0IGJlIGEgc3RyaW5nLlwiKSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiB3aWRnZXRUeXBlICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICBzZW5kRXJyb3IoZXZlbnQsIF90KFwiVW5hYmxlIHRvIGNyZWF0ZSB3aWRnZXQuXCIpLCBuZXcgRXJyb3IoXCJGaWVsZCAndHlwZScgbXVzdCBiZSBhIHN0cmluZy5cIikpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2Ygd2lkZ2V0VXJsICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICBzZW5kRXJyb3IoZXZlbnQsIF90KFwiVW5hYmxlIHRvIGNyZWF0ZSB3aWRnZXQuXCIpLCBuZXcgRXJyb3IoXCJGaWVsZCAndXJsJyBtdXN0IGJlIGEgc3RyaW5nIG9yIG51bGwuXCIpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGNvbnZlcnQgdGhlIHdpZGdldCB0eXBlIHRvIGEga25vd24gd2lkZ2V0IHR5cGVcbiAgICB3aWRnZXRUeXBlID0gV2lkZ2V0VHlwZS5mcm9tU3RyaW5nKHdpZGdldFR5cGUpO1xuXG4gICAgaWYgKHVzZXJXaWRnZXQpIHtcbiAgICAgICAgV2lkZ2V0VXRpbHMuc2V0VXNlcldpZGdldChjbGllbnQsIHdpZGdldElkLCB3aWRnZXRUeXBlLCB3aWRnZXRVcmwsIHdpZGdldE5hbWUsIHdpZGdldERhdGEpXG4gICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgc2VuZFJlc3BvbnNlKGV2ZW50LCB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBkaXMuZGlzcGF0Y2goeyBhY3Rpb246IFwidXNlcl93aWRnZXRfdXBkYXRlZFwiIH0pO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5jYXRjaCgoZSkgPT4ge1xuICAgICAgICAgICAgICAgIHNlbmRFcnJvcihldmVudCwgX3QoXCJVbmFibGUgdG8gY3JlYXRlIHdpZGdldC5cIiksIGUpO1xuICAgICAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gUm9vbSB3aWRnZXRcbiAgICAgICAgaWYgKCFyb29tSWQpIHtcbiAgICAgICAgICAgIHNlbmRFcnJvcihldmVudCwgX3QoXCJNaXNzaW5nIHJvb21JZC5cIikpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIFdpZGdldFV0aWxzLnNldFJvb21XaWRnZXQoXG4gICAgICAgICAgICBjbGllbnQsXG4gICAgICAgICAgICByb29tSWQsXG4gICAgICAgICAgICB3aWRnZXRJZCxcbiAgICAgICAgICAgIHdpZGdldFR5cGUsXG4gICAgICAgICAgICB3aWRnZXRVcmwsXG4gICAgICAgICAgICB3aWRnZXROYW1lLFxuICAgICAgICAgICAgd2lkZ2V0RGF0YSxcbiAgICAgICAgICAgIHdpZGdldEF2YXRhclVybCxcbiAgICAgICAgKS50aGVuKFxuICAgICAgICAgICAgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHNlbmRSZXNwb25zZShldmVudCwge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIChlcnIpID0+IHtcbiAgICAgICAgICAgICAgICBzZW5kRXJyb3IoZXZlbnQsIF90KFwiRmFpbGVkIHRvIHNlbmQgcmVxdWVzdC5cIiksIGVycik7XG4gICAgICAgICAgICB9LFxuICAgICAgICApO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZ2V0V2lkZ2V0cyhldmVudDogTWVzc2FnZUV2ZW50PGFueT4sIHJvb21JZDogc3RyaW5nIHwgbnVsbCk6IHZvaWQge1xuICAgIGNvbnN0IGNsaWVudCA9IE1hdHJpeENsaWVudFBlZy5nZXQoKTtcbiAgICBpZiAoIWNsaWVudCkge1xuICAgICAgICBzZW5kRXJyb3IoZXZlbnQsIF90KFwiWW91IG5lZWQgdG8gYmUgbG9nZ2VkIGluLlwiKSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgbGV0IHdpZGdldFN0YXRlRXZlbnRzOiBQYXJ0aWFsPElFdmVudD5bXSA9IFtdO1xuXG4gICAgaWYgKHJvb21JZCkge1xuICAgICAgICBjb25zdCByb29tID0gY2xpZW50LmdldFJvb20ocm9vbUlkKTtcbiAgICAgICAgaWYgKCFyb29tKSB7XG4gICAgICAgICAgICBzZW5kRXJyb3IoZXZlbnQsIF90KFwiVGhpcyByb29tIGlzIG5vdCByZWNvZ25pc2VkLlwiKSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgLy8gWFhYOiBUaGlzIGdldHMgdGhlIHJhdyBldmVudCBvYmplY3QgKEkgdGhpbmsgYmVjYXVzZSB3ZSBjYW4ndFxuICAgICAgICAvLyBzZW5kIHRoZSBNYXRyaXhFdmVudCBvdmVyIHBvc3RNZXNzYWdlPylcbiAgICAgICAgd2lkZ2V0U3RhdGVFdmVudHMgPSBXaWRnZXRVdGlscy5nZXRSb29tV2lkZ2V0cyhyb29tKS5tYXAoKGV2KSA9PiBldi5ldmVudCk7XG4gICAgfVxuXG4gICAgLy8gQWRkIHVzZXIgd2lkZ2V0cyAobm90IGxpbmtlZCB0byBhIHNwZWNpZmljIHJvb20pXG4gICAgY29uc3QgdXNlcldpZGdldHMgPSBXaWRnZXRVdGlscy5nZXRVc2VyV2lkZ2V0c0FycmF5KGNsaWVudCk7XG4gICAgd2lkZ2V0U3RhdGVFdmVudHMgPSB3aWRnZXRTdGF0ZUV2ZW50cy5jb25jYXQodXNlcldpZGdldHMpO1xuXG4gICAgc2VuZFJlc3BvbnNlKGV2ZW50LCB3aWRnZXRTdGF0ZUV2ZW50cyk7XG59XG5cbmZ1bmN0aW9uIGdldFJvb21FbmNTdGF0ZShldmVudDogTWVzc2FnZUV2ZW50PGFueT4sIHJvb21JZDogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgY2xpZW50ID0gTWF0cml4Q2xpZW50UGVnLmdldCgpO1xuICAgIGlmICghY2xpZW50KSB7XG4gICAgICAgIHNlbmRFcnJvcihldmVudCwgX3QoXCJZb3UgbmVlZCB0byBiZSBsb2dnZWQgaW4uXCIpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCByb29tID0gY2xpZW50LmdldFJvb20ocm9vbUlkKTtcbiAgICBpZiAoIXJvb20pIHtcbiAgICAgICAgc2VuZEVycm9yKGV2ZW50LCBfdChcIlRoaXMgcm9vbSBpcyBub3QgcmVjb2duaXNlZC5cIikpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHJvb21Jc0VuY3J5cHRlZCA9IE1hdHJpeENsaWVudFBlZy5nZXQoKS5pc1Jvb21FbmNyeXB0ZWQocm9vbUlkKTtcblxuICAgIHNlbmRSZXNwb25zZShldmVudCwgcm9vbUlzRW5jcnlwdGVkKTtcbn1cblxuZnVuY3Rpb24gc2V0UGx1bWJpbmdTdGF0ZShldmVudDogTWVzc2FnZUV2ZW50PGFueT4sIHJvb21JZDogc3RyaW5nLCBzdGF0dXM6IHN0cmluZyk6IHZvaWQge1xuICAgIGlmICh0eXBlb2Ygc3RhdHVzICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlBsdW1iaW5nIHN0YXRlIHN0YXR1cyBzaG91bGQgYmUgYSBzdHJpbmdcIik7XG4gICAgfVxuICAgIGxvZ2dlci5sb2coYFJlY2VpdmVkIHJlcXVlc3QgdG8gc2V0IHBsdW1iaW5nIHN0YXRlIHRvIHN0YXR1cyBcIiR7c3RhdHVzfVwiIGluIHJvb20gJHtyb29tSWR9YCk7XG4gICAgY29uc3QgY2xpZW50ID0gTWF0cml4Q2xpZW50UGVnLmdldCgpO1xuICAgIGlmICghY2xpZW50KSB7XG4gICAgICAgIHNlbmRFcnJvcihldmVudCwgX3QoXCJZb3UgbmVlZCB0byBiZSBsb2dnZWQgaW4uXCIpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjbGllbnQuc2VuZFN0YXRlRXZlbnQocm9vbUlkLCBcIm0ucm9vbS5wbHVtYmluZ1wiLCB7IHN0YXR1czogc3RhdHVzIH0pLnRoZW4oXG4gICAgICAgICgpID0+IHtcbiAgICAgICAgICAgIHNlbmRSZXNwb25zZShldmVudCwge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgKGVycikgPT4ge1xuICAgICAgICAgICAgc2VuZEVycm9yKGV2ZW50LCBlcnIubWVzc2FnZSA/IGVyci5tZXNzYWdlIDogX3QoXCJGYWlsZWQgdG8gc2VuZCByZXF1ZXN0LlwiKSwgZXJyKTtcbiAgICAgICAgfSxcbiAgICApO1xufVxuXG5mdW5jdGlvbiBzZXRCb3RPcHRpb25zKGV2ZW50OiBNZXNzYWdlRXZlbnQ8YW55Piwgcm9vbUlkOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nKTogdm9pZCB7XG4gICAgbG9nZ2VyLmxvZyhgUmVjZWl2ZWQgcmVxdWVzdCB0byBzZXQgb3B0aW9ucyBmb3IgYm90ICR7dXNlcklkfSBpbiByb29tICR7cm9vbUlkfWApO1xuICAgIGNvbnN0IGNsaWVudCA9IE1hdHJpeENsaWVudFBlZy5nZXQoKTtcbiAgICBpZiAoIWNsaWVudCkge1xuICAgICAgICBzZW5kRXJyb3IoZXZlbnQsIF90KFwiWW91IG5lZWQgdG8gYmUgbG9nZ2VkIGluLlwiKSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY2xpZW50LnNlbmRTdGF0ZUV2ZW50KHJvb21JZCwgXCJtLnJvb20uYm90Lm9wdGlvbnNcIiwgZXZlbnQuZGF0YS5jb250ZW50LCBcIl9cIiArIHVzZXJJZCkudGhlbihcbiAgICAgICAgKCkgPT4ge1xuICAgICAgICAgICAgc2VuZFJlc3BvbnNlKGV2ZW50LCB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICAoZXJyKSA9PiB7XG4gICAgICAgICAgICBzZW5kRXJyb3IoZXZlbnQsIGVyci5tZXNzYWdlID8gZXJyLm1lc3NhZ2UgOiBfdChcIkZhaWxlZCB0byBzZW5kIHJlcXVlc3QuXCIpLCBlcnIpO1xuICAgICAgICB9LFxuICAgICk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNldEJvdFBvd2VyKFxuICAgIGV2ZW50OiBNZXNzYWdlRXZlbnQ8YW55PixcbiAgICByb29tSWQ6IHN0cmluZyxcbiAgICB1c2VySWQ6IHN0cmluZyxcbiAgICBsZXZlbDogbnVtYmVyLFxuICAgIGlnbm9yZUlmR3JlYXRlcj86IGJvb2xlYW4sXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAoIShOdW1iZXIuaXNJbnRlZ2VyKGxldmVsKSAmJiBsZXZlbCA+PSAwKSkge1xuICAgICAgICBzZW5kRXJyb3IoZXZlbnQsIF90KFwiUG93ZXIgbGV2ZWwgbXVzdCBiZSBwb3NpdGl2ZSBpbnRlZ2VyLlwiKSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBsb2dnZXIubG9nKGBSZWNlaXZlZCByZXF1ZXN0IHRvIHNldCBwb3dlciBsZXZlbCB0byAke2xldmVsfSBmb3IgYm90ICR7dXNlcklkfSBpbiByb29tICR7cm9vbUlkfS5gKTtcbiAgICBjb25zdCBjbGllbnQgPSBNYXRyaXhDbGllbnRQZWcuZ2V0KCk7XG4gICAgaWYgKCFjbGllbnQpIHtcbiAgICAgICAgc2VuZEVycm9yKGV2ZW50LCBfdChcIllvdSBuZWVkIHRvIGJlIGxvZ2dlZCBpbi5cIikpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcG93ZXJMZXZlbHMgPSBhd2FpdCBjbGllbnQuZ2V0U3RhdGVFdmVudChyb29tSWQsIFwibS5yb29tLnBvd2VyX2xldmVsc1wiLCBcIlwiKTtcblxuICAgICAgICAvLyBJZiB0aGUgUEwgaXMgZXF1YWwgdG8gb3IgZ3JlYXRlciB0aGFuIHRoZSByZXF1ZXN0ZWQgUEwsIGlnbm9yZS5cbiAgICAgICAgaWYgKGlnbm9yZUlmR3JlYXRlciA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgLy8gQXMgcGVyIGh0dHBzOi8vbWF0cml4Lm9yZy9kb2NzL3NwZWMvY2xpZW50X3NlcnZlci9yMC42LjAjbS1yb29tLXBvd2VyLWxldmVsc1xuICAgICAgICAgICAgY29uc3QgY3VycmVudFBsID0gcG93ZXJMZXZlbHMudXNlcnM/Llt1c2VySWRdID8/IHBvd2VyTGV2ZWxzLnVzZXJzX2RlZmF1bHQgPz8gMDtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UGwgPj0gbGV2ZWwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2VuZFJlc3BvbnNlKGV2ZW50LCB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgY2xpZW50LnNldFBvd2VyTGV2ZWwoXG4gICAgICAgICAgICByb29tSWQsXG4gICAgICAgICAgICB1c2VySWQsXG4gICAgICAgICAgICBsZXZlbCxcbiAgICAgICAgICAgIG5ldyBNYXRyaXhFdmVudCh7XG4gICAgICAgICAgICAgICAgdHlwZTogXCJtLnJvb20ucG93ZXJfbGV2ZWxzXCIsXG4gICAgICAgICAgICAgICAgY29udGVudDogcG93ZXJMZXZlbHMsXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIHNlbmRSZXNwb25zZShldmVudCwge1xuICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHNlbmRFcnJvcihldmVudCwgZXJyLm1lc3NhZ2UgPyBlcnIubWVzc2FnZSA6IF90KFwiRmFpbGVkIHRvIHNlbmQgcmVxdWVzdC5cIiksIGVycik7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRNZW1iZXJzaGlwU3RhdGUoZXZlbnQ6IE1lc3NhZ2VFdmVudDxhbnk+LCByb29tSWQ6IHN0cmluZywgdXNlcklkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBsb2dnZXIubG9nKGBtZW1iZXJzaGlwX3N0YXRlIG9mICR7dXNlcklkfSBpbiByb29tICR7cm9vbUlkfSByZXF1ZXN0ZWQuYCk7XG4gICAgcmV0dXJuU3RhdGVFdmVudChldmVudCwgcm9vbUlkLCBcIm0ucm9vbS5tZW1iZXJcIiwgdXNlcklkKTtcbn1cblxuZnVuY3Rpb24gZ2V0Sm9pblJ1bGVzKGV2ZW50OiBNZXNzYWdlRXZlbnQ8YW55Piwgcm9vbUlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBsb2dnZXIubG9nKGBqb2luX3J1bGVzIG9mICR7cm9vbUlkfSByZXF1ZXN0ZWQuYCk7XG4gICAgcmV0dXJuU3RhdGVFdmVudChldmVudCwgcm9vbUlkLCBcIm0ucm9vbS5qb2luX3J1bGVzXCIsIFwiXCIpO1xufVxuXG5mdW5jdGlvbiBib3RPcHRpb25zKGV2ZW50OiBNZXNzYWdlRXZlbnQ8YW55Piwgcm9vbUlkOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nKTogdm9pZCB7XG4gICAgbG9nZ2VyLmxvZyhgYm90X29wdGlvbnMgb2YgJHt1c2VySWR9IGluIHJvb20gJHtyb29tSWR9IHJlcXVlc3RlZC5gKTtcbiAgICByZXR1cm5TdGF0ZUV2ZW50KGV2ZW50LCByb29tSWQsIFwibS5yb29tLmJvdC5vcHRpb25zXCIsIFwiX1wiICsgdXNlcklkKTtcbn1cblxuZnVuY3Rpb24gZ2V0TWVtYmVyc2hpcENvdW50KGV2ZW50OiBNZXNzYWdlRXZlbnQ8YW55Piwgcm9vbUlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBjbGllbnQgPSBNYXRyaXhDbGllbnRQZWcuZ2V0KCk7XG4gICAgaWYgKCFjbGllbnQpIHtcbiAgICAgICAgc2VuZEVycm9yKGV2ZW50LCBfdChcIllvdSBuZWVkIHRvIGJlIGxvZ2dlZCBpbi5cIikpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHJvb20gPSBjbGllbnQuZ2V0Um9vbShyb29tSWQpO1xuICAgIGlmICghcm9vbSkge1xuICAgICAgICBzZW5kRXJyb3IoZXZlbnQsIF90KFwiVGhpcyByb29tIGlzIG5vdCByZWNvZ25pc2VkLlwiKSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgY291bnQgPSByb29tLmdldEpvaW5lZE1lbWJlckNvdW50KCk7XG4gICAgc2VuZFJlc3BvbnNlKGV2ZW50LCBjb3VudCk7XG59XG5cbmZ1bmN0aW9uIGNhblNlbmRFdmVudChldmVudDogTWVzc2FnZUV2ZW50PGFueT4sIHJvb21JZDogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgZXZUeXBlID0gXCJcIiArIGV2ZW50LmRhdGEuZXZlbnRfdHlwZTsgLy8gZm9yY2Ugc3RyaW5naWZ5XG4gICAgY29uc3QgaXNTdGF0ZSA9IEJvb2xlYW4oZXZlbnQuZGF0YS5pc19zdGF0ZSk7XG4gICAgY29uc3QgY2xpZW50ID0gTWF0cml4Q2xpZW50UGVnLmdldCgpO1xuICAgIGlmICghY2xpZW50KSB7XG4gICAgICAgIHNlbmRFcnJvcihldmVudCwgX3QoXCJZb3UgbmVlZCB0byBiZSBsb2dnZWQgaW4uXCIpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCByb29tID0gY2xpZW50LmdldFJvb20ocm9vbUlkKTtcbiAgICBpZiAoIXJvb20pIHtcbiAgICAgICAgc2VuZEVycm9yKGV2ZW50LCBfdChcIlRoaXMgcm9vbSBpcyBub3QgcmVjb2duaXNlZC5cIikpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChyb29tLmdldE15TWVtYmVyc2hpcCgpICE9PSBcImpvaW5cIikge1xuICAgICAgICBzZW5kRXJyb3IoZXZlbnQsIF90KFwiWW91IGFyZSBub3QgaW4gdGhpcyByb29tLlwiKSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgbWUgPSBjbGllbnQuY3JlZGVudGlhbHMudXNlcklkITtcblxuICAgIGxldCBjYW5TZW5kID0gZmFsc2U7XG4gICAgaWYgKGlzU3RhdGUpIHtcbiAgICAgICAgY2FuU2VuZCA9IHJvb20uY3VycmVudFN0YXRlLm1heVNlbmRTdGF0ZUV2ZW50KGV2VHlwZSwgbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNhblNlbmQgPSByb29tLmN1cnJlbnRTdGF0ZS5tYXlTZW5kRXZlbnQoZXZUeXBlLCBtZSk7XG4gICAgfVxuXG4gICAgaWYgKCFjYW5TZW5kKSB7XG4gICAgICAgIHNlbmRFcnJvcihldmVudCwgX3QoXCJZb3UgZG8gbm90IGhhdmUgcGVybWlzc2lvbiB0byBkbyB0aGF0IGluIHRoaXMgcm9vbS5cIikpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgc2VuZFJlc3BvbnNlKGV2ZW50LCB0cnVlKTtcbn1cblxuZnVuY3Rpb24gcmV0dXJuU3RhdGVFdmVudChldmVudDogTWVzc2FnZUV2ZW50PGFueT4sIHJvb21JZDogc3RyaW5nLCBldmVudFR5cGU6IHN0cmluZywgc3RhdGVLZXk6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGNsaWVudCA9IE1hdHJpeENsaWVudFBlZy5nZXQoKTtcbiAgICBpZiAoIWNsaWVudCkge1xuICAgICAgICBzZW5kRXJyb3IoZXZlbnQsIF90KFwiWW91IG5lZWQgdG8gYmUgbG9nZ2VkIGluLlwiKSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3Qgcm9vbSA9IGNsaWVudC5nZXRSb29tKHJvb21JZCk7XG4gICAgaWYgKCFyb29tKSB7XG4gICAgICAgIHNlbmRFcnJvcihldmVudCwgX3QoXCJUaGlzIHJvb20gaXMgbm90IHJlY29nbmlzZWQuXCIpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBzdGF0ZUV2ZW50ID0gcm9vbS5jdXJyZW50U3RhdGUuZ2V0U3RhdGVFdmVudHMoZXZlbnRUeXBlLCBzdGF0ZUtleSk7XG4gICAgaWYgKCFzdGF0ZUV2ZW50KSB7XG4gICAgICAgIHNlbmRSZXNwb25zZShldmVudCwgbnVsbCk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgc2VuZFJlc3BvbnNlKGV2ZW50LCBzdGF0ZUV2ZW50LmdldENvbnRlbnQoKSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldE9wZW5JZFRva2VuKGV2ZW50OiBNZXNzYWdlRXZlbnQ8YW55Pik6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHRva2VuT2JqZWN0ID0gYXdhaXQgTWF0cml4Q2xpZW50UGVnLmdldCgpLmdldE9wZW5JZFRva2VuKCk7XG4gICAgICAgIHNlbmRSZXNwb25zZShldmVudCwgdG9rZW5PYmplY3QpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgIGxvZ2dlci53YXJuKFwiVW5hYmxlIHRvIGZldGNoIG9wZW5JZCB0b2tlbi5cIiwgZXgpO1xuICAgICAgICBzZW5kRXJyb3IoZXZlbnQsIFwiVW5hYmxlIHRvIGZldGNoIG9wZW5JZCB0b2tlbi5cIik7XG4gICAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBzZW5kRXZlbnQoXG4gICAgZXZlbnQ6IE1lc3NhZ2VFdmVudDx7XG4gICAgICAgIHR5cGU6IHN0cmluZztcbiAgICAgICAgc3RhdGVfa2V5Pzogc3RyaW5nO1xuICAgICAgICBjb250ZW50PzogSUNvbnRlbnQ7XG4gICAgfT4sXG4gICAgcm9vbUlkOiBzdHJpbmcsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBldmVudFR5cGUgPSBldmVudC5kYXRhLnR5cGU7XG4gICAgY29uc3Qgc3RhdGVLZXkgPSBldmVudC5kYXRhLnN0YXRlX2tleTtcbiAgICBjb25zdCBjb250ZW50ID0gZXZlbnQuZGF0YS5jb250ZW50O1xuXG4gICAgaWYgKHR5cGVvZiBldmVudFR5cGUgIT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgc2VuZEVycm9yKGV2ZW50LCBfdChcIkZhaWxlZCB0byBzZW5kIGV2ZW50XCIpLCBuZXcgRXJyb3IoXCJJbnZhbGlkICd0eXBlJyBpbiByZXF1ZXN0XCIpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBhbGxvd2VkRXZlbnRUeXBlcyA9IFtcIm0ud2lkZ2V0c1wiLCBcImltLnZlY3Rvci5tb2R1bGFyLndpZGdldHNcIiwgXCJpby5lbGVtZW50LmludGVncmF0aW9ucy5pbnN0YWxsYXRpb25zXCJdO1xuICAgIGlmICghYWxsb3dlZEV2ZW50VHlwZXMuaW5jbHVkZXMoZXZlbnRUeXBlKSkge1xuICAgICAgICBzZW5kRXJyb3IoZXZlbnQsIF90KFwiRmFpbGVkIHRvIHNlbmQgZXZlbnRcIiksIG5ldyBFcnJvcihcIkRpc2FsbG93ZWQgJ3R5cGUnIGluIHJlcXVlc3RcIikpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCFjb250ZW50IHx8IHR5cGVvZiBjb250ZW50ICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIHNlbmRFcnJvcihldmVudCwgX3QoXCJGYWlsZWQgdG8gc2VuZCBldmVudFwiKSwgbmV3IEVycm9yKFwiSW52YWxpZCAnY29udGVudCcgaW4gcmVxdWVzdFwiKSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBjbGllbnQgPSBNYXRyaXhDbGllbnRQZWcuZ2V0KCk7XG4gICAgaWYgKCFjbGllbnQpIHtcbiAgICAgICAgc2VuZEVycm9yKGV2ZW50LCBfdChcIllvdSBuZWVkIHRvIGJlIGxvZ2dlZCBpbi5cIikpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgcm9vbSA9IGNsaWVudC5nZXRSb29tKHJvb21JZCk7XG4gICAgaWYgKCFyb29tKSB7XG4gICAgICAgIHNlbmRFcnJvcihldmVudCwgX3QoXCJUaGlzIHJvb20gaXMgbm90IHJlY29nbmlzZWQuXCIpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzdGF0ZUtleSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIC8vIHN0YXRlIGV2ZW50XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBjbGllbnQuc2VuZFN0YXRlRXZlbnQocm9vbUlkLCBldmVudFR5cGUsIGNvbnRlbnQsIHN0YXRlS2V5KTtcbiAgICAgICAgICAgIHNlbmRSZXNwb25zZShldmVudCwge1xuICAgICAgICAgICAgICAgIHJvb21faWQ6IHJvb21JZCxcbiAgICAgICAgICAgICAgICBldmVudF9pZDogcmVzLmV2ZW50X2lkLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHNlbmRFcnJvcihldmVudCwgX3QoXCJGYWlsZWQgdG8gc2VuZCBldmVudFwiKSwgZSBhcyBFcnJvcik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBtZXNzYWdlIGV2ZW50XG4gICAgICAgIHNlbmRFcnJvcihldmVudCwgX3QoXCJGYWlsZWQgdG8gc2VuZCBldmVudFwiKSwgbmV3IEVycm9yKFwiU2VuZGluZyBtZXNzYWdlIGV2ZW50cyBpcyBub3QgaW1wbGVtZW50ZWRcIikpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiByZWFkRXZlbnRzKFxuICAgIGV2ZW50OiBNZXNzYWdlRXZlbnQ8e1xuICAgICAgICB0eXBlOiBzdHJpbmc7XG4gICAgICAgIHN0YXRlX2tleT86IHN0cmluZyB8IGJvb2xlYW47XG4gICAgICAgIGxpbWl0PzogbnVtYmVyO1xuICAgIH0+LFxuICAgIHJvb21JZDogc3RyaW5nLFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZXZlbnRUeXBlID0gZXZlbnQuZGF0YS50eXBlO1xuICAgIGNvbnN0IHN0YXRlS2V5ID0gZXZlbnQuZGF0YS5zdGF0ZV9rZXk7XG4gICAgY29uc3QgbGltaXQgPSBldmVudC5kYXRhLmxpbWl0O1xuXG4gICAgaWYgKHR5cGVvZiBldmVudFR5cGUgIT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgc2VuZEVycm9yKGV2ZW50LCBfdChcIkZhaWxlZCB0byByZWFkIGV2ZW50c1wiKSwgbmV3IEVycm9yKFwiSW52YWxpZCAndHlwZScgaW4gcmVxdWVzdFwiKSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgYWxsb3dlZEV2ZW50VHlwZXMgPSBbXG4gICAgICAgIFwibS5yb29tLnBvd2VyX2xldmVsc1wiLFxuICAgICAgICBcIm0ucm9vbS5lbmNyeXB0aW9uXCIsXG4gICAgICAgIFwibS5yb29tLm1lbWJlclwiLFxuICAgICAgICBcIm0ucm9vbS5uYW1lXCIsXG4gICAgICAgIFwibS53aWRnZXRzXCIsXG4gICAgICAgIFwiaW0udmVjdG9yLm1vZHVsYXIud2lkZ2V0c1wiLFxuICAgICAgICBcImlvLmVsZW1lbnQuaW50ZWdyYXRpb25zLmluc3RhbGxhdGlvbnNcIixcbiAgICBdO1xuICAgIGlmICghYWxsb3dlZEV2ZW50VHlwZXMuaW5jbHVkZXMoZXZlbnRUeXBlKSkge1xuICAgICAgICBzZW5kRXJyb3IoZXZlbnQsIF90KFwiRmFpbGVkIHRvIHJlYWQgZXZlbnRzXCIpLCBuZXcgRXJyb3IoXCJEaXNhbGxvd2VkICd0eXBlJyBpbiByZXF1ZXN0XCIpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGxldCBlZmZlY3RpdmVMaW1pdDogbnVtYmVyO1xuICAgIGlmIChsaW1pdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICh0eXBlb2YgbGltaXQgIT09IFwibnVtYmVyXCIgfHwgbGltaXQgPCAwKSB7XG4gICAgICAgICAgICBzZW5kRXJyb3IoZXZlbnQsIF90KFwiRmFpbGVkIHRvIHJlYWQgZXZlbnRzXCIpLCBuZXcgRXJyb3IoXCJJbnZhbGlkICdsaW1pdCcgaW4gcmVxdWVzdFwiKSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgZWZmZWN0aXZlTGltaXQgPSBNYXRoLm1pbihsaW1pdCwgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGVmZmVjdGl2ZUxpbWl0ID0gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVI7XG4gICAgfVxuXG4gICAgY29uc3QgY2xpZW50ID0gTWF0cml4Q2xpZW50UGVnLmdldCgpO1xuICAgIGlmICghY2xpZW50KSB7XG4gICAgICAgIHNlbmRFcnJvcihldmVudCwgX3QoXCJZb3UgbmVlZCB0byBiZSBsb2dnZWQgaW4uXCIpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHJvb20gPSBjbGllbnQuZ2V0Um9vbShyb29tSWQpO1xuICAgIGlmICghcm9vbSkge1xuICAgICAgICBzZW5kRXJyb3IoZXZlbnQsIF90KFwiVGhpcyByb29tIGlzIG5vdCByZWNvZ25pc2VkLlwiKSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoc3RhdGVLZXkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAvLyBzdGF0ZSBldmVudHNcbiAgICAgICAgaWYgKHR5cGVvZiBzdGF0ZUtleSAhPT0gXCJzdHJpbmdcIiAmJiBzdGF0ZUtleSAhPT0gdHJ1ZSkge1xuICAgICAgICAgICAgc2VuZEVycm9yKGV2ZW50LCBfdChcIkZhaWxlZCB0byByZWFkIGV2ZW50c1wiKSwgbmV3IEVycm9yKFwiSW52YWxpZCAnc3RhdGVfa2V5JyBpbiByZXF1ZXN0XCIpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICAvLyBXaGVuIGB0cnVlYCBpcyBwYXNzZWQgZm9yIHN0YXRlIGtleSwgZ2V0IGV2ZW50cyB3aXRoIGFueSBzdGF0ZSBrZXkuXG4gICAgICAgIGNvbnN0IGVmZmVjdGl2ZVN0YXRlS2V5ID0gc3RhdGVLZXkgPT09IHRydWUgPyB1bmRlZmluZWQgOiBzdGF0ZUtleTtcblxuICAgICAgICBsZXQgZXZlbnRzOiBNYXRyaXhFdmVudFtdID0gW107XG4gICAgICAgIGV2ZW50cyA9IGV2ZW50cy5jb25jYXQocm9vbS5jdXJyZW50U3RhdGUuZ2V0U3RhdGVFdmVudHMoZXZlbnRUeXBlLCBlZmZlY3RpdmVTdGF0ZUtleSBhcyBzdHJpbmcpIHx8IFtdKTtcbiAgICAgICAgZXZlbnRzID0gZXZlbnRzLnNsaWNlKDAsIGVmZmVjdGl2ZUxpbWl0KTtcblxuICAgICAgICBzZW5kUmVzcG9uc2UoZXZlbnQsIHtcbiAgICAgICAgICAgIGV2ZW50czogZXZlbnRzLm1hcCgoZSkgPT4gZS5nZXRFZmZlY3RpdmVFdmVudCgpKSxcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBtZXNzYWdlIGV2ZW50c1xuICAgICAgICBzZW5kRXJyb3IoZXZlbnQsIF90KFwiRmFpbGVkIHRvIHJlYWQgZXZlbnRzXCIpLCBuZXcgRXJyb3IoXCJSZWFkaW5nIG1lc3NhZ2UgZXZlbnRzIGlzIG5vdCBpbXBsZW1lbnRlZFwiKSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG59XG5cbmNvbnN0IG9uTWVzc2FnZSA9IGZ1bmN0aW9uIChldmVudDogTWVzc2FnZUV2ZW50PGFueT4pOiB2b2lkIHtcbiAgICBpZiAoIWV2ZW50Lm9yaWdpbikge1xuICAgICAgICAvLyBAdHMtaWdub3JlIC0gc3R1cGlkIGNocm9tZVxuICAgICAgICBldmVudC5vcmlnaW4gPSBldmVudC5vcmlnaW5hbEV2ZW50Lm9yaWdpbjtcbiAgICB9XG5cbiAgICAvLyBDaGVjayB0aGF0IHRoZSBpbnRlZ3JhdGlvbnMgVUkgVVJMIHN0YXJ0cyB3aXRoIHRoZSBvcmlnaW4gb2YgdGhlIGV2ZW50XG4gICAgLy8gVGhpcyBtZWFucyB0aGUgVVJMIGNvdWxkIGNvbnRhaW4gYSBwYXRoIChsaWtlIC9kZXZlbG9wKSBhbmQgc3RpbGwgYmUgdXNlZFxuICAgIC8vIHRvIHZhbGlkYXRlIGV2ZW50IG9yaWdpbnMsIHdoaWNoIGRvIG5vdCBzcGVjaWZ5IHBhdGhzLlxuICAgIC8vIChTZWUgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1dpbmRvdy9wb3N0TWVzc2FnZSlcbiAgICBsZXQgY29uZmlnVXJsOiBVUkwgfCB1bmRlZmluZWQ7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKCFvcGVuTWFuYWdlclVybCkgb3Blbk1hbmFnZXJVcmwgPSBJbnRlZ3JhdGlvbk1hbmFnZXJzLnNoYXJlZEluc3RhbmNlKCkuZ2V0UHJpbWFyeU1hbmFnZXIoKT8udWlVcmw7XG4gICAgICAgIGNvbmZpZ1VybCA9IG5ldyBVUkwob3Blbk1hbmFnZXJVcmwhKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIC8vIE5vIGludGVncmF0aW9ucyBVSSBVUkwsIGlnbm9yZSBzaWxlbnRseS5cbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBsZXQgZXZlbnRPcmlnaW5Vcmw6IFVSTDtcbiAgICB0cnkge1xuICAgICAgICBldmVudE9yaWdpblVybCA9IG5ldyBVUkwoZXZlbnQub3JpZ2luKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gVE9ETyAtLSBTY2FsYXIgcG9zdE1lc3NhZ2UgQVBJIHNob3VsZCBiZSBuYW1lc3BhY2VkIHdpdGggZXZlbnQuZGF0YS5hcGkgZmllbGRcbiAgICAvLyBGaXggZm9sbG93aW5nIFwiaWZcIiBzdGF0ZW1lbnQgdG8gcmVzcG9uZCBvbmx5IHRvIHNwZWNpZmljIEFQSSBtZXNzYWdlcy5cbiAgICBpZiAoXG4gICAgICAgIGNvbmZpZ1VybC5vcmlnaW4gIT09IGV2ZW50T3JpZ2luVXJsLm9yaWdpbiB8fFxuICAgICAgICAhZXZlbnQuZGF0YS5hY3Rpb24gfHxcbiAgICAgICAgZXZlbnQuZGF0YS5hcGkgLy8gSWdub3JlIG1lc3NhZ2VzIHdpdGggc3BlY2lmaWMgQVBJIHNldFxuICAgICkge1xuICAgICAgICAvLyBkb24ndCBsb2cgdGhpcyAtIGRlYnVnZ2luZyBBUElzIGFuZCBicm93c2VyIGFkZC1vbnMgbGlrZSB0byBzcGFtXG4gICAgICAgIC8vIHBvc3RNZXNzYWdlIHdoaWNoIGZsb29kcyB0aGUgbG9nIG90aGVyd2lzZVxuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGV2ZW50LmRhdGEuYWN0aW9uID09PSBBY3Rpb24uQ2xvc2VTY2FsYXIpIHtcbiAgICAgICAgZGlzLmRpc3BhdGNoKHsgYWN0aW9uOiBBY3Rpb24uQ2xvc2VTY2FsYXIgfSk7XG4gICAgICAgIHNlbmRSZXNwb25zZShldmVudCwgbnVsbCk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCByb29tSWQgPSBldmVudC5kYXRhLnJvb21faWQ7XG4gICAgY29uc3QgdXNlcklkID0gZXZlbnQuZGF0YS51c2VyX2lkO1xuXG4gICAgaWYgKCFyb29tSWQpIHtcbiAgICAgICAgLy8gVGhlc2UgQVBJcyBkb24ndCByZXF1aXJlIHJvb21JZFxuICAgICAgICBpZiAoZXZlbnQuZGF0YS5hY3Rpb24gPT09IEFjdGlvbi5HZXRXaWRnZXRzKSB7XG4gICAgICAgICAgICBnZXRXaWRnZXRzKGV2ZW50LCBudWxsKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfSBlbHNlIGlmIChldmVudC5kYXRhLmFjdGlvbiA9PT0gQWN0aW9uLlNldFdpZGdldCkge1xuICAgICAgICAgICAgc2V0V2lkZ2V0KGV2ZW50LCBudWxsKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfSBlbHNlIGlmIChldmVudC5kYXRhLmFjdGlvbiA9PT0gQWN0aW9uLkdldE9wZW5JZFRva2VuKSB7XG4gICAgICAgICAgICBnZXRPcGVuSWRUb2tlbihldmVudCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZW5kRXJyb3IoZXZlbnQsIF90KFwiTWlzc2luZyByb29tX2lkIGluIHJlcXVlc3RcIikpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHJvb21JZCAhPT0gU2RrQ29udGV4dENsYXNzLmluc3RhbmNlLnJvb21WaWV3U3RvcmUuZ2V0Um9vbUlkKCkpIHtcbiAgICAgICAgc2VuZEVycm9yKGV2ZW50LCBfdChcIlJvb20gJShyb29tSWQpcyBub3QgdmlzaWJsZVwiLCB7IHJvb21JZDogcm9vbUlkIH0pKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIEdldCBhbmQgc2V0IHJvb20tYmFzZWQgd2lkZ2V0c1xuICAgIGlmIChldmVudC5kYXRhLmFjdGlvbiA9PT0gQWN0aW9uLkdldFdpZGdldHMpIHtcbiAgICAgICAgZ2V0V2lkZ2V0cyhldmVudCwgcm9vbUlkKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSBpZiAoZXZlbnQuZGF0YS5hY3Rpb24gPT09IEFjdGlvbi5TZXRXaWRnZXQpIHtcbiAgICAgICAgc2V0V2lkZ2V0KGV2ZW50LCByb29tSWQpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gVGhlc2UgQVBJcyBkb24ndCByZXF1aXJlIHVzZXJJZFxuICAgIGlmIChldmVudC5kYXRhLmFjdGlvbiA9PT0gQWN0aW9uLkpvaW5SdWxlc1N0YXRlKSB7XG4gICAgICAgIGdldEpvaW5SdWxlcyhldmVudCwgcm9vbUlkKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSBpZiAoZXZlbnQuZGF0YS5hY3Rpb24gPT09IEFjdGlvbi5TZXRQbHVtYmluZ1N0YXRlKSB7XG4gICAgICAgIHNldFBsdW1iaW5nU3RhdGUoZXZlbnQsIHJvb21JZCwgZXZlbnQuZGF0YS5zdGF0dXMpO1xuICAgICAgICByZXR1cm47XG4gICAgfSBlbHNlIGlmIChldmVudC5kYXRhLmFjdGlvbiA9PT0gQWN0aW9uLkdldE1lbWJlcnNoaXBDb3VudCkge1xuICAgICAgICBnZXRNZW1iZXJzaGlwQ291bnQoZXZlbnQsIHJvb21JZCk7XG4gICAgICAgIHJldHVybjtcbiAgICB9IGVsc2UgaWYgKGV2ZW50LmRhdGEuYWN0aW9uID09PSBBY3Rpb24uR2V0Um9vbUVuY3J5cHRpb25TdGF0ZSkge1xuICAgICAgICBnZXRSb29tRW5jU3RhdGUoZXZlbnQsIHJvb21JZCk7XG4gICAgICAgIHJldHVybjtcbiAgICB9IGVsc2UgaWYgKGV2ZW50LmRhdGEuYWN0aW9uID09PSBBY3Rpb24uQ2FuU2VuZEV2ZW50KSB7XG4gICAgICAgIGNhblNlbmRFdmVudChldmVudCwgcm9vbUlkKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSBpZiAoZXZlbnQuZGF0YS5hY3Rpb24gPT09IEFjdGlvbi5TZW5kRXZlbnQpIHtcbiAgICAgICAgc2VuZEV2ZW50KGV2ZW50LCByb29tSWQpO1xuICAgICAgICByZXR1cm47XG4gICAgfSBlbHNlIGlmIChldmVudC5kYXRhLmFjdGlvbiA9PT0gQWN0aW9uLlJlYWRFdmVudHMpIHtcbiAgICAgICAgcmVhZEV2ZW50cyhldmVudCwgcm9vbUlkKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICghdXNlcklkKSB7XG4gICAgICAgIHNlbmRFcnJvcihldmVudCwgX3QoXCJNaXNzaW5nIHVzZXJfaWQgaW4gcmVxdWVzdFwiKSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgc3dpdGNoIChldmVudC5kYXRhLmFjdGlvbikge1xuICAgICAgICBjYXNlIEFjdGlvbi5NZW1iZXJzaGlwU3RhdGU6XG4gICAgICAgICAgICBnZXRNZW1iZXJzaGlwU3RhdGUoZXZlbnQsIHJvb21JZCwgdXNlcklkKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIEFjdGlvbi5pbnZpdGU6XG4gICAgICAgICAgICBpbnZpdGVVc2VyKGV2ZW50LCByb29tSWQsIHVzZXJJZCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBBY3Rpb24uS2ljazpcbiAgICAgICAgICAgIGtpY2tVc2VyKGV2ZW50LCByb29tSWQsIHVzZXJJZCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBBY3Rpb24uQm90T3B0aW9uczpcbiAgICAgICAgICAgIGJvdE9wdGlvbnMoZXZlbnQsIHJvb21JZCwgdXNlcklkKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIEFjdGlvbi5TZXRCb3RPcHRpb25zOlxuICAgICAgICAgICAgc2V0Qm90T3B0aW9ucyhldmVudCwgcm9vbUlkLCB1c2VySWQpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgQWN0aW9uLlNldEJvdFBvd2VyOlxuICAgICAgICAgICAgc2V0Qm90UG93ZXIoZXZlbnQsIHJvb21JZCwgdXNlcklkLCBldmVudC5kYXRhLmxldmVsLCBldmVudC5kYXRhLmlnbm9yZUlmR3JlYXRlcik7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGxvZ2dlci53YXJuKFwiVW5oYW5kbGVkIHBvc3RNZXNzYWdlIGV2ZW50IHdpdGggYWN0aW9uICdcIiArIGV2ZW50LmRhdGEuYWN0aW9uICsgXCInXCIpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgfVxufTtcblxubGV0IGxpc3RlbmVyQ291bnQgPSAwO1xubGV0IG9wZW5NYW5hZ2VyVXJsOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cbmV4cG9ydCBmdW5jdGlvbiBzdGFydExpc3RlbmluZygpOiB2b2lkIHtcbiAgICBpZiAobGlzdGVuZXJDb3VudCA9PT0gMCkge1xuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgb25NZXNzYWdlLCBmYWxzZSk7XG4gICAgfVxuICAgIGxpc3RlbmVyQ291bnQgKz0gMTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0b3BMaXN0ZW5pbmcoKTogdm9pZCB7XG4gICAgbGlzdGVuZXJDb3VudCAtPSAxO1xuICAgIGlmIChsaXN0ZW5lckNvdW50ID09PSAwKSB7XG4gICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBvbk1lc3NhZ2UpO1xuICAgIH1cbiAgICBpZiAobGlzdGVuZXJDb3VudCA8IDApIHtcbiAgICAgICAgLy8gTWFrZSBhbiBlcnJvciBzbyB3ZSBnZXQgYSBzdGFjayB0cmFjZVxuICAgICAgICBjb25zdCBlID0gbmV3IEVycm9yKFwiU2NhbGFyTWVzc2FnaW5nOiBtaXNtYXRjaGVkIHN0YXJ0TGlzdGVuaW5nIC8gc3RvcExpc3RlbmluZyBkZXRlY3RlZC5cIiArIFwiIE5lZ2F0aXZlIGNvdW50XCIpO1xuICAgICAgICBsb2dnZXIuZXJyb3IoZSk7XG4gICAgfVxufVxuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQXFTQSxJQUFBQSxNQUFBLEdBQUFDLE9BQUE7QUFDQSxJQUFBQyxPQUFBLEdBQUFELE9BQUE7QUFHQSxJQUFBRSxnQkFBQSxHQUFBRixPQUFBO0FBQ0EsSUFBQUcsV0FBQSxHQUFBQyxzQkFBQSxDQUFBSixPQUFBO0FBQ0EsSUFBQUssWUFBQSxHQUFBRCxzQkFBQSxDQUFBSixPQUFBO0FBQ0EsSUFBQU0sZ0JBQUEsR0FBQU4sT0FBQTtBQUNBLElBQUFPLG9CQUFBLEdBQUFQLE9BQUE7QUFDQSxJQUFBUSxXQUFBLEdBQUFSLE9BQUE7QUFDQSxJQUFBUyxRQUFBLEdBQUFULE9BQUE7QUFDQSxJQUFBVSxXQUFBLEdBQUFWLE9BQUE7QUFDQSxJQUFBVyxXQUFBLEdBQUFYLE9BQUE7QUFqVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUVBO0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQS9RQSxJQStSS1ksTUFBTSwwQkFBTkEsTUFBTTtFQUFOQSxNQUFNO0VBQU5BLE1BQU07RUFBTkEsTUFBTTtFQUFOQSxNQUFNO0VBQU5BLE1BQU07RUFBTkEsTUFBTTtFQUFOQSxNQUFNO0VBQU5BLE1BQU07RUFBTkEsTUFBTTtFQUFOQSxNQUFNO0VBQU5BLE1BQU07RUFBTkEsTUFBTTtFQUFOQSxNQUFNO0VBQU5BLE1BQU07RUFBTkEsTUFBTTtFQUFOQSxNQUFNO0VBQU5BLE1BQU07RUFBQSxPQUFOQSxNQUFNO0FBQUEsRUFBTkEsTUFBTTtBQW9CWCxTQUFTQyxZQUFZQSxDQUFDQyxLQUF3QixFQUFFQyxHQUFRLEVBQVE7RUFDNUQsTUFBTUMsSUFBSSxHQUFHLElBQUFDLG9CQUFXLEVBQUNILEtBQUssQ0FBQ0UsSUFBSSxDQUFDO0VBQ3BDQSxJ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