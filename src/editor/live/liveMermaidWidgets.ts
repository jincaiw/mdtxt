import { syntaxTree } from "@codemirror/language";
import type { EditorState, Range } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { nextMermaidRenderId, renderMermaidSvg } from "../../utils/mermaidRenderer";
import { liveText, type LiveLocale } from "./liveLocale";
import { makeLiveProjectionEditable, revealLiveSource } from "./liveBlockProjection";

class LiveMermaidWidget extends WidgetType {
    private destroyed = false;
    private readonly id = nextMermaidRenderId("mdtxt-live-mermaid");

    constructor(private readonly source: string, private readonly code: string, private readonly locale: LiveLocale, private readonly from: number) {
        super();
    }

    eq(other: LiveMermaidWidget) {
        return this.source === other.source;
    }

    toDOM(view: EditorView) {
        const section = document.createElement("section");
        section.className = "cm-live-block-widget cm-live-mermaid-widget mermaid-rendered";
        section.textContent = liveText(this.locale, "正在渲染图表…", "Rendering diagram…");
        makeLiveProjectionEditable(section, view, this.from);
        const theme = document.documentElement.getAttribute("data-theme") ?? "paper";
        void renderMermaidSvg(this.code, theme, this.id)
            .then((svg) => {
                if (!this.destroyed && section.isConnected) section.innerHTML = svg;
            })
            .catch(() => {
                if (!this.destroyed) revealLiveSource(view, this.from);
            });
        return section;
    }

    ignoreEvent() {
        return false;
    }

    destroy() {
        this.destroyed = true;
    }
}

function mermaidDecorations(state: EditorState, locale: LiveLocale): DecorationSet {
    const widgets: Range<Decoration>[] = [];
        syntaxTree(state).iterate({
            enter(node) {
                if (node.name !== "FencedCode") return;
                const info = node.node.getChild("CodeInfo");
                if (!info || state.doc.sliceString(info.from, info.to).trim().toLowerCase() !== "mermaid") return;
                if (state.selection.ranges.some((range) => range.from <= node.to && range.to >= node.from)) return;
                const text = node.node.getChild("CodeText");
                const source = state.doc.sliceString(node.from, node.to);
                const code = text ? state.doc.sliceString(text.from, text.to) : "";
                widgets.push(Decoration.replace({
                    widget: new LiveMermaidWidget(source, code, locale, node.from),
                }).range(node.from, node.to));
            },
        });
    return Decoration.set(widgets, true);
}

export function liveMermaidWidgets(locale: LiveLocale) {
    return EditorView.decorations.compute(["doc", "selection"], (state) => mermaidDecorations(state, locale));
}
