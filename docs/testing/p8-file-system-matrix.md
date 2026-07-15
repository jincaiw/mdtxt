# P8 File-System Platform Matrix

Status: **release-blocking evidence matrix; do not infer an unchecked cell from another platform.**

| Behavior | macOS 26.5.2 / arm64 | Windows x64 | Ubuntu LTS x64 | Evidence / release decision |
| --- | --- | --- | --- | --- |
| Same-directory atomic replacement | Automated Rust coverage; POSIX parent-directory sync is attempted after rename | GitHub-hosted Windows NTFS runner passed `save_file_writes_atomically_and_returns_durable_metadata` | Pending | Windows test proves the normal replacement path, not directory-flush durability |
| Write, file-sync, rename failure | Injected regression: original bytes survive and temporary sibling is cleaned | Injected regression passed in the Windows Rust suite | Pending | Required before P8 exit |
| Post-rename directory sync failure | Injected regression: save returns `durabilityWarning`; replacement exists and no temporary file remains | Injected regression passed; Windows directory-flush semantics remain unverified | Pending | No rollback claim after rename; UI warns without retaining a false dirty state |
| Symbolic link save | Rejected explicitly; link and target remain unchanged | Passed: `save_file_refuses_to_replace_a_symbolic_link` | Pending | Junction policy remains separately unverified |
| Long nested path | Passed with a path over 600 characters | Passed with `LongPathsEnabled=1`: `save_file_handles_a_long_nested_path` | Pending | Windows policy was explicitly enabled in the Runner fixture |
| File lock | **Not a write-lock guarantee:** POSIX advisory locks do not automatically prevent rename; behavior must be recorded per lock implementation | Passed sharing-violation fixture: `save_file_reports_an_exclusive_windows_lock`; cleanup re-read confirmed original bytes | Pending advisory-lock test | Never claim cross-process lock protection without an OS-specific test |
| UNC path | Not applicable | Passed loopback SMB share: `save_file_handles_configured_unc_path` | Not applicable | Denied-share UX remains unverified |
| Crash recovery | Isolated Debug two-draft crash/relaunch passed: original tab order, active tab, saved line and both texts recover into new unsaved tabs | Pending | Pending | Recovery must never overwrite original path; macOS Debug evidence does not imply a release-package or other-platform pass |

## macOS evidence

- Host: Darwin 25.5.0, macOS 26.5.2, arm64.
- `cargo test --manifest-path src-tauri/Cargo.toml symbolic_link` confirms a
  symbolic link cannot be replaced by `save_file` and its target is unchanged.
- `cargo test --manifest-path src-tauri/Cargo.toml long_nested_path` confirms a
  nested path over 600 characters can be saved and read.
- `cargo test --manifest-path src-tauri/Cargo.toml injected_` covers the four
  atomic-save boundary faults and distinguishes failures before and after
  rename.

## Windows automated evidence

- Runner: GitHub-hosted `windows-latest` (NTFS), commit `557b9d8`,
  [`CI #29431839622`](https://github.com/jincaiw/mdtxt/actions/runs/29431839622).
- The fixture explicitly enabled `LongPathsEnabled`, created a loopback SMB
  share, and held a `FileShare.None` lock in a child PowerShell process.
- Rust test result: 31 passed / 0 failed. The post-test cleanup confirmed the
  lock fixture still contained `locked original bytes` before removing the SMB
  share.
- This is OS-level save-boundary evidence, not interactive Windows recovery or
  an installed-package acceptance pass.

## Required target-platform record

For each pending cell, record: OS version, filesystem, command/test scenario,
actual result, known OS-specific error, user-visible behavior, and the commit
that introduced the test or fallback. A CI build alone is not sufficient for
UNC, locks, recovery, or actual filesystem replacement behavior.
