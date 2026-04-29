import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import { getImageFromClipboard, saveImageToFile, createMarkdownImage, insertAtCursor } from "../utils/imageUtils";
import {
    handleTab,
    handleEnter,
    handleAutoPair,
    handleSkipCloser,
    handleBackspace,
    wrapSelection,
    insertLink,
    type EditorResult,
} from "../utils/editorActions";
import { FindReplaceBar } from "./FindReplaceBar";
import { FormatToolbar } from "./FormatToolbar";
import type { Scroller } from "../utils/scrollSync";

interface CodeEditorProps {
    content: string;
    onChange: (content: string) => void;
    onCursorChange?: (line: number, column: number) => void;
    onImagePaste?: () => void; // Callback when image is successfully pasted
    onError?: (message: string) => void; // Callback for error messages
    filePath?: string | null; // Current file path for saving images
    onScrollFraction?: (fraction: number) => void;
    registerScroller?: (scroller: Scroller | null) => void;
    focusMode?: boolean;
    typewriterMode?: boolean;
    showToolbar?: boolean;
    onSlashTrigger?: (textareaEl: HTMLTextAreaElement, caretCoords: { x: number; y: number }) => void;
    aiConfig?: { endpoint: string; model: string; apiKey: string };
}

// Locked metrics for perfect alignment between textarea and highlight layer.
// Both layers MUST use these exact values to keep the caret on top of the rendered text.
const EDITOR_FONT_FAMILY =
    "'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";
const EDITOR_FONT_SIZE = 14; // px
const EDITOR_LINE_HEIGHT = 24; // px
const EDITOR_PADDING = 16; // px
const EDITOR_TAB_SIZE = 4;

const sharedTextStyle: React.CSSProperties = {
    fontFamily: EDITOR_FONT_FAMILY,
    fontSize: `${EDITOR_FONT_SIZE}px`,
    lineHeight: `${EDITOR_LINE_HEIGHT}px`,
    padding: `${EDITOR_PADDING}px`,
    tabSize: EDITOR_TAB_SIZE,
    MozTabSize: EDITOR_TAB_SIZE,
    fontVariantLigatures: "none",
    fontKerning: "none",
    letterSpacing: "0px",
    whiteSpace: "pre",
    wordBreak: "normal",
    overflowWrap: "normal",
    boxSizing: "border-box",
};

export function CodeEditor({ content, onChange, onCursorChange, onImagePaste, onError, filePath, onScrollFraction, registerScroller, focusMode, typewriterMode, showToolbar, onSlashTrigger }: CodeEditorProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const gutterRef = useRef<HTMLDivElement>(null);
    const highlightRef = useRef<HTMLDivElement>(null);
    const [activeLine, setActiveLine] = useState(1);
    const [findOpen, setFindOpen] = useState(false);
    const [findMode, setFindMode] = useState<"find" | "replace">("find");
    const [selStartForFind, setSelStartForFind] = useState(0);

    const lines = useMemo(() => content.split("\n"), [content]);
    const lineCount = lines.length;

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value);
    };

    // Apply an EditorResult: update content + restore selection on next frame.
    // (selection must be set after React flushes the new value to the DOM)
    const applyResult = useCallback((r: EditorResult) => {
        onChange(r.text);
        requestAnimationFrame(() => {
            const t = textareaRef.current;
            if (!t) return;
            t.selectionStart = r.selStart;
            t.selectionEnd = r.selEnd;
        });
    }, [onChange]);

    const getState = useCallback(() => {
        const t = textareaRef.current;
        if (!t) return null;
        return { text: t.value, selStart: t.selectionStart, selEnd: t.selectionEnd };
    }, []);

    const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const state = getState();
        if (!state) return;

        // Ctrl+F / Ctrl+H — open find / find-and-replace bar
        if ((e.ctrlKey || e.metaKey) && !e.altKey) {
            if (e.key === "f" || e.key === "F") {
                e.preventDefault();
                setSelStartForFind(state.selStart);
                setFindMode("find");
                setFindOpen(true);
                return;
            }
            if (e.key === "h" || e.key === "H") {
                e.preventDefault();
                setSelStartForFind(state.selStart);
                setFindMode("replace");
                setFindOpen(true);
                return;
            }
        }

        // Ctrl/Cmd shortcuts (Bold, Italic, Link). Other Ctrl combos handled at app level.
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
            if (e.key === "b" || e.key === "B") {
                e.preventDefault();
                applyResult(wrapSelection(state, "**", "**", "bold"));
                return;
            }
            if (e.key === "i" || e.key === "I") {
                e.preventDefault();
                applyResult(wrapSelection(state, "*", "*", "italic"));
                return;
            }
            if (e.key === "k" || e.key === "K") {
                e.preventDefault();
                applyResult(insertLink(state));
                return;
            }
            // Ctrl+/ — toggle blockquote on the current line
            if (e.key === "/") {
                e.preventDefault();
                const ls = state.text.lastIndexOf("\n", state.selStart - 1) + 1;
                const lineEnd = state.text.indexOf("\n", state.selStart);
                const end = lineEnd === -1 ? state.text.length : lineEnd;
                const line = state.text.slice(ls, end);
                const quoted = line.startsWith("> ");
                const newLine = quoted ? line.slice(2) : "> " + line;
                const delta = newLine.length - line.length;
                applyResult({
                    text: state.text.slice(0, ls) + newLine + state.text.slice(end),
                    selStart: state.selStart + delta,
                    selEnd: state.selEnd + delta,
                });
                return;
            }
        }

        if (e.key === "Tab") {
            const r = handleTab(state, e.shiftKey);
            if (r) {
                e.preventDefault();
                applyResult(r);
            }
            return;
        }

        if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const r = handleEnter(state);
            if (r) {
                e.preventDefault();
                applyResult(r);
            }
            return;
        }

        if (e.key === "Backspace" && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const r = handleBackspace(state);
            if (r) {
                e.preventDefault();
                applyResult(r);
            }
            return;
        }

        // Auto-pair / skip-closer: only for printable single-char keys
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const skip = handleSkipCloser(state, e.key);
            if (skip) {
                e.preventDefault();
                const t = textareaRef.current;
                if (t) {
                    t.selectionStart = skip.selStart;
                    t.selectionEnd = skip.selEnd;
                }
                return;
            }
            const pair = handleAutoPair(state, e.key);
            if (pair) {
                e.preventDefault();
                applyResult(pair);
                return;
            }
        }
    }, [applyResult, getState]);

    // Handle paste events - check for images in clipboard
    const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const imageFile = getImageFromClipboard(e.nativeEvent);

        if (imageFile) {
            e.preventDefault();

            if (!filePath) {
                onError?.('Please save your file first before pasting images.');
                return;
            }

            try {
                const imagePath = await saveImageToFile(imageFile, filePath);
                const timestamp = Date.now();
                const altText = `image-${timestamp}`;
                const markdownImage = createMarkdownImage(imagePath, altText);

                const textarea = textareaRef.current;
                if (!textarea) return;

                const cursorPos = textarea.selectionStart;
                const { newText, newCursorPosition } = insertAtCursor(content, cursorPos, markdownImage);
                onChange(newText);

                requestAnimationFrame(() => {
                    if (textareaRef.current) {
                        textareaRef.current.selectionStart = newCursorPosition;
                        textareaRef.current.selectionEnd = newCursorPosition;
                        textareaRef.current.focus();
                    }
                });

                onImagePaste?.();
            } catch (error) {
                console.error('Failed to paste image:', error);
                onError?.('Failed to save image. Please try again.');
            }
        }
    }, [content, onChange, onImagePaste, filePath]);

    // Calculate cursor position (line and column) and active line for highlight
    const updateCursorPosition = useCallback(() => {
        if (!textareaRef.current) return;

        const textarea = textareaRef.current;
        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = textarea.value.substring(0, cursorPos);
        const linesBeforeCursor = textBeforeCursor.split("\n");
        const line = linesBeforeCursor.length;
        const column = linesBeforeCursor[linesBeforeCursor.length - 1].length + 1;

        setActiveLine(line);
        onCursorChange?.(line, column);
    }, [onCursorChange]);

    // Track cursor on every relevant event (selectionchange catches all caret moves)
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const handler = () => {
            // selectionchange fires on document; only react if our textarea is focused
            if (document.activeElement === textarea) {
                updateCursorPosition();
            }
        };

        document.addEventListener("selectionchange", handler);
        textarea.addEventListener("keyup", updateCursorPosition);
        textarea.addEventListener("click", updateCursorPosition);
        textarea.addEventListener("focus", updateCursorPosition);

        updateCursorPosition();

        return () => {
            document.removeEventListener("selectionchange", handler);
            textarea.removeEventListener("keyup", updateCursorPosition);
            textarea.removeEventListener("click", updateCursorPosition);
            textarea.removeEventListener("focus", updateCursorPosition);
        };
    }, [updateCursorPosition]);

    // Use rAF-based scroll sync for sub-frame accuracy. The native scroll event
    // can lag the caret by 1 frame; rAF lets us catch up before paint.
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        let rafId: number | null = null;
        let lastTop = -1;
        let lastLeft = -1;

        const sync = () => {
            const t = textareaRef.current;
            if (!t) {
                rafId = null;
                return;
            }
            const top = t.scrollTop;
            const left = t.scrollLeft;
            if (top !== lastTop || left !== lastLeft) {
                if (highlightRef.current) {
                    highlightRef.current.scrollTop = top;
                    highlightRef.current.scrollLeft = left;
                }
                if (gutterRef.current) {
                    gutterRef.current.scrollTop = top;
                }
                if (top !== lastTop && onScrollFraction) {
                    const max = t.scrollHeight - t.clientHeight;
                    onScrollFraction(max > 0 ? top / max : 0);
                }
                lastTop = top;
                lastLeft = left;
            }
            rafId = requestAnimationFrame(sync);
        };

        rafId = requestAnimationFrame(sync);

        return () => {
            if (rafId !== null) cancelAnimationFrame(rafId);
        };
    }, [onScrollFraction]);

    // Register an imperative scroller so external code (split-view sync) can
    // drive our scroll position by fraction without touching internals.
    useEffect(() => {
        if (!registerScroller) return;
        registerScroller({
            setFraction: (f: number) => {
                const t = textareaRef.current;
                if (!t) return;
                const max = t.scrollHeight - t.clientHeight;
                if (max > 0) t.scrollTop = max * f;
            },
        });
        return () => registerScroller(null);
    }, [registerScroller]);

    // Memoize highlighted lines to avoid recalculating on non-content re-renders
    const highlightedLines = useMemo(() => lines.map((line) => highlightLine(line)), [lines]);

    // Typewriter mode: keep the active line vertically centered as the caret moves.
    useEffect(() => {
        if (!typewriterMode) return;
        const t = textareaRef.current;
        if (!t) return;
        const targetTop = (activeLine - 1) * EDITOR_LINE_HEIGHT - t.clientHeight / 2 + EDITOR_LINE_HEIGHT / 2;
        // Smooth via rAF for a calmer scroll than scrollTo({behavior:'smooth'}) which
        // can fight the user's own input on some browsers.
        const start = t.scrollTop;
        const distance = Math.max(0, targetTop) - start;
        if (Math.abs(distance) < 1) return;
        let raf = 0;
        const t0 = performance.now();
        const dur = 120;
        const step = (now: number) => {
            const p = Math.min(1, (now - t0) / dur);
            const eased = 1 - Math.pow(1 - p, 3);
            t.scrollTop = start + distance * eased;
            if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [activeLine, typewriterMode]);

    // Slash-command trigger: when user types "/" at start of line (or after whitespace),
    // notify parent so it can open the slash menu near the caret.
    useEffect(() => {
        const t = textareaRef.current;
        if (!t || !onSlashTrigger) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key !== "/") return;
            // Only trigger when we're about to type "/" at the start of a line
            // or after whitespace. Defer to rAF so the textarea has the new value.
            requestAnimationFrame(() => {
                const pos = t.selectionStart;
                const before = t.value.slice(0, pos);
                const lastNl = before.lastIndexOf("\n");
                const lineHead = before.slice(lastNl + 1);
                if (lineHead === "/") {
                    // Caret coords: roughly cursor line × line-height + padding offset
                    const lineIdx = before.split("\n").length - 1;
                    const rect = t.getBoundingClientRect();
                    const x = rect.left + EDITOR_PADDING;
                    const y = rect.top + EDITOR_PADDING + (lineIdx * EDITOR_LINE_HEIGHT) - t.scrollTop + EDITOR_LINE_HEIGHT;
                    onSlashTrigger(t, { x, y });
                }
            });
        };
        t.addEventListener("keydown", handler);
        return () => t.removeEventListener("keydown", handler);
    }, [onSlashTrigger]);

    // Syntax highlighting for markdown
    function highlightLine(line: string): React.ReactNode {
        if (line.startsWith("# ")) {
            return <span className="text-[var(--syntax-h1)] font-bold">{line}</span>;
        }
        if (line.startsWith("## ")) {
            return <span className="text-[var(--syntax-h2)] font-bold">{line}</span>;
        }
        if (line.startsWith("### ") || line.startsWith("#### ")) {
            return <span className="text-[var(--syntax-h3)] font-semibold">{line}</span>;
        }
        if (line.startsWith("```")) {
            return <span className="text-[var(--syntax-code)]">{line}</span>;
        }
        if (line.match(/^[\s]*[-*+]\s/)) {
            const marker = line.match(/^[\s]*[-*+]/)?.[0] || "";
            const rest = line.slice(marker.length);
            return (
                <>
                    <span className="text-[var(--syntax-list)]">{marker}</span>
                    <span>{rest}</span>
                </>
            );
        }
        if (line.match(/^[\s]*\d+\.\s/)) {
            const match = line.match(/^([\s]*\d+\.)/);
            const marker = match?.[0] || "";
            const rest = line.slice(marker.length);
            return (
                <>
                    <span className="text-[var(--syntax-number)]">{marker}</span>
                    <span>{rest}</span>
                </>
            );
        }
        if (line.startsWith(">")) {
            return <span className="text-[var(--syntax-quote)] italic">{line}</span>;
        }
        if (line.includes("![") && line.includes("](")) {
            return highlightImages(line);
        }
        if (line.includes("[") && line.includes("](")) {
            return highlightLinks(line);
        }
        if (line.includes("**")) {
            return highlightBold(line);
        }
        // Empty lines must render something with zero width but real height.
        // Using "" lets the parent line-height (24px) own vertical metrics —
        // identical to how a textarea renders an empty line. NBSP would shift
        // baseline metrics on some fonts and desync the caret.
        return <span>{line}</span>;
    }

    function highlightImages(text: string): React.ReactNode {
        const parts: React.ReactNode[] = [];
        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        let lastIndex = 0;
        let match;
        let key = 0;

        while ((match = imageRegex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
            }

            const altText = match[1];
            const url = match[2];
            const displayUrl = url.startsWith('data:')
                ? `data:image/...`
                : url.length > 40
                    ? url.slice(0, 37) + '...'
                    : url;

            parts.push(
                <span key={key++} className="text-[var(--syntax-link)]">
                    <span className="text-[var(--syntax-bold)]">!</span>
                    [{altText}]
                    <span className="text-[var(--syntax-code)] opacity-70">({displayUrl})</span>
                </span>
            );
            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < text.length) {
            parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
        }

        return parts.length > 0 ? <>{parts}</> : <span>{text}</span>;
    }

    function highlightLinks(text: string): React.ReactNode {
        const parts: React.ReactNode[] = [];
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let lastIndex = 0;
        let match;
        let key = 0;

        while ((match = linkRegex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
            }
            parts.push(
                <span key={key++} className="text-[var(--syntax-link)]">
                    [{match[1]}]
                    <span className="text-[var(--syntax-code)]">({match[2]})</span>
                </span>
            );
            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < text.length) {
            parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
        }

        return parts.length > 0 ? <>{parts}</> : <span>{text}</span>;
    }

    function highlightBold(text: string): React.ReactNode {
        const parts: React.ReactNode[] = [];
        const boldRegex = /\*\*([^*]+)\*\*/g;
        let lastIndex = 0;
        let match;
        let key = 0;

        while ((match = boldRegex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
            }
            parts.push(
                <span key={key++} className="text-[var(--syntax-bold)] font-bold">
                    {match[0]}
                </span>
            );
            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < text.length) {
            parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
        }

        return parts.length > 0 ? <>{parts}</> : <span>{text}</span>;
    }

    const handleFindJump = useCallback((start: number, end: number) => {
        const t = textareaRef.current;
        if (!t) return;
        t.focus();
        t.selectionStart = start;
        t.selectionEnd = end;
        // Scroll the matched line into view (textarea native scrollIntoView is unreliable;
        // compute by line index instead)
        const lineIdx = content.slice(0, start).split("\n").length - 1;
        const desiredTop = lineIdx * EDITOR_LINE_HEIGHT - t.clientHeight / 2;
        t.scrollTop = Math.max(0, desiredTop);
    }, [content]);

    const handleFindReplace = useCallback((newContent: string, newCursor: number) => {
        onChange(newContent);
        requestAnimationFrame(() => {
            const t = textareaRef.current;
            if (!t) return;
            t.selectionStart = newCursor;
            t.selectionEnd = newCursor;
        });
    }, [onChange]);

    const insertAtCaret = useCallback((text: string) => {
        const t = textareaRef.current;
        if (!t) return;
        applyResult({
            text: t.value.slice(0, t.selectionStart) + text + t.value.slice(t.selectionEnd),
            selStart: t.selectionStart + text.length,
            selEnd: t.selectionStart + text.length,
        });
    }, [applyResult]);

    return (
        <main className="flex-1 flex flex-col overflow-hidden relative">
            {showToolbar && (
                <FormatToolbar
                    getTextarea={() => textareaRef.current}
                    apply={applyResult}
                    insert={insertAtCaret}
                />
            )}
            <div className="flex flex-1 overflow-hidden relative">
            {/* Line Numbers Gutter */}
            <div
                ref={gutterRef}
                className="w-14 shrink-0 bg-[var(--bg-gutter)] border-r border-[var(--border-subtle)] no-select text-xs text-[var(--text-muted)] overflow-hidden transition-colors"
                style={{
                    fontFamily: EDITOR_FONT_FAMILY,
                    fontSize: `${EDITOR_FONT_SIZE}px`,
                    lineHeight: `${EDITOR_LINE_HEIGHT}px`,
                    paddingTop: `${EDITOR_PADDING}px`,
                    paddingBottom: `${EDITOR_PADDING}px`,
                    paddingRight: "12px",
                }}
            >
                <div className="flex flex-col items-end">
                    {Array.from({ length: lineCount }, (_, i) => {
                        const isActive = i + 1 === activeLine;
                        return (
                            <div
                                key={i}
                                className={isActive ? "text-[var(--text-primary)] font-medium" : ""}
                                style={{ height: `${EDITOR_LINE_HEIGHT}px`, lineHeight: `${EDITOR_LINE_HEIGHT}px` }}
                            >
                                {i + 1}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Editor Container */}
            <div className="flex-1 relative bg-[var(--bg-editor)] transition-colors">
                {/* Syntax Highlighted Layer (visual only).
                    Active-line band lives inside this scroll container so it tracks
                    scroll naturally — no JS scrollTop math required. */}
                <div
                    ref={highlightRef}
                    className="absolute inset-0 text-[var(--text-primary)] pointer-events-none overflow-hidden"
                    aria-hidden="true"
                    style={sharedTextStyle}
                >
                    <div
                        className="absolute left-0 right-0 pointer-events-none"
                        style={{
                            top: `${EDITOR_PADDING + (activeLine - 1) * EDITOR_LINE_HEIGHT}px`,
                            height: `${EDITOR_LINE_HEIGHT}px`,
                            background: "var(--bg-hover)",
                            opacity: 0.45,
                        }}
                    />
                    {highlightedLines.map((highlighted, i) => {
                        const isActive = i + 1 === activeLine;
                        return (
                            <div
                                key={i}
                                style={{
                                    height: `${EDITOR_LINE_HEIGHT}px`,
                                    lineHeight: `${EDITOR_LINE_HEIGHT}px`,
                                    position: "relative",
                                    opacity: focusMode && !isActive ? 0.35 : 1,
                                    transition: focusMode ? "opacity 150ms ease-out" : undefined,
                                }}
                            >
                                {highlighted}
                            </div>
                        );
                    })}
                </div>

                <FindReplaceBar
                    isOpen={findOpen}
                    initialMode={findMode}
                    content={content}
                    selectionStart={selStartForFind}
                    onClose={() => {
                        setFindOpen(false);
                        textareaRef.current?.focus();
                    }}
                    onJumpTo={handleFindJump}
                    onReplace={handleFindReplace}
                />

                {/* Actual Editable Textarea — transparent text, real caret. */}
                <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={handleChange}
                    onPaste={handlePaste}
                    onKeyDown={onKeyDown}
                    spellCheck={false}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    className="absolute inset-0 w-full h-full bg-transparent text-transparent caret-[var(--accent)] resize-none outline-none overflow-auto border-0"
                    style={{
                        ...sharedTextStyle,
                        caretColor: "var(--accent)",
                    }}
                />
            </div>
            </div>
        </main>
    );
}
