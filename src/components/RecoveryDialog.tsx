import { useRef } from "react";
import { useLocale } from "../context/LocaleContext";
import { Modal } from "./Modal";

export interface RecoveryCandidate { documentId: string; name: string; content: string; savedAtMs: number; }
interface RecoveryDialogProps { entries: RecoveryCandidate[]; onRestore: (entry: RecoveryCandidate) => void; onDiscard: (entry: RecoveryCandidate) => void; }

export function RecoveryDialog({ entries, onRestore, onDiscard }: RecoveryDialogProps) {
    const { t, formatDate } = useLocale();
    const firstRef = useRef<HTMLButtonElement>(null);
    return <Modal isOpen={entries.length > 0} onClose={() => {}} closeOnBackdrop={false} role="alertdialog" labelledBy="recovery-title" initialFocusRef={firstRef} panelClassName="w-[480px]">
        <div className="px-5 pt-5 pb-3"><h2 id="recovery-title" className="text-base font-semibold text-[var(--text-primary)]">{t("Recover unsaved documents")}</h2><p className="mt-2 text-sm text-[var(--text-secondary)]">{t("mdtxt found verified recovery copies. Restoring creates a new unsaved tab and never overwrites the disk file.")}</p></div>
        <ul className="max-h-64 divide-y divide-[var(--border)] overflow-y-auto border-y border-[var(--border)]">{entries.map((entry, index) => <li key={entry.documentId} className="px-5 py-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-[var(--text-primary)]">{entry.name}</p><p className="text-xs text-[var(--text-secondary)]">{formatDate(new Date(entry.savedAtMs))}</p></div><div className="flex shrink-0 gap-2"><button onClick={() => onDiscard(entry)} className="rounded px-2 py-1 text-xs text-[var(--danger)] hover:bg-[var(--danger)]/10">{t("Discard")}</button><button ref={index === 0 ? firstRef : undefined} onClick={() => onRestore(entry)} className="rounded bg-[var(--accent)] px-2 py-1 text-xs font-medium text-[var(--accent-text)] hover:bg-[var(--accent-hover)]">{t("Restore")}</button></div></div></li>)}</ul>
    </Modal>;
}
