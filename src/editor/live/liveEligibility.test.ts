import { describe, expect, it } from "vitest";
import { assessLiveEligibility, assessLiveEligibilityForTransition, LIVE_LIMITS, selectLiveEligibilitySource } from "./liveEligibility";

describe("assessLiveEligibility", () => {
    it("keeps normal Markdown in full Live", () => {
        expect(assessLiveEligibility("# 标题\n\nA short note.")).toMatchObject({
            restricted: false,
            lines: 3,
            reasons: [],
        });
    });

    it("uses UTF-8 byte size rather than UTF-16 length", () => {
        const source = "中".repeat(Math.floor(LIVE_LIMITS.maxBytes / 3) + 1);
        const eligibility = assessLiveEligibility(source);
        expect(eligibility.bytes).toBeGreaterThan(LIVE_LIMITS.maxBytes);
        expect(eligibility.reasons).toContain("bytes");
        expect(eligibility.complexBlocks).toBe(0);
    });

    it("limits pathological line and complex-block documents", () => {
        const longLine = "x".repeat(LIVE_LIMITS.maxLineLength + 1);
        const complex = Array.from({ length: LIVE_LIMITS.maxComplexBlocks + 1 }, () => "![x](image.png)").join("\n");
        const eligibility = assessLiveEligibility(`${longLine}\n${complex}`);
        expect(eligibility.reasons).toEqual(expect.arrayContaining(["lineLength", "complexBlocks"]));
    });

    it("counts only Lezer-recognized complex nodes instead of image-shaped source text", () => {
        const literalImages = Array.from(
            { length: LIVE_LIMITS.maxComplexBlocks + 1 },
            () => "`![not-an-image](literal.png)`",
        ).join("\n");
        const eligibility = assessLiveEligibility(literalImages);

        expect(eligibility.complexBlocks).toBe(0);
        expect(eligibility.reasons).not.toContain("complexBlocks");
    });

    it("uses a current editor snapshot at transitions and a matched presentation revision after debounce", () => {
        const active = { documentId: "draft", version: 2, value: "current oversized source" };
        const stalePresentation = { documentId: "draft", version: 1, value: "previous short source" };
        const currentPresentation = { documentId: "draft", version: 2, value: "current oversized source" };

        expect(selectLiveEligibilitySource(active, stalePresentation)).toBe(active.value);
        expect(selectLiveEligibilitySource(active, currentPresentation)).toBe(currentPresentation.value);
        expect(selectLiveEligibilitySource(active, { ...currentPresentation, documentId: "other" })).toBe(active.value);
    });

    it("restricts a certainly oversized transition without scanning its structure", () => {
        const eligibility = assessLiveEligibilityForTransition("x".repeat(LIVE_LIMITS.maxBytes + 1));
        expect(eligibility).toMatchObject({ restricted: true, reasons: ["bytes"], complexBlocks: 0 });
    });
});
