/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019, 2021 The Matrix.org Foundation C.I.C.

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

import React, { FC, useState, useMemo, useCallback, useEffect, useRef, useContext } from "react";
import classNames from "classnames";
import { set, throttle } from "lodash";
import { Select } from "antd";
const { Option } = Select;
import { Icon as CaretIcon } from "../../../../res/img/feather-customised/dropdown-arrow.svg";
import QRCode from "../elements/QRCode";
import Autocompleter, { IProviderCompletions } from "../../../autocomplete/Autocompleter";
import { TooltipOption } from "../dialogs/spotlight/TooltipOption";
import axios from "axios";
import { copyPlaintext } from "../../../utils/strings";
import { Tabs, Tab, TabList, TabPanel } from "react-tabs";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { CallType } from "matrix-js-sdk/src/webrtc/call";
import { ISearchResults } from "matrix-js-sdk/src/@types/search";
import type { MatrixEvent } from "matrix-js-sdk/src/models/event";
import type { Room } from "matrix-js-sdk/src/models/room";
import { _t } from "../../../languageHandler";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { UserTab } from "../dialogs/UserTab";
import SettingsStore from "../../../settings/SettingsStore";
import CustomSelect from "./CustomSelect";
import RoomHeaderButtons from "../right_panel/RoomHeaderButtons";
import E2EIcon from "./E2EIcon";
import DecoratedRoomAvatar from "../avatars/DecoratedRoomAvatar";
import AccessibleButton, { ButtonEvent } from "../elements/AccessibleButton";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import { WHATSAPP, VIDEO_CALL, VOICE_CALL } from "../../../FeaturesConstant";
import { QrReader } from "react-qr-reader"; // make sure the library import is correct
import RoomTopic from "../elements/RoomTopic";
import { isComponentEnabled } from "../../../service";
import RoomName from "../elements/RoomName";
import { E2EStatus } from "../../../utils/ShieldUtils";
import { IOOBData } from "../../../stores/ThreepidInviteStore";
import { SearchScope } from "./SearchBar";
import { aboveLeftOf, ContextMenuTooltipButton, useContextMenu } from "../../structures/ContextMenu";
import RoomContextMenu from "../context_menus/RoomContextMenu";
import { contextMenuBelow } from "./RoomTile";
import { RoomNotificationStateStore } from "../../../stores/notifications/RoomNotificationStateStore";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import { NotificationStateEvents } from "../../../stores/notifications/NotificationState";
import RoomContext from "../../../contexts/RoomContext";
import RoomLiveShareWarning from "../beacon/RoomLiveShareWarning";
import { BetaPill } from "../beta/BetaCard";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import { isVideoRoom as calcIsVideoRoom } from "../../../utils/video-rooms";
import LegacyCallHandler, { LegacyCallHandlerEvent } from "../../../LegacyCallHandler";
import { useFeatureEnabled, useSettingValue } from "../../../hooks/useSettings";
import SdkConfig from "../../../SdkConfig";
import { useEventEmitterState, useTypedEventEmitterState } from "../../../hooks/useEventEmitter";
import { useWidgets } from "../right_panel/RoomSummaryCard";
import { WidgetType } from "../../../widgets/WidgetType";
import { useCall, useLayout } from "../../../hooks/useCall";
import { getJoinedNonFunctionalMembers } from "../../../utils/room/getJoinedNonFunctionalMembers";
import { Call, ElementCall, Layout } from "../../../models/Call";
import IconizedContextMenu, {
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
    IconizedContextMenuRadio,
} from "../context_menus/IconizedContextMenu";
import { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { GroupCallDuration } from "../voip/CallDuration";
import { Alignment } from "../elements/Tooltip";
import RoomCallBanner from "../beacon/RoomCallBanner";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";
import { getTopic } from "../../../hooks/room/useTopic";
class DisabledWithReason {
    public constructor(public readonly reason: string) {}
}

interface VoiceCallButtonProps {
    room: Room;
    busy: boolean;
    setBusy: (value: boolean) => void;
    behavior: DisabledWithReason | "legacy_or_jitsi";
}

/**
 * Button for starting voice calls, supporting only legacy 1:1 calls and Jitsi
 * widgets.
 */
const VoiceCallButton: FC<VoiceCallButtonProps> = ({ room, busy, setBusy, behavior }) => {
    const [enabled, setEnabled] = useState(false);
    const { onClick, tooltip, disabled } = useMemo(() => {
        if (behavior instanceof DisabledWithReason) {
            return {
                onClick: () => {},
                tooltip: behavior.reason,
                disabled: true,
            };
        } else {
            // behavior === "legacy_or_jitsi"
            return {
                onClick: async (ev: ButtonEvent): Promise<void> => {
                    ev.preventDefault();
                    setBusy(true);
                    await LegacyCallHandler.instance.placeCall(room.roomId, CallType.Voice);
                    setBusy(false);
                },
                disabled: false,
            };
        }
    }, [behavior, room, setBusy]);

    useEffect(() => {
        const getResult = async () => {
            let result = await isComponentEnabled(VOICE_CALL);
            setEnabled(result);
        };
        getResult();
    }, []);
    return (
        <AccessibleTooltipButton
            className="mx_RoomHeader_button mx_RoomHeader_voiceCallButton"
            onClick={onClick}
            title={_t("Voice call")}
            tooltip={!enabled ? "You don't have Voice Memo nft" : tooltip ?? _t("Voice call")}
            alignment={Alignment.Bottom}
            disabled={disabled || busy || !enabled}
        />
    );
};

interface VideoCallButtonProps {
    room: Room;
    busy: boolean;
    setBusy: (value: boolean) => void;
    behavior: DisabledWithReason | "legacy_or_jitsi" | "element" | "jitsi_or_element";
}

export const QRCodeScanner = ({ setShowQRScanner, setScannedData }) => {
    // Handle the result callback with a function
    const handleResult = (result, error) => {
        if (!!result) {
            setScannedData(result?.text); // or just result if it's already a string
            setShowQRScanner(false);
        }

        if (!!error) {
            console.error(error);
        }
    };
    const constraints = {
        facingMode: "environment", // Use the environment-facing camera
    };

    return (
        <>
            <div
                style={{ width: "500px", position: "fixed", top: "15%", right: "30%", zIndex: 100 }}
                className="qrCodePrompt mx_dialog"
            >
                <AccessibleButton
                    className="mx_SearchBar_cancel_my"
                    onClick={() => setShowQRScanner((pre) => !pre)}
                    aria-label={_t("Cancel")}
                ></AccessibleButton>
                <h2 style={{ textAlign: "center" }}>Place your QR here</h2>
                <QrReader
                    constraints={constraints} // Add the constraints prop here
                    onResult={handleResult} // Provide the handleResult function as the onResult prop
                />
            </div>
        </>
    );
};

/**
 * Button for starting video calls, supporting both legacy 1:1 calls, Jitsi
 * widgets, and native group calls. If multiple calling options are available,
 * this shows a menu to pick between them.
 */
const VideoCallButton: FC<VideoCallButtonProps> = ({ room, busy, setBusy, behavior }) => {
    const [menuOpen, buttonRef, openMenu, closeMenu] = useContextMenu();
    const [enabled, setEnabled] = useState(false);
    const startLegacyCall = useCallback(async (): Promise<void> => {
        setBusy(true);
        await LegacyCallHandler.instance.placeCall(room.roomId, CallType.Video);
        setBusy(false);
    }, [setBusy, room]);
    useEffect(() => {
        const getResult = async () => {
            let result = await isComponentEnabled(VIDEO_CALL);
            setEnabled(result);
        };
        getResult();
    }, []);
    const startElementCall = useCallback(() => {
        setBusy(true);
        defaultDispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: room.roomId,
            view_call: true,
            metricsTrigger: undefined,
        });
        setBusy(false);
    }, [setBusy, room]);
    const { onClick, tooltip, disabled } = useMemo(() => {
        if (behavior instanceof DisabledWithReason) {
            return {
                onClick: () => {},
                tooltip: behavior.reason,
                disabled: true,
            };
        } else if (behavior === "legacy_or_jitsi") {
            return {
                onClick: async (ev: ButtonEvent): Promise<void> => {
                    ev.preventDefault();
                    await startLegacyCall();
                },
                disabled: false,
            };
        } else if (behavior === "element") {
            return {
                onClick: async (ev: ButtonEvent): Promise<void> => {
                    ev.preventDefault();
                    startElementCall();
                },
                disabled: false,
            };
        } else {
            // behavior === "jitsi_or_element"
            return {
                onClick: async (ev: ButtonEvent): Promise<void> => {
                    ev.preventDefault();
                    openMenu();
                },
                disabled: false,
            };
        }
    }, [behavior, startLegacyCall, startElementCall, openMenu]);

    const onJitsiClick = useCallback(
        async (ev: ButtonEvent): Promise<void> => {
            ev.preventDefault();
            closeMenu();
            await startLegacyCall();
        },
        [closeMenu, startLegacyCall],
    );

    const onElementClick = useCallback(
        (ev: ButtonEvent) => {
            ev.preventDefault();
            closeMenu();
            startElementCall();
        },
        [closeMenu, startElementCall],
    );

    let menu: JSX.Element | null = null;
    if (menuOpen) {
        const buttonRect = buttonRef.current!.getBoundingClientRect();
        const brand = SdkConfig.get("element_call").brand;
        menu = (
            <IconizedContextMenu {...aboveLeftOf(buttonRect)} onFinished={closeMenu}>
                <IconizedContextMenuOptionList>
                    <IconizedContextMenuOption label={_t("Video call (Jitsi)")} onClick={onJitsiClick} />
                    <IconizedContextMenuOption
                        label={_t("Video call (%(brand)s)", { brand })}
                        onClick={onElementClick}
                    />
                </IconizedContextMenuOptionList>
            </IconizedContextMenu>
        );
    }

    return (
        <>
            <AccessibleTooltipButton
                inputRef={buttonRef}
                className="mx_RoomHeader_button mx_RoomHeader_videoCallButton"
                onClick={onClick}
                title={_t("Video call")}
                tooltip={!enabled ? "You don't have Video Chat nft" : tooltip ?? _t("Video call")}
                alignment={Alignment.Bottom}
                disabled={disabled || busy || !enabled}
            />
            {menu}
        </>
    );
};

interface CallButtonsProps {
    room: Room;
}

// The header buttons for placing calls have become stupidly complex, so here
// they are as a separate component
const CallButtons: FC<CallButtonsProps> = ({ room }) => {
    const [busy, setBusy] = useState(false);
    const showButtons = useSettingValue<boolean>("showCallButtonsInComposer");
    const groupCallsEnabled = useFeatureEnabled("feature_group_calls");
    const videoRoomsEnabled = useFeatureEnabled("feature_video_rooms");
    const isVideoRoom = useMemo(() => videoRoomsEnabled && calcIsVideoRoom(room), [videoRoomsEnabled, room]);
    const useElementCallExclusively = useMemo(() => {
        return SdkConfig.get("element_call").use_exclusively;
    }, []);

    const hasLegacyCall = useEventEmitterState(
        LegacyCallHandler.instance,
        LegacyCallHandlerEvent.CallsChanged,
        useCallback(() => LegacyCallHandler.instance.getCallForRoom(room.roomId) !== null, [room]),
    );

    const widgets = useWidgets(room);
    const hasJitsiWidget = useMemo(() => widgets.some((widget) => WidgetType.JITSI.matches(widget.type)), [widgets]);

    const hasGroupCall = useCall(room.roomId) !== null;

    const [functionalMembers, mayEditWidgets, mayCreateElementCalls] = useTypedEventEmitterState(
        room,
        RoomStateEvent.Update,
        useCallback(
            () => [
                getJoinedNonFunctionalMembers(room),
                room.currentState.mayClientSendStateEvent("im.vector.modular.widgets", room.client),
                room.currentState.mayClientSendStateEvent(ElementCall.CALL_EVENT_TYPE.name, room.client),
            ],
            [room],
        ),
    );

    const makeVoiceCallButton = (behavior: VoiceCallButtonProps["behavior"]): JSX.Element => (
        <VoiceCallButton room={room} busy={busy} setBusy={setBusy} behavior={behavior} />
    );
    const makeVideoCallButton = (behavior: VideoCallButtonProps["behavior"]): JSX.Element => (
        <VideoCallButton room={room} busy={busy} setBusy={setBusy} behavior={behavior} />
    );

    if (isVideoRoom || !showButtons) {
        return null;
    } else if (groupCallsEnabled) {
        if (useElementCallExclusively) {
            if (hasGroupCall) {
                return makeVideoCallButton(new DisabledWithReason(_t("Ongoing call")));
            } else if (mayCreateElementCalls) {
                return makeVideoCallButton("element");
            } else {
                return makeVideoCallButton(
                    new DisabledWithReason(_t("You do not have permission to start video calls")),
                );
            }
        } else if (hasLegacyCall || hasJitsiWidget || hasGroupCall) {
            return (
                <>
                    {makeVoiceCallButton(new DisabledWithReason(_t("Ongoing call")))}
                    {makeVideoCallButton(new DisabledWithReason(_t("Ongoing call")))}
                </>
            );
        } else if (functionalMembers.length <= 1) {
            return (
                <>
                    {makeVoiceCallButton(new DisabledWithReason(_t("There's no one here to call")))}
                    {makeVideoCallButton(new DisabledWithReason(_t("There's no one here to call")))}
                </>
            );
        } else if (functionalMembers.length === 2) {
            return (
                <>
                    {makeVoiceCallButton("legacy_or_jitsi")}
                    {makeVideoCallButton("legacy_or_jitsi")}
                </>
            );
        } else if (mayEditWidgets) {
            return (
                <>
                    {makeVoiceCallButton("legacy_or_jitsi")}
                    {makeVideoCallButton(mayCreateElementCalls ? "jitsi_or_element" : "legacy_or_jitsi")}
                </>
            );
        } else {
            const videoCallBehavior = mayCreateElementCalls
                ? "element"
                : new DisabledWithReason(_t("You do not have permission to start video calls"));
            return (
                <>
                    {makeVoiceCallButton(new DisabledWithReason(_t("You do not have permission to start voice calls")))}
                    {makeVideoCallButton(videoCallBehavior)}
                </>
            );
        }
    } else if (hasLegacyCall || hasJitsiWidget) {
        return (
            <>
                {makeVoiceCallButton(new DisabledWithReason(_t("Ongoing call")))}
                {makeVideoCallButton(new DisabledWithReason(_t("Ongoing call")))}
            </>
        );
    } else if (functionalMembers.length <= 1) {
        return (
            <>
                {makeVoiceCallButton(new DisabledWithReason(_t("There's no one here to call")))}
                {makeVideoCallButton(new DisabledWithReason(_t("There's no one here to call")))}
            </>
        );
    } else if (functionalMembers.length === 2 || mayEditWidgets) {
        return (
            <>
                {makeVoiceCallButton("legacy_or_jitsi")}
                {makeVideoCallButton("legacy_or_jitsi")}
            </>
        );
    } else {
        return (
            <>
                {makeVoiceCallButton(new DisabledWithReason(_t("You do not have permission to start voice calls")))}
                {makeVideoCallButton(new DisabledWithReason(_t("You do not have permission to start video calls")))}
            </>
        );
    }
};

const Xrp = (props) => {
    const [show, setShow] = useState(false);
    const [amount, setAmount] = useState(0);
    const [currency, setCurrency] = useState("XRP");
    const [tokens, setTokens] = useState([]);
    const [expanded, setExpanded] = useState(false);
    const [fee, setFee] = useState(0);
    const [flags, setFlags] = useState([]);
    const [calculatedFee, setCalculatedFee] = useState(0);
    const [destination, setDestination] = useState<string>("");
    const [tooltip, setTooltip] = useState(false);
    const [showQRScanner, setShowQRScanner] = useState(false);
    const [whichOne, setWhichOne] = useState(0);
    const [scannedData, setScannedData] = useState("");
    const [memos, setMemos] = useState([]);
    const [env, setEnv] = useState("");
    const [destinationTag, setDestinationTag] = useState<number | string>("");
    const [sourceTag, setSourceTag] = useState<number | string>("");
    const [gotWalletInfo, setGotWalletInfo] = useState(false);
    const [gotWalletInfoEnv, setGotWalletInfoEnv] = useState<string | any>("");
    const [memoId, setMemoId] = useState(0);
    const [value, setValue] = useState(0);
    const sliderRef = useRef(null); // Reference to the slider element
    const tooltipRef = useRef(null);
    let destinations: string[] = [];
    const [inviteLinkCopied, setInviteLinkCopied] = useState<boolean>(false);
    if (props.txnInfo.recievers) {
        props.txnInfo.recievers.forEach((reciever, i) => {
            destinations.push(reciever);
        });
    }
    function handleChange(value) {
        setFlags(value);
    }
    useEffect(() => {
        const getEnv = async () => {
            await axios
                .get(`${SdkConfig.get().backend_url}/get-all-env`)
                .then((res) =>
                    setEnv(
                        res.data[0].value === "xrplMain"
                            ? "mainnet"
                            : res.data[0].value === "xrplDev"
                            ? "devnet"
                            : "testnet",
                    ),
                );
        };
        getEnv();
        // verify-address
    }, []);
    useEffect(() => {
        if (props?.userWallet && !gotWalletInfo) {
            setGotWalletInfo(true);
            const walletStatus = async () => {
                await axios
                    .get(`${SdkConfig.get().backend_url}/verify-address-allEnv/${props?.userWallet.address}`)
                    .then((res) => {
                        setGotWalletInfoEnv(res.data);
                    });
            };
            walletStatus();
        }
    }, [props]);
    useEffect(() => {
        if (whichOne === 1) {
            setDestination(scannedData);
        }
    }, [scannedData]);
    useEffect(() => {
        if (props.txnInfo.userHoldings) {
            let holdings = new Set();
            props.txnInfo.userHoldings.forEach((element) => {
                holdings.add(element.currency);
            });
            setTokens([...holdings]);
        }
        if (props.appShown && props.buttonShown) {
            setShow(false);
        }
    }, [props]);
    const makeTxn = async () => {
        try {
            const res = await axios.post(`${SdkConfig.get("backend_url")}/accounts/makeTxn/${amount}`, {
                address: destination,
                currency,
                memos,
                fee: Number(calculatedFee) * 1000000,
                flags,
                sender: props.txnInfo.sender.address,
                DestinationTag: Number(destinationTag),
                SourceTag: Number(sourceTag),
            });
            setShow(false);
            window.open(res?.data?.data?.next?.always, "_blank");
        } catch (e) {
            console.error("ERROR handleBuyCredits", e);
        }
    };
    const getWebkitBackground = (value) => {
        // Calculate the percentage of the value in respect to the min and max values
        const percentage = (value / 100) * 100;
        // Generate gradient background with dynamic stopping point based on value
        return `-webkit-gradient(linear, left top, right top, color-stop(${percentage}%, #91d5ff), color-stop(${percentage}%, #ddd))`;
    };

    // Function to generate dynamic styles for the Mozilla slider thumb
    const getMozBackground = (value) => {
        // Calculate the percentage of the value in respect to the min and max values
        const percentage = (value / 100) * 100;
        // Generate gradient background with dynamic stopping point based on value
        return `linear-gradient(to right, #91d5ff ${percentage}%, #ddd ${percentage}%)`;
    };
    const styles = {
        background: getWebkitBackground(value), // For WebKit browsers
        // MozAppearance: "none", // For Mozilla browsers, hide the default appearance
        // WebkitAppearance: "none", // For WebKit browsers, hide the default appearance
        width: "100%", // Full-width slider
        height: "2px", // Height of the track
        outline: "none", // Remove the default focus outline
        padding: "0", // Remove default padding
        marginTop: "10px", // Provide some space above the slider
        cursor: "pointer", // Change cursor to pointer
    };
    function mapRange(value, low1, high1, low2, high2) {
        return low2 + ((high2 - low2) * (value - low1)) / (high1 - low1);
    }
    function adjustSlider(value) {
        // Map the linear slider to non-linear values
        let output;
        if (value <= 25) {
            // First 25%
            output = mapRange(value, 0, 25, 0.000015, 0.0001);
        } else if (value <= 50) {
            // Next 25%
            output = mapRange(value, 25, 50, 0.0001, 0.001);
        } else if (value <= 75) {
            // Next 25%
            output = mapRange(value, 50, 75, 0.001, 0.1);
        } else {
            // Last 25%
            output = mapRange(value, 75, 100, 0.1, 2.0);
        }
        return output.toFixed(6);
    }
    useEffect(() => {
        // Function to update tooltip position
        const updateTooltipPosition = () => {
            const slider = sliderRef.current;
            const tooltip = tooltipRef.current;
            if (slider && tooltip) {
                const percent = (value - slider.min) / (slider.max - slider.min);
                const thumbOffset = percent * (slider.clientWidth - 16); // Approximate thumb width
                tooltip.style.left = `${thumbOffset + 40}px`;
            }
        };
        updateTooltipPosition();
    }, [value, tooltip]);
    useEffect(() => {
        setCalculatedFee(adjustSlider(fee));
    }, [fee]);
    const handleInputChangeMy = (event) => {
        const inputValue = event.target.value;

        // Allow only numeric input
        const numericValue = inputValue.replace(/\D/g, "");

        return numericValue;
    };
    const options = ["No Direct Ripple", "Partial Payment", "Limit Quality"];
    const onAddMemo = () => {
        setMemos((pre) => [...pre, { id: memoId, text: "", format: "", type: "" }]);
        setMemoId((pre) => pre + 1);
    };
    const onTextChange = (event, memo) => {
        memo.text = event.target.value;
        setMemos((pre) => [...pre.map((m) => (m.id === memo.id ? memo : m))]);
    };
    const onFormatChange = (event, memo) => {
        memo.format = event.target.value;
        setMemos((pre) => [...pre.map((m) => (m.id === memo.id ? memo : m))]);
    };
    const onTypeChange = (event, memo) => {
        memo.type = event.target.value;
        setMemos((pre) => [...pre.map((m) => (m.id === memo.id ? memo : m))]);
    };
    return (
        <>
            {/* <div
                className="mx_RoomHeader_button_xrp"
                onClick={() => {
                    if (props.appShown && props.toggleFun) {
                        props.toggleFun();
                    }
                    setShow((pre) => !pre);
                }}
            ></div> */}
            <AccessibleTooltipButton
                className="mx_RoomHeader_button_xrp"
                onClick={() => {
                    if (props.appShown && props.toggleFun) {
                        props.toggleFun();
                    }
                    setShow((pre) => !pre);
                }}
                title={_t("XRP Widget")}
                //  Testnet.
                tooltip={
                    !Object.keys(props.txnInfo).length
                        ? `Your wallet address is currently active on the ${
                              gotWalletInfoEnv?.main?.active ? "mainnet ," : ""
                          } ${gotWalletInfoEnv?.test?.active ? "testnet ," : ""} ${
                              gotWalletInfoEnv?.dev?.active ? "devnet ," : ""
                          }. Please note that this is the XRPL Mainnet environment.`
                        : _t("XRP Widget")
                }
                alignment={Alignment.Bottom}
                disabled={!Object.keys(props.txnInfo).length}
            />
            {showQRScanner && <QRCodeScanner setScannedData={setScannedData} setShowQRScanner={setShowQRScanner} />}
            {show && (
                <div className="mx_Dialog mx_xrp_model">
                    <AccessibleButton
                        className="mx_SearchBar_cancel_my"
                        onClick={() => setShow((pre) => !pre)}
                        aria-label={_t("Cancel")}
                    ></AccessibleButton>
                    <div className="grid grid-cols-2 gap-4 my-8 ">
                        <Tabs>
                            <TabList>
                                <Tab>
                                    <img
                                        src={require("../../../../res/img/element-icons/upload2.svg").default}
                                        className="mx_xrp_receive"
                                        alt="send"
                                    />
                                    <span className="shift_little">Send</span>
                                </Tab>
                                <Tab>
                                    <img
                                        src={require("../../../../res/img/element-icons/download.svg").default}
                                        className="mx_xrp_receive"
                                        alt="receive"
                                    />
                                    <span className="shift_little">Receive</span>
                                </Tab>
                            </TabList>

                            <TabPanel>
                                <div className="mx_tab_div">
                                    <div>
                                        <label htmlFor="recieverAddresses">Destination : </label>
                                        <CustomSelect
                                            options={destinations}
                                            onChange={(value) => setDestination(value)}
                                            destinationPre={destination}
                                        />
                                        <span
                                            className="qrscan"
                                            onClick={() => {
                                                setShowQRScanner(!showQRScanner);
                                                setWhichOne(1);
                                            }}
                                        ></span>
                                    </div>
                                    {!destination ? <span style={{ color: "red" }}>destination require</span> : null}
                                    <div>
                                        <label htmlFor="recieverTag">Destination Tag : </label>
                                        <input
                                            className="mx_Field"
                                            type="text"
                                            style={{ width: "310px" }}
                                            id="recieverTag"
                                            value={destinationTag}
                                            onChange={(e) => setDestinationTag(handleInputChangeMy(e))}
                                            placeholder="(Optional) Enter the valid desatination tag 0 to 4,294,967,295"
                                        />
                                    </div>
                                    {Number(destinationTag) > 4294967295 ? (
                                        <span style={{ color: "red" }}>Invalid Input</span>
                                    ) : null}
                                    <div>
                                        <label htmlFor="recieverAddresses">Amount : </label>
                                        <select
                                            className="select_input2"
                                            name="recieverAddresses"
                                            id="recieverAddresses"
                                            onChange={(e) => setCurrency(e.target.value)}
                                        >
                                            {tokens.map((token, i) => (
                                                <option key={i} value={token}>
                                                    {token}
                                                </option>
                                            ))}
                                        </select>
                                        <span className="amount">
                                            Available:{" "}
                                            {
                                                props?.txnInfo?.userHoldings.filter(
                                                    (holding) => holding.currency === currency,
                                                )?.[0]?.value
                                            }
                                        </span>
                                        <input
                                            type="number"
                                            id="xrpAmount"
                                            className="select_input3"
                                            value={amount}
                                            onChange={(e) => setAmount(Number(e.target.value))}
                                        />
                                    </div>
                                    {amount <= 0 ? (
                                        <span style={{ color: "red" }}>Amount must not be Zero or less</span>
                                    ) : null}
                                    <div></div>
                                    <div>
                                        <AccessibleTooltipButton
                                            kind="icon"
                                            className={classNames("mx_DeviceExpandDetailsButton", {
                                                mx_DeviceExpandDetailsButton_expanded: expanded,
                                            })}
                                            onClick={() => setExpanded(!expanded)}
                                        >
                                            <CaretIcon className="mx_DeviceExpandDetailsButton_icon" />
                                        </AccessibleTooltipButton>
                                        <p
                                            style={{ width: "90%", cursor: "pointer" }}
                                            onClick={() => setExpanded(!expanded)}
                                        >
                                            {expanded ? "Show less" : "Show more"}
                                        </p>
                                    </div>
                                    {expanded && (
                                        <>
                                            <div>
                                                <label htmlFor="senderTag">Source Tag : </label>
                                                <input
                                                    className="mx_Field"
                                                    type="text"
                                                    style={{ width: "310px" }}
                                                    id="senderTag"
                                                    value={sourceTag}
                                                    onChange={(e) => setSourceTag(handleInputChangeMy(e))}
                                                    placeholder="(Optional) Enter the valid source tag 0 to 4,294,967,295"
                                                />
                                            </div>
                                            {Number(sourceTag) > 4294967295 ? (
                                                <span style={{ color: "red" }}>Invalid Input</span>
                                            ) : null}
                                            <div>
                                                <label htmlFor="Fee">Fee : </label>
                                                <input
                                                    className="mx_Field"
                                                    type="range"
                                                    ref={sliderRef}
                                                    onChange={(e) => {
                                                        setValue(Number(e.target.value));
                                                        setFee(Number(e.target.value));
                                                    }}
                                                    style={{
                                                        ...styles, // Adding the background for Mozilla using a template string for dynamic value
                                                        background: getMozBackground(value),
                                                        width: "250px",
                                                        marginLeft: "5px",
                                                        flexGrow: 4,
                                                    }}
                                                    id="Fee"
                                                    min={0}
                                                    max={100}
                                                    value={fee}
                                                    onMouseOver={() => setTooltip(true)}
                                                    onMouseLeave={() => setTooltip(false)}
                                                />
                                                {tooltip && (
                                                    <div
                                                        ref={tooltipRef}
                                                        className="tooltip"
                                                        style={{ position: "absolute", left: "30px" }}
                                                    >
                                                        {calculatedFee}
                                                    </div>
                                                )}
                                                <input
                                                    className="mx_Field"
                                                    type="text"
                                                    style={{ width: "70px" }}
                                                    id="feeAmount"
                                                    value={calculatedFee}
                                                    disabled
                                                />
                                            </div>
                                            <div id="inputCorrect">
                                                <label htmlFor="flags">Flags : </label>
                                                <Select
                                                    mode="multiple"
                                                    className="inputCorrect"
                                                    style={{
                                                        flexGrow: 1,
                                                        height: "40px",
                                                        marginLeft: "5px",
                                                        marginRight: "10px",
                                                    }}
                                                    placeholder="Select Flags"
                                                    onChange={handleChange}
                                                >
                                                    {options.map((option, i) => (
                                                        <Option key={i} value={option}>
                                                            {option}
                                                        </Option>
                                                    ))}
                                                </Select>
                                            </div>
                                            <div style={{ alignItems: "baseline" }}>
                                                <label htmlFor="memos">Memos : </label>
                                                <div className="memos">
                                                    {memos.map((memo) => (
                                                        <>
                                                            <div className="lastInput">
                                                                <textarea
                                                                    style={{ width: "100%", height: "75px" }}
                                                                    className="textarea123"
                                                                    onChange={(e) => {
                                                                        onTextChange(e, memo);
                                                                    }}
                                                                    value={memo.text}
                                                                    placeholder="(Optional) Enter you memo message"
                                                                ></textarea>
                                                            </div>
                                                            <div className="lastInput">
                                                                <label htmlFor="format" className="labelfomat">
                                                                    Format{" "}
                                                                </label>
                                                                <input
                                                                    className="inputoflast"
                                                                    style={{ width: "100%" }}
                                                                    onChange={(e) => {
                                                                        onFormatChange(e, memo);
                                                                    }}
                                                                    value={memo.format}
                                                                    placeholder="(Optional) Enter format"
                                                                ></input>
                                                            </div>
                                                            <div className="lastInput">
                                                                <label htmlFor="type" className="labelfomat">
                                                                    Type{" "}
                                                                </label>
                                                                <input
                                                                    style={{ flexGrow: 1 }}
                                                                    id="type"
                                                                    onChange={(e) => {
                                                                        onTypeChange(e, memo);
                                                                    }}
                                                                    className="inputoflast"
                                                                    value={memo.type}
                                                                    placeholder="(Optional) Enter type"
                                                                ></input>
                                                            </div>
                                                            <div style={{ width: "100%" }}>
                                                                <button
                                                                    style={{
                                                                        color: "#ff8989",
                                                                        border: "1px solid #ff8989",
                                                                        float: "right",
                                                                        padding: "5px",
                                                                        borderRadius: "0px",
                                                                    }}
                                                                    onClick={() => {
                                                                        setMemos((pre) =>
                                                                            pre.filter((m) => m.id !== memo.id),
                                                                        );
                                                                    }}
                                                                >
                                                                    Remove
                                                                </button>
                                                            </div>
                                                        </>
                                                    ))}
                                                    <div style={{ width: "100%", height: "40px", display: "flex" }}>
                                                        <button
                                                            style={{
                                                                float: "left",
                                                                padding: "5px",
                                                                borderRadius: "0px",
                                                                color: "grey",
                                                                border: "2px solid #d1d1d1",
                                                            }}
                                                            onClick={onAddMemo}
                                                        >
                                                            + Add Memo
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                    <button style={{ marginTop: "10px" }} onClick={makeTxn}>
                                        {`Send ${currency}`}
                                    </button>
                                </div>
                            </TabPanel>
                            <TabPanel>
                                <div className="mx_tab_div2">
                                    <QRCode
                                        data={[{ data: Buffer.from(props.txnInfo.sender.address ?? ""), mode: "byte" }]}
                                        className="mx_QRCode"
                                    />
                                    <div style={{ background: "#eeeeee", paddingInline: "9px", borderRadius: "5px" }}>
                                        <span>{props.txnInfo.sender.address}</span>
                                        <TooltipOption
                                            id="mx_SpotlightDialog_button_inviteLink"
                                            className="mx_SpotlightDialog_inviteLink"
                                            onClick={() => {
                                                setInviteLinkCopied(true);
                                                copyPlaintext(props.txnInfo.sender.address);
                                            }}
                                            onHideTooltip={() => setInviteLinkCopied(false)}
                                            title={inviteLinkCopied ? _t("Copied!") : _t("Copy")}
                                        >
                                            <img
                                                src={require("../../../../res/img/element-icons/copy.svg").default}
                                                className="mx_xrp_copy"
                                                alt="send"
                                            />
                                        </TooltipOption>
                                    </div>
                                    <span style={{ marginTop: "5px" }}>Scan Or Copy wallet address</span>
                                </div>
                            </TabPanel>
                        </Tabs>
                    </div>
                </div>
            )}
        </>
    );
};
const CreditBalance = ({ userId }) => {
    const [userData, setUserData] = useState<any>({});
    useEffect(() => {
        const getCredit = async () => {
            const { data: userInfo } = await axios.post(`${SdkConfig.get("backend_url")}/my-address`, {
                address: userId,
            });
            setUserData(userInfo);
        };
        const intervalId = setInterval(() => {
            getCredit();
            // This function will be executed at the specified interval
        }, 3000); // Interval is in milliseconds (1000ms = 1 second)

        // Clear the interval when the component unmounts
        return () => clearInterval(intervalId);
    }, []);
    return (
        <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}}>

<span style={{ marginInline: "5px" , fontSize:'10px'}}>mCredits</span>
            <span style={{ marginInline: "5px" }}>
                {userData?.user?.credit?.balance ? userData.user.credit.balance : null}
            </span>
        </div>
    );
};
interface CallLayoutSelectorProps {
    call: ElementCall;
}

const CallLayoutSelector: FC<CallLayoutSelectorProps> = ({ call }) => {
    const layout = useLayout(call);
    const [menuOpen, buttonRef, openMenu, closeMenu] = useContextMenu();

    const onClick = useCallback(
        (ev: ButtonEvent) => {
            ev.preventDefault();
            openMenu();
        },
        [openMenu],
    );

    const onFreedomClick = useCallback(
        (ev: ButtonEvent) => {
            ev.preventDefault();
            closeMenu();
            call.setLayout(Layout.Tile);
        },
        [closeMenu, call],
    );

    const onSpotlightClick = useCallback(
        (ev: ButtonEvent) => {
            ev.preventDefault();
            closeMenu();
            call.setLayout(Layout.Spotlight);
        },
        [closeMenu, call],
    );

    let menu: JSX.Element | null = null;
    if (menuOpen) {
        const buttonRect = buttonRef.current!.getBoundingClientRect();
        menu = (
            <IconizedContextMenu
                className="mx_RoomHeader_layoutMenu"
                {...aboveLeftOf(buttonRect)}
                onFinished={closeMenu}
            >
                <IconizedContextMenuOptionList>
                    <IconizedContextMenuRadio
                        iconClassName="mx_RoomHeader_freedomIcon"
                        label={_t("Freedom")}
                        active={layout === Layout.Tile}
                        onClick={onFreedomClick}
                    />
                    <IconizedContextMenuRadio
                        iconClassName="mx_RoomHeader_spotlightIcon"
                        label={_t("Spotlight")}
                        active={layout === Layout.Spotlight}
                        onClick={onSpotlightClick}
                    />
                </IconizedContextMenuOptionList>
            </IconizedContextMenu>
        );
    }

    return (
        <>
            <AccessibleTooltipButton
                inputRef={buttonRef}
                className={classNames("mx_RoomHeader_button", {
                    "mx_RoomHeader_layoutButton--freedom": layout === Layout.Tile,
                    "mx_RoomHeader_layoutButton--spotlight": layout === Layout.Spotlight,
                })}
                onClick={onClick}
                title={_t("Change layout")}
                alignment={Alignment.Bottom}
                key="layout"
            />
            {menu}
        </>
    );
};

export interface ISearchInfo {
    searchId: number;
    roomId?: string;
    term: string;
    scope: SearchScope;
    promise: Promise<ISearchResults>;
    abortController?: AbortController;

    inProgress?: boolean;
    count?: number;
}

export interface IProps {
    room: Room;
    oobData?: IOOBData;
    inRoom: boolean;
    onSearchClick: (() => void) | null;
    onInviteClick: (() => void) | null;
    onForgetClick: (() => void) | null;
    onAppsClick: (() => void) | null;
    e2eStatus: E2EStatus;
    appsShown: boolean;
    searchInfo?: ISearchInfo;
    excludedRightPanelPhaseButtons?: Array<RightPanelPhases>;
    showButtons?: boolean;
    enableRoomOptionsMenu?: boolean;
    viewingCall: boolean;
    activeCall: Call | null;
}

interface IState {
    contextMenuPosition?: DOMRect;
    rightPanelOpen: boolean;
    txnInfo: object;
    members: IProviderCompletions[];
    userWallet: string;
}
export interface IMemeber {
    completionId: string;
}

export default class RoomHeader extends React.Component<IProps, IState> {
    public static defaultProps: Partial<IProps> = {
        inRoom: false,
        excludedRightPanelPhaseButtons: [],
        showButtons: true,
        enableRoomOptionsMenu: true,
    };
    public static contextType = RoomContext;
    public context!: React.ContextType<typeof RoomContext>;
    private readonly client = this.props.room.client;
    txnInfo = {};
    public constructor(props: IProps, context: IState) {
        super(props, context);
        const notiStore = RoomNotificationStateStore.instance.getRoomState(props.room);
        notiStore.on(NotificationStateEvents.Update, this.onNotificationUpdate);
        this.state = {
            rightPanelOpen: RightPanelStore.instance.isOpen,
            txnInfo: {},
            members: [],
            userWallet: ``,
        };
    }

    public componentDidMount(): void {
        this.client.on(RoomStateEvent.Events, this.onRoomStateEvents);
        RightPanelStore.instance.on(UPDATE_EVENT, this.onRightPanelStoreUpdate);
        if (this.props.room) {
            const getAddress = async () => {
                let autocompleter = new Autocompleter(this.props.room);
                autocompleter
                    ?.getCompletions("@r", { beginning: true, end: 1, start: 1 }, false, 20)
                    .then((completions) => {
                        this.setState({ members: completions });
                    });
            };
            getAddress();
        }
    }
    componentDidUpdate(prevProps: Readonly<IProps>, prevState: Readonly<IState>, snapshot?: any): void {
        if (prevState.members !== this.state.members) {
            let members = [];
            let membersWithDisplayname = [];
            this.state?.members[0]?.completions.forEach((completion) => {
                members.push(completion.completionId);
                membersWithDisplayname.push({ userId: completion.completionId, displayName: completion.completion });
            });
            const getTxnInfo = async () => {
                let tranctionInfo = {};

                const { data: address1 } = await axios.post(`${SdkConfig.get("backend_url")}/my-address`, {
                    address: this.props.room.myUserId,
                });
                this.setState({ userWallet: address1 });
                const { data: address2 } = await axios.post(`${SdkConfig.get("backend_url")}/all-address`, {
                    addresses: members,
                });
                const { data: holdings } = await axios.get(
                    `${SdkConfig.get("backend_url")}/get-all-holding/${address1.address}`,
                );
                address2.newAddresses.forEach((element) => {
                    membersWithDisplayname.forEach((e) => {
                        if (element.userId === e.userId) {
                            element.displayName = e.displayName;
                        }
                    });
                });
                tranctionInfo["userHoldings"] = holdings;
                tranctionInfo["sender"] = address1;
                tranctionInfo["senderId"] = this.props.room.myUserId;
                tranctionInfo["recievers"] = address2.newAddresses.filter((reciever) => {
                    return reciever.userId !== this.props.room.myUserId;
                });
                this.setState({ txnInfo: tranctionInfo });
            };
            getTxnInfo();
        }
        if (prevProps !== this.props) {
            const getAddress = async () => {
                let autocompleter = new Autocompleter(this.props.room);
                autocompleter
                    ?.getCompletions("@r", { beginning: true, end: 1, start: 1 }, false, 20)
                    .then((completions) => {
                        this.setState({ members: completions });
                    });
            };
            getAddress();
        }
    }

    public componentWillUnmount(): void {
        this.client.removeListener(RoomStateEvent.Events, this.onRoomStateEvents);
        const notiStore = RoomNotificationStateStore.instance.getRoomState(this.props.room);
        notiStore.removeListener(NotificationStateEvents.Update, this.onNotificationUpdate);
        RightPanelStore.instance.off(UPDATE_EVENT, this.onRightPanelStoreUpdate);
    }

    private onRightPanelStoreUpdate = (): void => {
        this.setState({ rightPanelOpen: RightPanelStore.instance.isOpen });
    };

    private onRoomStateEvents = (event: MatrixEvent): void => {
        if (!this.props.room || event.getRoomId() !== this.props.room.roomId) {
            return;
        }

        // redisplay the room name, topic, etc.
        this.rateLimitedUpdate();
    };

    private onNotificationUpdate = (): void => {
        this.forceUpdate();
    };

    private rateLimitedUpdate = throttle(
        () => {
            this.forceUpdate();
        },
        500,
        { leading: true, trailing: true },
    );

    private onContextMenuOpenClick = (ev: ButtonEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        const target = ev.target as HTMLButtonElement;
        this.setState({ contextMenuPosition: target.getBoundingClientRect() });
    };

    private onContextMenuCloseClick = (): void => {
        this.setState({ contextMenuPosition: undefined });
    };

    private onHideCallClick = (ev: ButtonEvent): void => {
        ev.preventDefault();
        defaultDispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: this.props.room.roomId,
            view_call: false,
            metricsTrigger: undefined,
        });
    };

    private renderButtons(isVideoRoom: boolean): React.ReactNode {
        const startButtons: JSX.Element[] = [];
        if (this.props.room.myUserId) {
            startButtons.push(<CreditBalance userId={this.props.room.myUserId} />);
        }
        startButtons.push(
            <Xrp
                txnInfo={this.state.txnInfo}
                userWallet={this.state.userWallet}
                toggleFun={this.props.onAppsClick}
                appShown={this.props.appsShown}
                buttonShown={!this.props.viewingCall && this.props.onAppsClick}
            />,
        );
        if (!this.props.viewingCall && this.props.inRoom && !this.context.tombstone) {
            startButtons.push(<CallButtons key="calls" room={this.props.room} />);
        }

        if (this.props.viewingCall && this.props.activeCall instanceof ElementCall) {
            startButtons.push(<CallLayoutSelector key="layout" call={this.props.activeCall} />);
        }

        if (!this.props.viewingCall && this.props.onForgetClick) {
            startButtons.push(
                <AccessibleTooltipButton
                    className="mx_RoomHeader_button mx_RoomHeader_forgetButton"
                    onClick={this.props.onForgetClick}
                    title={_t("Forget room")}
                    alignment={Alignment.Bottom}
                    key="forget"
                />,
            );
        }
        if (!this.props.viewingCall && this.props.onAppsClick) {
            startButtons.push(
                <AccessibleTooltipButton
                    className={classNames("mx_RoomHeader_button mx_RoomHeader_appsButton", {
                        mx_RoomHeader_appsButton_highlight: this.props.appsShown,
                    })}
                    onClick={this.props.onAppsClick}
                    title={this.props.appsShown ? _t("Hide Widgets") : _t("Show Widgets")}
                    aria-checked={this.props.appsShown}
                    alignment={Alignment.Bottom}
                    key="apps"
                />,
            );
        }

        if (!this.props.viewingCall && this.props.onSearchClick && this.props.inRoom) {
            startButtons.push(
                <AccessibleTooltipButton
                    className="mx_RoomHeader_button mx_RoomHeader_searchButton"
                    onClick={this.props.onSearchClick}
                    title={_t("Search")}
                    alignment={Alignment.Bottom}
                    key="search"
                />,
            );
        }

        if (this.props.onInviteClick && (!this.props.viewingCall || isVideoRoom) && this.props.inRoom) {
            startButtons.push(
                <AccessibleTooltipButton
                    className="mx_RoomHeader_button mx_RoomHeader_inviteButton"
                    onClick={this.props.onInviteClick}
                    title={_t("Invite")}
                    alignment={Alignment.Bottom}
                    key="invite"
                />,
            );
        }

        const endButtons: JSX.Element[] = [];

        if (this.props.viewingCall && !isVideoRoom) {
            if (this.props.activeCall === null) {
                endButtons.push(
                    <AccessibleButton
                        className="mx_RoomHeader_button mx_RoomHeader_closeButton"
                        onClick={this.onHideCallClick}
                        title={_t("Close call")}
                        key="close"
                    />,
                );
            } else {
                endButtons.push(
                    <AccessibleTooltipButton
                        className="mx_RoomHeader_button mx_RoomHeader_minimiseButton"
                        onClick={this.onHideCallClick}
                        title={_t("View chat timeline")}
                        alignment={Alignment.Bottom}
                        key="minimise"
                    />,
                );
            }
        }

        return (
            <>
                {startButtons}
                <RoomHeaderButtons
                    room={this.props.room}
                    excludedRightPanelPhaseButtons={this.props.excludedRightPanelPhaseButtons}
                />
                {endButtons}
            </>
        );
    }

    private renderName(oobName: string): JSX.Element {
        let contextMenu: JSX.Element | null = null;
        if (this.state.contextMenuPosition && this.props.room) {
            contextMenu = (
                <RoomContextMenu
                    {...contextMenuBelow(this.state.contextMenuPosition)}
                    room={this.props.room}
                    onFinished={this.onContextMenuCloseClick}
                />
            );
        }

        // XXX: this is a bit inefficient - we could just compare room.name for 'Empty room'...
        let settingsHint = false;
        const members = this.props.room ? this.props.room.getJoinedMembers() : undefined;
        if (members) {
            if (members.length === 1 && members[0].userId === this.client.credentials.userId) {
                const nameEvent = this.props.room.currentState.getStateEvents("m.room.name", "");
                if (!nameEvent || !nameEvent.getContent().name) {
                    settingsHint = true;
                }
            }
        }

        const textClasses = classNames("mx_RoomHeader_nametext", { mx_RoomHeader_settingsHint: settingsHint });
        const roomName = (
            <RoomName room={this.props.room}>
                {(name) => {
                    const roomName = name || oobName;
                    return (
                        <div dir="auto" className={textClasses} title={roomName} role="heading" aria-level={1}>
                            {roomName}
                        </div>
                    );
                }}
            </RoomName>
        );

        if (this.props.enableRoomOptionsMenu && shouldShowComponent(UIComponent.RoomOptionsMenu)) {
            return (
                <ContextMenuTooltipButton
                    className="mx_RoomHeader_name"
                    onClick={this.onContextMenuOpenClick}
                    isExpanded={!!this.state.contextMenuPosition}
                    title={_t("Room options")}
                    alignment={Alignment.Bottom}
                >
                    {roomName}
                    {this.props.room && <div className="mx_RoomHeader_chevron" />}
                    {contextMenu}
                </ContextMenuTooltipButton>
            );
        }

        return <div className="mx_RoomHeader_name mx_RoomHeader_name--textonly">{roomName}</div>;
    }

    public render(): React.ReactNode {
        const isVideoRoom = SettingsStore.getValue("feature_video_rooms") && calcIsVideoRoom(this.props.room);
        let roomAvatar: JSX.Element | null = null;
        if (this.props.room) {
            roomAvatar = (
                <DecoratedRoomAvatar
                    room={this.props.room}
                    avatarSize={24}
                    oobData={this.props.oobData}
                    viewAvatarOnClick={true}
                />
            );
        }
        const icon = this.props.viewingCall ? (
            <div className="mx_RoomHeader_icon mx_RoomHeader_icon_video" />
        ) : this.props.e2eStatus ? (
            <E2EIcon className="mx_RoomHeader_icon" status={this.props.e2eStatus} tooltipAlignment={Alignment.Bottom} />
        ) : // If we're expecting an E2EE status to come in, but it hasn't
        // yet been loaded, insert a blank div to reserve space
        this.client.isRoomEncrypted(this.props.room.roomId) && this.client.isCryptoEnabled() ? (
            <div className="mx_RoomHeader_icon" />
        ) : null;

        const buttons = this.props.showButtons ? this.renderButtons(isVideoRoom) : null;

        let oobName = _t("Join Room");
        if (this.props.oobData && this.props.oobData.name) {
            oobName = this.props.oobData.name;
        }

        const name = this.renderName(oobName);

        if (this.props.viewingCall && !isVideoRoom) {
            return (
                <header className="mx_RoomHeader light-panel">
                    <div
                        className="mx_RoomHeader_wrapper"
                        aria-owns={this.state.rightPanelOpen ? "mx_RightPanel" : undefined}
                    >
                        <div className="mx_RoomHeader_avatar">{roomAvatar}</div>
                        {icon}
                        {name}
                        {this.props.activeCall instanceof ElementCall && (
                            <GroupCallDuration groupCall={this.props.activeCall.groupCall} />
                        )}
                        {/* Empty topic element to fill out space */}
                        <div className="mx_RoomHeader_topic" />
                        {buttons}
                    </div>
                </header>
            );
        }

        let searchStatus: JSX.Element | null = null;

        // don't display the search count until the search completes and
        // gives us a valid (possibly zero) searchCount.
        if (typeof this.props.searchInfo?.count === "number") {
            searchStatus = (
                <div className="mx_RoomHeader_searchStatus">
                    &nbsp;
                    {_t("(~%(count)s results)", { count: this.props.searchInfo.count })}
                </div>
            );
        }

        const topicElement = <RoomTopic room={this.props.room} className="mx_RoomHeader_topic" />;

        const viewLabs = (): void =>
            defaultDispatcher.dispatch({
                action: Action.ViewUserSettings,
                initialTabId: UserTab.Labs,
            });
        const betaPill = isVideoRoom ? (
            <BetaPill onClick={viewLabs} tooltipTitle={_t("Video rooms are a beta feature")} />
        ) : null;

        function openPanel() {
            const panel = document.getElementById("mobile_Panel");
            const closeBtn = document.getElementById("LeftPanel_closeBtn");
            panel.style.width = "80vw";
            panel.style.maxWidth = "80vw";
            closeBtn.style.display = "block";
        }

        return (
            <header className="mx_RoomHeader light-panel">
                <div
                    className="mx_RoomHeader_wrapper"
                    aria-owns={this.state.rightPanelOpen ? "mx_RightPanel" : undefined}
                >
                    <div className="LeftPanel_openBtn" onClick={openPanel}>
                        &#9776;
                    </div>
                    <div className="mx_RoomHeader_avatar">{roomAvatar}</div>
                    {icon}
                    {name}
                    {searchStatus}
                    {topicElement}
                    {betaPill}
                    {buttons}
                </div>
                {!isVideoRoom && <RoomCallBanner roomId={this.props.room.roomId} />}
                <RoomLiveShareWarning roomId={this.props.room.roomId} />
            </header>
        );
    }
}
