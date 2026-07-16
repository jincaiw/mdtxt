import { useEffect, type RefObject } from "react";
import { RangeSetBuilder, StateField, type Compartment, type EditorState, type Extension, type Range, type Transaction } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { resolveEditFocus } from "./editFocusResolver";

const marks: Record<string, Decoration> = {
    ATXHeading1: Decoration.mark({ class: "cm-live-heading-1" }),
    ATXHeading2: Decoration.mark({ class: "cm-live-heading-2" }),
    ATXHeading3: Decoration.mark({ class: "cm-live-heading-3" }),
    ATXHeading4: Decoration.mark({ class: "cm-live-heading-4" }),
    ATXHeading5: Decoration.mark({ class: "cm-live-heading-5" }),
    ATXHeading6: Decoration.mark({ class: "cm-live-heading-6" }),
    StrongEmphasis: Decoration.mark({ class: "cm-live-strong" }),
    Emphasis: Decoration.mark({ class: "cm-live-emphasis" }),
    Strikethrough: Decoration.mark({ class: "cm-live-strikethrough" }),
    InlineCode: Decoration.mark({ class: "cm-live-inline-code" }),
    Link: Decoration.mark({ class: "cm-live-link" }),
    Blockquote: Decoration.mark({ class: "cm-live-quote" }),
    BulletList: Decoration.mark({ class: "cm-live-list" }),
    OrderedList: Decoration.mark({ class: "cm-live-list" }),
    ListMark: Decoration.mark({ class: "cm-live-list-mark" }),
    HorizontalRule: Decoration.mark({ class: "cm-live-rule" }),
    Task: Decoration.mark({ class: "cm-live-task" }),
    TaskMarker: Decoration.mark({ class: "cm-live-task-marker" }),
};

function decorationRanges(state: EditorState, from: number, to: number): readonly Range<Decoration>[] {
    const ranges: Range<Decoration>[] = [];
    syntaxTree(state).iterate({
        enter: (node) => {
            const mark = marks[node.name];
            // Do not create clipped decorations. Expanding changed ranges to
            // full lines means a node is either atomically retained or rebuilt.
            if (mark && node.from >= from && node.to <= to && node.from < node.to) {
                ranges.push(mark.range(node.from, node.to));
            }
        },
    });
    return ranges;
}

function decorationsInRange(state: EditorState, from: number, to: number): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    for (const range of decorationRanges(state, from, to)) {
        builder.add(range.from, range.to, range.value);
    }
    return builder.finish();
}

function changedLineRanges(state: EditorState, transaction: Transaction) {
    const ranges: Array<{ from: number; to: number }> = [];
    transaction.changes.iterChangedRanges((_fromA, _toA, fromB, toB) => {
        const startLine = state.doc.lineAt(Math.min(fromB, state.doc.length));
        const endLine = state.doc.lineAt(Math.min(toB, state.doc.length));
        // One adjacent line accounts for list/blockquote continuation markers
        // without degrading normal typing into a whole-document scan.
        const from = state.doc.line(Math.max(1, startLine.number - 1)).from;
        const to = state.doc.line(Math.min(state.doc.lines, endLine.number + 1)).to;
        ranges.push({ from, to });
    });
    return ranges;
}

/**
 * Safe P6 Live presentation: syntax-tree driven visual styling only. Markdown
 * delimiters are never hidden, so every focused, IME, selection and unknown
 * construct retains an immediately usable Source fallback.
 */
export const liveMarkdownDecorations = StateField.define<DecorationSet>({
    create(state) {
        return decorationsInRange(state, 0, state.doc.length);
    },
    update(decorations, transaction) {
        if (!transaction.docChanged) return decorations;
        let next = decorations.map(transaction.changes);
        for (const range of changedLineRanges(transaction.state, transaction)) {
            next = next.update({
                filter: (from, to) => to <= range.from || from >= range.to,
                add: decorationRanges(transaction.state, range.from, range.to),
            });
        }
        return next;
    },
    provide: (field) => EditorView.decorations.from(field),
});

export const liveMarkdownTheme = EditorView.baseTheme({
    "&[data-mdtxt-live] .cm-scroller": {
        fontFamily: "var(--font-body)", lineHeight: "var(--line-height)",
    },
    "&[data-mdtxt-live] .cm-content": {
        width: "100%", maxWidth: "860px", margin: "0 auto", padding: "48px 36px 120px",
    },
    "&[data-mdtxt-live] .cm-gutters": { display: "none" },
    "&[data-mdtxt-live] .cm-activeLine": { backgroundColor: "var(--live-active-line)" },
    ".cm-live-heading-1": { fontSize: "1.55em", fontWeight: "750", lineHeight: "1.45" },
    ".cm-live-heading-2": { fontSize: "1.32em", fontWeight: "720", lineHeight: "1.45" },
    ".cm-live-heading-3": { fontSize: "1.16em", fontWeight: "700" },
    ".cm-live-heading-4, .cm-live-heading-5, .cm-live-heading-6": { fontWeight: "700" },
    ".cm-live-strong": { fontWeight: "700" },
    ".cm-live-emphasis": { fontStyle: "italic" },
    ".cm-live-strikethrough": { textDecoration: "line-through" },
    ".cm-live-inline-code": {
        fontFamily: "var(--font-mono)", backgroundColor: "var(--code-bg)",
        borderRadius: "3px", padding: "0 0.18em", color: "var(--code-text)",
    },
    ".cm-live-link": { color: "var(--accent)", textDecoration: "underline" },
    ".cm-live-quote": { color: "var(--text-secondary)" },
    ".cm-live-list-mark, .cm-live-task-marker": { color: "var(--accent)" },
    ".cm-live-rule": { color: "var(--border)", fontWeight: "700" },
});

/**
 * Tracks the focus contract at the view boundary. It deliberately does not
 * mutate source or decorations: P6 uses styled source only. The data classes
 * make composition/multi-selection state explicit for a future renderer that
 * wants to collapse markers and must first consult `resolveEditFocus`.
 */
const liveEditFocusPlugin = ViewPlugin.fromClass(class {
    constructor(private readonly view: EditorView) {
        this.sync();
    }

    update(update: ViewUpdate) {
        if (update.selectionSet || update.docChanged || update.focusChanged) this.sync();
    }

    destroy() {
        // The view owns this class list; remove it when the extension is
        // compartment-reconfigured off without touching application state.
        this.view.dom.classList.remove("cm-live-composing", "cm-live-multi-selection");
    }

    private sync() {
        const view = this.view;
        const focus = resolveEditFocus({
            selections: view.state.selection.ranges.map((range) => ({ from: range.from, to: range.to })),
            compositionStarted: view.compositionStarted,
        });
        view.dom.classList.toggle("cm-live-composing", focus.keepAllSource);
        view.dom.classList.toggle("cm-live-multi-selection", view.state.selection.ranges.length > 1);
    }
});

// Put the mode marker on both the editor root and content node. The root
// attribute drives layout selectors (scroller, gutters and active line), while
// the content attribute remains a cheap integration-test/runtime probe.
const liveAttributes: Extension = [
    EditorView.editorAttributes.of({ "data-mdtxt-live": "true" }),
    EditorView.contentAttributes.of({ "data-mdtxt-live": "true" }),
];
const liveRestrictedAttributes: Extension = [
    EditorView.editorAttributes.of({ "data-mdtxt-live": "restricted" }),
    EditorView.contentAttributes.of({ "data-mdtxt-live": "restricted" }),
];
const liveMarkdownBase: Extension = [liveMarkdownDecorations, liveEditFocusPlugin, liveMarkdownTheme];
export const liveMarkdownPresentation: Extension = [liveMarkdownBase, liveAttributes];
/** Restricted Live avoids the full-document decoration field entirely. */
export const restrictedLiveMarkdownPresentation: Extension = [liveEditFocusPlugin, liveMarkdownTheme, liveRestrictedAttributes];

/** Reconfigures the isolated Live compartment without rebuilding EditorView. */
export function useLiveMarkdownPresentation({
    viewRef,
    liveCompRef,
    enabled,
    restricted = false,
    documentId,
}: {
    viewRef: RefObject<EditorView | null>;
    liveCompRef: RefObject<Compartment>;
    enabled: boolean;
    restricted?: boolean;
    /** Reconfigure after retained EditorState switches between documents. */
    documentId: string;
}) {
    useEffect(() => {
        viewRef.current?.dispatch({
            effects: liveCompRef.current.reconfigure(enabled
                ? (restricted ? restrictedLiveMarkdownPresentation : liveMarkdownPresentation)
                : []),
        });
    }, [documentId, enabled, liveCompRef, restricted, viewRef]);
}
