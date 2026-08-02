import { memo } from "react";
import type { MouseEvent } from "react";
import { Window } from "@tauri-apps/api/window";
import { SettingsMenu } from "./SettingsMenu";
import { useLocale } from "../context/LocaleContext";
import { getDesktopPlatform } from "../utils/desktopPlatform";

interface TitleBarProps {
    fileName?: string;
    isDirty?: boolean;
    filePath?: string;
    /** macOS hides traffic lights while in native fullscreen, so release the
     * overlay safe area instead of leaving an empty gutter. */
    isNativeFullscreen?: boolean;
    onToggleNavigation?: () => void;
    navigationActive?: boolean;
}

function TitleBarImpl({ fileName, isDirty, filePath, isNativeFullscreen, onToggleNavigation, navigationActive }: TitleBarProps) {
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
                    {hasFile && onToggleNavigation && (
                        <button
                            onClick={onToggleNavigation}
                            aria-label={t(navigationActive ? "Close navigation sidebar" : "Open navigation sidebar")}
                            aria-pressed={navigationActive}
                            title={t("Navigation sidebar")}
                            className={`workspace-title-button ${navigationActive ? "active" : ""}`}
                        >
                            <span className="material-symbols-outlined" aria-hidden="true">folder_open</span>
                        </button>
                    )}
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

                </div>

                {/* Typora keeps the document itself as the primary visual
                    object. Source mode, export and auxiliary tools stay in
                    native menus / commands instead of becoming title-bar modes. */}
                <div aria-hidden="true" />

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
