/*
Copyright 2016 - 2022 The Matrix.org Foundation C.I.C.

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

import React, { useState } from "react";
import axios from "axios";

import Spinner from "../elements/Spinner";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { _t } from "../../../languageHandler";
import UserIdentifierCustomisations from "../../../customisations/UserIdentifier";
import AccessibleButton from "../elements/AccessibleButton";
import { getTokenPrice, getXRPLPrice } from "../../../modules/XRPLtoUSD";
import SdkConfig from "../../../SdkConfig";
import QRCode from "../elements/QRCode";
import BaseDialog from "../dialogs/BaseDialog";

// TODO: this "view" component still has far too much application logic in it,
// which should be factored out to other files.

enum Phase {
    Loading = "loading",
    Ready = "ready",
    Persisting = "persisting",
    // technically a meta-state for Ready, but whatever
    // unrecoverable error - eg can't load push rules
    Error = "error",
    // error saving individual rule
    SavingError = "savingError",
}

interface IProps {}

interface IState {
    phase: Phase;

    // Optional stuff is required when `phase === Ready`
    creditPackages?: {
        data: any[];
    };
    tokenData?: {
        data: any[];
    };
    selectedCredit?: number;
    selectedToken?: string;
    xrpPrice?: number;
    isLoading: boolean;
    usdPrice?: string;
    usdTokenPrice: string;
    issuer?: string;
    selectedBonus?: number;
    user?: {
        user: {
            address?: string;
            discount?: any;
            subscriptions?: any[];
            credit?: {
                balance: string;
            };
        };
        address: string;
    };
    showXamanQRModal?: boolean;
    xamanQRData?: any;
    xamanPayloadUuid?: string;
    showSuccessModal?: boolean;
    successData?: {
        creditsAdded: number;
        newBalance: number;
        transactionHash: string;
        walletType: string;
    };
    showPaymentLoading?: boolean;
    loadingMessage?: string;
    paymentModalState?: 'qr' | 'loading' | 'success' | 'error' | null;
    paymentModalData?: {
        xamanQRData?: any;
        xamanPayloadUuid?: string;
        creditsAdded?: number;
        newBalance?: number;
        transactionHash?: string;
        walletType?: string;
        errorMessage?: string;
    };
}

export default class BuyCredits extends React.PureComponent<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            phase: Phase.Loading,
            creditPackages: {
                data: [],
            },
            tokenData: { data: [] },
            isLoading: false,
            usdPrice: "",
            usdTokenPrice: "",
            issuer: "",
            selectedBonus: 0,
            showXamanQRModal: false,
            xamanQRData: null,
            xamanPayloadUuid: null,
            showSuccessModal: false,
            successData: null,
            showPaymentLoading: false,
            loadingMessage: "Processing payment...",
            paymentModalState: null,
            paymentModalData: {},
        };
    }

    private async fetchDetails(): Promise<void> {
        try {
            const details = UserIdentifierCustomisations.getDisplayUserIdentifier(
                MatrixClientPeg.get().getSafeUserId(),
                {
                    withDisplayName: true,
                },
            );
            console.log("details", details);

            const { data: address } = await axios.post(`${SdkConfig.get("backend_url")}/my-address`, {
                address: details,
            });
            const { data: creditPackages } = await axios.get(`${SdkConfig.get("backend_url")}/credits`);

            const { data: tokenData } = await axios.get(`${SdkConfig.get("backend_url")}/payment_tokens`);
            console.log("token data is", tokenData);
            // const { data: xrpPrice } = await axios.get(`https://api.binance.com/api/v3/avgPrice?symbol=XRPUSDT`);

            const price: any = await getXRPLPrice();
            console.log("asdasdasd toke price", this.state.selectedToken);
            // const token_xrp_price: any = await getTokenPrice(this.state.selectedToken);
            console.log("price of 1 USD in xrp", price);
            this.setState({ usdPrice: price });

            this.setState({ creditPackages, tokenData, xrpPrice: Number(price), user: address, phase: Phase.Ready });
        } catch (e) {
            this.setState({ phase: Phase.Error });
            console.error(e);
        }
    }

    private async fetchTokenPrice(token: any, issuer: any): Promise<number> {
        // Step a: Query the XRPL to get the XRP price of the issued token
        const tokenXrpPrice = await getTokenPrice(token, issuer);

        // Step b: Fetch the USD price of XRP from Binance's API
        // const price: any = await getXRPLPrice();

        // const xrpUsdPrice = Number(price);

        // Step c: Calculate the USD price of the issued token
        return tokenXrpPrice * Number(this.state.usdPrice);
    }

    private async handleTokenChange(event: React.ChangeEvent<HTMLSelectElement>): Promise<void> {
        const [selectedCurrency, selectedIssuer] = event.target.value.split(":");
        const selectedTokenData = this.state.tokenData?.data.find((p) => p.currency === selectedCurrency);
        console.log("selectedTokenData", selectedTokenData);
        console.log("tokens value for asdasdis ", selectedCurrency);
        console.log("🔍 Split result - currency:", selectedCurrency, "issuer:", selectedIssuer);
        
        this.setState({ selectedBonus: selectedTokenData?.bonus || 0 });
        this.setState({ selectedToken: selectedCurrency });

        if (selectedCurrency && selectedCurrency !== "XRP") {
            try {
                // Use the issuer from selectedTokenData if split result is empty
                const issuerToUse = selectedIssuer || selectedTokenData?.issuer || "";
                console.log("🔑 Using issuer:", issuerToUse);
                
                const tokenUsdPrice = await this.fetchTokenPrice(selectedCurrency, issuerToUse);
                console.log("💵 Token USD price:", tokenUsdPrice);
                // Batch state updates together
                this.setState({ 
                    usdTokenPrice: tokenUsdPrice.toString(),
                    issuer: issuerToUse
                });
                console.log("✅ State set - issuer:", issuerToUse, "usdTokenPrice:", tokenUsdPrice.toString());
            } catch (error) {
                console.error("Error fetching token price", error);
            }
        } else if (selectedCurrency === "XRP") {
            this.setState({ 
                usdTokenPrice: this.state.xrpPrice.toString(),
                selectedToken: "XRP",
                issuer: "" // XRP has no issuer
            });
        } else {
            this.setState({ 
                usdTokenPrice: "",
                selectedToken: "",
                issuer: ""
            });
        }
    }
    private async handleBuyCredits(): Promise<void> {
        try {
            this.setState({ isLoading: true });
            const details = UserIdentifierCustomisations.getDisplayUserIdentifier(
                MatrixClientPeg.get().getSafeUserId(),
                {
                    withDisplayName: true,
                },
            );
            // Prefer the resolved XRPL address returned by /my-address (stored in state.user.address)
            // Fallback to the Matrix user identifier if no resolved address is available.
            const addressToSend = this.state.user?.address || details;

            console.log("═══════════════════════════════════════════════");
            console.log("📍 ADDRESS CHECK");
            console.log("═══════════════════════════════════════════════");
            console.log("this.state.user:", this.state.user);
            console.log("this.state.user?.address:", this.state.user?.address);
            console.log("details (Matrix ID):", details);
            console.log("addressToSend (final):", addressToSend);
            console.log("═══════════════════════════════════════════════");

            if (!addressToSend) {
                alert("Error: Could not determine your wallet address. Please refresh the page and try again.");
                this.setState({ isLoading: false });
                return;
            }

            // Get WalletConnect session topic from sessionStorage if available
            const wcSessionTopic = sessionStorage.getItem('wc_session_topic');
            
            console.log("═══════════════════════════════════════════════");
            console.log("💳 PAYMENT REQUEST - SESSION ID CHECK");
            console.log("═══════════════════════════════════════════════");
            console.log("🔍 Retrieving sessionId from sessionStorage...");
            console.log(`🔑 Key: 'wc_session_topic'`);
            console.log(`💎 Retrieved value: ${wcSessionTopic || 'NULL/UNDEFINED'}`);
            console.log(`📏 Value length: ${wcSessionTopic?.length || 0} chars`);
            console.log(`✔️  Value type: ${typeof wcSessionTopic}`);
            
            if (wcSessionTopic) {
                console.log(`✅ SessionId FOUND - will be sent to backend for WalletConnect payment`);
            } else {
                console.log(`ℹ️  SessionId is NULL - this is normal for Xaman/Crossmark wallets (only required for WalletConnect)`);
            }
            console.log("═══════════════════════════════════════════════");

            // Calculate the exact token amount to send (same as displayed in UI)
            const creditPrice = this.state?.creditPackages?.data?.find((p) => p.id == this.state.selectedCredit)?.price || 0;
            const usdTokenPrice = parseFloat(this.state.usdTokenPrice || "1");
            const tokenAmount = Number(creditPrice / usdTokenPrice);
            
            console.log("💰 TOKEN AMOUNT CALCULATION:");
            console.log("  creditPrice (USD):", creditPrice);
            console.log("  usdTokenPrice:", this.state.usdTokenPrice);
            console.log("  usdTokenPrice (parsed):", usdTokenPrice);
            console.log("  tokenAmount:", tokenAmount);
            console.log("  issuer from state:", this.state.issuer);
            console.log("  selectedToken from state:", this.state.selectedToken);
            
            const payloadData = {
                address: addressToSend,
                token: this.state.selectedToken,
                issuer: this.state.issuer,
                tokenAmount: tokenAmount, // Send the exact amount calculated in frontend
                bonus:
                    parseFloat(
                        this.state?.creditPackages?.data?.find((p) => p.id == this.state.selectedCredit)
                            ?.available_credits || 0,
                    ) *
                    (this.state.selectedBonus / 100),
                sessionId: wcSessionTopic, // Include WalletConnect session ID if available
            };
            
            console.log("═══════════════════════════════════════════════");
            console.log("📤 SENDING PAYMENT REQUEST TO BACKEND");
            console.log("═══════════════════════════════════════════════");
            console.log(`🌐 URL: ${SdkConfig.get("backend_url")}/payment/credit/${this.state.selectedCredit}`);
            console.log(`📦 Payload:`, JSON.stringify(payloadData, null, 2));
            console.log(`🔑 sessionId in payload: ${payloadData.sessionId || 'NULL/UNDEFINED'}`);
            console.log(`💰 tokenAmount in payload: ${payloadData.tokenAmount} ${this.state.selectedToken}`);
            console.log("═══════════════════════════════════════════════");

            const res = await axios.post(
                `${SdkConfig.get("backend_url")}/payment/credit/${this.state.selectedCredit}`,
                payloadData,
            );

            console.log("═══════════════════════════════════════════════");
            console.log("📥 PAYMENT RESPONSE RECEIVED");
            console.log("═══════════════════════════════════════════════");
            console.log("Payment response:", res.data);
            console.log("Response status:", res.status);
            console.log("═══════════════════════════════════════════════");

            // Handle different wallet provider responses
            // Detect WalletConnect: either by wallet_provider field OR by response structure (success + transaction_hash)
            const isWalletConnect = res?.data?.wallet_provider === "walletconnect" ||
                                   (res?.data?.success && res?.data?.transaction_hash && !res?.data?.data?.created);

            if (isWalletConnect) {
                // WalletConnect flow: Backend handles signing via wallet
                console.log("🔗 WalletConnect payment detected");
                console.log("🔗 Response:", res.data);

                // Check if transaction is already completed (immediate success)
                if (res.data.success && res.data.transaction_hash) {
                    console.log("✅ WalletConnect transaction already completed!");

                    // Show loading modal briefly while updating balance
                    this.setState({
                        paymentModalState: 'loading',
                        paymentModalData: {},
                        loadingMessage: "Transaction confirmed! Updating your balance...",
                        showPaymentLoading: true,
                        isLoading: true,
                    });

                    // Calculate credits added
                    const selectedCredit = this.state?.creditPackages?.data?.find((p) => p.id == this.state.selectedCredit);
                    const baseCredits = parseFloat(selectedCredit?.available_credits || 0);
                    const bonusCredits = baseCredits * (this.state.selectedBonus / 100);
                    const creditsAdded = baseCredits + bonusCredits;
                    const oldBalance = parseFloat(this.state.user?.user?.credit?.balance || 0);

                    // Refresh balance
                    await this.fetchDetails();

                    // Show success modal
                    this.setState({
                        paymentModalState: 'success',
                        paymentModalData: {
                            creditsAdded: creditsAdded,
                            newBalance: oldBalance + creditsAdded,
                            transactionHash: res.data.transaction_hash,
                            walletType: "WalletConnect (Joey)",
                        },
                        showSuccessModal: true,
                        showPaymentLoading: false,
                        isLoading: false,
                        successData: {
                            creditsAdded: creditsAdded,
                            newBalance: oldBalance + creditsAdded,
                            transactionHash: res.data.transaction_hash,
                            walletType: "WalletConnect (Joey)",
                        },
                    });
                } else {
                    // Transaction needs polling (payment initiated but not completed yet)
                    const paymentId = res.data.payment_id;

                    if (!paymentId) {
                        console.error("🔗 ERROR: No payment_id or immediate success");
                        this.setState({
                            paymentModalState: 'error',
                            paymentModalData: {
                                errorMessage: "Failed to initiate WalletConnect payment.",
                            },
                            isLoading: false,
                        });
                        return;
                    }

                    // Show loading modal
                    this.setState({
                        paymentModalState: 'loading',
                        paymentModalData: {},
                        loadingMessage: "Please approve the transaction in your wallet...",
                        showPaymentLoading: true,
                        isLoading: true,
                    });

                    console.log("🔗 Starting payment status polling for payment ID:", paymentId);

                    // Poll for payment status with longer timeout and more retries
                    let pollCount = 0;
                    const maxPolls = 60; // 60 seconds (60 * 1 second)
                    const pollInterval = setInterval(async () => {
                        try {
                            pollCount++;
                            console.log(`🔗 Polling attempt ${pollCount}/${maxPolls}...`);

                            // Poll backend for payment status
                            const statusRes = await axios.get(
                                `${SdkConfig.get("backend_url")}/payment/status/${paymentId}`
                            );

                            console.log("🔗 Payment status response:", statusRes.data);

                            // Check if transaction succeeded
                            if (statusRes.data?.status === 'completed' || statusRes.data?.success === true) {
                                clearInterval(pollInterval);
                                console.log("✅ WalletConnect transaction completed!");

                                // Update loading message
                                this.setState({
                                    loadingMessage: "Transaction confirmed! Updating your balance...",
                                });

                                // Calculate credits added
                                const selectedCredit = this.state?.creditPackages?.data?.find((p) => p.id == this.state.selectedCredit);
                                const baseCredits = parseFloat(selectedCredit?.available_credits || 0);
                                const bonusCredits = baseCredits * (this.state.selectedBonus / 100);
                                const creditsAdded = baseCredits + bonusCredits;
                                const oldBalance = parseFloat(this.state.user?.user?.credit?.balance || 0);

                                // Refresh balance
                                await this.fetchDetails();

                                // Show success modal
                                this.setState({
                                    paymentModalState: 'success',
                                    paymentModalData: {
                                        creditsAdded: creditsAdded,
                                        newBalance: oldBalance + creditsAdded,
                                        transactionHash: statusRes.data.transactionHash || statusRes.data.tx_hash || "N/A",
                                        walletType: "WalletConnect (Joey)",
                                    },
                                    showSuccessModal: true,
                                    showPaymentLoading: false,
                                    isLoading: false,
                                    successData: {
                                        creditsAdded: creditsAdded,
                                        newBalance: oldBalance + creditsAdded,
                                        transactionHash: statusRes.data.transactionHash || statusRes.data.tx_hash || "N/A",
                                        walletType: "WalletConnect (Joey)",
                                    },
                                });
                            } else if (statusRes.data?.status === 'failed' || statusRes.data?.status === 'cancelled') {
                                clearInterval(pollInterval);
                                console.log("❌ WalletConnect transaction failed/cancelled");

                                this.setState({
                                    paymentModalState: 'error',
                                    paymentModalData: {
                                        errorMessage: statusRes.data.error || "Transaction was cancelled or failed.",
                                    },
                                    showPaymentLoading: false,
                                    isLoading: false,
                                });
                            } else if (statusRes.data?.status === 'pending' || statusRes.data?.status === 'processing') {
                                // Still processing, continue polling
                                console.log("🔗 Transaction still processing...");
                            }

                            // Stop polling after max attempts
                            if (pollCount >= maxPolls) {
                                clearInterval(pollInterval);
                                console.log("⏱️ WalletConnect polling timeout reached");

                                // Check balance one more time before giving up
                                await this.fetchDetails();

                                this.setState({
                                    paymentModalState: null,
                                    paymentModalData: {},
                                    showPaymentLoading: false,
                                    isLoading: false
                                });
                            }
                        } catch (error) {
                            console.error("❌ Error polling WalletConnect payment status:", error);

                            // Don't stop polling on error - backend might be slow
                            if (pollCount >= maxPolls) {
                                clearInterval(pollInterval);
                                this.setState({
                                    paymentModalState: null,
                                    paymentModalData: {},
                                    showPaymentLoading: false,
                                    isLoading: false
                                });
                            }
                        }
                    }, 1000); // Poll every 1 second for faster feedback
                }
            } else if (res?.data?.wallet_provider === "crossmark") {
                // ✅ NEW: Crossmark flow
                console.log("💎 Crossmark payment flow initiated");

                // Get the unsigned transaction from backend
                const unsignedTx = res.data.transaction;
                const paymentId = res.data.payment_id;

                // Show loading modal
                this.setState({
                    paymentModalState: 'loading',
                    paymentModalData: {},
                    loadingMessage: "Please approve the transaction in your Crossmark wallet...",
                    showPaymentLoading: true,
                    isLoading: true,
                });

                try {
                    // Use Crossmark SDK to sign AND submit
                    const sdk = (window as any).xrpl?.crossmark;

                    if (!sdk) {
                        throw new Error("Crossmark extension not found. Please install Crossmark.");
                    }

                    // Sign and submit with Crossmark (Crossmark handles the blockchain submission)
                    console.log("💎 Requesting Crossmark to sign and submit payment...");
                    console.log("💎 Unsigned transaction:", unsignedTx);
                    const submitResult = await sdk.methods.signAndSubmitAndWait(unsignedTx);

                    console.log("💎 Crossmark submit result:", submitResult);
                    console.log("💎 Full Crossmark response:", JSON.stringify(submitResult, null, 2));

                    // Check if user rejected
                    if (submitResult.response?.data?.resp === "rejected") {
                        throw new Error("Transaction rejected by user");
                    }

                    // Update loading message to verification
                    this.setState({
                        loadingMessage: "Verifying transaction on blockchain...",
                    });

                    // Extract transaction hash - try multiple possible paths
                    const txHash =
                        submitResult.response?.data?.resp?.result?.hash || // Crossmark actual path
                        submitResult.response?.data?.hash ||
                        submitResult.response?.data?.txHash ||
                        submitResult.response?.data?.tx_hash ||
                        submitResult.response?.data?.transactionHash ||
                        submitResult.hash ||
                        submitResult.txHash;

                    if (!txHash) {
                        console.error("💎 ERROR: Could not find transaction hash in response");
                        console.error("💎 response.data:", submitResult.response?.data);
                        throw new Error(
                            "Transaction may have been submitted but hash not found. Check your Crossmark transaction history."
                        );
                    }

                    console.log("💎 ✅ Transaction succeeded on XRPL!");
                    console.log("💎 Transaction validated:", submitResult.response?.data?.resp?.result?.validated);

                    console.log("💎 Transaction hash:", txHash);

                    // Verify transaction on backend and credit the user
                    console.log("💎 Verifying transaction on backend...");
                    const verifyResponse = await axios.post(
                        `${SdkConfig.get("backend_url")}/payment/crossmark/verify`,
                        {
                            transaction_hash: txHash,
                            payment_id: paymentId,
                        }
                    );

                    if (verifyResponse.data.success) {
                        // Calculate credits added
                        const selectedCredit = this.state?.creditPackages?.data?.find((p) => p.id == this.state.selectedCredit);
                        const baseCredits = parseFloat(selectedCredit?.available_credits || 0);
                        const bonusCredits = baseCredits * (this.state.selectedBonus / 100);
                        const creditsAdded = baseCredits + bonusCredits;
                        const oldBalance = parseFloat(this.state.user?.user?.credit?.balance || 0);

                        // Refresh balance to get new total
                        await this.fetchDetails();

                        // Show success modal in unified modal
                        this.setState({
                            paymentModalState: 'success',
                            paymentModalData: {
                                creditsAdded: creditsAdded,
                                newBalance: oldBalance + creditsAdded,
                                transactionHash: txHash,
                                walletType: "Crossmark",
                            },
                            showSuccessModal: true,
                            showPaymentLoading: false,
                            isLoading: false,
                            successData: {
                                creditsAdded: creditsAdded,
                                newBalance: oldBalance + creditsAdded,
                                transactionHash: txHash,
                                walletType: "Crossmark",
                            },
                        });
                    } else {
                        throw new Error(verifyResponse.data.error || "Transaction verification failed");
                    }
                } catch (error) {
                    console.error("💎 Crossmark payment error:", error);

                    // Show error modal instead of alert
                    this.setState({
                        paymentModalState: 'error',
                        paymentModalData: {
                            errorMessage: error.message || "Transaction failed",
                        },
                        showPaymentLoading: false,
                        isLoading: false,
                    });
                }
            } else {
                // ✅ Xaman/XUMM flow: Show QR modal and poll for completion
                const xamanData = res?.data?.data?.created;
                const payloadUuid = xamanData?.uuid;

                if (xamanData && payloadUuid) {
                    // Show unified payment modal in QR state
                    this.setState({
                        paymentModalState: 'qr',
                        paymentModalData: {
                            xamanQRData: xamanData,
                            xamanPayloadUuid: payloadUuid,
                        },
                        // Keep old state for compatibility during transition
                        showXamanQRModal: true,
                        xamanQRData: xamanData,
                        xamanPayloadUuid: payloadUuid,
                    });

                    console.log("🔄 Starting payment status polling for UUID:", payloadUuid);

                    // Poll for payment status every 2 seconds
                    let pollCount = 0;
                    const maxPolls = 150; // 5 minutes (150 * 2 seconds)
                    const pollInterval = setInterval(async () => {
                        try {
                            pollCount++;
                            console.log(`🔄 Polling attempt ${pollCount}/${maxPolls}...`);

                            const statusRes = await axios.get(
                                `${SdkConfig.get("backend_url")}/accounts/getPayload/${payloadUuid}`
                            );

                            console.log("📊 Payment status:", statusRes.data?.meta);

                            // Check if transaction was signed
                            if (statusRes.data?.meta?.signed === true) {
                                clearInterval(pollInterval);
                                console.log("✅ Transaction signed!");

                                // Transition to loading state
                                this.setState({
                                    paymentModalState: 'loading',
                                    loadingMessage: "Verifying transaction on blockchain...",
                                    // Keep old state for compatibility
                                    showXamanQRModal: false,
                                    showPaymentLoading: true,
                                });

                                // Set 30-second timeout to auto-close modal
                                setTimeout(() => {
                                    if (this.state.paymentModalState === 'loading') {
                                        this.setState({
                                            paymentModalState: null,
                                            paymentModalData: {},
                                            showPaymentLoading: false,
                                            isLoading: false
                                        });
                                        // Don't show error - just close modal since it might still be processing
                                    }
                                }, 30000);

                                // Get transaction hash from XUMM payload response
                                const txHash = statusRes.data?.response?.txid;

                                console.log("🔵 Transaction hash:", txHash);
                                console.log("🔵 XUMM UUID:", payloadUuid);

                                if (txHash && payloadUuid) {
                                    // Retry verification with delays to wait for blockchain confirmation
                                    const maxRetries = 10;
                                    let retryCount = 0;
                                    let verificationSuccess = false;

                                    while (retryCount < maxRetries && !verificationSuccess) {
                                        try {
                                            // Wait before verifying (increasing delay: 2s, 4s, 6s, etc.)
                                            const delay = (retryCount + 1) * 2000;
                                            if (retryCount > 0) {
                                                console.log(`🔵 Retry ${retryCount}/${maxRetries} - waiting ${delay/1000}s for blockchain confirmation...`);
                                                await new Promise(resolve => setTimeout(resolve, delay));
                                            } else {
                                                console.log("🔵 Verifying transaction on backend...");
                                            }

                                            const verifyResponse = await axios.post(
                                                `${SdkConfig.get("backend_url")}/payment/xaman/verify`,
                                                {
                                                    transaction_hash: txHash,
                                                    uuid: payloadUuid,
                                                }
                                            );

                                            if (verifyResponse.data.success) {
                                                verificationSuccess = true;

                                                // Calculate credits added
                                                const selectedCredit = this.state?.creditPackages?.data?.find((p) => p.id == this.state.selectedCredit);
                                                const baseCredits = parseFloat(selectedCredit?.available_credits || 0);
                                                const bonusCredits = baseCredits * (this.state.selectedBonus / 100);
                                                const creditsAdded = baseCredits + bonusCredits;
                                                const oldBalance = parseFloat(this.state.user?.user?.credit?.balance || 0);

                                                // Refresh balance
                                                await this.fetchDetails();
                                                console.log("✅ Credits refreshed");

                                                // Transition to success state
                                                this.setState({
                                                    paymentModalState: 'success',
                                                    paymentModalData: {
                                                        ...this.state.paymentModalData,
                                                        creditsAdded: creditsAdded,
                                                        newBalance: oldBalance + creditsAdded,
                                                        transactionHash: txHash,
                                                        walletType: "Xaman",
                                                    },
                                                    isLoading: false,
                                                    // Keep old state for compatibility
                                                    showSuccessModal: true,
                                                    showPaymentLoading: false,
                                                    successData: {
                                                        creditsAdded: creditsAdded,
                                                        newBalance: oldBalance + creditsAdded,
                                                        transactionHash: txHash,
                                                        walletType: "Xaman",
                                                    },
                                                });
                                            } else {
                                                console.warn(`⚠️ Verification attempt ${retryCount + 1} failed:`, verifyResponse.data.error);
                                                retryCount++;
                                            }
                                        } catch (verifyError) {
                                            console.error(`❌ Verification attempt ${retryCount + 1} error:`, verifyError.response?.data || verifyError.message);

                                            // If it's a "transaction not found" error, retry
                                            if (verifyError.response?.data?.error?.includes("Transaction not found") ||
                                                verifyError.response?.data?.error?.includes("Transaction verification failed")) {
                                                retryCount++;
                                                if (retryCount >= maxRetries) {
                                                    this.setState({
                                                        paymentModalState: 'error',
                                                        paymentModalData: {
                                                            errorMessage: `Transaction verification timed out. The transaction may still be processing.\n\nTransaction Hash: ${txHash}\n\nPlease refresh the page in a moment to see your updated balance.`,
                                                        },
                                                        showPaymentLoading: false,
                                                        isLoading: false
                                                    });
                                                }
                                            } else {
                                                // Other errors - don't retry
                                                this.setState({
                                                    paymentModalState: 'error',
                                                    paymentModalData: {
                                                        errorMessage: `Failed to verify transaction: ${verifyError.response?.data?.error || verifyError.message}`,
                                                    },
                                                    showPaymentLoading: false,
                                                    isLoading: false
                                                });
                                                break;
                                            }
                                        }
                                    }
                                } else {
                                    console.warn("⚠️ Transaction hash or UUID not found");
                                    this.setState({
                                        paymentModalState: 'error',
                                        paymentModalData: {
                                            errorMessage: "Transaction was signed but verification failed. Please contact support.",
                                        },
                                        showPaymentLoading: false,
                                        isLoading: false
                                    });
                                }
                            } else if (statusRes.data?.meta?.cancelled === true) {
                                clearInterval(pollInterval);
                                console.log("❌ Transaction cancelled");

                                // Close QR modal and loading, show error modal
                                this.setState({
                                    paymentModalState: 'error',
                                    paymentModalData: {
                                        errorMessage: "Transaction was cancelled. Your payment was not processed.",
                                    },
                                    showXamanQRModal: false,
                                    showPaymentLoading: false,
                                    isLoading: false
                                });
                            }

                            // Stop polling after max attempts
                            if (pollCount >= maxPolls) {
                                clearInterval(pollInterval);
                                this.setState({
                                    paymentModalState: null,
                                    paymentModalData: {},
                                    showXamanQRModal: false,
                                    showPaymentLoading: false,
                                    isLoading: false
                                });
                                console.log("⏱️ Polling timeout reached");
                                // Don't show error - just close modal since it might still be processing
                            }
                        } catch (error) {
                            console.error("❌ Error polling payment status:", error);
                            // Continue polling even on error
                        }
                    }, 2000); // Poll every 2 seconds
                } else {
                    console.warn("No Xaman data or UUID returned from backend");
                    console.warn("Response data:", res?.data);

                    // Show error modal instead of alert
                    this.setState({
                        paymentModalState: 'error',
                        paymentModalData: {
                            errorMessage: "Failed to initiate payment. Please try again.",
                        },
                        isLoading: false,
                    });
                }
            }
        } catch (e) {
            console.error("ERROR handleBuyCredits", e);

            // Show error modal instead of alert
            this.setState({
                paymentModalState: 'error',
                paymentModalData: {
                    errorMessage: e.message || "Payment failed. Please try again.",
                },
                isLoading: false,
                showPaymentLoading: false,
                showXamanQRModal: false
            });
        }
    }

    public componentDidMount(): void {
        console.log("buy mounted");
        // noinspection JSIgnoredPromiseFromCall
        this.fetchDetails();
        this.setState({ selectedCredit: 0 });
        this.setState({ selectedToken: "" });
    }

    public componentWillUnmount(): void {}

    public componentDidUpdate(prevProps: Readonly<IProps>, prevState: Readonly<IState>): void {}
    public render(): React.ReactNode {
        if (this.state.phase === Phase.Loading) {
            // Ends up default centered
            return <Spinner />;
        } else if (this.state.phase === Phase.Error) {
            return <p data-testid="error-message">{_t("There was an error loading your credits settings.")}</p>;
        }

        return (
            <>
                <div>
                    <p className="">Your credits balance</p>
                    <b>{this.state.user?.user?.credit?.balance}</b>
                    <p className="">Select the amount to buy</p>
                    <select
                        onChange={(e) => {
                            this.setState({ selectedCredit: Number(e.target.value) });
                        }}
                    >
                        <option value="">Select Package</option>
                        {(this.state?.creditPackages?.data || [])?.map((p) => (
                            <>
                                <option value={p.id}>{p.name}</option>
                            </>
                        ))}
                    </select>
                    <p className="">Select payment token</p>
                    <select
                        onChange={(e) => {
                            this.handleTokenChange(e);
                        }}
                    >
                        <option value="">Select Token</option>
                        {(this.state?.tokenData?.data || [])?.map((p) => (
                            <>
                                <option value={`${p.currency}:${p.issuer}`}>{p.currency}</option>
                            </>
                        ))}
                    </select>
                    <b>
                        {
                            <p style={{ margin: "20px 0" }}>
                                Bonus mCredits:{" "}
                                {parseFloat(
                                    this.state?.creditPackages?.data?.find((p) => p.id == this.state.selectedCredit)
                                        ?.available_credits || 0,
                                ) *
                                    (this.state.selectedBonus / 100)}
                            </p>
                        }
                    </b>
                </div>

                <div>
                    <p style={{ margin: 0 }}>Price:</p>
                    {/* <b>
                        {this.state?.creditPackages?.data?.find((p) => p.id == this.state.selectedCredit)?.price || 0}{" "}
                        XRP (
                        {(
                            (this.state?.creditPackages?.data?.find((p) => p.id == this.state.selectedCredit)?.price ||
                                0) * parseFloat(this.state.usdPrice)
                        ).toFixed(2)}{" "}
                        USD)
                    </b> */}
                    <b>
                        ${this.state?.creditPackages?.data?.find((p) => p.id == this.state.selectedCredit)?.price || 0}{" "}
                        USD ({" "}
                        {Number(
                            (this.state?.creditPackages?.data?.find((p) => p.id == this.state.selectedCredit)?.price ||
                                0) / parseFloat(this.state.usdTokenPrice || "1"),
                        ).toFixed(2)}{" "}
                        {this.state.selectedToken} )
                    </b>
                </div>
                <div>
                    <p style={{ margin: 0 }}>Your new credits balance will be</p>
                    <b>
                        {parseFloat(
                            this.state?.creditPackages?.data?.find((p) => p.id == this.state.selectedCredit)
                                ?.available_credits || 0,
                        ) +
                            parseFloat(
                                this.state?.creditPackages?.data?.find((p) => p.id == this.state.selectedCredit)
                                    ?.available_credits || 0,
                            ) *
                                (this.state.selectedBonus / 100) +
                            parseFloat(this.state.user?.user?.credit?.balance)}
                    </b>
                </div>
                <AccessibleButton
                    kind="primary"
                    onClick={this.handleBuyCredits.bind(this)}
                    disabled={this.state.isLoading}
                >
                    {_t("Buy Credits")}
                </AccessibleButton>

                {/* Unified Payment Modal - Transitions between QR → Loading → Success */}
                {this.state.paymentModalState && (
                    this.state.paymentModalState === 'loading' ? (
                        // Loading Overlay (not in BaseDialog to cover full screen)
                        <div style={{
                            position: "fixed",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: "rgba(0, 0, 0, 0.85)",
                            backdropFilter: "blur(8px)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 9999,
                            animation: "fadeIn 0.3s ease-in"
                        }}>
                            <div style={{
                                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                padding: "50px 60px",
                                borderRadius: "20px",
                                boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
                                textAlign: "center",
                                color: "white",
                                maxWidth: "400px",
                                position: "relative"
                            }}>
                                {/* Animated Spinner */}
                                <div style={{
                                    width: "80px",
                                    height: "80px",
                                    border: "6px solid rgba(255,255,255,0.3)",
                                    borderTop: "6px solid white",
                                    borderRadius: "50%",
                                    margin: "0 auto 30px",
                                    animation: "spin 1s linear infinite"
                                }} />

                                <h3 style={{
                                    margin: "0 0 15px 0",
                                    fontSize: "24px",
                                    fontWeight: "600",
                                    letterSpacing: "-0.5px"
                                }}>
                                    {this.state.loadingMessage}
                                </h3>

                                <p style={{
                                    margin: "0 0 25px 0",
                                    opacity: 0.9,
                                    fontSize: "14px",
                                    lineHeight: "1.6"
                                }}>
                                    Please wait while we process your transaction. This may take a few moments.
                                </p>

                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "8px",
                                    fontSize: "13px",
                                    opacity: 0.8
                                }}>
                                    <div style={{
                                        width: "6px",
                                        height: "6px",
                                        borderRadius: "50%",
                                        background: "#4ade80",
                                        animation: "pulse 2s infinite"
                                    }} />
                                    Do not close this window
                                </div>

                                <AccessibleButton
                                    kind="danger_outline"
                                    onClick={() => {
                                        this.setState({
                                            paymentModalState: null,
                                            paymentModalData: {},
                                            showPaymentLoading: false,
                                            showXamanQRModal: false,
                                            isLoading: false
                                        });
                                    }}
                                    style={{
                                        marginTop: "30px",
                                        background: "rgba(255,255,255,0.1)",
                                        color: "white",
                                        border: "1px solid rgba(255,255,255,0.3)",
                                        padding: "10px 25px",
                                        borderRadius: "8px",
                                        fontSize: "13px",
                                        cursor: "pointer"
                                    }}
                                >
                                    ✕ Cancel
                                </AccessibleButton>
                            </div>

                            <style>{`
                                @keyframes spin {
                                    0% { transform: rotate(0deg); }
                                    100% { transform: rotate(360deg); }
                                }
                                @keyframes fadeIn {
                                    from { opacity: 0; }
                                    to { opacity: 1; }
                                }
                                @keyframes pulse {
                                    0%, 100% { opacity: 1; }
                                    50% { opacity: 0.5; }
                                }
                                @keyframes bounceIn {
                                    0% { transform: scale(0); opacity: 0; }
                                    50% { transform: scale(1.1); }
                                    100% { transform: scale(1); opacity: 1; }
                                }
                            `}</style>
                        </div>
                    ) : (
                        // QR and Success states use BaseDialog
                        <BaseDialog
                            title=""
                            onFinished={() => this.setState({
                                paymentModalState: null,
                                paymentModalData: {},
                                showXamanQRModal: false,
                                showSuccessModal: false,
                                successData: null
                            })}
                            hasCancel={this.state.paymentModalState !== 'success'}
                        >
                            {this.state.paymentModalState === 'qr' && this.state.paymentModalData?.xamanQRData && (
                                <div style={{
                                    textAlign: "center",
                                    padding: "30px",
                                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                    borderRadius: "12px",
                                    color: "white"
                                }}>
                                    <div style={{ fontSize: "48px", marginBottom: "20px" }}>📱</div>
                                    <h2 style={{ margin: "0 0 10px 0", fontSize: "24px", fontWeight: "600" }}>
                                        Scan with Xaman
                                    </h2>
                                    <p style={{ margin: "0 0 30px 0", opacity: 0.9, fontSize: "14px" }}>
                                        Open your Xaman wallet app and scan this QR code to complete the payment
                                    </p>

                                    <div style={{
                                        background: "white",
                                        padding: "25px 0px",
                                        borderRadius: "16px",
                                        boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
                                        margin: "0 auto 25px",
                                        maxWidth: "340px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center"
                                    }}>
                                        <img
                                            src={this.state.paymentModalData.xamanQRData.refs.qr_png}
                                            alt="Xaman Payment QR Code"
                                            style={{
                                                width: "100%",
                                                maxWidth: "290px",
                                                height: "auto",
                                                borderRadius: "8px",
                                                display: "block",
                                                margin: "0 auto"
                                            }}
                                        />
                                    </div>

                                    <div style={{
                                        background: "rgba(255,255,255,0.1)",
                                        padding: "15px",
                                        borderRadius: "8px",
                                        marginBottom: "20px"
                                    }}>
                                        <div style={{ fontSize: "12px", opacity: 0.8, marginBottom: "5px" }}>Transaction ID</div>
                                        <div style={{
                                            fontSize: "11px",
                                            fontFamily: "monospace",
                                            wordBreak: "break-all",
                                            opacity: 0.9
                                        }}>
                                            {this.state.paymentModalData.xamanPayloadUuid}
                                        </div>
                                    </div>

                                    <div style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "10px",
                                        marginBottom: "20px",
                                        fontSize: "14px"
                                    }}>
                                        <div style={{
                                            width: "8px",
                                            height: "8px",
                                            borderRadius: "50%",
                                            background: "#4ade80",
                                            animation: "pulse 2s infinite"
                                        }} />
                                        Waiting for confirmation...
                                    </div>

                                    <AccessibleButton
                                        kind="primary"
                                        onClick={() => window.open(this.state.paymentModalData.xamanQRData.next.always, "_blank")}
                                        style={{
                                            background: "white",
                                            color: "#667eea",
                                            padding: "12px 30px",
                                            borderRadius: "8px",
                                            fontWeight: "600",
                                            border: "none",
                                            cursor: "pointer",
                                            fontSize: "14px"
                                        }}
                                    >
                                        🚀 Open in Xaman App
                                    </AccessibleButton>
                                </div>
                            )}

                            {this.state.paymentModalState === 'success' && this.state.paymentModalData && (
                                <div style={{
                                    textAlign: "center",
                                    padding: "40px 30px",
                                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                    borderRadius: "12px",
                                    color: "white"
                                }}>
                                    {/* Success Animation */}
                                    <div style={{
                                        fontSize: "72px",
                                        marginBottom: "20px",
                                        animation: "bounceIn 0.6s ease-out"
                                    }}>
                                        ✨
                                    </div>

                                    <h2 style={{
                                        margin: "0 0 15px 0",
                                        fontSize: "28px",
                                        fontWeight: "700",
                                        letterSpacing: "-0.5px"
                                    }}>
                                        Credits Added Successfully!
                                    </h2>

                                    <p style={{
                                        margin: "0 0 30px 0",
                                        opacity: 0.95,
                                        fontSize: "15px",
                                        lineHeight: "1.6"
                                    }}>
                                        Your payment has been confirmed and credits have been added to your account
                                    </p>

                                    {/* Credits Info Card */}
                                    <div style={{
                                        background: "rgba(255,255,255,0.15)",
                                        backdropFilter: "blur(10px)",
                                        padding: "25px",
                                        borderRadius: "12px",
                                        marginBottom: "25px",
                                        border: "1px solid rgba(255,255,255,0.2)"
                                    }}>
                                        <div style={{ marginBottom: "20px" }}>
                                            <div style={{
                                                fontSize: "13px",
                                                opacity: 0.9,
                                                marginBottom: "8px",
                                                textTransform: "uppercase",
                                                letterSpacing: "1px"
                                            }}>
                                                Credits Added
                                            </div>
                                            <div style={{
                                                fontSize: "36px",
                                                fontWeight: "700",
                                                color: "#4ade80"
                                            }}>
                                                +{this.state.paymentModalData.creditsAdded}
                                            </div>
                                        </div>

                                        <div style={{
                                            height: "1px",
                                            background: "rgba(255,255,255,0.2)",
                                            margin: "20px 0"
                                        }} />

                                        <div>
                                            <div style={{
                                                fontSize: "13px",
                                                opacity: 0.9,
                                                marginBottom: "8px",
                                                textTransform: "uppercase",
                                                letterSpacing: "1px"
                                            }}>
                                                New Balance
                                            </div>
                                            <div style={{
                                                fontSize: "28px",
                                                fontWeight: "600"
                                            }}>
                                                {this.state.paymentModalData.newBalance} mCredits
                                            </div>
                                        </div>
                                    </div>

                                    {/* Transaction Details */}
                                    <div style={{
                                        background: "rgba(255,255,255,0.1)",
                                        padding: "15px",
                                        borderRadius: "8px",
                                        marginBottom: "25px"
                                    }}>
                                        <div style={{
                                            fontSize: "11px",
                                            opacity: 0.8,
                                            marginBottom: "8px",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.5px"
                                        }}>
                                            Transaction Hash
                                        </div>
                                        <div style={{
                                            fontSize: "11px",
                                            fontFamily: "monospace",
                                            wordBreak: "break-all",
                                            opacity: 0.95,
                                            lineHeight: "1.5"
                                        }}>
                                            {this.state.paymentModalData.transactionHash}
                                        </div>
                                    </div>

                                    <div style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "8px",
                                        marginBottom: "25px",
                                        fontSize: "13px",
                                        opacity: 0.9
                                    }}>
                                        <div style={{
                                            width: "6px",
                                            height: "6px",
                                            borderRadius: "50%",
                                            background: "#4ade80"
                                        }} />
                                        Paid with {this.state.paymentModalData.walletType}
                                    </div>

                                    <AccessibleButton
                                        kind="primary"
                                        onClick={() => this.setState({
                                            paymentModalState: null,
                                            paymentModalData: {},
                                            showSuccessModal: false,
                                            successData: null
                                        })}
                                        style={{
                                            background: "white",
                                            color: "#667eea",
                                            padding: "14px 40px",
                                            borderRadius: "8px",
                                            fontWeight: "600",
                                            border: "none",
                                            cursor: "pointer",
                                            fontSize: "15px",
                                            boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
                                        }}
                                    >
                                        🎉 Awesome!
                                    </AccessibleButton>
                                </div>
                            )}

                            {this.state.paymentModalState === 'error' && this.state.paymentModalData && (
                                <div style={{
                                    textAlign: "center",
                                    padding: "40px 30px",
                                    background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                                    borderRadius: "12px",
                                    color: "white"
                                }}>
                                    <div style={{ fontSize: "72px", marginBottom: "20px" }}>❌</div>
                                    <h2 style={{
                                        margin: "0 0 15px 0",
                                        fontSize: "28px",
                                        fontWeight: "700",
                                        letterSpacing: "-0.5px"
                                    }}>
                                        Transaction Failed
                                    </h2>
                                    <p style={{
                                        margin: "0 0 30px 0",
                                        opacity: 0.95,
                                        fontSize: "15px",
                                        lineHeight: "1.6"
                                    }}>
                                        {this.state.paymentModalData.errorMessage || "The transaction was cancelled or failed"}
                                    </p>
                                    <AccessibleButton
                                        kind="primary"
                                        onClick={() => this.setState({
                                            paymentModalState: null,
                                            paymentModalData: {}
                                        })}
                                        style={{
                                            background: "white",
                                            color: "#ef4444",
                                            padding: "14px 40px",
                                            borderRadius: "8px",
                                            fontWeight: "600",
                                            border: "none",
                                            cursor: "pointer",
                                            fontSize: "15px"
                                        }}
                                    >
                                        Close
                                    </AccessibleButton>
                                </div>
                            )}
                        </BaseDialog>
                    )
                )}
            </>
        );
    }
}
