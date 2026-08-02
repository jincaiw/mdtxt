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
        type CellAddress = { row: number; column: number };
        const valueOf = (element: HTMLElement) => (element.textContent ?? "").replace(/[\r\n]+/g, " ").replace(/\|/g, "\\|");
        const focusCell = (target: CellAddress) => {
            requestAnimationFrame(() => {
                const selector = `[data-live-table-cell="${target.row}:${target.column}"]`;
                view.dom.querySelector<HTMLElement>(selector)?.focus();
            });
        };
        const updateCell = (row: number, column: number, element: HTMLElement, target?: CellAddress, appendRow = false) => {
            const value = valueOf(element);
            const next: TableModel = {
                headers: this.model.headers.slice(),
                aligns: this.model.aligns.slice(),
                rows: this.model.rows.map((cells) => cells.slice()),
            };
            if (row === -1) next.headers[column] = value;
            else next.rows[row][column] = value;
            if (appendRow) next.rows.push(new Array(next.headers.length).fill(""));
            const replacement = serializeTable(next);
            view.dispatch({ changes: { from: this.from, to: this.from + this.source.length, insert: replacement } });
            if (target) focusCell(target);
        };
        const editableCell = (cell: HTMLTableCellElement, value: string, row: number, column: number) => {
            cell.textContent = value;
            cell.contentEditable = "true";
            cell.tabIndex = 0;
            cell.spellcheck = true;
            cell.dataset.liveTableCell = `${row}:${column}`;
            cell.setAttribute("role", "textbox");
            cell.setAttribute("aria-label", row === -1 ? `Table header ${column + 1}` : `Table row ${row + 1}, column ${column + 1}`);
            // A cell edit is direct manipulation; don't let the projection's
            // source fallback steal the pointer event before editing starts.
            cell.addEventListener("mousedown", (event) => event.stopPropagation());
            let cancelled = false;
            let committed = false;
            const nextCell = (backwards: boolean, keepColumn = false): { target?: CellAddress; appendRow?: boolean } => {
                const columns = this.model.headers.length;
                if (keepColumn) {
                    if (row === -1) return this.model.rows.length > 0 ? { target: { row: 0, column } } : { target: { row: 0, column }, appendRow: true };
                    return row + 1 < this.model.rows.length ? { target: { row: row + 1, column } } : { target: { row: row + 1, column }, appendRow: true };
                }
                if (backwards) {
                    if (column > 0) return { target: { row, column: column - 1 } };
                    if (row > 0) return { target: { row: row - 1, column: columns - 1 } };
                    if (row === 0) return { target: { row: -1, column: columns - 1 } };
                    return {};
                }
                if (column + 1 < columns) return { target: { row, column: column + 1 } };
                if (row === -1) return this.model.rows.length > 0 ? { target: { row: 0, column: 0 } } : { target: { row: 0, column: 0 }, appendRow: true };
                return row + 1 < this.model.rows.length ? { target: { row: row + 1, column: 0 } } : { target: { row: row + 1, column: 0 }, appendRow: true };
            };
            cell.addEventListener("keydown", (event) => {
                if (event.key === "Escape") {
                    event.preventDefault();
                    cancelled = true;
                    cell.textContent = value;
                    cell.blur();
                    return;
                }
                if (event.key === "Tab" || event.key === "Enter") {
                    event.preventDefault();
                    const next = nextCell(event.shiftKey, event.key === "Enter");
                    committed = true;
                    updateCell(row, column, cell, next.target, next.appendRow);
                }
            });
            cell.addEventListener("blur", () => { if (!cancelled && !committed) updateCell(row, column, cell); });
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
    const selectionTouchesTableInterior = (from: number, to: number) => state.selection.ranges.some((range) => {
        // A collapsed cursor exactly on either block boundary is outside the
        // table for presentation purposes. Treating `to` as inclusive made a
        // freshly completed table stay as raw Markdown after Source → Live.
        if (range.empty) return range.from > from && range.from < to;
        return range.from < to && range.to > from;
    });
        syntaxTree(state).iterate({
            enter(node) {
                if (node.name !== "Table") return;
                if (selectionTouchesTableInterior(node.from, node.to)) return;
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
