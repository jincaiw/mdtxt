import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { FileConflictDialog } from "./FileConflictDialog";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

afterEach(() => {
    cleanup();
    vi.mocked(invoke).mockReset();
});

describe("FileConflictDialog", () => {
    const props = () => ({
        isOpen: true,
        path: "/notes/example.md",
        fileName: "example.md",
        localContent: "local draft",
        onClose: vi.fn(),
        onKeepLocal: vi.fn(),
        onReload: vi.fn(),
        onSaveCopy: vi.fn(),
    });

    it("makes compare, keep-local, save-copy, and reload explicit non-destructive choices", async () => {
        const handlers = props();
        vi.mocked(invoke).mockResolvedValue({ content: "disk draft" });
        render(<FileConflictDialog {...handlers} />);

        fireEvent.click(screen.getByRole("button", { name: "Compare versions" }));
        expect(await screen.findByText("local draft")).toBeInTheDocument();
        expect(await screen.findByText("disk draft")).toBeInTheDocument();
        expect(invoke).toHaveBeenCalledWith("read_file", { path: "/notes/example.md" });

        fireEvent.click(screen.getByRole("button", { name: "Keep local" }));
        expect(handlers.onKeepLocal).toHaveBeenCalledOnce();
        expect(handlers.onReload).not.toHaveBeenCalled();
        expect(handlers.onSaveCopy).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Save As…" }));
        fireEvent.click(screen.getByRole("button", { name: "Reload disk version" }));
        expect(handlers.onSaveCopy).toHaveBeenCalledOnce();
        expect(handlers.onReload).toHaveBeenCalledOnce();
    });
});
