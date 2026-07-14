import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { liveMarkdownDecorations, liveMarkdownPresentation } from "./liveMarkdownPresentation";

function decorationCount(state: EditorState): number {
    let count = 0;
    state.field(liveMarkdownDecorations).between(0, state.doc.length, () => { count++; });
    return count;
}

describe("liveMarkdownPresentation", () => {
    it("styles GFM syntax from the Lezer tree without changing source text", () => {
        const source = "# 标题\n\n**bold** *em* ~~gone~~ `code` [link](https://example.com)\n\n- [x] task\n";
        const state = EditorState.create({
            doc: source,
            extensions: [markdown({ base: markdownLanguage }), liveMarkdownPresentation],
        });

        expect(state.doc.toString()).toBe(source);
        expect(decorationCount(state)).toBeGreaterThan(5);
    });

    it("maps existing decorations and rebuilds only the changed line neighborhood", () => {
        const state = EditorState.create({
            doc: "# one\n\n**two**\n\n# three\n",
            extensions: [markdown({ base: markdownLanguage }), liveMarkdownPresentation],
        });
        const updated = state.update({ changes: { from: 2, to: 5, insert: "first" } }).state;

        expect(updated.doc.toString()).toBe("# first\n\n**two**\n\n# three\n");
        expect(decorationCount(updated)).toBeGreaterThan(2);
    });
});
