import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const bundleRoot = "src-tauri/target/debug/bundle";
const manifestPath = join(bundleRoot, "platform-evidence.json");
const config = JSON.parse(await readFile("src-tauri/tauri.conf.json", "utf8"));

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

const candidates = (await filesBelow(bundleRoot)).filter((path) => path !== manifestPath);
const files = await Promise.all(candidates.map(async (path) => {
  const bytes = await readFile(path);
  return {
    path: relative(bundleRoot, path).replaceAll("\\", "/"),
    bytes: (await stat(path)).size,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}));

files.sort((left, right) => left.path.localeCompare(right.path));
const manifest = {
  generatedAt: new Date().toISOString(),
  platform: process.env.RUNNER_OS ?? process.platform,
  architecture: process.env.RUNNER_ARCH ?? process.arch,
  productName: config.productName,
  identifier: config.identifier,
  version: config.version,
  files,
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote evidence manifest for ${files.length} bundle files.`);
