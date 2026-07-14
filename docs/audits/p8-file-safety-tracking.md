# P8 File Safety, Conflict, and Recovery Tracking

Status: **P8 has started; atomic-save hardening is implemented, but P8 is not
accepted.**

## Scope and requirement traceability

| Requirement | Evidence | Current status |
| --- | --- | --- |
| FR-COMPAT-004: failed replacement never damages the original file | `src-tauri/src/commands.rs::save_file` writes and synchronizes a sibling temporary file before replacement; rename failure removes that temporary file | Implemented and covered by the existing atomic-save test; fault injection is still required |
| FR-COMPAT-004: preserve existing file access policy | `save_file` copies the target permissions onto the sibling temporary file before it is written and renamed | Implemented on supported filesystems; Unix regression test covers mode `0640` |
| FR-COMPAT-004: durable replacement metadata | POSIX builds synchronize the containing directory after rename | Implemented on Unix; Windows directory-flush semantics require platform-specific verification |
| Overlapping saves do not share a temporary path | `save_temp_path` combines sibling directory, basename, process id, and an atomic process-local sequence | Implemented; unit test proves distinct paths in one process |
| Save-format fidelity | Existing EOL/BOM/trailing-newline tests in `commands.rs` | Existing coverage remains green; byte-level preservation of all supported formats is not yet complete |
| External modification conflict choice | Frontend currently detects an external update, but a dirty document only receives a warning before a later save | Not accepted: compare, reload, retain-local, and save-as choices are still missing |
| Crash recovery | No validated recovery-copy lifecycle, checksum, retention policy, or restore UI | Not started |

## Automated evidence for the atomic-save slice

| Scope | Command | Result |
| --- | --- | --- |
| Rust formatting and static analysis | `cargo fmt --manifest-path src-tauri/Cargo.toml --check` and `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | Passed |
| Rust persistence tests | `cargo test --manifest-path src-tauri/Cargo.toml` | Passed: 22 tests; includes atomic write, cleanup, CRLF preservation, temporary-path uniqueness and Unix permission preservation |

## Remaining P8 gates

1. Carry the last-known disk revision and content hash through the document
   session; reject a save when the on-disk revision changed.
2. Provide a visible, non-destructive conflict flow: compare, reload disk,
   keep local, and save-as. No choice may silently overwrite either version.
3. Create checksum-protected recovery copies, bounded retention, startup
   discovery, and restore/discard controls.
4. Add failure-injection tests for write, sync, rename and directory-sync
   errors; verify the original bytes and editable buffer survive each error.
5. Record macOS, Windows, and Linux behavior for symbolic links, long paths,
   UNC paths, locks, directory synchronization, and replacement semantics.

## Rollback boundary

The atomic-save slice is isolated to `src-tauri/src/commands.rs`. Reverting
its commit restores the prior temporary-file behavior without changing editor
session ownership or Live Beta behavior.
