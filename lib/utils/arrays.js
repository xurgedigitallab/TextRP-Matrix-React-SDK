"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.GroupedArray = exports.ArrayUtil = void 0;
exports.arrayDiff = arrayDiff;
exports.arrayFastClone = arrayFastClone;
exports.arrayFastResample = arrayFastResample;
exports.arrayHasDiff = arrayHasDiff;
exports.arrayHasOrderChange = arrayHasOrderChange;
exports.arrayIntersection = arrayIntersection;
exports.arrayRescale = arrayRescale;
exports.arraySeed = arraySeed;
exports.arraySmoothingResample = arraySmoothingResample;
exports.arrayTrimFill = arrayTrimFill;
exports.arrayUnion = arrayUnion;
exports.asyncEvery = asyncEvery;
exports.asyncSome = asyncSome;
exports.concat = void 0;
exports.filterBoolean = filterBoolean;
exports.moveElement = moveElement;
var _numbers = require("./numbers");
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
 * Quickly resample an array to have less/more data points. If an input which is larger
 * than the desired size is provided, it will be downsampled. Similarly, if the input
 * is smaller than the desired size then it will be upsampled.
 * @param {number[]} input The input array to resample.
 * @param {number} points The number of samples to end up with.
 * @returns {number[]} The resampled array.
 */
function arrayFastResample(input, points) {
  if (input.length === points) return input; // short-circuit a complicated call

  // Heavily inspired by matrix-media-repo (used with permission)
  // https://github.com/turt2live/matrix-media-repo/blob/abe72c87d2e29/util/util_audio/fastsample.go#L10
  const samples = [];
  if (input.length > points) {
    // Danger: this loop can cause out of memory conditions if the input is too small.
    const everyNth = Math.round(input.length / points);
    for (let i = 0; i < input.length; i += everyNth) {
      samples.push(input[i]);
    }
  } else {
    // Smaller inputs mean we have to spread the values over the desired length. We
    // end up overshooting the target length in doing this, but we're not looking to
    // be super accurate so we'll let the sanity trims do their job.
    const spreadFactor = Math.ceil(points / input.length);
    for (const val of input) {
      samples.push(...arraySeed(val, spreadFactor));
    }
  }

  // Trim to size & return
  return arrayTrimFill(samples, points, arraySeed(input[input.length - 1], points));
}

/**
 * Attempts a smooth resample of the given array. This is functionally similar to arrayFastResample
 * though can take longer due to the smoothing of data.
 * @param {number[]} input The input array to resample.
 * @param {number} points The number of samples to end up with.
 * @returns {number[]} The resampled array.
 */
// ts-prune-ignore-next
function arraySmoothingResample(input, points) {
  if (input.length === points) return input; // short-circuit a complicated call

  let samples = [];
  if (input.length > points) {
    // We're downsampling. To preserve the curve we'll actually reduce our sample
    // selection and average some points between them.

    // All we're doing here is repeatedly averaging the waveform down to near our
    // target value. We don't average down to exactly our target as the loop might
    // never end, and we can over-average the data. Instead, we'll get as far as
    // we can and do a followup fast resample (the neighbouring points will be close
    // to the actual waveform, so we can get away with this safely).
    while (samples.length > points * 2 || samples.length === 0) {
      samples = [];
      for (let i = 1; i < input.length - 1; i += 2) {
        const prevPoint = input[i - 1];
        const nextPoint = input[i + 1];
        const currPoint = input[i];
        const average = (prevPoint + nextPoint + currPoint) / 3;
        samples.push(average);
      }
      input = samples;
    }
    return arrayFastResample(samples, points);
  } else {
    // In practice there's not much purpose in burning CPU for short arrays only to
    // end up with a result that can't possibly look much different than the fast
    // resample, so just skip ahead to the fast resample.
    return arrayFastResample(input, points);
  }
}

/**
 * Rescales the input array to have values that are inclusively within the provided
 * minimum and maximum.
 * @param {number[]} input The array to rescale.
 * @param {number} newMin The minimum value to scale to.
 * @param {number} newMax The maximum value to scale to.
 * @returns {number[]} The rescaled array.
 */
// ts-prune-ignore-next
function arrayRescale(input, newMin, newMax) {
  const min = Math.min(...input);
  const max = Math.max(...input);
  return input.map(v => (0, _numbers.percentageWithin)((0, _numbers.percentageOf)(v, min, max), newMin, newMax));
}

/**
 * Creates an array of the given length, seeded with the given value.
 * @param {T} val The value to seed the array with.
 * @param {number} length The length of the array to create.
 * @returns {T[]} The array.
 */
function arraySeed(val, length) {
  // Size the array up front for performance, and use `fill` to let the browser
  // optimize the operation better than we can with a `for` loop, if it wants.
  return new Array(length).fill(val);
}

/**
 * Trims or fills the array to ensure it meets the desired length. The seed array
 * given is pulled from to fill any missing slots - it is recommended that this be
 * at least `len` long. The resulting array will be exactly `len` long, either
 * trimmed from the source or filled with the some/all of the seed array.
 * @param {T[]} a The array to trim/fill.
 * @param {number} len The length to trim or fill to, as needed.
 * @param {T[]} seed Values to pull from if the array needs filling.
 * @returns {T[]} The resulting array of `len` length.
 */
function arrayTrimFill(a, len, seed) {
  // Dev note: we do length checks because the spread operator can result in some
  // performance penalties in more critical code paths. As a utility, it should be
  // as fast as possible to not cause a problem for the call stack, no matter how
  // critical that stack is.
  if (a.length === len) return a;
  if (a.length > len) return a.slice(0, len);
  return a.concat(seed.slice(0, len - a.length));
}

/**
 * Clones an array as fast as possible, retaining references of the array's values.
 * @param a The array to clone. Must be defined.
 * @returns A copy of the array.
 */
function arrayFastClone(a) {
  return a.slice(0, a.length);
}

/**
 * Determines if the two arrays are different either in length, contents,
 * or order of those contents.
 * @param a The first array. Must be defined.
 * @param b The second array. Must be defined.
 * @returns True if they are different, false otherwise.
 */
function arrayHasOrderChange(a, b) {
  if (a.length === b.length) {
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return true;
    }
    return false;
  } else {
    return true; // like arrayHasDiff, a difference in length is a natural change
  }
}

/**
 * Determines if two arrays are different through a shallow comparison.
 * @param a The first array. Must be defined.
 * @param b The second array. Must be defined.
 * @returns True if they are different, false otherwise.
 */
function arrayHasDiff(a, b) {
  if (a.length === b.length) {
    // When the lengths are equal, check to see if either array is missing
    // an element from the other.
    if (b.some(i => !a.includes(i))) return true;
    if (a.some(i => !b.includes(i))) return true;

    // if all the keys are common, say so
    return false;
  } else {
    return true; // different lengths means they are naturally diverged
  }
}

/**
 * Performs a diff on two arrays. The result is what is different with the
 * first array (`added` in the returned object means objects in B that aren't
 * in A). Shallow comparisons are used to perform the diff.
 * @param a The first array. Must be defined.
 * @param b The second array. Must be defined.
 * @returns The diff between the arrays.
 */
function arrayDiff(a, b) {
  return {
    added: b.filter(i => !a.includes(i)),
    removed: a.filter(i => !b.includes(i))
  };
}

/**
 * Returns the intersection of two arrays.
 * @param a The first array. Must be defined.
 * @param b The second array. Must be defined.
 * @returns The intersection of the arrays.
 */
function arrayIntersection(a, b) {
  return a.filter(i => b.includes(i));
}

/**
 * Unions arrays, deduping contents using a Set.
 * @param a The arrays to merge.
 * @returns The union of all given arrays.
 */
function arrayUnion() {
  for (var _len = arguments.length, a = new Array(_len), _key = 0; _key < _len; _key++) {
    a[_key] = arguments[_key];
  }
  return Array.from(a.reduce((c, v) => {
    v.forEach(i => c.add(i));
    return c;
  }, new Set()));
}

/**
 * Moves a single element from fromIndex to toIndex.
 * @param {array} list the list from which to construct the new list.
 * @param {number} fromIndex the index of the element to move.
 * @param {number} toIndex the index of where to put the element.
 * @returns {array} A new array with the requested value moved.
 */
function moveElement(list, fromIndex, toIndex) {
  const result = Array.from(list);
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

/**
 * Helper functions to perform LINQ-like queries on arrays.
 */
class ArrayUtil {
  /**
   * Create a new array helper.
   * @param a The array to help. Can be modified in-place.
   */
  constructor(a) {
    this.a = a;
  }

  /**
   * The value of this array, after all appropriate alterations.
   */
  get value() {
    return this.a;
  }

  /**
   * Groups an array by keys.
   * @param fn The key-finding function.
   * @returns This.
   */
  groupBy(fn) {
    const obj = this.a.reduce((rv, val) => {
      const k = fn(val);
      if (!rv.has(k)) rv.set(k, []);
      rv.get(k).push(val);
      return rv;
    }, new Map());
    return new GroupedArray(obj);
  }
}

/**
 * Helper functions to perform LINQ-like queries on groups (maps).
 */
exports.ArrayUtil = ArrayUtil;
class GroupedArray {
  /**
   * Creates a new group helper.
   * @param val The group to help. Can be modified in-place.
   */
  constructor(val) {
    this.val = val;
  }

  /**
   * The value of this group, after all applicable alterations.
   */
  get value() {
    return this.val;
  }

  /**
   * Orders the grouping into an array using the provided key order.
   * @param keyOrder The key order.
   * @returns An array helper of the result.
   */
  orderBy(keyOrder) {
    const a = [];
    for (const k of keyOrder) {
      if (!this.val.has(k)) continue;
      a.push(...this.val.get(k));
    }
    return new ArrayUtil(a);
  }
}
exports.GroupedArray = GroupedArray;
const concat = function () {
  for (var _len2 = arguments.length, arrays = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
    arrays[_key2] = arguments[_key2];
  }
  return arrays.reduce((concatenatedSoFar, toBeConcatenated) => {
    const concatenated = new Uint8Array(concatenatedSoFar.length + toBeConcatenated.length);
    concatenated.set(concatenatedSoFar, 0);
    concatenated.set(toBeConcatenated, concatenatedSoFar.length);
    return concatenated;
  }, new Uint8Array(0));
};

/**
 * Async version of Array.every.
 */
exports.concat = concat;
async function asyncEvery(values, predicate) {
  for (const value of values) {
    if (!(await predicate(value))) return false;
  }
  return true;
}

/**
 * Async version of Array.some.
 */
async function asyncSome(values, predicate) {
  for (const value of values) {
    if (await predicate(value)) return true;
  }
  return false;
}
function filterBoolean(values) {
  return values.filter(Boolean);
}
//# sourceMappingURL=arrays.js.map