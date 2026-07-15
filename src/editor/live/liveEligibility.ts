import { parser } from "@lezer/markdown";

export const LIVE_LIMITS = {
    maxBytes: 5 * 1024 * 1024,
    maxLines: 100_000,
    maxLineLength: 32_000,
    maxComplexBlocks: 200,
} as const;

export type LiveRestrictionReason = "bytes" | "lines" | "lineLength" | "complexBlocks";

export interface LiveEligibility {
    restricted: boolean;
    reasons: readonly LiveRestrictionReason[];
    bytes: number;
    lines: number;
    maxLineLength: number;
    complexBlocks: number;
}

/** A versioned source snapshot used to keep admission work off the typing path. */
export interface LiveEligibilitySnapshot {
    documentId: string;
    version: number;
    value: string;
}

/**
 * Prefer the debounced presentation snapshot once it catches up with the
 * active editor revision. On a document/mode transition it is necessarily
 * stale for one render, so use the current editor snapshot to avoid briefly
 * admitting an oversized document to full Live.
 */
export function selectLiveEligibilitySource(
    active: LiveEligibilitySnapshot | null,
    presentation: LiveEligibilitySnapshot | null,
): string {
    if (!active) return "";
    return presentation?.documentId === active.documentId && presentation.version === active.version
        ? presentation.value
        : active.value;
}

/**
 * This is an admission-control heuristic, not a Markdown parser. It only
 * chooses whether expensive future widgets may run; all visible structural
 * styling continues to come from Lezer in `liveMarkdownPresentation`.
 */
export function assessLiveEligibility(source: string): LiveEligibility {
    const bytes = new TextEncoder().encode(source).byteLength;
    let lines = 1;
    let maxLineLength = 0;
    let lineLength = 0;
    for (let index = 0; index < source.length; index++) {
        if (source.charCodeAt(index) === 10) {
            lines++;
            maxLineLength = Math.max(maxLineLength, lineLength);
            lineLength = 0;
        } else {
            lineLength++;
        }
    }
    maxLineLength = Math.max(maxLineLength, lineLength);

    // Complex blocks are deferred in restricted mode. This remains admission
    // control rather than a renderer, but it must use the same structural
    // source of truth as Live itself: literal image-looking text (especially
    // inside inline/fenced code) must not silently change the mode boundary.
    let complexBlocks = 0;
    parser.parse(source).iterate({
        enter(node) {
            if (node.name === "FencedCode" || node.name === "Image") complexBlocks++;
        },
    });
    const reasons: LiveRestrictionReason[] = [];
    if (bytes > LIVE_LIMITS.maxBytes) reasons.push("bytes");
    if (lines > LIVE_LIMITS.maxLines) reasons.push("lines");
    if (maxLineLength > LIVE_LIMITS.maxLineLength) reasons.push("lineLength");
    if (complexBlocks > LIVE_LIMITS.maxComplexBlocks) reasons.push("complexBlocks");
    return { restricted: reasons.length > 0, reasons, bytes, lines, maxLineLength, complexBlocks };
}
