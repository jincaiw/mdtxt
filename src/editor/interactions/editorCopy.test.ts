import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditorSelection, EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { writeHtml, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { copySelectedMarkdownAsRichText, copySelectedMarkdownPlain, createEditorClipboardPayload, selectedMarkdown } from "./editorCopy";

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({ writeHtml: vi.fn(), writeText: vi.fn() }));

describe("editor rich copy", () => {
    beforeEach(() => vi.clearAllMocks());

    it("keeps exact Markdown in text/plain and emits semantic GFM HTML", () => {
        const markdown = "# Heading\n\n**bold** and [link](https://example.com)\n\n| A | B |\n| - | - |\n| 1 | 2 |";
        const payload = createEditorClipboardPayload(markdown);

        expect(payload.plainText).toBe(markdown);
        expect(payload.html).toContain("<h1>Heading</h1>");
        expect(payload.html).toContain("<strong>bold</strong>");
        expect(payload.html).toContain('<a href="https://example.com">link</a>');
        expect(payload.html).toContain("<table>");
    });

    it("does not promote raw document HTML into clipboard HTML", () => {
        const payload = createEditorClipboardPayload('<img src=x onerror="alert(1)">');
        expect(payload.html).toContain("&lt;img");
        expect(payload.html).not.toContain("<img");
    });

    it("uses the canonical document text for one or more selections", () => {
        const state = EditorState.create({
            doc: "alpha beta gamma",
            selection: EditorSelection.create([
                EditorSelection.range(0, 5),
                EditorSelection.range(11, 16),
            ]),
            extensions: [EditorState.allowMultipleSelections.of(true)],
        });
        expect(selectedMarkdown(state)).toBe("alpha\ngamma");
        expect(selectedMarkdown(EditorState.create({ doc: "alpha" }))).toBeNull();
    });

    it("copies exact source text for Typora's Copy as Markdown command", async () => {
        const state = EditorState.create({ doc: "**bold**", selection: { anchor: 0, head: 8 } });
        await expect(copySelectedMarkdownPlain({ state } as EditorView)).resolves.toBe(true);
        expect(writeText).toHaveBeenCalledWith("**bold**");
    });

    it("writes both HTML and exact Markdown for Copy formatted selection", async () => {
        const state = EditorState.create({ doc: "**bold**", selection: { anchor: 0, head: 8 } });
        await expect(copySelectedMarkdownAsRichText({ state } as EditorView)).resolves.toBe(true);
        expect(writeHtml).toHaveBeenCalledWith("<p><strong>bold</strong></p>", "**bold**");
    });

});
