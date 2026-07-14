import { EditorState } from "@codemirror/state";
import { history, undo } from "@codemirror/commands";
import { describe, expect, it } from "vitest";

function insertAtEnd(state: EditorState, text: string): EditorState {
    return state.update({ changes: { from: state.doc.length, insert: text } }).state;
}

function undoOnce(state: EditorState): EditorState {
    let next = state;
    const handled = undo({
        state,
        dispatch: (transaction) => {
            next = transaction.state;
        },
    });
    expect(handled).toBe(true);
    return next;
}

describe("per-document CodeMirror state contract", () => {
    it("keeps undo history isolated when two tab states are swapped", () => {
        const first = insertAtEnd(EditorState.create({ doc: "first", extensions: [history()] }), " A");
        const second = insertAtEnd(EditorState.create({ doc: "second", extensions: [history()] }), " B");

        expect(undoOnce(second).doc.toString()).toBe("second");
        expect(undoOnce(first).doc.toString()).toBe("first");
    });
});
