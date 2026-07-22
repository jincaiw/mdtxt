import { syntaxTree } from "@codemirror/language";
import type { Range } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { nextMermaidRenderId, renderMermaidSvg } from "../../utils/mermaidRenderer";

class LiveMermaidWidget extends WidgetType {
    private destroyed = false;
    private readonly id = nextMermaidRenderId("mdtxt-live-mermaid");

    constructor(private readonly source: string, private readonly code: string) {
        super();
    }

    eq(other: LiveMermaidWidget) {
        return this.source === other.source;
    }

    toDOM() {
        const section = document.createElement("section");
        section.className = "cm-live-block-widget cm-live-mermaid-widget mermaid-rendered";
        section.textContent = "Rendering diagram…";
        const theme = document.documentElement.getAttribute("data-theme") ?? "paper";
        void renderMermaidSvg(this.code, theme, this.id)
            .then((svg) => {
                if (!this.destroyed && section.isConnected) section.innerHTML = svg;
            })
            .catch(() => {
                if (!this.destroyed) section.textContent = "Diagram preview unavailable; edit the source above.";
            });
        return section;
    }

    ignoreEvent() {
        return true;
    }

    destroy() {
        this.destroyed = true;
    }
}

function mermaidDecorations(view: EditorView): DecorationSet {
    const widgets: Range<Decoration>[] = [];
    for (const visible of view.visibleRanges) {
        syntaxTree(view.state).iterate({
            from: visible.from,
            to: visible.to,
            enter(node) {
                if (node.name !== "FencedCode") return;
                const info = node.node.getChild("CodeInfo");
                if (!info || view.state.doc.sliceString(info.from, info.to).trim().toLowerCase() !== "mermaid") return;
                if (view.compositionStarted || view.state.selection.ranges.some((range) => range.from <= node.to && range.to >= node.from)) return;
                const text = node.node.getChild("CodeText");
                const source = view.state.doc.sliceString(node.from, node.to);
                const code = text ? view.state.doc.sliceString(text.from, text.to) : "";
                widgets.push(Decoration.widget({
                    widget: new LiveMermaidWidget(source, code),
                    side: 1,
                }).range(view.state.doc.lineAt(node.to).to));
            },
        });
    }
    return Decoration.set(widgets, true);
}

export const liveMermaidWidgets = ViewPlugin.fromClass(class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = mermaidDecorations(view);
    }

    update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged || update.focusChanged) {
            this.decorations = mermaidDecorations(update.view);
        }
    }
}, { decorations: (plugin) => plugin.decorations });
