import type { EditorView } from "@codemirror/view";

/**
 * Shared interaction adapter for projected Live blocks. Widgets retain their
 * own renderer while this adapter gives every non-inline-editable block the
 * same pointer/keyboard route back to exact Markdown source.
 */
export interface LiveBlockAdapter {
    activate(): void;
}

export function revealLiveSource(view: EditorView, from: number) {
    const anchor = Math.min(from + 1, view.state.doc.length);
    view.dispatch({ selection: { anchor }, scrollIntoView: true });
    view.focus();
}

export function attachLiveBlockAdapter(element: HTMLElement, view: EditorView, from: number): LiveBlockAdapter {
    const adapter: LiveBlockAdapter = {
        activate: () => revealLiveSource(view, from),
    };
    element.tabIndex = 0;
    element.dataset.liveProjection = "true";
    element.title = "Click to edit Markdown source";
    element.addEventListener("mousedown", (event) => {
        event.preventDefault();
        adapter.activate();
    });
    element.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== "F2") return;
        event.preventDefault();
        adapter.activate();
    });
    return adapter;
}

// Compatibility name for existing widget renderers. New widgets should use
// `attachLiveBlockAdapter` so their activation contract is explicit.
export const makeLiveProjectionEditable = attachLiveBlockAdapter;
