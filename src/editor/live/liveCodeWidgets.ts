import { syntaxTree } from "@codemirror/language";
import type { EditorState, Range } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { liveText, type LiveLocale } from "./liveLocale";
import { makeLiveProjectionEditable } from "./liveBlockProjection";

class LiveCodeWidget extends WidgetType {
    constructor(
        private readonly source: string,
        private readonly language: string,
        private readonly code: string,
        private readonly codeFrom: number,
        private readonly codeTo: number,
        private readonly locale: LiveLocale,
        private readonly from: number,
    ) {
        super();
    }

    eq(other: LiveCodeWidget) {
        return this.source === other.source;
    }

    toDOM(view: EditorView) {
        const wrapper = document.createElement("section");
        wrapper.className = "cm-live-block-widget cm-live-code-widget";
        const label = document.createElement("span");
        label.className = "cm-live-widget-label";
        label.textContent = this.language || liveText(this.locale, "纯文本", "Plain text");
        const pre = document.createElement("pre");
        const code = document.createElement("code");
        code.textContent = this.code;
        code.contentEditable = "true";
        code.tabIndex = 0;
        code.spellcheck = false;
        code.setAttribute("role", "textbox");
        code.setAttribute("aria-label", liveText(this.locale, "编辑代码块", "Edit code block"));
        // Keep direct code editing inside the widget. The section itself still
        // exposes the deliberate Source fallback on its label/background.
        code.addEventListener("mousedown", (event) => event.stopPropagation());
        let cancelled = false;
        code.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            cancelled = true;
            code.textContent = this.code;
            code.blur();
        });
        code.addEventListener("blur", () => {
            if (cancelled) return;
            const next = code.textContent ?? "";
            if (next !== this.code) view.dispatch({ changes: { from: this.codeFrom, to: this.codeTo, insert: next } });
        });
        pre.append(code);
        wrapper.append(label, pre);
        makeLiveProjectionEditable(wrapper, view, this.from);
        return wrapper;
    }

    ignoreEvent() {
        return false;
    }
}

function codeDecorations(state: EditorState, locale: LiveLocale): DecorationSet {
    const widgets: Range<Decoration>[] = [];
        syntaxTree(state).iterate({
            enter(node) {
                if (node.name !== "FencedCode") return;
                if (state.selection.ranges.some((range) => range.from <= node.to && range.to >= node.from)) return;
                const info = node.node.getChild("CodeInfo");
                const language = info ? state.doc.sliceString(info.from, info.to).trim() : "";
                if (language.toLowerCase() === "mermaid") return;
                const text = node.node.getChild("CodeText");
                const code = text ? state.doc.sliceString(text.from, text.to) : "";
                const source = state.doc.sliceString(node.from, node.to);
                widgets.push(Decoration.replace({
                    widget: new LiveCodeWidget(source, language, code, text?.from ?? node.from, text?.to ?? node.from, locale, node.from),
                }).range(node.from, node.to));
            },
        });
    return Decoration.set(widgets, true);
}

export function liveCodeWidgets(locale: LiveLocale) {
    return EditorView.decorations.compute(["doc", "selection"], (state) => codeDecorations(state, locale));
}
