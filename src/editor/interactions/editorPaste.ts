import type { RefObject } from "react";
import type { EditorView } from "@codemirror/view";
import { getImageFromClipboard, saveImageToFile, createMarkdownImage } from "../../utils/imageUtils";
import { pasteUrlOnSelection, pasteUrlAutolink, pasteTsvAsTable, htmlToMarkdown } from "../../utils/smartPaste";
import { applyEditorResult, toEditorActionState } from "../core/editorPresentation";

interface EditorPasteOptions {
    filePathRef: RefObject<string | null | undefined>;
    onImagePasteRef: RefObject<(() => void) | undefined>;
    onErrorRef: RefObject<((message: string) => void) | undefined>;
}

/**
 * Converts rich clipboard input into editor transactions. All mutable inputs
 * are refs so CodeMirror can keep one DOM paste handler for its whole life.
 */
export function createEditorPasteHandler({
    filePathRef,
    onImagePasteRef,
    onErrorRef,
}: EditorPasteOptions) {
    return (event: ClipboardEvent, view: EditorView): boolean => {
        const imageFile = getImageFromClipboard(event);
        if (imageFile) {
            event.preventDefault();
            if (!filePathRef.current) {
                onErrorRef.current?.("Please save your file first before pasting images.");
                return true;
            }
            void (async () => {
                try {
                    const imagePath = await saveImageToFile(imageFile, filePathRef.current!);
                    const markdown = createMarkdownImage(imagePath, `image-${Date.now()}`);
                    const selection = view.state.selection.main;
                    view.dispatch({ changes: { from: selection.from, to: selection.to, insert: markdown }, selection: { anchor: selection.from + markdown.length } });
                    onImagePasteRef.current?.();
                } catch (error) {
                    const message = typeof error === "string" ? error : (error as { message?: string })?.message;
                    onErrorRef.current?.(message || "Failed to save image. Please try again.");
                }
            })();
            return true;
        }

        const clipboard = event.clipboardData;
        if (!clipboard) return false;
        const html = clipboard.getData("text/html");
        const text = clipboard.getData("text/plain");
        const state = toEditorActionState(view);

        const urlOnSelection = pasteUrlOnSelection(state, text);
        if (urlOnSelection) { event.preventDefault(); applyEditorResult(view, urlOnSelection); return true; }
        const autolink = pasteUrlAutolink(state, text);
        if (autolink) { event.preventDefault(); applyEditorResult(view, autolink); return true; }
        if (!html) {
            const tsv = pasteTsvAsTable(state, text);
            if (tsv) { event.preventDefault(); applyEditorResult(view, tsv); return true; }
        }
        if (html && /<\w+/.test(html)) {
            event.preventDefault();
            void (async () => {
                let insert = text;
                try {
                    const markdown = (await htmlToMarkdown(html)).trim();
                    if (markdown) insert = markdown;
                } catch {
                    // Plain text is still a safe and predictable fallback.
                }
                const selection = view.state.selection.main;
                view.dispatch({ changes: { from: selection.from, to: selection.to, insert }, selection: { anchor: selection.from + insert.length } });
            })();
            return true;
        }
        return false;
    };
}
