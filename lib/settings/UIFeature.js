"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.UIFeature = exports.UIComponent = void 0;
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
// see settings.md for documentation on conventions
let UIFeature = /*#__PURE__*/function (UIFeature) {
  UIFeature["AdvancedEncryption"] = "UIFeature.advancedEncryption";
  UIFeature["URLPreviews"] = "UIFeature.urlPreviews";
  UIFeature["Widgets"] = "UIFeature.widgets";
  UIFeature["LocationSharing"] = "UIFeature.locationSharing";
  UIFeature["Voip"] = "UIFeature.voip";
  UIFeature["Feedback"] = "UIFeature.feedback";
  UIFeature["Registration"] = "UIFeature.registration";
  UIFeature["PasswordReset"] = "UIFeature.passwordReset";
  UIFeature["Deactivate"] = "UIFeature.deactivate";
  UIFeature["ShareQRCode"] = "UIFeature.shareQrCode";
  UIFeature["ShareSocial"] = "UIFeature.shareSocial";
  UIFeature["IdentityServer"] = "UIFeature.identityServer";
  UIFeature["ThirdPartyID"] = "UIFeature.thirdPartyId";
  UIFeature["AdvancedSettings"] = "UIFeature.advancedSettings";
  UIFeature["RoomHistorySettings"] = "UIFeature.roomHistorySettings";
  UIFeature["TimelineEnableRelativeDates"] = "UIFeature.timelineEnableRelativeDates";
  UIFeature["BulkUnverifiedSessionsReminder"] = "UIFeature.BulkUnverifiedSessionsReminder";
  return UIFeature;
}({});
exports.UIFeature = UIFeature;
let UIComponent = /*#__PURE__*/function (UIComponent) {
  UIComponent["InviteUsers"] = "UIComponent.sendInvites";
  UIComponent["CreateRooms"] = "UIComponent.roomCreation";
  UIComponent["CreateSpaces"] = "UIComponent.spaceCreation";
  UIComponent["ExploreRooms"] = "UIComponent.exploreRooms";
  UIComponent["AddIntegrations"] = "UIComponent.addIntegrations";
  UIComponent["FilterContainer"] = "UIComponent.filterContainer";
  UIComponent["RoomOptionsMenu"] = "UIComponent.roomOptionsMenu";
  return UIComponent;
}({});
exports.UIComponent = UIComponent;
//# sourceMappingURL=UIFeature.js.map