"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.generatePaymentLink = exports.extractWalletAddress = void 0;
var _SdkConfig = _interopRequireDefault(require("./SdkConfig"));
var _axios = _interopRequireDefault(require("axios"));
var _Modal = _interopRequireDefault(require("./Modal"));
var _ErrorDialog = _interopRequireDefault(require("./components/views/dialogs/ErrorDialog"));
var _MatrixClientPeg = require("./MatrixClientPeg");
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
exports.extractWalletAddress = extractWalletAddress;
const generatePaymentLink = async userId => {
  //         const notificationMessage = isKYCVerified(senderId) ?
  //   '🔒 Secure Message Alert! 🌟 You have a verified message waiting for you on TextRP from a KYC-verified sender. Rest assured, your security is our top priority. View your message safely by logging in at app.textrp.io.' :
  //   '🔒 Secure Message Alert! 🚀 You have a new message on TextRP. While the sender hasn't been KYC-verified, we ensure your login and viewing experience remains safe. Access your message at app.textrp.io.';
  const senderId = _MatrixClientPeg.MatrixClientPeg.get().getUserId();
  const xummStatus = await _axios.default.get(`https://xumm.app/api/v1/platform/kyc-status/${extractWalletAddress(senderId)}`);
  const res = await _axios.default.get(`${_SdkConfig.default.get().backend_url}/get-all-env`);
  let env = res.data[0].value === "xrplMain" ? "mainnet" : res.data[0].value === "xrplDev" ? "devnet" : "testnet";
  let addressActiveOn = await _axios.default.get(`${_SdkConfig.default.get().backend_url}/verify-address-allEnv/${extractWalletAddress(userId)}`);
  try {
    const res = await _axios.default.post(`${_SdkConfig.default.get("backend_url")}/accounts/${extractWalletAddress(userId)}/payments`, {
      message: xummStatus.data.kycApproved ? "🔒 Message Notification 🌟 You have a new encrypted message from a KYC-verified wallet user. Log in securely at textrp.io to view it. To report spam visit help.textrp.io" : `🔒 Message Notification 🌟
                    You have a new encrypted message waiting. Sending account not KYC-verified. Log in securely at textrp.io to view it. To report spam visit help.textrp.io`,
      amount: "0.000001"
    }, {
      headers: {
        "Content-Type": "application/json" // Set the content type to JSON
      }
    });

    console.log("GGGGGGG", res);

    // window.open(res?.data?.data?.next?.always, '_blank')
  } catch (e) {
    _Modal.default.createDialog(_ErrorDialog.default, {
      title: "Failed MicroTransaction",
      description: `${extractWalletAddress(userId)} is active on ${addressActiveOn?.data?.test?.active ? "testnet" : ""} ${addressActiveOn?.data?.main?.active ? "mainnet" : ""} ${addressActiveOn?.data?.dev?.active ? "devnet" : ""} and the current xrpl environment is ${env}`
    });
  }
};
exports.generatePaymentLink = generatePaymentLink;
//# sourceMappingURL=paymentServices.js.map