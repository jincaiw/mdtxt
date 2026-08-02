import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useGlobalShortcuts, type ShortcutHandlers } from "./useGlobalShortcuts";

// Unmount between tests so each harness's window keydown listener is removed
// (auto-cleanup isn't configured globally); otherwise listeners stack up.
afterEach(cleanup);

function makeHandlers(over: Partial<ShortcutHandlers> = {}): ShortcutHandlers {
    return {
        handleOpenFile: vi.fn(),
        handleSaveFile: vi.fn(),
        handleSaveAs: vi.fn(),
        handleNewFile: vi.fn(),
        handleToggleMode: vi.fn(),
        toggleFullscreen: vi.fn(),
        handleToggleFileExplorer: vi.fn(),
        handleToggleTOC: vi.fn(),
        openCheatsheet: vi.fn(),
        openQuickOpen: vi.fn(),
        openPalette: vi.fn(),
        openSettings: vi.fn(),
        hasFile: true,
        content: "hello",
        ...over,
    };
}

function Harness({ handlers }: { handlers: ShortcutHandlers }) {
    useGlobalShortcuts(handlers);
    return null;
}

function press(init: KeyboardEventInit) {
    window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
}

describe("useGlobalShortcuts", () => {
    let h: ShortcutHandlers;
    beforeEach(() => {
        h = makeHandlers();
        render(<Harness handlers={h} />);
    });

    it("Ctrl+S saves", () => {
        press({ key: "s", ctrlKey: true });
        expect(h.handleSaveFile).toHaveBeenCalledTimes(1);
    });

    it("Ctrl+S still saves with CapsLock on (key reports 'S')", () => {
        // The regression this guards: an unshifted Ctrl+S under CapsLock reports
        // e.key === "S" and used to fall through to nothing.
        press({ key: "S", ctrlKey: true, shiftKey: false });
        expect(h.handleSaveFile).toHaveBeenCalledTimes(1);
        expect(h.handleSaveAs).not.toHaveBeenCalled();
    });

    it("Ctrl+Shift+S triggers Save As, not Save", () => {
        press({ key: "S", ctrlKey: true, shiftKey: true });
        expect(h.handleSaveAs).toHaveBeenCalledTimes(1);
        expect(h.handleSaveFile).not.toHaveBeenCalled();
    });

    it("Ctrl+O / Ctrl+N work case-insensitively", () => {
        press({ key: "O", ctrlKey: true });
        press({ key: "n", ctrlKey: true });
        expect(h.handleOpenFile).toHaveBeenCalledTimes(1);
        expect(h.handleNewFile).toHaveBeenCalledTimes(1);
    });

    it("Ctrl+/ toggles Typora-compatible source mode only when a file is open", () => {
        press({ key: "/", ctrlKey: true });
        expect(h.handleToggleMode).toHaveBeenCalledTimes(1);
    });

    it("Cmd+/ also toggles source mode", () => {
        press({ key: "/", metaKey: true });
        expect(h.handleToggleMode).toHaveBeenCalledTimes(1);
    });

    it("Ctrl+P opens Quick Open while Ctrl+Shift+P opens the command palette", () => {
        press({ key: "p", ctrlKey: true });
        press({ key: "p", ctrlKey: true, shiftKey: true });
        press({ key: ",", ctrlKey: true });
        expect(h.openQuickOpen).toHaveBeenCalledTimes(1);
        expect(h.openPalette).toHaveBeenCalledTimes(1);
        expect(h.openSettings).toHaveBeenCalledTimes(1);
    });

    it("F11 toggles fullscreen", () => {
        press({ key: "F11" });
        press({ key: "f", metaKey: true, altKey: true });
        expect(h.toggleFullscreen).toHaveBeenCalledTimes(2);
    });

    it("supports Typora's macOS new-tab and reopen bindings", () => {
        h.reopenClosedTab = vi.fn();
        press({ key: "t", metaKey: true });
        press({ key: "t", metaKey: true, shiftKey: true });
        expect(h.handleNewFile).toHaveBeenCalledTimes(1);
        expect(h.reopenClosedTab).toHaveBeenCalledTimes(1);
    });

    it("Alt+Shift+J dispatches the non-conflicting AI-assist event", () => {
        const onAi = vi.fn();
        window.addEventListener("mdtxt:ai-assist", onAi);
        press({ key: "j", altKey: true, shiftKey: true });
        window.removeEventListener("mdtxt:ai-assist", onAi);
        expect(onAi).toHaveBeenCalledTimes(1);
    });

    it("uses Typora's Cmd+backtick binding to cycle opened documents", () => {
        const nextTab = vi.fn();
        cleanup();
        h = makeHandlers({ nextTab });
        render(<Harness handlers={h} />);
        press({ key: "`", metaKey: true });
        press({ key: "`", metaKey: true, shiftKey: true });
        expect(nextTab).toHaveBeenCalledTimes(1);
    });
});

describe("useGlobalShortcuts gating", () => {
    it("does not save when there is no file and no content", () => {
        const h = makeHandlers({ hasFile: false, content: "" });
        render(<Harness handlers={h} />);
        press({ key: "s", ctrlKey: true });
        expect(h.handleSaveFile).not.toHaveBeenCalled();
    });

    it("switches recovered unsaved tabs without shadowing Typora heading shortcuts", () => {
        const h = makeHandlers({ hasFile: false, content: "", gotoTab: vi.fn(), prevTab: vi.fn(), nextTab: vi.fn() });
        render(<Harness handlers={h} />);
        press({ key: "1", ctrlKey: true });
        press({ key: "1", altKey: true });
        press({ key: "Tab", ctrlKey: true, shiftKey: true });
        press({ key: "PageUp", ctrlKey: true });
        press({ key: "PageDown", ctrlKey: true });
        expect(h.gotoTab).toHaveBeenCalledWith(0);
        expect(h.prevTab).toHaveBeenCalledTimes(2);
        expect(h.nextTab).toHaveBeenCalledTimes(1);
    });

    it("uses Typora's Windows/Linux outline, articles, and file-tree bindings", () => {
        const h = makeHandlers({ handleToggleTOC: vi.fn(), showArticles: vi.fn(), showFileTree: vi.fn() });
        render(<Harness handlers={h} />);
        press({ key: "1", ctrlKey: true, shiftKey: true });
        press({ key: "2", ctrlKey: true, shiftKey: true });
        press({ key: "3", ctrlKey: true, shiftKey: true });
        expect(h.handleToggleTOC).toHaveBeenCalledTimes(1);
        expect(h.showArticles).toHaveBeenCalledTimes(1);
        expect(h.showFileTree).toHaveBeenCalledTimes(1);
    });

    it("Ctrl+F opens preview find only in reader mode", () => {
        const h = makeHandlers({ mode: "preview", openPreviewFind: vi.fn() });
        render(<Harness handlers={h} />);
        press({ key: "f", ctrlKey: true });
        expect(h.openPreviewFind).toHaveBeenCalledTimes(1);
    });

    it("Ctrl+F is left to the editor in code mode", () => {
        const h = makeHandlers({ mode: "code", openPreviewFind: vi.fn() });
        render(<Harness handlers={h} />);
        press({ key: "f", ctrlKey: true });
        expect(h.openPreviewFind).not.toHaveBeenCalled();
    });
});
