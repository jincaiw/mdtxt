import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, TauriEvent } from "@tauri-apps/api/event";
import { clearRecentFiles, getRecentFiles, removeRecentFile, type RecentFile } from "../utils/persistence";
import { useLocale } from "../context/LocaleContext";

interface WelcomeScreenProps {
    onOpenFile: () => void;
    onNewFile?: () => void;
    onOpenSettings?: () => void;
    onFileDrop: (path: string) => void;
    onOpenRecent?: (path: string) => void;
}

const formatRelative = (ts: number, locale: string): string => {
    const diff = Date.now() - ts;
    const min = 60_000, hr = 60 * min, day = 24 * hr;
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "narrow" });
    if (diff < min) return formatter.format(0, "minute");
    if (diff < hr) return formatter.format(-Math.floor(diff / min), "minute");
    if (diff < day) return formatter.format(-Math.floor(diff / hr), "hour");
    if (diff < 7 * day) return formatter.format(-Math.floor(diff / day), "day");
    return new Date(ts).toLocaleDateString(locale);
};

const parentFolderOf = (path: string): string => {
    const norm = path.replace(/\\/g, "/");
    const segs = norm.split("/").slice(0, -1);
    return segs.slice(-2).join("/") || segs.join("/");
};

export function WelcomeScreen({ onOpenFile, onNewFile, onFileDrop, onOpenRecent }: WelcomeScreenProps) {
    const { locale, t } = useLocale();
    const [recents, setRecents] = useState<RecentFile[]>([]);
    const [missing, setMissing] = useState<Set<string>>(new Set());
    // Highlight while a markdown file is dragged over the welcome screen so
    // the user gets immediate visual confirmation that the drop will be
    // handled. Reset on drop / dragleave.
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        const list = getRecentFiles();
        setRecents(list);
        // Quick existence check for each — gray out missing entries
        let cancelled = false;
        Promise.all(
            list.map(async (f) => {
                try {
                    await invoke("get_file_info", { path: f.path });
                    return null;
                } catch {
                    return f.path;
                }
            })
        ).then((results) => {
            if (cancelled) return;
            setMissing(new Set(results.filter((p): p is string => !!p)));
        });
        return () => { cancelled = true; };
    }, []);

    // Drag highlight via the NATIVE Tauri drag events. With Tauri's drag-drop
    // handling enabled, the webview never receives HTML5 drag events on
    // Windows — so the dashed-outline feedback below only worked in browser
    // dev mode. These listeners light it up in the real app too; the HTML5
    // handlers stay as the browser-dev fallback.
    useEffect(() => {
        let mounted = true;
        let unlistens: Array<() => void> = [];
        Promise.all([
            listen(TauriEvent.DRAG_ENTER, () => setIsDragging(true)),
            listen(TauriEvent.DRAG_LEAVE, () => setIsDragging(false)),
            listen(TauriEvent.DRAG_DROP, () => setIsDragging(false)),
        ]).then((fns) => {
            if (mounted) unlistens = fns;
            else fns.forEach((f) => f());
        }).catch(() => {/* browser dev mode — HTML5 handlers cover it */});
        return () => {
            mounted = false;
            unlistens.forEach((f) => f());
        };
    }, []);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDragging) setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Only reset when the drag leaves the outer container, not when it
        // crosses into a child element.
        if (e.currentTarget === e.target) setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            // @ts-expect-error - Tauri adds path to File objects
            const path = file.path || file.name;
            if (path.endsWith('.md') || path.endsWith('.markdown')) {
                onFileDrop(path);
            }
        }
    };

    const handleRemoveRecent = (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        e.preventDefault();
        setRecents(removeRecentFile(path));
    };

    const handleClearAll = () => {
        clearRecentFiles();
        setRecents([]);
        setMissing(new Set());
    };

    return (
        <main
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            // `justify-start` (not `justify-center`) plus generous vertical
            // padding keeps the logo anchored at the top of the visible area
            // when the Recents list grows tall enough for the page to scroll.
            // With `justify-center` + `overflow-y-auto` the centered content
            // can be taller than the viewport, which causes flexbox to push
            // the top edge (the logo) above the scrollable area — invisible
            // unless the user scrolls up.
            className={`flex-1 flex flex-col items-center justify-start py-8 px-6 no-select overflow-y-auto transition-colors ${isDragging ? "bg-[var(--bg-hover)] outline outline-2 outline-dashed outline-[var(--accent)] -outline-offset-8" : ""}`}
            aria-dropeffect="copy"
        >
            <div className="flex w-full max-w-[360px] flex-col items-center text-center animate-fade-in-up">
                <div className="flex flex-col items-center">
                    <h1 className="font-serif text-[42px] font-normal leading-none tracking-[-0.03em] text-[var(--accent)]">
                        mdtxt
                    </h1>
                    <span className="mt-2 text-[11px] tabular-nums text-[var(--text-muted)]">0.1.0</span>
                    <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
                        {t("Focused Markdown writing")}
                    </p>
                </div>

                <div className="mt-7 flex w-[240px] flex-col gap-2">
                    <button
                        onClick={onOpenFile}
                        className="btn-press flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[var(--accent)] px-5 text-[13px] font-medium text-[var(--accent-text)] transition-all duration-200 hover:opacity-90"
                    >
                        <span className="material-symbols-outlined text-[17px]">folder_open</span>
                        <span>{t("Open File")}</span>
                    </button>
                    {onNewFile && (
                        <button
                            onClick={onNewFile}
                            className="btn-press flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-primary)] px-5 text-[13px] font-medium text-[var(--text-primary)] transition-all duration-200 hover:bg-[var(--bg-hover)]"
                        >
                            <span className="material-symbols-outlined text-[17px]">edit_note</span>
                            <span>{t("New File")}</span>
                        </button>
                    )}
                </div>

                {recents.length > 0 && onOpenRecent && (
                    <section className="mt-7 w-full text-left" aria-label={t("Recent files")}>
                        <div className="mb-2 flex items-center justify-between px-1">
                            <div className="text-[11px] font-medium text-[var(--text-secondary)]">
                                {t("Recent")}
                            </div>
                            <button
                                onClick={handleClearAll}
                                aria-label={t("Clear all recent files")}
                                title={t("Clear all recents")}
                                className="rounded px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] transition-colors hover:text-[var(--danger)]"
                            >
                                {t("More")} ›
                            </button>
                        </div>
                        <ul className="flex flex-col overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-primary)]">
                            {recents.slice(0, 5).map((f) => {
                                const isMissing = missing.has(f.path);
                                return (
                                <li key={f.path} className="group relative border-b border-[var(--border-subtle)] last:border-b-0">
                                    {/* Two siblings instead of nested buttons:
                                        the previous form had a `<span
                                        role="button">` inside a `<button>`,
                                        which is invalid HTML — depending on
                                        browser, the click could bubble to
                                        the outer button and re-open the file
                                        right after the user removed it. */}
                                    <button
                                        onClick={() => !isMissing && onOpenRecent(f.path)}
                                        disabled={isMissing}
                                        className={`btn-press flex h-9 w-full items-center gap-2 px-2.5 pr-9 text-left transition-colors ${isMissing ? "cursor-not-allowed opacity-50" : "hover:bg-[var(--bg-hover)]"}`}
                                        title={isMissing ? `${f.path} (${t("missing")})` : f.path}
                                    >
                                        <span className="material-symbols-outlined shrink-0 text-[15px] text-[var(--text-secondary)]">
                                            {isMissing ? "broken_image" : "description"}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className={`truncate text-[11px] ${isMissing ? "line-through text-[var(--text-muted)]" : "text-[var(--text-primary)]"}`}>{f.name}</div>
                                            <div className="sr-only">{parentFolderOf(f.path)}</div>
                                        </div>
                                        <span className="text-[11px] text-[var(--text-muted)] tabular-nums shrink-0">{isMissing ? t("missing") : formatRelative(f.openedAt, locale)}</span>
                                    </button>
                                    <button
                                        type="button"
                                        aria-label={`Remove ${f.name} from recents`}
                                        title={t("Remove from recents")}
                                        onClick={(e) => handleRemoveRecent(e, f.path)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 w-6 h-6 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--danger)] transition-opacity flex items-center justify-center"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                    </button>
                                </li>
                                );
                            })}
                        </ul>
                    </section>
                )}

                <div className="mt-7 flex min-h-16 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] text-[11px] text-[var(--text-muted)]">
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">description</span>
                    <span className="flex flex-col items-start gap-0.5">
                        <span className="text-[var(--text-secondary)]">{t("Drop files here to open")}</span>
                        <span className="text-[10px]">{t("Supports .md, .txt, and .markdown")}</span>
                    </span>
                </div>
            </div>
        </main>
    );
}
