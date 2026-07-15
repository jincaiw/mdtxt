/**
 * Metadata-only recovery ordering. The native recovery payload remains the
 * authoritative document text; this model decides only how verified entries
 * reappear as tabs after a crash.
 */
export interface RecoveryPlacement {
    recoverySessionId?: string;
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

/**
 * Restore-all is a session operation, not a directory-wide operation. A
 * failed cleanup can leave a previous crash's verified entries beside a newer
 * crash batch; mixing their tab indices would produce a fabricated session.
 * Legacy entries have no batch metadata, so retain their former all-at-once
 * behavior only when they are the newest recoverable group.
 */
export function latestRecoveryBatch<T extends RecoveryPlacement>(entries: readonly T[]): T[] {
    const latest = entries.reduce<T | null>(
        (current, entry) => !current || entry.savedAtMs > current.savedAtMs ? entry : current,
        null,
    );
    if (!latest) return [];
    return latest.recoverySessionId
        ? entries.filter((entry) => entry.recoverySessionId === latest.recoverySessionId)
        : entries.filter((entry) => !entry.recoverySessionId);
}
