import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LocaleProvider } from "../context/LocaleContext";
import { RecoveryDialog, type RecoveryCandidate } from "./RecoveryDialog";

const recovery: RecoveryCandidate = {
    documentId: "recovery-1",
    name: "draft.md",
    content: "unsaved draft",
    savedAtMs: Date.UTC(2026, 6, 15),
};

const secondRecovery: RecoveryCandidate = {
    ...recovery,
    documentId: "recovery-2",
    name: "second.md",
    tabIndex: 1,
    wasActive: true,
};

afterEach(cleanup);

describe("RecoveryDialog", () => {
    beforeEach(() => {
        localStorage.clear();
        localStorage.setItem("mdtxt-locale", "en");
    });

    it("keeps recovery actions explicit and focuses the safe restore choice", () => {
        const onRestore = vi.fn();
        const onDiscard = vi.fn();
        render(
            <LocaleProvider>
                <RecoveryDialog entries={[recovery]} onRestore={onRestore} onRestoreAll={vi.fn()} onDiscard={onDiscard} />
            </LocaleProvider>,
        );

        expect(screen.getByRole("alertdialog")).toHaveAccessibleName("Recover unsaved documents");
        expect(screen.getByText("draft.md")).toBeInTheDocument();
        expect(screen.getByText(/never overwrites the disk file/i)).toBeInTheDocument();

        const restore = screen.getByRole("button", { name: "Restore" });
        expect(restore).toHaveFocus();
        fireEvent.click(screen.getByRole("button", { name: "Discard" }));
        fireEvent.click(restore);

        expect(onDiscard).toHaveBeenCalledWith(recovery);
        expect(onRestore).toHaveBeenCalledWith(recovery);
    });

    it("does not render a recovery prompt without verified entries", () => {
        render(
            <LocaleProvider>
                <RecoveryDialog entries={[]} onRestore={vi.fn()} onRestoreAll={vi.fn()} onDiscard={vi.fn()} />
            </LocaleProvider>,
        );

        expect(screen.queryByRole("alertdialog")).toBeNull();
    });

    it("offers one explicit restore-all action for a recoverable tab group", () => {
        const onRestoreAll = vi.fn();
        render(
            <LocaleProvider>
                <RecoveryDialog entries={[recovery, secondRecovery]} onRestore={vi.fn()} onRestoreAll={onRestoreAll} onDiscard={vi.fn()} />
            </LocaleProvider>,
        );

        const restoreAll = screen.getByRole("button", { name: "Restore all" });
        expect(restoreAll).toHaveFocus();
        fireEvent.click(restoreAll);
        expect(onRestoreAll).toHaveBeenCalledWith([recovery, secondRecovery]);
    });
});
