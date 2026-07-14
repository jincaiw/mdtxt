/**
 * The smallest contiguous replacement that transforms `before` into `after`.
 *
 * CodeMirror maps a single contiguous change through selections, decorations,
 * and undo history. External updates in the legacy React bridge should use this
 * instead of replacing the entire document, so unaffected ranges retain their
 * identity until DocumentSession removes that bridge in P4.
 */
export interface MinimalTextChange {
    from: number;
    to: number;
    insert: string;
}

export function minimalTextChange(before: string, after: string): MinimalTextChange | null {
    if (before === after) return null;

    const sharedLength = Math.min(before.length, after.length);
    let from = 0;
    while (from < sharedLength && before.charCodeAt(from) === after.charCodeAt(from)) {
        from += 1;
    }

    let beforeEnd = before.length;
    let afterEnd = after.length;
    while (
        beforeEnd > from &&
        afterEnd > from &&
        before.charCodeAt(beforeEnd - 1) === after.charCodeAt(afterEnd - 1)
    ) {
        beforeEnd -= 1;
        afterEnd -= 1;
    }

    return { from, to: beforeEnd, insert: after.slice(from, afterEnd) };
}
