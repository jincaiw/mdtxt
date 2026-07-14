import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import type { Theme, FontFamily, FontSize } from "../context/ThemeContext";
import { prepareExportHtml } from "./exportUtils";

type HtmlToDocx = (
    html: string,
    header?: string | null,
    options?: Record<string, unknown>,
    footer?: string | null,
) => Promise<ArrayBuffer | Blob | Uint8Array>;

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
): Promise<boolean> {
    if (!htmlContent || htmlContent.trim() === "") return false;

    const title = fileName.replace(/\.(md|markdown)$/i, "");
    const cleaned = await prepareExportHtml(htmlContent);
    const docHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body><article>${cleaned}</article></body></html>`;
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
        footer: false,
        pageNumber: false,
        font: "Calibri",
        fontSize: 22,
        table: { row: { cantSplit: true } },
    });
    const bytes = out instanceof Blob
        ? new Uint8Array(await out.arrayBuffer())
        : out instanceof Uint8Array ? out : new Uint8Array(out as ArrayBuffer);
    await writeFile(filePath, bytes);
    return true;
}
