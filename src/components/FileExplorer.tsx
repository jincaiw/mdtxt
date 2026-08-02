import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { attachFocusTrap } from "../utils/focusTrap";
import { getWorkspaceState, rememberWorkspaceRoot, setWorkspaceState } from "../utils/persistence";
import { useLocale } from "../context/LocaleContext";

export type WorkspaceEntryKind = "directory" | "markdown" | "image" | "other";
export interface WorkspaceEntry {
    name: string;
    path: string;
    kind: WorkspaceEntryKind;
    hasChildren: boolean;
    size: number;
    modified: number;
}

export interface WorkspaceMutation {
    path: string;
    previousPath?: string | null;
    trashed?: boolean;
}

interface WorkspaceArticle {
    name: string;
    path: string;
    relativePath: string;
    modified: number;
}

interface FileExplorerProps {
    isOpen: boolean;
    currentFilePath: string | null;
    onFileSelect: (path: string) => void;
    onClose: () => void;
    /** Lets App remap open tabs and persisted recovery metadata after a move. */
    onWorkspaceMutation?: (mutation: WorkspaceMutation) => void;
    viewMode?: "tree" | "articles";
    onViewModeChange?: (mode: "tree" | "articles") => void;
    embedded?: boolean;
}

const parentPath = (path: string | null): string | null => {
    if (!path) return null;
    const normalized = path.replace(/\\/g, "/");
    const index = normalized.lastIndexOf("/");
    return index > 0 ? path.slice(0, index) : null;
};

const nodeIcon = (kind: WorkspaceEntryKind) => kind === "directory" ? "folder" : kind === "markdown" ? "description" : kind === "image" ? "image" : "draft";

/**
 * A lazy tree rather than a recursive eager scan: large Markdown repositories
 * open immediately, while every native operation remains rooted and validated
 * by Rust. React owns only lightweight row metadata, never file contents.
 */
export function FileExplorer({ isOpen, currentFilePath, onFileSelect, onClose, onWorkspaceMutation, viewMode = "tree", onViewModeChange, embedded = false }: FileExplorerProps) {
    const { t } = useLocale();
    const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(() => getWorkspaceState().root);
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set(getWorkspaceState().expandedPaths));
    const [children, setChildren] = useState<Record<string, WorkspaceEntry[]>>({});
    const [loading, setLoading] = useState<Set<string>>(() => new Set());
    const [error, setError] = useState<string | null>(null);
    const [menuPath, setMenuPath] = useState<string | null>(null);
    const [workspaceActionsOpen, setWorkspaceActionsOpen] = useState(false);
    const [filter, setFilter] = useState("");
    const [sortBy, setSortBy] = useState<"name" | "modified">("name");
    const [articles, setArticles] = useState<WorkspaceArticle[]>([]);
    const [articlesLoading, setArticlesLoading] = useState(false);
    const panelRef = useRef<HTMLElement>(null);

    const loadDirectory = useCallback(async (root: string, directory: string, force = false) => {
        if (!force && children[directory]) return;
        setLoading((current) => new Set(current).add(directory));
        setError(null);
        try {
            const entries = await invoke<WorkspaceEntry[]>("list_workspace_entries", { root, directory });
            setChildren((current) => ({ ...current, [directory]: entries }));
        } catch (cause) {
            setError(typeof cause === "string" ? cause : t("Failed to load files"));
        } finally {
            setLoading((current) => {
                const next = new Set(current);
                next.delete(directory);
                return next;
            });
        }
    }, [children, t]);

    const selectRoot = useCallback((root: string) => {
        const saved = rememberWorkspaceRoot(root);
        setWorkspaceRoot(saved.root);
        setExpanded(new Set([root]));
        setChildren({});
        setMenuPath(null);
        void loadDirectory(root, root, true);
    }, [loadDirectory]);

    useEffect(() => {
        if (!isOpen) return;
        if (!workspaceRoot) {
            const fallback = parentPath(currentFilePath);
            if (fallback) selectRoot(fallback);
            return;
        }
        void loadDirectory(workspaceRoot, workspaceRoot);
    }, [currentFilePath, isOpen, loadDirectory, selectRoot, workspaceRoot]);

    useEffect(() => {
        if (!isOpen || embedded) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") { event.preventDefault(); onClose(); }
        };
        document.addEventListener("keydown", onKey);
        panelRef.current?.focus();
        const detach = attachFocusTrap(panelRef.current);
        return () => { document.removeEventListener("keydown", onKey); detach(); };
    }, [embedded, isOpen, onClose]);

    useEffect(() => {
        if (!isOpen || !workspaceRoot) return;
        const refresh = () => void loadDirectory(workspaceRoot, workspaceRoot, true);
        window.addEventListener("focus", refresh);
        return () => window.removeEventListener("focus", refresh);
    }, [isOpen, loadDirectory, workspaceRoot]);

    useEffect(() => {
        if (!isOpen || viewMode !== "articles" || !workspaceRoot) return;
        let cancelled = false;
        setArticlesLoading(true);
        void invoke<WorkspaceArticle[]>("list_workspace_markdown_files", { root: workspaceRoot })
            .then((entries) => { if (!cancelled) setArticles(entries); })
            .catch((cause) => { if (!cancelled) setError(typeof cause === "string" ? cause : t("Failed to load files")); })
            .finally(() => { if (!cancelled) setArticlesLoading(false); });
        return () => { cancelled = true; };
    }, [isOpen, t, viewMode, workspaceRoot]);

    const persistExpanded = useCallback((next: Set<string>) => {
        setExpanded(next);
        const state = getWorkspaceState();
        setWorkspaceState({ ...state, root: workspaceRoot, expandedPaths: Array.from(next) });
    }, [workspaceRoot]);

    const toggleDirectory = useCallback((entry: WorkspaceEntry) => {
        if (!workspaceRoot) return;
        const next = new Set(expanded);
        if (next.has(entry.path)) next.delete(entry.path);
        else {
            next.add(entry.path);
            void loadDirectory(workspaceRoot, entry.path);
        }
        persistExpanded(next);
    }, [expanded, loadDirectory, persistExpanded, workspaceRoot]);

    const refresh = useCallback((directory?: string) => {
        if (workspaceRoot) void loadDirectory(workspaceRoot, directory ?? workspaceRoot, true);
    }, [loadDirectory, workspaceRoot]);

    const createEntry = useCallback(async (kind: "markdown" | "directory") => {
        if (!workspaceRoot) return;
        const name = window.prompt(kind === "markdown" ? "New Markdown file name" : "New folder name");
        if (!name?.trim()) return;
        try {
            const mutation = await invoke<WorkspaceMutation>("create_workspace_entry", { root: workspaceRoot, parent: workspaceRoot, name, kind });
            refresh(workspaceRoot);
            onWorkspaceMutation?.(mutation);
            if (kind === "markdown") onFileSelect(mutation.path);
        } catch (cause) { setError(typeof cause === "string" ? cause : "Could not create workspace entry"); }
    }, [onFileSelect, onWorkspaceMutation, refresh, workspaceRoot]);

    const renameEntry = useCallback(async (entry: WorkspaceEntry) => {
        if (!workspaceRoot) return;
        const name = window.prompt("Rename", entry.name);
        if (!name?.trim() || name === entry.name) return;
        try {
            const mutation = await invoke<WorkspaceMutation>("rename_workspace_entry", { root: workspaceRoot, path: entry.path, name });
            refresh(parentPath(entry.path) ?? workspaceRoot);
            onWorkspaceMutation?.(mutation);
        } catch (cause) { setError(typeof cause === "string" ? cause : "Could not rename workspace entry"); }
    }, [onWorkspaceMutation, refresh, workspaceRoot]);

    const trashEntry = useCallback(async (entry: WorkspaceEntry) => {
        if (!workspaceRoot || !window.confirm(`Move ${entry.name} to the system Trash?`)) return;
        try {
            await invoke("trash_workspace_entry", { root: workspaceRoot, path: entry.path });
            refresh(parentPath(entry.path) ?? workspaceRoot);
            onWorkspaceMutation?.({ path: "", previousPath: entry.path, trashed: true });
        } catch (cause) { setError(typeof cause === "string" ? cause : "Could not move workspace entry to Trash"); }
    }, [onWorkspaceMutation, refresh, workspaceRoot]);

    const moveEntry = useCallback(async (source: WorkspaceEntry, destination: WorkspaceEntry) => {
        if (!workspaceRoot || destination.kind !== "directory" || source.path === destination.path) return;
        try {
            const mutation = await invoke<WorkspaceMutation>("move_workspace_entry", { root: workspaceRoot, path: source.path, destination: destination.path });
            refresh(parentPath(source.path) ?? workspaceRoot);
            refresh(destination.path);
            onWorkspaceMutation?.(mutation);
        } catch (cause) { setError(typeof cause === "string" ? cause : "Could not move workspace entry"); }
    }, [onWorkspaceMutation, refresh, workspaceRoot]);

    const rootName = useMemo(() => workspaceRoot?.replace(/\\/g, "/").split("/").pop() || "Files", [workspaceRoot]);
    const normalizedFilter = filter.trim().toLocaleLowerCase();
    const visibleEntries = useCallback((directory: string) => {
        const entries = children[directory] ?? [];
        return entries
            .filter((entry) => !normalizedFilter || entry.name.toLocaleLowerCase().includes(normalizedFilter) || entry.kind === "directory")
            .slice().sort((left, right) => {
                if (left.kind === "directory" && right.kind !== "directory") return -1;
                if (left.kind !== "directory" && right.kind === "directory") return 1;
                return sortBy === "modified"
                    ? right.modified - left.modified || left.name.localeCompare(right.name)
                    : left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
            });
    }, [children, normalizedFilter, sortBy]);
    const visiblePaths = useMemo(() => {
        if (!workspaceRoot) return [] as string[];
        const paths: string[] = [];
        const visit = (directory: string) => {
            for (const entry of visibleEntries(directory)) {
                paths.push(entry.path);
                if (entry.kind === "directory" && expanded.has(entry.path)) visit(entry.path);
            }
        };
        visit(workspaceRoot);
        return paths;
    }, [expanded, visibleEntries, workspaceRoot]);
    const visibleArticles = useMemo(() => articles
        .filter((entry) => !normalizedFilter || entry.name.toLocaleLowerCase().includes(normalizedFilter) || entry.relativePath.toLocaleLowerCase().includes(normalizedFilter))
        .slice()
        .sort((left, right) => sortBy === "modified"
            ? right.modified - left.modified || left.name.localeCompare(right.name)
            : left.name.localeCompare(right.name, undefined, { sensitivity: "base" })), [articles, normalizedFilter, sortBy]);
    const focusRelativeRow = (path: string, delta: number) => {
        const index = visiblePaths.indexOf(path);
        const next = visiblePaths[Math.max(0, Math.min(visiblePaths.length - 1, index + delta))];
        if (next) panelRef.current?.querySelector<HTMLElement>(`[data-workspace-row="${CSS.escape(next)}"]`)?.focus();
    };
    const renderNode = (entry: WorkspaceEntry, depth: number): React.ReactNode => {
        const open = expanded.has(entry.path);
        const isActive = entry.kind === "markdown" && entry.path === currentFilePath;
        const nodeChildren = visibleEntries(entry.path);
        return (
            <li key={entry.path} role="treeitem" aria-level={depth + 1} aria-expanded={entry.kind === "directory" ? open : undefined} aria-selected={isActive}>
                <div
                    draggable={entry.kind !== "other"}
                    onDragStart={(event) => event.dataTransfer.setData("application/x-mdtxt-workspace-path", entry.path)}
                    onDragOver={(event) => { if (entry.kind === "directory") event.preventDefault(); }}
                    onDrop={(event) => {
                        event.preventDefault();
                        const sourcePath = event.dataTransfer.getData("application/x-mdtxt-workspace-path");
                        const source = Object.values(children).flat().find((candidate) => candidate.path === sourcePath);
                        if (source) void moveEntry(source, entry);
                    }}
                    className={`group flex min-w-0 items-center gap-1 py-0.5 pr-1 ${isActive ? "bg-[var(--accent)] text-[var(--accent-text)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"}`}
                    style={{ paddingLeft: `${8 + depth * 14}px` }}
                >
                    <button
                        type="button"
                        tabIndex={entry.kind === "directory" ? 0 : -1}
                        aria-label={entry.kind === "directory" ? (open ? "Collapse folder" : "Expand folder") : undefined}
                        onClick={() => entry.kind === "directory" && toggleDirectory(entry)}
                        className="flex h-6 w-5 shrink-0 items-center justify-center rounded hover:bg-[var(--bg-hover)]"
                    >
                        {entry.kind === "directory" && <span className="material-symbols-outlined text-[15px]">{open ? "expand_more" : "chevron_right"}</span>}
                    </button>
                    <button
                        type="button"
                        data-workspace-row={entry.path}
                        className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left text-sm"
                        onDoubleClick={() => entry.kind === "markdown" && onFileSelect(entry.path)}
                        onClick={() => entry.kind === "directory" ? toggleDirectory(entry) : entry.kind === "markdown" ? onFileSelect(entry.path) : undefined}
                        onKeyDown={(event) => {
                            if (event.key === "ArrowDown") { event.preventDefault(); focusRelativeRow(entry.path, 1); }
                            else if (event.key === "ArrowUp") { event.preventDefault(); focusRelativeRow(entry.path, -1); }
                            else if (event.key === "ArrowRight" && entry.kind === "directory") { event.preventDefault(); if (!open) toggleDirectory(entry); }
                            else if (event.key === "ArrowLeft" && entry.kind === "directory") { event.preventDefault(); if (open) toggleDirectory(entry); }
                            else if ((event.key === "Enter" || event.key === " ") && entry.kind === "markdown") { event.preventDefault(); onFileSelect(entry.path); }
                        }}
                        title={entry.path}
                    >
                        <span className="material-symbols-outlined text-[16px] shrink-0">{nodeIcon(entry.kind)}</span>
                        <span className="truncate">{entry.name}</span>
                    </button>
                    <button type="button" onClick={() => setMenuPath(menuPath === entry.path ? null : entry.path)} aria-label={t("File actions")} className="invisible group-hover:visible h-6 w-6 shrink-0 rounded hover:bg-[var(--bg-hover)]">
                        <span className="material-symbols-outlined text-[16px]">more_horiz</span>
                    </button>
                </div>
                {menuPath === entry.path && <div className="ml-7 mr-2 flex gap-1 pb-1 text-[11px]">
                    <button onClick={() => void renameEntry(entry)} className="rounded px-1.5 py-0.5 hover:bg-[var(--bg-hover)]">Rename</button>
                    <button onClick={() => void navigator.clipboard.writeText(entry.path)} className="rounded px-1.5 py-0.5 hover:bg-[var(--bg-hover)]">Copy path</button>
                    <button onClick={() => void revealItemInDir(entry.path)} className="rounded px-1.5 py-0.5 hover:bg-[var(--bg-hover)]">Reveal</button>
                    <button onClick={() => void trashEntry(entry)} className="rounded px-1.5 py-0.5 text-[var(--danger)] hover:bg-[var(--bg-hover)]">Trash</button>
                </div>}
                {entry.kind === "directory" && open && <ul role="group">
                    {loading.has(entry.path) ? <li className="py-1 pl-8 text-xs text-[var(--text-muted)]">{t("Loading…")}</li> : nodeChildren.map((child) => renderNode(child, depth + 1))}
                </ul>}
            </li>
        );
    };

    return (
        <aside ref={panelRef} role="navigation" aria-label={t("File explorer")} tabIndex={-1} className={embedded ? "relative h-full w-full bg-[var(--bg-secondary)] flex flex-col overflow-hidden" : `fixed left-0 top-12 bottom-7 w-72 bg-[var(--bg-secondary)] border-r border-[var(--border)] z-50 shadow-2xl flex flex-col overflow-hidden ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>
            <div className="relative flex h-10 shrink-0 items-center gap-1 border-b border-[var(--border)] px-2 bg-[var(--bg-titlebar)]">
                <span className="material-symbols-outlined text-[18px]">folder_open</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={workspaceRoot ?? undefined}>{rootName}</span>
                <button onClick={() => void open({ directory: true, multiple: false }).then((path) => { if (typeof path === "string") selectRoot(path); })} title={t("Open folder")} aria-label={t("Open folder")} className="btn-press h-7 w-7 rounded hover:bg-[var(--bg-hover)]"><span className="material-symbols-outlined text-[17px]">drive_folder_upload</span></button>
                <button onClick={() => void createEntry("markdown")} title={t("New Markdown file")} aria-label={t("New Markdown file")} className="btn-press h-7 w-7 rounded hover:bg-[var(--bg-hover)]"><span className="material-symbols-outlined text-[17px]">note_add</span></button>
                <button
                    type="button"
                    onClick={() => setWorkspaceActionsOpen((open) => !open)}
                    aria-label={t("More workspace actions")}
                    aria-expanded={workspaceActionsOpen}
                    aria-controls="workspace-actions-menu"
                    className="btn-press h-7 w-7 shrink-0 rounded hover:bg-[var(--bg-hover)]"
                >
                    <span className="material-symbols-outlined text-[17px]">more_horiz</span>
                </button>
                {!embedded && <button onClick={onClose} aria-label={t("Close file explorer")} className="btn-press h-7 w-7 rounded hover:bg-[var(--bg-hover)]"><span className="material-symbols-outlined text-[17px]">close</span></button>}
                {workspaceActionsOpen && <div id="workspace-actions-menu" role="menu" className="absolute right-2 top-9 z-40 min-w-36 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] p-1 shadow-lg">
                    <button type="button" role="menuitem" onClick={() => { setWorkspaceActionsOpen(false); void createEntry("directory"); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-[var(--bg-hover)]">
                        <span className="material-symbols-outlined text-[16px]">create_new_folder</span>{t("New folder")}
                    </button>
                    <button type="button" role="menuitem" onClick={() => { setWorkspaceActionsOpen(false); refresh(); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-[var(--bg-hover)]">
                        <span className="material-symbols-outlined text-[16px]">refresh</span>{t("Refresh")}
                    </button>
                </div>}
            </div>
            {workspaceRoot && <div className="flex gap-1 border-b border-[var(--border)] p-2">
                <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={t("Filter files…")} aria-label={t("Filter files")} className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--bg-input)] px-2 py-1 text-xs outline-none focus:border-[var(--accent)]" />
                <button type="button" onClick={() => onViewModeChange?.(viewMode === "tree" ? "articles" : "tree")} aria-label={t(viewMode === "tree" ? "Show articles" : "Show file tree")} title={t(viewMode === "tree" ? "Articles" : "File tree")} className="btn-press h-7 w-7 rounded hover:bg-[var(--bg-hover)]"><span className="material-symbols-outlined text-[16px]">{viewMode === "tree" ? "view_list" : "account_tree"}</span></button>
                <button type="button" onClick={() => setSortBy((current) => current === "name" ? "modified" : "name")} aria-label={t("Sort files")} title={t(sortBy === "name" ? "Sort by modified" : "Sort by name")} className="btn-press h-7 w-7 rounded hover:bg-[var(--bg-hover)]"><span className="material-symbols-outlined text-[16px]">{sortBy === "name" ? "sort_by_alpha" : "schedule"}</span></button>
            </div>}
            <div className="min-h-0 flex-1 overflow-auto">
                {error && <div role="alert" className="m-2 rounded border border-[var(--danger)]/30 p-2 text-xs text-[var(--danger)]">{error}</div>}
                {!workspaceRoot ? <div className="p-4 text-sm text-[var(--text-secondary)]">{t("Open a folder to manage a Markdown workspace.")}</div> : viewMode === "articles" ? (
                    articlesLoading ? <div className="p-3 text-sm text-[var(--text-secondary)]">{t("Loading...")}</div> :
                    <ul aria-label={t("Articles")} className="py-1">
                        {visibleArticles.map((entry) => <li key={entry.path}>
                            <button type="button" onClick={() => onFileSelect(entry.path)} aria-current={entry.path === currentFilePath ? "page" : undefined} title={entry.path} className={`flex w-full min-w-0 items-start gap-2 px-3 py-2 text-left ${entry.path === currentFilePath ? "bg-[var(--accent)] text-[var(--accent-text)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"}`}>
                                <span className="material-symbols-outlined mt-0.5 text-[16px] shrink-0">description</span>
                                <span className="min-w-0"><span className="block truncate text-sm font-medium">{entry.name}</span><span className="block truncate text-[11px] opacity-65">{entry.relativePath}</span></span>
                            </button>
                        </li>)}
                    </ul>
                ) : <ul role="tree" aria-label={t("Files and folders")} className="py-1">
                    {loading.has(workspaceRoot) ? <li className="p-3 text-sm text-[var(--text-secondary)]">{t("Loading...")}</li> : visibleEntries(workspaceRoot).map((entry) => renderNode(entry, 0))}
                </ul>}
            </div>
        </aside>
    );
}
