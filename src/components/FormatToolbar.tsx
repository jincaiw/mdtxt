import type { EditorResult, EditorState } from "../utils/editorActions";
import { runEditorCommand, type EditorCommandId } from "../editor/commands/editorCommands";
import { useLocale } from "../context/LocaleContext";

interface FormatToolbarProps {
    /** Returns the current editor text + selection, or null if not mounted. */
    getState: () => EditorState | null;
    /** Apply an EditorResult: parent updates content + restores selection. */
    apply: (r: EditorResult) => void;
    /** Open the AI assist bubble on the current selection. Renders an AI button
     *  when provided — the primary visible affordance for the AI feature
     *  (it was keyboard-only before). */
    onAIAssist?: () => void;
    onCopyFormatted?: () => void;
}

interface ToolButtonProps {
    icon: string;
    title: string;
    onClick: () => void;
}

function ToolButton({ icon, title, onClick }: ToolButtonProps) {
    return (
        <button
            type="button"
            onMouseDown={(e) => e.preventDefault()} // keep editor focus
            onClick={onClick}
            title={title}
            aria-label={title}
            className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
        >
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </button>
    );
}

const Sep = () => <div className="w-px h-5 bg-[var(--border)] mx-0.5" />;

export function FormatToolbar({ getState, apply, onAIAssist, onCopyFormatted }: FormatToolbarProps) {
    const { t } = useLocale();
    const command = (id: EditorCommandId) => () => {
        const st = getState();
        if (!st) return;
        apply(runEditorCommand(st, id));
    };

    return (
        <div className="flex items-center gap-0.5 px-2 h-9 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] no-select shrink-0">
            <ToolButton icon="format_h1" title={t("Heading 1")} onClick={command("format.heading1")} />
            <ToolButton icon="format_h2" title={t("Heading 2")} onClick={command("format.heading2")} />
            <ToolButton icon="format_h3" title={t("Heading 3")} onClick={command("format.heading3")} />
            <Sep />
            <ToolButton icon="format_bold" title={t("Bold (Ctrl+B)")} onClick={command("format.bold")} />
            <ToolButton icon="format_italic" title={t("Italic (Ctrl+I)")} onClick={command("format.italic")} />
            <ToolButton icon="strikethrough_s" title={t("Strikethrough")} onClick={command("format.strike")} />
            <ToolButton icon="code" title={t("Inline code")} onClick={command("format.inlineCode")} />
            <Sep />
            <ToolButton icon="format_list_bulleted" title={t("Bullet list")} onClick={command("format.bulletList")} />
            <ToolButton icon="format_list_numbered" title={t("Numbered list")} onClick={command("format.orderedList")} />
            <ToolButton icon="check_box" title={t("Task list")} onClick={command("format.taskList")} />
            <ToolButton icon="format_quote" title={t("Blockquote (Ctrl+/)")} onClick={command("format.blockquote")} />
            <Sep />
            <ToolButton icon="link" title={t("Link (Ctrl+K)")} onClick={command("format.link")} />
            <ToolButton icon="data_object" title={t("Code block")} onClick={command("insert.codeBlock")} />
            <ToolButton icon="table_chart" title={t("Insert table")} onClick={command("insert.table")} />
            <ToolButton icon="horizontal_rule" title={t("Horizontal rule")} onClick={command("insert.rule")} />
            {onCopyFormatted && <ToolButton icon="content_copy" title={t("Copy formatted selection")} onClick={onCopyFormatted} />}
            {onAIAssist && (
                <>
                    <Sep />
                    <ToolButton icon="auto_awesome" title={t("AI assist (Alt+Shift+J)")} onClick={onAIAssist} />
                </>
            )}
        </div>
    );
}
