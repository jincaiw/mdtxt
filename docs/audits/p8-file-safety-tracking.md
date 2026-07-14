# P8 File Safety, Conflict, and Recovery Tracking

Status: **P8 has started; atomic-save hardening is implemented, but P8 is not
accepted.**

## Scope and requirement traceability

| Requirement | Evidence | Current status |
| --- | --- | --- |
| FR-COMPAT-004: failed replacement never damages the original file | `src-tauri/src/commands.rs::save_file` writes and synchronizes a sibling temporary file before replacement; rename failure removes that temporary file | Implemented and covered by the existing atomic-save test; fault injection is still required |
| FR-COMPAT-004: detect a newer disk revision before save | `read_file` returns the raw-byte SHA-256; `save_file(..., expected_revision, expected_hash)` checks both values before writing and returns the actual post-rename `{ modified, hash }`; all explicit, automatic, background, close-time and save-as paths update the controller only for the matching document version | P8a implemented. Hash prevents same-mtime overwrite at save time; focus-time change discovery still uses mtime, so a same-mtime external edit is conservatively rejected when the user saves rather than proactively announced |
| FR-COMPAT-004: preserve existing file access policy | `save_file` copies the target permissions onto the sibling temporary file before it is written and renamed | Implemented on supported filesystems; Unix regression test covers mode `0640` |
| FR-COMPAT-004: durable replacement metadata | POSIX builds synchronize the containing directory after rename | Implemented on Unix; Windows directory-flush semantics require platform-specific verification |
| Overlapping saves do not share a temporary path | `save_temp_path` combines sibling directory, basename, process id, and an atomic process-local sequence | Implemented; unit test proves distinct paths in one process |
| Save-format fidelity | Existing EOL/BOM/trailing-newline tests in `commands.rs` | Existing coverage remains green; byte-level preservation of all supported formats is not yet complete |
| External modification conflict choice | `useExternalChangeWatcher` does not advance a dirty document's revision; `FileConflictDialog` offers reload-disk or save-as for the active document | Active-document choice is implemented without overwriting either version; a side-by-side comparison and per-background-tab entry remain pending |
| Crash recovery | `src-tauri/src/recovery.rs` writes app-data recovery entries atomically with SHA-256 validation and seven-day retention; startup lists verified entries in `RecoveryDialog` | Restore creates a new unsaved tab and cannot overwrite the disk path; discard only deletes the recovery entry. macOS Debug crash/relaunch smoke passed |

## Automated evidence for the atomic-save slice

| Scope | Command | Result |
| --- | --- | --- |
| Rust formatting and static analysis | `cargo fmt --manifest-path src-tauri/Cargo.toml --check` and `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | Passed |
| Rust persistence tests | `cargo test --manifest-path src-tauri/Cargo.toml` | Passed: 26 tests; includes atomic write, cleanup, durable result hash, CRLF preservation, temporary-path uniqueness, stale-revision/hash rejection and Unix permission preservation |
| Revision-aware save paths | `bun run test -- src/hooks/useExternalChangeWatcher.test.ts src/hooks/useAutosave.test.ts src/utils/documentSessionController.test.ts src/utils/documentSession.test.ts` | Passed: 4 files / 29 tests; active, background, autosave and close-time paths carry the known revision/hash, and a successful write updates both only for the saved version |
| Frontend release gates | `bun run build` | Passed after the P8a result-contract change; `release:check` remains a required final P8 gate |
| Recovery store | `cargo test --manifest-path src-tauri/Cargo.toml recovery::tests` | Passed: checksum validation, tamper cleanup, atomic write/read and clear |
| macOS recovery smoke | Debug `mdtxt.app`, Apple M4 / Darwin 25.5.0 / WKWebView | Edited an Untitled draft, waited for recovery debounce, terminated/relaunched the Debug app, observed `RecoveryDialog`, restored into `已恢复 — Untitled-1.md`, and verified the original text remained editable as an unsaved tab |

## Remaining P8 gates

1. Provide a visible, non-destructive conflict flow: compare, reload disk,
   keep local, and save-as. No choice may silently overwrite either version.
2. Record the equivalent Windows and Linux recovery behavior before release.
3. Add failure-injection tests for write, sync, rename and directory-sync
   errors; verify the original bytes and editable buffer survive each error.
4. Record macOS, Windows, and Linux behavior for symbolic links, long paths,
   UNC paths, locks, directory synchronization, and replacement semantics.

## Rollback boundary

P8a spans `src-tauri/src/commands.rs`, the versioned document-session contract,
and save callers. Reverting its dedicated commit restores the former mtime-only
result contract without changing editor ownership or Live Beta behavior.
