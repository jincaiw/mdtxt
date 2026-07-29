# mdtxt Roadmap

mdtxt is a local-first Markdown editor. This roadmap is directional rather than
a promise; the safety of local documents and a reliable native experience take
priority over feature count.

## Shipped in v0.4.0

- Graduate Live from Beta to the default source-preserving editor, with a safe
  Source fallback for documents above published Live limits.
- Replace flat directory browsing with a rooted, lazy workspace tree and
  recoverable native file operations.
- Complete the high-frequency authoring loop: `[TOC]`, local image asset paths,
  plain-text paste and interactive Live task markers.

## Shipped in v0.3.0

- The desktop workspace adapts between a resizable three-column layout and
  narrow-window overlays, with shared Files/Outline navigation and docked AI.
- Focus mode, collapsible outline hierarchy, and quieter single-document chrome
  keep the document visually primary.
- Inactive Live complex blocks render in place and restore their exact Markdown
  source on click, Enter, or F2 without changing the CodeMirror document.

## Shipped in v0.2.3

- A single command model powers native menus, keyboard shortcuts, the command
  palette and editor formatting actions.
- Live Beta now presents inactive Markdown as a document while preserving the
  original source, selection, undo history and Source fallback.
- macOS uses native traffic lights in an Overlay title bar; Windows and Linux
  use their system title bars and window controls.
- Recovered unsaved drafts keep full tab-keyboard reachability, including
  direct tab selection and cycling shortcuts.

## Next

- Gather broader Live Beta feedback before considering it as the default mode.
- Add Developer ID signing/notarization for macOS and code signing for Windows
  before any trusted installer or updater channel.
- Improve accessible keyboard navigation and native-package installation
  coverage on supported desktop environments.

## Later

- Optional package-manager distribution after signed, repeatable releases.
- Additional document workflows only when they keep Markdown as the portable,
  user-owned source of truth.

## Release policy

Windows x64, Ubuntu LTS x64 and macOS Apple Silicon are the supported targets.
v0.3.0 is a GA release by product-owner decision, but it remains unsigned and
the in-app updater stays disabled until mdtxt owns signing credentials and an
update endpoint.
