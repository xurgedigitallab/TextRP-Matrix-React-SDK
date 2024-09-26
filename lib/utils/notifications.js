"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.clearAllNotifications = clearAllNotifications;
exports.clearRoomNotification = clearRoomNotification;
exports.createLocalNotificationSettingsIfNeeded = createLocalNotificationSettingsIfNeeded;
exports.deviceNotificationSettingsKeys = void 0;
exports.getLocalNotificationAccountDataEventType = getLocalNotificationAccountDataEventType;
exports.localNotificationsAreSilenced = localNotificationsAreSilenced;
var _event = require("matrix-js-sdk/src/@types/event");
var _read_receipts = require("matrix-js-sdk/src/@types/read_receipts");
var _room = require("matrix-js-sdk/src/models/room");
var _SettingsStore = _interopRequireDefault(require("../settings/SettingsStore"));
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

const deviceNotificationSettingsKeys = ["notificationsEnabled", "notificationBodyEnabled", "audioNotificationsEnabled"];
exports.deviceNotificationSettingsKeys = deviceNotificationSettingsKeys;
function getLocalNotificationAccountDataEventType(deviceId) {
  return `${_event.LOCAL_NOTIFICATION_SETTINGS_PREFIX.name}.${deviceId}`;
}
async function createLocalNotificationSettingsIfNeeded(cli) {
  if (cli.isGuest()) {
    return;
  }
  const eventType = getLocalNotificationAccountDataEventType(cli.deviceId);
  const event = cli.getAccountData(eventType);
  // New sessions will create an account data event to signify they support
  // remote toggling of push notifications on this device. Default `is_silenced=true`
  // For backwards compat purposes, older sessions will need to check settings value
  // to determine what the state of `is_silenced`
  if (!event) {
    // If any of the above is true, we fall in the "backwards compat" case,
    // and `is_silenced` will be set to `false`
    const isSilenced = !deviceNotificationSettingsKeys.some(key => _SettingsStore.default.getValue(key));
    await cli.setAccountData(eventType, {
      is_silenced: isSilenced
    });
  }
}
function localNotificationsAreSilenced(cli) {
  const eventType = getLocalNotificationAccountDataEventType(cli.deviceId);
  const event = cli.getAccountData(eventType);
  return event?.getContent()?.is_silenced ?? false;
}

/**
 * Mark a room as read
 * @param room
 * @param client
 * @returns a promise that resolves when the room has been marked as read
 */
async function clearRoomNotification(room, client) {
  const lastEvent = room.getLastLiveEvent();
  try {
    if (lastEvent) {
      const receiptType = _SettingsStore.default.getValue("sendReadReceipts", room.roomId) ? _read_receipts.ReceiptType.Read : _read_receipts.ReceiptType.ReadPrivate;
      return await client.sendReadReceipt(lastEvent, receiptType, true);
    } else {
      return {};
    }
  } finally {
    // We've had a lot of stuck unread notifications that in e2ee rooms
    // They occur on event decryption when clients try to replicate the logic
    //
    // This resets the notification on a room, even though no read receipt
    // has been sent, particularly useful when the clients has incorrectly
    // notified a user.
    room.setUnreadNotificationCount(_room.NotificationCountType.Highlight, 0);
    room.setUnreadNotificationCount(_room.NotificationCountType.Total, 0);
    for (const thread of room.getThreads()) {
      room.setThreadUnreadNotificationCount(thread.id, _room.NotificationCountType.Highlight, 0);
      room.setThreadUnreadNotificationCount(thread.id, _room.NotificationCountType.Total, 0);
    }
  }
}

/**
 * Marks all rooms with an unread counter as read
 * @param client The matrix client
 * @returns a promise that resolves when all rooms have been marked as read
 */
function clearAllNotifications(client) {
  const receiptPromises = client.getRooms().reduce((promises, room) => {
    if (room.getUnreadNotificationCount() > 0) {
      const promise = clearRoomNotification(room, client);
      promises.push(promise);
    }
    return promises;
  }, []);
  return Promise.all(receiptPromises);
}
//# sourceMappingURL=notifications.js.map