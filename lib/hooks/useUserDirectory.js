"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useUserDirectory = void 0;
var _react = require("react");
var _MatrixClientPeg = require("../MatrixClientPeg");
var _directMessages = require("../utils/direct-messages");
var _useLatestResult = require("./useLatestResult");
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

const useUserDirectory = () => {
  const [users, setUsers] = (0, _react.useState)([]);
  const [loading, setLoading] = (0, _react.useState)(false);
  const [updateQuery, updateResult] = (0, _useLatestResult.useLatestResult)(setUsers);
  const search = (0, _react.useCallback)(async _ref => {
    let {
      limit = 20,
      query: term
    } = _ref;
    const opts = {
      limit,
      term
    };
    updateQuery(opts);
    if (!term?.length) {
      setUsers([]);
      return true;
    }
    try {
      setLoading(true);
      const {
        results
      } = await _MatrixClientPeg.MatrixClientPeg.get().searchUserDirectory(opts);
      updateResult(opts, results.map(user => new _directMessages.DirectoryMember(user)));
      return true;
    } catch (e) {
      console.error("Could not fetch user in user directory for params", {
        limit,
        term
      }, e);
      updateResult(opts, []);
      return false;
    } finally {
      setLoading(false);
    }
  }, [updateQuery, updateResult]);
  return {
    ready: true,
    loading,
    users,
    search
  };
};
exports.useUserDirectory = useUserDirectory;
//# sourceMappingURL=useUserDirectory.js.map