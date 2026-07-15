import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import liveBetaFixture from "./fixtures/markdown/live-beta.md?raw";

/**
 * P6 starts with a source-preservation contract. Future Live decorations may
 * change presentation only. CodeMirror normalizes CRLF at its document
 * boundary, so compare against that platform-independent editor value.
 */
describe("Live Beta source round-trip baseline", () => {
    it("keeps the supported P6 syntax and deferred constructs byte-for-byte in the editor state", () => {
        const editorFixture = liveBetaFixture.replace(/\r\n?/g, "\n");
        const state = EditorState.create({ doc: editorFixture, extensions: [markdown({ base: markdownLanguage })] });

        expect(state.doc.toString()).toBe(editorFixture);
        expect(syntaxTree(state).length).toBe(editorFixture.length);
        expect(editorFixture).toContain("# Live Beta 标题 / Heading");
        expect(editorFixture).toContain("**粗体**");
        expect(editorFixture).toContain("*斜体*");
        expect(editorFixture).toContain("~~删除线~~");
        expect(editorFixture).toContain("`inline code`");
        expect(editorFixture).toContain("[链接](https://example.com");
        expect(editorFixture).toContain("> 引用");
        expect(editorFixture).toContain("- [x] 已完成任务");
        expect(editorFixture).toContain("::: custom-directive");
        expect(editorFixture).toContain("| 表格 | P7 才处理 |");
        expect(editorFixture).toContain("```ts");
    });
});
