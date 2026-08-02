# Desktop UI A3 Acceptance Baseline

Status: approved by the product owner on 2026-07-16 and reconfirmed as the
unique implementation baseline on 2026-07-18.

2026-08 Typora-parity amendment: the desktop hierarchy is now Live-first.
Source Code Mode is a direct `Ctrl/Cmd+/` escape hatch; Split and Reader remain
mdtxt extensions in the command palette instead of permanent title-bar mode
controls. This amendment supersedes the older title-bar-mode wording below.

The accepted desktop direction is the final A3 concept set:

- A3-1 primary workspace: welcome, Live editor, Source escape hatch, Articles/file tree, outline and optional AI panel; Split and Reader are secondary extensions.
- A3-2 settings and navigation: Appearance, Editor, AI, About, quick settings, command palette, global search, statistics and shortcuts.
- A3-3 editing tools and guidance: welcome tour, find/replace, preview find, slash menu, table tools, AI selection/review, export and tab context menu.
- A3-4 file safety and system states: conflicts, recovery, unsaved tabs/windows, durability warnings, loading, toasts, recoverable errors and drag-to-open.

## Visual contract

- Use the warm Paper palette by default while preserving all selectable themes.
- Use a Typora-like, low-distraction document hierarchy; do not copy Typora assets, branding or pixel geometry.
- Keep the title bar document-focused. Expose Source, Articles, file tree,
  outline, focus and typewriter modes through the native View menu and their
  Typora-compatible shortcuts; keep Split and Reader in the command palette.
- Use compact neutral line icons, restrained borders and a centered reading column.
- Do not display upstream Paperling mascots or promotional artwork in desktop UI states.
- Keep Simplified Chinese as the default complete UI and English as the complete alternate UI. Japanese IME is outside the 0.1.0 support scope.

## Implementation evidence

| Surface | Implementation | Automated or runtime evidence |
| --- | --- | --- |
| Default palette | `src/context/ThemeContext.tsx` | `src/context/ThemeContext.test.tsx` |
| Document-focused title bar | `src/components/TitleBar.tsx` | `src/components/TitleBar.test.tsx`; browser and macOS WKWebView smoke |
| Source / Split / Reader | `src/App.tsx`, `src/components/CodeEditor.tsx`, `src/components/MarkdownPreview.tsx` | browser interaction smoke; full Vitest suite |
| Live Beta surface | `src/editor/live/liveMarkdownPresentation.ts` | Live compartment tests, round-trip tests and browser smoke |
| Navigation and empty states | `FileExplorer.tsx`, `TableOfContents.tsx`, `AIPanel.tsx` | browser interaction smoke; production bundle contains no mascot artwork |
| Settings and tools | `SettingsModal.tsx`, `Tour.tsx`, `ShortcutCheatsheet.tsx`, `StatsDialog.tsx`, `ExportMenu.tsx` | TypeScript production build and full Vitest suite |
| File-safety states | recovery, conflict, unsaved and toast components | component tests plus native recovery smoke |
| Offline iconography | `src/assets/fonts/material-symbols-mdtxt.ttf`, `src/fonts.ts` | production bundle integrity test; local font only |

## Live safety boundary

The accepted concept shows collapsed Markdown delimiters in inactive Live lines.
The original 0.1.0 implementation retained complex-block source beside its
Widget while P6c native Chinese IME, selection, clipboard and undo/redo gates
were still open. Those gates later passed on all three supported platforms.

The current unreleased implementation completes that visual contract with
source-backed `Decoration.replace` projections. A projection is removed when
its source range receives the selection, and click, Enter or F2 moves the
selection back into that exact range. The CodeMirror document remains unchanged
and Source mode remains the immediate `Ctrl/Cmd+/` rollback path. Local component
tests and the production build cover this implementation; fresh native-package
acceptance is still required before release assignment.

## 2026-07-29 workspace implementation update

- `src/components/WorkspaceSidebar.tsx` unifies Files and Outline in one
  persisted, resizable navigation surface.
- `src/components/AIPanel.tsx` is a docked third column on wide windows and an
  overlay on narrower windows; editor content remains the flexible center.
- `src/components/TableOfContents.tsx` supports collapsible hierarchy,
  active-heading follow and keyboard expansion.
- `src/components/SplitDivider.tsx` switches Split mode to a vertical document
  flow on narrow windows.
- `src/App.tsx` and the native View menu expose Focus mode with `F8`, temporarily
  hiding navigation, tabs, toolbar and AI without discarding their state.
