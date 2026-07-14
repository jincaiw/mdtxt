import { useCallback, useEffect, useRef } from "react";
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

    const computeRatio = useCallback((clientX: number) => {
        const c = containerRef.current;
        if (!c) return 0.5;
        const rect = c.getBoundingClientRect();
        const x = clientX - rect.left;
        const r = x / rect.width;
        return Math.min(MAX_RATIO, Math.max(MIN_RATIO, r));
    }, [containerRef]);

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        draggingRef.current = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    }, []);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!draggingRef.current) return;
        onDrag(computeRatio(e.clientX));
    }, [computeRatio, onDrag]);

    const onPointerUp = useCallback((e: React.PointerEvent) => {
        draggingRef.current = false;
        try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
    }, []);

    // Keyboard accessibility: arrow keys nudge the divider
    const onKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "ArrowLeft") {
            e.preventDefault();
            const c = containerRef.current;
            if (c) {
                const current = (c.querySelector("[data-split-left]") as HTMLElement)?.getBoundingClientRect().width ?? 0;
                const total = c.getBoundingClientRect().width;
                onDrag(Math.max(MIN_RATIO, current / total - 0.02));
            }
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            const c = containerRef.current;
            if (c) {
                const current = (c.querySelector("[data-split-left]") as HTMLElement)?.getBoundingClientRect().width ?? 0;
                const total = c.getBoundingClientRect().width;
                onDrag(Math.min(MAX_RATIO, current / total + 0.02));
            }
        }
    }, [containerRef, onDrag]);

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
            aria-orientation="vertical"
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onKeyDown={onKeyDown}
            className="w-1 shrink-0 bg-[var(--border)] hover:bg-[var(--accent)] active:bg-[var(--accent)] cursor-col-resize transition-colors relative group"
        >
            <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-[var(--accent)]/10" />
        </div>
    );
}
