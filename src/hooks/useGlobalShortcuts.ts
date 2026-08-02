import { useEffect, useRef } from "react";

/** Everything the global keyboard handler needs. Kept in a ref so the window
 *  listener is attached once and never re-bound on a handler/state change. */
export interface ShortcutHandlers {
    handleOpenFile: () => void;
    handleSaveFile: () => void;
    handleSaveAs: () => void;
    handleNewFile: () => void;
    handleToggleMode: () => void;
    handleToggleLive?: () => void;
    handleToggleTypewriter?: () => void;
    handleToggleFocus?: () => void;
    /** Toggle OS fullscreen (F11). Cross-platform via the Tauri window API. */
    toggleFullscreen: () => void;
    handleToggleFileExplorer: () => void;
    showFileTree?: () => void;
    showArticles?: () => void;
    handleToggleTOC: () => void;
    openCheatsheet: () => void;
    /** Typora file-name fuzzy search (Ctrl+P / Cmd+Shift+O). */
    openQuickOpen: () => void;
    openPalette: () => void;
    openSettings: () => void;
    /** Open the reader-mode find bar. Only invoked when mode === "preview". */
    openPreviewFind?: () => void;
    /** Open cross-file search (Ctrl+Shift+F). */
    openSearch?: () => void;
    /** Close the active tab (Ctrl+W). */
    closeActiveTab?: () => void;
    /** Switch tabs (Typora: Cmd+` on macOS, Ctrl+Tab on Windows/Linux). */
    prevTab?: () => void;
    nextTab?: () => void;
    /** Reopen the most recently closed tab (Ctrl+Shift+T). */
    reopenClosedTab?: () => void;
    /** Jump to a tab by index; -1 means the last tab (Alt+1..9). */
    gotoTab?: (index: number) => void;
    hasFile: boolean;
    content: string;
    /** Current view mode — Ctrl+F routes to the preview find bar in reader
     *  mode (the CodeMirror keymap owns find when the editor has focus). */
    mode?: "preview" | "code" | "split" | "live";
}

/**
 * App-wide keyboard shortcuts, mounted once on the window. Reads the latest
 * handlers/state through a ref so the listener never has to be torn down and
 * re-added on a keystroke (which an effect dep-array on `content` would force).
 */
export function useGlobalShortcuts(handlers: ShortcutHandlers) {
    const ref = useRef(handlers);
    ref.current = handlers;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const s = ref.current;
            const mod = e.ctrlKey || e.metaKey;
            const isMac = /mac/i.test(navigator.platform || navigator.userAgent || "");
            // F11 - Toggle fullscreen. The universal fullscreen key on Windows
            // and Linux. macOS reserves F11 for Show Desktop, where users
            // fullscreen via the green title-bar button; the underlying Tauri
            // setFullscreen drives the same window state either way. No file
            // needed — works on the welcome screen too. FULLSCREEN-01.
            if (e.key === "F11") {
                e.preventDefault();
                s.toggleFullscreen();
                return;
            }
            if (e.metaKey && e.altKey && !e.ctrlKey && !e.shiftKey && (e.key === "f" || e.key === "F")) {
                e.preventDefault();
                s.toggleFullscreen();
                return;
            }
            // F9 - typewriter mode. This has no browser-reserved behavior and
            // works in the editor, Reader, and the welcome screen alike.
            if (e.key === "F9") {
                e.preventDefault();
                s.handleToggleTypewriter?.();
                return;
            }
            if (e.key === "F8") {
                e.preventDefault();
                if (s.hasFile) s.handleToggleFocus?.();
                return;
            }
            // Typora: Cmd/Ctrl+Shift+L toggles the sidebar. Live Preview is
            // the normal writing surface, not a second top-level mode.
            if (mod && e.shiftKey && !e.altKey && (e.key === "l" || e.key === "L")) {
                e.preventDefault();
                if (s.hasFile) s.handleToggleFileExplorer();
                return;
            }
            // Typora: outline/file tree use Ctrl+Shift+1/3 on Windows/Linux
            // and Cmd+Ctrl+1/3 on macOS. Keep these at the app level because
            // they operate on the desktop shell rather than editor text.
            const outlineShortcut = (!isMac && e.ctrlKey && e.shiftKey && !e.metaKey && !e.altKey && e.key === "1")
                || (isMac && e.metaKey && e.ctrlKey && !e.shiftKey && !e.altKey && e.key === "1");
            if (outlineShortcut) {
                e.preventDefault();
                if (s.hasFile) s.handleToggleTOC();
                return;
            }
            const fileTreeShortcut = (!isMac && e.ctrlKey && e.shiftKey && !e.metaKey && !e.altKey && e.key === "3")
                || (isMac && e.metaKey && e.ctrlKey && !e.shiftKey && !e.altKey && e.key === "3");
            if (fileTreeShortcut) {
                e.preventDefault();
                if (s.hasFile) (s.showFileTree ?? s.handleToggleFileExplorer)();
                return;
            }
            const articlesShortcut = (!isMac && e.ctrlKey && e.shiftKey && !e.metaKey && !e.altKey && e.key === "2")
                || (isMac && e.metaKey && e.ctrlKey && !e.shiftKey && !e.altKey && e.key === "2");
            if (articlesShortcut) {
                e.preventDefault();
                if (s.hasFile) s.showArticles?.();
                return;
            }
            // Ctrl+O - Open file (without Shift). Match both cases so CapsLock
            // (where an unshifted key reports uppercase) doesn't dead-zone it.
            if (mod && !e.shiftKey && !e.altKey && (e.key === "o" || e.key === "O")) {
                e.preventDefault();
                s.handleOpenFile();
            }
            // Ctrl+S - Save file. Match "s" AND "S": with CapsLock on, an unshifted
            // Ctrl+S reports e.key === "S", which previously fell through and made
            // the keypress silently do nothing (while Ctrl+Shift+S still worked).
            if (mod && !e.shiftKey && !e.altKey && (e.key === "s" || e.key === "S")) {
                e.preventDefault();
                if (s.hasFile || s.content) s.handleSaveFile();
            }
            // Ctrl+Shift+S - Save As
            if (mod && e.shiftKey && !e.altKey && (e.key === "s" || e.key === "S")) {
                e.preventDefault();
                if (s.hasFile || s.content) s.handleSaveAs();
            }
            // Ctrl+N - New file (case-insensitive for the CapsLock case)
            if (mod && !e.shiftKey && !e.altKey && (e.key === "n" || e.key === "N")) {
                e.preventDefault();
                s.handleNewFile();
            }
            // Typora exposes a dedicated New Tab binding on macOS.
            if (e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === "t" || e.key === "T")) {
                e.preventDefault();
                s.handleNewFile();
                return;
            }
            // Typora: Ctrl/Cmd+/ toggles Source Code Mode. Do this at capture
            // phase before CodeMirror sees the key, where it would otherwise
            // be free to bind document formatting.
            if (mod && !e.shiftKey && !e.altKey && e.key === "/") {
                e.preventDefault();
                if (s.hasFile) s.handleToggleMode();
                return;
            }
            // Ctrl+W - close the active tab (falls back to the welcome screen
            // when it's the last one). The webview doesn't reserve Ctrl+W.
            if (mod && !e.shiftKey && !e.altKey && (e.key === "w" || e.key === "W")) {
                e.preventDefault();
                if (s.hasFile) s.closeActiveTab?.();
                return;
            }
            // Ctrl+Shift+F - search across all files in the folder (checked
            // before the unshifted Ctrl+F find-in-document below).
            if (mod && e.shiftKey && !e.altKey && (e.key === "f" || e.key === "F")) {
                e.preventDefault();
                if (s.hasFile) s.openSearch?.();
                return;
            }
            // Ctrl+F in reader mode - find in preview. In code/split mode the
            // focused editor's own keymap handles Mod-f, so this never races it.
            if (mod && !e.shiftKey && !e.altKey && (e.key === "f" || e.key === "F")) {
                if (s.hasFile && s.mode === "preview" && s.openPreviewFind) {
                    e.preventDefault();
                    s.openPreviewFind();
                }
            }
            // Alt+Left / Alt+Right - switch to the previous/next tab. Alt (not
            // Ctrl) keeps Ctrl+Arrow free for word-wise caret movement in the
            // editor. TABS-01.
            if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key === "ArrowLeft") {
                e.preventDefault();
                s.prevTab?.();
                return;
            }
            if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key === "ArrowRight") {
                e.preventDefault();
                s.nextTab?.();
                return;
            }
            // Typora cycles opened documents with Cmd+` on macOS. Do not bind
            // Cmd+Shift+` here: Typora reserves it for inline code.
            if (e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && e.key === "`") {
                e.preventDefault();
                s.nextTab?.();
                return;
            }
            // Ctrl+Tab / Ctrl+Shift+Tab cycles tabs on Windows/Linux and stays
            // as a useful previous-tab extension on macOS. TABS-16.
            if (e.ctrlKey && !e.altKey && !e.metaKey && e.key === "Tab") {
                e.preventDefault();
                (e.shiftKey ? s.prevTab : s.nextTab)?.();
                return;
            }
            if (e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && e.key === "PageDown") {
                e.preventDefault();
                s.nextTab?.();
                return;
            }
            if (e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && e.key === "PageUp") {
                e.preventDefault();
                s.prevTab?.();
                return;
            }
            // Ctrl+Shift+T - reopen the most recently closed tab. TABS-15.
            if (mod && e.shiftKey && !e.altKey && (e.key === "t" || e.key === "T")) {
                e.preventDefault();
                s.reopenClosedTab?.();
                return;
            }
            // Alt+1..9 keeps tab navigation available without stealing
            // Typora's Ctrl/Cmd+1..6 heading shortcuts from CodeMirror.
            if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key >= "1" && e.key <= "9") {
                e.preventDefault();
                s.gotoTab?.(e.key === "9" ? -1 : Number(e.key) - 1);
                return;
            }
            // ? - Show cheatsheet (only when no input is focused)
            if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const target = e.target as HTMLElement | null;
                const isTyping = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
                if (!isTyping) {
                    e.preventDefault();
                    s.openCheatsheet();
                }
            }
            // Typora Quick Open: Ctrl+P on Windows/Linux, Cmd+Shift+O on macOS.
            if ((!isMac && e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && (e.key === "p" || e.key === "P"))
                || (isMac && e.metaKey && !e.ctrlKey && e.shiftKey && !e.altKey && (e.key === "o" || e.key === "O"))) {
                e.preventDefault();
                s.openQuickOpen();
                return;
            }
            // Command Palette stays available as an mdtxt extension without
            // shadowing Typora's Quick Open binding.
            if (mod && e.shiftKey && !e.altKey && (e.key === "p" || e.key === "P")) {
                e.preventDefault();
                s.openPalette();
                return;
            }
            // Ctrl+, - Settings
            if (mod && !e.altKey && e.key === ",") {
                e.preventDefault();
                s.openSettings();
            }
            // Reserve Ctrl/Cmd+J for Typora's Jump to Selection. AI stays an
            // mdtxt extension behind an explicit, non-conflicting chord.
            const isAiChord = e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && (e.key === "j" || e.key === "J" || e.code === "KeyJ");
            if (isAiChord) {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent("mdtxt:ai-assist"));
            }
        };

        // Register in capture phase: CodeMirror consumes Alt+Arrow for cursor
        // navigation during its bubbling handler, but Alt+Left/Right are also
        // documented app-wide tab commands. Capturing keeps native WebView2
        // editor focus from making those shortcuts silently unavailable.
        window.addEventListener("keydown", handleKeyDown, { capture: true });

        return () => {
            window.removeEventListener("keydown", handleKeyDown, { capture: true } as EventListenerOptions);
        };
    }, []);
}
