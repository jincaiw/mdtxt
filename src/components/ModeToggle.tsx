export type ViewMode = "preview" | "code" | "split" | "live";
import { useLocale } from "../context/LocaleContext";

interface ModeToggleProps {
    mode: ViewMode;
    onSetMode: (mode: ViewMode) => void;
    /** Shift left when the AI panel is open so the toggle isn't hidden behind it. */
    aiPanelOpen?: boolean;
    liveEnabled?: boolean;
}

const buttonBase =
    "btn-press flex items-center gap-2 px-3 py-2 rounded-full transition-all duration-200";

export function ModeToggle({ mode, onSetMode, aiPanelOpen, liveEnabled = false }: ModeToggleProps) {
    const { t } = useLocale();
    return (
        <div
            className="fixed bottom-8 z-50"
            style={{ right: aiPanelOpen ? "calc(min(400px, 90vw) + 2rem)" : "2rem", transition: "right 0.15s ease" }}
            role="group"
            aria-label={t("View mode toggle")}
        >
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-full p-1.5 flex items-center shadow-2xl backdrop-blur-sm transition-colors animate-fade-in">
                <button
                    onClick={() => onSetMode("preview")}
                    aria-label={t("Reader mode")}
                    aria-pressed={mode === "preview"}
                    title={t("Reader (Ctrl+E)")}
                    className={`${buttonBase} ${mode === "preview"
                        ? "bg-[var(--accent)] text-[var(--accent-text)] shadow-md"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}
                >
                    <span className="material-symbols-outlined text-[20px]">visibility</span>
                    {mode === "preview" && <span className="text-sm font-bold">{t("Reader")}</span>}
                </button>

                {liveEnabled && <button
                    onClick={() => onSetMode("live")}
                    aria-label={t("Live Beta mode")}
                    aria-pressed={mode === "live"}
                    title={t("Live Beta (Source-compatible)")}
                    className={`${buttonBase} ${mode === "live"
                        ? "bg-[var(--accent)] text-[var(--accent-text)] shadow-md"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}
                >
                    <span className="material-symbols-outlined text-[20px]">auto_fix_high</span>
                    {mode === "live" && <span className="text-sm font-bold">{t("Live")}</span>}
                </button>}

                <button
                    onClick={() => onSetMode("split")}
                    aria-label={t("Split view")}
                    aria-pressed={mode === "split"}
                    title={t("Split view (Ctrl+\\)")}
                    className={`${buttonBase} ${mode === "split"
                        ? "bg-[var(--accent)] text-[var(--accent-text)] shadow-md"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}
                >
                    <span className="material-symbols-outlined text-[20px]">vertical_split</span>
                    {mode === "split" && <span className="text-sm font-bold">{t("Split")}</span>}
                </button>

                <button
                    onClick={() => onSetMode("code")}
                    aria-label={t("Code editor")}
                    aria-pressed={mode === "code"}
                    title={t("Code (Ctrl+E)")}
                    className={`${buttonBase} ${mode === "code"
                        ? "bg-[var(--accent)] text-[var(--accent-text)] shadow-md"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}
                >
                    {mode === "code" && <span className="text-sm font-bold">{t("Code")}</span>}
                    <span className="material-symbols-outlined text-[20px]">code</span>
                </button>
            </div>
        </div>
    );
}
