import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { getChunks, unifiedMergeView } from "@codemirror/merge";

export function useEditorReview({ viewRef, mergeCompRef, lastEmittedRef, reviewDoc, onReviewResolve }: {
    viewRef: RefObject<EditorView | null>;
    mergeCompRef: RefObject<Compartment>;
    lastEmittedRef: RefObject<string>;
    reviewDoc?: string | null;
    onReviewResolve?: (finalDoc: string | null) => void;
}) {
    const [reviewActive, setReviewActive] = useState(false);
    const reviewingRef = useRef(false);
    const originalRef = useRef("");
    const lastReviewRef = useRef<string | null>(null);

    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        if (reviewDoc != null) {
            if (reviewingRef.current && reviewDoc === lastReviewRef.current) return;
            if (!reviewingRef.current) originalRef.current = view.state.doc.toString();
            reviewingRef.current = true;
            lastReviewRef.current = reviewDoc;
            setReviewActive(true);
            view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: reviewDoc }, effects: mergeCompRef.current.reconfigure(unifiedMergeView({ original: originalRef.current })) });
            requestAnimationFrame(() => {
                const current = viewRef.current;
                const chunks = current ? getChunks(current.state)?.chunks : null;
                if (current && chunks?.length) current.dispatch({ effects: EditorView.scrollIntoView(chunks[0].fromB, { y: "center" }) });
            });
        } else if (reviewingRef.current) {
            reviewingRef.current = false;
            lastReviewRef.current = null;
            setReviewActive(false);
            view.dispatch({ effects: mergeCompRef.current.reconfigure([]) });
        }
    }, [mergeCompRef, reviewDoc, viewRef]);

    const acceptAllChanges = useCallback(() => {
        const view = viewRef.current;
        if (!view) return;
        const final = view.state.doc.toString();
        reviewingRef.current = false;
        lastReviewRef.current = null;
        setReviewActive(false);
        view.dispatch({ effects: mergeCompRef.current.reconfigure([]) });
        lastEmittedRef.current = final;
        onReviewResolve?.(final);
    }, [lastEmittedRef, mergeCompRef, onReviewResolve, viewRef]);

    const rejectAllChanges = useCallback(() => {
        const view = viewRef.current;
        if (!view) return;
        const original = originalRef.current;
        reviewingRef.current = false;
        lastReviewRef.current = null;
        setReviewActive(false);
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: original }, effects: mergeCompRef.current.reconfigure([]) });
        lastEmittedRef.current = original;
        onReviewResolve?.(original);
    }, [lastEmittedRef, mergeCompRef, onReviewResolve, viewRef]);

    return { reviewActive, reviewingRef, acceptAllChanges, rejectAllChanges };
}
