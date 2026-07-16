# P10a Platform Build and Evidence Tracking

Status: **mdtxt-owned macOS, Windows and Ubuntu 0.1.0 Debug package builds
exist; no functional acceptance is inferred from package compilation alone.**

## Current evidence

| Target | Build / launch evidence | Functional evidence | Status |
| --- | --- | --- | --- |
| macOS 26.5.2 arm64 | The A3-aligned mdtxt-owned [`Platform Evidence Build #29481051915`](https://github.com/jincaiw/mdtxt/actions/runs/29481051915), commit `99cc34b`, uploaded `mdtxt.app` and `mdtxt_0.1.0_aarch64.dmg`. The downloaded DMG SHA-256 is `855d245f03b1c5cf2dffe3252b41be526ca9994f231bce09bd83b071263db265`, matching its ARM64 manifest for `mdtxt` / `app.mdtxt.desktop` / `0.1.0` | P8 AC-007 two-draft force-terminate/relaunch recovery observed in the isolated WKWebView build; details are recorded in P8 tracking. P6 IME and P8 filesystem matrix remain separate | Build and a limited P8 native smoke present; P6/P8 not accepted |
| Windows x64 | [`Platform Evidence Build #29481051915`](https://github.com/jincaiw/mdtxt/actions/runs/29481051915), commit `99cc34b`, uploaded `mdtxt_0.1.0_x64_en-US.msi` (SHA-256 `c03e2057c48df76a30671fecaddc2f243fdbdbf8e1a15837dd5b27ac3b03d525`) and `mdtxt_0.1.0_x64-setup.exe` (SHA-256 `3d5b1b9f6be2c894e513de987fa1358fc1ff6381d5ff78cbcc526f77b7a42f1e`); downloaded-file hashes match the Windows/X64 manifest (`mdtxt`, `app.mdtxt.desktop`, `0.1.0`) | [`CI #29481353041`](https://github.com/jincaiw/mdtxt/actions/runs/29481353041) passed all four view modes. [`CI #29484168792`](https://github.com/jincaiw/mdtxt/actions/runs/29484168792) passed write-through replacement, long path, UNC and exclusive-lock checks; native jobs in [`CI #29483474768`](https://github.com/jincaiw/mdtxt/actions/runs/29483474768) passed recovery store/reload/dialog/restore. Package installation and Microsoft Pinyin remain outside this evidence | Debug package, view-mode, file-boundary and automated recovery evidence present; P6/manual package acceptance pending |
| Ubuntu LTS x64 | `.github/workflows/ci.yml` is fixed to Ubuntu 24.04. [`Platform Evidence Build #29481051915`](https://github.com/jincaiw/mdtxt/actions/runs/29481051915), commit `99cc34b`, uploaded `mdtxt_0.1.0_amd64.deb` (SHA-256 `00dc5dcf642d96e17fae75dba39e11eefebe91bd9c1ebf3b1c509e49e61635cc`) and `mdtxt_0.1.0_amd64.AppImage` (SHA-256 `9792b9737abe09ffe85e15b02da12bdfedaa02aec398a949d058dcd7fa8bce0b`); both downloaded hashes match the Linux/X64 manifest. The workflow intentionally excludes RPM because its packager repeatedly stalled; 0.1.0 does not claim RPM delivery. | [`CI #29481353041`](https://github.com/jincaiw/mdtxt/actions/runs/29481353041) passed all four view modes. [`CI #29483474768`](https://github.com/jincaiw/mdtxt/actions/runs/29483474768) passed atomic/fault/symlink/long-path/directory-sync/advisory-lock checks and native recovery store/reload/dialog/restore. Package installation and IBus/Fcitx composition remain outside this evidence | Debug package, view-mode, file-boundary and automated recovery evidence present; P6/manual package acceptance pending |

## Remote boundary

On 2026-07-15, the checked-out `origin` was verified as
`https://github.com/jincaiw/Paperling.git`; it remains unchanged and its
workflows are not mdtxt evidence. The dedicated public remote
[`jincaiw/mdtxt`](https://github.com/jincaiw/mdtxt) now owns the cited commits,
workflow runs, and artifacts. Its package builds still do not substitute for
manual installation or P6/P8 functional evidence.

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
manual installation and the P6/P8 matrices remain separate acceptance work.
