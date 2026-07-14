import { useEffect, useRef, type RefObject } from "react";
import { EditorView } from "@codemirror/view";
import type { Scroller } from "../../utils/scrollSync";

interface EditorViewportBridgeOptions {
    viewRef: RefObject<EditorView | null>;
    onScrollFractionRef: RefObject<((fraction: number) => void) | undefined>;
    registerScroller?: (scroller: Scroller | null) => void;
}

/**
 * Owns the window-level viewport protocol for the single retained EditorView.
 * Keeping it separate from editor commands ensures scroll synchronization and
 * navigation can evolve without becoming part of the document state model.
 */
export function useEditorViewportBridge({
    viewRef,
    onScrollFractionRef,
    registerScroller,
}: EditorViewportBridgeOptions) {
    const scrollRafRef = useRef(0);

    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        const scroller = view.scrollDOM;
        const onScroll = () => {
            if (scrollRafRef.current) return;
            scrollRafRef.current = requestAnimationFrame(() => {
                scrollRafRef.current = 0;
                const max = scroller.scrollHeight - scroller.clientHeight;
                onScrollFractionRef.current?.(max > 0 ? scroller.scrollTop / max : 0);
            });
        };
        scroller.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            scroller.removeEventListener("scroll", onScroll);
            if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
        };
    }, [onScrollFractionRef, viewRef]);

    useEffect(() => {
        if (!registerScroller) return;
        registerScroller({
            setFraction: (fraction: number) => {
                const view = viewRef.current;
                if (!view) return;
                const scroller = view.scrollDOM;
                const max = scroller.scrollHeight - scroller.clientHeight;
                if (max > 0) scroller.scrollTop = max * fraction;
            },
        });
        return () => registerScroller(null);
    }, [registerScroller, viewRef]);

    useEffect(() => {
        const goToLine = (event: Event) => {
            const line = Number((event as CustomEvent).detail?.line);
            const view = viewRef.current;
            if (!view || !Number.isFinite(line) || line < 1) return;
            const docLine = view.state.doc.line(Math.min(Math.floor(line), view.state.doc.lines));
            view.dispatch({
                selection: { anchor: docLine.from },
                effects: EditorView.scrollIntoView(docLine.from, { y: "start", yMargin: 8 }),
            });
        };
        window.addEventListener("mdtxt:goto-line", goToLine);
        return () => window.removeEventListener("mdtxt:goto-line", goToLine);
    }, [viewRef]);

    useEffect(() => {
        const scrollToTop = () => {
            const view = viewRef.current;
            if (!view) return;
            view.dispatch({
                selection: { anchor: 0 },
                effects: EditorView.scrollIntoView(0, { y: "start" }),
            });
            view.scrollDOM.scrollTop = 0;
        };
        window.addEventListener("mdtxt:scroll-top", scrollToTop);
        return () => window.removeEventListener("mdtxt:scroll-top", scrollToTop);
    }, [viewRef]);
}
