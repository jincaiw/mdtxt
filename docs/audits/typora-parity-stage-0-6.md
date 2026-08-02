# Typora-parity stages 0–6 completion audit

Audit date: 2026-08-02<br>
Candidate: `e844906` plus the current working-tree changes<br>
Distribution profile: deliberately unsigned on macOS, Windows and Linux

This record maps the approved stage order to authoritative implementation and
runtime evidence. It does not claim pixel copying, Typora branding, or private
implementation reuse. Typora is the interaction reference; mdtxt retains its
own identity and optional extensions.

## Status by stage

| Stage | Required result | Authoritative evidence | Status |
| --- | --- | --- | --- |
| 0 — baseline and product consistency | One Live-first desktop model, mdtxt identity, Chinese-first UI, documented safety/release boundary | `docs/audits/baseline-0.1.0.md`; `docs/audits/ui-a3-acceptance.md`; identity, i18n, security and user-copy release checks | Passed |
| 1 — Live editing foundation | Simplified mode model; one CodeMirror owner; `LiveBlockAdapter`; directly editable tables; exact Markdown and formatted copy | `src/editor/core`; `src/editor/live/liveBlockProjection.ts`; `src/editor/live/liveTableWidgets.ts`; `src/editor/interactions/editorCopy.ts`; focused behavior tests | Passed |
| 2 — desktop UI | Document-focused title bar, native menus, workspace sidebar, Outline, Articles and file tree | `TitleBar`, `WorkspaceSidebar`, `FileExplorer`, `useNativeMenu`; current macOS `.app` accessibility inspection | Passed |
| 3 — commands and shortcuts | Typora-compatible source, heading, format, sidebar, outline, Articles, file tree, quick-open, copy/paste and jump bindings; extensions do not steal them | `src/commands/typoraCommandRegistry.ts`; editor/global keymaps; native menu; shortcut sheet and registry tests | Passed |
| 4 — round trip and performance | Source/Live text ownership remains lossless; 1 MiB Live and 10 MiB restricted-Live budgets measured | round-trip fixtures/tests; `scripts/benchmark-live-editor.ts`; `docs/audits/p6-live-beta-tracking.md` | Passed |
| 5 — cross-platform unsigned release | GitHub Actions builds three platforms without signing credentials or signing tools; every public package is marked `-unsigned` | `.github/workflows/release.yml`; `check-product-identity.mjs` rejects signing commands, repository secrets and missing unsigned suffixes; release preflight; P10a historical installed-package evidence | Passed under the user-approved unsigned profile |
| 6 — native IME acceptance | Microsoft Pinyin and Fcitx5 evidence retained; current macOS branch proves Apple Pinyin preedit, candidate placement and commit | `docs/testing/p6-live-beta-ime-checklist.md`; stored screenshots and platform evidence | Passed |

## Current macOS desktop evidence

The runtime-inspected debug bundle was built at
`src-tauri/target/debug/bundle/macos/mdtxt.app`; executable SHA-256:
`80c0814ad40ebb74d0f1016c64b4a7e00063e557357876617cedb15aadfc769c`.
Computer Use targeted that exact bundle path rather than the older mounted DMG.
Its accessibility tree confirmed:

- Format: Bold, Italic, Underline, Strikethrough, Inline code, Link, Image and
  Clear format.
- Edit: Copy as Markdown, Paste as plain text, Jump to selection, Find and
  Find and replace.
- View: Source Code Mode, sidebar, Outline, Articles, file tree, formatting
  toolbar, Typewriter mode, Focus mode and fullscreen.

After aligning New Tab, reopen, document-cycle and fullscreen accelerators with
Typora's official shortcut table, the current bundle was rebuilt with SHA-256
`a08e473a496fcbabd231d6d2978c58f791f1869c0ffe8f53b378cd9db038a1ba`.
Runtime accessibility inspection of that exact bundle confirmed New Tab and
Quick Open in File, plus Source Code Mode, sidebar, Outline, Articles, file
tree, toolbar, Typewriter, Focus, cross-file search, statistics and fullscreen
in View. It also caught and verified the fix for three untranslated native-menu
labels (`快速打开`, `源代码模式`, `切换侧边栏`). A subsequent Apple Pinyin run
on this exact bundle displayed underlined `hou xuan` with the native candidate
strip immediately below the active editor line. The 3840×2160 full-screen
capture is archived as
`docs/testing/evidence/macos-apple-pinyin-candidate-2026-08-02.png` (SHA-256
`40e9fc7e617968c6698bb724b71f0e669d0ad1a9776178fd19597182ff1a25f9`).

Shortcut source of truth: <https://support.typora.io/Shortcut-Keys/>.

## Verification commands

- `bun run test` — 62 files / 398 tests passed
- `bun run build`
- `bun run release:check`
- `node --check e2e/native/app.e2e.mjs`
- `cargo test`
- `cargo fmt --check`
- `cargo clippy --all-targets --all-features -- -D warnings`
- `bun run benchmark:live-editor`

Stage 6 is complete: current-branch evidence separately proves Apple Pinyin
preedit/commit and visually proves the system candidate strip is anchored
directly below the active editor line.
