import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "../context/LocaleContext";

interface SplitDividerProps {
    onDrag: (ratio: number) => void;
    containerRef: React.RefObject<HTMLDivElement | null>;
}

const MIN_RATIO = 0.2;
const MAX_RATIO = 0.8;

export function SplitDivider({ onDrag, containerRef }: SplitDividerProps) {
    const { t } = useLocale();
    const draggingRef = useRef(false);
    const [stacked, setStacked] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 899px)").matches);

    useEffect(() => {
        const query = window.matchMedia("(max-width: 899px)");
        const sync = () => setStacked(query.matches);
        sync();
        query.addEventListener("change", sync);
        return () => query.removeEventListener("change", sync);
    }, []);

    const computeRatio = useCallback((clientX: number, clientY: number) => {
        const c = containerRef.current;
        if (!c) return 0.5;
        const rect = c.getBoundingClientRect();
        const r = stacked ? (clientY - rect.top) / rect.height : (clientX - rect.left) / rect.width;
        return Math.min(MAX_RATIO, Math.max(MIN_RATIO, r));
    }, [containerRef, stacked]);

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        draggingRef.current = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        document.body.style.cursor = stacked ? "row-resize" : "col-resize";
        document.body.style.userSelect = "none";
    }, [stacked]);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!draggingRef.current) return;
        onDrag(computeRatio(e.clientX, e.clientY));
    }, [computeRatio, onDrag]);

    const onPointerUp = useCallback((e: React.PointerEvent) => {
        draggingRef.current = false;
        try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
    }, []);

    // Keyboard accessibility: arrow keys nudge the divider
    const onKeyDown = useCallback((e: React.KeyboardEvent) => {
        const decreaseKey = stacked ? "ArrowUp" : "ArrowLeft";
        const increaseKey = stacked ? "ArrowDown" : "ArrowRight";
        if (e.key === decreaseKey) {
            e.preventDefault();
            const c = containerRef.current;
            if (c) {
                const pane = (c.querySelector("[data-split-left]") as HTMLElement)?.getBoundingClientRect();
                const current = stacked ? pane?.height ?? 0 : pane?.width ?? 0;
                const rect = c.getBoundingClientRect();
                const total = stacked ? rect.height : rect.width;
                onDrag(Math.max(MIN_RATIO, current / total - 0.02));
            }
        } else if (e.key === increaseKey) {
            e.preventDefault();
            const c = containerRef.current;
            if (c) {
                const pane = (c.querySelector("[data-split-left]") as HTMLElement)?.getBoundingClientRect();
                const current = stacked ? pane?.height ?? 0 : pane?.width ?? 0;
                const rect = c.getBoundingClientRect();
                const total = stacked ? rect.height : rect.width;
                onDrag(Math.min(MAX_RATIO, current / total + 0.02));
            }
        }
    }, [containerRef, onDrag, stacked]);

    useEffect(() => {
        return () => {
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };
    }, []);

    return (
        <div
            role="separator"
            aria-label={t("Resize editor and preview panes")}
            aria-orientation={stacked ? "horizontal" : "vertical"}
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onKeyDown={onKeyDown}
            className={stacked
                ? "h-1 w-full shrink-0 bg-[var(--border)] hover:bg-[var(--accent)] active:bg-[var(--accent)] cursor-row-resize transition-colors relative group"
                : "w-1 h-full shrink-0 bg-[var(--border)] hover:bg-[var(--accent)] active:bg-[var(--accent)] cursor-col-resize transition-colors relative group"}
        >
            <div className={stacked ? "absolute inset-x-0 -top-1 -bottom-1 group-hover:bg-[var(--accent)]/10" : "absolute inset-y-0 -left-1 -right-1 group-hover:bg-[var(--accent)]/10"} />
        </div>
    );
}
