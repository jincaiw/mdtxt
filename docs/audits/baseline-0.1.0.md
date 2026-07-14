# mdtxt 0.1.0 Baseline Audit

Date: 2026-07-14  
Upstream baseline: `main@4da116d` (`Paperling` v1.0.50)  
Target branch: `codex/refactor-mdtxt-0.1.0`

## Scope and repository state

- The existing repository and `origin` remain unchanged.
- The product requirements and refactor guide are tracked as the mdtxt 0.1.0
  execution contract.
- The upstream Apache-2.0 `LICENSE` and `NOTICE` remain authoritative for
  upstream attribution.
- Root frontend package management is Bun only. `bun.lock` is authoritative;
  the legacy root and docs npm lockfiles were removed.

## Toolchain baseline

| Tool | Required | Observed |
| --- | --- | --- |
| Bun | 1.3.14 | 1.3.14 |
| Node.js | 24.18.0 | 26.3.1 before pinning |
| Rust | 1.96.1 with clippy and rustfmt | 1.96.1 |

Toolchain versions are now declared in `package.json`, `.node-version`, and
`rust-toolchain.toml`; CI no longer uses floating Bun or Rust versions.

## Module map

| Area | Current implementation | Refactor destination |
| --- | --- | --- |
| Application state | `src/App.tsx` owns live document strings, tabs, mode, save, preview and UI panels | DocumentSession manager plus application shell |
| CodeMirror | `src/components/CodeEditor.tsx` owns creation, commands, paste, tables and review | `src/editor/` core, commands, extensions and interactions |
| Rendering | `src/components/MarkdownPreview.tsx` uses remark/rehype/KaTeX/Mermaid | Reader/Split remains; Live uses Lezer decorations and widgets |
| Files | `src-tauri/src/commands.rs` reads, saves, scans, searches and handles images | versioned file/recovery services and conflict-safe save protocol |
| Platform | `src-tauri/src/lib.rs` registers Tauri plugins, single-instance, updater and debug MCP bridge | mdtxt-only identifiers and production-safe plugin configuration |
| AI/export | `src-tauri/src/ai.rs`, `src-tauri/src/pdf.rs`, frontend AI/export utilities | versioned snapshot consumers with localized errors |

## State and data-flow risks

1. `App.tsx` stores active content in React and `CodeEditor` mirrors it in
   CodeMirror. Every editor update serializes the full document back to React.
2. Tabs store text snapshots; switching documents intentionally recreates the
   editor document and resets undo history rather than preserving per-tab
   `EditorState`.
3. Save currently preserves CRLF but does not model BOM, trailing newline,
   content hash or expected disk revision.
4. The current external-file watcher is mtime based. It cannot provide a
   compare/reload/keep-local/save-as conflict workflow with hash verification.
5. Recovery only persists paths and cursor lines; unsaved buffers are not a
   durable, checksummed recovery artifact.

## Product identity and internationalization gaps

- 76 tracked files and 189 runtime/configuration matches still reference the
  upstream Paperling name, identifier, version or release endpoint.
- Tauri currently identifies as `com.mujizi.paperling` and contacts the
  Paperling updater endpoint.
- `LocaleContext` uses English sentences as keys and defaults to English.
- User-visible strings remain throughout components, native smoke tests,
  exports, AI prompts and documentation.
- AI uses the legacy `marklite` keychain service and can fall back to plaintext
  localStorage when keychain access fails.

## Security and platform observations

- `save_file` already uses same-directory temporary files and fsync, but does
  not preserve all metadata or detect a stale disk revision before replacement.
- Image reads validate relative paths and canonicalize containment.
- The Tauri capability grants broad `fs:scope` write access for exports; this
  must be replaced with Rust-owned export writes.
- The current production updater is unsafe for mdtxt because it uses Paperling
  signing metadata and endpoints; it must be disabled in the identity phase.

## Validation baseline

| Check | Result |
| --- | --- |
| `bun install --frozen-lockfile` | passed |
| `bun run check:i18n` | passed; 373 current Chinese entries |
| `bun run test` | passed; 268 tests, 1 bundle test skipped before build |
| `bun run build` | passed; `dist` is 11 MB |
| `bun audit --audit-level=high` | initially found `serialize-javascript` via Mocha; remediated with a root override, then passed |
| `docs: bun install --frozen-lockfile && bun run build` | passed |
| `cargo fmt --check` | initially failed in `ai.rs`, `lib.rs`, `pdf.rs`; formatting baseline corrected separately |
| `cargo clippy`, `cargo test`, `cargo check` | passed after toolchain repair and formatting |
| `bun run tauri build --debug` | frontend and macOS app bundles succeeded; final updater artifact failed because an upstream public key is configured without a private signing key |

## Performance baseline limitations

The repository has no repeatable startup, input-latency, memory, large-file or
widget benchmark. The Vite build has a 1.68 MB DOCX chunk and a 749 KB primary
application chunk; `dist` totals 11 MB. Step 1 introduces deterministic large
document fixtures and benchmark plumbing, while later Live phases record
transaction and widget timings.

## Phase-0 exit criteria

- Toolchain and lockfile are reproducible.
- Audit findings, command outputs and performance limitations are recorded.
- Formatting and CI version pinning are clean.
- No user-facing product identity, localization or editor behavior changes are
  introduced in this phase.
