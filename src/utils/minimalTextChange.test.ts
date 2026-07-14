import { describe, expect, it } from "vitest";
import { minimalTextChange } from "./minimalTextChange";

function apply(before: string, change: NonNullable<ReturnType<typeof minimalTextChange>>): string {
    return before.slice(0, change.from) + change.insert + before.slice(change.to);
}

describe("minimalTextChange", () => {
    it("returns null when no content changed", () => {
        expect(minimalTextChange("same", "same")).toBeNull();
    });

    it("isolates a middle insertion", () => {
        const change = minimalTextChange("before after", "before middle after");
        expect(change).toEqual({ from: 7, to: 7, insert: "middle " });
        expect(apply("before after", change!)).toBe("before middle after");
    });

    it("isolates a middle deletion", () => {
        const change = minimalTextChange("before middle after", "before after");
        expect(change).toEqual({ from: 7, to: 14, insert: "" });
        expect(apply("before middle after", change!)).toBe("before after");
    });

    it("retains the longest common prefix and suffix for a replacement", () => {
        const before = "# Title\n\nunchanged\n\nold paragraph\n\nfooter\n";
        const after = "# Title\n\nunchanged\n\nnew paragraph\n\nfooter\n";
        const change = minimalTextChange(before, after);

        expect(change).toEqual({ from: 20, to: 23, insert: "new" });
        expect(apply(before, change!)).toBe(after);
    });

    it("uses CodeMirror-compatible UTF-16 offsets for Chinese and emoji text", () => {
        const before = "前缀 😀 markdown 后缀";
        const after = "前缀 😀 mdtxt 后缀";
        const change = minimalTextChange(before, after);

        // Both strings begin this token with `m`, so the true minimal edit only
        // replaces the remaining UTF-16 code units.
        expect(change).toEqual({ from: 7, to: 14, insert: "dtxt" });
        expect(apply(before, change!)).toBe(after);
    });
});
