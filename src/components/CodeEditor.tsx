import { useRef, useCallback, useEffect, memo } from "react";
import { EditorState as CMEditorState, Compartment, Prec } from "@codemirror/state";
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
import { markdown } from "@codemirror/lang-markdown";
import { autocompletion, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { getOriginalDoc } from "@codemirror/merge";
import {
    handleTab,
    handleEnter,
    wrapSelection,
    insertLink,
    type EditorResult,
    type EditorState,
} from "../utils/editorActions";
import type { Scroller } from "../utils/scrollSync";
import {
    applyEditorResult,
    editorTheme,
    markdownPresentationExtensions,
    toEditorActionState,
} from "../editor/core/editorPresentation";
import { useEditorViewportBridge } from "../editor/bridge/useEditorViewportBridge";
import { useEditorDocumentSession } from "../editor/core/useEditorDocumentSession";
import { useWikilinkCompletion } from "../editor/interactions/useWikilinkCompletion";
import { useAIAssistShortcut } from "../editor/interactions/useAIAssistShortcut";
import { useEditorReview } from "../editor/interactions/useEditorReview";
import { ReviewBanner } from "../editor/interactions/ReviewBanner";
import { spellcheckAttributes, useEditorPreferences } from "../editor/extensions/useEditorPreferences";
import { useEditorOverlays } from "../editor/interactions/EditorOverlays";
import { createEditorPasteHandler } from "../editor/interactions/editorPaste";

interface CodeEditorProps {
    /** Stable owner used to restore this document's EditorState. */
    documentId: string;
    sessionState?: CMEditorState | null;
    onStateChange?: (documentId: string, state: CMEditorState) => void;
    content: string;
    onChange: (content: string) => void;
    onCursorChange?: (line: number, column: number) => void;
    onSelectionChange?: (start: number, end: number) => void;
    onImagePaste?: () => void;
    onError?: (message: string) => void;
    onNotice?: (message: string) => void;
    filePath?: string | null;
    onScrollFraction?: (fraction: number) => void;
    registerScroller?: (scroller: Scroller | null) => void;
    typewriterMode?: boolean;
    showToolbar?: boolean;
    wordWrap?: boolean;
    spellCheck?: boolean;
    aiConfig?: { endpoint: string; model: string; apiKey: string };
    /** When non-null, show this proposed document as an inline diff (CodeMirror
     *  merge view) for the user to accept/reject. Null = no review in progress. */
    reviewDoc?: string | null;
    /** Called when the user finishes a review: the final document (accept) or
     *  null (rejected everything — keep the original). */
    onReviewResolve?: (finalDoc: string | null) => void;
}


function CodeEditorImpl({
    documentId,
    sessionState,
    onStateChange,
    content,
    onChange,
    onCursorChange,
    onSelectionChange,
    onImagePaste,
    onError,
    onNotice,
    filePath,
    onScrollFraction,
    registerScroller,
    typewriterMode,
    showToolbar,
    wordWrap = true,
    spellCheck = false,
    aiConfig,
    reviewDoc,
    onReviewResolve,
}: CodeEditorProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);

    // Latest props read by the once-created CodeMirror extensions, kept in refs so
    // the view never has to be torn down and rebuilt on a callback/flag change.
    const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
    const onStateChangeRef = useRef(onStateChange); onStateChangeRef.current = onStateChange;
    const onCursorChangeRef = useRef(onCursorChange); onCursorChangeRef.current = onCursorChange;
    const onSelectionChangeRef = useRef(onSelectionChange); onSelectionChangeRef.current = onSelectionChange;
    const onScrollFractionRef = useRef(onScrollFraction); onScrollFractionRef.current = onScrollFraction;
    const onImagePasteRef = useRef(onImagePaste); onImagePasteRef.current = onImagePaste;
    const onErrorRef = useRef(onError); onErrorRef.current = onError;
    const onNoticeRef = useRef(onNotice); onNoticeRef.current = onNotice;
    const filePathRef = useRef(filePath); filePathRef.current = filePath;
    const typewriterRef = useRef(typewriterMode); typewriterRef.current = typewriterMode;

    // The last value WE emitted via onChange — lets the external-content sync
    // effect below skip the O(n) doc.toString() comparison on the common case
    // (the prop change is just our own keystroke echoing back through App state).
    const lastEmittedRef = useRef(content);
    // Live mirror used when a newly activated document has no retained state.
    const contentPropRef = useRef(content);
    contentPropRef.current = content;
    const createStateRef = useRef<((doc: string) => CMEditorState) | null>(null);
    const loadedDocumentIdRef = useRef<string | null>(null);

    // Reconfigurable extensions.
    const wrapCompRef = useRef(new Compartment());
    const spellCompRef = useRef(new Compartment());
    // history() lives in a compartment so a document swap can reset undo state
    // (reconfigure to [] then back) without rebuilding the whole editor. TABS-03.
    const historyCompRef = useRef(new Compartment());
    // AI review (merge view) state.
    const mergeCompRef = useRef(new Compartment());
    const openAIBubbleRef = useRef<() => void>(() => {});
    const triggerAIBubble = useCallback(() => openAIBubbleRef.current(), []);

    const wikiCompletionSource = useWikilinkCompletion(filePath);
    const { reviewActive, reviewingRef, acceptAllChanges, rejectAllChanges } = useEditorReview({
        viewRef, mergeCompRef, lastEmittedRef, reviewDoc, onReviewResolve,
    });
    const aiEnabled = useAIAssistShortcut(viewRef, triggerAIBubble);
    const { detectSlash, detectTable, openAIBubble, openFind, toolbar, floatingOverlays } = useEditorOverlays({
        viewRef,
        aiConfig,
        onNoticeRef,
        reviewingRef,
        showToolbar,
        aiEnabled,
        content,
    });
    openAIBubbleRef.current = openAIBubble;
    const handlePaste = createEditorPasteHandler({ filePathRef, onImagePasteRef, onErrorRef });

    // === One-time CodeMirror setup ===
    useEffect(() => {
        if (!containerRef.current) return;

        const wrapComp = wrapCompRef.current;
        const spellComp = spellCompRef.current;
        const mergeComp = mergeCompRef.current;
        const historyComp = historyCompRef.current;

        const editingKeymap = Prec.highest(keymap.of([
            { key: "Tab", run: (v) => runAction(v, (st) => handleTab(st, false)), shift: (v) => runAction(v, (st) => handleTab(st, true)) },
            { key: "Enter", run: (v) => runAction(v, handleEnter) },
            { key: "Mod-b", run: (v) => { applyEditorResult(v, wrapSelection(toEditorActionState(v), "**", "**", "bold")); return true; } },
            { key: "Mod-i", run: (v) => { applyEditorResult(v, wrapSelection(toEditorActionState(v), "*", "*", "italic")); return true; } },
            { key: "Mod-k", run: (v) => { applyEditorResult(v, insertLink(toEditorActionState(v))); return true; } },
            {
                key: "Mod-/", run: (v) => {
                    const st = toEditorActionState(v);
                    const ls = st.text.lastIndexOf("\n", st.selStart - 1) + 1;
                    const lineEnd = st.text.indexOf("\n", st.selStart);
                    const end = lineEnd === -1 ? st.text.length : lineEnd;
                    const line = st.text.slice(ls, end);
                    const quoted = line.startsWith("> ");
                    const newLine = quoted ? line.slice(2) : "> " + line;
                    const delta = newLine.length - line.length;
                    applyEditorResult(v, { text: st.text.slice(0, ls) + newLine + st.text.slice(end), selStart: st.selStart + delta, selEnd: st.selEnd + delta });
                    return true;
                }
            },
            { key: "Mod-f", run: (v) => { openFind("find", v.state.selection.main.from); return true; } },
            { key: "Mod-h", run: (v) => { openFind("replace", v.state.selection.main.from); return true; } },
            // NB: the AI shortcut (Alt+J / ⌘J) is handled at the App window level
            // so it fires regardless of editor focus — see App.tsx. The editor
            // opens the bubble via the mdtxt:ai-assist event listener below.
        ]));

        const updateListener = EditorView.updateListener.of((update: ViewUpdate) => {
            if (reviewingRef.current) {
                // During an AI review the editor shows the full PROPOSED text, but
                // the preview should show "original + the changes accepted so far".
                // @codemirror/merge's acceptChunk folds an accepted change into its
                // original document (rejectChunk reverts the editor doc instead), so
                // getOriginalDoc() IS exactly that running result — sync it to the
                // preview so accepting/rejecting a single change updates it live.
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
                const sel = update.state.selection.main;
                onSelectionChangeRef.current?.(sel.from, sel.to);
                detectSlash(update.view);
                detectTable(update.view);
                // Typewriter mode: recenter only while TYPING (docChanged), not on
                // mouse clicks / arrow navigation — clicking shouldn't yank the
                // viewport around.
                if (typewriterRef.current && update.docChanged) {
                    const pos = head;
                    requestAnimationFrame(() => {
                        const v = viewRef.current;
                        if (v) v.dispatch({ effects: EditorView.scrollIntoView(pos, { y: "center" }) });
                    });
                }
            }
        });

        const pasteHandler = EditorView.domEventHandlers({
            paste: (event, view) => handlePaste(event, view),
        });

        const createState = (doc: string) => CMEditorState.create({
            doc,
            extensions: [
                lineNumbers(), highlightActiveLineGutter(), highlightActiveLine(),
                historyComp.of(history()), drawSelection(), dropCursor(), closeBrackets(),
                autocompletion({ override: [wikiCompletionSource], icons: false, aboveCursor: false }),
                markdown(), markdownPresentationExtensions, editorTheme,
                wrapComp.of(wordWrap ? EditorView.lineWrapping : []),
                spellComp.of(EditorView.contentAttributes.of(spellcheckAttributes(spellCheck))),
                mergeComp.of([]), editingKeymap,
                keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap]),
                updateListener, pasteHandler, EditorView.theme({ "&": { outline: "none" } }),
            ],
        });
        createStateRef.current = createState;

        const view = new EditorView({
            parent: containerRef.current,
            state: sessionState ?? createState(content),
        });
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
        // Created once; prop changes flow in via the effects + refs below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Helper used by the editing keymap: run a (tested) editorActions function and
    // apply its result, or fall through to CodeMirror's default if it returns null.
    function runAction(view: EditorView, fn: (st: EditorState) => EditorResult | null): boolean {
        const r = fn(toEditorActionState(view));
        if (!r) return false;
        applyEditorResult(view, r);
        return true;
    }

    useEditorDocumentSession({
        viewRef,
        createStateRef,
        loadedDocumentIdRef,
        lastEmittedRef,
        contentRef: contentPropRef,
        onStateChangeRef,
        documentId,
        sessionState,
        content,
    });

    useEditorPreferences({ viewRef, wrapCompRef, spellCompRef, wordWrap, spellCheck });

    useEditorViewportBridge({ viewRef, onScrollFractionRef, registerScroller });

    return (
        <main className="flex-1 flex flex-col overflow-hidden relative">
            {reviewActive && <ReviewBanner onAccept={acceptAllChanges} onReject={rejectAllChanges} />}
            {toolbar}
            <div className="flex-1 overflow-hidden relative">
                <div ref={containerRef} className="absolute inset-0 [&_.cm-editor]:h-full [&_.cm-editor]:outline-none" />
                {floatingOverlays}
            </div>
        </main>
    );
}

export const CodeEditor = memo(CodeEditorImpl);
