# ADR 0001: mdtxt Product Identity

- Status: accepted
- Date: 2026-07-15

## Decision

The shipped product is named `mdtxt` (always lowercase), versioned as `0.1.0`,
with Tauri identifier `app.mdtxt.desktop`. The npm package, Cargo package,
library, executable, desktop entry, window title, generated exports, native
smoke configuration, release artifacts, and visible in-app copy use this
identity.

`app.mdtxt.desktop` deliberately creates a distinct application-data and
WebView storage boundary. mdtxt can therefore be installed alongside Paperling
without sharing its app state, updater configuration, or file associations.

## Updater policy

No mdtxt endpoint or signing key exists yet. The updater plugin, its frontend
dialog, its capability grants, the Paperling public key, and updater-artifact
generation are removed for 0.1.0 development builds. A later release may add
them only in a separate ADR after it proves a mdtxt-owned endpoint, private-key
handling, signed metadata, rollback behavior, and all target-platform builds.

## Data migration

Paperling data is never deleted or opened in place. mdtxt uses its own
`mdtxt:*` browser-storage keys. When legacy keys are visible in the same
WebView profile (development, a user-imported profile, or future explicit
import), they are copied once and only when the mdtxt destination is absent;
the source is retained. In a packaged app the changed identifier intentionally
prevents reading Paperling's private WebView database, so coexistence is safe
and failure falls back to clean mdtxt defaults rather than attempting an
unsafe filesystem scrape. A user-directed import/export flow remains future
work and must be idempotent before it is added.

## Rollback

Reverting the brand commit restores the Paperling manifests and code as one
commit. It does not touch either application's persisted data. Because updater
support is disabled rather than redirected, rollback cannot fetch or install a
release from the wrong product channel.
