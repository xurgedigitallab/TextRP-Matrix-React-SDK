export declare enum WidgetLifecycle {
    CapabilitiesRequest = "capabilities_request",
    PreLoadRequest = "preload_request",
    IdentityRequest = "identity_request"
}
export declare type CapabilitiesOpts = {
    approvedCapabilities: Set<string> | undefined;
};
export declare type ApprovalOpts = {
    approved: boolean | undefined;
};
export declare type CapabilitiesListener = (capabilitiesOpts: CapabilitiesOpts, widgetInfo: WidgetInfo, requestedCapabilities: Set<string>) => void;
/**
 * Listener for PreLoad and Identity requests
 */
export declare type ApprovalListener = (approvalOpts: ApprovalOpts, widgetInfo: WidgetInfo) => void;
/**
 * Represents the widget
 */
export interface WidgetInfo {
    /**
     * The user ID who created the widget.
     */
    creatorUserId: string;
    /**
     * The type of widget.
     */
    type: string;
    /**
     * The ID of the widget.
     */
    id: string;
    /**
     * The name of the widget, or null if not set.
     */
    name: string | null;
    /**
     * The title for the widget, or null if not set.
     */
    title: string | null;
    /**
     * The templated URL for the widget.
     */
    templateUrl: string;
    /**
     * The origin for this widget.
     */
    origin: string;
}
