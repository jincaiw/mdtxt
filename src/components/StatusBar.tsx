interface StatusBarProps {
    isSaved: boolean;
    lineNumber: number;
    columnNumber: number;
    mode?: "preview" | "code" | "split";
    showFileExplorer?: boolean;
    showTOC?: boolean;
    onToggleFileExplorer?: () => void;
    onToggleTOC?: () => void;
    wordCount?: number;
    charCount?: number;
    readingTimeMin?: number;
}

const formatReadingTime = (min: number): string => {
    if (min < 1) return "< 1 min read";
    if (min < 60) return `${Math.round(min)} min read`;
    const hours = Math.floor(min / 60);
    const rem = Math.round(min % 60);
    return rem === 0 ? `${hours}h read` : `${hours}h ${rem}m read`;
};

export function StatusBar({
    isSaved,
    lineNumber,
    columnNumber,
    mode = "preview",
    showFileExplorer = false,
    showTOC = false,
    onToggleFileExplorer,
    onToggleTOC,
    wordCount,
    charCount,
    readingTimeMin,
}: StatusBarProps) {
    return (
        <footer
            role="status"
            className="h-7 shrink-0 bg-[var(--bg-titlebar)] border-t border-[var(--border)] px-4 flex items-center justify-between text-[11px] font-medium tracking-wide text-[var(--text-secondary)] no-select transition-colors"
        >
            <div className="flex items-center gap-1">
                {/* File Explorer Toggle */}
                <button
                    onClick={onToggleFileExplorer}
                    title="Files (Ctrl+Shift+E)"
                    aria-label={showFileExplorer ? "Close file explorer" : "Open file explorer"}
                    aria-pressed={showFileExplorer}
                    className={`btn-press flex items-center justify-center w-8 h-6 rounded transition-colors ${showFileExplorer
                        ? "bg-[var(--accent)] text-[var(--accent-text)]"
                        : "hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                        }`}
                >
                    <span className="material-symbols-outlined text-[14px]">
                        folder_open
                    </span>
                </button>

                {/* TOC Toggle */}
                <button
                    onClick={onToggleTOC}
                    title="Table of Contents (Ctrl+Shift+O)"
                    aria-label={showTOC ? "Close table of contents" : "Open table of contents"}
                    aria-pressed={showTOC}
                    className={`btn-press flex items-center justify-center w-8 h-6 rounded transition-colors ${showTOC
                        ? "bg-[var(--accent)] text-[var(--accent-text)]"
                        : "hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                        }`}
                >
                    <span className="material-symbols-outlined text-[14px]">
                        format_list_bulleted
                    </span>
                </button>
            </div>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5" aria-label={isSaved ? "File saved" : "File has unsaved changes"}>
                    <span
                        className={`w-2 h-2 rounded-full transition-all ${isSaved
                            ? "bg-[var(--status-saved)] shadow-[0_0_4px_rgba(80,250,123,0.4)]"
                            : "bg-[var(--status-unsaved)] shadow-[0_0_4px_rgba(255,184,108,0.4)] status-dot-unsaved"
                            }`}
                    ></span>
                    <span className="transition-colors">{isSaved ? "Saved" : "Unsaved"}</span>
                </div>
                {(mode === "code" || mode === "split") && (
                    <div className="hover:text-[var(--text-primary)] cursor-default transition-colors">
                        Ln {lineNumber}, Col {columnNumber}
                    </div>
                )}
                {wordCount !== undefined && (
                    <div className="hover:text-[var(--text-primary)] cursor-default transition-colors" title={charCount !== undefined ? `${charCount.toLocaleString()} characters` : undefined}>
                        {wordCount.toLocaleString()} words
                    </div>
                )}
                {readingTimeMin !== undefined && readingTimeMin > 0 && (
                    <div className="hover:text-[var(--text-primary)] cursor-default transition-colors" title="Estimated reading time at 200 wpm">
                        {formatReadingTime(readingTimeMin)}
                    </div>
                )}
                <div className="hover:text-[var(--text-primary)] cursor-default transition-colors">
                    UTF-8
                </div>
            </div>
        </footer>
    );
}
