import React from "react";
import classNames from "classnames";
import { RouteComponentProps } from "react-router-dom";

import SdkConfig from "../../../SdkConfig";
import AuthPage from "./AuthPage";
import { _td } from "../../../languageHandler";
import SettingsStore from "../../../settings/SettingsStore";
import { UIFeature } from "../../../settings/UIFeature";
import LanguageSelector from "./LanguageSelector";
import EmbeddedPage from "../../structures/EmbeddedPage";
import { MATRIX_LOGO_HTML } from "../../structures/static-page-vars";
import XamanLogin from "./XamanLogin";

// translatable strings for Welcome pages
_td("Sign in with SSO");
_td("Sign in with Xaman");

interface IProps extends RouteComponentProps {}

interface IState {
    showXamanLogin: boolean;
}

export default class Welcome extends React.PureComponent<IProps, IState> {
    constructor(props: IProps) {
        super(props);
        this.state = {
            showXamanLogin: false
        };
    }

    componentDidMount() {
        // Check if we should show Xaman login directly
        if (window.location.hash === "#/xaman_login") {
            this.setState({ showXamanLogin: true });
        }
    }

    private onXamanLoginSuccess = (credentials: any) => {
        // Redirect to home after successful login
        window.location.href = "/";
    };

    private onXamanCancel = () => {
        this.setState({ showXamanLogin: false });
        window.location.hash = "#/welcome";
    };

    public render(): React.ReactNode {
        if (this.state.showXamanLogin) {
            return (
                <AuthPage>
                    <XamanLogin
                        matrixClient={null} // Will be created in component
                        onLoginSuccess={this.onXamanLoginSuccess}
                        onCancel={this.onXamanCancel}
                    />
                </AuthPage>
            );
        }

        const pagesConfig = SdkConfig.getObject("embedded_pages");
        let pageUrl: string | undefined;
        if (pagesConfig) {
            pageUrl = pagesConfig.get("welcome_url");
        }

        const replaceMap: Record<string, string> = {
            "$riot:ssoUrl": "#/start_sso",
            "$riot:casUrl": "#/start_cas",
            "$matrixLogo": MATRIX_LOGO_HTML,
            "[matrix]": MATRIX_LOGO_HTML,
        };

        if (!pageUrl) {
            // Use custom welcome page with Xaman option
            const brandingConfig = SdkConfig.getObject("branding");
            const logoUrl = brandingConfig?.get("auth_header_logo_url") ?? "themes/textrp/img/logos/textrp-logo.svg";
            replaceMap["$logoUrl"] = logoUrl;
            pageUrl = "welcome_xaman.html";
        }

        return (
            <AuthPage>
                <div
                    className={classNames("mx_Welcome", {
                        mx_WelcomePage_registrationDisabled: !SettingsStore.getValue(UIFeature.Registration),
                    })}
                >
                    <EmbeddedPage className="mx_WelcomePage" url={pageUrl} replaceMap={replaceMap} />
                    <LanguageSelector />
                </div>
            </AuthPage>
        );
    }
}