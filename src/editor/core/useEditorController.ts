import { useCallback, useEffect, useRef } from "react";
import { Compartment, EditorState as CMEditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { Scroller } from "../../utils/scrollSync";
import { useEditorViewportBridge } from "../bridge/useEditorViewportBridge";
import { useEditorDocumentSession } from "./useEditorDocumentSession";
import { LARGE_SOURCE_SYNTAX_LIMIT, sourceSyntaxExtensions, useCodeMirrorHost } from "./useCodeMirrorHost";
import { useWikilinkCompletion } from "../interactions/useWikilinkCompletion";
import { useAIAssistShortcut } from "../interactions/useAIAssistShortcut";
import { useEditorReview } from "../interactions/useEditorReview";
import { useEditorPreferences } from "../extensions/useEditorPreferences";
import { useEditorOverlays } from "../interactions/EditorOverlays";
import { createEditorPasteHandler } from "../interactions/editorPaste";
import { useLiveMarkdownPresentation } from "../live/liveMarkdownPresentation";

export interface EditorControllerOptions {
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
    /** Beta-only Source-compatible syntax presentation; false unless explicitly enabled. */
    liveMode?: boolean;
    /** Large/complex documents retain only P6's low-cost source styling. */
    liveRestricted?: boolean;
    /** Localized reason displayed when Live is restricted. */
    liveRestrictionReason?: string;
    aiConfig?: { endpoint: string; model: string; apiKey: string };
    reviewDoc?: string | null;
    onReviewResolve?: (finalDoc: string | null) => void;
}

/**
 * Coordinates the independent editor protocols without giving React ownership
 * of document text. CodeEditor itself only places the returned mount target.
 */
export function useEditorController({
    documentId, sessionState, onStateChange, content, onChange, onCursorChange,
    onSelectionChange, onImagePaste, onError, onNotice, filePath,
    onScrollFraction, registerScroller, typewriterMode, showToolbar,
    wordWrap = true, spellCheck = false, liveMode = false, liveRestricted = false, aiConfig, reviewDoc, onReviewResolve,
}: EditorControllerOptions) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);

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

    const lastEmittedRef = useRef(content);
    const contentRef = useRef(content);
    contentRef.current = content;
    const createStateRef = useRef<((doc: string) => CMEditorState) | null>(null);
    const loadedDocumentIdRef = useRef<string | null>(null);
    const wrapCompRef = useRef(new Compartment());
    const spellCompRef = useRef(new Compartment());
    const historyCompRef = useRef(new Compartment());
    const mergeCompRef = useRef(new Compartment());
    const liveCompRef = useRef(new Compartment());
    const sourceSyntaxCompRef = useRef(new Compartment());
    const openAIBubbleRef = useRef<() => void>(() => {});
    const triggerAIBubble = useCallback(() => openAIBubbleRef.current(), []);

    const wikiCompletionSource = useWikilinkCompletion(filePath);
    const { reviewActive, reviewingRef, acceptAllChanges, rejectAllChanges } = useEditorReview({
        viewRef, mergeCompRef, lastEmittedRef, reviewDoc, onReviewResolve,
    });
    const aiEnabled = useAIAssistShortcut(viewRef, triggerAIBubble);
    const { detectSlash, detectTable, openAIBubble, openFind, toolbar, floatingOverlays } = useEditorOverlays({
        viewRef, aiConfig, onNoticeRef, reviewingRef, showToolbar, aiEnabled, content,
    });
    openAIBubbleRef.current = openAIBubble;
    const handlePaste = createEditorPasteHandler({ filePathRef, onImagePasteRef, onErrorRef });

    useCodeMirrorHost({
        containerRef, viewRef, createStateRef, loadedDocumentIdRef, lastEmittedRef,
        wrapCompRef, spellCompRef, historyCompRef, mergeCompRef, liveCompRef, sourceSyntaxCompRef,
        onChangeRef, onStateChangeRef, onCursorChangeRef, onSelectionChangeRef,
        typewriterRef, reviewingRef, wikiCompletionSource, documentId, sessionState,
        content, wordWrap, spellCheck, liveMode, liveRestricted, detectSlash, detectTable, openFind, handlePaste,
    });
    useEditorDocumentSession({
        viewRef, createStateRef, loadedDocumentIdRef, lastEmittedRef, contentRef,
        onStateChangeRef, documentId, sessionState, content,
    });
    useEditorPreferences({ viewRef, wrapCompRef, spellCompRef, wordWrap, spellCheck });
    const sourceSyntaxRestricted = content.length > LARGE_SOURCE_SYNTAX_LIMIT;
    useEffect(() => {
        viewRef.current?.dispatch({
            effects: sourceSyntaxCompRef.current.reconfigure(sourceSyntaxExtensions(
                sourceSyntaxRestricted ? LARGE_SOURCE_SYNTAX_LIMIT + 1 : 0,
            )),
        });
    }, [sourceSyntaxCompRef, sourceSyntaxRestricted, viewRef]);
    useLiveMarkdownPresentation({ viewRef, liveCompRef, enabled: liveMode, restricted: liveRestricted, documentId });
    useEditorViewportBridge({ viewRef, onScrollFractionRef, registerScroller });

    return { containerRef, reviewActive, acceptAllChanges, rejectAllChanges, toolbar, floatingOverlays };
}
