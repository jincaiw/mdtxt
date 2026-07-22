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
