import { memo } from "react";
import type { MouseEvent } from "react";
import { Window } from "@tauri-apps/api/window";
import { SettingsMenu } from "./SettingsMenu";
import { ExportMenu } from "./ExportMenu";
import { ModeToggle, type ViewMode } from "./ModeToggle";
import { useLocale } from "../context/LocaleContext";
import { getDesktopPlatform } from "../utils/desktopPlatform";

interface TitleBarProps {
    fileName?: string;
    isDirty?: boolean;
    filePath?: string;
    onOpenFile?: () => void;
    onNewFile?: () => void;
    getExportHtml?: () => string;
    onExportSuccess?: (format: string) => void;
    onExportError?: (format: string) => void;
    onToggleAI?: () => void;
    aiActive?: boolean;
    /** macOS hides traffic lights while in native fullscreen, so release the
     * overlay safe area instead of leaving an empty gutter. */
    isNativeFullscreen?: boolean;
    mode?: ViewMode;
    onSetMode?: (mode: ViewMode) => void;
    liveEnabled?: boolean;
}

function TitleBarImpl({ fileName, isDirty, filePath, onOpenFile, onNewFile, getExportHtml, onExportSuccess, onExportError, onToggleAI, aiActive, isNativeFullscreen, mode, onSetMode, liveEnabled }: TitleBarProps) {
    const { t } = useLocale();
    const desktopPlatform = getDesktopPlatform();
    const isMacOverlay = desktopPlatform === "macos";
    const showDocumentIdentity = desktopPlatform !== "windows" && desktopPlatform !== "linux";

    const handleTitleBarMouseDown = async (event: MouseEvent<HTMLElement>) => {
        // Windows/Linux now delegate drag and double-click zoom to the native
        // title bar. macOS Overlay still needs an HTML drag region beneath the
        // native traffic lights.
        if (!isMacOverlay) return;
        const target = event.target;

        if (
            event.button !== 0 ||
            (target instanceof Element &&
                target.closest("button, a, input, textarea, select, [role='button'], [role='menu'], [role='menuitem']"))
        ) {
            return;
        }

        try {
            const appWindow = Window.getCurrent();
            // Native macOS title bars zoom on double-click; event.detail
            // counts clicks within the double-click interval.
            if (event.detail === 2) {
                if (!isNativeFullscreen) await appWindow.toggleMaximize();
            } else {
                await appWindow.startDragging();
            }
        } catch (e) {
            console.error("Window drag failed:", e);
        }
    };

    // Extract parent folder from path for breadcrumb
    const getPathBreadcrumb = () => {
        if (!filePath) return null;
        const parts = filePath.replace(/\\/g, "/").split("/");
        if (parts.length >= 2) {
            return parts.slice(-2, -1)[0];
        }
        return null;
    };

    const parentFolder = getPathBreadcrumb();
    const hasFile = !!fileName;

    return (
        <>
            <header
                onMouseDown={handleTitleBarMouseDown}
                className={`h-11 shrink-0 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-3 bg-[var(--bg-titlebar)] border-b border-[var(--border)] no-select transition-colors ${isMacOverlay ? "drag-region" : ""} ${isMacOverlay && !isNativeFullscreen ? "pl-20" : ""}`}
            >
                {/* Left: Icon & Title */}
                <div className="flex min-w-0 items-center gap-2 no-drag">
                    {hasFile && showDocumentIdentity && <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                        <img src="/icon.png" alt="mdtxt" className="h-full w-full rounded-[5px] object-contain" />
                    </div>}
                    {hasFile && showDocumentIdentity && <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-[var(--text-secondary)]">
                        {parentFolder && (
                            <>
                                <span className="opacity-60 hidden md:inline">{parentFolder} /</span>
                            </>
                        )}
                        <span className="min-w-0 flex-1 truncate font-semibold tracking-tight text-[var(--text-primary)]">
                            {fileName || "mdtxt"}
                        </span>
                        {isDirty && (
                            <span className="ml-1 shrink-0 whitespace-nowrap text-xs italic text-[var(--status-unsaved)]">— {t("Edited")}</span>
                        )}
                    </div>}

                    {/* Open File / New Button - shown when a file is already open */}
                    {hasFile && onOpenFile && (
                        <div className="flex shrink-0 items-center gap-0.5">
                            <div className="ml-1 h-4 w-px shrink-0 bg-[var(--border)]"></div>
                            {onNewFile && (
                                <button
                                    onClick={onNewFile}
                                    aria-label={t("New file")}
                                    className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[var(--radius-md)] px-1.5 py-1 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] xl:px-2"
                                    title={t("New File (Ctrl+N)")}
                                >
                                    <span className="material-symbols-outlined text-[16px]">edit_note</span>
                                    <span className="hidden xl:inline">{t("New")}</span>
                                </button>
                            )}
                            <button
                                onClick={onOpenFile}
                                aria-label={t("Open file")}
                                className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[var(--radius-md)] px-1.5 py-1 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] xl:px-2"
                                title={t("Open File (Ctrl+O)")}
                            >
                                <span className="material-symbols-outlined text-[16px]">folder_open</span>
                                <span className="hidden xl:inline">{t("Open")}</span>
                            </button>
                            <ExportMenu
                                fileName={fileName || 'document.md'}
                                getExportHtml={getExportHtml}
                                onSuccess={onExportSuccess}
                                onError={onExportError}
                            />
                            {onToggleAI && (
                                <button
                                    onClick={onToggleAI}
                                    aria-label={t("AI assistant")}
                                    aria-pressed={aiActive}
                                    title={t("AI assistant")}
                                    className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[var(--radius-md)] px-1.5 py-1 text-xs font-semibold tracking-wide transition-colors xl:px-2.5 ${aiActive
                                        ? "bg-[var(--bg-hover)] text-[var(--accent)]"
                                        : "hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[15px] ai-shimmer" aria-hidden="true">auto_awesome</span>
                                    <span className="hidden xl:inline">AI</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-center px-3">
                    {!hasFile && showDocumentIdentity && <span className="text-[12px] font-medium tracking-tight text-[var(--text-primary)]">mdtxt</span>}
                    {hasFile && mode && onSetMode && (
                        <ModeToggle mode={mode} onSetMode={onSetMode} liveEnabled={liveEnabled} />
                    )}
                </div>

                {/* Settings is an application command. Window controls belong
                    to the platform title bar instead of being reimplemented. */}
                <div className="flex items-center justify-self-end gap-0.5 no-drag">
                    <SettingsMenu />
                </div>
            </header>
        </>
    );
}

// React.memo + useCallback'd parent props means the TitleBar skips re-render
// while the user is typing. Without this every keystroke reconciled the
// header — cheap individually, but it adds up on hot paths. The default
// shallow prop comparison is enough; all props are primitives or stable
// callbacks from App.
export const TitleBar = memo(TitleBarImpl);
