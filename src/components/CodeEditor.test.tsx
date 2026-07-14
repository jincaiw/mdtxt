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
});
