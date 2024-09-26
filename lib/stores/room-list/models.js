"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RoomUpdateCause = exports.OrderedDefaultTagIDs = exports.DefaultTagID = void 0;
/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
let DefaultTagID = /*#__PURE__*/function (DefaultTagID) {
  DefaultTagID["Invite"] = "im.vector.fake.invite";
  DefaultTagID["Untagged"] = "im.vector.fake.recent";
  DefaultTagID["Archived"] = "im.vector.fake.archived";
  DefaultTagID["LowPriority"] = "m.lowpriority";
  DefaultTagID["Favourite"] = "m.favourite";
  DefaultTagID["DM"] = "im.vector.fake.direct";
  DefaultTagID["Bot"] = "im.vector.fake.bot";
  DefaultTagID["ServerNotice"] = "m.server_notice";
  DefaultTagID["Suggested"] = "im.vector.fake.suggested";
  DefaultTagID["SavedItems"] = "im.vector.fake.saved_items";
  return DefaultTagID;
}({});
exports.DefaultTagID = DefaultTagID;
const OrderedDefaultTagIDs = [DefaultTagID.Invite, DefaultTagID.Favourite, DefaultTagID.SavedItems, DefaultTagID.DM, DefaultTagID.Bot, DefaultTagID.Untagged, DefaultTagID.LowPriority, DefaultTagID.ServerNotice, DefaultTagID.Suggested, DefaultTagID.Archived];
exports.OrderedDefaultTagIDs = OrderedDefaultTagIDs;
let RoomUpdateCause = /*#__PURE__*/function (RoomUpdateCause) {
  RoomUpdateCause["Timeline"] = "TIMELINE";
  RoomUpdateCause["PossibleTagChange"] = "POSSIBLE_TAG_CHANGE";
  RoomUpdateCause["PossibleMuteChange"] = "POSSIBLE_MUTE_CHANGE";
  RoomUpdateCause["ReadReceipt"] = "READ_RECEIPT";
  RoomUpdateCause["NewRoom"] = "NEW_ROOM";
  RoomUpdateCause["RoomRemoved"] = "ROOM_REMOVED";
  return RoomUpdateCause;
}({});
exports.RoomUpdateCause = RoomUpdateCause;
//# sourceMappingURL=models.js.map