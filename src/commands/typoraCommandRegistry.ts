/**
 * The Typora-compatible desktop command vocabulary.
 *
 * This is deliberately declarative: menus, key handlers, the command palette
 * and the shortcut reference must describe the same action instead of growing
 * their own incompatible shortcut tables. `windowsLinux` follows Typora's
 * documented Windows/Linux defaults and `macos` follows its macOS defaults.
 */
export type ShortcutPlatform = "macos" | "windows" | "linux";

export type TyporaCommandId =
    | "file.new" | "file.newTab" | "file.reopenClosed" | "file.open" | "file.quickOpen" | "file.save" | "file.saveAs" | "file.close"
    | "edit.copyMarkdown" | "edit.pastePlain" | "edit.find" | "edit.replace" | "edit.jumpSelection"
    | "paragraph.heading1" | "paragraph.heading2" | "paragraph.heading3" | "paragraph.heading4" | "paragraph.heading5" | "paragraph.heading6"
    | "paragraph.paragraph" | "paragraph.table" | "paragraph.codeFence" | "paragraph.mathBlock" | "paragraph.quote"
    | "paragraph.orderedList" | "paragraph.bulletList" | "paragraph.indent" | "paragraph.outdent"
    | "format.strong" | "format.emphasis" | "format.underline" | "format.inlineCode" | "format.strike" | "format.link" | "format.image" | "format.clear"
    | "view.sidebar" | "view.outline" | "view.articles" | "view.fileTree" | "view.source" | "view.focus" | "view.typewriter" | "view.fullscreen"
    | "window.nextDocument"
    | "app.preferences";

export interface TyporaCommandDefinition {
    id: TyporaCommandId;
    label: string;
    section: "File" | "Edit" | "Paragraph" | "Format" | "View" | "Application";
    windowsLinux: string;
    macos: string;
}

const command = (
    id: TyporaCommandId,
    label: string,
    section: TyporaCommandDefinition["section"],
    windowsLinux: string,
    macos: string,
): TyporaCommandDefinition => ({ id, label, section, windowsLinux, macos });

export const TYPOGRAPHIC_COMMANDS: readonly TyporaCommandDefinition[] = [
    command("file.new", "New file", "File", "Ctrl+N", "Cmd+N"),
    command("file.newTab", "New tab", "File", "Ctrl+N", "Cmd+T"),
    command("file.reopenClosed", "Reopen closed file", "File", "Ctrl+Shift+T", "Cmd+Shift+T"),
    command("file.open", "Open file…", "File", "Ctrl+O", "Cmd+O"),
    command("file.quickOpen", "Open quickly", "File", "Ctrl+P", "Cmd+Shift+O"),
    command("file.save", "Save", "File", "Ctrl+S", "Cmd+S"),
    command("file.saveAs", "Save As…", "File", "Ctrl+Shift+S", "Cmd+Shift+S"),
    command("file.close", "Close", "File", "Ctrl+W", "Cmd+W"),
    command("edit.copyMarkdown", "Copy as Markdown", "Edit", "Ctrl+Shift+C", "Cmd+Shift+C"),
    command("edit.pastePlain", "Paste as plain text", "Edit", "Ctrl+Shift+V", "Cmd+Shift+V"),
    command("edit.find", "Find", "Edit", "Ctrl+F", "Cmd+F"),
    command("edit.replace", "Find and replace", "Edit", "Ctrl+H", "Cmd+H"),
    command("edit.jumpSelection", "Jump to selection", "Edit", "Ctrl+J", "Cmd+J"),
    command("paragraph.heading1", "Heading 1", "Paragraph", "Ctrl+1", "Cmd+1"),
    command("paragraph.heading2", "Heading 2", "Paragraph", "Ctrl+2", "Cmd+2"),
    command("paragraph.heading3", "Heading 3", "Paragraph", "Ctrl+3", "Cmd+3"),
    command("paragraph.heading4", "Heading 4", "Paragraph", "Ctrl+4", "Cmd+4"),
    command("paragraph.heading5", "Heading 5", "Paragraph", "Ctrl+5", "Cmd+5"),
    command("paragraph.heading6", "Heading 6", "Paragraph", "Ctrl+6", "Cmd+6"),
    command("paragraph.paragraph", "Paragraph", "Paragraph", "Ctrl+0", "Cmd+0"),
    command("paragraph.table", "Table", "Paragraph", "Ctrl+T", "Cmd+Option+T"),
    command("paragraph.codeFence", "Code fences", "Paragraph", "Ctrl+Shift+K", "Cmd+Option+C"),
    command("paragraph.mathBlock", "Math block", "Paragraph", "Ctrl+Shift+M", "Cmd+Option+B"),
    command("paragraph.quote", "Quote", "Paragraph", "Ctrl+Shift+Q", "Cmd+Option+Q"),
    command("paragraph.orderedList", "Ordered list", "Paragraph", "Ctrl+Shift+[", "Cmd+Option+O"),
    command("paragraph.bulletList", "Unordered list", "Paragraph", "Ctrl+Shift+]", "Cmd+Option+U"),
    command("paragraph.indent", "Indent", "Paragraph", "Ctrl+[ / Tab", "Cmd+[ / Tab"),
    command("paragraph.outdent", "Outdent", "Paragraph", "Ctrl+] / Shift+Tab", "Cmd+] / Shift+Tab"),
    command("format.strong", "Strong", "Format", "Ctrl+B", "Cmd+B"),
    command("format.emphasis", "Emphasis", "Format", "Ctrl+I", "Cmd+I"),
    command("format.underline", "Underline", "Format", "Ctrl+U", "Cmd+U"),
    command("format.inlineCode", "Code", "Format", "Ctrl+Shift+`", "Cmd+Shift+`"),
    command("format.strike", "Strikethrough", "Format", "Alt+Shift+5", "Ctrl+Shift+`"),
    command("format.link", "Hyperlink", "Format", "Ctrl+K", "Cmd+K"),
    command("format.image", "Image", "Format", "Ctrl+Shift+I", "Cmd+Ctrl+I"),
    command("format.clear", "Clear format", "Format", "Ctrl+\\", "Cmd+\\"),
    command("view.sidebar", "Toggle sidebar", "View", "Ctrl+Shift+L", "Cmd+Shift+L"),
    command("view.outline", "Outline", "View", "Ctrl+Shift+1", "Cmd+Ctrl+1"),
    command("view.articles", "Articles", "View", "Ctrl+Shift+2", "Cmd+Ctrl+2"),
    command("view.fileTree", "File tree", "View", "Ctrl+Shift+3", "Cmd+Ctrl+3"),
    command("view.source", "Source code mode", "View", "Ctrl+/", "Cmd+/"),
    command("view.focus", "Focus mode", "View", "F8", "F8"),
    command("view.typewriter", "Typewriter mode", "View", "F9", "F9"),
    command("view.fullscreen", "Toggle fullscreen", "View", "F11", "Cmd+Option+F"),
    command("window.nextDocument", "Switch between opened documents", "View", "Ctrl+Tab", "Cmd+`"),
    command("app.preferences", "Preferences…", "Application", "Ctrl+,", "Cmd+,"),
] as const;

const byId = new Map(TYPOGRAPHIC_COMMANDS.map((definition) => [definition.id, definition]));

export function getTyporaCommand(id: TyporaCommandId): TyporaCommandDefinition {
    const definition = byId.get(id);
    if (!definition) throw new Error(`Unknown Typora command: ${id}`);
    return definition;
}

export function shortcutFor(id: TyporaCommandId, platform: ShortcutPlatform): string {
    const definition = getTyporaCommand(id);
    return platform === "macos" ? definition.macos : definition.windowsLinux;
}

export function getShortcutPlatform(userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent): ShortcutPlatform {
    if (/mac/i.test(userAgent)) return "macos";
    if (/linux/i.test(userAgent)) return "linux";
    return "windows";
}
