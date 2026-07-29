import type { EditorState, Range } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { parseFrontmatter, type FrontmatterValue } from "../../utils/frontmatter";
import { liveText, type LiveLocale } from "./liveLocale";
import { makeLiveProjectionEditable } from "./liveBlockProjection";

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
        private readonly from: number,
    ) {
        super();
    }

    eq(other: LiveFrontmatterWidget) {
        return this.source === other.source;
    }

    toDOM(view: EditorView) {
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
        makeLiveProjectionEditable(section, view, this.from);
        return section;
    }

    ignoreEvent() {
        return false;
    }
}

function frontmatterRange(state: EditorState): { from: number; to: number; source: string } | null {
    if (state.doc.lines < 2 || state.doc.line(1).text.trim() !== "---") return null;
    const limit = Math.min(state.doc.lines, MAX_FRONTMATTER_LINES);
    for (let lineNumber = 2; lineNumber <= limit; lineNumber += 1) {
        const line = state.doc.line(lineNumber);
        if (line.text.trim() === "---") {
            return { from: 0, to: line.to, source: state.doc.sliceString(0, line.to) };
        }
    }
    return null;
}

function frontmatterDecorations(state: EditorState, locale: LiveLocale): DecorationSet {
    const block = frontmatterRange(state);
    if (!block) return Decoration.none;
    if (state.selection.ranges.some((range) => range.from <= block.to && range.to >= block.from)) return Decoration.none;
    const parsed = parseFrontmatter(`${block.source}\n`);
    const entries = Object.entries(parsed.data);
    const widgets: Range<Decoration>[] = [Decoration.replace({
        widget: new LiveFrontmatterWidget(block.source, entries, locale, block.from),
    }).range(block.from, block.to)];
    return Decoration.set(widgets, true);
}

export function liveFrontmatterWidgets(locale: LiveLocale) {
    return EditorView.decorations.compute(["doc", "selection"], (state) => frontmatterDecorations(state, locale));
}
