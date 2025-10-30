/*
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

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

import React, { ReactNode } from "react";
import classNames from "classnames";
import { logger } from "matrix-js-sdk/src/logger";
import { ISSOFlow, LoginFlow, SSOAction } from "matrix-js-sdk/src/@types/auth";
import Env from "../Env";
import { _t, _td, UserFriendlyError } from "../../../languageHandler";
import Login from "../../../Login";
import { messageForConnectionError, messageForLoginError } from "../../../utils/ErrorUtils";
import AutoDiscoveryUtils from "../../../utils/AutoDiscoveryUtils";
import AuthPage from "../../views/auth/AuthPage";
import PlatformPeg from "../../../PlatformPeg";
import SettingsStore from "../../../settings/SettingsStore";
import { UIFeature } from "../../../settings/UIFeature";
import { IMatrixClientCreds } from "../../../MatrixClientPeg";
import PasswordLogin from "../../views/auth/PasswordLogin";
import InlineSpinner from "../../views/elements/InlineSpinner";
import Spinner from "../../views/elements/Spinner";
import SSOButtons from "../../views/elements/SSOButtons";
import ServerPicker from "../../views/elements/ServerPicker";
import AuthBody from "../../views/auth/AuthBody";
import AuthHeader from "../../views/auth/AuthHeader";
import AccessibleButton, { ButtonEvent } from "../../views/elements/AccessibleButton";
import { ValidatedServerConfig } from "../../../utils/ValidatedServerConfig";
import { filterBoolean } from "../../../utils/arrays";
import SdkConfig from "../../../SdkConfig";

// Add to imports
import XamanLogin from "../../views/auth/XamanLogin";

// These are used in several places, and come from the js-sdk's autodiscovery
// stuff. We define them here so that they'll be picked up by i18n.
_td("Invalid homeserver discovery response");
_td("Failed to get autodiscovery configuration from server");
_td("Invalid base_url for m.homeserver");
_td("Homeserver URL does not appear to be a valid Matrix homeserver");
_td("Invalid identity server discovery response");
_td("Invalid base_url for m.identity_server");
_td("Identity server URL does not appear to be a valid identity server");
_td("General failure");

interface IProps {
    serverConfig: ValidatedServerConfig;
    // If true, the component will consider itself busy.
    busy?: boolean;
    isSyncing?: boolean;
    // Secondary HS which we try to log into if the user is using
    // the default HS but login fails. Useful for migrating to a
    // different homeserver without confusing users.
    fallbackHsUrl?: string;
    defaultDeviceDisplayName?: string;
    fragmentAfterLogin?: string;
    defaultUsername?: string;

    // Called when the user has logged in. Params:
    // - The object returned by the login API
    // - The user's password, if applicable, (may be cached in memory for a
    //   short time so the user is not required to re-enter their password
    //   for operations like uploading cross-signing keys).
    onLoggedIn(data: IMatrixClientCreds, password: string): void;

    // login shouldn't know or care how registration, password recovery, etc is done.
    onRegisterClick(): void;
    onForgotPasswordClick?(): void;
    onServerConfigChange(config: ValidatedServerConfig): void;
}

interface IState {
    busy: boolean;
    busyLoggingIn?: boolean;
    errorText?: ReactNode;
    loginIncorrect: boolean;
    // can we attempt to log in or are there validation errors?
    canTryLogin: boolean;

    flows?: LoginFlow[];
    loginView?: 'welcome' | 'default' | 'xaman';

    // used for preserving form values when changing homeserver
    username: string;
    phoneCountry: string;
    phoneNumber: string;

    // We perform liveliness checks later, but for now suppress the errors.
    // We also track the server dead errors independently of the regular errors so
    // that we can render it differently, and override any other error the user may
    // be seeing.
    serverIsAlive: boolean;
    serverErrorIsFatal: boolean;
    serverDeadError?: ReactNode;

    // QR code modal state for embedded wallet authentication
    showQrModal: boolean;
    qrCodeData?: {
        uuid: string;
        qrCodeImage: string;
        websocketUrl?: string;
    };
    correlationId?: string | null;
    qrStatus?: 'loading' | 'pending' | 'signed' | 'expired' | 'rejected' | 'error';
}

type OnPasswordLogin = {
    (username: string, phoneCountry: undefined, phoneNumber: undefined, password: string): Promise<void>;
    (username: undefined, phoneCountry: string, phoneNumber: string, password: string): Promise<void>;
};

/*
 * A wire component which glues together login UI components and Login logic
 */
export default class LoginComponent extends React.PureComponent<IProps, IState> {
    private unmounted = false;
    private loginLogic!: Login;

    private readonly stepRendererMap: Record<string, () => ReactNode>;

    public constructor(props: IProps) {
        super(props);

        this.state = {
            busy: false,
            errorText: null,
            loginIncorrect: false,
            canTryLogin: true,

            username: props.defaultUsername ? props.defaultUsername : "",
            phoneCountry: "",
            phoneNumber: "",

            serverIsAlive: true,
            serverErrorIsFatal: false,
            serverDeadError: "",
            loginView: 'welcome',
            
            // QR code modal state
            showQrModal: false,
            qrCodeData: undefined,
            qrStatus: undefined,
        };

        // map from login step type to a function which will render a control
        // letting you do that login type
        this.stepRendererMap = {
            "m.login.password": this.renderPasswordStep,

            // CAS and SSO are the same thing, modulo the url we link to
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "m.login.cas": () => this.renderSsoStep("cas"),
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "m.login.sso": () => this.renderSsoStep("sso"),
            // JWT login for XRPL wallets
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "org.matrix.login.jwt": () => null, // Handled separately in renderLoginComponentForFlows
        };
    }

    public componentDidMount(): void {
        this.initLoginLogic(this.props.serverConfig);
        
        // Check if user is returning from wallet connect service with JWT token
        this.handleWalletConnectReturn();
    }

    public componentWillUnmount(): void {
        this.unmounted = true;
        this.cleanup();
    }

    public componentDidUpdate(prevProps: IProps): void {
        if (
            prevProps.serverConfig.hsUrl !== this.props.serverConfig.hsUrl ||
            prevProps.serverConfig.isUrl !== this.props.serverConfig.isUrl
        ) {
            // Ensure that we end up actually logging in to the right place
            this.initLoginLogic(this.props.serverConfig);
        }
    }

    public isBusy = (): boolean => !!this.state.busy || !!this.props.busy;

    public onPasswordLogin: OnPasswordLogin = async (
        username: string | undefined,
        phoneCountry: string | undefined,
        phoneNumber: string | undefined,
        password: string,
    ): Promise<void> => {
        if (!this.state.serverIsAlive) {
            this.setState({ busy: true });
            // Do a quick liveliness check on the URLs
            let aliveAgain = true;
            try {
                await AutoDiscoveryUtils.validateServerConfigWithStaticUrls(
                    this.props.serverConfig.hsUrl,
                    this.props.serverConfig.isUrl,
                );
                this.setState({ serverIsAlive: true, errorText: "" });
            } catch (e) {
                const componentState = AutoDiscoveryUtils.authComponentStateForError(e);
                this.setState({
                    busy: false,
                    busyLoggingIn: false,
                    ...componentState,
                });
                aliveAgain = !componentState.serverErrorIsFatal;
            }

            // Prevent people from submitting their password when something isn't right.
            if (!aliveAgain) {
                return;
            }
        }

        this.setState({
            busy: true,
            busyLoggingIn: true,
            errorText: null,
            loginIncorrect: false,
        });

        this.loginLogic.loginViaPassword(username, phoneCountry, phoneNumber, password).then(
            (data) => {
                this.setState({ serverIsAlive: true }); // it must be, we logged in.
                this.props.onLoggedIn(data, password);
            },
            (error) => {
                if (this.unmounted) return;

                let errorText: ReactNode;
                // Some error strings only apply for logging in
                if (error.httpStatus === 400 && username && username.indexOf("@") > 0) {
                    errorText = _t("This homeserver does not support login using email address.");
                } else {
                    errorText = messageForLoginError(error, this.props.serverConfig);
                }

                this.setState({
                    busy: false,
                    busyLoggingIn: false,
                    errorText,
                    // 401 would be the sensible status code for 'incorrect password'
                    // but the login API gives a 403 https://matrix.org/jira/browse/SYN-744
                    // mentions this (although the bug is for UI auth which is not this)
                    // We treat both as an incorrect password
                    loginIncorrect: error.httpStatus === 401 || error.httpStatus === 403,
                });
            },
        );
    };

    public onUsernameChanged = (username: string): void => {
        this.setState({ username });
    };

    public onUsernameBlur = async (username: string): Promise<void> => {
        const doWellknownLookup = username[0] === "@";
        this.setState({
            username: username,
            busy: doWellknownLookup,
            errorText: null,
            canTryLogin: true,
        });
        if (doWellknownLookup) {
            const serverName = username.split(":").slice(1).join(":");
            try {
                const result = await AutoDiscoveryUtils.validateServerName(serverName);
                this.props.onServerConfigChange(result);
                // We'd like to rely on new props coming in via `onServerConfigChange`
                // so that we know the servers have definitely updated before clearing
                // the busy state. In the case of a full MXID that resolves to the same
                // HS as Element's default HS though, there may not be any server change.
                // To avoid this trap, we clear busy here. For cases where the server
                // actually has changed, `initLoginLogic` will be called and manages
                // busy state for its own liveness check.
                this.setState({
                    busy: false,
                });
            } catch (e) {
                logger.error("Problem parsing URL or unhandled error doing .well-known discovery:", e);

                let message = _t("Failed to perform homeserver discovery");
                if (e instanceof UserFriendlyError && e.translatedMessage) {
                    message = e.translatedMessage;
                }

                let errorText: ReactNode = message;
                let discoveryState = {};
                if (AutoDiscoveryUtils.isLivelinessError(e)) {
                    errorText = this.state.errorText;
                    discoveryState = AutoDiscoveryUtils.authComponentStateForError(e);
                }

                this.setState({
                    busy: false,
                    errorText,
                    ...discoveryState,
                });
            }
        }
    };

    public onPhoneCountryChanged = (phoneCountry: string): void => {
        this.setState({ phoneCountry });
    };

    public onPhoneNumberChanged = (phoneNumber: string): void => {
        this.setState({ phoneNumber });
    };

    public onRegisterClick = (ev: ButtonEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        this.props.onRegisterClick();
    };

    public onTryRegisterClick = (ev: ButtonEvent): void => {
        const hasPasswordFlow = this.state.flows?.find((flow) => flow.type === "m.login.password");
        const ssoFlow = this.state.flows?.find((flow) => flow.type === "m.login.sso" || flow.type === "m.login.cas");
        // If has no password flow but an SSO flow guess that the user wants to register with SSO.
        // TODO: instead hide the Register button if registration is disabled by checking with the server,
        // has no specific errCode currently and uses M_FORBIDDEN.
        if (ssoFlow && !hasPasswordFlow) {
            ev.preventDefault();
            ev.stopPropagation();
            const ssoKind = ssoFlow.type === "m.login.sso" ? "sso" : "cas";
            PlatformPeg.get()?.startSingleSignOn(
                this.loginLogic.createTemporaryClient(),
                ssoKind,
                this.props.fragmentAfterLogin,
                undefined,
                SSOAction.REGISTER,
            );
        } else {
            // Don't intercept - just go through to the register page
            this.onRegisterClick(ev);
        }
    };

    private async initLoginLogic({ hsUrl, isUrl }: ValidatedServerConfig): Promise<void> {
        let isDefaultServer = false;
        if (
            this.props.serverConfig.isDefault &&
            hsUrl === this.props.serverConfig.hsUrl &&
            isUrl === this.props.serverConfig.isUrl
        ) {
            isDefaultServer = true;
        }

        const fallbackHsUrl = isDefaultServer ? this.props.fallbackHsUrl! : null;

        const loginLogic = new Login(hsUrl, isUrl, fallbackHsUrl, {
            defaultDeviceDisplayName: this.props.defaultDeviceDisplayName,
        });
        this.loginLogic = loginLogic;

        this.setState({
            busy: true,
            loginIncorrect: false,
        });

        // Do a quick liveliness check on the URLs
        try {
            const { warning } = await AutoDiscoveryUtils.validateServerConfigWithStaticUrls(hsUrl, isUrl);
            if (warning) {
                this.setState({
                    ...AutoDiscoveryUtils.authComponentStateForError(warning),
                    errorText: "",
                });
            } else {
                this.setState({
                    serverIsAlive: true,
                    errorText: "",
                });
            }
        } catch (e) {
            this.setState({
                busy: false,
                ...AutoDiscoveryUtils.authComponentStateForError(e),
            });
        }

        loginLogic
            .getFlows()
            .then(
                (flows) => {
                    // look for a flow where we understand all of the steps.
                    const supportedFlows = flows.filter(this.isSupportedFlow);

                    if (supportedFlows.length > 0) {
                        this.setState({
                            flows: supportedFlows,
                        });
                        return;
                    }

                    // we got to the end of the list without finding a suitable flow.
                    this.setState({
                        errorText: _t(
                            "This homeserver doesn't offer any login flows which are supported by this client.",
                        ),
                    });
                },
                (err) => {
                    this.setState({
                        errorText: messageForConnectionError(err, this.props.serverConfig),
                        loginIncorrect: false,
                        canTryLogin: false,
                    });
                },
            )
            .finally(() => {
                this.setState({
                    busy: false,
                });
            });
    }

    private isSupportedFlow = (flow: LoginFlow): boolean => {
        // technically the flow can have multiple steps, but no one does this
        // for login and loginLogic doesn't support it so we can ignore it.
        if (!this.stepRendererMap[flow.type]) {
            logger.log("Skipping flow", flow, "due to unsupported login type", flow.type);
            return false;
        }
        return true;
    };

    // Xaman login success callback
    private onLoginSuccess = (loginResponse: any): void => {
        // Handle successful login from Xaman
        this.props.onLoggedIn(loginResponse, ""); // No password for wallet login
    };

    // Xaman login cancel callback
    private onXamanCancel = (): void => {
        this.setState({ loginView: 'welcome' });
    };

    // Navigate to traditional login
    private onTraditionalLogin = (): void => {
        this.setState({ loginView: 'default' });
    };
    // Show embedded QR code for wallet authentication (no redirect)
    private onWalletConnect = async (walletType: string = 'xumm'): Promise<void> => {
        try {
            console.log('🎯 Initiating embedded wallet authentication...');
            
            this.setState({ 
                showQrModal: true, 
                qrStatus: 'loading',
                errorText: null 
            });

            // Get wallet connect URL - Use Apache proxy to wallet service
            const walletConnectUrl = `${window.location.origin}/wallet-api`;
            
            console.log('🔗 Wallet Connect URL:', walletConnectUrl);
            
            // Call API to get QR code data
            const response = await fetch(`${walletConnectUrl}/api/matrix/qr-init`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    redirectUrl: window.location.origin,
                    clientType: 'textrp-matrix-sdk'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to initialize QR code');
            }

            const data = await response.json();
            console.log('✅ QR code data received:', { uuid: data.uuid });

            // Update state with QR code data
            this.setState({
                qrCodeData: {
                    uuid: data.uuid,
                    qrCodeImage: data.qrCodeImage,
                    websocketUrl: data.websocketUrl
                },
                // store correlation id if present
                // the server now attaches a correlation id to the session
                // we'll keep it here to include in subsequent requests
                // so logs can be correlated end-to-end
                correlationId: data.correlation_id || null,
                qrStatus: 'pending'
            });

            // Start listening for signature
            this.listenForSignature(data.uuid, data.websocketUrl, walletConnectUrl);

        } catch (error) {
            console.error('❌ QR initialization error:', error);
            this.setState({
                showQrModal: false,
                qrStatus: 'error',
                errorText: _t('Failed to initialize wallet authentication. Please try again.')
            });
        }
    };

    // Listen for user signature via WebSocket and polling
    private pollInterval?: NodeJS.Timeout;
    private websocket?: WebSocket;

    private listenForSignature = (uuid: string, websocketUrl: string | undefined, walletConnectUrl: string): void => {
        console.log('👂 Starting to listen for signature...', { uuid, hasWebSocket: !!websocketUrl });

        // Option 1: Try WebSocket for real-time updates (if available)
        if (websocketUrl) {
            try {
                this.websocket = new WebSocket(websocketUrl);
                
                this.websocket.onopen = () => {
                    console.log('🔌 WebSocket connected');
                };

                this.websocket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        console.log('📨 WebSocket message:', data);
                        
                        if (data.signed === true || data.payload_uuidv4) {
                            console.log('🎉 Signature detected via WebSocket!');
                            this.handleSignatureComplete(uuid, walletConnectUrl);
                        } else if (data.expired || data.cancelled) {
                            console.log('⏰ QR code expired or cancelled');
                            this.setState({ qrStatus: data.expired ? 'expired' : 'rejected' });
                            this.cleanup();
                        }
                    } catch (err) {
                        console.error('❌ WebSocket message parse error:', err);
                    }
                };

                this.websocket.onerror = (error) => {
                    console.error('❌ WebSocket error:', error);
                    // Fallback to polling
                };

                this.websocket.onclose = () => {
                    console.log('🔌 WebSocket closed');
                };
            } catch (err) {
                console.error('❌ WebSocket connection failed:', err);
            }
        }

        // Option 2: Polling fallback (always run as backup)
    this.pollInterval = setInterval(async () => {
            try {
        // include correlation id if we have one to aid tracing in server logs
        const correlationParam = (this as any).state?.correlationId ? `&correlation_id=${encodeURIComponent((this as any).state.correlationId)}` : '';
        const response = await fetch(`${walletConnectUrl}/api/matrix/qr-status?uuid=${uuid}${correlationParam}`);
        const data = await response.json();

        console.log('🔄 Poll status:', data.status, 'correlation=', (this as any).state?.correlationId || data.correlation_id || null);

                if (data.status === 'signed') {
                    console.log('🎉 Signature detected via polling!');
                    this.handleSignatureComplete(uuid, walletConnectUrl);
                } else if (data.status === 'expired') {
                    this.setState({ qrStatus: 'expired' });
                    this.cleanup();
                } else if (data.status === 'rejected') {
                    this.setState({ qrStatus: 'rejected' });
                    this.cleanup();
                }
            } catch (error) {
                console.error('❌ Polling error:', error);
            }
        }, 2000); // Poll every 2 seconds
    };

    private handleSignatureComplete = async (uuid: string, walletConnectUrl: string): Promise<void> => {
        try {
            // Cleanup listeners
            this.cleanup();

            this.setState({ qrStatus: 'signed' });

            // Fetch the authentication data (JWT or access token)
            const response = await fetch(`${walletConnectUrl}/api/matrix/qr-status?uuid=${uuid}`);
                const data = await response.json();

            console.log('🔐 Authentication data received, method:', data.method, 'correlation=', data.correlation_id || (this as any).state?.correlationId || null);

            // Close modal
            this.setState({ showQrModal: false });

            if (data.method === 'jwt') {
                // New user - use JWT autocreate login
                if (data.token && data.homeserver) {
                    console.log('✅ JWT token received for new user, logging in...');
                    await this.attemptJWTLogin(data.token, data.homeserver, data.user_id);
                } else {
                    throw new Error('JWT token not available');
                }
            } else if (data.method === 'direct') {
                // Existing user - use direct access token login
                if (data.access_token && data.homeserver && data.user_id) {
                    console.log('✅ Access token received for existing user, logging in...');
                    await this.attemptDirectLogin(data.access_token, data.homeserver, data.user_id, data.device_id);
                } else {
                    throw new Error('Access token not available');
                }
            } else {
                throw new Error('Unknown authentication method: ' + data.method);
            }
        } catch (error) {
            console.error('❌ Login error:', error);
            this.setState({
                showQrModal: false,
                qrStatus: 'error',
                errorText: _t('Authentication failed. Please try again.')
            });
        }
    };

    private cleanup = (): void => {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = undefined;
        }
        if (this.websocket) {
            this.websocket.close();
            this.websocket = undefined;
        }
    };

    private closeQrModal = (): void => {
        this.cleanup();
        this.setState({
            showQrModal: false,
            qrCodeData: undefined,
            qrStatus: undefined
        });
    };

    // Handle return from wallet connect service with JWT token
    private handleWalletConnectReturn = (): void => {
        console.log("🔵🔵🔵 ========== WALLET CONNECT RETURN ========== 🔵🔵🔵");
        console.log("🔵 Current URL:", window.location.href);
        console.log("🔵 URL search params:", window.location.search);
        
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const userId = urlParams.get('user_id');
        const homeserver = urlParams.get('homeserver');

        console.log("🔵 Extracted token:", token ? `${token.substring(0, 50)}...` : "NULL");
        console.log("🔵 Extracted userId:", userId);
        console.log("🔵 Extracted homeserver:", homeserver);
        console.log("🔵 Current serverConfig:", this.props.serverConfig);
        console.log("🔵🔵🔵 ============================================== 🔵🔵🔵");
        
        if (token && userId && homeserver) {
            console.log("🟢🟢🟢 All params present, proceeding with JWT login");
            
            // Clear URL parameters
            const newUrl = window.location.origin + window.location.pathname;
            console.log("🟢 Clearing URL parameters, new URL:", newUrl);
            window.history.replaceState({}, document.title, newUrl);
            
            // Perform JWT login
            this.attemptJWTLogin(token, homeserver);
        } else {
            console.log("🔴🔴🔴 Missing required params, skipping wallet connect return handling");
        }
    };

    // Attempt login with JWT token
    private attemptJWTLogin = async (token: string, homeserver: string, userId?: string): Promise<void> => {
        console.log("🟡🟡🟡 ========== JWT LOGIN ATTEMPT ========== 🟡🟡🟡");
        console.log("🟡 Token (first 50 chars):", token.substring(0, 50));
        console.log("🟡 Homeserver parameter:", homeserver);
        console.log('🟡 Correlation ID:', (this as any).state?.correlationId || null);

        // Create a new Login instance with the correct homeserver URL from the token
        const jwtLoginLogic = new Login(homeserver, null, null, {
            defaultDeviceDisplayName: this.props.defaultDeviceDisplayName,
        });

        console.log("🟡 Created new Login instance with homeserver:", homeserver);

        this.setState({
            busy: true,
            loginIncorrect: false,
        });

        try {
            console.log("🟡 Calling jwtLoginLogic.loginViaJWT... correlation=", (this as any).state?.correlationId || null);
            const credentials = await jwtLoginLogic.loginViaJWT(token);
            console.log("🟢🟢🟢 ========== JWT LOGIN SUCCESS ========== 🟢🟢🟢");
            console.log("🟢 Credentials object:", credentials);
            console.log("🟢 Credentials.homeserverUrl:", credentials.homeserverUrl);
            console.log("🟢 Credentials.userId:", credentials.userId);
            console.log("🟢 Credentials.deviceId:", credentials.deviceId);
            console.log("🟢 Credentials.accessToken (first 20 chars):", credentials.accessToken?.substring(0, 20));
            console.log("🟢 Calling onLoggedIn with these credentials...");
            console.log("🟢🟢🟢 ============================================== 🟢🟢🟢");
            this.props.onLoggedIn(credentials, ""); // Empty password for wallet login
        } catch (error) {
            console.error("🔴🔴🔴 ========== JWT LOGIN FAILED ========== 🔴🔴🔴");
            console.error("🔴 Error:", error);
            console.error("🔴 Error message:", error instanceof Error ? error.message : "Unknown error");
            console.error("🔴 Error stack:", error instanceof Error ? error.stack : "No stack trace");
            console.error("🔴🔴🔴 ========================================== 🔴🔴🔴");
            this.setState({
                busy: false,
                loginIncorrect: true,
                errorText: error instanceof Error ? error.message : "JWT login failed",
            });
        }
    };

    private attemptDirectLogin = async (accessToken: string, homeserver: string, userId: string, deviceId?: string): Promise<void> => {
        console.log("🟢🟢🟢 ========== DIRECT LOGIN ATTEMPT (Existing User) ========== 🟢🟢🟢");
        console.log("🟢 Access Token (first 20 chars):", accessToken.substring(0, 20));
        console.log("🟢 Homeserver:", homeserver);
        console.log("🟢 User ID:", userId);
        console.log("🟢 Device ID:", deviceId);

        this.setState({
            busy: true,
            loginIncorrect: false,
        });

        try {
            // Directly construct credentials object for existing user
            const credentials = {
                homeserverUrl: homeserver,
                identityServerUrl: null,
                userId: userId,
                deviceId: deviceId || 'XRPL_WALLET',
                accessToken: accessToken,
            };

            console.log("🟢 Credentials constructed:", credentials);
            console.log("🟢 Calling onLoggedIn with direct credentials...");
            
            this.props.onLoggedIn(credentials, ""); // Empty password for wallet login
            
            console.log("🟢🟢🟢 ========== DIRECT LOGIN SUCCESS ========== 🟢🟢🟢");
        } catch (error) {
            console.error("🔴🔴🔴 ========== DIRECT LOGIN FAILED ========== 🔴🔴🔴");
            console.error("🔴 Error:", error);
            console.error("🔴 Error message:", error instanceof Error ? error.message : "Unknown error");
            console.error("🔴🔴🔴 ============================================== 🔴🔴🔴");
            this.setState({
                busy: false,
                loginIncorrect: true,
                errorText: error instanceof Error ? error.message : "Direct login failed",
            });
        }
    };

    // Render welcome page inline - WALLET ONLY LOGIN
    private renderWelcomePage = (): JSX.Element => {
        const brandingConfig = SdkConfig.getObject("branding");
        const logoUrl = brandingConfig?.get("auth_header_logo_url") ?? "themes/textrp/img/logos/textrp-logo.svg";
        
        return (
            <div className="mx_Welcome">
                <img src={logoUrl} alt="TextRP" className="logo" style={{maxWidth: "200px", marginBottom: "3rem"}} />
                
                <h1>Welcome to TextRP</h1>
                <p style={{marginBottom: "2rem", color: "#666"}}>
                    Sign in with your XRPL wallet to continue
                </p>
                
                <div className="wallet-options" style={{display: "flex", flexDirection: "column", gap: "1rem", width: "100%", maxWidth: "400px"}}>
                    <button
                        className="wallet-button xaman"
                        onClick={() => this.onWalletConnect('xumm')}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "1rem",
                            padding: "1.5rem 2rem",
                            border: "2px solid #3052FF",
                            borderRadius: "8px",
                            background: "white",
                            cursor: "pointer",
                            fontSize: "1.2rem",
                            fontWeight: "600",
                            color: "#333",
                            transition: "all 0.2s ease"
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.background = "#3052FF";
                            e.currentTarget.style.color = "white";
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.background = "white";
                            e.currentTarget.style.color = "#333";
                        }}
                    >
                        <img src={require("../../../../res/img/xaman.png")} alt="Xaman" style={{width: "32px", height: "32px"}} />
                        <span>Continue with Xaman Wallet</span>
                    </button>                    
                    {/* Placeholder for future wallet support - GEM, Crossmark, etc. */}
                </div>
                
                <div style={{
                    textAlign: "center", 
                    marginTop: "2rem",
                    fontSize: "0.85rem",
                    color: "#999"
                }}>
                    <p>More wallet options coming soon!</p>
                </div>
            </div>
        );
    };

    // Add Xaman login method to the login options
    private renderXamanLogin = (): JSX.Element => {
        const matrixClient: any = this.loginLogic.createTemporaryClient();
        return (
            <XamanLogin
                matrixClient={matrixClient}
                onLoginSuccess={this.onLoginSuccess}
                onCancel={this.onXamanCancel}
            />
        );
    };

    public renderLoginComponentForFlows(): ReactNode {
        if (!this.state.flows) return null;

        // If we're showing the welcome page, render it
        if (this.state.loginView === 'welcome') {
            return this.renderWelcomePage();
        }

        // If we're in Xaman login view, show the Xaman component
        if (this.state.loginView === 'xaman') {
            return this.renderXamanLogin();
        }

        // Check if JWT flow is available for Xaman login option
        const jwtFlow = this.state.flows.find((flow) => flow.type === "org.matrix.login.jwt");

        // this is the ideal order we want to show the flows in
        // const order = ["m.login.password", "m.login.sso"];
        const order = ["m.login.sso"];

        const flows = filterBoolean(order.map((type) => this.state.flows?.find((flow) => flow.type === type)));
        return (
            <React.Fragment>
                {/* Back button to return to welcome */}
                <div className="mx_Login_back_button" style={{marginBottom: "1rem"}}>
                    <AccessibleButton 
                        kind="link_inline" 
                        onClick={() => this.setState({ loginView: 'welcome' })}
                    >
                        ← Back to Welcome
                    </AccessibleButton>
                </div>
                
                {/* Show Xaman login button if JWT flow is available */}
                {jwtFlow && (
                    <div className="mx_Login_type_container">
                        <button
                            className="mx_Login_type_xaman"
                            onClick={() => this.onWalletConnect('xaman')}
                        >
                            <img src={require("../../../../res/img/xaman.png")} alt="Xaman" style={{width: "24px", height: "24px", marginRight: "8px"}} />
                            <span>{_t("Continue with Xaman")}</span>
                        </button>
                    </div>
                )}
                
                {flows.map((flow) => {
                    const stepRenderer = this.stepRendererMap[flow.type];
                    return <React.Fragment key={flow.type}>{stepRenderer()}</React.Fragment>;
                })}
            </React.Fragment>
        );
    }

    private renderPasswordStep = (): JSX.Element => {
        return (
            <PasswordLogin
                onSubmit={this.onPasswordLogin}
                username={this.state.username}
                phoneCountry={this.state.phoneCountry}
                phoneNumber={this.state.phoneNumber}
                onUsernameChanged={this.onUsernameChanged}
                onUsernameBlur={this.onUsernameBlur}
                onPhoneCountryChanged={this.onPhoneCountryChanged}
                onPhoneNumberChanged={this.onPhoneNumberChanged}
                onForgotPasswordClick={this.props.onForgotPasswordClick}
                loginIncorrect={this.state.loginIncorrect}
                serverConfig={this.props.serverConfig}
                disableSubmit={this.isBusy()}
                busy={this.props.isSyncing || this.state.busyLoggingIn}
            />
        );
    };

    private renderSsoStep = (loginType: "cas" | "sso"): JSX.Element => {
        const flow = this.state.flows?.find((flow) => flow.type === "m.login." + loginType) as ISSOFlow;

        return (
            <SSOButtons
                matrixClient={this.loginLogic.createTemporaryClient()}
                flow={flow}
                loginType={loginType}
                fragmentAfterLogin={this.props.fragmentAfterLogin}
                primary={!this.state.flows?.find((flow) => flow.type === "m.login.password")}
                action={SSOAction.LOGIN}
            />
        );
    };

    private renderQrModal = (): JSX.Element => {
        const { qrCodeData, qrStatus } = this.state;

        return (
            <div className="mx_QrModal_backdrop" onClick={this.closeQrModal}>
                <div className="mx_QrModal_container" onClick={(e) => e.stopPropagation()}>
                    <div className="mx_QrModal_header">
                        <h2>{_t("Sign in with Xaman Wallet")}</h2>
                        <AccessibleButton 
                            className="mx_QrModal_closeButton"
                            onClick={this.closeQrModal}
                            aria-label={_t("Close")}
                        >
                            ✕
                        </AccessibleButton>
                    </div>

                    <div className="mx_QrModal_content">
                        {qrStatus === 'loading' && (
                            <div className="mx_QrModal_loading">
                                <Spinner />
                                <p>{_t("Generating QR code...")}</p>
                            </div>
                        )}

                        {qrStatus === 'pending' && qrCodeData && (
                            <div className="mx_QrModal_qrCode">
                                <img 
                                    src={qrCodeData.qrCodeImage} 
                                    alt="QR Code" 
                                    className="mx_QrModal_qrImage"
                                />
                                <div className="mx_QrModal_instructions">
                                    <h3>{_t("Scan with your Xaman app")}</h3>
                                    <ol>
                                        <li>{_t("Open the Xaman app on your phone")}</li>
                                        <li>{_t("Tap the scan icon")}</li>
                                        <li>{_t("Point your camera at this QR code")}</li>
                                        <li>{_t("Sign the request in your app")}</li>
                                    </ol>
                                </div>
                                <div className="mx_QrModal_waiting">
                                    <InlineSpinner w={16} h={16} />
                                    <span>{_t("Waiting for signature...")}</span>
                                </div>
                            </div>
                        )}

                        {qrStatus === 'signed' && (
                            <div className="mx_QrModal_success">
                                <div className="mx_QrModal_successIcon">✓</div>
                                <p>{_t("Signature received! Logging you in...")}</p>
                            </div>
                        )}

                        {qrStatus === 'expired' && (
                            <div className="mx_QrModal_error">
                                <p>{_t("QR code expired. Please try again.")}</p>
                                <AccessibleButton 
                                    kind="primary"
                                    onClick={() => this.onWalletConnect('xumm')}
                                >
                                    {_t("Generate New QR Code")}
                                </AccessibleButton>
                            </div>
                        )}

                        {qrStatus === 'rejected' && (
                            <div className="mx_QrModal_error">
                                <p>{_t("Signature rejected. Please try again.")}</p>
                                <AccessibleButton 
                                    kind="primary"
                                    onClick={() => this.onWalletConnect('xumm')}
                                >
                                    {_t("Try Again")}
                                </AccessibleButton>
                            </div>
                        )}

                        {qrStatus === 'error' && (
                            <div className="mx_QrModal_error">
                                <p>{_t("An error occurred. Please try again.")}</p>
                                <AccessibleButton 
                                    kind="primary"
                                    onClick={() => this.onWalletConnect('xumm')}
                                >
                                    {_t("Try Again")}
                                </AccessibleButton>
                            </div>
                        )}
                    </div>

                    <div className="mx_QrModal_footer">
                        <p className="mx_QrModal_helpText">
                            {_t("Don't have Xaman? ")}
                            <a href="https://xaman.app" target="_blank" rel="noopener noreferrer">
                                {_t("Download here")}
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    public render(): React.ReactNode {
        const loader =
            this.isBusy() && !this.state.busyLoggingIn ? (
                <div className="mx_Login_loader">
                    <Spinner />
                </div>
            ) : null;

        const errorText = this.state.errorText;

        let errorTextSection;
        if (errorText) {
            errorTextSection = <div className="mx_Login_error">{errorText}</div>;
        }

        let serverDeadSection;
        if (!this.state.serverIsAlive) {
            const classes = classNames({
                mx_Login_error: true,
                mx_Login_serverError: true,
                mx_Login_serverErrorNonFatal: !this.state.serverErrorIsFatal,
            });
            serverDeadSection = <div className={classes}>{this.state.serverDeadError}</div>;
        }

        let footer;
        if (this.props.isSyncing || this.state.busyLoggingIn) {
            footer = (
                <div className="mx_AuthBody_paddedFooter">
                    <div className="mx_AuthBody_paddedFooter_title">
                        <InlineSpinner w={20} h={20} />
                        {this.props.isSyncing ? _t("Syncing…") : _t("Signing In…")}
                    </div>
                    {this.props.isSyncing && (
                        <div className="mx_AuthBody_paddedFooter_subtitle">
                            {_t("If you've joined lots of rooms, this might take a while")}
                        </div>
                    )}
                </div>
            );
        }
        // else if (SettingsStore.getValue(UIFeature.Registration)) {
        //     footer = (
        //         <span className="mx_AuthBody_changeFlow">
        //             {_t(
        //                 "New? <a>Create account</a>",
        //                 {},
        //                 {
        //                     a: (sub) => (
        //                         <AccessibleButton kind="link_inline" onClick={this.onTryRegisterClick}>
        //                             {sub}
        //                         </AccessibleButton>
        //                     ),
        //                 },
        //             )}
        //         </span>
        //     );
        // }        
        return (
            <AuthPage>
                <AuthHeader disableLanguageSelector={this.props.isSyncing || this.state.busyLoggingIn} />
                <AuthBody>
                    <h1>
                        {_t("Sign in to TextRP")}
                        {loader}
                    </h1>
                    {errorTextSection}
                    {serverDeadSection}
                    {/* <ServerPicker
                        serverConfig={this.props.serverConfig}
                        onServerConfigChange={this.props.onServerConfigChange}
                    /> */}
                    {this.renderLoginComponentForFlows()}
                    {footer}
                    <Env />
                </AuthBody>
                
                {/* Embedded QR Code Modal */}
                {this.state.showQrModal && this.renderQrModal()}
            </AuthPage>
        );
    }
}
