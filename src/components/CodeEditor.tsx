import { useRef, useCallback, memo } from "react";
import { EditorState as CMEditorState, Compartment } from "@codemirror/state";
import { type EditorView } from "@codemirror/view";
import type { Scroller } from "../utils/scrollSync";
import { useEditorViewportBridge } from "../editor/bridge/useEditorViewportBridge";
import { useEditorDocumentSession } from "../editor/core/useEditorDocumentSession";
import { useCodeMirrorHost } from "../editor/core/useCodeMirrorHost";
import { useWikilinkCompletion } from "../editor/interactions/useWikilinkCompletion";
import { useAIAssistShortcut } from "../editor/interactions/useAIAssistShortcut";
import { useEditorReview } from "../editor/interactions/useEditorReview";
import { ReviewBanner } from "../editor/interactions/ReviewBanner";
import { useEditorPreferences } from "../editor/extensions/useEditorPreferences";
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

    useCodeMirrorHost({
        containerRef, viewRef, createStateRef, loadedDocumentIdRef, lastEmittedRef,
        wrapCompRef, spellCompRef, historyCompRef, mergeCompRef,
        onChangeRef, onStateChangeRef, onCursorChangeRef, onSelectionChangeRef,
        typewriterRef, reviewingRef, wikiCompletionSource, documentId, sessionState,
        content, wordWrap, spellCheck, detectSlash, detectTable, openFind, handlePaste,
    });

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
