import { parser } from "@lezer/markdown";
import { createLargeMarkdown } from "../src/test/fixtures/largeMarkdown";

const mib = 1024 * 1024;
const samples = [1, 10].map((size) => ({ label: `${size} MiB`, bytes: size * mib }));

function milliseconds(start: number): number {
    return Number((performance.now() - start).toFixed(2));
}

console.log("mdtxt Live Beta Lezer parser baseline (no decorations/widgets)");
console.log("Run on a release candidate and record the machine, OS, WebView and output in the P6 tracking record.");
for (const sample of samples) {
    const document = createLargeMarkdown(sample.bytes);
    const parseStart = performance.now();
    const tree = parser.parse(document);
    const parseMs = milliseconds(parseStart);
    console.log(`${sample.label}: parse=${parseMs}ms tree=${tree.length} chars`);
}
