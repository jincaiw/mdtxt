import { syntaxTree } from "@codemirror/language";
import type { Range } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { getCachedLocalImageUrl, isUnsafeRelativeImagePath, markdownBaseDir } from "../../utils/localImage";
import { liveText, type LiveLocale } from "./liveLocale";

class LiveImageWidget extends WidgetType {
    private destroyed = false;

    constructor(
        private readonly source: string,
        private readonly alt: string,
        private readonly path: string,
        private readonly baseDir: string | null,
        private readonly locale: LiveLocale,
    ) {
        super();
    }

    eq(other: LiveImageWidget) {
        return this.source === other.source && this.baseDir === other.baseDir;
    }

    toDOM() {
        const figure = document.createElement("figure");
        figure.className = "cm-live-block-widget cm-live-image-widget";
        figure.dataset.source = this.source;
        const image = document.createElement("img");
        image.alt = this.alt;
        image.loading = "lazy";
        const status = document.createElement("figcaption");
        status.textContent = this.alt || this.path;
        figure.append(image, status);
        void this.load(image, status);
        return figure;
    }

    ignoreEvent() {
        return true;
    }

    destroy() {
        this.destroyed = true;
    }

    private async load(image: HTMLImageElement, status: HTMLElement) {
        try {
            if (this.path.startsWith("data:")) {
                image.src = this.path;
            } else {
                const cleanPath = this.path.startsWith("./") ? this.path.slice(2) : this.path;
                if (!this.baseDir || isUnsafeRelativeImagePath(cleanPath) || this.path.includes("://")) {
                    throw new Error("Live image preview requires a safe local relative path");
                }
                const url = await getCachedLocalImageUrl(this.baseDir, cleanPath);
                if (this.destroyed || !image.isConnected) return;
                image.src = url;
            }
            if (!this.destroyed) status.hidden = true;
        } catch {
            if (!this.destroyed) {
                figureError(image, status, this.path, this.locale);
            }
        }
    }
}

function figureError(image: HTMLImageElement, status: HTMLElement, path: string, locale: LiveLocale) {
    image.removeAttribute("src");
    image.hidden = true;
    status.hidden = false;
    status.textContent = `${liveText(locale, "图片预览不可用", "Image preview unavailable")} · ${path}`;
    status.setAttribute("role", "status");
}

function selectionTouches(view: EditorView, from: number, to: number): boolean {
    return view.compositionStarted || view.state.selection.ranges.some((range) => range.from <= to && range.to >= from);
}

function imageDecorations(view: EditorView, filePath: string | null, locale: LiveLocale): DecorationSet {
    const widgets: Range<Decoration>[] = [];
    const baseDir = markdownBaseDir(filePath);
    for (const visible of view.visibleRanges) {
        syntaxTree(view.state).iterate({
            from: visible.from,
            to: visible.to,
            enter(node) {
                if (node.name !== "Image" || selectionTouches(view, node.from, node.to)) return;
                const url = node.node.getChild("URL");
                if (!url) return;
                const source = view.state.doc.sliceString(node.from, node.to);
                const path = view.state.doc.sliceString(url.from, url.to);
                const altEnd = source.indexOf("]");
                const alt = altEnd >= 2 ? source.slice(2, altEnd) : "";
                const lineEnd = view.state.doc.lineAt(node.to).to;
                widgets.push(Decoration.widget({
                    widget: new LiveImageWidget(source, alt, path, baseDir, locale),
                    side: 1,
                }).range(lineEnd));
            },
        });
    }
    return Decoration.set(widgets, true);
}

export function liveImageWidgets(filePath: string | null, locale: LiveLocale) {
    return ViewPlugin.fromClass(class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = imageDecorations(view, filePath, locale);
        }

        update(update: ViewUpdate) {
            if (update.docChanged || update.selectionSet || update.viewportChanged || update.focusChanged) {
                this.decorations = imageDecorations(update.view, filePath, locale);
            }
        }
    }, { decorations: (plugin) => plugin.decorations });
}
