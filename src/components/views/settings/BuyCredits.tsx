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
                console.log(`✅ SessionId FOUND - will be sent to backend`);
            } else {
                console.log(`❌ SessionId NOT FOUND - backend will receive null!`);
                console.log(`⚠️  This will cause 422 error!`);
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
            if (res?.data?.wallet_provider === "walletconnect") {
                // WalletConnect flow: Backend handles signing via wallet
                console.log("WalletConnect payment - backend is requesting wallet signature");
                
                alert(
                    "Signing request sent to your wallet!\n\n" +
                        "Please check your Joey Wallet or WalletConnect-enabled wallet.\n" +
                        "Approve the transaction to complete your credit purchase.\n\n" +
                        "This may take a few moments..."
                );
                
                // The backend will handle the signing and submission
                // Check if the response indicates success
                if (res.data.success) {
                    alert("Payment successful! Your credits have been added.");
                    await this.fetchDetails();
                } else if (res.data.error) {
                    throw new Error(res.data.error);
                }
            } else {
                // Xaman/XUMM flow: open payment URL
                const paymentUrl = res?.data?.data?.next?.always;
                if (paymentUrl) {
                    window.open(paymentUrl, "_blank");
                } else {
                    console.warn("No payment URL returned from backend");
                }
            }

            this.setState({ isLoading: false });
        } catch (e) {
            console.error("ERROR handleBuyCredits", e);
            alert(`Payment failed: ${e.message || e}`);
            this.setState({ isLoading: false });
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
            </>
        );
    }
}
