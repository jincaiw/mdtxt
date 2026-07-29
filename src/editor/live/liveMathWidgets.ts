import type { EditorState, Range } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { liveText, type LiveLocale } from "./liveLocale";
import { makeLiveProjectionEditable, revealLiveSource } from "./liveBlockProjection";

const MAX_MATH_LINES = 100;
const mathCache = new Map<string, string>();
const MATH_CACHE_CAP = 64;

async function renderMath(source: string): Promise<string> {
    const cached = mathCache.get(source);
    if (cached !== undefined) {
        mathCache.delete(source);
        mathCache.set(source, cached);
        return cached;
    }
    const [, katex] = await Promise.all([import("katex/dist/katex.min.css"), import("katex")]);
    const html = katex.default.renderToString(source, {
        displayMode: true,
        throwOnError: false,
        strict: "error",
        trust: false,
    });
    mathCache.set(source, html);
    if (mathCache.size > MATH_CACHE_CAP) {
        const oldest = mathCache.keys().next().value;
        if (oldest !== undefined) mathCache.delete(oldest);
    }
    return html;
}

class LiveMathWidget extends WidgetType {
    private destroyed = false;

    constructor(private readonly source: string, private readonly locale: LiveLocale, private readonly from: number) {
        super();
    }

    eq(other: LiveMathWidget) {
        return this.source === other.source;
    }

    toDOM(view: EditorView) {
        const section = document.createElement("section");
        section.className = "cm-live-block-widget cm-live-math-widget";
        section.textContent = liveText(this.locale, "正在渲染公式…", "Rendering math…");
        makeLiveProjectionEditable(section, view, this.from);
        void renderMath(this.source)
            .then((html) => {
                if (!this.destroyed && section.isConnected) section.innerHTML = html;
            })
            .catch(() => {
                if (!this.destroyed) revealLiveSource(view, this.from);
            });
        return section;
    }

    ignoreEvent() {
        return false;
    }

    destroy() {
        this.destroyed = true;
    }
}

interface MathBlock { from: number; to: number; expression: string }

function mathBlocks(state: EditorState): MathBlock[] {
    const blocks: MathBlock[] = [];
    const seen = new Set<number>();
        for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
            const opening = state.doc.line(lineNumber);
            if (seen.has(opening.from) || opening.text.trim() !== "$$") continue;
            const limit = Math.min(state.doc.lines, lineNumber + MAX_MATH_LINES);
            for (let closingNumber = lineNumber + 1; closingNumber <= limit; closingNumber += 1) {
                const closing = state.doc.line(closingNumber);
                if (closing.text.trim() !== "$$") continue;
                seen.add(opening.from);
                blocks.push({
                    from: opening.from,
                    to: closing.to,
                    expression: state.doc.sliceString(opening.to + 1, closing.from).trim(),
                });
                lineNumber = closingNumber;
                break;
            }
        }
    return blocks;
}

function mathDecorations(state: EditorState, locale: LiveLocale): DecorationSet {
    const widgets: Range<Decoration>[] = [];
    for (const block of mathBlocks(state)) {
        if (state.selection.ranges.some((range) => range.from <= block.to && range.to >= block.from)) continue;
        widgets.push(Decoration.replace({ widget: new LiveMathWidget(block.expression, locale, block.from) }).range(block.from, block.to));
    }
    return Decoration.set(widgets, true);
}

export function liveMathWidgets(locale: LiveLocale) {
    return EditorView.decorations.compute(["doc", "selection"], (state) => mathDecorations(state, locale));
}
