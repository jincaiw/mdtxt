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
| External modification conflict choice | `useExternalChangeWatcher` does not advance a dirty document's revision; `FileConflictDialog` offers an on-demand read-only side-by-side comparison plus explicit keep-local, reload-disk and save-as choices. A later hash conflict from any save path reopens the same choice point | Active and background dirty tabs use the same non-destructive flow. A background change persists as a localized warning marker on its tab; selecting it opens the decision dialog. Reload or a successful save-as clears only that marker |
| Crash recovery | `src-tauri/src/recovery.rs` writes app-data recovery entries atomically with SHA-256 validation and seven-day retention; startup lists verified entries in `RecoveryDialog`; new tab IDs include a per-launch UUID | Restore creates a new unsaved tab and cannot overwrite the disk path or collide with a prior launch's recovery key; discard stays visible for retry if native deletion fails, while a failed post-restore cleanup is reported as a possible next-launch repeat. macOS Debug crash/relaunch smoke passed for one draft; AC-007 session-level recovery of two tabs, active tab and approximate position remains unimplemented/unverified |

## Automated evidence for the atomic-save slice

| Scope | Command | Result |
| --- | --- | --- |
| Rust formatting and static analysis | `cargo fmt --manifest-path src-tauri/Cargo.toml --check` and `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | Passed |
| Rust persistence tests | `cargo test --manifest-path src-tauri/Cargo.toml` | Passed: 30 tests; includes atomic write, cleanup, durable result hash, failure injection, CRLF preservation, temporary-path uniqueness, stale-revision/hash rejection, symlink refusal, long-path write and Unix permission preservation |
| Failure injection | `cargo test --manifest-path src-tauri/Cargo.toml injected_` | Passed: write, file-sync and rename failures preserve original bytes and remove the sibling temporary file; directory-sync failure is explicitly recorded as post-rename and returns a successful save result with `durabilityWarning`, so the UI keeps the session durable while warning the user |
| Post-rename close behavior | `src/App.tsx` window-close and close-tab save paths | A `durabilityWarning` marks the matching session saved, then stops automatic window/tab closure and displays the localized durability warning. This preserves the truthful successful-save state while making the uncertainty visible before the UI can disappear. |
| Revision-aware save paths | `bun run test -- src/hooks/useExternalChangeWatcher.test.ts src/hooks/useAutosave.test.ts src/utils/documentSessionController.test.ts src/utils/documentSession.test.ts` | Passed: 4 files / 29 tests; active, background, autosave and close-time paths carry the known revision/hash, and a successful write updates both only for the saved version |
| Active conflict choice | `bun run test -- src/components/FileConflictDialog.test.tsx` | Passed: comparison reads disk only on request; keep-local, save-as and reload remain separate explicit operations |
| Background conflict marker | `bun run test -- src/components/TabBar.test.tsx` | Passed: conflict metadata produces an accessible persistent tab warning without altering dirty state |
| macOS file-system boundary | Darwin 25.5.0 / macOS 26.5.2 / arm64; `cargo test ... symbolic_link` and `... long_nested_path` | Passed: saving a symbolic-link path is explicitly refused without replacing the link or target; a nested path over 600 characters writes and reads successfully |
| Frontend release gates | `bun run test && bun run build && bun run release:check` | Passed: 46 files / 317 tests, production build, and preflight (`mdtxt` `0.1.0`; 438 Chinese keys / 97 source files; 0 direct user-copy literals) |
| Recovery store | `cargo test --manifest-path src-tauri/Cargo.toml recovery::tests` | Passed: checksum validation, tamper cleanup, atomic write/read and clear |
| Recovery prompt | `bun run test -- src/components/RecoveryDialog.test.tsx` | Passed: 2 tests cover verified-entry-only rendering, explicit restore/discard callbacks, the non-overwrite warning, and initial focus on Restore |
| Recovery key isolation | `bun run test -- src/utils/tabsModel.test.ts` | Passed: 23 tests; tab IDs retain an in-instance sequence but use distinct launch prefixes, preventing a fresh `tab-1` from overwriting an unresolved recovery entry |
| macOS recovery smoke | Debug `mdtxt.app`, Apple M4 / Darwin 25.5.0 / WKWebView | Edited an Untitled draft, waited for recovery debounce, terminated/relaunched the Debug app, observed `RecoveryDialog`, restored into `已恢复 — Untitled-1.md`, and verified the original text remained editable as an unsaved tab |

## Remaining P8 gates

1. Add and verify AC-007 session-level recovery: two drafts, their content, active tab and approximate cursor/scroll position after forced termination; record it separately from recovery-entry integrity.
2. Record the equivalent Windows and Linux recovery behavior before release.
3. Record Windows and Linux behavior for symbolic links, long paths, UNC paths,
   locks, directory synchronization, and replacement semantics; record macOS
   lock behavior separately because POSIX advisory locks are not automatically
   enforced by rename.

### Non-creditable Linux attempt

On 2026-07-15, a local Docker Linux/aarch64 Debian Bookworm container with
Rust 1.96.1 attempted `cargo test save_file_`. Compilation stopped before any
mdtxt test ran because `gdk-sys` and `pango-sys` could not find their system
development packages. A follow-up transient dependency installation did not
complete (`dpkg` reported a missing downloaded package). This is neither an
Ubuntu LTS desktop environment nor a passing application test, so every Linux
cell remains **Pending** in the platform matrix.

The required platform-by-platform evidence is maintained in
[`docs/testing/p8-file-system-matrix.md`](../testing/p8-file-system-matrix.md).

## Rollback boundary

P8a spans `src-tauri/src/commands.rs`, the versioned document-session contract,
and save callers. Reverting its dedicated commit restores the former mtime-only
result contract without changing editor ownership or Live Beta behavior.
