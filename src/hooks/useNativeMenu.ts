import { useEffect, useRef } from "react";
import { CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu";

export type NativeCommandId = string;

export interface NativeMenuState {
    hasDocument: boolean;
    canReveal: boolean;
    mode: "preview" | "code" | "split" | "live";
    fileExplorerOpen: boolean;
    articlesOpen: boolean;
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
                    ...(isMac ? [await item("file.newTab", "New tab", "Cmd+T")] : []),
                    await item("file.open", "Open file…", "CmdOrCtrl+O"),
                    await item("file.quickOpen", "Open quickly", isMac ? "Cmd+Shift+O" : "Ctrl+P", state.hasDocument),
                    await separator(),
                    await item("file.save", "Save", "CmdOrCtrl+S", state.hasDocument),
                    await item("file.saveAs", "Save As…", "CmdOrCtrl+Shift+S", state.hasDocument),
                    await separator(),
                    await item("file.reveal", "Reveal in folder", undefined, state.canReveal),
                    await item("file.copyPath", "Copy file path", undefined, state.canReveal),
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
                    // AppKit may suppress custom Edit items whose key
                    // equivalents collide with the hosted WKWebView. The
                    // editor owns these shortcuts; keep the menu entries
                    // visible and dispatch them through the same command path.
                    await item("editor.copyMarkdown", "Copy as Markdown", undefined, state.hasDocument),
                    await item("editor.pastePlain", "Paste as plain text", undefined, state.hasDocument),
                    await item("editor.jumpSelection", "Jump to selection", undefined, state.hasDocument),
                    await item("editor.find", "Find", "CmdOrCtrl+F", state.hasDocument),
                    await item("editor.replace", "Find and replace", "CmdOrCtrl+H", state.hasDocument),
                ] });

                const paragraph = await Submenu.new({ text: translate("Paragraph"), items: [
                    await item("format.heading1", "Heading 1", "CmdOrCtrl+1", state.hasDocument),
                    await item("format.heading2", "Heading 2", "CmdOrCtrl+2", state.hasDocument),
                    await item("format.heading3", "Heading 3", "CmdOrCtrl+3", state.hasDocument),
                    await item("format.heading4", "Heading 4", "CmdOrCtrl+4", state.hasDocument),
                    await item("format.heading5", "Heading 5", "CmdOrCtrl+5", state.hasDocument),
                    await item("format.heading6", "Heading 6", "CmdOrCtrl+6", state.hasDocument),
                    await item("format.paragraph", "Paragraph", "CmdOrCtrl+0", state.hasDocument), await separator(),
                    await item("insert.table", "Table", isMac ? "Cmd+Alt+T" : "Ctrl+T", state.hasDocument),
                    await item("insert.codeBlock", "Code fences", isMac ? "Cmd+Alt+C" : "Ctrl+Shift+K", state.hasDocument),
                    await item("insert.mathBlock", "Math block", isMac ? "Cmd+Alt+B" : "Ctrl+Shift+M", state.hasDocument),
                    await item("format.blockquote", "Quote", isMac ? "Cmd+Alt+Q" : "Ctrl+Shift+Q", state.hasDocument),
                    await item("format.orderedList", "Ordered list", isMac ? "Cmd+Alt+O" : "Ctrl+Shift+[", state.hasDocument),
                    await item("format.bulletList", "Unordered list", isMac ? "Cmd+Alt+U" : "Ctrl+Shift+]", state.hasDocument),
                    await item("format.taskList", "Task list", undefined, state.hasDocument),
                    await item("insert.rule", "Horizontal rule", undefined, state.hasDocument),
                ] });

                const format = await Submenu.new({ text: translate("Format"), items: [
                    await item("format.bold", "Bold", "CmdOrCtrl+B", state.hasDocument),
                    await item("format.italic", "Italic", "CmdOrCtrl+I", state.hasDocument),
                    await item("format.underline", "Underline", "CmdOrCtrl+U", state.hasDocument),
                    await item("format.strike", "Strikethrough", isMac ? "Ctrl+Shift+`" : "Alt+Shift+5", state.hasDocument),
                    await item("format.inlineCode", "Inline code", "CmdOrCtrl+Shift+`", state.hasDocument),
                    await item("format.link", "Link", "CmdOrCtrl+K", state.hasDocument),
                    await item("insert.image", "Image", isMac ? "Cmd+Ctrl+I" : "Ctrl+Shift+I", state.hasDocument),
                    await item("format.clear", "Clear format", "CmdOrCtrl+\\", state.hasDocument),
                ] });

                const view = await Submenu.new({ text: translate("View"), items: [
                    await check("view.source", "Source code mode", state.mode === "code", "CmdOrCtrl+/", state.hasDocument), await separator(),
                    await check("view.sidebar", "Toggle sidebar", state.fileExplorerOpen || state.outlineOpen, "CmdOrCtrl+Shift+L", state.hasDocument),
                    await check("view.outline", "Outline", state.outlineOpen, isMac ? "Cmd+Ctrl+1" : "Ctrl+Shift+1", state.hasDocument),
                    await check("view.articles", "Articles", state.articlesOpen, undefined, state.hasDocument),
                    await check("view.explorer", "File tree", state.fileExplorerOpen && !state.articlesOpen, isMac ? "Cmd+Ctrl+3" : "Ctrl+Shift+3", state.hasDocument),
                    await check("view.toolbar", "Formatting toolbar", state.toolbarOpen, undefined, state.hasDocument),
                    await check("view.typewriter", "Typewriter mode", state.typewriterOpen, "F9", state.hasDocument),
                    await check("view.focus", "Focus mode", state.focusModeOpen, "F8", state.hasDocument),
                    await item("view.search", "Search across files", "CmdOrCtrl+Shift+F", state.hasDocument),
                    await item("file.stats", "Document statistics", undefined, state.hasDocument),
                    await separator(), await item("view.fullscreen", "Toggle fullscreen", isMac ? "Cmd+Alt+F" : "F11"),
                ] });

                const ai = await Submenu.new({ text: "AI", items: [
                    // Keep Cmd/Ctrl+J available for Typora's native "Jump to
                    // selection" command. AI is deliberately an optional
                    // mdtxt extension and must not steal that muscle memory.
                    await item("ai.assist", "AI assist on selection", "Alt+Shift+J", state.hasDocument && state.aiEnabled),
                ] });
                const windowMenu = await Submenu.new({ text: translate("Window"), items: [
                    // Keep tab-cycle accelerators registered even on the
                    // welcome screen. Their handlers safely no-op with no tabs,
                    // and this avoids a disabled-menu race while crash-recovery
                    // tabs are mounted and the native menu is rebuilt.
                    await item("tab.previous", "Previous tab", "Ctrl+Shift+Tab"),
                    await item("tab.next", "Next tab", isMac ? "Cmd+`" : "Ctrl+Tab"),
                    await separator(),
                    await PredefinedMenuItem.new({ item: "Minimize" }), await PredefinedMenuItem.new({ item: "Maximize" }),
                    await PredefinedMenuItem.new({ item: "Fullscreen" }), await PredefinedMenuItem.new({ item: "CloseWindow" }),
                ] });
                const help = await Submenu.new({ text: translate("Help"), items: [
                    await item("help.shortcuts", "Keyboard shortcuts", "?"),
                    await item("help.guide", "Open the interactive guide"),
                    await item("help.tour", "Replay the welcome tour"),
                ] });
                const topLevel = [file, edit, paragraph, format, view, ai, windowMenu, help];
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
