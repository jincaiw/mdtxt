// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { getInitialLocale, messages, translate } from "./LocaleContext";

afterEach(() => vi.unstubAllGlobals());

describe("translate", () => {
    it("returns Simplified Chinese for a known UI string", () => {
        expect(translate("zh-CN", "Settings")).toBe("设置");
    });

    it("localizes every app-owned native menu label", () => {
        const menuLabels = [
            "File", "Edit", "Format", "View", "Window", "Help",
            "Heading 1", "Heading 2", "Heading 3", "Heading 4", "Heading 5", "Heading 6",
            "Paragraph", "Bold", "Italic", "Strikethrough", "Inline code", "Link",
            "Bullet list", "Numbered list", "Task list", "Blockquote", "Code block", "Insert table", "Horizontal rule",
            "Source", "Split", "Reader", "File explorer", "Outline", "Formatting toolbar", "Typewriter mode",
            "Keyboard shortcuts", "Open the interactive guide", "Replay the welcome tour",
        ];

        for (const label of menuLabels) {
            expect(translate("zh-CN", label), `${label} should not fall back to English`).not.toBe(label);
        }

        // Live Beta is a deliberately stable product-mode name, as is AI.
        expect(translate("zh-CN", "Live Beta")).toBe("Live Beta");
    });

    it("keeps English as the stable fallback", () => {
        expect(translate("en", "Settings")).toBe("Settings");
        expect(translate("zh-CN", "A newly added string")).toBe("A newly added string");
    });

    it("interpolates values in both locales", () => {
        expect(translate("zh-CN", "Close {file}", { file: "notes.md" })).toBe("关闭 notes.md");
        expect(translate("en", "Close {file}", { file: "notes.md" })).toBe("Close notes.md");
    });

    it("keeps both locale catalogues and interpolation variables in sync", () => {
        const englishKeys = Object.keys(messages.en).sort();
        const chineseKeys = Object.keys(messages["zh-CN"]).sort();
        expect(chineseKeys).toEqual(englishKeys);

        for (const key of englishKeys) {
            const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
            expect(placeholders(messages["zh-CN"][key])).toEqual(placeholders(messages.en[key]));
        }
    });

    it("defaults to Simplified Chinese and migrates a legacy locale once", () => {
        const values = new Map<string, string>([["paperling-locale", "en"]]);
        vi.stubGlobal("localStorage", {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => values.set(key, value),
        });

        expect(getInitialLocale()).toBe("en");
        expect(values.get("mdtxt-locale")).toBe("en");

        values.clear();
        expect(getInitialLocale()).toBe("zh-CN");
    });
});
