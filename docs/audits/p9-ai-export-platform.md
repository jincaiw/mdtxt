# P9 AI, Export, and Platform Security Evidence

Status: **implementation and automated gates complete; native export output remains part of P11 platform acceptance.**

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
| FR-EXPORT-003 DOCX | `src/utils/docxExport.ts`, `write_export_binary` | Test creates a real ZIP/OOXML signature and routes bytes through the bounded native writer |
| I18N-012 metadata language | `ExportMenu`, `resolveExportLanguage`, `generateHTML`, DOCX options | “Follow document / Simplified Chinese / English” is independent from UI language; tests cover inference and explicit override |
| SECURITY / least privilege | `src-tauri/capabilities/default.json`, `scripts/check-security-boundaries.mjs` | No WebView filesystem scope or write permission, no production MCP permission, strict CSP, asset protocol off, debug-only bridge registration |

## Current automated evidence

- `bun run test`: 49 files / 334 tests passed.
- `bun run build`: production TypeScript/Vite build passed.
- `bun run release:check`: identity, security, 458-key Chinese catalogue, zero direct user-copy literals, and documentation build passed.
- `cargo clippy --all-targets -- -D warnings`: passed.
- `cargo test`: 32 tests passed, including bounded native HTML/DOCX export writes, extension rejection, atomic replacement, and post-replacement durability handling.

## P11 evidence still required

1. Open exported HTML offline and inspect sanitized content, metadata language, links, images, math, Mermaid, and code highlighting.
2. Produce and inspect a non-empty PDF from the release candidate on macOS and Windows; verify the single Linux system print path on Ubuntu.
3. Open the release-candidate DOCX in a compatible reader and verify headings, lists, tables, images, and the documented math/Mermaid fallback.
4. Repeat AI-disabled startup and credential-store failure behavior in packaged builds. No real API key is required or permitted in release evidence.
