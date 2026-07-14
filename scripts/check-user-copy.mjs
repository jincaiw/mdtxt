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

// Material Symbols use text glyph names, not user-facing copy. URLs, product
// names, shortcuts, and file-format labels are technical values rather than
// translatable prose. Everything else visible or exposed to assistive
// technology must go through the locale catalogue.
const attributePattern = /\b(?:aria-label|title|placeholder)=(["'])([^"']{2,})\1/g;
const textPattern = /<([^>]+)>\s*([A-Za-z][^<{>\n]{1,})\s*<\//g;

function isNonCopy(text, openingTag = "") {
  return text.includes("i18n-ignore")
    || /material-symbols|aria-hidden/.test(openingTag)
    || /^https?:\/\//.test(text)
    || text === "mdtxt"
    || text === "Aa"
    || /^gpt-[\w.-]+,/.test(text)
    || /^(?:HTML|PDF|Word \(\.docx\)|AI)$/.test(text)
    || /^(?:Ctrl|Cmd|Alt|Shift|Enter|Esc|F\d+)(?:[+ ]|$)/.test(text);
}

const matches = [];
for (const path of (await files(sourceDir)).filter((file) => /\.(?:ts|tsx)$/.test(file) && !/\.test\.(?:ts|tsx)$/.test(file))) {
  const source = await readFile(path, "utf8");
  for (const match of source.matchAll(attributePattern)) {
      const text = match[2].trim();
      if (!text || isNonCopy(text)) continue;
      const line = source.slice(0, match.index).split("\n").length;
      matches.push(`${relative(root, path)}:${line}  ${JSON.stringify(text)}`);
  }
  for (const match of source.matchAll(textPattern)) {
      const text = match[2].trim();
      if (!text || isNonCopy(text, match[1])) continue;
      const line = source.slice(0, match.index).split("\n").length;
      matches.push(`${relative(root, path)}:${line}  ${JSON.stringify(text)}`);
  }
}

console.log(`User-copy scan found ${matches.length} direct JSX/accessibility literals across src/.`);
if (matches.length) console.log(matches.join("\n"));

if (enforce && matches.length) {
  console.error("Direct user copy is not allowed once the P3 locale migration is complete.");
  process.exit(1);
}
