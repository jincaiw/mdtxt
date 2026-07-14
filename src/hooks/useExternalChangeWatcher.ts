import { useEffect, type RefObject } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DocumentSession } from "../utils/documentSession";

export interface UseExternalChangeWatcherOptions {
  /** Active controller-owned session, read live by the one mounted listener. */
  sessionRef: RefObject<DocumentSession | null>;
  /** Records a newer disk revision without making the document clean. */
  onDiskRevision: (documentId: string, diskRevision: number) => void;
  /** True while an AI review is pending — don't reload over a proposed diff. */
  isReviewActiveRef: RefObject<boolean>;
  /** Reload the file from disk (used when the buffer is clean). */
  reload: (path: string) => Promise<void>;
  /** Called after a silent reload of a clean buffer. */
  onReloaded: () => void;
  /** Called when the file changed on disk but the buffer is dirty. */
  onConflict: () => void;
}

/**
 * Detect the open file changing underneath us (sync tools, another editor). On
 * window focus, stat the file: if it's newer than what we last wrote and the
 * buffer is clean, reload silently. A dirty buffer keeps its older disk
 * revision so the native expected-revision guard rejects saves until the
 * conflict is explicitly resolved. EXT-01 / FR-COMPAT-004.
 *
 * `reload`/`onReloaded`/`onConflict` should be stable (useCallback); everything
 * else is read through refs so the focus listener mounts once.
 */
export function useExternalChangeWatcher({
  sessionRef,
  onDiskRevision,
  isReviewActiveRef,
  reload,
  onReloaded,
  onConflict,
}: UseExternalChangeWatcherOptions): void {
  useEffect(() => {
    let checking = false;
    const checkExternalChange = async () => {
      const session = sessionRef.current;
      const path = session?.path;
      // Bail before claiming the `checking` slot so an early return can never
      // strand it set (that would silently kill detection for the session).
      if (!path || checking || isReviewActiveRef.current) return;
      checking = true;
      try {
        const info = await invoke<{ modified: number }>("get_file_info", { path });
        const known = session.diskRevision;
        if (known > 0 && info.modified > known) {
          if (session.version === session.savedVersion) {
            onDiskRevision(session.id, info.modified);
            await reload(path);
            onReloaded();
          } else {
            onConflict();
          }
        }
      } catch {
        /* file gone or stat failed — the save path will surface it */
      } finally {
        checking = false;
      }
    };
    window.addEventListener("focus", checkExternalChange);
    return () => window.removeEventListener("focus", checkExternalChange);
  }, [sessionRef, onDiskRevision, isReviewActiveRef, reload, onReloaded, onConflict]);
}
