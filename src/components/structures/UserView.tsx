/*
Copyright 2019 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

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

import React from "react";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { MatrixClient } from "matrix-js-sdk/src/matrix";
import SdkConfig from "../../SdkConfig";
import axios from "axios";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import Modal from "../../Modal";
import { _t } from "../../languageHandler";
import ErrorDialog from "../views/dialogs/ErrorDialog";
import MainSplit from "./MainSplit";
import RightPanel from "./RightPanel";
import Spinner from "../views/elements/Spinner";
import ResizeNotifier from "../../utils/ResizeNotifier";
import { RightPanelPhases } from "../../stores/right-panel/RightPanelStorePhases";
import { UserOnboardingPage } from "../views/user-onboarding/UserOnboardingPage";

interface IProps {
    userId: string;
    resizeNotifier: ResizeNotifier;
}

interface IState {
    loading: boolean;
    member?: RoomMember;
}

export default class UserView extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);
        this.state = {
            loading: true,
        };
    }
    public extractWalletAddress = (inputString: string) => {
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
    public generatePaymentLink = async () => {
        //         const notificationMessage = isKYCVerified(senderId) ?
        //   '🔒 Secure Message Alert! 🌟 You have a verified message waiting for you on TextRP from a KYC-verified sender. Rest assured, your security is our top priority. View your message safely by logging in at app.textrp.io.' :
        //   '🔒 Secure Message Alert! 🚀 You have a new message on TextRP. While the sender hasn't been KYC-verified, we ensure your login and viewing experience remains safe. Access your message at app.textrp.io.';
        try {
            const res = await axios.post(
                `${SdkConfig.get("backend_url")}/accounts/${this.extractWalletAddress(this.props.userId)}/payments`,
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

    public componentDidMount(): void {
        if (this.props.userId) {
            this.loadProfileInfo();
        }
        this.generatePaymentLink();
        const cli = MatrixClientPeg.get();
        cli.createRoom({
            visibility: "private",
            invite: ["@rU5kJVrcojGMZeUCG2xnhZcea9rDCoYMsq:synapse.textrp.io", this.props.userId],
        }).then((e)=>console.log("YYYOYOYOYOYOYOOYOY7", e));
        

    }

    public componentDidUpdate(prevProps: IProps): void {
        // XXX: We shouldn't need to null check the userId here, but we declare
        // it as optional and MatrixChat sometimes fires in a way which results
        // in an NPE when we try to update the profile info.
        if (prevProps.userId !== this.props.userId && this.props.userId) {
            this.loadProfileInfo();
        }
    }

    private async loadProfileInfo(): Promise<void> {
        const cli = MatrixClientPeg.get();
        this.setState({ loading: true });
        let profileInfo: Awaited<ReturnType<MatrixClient["getProfileInfo"]>>;
        try {
            profileInfo = await cli.getProfileInfo(this.props.userId);
        } catch (err) {
            Modal.createDialog(ErrorDialog, {
                title: _t("Ledger Relay Messaging"),
                description: "You are about to message an XRP wallet address that isn't yet active on TextRP. LRM will notify the recipient via microtransaction on the XRPL. Your message remains secure.",
            });            
            this.setState({ loading: false });
            return;
        }
        const fakeEvent = new MatrixEvent({ type: "m.room.member", content: profileInfo });
        // We pass an empty string room ID here, this is slight abuse of the class to simplify code
        const member = new RoomMember("", this.props.userId);
        member.setMembershipEvent(fakeEvent);
        this.setState({ member, loading: false });
    }

    public render(): React.ReactNode {
        if (this.state.loading) {
            return <Spinner />;
        } else if (this.state.member) {
            const panel = (
                <RightPanel
                    overwriteCard={{ phase: RightPanelPhases.RoomMemberInfo, state: { member: this.state.member } }}
                    resizeNotifier={this.props.resizeNotifier}
                />
            );
            return (
                <MainSplit panel={panel} resizeNotifier={this.props.resizeNotifier}>
                    <UserOnboardingPage />
                </MainSplit>
            );
        } else {
            return <div />;
        }
    }
}
