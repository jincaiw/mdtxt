import type { Range } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { parseFrontmatter, type FrontmatterValue } from "../../utils/frontmatter";
import { liveText, type LiveLocale } from "./liveLocale";

const MAX_FRONTMATTER_LINES = 200;

function displayValue(value: FrontmatterValue): string {
    if (Array.isArray(value)) return value.join(", ");
    return String(value);
}

class LiveFrontmatterWidget extends WidgetType {
    constructor(
        private readonly source: string,
        private readonly entries: Array<[string, FrontmatterValue]>,
        private readonly locale: LiveLocale,
    ) {
        super();
    }

    eq(other: LiveFrontmatterWidget) {
        return this.source === other.source;
    }

    toDOM() {
        const section = document.createElement("section");
        section.className = "cm-live-block-widget cm-live-frontmatter-widget";
        const title = document.createElement("strong");
        title.textContent = liveText(this.locale, "文档元数据", "Frontmatter");
        const list = document.createElement("dl");
        for (const [key, value] of this.entries) {
            const term = document.createElement("dt");
            term.textContent = key;
            const description = document.createElement("dd");
            description.textContent = displayValue(value);
            list.append(term, description);
        }
        section.append(title, list);
        return section;
    }

    ignoreEvent() {
        return true;
    }
}

function frontmatterRange(view: EditorView): { from: number; to: number; source: string } | null {
    if (view.state.doc.lines < 2 || view.state.doc.line(1).text.trim() !== "---") return null;
    const limit = Math.min(view.state.doc.lines, MAX_FRONTMATTER_LINES);
    for (let lineNumber = 2; lineNumber <= limit; lineNumber += 1) {
        const line = view.state.doc.line(lineNumber);
        if (line.text.trim() === "---") {
            return { from: 0, to: line.to, source: view.state.doc.sliceString(0, line.to) };
        }
    }
    return null;
}

function frontmatterDecorations(view: EditorView, locale: LiveLocale): DecorationSet {
    const block = frontmatterRange(view);
    if (!block || view.compositionStarted) return Decoration.none;
    if (!view.visibleRanges.some((range) => range.from <= block.to && range.to >= block.from)) return Decoration.none;
    if (view.state.selection.ranges.some((range) => range.from <= block.to && range.to >= block.from)) return Decoration.none;
    const parsed = parseFrontmatter(`${block.source}\n`);
    const entries = Object.entries(parsed.data);
    const widgets: Range<Decoration>[] = [Decoration.widget({
        widget: new LiveFrontmatterWidget(block.source, entries, locale),
        side: 1,
    }).range(block.to)];
    return Decoration.set(widgets, true);
}

export function liveFrontmatterWidgets(locale: LiveLocale) {
    return ViewPlugin.fromClass(class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = frontmatterDecorations(view, locale);
        }

        update(update: ViewUpdate) {
            if (update.docChanged || update.selectionSet || update.viewportChanged || update.focusChanged) {
                this.decorations = frontmatterDecorations(update.view, locale);
            }
        }
    }, { decorations: (plugin) => plugin.decorations });
}
