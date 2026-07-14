import { memo } from "react";
import { useEditorController, type EditorControllerOptions } from "../editor/core/useEditorController";
import { ReviewBanner } from "../editor/interactions/ReviewBanner";

export interface CodeEditorProps extends EditorControllerOptions {
    /** When non-null, show this proposed document as an inline diff (CodeMirror
     *  merge view) for the user to accept/reject. Null = no review in progress. */
    reviewDoc?: string | null;
    /** Called when the user finishes a review: the final document (accept) or
     *  null (rejected everything — keep the original). */
    onReviewResolve?: (finalDoc: string | null) => void;
}


function CodeEditorImpl(options: CodeEditorProps) {
    const { containerRef, reviewActive, acceptAllChanges, rejectAllChanges, toolbar, floatingOverlays } = useEditorController(options);

    return (
        <main className="flex-1 flex flex-col overflow-hidden relative">
            {reviewActive && <ReviewBanner onAccept={acceptAllChanges} onReject={rejectAllChanges} />}
            {toolbar}
            <div className="flex-1 overflow-hidden relative">
                <div ref={containerRef} className="absolute inset-0 [&_.cm-editor]:h-full [&_.cm-editor]:outline-none" />
                {floatingOverlays}
            </div>
        </main>
    );
}

export const CodeEditor = memo(CodeEditorImpl);
