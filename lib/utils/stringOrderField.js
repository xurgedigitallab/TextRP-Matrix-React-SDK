"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.midPointsBetweenStrings = midPointsBetweenStrings;
exports.reorderLexicographically = void 0;
var _utils = require("matrix-js-sdk/src/utils");
var _arrays = require("./arrays");
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

function midPointsBetweenStrings(a, b, count, maxLen) {
  let alphabet = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : _utils.DEFAULT_ALPHABET;
  const padN = Math.min(Math.max(a.length, b.length), maxLen);
  const padA = (0, _utils.alphabetPad)(a, padN, alphabet);
  const padB = (0, _utils.alphabetPad)(b, padN, alphabet);
  const baseA = (0, _utils.stringToBase)(padA, alphabet);
  const baseB = (0, _utils.stringToBase)(padB, alphabet);
  if (baseB - baseA - BigInt(1) < count) {
    if (padN < maxLen) {
      // this recurses once at most due to the new limit of n+1
      return midPointsBetweenStrings((0, _utils.alphabetPad)(padA, padN + 1, alphabet), (0, _utils.alphabetPad)(padB, padN + 1, alphabet), count, padN + 1, alphabet);
    }
    return [];
  }
  const step = (baseB - baseA) / BigInt(count + 1);
  const start = BigInt(baseA + step);
  return Array(count).fill(undefined).map((_, i) => (0, _utils.baseToString)(start + BigInt(i) * step, alphabet));
}
const reorderLexicographically = function (orders, fromIndex, toIndex) {
  let maxLen = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 50;
  // sanity check inputs
  if (fromIndex < 0 || toIndex < 0 || fromIndex > orders.length || toIndex > orders.length || fromIndex === toIndex) {
    return [];
  }

  // zip orders with their indices to simplify later index wrangling
  const ordersWithIndices = orders.map((order, index) => ({
    index,
    order
  }));
  // apply the fundamental order update to the zipped array
  const newOrder = (0, _arrays.moveElement)(ordersWithIndices, fromIndex, toIndex);

  // check if we have to fill undefined orders to complete placement
  const orderToLeftUndefined = newOrder[toIndex - 1]?.order === undefined;
  let leftBoundIdx = toIndex;
  let rightBoundIdx = toIndex;
  let canMoveLeft = true;
  const nextBase = newOrder[toIndex + 1]?.order !== undefined ? (0, _utils.stringToBase)(newOrder[toIndex + 1].order) : BigInt(Number.MAX_VALUE);

  // check how far left we would have to mutate to fit in that direction
  for (let i = toIndex - 1, j = 1; i >= 0; i--, j++) {
    if (newOrder[i]?.order !== undefined && nextBase - (0, _utils.stringToBase)(newOrder[i].order) > j) break;
    leftBoundIdx = i;
  }

  // verify the left move would be sufficient
  const firstOrderBase = newOrder[0].order === undefined ? undefined : (0, _utils.stringToBase)(newOrder[0].order);
  const bigToIndex = BigInt(toIndex);
  if (leftBoundIdx === 0 && firstOrderBase !== undefined && nextBase - firstOrderBase <= bigToIndex && firstOrderBase <= bigToIndex) {
    canMoveLeft = false;
  }
  const canDisplaceRight = !orderToLeftUndefined;
  let canMoveRight = canDisplaceRight;
  if (canDisplaceRight) {
    const prevBase = newOrder[toIndex - 1]?.order !== undefined ? (0, _utils.stringToBase)(newOrder[toIndex - 1].order) : BigInt(Number.MIN_VALUE);

    // check how far right we would have to mutate to fit in that direction
    for (let i = toIndex + 1, j = 1; i < newOrder.length; i++, j++) {
      if (newOrder[i]?.order === undefined || (0, _utils.stringToBase)(newOrder[i].order) - prevBase > j) break;
      rightBoundIdx = i;
    }

    // verify the right move would be sufficient
    if (rightBoundIdx === newOrder.length - 1 && (newOrder[rightBoundIdx]?.order ? (0, _utils.stringToBase)(newOrder[rightBoundIdx].order) : BigInt(Number.MAX_VALUE)) - prevBase <= rightBoundIdx - toIndex) {
      canMoveRight = false;
    }
  }

  // pick the cheaper direction
  const leftDiff = canMoveLeft ? toIndex - leftBoundIdx : Number.MAX_SAFE_INTEGER;
  const rightDiff = canMoveRight ? rightBoundIdx - toIndex : Number.MAX_SAFE_INTEGER;
  if (orderToLeftUndefined || leftDiff < rightDiff) {
    rightBoundIdx = toIndex;
  } else {
    leftBoundIdx = toIndex;
  }
  const prevOrder = newOrder[leftBoundIdx - 1]?.order ?? "";
  const nextOrder = newOrder[rightBoundIdx + 1]?.order ?? _utils.DEFAULT_ALPHABET.charAt(_utils.DEFAULT_ALPHABET.length - 1).repeat(prevOrder.length || 1);
  const changes = midPointsBetweenStrings(prevOrder, nextOrder, 1 + rightBoundIdx - leftBoundIdx, maxLen);
  return changes.map((order, i) => ({
    index: newOrder[leftBoundIdx + i].index,
    order
  }));
};
exports.reorderLexicographically = reorderLexicographically;
//# sourceMappingURL=stringOrderField.js.map