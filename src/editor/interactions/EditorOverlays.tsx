import { useCallback, useRef, useState, type ReactNode, type RefObject } from "react";
import type { EditorView } from "@codemirror/view";
import { applyEditorResult, toEditorActionState } from "../core/editorPresentation";
import type { EditorResult, EditorState } from "../../utils/editorActions";
import { applyTableOp, findTableAt, locateCell, type Align } from "../../utils/tableModel";
import { FindReplaceBar } from "../../components/FindReplaceBar";
import { FormatToolbar } from "../../components/FormatToolbar";
import { SlashMenu, type SlashCommand } from "../../components/SlashMenu";
import { AIBubble } from "../../components/AIBubble";
import { TableToolbar } from "../../components/TableToolbar";

type AIBubbleState = { x: number; y: number; selStart: number; selEnd: number; text: string };
type SlashState = { from: number; pos: { x: number; y: number } };
type TableUIState = { x: number; y: number; align: Align };

interface EditorOverlayControls {
    detectSlash: (view: EditorView) => void;
    detectTable: (view: EditorView) => void;
    openAIBubble: () => void;
    openFind: (mode: "find" | "replace", selectionStart: number) => void;
    toolbar: ReactNode;
    floatingOverlays: ReactNode;
}

interface UseEditorOverlaysOptions {
    viewRef: RefObject<EditorView | null>;
    aiConfig?: { endpoint: string; model: string; apiKey: string };
    onNoticeRef: RefObject<((message: string) => void) | undefined>;
    reviewingRef: RefObject<boolean>;
    showToolbar?: boolean;
    aiEnabled: boolean;
    content: string;
}

/**
 * Keeps DOM-oriented editor affordances out of the CodeMirror host. The host
 * reports cursor updates through detectSlash/detectTable; this layer owns the
 * resulting React UI state and translates its commands back to view dispatches.
 */
export function useEditorOverlays({
    viewRef,
    aiConfig,
    onNoticeRef,
    reviewingRef,
    showToolbar,
    aiEnabled,
    content,
}: UseEditorOverlaysOptions): EditorOverlayControls {
    const [findOpen, setFindOpen] = useState(false);
    const [findMode, setFindMode] = useState<"find" | "replace">("find");
    const [selStartForFind, setSelStartForFind] = useState(0);
    const [slashState, setSlashState] = useState<SlashState | null>(null);
    const [slashQuery, setSlashQuery] = useState("");
    const [aiBubble, setAIBubble] = useState<AIBubbleState | null>(null);
    const [tableUI, setTableUI] = useState<TableUIState | null>(null);
    const tableUIRef = useRef<TableUIState | null>(null);
    tableUIRef.current = tableUI;
    const slashStateRef = useRef<SlashState | null>(null);
    slashStateRef.current = slashState;

    const openAIBubble = useCallback(() => {
        const view = viewRef.current;
        if (!view) return;
        if (!aiConfig?.endpoint) {
            onNoticeRef.current?.("AI isn't set up yet — add an endpoint in Settings → AI to enable AI assist.");
            return;
        }
        const sel = view.state.selection.main;
        const coords = view.coordsAtPos(sel.head);
        const rect = view.scrollDOM.getBoundingClientRect();
        setAIBubble({
            x: coords ? coords.left : rect.left + 28,
            y: (coords ? coords.bottom : rect.top + 24) + 6,
            selStart: sel.from,
            selEnd: sel.to,
            text: view.state.doc.sliceString(sel.from, sel.to),
        });
    }, [aiConfig?.endpoint, onNoticeRef, viewRef]);
    const openFind = useCallback((mode: "find" | "replace", selectionStart: number) => {
        setSelStartForFind(selectionStart);
        setFindMode(mode);
        setFindOpen(true);
    }, []);

    const detectSlash = useCallback((view: EditorView) => {
        const head = view.state.selection.main.head;
        const doc = view.state.doc;
        const current = slashStateRef.current;
        if (current) {
            if (head < current.from + 1) { setSlashState(null); setSlashQuery(""); return; }
            const between = doc.sliceString(current.from + 1, head);
            if (between.includes("\n") || between.includes(" ")) { setSlashState(null); setSlashQuery(""); return; }
            setSlashQuery(between);
            return;
        }
        if (head > 0 && doc.sliceString(head - 1, head) === "/") {
            const line = doc.lineAt(head);
            const lineHead = doc.sliceString(line.from, head - 1);
            if (lineHead === "" || /^\s*$/.test(lineHead) || /\s$/.test(lineHead)) {
                const coords = view.coordsAtPos(head - 1);
                if (coords) {
                    setSlashState({ from: head - 1, pos: { x: coords.left, y: coords.bottom + 4 } });
                    setSlashQuery("");
                }
            }
        }
    }, []);

    const detectTable = useCallback((view: EditorView) => {
        if (reviewingRef.current) { if (tableUIRef.current) setTableUI(null); return; }
        const head = view.state.selection.main.head;
        const doc = view.state.doc;
        const currentLine = doc.lineAt(head);
        if (!currentLine.text.includes("|")) { if (tableUIRef.current) setTableUI(null); return; }

        const cap = 500;
        let first = currentLine.number;
        while (first > 1 && currentLine.number - first < cap && doc.line(first - 1).text.includes("|")) first--;
        let last = currentLine.number;
        while (last < doc.lines && last - currentLine.number < cap && doc.line(last + 1).text.includes("|")) last++;

        const sliceFrom = doc.line(first).from;
        const region = findTableAt(doc.sliceString(sliceFrom, doc.line(last).to), head - sliceFrom);
        if (!region) { if (tableUIRef.current) setTableUI(null); return; }
        const { colIndex } = locateCell(region, head - sliceFrom);
        const coords = view.coordsAtPos(region.from + sliceFrom);
        if (!coords) { if (tableUIRef.current) setTableUI(null); return; }
        setTableUI({ x: coords.left, y: coords.top, align: region.model.aligns[colIndex] ?? "none" });
    }, [reviewingRef]);

    const getState = useCallback((): EditorState | null => {
        const view = viewRef.current;
        return view ? toEditorActionState(view) : null;
    }, [viewRef]);
    const applyResult = useCallback((result: EditorResult) => {
        const view = viewRef.current;
        if (view) { applyEditorResult(view, result); view.focus(); }
    }, [viewRef]);
    const insertAtCaret = useCallback((text: string) => {
        const view = viewRef.current;
        if (!view) return;
        const selection = view.state.selection.main;
        view.dispatch({ changes: { from: selection.from, to: selection.to, insert: text }, selection: { anchor: selection.from + text.length } });
        view.focus();
    }, [viewRef]);
    const handleSlashSelect = useCallback((command: SlashCommand) => {
        const view = viewRef.current;
        const current = slashStateRef.current;
        if (!view || !current) return;
        const head = view.state.selection.main.head;
        const caretAt = current.from + (command.caretOffset ?? command.snippet.length);
        view.dispatch({ changes: { from: current.from, to: head, insert: command.snippet }, selection: { anchor: caretAt } });
        setSlashState(null);
        setSlashQuery("");
        view.focus();
    }, [viewRef]);
    const handleFindJump = useCallback((start: number, end: number) => {
        viewRef.current?.dispatch({ selection: { anchor: start, head: end }, scrollIntoView: true });
    }, [viewRef]);
    const handleFindReplace = useCallback((newContent: string, newCursor: number) => {
        const view = viewRef.current;
        if (view) applyEditorResult(view, { text: newContent, selStart: newCursor, selEnd: newCursor });
    }, [viewRef]);

    const toolbar = showToolbar
        ? <FormatToolbar getState={getState} apply={applyResult} insert={insertAtCaret} onAIAssist={aiEnabled ? openAIBubble : undefined} />
        : null;
    const floatingOverlays = (
        <>
            <FindReplaceBar
                isOpen={findOpen}
                initialMode={findMode}
                content={content}
                selectionStart={selStartForFind}
                onClose={() => { setFindOpen(false); viewRef.current?.focus(); }}
                onJumpTo={handleFindJump}
                onReplace={handleFindReplace}
            />
            <SlashMenu
                isOpen={!!slashState}
                position={slashState?.pos ?? null}
                query={slashQuery}
                onSelect={handleSlashSelect}
                onClose={() => { setSlashState(null); setSlashQuery(""); }}
            />
            {aiConfig && aiBubble && <AIBubble
                anchor={{ x: aiBubble.x, y: aiBubble.y }}
                selectedText={aiBubble.text}
                config={aiConfig}
                onReplace={(output) => {
                    const view = viewRef.current;
                    if (view) view.dispatch({ changes: { from: aiBubble.selStart, to: aiBubble.selEnd, insert: output }, selection: { anchor: aiBubble.selStart + output.length } });
                    setAIBubble(null);
                    view?.focus();
                }}
                onInsert={(output) => {
                    const view = viewRef.current;
                    const insertion = "\n\n" + output;
                    if (view) view.dispatch({ changes: { from: aiBubble.selEnd, to: aiBubble.selEnd, insert: insertion }, selection: { anchor: aiBubble.selEnd + insertion.length } });
                    setAIBubble(null);
                    view?.focus();
                }}
                onClose={() => setAIBubble(null)}
            />}
            {tableUI && <TableToolbar
                anchor={{ x: tableUI.x, y: tableUI.y }}
                activeAlign={tableUI.align}
                onOp={(operation) => {
                    const view = viewRef.current;
                    if (!view) return;
                    const result = applyTableOp(toEditorActionState(view), operation);
                    if (result) applyEditorResult(view, result);
                    view.focus();
                }}
            />}
        </>
    );

    return { detectSlash, detectTable, openAIBubble, openFind, toolbar, floatingOverlays };
}
