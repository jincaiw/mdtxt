# P10a Platform Build and Evidence Tracking

Status: **mdtxt-owned macOS, Windows and Ubuntu 0.1.0 Debug package builds
exist; no functional acceptance is inferred from package compilation alone.**

## Current evidence

| Target | Build / launch evidence | Functional evidence | Status |
| --- | --- | --- | --- |
| macOS 26.5.2 arm64 | At `38ca14e`, `bun run tauri build --debug` produced the regular `mdtxt.app` and arm64 DMG. The latest mdtxt-owned [`Platform Evidence Build #29433752750`](https://github.com/jincaiw/mdtxt/actions/runs/29433752750), commit `3d868a6`, uploads both `mdtxt.app` and `mdtxt_0.1.0_aarch64.dmg`; the downloaded DMG SHA-256 is `bedf9c5be0974b28e2936c4aa4a3e9b2f2ed0b871b6c00134cae9088bd1f7d80`, matching its ARM64 manifest for `mdtxt` / `app.mdtxt.desktop` / `0.1.0` | P8 AC-007 two-draft force-terminate/relaunch recovery observed in the isolated WKWebView build; details are recorded in P8 tracking. P6 IME and P8 filesystem matrix remain separate | Build and a limited P8 native smoke present; P6/P8 not accepted |
| Windows x64 | Latest mdtxt-owned [`Platform Evidence Build #29433752750`](https://github.com/jincaiw/mdtxt/actions/runs/29433752750), commit `3d868a6`, uploaded `mdtxt_0.1.0_x64_en-US.msi` (SHA-256 `f6054a4eaee7357db3de63cbe70523ce337aa5211492258a58d43ce17e865a4b`) and `mdtxt_0.1.0_x64-setup.exe` (SHA-256 `eeee9e3a337e54f7dca35580aec1aeac165a90b3355386768bde188d3469dce0`); downloaded-file hashes match the Windows/X64 manifest (`mdtxt`, `app.mdtxt.desktop`, `0.1.0`) | No artifact installation, recovery UI, or Microsoft Pinyin result; NTFS fixture CI remains a separate P8 record | Debug package evidence present; functional acceptance pending |
| Ubuntu LTS x64 | `.github/workflows/ci.yml` is fixed to Ubuntu 24.04. The mdtxt-owned [`Platform Evidence Build #29478008425`](https://github.com/jincaiw/mdtxt/actions/runs/29478008425), commit `fbf1b22`, completed all three jobs and uploaded the Ubuntu Debug app, DEB and AppImage evidence set. The workflow intentionally excludes RPM because the upstream RPM packager stalled until the 30-minute job timeout while the app and DEB had already completed; 0.1.0 does not claim RPM delivery. | The Docker attempt remains non-creditable; CI native smoke and package compilation are not installation, IME or recovery passes | Debug package evidence present; functional acceptance pending |

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
