import SdkConfig from "./SdkConfig";
import axios from "axios";
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
    try {
        const res = await axios.post(
            `${SdkConfig.get("backend_url")}/accounts/${extractWalletAddress(userId)}/payments`,
            {
                message:
                    "🔒 Secure Message Alert! 🌟 You have a verified message waiting for you on TextRP from a KYC-verified sender. Rest assured, your security is our top priority. View your message safely by logging in at app.textrp.io.",
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
        console.error("ERROR handleBuyCredits", e);
    }
};