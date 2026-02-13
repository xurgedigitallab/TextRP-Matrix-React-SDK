/*
Copyright 2025 TextRP Foundation

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

import React from 'react';
import { MatrixClient } from 'matrix-js-sdk';
import { _t } from '../../../languageHandler';
import AccessibleButton from '../elements/AccessibleButton';
import Spinner from '../elements/Spinner';
import QRCode from 'qrcode.react';
import Login from '../../../Login';

interface IProps {
    matrixClient: MatrixClient;
    loginLogic: Login;
    onLoginSuccess: (credentials: any) => void;
    onCancel: () => void;
    onAuthDataReceived?: (authData: {
        method: 'jwt' | 'direct';
        token?: string;
        access_token?: string;
        homeserver: string;
        user_id: string;
        device_id?: string;
        address: string;
        is_new_user: boolean;
        display_name: string | null;
        wallet_provider: string;
        wallet_name: string;
    }) => void;
}

interface IState {
    phase: 'initializing' | 'showing_qr' | 'waiting_connection' | 'waiting_signature' | 'processing' | 'error';
    sessionId?: string;
    correlationId?: string;
    qrUri?: string;
    deepLink?: string;
    errorMessage?: string;
    walletAddress?: string;
    walletName?: string;
    logs: string[];
}

export default class WalletConnectLogin extends React.Component<IProps, IState> {
    private pollInterval: NodeJS.Timeout | null = null;
    private pollCount = 0;
    private readonly maxPolls = 150; // 5 minutes (2 seconds per poll)
    
    constructor(props: IProps) {
        super(props);
        this.state = {
            phase: 'initializing',
            logs: []
        };
    }
    
    async componentDidMount() {
        this.addLog('🚀 WalletConnect login component mounted');
        await this.checkCrossmarkExtension();
    }
    
    componentWillUnmount() {
        this.addLog('🔚 Component unmounting, cleaning up...');
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }
    
    private addLog(message: string): void {
        const timestamp = new Date().toISOString().substring(11, 23); // HH:mm:ss.SSS
        const logMessage = `[${timestamp}] ${message}`;
        console.log(logMessage);
        this.setState(prevState => ({
            logs: [...prevState.logs, logMessage]
        }));
    }

    private async checkCrossmarkExtension() {
        try {
            this.addLog("🔍 Checking for Crossmark extension...");
            const sdk = window.xrpl.crossmark;
            
            if (!sdk) {
                throw new Error("Crossmark extension not detected");
            }
            
            this.setState({ phase: 'initializing' });
            
            // STEP 1: Get challenge hash from backend
            this.addLog("📝 Requesting challenge hash...");
            const hashResponse = await fetch('/wallet-api/auth/crossmark/hash');
            const { hash } = await hashResponse.json();
            this.addLog(`✅ Challenge hash received: ${hash.substring(0, 20)}...`);
            
            // STEP 2: User signs with Crossmark wallet
            this.addLog("✍️ Requesting signature from Crossmark...");
            this.setState({ phase: 'waiting_signature' });
            
            let { request, response, createdAt, resolvedAt } = 
                await sdk.methods.signInAndWait(hash);
            
            if (!response || !response.data || !response.data.address) {
                throw new Error("User cancelled or signature failed");
            }
            
            const { address, signature, publicKey } = response.data;
            this.addLog(`✅ Signature received from ${address}`);
            
            // STEP 3: Verify signature on backend
            this.addLog("🔐 Verifying signature...");
            this.setState({ phase: 'processing' });
            
            const verifyUrl = `/wallet-api/auth/crossmark/checksign?signature=${signature}`;
            const verifyResponse = await fetch(verifyUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${hash}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    pubkey: publicKey,
                    address: address
                })
            });
            
            if (!verifyResponse.ok) {
                throw new Error("Signature verification failed");
            }
            
            const verifyData = await verifyResponse.json();
            this.addLog(`✅ Signature verified! Token received.`);
            
            // STEP 4: Call login-or-register to check if user exists
            this.addLog("🔄 Checking user status...");
            const loginResponse = await fetch('/wallet-api/matrix/login-or-register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address,
                    wallet_provider: 'crossmark',
                    correlation_id: `crossmark_${Date.now()}`
                })
            });
            
            if (!loginResponse.ok) {
                throw new Error("Login/register check failed");
            }
            
            const loginData = await loginResponse.json();
            this.addLog(`✅ User status: ${loginData.is_new_user ? 'NEW' : 'EXISTING'}`);
            if (loginData.display_name) {
                this.addLog(`👤 Display name: ${loginData.display_name}`);
            }
            
            // STEP 5: Pass to confirmation page (or direct login)
            if (this.props.onAuthDataReceived) {
                this.addLog("🔄 Using confirmation page flow...");
                this.props.onAuthDataReceived({
                    method: loginData.method || 'jwt',
                    token: loginData.token,
                    access_token: loginData.access_token,
                    homeserver: loginData.homeserver,
                    user_id: loginData.user_id,
                    device_id: loginData.device_id,
                    address: address,
                    is_new_user: loginData.is_new_user,
                    display_name: loginData.display_name,
                    wallet_provider: 'crossmark',
                    wallet_name: 'Crossmark Wallet'
                });
            } else {
                // Fallback: Direct login
                this.addLog("🔄 Using direct login flow...");
                await this.loginToMatrix(
                    loginData.token || loginData.access_token,
                    address,
                    'Crossmark Wallet'
                );
            }
            
        } catch (error: any) {
            this.addLog(`❌ Crossmark login error: ${error.message}`);
            this.setState({
                phase: 'error',
                errorMessage: error.message || 'Crossmark login failed'
            });
        }
    }
    
    private async initializeWalletConnect() {
        try {
            this.setState({ phase: 'initializing' });
            
            this.addLog(`📞 Calling WalletConnect init endpoint`);
            
            // Call backend via Apache proxy at /wallet-api
            // Apache proxies /wallet-api/* to http://localhost:3000/wallet-api/*
            // So we need to add the full path including /api
            const walletApiUrl = '/wallet-api/auth/walletconnect/init';
            this.addLog(`🌐 Request URL: ${window.location.origin}${walletApiUrl}`);
            
            const response = await fetch(walletApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({})
            });
            
            this.addLog(`📡 Response status: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                this.addLog(`❌ HTTP error: ${errorText}`);
                throw new Error(`Failed to initialize WalletConnect: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            this.addLog(`📦 Received data: ${JSON.stringify(data, null, 2)}`);
            
            if (!data.uri || !data.sessionId) {
                this.addLog(`❌ Missing required fields in response`);
                throw new Error('Invalid response from server: missing uri or sessionId');
            }
            
            const { sessionId, correlation_id, uri, deep_link, supported_wallets } = data;
            
            this.addLog(`✅ Session initialized successfully`);
            this.addLog(`═══════════════════════════════════════════════`);
            this.addLog(`🆔 SESSION ID RECEIVED FROM INIT ENDPOINT`);
            this.addLog(`═══════════════════════════════════════════════`);
            this.addLog(`🔑 sessionId VALUE: ${sessionId}`);
            this.addLog(`📏 sessionId LENGTH: ${sessionId?.length || 0} chars`);
            this.addLog(`✔️  sessionId TYPE: ${typeof sessionId}`);
            this.addLog(`🔗 Correlation ID: ${correlation_id}`);
            this.addLog(`📱 Supported wallets: ${supported_wallets?.join(', ')}`);
            this.addLog(`🔗 WalletConnect URI length: ${uri.length} chars`);
            this.addLog(`🔗 URI preview: ${uri.substring(0, 50)}...`);
            this.addLog(`═══════════════════════════════════════════════`);
            
            this.addLog(`📝 ABOUT TO UPDATE COMPONENT STATE...`);
            this.setState({
                phase: 'showing_qr',
                sessionId,
                correlationId: correlation_id,
                qrUri: uri,
                deepLink: deep_link || uri
            });
            
            this.addLog(`✅ Component state updated with sessionId: ${sessionId}`);
            this.addLog('✅ QR code ready to display');
            this.addLog('🔄 Starting status polling...');
            
            // Start polling for connection status
            this.startPolling();
            
        } catch (error: any) {
            this.addLog(`❌ Initialization error: ${error.message}`);
            this.addLog(`❌ Stack trace: ${error.stack}`);
            console.error('WalletConnect initialization error:', error);
            this.setState({
                phase: 'error',
                errorMessage: error.message || 'Failed to initialize WalletConnect'
            });
        }
    }
    
    private startPolling() {
        this.pollCount = 0;
        this.addLog(`⏰ Polling interval set to 2 seconds (max ${this.maxPolls} attempts)`);
        
        this.pollInterval = setInterval(async () => {
            await this.checkStatus();
        }, 2000); // Poll every 2 seconds
        
        // Also check immediately
        this.checkStatus();
    }
    
    private async checkStatus() {
        if (!this.state.sessionId) {
            this.addLog('⚠️ No session ID, skipping poll');
            return;
        }
        
        this.pollCount++;
        
        if (this.pollCount > this.maxPolls) {
            this.addLog(`⏱️ Polling timeout (${this.pollCount} attempts)`);
            if (this.pollInterval) {
                clearInterval(this.pollInterval);
                this.pollInterval = null;
            }
            this.setState({
                phase: 'error',
                errorMessage: 'Connection timeout. Please try again.'
            });
            return;
        }
        
        // Log every 10th poll to avoid spam
        if (this.pollCount % 10 === 0) {
            this.addLog(`🔄 Polling status (attempt ${this.pollCount}/${this.maxPolls})...`);
        }
        
        try {
            // Call backend via Apache proxy at /wallet-api
            const statusUrl = `/wallet-api/auth/walletconnect/status?sessionId=${this.state.sessionId}&correlation_id=${this.state.correlationId}`;
            console.log(`------------Fetching status from: ${window.location.origin}${statusUrl}`);
            const response = await fetch(statusUrl);
            console.log("respoonse => ", response)
            
            if (!response.ok) {
                this.addLog(`⚠️ Status check failed: ${response.status} ${response.statusText}`);
                return;
            }
            
            const data = await response.json();
            
            // Log debug headers for troubleshooting
            if (this.pollCount % 15 === 0) {
                const wcDebug = response.headers.get('X-WC-Debug');
                const wcClientFound = response.headers.get('X-WC-Client-Found');
                const wcSessionsFound = response.headers.get('X-WC-Sessions-Found');
                const wcSessionTopic = response.headers.get('X-WC-Session-Topic');
                
                if (wcDebug) this.addLog(`🔍 Debug: ${wcDebug}`);
                if (wcClientFound) this.addLog(`🔍 Client Found: ${wcClientFound}`);
                if (wcSessionsFound) this.addLog(`🔍 Sessions Found: ${wcSessionsFound}`);
                if (wcSessionTopic) this.addLog(`🔍 Session Topic: ${wcSessionTopic.substring(0, 20)}...`);
            }
            
            // Log detailed status on change or every 15 polls
            if (data.status !== 'pending' || this.pollCount % 15 === 0) {
                this.addLog(`📊 Status: ${data.status}`);
                if (data.message) {
                    this.addLog(`💬 Message: ${data.message}`);
                }
            }
            
            if (data.status === 'pending') {
                // Still waiting for wallet to connect
                if (this.state.phase !== 'waiting_connection') {
                    this.setState({ phase: 'waiting_connection' });
                }
                return;
            }
            
            if (data.status === 'expired') {
                this.addLog(`⏱️ Session expired`);
                if (this.pollInterval) {
                    clearInterval(this.pollInterval);
                    this.pollInterval = null;
                }
                this.setState({
                    phase: 'error',
                    errorMessage: 'Session expired. Please try again.'
                });
                return;
            }
            
            if (data.status === 'signed' && data.token) {
                this.addLog(`🎉 Wallet signed! Processing login...`);
                this.addLog(`💼 Wallet Address: ${data.wallet_address}`);
                this.addLog(`📱 Wallet Name: ${data.wallet_name}`);
                this.addLog(`🎫 JWT Token received (length: ${data.token.length})`);

                // ============================================================
                // CRITICAL FIX: Use session_topic from response (WalletConnect topic)
                // NOT the random sessionId from init response!
                // ============================================================
                const sessionTopic = data.session_topic || this.state.sessionId;
                this.addLog(`📋 STEP 1: Checking for WalletConnect session topic...`);
                this.addLog(`📋 session_topic from response = ${data.session_topic || 'NULL/UNDEFINED'}`);
                this.addLog(`📋 fallback sessionId from state = ${this.state.sessionId || 'NULL/UNDEFINED'}`);

                // Store WalletConnect session topic for later use (payments, etc.)
                if (sessionTopic) {
                    this.addLog(`✅ STEP 2: sessionTopic exists! Storing in sessionStorage...`);
                    this.addLog(`🔑 Key: 'wc_session_topic'`);
                    this.addLog(`💎 Value: '${sessionTopic}'`);
                    
                    sessionStorage.setItem('wc_session_topic', sessionTopic);
                    
                    this.addLog(`✅ STEP 3: Stored successfully!`);
                    this.addLog(`🔍 STEP 4: Verifying storage...`);
                    const storedValue = sessionStorage.getItem('wc_session_topic');
                    this.addLog(`🔍 Retrieved value: '${storedValue}'`);
                    
                    if (storedValue === sessionTopic) {
                        this.addLog(`✅ VERIFICATION PASSED: Storage successful!`);
                    } else {
                        this.addLog(`❌ VERIFICATION FAILED: Stored value doesn't match!`);
                    }
                    
                    this.addLog(`💾 ✅ Session topic stored for future transactions: ${sessionTopic}`);
                } else {
                    this.addLog(`❌ STEP 2: CRITICAL ERROR - No session topic available!`);
                    this.addLog(`⚠️ WARNING: No session topic available to store!`);
                    this.addLog(`📊 Component state dump: ${JSON.stringify({
                        sessionId: this.state.sessionId,
                        correlationId: this.state.correlationId,
                        phase: this.state.phase
                    })}`);
                }

                // Stop polling
                if (this.pollInterval) {
                    clearInterval(this.pollInterval);
                    this.pollInterval = null;
                }

                this.setState({
                    phase: 'processing',
                    walletAddress: data.wallet_address,
                    walletName: data.wallet_name
                });

                // If onAuthDataReceived callback is provided, use confirmation flow
                // Otherwise fall back to direct login (backwards compatibility)
                if (this.props.onAuthDataReceived) {
                    this.addLog(`🔄 Using confirmation page flow...`);

                    // Smart fallback for is_new_user if not explicitly set
                    let isNewUser = data.is_new_user;
                    if (isNewUser === undefined || isNewUser === null) {
                        if (data.method === 'direct') {
                            isNewUser = false; // Direct login means existing user
                        } else if (data.method === 'jwt' && !data.display_name) {
                            isNewUser = true; // JWT without display name = new user
                        } else if (data.method === 'jwt' && data.display_name) {
                            isNewUser = false; // JWT with display name = existing user (fallback)
                        } else {
                            isNewUser = data.method === 'jwt';
                        }
                        this.addLog(`🔄 is_new_user fallback: method=${data.method}, display_name=${data.display_name || 'null'} => ${isNewUser}`);
                    }

                    this.props.onAuthDataReceived({
                        method: data.method || 'jwt',
                        token: data.token,
                        access_token: data.access_token,
                        homeserver: data.homeserver,
                        user_id: data.user_id,
                        device_id: data.device_id,
                        address: data.wallet_address,
                        is_new_user: isNewUser,
                        display_name: data.display_name || null,
                        wallet_provider: 'walletconnect',
                        wallet_name: data.wallet_name || 'WalletConnect Wallet'
                    });
                } else {
                    // Fallback to direct login for backwards compatibility
                    this.addLog(`🔄 Using direct login flow (no confirmation callback)...`);
                    await this.loginToMatrix(data.token || data.access_token, data.wallet_address, data.wallet_name);
                }
                return;
            }
            
            if (data.status === 'error') {
                this.addLog(`❌ Error status received: ${data.error}`);
                if (this.pollInterval) {
                    clearInterval(this.pollInterval);
                    this.pollInterval = null;
                }
                this.setState({
                    phase: 'error',
                    errorMessage: data.error || 'An error occurred during authentication'
                });
                return;
            }
            
        } catch (error: any) {
            this.addLog(`⚠️ Poll error: ${error.message}`);
            // Don't stop polling on errors, might be temporary network issue
        }
    }
    
    private async loginToMatrix(token: string, walletAddress: string, walletName: string) {
        try {
            this.addLog('🔐 Logging in to Matrix with JWT...');
            this.addLog(`🎫 Token preview: ${token.substring(0, 30)}...`);
            this.addLog(`💼 Address: ${walletAddress}`);
            this.addLog(`📱 Wallet: ${walletName}`);
            
            // Use loginLogic.loginViaJWT to properly handle homeserver URL
            this.addLog('🔄 Calling loginViaJWT from loginLogic...');
            const credentials = await this.props.loginLogic.loginViaJWT(token);
            
            this.addLog('✅ Matrix login successful!');
            this.addLog(`👤 User ID: ${credentials.userId}`);
            this.addLog(`📱 Device ID: ${credentials.deviceId}`);
            this.addLog(`🏠 Homeserver: ${credentials.homeserverUrl}`);
            this.addLog(`🎫 Access Token: ${credentials.accessToken.substring(0, 20)}...`);
            
            // Store wallet provider info
            sessionStorage.setItem('wallet_provider', 'walletconnect');
            sessionStorage.setItem('wallet_address', walletAddress);
            sessionStorage.setItem('wallet_name', walletName);
            this.addLog('💾 Wallet info stored in session storage');
            
            this.addLog('🎉 Login complete! Calling onLoginSuccess...');
            this.props.onLoginSuccess(credentials);
            
        } catch (error: any) {
            this.addLog(`❌ Matrix login failed: ${error.message}`);
            this.addLog(`❌ Error code: ${error.errcode || 'N/A'}`);
            this.addLog(`❌ HTTP status: ${error.httpStatus || 'N/A'}`);
            this.addLog(`❌ Error data: ${JSON.stringify(error.data || {})}`);
            
            console.error('Matrix login error:', error);
            this.setState({
                phase: 'error',
                errorMessage: `Login failed: ${error.message || 'Unknown error'}`
            });
        }
    }
    
    render() {
        const { phase, qrUri, deepLink, errorMessage, walletName, logs } = this.state;
        
        return (
            <div className="mx_WalletConnectLogin" style={{padding: '20px', maxWidth: '600px', margin: '0 auto'}}>
                <h2>{_t("Connect your XRPL wallet to access TextRP services")}</h2>
                <p style={{color: '#666', marginBottom: '20px'}}>
                    {_t("Supports Joey, Atomic, Bifrost and other XRPL wallets")}
                </p>
                
                {phase === 'initializing' && (
                    <div style={{textAlign: 'center', padding: '40px'}}>
                        <Spinner />
                        <p style={{marginTop: '20px'}}>{_t("Initializing WalletConnect...")}</p>
                    </div>
                )}
                
                {(phase === 'showing_qr' || phase === 'waiting_connection' || phase === 'waiting_signature') && qrUri && (
                    <div style={{textAlign: 'center'}}>
                        <div style={{
                            background: 'white',
                            padding: '20px',
                            borderRadius: '8px',
                            display: 'inline-block',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                        }}>
                            <QRCode value={qrUri} size={300} level="M" />
                        </div>
                        
                        <p style={{marginTop: '20px', fontSize: '16px', fontWeight: '600'}}>
                            {phase === 'waiting_connection' && '⏳ Waiting for wallet to connect...'}
                            {phase === 'waiting_signature' && '✍️ Please sign in your wallet...'}
                            {phase === 'showing_qr' && '📱 Scan with your wallet app'}
                        </p>
                        
                        <p style={{marginTop: '10px', color: '#666', fontSize: '14px'}}>
                            Open with: Joey, Atomic, Bifrost, or any WalletConnect-compatible XRPL wallet
                        </p>
                        
                        {deepLink && (
                            <div style={{marginTop: '20px'}}>
                                <AccessibleButton 
                                    kind="primary"
                                    onClick={() => {
                                        this.addLog('📱 Opening deep link...');
                                        window.location.href = deepLink;
                                    }}
                                >
                                    {_t("Open in Mobile Wallet")}
                                </AccessibleButton>
                            </div>
                        )}
                    </div>
                )}
                
                {phase === 'processing' && (
                    <div style={{textAlign: 'center', padding: '40px'}}>
                        <Spinner />
                        <p style={{marginTop: '20px', fontSize: '16px'}}>
                            {_t("Processing login...")}
                        </p>
                        {walletName && (
                            <p style={{marginTop: '10px', color: '#666', fontSize: '14px'}}>
                                Connected with {walletName}
                            </p>
                        )}
                    </div>
                )}
                
                {phase === 'error' && (
                    <div style={{
                        padding: '20px',
                        background: '#ffebee',
                        borderRadius: '8px',
                        border: '1px solid #ef5350'
                    }}>
                        <p style={{color: '#c62828', fontWeight: '600', marginBottom: '10px'}}>
                            ❌ {_t("Error")}
                        </p>
                        <p style={{color: '#d32f2f', fontSize: '14px'}}>
                            {errorMessage}
                        </p>
                        <AccessibleButton 
                            kind="primary"
                            onClick={() => {
                                this.addLog('🔄 Retrying initialization...');
                                this.initializeWalletConnect();
                            }}
                            style={{marginTop: '15px'}}
                        >
                            {_t("Try Again")}
                        </AccessibleButton>
                    </div>
                )}
                
                <div style={{marginTop: '20px', textAlign: 'center'}}>
                    <AccessibleButton 
                        kind="link_inline"
                        onClick={() => {
                            this.addLog('🔙 User cancelled, returning to welcome');
                            this.props.onCancel();
                        }}
                    >
                        {_t("← Back to Welcome")}
                    </AccessibleButton>
                </div>
            </div>
        );
    }
}
