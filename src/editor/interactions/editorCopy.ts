import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

export interface EditorClipboardPayload {
    plainText: string;
    html: string;
}

/**
 * Produces the two clipboard representations expected by desktop editors:
 * exact Markdown for source-aware destinations and semantic HTML for rich-text
 * destinations. ReactMarkdown deliberately does not render raw HTML, so a
 * copied untrusted document cannot smuggle executable markup into the system
 * clipboard.
 */
export function createEditorClipboardPayload(markdown: string): EditorClipboardPayload {
    return {
        plainText: markdown,
        html: renderToStaticMarkup(createElement(Markdown, {
            remarkPlugins: [[remarkGfm, { singleTilde: false }]],
        }, markdown)),
    };
}

export function selectedMarkdown(state: EditorState): string | null {
    const selections = state.selection.ranges
        .filter((range) => !range.empty)
        .map((range) => state.doc.sliceString(range.from, range.to));
    return selections.length > 0 ? selections.join("\n") : null;
}

/**
 * Runs after CodeMirror's native copy listener. CodeMirror owns text/plain,
 * including its line-wise-copy and platform fallbacks; this function only adds
 * the rich representation and must never cancel the browser event.
 */
export async function copySelectedMarkdownAsRichText(view: EditorView): Promise<boolean> {
    const markdown = selectedMarkdown(view.state);
    if (markdown === null) return false;
    const payload = createEditorClipboardPayload(markdown);
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({
            "text/plain": new Blob([payload.plainText], { type: "text/plain" }),
            "text/html": new Blob([payload.html], { type: "text/html" }),
        })]);
    } else {
        await navigator.clipboard.writeText(payload.plainText);
    }
    return true;
}
