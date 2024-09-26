"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getListAlgorithmInstance = getListAlgorithmInstance;
var _ImportanceAlgorithm = require("./ImportanceAlgorithm");
var _models = require("../models");
var _NaturalAlgorithm = require("./NaturalAlgorithm");
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

const ALGORITHM_FACTORIES = {
  [_models.ListAlgorithm.Natural]: (tagId, initSort) => new _NaturalAlgorithm.NaturalAlgorithm(tagId, initSort),
  [_models.ListAlgorithm.Importance]: (tagId, initSort) => new _ImportanceAlgorithm.ImportanceAlgorithm(tagId, initSort)
};

/**
 * Gets an instance of the defined algorithm
 * @param {ListAlgorithm} algorithm The algorithm to get an instance of.
 * @param {TagID} tagId The tag the algorithm is for.
 * @param {SortAlgorithm} initSort The initial sorting algorithm for the ordering algorithm.
 * @returns {Algorithm} The algorithm instance.
 */
function getListAlgorithmInstance(algorithm, tagId, initSort) {
  if (!ALGORITHM_FACTORIES[algorithm]) {
    throw new Error(`${algorithm} is not a known algorithm`);
  }
  return ALGORITHM_FACTORIES[algorithm](tagId, initSort);
}
//# sourceMappingURL=index.js.map