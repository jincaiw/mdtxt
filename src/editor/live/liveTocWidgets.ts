import type { EditorState, Range } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { makeLiveProjectionEditable } from "./liveBlockProjection";

class LiveTocWidget extends WidgetType {
    constructor(private readonly source: string, private readonly from: number) { super(); }
    eq(other: LiveTocWidget) { return this.source === other.source; }
    toDOM(view: EditorView) {
        const nav = document.createElement("nav");
        nav.className = "cm-live-block-widget cm-live-toc-widget";
        const title = document.createElement("strong");
        title.textContent = "Table of contents";
        nav.append(title);
        const list = document.createElement("ol");
        const seen = new Map<string, number>();
        this.source.split(/\r?\n/).forEach((line) => {
            const match = line.match(/^\s*(#{1,6})\s+(.+?)\s*$/);
            if (!match) return;
            const text = match[2].trim();
            const base = text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-") || "section";
            const count = seen.get(base) ?? 0;
            seen.set(base, count + 1);
            const item = document.createElement("li");
            item.style.marginLeft = `${Math.max(0, match[1].length - 1) * 12}px`;
            item.textContent = text;
            list.append(item);
        });
        nav.append(list);
        makeLiveProjectionEditable(nav, view, this.from);
        return nav;
    }
    ignoreEvent() { return false; }
}

function decorations(state: EditorState): DecorationSet {
    const source = state.doc.toString();
    const widgets: Range<Decoration>[] = [];
    for (const match of source.matchAll(/^\s*\[TOC\]\s*$/gim)) {
        const from = match.index ?? 0;
        const to = from + match[0].length;
        if (state.selection.ranges.some((range) => range.from <= to && range.to >= from)) continue;
        widgets.push(Decoration.replace({ widget: new LiveTocWidget(source, from) }).range(from, to));
    }
    return Decoration.set(widgets, true);
}

export const liveTocWidgets = EditorView.decorations.compute(["doc", "selection"], decorations);
