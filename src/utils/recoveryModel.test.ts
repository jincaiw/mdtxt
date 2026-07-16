import { describe, expect, it } from "vitest";
import { latestRecoveryBatch, orderRecoveryEntries, recoveredDraftName, selectRecoveredActive } from "./recoveryModel";

describe("recovery session placement", () => {
    it("restores the original tab order and active tab independently of write completion order", () => {
        const recovered = [
            { name: "second", tabIndex: 1, wasActive: true, savedAtMs: 30 },
            { name: "first", tabIndex: 0, wasActive: false, savedAtMs: 40 },
        ];
        const ordered = orderRecoveryEntries(recovered);

        expect(ordered.map((entry) => entry.name)).toEqual(["first", "second"]);
        expect(selectRecoveredActive(ordered)?.name).toBe("second");
    });

    it("keeps legacy entries recoverable without placement metadata", () => {
        const ordered = orderRecoveryEntries([
            { name: "older", savedAtMs: 10 },
            { name: "newer", savedAtMs: 20 },
        ]);

        expect(selectRecoveredActive(ordered)?.name).toBe("newer");
    });

    it("keeps Restore all within the newest crash session instead of mixing tab indexes", () => {
        const entries = [
            { name: "old first", recoverySessionId: "old", tabIndex: 0, savedAtMs: 10 },
            { name: "old second", recoverySessionId: "old", tabIndex: 1, savedAtMs: 11 },
            { name: "new first", recoverySessionId: "new", tabIndex: 0, savedAtMs: 20 },
            { name: "new second", recoverySessionId: "new", tabIndex: 1, savedAtMs: 21 },
        ];

        expect(latestRecoveryBatch(entries).map((entry) => entry.name)).toEqual(["new first", "new second"]);
    });

    it("keeps one localized recovery prefix across repeated crash recovery", () => {
        expect(recoveredDraftName("已恢复 — 已恢复 — Untitled-1.md", "已恢复"))
            .toBe("已恢复 — Untitled-1.md");
        expect(recoveredDraftName("Recovered — 已恢复 — Notes.md", "Recovered"))
            .toBe("Recovered — Notes.md");
    });
});
