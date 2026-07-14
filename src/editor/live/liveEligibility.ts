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

    // Complex blocks are deferred in restricted mode. Count only unmistakable
    // fence/image markers here; syntax recognition/rendering remains Lezer-led.
    const complexBlocks = (source.match(/^```(?:mermaid|[\w+-]+)?\s*$/gim)?.length ?? 0)
        + (source.match(/!\[[^\]]*\]\([^)]*\)/g)?.length ?? 0);
    const reasons: LiveRestrictionReason[] = [];
    if (bytes > LIVE_LIMITS.maxBytes) reasons.push("bytes");
    if (lines > LIVE_LIMITS.maxLines) reasons.push("lines");
    if (maxLineLength > LIVE_LIMITS.maxLineLength) reasons.push("lineLength");
    if (complexBlocks > LIVE_LIMITS.maxComplexBlocks) reasons.push("complexBlocks");
    return { restricted: reasons.length > 0, reasons, bytes, lines, maxLineLength, complexBlocks };
}
