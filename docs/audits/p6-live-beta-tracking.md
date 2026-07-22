# P6 Live Beta Requirement Tracking

Status: **accepted as an explicit, default-off Live Beta on macOS, Windows, and Ubuntu. This does not authorize making Live the default.**

## Requirement traceability

| Requirement | Evidence | Result |
| --- | --- | --- |
| Source-preserving Live syntax | `src/editor/live/liveMarkdownPresentation.ts`, `src/test/fixtures/markdown/live-beta.md`, `src/test/liveBetaRoundTrip.test.ts` | Lezer/CodeMirror decorations preserve the exact Markdown source and undo history |
| Focus, selection, and composition | `src/editor/live/editFocusResolver.ts`, native Pinyin/Fcitx5 jobs | Composition, multi-selection, clipboard, undo/redo, mode changes, and tab changes retain Source fallback |
| Explicit Beta gate | persistence, settings, `ModeToggle`, session tests | Live is hidden and disabled by default; disabling it returns every session to Source |
| Restricted Live | `src/editor/live/liveEligibility.ts`, `CodeEditor` disclosure | Large/complex documents retain editable Source geometry and show the downgrade reason |
| Native performance | mdtxt-owned CI run `29946140453`, commit `6ac73e0` | Windows and Ubuntu meet the 1 MiB input and 10 MiB Source/restricted-Live budgets |
| Native Chinese IME | macOS manual record plus CI artifacts `8540422494` and `8540348396` | Apple Simplified Pinyin, Microsoft Pinyin, and Fcitx5 Pinyin passed; Japanese IME is outside 0.1.0 scope |

## Current automated evidence

- `bun run test`: 51 files / 351 tests passed after P7 integration.
- `bun run build`: TypeScript and production Vite build passed.
- `bun run release:check`: mdtxt 0.1.0 identity/security checks, 465 Chinese keys across 109 source files, zero direct JSX/accessibility user-copy literals, and documentation build passed.
- `cargo fmt --check`, Clippy with warnings denied, and 32 Rust tests passed.
- Parser/state baseline on Apple M4: 1 MiB local edit P95 0.36 ms; 10 MiB local edit P95 0.35 ms. This remains supporting evidence, not a native substitute.

## Native platform evidence

| Platform | Candidate and method | Performance | IME and interaction result |
| --- | --- | --- | --- |
| macOS 26.5.2 / WKWebView / Apple M4 | Commit `007843b`, Debug app SHA-256 `0d21df9b078036cad6ed86a13ca6b02652295c62354660fa4eb0d56399774235`; Apple Pinyin – Simplified | Local parser/state baseline recorded above | `anquanceshi` committed `安全测试`; Live committed `完成`; candidate window stayed below the caret; selection/clipboard, undo/redo, mode and tab round trips passed |
| Windows / WebView2 / Microsoft Pinyin | [CI `29946140453`](https://github.com/jincaiw/mdtxt/actions/runs/29946140453), job `89011866641`, commit `6ac73e0`; native Win32 `SendInput` and TSF | 1 MiB input P50/P95/max `0/0.1/0.1 ms`; 10 MiB Source `71.9 ms`; restricted Live `10.8 ms` | Source committed `中文`; 12 composition events; Live committed a second Chinese run; clipboard, undo/redo, mode/tab round trip passed. Preedit artifact `8540422494` shows Microsoft Pinyin candidates |
| Ubuntu 24.04 / WebKitGTK / Fcitx5 Pinyin | [CI `29946140453`](https://github.com/jincaiw/mdtxt/actions/runs/29946140453), job `89011866563`, commit `6ac73e0`; X11 `xdotool`/XTEST | 1 MiB input P50/P95/max `0/0/0 ms`; 10 MiB Source `48 ms`; restricted Live `6 ms` | Source committed `中文`; Live produced two Chinese runs; clipboard, undo/redo, mode/tab round trip passed. Preedit artifact `8540348396` shows the Fcitx5 candidate list |

## Exit and rollback record

P6 exits with all required platforms below the performance ceilings and no reproduced P0 input defect. Live remains an opt-in Beta, Source remains immediately available, and restricted Live never changes the document or persistent default. Reverting the isolated Live compartment/extensions removes the feature without migrating document data.

The next native candidate must rerun the same matrix after changes to CodeMirror ownership, Widget focus behavior, IME helpers, or large-document admission. Missing future evidence must be recorded as unverified rather than inferred from this run.
