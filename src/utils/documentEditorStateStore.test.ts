import { EditorState } from "@codemirror/state";
import { history, undo } from "@codemirror/commands";
import { describe, expect, it } from "vitest";
import { DocumentEditorStateStore } from "./documentEditorStateStore";

function edited(text: string, suffix: string): EditorState {
    const original = EditorState.create({ doc: text, extensions: [history()] });
    return original.update({ changes: { from: original.doc.length, insert: suffix } }).state;
}

describe("DocumentEditorStateStore", () => {
    it("retains a separate CodeMirror state and undo history for every document", () => {
        const store = new DocumentEditorStateStore();
        store.set("a", edited("first", " A"));
        store.set("b", edited("second", " B"));

        let afterUndo = store.get("a")!;
        expect(undo({ state: afterUndo, dispatch: (transaction) => { afterUndo = transaction.state; } })).toBe(true);
        store.set("a", afterUndo);

        expect(store.get("a")?.doc.toString()).toBe("first");
        expect(store.get("b")?.doc.toString()).toBe("second B");
        expect(store.remove("a")).toBe(true);
        expect(store.get("a")).toBeNull();
    });
});
