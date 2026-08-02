import { describe, expect, it } from "vitest";
import { getTyporaCommand, shortcutFor, TYPOGRAPHIC_COMMANDS } from "./typoraCommandRegistry";

describe("Typora command registry", () => {
    it("keeps every registered command uniquely addressable", () => {
        expect(new Set(TYPOGRAPHIC_COMMANDS.map((command) => command.id)).size).toBe(TYPOGRAPHIC_COMMANDS.length);
    });

    it("locks the conflicting desktop defaults to Typora semantics", () => {
        expect(shortcutFor("view.source", "windows")).toBe("Ctrl+/");
        expect(shortcutFor("view.source", "macos")).toBe("Cmd+/");
        expect(shortcutFor("file.quickOpen", "windows")).toBe("Ctrl+P");
        expect(shortcutFor("file.quickOpen", "macos")).toBe("Cmd+Shift+O");
        expect(shortcutFor("file.newTab", "macos")).toBe("Cmd+T");
        expect(shortcutFor("file.reopenClosed", "macos")).toBe("Cmd+Shift+T");
        expect(shortcutFor("paragraph.heading1", "windows")).toBe("Ctrl+1");
        expect(shortcutFor("edit.copyMarkdown", "macos")).toBe("Cmd+Shift+C");
        expect(shortcutFor("format.image", "windows")).toBe("Ctrl+Shift+I");
        expect(shortcutFor("format.image", "macos")).toBe("Cmd+Ctrl+I");
        expect(shortcutFor("format.clear", "windows")).toBe("Ctrl+\\");
        expect(shortcutFor("format.clear", "macos")).toBe("Cmd+\\");
        expect(shortcutFor("window.nextDocument", "windows")).toBe("Ctrl+Tab");
        expect(shortcutFor("window.nextDocument", "macos")).toBe("Cmd+`");
    });

    it("exposes menu labels from the same declaration", () => {
        expect(getTyporaCommand("paragraph.mathBlock")).toMatchObject({
            section: "Paragraph",
            label: "Math block",
        });
    });
});
