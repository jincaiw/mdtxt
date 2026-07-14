import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { cleanup } from "@testing-library/react";
import { installCodeMirrorDomPolyfills } from "../../test/codemirrorDom";
import { applyEditorResult, toEditorActionState } from "./editorPresentation";

beforeAll(installCodeMirrorDomPolyfills);
afterEach(cleanup);

describe("editor presentation core", () => {
    it("applies editor actions as one document transaction with the requested selection", () => {
        const host = document.createElement("div");
        document.body.appendChild(host);
        const view = new EditorView({ state: EditorState.create({ doc: "alpha beta" }), parent: host });

        applyEditorResult(view, { text: "alpha gamma", selStart: 6, selEnd: 11 });

        expect(toEditorActionState(view)).toEqual({ text: "alpha gamma", selStart: 6, selEnd: 11 });
        view.destroy();
        host.remove();
    });
});
