import axios, { AxiosRequestConfig } from "axios";
import { sleep } from "matrix-js-sdk/src/utils";
import SdkConfig from "../SdkConfig";

export type LedgerVerificationOutcome = "success" | "failed" | "pending" | "timeout" | "unconfigured" | "error";

export interface LedgerVerificationResult {
    outcome: LedgerVerificationOutcome;
    status?: string;
    txId?: string;
    response?: unknown;
}

interface VerificationConfig {
    status_url?: string;
    status_path?: string;
    request_method?: "GET" | "POST";
    request_timeout_ms?: number;
    polling_interval_ms?: number;
    timeout_ms?: number;
    max_retries?: number;
    success_statuses?: string[];
    failure_statuses?: string[];
    pending_statuses?: string[];
}

const inFlight = new Map<string, Promise<LedgerVerificationResult>>();
const completed = new Map<string, LedgerVerificationResult>();

const sentMessages = new Set<string>();
const sendingMessages = new Set<string>();
const SENT_STORAGE_KEY = "chatpay_payment_message_sent";
let sentStorageLoaded = false;

function loadSentMessages(): void {
    if (sentStorageLoaded) return;
    sentStorageLoaded = true;
    try {
        const raw = window.localStorage.getItem(SENT_STORAGE_KEY);
        if (!raw) return;
        const values = JSON.parse(raw);
        if (Array.isArray(values)) {
            values.forEach((value) => {
                if (typeof value === "string") sentMessages.add(value);
            });
        }
    } catch {
        // If storage is unavailable, we fall back to in-memory idempotency.
    }
}

function persistSentMessages(): void {
    try {
        window.localStorage.setItem(SENT_STORAGE_KEY, JSON.stringify(Array.from(sentMessages)));
    } catch {
        // Storage failures shouldn't block message sending.
    }
}

export function wasPaymentMessageSent(txId: string | undefined | null): boolean {
    if (!txId) return false;
    loadSentMessages();
    return sentMessages.has(txId);
}

export function markPaymentMessageSent(txId: string | undefined | null): void {
    if (!txId) return;
    loadSentMessages();
    sentMessages.add(txId);
    persistSentMessages();
}

export function claimPaymentMessageSend(txId: string | undefined | null): boolean {
    if (!txId) return false;
    loadSentMessages();
    if (sentMessages.has(txId) || sendingMessages.has(txId)) return false;
    sendingMessages.add(txId);
    return true;
}

export function finalizePaymentMessageSend(txId: string | undefined | null, success: boolean): void {
    if (!txId) return;
    if (success) {
        markPaymentMessageSent(txId);
    }
    sendingMessages.delete(txId);
}

function resolveVerificationConfig(): VerificationConfig {
    return (SdkConfig.get("payment_verification") as VerificationConfig) || {};
}

function resolveStatusUrl(config: VerificationConfig): string {
    if (config.status_url) return config.status_url;
    if (!config.status_path) return "";
    return `${SdkConfig.get("backend_url")}${config.status_path}`;
}

function applyUrlTemplate(url: string, txId?: string, payloadUuid?: string): { url: string; usedTemplate: boolean } {
    let resolved = url;
    let usedTemplate = false;
    if (txId && resolved.includes("{txId}")) {
        resolved = resolved.replace("{txId}", encodeURIComponent(txId));
        usedTemplate = true;
    }
    if (payloadUuid && resolved.includes("{payloadUuid}")) {
        resolved = resolved.replace("{payloadUuid}", encodeURIComponent(payloadUuid));
        usedTemplate = true;
    }
    return { url: resolved, usedTemplate };
}

function normalizeStatusValue(status?: string): string | undefined {
    if (!status) return undefined;
    return status.toLowerCase();
}

function normalizeStatusList(values?: string[]): string[] {
    if (!values) return [];
    return values.map((value) => value.toLowerCase());
}

function interpretVerificationResponse(
    data: any,
    config: VerificationConfig,
    fallbackTxId?: string,
): LedgerVerificationResult {
    const statusValue = typeof data?.status === "string" ? normalizeStatusValue(data.status) : undefined;
    const successStatuses = normalizeStatusList(config.success_statuses);
    const failureStatuses = normalizeStatusList(config.failure_statuses);
    const pendingStatuses = normalizeStatusList(config.pending_statuses);

    if (data?.success === true) {
        return { outcome: "success", status: statusValue, txId: data?.txid || data?.tx_id || fallbackTxId, response: data };
    }

    if (data?.success === false) {
        return { outcome: "failed", status: statusValue, txId: data?.txid || data?.tx_id || fallbackTxId, response: data };
    }

    if (statusValue) {
        if (successStatuses.includes(statusValue)) {
            return { outcome: "success", status: statusValue, txId: data?.txid || data?.tx_id || fallbackTxId, response: data };
        }
        if (failureStatuses.includes(statusValue)) {
            return { outcome: "failed", status: statusValue, txId: data?.txid || data?.tx_id || fallbackTxId, response: data };
        }
        if (pendingStatuses.includes(statusValue)) {
            return { outcome: "pending", status: statusValue, txId: data?.txid || data?.tx_id || fallbackTxId, response: data };
        }
    }

    return { outcome: "pending", status: statusValue, txId: data?.txid || data?.tx_id || fallbackTxId, response: data };
}

export async function verifyTransactionOnLedger({
    txId,
    payloadUuid,
}: {
    txId?: string;
    payloadUuid?: string;
}): Promise<LedgerVerificationResult> {
    const key = txId || payloadUuid;
    if (!key) {
        return { outcome: "failed" };
    }

    if (completed.has(key)) {
        return completed.get(key)!;
    }

    if (inFlight.has(key)) {
        return inFlight.get(key)!;
    }

    const verificationPromise = (async (): Promise<LedgerVerificationResult> => {
        const config = resolveVerificationConfig();
        const statusUrl = resolveStatusUrl(config);

        if (!statusUrl) {
            // We don't emit messages without an explicit verification endpoint.
            return { outcome: "unconfigured" };
        }

        const pollingIntervalMs = config.polling_interval_ms ?? 0;
        const timeoutMs = config.timeout_ms ?? 0;
        const maxRetries = config.max_retries ?? 0;
        const requestTimeoutMs = config.request_timeout_ms ?? undefined;
        const requestMethod = (config.request_method || "POST").toUpperCase() as "GET" | "POST";

        const deadline = timeoutMs > 0 ? Date.now() + timeoutMs : undefined;
        let attempt = 0;
        let lastResult: LedgerVerificationResult = { outcome: "pending" };

        while (attempt < maxRetries && (!deadline || Date.now() <= deadline)) {
            attempt += 1;
            try {
                const { url, usedTemplate } = applyUrlTemplate(statusUrl, txId, payloadUuid);
                const payload = {
                    tx_id: txId,
                    payload_uuid: payloadUuid,
                };

                const request: AxiosRequestConfig = {
                    url,
                    method: requestMethod,
                    timeout: requestTimeoutMs,
                };

                if (!usedTemplate) {
                    if (requestMethod === "GET") {
                        request.params = payload;
                    } else {
                        request.data = payload;
                    }
                }

                const response = await axios.request(request);
                lastResult = interpretVerificationResponse(response.data, config, txId);

                if (lastResult.outcome !== "pending") {
                    return lastResult;
                }
            } catch (error) {
                lastResult = { outcome: "error", response: error };
            }

            if (pollingIntervalMs > 0) {
                await sleep(pollingIntervalMs);
            } else {
                break;
            }
        }

        if (lastResult.outcome === "pending" || lastResult.outcome === "error") {
            return { outcome: "timeout", status: lastResult.status, txId: lastResult.txId, response: lastResult.response };
        }

        return lastResult;
    })();

    inFlight.set(key, verificationPromise);

    try {
        const result = await verificationPromise;
        completed.set(key, result);
        return result;
    } finally {
        inFlight.delete(key);
    }
}
