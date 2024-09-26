"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.flattenSpaceHierarchyWithCache = exports.flattenSpaceHierarchy = void 0;
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

const traverseSpaceDescendants = function (spaceDescendantMap, spaceId) {
  let flatSpace = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : new Set();
  flatSpace.add(spaceId);
  const descendentSpaces = spaceDescendantMap.get(spaceId);
  descendentSpaces?.forEach(descendantSpaceId => {
    if (!flatSpace.has(descendantSpaceId)) {
      traverseSpaceDescendants(spaceDescendantMap, descendantSpaceId, flatSpace);
    }
  });
  return flatSpace;
};

/**
 * Helper function to traverse space hierarchy and flatten
 * @param spaceEntityMap ie map of rooms or dm userIds
 * @param spaceDescendantMap map of spaces and their children
 * @returns set of all rooms
 */
const flattenSpaceHierarchy = (spaceEntityMap, spaceDescendantMap, spaceId) => {
  const flattenedSpaceIds = traverseSpaceDescendants(spaceDescendantMap, spaceId);
  const flattenedRooms = new Set();
  flattenedSpaceIds.forEach(id => {
    const roomIds = spaceEntityMap.get(id);
    roomIds?.forEach(flattenedRooms.add, flattenedRooms);
  });
  return flattenedRooms;
};
exports.flattenSpaceHierarchy = flattenSpaceHierarchy;
const flattenSpaceHierarchyWithCache = cache => function (spaceEntityMap, spaceDescendantMap, spaceId) {
  let useCache = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;
  if (useCache && cache.has(spaceId)) {
    return cache.get(spaceId);
  }
  const result = flattenSpaceHierarchy(spaceEntityMap, spaceDescendantMap, spaceId);
  cache.set(spaceId, result);
  return result;
};
exports.flattenSpaceHierarchyWithCache = flattenSpaceHierarchyWithCache;
//# sourceMappingURL=flattenSpaceHierarchy.js.map