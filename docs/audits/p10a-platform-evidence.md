# P10a Platform Build and Evidence Tracking

Status: **mdtxt-owned macOS, Windows and Ubuntu environments are complete for
the 0.1.0 prerelease evidence scope. Build, native WebView, IME, performance,
filesystem and installed-package recovery records remain separately identified.**

## Current evidence

| Target | Build / launch evidence | Functional evidence | Status |
| --- | --- | --- | --- |
| macOS 26.5.2 arm64 | mdtxt-owned `.app`/DMG with `mdtxt` / `app.mdtxt.desktop` / `0.1.0`; final production bundle uses full ad-hoc signing and passes strict deep verification | Apple Simplified Pinyin, 1/10 MiB editor paths, AC-007 force termination, real HTML/PDF/DOCX export, and simultaneous launch with installed Paperling passed | Accepted for unsigned prerelease; Developer ID/notarization remains GA-only |
| Windows x64 | mdtxt-owned MSI/NSIS/Portable builds; NTFS and loopback SMB fixtures | Microsoft Pinyin Source/Live, native performance, write-through replacement, long path, UNC, exclusive lock, production MSI force-kill recovery, denied-share UX, and WebView2 PDF bytes passed | Accepted for unsigned prerelease; final native job `89040211509` |
| Ubuntu 24.04 x64 | mdtxt-owned DEB/AppImage builds; RPM explicitly not claimed | Fcitx5 Pinyin, native performance, POSIX save semantics, production DEB SIGKILL recovery, eight Live Widgets and WebKitGTK system-print dialog passed | Accepted for unsigned prerelease; final native job `89040211517` |

## Remote boundary

On 2026-07-15, the checked-out `origin` was verified as
`https://github.com/jincaiw/Paperling.git`; it remains unchanged and its
workflows are not mdtxt evidence. The dedicated public remote
[`jincaiw/mdtxt`](https://github.com/jincaiw/mdtxt) now owns the cited commits,
workflow runs, and artifacts. Functional cells above cite native and installed
package execution; package compilation alone is not used as acceptance.

## Required record per target

For a creditable P10a cell, retain the commit SHA, OS version, architecture,
filesystem/WebView, package identifier and SHA-256, exact build/install/launch
command, raw result or logs, screenshots where UI is asserted, known failures,
and rollback point. CI compilation alone never closes P6 IME, P8 recovery, or
P8 filesystem semantics.

The ordinary CI gate and the manual `Platform Evidence Build` workflow use
the declared `macos-14` (GitHub-hosted ARM64), `windows-latest`, and
`ubuntu-24.04` targets. The manual workflow writes
`platform-evidence.json` beside each Debug bundle before uploading the private
artifact. A successful workflow only proves that the declared bundle was built;
P6/P8 functional acceptance is supplied by the separate native and installed-
package runs recorded above.

The final code candidate is commit `a71cea8`; all seven jobs in
[CI `29954555501`](https://github.com/jincaiw/mdtxt/actions/runs/29954555501)
passed on the declared mdtxt-owned targets.
