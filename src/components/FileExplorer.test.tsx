import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { FileExplorer } from "./FileExplorer";
import { setWorkspaceState } from "../utils/persistence";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ revealItemInDir: vi.fn() }));

describe("FileExplorer articles view", () => {
    beforeEach(() => {
        localStorage.clear();
        setWorkspaceState({ root: "/notes", expandedPaths: ["/notes"], recentRoots: ["/notes"] });
        vi.mocked(invoke).mockImplementation((command) => {
            if (command === "list_workspace_markdown_files") return Promise.resolve([
                { name: "beta.md", path: "/notes/deep/beta.md", relativePath: "deep/beta.md", modified: 20 },
                { name: "alpha.md", path: "/notes/alpha.md", relativePath: "alpha.md", modified: 10 },
            ]);
            if (command === "list_workspace_entries") return Promise.resolve([]);
            return Promise.reject(new Error(`Unexpected command: ${command}`));
        });
    });

    it("loads the bounded workspace index and opens an article", async () => {
        const onFileSelect = vi.fn();
        render(<FileExplorer isOpen currentFilePath={null} onFileSelect={onFileSelect} onClose={vi.fn()} viewMode="articles" onViewModeChange={vi.fn()} embedded />);

        expect(await screen.findByRole("button", { name: /alpha\.md/ })).toBeInTheDocument();
        expect(screen.getByText("deep/beta.md")).toBeInTheDocument();
        fireEvent.change(screen.getByRole("textbox", { name: "Filter files" }), { target: { value: "deep" } });
        expect(screen.queryByText("alpha.md")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /beta\.md/ }));
        expect(onFileSelect).toHaveBeenCalledWith("/notes/deep/beta.md");
        await waitFor(() => expect(invoke).toHaveBeenCalledWith("list_workspace_markdown_files", { root: "/notes" }));
    });
});
