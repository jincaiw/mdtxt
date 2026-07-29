# Changelog

All notable mdtxt changes are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.2] - 2026-07-30

- Release every platform package as a plainly named `-unsigned` artifact; the
  workflow does not run macOS code signing or notarization, nor Windows
  Authenticode signing.

## [0.4.1] - 2026-07-29

- Fixed native recovery and performance acceptance probes to explicitly enter Source before exact Markdown input, while preserving Live as the default editor.

## [0.4.0] - 2026-07-29

- Live is the default stable editor mode; the opt-in Beta gate has been removed while Source, Reader, Split and large-document Source fallback remain available.
- Added rooted workspace tree operations with containment checks, no-overwrite moves, system Trash and open-tab path remapping.
- Added standalone `[TOC]` rendering in Live and preview/export HTML, safe relative image asset directories and plain-text paste shortcut.

## [0.3.0] - 2026-07-29

### Added

- A content-first desktop workspace with a shared Files/Outline navigation
  rail, docked AI panel, persisted resizable panel widths, responsive overlays,
  and a distraction-free Focus mode (`F8`).
- Collapsible outline hierarchy with active-heading follow and keyboard
  expand/collapse controls.

### Changed

- Live Beta complex blocks now project the rendered image, code, metadata,
  table, math, Mermaid, footnote, or callout in place of inactive Markdown.
  Clicking a projection (or pressing Enter/F2) restores its exact source for
  editing; `EditorState.doc`, selection, undo, and Source fallback remain
  authoritative.
- Single-document chrome is quieter: the tab strip appears only when multiple
  documents are open, and compact title-bar controls preserve document width.

### Security

- v0.3.0 is a public GA release with ad-hoc macOS bundle signing and unsigned
  Windows packages. Automatic updates remain disabled until mdtxt owns signing
  credentials and a verified update endpoint.

## [0.2.3] - 2026-07-28

### Fixed

- Recovered drafts on Windows now expose standard tab activation semantics to
  UI Automation and other assistive technologies, with package-level coverage
  for every restored tab; previous/next tab commands are also available from
  the native Window menu without WebView2-reserved shortcut paths.
- The welcome screen now reads the current package version instead of showing
  a stale 0.1.0 label, and no longer duplicates the product name in the title
  bar when no document is open.

## [0.2.2] - 2026-07-28

### Fixed

- Release candidate retained as an unpublished draft after its Windows
  installed-package shortcut verification did not pass.

## [0.2.1] - 2026-07-28

### Fixed

- Restored unsaved drafts now remain reachable through the documented tab
  shortcuts (Ctrl+1…9, Ctrl+Tab, Ctrl+PageUp/Down, and Alt+Left/Right) instead
  of treating a missing file path as the absence of a tab.

### Security

- v0.2.1 is a GA release that remains unsigned: macOS uses ad-hoc
  bundle-integrity signing, Windows packages are unsigned, and automatic
  updates remain disabled.

## [0.2.0] - 2026-07-26

### Added

- Unified commands for native menus, the command palette, keyboard shortcuts
  and formatting controls, including a complete Chinese/English menu surface.
- Native desktop window chrome: macOS Overlay traffic lights, and system title
  bars and controls on Windows and Linux.
- Typora-style Live Beta presentation for inactive Markdown while keeping the
  Markdown document, selections and undo history intact.

### Changed

- Window titles now follow the active filename and unsaved state.
- Fullscreen state follows the native window, including macOS traffic-light and
  menu changes.
- Live remains opt-in Beta; Source remains the default editing mode.

### Security

- v0.2.0 is an unsigned prerelease. macOS uses ad-hoc bundle-integrity signing,
  Windows packages are unsigned, and automatic updates remain disabled.

## [0.1.0] - 2026-07-15

### Added

- Independent `mdtxt` desktop identity, isolated application data, Simplified
  Chinese default interface, and complete English alternate interface.
- Source, opt-in Live Beta, Split, and Reader workspaces using the Paper palette
  and a compact low-distraction desktop layout.
- Versioned per-tab document sessions, external-change comparison, atomic saves,
  verified crash recovery, and visible post-replacement durability warnings.
- Optional AI assistance with OS-keychain-only secrets, explicit opt-in,
  cancellable native requests, bounded context, and review-before-apply edits.
- HTML, native PDF, and DOCX export with safe HTML cleanup and independent
  document metadata-language selection.
- Windows x64, Ubuntu LTS x64, and macOS Apple Silicon preview packages with
  aggregate checksums, SPDX SBOM, and third-party dependency inventory.

### Security

- Automatic updates remain disabled until mdtxt owns a signed update endpoint.
- Release builds enforce a strict CSP, exclude the debug automation bridge,
  reject plaintext AI-key storage, and keep untrusted HTML/Mermaid sanitized.

### Known preview limitations

- Packages are unsigned/not notarized and are published as a prerelease, not GA.
- Live remains an explicitly enabled Beta; Japanese IME is outside the 0.1.0 scope.
- Linux PDF export uses the system print dialog.

## Upstream history

mdtxt was derived from Paperling. Paperling's historical release notes are not
mdtxt releases and are intentionally not mixed into this changelog. Attribution
and license notices remain in [NOTICE](NOTICE).
