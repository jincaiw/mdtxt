import { syntaxTree } from "@codemirror/language";
import type { EditorState, Range } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { parseTable, type Align, type TableModel } from "../../utils/tableModel";
import { makeLiveProjectionEditable } from "./liveBlockProjection";

function alignCell(cell: HTMLTableCellElement, align: Align) {
    if (align !== "none") cell.style.textAlign = align;
}

class LiveTableWidget extends WidgetType {
    constructor(private readonly source: string, private readonly model: TableModel, private readonly from: number) {
        super();
    }

    eq(other: LiveTableWidget) {
        return this.source === other.source;
    }

    toDOM(view: EditorView) {
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
        makeLiveProjectionEditable(wrapper, view, this.from);
        return wrapper;
    }

    ignoreEvent() {
        return false;
    }
}

function tableDecorations(state: EditorState): DecorationSet {
    const widgets: Range<Decoration>[] = [];
        syntaxTree(state).iterate({
            enter(node) {
                if (node.name !== "Table") return;
                if (state.selection.ranges.some((range) => range.from <= node.to && range.to >= node.from)) return;
                const source = state.doc.sliceString(node.from, node.to);
                const model = parseTable(source.split("\n"));
                widgets.push(Decoration.replace({
                    widget: new LiveTableWidget(source, model, node.from),
                }).range(node.from, node.to));
            },
        });
    return Decoration.set(widgets, true);
}

export const liveTableWidgets = EditorView.decorations.compute(["doc", "selection"], tableDecorations);
