import axios, { AxiosRequestConfig } from "axios";
import { MatrixClient } from "matrix-js-sdk/src/matrix";

import SdkConfig from "../SdkConfig";
import { ensureDMExists } from "../createRoom";
import { _t } from "../languageHandler";

export type PaymentIntentState = "pending_recipient" | "completed" | "declined" | "expired";

export interface PaymentIntentToken {
    currency: string;
    issuer?: string;
}

export interface PaymentIntent {
    id: string;
    senderId: string;
    recipientId: string;
    token: PaymentIntentToken;
    amount: number;
    createdAt: string;
    state: PaymentIntentState;
    reference?: string;
    roomId?: string;
    txId?: string;
}

interface PaymentIntentConfig {
    enabled?: boolean;
    create_url?: string;
    create_path?: string;
    status_url?: string;
    status_path?: string;
    notify_url?: string;
    notify_path?: string;
    accept_url_template?: string;
    decline_url_template?: string;
    request_timeout_ms?: number;
    polling_interval_ms?: number;
    timeout_ms?: number;
    trustline_failure_codes?: string[];
    trustline_failure_fields?: string[];
}

const INTENT_STORAGE_KEY = "chatpay_payment_intents";
const RESOLVED_INTENT_KEY = "chatpay_payment_intent_resolved";
const sentNotifications = new Set<string>();
const resolvedIntents = new Set<string>();
const NOTIFICATION_STORAGE_KEY = "chatpay_payment_intent_notifications";

function getConfig(): PaymentIntentConfig {
    return (SdkConfig.get("payment_intent") as PaymentIntentConfig) || {};
}

function resolveUrl(url?: string, path?: string): string {
    if (url) return url;
    if (!path) return "";
    return `${SdkConfig.get("backend_url")}${path}`;
}

function normalizeList(values?: string[]): string[] {
    if (!values) return [];
    return values.map((value) => value.toLowerCase());
}

function getValueByPath(input: any, path: string): unknown {
    if (!input || !path) return undefined;
    return path.split(".").reduce((acc, key) => (acc != null ? acc[key] : undefined), input);
}

function loadResolvedIntents(): void {
    if (resolvedIntents.size) return;
    try {
        const raw = window.localStorage.getItem(RESOLVED_INTENT_KEY);
        if (!raw) return;
        const values = JSON.parse(raw);
        if (Array.isArray(values)) {
            values.forEach((value) => {
                if (typeof value === "string") resolvedIntents.add(value);
            });
        }
    } catch {
        // If storage fails, fall back to in-memory only.
    }
}

function loadSentNotifications(): void {
    if (sentNotifications.size) return;
    try {
        const raw = window.localStorage.getItem(NOTIFICATION_STORAGE_KEY);
        if (!raw) return;
        const values = JSON.parse(raw);
        if (Array.isArray(values)) {
            values.forEach((value) => {
                if (typeof value === "string") sentNotifications.add(value);
            });
        }
    } catch {
        // Best-effort: notifications will re-send if storage fails.
    }
}

function persistSentNotifications(): void {
    try {
        window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(Array.from(sentNotifications)));
    } catch {
        // Ignore persistence failures.
    }
}

function persistResolvedIntents(): void {
    try {
        window.localStorage.setItem(RESOLVED_INTENT_KEY, JSON.stringify(Array.from(resolvedIntents)));
    } catch {
        // Ignore persistence failures to keep UX responsive.
    }
}

function markIntentResolved(intentId: string): void {
    loadResolvedIntents();
    resolvedIntents.add(intentId);
    persistResolvedIntents();
}

export function isTrustlineFailure(response: unknown): boolean {
    const config = getConfig();
    const codes = normalizeList(config.trustline_failure_codes);
    const fields = config.trustline_failure_fields || [];
    if (!codes.length || !fields.length) return false;

    for (const field of fields) {
        const value = getValueByPath(response, field);
        if (value == null) continue;
        const normalized = Array.isArray(value)
            ? value.map((item) => String(item).toLowerCase())
            : [String(value).toLowerCase()];
        if (normalized.some((entry) => codes.includes(entry))) {
            return true;
        }
    }
    return false;
}

export async function createPaymentIntent(params: {
    senderId: string;
    recipientId: string;
    token: PaymentIntentToken;
    amount: number;
    roomId?: string;
    failureTxId?: string;
}): Promise<PaymentIntent | null> {
    const config = getConfig();
    if (!config.enabled) return null;
    const url = resolveUrl(config.create_url, config.create_path);
    if (!url) return null;

    const request: AxiosRequestConfig = {
        url,
        method: "POST",
        timeout: config.request_timeout_ms && config.request_timeout_ms > 0 ? config.request_timeout_ms : undefined,
        data: {
            sender_id: params.senderId,
            recipient_id: params.recipientId,
            token: params.token,
            amount: params.amount,
            room_id: params.roomId,
            failure_tx_id: params.failureTxId,
        },
    };

    const response = await axios.request(request);
    const data = response?.data || {};
    if (!data?.id) return null;

    return {
        id: data.id,
        senderId: params.senderId,
        recipientId: params.recipientId,
        token: params.token,
        amount: params.amount,
        createdAt: data.created_at || new Date().toISOString(),
        state: data.state || "pending_recipient",
        reference: data.reference,
        roomId: params.roomId,
    };
}

export async function fetchPaymentIntentStatus(intentId: string): Promise<PaymentIntent | null> {
    const config = getConfig();
    if (!config.enabled) return null;
    const url = resolveUrl(config.status_url, config.status_path);
    if (!url) return null;

    const request: AxiosRequestConfig = {
        url,
        method: "GET",
        timeout: config.request_timeout_ms && config.request_timeout_ms > 0 ? config.request_timeout_ms : undefined,
        params: { intent_id: intentId },
    };
    const response = await axios.request(request);
    const data = response?.data;
    if (!data?.id) return null;
    return {
        id: data.id,
        senderId: data.sender_id,
        recipientId: data.recipient_id,
        token: data.token,
        amount: data.amount,
        createdAt: data.created_at,
        state: data.state,
        reference: data.reference,
        roomId: data.room_id,
        txId: data.tx_id,
    };
}

export async function notifyRecipientIfNeeded(params: {
    client: MatrixClient;
    intent: PaymentIntent;
    senderDisplayName: string;
}): Promise<void> {
    const config = getConfig();
    if (!config.enabled) return;

    loadSentNotifications();
    const notificationKey = `${params.intent.id}:${params.intent.recipientId}`;
    if (sentNotifications.has(notificationKey)) return;

    const notifyUrl = resolveUrl(config.notify_url, config.notify_path);
    if (notifyUrl) {
        await axios.request({
            url: notifyUrl,
            method: "POST",
            timeout: config.request_timeout_ms && config.request_timeout_ms > 0 ? config.request_timeout_ms : undefined,
            data: {
                intent_id: params.intent.id,
                recipient_id: params.intent.recipientId,
            },
        });
        sentNotifications.add(notificationKey);
        persistSentNotifications();
        return;
    }

    const dmRoomId = await ensureDMExists(params.client, params.intent.recipientId);
    if (!dmRoomId) return;

    const acceptUrl = config.accept_url_template?.replace("{intentId}", encodeURIComponent(params.intent.id));
    const declineUrl = config.decline_url_template?.replace("{intentId}", encodeURIComponent(params.intent.id));
    if (!acceptUrl || !declineUrl) return;

    const body = _t(
        "%(sender)s wants to send you %(amount)s %(token)s. To receive it, enable a trustline.",
        {
            sender: params.senderDisplayName,
            amount: params.intent.amount.toFixed(2),
            token: params.intent.token.currency,
        },
    );
    const formattedBody =
        `${body}<br/>` +
        (acceptUrl
            ? `<a href="${acceptUrl}" target="_blank" rel="noopener noreferrer">${_t("Accept & receive")}</a>`
            : "") +
        (declineUrl
            ? ` &nbsp; <a href="${declineUrl}" target="_blank" rel="noopener noreferrer">${_t("Decline")}</a>`
            : "");

    await params.client.sendMessage(dmRoomId, {
        msgtype: "m.notice",
        body,
        format: "org.matrix.custom.html",
        formatted_body: formattedBody,
    });
    sentNotifications.add(notificationKey);
    persistSentNotifications();
}

export function shouldResolveIntent(intentId: string): boolean {
    loadResolvedIntents();
    return !resolvedIntents.has(intentId);
}

export function finalizeIntentResolution(intentId: string): void {
    markIntentResolved(intentId);
}

export function getIntentPollingConfig(): { intervalMs: number; timeoutMs: number } {
    const config = getConfig();
    return {
        intervalMs: config.polling_interval_ms && config.polling_interval_ms > 0 ? config.polling_interval_ms : 0,
        timeoutMs: config.timeout_ms && config.timeout_ms > 0 ? config.timeout_ms : 0,
    };
}

export function persistLocalIntent(intent: PaymentIntent): void {
    try {
        const raw = window.localStorage.getItem(INTENT_STORAGE_KEY);
        const stored = raw ? JSON.parse(raw) : [];
        if (Array.isArray(stored)) {
            stored.push(intent);
            window.localStorage.setItem(INTENT_STORAGE_KEY, JSON.stringify(stored));
        }
    } catch {
        // Local storage persistence is best-effort.
    }
}
