# P10a Platform Build and Evidence Tracking

Status: **environment and workflow configuration exist; no cross-platform mdtxt
0.1.0 package or functional acceptance is inferred from configuration alone.**

## Current evidence

| Target | Build / launch evidence | Functional evidence | Status |
| --- | --- | --- | --- |
| macOS 26.5.2 arm64 | Local `bun run tauri -- build --debug` refreshed `src-tauri/target/debug/bundle/macos/mdtxt.app` on 2026-07-15 | Existing single-draft recovery and P6 basic UI observations are tracked separately; this build has not yet run the new two-tab AC-007 forced-termination scenario in an isolated native instance | Build present; P6/P8 not accepted |
| Windows x64 | `.github/workflows/ci.yml` has a `windows-latest` check job and `release.yml` declares a Windows x64 bundle target | No mdtxt 0.1.0 artifact install, recovery, NTFS lock/long-path/UNC, or Microsoft Pinyin result | Pending |
| Ubuntu LTS x64 | `.github/workflows/ci.yml` declares an Ubuntu 24.04 build and native WebKit smoke configuration | No reviewed mdtxt 0.1.0 workflow run or desktop package install; the local Docker attempt is non-creditable and is recorded in P8 tracking | Pending |

## Remote boundary

On 2026-07-15, the checked-out `origin` was verified as
`https://github.com/jincaiw/Paperling.git`. Its latest visible successful
Release workflow was for `v1.0.50`, not an mdtxt 0.1.0 ref. The checkout must
not rewrite `origin`, and those upstream runs must not be cited as mdtxt
evidence. A future mdtxt-owned remote/ref, or manually supplied target-platform
evidence, is required before recording CI artifacts here.

## Required record per target

For a creditable P10a cell, retain the commit SHA, OS version, architecture,
filesystem/WebView, package identifier and SHA-256, exact build/install/launch
command, raw result or logs, screenshots where UI is asserted, known failures,
and rollback point. CI compilation alone never closes P6 IME, P8 recovery, or
P8 filesystem semantics.
