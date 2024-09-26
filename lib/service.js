"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isComponentEnabled = exports.getAllFeatures = exports.default = void 0;
var _SdkConfig = _interopRequireDefault(require("./SdkConfig"));
var _UserIdentifier = _interopRequireDefault(require("./customisations/UserIdentifier"));
var _MatrixClientPeg = require("./MatrixClientPeg");
var _axios = _interopRequireDefault(require("axios"));
const getAllEnabledNfts = async () => {
  try {
    const details = _UserIdentifier.default.getDisplayUserIdentifier(_MatrixClientPeg.MatrixClientPeg.get().getSafeUserId(), {
      withDisplayName: true
    });
    const {
      data: userData
    } = await _axios.default.post(`${_SdkConfig.default.get("backend_url")}/my-address`, {
      address: details
    });
    const {
      data: enableFeatures
    } = await _axios.default.get(`${_SdkConfig.default.get("backend_url")}/my-features/${userData.address}/main/enabled`);
    return enableFeatures;
  } catch (e) {
    console.error(e);
  }
  return {};
};
const getAllFeatures = async () => {
  try {
    const features = await _axios.default.get(`${_SdkConfig.default.get('backend_url')}/always-enabled-feature`);
    return features;
  } catch (e) {
    console.error(e);
  }
  return {};
};
exports.getAllFeatures = getAllFeatures;
const isComponentEnabled = async title => {
  try {
    const userNfts = await getAllEnabledNfts();
    const {
      data
    } = await getAllFeatures();
    let userHaveNft = false;
    let adminEnable = false;
    if (userNfts["nfts"]) {
      userNfts["nfts"].forEach(nft => {
        if (nft.feature.includes(title)) {
          userHaveNft = true;
        }
      });
    }
    if (data.length > 0) {
      data.forEach(feature => {
        if (feature.feature === title) {
          adminEnable = true;
        }
      });
    }
    return userHaveNft || adminEnable;
  } catch (e) {
    console.error(e);
  }
  return false;
};
exports.isComponentEnabled = isComponentEnabled;
var _default = getAllEnabledNfts;
exports.default = _default;
//# sourceMappingURL=service.js.map