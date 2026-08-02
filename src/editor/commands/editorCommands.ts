import type { EditorResult, EditorState } from "../../utils/editorActions";
import { insertLink, wrapSelection } from "../../utils/editorActions";

export type EditorCommandId =
    | "format.bold" | "format.italic" | "format.underline" | "format.strike" | "format.inlineCode" | "format.link" | "format.clear"
    | "format.heading1" | "format.heading2" | "format.heading3" | "format.heading4" | "format.heading5" | "format.heading6" | "format.paragraph"
    | "format.bulletList" | "format.orderedList" | "format.taskList" | "format.blockquote"
    | "insert.codeBlock" | "insert.mathBlock" | "insert.table" | "insert.image" | "insert.rule";

export const EDITOR_COMMAND_EVENT = "mdtxt:editor-command";

function currentLine(state: EditorState) {
    const lineStart = state.text.lastIndexOf("\n", state.selStart - 1) + 1;
    const nextBreak = state.text.indexOf("\n", state.selStart);
    const lineEnd = nextBreak === -1 ? state.text.length : nextBreak;
    return { lineStart, lineEnd, line: state.text.slice(lineStart, lineEnd) };
}

export function setHeading(state: EditorState, level: number): EditorResult {
    const { lineStart, lineEnd, line } = currentLine(state);
    const stripped = line.replace(/^#{1,6}\s+/, "");
    const next = level === 0 ? stripped : `${"#".repeat(level)} ${stripped}`;
    const cursor = lineStart + Math.min(next.length, Math.max(0, state.selStart - lineStart + next.length - line.length));
    return { text: state.text.slice(0, lineStart) + next + state.text.slice(lineEnd), selStart: cursor, selEnd: cursor };
}

export function toggleLinePrefix(state: EditorState, prefix: string): EditorResult {
    const { lineStart, lineEnd, line } = currentLine(state);
    const next = line.startsWith(prefix) ? line.slice(prefix.length) : prefix + line;
    const delta = next.length - line.length;
    return {
        text: state.text.slice(0, lineStart) + next + state.text.slice(lineEnd),
        selStart: Math.max(lineStart, state.selStart + delta),
        selEnd: Math.max(lineStart, state.selEnd + delta),
    };
}

export function insertCodeBlock(state: EditorState): EditorResult {
    const selected = state.text.slice(state.selStart, state.selEnd) || "code";
    const inserted = `\n\`\`\`\n${selected}\n\`\`\`\n`;
    return {
        text: state.text.slice(0, state.selStart) + inserted + state.text.slice(state.selEnd),
        selStart: state.selStart + 4,
        selEnd: state.selStart + 4 + selected.length,
    };
}

export function insertMathBlock(state: EditorState): EditorResult {
    const selected = state.text.slice(state.selStart, state.selEnd) || "x^2";
    const inserted = `\n$$\n${selected}\n$$\n`;
    return {
        text: state.text.slice(0, state.selStart) + inserted + state.text.slice(state.selEnd),
        selStart: state.selStart + 4,
        selEnd: state.selStart + 4 + selected.length,
    };
}

export function insertText(state: EditorState, text: string): EditorResult {
    return {
        text: state.text.slice(0, state.selStart) + text + state.text.slice(state.selEnd),
        selStart: state.selStart + text.length,
        selEnd: state.selStart + text.length,
    };
}

export function clearFormatting(state: EditorState): EditorResult {
    if (state.selStart === state.selEnd) return state;
    const selected = state.text.slice(state.selStart, state.selEnd);
    const cleared = selected
        .replace(/\*\*([^\n]+?)\*\*/g, "$1")
        .replace(/__([^\n]+?)__/g, "$1")
        .replace(/~~([^\n]+?)~~/g, "$1")
        .replace(/<u>([^\n]+?)<\/u>/gi, "$1")
        .replace(/`([^`\n]+?)`/g, "$1")
        .replace(/\[([^\]\n]+)\]\([^\n)]+\)/g, "$1")
        .replace(/\*([^*\n]+?)\*/g, "$1")
        .replace(/_([^_\n]+?)_/g, "$1");
    return {
        text: state.text.slice(0, state.selStart) + cleared + state.text.slice(state.selEnd),
        selStart: state.selStart,
        selEnd: state.selStart + cleared.length,
    };
}

export function runEditorCommand(state: EditorState, command: EditorCommandId): EditorResult {
    switch (command) {
        case "format.bold": return wrapSelection(state, "**", "**", "bold");
        case "format.italic": return wrapSelection(state, "*", "*", "italic");
        case "format.underline": return wrapSelection(state, "<u>", "</u>", "text");
        case "format.strike": return wrapSelection(state, "~~", "~~", "text");
        case "format.inlineCode": return wrapSelection(state, "`", "`", "code");
        case "format.link": return insertLink(state);
        case "format.clear": return clearFormatting(state);
        case "format.heading1": return setHeading(state, 1);
        case "format.heading2": return setHeading(state, 2);
        case "format.heading3": return setHeading(state, 3);
        case "format.heading4": return setHeading(state, 4);
        case "format.heading5": return setHeading(state, 5);
        case "format.heading6": return setHeading(state, 6);
        case "format.paragraph": return setHeading(state, 0);
        case "format.bulletList": return toggleLinePrefix(state, "- ");
        case "format.orderedList": return toggleLinePrefix(state, "1. ");
        case "format.taskList": return toggleLinePrefix(state, "- [ ] ");
        case "format.blockquote": return toggleLinePrefix(state, "> ");
        case "insert.codeBlock": return insertCodeBlock(state);
        case "insert.mathBlock": return insertMathBlock(state);
        case "insert.table": return insertText(state, "\n| Header 1 | Header 2 |\n| --- | --- |\n| Cell | Cell |\n");
        case "insert.image": return insertText(state, "![Alt text](image.png)");
        case "insert.rule": return insertText(state, "\n\n---\n\n");
    }
}
