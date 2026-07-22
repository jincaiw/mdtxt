// Regression test for the invisible editor selection (CodenameFlux review).
// CodeMirror's base theme paints the FOCUSED selection through
// `&light.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground`,
// which out-specifies the app theme's generic `.cm-selectionBackground` rule —
// so every theme rendered CM's default lavender (#d7d4f0), unreadable against
// light/paper text. The theme must mirror that selector shape for
// --selection-bg to win.
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import { CodeEditor } from "./CodeEditor";
import { installCodeMirrorDomPolyfills } from "../test/codemirrorDom";
import { EditorView } from "@codemirror/view";

beforeAll(installCodeMirrorDomPolyfills);
afterEach(cleanup);

describe("editor selection theming", () => {
    it("overrides CodeMirror's focused-selection base rule with --selection-bg", async () => {
        const { container } = render(<CodeEditor documentId="test" content="hello" onChange={() => {}} />);
        await waitFor(() => expect(container.querySelector(".cm-content")).toBeTruthy());

        const css = Array.from(document.querySelectorAll("style"))
            .map((s) => s.textContent ?? "")
            .join("\n");
        expect(css).toMatch(
            /\.cm-focused > \.cm-scroller > \.cm-selectionLayer \.cm-selectionBackground[^}]*var\(--selection-bg\)/,
        );
    });

    it("keeps one mounted host while an external document update is synchronized", async () => {
        const { container, rerender } = render(<CodeEditor documentId="test" content="alpha" onChange={() => {}} />);
        const content = await waitFor(() => {
            const element = container.querySelector<HTMLElement>(".cm-content");
            expect(element).toBeTruthy();
            return element!;
        });

        rerender(<CodeEditor documentId="test" content="alpha updated" onChange={() => {}} />);
        await waitFor(() => expect(content.textContent).toBe("alpha updated"));
        expect(container.querySelector(".cm-content")).toBe(content);
    });

    it("adds and removes Live presentation through a compartment without rebuilding the host", async () => {
        const { container, rerender } = render(<CodeEditor documentId="test" content="# heading" onChange={() => {}} liveMode />);
        const content = await waitFor(() => {
            const element = container.querySelector<HTMLElement>(".cm-content");
            expect(element).toBeTruthy();
            return element!;
        });
        expect(content.querySelector(".cm-live-heading-1")).toBeTruthy();
        expect(container.querySelector(".cm-editor")).toHaveAttribute("data-mdtxt-live", "true");
        expect(content).toHaveAttribute("data-mdtxt-live", "true");

        rerender(<CodeEditor documentId="test" content="# heading" onChange={() => {}} liveMode={false} />);
        await waitFor(() => expect(content.querySelector(".cm-live-heading-1")).toBeNull());
        expect(container.querySelector(".cm-content")).toBe(content);
    });

    it("mounts a viewport image widget without replacing its Markdown source", async () => {
        const source = "# image\n\n![diagram](data:image/svg+xml;base64,PHN2Zy8+)";
        const { container } = render(<CodeEditor documentId="image" content={source} onChange={() => {}} liveMode />);
        await waitFor(() => expect(container.querySelector(".cm-live-image-widget img")).toHaveAttribute(
            "src",
            "data:image/svg+xml;base64,PHN2Zy8+",
        ));
        const editor = container.querySelector<HTMLElement>(".cm-editor");
        expect(editor).toBeTruthy();
        expect(EditorView.findFromDOM(editor!).state.doc.toString()).toBe(source);
    });

    it("mounts a source-preserving code widget for a visible fenced block", async () => {
        const source = "# code\n\n```ts\nconst answer = 42;\n```";
        const { container } = render(<CodeEditor documentId="code" content={source} onChange={() => {}} liveMode />);
        await waitFor(() => expect(container.querySelector(".cm-live-code-widget code")).toHaveTextContent("const answer = 42;"));
        const editor = container.querySelector<HTMLElement>(".cm-editor");
        expect(EditorView.findFromDOM(editor!).state.doc.toString()).toBe(source);
    });

    it("mounts bounded frontmatter metadata without replacing the YAML source", async () => {
        const source = "---\ntitle: 安全说明\ntags: docs, beta\n---\n\n# Body";
        const { container } = render(<CodeEditor documentId="frontmatter" content={source} onChange={() => {}} liveMode />);
        const editor = await waitFor(() => {
            const element = container.querySelector<HTMLElement>(".cm-editor");
            expect(element).toBeTruthy();
            return element!;
        });
        const view = EditorView.findFromDOM(editor);
        view.dispatch({ selection: { anchor: source.length } });
        await waitFor(() => expect(container.querySelector(".cm-live-frontmatter-widget")).toHaveTextContent("安全说明"));
        expect(view.state.doc.toString()).toBe(source);
    });

    it("mounts a source-compatible GFM table widget", async () => {
        const source = "# data\n\n| Name | Value |\n| :--- | ---: |\n| alpha | 42 |";
        const { container } = render(<CodeEditor documentId="table" content={source} onChange={() => {}} liveMode />);
        await waitFor(() => expect(container.querySelector(".cm-live-table-widget table")).toHaveTextContent("alpha"));
        expect(container.querySelectorAll(".cm-live-table-widget th")).toHaveLength(2);
        const editor = container.querySelector<HTMLElement>(".cm-editor");
        expect(EditorView.findFromDOM(editor!).state.doc.toString()).toBe(source);
    });

    it("renders a visible display-math block through bounded KaTeX", async () => {
        const source = "# formula\n\n$$\nx^2 + y^2 = z^2\n$$";
        const { container } = render(<CodeEditor documentId="math" content={source} onChange={() => {}} liveMode />);
        await waitFor(() => expect(container.querySelector(".cm-live-math-widget .katex")).toBeTruthy());
        const editor = container.querySelector<HTMLElement>(".cm-editor");
        expect(EditorView.findFromDOM(editor!).state.doc.toString()).toBe(source);
    });

    it("mounts a cancellable strict Mermaid widget only for the visible fence", async () => {
        const source = "# diagram\n\n```mermaid\ngraph TD; A-->B\n```";
        const { container } = render(<CodeEditor documentId="mermaid" content={source} onChange={() => {}} liveMode />);
        await waitFor(() => expect(container.querySelector(".cm-live-mermaid-widget")).toBeTruthy());
        const editor = container.querySelector<HTMLElement>(".cm-editor");
        expect(EditorView.findFromDOM(editor!).state.doc.toString()).toBe(source);
    });

    it("mounts a footnote-definition widget while retaining reference source", async () => {
        const source = "# notes\n\nText[^1]\n\n[^1]: Source-safe note";
        const { container } = render(<CodeEditor documentId="footnote" content={source} onChange={() => {}} liveMode />);
        await waitFor(() => expect(container.querySelector(".cm-live-footnote-widget")).toHaveTextContent("Source-safe note"));
        const editor = container.querySelector<HTMLElement>(".cm-editor");
        expect(EditorView.findFromDOM(editor!).state.doc.toString()).toBe(source);
    });

    it("marks an over-threshold document as restricted without removing its source editor", async () => {
        const { container, rerender } = render(
            <CodeEditor
                documentId="large"
                content="# large heading"
                onChange={() => {}}
                liveMode
                liveRestricted
                liveRestrictionReason="Limited Live: large document"
            />,
        );
        const content = await waitFor(() => {
            const element = container.querySelector<HTMLElement>(".cm-content[data-mdtxt-live='restricted']");
            expect(element).toBeTruthy();
            return element!;
        });

        expect(content.textContent).toBe("# large heading");
        expect(container.querySelector(".cm-editor")).toHaveAttribute("data-mdtxt-live", "restricted");
        expect(container.querySelector("[role='status']")).toHaveTextContent("Limited Live: large document");

        rerender(
            <CodeEditor
                documentId="large"
                content="# large heading"
                onChange={() => {}}
                liveMode={false}
                liveRestricted
            />,
        );
        await waitFor(() => expect(content).not.toHaveAttribute("data-mdtxt-live"));
        expect(container.querySelector(".cm-content")).toBe(content);
    });

    it("discloses the reversible large-document word-wrap downgrade", async () => {
        const { container } = render(
            <CodeEditor
                documentId="large-source"
                content="# large heading"
                onChange={() => {}}
                wordWrap={false}
                performanceNotice="Syntax styling and word wrap paused for this large document"
            />,
        );
        await waitFor(() => expect(container.querySelector(".cm-content")).toBeTruthy());
        expect(container.querySelector("[role='status']")).toHaveTextContent("Syntax styling and word wrap paused for this large document");
        expect(container.querySelector(".cm-lineWrapping")).toBeNull();
    });
});
