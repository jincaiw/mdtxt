import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useDropdownKeyboard } from '../hooks/useDropdownKeyboard';
import { useLocale } from '../context/LocaleContext';

// The export module isn't needed for first paint, so we import it on demand to
// keep it out of the main chunk. Caching the promise means a second click — or
// HTML-then-PDF — reuses the first load.
type ExportModule = typeof import('../utils/exportUtils');
type DocxExportModule = typeof import('../utils/docxExport');
let exportModulePromise: Promise<ExportModule> | null = null;
let docxExportModulePromise: Promise<DocxExportModule> | null = null;
const loadExportModule = (): Promise<ExportModule> => {
    if (!exportModulePromise) {
        exportModulePromise = import('../utils/exportUtils');
    }
    return exportModulePromise;
};
const loadDocxExportModule = (): Promise<DocxExportModule> => {
    if (!docxExportModulePromise) {
        docxExportModulePromise = import('../utils/docxExport');
    }
    return docxExportModulePromise;
};

interface ExportMenuProps {
    fileName: string;
    getExportHtml?: () => string;
    onSuccess?: (format: string) => void;
    onError?: (format: string) => void;
}

type ExportFormat = 'html' | 'pdf' | 'docx';
type ExportMetadataLanguage = import('../utils/exportUtils').ExportMetadataLanguage;

const EXPORT_LANGUAGE_KEY = 'mdtxt:exportMetadataLanguage';
const getInitialExportLanguage = (): ExportMetadataLanguage => {
    try {
        const stored = localStorage.getItem(EXPORT_LANGUAGE_KEY);
        if (stored === 'zh-CN' || stored === 'en' || stored === 'document') return stored;
    } catch { /* storage unavailable */ }
    return 'document';
};

export function ExportMenu({ fileName, getExportHtml, onSuccess, onError }: ExportMenuProps) {
    const { t } = useLocale();
    const [isOpen, setIsOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [metadataLanguage, setMetadataLanguage] = useState<ExportMetadataLanguage>(getInitialExportLanguage);
    const { theme, font, fontSize } = useTheme();
    const menuRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const onMenuKeyDown = useDropdownKeyboard(isOpen, panelRef, () => setIsOpen(false));

    // Close menu when clicking outside or pressing Escape
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKey);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKey);
        };
    }, [isOpen]);

    const disabled = !getExportHtml;

    const handleExport = async (format: ExportFormat) => {
        if (isExporting || !getExportHtml) return;

        // Capture HTML on demand from the visible preview
        const htmlContent = getExportHtml();
        if (!htmlContent) return;

        setIsExporting(true);
        setIsOpen(false);

        try {
            if (format === 'html') {
                const mod = await loadExportModule();
                // exportToHTML returns false when the save dialog is cancelled.
                if (await mod.exportToHTML(htmlContent, fileName, theme, font, fontSize, metadataLanguage)) {
                    onSuccess?.('HTML');
                }
            } else if (format === 'docx') {
                // exportToDocx returns false on a cancelled save dialog.
                const mod = await loadDocxExportModule();
                if (await mod.exportToDocx(htmlContent, fileName, theme, font, fontSize, metadataLanguage)) {
                    onSuccess?.('DOCX');
                }
            } else {
                const mod = await loadExportModule();
                const result = await mod.exportToPDF(htmlContent, fileName, theme, font, fontSize, metadataLanguage);
                // Only the native save path (Windows/macOS) can confirm a
                // written file. The Linux print-dialog fallback ('printing') is
                // its own visible feedback, so we don't claim success there.
                // 'cancelled' → stay silent.
                if (result === 'saved') onSuccess?.('PDF');
            }
        } catch (error) {
            console.error(`Failed to export ${format}:`, error);
            onError?.(format.toUpperCase());
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div ref={menuRef} className="relative shrink-0 no-drag">
            {/* Export Button */}
            <button
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled || isExporting}
                aria-label={t("Export document")}
                aria-expanded={isOpen}
                aria-haspopup="true"
                className={`btn-press flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-1.5 py-1 text-xs transition-colors hover:bg-[var(--bg-hover)] xl:px-2 ${
                    disabled
                        // Muted color at full opacity rather than opacity-40 on top
                        // of muted — keeps the disabled label readable (a11y).
                        ? 'cursor-not-allowed text-[var(--text-muted)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title={t("Export document")}
            >
                {isExporting ? (
                    <>
                        <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                        <span className="hidden xl:inline">{t("Exporting...")}</span>
                    </>
                ) : (
                    <>
                        <span className="material-symbols-outlined text-[16px]">ios_share</span>
                        <span className="hidden xl:inline">{t("Export")}</span>
                    </>
                )}
            </button>

            {/* Simple Dropdown Menu */}
            {isOpen && !disabled && (
                <div ref={panelRef} onKeyDown={onMenuKeyDown} role="menu" aria-label={t("Export formats")} className="absolute left-0 top-full mt-1 w-56 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-xl overflow-hidden z-[70] animate-fade-in-down">
                    <label className="block px-3 py-2 border-b border-[var(--border-subtle)]">
                        <span className="block mb-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{t("Metadata language")}</span>
                        <select
                            value={metadataLanguage}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => {
                                const next = event.target.value as ExportMetadataLanguage;
                                setMetadataLanguage(next);
                                try { localStorage.setItem(EXPORT_LANGUAGE_KEY, next); } catch { /* storage unavailable */ }
                            }}
                            className="w-full px-2 py-1 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[var(--text-primary)]"
                        >
                            <option value="document">{t("Follow document")}</option>
                            <option value="zh-CN">{t("Simplified Chinese")}</option>
                            <option value="en">{t("English")}</option>
                        </select>
                    </label>
                    <button
                        role="menuitem"
                        onClick={() => handleExport('html')}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)] transition-colors"
                    >
                        <span className="material-symbols-outlined text-[22px] w-6 text-center text-[var(--accent)]" aria-hidden="true">ios_share</span>
                        <span>HTML</span>
                    </button>
                    <button
                        role="menuitem"
                        onClick={() => handleExport('pdf')}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)] transition-colors"
                    >
                        <span className="material-symbols-outlined text-[22px] w-6 text-center text-[var(--accent)]" aria-hidden="true">description</span>
                        <span>PDF</span>
                    </button>
                    <button
                        role="menuitem"
                        onClick={() => handleExport('docx')}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--bg-hover)] transition-colors"
                    >
                        <span className="material-symbols-outlined text-[22px] w-6 text-center text-[var(--accent)]" aria-hidden="true">description</span>
                        <span>Word (.docx)</span>
                    </button>
                </div>
            )}
        </div>
    );
}
