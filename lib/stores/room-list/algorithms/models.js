"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SortAlgorithm = exports.ListAlgorithm = void 0;
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
let SortAlgorithm = /*#__PURE__*/function (SortAlgorithm) {
  SortAlgorithm["Manual"] = "MANUAL";
  SortAlgorithm["Alphabetic"] = "ALPHABETIC";
  SortAlgorithm["Recent"] = "RECENT";
  return SortAlgorithm;
}({});
exports.SortAlgorithm = SortAlgorithm;
let ListAlgorithm = /*#__PURE__*/function (ListAlgorithm) {
  ListAlgorithm["Importance"] = "IMPORTANCE";
  ListAlgorithm["Natural"] = "NATURAL";
  return ListAlgorithm;
}({});
exports.ListAlgorithm = ListAlgorithm;
//# sourceMappingURL=models.js.map