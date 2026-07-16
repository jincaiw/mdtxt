import { describe, expect, it } from "vitest";
import { localizeAIError } from "./aiErrors";

const t = (source: string) => `zh:${source}`;

describe("localizeAIError", () => {
    it("maps known provider failures through the locale catalogue", () => {
        expect(localizeAIError(new Error("API key invalid or unauthorized — check Settings → AI."), t))
            .toBe("zh:API key is invalid or unauthorized. Check Settings → AI.");
    });

    it("does not expose an unknown native or provider message", () => {
        const out = localizeAIError(new Error("secret upstream account detail"), t);
        expect(out).toBe("zh:AI request failed. Check the endpoint and try again.");
        expect(out).not.toContain("secret");
    });
});
