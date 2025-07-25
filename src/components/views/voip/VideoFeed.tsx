/*
Copyright 2015, 2016, 2019, 2020, 2021 The Matrix.org Foundation C.I.C.
Copyright 2021 - 2022 Šimon Brandner <simon.bra.ag@gmail.com>

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

import classnames from "classnames";
import { MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import React from "react";
import axios from "axios";
import BuyCredits2 from "../settings/BuyCredits2";
import ErrorDialog from "../dialogs/ErrorDialog";
import SdkConfig from "../../../SdkConfig";
import Modal from "../../../Modal";
import { _t } from "../../../languageHandler";
import { extractWalletAddress } from "../../../paymentServices";
import { CallFeed, CallFeedEvent } from "matrix-js-sdk/src/webrtc/callFeed";
import { logger } from "matrix-js-sdk/src/logger";
import { SDPStreamMetadataPurpose } from "matrix-js-sdk/src/webrtc/callEventTypes";

import SettingsStore from "../../../settings/SettingsStore";
import LegacyCallHandler from "../../../LegacyCallHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import RoomAvatar from "../avatars/RoomAvatar";

interface IProps {
    call: MatrixCall;

    feed: CallFeed;

    // Whether this call view is for picture-in-picture mode
    // otherwise, it's the larger call view when viewing the room the call is in.
    // This is sort of a proxy for a number of things but we currently have no
    // need to control those things separately, so this is simpler.
    pipMode?: boolean;

    // a callback which is called when the video element is resized
    // due to a change in video metadata
    onResize?: (e: Event) => void;

    primary?: boolean;
    secondary?: boolean;
}

interface IState {
    audioMuted: boolean;
    videoMuted: boolean;
    interval?: any;
}

export default class VideoFeed extends React.PureComponent<IProps, IState> {
    private element?: HTMLVideoElement;

    public constructor(props: IProps) {
        super(props);

        this.state = {
            audioMuted: this.props.feed.isAudioMuted(),
            videoMuted: this.props.feed.isVideoMuted(),
            interval: 0,
        };
    }

    private onHangupClick = (): void => {
        const roomId = LegacyCallHandler.instance.roomIdForCall(this.props.call);        
        if (roomId) LegacyCallHandler.instance.hangupOrReject(roomId);
    };
    public componentDidMount(): void {
        this.updateFeed(null, this.props.feed);
        const cli = MatrixClientPeg.get();
        this.props.feed.connected && this.props.call.direction === "outbound" && axios
        .post(`${SdkConfig.get("backend_url")}/chat-webhook`, {
            service: "video",
            type: "call",
            address: extractWalletAddress(cli.getUserId()),
            password: "demo123",
        })
        .catch((e) => {
            this.onHangupClick();
            Modal.createDialog(ErrorDialog, {
                title: _t("Insufficient credits message"),
                description: <BuyCredits2 />,
            });
        });
        this.setState({
            interval: setInterval(() => {                
               this.props.call.direction === "outbound" && axios
                    .post(`${SdkConfig.get("backend_url")}/chat-webhook`, {
                        service: "video",
                        type: "call",
                        address: extractWalletAddress(cli.getUserId()),
                        password: "demo123",
                    })
                    .catch((e) => {
                        this.onHangupClick();
                        Modal.createDialog(ErrorDialog, {
                            title: _t("Insufficient credits message"),
                            description: <BuyCredits2 />,
                        });
                    });
            }, 60000),
        });
        this.playMedia();
    }

    public componentWillUnmount(): void {
        this.updateFeed(this.props.feed, null);
        clearInterval(this.state.interval);
    }

    public componentDidUpdate(prevProps: IProps, prevState: IState): void {
        this.updateFeed(prevProps.feed, this.props.feed);
        // If the mutes state has changed, we try to playMedia()
        if (prevState.videoMuted !== this.state.videoMuted || prevProps.feed.stream !== this.props.feed.stream) {
            this.playMedia();
        }
    }

    public static getDerivedStateFromProps(props: IProps): IState {
        return {
            audioMuted: props.feed.isAudioMuted(),
            videoMuted: props.feed.isVideoMuted(),
        };
    }

    private setElementRef = (element: HTMLVideoElement): void => {
        if (!element) {
            this.element?.removeEventListener("resize", this.onResize);
            return;
        }

        this.element = element;
        element.addEventListener("resize", this.onResize);
    };

    private updateFeed(oldFeed: CallFeed | null, newFeed: CallFeed | null): void {
        if (oldFeed === newFeed) return;

        if (oldFeed) {
            this.props.feed.removeListener(CallFeedEvent.NewStream, this.onNewStream);
            this.props.feed.removeListener(CallFeedEvent.MuteStateChanged, this.onMuteStateChanged);
            if (this.props.feed.purpose === SDPStreamMetadataPurpose.Usermedia) {
                this.props.feed.measureVolumeActivity(false);
            }
            this.stopMedia();
        }
        if (newFeed) {
            this.props.feed.addListener(CallFeedEvent.NewStream, this.onNewStream);
            this.props.feed.addListener(CallFeedEvent.MuteStateChanged, this.onMuteStateChanged);
            if (this.props.feed.purpose === SDPStreamMetadataPurpose.Usermedia) {
                this.props.feed.measureVolumeActivity(true);
            }
            this.playMedia();
        }
    }

    private async playMedia(): Promise<void> {
        const element = this.element;
        if (!element) return;
        // We play audio in AudioFeed, not here
        element.muted = true;
        element.srcObject = this.props.feed.stream;
        element.autoplay = true;
        try {
            // A note on calling methods on media elements:
            // We used to have queues per media element to serialise all calls on those elements.
            // The reason given for this was that load() and play() were racing. However, we now
            // never call load() explicitly so this seems unnecessary. However, serialising every
            // operation was causing bugs where video would not resume because some play command
            // had got stuck and all media operations were queued up behind it. If necessary, we
            // should serialise the ones that need to be serialised but then be able to interrupt
            // them with another load() which will cancel the pending one, but since we don't call
            // load() explicitly, it shouldn't be a problem. - Dave
            await element.play();
        } catch (e) {
            logger.info(
                `Failed to play media element with feed for userId ` +
                    `${this.props.feed.userId} with purpose ${this.props.feed.purpose}`,
                e,
            );
        }
    }

    private stopMedia(): void {
        const element = this.element;
        if (!element) return;

        element.pause();
        element.removeAttribute("src");

        // As per comment in componentDidMount, setting the sink ID back to the
        // default once the call is over makes setSinkId work reliably. - Dave
        // Since we are not using the same element anymore, the above doesn't
        // seem to be necessary - Šimon
    }

    private onNewStream = (): void => {
        this.setState({
            audioMuted: this.props.feed.isAudioMuted(),
            videoMuted: this.props.feed.isVideoMuted(),
        });
        this.playMedia();
    };

    private onMuteStateChanged = (): void => {
        this.setState({
            audioMuted: this.props.feed.isAudioMuted(),
            videoMuted: this.props.feed.isVideoMuted(),
        });
    };

    private onResize = (e: Event): void => {
        if (this.props.onResize && !this.props.feed.isLocal()) {
            this.props.onResize(e);
        }
    };

    public render(): React.ReactNode {
        const { pipMode, primary, secondary, feed } = this.props;
        const wrapperClasses = classnames("mx_VideoFeed", {
            mx_VideoFeed_primary: primary,
            mx_VideoFeed_secondary: secondary,
            mx_VideoFeed_voice: this.state.videoMuted,
        });
        const micIconClasses = classnames("mx_VideoFeed_mic", {
            mx_VideoFeed_mic_muted: this.state.audioMuted,
            mx_VideoFeed_mic_unmuted: !this.state.audioMuted,
        });

        let micIcon;
        if (feed.purpose !== SDPStreamMetadataPurpose.Screenshare && !primary && !pipMode) {
            micIcon = <div className={micIconClasses} />;
        }

        let content;
        if (this.state.videoMuted) {
            const callRoomId = LegacyCallHandler.instance.roomIdForCall(this.props.call);
            const callRoom = (callRoomId ? MatrixClientPeg.get().getRoom(callRoomId) : undefined) ?? undefined;

            let avatarSize;
            if (pipMode && primary) avatarSize = 76;
            else if (pipMode && !primary) avatarSize = 16;
            else if (!pipMode && primary) avatarSize = 160;
            else; // TBD

            content = <RoomAvatar room={callRoom} height={avatarSize} width={avatarSize} />;
        } else {
            const videoClasses = classnames("mx_VideoFeed_video", {
                mx_VideoFeed_video_mirror:
                    this.props.feed.isLocal() &&
                    this.props.feed.purpose === SDPStreamMetadataPurpose.Usermedia &&
                    SettingsStore.getValue("VideoView.flipVideoHorizontally"),
            });

            content = <video className={videoClasses} ref={this.setElementRef} />;
        }

        return (
            <div className={wrapperClasses}>
                {micIcon}
                {content}
            </div>
        );
    }
}
