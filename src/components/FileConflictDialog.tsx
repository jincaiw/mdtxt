import { useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLocale } from "../context/LocaleContext";
import { Modal } from "./Modal";

interface FileConflictDialogProps {
    isOpen: boolean;
    path: string;
    fileName: string;
    /** A versioned, controller-owned read used only for this read-only comparison. */
    localContent: string;
    onClose: () => void;
    onKeepLocal: () => void;
    onReload: () => void;
    onSaveCopy: () => void;
}

interface DiskFileData {
    content: string;
}

/** A deliberate choice point after an on-disk edit. Neither action overwrites
 * the other version: reload discards only local buffered edits after consent,
 * while Save As creates a separate local copy. */
export function FileConflictDialog({ isOpen, path, fileName, localContent, onClose, onKeepLocal, onReload, onSaveCopy }: FileConflictDialogProps) {
    const { t } = useLocale();
    const reloadRef = useRef<HTMLButtonElement>(null);
    const [comparisonOpen, setComparisonOpen] = useState(false);
    const [diskContent, setDiskContent] = useState<string | null>(null);
    const [compareError, setCompareError] = useState<string | null>(null);
    const [isLoadingComparison, setIsLoadingComparison] = useState(false);

    const openComparison = async () => {
        setComparisonOpen(true);
        setCompareError(null);
        setIsLoadingComparison(true);
        try {
            const disk = await invoke<DiskFileData>("read_file", { path });
            setDiskContent(disk.content);
        } catch {
            setCompareError(t("Could not read the disk version for comparison."));
        } finally {
            setIsLoadingComparison(false);
        }
    };

    const close = () => {
        setComparisonOpen(false);
        setDiskContent(null);
        setCompareError(null);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={close} role="alertdialog" labelledBy="file-conflict-title" initialFocusRef={reloadRef} panelClassName={comparisonOpen ? "w-[min(960px,calc(100vw-2rem))]" : "w-[420px]"}>
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
            {comparisonOpen && (
                <div className="grid max-h-[45vh] grid-cols-1 gap-3 overflow-auto border-t border-[var(--border)] px-5 py-4 md:grid-cols-2">
                    <section>
                        <h3 className="mb-2 text-sm font-medium text-[var(--text-primary)]">{t("Local version")}</h3>
                        <pre className="max-h-[32vh] overflow-auto whitespace-pre-wrap break-words rounded border border-[var(--border)] bg-[var(--bg-secondary)] p-3 text-xs text-[var(--text-primary)]">{localContent}</pre>
                    </section>
                    <section>
                        <h3 className="mb-2 text-sm font-medium text-[var(--text-primary)]">{t("Disk version")}</h3>
                        {isLoadingComparison && <p className="text-sm text-[var(--text-secondary)]">{t("Loading…")}</p>}
                        {compareError && <p className="text-sm text-[var(--status-error)]">{compareError}</p>}
                        {diskContent !== null && <pre className="max-h-[32vh] overflow-auto whitespace-pre-wrap break-words rounded border border-[var(--border)] bg-[var(--bg-secondary)] p-3 text-xs text-[var(--text-primary)]">{diskContent}</pre>}
                    </section>
                </div>
            )}
            <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--bg-secondary)] px-5 py-4">
                <button onClick={openComparison} className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10">{comparisonOpen ? t("Refresh comparison") : t("Compare versions")}</button>
                <button onClick={onKeepLocal} className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">{t("Keep local")}</button>
                <button onClick={onSaveCopy} className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10">{t("Save As…")}</button>
                <button ref={reloadRef} onClick={onReload} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-text)] hover:bg-[var(--accent-hover)]">{t("Reload disk version")}</button>
            </div>
        </Modal>
    );
}
