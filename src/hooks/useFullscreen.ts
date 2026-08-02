import { useState, useRef, useCallback, useEffect } from "react";
import { Window } from "@tauri-apps/api/window";

// Fullscreen-transition timing. The cover fades IN over FS_FADE_IN_MS (kept in
// sync with the cover's Tailwind duration class) and we wait that long before
// resizing the window, so the resize is fully masked. After the resize calls
// resolve we hold FS_SETTLE_MS for the OS to finish painting, then fade out.
const FS_FADE_IN_MS = 150;
const FS_SETTLE_MS = 200;

export interface FullscreenControls {
  /** True when the window is in OS fullscreen. */
  isFullscreen: boolean;
  /** True while the masking cover is faded in over a resize transition. */
  fsTransition: boolean;
  /** Toggle OS fullscreen, masking the resize behind a fade. */
  toggleFullscreen: () => Promise<void>;
}

/**
 * Toggle OS fullscreen. With native window decorations, fullscreen can
 * also change through the macOS green button and native Window menu. Keep the
 * React state subscribed to the OS instead of treating one shortcut as its own source of
 * truth. FULLSCREEN-01.
 *
 * @param notify shows the platform shortcut used to exit fullscreen.
 */
export function useFullscreen(notify: (message: string) => void): FullscreenControls {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isFullscreenRef = useRef(false);
  const settleTimerRef = useRef<number | undefined>(undefined);
  // Drops an opaque cover over the webview while the native window resizes.
  // Fullscreen transitions can visibly reflow the editor mid-transition — a
  // jarring "snap" without this cover.
  // We fade the cover IN to full opacity, hold while the OS settles behind it,
  // then fade it OUT, so the change reads as a smooth dip rather than a hard
  // cut. Crucially we wait for the fade-in to finish before touching the window,
  // so the resize is masked from its very first frame (a single rAF wasn't
  // reliably enough — early reflow frames leaked through). FULLSCREEN-01.
  const [fsTransition, setFsTransition] = useState(false);

  useEffect(() => {
    let disposed = false;
    let unlistenResize: (() => void) | undefined;
    let unlistenFocus: (() => void) | undefined;

    const sync = async (windowHandle: Window) => {
      try {
        const fullscreen = await windowHandle.isFullscreen();
        if (!disposed) {
          isFullscreenRef.current = fullscreen;
          setIsFullscreen(fullscreen);
        }
      } catch {
        // Browser development and restricted test harnesses have no native
        // window bridge. The explicit F11 handler remains a harmless no-op.
      }
    };

    try {
      const windowHandle = Window.getCurrent();
      void sync(windowHandle);
      void Promise.all([
        windowHandle.onResized(() => { void sync(windowHandle); }),
        windowHandle.onFocusChanged(() => { void sync(windowHandle); }),
      ]).then(([removeResize, removeFocus]) => {
        if (disposed) {
          removeResize();
          removeFocus();
        } else {
          unlistenResize = removeResize;
          unlistenFocus = removeFocus;
        }
      }).catch(() => {
        // Browser development has no Tauri event bridge.
      });
    } catch {
      // Window.getCurrent() can throw in browser development mode.
    }

    return () => {
      disposed = true;
      unlistenResize?.();
      unlistenFocus?.();
      if (settleTimerRef.current !== undefined) window.clearTimeout(settleTimerRef.current);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      const w = Window.getCurrent();
      const next = !isFullscreenRef.current;
      // Fade the cover in, then wait for it to reach full opacity before the
      // window starts resizing underneath it. FS_FADE_IN_MS must stay in sync
      // with the cover's fade-in duration class.
      setFsTransition(true);
      await new Promise((r) => window.setTimeout(r, FS_FADE_IN_MS));
      await w.setFullscreen(next);
      const actual = await w.isFullscreen();
      isFullscreenRef.current = actual;
      setIsFullscreen(actual);
      if (actual) {
        const isMac = /mac/i.test(navigator.platform || navigator.userAgent || "");
        notify(isMac ? "Fullscreen on — press Cmd+Option+F to exit" : "Fullscreen on — press F11 to exit");
      }
    } catch {
      /* browser dev mode — no Tauri window */
    } finally {
      // Let the resize settle behind the fully-opaque cover, then fade out.
      settleTimerRef.current = window.setTimeout(() => setFsTransition(false), FS_SETTLE_MS);
    }
  }, [notify]);

  return { isFullscreen, fsTransition, toggleFullscreen };
}
