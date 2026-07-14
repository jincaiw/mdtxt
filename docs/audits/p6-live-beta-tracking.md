# P6 Live Beta Requirement Tracking

Status: **precondition baseline established; Live UI not implemented or enabled**.

| Requirement | Evidence | Current status |
| --- | --- | --- |
| FR-EDIT / FR-MD minimal Live syntax | `src/test/fixtures/markdown/live-beta.md` enumerates headings, emphasis, strike, inline code, links, quotes, lists, rules and tasks | Fixture ready; renderer pending |
| Source/Live/Split byte preservation | `src/test/liveBetaRoundTrip.test.ts` asserts source identity before any decorator is introduced | Automated source baseline ready; mode parity pending |
| Lezer-only structural recognition | `@codemirror/lang-markdown` + `syntaxTree(state)` in the baseline test | Parser baseline ready; Live field pending |
| Chinese IME safety | `docs/testing/p6-live-beta-ime-checklist.md` | Native WebView validation pending |
| 1 MiB / 10 MiB method | `bun run benchmark:live-editor` | Method ready; machine-specific result pending |
| Non-default and Source fallback | No Live setting or rendering extension has been introduced | Satisfied at baseline |

## Recording results

For each benchmark, record commit, machine model, OS/WebView, command output,
document size, and whether the run used a release candidate. For native IME,
use the table in the checklist. A missing platform result remains **unverified**,
not a pass.
