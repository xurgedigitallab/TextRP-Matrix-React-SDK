"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.readReceiptChangeIsFor = readReceiptChangeIsFor;
var _utils = require("matrix-js-sdk/src/utils");
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

/**
 * Determines if a read receipt update event includes the client's own user.
 * @param event The event to check.
 * @param client The client to check against.
 * @returns True if the read receipt update includes the client, false otherwise.
 */
function readReceiptChangeIsFor(event, client) {
  const myUserId = client.getUserId();
  for (const eventId of Object.keys(event.getContent())) {
    for (const [receiptType, receipt] of Object.entries(event.getContent()[eventId])) {
      if (!(0, _utils.isSupportedReceiptType)(receiptType)) continue;
      if (Object.keys(receipt || {}).includes(myUserId)) return true;
    }
  }
  return false;
}
//# sourceMappingURL=read-receipts.js.map