import { syntaxTree } from "@codemirror/language";
import type { Range } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { parseTable, type Align, type TableModel } from "../../utils/tableModel";

function alignCell(cell: HTMLTableCellElement, align: Align) {
    if (align !== "none") cell.style.textAlign = align;
}

class LiveTableWidget extends WidgetType {
    constructor(private readonly source: string, private readonly model: TableModel) {
        super();
    }

    eq(other: LiveTableWidget) {
        return this.source === other.source;
    }

    toDOM() {
        const wrapper = document.createElement("section");
        wrapper.className = "cm-live-block-widget cm-live-table-widget";
        const table = document.createElement("table");
        const head = table.createTHead().insertRow();
        this.model.headers.forEach((header, index) => {
            const cell = document.createElement("th");
            cell.textContent = header;
            alignCell(cell, this.model.aligns[index] ?? "none");
            head.append(cell);
        });
        const body = table.createTBody();
        for (const row of this.model.rows) {
            const tableRow = body.insertRow();
            row.forEach((value, index) => {
                const cell = tableRow.insertCell();
                cell.textContent = value;
                alignCell(cell, this.model.aligns[index] ?? "none");
            });
        }
        wrapper.append(table);
        return wrapper;
    }

    ignoreEvent() {
        return true;
    }
}

function tableDecorations(view: EditorView): DecorationSet {
    const widgets: Range<Decoration>[] = [];
    for (const visible of view.visibleRanges) {
        syntaxTree(view.state).iterate({
            from: visible.from,
            to: visible.to,
            enter(node) {
                if (node.name !== "Table") return;
                if (view.compositionStarted || view.state.selection.ranges.some((range) => range.from <= node.to && range.to >= node.from)) return;
                const source = view.state.doc.sliceString(node.from, node.to);
                const model = parseTable(source.split("\n"));
                widgets.push(Decoration.widget({
                    widget: new LiveTableWidget(source, model),
                    side: 1,
                }).range(view.state.doc.lineAt(node.to).to));
            },
        });
    }
    return Decoration.set(widgets, true);
}

export const liveTableWidgets = ViewPlugin.fromClass(class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = tableDecorations(view);
    }

    update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged || update.focusChanged) {
            this.decorations = tableDecorations(update.view);
        }
    }
}, { decorations: (plugin) => plugin.decorations });
