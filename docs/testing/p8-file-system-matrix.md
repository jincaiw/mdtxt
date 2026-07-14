# P8 File-System Platform Matrix

Status: **release-blocking evidence matrix; do not infer an unchecked cell from another platform.**

| Behavior | macOS 26.5.2 / arm64 | Windows x64 | Ubuntu LTS x64 | Evidence / release decision |
| --- | --- | --- | --- | --- |
| Same-directory atomic replacement | Automated Rust coverage; POSIX parent-directory sync is attempted after rename | Pending | Pending | Windows requires real NTFS replacement evidence |
| Write, file-sync, rename failure | Injected regression: original bytes survive and temporary sibling is cleaned | Pending | Pending | Required before P8 exit |
| Post-rename directory sync failure | Injected regression: save returns `durabilityWarning`; replacement exists and no temporary file remains | Pending Windows semantics | Pending | No rollback claim after rename; UI warns without retaining a false dirty state |
| Symbolic link save | Rejected explicitly; link and target remain unchanged | Pending junction/symlink policy | Pending | Link preservation is a security and data-integrity boundary |
| Long nested path | Passed with a path over 600 characters | Pending long-path-enabled NTFS | Pending | Windows test must include long-path policy configuration |
| File lock | **Not a write-lock guarantee:** POSIX advisory locks do not automatically prevent rename; behavior must be recorded per lock implementation | Pending sharing-violation test | Pending advisory-lock test | Never claim cross-process lock protection without an OS-specific test |
| UNC path | Not applicable | Pending | Not applicable | Must test both readable and denied-share cases |
| Crash recovery | Debug crash/relaunch smoke passed; recovered text opens in a new unsaved tab | Pending | Pending | Recovery must never overwrite original path |

## macOS evidence

- Host: Darwin 25.5.0, macOS 26.5.2, arm64.
- `cargo test --manifest-path src-tauri/Cargo.toml symbolic_link` confirms a
  symbolic link cannot be replaced by `save_file` and its target is unchanged.
- `cargo test --manifest-path src-tauri/Cargo.toml long_nested_path` confirms a
  nested path over 600 characters can be saved and read.
- `cargo test --manifest-path src-tauri/Cargo.toml injected_` covers the four
  atomic-save boundary faults and distinguishes failures before and after
  rename.

## Required target-platform record

For each pending cell, record: OS version, filesystem, command/test scenario,
actual result, known OS-specific error, user-visible behavior, and the commit
that introduced the test or fallback. A CI build alone is not sufficient for
UNC, locks, recovery, or actual filesystem replacement behavior.
