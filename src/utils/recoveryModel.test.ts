import { describe, expect, it } from "vitest";
import { orderRecoveryEntries, selectRecoveredActive } from "./recoveryModel";

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
});
