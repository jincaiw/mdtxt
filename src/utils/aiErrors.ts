import type { TranslationParams } from "../context/LocaleContext";

type Translate = (source: string, params?: TranslationParams) => string;

/**
 * Convert transport/provider failures into a bounded user-facing message.
 * Provider response bodies and native error strings can contain endpoint or
 * account details, so unknown failures deliberately collapse to a safe error.
 */
export function localizeAIError(error: unknown, t: Translate): string {
    if (error instanceof DOMException && error.name === "AbortError") return t("AI request cancelled.");
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (/endpoint not configured|configure an ai endpoint/i.test(message)) return t("Configure an AI endpoint in Settings → AI first.");
    if (/valid http:\/\/ or https:\/\/ url/i.test(message)) return t("AI endpoint must be a valid http:// or https:// URL.");
    if (/model not configured/i.test(message)) return t("AI model is not configured.");
    if (/invalid or unauthorized/i.test(message)) return t("API key is invalid or unauthorized. Check Settings → AI.");
    if (/not found \(404\)/i.test(message)) return t("AI endpoint was not found. Check Settings → AI.");
    if (/rate limited \(429\)/i.test(message)) return t("AI service is rate limited. Wait a moment and try again.");
    if (/service unavailable/i.test(message)) return t("AI service is unavailable. Try again later.");
    if (/timed out|did not respond/i.test(message)) return t("AI request timed out. Try again.");
    if (/empty response/i.test(message)) return t("AI service returned an empty response.");
    return t("AI request failed. Check the endpoint and try again.");
}
