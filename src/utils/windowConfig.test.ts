// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function config(path: string) {
    return JSON.parse(readFileSync(resolve(__dirname, "../../", path), "utf8"));
}

describe("native window configuration", () => {
    it("uses system decorations by default for Windows and Linux", () => {
        const base = config("src-tauri/tauri.conf.json");
        expect(base.app.windows).toHaveLength(1);
        expect(base.app.windows[0].decorations).toBe(true);
    });

    it("uses a native macOS overlay title bar without private APIs", () => {
        const macos = config("src-tauri/tauri.macos.conf.json");
        const window = macos.app.windows[0];
        expect(window.decorations).toBe(true);
        expect(window.titleBarStyle).toBe("Overlay");
        expect(window.hiddenTitle).toBe(true);
        expect(macos.app.macOSPrivateApi).toBeUndefined();
    });

    it("grants the title synchronisation permission", () => {
        const capability = config("src-tauri/capabilities/default.json");
        expect(capability.permissions).toContain("core:window:allow-set-title");
    });
});
