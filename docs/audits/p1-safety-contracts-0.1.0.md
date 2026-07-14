# mdtxt 0.1.0 P1 Safety Contracts

Date: 2026-07-15  
Scope: regression contracts added before product identity and editor-state migration.

## Contract coverage

| Risk | Evidence |
| --- | --- |
| GFM, math, Mermaid, images, unknown syntax and raw HTML | `src/test/fixtures/markdown/` plus `markdownFixtures.test.ts` |
| Large document behavior without checked-in user data | deterministic exact-size 1 MiB and 10 MiB generator |
| UTF-8 BOM, CRLF and trailing newline no-change save | Rust byte round-trip test in `commands.rs` |
| React bridge replacing an entire CodeMirror document | `minimalTextChange` unit tests and CodeEditor integration |
| Future per-tab undo isolation | independent `EditorState` history contract |
| Autosave and external-edit detection | existing hook tests retained in the full suite |
| Saved-tab restoration sanitization | persistence tests for session round-trip and malformed values |
| Chinese IME composition | native manual checklist in `docs/testing/p1-safety-checklist.md` |
| Version consistency | existing `scripts/release-preflight.mjs` checks package, Tauri and Cargo versions |
| Direct user-copy inventory | `bun run check:user-copy`; reports during P1, enforces after P3 migration |

## Intentional limits

- The present reader normalizes line endings before CodeMirror. The P1 test
  proves its current no-change behavior; P8 will move BOM, EOL and trailing
  newline into explicit document format metadata and retain byte-level testing.
- Native IME composition cannot be truthfully validated in jsdom. It remains a
  release-blocking platform smoke item rather than a simulated E2E claim.
- The user-copy scanner is deliberately an inventory at this stage. Existing
  Paperling literals must be translated under P3 before `--enforce` can enter
  CI without masking regressions.
