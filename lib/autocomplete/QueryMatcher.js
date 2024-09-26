"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _lodash = require("lodash");
var _utils = require("matrix-js-sdk/src/utils");
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         Copyright 2017 Aviral Dasgupta
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         Copyright 2018 Michael Telatynski <7t3chguy@gmail.com>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         Copyright 2018 New Vector Ltd
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         
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
 * Simple search matcher that matches any results with the query string anywhere
 * in the search string. Returns matches in the order the query string appears
 * in the search key, earliest first, then in the order the search key appears
 * in the provided array of keys, then in the order the items appeared in the
 * source array.
 *
 * @param {Object[]} objects Initial list of objects. Equivalent to calling
 *     setObjects() after construction
 * @param {Object} options Options object
 * @param {string[]} options.keys List of keys to use as indexes on the objects
 * @param {function[]} options.funcs List of functions that when called with the
 *     object as an arg will return a string to use as an index
 */
class QueryMatcher {
  constructor(objects) {
    let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {
      keys: []
    };
    (0, _defineProperty2.default)(this, "_options", void 0);
    (0, _defineProperty2.default)(this, "_items", new Map());
    this._options = options;
    this.setObjects(objects);

    // By default, we remove any non-alphanumeric characters ([^A-Za-z0-9_]) from the
    // query and the value being queried before matching
    if (this._options.shouldMatchWordsOnly === undefined) {
      this._options.shouldMatchWordsOnly = true;
    }
  }
  setObjects(objects) {
    this._items = new Map();
    for (const object of objects) {
      // Need to use unsafe coerce here because the objects can have any
      // type for their values. We assume that those values who's keys have
      // been specified will be string. Also, we cannot infer all the
      // types of the keys of the objects at compile.
      const keyValues = (0, _lodash.at)(object, this._options.keys);
      if (this._options.funcs) {
        for (const f of this._options.funcs) {
          const v = f(object);
          if (Array.isArray(v)) {
            keyValues.push(...v);
          } else {
            keyValues.push(v);
          }
        }
      }
      for (const [index, keyValue] of Object.entries(keyValues)) {
        if (!keyValue) continue; // skip falsy keyValues
        const key = this.processQuery(keyValue);
        if (!this._items.has(key)) {
          this._items.set(key, []);
        }
        this._items.get(key).push({
          keyWeight: Number(index),
          object
        });
      }
    }
  }
  match(query) {
    let limit = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : -1;
    query = this.processQuery(query);
    if (this._options.shouldMatchWordsOnly) {
      query = query.replace(/[^\w]/g, "");
    }
    if (query.length === 0) {
      return [];
    }
    const matches = [];
    // Iterate through the map & check each key.
    // ES6 Map iteration order is defined to be insertion order, so results
    // here will come out in the order they were put in.
    for (const [key, candidates] of this._items.entries()) {
      let resultKey = key;
      if (this._options.shouldMatchWordsOnly) {
        resultKey = resultKey.replace(/[^\w]/g, "");
      }
      const index = resultKey.indexOf(query);
      if (index !== -1) {
        matches.push(...candidates.map(candidate => _objectSpread({
          index
        }, candidate)));
      }
    }

    // Sort matches by where the query appeared in the search key, then by
    // where the matched key appeared in the provided array of keys.
    matches.sort((a, b) => {
      if (a.index < b.index) {
        return -1;
      } else if (a.index === b.index) {
        if (a.keyWeight < b.keyWeight) {
          return -1;
        } else if (a.keyWeight === b.keyWeight) {
          return 0;
        }
      }
      return 1;
    });

    // Now map the keys to the result objects. Also remove any duplicates.
    const dedupped = (0, _lodash.uniq)(matches.map(match => match.object));
    const maxLength = limit === -1 ? dedupped.length : limit;
    return dedupped.slice(0, maxLength);
  }
  processQuery(query) {
    if (this._options.fuzzy !== false) {
      // lower case both the input and the output for consistency
      return (0, _utils.removeHiddenChars)(query.toLowerCase()).toLowerCase();
    }
    return query.toLowerCase();
  }
}
exports.default = QueryMatcher;
//# sourceMappingURL=QueryMatcher.js.map