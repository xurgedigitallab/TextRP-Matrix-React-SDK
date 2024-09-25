"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.EnhancedMap = void 0;
exports.mapDiff = mapDiff;
var _arrays = require("./arrays");
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
 * Determines the keys added, changed, and removed between two Maps.
 * For changes, simple triple equal comparisons are done, not in-depth tree checking.
 * @param a The first Map. Must be defined.
 * @param b The second Map. Must be defined.
 * @returns The difference between the keys of each Map.
 */
function mapDiff(a, b) {
  const aKeys = [...a.keys()];
  const bKeys = [...b.keys()];
  const keyDiff = (0, _arrays.arrayDiff)(aKeys, bKeys);
  const possibleChanges = (0, _arrays.arrayIntersection)(aKeys, bKeys);
  const changes = possibleChanges.filter(k => a.get(k) !== b.get(k));
  return {
    changed: changes,
    added: keyDiff.added,
    removed: keyDiff.removed
  };
}

/**
 * A Map<K, V> with added utility.
 */
class EnhancedMap extends Map {
  constructor(entries) {
    super(entries);
  }
  getOrCreate(key, def) {
    if (this.has(key)) {
      return this.get(key);
    }
    this.set(key, def);
    return def;
  }
  remove(key) {
    const v = this.get(key);
    this.delete(key);
    return v;
  }
}
exports.EnhancedMap = EnhancedMap;
//# sourceMappingURL=maps.js.map