import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import type { Theme, FontFamily, FontSize } from "../context/ThemeContext";
import { prepareExportHtml, resolveExportLanguage, type ExportMetadataLanguage } from "./exportUtils";

type HtmlToDocx = (
    html: string,
    header?: string | null,
    options?: Record<string, unknown>,
    footer?: string | null,
) => Promise<ArrayBuffer | Blob | Uint8Array>;

export const resolveDocxFont = (htmlContent: string): string =>
    /[\u3400-\u9fff\uf900-\ufaff]/u.test(htmlContent) ? "Arial Unicode MS" : "Calibri";

const escapeHtml = (text: string): string => text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// @turbodocx/html-to-docx's browser build reaches for Node globals. Load its
// compatibility layer only after the user has selected a DOCX destination, so
// normal export-menu use never downloads it or pays the initialization cost.
async function ensureDocxRuntime(): Promise<void> {
    const g = globalThis as Record<string, unknown>;
    if (typeof g.global === "undefined") g.global = g;
    if (typeof g.process === "undefined") g.process = { env: {} };
    if (typeof g.Buffer === "undefined") {
        const { Buffer } = await import("buffer");
        g.Buffer = Buffer;
    }
}

/** Export semantic preview HTML as Office Open XML on explicit user request. */
export async function exportToDocx(
    htmlContent: string,
    fileName: string,
    _theme: Theme,
    _font: FontFamily,
    _fontSize: FontSize,
    metadataLanguage: ExportMetadataLanguage = "document",
): Promise<boolean> {
    if (!htmlContent || htmlContent.trim() === "") return false;

    const title = fileName.replace(/\.(md|markdown)$/i, "");
    const cleaned = await prepareExportHtml(htmlContent);
    const language = resolveExportLanguage(cleaned, metadataLanguage);
    const docHtml = `<!DOCTYPE html><html lang="${language}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body><article>${cleaned}</article></body></html>`;
    const filePath = await save({
        defaultPath: `${title}.docx`,
        filters: [{ name: "Word Document", extensions: ["docx"] }],
    });
    if (!filePath) return false;

    await ensureDocxRuntime();
    const mod = await import("@turbodocx/html-to-docx");
    const convert = ((mod as { default?: HtmlToDocx }).default ?? (mod as unknown as HtmlToDocx)) as HtmlToDocx;
    const out = await convert(docHtml, null, {
        title,
        creator: "mdtxt",
        lang: language,
        footer: false,
        pageNumber: false,
        // Calibri contains no CJK glyphs. Some DOCX readers do not honor the
        // theme's fallback and render Chinese as blanks, so emit an explicit
        // Unicode-capable East Asian font whenever the content contains Han.
        font: resolveDocxFont(cleaned),
        fontSize: 22,
        table: { row: { cantSplit: true } },
    });
    const bytes = out instanceof Blob
        ? new Uint8Array(await out.arrayBuffer())
        : out instanceof Uint8Array ? out : new Uint8Array(out as ArrayBuffer);
    await invoke("write_export_binary", { path: filePath, bytes: Array.from(bytes) });
    return true;
}
