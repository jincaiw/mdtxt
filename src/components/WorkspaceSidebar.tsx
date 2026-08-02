import { FileExplorer, type WorkspaceMutation } from "./FileExplorer";
import { TableOfContents } from "./TableOfContents";
import { PanelResizeHandle } from "./PanelResizeHandle";
import { useLocale } from "../context/LocaleContext";

export type NavigationTab = "files" | "outline";

interface WorkspaceSidebarProps {
    isOpen: boolean;
    tab: NavigationTab;
    width: number;
    currentFilePath: string | null;
    content: string;
    activeLine: number;
    onTabChange: (tab: NavigationTab) => void;
    onFileSelect: (path: string) => void;
    onWorkspaceMutation?: (mutation: WorkspaceMutation) => void;
    fileViewMode: "tree" | "articles";
    onFileViewModeChange: (mode: "tree" | "articles") => void;
    onClose: () => void;
    onWidthChange: (width: number) => void;
}

export function WorkspaceSidebar({
    isOpen, tab, width, currentFilePath, content, activeLine,
    onTabChange, onFileSelect, onWorkspaceMutation, fileViewMode, onFileViewModeChange, onClose, onWidthChange,
}: WorkspaceSidebarProps) {
    const { t } = useLocale();
    if (!isOpen) return null;

    return (
        <aside
            className="workspace-navigation"
            style={{ "--workspace-navigation-width": `${width}px` } as React.CSSProperties}
            aria-label={t("Navigation sidebar")}
        >
            <div className="workspace-navigation-tabs" role="tablist" aria-label={t("Navigation sidebar")}> 
                {(["files", "outline"] as const).map((id) => (
                    <button
                        key={id}
                        role="tab"
                        aria-selected={tab === id}
                        onClick={() => onTabChange(id)}
                        className={tab === id ? "active" : ""}
                    >
                        <span className="material-symbols-outlined" aria-hidden="true">{id === "files" ? "folder_open" : "format_list_bulleted"}</span>
                        {t(id === "files" ? "Files" : "Outline")}
                    </button>
                ))}
                <button className="workspace-navigation-close" onClick={onClose} aria-label={t("Close navigation sidebar")} title={t("Close")}>
                    <span className="material-symbols-outlined" aria-hidden="true">close</span>
                </button>
            </div>
            <div className="workspace-navigation-content">
                {tab === "files" ? (
                    <FileExplorer isOpen currentFilePath={currentFilePath} onFileSelect={onFileSelect} onWorkspaceMutation={onWorkspaceMutation} viewMode={fileViewMode} onViewModeChange={onFileViewModeChange} onClose={onClose} embedded />
                ) : (
                    <TableOfContents isOpen content={content} activeLine={activeLine} onClose={onClose} embedded />
                )}
            </div>
            <PanelResizeHandle side="left" value={width} min={220} max={360} onChange={onWidthChange} />
        </aside>
    );
}
