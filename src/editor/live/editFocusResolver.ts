export interface EditFocusRange {
    from: number;
    to: number;
}

export interface EditFocusInput {
    selections: readonly EditFocusRange[];
    /**
     * CodeMirror only guarantees an IME lifecycle signal, not a stable public
     * composition range. Treat composition as document-wide source retention
     * until a renderer can obtain a precise range without touching the DOM.
     */
    compositionStarted: boolean;
    compositionRanges?: readonly EditFocusRange[];
    pointerTarget?: EditFocusRange | null;
    findRanges?: readonly EditFocusRange[];
}

export interface EditFocusResolution {
    sourceRanges: readonly EditFocusRange[];
    keepAllSource: boolean;
    canCollapseMarkers: boolean;
}

function normalized(range: EditFocusRange): EditFocusRange | null {
    const from = Math.max(0, Math.min(range.from, range.to));
    const to = Math.max(0, Math.max(range.from, range.to));
    return { from, to };
}

function mergeRanges(ranges: readonly EditFocusRange[]): readonly EditFocusRange[] {
    const sorted = ranges.flatMap((range) => {
        const valid = normalized(range);
        return valid ? [valid] : [];
    }).sort((left, right) => left.from - right.from || left.to - right.to);
    const merged: EditFocusRange[] = [];
    for (const range of sorted) {
        const previous = merged.at(-1);
        if (previous && range.from <= previous.to) previous.to = Math.max(previous.to, range.to);
        else merged.push({ ...range });
    }
    return merged;
}

/**
 * The single source-of-truth for deciding whether a future collapsed marker
 * must return to raw Markdown. Current P6 decorations never collapse source,
 * but every renderer must use this resolver before it introduces that behavior.
 */
export function resolveEditFocus(input: EditFocusInput): EditFocusResolution {
    const sourceRanges = mergeRanges([
        ...input.selections,
        ...(input.compositionRanges ?? []),
        ...(input.pointerTarget ? [input.pointerTarget] : []),
        ...(input.findRanges ?? []),
    ]);
    return {
        sourceRanges,
        keepAllSource: input.compositionStarted,
        canCollapseMarkers: !input.compositionStarted,
    };
}

export function rangeIntersectsEditFocus(range: EditFocusRange, resolution: EditFocusResolution): boolean {
    return resolution.keepAllSource || resolution.sourceRanges.some((focus) => (
        focus.from === focus.to
            ? range.from <= focus.from && focus.from <= range.to
            : range.from < focus.to && focus.from < range.to
    ));
}
