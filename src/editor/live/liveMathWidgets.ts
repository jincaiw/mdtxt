import type { Range } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { liveText, type LiveLocale } from "./liveLocale";

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

    constructor(private readonly source: string, private readonly locale: LiveLocale) {
        super();
    }

    eq(other: LiveMathWidget) {
        return this.source === other.source;
    }

    toDOM() {
        const section = document.createElement("section");
        section.className = "cm-live-block-widget cm-live-math-widget";
        section.textContent = liveText(this.locale, "正在渲染公式…", "Rendering math…");
        void renderMath(this.source)
            .then((html) => {
                if (!this.destroyed && section.isConnected) section.innerHTML = html;
            })
            .catch(() => {
                if (!this.destroyed) section.textContent = liveText(
                    this.locale,
                    "公式预览不可用，请编辑上方源文本。",
                    "Math preview unavailable; edit the source above.",
                );
            });
        return section;
    }

    ignoreEvent() {
        return true;
    }

    destroy() {
        this.destroyed = true;
    }
}

interface MathBlock { from: number; to: number; expression: string }

function visibleMathBlocks(view: EditorView): MathBlock[] {
    const blocks: MathBlock[] = [];
    const seen = new Set<number>();
    for (const visible of view.visibleRanges) {
        const first = view.state.doc.lineAt(visible.from).number;
        const last = view.state.doc.lineAt(visible.to).number;
        for (let lineNumber = first; lineNumber <= last; lineNumber += 1) {
            const opening = view.state.doc.line(lineNumber);
            if (seen.has(opening.from) || opening.text.trim() !== "$$") continue;
            const limit = Math.min(view.state.doc.lines, lineNumber + MAX_MATH_LINES);
            for (let closingNumber = lineNumber + 1; closingNumber <= limit; closingNumber += 1) {
                const closing = view.state.doc.line(closingNumber);
                if (closing.text.trim() !== "$$") continue;
                seen.add(opening.from);
                blocks.push({
                    from: opening.from,
                    to: closing.to,
                    expression: view.state.doc.sliceString(opening.to + 1, closing.from).trim(),
                });
                lineNumber = closingNumber;
                break;
            }
        }
    }
    return blocks;
}

function mathDecorations(view: EditorView, locale: LiveLocale): DecorationSet {
    if (view.compositionStarted) return Decoration.none;
    const widgets: Range<Decoration>[] = [];
    for (const block of visibleMathBlocks(view)) {
        if (view.state.selection.ranges.some((range) => range.from <= block.to && range.to >= block.from)) continue;
        widgets.push(Decoration.widget({ widget: new LiveMathWidget(block.expression, locale), side: 1 }).range(block.to));
    }
    return Decoration.set(widgets, true);
}

export function liveMathWidgets(locale: LiveLocale) {
    return ViewPlugin.fromClass(class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = mathDecorations(view, locale);
        }

        update(update: ViewUpdate) {
            if (update.docChanged || update.selectionSet || update.viewportChanged || update.focusChanged) {
                this.decorations = mathDecorations(update.view, locale);
            }
        }
    }, { decorations: (plugin) => plugin.decorations });
}
