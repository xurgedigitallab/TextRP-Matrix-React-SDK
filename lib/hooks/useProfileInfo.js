"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useProfileInfo = void 0;
var _react = require("react");
var _axios = _interopRequireDefault(require("axios"));
var _MatrixClientPeg = require("../MatrixClientPeg");
var _useLatestResult = require("./useLatestResult");
var _rippleAddressCodec = require("ripple-address-codec");
var _SdkConfig = _interopRequireDefault(require("../SdkConfig"));
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

const useProfileInfo = () => {
  const [profile, setProfile] = (0, _react.useState)(null);
  const [isActive, setIsActive] = (0, _react.useState)(false);
  const [loading, setLoading] = (0, _react.useState)(false);
  const [updateQuery, updateResult] = (0, _useLatestResult.useLatestResult)(setProfile);
  const extractWalletAddress = inputString => {
    // Define a regular expression pattern to match XRPL addresses
    const addressRegex = /@([a-zA-Z0-9]{25,34})/;

    // Use the RegExp.exec method to find the address in the input string
    const match = addressRegex.exec(inputString);

    // Check if a match was found and extract the address
    if (match && match[1]) {
      return match[1];
    }
    // Return null if no address was found
    return null;
  };
  const search = (0, _react.useCallback)(async _ref => {
    let {
      query: term
    } = _ref;
    updateQuery(term);
    if (!term?.length || !term.startsWith("@") || !term.includes(":")) {
      setProfile(null);
      setIsActive(false);
      return true;
    }
    setLoading(true);
    try {
      const result = await _MatrixClientPeg.MatrixClientPeg.get().getProfileInfo(term);
      updateResult(term, {
        user_id: result.user_id ? result.user_id : term,
        avatar_url: result.avatar_url,
        display_name: result.displayname
      });
      return true;
    } catch (e) {
      if ((0, _rippleAddressCodec.isValidClassicAddress)(extractWalletAddress(term))) {
        const response = await _axios.default.get(`${_SdkConfig.default.get("backend_url")}/verify-address/${extractWalletAddress(term)}`).then(response => response.data);
        if (response.active) setIsActive(true);else setIsActive(false);
        // if(response.active){
        //   const link= await axios.post(`${SdkConfig.get("backend_url")}/accounts/${extractWalletAddress(term)}/payments`,{
        //         message:"my first transaction",
        //         amount:"2000",
        //     },{
        //         headers: {
        //           'Content-Type': 'application/json', // Set the content type to JSON
        //         },
        //       }).then((response)=>response.data);
        //     console.log('!!!!!!!!!ACTIVE',link);
        // }
      } else {
        setIsActive(false);
      }
      console.error("Could not fetch profile info for params", {
        term
      }, e);
      updateResult(term, null);
      return false;
    } finally {
      setLoading(false);
    }
  }, [updateQuery, updateResult]);
  return {
    ready: true,
    loading,
    profile,
    isActive,
    search
  };
};
exports.useProfileInfo = useProfileInfo;
//# sourceMappingURL=useProfileInfo.js.map