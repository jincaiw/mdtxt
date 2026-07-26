export type DesktopPlatform = "macos" | "windows" | "linux" | "browser";

export function isTauriRuntime(): boolean {
    return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Keep all desktop-window branching in one place. Browser development keeps
 * the application toolbar but deliberately has no fake window controls.
 */
export function getDesktopPlatform(): DesktopPlatform {
    if (!isTauriRuntime()) return "browser";
    const value = typeof navigator === "undefined" ? "" : `${navigator.platform} ${navigator.userAgent}`;
    if (/mac/i.test(value)) return "macos";
    if (/win/i.test(value)) return "windows";
    return "linux";
}

export function nativeWindowTitle(fileName?: string, isDirty = false): string {
    if (!fileName) return "mdtxt";
    return `${fileName}${isDirty ? " *" : ""} — mdtxt`;
}
