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

import React, {ReactElement} from "react";
import axios from "axios";
import {isBoolean} from "lodash";

import Spinner from "../elements/Spinner";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { _t } from "../../../languageHandler";
import UserIdentifierCustomisations from "../../../customisations/UserIdentifier";

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
    featuresData: any
}
export const NFTCard = (props: {
    contract_address: string
    image_link?: string
    discord: boolean
    twitter: boolean
    twilio: boolean
    dark_mode: boolean
    with_content?: boolean
}): ReactElement => {
    console.log('NFTCard props', props)
    return (
        <div>
            {props.image_link && (
                <div>
                    <img
                        src={props.image_link}
                        alt="arrow-left"
                        className="cursor-pointer object-cover border border-primary-gray"
                        height={96}
                        width={96}
                    />
                </div>
            )}
            {props.with_content &&
                Object.keys(props).map((v: string) => {
                    if (['image_link', 'with_content','NFTokenID'].includes(v)) return <></>
                    return (
                        <div className="mt-2" key={v}>
                            <p className="text-base font-semibold">{v?.replaceAll('_', ' ')}</p>
                            <p className="text-secondary-text text-xs font-normal">
                                {isBoolean(props[v]) ? (props[v] === true ? 'Yes' : 'No') : String(props[v])}
                            </p>
                        </div>
                    )
                })}
        </div>
    )
}


export default class MyFeatures extends React.PureComponent<IProps, IState> {

    public constructor(props: IProps) {
        super(props);

        this.state = {
            phase: Phase.Loading,
            featuresData: {}
        };
    }


    private async fetchDetails(): Promise<void> {
        try {
            const details = UserIdentifierCustomisations.getDisplayUserIdentifier(
                MatrixClientPeg.get().getSafeUserId(),
                {
                    withDisplayName: true,
                },
            )
            console.log("details", details)

            const {data: features} = await axios.get(`https://backend.textrp.io/my-features/${"rfdmLaLLtBzHUrq2SjtnZemY39XM9jPYwL"}/main`)
            this.setState({featuresData: features, phase: Phase.Ready})
        } catch (e) {
            this.setState({phase: Phase.Error})
            console.error(e)
        }
    }

    public componentDidMount(): void {
        console.log("buy mounted")
        // noinspection JSIgnoredPromiseFromCall
        this.fetchDetails();
    }

    public componentWillUnmount(): void {
    }

    public componentDidUpdate(prevProps: Readonly<IProps>, prevState: Readonly<IState>): void {
    }

    public render(): React.ReactNode {
        if (this.state.phase === Phase.Loading) {
            // Ends up default centered
            return <Spinner />;
        } else if (this.state.phase === Phase.Error) {
            return <p data-testid="error-message">{_t("There was an error loading your feature settings.")}</p>;
        }

        return (
            <>
                <div className="h-full overflow-y-auto px-4 md:px-8">
                    <div className="grid grid-cols-2 gap-4 my-8 ">
                        {this.state.featuresData?.nfts?.map((ni: any, i: number) => (
                            <NFTCard {...ni} key={i} with_content={true} />
                        ))}
                        {this.state.featuresData?.nfts?.length === 0 || (!this.state.featuresData)
                            ? 'No NFTs found on your address'
                            : ''}
                    </div>
                </div>
            </>
        );
    }
}
