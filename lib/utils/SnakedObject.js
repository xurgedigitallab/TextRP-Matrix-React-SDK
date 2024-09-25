"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SnakedObject = void 0;
exports.snakeToCamel = snakeToCamel;
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

function snakeToCamel(s) {
  return s.replace(/._./g, v => `${v[0]}${v[2].toUpperCase()}`);
}
class SnakedObject {
  constructor(obj) {
    this.obj = obj;
  }
  get(key, altCaseName) {
    const val = this.obj[key];
    if (val !== undefined) return val;
    return this.obj[altCaseName ?? snakeToCamel(key)];
  }

  // Make JSON.stringify() pretend that everything is fine
  toJSON() {
    return this.obj;
  }
}
exports.SnakedObject = SnakedObject;
//# sourceMappingURL=SnakedObject.js.map