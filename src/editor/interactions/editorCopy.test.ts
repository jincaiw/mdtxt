import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState } from "@codemirror/state";
import { createEditorClipboardPayload, selectedMarkdown } from "./editorCopy";

describe("editor rich copy", () => {
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

});
