import { useCallback, useEffect, useRef } from "react";
import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import type { EditorView } from "@codemirror/view";
import { invoke } from "@tauri-apps/api/core";
import { matchWikilinkPrefix, rankFileNames, toWikiName } from "../../utils/wikilinkComplete";

/**
 * Provides `[[` completions from the active file's sibling Markdown files.
 * The names remain in a ref so the editor's one-time extension sees refreshes
 * without recreating the EditorView or its completion source.
 */
export function useWikilinkCompletion(filePath?: string | null) {
    const wikiNamesRef = useRef<string[]>([]);

    useEffect(() => {
        let cancelled = false;
        const normalized = filePath ? filePath.replace(/\\/g, "/") : "";
        const lastSlash = normalized.lastIndexOf("/");
        const directory = filePath && lastSlash > 0 ? filePath.slice(0, lastSlash) : null;
        if (!directory) {
            wikiNamesRef.current = [];
            return;
        }
        const load = () => {
            invoke<{ name: string; path: string }[]>("list_directory_files", { directory })
                .then((entries) => {
                    if (cancelled) return;
                    wikiNamesRef.current = entries
                        .filter((entry) => entry.path !== filePath)
                        .map((entry) => toWikiName(entry.name))
                        .filter(Boolean);
                })
                .catch(() => { if (!cancelled) wikiNamesRef.current = []; });
        };
        load();
        window.addEventListener("focus", load);
        return () => {
            cancelled = true;
            window.removeEventListener("focus", load);
        };
    }, [filePath]);

    return useCallback((context: CompletionContext): CompletionResult | null => {
        const line = context.state.doc.lineAt(context.pos);
        const textBefore = line.text.slice(0, context.pos - line.from);
        const match = matchWikilinkPrefix(textBefore);
        if (!match) return null;
        const names = rankFileNames(wikiNamesRef.current, match.query);
        if (names.length === 0) return null;
        const from = line.from + match.from;
        const hasClose = context.state.doc.sliceString(context.pos, context.pos + 2) === "]]";
        const options: Completion[] = names.map((name) => ({
            label: name,
            type: "text",
            apply: (view: EditorView, _completion: Completion, fromPos: number, toPos: number) => {
                const insert = hasClose ? name : `${name}]]`;
                view.dispatch({
                    changes: { from: fromPos, to: toPos, insert },
                    selection: { anchor: fromPos + name.length + 2 },
                });
            },
        }));
        return { from, options, validFor: /^[^\]\n|]*$/ };
    }, []);
}
