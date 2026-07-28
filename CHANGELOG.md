# Changelog

All notable mdtxt changes are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.3] - 2026-07-28

### Fixed

- Recovered drafts on Windows now have package-level accessibility selection
  coverage for every restored tab; keyboard focus/Enter behavior remains
  covered at the TabBar boundary, and previous/next tab commands are available
  from the native Window menu without WebView2-reserved shortcut paths.

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
