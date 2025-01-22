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
        this.setState({ selectedBonus: selectedTokenData?.bonus || 0 });
        this.setState({ selectedToken: selectedCurrency });

        if (selectedCurrency && selectedCurrency !== "XRP") {
            try {
                const tokenUsdPrice = await this.fetchTokenPrice(selectedCurrency, selectedIssuer);
                this.setState({ usdTokenPrice: tokenUsdPrice.toString() });
                this.setState({ issuer: selectedIssuer });
            } catch (error) {
                console.error("Error fetching token price", error);
            }
        } else if (selectedCurrency === "XRP") {
            this.setState({ usdTokenPrice: this.state.xrpPrice.toString() });
            this.setState({ selectedToken: "XRP" });
        } else {
            this.setState({ usdTokenPrice: "" });
            this.setState({ selectedToken: "" });
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
            const res = await axios.post(
                `${SdkConfig.get("backend_url")}/payment/credit/${this.state.selectedCredit}`,
                {
                    address: details,
                    token: this.state.selectedToken,
                    issuer: this.state.issuer,
                    bonus: this.state.selectedBonus,
                },
            );

            window.open(res?.data?.data?.next?.always, "_blank");
            this.setState({ isLoading: false });
        } catch (e) {
            console.error("ERROR handleBuyCredits", e);
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
                    <p className="">Select the token</p>
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
                    <b>{<p style={{ margin: "20px 0" }}>Bonus mCredits: {this.state.selectedBonus}</p>}</b>
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
                            parseFloat(this.state.user?.user?.credit?.balance) +
                            this.state.selectedBonus}
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
