/**
 * Metadata-only recovery ordering. The native recovery payload remains the
 * authoritative document text; this model decides only how verified entries
 * reappear as tabs after a crash.
 */
export interface RecoveryPlacement {
    tabIndex?: number;
    wasActive?: boolean;
    savedAtMs: number;
}

export function orderRecoveryEntries<T extends RecoveryPlacement>(entries: readonly T[]): T[] {
    return [...entries].sort((left, right) =>
        (left.tabIndex ?? Number.MAX_SAFE_INTEGER) - (right.tabIndex ?? Number.MAX_SAFE_INTEGER)
        || left.savedAtMs - right.savedAtMs
    );
}

/** Prefer the tab that was active before termination; legacy entries fall back
 * to the most recently written recovered tab. */
export function selectRecoveredActive<T extends RecoveryPlacement>(ordered: readonly T[]): T | null {
    return ordered.find((entry) => entry.wasActive) ?? ordered.at(-1) ?? null;
}
