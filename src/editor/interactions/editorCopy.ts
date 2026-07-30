import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { writeHtml } from "@tauri-apps/plugin-clipboard-manager";

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
 * Copies an explicit rich selection through Tauri's native clipboard. Normal
 * Ctrl/Cmd+C remains CodeMirror-owned (including its line-wise-copy and IME
 * fallbacks); this is intentionally a separate toolbar/menu action.
 */
export async function copySelectedMarkdownAsRichText(view: EditorView): Promise<boolean> {
    const markdown = selectedMarkdown(view.state);
    if (markdown === null) return false;
    const payload = createEditorClipboardPayload(markdown);
    try {
        await writeHtml(payload.html, payload.plainText);
    } catch {
        // Browser preview/tests do not load Tauri's native plugin. Keep the
        // same two MIME representations wherever the Web Clipboard API exists.
        if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
            await navigator.clipboard.write([new ClipboardItem({
                "text/plain": new Blob([payload.plainText], { type: "text/plain" }),
                "text/html": new Blob([payload.html], { type: "text/html" }),
            })]);
        } else {
            await navigator.clipboard.writeText(payload.plainText);
        }
    }
    return true;
}
