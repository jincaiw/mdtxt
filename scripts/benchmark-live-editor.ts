import { parser } from "@lezer/markdown";
import { EditorState } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { createLargeMarkdown } from "../src/test/fixtures/largeMarkdown";
import { liveMarkdownPresentation } from "../src/editor/live/liveMarkdownPresentation";

const mib = 1024 * 1024;
const samples = [1, 10].map((size) => ({ label: `${size} MiB`, bytes: size * mib }));

function milliseconds(start: number): number {
    return Number((performance.now() - start).toFixed(2));
}

function percentile(values: readonly number[], ratio: number): number {
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

function measureLocalEdits(state: EditorState): { p50: number; p95: number } {
    const samples: number[] = [];
    let current = state;
    for (let index = 0; index < 20; index++) {
        const from = Math.min(current.doc.length, Math.floor(current.doc.length * ((index + 1) / 21)));
        const start = performance.now();
        current = current.update({ changes: { from, insert: "x" } }).state;
        samples.push(milliseconds(start));
    }
    return { p50: percentile(samples, 0.5), p95: percentile(samples, 0.95) };
}

console.log("mdtxt Live Beta CodeMirror state baseline (no DOM/WebView input latency)");
console.log("Run on a release candidate and record machine, OS, WebView and output in the P6 tracking record.");
for (const sample of samples) {
    const document = createLargeMarkdown(sample.bytes);
    const parseStart = performance.now();
    const tree = parser.parse(document);
    const parseMs = milliseconds(parseStart);
    const sourceStart = performance.now();
    const sourceState = EditorState.create({ doc: document, extensions: [markdown({ base: markdownLanguage })] });
    const sourceCreateMs = milliseconds(sourceStart);
    const liveStart = performance.now();
    const liveState = EditorState.create({ doc: document, extensions: [markdown({ base: markdownLanguage }), liveMarkdownPresentation] });
    const liveCreateMs = milliseconds(liveStart);
    const liveEdits = measureLocalEdits(liveState);
    console.log(
        `${sample.label}: parse=${parseMs}ms tree=${tree.length} chars `
        + `source-state=${sourceCreateMs}ms live-state=${liveCreateMs}ms `
        + `live-local-edit p50=${liveEdits.p50}ms p95=${liveEdits.p95}ms`,
    );
    // Keep sourceState alive through the measurement so JIT warmup cannot
    // elide its creation in future runtime optimizations.
    void sourceState;
}
