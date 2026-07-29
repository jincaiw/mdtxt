import { syntaxTree } from "@codemirror/language";
import type { Range } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { makeLiveProjectionEditable } from "./liveBlockProjection";

class LiveFootnoteWidget extends WidgetType {
    constructor(private readonly source: string, private readonly label: string, private readonly note: string, private readonly from: number) {
        super();
    }

    eq(other: LiveFootnoteWidget) {
        return this.source === other.source;
    }

    toDOM(view: EditorView) {
        const aside = document.createElement("aside");
        aside.className = "cm-live-block-widget cm-live-footnote-widget";
        const marker = document.createElement("sup");
        marker.textContent = this.label;
        const text = document.createElement("span");
        text.textContent = this.note;
        aside.append(marker, text);
        makeLiveProjectionEditable(aside, view, this.from);
        return aside;
    }

    ignoreEvent() {
        return false;
    }
}

function footnoteDecorations(view: EditorView): DecorationSet {
    const widgets: Range<Decoration>[] = [];
    for (const visible of view.visibleRanges) {
        syntaxTree(view.state).iterate({
            from: visible.from,
            to: visible.to,
            enter(node) {
                if (node.name !== "Paragraph" && node.name !== "LinkReference") return;
                const source = view.state.doc.sliceString(node.from, node.to);
                if (!source.startsWith("[^")) return;
                const labelEnd = source.indexOf("]:");
                if (labelEnd < 3) return;
                if (view.compositionStarted || view.state.selection.ranges.some((range) => range.from <= node.to && range.to >= node.from)) return;
                const label = source.slice(2, labelEnd);
                const note = source.slice(labelEnd + 2).trim();
                widgets.push(Decoration.replace({
                    widget: new LiveFootnoteWidget(source, label, note, node.from),
                }).range(node.from, node.to));
            },
        });
    }
    return Decoration.set(widgets, true);
}

export const liveFootnoteWidgets = ViewPlugin.fromClass(class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = footnoteDecorations(view);
    }

    update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged || update.focusChanged) {
            this.decorations = footnoteDecorations(update.view);
        }
    }
}, { decorations: (plugin) => plugin.decorations });
