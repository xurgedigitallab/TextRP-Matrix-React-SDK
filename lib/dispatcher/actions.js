"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Action = void 0;
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
// Dispatcher actions also extend into any arbitrary string, so support that.
let Action = /*#__PURE__*/function (Action) {
  Action["ViewUser"] = "view_user";
  Action["ViewUserSettings"] = "view_user_settings";
  Action["ViewUserDeviceSettings"] = "view_user_device_settings";
  Action["ViewRoomDirectory"] = "view_room_directory";
  Action["ViewRoomError"] = "view_room_error";
  Action["ViewHomePage"] = "view_home_page";
  Action["RecheckTheme"] = "recheck_theme";
  Action["CheckUpdates"] = "check_updates";
  Action["FocusSendMessageComposer"] = "focus_send_message_composer";
  Action["ClearAndFocusSendMessageComposer"] = "clear_focus_send_message_composer";
  Action["FocusEditMessageComposer"] = "focus_edit_message_composer";
  Action["FocusAComposer"] = "focus_a_composer";
  Action["ToggleUserMenu"] = "toggle_user_menu";
  Action["ToggleSpacePanel"] = "toggle_space_panel";
  Action["UpdateFontSize"] = "update_font_size";
  Action["UpdateSystemFont"] = "update_system_font";
  Action["ViewRoom"] = "view_room";
  Action["ViewThread"] = "view_thread";
  Action["ViewRoomDelta"] = "view_room_delta";
  Action["OpenDialPad"] = "open_dial_pad";
  Action["DialNumber"] = "dial_number";
  Action["PstnSupportUpdated"] = "pstn_support_updated";
  Action["VirtualRoomSupportUpdated"] = "virtual_room_support_updated";
  Action["UploadStarted"] = "upload_started";
  Action["UploadProgress"] = "upload_progress";
  Action["UploadFinished"] = "upload_finished";
  Action["UploadFailed"] = "upload_failed";
  Action["UploadCanceled"] = "upload_canceled";
  Action["JoinRoom"] = "join_room";
  Action["JoinRoomReady"] = "join_room_ready";
  Action["JoinRoomError"] = "join_room_error";
  Action["BulkRedactStart"] = "bulk_redact_start";
  Action["BulkRedactEnd"] = "bulk_redact_end";
  Action["ComposerInsert"] = "composer_insert";
  Action["SwitchSpace"] = "switch_space";
  Action["UpdateSpaceHierarchy"] = "update_space_hierarchy";
  Action["SettingUpdated"] = "setting_updated";
  Action["EditEvent"] = "edit_event";
  Action["PseudonymousAnalyticsAccept"] = "pseudonymous_analytics_accept";
  Action["PseudonymousAnalyticsReject"] = "pseudonymous_analytics_reject";
  Action["ReportKeyBackupNotEnabled"] = "report_key_backup_not_enabled";
  Action["AfterLeaveRoom"] = "after_leave_room";
  Action["DoAfterSyncPrepared"] = "do_after_sync_prepared";
  Action["ViewStartChatOrReuse"] = "view_start_chat_or_reuse";
  Action["ActiveRoomChanged"] = "active_room_changed";
  Action["OpenForwardDialog"] = "open_forward_dialog";
  Action["OpenReportEventDialog"] = "open_report_event_dialog";
  Action["TriggerLogout"] = "trigger_logout";
  Action["OpenSpacePreferences"] = "open_space_preferences";
  Action["OpenSpaceSettings"] = "open_space_settings";
  Action["OpenInviteDialog"] = "open_invite_dialog";
  Action["OpenAddToExistingSpaceDialog"] = "open_add_to_existing_space_dialog";
  Action["DumpDebugLogs"] = "dump_debug_logs";
  Action["ShowRoomTopic"] = "show_room_topic";
  Action["OnLoggedOut"] = "on_logged_out";
  Action["OnLoggedIn"] = "on_logged_in";
  Action["OverwriteLogin"] = "overwrite_login";
  Action["PlatformSet"] = "platform_set";
  Action["ShowThread"] = "show_thread";
  return Action;
}({});
exports.Action = Action;
//# sourceMappingURL=actions.js.map