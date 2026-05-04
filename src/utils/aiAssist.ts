/**
 * AI assist — minimal OpenAI-compatible client.
 *
 * Calls the user-configured endpoint with a system prompt and the selected
 * text. Supports endpoints that follow the OpenAI Chat Completions schema:
 *   POST /chat/completions
 *   { model, messages: [{role, content}] }
 *   → { choices: [{ message: { content } }] }
 *
 * Local providers like Ollama (with /v1 prefix) and llama.cpp expose the same
 * shape, so this works for fully-local setups too.
 */

export type AIAction = "rewrite" | "shorten" | "expand" | "continue" | "translate";

const SYSTEM_PROMPTS: Record<AIAction, string> = {
    rewrite: "Rewrite the user's text for clarity and flow. Output the rewritten text only — no preface, no quotes, no explanation.",
    shorten: "Shorten the user's text to about half the length while keeping the meaning. Output the shortened text only.",
    expand: "Expand the user's text with more detail and context. Output the expanded text only.",
    continue: "Continue writing in the same style and tone. Output only the continuation, not the original.",
    translate: "Translate the user's text to English. Output the translation only.",
};

export interface AIConfig {
    endpoint: string;
    model: string;
    apiKey: string;
}

/** True when the URL is well-formed and uses http(s). */
export function isValidEndpoint(raw: string): boolean {
    try {
        const u = new URL(raw);
        return u.protocol === "http:" || u.protocol === "https:";
    } catch {
        return false;
    }
}

export async function runAIAction(
    action: AIAction,
    text: string,
    cfg: AIConfig,
    signal?: AbortSignal
): Promise<string> {
    if (!cfg.endpoint) throw new Error("AI endpoint not configured. Open Settings → AI to set one up.");
    if (!isValidEndpoint(cfg.endpoint)) {
        throw new Error("AI endpoint must be a valid http:// or https:// URL.");
    }
    if (!cfg.model) throw new Error("AI model not configured.");

    const res = await fetch(cfg.endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
        },
        body: JSON.stringify({
            model: cfg.model,
            messages: [
                { role: "system", content: SYSTEM_PROMPTS[action] },
                { role: "user", content: text },
            ],
            temperature: 0.7,
            stream: false,
        }),
        signal,
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`AI request failed (${res.status}): ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const content =
        data?.choices?.[0]?.message?.content ??
        data?.message?.content ?? // ollama native shape, also handled
        "";
    if (!content) throw new Error("AI returned an empty response.");
    return String(content).trim();
}
