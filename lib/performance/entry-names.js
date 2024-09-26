"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PerformanceEntryNames = void 0;
/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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
let PerformanceEntryNames = /*#__PURE__*/function (PerformanceEntryNames) {
  PerformanceEntryNames["APP_STARTUP"] = "mx_AppStartup";
  PerformanceEntryNames["PAGE_CHANGE"] = "mx_PageChange";
  PerformanceEntryNames["RESEND_EVENT"] = "mx_ResendEvent";
  PerformanceEntryNames["SEND_E2EE_EVENT"] = "mx_SendE2EEEvent";
  PerformanceEntryNames["SEND_ATTACHMENT"] = "mx_SendAttachment";
  PerformanceEntryNames["SWITCH_ROOM"] = "mx_SwithRoom";
  PerformanceEntryNames["JUMP_TO_ROOM"] = "mx_JumpToRoom";
  PerformanceEntryNames["JOIN_ROOM"] = "mx_JoinRoom";
  PerformanceEntryNames["CREATE_DM"] = "mx_CreateDM";
  PerformanceEntryNames["PEEK_ROOM"] = "mx_PeekRoom";
  PerformanceEntryNames["VERIFY_E2EE_USER"] = "mx_VerifyE2EEUser";
  PerformanceEntryNames["LOGIN"] = "mx_Login";
  PerformanceEntryNames["REGISTER"] = "mx_Register";
  PerformanceEntryNames["SETUP_VOIP_CALL"] = "mx_SetupVoIPCall";
  return PerformanceEntryNames;
}({});
exports.PerformanceEntryNames = PerformanceEntryNames;
//# sourceMappingURL=entry-names.js.map