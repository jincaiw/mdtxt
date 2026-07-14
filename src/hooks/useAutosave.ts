import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DiskSaveResult } from "../utils/documentSession";

export interface UseAutosaveOptions {
  /** Master toggle (Settings → Editor). */
  enabled: boolean;
  /** Immutable document revision selected for this debounce cycle. */
  snapshot: {
    documentId: string;
    version: number;
    filePath: string | null;
    /** Disk revision read when this document revision was selected. */
    diskRevision: number;
    diskHash: string;
    content: string;
    dirty: boolean;
  } | null;
  /**
   * True while an AI review is pending. `content` then reflects only the chunks
   * accepted so far, and a later "Reject all" would otherwise leave disk holding
   * edits the user explicitly rejected, so autosave must stay parked. AI-01.
   */
  isReviewActive: boolean;
  /** Called after a successful write with the exact version that was written. */
  onSaved: (result: DiskSaveResult, snapshot: NonNullable<UseAutosaveOptions["snapshot"]>) => void;
  /** Called when a write fails (already throttled to at most once per 30s). */
  onError: (message: string) => void;
}

/** Debounce before persisting after the last edit. */
const AUTOSAVE_DELAY_MS = 1500;
/** Don't surface autosave failures more than once per this window. */
const ERROR_THROTTLE_MS = 30_000;

/**
 * Autosave: once enabled, persist the buffer a moment after the user stops
 * typing. Silent on success (the status dot already flips to "Saved"); failures
 * surface through `onError`, throttled so a broken disk keeps reminding the user
 * without spamming on every debounce tick. A successful save clears the throttle.
 *
 * `onSaved`/`onError` must be stable (wrap in useCallback) — they're effect deps,
 * so a fresh identity each render would reset the debounce timer continuously and
 * autosave would never fire.
 */
export function useAutosave({
  enabled,
  snapshot,
  isReviewActive,
  onSaved,
  onError,
}: UseAutosaveOptions): void {
  const lastErrorRef = useRef(0);

  useEffect(() => {
    if (!enabled || !snapshot?.filePath || !snapshot.dirty || isReviewActive) return;
    const id = window.setTimeout(async () => {
      try {
        const result = await invoke<DiskSaveResult>("save_file", {
          path: snapshot.filePath,
          content: snapshot.content,
          expectedRevision: snapshot.diskRevision || undefined,
          expectedHash: snapshot.diskHash || undefined,
        });
        onSaved(result, snapshot);
        lastErrorRef.current = 0;
      } catch (err) {
        const now = Date.now();
        if (now - lastErrorRef.current > ERROR_THROTTLE_MS) {
          lastErrorRef.current = now;
          const msg = typeof err === "string" ? err : (err as { message?: string })?.message;
          onError(msg || "Autosave failed");
        }
      }
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [enabled, snapshot, isReviewActive, onSaved, onError]);
}
