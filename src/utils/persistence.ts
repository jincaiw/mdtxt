/**
 * localStorage-backed persistence for app state across sessions.
 * Tauri's webview has localStorage available; values survive app restarts.
 */

const KEY_RECENT_FILES = "marklite:recentFiles";
const KEY_LAST_FILE = "marklite:lastFile";
const KEY_VIEW_MODE = "marklite:viewMode";
const KEY_SPLIT_RATIO = "marklite:splitRatio";

const MAX_RECENT = 10;

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

export const getSavedViewMode = (): "preview" | "code" | "split" =>
    safeGet<"preview" | "code" | "split">(KEY_VIEW_MODE, "preview");
export const setSavedViewMode = (m: "preview" | "code" | "split"): void => safeSet(KEY_VIEW_MODE, m);

export const getSplitRatio = (): number => {
    const r = safeGet<number>(KEY_SPLIT_RATIO, 0.5);
    return Number.isFinite(r) && r > 0.15 && r < 0.85 ? r : 0.5;
};
export const setSplitRatio = (r: number): void => safeSet(KEY_SPLIT_RATIO, r);

const KEY_AUTOSAVE = "marklite:autoSave";
export const getAutoSave = (): boolean => safeGet<boolean>(KEY_AUTOSAVE, false);
export const setAutoSave = (v: boolean): void => safeSet(KEY_AUTOSAVE, v);

const KEY_FOCUS_MODE = "marklite:focusMode";
const KEY_TYPEWRITER_MODE = "marklite:typewriterMode";
const KEY_TOOLBAR = "marklite:toolbar";
export const getFocusMode = (): boolean => safeGet<boolean>(KEY_FOCUS_MODE, false);
export const setFocusMode = (v: boolean): void => safeSet(KEY_FOCUS_MODE, v);
export const getTypewriterMode = (): boolean => safeGet<boolean>(KEY_TYPEWRITER_MODE, false);
export const setTypewriterMode = (v: boolean): void => safeSet(KEY_TYPEWRITER_MODE, v);
export const getToolbarEnabled = (): boolean => safeGet<boolean>(KEY_TOOLBAR, false);
export const setToolbarEnabled = (v: boolean): void => safeSet(KEY_TOOLBAR, v);

const KEY_AI_ENDPOINT = "marklite:aiEndpoint";
const KEY_AI_MODEL = "marklite:aiModel";
const KEY_AI_API_KEY = "marklite:aiApiKey";
export const getAIConfig = (): { endpoint: string; model: string; apiKey: string } => ({
    endpoint: safeGet<string>(KEY_AI_ENDPOINT, ""),
    model: safeGet<string>(KEY_AI_MODEL, ""),
    apiKey: safeGet<string>(KEY_AI_API_KEY, ""),
});
export const setAIConfig = (cfg: { endpoint: string; model: string; apiKey: string }): void => {
    safeSet(KEY_AI_ENDPOINT, cfg.endpoint);
    safeSet(KEY_AI_MODEL, cfg.model);
    safeSet(KEY_AI_API_KEY, cfg.apiKey);
};
