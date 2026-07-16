import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function filesBelow(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? filesBelow(path) : [path];
    });
}

const packageVersion = JSON.parse(readFileSync("package.json", "utf8")).version;
const tauriVersion = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8")).version;
const cargoVersion = /^version = "([^"]+)"/m.exec(readFileSync("src-tauri/Cargo.toml", "utf8"))?.[1];

if (!cargoVersion || new Set([packageVersion, tauriVersion, cargoVersion]).size !== 1) {
    throw new Error(`Version mismatch: package=${packageVersion}, tauri=${tauriVersion}, cargo=${cargoVersion ?? "missing"}`);
}

const changelog = readFileSync("CHANGELOG.md", "utf8");
if (!changelog.includes(`## [${packageVersion}]`)) {
    throw new Error(`CHANGELOG.md is missing the ${packageVersion} release section.`);
}

execFileSync(process.execPath, ["scripts/check-product-identity.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/check-security-boundaries.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/check-i18n.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/check-user-copy.mjs", "--enforce"], { stdio: "inherit" });
// The deployed documentation is part of the public product surface. Build it
// first, then reject an accidental reintroduction of the upstream brand in the
// generated files (unused source components are not a release artifact).
execFileSync("bun", ["run", "build"], { cwd: "docs", stdio: "inherit" });
const upstreamBrandFiles = filesBelow("docs/dist").filter((path) =>
    /paperling|jincaiw\/paperling|razee4315\/paperling/i.test(readFileSync(path, "utf8")),
);
if (upstreamBrandFiles.length) {
    throw new Error(`Documentation build retains upstream product identity: ${upstreamBrandFiles.join(", ")}`);
}
console.log(`Release preflight passed for v${packageVersion}.`);
