# P8 File-System Platform Matrix

Status: **release-blocking evidence matrix; do not infer an unchecked cell from another platform.**

| Behavior | macOS 26.5.2 / arm64 | Windows x64 | Ubuntu LTS x64 | Evidence / release decision |
| --- | --- | --- | --- | --- |
| Same-directory atomic replacement | Automated Rust coverage; POSIX parent-directory sync is attempted after rename | Passed through `MoveFileExW(REPLACE_EXISTING | WRITE_THROUGH)` | Ubuntu 24.04 Rust suite passed with POSIX parent-directory sync | Windows requests write-through replacement through the file API |
| Write, file-sync, rename failure | Injected regression: original bytes survive and temporary sibling is cleaned | Injected regressions passed | Injected regressions passed | Pre-rename failures preserve the original; post-rename uncertainty returns a warning |
| Post-rename directory sync failure | Injected regression: save returns `durabilityWarning`; replacement exists and no temporary file remains | Windows uses write-through replacement; injected warning path passed | Injected directory-sync regression passed | No rollback claim after replacement; UI warns without retaining a false dirty state |
| Symbolic link save | Rejected explicitly; link and target remain unchanged | Passed: `save_file_refuses_to_replace_a_symbolic_link` | Passed | Junction policy remains separately unverified |
| Long nested path | Passed with a path over 600 characters | Passed with verbatim path handling and `LongPathsEnabled=1` | Passed | Windows policy was explicitly enabled in the runner fixture |
| File lock | POSIX advisory lock behavior recorded; rename is not automatically blocked | Passed sharing-violation fixture; cleanup re-read confirmed original bytes | POSIX advisory lock behavior passed | Never claim cross-process lock protection on POSIX; Windows sharing denial is enforced |
| UNC path | Not applicable | Passed loopback SMB share: `save_file_handles_configured_unc_path` | Not applicable | Denied-share UX remains unverified |
| Crash recovery | Isolated Debug two-draft force-kill/relaunch passed: order, active tab, line and text restored | Native WebView store/reload/dialog/restore passed; installed-package force-kill pending | Native WebView store/reload/dialog/restore passed; installed-package force-kill pending | Recovery never overwrites original paths; automated refresh is not a process-kill claim |

## macOS evidence

- Host: Darwin 25.5.0, macOS 26.5.2, arm64.
- `cargo test --manifest-path src-tauri/Cargo.toml symbolic_link` confirms a
  symbolic link cannot be replaced by `save_file` and its target is unchanged.
- `cargo test --manifest-path src-tauri/Cargo.toml long_nested_path` confirms a
  nested path over 600 characters can be saved and read.
- `cargo test --manifest-path src-tauri/Cargo.toml injected_` covers the four
  atomic-save boundary faults and distinguishes failures before and after
  rename.

## Windows and Ubuntu automated evidence

- Windows runner: GitHub-hosted `windows-latest` (NTFS), commit `5d4ac76`,
  [`CI #29484168792`](https://github.com/jincaiw/mdtxt/actions/runs/29484168792).
- The fixture explicitly enabled `LongPathsEnabled`, created a loopback SMB
  share, and held a `FileShare.None` lock in a child PowerShell process.
- The complete Windows Rust check passed. The post-test cleanup confirmed the
  lock fixture still contained `locked original bytes` before removing the SMB
  share.
- Ubuntu runner: GitHub-hosted Ubuntu 24.04 x64, commit `c43653a`,
  [`CI #29483474768`](https://github.com/jincaiw/mdtxt/actions/runs/29483474768).
  Its Rust check passed atomic replacement, injected failures, symbolic-link
  refusal, long paths, directory synchronization and advisory-lock semantics.
- The same CI run's Windows and Ubuntu native jobs passed recovery
  store/reload/dialog/restore. These are OS-level boundary and native WebView
  results, not installed-package acceptance passes.

## Required target-platform record

For each pending cell, record: OS version, filesystem, command/test scenario,
actual result, known OS-specific error, user-visible behavior, and the commit
that introduced the test or fallback. A CI build alone is not sufficient for
UNC, locks, recovery, or actual filesystem replacement behavior.
