# P6 Live Beta Requirement Tracking

Status: **P6b implementation and automated gate complete; P6 Beta is not yet accepted**.

| Requirement | Evidence | Current status |
| --- | --- | --- |
| FR-EDIT / FR-MD minimal Live syntax | `src/test/fixtures/markdown/live-beta.md` plus `src/editor/live/liveMarkdownPresentation.ts` cover headings, emphasis, strike, inline code, links, quotes, lists, rules and tasks | Implemented as source-preserving visual styling; no marker hiding |
| Source/Live/Split byte preservation | `src/test/liveBetaRoundTrip.test.ts` asserts fixture identity; `src/components/CodeEditor.test.tsx` verifies Live decoration reconfiguration without host replacement | Source/Live editor contract automated; native Split and platform coverage pending |
| Lezer-only structural recognition | `@codemirror/lang-markdown`, `syntaxTree(state)` and `StateField<DecorationSet>` in `src/editor/live/liveMarkdownPresentation.ts` | Implemented; no regex parser |
| Focus, selection and composition source safety | `src/editor/live/editFocusResolver.ts` and the Live `ViewPlugin` | Multi-selection, caret, pointer/find extension points and IME composition share one conservative source-retention contract; native-WebView validation pending |
| Chinese IME safety | `docs/testing/p6-live-beta-ime-checklist.md` | Native WebView validation pending |
| 1 MiB / 10 MiB method | `bun run benchmark:live-editor` | Parser baseline recorded below; input-latency and native restricted-Live measurements pending |
| Restricted Live admission and disclosure | `src/editor/live/liveEligibility.ts`, `src/App.tsx`, `src/components/CodeEditor.tsx` | Implemented: UTF-8 bytes, line count, longest line and complex-block signals select low-cost Live and show the reason; source remains editable |
| Non-default and Source fallback | `src/utils/persistence.ts`, `src/components/SettingsModal.tsx`, `src/components/ModeToggle.tsx`, `src/App.tsx`, `resolveLiveBetaViewMode` | Live is opt-in, its entry is hidden while off, and disabling/restoring without consent returns to Source; component, persistence and session tests cover the gate and fallback |

## Latest automated evidence

| Scope | Command | Result |
| --- | --- | --- |
| P6b gate | `bun run test -- src/components/ModeToggle.test.tsx src/components/CodeEditor.test.tsx src/utils/documentSession.test.ts src/utils/persistence.test.ts src/editor/live/liveMarkdownPresentation.test.ts src/test/liveBetaRoundTrip.test.ts` | 6 files / 31 tests passed |
| Type and production build | `bun run build` | Passed |
| Product/i18n preflight | `bun run release:check` | Passed: mdtxt `0.1.0`, 410 Chinese keys / 93 source files, no direct user-copy literals |
| Focus protocol | `bun run test -- src/editor/live/editFocusResolver.test.ts src/editor/live/liveMarkdownPresentation.test.ts src/components/CodeEditor.test.tsx` | 3 files / 8 tests passed |
| Restricted Live UI | `bun run test -- src/components/CodeEditor.test.tsx src/editor/live/liveEligibility.test.ts` | 2 files / 7 tests passed |
| Lezer parser baseline | Apple M4, Darwin 25.5.0 arm64; `bun run benchmark:live-editor` | 1 MiB: 54.64 ms; 10 MiB: 408.74 ms; parser only, not a native input-latency pass |

## Open P6 blockers

1. P6c: native-WebView IME, selection, clipboard, undo/redo and mode/tab-switch evidence. The shared focus/composition resolver is implemented, but an unverified platform is not a pass.
2. P6d: measured native input latency and 10 MiB restricted-Live open evidence. Eligibility and visible downgrade state are implemented; parser-only timing is not a substitute.
3. P6e: accessibility review, real macOS/Windows/Linux evidence and final requirement/rollback record.

## Recording results

For each benchmark, record commit, machine model, OS/WebView, command output,
document size, and whether the run used a release candidate. For native IME,
use the table in the checklist. A missing platform result remains **unverified**,
not a pass.
