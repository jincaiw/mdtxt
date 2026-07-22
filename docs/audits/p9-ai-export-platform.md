# P9 AI, Export, and Platform Security Evidence

Status: **P9 accepted for the unsigned 0.1.0 prerelease scope. Native macOS
output, Windows WebView2 PDF, and Ubuntu WebKitGTK system printing passed.**

## Requirement traceability

| Requirement | Implementation evidence | Verification |
| --- | --- | --- |
| FR-AI-001 explicit opt-in and OS credential storage | `src/utils/persistence.ts`, `src-tauri/src/commands.rs` | AI defaults off; the API key is never written to browser storage; clearing configuration deletes the credential-store entry |
| FR-AI-001 cancellation, timeout, and bounded output | `src/utils/aiTransport.ts`, `src-tauri/src/ai.rs`, `src/utils/aiAssist.ts`, `src/utils/aiChat.ts` | Transport, cancellation, timeout, streaming, and response-size tests pass |
| FR-AI-002 honest bounded context | `AI_MAX_DOCUMENT_CONTEXT_CHARS`, `buildAskMessages`, `buildAgentMessages`, `AIPanel` | 120,000-character limit, omission marker, and visible truncation disclosure are covered by tests |
| FR-AI-003 review before mutation | `useEditorReview.ts`, `ReviewBanner.tsx`, versioned `onProposeEdit` contract | Per-change CodeMirror merge controls plus accept/reject-all; stale document id/version cannot apply a proposal silently |
| I18N-011 safe localized errors | `src/utils/aiErrors.ts` | Known errors map through the locale catalogue; unknown native/provider bodies collapse to a safe bilingual message instead of being displayed |
| FR-EXPORT-001 safe standalone HTML | `prepareExportHtml`, `generateHTML`, `write_export_text` | UI chrome and internal links are cleaned; title escaping, theme CSS, image handling, and real HTML output bytes are tested |
| FR-EXPORT-002 native PDF / Linux print fallback | `src-tauri/src/pdf.rs`, `exportToPDF` | macOS WKWebView and Windows WebView2 use native print engines; Linux uses one system print flow; P11 still requires release-package output inspection |
| FR-EXPORT-003 DOCX | `src/utils/docxExport.ts`, `write_export_binary` | Test creates a real ZIP/OOXML signature and routes bytes through the bounded native writer; Han content emits an explicit OOXML East Asia font mapping instead of depending on reader-specific fallback |
| I18N-012 metadata language | `ExportMenu`, `resolveExportLanguage`, `generateHTML`, DOCX options | “Follow document / Simplified Chinese / English” is independent from UI language; tests cover inference and explicit override |
| SECURITY / least privilege | `src-tauri/capabilities/default.json`, `scripts/check-security-boundaries.mjs` | No WebView filesystem scope or write permission, no production MCP permission, strict CSP, asset protocol off, debug-only bridge registration |

## Current automated evidence

- `bun run test`: 51 files / 353 tests passed.
- `bun run build`: production TypeScript/Vite build passed.
- `cargo clippy --all-targets -- -D warnings`: passed.
- `cargo test`: 32 tests passed, including bounded native HTML/DOCX export writes, extension rejection, atomic replacement, and post-replacement durability handling.
- `bun run release:check`: `mdtxt 0.1.0`, strict production security boundaries, 465 Chinese keys across 110 source files, zero direct JSX/accessibility literals, and the documentation build passed.

## Native output evidence

- The isolated, ad-hoc-signed macOS production app exported the same Chinese/English fixture through the real Export menu. HTML was `22,355` bytes and an explicit Simplified-Chinese pass emitted `<html lang="zh-CN">` plus the Chinese footer. The inspected PDF was `160,461` bytes, PDF 1.3, two pages, with selectable Chinese, table, code, KaTeX and the full Mermaid diagram.
- The final DOCX candidate `/tmp/mdtxt-p11-0c2b523.docx` was `38,012` bytes with SHA-256 `788cdddf915b6a671a409053e5cf4b5acf35072459a425e3fa821c3473b4c46c`. OOXML contains the Chinese title/body/list/table/link plus `w:eastAsia="Arial Unicode MS"`. The installed LibreOffice reader rendered the complete one-page output. The isolated renderer bundled with the documentation skill used a temporary HOME that could not see host CJK fonts and therefore showed boxes; the same file rendered correctly in the installed reader, so that isolated-font limitation is not credited as product output.
- Commit `a71cea8`, [CI `29954555501`](https://github.com/jincaiw/mdtxt/actions/runs/29954555501), Windows job `89040211509` invoked `export_pdf` in the real WebView2 host and recorded `MDTXT_NATIVE_PDF platform=windows engine=WebView2 bytes=18657 header=passed`; artifact `8543662129` retains the PDF and Microsoft Pinyin screenshot.
- The same run's Ubuntu job `89040211517` exercised the actual Reader → Export → PDF path, detected and captured the WebKitGTK system Print dialog, dismissed it, and recorded `MDTXT_NATIVE_PDF platform=ubuntu engine=WebKitGTK systemPrintDialog=passed`; artifact `8543607953` retains the print-dialog and Fcitx5 screenshots.
- The isolated production macOS app was opened through its real Settings → AI surface: the `启用 AI` switch was off, status was `未配置`, endpoint/model/key fields were empty, and test/clear actions were disabled. No real API key was used. Keychain-only persistence, safe credential failure, cancellation, timeout, and bounded-output tests are part of the 353-test suite.

## Exit decision

P9 is accepted. macOS HTML/PDF/DOCX, Windows WebView2 PDF bytes, Ubuntu system
printing, AI opt-in/credential/error behavior, and production security
boundaries all have current evidence. Formal signing remains a P11 GA boundary.
