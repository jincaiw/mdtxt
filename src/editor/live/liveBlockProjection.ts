import type { EditorView } from "@codemirror/view";

export function revealLiveSource(view: EditorView, from: number) {
    const anchor = Math.min(from + 1, view.state.doc.length);
    view.dispatch({ selection: { anchor }, scrollIntoView: true });
    view.focus();
}

export function makeLiveProjectionEditable(element: HTMLElement, view: EditorView, from: number) {
    element.tabIndex = 0;
    element.dataset.liveProjection = "true";
    element.title = "Click to edit Markdown source";
    element.addEventListener("mousedown", (event) => {
        event.preventDefault();
        revealLiveSource(view, from);
    });
    element.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== "F2") return;
        event.preventDefault();
        revealLiveSource(view, from);
    });
}
