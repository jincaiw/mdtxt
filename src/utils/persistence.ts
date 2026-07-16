/**
 * localStorage-backed persistence for app state across sessions.
 * Tauri's webview has localStorage available; values survive app restarts.
 */
import { invoke } from "@tauri-apps/api/core";

// One-time migration from the app's historical storage prefixes. We copy rather
// than delete: mdtxt must coexist with Paperling, and a failed migration must
// leave the user's old app fully usable. Runs before any getter seeds React
// state. Exported for tests.
export function migrateLegacyKeys(): void {
    try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (!key) continue;
            const prefix = key.startsWith("paperling:") ? "paperling:"
                : key.startsWith("marklite:") ? "marklite:"
                    : null;
            if (!prefix) continue;
            const renamed = "mdtxt:" + key.slice(prefix.length);
            const value = localStorage.getItem(key);
            if (value !== null && localStorage.getItem(renamed) === null) {
                localStorage.setItem(renamed, value);
            }
        }
    } catch { /* storage unavailable — nothing to migrate */ }
}
migrateLegacyKeys();

const KEY_RECENT_FILES = "mdtxt:recentFiles";
const KEY_LAST_FILE = "mdtxt:lastFile";
const KEY_VIEW_MODE = "mdtxt:viewMode";
const KEY_SPLIT_RATIO = "mdtxt:splitRatio";

// Multi-file/tab workflows make 10 feel tight; 25 keeps the palette's recents
// useful without unbounded growth.
const MAX_RECENT = 25;

const safeGet = <T>(key: string, fallback: T): T => {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
        return fallback;
    }
};

const safeSet = (key: string, value: unknown): void => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {/* storage may be full / disabled */}
};

export interface RecentFile {
    path: string;
    name: string;
    openedAt: number;
}

export const getRecentFiles = (): RecentFile[] => safeGet<RecentFile[]>(KEY_RECENT_FILES, []);

export const addRecentFile = (path: string, name: string): RecentFile[] => {
    const list = getRecentFiles().filter((f) => f.path !== path);
    list.unshift({ path, name, openedAt: Date.now() });
    const trimmed = list.slice(0, MAX_RECENT);
    safeSet(KEY_RECENT_FILES, trimmed);
    return trimmed;
};

export const removeRecentFile = (path: string): RecentFile[] => {
    const list = getRecentFiles().filter((f) => f.path !== path);
    safeSet(KEY_RECENT_FILES, list);
    return list;
};

export const clearRecentFiles = (): void => safeSet(KEY_RECENT_FILES, []);

export const getLastFile = (): string | null => safeGet<string | null>(KEY_LAST_FILE, null);
export const setLastFile = (path: string | null): void => safeSet(KEY_LAST_FILE, path);

// Full multi-tab session, so a relaunch reopens every tab the user had — not
// just the single last file. Only files with a path are stored (untitled
// buffers have no content persisted here); `activeIndex` points into `tabs`.
// getLastFile stays as a migration fallback for sessions saved before this. TABS-07.
const KEY_SESSION = "mdtxt:session";
export interface SessionTab {
    path: string;
    /** 1-based caret/scroll line to restore. */
    cursorLine?: number;
}
export interface SessionState {
    tabs: SessionTab[];
    activeIndex: number;
}
export const getSession = (): SessionState | null => {
    const s = safeGet<SessionState | null>(KEY_SESSION, null);
    if (!s || !Array.isArray(s.tabs)) return null;
    // Defend against a malformed/hand-edited value.
    const tabs = s.tabs.filter((t): t is SessionTab => !!t && typeof t.path === "string");
    if (tabs.length === 0) return null;
    const activeIndex = Number.isInteger(s.activeIndex) ? Math.min(Math.max(0, s.activeIndex), tabs.length - 1) : 0;
    return { tabs, activeIndex };
};
export const setSession = (s: SessionState | null): void => safeSet(KEY_SESSION, s);

export type PersistedViewMode = "preview" | "code" | "split" | "live";
export const getSavedViewMode = (): PersistedViewMode =>
    safeGet<PersistedViewMode>(KEY_VIEW_MODE, "preview");
export const setSavedViewMode = (m: PersistedViewMode): void => safeSet(KEY_VIEW_MODE, m);

export const getSplitRatio = (): number => {
    const r = safeGet<number>(KEY_SPLIT_RATIO, 0.5);
    return Number.isFinite(r) && r > 0.15 && r < 0.85 ? r : 0.5;
};
export const setSplitRatio = (r: number): void => safeSet(KEY_SPLIT_RATIO, r);

const KEY_TOUR_DONE = "mdtxt:tourDone";
export const getTourDone = (): boolean => safeGet<boolean>(KEY_TOUR_DONE, false);
export const setTourDone = (v: boolean): void => safeSet(KEY_TOUR_DONE, v);

const KEY_TYPEWRITER_MODE = "mdtxt:typewriterMode";
const KEY_TOOLBAR = "mdtxt:toolbar";
const KEY_WORD_WRAP = "mdtxt:wordWrap";
const KEY_SPELL_CHECK = "mdtxt:spellCheck";
export const getTypewriterMode = (): boolean => safeGet<boolean>(KEY_TYPEWRITER_MODE, false);
export const setTypewriterMode = (v: boolean): void => safeSet(KEY_TYPEWRITER_MODE, v);
export const getToolbarEnabled = (): boolean => safeGet<boolean>(KEY_TOOLBAR, false);
export const setToolbarEnabled = (v: boolean): void => safeSet(KEY_TOOLBAR, v);
export const getWordWrap = (): boolean => safeGet<boolean>(KEY_WORD_WRAP, true);
export const setWordWrap = (v: boolean): void => safeSet(KEY_WORD_WRAP, v);
export const getSpellCheck = (): boolean => safeGet<boolean>(KEY_SPELL_CHECK, false);
export const setSpellCheck = (v: boolean): void => safeSet(KEY_SPELL_CHECK, v);

// Live remains opt-in throughout P6. Its presentation is Source-compatible,
// but native IME/platform validation is still required before any default flip.
const KEY_LIVE_BETA = "mdtxt:liveBeta";
export const getLiveBetaEnabled = (): boolean => safeGet<boolean>(KEY_LIVE_BETA, false);
export const setLiveBetaEnabled = (v: boolean): void => safeSet(KEY_LIVE_BETA, v);

const KEY_AUTO_SAVE = "mdtxt:autoSave";
export const getAutoSave = (): boolean => safeGet<boolean>(KEY_AUTO_SAVE, false);
export const setAutoSave = (v: boolean): void => safeSet(KEY_AUTO_SAVE, v);

// "Always open files in reader": every file open switches to preview mode,
// for the read-mostly audience. New files still open in code mode, and the
// flag is read live at each open (no cached state to keep in sync). READ-01.
const KEY_OPEN_IN_READER = "mdtxt:openInReader";
export const getOpenInReader = (): boolean => safeGet<boolean>(KEY_OPEN_IN_READER, false);
export const setOpenInReader = (v: boolean): void => safeSet(KEY_OPEN_IN_READER, v);

// Master switch for every AI surface (title-bar button, side panel, toolbar
// sparkle, Alt+J, command palette entry). Off by default so no network-capable
// surface appears before the user explicitly opts in from Settings.
const KEY_AI_ENABLED = "mdtxt:aiEnabled";
export const getAIEnabled = (): boolean => safeGet<boolean>(KEY_AI_ENABLED, false);
export const setAIEnabled = (v: boolean): void => safeSet(KEY_AI_ENABLED, v);

const KEY_AI_ENDPOINT = "mdtxt:aiEndpoint";
const KEY_AI_MODEL = "mdtxt:aiModel";
const KEY_AI_API_KEY = "mdtxt:aiApiKey";

// AI API keys live only in the OS credential store (SECURITY-01), accessed via
// the get_ai_key / set_ai_key Tauri commands. To keep getAIConfig() synchronous
// (it seeds React state), the current value is mirrored in process memory after
// initAIKey() hydrates it. Keychain failures must never fall back to plaintext
// localStorage; the caller receives a visible failure result instead.
let cachedAIKey = "";
let persistedAIKey = "";
let aiKeyLoaded = false;
let aiKeyWriteQueue: Promise<void> = Promise.resolve();

export interface AIKeySaveResult {
    ok: boolean;
    error?: string;
}

export async function initAIKey(): Promise<void> {
    if (aiKeyLoaded) return;
    aiKeyLoaded = true;
    const legacy = safeGet<string>(KEY_AI_API_KEY, "");
    // Remove legacy plaintext before any fallible credential-store operation.
    // If migration cannot complete, losing the persisted secret is safer than
    // silently retaining it in browser storage.
    try { localStorage.removeItem(KEY_AI_API_KEY); } catch {/* unavailable storage */}
    try {
        cachedAIKey = await invoke<string>("get_ai_key");
        persistedAIKey = cachedAIKey;
        // One-time migration: move any legacy plaintext key into the keychain.
        if (!cachedAIKey && legacy) {
            await invoke("set_ai_key", { key: legacy });
            cachedAIKey = legacy;
            persistedAIKey = legacy;
        }
    } catch {
        // Keep the session safe and usable without a key. Settings surfaces the
        // failure if the user explicitly attempts to save one.
        cachedAIKey = "";
        persistedAIKey = "";
    }
}

export const getAIConfig = (): { endpoint: string; model: string; apiKey: string } => ({
    endpoint: safeGet<string>(KEY_AI_ENDPOINT, ""),
    model: safeGet<string>(KEY_AI_MODEL, ""),
    apiKey: cachedAIKey,
});

export const setAIConfig = (cfg: { endpoint: string; model: string; apiKey: string }): Promise<AIKeySaveResult> => {
    safeSet(KEY_AI_ENDPOINT, cfg.endpoint);
    safeSet(KEY_AI_MODEL, cfg.model);
    cachedAIKey = cfg.apiKey;
    try { localStorage.removeItem(KEY_AI_API_KEY); } catch {/* unavailable storage */}
    if (cfg.apiKey === persistedAIKey) return Promise.resolve({ ok: true });

    // Serialize writes so a slower earlier credential-store operation cannot
    // overwrite a newer key. The returned promise always resolves, preventing
    // ignored UI persistence calls from producing unhandled rejections.
    const key = cfg.apiKey;
    const write = aiKeyWriteQueue
        .catch(() => undefined)
        .then(() => invoke("set_ai_key", { key }))
        .then(() => { persistedAIKey = key; });
    aiKeyWriteQueue = write;
    return write.then(
        (): AIKeySaveResult => ({ ok: true }),
        (error): AIKeySaveResult => ({ ok: false, error: error instanceof Error ? error.message : String(error) }),
    );
};
