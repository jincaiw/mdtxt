export type ViewMode = "preview" | "code" | "split" | "live";
import { useLocale } from "../context/LocaleContext";

interface ModeToggleProps {
    mode: ViewMode;
    onSetMode: (mode: ViewMode) => void;
}

const buttonBase =
    "btn-press flex h-7 items-center gap-1.5 rounded-[var(--radius-sm)] px-2 text-[11px] font-medium transition-colors";

export function ModeToggle({ mode, onSetMode }: ModeToggleProps) {
    const { t } = useLocale();
    const modeClass = (active: boolean) => active
        ? "bg-[var(--bg-primary)] text-[var(--accent)] shadow-[var(--shadow-control)]"
        : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]";
    return (
        <div
            className="no-drag flex items-center gap-0.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] p-0.5"
            role="group"
            aria-label={t("View mode toggle")}
        >
            <button
                    onClick={() => onSetMode("code")}
                    aria-label={t("Code editor")}
                    aria-pressed={mode === "code"}
                    title={t("Source (Ctrl+E)")}
                    className={`${buttonBase} ${modeClass(mode === "code")}`}
                >
                    <span className="material-symbols-outlined text-[15px]">code</span>
                    <span className="hidden lg:inline">{t("Source")}</span>
            </button>

            <button
                    onClick={() => onSetMode("live")}
                    aria-label={t("Live mode")}
                    aria-pressed={mode === "live"}
                    title={t("Live Markdown editor")}
                    className={`${buttonBase} ${modeClass(mode === "live")}`}
                >
                    <span className="material-symbols-outlined text-[15px]">auto_fix_high</span>
                    <span className="hidden lg:inline">{t("Live")}</span>
            </button>
        </div>
    );
}
