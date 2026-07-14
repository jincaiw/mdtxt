import { useEffect, type RefObject } from "react";
import type { Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export function spellcheckAttributes(enabled: boolean): Record<string, string> {
    return {
        spellcheck: enabled ? "true" : "false",
        autocorrect: enabled ? "on" : "off",
        autocapitalize: "off",
    };
}

/** Applies user preference compartments without recreating the retained view. */
export function useEditorPreferences({
    viewRef,
    wrapCompRef,
    spellCompRef,
    wordWrap,
    spellCheck,
}: {
    viewRef: RefObject<EditorView | null>;
    wrapCompRef: RefObject<Compartment>;
    spellCompRef: RefObject<Compartment>;
    wordWrap: boolean;
    spellCheck: boolean;
}) {
    useEffect(() => {
        viewRef.current?.dispatch({ effects: wrapCompRef.current.reconfigure(wordWrap ? EditorView.lineWrapping : []) });
    }, [viewRef, wordWrap, wrapCompRef]);

    useEffect(() => {
        viewRef.current?.dispatch({ effects: spellCompRef.current.reconfigure(EditorView.contentAttributes.of(spellcheckAttributes(spellCheck))) });
    }, [spellCheck, spellCompRef, viewRef]);
}
