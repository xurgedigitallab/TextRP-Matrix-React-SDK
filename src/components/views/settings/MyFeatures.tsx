/* eslint-disable @typescript-eslint/no-var-requires */
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

import React, { ReactElement } from "react";
import axios from "axios";
import { Tabs, Tab, TabList, TabPanel } from "react-tabs";

import Spinner from "../elements/Spinner";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { _t } from "../../../languageHandler";
import UserIdentifierCustomisations from "../../../customisations/UserIdentifier";
import "react-tabs/style/react-tabs.css";
import SdkConfig from "../../../SdkConfig";
// TODO: this "view" component still has far too much application logic in it,
// which should be factored out to other files.

enum Phase {
    Loading = "loading",
    Ready = "ready",
    Persisting = "persisting", // technically a meta-state for Ready, but whatever
    // unrecoverable error - eg can't load push rules
    Error = "error",
    // error saving individual rule
    SavingError = "savingError",
}

interface IProps {}

interface IState {
    phase: Phase;

    // Optional stuff is required when `phase === Ready`
    featuresData: any;
    availableFeatures: any;
    enabledFeatures: any;
}
export const NFTCard = (props: {
    contract_address: string;
    image?: string;
    name: string;
    discord: boolean;
    twitter: boolean;
    twilio: boolean;
    dark_mode: boolean;
    feature: string[]|string;
    taxon: string;
    with_content?: boolean;
}): ReactElement => {
    console.log("NFTCard props", props);

    return (
        <div
            style={{
                boxShadow: "0px 0px 4px 0px rgba(0,0,0,.5)",
                width: "90%",
                height: "300px",
                display: "flex",
                position: "relative",
                borderRadius: "10px",
                padding: "10px",
                flexDirection: "column",
            }}
        >
            {props.image ? (
                <div>
                    <img
                        src={
                            props.image.includes("ipfs://")
                                ? `https://ipfs.io/ipfs/${props.image.split("://")[1]}`
                                : props.image
                        }
                        // src="../../../../res/img/placeholder.png"
                        alt=""
                        className="cursor-pointer object-cover border border-primary-gray"
                        width="100%"
                        height="180px"
                        style={{ objectFit: "contain" }}
                        onError={(source: any) => (source.src = "../../../../res/img/placeholder.png")}
                    />
                </div>
            ) : (
                <div>
                    <img
                        src="https://thinkfirstcommunication.com/wp-content/uploads/2022/05/placeholder-1-1.png"
                        // src="../../../../res/img/placeholder.png"
                        alt=""
                        className="cursor-pointer object-cover border border-primary-gray"
                        width="100%"
                        height="180px"
                        style={{ objectFit: "contain" }}
                        onError={(source: any) => (source.src = "")}
                    />
                </div>
            )}
            {props.with_content && (
                <div>
                    <p className="text-base font-semibold" style={{ fontSize: "14px" }}>
                        {" "}
                        <b>Name : </b> {props.name} <br />
                        <b>Address : </b>
                        {props.contract_address}
                        <br />
                        {props.feature && (
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "start",
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                }}
                            >
                                <b>Feature Available : </b>{" "}
                                { Array.isArray(props.feature)?props.feature.map((items, index) => {
                                    console.log(items);
                                    return (
                                        <span
                                            style={{
                                                backgroundColor: "var(--accent)",
                                                borderRadius: "3px",
                                                color: "white",
                                                paddingInline: "5px",
                                                paddingBlock: "1px",
                                                marginLeft: "5px",
                                            }}
                                        >
                                            {items}
                                        </span>
                                    );
                                }): <span
                                style={{
                                    backgroundColor: "var(--accent)",
                                    borderRadius: "3px",
                                    color: "white",
                                    paddingInline: "5px",
                                    paddingBlock: "1px",
                                    marginLeft: "5px",
                                }}
                            >
                                {props.feature}
                            </span>}{" "}
                                <br />{" "}
                            </div>
                        )}
                        <b> Taxon : </b> {props.taxon}
                    </p>
                    {/* <p className="text-base font-semibold"> Feature Available : {props.feature}</p> */}
                </div>
            )}

            {/* {props.feature && (
                <div
                    style={{
                        position: "absolute",
                        zIndex: 999,
                        background: "#1CB7EB",
                        padding: "4px",
                        display: "flex",
                        justifyContent: "left",
                        color: "white",
                        fontSize: "12px",
                        fontWeight: "bold",
                        alignItems: "center",
                        borderRadius: "0px 0px 8px 1px",
                    }}
                >
                    {" "}
                    <img
                        src="https://cdn4.iconfinder.com/data/icons/social-media-icons-the-circle-set/48/twitter_circle-512.png"
                        alt="feature"
                        style={{ width: "24px", height: "24px" }}
                    />{" "}
                    {props.feature.charAt(0).toUpperCase() + props.feature.slice(1)}
                </div>
            )} */}
        </div>
    );
};

export default class MyFeatures extends React.PureComponent<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            phase: Phase.Loading,
            featuresData: {},
            availableFeatures: {},
            enabledFeatures: {},
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
            const { data: userData } = await axios.post(`${SdkConfig.get("backend_url")}/my-address`, {
                address: details,
            });
            console.log("addrrr", userData);

            const { data: features } = await axios.get(
                `${SdkConfig.get("backend_url")}/my-features/${userData.address}/main/all`,
            );
            const { data: availableFeatures } = await axios.get(
                `${SdkConfig.get("backend_url")}/my-features/${userData.address}/main/`,
            );
            const { data: enableFeatures } = await axios.get(
                `${SdkConfig.get("backend_url")}/my-features/${userData.address}/main/enabled`,
            );
            console.log("details +++ ", features);

            this.setState({
                featuresData: !features.msg ? features : null,
                availableFeatures: !availableFeatures.msg ? availableFeatures : null,
                enabledFeatures: !enableFeatures.msg ? enableFeatures : null,
                phase: Phase.Ready,
            });
        } catch (e) {
            this.setState({ phase: Phase.Error });
            console.error(e);
        }
    }

    public componentDidMount(): void {
        console.log("buy mounted");
        // noinspection JSIgnoredPromiseFromCall
        this.fetchDetails();
    }

    public componentWillUnmount(): void {}

    public componentDidUpdate(prevProps: Readonly<IProps>, prevState: Readonly<IState>): void {}

    public render(): React.ReactNode {
        if (this.state.phase === Phase.Loading) {
            // Ends up default centered
            return <Spinner />;
        } else if (this.state.phase === Phase.Error) {
            return <p data-testid="error-message">{_t("There was an error loading your feature settings.")}</p>;
        }

        return (
            <div className="h-full overflow-y-auto px-4 md:px-8">
                <div className="grid grid-cols-2 gap-4 my-8 ">
                    <Tabs>
                        <TabList>
                            <Tab>Enabled</Tab>
                            <Tab>Available</Tab>
                            <Tab>My NFTs</Tab>
                        </TabList>

                        <TabPanel>
                            <div style={{ display: "flex", padding: "10px", flexWrap: "wrap", gap: "20px" }}>
                                {this.state.enabledFeatures &&
                                    this.state.enabledFeatures?.nfts.map((ni: any, i: number) => (
                                        <>
                                            <div key={i} style={{ display: "flex", width: "320px" }}>
                                                <NFTCard {...ni} key={i} with_content={true} />
                                            </div>
                                        </>
                                    ))}
                            </div>
                            {!this.state.enabledFeatures ? "No NFTs found on your address" : ""}
                        </TabPanel>
                        <TabPanel>
                            <div style={{ display: "flex", padding: "10px", flexWrap: "wrap", gap: "20px" }}>
                                {this.state.availableFeatures?.nfts.map((ni: any, i: number) => (
                                    <>
                                        <div key={i} style={{ display: "flex", width: "320px" }}>
                                            <NFTCard {...ni} key={i} with_content={true} />
                                        </div>
                                    </>
                                ))}
                            </div>
                            {!this.state.availableFeatures ? "No NFTs available" : ""}
                        </TabPanel>
                        <TabPanel>
                            <div style={{ display: "flex", padding: "10px", flexWrap: "wrap", gap: "20px" }}>
                                {this.state.featuresData?.map((ni: any, i: number) => (
                                    <>
                                        <div key={i} style={{ display: "flex", width: "320px" }}>
                                            <NFTCard
                                                {...ni}
                                                contract_address={ni.Issuer}
                                                taxon={ni.NFTokenTaxon}
                                                key={i}
                                                image={ni.URI}
                                                with_content={true}
                                            />
                                        </div>
                                    </>
                                ))}
                            </div>
                            {!this.state.featuresData ? "No NFTs found on your address" : ""}
                        </TabPanel>
                    </Tabs>
                </div>
            </div>
        );
    }
}
