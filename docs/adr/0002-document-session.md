# ADR 0002: DocumentSession as the document-state boundary

Date: 2026-07-15  
Status: Accepted for P4 migration

## Context

`App.tsx` currently keeps the active document in independent React state while
inactive tabs hold snapshots. This duplicates content, saved content, disk
revision, cursor position and review state. It permits safe basic tab switching,
but it makes asynchronous save, external-change, preview, AI and export results
hard to associate with the document revision that created them.

## Options considered

1. Keep complete document text in React state and add more references.
   This preserves existing behaviour but retains two sources of truth and keeps
   keystroke-level updates flowing through the application tree.
2. Introduce a global state-library store.
   It centralizes data but adds a dependency and does not, by itself, establish
   CodeMirror `EditorState` ownership or stale-result rules.
3. Introduce a framework-independent `DocumentSession` model, owned by a small
   controller, with React subscribed only to immutable summaries.

## Decision

Choose option 3. Every open document receives a stable `id` and owns:

- path, display name, encoding-format metadata and disk revision;
- `version` and `savedVersion` used for dirty state and stale-result rejection;
- cursor/view metadata, recovery state and a future per-document `EditorState`;
- document content only at the session/controller boundary, not duplicated as
  an independently mutable active React buffer.

The window owns one mounted `EditorView`. Activating another document swaps that
view's state (or, during the compatibility bridge, applies a minimal transaction)
instead of destroying the view. React receives tab summaries, active document ID
and UI-only state. Save, preview, AI and export requests carry
`documentId + version`; completions whose pair no longer matches are discarded.

## Migration

1. Add and test the pure session model with versions and stale-result guards.
2. Adapt `tabsModel` and `App.tsx` to derive UI tab data from the controller,
   retaining existing persistence shape during the transition.
3. Route active edits, saves, external changes and review results through
   `DocumentSession` mutations.
4. Move `EditorState` ownership into sessions when CodeEditor becomes the P5
   host/controller boundary. Remove the compatibility active-buffer state only
   after mode switching, undo isolation, autosave and external-change tests pass.

## Consequences and rollback

The model adds explicit version plumbing but makes async writes deterministic and
testable. The transition has a compatibility adapter, so P4 can be reverted by
returning App to its snapshot-swap implementation without touching files on
disk or persisted sessions. No format or recovery behaviour changes in this ADR.
