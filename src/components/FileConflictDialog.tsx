import { useRef } from "react";
import { useLocale } from "../context/LocaleContext";
import { Modal } from "./Modal";

interface FileConflictDialogProps {
    isOpen: boolean;
    fileName: string;
    onClose: () => void;
    onReload: () => void;
    onSaveCopy: () => void;
}

/** A deliberate choice point after an on-disk edit. Neither action overwrites
 * the other version: reload discards only local buffered edits after consent,
 * while Save As creates a separate local copy. */
export function FileConflictDialog({ isOpen, fileName, onClose, onReload, onSaveCopy }: FileConflictDialogProps) {
    const { t } = useLocale();
    const reloadRef = useRef<HTMLButtonElement>(null);
    return (
        <Modal isOpen={isOpen} onClose={onClose} role="alertdialog" labelledBy="file-conflict-title" initialFocusRef={reloadRef} panelClassName="w-[420px]">
            <div className="px-5 pt-5 pb-3">
                <h2 id="file-conflict-title" className="text-base font-semibold text-[var(--text-primary)]">{t("File changed on disk")}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                    {t("{file} was edited outside mdtxt. Choose which version to keep.", { file: fileName })}
                </p>
            </div>
            <div className="px-5 pb-4 text-sm leading-relaxed text-[var(--text-secondary)]">
                <p>{t("Reload uses the disk version and discards this tab's local edits.")}</p>
                <p className="mt-1">{t("Save As keeps local edits in a new file without changing the disk version.")}</p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--bg-secondary)] px-5 py-4">
                <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">{t("Cancel")}</button>
                <button onClick={onSaveCopy} className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10">{t("Save As…")}</button>
                <button ref={reloadRef} onClick={onReload} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-text)] hover:bg-[var(--accent-hover)]">{t("Reload disk version")}</button>
            </div>
        </Modal>
    );
}
