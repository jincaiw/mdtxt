# P6 Live Beta Requirement Tracking

## v0.2.0 addendum

v0.2.0 advances the approved inactive-line presentation from styling-only
decorations to source-preserving replacements. Inline delimiters, block markers
and complex-widget source collapse only while their node is unfocused; a caret,
selection, composition, search match, malformed parse or uncertain mapping
restores exact Markdown. This preserves the original P6 boundary: Markdown,
selection and undo history remain authoritative; at that historical gate Live
was explicit Beta and Source was the default and fallback.

Historical status: this record accepted Live Beta on macOS, Windows, and
Ubuntu. Since v0.4, Live is the default writing surface; Source remains the
lossless fallback, and Split/Reader remain secondary views. The platform
evidence below is retained as the original acceptance record and must be
rerun after changes to CodeMirror ownership, block focus, IME helpers or
large-document admission.

## Requirement traceability

| Requirement | Evidence | Result |
| --- | --- | --- |
| Source-preserving Live syntax | `src/editor/live/liveMarkdownPresentation.ts`, `src/test/fixtures/markdown/live-beta.md`, `src/test/liveBetaRoundTrip.test.ts` | Lezer/CodeMirror decorations preserve the exact Markdown source and undo history |
| Focus, selection, and composition | `src/editor/live/editFocusResolver.ts`, native Pinyin/Fcitx5 jobs | Composition, multi-selection, clipboard, undo/redo, mode changes, and tab changes retain Source fallback |
| Primary Live mode | persistence, settings, `ModeToggle`, session tests | Live is the default for new and migrated sessions; Source is always a direct fallback |
| Restricted Live | `src/editor/live/liveEligibility.ts`, `CodeEditor` disclosure | Large/complex documents retain editable Source geometry and show the downgrade reason |
| Native performance | mdtxt-owned CI run `29946140453`, commit `6ac73e0` | Windows and Ubuntu meet the 1 MiB input and 10 MiB Source/restricted-Live budgets |
| Native Chinese IME | macOS manual record plus CI artifacts `8540422494` and `8540348396` | Apple Simplified Pinyin, Microsoft Pinyin, and Fcitx5 Pinyin passed; Japanese IME is outside 0.1.0 scope |

## Current automated evidence

### 2026-08 active-branch update

- `bun run test`: 62 files / 398 tests passed after the Typora-parity command,
  Live table, workspace and localization changes.
- `bun run build`, `bun run release:check`, 33 Rust tests, `cargo fmt
  --check`, and Clippy with warnings denied passed locally.
- Apple Silicon final baseline: 1 MiB Live local-edit P50/P95 `6.77/8.00 ms`;
  10 MiB restricted-Live local-edit P50/P95 `0.10/0.57 ms`.
- A current macOS 26.6 WKWebView debug build was exercised through native
  per-key input with Apple Pinyin selected. Typing `n i h a o` produced the
  underlined `ni hao` preedit range and Space committed `你好`, proving the
  current branch's composition and commit path without Unicode value
  injection. The preedit and committed screenshots are stored in
  `docs/testing/evidence/`. A later full-screen capture on the current app
  executable (`a08e473a…`) shows underlined `hou xuan` and the native candidate
  strip anchored immediately below the active editor line. The archived PNG
  (`macos-apple-pinyin-candidate-2026-08-02.png`, SHA-256 `40e9fc7e…`) closes
  the last macOS candidate-placement gap.

- `bun run test`: 51 files / 351 tests passed after P7 integration.
- `bun run build`: TypeScript and production Vite build passed.
- `bun run release:check`: mdtxt 0.1.0 identity/security checks, 465 Chinese keys across 109 source files, zero direct JSX/accessibility user-copy literals, and documentation build passed.
- `cargo fmt --check`, Clippy with warnings denied, and 32 Rust tests passed.
- Parser/state baseline on Apple M4: 1 MiB local edit P95 0.36 ms; 10 MiB local edit P95 0.35 ms. This remains supporting evidence, not a native substitute.

## Native platform evidence

| Platform | Candidate and method | Performance | IME and interaction result |
| --- | --- | --- | --- |
| macOS 26.6 / WKWebView / Apple Silicon | Current working tree, app SHA-256 `a08e473a496fcbabd231d6d2978c58f791f1869c0ffe8f53b378cd9db038a1ba`; Apple Pinyin – Simplified; physical keyboard and full-screen capture | Current 1 MiB / 10 MiB baselines recorded above | Current-tree `ni hao` composition committed `你好`; current-app `hou xuan` preedit displayed its candidate strip directly below the active editor line; archived evidence SHA-256 `40e9fc7e…` |
| macOS 26.5.2 / WKWebView / Apple M4 | Commit `007843b`, Debug app SHA-256 `0d21df9b078036cad6ed86a13ca6b02652295c62354660fa4eb0d56399774235`; Apple Pinyin – Simplified | Local parser/state baseline recorded above | `anquanceshi` committed `安全测试`; Live committed `完成`; candidate window stayed below the caret; selection/clipboard, undo/redo, mode and tab round trips passed |
| Windows / WebView2 / Microsoft Pinyin | [CI `29946140453`](https://github.com/jincaiw/mdtxt/actions/runs/29946140453), job `89011866641`, commit `6ac73e0`; native Win32 `SendInput` and TSF | 1 MiB input P50/P95/max `0/0.1/0.1 ms`; 10 MiB Source `71.9 ms`; restricted Live `10.8 ms` | Source committed `中文`; 12 composition events; Live committed a second Chinese run; clipboard, undo/redo, mode/tab round trip passed. Preedit artifact `8540422494` shows Microsoft Pinyin candidates |
| Ubuntu 24.04 / WebKitGTK / Fcitx5 Pinyin | [CI `29946140453`](https://github.com/jincaiw/mdtxt/actions/runs/29946140453), job `89011866563`, commit `6ac73e0`; X11 `xdotool`/XTEST | 1 MiB input P50/P95/max `0/0/0 ms`; 10 MiB Source `48 ms`; restricted Live `6 ms` | Source committed `中文`; Live produced two Chinese runs; clipboard, undo/redo, mode/tab round trip passed. Preedit artifact `8540348396` shows the Fcitx5 candidate list |

## Exit and rollback record

At the historical P6 gate, all required platforms were below the performance
ceilings and no P0 input defect was reproduced; Live was still an opt-in Beta
and Source was the default. The current Typora-parity candidate is Live-first,
keeps Source immediately available, and restricts oversized documents without
changing their content. Reverting the isolated Live compartment/extensions
still requires no document-data migration.

The next native candidate must rerun the same matrix after changes to CodeMirror ownership, Widget focus behavior, IME helpers, or large-document admission. Missing future evidence must be recorded as unverified rather than inferred from this run.
