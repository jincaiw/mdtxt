import { useEffect } from "react";
import { Window } from "@tauri-apps/api/window";
import { getDesktopPlatform, nativeWindowTitle } from "./desktopPlatform";

/** Synchronise the OS title bar and task switcher with the active document. */
export function useNativeWindowTitle(fileName?: string, isDirty = false): void {
    const title = nativeWindowTitle(fileName, isDirty);

    useEffect(() => {
        if (getDesktopPlatform() === "browser") return;
        Window.getCurrent().setTitle(title).catch(() => {
            // Browser mode and restricted test harnesses intentionally have no
            // native window bridge. Rendering must remain unaffected.
        });
    }, [title]);
}
