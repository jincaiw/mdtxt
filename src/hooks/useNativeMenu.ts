import { useEffect, useRef } from "react";
import { CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu";

export type NativeCommandId = string;

export interface NativeMenuState {
    hasDocument: boolean;
    canReveal: boolean;
    mode: "preview" | "code" | "split" | "live";
    fileExplorerOpen: boolean;
    outlineOpen: boolean;
    toolbarOpen: boolean;
    typewriterOpen: boolean;
    focusModeOpen: boolean;
    aiEnabled: boolean;
}

export interface NativeMenuOptions {
    state: NativeMenuState;
    commands: Readonly<Record<NativeCommandId, (() => void) | undefined>>;
    translate: (text: string) => string;
}

const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform || navigator.userAgent || "");

/**
 * The native menu is intentionally a thin view over the app command dispatcher.
 * Handlers live in a ref so Tauri's long-lived menu resources always execute
 * the current document/view state instead of a closure from first render.
 */
export function useNativeMenu({ state, commands, translate }: NativeMenuOptions) {
    const commandRef = useRef(commands);
    commandRef.current = commands;

    useEffect(() => {
        // `withGlobalTauri` stays disabled for CSP hygiene, so the API helper's
        // `isTauri()` global flag is intentionally absent. The internal bridge
        // is the same runtime probe used elsewhere in this application.
        if (!("__TAURI_INTERNALS__" in window)) return;
        let cancelled = false;
        let installed: Menu | null = null;
        const invoke = (id: NativeCommandId) => () => commandRef.current[id]?.();
        const item = (id: NativeCommandId, text: string, accelerator?: string, enabled = true) => MenuItem.new({
            id, text: translate(text), accelerator, enabled, action: invoke(id),
        });
        const check = (id: NativeCommandId, text: string, checked: boolean, accelerator?: string, enabled = true) => CheckMenuItem.new({
            id, text: translate(text), checked, accelerator, enabled, action: invoke(id),
        });
        const separator = () => PredefinedMenuItem.new({ item: "Separator" });

        const build = async () => {
            try {
                const file = await Submenu.new({ text: translate("File"), items: [
                    await item("file.new", "New file", "CmdOrCtrl+N"),
                    await item("file.open", "Open file…", "CmdOrCtrl+O"),
                    await separator(),
                    await item("file.save", "Save", "CmdOrCtrl+S", state.hasDocument),
                    await item("file.saveAs", "Save As…", "CmdOrCtrl+Shift+S", state.hasDocument),
                    await separator(),
                    await item("file.reveal", "Reveal in folder", undefined, state.canReveal),
                    await item("file.copyPath", "Copy file path", undefined, state.canReveal),
                    await item("file.stats", "Document statistics", undefined, state.hasDocument),
                    await separator(),
                    await Submenu.new({ text: translate("Export"), items: [
                        await item("export.html", "HTML", undefined, state.hasDocument),
                        await item("export.pdf", "PDF", undefined, state.hasDocument),
                        await item("export.docx", "Word (.docx)", undefined, state.hasDocument),
                    ] }),
                    await separator(),
                    await item("tab.close", "Close tab", "CmdOrCtrl+W", state.hasDocument),
                ] });

                const edit = await Submenu.new({ text: translate("Edit"), items: [
                    await PredefinedMenuItem.new({ item: "Undo" }), await PredefinedMenuItem.new({ item: "Redo" }), await separator(),
                    await PredefinedMenuItem.new({ item: "Cut" }), await PredefinedMenuItem.new({ item: "Copy" }), await PredefinedMenuItem.new({ item: "Paste" }), await PredefinedMenuItem.new({ item: "SelectAll" }), await separator(),
                    await item("editor.find", "Find", "CmdOrCtrl+F", state.hasDocument),
                    await item("editor.replace", "Find and replace", "CmdOrCtrl+H", state.hasDocument),
                ] });

                const format = await Submenu.new({ text: translate("Format"), items: [
                    await item("format.heading1", "Heading 1", "CmdOrCtrl+Shift+1", state.hasDocument),
                    await item("format.heading2", "Heading 2", "CmdOrCtrl+Shift+2", state.hasDocument),
                    await item("format.heading3", "Heading 3", "CmdOrCtrl+Shift+3", state.hasDocument),
                    await item("format.heading4", "Heading 4", "CmdOrCtrl+Shift+4", state.hasDocument),
                    await item("format.heading5", "Heading 5", "CmdOrCtrl+Shift+5", state.hasDocument),
                    await item("format.heading6", "Heading 6", "CmdOrCtrl+Shift+6", state.hasDocument),
                    await item("format.paragraph", "Paragraph", "CmdOrCtrl+Shift+0", state.hasDocument), await separator(),
                    await item("format.bold", "Bold", "CmdOrCtrl+B", state.hasDocument),
                    await item("format.italic", "Italic", "CmdOrCtrl+I", state.hasDocument),
                    await item("format.strike", "Strikethrough", "CmdOrCtrl+Shift+X", state.hasDocument),
                    await item("format.inlineCode", "Inline code", "CmdOrCtrl+Shift+`", state.hasDocument),
                    await item("format.link", "Link", "CmdOrCtrl+K", state.hasDocument), await separator(),
                    await item("format.bulletList", "Bullet list", "CmdOrCtrl+Shift+8", state.hasDocument),
                    await item("format.orderedList", "Numbered list", "CmdOrCtrl+Shift+7", state.hasDocument),
                    await item("format.taskList", "Task list", "CmdOrCtrl+Shift+9", state.hasDocument),
                    await item("format.blockquote", "Blockquote", "CmdOrCtrl+/", state.hasDocument),
                    await item("insert.codeBlock", "Code block", "CmdOrCtrl+Shift+C", state.hasDocument),
                    await item("insert.table", "Insert table", undefined, state.hasDocument),
                    await item("insert.rule", "Horizontal rule", undefined, state.hasDocument),
                ] });

                const view = await Submenu.new({ text: translate("View"), items: [
                    await check("view.code", "Source", state.mode === "code", undefined, state.hasDocument),
                    await check("view.live", "Live", state.mode === "live", "CmdOrCtrl+Shift+L", state.hasDocument),
                    await check("view.split", "Split", state.mode === "split", "CmdOrCtrl+\\", state.hasDocument),
                    await check("view.preview", "Reader", state.mode === "preview", "CmdOrCtrl+E", state.hasDocument), await separator(),
                    await check("view.explorer", "File explorer", state.fileExplorerOpen, "CmdOrCtrl+Shift+E", state.hasDocument),
                    await check("view.outline", "Outline", state.outlineOpen, "CmdOrCtrl+Shift+O", state.hasDocument),
                    await check("view.toolbar", "Formatting toolbar", state.toolbarOpen, undefined, state.hasDocument),
                    await check("view.typewriter", "Typewriter mode", state.typewriterOpen, "F9", state.hasDocument),
                    await check("view.focus", "Focus mode", state.focusModeOpen, "F8", state.hasDocument),
                    await separator(), await item("view.fullscreen", "Toggle fullscreen", "F11"),
                ] });

                const ai = await Submenu.new({ text: "AI", items: [
                    await item("ai.assist", "AI assist on selection", isMac ? "Cmd+J" : "Alt+J", state.hasDocument && state.aiEnabled),
                ] });
                const windowMenu = await Submenu.new({ text: translate("Window"), items: [
                    // Keep tab-cycle accelerators registered even on the
                    // welcome screen. Their handlers safely no-op with no tabs,
                    // and this avoids a disabled-menu race while crash-recovery
                    // tabs are mounted and the native menu is rebuilt.
                    await item("tab.previous", "Previous tab"),
                    await item("tab.next", "Next tab"),
                    await separator(),
                    await PredefinedMenuItem.new({ item: "Minimize" }), await PredefinedMenuItem.new({ item: "Maximize" }),
                    await PredefinedMenuItem.new({ item: "Fullscreen" }), await PredefinedMenuItem.new({ item: "CloseWindow" }),
                ] });
                const help = await Submenu.new({ text: translate("Help"), items: [
                    await item("help.shortcuts", "Keyboard shortcuts", "?"),
                    await item("help.guide", "Open the interactive guide"),
                    await item("help.tour", "Replay the welcome tour"),
                ] });
                const topLevel = [file, edit, format, view, ai, windowMenu, help];
                if (isMac) {
                    const app = await Submenu.new({ text: "mdtxt", items: [
                        await PredefinedMenuItem.new({ item: { About: null } }), await separator(),
                        await item("settings.open", "Settings…", "CmdOrCtrl+,"), await separator(),
                        await PredefinedMenuItem.new({ item: "Services" }), await separator(),
                        await PredefinedMenuItem.new({ item: "Hide" }), await PredefinedMenuItem.new({ item: "HideOthers" }), await PredefinedMenuItem.new({ item: "ShowAll" }), await separator(),
                        await PredefinedMenuItem.new({ item: "Quit" }),
                    ] });
                    topLevel.unshift(app);
                } else {
                    await edit.append(await separator());
                    await edit.append(await item("settings.open", "Settings…", "CmdOrCtrl+,"));
                }
                const menu = await Menu.new({ items: topLevel });
                if (cancelled) { await menu.close(); return; }
                installed = menu;
                const previous = isMac ? await menu.setAsAppMenu() : await menu.setAsWindowMenu();
                await previous?.close();
            } catch (error) {
                // A menu failure must never prevent the editor from mounting;
                // browser mode retains its keyboard and command-palette paths.
                console.error("Could not install native menu", error);
            }
        };
        void build();
        return () => {
            cancelled = true;
            void installed?.close();
        };
    }, [state, translate]);
}
