import SdkConfig from "./SdkConfig";
import axios from "axios";
import Modal from "./Modal";
import ErrorDialog from "./components/views/dialogs/ErrorDialog";
import { MatrixClientPeg } from "./MatrixClientPeg";
export const extractWalletAddress = (inputString: string) => {
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
export const generatePaymentLink = async (userId: string) => {
    //         const notificationMessage = isKYCVerified(senderId) ?
    //   '🔒 Secure Message Alert! 🌟 You have a verified message waiting for you on TextRP from a KYC-verified sender. Rest assured, your security is our top priority. View your message safely by logging in at app.textrp.io.' :
    //   '🔒 Secure Message Alert! 🚀 You have a new message on TextRP. While the sender hasn't been KYC-verified, we ensure your login and viewing experience remains safe. Access your message at app.textrp.io.';
    const senderId = MatrixClientPeg.get().getUserId();
    const xummStatus = await axios.get(`https://xumm.app/api/v1/platform/kyc-status/${extractWalletAddress(senderId)}`);
    const res = await axios.get(`${SdkConfig.get().backend_url}/get-all-env`);

    let env = res.data[0].value === "xrplMain" ? "mainnet" : res.data[0].value === "xrplDev" ? "devnet" : "testnet";

    let addressActiveOn = await axios.get(
        `${SdkConfig.get().backend_url}/verify-address-allEnv/${extractWalletAddress(userId)}`,
    );
    try {
        const res = await axios.post(
            `${SdkConfig.get("backend_url")}/accounts/${extractWalletAddress(userId)}/payments`,
            {
                message: xummStatus.data.kycApproved
                    ? "🔒 Secure Message Alert! 🌟 You have a verified message waiting for you on TextRP from a KYC-verified sender. Rest assured, your security is our top priority. View your message safely by logging in at app.textrp.io."
                    : `🔒 Secure Message Alert! 🚀 You have a new message on TextRP. While the sender hasn't been KYC-verified, we ensure your login and viewing experience remains safe. Access your message at app.textrp.io.`,
                amount: "0.01",
            },
            {
                headers: {
                    "Content-Type": "application/json", // Set the content type to JSON
                },
            },
        );
        console.log("GGGGGGG", res);

        // window.open(res?.data?.data?.next?.always, '_blank')
    } catch (e) {
        Modal.createDialog(ErrorDialog, {
            title: "Failed MicroTransaction",
            description: `${extractWalletAddress(userId)} is active on ${
                addressActiveOn?.data?.test?.active ? "testnet" : ""
            } ${addressActiveOn?.data?.main?.active ? "mainnet" : ""} ${
                addressActiveOn?.data?.dev?.active ? "devnet" : ""
            } and the current xrpl environment is ${env}`,
        });
    }
};
