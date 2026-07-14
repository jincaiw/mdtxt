import type { EditorState as CMEditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { EditorResult, EditorState } from "../../utils/editorActions";

const EDITOR_FONT_FAMILY =
    "'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

// Markdown syntax colours, driven by the same CSS variables the rest of the app
// themes with — so light/dark/paper/dracula all "just work" in the editor too.
export const markdownHighlight = HighlightStyle.define([
    { tag: t.heading1, color: "var(--syntax-h1)", fontWeight: "bold" },
    { tag: t.heading2, color: "var(--syntax-h2)", fontWeight: "bold" },
    { tag: [t.heading3, t.heading4, t.heading5, t.heading6], color: "var(--syntax-h3)", fontWeight: "600" },
    { tag: t.strong, color: "var(--syntax-bold)", fontWeight: "bold" },
    { tag: t.emphasis, fontStyle: "italic" },
    { tag: t.strikethrough, textDecoration: "line-through" },
    { tag: t.link, color: "var(--syntax-link)" },
    { tag: t.url, color: "var(--syntax-link)" },
    { tag: t.monospace, color: "var(--syntax-code)" },
    { tag: t.quote, color: "var(--syntax-quote)", fontStyle: "italic" },
    { tag: t.list, color: "var(--syntax-list)" },
    { tag: t.processingInstruction, color: "var(--syntax-list)" },
]);

export const markdownPresentationExtensions = syntaxHighlighting(markdownHighlight);

export const editorTheme = EditorView.theme({
    "&": {
        height: "100%",
        color: "var(--text-primary)",
        backgroundColor: "var(--bg-editor)",
        fontSize: "14px",
    },
    ".cm-scroller": {
        fontFamily: EDITOR_FONT_FAMILY,
        lineHeight: "24px",
        overflow: "auto",
    },
    ".cm-content": {
        caretColor: "var(--accent)",
        padding: "16px 0",
    },
    ".cm-gutters": {
        backgroundColor: "var(--bg-gutter)",
        color: "var(--text-muted)",
        border: "none",
        borderRight: "1px solid var(--border-subtle)",
    },
    ".cm-activeLine": { backgroundColor: "var(--bg-hover)" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--text-primary)" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
        backgroundColor: "var(--selection-bg)",
    },
    // CodeMirror's base theme paints the focused selection through a more
    // specific selector, so the app theme must mirror that selector as well.
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
        backgroundColor: "var(--selection-bg)",
    },
    ".cm-foldPlaceholder": { backgroundColor: "var(--bg-hover)", color: "var(--text-secondary)", border: "none" },
});

/** Build the EditorState shape the tested editorActions helpers expect. */
export function toEditorActionState(view: EditorView): EditorState {
    const selection = view.state.selection.main;
    return { text: view.state.doc.toString(), selStart: selection.from, selEnd: selection.to };
}

/**
 * Apply a full-text editor action as its smallest contiguous document change.
 * This preserves CodeMirror history granularity and avoids replacing unaffected
 * text when a command only changes a small selection.
 */
export function applyEditorResult(view: EditorView, result: EditorResult) {
    const old = view.state.doc.toString();
    const next = result.text;
    let prefix = 0;
    const maxPrefix = Math.min(old.length, next.length);
    while (prefix < maxPrefix && old.charCodeAt(prefix) === next.charCodeAt(prefix)) prefix++;
    let suffix = 0;
    const maxSuffix = Math.min(old.length - prefix, next.length - prefix);
    while (suffix < maxSuffix && old.charCodeAt(old.length - 1 - suffix) === next.charCodeAt(next.length - 1 - suffix)) suffix++;
    view.dispatch({
        changes: { from: prefix, to: old.length - suffix, insert: next.slice(prefix, next.length - suffix) },
        selection: { anchor: result.selStart, head: result.selEnd },
        scrollIntoView: true,
    });
}

export type { CMEditorState };
