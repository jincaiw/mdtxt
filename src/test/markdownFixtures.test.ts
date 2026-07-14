import { describe, expect, it } from "vitest";
import gfmSafety from "./fixtures/markdown/gfm-safety.md?raw";
import mixedLanguage from "./fixtures/markdown/mixed-language.md?raw";
import unknownAndHtml from "./fixtures/markdown/unknown-and-html.md?raw";
import { createLargeMarkdown } from "./fixtures/largeMarkdown";

describe("Markdown safety fixtures", () => {
    it("covers GFM structures that Live and export must preserve", () => {
        expect(gfmSafety).toContain("- [x] completed task");
        expect(gfmSafety).toContain("| Left | Center | Right |");
        expect(gfmSafety).toContain("```ts");
        expect(gfmSafety).toContain("![Fixture image]");
    });

    it("covers Chinese/English text, math, frontmatter, and Mermaid", () => {
        expect(mixedLanguage).toContain("中文标题 / English heading");
        expect(mixedLanguage).toContain("$E = mc^2$");
        expect(mixedLanguage).toContain("```mermaid");
        expect(mixedLanguage).toContain("title: 中文与 English");
    });

    it("keeps unknown Markdown and raw HTML literal", () => {
        expect(unknownAndHtml).toContain("::: custom-directive");
        expect(unknownAndHtml).toContain("<custom-widget data-value=\"keep-me\">");
        expect(unknownAndHtml).toContain("{{ template_variable | unknown_filter }}");
    });

    it("creates exact-size deterministic 1 MiB and 10 MiB documents", () => {
        const encoder = new TextEncoder();
        const oneMiB = createLargeMarkdown(1024 * 1024);
        const tenMiB = createLargeMarkdown(10 * 1024 * 1024);

        expect(encoder.encode(oneMiB)).toHaveLength(1024 * 1024);
        expect(encoder.encode(tenMiB)).toHaveLength(10 * 1024 * 1024);
        expect(oneMiB).toContain("中文 English mixed content");
        expect(tenMiB).toContain("## Repeated section");
    });
});
