"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.textForType = exports.textForFormat = exports.ExportType = exports.ExportFormat = void 0;
var _languageHandler = require("../../languageHandler");
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
let ExportFormat = /*#__PURE__*/function (ExportFormat) {
  ExportFormat["Html"] = "Html";
  ExportFormat["PlainText"] = "PlainText";
  ExportFormat["Json"] = "Json";
  return ExportFormat;
}({});
exports.ExportFormat = ExportFormat;
let ExportType = /*#__PURE__*/function (ExportType) {
  ExportType["Timeline"] = "Timeline";
  ExportType["Beginning"] = "Beginning";
  ExportType["LastNMessages"] = "LastNMessages";
  return ExportType;
}({}); // START_DATE = "START_DATE",
exports.ExportType = ExportType;
const textForFormat = format => {
  switch (format) {
    case ExportFormat.Html:
      return (0, _languageHandler._t)("HTML");
    case ExportFormat.Json:
      return (0, _languageHandler._t)("JSON");
    case ExportFormat.PlainText:
      return (0, _languageHandler._t)("Plain Text");
    default:
      throw new Error("Unknown format");
  }
};
exports.textForFormat = textForFormat;
const textForType = type => {
  switch (type) {
    case ExportType.Beginning:
      return (0, _languageHandler._t)("From the beginning");
    case ExportType.LastNMessages:
      return (0, _languageHandler._t)("Specify a number of messages");
    case ExportType.Timeline:
      return (0, _languageHandler._t)("Current Timeline");
    default:
      throw new Error("Unknown type: " + type);
    // case exportTypes.START_DATE:
    //     return _t("From a specific date");
  }
};
exports.textForType = textForType;
//# sourceMappingURL=exportUtils.js.map