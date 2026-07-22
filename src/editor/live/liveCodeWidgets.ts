import { syntaxTree } from "@codemirror/language";
import type { Range } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";

class LiveCodeWidget extends WidgetType {
    constructor(
        private readonly source: string,
        private readonly language: string,
        private readonly code: string,
    ) {
        super();
    }

    eq(other: LiveCodeWidget) {
        return this.source === other.source;
    }

    toDOM() {
        const wrapper = document.createElement("section");
        wrapper.className = "cm-live-block-widget cm-live-code-widget";
        const label = document.createElement("span");
        label.className = "cm-live-widget-label";
        label.textContent = this.language || "plain text";
        const pre = document.createElement("pre");
        const code = document.createElement("code");
        code.textContent = this.code;
        pre.append(code);
        wrapper.append(label, pre);
        return wrapper;
    }

    ignoreEvent() {
        return true;
    }
}

function codeDecorations(view: EditorView): DecorationSet {
    const widgets: Range<Decoration>[] = [];
    for (const visible of view.visibleRanges) {
        syntaxTree(view.state).iterate({
            from: visible.from,
            to: visible.to,
            enter(node) {
                if (node.name !== "FencedCode") return;
                if (view.compositionStarted || view.state.selection.ranges.some((range) => range.from <= node.to && range.to >= node.from)) return;
                const info = node.node.getChild("CodeInfo");
                const language = info ? view.state.doc.sliceString(info.from, info.to).trim() : "";
                if (language.toLowerCase() === "mermaid") return;
                const text = node.node.getChild("CodeText");
                const code = text ? view.state.doc.sliceString(text.from, text.to) : "";
                const source = view.state.doc.sliceString(node.from, node.to);
                widgets.push(Decoration.widget({
                    widget: new LiveCodeWidget(source, language, code),
                    side: 1,
                }).range(view.state.doc.lineAt(node.to).to));
            },
        });
    }
    return Decoration.set(widgets, true);
}

export const liveCodeWidgets = ViewPlugin.fromClass(class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = codeDecorations(view);
    }

    update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged || update.focusChanged) {
            this.decorations = codeDecorations(update.view);
        }
    }
}, { decorations: (plugin) => plugin.decorations });
