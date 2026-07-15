# P10a Platform Build and Evidence Tracking

Status: **mdtxt-owned remote and macOS/Windows 0.1.0 Debug package evidence
exist; no functional acceptance is inferred from package compilation alone.**

## Current evidence

| Target | Build / launch evidence | Functional evidence | Status |
| --- | --- | --- | --- |
| macOS 26.5.2 arm64 | At `38ca14e`, `bun run tauri build --debug` produced the regular `mdtxt.app` and arm64 DMG. The latest mdtxt-owned [`Platform Evidence Build #29431075393`](https://github.com/jincaiw/mdtxt/actions/runs/29431075393), commit `caa0a96`, produced `mdtxt_0.1.0_aarch64.dmg` (SHA-256 `b3c9c3ee8208e66127c622743d926656fc176edf3490c58d3a503326fd005403`) and an ARM64 manifest for `mdtxt` / `app.mdtxt.desktop` / `0.1.0` | P8 AC-007 two-draft force-terminate/relaunch recovery observed in the isolated WKWebView build; details are recorded in P8 tracking. P6 IME and P8 filesystem matrix remain separate | Build and a limited P8 native smoke present; P6/P8 not accepted |
| Windows x64 | Latest mdtxt-owned [`Platform Evidence Build #29431075393`](https://github.com/jincaiw/mdtxt/actions/runs/29431075393), commit `caa0a96`, produced `mdtxt_0.1.0_x64_en-US.msi` (SHA-256 `a7341b43613da873025ba821e065110c9496f6300ca5163f3b108a2d4e2aa8c5`) and `mdtxt_0.1.0_x64-setup.exe` (SHA-256 `16f6657fd2e715a7f8fceb77be1f9f3abe5fdf1c48e99a39d644ac7f025c9e2a`); the manifest identifies Windows/X64, `mdtxt`, `app.mdtxt.desktop`, `0.1.0` | No artifact installation, recovery UI, or Microsoft Pinyin result; NTFS fixture CI remains a separate P8 record | Debug package evidence present; functional acceptance pending |
| Ubuntu LTS x64 | `.github/workflows/ci.yml` is fixed to Ubuntu 24.04 and the latest CI native WebKit smoke passed at `caa0a96`; [`Platform Evidence Build #29431075393`](https://github.com/jincaiw/mdtxt/actions/runs/29431075393) is still building the Debug package | The Docker attempt remains non-creditable; CI native smoke is not an installation/IME/recovery pass | Debug package pending; functional acceptance pending |

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
