import { useEffect, type RefObject } from "react";
import { Compartment, EditorState as CMEditorState, Prec } from "@codemirror/state";
import {
    EditorView,
    keymap,
    lineNumbers,
    highlightActiveLine,
    highlightActiveLineGutter,
    drawSelection,
    dropCursor,
    type ViewUpdate,
} from "@codemirror/view";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { autocompletion, closeBrackets, closeBracketsKeymap, type CompletionSource } from "@codemirror/autocomplete";
import { getOriginalDoc } from "@codemirror/merge";
import { handleTab, handleEnter, wrapSelection, insertLink, type EditorResult, type EditorState } from "../../utils/editorActions";
import { applyEditorResult, editorTheme, markdownPresentationExtensions, toEditorActionState } from "./editorPresentation";
import { spellcheckAttributes } from "../extensions/useEditorPreferences";
import { liveMarkdownPresentation } from "../live/liveMarkdownPresentation";

interface UseCodeMirrorHostOptions {
    containerRef: RefObject<HTMLDivElement | null>;
    viewRef: RefObject<EditorView | null>;
    createStateRef: RefObject<((doc: string) => CMEditorState) | null>;
    loadedDocumentIdRef: RefObject<string | null>;
    lastEmittedRef: RefObject<string>;
    wrapCompRef: RefObject<Compartment>;
    spellCompRef: RefObject<Compartment>;
    historyCompRef: RefObject<Compartment>;
    mergeCompRef: RefObject<Compartment>;
    liveCompRef: RefObject<Compartment>;
    onChangeRef: RefObject<((content: string) => void) | undefined>;
    onStateChangeRef: RefObject<((documentId: string, state: CMEditorState) => void) | undefined>;
    onCursorChangeRef: RefObject<((line: number, column: number) => void) | undefined>;
    onSelectionChangeRef: RefObject<((start: number, end: number) => void) | undefined>;
    typewriterRef: RefObject<boolean | undefined>;
    reviewingRef: RefObject<boolean>;
    wikiCompletionSource: CompletionSource;
    documentId: string;
    sessionState?: CMEditorState | null;
    content: string;
    wordWrap: boolean;
    spellCheck: boolean;
    liveMode: boolean;
    detectSlash: (view: EditorView) => void;
    detectTable: (view: EditorView) => void;
    openFind: (mode: "find" | "replace", selectionStart: number) => void;
    handlePaste: (event: ClipboardEvent, view: EditorView) => boolean;
}

/** Owns the one-time CodeMirror view and its stable extension protocol. */
export function useCodeMirrorHost({
    containerRef, viewRef, createStateRef, loadedDocumentIdRef, lastEmittedRef,
    wrapCompRef, spellCompRef, historyCompRef, mergeCompRef, liveCompRef,
    onChangeRef, onStateChangeRef, onCursorChangeRef, onSelectionChangeRef,
    typewriterRef, reviewingRef, wikiCompletionSource, documentId, sessionState,
    content, wordWrap, spellCheck, liveMode, detectSlash, detectTable, openFind, handlePaste,
}: UseCodeMirrorHostOptions) {
    useEffect(() => {
        if (!containerRef.current) return;

        const editingKeymap = Prec.highest(keymap.of([
            { key: "Tab", run: (view) => runAction(view, (state) => handleTab(state, false)), shift: (view) => runAction(view, (state) => handleTab(state, true)) },
            { key: "Enter", run: (view) => runAction(view, handleEnter) },
            { key: "Mod-b", run: (view) => { applyEditorResult(view, wrapSelection(toEditorActionState(view), "**", "**", "bold")); return true; } },
            { key: "Mod-i", run: (view) => { applyEditorResult(view, wrapSelection(toEditorActionState(view), "*", "*", "italic")); return true; } },
            { key: "Mod-k", run: (view) => { applyEditorResult(view, insertLink(toEditorActionState(view))); return true; } },
            {
                key: "Mod-/", run: (view) => {
                    const state = toEditorActionState(view);
                    const lineStart = state.text.lastIndexOf("\n", state.selStart - 1) + 1;
                    const lineEnd = state.text.indexOf("\n", state.selStart);
                    const end = lineEnd === -1 ? state.text.length : lineEnd;
                    const line = state.text.slice(lineStart, end);
                    const replacement = line.startsWith("> ") ? line.slice(2) : "> " + line;
                    const delta = replacement.length - line.length;
                    applyEditorResult(view, { text: state.text.slice(0, lineStart) + replacement + state.text.slice(end), selStart: state.selStart + delta, selEnd: state.selEnd + delta });
                    return true;
                },
            },
            { key: "Mod-f", run: (view) => { openFind("find", view.state.selection.main.from); return true; } },
            { key: "Mod-h", run: (view) => { openFind("replace", view.state.selection.main.from); return true; } },
        ]));

        const updateListener = EditorView.updateListener.of((update: ViewUpdate) => {
            if (reviewingRef.current) {
                let accepted: string | null = null;
                try { accepted = getOriginalDoc(update.state).toString(); } catch { /* merge field not ready */ }
                if (accepted !== null && accepted !== lastEmittedRef.current) {
                    lastEmittedRef.current = accepted;
                    onChangeRef.current?.(accepted);
                }
            } else if (update.docChanged) {
                const value = update.state.doc.toString();
                lastEmittedRef.current = value;
                onChangeRef.current?.(value);
            }
            if (update.selectionSet || update.docChanged) {
                onStateChangeRef.current?.(loadedDocumentIdRef.current ?? documentId, update.state);
                const head = update.state.selection.main.head;
                const line = update.state.doc.lineAt(head);
                onCursorChangeRef.current?.(line.number, head - line.from + 1);
                const selection = update.state.selection.main;
                onSelectionChangeRef.current?.(selection.from, selection.to);
                detectSlash(update.view);
                detectTable(update.view);
                if (typewriterRef.current && update.docChanged) {
                    requestAnimationFrame(() => viewRef.current?.dispatch({ effects: EditorView.scrollIntoView(head, { y: "center" }) }));
                }
            }
        });

        const createState = (doc: string) => CMEditorState.create({
            doc,
            extensions: [
                lineNumbers(), highlightActiveLineGutter(), highlightActiveLine(),
                historyCompRef.current.of(history()), drawSelection(), dropCursor(), closeBrackets(),
                autocompletion({ override: [wikiCompletionSource], icons: false, aboveCursor: false }),
                markdown({ base: markdownLanguage }), markdownPresentationExtensions, editorTheme,
                wrapCompRef.current.of(wordWrap ? EditorView.lineWrapping : []),
                spellCompRef.current.of(EditorView.contentAttributes.of(spellcheckAttributes(spellCheck))),
                mergeCompRef.current.of([]), editingKeymap,
                liveCompRef.current.of(liveMode ? liveMarkdownPresentation : []),
                keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap]),
                updateListener,
                EditorView.domEventHandlers({ paste: handlePaste }),
                EditorView.theme({ "&": { outline: "none" } }),
            ],
        });
        createStateRef.current = createState;

        const view = new EditorView({ parent: containerRef.current, state: sessionState ?? createState(content) });
        viewRef.current = view;
        loadedDocumentIdRef.current = documentId;
        lastEmittedRef.current = content;
        onStateChangeRef.current?.(documentId, view.state);
        view.focus();

        return () => {
            view.destroy();
            viewRef.current = null;
            createStateRef.current = null;
        };
        // The host deliberately stays mounted. Dynamic inputs are stable refs or
        // reconfigured by the dedicated session/preferences hooks.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}

function runAction(view: EditorView, action: (state: EditorState) => EditorResult | null): boolean {
    const result = action(toEditorActionState(view));
    if (!result) return false;
    applyEditorResult(view, result);
    return true;
}
