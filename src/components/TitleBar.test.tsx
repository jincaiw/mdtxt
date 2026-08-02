import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TitleBar } from "./TitleBar";

vi.mock("@tauri-apps/api/window", () => ({ Window: { getCurrent: vi.fn() } }));
vi.mock("./SettingsMenu", () => ({ SettingsMenu: () => <button aria-label="Settings">Settings</button> }));
vi.mock("../context/LocaleContext", () => ({ useLocale: () => ({ t: (text: string) => text }) }));

afterEach(() => {
    cleanup();
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    Object.defineProperty(window.navigator, "platform", { configurable: true, value: "" });
    Object.defineProperty(window.navigator, "userAgent", { configurable: true, value: "jsdom" });
});

function renderTitleBar() {
    return render(<TitleBar fileName="notes.md" filePath="/tmp/notes.md" />);
}

describe("TitleBar native window controls", () => {
    it("does not render emulated minimize, maximize, or close buttons", () => {
        renderTitleBar();
        expect(screen.queryByLabelText("Minimize")).toBeNull();
        expect(screen.queryByLabelText("Maximize")).toBeNull();
        expect(screen.queryByLabelText("Close")).toBeNull();
        expect(screen.getByLabelText("Settings")).toBeInTheDocument();
    });

    it("keeps document tools out of the title bar", () => {
        renderTitleBar();
        expect(screen.queryByLabelText("Mode toggle")).toBeNull();
        expect(screen.queryByLabelText("Export")).toBeNull();
    });

    it("reserves the macOS traffic-light safe area and drag region", () => {
        Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
        Object.defineProperty(window.navigator, "platform", { configurable: true, value: "MacIntel" });
        const { container } = renderTitleBar();
        expect(container.querySelector("header")).toHaveClass("drag-region", "pl-20");
    });

    it("leaves Windows and Linux dragging to the system title bar", () => {
        Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
        Object.defineProperty(window.navigator, "platform", { configurable: true, value: "Win32" });
        const { container } = renderTitleBar();
        expect(container.querySelector("header")).not.toHaveClass("drag-region");
        expect(screen.queryByText("notes.md")).toBeNull();
    });

    it("does not duplicate the product name above the welcome screen", () => {
        Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
        Object.defineProperty(window.navigator, "platform", { configurable: true, value: "MacIntel" });
        render(<TitleBar />);
        expect(screen.queryByText("mdtxt")).toBeNull();
        expect(screen.getByLabelText("Settings")).toBeInTheDocument();
    });
});
