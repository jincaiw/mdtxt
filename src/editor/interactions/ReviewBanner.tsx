import { useLocale } from "../../context/LocaleContext";

export function ReviewBanner({ onAccept, onReject }: { onAccept: () => void; onReject: () => void }) {
    const { t } = useLocale();
    return <div className="flex items-center gap-2 px-3 h-9 shrink-0 bg-[var(--bg-secondary)] border-b border-[var(--accent)] text-xs no-select">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
        <span className="text-[var(--text-primary)] font-medium">{t("AI suggested changes")}</span>
        <span className="text-[var(--text-muted)] hidden sm:inline">{t("accept or reject each below, or all at once:")}</span>
        <div className="ml-auto flex items-center gap-1.5">
            <button onClick={onReject} className="px-2.5 py-1 rounded-[var(--radius-sm)] font-medium text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors">{t("Reject all")}</button>
            <button onClick={onAccept} className="px-2.5 py-1 rounded-[var(--radius-sm)] font-medium bg-[var(--accent)] text-[var(--accent-text)] hover:opacity-90 transition-colors">{t("Accept all")}</button>
        </div>
    </div>;
}
