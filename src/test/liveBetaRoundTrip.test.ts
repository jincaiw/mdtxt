import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { markdown } from "@codemirror/lang-markdown";
import liveBetaFixture from "./fixtures/markdown/live-beta.md?raw";

/**
 * P6 starts with a source-preservation contract. Future Live decorations may
 * change presentation only; every mode must retain exactly this document text.
 */
describe("Live Beta source round-trip baseline", () => {
    it("keeps the supported P6 syntax and deferred constructs byte-for-byte in the editor state", () => {
        const state = EditorState.create({ doc: liveBetaFixture, extensions: [markdown()] });

        expect(state.doc.toString()).toBe(liveBetaFixture);
        expect(syntaxTree(state).length).toBe(liveBetaFixture.length);
        expect(liveBetaFixture).toContain("# Live Beta 标题 / Heading");
        expect(liveBetaFixture).toContain("**粗体**");
        expect(liveBetaFixture).toContain("*斜体*");
        expect(liveBetaFixture).toContain("~~删除线~~");
        expect(liveBetaFixture).toContain("`inline code`");
        expect(liveBetaFixture).toContain("[链接](https://example.com");
        expect(liveBetaFixture).toContain("> 引用");
        expect(liveBetaFixture).toContain("- [x] 已完成任务");
        expect(liveBetaFixture).toContain("::: custom-directive");
        expect(liveBetaFixture).toContain("| 表格 | P7 才处理 |");
        expect(liveBetaFixture).toContain("```ts");
    });
});
