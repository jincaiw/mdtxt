import { syntaxTree } from "@codemirror/language";
import type { Range } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { liveCalloutTitle, type LiveLocale } from "./liveLocale";

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
    constructor(private readonly source: string, private readonly callout: Callout, private readonly locale: LiveLocale) {
        super();
    }

    eq(other: LiveCalloutWidget) {
        return this.source === other.source;
    }

    toDOM() {
        const aside = document.createElement("aside");
        aside.className = "cm-live-block-widget cm-live-callout-widget";
        aside.dataset.callout = this.callout.type.toLowerCase();
        const title = document.createElement("strong");
        title.textContent = liveCalloutTitle(this.locale, this.callout.type);
        const body = document.createElement("div");
        body.textContent = this.callout.body;
        aside.append(title, body);
        return aside;
    }

    ignoreEvent() {
        return true;
    }
}

function calloutDecorations(view: EditorView, locale: LiveLocale): DecorationSet {
    const widgets: Range<Decoration>[] = [];
    for (const visible of view.visibleRanges) {
        syntaxTree(view.state).iterate({
            from: visible.from,
            to: visible.to,
            enter(node) {
                if (node.name !== "Blockquote") return;
                const source = view.state.doc.sliceString(node.from, node.to);
                const callout = parseCallout(source);
                if (!callout) return;
                if (view.compositionStarted || view.state.selection.ranges.some((range) => range.from <= node.to && range.to >= node.from)) return;
                widgets.push(Decoration.widget({
                    widget: new LiveCalloutWidget(source, callout, locale),
                    side: 1,
                }).range(view.state.doc.lineAt(node.to).to));
            },
        });
    }
    return Decoration.set(widgets, true);
}

export function liveCalloutWidgets(locale: LiveLocale) {
    return ViewPlugin.fromClass(class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = calloutDecorations(view, locale);
        }

        update(update: ViewUpdate) {
            if (update.docChanged || update.selectionSet || update.viewportChanged || update.focusChanged) {
                this.decorations = calloutDecorations(update.view, locale);
            }
        }
    }, { decorations: (plugin) => plugin.decorations });
}
