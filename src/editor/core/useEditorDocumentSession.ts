import { useEffect, type RefObject } from "react";
import type { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { minimalTextChange } from "../../utils/minimalTextChange";

type CreateState = (document: string) => EditorState;
type StateChangeHandler = (documentId: string, state: EditorState) => void;

interface EditorDocumentSessionOptions {
    viewRef: RefObject<EditorView | null>;
    createStateRef: RefObject<CreateState | null>;
    loadedDocumentIdRef: RefObject<string | null>;
    lastEmittedRef: RefObject<string>;
    contentRef: RefObject<string>;
    onStateChangeRef: RefObject<StateChangeHandler | undefined>;
    documentId: string;
    sessionState?: EditorState | null;
    content: string;
}

/**
 * Synchronizes a retained EditorView with its active DocumentSession.
 *
 * A document switch always swaps a complete retained EditorState (selection and
 * history included). Content updates for the active session use the smallest
 * contiguous change and never make a React state copy the editing authority.
 */
export function useEditorDocumentSession({
    viewRef,
    createStateRef,
    loadedDocumentIdRef,
    lastEmittedRef,
    contentRef,
    onStateChangeRef,
    documentId,
    sessionState,
    content,
}: EditorDocumentSessionOptions) {
    useEffect(() => {
        if (loadedDocumentIdRef.current !== documentId) return;
        if (content === lastEmittedRef.current) return;
        const view = viewRef.current;
        if (!view) return;
        const change = minimalTextChange(view.state.doc.toString(), content);
        if (change) view.dispatch({ changes: change });
        lastEmittedRef.current = content;
    }, [content, documentId, lastEmittedRef, loadedDocumentIdRef, viewRef]);

    useEffect(() => {
        const view = viewRef.current;
        const createState = createStateRef.current;
        if (!view || !createState) return;
        if (loadedDocumentIdRef.current === documentId && (!sessionState || view.state === sessionState)) return;
        const next = sessionState ?? createState(contentRef.current ?? "");
        loadedDocumentIdRef.current = documentId;
        view.setState(next);
        lastEmittedRef.current = next.doc.toString();
        onStateChangeRef.current?.(documentId, next);
    }, [contentRef, createStateRef, documentId, lastEmittedRef, loadedDocumentIdRef, onStateChangeRef, sessionState, viewRef]);
}
