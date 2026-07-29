import { useCallback, useEffect, useRef } from "react";
import { useLocale } from "../context/LocaleContext";

interface PanelResizeHandleProps {
    side: "left" | "right";
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
}

export function PanelResizeHandle({ side, value, min, max, onChange }: PanelResizeHandleProps) {
    const { t } = useLocale();
    const startRef = useRef<{ x: number; value: number } | null>(null);
    const clamp = useCallback((next: number) => Math.min(max, Math.max(min, next)), [max, min]);

    const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        startRef.current = { x: event.clientX, value };
        event.currentTarget.setPointerCapture(event.pointerId);
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    }, [value]);

    const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        const start = startRef.current;
        if (!start) return;
        const delta = event.clientX - start.x;
        onChange(clamp(start.value + (side === "left" ? delta : -delta)));
    }, [clamp, onChange, side]);

    const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        startRef.current = null;
        try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* already released */ }
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
    }, []);

    const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const delta = event.key === "ArrowRight" ? 12 : -12;
        onChange(clamp(value + (side === "left" ? delta : -delta)));
    }, [clamp, onChange, side, value]);

    useEffect(() => () => {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
    }, []);

    return (
        <div
            role="separator"
            aria-label={t(side === "left" ? "Resize navigation sidebar" : "Resize AI panel")}
            aria-orientation="vertical"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={Math.round(value)}
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onKeyDown={onKeyDown}
            className={`workspace-resize-handle workspace-resize-handle-${side}`}
        />
    );
}
