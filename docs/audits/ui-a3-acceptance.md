# Desktop UI A3 Acceptance Baseline

Status: approved by the product owner on 2026-07-16 and reconfirmed as the
unique implementation baseline on 2026-07-18.

The accepted desktop direction is the final A3 concept set:

- A3-1 primary workspace: welcome, Source, Live Beta, Split, Reader, file tree, outline and AI panel.
- A3-2 settings and navigation: Appearance, Editor, AI, About, quick settings, command palette, global search, statistics and shortcuts.
- A3-3 editing tools and guidance: welcome tour, find/replace, preview find, slash menu, table tools, AI selection/review, export and tab context menu.
- A3-4 file safety and system states: conflicts, recovery, unsaved tabs/windows, durability warnings, loading, toasts, recoverable errors and drag-to-open.

## Visual contract

- Use the warm Paper palette by default while preserving all selectable themes.
- Use a Typora-like, low-distraction document hierarchy; do not copy Typora assets, branding or pixel geometry.
- Keep view switching in the title bar and expose Source, opt-in Live Beta, Split and Reader as stable labelled controls.
- Use compact neutral line icons, restrained borders and a centered reading column.
- Do not display upstream Paperling mascots or promotional artwork in desktop UI states.
- Keep Simplified Chinese as the default complete UI and English as the complete alternate UI. Japanese IME is outside the 0.1.0 support scope.

## Implementation evidence

| Surface | Implementation | Automated or runtime evidence |
| --- | --- | --- |
| Default palette | `src/context/ThemeContext.tsx` | `src/context/ThemeContext.test.tsx` |
| Title-bar modes | `src/components/TitleBar.tsx`, `src/components/ModeToggle.tsx` | `src/components/ModeToggle.test.tsx`; browser and macOS WKWebView smoke |
| Source / Split / Reader | `src/App.tsx`, `src/components/CodeEditor.tsx`, `src/components/MarkdownPreview.tsx` | browser interaction smoke; full Vitest suite |
| Live Beta surface | `src/editor/live/liveMarkdownPresentation.ts` | Live compartment tests, round-trip tests and browser smoke |
| Navigation and empty states | `FileExplorer.tsx`, `TableOfContents.tsx`, `AIPanel.tsx` | browser interaction smoke; production bundle contains no mascot artwork |
| Settings and tools | `SettingsModal.tsx`, `Tour.tsx`, `ShortcutCheatsheet.tsx`, `StatsDialog.tsx`, `ExportMenu.tsx` | TypeScript production build and full Vitest suite |
| File-safety states | recovery, conflict, unsaved and toast components | component tests plus native recovery smoke |
| Offline iconography | `src/assets/fonts/material-symbols-mdtxt.ttf`, `src/fonts.ts` | production bundle integrity test; local font only |

## Live safety boundary

The accepted concept shows collapsed Markdown delimiters in inactive Live lines. The 0.1.0 implementation deliberately retains source delimiters until P6c native Chinese IME, selection, clipboard and undo/redo gates pass. This is the only approved visual deferral: it preserves the PRD's source-safety contract and does not remove or hide the Live Beta page. After P6c passes, delimiter collapsing may proceed as a separate reversible P7 change.
