import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import appPackage from "../../package.json";
import { WelcomeScreen } from "./WelcomeScreen";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({
    TauriEvent: { DRAG_ENTER: "drag-enter", DRAG_LEAVE: "drag-leave", DRAG_DROP: "drag-drop" },
    listen: vi.fn(async () => vi.fn()),
}));
vi.mock("../utils/persistence", () => ({
    clearRecentFiles: vi.fn(),
    getRecentFiles: vi.fn(() => []),
    removeRecentFile: vi.fn(() => []),
}));
vi.mock("../context/LocaleContext", () => ({
    useLocale: () => ({ locale: "en", t: (text: string) => text }),
}));

afterEach(cleanup);

describe("WelcomeScreen product identity", () => {
    it("renders the current package version instead of a stale literal", () => {
        render(
            <WelcomeScreen
                onOpenFile={() => {}}
                onFileDrop={() => {}}
            />,
        );

        expect(screen.getByRole("heading", { name: "mdtxt" })).toBeInTheDocument();
        expect(screen.getByText(`v${appPackage.version}`)).toBeInTheDocument();
        expect(screen.queryByText("0.1.0")).toBeNull();
    });
});
