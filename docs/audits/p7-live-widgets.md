# P7 Live Widget Evidence

Status: **P7 accepted. All eight source-preserving Widgets passed the native
Ubuntu WebKit viewport gate and exact Source round trip.**

## Independent delivery slices

| Widget | Commit | Recognition and renderer | Failure / rollback behavior |
| --- | --- | --- | --- |
| Image | `7c7a6b1` | Lezer `Image`; data URI or Rust-bounded local relative image read with shared 100-entry LRU Blob cache | Unsafe, remote, absolute, traversal, or failed reads show a local fallback while Markdown remains editable |
| Fenced code | `a38146f` | Lezer `FencedCode`; text-only DOM construction and explicit language label | Unknown languages stay plain text; no HTML injection |
| Frontmatter | `6f04931` | Bounded first-200-line `---` envelope plus existing lossless subset parser | Invalid/unclosed metadata remains source and produces no Widget |
| Table | `1086b84` | Lezer GFM `Table` plus the existing source-compatible table model | Malformed/unknown table source remains editable; table commands still operate on Markdown |
| Math | `55e9784` | Bounded 100-line display-math block; KaTeX dynamically imported with `strict=error`, `trust=false`, 64-entry cache | Rendering failure shows a source-edit fallback; async completion is ignored after Widget destruction |
| Mermaid | `ca4457c` | Lezer Mermaid fence; shared dynamic renderer with `securityLevel=strict`, theme/source cache | Rendering failure preserves and points back to source; stale/unmounted results are discarded |
| Footnote | `36e0f66` | Lezer paragraph/reference boundary plus local `[^label]:` extraction | Unknown link/reference syntax is untouched |
| Callout | `5cd30b0` | Lezer `Blockquote`; local allowlist for NOTE/TIP/IMPORTANT/WARNING/CAUTION | Unknown callout types remain ordinary blockquote source |

## Shared safety and performance contract

- Widgets are CodeMirror viewport plugins and never become React document state.
- Every Widget is appended after its source block. `Decoration.replace` is not used, so Source remains visible and selectable.
- A Widget is omitted when composition is active or a selection touches its source range.
- Document changes, selection/focus changes, and viewport changes rebuild only the current visible decoration set.
- Image, KaTeX, and Mermaid work is lazy; caches are bounded; destroyed Widgets reject late DOM writes.
- The eight behavior changes are separate commits and can be reverted independently.

## Verification

- `src/components/CodeEditor.test.tsx` covers all eight Widget types, exact `EditorState.doc` preservation, explicit Live enablement, and Source fallback.
- `src/utils/localImage.test.ts` covers traversal/absolute-path rejection, Windows/POSIX base directories, and bounded MIME selection.
- `bun run test`: 51 files / 353 tests passed.
- `bun run build` and `bun run release:check` passed.
- Commit `a71cea8`, [CI `29954555501`](https://github.com/jincaiw/mdtxt/actions/runs/29954555501), native Ubuntu job `89040211517` scrolled each source block through the real WebKit/CodeMirror viewport and recorded `MDTXT_NATIVE_P7 platform=ubuntu widgets=8 liveActivationMs=1155... mermaid=passed sourceRoundTrip=passed`.

## Exit decision

P7 is accepted for 0.1.0. Live remains Beta and restricted Live continues to
omit every complex Widget for oversized documents; Source remains the default
and rollback path.
