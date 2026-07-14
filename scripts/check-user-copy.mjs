import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();
const sourceDir = join(root, "src");
const enforce = process.argv.includes("--enforce");

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  }));
  return nested.flat();
}

// This deliberately reports rather than fails by default. P1 establishes a
// measurable baseline in a product with existing literal copy; P3 will migrate
// those strings to semantic locale keys and turn `--enforce` into CI policy.
const uiLiteralPatterns = [
  /\b(?:aria-label|title|placeholder)=(["'])([^"']{2,})\1/g,
  /<[^>]+>\s*([A-Za-z][^<{>\n]{1,})\s*<\//g,
];

const matches = [];
for (const path of (await files(sourceDir)).filter((file) => /\.(?:ts|tsx)$/.test(file) && !/\.test\.(?:ts|tsx)$/.test(file))) {
  const source = await readFile(path, "utf8");
  for (const pattern of uiLiteralPatterns) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const text = (match[2] ?? match[1] ?? "").trim();
      if (!text || text.includes("i18n-ignore")) continue;
      const line = source.slice(0, match.index).split("\n").length;
      matches.push(`${relative(root, path)}:${line}  ${JSON.stringify(text)}`);
    }
  }
}

console.log(`User-copy scan found ${matches.length} direct JSX/accessibility literals across src/.`);
if (matches.length) console.log(matches.join("\n"));

if (enforce && matches.length) {
  console.error("Direct user copy is not allowed once the P3 locale migration is complete.");
  process.exit(1);
}
