# Changelog

All notable changes to Paperling will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.32] - 2026-06-18

## [1.0.31] - 2026-06-18

## [1.0.30] - 2026-06-18

### Changed

- The "What's new" update popup now shows a concise summary of just the latest
  release's changes, instead of the full changelog history.

## [1.0.29] - 2026-06-18

### Added

- **Fullscreen mode (F11)** for distraction-free writing on Windows, Linux, and
  macOS. The title bar stays visible so there is always an obvious way out, with
  a one-time hint. Also available from the command palette.
- **Automatic updates.** Paperling checks for new versions on launch and offers
  a one-click update when a newer version is available. Update packages are
  signed and verified before installing.
- **Enable AI toggle** (Settings → AI). Turning AI off hides every AI surface:
  the title-bar button, the side panel, the toolbar sparkle, Alt+J, and the
  command palette entry.
- **Visual table editor.** A floating toolbar appears inside a Markdown table to
  insert or delete rows and columns, set per-column alignment, and re-align the
  layout.
- **Chemistry notation in math.** KaTeX now renders `\ce{...}` and `\pu{...}`
  (mhchem), with a `/chem` slash command to insert a starter snippet.
- **Document statistics** dialog — words, characters, sentences, paragraphs,
  headings, links, images, code blocks, and reading time.
- **Word wrap** and **spell check** toggles in Settings → Editor.
- **Selected word count** in the status bar, plus command-palette actions to
  reveal the current file in its folder and copy its path.

### Changed

- **Relicensed to Apache 2.0** — free for personal and commercial use, with an
  explicit patent grant.
- **Works fully offline.** All fonts and the icon set are now bundled, so the
  editor looks identical online and offline, and HTML export no longer depends
  on Google Fonts.
- **Book-style math typography** — display equations are centered with proper
  spacing and scroll horizontally on narrow screens instead of overflowing.

### Fixed

- List bullets and numbers render in the preview again.
- Ctrl+S / Ctrl+O / Ctrl+N / Ctrl+E now work with CapsLock on.
- Clicking a heading's anchor link copies a section link and confirms with a
  checkmark.
- Alt+J reliably opens the AI panel on Windows, where WebView2 had reserved
  Ctrl+J for its Downloads UI.
- The caret no longer drifts off the text after scrolling large documents.
- Clearer file-operation error messages (for example "File too large") instead
  of generic failures.
- Security hardening across file, image, AI, and wikilink handling: size limits,
  filename and path-traversal sanitizing, an AI request timeout and response
  cap, and a tightened Content Security Policy.

### Removed

- Retired dead auto-save / focus-mode storage helpers left over from 0.6.1.

### Performance

- Faster cold start and a much smaller initial bundle — the welcome screen no
  longer loads the markdown, export, or dialog code until it is needed — plus
  smoother typing and scrolling on large documents.

## [0.6.1] - 2026-04-30

### Fixed

- "This file was deleted or moved" banner appearing on every opened file (false positive in mtime polling) — feature removed
- Outline panel: scrolling broken and last item bleeding into status bar (missing `flex flex-col` + `min-h-0` chain on the panel)
- TOC links inside markdown body (e.g. `[Q1](#q1)`) not navigating to their headings — explicit click handler added with fuzzy heading-text fallback for non-matching slugs
- New File button doing nothing visible — `hasFile` now considers a blank `Untitled.md` buffer as "open"
- Command palette on the welcome screen exposing Save / Save As / view toggles that wouldn't work without a buffer

### Removed

- Auto-save toggle (UI removed from Settings dropdown, Settings modal, command palette, status bar)
- Focus-mode dimming of non-active editor lines — all lines now render at full opacity (typewriter mode kept)
- External-change polling that was watching the open file's mtime

### Changed

- Wikilink resolution and recent-file existence checks use the existing `get_file_info` Rust command instead of the fs plugin's `stat`

## [0.6.0] - 2026-04-29

### Added — Editor

- Tab / Shift+Tab indent (multi-line aware)
- Auto-pair for `()`, `[]`, `{}`, `` ` ``, `""`, `''` — wraps selection or inserts pair, type-past closer, atomic backspace
- Enter continues lists, blockquotes, and task items
- Markdown formatting shortcuts: Ctrl+B / Ctrl+I / Ctrl+K / Ctrl+/
- Find & Replace (Ctrl+F / Ctrl+H) with regex, case-sensitive, match counter
- Slash commands `/` with 13 block transformations
- Smart paste: URL → link, plain URL → autolink, rich HTML → markdown (Turndown), TSV → GFM table
- Tab navigation inside markdown tables (skips separator, creates rows)
- Formatting toolbar above editor (toggleable)
- Focus mode (dim non-active lines)
- Typewriter mode (caret stays vertically centered)
- Active-line highlight in editor and gutter

### Added — Preview

- Code blocks have a hover-revealed Copy button
- Headings get GitHub-style stable slug IDs and clickable anchor links
- Click-to-zoom image lightbox
- Lazy image loading
- Interactive task checkboxes — toggling writes back to source
- KaTeX math rendering (`$inline$`, `$$block$$`) — lazy-loaded
- Mermaid diagrams (` ```mermaid `) — lazy-loaded
- YAML frontmatter parsed and rendered as a collapsible, editable Properties card
- Wikilinks `[[Foo]]` and `[[Foo|alias]]` clickable in preview

### Added — App

- Split view (Ctrl+\\) with draggable, keyboard-resizable divider
- Bidirectional scroll sync between editor and preview in split mode
- Restore last opened file on launch
- View mode and split ratio persist across sessions
- Recent files list on welcome screen with parent folder, time-ago, remove button; missing files struck through
- New File (Ctrl+N) and Save As (Ctrl+Shift+S)
- External-change detection — banner offers Reload/Keep mine when the file is modified outside MarkLite
- Auto-save toggle (1.5s debounce) with status chip in StatusBar
- Command palette (Ctrl+P) with fuzzy ranking — searches commands, files, headings, toggles
- Settings modal (Ctrl+,) with sidebar navigation and search
- Keyboard cheatsheet modal (`?`)
- Outline pane highlights the heading the cursor is in; filter input for large docs
- AI assist scaffold (Ctrl+J) — Rewrite / Shorten / Expand / Continue / Translate via configurable OpenAI-compatible endpoint (Ollama, llama.cpp, OpenAI, etc.)
- Reading time and character count in StatusBar

### Fixed

- Caret no longer drifts vertically between the textarea and syntax-highlight overlay (font metric alignment, empty-line rendering, rAF-driven scroll sync)
- Paper theme `--text-muted` darkened to pass WCAG AA contrast
- Sidebar panels (FileExplorer, TableOfContents) now trap focus
- Toast errors announce as `role="alert"` / `aria-live="assertive"`
- `prefers-reduced-motion` is respected globally

### Changed

- Visible focus rings on all interactive elements (keyboard focus only)
- Design tokens for radius and spacing in `:root`
- StatusBar replaces inert "UTF-8" with icons next to word count and reading time
- TitleBar shows a hint when no file is open
- Welcome screen lists New File alongside Open File and surfaces Ctrl+P / `?` hints

### Removed

- The hidden off-screen markdown renderer used for export — capture happens directly from the visible preview now

## [0.5.1] - 2026-01-XX

### Added

- Error boundary
- Unsaved-changes protection on close
- Loading state during file open

## [0.1.0] - 2025-01-01

### Added

- Initial release of MarkLite
- Clean markdown preview with live rendering
- Code editor with syntax highlighting
- Three themes: Dark, Light, and Paper
- Five font options: Inter, Merriweather, Lora, Source Serif, Fira Sans
- Three font sizes: Small, Medium, Large
- Keyboard shortcuts (Ctrl+O, Ctrl+S, Ctrl+E)
- Cross-platform support (Windows, macOS, Linux)
- Custom titlebar with window controls
- Settings menu for theme and font customization
- Drag and drop support for markdown files
- Auto-save indicator in status bar
