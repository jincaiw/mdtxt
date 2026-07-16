import { useRef } from "react";
import { Modal } from "./Modal";
import { useLocale } from "../context/LocaleContext";

interface UnsavedChangesDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onDiscard: () => void;
    onSave: () => void;
    /** Names of the files with unsaved changes. When more than one is present the
     *  dialog lists them and the buttons read "Save all" / "Discard all". Omit or
     *  pass a single name for the original single-file wording. */
    dirtyNames?: string[];
}

export function UnsavedChangesDialog({
    isOpen,
    onClose,
    onDiscard,
    onSave,
    dirtyNames,
}: UnsavedChangesDialogProps) {
    const { t } = useLocale();
    const saveButtonRef = useRef<HTMLButtonElement>(null);
    const many = (dirtyNames?.length ?? 0) > 1;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            role="alertdialog"
            labelledBy="unsaved-dialog-title"
            initialFocusRef={saveButtonRef}
            panelClassName="w-[380px]"
        >
            {/* Header */}
            <div className="px-5 pt-5 pb-3">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--bg-hover)] text-[var(--status-unsaved)]" aria-hidden="true">
                        <span className="material-symbols-outlined text-[22px]">warning</span>
                    </span>
                    <div>
                        <h2 id="unsaved-dialog-title" className="text-base font-semibold text-[var(--text-primary)]">
                            {t("Unsaved Changes")}
                        </h2>
                        <p className="text-sm text-[var(--text-secondary)]">
                            {many ? t("{count} files have unsaved changes", { count: dirtyNames!.length }) : t("Your changes will be lost")}
                        </p>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="px-5 pb-4">
                <p id="unsaved-dialog-desc" className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {many
                        ? t("These files have unsaved changes. Do you want to save them before closing?")
                        : t("You have unsaved changes. Do you want to save them before closing?")}
                </p>
                {many && (
                    <ul className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] divide-y divide-[var(--border)]">
                        {dirtyNames!.map((name, i) => (
                            <li key={`${name}-${i}`} className="flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--text-primary)]">
                                <span className="material-symbols-outlined text-[14px] text-[var(--accent)] shrink-0">circle</span>
                                <span className="truncate">{name}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 bg-[var(--bg-secondary)] border-t border-[var(--border)]">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                >
                    {t("Cancel")}
                </button>
                <button
                    onClick={onDiscard}
                    className="px-4 py-2 text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded-lg transition-colors"
                >
                    {t(many ? "Discard all" : "Don't Save")}
                </button>
                <button
                    ref={saveButtonRef}
                    onClick={onSave}
                    className="px-4 py-2 text-sm font-medium text-[var(--accent-text)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors"
                >
                    {t(many ? "Save all" : "Save")}
                </button>
            </div>
        </Modal>
    );
}
