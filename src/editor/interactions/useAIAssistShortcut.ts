import { useEffect, useState, type RefObject } from "react";
import type { EditorView } from "@codemirror/view";
import { getAIEnabled } from "../../utils/persistence";

/** Keeps AI shortcut routing outside the editor host lifecycle. */
export function useAIAssistShortcut(
    viewRef: RefObject<EditorView | null>,
    openAIBubble: () => void,
) {
    const [aiEnabled, setAiEnabled] = useState(getAIEnabled);

    useEffect(() => {
        const handler = () => {
            if (!getAIEnabled()) return;
            const view = viewRef.current;
            if (!view) return;
            const selection = view.state.selection.main;
            if (selection.from !== selection.to) {
                view.focus();
                openAIBubble();
            } else {
                window.dispatchEvent(new CustomEvent("mdtxt:toggle-ai-panel"));
            }
        };
        window.addEventListener("mdtxt:ai-assist", handler);
        return () => window.removeEventListener("mdtxt:ai-assist", handler);
    }, [openAIBubble, viewRef]);

    useEffect(() => {
        const handler = (event: Event) => setAiEnabled(!!(event as CustomEvent).detail?.enabled);
        window.addEventListener("mdtxt:ai-enabled-toggle", handler);
        return () => window.removeEventListener("mdtxt:ai-enabled-toggle", handler);
    }, []);

    return aiEnabled;
}
