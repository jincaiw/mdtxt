import { describe, expect, it } from "vitest";
import { rangeIntersectsEditFocus, resolveEditFocus } from "./editFocusResolver";

describe("resolveEditFocus", () => {
    it("merges multi-selection, pointer and find ranges into one source contract", () => {
        const resolution = resolveEditFocus({
            selections: [{ from: 12, to: 8 }, { from: 20, to: 24 }],
            pointerTarget: { from: 10, to: 16 },
            findRanges: [{ from: 24, to: 30 }],
            compositionStarted: false,
        });

        expect(resolution).toMatchObject({
            sourceRanges: [{ from: 8, to: 16 }, { from: 20, to: 30 }],
            keepAllSource: false,
            canCollapseMarkers: true,
        });
        expect(rangeIntersectsEditFocus({ from: 9, to: 11 }, resolution)).toBe(true);
        expect(rangeIntersectsEditFocus({ from: 16, to: 20 }, resolution)).toBe(false);
    });

    it("forbids collapsed markers for the full IME composition lifecycle", () => {
        const resolution = resolveEditFocus({
            selections: [{ from: 4, to: 4 }],
            compositionStarted: true,
            compositionRanges: [{ from: 4, to: 7 }],
        });

        expect(resolution).toMatchObject({
            sourceRanges: [{ from: 4, to: 7 }],
            keepAllSource: true,
            canCollapseMarkers: false,
        });
        expect(rangeIntersectsEditFocus({ from: 100, to: 101 }, resolution)).toBe(true);
    });

    it("keeps a collapsed caret as a focus point for a surrounding syntax node", () => {
        const resolution = resolveEditFocus({ selections: [{ from: 5, to: 5 }], compositionStarted: false });
        expect(resolution.sourceRanges).toEqual([{ from: 5, to: 5 }]);
        expect(rangeIntersectsEditFocus({ from: 2, to: 8 }, resolution)).toBe(true);
    });
});
