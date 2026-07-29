import { syntaxTree } from "@codemirror/language";
import type { EditorState, Range } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { liveCalloutTitle, type LiveLocale } from "./liveLocale";
import { makeLiveProjectionEditable } from "./liveBlockProjection";

const CALLOUT_TYPES = new Set(["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"]);

interface Callout { type: string; body: string }

function parseCallout(source: string): Callout | null {
    const lines = source.split("\n").map((line) => line.replace(/^\s*>\s?/, ""));
    const first = lines[0]?.trim() ?? "";
    if (!first.startsWith("[!") || !first.endsWith("]")) return null;
    const type = first.slice(2, -1).toUpperCase();
    if (!CALLOUT_TYPES.has(type)) return null;
    return { type, body: lines.slice(1).join("\n").trim() };
}

class LiveCalloutWidget extends WidgetType {
    constructor(private readonly source: string, private readonly callout: Callout, private readonly locale: LiveLocale, private readonly from: number) {
        super();
    }

    eq(other: LiveCalloutWidget) {
        return this.source === other.source;
    }

    toDOM(view: EditorView) {
        const aside = document.createElement("aside");
        aside.className = "cm-live-block-widget cm-live-callout-widget";
        aside.dataset.callout = this.callout.type.toLowerCase();
        const title = document.createElement("strong");
        title.textContent = liveCalloutTitle(this.locale, this.callout.type);
        const body = document.createElement("div");
        body.textContent = this.callout.body;
        aside.append(title, body);
        makeLiveProjectionEditable(aside, view, this.from);
        return aside;
    }

    ignoreEvent() {
        return false;
    }
}

function calloutDecorations(state: EditorState, locale: LiveLocale): DecorationSet {
    const widgets: Range<Decoration>[] = [];
        syntaxTree(state).iterate({
            enter(node) {
                if (node.name !== "Blockquote") return;
                const source = state.doc.sliceString(node.from, node.to);
                const callout = parseCallout(source);
                if (!callout) return;
                if (state.selection.ranges.some((range) => range.from <= node.to && range.to >= node.from)) return;
                widgets.push(Decoration.replace({
                    widget: new LiveCalloutWidget(source, callout, locale, node.from),
                }).range(node.from, node.to));
            },
        });
    return Decoration.set(widgets, true);
}

export function liveCalloutWidgets(locale: LiveLocale) {
    return EditorView.decorations.compute(["doc", "selection"], (state) => calloutDecorations(state, locale));
}
