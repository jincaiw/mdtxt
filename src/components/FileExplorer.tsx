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

interface FileExplorerProps {
    isOpen: boolean;
    currentFilePath: string | null;
    onFileSelect: (path: string) => void;
    onClose: () => void;
    /** Lets App remap open tabs and persisted recovery metadata after a move. */
    onWorkspaceMutation?: (mutation: WorkspaceMutation) => void;
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
export function FileExplorer({ isOpen, currentFilePath, onFileSelect, onClose, onWorkspaceMutation, embedded = false }: FileExplorerProps) {
    const { t } = useLocale();
    const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(() => getWorkspaceState().root);
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set(getWorkspaceState().expandedPaths));
    const [children, setChildren] = useState<Record<string, WorkspaceEntry[]>>({});
    const [loading, setLoading] = useState<Set<string>>(() => new Set());
    const [error, setError] = useState<string | null>(null);
    const [menuPath, setMenuPath] = useState<string | null>(null);
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
    const renderNode = (entry: WorkspaceEntry, depth: number): React.ReactNode => {
        const open = expanded.has(entry.path);
        const isActive = entry.kind === "markdown" && entry.path === currentFilePath;
        const nodeChildren = children[entry.path] ?? [];
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
                        className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left text-sm"
                        onDoubleClick={() => entry.kind === "markdown" && onFileSelect(entry.path)}
                        onClick={() => entry.kind === "directory" ? toggleDirectory(entry) : entry.kind === "markdown" ? onFileSelect(entry.path) : undefined}
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
            <div className="flex h-10 shrink-0 items-center gap-1 border-b border-[var(--border)] px-2 bg-[var(--bg-titlebar)]">
                <span className="material-symbols-outlined text-[18px]">folder_open</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={workspaceRoot ?? undefined}>{rootName}</span>
                <button onClick={() => void open({ directory: true, multiple: false }).then((path) => { if (typeof path === "string") selectRoot(path); })} title={t("Open folder")} aria-label={t("Open folder")} className="btn-press h-7 w-7 rounded hover:bg-[var(--bg-hover)]"><span className="material-symbols-outlined text-[17px]">drive_folder_upload</span></button>
                <button onClick={() => void createEntry("markdown")} title={t("New Markdown file")} aria-label={t("New Markdown file")} className="btn-press h-7 w-7 rounded hover:bg-[var(--bg-hover)]"><span className="material-symbols-outlined text-[17px]">note_add</span></button>
                <button onClick={() => void createEntry("directory")} title={t("New folder")} aria-label={t("New folder")} className="btn-press h-7 w-7 rounded hover:bg-[var(--bg-hover)]"><span className="material-symbols-outlined text-[17px]">create_new_folder</span></button>
                <button onClick={() => refresh()} title={t("Refresh")} aria-label={t("Refresh file list")} className="btn-press h-7 w-7 rounded hover:bg-[var(--bg-hover)]"><span className="material-symbols-outlined text-[17px]">refresh</span></button>
                {!embedded && <button onClick={onClose} aria-label={t("Close file explorer")} className="btn-press h-7 w-7 rounded hover:bg-[var(--bg-hover)]"><span className="material-symbols-outlined text-[17px]">close</span></button>}
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
                {error && <div role="alert" className="m-2 rounded border border-[var(--danger)]/30 p-2 text-xs text-[var(--danger)]">{error}</div>}
                {!workspaceRoot ? <div className="p-4 text-sm text-[var(--text-secondary)]">{t("Open a folder to manage a Markdown workspace.")}</div> : <ul role="tree" aria-label={t("Files and folders")} className="py-1">
                    {loading.has(workspaceRoot) ? <li className="p-3 text-sm text-[var(--text-secondary)]">{t("Loading...")}</li> : (children[workspaceRoot] ?? []).map((entry) => renderNode(entry, 0))}
                </ul>}
            </div>
        </aside>
    );
}
