/*
Copyright 2015-2021 The Matrix.org Foundation C.I.C.
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

// @ts-ignore - XXX: tsc doesn't like this: our js-sdk imports are complex so this isn't surprising
import { createClient } from "matrix-js-sdk/src/matrix";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { logger } from "matrix-js-sdk/src/logger";
import { DELEGATED_OIDC_COMPATIBILITY, ILoginParams, LoginFlow } from "matrix-js-sdk/src/@types/auth";

import { IMatrixClientCreds } from "./MatrixClientPeg";
import SecurityCustomisations from "./customisations/Security";

interface ILoginOptions {
    defaultDeviceDisplayName?: string;
}

export default class Login {
    private flows: Array<LoginFlow> = [];
    private readonly defaultDeviceDisplayName?: string;
    private tempClient: MatrixClient | null = null; // memoize

    public constructor(
        private hsUrl: string,
        private isUrl: string,
        private fallbackHsUrl: string | null,
        opts: ILoginOptions,
    ) {
        this.defaultDeviceDisplayName = opts.defaultDeviceDisplayName;
    }

    public getHomeserverUrl(): string {
        return this.hsUrl;
    }

    public getIdentityServerUrl(): string {
        return this.isUrl;
    }

    public setHomeserverUrl(hsUrl: string): void {
        this.tempClient = null; // clear memoization
        this.hsUrl = hsUrl;
    }

    public setIdentityServerUrl(isUrl: string): void {
        this.tempClient = null; // clear memoization
        this.isUrl = isUrl;
    }

    /**
     * Get a temporary MatrixClient, which can be used for login or register
     * requests.
     * @returns {MatrixClient}
     */
    public createTemporaryClient(): MatrixClient {
        if (!this.tempClient) {
            this.tempClient = createClient({
                baseUrl: this.hsUrl,
                idBaseUrl: this.isUrl,
            });
        }
        return this.tempClient;
    }

    public async getFlows(): Promise<Array<LoginFlow>> {
        const client = this.createTemporaryClient();
        const { flows }: { flows: LoginFlow[] } = await client.loginFlows();
        // If an m.login.sso flow is present which is also flagged as being for MSC3824 OIDC compatibility then we only
        // return that flow as (per MSC3824) it is the only one that the user should be offered to give the best experience
        const oidcCompatibilityFlow = flows.find(
            (f) => f.type === "m.login.sso" && DELEGATED_OIDC_COMPATIBILITY.findIn(f),
        );
        this.flows = oidcCompatibilityFlow ? [oidcCompatibilityFlow] : flows;
        return this.flows;
    }

    public loginViaPassword(
        username: string | undefined,
        phoneCountry: string | undefined,
        phoneNumber: string | undefined,
        password: string,
    ): Promise<IMatrixClientCreds> {
        const isEmail = !!username && username.indexOf("@") > 0;

        let identifier;
        if (phoneCountry && phoneNumber) {
            identifier = {
                type: "m.id.phone",
                country: phoneCountry,
                phone: phoneNumber,
                // XXX: Synapse historically wanted `number` and not `phone`
                number: phoneNumber,
            };
        } else if (isEmail) {
            identifier = {
                type: "m.id.thirdparty",
                medium: "email",
                address: username,
            };
        } else {
            identifier = {
                type: "m.id.user",
                user: username,
            };
        }

        const loginParams = {
            password,
            identifier,
            initial_device_display_name: this.defaultDeviceDisplayName,
        };

        const tryFallbackHs = (originalError: Error): Promise<IMatrixClientCreds> => {
            return sendLoginRequest(this.fallbackHsUrl!, this.isUrl, "m.login.password", loginParams).catch(
                (fallbackError) => {
                    logger.log("fallback HS login failed", fallbackError);
                    // throw the original error
                    throw originalError;
                },
            );
        };

        let originalLoginError: Error | null = null;
        return sendLoginRequest(this.hsUrl, this.isUrl, "m.login.password", loginParams)
            .catch((error) => {
                originalLoginError = error;
                if (error.httpStatus === 403) {
                    if (this.fallbackHsUrl) {
                        return tryFallbackHs(originalLoginError!);
                    }
                }
                throw originalLoginError;
            })
            .catch((error) => {
                logger.log("Login failed", error);
                throw error;
            });
    }

    public loginViaJWT(token: string): Promise<IMatrixClientCreds> {
        console.log("🟠🟠🟠 ========== loginViaJWT CALLED ========== 🟠🟠🟠");
        console.log("🟠 Token length:", token.length);
        console.log("🟠 Homeserver URL (this.hsUrl):", this.hsUrl);
        console.log("🟠 Identity server URL (this.isUrl):", this.isUrl);
        
        const loginParams = {
            token,
            initial_device_display_name: this.defaultDeviceDisplayName,
        };

        console.log("🟠 Login params:", loginParams);
        console.log("🟠 Sending login request with type: org.matrix.login.jwt");
        console.log("🟠🟠🟠 ============================================== 🟠🟠🟠");

        return sendLoginRequest(this.hsUrl, this.isUrl, "org.matrix.login.jwt", loginParams)
            .then((result) => {
                console.log("✅✅✅ ========== JWT LOGIN REQUEST SUCCESS ========== ✅✅✅");
                console.log("✅ Result object:", result);
                console.log("✅ Result.homeserverUrl:", result.homeserverUrl);
                console.log("✅ Result.userId:", result.userId);
                console.log("✅ Result.deviceId:", result.deviceId);
                console.log("✅ Result.accessToken (first 20):", result.accessToken?.substring(0, 20));
                console.log("✅✅✅ ==================================================== ✅✅✅");
                return result;
            })
            .catch((error) => {
                console.error("❌❌❌ ========== JWT LOGIN REQUEST FAILED ========== ❌❌❌");
                console.error("❌ Error:", error);
                console.error("❌ Error status:", error.httpStatus);
                console.error("❌ Error data:", error.data);
                console.error("❌❌❌ ================================================== ❌❌❌");
                logger.log("JWT Login failed", error);
                throw error;
            });
    }
}

/**
 * Send a login request to the given server, and format the response
 * as a MatrixClientCreds
 *
 * @param {string} hsUrl   the base url of the Homeserver used to log in.
 * @param {string} isUrl   the base url of the default identity server
 * @param {string} loginType the type of login to do
 * @param {ILoginParams} loginParams the parameters for the login
 *
 * @returns {IMatrixClientCreds}
 */
export async function sendLoginRequest(
    hsUrl: string,
    isUrl: string | undefined,
    loginType: string,
    loginParams: ILoginParams,
): Promise<IMatrixClientCreds> {
    console.log("🔶🔶🔶 ========== sendLoginRequest ========== 🔶🔶🔶");
    console.log("🔶 Input hsUrl:", hsUrl);
    console.log("🔶 Login type:", loginType);
    
    const client = createClient({
        baseUrl: hsUrl,
        idBaseUrl: isUrl,
    });
    
    const data = await client.login(loginType, loginParams);
    
    console.log("🔶 Login response data:", data);
    console.log("🔶 Well-known data:", data.well_known);

    // Store the original hsUrl for JWT logins
    const originalHsUrl = hsUrl;
    
    const wellknown = data.well_known;
    if (wellknown) {
        if (wellknown["m.homeserver"]?.["base_url"]) {
            // For JWT login (wallet-based), preserve the explicitly specified homeserver URL
            // instead of using the well_known override
            if (loginType === "org.matrix.login.jwt") {
                console.log("🔶 JWT login detected - IGNORING well_known homeserver override");
                console.log("🔶 Well-known tried to change to:", wellknown["m.homeserver"]["base_url"]);
                console.log("🔶 Keeping original URL:", originalHsUrl);
            } else {
                hsUrl = wellknown["m.homeserver"]["base_url"];
                logger.log(`Overrode homeserver setting with ${hsUrl} from login response`);
            }
        }
        if (wellknown["m.identity_server"]?.["base_url"]) {
            // TODO: should we prompt here?
            isUrl = wellknown["m.identity_server"]["base_url"];
            logger.log(`Overrode IS setting with ${isUrl} from login response`);
        }
    }

    const creds: IMatrixClientCreds = {
        homeserverUrl: hsUrl,
        identityServerUrl: isUrl,
        userId: data.user_id,
        deviceId: data.device_id,
        accessToken: data.access_token,
    };
    
    console.log("🔶 Final credentials homeserverUrl:", creds.homeserverUrl);
    console.log("🔶🔶🔶 ============================================== 🔶🔶🔶");

    SecurityCustomisations.examineLoginResponse?.(data, creds);

    return creds;
}
