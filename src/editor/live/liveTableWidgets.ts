import { syntaxTree } from "@codemirror/language";
import type { EditorState, Range } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { parseTable, serializeTable, type Align, type TableModel } from "../../utils/tableModel";
import { revealLiveSource } from "./liveBlockProjection";

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
        wrapper.title = "Double-click to edit Markdown source";
        const table = document.createElement("table");
        const head = table.createTHead().insertRow();
        const updateCell = (row: number, column: number, element: HTMLElement) => {
            const value = (element.textContent ?? "").replace(/[\r\n]+/g, " ").replace(/\|/g, "\\|");
            const next: TableModel = {
                headers: this.model.headers.slice(),
                aligns: this.model.aligns.slice(),
                rows: this.model.rows.map((cells) => cells.slice()),
            };
            if (row === -1) next.headers[column] = value;
            else next.rows[row][column] = value;
            const replacement = serializeTable(next);
            view.dispatch({ changes: { from: this.from, to: this.from + this.source.length, insert: replacement } });
        };
        const editableCell = (cell: HTMLTableCellElement, value: string, row: number, column: number) => {
            cell.textContent = value;
            cell.contentEditable = "true";
            cell.spellcheck = true;
            cell.setAttribute("role", "textbox");
            cell.setAttribute("aria-label", row === -1 ? `Table header ${column + 1}` : `Table row ${row + 1}, column ${column + 1}`);
            // A cell edit is direct manipulation; don't let the projection's
            // source fallback steal the pointer event before editing starts.
            cell.addEventListener("mousedown", (event) => event.stopPropagation());
            cell.addEventListener("keydown", (event) => {
                if (event.key === "Enter") { event.preventDefault(); cell.blur(); }
                if (event.key === "Escape") { event.preventDefault(); cell.textContent = value; cell.blur(); }
            });
            cell.addEventListener("blur", () => updateCell(row, column, cell));
        };
        this.model.headers.forEach((header, index) => {
            const cell = document.createElement("th");
            editableCell(cell, header, -1, index);
            alignCell(cell, this.model.aligns[index] ?? "none");
            head.append(cell);
        });
        const body = table.createTBody();
        this.model.rows.forEach((row, rowIndex) => {
            const tableRow = body.insertRow();
            row.forEach((value, index) => {
                const cell = tableRow.insertCell();
                editableCell(cell, value, rowIndex, index);
                alignCell(cell, this.model.aligns[index] ?? "none");
            });
        });
        wrapper.append(table);
        wrapper.addEventListener("dblclick", () => revealLiveSource(view, this.from));
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
