import { describe, expect, it, vi, afterEach } from "vitest";
import { getDesktopPlatform, nativeWindowTitle } from "./desktopPlatform";

afterEach(() => vi.unstubAllGlobals());

describe("getDesktopPlatform", () => {
    it("keeps browser development free of fake window controls", () => {
        vi.stubGlobal("window", {});
        expect(getDesktopPlatform()).toBe("browser");
    });

    it.each([
        ["MacIntel", "macOS", "macos"],
        ["Win32", "Windows", "windows"],
        ["Linux x86_64", "Linux", "linux"],
    ] as const)("detects %s", (platform, userAgent, expected) => {
        vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
        vi.stubGlobal("navigator", { platform, userAgent });
        expect(getDesktopPlatform()).toBe(expected);
    });
});

describe("nativeWindowTitle", () => {
    it("includes dirty state only for a document title", () => {
        expect(nativeWindowTitle()).toBe("mdtxt");
        expect(nativeWindowTitle("notes.md")).toBe("notes.md — mdtxt");
        expect(nativeWindowTitle("notes.md", true)).toBe("notes.md * — mdtxt");
    });
});
