import type { EditorState } from "@codemirror/state";

/**
 * Runtime-only companion to DocumentSession. A CodeMirror EditorState contains
 * extensions and undo history, so it stays outside the framework-independent
 * document metadata model while still being owned per document id.
 */
export class DocumentEditorStateStore {
    private readonly states = new Map<string, EditorState>();

    get(id: string): EditorState | null {
        return this.states.get(id) ?? null;
    }

    set(id: string, state: EditorState): void {
        this.states.set(id, state);
    }

    remove(id: string): boolean {
        return this.states.delete(id);
    }
}
