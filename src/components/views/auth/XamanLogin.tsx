import React, { useState, useEffect } from 'react';
import { MatrixClient } from 'matrix-js-sdk';
// import Modal from '../../../Modal';
// import Spinner from '../../elements/Spinner';
// import QRCode from 'qrcode.react';
import { _t } from '../../../languageHandler';

interface IProps {
    matrixClient: MatrixClient;
    onLoginSuccess: (credentials: any) => void;
    onCancel: () => void;
}

interface IState {
    phase: 'loading' | 'showing_qr' | 'processing' | 'error';
    qrCodeUrl?: string;
    errorMessage?: string;
    webSocketUrl?: string;
    payloadId?: string;
}

export default class XamanLogin extends React.Component<IProps, IState> {
    private ws: WebSocket | null = null;

    constructor(props: IProps) {
        super(props);
        this.state = {
            phase: 'loading'
        };
    }

    async componentDidMount() {
        await this.initializeXamanLogin();
    }

    componentWillUnmount() {
        if (this.ws) {
            this.ws.close();
        }
    }

    private async initializeXamanLogin() {
        try {
            // Get XRPL Wallet Connect service URL from config
            const walletConnectUrl = process.env.REACT_APP_WALLET_CONNECT_URL ||
                'https://wallet-connect.textrp.io';
            console.log('Using Wallet Connect URL:', walletConnectUrl, process.env.REACT_APP_WALLET_CONNECT_URL);

            // Request QR code from wallet connect service
            const response = await fetch(`${walletConnectUrl}/api/auth/xumm/createpayload`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    return_url: window.location.origin
                })
            });

            const data = await response.json();

            this.setState({
                phase: 'showing_qr',
                qrCodeUrl: data.payload.refs.qr_png,
                webSocketUrl: data.payload.refs.websocket_status,
                payloadId: data.payload.uuid
            });

            // Connect to WebSocket for status updates
            this.connectWebSocket(data.payload.refs.websocket_status);

        } catch (error) {
            console.error('Failed to initialize Xaman login:', error);
            this.setState({
                phase: 'error',
                errorMessage: _t('Failed to initialize Xaman login')
            });
        }
    }

    private connectWebSocket(url: string) {
        this.ws = new WebSocket(url);

        this.ws.onmessage = async (event) => {
            const data = JSON.parse(event.data);

            if (data.signed === true) {
                await this.handleSignedPayload(data.payload_uuidv4);
            } else if (data.signed === false) {
                this.setState({
                    phase: 'error',
                    errorMessage: _t('Login cancelled by user')
                });
            }
        };

        this.ws.onerror = () => {
            this.setState({
                phase: 'error',
                errorMessage: _t('Connection error')
            });
        };
    }

    private async handleSignedPayload(payloadId: string) {
        try {
            this.setState({ phase: 'processing' });

            const walletConnectUrl = process.env.REACT_APP_WALLET_CONNECT_URL ||
                'https://wallet-connect.textrp.io';

            // Get the signed payload
            const payloadResponse = await fetch(
                `${walletConnectUrl}/api/auth/xumm/getpayload?payloadId=${payloadId}`
            );
            const payloadData = await payloadResponse.json();

            // Verify signature and get JWT
            const checkSignResponse = await fetch(
                `${walletConnectUrl}/api/auth/xumm/checksign?hex=${payloadData.payload.response.hex}`
            );
            const { token, xrpAddress, wallet_provider } = await checkSignResponse.json();

            // Submit JWT to Synapse
            const loginResponse = await this.props.matrixClient.login("org.matrix.login.jwt", {
                token: token,
                initial_device_display_name: `Xaman Wallet (${xrpAddress.slice(0, 8)}...)`,
            });

            // Store wallet provider in session storage for the app
            sessionStorage.setItem('wallet_provider', wallet_provider);
            sessionStorage.setItem('wallet_address', xrpAddress);

            this.props.onLoginSuccess(loginResponse);

        } catch (error) {
            console.error('Failed to process signed payload:', error);
            this.setState({
                phase: 'error',
                errorMessage: _t('Failed to complete login')
            });
        }
    }

    render() {
        const { phase, qrCodeUrl, errorMessage } = this.state;

        return (
            <div className="mx_XamanLogin">
                <h2>{_t("Sign in with Xaman")}</h2>

                {phase === 'loading' && (
                    <div className="mx_XamanLogin_loading">
                        {/* <Spinner /> */}
                        <div
                            className="mx_RoomView_messagePanel mx_RoomView_messagePanelSearchSpinner"
                            data-testid="messagePanelSearchSpinner"
                        />
                        <p>{_t("Preparing login...")}</p>
                    </div>
                )}

                {phase === 'showing_qr' && qrCodeUrl && (
                    <div className="mx_XamanLogin_qr">
                        <p>{_t("Scan this QR code with your Xaman app")}</p>
                        <div className="mx_XamanLogin_qrContainer">
                            <img src={qrCodeUrl} alt="Xaman QR Code" />
                        </div>
                        <p className="mx_XamanLogin_waiting">
                            {_t("Waiting for signature...")}
                        </p>
                    </div>
                )}

                {phase === 'processing' && (
                    <div className="mx_XamanLogin_processing">
                        {/* <Spinner /> */}
                        <div
                            className="mx_RoomView_messagePanel mx_RoomView_messagePanelSearchSpinner"
                            data-testid="messagePanelSearchSpinner"
                        />
                        <p>{_t("Processing login...")}</p>
                    </div>
                )}

                {phase === 'error' && (
                    <div className="mx_XamanLogin_error">
                        <p className="error">{errorMessage}</p>
                        <button onClick={() => this.initializeXamanLogin()}>
                            {_t("Try again")}
                        </button>
                    </div>
                )}

                <button className="mx_XamanLogin_cancel" onClick={this.props.onCancel}>
                    {_t("Cancel")}
                </button>
            </div>
        );
    }
}