"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isObject = isObject;
exports.objectClone = objectClone;
exports.objectDiff = objectDiff;
exports.objectExcluding = objectExcluding;
exports.objectHasDiff = objectHasDiff;
exports.objectKeyChanges = objectKeyChanges;
exports.objectShallowClone = objectShallowClone;
exports.objectWithOnly = objectWithOnly;
var _arrays = require("./arrays");
/*
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

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
 * Gets a new object which represents the provided object, excluding some properties.
 * @param a The object to strip properties of. Must be defined.
 * @param props The property names to remove.
 * @returns The new object without the provided properties.
 */
function objectExcluding(a, props) {
  // We use a Map to avoid hammering the `delete` keyword, which is slow and painful.
  const tempMap = new Map(Object.entries(a));
  for (const prop of props) {
    tempMap.delete(prop);
  }

  // Convert the map to an object again
  return Array.from(tempMap.entries()).reduce((c, _ref) => {
    let [k, v] = _ref;
    c[k] = v;
    return c;
  }, {});
}

/**
 * Gets a new object which represents the provided object, with only some properties
 * included.
 * @param a The object to clone properties of. Must be defined.
 * @param props The property names to keep.
 * @returns The new object with only the provided properties.
 */
function objectWithOnly(a, props) {
  const existingProps = Object.keys(a);
  const diff = (0, _arrays.arrayDiff)(existingProps, props);
  if (diff.removed.length === 0) {
    return objectShallowClone(a);
  } else {
    return objectExcluding(a, diff.removed);
  }
}

/**
 * Clones an object to a caller-controlled depth. When a propertyCloner is supplied, the
 * object's properties will be passed through it with the return value used as the new
 * object's type. This is intended to be used to deep clone a reference, but without
 * having to deep clone the entire object. This function is safe to call recursively within
 * the propertyCloner.
 * @param a The object to clone. Must be defined.
 * @param propertyCloner The function to clone the properties of the object with, optionally.
 * First argument is the property key with the second being the current value.
 * @returns A cloned object.
 */
function objectShallowClone(a, propertyCloner) {
  const newObj = {};
  for (const [k, v] of Object.entries(a)) {
    newObj[k] = v;
    if (propertyCloner) {
      newObj[k] = propertyCloner(k, v);
    }
  }
  return newObj;
}

/**
 * Determines if any keys were added, removed, or changed between two objects.
 * For changes, simple triple equal comparisons are done, not in-depth
 * tree checking.
 * @param a The first object. Must be defined.
 * @param b The second object. Must be defined.
 * @returns True if there's a difference between the objects, false otherwise
 */
function objectHasDiff(a, b) {
  if (a === b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return true;
  const possibleChanges = (0, _arrays.arrayIntersection)(aKeys, bKeys);
  // if the amalgamation of both sets of keys has the a different length to the inputs then there must be a change
  if (possibleChanges.length !== aKeys.length) return true;
  return possibleChanges.some(k => a[k] !== b[k]);
}
/**
 * Determines the keys added, changed, and removed between two objects.
 * For changes, simple triple equal comparisons are done, not in-depth
 * tree checking.
 * @param a The first object. Must be defined.
 * @param b The second object. Must be defined.
 * @returns The difference between the keys of each object.
 */
function objectDiff(a, b) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  const keyDiff = (0, _arrays.arrayDiff)(aKeys, bKeys);
  const possibleChanges = (0, _arrays.arrayIntersection)(aKeys, bKeys);
  const changes = possibleChanges.filter(k => a[k] !== b[k]);
  return {
    changed: changes,
    added: keyDiff.added,
    removed: keyDiff.removed
  };
}

/**
 * Gets all the key changes (added, removed, or value difference) between
 * two objects. Triple equals is used to compare values, not in-depth tree
 * checking.
 * @param a The first object. Must be defined.
 * @param b The second object. Must be defined.
 * @returns The keys which have been added, removed, or changed between the
 * two objects.
 */
function objectKeyChanges(a, b) {
  const diff = objectDiff(a, b);
  return (0, _arrays.arrayUnion)(diff.removed, diff.added, diff.changed);
}

/**
 * Clones an object by running it through JSON parsing. Note that this
 * will destroy any complicated object types which do not translate to
 * JSON.
 * @param obj The object to clone.
 * @returns The cloned object
 */
function objectClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
function isObject(item) {
  return item && typeof item === "object" && !Array.isArray(item);
}
//# sourceMappingURL=objects.js.map