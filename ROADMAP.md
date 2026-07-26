# mdtxt Roadmap

mdtxt is a local-first Markdown editor. This roadmap is directional rather than
a promise; the safety of local documents and a reliable native experience take
priority over feature count.

## Shipped in v0.2.0 preview

- A single command model powers native menus, keyboard shortcuts, the command
  palette and editor formatting actions.
- Live Beta now presents inactive Markdown as a document while preserving the
  original source, selection, undo history and Source fallback.
- macOS uses native traffic lights in an Overlay title bar; Windows and Linux
  use their system title bars and window controls.

## Next

- Gather broader Live Beta feedback before considering it as the default mode.
- Add Developer ID signing/notarization for macOS and code signing for Windows
  before any GA release or updater channel.
- Improve accessible keyboard navigation and native-package installation
  coverage on supported desktop environments.

## Later

- Optional package-manager distribution after signed, repeatable releases.
- Additional document workflows only when they keep Markdown as the portable,
  user-owned source of truth.

## Release policy

Windows x64, Ubuntu LTS x64 and macOS Apple Silicon are the supported preview
targets. Until mdtxt owns signing credentials and an update endpoint, releases
remain unsigned prereleases and the in-app updater stays disabled.
