import { beforeAll, describe, expect, it, vi } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { installCodeMirrorDomPolyfills } from "../../test/codemirrorDom";
import { attachLiveBlockAdapter } from "./liveBlockProjection";

beforeAll(installCodeMirrorDomPolyfills);

describe("LiveBlockAdapter", () => {
    it("returns pointer activation to the exact Markdown source position", () => {
        const parent = document.createElement("div");
        document.body.append(parent);
        const view = new EditorView({ state: EditorState.create({ doc: "abcdef" }), parent });
        const projection = document.createElement("section");
        parent.append(projection);

        attachLiveBlockAdapter(projection, view, 2);
        const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
        projection.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(projection).toHaveAttribute("data-live-projection", "true");
        expect(view.state.selection.main.head).toBe(3);
        view.destroy();
        parent.remove();
    });

    it.each(["Enter", "F2"])("supports %s keyboard activation", (key) => {
        const parent = document.createElement("div");
        document.body.append(parent);
        const view = new EditorView({ state: EditorState.create({ doc: "abcdef" }), parent });
        const projection = document.createElement("section");
        parent.append(projection);
        const focus = vi.spyOn(view, "focus");

        attachLiveBlockAdapter(projection, view, 4);
        const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
        projection.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(view.state.selection.main.head).toBe(5);
        expect(focus).toHaveBeenCalled();
        view.destroy();
        parent.remove();
    });
});
