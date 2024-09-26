"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.PosthogScreenTracker = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _react = require("react");
var _PageTypes = _interopRequireDefault(require("./PageTypes"));
var _Views = _interopRequireDefault(require("./Views"));
var _PosthogAnalytics = require("./PosthogAnalytics");
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

const notLoggedInMap = {
  [_Views.default.LOADING]: "Loading",
  [_Views.default.WELCOME]: "Welcome",
  [_Views.default.LOGIN]: "Login",
  [_Views.default.REGISTER]: "Register",
  [_Views.default.USE_CASE_SELECTION]: "UseCaseSelection",
  [_Views.default.FORGOT_PASSWORD]: "ForgotPassword",
  [_Views.default.COMPLETE_SECURITY]: "CompleteSecurity",
  [_Views.default.E2E_SETUP]: "E2ESetup",
  [_Views.default.SOFT_LOGOUT]: "SoftLogout"
};
const loggedInPageTypeMap = {
  [_PageTypes.default.HomePage]: "Home",
  [_PageTypes.default.RoomView]: "Room",
  [_PageTypes.default.UserView]: "User"
};
class PosthogTrackers {
  constructor() {
    (0, _defineProperty2.default)(this, "view", _Views.default.LOADING);
    (0, _defineProperty2.default)(this, "pageType", void 0);
    (0, _defineProperty2.default)(this, "override", void 0);
  }
  static get instance() {
    if (!PosthogTrackers.internalInstance) {
      PosthogTrackers.internalInstance = new PosthogTrackers();
    }
    return PosthogTrackers.internalInstance;
  }
  trackPageChange(view, pageType, durationMs) {
    this.view = view;
    this.pageType = pageType;
    if (this.override) return;
    this.trackPage(durationMs);
  }
  trackPage(durationMs) {
    const screenName = this.view === _Views.default.LOGGED_IN ? loggedInPageTypeMap[this.pageType] : notLoggedInMap[this.view];
    _PosthogAnalytics.PosthogAnalytics.instance.trackEvent({
      eventName: "$pageview",
      $current_url: screenName,
      durationMs
    });
  }
  trackOverride(screenName) {
    if (!screenName) return;
    this.override = screenName;
    _PosthogAnalytics.PosthogAnalytics.instance.trackEvent({
      eventName: "$pageview",
      $current_url: screenName
    });
  }
  clearOverride(screenName) {
    if (screenName !== this.override) return;
    this.override = undefined;
    this.trackPage();
  }
  static trackInteraction(name, ev, index) {
    let interactionType;
    if (ev?.type === "click") {
      interactionType = "Pointer";
    } else if (ev?.type.startsWith("key")) {
      interactionType = "Keyboard";
    }
    _PosthogAnalytics.PosthogAnalytics.instance.trackEvent({
      eventName: "Interaction",
      interactionType,
      index,
      name
    });
  }
}
exports.default = PosthogTrackers;
(0, _defineProperty2.default)(PosthogTrackers, "internalInstance", void 0);
class PosthogScreenTracker extends _react.PureComponent {
  componentDidMount() {
    PosthogTrackers.instance.trackOverride(this.props.screenName);
  }
  componentDidUpdate() {
    // We do not clear the old override here so that we do not send the non-override screen as a transition
    PosthogTrackers.instance.trackOverride(this.props.screenName);
  }
  componentWillUnmount() {
    PosthogTrackers.instance.clearOverride(this.props.screenName);
  }
  render() {
    return null; // no need to render anything, we just need to hook into the React lifecycle
  }
}
exports.PosthogScreenTracker = PosthogScreenTracker;
//# sourceMappingURL=PosthogTrackers.js.map