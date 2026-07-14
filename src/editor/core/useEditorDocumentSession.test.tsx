import { useEffect, useRef } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { installCodeMirrorDomPolyfills } from "../../test/codemirrorDom";
import { useEditorDocumentSession } from "./useEditorDocumentSession";

beforeAll(installCodeMirrorDomPolyfills);
afterEach(cleanup);

function SessionHarness({
    documentId,
    content,
    sessionState,
    onView,
}: {
    documentId: string;
    content: string;
    sessionState?: EditorState | null;
    onView: (view: EditorView) => void;
}) {
    const hostRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const createStateRef = useRef<(document: string) => EditorState>((document) => EditorState.create({ doc: document }));
    const loadedDocumentIdRef = useRef<string | null>(null);
    const lastEmittedRef = useRef(content);
    const contentRef = useRef(content);
    contentRef.current = content;
    const onStateChangeRef = useRef<(id: string, state: EditorState) => void>(() => {});

    useEffect(() => {
        if (!hostRef.current) return;
        const view = new EditorView({
            parent: hostRef.current,
            state: sessionState ?? createStateRef.current(content),
        });
        viewRef.current = view;
        loadedDocumentIdRef.current = documentId;
        onView(view);
        return () => view.destroy();
        // The harness deliberately emulates CodeEditor's one-time view creation.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEditorDocumentSession({
        viewRef,
        createStateRef,
        loadedDocumentIdRef,
        lastEmittedRef,
        contentRef,
        onStateChangeRef,
        documentId,
        sessionState,
        content,
    });

    return <div ref={hostRef} />;
}

describe("useEditorDocumentSession", () => {
    it("patches external content for the active document and swaps retained state for another document", async () => {
        let view: EditorView | null = null;
        const onView = (next: EditorView) => { view = next; };
        const { rerender } = render(<SessionHarness documentId="a" content="alpha" onView={onView} />);
        await waitFor(() => expect(view?.state.doc.toString()).toBe("alpha"));

        rerender(<SessionHarness documentId="a" content="alpha updated" onView={onView} />);
        await waitFor(() => expect(view?.state.doc.toString()).toBe("alpha updated"));

        const second = EditorState.create({ doc: "beta", selection: { anchor: 2 } });
        rerender(<SessionHarness documentId="b" content="beta" sessionState={second} onView={onView} />);
        await waitFor(() => {
            expect(view?.state).toBe(second);
            expect(view?.state.selection.main.head).toBe(2);
        });
    });
});
