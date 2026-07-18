import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { syntaxTree, syntaxTreeAvailable } from "@codemirror/language";
import {
    EAGER_SOURCE_SYNTAX_LIMIT,
    eagerlyParseSourceSyntax,
    LARGE_SOURCE_SYNTAX_LIMIT,
    sourceSyntaxExtensions,
} from "./useCodeMirrorHost";

describe("large Source performance policy", () => {
    it("keeps Markdown syntax below the threshold and pauses it above the threshold", () => {
        const source = "# heading\n\nplain text\n";
        const normal = EditorState.create({ doc: source, extensions: sourceSyntaxExtensions(source.length) });
        const restricted = EditorState.create({ doc: source, extensions: sourceSyntaxExtensions(LARGE_SOURCE_SYNTAX_LIMIT + 1) });

        expect(syntaxTree(normal).type.name).toBe("Document");
        expect(syntaxTree(normal).length).toBe(source.length);
        expect(syntaxTree(restricted).length).toBe(0);
        expect(restricted.doc.toString()).toBe(source);
    });

    it("finishes the initial Lezer tree for ordinary-size source before first input", () => {
        const source = `${"# heading\n\nplain text\n".repeat(
            Math.ceil((1024 * 1024) / 22),
        )}`.slice(0, 1024 * 1024);
        const state = EditorState.create({ doc: source, extensions: sourceSyntaxExtensions(source.length) });

        expect(source.length).toBeLessThan(EAGER_SOURCE_SYNTAX_LIMIT);
        expect(eagerlyParseSourceSyntax(state)).toBe(true);
        expect(syntaxTreeAvailable(state)).toBe(true);
    });
});
